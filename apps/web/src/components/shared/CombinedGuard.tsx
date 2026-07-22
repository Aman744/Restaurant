import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermission } from '../../features/auth/context/PermissionContext';
import { useTenant } from '../../features/auth/context/TenantContext';
import { FeatureService } from '../../services/FeatureService';
import { useAuth } from '../../features/auth/context/AuthContext';
import { AccessDenied } from './AccessDenied';

interface CombinedGuardProps {
  feature?: string;
  permission?: string;
  children: React.ReactNode;
  fallbackRedirect?: string;
  showAccessDenied?: boolean;
}

export const CombinedGuard: React.FC<CombinedGuardProps> = ({
  feature,
  permission,
  children,
  fallbackRedirect,
  showAccessDenied = true
}) => {
  const { hasPermission, loading: permissionLoading } = usePermission();
  const { tenant, loading: tenantLoading } = useTenant();
  const { isMockMode } = useAuth();
  
  const [featureAllowed, setFeatureAllowed] = useState<boolean | null>(null);

  const loading = permissionLoading || tenantLoading;

  useEffect(() => {
    let active = true;
    const checkFeature = async () => {
      if (!feature) {
        if (active) setFeatureAllowed(true);
        return;
      }
      try {
        const allowed = await FeatureService.hasFeature(tenant, feature, isMockMode);
        if (active) setFeatureAllowed(allowed);
      } catch (e) {
        if (active) setFeatureAllowed(false);
      }
    };
    if (!loading) {
      checkFeature();
    }
    return () => { active = false; };
  }, [feature, tenant, loading, isMockMode]);

  if (loading || featureAllowed === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-xs font-semibold">Verifying credentials & licensing...</p>
        </div>
      </div>
    );
  }

  // 1. Check feature flag licensing
  if (!featureAllowed) {
    if (fallbackRedirect) {
      return <Navigate to={fallbackRedirect} replace />;
    }
    if (showAccessDenied) {
      return <AccessDenied />;
    }
    return null;
  }

  // 2. Check RBAC permissions
  if (permission && !hasPermission(permission)) {
    if (fallbackRedirect) {
      return <Navigate to={fallbackRedirect} replace />;
    }
    if (showAccessDenied) {
      return <AccessDenied />;
    }
    return null;
  }

  return <>{children}</>;
};
