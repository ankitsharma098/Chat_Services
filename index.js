const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const Conversation = require('./conversation');

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  credentials: true,
}));
app.use(express.json());

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// MongoDB connection
mongoose.connect("mongodb+srv://ankits45987:major@cluster0.ovdsg.mongodb.net/", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('🚀 Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Socket handler function
const setupSocketHandlers = (io) => {
  const users = {};
  const roomMembers = {};

  io.on('connection', (socket) => {
    console.log(`✅ Connected to /p2p: ${socket.id}`);

    socket.on('register', (userId) => {
      users[userId] = socket.id;
      console.log(`👤 Registered: ${userId}`);
    });

  socket.on('join_room', async ({ roomId, userId, flowType }) => {
  const uniqueRoomId = `${flowType}_${roomId}`;
  if (!roomMembers[uniqueRoomId]) {
    roomMembers[uniqueRoomId] = new Set();
  }
  if (roomMembers[uniqueRoomId].has(userId)) {
    socket.emit('already_joined');
    console.log(`⚠ User ${userId} already in room ${uniqueRoomId}`);
    return;
  }
  const members = roomMembers[uniqueRoomId];
  if (members.size >= 2 && !members.has(userId)) {
    socket.emit('room_full', { message: '❌ Room already has 2 users' });
    console.log(`❌ ${userId} blocked from joining full room ${uniqueRoomId}`);
    return;
  }

  members.add(userId);
  socket.join(uniqueRoomId);
  console.log(`📥 ${userId} joined room ${uniqueRoomId}`);

  try {
    const conversation = await Conversation.findOne({ roomId });
    if (conversation) {
      // socket.emit('conversation_history', {
      //   messages: conversation.messages,
      //   currentStep: conversation.currentStep,
      //   isCompleted: conversation.isCompleted,

      // });
        socket.emit('conversation_history', {
        messages: conversation.messages,
        currentStep: conversation.currentStep,
        isCompleted: conversation.isCompleted,
        userId: conversation.userId,       // Add this
        peerId: conversation.peerId,       // Add this
        orderId: conversation.orderId,     // Add this
        flowType: conversation.flowType,   // Add this
      });
      console.log(`✅ Emitted conversation_history to ${userId} for room ${roomId}`);
    } else {
      console.log(`ℹ No conversation found for room ${roomId}`);

      socket.emit('conversation_history', {
        messages: [],
        currentStep: 'initial',
        isCompleted: false
      });
    
    }
  } catch (err) {
    console.error(`❌ Error fetching conversation for room ${uniqueRoomId}:`, err);
  }
});



    socket.on('send_message', async ({ roomId, senderId, message, type, flowType }) => {
      const uniqueRoomId = `${flowType}_${roomId}`;
      const msg = { roomId, senderId, message, type, timestamp: new Date() };
      io.to(uniqueRoomId).emit('receive_message', msg);
      console.log(`📤 ${senderId} to ${uniqueRoomId}: ${message}`);

      try {
        await Conversation.findOneAndUpdate(
          { roomId },
          {
            $push: { messages: msg },
            $set: { updatedAt: Date.now() },
          },
          { upsert: true }
        );
        console.log(`✅ Message saved to MongoDB for room ${roomId}`);
      } catch (err) {
        console.error(`❌ Error saving message for room ${roomId}:`, err);
      }
    });

//    socket.on('askAvailability', async ({ from, to, roomId, orderId, flowType }) => {
//   console.log(`📨 Received askAvailability: from=${from}, to=${to}, roomId=${roomId}, orderId=${orderId}, flowType=${flowType}`);
//   const toSocketId = users[to];
//   const uniqueRoomId = `${flowType}_${roomId}`;
  
//   if (!to) {
//     console.error(`❌ Error: 'to' field is undefined in askAvailability event`);
//     socket.emit('error', { message: 'Invalid recipient ID' });
//     return;
//   }

//   if (toSocketId) {
//     io.to(toSocketId).emit('receiveAvailabilityRequest', { from });
//     console.log(`📨 Emitted receiveAvailabilityRequest to ${toSocketId} (user: ${to})`);

//     const msg = {
//       senderId: from,
//       message: `Asked ${to}: Are you available?`,
//       type: 'text',
//       timestamp: new Date(),
//     };
//     try {
//       const conversation = await Conversation.findOneAndUpdate(
//         { roomId },
//         {
//           $push: { messages: msg },
//           $set: {
//             currentStep: 'availabilityAsked',
//             userId: from,
//             peerId: to,
//             orderId,
//             flowType,
//             updatedAt: Date.now(),
//           },
//         },
//         { upsert: true, new: true }
//       );
//       console.log(`✅ Availability request saved for room ${roomId}`);

//       // Emit conversation_history to all room members
//       io.to(uniqueRoomId).emit('conversation_history', {
//         messages: conversation.messages,
//         currentStep: conversation.currentStep,
//         isCompleted: conversation.isCompleted,
//         userId: from,
//         peerId: to,
//         orderId,
//         flowType,
//       });
//       console.log(`✅ Emitted conversation_history for room ${uniqueRoomId}`);
//     } catch (err) {
//       console.error(`❌ Error saving availability request for room ${roomId}:`, err);
//     }
//   } else {
//     console.error(`❌ No socket found for user ${to}`);
//     socket.emit('error', { message: `User ${to} is not online` });
//   }
// });


socket.on('askAvailability', async ({ from, to, roomId, orderId, flowType }) => {
  console.log(`📨 Received askAvailability: from=${from}, to=${to}, roomId=${roomId}, orderId=${orderId}, flowType=${flowType}`);
  const toSocketId = users[to];
  const uniqueRoomId = `${flowType}_${roomId}`;
  
  if (!to) {
    console.error(`❌ Error: 'to' field is undefined in askAvailability event`);
    socket.emit('error', { message: 'Invalid recipient ID' });
    return;
  }

  // ✅ *** THE FIX IS HERE *** ✅

  // Step 1: Attempt to notify the user if they are online. This can fail.
  if (toSocketId) {
    io.to(toSocketId).emit('receiveAvailabilityRequest', { from });
    console.log(`📨 Emitted receiveAvailabilityRequest to ${toSocketId} (user: ${to})`);
  } else {
    console.log(`ℹ️ User ${to} is offline. State will be saved for when they connect.`);
    // You could also emit an error back to the sender if you want, but it's not necessary
    // since the state will be saved and the flow will continue.
    // socket.emit('error', { message: `User ${to} is not online, but request was saved.` });
  }

  // Step 2: Unconditionally create the message and save the state to the database.
  // This logic is now OUTSIDE the 'if (toSocketId)' block.
  const msg = {
    senderId: from,
    message: `Asked ${to}: Are you available?`,
    type: 'text', // Or a system message type
    timestamp: new Date(),
  };
  try {
    const conversation = await Conversation.findOneAndUpdate(
      { roomId },
      {
        $push: { messages: msg },
        $set: {
          currentStep: 'availabilityAsked',
          userId: from,

          peerId: to,
          orderId,
          flowType,
          updatedAt: Date.now(),
        },
      },
      { upsert: true, new: true } // 'upsert' creates the doc if it doesn't exist
    );
    console.log(`✅ Availability request saved to DB for room ${roomId}`);

    // Step 3: Emit the updated history to the entire room.
    // This updates the sender's UI to show "Waiting for response...".
    io.to(uniqueRoomId).emit('conversation_history', {
      messages: conversation.messages,
      currentStep: conversation.currentStep,
      isCompleted: conversation.isCompleted,
      userId: from,
      peerId: to,
      orderId,
      flowType,
    });
    console.log(`✅ Emitted updated conversation_history to room ${uniqueRoomId}`);
  } catch (err) {
    console.error(`❌ Error saving availability request for room ${roomId}:`, err);
  }
});

    socket.on('availabilityResponse', async ({ from, to, response, roomId, flowType }) => {
      const fromSocketId = users[from];
      const toSocketId = users[to];
      const uniqueRoomId = `${flowType}_${roomId}`;
      const responsePayload = { from, response };
      const responseText = response === 'yes' ? 'Yes, available' : 'No, not available';

      if (fromSocketId) io.to(fromSocketId).emit('receiveAvailabilityResponse', responsePayload);
      if (toSocketId) io.to(toSocketId).emit('receiveAvailabilityResponse', responsePayload);

      const msg = {
        senderId: from,
        message: `Responded to ${to}: ${responseText}`,
        type: 'text',
        timestamp: new Date(),
      };
      const nextStep = response === 'yes' ? 'availabilityResponded' : 'availabilityDenied';
      try {
        await Conversation.findOneAndUpdate(
          { roomId },
          {
            $push: { messages: msg },
            $set: {
              currentStep: nextStep,
              isCompleted: nextStep === 'availabilityDenied',
              updatedAt: Date.now(),
            },
          }
        );
        console.log(`✅ Availability response saved for room ${roomId}`);
      } catch (err) {
        console.error(`❌ Error saving availability response for room ${roomId}:`, err);
      }

      console.log(`📨 ${from} responded ${response} to ${to}`);
    });

    socket.on('askBankDetails', async ({ from, to, roomId, flowType }) => {
      const toSocketId = users[to];
      const uniqueRoomId = `${flowType}_${roomId}`;
      if (toSocketId) {
        io.to(toSocketId).emit('receiveBankDetailsRequest', { from });
        console.log(`📨 ${from} asked ${to} for bank details`);

        const msg = {
          senderId: from,
          message: `Asked ${to}: Share your bank details?`,
          type: 'text',
          timestamp: new Date(),
        };
        try {
          await Conversation.findOneAndUpdate(
            { roomId },
            {
              $push: { messages: msg },
              $set: { currentStep: 'bankDetailsAsked', updatedAt: Date.now() },
            }
          );
          console.log(`✅ Bank details request saved for room ${roomId}`);
        } catch (err) {
          console.error(`❌ Error saving bank details request for room ${roomId}:`, err);
        }
      }
    });

    socket.on('sendBankDetails', async ({ from, to, bankDetails, roomId, flowType }) => {
      const toSocketId = users[to];
      const uniqueRoomId = `${flowType}_${roomId}`;
      if (toSocketId) {
        io.to(toSocketId).emit('receiveBankDetails', { from, bankDetails });
        io.to(toSocketId).emit('startPaymentTimer', {
          from,
          duration: 300,
          message: 'Complete payment within 5 minutes',
        });
        console.log(`🏦 ${from} sent bank details to ${to} - 5min timer started`);

        setTimeout(() => {
          io.to(toSocketId).emit('showSendReceiptButton', {
            delay: 0,
            message: 'Payment time started. Send receipt when payment is complete.',
          });
          console.log(`📱 Send receipt button shown to ${to} after 20 seconds`);
        }, 20000);

        const msg = {
          senderId: from,
          message: `Bank Details: ${bankDetails}`,
          type: 'text',
          timestamp: new Date(),
        };
        try {
          await Conversation.findOneAndUpdate(
            { roomId },
            {
              $push: { messages: msg },
              $set: { currentStep: 'bankDetailsSent', updatedAt: Date.now() },
            }
          );
          console.log(`✅ Bank details saved for room ${roomId}`);
        } catch (err) {
          console.error(`❌ Error saving bank details for room ${roomId}:`, err);
        }
      }
    });

    socket.on('sendReceipt', async ({ from, to, roomId, flowType }) => {
      const toSocketId = users[to];
      const uniqueRoomId = `${flowType}_${roomId}`;
      if (toSocketId) {
        io.to(toSocketId).emit('receivePaymentReceipt', { from, message: 'Payment done' });
        console.log(`🧾 ${from} sent payment receipt to ${to}`);

        const msg = {
          senderId: from,
          message: 'Payment Receipt Sent',
          type: 'text',
          timestamp: new Date(),
        };
        try {
          await Conversation.findOneAndUpdate(
            { roomId },
            {
              $push: { messages: msg },
              $set: { currentStep: 'receiptSent', updatedAt: Date.now() },
            }
          );
          console.log(`✅ Payment receipt saved for room ${roomId}`);
        } catch (err) {
          console.error(`❌ Error saving payment receipt for room ${roomId}:`, err);
        }
      }
    });

    socket.on('confirmPaymentStatus', async ({ from, to, status, roomId, flowType }) => {
      const toSocketId = users[to];
      const fromSocketId = users[from];
      const uniqueRoomId = `${flowType}_${roomId}`;

      if (status === 'yes') {
        const payload = {
          from,
          message: '✅ Payment done and your order is successfully placed',
          status: true,
          timestamp: new Date().toISOString(),
        };

        if (toSocketId) io.to(toSocketId).emit('paymentConfirmed', payload);
        if (fromSocketId) io.to(fromSocketId).emit('paymentConfirmed', payload);

        const msg = {
          senderId: from,
          message: '✅ Payment Confirmed',
          type: 'text',
          timestamp: new Date(),
        };
        try {
          await Conversation.findOneAndUpdate(
            { roomId },
            {
              $push: { messages: msg },
              $set: {
                currentStep: 'completed',
                isCompleted: true,
                updatedAt: Date.now(),
              },
            }
          );
          console.log(`✅ Payment confirmation saved for room ${roomId}`);
        } catch (err) {
          console.error(`❌ Error saving payment confirmation for room ${roomId}:`, err);
        }

        console.log(`✅ ${from} confirmed payment with ${to}`);
      } else {
        if (toSocketId) {
          io.to(toSocketId).emit('paymentDenied', {
            from,
            status: false,
            message: `❌ ${from} denied your payment`,
          });
        }
        if (fromSocketId) {
          io.to(fromSocketId).emit('paymentDenied', {
            from,
            status: false,
            message: '❌ You denied the payment',
          });
        }

        const msg = {
          senderId: from,
          message: '❌ Payment Denied',
          type: 'text',
          timestamp: new Date(),
        };
        try {
          await Conversation.findOneAndUpdate(
            { roomId },
            {
              $push: { messages: msg },
              $set: { currentStep: 'paymentDenied', updatedAt: Date.now() },
            }
          );
          console.log(`✅ Payment denial saved for room ${roomId}`);
        } catch (err) {
          console.error(`❌ Error saving payment denial for room ${roomId}:`, err);
        }

        console.log(`❌ ${from} denied payment from ${to}`);
      }
    });

    socket.on('reportPaymentConflict', async ({ from, to, orderId, roomId, flowType }) => {
      const toSocketId = users[to];
      const fromSocketId = users[from];
      const uniqueRoomId = `${flowType}_${roomId}`;

      const conflictPayload = {
        from: 'system',
        orderId,
        message: '⚠️ Payment conflict reported to admin for review',
        timestamp: new Date().toISOString(),
      };

      if (toSocketId) io.to(toSocketId).emit('paymentConflictReported', conflictPayload);
      if (fromSocketId) io.to(fromSocketId).emit('paymentConflictReported', conflictPayload);

      const msg = {
        senderId: from,
        message: '⚠️ Payment conflict reported to admin for review',
        type: 'text',
        timestamp: new Date(),
      };
      try {
        await Conversation.findOneAndUpdate(
          { roomId },
          {
            $push: { messages: msg },
            $set: { currentStep: 'paymentConflict', updatedAt: Date.now() },
          }
        );
        console.log(`✅ Payment conflict saved for room ${roomId}`);
      } catch (err) {
        console.error(`❌ Error saving payment conflict for room ${roomId}:`, err);
      }

      console.log(`⚠️ Payment conflict reported by ${from} against ${to} for order ${orderId}`);
    });

    socket.on('paymentTimerExpired', async ({ from, to, orderId, roomId, flowType }) => {
      const fromSocketId = users[from];
      const toSocketId = users[to];
      const uniqueRoomId = `${flowType}_${roomId}`;

      const timeoutPayload = {
        from: 'system',
        message: '⏰ Payment time expired! Please contact the seller to resolve.',
        timestamp: new Date().toISOString(),
      };

      if (fromSocketId) io.to(fromSocketId).emit('paymentTimeout', timeoutPayload);
      if (toSocketId) io.to(toSocketId).emit('paymentTimeout', timeoutPayload);

      const msg = {
        senderId: 'system',
        message: '⏰ Payment time expired! Please contact the seller to resolve.',
        type: 'text',
        timestamp: new Date(),
      };
      try {
        await Conversation.findOneAndUpdate(
          { roomId },
          {
            $push: { messages: msg },
            $set: { currentStep: 'paymentTimerExpired', updatedAt: Date.now() },
          }
        );
        console.log(`✅ Payment timeout saved for room ${roomId}`);
      } catch (err) {
        console.error(`❌ Error saving payment timeout for room ${roomId}:`, err);
      }

      console.log(`⏰ Payment timer expired for order ${orderId} between ${from} and ${to}`);
    });

    socket.on('disconnect', () => {
      const user = Object.keys(users).find((u) => users[u] === socket.id);
      if (user) {
        delete users[user];
        console.log(`❌ Disconnected: ${user}`);
        for (const roomId in roomMembers) {
          roomMembers[roomId].delete(user);
        }
      }
    });
  });
};

// Apply handlers to the single namespace
setupSocketHandlers(io);

// API Endpoint for fetching conversations
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
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

// const express = require('express');
// const http = require('http');
// const cors = require('cors');
// const socketIO = require('socket.io');
// const mongoose = require('mongoose');
// const Conversation = require('./conversation');
// const Notification = require('./notification');

// const app = express();
// app.use(cors({
//   origin: '*',
//   methods: ['GET', 'POST'],
//   credentials: true,
// }));
// app.use(express.json());

// const server = http.createServer(app);
// const io = socketIO(server, {
//   cors: {
//     origin: '*',
//     methods: ['GET', 'POST'],
//   },
// });

// // MongoDB connection
// mongoose.connect("mongodb+srv://ankits45987:major@cluster0.ovdsg.mongodb.net/", {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// })
//   .then(() => console.log('🚀 Connected to MongoDB'))
//   .catch((err) => console.error('❌ MongoDB connection error:', err));

// // Socket handler function
// const setupSocketHandlers = (io) => {
//   const users = {};
//   const roomMembers = {};

//   io.on('connection', (socket) => {
//     console.log(`✅ Connected to /p2p: ${socket.id}`);

//     socket.on('register', async (userId) => {
//       users[userId] = socket.id;
//       console.log(`👤 Registered: ${userId}`);

//       // Deliver pending notifications
//       try {
//         const pendingNotifications = await Notification.find({ to: userId, delivered: false });
//         for (const notif of pendingNotifications) {
//           if (notif.type === 'availabilityRequest') {
//             socket.emit('receiveAvailabilityRequest', {
//               from: notif.from,
//               roomId: notif.roomId,
//               orderId: notif.orderId,
//               flowType: notif.flowType,
//             });
//             console.log(`📨 Delivered pending availability request to ${userId} from ${notif.from}`);
//           }
//           // Mark as delivered
//           await Notification.updateOne({ _id: notif._id }, { $set: { delivered: true } });
//         }
//       } catch (err) {
//         console.error(`❌ Error delivering pending notifications for ${userId}:`, err);
//       }
//     });

//     socket.on('join_room', async ({ roomId, userId, flowType }) => {
//       const uniqueRoomId = `${flowType}_${roomId}`;
//       if (!roomMembers[uniqueRoomId]) {
//         roomMembers[uniqueRoomId] = new Set();
//       }
//       if (roomMembers[uniqueRoomId].has(userId)) {
//         socket.emit('already_joined');
//         console.log(`⚠ User ${userId} already in room ${uniqueRoomId}`);
//         return;
//       }
//       const members = roomMembers[uniqueRoomId];
//       if (members.size >= 2 && !members.has(userId)) {
//         socket.emit('room_full', { message: '❌ Room already has 2 users' });
//         console.log(`❌ ${userId} blocked from joining full room ${uniqueRoomId}`);
//         return;
//       }

//       members.add(userId);
//       socket.join(uniqueRoomId);
//       console.log(`📥 ${userId} joined room ${uniqueRoomId}`);

//       try {
//         const conversation = await Conversation.findOne({ roomId });
//         if (conversation) {
//           socket.emit('conversation_history', {
//             messages: conversation.messages,
//             currentStep: conversation.currentStep,
//             isCompleted: conversation.isCompleted,
//             userId: conversation.userId,
//             peerId: conversation.peerId,
//             orderId: conversation.orderId,
//             flowType: conversation.flowType,
//           });
//           console.log(`✅ Emitted conversation_history to ${userId} for room ${roomId}`);
//         } else {
//           console.log(`ℹ No conversation found for room ${roomId}`);
//         }
//       } catch (err) {
//         console.error(`❌ Error fetching conversation for room ${uniqueRoomId}:`, err);
//       }
//     });

//     socket.on('send_message', async ({ roomId, senderId, message, type, flowType }) => {
//       const uniqueRoomId = `${flowType}_${roomId}`;
//       const msg = { roomId, senderId, message, type, timestamp: new Date() };
//       io.to(uniqueRoomId).emit('receive_message', msg);
//       console.log(`📤 ${senderId} to ${uniqueRoomId}: ${message}`);

//       try {
//         await Conversation.findOneAndUpdate(
//           { roomId },
//           {
//             $push: { messages: msg },
//             $set: { updatedAt: Date.now() },
//           },
//           { upsert: true }
//         );
//         console.log(`✅ Message saved to MongoDB for room ${roomId}`);
//       } catch (err) {
//         console.error(`❌ Error saving message for room ${roomId}:`, err);
//       }
//     });

//     socket.on('askAvailability', async ({ from, to, roomId, orderId, flowType }) => {
//       console.log(`📨 Received askAvailability: from=${from}, to=${to}, roomId=${roomId}, orderId=${orderId}, flowType=${flowType}`);
//       const toSocketId = users[to];
//       const uniqueRoomId = `${flowType}_${roomId}`;

//       if (!to) {
//         console.error(`❌ Error: 'to' field is undefined in askAvailability event`);
//         socket.emit('error', { message: 'Invalid recipient ID' });
//         return;
//       }

//       const msg = {
//         senderId: from,
//         message: `Asked ${to}: Are you available?`,
//         type: 'text',
//         timestamp: new Date(),
//       };

//       // Save notification
//       try {
//         await Notification.create({
//           from,
//           to,
//           roomId,
//           orderId,
//           flowType,
//           type: 'availabilityRequest',
//           message: `User ${from} asked: Are you available?`,
//           expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expire in 7 days
//         });
//         console.log(`✅ Notification saved for user ${to}`);
//       } catch (err) {
//         console.error(`❌ Error saving notification for user ${to}:`, err);
//       }

//       if (toSocketId) {
//         io.to(toSocketId).emit('receiveAvailabilityRequest', { from, roomId, orderId, flowType });
//         console.log(`📨 Emitted receiveAvailabilityRequest to ${toSocketId} (user: ${to})`);

//         // Mark notification as delivered
//         await Notification.updateOne(
//           { to, roomId, delivered: false, type: 'availabilityRequest' },
//           { $set: { delivered: true } }
//         );
//       } else {
//         console.log(`ℹ User ${to} is offline, notification stored for later delivery`);
//         socket.emit('info', { message: `User ${to} is not online, notification will be sent when they come online` });
//       }

//       try {
//         const conversation = await Conversation.findOneAndUpdate(
//           { roomId },
//           {
//             $push: { messages: msg },
//             $set: {
//               currentStep: 'availabilityAsked',
//               userId: from,
//               peerId: to,
//               orderId,
//               flowType,
//               updatedAt: Date.now(),
//             },
//           },
//           { upsert: true, new: true }
//         );
//         console.log(`✅ Availability request saved for room ${roomId}`);

//         io.to(uniqueRoomId).emit('conversation_history', {
//           messages: conversation.messages,
//           currentStep: conversation.currentStep,
//           isCompleted: conversation.isCompleted,
//           userId: from,
//           peerId: to,
//           orderId,
//           flowType,
//         });
//         console.log(`✅ Emitted conversation_history for room ${uniqueRoomId}`);
//       } catch (err) {
//         console.error(`❌ Error saving availability request for room ${roomId}:`, err);
//       }
//     });

//     socket.on('availabilityResponse', async ({ from, to, response, roomId, flowType }) => {
//       const fromSocketId = users[from];
//       const toSocketId = users[to];
//       const uniqueRoomId = `${flowType}_${roomId}`;
//       const responsePayload = { from, response };
//       const responseText = response === 'yes' ? 'Yes, available' : 'No, not available';

//       if (fromSocketId) io.to(fromSocketId).emit('receiveAvailabilityResponse', responsePayload);
//       if (toSocketId) io.to(toSocketId).emit('receiveAvailabilityResponse', responsePayload);

//       const msg = {
//         senderId: from,
//         message: `Responded to ${to}: ${responseText}`,
//         type: 'text',
//         timestamp: new Date(),
//       };
//       const nextStep = response === 'yes' ? 'availabilityResponded' : 'availabilityDenied';
//       try {
//         await Conversation.findOneAndUpdate(
//           { roomId },
//           {
//             $push: { messages: msg },
//             $set: {
//               currentStep: nextStep,
//               isCompleted: nextStep === 'availabilityDenied',
//               updatedAt: Date.now(),
//             },
//           }
//         );
//         console.log(`✅ Availability response saved for room ${roomId}`);
//       } catch (err) {
//         console.error(`❌ Error saving availability response for room ${roomId}:`, err);
//       }

//       console.log(`📨 ${from} responded ${response} to ${to}`);
//     });

//     socket.on('askBankDetails', async ({ from, to, roomId, flowType }) => {
//       const toSocketId = users[to];
//       const uniqueRoomId = `${flowType}_${roomId}`;
//       if (toSocketId) {
//         io.to(toSocketId).emit('receiveBankDetailsRequest', { from });
//         console.log(`📨 ${from} asked ${to} for bank details`);

//         const msg = {
//           senderId: from,
//           message: `Asked ${to}: Share your bank details?`,
//           type: 'text',
//           timestamp: new Date(),
//         };
//         try {
//           await Conversation.findOneAndUpdate(
//             { roomId },
//             {
//               $push: { messages: msg },
//               $set: { currentStep: 'bankDetailsAsked', updatedAt: Date.now() },
//             }
//           );
//           console.log(`✅ Bank details request saved for room ${roomId}`);
//         } catch (err) {
//           console.error(`❌ Error saving bank details request for room ${roomId}:`, err);
//         }
//       }
//     });

//     socket.on('sendBankDetails', async ({ from, to, bankDetails, roomId, flowType }) => {
//       const toSocketId = users[to];
//       const uniqueRoomId = `${flowType}_${roomId}`;
//       if (toSocketId) {
//         io.to(toSocketId).emit('receiveBankDetails', { from, bankDetails });
//         io.to(toSocketId).emit('startPaymentTimer', {
//           from,
//           duration: 300,
//           message: 'Complete payment within 5 minutes',
//         });
//         console.log(`🏦 ${from} sent bank details to ${to} - 5min timer started`);

//         setTimeout(() => {
//           io.to(toSocketId).emit('showSendReceiptButton', {
//             delay: 0,
//             message: 'Payment time started. Send receipt when payment is complete.',
//           });
//           console.log(`📱 Send receipt button shown to ${to} after 20 seconds`);
//         }, 20000);

//         const msg = {
//           senderId: from,
//           message: `Bank Details: ${bankDetails}`,
//           type: 'text',
//           timestamp: new Date(),
//         };
//         try {
//           await Conversation.findOneAndUpdate(
//             { roomId },
//             {
//               $push: { messages: msg },
//               $set: { currentStep: 'bankDetailsSent', updatedAt: Date.now() },
//             }
//           );
//           console.log(`✅ Bank details saved for room ${roomId}`);
//         } catch (err) {
//           console.error(`❌ Error saving bank details for room ${roomId}:`, err);
//         }
//       }
//     });

//     socket.on('sendReceipt', async ({ from, to, roomId, flowType }) => {
//       const toSocketId = users[to];
//       const uniqueRoomId = `${flowType}_${roomId}`;
//       if (toSocketId) {
//         io.to(toSocketId).emit('receivePaymentReceipt', { from, message: 'Payment done' });
//         console.log(`🧾 ${from} sent payment receipt to ${to}`);

//         const msg = {
//           senderId: from,
//           message: 'Payment Receipt Sent',
//           type: 'text',
//           timestamp: new Date(),
//         };
//         try {
//           await Conversation.findOneAndUpdate(
//             { roomId },
//             {
//               $push: { messages: msg },
//               $set: { currentStep: 'receiptSent', updatedAt: Date.now() },
//             }
//           );
//           console.log(`✅ Payment receipt saved for room ${roomId}`);
//         } catch (err) {
//           console.error(`❌ Error saving payment receipt for room ${roomId}:`, err);
//         }
//       }
//     });

//     socket.on('confirmPaymentStatus', async ({ from, to, status, roomId, flowType }) => {
//       const toSocketId = users[to];
//       const fromSocketId = users[from];
//       const uniqueRoomId = `${flowType}_${roomId}`;

//       if (status === 'yes') {
//         const payload = {
//           from,
//           message: '✅ Payment done and your order is successfully placed',
//           status: true,
//           timestamp: new Date().toISOString(),
//         };

//         if (toSocketId) io.to(toSocketId).emit('paymentConfirmed', payload);
//         if (fromSocketId) io.to(fromSocketId).emit('paymentConfirmed', payload);

//         const msg = {
//           senderId: from,
//           message: '✅ Payment Confirmed',
//           type: 'text',
//           timestamp: new Date(),
//         };
//         try {
//           await Conversation.findOneAndUpdate(
//             { roomId },
//             {
//               $push: { messages: msg },
//               $set: {
//                 currentStep: 'completed',
//                 isCompleted: true,
//                 updatedAt: Date.now(),
//               },
//             }
//           );
//           console.log(`✅ Payment confirmation saved for room ${roomId}`);
//         } catch (err) {
//           console.error(`❌ Error saving payment confirmation for room ${roomId}:`, err);
//         }

//         console.log(`✅ ${from} confirmed payment with ${to}`);
//       } else {
//         if (toSocketId) {
//           io.to(toSocketId).emit('paymentDenied', {
//             from,
//             status: false,
//             message: `❌ ${from} denied your payment`,
//           });
//         }
//         if (fromSocketId) {
//           io.to(fromSocketId).emit('paymentDenied', {
//             from,
//             status: false,
//             message: '❌ You denied the payment',
//           });
//         }

//         const msg = {
//           senderId: from,
//           message: '❌ Payment Denied',
//           type: 'text',
//           timestamp: new Date(),
//         };
//         try {
//           await Conversation.findOneAndUpdate(
//             { roomId },
//             {
//               $push: { messages: msg },
//               $set: { currentStep: 'paymentDenied', updatedAt: Date.now() },
//             }
//           );
//           console.log(`✅ Payment denial saved for room ${roomId}`);
//         } catch (err) {
//           console.error(`❌ Error saving payment denial for room ${roomId}:`, err);
//         }

//         console.log(`❌ ${from} denied payment from ${to}`);
//       }
//     });

//     socket.on('reportPaymentConflict', async ({ from, to, orderId, roomId, flowType }) => {
//       const toSocketId = users[to];
//       const fromSocketId = users[from];
//       const uniqueRoomId = `${flowType}_${roomId}`;

//       const conflictPayload = {
//         from: 'system',
//         orderId,
//         message: '⚠️ Payment conflict reported to admin for review',
//         timestamp: new Date().toISOString(),
//       };

//       if (toSocketId) io.to(toSocketId).emit('paymentConflictReported', conflictPayload);
//       if (fromSocketId) io.to(fromSocketId).emit('paymentConflictReported', conflictPayload);

//       const msg = {
//         senderId: from,
//         message: '⚠️ Payment conflict reported to admin for review',
//         type: 'text',
//         timestamp: new Date(),
//       };
//       try {
//         await Conversation.findOneAndUpdate(
//           { roomId },
//           {
//             $push: { messages: msg },
//             $set: { currentStep: 'paymentConflict', updatedAt: Date.now() },
//           }
//         );
//         console.log(`✅ Payment conflict saved for room ${roomId}`);
//       } catch (err) {
//         console.error(`❌ Error saving payment conflict for room ${roomId}:`, err);
//       }

//       console.log(`⚠️ Payment conflict reported by ${from} against ${to} for order ${orderId}`);
//     });

//     socket.on('paymentTimerExpired', async ({ from, to, orderId, roomId, flowType }) => {
//       const fromSocketId = users[from];
//       const toSocketId = users[to];
//       const uniqueRoomId = `${flowType}_${roomId}`;

//       const timeoutPayload = {
//         from: 'system',
//         message: '⏰ Payment time expired! Please contact the seller to resolve.',
//         timestamp: new Date().toISOString(),
//       };

//       if (fromSocketId) io.to(fromSocketId).emit('paymentTimeout', timeoutPayload);
//       if (toSocketId) io.to(toSocketId).emit('paymentTimeout', timeoutPayload);

//       const msg = {
//         senderId: 'system',
//         message: '⏰ Payment time expired! Please contact the seller to resolve.',
//         type: 'text',
//         timestamp: new Date(),
//       };
//       try {
//         await Conversation.findOneAndUpdate(
//           { roomId },
//           {
//             $push: { messages: msg },
//             $set: { currentStep: 'paymentTimerExpired', updatedAt: Date.now() },
//           }
//         );
//         console.log(`✅ Payment timeout saved for room ${roomId}`);
//       } catch (err) {
//         console.error(`❌ Error saving payment timeout for room ${roomId}:`, err);
//       }

//       console.log(`⏰ Payment timer expired for order ${orderId} between ${from} and ${to}`);
//     });

//     socket.on('disconnect', () => {
//       const user = Object.keys(users).find((u) => users[u] === socket.id);
//       if (user) {
//         delete users[user];
//         console.log(`❌ Disconnected: ${user}`);
//         for (const roomId in roomMembers) {
//           roomMembers[roomId].delete(user);
//         }
//       }
//     });
//   });
// };

// // Apply handlers to the single namespace
// setupSocketHandlers(io);

// // API Endpoint for fetching conversations
// app.get('/api/conversations/:userId', async (req, res) => {
//   const { userId } = req.params;
//   try {
//     const conversations = await Conversation.find({
//       $or: [{ userId }, { peerId: userId }],
//     }).sort({ updatedAt: -1 });
//     res.json({
//       success: true,
//       data: conversations,
//     });
//   } catch (err) {
//     console.error('❌ Error fetching conversations:', err);
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// });

// const PORT = process.env.PORT || 2001;
// server.listen(PORT, () => {
//   console.log(`🚀 Server running at http://localhost:${PORT}`);
// });