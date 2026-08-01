// Creates in-app Notification records (shown via the navbar bell). No email/SMS
// provider is wired up yet (none was specified in the stack) — add nodemailer/Twilio/etc.
// alongside these calls whenever you're ready for that.
const Notification = require('../models/Notification');
const User = require('../models/User');

const create = async (userId, title, message, link = null) => {
  try {
    await Notification.create({ userId, title, message, link });
  } catch (err) {
    console.error('[notificationService] Failed to create notification:', err.message);
  }
};

const notifyOrderStatusChange = async (order, newStatus) => {
  await create(
    order.customerId,
    'Order update',
    `Your order is now "${newStatus}".`,
    `/orders`
  );
};

const notifyNewOrder = async (store, order) => {
  await create(
    store.ownerId,
    'New order',
    `You have a new order for ${store.storeName}.`,
    '/store-owner/orders'
  );
};

const notifyStoreVerification = async (store, decision) => {
  await create(
    store.ownerId,
    decision === 'approved' ? 'Store approved' : 'Store rejected',
    decision === 'approved'
      ? `${store.storeName} is now verified and visible to customers.`
      : `${store.storeName} was rejected.${store.adminNote ? ' Reason: ' + store.adminNote : ''}`,
    '/store-owner/dashboard'
  );
};

const notifyAdminsNewStorePending = async (store) => {
  const admins = await User.find({ role: 'admin' }).select('_id');
  await Promise.all(
    admins.map((admin) =>
      create(admin._id, 'Store awaiting review', `${store.storeName} submitted documents for verification.`, '/admin/stores/pending')
    )
  );
};

module.exports = { notifyOrderStatusChange, notifyNewOrder, notifyStoreVerification, notifyAdminsNewStorePending };