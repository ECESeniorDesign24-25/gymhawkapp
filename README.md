## GymHawk Web Application

### Setup
There are a few things you will need to do to set up the application. First, you will need a [Firebase account](https://firebase.google.com/) and access to the project, which you can get via link. Reach out to Joe for more info on that.

Next, you will need a [Google Cloud Platform](https://console.cloud.google.com/) account.

Once you have the accounts set up, you will need to do the following:
1. Create a `.env.local` file in the root of this repository
2. This file will need the following:
```
NEXT_PUBLIC_MAPS_API_KEY=
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGE_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

The `MAPS_API_KEY` can be generated from your GCP account. The Firebase keys are found in the project npm SDK which you can access by going to the Firebase console, selecting the GymHawk project, going to settings (general), and clicking the web app.

### Development
The application source code is in the `src/` directory. Structure:

- `src/pages`: Holds the application pages. `index.tsx` is the home page.
- `src/components`: Holds any custom javascript components.
- `src/lib`: Holds any configs for external tools (ex. Firebase).
- `src/styles`: Holds custom styles and css.
- `src/utils`: Holds util functions.

#### Running the app locally
To run the app locally, you just need to run:
```bash
npm run dev
```

#### Deploying the app
Application deployment is handled by Firebase. To set up deployment, you will first need to install the [Firebase CLI](https://firebase.google.com/docs/cli). Once that is downloaded, you just need to run:
```bash
./scripts/deploy.sh
```
from the root of this repository. This will generate a static build of the application in the `out/` directory and will be hosted on Firebase.

### API Documentation

#### Get Current Value of Device Variable
**Endpoint:** `/getDeviceState`  
**Method:** GET  
**Parameters:**
- `thing_id`: The thing_id of the device  
- `variable`: the variable to return. Available choices are defined [here](variables.md)

**Returns:** JSON object in the following form:
```json
[
    {
        "<VARIABLE>": ...,
        "timestamp": "2025-04-17T03:36:00.818000+00:00"
    }
]
```

**To test locally:**
```bash
./scripts/test_api.sh --function getDeviceState --thing_id <thing_id> --variable <variable>
```

#### Add Time Step
**Endpoint:** `/addTimeStep`  
**Method:** Scheduler  
**Parameters:** None  
**Returns:** Nothing - this function gets ran by the Cloud Run scheduler every 1 minute.  
**To test locally:** This function cannot be ran locally as it is not an HTTPS endpoint.

#### Get Timeseries
**Endpoint:** `/getStateTimeseries`  
**Method:** GET  
**Parameters:**
- `thing_id`: The thing_id of the device
- `variable`: The variable to return the timeseries for. Available choices are defined [here](variables.md)
- `start_time`: The start time for the timeseries (only records stored after this time are returned). Time format: YYYY-MM-DDT00:00:00Z etc

**Returns:** JSON object in the following form:
```json
[
    {
        "<variable>": ...,
        "timestamp": "2025-04-17T03:34:01.753000+00:00"
    },
    {
        "<variable>": ...,
        "timestamp": "2025-04-17T03:35:05.068000+00:00"
    },
    {
        "<variable>": ...,
        "timestamp": "2025-04-17T03:36:00.818000+00:00"
    }
]
```

**To test locally:**
```bash
./scripts/test_api.sh --function getStateTimeseries --thing_id <thing_id> --variable <variable> --start_time <start_time>
```

#### Train Model
**Endpoint:** `/retrainModel`  
**Method:** Scheduler  
**Parameters:** None  
**Returns:** Nothing - this function gets ran by the Cloud Run scheduler every 4 hours.  
**To test locally:** This function cannot be ran locally as it is not an HTTPS endpoint.

#### Get Peak Hours
**Endpoint:** `/getPeakHours`  
**Method:** GET  
**Parameters:**
- `thing_id`: The thing_id of the device
- `date`: The date to predict peak hours for
- `start_time`: The start time for the timeseries (only records stored after this time are returned). Time format: YYYY-MM-DDT00:00:00Z etc
- `end_time`: The end time for the timeseries (only records stored before this time are returned). Time format: YYYY-MM-DDT00:00:00Z etc
- `peak`: "true" or "false" on whether to return peak hours or the reverse (busiest vs least busy range)

**Returns:** JSON object in the following form:
```json
{
    "hours": [
        "2025-04-17T18:30:00",
        "2025-04-17T16:00:00",
        "2025-04-17T15:30:00"
    ]
}
```

**To test locally:**
```bash
./scripts/test_api.sh --function getPeakHours --thing_id <thing_id> --date <date> --start_time <start_time> --end_time <end_time> --peak <peak>
```