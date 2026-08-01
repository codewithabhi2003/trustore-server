const express = require('express');
const { createReview, getStoreReviews, getProductReviews } = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, createReview);
router.get('/store/:storeId', getStoreReviews);
router.get('/product/:productId', getProductReviews);

module.exports = router;
