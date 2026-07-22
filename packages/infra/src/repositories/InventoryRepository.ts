import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  getDocs 
} from 'firebase/firestore';
import type { InventoryItem, IInventoryRepository } from '@restaurant-qr/core';

export const InventoryConverter: any = {
  toFirestore(item: InventoryItem): any {
    return {
      tenantId: item.tenantId,
      name: item.name,
      unit: item.unit,
      availableQty: item.availableQty,
      reservedQty: item.reservedQty || 0,
      wastageQty: item.wastageQty || 0,
      currentStock: item.availableQty, // Legacy compatibility
      minStockLevel: item.minStockLevel,
      supplierId: item.supplierId || null,
      avgCost: item.avgCost,
      // Auditing
      createdAt: item.createdAt || new Date(),
      createdBy: item.createdBy || null,
      updatedAt: item.updatedAt || new Date(),
      updatedBy: item.updatedBy || null,
      isDeleted: item.isDeleted || false,
      deletedAt: item.deletedAt || null,
      deletedBy: item.deletedBy || null
    };
  },
  fromFirestore(snapshot: any, options: any): InventoryItem {
    const data = snapshot.data(options);
    const toDate = (val: any): Date => {
      if (!val) return new Date();
      if (typeof val.toDate === 'function') return val.toDate();
      if (val instanceof Date) return val;
      return new Date(val);
    };
    
    // Support fallback from currentStock to availableQty
    const available = data.availableQty !== undefined ? data.availableQty : (data.currentStock || 0);

    return {
      id: snapshot.id,
      tenantId: data.tenantId,
      name: data.name,
      unit: data.unit,
      availableQty: available,
      reservedQty: data.reservedQty || 0,
      wastageQty: data.wastageQty || 0,
      currentStock: available,
      minStockLevel: data.minStockLevel || 0,
      supplierId: data.supplierId || undefined,
      avgCost: data.avgCost || 0,
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

export class InventoryRepository implements IInventoryRepository {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async getById(tenantId: string, id: string): Promise<InventoryItem | null> {
    const docRef = doc(this.db, 'tenants', tenantId, 'inventory', id).withConverter(InventoryConverter);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as InventoryItem) : null;
  }

  async save(tenantId: string, item: InventoryItem): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'inventory', item.id).withConverter(InventoryConverter);
    await setDoc(docRef, item);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'inventory', id);
    await deleteDoc(docRef);
  }

  async listAll(tenantId: string): Promise<InventoryItem[]> {
    const colRef = collection(this.db, 'tenants', tenantId, 'inventory').withConverter(InventoryConverter);
    const querySnap = await getDocs(colRef);
    return querySnap.docs.map((doc: any) => doc.data() as InventoryItem);
  }
}
