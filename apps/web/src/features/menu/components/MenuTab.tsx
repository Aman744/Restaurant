import React, { useRef, useState, useMemo } from 'react';
import { Plus, Upload, Edit3, Trash2, ToggleLeft, ToggleRight, ChefHat, LayoutGrid, List, Clock } from 'lucide-react';
import type { MenuItem, DietaryTag } from '@restaurant-qr/core';
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
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const safeMenuItems = Array.isArray(menuItems) ? menuItems : [];

  // Filter by category and search query
  const filteredMenuItems = useMemo(() => {
    return safeMenuItems.filter((item) => {
      const matchCat =
        activeCategoryFilter === 'all' ||
        (item.categoryId || 'mains').toLowerCase() === activeCategoryFilter.toLowerCase();

      const matchSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());

      return matchCat && matchSearch;
    });
  }, [safeMenuItems, activeCategoryFilter, searchQuery]);

  // Categories count
  const categoriesList = useMemo(() => {
    const map = new Map<string, number>();
    safeMenuItems.forEach((item) => {
      const cat = (item.categoryId || 'mains').toLowerCase();
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [safeMenuItems]);

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

  const renderDietaryBadge = (tags?: DietaryTag[]) => {
    if (!tags || tags.length === 0) return null;
    const primaryTag = tags[0];
    const isVeg = primaryTag === 'veg' || primaryTag === 'vegan' || primaryTag === 'jain';

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase border ${
          isVeg
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-red-500/10 text-red-400 border-red-500/20'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${isVeg ? 'bg-emerald-400' : 'bg-red-400'}`} />
        {primaryTag}
      </span>
    );
  };

  const columns: Column<MenuItem>[] = [
    {
      header: 'Dish Details',
      accessorKey: 'name',
      sortable: true,
      cell: (item) => {
        const imageUrl =
          item.images?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
        return (
          <div className="flex items-center gap-3">
            <img src={imageUrl} alt={item.name} className="h-10 w-10 rounded-xl object-cover border border-zinc-800 shadow-md" />
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs hover:text-emerald-400 transition">{item.name}</span>
                {renderDietaryBadge(item.dietaryTags)}
              </div>
              <div className="text-[10px] text-zinc-500 truncate max-w-xs">{item.description || 'No description provided'}</div>
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
        <span className="capitalize px-3 py-1 rounded-xl text-[10px] font-bold bg-zinc-900 border border-zinc-800 text-zinc-300">
          {item.categoryId || 'Mains'}
        </span>
      )
    },
    {
      header: 'Prep Time',
      accessorKey: 'preparationTime',
      sortable: true,
      cell: (item) => <span className="text-zinc-400 text-xs font-mono">{item.preparationTime || 10} mins</span>
    },
    {
      header: 'Price',
      accessorKey: 'price',
      sortable: true,
      cell: (item) => (
        <span className="font-black text-emerald-400 text-sm">
          {currencySymbol}
          {(item.price || 0).toFixed(2)}
        </span>
      )
    },
    {
      header: 'Availability',
      cell: (item) => (
        <button
          onClick={() => handleStockToggle(item)}
          className="focus:outline-none flex items-center gap-1.5 hover:opacity-80 transition"
        >
          {item.stockStatus === 'in-stock' ? (
            <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl">
              <ToggleRight className="h-4 w-4 text-emerald-400" />
              In Stock
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-zinc-500 text-xs font-bold bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-xl">
              <ToggleLeft className="h-4 w-4 text-zinc-600" />
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
            className="p-2 border border-zinc-800 hover:border-emerald-500/30 bg-zinc-900/60 rounded-xl text-zinc-400 hover:text-white transition shadow-sm"
            title="Edit Dish"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleDelete(item)}
            className="p-2 border border-zinc-800 hover:border-red-500/30 bg-zinc-900/60 rounded-xl text-zinc-400 hover:text-red-400 transition shadow-sm"
            title="Delete Dish"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Actions & Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-emerald-400" />
            <h3 className="text-base font-extrabold text-white">Menu Catalog & Dish Management</h3>
          </div>
          <p className="text-xs text-zinc-500 mt-1">Manage pricing, dietary tags, stock status, and CSV imports</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Switcher */}
          <div className="flex items-center p-1 bg-zinc-950 border border-zinc-800 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'grid'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Grid
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'table'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Table View"
            >
              <List className="h-3.5 w-3.5" />
              Table
            </button>
          </div>

          <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCsvFileChange} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl transition shadow-md"
          >
            <Upload className="h-4 w-4 text-emerald-400" />
            Import CSV
          </button>
          <button
            onClick={() => {
              setEditingItem(null);
              setAddModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/10 transition"
          >
            <Plus className="h-4 w-4" />
            Add New Dish
          </button>
        </div>
      </div>

      {/* Category Filter Pills Bar & Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-850 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => setActiveCategoryFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition border ${
              activeCategoryFilter === 'all'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
          >
            All Categories ({safeMenuItems.length})
          </button>

          {categoriesList.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategoryFilter(cat.name)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition border ${
                activeCategoryFilter === cat.name
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>

        {viewMode === 'grid' && (
          <input
            type="text"
            placeholder="Search catalog dishes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/40 w-full sm:w-64"
          />
        )}
      </div>

      {/* 3-Column Grid View Layout */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMenuItems.map((item) => {
            const imageUrl =
              item.images?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
            const isInStock = item.stockStatus === 'in-stock';

            return (
              <div
                key={item.id}
                className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-3xl space-y-4 flex flex-col justify-between hover:border-emerald-500/40 transition shadow-xl group"
              >
                <div className="space-y-3">
                  <div className="relative overflow-hidden rounded-2xl border border-zinc-800">
                    <img
                      src={imageUrl}
                      alt={item.name}
                      className="w-full h-44 object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute top-3 left-3">
                      {renderDietaryBadge(item.dietaryTags)}
                    </div>
                    <div className="absolute top-3 right-3">
                      <span className="capitalize px-2.5 py-1 rounded-xl text-[10px] font-black bg-zinc-950/80 backdrop-blur-md border border-zinc-800 text-zinc-300 shadow-md">
                        {item.categoryId || 'Mains'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-extrabold text-white text-base group-hover:text-emerald-400 transition">
                        {item.name}
                      </h4>
                      <span className="font-black text-emerald-400 text-base">
                        {currencySymbol}
                        {(item.price || 0).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {item.description || 'No description provided.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-zinc-850">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500 font-semibold flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-zinc-600" />
                      {item.preparationTime || 10} mins prep
                    </span>

                    <button
                      onClick={() => handleStockToggle(item)}
                      className="focus:outline-none flex items-center gap-1.5 hover:opacity-80 transition"
                    >
                      {isInStock ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                          <ToggleRight className="h-3.5 w-3.5 text-emerald-400" />
                          In Stock
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-zinc-500 text-[10px] font-bold bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-lg">
                          <ToggleLeft className="h-3.5 w-3.5 text-zinc-600" />
                          Out of Stock
                        </span>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingItem(item)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 border border-zinc-800 hover:border-emerald-500/30 bg-zinc-950 rounded-xl text-xs font-bold text-zinc-300 hover:text-white transition"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-emerald-400" />
                      Edit Dish
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-2 border border-zinc-800 hover:border-red-500/30 bg-zinc-950 rounded-xl text-zinc-400 hover:text-red-400 transition"
                      title="Delete Dish"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredMenuItems.length === 0 && (
            <div className="col-span-full border border-zinc-900 bg-zinc-950 py-16 text-center text-zinc-500 rounded-3xl text-xs">
              No menu catalog dishes match the selected category or search filter.
            </div>
          )}
        </div>
      )}

      {/* Enterprise Data Table View */}
      {viewMode === 'table' && (
        <DataTable
          data={filteredMenuItems}
          columns={columns}
          searchPlaceholder="Search dishes by name, description or category..."
          searchField="name"
          emptyMessage={
            activeCategoryFilter !== 'all'
              ? `No menu items found in category "${activeCategoryFilter}".`
              : 'No menu items available.'
          }
        />
      )}

      {/* Add/Edit Menu Item Modal */}
      <AddMenuModal tenantId={tenantId} isMockMode={isMockMode} />
    </div>
  );
};
