
const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const axios = require('axios');
const Conversation = require('./conversation'); 
const { sendChatMessageNotification } = require('./fcm_service.js');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

mongoose.connect("mongodb+srv://ankits45987:major@cluster0.ovdsg.mongodb.net/")
  .then(() => console.log('🚀 Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));


app.get('/api/conversations/by-room/:roomId', async (req, res) => {
  const { roomId } = req.params;
  try {
    const conversation = await Conversation.findOne({ roomId });
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    res.json({
      success: true,
      data: conversation,
    });
  } catch (err) {
    console.error(`❌ Error fetching single conversation for room ${roomId}:`, err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


const setupSocketHandlers = (io) => {
  const users = {}; // In-memory store for user socket IDs

  const broadcastHistory = (io, uniqueRoomId, conversation) => {
    if (!conversation) return;
    const payload = {
      messages: conversation.messages,
      currentStep: conversation.currentStep,
      isCompleted: conversation.isCompleted,
      userId: conversation.userId,
      peerId: conversation.peerId,
      orderId: conversation.orderId,
      flowType: conversation.flowType,
      transactionDetails: conversation.transactionDetails || null,
    };
    io.to(uniqueRoomId).emit('conversation_history', payload);
    console.log(`📡 Broadcasted history to ${uniqueRoomId}. Step: ${payload.currentStep}`);
  };

  // ✨ REVISED: The central function for all state updates AND notifications.
  const handleWorkflowUpdate = async (roomId, uniqueRoomId, updateQuery, notificationDetails) => {
      try {
        const conversation = await Conversation.findOneAndUpdate({ roomId }, updateQuery, { upsert: true, new: true });
        broadcastHistory(io, uniqueRoomId, conversation);

        // If notification details are provided, send a push notification
        if (notificationDetails && notificationDetails.recipientId) {
          const roomSockets = io.sockets.adapter.rooms.get(uniqueRoomId);
          const recipientSocketId = users[notificationDetails.recipientId];

          // Only send a notification if the recipient is NOT connected to this room.
          if (!roomSockets || !roomSockets.has(recipientSocketId)) {
            console.log(`[Notification] Recipient ${notificationDetails.recipientId} is offline or not in room. Sending push.`);
            await sendChatMessageNotification({
                recipientId: notificationDetails.recipientId,
                senderId: notificationDetails.senderId,
                orderId: conversation.orderId,
                flowType: conversation.flowType,
                roomId: conversation.roomId,
                messageText: notificationDetails.messageText,
            });
          } else {
            console.log(`[Notification] Recipient ${notificationDetails.recipientId} is online in room. Skipping push.`);
          }
        }
      } catch (err) {
        console.error(`❌ Error in handleWorkflowUpdate for room ${roomId}:`, err);
      }
    };


  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.id}`);

    socket.on('register', (userId) => {
      users[userId] = socket.id;
      console.log(`👤 User registered: ${userId} with socket ID ${socket.id}`);
    });

    socket.on('join_room', async ({ roomId, userId, flowType }) => {
      const uniqueRoomId = `${flowType}_${roomId}`;
      socket.join(uniqueRoomId);
      console.log(`📥 User ${userId} joined room: ${uniqueRoomId}`);
      try {
        let conversation = await Conversation.findOne({ roomId });
        if (conversation) {
          broadcastHistory(io, uniqueRoomId, conversation);
        }
      } catch (err) {
        console.error(`❌ Error fetching conversation for room ${uniqueRoomId}:`, err);
      }
    });

    // --- Workflow Event Handlers (Now with Notification Triggers) ---

    socket.on('askAvailability', ({ from, to, roomId, orderId, flowType }) => {
      const uniqueRoomId = `${flowType}_${roomId}`;
      const toSocketId = users[to];
      if (toSocketId) {
        io.to(toSocketId).emit('receiveAvailabilityRequest', { from });
      }
      const messageText = 'Are you available?';
      const update = {
        $setOnInsert: { roomId, userId: from, peerId: to, orderId: roomId.split('_')[0], flowType },
        $push: { messages: { senderId: from, message: messageText, type: 'text', timestamp: new Date() } },
        $set: { currentStep: 'availabilityAsked', updatedAt: Date.now() },
      };
      const notificationDetails = { recipientId: to, senderId: from, messageText: `Wants to chat about order ${orderId}` };
      handleWorkflowUpdate(roomId, uniqueRoomId, update, notificationDetails);
    });

    socket.on('availabilityResponse', ({ from, to, response, roomId, flowType }) => {
      const uniqueRoomId = `${flowType}_${roomId}`;
      const responseText = response === 'yes' ? 'Yes, I am available.' : 'No, I am not available.';
      const nextStep = response === 'yes' ? 'availabilityResponded' : 'availabilityDenied';

      const update = {
        $push: { messages: { senderId: from, message: responseText, type: 'text', timestamp: new Date() } },
        $set: { currentStep: nextStep, isCompleted: nextStep === 'availabilityDenied' },
      };
      const notificationDetails = { recipientId: to, senderId: from, messageText: responseText };
      handleWorkflowUpdate(roomId, uniqueRoomId, update, notificationDetails);
    });

    socket.on('askBankDetails', ({ from, to, roomId, flowType }) => {
      const uniqueRoomId = `${flowType}_${roomId}`;
       if (users[to]) io.to(users[to]).emit('receiveBankDetailsRequest', { from });

      const messageText = 'Please share your Bank Details.';
      const update = {
        $push: { messages: { senderId: from, message: messageText, type: 'text', timestamp: new Date() } },
        $set: { currentStep: 'bankDetailsAsked' },
      };
      const notificationDetails = { recipientId: to, senderId: from, messageText };
      handleWorkflowUpdate(roomId, uniqueRoomId, update, notificationDetails);
    });
    
    socket.on('sendBankDetails', ({ from, to, bankDetails, roomId, flowType }) => {
        const uniqueRoomId = `${flowType}_${roomId}`;
        const toSocketId = users[to];
        if (toSocketId) {
            io.to(toSocketId).emit('receiveBankDetails', { from, bankDetails });
            io.to(toSocketId).emit('startPaymentTimer', { duration: 300 });
            setTimeout(() => { io.to(toSocketId).emit('showSendReceiptButton', {}); }, 20000);
        }
        const messageText = `Bank Details Shared`;
        const update = {
            $push: { messages: { senderId: from, message: `Bank Details: ${bankDetails}`, type: 'text', timestamp: new Date() } },
            $set: { currentStep: 'bankDetailsSent' },
        };
        const notificationDetails = { recipientId: to, senderId: from, messageText };
        handleWorkflowUpdate(roomId, uniqueRoomId, update, notificationDetails);
    });

    socket.on('sendMediaReceipt', async ({ from, to, roomId, flowType, mediaUrl, utrNumber }) => {
      const uniqueRoomId = `${flowType}_${roomId}`;
      const conversation = await Conversation.findOne({ roomId });
      if (!conversation || conversation.isCompleted || conversation.currentStep === 'paymentTimerExpired') {
        socket.emit('action_rejected', { message: 'Action failed: The chat is closed or timed out.' });
        return;
      }
      const messageText = 'Payment Receipt Sent';
      const msg = { senderId: from, message: messageText, type: 'image', mediaUrl, utrNumber, timestamp: new Date() };
      const update = { $push: { messages: msg }, $set: { currentStep: 'receiptSent' } };
      const notificationDetails = { recipientId: to, senderId: from, messageText: `Shared a payment receipt with UTR: ${utrNumber}` };
      handleWorkflowUpdate(roomId, uniqueRoomId, update, notificationDetails);
    });

    socket.on('confirmPaymentStatus', async ({ from, to, status, roomId, flowType, sellerToken }) => {
        const uniqueRoomId = `${flowType}_${roomId}`;
        const orderIdForApi = roomId.split('_')[0];
        let update;
        let messageText = '';

        if (status === 'yes') {
            const finalDetails = await finalizeOrderAndGetDetails(orderIdForApi, to, from, sellerToken);
            messageText = 'Payment Confirmed. The transaction is complete.';
            update = {
                $push: { messages: { senderId: from, message: 'Payment Confirmed', type: 'text', timestamp: new Date() } },
                $set: { currentStep: 'completed', isCompleted: true, transactionDetails: finalDetails },
            };
        } else {
            messageText = 'Payment Denied. Please review the transaction.';
            update = {
                $push: { messages: { senderId: from, message: 'Payment Denied', type: 'text', timestamp: new Date() } },
                $set: { currentStep: 'paymentDenied', isCompleted: false },
            };
        }
        const notificationDetails = { recipientId: to, senderId: from, messageText };
        handleWorkflowUpdate(roomId, uniqueRoomId, update, notificationDetails);
    });

    socket.on('reportPaymentConflict', async ({ from, to, orderId, roomId, flowType }) => {
        const uniqueRoomId = `${flowType}_${roomId}`;
        const messageText = 'A payment conflict has been reported for admin review.';
        const msg = { senderId: from, message: messageText, type: 'text', timestamp: new Date() };
        const update = { $push: { messages: msg }, $set: { currentStep: 'paymentConflict', isCompleted: true } };
        
        // Notify the other party about the conflict
        const notificationDetails = { recipientId: to, senderId: from, messageText };
        handleWorkflowUpdate(roomId, uniqueRoomId, update, notificationDetails);
        console.log(`⚠️ Payment conflict reported by ${from} for order ${orderId}. State locked.`);
    });

    socket.on('paymentTimerExpired', async ({ roomId, flowType }) => {
        const uniqueRoomId = `${flowType}_${roomId}`;
        const conversation = await Conversation.findOne({ roomId });
        if (!conversation || conversation.isCompleted) return; // Don't act on already completed chats

        const messageText = 'Payment time has expired.';
        const msg = { senderId: 'system', message: messageText, type: 'text', timestamp: new Date() };
        const update = { $push: { messages: msg }, $set: { currentStep: 'paymentTimerExpired', isCompleted: true } };
        
        // Notify both parties that the timer expired
        const details1 = { recipientId: conversation.userId, senderId: 'system', messageText };
        const details2 = { recipientId: conversation.peerId, senderId: 'system', messageText };
        
        handleWorkflowUpdate(roomId, uniqueRoomId, update, details1);
        handleWorkflowUpdate(roomId, uniqueRoomId, update, details2); // You might want to remove one of these if handleWorkflowUpdate broadcasts to all

        console.log(`⏰ Payment timer expired for room ${uniqueRoomId}. State locked.`);
    });

    socket.on('disconnect', () => {
      const user = Object.keys(users).find((u) => users[u] === socket.id);
      if (user) {
        delete users[user];
        console.log(`❌ User disconnected: ${user}`);
      }
    });
  });
};

setupSocketHandlers(io);

async function finalizeOrderAndGetDetails(txnId, buyerAddress, sellerUpbAddress, sellerToken) {
  console.log("SERVER: Calling LIVE P2PLastStep API...");
  const url = `https://P2P.upbpay.com/api/order/P2PLastStep?TxnId=${txnId}&BuyerUPBAddress=${buyerAddress}`;
  const username = 'UPBA_getById';
  const password = '7hfn894f4jUPBP';
  const basicAuth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  const headers = {
    'Authorization': basicAuth,
    'UpbpAddress': sellerUpbAddress,
    'Method': 'getById',
    'Token': sellerToken,
    'Content-Type': 'application/json',
  };
  try {
    const response = await axios.post(url, {}, { headers });
    if (response && response.data && response.data.data) {
      const apiData = response.data.data;
      return {
        transactionId: apiData.transactionId || txnId || 'TXN_ID_MISSING',
        coinType: apiData.coinType || 'USDT',
        amount: parseFloat(apiData.amount) || 0.0,
        status: apiData.status || 'Completed'
      };
    } else {
      console.warn("⚠️ API call was successful but returned no data. Using safe defaults.");
      return { transactionId: txnId || 'TXN_ID_MISSING', coinType: 'USDT', amount: 0.0, status: 'Completed (No Data)' };
    }
  } catch (error) {
    console.error("❌ P2PLastStep API call FAILED:", error.message);
    return { transactionId: txnId || 'TXN_API_ERROR', coinType: 'USDT', amount: 0.0, status: 'Completed (API Error)' };
  }
}

app.get('/api/conversations/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const conversations = await Conversation.find({
      $or: [{ userId }, { peerId: userId }],
    }).sort({ updatedAt: -1 });
    res.json({
      success: true,
      data: conversations,
    });
  } catch (err) {
    console.error('❌ Error fetching conversations:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

const PORT = process.env.PORT || 2001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});