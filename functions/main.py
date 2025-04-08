from datetime import datetime, timezone, time, timedelta
import time as t
import json
from firebase_functions import https_fn, scheduler_fn
from firebase_admin import initialize_app, firestore
import iot_api_client as iot
from iot_api_client.rest import ApiException
from iot_api_client.configuration import Configuration
from iot_api_client.api import PropertiesV2Api
from iot_api_client.models import *
from google.cloud.sql.connector import Connector, IPTypes
from sqlalchemy import create_engine, text
from oauthlib.oauth2 import BackendApplicationClient
from requests_oauthlib import OAuth2Session
from utils import *
from consts import *
from collections import defaultdict
    
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
        INSERT INTO {table_name} ({', '.join(params.keys())})
        VALUES ({', '.join([f":{key}" for key in params.keys()])})
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
        "name": str
    }

    for key, value in params.items():
        if key in types and value is not None:
            try:
                params[key] = types[key](value)
            except (ValueError, TypeError):
                print(f"Warning: Could not convert {key} value {value} to {types[key].__name__}")
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


def fetch_timeseries_from_db(machine: str, startTime: str, variable: str, table_name: str) -> list:
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


def getDeviceParamFromIoTCloud(thing_id: str, property_name: str) -> float:
    try:
        # config iot
        host = "https://api2.arduino.cc"
        client_config = Configuration(host)
        client_config.access_token = get_token()
        client = iot.ApiClient(client_config)
        properties_api = PropertiesV2Api(client)

        # avoid too many api calls
        t.sleep(1)
        properties = properties_api.properties_v2_list(id=thing_id)
        for property in properties:
            if property.name == property_name:
                return property.last_value
        print(f"[{thing_id}] No matching property found for {property_name}")
        return None
    except ApiException as e:
        # rate limit hit, recurse until it works lol
        if e.status == 429:
            t.sleep(2)
            return getDeviceParamFromIoTCloud(thing_id, property_name)
        print(f"API Exception for {thing_id}: {str(e)}")
        return None


def getCurrentValues(params: dict, thing_id: str) -> tuple[str, float]:
    # Create a fresh dictionary for this iteration
    current_values = {}
    
    # First copy all the static values (type, name, etc.)
    for key, value in params.items():
        if key in ['type', 'name', 'thing_id']:
            current_values[key] = value
    
    # Then get current values for IoT properties
    for key, property_name in params.items():
        if key not in ['type', 'name', 'thing_id']:
            # Get the current value from IoT Cloud
            new_value = getDeviceParamFromIoTCloud(thing_id, property_name)
            # Only use the original property name if we got None from IoT Cloud
            current_values[key] = new_value
    
    fix_param_types(current_values)
    print(f"Current values for {thing_id}: ", current_values)
    return current_values


def normalizeState(state: str) -> str:
    if state == "True" or state == True:
        return "on"
    elif state == "False" or state == False:
        return "off"
    return state

# =============================================================================
# Cloud Functions
# =============================================================================

@https_fn.on_request()
def getDeviceState(req: https_fn.Request) -> https_fn.Response:
    print("getDeviceState called with args:", req.args)
    if req.method == "OPTIONS":
        print("Handling OPTIONS request")
        return https_fn.Response("", status=204, headers=CORS_HEADERS)

    thing_id = req.args.get("thing_id")
    variable = req.args.get("variable", "state")
    print(f"Processing request for thing_id: {thing_id}, variable: {variable}")
    
    if not thing_id:
        print("No thing_id provided")
        return https_fn.Response(
            json.dumps({"error": "Thing ID not found"}),
            mimetype="application/json",
            status=404,
            headers=CORS_HEADERS,
        )
    try:
        # need to find the iot property name from the variable name
        print(f"Fetching params for thing_id: {thing_id}")
        params = fetch_params(thing_id)
        print(f"Params fetched: {params}")
        
        if variable not in params:
            print(f"Variable {variable} not found in params")
            return https_fn.Response(
                json.dumps({"error": f"Variable {variable} not found"}),
                mimetype="application/json",
                status=404,
                headers=CORS_HEADERS,
            )
            
        property_name = params[variable]
        print(f"Getting device param for property: {property_name}")
        property_dict = getDeviceParamFromIoTCloud(thing_id, property_name)
        print(f"Device param result: {property_dict}")
        
        response_data = {variable: property_dict}
        if variable == "state":
            response_data[variable] = normalizeState(response_data[variable])
        output = json.dumps(response_data)
        print(f"Sending response: {output}")
        return https_fn.Response(
            output, mimetype="application/json", status=200, headers=CORS_HEADERS
        )
    except ApiException as e:
        print(f"API Exception: {str(e)}")
        return https_fn.Response(
            json.dumps({"error": str(e)}),
            mimetype="application/json",
            status=500,
            headers=CORS_HEADERS,
        )
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return https_fn.Response(
            json.dumps({"error": str(e)}),
            mimetype="application/json",
            status=500,
            headers=CORS_HEADERS,
        )


# cron job to add a time step to the database for each machine every 2 minutes
@scheduler_fn.on_schedule(schedule="*/2 * * * *")
def addTimeStep(event: scheduler_fn.ScheduledEvent = None) -> None:
    try:
        current_time = datetime.now(timezone.utc)
        central_time = current_time.astimezone(timezone(timedelta(hours=-5)))
        timestamp = central_time.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'

        init_db_connection()

        # thing ids from firebase
        thing_ids = db.collection("thing_ids").list_documents()
        thing_ids = [thing_id.id for thing_id in thing_ids]

        # Store original params (these contain the IoT property names to look up)
        original_params = {thing_id: fetch_params(thing_id) for thing_id in thing_ids}

        state_counts = {}
        max_values = {} 

        # sample until 1:00 minutes have passed
        start = t.time()
        n = 1
        while t.time() - start <90:
            for thing_id in thing_ids:
                try:    
                    thing_id_params = original_params[thing_id]

                    # Get fresh current values for each IoT property
                    current_values = getCurrentValues(thing_id_params, thing_id)

                    # print(f"\n{t.time() - start}s | Current IoT values for {thing_id}: ", current_values)
                    # take mode of each string param, max of each float param
                    state_counts[thing_id] = {param: {} for param in current_values}
                    max_values[thing_id] = {param: 0 for param in current_values}  

                    for param in current_values:
                        value = current_values[param]
                        
                        # if the param is a float track the value with largest magnitude
                        if isinstance(value, float):
                            if param not in max_values[thing_id]:
                                max_values[thing_id][param] = value
                            elif abs(value) > abs(max_values[thing_id][param]):
                                max_values[thing_id][param] = value
                        else:
                            # if the param is a string count the number of times it appears
                            value_str = str(value)
                            if value_str not in state_counts[thing_id][param]:
                                state_counts[thing_id][param][value_str] = 0
                            state_counts[thing_id][param][value_str] += 1

                except Exception as e:
                    print(f"Error polling thing_id {thing_id}: {str(e)}")
            t.sleep(1)


        # get most common value for each param
        derived_values = {}
        for thing_id in thing_ids:
            derived_values[thing_id] = {}
            derived_values[thing_id]['timestamp'] = timestamp
            derived_values[thing_id]['thing_id'] = thing_id

            # add most common value for each string param
            for param in state_counts[thing_id]:
                if state_counts[thing_id][param]:
                    derived_values[thing_id][param] = max(state_counts[thing_id][param].items(), key=lambda x: x[1])[0]

                    # Convert state to "on"/"off" string
                    if param == "state":
                        derived_values[thing_id][param] = normalizeState(derived_values[thing_id][param])

            # add max value for each float param
            for param in max_values[thing_id]:
                # skip parameters that should be strings
                if param not in ['state', 'type', 'name']:
                    derived_values[thing_id][param] = max_values[thing_id][param]

        # write the most params for each machine
        for thing_id in thing_ids:
            print(f"\nWriting derived values for {thing_id}: ", derived_values[thing_id])
            write_state_to_db(derived_values[thing_id], table_name="machine_states")
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
    manReq = ManualRequest(args={"thing_id": "0a73bf83-27de-4d93-b2a0-f23cbe2ba2a8", "state": "lat"})
    print(getDeviceState(manReq).json)
