import { create } from 'zustand';
import type { UserProfile } from '@restaurant-qr/core';

interface StaffStoreState {
  isAddModalOpen: boolean;
  editingStaff: UserProfile | null;
  setAddModalOpen: (open: boolean) => void;
  setEditingStaff: (staff: UserProfile | null) => void;
}

export const useStaffStore = create<StaffStoreState>((set) => ({
  isAddModalOpen: false,
  editingStaff: null,
  setAddModalOpen: (open) => set({ isAddModalOpen: open }),
  setEditingStaff: (staff) => set({ editingStaff: staff, isAddModalOpen: !!staff })
}));
