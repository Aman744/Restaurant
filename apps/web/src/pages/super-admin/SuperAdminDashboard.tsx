import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/shared/DashboardLayout';
import { useUserProfile } from '../../features/auth/context/UserContext';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase.js';
import { TenantConverter } from '@restaurant-qr/infra';
import { useAuth } from '../../features/auth/context/AuthContext.js';
import { tenantService } from '../../services/TenantService.js';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Settings,
  Plus,
  Globe,
  Database,
  ArrowRight,
  ShieldCheck,
  Server,
  Zap,
  Sliders,
  Edit3,
  Trash2,
  Loader2,
  Building2,
  Sparkles,
  X
} from 'lucide-react';
import type { Tenant, UserProfile } from '@restaurant-qr/core';
import { useToast } from '../../components/shared/ToastContext';
import { useConfirm } from '../../components/shared/ConfirmContext';

const MOCK_TENANTS_KEY = 'restaurant_qr_mock_tenants_db';

export const SuperAdminDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshProfile } = useUserProfile();
  const { isMockMode } = useAuth();
  const toast = useToast();
  const { confirm } = useConfirm();
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<{ id: string; name: string } | null>(null);
  
  const sidebarItems = [
    { name: 'Dashboard', path: '/super-admin', icon: LayoutDashboard },
    { name: 'Tenants', path: '/super-admin/tenants', icon: Users },
    { name: 'Users', path: '/super-admin/users', icon: ShieldCheck },
    { name: 'Subscriptions', path: '/super-admin/subscriptions', icon: CreditCard },
    { name: 'Settings', path: '/super-admin/settings', icon: Settings },
  ];

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [activeUserSubTab, setActiveUserSubTab] = useState<'super-admin' | 'restaurant-admin' | 'other'>('super-admin');

  const [showAddModal, setShowAddModal] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantPlan, setNewTenantPlan] = useState<'starter' | 'growth' | 'enterprise'>('starter');
  const [newTenantDomain, setNewTenantDomain] = useState('');

  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminName, setAdminName] = useState('');

  // Feature Flags state
  const [featureFlags, setFeatureFlags] = useState({
    aiRecommendations: true,
    offlineQueue: true,
    escposPrinters: true,
    whatsappIntegrations: false,
    analyticsDashboard: true,
  });

  // White label default state
  const [whiteLabelConfig, setWhiteLabelConfig] = useState({
    defaultTheme: 'dark',
    primaryColor: '#059669',
    fontFamily: 'Inter',
    pwaThemeColor: '#059669',
  });
  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // 1. Data synchronization hooks
  useEffect(() => {
    let active = true;

    if (isMockMode) {
      setDbConnected(true);
      // Mock persistence
      const stored = localStorage.getItem(MOCK_TENANTS_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setTenants(parsed.map((t: any) => ({
            ...t,
            createdAt: new Date(t.createdAt),
            subscription: {
              ...t.subscription,
              currentPeriodEnd: new Date(t.subscription.currentPeriodEnd)
            }
          })));
        } catch (e) {
          localStorage.removeItem(MOCK_TENANTS_KEY);
        }
      }

      const storedCreds = localStorage.getItem('restaurant_qr_mock_credentials_db');
      if (storedCreds) {
        try {
          const parsed = JSON.parse(storedCreds);
          const users: UserProfile[] = Object.values(parsed).map((u: any) => ({
            uid: u.uid || u.id,
            email: u.email,
            displayName: u.displayName || u.email.split('@')[0].toUpperCase(),
            role: u.claims?.role || u.role || 'restaurant-admin',
            tenantId: u.claims?.tenantId || u.tenantId,
            createdAt: u.createdAt ? new Date(u.createdAt) : new Date()
          }));
          // Add default super admin
          users.unshift({
            uid: 'superadmin_uid_123',
            email: 'admin@antigravity.com',
            displayName: 'Antigravity Super Admin',
            role: 'super-admin',
            createdAt: new Date()
          });
          setUsersList(users);
        } catch (e) {}
      } else {
        setUsersList([
          {
            uid: 'superadmin_uid_123',
            email: 'admin@antigravity.com',
            displayName: 'Antigravity Super Admin',
            role: 'super-admin',
            createdAt: new Date()
          }
        ]);
      }
      setLoading(false);
    } else {
      // Real-time Firestore sync
      const colRef = collection(db, 'tenants').withConverter(TenantConverter);
      const unsubscribe = onSnapshot(colRef, (snap: any) => {
        setDbConnected(true);
        if (active) {
          setTenants(snap.docs.map((d: any) => d.data()));
          setLoading(false);
        }
      }, (err: any) => {
        console.error('Firestore tenants subscription error:', err);
        setDbConnected(false);
        if (active) setLoading(false);
      });

      const usersCol = collection(db, 'users');
      const unsubscribeUsers = onSnapshot(usersCol, (snap: any) => {
        setDbConnected(true);
        if (active) {
          const fetchedUsers = snap.docs.map((d: any) => {
            const data = d.data();
            const toDate = (val: any): Date => {
              if (!val) return new Date();
              if (typeof val.toDate === 'function') return val.toDate();
              return new Date(val);
            };
            return {
              uid: d.id,
              email: data.email || '',
              displayName: data.displayName || '',
              role: data.role || 'restaurant-admin',
              tenantId: data.tenantId || undefined,
              createdAt: toDate(data.createdAt)
            } as UserProfile;
          });
          setUsersList(fetchedUsers);
        }
      }, (err: any) => {
        console.error('Firestore users subscription error:', err);
        setDbConnected(false);
      });

      return () => {
        unsubscribe();
        unsubscribeUsers();
        active = false;
      };
    }
  }, [isMockMode]);

  // Load Feature Flags and White Labeling config
  useEffect(() => {
    let active = true;
    const loadSystemSettings = async () => {
      if (isMockMode) {
        const cachedFlags = localStorage.getItem('restaurant_qr_system_flags');
        if (cachedFlags && active) {
          try { setFeatureFlags(JSON.parse(cachedFlags)); } catch (e) {}
        }
        const cachedWhiteLabel = localStorage.getItem('restaurant_qr_system_whitelabel');
        if (cachedWhiteLabel && active) {
          try { setWhiteLabelConfig(JSON.parse(cachedWhiteLabel)); } catch (e) {}
        }
      } else {
        try {
          const docRef = doc(db, 'system_settings', 'general');
          const snap = await getDoc(docRef);
          if (snap.exists() && active) {
            const data = snap.data();
            if (data.featureFlags) setFeatureFlags(data.featureFlags);
            if (data.whiteLabelConfig) setWhiteLabelConfig(data.whiteLabelConfig);
          }
        } catch (e) {
          console.error(e);
        }
      }
    };
    loadSystemSettings();
    return () => { active = false; };
  }, [isMockMode]);

  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      if (isMockMode) {
        const stored = localStorage.getItem('restaurant_qr_mock_orders_db');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (active) setActiveOrdersCount(parsed.length);
          } catch (e) {}
        }
      } else {
        try {
          const statsSnap = await getDoc(doc(db, 'system_settings', 'stats'));
          if (statsSnap.exists()) {
            const data = statsSnap.data();
            if (active) setActiveOrdersCount(data.totalOrders || 0);
          } else {
            if (active) setActiveOrdersCount(0);
          }
        } catch (e) {
          console.error(e);
        }
      }
    };
    fetchStats();
    return () => { active = false; };
  }, [isMockMode, tenants]);

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName.trim() || isProvisioning) return;

    setIsProvisioning(true);
    try {
      const newTenant = await tenantService.provisionTenant(
        newTenantName,
        newTenantPlan,
        newTenantDomain.trim() || undefined,
        adminEmail.trim() || undefined,
        adminPassword || undefined,
        adminName.trim() || undefined
      );

      if (isMockMode) {
        const updated = [...tenants, newTenant];
        setTenants(updated);
        localStorage.setItem(MOCK_TENANTS_KEY, JSON.stringify(updated));
      }

      toast.success(`Tenant "${newTenantName}" provisioned successfully.`);
      setNewTenantName('');
      setNewTenantDomain('');
      setAdminEmail('');
      setAdminPassword('');
      setAdminName('');
      setShowAddModal(false);
    } catch (err: any) {
      toast.error(`Failed to provision tenant: ${err.message}`);
    } finally {
      setIsProvisioning(false);
    }
  };

  const requestDeleteTenant = (id: string, name: string) => {
    setTenantToDelete({ id, name });
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteTenant = async () => {
    if (!tenantToDelete || isDeleting) return;
    const { id, name } = tenantToDelete;
    setIsDeleting(true);
    try {
      await tenantService.deleteTenant(id);

      if (isMockMode) {
        const updated = tenants.filter((t) => t.id !== id);
        setTenants(updated);
        localStorage.setItem(MOCK_TENANTS_KEY, JSON.stringify(updated));
      } else {
        await deleteDoc(doc(db, 'tenants', id));
      }
      toast.success(`Tenant "${name}" deleted successfully.`);
    } catch (err: any) {
      toast.error(`Failed to delete tenant: ${err.message}`);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirmModal(false);
      setTenantToDelete(null);
    }
  };

  const handleDeleteUser = (user: UserProfile) => {
    if (user.role === 'super-admin' && usersList.filter(u => u.role === 'super-admin').length <= 1) {
      toast.error('Cannot delete the last Super Admin account.');
      return;
    }

    confirm({
      title: 'Delete User Account?',
      message: `Are you sure you want to permanently delete "${user.displayName}" (${user.email})? This will delete their access profile and request user account deletion from Firebase Authentication.`,
      confirmText: 'Delete User',
      onConfirm: async () => {
        await tenantService.deleteUser(user.uid);
        toast.success(`User "${user.displayName}" deleted successfully.`);
      }
    });
  };

  const handleToggleStatus = async (id: string) => {
    const tenant = tenants.find(t => t.id === id);
    if (!tenant) return;

    const nextStatus = (tenant.subscription.status === 'active' ? 'canceled' : 'active') as "active" | "trialing" | "past_due" | "canceled";
    try {
      if (isMockMode) {
        const updated = tenants.map((t) => {
          if (t.id === id) {
            return {
              ...t,
              subscription: { ...t.subscription, status: nextStatus }
            };
          }
          return t;
        });
        setTenants(updated);
        localStorage.setItem(MOCK_TENANTS_KEY, JSON.stringify(updated));
      } else {
        await updateDoc(doc(db, 'tenants', id), {
          'subscription.status': nextStatus
        });
      }
      toast.success(`Tenant status updated to "${nextStatus}".`);
    } catch (err: any) {
      toast.error(`Failed to update status: ${err.message}`);
    }
  };

  const handleChangePlan = async (id: string, planId: 'starter' | 'growth' | 'enterprise') => {
    try {
      await tenantService.updateSubscription(id, planId);

      if (isMockMode) {
        const updated = tenants.map((t) => {
          if (t.id === id) {
            return {
              ...t,
              subscription: {
                ...t.subscription,
                planId,
                limits: planId === 'enterprise'
                  ? { tablesPerRestaurant: 100, monthlyOrders: 50000 }
                  : planId === 'growth'
                  ? { tablesPerRestaurant: 30, monthlyOrders: 5000 }
                  : { tablesPerRestaurant: 10, monthlyOrders: 1000 }
              }
            };
          }
          return t;
        });
        setTenants(updated);
        localStorage.setItem(MOCK_TENANTS_KEY, JSON.stringify(updated));
      } else {
        const limits = planId === 'enterprise'
          ? { tablesPerRestaurant: 100, monthlyOrders: 50000 }
          : planId === 'growth'
          ? { tablesPerRestaurant: 30, monthlyOrders: 5000 }
          : { tablesPerRestaurant: 10, monthlyOrders: 1000 };

        await updateDoc(doc(db, 'tenants', id), {
          'subscription.planId': planId,
          'subscription.limits': limits
        });
      }
      toast.success(`Subscription plan successfully updated to ${planId.toUpperCase()}.`);
    } catch (err: any) {
      toast.error(`Failed to change plan: ${err.message}`);
    }
  };

  const handleToggleFeatureOverride = async (id: string, featureKey: string, enabled: boolean) => {
    try {
      if (isMockMode) {
        const updated = tenants.map((t) => {
          if (t.id === id) {
            const features = t.features || {};
            return { ...t, features: { ...features, [featureKey]: enabled } };
          }
          return t;
        });
        setTenants(updated);
        localStorage.setItem(MOCK_TENANTS_KEY, JSON.stringify(updated));
      } else {
        await updateDoc(doc(db, 'tenants', id), {
          [`features.${featureKey}`]: enabled
        });
      }
      toast.success(`Feature override for "${featureKey}" updated successfully.`);
    } catch (err: any) {
      toast.error(`Failed to update feature override: ${err.message}`);
    }
  };

  const handleEditDomain = async (id: string) => {
    const tenant = tenants.find((t) => t.id === id);
    if (!tenant) return;

    const nextDomain = window.prompt('Enter new custom domain mapping:', tenant.domain || '');
    if (nextDomain !== null) {
      const formattedDomain = nextDomain.trim() || null;
      try {
        if (isMockMode) {
          const updated = tenants.map((t) => (t.id === id ? { ...t, domain: formattedDomain || undefined } : t));
          setTenants(updated);
          localStorage.setItem(MOCK_TENANTS_KEY, JSON.stringify(updated));
        } else {
          await updateDoc(doc(db, 'tenants', id), {
            domain: formattedDomain
          });
        }
        toast.success(formattedDomain ? `Custom domain mapped to: ${formattedDomain}` : 'Custom domain mapping removed.');
      } catch (err: any) {
        toast.error(`Failed to update domain: ${err.message}`);
      }
    }
  };

  const toggleFlag = (flagKey: keyof typeof featureFlags) => {
    setFeatureFlags((prev) => ({ ...prev, [flagKey]: !prev[flagKey] }));
  };

  const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleImpersonate = async (targetTenantId: string, tenantName: string) => {
    localStorage.setItem('impersonate_role', 'restaurant-admin');
    localStorage.setItem('impersonate_tenantId', targetTenantId);
    localStorage.setItem('impersonate_tenantName', tenantName);
    toast.success(`Entering Impersonation mode for restaurant: "${tenantName}" as Restaurant Admin.`);
    navigate('/admin');
    await refreshProfile();
  };

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isMockMode) {
        localStorage.setItem('restaurant_qr_system_flags', JSON.stringify(featureFlags));
        localStorage.setItem('restaurant_qr_system_whitelabel', JSON.stringify(whiteLabelConfig));
        toast.success('Platform settings saved successfully in Sandbox!');
        setTimeout(() => { window.location.reload(); }, 1000);
      } else {
        await setDoc(doc(db, 'system_settings', 'general'), {
          featureFlags,
          whiteLabelConfig,
          updatedAt: new Date()
        }, { merge: true });
        toast.success('Platform settings saved successfully in Firebase!');
        setTimeout(() => { window.location.reload(); }, 1000);
      }
    } catch (err: any) {
      toast.error(`Failed to save settings: ${err.message}`);
    }
  };

  const handleChangeSuperAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      toast.warning('Please fill out all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.warning('New passwords do not match.');
      return;
    }
    try {
      if (isMockMode) {
        const hashedCurrent = await hashPassword(currentPassword);
        const hashedNew = await hashPassword(newPassword);
        const rawDb = localStorage.getItem('restaurant_qr_mock_credentials_db');
        if (rawDb) {
          const credentialsDb = JSON.parse(rawDb);
          const userEmail = 'superadmin@admin.com';
          const userObj = credentialsDb[userEmail];
          if (userObj) {
            if (userObj.passwordHash !== hashedCurrent) {
              throw new Error('Current password is incorrect.');
            }
            userObj.passwordHash = hashedNew;
            localStorage.setItem('restaurant_qr_mock_credentials_db', JSON.stringify(credentialsDb));
            toast.success('Super Admin password updated successfully in Sandbox!');
          } else {
            throw new Error('Super Admin mock account credentials not found.');
          }
        }
      } else {
        const authUser = auth.currentUser;
        if (!authUser) throw new Error('No active user session found.');
        const email = authUser.email || '';
        const credential = EmailAuthProvider.credential(email, currentPassword);
        await reauthenticateWithCredential(authUser, credential);
        await updatePassword(authUser, newPassword);
        toast.success('Super Admin password updated successfully!');
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(`Failed to change password: ${err.message}`);
    }
  };

  const formatCreatedAt = (date: any): string => {
    if (!date) return '';
    try {
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString();
    } catch (e) {
      return '';
    }
  };

  // Determine current tab based on router pathname
  const path = location.pathname;
  let activeTab = 'overview';
  if (path.endsWith('/tenants')) activeTab = 'tenants';
  else if (path.endsWith('/users')) activeTab = 'users';
  else if (path.endsWith('/subscriptions')) activeTab = 'subscriptions';
  else if (path.endsWith('/settings')) activeTab = 'settings';

  return (
    <DashboardLayout title="Super Admin Dashboard" sidebarItems={sidebarItems}>
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
        </div>
      ) : activeTab === 'overview' ? (
        <div className="space-y-6">
          {/* SaaS Metrics */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border border-zinc-900 bg-zinc-900/30 p-5 rounded-2xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Monthly Recurring Revenue</p>
              <h3 className="text-2xl font-bold text-white mt-1.5">
                ₹{tenants.reduce((sum, t) => sum + (t.subscription.planId === 'enterprise' ? 499 : t.subscription.planId === 'growth' ? 249 : 99), 0)}
              </h3>
              <span className="text-[10px] text-emerald-400 font-medium">Derived from active tenants list</span>
            </div>
            <div className="border border-zinc-900 bg-zinc-900/30 p-5 rounded-2xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Active Tenants</p>
              <h3 className="text-2xl font-bold text-white mt-1.5">{tenants.length}</h3>
              <span className="text-[10px] text-zinc-500 font-medium">Provisioned in multi-tenant cluster</span>
            </div>
            <div className="border border-zinc-900 bg-zinc-900/30 p-5 rounded-2xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Active Orders</p>
              <h3 className="text-2xl font-bold text-white mt-1.5">{activeOrdersCount}</h3>
              <span className="text-[10px] text-zinc-500 font-medium">Synced across all active portals</span>
            </div>
            <div className="border border-zinc-900 bg-zinc-900/30 p-5 rounded-2xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Database Connection</p>
              <h3 className={`text-2xl font-bold mt-1.5 ${dbConnected === true ? 'text-emerald-400' : dbConnected === false ? 'text-red-400' : 'text-amber-400'}`}>
                {dbConnected === true ? 'Connected' : dbConnected === false ? 'Disconnected' : 'Connecting...'}
              </h3>
              <span className="text-[10px] text-zinc-500 font-medium">
                {isMockMode ? 'Sandbox LocalStorage DB' : 'Google Cloud Firestore'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* System Health Logs */}
            <div className="lg:col-span-2 border border-zinc-900 bg-zinc-900/20 p-5 rounded-2xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Server className="h-4 w-4 text-emerald-400" /> Platform Infrastructure Audit
                </h3>
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping" />
                  Live Telemetry
                </span>
              </div>

              <div className="space-y-3.5 text-xs text-zinc-400">
                <div className="p-3 bg-zinc-950/60 border border-zinc-900 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Database className="h-4 w-4 text-indigo-400" />
                    <div>
                      <p className="font-semibold text-zinc-200">Daily Firestore Backup Complete</p>
                      <p className="text-[10px] text-zinc-500">Target Bucket: gs://restaurant-qr-backups-prod</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 border border-emerald-500/10 rounded-lg">
                    Success
                  </span>
                </div>

                <div className="p-3 bg-zinc-950/60 border border-zinc-900 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="h-4 w-4 text-violet-400" />
                    <div>
                      <p className="font-semibold text-zinc-200">App Check Validation Enabled</p>
                      <p className="text-[10px] text-zinc-500">Google reCAPTCHA Enterprise verification enforced</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-lg">
                    Enforced
                  </span>
                </div>

                <div className="p-3 bg-zinc-950/60 border border-zinc-900 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Zap className="h-4 w-4 text-amber-400" />
                    <div>
                      <p className="font-semibold text-zinc-200">Event Function: onOrderCreated</p>
                      <p className="text-[10px] text-zinc-500">Average trigger delay: 184ms</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 border border-emerald-500/10 rounded-lg">
                    Optimal
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="border border-zinc-900 bg-zinc-900/20 p-5 rounded-2xl space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="w-full text-left p-3 border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900/60 text-xs font-semibold rounded-xl text-zinc-200 flex items-center justify-between transition group"
                >
                  <span>Provision New Tenant</span>
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
                </button>
                <a
                  href="/super-admin/settings"
                  className="w-full text-left p-3 border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900/60 text-xs font-semibold rounded-xl text-zinc-200 flex items-center justify-between transition group"
                >
                  <span>Manage Platform Flags</span>
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'tenants' ? (
        <div className="space-y-6">
          <div className="border border-zinc-900 bg-zinc-900/20 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-900/10">
              <div>
                <h3 className="text-base font-bold text-white">Tenant Registry</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Manage SaaS accounts, custom domains, and limits</p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 transition rounded-xl"
              >
                <Plus className="h-4 w-4" />
                Provision Tenant
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Tenant Name</th>
                    <th className="px-6 py-4">Subscription Plan</th>
                    <th className="px-6 py-4">Feature Overrides</th>
                    <th className="px-6 py-4">Limits (Tables)</th>
                    <th className="px-6 py-4">Domain Mapping</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Created At</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/60 text-sm">
                  {tenants.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-zinc-500 text-xs">
                        No tenants provisioned yet. Click "Provision Tenant" to add your first restaurant chain.
                      </td>
                    </tr>
                  ) : (
                    tenants.map((t) => (
                      <tr key={t.id} className="hover:bg-zinc-900/10 transition">
                        <td className="px-6 py-4 font-bold text-white">{t.name}</td>
                        <td className="px-6 py-4">
                          <select
                            value={t.subscription.planId}
                            onChange={(e) => handleChangePlan(t.id, e.target.value as any)}
                            className="bg-zinc-950 border border-zinc-800 text-xs px-2.5 py-1 rounded-xl text-zinc-300 focus:outline-none"
                          >
                            <option value="starter">Starter</option>
                            <option value="growth">Growth</option>
                            <option value="enterprise">Enterprise</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs select-none">
                            <input
                              type="checkbox"
                              checked={!!t.features?.rooms}
                              onChange={(e) => handleToggleFeatureOverride(t.id, 'rooms', e.target.checked)}
                              className="accent-emerald-500 rounded h-3.5 w-3.5 bg-zinc-950 border-zinc-800 focus:ring-0 cursor-pointer"
                            />
                            <span className="text-zinc-400">Rooms</span>
                          </label>
                        </td>
                        <td className="px-6 py-4 text-zinc-400">
                          {t.subscription.limits.tablesPerRestaurant} Tables
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {t.domain ? (
                              <div className="flex items-center gap-1 text-zinc-300">
                                <Globe className="h-3.5 w-3.5 text-zinc-500" />
                                <span className="text-xs font-mono">{t.domain}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-zinc-650">No domain mapped</span>
                            )}
                            <button
                              onClick={() => handleEditDomain(t.id)}
                              className="p-1 text-zinc-500 hover:text-zinc-300 transition"
                              title="Edit Domain"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleStatus(t.id)}
                            className="focus:outline-none"
                          >
                            {t.subscription.status === 'active' ? (
                              <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold bg-emerald-500/10 border border-emerald-500/15 px-2.5 py-0.5 rounded-full hover:bg-emerald-500/20 transition">
                                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                Active
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-red-400 text-xs font-semibold bg-red-500/10 border border-red-500/15 px-2.5 py-0.5 rounded-full hover:bg-red-500/20 transition">
                                <span className="h-1.5 w-1.5 bg-red-500 rounded-full" />
                                Suspended
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-zinc-500 text-xs">
                          {formatCreatedAt(t.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleImpersonate(t.id, t.name)}
                              className="p-2 border border-zinc-800 hover:border-emerald-500/30 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/5 transition rounded-xl"
                              title="Impersonate Restaurant Admin"
                            >
                              <Sliders className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => requestDeleteTenant(t.id, t.name)}
                              className="p-2 border border-zinc-800 hover:border-red-500/30 text-zinc-500 hover:text-red-400 hover:bg-red-500/5 transition rounded-xl"
                              title="Delete Tenant"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'users' ? (
        <div className="space-y-6">
          <div className="border border-zinc-900 bg-zinc-900/20 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-900/10">
              <div>
                <h3 className="text-base font-bold text-white">System User Registry</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Manage SaaS Administrators, Restaurant Owners, and Staff access permissions</p>
              </div>
            </div>

            {/* Sub-Tabs for Super Admin, Restaurant Admin, and Other accounts */}
            <div className="flex border-b border-zinc-900 px-6 pt-3 bg-zinc-950/20 gap-6">
              <button
                onClick={() => setActiveUserSubTab('super-admin')}
                className={`text-xs font-bold pb-3 border-b-2 transition-all duration-200 relative ${
                  activeUserSubTab === 'super-admin'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-350'
                }`}
              >
                Super Admins
              </button>
              <button
                onClick={() => setActiveUserSubTab('restaurant-admin')}
                className={`text-xs font-bold pb-3 border-b-2 transition-all duration-200 relative ${
                  activeUserSubTab === 'restaurant-admin'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-350'
                }`}
              >
                Restaurant Admins
              </button>
              <button
                onClick={() => setActiveUserSubTab('other')}
                className={`text-xs font-bold pb-3 border-b-2 transition-all duration-200 relative ${
                  activeUserSubTab === 'other'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-350'
                }`}
              >
                Other Staff & Users
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">User Details</th>
                    <th className="px-6 py-4">Assigned System Role</th>
                    <th className="px-6 py-4">Tenant Association</th>
                    <th className="px-6 py-4">Registered Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/60 text-sm">
                  {usersList.filter((u) => {
                    if (activeUserSubTab === 'super-admin') return u.role === 'super-admin';
                    if (activeUserSubTab === 'restaurant-admin') return u.role === 'restaurant-admin';
                    return u.role !== 'super-admin' && u.role !== 'restaurant-admin';
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-zinc-500 text-xs">
                        No registered accounts found in this category.
                      </td>
                    </tr>
                  ) : (
                    usersList.filter((u) => {
                      if (activeUserSubTab === 'super-admin') return u.role === 'super-admin';
                      if (activeUserSubTab === 'restaurant-admin') return u.role === 'restaurant-admin';
                      return u.role !== 'super-admin' && u.role !== 'restaurant-admin';
                    }).map((u) => {
                      const matchTenant = tenants.find((t) => t.id === u.tenantId);
                      return (
                        <tr key={u.uid} className="hover:bg-zinc-900/10 transition">
                          <td className="px-6 py-4">
                            <div className="font-bold text-white text-xs">{u.displayName}</div>
                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{u.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border capitalize ${
                              u.role === 'super-admin'
                                ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                                : u.role === 'restaurant-admin'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                            }`}>
                              {u.role.replace('-', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-zinc-400 text-xs font-semibold">
                            {matchTenant ? matchTenant.name : u.role === 'super-admin' ? 'Global Platform' : 'Independent User'}
                          </td>
                          <td className="px-6 py-4 text-zinc-500 text-xs">
                            {formatCreatedAt(u.createdAt)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-2 border border-zinc-800 hover:border-red-500/30 text-zinc-500 hover:text-red-400 hover:bg-red-500/5 transition rounded-xl"
                              title="Delete User Account"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'subscriptions' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Starter Plan card */}
            <div className="border border-zinc-900 bg-zinc-900/25 p-6 rounded-2xl space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-white text-base">Starter Plan</h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Best for single small cafes</p>
                </div>
                <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full">
                  ₹99/mo
                </span>
              </div>
              <div className="text-xs text-zinc-400 space-y-2 border-t border-zinc-900 pt-4">
                <div className="flex justify-between"><span>Max Tables</span><span className="font-bold text-white">10</span></div>
                <div className="flex justify-between"><span>Monthly Orders limit</span><span className="font-bold text-white">1,000</span></div>
              </div>
            </div>

            {/* Growth Plan card */}
            <div className="border border-sky-500/20 bg-sky-500/5 p-6 rounded-2xl space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-white text-base">Growth Plan</h3>
                  <p className="text-[10px] text-sky-400 mt-0.5">Best for scaling restaurants</p>
                </div>
                <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/15 px-2 py-0.5 rounded-full">
                  ₹249/mo
                </span>
              </div>
              <div className="text-xs text-zinc-400 space-y-2 border-t border-zinc-900/60 pt-4">
                <div className="flex justify-between"><span>Max Tables</span><span className="font-bold text-white">30</span></div>
                <div className="flex justify-between"><span>Monthly Orders limit</span><span className="font-bold text-white">5,000</span></div>
              </div>
            </div>

            {/* Enterprise Plan card */}
            <div className="border border-violet-500/20 bg-violet-500/5 p-6 rounded-2xl space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-white text-base">Enterprise Plan</h3>
                  <p className="text-[10px] text-violet-400 mt-0.5">For large food businesses</p>
                </div>
                <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/15 px-2 py-0.5 rounded-full">
                  ₹499/mo
                </span>
              </div>
              <div className="text-xs text-zinc-400 space-y-2 border-t border-zinc-900/60 pt-4">
                <div className="flex justify-between"><span>Max Tables</span><span className="font-bold text-white">100</span></div>
                <div className="flex justify-between"><span>Monthly Orders limit</span><span className="font-bold text-white">50,000</span></div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Feature Flags & UI Defaults */}
            <div className="border border-zinc-900 bg-zinc-900/20 p-6 rounded-2xl space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="h-4.5 w-4.5 text-zinc-400" /> Platform Configuration
                </h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Control advanced modules and global white-label styles dynamically across all multi-tenant spaces.
                </p>
              </div>

              <form onSubmit={handleSaveSystemSettings} className="space-y-4">
                <div className="space-y-3.5 border-b border-zinc-900 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-200">AI Dish Recommendations</h4>
                      <p className="text-[10px] text-zinc-500">Enable AI-powered upselling on customer menus</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFlag('aiRecommendations')}
                      className={`h-5 w-9 rounded-full transition-colors duration-200 relative focus:outline-none ${
                        featureFlags.aiRecommendations ? 'bg-emerald-500' : 'bg-zinc-800'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 bg-white rounded-full transition-transform duration-200 ${
                          featureFlags.aiRecommendations ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-200">Offline Queue Sync (IndexedDB)</h4>
                      <p className="text-[10px] text-zinc-500">Permit customer ordering when network disconnects</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFlag('offlineQueue')}
                      className={`h-5 w-9 rounded-full transition-colors duration-200 relative focus:outline-none ${
                        featureFlags.offlineQueue ? 'bg-emerald-500' : 'bg-zinc-800'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 bg-white rounded-full transition-transform duration-200 ${
                          featureFlags.offlineQueue ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-200">Local Thermal Printing (ESC/POS)</h4>
                      <p className="text-[10px] text-zinc-500">Support Bluetooth/USB receipt and kitchen printouts</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFlag('escposPrinters')}
                      className={`h-5 w-9 rounded-full transition-colors duration-200 relative focus:outline-none ${
                        featureFlags.escposPrinters ? 'bg-emerald-500' : 'bg-zinc-800'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 bg-white rounded-full transition-transform duration-200 ${
                          featureFlags.escposPrinters ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400 font-semibold">Branding Theme Mode</label>
                    <select
                      value={whiteLabelConfig.defaultTheme}
                      onChange={(e) => setWhiteLabelConfig({ ...whiteLabelConfig, defaultTheme: e.target.value })}
                      className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl cursor-pointer"
                    >
                      <option value="dark">Dark Theme Defaults (Recommended)</option>
                      <option value="light">Light Theme Defaults</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-400 font-semibold">Primary Hex Color</label>
                      <input
                        type="text"
                        value={whiteLabelConfig.primaryColor}
                        onChange={(e) => setWhiteLabelConfig({ ...whiteLabelConfig, primaryColor: e.target.value })}
                        className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-1">
                      <label className="text-xs text-zinc-400 font-semibold">Typography Font</label>
                      <input
                        type="text"
                        value={whiteLabelConfig.fontFamily}
                        onChange={(e) => setWhiteLabelConfig({ ...whiteLabelConfig, fontFamily: e.target.value })}
                        className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-500/10 mt-4"
                >
                  Save Platform Config
                </button>
              </form>
            </div>

            {/* Super Admin Security Password Change */}
            <div className="border border-zinc-900 bg-zinc-900/20 p-6 rounded-2xl space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="h-4.5 w-4.5 text-zinc-400" /> Platform Security
                </h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Rotate your global Super Administrator credentials securely.
                </p>
              </div>

              <form onSubmit={handleChangeSuperAdminPassword} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-semibold">Current Password</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                    placeholder="Enter current password"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-semibold">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                    placeholder="Enter new password"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-semibold">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                    placeholder="Confirm new password"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-500/10 mt-4"
                >
                  Update Superadmin Password
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Tenant Modal */}
      {showAddModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 ${isProvisioning ? 'pointer-events-none' : ''}`}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md border border-zinc-850 bg-zinc-950 p-6 shadow-2xl rounded-3xl text-white relative overflow-hidden"
          >
            {isProvisioning && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center gap-3 animate-fadeIn">
                <Loader2 className="h-9 w-9 animate-spin text-emerald-400" />
                <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest animate-pulse">Provisioning Database...</p>
              </div>
            )}

            <button
              type="button"
              disabled={isProvisioning}
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-1.5 border border-zinc-850 rounded-xl text-zinc-400 hover:text-white transition disabled:opacity-30"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-extrabold text-white">Provision New Tenant</h3>
            </div>
            <p className="text-xs text-zinc-400 mb-6">Create dedicated database namespaces, settings registry, and subscription credentials.</p>
 
            <form onSubmit={handleAddTenant} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Tenant / Restaurant Name</label>
                <input
                  type="text"
                  required
                  disabled={isProvisioning}
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  className="w-full border border-zinc-850 bg-zinc-900 pl-3.5 pr-3.5 py-2.5 text-xs focus:outline-none focus:border-emerald-500/40 text-zinc-200 rounded-xl disabled:opacity-50"
                  placeholder="e.g. Himanshu Restaurant"
                />
              </div>
 
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Custom Domain Mapping</label>
                <input
                  type="text"
                  disabled={isProvisioning}
                  value={newTenantDomain}
                  onChange={(e) => setNewTenantDomain(e.target.value)}
                  className="w-full border border-zinc-850 bg-zinc-900 pl-3.5 pr-3.5 py-2.5 text-xs focus:outline-none focus:border-emerald-500/40 text-zinc-200 rounded-xl disabled:opacity-50"
                  placeholder="e.g. himanshurestaurant.com (optional)"
                />
              </div>
 
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Subscription Plan</label>
                <select
                  disabled={isProvisioning}
                  value={newTenantPlan}
                  onChange={(e) => setNewTenantPlan(e.target.value as any)}
                  className="w-full border border-zinc-850 bg-zinc-900 pl-3 pr-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500/40 text-zinc-200 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  <option value="starter">Starter Plan (₹99/mo)</option>
                  <option value="growth">Growth Plan (₹249/mo)</option>
                  <option value="enterprise">Enterprise Plan (₹499/mo)</option>
                </select>
              </div>
 
              <div className="h-px bg-zinc-900 my-5" />
              <div className="flex items-center gap-1.5 mb-3">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Restaurant Admin Account</h4>
              </div>
 
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Admin Full Name</label>
                <input
                  type="text"
                  required
                  disabled={isProvisioning}
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full border border-zinc-850 bg-zinc-900 pl-3.5 pr-3.5 py-2.5 text-xs focus:outline-none focus:border-emerald-500/40 text-zinc-200 rounded-xl disabled:opacity-50"
                  placeholder="e.g. Himanshu Manager"
                />
              </div>
 
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Admin Email Address</label>
                <input
                  type="email"
                  required
                  disabled={isProvisioning}
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full border border-zinc-850 bg-zinc-900 pl-3.5 pr-3.5 py-2.5 text-xs focus:outline-none focus:border-emerald-500/40 text-zinc-200 rounded-xl disabled:opacity-50"
                  placeholder="himanshu@restaurant.com"
                />
              </div>
 
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Admin Password</label>
                <input
                  type="password"
                  required
                  disabled={isProvisioning}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full border border-zinc-850 bg-zinc-900 pl-3.5 pr-3.5 py-2.5 text-xs focus:outline-none focus:border-emerald-500/40 text-zinc-200 rounded-xl disabled:opacity-50"
                  placeholder="••••••••"
                />
              </div>
 
              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  disabled={isProvisioning}
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-zinc-850 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProvisioning}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/10 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isProvisioning ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Provisioning...</span>
                    </>
                  ) : (
                    <span>Create Tenant</span>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && tenantToDelete && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 ${isDeleting ? 'pointer-events-none' : ''}`}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm border border-zinc-850 bg-zinc-950 p-6 shadow-2xl rounded-3xl text-white relative overflow-hidden"
          >
            {isDeleting && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center gap-3 animate-fadeIn">
                <Loader2 className="h-8 w-8 animate-spin text-red-500" />
                <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest animate-pulse">Deleting Tenant Data...</p>
              </div>
            )}

            <h3 className="text-base font-extrabold text-white mb-2">Delete Tenant?</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              Are you sure you want to delete <span className="font-bold text-white">"{tenantToDelete.name}"</span>? All database tables, catalog menus, staff registries, and settings will be permanently removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setTenantToDelete(null);
                }}
                className="px-4 py-2 border border-zinc-850 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteTenant}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl shadow-lg shadow-red-650/15 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Permanently Delete</span>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  );
};
