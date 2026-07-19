import React, { useState, useMemo } from 'react';
import { Plus, QrCode, Trash2, LayoutGrid, List, Users, CheckCircle2, Clock, Utensils, Copy, ExternalLink } from 'lucide-react';
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
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const safeTables = Array.isArray(tables) ? tables : [];

  // Filter tables by status
  const filteredTables = useMemo(() => {
    if (statusFilter === 'all') return safeTables;
    return safeTables.filter((t) => t.status === statusFilter);
  }, [safeTables, statusFilter]);

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

  const handleCopyLink = (t: Table) => {
    const url = `${window.location.origin}/customer/table/${tenantId}/${t.id}`;
    navigator.clipboard.writeText(url);
    toast.success(`Copied order URL for ${t.number}!`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'occupied':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 shadow-sm shadow-red-500/10">
            <Clock className="h-3 w-3" />
            Occupied
          </span>
        );
      case 'reserved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm shadow-amber-500/10">
            Reserved
          </span>
        );
      case 'cleaning':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-sm shadow-sky-500/10">
            Cleaning
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/10">
            <CheckCircle2 className="h-3 w-3" />
            Available
          </span>
        );
    }
  };

  const columns: Column<Table>[] = [
    {
      header: 'Table Details',
      accessorKey: 'number',
      sortable: true,
      cell: (t) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 font-bold shadow-md">
            <Utensils className="h-4 w-4" />
          </div>
          <div>
            <span className="font-extrabold text-white text-xs block hover:text-emerald-400 transition">{t.number}</span>
            <span className="text-[10px] text-zinc-500 font-mono">ID: {t.id}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Capacity',
      accessorKey: 'seatingCapacity',
      sortable: true,
      cell: (t) => (
        <div className="flex items-center gap-1.5 text-zinc-300 text-xs font-semibold">
          <Users className="h-3.5 w-3.5 text-zinc-500" />
          <span>{t.seatingCapacity || 4} Guests</span>
        </div>
      )
    },
    {
      header: 'QR Token ID',
      accessorKey: 'qrToken',
      cell: (t) => (
        <span className="font-mono text-xs text-emerald-400 font-extrabold tracking-wider bg-emerald-500/10 border border-emerald-500/15 px-3 py-1 rounded-xl inline-block">
          {t.qrToken ? `#${t.qrToken.replace(/^qr_token_|^tok_table_/, '').slice(0, 8).toUpperCase()}` : '#ACTIVE'}
        </span>
      )
    },
    {
      header: 'Floor Status',
      accessorKey: 'status',
      cell: (t) => getStatusBadge(t.status)
    },
    {
      header: 'Actions',
      cell: (t) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => setViewingQrTable(t)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-800 hover:border-emerald-500/30 bg-zinc-900/80 rounded-xl text-zinc-300 hover:text-emerald-400 text-xs font-semibold transition shadow-sm"
            title="View & Download QR Code"
          >
            <QrCode className="h-3.5 w-3.5 text-emerald-400" />
            View QR
          </button>
          <button
            onClick={() => handleCopyLink(t)}
            className="p-2 border border-zinc-800 hover:border-zinc-700 bg-zinc-900/80 rounded-xl text-zinc-400 hover:text-white transition shadow-sm"
            title="Copy Table Order Link"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => window.open(`${window.location.origin}/customer/table/${tenantId}/${t.id}`, '_blank')}
            className="p-2 border border-zinc-800 hover:border-zinc-700 bg-zinc-900/80 rounded-xl text-zinc-400 hover:text-emerald-400 transition shadow-sm"
            title="Test Table Menu"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleDeleteTable(t)}
            className="p-2 border border-zinc-800 hover:border-red-500/30 bg-zinc-900/80 rounded-xl text-zinc-400 hover:text-red-400 transition shadow-sm"
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
          <div className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-emerald-400" />
            <h3 className="text-base font-extrabold text-white">Dining Floor Layout & QR Tokens</h3>
          </div>
          <p className="text-xs text-zinc-500 mt-1">Manage physical restaurant tables, seating capacity, and QR code tokens</p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle Switch */}
          <div className="flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-inner">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === 'grid'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Grid View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === 'list'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              List View
            </button>
          </div>

          {isMockMode && safeTables.length > 0 && (
            <button
              onClick={handleClearAllTables}
              className="px-3.5 py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold rounded-xl transition"
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

      {/* Status Filter Bar */}
      <div className="flex items-center gap-2 border-b border-zinc-850 pb-3 overflow-x-auto">
        {(['all', 'available', 'occupied', 'reserved', 'cleaning'] as const).map((st) => {
          const count = st === 'all' ? safeTables.length : safeTables.filter((t) => t.status === st).length;
          return (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition border ${
                statusFilter === st
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              {st} ({count})
            </button>
          );
        })}
      </div>

      {/* Grid View Mode */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredTables.map((table) => {
            const isOccupied = table.status === 'occupied';

            return (
              <div
                key={table.id}
                className={`group border bg-gradient-to-b backdrop-blur-xl p-6 rounded-3xl space-y-5 flex flex-col justify-between transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl shadow-black/40 ${
                  isOccupied
                    ? 'from-red-950/20 to-zinc-950/80 border-red-500/30 hover:border-red-500/50'
                    : 'from-zinc-900/60 to-zinc-950/80 border-zinc-800/90 hover:border-emerald-500/40'
                }`}
              >
                <div className="space-y-4">
                  {/* Top Row Header */}
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h4 className="text-xl font-black text-white group-hover:text-emerald-400 transition">
                        {table.number}
                      </h4>
                      <p className="text-[11px] text-zinc-400 font-semibold flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-zinc-500" />
                        Cap: {table.seatingCapacity || 4} Guests
                      </p>
                    </div>
                    {getStatusBadge(table.status)}
                  </div>

                  {/* Visual Floor Layout Graphic */}
                  <div className="bg-zinc-950/80 border border-zinc-850 p-4 rounded-2xl flex items-center justify-between shadow-inner">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-2xl flex items-center justify-center border font-bold text-xs ${
                          isOccupied
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        <Utensils className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-zinc-500 block">QR Token ID</span>
                        <span className="font-mono text-xs text-emerald-400 font-extrabold tracking-wider">
                          {table.qrToken
                            ? `#${table.qrToken.replace(/^qr_token_|^tok_table_/, '').slice(0, 8).toUpperCase()}`
                            : '#ACTIVE'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Action Controls */}
                <div className="pt-2 border-t border-zinc-850/80 flex items-center gap-2">
                  <button
                    onClick={() => setViewingQrTable(table)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-zinc-900/80 hover:bg-emerald-500/10 border border-zinc-800 hover:border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl transition shadow-md"
                  >
                    <QrCode className="h-4 w-4" />
                    View QR Code
                  </button>
                  <button
                    onClick={() => handleDeleteTable(table)}
                    className="p-2.5 bg-zinc-900/80 hover:bg-red-500/10 border border-zinc-800 hover:border-red-500/30 text-zinc-400 hover:text-red-400 rounded-xl transition shadow-md"
                    title="Delete Table"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {filteredTables.length === 0 && (
            <div className="col-span-full border border-zinc-900 bg-zinc-950 py-16 text-center text-zinc-500 rounded-3xl">
              <Utensils className="h-8 w-8 mx-auto text-zinc-700 mb-2" />
              {statusFilter !== 'all'
                ? `No tables match status "${statusFilter}".`
                : 'No dining tables provisioned. Click "Provision Table" to add one.'}
            </div>
          )}
        </div>
      )}

      {/* List View Mode */}
      {viewMode === 'list' && (
        <DataTable
          data={filteredTables}
          columns={columns}
          searchPlaceholder="Search tables by number, capacity or status..."
          searchField="number"
          emptyMessage={
            statusFilter !== 'all'
              ? `No tables match status "${statusFilter}".`
              : 'No dining tables provisioned.'
          }
        />
      )}

      <AddTableModal tenantId={tenantId} isMockMode={isMockMode} />
      <ViewQrModal tenantId={tenantId} />
    </div>
  );
};
