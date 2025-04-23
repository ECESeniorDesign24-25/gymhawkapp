#!/bin/bash

usage() {
    echo "Usage: $0 --function <function_name> [parameters]"
    echo "Available functions:"
    echo "  getStateTimeseries --thing_id <id> --start_time <time> --variable <var>"
    echo "  getDeviceState --thing_id <id> --variable <var>"
    echo "  getPeakHours --thing_id <id> --date <date> --start_time <time> --end_time <time> --peak <true/false>"
    echo "  getLastUsedTime --thing_id <id>"
    echo "  getLat --thing_id <id>"
    echo "  getLong --thing_id <id>"
    exit 1
}

API_BASE_URL="https://gymhawk-2ed7f.web.app/api" 

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --function)
            FUNCTION="$2"
            shift 2
            ;;
        --thing_id)
            THING_ID="$2"
            shift 2
            ;;
        --start_time)
            START_TIME="$2"
            shift 2
            ;;
        --variable)
            VARIABLE="$2"
            shift 2
            ;;
        --date)
            DATE="$2"
            shift 2
            ;;
        --end_time)
            END_TIME="$2"
            shift 2
            ;;
        --peak)
            PEAK="$2"
            shift 2
            ;;
        *)
            echo "Unknown parameter: $1"
            usage
            ;;
    esac
done

# Special handling for getLastUsedTime which might return non-JSON data
if [ "$FUNCTION" = "getLastUsedTime" ]; then
    URL="$API_BASE_URL/$FUNCTION?thing_id=$THING_ID"
    echo "Calling API: $URL"
    
    # Get raw response without HTTP status code
    raw_response=$(curl -s "$URL")
    
    # Check if response is HTML (common error for non-deployed functions)
    if [[ "$raw_response" == *"<!DOCTYPE html>"* ]]; then
        echo "Error: Received HTML instead of data. Function may not be properly deployed."
        exit 1
    fi
    
    # Check for null or empty response
    if [[ "$raw_response" == "null" || -z "$raw_response" ]]; then
        echo "Last used time: \"Never\""
        exit 0
    fi
    
    # Try to parse as JSON, fallback to raw display if not JSON
    if echo "$raw_response" | jq . >/dev/null 2>&1; then
        echo "$raw_response" | jq .
    else
        # Display raw response if not JSON
        echo "Last used time: \"$raw_response\""
    fi
    
    exit 0
fi

# Regular API call handling for other functions
# Validate required parameters based on function
case "$FUNCTION" in
    getStateTimeseries|getStateTimeseriesDummy)
        if [ -z "$THING_ID" ] || [ -z "$START_TIME" ] || [ -z "$VARIABLE" ]; then
            echo "Missing required parameters for $FUNCTION"
            usage
        fi
        URL="$API_BASE_URL/$FUNCTION?thing_id=$THING_ID&start_time=$START_TIME&variable=$VARIABLE"
        ;;
    getDeviceState)
        if [ -z "$THING_ID" ] || [ -z "$VARIABLE" ]; then
            echo "Missing required parameters for $FUNCTION"
            usage
        fi
        URL="$API_BASE_URL/$FUNCTION?thing_id=$THING_ID&variable=$VARIABLE"
        ;;
    getPeakHours)
        if [ -z "$THING_ID" ] || [ -z "$DATE" ] || [ -z "$START_TIME" ] || [ -z "$END_TIME" ]; then
            echo "Missing required parameters for $FUNCTION"
            usage
        fi
        URL="$API_BASE_URL/$FUNCTION?thing_id=$THING_ID&date=$DATE&start_time=$START_TIME&end_time=$END_TIME"
        if [ ! -z "$PEAK" ]; then
            URL="$URL&peak=$PEAK"
        fi
        ;;
    addTimeStep)
        URL="$API_BASE_URL/$FUNCTION"
        ;;
    getLat)
        URL="$API_BASE_URL/$FUNCTION?thing_id=$THING_ID"
        ;;
    getLong)
        URL="$API_BASE_URL/$FUNCTION?thing_id=$THING_ID"
        ;;
    *)
        echo "Unknown function: $FUNCTION"
        usage
        ;;
esac

echo "Calling API: $URL"

# Make the API call and format the response
response=$(curl -s -w "\n%{http_code}" "$URL")
status_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$status_code" -eq 200 ]; then
    echo "$body" | jq || echo "Error parsing JSON. Raw response: $body"
else
    echo "Error: HTTP $status_code"
    echo "$body"
fi
