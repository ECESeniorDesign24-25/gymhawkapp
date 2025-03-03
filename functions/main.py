from oauthlib.oauth2 import BackendApplicationClient
from requests_oauthlib import OAuth2Session
from firebase_functions import https_fn
from firebase_admin import initialize_app, firestore
import iot_api_client as iot
from iot_api_client.rest import ApiException
from iot_api_client.configuration import Configuration
from iot_api_client.api import ThingsV2Api, PropertiesV2Api, SeriesV2Api
from iot_api_client.models import *
from firebase_functions.params import StringParam
import os
import json
from google.cloud.sql.connector import Connector, IPTypes
import pg8000
from sqlalchemy import create_engine, text
import time 
from dotenv import load_dotenv
load_dotenv('.env.gymhawk-2ed7f') 

# set up firebase app
initialize_app()
db = firestore.client()

# from .env.gymhawk-2ed7f file
ARDUINO_CLIENT_ID = StringParam("ARDUINO_CLIENT_ID").value
ARDUINO_CLIENT_SECRET = StringParam("ARDUINO_CLIENT_SECRET").value
DB_NAME = os.environ.get("DB_NAME") or StringParam("DB_NAME").value
DB_USER = os.environ.get("DB_USER") or StringParam("DB_USER").value
DB_PASS = os.environ.get("DB_PASS") or StringParam("DB_PASS").value
DB_INSTANCE_NAME = os.environ.get("DB_INSTANCE_NAME") or StringParam("DB_INSTANCE_NAME").value

connection_pool = None


# =============================================================================
# Util functions
# =============================================================================

def init_db_connection():
    """
    Initialize the database connection
    """
    global connection_pool

    # cloud sql python connector
    connector = Connector(refresh_strategy="LAZY")

    def _connect():
        """
        Connect to the database
        """
        conn = connector.connect(
            DB_INSTANCE_NAME,
            "pg8000",
            user=DB_USER,
            password=DB_PASS,
            db=DB_NAME,
            ip_type=IPTypes.PUBLIC,
        )
        return conn

    if not connection_pool:
        connection_pool = create_engine(
            "postgresql+pg8000://",
            creator=_connect,
            pool_size=2,
            max_overflow=2,
            pool_timeout=30,
            pool_recycle=1800,
        )
    return connection_pool


def test_connection():
    try:
        engine = init_db_connection()
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("Database connection successful:", result.scalar())
        return True
    except Exception as e:
        print("Connection failed:", str(e))
        return False


def write_state_to_db(thing_id, state, timestamp):
    try:
        engine = init_db_connection()
        with engine.connect() as conn:
            conn.execute(
                text(
                    "INSERT INTO machine_states (thing_id, state, timestamp) "
                    "VALUES (:thing_id, :state, :timestamp)"
                ),
                {"thing_id": thing_id, "state": state, "timestamp": timestamp},
            )
            conn.commit()
    except Exception as e:
        print(f"Error writing to db: {e}")
        raise 


# Adapted from: https://github.com/arduino/iot-client-py/blob/master/example/main.py
def get_token():
    """
    Get the token for the arduino cloud API
    """
    oauth_client = BackendApplicationClient(client_id=ARDUINO_CLIENT_ID)
    token_url = "https://api2.arduino.cc/iot/v1/clients/token"
    oauth = OAuth2Session(client=oauth_client)
    token = oauth.fetch_token(
        token_url=token_url,
        client_id=ARDUINO_CLIENT_ID,
        client_secret=ARDUINO_CLIENT_SECRET,
        include_client_id=True,
        audience="https://api2.arduino.cc/iot",
    )
    return token.get("access_token")


def get_thing_id(machine):
    """
    Get the thing id for a machine from firestore
    """
    doc = db.collection("machines").document(machine).get()
    if doc.exists:
        data = doc.to_dict()
        return str(data.get("thingId"))
    print(f"{machine} does not have a corresponding doc in firestore")
    return None


# =============================================================================
# Cloud Functions
# =============================================================================


@https_fn.on_request()
def getDeviceState(req: https_fn.Request) -> https_fn.Response:
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204, headers=cors_headers)

    HOST = "https://api2.arduino.cc"
    token = get_token()
    client_config = Configuration(HOST)
    client_config.access_token = token
    client = iot.ApiClient(client_config)
    properties_api = PropertiesV2Api(client)

    machine = req.args.get("machine")
    thing_id = get_thing_id(machine)
    if not thing_id:
        return https_fn.Response(
            json.dumps({"error": "Machine not found"}),
            mimetype="application/json",
            status=404,
            headers=cors_headers,
        )

    property_dict = {}
    try:
        properties = properties_api.properties_v2_list(id=thing_id)
        for property in properties:
            if "Use" in property.name:
                value = property.last_value
                property_dict["state"] = "on" if value else "off" if value is not None else "unknown"
    except ApiException as e:
        return https_fn.Response(
            json.dumps({"error": str(e)}),
            mimetype="application/json",
            status=500,
            headers=cors_headers,
        )
    output = json.dumps(property_dict)
    return https_fn.Response(output, mimetype="application/json", status=200, headers=cors_headers)


# =============================================================================
# local debug
# =============================================================================

if __name__ == "__main__":

    class DummyRequest:
        def __init__(self):
            self.method = None
            self.args = {"machine": "d1Green"}

    req = DummyRequest()
    print(getDeviceState(req).data)

    test_machine = "d1Green"
    test_state = "on"
    test_timestamp = int(time.time())
    test_connection()


