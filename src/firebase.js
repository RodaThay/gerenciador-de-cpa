import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBlj7HnyEyK6ou9po0PG99c2sqGykYEBUw",
  authDomain: "meu-painel-goat.firebaseapp.com",
  projectId: "meu-painel-goat",
  storageBucket: "meu-painel-goat.firebasestorage.app",
  messagingSenderId: "65954409696",
  appId: "1:65954409696:web:cb12173acb6f7b2244f485"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);