import React from 'react';
import { Link } from 'react-router-dom';
import { ChefHat, CreditCard, Utensils, ArrowRight } from 'lucide-react';
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
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Live Operational Feed</h3>
          <Link to="/admin/orders" className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-semibold">
            Manage Orders <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="divide-y divide-zinc-850">
          {safeOrders.slice(0, 5).map((order) => (
            <div key={order.id} className="py-3 flex justify-between items-center text-xs">
              <div>
                <span className="font-bold text-white">{order.tableNumber || `Table ${order.tableId}`}</span>
                <span className="text-zinc-500 ml-2">#{order.id}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-zinc-400 font-semibold">{currencySymbol}{(order.totals?.grandTotal || 0).toFixed(2)}</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold bg-zinc-800 text-zinc-300">
                  {order.status || 'pending'}
                </span>
              </div>
            </div>
          ))}

          {safeOrders.length === 0 && (
            <p className="py-8 text-center text-zinc-500 text-xs">No active order feed available.</p>
          )}
        </div>
      </div>
    </div>
  );
};
