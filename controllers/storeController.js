const asyncHandler = require('express-async-handler');
const Store = require('../models/Store');
const Product = require('../models/Product');
const { uploadBuffer } = require('../services/cloudinaryService');
const { geocodeAddress } = require('../services/geocodingService');
const { haversineDistance } = require('../utils/geoUtils');
const { notifyAdminsNewStorePending } = require('../services/notificationService');

// GET /api/stores/geocode?q=<free text address>
const geocode = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 3) {
    return res.status(400).json({ success: false, message: 'Enter at least 3 characters to search' });
  }

  try {
    const results = await geocodeAddress(q.trim());
    res.json({ success: true, results });
  } catch (err) {
    console.error('Geocoding error:', err.message);
    res
      .status(502)
      .json({ success: false, message: 'Could not look up that address right now — try pinning it on the map instead.' });
  }
});

// POST /api/stores/register (storeOwner, multipart/form-data)
const registerStore = asyncHandler(async (req, res) => {
  try {
    const { storeName, ownerName, email, phone, category, street, city, state, pincode, coordinates } = req.body;

    if (!storeName || !ownerName || !email || !phone || !category || !street || !city || !coordinates) {
      return res.status(400).json({ success: false, message: 'Please fill in all required fields' });
    }

    const existing = await Store.findOne({ ownerId: req.user._id });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You already have a store registered' });
    }

    let coords;
    try {
      coords = JSON.parse(coordinates); // [lng, lat]
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid location — please pin your store on the map' });
    }

    const [lng, lat] = Array.isArray(coords) ? coords : [];
    const validCoords =
      Array.isArray(coords) &&
      coords.length === 2 &&
      typeof lng === 'number' &&
      typeof lat === 'number' &&
      !Number.isNaN(lng) &&
      !Number.isNaN(lat) &&
      lng >= -180 &&
      lng <= 180 &&
      lat >= -90 &&
      lat <= 90;

    if (!validCoords) {
      return res.status(400).json({
        success: false,
        message: 'Invalid map location — please tap the map (or search your address) again to drop a fresh pin.',
      });
    }

    if (!req.files?.aadhaarCard?.[0] || !req.files?.shopLicense?.[0]) {
      return res.status(400).json({ success: false, message: 'Both Aadhaar card and shop license documents are required' });
    }

    const uploads = [
      uploadBuffer(req.files.aadhaarCard[0].buffer, 'trustore/documents'),
      uploadBuffer(req.files.shopLicense[0].buffer, 'trustore/documents'),
    ];
    if (req.files?.logo?.[0]) {
      uploads.push(uploadBuffer(req.files.logo[0].buffer, 'trustore/logos'));
    }
    const [aadhaarUpload, licenseUpload, logoUpload] = await Promise.all(uploads);

    const store = await Store.create({
      ownerId: req.user._id,
      storeName,
      ownerName,
      email,
      phone,
      category,
      address: { street, city, state, pincode, fullAddress: `${street}, ${city}, ${state} ${pincode}`.trim() },
      location: { type: 'Point', coordinates: coords },
      documents: {
        aadhaarCard: { url: aadhaarUpload.url, publicId: aadhaarUpload.publicId },
        shopLicense: { url: licenseUpload.url, publicId: licenseUpload.publicId },
      },
      logo: logoUpload ? logoUpload.url : null,
      verificationStatus: 'pending',
    });

    res.status(201).json({ success: true, message: 'Store submitted for review', store });
    notifyAdminsNewStorePending(store); // fire-and-forget — response already sent
  } catch (err) {
    // Wraps the ENTIRE handler (not just one step) so whichever line actually throws —
    // the duplicate-store lookup, Cloudinary, or the final DB write — prints a clearly
    // labeled, specific reason here instead of a bare "500 Internal Server Error".
    console.error('========================================');
    console.error('[storeController.registerStore] FAILED:', err.name, '-', err.message);
    console.error(err.stack);
    console.error('========================================');
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'development' ? err.message : 'Could not register your store right now.',
    });
  }
});

// GET /api/stores/nearby?lat=X&lng=Y&radius=5
const getNearbyStores = asyncHandler(async (req, res) => {
  const { lat, lng, radius = 5 } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ success: false, message: 'lat and lng query params are required' });
  }

  const stores = await Store.find({
    verificationStatus: 'approved',
    isActive: true,
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        $maxDistance: parseFloat(radius) * 1000,
      },
    },
  });

  const withDistance = stores.map((s) => ({
    ...s.toObject(),
    distanceKm:
      Math.round(
        haversineDistance(parseFloat(lat), parseFloat(lng), s.location.coordinates[1], s.location.coordinates[0]) * 10
      ) / 10,
  }));

  res.json({ success: true, stores: withDistance });
});

// GET /api/stores/my-store (storeOwner)
const getMyStore = asyncHandler(async (req, res) => {
  const store = await Store.findOne({ ownerId: req.user._id });
  if (!store) {
    return res.status(404).json({ success: false, message: 'No store found for this account' });
  }
  res.json({ success: true, store });
});

// PUT /api/stores/my-store (storeOwner)
const updateMyStore = asyncHandler(async (req, res) => {
  const store = await Store.findOne({ ownerId: req.user._id });
  if (!store) {
    return res.status(404).json({ success: false, message: 'No store found for this account' });
  }

  const { storeName, phone, category, street, city, state, pincode } = req.body;
  if (storeName) store.storeName = storeName;
  if (phone) store.phone = phone;
  if (category) store.category = category;
  if (street) store.address.street = street;
  if (city) store.address.city = city;
  if (state) store.address.state = state;
  if (pincode) store.address.pincode = pincode;

  await store.save();
  res.json({ success: true, store });
});

// PATCH /api/stores/my-store/toggle-open (storeOwner) — quick open/closed switch
const toggleOpen = asyncHandler(async (req, res) => {
  const store = await Store.findOne({ ownerId: req.user._id });
  if (!store) {
    return res.status(404).json({ success: false, message: 'No store found for this account' });
  }
  store.isOpen = !store.isOpen;
  await store.save();
  res.json({ success: true, store });
});

// GET /api/stores/:id (public — only ever shows approved stores)
const getStoreById = asyncHandler(async (req, res) => {
  const store = await Store.findOne({ _id: req.params.id, verificationStatus: 'approved', isActive: true });
  if (!store) {
    return res.status(404).json({ success: false, message: 'Store not found' });
  }
  res.json({ success: true, store });
});

// GET /api/stores/:id/products
const getStoreProducts = asyncHandler(async (req, res) => {
  const store = await Store.findOne({ _id: req.params.id, verificationStatus: 'approved', isActive: true });
  if (!store) {
    return res.status(404).json({ success: false, message: 'Store not found' });
  }
  const products = await Product.find({ storeId: store._id, isAvailable: true }).populate('categoryId', 'name');
  res.json({ success: true, products });
});

module.exports = {
  registerStore,
  getNearbyStores,
  getMyStore,
  updateMyStore,
  getStoreById,
  getStoreProducts,
  geocode,
  toggleOpen,
};