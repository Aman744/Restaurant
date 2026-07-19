import React, { useState } from 'react';
import { Plus, QrCode, Trash2, LayoutGrid, List, Users, CheckCircle2, Clock } from 'lucide-react';
import type { Table } from '@restaurant-qr/core';
import { DataTable, type Column } from '../../../components/shared/DataTable';
import { useTableStore } from '../../../stores/useTableStore';
import { useConfirm } from '../../../components/shared/ConfirmContext';
import { useToast } from '../../../components/shared/ToastContext';
import { TableService } from '../../../services/TableService';
import { AddTableModal } from './AddTableModal';
import { ViewQrModal } from './ViewQrModal';

interface TablesTabProps {
  tenantId: string;
  tables: Table[];
  isMockMode: boolean;
}

export const TablesTab: React.FC<TablesTabProps> = ({ tenantId, tables, isMockMode }) => {
  const { setAddModalOpen, setViewingQrTable } = useTableStore();
  const { confirm } = useConfirm();
  const toast = useToast();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const safeTables = Array.isArray(tables) ? tables : [];

  const handleDeleteTable = (table: Table) => {
    confirm({
      title: 'Delete Dining Table?',
      message: `Are you sure you want to delete ${table.number}? Active orders associated with this table will be affected.`,
      confirmText: 'Delete Table',
      onConfirm: async () => {
        await TableService.deleteTable(tenantId, table.id, isMockMode);
        toast.success(`Deleted ${table.number}.`);
      }
    });
  };

  const handleClearAllTables = () => {
    confirm({
      title: 'Clear All Demo Tables?',
      message: 'Are you sure you want to remove all pre-existing demo tables? You can then add only your desired tables.',
      confirmText: 'Clear Tables',
      onConfirm: async () => {
        await TableService.clearAllTables(tenantId, isMockMode);
        toast.success('Cleared demo tables.');
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'occupied':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
            <Clock className="h-3.5 w-3.5" />
            Occupied
          </span>
        );
      case 'reserved':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Reserved
          </span>
        );
      case 'cleaning':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            Cleaning
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Available
          </span>
        );
    }
  };

  const columns: Column<Table>[] = [
    {
      header: 'Table Number',
      accessorKey: 'number',
      sortable: true,
      cell: (t) => <span className="font-extrabold text-white text-xs">{t.number}</span>
    },
    {
      header: 'Seating Capacity',
      accessorKey: 'seatingCapacity',
      sortable: true,
      cell: (t) => <span className="text-zinc-400">{t.seatingCapacity} Guests</span>
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (t) => getStatusBadge(t.status)
    },
    {
      header: 'Actions',
      cell: (t) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => setViewingQrTable(t)}
            className="p-1.5 border border-zinc-800 hover:border-emerald-500/30 rounded-lg text-zinc-400 hover:text-emerald-400"
            title="View QR Code"
          >
            <QrCode className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleDeleteTable(t)}
            className="p-1.5 border border-zinc-800 hover:border-red-500/30 rounded-lg text-zinc-400 hover:text-red-400"
            title="Delete Table"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-extrabold text-white">Dining Floor Layout & QR Tokens</h3>
          <p className="text-xs text-zinc-500 mt-1">Manage physical restaurant tables and generate customer QR codes</p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle Switch */}
          <div className="flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'grid'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'list'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
          </div>

          {isMockMode && safeTables.length > 0 && (
            <button
              onClick={handleClearAllTables}
              className="px-3 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold rounded-xl"
            >
              Reset Tables
            </button>
          )}

          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/10 transition"
          >
            <Plus className="h-4 w-4" />
            Provision Table
          </button>
        </div>
      </div>

      {/* Grid View Mode */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {safeTables.map((table) => (
            <div
              key={table.id}
              className={`border bg-zinc-900/40 p-5 rounded-3xl space-y-4 flex flex-col justify-between transition duration-200 hover:border-zinc-700 ${
                table.status === 'occupied' ? 'border-red-500/20' : 'border-zinc-800'
              }`}
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-lg font-black text-white">{table.number}</h4>
                    <p className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5">
                      <Users className="h-3 w-3 text-zinc-600" />
                      Cap: {table.seatingCapacity || 4} Guests
                    </p>
                  </div>
                  {getStatusBadge(table.status)}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-zinc-850 flex items-center gap-2">
                <button
                  onClick={() => setViewingQrTable(table)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl transition"
                >
                  <QrCode className="h-4 w-4" />
                  View QR
                </button>
                <button
                  onClick={() => handleDeleteTable(table)}
                  className="p-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-red-500/30 text-zinc-400 hover:text-red-400 rounded-xl transition"
                  title="Delete Table"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          {safeTables.length === 0 && (
            <div className="col-span-full border border-zinc-900 bg-zinc-950 py-16 text-center text-zinc-500 rounded-3xl">
              No dining tables provisioned. Click "Provision Table" to add one.
            </div>
          )}
        </div>
      )}

      {/* List View Mode */}
      {viewMode === 'list' && (
        <DataTable data={safeTables} columns={columns} searchPlaceholder="Search tables..." searchField="number" />
      )}

      <AddTableModal tenantId={tenantId} isMockMode={isMockMode} />
      <ViewQrModal tenantId={tenantId} />
    </div>
  );
};
