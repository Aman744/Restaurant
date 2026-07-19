import type { Tenant } from '../domain/types.js';

export interface ITenantRepository {
  getById(id: string): Promise<Tenant | null>;
  save(tenant: Tenant): Promise<void>;
  delete(id: string): Promise<void>;
  update(id: string, updates: Partial<Tenant>): Promise<void>;
  listAll(): Promise<Tenant[]>;
}
