import type { Reservation } from '../domain/types.js';

export interface IReservationRepository {
  getById(tenantId: string, id: string): Promise<Reservation | null>;
  save(tenantId: string, reservation: Reservation): Promise<void>;
  listByTenant(tenantId: string): Promise<Reservation[]>;
}
