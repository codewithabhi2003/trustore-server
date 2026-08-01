const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');
const Store = require('../models/Store');
const { uploadBuffer } = require('../services/cloudinaryService');

// GET /api/products?category=&store=&search=&mine=true
const getProducts = asyncHandler(async (req, res) => {
  const { category, store, search, mine } = req.query;
  const filter = {};

  if (mine === 'true') {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    const myStore = await Store.findOne({ ownerId: req.user._id });
    if (!myStore) return res.json({ success: true, products: [] });
    filter.storeId = myStore._id;
  } else {
    filter.isAvailable = true;
    if (store) filter.storeId = store;
  }

  if (category) filter.categoryId = category;
  if (search) filter.$text = { $search: search };

  const products = await Product.find(filter).populate('storeId', 'storeName location rating').limit(200);
  res.json({ success: true, products });
});

// GET /api/products/search?q=keyword
const searchProducts = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ success: true, products: [] });

  const products = await Product.find({
    isAvailable: true,
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { tags: { $regex: q, $options: 'i' } },
      { nameKeywords: { $regex: q, $options: 'i' } },
    ],
  })
    .populate('storeId', 'storeName location rating')
    .limit(50);

  res.json({ success: true, products });
});

// GET /api/products/:id
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('storeId', 'storeName location rating');
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  res.json({ success: true, product });
});

const getOwnedStoreOr403 = async (userId) => {
  const store = await Store.findOne({ ownerId: userId });
  return store;
};

// multipart/form-data can't carry real arrays, so tags arrives either as a JSON string
// (from the client's FormData) or already as an array (from a plain JSON request).
const parseTags = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(raw).split(',').map((t) => t.trim()).filter(Boolean);
  }
};

// POST /api/products (storeOwner, multipart/form-data — image is optional)
const createProduct = asyncHandler(async (req, res) => {
  const store = await getOwnedStoreOr403(req.user._id);
  if (!store) {
    return res.status(403).json({ success: false, message: 'You need a registered store to add products' });
  }
  if (store.verificationStatus !== 'approved') {
    return res.status(403).json({ success: false, message: 'Your store must be verified before you can list products' });
  }

  const { name, unit, price, mrp, stock, categoryId, description, brand } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ success: false, message: 'Product name and price are required' });
  }

  const tags = parseTags(req.body.tags);

  let images = [];
  if (req.file) {
    const { url } = await uploadBuffer(req.file.buffer, 'trustore/products');
    images = [url];
  }

  const product = await Product.create({
    storeId: store._id,
    categoryId,
    name,
    unit,
    price: Number(price),
    mrp: mrp !== undefined && mrp !== '' ? Number(mrp) : undefined,
    stock: stock !== undefined ? Number(stock) : 0,
    description,
    brand,
    images,
    tags,
    nameKeywords: [name.toLowerCase(), ...tags.map((t) => t.toLowerCase())],
  });

  res.status(201).json({ success: true, product });
});

// PUT /api/products/:id (storeOwner, multipart/form-data — image is optional)
const updateProduct = asyncHandler(async (req, res) => {
  const store = await getOwnedStoreOr403(req.user._id);
  const product = await Product.findOne({ _id: req.params.id, storeId: store?._id });
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const { name, unit, price, mrp, stock, categoryId, description, brand, isAvailable } = req.body;
  if (name !== undefined) product.name = name;
  if (unit !== undefined) product.unit = unit;
  if (price !== undefined) product.price = Number(price);
  if (mrp !== undefined) product.mrp = mrp === '' ? undefined : Number(mrp);
  if (stock !== undefined) product.stock = Number(stock);
  if (categoryId !== undefined) product.categoryId = categoryId;
  if (description !== undefined) product.description = description;
  if (brand !== undefined) product.brand = brand;
  if (isAvailable !== undefined) product.isAvailable = isAvailable;
  if (req.body.tags !== undefined) {
    const tags = parseTags(req.body.tags);
    product.tags = tags;
    product.nameKeywords = [product.name.toLowerCase(), ...tags.map((t) => t.toLowerCase())];
  }
  if (req.file) {
    const { url } = await uploadBuffer(req.file.buffer, 'trustore/products');
    product.images = [url];
  }

  await product.save();
  res.json({ success: true, product });
});

// DELETE /api/products/:id (storeOwner)
const deleteProduct = asyncHandler(async (req, res) => {
  const store = await getOwnedStoreOr403(req.user._id);
  const product = await Product.findOneAndDelete({ _id: req.params.id, storeId: store?._id });
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  res.json({ success: true, message: 'Product deleted' });
});

// PATCH /api/products/:id/stock (storeOwner)
const updateStock = asyncHandler(async (req, res) => {
  const store = await getOwnedStoreOr403(req.user._id);
  const product = await Product.findOne({ _id: req.params.id, storeId: store?._id });
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const { stock } = req.body;
  if (typeof stock !== 'number' || stock < 0) {
    return res.status(400).json({ success: false, message: 'Stock must be a non-negative number' });
  }

  product.stock = stock;
  product.isAvailable = stock > 0;
  await product.save();

  res.json({ success: true, product });
});

module.exports = {
  getProducts,
  searchProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
};