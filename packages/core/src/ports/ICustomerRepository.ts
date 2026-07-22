import type { Customer } from '../domain/types.js';

export interface ICustomerRepository {
  getById(tenantId: string, id: string): Promise<Customer | null>;
  save(tenantId: string, customer: Customer): Promise<void>;
  delete(tenantId: string, id: string): Promise<void>;
  listAll(tenantId: string): Promise<Customer[]>;
}
