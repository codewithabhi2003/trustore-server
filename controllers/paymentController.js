const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const Razorpay = require('razorpay');
const Order = require('../models/Order');
const Payment = require('../models/Payment');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// POST /api/payment/create-order
const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { totalAmount, orderId } = req.body;
  if (!totalAmount || totalAmount <= 0) {
    return res.status(400).json({ success: false, message: 'A valid totalAmount is required' });
  }

  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(totalAmount * 100), // paise
    currency: 'INR',
    receipt: `trustore_${orderId || Date.now()}`,
  });

  await Payment.create({
    orderId,
    customerId: req.user._id,
    razorpayOrderId: razorpayOrder.id,
    amount: totalAmount,
    status: 'created',
  });

  res.json({ success: true, razorpayOrderId: razorpayOrder.id, amount: razorpayOrder.amount });
});

// POST /api/payment/verify
const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId, orderIds } = req.body;

  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expected !== razorpaySignature) {
    return res.status(400).json({ success: false, message: 'Payment verification failed' });
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
        'payment.razorpayPaymentId': razorpayPaymentId,
        'payment.razorpaySignature': razorpaySignature,
        'payment.status': 'paid',
        'payment.paidAt': new Date(),
      },
      $push: { statusHistory: { status: 'Order Placed', note: 'Payment verified' } },
    }
  );

  await Payment.findOneAndUpdate(
    { razorpayOrderId },
    { $set: { razorpayPaymentId, status: 'paid' } }
  );

  res.json({ success: true });
});

module.exports = { createRazorpayOrder, verifyPayment };
