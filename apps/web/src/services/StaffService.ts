import { db, firebaseConfig } from '../lib/firebase.js';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as authSignOut, sendPasswordResetEmail } from 'firebase/auth';
import { UserConverter } from '@restaurant-qr/infra';
import type { UserProfile, UserRole } from '@restaurant-qr/core';

const MOCK_STAFF_KEY = 'restaurant_qr_mock_staff_db';
const MOCK_CREDENTIALS_DB_KEY = 'restaurant_qr_mock_credentials_db';

const hashPasswordLocal = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

export class StaffService {
  /**
   * Creates or provisions a staff profile and auth credentials securely
   */
  static async createStaffMember(
    tenantId: string,
    displayName: string,
    email: string,
    role: UserRole,
    password?: string,
    isMockMode?: boolean
  ): Promise<UserProfile> {
    const uid = `staff_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    const profile: UserProfile = {
      uid,
      email: email.toLowerCase(),
      displayName,
      role,
      tenantId,
      permissions: getPermissionsForRole(role),
      createdAt: new Date()
    };

    if (isMockMode) {
      if (password) {
        const hashed = await hashPasswordLocal(password);
        const rawDb = localStorage.getItem(MOCK_CREDENTIALS_DB_KEY);
        const credentialsDb = rawDb ? JSON.parse(rawDb) : {};
        credentialsDb[email.toLowerCase()] = {
          uid,
          email: email.toLowerCase(),
          displayName,
          passwordHash: hashed,
          claims: { role, tenantId }
        };
        localStorage.setItem(MOCK_CREDENTIALS_DB_KEY, JSON.stringify(credentialsDb));
      }

      const stored = localStorage.getItem(MOCK_STAFF_KEY);
      const parsed: UserProfile[] = stored ? JSON.parse(stored) : [];
      parsed.push(profile);
      localStorage.setItem(MOCK_STAFF_KEY, JSON.stringify(parsed));
      return profile;
    }

    // Firebase Mode Secondary Auth App creation
    if (password) {
      const appName = `SecondaryStaffApp_${Date.now()}`;
      const secondaryApp = initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);
      try {
        const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const staffUid = credential.user.uid;
        await authSignOut(secondaryAuth);
        profile.uid = staffUid;
      } catch (authErr: any) {
        console.error('Firebase Auth staff creation failed:', authErr);
      }
    }

    // Write profile document to global users collection
    const userDocRef = doc(db, 'users', profile.uid).withConverter(UserConverter);
    await setDoc(userDocRef, profile);

    // Also index under tenant's users subcollection
    const tenantUsersRef = doc(db, 'tenants', tenantId, 'users', profile.uid).withConverter(UserConverter);
    await setDoc(tenantUsersRef, profile);

    return profile;
  }

  /**
   * Deletes a staff member
   */
  static async deleteStaffMember(tenantId: string, uid: string, isMockMode: boolean): Promise<void> {
    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_STAFF_KEY);
      if (stored) {
        const parsed: UserProfile[] = JSON.parse(stored);
        const updated = parsed.filter((s) => s.uid !== uid);
        localStorage.setItem(MOCK_STAFF_KEY, JSON.stringify(updated));
      }
      return;
    }

    // Delete Firestore profile documents
    await deleteDoc(doc(db, 'users', uid));
    await deleteDoc(doc(db, 'tenants', tenantId, 'users', uid));

    // Queue Firebase Authentication user deletion
    try {
      await setDoc(doc(db, 'auth_deletion_queue', uid), {
        uid,
        tenantId,
        deletedAt: new Date(),
        status: 'pending'
      });
    } catch (e) {}
  }

  /**
   * Updates a staff member's profile
   */
  static async updateStaffMember(
    tenantId: string,
    uid: string,
    data: { displayName: string; role: UserRole },
    isMockMode: boolean
  ): Promise<void> {
    const permissions = getPermissionsForRole(data.role);

    if (isMockMode) {
      // 1. Update mock staff profile
      const stored = localStorage.getItem(MOCK_STAFF_KEY);
      if (stored) {
        const parsed: UserProfile[] = JSON.parse(stored);
        const idx = parsed.findIndex((s) => s.uid === uid);
        if (idx !== -1) {
          parsed[idx].displayName = data.displayName;
          parsed[idx].role = data.role;
          parsed[idx].permissions = permissions;
          localStorage.setItem(MOCK_STAFF_KEY, JSON.stringify(parsed));
        }
      }

      // 2. Update credentials claims
      const rawDb = localStorage.getItem(MOCK_CREDENTIALS_DB_KEY);
      if (rawDb) {
        const credentialsDb = JSON.parse(rawDb);
        const email = Object.keys(credentialsDb).find((k) => credentialsDb[k].uid === uid);
        if (email) {
          credentialsDb[email].displayName = data.displayName;
          credentialsDb[email].claims.role = data.role;
          localStorage.setItem(MOCK_CREDENTIALS_DB_KEY, JSON.stringify(credentialsDb));
        }
      }
      return;
    }

    // Live mode: update global users doc and tenant subcollection
    const userDocRef = doc(db, 'users', uid).withConverter(UserConverter);
    const tenantUserDocRef = doc(db, 'tenants', tenantId, 'users', uid).withConverter(UserConverter);

    await setDoc(userDocRef, { displayName: data.displayName, role: data.role, permissions }, { merge: true });
    await setDoc(tenantUserDocRef, { displayName: data.displayName, role: data.role, permissions }, { merge: true });
  }

  /**
   * Resets a staff member's password
   */
  static async resetStaffPassword(
    tenantId: string,
    uid: string,
    email: string,
    newPassword?: string,
    isMockMode?: boolean
  ): Promise<void> {
    if (isMockMode) {
      if (newPassword) {
        const hashed = await hashPasswordLocal(newPassword);
        const rawDb = localStorage.getItem(MOCK_CREDENTIALS_DB_KEY);
        if (rawDb) {
          const credentialsDb = JSON.parse(rawDb);
          if (credentialsDb[email.toLowerCase()]) {
            credentialsDb[email.toLowerCase()].passwordHash = hashed;
            localStorage.setItem(MOCK_CREDENTIALS_DB_KEY, JSON.stringify(credentialsDb));
          }
        }
      }
      return;
    }

    // Queue Firebase Auth password reset task
    if (newPassword) {
      await setDoc(doc(db, 'auth_reset_queue', uid), {
        uid,
        email: email.toLowerCase(),
        tenantId,
        newPassword,
        requestedAt: new Date(),
        status: 'pending'
      });
    }

    // Trigger standard Firebase Client reset email
    const auth = getAuth();
    await sendPasswordResetEmail(auth, email);
  }
}

function getPermissionsForRole(role: UserRole): string[] {
  switch (role) {
    case 'manager':
      return ['staff', 'orders', 'reports', 'kitchen', 'tables'];
    case 'kitchen-staff':
      return ['kds', 'order_status'];
    case 'waiter':
      return ['tables', 'requests', 'serve'];
    case 'cashier':
      return ['billing', 'payments', 'refunds', 'receipts'];
    default:
      return ['dashboard'];
  }
}
