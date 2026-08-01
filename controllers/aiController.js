const asyncHandler = require('express-async-handler');
const { extractProductsFromText } = require('../services/groqService');

// POST /api/ai/extract-products
const extractProducts = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text || text.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Please enter your grocery list' });
  }

  try {
    const products = await extractProductsFromText(text);
    res.json({ success: true, products });
  } catch (err) {
    console.error('Groq extraction error:', err.message);
    res.status(500).json({ success: false, message: 'AI extraction failed. Please try again.' });
  }
});

module.exports = { extractProducts };
