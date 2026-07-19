import { db } from '../lib/firebase.js';
import { doc, setDoc, deleteDoc, updateDoc, writeBatch, collection } from 'firebase/firestore';
import { MenuItemConverter } from '@restaurant-qr/infra';
import type { MenuItem } from '@restaurant-qr/core';
import { CsvValidator, type CsvValidationResult } from '../utils/CsvValidator.js';

const MOCK_MENU_KEY = 'restaurant_qr_mock_menu_db';

export class MenuService {
  /**
   * Saves or updates a menu item using Firestore converters or local storage sandbox
   */
  static async saveMenuItem(tenantId: string, item: MenuItem, isMockMode: boolean): Promise<void> {
    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_MENU_KEY);
      const parsed: MenuItem[] = stored ? JSON.parse(stored) : [];
      const index = parsed.findIndex((m) => m.id === item.id);
      if (index !== -1) {
        parsed[index] = item;
      } else {
        parsed.push(item);
      }
      localStorage.setItem(MOCK_MENU_KEY, JSON.stringify(parsed));
      return;
    }

    const docRef = doc(db, 'tenants', tenantId, 'menu_items', item.id).withConverter(MenuItemConverter);
    await setDoc(docRef, item, { merge: true });
  }

  /**
   * Toggles stock availability status
   */
  static async toggleStockStatus(tenantId: string, itemId: string, currentStatus: string, isMockMode: boolean): Promise<void> {
    const nextStatus = currentStatus === 'in-stock' ? 'out-of-stock' : 'in-stock';
    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_MENU_KEY);
      if (stored) {
        const parsed: MenuItem[] = JSON.parse(stored);
        const updated = parsed.map((m) => (m.id === itemId ? { ...m, stockStatus: nextStatus as any } : m));
        localStorage.setItem(MOCK_MENU_KEY, JSON.stringify(updated));
      }
      return;
    }

    const docRef = doc(db, 'tenants', tenantId, 'menu_items', itemId);
    await updateDoc(docRef, { stockStatus: nextStatus });
  }

  /**
   * Deletes a menu item
   */
  static async deleteMenuItem(tenantId: string, itemId: string, isMockMode: boolean): Promise<void> {
    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_MENU_KEY);
      if (stored) {
        const parsed: MenuItem[] = JSON.parse(stored);
        const updated = parsed.filter((m) => m.id !== itemId);
        localStorage.setItem(MOCK_MENU_KEY, JSON.stringify(updated));
      }
      return;
    }

    const docRef = doc(db, 'tenants', tenantId, 'menu_items', itemId);
    await deleteDoc(docRef);
  }

  /**
   * Validates and batch imports CSV items
   */
  static async importCsv(tenantId: string, csvText: string, isMockMode: boolean): Promise<CsvValidationResult> {
    const validation = CsvValidator.validateMenuCsv(csvText);
    if (!validation.isValid) {
      return validation;
    }

    const newItems: MenuItem[] = validation.validRows.map((row) => ({
      id: doc(collection(db, 'tenants', tenantId, 'menu_items')).id,
      tenantId,
      categoryId: row.categoryId,
      name: row.name,
      description: row.description,
      price: row.price,
      images: ['https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'],
      dietaryTags: row.dietaryTags,
      allergens: [],
      stockStatus: 'in-stock',
      preparationTime: row.preparationTime,
      isActive: true
    }));

    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_MENU_KEY);
      const parsed: MenuItem[] = stored ? JSON.parse(stored) : [];
      const updated = [...parsed, ...newItems];
      localStorage.setItem(MOCK_MENU_KEY, JSON.stringify(updated));
    } else {
      const batch = writeBatch(db);
      newItems.forEach((item) => {
        const docRef = doc(db, 'tenants', tenantId, 'menu_items', item.id).withConverter(MenuItemConverter);
        batch.set(docRef, item);
      });
      await batch.commit();
    }

    return validation;
  }
}
