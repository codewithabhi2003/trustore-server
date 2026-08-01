const asyncHandler = require('express-async-handler');
const Order = require('../models/Order');
const Store = require('../models/Store');
const { notifyOrderStatusChange, notifyNewOrder } = require('../services/notificationService');

// POST /api/orders
// Cart items carry a storeId, since a cluster order can span more than one store.
// We create one Order document per store so each store owner only ever sees their own
// items, then hand back the group so a single Razorpay charge can cover all of them.
const createOrder = asyncHandler(async (req, res) => {
  const { storeGroups, deliveryAddress, clusterInfo } = req.body;

  if (!storeGroups || typeof storeGroups !== 'object' || Object.keys(storeGroups).length === 0) {
    return res.status(400).json({ success: false, message: 'Your cart is empty' });
  }

  const createdOrders = [];

  for (const [storeId, group] of Object.entries(storeGroups)) {
    if (!group.items?.length) continue;

    const subtotal = group.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const order = await Order.create({
      customerId: req.user._id,
      storeId,
      items: group.items.map((i) => ({
        productId: i.productId,
        productName: i.name,
        productImage: i.image,
        quantity: i.quantity,
        price: i.price,
        unit: i.unit,
      })),
      deliveryAddress,
      subtotal,
      totalAmount: subtotal,
      clusterInfo,
      statusHistory: [{ status: 'Order Placed', note: 'Order created, awaiting payment' }],
    });

    createdOrders.push(order);
  }

  if (createdOrders.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid items to order' });
  }

  const totalAmount = createdOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  // Best-effort — a notification failure shouldn't block the order from completing.
  const stores = await Store.find({ _id: { $in: createdOrders.map((o) => o.storeId) } });
  await Promise.all(
    createdOrders.map((order) => {
      const store = stores.find((s) => s._id.toString() === order.storeId.toString());
      return store ? notifyNewOrder(store, order) : null;
    })
  );

  // Top-level _id kept for a simple single-store checkout flow; orderIds covers multi-store carts.
  res.status(201).json({
    success: true,
    _id: createdOrders[0]._id,
    orders: createdOrders,
    orderIds: createdOrders.map((o) => o._id),
    totalAmount,
  });
});

// GET /api/orders/my-orders
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ customerId: req.user._id })
    .populate('storeId', 'storeName')
    .sort({ createdAt: -1 });
  res.json({ success: true, orders });
});

// GET /api/orders/store-orders (storeOwner)
const getStoreOrders = asyncHandler(async (req, res) => {
  const store = await Store.findOne({ ownerId: req.user._id });
  if (!store) {
    return res.status(404).json({ success: false, message: 'No store found for this account' });
  }
  const orders = await Order.find({ storeId: store._id })
    .populate('customerId', 'name email phone')
    .sort({ createdAt: -1 });
  res.json({ success: true, orders });
});

// GET /api/orders/:id
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('storeId', 'storeName ownerId')
    .populate('customerId', 'name email');

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const isOwnerOfOrder = order.customerId._id.toString() === req.user._id.toString();
  const isStoreOwner = order.storeId?.ownerId?.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isOwnerOfOrder && !isStoreOwner && !isAdmin) {
    return res.status(403).json({ success: false, message: 'You do not have access to this order' });
  }

  res.json({ success: true, order });
});

const VALID_TRANSITIONS = {
  'Order Placed': ['Accepted', 'Cancelled'],
  Accepted: ['Preparing', 'Cancelled'],
  Preparing: ['Ready for Pickup'],
  'Ready for Pickup': ['Completed'],
};

// PATCH /api/orders/:id/status (storeOwner)
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const store = await Store.findOne({ ownerId: req.user._id });
  const order = await Order.findOne({ _id: req.params.id, storeId: store?._id });

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const allowedNext = VALID_TRANSITIONS[order.status] || [];
  if (!allowedNext.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot move order from "${order.status}" to "${status}"`,
    });
  }

  order.status = status;
  order.statusHistory.push({ status, note });
  await order.save();

  if (status === 'Completed') {
    await Store.findByIdAndUpdate(store._id, { $inc: { totalOrders: 1 } });
  }

  await notifyOrderStatusChange(order, status);

  res.json({ success: true, order });
});

// PATCH /api/orders/:id/cancel (customer)
const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, customerId: req.user._id });
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  if (order.status !== 'Order Placed') {
    return res.status(400).json({ success: false, message: 'This order can no longer be cancelled' });
  }

  order.status = 'Cancelled';
  order.statusHistory.push({ status: 'Cancelled', note: 'Cancelled by customer' });
  await order.save();

  res.json({ success: true, order });
});

module.exports = {
  createOrder,
  getMyOrders,
  getStoreOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
};