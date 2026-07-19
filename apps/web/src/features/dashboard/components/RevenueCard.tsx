import React from 'react';
import { IndianRupee, TrendingUp } from 'lucide-react';

interface RevenueCardProps {
  totalRevenue: number;
  currencySymbol?: string;
}

export const RevenueCard: React.FC<RevenueCardProps> = ({ totalRevenue, currencySymbol = '₹' }) => {
  return (
    <div className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-2xl space-y-3">
      <div className="flex justify-between items-start">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Total Revenue</span>
        <div className="p-2 bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 rounded-xl flex items-center justify-center">
          <IndianRupee className="h-4 w-4" />
        </div>
      </div>
      <div className="flex items-baseline justify-between">
        <h3 className="text-2xl font-black text-white">
          {currencySymbol}
          {totalRevenue.toFixed(2)}
        </h3>
        <span className="flex items-center text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/15">
          <TrendingUp className="h-3 w-3 mr-1" />
          +14.2%
        </span>
      </div>
    </div>
  );
};
