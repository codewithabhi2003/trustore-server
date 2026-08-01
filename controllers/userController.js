const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { uploadBuffer } = require('../services/cloudinaryService');

// GET /api/users/profile
const getProfile = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});

// PUT /api/users/profile
const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  const user = await User.findById(req.user._id);

  if (name) user.name = name;
  if (phone) user.phone = phone;
  await user.save();

  res.json({ success: true, user });
});

// POST /api/users/avatar
const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image uploaded' });
  }
  const { url } = await uploadBuffer(req.file.buffer, 'trustore/avatars');

  const user = await User.findById(req.user._id);
  user.avatar = url;
  await user.save();

  res.json({ success: true, user });
});

// PUT /api/users/password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Current and new password are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'New password should be at least 6 characters' });
  }

  const user = await User.findById(req.user._id).select('+password');
  const matches = await user.matchPassword(currentPassword);
  if (!matches) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  }

  user.password = newPassword; // re-hashed by the pre('save') hook on User model
  await user.save();

  res.json({ success: true, message: 'Password updated' });
});

module.exports = { getProfile, updateProfile, uploadAvatar, changePassword };