#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: $0 <function_name> <memory>"
    exit 1
fi

function_name=$1
memory=$2 

if [ -z "$memory" ]; then
    memory="512MB"
fi

gcloud functions deploy $function_name \
  --source ./functions \
  --allow-unauthenticated \
  --memory $memory \
  --cpu=1 \
  --runtime python311 \
  --region=us-central1 \
  --entry-point=$function_name \
  --trigger-http \
  --gen2