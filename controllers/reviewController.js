const asyncHandler = require('express-async-handler');
const Review = require('../models/Review');
const Order = require('../models/Order');
const Store = require('../models/Store');

// POST /api/reviews — only after a Completed order, once per order
const createReview = asyncHandler(async (req, res) => {
  const { orderId, storeId, rating, comment } = req.body;

  if (!orderId || !storeId || !rating) {
    return res.status(400).json({ success: false, message: 'orderId, storeId, and rating are required' });
  }

  const order = await Order.findOne({ _id: orderId, customerId: req.user._id });
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  if (order.status !== 'Completed') {
    return res.status(400).json({ success: false, message: 'You can only review completed orders' });
  }
  if (order.isReviewed) {
    return res.status(409).json({ success: false, message: 'You already reviewed this order' });
  }

  const review = await Review.create({
    orderId,
    storeId,
    customerId: req.user._id,
    rating,
    comment,
  });

  order.isReviewed = true;
  await order.save();

  // Atomic — $inc can never lose a concurrent review's contribution the way a
  // read-then-write (store.rating = ...; store.save()) can under a race. ratingSum and
  // totalRatings are always exactly correct; the displayed `rating` average is
  // recomputed right after from those authoritative totals.
  const updatedStore = await Store.findByIdAndUpdate(
    storeId,
    { $inc: { ratingSum: rating, totalRatings: 1 } },
    { new: true }
  );

  if (updatedStore) {
    const avg = Math.round((updatedStore.ratingSum / updatedStore.totalRatings) * 10) / 10;
    await Store.findByIdAndUpdate(storeId, { $set: { rating: avg } });
  } else {
    console.warn(`[reviewController.createReview] Store ${storeId} not found — rating not updated for review ${review._id}`);
  }

  res.status(201).json({ success: true, review });
});

// GET /api/reviews/store/:storeId
const getStoreReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ storeId: req.params.storeId })
    .populate('customerId', 'name')
    .sort({ createdAt: -1 });
  res.json({ success: true, reviews });
});

// GET /api/reviews/product/:productId
// Reviews are stored per-order rather than per-product, so we surface reviews from
// any completed order that included this product.
const getProductReviews = asyncHandler(async (req, res) => {
  const orders = await Order.find({ 'items.productId': req.params.productId }).select('_id');
  const orderIds = orders.map((o) => o._id);

  const reviews = await Review.find({ orderId: { $in: orderIds } })
    .populate('customerId', 'name')
    .sort({ createdAt: -1 });

  res.json({ success: true, reviews });
});

module.exports = { createReview, getStoreReviews, getProductReviews };