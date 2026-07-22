import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import type { RoomReservation, IRoomReservationRepository } from '@restaurant-qr/core';

export const RoomReservationConverter: any = {
  toFirestore(res: RoomReservation): any {
    return {
      reservationNumber: res.reservationNumber,
      tenantId: res.tenantId,
      branchId: res.branchId || null,
      roomId: res.roomId,
      reservationName: res.reservationName,
      phone: res.phone,
      guestsCount: res.guestsCount,
      startTime: res.startTime,
      endTime: res.endTime,
      status: res.status,
      notes: res.notes || null,
      createdAt: res.createdAt || new Date()
    };
  },
  fromFirestore(snapshot: any, options: any): RoomReservation {
    const data = snapshot.data(options);
    const toDate = (val: any): Date => {
      if (!val) return new Date();
      if (typeof val.toDate === 'function') return val.toDate();
      if (val instanceof Date) return val;
      return new Date(val);
    };
    return {
      id: snapshot.id,
      reservationNumber: data.reservationNumber || `RES-${snapshot.id}`,
      tenantId: data.tenantId,
      branchId: data.branchId || undefined,
      roomId: data.roomId,
      reservationName: data.reservationName,
      phone: data.phone,
      guestsCount: data.guestsCount,
      startTime: toDate(data.startTime),
      endTime: toDate(data.endTime),
      status: data.status || 'reserved',
      notes: data.notes || undefined,
      createdAt: toDate(data.createdAt)
    };
  }
};

export class RoomReservationRepository implements IRoomReservationRepository {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async getById(tenantId: string, roomId: string, id: string): Promise<RoomReservation | null> {
    const docRef = doc(this.db, 'tenants', tenantId, 'rooms', roomId, 'reservations', id).withConverter(RoomReservationConverter);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as RoomReservation) : null;
  }

  async save(tenantId: string, roomId: string, reservation: RoomReservation): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'rooms', roomId, 'reservations', reservation.id).withConverter(RoomReservationConverter);
    await setDoc(docRef, reservation);
  }

  async delete(tenantId: string, roomId: string, id: string): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'rooms', roomId, 'reservations', id);
    await deleteDoc(docRef);
  }

  async listByRoom(tenantId: string, roomId: string): Promise<RoomReservation[]> {
    const colRef = collection(this.db, 'tenants', tenantId, 'rooms', roomId, 'reservations').withConverter(RoomReservationConverter);
    const snap = await getDocs(colRef);
    return snap.docs.map((doc) => doc.data() as RoomReservation);
  }

  subscribeReservations(tenantId: string, roomId: string, callback: (reservations: RoomReservation[]) => void): () => void {
    const colRef = collection(this.db, 'tenants', tenantId, 'rooms', roomId, 'reservations').withConverter(RoomReservationConverter);
    return onSnapshot(colRef, (snap: any) => {
      callback(snap.docs.map((doc: any) => doc.data() as RoomReservation));
    }, (err: any) => {
      console.warn("Firestore reservations subscription permission error:", err);
      callback([]);
    });
  }

  async listAllActive(tenantId: string): Promise<RoomReservation[]> {
    const roomsCol = collection(this.db, 'tenants', tenantId, 'rooms');
    const roomsSnap = await getDocs(roomsCol);
    const allReservations: RoomReservation[] = [];
    
    for (const roomDoc of roomsSnap.docs) {
      const resCol = collection(this.db, 'tenants', tenantId, 'rooms', roomDoc.id, 'reservations').withConverter(RoomReservationConverter);
      const resSnap = await getDocs(resCol);
      allReservations.push(...resSnap.docs.map((doc) => doc.data() as RoomReservation));
    }
    
    return allReservations;
  }
}
