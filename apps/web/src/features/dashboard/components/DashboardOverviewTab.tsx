import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChefHat, CreditCard, Utensils, ArrowRight, Clock, ShoppingBag, LayoutGrid, List, Sparkles, Eye, X, DoorOpen } from 'lucide-react';
import { RevenueCard } from './RevenueCard';
import { KitchenLoadCard } from './KitchenLoadCard';
import { OccupancyCard } from './OccupancyCard';
import { TodaysOrdersCard } from './TodaysOrdersCard';
import type { Order } from '@restaurant-qr/core';
import { useOrders, useTables, useRooms } from '../../../hooks/useRealtimeData';
import { usePermission } from '../../auth/context/PermissionContext.js';

interface DashboardOverviewTabProps {
  tenantId: string;
  isMockMode: boolean;
  currencySymbol?: string;
}

export const DashboardOverviewTab: React.FC<DashboardOverviewTabProps> = ({
  tenantId,
  isMockMode,
  currencySymbol = '₹'
}) => {
  const [feedViewMode, setFeedViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedFeedOrder, setSelectedFeedOrder] = useState<Order | null>(null);

  const { orders, loading: ordersLoading } = useOrders(tenantId, isMockMode);
  const { tables, loading: tablesLoading } = useTables(tenantId, isMockMode);
  const { rooms, loading: roomsLoading } = useRooms(tenantId, isMockMode);
  const { isFeatureEnabled } = usePermission();
  const roomsActive = isFeatureEnabled('rooms');

  const loading = ordersLoading || tablesLoading || (roomsActive && roomsLoading);

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

  const totalRevenue = safeOrders
    .filter((o) => o?.payment?.status === 'paid' || o?.status === 'completed' || o?.status === 'served')
    .reduce((sum, o) => sum + (o?.totals?.grandTotal || 0), 0) ||
    safeOrders.reduce((sum, o) => sum + (o?.totals?.grandTotal || 0), 0);
  const preparingOrders = safeOrders.filter((o) => o?.status === 'preparing' || o?.status === 'accepted').length;
  const occupiedTables = safeTables.filter((t) => t?.status === 'occupied').length;

  const revenueChangePercent = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayEnd = new Date(todayStart.getTime() - 1);

    let todaySum = 0;
    let yesterdaySum = 0;

    safeOrders.forEach((o) => {
      if (!o) return;
      const date = parseDate(o.createdAt);
      if (date >= todayStart) {
        todaySum += o.totals?.grandTotal || 0;
      } else if (date >= yesterdayStart && date <= yesterdayEnd) {
        yesterdaySum += o.totals?.grandTotal || 0;
      }
    });

    let percent = 0;
    if (yesterdaySum > 0) {
      percent = Math.round(((todaySum - yesterdaySum) / yesterdaySum) * 1000) / 10;
    } else if (todaySum > 0) {
      percent = 100;
    }
    return percent;
  }, [safeOrders]);

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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
          <p className="text-xs font-semibold">Loading operations command center...</p>
        </div>
      </div>
    );
  }

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
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${roomsActive ? 'xl:grid-cols-5' : 'xl:grid-cols-4'} gap-4 sm:gap-5`}>
        <RevenueCard totalRevenue={totalRevenue} revenueChangePercent={revenueChangePercent} currencySymbol={currencySymbol} />
        <KitchenLoadCard preparingOrdersCount={preparingOrders} />
        <OccupancyCard occupiedTablesCount={occupiedTables} totalTablesCount={safeTables.length} />
        {roomsActive && (
          <div className="border border-zinc-900 bg-zinc-900/10 p-5 rounded-3xl space-y-3">
            <div className="flex justify-between items-center text-zinc-500">
              <span className="text-xs font-bold uppercase tracking-wider">Rooms Occupancy</span>
              <DoorOpen className="h-4.5 w-4.5 text-indigo-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-white">
                {rooms.filter((r) => r.status === 'occupied' || r.status === 'checked-in').length}
              </span>
              <span className="text-[10px] text-zinc-500 font-semibold">/ {rooms.length} rooms occupied</span>
            </div>
            <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${rooms.length > 0 ? (rooms.filter((r) => r.status === 'occupied' || r.status === 'checked-in').length / rooms.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
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
                  onClick={() => setSelectedFeedOrder(order)}
                  className={`border bg-zinc-950/80 p-4 rounded-2xl flex flex-col justify-between space-y-4 transition shadow-lg cursor-pointer group relative hover:scale-[1.01] ${
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

                    {/* Detailed Order Items List */}
                    <div className="bg-zinc-900/70 border border-zinc-850 p-3 rounded-xl space-y-2 text-xs max-h-36 overflow-y-auto">
                      {itemsList.length > 0 ? (
                        itemsList.map((item, idx) => (
                          <div key={idx} className="space-y-0.5 border-b border-zinc-800/60 pb-1.5 last:border-0 last:pb-0">
                            <div className="flex justify-between text-zinc-200 items-center">
                              <span className="truncate max-w-[130px] flex items-center gap-1">
                                <span className="text-emerald-400 font-extrabold">{item.quantity}x</span>
                                <span className="truncate font-semibold">{item.name}</span>
                              </span>
                              <span className="text-zinc-400 font-mono text-[10px] font-bold">
                                {currencySymbol}{(item.totalPrice || (item.unitPrice * item.quantity) || 0).toFixed(2)}
                              </span>
                            </div>
                            {item.selectedVariant && (
                              <p className="text-[10px] text-zinc-500 pl-4 font-sans">Opt: {item.selectedVariant.name}</p>
                            )}
                            {item.notes && (
                              <p className="text-[10px] text-amber-400/90 italic pl-4">"{item.notes}"</p>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="flex justify-between text-zinc-200 items-center font-medium">
                          <span className="truncate flex items-center gap-1.5">
                            <span className="text-emerald-400 font-extrabold">1x</span>
                            <span className="font-semibold text-white">Chef's Special Order Dish</span>
                          </span>
                          <span className="text-zinc-400 font-mono text-[10px] font-bold">
                            {currencySymbol}{(order.totals?.grandTotal || 0).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-2 border-t border-zinc-850 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-zinc-600" />
                      {getTimeAgo(order.createdAt)}
                    </span>
                    <div className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-bold text-xs">
                      <Eye className="h-3.5 w-3.5" />
                      <span>{currencySymbol}{(order.totals?.grandTotal || 0).toFixed(2)}</span>
                    </div>
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
            {activeLiveOrders.slice(0, 8).map((order) => {
              const itemsSummary = (order.items || [])
                .map((i) => `${i.quantity}x ${i.name}`)
                .join(', ');

              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedFeedOrder(order)}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-zinc-900/40 px-3 rounded-xl transition cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-white text-sm">
                        {order.tableNumber || `Table ${order.tableId}`}
                      </span>
                      <span className="text-zinc-500 font-mono text-[10px]">#{order.id.slice(0, 8)}</span>
                      <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                        <Clock className="h-3 w-3 text-zinc-600" />
                        {getTimeAgo(order.createdAt)}
                      </span>
                    </div>
                    <p className="text-zinc-300 text-xs truncate max-w-md">
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

      {/* Order Item Details Quick Modal */}
      {selectedFeedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg border border-zinc-800 bg-zinc-950 p-6 shadow-2xl rounded-3xl text-white space-y-5 relative">
            <button
              onClick={() => setSelectedFeedOrder(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-zinc-850 pb-4">
              <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">
                  {selectedFeedOrder.tableNumber || `Table ${selectedFeedOrder.tableId}`}
                </h3>
                <p className="text-xs text-zinc-500 font-mono">Order ID: #{selectedFeedOrder.id}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Ordered Items Breakdown</h4>
              <div className="bg-zinc-900/80 border border-zinc-850 rounded-2xl p-4 divide-y divide-zinc-800 space-y-3">
                {(selectedFeedOrder.items || []).map((item, idx) => (
                  <div key={idx} className="pt-3 first:pt-0 flex justify-between items-start text-xs">
                    <div className="space-y-0.5">
                      <p className="font-bold text-white text-sm flex items-center gap-2">
                        <span className="text-emerald-400 font-black">{item.quantity}x</span>
                        {item.name}
                      </p>
                      {item.selectedVariant && (
                        <p className="text-zinc-400 text-xs pl-6">Variant: {item.selectedVariant.name}</p>
                      )}
                      {item.notes && (
                        <p className="text-amber-400/90 text-xs italic pl-6">Note: "{item.notes}"</p>
                      )}
                    </div>
                    <span className="font-mono text-zinc-200 font-bold text-xs">
                      {currencySymbol}{(item.totalPrice || (item.unitPrice * item.quantity) || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-850 pt-3 flex justify-between items-center text-xs">
              <span className="text-zinc-400">Grand Total:</span>
              <span className="text-lg font-black text-emerald-400">
                {currencySymbol}{(selectedFeedOrder.totals?.grandTotal || 0).toFixed(2)}
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              <Link
                to="/admin/orders"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-500/10"
              >
                Open Orders Manager <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
