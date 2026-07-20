import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChefHat, CreditCard, Utensils, ArrowRight, Clock, ShoppingBag, LayoutGrid, List, Sparkles } from 'lucide-react';
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
  const [feedViewMode, setFeedViewMode] = useState<'grid' | 'list'>('grid');

  const safeOrders = Array.isArray(orders) ? orders : [];
  const safeTables = Array.isArray(tables) ? tables : [];

  const parseDate = (val: any): Date => {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    if (typeof val.toDate === 'function') return val.toDate();
    if (typeof val.seconds === 'number') return new Date(val.seconds * 1000);
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  // Filter feed to show active new/ongoing orders sorted with newest pending orders FIRST
  const activeLiveOrders = useMemo(() => {
    return safeOrders
      .filter((o) => o?.status && o.status !== 'completed' && o.status !== 'archived')
      .sort((a, b) => {
        // 1. Pending (newly placed) orders first
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        // 2. Sort by newest created timestamp
        const timeA = parseDate(a.createdAt).getTime();
        const timeB = parseDate(b.createdAt).getTime();
        return timeB - timeA;
      });
  }, [safeOrders]);

  const totalRevenue = safeOrders.reduce((sum, o) => sum + (o?.totals?.grandTotal || 0), 0);
  const preparingOrders = safeOrders.filter((o) => o?.status === 'preparing' || o?.status === 'accepted').length;
  const occupiedTables = safeTables.filter((t) => t?.status === 'occupied').length;

  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse';
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

  const getTimeAgo = (dateVal?: any) => {
    const d = parseDate(dateVal);
    const timeString = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const diffMins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMins < 0 || diffMins < 1) return `Just now • ${timeString}`;
    if (diffMins < 60) return `${diffMins}m ago • ${timeString}`;
    const hours = Math.floor(diffMins / 60);
    if (hours < 24) return `${hours}h ago • ${timeString}`;
    return `${d.toLocaleDateString()} • ${timeString}`;
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
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl transition"
          >
            <ChefHat className="h-3.5 w-3.5 text-orange-400" />
            Kitchen KDS
          </Link>
          <Link
            to="/cashier"
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl transition"
          >
            <CreditCard className="h-3.5 w-3.5 text-teal-400" />
            Cashier POS
          </Link>
          <Link
            to="/admin/orders"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/10 transition"
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

      {/* Live Operational Feed Container */}
      <div className="border border-zinc-800 bg-zinc-900/40 p-6 rounded-3xl space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-850 pb-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Live Operational Feed</h3>
            <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              {activeLiveOrders.length} New & Active
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Grid vs List View Mode Selector */}
            <div className="flex items-center p-1 bg-zinc-950 border border-zinc-800 rounded-xl">
              <button
                onClick={() => setFeedViewMode('grid')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  feedViewMode === 'grid'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Grid
              </button>
              <button
                onClick={() => setFeedViewMode('list')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  feedViewMode === 'list'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="List View"
              >
                <List className="h-3.5 w-3.5" />
                List
              </button>
            </div>

            <Link to="/admin/orders" className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-semibold">
              Manage Orders <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* 4-Column Grid View Layout for Live Operational Feed (1 Row 4 Cols) */}
        {feedViewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {activeLiveOrders.slice(0, 8).map((order) => {
              const itemsList = order.items || [];
              const isPendingNew = order.status === 'pending';

              return (
                <div
                  key={order.id}
                  className={`border bg-zinc-950/80 p-4 rounded-2xl flex flex-col justify-between space-y-4 transition shadow-lg group relative ${
                    isPendingNew
                      ? 'border-amber-500/40 shadow-amber-500/5'
                      : 'border-zinc-800 hover:border-emerald-500/40'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-white text-base block group-hover:text-emerald-400 transition">
                            {order.tableNumber || `Table ${order.tableId}`}
                          </span>
                          {isPendingNew && (
                            <span className="flex items-center gap-0.5 text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                              <Sparkles className="h-2.5 w-2.5" />
                              NEW
                            </span>
                          )}
                        </div>
                        <span className="text-zinc-500 font-mono text-[10px]">ID: #{order.id.slice(0, 8)}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-extrabold border ${getStatusBadgeClass(order.status)}`}>
                        {order.status || 'pending'}
                      </span>
                    </div>

                    {/* Items List */}
                    <div className="bg-zinc-900/60 border border-zinc-850 p-3 rounded-xl space-y-1.5 text-xs">
                      {itemsList.length > 0 ? (
                        itemsList.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="flex justify-between text-zinc-300 items-center">
                            <span className="truncate max-w-[130px] flex items-center gap-1">
                              <span className="text-emerald-400 font-bold">{item.quantity}x</span>
                              <span className="truncate">{item.name}</span>
                            </span>
                            <span className="text-zinc-500 font-mono text-[10px]">{currencySymbol}{(item.totalPrice || item.unitPrice || 0).toFixed(2)}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-zinc-500 text-[11px]">No items listed</p>
                      )}
                      {itemsList.length > 3 && (
                        <p className="text-[10px] text-zinc-500 italic pt-0.5">+{itemsList.length - 3} more items...</p>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-2 border-t border-zinc-850 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-zinc-600" />
                      {getTimeAgo(order.createdAt)}
                    </span>
                    <span className="font-extrabold text-white text-xs">
                      {currencySymbol}{(order.totals?.grandTotal || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}

            {activeLiveOrders.length === 0 && (
              <div className="col-span-full py-16 text-center text-zinc-500 text-xs border border-zinc-850 rounded-2xl">
                <ShoppingBag className="h-8 w-8 mx-auto text-zinc-700 mb-2" />
                No new or active live orders in the operational feed.
              </div>
            )}
          </div>
        )}

        {/* List View Layout */}
        {feedViewMode === 'list' && (
          <div className="divide-y divide-zinc-850">
            {activeLiveOrders.slice(0, 6).map((order) => {
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

            {activeLiveOrders.length === 0 && (
              <div className="py-12 text-center text-zinc-500 text-xs">
                <ShoppingBag className="h-8 w-8 mx-auto text-zinc-700 mb-2" />
                No new or active live orders in the operational feed.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
