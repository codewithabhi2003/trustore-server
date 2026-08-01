const express = require('express');
const { extractProducts } = require('../controllers/aiController');

const router = express.Router();

router.post('/extract-products', extractProducts);

module.exports = router;
