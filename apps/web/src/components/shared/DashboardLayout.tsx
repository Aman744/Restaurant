import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../features/auth/context/AuthContext';
import { useUserProfile } from '../../features/auth/context/UserContext';
import { LogOut, Menu, User, Bell, X, CheckCheck, Trash2, ShoppingBag, Utensils, Sparkles, Sun, Moon } from 'lucide-react';
import { useTenant } from '../../features/auth/context/TenantContext.js';
import { useColorMode } from '../../features/auth/context/ThemeContext';
import { db } from '../../lib/firebase.js';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { OrderConverter } from '@restaurant-qr/infra';

interface SidebarItem {
  name: string;
  path?: string;
  icon: React.ComponentType<any>;
  subItems?: SidebarItem[];
  badge?: string | number;
  badgeColor?: string;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  sidebarItems: SidebarItem[];
}

interface SystemNotification {
  id: string;
  title: string;
  time: string;
  read: boolean;
  type: 'order' | 'system' | 'table';
}

const initialNotifications: SystemNotification[] = [
  { id: 'n1', title: 'New customer order placed for Table 2', time: 'Just now', read: false, type: 'order' },
  { id: 'n2', title: 'Table 4 requested cashier bill print', time: '10 mins ago', read: false, type: 'table' },
  { id: 'n3', title: 'Menu catalog updated & synced', time: '1 hour ago', read: true, type: 'system' }
];

const formatTimeAgo = (dateVal: any): string => {
  if (!dateVal) return 'Just now';
  const d = dateVal instanceof Date ? dateVal : typeof dateVal.toDate === 'function' ? dateVal.toDate() : typeof dateVal.seconds === 'number' ? new Date(dateVal.seconds * 1000) : new Date(dateVal);
  const diffSecs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (isNaN(diffSecs) || diffSecs < 60) return 'Just now';
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)} mins ago`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)} hours ago`;
  return d.toLocaleDateString();
};

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title, sidebarItems }) => {
  const { logout } = useAuth();
  const { profile } = useUserProfile();
  const { tenant } = useTenant();
  const { mode, toggleColorMode } = useColorMode();
  const { isMockMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [logoError, setLogoError] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('restaurant_qr_read_notif_ids');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [dismissedNotifIds, setDismissedNotifIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('restaurant_qr_dismissed_notif_ids');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [notifications, setNotifications] = useState<SystemNotification[]>(initialNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const isImpersonating = !!localStorage.getItem('impersonate_role');

  const handleThemeToggle = async () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    toggleColorMode();

    const isAdmin = profile && ['super-admin', 'restaurant-admin', 'manager'].includes(profile.role);
    if (isAdmin) {
      if (isMockMode) {
        try {
          const cachedWhiteLabel = localStorage.getItem('restaurant_qr_system_whitelabel');
          let currentConfig = {
            defaultTheme: newMode,
            primaryColor: '#10b981',
            fontFamily: 'Inter',
            restaurantName: 'Aman\'s QR Platform'
          };
          if (cachedWhiteLabel) {
            currentConfig = { ...currentConfig, ...JSON.parse(cachedWhiteLabel), defaultTheme: newMode };
          }
          localStorage.setItem('restaurant_qr_system_whitelabel', JSON.stringify(currentConfig));
          window.dispatchEvent(new Event('storage'));
        } catch (e) {
          console.error(e);
        }
      } else {
        try {
          await setDoc(doc(db, 'system_settings', 'general'), {
            whiteLabelConfig: {
              defaultTheme: newMode
            }
          }, { merge: true });
        } catch (err) {
          console.warn(err);
        }
      }
    }
  };

  const playBellSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch (e) {
      console.warn('Audio context blocked by browser policy:', e);
    }
  };

  // Sync real-time live notifications from orders with persistence
  useEffect(() => {
    let active = true;
    const tenantId = profile?.tenantId || 'tenant_dev_123';

    const processOrdersIntoNotifs = (activeOrders: any[]) => {
      const liveList: SystemNotification[] = [];

      for (const o of activeOrders.slice(-10).reverse()) {
        const notifId = `notif_${o.id}`;
        if (dismissedNotifIds.includes(notifId)) continue;

        let title = `Order #${o.id.slice(-6).toUpperCase()} placed for ${o.tableNumber || `Table ${o.tableId || '1'}`}`;
        let type: 'order' | 'table' | 'system' = 'order';

        if (o.requestedBillAt) {
          title = `${o.tableNumber || `Table ${o.tableId || '1'}`} requested settlement bill!`;
          type = 'table';
        } else if (o.status === 'ready') {
          title = `Order #${o.id.slice(-6).toUpperCase()} for ${o.tableNumber || `Table ${o.tableId || '1'}`} is READY!`;
          type = 'table';
        }

        const isRead = readNotifIds.includes(notifId);

        liveList.push({
          id: notifId,
          title,
          time: formatTimeAgo(o.createdAt),
          read: isRead,
          type
        });
      }

      setNotifications((prev) => {
        const prevUnreadCount = prev.filter((n) => !n.read).length;
        const newUnreadCount = liveList.filter((n) => !n.read).length;
        if (newUnreadCount > prevUnreadCount && active) {
          playBellSound();
        }
        return liveList.length > 0
          ? liveList
          : initialNotifications.filter((n) => !dismissedNotifIds.includes(n.id)).map((n) => ({
              ...n,
              read: readNotifIds.includes(n.id) ? true : n.read
            }));
      });
    };

    const syncMockNotifications = () => {
      const cached = localStorage.getItem('restaurant_qr_mock_orders_db');
      if (cached && active) {
        try {
          const parsed = JSON.parse(cached);
          const activeOrders = parsed.filter(
            (o: any) => o.status !== 'completed' && o.status !== 'archived' && o.tenantId === tenantId
          );
          processOrdersIntoNotifs(activeOrders);
        } catch (e) {}
      }
    };

    if (isMockMode) {
      syncMockNotifications();
      const interval = setInterval(syncMockNotifications, 2500);
      return () => {
        clearInterval(interval);
        active = false;
      };
    } else {
      const colRef = collection(db, 'tenants', tenantId, 'orders').withConverter(OrderConverter);
      const q = query(colRef, where('status', 'not-in', ['completed', 'archived']));

      const unsubscribe = onSnapshot(q, (snap: any) => {
        if (!active) return;
        const activeOrders = snap.docs.map((d: any) => d.data());
        processOrdersIntoNotifs(activeOrders);
      }, (err: any) => {
        console.error('Live notifications listener error:', err);
      });

      return () => {
        unsubscribe();
        active = false;
      };
    }
  }, [profile, isMockMode, readNotifIds, dismissedNotifIds]);

  const handleExitImpersonation = () => {
    localStorage.removeItem('impersonate_role');
    localStorage.removeItem('impersonate_tenantId');
    localStorage.removeItem('impersonate_tenantName');
    window.location.href = '#/super-admin/tenants';
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  const handleMarkAllRead = () => {
    const allIds = notifications.map((n) => n.id);
    const updated = Array.from(new Set([...readNotifIds, ...allIds]));
    setReadNotifIds(updated);
    localStorage.setItem('restaurant_qr_read_notif_ids', JSON.stringify(updated));
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClearAllNotifications = () => {
    const allIds = notifications.map((n) => n.id);
    const updated = Array.from(new Set([...dismissedNotifIds, ...allIds]));
    setDismissedNotifIds(updated);
    localStorage.setItem('restaurant_qr_dismissed_notif_ids', JSON.stringify(updated));
    setNotifications([]);
  };

  const handleRemoveSingleNotification = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = Array.from(new Set([...dismissedNotifIds, id]));
    setDismissedNotifIds(updated);
    localStorage.setItem('restaurant_qr_dismissed_notif_ids', JSON.stringify(updated));
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  };

  const handleNotificationClick = (n: SystemNotification) => {
    if (!n.read) {
      const updated = Array.from(new Set([...readNotifIds, n.id]));
      setReadNotifIds(updated);
      localStorage.setItem('restaurant_qr_read_notif_ids', JSON.stringify(updated));
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)));
    }
    setNotificationsOpen(false);

    if (profile?.role === 'cashier') {
      navigate('/cashier');
    } else if (profile?.role === 'restaurant-admin' || profile?.role === 'manager') {
      navigate('/admin/orders');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <ShoppingBag className="h-3.5 w-3.5 text-emerald-400" />;
      case 'table':
        return <Utensils className="h-3.5 w-3.5 text-amber-400" />;
      default:
        return <Sparkles className="h-3.5 w-3.5 text-sky-400" />;
    }
  };

  const getNotificationIconBg = (type: string) => {
    switch (type) {
      case 'order':
        return 'bg-emerald-500/10 border-emerald-500/20';
      case 'table':
        return 'bg-amber-500/10 border-amber-500/20';
      default:
        return 'bg-sky-500/10 border-sky-500/20';
    }
  };

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-900 bg-zinc-950 flex flex-col justify-between hidden md:flex">
        <div>
          {/* Logo Brand */}
          <div className="h-16 px-6 border-b border-zinc-900 flex items-center gap-3">
            {tenant?.logoUrl && !logoError ? (
              <img
                src={tenant.logoUrl}
                alt={tenant.name || 'Logo'}
                className="h-10 w-auto max-w-[200px] object-contain rounded-lg"
                onError={() => setLogoError(true)}
              />
            ) : (
              <>
                <div className="h-8 w-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-white shadow-md shadow-emerald-500/20 shrink-0">
                  {tenant?.name ? tenant.name.charAt(0).toUpperCase() : 'H'}
                </div>
                <span className="font-semibold tracking-wide text-zinc-100 truncate max-w-[140px]">
                  {tenant?.name || 'Hotel & Restaurant'}
                </span>
              </>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5 overflow-y-auto max-h-[calc(100vh-10rem)]">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              if (item.subItems && item.subItems.length > 0) {
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center gap-3 px-4 py-1 text-[9px] font-extrabold uppercase tracking-widest text-zinc-500 mt-4 mb-0.5 select-none">
                      <span>{item.name}</span>
                    </div>
                    {item.subItems.map((child: SidebarItem) => {
                      const ChildIcon = child.icon;
                      const isChildCurrent = child.path ? location.pathname === child.path : false;
                      const isAlertBadge = child.badge !== undefined;
                      return (
                        <Link
                          key={child.name}
                          to={child.path || '#'}
                          className={`flex items-center justify-between gap-3 px-6 py-2.5 text-xs font-semibold transition duration-200 rounded-xl ${
                            isChildCurrent
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                              : isAlertBadge
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse font-extrabold'
                              : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <ChildIcon className={`h-4 w-4 ${isAlertBadge ? 'text-red-400' : ''}`} />
                            <span>{child.name}</span>
                          </div>
                          {child.badge !== undefined && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 bg-red-500 text-white rounded-full shrink-0">
                              {child.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                );
              }

              const pathBase = item.path ? item.path.split('#')[0] : '';
              const pathHash = item.path?.includes('#') ? item.path.substring(item.path.indexOf('#')) : '';
              const isPathMatch = location.pathname === pathBase;
              const isHashMatch = location.hash === pathHash;
              const isCurrent = isPathMatch && isHashMatch;
              const isAlertBadge = item.badge !== undefined && item.name === 'Customer Alerts';

              return (
                <Link
                  key={item.name}
                  to={item.path || '#'}
                  className={`flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium transition duration-200 rounded-xl ${
                    isCurrent
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                      : isAlertBadge
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse font-extrabold'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4.5 w-4.5 ${isAlertBadge ? 'text-amber-400' : ''}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                      item.badgeColor === 'amber' || isAlertBadge
                        ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-zinc-900 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="h-9 w-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 shrink-0">
              <User className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <h4 className="text-xs font-bold text-zinc-100 truncate">{profile?.displayName || 'User'}</h4>
              <p className="text-[10px] text-zinc-500 truncate">{profile?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 hover:text-white py-2.5 text-xs font-medium rounded-xl text-zinc-400 transition cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between relative z-40">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden text-zinc-400 hover:text-zinc-200 cursor-pointer">
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-bold tracking-tight text-white">{title}</h1>
          </div>

          <div className="flex items-center gap-4 relative">
            {isImpersonating && (
              <button
                onClick={handleExitImpersonation}
                className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-black px-3 py-1.5 rounded-xl transition shadow-lg shadow-amber-500/10 cursor-pointer"
              >
                <LogOut className="h-3 w-3" />
                Exit Impersonate
              </button>
            )}

            {/* Theme Mode Toggle Button */}
            <button
              onClick={handleThemeToggle}
              className="p-2.5 rounded-xl border transition cursor-pointer bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 light:bg-zinc-100 light:border-zinc-200 light:text-zinc-500 light:hover:bg-zinc-200 light:hover:text-zinc-800 mr-1"
              title={mode === 'light' ? 'Switch to Night Mode' : 'Switch to Day Mode'}
            >
              {mode === 'light' ? (
                <Moon className="h-4.5 w-4.5" />
              ) : (
                <Sun className="h-4.5 w-4.5 text-amber-500" />
              )}
            </button>

            {/* Notification Bell Trigger */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className={`relative p-2.5 rounded-xl border transition cursor-pointer ${
                  notificationsOpen
                    ? 'bg-zinc-800 border-zinc-700 text-white'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
                title="Live Notifications"
              >
                <Bell className="h-4.5 w-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-emerald-500 text-black font-black text-[9px] rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/40 animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Panel with Backdrop Dismissal */}
              <AnimatePresence>
                {notificationsOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setNotificationsOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-3 w-80 sm:w-96 border border-zinc-800 bg-zinc-950/95 backdrop-blur-2xl p-4 shadow-2xl shadow-emerald-500/5 rounded-3xl text-white space-y-3 z-50"
                    >
                      {/* Popover Header */}
                      <div className="flex justify-between items-center border-b border-zinc-850 pb-3">
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4 text-emerald-400" />
                          <h4 className="text-xs font-extrabold uppercase tracking-wider">Live Notifications</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          {unreadCount > 0 && (
                            <button
                              onClick={handleMarkAllRead}
                              className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold transition cursor-pointer"
                              title="Mark all as read"
                            >
                              <CheckCheck className="h-3.5 w-3.5" />
                              Mark read
                            </button>
                          )}
                          {notifications.length > 0 && (
                            <button
                              onClick={handleClearAllNotifications}
                              className="text-[10px] text-zinc-400 hover:text-red-400 flex items-center gap-1 font-bold transition cursor-pointer ml-1"
                              title="Clear all notifications"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-zinc-400 hover:text-red-400" />
                              Clear All
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Notifications Stream */}
                      <div className="divide-y divide-zinc-850/80 max-h-80 overflow-y-auto pr-1">
                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            className={`p-3 rounded-2xl flex items-start gap-3 transition cursor-pointer group ${
                              n.read ? 'bg-transparent opacity-60' : 'bg-zinc-900/60 hover:bg-zinc-900'
                            }`}
                          >
                            <div className={`p-2 rounded-xl border shrink-0 ${getNotificationIconBg(n.type)}`}>
                              {getNotificationIcon(n.type)}
                            </div>
                            <div className="flex-1 space-y-1 overflow-hidden">
                              <p className="text-xs font-bold text-zinc-100 group-hover:text-emerald-400 transition leading-snug">
                                {n.title}
                              </p>
                              <p className="text-[10px] text-zinc-500 font-mono">{n.time}</p>
                            </div>
                            <button
                              onClick={(e) => handleRemoveSingleNotification(e, n.id)}
                              className="text-zinc-600 hover:text-red-400 p-1 transition opacity-0 group-hover:opacity-100 cursor-pointer"
                              title="Dismiss"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}

                        {notifications.length === 0 && (
                          <div className="py-8 text-center text-zinc-500 space-y-1">
                            <CheckCheck className="h-6 w-6 mx-auto text-zinc-600" />
                            <p className="text-xs font-semibold text-zinc-400">All caught up!</p>
                            <p className="text-[10px] text-zinc-600">No new live notifications right now</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Role Badge (Right side of Live Notifications) */}
            {profile?.role && (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl shrink-0">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                  {profile.role.replace('-', ' ')}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Mobile Sidebar Overlay Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <div className="fixed inset-0 bg-black/80 z-50 md:hidden" onClick={() => setMobileMenuOpen(false)} />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: 0.2 }}
                className="fixed inset-y-0 left-0 w-72 bg-zinc-950 border-r border-zinc-900 z-50 flex flex-col justify-between p-4 md:hidden"
              >
                <div className="space-y-6">
                  <div className="flex justify-between items-center pb-3 border-b border-zinc-900">
                    <span className="font-bold text-white text-sm">{tenant?.name || 'QR Portal'}</span>
                    <button onClick={() => setMobileMenuOpen(false)} className="text-zinc-400 hover:text-white p-1">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <nav className="space-y-1.5">
                    {sidebarItems.map((item) => {
                      const Icon = item.icon;
                      if (item.subItems && item.subItems.length > 0) {
                        return (
                          <div key={item.name} className="space-y-1">
                            <div className="flex items-center gap-3 px-4 py-1 text-[9px] font-extrabold uppercase tracking-widest text-zinc-500 mt-4 mb-0.5 select-none">
                              <span>{item.name}</span>
                            </div>
                            {item.subItems.map((child: SidebarItem) => {
                              const ChildIcon = child.icon;
                               const isChildCurrent = child.path ? location.pathname === child.path : false;
                               const isAlertBadge = child.badge !== undefined;
                              return (
                                <Link
                                  key={child.name}
                                  to={child.path || '#'}
                                  onClick={() => setMobileMenuOpen(false)}
                                  className={`flex items-center justify-between gap-3 px-6 py-2 text-xs font-semibold rounded-xl transition ${
                                    isChildCurrent
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                                      : isAlertBadge
                                      ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse font-extrabold'
                                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <ChildIcon className={`h-4 w-4 ${isAlertBadge ? 'text-red-400' : ''}`} />
                                    <span>{child.name}</span>
                                  </div>
                                  {child.badge !== undefined && (
                                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-red-500 text-white rounded-full shrink-0">
                                      {child.badge}
                                    </span>
                                  )}
                                </Link>
                              );
                            })}
                          </div>
                        );
                      }
                      
                       const isPathMatch = item.path ? location.pathname === item.path.split('#')[0] : false;
                       const isHashMatch = item.path?.includes('#') ? location.hash === item.path.substring(item.path.indexOf('#')) : true;
                       const isCurrent = isPathMatch && isHashMatch;
                       const isAlertBadge = item.badge !== undefined && item.name === 'Customer Alerts';

                       return (
                         <Link
                           key={item.name}
                           to={item.path || '#'}
                           onClick={() => setMobileMenuOpen(false)}
                           className={`flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium rounded-xl transition ${
                             isCurrent
                               ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                               : isAlertBadge
                               ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse font-extrabold'
                               : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                           }`}
                         >
                           <div className="flex items-center gap-3">
                             <Icon className={`h-4.5 w-4.5 ${isAlertBadge ? 'text-amber-400' : ''}`} />
                             <span>{item.name}</span>
                           </div>
                           {item.badge !== undefined && (
                             <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                               item.badgeColor === 'amber' || isAlertBadge
                                 ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                                 : 'bg-zinc-800 text-zinc-300'
                             }`}>
                               {item.badge}
                             </span>
                           )}
                         </Link>
                       );
                    })}
                  </nav>
                </div>
                <div className="space-y-4 pt-4 border-t border-zinc-900">
                  <div className="flex items-center gap-3 px-2">
                    <div className="h-9 w-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 shrink-0">
                      <User className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <h4 className="text-xs font-bold text-zinc-100 truncate">{profile?.displayName || 'User'}</h4>
                      <p className="text-[10px] text-zinc-500 truncate">{profile?.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 border border-zinc-800 bg-zinc-900/60 py-2.5 text-xs font-medium rounded-xl text-zinc-400 transition"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Log Out
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-950">{children}</main>
      </div>
    </div>
  );
};
