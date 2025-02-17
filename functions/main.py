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
import jwt

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
def getDeviceStates(req: https_fn.Request) -> https_fn.Response:
    HOST = "https://api2.arduino.cc"
    TOKEN_URL = "https://api2.arduino.cc/iot/v1/clients/token"

    if req.method == "OPTIONS":
        return https_fn.Response(
            "",
            status=204,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        )

    # config for arduino cloud api
    client_config = Configuration(HOST)
    token = get_token()
    print(jwt.decode(token, options={"verify_signature": False}))
    client_config.access_token = token
    client = iot.ApiClient(client_config)

    things_api = ThingsV2Api(client)
    properties_api = PropertiesV2Api(client)

    # get machine -> thing id from firestore
    machine = req.args.get("machine")
    thing_id = get_thing_id(machine)


    property_dict = {}
    try:
        things = things_api.things_v2_list()
        print([thing.name for thing in things])
        for thing in things:
            if thing.name == "gymhawk":
                print("thing name: ", thing.name)
                properties = properties_api.properties_v2_list(id=thing_id)

                print("checkpoint 2")
                for property in properties:
                    name = property.name
                    if "Use" in name:
                        ptype = property.type
                        value = property.last_value

                        # store states as on/off to allow for missing data state
                        if value:
                            value = "on"
                        else:
                            value = "off"
                        property_dict[name] = value

    except ApiException as e:
        return https_fn.Response(
            json.dumps({"error": e}), mimetype="application/json", status=500
        )

    return https_fn.Response(
        json.dumps(property_dict), mimetype="application/json", status=200
    )


# for local debugging
# if __name__ == "__main__":
#     class DummyRequest:
#         def __init__(self):
#             self.method = None
#             self.args = {"machine": "d1Green"}
#     req = DummyRequest()
#     print(getDeviceStates(req).data)

