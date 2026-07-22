import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import type { Room, IRoomRepository } from '@restaurant-qr/core';

export const RoomConverter: any = {
  toFirestore(room: Room): any {
    return {
      tenantId: room.tenantId,
      branchId: room.branchId || null,
      roomNumber: room.roomNumber,
      roomName: room.roomName,
      categoryId: room.categoryId || null,
      floor: room.floor !== undefined ? room.floor : null,
      zone: room.zone || null,
      capacity: room.capacity,
      billingMode: room.billingMode,
      basePrice: room.basePrice !== undefined ? room.basePrice : null,
      hourlyRate: room.hourlyRate !== undefined ? room.hourlyRate : null,
      minimumSpend: room.minimumSpend !== undefined ? room.minimumSpend : null,
      taxProfileId: room.taxProfileId || null,
      serviceCharge: room.serviceCharge !== undefined ? room.serviceCharge : null,
      status: room.status,
      activeOrderId: room.activeOrderId || null,
      activeStayId: room.activeStayId || null,
      qr: {
        id: room.qr.id,
        url: room.qr.url,
        version: room.qr.version,
        generatedAt: room.qr.generatedAt,
        expiresAt: room.qr.expiresAt || null,
        enabled: room.qr.enabled
      },
      features: room.features,
      notes: room.notes || null,
      createdAt: room.createdAt || new Date(),
      updatedAt: room.updatedAt || new Date()
    };
  },
  fromFirestore(snapshot: any, options: any): Room {
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
      branchId: data.branchId || undefined,
      roomNumber: data.roomNumber,
      roomName: data.roomName,
      categoryId: data.categoryId || undefined,
      floor: data.floor !== null ? data.floor : undefined,
      zone: data.zone || undefined,
      capacity: data.capacity,
      billingMode: data.billingMode || 'FREE',
      basePrice: data.basePrice !== null ? data.basePrice : undefined,
      hourlyRate: data.hourlyRate !== null ? data.hourlyRate : undefined,
      minimumSpend: data.minimumSpend !== null ? data.minimumSpend : undefined,
      taxProfileId: data.taxProfileId || undefined,
      serviceCharge: data.serviceCharge !== null ? data.serviceCharge : undefined,
      status: data.status || 'available',
      activeOrderId: data.activeOrderId || undefined,
      activeStayId: data.activeStayId || undefined,
      qr: {
        id: data.qr?.id || '',
        url: data.qr?.url || '',
        version: data.qr?.version || 1,
        generatedAt: toDate(data.qr?.generatedAt),
        expiresAt: data.qr?.expiresAt ? toDate(data.qr.expiresAt) : undefined,
        enabled: data.qr?.enabled ?? true
      },
      features: data.features || [],
      notes: data.notes || undefined,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt)
    };
  }
};

export class RoomRepository implements IRoomRepository {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async getById(tenantId: string, id: string): Promise<Room | null> {
    const docRef = doc(this.db, 'tenants', tenantId, 'rooms', id).withConverter(RoomConverter);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as Room) : null;
  }

  async save(tenantId: string, room: Room): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'rooms', room.id).withConverter(RoomConverter);
    await setDoc(docRef, room);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'rooms', id);
    await deleteDoc(docRef);
  }

  async listAll(tenantId: string): Promise<Room[]> {
    const colRef = collection(this.db, 'tenants', tenantId, 'rooms').withConverter(RoomConverter);
    const snap = await getDocs(colRef);
    return snap.docs.map((doc) => doc.data() as Room);
  }

  subscribeRooms(tenantId: string, callback: (rooms: Room[]) => void): () => void {
    const colRef = collection(this.db, 'tenants', tenantId, 'rooms').withConverter(RoomConverter);
    return onSnapshot(colRef, (snap: any) => {
      callback(snap.docs.map((doc: any) => doc.data() as Room));
    }, (err: any) => {
      console.warn("Firestore rooms subscription permission error:", err);
      callback([]);
    });
  }
}
