const axios = require('axios');
const { getAccessToken } = require('./fcm_token_helper.js'); // We'll create this next


// Function to get the FCM ID from your API
async function getFcmToken(upbpAddress) {
  const url = 'https://login.upbpay.com/api/Login/GetFCMIDBYUpbpAddress';
  const username = 'UPBA_getById';
  const password = '7hfn894f4jUPBP';
  const basicAuth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

  const headers = {
    'Authorization': basicAuth,
    'UpbpAddress': upbpAddress,
    'Method': 'GetById'
  };

  try {
    const response = await axios.get(url, { headers });
    if (response.status === 200 && response.data && response.data.data) {
      console.log(`✅ Successfully fetched FCM token for ${upbpAddress}`);
      return response.data.data;
    } else {
      console.error(`⚠️ Could not fetch FCM token for ${upbpAddress}. Response:`, response.data);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error fetching FCM token for ${upbpAddress}:`, error.message);
    return null;
  }
}

async function sendChatMessageNotification({ recipientId, senderId, orderId, flowType, roomId, messageText }) {
    const fcmToken = await getFcmToken(recipientId);

    if (!fcmToken) {
        console.log(`[Notification] Aborting: No FCM token for recipient ${recipientId}.`);
        return;
    }

    try {
        const accessToken = await getAccessToken();
        const fcmUrl = 'https://fcm.googleapis.com/v1/projects/upbppay/messages:send'; // Use your actual project ID

        const notificationPayload = {
            message: {
                token: fcmToken,
                notification: {
                    title: `New P2P Message (Order: ${orderId})`,
                    body: messageText,
                },
                // THIS DATA IS CRUCIAL FOR THE FLUTTER APP
                data: {
                    type: "chat_message", // Consistent type for the NavigationHandler
                    roomId: roomId,        // The key for the API call on tap
                    // The rest are useful but roomId is most important
                    receiverId: recipientId,
                    senderId: senderId,
                    chat: flowType,
                    orderId: orderId,
                },
            },
        };

        await axios.post(fcmUrl, notificationPayload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
        });
        console.log(`[Notification] Successfully sent push notification to ${recipientId}`);
    } catch (error) {
        const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`[Notification] FAILED to send push notification to ${recipientId}:`, errorMsg);
    }
}

module.exports = { sendChatMessageNotification };
