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

# set up firebase app
initialize_app()
db = firestore.client()

ARDUINO_CLIENT_ID = StringParam("ARDUINO_CLIENT_ID")
ARDUINO_CLIENT_SECRET = StringParam("ARDUINO_CLIENT_SECRET")


# Adapted from: https://github.com/arduino/iot-client-py/blob/master/example/main.py
def get_token():
    oauth_client = BackendApplicationClient(client_id=ARDUINO_CLIENT_ID.value)
    token_url = "https://api2.arduino.cc/iot/v1/clients/token"
    oauth = OAuth2Session(client=oauth_client)
    token = oauth.fetch_token(
        token_url=token_url,
        client_id=ARDUINO_CLIENT_ID.value,
        client_secret=ARDUINO_CLIENT_SECRET.value,
        include_client_id=True,
        audience="https://api2.arduino.cc/iot",
    )
    return token.get("access_token")


def get_thing_id(machine):
    doc = db.collection("machines").document(machine).get()
    if doc.exists:
        data = doc.to_dict()
        return str(data.get("thingId"))
    print(f"{machine} does not have a corresponding doc in firestore")
    return None


@https_fn.on_request()
def getDeviceState(req: https_fn.Request) -> https_fn.Response:
    HOST = "https://api2.arduino.cc"
    TOKEN_URL = "https://api2.arduino.cc/iot/v1/clients/token"

    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if req.method == "OPTIONS":
        return https_fn.Response("", status=204, headers=cors_headers)

    # config for arduino cloud api
    client_config = Configuration(HOST)
    token = get_token()
    client_config.access_token = token
    client = iot.ApiClient(client_config)

    things_api = ThingsV2Api(client)
    properties_api = PropertiesV2Api(client)

    # get machine -> thing id from firestore
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
            name = property.name

            if "Use" in name:
                ptype = property.type
                value = property.last_value

                # store states as on/off to allow for missing data state
                value = property.last_value
                if value is None:
                    property_dict["state"] = "unknown"
                else:
                    property_dict["state"] = "on" if value else "off"

    except ApiException as e:
        return https_fn.Response(
            json.dumps({"error": e}),
            mimetype="application/json",
            status=500,
            headers=cors_headers,
        )

    output = json.dumps(property_dict)
    return https_fn.Response(
        output, mimetype="application/json", status=200, headers=cors_headers
    )


# for local debugging
if __name__ == "__main__":

    class DummyRequest:
        def __init__(self):
            self.method = None
            self.args = {"machine": "d1Green"}

    req = DummyRequest()
    print(getDeviceState(req).data)
