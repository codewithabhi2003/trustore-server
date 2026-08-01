const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  name: { type: String, required: true, trim: true },
  nameKeywords: [String], // for AI matching: ['rice', 'basmati rice', 'chawal']
  description: { type: String },
  brand: { type: String },
  unit: { type: String }, // '1kg', '500ml', '1 piece'
  price: { type: Number, required: true },
  mrp: { type: Number },
  stock: { type: Number, default: 0 },
  images: [String],
  isAvailable: { type: Boolean, default: true },
  tags: [String],
  createdAt: { type: Date, default: Date.now },
});

productSchema.index({ storeId: 1 });
productSchema.index({ name: 'text', tags: 'text', nameKeywords: 'text' });

module.exports = mongoose.model('Product', productSchema);
