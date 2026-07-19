import React, { useRef } from 'react';
import { Plus, Upload, Edit3, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import type { MenuItem } from '@restaurant-qr/core';
import { DataTable, type Column } from '../../../components/shared/DataTable';
import { useMenuStore } from '../../../stores/useMenuStore';
import { useConfirm } from '../../../components/shared/ConfirmContext';
import { useToast } from '../../../components/shared/ToastContext';
import { MenuService } from '../../../services/MenuService';
import { AddMenuModal } from './AddMenuModal';

interface MenuTabProps {
  tenantId: string;
  menuItems?: MenuItem[];
  isMockMode: boolean;
  currencySymbol?: string;
}

export const MenuTab: React.FC<MenuTabProps> = ({
  tenantId,
  menuItems = [],
  isMockMode,
  currencySymbol = '₹'
}) => {
  const { setAddModalOpen, setEditingItem } = useMenuStore();
  const { confirm } = useConfirm();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const safeMenuItems = Array.isArray(menuItems) ? menuItems : [];

  const handleStockToggle = async (item: MenuItem) => {
    try {
      await MenuService.toggleStockStatus(tenantId, item.id, item.stockStatus, isMockMode);
      toast.success(`Updated stock status for "${item.name}".`);
    } catch (e: any) {
      toast.error(`Failed to update stock: ${e.message}`);
    }
  };

  const handleDelete = (item: MenuItem) => {
    confirm({
      title: 'Delete Menu Item?',
      message: `Are you sure you want to delete "${item.name}"? This action cannot be undone.`,
      confirmText: 'Delete Dish',
      onConfirm: async () => {
        await MenuService.deleteMenuItem(tenantId, item.id, isMockMode);
        toast.success(`Deleted "${item.name}".`);
      }
    });
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = await MenuService.importCsv(tenantId, text, isMockMode);

    if (result.isValid) {
      toast.success(`Successfully imported ${result.validRows.length} menu items from CSV!`);
    } else {
      toast.error(`CSV Validation Errors: ${result.errors.join(' | ')}`);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const columns: Column<MenuItem>[] = [
    {
      header: 'Dish Name',
      accessorKey: 'name',
      sortable: true,
      cell: (item) => {
        const imageUrl = item.images?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
        return (
          <div className="flex items-center gap-3">
            <img src={imageUrl} alt={item.name} className="h-9 w-9 rounded-xl object-cover border border-zinc-800" />
            <div>
              <div className="font-bold text-white text-xs">{item.name}</div>
              <div className="text-[10px] text-zinc-500">{item.description || 'No description'}</div>
            </div>
          </div>
        );
      }
    },
    {
      header: 'Category',
      accessorKey: 'categoryId',
      sortable: true,
      cell: (item) => (
        <span className="capitalize px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-300">
          {item.categoryId || 'default'}
        </span>
      )
    },
    {
      header: 'Price',
      accessorKey: 'price',
      sortable: true,
      cell: (item) => (
        <span className="font-bold text-white">
          {currencySymbol}
          {(item.price || 0).toFixed(2)}
        </span>
      )
    },
    {
      header: 'Stock Status',
      cell: (item) => (
        <button onClick={() => handleStockToggle(item)} className="focus:outline-none flex items-center gap-1.5">
          {item.stockStatus === 'in-stock' ? (
            <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
              <ToggleRight className="h-5 w-5 text-emerald-500" />
              In Stock
            </span>
          ) : (
            <span className="flex items-center gap-1 text-zinc-500 text-xs font-semibold">
              <ToggleLeft className="h-5 w-5 text-zinc-600" />
              Out of Stock
            </span>
          )}
        </button>
      )
    },
    {
      header: 'Actions',
      cell: (item) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => setEditingItem(item)}
            className="p-1.5 border border-zinc-800 hover:border-zinc-700 rounded-lg text-zinc-400 hover:text-white"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleDelete(item)}
            className="p-1.5 border border-zinc-800 hover:border-red-500/30 rounded-lg text-zinc-400 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Menu Catalog</h3>
        <div className="flex gap-2">
          <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCsvFileChange} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl"
          >
            <Upload className="h-4 w-4 text-emerald-400" />
            Import CSV
          </button>
          <button
            onClick={() => {
              setEditingItem(null);
              setAddModalOpen(true);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/10"
          >
            <Plus className="h-4 w-4" />
            Add Dish
          </button>
        </div>
      </div>

      {/* Enterprise Data Table */}
      <DataTable data={safeMenuItems} columns={columns} searchPlaceholder="Search dishes by name or category..." searchField="name" />

      {/* Add/Edit Menu Item Modal */}
      <AddMenuModal tenantId={tenantId} isMockMode={isMockMode} />
    </div>
  );
};
