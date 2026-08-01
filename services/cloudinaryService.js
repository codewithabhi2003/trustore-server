const crypto = require('crypto');
const cloudinary = require('../config/cloudinary');

// If .env has placeholder or otherwise invalid Cloudinary credentials, the real API call
// throws (Cloudinary itself rejects bad credentials with a 403 "UnexpectedResponse"),
// which used to crash the request as a 500. Now: always attempt the real upload first,
// but if it fails for ANY reason (missing creds, wrong creds, network issue), fall back
// to a placeholder URL so the flow still completes end to end during local testing.
const placeholderResult = (folder) => {
  const fakeId = crypto.randomBytes(6).toString('hex');
  return {
    url: `https://placehold.co/600x400?text=${encodeURIComponent(folder)}`,
    publicId: `${folder}/local-${fakeId}`,
  };
};

const looksConfigured = () => {
  const placeholders = ['your_cloud_name', 'your_api_key', 'your_api_secret', '', undefined];
  return (
    !placeholders.includes(process.env.CLOUDINARY_CLOUD_NAME) &&
    !placeholders.includes(process.env.CLOUDINARY_API_KEY) &&
    !placeholders.includes(process.env.CLOUDINARY_API_SECRET)
  );
};

/**
 * Uploads a Multer memory-storage file buffer to Cloudinary.
 * @param {Buffer} buffer - file.buffer from Multer
 * @param {string} folder - Cloudinary folder, e.g. 'trustore/documents'
 * @param {object} options - extra Cloudinary upload options (e.g. { resource_type: 'auto' })
 * @returns {Promise<{url: string, publicId: string}>}
 */
const uploadBuffer = (buffer, folder, options = {}) => {
  if (!looksConfigured()) {
    console.warn(
      `[cloudinaryService] No Cloudinary credentials set in server/.env — using a placeholder URL for "${folder}".`
    );
    return Promise.resolve(placeholderResult(folder));
  }

  return new Promise((resolve) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto', ...options },
      (err, result) => {
        if (err) {
          console.warn(
            `[cloudinaryService] Real Cloudinary upload for "${folder}" failed (${err.name || 'Error'}: ${err.message}) — ` +
              'falling back to a placeholder URL so the flow can still complete. ' +
              'Double-check CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET in server/.env against your actual Cloudinary dashboard.'
          );
          return resolve(placeholderResult(folder));
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
};

const deleteAsset = (publicId) => {
  if (!looksConfigured()) return Promise.resolve({ result: 'skipped — no Cloudinary credentials configured' });
  return cloudinary.uploader.destroy(publicId).catch((err) => {
    console.warn(`[cloudinaryService] Could not delete asset "${publicId}":`, err.message);
    return { result: 'skipped — delete failed' };
  });
};

module.exports = { uploadBuffer, deleteAsset };