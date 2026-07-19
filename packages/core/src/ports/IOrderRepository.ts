import type { Order } from '../domain/types.js';

export interface IOrderRepository {
  getById(tenantId: string, orderId: string): Promise<Order | null>;
  save(tenantId: string, order: Order): Promise<void>;
  listActive(tenantId: string): Promise<Order[]>;
  subscribeActive(tenantId: string, callback: (orders: Order[]) => void): () => void;
  subscribeAll(tenantId: string, callback: (orders: Order[]) => void): () => void;
}
