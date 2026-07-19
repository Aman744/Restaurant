import React from 'react';
import type { Order } from '@restaurant-qr/core';

interface ReportsTabProps {
  orders: Order[];
  currencySymbol?: string;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ orders, currencySymbol = '₹' }) => {
  const totalRevenue = orders.reduce((sum, o) => sum + (o.totals?.grandTotal || 0), 0);
  const totalTax = orders.reduce((sum, o) => sum + (o.totals?.tax || 0), 0);
  const totalServiceCharge = orders.reduce((sum, o) => sum + (o.totals?.serviceCharge || 0), 0);

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Financial & Analytics Overview</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-2xl space-y-2">
          <span className="text-xs text-zinc-500 font-semibold uppercase">Gross Volume</span>
          <h4 className="text-xl font-bold text-white">{currencySymbol}{totalRevenue.toFixed(2)}</h4>
        </div>
        <div className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-2xl space-y-2">
          <span className="text-xs text-zinc-500 font-semibold uppercase">Total Tax Collected</span>
          <h4 className="text-xl font-bold text-white">{currencySymbol}{totalTax.toFixed(2)}</h4>
        </div>
        <div className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-2xl space-y-2">
          <span className="text-xs text-zinc-500 font-semibold uppercase">Service Charges</span>
          <h4 className="text-xl font-bold text-white">{currencySymbol}{totalServiceCharge.toFixed(2)}</h4>
        </div>
      </div>
    </div>
  );
};
