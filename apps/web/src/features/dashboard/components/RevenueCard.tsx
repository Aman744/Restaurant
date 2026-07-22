import React from 'react';
import { IndianRupee, TrendingUp, TrendingDown } from 'lucide-react';

interface RevenueCardProps {
  totalRevenue: number;
  revenueChangePercent?: number;
  currencySymbol?: string;
}

export const RevenueCard: React.FC<RevenueCardProps> = ({ 
  totalRevenue, 
  revenueChangePercent = 0, 
  currencySymbol = '₹' 
}) => {
  const isPositive = revenueChangePercent >= 0;

  return (
    <div className="border border-zinc-800 bg-zinc-900/60 p-5 rounded-2xl space-y-3 shadow-lg flex flex-col justify-between">
      <div className="flex justify-between items-center text-zinc-400">
        <span className="text-xs font-bold uppercase tracking-wider">Total Revenue</span>
        <div className="p-2 bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
          <IndianRupee className="h-4 w-4" />
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-2 pt-1">
        <h3 className="text-2xl font-black text-white truncate">
          {currencySymbol}
          {totalRevenue.toFixed(2)}
        </h3>
        <span className={`flex items-center text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border shrink-0 ${
          isPositive 
            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
            : 'text-red-400 bg-red-500/10 border-red-500/20'
        }`}>
          {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
          {isPositive ? '+' : ''}{revenueChangePercent.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};
