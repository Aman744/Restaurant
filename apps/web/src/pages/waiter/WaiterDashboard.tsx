import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/shared/DashboardLayout';
import { Utensils, HelpCircle, AlertCircle, CheckCircle, Clock, Send } from 'lucide-react';
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
  { id: 't1', tenantId: 'sandbox', number: 'Table 1', seatingCapacity: 4, status: 'available', qrToken: 'qr_t1', createdAt: new Date() },
  { id: 't2', tenantId: 'sandbox', number: 'Table 2', seatingCapacity: 2, status: 'occupied', qrToken: 'qr_t2', createdAt: new Date() },
  { id: 't3', tenantId: 'sandbox', number: 'Table 3', seatingCapacity: 6, status: 'occupied', qrToken: 'qr_t3', createdAt: new Date() },
  { id: 't4', tenantId: 'sandbox', number: 'Table 4', seatingCapacity: 4, status: 'cleaning', qrToken: 'qr_t4', createdAt: new Date() },
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
      const interval = setInterval(loadLocalTables, 2000);
      window.addEventListener('storage', loadLocalTables);
      return () => {
        active = false;
        clearInterval(interval);
        window.removeEventListener('storage', loadLocalTables);
      };
    } else {
      const colRef = collection(db, 'tenants', tenantId, 'tables');
      const unsubscribe = onSnapshot(colRef, (snap: any) => {
        if (active) {
          const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Table));
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
      const interval = setInterval(loadLocalAlerts, 2000);
      window.addEventListener('storage', loadLocalAlerts);
      return () => {
        active = false;
        clearInterval(interval);
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

  // 3. Subscribe to active orders to track real-time kitchen preparation & delivery status
  useEffect(() => {
    let active = true;

    if (isMockMode) {
      const loadOrders = () => {
        const cached = localStorage.getItem(MOCK_ORDERS_KEY);
        if (cached) {
          try {
            const list = JSON.parse(cached) as Order[];
            const activeOnly = list.filter(o => o.status !== 'completed' && o.status !== 'archived');
            if (active) setActiveOrders(activeOnly);
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

  // Update order status (waiter delivering items to table / completing)
  const handleUpdateOrderStatus = async (orderId: string, nextStatus: OrderStatus) => {
    setActiveOrders((prev) =>
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
                      <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-wider">Change Table Status</p>
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

          {/* Active Orders Tracker (Kitchen Prep & Delivery Status) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Deliveries & Orders</h3>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
                {activeOrders.length} Active
              </span>
            </div>
            <div className="space-y-4">
              {activeOrders.map((o) => {
                const isServed = o.status === 'served';
                const allItemsReady = Array.isArray(o.items) && o.items.length > 0 && o.items.every((i) => i.status === 'ready' || i.status === 'served');
                const isReadyToServe = !isServed && (o.status === 'ready' || allItemsReady);

                let cardBorder = 'border-zinc-900 bg-zinc-905/30';
                let badgeColor = 'bg-zinc-900 text-zinc-400 border-zinc-800';

                if (o.status === 'pending') badgeColor = 'bg-red-500/10 text-red-400 border-red-500/20';
                if (o.status === 'preparing') badgeColor = 'bg-orange-500/10 text-orange-400 border-orange-500/20';
                if (isReadyToServe) {
                  cardBorder = 'border-emerald-500/40 bg-emerald-950/10 shadow-emerald-500/5';
                  badgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-black';
                }
                if (isServed) {
                  cardBorder = 'border-blue-500/30 bg-blue-950/10 shadow-blue-500/5';
                  badgeColor = 'bg-blue-500/20 text-blue-400 border-blue-500/30 font-black';
                }

                return (
                  <div key={o.id} className={`border p-4.5 rounded-2xl space-y-3.5 shadow-lg transition duration-200 ${cardBorder}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold text-white bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md">
                            {o.tableNumber}
                          </span>
                          <span className="text-xs font-extrabold text-white">
                            #{o.id.slice(-6).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1 font-medium">Customer: {o.customerName || 'Guest'}</p>
                      </div>
                      <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md border ${badgeColor}`}>
                        {o.status}
                      </span>
                    </div>

                    {/* Order items status tracker */}
                    <div className="space-y-1.5 pt-1">
                      {(o.items || []).map((item) => {
                        const itemServed = item.status === 'served' || isServed;
                        const itemReady = item.status === 'ready';
                        return (
                          <div key={item.id} className="flex justify-between items-center text-xs text-zinc-300 border-b border-zinc-900/40 pb-1.5 last:border-0 last:pb-0">
                            <span className="font-semibold">{item.quantity}x {item.name}</span>
                            <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                              itemServed ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                              itemReady ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              'bg-zinc-900 text-zinc-500'
                            }`}>
                              {itemServed ? 'served' : itemReady ? 'ready' : 'cooking'}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Actions: Deliver/Serve */}
                    <div className="flex gap-2 pt-2 border-t border-zinc-900/60">
                      {isServed ? (
                        <button
                          onClick={() => handleUpdateOrderStatus(o.id, 'completed')}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer text-center shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          SERVED • COMPLETE ORDER
                        </button>
                      ) : isReadyToServe ? (
                        <button
                          onClick={() => handleUpdateOrderStatus(o.id, 'served')}
                          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer text-center shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 animate-pulse"
                        >
                          <Send className="h-3.5 w-3.5" />
                          DELIVER TO TABLE
                        </button>
                      ) : o.status === 'preparing' ? (
                        <div className="w-full py-2.5 bg-zinc-950 text-orange-400 font-extrabold text-[10px] uppercase tracking-wider rounded-xl text-center border border-orange-500/20 flex items-center justify-center gap-2">
                          <Clock className="h-3.5 w-3.5 animate-spin text-orange-400" />
                          Kitchen Cooking...
                        </div>
                      ) : (
                        <div className="w-full py-2.5 bg-zinc-950 text-red-400 font-extrabold text-[10px] uppercase tracking-wider rounded-xl text-center border border-red-500/20 flex items-center justify-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-red-400 animate-pulse" />
                          Waiting Kitchen Accept
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {activeOrders.length === 0 && (
                <div className="border border-dashed border-zinc-850 py-16 text-center text-zinc-500 rounded-2xl">
                  <CheckCircle className="h-8 w-8 mx-auto text-emerald-500/25 mb-3" />
                  <p className="text-xs font-semibold text-zinc-300">No active orders in delivery queue</p>
                  <p className="text-[10px] text-zinc-500 mt-1">Ready orders from the kitchen will show up here</p>
                </div>
              )}
            </div>
          </div>

          {/* Customer Service Requests Sidebar */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Customer Alerts</h3>
            <div className="space-y-3">
              {alerts.map((a) => (
                <div key={a.id} className="border border-zinc-900 bg-zinc-905/30 p-4 rounded-xl flex items-start gap-3 shadow-lg">
                  <div className="mt-0.5 text-orange-400 bg-orange-950/15 border border-orange-500/10 p-2 rounded-lg shrink-0">
                    {a.type === 'call_waiter' ? <HelpCircle className="h-4.5 w-4.5" /> : <AlertCircle className="h-4.5 w-4.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <h4 className="text-sm font-bold text-white">{a.tableNumber}</h4>
                      <span className="text-[10px] text-zinc-550">{a.time}</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      {a.type === 'call_waiter' ? 'Requested waiter / service' : 'Billing request: Bill & Print'}
                    </p>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => handleDismissAlert(a.id)}
                        className="flex-1 py-2 border border-zinc-800 bg-zinc-950/60 text-[10px] font-bold text-zinc-300 rounded-lg hover:bg-zinc-850 transition cursor-pointer"
                      >
                        Dismiss Alert
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {alerts.length === 0 && (
                <div className="border border-zinc-900 bg-zinc-950 py-16 text-center text-zinc-550 rounded-2xl">
                  <CheckCircle className="h-8 w-8 mx-auto text-emerald-500/15 mb-3" />
                  <p className="text-xs font-semibold text-zinc-400">All customer alerts clear</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
