import type { InventoryItem } from '../domain/types.js';

export interface IInventoryRepository {
  getById(tenantId: string, id: string): Promise<InventoryItem | null>;
  save(tenantId: string, item: InventoryItem): Promise<void>;
  delete(tenantId: string, id: string): Promise<void>;
  listAll(tenantId: string): Promise<InventoryItem[]>;
}
