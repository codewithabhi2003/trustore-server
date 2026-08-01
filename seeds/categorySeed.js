// Run once after setup: npm run seed:categories
require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');

const CATEGORIES = [
  { name: 'Grocery', icon: '🛒' },
  { name: 'Dairy', icon: '🥛' },
  { name: 'Fruits & Veg', icon: '🥦' },
  { name: 'Bakery', icon: '🍞' },
  { name: 'Beverages', icon: '🥤' },
  { name: 'Household', icon: '🧺' },
  { name: 'Snacks', icon: '🍪' },
  { name: 'Personal Care', icon: '🧴' },
];

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  for (const cat of CATEGORIES) {
    await Category.findOneAndUpdate({ name: cat.name }, cat, { upsert: true, new: true });
  }

  console.log(`Seeded ${CATEGORIES.length} categories.`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
