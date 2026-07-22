import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs,
  query,
  where
} from 'firebase/firestore';
import type { Payment, IPaymentRepository } from '@restaurant-qr/core';

export const PaymentConverter: any = {
  toFirestore(payment: Payment): any {
    return {
      orderId: payment.orderId,
      tenantId: payment.tenantId,
      gateway: payment.gateway,
      transactionId: payment.transactionId,
      status: payment.status,
      amountMinor: payment.amountMinor,
      // Auditing
      createdAt: payment.createdAt || new Date(),
      createdBy: payment.createdBy || null,
      updatedAt: payment.updatedAt || new Date(),
      updatedBy: payment.updatedBy || null,
      isDeleted: payment.isDeleted || false,
      deletedAt: payment.deletedAt || null,
      deletedBy: payment.deletedBy || null
    };
  },
  fromFirestore(snapshot: any, options: any): Payment {
    const data = snapshot.data(options);
    const toDate = (val: any): Date => {
      if (!val) return new Date();
      if (typeof val.toDate === 'function') return val.toDate();
      if (val instanceof Date) return val;
      return new Date(val);
    };
    return {
      paymentId: snapshot.id,
      orderId: data.orderId,
      tenantId: data.tenantId,
      gateway: data.gateway,
      transactionId: data.transactionId,
      status: data.status,
      amountMinor: data.amountMinor || 0,
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

export class PaymentRepository implements IPaymentRepository {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async getById(tenantId: string, id: string): Promise<Payment | null> {
    const docRef = doc(this.db, 'tenants', tenantId, 'payments', id).withConverter(PaymentConverter);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as Payment) : null;
  }

  async save(tenantId: string, payment: Payment): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'payments', payment.paymentId).withConverter(PaymentConverter);
    await setDoc(docRef, payment);
  }

  async listByOrder(tenantId: string, orderId: string): Promise<Payment[]> {
    const colRef = collection(this.db, 'tenants', tenantId, 'payments').withConverter(PaymentConverter);
    const q = query(colRef, where('orderId', '==', orderId));
    const querySnap = await getDocs(q);
    return querySnap.docs.map((doc: any) => doc.data() as Payment);
  }
}
