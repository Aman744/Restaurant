import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  collection, 
  getDocs
} from 'firebase/firestore';
import type { Tenant, ITenantRepository } from '@restaurant-qr/core';

export const TenantConverter: any = {
  toFirestore(tenant: Tenant): any {
    return {
      name: tenant.name,
      domain: tenant.domain || null,
      logoUrl: tenant.logoUrl || null,
      theme: tenant.theme || null,
      subscription: {
        planId: tenant.subscription?.planId || 'starter',
        status: tenant.subscription?.status || 'active',
        currentPeriodEnd: tenant.subscription?.currentPeriodEnd || new Date(),
        stripeSubscriptionId: tenant.subscription?.stripeSubscriptionId || null,
        limits: tenant.subscription?.limits || { tablesPerRestaurant: 10, monthlyOrders: 1000 }
      },
      createdAt: tenant.createdAt || new Date()
    };
  },
  fromFirestore(snapshot: any, options: any): Tenant {
    const data = snapshot.data(options);

    // Safe timestamp parser — handles Firestore Timestamps, JS Dates, strings, and nulls
    const toDate = (val: any): Date => {
      if (!val) return new Date();
      if (typeof val.toDate === 'function') return val.toDate();
      if (val instanceof Date) return val;
      return new Date(val);
    };

    const sub = data.subscription || {};

    return {
      id: snapshot.id,
      name: data.name || 'Unnamed Restaurant',
      domain: data.domain || undefined,
      logoUrl: data.logoUrl || undefined,
      theme: data.theme || {
        primaryColor: '#10b981',
        secondaryColor: '#34d399',
        fontFamily: 'Inter',
        receiptTheme: { header: data.name || '', footer: 'Thank you!', showTaxDetails: true },
        pwaTheme: { themeColor: '#10b981', backgroundColor: '#000000' }
      },
      subscription: {
        planId: sub.planId || 'starter',
        status: sub.status || 'active',
        currentPeriodEnd: toDate(sub.currentPeriodEnd),
        stripeSubscriptionId: sub.stripeSubscriptionId || undefined,
        limits: sub.limits || { tablesPerRestaurant: 10, monthlyOrders: 1000 }
      },
      createdAt: toDate(data.createdAt)
    };
  }
};

export class TenantRepository implements ITenantRepository {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  private getCollection() {
    return collection(this.db, 'tenants').withConverter(TenantConverter);
  }

  async getById(id: string): Promise<Tenant | null> {
    const docRef = doc(this.db, 'tenants', id).withConverter(TenantConverter);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : null;
  }

  async save(tenant: Tenant): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenant.id).withConverter(TenantConverter);
    await setDoc(docRef, tenant);
  }

  async delete(id: string): Promise<void> {
    const docRef = doc(this.db, 'tenants', id);
    await deleteDoc(docRef);
  }

  async update(id: string, updates: Partial<Tenant>): Promise<void> {
    const docRef = doc(this.db, 'tenants', id);
    await updateDoc(docRef, updates as any);
  }

  async listAll(): Promise<Tenant[]> {
    const querySnap = await getDocs(this.getCollection());
    return querySnap.docs.map((doc: any) => doc.data());
  }
}
