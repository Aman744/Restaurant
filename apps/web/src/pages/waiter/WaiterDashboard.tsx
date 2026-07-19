import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/shared/DashboardLayout';
import { Utensils, HelpCircle, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import type { Table, Order, OrderItem, OrderStatus } from '@restaurant-qr/core';
import { useUserProfile } from '../../features/auth/context/UserContext.js';
import { useAuth } from '../../features/auth/context/AuthContext.js';
import { db } from '../../lib/firebase.js';
import { doc, setDoc, onSnapshot, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';

interface WaiterAlert {
  id: string;
  tableNumber: string;
  type: 'call_waiter' | 'bill_request' | 'service_request';
  time: string;
  status: 'pending' | 'resolved';
}

const MOCK_TABLES_KEY = 'restaurant_qr_mock_tables_db';
const MOCK_ALERTS_KEY = 'restaurant_qr_mock_waiter_alerts_db';
const MOCK_ORDERS_KEY = 'restaurant_qr_mock_orders_db';

const defaultMockTables: Table[] = [
  { id: 't1', tenantId: 'sandbox', number: 'Table 1', seatingCapacity: 2, status: 'available', qrToken: '', createdAt: new Date() },
  { id: 't2', tenantId: 'sandbox', number: 'Table 2', seatingCapacity: 4, status: 'occupied', qrToken: '', activeOrderId: 'ord_1', createdAt: new Date() },
  { id: 't3', tenantId: 'sandbox', number: 'Table 3', seatingCapacity: 6, status: 'reserved', qrToken: '', createdAt: new Date() },
  { id: 't4', tenantId: 'sandbox', number: 'Table 4', seatingCapacity: 4, status: 'cleaning', qrToken: '', createdAt: new Date() },
  { id: 't5', tenantId: 'sandbox', number: 'Table 5', seatingCapacity: 2, status: 'available', qrToken: '', createdAt: new Date() },
  { id: 't6', tenantId: 'sandbox', number: 'Table 6', seatingCapacity: 8, status: 'occupied', qrToken: '', createdAt: new Date() },
];

const defaultMockAlerts: WaiterAlert[] = [
  { id: 'a1', tableNumber: 'Table 2', type: 'call_waiter', time: '2 mins ago', status: 'pending' },
  { id: 'a2', tableNumber: 'Table 4', type: 'bill_request', time: 'Just now', status: 'pending' },
];

export const WaiterDashboard: React.FC = () => {
  const { profile } = useUserProfile();
  const { isMockMode } = useAuth();
  const tenantId = profile?.tenantId || 'sandbox';

  const sidebarItems = [
    { name: 'Service Board', path: '/waiter', icon: Utensils },
  ];

  const [tables, setTables] = useState<Table[]>([]);
  const [alerts, setAlerts] = useState<WaiterAlert[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Subscribe to Live Tables
  useEffect(() => {
    let active = true;

    if (isMockMode) {
      const loadLocalTables = () => {
        const cached = localStorage.getItem(MOCK_TABLES_KEY);
        if (cached) {
          try {
            if (active) setTables(JSON.parse(cached));
          } catch (e) {
            if (active) setTables(defaultMockTables);
          }
        } else {
          localStorage.setItem(MOCK_TABLES_KEY, JSON.stringify(defaultMockTables));
          if (active) setTables(defaultMockTables);
        }
        setLoading(false);
      };

      loadLocalTables();
      window.addEventListener('storage', loadLocalTables);
      return () => {
        active = false;
        window.removeEventListener('storage', loadLocalTables);
      };
    } else {
      const colRef = collection(db, 'tenants', tenantId, 'tables');
      const unsubscribe = onSnapshot(colRef, (snap: any) => {
        if (active) {
          const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Table));
          // Fallback if no tables set up in db
          if (list.length === 0) {
            setTables(defaultMockTables);
          } else {
            setTables(list);
          }
          setLoading(false);
        }
      }, (err: any) => {
        console.error('Waiter tables load error:', err);
        setLoading(false);
      });

      return () => {
        unsubscribe();
        active = false;
      };
    }
  }, [tenantId, isMockMode]);

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
      window.addEventListener('storage', loadLocalAlerts);
      return () => {
        active = false;
        window.removeEventListener('storage', loadLocalAlerts);
      };
    } else {
      const colRef = collection(db, 'tenants', tenantId, 'waiter_alerts');
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
  }, [tenantId, isMockMode]);

  // 3. Subscribe to active orders to track preparation progress
  useEffect(() => {
    let active = true;

    if (isMockMode) {
      const loadOrders = () => {
        const cached = localStorage.getItem(MOCK_ORDERS_KEY);
        if (cached) {
          try {
            const list = JSON.parse(cached) as Order[];
            // Filter to show active orders only (not completed/archived)
            const activeOnly = list.filter(o => o.status !== 'completed' && o.status !== 'archived');
            if (active) setActiveOrders(activeOnly);
          } catch (e) {}
        }
      };
      loadOrders();
      window.addEventListener('storage', loadOrders);
      return () => {
        active = false;
        window.removeEventListener('storage', loadOrders);
      };
    } else {
      const colRef = collection(db, 'tenants', tenantId, 'orders');
      const q = query(colRef, where('status', 'not-in', ['completed', 'archived']));
      
      const unsubscribe = onSnapshot(q, async (snap: any) => {
        if (active) {
          const list: Order[] = [];
          for (const d of snap.docs) {
            const header = d.data();
            const itemsCol = collection(db, 'tenants', tenantId, 'orders', d.id, 'order_items');
            const itemsSnap = await getDocs(itemsCol);
            const items = itemsSnap.docs.map((it: any) => ({ id: it.id, ...it.data() } as OrderItem));
            list.push({ id: d.id, ...header, items } as Order);
          }
          if (active) setActiveOrders(list);
        }
      });

      return () => {
        unsubscribe();
        active = false;
      };
    }
  }, [tenantId, isMockMode]);

  // Handle Table status changes
  const handleUpdateTableStatus = async (tableId: string, nextStatus: Table['status']) => {
    setTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, status: nextStatus } : t))
    );

    if (isMockMode) {
      const cached = localStorage.getItem(MOCK_TABLES_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const updated = parsed.map((t: any) =>
            t.id === tableId ? { ...t, status: nextStatus } : t
          );
          localStorage.setItem(MOCK_TABLES_KEY, JSON.stringify(updated));
          window.dispatchEvent(new Event('storage'));
        } catch (e) {}
      }
    } else {
      try {
        await setDoc(doc(db, 'tenants', tenantId, 'tables', tableId), { status: nextStatus }, { merge: true });
      } catch (err) {
        console.error('Failed to save table status:', err);
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
        await deleteDoc(doc(db, 'tenants', tenantId, 'waiter_alerts', alertId));
      } catch (err) {
        console.error('Failed to dismiss alert:', err);
      }
    }
  };

  // Update order status (waiter delivering items to table)
  const handleUpdateOrderStatus = async (orderId: string, nextStatus: OrderStatus) => {
    setActiveOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
    );

    if (isMockMode) {
      const cached = localStorage.getItem(MOCK_ORDERS_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const updated = parsed.map((o: any) =>
            o.id === orderId ? { ...o, status: nextStatus, updatedAt: new Date().toISOString() } : o
          );
          localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(updated));
          window.dispatchEvent(new Event('storage'));
        } catch (e) {}
      }
    } else {
      try {
        await setDoc(doc(db, 'tenants', tenantId, 'orders', orderId), { status: nextStatus, updatedAt: new Date() }, { merge: true });
      } catch (err) {
        console.error('Failed to update order status:', err);
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

  // Dynamically resolve tables occupied status based on active orders
  const resolvedTables = tables.map((t) => {
    const hasActiveOrder = activeOrders.some(
      (o) => (o.tableId === t.id || o.tableNumber === t.number) && 
             o.status !== 'completed' && 
             o.status !== 'archived'
    );

    if (hasActiveOrder && t.status !== 'occupied') {
      return { ...t, status: 'occupied' as const };
    }
    return t;
  });

  return (
    <DashboardLayout title="Waiter Service Console" sidebarItems={sidebarItems}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* Active Tables Map */}
          <div className="lg:col-span-2 xl:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Dining Tables Status</h3>
              <span className="text-[10px] text-zinc-500 font-medium">
                Total: {resolvedTables.length} tables
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {resolvedTables.map((t) => {
                let statusClass = 'border-zinc-900 bg-zinc-900/10 text-zinc-400';
                if (t.status === 'occupied') statusClass = 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400';
                else if (t.status === 'reserved') statusClass = 'border-violet-500/20 bg-violet-500/5 text-violet-400';
                else if (t.status === 'cleaning') statusClass = 'border-orange-500/20 bg-orange-500/5 text-orange-400';

                return (
                  <div key={t.id} className={`border p-4.5 rounded-2xl flex flex-col justify-between h-44 shadow-lg transition duration-200 hover:border-zinc-800 ${statusClass}`}>
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="font-extrabold text-base text-white">{t.number}</span>
                        <span className="text-[9px] uppercase tracking-wider bg-zinc-900 text-zinc-500 px-2 py-0.5 rounded-md font-bold">
                          Cap: {t.seatingCapacity}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          t.status === 'available' ? 'bg-zinc-500' :
                          t.status === 'occupied' ? 'bg-emerald-500' :
                          t.status === 'reserved' ? 'bg-violet-500' : 'bg-orange-500'
                        }`} />
                        <span className="text-xs uppercase font-extrabold tracking-wider capitalize text-zinc-300">
                          {t.status}
                        </span>
                      </div>
                    </div>

                    {/* Table Status Modifiers */}
                    <div className="space-y-1.5 mt-4">
                      <p className="text-[8px] font-bold text-zinc-650 uppercase tracking-wider">Change Table Status</p>
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

          {/* Active Orders Tracker (Pending Deliveries) */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Deliveries & Orders</h3>
            <div className="space-y-4">
              {activeOrders.map((o) => {
                let badgeColor = 'bg-zinc-900 text-zinc-400 border-zinc-800';
                if (o.status === 'pending') badgeColor = 'bg-red-500/10 text-red-400 border-red-500/20';
                if (o.status === 'preparing') badgeColor = 'bg-orange-500/10 text-orange-400 border-orange-500/20';
                if (o.status === 'ready') badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
                if (o.status === 'served') badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';

                return (
                  <div key={o.id} className="border border-zinc-900 bg-zinc-905/30 p-4.5 rounded-2xl space-y-3.5 shadow-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold text-white bg-zinc-850 px-2 py-0.5 rounded">
                            {o.tableNumber}
                          </span>
                          <span className="text-xs font-bold text-zinc-300">
                            #{o.id.slice(-6).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-550 mt-1 font-medium">Customer: {o.customerName || 'Guest'}</p>
                      </div>
                      <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md border ${badgeColor}`}>
                        {o.status}
                      </span>
                    </div>

                    {/* Order items status tracker */}
                    <div className="space-y-1">
                      {o.items?.map((item) => (
                        <div key={item.id} className="flex justify-between items-center text-2xs text-zinc-450 border-b border-zinc-900/40 pb-1.5 last:border-0 last:pb-0">
                          <span>{item.quantity}x {item.name}</span>
                          <span className={`text-[9px] font-bold ${
                            item.status === 'ready' ? 'text-emerald-450' : 'text-zinc-650'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Actions: Deliver/Serve */}
                    <div className="flex gap-2 pt-1 border-t border-zinc-900/60">
                      {o.status === 'ready' ? (
                        <button
                          onClick={() => handleUpdateOrderStatus(o.id, 'served')}
                          className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] uppercase rounded-xl transition cursor-pointer text-center"
                        >
                          Deliver to Table
                        </button>
                      ) : o.status === 'preparing' ? (
                        <div className="w-full py-2 bg-zinc-950/60 text-zinc-600 font-extrabold text-[9px] uppercase tracking-wider rounded-xl text-center border border-zinc-900 flex items-center justify-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          Kitchen Cooking
                        </div>
                      ) : (o.status === 'pending' || o.status === 'accepted') ? (
                        <div className="w-full py-2 bg-zinc-955/40 text-zinc-550 font-extrabold text-[9px] uppercase tracking-wider rounded-xl text-center border border-zinc-900 flex items-center justify-center gap-1.5 animate-pulse">
                          <Clock className="h-3 w-3" />
                          Waiting Kitchen Accept
                        </div>
                      ) : o.status === 'served' ? (
                        <button
                          onClick={() => handleUpdateOrderStatus(o.id, 'completed')}
                          className="w-full py-2 bg-zinc-800 hover:bg-zinc-755 text-zinc-300 font-bold text-[10px] uppercase rounded-xl transition cursor-pointer text-center border border-zinc-700"
                        >
                          Close / Completed
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {activeOrders.length === 0 && (
                <div className="border border-dashed border-zinc-850 py-16 text-center text-zinc-550 rounded-2xl">
                  <CheckCircle className="h-8 w-8 mx-auto text-emerald-500/25 mb-3 animate-pulse" />
                  <p className="text-xs font-semibold">No active orders</p>
                  <p className="text-[10px] text-zinc-600 mt-1">Waiting for customers to order</p>
                </div>
              )}
            </div>
          </div>

          {/* Customer Requests Sidebar */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Customer Alerts</h3>
            <div className="space-y-3">
              {alerts.map((a) => (
                <div key={a.id} className="border border-zinc-900 bg-zinc-905/30 p-4 rounded-xl flex items-start gap-3 shadow-lg">
                  <div className="mt-0.5 text-orange-400 bg-orange-950/15 border border-orange-500/10 p-2 rounded-lg">
                    {a.type === 'call_waiter' ? <HelpCircle className="h-4.5 w-4.5" /> : <AlertCircle className="h-4.5 w-4.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <h4 className="text-sm font-bold text-white">{a.tableNumber}</h4>
                      <span className="text-[10px] text-zinc-550">{a.time}</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      {a.type === 'call_waiter' ? 'Requested service / call' : 'Billing request: Split cash'}
                    </p>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => handleDismissAlert(a.id)}
                        className="flex-1 py-2 border border-zinc-800 bg-zinc-950/60 text-[10px] font-bold text-zinc-300 rounded-lg hover:bg-zinc-850 transition"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {alerts.length === 0 && (
                <div className="border border-zinc-900 bg-zinc-950 py-16 text-center text-zinc-550 rounded-2xl">
                  <CheckCircle className="h-8 w-8 mx-auto text-emerald-500/15 mb-3" />
                  <p className="text-xs font-semibold">All alerts clear</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
