import React from 'react';
import { RevenueCard } from './RevenueCard';
import { KitchenLoadCard } from './KitchenLoadCard';
import { OccupancyCard } from './OccupancyCard';
import type { Order, Table } from '@restaurant-qr/core';

interface DashboardOverviewTabProps {
  orders: Order[];
  tables: Table[];
  currencySymbol?: string;
}

export const DashboardOverviewTab: React.FC<DashboardOverviewTabProps> = ({
  orders,
  tables,
  currencySymbol = '₹'
}) => {
  const totalRevenue = orders.reduce((sum, o) => sum + (o.totals?.grandTotal || 0), 0);
  const preparingOrders = orders.filter((o) => o.status === 'preparing' || o.status === 'accepted').length;
  const occupiedTables = tables.filter((t) => t.status === 'occupied').length;

  return (
    <div className="space-y-6">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <RevenueCard totalRevenue={totalRevenue} currencySymbol={currencySymbol} />
        <KitchenLoadCard preparingOrdersCount={preparingOrders} />
        <OccupancyCard occupiedTablesCount={occupiedTables} totalTablesCount={tables.length} />
      </div>

      {/* Recent Orders Overview */}
      <div className="border border-zinc-800 bg-zinc-900/40 p-6 rounded-3xl space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Live Operational Feed</h3>
        <div className="divide-y divide-zinc-850">
          {orders.slice(0, 5).map((order) => (
            <div key={order.id} className="py-3 flex justify-between items-center text-xs">
              <div>
                <span className="font-bold text-white">{order.tableNumber || `Table ${order.tableId}`}</span>
                <span className="text-zinc-500 ml-2">#{order.id}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-zinc-400 font-semibold">{currencySymbol}{order.totals?.grandTotal.toFixed(2)}</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold bg-zinc-800 text-zinc-300">
                  {order.status}
                </span>
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <p className="py-8 text-center text-zinc-500 text-xs">No active order feed available.</p>
          )}
        </div>
      </div>
    </div>
  );
};
