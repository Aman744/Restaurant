import { db } from '../lib/firebase.js';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import type { Table } from '@restaurant-qr/core';

const MOCK_TABLES_KEY = 'restaurant_qr_mock_tables_db';

export class TableService {
  /**
   * Provisions a dining table with native crypto UUID or Firestore auto ID
   */
  static async createTable(tenantId: string, number: string, seatingCapacity: number, isMockMode: boolean): Promise<Table> {
    const tableId = `tbl_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const qrToken = `qr_token_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    const newTable: Table = {
      id: tableId,
      tenantId,
      number,
      seatingCapacity,
      status: 'available',
      qrToken,
      createdAt: new Date()
    };

    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_TABLES_KEY);
      const parsed: Table[] = stored ? JSON.parse(stored) : [];
      parsed.push(newTable);
      localStorage.setItem(MOCK_TABLES_KEY, JSON.stringify(parsed));
      return newTable;
    }

    const docRef = doc(db, 'tenants', tenantId, 'tables', tableId);
    await setDoc(docRef, newTable);
    return newTable;
  }

  /**
   * Deletes a dining table
   */
  static async deleteTable(tenantId: string, tableId: string, isMockMode: boolean): Promise<void> {
    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_TABLES_KEY);
      if (stored) {
        const parsed: Table[] = JSON.parse(stored);
        const updated = parsed.filter((t) => t.id !== tableId);
        localStorage.setItem(MOCK_TABLES_KEY, JSON.stringify(updated));
      }
      return;
    }

    const docRef = doc(db, 'tenants', tenantId, 'tables', tableId);
    await deleteDoc(docRef);
  }

  /**
   * Clears all mock tables to reset demo storage
   */
  static async clearAllTables(_tenantId: string, isMockMode: boolean): Promise<void> {
    if (isMockMode) {
      localStorage.setItem(MOCK_TABLES_KEY, JSON.stringify([]));
    }
  }
}
