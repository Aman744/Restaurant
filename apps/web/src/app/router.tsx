import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { ProtectedRoute } from '../components/shared/ProtectedRoute';
import { AccessDenied } from '../components/shared/AccessDenied';
import { LoginPortal } from '../pages/login/LoginPortal';
import { SuperAdminDashboard } from '../pages/super-admin/SuperAdminDashboard';
import { RestaurantAdminDashboard } from '../pages/admin/RestaurantAdminDashboard';
import { KitchenDashboard } from '../pages/kds/KitchenDashboard';
import { WaiterDashboard } from '../pages/waiter/WaiterDashboard';
import { CashierDashboard } from '../pages/cashier/CashierDashboard';
import { CustomerMenu } from '../pages/customer/CustomerMenu';
import { QRScanner } from '../pages/customer/QRScanner';
import { Store, ShieldCheck, ChefHat, Utensils, CreditCard, UserCheck, Smartphone } from 'lucide-react';

const RootIndex: React.FC = () => {
  return (
    <div className="flex min-h-screen w-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-white p-6">
      <div className="max-w-2xl text-center space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          Restaurant QR SaaS
        </h1>
        <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
          Enterprise Monorepo Blueprint. Click any portal below to inspect the interface and role permissions.
        </p>

        {/* Portals grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10 text-left">
          {/* Customer Portal */}
          <Link
            to="/customer/menu"
            className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-2xl hover:border-emerald-500/30 hover:bg-emerald-500/5 transition duration-300 flex items-start gap-4"
          >
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/15 rounded-xl text-emerald-400">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Customer QR Ordering</h3>
              <p className="text-xs text-zinc-500 mt-1">Simulate table scanning and placing orders.</p>
            </div>
          </Link>

          {/* Super Admin */}
          <Link
            to="/super-admin/login"
            className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-2xl hover:border-indigo-500/30 hover:bg-indigo-500/5 transition duration-300 flex items-start gap-4"
          >
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/15 rounded-xl text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Super Admin Portal</h3>
              <p className="text-xs text-zinc-500 mt-1">SaaS subscription & tenant management.</p>
            </div>
          </Link>

          {/* Restaurant Admin */}
          <Link
            to="/admin/login"
            className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-2xl hover:border-emerald-500/30 hover:bg-emerald-500/5 transition duration-300 flex items-start gap-4"
          >
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/15 rounded-xl text-emerald-400">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Restaurant Admin</h3>
              <p className="text-xs text-zinc-500 mt-1">Operations dashboard, menu controls.</p>
            </div>
          </Link>

          {/* Manager */}
          <Link
            to="/manager/login"
            className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-2xl hover:border-sky-500/30 hover:bg-sky-500/5 transition duration-300 flex items-start gap-4"
          >
            <div className="p-3 bg-sky-500/10 border border-sky-500/15 rounded-xl text-sky-400">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Manager Portal</h3>
              <p className="text-xs text-zinc-500 mt-1">Settlement controls & operations management.</p>
            </div>
          </Link>

          {/* Kitchen Display */}
          <Link
            to="/kitchen/login"
            className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-2xl hover:border-orange-500/30 hover:bg-orange-500/5 transition duration-300 flex items-start gap-4"
          >
            <div className="p-3 bg-orange-500/10 border border-orange-500/15 rounded-xl text-orange-400">
              <ChefHat className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Kitchen Display (KDS)</h3>
              <p className="text-xs text-zinc-500 mt-1">Order tracking and prep timing dashboards.</p>
            </div>
          </Link>

          {/* Waiter Service */}
          <Link
            to="/waiter/login"
            className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-2xl hover:border-amber-500/30 hover:bg-amber-500/5 transition duration-300 flex items-start gap-4"
          >
            <div className="p-3 bg-amber-500/10 border border-amber-500/15 rounded-xl text-amber-400">
              <Utensils className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Waiter Board</h3>
              <p className="text-xs text-zinc-500 mt-1">Table statuses maps & call alerts.</p>
            </div>
          </Link>

          {/* Cashier Billing */}
          <Link
            to="/cashier/login"
            className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-2xl hover:border-teal-500/30 hover:bg-teal-500/5 transition duration-300 flex items-start gap-4 sm:col-span-2"
          >
            <div className="p-3 bg-teal-500/10 border border-teal-500/15 rounded-xl text-teal-400">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Cashier POS Billing</h3>
              <p className="text-xs text-zinc-500 mt-1">Bill splitting and receipt settlements.</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};
export const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* Root Portal Showcase */}
      <Route path="/" element={<RootIndex />} />

      {/* Login Portals */}
      <Route path="/super-admin/login" element={<LoginPortal />} />
      <Route path="/admin/login" element={<LoginPortal />} />
      <Route path="/manager/login" element={<LoginPortal />} />
      <Route path="/kitchen/login" element={<LoginPortal />} />
      <Route path="/waiter/login" element={<LoginPortal />} />
      <Route path="/cashier/login" element={<LoginPortal />} />

      {/* Protected Routes */}
      <Route
        path="/super-admin"
        element={
          <ProtectedRoute allowedRoles={['super-admin']}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/super-admin/tenants"
        element={
          <ProtectedRoute allowedRoles={['super-admin']}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/super-admin/subscriptions"
        element={
          <ProtectedRoute allowedRoles={['super-admin']}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/super-admin/settings"
        element={
          <ProtectedRoute allowedRoles={['super-admin']}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['restaurant-admin', 'manager', 'super-admin']}>
            <RestaurantAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/menu"
        element={
          <ProtectedRoute allowedRoles={['restaurant-admin', 'manager', 'super-admin']}>
            <RestaurantAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/tables"
        element={
          <ProtectedRoute allowedRoles={['restaurant-admin', 'manager', 'super-admin']}>
            <RestaurantAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/staff"
        element={
          <ProtectedRoute allowedRoles={['restaurant-admin', 'manager', 'super-admin']}>
            <RestaurantAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute allowedRoles={['restaurant-admin', 'manager', 'super-admin']}>
            <RestaurantAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute allowedRoles={['restaurant-admin', 'manager', 'super-admin']}>
            <RestaurantAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/orders"
        element={
          <ProtectedRoute allowedRoles={['restaurant-admin', 'manager', 'super-admin']}>
            <RestaurantAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager"
        element={
          <ProtectedRoute allowedRoles={['manager', 'restaurant-admin']}>
            <RestaurantAdminDashboard /> {/* Reusing core admin board for showcase */}
          </ProtectedRoute>
        }
      />
      <Route
        path="/kitchen"
        element={
          <ProtectedRoute allowedRoles={['kitchen-staff', 'manager', 'restaurant-admin']}>
            <KitchenDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/kitchen/availability"
        element={
          <ProtectedRoute allowedRoles={['kitchen-staff', 'manager', 'restaurant-admin']}>
            <KitchenDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/waiter"
        element={
          <ProtectedRoute allowedRoles={['waiter', 'manager', 'restaurant-admin']}>
            <WaiterDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cashier"
        element={
          <ProtectedRoute allowedRoles={['cashier', 'manager', 'restaurant-admin']}>
            <CashierDashboard />
          </ProtectedRoute>
        }
      />

      {/* Customer QR Ordering Portal Routes (Mocked bypass of scan check) */}
      <Route path="/customer" element={<Navigate to="/customer/menu" replace />} />
      <Route path="/customer/" element={<Navigate to="/customer/menu" replace />} />
      <Route path="/customer/menu" element={<QRScanner />} />
      <Route path="/customer/menu/" element={<QRScanner />} />
      <Route
        path="/customer/table/:tenantId/:tableId"
        element={<CustomerMenu />}
      />

      {/* Fallback Pages */}
      <Route path="/403" element={<AccessDenied />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
