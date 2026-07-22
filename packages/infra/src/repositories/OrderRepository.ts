import { 
  doc, 
  getDoc, 
  collection, 
  getDocs,
  query,
  where,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import type { Order, OrderItem, IOrderRepository } from '@restaurant-qr/core';

export const OrderItemConverter: any = {
  toFirestore(item: OrderItem): any {
    return {
      id: item.id,
      menuItemId: item.menuItemId,
      name: item.name,
      description: item.description || null,
      quantity: item.quantity,
      selectedVariantName: item.selectedVariantName || null,
      selectedAddonNames: item.selectedAddonNames || null,
      selectedModifiers: item.selectedModifiers || null,
      unitPriceMinor: item.unitPriceMinor !== undefined ? item.unitPriceMinor : Math.round(item.unitPrice * 100),
      taxRate: item.taxRate || null,
      totalPriceMinor: item.totalPriceMinor !== undefined ? item.totalPriceMinor : Math.round(item.totalPrice * 100),
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
      id: snapshot.id || data.id,
      menuItemId: data.menuItemId,
      name: data.name,
      description: data.description || undefined,
      quantity: data.quantity,
      selectedVariantName: data.selectedVariantName || undefined,
      selectedAddonNames: data.selectedAddonNames || undefined,
      selectedModifiers: data.selectedModifiers || undefined,
      unitPriceMinor: data.unitPriceMinor !== undefined ? data.unitPriceMinor : Math.round(data.unitPrice * 100),
      taxRate: data.taxRate || undefined,
      totalPriceMinor: data.totalPriceMinor !== undefined ? data.totalPriceMinor : Math.round(data.totalPrice * 100),
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
  toFirestore(order: Order): any {
    const items = order.items || [];
    return {
      tenantId: order.tenantId,
      tableId: order.tableId,
      tableNumber: order.tableNumber,
      sessionId: order.sessionId || null,
      customerId: order.customerId,
      customerName: order.customerName || null,
      status: order.status,
      statusHistory: order.statusHistory || null,
      kitchenStationStatus: order.kitchenStationStatus || null,
      totals: order.totals,
      totalsMinor: order.totalsMinor || null,
      payment: order.payment,
      paymentId: order.paymentId || null,
      items: items.map(item => OrderItemConverter.toFirestore(item)),
      billRequested: order.billRequested !== undefined ? order.billRequested : null,
      requestedBillAt: order.requestedBillAt || null,
      createdAt: order.createdAt || new Date(),
      updatedAt: order.updatedAt || new Date()
    };
  },
  fromFirestore(snapshot: any, options: any): Order {
    const data = snapshot.data(options);
    const toDate = (val: any): Date => {
      if (!val) return new Date();
      if (typeof val.toDate === 'function') return val.toDate();
      return new Date(val);
    };
    
    // Parse items list embedded in Firestore document
    let items: OrderItem[] = [];
    if (Array.isArray(data.items)) {
      items = data.items.map((raw: any) => ({
        id: raw.id || '',
        menuItemId: raw.menuItemId,
        name: raw.name,
        description: raw.description || undefined,
        quantity: raw.quantity,
        selectedVariantName: raw.selectedVariantName || undefined,
        selectedAddonNames: raw.selectedAddonNames || undefined,
        selectedModifiers: raw.selectedModifiers || undefined,
        unitPriceMinor: raw.unitPriceMinor !== undefined ? raw.unitPriceMinor : Math.round(raw.unitPrice * 100),
        taxRate: raw.taxRate || undefined,
        totalPriceMinor: raw.totalPriceMinor !== undefined ? raw.totalPriceMinor : Math.round(raw.totalPrice * 100),
        unitPrice: raw.unitPrice,
        totalPrice: raw.totalPrice,
        notes: raw.notes || undefined,
        stationId: raw.stationId,
        status: raw.status,
        selectedVariant: raw.selectedVariant || undefined,
        selectedAddons: raw.selectedAddons || undefined
      }));
    }

    return {
      id: snapshot.id,
      tenantId: data.tenantId,
      tableId: data.tableId,
      tableNumber: data.tableNumber,
      sessionId: data.sessionId || undefined,
      customerId: data.customerId,
      customerName: data.customerName || undefined,
      status: data.status,
      statusHistory: data.statusHistory || [],
      kitchenStationStatus: data.kitchenStationStatus || {},
      totals: data.totals,
      totalsMinor: data.totalsMinor || undefined,
      payment: data.payment,
      paymentId: data.paymentId || undefined,
      billRequested: data.billRequested !== undefined ? data.billRequested : undefined,
      requestedBillAt: data.requestedBillAt ? toDate(data.requestedBillAt) : undefined,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      items
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
    return snap.data() as Order;
  }

  async save(tenantId: string, order: Order): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'orders', order.id).withConverter(OrderConverter);
    await setDoc(docRef, order);
  }

  async listActive(tenantId: string): Promise<Order[]> {
    const colRef = collection(this.db, 'tenants', tenantId, 'orders').withConverter(OrderConverter);
    const q = query(colRef, where('status', 'not-in', ['completed', 'archived']));
    const querySnap = await getDocs(q);
    return querySnap.docs.map((doc: any) => doc.data() as Order);
  }

  subscribeActive(tenantId: string, callback: (orders: Order[]) => void): () => void {
    const colRef = collection(this.db, 'tenants', tenantId, 'orders').withConverter(OrderConverter);
    const q = query(colRef, where('status', 'not-in', ['completed', 'archived']));
    return onSnapshot(q, (snap: any) => {
      callback(snap.docs.map((doc: any) => doc.data() as Order));
    }, (err: any) => {
      console.warn("Firestore active orders subscription permission error:", err);
      callback([]);
    });
  }

  subscribeAll(tenantId: string, callback: (orders: Order[]) => void): () => void {
    const colRef = collection(this.db, 'tenants', tenantId, 'orders').withConverter(OrderConverter);
    const q = query(colRef);
    return onSnapshot(q, (snap: any) => {
      const list: Order[] = snap.docs.map((doc: any) => doc.data() as Order);
      list.sort((a: Order, b: Order) => b.createdAt.getTime() - a.createdAt.getTime());
      callback(list);
    }, (err: any) => {
      console.warn("Firestore all orders subscription permission error:", err);
      callback([]);
    });
  }
}
