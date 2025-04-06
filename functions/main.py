from firebase_functions import https_fn, scheduler_fn
from firebase_admin import initialize_app, firestore
import iot_api_client as iot
from iot_api_client.rest import ApiException
from iot_api_client.configuration import Configuration
from iot_api_client.api import PropertiesV2Api
from iot_api_client.models import *
import json
from datetime import datetime, timezone, time
import time as t
from utils import *
from consts import *

# set up firebase app
initialize_app()
db = firestore.client()


class ManualRequest:
    def __init__(self, args):
        self.method = None
        self.args = args

# =============================================================================
# Cloud Functions
# =============================================================================


@https_fn.on_request()
def getDeviceState(req: https_fn.Request) -> https_fn.Response:
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204, headers=CORS_HEADERS)

    HOST = "https://api2.arduino.cc"
    token = get_token()
    client_config = Configuration(HOST)
    client_config.access_token = token
    client = iot.ApiClient(client_config)
    properties_api = PropertiesV2Api(client)

    thing_id = req.args.get("thing_id")
    if not thing_id:
        return https_fn.Response(
            json.dumps({"error": "Machine not found"}),
            mimetype="application/json",
            status=404,
            headers=CORS_HEADERS,
        )

    property_dict = {}
    try:
        properties = properties_api.properties_v2_list(id=thing_id)
        for property in properties:
            # assume state property is always present
            if "Use" in property.name:
                value = property.last_value
                property_dict["state"] = (
                    "on" if value else "off" if value is not None else "unknown"
                )

            # current property is optional
            if "Current" in property.name:
                property_dict["current"] = property.last_value

        if "current" not in property_dict:
            property_dict["current"] = None

    except ApiException as e:
        return https_fn.Response(
            json.dumps({"error": str(e)}),
            mimetype="application/json",
            status=500,
            headers=CORS_HEADERS,
        )
    output = json.dumps(property_dict)
    return https_fn.Response(
        output, mimetype="application/json", status=200, headers=CORS_HEADERS
    )



# cron job to add a time step to the database for each machine every 2 minutes
@scheduler_fn.on_schedule(schedule="*/2 * * * *")
def addTimeStep(event: scheduler_fn.ScheduledEvent = None) -> None:
    try:

        # fitness east is open between 5:00am and 7:00pm
        open_time = time(5,0)
        close_time = time(19,0)
        current_time = datetime.now(timezone.utc)
        if not is_time_between(open_time, close_time, current_time):
            return

        init_db_connection()

        # Get all thing IDs from firestore
        thing_ids = db.collection("thing_ids").list_documents()
        thing_ids = [thing_id.id for thing_id in thing_ids]
        timestamp = current_time.isoformat()

        # Initialize state counts for each machine,
        state_counts = {thing_id: {"on": 0, "off": 0} for thing_id in thing_ids}
        current_sums = {thing_id: 0 for thing_id in thing_ids}
        current_counts = {thing_id: 0 for thing_id in thing_ids}

        # Poll for 1 minute 
        for _ in range(60):
            for thing_id in thing_ids:
                try:
                    # fetch state and analog current
                    state, current = addTimeStepUtil(thing_id, timestamp)
                    if state in ["on", "off"]:  # Only count valid states
                        state_counts[thing_id][state] += 1
                        if not current:
                            current = 0
                        current_sums[thing_id] += current
                        current_counts[thing_id] += 1
                except Exception as e:
                    print(f"Error polling thing_id {thing_id}: {str(e)}")
            t.sleep(1)

        # Write the most common state for each machine to the database and the average current
        for thing_id in thing_ids:
            counts = state_counts[thing_id]
            most_common_state = max(counts.items(), key=lambda x: x[1])[0]
            current = current_sums[thing_id] / current_counts[thing_id]
            
            write_state_to_db(thing_id=thing_id, state=most_common_state, current=current, n_on=counts["on"], n_off=counts["off"], timestamp=timestamp)
            
    except Exception as e:
        print(f"Error in addTimeStep: {str(e)}")
        raise

def getTimeseries(req: https_fn.Request, table_name: str) -> https_fn.Response:
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204, headers=CORS_HEADERS)
    
    thing_id = req.args.get("thing_id")
    startTime = req.args.get("startTime")
    
    if not thing_id:
        return https_fn.Response(
            json.dumps({"error": "Thing ID not found"}),
            mimetype="application/json",
            status=404,
            headers=CORS_HEADERS,
        )
    try:
        timeseries = fetch_state_from_db(thing_id, startTime, table_name)
        return https_fn.Response(json.dumps(timeseries), mimetype="application/json", status=200, headers=CORS_HEADERS)
    except Exception as e:
        print(f"Error fetching timeseries: {str(e)}")
        return https_fn.Response(
            json.dumps({"error": f"Database error: {str(e)}"}),
            mimetype="application/json",
            status=500,
            headers=CORS_HEADERS,
        )

@https_fn.on_request()
def getStateTimeseries(req: https_fn.Request) -> https_fn.Response:
    return getTimeseries(req, "machine_states")

@https_fn.on_request()
def getStateTimeseriesDummy(req: https_fn.Request) -> https_fn.Response:
    return getTimeseries(req, "machine_states_dummy")

# for testing
if __name__ == "__main__":

    # fetching dummy timeseries for machine:  6ad4d9f7-8444-4595-bf0b-5fb62c36430c  at time:  2025-04-05T10:00:00.000Z

    dummyReq = ManualRequest(args={"thing_id": "6ad4d9f7-8444-4595-bf0b-5fb62c36430c", "startTime": "2025-01-05T10:00:00.000Z"})  
    state = getStateTimeseriesDummy(dummyReq)
    print(state)
    