const asyncHandler = require('express-async-handler');
const { findBestCluster } = require('../services/clusterService');

// POST /api/clusters/find — { lat, lng, products[] }
const findCluster = asyncHandler(async (req, res) => {
  const { lat, lng, products } = req.body;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ success: false, message: 'lat and lng are required and must be numbers' });
  }
  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ success: false, message: 'products must be a non-empty array' });
  }

  const result = await findBestCluster(lat, lng, products);
  res.json(result);
});

module.exports = { findCluster };
