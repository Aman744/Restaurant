import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/context/AuthContext';
import { useUserProfile } from '../../features/auth/context/UserContext';
import type { UserRole } from '@restaurant-qr/core';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const location = useLocation();

  const loading = authLoading || profileLoading;

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="text-sm font-medium tracking-wide text-zinc-400">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    // Determine target login route based on the current URL prefix
    const path = location.pathname;
    let loginRedirect = '/admin/login';
    if (path.startsWith('/super-admin')) {
      loginRedirect = '/super-admin/login';
    } else if (path.startsWith('/manager')) {
      loginRedirect = '/manager/login';
    } else if (path.startsWith('/kitchen')) {
      loginRedirect = '/kitchen/login';
    } else if (path.startsWith('/waiter')) {
      loginRedirect = '/waiter/login';
    } else if (path.startsWith('/cashier')) {
      loginRedirect = '/cashier/login';
    }

    return <Navigate to={loginRedirect} state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
};
