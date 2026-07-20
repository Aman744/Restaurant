import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/shared/DashboardLayout';
import { CreditCard, Receipt, Printer, X, Clock, Search, Filter, IndianRupee, ArrowUpRight, LayoutGrid, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../features/auth/context/AuthContext.js';
import { useTenant } from '../../features/auth/context/TenantContext.js';
import { db } from '../../lib/firebase.js';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import type { Order } from '@restaurant-qr/core';

const MOCK_ORDERS_KEY = 'restaurant_qr_mock_orders_db';

export const InvoicesHistoryPage: React.FC = () => {
  const { isMockMode } = useAuth();
  const { tenant } = useTenant();

  const tenantId = tenant?.id || 'tenant_dev_123';
  const currencySymbol = '₹';

  const [settledOrders, setSettledOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<string>('all');
  const [receiptModalOrder, setReceiptModalOrder] = useState<Order | null>(null);

  // View Mode & Pagination state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(6);

  const sidebarItems = [
    { name: 'Settlement Console', path: '/cashier', icon: CreditCard },
    { name: 'Invoices History', path: '/cashier/invoices', icon: Receipt },
  ];

  useEffect(() => {
    let active = true;

    if (isMockMode) {
      const syncMockOrders = () => {
        const stored = localStorage.getItem(MOCK_ORDERS_KEY);
        if (stored) {
          try {
            const parsed: Order[] = JSON.parse(stored);
            const paidOrders = parsed.filter(
              (o: any) => o.payment?.status === 'paid' || o.status === 'completed'
            );
            if (active) {
              setSettledOrders(paidOrders);
              setLoading(false);
            }
          } catch (e) {}
        } else {
          if (active) {
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
      const unsubscribe = onSnapshot(colRef, async (snap) => {
        const paidOrders: Order[] = [];

        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          const toDate = (val: any): Date => {
            if (!val) return new Date();
            if (typeof val.toDate === 'function') return val.toDate();
            return new Date(val);
          };

          let items = Array.isArray(data.items) && data.items.length > 0 ? data.items : [];
          if (items.length === 0) {
            try {
              const itemsCol = collection(db, 'tenants', tenantId, 'orders', docSnap.id, 'order_items');
              const itemsSnap = await getDocs(itemsCol);
              items = itemsSnap.docs.map((it: any) => ({ id: it.id, ...it.data() }));
            } catch (err) {}
          }

          if (items.length === 0) {
            items = [{
              id: `item_fb_${docSnap.id}`,
              menuItemId: 'item_01',
              name: 'Chef Special Order Dish',
              quantity: 1,
              unitPrice: data.totals?.grandTotal || 50,
              totalPrice: data.totals?.grandTotal || 50,
              stationId: 'main',
              status: 'ready'
            }];
          }

          const orderObj = {
            id: docSnap.id,
            ...data,
            items,
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt)
          } as Order;

          if (data.payment?.status === 'paid' || data.status === 'completed') {
            paidOrders.push(orderObj);
          }
        }

        if (active) {
          setSettledOrders(paidOrders);
          setLoading(false);
        }
      }, (err) => {
        console.error('Invoices subscription failed:', err);
        if (active) setLoading(false);
      });

      return () => {
        active = false;
        unsubscribe();
      };
    }
  }, [tenantId, isMockMode]);

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

  // Calculations & Analytics
  const totalSettledRevenue = settledOrders.reduce((sum, o) => sum + (o.totals?.grandTotal || 0), 0);
  const totalInvoicesCount = settledOrders.length;
  const avgOrderValue = totalInvoicesCount > 0 ? totalSettledRevenue / totalInvoicesCount : 0;

  const cashTotal = settledOrders
    .filter((o) => (o.payment?.method || 'cash').toLowerCase() === 'cash')
    .reduce((sum, o) => sum + (o.totals?.grandTotal || 0), 0);

  const cardTotal = settledOrders
    .filter((o) => (o.payment?.method || '').toLowerCase() === 'card')
    .reduce((sum, o) => sum + (o.totals?.grandTotal || 0), 0);

  const upiTotal = settledOrders
    .filter((o) => (o.payment?.method || '').toLowerCase() === 'upi')
    .reduce((sum, o) => sum + (o.totals?.grandTotal || 0), 0);

  // Filtered & Sorted Invoices List
  const filteredInvoices = settledOrders
    .filter((o) => {
      const modeMatches =
        selectedPaymentFilter === 'all' ||
        (o.payment?.method || 'cash').toLowerCase() === selectedPaymentFilter.toLowerCase();

      if (!modeMatches) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = o.id.toLowerCase().includes(q);
        const matchesTable = (o.tableNumber || '').toLowerCase().includes(q);
        const matchesCustomer = (o.customerName || '').toLowerCase().includes(q);
        return matchesId || matchesTable || matchesCustomer;
      }
      return true;
    })
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());

  // Pagination calculation
  const totalPages = Math.ceil(filteredInvoices.length / pageSize) || 1;
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const paginatedInvoices = filteredInvoices.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedPaymentFilter]);

  if (loading) {
    return (
      <DashboardLayout title="Settled Invoices History" sidebarItems={sidebarItems}>
        <div className="flex h-64 items-center justify-center text-zinc-400">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
            <p className="text-xs font-semibold">Loading settled invoices database...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Settled Invoices History" sidebarItems={sidebarItems}>
      <div className="space-y-8 animate-fadeIn">
        {/* Top Analytics KPI Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-zinc-850 bg-zinc-900/60 p-5 rounded-3xl space-y-2 shadow-lg">
            <div className="flex justify-between items-center text-zinc-400">
              <span className="text-xs font-bold uppercase tracking-wider">Total Revenue</span>
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <IndianRupee className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-white">{currencySymbol}{totalSettledRevenue.toFixed(2)}</p>
            <p className="text-[10px] text-zinc-500 font-mono">From {totalInvoicesCount} settled invoices</p>
          </div>

          <div className="border border-zinc-850 bg-zinc-900/60 p-5 rounded-3xl space-y-2 shadow-lg">
            <div className="flex justify-between items-center text-zinc-400">
              <span className="text-xs font-bold uppercase tracking-wider">Average Order Value</span>
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-white">{currencySymbol}{avgOrderValue.toFixed(2)}</p>
            <p className="text-[10px] text-zinc-500 font-mono">Average spend per table</p>
          </div>

          <div className="border border-zinc-850 bg-zinc-900/60 p-5 rounded-3xl space-y-2 shadow-lg">
            <div className="flex justify-between items-center text-zinc-400">
              <span className="text-xs font-bold uppercase tracking-wider">Payment Breakdown</span>
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono pt-1">
              <span className="text-emerald-400 font-bold">Cash: {currencySymbol}{cashTotal.toFixed(0)}</span>
              <span className="text-zinc-600">•</span>
              <span className="text-blue-400 font-bold">UPI: {currencySymbol}{upiTotal.toFixed(0)}</span>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono">Card: {currencySymbol}{cardTotal.toFixed(0)}</p>
          </div>

          <div className="border border-zinc-850 bg-zinc-900/60 p-5 rounded-3xl space-y-2 shadow-lg">
            <div className="flex justify-between items-center text-zinc-400">
              <span className="text-xs font-bold uppercase tracking-wider">Settled Receipts</span>
              <div className="p-2 bg-violet-500/10 text-violet-400 rounded-xl">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-white">{totalInvoicesCount}</p>
            <p className="text-[10px] text-zinc-500 font-mono">Completed dining sessions</p>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 border-y border-zinc-900 py-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by invoice ID (#ord_123), Table number, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/40"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <Filter className="h-4 w-4 text-zinc-500" />
              {['all', 'cash', 'card', 'upi'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSelectedPaymentFilter(mode)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition border cursor-pointer ${
                    selectedPaymentFilter === mode
                      ? 'bg-emerald-500 text-black border-emerald-600 shadow-md shadow-emerald-500/20'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* View Mode Toggle & Page Size Selector */}
            <div className="flex items-center gap-2 border-l border-zinc-850 pl-3">
              <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-emerald-500 text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-emerald-500 text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="List View"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>

              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 font-bold focus:outline-none focus:border-emerald-500/40 cursor-pointer"
              >
                <option value={6}>6 per page</option>
                <option value={12}>12 per page</option>
                <option value={24}>24 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>
          </div>
        </div>

        {/* Invoices Display Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
              Settled Invoices ({filteredInvoices.length})
            </h3>
            <span className="text-xs text-zinc-500 font-mono">Sorted chronologically (Newest first)</span>
          </div>

          {filteredInvoices.length > 0 ? (
            <>
              {/* GRID VIEW */}
              {viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedInvoices.map((o) => (
                    <div
                      key={`inv_${o.id}`}
                      className="border border-zinc-850 bg-zinc-900/60 p-5 rounded-3xl space-y-4 hover:border-zinc-700 transition shadow-xl flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start border-b border-zinc-800 pb-3">
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
                          <span className="text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                            PAID ({o.payment?.method || 'CASH'})
                          </span>
                        </div>

                        {/* Itemized Dishes List */}
                        <div className="space-y-1 text-xs border-b border-zinc-850 pb-3 max-h-36 overflow-y-auto pr-1">
                          {(o.items || []).map((item) => (
                            <div key={item.id} className="flex justify-between items-center text-zinc-300">
                              <span className="font-semibold">{item.quantity}x {item.name}</span>
                              <span className="text-[10px] font-bold text-zinc-400">
                                {currencySymbol}{(item.totalPrice || item.unitPrice * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-1 text-xs text-zinc-400 pt-1">
                          <div className="flex justify-between text-[11px]">
                            <span>Subtotal:</span>
                            <span>{currencySymbol}{(o.totals?.subtotal || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span>GST Tax:</span>
                            <span>{currencySymbol}{(o.totals?.tax || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-extrabold text-sm text-white pt-2 border-t border-zinc-850">
                            <span>Grand Total:</span>
                            <span className="text-emerald-400">{currencySymbol}{(o.totals?.grandTotal || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-zinc-850">
                        <button
                          onClick={() => setReceiptModalOrder(o)}
                          className="w-full py-2.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-200 font-bold text-xs uppercase tracking-wider rounded-xl border border-zinc-750 transition cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Printer className="h-4 w-4 text-emerald-400" />
                          Thermal Tax Receipt
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* LIST VIEW (TABULAR) */}
              {viewMode === 'list' && (
                <div className="border border-zinc-850 bg-zinc-900/40 rounded-3xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-zinc-300">
                      <thead className="bg-zinc-900 text-zinc-400 font-extrabold uppercase tracking-wider text-[10px] border-b border-zinc-800">
                        <tr>
                          <th className="px-5 py-4">Invoice / Table</th>
                          <th className="px-5 py-4">Customer</th>
                          <th className="px-5 py-4">Date & Time</th>
                          <th className="px-5 py-4">Dishes Summary</th>
                          <th className="px-5 py-4">Payment Method</th>
                          <th className="px-5 py-4">Grand Total</th>
                          <th className="px-5 py-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-850">
                        {paginatedInvoices.map((o) => (
                          <tr key={`row_${o.id}`} className="hover:bg-zinc-850/50 transition">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold bg-zinc-800 text-white px-2.5 py-1 rounded-xl text-xs">
                                  {o.tableNumber || `Table ${o.tableId || '1'}`}
                                </span>
                                <span className="font-mono font-bold text-zinc-300">#{o.id.slice(-6).toUpperCase()}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4 font-semibold text-zinc-200">
                              {o.customerName || 'Guest Customer'}
                            </td>
                            <td className="px-5 py-4 font-mono text-[11px] text-zinc-400">
                              {formatOrderDateTime(o.updatedAt || o.createdAt)}
                            </td>
                            <td className="px-5 py-4 text-zinc-300 max-w-xs">
                              <span className="line-clamp-1 font-medium">
                                {(o.items || []).map((it) => `${it.quantity}x ${it.name}`).join(', ') || 'Standard Dishes'}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <span className="text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                                PAID ({(o.payment?.method || 'CASH').toUpperCase()})
                              </span>
                            </td>
                            <td className="px-5 py-4 font-black text-sm text-emerald-400 font-mono">
                              {currencySymbol}{(o.totals?.grandTotal || 0).toFixed(2)}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <button
                                onClick={() => setReceiptModalOrder(o)}
                                className="py-1.5 px-3 bg-zinc-850 hover:bg-zinc-800 text-zinc-200 font-bold text-[10px] uppercase rounded-xl border border-zinc-750 transition cursor-pointer inline-flex items-center gap-1.5"
                              >
                                <Printer className="h-3.5 w-3.5 text-emerald-400" />
                                Receipt
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* PAGINATION FOOTER */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-zinc-900 pt-5">
                <p className="text-xs text-zinc-400 font-mono">
                  Showing <strong className="text-white">{startIndex + 1}</strong> -{' '}
                  <strong className="text-white">{Math.min(startIndex + pageSize, filteredInvoices.length)}</strong> of{' '}
                  <strong className="text-emerald-400">{filteredInvoices.length}</strong> settled invoices
                </p>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, validCurrentPage - 1))}
                    disabled={validCurrentPage === 1}
                    className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-850 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                    title="Previous Page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                    <button
                      key={pg}
                      onClick={() => setCurrentPage(pg)}
                      className={`h-8 w-8 rounded-xl font-bold text-xs transition cursor-pointer ${
                        validCurrentPage === pg
                          ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                          : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-850 hover:text-white border border-zinc-800'
                      }`}
                    >
                      {pg}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, validCurrentPage + 1))}
                    disabled={validCurrentPage === totalPages}
                    className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-850 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                    title="Next Page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="border border-dashed border-zinc-850 py-16 text-center text-zinc-500 rounded-3xl">
              <Receipt className="h-10 w-10 mx-auto text-emerald-500/20 mb-3" />
              <p className="text-sm font-semibold text-zinc-400">No settled invoices match your filter criteria</p>
              <p className="text-xs text-zinc-600 mt-1">Settled orders from cashier will automatically populate this history table</p>
            </div>
          )}
        </div>
      </div>

      {/* Thermal Tax Receipt Modal */}
      {receiptModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-white text-black p-6 rounded-2xl shadow-2xl space-y-4 font-mono text-xs relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setReceiptModalOrder(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="text-center space-y-1 border-b border-dashed border-gray-300 pb-4">
              <h2 className="text-base font-black uppercase tracking-wider">{tenant?.name || 'Restaurant POS'}</h2>
              <p className="text-[10px] text-gray-600">TAX INVOICE & CASH RECEIPT</p>
              <p className="text-[10px] text-gray-500">Invoice: #{receiptModalOrder.id}</p>
              <p className="text-[10px] text-gray-500">Date/Time: {formatOrderDateTime(receiptModalOrder.updatedAt || receiptModalOrder.createdAt)}</p>
              <p className="text-[10px] text-gray-500">Table: {receiptModalOrder.tableNumber || `Table ${receiptModalOrder.tableId || '1'}`}</p>
            </div>

            <div className="space-y-2 border-b border-dashed border-gray-300 pb-4">
              <div className="flex justify-between font-bold text-[11px] border-b border-gray-200 pb-1">
                <span>ITEM</span>
                <span>QTY x PRICE</span>
                <span>TOTAL</span>
              </div>
              {(receiptModalOrder.items || []).map((item) => (
                <div key={item.id} className="flex justify-between text-[11px]">
                  <span className="font-medium">{item.name}</span>
                  <span>{item.quantity} x {currencySymbol}{item.unitPrice.toFixed(2)}</span>
                  <span className="font-bold">{currencySymbol}{(item.totalPrice || item.unitPrice * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-right text-[11px] border-b border-dashed border-gray-300 pb-4">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{currencySymbol}{(receiptModalOrder.totals?.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST Tax (5%):</span>
                <span>{currencySymbol}{(receiptModalOrder.totals?.tax || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Service Charge:</span>
                <span>{currencySymbol}{(receiptModalOrder.totals?.serviceCharge || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-black text-sm pt-2 border-t border-gray-200">
                <span>GRAND TOTAL:</span>
                <span>{currencySymbol}{(receiptModalOrder.totals?.grandTotal || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="text-center text-[10px] text-gray-600 space-y-1 pt-2">
              <p className="font-bold">Payment Method: {(receiptModalOrder.payment?.method || 'CASH').toUpperCase()}</p>
              <p>Status: PAID & SETTLED</p>
              <p className="pt-2 italic">*** Thank You For Dining With Us! ***</p>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-black text-white font-bold text-xs rounded-xl hover:bg-gray-800 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
