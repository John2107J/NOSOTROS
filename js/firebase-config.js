// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA4MGy0fT10azwG7mRdAO2NmCW1vxpVqbk",
  authDomain: "nosotros-2107.firebaseapp.com",
  projectId: "nosotros-2107",
  storageBucket: "nosotros-2107.firebasestorage.app",
  messagingSenderId: "878268543439",
  appId: "1:878268543439:web:0551ef626ffeeb45a762ba",
  measurementId: "G-Z7R3Y1YY53"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
