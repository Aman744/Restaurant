import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/shared/DashboardLayout';
import { CreditCard, Receipt, CheckCircle, Printer, X, Bell, Clock, IndianRupee, FileText, Download } from 'lucide-react';
import { useAuth } from '../../features/auth/context/AuthContext.js';
import { useTenant } from '../../features/auth/context/TenantContext.js';
import { useUserProfile } from '../../features/auth/context/UserContext.js';
import { useToast } from '../../components/shared/ToastContext';
import { db } from '../../lib/firebase.js';
import { doc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { OrderRepository } from '@restaurant-qr/infra';
import type { Order } from '@restaurant-qr/core';
import { EventService } from '../../services/EventService.js';

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
  const { profile } = useUserProfile();
  const toast = useToast();

  const tenantId = tenant?.id || 'tenant_dev_123';

  const sidebarItems = [
    { name: 'Settlement Console', path: '/cashier', icon: CreditCard },
    { name: 'Invoices History', path: '/cashier/invoices', icon: FileText },
  ];

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
            const normalized = parsed.map((o) => {
              let items = Array.isArray(o.items) && o.items.length > 0 ? o.items : [];
              if (items.length === 0) {
                items = [{
                  id: `item_fb_${o.id}`,
                  menuItemId: 'item_01',
                  name: 'Chef Special Order Dish',
                  quantity: 1,
                  unitPrice: o.totals?.grandTotal || 50,
                  totalPrice: o.totals?.grandTotal || 50,
                  stationId: 'main',
                  status: 'ready'
                }];
              }
              return { ...o, items };
            });

            const tenantOrders = normalized.filter((o) => o.tenantId === selectedTenantId);

            const activeUnpaid = tenantOrders.filter(
              (o: any) => o.payment?.status !== 'paid' && 
                     o.status !== 'completed' && 
                     o.status !== 'archived'
            );
            const paidOrders = tenantOrders.filter((o) => o.payment?.status === 'paid' || o.status === 'completed');
            
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
      const repo = new OrderRepository(db);
      const unsubscribe = repo.subscribeAll(selectedTenantId, (ordersList) => {
        const activeUnpaid: Order[] = [];
        const paidOrders: Order[] = [];

        for (const order of ordersList) {
          if (order.payment?.status !== 'paid' && order.status !== 'completed' && order.status !== 'archived') {
            activeUnpaid.push(order);
          } else if (order.payment?.status === 'paid' || order.status === 'completed') {
            paidOrders.push(order);
          }
        }

        if (active) {
          setOrders(activeUnpaid);
          setSettledOrders(paidOrders);
          setLoading(false);
        }
      });

      return () => {
        active = false;
        unsubscribe();
      };
    }
  }, [selectedTenantId, isMockMode]);

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
  })).sort((a, b) => {
    const timeA = getMs((a.rawOrder as any).requestedBillAt || a.rawOrder.createdAt);
    const timeB = getMs((b.rawOrder as any).requestedBillAt || b.rawOrder.createdAt);
    return timeB - timeA;
  });

  const sortedSettledOrders = [...settledOrders].sort((a, b) => {
    const timeA = getMs(a.updatedAt || a.createdAt);
    const timeB = getMs(b.updatedAt || b.createdAt);
    return timeB - timeA;
  });

  const handleDownloadSingleInvoice = (order: Order) => {
    const lines = [
      `========================================`,
      `          ${(tenant?.name || 'RESTAURANT POS').toUpperCase()}          `,
      `       OFFICIAL TAX INVOICE & RECEIPT      `,
      `========================================`,
      `Invoice ID: #${order.id}`,
      `Date/Time:  ${formatOrderDateTime(order.updatedAt || order.createdAt)}`,
      `Table:      ${order.tableNumber || `Table ${order.tableId || '1'}`}`,
      `Customer:   ${order.customerName || 'Guest Customer'}`,
      `Payment:    PAID (${(order.payment?.method || 'CASH').toUpperCase()})`,
      `----------------------------------------`,
      `ITEM                     QTY   PRICE    TOTAL`,
      `----------------------------------------`,
      ...(order.items || []).map(
        (it) =>
          `${(it.name || 'Dish').padEnd(24).slice(0, 24)} ${it.quantity.toString().padStart(3)}  ${(currencySymbol + (it.unitPrice || 0).toFixed(2)).padStart(8)}  ${(currencySymbol + (it.totalPrice || (it.unitPrice || 0) * (it.quantity || 1)).toFixed(2)).padStart(9)}`
      ),
      `----------------------------------------`,
      `Subtotal:       ${currencySymbol}${(order.totals?.subtotal || 0).toFixed(2)}`,
      `GST Tax (5%):   ${currencySymbol}${(order.totals?.tax || 0).toFixed(2)}`,
      `Service Charge: ${currencySymbol}${(order.totals?.serviceCharge || 0).toFixed(2)}`,
      `----------------------------------------`,
      `GRAND TOTAL:    ${currencySymbol}${(order.totals?.grandTotal || 0).toFixed(2)}`,
      `========================================`,
      `     Thank you for dining with us!      `,
      `========================================`
    ].join('\n');

    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoice_${order.id.slice(-6).toUpperCase()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSettle = async (billId: string) => {
    if (!selectedBill) return;

    try {
      const tableId = selectedBill.rawOrder.tableId;

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
        }

        if (tableId) {
          const cachedTables = localStorage.getItem('restaurant_qr_mock_tables_db');
          if (cachedTables) {
            try {
              const tablesList = JSON.parse(cachedTables);
              const updatedTables = tablesList.map((t: any) =>
                t.id === tableId || t.number === selectedBill.tableNumber
                  ? { ...t, status: 'cleaning', activeOrderId: null }
                  : t
              );
              localStorage.setItem('restaurant_qr_mock_tables_db', JSON.stringify(updatedTables));
            } catch (e) {}
          }
        }
        window.dispatchEvent(new Event('storage'));
        await EventService.logEvent(selectedTenantId, 'payment.completed', billId, profile?.uid || 'cashier', { amount: selectedBill.total, method: paymentMode, tableId }, true);
      } else {
        await updateDoc(doc(db, 'tenants', selectedTenantId, 'orders', billId), {
          status: 'completed',
          'payment.status': 'paid',
          'payment.method': paymentMode,
          'payment.amountPaid': selectedBill.total,
          updatedAt: new Date()
        });

        if (tableId) {
          try {
            await updateDoc(doc(db, 'tenants', selectedTenantId, 'tables', tableId), { status: 'cleaning', activeOrderId: null });
          } catch (err) {}
        }
        await EventService.logEvent(selectedTenantId, 'payment.completed', billId, profile?.uid || 'cashier', { amount: selectedBill.total, method: paymentMode, tableId }, false);
      }

      toast.success(`Bill for ${selectedBill.tableNumber} settled successfully via ${paymentMode.toUpperCase()}!`);
      setReceiptModalOrder(selectedBill.rawOrder);
      setSelectedBill(null);
      setSplitCount(1);
    } catch (err: any) {
      toast.error(`Settlement failed: ${err.message}`);
    }
  };

  const renderSettlementForm = (bill: BillTicket) => (
    <div className="border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6 rounded-3xl space-y-5 shadow-2xl relative">
      <div className="flex justify-between items-start border-b border-zinc-800 pb-3">
        <div>
          <h4 className="font-black text-base sm:text-lg text-white">{bill.tableNumber}</h4>
          <p className="text-[10px] text-zinc-500 font-mono">Settling invoice #{bill.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl">
            UNPAID
          </span>
          <button
            onClick={() => setSelectedBill(null)}
            className="lg:hidden text-zinc-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Ordered Dishes Itemized List in Settlement Console */}
      <div className="space-y-2 border-b border-zinc-800 pb-4">
        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Ordered Dishes</p>
        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
          {(bill.rawOrder.items || []).map((item) => (
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
          <span>{currencySymbol}{bill.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-zinc-400 text-xs">
          <span>Tax (GST)</span>
          <span>{currencySymbol}{bill.tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-zinc-400 text-xs">
          <span>Service Charge</span>
          <span>{currencySymbol}{bill.serviceCharge.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-white font-black text-base sm:text-lg pt-2 border-t border-zinc-850">
          <span>Total Amount</span>
          <span className="text-emerald-400">{currencySymbol}{bill.total.toFixed(2)}</span>
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
            <span>{currencySymbol}{(bill.total / splitCount).toFixed(2)}</span>
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
        onClick={() => handleSettle(bill.id)}
        className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-black py-3.5 rounded-2xl shadow-xl shadow-emerald-500/20 text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
      >
        <Receipt className="h-4 w-4" />
        Confirm Settle & Download Invoice
      </button>
    </div>
  );

  const renderBillCard = (b: BillTicket) => (
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
          <p className="text-[10px] text-zinc-400 mt-1 font-mono flex items-center gap-1">
            <Clock className="h-3 w-3 text-zinc-500" />
            {formatOrderDateTime(b.rawOrder.createdAt)}
          </p>
        </div>
        {(b.rawOrder as any).requestedBillAt ? (
          <span className="text-[9px] uppercase tracking-wider font-black px-2.5 py-1 rounded-xl border bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse flex items-center gap-1">
            <Bell className="h-3 w-3" /> WAITER BILL REQUEST
          </span>
        ) : (
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
            {b.itemsCount} items
          </span>
        )}
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
  );

  const renderSettledOrderCard = (o: Order) => (
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
          <p className="text-[10px] text-zinc-400 mt-1 font-mono flex items-center gap-1">
            <Clock className="h-3 w-3 text-zinc-500" />
            Settled: {formatOrderDateTime(o.updatedAt || o.createdAt)}
          </p>
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
          View / Download Invoice
        </button>
      </div>
    </div>
  );

  const diningTableBills = pendingBills.filter((b) => {
    const isRoom = b.rawOrder.tableId?.startsWith('room_') || 
                   b.tableNumber?.toLowerCase().includes('room') || 
                   Boolean((b.rawOrder as any).roomNumber) || 
                   Boolean((b.rawOrder as any).roomName);
    return !isRoom;
  });

  const roomBills = pendingBills.filter((b) => {
    const isRoom = b.rawOrder.tableId?.startsWith('room_') || 
                   b.tableNumber?.toLowerCase().includes('room') || 
                   Boolean((b.rawOrder as any).roomNumber) || 
                   Boolean((b.rawOrder as any).roomName);
    return isRoom;
  });

  const settledDiningOrders = sortedSettledOrders.filter((o) => {
    const isRoom = o.tableId?.startsWith('room_') || 
                   o.tableNumber?.toLowerCase().includes('room') || 
                   Boolean((o as any).roomNumber) || 
                   Boolean((o as any).roomName);
    return !isRoom;
  });

  const settledRoomOrders = sortedSettledOrders.filter((o) => {
    const isRoom = o.tableId?.startsWith('room_') || 
                   o.tableNumber?.toLowerCase().includes('room') || 
                   Boolean((o as any).roomNumber) || 
                   Boolean((o as any).roomName);
    return isRoom;
  });

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
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                  <CreditCard className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Pending Settlements</h3>
                  <p className="text-xs text-zinc-500">Unpaid invoices awaiting cashier settlement</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(isMockMode || profile?.role === 'super-admin') && tenantList.length > 0 && (
                  <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-850 px-3.5 py-1.5 rounded-xl">
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
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl">
                  {pendingBills.length} Pending Invoices
                </span>
              </div>
            </div>

            <div className="space-y-6">
              {/* Dining Tables Settlements */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-zinc-900/60 pb-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Dining Tables Settlements ({diningTableBills.length})</span>
                </div>
                {diningTableBills.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {diningTableBills.map((b) => renderBillCard(b))}
                  </div>
                ) : (
                  <div className="border border-dashed border-zinc-850 bg-zinc-950/20 py-8 text-center text-zinc-500 rounded-3xl">
                    <p className="text-xs font-medium text-zinc-500">No pending dining table settlements</p>
                  </div>
                )}
              </div>

              {/* Rooms & Suites Settlements */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-zinc-900/60 pb-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Rooms & Suites Settlements ({roomBills.length})</span>
                </div>
                {roomBills.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {roomBills.map((b) => renderBillCard(b))}
                  </div>
                ) : (
                  <div className="border border-dashed border-zinc-850 bg-zinc-950/20 py-8 text-center text-zinc-500 rounded-3xl">
                    <p className="text-xs font-medium text-zinc-500">No pending room settlements</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Settle Panel Console (Desktop Side Column & Mobile Sheet) */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider hidden lg:block">Settlement Console</h3>

            {/* Desktop View */}
            <div className="hidden lg:block">
              {selectedBill ? (
                renderSettlementForm(selectedBill)
              ) : (
                <div className="border border-dashed border-zinc-850 py-16 text-center text-zinc-500 rounded-3xl">
                  <IndianRupee className="h-8 w-8 mx-auto text-emerald-500/30 mb-3" />
                  <p className="text-xs font-semibold text-zinc-400">Select a pending bill to view settlement console</p>
                </div>
              )}
            </div>

            {/* Mobile Sheet Drawer View */}
            {selectedBill && (
              <div className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
                <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-1 bg-zinc-950 border border-zinc-800 shadow-2xl">
                  {renderSettlementForm(selectedBill)}
                </div>
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

          {sortedSettledOrders.length > 0 ? (
            <div className="space-y-8">
              {/* Settled Dining Tables Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-zinc-900/60 pb-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Dining Tables Settlements ({settledDiningOrders.length})</span>
                </div>
                {settledDiningOrders.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {settledDiningOrders.map((o) => renderSettledOrderCard(o))}
                  </div>
                ) : (
                  <div className="border border-dashed border-zinc-850 bg-zinc-950/20 py-8 text-center text-zinc-500 rounded-3xl">
                    <p className="text-xs font-medium text-zinc-500">No settled dining table invoices yet</p>
                  </div>
                )}
              </div>

              {/* Settled Rooms & Suites Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-zinc-900/60 pb-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Rooms & Suites Settlements ({settledRoomOrders.length})</span>
                </div>
                {settledRoomOrders.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {settledRoomOrders.map((o) => renderSettledOrderCard(o))}
                  </div>
                ) : (
                  <div className="border border-dashed border-zinc-850 bg-zinc-950/20 py-8 text-center text-zinc-500 rounded-3xl">
                    <p className="text-xs font-medium text-zinc-500">No settled room invoices yet</p>
                  </div>
                )}
              </div>
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

            {/* Common Action Buttons: Print & Download */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => window.print()}
                className="py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-black text-xs uppercase rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                <Printer className="h-4 w-4" />
                Print Receipt
              </button>
              <button
                onClick={() => handleDownloadSingleInvoice(receiptModalOrder)}
                className="py-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-200 font-bold text-xs uppercase rounded-xl border border-zinc-800 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Download className="h-4 w-4 text-emerald-400" />
                Download Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
