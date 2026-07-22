import { db } from '../lib/firebase.js';
import { doc, collection } from 'firebase/firestore';
import { MenuRepository } from '@restaurant-qr/infra';
import type { MenuItem } from '@restaurant-qr/core';
import { CsvValidator, type CsvValidationResult } from '../utils/CsvValidator.js';

const MOCK_MENU_KEY = 'restaurant_qr_mock_menu_db';

export class MenuService {
  /**
   * Saves or updates a menu item using MenuRepository or local storage sandbox
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

    const repo = new MenuRepository(db);
    await repo.save(tenantId, item);
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

    const repo = new MenuRepository(db);
    const item = await repo.getById(tenantId, itemId);
    if (item) {
      item.stockStatus = nextStatus as any;
      await repo.save(tenantId, item);
    }
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

    const repo = new MenuRepository(db);
    await repo.delete(tenantId, itemId);
  }

  /**
   * Validates and batch imports CSV items, avoiding duplicate items (same name & category)
   */
  static async importCsv(
    tenantId: string,
    csvText: string,
    isMockMode: boolean,
    onProgress?: (current: number, total: number) => void
  ): Promise<CsvValidationResult> {
    const validation = CsvValidator.validateMenuCsv(csvText);
    if (!validation.isValid) {
      return validation;
    }

    // Load existing items to prevent duplicates
    let existingItems: MenuItem[] = [];
    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_MENU_KEY);
      const parsed: MenuItem[] = stored ? JSON.parse(stored) : [];
      existingItems = parsed.filter((m) => m.tenantId === tenantId);
    } else {
      const repo = new MenuRepository(db);
      existingItems = await repo.listByTenant(tenantId);
    }

    const existingKeys = new Set(
      existingItems.map((item) => `${item.categoryId.toLowerCase()}:${item.name.toLowerCase().trim()}`)
    );

    const validRowsToImport = validation.validRows.filter((row) => {
      const key = `${row.categoryId.toLowerCase()}:${row.name.toLowerCase().trim()}`;
      return !existingKeys.has(key);
    });

    if (validRowsToImport.length === 0) {
      return {
        ...validation,
        validRows: [],
        errors: [...validation.errors, 'All items in CSV already exist in the menu. Skipping duplicates.']
      };
    }

    const newItems: MenuItem[] = validRowsToImport.map((row) => ({
      id: doc(collection(db, 'tenants', tenantId, 'menu_items')).id,
      tenantId,
      categoryId: row.categoryId,
      name: row.name,
      description: row.description,
      price: row.price,
      priceMinor: Math.round(row.price * 100),
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
      const updated = [...parsed];
      for (let i = 0; i < newItems.length; i++) {
        updated.push(newItems[i]);
        if (onProgress) {
          onProgress(i + 1, newItems.length);
        }
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      localStorage.setItem(MOCK_MENU_KEY, JSON.stringify(updated));
    } else {
      const repo = new MenuRepository(db);
      for (let i = 0; i < newItems.length; i++) {
        await repo.save(tenantId, newItems[i]);
        if (onProgress) {
          onProgress(i + 1, newItems.length);
        }
      }
    }

    return {
      ...validation,
      validRows: validRowsToImport
    };
  }
}
