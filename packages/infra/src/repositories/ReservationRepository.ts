import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs 
} from 'firebase/firestore';
import type { Reservation, IReservationRepository } from '@restaurant-qr/core';

export const ReservationConverter: any = {
  toFirestore(res: Reservation): any {
    return {
      customerName: res.customerName,
      customerPhone: res.customerPhone,
      dateTime: res.dateTime,
      guestsCount: res.guestsCount,
      status: res.status,
      smsSent: res.smsSent
    };
  },
  fromFirestore(snapshot: any, options: any): Reservation {
    const data = snapshot.data(options);
    const toDate = (val: any): Date => {
      if (!val) return new Date();
      if (typeof val.toDate === 'function') return val.toDate();
      return new Date(val);
    };
    return {
      id: snapshot.id,
      tenantId: data.tenantId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      dateTime: toDate(data.dateTime),
      guestsCount: data.guestsCount,
      status: data.status,
      smsSent: data.smsSent
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

  async listByTenant(tenantId: string): Promise<Reservation[]> {
    const colRef = collection(this.db, 'tenants', tenantId, 'reservations').withConverter(ReservationConverter);
    const snap = await getDocs(colRef);
    return snap.docs.map((d: any) => d.data() as Reservation);
  }
}
