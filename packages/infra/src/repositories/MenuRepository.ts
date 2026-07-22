import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc,
  collection, 
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import type { MenuItem, IMenuRepository } from '@restaurant-qr/core';

export const MenuItemConverter: any = {
  toFirestore(item: MenuItem): any {
    return {
      tenantId: item.tenantId,
      categoryId: item.categoryId,
      categoryName: item.categoryName || null,
      name: item.name,
      description: item.description,
      price: item.price,
      priceMinor: item.priceMinor !== undefined ? item.priceMinor : Math.round(item.price * 100),
      discountedPrice: item.discountedPrice || null,
      discountedPriceMinor: item.discountedPriceMinor !== undefined ? item.discountedPriceMinor : (item.discountedPrice ? Math.round(item.discountedPrice * 100) : null),
      images: item.images,
      dietaryTags: item.dietaryTags,
      spiceLevel: item.spiceLevel || null,
      allergens: item.allergens,
      stockStatus: item.stockStatus,
      preparationTime: item.preparationTime,
      variants: item.variants || null,
      addons: item.addons || null,
      modifierGroups: item.modifierGroups || null,
      searchKeywords: item.searchKeywords || null,
      isActive: item.isActive,
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
  fromFirestore(snapshot: any, options: any): MenuItem {
    const data = snapshot.data(options);
    const toDate = (val: any): Date | undefined => {
      if (!val) return undefined;
      if (typeof val.toDate === 'function') return val.toDate();
      if (val instanceof Date) return val;
      return new Date(val);
    };
    return {
      id: snapshot.id,
      tenantId: data.tenantId,
      categoryId: data.categoryId,
      categoryName: data.categoryName || undefined,
      name: data.name,
      description: data.description,
      price: data.price,
      priceMinor: data.priceMinor !== undefined ? data.priceMinor : Math.round(data.price * 100),
      discountedPrice: data.discountedPrice || undefined,
      discountedPriceMinor: data.discountedPriceMinor || undefined,
      images: data.images || [],
      dietaryTags: data.dietaryTags || [],
      spiceLevel: data.spiceLevel || undefined,
      allergens: data.allergens || [],
      stockStatus: data.stockStatus,
      preparationTime: data.preparationTime,
      variants: data.variants || undefined,
      addons: data.addons || undefined,
      modifierGroups: data.modifierGroups || undefined,
      searchKeywords: data.searchKeywords || undefined,
      isActive: data.isActive,
      // Auditing
      createdAt: toDate(data.createdAt) || new Date(),
      createdBy: data.createdBy || undefined,
      updatedAt: toDate(data.updatedAt),
      updatedBy: data.updatedBy || undefined,
      isDeleted: data.isDeleted || false,
      deletedAt: toDate(data.deletedAt),
      deletedBy: data.deletedBy || undefined
    };
  }
};

export class MenuRepository implements IMenuRepository {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async getById(tenantId: string, itemId: string): Promise<MenuItem | null> {
    const docRef = doc(this.db, 'tenants', tenantId, 'menu_items', itemId).withConverter(MenuItemConverter);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as MenuItem) : null;
  }

  async save(tenantId: string, item: MenuItem): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'menu_items', item.id).withConverter(MenuItemConverter);
    await setDoc(docRef, item);
  }

  async delete(tenantId: string, itemId: string): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'menu_items', itemId);
    await deleteDoc(docRef);
  }

  async listByTenant(tenantId: string): Promise<MenuItem[]> {
    const colRef = collection(this.db, 'tenants', tenantId, 'menu_items').withConverter(MenuItemConverter);
    const querySnap = await getDocs(colRef);
    return querySnap.docs.map((doc: any) => doc.data());
  }

  subscribeMenu(tenantId: string, callback: (items: MenuItem[]) => void): () => void {
    const colRef = collection(this.db, 'tenants', tenantId, 'menu_items').withConverter(MenuItemConverter);
    return onSnapshot(colRef, (snap: any) => {
      callback(snap.docs.map((doc: any) => doc.data()));
    });
  }
}
