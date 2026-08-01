const express = require('express');
const {
  getDashboardStats,
  getPendingStores,
  getAllStores,
  getStoreDocuments,
  approveStore,
  rejectStore,
  getCustomers,
  toggleCustomerBlock,
  getAllOrders,
  getAnalytics,
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/dashboard-stats', getDashboardStats);
router.get('/pending-stores', getPendingStores);
router.get('/stores', getAllStores);
router.get('/store/:id/documents', getStoreDocuments);
router.patch('/store/:id/approve', approveStore);
router.patch('/store/:id/reject', rejectStore);
router.get('/customers', getCustomers);
router.patch('/customer/:id/block', toggleCustomerBlock);
router.get('/orders', getAllOrders);
router.get('/analytics', getAnalytics);

module.exports = router;
