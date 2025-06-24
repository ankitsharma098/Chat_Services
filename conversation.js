// const mongoose = require('mongoose');

// const messageSchema = new mongoose.Schema({
//   senderId: { type: String, required: true },
//   message: { type: String, required: true },
//   type: { type: String, default: 'text' },
//   timestamp: { type: Date, default: Date.now },
// });

// const conversationSchema = new mongoose.Schema({
//   roomId: { type: String, required: true, unique: true },
//   orderId: { type: String, required: true },
//   userId: { type: String, required: true },
//   peerId: { type: String, required: true },
//   flowType: { type: String, enum: ['buy', 'sell'], required: true },
//   messages: [messageSchema],
//   currentStep: {
//     type: String,
//     enum: [
//       'initial',
//       'availabilityAsked',
//       'availabilityResponded',
//       'availabilityDenied',
//       'bankDetailsAsked',
//       'bankDetailsSent',
//       'receiptSent',
//       'completed',
//       'paymentDenied',
//       'paymentConflict',
//       'paymentTimerExpired',
//     ],
//     default: 'initial',
//   },
//   isCompleted: { type: Boolean, default: false },
//   createdAt: { type: Date, default: Date.now },
//   updatedAt: { type: Date, default: Date.now },
// });

// conversationSchema.pre('save', function (next) {
//   this.updatedAt = Date.now();
//   next();
// });

// module.exports = mongoose.model('Conversation', conversationSchema);

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: String,
  message: String,
 type: { type: String, default: 'text' },
  timestamp: Date,
   mediaUrl: { type: String, default: null },
});

const conversationSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  userId: String,
  peerId: String,
  orderId: String,
  flowType: String,
  messages: [messageSchema],
  currentStep: { type: String, default: 'initial' },
  isCompleted: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Conversation', conversationSchema);