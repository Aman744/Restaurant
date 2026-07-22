import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import type { Table, ITableRepository } from '@restaurant-qr/core';

export const TableConverter: any = {
  toFirestore(table: Table): any {
    return {
      tenantId: table.tenantId,
      number: table.number,
      seatingCapacity: table.seatingCapacity,
      status: table.status,
      qrToken: table.qrToken,
      activeSessionId: table.activeSessionId || null,
      activeOrderId: table.activeOrderId || null,
      createdAt: table.createdAt || new Date()
    };
  },
  fromFirestore(snapshot: any, options: any): Table {
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
      number: data.number,
      seatingCapacity: data.seatingCapacity,
      status: data.status,
      qrToken: data.qrToken,
      activeSessionId: data.activeSessionId || undefined,
      activeOrderId: data.activeOrderId || undefined,
      createdAt: toDate(data.createdAt)
    };
  }
};

export class TableRepository implements ITableRepository {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async getById(tenantId: string, id: string): Promise<Table | null> {
    const docRef = doc(this.db, 'tenants', tenantId, 'tables', id).withConverter(TableConverter);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as Table) : null;
  }

  async save(tenantId: string, table: Table): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'tables', table.id).withConverter(TableConverter);
    await setDoc(docRef, table);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'tables', id);
    await deleteDoc(docRef);
  }

  async listAll(tenantId: string): Promise<Table[]> {
    const colRef = collection(this.db, 'tenants', tenantId, 'tables').withConverter(TableConverter);
    const querySnap = await getDocs(colRef);
    return querySnap.docs.map((doc: any) => doc.data() as Table);
  }

  subscribeTables(tenantId: string, callback: (tables: Table[]) => void): () => void {
    const colRef = collection(this.db, 'tenants', tenantId, 'tables').withConverter(TableConverter);
    return onSnapshot(colRef, (snap: any) => {
      callback(snap.docs.map((doc: any) => doc.data() as Table));
    });
  }
}
