import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth, getRoleFromEmail } from './AuthContext.js';
import { db } from '../../../lib/firebase.js';
import { UserRepository } from '@restaurant-qr/infra';
import type { UserProfile, UserRole } from '@restaurant-qr/core';

interface UserContextType {
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading, isMockMode } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [impersonateTrigger, setImpersonateTrigger] = useState(0);

  useEffect(() => {
    const handleTrigger = () => {
      setImpersonateTrigger((prev) => prev + 1);
    };
    window.addEventListener('impersonation-changed', handleTrigger);
    window.addEventListener('storage', handleTrigger);
    return () => {
      window.removeEventListener('impersonation-changed', handleTrigger);
      window.removeEventListener('storage', handleTrigger);
    };
  }, []);

  const resolveProfile = async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Check for local storage impersonation overrides (for super-admin tenant management)
      const impRole = localStorage.getItem('impersonate_role');
      const impTenantId = localStorage.getItem('impersonate_tenantId');
      
      if (impRole && impTenantId) {
        setProfile({
          uid: user.uid,
          email: user.email || '',
          displayName: (user.displayName || user.email?.split('@')[0] || 'User') + ' (Impersonating)',
          role: impRole as UserRole,
          tenantId: impTenantId,
          permissions: getPermissionsForRole(impRole as UserRole),
          createdAt: new Date()
        });
        setLoading(false);
        return;
      }

      // 1. In production/live Firestore mode, query the users collection first to ensure the role matches Firestore
      if (!isMockMode) {
        const userRepo = new UserRepository(db);
        let dbProfile = await userRepo.getById(user.uid);

        // Resilient retry: wait up to 2 seconds (4 attempts, 500ms delay) for the document to be written (fixes signup/login race conditions)
        let attempts = 0;
        while (!dbProfile && attempts < 4) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          dbProfile = await userRepo.getById(user.uid);
          attempts++;
        }

        if (dbProfile) {
          const defaultPerms = getPermissionsForRole(dbProfile.role);
          dbProfile.permissions = Array.from(new Set([...(dbProfile.permissions || []), ...defaultPerms]));
          setProfile(dbProfile);
          setLoading(false);
          return;
        }
      }

      // 2. Fallback: Fetch claims from ID token (crucial for mock mode role simulation)
      const tokenResult = await user.getIdTokenResult();
      const claims = tokenResult.claims;

      if (claims.role) {
        setProfile({
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          role: claims.role as UserRole,
          tenantId: claims.tenantId || undefined,
          permissions: getPermissionsForRole(claims.role as UserRole),
          createdAt: new Date()
        });
        setLoading(false);
        return;
      }

      // 3. Fallback / Self-Healing: In case user doc is missing and claims are missing, infer from email and auto-create profile
      const inferredRole = getRoleFromEmail(user.email || '');
      if (inferredRole) {
        const userRepo = new UserRepository(db);
        const fallbackProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: (user.email?.split('@')[0] || 'User').toUpperCase(),
          role: inferredRole as UserRole,
          tenantId: inferredRole === 'super-admin' ? undefined : 'tenant_dev_123',
          permissions: getPermissionsForRole(inferredRole as UserRole),
          createdAt: new Date()
        };
        try {
          await userRepo.save(fallbackProfile);
          setProfile(fallbackProfile);
          setLoading(false);
          return;
        } catch (e) {
          console.error('Failed to auto-create fallback profile:', e);
        }
      }

      // 4. Access Denied (If claims are missing and no Firestore doc exists)
      setProfile(null);
    } catch (err) {
      console.error('Error resolving user profile:', err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      resolveProfile();
    }
  }, [user, authLoading, isMockMode, impersonateTrigger]);

  return (
    <UserContext.Provider value={{ profile, loading, refreshProfile: resolveProfile }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUserProfile = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUserProfile must be used within a UserProvider');
  }
  return context;
};

// Helper mapper for RBAC permissions list
function getPermissionsForRole(role: UserRole): string[] {
  switch (role) {
    case 'super-admin':
      return ['all'];
    case 'restaurant-admin':
      return ['dashboard', 'menu', 'tables', 'rooms', 'staff', 'reports', 'inventory', 'reservations', 'coupons', 'loyalty', 'settings'];
    case 'manager':
      return ['dashboard', 'orders', 'menu', 'tables', 'rooms', 'staff', 'reports', 'kitchen'];
    case 'kitchen-staff':
      return ['kds', 'order_status'];
    case 'waiter':
      return ['tables', 'requests', 'serve'];
    case 'cashier':
      return ['billing', 'payments', 'refunds', 'receipts'];
    default:
      return [];
  }
}
