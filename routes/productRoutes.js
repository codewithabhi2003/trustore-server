const express = require('express');
const {
  getProducts,
  searchProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
} = require('../controllers/productController');
const { protect, optionalProtect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

router.get('/search', searchProducts);
router.get('/', optionalProtect, getProducts);

router.post('/', protect, authorize('storeOwner'), createProduct);
router.put('/:id', protect, authorize('storeOwner'), updateProduct);
router.delete('/:id', protect, authorize('storeOwner'), deleteProduct);
router.patch('/:id/stock', protect, authorize('storeOwner'), updateStock);

router.get('/:id', getProductById);

module.exports = router;
