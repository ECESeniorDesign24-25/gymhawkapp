// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBhkNpHxs8uRQeOBYqftm2yzmtFSUyacmw",
  authDomain: "gymhawk-2ed7f.firebaseapp.com",
  projectId: "gymhawk-2ed7f",
  storageBucket: "gymhawk-2ed7f.firebasestorage.app",
  messagingSenderId: "374604200780",
  appId: "1:374604200780:web:7ca59e75450e0a4370ede9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
