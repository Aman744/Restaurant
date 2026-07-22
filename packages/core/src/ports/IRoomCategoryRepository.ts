import type { RoomCategory } from '../domain/types.js';

export interface IRoomCategoryRepository {
  getById(tenantId: string, id: string): Promise<RoomCategory | null>;
  save(tenantId: string, category: RoomCategory): Promise<void>;
  delete(tenantId: string, id: string): Promise<void>;
  listAll(tenantId: string): Promise<RoomCategory[]>;
}
