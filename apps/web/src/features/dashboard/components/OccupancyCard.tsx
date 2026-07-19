import React from 'react';
import { Table as TableIcon } from 'lucide-react';

interface OccupancyCardProps {
  occupiedTablesCount: number;
  totalTablesCount: number;
}

export const OccupancyCard: React.FC<OccupancyCardProps> = ({ occupiedTablesCount, totalTablesCount }) => {
  const percentage = totalTablesCount > 0 ? Math.round((occupiedTablesCount / totalTablesCount) * 100) : 0;

  return (
    <div className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-2xl space-y-3">
      <div className="flex justify-between items-start">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Table Occupancy</span>
        <div className="p-2 bg-sky-500/10 border border-sky-500/15 text-sky-400 rounded-xl">
          <TableIcon className="h-4 w-4" />
        </div>
      </div>
      <div className="flex items-baseline justify-between">
        <h3 className="text-2xl font-black text-white">{percentage}%</h3>
        <span className="text-xs text-zinc-500">
          {occupiedTablesCount} of {totalTablesCount} tables
        </span>
      </div>
    </div>
  );
};
