import { db } from '../lib/firebase.js';
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

    const repo = new OrderRepository(db);
    const order = await repo.getById(tenantId, orderId);
    if (order) {
      order.status = 'completed';
      order.statusHistory = order.statusHistory || [];
      order.statusHistory.push({
        status: 'completed',
        timestamp: new Date(),
        actorId: 'cashier'
      });
      order.payment = {
        status: 'paid',
        method: paymentMethod,
        amountPaid: amount,
        amountPaidMinor: Math.round(amount * 100)
      };
      order.updatedAt = new Date();
      await repo.save(tenantId, order);
    }
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
      existingOrders.push(order);
      localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(existingOrders));
      return;
    }

    const repo = new OrderRepository(db);
    await repo.save(tenantId, order);
  }
}
