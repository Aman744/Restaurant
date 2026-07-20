import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '../../components/shared/DashboardLayout';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase.js';
import { useAuth } from '../../features/auth/context/AuthContext.js';
import { useTenant } from '../../features/auth/context/TenantContext.js';
import { MenuItemConverter } from '@restaurant-qr/infra';
import type { Order, MenuItem, Table as RestaurantTable, UserProfile } from '@restaurant-qr/core';
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

  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to real-time collections or mock data
  useEffect(() => {
    if (!tenantId) return;
    let active = true;

    if (isMockMode) {
      const syncMock = () => {
        const storedMenu = localStorage.getItem('restaurant_qr_mock_menu_db');
        const storedTables = localStorage.getItem('restaurant_qr_mock_tables_db');
        const storedOrders = localStorage.getItem('restaurant_qr_mock_orders_db');
        const storedStaff = localStorage.getItem('restaurant_qr_mock_staff_db');

        if (active) {
          if (storedMenu) setMenuItems(JSON.parse(storedMenu));
          if (storedTables) setTables(JSON.parse(storedTables));
          if (storedOrders) setOrders(JSON.parse(storedOrders));
          if (storedStaff) setStaff(JSON.parse(storedStaff));
          setLoading(false);
        }
      };

      syncMock();
      const interval = setInterval(syncMock, 2000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    } else {
      const unsubs = [
        onSnapshot(
          collection(db, 'tenants', tenantId, 'orders'),
          async (snap) => {
            const fetchedOrders: Order[] = [];
            for (const docSnap of snap.docs) {
              const data = docSnap.data();
              let orderItems = data.items || [];
              if (!orderItems || orderItems.length === 0) {
                try {
                  const subCol = await getDocs(collection(db, 'tenants', tenantId, 'orders', docSnap.id, 'order_items'));
                  orderItems = subCol.docs.map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }));
                } catch (e) {}
              }
              fetchedOrders.push({ id: docSnap.id, ...data, items: orderItems } as Order);
            }
            if (active) setOrders(fetchedOrders);
          },
          (err) => console.warn('Orders listener notice:', err.message)
        ),
        onSnapshot(
          collection(db, 'tenants', tenantId, 'menu_items').withConverter(MenuItemConverter),
          (snap) => {
            const items: MenuItem[] = [];
            snap.forEach((d) => items.push(d.data() as MenuItem));
            if (active) setMenuItems(items);
          },
          (err) => console.warn('Menu listener notice:', err.message)
        ),
        onSnapshot(
          collection(db, 'tenants', tenantId, 'tables'),
          (snap) => {
            const items: RestaurantTable[] = [];
            snap.forEach((d) => items.push({ id: d.id, ...d.data() } as RestaurantTable));
            if (active) setTables(items);
          },
          (err) => console.warn('Tables listener notice:', err.message)
        ),
        onSnapshot(
          collection(db, 'tenants', tenantId, 'staff'),
          (snap) => {
            const items: UserProfile[] = [];
            snap.forEach((d) => items.push({ uid: d.id, ...d.data() } as UserProfile));
            if (active) setStaff(items);
          },
          (err) => console.warn('Staff listener notice:', err.message)
        )
      ];

      if (active) setLoading(false);
      return () => {
        active = false;
        unsubs.forEach((unsub) => unsub());
      };
    }
  }, [tenantId, isMockMode]);

  // Route active tab based on path
  const path = location.pathname;
  let activeTab = 'overview';
  if (path.endsWith('/orders')) activeTab = 'orders';
  else if (path.endsWith('/menu')) activeTab = 'menu';
  else if (path.endsWith('/tables')) activeTab = 'tables';
  else if (path.endsWith('/staff')) activeTab = 'staff';
  else if (path.endsWith('/reports')) activeTab = 'reports';
  else if (path.endsWith('/settings')) activeTab = 'settings';

  if (loading) {
    return (
      <DashboardLayout title="Restaurant Admin Portal" sidebarItems={sidebarItems}>
        <div className="flex h-64 items-center justify-center text-zinc-400">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
            <p className="text-xs font-semibold">Loading operations dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Restaurant Operations & Management" sidebarItems={sidebarItems}>
      {activeTab === 'overview' && <DashboardOverviewTab orders={orders} tables={tables} />}
      {activeTab === 'orders' && <OrdersTab tenantId={tenantId} orders={orders} isMockMode={isMockMode} />}
      {activeTab === 'menu' && <MenuTab tenantId={tenantId} menuItems={menuItems} isMockMode={isMockMode} />}
      {activeTab === 'tables' && <TablesTab tenantId={tenantId} tables={tables} isMockMode={isMockMode} />}
      {activeTab === 'staff' && <StaffTab tenantId={tenantId} staff={staff} isMockMode={isMockMode} />}
      {activeTab === 'reports' && <ReportsTab orders={orders} />}
      {activeTab === 'settings' && <SettingsTab tenantId={tenantId} isMockMode={isMockMode} />}
    </DashboardLayout>
  );
};
