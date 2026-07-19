import { db } from '../lib/firebase.js';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { Order, OrderStatus } from '@restaurant-qr/core';

const MOCK_ORDERS_KEY = 'restaurant_qr_mock_orders_db';

export class OrderService {
  /**
   * Updates overall order status atomically
   */
  static async updateOrderStatus(tenantId: string, orderId: string, status: OrderStatus, isMockMode: boolean): Promise<void> {
    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_ORDERS_KEY);
      if (stored) {
        const parsed: Order[] = JSON.parse(stored);
        const updated = parsed.map((o) => (o.id === orderId ? { ...o, status, updatedAt: new Date() } : o));
        localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(updated));
      }
      return;
    }

    const docRef = doc(db, 'tenants', tenantId, 'orders', orderId);
    await updateDoc(docRef, { status, updatedAt: new Date() });
  }

  /**
   * Settles order payment via atomic updates
   */
  static async settleOrderPayment(tenantId: string, orderId: string, paymentMethod: 'cash' | 'card' | 'upi', amount: number, isMockMode: boolean): Promise<void> {
    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_ORDERS_KEY);
      if (stored) {
        const parsed: Order[] = JSON.parse(stored);
        const updated = parsed.map((o) => {
          if (o.id === orderId) {
            return {
              ...o,
              status: 'completed' as const,
              payment: {
                ...o.payment,
                status: 'paid' as const,
                method: paymentMethod,
                amountPaid: amount
              },
              updatedAt: new Date()
            };
          }
          return o;
        });
        localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(updated));
      }
      return;
    }

    const docRef = doc(db, 'tenants', tenantId, 'orders', orderId);
    await updateDoc(docRef, {
      status: 'completed',
      'payment.status': 'paid',
      'payment.method': paymentMethod,
      'payment.amountPaid': amount,
      updatedAt: new Date()
    });
  }

  /**
   * Deletes an order (Admin role restricted)
   */
  static async deleteOrder(tenantId: string, orderId: string, isMockMode: boolean): Promise<void> {
    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_ORDERS_KEY);
      if (stored) {
        const parsed: Order[] = JSON.parse(stored);
        const updated = parsed.filter((o) => o.id !== orderId);
        localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(updated));
      }
      return;
    }

    const docRef = doc(db, 'tenants', tenantId, 'orders', orderId);
    await deleteDoc(docRef);
  }
}
