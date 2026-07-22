import type { RoomReservation } from '../domain/types.js';

export interface IRoomReservationRepository {
  getById(tenantId: string, roomId: string, id: string): Promise<RoomReservation | null>;
  save(tenantId: string, roomId: string, reservation: RoomReservation): Promise<void>;
  delete(tenantId: string, roomId: string, id: string): Promise<void>;
  listByRoom(tenantId: string, roomId: string): Promise<RoomReservation[]>;
  subscribeReservations(tenantId: string, roomId: string, callback: (reservations: RoomReservation[]) => void): () => void;
  listAllActive(tenantId: string): Promise<RoomReservation[]>;
}
