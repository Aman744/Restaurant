import React, { useState } from 'react';
import { Trash2, Sparkles, Printer, Download, X, LayoutGrid, List } from 'lucide-react';
import type { Order, OrderStatus } from '@restaurant-qr/core';
import { OrderService } from '../../../services/OrderService';
import { useToast } from '../../../components/shared/ToastContext';
import { useOrderStore } from '../../../stores/useOrderStore';
import { useUserProfile } from '../../../features/auth/context/UserContext';
import { useConfirm } from '../../../components/shared/ConfirmContext';
import { useTenant } from '../../../features/auth/context/TenantContext';

import { useOrders } from '../../../hooks/useRealtimeData';

interface OrdersTabProps {
  tenantId: string;
  isMockMode: boolean;
  currencySymbol?: string;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({
  tenantId,
  isMockMode,
  currencySymbol = '₹'
}) => {
  const { orders, loading } = useOrders(tenantId, isMockMode);
  const { ordersFilter, setOrdersFilter } = useOrderStore();
  const { profile } = useUserProfile();
  const { tenant } = useTenant();
  const { confirm } = useConfirm();
  const toast = useToast();

  const [receiptModalOrder, setReceiptModalOrder] = useState<Order | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const isAdmin = profile?.role === 'restaurant-admin' || profile?.role === 'super-admin';
  const safeOrders = Array.isArray(orders) ? orders : [];

  const parseDate = (val: any): Date => {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    if (typeof val.toDate === 'function') return val.toDate();
    if (typeof val.seconds === 'number') return new Date(val.seconds * 1000);
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  // Filter and sort orders so new/pending orders and latest timestamps ALWAYS show on top
  const filteredOrders = safeOrders
    .filter((o) => {
      if (!o) return false;
      if (ordersFilter === 'all') return true;
      if (ordersFilter === 'new') return o.status === 'pending';
      if (ordersFilter === 'pending') return o.status === 'preparing' || o.status === 'accepted';
      if (ordersFilter === 'ready') return o.status === 'ready';
      if (ordersFilter === 'completed') return o.status === 'completed';
      return true;
    })
    .sort((a, b) => {
      // 1. Pending (newly placed) orders first on top
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;

      // 2. Sort by newest creation date
      const timeA = parseDate(a.createdAt).getTime();
      const timeB = parseDate(b.createdAt).getTime();
      return timeB - timeA;
    });

  const liveFiltered = filteredOrders.filter(
    (o) => o.status !== 'completed' && o.status !== 'archived'
  );
  const completedFiltered = filteredOrders.filter(
    (o) => o.status === 'completed' || o.status === 'archived'
  );

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await OrderService.updateOrderStatus(tenantId, orderId, newStatus, isMockMode);
      toast.success(`Order #${orderId} status updated to "${newStatus}".`);
    } catch (e: any) {
      toast.error(`Status update failed: ${e.message}`);
    }
  };

  const handleDeleteOrder = (order: Order) => {
    confirm({
      title: 'Delete Order?',
      message: `Are you sure you want to permanently delete Order #${order.id}? This action cannot be undone.`,
      confirmText: 'Delete Order',
      onConfirm: async () => {
        try {
          await OrderService.deleteOrder(tenantId, order.id, isMockMode);
          toast.success(`Deleted Order #${order.id}.`);
        } catch (err: any) {
          toast.error(`Failed to delete order: ${err.message}`);
        }
      }
    });
  };

  const formatOrderDateTime = (dateVal: any): string => {
    const d = parseDate(dateVal);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

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

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse';
      case 'accepted':
      case 'preparing':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'ready':
      case 'served':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'completed':
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  const renderOrderGridCard = (order: Order) => {
    const isPendingNew = order.status === 'pending';

    return (
      <div
        key={order.id}
        className={`border bg-zinc-900/40 p-5 rounded-3xl space-y-4 flex flex-col justify-between transition shadow-xl ${
          isPendingNew
            ? 'border-amber-500/40 bg-gradient-to-b from-amber-950/20 to-zinc-950/80 shadow-amber-500/5'
            : 'border-zinc-800 hover:border-zinc-700'
        }`}
      >
        <div>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-white text-base">
                  {order.tableNumber || `Table ${order.tableId}`}
                </h4>
                {isPendingNew && (
                  <span className="flex items-center gap-0.5 text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40 shadow-sm">
                    <Sparkles className="h-2.5 w-2.5" />
                    NEW
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                ID: #{order.id} • {(() => {
                  const d = parseDate(order.createdAt);
                  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                })()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border ${getStatusBadgeStyle(order.status)}`}>
                {order.status || 'pending'}
              </span>
              {isAdmin && (
                <button
                  onClick={() => handleDeleteOrder(order)}
                  className="p-1.5 border border-zinc-800 hover:border-red-500/30 text-zinc-400 hover:text-red-400 rounded-xl transition"
                  title="Delete Order (Admin Only)"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Items List Breakdown */}
          <div className="mt-4 space-y-2 border-y border-zinc-850 py-3">
            {(order.items || []).length > 0 ? (
              (order.items || []).map((item, idx) => (
                <div key={idx} className="space-y-0.5 text-xs">
                  <div className="flex justify-between text-zinc-200">
                    <span className="flex items-center gap-1.5">
                      <span className="text-emerald-400 font-extrabold">{item.quantity}x</span>
                      <span className="font-semibold">{item.name}</span>
                    </span>
                    <span className="font-mono text-zinc-300 font-bold">
                      {currencySymbol}{(item.totalPrice || item.unitPrice * item.quantity || 0).toFixed(2)}
                    </span>
                  </div>
                  {item.selectedVariant && (
                    <p className="text-[10px] text-zinc-500 pl-4">Opt: {item.selectedVariant.name}</p>
                  )}
                  {item.notes && (
                    <p className="text-[10px] text-amber-400/90 italic pl-4">"{item.notes}"</p>
                  )}
                </div>
              ))
            ) : (
              <div className="flex justify-between text-xs text-zinc-200">
                <span className="flex items-center gap-1.5">
                  <span className="text-emerald-400 font-extrabold">1x</span>
                  <span className="font-semibold">Chef's Special Order Dish</span>
                </span>
                <span className="font-mono text-zinc-300 font-bold">
                  {currencySymbol}{(order.totals?.grandTotal || 0).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex justify-between items-center text-sm font-black text-white">
            <span>Grand Total:</span>
            <span className="text-emerald-400 text-base">{currencySymbol}{(order.totals?.grandTotal || 0).toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={order.status}
              onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
              className="bg-zinc-950 border border-zinc-800 text-xs px-3 py-2 rounded-xl text-zinc-200 focus:outline-none focus:border-emerald-500/40"
            >
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="served">Served</option>
              <option value="completed">Completed</option>
            </select>

            <button
              onClick={() => setReceiptModalOrder(order)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-200 text-xs font-bold rounded-xl border border-zinc-750 transition cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-emerald-400" />
              Invoice
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderOrdersList = (ordersList: Order[]) => {
    return (
      <div className="border border-zinc-900 bg-zinc-950/20 rounded-3xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-zinc-900 text-zinc-500 text-xs font-bold uppercase tracking-wider bg-zinc-950/40">
              <th className="px-6 py-4">Order Details</th>
              <th className="px-6 py-4">Ordered Items</th>
              <th className="px-6 py-4">Total Amount</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900/60 text-sm">
            {ordersList.map((order) => {
              const isPendingNew = order.status === 'pending';
              return (
                <tr
                  key={order.id}
                  className={`hover:bg-zinc-900/10 transition ${
                    isPendingNew ? 'bg-amber-500/5' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        {order.tableNumber || `Table ${order.tableId}`}
                      </span>
                      {isPendingNew && (
                        <span className="text-[8px] font-black uppercase bg-amber-500/25 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/40 animate-pulse">
                          NEW
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      #{order.id} • {(() => {
                        const d = parseDate(order.createdAt);
                        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      })()}
                    </div>
                    {order.customerName && (
                      <div className="text-xs text-zinc-400 mt-1">Guest: {order.customerName}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    <div className="space-y-1">
                      {(order.items || []).map((item, idx) => (
                        <div key={idx} className="text-xs text-zinc-300 flex items-start gap-1">
                          <span className="text-emerald-400 font-extrabold">{item.quantity}x</span>
                          <span>
                            {item.name}
                            {item.notes && <span className="text-amber-400 italic text-[10px] ml-1">"{item.notes}"</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-emerald-400 font-mono font-bold text-sm">
                    {currencySymbol}{(order.totals?.grandTotal || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border ${getStatusBadgeStyle(order.status)}`}>
                      {order.status || 'pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                        className="bg-zinc-950 border border-zinc-800 text-xs px-2.5 py-1.5 rounded-xl text-zinc-200 focus:outline-none focus:border-emerald-500/40 mr-1"
                      >
                        <option value="pending">Pending</option>
                        <option value="accepted">Accepted</option>
                        <option value="preparing">Preparing</option>
                        <option value="ready">Ready</option>
                        <option value="served">Served</option>
                        <option value="completed">Completed</option>
                      </select>

                      <button
                        onClick={() => setReceiptModalOrder(order)}
                        className="p-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-200 border border-zinc-800 transition rounded-xl"
                        title="View / Print Receipt"
                      >
                        <Printer className="h-3.5 w-3.5 text-emerald-400" />
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteOrder(order)}
                          className="p-2 border border-zinc-800 hover:border-red-500/30 text-zinc-400 hover:text-red-400 rounded-xl transition"
                          title="Delete Order (Admin Only)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
          <p className="text-xs font-semibold">Loading orders feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Filter Tabs */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h3 className="text-base font-extrabold text-white">Live Orders Management</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Real-time table orders feed sorted with newest orders on top</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto xl:justify-end">
          {/* View Mode Toggle */}
          <div className="flex items-center border border-zinc-800 bg-zinc-900/40 rounded-xl p-1 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid'
                  ? 'bg-zinc-800 text-emerald-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'list'
                  ? 'bg-zinc-800 text-emerald-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="List View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          {/* Filter Options Tabs */}
          <div className="flex gap-1.5 overflow-x-auto py-0.5">
            {(['all', 'new', 'pending', 'ready', 'completed'] as const).map((filter) => {
              const count = safeOrders.filter((o) =>
                filter === 'all'
                  ? true
                  : filter === 'new'
                  ? o.status === 'pending'
                  : filter === 'pending'
                  ? o.status === 'preparing' || o.status === 'accepted'
                  : o.status === filter
              ).length;

              return (
                <button
                  key={filter}
                  onClick={() => setOrdersFilter(filter)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition border ${
                    ordersFilter === filter
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {filter} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live Orders Section */}
      {(ordersFilter === 'all' || ordersFilter === 'new' || ordersFilter === 'pending' || ordersFilter === 'ready') && (
        <div className="space-y-4">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            Live Orders Feed ({liveFiltered.length})
          </h4>
          {liveFiltered.length === 0 ? (
            <div className="border border-zinc-900 bg-zinc-950/20 py-12 text-center text-zinc-500 rounded-3xl text-xs">
              No active orders in the live queue.
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveFiltered.map((order) => renderOrderGridCard(order))}
            </div>
          ) : (
            renderOrdersList(liveFiltered)
          )}
        </div>
      )}

      {/* Completed Orders Section */}
      {(ordersFilter === 'all' || ordersFilter === 'completed') && (
        <div className="space-y-4 pt-6 border-t border-zinc-900">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
            Completed Orders History ({completedFiltered.length})
          </h4>
          {completedFiltered.length === 0 ? (
            <div className="border border-zinc-900 bg-zinc-950/20 py-12 text-center text-zinc-500 rounded-3xl text-xs">
              No completed or settled orders found.
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {completedFiltered.map((order) => renderOrderGridCard(order))}
            </div>
          ) : (
            renderOrdersList(completedFiltered)
          )}
        </div>
      )}

      {/* Common Official Tax Invoice Receipt Modal */}
      {receiptModalOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-zinc-950 border border-zinc-800 text-zinc-100 max-w-sm w-full rounded-3xl p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setReceiptModalOrder(null)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-white p-1.5 rounded-full hover:bg-zinc-900 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Thermal Receipt Visual Paper Card */}
            <div className="bg-white text-black p-6 rounded-2xl shadow-inner font-mono text-xs space-y-4">
              <div className="text-center space-y-1 border-b border-dashed border-gray-400 pb-3">
                <h3 className="font-black text-sm uppercase tracking-wide">{tenant?.name || 'RESTAURANT POS'}</h3>
                <p className="text-[10px] text-gray-600 font-bold uppercase">OFFICIAL TAX INVOICE & RECEIPT</p>
                <p className="text-[10px] text-gray-500">Invoice: #{receiptModalOrder.id}</p>
                <p className="text-[10px] text-gray-500">Date/Time: {formatOrderDateTime(receiptModalOrder.updatedAt || receiptModalOrder.createdAt)}</p>
                <p className="text-[10px] text-gray-500">Table: {receiptModalOrder.tableNumber || `Table ${receiptModalOrder.tableId || '1'}`}</p>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 border-b border-dashed border-gray-400 pb-3 text-[11px]">
                <div className="flex justify-between font-bold border-b border-gray-200 pb-1 text-[10px]">
                  <span>ITEM</span>
                  <span>QTY x PRICE</span>
                  <span>TOTAL</span>
                </div>
                {(receiptModalOrder.items || []).map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span className="font-medium max-w-[110px] truncate">{item.name}</span>
                    <span>{item.quantity} x {currencySymbol}{item.unitPrice.toFixed(2)}</span>
                    <span className="font-bold">{currencySymbol}{(item.totalPrice || item.unitPrice * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Financial Totals */}
              <div className="space-y-1 border-b border-dashed border-gray-400 pb-3 text-[11px]">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal:</span>
                  <span>{currencySymbol}{(receiptModalOrder.totals?.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>GST Tax (5%):</span>
                  <span>{currencySymbol}{(receiptModalOrder.totals?.tax || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Service Charge:</span>
                  <span>{currencySymbol}{(receiptModalOrder.totals?.serviceCharge || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-sm text-black pt-1.5 border-t border-gray-300">
                  <span>GRAND TOTAL:</span>
                  <span>{currencySymbol}{(receiptModalOrder.totals?.grandTotal || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Footer Note */}
              <div className="text-center text-[10px] text-gray-600 space-y-1 pt-1">
                <p className="font-bold text-black uppercase">PAID VIA {(receiptModalOrder.payment?.method || 'CASH').toUpperCase()}</p>
                <p>Status: PAID & SETTLED</p>
                <p className="pt-1 italic font-semibold">Thank you for dining with us!</p>
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
    </div>
  );
};
