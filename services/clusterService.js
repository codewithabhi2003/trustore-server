const Store = require('../models/Store');
const Product = require('../models/Product');
const { haversineDistance } = require('../utils/geoUtils');

const DEFAULT_RADIUS_KM = 2;
const CLUSTER_DIAMETER_M = 500;
const BORDER_RADIUS_M = 100;

const SCORE_WEIGHTS = {
  availability: 0.5,
  distance: 0.25,
  efficiency: 0.15,
  rating: 0.1,
};

const STOPWORDS = new Set([
  'of', 'a', 'an', 'the', 'and', 'or', 'for', 'with', 'pack', 'piece',
]);

const findBestCluster = async (
  customerLat,
  customerLng,
  extractedProducts,
  radiusKm = DEFAULT_RADIUS_KM
) => {
  validateSearchInput(customerLat, customerLng, extractedProducts, radiusKm);

  const nearbyStores = await Store.find({
    verificationStatus: 'approved',
    isActive: true,
    isOpen: { $ne: false },
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [customerLng, customerLat],
        },
        $maxDistance: radiusKm * 1000,
      },
    },
  }).select('storeName location address rating totalOrders');

  if (!nearbyStores.length) {
    return {
      success: false,
      message: 'No verified stores found near your location.',
      bestCluster: null,
      allClusters: [],
      nearbyStores: 0,
      borderStores: [],
    };
  }

  const clusters = buildClusters(nearbyStores, CLUSTER_DIAMETER_M);

  const clustersWithProducts = await Promise.all(
    clusters.map(async (cluster) => {
      const storeIds = cluster.stores.map((store) => store._id);

      const productMatches = await Promise.all(
        extractedProducts.map(async (requestedProduct) => {
          const matchedProducts = await findMatchingProducts(
            requestedProduct,
            storeIds
          );

          // Return every matching in-stock product as a selectable option.
          const options = matchedProducts
            .map(toProductOption)
            .sort((a, b) => {
              const priceA = Number.isFinite(a.price)
                ? a.price
                : Number.POSITIVE_INFINITY;
              const priceB = Number.isFinite(b.price)
                ? b.price
                : Number.POSITIVE_INFINITY;

              return priceA - priceB || a.name.localeCompare(b.name);
            });

          return {
            requestedName: requestedProduct.name.trim(),
            requestedQuantity: requestedProduct.quantity ?? null,
            requestedUnit: requestedProduct.unit ?? null,
            requestedKeywords: normalizeKeywords(
              requestedProduct.keywords,
              requestedProduct.name
            ),
            available: options.length > 0,
            optionCount: options.length,

            // New field for the frontend product-selection UI.
            options,

            // Keep this field so existing frontend code does not immediately break.
            products: matchedProducts,
          };
        })
      );

      const availableCount = productMatches.filter(
        (match) => match.available
      ).length;

      const totalRequested = extractedProducts.length;
      const centroid = calculateCentroid(cluster.stores);

      const distanceKm = haversineDistance(
        customerLat,
        customerLng,
        centroid.lat,
        centroid.lng
      );

      const ratedStores = cluster.stores.filter(
        (store) =>
          Number.isFinite(Number(store.rating)) &&
          Number(store.rating) > 0
      );

      const avgRating = ratedStores.length
        ? ratedStores.reduce(
            (sum, store) => sum + Number(store.rating),
            0
          ) / ratedStores.length
        : 0;

      const availabilityScore = totalRequested
        ? (availableCount / totalRequested) * 100
        : 0;

      const distanceScore = Math.max(
        0,
        100 * (1 - distanceKm / radiusKm)
      );

      const efficiencyScore = calculateEfficiencyScore(
        cluster.stores.length,
        distanceKm
      );

      // Stores without ratings receive a neutral score.
      const ratingScore = ratedStores.length
        ? (avgRating / 5) * 100
        : 50;

      const totalScore =
        availabilityScore * SCORE_WEIGHTS.availability +
        distanceScore * SCORE_WEIGHTS.distance +
        efficiencyScore * SCORE_WEIGHTS.efficiency +
        ratingScore * SCORE_WEIGHTS.rating;

      return {
        clusterId: cluster.id,
        stores: cluster.stores,
        centroid,
        distanceKm: round(distanceKm, 2),
        productMatches,
        availableCount,
        totalRequested,
        missingCount: totalRequested - availableCount,
        availabilityScore: round(availabilityScore),
        distanceScore: round(distanceScore),
        efficiencyScore: round(efficiencyScore),
        ratingScore: round(ratingScore),
        totalScore: round(totalScore),
        avgRating: round(avgRating, 1),
      };
    })
  );

  // Deterministic ranking with tie-breakers.
  clustersWithProducts.sort(
    (a, b) =>
      b.totalScore - a.totalScore ||
      b.availableCount - a.availableCount ||
      a.distanceKm - b.distanceKm ||
      a.stores.length - b.stores.length ||
      a.clusterId.localeCompare(b.clusterId)
  );

  const bestCluster = clustersWithProducts[0];

  const missingProducts = bestCluster.productMatches.filter(
    (match) => !match.available
  );

  if (missingProducts.length) {
    bestCluster.borderStores = await findBorderStores(
      bestCluster.stores,
      missingProducts,
      BORDER_RADIUS_M
    );
  } else {
    bestCluster.borderStores = [];
  }

  bestCluster.borderStoreApplied =
    bestCluster.borderStores.length > 0;

  const fulfilledByBorder = new Set(
    bestCluster.borderStores.flatMap(
      (borderStore) => borderStore.fills
    )
  );

  const stillMissing = missingProducts.filter(
    (match) =>
      !fulfilledByBorder.has(normalizeName(match.requestedName))
  );

  bestCluster.substitutes = stillMissing.length
    ? await findSubstitutes(bestCluster.stores, stillMissing)
    : {};

  return {
    success: true,
    bestCluster,
    allClusters: clustersWithProducts,
    nearbyStores: nearbyStores.length,
    borderStores: bestCluster.borderStores,
  };
};

function validateSearchInput(lat, lng, products, radiusKm) {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new TypeError(
      'customerLat must be a valid latitude between -90 and 90.'
    );
  }

  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new TypeError(
      'customerLng must be a valid longitude between -180 and 180.'
    );
  }

  if (!Array.isArray(products) || products.length === 0) {
    throw new TypeError(
      'extractedProducts must be a non-empty array.'
    );
  }

  if (
    products.some(
      (product) =>
        !product ||
        typeof product.name !== 'string' ||
        !product.name.trim()
    )
  ) {
    throw new TypeError(
      'Every requested product must have a non-empty name.'
    );
  }

  if (
    !Number.isFinite(radiusKm) ||
    radiusKm <= 0 ||
    radiusKm > 100
  ) {
    throw new TypeError(
      'radiusKm must be greater than 0 and no more than 100.'
    );
  }
}

/**
 * Groups stores so every pair within a cluster is no more than 500 m apart.
 * This prevents long chains of nearby stores from stretching a cluster.
 */
function buildClusters(stores, clusterDiameterM) {
  const sortedStores = [...stores].sort((a, b) => {
    const [lngA, latA] = a.location.coordinates;
    const [lngB, latB] = b.location.coordinates;

    return (
      latA - latB ||
      lngA - lngB ||
      String(a._id).localeCompare(String(b._id))
    );
  });

  const clusters = [];

  for (const store of sortedStores) {
    const compatibleCluster = clusters.find((cluster) =>
      cluster.stores.every(
        (member) =>
          distanceBetweenStoresM(store, member) <= clusterDiameterM
      )
    );

    if (compatibleCluster) {
      compatibleCluster.stores.push(store);
    } else {
      clusters.push({
        id: `cluster_${clusters.length}`,
        stores: [store],
      });
    }
  }

  return clusters;
}

function distanceBetweenStoresM(a, b) {
  const [lngA, latA] = a.location.coordinates;
  const [lngB, latB] = b.location.coordinates;

  return haversineDistance(latA, lngA, latB, lngB) * 1000;
}

function calculateCentroid(stores) {
  const sum = stores.reduce(
    (acc, store) => ({
      lat: acc.lat + store.location.coordinates[1],
      lng: acc.lng + store.location.coordinates[0],
    }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: sum.lat / stores.length,
    lng: sum.lng / stores.length,
  };
}

function calculateEfficiencyScore(storeCount, distanceKm) {
  const storeCountScore = Math.max(
    0,
    100 - Math.max(0, storeCount - 1) * 10
  );

  const distanceScore = Math.max(0, 100 - distanceKm * 15);

  return (storeCountScore + distanceScore) / 2;
}

async function findMatchingProducts(requestedProduct, storeIds) {
  const conditions = buildProductConditions(requestedProduct);

  if (!conditions.length) return [];

  return Product.find({
    storeId: { $in: storeIds },
    isAvailable: true,
    stock: { $gt: 0 },
    $or: conditions,
  }).populate('storeId', 'storeName location');
}

/**
 * Adds a stable productId and normalized choice fields.
 * Original product fields are retained for compatibility.
 */
function toProductOption(product) {
  const raw =
    typeof product.toObject === 'function'
      ? product.toObject()
      : { ...product };

  const store =
    raw.storeId && typeof raw.storeId === 'object'
      ? {
          _id: raw.storeId._id,
          storeName: raw.storeId.storeName,
          location: raw.storeId.location,
        }
      : raw.storeId;

  const rawPrice =
    raw.price ?? raw.sellingPrice ?? raw.salePrice ?? null;

  const parsedPrice =
    rawPrice === null || rawPrice === ''
      ? null
      : Number(rawPrice);

  return {
    ...raw,
    _id: raw._id,
    productId: String(raw._id),
    name: raw.name || 'Unnamed product',
    brand:
      raw.brand || raw.company || raw.manufacturer || null,
    price: Number.isFinite(parsedPrice) ? parsedPrice : null,
    stock: Number.isFinite(Number(raw.stock))
      ? Number(raw.stock)
      : 0,
    storeId: store,
    storeName:
      store && typeof store === 'object'
        ? store.storeName || null
        : null,
  };
}

function buildProductConditions(requestedProduct) {
  const name = String(requestedProduct.name || '').trim();

  const keywords = normalizeKeywords(
    requestedProduct.keywords,
    name
  );

  const conditions = [];

  if (name) {
    conditions.push({
      name: { $regex: escapeRegex(name), $options: 'i' },
    });
  }

  for (const keyword of keywords) {
    conditions.push({
      tags: { $regex: escapeRegex(keyword), $options: 'i' },
    });

    conditions.push({
      nameKeywords: {
        $regex: escapeRegex(keyword),
        $options: 'i',
      },
    });
  }

  return conditions;
}

/**
 * Finds eligible stores within 100 m of a cluster and identifies
 * which missing requested products each border store can supply.
 */
async function findBorderStores(
  clusterStores,
  missingProducts,
  thresholdM
) {
  const clusterStoreIds = clusterStores.map((store) => store._id);
  const candidatesById = new Map();

  for (const clusterStore of clusterStores) {
    const [storeLng, storeLat] = clusterStore.location.coordinates;

    const candidates = await Store.find({
      verificationStatus: 'approved',
      isActive: true,
      isOpen: { $ne: false },
      _id: { $nin: clusterStoreIds },
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [storeLng, storeLat],
          },
          $maxDistance: thresholdM,
        },
      },
    }).select('storeName location address rating totalOrders');

    for (const candidate of candidates) {
      const id = String(candidate._id);
      const distanceM = distanceBetweenStoresM(
        clusterStore,
        candidate
      );

      const previous = candidatesById.get(id);

      if (
        !previous ||
        distanceM < previous.distanceFromClusterM
      ) {
        candidatesById.set(id, {
          store: candidate,
          distanceFromClusterM: distanceM,
        });
      }
    }
  }

  const results = [];

  for (const {
    store,
    distanceFromClusterM,
  } of candidatesById.values()) {
    const fills = [];
    const products = [];

    for (const missing of missingProducts) {
      const matched = await findMatchingProducts(
        {
          name: missing.requestedName,
          keywords: missing.requestedKeywords,
        },
        [store._id]
      );

      if (matched.length) {
        fills.push(normalizeName(missing.requestedName));
        products.push(...matched.map(toProductOption));
      }
    }

    if (fills.length) {
      results.push({
        store,
        products,
        fills: [...new Set(fills)],
        distanceFromClusterM: Math.round(distanceFromClusterM),
      });
    }
  }

  return results.sort(
    (a, b) =>
      b.fills.length - a.fills.length ||
      a.distanceFromClusterM - b.distanceFromClusterM
  );
}

/**
 * Keyword-based alternatives. This is a heuristic, not semantic AI matching.
 */
async function findSubstitutes(clusterStores, stillMissingProducts) {
  const storeIds = clusterStores.map((store) => store._id);
  const results = {};

  for (const missing of stillMissingProducts) {
    const requestedName = String(
      missing.requestedName || ''
    ).trim();

    const words = [
      ...new Set(
        [
          requestedName,
          ...(missing.requestedKeywords || []),
        ]
          .join(' ')
          .toLowerCase()
          .split(/[^a-z0-9]+/i)
          .filter(
            (word) =>
              word.length > 2 && !STOPWORDS.has(word)
          )
      ),
    ];

    if (!words.length) continue;

    const conditions = words.flatMap((word) => [
      {
        name: { $regex: escapeRegex(word), $options: 'i' },
      },
      {
        tags: { $regex: escapeRegex(word), $options: 'i' },
      },
      {
        nameKeywords: {
          $regex: escapeRegex(word),
          $options: 'i',
        },
      },
    ]);

    const candidates = await Product.find({
      storeId: { $in: storeIds },
      isAvailable: true,
      stock: { $gt: 0 },
      $or: conditions,
      name: {
        $not: {
          $regex: escapeRegex(requestedName),
          $options: 'i',
        },
      },
    })
      .populate('storeId', 'storeName location')
      .limit(10);

    const seen = new Set();

    const ranked = candidates
      .map((product) => {
        const candidateWords = normalizeName(
          `${product.name || ''} ${(product.tags || []).join(' ')} ${(product.nameKeywords || []).join(' ')}`
        ).split(/\s+/);

        const overlap = words.filter(
          (word) => candidateWords.includes(word)
        ).length;

        return { product, overlap };
      })
      .filter(({ product, overlap }) => {
        const id = String(product._id);

        if (!overlap || seen.has(id)) return false;

        seen.add(id);
        return true;
      })
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, 3)
      .map(({ product }) => toProductOption(product));

    if (ranked.length) {
      results[requestedName] = ranked;
    }
  }

  return results;
}

function normalizeKeywords(keywords, fallbackName) {
  const source = Array.isArray(keywords) ? keywords : [];

  const normalized = source
    .filter(
      (keyword) =>
        typeof keyword === 'string' && keyword.trim()
    )
    .map((keyword) => keyword.trim());

  if (
    fallbackName &&
    !normalized.some(
      (keyword) =>
        normalizeName(keyword) === normalizeName(fallbackName)
    )
  ) {
    normalized.push(String(fallbackName).trim());
  }

  return [...new Set(normalized)];
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

module.exports = { findBestCluster };