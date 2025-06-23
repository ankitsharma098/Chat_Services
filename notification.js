const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, required: true },
  roomId: { type: String, required: true },
  orderId: { type: String, required: true },
  flowType: { type: String, required: true },
  type: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  delivered: { type: Boolean, default: false },
  expiresAt: { type: Date },
});

notificationSchema.index({ to: 1, delivered: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', notificationSchema);