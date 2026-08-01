const Store = require('../models/Store');
const Product = require('../models/Product');
const { haversineDistance } = require('../utils/geoUtils');

/**
 * MAIN FUNCTION — called after Groq extracts products
 * Input: customer coordinates, extracted product list
 * Output: ranked clusters with matched products
 */
const findBestCluster = async (customerLat, customerLng, extractedProducts, radiusKm = 5) => {
  // ── STEP 1: Find all verified stores within radius ────────────────────────
  const nearbyStores = await Store.find({
    verificationStatus: 'approved',
    isActive: true,
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [customerLng, customerLat] },
        $maxDistance: radiusKm * 1000, // convert km to meters
      },
    },
  }).select('storeName location address rating totalOrders');

  if (nearbyStores.length === 0) {
    return { success: false, message: 'No verified stores found near your location.' };
  }

  // ── STEP 2: Build clusters using DBSCAN-like proximity grouping ──────────
  // Group stores that are within 500m of each other into the same cluster
  const CLUSTER_RADIUS_M = 500;
  const clusters = buildClusters(nearbyStores, CLUSTER_RADIUS_M);

  // ── STEP 3: For each cluster, find available products ────────────────────
  const clustersWithProducts = await Promise.all(
    clusters.map(async (cluster) => {
      const storeIds = cluster.stores.map((s) => s._id);

      // For each requested product, search across all stores in this cluster
      const productMatches = await Promise.all(
        extractedProducts.map(async (requestedProduct) => {
          const keywords = requestedProduct.keywords || [requestedProduct.name];
          const matchedProducts = await Product.find({
            storeId: { $in: storeIds },
            isAvailable: true,
            stock: { $gt: 0 },
            $or: [
              { name: { $regex: escapeRegex(requestedProduct.name), $options: 'i' } },
              { tags: { $in: keywords } },
              { nameKeywords: { $in: keywords } },
            ],
          }).populate('storeId', 'storeName location');

          return {
            requestedName: requestedProduct.name,
            requestedQuantity: requestedProduct.quantity,
            requestedUnit: requestedProduct.unit,
            available: matchedProducts.length > 0,
            products: matchedProducts,
          };
        })
      );

      const availableCount = productMatches.filter((p) => p.available).length;
      const totalRequested = extractedProducts.length;

      // Calculate centroid of the cluster
      const centroid = calculateCentroid(cluster.stores);

      // Distance from customer to cluster centroid
      const distanceKm = haversineDistance(customerLat, customerLng, centroid.lat, centroid.lng);

      // Average store rating in cluster
      const avgRating =
        cluster.stores.reduce((sum, s) => sum + (s.rating || 0), 0) / cluster.stores.length;

      // ── STEP 4: Score the cluster ─────────────────────────────────────────
      // Weights: Product Availability 50%, Distance 25%, Delivery Efficiency 15%, Ratings 10%
      const availabilityScore = totalRequested > 0 ? (availableCount / totalRequested) * 100 : 0;
      const distanceScore = Math.max(0, 100 - (distanceKm / radiusKm) * 100);
      const efficiencyScore = calculateEfficiencyScore(cluster.stores, distanceKm);
      const ratingScore = (avgRating / 5) * 100;

      const totalScore =
        availabilityScore * 0.5 + distanceScore * 0.25 + efficiencyScore * 0.15 + ratingScore * 0.1;

      return {
        clusterId: cluster.id,
        stores: cluster.stores,
        centroid,
        distanceKm: Math.round(distanceKm * 10) / 10,
        productMatches,
        availableCount,
        totalRequested,
        availabilityScore: Math.round(availabilityScore),
        distanceScore: Math.round(distanceScore),
        efficiencyScore: Math.round(efficiencyScore),
        ratingScore: Math.round(ratingScore),
        totalScore: Math.round(totalScore),
        avgRating: Math.round(avgRating * 10) / 10,
      };
    })
  );

  // ── STEP 5: Sort clusters by total score ─────────────────────────────────
  clustersWithProducts.sort((a, b) => b.totalScore - a.totalScore);
  const bestCluster = clustersWithProducts[0];

  // ── STEP 6: Border Store Exception (100 meters) ──────────────────────────
  const missingProducts = bestCluster.productMatches.filter((p) => !p.available);

  if (missingProducts.length > 0) {
    const borderStores = await findBorderStores(bestCluster.stores, missingProducts, 100);
    if (borderStores.length > 0) {
      bestCluster.borderStores = borderStores;
      bestCluster.borderStoreApplied = true;
    }
  }

  return {
    success: true,
    bestCluster,
    allClusters: clustersWithProducts,
    nearbyStores: nearbyStores.length,
  };
};

/**
 * DBSCAN-like clustering — groups stores within clusterRadiusM of each other
 */
const buildClusters = (stores, clusterRadiusM) => {
  const visited = new Set();
  const clusters = [];
  let clusterId = 0;

  for (const store of stores) {
    if (visited.has(store._id.toString())) continue;

    const cluster = { id: `cluster_${clusterId++}`, stores: [store] };
    visited.add(store._id.toString());

    for (const otherStore of stores) {
      if (visited.has(otherStore._id.toString())) continue;
      const [lng1, lat1] = store.location.coordinates;
      const [lng2, lat2] = otherStore.location.coordinates;
      const distM = haversineDistance(lat1, lng1, lat2, lng2) * 1000;
      if (distM <= clusterRadiusM) {
        cluster.stores.push(otherStore);
        visited.add(otherStore._id.toString());
      }
    }

    clusters.push(cluster);
  }

  return clusters;
};

/**
 * Calculates geographic centroid of a group of stores
 */
const calculateCentroid = (stores) => {
  const sum = stores.reduce(
    (acc, s) => ({
      lat: acc.lat + s.location.coordinates[1],
      lng: acc.lng + s.location.coordinates[0],
    }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / stores.length, lng: sum.lng / stores.length };
};

/**
 * Efficiency score — penalizes clusters with many stores (more pickups = less efficient)
 */
const calculateEfficiencyScore = (stores, distanceKm) => {
  const storeCountPenalty = Math.max(0, 100 - (stores.length - 1) * 10);
  const distancePenalty = Math.max(0, 100 - distanceKm * 15);
  return (storeCountPenalty + distancePenalty) / 2;
};

/**
 * Border Store Exception — finds verified stores within 100m of any cluster store
 * that carry the missing products
 */
const findBorderStores = async (clusterStores, missingProducts, thresholdM) => {
  const missingNames = missingProducts.map((p) => p.requestedName);
  const clusterStoreIds = clusterStores.map((s) => s._id);
  const borderResults = [];

  for (const clusterStore of clusterStores) {
    const [storeLng, storeLat] = clusterStore.location.coordinates;

    // Find verified stores within thresholdM that are NOT already in the cluster
    const candidateStores = await Store.find({
      verificationStatus: 'approved',
      isActive: true,
      _id: { $nin: clusterStoreIds },
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [storeLng, storeLat] },
          $maxDistance: thresholdM,
        },
      },
    });

    for (const candidate of candidateStores) {
      // Check if this border store has any missing products
      const matchedMissing = await Product.find({
        storeId: candidate._id,
        isAvailable: true,
        stock: { $gt: 0 },
        $or: missingNames.map((name) => ({
          $or: [
            { name: { $regex: escapeRegex(name), $options: 'i' } },
            { tags: name },
            { nameKeywords: name },
          ],
        })),
      });

      if (matchedMissing.length > 0) {
        const distanceM =
          haversineDistance(
            storeLat,
            storeLng,
            candidate.location.coordinates[1],
            candidate.location.coordinates[0]
          ) * 1000;

        borderResults.push({
          store: candidate,
          products: matchedMissing,
          distanceFromClusterM: Math.round(distanceM),
          fills: matchedMissing.map((p) => p.name),
        });
      }
    }
  }

  return borderResults;
};

// Prevents user-supplied product names from breaking the $regex query
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { findBestCluster };
