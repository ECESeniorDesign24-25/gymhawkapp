## GymHawk Web Application

#### Setup
There are a few things you will need to do to set up the application. First, you will need a (Firebase account)[https://firebase.google.com/] and access to the project, which you can get via link. Reach out to Joe for more info on that.

Next, you will need a (Google Cloud Platform)[https://console.cloud.google.com/] account.

Once you have the accounts set up, you will need to do the following:
1. Create a .env.local file in the root of this repository
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

The MAPS_API_KEY can be generated from your GCP account. The Firebase keys are found in the project npm SDK which you can access by going to the Firebase console, selecting the GymHawk project, going to settings (general), and clicking the web app.

#### Development:
The application source code is in the `src/` directory. Structure:

`src/pages`: Holds the application pages. `index.tsx` is the home page.
`src/components`: Holds any custom javascript components.
`src/lib`: Holds any configs for external tools (ex. Firebase).
`src/styles`: Holds custom styles and css.
`src/utils`: Holds util functions.

#### Running the app locally:
To run the app locally, you just need to run:

`npm run dev`


#### Deploying the app:
Application deployment is handled by Firebase. To set up deployment, you will first need to install the (Firebase CLI)[https://firebase.google.com/docs/cli]. Once that is downloaded, you just need to run: 

`./deploy.sh` 

from the root of this repository. This will generate a static build of the application in the `out/` directory and will be hosted on Firebase.