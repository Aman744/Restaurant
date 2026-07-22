import type { Table } from '../domain/types.js';

export interface ITableRepository {
  getById(tenantId: string, id: string): Promise<Table | null>;
  save(tenantId: string, table: Table): Promise<void>;
  delete(tenantId: string, id: string): Promise<void>;
  listAll(tenantId: string): Promise<Table[]>;
  subscribeTables(tenantId: string, callback: (tables: Table[]) => void): () => void;
}
