import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUserProfile } from './UserContext.js';
import { useTenant } from './TenantContext.js';
import { useAuth } from './AuthContext.js';
import { FeatureService } from '../../../services/FeatureService.js';
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
  const { tenant, loading: tenantLoading } = useTenant();
  const { isMockMode } = useAuth();

  const [role, setRole] = useState<UserRole | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [effectiveFeatures, setEffectiveFeatures] = useState<Record<string, boolean>>({});
  
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

  // Load and cache effective features dynamically
  useEffect(() => {
    let active = true;
    const fetchFeatures = async () => {
      if (tenant) {
        const flags = await FeatureService.getEffectiveFeatures(tenant, isMockMode);
        if (active) {
          setEffectiveFeatures(flags);
        }
      } else {
        if (active) {
          setEffectiveFeatures({});
        }
      }
    };
    if (!tenantLoading) {
      fetchFeatures();
    }
    return () => { active = false; };
  }, [tenant, tenantLoading, isMockMode]);

  const hasPermission = (permission: string): boolean => {
    if (role === 'super-admin') return true;
    return permissions.includes(permission);
  };

  const isFeatureEnabled = (flag: string): boolean => {
    return !!effectiveFeatures[flag];
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
