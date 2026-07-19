import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '../../components/shared/DashboardLayout';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as authSignOut, sendPasswordResetEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { db, firebaseConfig, auth } from '../../lib/firebase.js';
import { MenuItemConverter, OrderRepository } from '@restaurant-qr/infra';
import { useAuth } from '../../features/auth/context/AuthContext.js';
import { useUserProfile } from '../../features/auth/context/UserContext.js';
import { useTenant } from '../../features/auth/context/TenantContext.js';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  ChefHat,
  Table,
  Users,
  FileText,
  Settings,
  Plus,
  QrCode,
  Download,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  Trash2,
  Mail,
  UserCheck,
  Upload,
  Receipt,
  Lock,
  Search,
  X
} from 'lucide-react';
import type { Order, MenuItem, Table as RestaurantTable, UserProfile, OrderStatus } from '@restaurant-qr/core';

// Mock storage database keys
const MOCK_MENU_KEY = 'restaurant_qr_mock_menu_db';
const MOCK_TABLES_KEY = 'restaurant_qr_mock_tables_db';
const MOCK_ORDERS_KEY = 'restaurant_qr_mock_orders_db';
const MOCK_STAFF_KEY = 'restaurant_qr_mock_staff_db';

const defaultMockMenu: MenuItem[] = [
  {
    id: 'menu_01',
    tenantId: 'tenant_dev_123',
    categoryId: 'burgers',
    name: 'Truffle Angus Burger',
    description: 'Fresh grilled Angus beef patty topped with truffle mayo, melted swiss cheese, and caramelized onions.',
    price: 18.50,
    images: [],
    dietaryTags: ['non-veg'],
    allergens: [],
    stockStatus: 'in-stock',
    preparationTime: 12,
    isActive: true
  },
  {
    id: 'menu_02',
    tenantId: 'tenant_dev_123',
    categoryId: 'pizza',
    name: 'Margherita Burrata Pizza',
    description: 'Neapolitan style thin crust, fresh San Marzano tomato sauce, topped with burrata cheese and fresh basil.',
    price: 15.50,
    images: [],
    dietaryTags: ['veg'],
    allergens: [],
    stockStatus: 'in-stock',
    preparationTime: 10,
    isActive: true
  },
  {
    id: 'menu_03',
    tenantId: 'tenant_dev_123',
    categoryId: 'beverages',
    name: 'Mint Lime Cooler',
    description: 'Refreshing cold-pressed lime juice mixed with crushed mint leaves and sparkling soda.',
    price: 6.00,
    images: [],
    dietaryTags: ['veg', 'vegan'],
    allergens: [],
    stockStatus: 'in-stock',
    preparationTime: 4,
    isActive: true
  }
];

const defaultMockTables: RestaurantTable[] = [
  { id: 'table_01', tenantId: 'tenant_dev_123', number: 'Table 01', seatingCapacity: 2, status: 'occupied', qrToken: 'tok_table_01', createdAt: new Date() },
  { id: 'table_02', tenantId: 'tenant_dev_123', number: 'Table 02', seatingCapacity: 4, status: 'available', qrToken: 'tok_table_02', createdAt: new Date() },
  { id: 'table_03', tenantId: 'tenant_dev_123', number: 'Table 03', seatingCapacity: 6, status: 'available', qrToken: 'tok_table_03', createdAt: new Date() }
];

const defaultMockOrders: Order[] = [
  {
    id: 'ord_101',
    tenantId: 'tenant_dev_123',
    tableId: 'table_01',
    tableNumber: 'Table 01',
    customerId: 'cust_abc123',
    customerName: 'Abhar Dev',
    status: 'preparing',
    kitchenStationStatus: { default: 'preparing' },
    items: [
      { id: 'item_01', menuItemId: 'menu_01', name: 'Truffle Angus Burger', quantity: 1, unitPrice: 18.50, totalPrice: 18.50, stationId: 'grill', status: 'preparing' },
      { id: 'item_02', menuItemId: 'menu_03', name: 'Mint Lime Cooler', quantity: 1, unitPrice: 6.00, totalPrice: 6.00, stationId: 'bar', status: 'ready' }
    ],
    totals: { subtotal: 24.50, tax: 1.23, serviceCharge: 0, tip: 0, discount: 0, grandTotal: 25.73 },
    payment: { status: 'unpaid', method: undefined, transactionId: undefined, amountPaid: 0 },
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const defaultMockStaff: UserProfile[] = [
  { uid: 'staff_01', email: 'manager@example.com', displayName: 'Operations Manager', role: 'manager', tenantId: 'tenant_dev_123', permissions: ['dashboard', 'menu', 'tables', 'staff'], createdAt: new Date() },
  { uid: 'staff_02', email: 'kitchen@example.com', displayName: 'Head Chef Chef', role: 'kitchen-staff', tenantId: 'tenant_dev_123', permissions: ['dashboard'], createdAt: new Date() }
];

export const RestaurantAdminDashboard: React.FC = () => {
  const location = useLocation();
  const { isMockMode } = useAuth();
  const { profile } = useUserProfile();
  const { tenant } = useTenant();

  const tenantId = profile?.tenantId || 'tenant_dev_123';

  const sidebarItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard, permission: 'dashboard' },
    { name: 'Orders', path: '/admin/orders', icon: Receipt, permission: 'orders' },
    { name: 'Menu Items', path: '/admin/menu', icon: ChefHat, permission: 'menu' },
    { name: 'Table Layout', path: '/admin/tables', icon: Table, permission: 'tables' },
    { name: 'Staff Crew', path: '/admin/staff', icon: Users, permission: 'staff' },
    { name: 'Reports', path: '/admin/reports', icon: FileText, permission: 'reports' },
    { name: 'Settings', path: '/admin/settings', icon: Settings, permission: 'settings' },
  ].filter(item => {
    if (!item.permission) return true;
    if (profile?.role === 'restaurant-admin') return true;
    return profile?.permissions?.includes(item.permission) || profile?.permissions?.includes('all');
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [ordersFilter, setOrdersFilter] = useState<'all' | 'new' | 'pending' | 'ready' | 'completed'>('all');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal triggers
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [viewingQrTable, setViewingQrTable] = useState<RestaurantTable | null>(null);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);

  // Loaders, Toast and Confirm Modal states
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{
    isOpen: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    message: '',
    type: 'success'
  });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ isOpen: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, isOpen: false }));
    }, 3000);
  };

  // Forms states
  const [newItemName, setNewItemName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemPrep, setNewItemPrep] = useState('10');
  const [newItemTags, setNewItemTags] = useState('Non-Veg');

  const [newTableNum, setNewTableNum] = useState('');
  const [newTableCap, setNewTableCap] = useState('4');

  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'manager' | 'kitchen-staff' | 'waiter' | 'cashier'>('manager');
  const [newStaffPassword, setNewStaffPassword] = useState('');

  // Staff edit and reset password states
  const [editingStaff, setEditingStaff] = useState<UserProfile | null>(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffRole, setEditStaffRole] = useState<'manager' | 'kitchen-staff' | 'waiter' | 'cashier'>('manager');

  const [resettingStaff, setResettingStaff] = useState<UserProfile | null>(null);
  const [resetStaffPassword, setResetStaffPassword] = useState('');

  // Menu Catalog Filter states
  const [menuSearch, setMenuSearch] = useState('');
  const [menuDietaryFilter, setMenuDietaryFilter] = useState<'all' | 'veg' | 'non-veg' | 'vegan'>('all');
  const [menuStockFilter, setMenuStockFilter] = useState<'all' | 'in-stock' | 'out-of-stock' | 'limited'>('all');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<string>('all');

  const [taxConfig, setTaxConfig] = useState({
    gstRate: 5.0,
    serviceCharge: 10.0,
    currency: 'USD',
  });

  // General Restaurant and Admin Security settings states
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantLogo, setRestaurantLogo] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Load settings and configurations
  useEffect(() => {
    if (tenant) {
      setRestaurantName(tenant.name || '');
      setRestaurantLogo(tenant.logoUrl || '');
    }
  }, [tenant]);

  useEffect(() => {
    let active = true;
    const loadGeneralSettings = async () => {
      if (isMockMode) {
        // Load custom settings
        const cached = localStorage.getItem(`restaurant_qr_settings_${tenantId}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (active) {
              setTaxConfig({
                gstRate: parsed.gstRate ?? 5.0,
                serviceCharge: parsed.serviceCharge ?? 10.0,
                currency: parsed.currency ?? 'INR'
              });
            }
          } catch (e) {
            console.error(e);
          }
        }
        // Load custom tenant details
        const cachedTenant = localStorage.getItem(`restaurant_qr_mock_tenant_info_${tenantId}`);
        if (cachedTenant) {
          try {
            const parsed = JSON.parse(cachedTenant);
            if (active) {
              setRestaurantName(parsed.name || '');
              setRestaurantLogo(parsed.logoUrl || '');
            }
          } catch (e) {
            console.error(e);
          }
        }
      } else {
        try {
          const docRef = doc(db, 'tenants', tenantId, 'settings', 'general');
          const snap = await getDoc(docRef);
          if (snap.exists() && active) {
            const data = snap.data();
            setTaxConfig({
              gstRate: data.taxRate ?? 5.0,
              serviceCharge: data.serviceChargeRate ?? 10.0,
              currency: data.currency ?? 'INR'
            });
          }
        } catch (err) {
          console.error('Failed to load general settings:', err);
        }
      }
    };

    loadGeneralSettings();
    return () => { active = false; };
  }, [isMockMode, tenantId]);

  const handleDownloadTableQR = async (tableNum: string, tableId: string) => {
    try {
      const targetUrl = `http://localhost:5173/customer/table/${tenantId}/${tableId}`;
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(qrApiUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `qr_code_${tableNum.toLowerCase().replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert(`Failed to download QR code: ${err.message}`);
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      try {
        const lines = text.split(/\r?\n/);
        if (lines.length <= 1) {
          throw new Error('CSV is empty or missing headers.');
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
        
        // Validate required headers
        if (!headers.includes('name') || !headers.includes('price')) {
          throw new Error('CSV must contain at least "name" and "price" columns.');
        }

        const parsedItems: MenuItem[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Robust regex to split commas, ignoring commas inside double-quotes
          const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
          const values = matches.map(v => v.trim().replace(/^["']|["']$/g, ''));

          if (values.length < headers.length) continue;

          const row: any = {};
          headers.forEach((header, idx) => {
            row[header] = values[idx];
          });

          const price = parseFloat(row.price) || 0;
          const prep = parseInt(row.preparationtime || row.preptime) || 10;
          const itemId = `menu_csv_${Math.floor(Math.random() * 100000)}`;

          const tags = row.dietarytags 
            ? row.dietarytags.split(';').map((s: string) => s.trim().toLowerCase()) 
            : [];

          parsedItems.push({
            id: itemId,
            tenantId,
            categoryId: row.categoryid || 'default',
            name: row.name || 'Unnamed Dish',
            description: row.description || '',
            price,
            images: [],
            dietaryTags: tags as any[],
            allergens: [],
            stockStatus: 'in-stock',
            preparationTime: prep,
            isActive: true
          });
        }

        if (parsedItems.length === 0) {
          throw new Error('No valid menu item rows parsed.');
        }

        // Commit parsed items to DB
        if (isMockMode) {
          const updated = [...menuItems, ...parsedItems];
          setMenuItems(updated);
          localStorage.setItem(MOCK_MENU_KEY, JSON.stringify(updated));
        } else {
          // Live Firebase Batch Write
          const batch = writeBatch(db);
          parsedItems.forEach((item) => {
            const docRef = doc(db, 'tenants', tenantId, 'menu_items', item.id);
            batch.set(docRef, {
              id: item.id,
              tenantId: item.tenantId,
              categoryId: item.categoryId,
              name: item.name,
              description: item.description,
              price: item.price,
              images: item.images,
              dietaryTags: item.dietaryTags,
              allergens: item.allergens,
              stockStatus: item.stockStatus,
              preparationTime: item.preparationTime,
              isActive: item.isActive,
              createdAt: serverTimestamp()
            });
          });
          await batch.commit();
        }

        alert(`Successfully imported ${parsedItems.length} menu items from CSV!`);
      } catch (err: any) {
        alert(`CSV Import Failed: ${err.message}`);
      }
    };

    reader.readAsText(file);
    // Clear input so same file can be uploaded again
    e.target.value = '';
  };

  const handleCSVExport = () => {
    if (menuItems.length === 0) {
      alert('No menu items available to export.');
      return;
    }

    const headers = ['name', 'price', 'description', 'preparationTime', 'categoryId', 'dietaryTags'];
    const csvRows = [headers.join(',')];

    for (const item of menuItems) {
      const escapedName = item.name.replace(/"/g, '""');
      const escapedDesc = (item.description || '').replace(/"/g, '""');
      const escapedCategory = (item.categoryId || 'default').replace(/"/g, '""');
      
      const row = [
        `"${escapedName}"`,
        item.price,
        `"${escapedDesc}"`,
        item.preparationTime,
        `"${escapedCategory}"`,
        `"${item.dietaryTags.join(';')}"`
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `menu_export_${tenantId}_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Load and Synchronize data lists
  useEffect(() => {
    let active = true;

    if (isMockMode) {
      // 1. Load Menu
      const cachedMenu = localStorage.getItem(MOCK_MENU_KEY);
      const activeMenu = cachedMenu ? JSON.parse(cachedMenu) : defaultMockMenu;
      setMenuItems(activeMenu);
      if (!cachedMenu) localStorage.setItem(MOCK_MENU_KEY, JSON.stringify(defaultMockMenu));

      // 2. Load Tables
      const cachedTables = localStorage.getItem(MOCK_TABLES_KEY);
      const activeTables = cachedTables ? JSON.parse(cachedTables) : defaultMockTables;
      setTables(activeTables);
      if (!cachedTables) localStorage.setItem(MOCK_TABLES_KEY, JSON.stringify(defaultMockTables));

      // 3. Load Orders
      const cachedOrders = localStorage.getItem(MOCK_ORDERS_KEY);
      const activeOrders = cachedOrders ? JSON.parse(cachedOrders) : defaultMockOrders;
      const parsedOrders = activeOrders.map((o: any) => ({
        ...o,
        createdAt: new Date(o.createdAt),
        updatedAt: new Date(o.updatedAt)
      }));
      setOrders(parsedOrders);
      setAllOrders(parsedOrders);
      if (!cachedOrders) localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(defaultMockOrders));

      // 4. Load Staff
      const cachedStaff = localStorage.getItem(MOCK_STAFF_KEY);
      const activeStaff = cachedStaff ? JSON.parse(cachedStaff) : defaultMockStaff;
      setStaff(activeStaff.map((s: any) => ({
        ...s,
        createdAt: new Date(s.createdAt)
      })));
      if (!cachedStaff) localStorage.setItem(MOCK_STAFF_KEY, JSON.stringify(defaultMockStaff));

      setLoading(false);
    } else {
      // Real-time Firestore synchronizations
      const menuCol = collection(db, 'tenants', tenantId, 'menu_items').withConverter(MenuItemConverter);
      const unsubMenu = onSnapshot(menuCol, (snap: any) => {
        if (active) setMenuItems(snap.docs.map((d: any) => d.data()));
      });

      const tablesCol = collection(db, 'tenants', tenantId, 'tables');
      const unsubTables = onSnapshot(tablesCol, (snap: any) => {
        if (active) {
          setTables(snap.docs.map((d: any) => ({
            id: d.id,
            ...d.data()
          } as RestaurantTable)));
        }
      });

      const orderRepo = new OrderRepository(db);
      const unsubOrders = orderRepo.subscribeActive(tenantId, (ordersList) => {
        if (active) setOrders(ordersList);
      });
      const unsubAllOrders = orderRepo.subscribeAll(tenantId, (ordersList) => {
        if (active) setAllOrders(ordersList);
      });

      const staffCol = collection(db, 'tenants', tenantId, 'staff');
      const unsubStaff = onSnapshot(staffCol, (snap: any) => {
        if (active) {
          setStaff(snap.docs.map((d: any) => ({
            uid: d.id,
            ...d.data()
          } as UserProfile)));
        }
      });

      setLoading(false);

      return () => {
        active = false;
        unsubMenu();
        unsubTables();
        unsubOrders();
        unsubAllOrders();
        unsubStaff();
      };
    }
  }, [isMockMode, tenantId]);

  // Modifiers
  const toggleMenuAvailability = async (itemId: string) => {
    const item = menuItems.find(i => i.id === itemId);
    if (!item) return;

    const nextActive = !item.isActive;
    setActionLoading(true);

    try {
      if (isMockMode) {
        const updated = menuItems.map(i => i.id === itemId ? { ...i, isActive: nextActive } : i);
        setMenuItems(updated);
        localStorage.setItem(MOCK_MENU_KEY, JSON.stringify(updated));
      } else {
        await updateDoc(doc(db, 'tenants', tenantId, 'menu_items', itemId), {
          isActive: nextActive
        });
      }
      showToast(`Item availability set to ${nextActive ? 'Active' : 'Inactive'}`, 'success');
    } catch (err: any) {
      showToast(`Failed to update item availability: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPrice.trim()) return;

    const price = parseFloat(newItemPrice) || 0;
    const prep = parseInt(newItemPrep) || 10;
    const itemId = `menu_00${Math.floor(Math.random() * 1000)}`;

    const newItem: MenuItem = {
      id: itemId,
      tenantId,
      categoryId: 'default',
      name: newItemName,
      description: newItemDesc,
      price,
      images: [],
      dietaryTags: newItemTags.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) as any[],
      allergens: [],
      stockStatus: 'in-stock',
      preparationTime: prep,
      isActive: true
    };

    setActionLoading(true);
    try {
      if (isMockMode) {
        const updated = [...menuItems, newItem];
        setMenuItems(updated);
        localStorage.setItem(MOCK_MENU_KEY, JSON.stringify(updated));
      } else {
        await setDoc(
          doc(db, 'tenants', tenantId, 'menu_items', itemId).withConverter(MenuItemConverter),
          {
            ...newItem,
            createdAt: serverTimestamp()
          }
        );
      }

      setNewItemName('');
      setNewItemDesc('');
      setNewItemPrice('');
      setShowAddMenuModal(false);
      showToast('Menu item added successfully', 'success');
    } catch (err: any) {
      showToast(`Failed to add menu item: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMenuItem = async (itemId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Menu Item',
      message: 'Are you sure you want to permanently delete this menu item from the catalog?',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setActionLoading(true);
        try {
          if (isMockMode) {
            const updated = menuItems.filter(i => i.id !== itemId);
            setMenuItems(updated);
            localStorage.setItem(MOCK_MENU_KEY, JSON.stringify(updated));
          } else {
            await deleteDoc(doc(db, 'tenants', tenantId, 'menu_items', itemId));
          }
          showToast('Menu item deleted successfully', 'success');
        } catch (err: any) {
          showToast(`Failed to delete item: ${err.message}`, 'error');
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNum.trim()) return;

    const tableId = `table_00${Math.floor(Math.random() * 1000)}`;
    const newTable: RestaurantTable = {
      id: tableId,
      tenantId,
      number: newTableNum,
      seatingCapacity: parseInt(newTableCap) || 4,
      status: 'available',
      qrToken: `tok_${tableId}`,
      createdAt: new Date()
    };

    setActionLoading(true);
    try {
      if (isMockMode) {
        const updated = [...tables, newTable];
        setTables(updated);
        localStorage.setItem(MOCK_TABLES_KEY, JSON.stringify(updated));
      } else {
        await setDoc(doc(db, 'tenants', tenantId, 'tables', tableId), {
          number: newTable.number,
          seatingCapacity: newTable.seatingCapacity,
          status: newTable.status,
          qrToken: newTable.qrToken,
          createdAt: serverTimestamp()
        });
      }

      setNewTableNum('');
      setShowAddTableModal(false);
      showToast('Table layout added successfully', 'success');
    } catch (err: any) {
      showToast(`Failed to add table: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Decommission Table',
      message: 'Are you sure you want to delete this table? Customers will no longer be able to scan its QR code.',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setActionLoading(true);
        try {
          if (isMockMode) {
            const updated = tables.filter(t => t.id !== tableId);
            setTables(updated);
            localStorage.setItem(MOCK_TABLES_KEY, JSON.stringify(updated));
          } else {
            await deleteDoc(doc(db, 'tenants', tenantId, 'tables', tableId));
          }
          showToast('Table layout decommissioned successfully', 'success');
        } catch (err: any) {
          showToast(`Failed to delete table: ${err.message}`, 'error');
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const hashPasswordLocal = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffEmail.trim() || !newStaffName.trim() || !newStaffPassword.trim()) return;

    const resolveInitialPermissions = (role: string): string[] => {
      switch (role) {
        case 'super-admin': return ['all'];
        case 'restaurant-admin': return ['dashboard', 'menu', 'tables', 'staff', 'reports', 'settings'];
        case 'manager': return ['dashboard', 'orders', 'menu', 'tables', 'staff', 'reports'];
        case 'kitchen-staff': return ['kds', 'order_status'];
        case 'waiter': return ['tables', 'requests', 'serve'];
        case 'cashier': return ['billing', 'payments', 'refunds', 'receipts'];
        default: return ['dashboard'];
      }
    };

    setActionLoading(true);
    try {
      if (isMockMode) {
        const uid = `staff_00${Math.floor(Math.random() * 1000)}`;
        const newMember: UserProfile = {
          uid,
          email: newStaffEmail.toLowerCase(),
          displayName: newStaffName,
          role: newStaffRole,
          tenantId,
          permissions: resolveInitialPermissions(newStaffRole),
          createdAt: new Date()
        };

        const updated = [...staff, newMember];
        setStaff(updated);
        localStorage.setItem(MOCK_STAFF_KEY, JSON.stringify(updated));

        // Add to login credentials DB
        const hashed = await hashPasswordLocal(newStaffPassword);
        const rawDb = localStorage.getItem('restaurant_qr_mock_credentials_db');
        const credentialsDb = rawDb ? JSON.parse(rawDb) : {};
        credentialsDb[newStaffEmail.toLowerCase()] = {
          uid,
          email: newStaffEmail.toLowerCase(),
          displayName: newStaffName,
          passwordHash: hashed,
          claims: { role: newStaffRole, tenantId }
        };
        localStorage.setItem('restaurant_qr_mock_credentials_db', JSON.stringify(credentialsDb));
      } else {
        // Create secondary app to signup staff member without breaking current session
        const secondaryApp = initializeApp(firebaseConfig, `StaffProvision_${Date.now()}`);
        const secondaryAuth = getAuth(secondaryApp);
        const credential = await createUserWithEmailAndPassword(secondaryAuth, newStaffEmail.toLowerCase(), newStaffPassword);
        const newUid = credential.user.uid;
        await authSignOut(secondaryAuth);

        const newMember: UserProfile = {
          uid: newUid,
          email: newStaffEmail.toLowerCase(),
          displayName: newStaffName,
          role: newStaffRole,
          tenantId,
          permissions: resolveInitialPermissions(newStaffRole),
          createdAt: new Date()
        };

        await setDoc(doc(db, 'users', newUid), {
          email: newMember.email,
          displayName: newMember.displayName,
          role: newMember.role,
          tenantId: newMember.tenantId,
          permissions: newMember.permissions,
          createdAt: serverTimestamp()
        });
        await setDoc(doc(db, 'tenants', tenantId, 'staff', newUid), {
          email: newMember.email,
          displayName: newMember.displayName,
          role: newMember.role,
          tenantId: newMember.tenantId,
          permissions: newMember.permissions,
          createdAt: serverTimestamp()
        });
      }

      setNewStaffEmail('');
      setNewStaffName('');
      setNewStaffPassword('');
      setShowAddStaffModal(false);
      showToast('Staff credentials created and invited successfully', 'success');
    } catch (err: any) {
      showToast(`Failed to add staff member: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteStaff = async (uid: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Staff Profile',
      message: 'Are you sure you want to permanently delete this staff member? They will lose all dashboard portal access.',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setActionLoading(true);
        try {
          if (isMockMode) {
            const updated = staff.filter(s => s.uid !== uid);
            setStaff(updated);
            localStorage.setItem(MOCK_STAFF_KEY, JSON.stringify(updated));

            // Clean mock credentials
            const sProfile = staff.find(s => s.uid === uid);
            if (sProfile) {
              const rawDb = localStorage.getItem('restaurant_qr_mock_credentials_db');
              if (rawDb) {
                const credentialsDb = JSON.parse(rawDb);
                delete credentialsDb[sProfile.email.toLowerCase()];
                localStorage.setItem('restaurant_qr_mock_credentials_db', JSON.stringify(credentialsDb));
              }
            }
          } else {
            await deleteDoc(doc(db, 'users', uid));
            await deleteDoc(doc(db, 'tenants', tenantId, 'staff', uid));
          }
          showToast('Staff profile deleted successfully', 'success');
        } catch (err: any) {
          showToast(`Failed to delete staff member: ${err.message}`, 'error');
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff || !editStaffName.trim()) return;

    setActionLoading(true);
    try {
      if (isMockMode) {
        const updated = staff.map(s => s.uid === editingStaff.uid
          ? { ...s, displayName: editStaffName, role: editStaffRole }
          : s
        );
        setStaff(updated);
        localStorage.setItem(MOCK_STAFF_KEY, JSON.stringify(updated));

        // Update name in local mock credentials DB
        const rawDb = localStorage.getItem('restaurant_qr_mock_credentials_db');
        if (rawDb) {
          const credentialsDb = JSON.parse(rawDb);
          if (credentialsDb[editingStaff.email.toLowerCase()]) {
            credentialsDb[editingStaff.email.toLowerCase()].displayName = editStaffName;
            credentialsDb[editingStaff.email.toLowerCase()].claims.role = editStaffRole;
            localStorage.setItem('restaurant_qr_mock_credentials_db', JSON.stringify(credentialsDb));
          }
        }
      } else {
        await updateDoc(doc(db, 'users', editingStaff.uid), {
          displayName: editStaffName,
          role: editStaffRole
        });
        await updateDoc(doc(db, 'tenants', tenantId, 'staff', editingStaff.uid), {
          displayName: editStaffName,
          role: editStaffRole
        });
      }
      setEditingStaff(null);
      showToast('Staff profile updated successfully', 'success');
    } catch (err: any) {
      showToast(`Failed to update staff member: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetStaffPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingStaff || !resetStaffPassword.trim()) return;

    setActionLoading(true);
    try {
      if (isMockMode) {
        const hashed = await hashPasswordLocal(resetStaffPassword);
        const rawDb = localStorage.getItem('restaurant_qr_mock_credentials_db');
        if (rawDb) {
          const credentialsDb = JSON.parse(rawDb);
          if (credentialsDb[resettingStaff.email.toLowerCase()]) {
            credentialsDb[resettingStaff.email.toLowerCase()].passwordHash = hashed;
            localStorage.setItem('restaurant_qr_mock_credentials_db', JSON.stringify(credentialsDb));
          }
        }
        showToast('Staff password updated successfully in sandbox', 'success');
      } else {
        // Save configured password to Firestore document record
        await updateDoc(doc(db, 'users', resettingStaff.uid), {
          tempPasswordConfigured: resetStaffPassword,
          updatedAt: serverTimestamp()
        });
        await updateDoc(doc(db, 'tenants', tenantId, 'staff', resettingStaff.uid), {
          tempPasswordConfigured: resetStaffPassword,
          updatedAt: serverTimestamp()
        });
        
        // Send email reset link as a secure fallback
        await sendPasswordResetEmail(auth, resettingStaff.email);
        showToast('Password configured & reset instructions sent', 'success');
      }
      setResettingStaff(null);
      setResetStaffPassword('');
    } catch (err: any) {
      showToast(`Failed to configure password: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadOperationsReport = () => {
    setActionLoading(true);
    try {
      const paidOrders = allOrders.filter(o => o.payment?.status === 'paid');
      const grossRevenue = paidOrders.reduce((sum, o) => sum + (o.totals?.grandTotal || 0), 0);
      const totalTax = paidOrders.reduce((sum, o) => sum + (o.totals?.tax || 0), 0);
      const totalService = paidOrders.reduce((sum, o) => sum + (o.totals?.serviceCharge || 0), 0);
      const aov = paidOrders.length > 0 ? (grossRevenue / paidOrders.length) : 0;

      // Build CSV content
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "RESTAURANT OPERATIONS & BUSINESS REPORT\n";
      csvContent += `Generated At,${new Date().toLocaleString()}\n`;
      csvContent += `Tenant ID,${tenantId}\n\n`;

      csvContent += "BUSINESS METRICS SUMMARY\n";
      csvContent += `Metric,Value\n`;
      csvContent += `Total Orders placed,${allOrders.length}\n`;
      csvContent += `Paid Orders,${paidOrders.length}\n`;
      csvContent += `Gross Revenue,INR ${grossRevenue.toFixed(2)}\n`;
      csvContent += `Average Order Value (AOV),INR ${aov.toFixed(2)}\n`;
      csvContent += `Total GST Collected,INR ${totalTax.toFixed(2)}\n`;
      csvContent += `Total Service Charges,INR ${totalService.toFixed(2)}\n`;
      csvContent += `Staff count,${staff.length}\n`;
      csvContent += `Table occupancy,${tables.filter(t => t.status === 'occupied').length} of ${tables.length}\n\n`;

      csvContent += "ORDER RECORD LEDGER\n";
      csvContent += "Order ID,Table ID,Table Number,Customer Name,KDS Status,Payment Status,Subtotal,Tax,Service Charge,Grand Total,Placed Date\n";
      
      allOrders.forEach((o) => {
        const orderDate = o.createdAt ? new Date(o.createdAt).toISOString() : '';
        const cleanName = (o.customerName || 'Guest').replace(/,/g, ' ');
        csvContent += `${o.id},${o.tableId},${o.tableNumber},${cleanName},${o.status},${o.payment?.status || 'unpaid'},${o.totals?.subtotal || 0},${o.totals?.tax || 0},${o.totals?.serviceCharge || 0},${o.totals?.grandTotal || 0},${orderDate}\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `operations_report_${tenantId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast('Operations report CSV downloaded successfully', 'success');
    } catch (err: any) {
      showToast(`Failed to generate report: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, currentStatus: OrderStatus) => {
    let nextStatus: OrderStatus = 'completed';
    if (currentStatus === 'pending') nextStatus = 'preparing';
    else if (currentStatus === 'preparing') nextStatus = 'ready';
    else if (currentStatus === 'ready') nextStatus = 'served';

    setActionLoading(true);
    try {
      if (isMockMode) {
        const updated = allOrders.map(o => o.id === orderId ? { ...o, status: nextStatus, updatedAt: new Date() } : o);
        setAllOrders(updated);
        setOrders(updated.filter(o => o.status !== 'completed' && o.status !== 'archived'));
        localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(updated));
      } else {
        await updateDoc(doc(db, 'tenants', tenantId, 'orders', orderId), {
          status: nextStatus,
          updatedAt: serverTimestamp()
        });
      }
      showToast(`Order status updated to ${nextStatus}`, 'success');
    } catch (err: any) {
      showToast(`Failed to update order status: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    setActionLoading(true);
    try {
      if (isMockMode) {
        const updated = allOrders.map(o => o.id === orderId ? { ...o, status: newStatus, updatedAt: new Date() } : o);
        setAllOrders(updated);
        setOrders(updated.filter(o => o.status !== 'completed' && o.status !== 'archived'));
        localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(updated));
      } else {
        await updateDoc(doc(db, 'tenants', tenantId, 'orders', orderId), {
          status: newStatus,
          updatedAt: serverTimestamp()
        });
      }
      showToast(`Order status set to ${newStatus}`, 'success');
    } catch (err: any) {
      showToast(`Failed to set order status: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePaymentStatus = async (orderId: string, grandTotal: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Settle Payment',
      message: `Confirm payment settlement of ₹${grandTotal.toFixed(2)} for this table order?`,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setActionLoading(true);
        try {
          if (isMockMode) {
            const updated = allOrders.map(o => o.id === orderId ? { ...o, payment: { status: 'paid' as any, amountPaid: grandTotal }, updatedAt: new Date() } : o);
            setAllOrders(updated);
            setOrders(updated.filter(o => o.status !== 'completed' && o.status !== 'archived'));
            localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(updated));
          } else {
            await updateDoc(doc(db, 'tenants', tenantId, 'orders', orderId), {
              'payment.status': 'paid',
              'payment.amountPaid': grandTotal,
              updatedAt: serverTimestamp()
            });
          }
          showToast('Payment settled successfully', 'success');
        } catch (err: any) {
          showToast(`Failed to settle payment: ${err.message}`, 'error');
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleRefundPayment = async (orderId: string, grandTotal: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Refund Payment',
      message: `Confirm payment refund of ₹${grandTotal.toFixed(2)} for this table order?`,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setActionLoading(true);
        try {
          if (isMockMode) {
            const updated = allOrders.map(o => o.id === orderId ? { ...o, payment: { ...o.payment, status: 'refunded' as any }, updatedAt: new Date() } : o);
            setAllOrders(updated);
            setOrders(updated.filter(o => o.status !== 'completed' && o.status !== 'archived'));
            localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(updated));
          } else {
            await updateDoc(doc(db, 'tenants', tenantId, 'orders', orderId), {
              'payment.status': 'refunded',
              updatedAt: serverTimestamp()
            });
          }
          showToast('Payment refunded successfully', 'success');
        } catch (err: any) {
          showToast(`Failed to refund payment: ${err.message}`, 'error');
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handlePrintReceipt = (order: Order) => {
    const receiptWindow = window.open('', '_blank');
    if (!receiptWindow) {
      showToast('Pop-up blocker prevented printing receipt', 'error');
      return;
    }
    const itemsHtml = order.items.map(it => `
      <tr>
        <td style="padding: 6px 0;">${it.name} x${it.quantity}</td>
        <td style="text-align: right; padding: 6px 0;">₹${(it.unitPrice * it.quantity).toFixed(2)}</td>
      </tr>
    `).join('');
    
    receiptWindow.document.write(`
      <html>
        <head>
          <title>Receipt - Order #${order.id.slice(-6).toUpperCase()}</title>
          <style>
            body { font-family: monospace; padding: 20px; max-width: 300px; margin: 0 auto; color: #000; }
            h2, p { text-align: center; margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            .border-top { border-top: 1px dashed #000; }
            .total { font-weight: bold; font-size: 16px; }
          </style>
        </head>
        <body>
          <h2>INVOICE</h2>
          <p><strong>Order ID:</strong> #${order.id.slice(-6).toUpperCase()}</p>
          <p><strong>Table:</strong> ${order.tableNumber}</p>
          <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
          <table>
            <thead>
              <tr style="border-bottom: 1px dashed #000;">
                <th style="text-align: left; padding-bottom: 5px;">Item</th>
                <th style="text-align: right; padding-bottom: 5px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr class="border-top">
                <td style="padding-top: 10px;">Subtotal</td>
                <td style="text-align: right; padding-top: 10px;">₹${(order.totals?.subtotal || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Taxes & Fees</td>
                <td style="text-align: right;">₹${((order.totals?.tax || 0) + (order.totals?.serviceCharge || 0)).toFixed(2)}</td>
              </tr>
              <tr class="total">
                <td style="padding-top: 10px;">Grand Total</td>
                <td style="text-align: right; padding-top: 10px;">₹${(order.totals?.grandTotal || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <p style="margin-top: 30px; font-size: 10px;">Thank you for dining with us!</p>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    receiptWindow.document.close();
  };
  
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      if (isMockMode) {
        localStorage.setItem(`restaurant_qr_settings_${tenantId}`, JSON.stringify({
          gstRate: taxConfig.gstRate,
          serviceCharge: taxConfig.serviceCharge,
          currency: taxConfig.currency
        }));
        
        const mockTenantInfo = {
          name: restaurantName,
          logoUrl: restaurantLogo
        };
        localStorage.setItem(`restaurant_qr_mock_tenant_info_${tenantId}`, JSON.stringify(mockTenantInfo));
        showToast('Restaurant details & billing settings updated successfully in sandbox', 'success');
        setTimeout(() => { window.location.reload(); }, 1000);
      } else {
        await updateDoc(doc(db, 'tenants', tenantId), {
          name: restaurantName,
          logoUrl: restaurantLogo
        });

        await setDoc(doc(db, 'tenants', tenantId, 'settings', 'general'), {
          taxRate: taxConfig.gstRate,
          serviceChargeRate: taxConfig.serviceCharge,
          currency: taxConfig.currency,
          updatedAt: serverTimestamp()
        }, { merge: true });

        showToast('Restaurant details & billing settings updated successfully', 'success');
        setTimeout(() => { window.location.reload(); }, 1000);
      }
    } catch (err: any) {
      showToast(`Failed to update configurations: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      showToast('Please fill out all password fields', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }

    setActionLoading(true);
    try {
      if (isMockMode) {
        const hashedCurrent = await hashPasswordLocal(currentPassword);
        const hashedNew = await hashPasswordLocal(newPassword);
        
        const rawDb = localStorage.getItem('restaurant_qr_mock_credentials_db');
        if (rawDb) {
          const credentialsDb = JSON.parse(rawDb);
          const adminEmail = profile?.email || '';
          const userObj = credentialsDb[adminEmail.toLowerCase()];
          if (userObj) {
            if (userObj.passwordHash !== hashedCurrent) {
              throw new Error('Current password is incorrect.');
            }
            userObj.passwordHash = hashedNew;
            localStorage.setItem('restaurant_qr_mock_credentials_db', JSON.stringify(credentialsDb));
            showToast('Your administrator password has been updated in sandbox', 'success');
          } else {
            throw new Error('Administrator profile credentials record not found.');
          }
        }
      } else {
        if (!auth.currentUser) throw new Error('No user is currently signed in');
        
        const email = auth.currentUser.email || '';
        const credential = EmailAuthProvider.credential(email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        
        await updatePassword(auth.currentUser, newPassword);
        showToast('Your administrator password has been updated successfully', 'success');
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast(`Password update failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Determine active tab/subpage based on route path
  const path = location.pathname;
  let activeTab = 'overview';
  if (path.endsWith('/menu')) activeTab = 'menu';
  else if (path.endsWith('/tables')) activeTab = 'tables';
  else if (path.endsWith('/staff')) activeTab = 'staff';
  else if (path.endsWith('/reports')) activeTab = 'reports';
  else if (path.endsWith('/settings')) activeTab = 'settings';
  else if (path.endsWith('/orders')) activeTab = 'orders';

  // Dynamically resolve tables occupied status based on active orders
  const resolvedTables = tables.map((t) => {
    const hasActiveOrder = orders.some(
      (o) => (o.tableId === t.id || o.tableNumber === t.number) && 
             o.status !== 'completed' && 
             o.status !== 'archived'
    );
    if (hasActiveOrder && t.status !== 'occupied') {
      return { ...t, status: 'occupied' as const };
    }
    return t;
  });

  // Dynamic report statistics
  const avgPrepTime = menuItems.length > 0
    ? Math.round(menuItems.reduce((acc, item) => acc + item.preparationTime, 0) / menuItems.length)
    : 0;

  const occupiedTablesCount = resolvedTables.filter(t => t.status === 'occupied').length;
  const occupancyPercentage = resolvedTables.length > 0
    ? Math.round((occupiedTablesCount / resolvedTables.length) * 100)
    : 0;

  const categoryCounts = menuItems.reduce((acc: Record<string, number>, item) => {
    acc[item.categoryId] = (acc[item.categoryId] || 0) + 1;
    return acc;
  }, {});
  let topCategory = 'None';
  let maxCount = 0;
  Object.entries(categoryCounts).forEach(([cat, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topCategory = cat;
    }
  });
  const popularCategory = topCategory.charAt(0).toUpperCase() + topCategory.slice(1);

  // Check permission for active tab
  const hasPermission = (tab: string) => {
    if (!profile) return true; // wait for profile load, let loading state handle it
    if (profile.role === 'restaurant-admin') return true;
    const permissionMap: Record<string, string> = {
      overview: 'dashboard',
      orders: 'orders',
      menu: 'menu',
      tables: 'tables',
      staff: 'staff',
      reports: 'reports',
      settings: 'settings',
    };
    const reqPerm = permissionMap[tab];
    return !reqPerm || profile.permissions?.includes(reqPerm) || profile.permissions?.includes('all');
  };

  if (profile && !hasPermission(activeTab)) {
    return (
      <DashboardLayout title="Access Denied" sidebarItems={sidebarItems}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
          <div className="h-16 w-16 bg-red-500/10 border border-red-500/25 rounded-2xl flex items-center justify-center text-red-450">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Permission Denied</h2>
          <p className="text-xs text-zinc-500 max-w-sm">
            You do not have the required access permissions to view the "{activeTab.toUpperCase()}" management dashboard. Please contact your administrator.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Restaurant Operations" sidebarItems={sidebarItems}>
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent animate-pulse"></div>
        </div>
      ) : activeTab === 'overview' ? (
        <div className="space-y-6">
          {/* Operations Overview */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border border-zinc-900 bg-zinc-900/30 p-5 rounded-2xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Sales Today</p>
              <h3 className="text-2xl font-bold text-white mt-1.5">
                ₹{allOrders.reduce((sum, o) => sum + (o.payment?.status === 'paid' ? o.totals?.grandTotal || 0 : 0), 0).toFixed(2)}
              </h3>
              <span className="text-[10px] text-emerald-400 font-medium">Calculated from paid receipts</span>
            </div>
            <div className="border border-zinc-900 bg-zinc-900/30 p-5 rounded-2xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Active Tables</p>
              <h3 className="text-2xl font-bold text-white mt-1.5">{occupiedTablesCount} / {resolvedTables.length}</h3>
              <span className="text-[10px] text-zinc-500 font-medium">Occupancy tracking live</span>
            </div>
            <div className="border border-zinc-900 bg-zinc-900/30 p-5 rounded-2xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Kitchen Prep Load</p>
              <h3 className="text-2xl font-bold text-white mt-1.5">
                {orders.filter(o => o.status === 'preparing' || o.status === 'pending').length} Active
              </h3>
              <span className="text-[10px] text-zinc-500 font-medium">KDS monitors working station</span>
            </div>
            <div className="border border-zinc-900 bg-zinc-900/30 p-5 rounded-2xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Menu Items Listed</p>
              <h3 className="text-2xl font-bold text-white mt-1.5">{menuItems.length} Dishes</h3>
              <span className="text-[10px] text-emerald-400 font-medium">{menuItems.filter(i => i.isActive).length} currently active</span>
            </div>
          </div>

          {/* Live Orders Tracking */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Recent Orders List */}
            <div className="lg:col-span-2 border border-zinc-900 bg-zinc-900/20 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-zinc-900 flex justify-between items-center bg-zinc-900/10">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Live Orders Board</h3>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 border border-emerald-500/15 rounded-full uppercase font-bold tracking-wider animate-pulse">
                  Real-time syncing
                </span>
              </div>

              <div className="divide-y divide-zinc-900/50">
                {orders.length === 0 ? (
                  <div className="p-10 text-center text-zinc-500 text-xs">
                    No active table orders running.
                  </div>
                ) : (
                  orders.map((o) => (
                    <div key={o.id} className="p-5 hover:bg-zinc-900/10 transition space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider">Table:</span>
                            <span className="font-extrabold text-white text-sm">
                              {tables.find(t => t.id === o.tableId)?.number || o.tableNumber}
                            </span>
                            
                            <span className="text-zinc-800">|</span>
                            
                            <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider">Table ID:</span>
                            <span className="text-[11px] bg-zinc-900 text-zinc-350 px-2 py-0.5 border border-zinc-850 rounded-md font-medium font-mono">
                              {o.tableId}
                            </span>
                            
                            <span className="text-zinc-800">|</span>
                            
                            <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider">Order ID:</span>
                            <span className="text-[11px] text-zinc-300 font-bold font-mono">
                              #{o.id}
                            </span>
                            
                            <span className="text-zinc-800">|</span>
                            
                            <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider">Customer:</span>
                            <span className="text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 px-2 py-0.5 rounded-full font-semibold">
                              {o.customerName || 'Guest'}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400">Total Bill: ₹{o.totals?.grandTotal.toFixed(2)}</p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`inline-block text-[9px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                            o.status === 'ready'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10'
                              : o.status === 'preparing'
                              ? 'bg-orange-500/10 text-orange-400 border-orange-500/10'
                              : 'bg-zinc-800 text-zinc-500 border-zinc-800'
                          }`}>
                            {o.status}
                          </span>
                          <span className={`text-xs font-bold ${o.payment?.status === 'paid' ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {o.payment?.status === 'paid' ? 'Paid' : 'Unpaid'}
                          </span>
                        </div>
                      </div>

                      {/* Display items of the order */}
                      {o.items && o.items.length > 0 && (
                        <div className="p-3 bg-zinc-900/30 border border-zinc-900/60 rounded-xl space-y-1.5">
                          <span className="text-[9px] text-zinc-500 uppercase font-extrabold tracking-wider block">Items ordered</span>
                          <div className="divide-y divide-zinc-900/40 text-xs">
                            {o.items.map((item) => (
                              <div key={item.id} className="py-1.5 flex justify-between">
                                <div className="text-zinc-300">
                                  <span className="font-bold text-zinc-200">{item.name}</span>
                                  <span className="text-zinc-500 ml-1.5">x{item.quantity}</span>
                                </div>
                                <span className="font-medium text-zinc-400">₹{item.totalPrice.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action controllers */}
                      <div className="flex gap-2">
                        {o.status !== 'completed' && o.status !== 'archived' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(o.id, o.status)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition"
                          >
                            {o.status === 'pending' && 'Accept Order'}
                            {o.status === 'preparing' && 'Mark Ready'}
                            {o.status === 'ready' && 'Mark Served'}
                            {o.status === 'served' && 'Complete Order'}
                          </button>
                        )}
                        {o.payment?.status !== 'paid' && (
                          <button
                            onClick={() => handleUpdatePaymentStatus(o.id, o.totals.grandTotal)}
                            className="border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-lg transition"
                          >
                            Settle Payment
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Stats Panel */}
            <div className="border border-zinc-900 bg-zinc-900/20 rounded-2xl p-5 space-y-6">
              <div>
                <h3 className="text-xs font-extrabold text-zinc-500 uppercase tracking-wider">Live KDS Overview</h3>
                <div className="mt-4 space-y-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">Pending Orders</span>
                    <span className="bg-zinc-900 px-2 py-0.5 rounded text-white font-bold font-mono">
                      {orders.filter(o => o.status === 'pending').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">In the Kitchen</span>
                    <span className="bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded font-bold font-mono border border-orange-500/15">
                      {orders.filter(o => o.status === 'preparing').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">Ready for Pickup</span>
                    <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold font-mono border border-emerald-500/15">
                      {orders.filter(o => o.status === 'ready').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">Served Tables</span>
                    <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-bold font-mono">
                      {orders.filter(o => o.status === 'served').length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-px bg-zinc-900/80" />

              <div>
                <h3 className="text-xs font-extrabold text-zinc-500 uppercase tracking-wider">Table Status</h3>
                <div className="mt-4 space-y-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">Occupied Tables</span>
                    <span className="text-zinc-200 font-bold font-mono">
                      {occupiedTablesCount} / {resolvedTables.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">Available Tables</span>
                    <span className="text-zinc-200 font-bold font-mono">
                      {resolvedTables.filter(t => t.status === 'available').length} / {resolvedTables.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'menu' ? (
        <div className="space-y-6">
          <div className="border border-zinc-900 bg-zinc-900/20 rounded-2xl overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/10">
              <div>
                <h3 className="text-base font-bold text-white">Digital Menu Catalog</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Toggle availability and manage items listing</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-1.5 border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 cursor-pointer text-zinc-300 hover:text-white text-xs font-semibold px-4 py-2.5 transition rounded-xl">
                  <Upload className="h-4 w-4" />
                  Upload CSV
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleCSVUpload}
                  />
                </label>
                <button
                  onClick={handleCSVExport}
                  className="flex items-center gap-1.5 border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 text-zinc-300 hover:text-white text-xs font-semibold px-4 py-2.5 transition rounded-xl"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
                <button
                  onClick={() => setShowAddMenuModal(true)}
                  className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 transition rounded-xl"
                >
                  <Plus className="h-4 w-4" />
                  Add Menu Item
                </button>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="p-4 sm:p-6 border-b border-zinc-900 bg-zinc-900/5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Search Items</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3.5 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="text"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    className="w-full border border-zinc-800 bg-zinc-950 pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                    placeholder="Search by name..."
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Dietary Type</label>
                <select
                  value={menuDietaryFilter}
                  onChange={(e) => setMenuDietaryFilter(e.target.value as any)}
                  className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl cursor-pointer"
                >
                  <option value="all">All Diets</option>
                  <option value="veg">Veg</option>
                  <option value="non-veg">Non-Veg</option>
                  <option value="vegan">Vegan</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Category</label>
                <select
                  value={menuCategoryFilter}
                  onChange={(e) => setMenuCategoryFilter(e.target.value)}
                  className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {Array.from(new Set(menuItems.map(i => i.categoryId || 'default'))).map((catId) => (
                    <option key={catId} value={catId}>
                      {catId.charAt(0).toUpperCase() + catId.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Availability</label>
                <select
                  value={menuStockFilter}
                  onChange={(e) => setMenuStockFilter(e.target.value as any)}
                  className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl cursor-pointer"
                >
                  <option value="all">All Stock Statuses</option>
                  <option value="in-stock">In Stock</option>
                  <option value="out-of-stock">Out of Stock</option>
                  <option value="limited">Limited</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 text-zinc-500 text-xs font-bold uppercase tracking-wider bg-zinc-900/5">
                    <th className="px-6 py-4">Item Details</th>
                    <th className="px-6 py-4">Tags</th>
                    <th className="px-6 py-4">Price</th>
                    <th className="px-6 py-4">Prep Time</th>
                    <th className="px-6 py-4">Availability</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/60 text-sm">
                  {menuItems.filter((item) => {
                    if (menuSearch.trim() && !item.name.toLowerCase().includes(menuSearch.toLowerCase()) && !item.description.toLowerCase().includes(menuSearch.toLowerCase())) {
                      return false;
                    }
                    if (menuDietaryFilter !== 'all') {
                      const tags = item.dietaryTags || [];
                      if (!tags.includes(menuDietaryFilter as any)) return false;
                    }
                    if (menuCategoryFilter !== 'all' && (item.categoryId || 'default') !== menuCategoryFilter) {
                      return false;
                    }
                    if (menuStockFilter !== 'all' && item.stockStatus !== menuStockFilter) {
                      return false;
                    }
                    return true;
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-zinc-500 text-xs">
                        No menu items match the active filters.
                      </td>
                    </tr>
                  ) : (
                    menuItems.filter((item) => {
                      if (menuSearch.trim() && !item.name.toLowerCase().includes(menuSearch.toLowerCase()) && !item.description.toLowerCase().includes(menuSearch.toLowerCase())) {
                        return false;
                      }
                      if (menuDietaryFilter !== 'all') {
                        const tags = item.dietaryTags || [];
                        if (!tags.includes(menuDietaryFilter as any)) return false;
                      }
                      if (menuCategoryFilter !== 'all' && (item.categoryId || 'default') !== menuCategoryFilter) {
                        return false;
                      }
                      if (menuStockFilter !== 'all' && item.stockStatus !== menuStockFilter) {
                        return false;
                      }
                      return true;
                    }).map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-900/10 transition">
                        <td className="px-6 py-4">
                          <div className="font-bold text-white">{item.name}</div>
                          <div className="text-[10px] text-zinc-500 truncate max-w-sm mt-0.5">{item.description}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1.5 flex-wrap">
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                              {item.categoryId || 'default'}
                            </span>
                            {item.dietaryTags.map((tag) => (
                              <span key={tag} className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-bold text-zinc-300">₹{item.price.toFixed(2)}</td>
                        <td className="px-6 py-4 text-zinc-400">{item.preparationTime} mins</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleMenuAvailability(item.id)}
                            className="focus:outline-none"
                          >
                            {item.isActive ? (
                              <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                                Available <ToggleRight className="h-5 w-5 text-emerald-500" />
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-zinc-500 text-xs font-semibold">
                                Unavailable <ToggleLeft className="h-5 w-5 text-zinc-700" />
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDeleteMenuItem(item.id)}
                            className="p-1.5 border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-500/30 rounded-xl transition"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'tables' ? (
        <div className="space-y-6">
          <div className="border border-zinc-900 bg-zinc-900/20 rounded-2xl overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/10">
              <div>
                <h3 className="text-base font-bold text-white">Table QR Provisioning</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Generate, audit, and download table QR codes</p>
              </div>
              <button
                onClick={() => setShowAddTableModal(true)}
                className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 transition rounded-xl self-start sm:self-auto"
              >
                <Plus className="h-4 w-4" />
                Add Table
              </button>
            </div>

            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
              {resolvedTables.length === 0 ? (
                <div className="col-span-full py-10 text-center text-zinc-500 text-xs">
                  No table layouts configured. Click "Add Table" to set up your restaurant tables.
                </div>
              ) : (
                resolvedTables.map((t) => (
                  <div key={t.id} className="border border-zinc-900 bg-zinc-900/30 p-5 rounded-2xl flex flex-col justify-between h-48 shadow-lg relative group">
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-base text-white">{t.number}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-medium">
                            Cap: {t.seatingCapacity}
                          </span>
                          <button
                            onClick={() => handleDeleteTable(t.id)}
                            className="p-1.5 border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-500/30 rounded-lg transition"
                            title="Delete Table"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <span className={`inline-block text-[9px] uppercase font-extrabold tracking-wider px-2.5 py-0.5 border mt-2.5 rounded-full ${
                        t.status === 'occupied'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10'
                          : t.status === 'reserved'
                          ? 'bg-violet-500/10 text-violet-400 border-violet-500/10'
                          : 'bg-zinc-800 text-zinc-500 border-zinc-800'
                      }`}>
                        {t.status}
                      </span>
                    </div>

                    <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-900">
                      <button
                        onClick={() => setViewingQrTable(t)}
                        className="flex-1 py-2 bg-zinc-850 hover:bg-zinc-800 text-[10px] font-bold text-zinc-300 rounded-lg flex items-center justify-center gap-1.5"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        View QR Target
                      </button>
                      <button
                        onClick={() => handleDownloadTableQR(t.number, t.id)}
                        className="py-2 px-3 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 rounded-lg flex items-center justify-center"
                        title="Download QR"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'staff' ? (
        <div className="space-y-6">
          <div className="border border-zinc-900 bg-zinc-900/20 rounded-2xl overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/10">
              <div>
                <h3 className="text-base font-bold text-white">Staff Credentials Directory</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Control staff portal access permissions</p>
              </div>
              <button
                onClick={() => setShowAddStaffModal(true)}
                className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 transition rounded-xl self-start sm:self-auto"
              >
                <Plus className="h-4 w-4" />
                Add Staff Member
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Role Permission</th>
                    <th className="px-6 py-4">Access Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/60 text-sm">
                  {staff.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-zinc-500 text-xs">
                        No staff members invited yet. Click "Invite Staff Member" to add crew.
                      </td>
                    </tr>
                  ) : (
                    staff.map((s) => (
                      <tr key={s.uid} className="hover:bg-zinc-900/10 transition">
                        <td className="px-6 py-4 font-bold text-white">{s.displayName}</td>
                        <td className="px-6 py-4 text-zinc-400">{s.email}</td>
                        <td className="px-6 py-4">
                          <span className="inline-block text-[9px] font-extrabold uppercase tracking-wider bg-zinc-800/80 text-zinc-400 px-2 py-0.5 rounded-full">
                            {s.role.replace('-', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-emerald-400 font-semibold">Active Access</span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingStaff(s);
                              setEditStaffName(s.displayName);
                              setEditStaffRole(s.role as any);
                            }}
                            className="text-[10px] font-bold bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-2 py-1 rounded-lg transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setResettingStaff(s);
                              setResetStaffPassword('');
                            }}
                            className="text-[10px] font-bold bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-2 py-1 rounded-lg transition"
                          >
                            Reset Password
                          </button>
                          <button
                            onClick={() => handleDeleteStaff(s.uid)}
                            className="text-[10px] font-bold bg-red-500/10 hover:bg-red-500/20 border border-red-500/15 text-red-400 px-2 py-1 rounded-lg transition"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'reports' ? (
        <div className="space-y-6">
          <div className="border border-zinc-900 bg-zinc-900/20 rounded-2xl overflow-hidden animate-fadeIn">
            <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-900/10">
              <div>
                <h3 className="text-base font-bold text-white">Operations & Business Analytics</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Review performance reports and download metrics files</p>
              </div>
              <div className="flex gap-2.5">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 text-zinc-300 hover:text-white text-xs font-semibold px-4 py-2.5 transition rounded-xl"
                >
                  <FileText className="h-4 w-4" />
                  Print PDF Summary
                </button>
                <button
                  onClick={handleDownloadOperationsReport}
                  className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 transition rounded-xl"
                >
                  <Download className="h-4 w-4" />
                  Download CSV Report
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              <div className="border border-zinc-900 bg-zinc-900/40 p-5 rounded-2xl">
                <h4 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Gross Revenue</h4>
                <h3 className="text-xl font-bold text-emerald-400 mt-2">
                  ₹{allOrders.filter(o => o.payment?.status === 'paid').reduce((sum, o) => sum + (o.totals?.grandTotal || 0), 0).toFixed(2)}
                </h3>
                <span className="text-[10px] text-zinc-400">Total settled paid receipts</span>
              </div>

              <div className="border border-zinc-900 bg-zinc-900/40 p-5 rounded-2xl">
                <h4 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Average Order Value (AOV)</h4>
                <h3 className="text-xl font-bold text-white mt-2">
                  ₹{(
                    (() => {
                      const paid = allOrders.filter(o => o.payment?.status === 'paid');
                      if (paid.length === 0) return 0;
                      return paid.reduce((sum, o) => sum + (o.totals?.grandTotal || 0), 0) / paid.length;
                    })()
                  ).toFixed(2)}
                </h3>
                <span className="text-[10px] text-zinc-400">From {allOrders.filter(o => o.payment?.status === 'paid').length} paid tickets</span>
              </div>

              <div className="border border-zinc-900 bg-zinc-900/40 p-5 rounded-2xl">
                <h4 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Total Orders Placed</h4>
                <h3 className="text-xl font-bold text-white mt-2">{allOrders.length}</h3>
                <span className="text-[10px] text-zinc-400">Active and completed tickets combined</span>
              </div>

              <div className="border border-zinc-900 bg-zinc-900/40 p-5 rounded-2xl">
                <h4 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Average Order Prep Time</h4>
                <h3 className="text-xl font-bold text-white mt-2">{avgPrepTime} mins</h3>
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3" /> Calculated from menu catalog
                </span>
              </div>

              <div className="border border-zinc-900 bg-zinc-900/40 p-5 rounded-2xl">
                <h4 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Live Table Occupancy Rate</h4>
                <h3 className="text-xl font-bold text-white mt-2">{occupancyPercentage}%</h3>
                <span className="text-[10px] text-zinc-400">{occupiedTablesCount} of {resolvedTables.length} tables currently active</span>
              </div>

              <div className="border border-zinc-900 bg-zinc-900/40 p-5 rounded-2xl">
                <h4 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Largest Menu Category</h4>
                <h3 className="text-xl font-bold text-white mt-2">{popularCategory}</h3>
                <span className="text-[10px] text-zinc-400 font-medium">Contains {maxCount} menu items</span>
              </div>
            </div>

            <div className="p-6 border-t border-zinc-900">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Operations Breakdown</h4>
              <div className="overflow-x-auto border border-zinc-900 rounded-xl">
                <table className="w-full text-left border-collapse text-xs text-zinc-400">
                  <thead>
                    <tr className="bg-zinc-900/40 border-b border-zinc-900 font-bold uppercase tracking-wider text-zinc-500">
                      <th className="px-6 py-3">Metric Dimension</th>
                      <th className="px-6 py-3 text-right">Value Record</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900/60">
                    <tr>
                      <td className="px-6 py-3 font-semibold text-zinc-300">Total Provisioned Tables</td>
                      <td className="px-6 py-3 text-right text-white font-bold">{resolvedTables.length} tables</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-3 font-semibold text-zinc-300">Registered Crew Members</td>
                      <td className="px-6 py-3 text-right text-white font-bold">{staff.length} employees</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-3 font-semibold text-zinc-300">Active Dining Tables Count</td>
                      <td className="px-6 py-3 text-right text-emerald-400 font-bold">{occupiedTablesCount} active</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-3 font-semibold text-zinc-300">Dietary Categories Count</td>
                      <td className="px-6 py-3 text-right text-white font-bold">{Array.from(new Set(menuItems.map(i => i.categoryId || 'default'))).length} categories</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-3 font-semibold text-zinc-300">Menu Catalog Size</td>
                      <td className="px-6 py-3 text-right text-white font-bold">{menuItems.length} items listed</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'orders' ? (
        <div className="space-y-6">
          <div className="border border-zinc-900 bg-zinc-900/20 rounded-2xl overflow-hidden animate-fadeIn">
            <div className="p-6 border-b border-zinc-900 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900/10">
              <div>
                <h3 className="text-base font-bold text-white">All Orders Ledger</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Historical log of all transactions, active tickets, and settled bills</p>
              </div>

              {/* Filtering tabs */}
              <div className="flex flex-wrap gap-1 bg-zinc-950 p-1 border border-zinc-900 rounded-xl">
                {(['all', 'new', 'pending', 'ready', 'completed'] as const).map((tab) => {
                  const isActive = ordersFilter === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setOrdersFilter(tab)}
                      className={`text-[10px] font-extrabold uppercase tracking-wider px-3 py-2 rounded-lg transition ${
                        isActive
                          ? 'bg-emerald-500 text-white shadow-md'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {tab === 'all' && 'All'}
                      {tab === 'new' && 'New'}
                      {tab === 'pending' && 'Preparing'}
                      {tab === 'ready' && 'Ready'}
                      {tab === 'completed' && 'Completed'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-900 text-zinc-500 font-extrabold uppercase tracking-wider bg-zinc-900/10">
                    <th className="px-6 py-4">Order ID</th>
                    <th className="px-6 py-4">Table</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Ordered Items</th>
                    <th className="px-6 py-4">Total Amount</th>
                    <th className="px-6 py-4">KDS Status</th>
                    <th className="px-6 py-4">Payment</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/50">
                  {allOrders.filter((o) => {
                    if (ordersFilter === 'all') return true;
                    if (ordersFilter === 'new') return o.status === 'pending';
                    if (ordersFilter === 'pending') return o.status === 'preparing';
                    if (ordersFilter === 'ready') return o.status === 'ready';
                    if (ordersFilter === 'completed') return o.status === 'completed' || o.status === 'served' || o.status === 'archived';
                    return true;
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-zinc-500 font-medium">
                        No orders found matching the filter.
                      </td>
                    </tr>
                  ) : (
                    allOrders.filter((o) => {
                      if (ordersFilter === 'all') return true;
                      if (ordersFilter === 'new') return o.status === 'pending';
                      if (ordersFilter === 'pending') return o.status === 'preparing';
                      if (ordersFilter === 'ready') return o.status === 'ready';
                      if (ordersFilter === 'completed') return o.status === 'completed' || o.status === 'served' || o.status === 'archived';
                      return true;
                    }).map((o) => (
                      <tr key={o.id} className="hover:bg-zinc-900/10 transition">
                        <td className="px-6 py-4 font-bold font-mono text-zinc-300">#{o.id}</td>
                        <td className="px-6 py-4 font-extrabold text-white">
                          {tables.find(t => t.id === o.tableId)?.number || o.tableNumber}
                          <span className="block text-[10px] text-zinc-500 font-mono mt-0.5">{o.tableId}</span>
                        </td>
                        <td className="px-6 py-4 text-zinc-300 font-medium">{o.customerName || 'Guest Customer'}</td>
                        <td className="px-6 py-4 space-y-1 max-w-[240px]">
                          {o.items?.map((item) => (
                            <div key={item.id} className="text-[11px] flex justify-between gap-3 text-zinc-400">
                              <span className="truncate">{item.name} <strong className="text-zinc-500">x{item.quantity}</strong></span>
                              <span className="font-mono text-zinc-500">₹{(item.unitPrice * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </td>
                        <td className="px-6 py-4 font-bold text-white font-mono">₹{o.totals?.grandTotal.toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <select
                            value={o.status}
                            onChange={(e) => handleSetOrderStatus(o.id, e.target.value as OrderStatus)}
                            className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px] font-bold px-2.5 py-1.5 rounded-xl focus:outline-none focus:border-emerald-500 cursor-pointer"
                          >
                            <option value="pending">Pending (New)</option>
                            <option value="accepted">Accepted</option>
                            <option value="preparing">Preparing</option>
                            <option value="ready">Ready</option>
                            <option value="served">Served</option>
                            <option value="completed">Completed</option>
                            <option value="archived">Archived</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            o.payment?.status === 'paid'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/10'
                          }`}>
                            {o.payment?.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {o.payment?.status !== 'paid' ? (
                            <button
                              onClick={() => handleUpdatePaymentStatus(o.id, o.totals.grandTotal)}
                              className="text-[10px] font-bold bg-zinc-900 text-zinc-350 border border-zinc-800 px-3 py-1.5 rounded-xl hover:bg-zinc-800 transition cursor-pointer"
                            >
                              Settle
                            </button>
                          ) : (
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handlePrintReceipt(o)}
                                className="text-[10px] font-bold bg-zinc-900 text-zinc-350 border border-zinc-800 px-2.5 py-1.5 rounded-xl hover:bg-zinc-800 transition cursor-pointer"
                                title="Print Invoice"
                              >
                                Print
                              </button>
                              {(o.payment?.status as string) !== 'refunded' && (
                                <button
                                  onClick={() => handleRefundPayment(o.id, o.totals.grandTotal)}
                                  className="text-[10px] font-bold bg-red-950/20 text-red-400 border border-red-900/30 px-2.5 py-1.5 rounded-xl hover:bg-red-900/20 transition cursor-pointer"
                                >
                                  Refund
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
          {/* Card 1: Restaurant Details & Billing */}
          <div className="border border-zinc-900 bg-zinc-900/20 p-6 rounded-2xl space-y-6">
            <div>
              <h3 className="text-base font-bold text-white">Restaurant Settings</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Configure your store brand identity and dining tax parameters</p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Restaurant Name</label>
                <input
                  type="text"
                  required
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                  placeholder="e.g. Gourmet Grill"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Restaurant Logo URL</label>
                <input
                  type="text"
                  value={restaurantLogo}
                  onChange={(e) => setRestaurantLogo(e.target.value)}
                  className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                  placeholder="https://example.com/logo.png"
                />
                {restaurantLogo && (
                  <div className="mt-2 flex items-center gap-3 bg-zinc-900/40 p-2.5 border border-zinc-900 rounded-xl">
                    <img src={restaurantLogo} alt="Logo preview" className="h-10 w-10 object-cover rounded-lg" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    <span className="text-[10px] text-zinc-500 font-mono truncate">{restaurantLogo}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-semibold">GST / Tax rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={taxConfig.gstRate}
                    onChange={(e) => setTaxConfig({ ...taxConfig, gstRate: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-semibold">Service Charge (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={taxConfig.serviceCharge}
                    onChange={(e) => setTaxConfig({ ...taxConfig, serviceCharge: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Default Currency</label>
                <select
                  value={taxConfig.currency}
                  onChange={(e) => setTaxConfig({ ...taxConfig, currency: e.target.value })}
                  className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl cursor-pointer"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-500/10 mt-2"
              >
                Save configurations
              </button>
            </form>
          </div>

          {/* Card 2: Security & Password Update */}
          <div className="border border-zinc-900 bg-zinc-900/20 p-6 rounded-2xl space-y-6">
            <div>
              <h3 className="text-base font-bold text-white">Admin Security Settings</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Change your portal login credentials securely</p>
            </div>

            <form onSubmit={handleChangeAdminPassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Current Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full border border-zinc-800 bg-zinc-900 pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                    placeholder="Enter current password"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border border-zinc-800 bg-zinc-900 pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                    placeholder="Enter new password"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full border border-zinc-800 bg-zinc-900 pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-500/10 mt-2"
              >
                Update password
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 1. Add Menu Item Modal */}
      {showAddMenuModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md border border-zinc-800 bg-zinc-950 p-6 shadow-2xl rounded-2xl text-white"
          >
            <h3 className="text-lg font-bold text-white mb-2">Add Menu Item</h3>
            <p className="text-xs text-zinc-500 mb-6">Create a new digital dish card in your catalog</p>

            <form onSubmit={handleAddMenuItem} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Dish Name</label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs focus:outline-none text-zinc-200 rounded-xl"
                  placeholder="e.g. Avocado Toast"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Description</label>
                <textarea
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs focus:outline-none text-zinc-200 rounded-xl h-20 resize-none"
                  placeholder="Ingredients and prep notes..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-semibold">Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs focus:outline-none text-zinc-200 rounded-xl"
                    placeholder="12.50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-semibold">Prep Time (mins)</label>
                  <input
                    type="number"
                    value={newItemPrep}
                    onChange={(e) => setNewItemPrep(e.target.value)}
                    className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs focus:outline-none text-zinc-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Dietary Tags (comma separated)</label>
                <input
                  type="text"
                  value={newItemTags}
                  onChange={(e) => setNewItemTags(e.target.value)}
                  className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs focus:outline-none text-zinc-200 rounded-xl"
                  placeholder="Veg, Vegan, Gluten Free"
                />
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddMenuModal(false)}
                  className="px-4 py-2 border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/10"
                >
                  Save Dish
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 2. Add Table Modal */}
      {showAddTableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md border border-zinc-800 bg-zinc-950 p-6 shadow-2xl rounded-2xl text-white"
          >
            <h3 className="text-lg font-bold text-white mb-2">Add Restaurant Table</h3>
            <p className="text-xs text-zinc-500 mb-6">Provision a new physical table layout with QR credentials</p>

            <form onSubmit={handleAddTable} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Table Code/Number</label>
                <input
                  type="text"
                  required
                  value={newTableNum}
                  onChange={(e) => setNewTableNum(e.target.value)}
                  className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs focus:outline-none text-zinc-200 rounded-xl"
                  placeholder="e.g. Table 04"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Seating Capacity</label>
                <input
                  type="number"
                  value={newTableCap}
                  onChange={(e) => setNewTableCap(e.target.value)}
                  className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs focus:outline-none text-zinc-200 rounded-xl"
                />
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddTableModal(false)}
                  className="px-4 py-2 border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl"
                >
                  Add Table
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Table QR Target Modal */}
      {viewingQrTable && (() => {
        const qrUrl = `${window.location.protocol}//${window.location.host}/customer/table/${tenantId}/${viewingQrTable.id}`;
        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrUrl)}`;
        
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm border border-zinc-800 bg-zinc-950 p-6 shadow-2xl rounded-2xl text-white text-center"
            >
              <div className="flex justify-between items-center mb-4 border-b border-zinc-900 pb-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Table QR Details</h3>
                <button 
                  onClick={() => setViewingQrTable(null)}
                  className="p-1.5 text-zinc-500 hover:text-white rounded-lg transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="my-5 bg-white p-4.5 rounded-2xl inline-block shadow-lg border border-zinc-200">
                <img 
                  src={qrImageUrl} 
                  alt={`${viewingQrTable.number} QR Code`} 
                  className="w-48 h-48 mx-auto"
                />
              </div>

              <div className="space-y-1.5 mt-2">
                <h4 className="text-base font-extrabold text-white">{viewingQrTable.number}</h4>
                <p className="text-[10px] text-zinc-500 max-w-xs mx-auto break-all font-mono leading-relaxed bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-900">
                  {qrUrl}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-zinc-900">
                <button
                  onClick={() => window.open(qrUrl, '_blank')}
                  className="py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Test Scan / Open
                </button>
                <button
                  onClick={() => {
                    handleDownloadTableQR(viewingQrTable.number, viewingQrTable.id);
                  }}
                  className="py-2.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 border border-zinc-800"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* 3. Add Staff Modal */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md border border-zinc-800 bg-zinc-950 p-6 shadow-2xl rounded-2xl text-white"
          >
            <h3 className="text-lg font-bold text-white mb-2">Add Staff Crew Member</h3>
            <p className="text-xs text-zinc-500 mb-6">Create credentials and associate roles with this restaurant</p>

            <form onSubmit={handleAddStaff} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Crew Member Name</label>
                <div className="relative">
                  <UserCheck className="absolute left-3 top-3 h-4.5 w-4.5 text-zinc-500" />
                  <input
                    type="text"
                    required
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    className="w-full border border-zinc-800 bg-zinc-900 pl-10 pr-4 py-2.5 text-xs focus:outline-none text-zinc-200 rounded-xl"
                    placeholder="e.g. John Doe"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4.5 w-4.5 text-zinc-500" />
                  <input
                    type="email"
                    required
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                    className="w-full border border-zinc-800 bg-zinc-900 pl-10 pr-4 py-2.5 text-xs focus:outline-none text-zinc-200 rounded-xl"
                    placeholder="staff@example.com"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Sign In Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4.5 w-4.5 text-zinc-500" />
                  <input
                    type="password"
                    required
                    value={newStaffPassword}
                    onChange={(e) => setNewStaffPassword(e.target.value)}
                    className="w-full border border-zinc-800 bg-zinc-900 pl-10 pr-4 py-2.5 text-xs focus:outline-none text-zinc-200 rounded-xl"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Crew Access Role</label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as any)}
                  className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs focus:outline-none text-zinc-200 rounded-xl"
                >
                  <option value="manager">Operations Manager</option>
                  <option value="kitchen-staff">KDS Kitchen Chef</option>
                  <option value="waiter">Floor Serving Staff</option>
                  <option value="cashier">POS Bill Cashier</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl"
                >
                  Add Staff
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 4. Edit Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md border border-zinc-800 bg-zinc-950 p-6 shadow-2xl rounded-2xl text-white animate-scaleIn"
          >
            <h3 className="text-lg font-bold text-white mb-2">Edit Staff Profile</h3>
            <p className="text-xs text-zinc-500 mb-6">Modify details for crew member: <span className="text-zinc-300 font-bold">{editingStaff.email}</span></p>

            <form onSubmit={handleEditStaff} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Crew Member Name</label>
                <div className="relative">
                  <UserCheck className="absolute left-3 top-3 h-4.5 w-4.5 text-zinc-500" />
                  <input
                    type="text"
                    required
                    value={editStaffName}
                    onChange={(e) => setEditStaffName(e.target.value)}
                    className="w-full border border-zinc-800 bg-zinc-900 pl-10 pr-4 py-2.5 text-xs focus:outline-none text-zinc-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Crew Access Role</label>
                <select
                  value={editStaffRole}
                  onChange={(e) => setEditStaffRole(e.target.value as any)}
                  className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs focus:outline-none text-zinc-200 rounded-xl"
                >
                  <option value="manager">Operations Manager</option>
                  <option value="kitchen-staff">KDS Kitchen Chef</option>
                  <option value="waiter">Floor Serving Staff</option>
                  <option value="cashier">POS Bill Cashier</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 5. Reset Password Modal */}
      {resettingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md border border-zinc-800 bg-zinc-950 p-6 shadow-2xl rounded-2xl text-white animate-scaleIn"
          >
            <h3 className="text-lg font-bold text-white mb-2">Reset Staff Password</h3>
            <p className="text-xs text-zinc-500 mb-6">Configure a new login password for crew member: <span className="text-zinc-300 font-bold">{resettingStaff.email}</span></p>

            <form onSubmit={handleResetStaffPassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4.5 w-4.5 text-zinc-500" />
                  <input
                    type="password"
                    required
                    value={resetStaffPassword}
                    onChange={(e) => setResetStaffPassword(e.target.value)}
                    className="w-full border border-zinc-800 bg-zinc-900 pl-10 pr-4 py-2.5 text-xs focus:outline-none text-zinc-200 rounded-xl"
                    placeholder="Enter new password"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setResettingStaff(null)}
                  className="px-4 py-2 border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Action Loading Overlay */}
      {actionLoading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center">
          <div className="bg-zinc-950 border border-zinc-900 px-6 py-5 rounded-2xl flex flex-col items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
            <span className="text-xs font-bold text-zinc-400">Processing request...</span>
          </div>
        </div>
      )}

      {/* Sliding Toast Notification Banner */}
      {toast.isOpen && (
        <div className="fixed bottom-6 right-6 z-[9999] animate-slideIn">
          <div className={`px-4 py-3 rounded-xl border flex items-center gap-3 shadow-2xl backdrop-blur-md ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
              : toast.type === 'error'
              ? 'bg-red-500/10 border-red-500/25 text-red-400'
              : 'bg-indigo-500/10 border-indigo-500/25 text-indigo-400'
          }`}>
            <div className="text-xs font-bold">{toast.message}</div>
          </div>
        </div>
      )}

      {/* Confirm Modal Overlay */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-900 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-scaleIn">
            <div className="p-6 space-y-4">
              <h3 className="text-base font-bold text-white">{confirmModal.title}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{confirmModal.message}</p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="text-[10px] font-bold text-zinc-400 hover:text-white px-4 py-2 rounded-xl transition border border-zinc-900 bg-zinc-900/10 hover:bg-zinc-900/40"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmModal.onConfirm()}
                  className="text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl transition shadow-md"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
