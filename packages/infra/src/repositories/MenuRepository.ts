import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc,
  collection, 
  getDocs
} from 'firebase/firestore';
import type { MenuItem, IMenuRepository } from '@restaurant-qr/core';

export const MenuItemConverter: any = {
  toFirestore(item: MenuItem): any {
    return {
      tenantId: item.tenantId,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description,
      price: item.price,
      discountedPrice: item.discountedPrice || null,
      images: item.images,
      dietaryTags: item.dietaryTags,
      spiceLevel: item.spiceLevel || null,
      allergens: item.allergens,
      stockStatus: item.stockStatus,
      preparationTime: item.preparationTime,
      variants: item.variants || null,
      addons: item.addons || null,
      isActive: item.isActive
    };
  },
  fromFirestore(snapshot: any, options: any): MenuItem {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      tenantId: data.tenantId,
      categoryId: data.categoryId,
      name: data.name,
      description: data.description,
      price: data.price,
      discountedPrice: data.discountedPrice || undefined,
      images: data.images || [],
      dietaryTags: data.dietaryTags || [],
      spiceLevel: data.spiceLevel || undefined,
      allergens: data.allergens || [],
      stockStatus: data.stockStatus,
      preparationTime: data.preparationTime,
      variants: data.variants || undefined,
      addons: data.addons || undefined,
      isActive: data.isActive
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
}
