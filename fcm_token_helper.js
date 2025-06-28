const { google } = require('googleapis');

const MESSAGING_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const SCOPES = [MESSAGING_SCOPE];

// Define the path to your key file.
const SERVICE_ACCOUNT_KEY_PATH = './serviceAccountKey.json';

function getAccessToken() {
  return new Promise(function(resolve, reject) {
    
    // ✅ THE FIX: Pass the file path directly into the constructor.
    // The library will handle reading and parsing the file.
    const jwtClient = new google.auth.JWT({
      keyFile: SERVICE_ACCOUNT_KEY_PATH,
      scopes: SCOPES,
    });

    jwtClient.authorize(function(err, tokens) {
      if (err) {
        console.error("FCM Auth Error:", err);
        reject(err);
        return;
      }
      resolve(tokens.access_token);
    });
  });
}

module.exports = { getAccessToken };