const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  storeName: { type: String, required: true, trim: true },
  ownerName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  category: { type: String, required: true },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    fullAddress: String,
  },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [longitude, latitude]
  },
  documents: {
    aadhaarCard: { url: String, publicId: String },
    shopLicense: { url: String, publicId: String },
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  adminNote: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  rating: { type: Number, default: 0 },
  ratingSum: { type: Number, default: 0 }, // running total — lets rating recompute atomically, race-safe under concurrent reviews
  totalRatings: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  logo: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

// CRITICAL: required for $near geospatial queries
storeSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Store', storeSchema);