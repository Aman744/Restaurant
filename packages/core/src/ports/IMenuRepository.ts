import type { MenuItem } from '../domain/types.js';

export interface IMenuRepository {
  getById(tenantId: string, itemId: string): Promise<MenuItem | null>;
  save(tenantId: string, item: MenuItem): Promise<void>;
  delete(tenantId: string, itemId: string): Promise<void>;
  listByTenant(tenantId: string): Promise<MenuItem[]>;
}
