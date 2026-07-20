import React from 'react';
import { ChefHat } from 'lucide-react';

interface KitchenLoadCardProps {
  preparingOrdersCount: number;
}

export const KitchenLoadCard: React.FC<KitchenLoadCardProps> = ({ preparingOrdersCount }) => {
  return (
    <div className="border border-zinc-800 bg-zinc-900/60 p-5 rounded-2xl space-y-3 shadow-lg flex flex-col justify-between">
      <div className="flex justify-between items-center text-zinc-400">
        <span className="text-xs font-bold uppercase tracking-wider">Kitchen Load</span>
        <div className="p-2 bg-orange-500/10 border border-orange-500/15 text-orange-400 rounded-xl flex items-center justify-center shrink-0">
          <ChefHat className="h-4 w-4" />
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-2 pt-1">
        <h3 className="text-2xl font-black text-white truncate">{preparingOrdersCount} Orders</h3>
        <span className="text-[10px] font-extrabold text-orange-400 bg-orange-500/10 px-2.5 py-0.5 rounded-full border border-orange-500/20 shrink-0">
          In Prep
        </span>
      </div>
    </div>
  );
};
