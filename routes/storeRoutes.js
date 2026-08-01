const express = require('express');
const {
  registerStore,
  getNearbyStores,
  getMyStore,
  updateMyStore,
  getStoreById,
  getStoreProducts,
  geocode,
} = require('../controllers/storeController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

// Specific routes first so Express doesn't treat them as /:id
router.get('/nearby', getNearbyStores);
router.get('/geocode', protect, authorize('storeOwner'), geocode);

router.post(
  '/register',
  protect,
  authorize('storeOwner'),
  upload.fields([
    { name: 'aadhaarCard', maxCount: 1 },
    { name: 'shopLicense', maxCount: 1 },
    { name: 'logo', maxCount: 1 },
  ]),
  registerStore
);

router.get('/my-store', protect, authorize('storeOwner'), getMyStore);
router.put('/my-store', protect, authorize('storeOwner'), updateMyStore);

router.get('/:id', getStoreById);
router.get('/:id/products', getStoreProducts);

module.exports = router;