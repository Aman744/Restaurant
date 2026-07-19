import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

export const getFirebaseApp = (config: any) => {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(config);
};

export const getFirebaseAuth = (app: any) => getAuth(app);
export const getFirebaseFirestore = (app: any) => getFirestore(app);
export const getFirebaseStorage = (app: any) => getStorage(app);
