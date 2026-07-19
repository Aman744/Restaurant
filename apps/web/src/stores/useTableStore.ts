import { create } from 'zustand';
import type { Table } from '@restaurant-qr/core';

interface TableStoreState {
  isAddModalOpen: boolean;
  viewingQrTable: Table | null;
  setAddModalOpen: (open: boolean) => void;
  setViewingQrTable: (table: Table | null) => void;
}

export const useTableStore = create<TableStoreState>((set) => ({
  isAddModalOpen: false,
  viewingQrTable: null,
  setAddModalOpen: (open) => set({ isAddModalOpen: open }),
  setViewingQrTable: (table) => set({ viewingQrTable: table })
}));
