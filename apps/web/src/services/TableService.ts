import { db } from '../lib/firebase.js';
import { TableRepository } from '@restaurant-qr/infra';
import type { Table } from '@restaurant-qr/core';

const MOCK_TABLES_KEY = 'restaurant_qr_mock_tables_db';

export class TableService {
  /**
   * Provisions a dining table with native crypto UUID or TableRepository
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

    const repo = new TableRepository(db);
    await repo.save(tenantId, newTable);
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

    const repo = new TableRepository(db);
    await repo.delete(tenantId, tableId);
  }

  /**
   * Clears all mock tables to reset demo storage
   */
  static async clearAllTables(tenantId: string, isMockMode: boolean): Promise<void> {
    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_TABLES_KEY);
      if (stored) {
        try {
          const parsed: Table[] = JSON.parse(stored);
          const updated = parsed.filter((t) => t.tenantId !== tenantId);
          localStorage.setItem(MOCK_TABLES_KEY, JSON.stringify(updated));
        } catch (e) {}
      }
    }
  }
}
