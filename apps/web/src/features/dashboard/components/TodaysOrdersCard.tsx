import React from 'react';
import { ShoppingBag } from 'lucide-react';

interface TodaysOrdersCardProps {
  totalOrdersCount: number;
}

export const TodaysOrdersCard: React.FC<TodaysOrdersCardProps> = ({ totalOrdersCount }) => {
  return (
    <div className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-2xl space-y-3">
      <div className="flex justify-between items-start">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Total Orders</span>
        <div className="p-2 bg-indigo-500/10 border border-indigo-500/15 text-indigo-400 rounded-xl">
          <ShoppingBag className="h-4 w-4" />
        </div>
      </div>
      <div className="flex items-baseline justify-between">
        <h3 className="text-2xl font-black text-white">{totalOrdersCount}</h3>
        <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/15">
          Processed
        </span>
      </div>
    </div>
  );
};
