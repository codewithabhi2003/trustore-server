const express = require('express');
const {
  createOrder,
  getMyOrders,
  getStoreOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
} = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect);

router.post('/', createOrder);
router.get('/my-orders', authorize('customer'), getMyOrders);
router.get('/store-orders', authorize('storeOwner'), getStoreOrders);
router.get('/:id', getOrderById);
router.patch('/:id/status', authorize('storeOwner'), updateOrderStatus);
router.patch('/:id/cancel', authorize('customer'), cancelOrder);

module.exports = router;
