import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  getDocs 
} from 'firebase/firestore';
import type { Reservation, IReservationRepository } from '@restaurant-qr/core';

export const ReservationConverter: any = {
  toFirestore(res: Reservation): any {
    return {
      tenantId: res.tenantId,
      tableId: res.tableId || null,
      customerId: res.customerId || null,
      customerName: res.customerName,
      customerPhone: res.customerPhone,
      dateTime: res.dateTime,
      guestsCount: res.guestsCount,
      status: res.status,
      smsSent: res.smsSent,
      // Auditing
      createdAt: res.createdAt || new Date(),
      createdBy: res.createdBy || null,
      updatedAt: res.updatedAt || new Date(),
      updatedBy: res.updatedBy || null,
      isDeleted: res.isDeleted || false,
      deletedAt: res.deletedAt || null,
      deletedBy: res.deletedBy || null
    };
  },
  fromFirestore(snapshot: any, options: any): Reservation {
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
      tableId: data.tableId || undefined,
      customerId: data.customerId || undefined,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      dateTime: toDate(data.dateTime),
      guestsCount: data.guestsCount || 1,
      status: data.status || 'pending',
      smsSent: data.smsSent ?? false,
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

export class ReservationRepository implements IReservationRepository {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async getById(tenantId: string, id: string): Promise<Reservation | null> {
    const docRef = doc(this.db, 'tenants', tenantId, 'reservations', id).withConverter(ReservationConverter);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as Reservation) : null;
  }

  async save(tenantId: string, reservation: Reservation): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'reservations', reservation.id).withConverter(ReservationConverter);
    await setDoc(docRef, reservation);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'reservations', id);
    await deleteDoc(docRef);
  }

  async listAll(tenantId: string): Promise<Reservation[]> {
    const colRef = collection(this.db, 'tenants', tenantId, 'reservations').withConverter(ReservationConverter);
    const querySnap = await getDocs(colRef);
    return querySnap.docs.map((doc: any) => doc.data() as Reservation);
  }
}
