import React from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '../../components/shared/DashboardLayout';
import { useAuth } from '../../features/auth/context/AuthContext.js';
import { useTenant } from '../../features/auth/context/TenantContext.js';
import {
  LayoutDashboard,
  ChefHat,
  Table,
  Users,
  FileText,
  Settings,
  Utensils
} from 'lucide-react';

import { DashboardOverviewTab } from '../../features/dashboard/components/DashboardOverviewTab';
import { MenuTab } from '../../features/menu/components/MenuTab';
import { OrdersTab } from '../../features/orders/components/OrdersTab';
import { TablesTab } from '../../features/tables/components/TablesTab';
import { StaffTab } from '../../features/staff/components/StaffTab';
import { ReportsTab } from '../../features/reports/components/ReportsTab';
import { SettingsTab } from '../../features/settings/components/SettingsTab';

export const RestaurantAdminDashboard: React.FC = () => {
  const location = useLocation();
  const { isMockMode } = useAuth();
  const { tenant } = useTenant();

  const tenantId = tenant?.id || 'tenant_dev_123';
  const isManagerRoute = location.pathname.startsWith('/manager');
  const basePath = isManagerRoute ? '/manager' : '/admin';

  const sidebarItems = [
    { name: 'Dashboard', path: `${basePath}`, icon: LayoutDashboard },
    { name: 'Orders', path: `${basePath}/orders`, icon: Utensils },
    { name: 'Menu', path: `${basePath}/menu`, icon: ChefHat },
    { name: 'Tables', path: `${basePath}/tables`, icon: Table },
    { name: 'Staff', path: `${basePath}/staff`, icon: Users },
    { name: 'Reports', path: `${basePath}/reports`, icon: FileText },
    { name: 'Settings', path: `${basePath}/settings`, icon: Settings }
  ];

  // Route active tab based on path
  const path = location.pathname;
  let activeTab = 'overview';
  if (path.endsWith('/orders')) activeTab = 'orders';
  else if (path.endsWith('/menu')) activeTab = 'menu';
  else if (path.endsWith('/tables')) activeTab = 'tables';
  else if (path.endsWith('/staff')) activeTab = 'staff';
  else if (path.endsWith('/reports')) activeTab = 'reports';
  else if (path.endsWith('/settings')) activeTab = 'settings';

  return (
    <DashboardLayout title="Restaurant Operations & Management" sidebarItems={sidebarItems}>
      {activeTab === 'overview' && <DashboardOverviewTab tenantId={tenantId} isMockMode={isMockMode} />}
      {activeTab === 'orders' && <OrdersTab tenantId={tenantId} isMockMode={isMockMode} />}
      {activeTab === 'menu' && <MenuTab tenantId={tenantId} isMockMode={isMockMode} />}
      {activeTab === 'tables' && <TablesTab tenantId={tenantId} isMockMode={isMockMode} />}
      {activeTab === 'staff' && <StaffTab tenantId={tenantId} isMockMode={isMockMode} />}
      {activeTab === 'reports' && <ReportsTab tenantId={tenantId} isMockMode={isMockMode} />}
      {activeTab === 'settings' && <SettingsTab tenantId={tenantId} isMockMode={isMockMode} />}
    </DashboardLayout>
  );
};
