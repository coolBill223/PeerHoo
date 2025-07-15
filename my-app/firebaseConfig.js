import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";


const firebaseConfig = {
  apiKey: "AIzaSyCOZWRdN_MWp6QQwX2qlNLlpTBmPibh7VA",
  authDomain: "cs4720-d84f6.firebaseapp.com",
  projectId: "cs4720-d84f6",
  storageBucket: "cs4720-d84f6.firebasestorage.app",
  messagingSenderId: "300772083431",
  appId: "1:300772083431:web:31002d8cec47dcb8900442",
  measurementId: "G-LVWQT91RJJ"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);