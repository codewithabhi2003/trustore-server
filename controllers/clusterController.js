
const asyncHandler = require('express-async-handler');
const { findBestCluster } = require('../services/clusterService');
const DemandLog = require('../models/DemandLog');

// POST /api/clusters/find — { lat, lng, products[] }
const findCluster = asyncHandler(async (req, res) => {
  const { lat, lng, products } = req.body;

  if (
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180
  ) {
    return res.status(400).json({
      success: false,
      message: 'Valid numeric latitude and longitude are required.',
    });
  }

  if (
    !Array.isArray(products) ||
    products.length === 0 ||
    products.some(
      (product) =>
        !product ||
        typeof product.name !== 'string' ||
        !product.name.trim()
    )
  ) {
    return res.status(400).json({
      success: false,
      message: 'products must be a non-empty array of products with names.',
    });
  }

  const result = await findBestCluster(lat, lng, products);

  if (!result.success) {
    return res.status(200).json(result);
  }

  // Send the search result before writing analytics.
  res.json(result);

  const normalize = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

  const fulfilledNames = new Set(
    (result.bestCluster?.productMatches || [])
      .filter((match) => match.available)
      .map((match) => normalize(match.requestedName))
  );

  // Border-store fills are normalized requested product names.
  for (const borderStore of result.borderStores || []) {
    for (const name of borderStore.fills || []) {
      fulfilledNames.add(normalize(name));
    }
  }

  DemandLog.insertMany(
    products.map((product) => ({
      itemName: product.name.trim(),
      keywords: product.keywords || [product.name],
      location: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      wasFulfilled: fulfilledNames.has(
        normalize(product.name)
      ),
    }))
  ).catch((err) => {
    console.error(
      '[clusterController] Failed to log demand:',
      err.message
    );
  });
});

module.exports = { findCluster };
