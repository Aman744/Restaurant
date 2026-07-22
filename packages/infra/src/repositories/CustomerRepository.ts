import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  getDocs 
} from 'firebase/firestore';
import type { Customer, ICustomerRepository } from '@restaurant-qr/core';

export const CustomerConverter: any = {
  toFirestore(customer: Customer): any {
    return {
      tenantId: customer.tenantId,
      phone: customer.phone || null,
      email: customer.email || null,
      displayName: customer.displayName || null,
      isGuest: customer.isGuest,
      mergedIntoCustomerId: customer.mergedIntoCustomerId || null,
      totalOrders: customer.totalOrders,
      lifetimeSpendMinor: customer.lifetimeSpendMinor,
      loyaltyPoints: customer.loyaltyPoints,
      lastVisit: customer.lastVisit,
      // Auditing
      createdAt: customer.createdAt || new Date(),
      createdBy: customer.createdBy || null,
      updatedAt: customer.updatedAt || new Date(),
      updatedBy: customer.updatedBy || null,
      isDeleted: customer.isDeleted || false,
      deletedAt: customer.deletedAt || null,
      deletedBy: customer.deletedBy || null
    };
  },
  fromFirestore(snapshot: any, options: any): Customer {
    const data = snapshot.data(options);
    const toDate = (val: any): Date => {
      if (!val) return new Date();
      if (typeof val.toDate === 'function') return val.toDate();
      if (val instanceof Date) return val;
      return new Date(val);
    };
    return {
      id: snapshot.id,
      tenantId: data.tenantId,
      phone: data.phone || undefined,
      email: data.email || undefined,
      displayName: data.displayName || undefined,
      isGuest: data.isGuest ?? false,
      mergedIntoCustomerId: data.mergedIntoCustomerId || undefined,
      totalOrders: data.totalOrders || 0,
      lifetimeSpendMinor: data.lifetimeSpendMinor || 0,
      loyaltyPoints: data.loyaltyPoints || 0,
      lastVisit: toDate(data.lastVisit),
      // Auditing
      createdAt: toDate(data.createdAt),
      createdBy: data.createdBy || undefined,
      updatedAt: toDate(data.updatedAt),
      updatedBy: data.updatedBy || undefined,
      isDeleted: data.isDeleted || false,
      deletedAt: toDate(data.deletedAt),
      deletedBy: data.deletedBy || undefined
    };
  }
};

export class CustomerRepository implements ICustomerRepository {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async getById(tenantId: string, id: string): Promise<Customer | null> {
    const docRef = doc(this.db, 'tenants', tenantId, 'customers', id).withConverter(CustomerConverter);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as Customer) : null;
  }

  async save(tenantId: string, customer: Customer): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'customers', customer.id).withConverter(CustomerConverter);
    await setDoc(docRef, customer);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'customers', id);
    await deleteDoc(docRef);
  }

  async listAll(tenantId: string): Promise<Customer[]> {
    const colRef = collection(this.db, 'tenants', tenantId, 'customers').withConverter(CustomerConverter);
    const querySnap = await getDocs(colRef);
    return querySnap.docs.map((doc: any) => doc.data() as Customer);
  }
}
