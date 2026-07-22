import type { Reservation } from '../domain/types.js';

export interface IReservationRepository {
  getById(tenantId: string, id: string): Promise<Reservation | null>;
  save(tenantId: string, reservation: Reservation): Promise<void>;
  delete(tenantId: string, id: string): Promise<void>;
  listAll(tenantId: string): Promise<Reservation[]>;
}
