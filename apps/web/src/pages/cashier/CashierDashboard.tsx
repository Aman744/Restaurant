import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/shared/DashboardLayout';
import { CreditCard, Receipt, CheckCircle } from 'lucide-react';
import { useAuth } from '../../features/auth/context/AuthContext.js';
import { useTenant } from '../../features/auth/context/TenantContext.js';
import { useToast } from '../../components/shared/ToastContext';
import { db } from '../../lib/firebase.js';
import { collection, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import type { Order } from '@restaurant-qr/core';

interface BillTicket {
  id: string;
  tableNumber: string;
  subtotal: number;
  tax: number;
  serviceCharge: number;
  total: number;
  itemsCount: number;
}

export const CashierDashboard: React.FC = () => {
  const { tenant } = useTenant();
  const { isMockMode } = useAuth();
  const toast = useToast();

  const sidebarItems = [
    { name: 'Pending Bills', path: '/cashier', icon: CreditCard },
  ];

  const [orders, setOrders] = useState<Order[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [loading, setLoading] = useState(true);
  
  const [selectedBill, setSelectedBill] = useState<BillTicket | null>(null);
  const [splitCount, setSplitCount] = useState(1);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | 'upi'>('cash');

  // Load settings and subscribe to active unpaid orders
  useEffect(() => {
    if (!tenant) return;
    let active = true;

    // Load general settings to find currency
    const loadSettings = async () => {
      try {
        if (isMockMode) {
          setCurrencySymbol('₹');
        } else {
          const settingsSnap = await getDoc(doc(db, 'tenants', tenant.id, 'settings', 'general'));
          if (settingsSnap.exists() && active) {
            const data = settingsSnap.data();
            setCurrencySymbol(data.currency === 'INR' ? '₹' : '$');
          }
        }
      } catch (e) {
        console.error('Failed to load currency settings:', e);
      }
    };
    loadSettings();

    // Subscribe to active unpaid orders
    if (isMockMode) {
      const syncMockOrders = () => {
        const stored = localStorage.getItem('restaurant_qr_mock_orders_db');
        if (stored) {
          try {
            const parsed: Order[] = JSON.parse(stored);
            const activeUnpaid = parsed.filter(
              (o) => o.tenantId === tenant.id && 
                     o.payment.status !== 'paid' && 
                     o.status !== 'completed' && 
                     o.status !== 'archived'
            );
            if (active) {
              setOrders(activeUnpaid);
              setLoading(false);
            }
          } catch (e) {}
        } else {
          if (active) {
            setOrders([]);
            setLoading(false);
          }
        }
      };

      syncMockOrders();
      const interval = setInterval(syncMockOrders, 2000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    } else {
      const colRef = collection(db, 'tenants', tenant.id, 'orders');
      const unsubscribe = onSnapshot(colRef, (snap) => {
        const ordersList: Order[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          // Filter unpaid/pending active orders
          if (data.payment?.status !== 'paid' && data.status !== 'completed' && data.status !== 'archived') {
            const toDate = (val: any): Date => {
              if (!val) return new Date();
              if (typeof val.toDate === 'function') return val.toDate();
              return new Date(val);
            };
            ordersList.push({
              id: docSnap.id,
              ...data,
              createdAt: toDate(data.createdAt),
              updatedAt: toDate(data.updatedAt)
            } as Order);
          }
        });
        if (active) {
          setOrders(ordersList);
          setLoading(false);
        }
      }, (err) => {
        console.error('Orders subscription failed:', err);
      });

      return () => {
        active = false;
        unsubscribe();
      };
    }
  }, [tenant, isMockMode]);

  // Map orders state to UI bills list structure
  const pendingBills = orders.map((o) => ({
    id: o.id,
    tableNumber: o.tableNumber || `Table ${o.tableId}`,
    subtotal: o.totals.subtotal,
    tax: o.totals.tax,
    serviceCharge: o.totals.serviceCharge,
    total: o.totals.grandTotal,
    itemsCount: o.items.reduce((sum, it) => sum + it.quantity, 0)
  }));

  const handleSettle = async (billId: string) => {
    try {
      if (isMockMode) {
        const stored = localStorage.getItem('restaurant_qr_mock_orders_db');
        if (stored) {
          const parsed: Order[] = JSON.parse(stored);
          const updated = parsed.map((o) => {
            if (o.id === billId) {
              return {
                ...o,
                status: 'completed' as const,
                payment: {
                  ...o.payment,
                  status: 'paid' as const,
                  method: paymentMode,
                  amountPaid: o.totals.grandTotal
                },
                updatedAt: new Date()
              };
            }
            return o;
          });
          localStorage.setItem('restaurant_qr_mock_orders_db', JSON.stringify(updated));
        }
      } else {
        if (!tenant) return;
        await updateDoc(doc(db, 'tenants', tenant.id, 'orders', billId), {
          status: 'completed',
          'payment.status': 'paid',
          'payment.method': paymentMode,
          'payment.amountPaid': selectedBill?.total || 0,
          updatedAt: new Date()
        });
      }

      toast.success(`Bill for ${selectedBill?.tableNumber} settled successfully via ${paymentMode.toUpperCase()}!`);
      setSelectedBill(null);
      setSplitCount(1);
    } catch (err: any) {
      toast.error(`Settlement failed: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Cashier Billing & POS" sidebarItems={sidebarItems}>
        <div className="flex h-64 items-center justify-center text-zinc-400">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
            <p className="text-xs font-semibold">Loading bills queue...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Cashier Billing & POS" sidebarItems={sidebarItems}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Pending Bills */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Pending Table Settlements</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingBills.map((b) => (
                <div
                  key={b.id}
                  onClick={() => setSelectedBill(b)}
                  className={`border p-5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-40 ${
                    selectedBill?.id === b.id
                      ? 'border-emerald-500 bg-emerald-500/5'
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/10'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-base text-white">{b.tableNumber}</h4>
                      <p className="text-[10px] text-zinc-500">Bill ID: {b.id}</p>
                    </div>
                    <span className="text-[10px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
                      {b.itemsCount} items
                    </span>
                  </div>

                  <div className="flex justify-between items-end mt-4">
                    <span className="text-xs text-zinc-400 font-medium">Grand Total:</span>
                    <span className="text-xl font-bold text-white">{currencySymbol}{b.total.toFixed(2)}</span>
                  </div>
                </div>
              ))}

              {pendingBills.length === 0 && (
                <div className="col-span-full border border-zinc-900 bg-zinc-950 py-16 text-center text-zinc-500 rounded-3xl">
                  <CheckCircle className="h-10 w-10 mx-auto text-emerald-500/10 mb-3" />
                  <p className="text-sm font-medium">All bills settled!</p>
                </div>
              )}
            </div>
          </div>

          {/* Settle Panel */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Settlement Console</h3>

            {selectedBill ? (
              <div className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-2xl space-y-5">
                <div>
                  <h4 className="font-bold text-white">{selectedBill.tableNumber}</h4>
                  <p className="text-[10px] text-zinc-500">Settling invoice #{selectedBill.id}</p>
                </div>

                <div className="space-y-2 border-y border-zinc-800 py-4 text-sm">
                  <div className="flex justify-between text-zinc-400">
                    <span>Subtotal</span>
                    <span>{currencySymbol}{selectedBill.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Tax (GST)</span>
                    <span>{currencySymbol}{selectedBill.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Service Charge</span>
                    <span>{currencySymbol}{selectedBill.serviceCharge.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-white font-bold text-base mt-2">
                    <span>Total Amount</span>
                    <span>{currencySymbol}{selectedBill.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Splitting Option */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Split Bill</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSplitCount(Math.max(1, splitCount - 1))}
                      className="h-8 w-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-zinc-300"
                    >
                      -
                    </button>
                    <span className="flex-1 text-center font-bold text-white text-sm">{splitCount} Guests</span>
                    <button
                      onClick={() => setSplitCount(splitCount + 1)}
                      className="h-8 w-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-zinc-300"
                    >
                      +
                    </button>
                  </div>

                  {splitCount > 1 && (
                    <div className="p-3 border border-emerald-500/10 bg-emerald-500/5 rounded-xl flex justify-between text-xs text-emerald-400 font-semibold mt-2">
                      <span>Each Pays:</span>
                      <span>{currencySymbol}{(selectedBill.total / splitCount).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Payment Mode Selector */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Payment Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['cash', 'card', 'upi'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setPaymentMode(mode)}
                        className={`py-2 px-3 text-[10px] font-bold uppercase rounded-lg border transition ${
                          paymentMode === mode
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                            : 'bg-zinc-800/40 text-zinc-400 border-zinc-850 hover:bg-zinc-800'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleSettle(selectedBill.id)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl shadow-lg shadow-emerald-500/10 text-xs uppercase tracking-wider"
                >
                  Confirm Settle & Print Receipt
                </button>
              </div>
            ) : (
              <div className="border border-dashed border-zinc-800 py-16 text-center text-zinc-650 rounded-2xl">
                <Receipt className="h-8 w-8 mx-auto text-zinc-700 mb-3" />
                <p className="text-xs font-medium">Select a pending bill to view settlement console</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
