import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as authSignOut } from 'firebase/auth';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
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
      const hashed = await hashPasswordLocal(adminPassword);
      const rawDb = localStorage.getItem(MOCK_CREDENTIALS_DB_KEY);
      const credentialsDb = rawDb ? JSON.parse(rawDb) : {};

      const mockClaims = {
        role: 'restaurant-admin',
        tenantId: newTenantId
      };

      const mockUser = {
        uid: `mock_uid_${Math.floor(Math.random() * 100000)}`,
        email: adminEmail,
        displayName: adminName || adminEmail.split('@')[0].toUpperCase(),
        passwordHash: hashed,
        claims: mockClaims
      };

      credentialsDb[adminEmail.toLowerCase()] = mockUser;
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

      // 4. Create initial Admin credentials in Firebase Auth
      if (adminEmail && adminPassword) {
        const appName = `SecondaryApp_${Date.now()}`;
        const secondaryApp = initializeApp(firebaseConfig, appName);
        const secondaryAuth = getAuth(secondaryApp);
        
        try {
          const credential = await createUserWithEmailAndPassword(secondaryAuth, adminEmail, adminPassword);
          const adminUid = credential.user.uid;
          await authSignOut(secondaryAuth);

          // 5. Direct Firestore write: User profile document
          await setDoc(doc(db, 'users', adminUid), {
            uid: adminUid,
            email: adminEmail.toLowerCase(),
            displayName: adminName || adminEmail.split('@')[0].toUpperCase(),
            role: 'restaurant-admin',
            tenantId,
            permissions: ['dashboard', 'menu', 'tables', 'staff', 'reports', 'inventory', 'reservations', 'settings'],
            createdAt: serverTimestamp()
          });
        } catch (authErr: any) {
          console.error('Authentication user registration failed during tenant provisioning:', authErr);
          throw new Error(`Tenant provisioned, but failed to create Admin User account: ${authErr.message}`);
        }
      }

      return newTenant;
    }
  }

  // Delete a tenant permanently
  async deleteTenant(tenantId: string): Promise<void> {
    if (this.isMockMode) {
      return;
    } else {
      // Direct Firestore delete
      await deleteDoc(doc(db, 'tenants', tenantId));
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
