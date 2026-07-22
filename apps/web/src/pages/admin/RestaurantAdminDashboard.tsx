import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase.js';
import { RoomStayRepository } from '@restaurant-qr/infra';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '../../components/shared/DashboardLayout';
import { useAuth } from '../../features/auth/context/AuthContext.js';
import { useTenant } from '../../features/auth/context/TenantContext.js';
import { usePermission } from '../../features/auth/context/PermissionContext.js';
import {
  LayoutDashboard,
  ChefHat,
  Table,
  Users,
  FileText,
  Settings,
  Utensils,
  DoorOpen,
  Sparkles,
  History,
  SlidersHorizontal
} from 'lucide-react';

import { DashboardOverviewTab } from '../../features/dashboard/components/DashboardOverviewTab';
import { MenuTab } from '../../features/menu/components/MenuTab';
import { OrdersTab } from '../../features/orders/components/OrdersTab';
import { TablesTab } from '../../features/tables/components/TablesTab';
import { RoomsTab } from '../../features/rooms/components/RoomsTab';
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

  const { isFeatureEnabled } = usePermission();
  const roomsActive = isFeatureEnabled('rooms');

  const [pendingTasksCount, setPendingTasksCount] = useState(0);

  useEffect(() => {
    if (!roomsActive) return;
    let active = true;
    const updateCount = async () => {
      try {
        let list = [];
        if (isMockMode) {
          const stored = localStorage.getItem('restaurant_qr_mock_housekeeping_tasks_db');
          list = stored ? JSON.parse(stored) : [];
        } else {
          const repo = new RoomStayRepository(db);
          list = await repo.listHousekeepingTasks(tenantId);
        }
        const pending = list.filter((t: any) => t.status === 'pending' || t.status === 'in-progress');
        if (active) setPendingTasksCount(pending.length);
      } catch (err) {}
    };

    updateCount();
    const interval = setInterval(updateCount, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [tenantId, isMockMode, roomsActive]);

  const sidebarItems: any[] = [
    { name: 'Dashboard', path: `${basePath}`, icon: LayoutDashboard },
    {
      name: 'Restaurent',
      icon: Utensils,
      subItems: [
        { name: 'table', path: `${basePath}/tables`, icon: Table },
        { name: 'order', path: `${basePath}/orders`, icon: Utensils },
        { name: 'menu', path: `${basePath}/menu`, icon: ChefHat }
      ]
    }
  ];

  if (roomsActive) {
    sidebarItems.push({
      name: 'rooms',
      icon: DoorOpen,
      subItems: [
        { name: 'Rooms Dashboard', path: `${basePath}/rooms#rooms`, icon: DoorOpen },
        { 
          name: 'Housekeeping', 
          path: `${basePath}/rooms#housekeeping`, 
          icon: Sparkles,
          badge: pendingTasksCount > 0 ? pendingTasksCount : undefined
        },
        { name: 'Stays History logs', path: `${basePath}/rooms#history`, icon: History },
        { name: 'Room Services', path: `${basePath}/rooms#services`, icon: SlidersHorizontal }
      ]
    });
  }

  sidebarItems.push({
    name: 'Setting',
    icon: Settings,
    subItems: [
      { name: 'staff', path: `${basePath}/staff`, icon: Users },
      { name: 'reports', path: `${basePath}/reports`, icon: FileText }
    ]
  });

  // Route active tab based on path
  const path = location.pathname;
  let activeTab = 'overview';
  if (path.endsWith('/orders')) activeTab = 'orders';
  else if (path.endsWith('/menu')) activeTab = 'menu';
  else if (path.endsWith('/tables')) activeTab = 'tables';
  else if (path.endsWith('/rooms')) activeTab = 'rooms';
  else if (path.endsWith('/staff')) activeTab = 'staff';
  else if (path.endsWith('/reports')) activeTab = 'reports';
  else if (path.endsWith('/settings')) activeTab = 'settings';

  return (
    <DashboardLayout title={isManagerRoute ? "Operations Manager Dashboard" : "Hotel & Restaurant Operations  Management"} sidebarItems={sidebarItems}>
      {activeTab === 'overview' && <DashboardOverviewTab tenantId={tenantId} isMockMode={isMockMode} />}
      {activeTab === 'orders' && <OrdersTab tenantId={tenantId} isMockMode={isMockMode} />}
      {activeTab === 'menu' && <MenuTab tenantId={tenantId} isMockMode={isMockMode} />}
      {activeTab === 'tables' && <TablesTab tenantId={tenantId} isMockMode={isMockMode} />}
      {activeTab === 'rooms' && <RoomsTab tenantId={tenantId} isMockMode={isMockMode} />}
      {activeTab === 'staff' && <StaffTab tenantId={tenantId} isMockMode={isMockMode} />}
      {activeTab === 'reports' && <ReportsTab tenantId={tenantId} isMockMode={isMockMode} />}
      {activeTab === 'settings' && <SettingsTab tenantId={tenantId} isMockMode={isMockMode} />}
    </DashboardLayout>
  );
};
