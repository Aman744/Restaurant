import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCl_A05doFMHn4vPUAfHkRqsyzxcBbk_1c",
  authDomain: "property-management-23baf.firebaseapp.com",
  projectId: "property-management-23baf",
  storageBucket: "property-management-23baf.appspot.com",
  messagingSenderId: "655319843961",
  appId: "1:655319843961:web:488ee028b61489beaa80a8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  try {
    console.log("Fetching users...");
    const usersSnap = await getDocs(collection(db, "users"));
    usersSnap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`Email: ${data.email} | Role: ${data.role} | DisplayName: ${data.displayName}`);
    });
  } catch (err) {
    console.error(err);
  }
}

run();
