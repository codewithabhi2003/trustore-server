const asyncHandler = require('express-async-handler');
const Address = require('../models/Address');
const { geocodeAddress } = require('../services/geocodingService');

// GET /api/addresses/geocode?q=<free text address>
// Lets the client offer "type your address" as an alternative to click-on-map, per the
// original spec's note on using Nominatim to geocode typed address text.
const geocode = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 3) {
    return res.status(400).json({ success: false, message: 'Enter at least 3 characters to search' });
  }

  try {
    const results = await geocodeAddress(q.trim());
    res.json({ success: true, results });
  } catch (err) {
    console.error('Geocoding error:', err.message);
    res
      .status(502)
      .json({ success: false, message: 'Could not look up that address right now — try pinning it on the map instead.' });
  }
});

// GET /api/addresses
const getAddresses = asyncHandler(async (req, res) => {
  const addresses = await Address.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, addresses });
});

// POST /api/addresses
const addAddress = asyncHandler(async (req, res) => {
  const { label, street, city, state, pincode, fullAddress, location, isDefault } = req.body;

  if (!street || !city) {
    return res.status(400).json({ success: false, message: 'Street and city are required' });
  }

  if (isDefault) {
    await Address.updateMany({ userId: req.user._id }, { $set: { isDefault: false } });
  }

  const address = await Address.create({
    userId: req.user._id,
    label,
    street,
    city,
    state,
    pincode,
    fullAddress,
    location,
    isDefault: !!isDefault,
  });

  res.status(201).json({ success: true, address });
});

// PUT /api/addresses/:id
const updateAddress = asyncHandler(async (req, res) => {
  const address = await Address.findOne({ _id: req.params.id, userId: req.user._id });
  if (!address) {
    return res.status(404).json({ success: false, message: 'Address not found' });
  }

  Object.assign(address, req.body);
  await address.save();

  res.json({ success: true, address });
});

// DELETE /api/addresses/:id
const deleteAddress = asyncHandler(async (req, res) => {
  const address = await Address.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!address) {
    return res.status(404).json({ success: false, message: 'Address not found' });
  }
  res.json({ success: true, message: 'Address removed' });
});

// PUT /api/addresses/:id/set-default
const setDefaultAddress = asyncHandler(async (req, res) => {
  const address = await Address.findOne({ _id: req.params.id, userId: req.user._id });
  if (!address) {
    return res.status(404).json({ success: false, message: 'Address not found' });
  }

  await Address.updateMany({ userId: req.user._id }, { $set: { isDefault: false } });
  address.isDefault = true;
  await address.save();

  res.json({ success: true, address });
});

module.exports = { getAddresses, addAddress, updateAddress, deleteAddress, setDefaultAddress, geocode };
