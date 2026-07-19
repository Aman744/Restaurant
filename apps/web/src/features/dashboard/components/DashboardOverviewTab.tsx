import React from 'react';
import { Link } from 'react-router-dom';
import { ChefHat, CreditCard, Utensils, ArrowRight, Clock, ShoppingBag } from 'lucide-react';
import { RevenueCard } from './RevenueCard';
import { KitchenLoadCard } from './KitchenLoadCard';
import { OccupancyCard } from './OccupancyCard';
import { TodaysOrdersCard } from './TodaysOrdersCard';
import type { Order, Table } from '@restaurant-qr/core';

interface DashboardOverviewTabProps {
  orders?: Order[];
  tables?: Table[];
  currencySymbol?: string;
}

export const DashboardOverviewTab: React.FC<DashboardOverviewTabProps> = ({
  orders = [],
  tables = [],
  currencySymbol = '₹'
}) => {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const safeTables = Array.isArray(tables) ? tables : [];

  const totalRevenue = safeOrders.reduce((sum, o) => sum + (o?.totals?.grandTotal || 0), 0);
  const preparingOrders = safeOrders.filter((o) => o?.status === 'preparing' || o?.status === 'accepted').length;
  const occupiedTables = safeTables.filter((t) => t?.status === 'occupied').length;

  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
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

  const getTimeAgo = (dateStr?: Date | string) => {
    if (!dateStr) return 'Just now';
    const diffMins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ago`;
  };

  return (
    <div className="space-y-6">
      {/* Quick Operational Shortcuts */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-base font-extrabold text-white">Operations Command Center</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Real-time status of dining floor, kitchen queue, and billing</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/kitchen"
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl"
          >
            <ChefHat className="h-3.5 w-3.5 text-orange-400" />
            Kitchen KDS
          </Link>
          <Link
            to="/cashier"
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl"
          >
            <CreditCard className="h-3.5 w-3.5 text-teal-400" />
            Cashier POS
          </Link>
          <Link
            to="/admin/orders"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/10"
          >
            <Utensils className="h-3.5 w-3.5" />
            View All Orders
          </Link>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <RevenueCard totalRevenue={totalRevenue} currencySymbol={currencySymbol} />
        <KitchenLoadCard preparingOrdersCount={preparingOrders} />
        <OccupancyCard occupiedTablesCount={occupiedTables} totalTablesCount={safeTables.length} />
        <TodaysOrdersCard totalOrdersCount={safeOrders.length} />
      </div>

      {/* Live Operational Feed */}
      <div className="border border-zinc-800 bg-zinc-900/40 p-6 rounded-3xl space-y-4">
        <div className="flex justify-between items-center border-b border-zinc-850 pb-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Live Operational Feed</h3>
          </div>
          <Link to="/admin/orders" className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-semibold">
            Manage Orders <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="divide-y divide-zinc-850">
          {safeOrders.slice(0, 6).map((order) => {
            const itemsSummary = (order.items || [])
              .map((i) => `${i.quantity}x ${i.name}`)
              .join(', ');

            return (
              <div key={order.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white text-sm">
                      {order.tableNumber || `Table ${order.tableId}`}
                    </span>
                    <span className="text-zinc-500 font-mono text-[10px]">#{order.id}</span>
                    <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-zinc-600" />
                      {getTimeAgo(order.createdAt)}
                    </span>
                  </div>
                  <p className="text-zinc-400 text-xs truncate max-w-md">
                    {itemsSummary || 'No item details'}
                  </p>
                </div>

                <div className="flex items-center gap-4 justify-between sm:justify-end">
                  <span className="font-black text-emerald-400 text-sm">
                    {currencySymbol}
                    {(order.totals?.grandTotal || 0).toFixed(2)}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold border ${getStatusBadgeClass(order.status)}`}>
                    {order.status || 'pending'}
                  </span>
                </div>
              </div>
            );
          })}

          {safeOrders.length === 0 && (
            <div className="py-12 text-center text-zinc-500 text-xs">
              <ShoppingBag className="h-8 w-8 mx-auto text-zinc-700 mb-2" />
              No live orders in the operational feed.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
