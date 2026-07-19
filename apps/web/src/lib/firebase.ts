import { getFirebaseApp, getFirebaseAuth, getFirebaseFirestore, getFirebaseStorage } from '@restaurant-qr/infra';

// =========================================================================
// PASTE YOUR FIREBASE WEB APP CONFIGURATION OBJECT HERE:
// =========================================================================
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

import { getFunctions } from 'firebase/functions';

// Initialize Firebase Core services
export const app = getFirebaseApp(firebaseConfig);
export const auth = getFirebaseAuth(app);
export const db = getFirebaseFirestore(app);
export const storage = getFirebaseStorage(app);
export const functions = getFunctions(app);
