#!/bin/bash

curl "https://gymhawk-2ed7f.web.app/api/getStateTimeseries?thing_id=0a73bf83-27de-4d93-b2a0-f23cbe2ba2a8&startTime=2024-03-20T00:00:00Z&variable=state" | jq