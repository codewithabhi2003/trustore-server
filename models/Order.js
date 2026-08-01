const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      productName: String,
      productImage: String,
      quantity: Number,
      price: Number,
      unit: String,
    },
  ],
  deliveryAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    fullAddress: String,
    location: {
      type: { type: String, default: 'Point' },
      coordinates: [Number],
    },
  },
  subtotal: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  payment: {
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    paidAt: Date,
    method: String,
  },
  status: {
    type: String,
    enum: ['Order Placed', 'Accepted', 'Preparing', 'Ready for Pickup', 'Completed', 'Cancelled'],
    default: 'Order Placed',
  },
  statusHistory: [
    {
      status: String,
      updatedAt: { type: Date, default: Date.now },
      note: String,
    },
  ],
  // Cluster context — stored for analytics
  clusterInfo: {
    clusterId: String,
    clusterScore: Number,
    borderStoreUsed: Boolean,
  },
  isReviewed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ storeId: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
