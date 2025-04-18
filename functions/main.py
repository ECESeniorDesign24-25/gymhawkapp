from datetime import datetime, timezone, time, timedelta
import time as t
import json
import os
from firebase_functions import https_fn, scheduler_fn
from firebase_admin import initialize_app, firestore, credentials
from firebase_admin import initialize_app, firestore
from flask import jsonify
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
import pandas as pd
from model import RandomForestModel
import smtplib
from email.message import EmailMessage
import requests

# set up firebase app
# cred_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
# if cred_path and os.path.exists(cred_path):
#     cred = credentials.Certificate(cred_path)
#     initialize_app(cred)
# else:
#     initialize_app()
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
        "rms": float,
        "floor": int,
    }

    for key, value in params.items():
        if key in types and value is not None:
            try:
                params[key] = types[key](value)
            except (ValueError, TypeError):
                print(
                    f"Warning: Could not convert {key} value {value} to {types[key].__name__}"
                )
                params[key] = None

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
    machine: str, start_time: str, variable: str, table_name: str
) -> list:
    try:
        engine = init_db_connection()
        query = f"""
        SELECT {variable}, timestamp, device_status
        FROM {table_name} 
        WHERE thing_id = :machine AND timestamp >= :startTime
        ORDER BY timestamp
        """
        with engine.connect() as conn:
            result = conn.execute(
                text(query),
                {"machine": machine, "startTime": start_time},
            )

            # Serialize into a list of dictionaries
            return [
                {variable: row[0], "timestamp": row[1].isoformat(), "status": row[2]}
                for row in result
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


def getTimeseries(
    thing_id: str, start_time: str, variable: str, table_name: str = "machine_states"
) -> dict:
    try:
        timeseries = fetch_timeseries_from_db(
            thing_id, start_time, variable, table_name
        )
        return json.dumps(timeseries)
    except Exception as e:
        print(f"Error fetching timeseries: {str(e)}")
        return json.dumps([])


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


def getCurrentValues(params: dict, thing_id: str, property_list: list) -> dict:
    current_values = {}

    for key, property_name in params.items():
        if key in ["type", "name", "thing_id"]:
            current_values[key] = property_name
        else:
            new_value = getDeviceParamFromIoTCloud(
                thing_id, property_name, property_list
            )
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


def get_machine_states_df() -> pd.DataFrame:
    try:
        # connect to db
        engine = init_db_connection()

        # we only want to train on data where the device is online
        query = """
            SELECT thing_id, state, timestamp FROM machine_states 
            WHERE device_status = 'ONLINE'
            ORDER BY timestamp
        """

        # read table into pandas df
        with engine.connect() as conn:
            df = pd.read_sql(query, conn)
            return df

    except Exception as e:
        print(f"Error reading machine_states to DataFrame: {e}")
        raise


def peakHoursHelper(
    thing_id: str,
    date: str,
    start_time: pd.Timestamp,
    end_time: pd.Timestamp,
    peak: bool = True,
) -> list:
    model = RandomForestModel(load_model=True)

    try:
        df = generate_prediction_data(thing_id, start_time, end_time)
        return model.predict_hours(df, date, start_time, end_time, peak)
    except Exception as e:
        print(f"No valid data for {thing_id} on {date} from {start_time} to {end_time}")
        return []

def retrieve(field, snapshot):
    return next(iter(snapshot[field].values()))


def send_email(to_addr: str, machine_name: str):
    msg = EmailMessage()
    msg["Subject"] = f"{machine_name} is now available!"
    msg["From"]    = f"GymHawks <{EMAIL_ADDRESS}>"
    msg["To"]      = to_addr
    msg.set_content(
        f"The {machine_name} you’ve been waiting for is free.\n\n"
        "We can’t guarantee it will still be free when you arrive 🏋️‍♂️"
    )
    msg.add_alternative(
        f"""
        <p>The <strong>{machine_name}</strong> you’ve been waiting for is now
        <span style="color:green">available</span>. See you there 🏋️‍♂️</p>
        """,
        subtype="html",
    )

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(EMAIL_ADDRESS, EMAIL_PASS)
        smtp.send_message(msg)


def getLastLat(thing_id: str) -> float:
    try:
        engine = init_db_connection()
        query = """
            SELECT lat FROM machine_states WHERE thing_id = :thing_id AND lat IS NOT NULL and lat != 0 ORDER BY timestamp DESC LIMIT 1
        """
        with engine.connect() as conn:
            result = conn.execute(text(query), {"thing_id": thing_id})
            return result.scalar()
    except Exception as e:
        print(f"Error fetching last lat for {thing_id}: {e}")
        return None


def getLastLong(thing_id: str) -> float:
    try:
        engine = init_db_connection()
        query = """
            SELECT long FROM machine_states WHERE thing_id = :thing_id AND long IS NOT NULL and long != 0 ORDER BY timestamp DESC LIMIT 1
        """
        with engine.connect() as conn:
            result = conn.execute(text(query), {"thing_id": thing_id})
            return result.scalar()
    except Exception as e:
        print(f"Error fetching last long for {thing_id}: {e}")
        return None


def generate_prediction_data(
    thing_id: str, start_time: str, end_time: str
) -> pd.DataFrame:
    start_time = pd.to_datetime(pd.Timestamp(start_time))
    end_time = pd.to_datetime(pd.Timestamp(end_time))

    # round to nearest 30min interval
    start_time = start_time.floor("30min")
    end_time = end_time.floor("30min")
    start_time = start_time.replace(minute=0 if start_time.minute < 30 else 30)
    end_time = end_time.replace(minute=0 if end_time.minute < 30 else 30)

    timestamps = pd.date_range(start=start_time, end=end_time, freq="30min")
    return pd.DataFrame({"thing_id": thing_id, "timestamp": timestamps})


def getLastUsedTimeHelper(thing_id: str) -> str:
    try:
        engine = init_db_connection()
        query = """
            SELECT timestamp FROM machine_states WHERE thing_id = :thing_id AND state = 'on' ORDER BY timestamp DESC LIMIT 1
        """

        with engine.connect() as conn:
            result = conn.execute(text(query), {"thing_id": thing_id})

            # convert to human readable format
            return result.scalar().strftime("%Y-%m-%d %H:%M")
    except Exception as e:
        print(f"Error fetching last used time for {thing_id}: {e}")
        return None


def addTimeStepUtil() -> None:
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

            # make sure we didnt miss any
            for param in max_values[thing_id]:
                if (
                    param not in values_to_write[thing_id]
                    and max_values[thing_id][param] is not None
                    and max_values[thing_id][param] != 0
                ):
                    values_to_write[thing_id][param] = max_values[thing_id][param]

            for param in value_counts[thing_id]:
                if (
                    param not in values_to_write[thing_id]
                    and value_counts[thing_id][param] is not None
                    and value_counts[thing_id][param] != 0
                ):
                    values_to_write[thing_id][param] = value_counts[thing_id][param]

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


def getTotalUsageUtil(thing_id: str) -> int:
    try:
        engine = init_db_connection()
        query = """
            SELECT (COUNT(*)::float / 60)::float AS hours_used
            FROM machine_states
            WHERE thing_id = :thing_id
            AND device_status = 'ONLINE'
            AND state = 'on'
        """
        with engine.connect() as conn:
            result = conn.execute(text(query), {"thing_id": thing_id})
            value = result.scalar()

            # Ensure we have a clean float value without % character
            if value is not None:
                if isinstance(value, str) and "%" in value:
                    value = float(value.replace("%", ""))
            return value
    except Exception as e:
        print(f"Error in getTotalUsage: {str(e)}")
        return 0


def getDailyUsageUtil(thing_id: str, date: str) -> int:
    try:
        engine = init_db_connection()

        # Parse the date and calculate end date in Python
        from datetime import datetime, timedelta

        start_date = date

        # Convert to datetime, add 1 day, and convert back to string
        date_obj = datetime.strptime(date, "%Y-%m-%d")
        end_date_obj = date_obj + timedelta(days=1)
        end_date = end_date_obj.strftime("%Y-%m-%d")

        # Use SQLAlchemy text() with named parameters
        query = """
            SELECT (COUNT(*)::float / 60)::float AS hours_used
            FROM machine_states
            WHERE thing_id = :thing_id
            AND device_status = 'ONLINE'
            AND state = 'on'
            AND timestamp >= TO_TIMESTAMP(:start_date, 'YYYY-MM-DD')
            AND timestamp < TO_TIMESTAMP(:end_date, 'YYYY-MM-DD');
        """

        with engine.connect() as conn:
            result = conn.execute(
                text(query),
                {"thing_id": thing_id, "start_date": start_date, "end_date": end_date},
            )
            value = result.scalar()

            # Ensure we have a clean float value without % character
            if value is not None:
                if isinstance(value, str) and "%" in value:
                    value = float(value.replace("%", ""))
            return value
    except Exception as e:
        print(f"Error in getDailyUsage: {str(e)}")
        return 0


def setSleepModeForThing(thing_id: str, sleep_value: bool):
    try:
        properties_api, devices = initIoTAPI()
        properties = properties_api.properties_v2_list(id=thing_id)
        sleep_property_id = None
        for prop in properties:
            if prop.name == "sleep":
                sleep_property_id = prop.id
                break
        if sleep_property_id:
            property_value = {"value": sleep_value}
            print(
                f"Setting sleep mode to {sleep_value} for {thing_id} to {sleep_value}"
            )
            properties_api.properties_v2_publish(
                thing_id, sleep_property_id, property_value
            )
    except ApiException as e:
        t.sleep(1)
        setSleepModeForThing(thing_id, sleep_value)
    except Exception as e:
        print(f"Error setting sleep mode for {thing_id}: {e}")
        raise

def send_email(to_addr: str, machine_name: str):
    msg = EmailMessage()
    msg["Subject"] = f"{machine_name} is now available!"
    msg["From"]    = f"GymHawks <{EMAIL_ADDRESS}>"
    msg["To"]      = to_addr
    msg.set_content(
        f"The {machine_name} you’ve been waiting for is free.\n\n"
        "We can’t guarantee it will still be free when you arrive 🏋️‍♂️"
    )
    msg.add_alternative(
        f"""
        <p>The <strong>{machine_name}</strong> you’ve been waiting for is now
        <span style="color:green">available</span>. See you there 🏋️‍♂️</p>
        """,
        subtype="html",
    )

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(EMAIL_ADDRESS, EMAIL_PASS)
        smtp.send_message(msg)


def getDailyPercentagesUtil(thing_id: str) -> list:
    try:
        engine = init_db_connection()
        query = """
            SELECT
                thing_id,
                EXTRACT(ISODOW FROM timestamp)::int AS day_number,
                TO_CHAR(timestamp, 'FMDay') AS day_name,
                (COUNT(*)::float / (60 * 24) * 100) AS percent_in_use
            FROM machine_states
            WHERE
                thing_id = :thing_id
                AND state = 'on'
                AND device_status = 'ONLINE'
            GROUP BY
                thing_id,
                day_number,
                day_name
            ORDER BY
                day_number;
        """
        with engine.connect() as conn:
            result = conn.execute(text(query), {"thing_id": thing_id})
            return [list(row) for row in result.fetchall()]
    except Exception as e:
        print(f"Error in getDailyPercentages: {str(e)}")
        return []


def getHourlyPercentagesUtil(thing_id: str) -> list:
    try:
        engine = init_db_connection()
        query = """
            SELECT
                thing_id,
                EXTRACT(HOUR FROM timestamp)::int AS hour_number,
                (COUNT(*)::float / (60 * 60) * 100) AS percent_in_use
            FROM machine_states
            WHERE
                thing_id = :thing_id
                AND state = 'on'
                AND device_status = 'ONLINE'
            GROUP BY
                thing_id,
                hour_number
            ORDER BY
                hour_number;
        """
        with engine.connect() as conn:
            result = conn.execute(text(query), {"thing_id": thing_id})
            return [list(row) for row in result.fetchall()]
    except Exception as e:
        print(f"Error in getHourlyPercentages: {str(e)}")
        return []


# =============================================================================
# Cloud Functions
# =============================================================================
@https_fn.on_request()
def getDeviceState(req: https_fn.Request) -> https_fn.Response:
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204, headers=CORS_HEADERS)

    thing_id = req.args.get("thing_id")
    variable = req.args.get("variable")

    # get most recent db entry for the variable and thing id
    db_entry = fetchMostRecentVarFromDb(thing_id, variable, "machine_states")
    return https_fn.Response(json.dumps(db_entry), status=200, headers=CORS_HEADERS)


# cron job to add a time step to the database for each machine every 1 minute
@scheduler_fn.on_schedule(schedule="*/1 * * * *")
def addTimeStep(event: scheduler_fn.ScheduledEvent = None) -> None:
    addTimeStepUtil()


@https_fn.on_request()
def getStateTimeseries(req: https_fn.Request) -> https_fn.Response:
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204, headers=CORS_HEADERS)

    thing_id = req.args.get("thing_id")
    start_time = req.args.get("start_time")
    variable = req.args.get("variable")

    return https_fn.Response(
        getTimeseries(thing_id, start_time, variable),
        mimetype="application/json",
        status=200,
        headers=CORS_HEADERS,
    )


# retrain model every 4 hours
@scheduler_fn.on_schedule(schedule="0 */4 * * *")
def retrainModel(event):  # TODO: check if this event param is needed
    # train model with current data (note only online mode )
    df = get_machine_states_df()
    model = RandomForestModel(load_model=False)
    acc = model.train(df)
    n_datapoints = model.n_datapoints
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    # write timestamp, accuracy and number of datapoints to training_results table
    write_state_to_db(
        {"timestamp": timestamp, "accuracy": acc, "datapoints": n_datapoints},
        table_name="training_results",
    )


@https_fn.on_request()
def getLat(req: https_fn.Request) -> https_fn.Response:
    thing_id = req.args.get("thing_id")
    lat = getLastLat(thing_id)
    return https_fn.Response(json.dumps({"lat": lat}), status=200, headers=CORS_HEADERS)


@https_fn.on_request()
def getLong(req: https_fn.Request) -> https_fn.Response:
    thing_id = req.args.get("thing_id")
    long = getLastLong(thing_id)
    return https_fn.Response(
        json.dumps({"long": long}), status=200, headers=CORS_HEADERS
    )


@https_fn.on_request()
def getPeakHours(req: https_fn.Request) -> https_fn.Response:
    # parse req
    thing_id = req.args.get("thing_id")
    date = req.args.get("date")
    start_time = req.args.get("start_time")
    end_time = req.args.get("end_time")
    peak = req.args.get("peak")
    peak = True if peak == "true" else False

    # convert time to datetime
    start_time = pd.to_datetime(pd.Timestamp(start_time))
    end_time = pd.to_datetime(pd.Timestamp(end_time))
    try:
        hours = peakHoursHelper(thing_id, date, start_time, end_time, peak=peak)
    except Exception as e:
        print(f"Error in getPeakHours: {str(e)}")
        return https_fn.Response(
            json.dumps([]),
            status=500,
            headers=CORS_HEADERS,
        )
    return https_fn.Response(
        json.dumps(hours),
        status=200,
        headers=CORS_HEADERS,
    )


@https_fn.on_request()
def getLastUsedTime(req: https_fn.Request) -> https_fn.Response:
    thing_id = req.args.get("thing_id")
    last_used_time = getLastUsedTimeHelper(thing_id)
    if last_used_time is None:
        return https_fn.Response(json.dumps([]), status=200, headers=CORS_HEADERS)
    else:
        return https_fn.Response(
            json.dumps(last_used_time), status=200, headers=CORS_HEADERS
        )

@https_fn.on_request()
def email_on_available(req: https_fn.Request) -> https_fn.Response:
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204, headers=CORS_HEADERS)

    try:
        data = req.get_json()

        machine_id   = data.get("machine_id")
        machine_name = data.get("machine_name")  # sent in email
        previous     = data.get("previous_state")  # state from last check, stored by sql backend

        # get current state from SQL
        recent = fetchMostRecentVarFromDb(machine_id, "state", "machine_states")
        current = recent[0]["state"] if recent else None

        # trigger only on "on" ➝ "off" transition
        if previous == "on" and current == "off":
            waiters_ref = (
                db.collection("subscriptions")
                  .document(machine_id)
                  .collection("waiters")
            )

            for doc in waiters_ref.stream():
                email = doc.to_dict().get("email")
                if email:
                    send_email(email, machine_name)
                doc.reference.delete()

        return https_fn.Response(
            json.dumps({"status": "ok", "previous": previous, "current": current}),
            status=200,
            headers=CORS_HEADERS
        )

    except Exception as e:
        print("ERROR:", e)
        return https_fn.Response(
            json.dumps({"error": str(e)}),
            status=500,
            headers=CORS_HEADERS
        )


@https_fn.on_request()
def getTotalUsage(req: https_fn.Request) -> https_fn.Response:
    thing_id = req.args.get("thing_id")
    total_usage = getTotalUsageUtil(thing_id)
    print(f"Raw total usage value: {total_usage}, type: {type(total_usage)}")

    if total_usage is None:
        return https_fn.Response(json.dumps([]), status=200, headers=CORS_HEADERS)
    else:
        # Force to float and strip % if present
        if isinstance(total_usage, str):
            total_usage = total_usage.replace("%", "")

        # Convert to float to ensure proper JSON serialization
        try:
            total_usage = float(total_usage)
        except (ValueError, TypeError):
            print(f"Failed to convert {total_usage} to float")

        print(f"Formatted total usage value: {total_usage}")
        return https_fn.Response(
            str(total_usage),  # Just return the number directly
            status=200,
            headers=CORS_HEADERS,
        )


@https_fn.on_request()
def getDailyUsage(req: https_fn.Request) -> https_fn.Response:
    thing_id = req.args.get("thing_id")
    date = req.args.get("date")
    daily_usage = getDailyUsageUtil(thing_id, date)
    print(f"Raw daily usage value: {daily_usage}, type: {type(daily_usage)}")

    if daily_usage is None:
        return https_fn.Response(json.dumps([]), status=200, headers=CORS_HEADERS)
    else:
        # Force to float and strip % if present
        if isinstance(daily_usage, str):
            daily_usage = daily_usage.replace("%", "")

        # Convert to float to ensure proper JSON serialization
        try:
            daily_usage = float(daily_usage)
        except (ValueError, TypeError):
            print(f"Failed to convert {daily_usage} to float")

        print(f"Formatted daily usage value: {daily_usage}")
        return https_fn.Response(
            str(daily_usage),  # Just return the number directly
            status=200,
            headers=CORS_HEADERS,
        )


@scheduler_fn.on_schedule(schedule="0 19 * * *")
def sleepDevices(
    event,
):  # TODO: this event parameter may need to be removed but from what I understand about the scheduled cloud functions,
    # the event parameter is automatically passed by the scheduler so it needs to be in the function def. This might be a source of the error
    # I cant be sure until deploying it and testing
    thing_ids = db.collection("thing_ids").list_documents()
    thing_ids = [thing_id.id for thing_id in thing_ids]

    for thing_id in thing_ids:
        setSleepModeForThing(thing_id, True)


@scheduler_fn.on_schedule(schedule="0 5 * * *")
def wakeDevices(event):
    thing_ids = db.collection("thing_ids").list_documents()
    thing_ids = [thing_id.id for thing_id in thing_ids]

    for thing_id in thing_ids:
        setSleepModeForThing(thing_id, False)


@https_fn.on_request()
def getDailyPercentages(req: https_fn.Request) -> https_fn.Response:
    thing_id = req.args.get("thing_id")
    daily_percentages = getDailyPercentagesUtil(thing_id)
    if daily_percentages is None:
        return https_fn.Response(json.dumps([]), status=200, headers=CORS_HEADERS)
    else:
        return https_fn.Response(
            json.dumps(daily_percentages), status=200, headers=CORS_HEADERS
        )


@https_fn.on_request()
def getHourlyPercentages(req: https_fn.Request) -> https_fn.Response:
    thing_id = req.args.get("thing_id")
    hourly_percentages = getHourlyPercentagesUtil(thing_id)
    if hourly_percentages is None:
        return https_fn.Response(json.dumps([]), status=200, headers=CORS_HEADERS)
    else:
        return https_fn.Response(
            json.dumps(hourly_percentages), status=200, headers=CORS_HEADERS
        )


if __name__ == "__main__":
    pass
