import React from 'react';
import { Plus, QrCode, Trash2 } from 'lucide-react';
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
      cell: (t) => (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold ${
          t.status === 'occupied' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        }`}>
          {t.status}
        </span>
      )
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Dining Floor Layout</h3>
        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/10"
        >
          <Plus className="h-4 w-4" />
          Provision Table
        </button>
      </div>

      <DataTable data={tables} columns={columns} searchPlaceholder="Search tables..." searchField="number" />

      <AddTableModal tenantId={tenantId} isMockMode={isMockMode} />
      <ViewQrModal tenantId={tenantId} />
    </div>
  );
};
