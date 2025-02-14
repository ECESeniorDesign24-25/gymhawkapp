const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { defineString } = require('firebase-functions/params');
const { onCall } = require("firebase-functions/v2/https");

var IotApi = require('@arduino/arduino-iot-client');
var rp = require('request-promise');

const ARDUINO_CLIENT_ID = defineString('ARDUINO_CLIENT_ID');
const ARDUINO_THING_ID = defineString("ARDUINO_THING_ID");
const ARDUINO_CLIENT_SECRET = defineString("ARDUINO_CLIENT_SECRET");

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

async function fetchArduinoProperties() {
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

exports.fetchArduinoProperties = onCall({ cors: true }, async (request) => {
  try {
    const data = await fetchArduinoProperties();
    return { data };
  } catch (error) {
    logger.error("Error:", error);
    throw new functions.https.HttpsError('internal', 'Error fetching properties');
  }
});