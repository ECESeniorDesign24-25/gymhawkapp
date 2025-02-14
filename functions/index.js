// functions/index.js

const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { defineString } = require('firebase-functions/params');
const { onCall } = require("firebase-functions/v2/https");

var IotApi = require('@arduino/arduino-iot-client');
var rp = require('request-promise');

const ARDUINO_CLIENT_ID = defineString('ARDUINO_CLIENT_ID');
const ARDUINO_THING_ID = defineString("ARDUINO_THING_ID");
const ARDUINO_CLIENT_SECRET = defineString("ARDUINO_CLIENT_SECRET");

console.log(ARDUINO_CLIENT_ID);
console.log(ARDUINO_THING_ID);
console.log(ARDUINO_CLIENT_SECRET);

logger.info("Arduino config:", {
  client_id: ARDUINO_CLIENT_ID,
  thing_id: ARDUINO_THING_ID,
});

if (!ARDUINO_CLIENT_ID || !ARDUINO_CLIENT_SECRET || !ARDUINO_THING_ID) {
  logger.error("Missing required Arduino environment variables. Ensure ARDUINO_CLIENT_ID, ARDUINO_CLIENT_SECRET, and ARDUINO_THING_ID are set.");
}

async function getToken() {
    const options = {
        method: 'POST',
        url: 'https://api2.arduino.cc/iot/v1/clients/token',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        json: true,
        form: {
            grant_type: 'client_credentials',
            client_id: ARDUINO_CLIENT_ID,
            client_secret: ARDUINO_CLIENT_SECRET,
            audience: 'https://api2.arduino.cc/iot'
        }
    };

    try {
        const response = await rp(options);
        return response['access_token'];
    } catch (error) {
        logger.error("Failed getting an access token:", error);
        throw error;
    }
}

async function listProperties() {
  const client = IotApi.ApiClient.instance;
  const oauth2 = client.authentications['oauth2'];
  oauth2.accessToken = await getToken();

  const api = new IotApi.PropertiesV2Api(client);
  const id = ARDUINO_CLIENT_ID;

  const opts = { 'showDeleted': false };

  try {
    const data = await api.propertiesV2List(id, opts);
    return data;
  } catch (error) {
    logger.error("Error in listProperties:", error);
    throw error;
  }
}

exports.listProperties = onRequest({ timeoutSeconds: 60 }, async (req, res) => {
  // Set CORS headers for every response
  res.set('Access-Control-Allow-Origin', '*'); // or 'http://localhost:3000'
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const data = await listProperties();
    res.status(200).json(data);
  } catch (error) {
    // Ensure error responses also include CORS headers
    res.status(500).json({ error: "Error fetching properties" });
  }
});

exports.getGreeting = onCall(
  { cors: [/firebase\.com$/, "*"] },
  (request) => {
    return "Hello, world!";
  }
);