import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCl_A05doFMHn4vPUAfHkRqsyzxcBbk_1c",
  authDomain: "property-management-23baf.firebaseapp.com",
  projectId: "property-management-23baf",
  storageBucket: "property-management-23baf.appspot.com",
  messagingSenderId: "655319843961",
  appId: "1:655319843961:web:488ee028b61489beaa80a8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  try {
    console.log("=== LOGGING IN AS WAITER ===");
    const userCredential = await signInWithEmailAndPassword(auth, "waiter@waiter.com", "Admin@123");
    const user = userCredential.user;
    console.log(`Successfully logged in! UID: ${user.uid} | Email: ${user.email}`);

    console.log("\nFetching user profile from /users/UID...");
    const profileSnap = await getDoc(doc(db, "users", user.uid));
    if (!profileSnap.exists()) {
      console.log("Profile document does not exist in /users!");
      return;
    }
    const profile = profileSnap.data();
    console.log("Profile Data:", JSON.stringify(profile));

    const tenantId = profile.tenantId;
    if (!tenantId) {
      console.log("No tenantId associated with this profile!");
      return;
    }

    console.log(`\nFetching tables for tenant: ${tenantId}...`);
    const tablesSnap = await getDocs(collection(db, "tenants", tenantId, "tables"));
    console.log(`Total tables found: ${tablesSnap.docs.length}`);
    tablesSnap.docs.forEach(d => {
      console.log(`   - Table ID: ${d.id} | Data:`, JSON.stringify(d.data()));
    });

    console.log(`\nFetching rooms for tenant: ${tenantId}...`);
    const roomsSnap = await getDocs(collection(db, "tenants", tenantId, "rooms"));
    console.log(`Total rooms found: ${roomsSnap.docs.length}`);
    roomsSnap.docs.forEach(d => {
      console.log(`   - Room ID: ${d.id} | Data:`, JSON.stringify(d.data()));
    });

  } catch (err) {
    console.error("Execution failed:", err);
  }
}

run();
