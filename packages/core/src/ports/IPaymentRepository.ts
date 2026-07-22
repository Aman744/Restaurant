import type { Payment } from '../domain/types.js';

export interface IPaymentRepository {
  getById(tenantId: string, id: string): Promise<Payment | null>;
  save(tenantId: string, payment: Payment): Promise<void>;
  listByOrder(tenantId: string, orderId: string): Promise<Payment[]>;
}
