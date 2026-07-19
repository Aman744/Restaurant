import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../features/auth/context/AuthContext';
import { useUserProfile } from '../../features/auth/context/UserContext';
import { LogOut, Menu, User, Bell, X } from 'lucide-react';
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

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title, sidebarItems }) => {
  const { logout } = useAuth();
  const { profile } = useUserProfile();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const [logoError, setLogoError] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

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
                alt={tenant.name || "Logo"}
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
        <header className="h-16 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-zinc-400 hover:text-zinc-200"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-bold tracking-tight text-white">{title}</h1>
          </div>

          <div className="flex items-center gap-4">
            {isImpersonating && (
              <button
                onClick={handleExitImpersonation}
                className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-black px-3 py-1.5 rounded-xl transition shadow-lg shadow-amber-500/10 cursor-pointer"
              >
                <LogOut className="h-3 w-3" />
                Exit Impersonate
              </button>
            )}
            <button className="relative p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition">
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-emerald-500 rounded-full" />
            </button>
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
        <main className="flex-1 overflow-y-auto bg-zinc-950 p-4 sm:p-6">
          {children}
        </main>
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
                    alt={tenant.name || "Logo"}
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
