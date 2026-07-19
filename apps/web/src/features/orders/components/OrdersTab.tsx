import React from 'react';
import type { Order, OrderStatus } from '@restaurant-qr/core';
import { OrderService } from '../../../services/OrderService';
import { ReceiptPrinter } from '../../../utils/ReceiptPrinter';
import { useToast } from '../../../components/shared/ToastContext';
import { useOrderStore } from '../../../stores/useOrderStore';

interface OrdersTabProps {
  tenantId: string;
  orders: Order[];
  isMockMode: boolean;
  currencySymbol?: string;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({
  tenantId,
  orders,
  isMockMode,
  currencySymbol = '₹'
}) => {
  const { ordersFilter, setOrdersFilter } = useOrderStore();
  const toast = useToast();

  const filteredOrders = orders.filter((o) => {
    if (ordersFilter === 'all') return true;
    if (ordersFilter === 'new') return o.status === 'pending';
    if (ordersFilter === 'pending') return o.status === 'preparing' || o.status === 'accepted';
    if (ordersFilter === 'ready') return o.status === 'ready';
    if (ordersFilter === 'completed') return o.status === 'completed';
    return true;
  });

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await OrderService.updateOrderStatus(tenantId, orderId, newStatus, isMockMode);
      toast.success(`Order #${orderId} status updated to "${newStatus}".`);
    } catch (e: any) {
      toast.error(`Status update failed: ${e.message}`);
    }
  };

  const handlePrintReceipt = (order: Order) => {
    ReceiptPrinter.printReceipt(order);
  };

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-3 overflow-x-auto">
        {(['all', 'new', 'pending', 'ready', 'completed'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setOrdersFilter(filter)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
              ordersFilter === filter
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {filter} ({orders.filter((o) => filter === 'all' ? true : filter === 'new' ? o.status === 'pending' : filter === 'pending' ? (o.status === 'preparing' || o.status === 'accepted') : o.status === filter).length})
          </button>
        ))}
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOrders.map((order) => (
          <div key={order.id} className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-2xl space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-white text-base">{order.tableNumber || `Table ${order.tableId}`}</h4>
                  <p className="text-[10px] text-zinc-500">Order ID: #{order.id}</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold bg-zinc-800 text-zinc-300">
                  {order.status}
                </span>
              </div>

              <div className="mt-4 space-y-2 border-y border-zinc-800/80 py-3">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-zinc-300">
                    <span>{item.name} x{item.quantity}</span>
                    <span className="font-semibold">{currencySymbol}{item.totalPrice.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center text-sm font-bold text-white">
                <span>Total Amount:</span>
                <span className="text-emerald-400">{currencySymbol}{order.totals?.grandTotal.toFixed(2)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={order.status}
                  onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                  className="bg-zinc-950 border border-zinc-800 text-xs px-2 py-2 rounded-xl text-zinc-300 focus:outline-none"
                >
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="preparing">Preparing</option>
                  <option value="ready">Ready</option>
                  <option value="served">Served</option>
                  <option value="completed">Completed</option>
                </select>

                <button
                  onClick={() => handlePrintReceipt(order)}
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl"
                >
                  Print Receipt
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredOrders.length === 0 && (
          <div className="col-span-full border border-zinc-900 bg-zinc-950 py-16 text-center text-zinc-500 rounded-3xl">
            No orders match the selected filter.
          </div>
        )}
      </div>
    </div>
  );
};
