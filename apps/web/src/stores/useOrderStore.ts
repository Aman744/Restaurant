import { create } from 'zustand';
import type { Order } from '@restaurant-qr/core';

interface OrderStoreState {
  selectedOrder: Order | null;
  ordersFilter: 'all' | 'new' | 'pending' | 'ready' | 'completed';
  setSelectedOrder: (order: Order | null) => void;
  setOrdersFilter: (filter: 'all' | 'new' | 'pending' | 'ready' | 'completed') => void;
}

export const useOrderStore = create<OrderStoreState>((set) => ({
  selectedOrder: null,
  ordersFilter: 'all',
  setSelectedOrder: (order) => set({ selectedOrder: order }),
  setOrdersFilter: (filter) => set({ ordersFilter: filter })
}));
