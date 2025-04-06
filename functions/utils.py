from google.cloud.sql.connector import Connector, IPTypes
from sqlalchemy import create_engine, text
from consts import *
from oauthlib.oauth2 import BackendApplicationClient
from requests_oauthlib import OAuth2Session
import json

# Global variables for connection pool and connector instance
connection_pool = None
global_connector = None


def init_db_connection():
    """
    Initialize the database connection using a single global Connector instance.
    """
    global connection_pool, global_connector

    # Only create the connector and connection pool once
    if connection_pool is None:
        # Create a single global Connector instance
        global_connector = Connector(refresh_strategy="LAZY")

        def _connect():
            return global_connector.connect(
                DB_INSTANCE_NAME,
                "pg8000",
                user=DB_USER,
                password=DB_PASS,
                db=DB_NAME,
                ip_type=IPTypes.PUBLIC,
            )

        connection_pool = create_engine(
            "postgresql+pg8000://",
            creator=_connect,
            pool_size=2,
            max_overflow=2,
            pool_timeout=30,
            pool_recycle=1800,
        )
    return connection_pool


def is_time_between(begin_time, end_time, current_time):
    current_time_only = current_time.time()
    if begin_time < end_time:
        return begin_time <= current_time_only <= end_time
    else:
        return current_time_only >= begin_time or current_time_only <= end_time


def write_state_to_db(
    thing_id: str,
    state: str,
    timestamp: str,
    n_on: int,
    n_off: int,
    current: int,
    table_name: str,
) -> None:
    """
    Write the state of a device to the specified table.
    """
    try:
        engine = init_db_connection()

        # Basic sanitization check: table name should be a valid identifier (alphanumeric and underscores)
        if not table_name.isidentifier():
            raise ValueError("Invalid table name provided.")

        query = f"""
            INSERT INTO {table_name} (thing_id, state, timestamp, n_on, n_off, current)
            VALUES (:thing_id, :state, :timestamp, :n_on, :n_off, :current)
        """

        with engine.connect() as conn:
            conn.execute(
                text(query),
                {
                    "thing_id": thing_id,
                    "state": state,
                    "timestamp": timestamp,
                    "n_on": n_on,
                    "n_off": n_off,
                    "current": current,
                },
            )
            conn.commit()

    except Exception as e:
        print(f"Error writing to db: {e}")
        raise


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


def fetch_state_from_db(machine: str, startTime: str, table_name: str) -> list:
    try:
        engine = init_db_connection()
        query = f"""
        SELECT state, timestamp 
        FROM {table_name} 
        WHERE thing_id = :machine AND timestamp >= :startTime
        ORDER BY timestamp
        """
        with engine.connect() as conn:
            result = conn.execute(
                text(query),
                {"machine": machine, "startTime": startTime},
            )

            # Serialize into a list of dictionaries
            return [
                {"state": row[0], "timestamp": row[1].isoformat()} for row in result
            ]
    except Exception as e:
        print(f"Error fetching from db: {e}")
        raise


def get_token():
    """
    Get the token for the Arduino Cloud API.
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
    Get the thing id for a machine from Firestore.
    """
    doc = db.collection("machines").document(machine).get()
    if doc.exists:
        data = doc.to_dict()
        return str(data.get("thingId"))
    print(f"{machine} does not have a corresponding doc in Firestore")
    return None


def addTimeStepUtil(thing_id: str, timestamp: str) -> tuple[str, float]:
    req = ManualRequest(args={"thing_id": thing_id})
    device_state = getDeviceState(req)
    if device_state and device_state.data:
        state_data = json.loads(device_state.data.decode("utf-8"))
        state = state_data.get("state")
        current = state_data.get("current")
        return state, current
    else:
        print("Device state is None")
