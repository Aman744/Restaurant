import React from 'react';
import { Download, TrendingUp, DollarSign, Receipt, ShoppingBag, CreditCard, Award } from 'lucide-react';
import type { Order } from '@restaurant-qr/core';
import { DataTable, type Column } from '../../../components/shared/DataTable';

interface ReportsTabProps {
  orders?: Order[];
  currencySymbol?: string;
}

interface TopDishReport {
  name: string;
  quantity: number;
  revenue: number;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ orders = [], currencySymbol = '₹' }) => {
  const safeOrders = Array.isArray(orders) ? orders : [];

  const totalOrders = safeOrders.length;
  const totalRevenue = safeOrders.reduce((sum, o) => sum + (o?.totals?.grandTotal || 0), 0);
  const totalSubtotal = safeOrders.reduce((sum, o) => sum + (o?.totals?.subtotal || 0), 0);
  const totalTax = safeOrders.reduce((sum, o) => sum + (o?.totals?.tax || 0), 0);
  const totalServiceCharge = safeOrders.reduce((sum, o) => sum + (o?.totals?.serviceCharge || 0), 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Payment Breakdown
  const paymentBreakdown = safeOrders.reduce(
    (acc, o) => {
      const method = o?.payment?.method || 'cash';
      const amount = o?.totals?.grandTotal || 0;
      if (method === 'upi') acc.upi += amount;
      else if (method === 'card') acc.card += amount;
      else acc.cash += amount;
      return acc;
    },
    { cash: 0, card: 0, upi: 0 }
  );

  // Top Selling Items Attribution
  const itemSalesMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  safeOrders.forEach((o) => {
    (o?.items || []).forEach((item) => {
      const name = item.name || 'Unknown Dish';
      const existing = itemSalesMap.get(name) || { name, quantity: 0, revenue: 0 };
      existing.quantity += item.quantity || 1;
      existing.revenue += item.totalPrice || (item.unitPrice || 0) * (item.quantity || 1);
      itemSalesMap.set(name, existing);
    });
  });

  const topDishes: TopDishReport[] = Array.from(itemSalesMap.values()).sort((a, b) => b.revenue - a.revenue);

  const exportFinancialCsv = () => {
    const csvLines = [
      'Order ID,Table,Customer,Status,Payment Method,Subtotal,Tax,Service Charge,Grand Total,Date'
    ];
    safeOrders.forEach((o) => {
      csvLines.push(
        `"${o.id}","${o.tableNumber || o.tableId || 'N/A'}","${o.customerName || 'Guest'}","${o.status || 'pending'}","${o.payment?.method || 'cash'}",${(o.totals?.subtotal || 0).toFixed(2)},${(o.totals?.tax || 0).toFixed(2)},${(o.totals?.serviceCharge || 0).toFixed(2)},${(o.totals?.grandTotal || 0).toFixed(2)},"${new Date(o.createdAt || Date.now()).toLocaleString()}"`
      );
    });
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `financial_report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

  const columns: Column<TopDishReport>[] = [
    {
      header: 'Dish Name',
      accessorKey: 'name',
      sortable: true,
      cell: (item) => (
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-emerald-400" />
          <span className="font-bold text-white text-xs">{item.name}</span>
        </div>
      )
    },
    {
      header: 'Quantity Sold',
      accessorKey: 'quantity',
      sortable: true,
      cell: (item) => <span className="text-zinc-300 font-semibold">{item.quantity} units</span>
    },
    {
      header: 'Revenue Generated',
      accessorKey: 'revenue',
      sortable: true,
      cell: (item) => (
        <span className="font-extrabold text-emerald-400">
          {currencySymbol}
          {item.revenue.toFixed(2)}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Financial & Operational Reports</h3>
          <p className="text-xs text-zinc-500 mt-1">Real-time revenue attribution, tax collections, and menu insights</p>
        </div>
        <button
          onClick={exportFinancialCsv}
          className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/10 transition"
        >
          <Download className="h-4 w-4" />
          Export Financial CSV
        </button>
      </div>

      {/* Primary Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-2xl space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Gross Sales</span>
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 rounded-xl">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <h4 className="text-2xl font-black text-white">
            {currencySymbol}
            {totalRevenue.toFixed(2)}
          </h4>
          <p className="text-[10px] text-zinc-500">Net items subtotal: {currencySymbol}{totalSubtotal.toFixed(2)}</p>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-2xl space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Total Orders</span>
            <div className="p-2 bg-sky-500/10 border border-sky-500/15 text-sky-400 rounded-xl">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <h4 className="text-2xl font-black text-white">{totalOrders}</h4>
          <p className="text-[10px] text-zinc-500">Processed order count</p>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-2xl space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Avg Order Value</span>
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/15 text-indigo-400 rounded-xl">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <h4 className="text-2xl font-black text-white">
            {currencySymbol}
            {avgOrderValue.toFixed(2)}
          </h4>
          <p className="text-[10px] text-zinc-500">Average ticket size</p>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-2xl space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">GST Tax Collected</span>
            <div className="p-2 bg-purple-500/10 border border-purple-500/15 text-purple-400 rounded-xl">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <h4 className="text-2xl font-black text-white">
            {currencySymbol}
            {totalTax.toFixed(2)}
          </h4>
          <p className="text-[10px] text-zinc-500">Service fees: {currencySymbol}{totalServiceCharge.toFixed(2)}</p>
        </div>
      </div>

      {/* Payment Method Breakdown */}
      <div className="border border-zinc-800 bg-zinc-900/40 p-6 rounded-3xl space-y-4">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-emerald-400" />
          Payment Settlement Channels
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-zinc-950 p-4 border border-zinc-800 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-zinc-500">Cash Settlements</span>
            <p className="text-lg font-bold text-white mt-1">{currencySymbol}{paymentBreakdown.cash.toFixed(2)}</p>
          </div>
          <div className="bg-zinc-950 p-4 border border-zinc-800 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-zinc-500">UPI / QR Payments</span>
            <p className="text-lg font-bold text-white mt-1">{currencySymbol}{paymentBreakdown.upi.toFixed(2)}</p>
          </div>
          <div className="bg-zinc-950 p-4 border border-zinc-800 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-zinc-500">Card Transactions</span>
            <p className="text-lg font-bold text-white mt-1">{currencySymbol}{paymentBreakdown.card.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Top Dishes Performance Table */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Top Performing Dishes</h4>
        <DataTable data={topDishes} columns={columns} searchPlaceholder="Search dishes..." searchField="name" />
      </div>
    </div>
  );
};
