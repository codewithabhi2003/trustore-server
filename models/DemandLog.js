const mongoose = require('mongoose');

// One row per requested item per AI search — lets us answer "what are nearby customers
// asking for that isn't in stock anywhere?" without touching the Product/Order models.
const demandLogSchema = new mongoose.Schema({
  itemName: { type: String, required: true, lowercase: true, trim: true },
  keywords: [String],
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat] of the searching customer
  },
  wasFulfilled: { type: Boolean, default: false }, // did any cluster actually have it?
  createdAt: { type: Date, default: Date.now },
});

demandLogSchema.index({ location: '2dsphere' });
demandLogSchema.index({ itemName: 1, createdAt: -1 });

module.exports = mongoose.model('DemandLog', demandLogSchema);