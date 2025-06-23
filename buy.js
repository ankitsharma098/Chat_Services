

// const express = require('express');
// const http = require('http');
// const cors = require('cors');
// const socketIO = require('socket.io');
// const mongoose = require('mongoose');
// const Conversation = require('./conversation'); // Import the Conversation model

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
// mongoose.connect('mongodb+srv://ankits45987:major@cluster0.ovdsg.mongodb.net/', {
//   useNewUrlParser: true,
  
// })
//   .then(() => console.log('🚀 Connected to MongoDB'))
//   .catch((err) => console.error('❌ MongoDB connection error:', err));

// const users = {};
// const roomMembers = {};

// io.on('connection', (socket) => {
//   console.log(`✅ Connected: ${socket.id}`);

//   socket.on('register', (userId) => {
//     users[userId] = socket.id;
//     console.log(`👤 Registered: ${userId}`);
//   });

//   socket.on('join_room', async ({ roomId, userId }) => {
//     if (!roomMembers[roomId]) {
//       roomMembers[roomId] = new Set();
//     }
//     if (roomMembers[roomId].has(userId)) {
//       socket.emit('already_joined');
//       console.log(`⚠ User ${userId} already in room ${roomId}`);
//       return;
//     }
//     const members = roomMembers[roomId];
//     if (members.size >= 2 && !members.has(userId)) {
//       socket.emit('room_full', { message: '❌ Room already has 2 users' });
//       console.log(`❌ ${userId} blocked from joining full room ${roomId}`);
//       return;
//     }

//     members.add(userId);
//     socket.join(roomId);
//     console.log(`📥 ${userId} joined room ${roomId}`);

//     // Emit conversation history if it exists
//     try {
//       const conversation = await Conversation.findOne({ roomId });
//       if (conversation) {
//         socket.emit('conversation_history', {
//           messages: conversation.messages,
//           currentStep: conversation.currentStep,
//           isCompleted: conversation.isCompleted,
//         });
//       }
//     } catch (err) {
//       console.error(`❌ Error fetching conversation for room ${roomId}:`, err);
//     }
//   });

//   socket.on('send_message', async ({ roomId, senderId, message, type }) => {
//     const msg = { roomId, senderId, message, type, timestamp: new Date() };
//     io.to(roomId).emit('receive_message', msg);
//     console.log(`📤 ${senderId} to ${roomId}: ${message}`);

//     // Save message to MongoDB
//     try {
//       await Conversation.findOneAndUpdate(
//         { roomId },
//         { 
//           $push: { messages: msg },
//           $set: { updatedAt: Date.now() },
//         },
//         { upsert: true }
//       );
//       console.log(`✅ Message saved to MongoDB for room ${roomId}`);
//     } catch (err) {
//       console.error(`❌ Error saving message for room ${roomId}:`, err);
//     }
//   });

//   socket.on('askAvailability', async ({ from, to, roomId, orderId }) => {
//     const toSocketId = users[to];
//     if (toSocketId) {
//       io.to(toSocketId).emit('receiveAvailabilityRequest', { from });
//       console.log(`📨 ${from} asked ${to} for availability`);

//       // Save message to MongoDB
//       const msg = {
//         senderId: from,
//         message: `Asked ${to}: Are you available?`,
//         type: 'text',
//         timestamp: new Date(),
//       };
//       try {
//         await Conversation.findOneAndUpdate(
//           { roomId },
//           { 
//             $push: { messages: msg },
//             $set: { 
//               currentStep: 'availabilityAsked',
//               userId: from,
//               peerId: to,
//               orderId,
//               updatedAt: Date.now(),
//             },
//           },
//           { upsert: true }
//         );
//         console.log(`✅ Availability request saved for room ${roomId}`);
//       } catch (err) {
//         console.error(`❌ Error saving availability request for room ${roomId}:`, err);
//       }
//     }
//   });

// socket.on('availabilityResponse', async ({ from, to, response, roomId, bankDetails }) => {
//   const fromSocketId = users[from];
//   const toSocketId = users[to];
//   const responsePayload = { from, response, bankDetails };
//   const responseText = response === 'yes' ? 'Yes, available' : 'No, not available';

//   if (fromSocketId) io.to(fromSocketId).emit('receiveAvailabilityResponse', responsePayload);
//   if (toSocketId) io.to(toSocketId).emit('receiveAvailabilityResponse', responsePayload);


//   // Save message to MongoDB
//   const msg = {
//     senderId: from,
//     message: response === 'yes' && bankDetails
//       ? `Responded to ${to}: ${responseText}\nBank Details: ${bankDetails}`
//       : `Responded to ${to}: ${responseText}`,
//     type: 'text',
//     timestamp: new Date(),
//   };
//   const nextStep = response === 'yes' ? 'bankDetailsSent' : 'availabilityDenied';
//   try {
//     await Conversation.findOneAndUpdate(
//       { roomId },
//       {
//         $push: { messages: msg },
//         $set: {
//           currentStep: nextStep,
//           isCompleted: nextStep === 'availabilityDenied',
//           updatedAt: Date.now(),
//         },
//       }
//     );
//     console.log(`✅ Availability response saved for room ${roomId}`);
//   } catch (err) {
//     console.error(`❌ Error saving availability response for room ${roomId}:`, err);
//   }

//   if (response === 'yes' && bankDetails) {
//     if (toSocketId) {
//       io.to(toSocketId).emit('receiveBankDetails', { from, bankDetails });
//       io.to(toSocketId).emit('startPaymentTimer', {
//         from,
//         duration: 300,
//         message: 'Complete payment within 5 minutes',
//       });
//       console.log(`🏦 ${from} sent bank details to ${to} - 5min timer started`);

//       // Show send receipt button after 20 seconds
//       setTimeout(() => {
//         io.to(toSocketId).emit('showSendReceiptButton', {
//           delay: 0,
//           message: 'Payment time started. Send receipt when payment is complete.',
//         });
//         console.log(`📱 Send receipt button shown to ${to} after 20 seconds`);
//       }, 20000);
//     }
//   }

//   console.log(`📨 ${from} responded ${response} to ${to}`);
// });

//   socket.on('askPaymentDetails', async ({ from, to, roomId }) => {
//     const toSocketId = users[to];
//     if (toSocketId) {
//       io.to(toSocketId).emit('receiveAskForBankDetails', { from });
//       console.log(`💰 ${from} asked ${to} for bank details`);

//       // Save message to MongoDB
//       const msg = {
//         senderId: from,
//         message: `Asked ${to} for bank details`,
//         type: 'text',
//         timestamp: new Date(),
//       };
//       try {
//         await Conversation.findOneAndUpdate(
//           { roomId },
//           { 
//             $push: { messages: msg },
//             $set: { currentStep: 'bankDetailsAsked', updatedAt: Date.now() },
//           }
//         );
//         console.log(`✅ Bank details request saved for room ${roomId}`);
//       } catch (err) {
//         console.error(`❌ Error saving bank details request for room ${roomId}:`, err);
//       }
//     }
//   });

//   socket.on('sendBankDetails', async ({ from, to, bankDetails, roomId }) => {
//     const toSocketId = users[to];
//     if (toSocketId) {
//       io.to(toSocketId).emit('receiveBankDetails', { from, bankDetails });
//       io.to(toSocketId).emit('startPaymentTimer', { 
//         from, 
//         duration: 300,
//         message: 'Complete payment within 5 minutes',
//       });
//       console.log(`🏦 ${from} sent bank details to ${to} - 5min timer started`);

//       // Show send receipt button after 20 seconds
//       setTimeout(() => {
//         io.to(toSocketId).emit('showSendReceiptButton', { 
//           delay: 0,
//           message: 'Payment time started. Send receipt when payment is complete.',
//         });
//         console.log(`📱 Send receipt button shown to ${to} after 20 seconds`);
//       }, 20000);

//       // Save message to MongoDB
//       const msg = {
//         senderId: from,
//         message: `Bank Details: ${bankDetails}`,
//         type: 'text',
//         timestamp: new Date(),
//       };
//       try {
//         await Conversation.findOneAndUpdate(
//           { roomId },
//           { 
//             $push: { messages: msg },
//             $set: { currentStep: 'bankDetailsSent', updatedAt: Date.now() },
//           }
//         );
//         console.log(`✅ Bank details saved for room ${roomId}`);
//       } catch (err) {
//         console.error(`❌ Error saving bank details for room ${roomId}:`, err);
//       }
//     }
//   });

//   socket.on('sendReceipt', async ({ from, to, roomId }) => {
//     const toSocketId = users[to];
//     if (toSocketId) {
//       io.to(toSocketId).emit('receivePaymentReceipt', { from, message: 'Payment done' });
//       console.log(`🧾 ${from} sent payment receipt to ${to}`);

//       // Save message to MongoDB
//       const msg = {
//         senderId: from,
//         message: 'Payment Receipt Sent',
//         type: 'text',
//         timestamp: new Date(),
//       };
//       try {
//         await Conversation.findOneAndUpdate(
//           { roomId },
//           { 
//             $push: { messages: msg },
//             $set: { currentStep: 'receiptSent', updatedAt: Date.now() },
//           }
//         );
//         console.log(`✅ Payment receipt saved for room ${roomId}`);
//       } catch (err) {
//         console.error(`❌ Error saving payment receipt for room ${roomId}:`, err);
//       }
//     }
//   });

//   socket.on('confirmPaymentStatus', async ({ from, to, status, roomId }) => {
//     const toSocketId = users[to];
//     const fromSocketId = users[from];

//     if (status === 'yes') {
//       const payload = {
//         from,
//         message: '✅ Payment done and your order is successfully placed',
//         status: true,
//         timestamp: new Date().toISOString(),
//       };

//       if (toSocketId) io.to(toSocketId).emit('paymentConfirmed', payload);
//       if (fromSocketId) io.to(fromSocketId).emit('paymentConfirmed', payload);

//       // Save message to MongoDB
//       const msg = {
//         senderId: from,
//         message: '✅ Payment Confirmed',
//         type: 'text',
//         timestamp: new Date(),
//       };
//       try {
//         await Conversation.findOneAndUpdate(
//           { roomId },
//           { 
//             $push: { messages: msg },
//             $set: { 
//               currentStep: 'completed', 
//               isCompleted: true, 
//               updatedAt: Date.now(),
//             },
//           }
//         );
//         console.log(`✅ Payment confirmation saved for room ${roomId}`);
//       } catch (err) {
//         console.error(`❌ Error saving payment confirmation for room ${roomId}:`, err);
//       }

//       console.log(`✅ ${from} confirmed payment with ${to}`);
//     } else {
//       if (toSocketId) {
//         io.to(toSocketId).emit('paymentDenied', {
//           from,
//           status: false,
//           message: `❌ ${from} denied your payment`,
//         });
//       }
//       if (fromSocketId) {
//         io.to(fromSocketId).emit('paymentDenied', {
//           from,
//           status: false,
//           message: '❌ You denied the payment',
//         });
//       }

//       // Save message to MongoDB
//       const msg = {
//         senderId: from,
//         message: '❌ Payment Denied',
//         type: 'text',
//         timestamp: new Date(),
//       };
//       try {
//         await Conversation.findOneAndUpdate(
//           { roomId },
//           { 
//             $push: { messages: msg },
//             $set: { currentStep: 'paymentDenied', updatedAt: Date.now() },
//           }
//         );
//         console.log(`✅ Payment denial saved for room ${roomId}`);
//       } catch (err) {
//         console.error(`❌ Error saving payment denial for room ${roomId}:`, err);
//       }

//       console.log(`❌ ${from} denied payment from ${to}`);
//     }
//   });

//   socket.on('reportPaymentConflict', async ({ from, to, orderId, roomId }) => {
//     const toSocketId = users[to];
//     const fromSocketId = users[from];

//     const conflictPayload = {
//       from: 'system',
//       orderId,
//       message: '⚠️ Payment conflict reported to admin for review',
//       timestamp: new Date().toISOString(),
//     };

//     if (toSocketId) io.to(toSocketId).emit('paymentConflictReported', conflictPayload);
//     if (fromSocketId) io.to(fromSocketId).emit('paymentConflictReported', conflictPayload);

//     // Save message to MongoDB
//     const msg = {
//       senderId: from,
//       message: '⚠️ Payment conflict reported to admin for review',
//       type: 'text',
//       timestamp: new Date(),
//     };
//     try {
//       await Conversation.findOneAndUpdate(
//         { roomId },
//         { 
//           $push: { messages: msg },
//           $set: { currentStep: 'paymentConflict', updatedAt: Date.now() },
//         }
//       );
//       console.log(`✅ Payment conflict saved for room ${roomId}`);
//     } catch (err) {
//       console.error(`❌ Error saving payment conflict for room ${roomId}:`, err);
//     }

//     console.log(`⚠️ Payment conflict reported by ${from} against ${to} for order ${orderId}`);
//   });

//   socket.on('paymentTimerExpired', async ({ from, to, orderId, roomId }) => {
//     const fromSocketId = users[from];
//     const toSocketId = users[to];

//     const timeoutPayload = {
//       from: 'system',
//       message: '⏰ Payment time expired! Please contact the seller to resolve.',
//       timestamp: new Date().toISOString(),
//     };

//     if (fromSocketId) io.to(fromSocketId).emit('paymentTimeout', timeoutPayload);
//     if (toSocketId) io.to(toSocketId).emit('paymentTimeout', timeoutPayload);

//     // Save message to MongoDB
//     const msg = {
//       senderId: 'system',
//       message: '⏰ Payment time expired! Please contact the seller to resolve.',
//       type: 'text',
//       timestamp: new Date(),
//     };
//     try {
//       await Conversation.findOneAndUpdate(
//         { roomId },
//         { 
//           $push: { messages: msg },
//           $set: { updatedAt: Date.now() },
//         }
//       );
//       console.log(`✅ Payment timeout saved for room ${roomId}`);
//     } catch (err) {
//       console.error(`❌ Error saving payment timeout for room ${roomId}:`, err);
//     }

//     console.log(`⏰ Payment timer expired for order ${orderId} between ${from} and ${to}`);
//   });

//   socket.on('disconnect', () => {
//     const user = Object.keys(users).find((u) => users[u] === socket.id);
//     if (user) {
//       delete users[user];
//       console.log(`❌ Disconnected: ${user}`);
//       for (const roomId in roomMembers) {
//         roomMembers[roomId].delete(user);
//       }
//     }
//   });
// });

// // API Endpoints for fetching chats
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



const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const Conversation = require('./conversation'); // Import the Conversation model

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
mongoose.connect('mongodb+srv://ankits45987:major@cluster0.ovdsg.mongodb.net/', {
  useNewUrlParser: true,
  
})
  .then(() => console.log('🚀 Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

const users = {};
const roomMembers = {};

io.on('connection', (socket) => {
  console.log(`✅ Connected: ${socket.id}`);

  socket.on('register', (userId) => {
    users[userId] = socket.id;
    console.log(`👤 Registered: ${userId}`);
  });

  socket.on('join_room', async ({ roomId, userId }) => {
    if (!roomMembers[roomId]) {
      roomMembers[roomId] = new Set();
    }
    if (roomMembers[roomId].has(userId)) {
      socket.emit('already_joined');
      console.log(`⚠ User ${userId} already in room ${roomId}`);
      return;
    }
    const members = roomMembers[roomId];
    if (members.size >= 2 && !members.has(userId)) {
      socket.emit('room_full', { message: '❌ Room already has 2 users' });
      console.log(`❌ ${userId} blocked from joining full room ${roomId}`);
      return;
    }

    members.add(userId);
    socket.join(roomId);
    console.log(`📥 ${userId} joined room ${roomId}`);

    // Emit conversation history if it exists
    try {
      const conversation = await Conversation.findOne({ roomId });
      if (conversation) {
        socket.emit('conversation_history', {
          messages: conversation.messages,
          currentStep: conversation.currentStep,
          isCompleted: conversation.isCompleted,
        });
      }
    } catch (err) {
      console.error(`❌ Error fetching conversation for room ${roomId}:`, err);
    }
  });

  socket.on('send_message', async ({ roomId, senderId, message, type }) => {
    const msg = { roomId, senderId, message, type, timestamp: new Date() };
    io.to(roomId).emit('receive_message', msg);
    console.log(`📤 ${senderId} to ${roomId}: ${message}`);

    // Save message to MongoDB
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

  socket.on('askAvailability', async ({ from, to, roomId, orderId }) => {
    const toSocketId = users[to];
    if (toSocketId) {
      io.to(toSocketId).emit('receiveAvailabilityRequest', { from });
      console.log(`📨 ${from} asked ${to} for availability`);

      // Save message to MongoDB
      const msg = {
        senderId: from,
        message: `Asked ${to}: Are you available?`,
        type: 'text',
        timestamp: new Date(),
      };
      try {
        await Conversation.findOneAndUpdate(
          { roomId },
          { 
            $push: { messages: msg },
            $set: { 
              currentStep: 'availabilityAsked',
              userId: from,
              peerId: to,
              orderId,
              updatedAt: Date.now(),
            },
          },
          { upsert: true }
        );
        console.log(`✅ Availability request saved for room ${roomId}`);
      } catch (err) {
        console.error(`❌ Error saving availability request for room ${roomId}:`, err);
      }
    }
  });

  socket.on('availabilityResponse', async ({ from, to, response, roomId }) => {
    const fromSocketId = users[from];
    const toSocketId = users[to];
    const responsePayload = { from, response };
    const responseText = response === 'yes' ? 'Yes, available' : 'No, not available';

    if (fromSocketId) io.to(fromSocketId).emit('receiveAvailabilityResponse', responsePayload);
    if (toSocketId) io.to(toSocketId).emit('receiveAvailabilityResponse', responsePayload);

    // Save message to MongoDB
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

  socket.on('askPaymentDetails', async ({ from, to, roomId }) => {
    const toSocketId = users[to];
    if (toSocketId) {
      io.to(toSocketId).emit('receiveAskForBankDetails', { from });
      console.log(`💰 ${from} asked ${to} for bank details`);

      // Save message to MongoDB
      const msg = {
        senderId: from,
        message: `Asked ${to} for bank details`,
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

  socket.on('sendBankDetails', async ({ from, to, bankDetails, roomId }) => {
    const toSocketId = users[to];
    if (toSocketId) {
      io.to(toSocketId).emit('receiveBankDetails', { from, bankDetails });
      io.to(toSocketId).emit('startPaymentTimer', { 
        from, 
        duration: 300,
        message: 'Complete payment within 5 minutes',
      });
      console.log(`🏦 ${from} sent bank details to ${to} - 5min timer started`);

      // Show send receipt button after 20 seconds
      setTimeout(() => {
        io.to(toSocketId).emit('showSendReceiptButton', { 
          delay: 0,
          message: 'Payment time started. Send receipt when payment is complete.',
        });
        console.log(`📱 Send receipt button shown to ${to} after 20 seconds`);
      }, 20000);

      // Save message to MongoDB
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

  socket.on('sendReceipt', async ({ from, to, roomId }) => {
    const toSocketId = users[to];
    if (toSocketId) {
      io.to(toSocketId).emit('receivePaymentReceipt', { from, message: 'Payment done' });
      console.log(`🧾 ${from} sent payment receipt to ${to}`);

      // Save message to MongoDB
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

  socket.on('confirmPaymentStatus', async ({ from, to, status, roomId }) => {
    const toSocketId = users[to];
    const fromSocketId = users[from];

    if (status === 'yes') {
      const payload = {
        from,
        message: '✅ Payment done and your order is successfully placed',
        status: true,
        timestamp: new Date().toISOString(),
      };

      if (toSocketId) io.to(toSocketId).emit('paymentConfirmed', payload);
      if (fromSocketId) io.to(fromSocketId).emit('paymentConfirmed', payload);

      // Save message to MongoDB
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

      // Save message to MongoDB
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

  socket.on('reportPaymentConflict', async ({ from, to, orderId, roomId }) => {
    const toSocketId = users[to];
    const fromSocketId = users[from];

    const conflictPayload = {
      from: 'system',
      orderId,
      message: '⚠️ Payment conflict reported to admin for review',
      timestamp: new Date().toISOString(),
    };

    if (toSocketId) io.to(toSocketId).emit('paymentConflictReported', conflictPayload);
    if (fromSocketId) io.to(fromSocketId).emit('paymentConflictReported', conflictPayload);

    // Save message to MongoDB
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

  socket.on('paymentTimerExpired', async ({ from, to, orderId, roomId }) => {
    const fromSocketId = users[from];
    const toSocketId = users[to];

    const timeoutPayload = {
      from: 'system',
      message: '⏰ Payment time expired! Please contact the seller to resolve.',
      timestamp: new Date().toISOString(),
    };

    if (fromSocketId) io.to(fromSocketId).emit('paymentTimeout', timeoutPayload);
    if (toSocketId) io.to(toSocketId).emit('paymentTimeout', timeoutPayload);

    // Save message to MongoDB
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
          $set: { updatedAt: Date.now() },
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

// API Endpoints for fetching chats
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