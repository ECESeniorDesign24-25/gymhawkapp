import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGE_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  // smtp: {
  //   username: process.env.SMTP_USER,
  //   password: process.env.SMTP_PASS,
  // },
};

if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  console.log("Missing NEXT_PUBLIC_FIREBASE_API_KEY environment variable")
}
if (!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) {
  console.log("Missing NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN environment variable")
}
if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
  console.log("Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variable")
}
if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  console.log("Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable")
}
if (!process.env.NEXT_PUBLIC_FIREBASE_MESSAGE_SENDER_ID) {
  console.log("Missing NEXT_PUBLIC_FIREBASE_MESSAGE_SENDER_ID environment variable")
}
if (!process.env.NEXT_PUBLIC_FIREBASE_APP_ID) {
  console.log("Missing NEXT_PUBLIC_FIREBASE_APP_ID enivronment variable")
}

const app = initializeApp(firebaseConfig);

export const functions = getFunctions(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
