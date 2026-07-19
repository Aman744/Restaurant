import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../features/auth/context/AuthContext';
import { useUserProfile } from '../../features/auth/context/UserContext';
import { LogOut, Menu, User, Bell, X, CheckCheck, ShoppingBag, Utensils, Sparkles } from 'lucide-react';
import { useTenant } from '../../features/auth/context/TenantContext.js';

interface SidebarItem {
  name: string;
  path: string;
  icon: React.ComponentType<any>;
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
  { id: 'n1', title: 'New customer order placed for Table 2', time: '2 mins ago', read: false, type: 'order' },
  { id: 'n2', title: 'Table 4 requested cashier bill print', time: '10 mins ago', read: false, type: 'table' },
  { id: 'n3', title: 'Menu catalog updated & synced', time: '1 hour ago', read: true, type: 'system' }
];

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title, sidebarItems }) => {
  const { logout } = useAuth();
  const { profile } = useUserProfile();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();

  const [logoError, setLogoError] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>(initialNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const isImpersonating = !!localStorage.getItem('impersonate_role');

  const handleExitImpersonation = () => {
    localStorage.removeItem('impersonate_role');
    localStorage.removeItem('impersonate_tenantId');
    localStorage.removeItem('impersonate_tenantName');
    window.location.href = '/super-admin/tenants';
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
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
                  {tenant?.name ? tenant.name.charAt(0).toUpperCase() : 'Q'}
                </div>
                <span className="font-semibold tracking-wide text-zinc-100 truncate max-w-[140px]">
                  {tenant?.name || 'QR Ordering'}
                </span>
              </>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition duration-200 rounded-xl ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-zinc-900 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="h-9 w-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
              <User className="h-4.5 w-4.5" />
            </div>
            <div className="overflow-hidden">
              <h4 className="text-xs font-semibold text-zinc-200 truncate">{profile?.displayName}</h4>
              <p className="text-[10px] text-zinc-500 truncate">{profile?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 hover:text-white py-2.5 text-xs font-medium rounded-xl text-zinc-400 transition"
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
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden text-zinc-400 hover:text-zinc-200">
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

            {/* Notification Bell Trigger */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className={`relative p-2.5 rounded-xl border transition ${
                  notificationsOpen
                    ? 'bg-zinc-800 border-zinc-700 text-white'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
                title="Notifications"
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
                      <div className="flex justify-between items-center border-b border-zinc-850 pb-3">
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4 text-emerald-400" />
                          <h4 className="text-xs font-extrabold uppercase tracking-wider">Live Notifications</h4>
                        </div>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold transition"
                          >
                            <CheckCheck className="h-3.5 w-3.5" />
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="divide-y divide-zinc-850/80 max-h-80 overflow-y-auto pr-1">
                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() =>
                              setNotifications((prev) =>
                                prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
                              )
                            }
                            className={`py-3 px-3 flex items-start gap-3 rounded-2xl transition cursor-pointer hover:bg-zinc-900/80 ${
                              !n.read ? 'bg-zinc-900/50 border border-zinc-850/60' : ''
                            }`}
                          >
                            <div className={`p-2 rounded-xl border shrink-0 ${getNotificationIconBg(n.type)}`}>
                              {getNotificationIcon(n.type)}
                            </div>
                            <div className="flex-1 space-y-1">
                              <p className={`text-xs leading-snug ${!n.read ? 'font-bold text-white' : 'text-zinc-400'}`}>
                                {n.title}
                              </p>
                              <p className="text-[10px] text-zinc-500 font-mono">{n.time}</p>
                            </div>
                            {!n.read && <span className="h-2 w-2 rounded-full bg-emerald-400 mt-1.5 shrink-0 shadow-sm shadow-emerald-400" />}
                          </div>
                        ))}

                        {notifications.length === 0 && (
                          <div className="py-8 text-center text-zinc-500 text-xs space-y-1">
                            <Sparkles className="h-6 w-6 mx-auto text-zinc-700 mb-1" />
                            <p>No unread notifications.</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="h-8 w-px bg-zinc-900 hidden sm:block" />
            <div className="flex items-center gap-2.5 hidden sm:flex">
              <div className="text-right">
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 px-2 py-0.5 rounded-full">
                  {profile?.role?.replace('-', ' ') || ''}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Viewport */}
        <main className="flex-1 overflow-y-auto bg-zinc-950 p-4 sm:p-6">{children}</main>
      </div>

      {/* Mobile Drawer Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-zinc-950 border-r border-zinc-900 shadow-2xl p-6 transition-transform duration-300">
            <div className="flex justify-between items-center mb-6">
              {/* Brand Logo inside Drawer */}
              <div className="flex items-center gap-3">
                {tenant?.logoUrl && !logoError ? (
                  <img
                    src={tenant.logoUrl}
                    alt={tenant.name || 'Logo'}
                    className="h-9 w-auto max-w-[150px] object-contain rounded-lg"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <>
                    <div className="h-7 w-7 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-white shadow-md shadow-emerald-500/20 shrink-0">
                      {tenant?.name ? tenant.name.charAt(0).toUpperCase() : 'Q'}
                    </div>
                    <span className="font-semibold text-sm tracking-wide text-zinc-100 truncate">
                      {tenant?.name || 'QR Ordering'}
                    </span>
                  </>
                )}
              </div>
              {/* Close Button */}
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-zinc-550 hover:text-white rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Nav Links */}
            <nav className="space-y-1.5 flex-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition duration-200 rounded-xl ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/10'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Bottom Section */}
            <div className="border-t border-zinc-900 pt-4 space-y-4">
              <div className="flex items-center gap-3 px-2">
                <div className="h-9 w-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                  <User className="h-4.5 w-4.5" />
                </div>
                <div className="overflow-hidden">
                  <h4 className="text-xs font-semibold text-zinc-200 truncate">{profile?.displayName}</h4>
                  <p className="text-[10px] text-zinc-500 truncate">{profile?.email}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center justify-center gap-2 border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 hover:text-white py-2.5 text-xs font-medium rounded-xl text-zinc-400 transition"
              >
                <LogOut className="h-3.5 w-3.5" />
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
