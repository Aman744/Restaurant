import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/shared/DashboardLayout';
import { CreditCard, Receipt, CheckCircle, Printer, X } from 'lucide-react';
import { useAuth } from '../../features/auth/context/AuthContext.js';
import { useTenant } from '../../features/auth/context/TenantContext.js';
import { useToast } from '../../components/shared/ToastContext';
import { db } from '../../lib/firebase.js';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import type { Order } from '@restaurant-qr/core';

interface BillTicket {
  id: string;
  tableNumber: string;
  subtotal: number;
  tax: number;
  serviceCharge: number;
  total: number;
  itemsCount: number;
  rawOrder: Order;
}

export const CashierDashboard: React.FC = () => {
  const { tenant } = useTenant();
  const { isMockMode } = useAuth();
  const toast = useToast();

  const tenantId = tenant?.id || 'tenant_dev_123';

  const sidebarItems = [
    { name: 'Pending Bills', path: '/cashier', icon: CreditCard },
  ];

  const [orders, setOrders] = useState<Order[]>([]);
  const [settledOrders, setSettledOrders] = useState<Order[]>([]);
  const currencySymbol = '₹';
  const [loading, setLoading] = useState(true);
  
  const [selectedBill, setSelectedBill] = useState<BillTicket | null>(null);
  const [splitCount, setSplitCount] = useState(1);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | 'upi'>('cash');
  const [receiptModalOrder, setReceiptModalOrder] = useState<Order | null>(null);

  // Load settings and subscribe to active unpaid orders
  useEffect(() => {
    let active = true;

    if (isMockMode) {
      const syncMockOrders = () => {
        const stored = localStorage.getItem('restaurant_qr_mock_orders_db');
        if (stored) {
          try {
            const parsed: Order[] = JSON.parse(stored);
            const activeUnpaid = parsed.filter(
              (o) => o.payment?.status !== 'paid' && 
                     o.status !== 'completed' && 
                     o.status !== 'archived'
            );
            const paidOrders = parsed.filter((o) => o.payment?.status === 'paid' || o.status === 'completed');
            
            if (active) {
              setOrders(activeUnpaid);
              setSettledOrders(paidOrders);
              setLoading(false);
            }
          } catch (e) {}
        } else {
          if (active) {
            setOrders([]);
            setSettledOrders([]);
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
      const colRef = collection(db, 'tenants', tenantId, 'orders');
      const unsubscribe = onSnapshot(colRef, (snap) => {
        const activeUnpaid: Order[] = [];
        const paidOrders: Order[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          const toDate = (val: any): Date => {
            if (!val) return new Date();
            if (typeof val.toDate === 'function') return val.toDate();
            return new Date(val);
          };
          const orderObj = {
            id: docSnap.id,
            ...data,
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt)
          } as Order;

          if (data.payment?.status !== 'paid' && data.status !== 'completed' && data.status !== 'archived') {
            activeUnpaid.push(orderObj);
          } else if (data.payment?.status === 'paid' || data.status === 'completed') {
            paidOrders.push(orderObj);
          }
        });
        if (active) {
          setOrders(activeUnpaid);
          setSettledOrders(paidOrders);
          setLoading(false);
        }
      }, (err) => {
        console.error('Orders subscription failed:', err);
        if (active) setLoading(false);
      });

      return () => {
        active = false;
        unsubscribe();
      };
    }
  }, [tenantId, isMockMode]);

  // Map orders state to UI bills list structure
  const pendingBills: BillTicket[] = orders.map((o) => ({
    id: o.id,
    tableNumber: o.tableNumber || `Table ${o.tableId || '1'}`,
    subtotal: o.totals?.subtotal || 0,
    tax: o.totals?.tax || 0,
    serviceCharge: o.totals?.serviceCharge || 0,
    total: o.totals?.grandTotal || 0,
    itemsCount: (o.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0),
    rawOrder: o
  }));

  const handleSettle = async (billId: string) => {
    if (!selectedBill) return;

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
                  amountPaid: o.totals?.grandTotal || selectedBill.total
                },
                updatedAt: new Date().toISOString()
              };
            }
            return o;
          });
          localStorage.setItem('restaurant_qr_mock_orders_db', JSON.stringify(updated));
          window.dispatchEvent(new Event('storage'));
        }
      } else {
        await updateDoc(doc(db, 'tenants', tenantId, 'orders', billId), {
          status: 'completed',
          'payment.status': 'paid',
          'payment.method': paymentMode,
          'payment.amountPaid': selectedBill.total,
          updatedAt: new Date()
        });
      }

      toast.success(`Bill for ${selectedBill.tableNumber} settled successfully via ${paymentMode.toUpperCase()}!`);
      setReceiptModalOrder(selectedBill.rawOrder);
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
      <div className="space-y-8 animate-fadeIn">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Pending Bills */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                  <CreditCard className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Pending Table Settlements</h3>
                  <p className="text-xs text-zinc-500">Unpaid table invoices awaiting cashier settlement</p>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl">
                {pendingBills.length} Pending Invoices
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingBills.map((b) => (
                <div
                  key={b.id}
                  onClick={() => setSelectedBill(b)}
                  className={`border p-5 rounded-3xl cursor-pointer transition-all flex flex-col justify-between space-y-3 shadow-lg ${
                    selectedBill?.id === b.id
                      ? 'border-emerald-500 bg-emerald-500/10 shadow-emerald-500/10'
                      : 'border-zinc-850 hover:border-zinc-700 bg-zinc-900/30'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-xl">
                          {b.tableNumber}
                        </span>
                        <h4 className="font-extrabold text-sm text-white">#{b.id.slice(-6).toUpperCase()}</h4>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1 font-mono">Invoice #{b.id}</p>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                      {b.itemsCount} items
                    </span>
                  </div>

                  {/* Itemized Dishes List on Card */}
                  <div className="space-y-1 my-2 text-xs border-y border-zinc-900/80 py-2.5 max-h-28 overflow-y-auto pr-1">
                    {(b.rawOrder.items || []).map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-zinc-300">
                        <span className="font-semibold text-xs">{item.quantity}x {item.name}</span>
                        <span className="text-[10px] font-bold text-zinc-400">
                          {currencySymbol}{(item.totalPrice || item.unitPrice * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    {(!b.rawOrder.items || b.rawOrder.items.length === 0) && (
                      <p className="text-[10px] text-zinc-500 italic">No items attached</p>
                    )}
                  </div>

                  <div className="flex justify-between items-end pt-1">
                    <span className="text-xs text-zinc-400 font-medium">Grand Total:</span>
                    <span className="text-xl font-black text-emerald-400">{currencySymbol}{b.total.toFixed(2)}</span>
                  </div>
                </div>
              ))}

              {pendingBills.length === 0 && (
                <div className="col-span-full border border-dashed border-zinc-850 bg-zinc-950 py-16 text-center text-zinc-500 rounded-3xl">
                  <CheckCircle className="h-10 w-10 mx-auto text-emerald-500/20 mb-3" />
                  <p className="text-sm font-semibold text-zinc-300">All table invoices settled!</p>
                  <p className="text-xs text-zinc-500 mt-1">Pending orders sent by waiters will appear here automatically</p>
                </div>
              )}
            </div>
          </div>

          {/* Settle Panel Console */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Settlement Console</h3>

            {selectedBill ? (
              <div className="border border-zinc-800 bg-zinc-900/40 p-6 rounded-3xl space-y-5 shadow-2xl">
                <div className="flex justify-between items-start border-b border-zinc-800 pb-3">
                  <div>
                    <h4 className="font-black text-lg text-white">{selectedBill.tableNumber}</h4>
                    <p className="text-[10px] text-zinc-500 font-mono">Settling invoice #{selectedBill.id}</p>
                  </div>
                  <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl">
                    UNPAID
                  </span>
                </div>

                {/* Ordered Dishes Itemized List in Settlement Console */}
                <div className="space-y-2 border-b border-zinc-800 pb-4">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Ordered Dishes</p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {(selectedBill.rawOrder.items || []).map((item) => (
                      <div key={item.id} className="flex justify-between text-xs text-zinc-200">
                        <span className="font-medium">{item.quantity}x {item.name}</span>
                        <span className="font-bold text-zinc-300">{currencySymbol}{(item.totalPrice || item.unitPrice * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 border-b border-zinc-800 pb-4 text-sm">
                  <div className="flex justify-between text-zinc-400 text-xs">
                    <span>Subtotal</span>
                    <span>{currencySymbol}{selectedBill.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400 text-xs">
                    <span>Tax (GST)</span>
                    <span>{currencySymbol}{selectedBill.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400 text-xs">
                    <span>Service Charge</span>
                    <span>{currencySymbol}{selectedBill.serviceCharge.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-white font-black text-lg pt-2 border-t border-zinc-850">
                    <span>Total Amount</span>
                    <span className="text-emerald-400">{currencySymbol}{selectedBill.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Splitting Option */}
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Split Bill</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSplitCount(Math.max(1, splitCount - 1))}
                      className="h-9 w-9 rounded-xl bg-zinc-850 border border-zinc-750 flex items-center justify-center font-black text-zinc-200 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="flex-1 text-center font-bold text-white text-xs">{splitCount} Guests</span>
                    <button
                      onClick={() => setSplitCount(splitCount + 1)}
                      className="h-9 w-9 rounded-xl bg-zinc-850 border border-zinc-750 flex items-center justify-center font-black text-zinc-200 cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  {splitCount > 1 && (
                    <div className="p-3 border border-emerald-500/20 bg-emerald-500/10 rounded-xl flex justify-between text-xs text-emerald-400 font-bold mt-2">
                      <span>Each Pays:</span>
                      <span>{currencySymbol}{(selectedBill.total / splitCount).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Payment Mode Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['cash', 'card', 'upi'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setPaymentMode(mode)}
                        className={`py-2.5 px-3 text-[10px] font-black uppercase rounded-xl border transition cursor-pointer ${
                          paymentMode === mode
                            ? 'bg-emerald-500 text-black border-emerald-600 shadow-md shadow-emerald-500/20'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-850 hover:text-zinc-200'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleSettle(selectedBill.id)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-black py-3.5 rounded-2xl shadow-xl shadow-emerald-500/20 text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Receipt className="h-4 w-4" />
                  Confirm Settle & Print Receipt
                </button>
              </div>
            ) : (
              <div className="border border-dashed border-zinc-850 py-16 text-center text-zinc-500 rounded-3xl">
                <Receipt className="h-8 w-8 mx-auto text-zinc-600 mb-3" />
                <p className="text-xs font-semibold text-zinc-400">Select a pending bill to view settlement console</p>
              </div>
            )}
          </div>
        </div>

        {/* SECTION: Settled Receipts History */}
        <div className="pt-8 border-t border-zinc-900 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                <CheckCircle className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Settled Invoices History</h3>
                <p className="text-xs text-zinc-500">Paid customer receipts and transaction audit history</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl">
              {settledOrders.length} Settled
            </span>
          </div>

          {settledOrders.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {settledOrders.map((o) => (
                <div
                  key={`settled_${o.id}`}
                  className="border border-zinc-850 bg-zinc-900/40 p-5 rounded-3xl space-y-4 opacity-80 hover:opacity-100 transition duration-200"
                >
                  <div className="flex justify-between items-start border-b border-zinc-850 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-xl">
                          {o.tableNumber || `Table ${o.tableId || '1'}`}
                        </span>
                        <span className="text-sm font-bold text-white">#{o.id.slice(-6).toUpperCase()}</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1 font-mono">Invoice #{o.id}</p>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                      PAID ({o.payment?.method || 'CASH'})
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    {(o.items || []).map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-zinc-300">
                        <span>{item.quantity}x {item.name}</span>
                        <span className="text-[10px] font-bold text-zinc-400">₹{(item.totalPrice || item.unitPrice * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-zinc-850 flex justify-between items-center text-xs">
                    <span className="text-emerald-400 font-extrabold text-sm">Total: ₹{(o.totals?.grandTotal || 0).toFixed(2)}</span>
                    <button
                      onClick={() => setReceiptModalOrder(o)}
                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-750 px-3 py-1.5 rounded-xl transition cursor-pointer"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Thermal Receipt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-zinc-850 py-12 text-center text-zinc-500 rounded-3xl">
              <p className="text-xs font-semibold text-zinc-400">No settled transaction receipts yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Thermal Tax Receipt Modal Preview */}
      {receiptModalOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 text-zinc-100 max-w-sm w-full rounded-3xl p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setReceiptModalOrder(null)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-white p-1"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Thermal Receipt Visual Container */}
            <div className="bg-white text-black p-6 rounded-2xl shadow-inner font-mono text-xs space-y-4">
              {/* Receipt Header */}
              <div className="text-center space-y-1 border-b border-dashed border-gray-400 pb-3">
                {tenant?.logoUrl && (
                  <img src={tenant.logoUrl} alt="Logo" className="h-10 mx-auto object-contain mb-1" />
                )}
                <h3 className="font-bold text-sm uppercase tracking-wide">{tenant?.name || 'Restaurant QR'}</h3>
                <p className="text-[10px] text-gray-600">TAX INVOICE / RECEIPT</p>
                <p className="text-[10px] text-gray-500">Table: {receiptModalOrder.tableNumber || 'Table 1'}</p>
                <p className="text-[10px] text-gray-500">Invoice: #{receiptModalOrder.id}</p>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-1 border-b border-dashed border-gray-400 pb-3">
                {(receiptModalOrder.items || []).map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span>{item.quantity}x {item.name}</span>
                    <span>₹{(item.totalPrice || item.unitPrice * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Totals Breakdown */}
              <div className="space-y-1 border-b border-dashed border-gray-400 pb-3 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{(receiptModalOrder.totals?.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (GST):</span>
                  <span>₹{(receiptModalOrder.totals?.tax || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Service Charge:</span>
                  <span>₹{(receiptModalOrder.totals?.serviceCharge || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-1">
                  <span>GRAND TOTAL:</span>
                  <span>₹{(receiptModalOrder.totals?.grandTotal || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Receipt Footer */}
              <div className="text-center text-[10px] text-gray-600 space-y-0.5 pt-1">
                <p className="font-bold text-black">PAID VIA {(receiptModalOrder.payment?.method || 'CASH').toUpperCase()}</p>
                <p>Thank you for dining with us!</p>
                <p>Please visit again</p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => window.print()}
                className="py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs uppercase rounded-xl transition cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                Print Receipt
              </button>
              <button
                onClick={() => setReceiptModalOrder(null)}
                className="py-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-bold text-xs uppercase rounded-xl border border-zinc-800 transition cursor-pointer text-center"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
