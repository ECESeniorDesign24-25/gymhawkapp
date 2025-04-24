from firebase_functions.params import StringParam
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(".env.gymhawk-2ed7f")

# from .env.gymhawk-2ed7f file
ARDUINO_CLIENT_ID = StringParam("ARDUINO_CLIENT_ID").value
ARDUINO_CLIENT_SECRET = StringParam("ARDUINO_CLIENT_SECRET").value
DB_NAME = os.environ.get("DB_NAME") or StringParam("DB_NAME").value
DB_USER = os.environ.get("DB_USER") or StringParam("DB_USER").value
DB_PASS = os.environ.get("DB_PASS") or StringParam("DB_PASS").value
DB_INSTANCE_NAME = (
    os.environ.get("DB_INSTANCE_NAME") or StringParam("DB_INSTANCE_NAME").value
)
EMAIL_ADDRESS = os.environ.get("SMTP_USER") or StringParam("SMTP_USER")
EMAIL_PASS = os.environ.get("SMTP_PASS") or StringParam("SMTP_PASS")

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Credentials": "true",
}

SAMPLE_TIME = 30
