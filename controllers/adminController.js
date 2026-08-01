const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Store = require('../models/Store');
const Order = require('../models/Order');
const { notifyStoreVerification } = require('../services/notificationService');

// GET /api/admin/dashboard-stats
const getDashboardStats = asyncHandler(async (req, res) => {
  const [totalUsers, totalStores, totalOrders, revenueAgg] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    Store.countDocuments({ verificationStatus: 'approved' }),
    Order.countDocuments(),
    Order.aggregate([
      { $match: { 'payment.status': 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
  ]);

  res.json({
    success: true,
    stats: {
      totalUsers,
      totalStores,
      totalOrders,
      totalRevenue: revenueAgg[0]?.total || 0,
    },
  });
});

// GET /api/admin/pending-stores
const getPendingStores = asyncHandler(async (req, res) => {
  const stores = await Store.find({ verificationStatus: 'pending' }).sort({ createdAt: 1 });
  res.json({ success: true, stores });
});

// GET /api/admin/stores?status=&search=
const getAllStores = asyncHandler(async (req, res) => {
  const { status, search } = req.query;
  const filter = {};
  if (status) filter.verificationStatus = status;
  if (search) filter.storeName = { $regex: search, $options: 'i' };

  const stores = await Store.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, stores });
});

// GET /api/admin/store/:id/documents — ADMIN ONLY, never exposed elsewhere
const getStoreDocuments = asyncHandler(async (req, res) => {
  const store = await Store.findById(req.params.id).select('documents storeName');
  if (!store) {
    return res.status(404).json({ success: false, message: 'Store not found' });
  }
  res.json({ success: true, documents: store.documents });
});

// PATCH /api/admin/store/:id/approve
const approveStore = asyncHandler(async (req, res) => {
  const store = await Store.findById(req.params.id);
  if (!store) {
    return res.status(404).json({ success: false, message: 'Store not found' });
  }

  store.verificationStatus = 'approved';
  store.adminNote = '';
  await store.save();
  await notifyStoreVerification(store, 'approved');

  res.json({ success: true, store });
});

// PATCH /api/admin/store/:id/reject
const rejectStore = asyncHandler(async (req, res) => {
  const { adminNote } = req.body;
  const store = await Store.findById(req.params.id);
  if (!store) {
    return res.status(404).json({ success: false, message: 'Store not found' });
  }

  store.verificationStatus = 'rejected';
  store.adminNote = adminNote || 'Documents could not be verified.';
  await store.save();
  await notifyStoreVerification(store, 'rejected');

  res.json({ success: true, store });
});

// GET /api/admin/customers
const getCustomers = asyncHandler(async (req, res) => {
  const customers = await User.find({ role: 'customer' }).sort({ createdAt: -1 });
  res.json({ success: true, customers });
});

// PATCH /api/admin/customer/:id/block
const toggleCustomerBlock = asyncHandler(async (req, res) => {
  const customer = await User.findOne({ _id: req.params.id, role: 'customer' });
  if (!customer) {
    return res.status(404).json({ success: false, message: 'Customer not found' });
  }
  customer.isActive = !customer.isActive;
  await customer.save();
  res.json({ success: true, customer });
});

// GET /api/admin/orders
const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find()
    .populate('storeId', 'storeName')
    .populate('customerId', 'name email')
    .sort({ createdAt: -1 })
    .limit(500);
  res.json({ success: true, orders });
});

// GET /api/admin/analytics
const getAnalytics = asyncHandler(async (req, res) => {
  const topStores = await Order.aggregate([
    { $match: { 'payment.status': 'paid' } },
    { $group: { _id: '$storeId', revenue: { $sum: '$totalAmount' } } },
    { $sort: { revenue: -1 } },
    { $limit: 10 },
    {
      $lookup: { from: 'stores', localField: '_id', foreignField: '_id', as: 'store' },
    },
    { $unwind: '$store' },
    { $project: { storeName: '$store.storeName', revenue: 1 } },
  ]);

  res.json({ success: true, topStores });
});

module.exports = {
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
};
