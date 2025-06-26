const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const axios = require('axios');
const Conversation = require('./conversation'); // Make sure your Conversation model is defined

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

// --- MongoDB Connection ---
mongoose.connect("mongodb+srv://ankits45987:major@cluster0.ovdsg.mongodb.net/")
  .then(() => console.log('🚀 Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// --- Socket.IO Connection Logic ---
const setupSocketHandlers = (io) => {
  const users = {}; // In-memory store for user socket IDs

  /**
   * THE SINGLE SOURCE OF TRUTH FOR BROADCASTING STATE.
   * This helper function ensures the payload sent to clients is always complete and consistent.
   */
  const broadcastHistory = (io, uniqueRoomId, conversation) => {
    if (!conversation) {
      console.error(`❌ Attempted to broadcast a null conversation for room ${uniqueRoomId}`);
      return;
    }

    const payload = {
      messages: conversation.messages,
      currentStep: conversation.currentStep,
      isCompleted: conversation.isCompleted,
      userId: conversation.userId,
      peerId: conversation.peerId,
      orderId: conversation.orderId,
      flowType: conversation.flowType,
      transactionDetails: conversation.transactionDetails || null, // CRUCIAL: Always include this key
    };

    io.to(uniqueRoomId).emit('conversation_history', payload);
    console.log(`📡 Broadcasted history to ${uniqueRoomId}. Step: ${payload.currentStep}, Completed: ${payload.isCompleted}`);
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
        } else {
          // If no history, we don't broadcast anything yet.
          // The first action (e.g., askAvailability) will create it.
          console.log(`ℹ No conversation found for room ${roomId}. It will be created on the first action.`);
        }
      } catch (err) {
        console.error(`❌ Error fetching conversation for room ${uniqueRoomId}:`, err);
      }
    });

    // --- Workflow Event Handlers ---

     const handleWorkflowUpdate = async (roomId, uniqueRoomId, updateQuery) => {
      try {
        const conversation = await Conversation.findOneAndUpdate({ roomId }, updateQuery, { upsert: true, new: true });
        broadcastHistory(io, uniqueRoomId, conversation);
      } catch (err) {
        console.error(`❌ Error updating workflow for room ${roomId}:`, err);
      }
    };

    socket.on('askAvailability', ({ from, to, roomId, orderId, flowType }) => {
      const uniqueRoomId = `${flowType}_${roomId}`;
      const toSocketId = users[to];
      if (toSocketId) {
        io.to(toSocketId).emit('receiveAvailabilityRequest', { from });
      } else {
         console.log(`ℹ️ User ${to} is offline. State will be saved for when they connect.`);
      }
      
      const update = {
        $push: { messages: { senderId: from, message: 'Are you available?', type: 'text', timestamp: new Date() } },
        $set: { currentStep: 'availabilityAsked', userId: from, peerId: to, orderId: roomId.split('_')[0], flowType, updatedAt: Date.now() },
      };
      handleWorkflowUpdate(roomId, uniqueRoomId, update);
    });

    socket.on('availabilityResponse', ({ from, to, response, roomId, flowType }) => {
      const uniqueRoomId = `${flowType}_${roomId}`;
      const responseText = response === 'yes' ? 'Yes' : 'No';
      const nextStep = response === 'yes' ? 'availabilityResponded' : 'availabilityDenied';

      const update = {
        $push: { messages: { senderId: from, message: responseText, type: 'text', timestamp: new Date() } },
        $set: { currentStep: nextStep, isCompleted: nextStep === 'availabilityDenied' },
      };
      handleWorkflowUpdate(roomId, uniqueRoomId, update);
    });

    socket.on('askBankDetails', ({ from, to, roomId, flowType }) => {
      const uniqueRoomId = `${flowType}_${roomId}`;
      const toSocketId = users[to];
       if (toSocketId) {
        io.to(toSocketId).emit('receiveBankDetailsRequest', { from });
      }
      const update = {
        $push: { messages: { senderId: from, message: 'Share your Bank Details?', type: 'text', timestamp: new Date() } },
        $set: { currentStep: 'bankDetailsAsked' },
      };
      handleWorkflowUpdate(roomId, uniqueRoomId, update);
    });
    
    socket.on('sendBankDetails', ({ from, to, bankDetails, roomId, flowType }) => {
        const uniqueRoomId = `${flowType}_${roomId}`;
        const toSocketId = users[to];


        
        if (toSocketId) {
            io.to(toSocketId).emit('receiveBankDetails', { from, bankDetails });
            io.to(toSocketId).emit('startPaymentTimer', { duration: 300 }); // 5 minutes
            setTimeout(() => {
                io.to(toSocketId).emit('showSendReceiptButton', {});
            }, 20000); // 20 seconds
        }
        const update = {
            $push: { messages: { senderId: from, message: `Bank Details: ${bankDetails}`, type: 'text', timestamp: new Date() } },
            $set: { currentStep: 'bankDetailsSent' },
        };
        handleWorkflowUpdate(roomId, uniqueRoomId, update);
    });

    // socket.on('sendMediaReceipt', ({ from, to, roomId, flowType, mediaUrl, utrNumber }) => {
    //     const uniqueRoomId = `${flowType}_${roomId}`;
    //     const msg = {
    //         senderId: from,
    //         message: `Payment Receipt Sent`,
    //         type: 'image',
    //         mediaUrl,
    //         utrNumber,
    //         timestamp: new Date(),
    //     };
    //     const update = {
    //         $push: { messages: msg },
    //         $set: { currentStep: 'receiptSent' },
    //     };
    //     handleWorkflowUpdate(roomId, uniqueRoomId, update);
    // });
    // Find and REPLACE your 'sendMediaReceipt' handler with this new, robust version.

socket.on('sendMediaReceipt', async ({ from, to, roomId, flowType, mediaUrl, utrNumber }) => {
  const uniqueRoomId = `${flowType}_${roomId}`;

  try {
    // 1. ✅ STATE CHECK: First, find the current state of the conversation.
    const conversation = await Conversation.findOne({ roomId });

    // 2. 🛑 GUARD CLAUSE: If the conversation doesn't exist or is already completed/expired, reject the action.
    if (!conversation || conversation.isCompleted || conversation.currentStep === 'paymentTimerExpired') {
      console.log(`❌ [${uniqueRoomId}] REJECTED sendMediaReceipt. Chat is already completed or timed out.`);
      // Optionally, you can emit an error back to the sender so they know it failed.
      socket.emit('action_rejected', { message: 'Action failed: The chat is already closed or timed out.' });
      return; // Stop processing immediately.
    }

    // 3. If the state is valid, proceed with the original logic.
    const msg = {
      senderId: from,
      message: `Payment Receipt Sent`,
      type: 'image',
      mediaUrl,
      utrNumber,
      timestamp: new Date(),
    };
    
    const update = {
      $push: { messages: msg },
      $set: { currentStep: 'receiptSent' },
    };
    
    handleWorkflowUpdate(roomId, uniqueRoomId, update);
    console.log(`✅ [${uniqueRoomId}] Accepted and processed sendMediaReceipt.`);

  } catch (err) {
    console.error(`❌ [${uniqueRoomId}] Error in sendMediaReceipt handler:`, err);
  }
});

  socket.on('confirmPaymentStatus', async ({ from, to, status, roomId, flowType, sellerToken }) => {
        const uniqueRoomId = `${flowType}_${roomId}`;
        const orderIdForApi = roomId.split('_')[0];
        let update;

        if (status === 'yes') {
            // ✅ Make the live API call from the server
            const finalDetails = await finalizeOrderAndGetDetails(orderIdForApi, to, from, sellerToken);
            update = {
                $push: { messages: { senderId: from, message: 'Payment Confirmed', type: 'text', timestamp: new Date() } },
                $set: {
                    currentStep: 'completed',
                    isCompleted: true,
                    transactionDetails: finalDetails,
                },
            };
        } else {
            update = {
                $push: { messages: { senderId: from, message: 'Payment Denied', type: 'text', timestamp: new Date() } },
                $set: { currentStep: 'paymentDenied', isCompleted: false },
            };
        }
        handleWorkflowUpdate(roomId, uniqueRoomId, update);
    });

    socket.on('reportPaymentConflict', async ({ from, to, orderId, roomId, flowType }) => {
    const uniqueRoomId = `${flowType}_${roomId}`;
    
    // This is the message that will be added to the chat history for everyone to see.
    const msg = {
        senderId: from, // We know who reported it
        message: 'A payment conflict has been reported for admin review.',
        type: 'text', // Or a 'system' type if you prefer
        timestamp: new Date(),
    };

    // This is the update query for the database.
    const update = {
        $push: { messages: msg },
        $set: {
            currentStep: 'paymentConflict',
            // Setting isCompleted to true is a good idea, as it freezes the chat.
            // Users can no longer interact until an admin intervenes.
            isCompleted: true, 
        },
    };
    
    // Call the central helper to update the DB and broadcast the new state to everyone.
    handleWorkflowUpdate(roomId, uniqueRoomId, update);
    
    console.log(`⚠️ Payment conflict reported by ${from} for order ${orderId}. State locked.`);
});
// Ensure this handler is correct

socket.on('paymentTimerExpired', async ({ roomId, flowType }) => {
    const uniqueRoomId = `${flowType}_${roomId}`;
    const msg = {
        senderId: 'system',
        message: 'Payment time expired.',
        type: 'text',
        timestamp: new Date(),
    };
    const update = {
        $push: { messages: msg },
        $set: {
            currentStep: 'paymentTimerExpired',
            isCompleted: true, // A timeout is a form of completion
        },
    };
    handleWorkflowUpdate(roomId, uniqueRoomId, update);
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

// Find and REPLACE your existing finalizeOrderAndGetDetails function with this one.

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

        console.log("✅ API call successful, parsing live response:", response);

    // Check if the response and its nested 'data' object exist
    if (response && response.data && response.data.data) {
         console.log("✅ API call successful, parsing live response.data:", response.data);
      console.log("✅ API call successful, parsing live response.data.data:", response.data.data);
      const apiData = response.data.data;
      
      // Parse live data, but provide defaults for each field in case one is missing
      return {
        transactionId: apiData.transactionId || txnId || 'TXN_ID_MISSING',
        coinType: apiData.coinType || 'USDT',
        amount: parseFloat(apiData.amount) || 0.0,
        status: apiData.status || 'Completed'
      };
    } else {
      // This case handles a successful API call (200 OK) that returns an empty or unexpected body
      console.warn("⚠️ API call was successful but returned no data. Using safe defaults.");
      return {
        transactionId: txnId || 'TXN_ID_MISSING',
        coinType: 'USDT',
        amount: 0.0, // Return 0.0 as requested
        status: 'Completed (No Data)'
      };
    }
  } catch (error) {
    // This case handles network errors, 4xx/5xx status codes, etc.
    console.error("❌ P2PLastStep API call FAILED:", error.message);
    return {
      transactionId: txnId || 'TXN_API_ERROR',
      coinType: 'USDT',
      amount: 0.0, // Return 0.0 as requested
      status: 'Completed (API Error)'
    };
  }
}

const PORT = process.env.PORT || 2001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});


const makeApiCall = async (url, method, headers, body = null) => {
    try {
        const config = { method, url, headers };
        if (body) config.data = body;
        const response = await axios(config);
        console.log(`✅ API Call to ${url} successful. Status: ${response.status}`);
        return response.data;
    } catch (error) {
        console.error(`❌ API Call to ${url} FAILED.`);
        if (error.response) {
            console.error('Error Response Data:', error.response.data);
            console.error('Error Response Status:', error.response.status);
        } else {
            console.error('Error Message:', error.message);
        }
        return null; // Return null on failure
    }
};

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