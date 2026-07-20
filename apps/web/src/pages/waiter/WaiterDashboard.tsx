import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/shared/DashboardLayout';
import { Utensils, HelpCircle, AlertCircle, CheckCircle, Send, CreditCard, RotateCcw, Check, Clock } from 'lucide-react';
import type { Table, Order, OrderItem, OrderStatus } from '@restaurant-qr/core';
import { useUserProfile } from '../../features/auth/context/UserContext.js';
import { useAuth } from '../../features/auth/context/AuthContext.js';
import { useToast } from '../../components/shared/ToastContext';
import { db } from '../../lib/firebase.js';
import { doc, setDoc, onSnapshot, collection, getDocs, deleteDoc } from 'firebase/firestore';

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
  const toast = useToast();
  const tenantId = profile?.tenantId || 'sandbox';

  const sidebarItems = [
    { name: 'Service Board', path: '/waiter', icon: Utensils },
  ];

  const [tables, setTables] = useState<Table[]>([]);
  const [alerts, setAlerts] = useState<WaiterAlert[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSectionTab, setActiveSectionTab] = useState<string>('All Sections');

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

  // 3. Subscribe to all orders
  useEffect(() => {
    let active = true;

    if (isMockMode) {
      const loadOrders = () => {
        const cached = localStorage.getItem(MOCK_ORDERS_KEY);
        if (cached) {
          try {
            const list = JSON.parse(cached) as Order[];
            if (active) setOrders(list);
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
      const unsubscribe = onSnapshot(colRef, async (snap: any) => {
        if (active) {
          const list: Order[] = [];
          for (const d of snap.docs) {
            const header = d.data();
            const itemsCol = collection(db, 'tenants', tenantId, 'orders', d.id, 'order_items');
            const itemsSnap = await getDocs(itemsCol);
            const items = itemsSnap.docs.map((it: any) => ({ id: it.id, ...it.data() } as OrderItem));
            list.push({ id: d.id, ...header, items } as Order);
          }
          if (active) setOrders(list);
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

  // Send Billing request to Cashier Console (http://localhost:5173/cashier)
  const handleSendToCashier = async (orderId: string, tableNumber: string) => {
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
        } catch (e) {}
      }
    } else {
      try {
        await setDoc(doc(db, 'tenants', tenantId, 'orders', orderId), { billRequested: true, requestedBillAt: new Date(), 'payment.status': 'unpaid', updatedAt: new Date() }, { merge: true });
      } catch (err) {
        console.error('Failed to send bill to cashier:', err);
      }
    }

    toast.success(`Bill for ${tableNumber} sent to Cashier!`);
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

  // Categorize Sections (Sorted chronologically by date/time descending - newest first)
  const readyForDeliveryOrders = orders
    .filter((o) => {
      const isServed = o.status === 'served';
      const isBillSent = Boolean((o as any).billRequested || (o as any).requestedBillAt);
      const allItemsReady = Array.isArray(o.items) && o.items.length > 0 && o.items.every((i) => i.status === 'ready' || i.status === 'served');
      return !isServed && !isBillSent && o.status !== 'completed' && o.status !== 'archived' && (o.status === 'ready' || allItemsReady);
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const currentlyServedOrders = orders
    .filter((o) => {
      const isBillSent = Boolean((o as any).billRequested || (o as any).requestedBillAt);
      const isPaid = o.payment?.status === 'paid' || o.status === 'completed';
      return o.status === 'served' && !isBillSent && !isPaid;
    })
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());

  const sentToCashierOrders = orders
    .filter((o) => {
      const isBillSent = Boolean((o as any).billRequested || (o as any).requestedBillAt);
      const isPaid = o.payment?.status === 'paid' || o.status === 'completed' || o.status === 'archived';
      return isBillSent && !isPaid;
    })
    .sort((a, b) => new Date((b as any).requestedBillAt || b.updatedAt || 0).getTime() - new Date((a as any).requestedBillAt || a.updatedAt || 0).getTime());

  const completedOrders = orders
    .filter((o) => o.status === 'completed' || o.payment?.status === 'paid')
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());

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

  return (
    <DashboardLayout title="Waiter Service Console" sidebarItems={sidebarItems}>
      <div className="space-y-8 animate-fadeIn">
        {/* Section Navigation Tabs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-900 pb-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'All Sections', label: 'All Sections' },
              { id: 'Tables', label: `Dining Tables (${resolvedTables.length})` },
              { id: 'Delivery', label: `Ready for Delivery (${readyForDeliveryOrders.length})` },
              { id: 'Served', label: `Served to Tables (${currentlyServedOrders.length})` },
              { id: 'CashierQueue', label: `Sent to Cashier (${sentToCashierOrders.length})` },
              { id: 'Alerts', label: `Customer Alerts (${alerts.length})` },
              { id: 'Completed', label: `Completed (${completedOrders.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSectionTab(tab.id)}
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
                {resolvedTables.length} Tables Registered
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                          t.status === 'occupied' ? 'bg-emerald-500 animate-pulse' :
                          t.status === 'reserved' ? 'bg-violet-500' : 'bg-orange-500'
                        }`} />
                        <span className="text-xs uppercase font-extrabold tracking-wider capitalize text-zinc-300">
                          {t.status}
                        </span>
                      </div>
                    </div>

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
        {(activeSectionTab === 'All Sections' || activeSectionTab === 'Alerts') && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
                  <HelpCircle className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Customer Service Alerts & Cashier Routing</h3>
                  <p className="text-xs text-zinc-500">Live waiter call requests & billing print calls sent to cashier console</p>
                </div>
              </div>
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-xl">
                {alerts.length} Pending Alerts
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {alerts.map((a) => (
                <div key={a.id} className="border border-amber-500/30 bg-amber-950/10 p-5 rounded-3xl space-y-4 shadow-xl">
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
                      {a.type === 'call_waiter' ? 'Call Waiter' : 'Bill Request'}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/50 p-3 rounded-2xl border border-zinc-900">
                    {a.type === 'call_waiter'
                      ? 'Guest requested table assistance / menu query.'
                      : 'Guest requested bill printing & payment settlement.'}
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-500/20">
                    <button
                      onClick={() => {
                        handleSendToCashier(a.id, a.tableNumber);
                        handleDismissAlert(a.id);
                      }}
                      className="py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-md"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      Send Cashier
                    </button>
                    <button
                      onClick={() => handleDismissAlert(a.id)}
                      className="py-2.5 border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-bold text-xs uppercase rounded-xl transition cursor-pointer text-center"
                    >
                      Dismiss Alert
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
        )}

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
    </DashboardLayout>
  );
};
