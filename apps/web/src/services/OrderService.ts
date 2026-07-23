import { db } from '../lib/firebase.js';
import { doc, runTransaction, collection } from 'firebase/firestore';
import { OrderRepository } from '@restaurant-qr/infra';
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

    const repo = new OrderRepository(db);
    const order = await repo.getById(tenantId, orderId);
    if (order) {
      order.status = status;
      order.statusHistory = order.statusHistory || [];
      order.statusHistory.push({
        status,
        timestamp: new Date(),
        actorId: 'system'
      });
      order.updatedAt = new Date();
      await repo.save(tenantId, order);
    }
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

    const orderDocRef = doc(db, 'tenants', tenantId, 'orders', orderId);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(orderDocRef);
      if (!snap.exists()) throw new Error('ORDER_NOT_FOUND');
      const orderData = snap.data() as Order;

      // Idempotency: skip if already settled
      if (orderData.payment?.status === 'paid') {
        return;
      }

      transaction.update(orderDocRef, {
        status: 'completed',
        payment: {
          status: 'paid',
          method: paymentMethod,
          amountPaid: amount,
          amountPaidMinor: Math.round(amount * 100)
        },
        updatedAt: new Date()
      });
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

    const repo = new OrderRepository(db);
    const order = await repo.getById(tenantId, orderId);
    if (order) {
      order.isDeleted = true;
      order.deletedAt = new Date();
      await repo.save(tenantId, order);
    }
  }

  /**
   * Submits a new order using the OrderRepository
   */
  static async submitOrder(tenantId: string, order: Order, isMockMode: boolean): Promise<void> {
    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_ORDERS_KEY);
      const existingOrders = stored ? JSON.parse(stored) : [];
      // Idempotency check for mock mode
      if (existingOrders.some((o: any) => o.id === order.id)) return;
      existingOrders.push(order);
      localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(existingOrders));
      return;
    }

    const orderDocRef = doc(db, 'tenants', tenantId, 'orders', order.id);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(orderDocRef);
      if (snap.exists()) {
        return; // Idempotent exit
      }

      // Write order header
      transaction.set(orderDocRef, order);

      // Write order items inside sub-collection atomically
      const itemsColRef = collection(db, 'tenants', tenantId, 'orders', order.id, 'order_items');
      for (const item of order.items) {
        const itemDocRef = doc(itemsColRef, item.id);
        transaction.set(itemDocRef, item);
      }
    });
  }
}
