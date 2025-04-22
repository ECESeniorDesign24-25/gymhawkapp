#!/bin/bash


./scripts/deploy_function.sh getDeviceState
./scripts/deploy_function.sh addTimeStep 
./scripts/deploy_function.sh getStateTimeseries 1024MB
./scripts/deploy_function.sh retrainModel 1024MB
./scripts/deploy_function.sh getLat 
./scripts/deploy_function.sh getLong 
./scripts/deploy_function.sh getPeakHours 