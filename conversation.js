

const mongoose = require('mongoose');
const { Schema } = mongoose;

const messageSchema = new mongoose.Schema({
  senderId: String,
  message: String,
 type: { type: String, default: 'text' },
  timestamp: Date,
   mediaUrl: { type: String, default: null },
   utrNumber: { type: String, default: null },
});


// Define the schema for the transaction details sub-document
const TransactionDetailsSchema = new Schema({
  transactionId: { type: String, default: 'N/A' },
  coinType: { type: String, default: 'UNKNOWN' },
  amount: { type: Number, default: 0.0 },
  status: { type: String, default: 'Unknown' }
}, { _id: false }); // _id: false prevents Mongoose from creating an id for this sub-document

// Define the main conversation schema
const conversationSchema = new Schema({
  roomId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true },
  peerId: { type: String, required: true },
  orderId: { type: String, required: true },
  flowType: { type: String, required: true, enum: ['sell', 'buy'] },
  currentStep: { type: String, default: 'initial' },
  isCompleted: { type: Boolean, default: false },
  messages: { type: Array, default: [] },
  // 💥 THIS IS THE CRITICAL ADDITION 💥
  transactionDetails: { type: TransactionDetailsSchema, default: null },
}, {
  timestamps: true // Automatically adds createdAt and updatedAt fields
});


module.exports = mongoose.model('Conversation', conversationSchema);