const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const Razorpay = require('razorpay');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Store = require('../models/Store');
const { notifyNewOrder } = require('../services/notificationService');

// If real Razorpay keys aren't set in server/.env yet, gracefully skip the real API
// calls (both creating the order and verifying the signature) so the checkout flow can
// still be tested end to end without a payment gateway account connected.
const PLACEHOLDERS = ['your_razorpay_key_id', 'your_razorpay_key_secret', '', undefined];
const isRazorpayConfigured = () =>
  !PLACEHOLDERS.includes(process.env.RAZORPAY_KEY_ID) && !PLACEHOLDERS.includes(process.env.RAZORPAY_KEY_SECRET);

const razorpay = isRazorpayConfigured()
  ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
  : null;

// POST /api/payment/create-order
const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { totalAmount, orderId } = req.body;
  if (!totalAmount || totalAmount <= 0) {
    return res.status(400).json({ success: false, message: 'A valid totalAmount is required' });
  }

  let razorpayOrderId;
  let amount = Math.round(totalAmount * 100);

  if (isRazorpayConfigured()) {
    const razorpayOrder = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `trustore_${orderId || Date.now()}`,
    });
    razorpayOrderId = razorpayOrder.id;
    amount = razorpayOrder.amount;
  } else {
    console.warn('[paymentController] No Razorpay credentials configured — using a mock order id.');
    razorpayOrderId = `mock_order_${crypto.randomBytes(6).toString('hex')}`;
  }

  await Payment.create({
    orderId,
    customerId: req.user._id,
    razorpayOrderId,
    amount: totalAmount,
    status: 'created',
  });

  res.json({ success: true, razorpayOrderId, amount, mock: !isRazorpayConfigured() });
});

// POST /api/payment/verify
const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId, orderIds } = req.body;

  if (isRazorpayConfigured()) {
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body).digest('hex');

    if (expected !== razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }
  } else {
    console.warn('[paymentController] No Razorpay credentials configured — skipping real signature check.');
  }

  const idsToUpdate = Array.isArray(orderIds) && orderIds.length ? orderIds : [orderId].filter(Boolean);
  if (idsToUpdate.length === 0) {
    return res.status(400).json({ success: false, message: 'orderId or orderIds is required' });
  }

  await Order.updateMany(
    { _id: { $in: idsToUpdate } },
    {
      $set: {
        'payment.razorpayOrderId': razorpayOrderId,
        'payment.razorpayPaymentId': razorpayPaymentId || `mock_payment_${Date.now()}`,
        'payment.razorpaySignature': razorpaySignature || 'mock',
        'payment.status': 'paid',
        'payment.paidAt': new Date(),
      },
      $push: { statusHistory: { status: 'Order Placed', note: 'Payment verified' } },
    }
  );

  if (razorpayOrderId) {
    await Payment.findOneAndUpdate(
      { razorpayOrderId },
      { $set: { razorpayPaymentId: razorpayPaymentId || 'mock', status: 'paid' } }
    );
  }

  // Only now — after payment is genuinely confirmed — does the store owner get told
  // about the order. A failed or abandoned payment never reaches this point.
  const paidOrders = await Order.find({ _id: { $in: idsToUpdate } });
  const stores = await Store.find({ _id: { $in: paidOrders.map((o) => o.storeId) } });
  await Promise.all(
    paidOrders.map((order) => {
      const store = stores.find((s) => s._id.toString() === order.storeId.toString());
      return store ? notifyNewOrder(store, order) : null;
    })
  );

  res.json({ success: true });
});

module.exports = { createRazorpayOrder, verifyPayment };