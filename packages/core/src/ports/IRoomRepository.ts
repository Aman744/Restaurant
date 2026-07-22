import type { Room } from '../domain/types.js';

export interface IRoomRepository {
  getById(tenantId: string, id: string): Promise<Room | null>;
  save(tenantId: string, room: Room): Promise<void>;
  delete(tenantId: string, id: string): Promise<void>;
  listAll(tenantId: string): Promise<Room[]>;
  subscribeRooms(tenantId: string, callback: (rooms: Room[]) => void): () => void;
}
