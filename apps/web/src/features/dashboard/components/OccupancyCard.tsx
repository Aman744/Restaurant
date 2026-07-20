import React from 'react';
import { Table as TableIcon } from 'lucide-react';

interface OccupancyCardProps {
  occupiedTablesCount: number;
  totalTablesCount: number;
}

export const OccupancyCard: React.FC<OccupancyCardProps> = ({ occupiedTablesCount, totalTablesCount }) => {
  const percentage = totalTablesCount > 0 ? Math.round((occupiedTablesCount / totalTablesCount) * 100) : 0;

  return (
    <div className="border border-zinc-800 bg-zinc-900/60 p-5 rounded-2xl space-y-3 shadow-lg flex flex-col justify-between">
      <div className="flex justify-between items-center text-zinc-400">
        <span className="text-xs font-bold uppercase tracking-wider">Table Occupancy</span>
        <div className="p-2 bg-sky-500/10 border border-sky-500/15 text-sky-400 rounded-xl flex items-center justify-center shrink-0">
          <TableIcon className="h-4 w-4" />
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-2 pt-1">
        <h3 className="text-2xl font-black text-white truncate">{percentage}%</h3>
        <span className="text-xs font-semibold text-zinc-400 font-mono shrink-0">
          {occupiedTablesCount} of {totalTablesCount} tables
        </span>
      </div>
    </div>
  );
};
