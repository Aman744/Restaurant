import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/shared/DashboardLayout';
import { Utensils, HelpCircle, AlertCircle, CheckCircle, Send, CreditCard, RotateCcw, Check, Clock, Hotel } from 'lucide-react';
import type { Table, Order, OrderStatus } from '@restaurant-qr/core';
import { useUserProfile } from '../../features/auth/context/UserContext.js';
import { useAuth } from '../../features/auth/context/AuthContext.js';
import { useToast } from '../../components/shared/ToastContext';
import { db } from '../../lib/firebase.js';
import { doc, setDoc, updateDoc, onSnapshot, collection, deleteDoc, getDocs } from 'firebase/firestore';
import { OrderRepository } from '@restaurant-qr/infra';
import { EventService } from '../../services/EventService.js';

interface WaiterAlert {
  id: string;
  tableNumber: string;
  type: 'call_waiter' | 'bill_request' | 'service_request';
  time: string;
  status: 'pending' | 'accepted' | 'resolved';
  stayId?: string | null;
  guestName?: string | null;
  isRoom?: boolean;
}

const MOCK_TABLES_KEY = 'restaurant_qr_mock_tables_db';
const MOCK_ALERTS_KEY = 'restaurant_qr_mock_waiter_alerts_db';
const MOCK_ORDERS_KEY = 'restaurant_qr_mock_orders_db';

const defaultMockTables: Table[] = [
  { id: 't1', tenantId: 'sandbox', number: 'Table 1', seatingCapacity: 4, status: 'available', qrToken: 'qr_t1', createdAt: new Date() },
  { id: 't2', tenantId: 'sandbox', number: 'Table 2', seatingCapacity: 2, status: 'occupied', qrToken: 'qr_t2', createdAt: new Date() },
  { id: 't3', tenantId: 'sandbox', number: 'Table 3', seatingCapacity: 6, status: 'occupied', qrToken: 'qr_t3', createdAt: new Date() },
  { id: 't4', tenantId: 'sandbox', number: 'Table 4', seatingCapacity: 4, status: 'cleaning', qrToken: 'qr_t4', createdAt: new Date() },
];

const defaultMockAlerts: WaiterAlert[] = [
  { id: 'a1', tableNumber: 'Table 2', type: 'call_waiter', time: '2 mins ago', status: 'pending' },
  { id: 'a2', tableNumber: 'Table 4', type: 'bill_request', time: 'Just now', status: 'pending' },
];

import { useTenant } from '../../features/auth/context/TenantContext.js';

export const WaiterDashboard: React.FC = () => {
  const { profile } = useUserProfile();
  const { tenant } = useTenant();
  const { isMockMode } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const tenantId = tenant?.id || profile?.tenantId || 'sandbox';

  const [tenantList, setTenantList] = useState<{ id: string; name: string }[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState(tenantId);

  useEffect(() => {
    setSelectedTenantId(tenantId);
  }, [tenantId]);

  useEffect(() => {
    if (isMockMode) {
      const stored = localStorage.getItem('restaurant_qr_mock_tenants_db');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const list = parsed.map((t: any) => ({ id: t.id, name: t.name }));
          if (!list.some((t: any) => t.id === 'tenant_dev_123')) {
            list.unshift({ id: 'tenant_dev_123', name: 'My Restaurant (Sandbox)' });
          }
          setTenantList(list);
        } catch (e) {}
      } else {
        setTenantList([
          { id: 'tenant_dev_123', name: 'My Restaurant (Sandbox)' }
        ]);
      }
    } else {
      const getTenants = async () => {
        try {
          const colRef = collection(db, 'tenants');
          const snap = await getDocs(colRef);
          const list = snap.docs.map((doc: any) => ({ id: doc.id, name: doc.data().name }));
          setTenantList(list);
        } catch (err) {}
      };
      getTenants();
    }
  }, [isMockMode]);

  const [tables, setTables] = useState<Table[]>([]);
  const [alerts, setAlerts] = useState<WaiterAlert[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSectionTab, setActiveSectionTab] = useState<string>('All Sections');

  const resolvedTables = tables.map((t) => {
    const hasActiveOrder = orders.some(
      (o) => (o.tableId === t.id || o.tableNumber === t.number) && 
             o.status !== 'completed' && 
             o.status !== 'archived' &&
             o.payment?.status !== 'paid'
    );

    if (hasActiveOrder && t.status !== 'occupied') {
      return { ...t, status: 'occupied' as const };
    }
    if (!hasActiveOrder && t.status === 'occupied') {
      return { ...t, status: 'cleaning' as const };
    }
    return t;
  });

  const diningTablesOnly = resolvedTables.filter((t) => {
    const isRoomSpace = t.id.startsWith('room_') || Boolean((t as any).roomNumber) || Boolean((t as any).roomName);
    return !isRoomSpace;
  });

  const roomsOnly = resolvedTables.filter((t) => {
    const isRoomSpace = t.id.startsWith('room_') || Boolean((t as any).roomNumber) || Boolean((t as any).roomName);
    return isRoomSpace;
  });

  const sidebarItems = [
    { name: 'Service Board', path: '/waiter', icon: Utensils },
    { name: 'Rooms & Suites Status', path: '/waiter#rooms', icon: Hotel },
    { 
      name: 'Customer Alerts', 
      path: '/waiter#alerts', 
      icon: HelpCircle,
      badge: alerts.length > 0 ? alerts.length : undefined,
      badgeColor: 'amber'
    },
  ];

  const handleTabClick = (tabId: string) => {
    let hash = '';
    if (tabId === 'Alerts') hash = 'alerts';
    else if (tabId === 'Rooms') hash = 'rooms';
    else if (tabId === 'Tables') hash = 'tables';
    else if (tabId === 'Delivery') hash = 'delivery';
    else if (tabId === 'Served') hash = 'served';
    else if (tabId === 'CashierQueue') hash = 'cashier-queue';
    else if (tabId === 'Completed') hash = 'completed';

    const targetHash = hash ? `#${hash}` : '';
    navigate(`${location.pathname}${targetHash}`, { replace: true });
  };

  // Synchronize location hash to active tab
  useEffect(() => {
    const hash = location.hash;
    if (hash === '#alerts') {
      setActiveSectionTab('Alerts');
    } else if (hash === '#rooms') {
      setActiveSectionTab('Rooms');
    } else if (hash === '#tables') {
      setActiveSectionTab('Tables');
    } else if (hash === '#delivery') {
      setActiveSectionTab('Delivery');
    } else if (hash === '#served') {
      setActiveSectionTab('Served');
    } else if (hash === '#cashier-queue' || hash === '#cashierqueue') {
      setActiveSectionTab('CashierQueue');
    } else if (hash === '#completed') {
      setActiveSectionTab('Completed');
    } else {
      setActiveSectionTab('All Sections');
    }
  }, [location.hash, location.pathname, navigate]);

  // 1. Subscribe to Live Tables and Rooms
  useEffect(() => {
    let active = true;

    if (isMockMode) {
      const loadLocalTablesAndRooms = () => {
        const cachedTables = localStorage.getItem(MOCK_TABLES_KEY);
        const cachedRooms = localStorage.getItem('restaurant_qr_mock_rooms_db');
        
        let unifiedList: any[] = [];
        if (cachedTables) {
          try {
            unifiedList = [...unifiedList, ...JSON.parse(cachedTables)];
          } catch (e) {}
        } else {
          unifiedList = [...unifiedList, ...defaultMockTables];
        }
        
        if (cachedRooms) {
          try {
            unifiedList = [...unifiedList, ...JSON.parse(cachedRooms)];
          } catch (e) {}
        }
        
        if (active) setTables(unifiedList);
        setLoading(false);
      };

      loadLocalTablesAndRooms();
      const interval = setInterval(loadLocalTablesAndRooms, 2000);
      window.addEventListener('storage', loadLocalTablesAndRooms);
      return () => {
        active = false;
        clearInterval(interval);
        window.removeEventListener('storage', loadLocalTablesAndRooms);
      };
    } else {
      const tablesRef = collection(db, 'tenants', selectedTenantId, 'tables');
      const roomsRef = collection(db, 'tenants', selectedTenantId, 'rooms');
      
      let tablesList: any[] = [];
      let roomsList: any[] = [];
      
      const updateUnifiedList = () => {
        if (!active) return;
        const unified = [...tablesList, ...roomsList];
        console.log('[WaiterDashboard Debug] tablesList:', tablesList, 'roomsList:', roomsList, 'unified:', unified);
        setTables(unified.length === 0 ? defaultMockTables : unified);
        setLoading(false);
      };

      const unsubTables = onSnapshot(tablesRef, (snap: any) => {
        tablesList = snap.docs
          .map((d: any) => ({ id: d.id, ...d.data() }))
          .filter((t: any) => !t.id.startsWith('room_')); // Filter out duplicate rooms
        updateUnifiedList();
      }, (err: any) => {
        console.error('Tables load error:', err);
        setLoading(false);
      });

      const unsubRooms = onSnapshot(roomsRef, (snap: any) => {
        roomsList = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        updateUnifiedList();
      }, (err: any) => {
        console.warn('Rooms load warning:', err);
      });
      
      return () => {
        unsubTables();
        unsubRooms();
        active = false;
      };
    }
  }, [selectedTenantId, isMockMode]);

  // 2. Subscribe to Waiter Service Alerts
  useEffect(() => {
    let active = true;

    if (isMockMode) {
      const loadLocalAlerts = () => {
        const cached = localStorage.getItem(MOCK_ALERTS_KEY);
        if (cached) {
          try {
            if (active) setAlerts(JSON.parse(cached));
          } catch (e) {
            if (active) setAlerts(defaultMockAlerts);
          }
        } else {
          localStorage.setItem(MOCK_ALERTS_KEY, JSON.stringify(defaultMockAlerts));
          if (active) setAlerts(defaultMockAlerts);
        }
      };

      loadLocalAlerts();
      const interval = setInterval(loadLocalAlerts, 2000);
      window.addEventListener('storage', loadLocalAlerts);
      return () => {
        active = false;
        clearInterval(interval);
        window.removeEventListener('storage', loadLocalAlerts);
      };
    } else {
      const colRef = collection(db, 'tenants', selectedTenantId, 'waiter_alerts');
      const unsubscribe = onSnapshot(colRef, (snap: any) => {
        if (active) {
          const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as WaiterAlert));
          setAlerts(list);
        }
      }, (err: any) => {
        console.error('Waiter alerts load error:', err);
      });

      return () => {
        unsubscribe();
        active = false;
      };
    }
  }, [selectedTenantId, isMockMode]);

  // 3. Subscribe to all orders
  useEffect(() => {
    let active = true;

    if (isMockMode) {
      const loadOrders = () => {
        const cached = localStorage.getItem(MOCK_ORDERS_KEY);
        if (cached) {
          try {
            const list = JSON.parse(cached) as Order[];
            const tenantOrders = list.filter((o) => o.tenantId === selectedTenantId);
            if (active) setOrders(tenantOrders);
          } catch (e) {}
        }
      };
      loadOrders();
      const interval = setInterval(loadOrders, 2000);
      window.addEventListener('storage', loadOrders);
      return () => {
        active = false;
        clearInterval(interval);
        window.removeEventListener('storage', loadOrders);
      };
    } else {
      const repo = new OrderRepository(db);
      const unsubscribe = repo.subscribeAll(selectedTenantId, (list) => {
        if (active) setOrders(list);
      });

      return () => {
        unsubscribe();
        active = false;
      };
    }
  }, [selectedTenantId, isMockMode]);

  // Handle Table status changes
  const handleUpdateTableStatus = async (tableId: string, nextStatus: Table['status']) => {
    setTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, status: nextStatus } : t))
    );

    const isRoom = tableId.startsWith('room_');

    if (isMockMode) {
      const dbKey = isRoom ? 'restaurant_qr_mock_rooms_db' : MOCK_TABLES_KEY;
      const cached = localStorage.getItem(dbKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const updated = parsed.map((t: any) =>
            t.id === tableId
              ? { 
                  ...t, 
                  status: nextStatus, 
                  ...(nextStatus === 'available' ? { activeOrderId: null, activeStayId: null } : {}) 
                }
              : t
          );
          localStorage.setItem(dbKey, JSON.stringify(updated));
          window.dispatchEvent(new Event('storage'));
          if (nextStatus === 'available') {
            await EventService.logEvent(selectedTenantId, isRoom ? 'room.cleaned' : 'table.cleaned', tableId, profile?.uid || 'waiter', { previousStatus: 'cleaning' }, true);
          }
        } catch (e) {}
      }
    } else {
      try {
        const payload: any = { status: nextStatus };
        if (nextStatus === 'available') {
          payload.activeOrderId = null;
          if (isRoom) {
            payload.activeStayId = null;
          }
        }
        const collectionName = isRoom ? 'rooms' : 'tables';
        await setDoc(doc(db, 'tenants', selectedTenantId, collectionName, tableId), payload, { merge: true });
        if (nextStatus === 'available') {
          await EventService.logEvent(selectedTenantId, isRoom ? 'room.cleaned' : 'table.cleaned', tableId, profile?.uid || 'waiter', { previousStatus: 'cleaning' }, false);
        }
      } catch (err) {
        console.error('Failed to save space status:', err);
      }
    }
  };

  // Handle service alert dismiss/resolution
  const handleDismissAlert = async (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));

    if (isMockMode) {
      const cached = localStorage.getItem(MOCK_ALERTS_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const updated = parsed.filter((a: any) => a.id !== alertId);
          localStorage.setItem(MOCK_ALERTS_KEY, JSON.stringify(updated));
          window.dispatchEvent(new Event('storage'));
        } catch (e) {}
      }
    } else {
      try {
        await deleteDoc(doc(db, 'tenants', selectedTenantId, 'waiter_alerts', alertId));
      } catch (err) {
        console.error('Failed to dismiss alert:', err);
      }
    }
  };

  // Handle service alert accept
  const handleAcceptAlert = async (alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, status: 'accepted' as const } : a))
    );

    if (isMockMode) {
      const cached = localStorage.getItem(MOCK_ALERTS_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const updated = parsed.map((a: any) =>
            a.id === alertId ? { ...a, status: 'accepted' } : a
          );
          localStorage.setItem(MOCK_ALERTS_KEY, JSON.stringify(updated));
          window.dispatchEvent(new Event('storage'));
        } catch (e) {}
      }
    } else {
      try {
        await updateDoc(doc(db, 'tenants', selectedTenantId, 'waiter_alerts', alertId), { status: 'accepted' });
      } catch (err) {
        console.error('Failed to accept alert:', err);
      }
    }
  };

  // Send Billing request to Cashier Console (http://localhost:5173/cashier)
  const handleSendToCashier = async (orderId: string, tableNumber: string) => {
    // 1. Optimistic state update to instantly move the order to the "Sent to Cashier" section on screen
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return {
            ...o,
            billRequested: true,
            requestedBillAt: new Date(),
            payment: { ...o.payment, status: 'unpaid' as const }
          };
        }
        return o;
      })
    );

    if (isMockMode) {
      const cached = localStorage.getItem(MOCK_ORDERS_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const updated = parsed.map((o: any) => {
            if (o.id === orderId) {
              return {
                ...o,
                billRequested: true,
                requestedBillAt: new Date().toISOString(),
                payment: { ...o.payment, status: 'unpaid' },
                updatedAt: new Date().toISOString()
              };
            }
            return o;
          });
          localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(updated));
          window.dispatchEvent(new Event('storage'));
          toast.success(`Bill for ${tableNumber} sent to Cashier!`);
          await EventService.logEvent(selectedTenantId, 'payment.requested', orderId, profile?.uid || 'waiter', { tableNumber }, true);
        } catch (e) {
          toast.error('Failed to update local storage');
        }
      }
    } else {
      try {
        await updateDoc(doc(db, 'tenants', selectedTenantId, 'orders', orderId), {
          billRequested: true,
          requestedBillAt: new Date(),
          'payment.status': 'unpaid',
          updatedAt: new Date()
        });
        toast.success(`Bill for ${tableNumber} sent to Cashier!`);
        await EventService.logEvent(selectedTenantId, 'payment.requested', orderId, profile?.uid || 'waiter', { tableNumber }, false);
      } catch (err: any) {
        console.error('Failed to send bill to cashier:', err);
        toast.error(`Failed to send bill: ${err.message}`);
      }
    }
  };

  // Update order status (delivering / completing)
  const handleUpdateOrderStatus = async (orderId: string, nextStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const updatedItems = (o.items || []).map((i) => ({ ...i, status: nextStatus === 'served' ? ('served' as const) : i.status }));
          return { ...o, status: nextStatus, items: updatedItems };
        }
        return o;
      })
    );

    if (isMockMode) {
      const cached = localStorage.getItem(MOCK_ORDERS_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const updated = parsed.map((o: any) => {
            if (o.id === orderId) {
              const updatedItems = (o.items || []).map((i: any) => ({ ...i, status: nextStatus === 'served' ? 'served' : i.status }));
              return { ...o, status: nextStatus, items: updatedItems, updatedAt: new Date().toISOString() };
            }
            return o;
          });
          localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(updated));
          window.dispatchEvent(new Event('storage'));
          toast.success(`Order status updated to ${nextStatus.toUpperCase()}!`);
          if (nextStatus === 'served') {
            await EventService.logEvent(selectedTenantId, 'order.served', orderId, profile?.uid || 'waiter', { previousStatus: 'ready' }, true);
          }
        } catch (e) {
          toast.error('Failed to update local storage');
        }
      }
    } else {
      try {
        const repo = new OrderRepository(db);
        const order = await repo.getById(selectedTenantId, orderId);
        if (order) {
          order.status = nextStatus;
          order.items = (order.items || []).map((i) => ({
            ...i,
            status: nextStatus === 'served' ? ('served' as const) : i.status
          }));
          order.updatedAt = new Date();
          await repo.save(selectedTenantId, order);
          toast.success(`Order status updated to ${nextStatus.toUpperCase()}!`);
          if (nextStatus === 'served') {
            await EventService.logEvent(selectedTenantId, 'order.served', orderId, profile?.uid || 'waiter', { previousStatus: 'ready' }, false);
          }
        }
      } catch (err: any) {
        console.error('Failed to update order status:', err);
        toast.error(`Failed to update order status: ${err.message}`);
      }
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Waiter Service Console" sidebarItems={sidebarItems}>
        <div className="py-20 text-center text-zinc-500 font-semibold text-xs animate-pulse">
          Loading service board configurations...
        </div>
      </DashboardLayout>
    );
  }

  const formatOrderDateTime = (dateVal?: any) => {
    if (!dateVal) return 'Just now';
    let date: Date;
    if (typeof dateVal?.toDate === 'function') {
      date = dateVal.toDate();
    } else if (dateVal instanceof Date) {
      date = dateVal;
    } else {
      date = new Date(dateVal);
    }

    if (isNaN(date.getTime())) return 'Recently';

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
    return `${dateStr}, ${timeStr}`;
  };

  const getMs = (dateVal: any): number => {
    if (!dateVal) return 0;
    if (typeof dateVal.toDate === 'function') {
      return dateVal.toDate().getTime();
    }
    if (dateVal instanceof Date) {
      return dateVal.getTime();
    }
    const parsed = new Date(dateVal);
    return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  };

  // Categorize Sections (Sorted chronologically by date/time descending - newest first)
  const readyForDeliveryOrders = orders
    .filter((o) => {
      const isServed = o.status === 'served';
      const isBillSent = Boolean((o as any).billRequested || (o as any).requestedBillAt);
      const allItemsReady = Array.isArray(o.items) && o.items.length > 0 && o.items.every((i) => i.status === 'ready' || i.status === 'served');
      return !isServed && !isBillSent && o.status !== 'completed' && o.status !== 'archived' && (o.status === 'ready' || allItemsReady);
    })
    .sort((a, b) => getMs(b.createdAt) - getMs(a.createdAt));

  const currentlyServedOrders = orders
    .filter((o) => {
      const isBillSent = Boolean((o as any).billRequested || (o as any).requestedBillAt);
      const isPaid = o.payment?.status === 'paid' || o.status === 'completed';
      return o.status === 'served' && !isBillSent && !isPaid;
    })
    .sort((a, b) => getMs(b.updatedAt || b.createdAt) - getMs(a.updatedAt || a.createdAt));

  const sentToCashierOrders = orders
    .filter((o) => {
      const isBillSent = Boolean((o as any).billRequested || (o as any).requestedBillAt);
      const isPaid = o.payment?.status === 'paid' || o.status === 'completed' || o.status === 'archived';
      return isBillSent && !isPaid;
    })
    .sort((a, b) => getMs((b as any).requestedBillAt || b.updatedAt) - getMs((a as any).requestedBillAt || a.updatedAt));

  const completedOrders = orders
    .filter((o) => o.status === 'completed' || o.payment?.status === 'paid')
    .sort((a, b) => getMs(b.updatedAt || b.createdAt) - getMs(a.updatedAt || a.createdAt));



  const renderCustomerAlerts = (isSidebarLayout = false) => {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
              <HelpCircle className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Customer Alerts</h3>
              <p className="text-xs text-zinc-500 font-normal">Live customer alerts & cashier requests.</p>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-xl">
            {alerts.length} Pending
          </span>
        </div>

        <div className={`grid gap-6 ${isSidebarLayout ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          {alerts.map((a) => (
            <div key={a.id} className="border border-amber-500/30 bg-amber-955/10 p-5 rounded-3xl space-y-4 shadow-xl">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="text-amber-400 bg-amber-500/20 p-2.5 rounded-2xl">
                    {a.type === 'call_waiter' ? <HelpCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-white">{a.tableNumber}</h4>
                    <span className="text-[10px] text-zinc-500 font-mono">{a.time}</span>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded-lg border border-amber-500/30">
                  {a.type === 'call_waiter' ? 'Call' : 'Bill'}
                </span>
              </div>

              <p className="text-xs text-zinc-350 leading-relaxed bg-zinc-950/60 p-3 rounded-2xl border border-zinc-900">
                {(() => {
                  const isRoom = a.isRoom || a.tableNumber.toLowerCase().includes('room');
                  if (a.type === 'call_waiter') {
                    return isRoom ? 'Guest requested room assistance.' : 'Guest requested table assistance.';
                  } else {
                    return isRoom ? 'Guest requested room bill printed.' : 'Guest requested bill printed.';
                  }
                })()}
              </p>

              {/* Additional location metadata context (Room stay details or Table order details) */}
              {(() => {
                const isRoom = a.isRoom || a.tableNumber.toLowerCase().includes('room');
                if (isRoom) {
                  return (
                    <div className="text-[10px] text-zinc-400 bg-zinc-950/40 p-2.5 rounded-2xl border border-zinc-900/60 space-y-1">
                      <div className="flex justify-between">
                        <span>Guest Name:</span>
                        <span className="font-extrabold text-zinc-200">{a.guestName || 'In-Room Guest'}</span>
                      </div>
                      {a.stayId && (
                        <div className="flex justify-between">
                          <span>Stay Session:</span>
                          <span className="font-mono text-[9px] text-amber-400/80">{a.stayId}</span>
                        </div>
                      )}
                    </div>
                  );
                } else {
                  const activeOrder = orders.find(
                    (o) => (o.tableNumber === a.tableNumber || `Table ${o.tableId}` === a.tableNumber) &&
                           o.status !== 'completed' &&
                           o.status !== 'archived' &&
                           o.payment?.status !== 'paid'
                  );
                  return activeOrder ? (
                    <div className="text-[10px] text-zinc-400 bg-zinc-950/40 p-2.5 rounded-2xl border border-zinc-900/60 space-y-1">
                      <div className="flex justify-between">
                        <span>Active Order:</span>
                        <span className="font-mono text-[9px] text-emerald-400">{activeOrder.id.slice(0, 8)}...</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Order Total:</span>
                        <span className="font-extrabold text-zinc-200">₹{(activeOrder.totals?.grandTotal || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-zinc-500 italic px-1">
                      No active order details
                    </div>
                  );
                }
              })()}

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-500/20">
                {a.status === 'accepted' ? (
                  a.type === 'call_waiter' ? (
                    <button
                      onClick={() => handleDismissAlert(a.id)}
                      className="py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-md"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Complete
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const activeOrder = orders.find(
                          (o) => (o.tableNumber === a.tableNumber || `Table ${o.tableId}` === a.tableNumber) &&
                                 o.status !== 'completed' &&
                                 o.status !== 'archived' &&
                                 o.payment?.status !== 'paid'
                        );
                        if (activeOrder) {
                          handleSendToCashier(activeOrder.id, a.tableNumber);
                          handleDismissAlert(a.id);
                        } else {
                          toast.error(`No active order found for ${a.tableNumber}!`);
                        }
                      }}
                      className="py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-md"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      To Cashier
                    </button>
                  )
                ) : (
                  <button
                    onClick={() => handleAcceptAlert(a.id)}
                    className="py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Accept
                  </button>
                )}
                <button
                  onClick={() => handleDismissAlert(a.id)}
                  className="py-2.5 border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-bold text-xs uppercase rounded-xl transition cursor-pointer text-center"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}

          {alerts.length === 0 && (
            <div className="col-span-full border border-dashed border-zinc-850 py-12 text-center text-zinc-500 rounded-3xl">
              <CheckCircle className="h-8 w-8 mx-auto text-amber-500/20 mb-3" />
              <p className="text-xs font-semibold text-zinc-400">All customer alerts clear</p>
            </div>
          )}
        </div>
      </div>
    );
  };



  return (
    <DashboardLayout 
      title="Waiter Service Console" 
      sidebarItems={sidebarItems}
    >
      <div className="space-y-8 animate-fadeIn">
        {/* Section Navigation Tabs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-900 pb-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'All Sections', label: 'All Sections' },
              { id: 'Tables', label: `Dining Tables (${diningTablesOnly.length})` },
              { id: 'Rooms', label: `Rooms (${roomsOnly.length})` },
              { id: 'Delivery', label: `Ready for Delivery (${readyForDeliveryOrders.length})` },
              { id: 'Served', label: `Served to Tables (${currentlyServedOrders.length})` },
              { id: 'CashierQueue', label: `Sent to Cashier (${sentToCashierOrders.length})` },
              { id: 'Alerts', label: `Customer Alerts (${alerts.length})` },
              { id: 'Completed', label: `Completed (${completedOrders.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                  activeSectionTab === tab.id
                    ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                    : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-850 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {(isMockMode || profile?.role === 'super-admin') && tenantList.length > 0 && (
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-850 px-3.5 py-2 rounded-xl">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Tenant:</span>
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="bg-transparent text-xs text-white focus:outline-none cursor-pointer font-extrabold"
                >
                  {tenantList.map((t) => (
                    <option key={t.id} value={t.id} className="bg-zinc-950 text-zinc-300">
                      {t.name} ({t.id.slice(7)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <a
              href="/cashier"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-xl hover:bg-emerald-500/20 transition cursor-pointer"
            >
              <CreditCard className="h-4 w-4" />
              Open Cashier POS
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Left Column: Customer Alerts */}
          {((activeSectionTab === 'All Sections' && alerts.length > 0) || activeSectionTab === 'Alerts') && (
            <div className={`space-y-4 xl:col-span-4 ${activeSectionTab === 'Alerts' ? 'xl:col-span-12' : ''}`}>
              {renderCustomerAlerts(activeSectionTab === 'All Sections')}
            </div>
          )}

          {/* Right Column: Other Board Sections */}
          {(activeSectionTab !== 'Alerts') && (
            <div className={`space-y-8 ${activeSectionTab === 'All Sections' && alerts.length > 0 ? 'xl:col-span-8' : 'xl:col-span-12'}`}>
              {/* SECTION 1: Dining Tables Status */}
        {(activeSectionTab === 'All Sections' || activeSectionTab === 'Tables') && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                  <Utensils className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Dining Tables Status</h3>
                  <p className="text-xs text-zinc-500">Real-time seating occupancy and table readiness</p>
                </div>
              </div>
              <span className="text-xs text-zinc-400 font-bold bg-zinc-900 px-3 py-1 rounded-xl">
                {diningTablesOnly.length} Tables Registered
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {diningTablesOnly.map((t) => {
                let statusClass = 'border-zinc-900 bg-zinc-900/10 text-zinc-400';
                if (t.status === 'occupied') statusClass = 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400';
                else if (t.status === 'reserved') statusClass = 'border-violet-500/20 bg-violet-500/5 text-violet-400';
                else if (t.status === 'cleaning') statusClass = 'border-orange-500/20 bg-orange-500/5 text-orange-400';

                const spaceName = t.number || `Table ${t.id.replace(/^t_|^table_|^t/, '')}`;
                const spaceCapacity = (t as any).capacity ?? t.seatingCapacity ?? 4;

                return (
                  <div key={t.id} className={`border p-4.5 rounded-2xl flex flex-col justify-between h-44 shadow-lg transition duration-200 hover:border-zinc-800 ${statusClass}`}>
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="font-extrabold text-base text-white">
                          {spaceName}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider bg-zinc-900 text-zinc-500 px-2 py-0.5 rounded-md font-bold">
                          Cap: {spaceCapacity}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          t.status === 'available' ? 'bg-zinc-500' :
                          t.status === 'occupied' ? 'bg-emerald-500 animate-pulse' :
                          t.status === 'reserved' ? 'bg-violet-500' : 'bg-orange-500'
                        }`} />
                        <span className="text-xs uppercase font-extrabold tracking-wider capitalize text-zinc-300">
                          {t.status}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 mt-4">
                      <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-wider">
                        Change Table Status
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['available', 'occupied', 'cleaning'] as const).map((status) => {
                          const isActive = t.status === status;
                          let btnStyle = 'bg-zinc-950 text-zinc-550 border border-zinc-900 hover:bg-zinc-900';
                          if (isActive) {
                            if (status === 'available') btnStyle = 'bg-zinc-850 text-white border-zinc-750 font-extrabold';
                            if (status === 'occupied') btnStyle = 'bg-emerald-500 text-white border-emerald-600 font-extrabold';
                            if (status === 'cleaning') btnStyle = 'bg-orange-500 text-white border-orange-600 font-extrabold';
                          }
                          return (
                            <button
                              key={status}
                              onClick={() => handleUpdateTableStatus(t.id, status)}
                              className={`py-1.5 text-[9px] font-bold uppercase rounded-lg transition cursor-pointer text-center ${btnStyle}`}
                            >
                              {status === 'available' ? 'Free' : status === 'occupied' ? 'Seat' : 'Clean'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 1B: Rooms & Suites Status */}
        {((activeSectionTab === 'All Sections' && roomsOnly.length > 0) || activeSectionTab === 'Rooms') && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-xl">
                  <Hotel className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Rooms & Suites Status</h3>
                  <p className="text-xs text-zinc-500 font-normal">Real-time room occupancy and guest service status</p>
                </div>
              </div>
              <span className="text-xs text-zinc-400 font-bold bg-zinc-900 px-3 py-1 rounded-xl">
                {roomsOnly.length} Rooms Registered
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {roomsOnly.map((t) => {
                let statusClass = 'border-zinc-900 bg-zinc-900/10 text-zinc-400';
                if (t.status === 'occupied') statusClass = 'border-violet-500/20 bg-violet-500/5 text-violet-400';
                else if (t.status === 'reserved') statusClass = 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400';
                else if (t.status === 'cleaning') statusClass = 'border-orange-500/20 bg-orange-500/5 text-orange-400';

                const spaceName = (t as any).roomName || ((t as any).roomNumber ? `Room ${(t as any).roomNumber}` : `Room ${t.id.replace('room_', '').slice(0, 4).toUpperCase()}`);
                const spaceCapacity = (t as any).capacity ?? t.seatingCapacity ?? 4;

                return (
                  <div key={t.id} className={`border p-4.5 rounded-2xl flex flex-col justify-between h-44 shadow-lg transition duration-200 hover:border-zinc-800 ${statusClass}`}>
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="font-extrabold text-base text-white">
                          {spaceName}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider bg-zinc-900 text-zinc-500 px-2 py-0.5 rounded-md font-bold">
                          Cap: {spaceCapacity}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          t.status === 'available' ? 'bg-zinc-500' :
                          t.status === 'occupied' ? 'bg-violet-500 animate-pulse' :
                          t.status === 'reserved' ? 'bg-emerald-500' : 'bg-orange-500'
                        }`} />
                        <span className="text-xs uppercase font-extrabold tracking-wider capitalize text-zinc-300">
                          {t.status}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 mt-4">
                      <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-wider">
                        Change Room Status
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['available', 'occupied', 'cleaning'] as const).map((status) => {
                          const isActive = t.status === status;
                          let btnStyle = 'bg-zinc-950 text-zinc-550 border border-zinc-900 hover:bg-zinc-900';
                          if (isActive) {
                            if (status === 'available') btnStyle = 'bg-zinc-850 text-white border-zinc-750 font-extrabold';
                            if (status === 'occupied') btnStyle = 'bg-violet-500 text-white border-violet-600 font-extrabold';
                            if (status === 'cleaning') btnStyle = 'bg-orange-500 text-white border-orange-600 font-extrabold';
                          }
                          return (
                            <button
                              key={status}
                              onClick={() => handleUpdateTableStatus(t.id, status)}
                              className={`py-1.5 text-[9px] font-bold uppercase rounded-lg transition cursor-pointer text-center ${btnStyle}`}
                            >
                              {status === 'available' ? 'Free' : status === 'occupied' ? 'Occ' : 'Clean'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
              {roomsOnly.length === 0 && (
                <div className="col-span-full border border-dashed border-zinc-850 py-12 text-center text-zinc-500 rounded-3xl">
                  <p className="text-xs font-semibold text-zinc-400">No rooms registered</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 2: Ready for Delivery (DELIVER TO TABLE) */}
        {(activeSectionTab === 'All Sections' || activeSectionTab === 'Delivery') && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                  <Send className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Ready for Delivery (DELIVER TO TABLE)</h3>
                  <p className="text-xs text-zinc-500">Orders cooked and marked ready by kitchen staff</p>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl">
                {readyForDeliveryOrders.length} Ready Tickets
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {readyForDeliveryOrders.map((o) => (
                <div key={o.id} className="border border-emerald-500/40 bg-emerald-950/10 p-5 rounded-3xl space-y-4 shadow-xl shadow-emerald-500/5">
                  <div className="flex justify-between items-start border-b border-emerald-500/20 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-xl">
                          {o.tableNumber}
                        </span>
                        <span className="text-sm font-extrabold text-white">
                          #{o.id.slice(-6).toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1 font-mono flex items-center gap-1">
                        <Clock className="h-3 w-3 text-zinc-500" />
                        {formatOrderDateTime(o.createdAt)}
                      </p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-lg border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      READY TO SERVE
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {(o.items || []).map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-zinc-300">
                        <span className="font-semibold">{item.quantity}x {item.name}</span>
                        <span className="text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                          READY
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-emerald-500/20">
                    <button
                      onClick={() => handleUpdateOrderStatus(o.id, 'served')}
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-black font-black text-xs uppercase tracking-wider rounded-2xl transition cursor-pointer text-center shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 animate-pulse"
                    >
                      <Send className="h-4 w-4" />
                      DELIVER TO TABLE
                    </button>
                  </div>
                </div>
              ))}

              {readyForDeliveryOrders.length === 0 && (
                <div className="col-span-full border border-dashed border-zinc-850 py-12 text-center text-zinc-500 rounded-3xl">
                  <CheckCircle className="h-8 w-8 mx-auto text-emerald-500/20 mb-3" />
                  <p className="text-xs font-semibold text-zinc-400">No pending food deliveries</p>
                  <p className="text-[10px] text-zinc-600 mt-1">Dishes cooked in the kitchen will show up here</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 3: Currently Served to Tables (SERVED) */}
        {(activeSectionTab === 'All Sections' || activeSectionTab === 'Served') && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl">
                  <Check className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Currently Served to Tables (SERVED)</h3>
                  <p className="text-xs text-zinc-500">Food delivered to tables, active dining & billing console</p>
                </div>
              </div>
              <span className="text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-xl">
                {currentlyServedOrders.length} Served Tickets
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentlyServedOrders.map((o) => (
                <div key={o.id} className="border border-blue-500/30 bg-blue-950/10 p-5 rounded-3xl space-y-4 shadow-xl">
                  <div className="flex justify-between items-start border-b border-blue-500/20 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-xl">
                          {o.tableNumber}
                        </span>
                        <span className="text-sm font-bold text-white">#{o.id.slice(-6).toUpperCase()}</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1 font-mono flex items-center gap-1">
                        <Clock className="h-3 w-3 text-zinc-500" />
                        Served: {formatOrderDateTime(o.updatedAt || o.createdAt)}
                      </p>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-lg">
                      SERVED
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {(o.items || []).map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-zinc-300">
                        <span className="font-semibold">{item.quantity}x {item.name}</span>
                        <span className="text-[10px] font-bold text-blue-400 flex items-center gap-1">
                          <Check className="h-3 w-3" /> SERVED
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-blue-500/20 space-y-2">
                    <button
                      onClick={() => handleSendToCashier(o.id, o.tableNumber)}
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer text-center shadow-md flex items-center justify-center gap-2"
                    >
                      <CreditCard className="h-4 w-4" />
                      SEND BILL TO CASHIER
                    </button>
                    <button
                      onClick={() => handleUpdateOrderStatus(o.id, 'completed')}
                      className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-850 text-blue-400 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer text-center border border-zinc-800 flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      COMPLETE ORDER
                    </button>
                  </div>
                </div>
              ))}

              {currentlyServedOrders.length === 0 && (
                <div className="col-span-full border border-dashed border-zinc-850 py-12 text-center text-zinc-500 rounded-3xl">
                  <Check className="h-8 w-8 mx-auto text-blue-500/20 mb-3" />
                  <p className="text-xs font-semibold text-zinc-400">No active served tables</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION: Sent to Cashier for Billing */}
        {(activeSectionTab === 'All Sections' || activeSectionTab === 'CashierQueue') && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                  <CreditCard className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Sent to Cashier for Billing (SENT TO CASHIER)</h3>
                  <p className="text-xs text-zinc-500">Invoices dispatched to Cashier POS awaiting customer settlement</p>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl">
                {sentToCashierOrders.length} Sent Tickets
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sentToCashierOrders.map((o) => (
                <div key={`sent_${o.id}`} className="border border-emerald-500/40 bg-emerald-950/20 p-5 rounded-3xl space-y-4 shadow-xl">
                  <div className="flex justify-between items-start border-b border-emerald-500/20 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-xl">
                          {o.tableNumber}
                        </span>
                        <span className="text-sm font-bold text-white">#{o.id.slice(-6).toUpperCase()}</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1 font-mono flex items-center gap-1">
                        <Clock className="h-3 w-3 text-zinc-500" />
                        Dispatched: {formatOrderDateTime((o as any).requestedBillAt || o.updatedAt)}
                      </p>
                    </div>
                    <span className="text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg animate-pulse">
                      SENT TO CASHIER
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {(o.items || []).map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-zinc-300">
                        <span className="font-semibold">{item.quantity}x {item.name}</span>
                        <span className="text-[10px] font-bold text-emerald-400">
                          ₹{(item.totalPrice || item.unitPrice * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-emerald-500/20 flex justify-between items-center">
                    <span className="text-emerald-400 font-extrabold text-sm">Total: ₹{(o.totals?.grandTotal || 0).toFixed(2)}</span>
                    <span className="text-[10px] font-bold text-zinc-400 italic">Awaiting Cashier Settlement...</span>
                  </div>
                </div>
              ))}

              {sentToCashierOrders.length === 0 && (
                <div className="col-span-full border border-dashed border-zinc-850 py-12 text-center text-zinc-500 rounded-3xl">
                  <CreditCard className="h-8 w-8 mx-auto text-emerald-500/20 mb-3" />
                  <p className="text-xs font-semibold text-zinc-400">No bills currently in cashier settlement queue</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 4: Customer Alerts & Send to Cashier */}
        {activeSectionTab === 'Alerts' && renderCustomerAlerts(false)}

        {/* SECTION 5: Completed Orders (COMPLETED ORDER) */}
        {(activeSectionTab === 'All Sections' || activeSectionTab === 'Completed') && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-xl">
                  <CheckCircle className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Completed Orders (COMPLETED ORDER)</h3>
                  <p className="text-xs text-zinc-500">Fulfilled dining sessions & settled table receipts</p>
                </div>
              </div>
              <span className="text-xs font-bold text-zinc-400 bg-zinc-900 px-3 py-1 rounded-xl">
                {completedOrders.length} Completed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {completedOrders.map((o) => (
                <div key={`completed_${o.id}`} className="border border-zinc-850 bg-zinc-900/40 p-5 rounded-3xl space-y-4 opacity-75 hover:opacity-100 transition">
                  <div className="flex justify-between items-start border-b border-zinc-850 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-xl">
                          {o.tableNumber}
                        </span>
                        <span className="text-sm font-bold text-white">#{o.id.slice(-6).toUpperCase()}</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1 font-mono flex items-center gap-1">
                        <Clock className="h-3 w-3 text-zinc-500" />
                        Completed: {formatOrderDateTime(o.updatedAt || o.createdAt)}
                      </p>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                      COMPLETED
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {(o.items || []).map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-zinc-400">
                        <span>{item.quantity}x {item.name}</span>
                        <span className="text-[10px] font-bold text-emerald-400">₹{(item.totalPrice || item.unitPrice * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-zinc-850 flex justify-between items-center text-xs">
                    <span className="text-zinc-400 font-bold">Total: ₹{(o.totals?.grandTotal || 0).toFixed(2)}</span>
                    <button
                      onClick={() => handleUpdateOrderStatus(o.id, 'served')}
                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl transition cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Re-Open
                    </button>
                  </div>
                </div>
              ))}

              {completedOrders.length === 0 && (
                <div className="col-span-full border border-dashed border-zinc-850 py-12 text-center text-zinc-500 rounded-3xl">
                  <p className="text-xs font-semibold text-zinc-400">No completed orders in current session</p>
                </div>
              )}
            </div>
          </div>
        )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};
