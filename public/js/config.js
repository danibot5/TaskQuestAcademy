import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyBBHjUB1-WbBPW9d8TBj4w_DjUAwDZ4Dlc",
    authDomain: "scriptsensei-4e8fe.firebaseapp.com",
    projectId: "scriptsensei-4e8fe",
    storageBucket: "scriptsensei-4e8fe.firebasestorage.app",
    messagingSenderId: "1043964924444",
    appId: "1:1043964924444:web:1606274b5d28087d4b05d9"
};

const app = initializeApp(firebaseConfig);

// Експортваме инстанциите, за да ги ползват другите файлове
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// API URL-и
export const API_URL = 'http://127.0.0.1:5001/scriptsensei-4e8fe/us-central1/chat';
export const TITLE_API_URL = 'http://127.0.0.1:5001/scriptsensei-4e8fe/us-central1/generateTitle';