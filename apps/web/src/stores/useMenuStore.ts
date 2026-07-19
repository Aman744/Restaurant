import { create } from 'zustand';
import type { MenuItem } from '@restaurant-qr/core';

interface MenuStoreState {
  isAddModalOpen: boolean;
  editingItem: MenuItem | null;
  selectedCategory: string;
  searchQuery: string;
  setAddModalOpen: (open: boolean) => void;
  setEditingItem: (item: MenuItem | null) => void;
  setSelectedCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;
}

export const useMenuStore = create<MenuStoreState>((set) => ({
  isAddModalOpen: false,
  editingItem: null,
  selectedCategory: 'all',
  searchQuery: '',
  setAddModalOpen: (open) => set({ isAddModalOpen: open }),
  setEditingItem: (item) => set({ editingItem: item, isAddModalOpen: !!item }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query })
}));
