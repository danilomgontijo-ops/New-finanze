
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { 
  getAuth, 
  GoogleAuthProvider, 
  setPersistence, 
  browserLocalPersistence, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInAnonymously, 
  signOut as firebaseSignOut,
  onAuthStateChanged
} from "firebase/auth";
import type { User } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBPLTJ6lKVBCUanWfnVMSHK6uiwmTK3FTU",
  authDomain: "controleorca-3a6f4.firebaseapp.com",
  projectId: "controleorca-3a6f4",
  storageBucket: "controleorca-3a6f4.firebasestorage.app",
  messagingSenderId: "878865042395",
  appId: "1:878865042395:web:9d9120600e45b298ab35fe",
  measurementId: "G-WP7X65FVBP"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Configura persistência
setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("Erro na persistência:", error);
});

// Auth Functions
export const signInGoogle = () => signInWithPopup(auth, googleProvider);
export const signInEmail = (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass);
export const signUpEmail = (email: string, pass: string) => createUserWithEmailAndPassword(auth, email, pass);
export const signInAnon = () => signInAnonymously(auth);
export const signOut = () => firebaseSignOut(auth);

export { onAuthStateChanged };
export type { User };
