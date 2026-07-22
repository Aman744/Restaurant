import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  getDocs
} from 'firebase/firestore';
import type { RoomCategory, IRoomCategoryRepository } from '@restaurant-qr/core';

export const RoomCategoryConverter: any = {
  toFirestore(cat: RoomCategory): any {
    return {
      tenantId: cat.tenantId,
      name: cat.name,
      isActive: cat.isActive,
      createdAt: cat.createdAt || new Date(),
      updatedAt: cat.updatedAt || new Date()
    };
  },
  fromFirestore(snapshot: any, options: any): RoomCategory {
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
      name: data.name,
      isActive: data.isActive ?? true,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt)
    };
  }
};

export class RoomCategoryRepository implements IRoomCategoryRepository {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async getById(tenantId: string, id: string): Promise<RoomCategory | null> {
    const docRef = doc(this.db, 'tenants', tenantId, 'room_categories', id).withConverter(RoomCategoryConverter);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as RoomCategory) : null;
  }

  async save(tenantId: string, category: RoomCategory): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'room_categories', category.id).withConverter(RoomCategoryConverter);
    await setDoc(docRef, category);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'room_categories', id);
    await deleteDoc(docRef);
  }

  async listAll(tenantId: string): Promise<RoomCategory[]> {
    const colRef = collection(this.db, 'tenants', tenantId, 'room_categories').withConverter(RoomCategoryConverter);
    const snap = await getDocs(colRef);
    return snap.docs.map((doc) => doc.data() as RoomCategory);
  }
}
