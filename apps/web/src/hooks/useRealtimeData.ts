import { useState, useEffect } from 'react';
import { db } from '../lib/firebase.js';
import { OrderRepository, MenuRepository, TableRepository, UserRepository } from '@restaurant-qr/infra';
import type { Order, MenuItem, Table, UserProfile } from '@restaurant-qr/core';

function seedMockDataForTenant(tenantId: string) {
  // 1. Seed tables if empty
  const storedTables = localStorage.getItem('restaurant_qr_mock_tables_db');
  let tablesList: Table[] = storedTables ? JSON.parse(storedTables) : [];
  const tenantTables = tablesList.filter((t) => t.tenantId === tenantId);
  if (tenantTables.length === 0) {
    const newTables: Table[] = [
      { id: `tbl_${tenantId}_1`, tenantId, number: 'Table 1', seatingCapacity: 2, status: 'occupied', qrToken: `qr_${tenantId}_1`, createdAt: new Date() },
      { id: `tbl_${tenantId}_2`, tenantId, number: 'Table 2', seatingCapacity: 4, status: 'available', qrToken: `qr_${tenantId}_2`, createdAt: new Date() },
      { id: `tbl_${tenantId}_3`, tenantId, number: 'Table 3', seatingCapacity: 4, status: 'occupied', qrToken: `qr_${tenantId}_3`, createdAt: new Date() },
      { id: `tbl_${tenantId}_4`, tenantId, number: 'Table 4', seatingCapacity: 6, status: 'available', qrToken: `qr_${tenantId}_4`, createdAt: new Date() }
    ];
    tablesList = [...tablesList, ...newTables];
    localStorage.setItem('restaurant_qr_mock_tables_db', JSON.stringify(tablesList));
  }

  // 2. Seed menu items if empty
  const storedMenu = localStorage.getItem('restaurant_qr_mock_menu_db');
  let menuList: MenuItem[] = storedMenu ? JSON.parse(storedMenu) : [];
  const tenantMenu = menuList.filter((m) => m.tenantId === tenantId);
  if (tenantMenu.length === 0) {
    const newMenu: MenuItem[] = [
      {
        id: `menu_${tenantId}_1`,
        tenantId,
        categoryId: 'mains',
        name: 'Margherita Pizza',
        description: 'Classic mozzarella, basil, and fresh tomato sauce',
        price: 12.99,
        priceMinor: 1299,
        images: ['https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500'],
        dietaryTags: ['veg'],
        allergens: ['dairy', 'gluten'],
        stockStatus: 'in-stock',
        preparationTime: 12,
        isActive: true,
        createdAt: new Date()
      } as any,
      {
        id: `menu_${tenantId}_2`,
        tenantId,
        categoryId: 'mains',
        name: 'Paneer Butter Masala',
        description: 'Cottage cheese cubes cooked in rich tomato gravy',
        price: 14.50,
        priceMinor: 1450,
        images: ['https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500'],
        dietaryTags: ['veg'],
        allergens: ['dairy', 'nuts'],
        stockStatus: 'in-stock',
        preparationTime: 15,
        isActive: true,
        createdAt: new Date()
      } as any,
      {
        id: `menu_${tenantId}_3`,
        tenantId,
        categoryId: 'starters',
        name: 'Garlic Bread Sticks',
        description: 'Baked bread strips glazed with garlic butter and herbs',
        price: 6.99,
        priceMinor: 699,
        images: ['https://images.unsplash.com/photo-1544982503-9f984c14501a?w=500'],
        dietaryTags: ['veg'],
        allergens: ['gluten'],
        stockStatus: 'in-stock',
        preparationTime: 8,
        isActive: true,
        createdAt: new Date()
      } as any,
      {
        id: `menu_${tenantId}_4`,
        tenantId,
        categoryId: 'drinks',
        name: 'Mango Lassi',
        description: 'Traditional sweet yogurt beverage with fresh mango pulp',
        price: 4.50,
        priceMinor: 450,
        images: ['https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=500'],
        dietaryTags: ['veg'],
        allergens: ['dairy'],
        stockStatus: 'in-stock',
        preparationTime: 5,
        isActive: true,
        createdAt: new Date()
      } as any
    ];
    menuList = [...menuList, ...newMenu];
    localStorage.setItem('restaurant_qr_mock_menu_db', JSON.stringify(menuList));
  }

  // 3. Seed orders if empty
  const storedOrders = localStorage.getItem('restaurant_qr_mock_orders_db');
  let ordersList: Order[] = storedOrders ? JSON.parse(storedOrders) : [];
  const tenantOrders = ordersList.filter((o) => o.tenantId === tenantId);
  if (tenantOrders.length === 0) {
    const today = new Date();
    const newOrders: Order[] = [
      {
        id: `ord_${tenantId}_1`,
        tenantId,
        tableId: `tbl_${tenantId}_1`,
        tableNumber: 'Table 1',
        customerId: `cust_${tenantId}_1`,
        customerName: 'Aman Sharma',
        status: 'preparing',
        kitchenStationStatus: { main: 'preparing' },
        totals: { subtotal: 19.98, tax: 1.00, serviceCharge: 1.50, tip: 2.00, discount: 0, grandTotal: 24.48 },
        totalsMinor: { subtotal: 1998, tax: 100, serviceCharge: 150, tip: 200, discount: 0, grandTotal: 2448 },
        payment: { status: 'paid', method: 'upi', amountPaid: 24.48 },
        createdAt: new Date(today.getTime() - 20 * 60000), // 20 mins ago
        updatedAt: new Date(),
        items: [
          { id: `item_${tenantId}_1`, menuItemId: `menu_${tenantId}_1`, name: 'Margherita Pizza', quantity: 1, unitPrice: 12.99, totalPrice: 12.99, stationId: 'main', status: 'preparing' },
          { id: `item_${tenantId}_2`, menuItemId: `menu_${tenantId}_3`, name: 'Garlic Bread Sticks', quantity: 1, unitPrice: 6.99, totalPrice: 6.99, stationId: 'main', status: 'ready' }
        ] as any
      } as any,
      {
        id: `ord_${tenantId}_2`,
        tenantId,
        tableId: `tbl_${tenantId}_3`,
        tableNumber: 'Table 3',
        customerId: `cust_${tenantId}_2`,
        customerName: 'Rohan Verma',
        status: 'pending',
        kitchenStationStatus: { main: 'pending' },
        totals: { subtotal: 14.50, tax: 0.73, serviceCharge: 1.00, tip: 0, discount: 0, grandTotal: 16.23 },
        totalsMinor: { subtotal: 1450, tax: 73, serviceCharge: 100, tip: 0, discount: 0, grandTotal: 1623 },
        payment: { status: 'unpaid', amountPaid: 0 },
        createdAt: new Date(today.getTime() - 5 * 60000), // 5 mins ago
        updatedAt: new Date(),
        items: [
          { id: `item_${tenantId}_3`, menuItemId: `menu_${tenantId}_2`, name: 'Paneer Butter Masala', quantity: 1, unitPrice: 14.50, totalPrice: 14.50, stationId: 'main', status: 'pending' }
        ] as any
      } as any,
      {
        id: `ord_${tenantId}_3`,
        tenantId,
        tableId: `tbl_${tenantId}_2`,
        tableNumber: 'Table 2',
        customerId: `cust_${tenantId}_3`,
        customerName: 'Priya Patel',
        status: 'completed',
        kitchenStationStatus: { main: 'ready' },
        totals: { subtotal: 21.49, tax: 1.07, serviceCharge: 2.00, tip: 3.00, discount: 0, grandTotal: 27.56 },
        totalsMinor: { subtotal: 2149, tax: 107, serviceCharge: 200, tip: 300, discount: 0, grandTotal: 2756 },
        payment: { status: 'paid', method: 'card', amountPaid: 27.56 },
        createdAt: new Date(today.getTime() - 90 * 60000), // 90 mins ago
        updatedAt: new Date(today.getTime() - 40 * 60000),
        items: [
          { id: `item_${tenantId}_4`, menuItemId: `menu_${tenantId}_2`, name: 'Paneer Butter Masala', quantity: 1, unitPrice: 14.50, totalPrice: 14.50, stationId: 'main', status: 'served' },
          { id: `item_${tenantId}_5`, menuItemId: `menu_${tenantId}_4`, name: 'Mango Lassi', quantity: 1, unitPrice: 4.50, totalPrice: 4.50, stationId: 'main', status: 'served' }
        ] as any
      } as any
    ];
    ordersList = [...ordersList, ...newOrders];
    localStorage.setItem('restaurant_qr_mock_orders_db', JSON.stringify(ordersList));
  }
}

export function useOrders(tenantId: string, isMockMode: boolean) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;

    if (isMockMode) {
      seedMockDataForTenant(tenantId);
      const syncMock = () => {
        const stored = localStorage.getItem('restaurant_qr_mock_orders_db');
        if (stored && active) {
          try {
            const all: Order[] = JSON.parse(stored);
            setOrders(all.filter((o) => o.tenantId === tenantId));
          } catch (e) {}
        }
        setLoading(false);
      };
      syncMock();
      const interval = setInterval(syncMock, 2000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    } else {
      const repo = new OrderRepository(db);
      const unsubscribe = repo.subscribeAll(tenantId, (data) => {
        if (active) {
          setOrders(data);
          setLoading(false);
        }
      });
      return () => {
        active = false;
        unsubscribe();
      };
    }
  }, [tenantId, isMockMode]);

  return { orders, loading };
}

export function useMenu(tenantId: string, isMockMode: boolean) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;

    if (isMockMode) {
      seedMockDataForTenant(tenantId);
      const syncMock = () => {
        const stored = localStorage.getItem('restaurant_qr_mock_menu_db');
        if (stored && active) {
          try {
            const all: MenuItem[] = JSON.parse(stored);
            setMenuItems(all.filter((m) => m.tenantId === tenantId));
          } catch (e) {}
        }
        setLoading(false);
      };
      syncMock();
      const interval = setInterval(syncMock, 2000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    } else {
      const repo = new MenuRepository(db);
      const unsubscribe = repo.subscribeMenu(tenantId, (data) => {
        if (active) {
          setMenuItems(data);
          setLoading(false);
        }
      });
      return () => {
        active = false;
        unsubscribe();
      };
    }
  }, [tenantId, isMockMode]);

  return { menuItems, loading };
}

export function useTables(tenantId: string, isMockMode: boolean) {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;

    if (isMockMode) {
      seedMockDataForTenant(tenantId);
      const syncMock = () => {
        const stored = localStorage.getItem('restaurant_qr_mock_tables_db');
        if (stored && active) {
          try {
            const all: Table[] = JSON.parse(stored);
            setTables(all.filter((t) => t.tenantId === tenantId));
          } catch (e) {}
        }
        setLoading(false);
      };
      syncMock();
      const interval = setInterval(syncMock, 2000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    } else {
      const repo = new TableRepository(db);
      const unsubscribe = repo.subscribeTables(tenantId, (data) => {
        if (active) {
          setTables(data);
          setLoading(false);
        }
      });
      return () => {
        active = false;
        unsubscribe();
      };
    }
  }, [tenantId, isMockMode]);

  return { tables, loading };
}

export function useStaff(tenantId: string, isMockMode: boolean) {
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;

    if (isMockMode) {
      const syncMock = () => {
        const stored = localStorage.getItem('restaurant_qr_mock_staff_db');
        if (stored && active) {
          try {
            const all: UserProfile[] = JSON.parse(stored);
            setStaff(all.filter((s) => s.tenantId === tenantId));
          } catch (e) {}
        }
        setLoading(false);
      };
      syncMock();
      const interval = setInterval(syncMock, 2000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    } else {
      const repo = new UserRepository(db);
      const unsubscribe = repo.subscribeTenantUsers(tenantId, (data) => {
        if (active) {
          setStaff(data);
          setLoading(false);
        }
      });
      return () => {
        active = false;
        unsubscribe();
      };
    }
  }, [tenantId, isMockMode]);

  return { staff, loading };
}
