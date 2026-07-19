import { 
  doc, 
  getDoc, 
  collection, 
  getDocs,
  query,
  where,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import type { Order, OrderItem, IOrderRepository } from '@restaurant-qr/core';

export const OrderItemConverter: any = {
  toFirestore(item: OrderItem): any {
    return {
      menuItemId: item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      notes: item.notes || null,
      stationId: item.stationId,
      status: item.status,
      selectedVariant: item.selectedVariant || null,
      selectedAddons: item.selectedAddons || null
    };
  },
  fromFirestore(snapshot: any, options: any): OrderItem {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      menuItemId: data.menuItemId,
      name: data.name,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      totalPrice: data.totalPrice,
      notes: data.notes || undefined,
      stationId: data.stationId,
      status: data.status,
      selectedVariant: data.selectedVariant || undefined,
      selectedAddons: data.selectedAddons || undefined
    };
  }
};

export const OrderConverter: any = {
  toFirestore(order: Omit<Order, 'items'>): any {
    return {
      tenantId: order.tenantId,
      tableId: order.tableId,
      tableNumber: order.tableNumber,
      customerId: order.customerId,
      customerName: order.customerName || null,
      status: order.status,
      kitchenStationStatus: order.kitchenStationStatus,
      totals: order.totals,
      payment: order.payment,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };
  },
  fromFirestore(snapshot: any, options: any): Omit<Order, 'items'> {
    const data = snapshot.data(options);
    const toDate = (val: any): Date => {
      if (!val) return new Date();
      if (typeof val.toDate === 'function') return val.toDate();
      return new Date(val);
    };
    return {
      id: snapshot.id,
      tenantId: data.tenantId,
      tableId: data.tableId,
      tableNumber: data.tableNumber,
      customerId: data.customerId,
      customerName: data.customerName || undefined,
      status: data.status,
      kitchenStationStatus: data.kitchenStationStatus,
      totals: data.totals,
      payment: data.payment,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt)
    };
  }
};

export class OrderRepository implements IOrderRepository {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async getById(tenantId: string, orderId: string): Promise<Order | null> {
    const docRef = doc(this.db, 'tenants', tenantId, 'orders', orderId).withConverter(OrderConverter);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    const orderHeader = snap.data();

    // Load subcollection items
    const itemsCol = collection(this.db, 'tenants', tenantId, 'orders', orderId, 'order_items').withConverter(OrderItemConverter);
    const itemsSnap = await getDocs(itemsCol);
    const items = itemsSnap.docs.map((d: any) => d.data());

    return {
      ...orderHeader,
      items
    } as Order;
  }

  async save(tenantId: string, order: Order): Promise<void> {
    const batch = writeBatch(this.db);
    
    // Save order headers
    const orderDocRef = doc(this.db, 'tenants', tenantId, 'orders', order.id).withConverter(OrderConverter);
    batch.set(orderDocRef, order);

    // Save order items in subcollection
    const itemsCol = collection(this.db, 'tenants', tenantId, 'orders', order.id, 'order_items').withConverter(OrderItemConverter);
    for (const item of order.items) {
      const itemDocRef = doc(itemsCol, item.id);
      batch.set(itemDocRef, item);
    }

    await batch.commit();
  }

  async listActive(tenantId: string): Promise<Order[]> {
    const colRef = collection(this.db, 'tenants', tenantId, 'orders').withConverter(OrderConverter);
    const q = query(colRef, where('status', 'not-in', ['completed', 'archived']));
    const querySnap = await getDocs(q);
    
    const orders: Order[] = [];
    for (const d of querySnap.docs) {
      const header = d.data();
      const itemsCol = collection(this.db, 'tenants', tenantId, 'orders', d.id, 'order_items').withConverter(OrderItemConverter);
      const itemsSnap = await getDocs(itemsCol);
      orders.push({
        ...header,
        items: itemsSnap.docs.map((it: any) => it.data())
      } as Order);
    }
    return orders;
  }

  subscribeActive(tenantId: string, callback: (orders: Order[]) => void): () => void {
    const colRef = collection(this.db, 'tenants', tenantId, 'orders').withConverter(OrderConverter);
    const q = query(colRef, where('status', 'not-in', ['completed', 'archived']));
    
    return onSnapshot(q, async (snap: any) => {
      const ordersList: Order[] = [];
      for (const d of snap.docs) {
        const header = d.data();
        const itemsCol = collection(this.db, 'tenants', tenantId, 'orders', d.id, 'order_items').withConverter(OrderItemConverter);
        const itemsSnap = await getDocs(itemsCol);
        ordersList.push({
          ...header,
          items: itemsSnap.docs.map((it: any) => it.data())
        } as Order);
      }
      callback(ordersList);
    });
  }

  subscribeAll(tenantId: string, callback: (orders: Order[]) => void): () => void {
    const colRef = collection(this.db, 'tenants', tenantId, 'orders').withConverter(OrderConverter);
    const q = query(colRef);
    
    return onSnapshot(q, async (snap: any) => {
      const ordersList: Order[] = [];
      for (const d of snap.docs) {
        const header = d.data();
        const itemsCol = collection(this.db, 'tenants', tenantId, 'orders', d.id, 'order_items').withConverter(OrderItemConverter);
        const itemsSnap = await getDocs(itemsCol);
        ordersList.push({
          ...header,
          items: itemsSnap.docs.map((it: any) => it.data())
        } as Order);
      }
      // Sort descending by createdAt
      ordersList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      callback(ordersList);
    });
  }
}
