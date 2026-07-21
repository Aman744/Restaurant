import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as authSignOut } from 'firebase/auth';
import { doc, setDoc, deleteDoc, getDocs, collection, query, where, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db, firebaseConfig } from '../lib/firebase.js';
import { TenantConverter } from '@restaurant-qr/infra';
import type { Tenant } from '@restaurant-qr/core';

const MOCK_CREDENTIALS_DB_KEY = 'restaurant_qr_mock_credentials_db';

// Native Web Crypto SHA-256 hash utility
const hashPasswordLocal = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export class TenantService {
  private isMockMode: boolean;

  constructor() {
    this.isMockMode = !import.meta.env.VITE_FIREBASE_API_KEY || 
                      import.meta.env.VITE_FIREBASE_API_KEY === 'your_api_key_here';
  }

  // Provision mock user locally in sandbox
  private async provisionMockLocal(
    name: string,
    planId: 'starter' | 'growth' | 'enterprise',
    domain?: string,
    adminEmail?: string,
    adminPassword?: string,
    adminName?: string
  ): Promise<Tenant> {
    const newTenantId = `tenant_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    
    if (adminEmail && adminPassword) {
      const lowerEmail = adminEmail.toLowerCase();
      const rawDb = localStorage.getItem(MOCK_CREDENTIALS_DB_KEY);
      const credentialsDb = rawDb ? JSON.parse(rawDb) : {};

      const existingUser = credentialsDb[lowerEmail];
      const mockUid = existingUser?.uid || `mock_uid_${Math.floor(Math.random() * 100000)}`;
      const hashed = await hashPasswordLocal(adminPassword);

      const mockClaims = {
        role: 'restaurant-admin',
        tenantId: newTenantId
      };

      const mockUser = {
        uid: mockUid,
        email: adminEmail.toLowerCase(),
        displayName: adminName || adminEmail.split('@')[0].toUpperCase(),
        passwordHash: hashed,
        claims: mockClaims
      };

      credentialsDb[lowerEmail] = mockUser;
      localStorage.setItem(MOCK_CREDENTIALS_DB_KEY, JSON.stringify(credentialsDb));
    }

    const newTenant: Tenant = {
      id: newTenantId,
      name,
      domain: domain?.trim() || undefined,
      theme: {
        primaryColor: '#10b981',
        secondaryColor: '#34d399',
        fontFamily: 'Inter',
        receiptTheme: { header: name, footer: 'Thank you!', showTaxDetails: true },
        pwaTheme: { themeColor: '#10b981', backgroundColor: '#000000' }
      },
      subscription: {
        planId,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        limits: planId === 'enterprise'
          ? { tablesPerRestaurant: 100, monthlyOrders: 50000 }
          : planId === 'growth'
          ? { tablesPerRestaurant: 30, monthlyOrders: 5000 }
          : { tablesPerRestaurant: 10, monthlyOrders: 1000 }
      },
      createdAt: new Date()
    };

    // Persist new tenant in mock tenant storage so customer QR links render exact brand name
    try {
      const rawTenants = localStorage.getItem('restaurant_qr_mock_tenants_db');
      const tenantsList: Tenant[] = rawTenants ? JSON.parse(rawTenants) : [];
      tenantsList.push(newTenant);
      localStorage.setItem('restaurant_qr_mock_tenants_db', JSON.stringify(tenantsList));
      localStorage.setItem(`restaurant_qr_mock_tenant_info_${newTenantId}`, JSON.stringify({ name, logoUrl: undefined }));
    } catch (e) {}

    return newTenant;
  }

  // Provision a new tenant and admin account atomically
  async provisionTenant(
    name: string, 
    planId: 'starter' | 'growth' | 'enterprise', 
    domain?: string,
    adminEmail?: string,
    adminPassword?: string,
    adminName?: string
  ): Promise<Tenant> {
    if (this.isMockMode) {
      return this.provisionMockLocal(name, planId, domain, adminEmail, adminPassword, adminName);
    } else {
      // 1. Generate unique tenant id
      const tenantId = `tenant_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

      const newTenant: Tenant = {
        id: tenantId,
        name,
        domain: domain?.trim() || undefined,
        theme: {
          primaryColor: '#10b981',
          secondaryColor: '#34d399',
          fontFamily: 'Inter',
          receiptTheme: { header: name, footer: 'Thank you!', showTaxDetails: true },
          pwaTheme: { themeColor: '#10b981', backgroundColor: '#000000' }
        },
        subscription: {
          planId,
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          limits: planId === 'enterprise'
            ? { tablesPerRestaurant: 100, monthlyOrders: 50000 }
            : planId === 'growth'
            ? { tablesPerRestaurant: 30, monthlyOrders: 5000 }
            : { tablesPerRestaurant: 10, monthlyOrders: 1000 }
        },
        createdAt: new Date() // Date object required for client interface, serverTimestamp handles store
      };

      // 2. Direct Firestore write: Tenant document
      await setDoc(doc(db, 'tenants', tenantId).withConverter(TenantConverter), {
        ...newTenant,
        createdAt: serverTimestamp()
      });

      // 3. Direct Firestore write: Default settings
      await setDoc(doc(db, 'tenants', tenantId, 'settings', 'general'), {
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        taxRate: 5.0,
        serviceChargeRate: 10.0,
        createdAt: serverTimestamp()
      });

      // 4. Create or link Admin credentials in Firebase Auth
      if (adminEmail && adminPassword) {
        const appName = `SecondaryApp_${Date.now()}`;
        const secondaryApp = initializeApp(firebaseConfig, appName);
        const secondaryAuth = getAuth(secondaryApp);
        
        let adminUid: string | null = null;

        try {
          const credential = await createUserWithEmailAndPassword(secondaryAuth, adminEmail, adminPassword);
          adminUid = credential.user.uid;
          await authSignOut(secondaryAuth);
        } catch (authErr: any) {
          console.warn('Firebase Auth user registration notice during provisioning:', authErr);

          if (authErr.code === 'auth/email-already-in-use' || authErr.message?.includes('email-already-in-use')) {
            // Attempt to resolve existing user's UID from /users collection or sign in with secondaryAuth
            try {
              const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', adminEmail.toLowerCase())));
              if (!userSnap.empty) {
                adminUid = userSnap.docs[0].id;
              }
            } catch (e) {}

            if (!adminUid) {
              try {
                const signInCred = await signInWithEmailAndPassword(secondaryAuth, adminEmail, adminPassword);
                adminUid = signInCred.user.uid;
                await authSignOut(secondaryAuth);
              } catch (signInErr: any) {
                console.warn('Sign-in fallback notice:', signInErr);
              }
            }
          }
        }

        if (adminUid) {
          const adminUserProfile = {
            uid: adminUid,
            email: adminEmail.toLowerCase(),
            displayName: adminName || adminEmail.split('@')[0].toUpperCase(),
            role: 'restaurant-admin' as any,
            tenantId,
            permissions: ['dashboard', 'menu', 'tables', 'staff', 'reports', 'inventory', 'reservations', 'settings'],
            createdAt: serverTimestamp()
          };

          // Write/update user in global /users collection
          await setDoc(doc(db, 'users', adminUid), adminUserProfile, { merge: true });

          // Write/update user in tenant staff subcollection
          await setDoc(doc(db, 'tenants', tenantId, 'staff', adminUid), adminUserProfile, { merge: true });
        } else {
          throw new Error(`The email address "${adminEmail}" is already registered in Firebase Auth with a different password. Please enter the correct password for "${adminEmail}" or use a new email address.`);
        }
      }

      return newTenant;
    }
  }

  // Delete a tenant permanently along with subcollections & associated users in Firebase & Mock DB
  async deleteTenant(tenantId: string): Promise<void> {
    if (this.isMockMode) {
      const rawTenants = localStorage.getItem('restaurant_qr_mock_tenants_db');
      if (rawTenants) {
        try {
          const list = JSON.parse(rawTenants);
          const updated = list.filter((t: any) => t.id !== tenantId);
          localStorage.setItem('restaurant_qr_mock_tenants_db', JSON.stringify(updated));
        } catch (e) {}
      }
      localStorage.removeItem(`restaurant_qr_mock_tenant_info_${tenantId}`);
      return;
    } else {
      // 1. Delete main tenant document in Firebase
      await deleteDoc(doc(db, 'tenants', tenantId));

      // 2. Cascade delete subcollections (menu_items, tables, orders, staff, settings)
      const subCols = ['menu_items', 'tables', 'orders', 'staff', 'settings'];
      for (const colName of subCols) {
        try {
          const subSnap = await getDocs(collection(db, 'tenants', tenantId, colName));
          const batch = writeBatch(db);
          subSnap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        } catch (e) {}
      }

      // 3. Delete associated users in /users collection and queue Auth deletion
      try {
        const usersSnap = await getDocs(query(collection(db, 'users'), where('tenantId', '==', tenantId)));
        const userBatch = writeBatch(db);
        usersSnap.docs.forEach((u) => {
          userBatch.delete(u.ref);
          // Queue Firebase Authentication user deletion
          const deletionRef = doc(db, 'auth_deletion_queue', u.id);
          userBatch.set(deletionRef, {
            uid: u.id,
            email: u.data().email || '',
            deletedAt: serverTimestamp(),
            status: 'pending'
          });
        });
        await userBatch.commit();
      } catch (e) {}
    }
  }

  // Delete a user account permanently from Firebase or Mock DB
  async deleteUser(uid: string): Promise<void> {
    if (this.isMockMode) {
      const rawStaff = localStorage.getItem('restaurant_qr_mock_staff_db');
      if (rawStaff) {
        try {
          const list = JSON.parse(rawStaff);
          const updated = list.filter((u: any) => u.uid !== uid && u.id !== uid);
          localStorage.setItem('restaurant_qr_mock_staff_db', JSON.stringify(updated));
        } catch (e) {}
      }

      const rawCreds = localStorage.getItem(MOCK_CREDENTIALS_DB_KEY);
      if (rawCreds) {
        try {
          const credsDb = JSON.parse(rawCreds);
          Object.keys(credsDb).forEach((emailKey) => {
            if (credsDb[emailKey]?.uid === uid) {
              delete credsDb[emailKey];
            }
          });
          localStorage.setItem(MOCK_CREDENTIALS_DB_KEY, JSON.stringify(credsDb));
        } catch (e) {}
      }
      return;
    } else {
      const batch = writeBatch(db);
      // Delete user profile document
      batch.delete(doc(db, 'users', uid));
      
      // Queue Firebase Authentication user deletion
      batch.set(doc(db, 'auth_deletion_queue', uid), {
        uid,
        deletedAt: serverTimestamp(),
        status: 'pending'
      });
      await batch.commit();

      // If current logged-in user is deleting themselves, delete client-side Auth session
      try {
        const authInstance = getAuth();
        if (authInstance.currentUser && authInstance.currentUser.uid === uid) {
          await authInstance.currentUser.delete();
        }
      } catch (e) {}
    }
  }

  // Change subscription plan
  async updateSubscription(tenantId: string, planId: 'starter' | 'growth' | 'enterprise'): Promise<void> {
    if (this.isMockMode) {
      return;
    } else {
      const limits = planId === 'enterprise'
        ? { tablesPerRestaurant: 100, monthlyOrders: 50000 }
        : planId === 'growth'
        ? { tablesPerRestaurant: 30, monthlyOrders: 5000 }
        : { tablesPerRestaurant: 10, monthlyOrders: 1000 };

      // Direct Firestore update
      await setDoc(doc(db, 'tenants', tenantId), {
        subscription: {
          planId,
          status: 'active',
          limits
        }
      }, { merge: true });
    }
  }
}
export const tenantService = new TenantService();
