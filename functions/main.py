from datetime import datetime, timezone, time, timedelta
import time as t
import json
from firebase_functions import https_fn, scheduler_fn
from firebase_admin import initialize_app, firestore
import iot_api_client as iot
from iot_api_client.rest import ApiException
from iot_api_client.configuration import Configuration
from iot_api_client.api import PropertiesV2Api, DevicesV2Api
from iot_api_client.models import *
from google.cloud.sql.connector import Connector, IPTypes
from sqlalchemy import create_engine, text
from oauthlib.oauth2 import BackendApplicationClient
from requests_oauthlib import OAuth2Session
from consts import *
import statistics

# set up firebase app
initialize_app()
db = firestore.client()


class ManualRequest:
    def __init__(self, args):
        self.method = None
        self.args = args


connection_pool = None
global_connector = None


# =============================================================================
# Utilities
# =============================================================================
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


def build_query_from_params(params: dict, table_name: str) -> str:
    params = fix_param_types(params)
    query = f"""
        INSERT INTO {table_name} ({", ".join(params.keys())})
        VALUES ({", ".join([f":{key}" for key in params.keys()])})
    """
    return query


def fix_param_types(params: dict) -> dict:
    types = {
        "thing_id": str,
        "state": str,
        "timestamp": str,
        "analogOffset": float,
        "alt": float,
        "lat": float,
        "long": float,
        "rate": float,
        "sampleNumber": int,
        "smoothingFactor": float,
        "smoothedrmsCurrent": float,
        "threshold": float,
        "type": str,
        "name": str,
    }

    for key, value in params.items():
        if key in types and value is not None:
            try:
                params[key] = types[key](value)
            except (ValueError, TypeError):
                print(
                    f"Warning: Could not convert {key} value {value} to {types[key].__name__}"
                )
                continue

    return params


def write_state_to_db(params: dict, table_name: str) -> None:
    """
    Write the state of a device to the specified table.
    """
    try:
        engine = init_db_connection()
        query = build_query_from_params(params, table_name)

        with engine.connect() as conn:
            conn.execute(text(query), params)
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


def fetch_timeseries_from_db(
    machine: str, startTime: str, variable: str, table_name: str
) -> list:
    try:
        engine = init_db_connection()
        query = f"""
        SELECT {variable}, timestamp 
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
                {variable: row[0], "timestamp": row[1].isoformat()} for row in result
            ]
    except Exception as e:
        print(f"Error fetching from db: {e}")
        raise


def fetchMostRecentVarFromDb(thing_id: str, variable: str, table_name: str) -> str:
    try:
        engine = init_db_connection()
        query = f"""
        SELECT {variable}, timestamp 
        FROM {table_name} 
        WHERE thing_id = :machine
        ORDER BY timestamp DESC
        LIMIT 1
        """
        with engine.connect() as conn:
            result = conn.execute(
                text(query),
                {"machine": thing_id},
            )

            # Serialize into a list of dictionaries
            return [
                {variable: row[0], "timestamp": row[1].isoformat()} for row in result
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


def getTimeseries(req: https_fn.Request, table_name: str) -> https_fn.Response:
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204, headers=CORS_HEADERS)

    thing_id = req.args.get("thing_id")
    startTime = req.args.get("startTime")
    variable = req.args.get("variable")
    if not thing_id:
        return https_fn.Response(
            json.dumps({"error": "Thing ID not found"}),
            mimetype="application/json",
            status=404,
            headers=CORS_HEADERS,
        )
    try:
        timeseries = fetch_timeseries_from_db(thing_id, startTime, variable, table_name)
        return https_fn.Response(
            json.dumps(timeseries),
            mimetype="application/json",
            status=200,
            headers=CORS_HEADERS,
        )
    except Exception as e:
        print(f"Error fetching timeseries: {str(e)}")
        return https_fn.Response(
            json.dumps({"error": f"Database error: {str(e)}"}),
            mimetype="application/json",
            status=500,
            headers=CORS_HEADERS,
        )


def fetch_params(thing_id: str) -> dict:
    doc = db.collection("thing_ids").document(thing_id).get()

    if doc.exists:
        data = doc.to_dict()
        return data
    else:
        print(f"Thing ID {thing_id} does not exist in Firestore")
        return None


def getDeviceParamFromIoTCloud(
    thing_id: str, property_name: str, property_list: list
) -> float:
    try:
        for property in property_list:
            if property.name == property_name:
                return property.last_value
        return None
    except ApiException as e:  # rate limit hit
        if e.status == 429:
            t.sleep(1)
            return getDeviceParamFromIoTCloud(thing_id, property_name, property_list)
        print(f"API Exception for {thing_id}: {str(e)}")
        raise


def getDeviceStatus(thing_id: str, devices_list: list) -> str:
    for device in devices_list:
        if device.thing and device.thing.id == thing_id:
            return device.device_status

    return "UNKNOWN"


def getCurrentValues(
    params: dict, thing_id: str, property_list: list
) -> tuple[str, float]:
    # Create a fresh dictionary for this iteration
    current_values = {}

    # First copy all the static values (type, name, etc.)
    for key, value in params.items():
        if key in ["type", "name", "thing_id"]:
            current_values[key] = value

    # Then get current values for IoT properties
    for key, property_name in params.items():
        if key not in ["type", "name", "thing_id"]:
            # Get the current value from IoT Cloud
            new_value = getDeviceParamFromIoTCloud(
                thing_id, property_name, property_list
            )
            # Only use the original property name if we got None from IoT Cloud
            current_values[key] = new_value

    fix_param_types(current_values)
    return current_values


def normalizeState(state: str) -> str:
    if state == "True" or state == True:
        return "on"
    elif state == "False" or state == False:
        return "off"
    return state


def getPropertyListForThingId(thing_id: str, properties_api: PropertiesV2Api) -> list:
    try:
        properties = properties_api.properties_v2_list(id=thing_id)
        return properties
    except ApiException as e:
        if e.status == 429:  # rate limit hit
            t.sleep(1)
            return getPropertyListForThingId(thing_id, properties_api)
        raise


def initIoTAPI():
    try:
        # config iot
        host = "https://api2.arduino.cc"
        client_config = Configuration(host)
        client_config.access_token = get_token()
        client = iot.ApiClient(client_config)
        properties_api = PropertiesV2Api(client)
        devices_api = DevicesV2Api(client)
        devices = devices_api.devices_v2_list()
        return properties_api, devices
    except ApiException as e:  # rate limit hit
        t.sleep(1)
        return initIoTAPI()


# =============================================================================
# Cloud Functions
# =============================================================================
@https_fn.on_request()
def getDeviceState(req: https_fn.Request) -> https_fn.Response:
    if req.method == "OPTIONS":
        print("Handling OPTIONS request")
        return https_fn.Response("", status=204, headers=CORS_HEADERS)

    thing_id = req.args.get("thing_id")
    variable = req.args.get("variable")

    # get most recent db entry for the variable and thing id
    db_entry = fetchMostRecentVarFromDb(thing_id, variable, "machine_states")
    return https_fn.Response(json.dumps(db_entry), status=200, headers=CORS_HEADERS)


# cron job to add a time step to the database for each machine every 1 minute
@scheduler_fn.on_schedule(schedule="*/1 * * * *")
def addTimeStep(event: scheduler_fn.ScheduledEvent = None) -> None:
    try:
        start = t.time()
        current_time = datetime.now(timezone.utc)
        central_time = current_time.astimezone(timezone(timedelta(hours=-5)))
        timestamp = central_time.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

        init_db_connection()

        # thing ids from firebase
        thing_ids = db.collection("thing_ids").list_documents()
        thing_ids = [thing_id.id for thing_id in thing_ids]

        # init iot api
        properties_api, devices = initIoTAPI()

        # store original params (these contain the IoT property names to look up)
        original_params = {thing_id: fetch_params(thing_id) for thing_id in thing_ids}
        max_values = {}
        value_counts = {}
        on_off_dict = {}
        n = 0

        # these are string params that we want to count the number of times they appear instead of mode value
        string_params = [
            "state",
            "machineName",
            "device_status",
            "name",
            "thing_id",
            "type",
        ]

        def takeSample(thing_id: str, thing_id_params: dict, property_list: list):
            """
            This function takes a single sample of every parameter defined in IoT Cloud for a given thing_id (device)
            """
            try:
                current_values = getCurrentValues(
                    thing_id_params, thing_id, property_list
                )
            except ApiException as e:  # rate limit hit
                t.sleep(1)
                return takeSample(thing_id, thing_id_params, property_list)
            except Exception as e:  # other error
                return None
            return current_values

        while t.time() - start < SAMPLE_TIME:
            for thing_id in thing_ids:
                # get params to sample
                thing_id_params = original_params[thing_id]

                # initialize counts and values if this is first sample
                if thing_id not in value_counts:
                    value_counts[thing_id] = {}
                    max_values[thing_id] = {}

                    value_counts[thing_id] = {
                        param: {} for param in thing_id_params.keys()
                    }
                    max_values[thing_id] = {
                        param: 0 for param in thing_id_params.keys()
                    }

                    # this is for testing but track in db for now
                    on_off_dict[thing_id] = {
                        param: {"on": 0, "off": 0} for param in thing_id_params.keys()
                    }

                # get parameters and corresponding IoT thing properties
                property_list = getPropertyListForThingId(thing_id, properties_api)

                # take sample
                sample_values = takeSample(thing_id, thing_id_params, property_list)
                if sample_values is None:
                    continue

                for param, value in sample_values.items():
                    # for testing
                    if param == "state":
                        # NOTE: State is encoded as a string when reading from IoT Cloud api
                        if value == "True":
                            on_off_dict[thing_id][param]["on"] += 1
                        else:
                            on_off_dict[thing_id][param]["off"] += 1

                    # if the param is a float track the value with largest magnitude
                    if isinstance(value, float):
                        if param not in max_values[thing_id]:
                            max_values[thing_id][param] = value
                        elif abs(value) > abs(max_values[thing_id][param]):
                            max_values[thing_id][param] = value
                    else:
                        # if the param is a string count the number of times it appears
                        value_str = str(value)
                        if value_str not in value_counts[thing_id][param]:
                            value_counts[thing_id][param][value_str] = 0
                        value_counts[thing_id][param][value_str] += 1
            n += 1

        def getValueToWrite(param: str, value_dict: dict) -> str:
            """
            This function determines the value to write to the database for a given parameter.
            """
            # if param is state, we check to see if any of the samples are True.
            # If so, the state is written as "on". Otherwise it is written as "off". THIS WILL BE OVERWRITTEN BY N_ON AND N_OFF FOR TESTING
            if param == "state":
                if "True" in value_dict[param]:
                    return "on"
                else:
                    return "off"
            # if the param is a string, we take the most common occuring value
            elif param in string_params:
                return statistics.mode(value_dict[param].items())[0]
            # For all other parameters, we take the most max magnitude
            else:
                if param not in value_dict:
                    return None
                return value_dict[param]

        values_to_write = {}
        for thing_id in thing_ids:
            values_to_write[thing_id] = {}

            # these are constants for each machine, irrelevant of sampling so just hard coded
            values_to_write[thing_id]["timestamp"] = timestamp
            values_to_write[thing_id]["thing_id"] = thing_id
            values_to_write[thing_id]["machineName"] = (
                db.collection("thing_ids").document(thing_id).get().to_dict()["name"]
            )

            device_status = getDeviceStatus(thing_id, devices)
            values_to_write[thing_id]["device_status"] = device_status

            # for testing but we will write n_on and n_off for each time step to check thresholds.
            values_to_write[thing_id]["n_on"] = on_off_dict[thing_id]["state"]["on"]
            values_to_write[thing_id]["n_off"] = on_off_dict[thing_id]["state"]["off"]

            # if state is on at least once, then it is set to on
            if values_to_write[thing_id]["n_on"] > 0:
                values_to_write[thing_id]["state"] = "on"
            else:
                values_to_write[thing_id]["state"] = "off"

            # get value to write for each parameter
            for param in sample_values:
                if param not in string_params:
                    values_to_write[thing_id][param] = getValueToWrite(
                        param, max_values[thing_id]
                    )
                else:
                    values_to_write[thing_id][param] = getValueToWrite(
                        param, value_counts[thing_id]
                    )

            # overwrite if device is offline => automatically set to off
            if device_status == "OFFLINE":
                values_to_write[thing_id]["state"] = "off"

        # write the most params for each machine
        for thing_id in thing_ids:
            write_state_to_db(values_to_write[thing_id], table_name="machine_states")
        print(f"Time step added to database in {t.time() - start} seconds")
    except Exception as e:
        print(f"Error in addTimeStep: {str(e)}")
        raise


@https_fn.on_request()
def getStateTimeseries(req: https_fn.Request) -> https_fn.Response:
    return getTimeseries(req, "machine_states")


@https_fn.on_request()
def getStateTimeseriesDummy(req: https_fn.Request) -> https_fn.Response:
    return getTimeseries(req, "machine_states_dummy")


if __name__ == "__main__":
    # manReq = ManualRequest(args={"thing_id": "0a73bf83-27de-4d93-b2a0-f23cbe2ba2a8", "variable": "state"})
    # manReq2 = ManualRequest(args={"thing_id": "c7996422-9462-4fa7-8d02-bfe8c7aba7e4", "variable": "state"})
    # manReq3 = ManualRequest(args={"thing_id": "6ad4d9f7-8444-4595-bf0b-5fb62c36430c", "variable": "state"})
    # # addTimeStep()

    # print("================================================")
    # print(getDeviceStatus(thing_id="0a73bf83-27de-4d93-b2a0-f23cbe2ba2a8"))
    # print(getDeviceStatus(thing_id="c7996422-9462-4fa7-8d02-bfe8c7aba7e4"))
    # print(getDeviceStatus(thing_id="6ad4d9f7-8444-4595-bf0b-5fb62c36430c"))
    # print("================================================")

    addTimeStep()
