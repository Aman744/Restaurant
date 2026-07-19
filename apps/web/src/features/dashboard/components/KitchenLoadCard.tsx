import React from 'react';
import { ChefHat } from 'lucide-react';

interface KitchenLoadCardProps {
  preparingOrdersCount: number;
}

export const KitchenLoadCard: React.FC<KitchenLoadCardProps> = ({ preparingOrdersCount }) => {
  return (
    <div className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-2xl space-y-3">
      <div className="flex justify-between items-start">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Kitchen Load</span>
        <div className="p-2 bg-orange-500/10 border border-orange-500/15 text-orange-400 rounded-xl">
          <ChefHat className="h-4 w-4" />
        </div>
      </div>
      <div className="flex items-baseline justify-between">
        <h3 className="text-2xl font-black text-white">{preparingOrdersCount} Orders</h3>
        <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/15">
          In Prep
        </span>
      </div>
    </div>
  );
};
