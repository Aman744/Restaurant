import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { auth, db } from '../../../lib/firebase.js';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { UserRepository } from '@restaurant-qr/infra';
import type { UserRole, UserProfile } from '@restaurant-qr/core';

// Unified interface representing a logged-in identity (real or mock)
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  getIdTokenResult: (forceRefresh?: boolean) => Promise<{ claims: Record<string, any> }>;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  signUp: (email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  isMockMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MOCK_USER_KEY = 'restaurant_qr_mock_auth_user';
const MOCK_CREDENTIALS_DB_KEY = 'restaurant_qr_mock_credentials_db';

// Helper to hash passwords securely using browser native Web Crypto API (SHA-256)
export const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  const isMockMode = !import.meta.env.VITE_FIREBASE_API_KEY || 
                     import.meta.env.VITE_FIREBASE_API_KEY === 'your_api_key_here';

  useEffect(() => {
    if (isMockMode) {
      // Mock mode recovery
      const stored = localStorage.getItem(MOCK_USER_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          
          let currentRole = parsed.claims?.role || 'customer';
          if (parsed.email) {
            const emailLower = parsed.email.toLowerCase();
            if (emailLower.startsWith('superadmin') || emailLower.includes('superadmin')) {
              currentRole = 'super-admin';
            }
          }
          const updatedClaims = {
            ...parsed.claims,
            role: currentRole,
            tenantId: currentRole === 'super-admin' ? null : (parsed.claims?.tenantId || 'tenant_dev_123')
          };

          setUser({
            uid: parsed.uid,
            email: parsed.email,
            displayName: parsed.displayName,
            getIdTokenResult: async () => ({
              claims: updatedClaims
            })
          });
        } catch (e) {
          localStorage.removeItem(MOCK_USER_KEY);
        }
      }
      setLoading(false);
    } else {
      // Live Firebase listener
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: any) => {
        if (firebaseUser) {
          setUser(firebaseUser as AuthUser);
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      return unsubscribe;
    }
  }, [isMockMode]);

  const login = async (email: string, password = '') => {
    setLoading(true);
    try {
      if (isMockMode) {
        // Retrieve credentials list
        const rawDb = localStorage.getItem(MOCK_CREDENTIALS_DB_KEY);
        const credentialsDb = rawDb ? JSON.parse(rawDb) : {};

        const hashedInput = await hashPassword(password);
        const storedUser = credentialsDb[email.toLowerCase()];

        // If not in database, check seed fallbacks for easier local test
        if (!storedUser) {
          if (password === 'Admin@123') {
            let role = 'customer';
            if (email.startsWith('superadmin') || email.includes('superadmin')) role = 'super-admin';
            else if (email.startsWith('admin')) role = 'restaurant-admin';
            else if (email.startsWith('manager')) role = 'manager';
            else if (email.startsWith('kitchen')) role = 'kitchen-staff';
            else if (email.startsWith('waiter')) role = 'waiter';
            else if (email.startsWith('cashier')) role = 'cashier';

            const mockClaims = {
              role,
              tenantId: role === 'super-admin' ? null : 'tenant_dev_123'
            };

            const mockUser = {
              uid: `mock_uid_${email.split('@')[0]}`,
              email,
              displayName: email.split('@')[0].toUpperCase(),
              claims: mockClaims
            };

            setUser({
              uid: mockUser.uid,
              email: mockUser.email,
              displayName: mockUser.displayName,
              getIdTokenResult: async () => ({ claims: mockClaims })
            });
            localStorage.setItem(MOCK_USER_KEY, JSON.stringify(mockUser));
            return;
          }
          throw new Error('User not found. Please click "Create Account" first.');
        }

        // Verify password hash
        if (storedUser.passwordHash !== hashedInput) {
          throw new Error('Invalid email or password.');
        }

        let resolvedRole = storedUser.claims?.role || 'customer';
        if (email.toLowerCase().startsWith('superadmin') || email.toLowerCase().includes('superadmin')) {
          resolvedRole = 'super-admin';
        }
        const finalClaims = {
          ...storedUser.claims,
          role: resolvedRole,
          tenantId: resolvedRole === 'super-admin' ? null : (storedUser.claims?.tenantId || 'tenant_dev_123')
        };

        setUser({
          uid: storedUser.uid,
          email: storedUser.email,
          displayName: storedUser.displayName,
          getIdTokenResult: async () => ({ claims: finalClaims })
        });
        localStorage.setItem(MOCK_USER_KEY, JSON.stringify({
          ...storedUser,
          claims: finalClaims
        }));
      } else {
        // Real Firebase login
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const uid = credential.user.uid;

        // Ensure /users/{uid} document exists so Firestore rules can resolve role.
        // Uses merge:true — never overwrites existing real profile data.
        const userDocRef = doc(db, 'users', uid);
        const existing = await getDoc(userDocRef);
        if (!existing.exists()) {
          // Infer role from email prefix as a safe bootstrap default
          // (the real role is set properly during account provisioning via Super Admin)
          let inferredRole = 'restaurant-admin';
          if (email.startsWith('superadmin') || email.includes('superadmin')) inferredRole = 'super-admin';

          // Use the Firebase Auth UID as the stable tenantId.
          // This guarantees menu items always land at /tenants/{uid}/... consistently.
          const tenantId = inferredRole === 'super-admin' ? null : `tenant_${uid}`;

          await setDoc(userDocRef, {
            uid,
            email: email.toLowerCase(),
            displayName: credential.user.displayName || email.split('@')[0].toUpperCase(),
            role: inferredRole,
            tenantId,
            permissions: inferredRole === 'super-admin' ? ['all'] : ['dashboard', 'menu', 'tables', 'staff'],
            createdAt: new Date()
          }, { merge: true });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, role: UserRole) => {
    setLoading(true);
    try {
      if (isMockMode) {
        const hashed = await hashPassword(password);
        const rawDb = localStorage.getItem(MOCK_CREDENTIALS_DB_KEY);
        const credentialsDb = rawDb ? JSON.parse(rawDb) : {};

        if (credentialsDb[email.toLowerCase()]) {
          throw new Error('Account with this email already exists.');
        }

        const mockClaims = {
          role,
          tenantId: role === 'super-admin' ? null : 'tenant_dev_123'
        };

        const mockUser = {
          uid: `mock_uid_${Math.floor(Math.random() * 100000)}`,
          email,
          displayName: email.split('@')[0].toUpperCase(),
          passwordHash: hashed,
          claims: mockClaims
        };

        credentialsDb[email.toLowerCase()] = mockUser;
        localStorage.setItem(MOCK_CREDENTIALS_DB_KEY, JSON.stringify(credentialsDb));

        // Auto login on registration
        setUser({
          uid: mockUser.uid,
          email: mockUser.email,
          displayName: mockUser.displayName,
          getIdTokenResult: async () => ({ claims: mockClaims })
        });
        localStorage.setItem(MOCK_USER_KEY, JSON.stringify(mockUser));
      } else {
        // Real Firebase signup
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Write the custom user profile document to Firestore
        const userRepo = new UserRepository(db);
        const profile: UserProfile = {
          uid: credential.user.uid,
          email: email.toLowerCase(),
          displayName: email.split('@')[0].toUpperCase(),
          role,
          tenantId: role === 'super-admin' ? undefined : 'tenant_dev_123',
          permissions: role === 'super-admin' ? ['all'] : ['dashboard', 'menu', 'tables', 'staff'],
          createdAt: new Date()
        };
        await userRepo.save(profile);
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (isMockMode) {
        setUser(null);
        localStorage.removeItem(MOCK_USER_KEY);
      } else {
        await signOut(auth);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signUp, logout, isMockMode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
