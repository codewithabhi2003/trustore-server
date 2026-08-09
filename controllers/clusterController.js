const asyncHandler = require('express-async-handler');
const { findBestCluster } = require('../services/clusterService');
const DemandLog = require('../models/DemandLog');

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

  // Fire-and-forget — never blocks the response or fails the search if logging errors.
  const matchesByName = new Map(
    (result.bestCluster?.productMatches || []).map((m) => [m.requestedName, m.available])
  );
  DemandLog.insertMany(
    products.map((p) => ({
      itemName: p.name,
      keywords: p.keywords || [p.name],
      location: { type: 'Point', coordinates: [lng, lat] },
      wasFulfilled: matchesByName.get(p.name) ?? false,
    }))
  ).catch((err) => console.error('[clusterController] Failed to log demand:', err.message));
});

module.exports = { findCluster };