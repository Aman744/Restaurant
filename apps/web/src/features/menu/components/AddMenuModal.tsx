import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { MenuItem, DietaryTag } from '@restaurant-qr/core';
import { useMenuStore } from '../../../stores/useMenuStore';
import { MenuService } from '../../../services/MenuService';
import { useToast } from '../../../components/shared/ToastContext';

const menuSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  price: z.number().positive('Price must be greater than 0'),
  categoryId: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  preparationTime: z.number().min(1, 'Preparation time must be at least 1 min'),
  dietaryTag: z.enum(['veg', 'non-veg', 'vegan', 'jain', 'gluten-free'])
});

type MenuFormData = z.infer<typeof menuSchema>;

interface AddMenuModalProps {
  tenantId: string;
  isMockMode: boolean;
}

export const AddMenuModal: React.FC<AddMenuModalProps> = ({ tenantId, isMockMode }) => {
  const { isAddModalOpen, editingItem, setAddModalOpen, setEditingItem } = useMenuStore();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<MenuFormData>({
    resolver: zodResolver(menuSchema),
    defaultValues: {
      name: '',
      price: 10,
      categoryId: 'mains',
      description: '',
      preparationTime: 10,
      dietaryTag: 'veg'
    }
  });

  useEffect(() => {
    if (editingItem) {
      reset({
        name: editingItem.name,
        price: editingItem.price,
        categoryId: editingItem.categoryId || 'mains',
        description: editingItem.description || '',
        preparationTime: editingItem.preparationTime || 10,
        dietaryTag: editingItem.dietaryTags[0] || 'veg'
      });
    } else {
      reset({
        name: '',
        price: 10,
        categoryId: 'mains',
        description: '',
        preparationTime: 10,
        dietaryTag: 'veg'
      });
    }
  }, [editingItem, reset]);

  const onSubmit = async (data: MenuFormData) => {
    try {
      const itemId = editingItem ? editingItem.id : `menu_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

      const item: MenuItem = {
        id: itemId,
        tenantId,
        categoryId: data.categoryId,
        name: data.name,
        description: data.description || '',
        price: data.price,
        images: editingItem?.images || ['https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'],
        dietaryTags: [data.dietaryTag as DietaryTag],
        allergens: editingItem?.allergens || [],
        stockStatus: editingItem?.stockStatus || 'in-stock',
        preparationTime: data.preparationTime,
        isActive: true
      };

      await MenuService.saveMenuItem(tenantId, item, isMockMode);
      toast.success(editingItem ? 'Menu item updated!' : 'Menu item added successfully!');
      setAddModalOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      toast.error(`Failed to save menu item: ${err.message}`);
    }
  };

  if (!isAddModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md border border-zinc-800 bg-zinc-950 p-6 shadow-2xl rounded-3xl text-white">
        <h3 className="text-lg font-bold mb-4">{editingItem ? 'Edit Dish' : 'Add New Dish'}</h3>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-semibold uppercase">Dish Name</label>
            <input
              {...register('name')}
              className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
              placeholder="e.g. Paneer Butter Masala"
            />
            {errors.name && <p className="text-[10px] text-red-400">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-semibold uppercase">Price (₹)</label>
              <input
                type="number"
                step="0.01"
                {...register('price', { valueAsNumber: true })}
                className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
              />
              {errors.price && <p className="text-[10px] text-red-400">{errors.price.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-semibold uppercase">Category</label>
              <select
                {...register('categoryId')}
                className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none"
              >
                <option value="starters">Starters</option>
                <option value="mains">Mains</option>
                <option value="desserts">Desserts</option>
                <option value="beverages">Beverages</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-semibold uppercase">Dietary Type</label>
              <select
                {...register('dietaryTag')}
                className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none"
              >
                <option value="veg">Veg</option>
                <option value="non-veg">Non-Veg</option>
                <option value="vegan">Vegan</option>
                <option value="jain">Jain</option>
                <option value="gluten-free">Gluten-Free</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-semibold uppercase">Prep Time (mins)</label>
              <input
                type="number"
                {...register('preparationTime', { valueAsNumber: true })}
                className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-semibold uppercase">Description</label>
            <textarea
              {...register('description')}
              rows={2}
              className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 rounded-xl focus:outline-none"
              placeholder="Brief description of ingredients..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => {
                setAddModalOpen(false);
                setEditingItem(null);
              }}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/10"
            >
              {isSubmitting ? 'Saving...' : editingItem ? 'Update Dish' : 'Add Dish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
