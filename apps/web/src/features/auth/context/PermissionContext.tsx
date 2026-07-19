import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUserProfile } from './UserContext.js';
import { useTenant } from './TenantContext.js';
import type { UserRole } from '@restaurant-qr/core';

interface PermissionContextType {
  role: UserRole | null;
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  isFeatureEnabled: (flag: string) => boolean;
  loading: boolean;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, loading: profileLoading } = useUserProfile();
  const { loading: tenantLoading } = useTenant();

  const [role, setRole] = useState<UserRole | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  
  // Combine profile and tenant loading states
  const loading = profileLoading || tenantLoading;

  useEffect(() => {
    if (profile) {
      setRole(profile.role);
      setPermissions(profile.permissions || []);
    } else {
      setRole(null);
      setPermissions([]);
    }
  }, [profile]);

  const hasPermission = (permission: string): boolean => {
    if (role === 'super-admin') return true;
    return permissions.includes(permission);
  };

  const isFeatureEnabled = (_flag: string): boolean => {
    // In production, flags are defined in the Tenant Document custom parameters.
    // For now, default them to enabled.
    return true;
  };

  return (
    <PermissionContext.Provider value={{ role, permissions, hasPermission, isFeatureEnabled, loading }}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermission = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermission must be used within a PermissionProvider');
  }
  return context;
};
