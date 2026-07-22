import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { db } from '../../lib/firebase.js';
import { collection, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../features/auth/context/AuthContext.js';
import { MenuItemConverter, OrderRepository } from '@restaurant-qr/infra';
import type { MenuItem, Order, OrderItem, OrderStatus, PaymentStatus } from '@restaurant-qr/core';
import { OrderService } from '../../services/OrderService.js';
import { EventService } from '../../services/EventService.js';
import confetti from 'canvas-confetti';
import { useToast } from '../../components/shared/ToastContext';
import {
  Utensils,
  Plus,
  Minus,
  Search,
  Clock,
  X,
  ShoppingBag,
  ChevronRight,
  Loader2,
  Bell,
  Receipt
} from 'lucide-react';

const MOCK_MENU_KEY = 'restaurant_qr_mock_menu_db';
const MOCK_ORDERS_KEY = 'restaurant_qr_mock_orders_db';

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

export const CustomerMenu: React.FC = () => {
  const params = useParams<{ tenantId?: string; tableId?: string }>();
  const { isMockMode } = useAuth();
  const toast = useToast();

  // Robust 3-layer URL tenantId & tableId extractor for mobile browsers & QR scanners
  const resolveParams = () => {
    let tId = params.tenantId;
    let tblId = params.tableId;

    const href = window.location.href;

    // 1. Try Hash path parsing: /customer/table/TENANT_ID/TABLE_ID
    if (!tId || tId === 'tenant_dev_123') {
      const hashMatch = href.match(/\/customer\/table\/([^\/\?#]+)(?:\/([^\/\?#]+))?/);
      if (hashMatch) {
        if (hashMatch[1] && hashMatch[1] !== 'menu') tId = hashMatch[1];
        if (hashMatch[2]) tblId = hashMatch[2];
      }
    }

    // 2. Try Query string parsing: ?tenantId=...&tableId=...
    if (!tId) {
      const searchParams = new URLSearchParams(window.location.search || (href.includes('?') ? href.split('?')[1] : ''));
      const qTenant = searchParams.get('tenantId') || searchParams.get('tenant');
      const qTable = searchParams.get('tableId') || searchParams.get('table');
      if (qTenant) tId = qTenant;
      if (qTable) tblId = qTable;
    }

    return {
      tenantId: tId || 'tenant_dev_123',
      tableId: tblId || 'table_01'
    };
  };

  const { tenantId, tableId } = resolveParams();

  // Database / state values
  const [restaurantName, setRestaurantName] = useState(() => `Restaurant (${tenantId.replace(/^tenant_/, '').slice(0, 6).toUpperCase()})`);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableExists, setTableExists] = useState<boolean | null>(null);
  const [tableStatus, setTableStatus] = useState<string>('available');

  // Cart states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [vegOnly, setVegOnly] = useState(false);

  // Post-order tracking states
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);

  const formatTableName = (tId?: string) => {
    if (!tId) return 'Table 1';
    if (/^\d+$/.test(tId)) return `Table ${tId}`;
    const clean = tId.replace(/^table_|^tb_|^tbl_/, '').slice(0, 6).toUpperCase();
    return `Table ${clean}`;
  };

  const [tableName, setTableName] = useState(() => formatTableName(tableId));

  // Fetch restaurant details and menu items
  useEffect(() => {
    let active = true;

    setTableName(formatTableName(tableId));

    // Fallback timer: Guarantee loading is cleared after 1.5 seconds under all conditions
    const fallbackTimer = setTimeout(() => {
      if (active) {
        setLoading(false);
      }
    }, 1500);

    if (isMockMode) {
      const cached = localStorage.getItem(MOCK_MENU_KEY);
      if (cached && active) {
        try {
          const parsed: MenuItem[] = JSON.parse(cached);
          // Strictly filter menu items created specifically for THIS tenantId!
          const tenantMenuItems = parsed.filter(
            (m) => m.tenantId === tenantId && m.isActive !== false
          );

          setMenuItems(tenantMenuItems);
        } catch (e) {
          setMenuItems([]);
        }
      } else if (active) {
        setMenuItems([]);
      }

      // Check tenant name in mock DB or specific tenant info key
      const cachedInfo = localStorage.getItem(`restaurant_qr_mock_tenant_info_${tenantId}`);
      const cachedTenants = localStorage.getItem('restaurant_qr_mock_tenants_db');
      let tenantFound = false;

      if (cachedInfo) {
        try {
          const parsed = JSON.parse(cachedInfo);
          if (parsed.name && active) {
            setRestaurantName(parsed.name);
            tenantFound = true;
          }
        } catch (e) {}
      }

      if (!tenantFound && cachedTenants) {
        try {
          const tenantsList = JSON.parse(cachedTenants);
          const matchTenant = tenantsList.find((t: any) => t.id === tenantId);
          if (matchTenant && matchTenant.name && active) {
            setRestaurantName(matchTenant.name);
            tenantFound = true;
          }
        } catch (e) {}
      }

      if (!tenantFound && active) {
        setRestaurantName(`Restaurant (${tenantId.replace(/^tenant_/, '').slice(0, 6).toUpperCase()})`);
      }

      const cachedTables = localStorage.getItem('restaurant_qr_mock_tables_db');
      let foundTable = false;
      if (cachedTables) {
        try {
          const tablesList = JSON.parse(cachedTables);
          const matchTable = tablesList.find((t: any) => t.id === tableId && t.tenantId === tenantId);
          if (matchTable && active) {
            setTableName(matchTable.number);
            setTableStatus(matchTable.status || 'available');
            setTableExists(true);
            foundTable = true;
            let currentOrderId = matchTable.activeOrderId;
            if (!currentOrderId) {
              const cachedOrders = localStorage.getItem(MOCK_ORDERS_KEY);
              if (cachedOrders) {
                const ordersList = JSON.parse(cachedOrders);
                const matchingActiveOrder = ordersList
                  .filter((o: any) => o.tableId === tableId && o.status !== 'completed' && o.status !== 'archived')
                  .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                if (matchingActiveOrder) {
                  currentOrderId = matchingActiveOrder.id;
                  matchTable.activeOrderId = currentOrderId;
                  matchTable.status = 'occupied';
                  localStorage.setItem('restaurant_qr_mock_tables_db', JSON.stringify(tablesList));
                  window.dispatchEvent(new Event('storage'));
                }
              }
            }

            if (currentOrderId) {
              const cachedOrders = localStorage.getItem(MOCK_ORDERS_KEY);
              if (cachedOrders) {
                const ordersList = JSON.parse(cachedOrders);
                const orderObj = ordersList.find((o: any) => o.id === currentOrderId);
                if (orderObj && orderObj.status !== 'completed' && orderObj.status !== 'archived') {
                  setPlacedOrderId(currentOrderId);
                  setTrackedOrder(orderObj);
                }
              }
            }
          }
        } catch (e) {}
      }
      if (!foundTable && active) {
        setTableExists(false);
      }

      setLoading(false);
    } else {
      getDoc(doc(db, 'tenants', tenantId))
        .then((snap: any) => {
          if (snap.exists() && active) {
            setRestaurantName(snap.data().name || `Restaurant (${tenantId.replace(/^tenant_/, '').slice(0, 6).toUpperCase()})`);
          }
        })
        .catch(() => {});

      const menuCol = collection(db, 'tenants', tenantId, 'menu_items').withConverter(MenuItemConverter);
      const unsub = onSnapshot(
        menuCol,
        (snap: any) => {
          if (active) {
            const items = snap.docs.map((d: any) => d.data() as MenuItem).filter((i: MenuItem) => i.isActive);
            setMenuItems(items);
            setLoading(false);
          }
        },
        (err) => {
          console.warn('Firestore snapshot notice:', err);
          if (active) {
            setMenuItems([]);
            setLoading(false);
          }
        }
      );

      getDoc(doc(db, 'tenants', tenantId, 'tables', tableId))
        .then(async (snap: any) => {
          if (active) {
            if (snap.exists()) {
              const tData = snap.data();
              setTableName(tData.number || 'Table');
              setTableStatus(tData.status || 'available');
              setTableExists(true);
              
              let currentOrderId = tData.activeOrderId;
              if (!currentOrderId) {
                try {
                  const repo = new OrderRepository(db);
                  const activeOrdersList = await repo.listActive(tenantId);
                  const matchingActiveOrder = activeOrdersList
                    .filter((o) => o.tableId === tableId)
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
                  
                  if (matchingActiveOrder) {
                    currentOrderId = matchingActiveOrder.id;
                    await setDoc(doc(db, 'tenants', tenantId, 'tables', tableId), { activeOrderId: currentOrderId, status: 'occupied' }, { merge: true });
                  }
                } catch (err) {
                  // Gracefully ignore active order discovery list queries for unauthenticated customers
                  console.warn('Customer active order discovery skipped (requires staff authentication):', err);
                }
              }

              if (currentOrderId) {
                try {
                  // Direct fetch to bypass repository subcollection read which requires authenticated permissions
                  const orderDocRef = doc(db, 'tenants', tenantId, 'orders', currentOrderId);
                  const orderSnap = await getDoc(orderDocRef);
                  if (orderSnap.exists()) {
                    const rawData = orderSnap.data() as any;
                    const toDate = (val: any): Date => {
                      if (!val) return new Date();
                      if (typeof val.toDate === 'function') return val.toDate();
                      return new Date(val);
                    };
                    const items = Array.isArray(rawData.items) ? rawData.items.map((raw: any) => ({
                      id: raw.id || '',
                      menuItemId: raw.menuItemId,
                      name: raw.name,
                      quantity: raw.quantity,
                      unitPrice: raw.unitPrice,
                      totalPrice: raw.totalPrice,
                      stationId: raw.stationId,
                      status: raw.status,
                      selectedVariant: raw.selectedVariant || undefined,
                      selectedAddons: raw.selectedAddons || undefined
                    })) : [];

                    const orderObj: Order = {
                      id: orderSnap.id,
                      tenantId: rawData.tenantId,
                      tableId: rawData.tableId,
                      tableNumber: rawData.tableNumber,
                      customerId: rawData.customerId,
                      customerName: rawData.customerName || undefined,
                      status: rawData.status,
                      kitchenStationStatus: rawData.kitchenStationStatus || {},
                      totals: rawData.totals,
                      payment: rawData.payment,
                      createdAt: toDate(rawData.createdAt),
                      updatedAt: toDate(rawData.updatedAt),
                      items
                    };

                    if (orderObj.status !== 'completed' && orderObj.status !== 'archived') {
                      if (active) {
                        setPlacedOrderId(currentOrderId);
                        setTrackedOrder(orderObj);
                      }
                    }
                  }
                } catch (err) {
                  console.error('Failed to load active order details:', err);
                }
              }
            } else {
              setTableExists(false);
            }
          }
        })
        .catch(() => {
          if (active) setTableExists(false);
        });

      return () => {
        active = false;
        clearTimeout(fallbackTimer);
        unsub();
      };
    }

    return () => {
      active = false;
      clearTimeout(fallbackTimer);
    };
  }, [isMockMode, tenantId, tableId]);

  // Track placed order status in real time
  useEffect(() => {
    if (!placedOrderId) return;
    let active = true;

    if (isMockMode) {
      const interval = setInterval(() => {
        const cached = localStorage.getItem(MOCK_ORDERS_KEY);
        if (cached && active) {
          const allOrders = JSON.parse(cached);
          const match = allOrders.find((o: any) => o.id === placedOrderId);
          if (match) setTrackedOrder(match);
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      const unsub = onSnapshot(doc(db, 'tenants', tenantId, 'orders', placedOrderId), (snap) => {
        if (snap.exists() && active) {
          setTrackedOrder({ id: snap.id, ...snap.data() } as Order);
        }
      });
      return () => unsub();
    }
  }, [placedOrderId, tenantId, isMockMode]);

  const formatOrderDateTime = (dateVal?: any) => {
    if (!dateVal) return 'Just now';
    let date: Date;
    if (typeof dateVal?.toDate === 'function') {
      date = dateVal.toDate();
    } else if (dateVal instanceof Date) {
      date = dateVal;
    } else {
      date = new Date(dateVal);
    }

    if (isNaN(date.getTime())) return 'Recently';

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
    return `${dateStr}, ${timeStr}`;
  };

  const handleCallWaiter = () => {
    toast.success(`Waiter service call sent for ${tableName}!`);
    if (isMockMode) {
      const cachedAlerts = localStorage.getItem('restaurant_qr_waiter_alerts_db');
      const alerts = cachedAlerts ? JSON.parse(cachedAlerts) : [];
      alerts.push({
        id: `alert_${Date.now()}`,
        tableNumber: tableName,
        type: 'call_waiter',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      localStorage.setItem('restaurant_qr_waiter_alerts_db', JSON.stringify(alerts));
      window.dispatchEvent(new Event('storage'));
    }
  };

  const handleRequestBill = async () => {
    toast.success(`Bill request sent to Cashier for ${tableName}!`);
    if (isMockMode) {
      const cached = localStorage.getItem(MOCK_ORDERS_KEY);
      if (cached && placedOrderId) {
        try {
          const parsed = JSON.parse(cached);
          const updated = parsed.map((o: any) => {
            if (o.id === placedOrderId) {
              return {
                ...o,
                billRequested: true,
                requestedBillAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
            }
            return o;
          });
          localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(updated));
          window.dispatchEvent(new Event('storage'));
        } catch (e) {}
      }

      const cachedAlerts = localStorage.getItem('restaurant_qr_waiter_alerts_db');
      const alerts = cachedAlerts ? JSON.parse(cachedAlerts) : [];
      alerts.push({
        id: `alert_bill_${Date.now()}`,
        tableNumber: tableName,
        type: 'bill_request',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      localStorage.setItem('restaurant_qr_waiter_alerts_db', JSON.stringify(alerts));
      window.dispatchEvent(new Event('storage'));
    } else if (placedOrderId) {
      try {
        await setDoc(doc(db, 'tenants', tenantId, 'orders', placedOrderId), { billRequested: true, requestedBillAt: new Date(), updatedAt: new Date() }, { merge: true });
      } catch (err) {}
    }
  };

  // Cart operations
  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
    toast.success(`Added ${item.name} to cart!`);
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.menuItem.id === itemId) {
            const newQty = c.quantity + delta;
            return newQty > 0 ? { ...c, quantity: newQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const cartSubtotal = cart.reduce((sum, c) => sum + c.menuItem.price * c.quantity, 0);
  const tax = cartSubtotal * 0.05;
  const serviceCharge = cartSubtotal * 0.05;
  const cartTotal = cartSubtotal + tax + serviceCharge;
  const totalCartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  // Filter menu items with full safe optional chaining
  const filteredMenuItems = (menuItems || []).filter((item) => {
    if (!item) return false;
    const dietary = Array.isArray(item.dietaryTags) ? item.dietaryTags : [];
    if (vegOnly && !dietary.includes('veg') && !dietary.includes('vegan')) {
      return false;
    }
    if (selectedCategory !== 'all' && (item.categoryId || 'mains') !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = (item.name || '').toLowerCase().includes(q);
      const descMatch = (item.description || '').toLowerCase().includes(q);
      return nameMatch || descMatch;
    }
    return true;
  });

  const handlePlaceOrder = async () => {
    if (cart.length === 0 || isSubmittingOrder) return;
    setIsSubmittingOrder(true);

    const orderId = `ord_${Math.floor(Math.random() * 900000 + 100000)}`;

    const newOrderItems: OrderItem[] = cart.map((c) => ({
      id: `item_${Math.floor(Math.random() * 100000)}`,
      menuItemId: c.menuItem.id,
      name: c.menuItem.name,
      quantity: c.quantity,
      unitPrice: c.menuItem.price,
      unitPriceMinor: Math.round(c.menuItem.price * 100),
      totalPrice: c.menuItem.price * c.quantity,
      totalPriceMinor: Math.round(c.menuItem.price * c.quantity * 100),
      stationId: 'main',
      status: 'pending'
    }));

    const orderPayload: any = {
      id: orderId,
      tenantId,
      tableId,
      tableNumber: tableName,
      customerId: `cust_${Date.now()}`,
      customerName: customerName.trim() || 'Guest Customer',
      status: 'pending' as OrderStatus,
      statusHistory: [
        {
          status: 'pending',
          timestamp: new Date(),
          actorId: 'customer'
        }
      ],
      kitchenStationStatus: { main: 'pending' },
      totals: {
        subtotal: cartSubtotal,
        tax,
        serviceCharge,
        tip: 0,
        discount: 0,
        grandTotal: cartTotal
      },
      totalsMinor: {
        subtotal: Math.round(cartSubtotal * 100),
        tax: Math.round(tax * 100),
        serviceCharge: Math.round(serviceCharge * 100),
        tip: 0,
        discount: 0,
        grandTotal: Math.round(cartTotal * 100)
      },
      payment: {
        status: 'unpaid' as PaymentStatus,
        amountPaid: 0
      },
      items: newOrderItems
    };

    try {
      if (isMockMode) {
        const cachedTables = localStorage.getItem('restaurant_qr_mock_tables_db');
        if (cachedTables) {
          try {
            const parsedTables = JSON.parse(cachedTables);
            const updatedTables = parsedTables.map((t: any) =>
              t.id === tableId ? { ...t, status: 'occupied', activeOrderId: orderId } : t
            );
            localStorage.setItem('restaurant_qr_mock_tables_db', JSON.stringify(updatedTables));
            window.dispatchEvent(new Event('storage'));
          } catch (e) {}
        }

        const fullMockOrder: Order = {
          ...orderPayload,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await OrderService.submitOrder(tenantId, fullMockOrder, true);
        setTrackedOrder(fullMockOrder);
        await EventService.logEvent(tenantId, 'order.created', orderId, 'customer', { tableId, itemsCount: newOrderItems.length, grandTotal: cartTotal }, true);
      } else {
        const fullLiveOrder: Order = {
          ...orderPayload,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await OrderService.submitOrder(tenantId, fullLiveOrder, false);

        try {
          await setDoc(doc(db, 'tenants', tenantId, 'tables', tableId), { status: 'occupied', activeOrderId: orderId }, { merge: true });
        } catch (err) {}
        await EventService.logEvent(tenantId, 'order.created', orderId, 'customer', { tableId, itemsCount: newOrderItems.length, grandTotal: cartTotal }, false);
      }

      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });

      setPlacedOrderId(orderId);
      setCart([]);
      setIsCartOpen(false);
    } catch (err: any) {
      toast.error(`Order placement failed: ${err.message}`);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
        <p className="text-xs font-semibold text-zinc-400">Opening Digital Menu...</p>
      </div>
    );
  }

  if (tableExists === false) {
    return <Navigate to="/404" replace />;
  }

  if (tableStatus === 'cleaning') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-center text-white">
        <div className="max-w-sm space-y-4 border border-zinc-800 bg-zinc-900/60 p-6 rounded-3xl shadow-2xl">
          <div className="inline-flex p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-base font-extrabold uppercase tracking-wider">Table is being sanitized</h3>
          <p className="text-xs text-zinc-400">
            Our staff is currently sanitizing and prepping this table for your dining experience. Please give us a few moments!
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold uppercase rounded-xl transition"
          >
            Refresh Status
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans pb-32">
      {/* Top Header Banner */}
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-850 px-4 py-3.5 flex items-center justify-between">
        <div>
          <h1 className="text-base font-extrabold text-white flex items-center gap-2">
            <Utensils className="h-4 w-4 text-emerald-400" />
            {restaurantName}
          </h1>
          <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full inline-block mt-0.5">
            {tableName} • QR Ordering Active
          </span>
        </div>

        {totalCartCount > 0 && (
          <button
            onClick={() => setIsCartOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Cart ({totalCartCount})</span>
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* Track Active Order Live Tracker */}
        {placedOrderId && (() => {
          const status = trackedOrder?.status || 'pending';
          const isBillSent = Boolean((trackedOrder as any)?.billRequested || (trackedOrder as any)?.requestedBillAt);
          let statusStep = 1; // 1: placed, 2: preparing, 3: ready, 4: served/completed
          if (status === 'preparing' || status === 'accepted') statusStep = 2;
          else if (status === 'ready') statusStep = 3;
          else if (status === 'served' || status === 'completed') statusStep = 4;

          return (
            <div className="border border-emerald-500/40 bg-zinc-900/90 p-5 rounded-3xl space-y-4 shadow-2xl backdrop-blur-md animate-fadeIn">
              <div className="flex justify-between items-start border-b border-zinc-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-xl">
                      {tableName}
                    </span>
                    <span className="text-sm font-extrabold text-white">
                      Order #{placedOrderId.slice(-6).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1 font-mono flex items-center gap-1">
                    <Clock className="h-3 w-3 text-zinc-500" />
                    Placed: {formatOrderDateTime(trackedOrder?.createdAt)}
                  </p>
                </div>

                <div className="text-right space-y-1">
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-xl border ${
                    status === 'ready' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse' :
                    status === 'served' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                    status === 'completed' ? 'bg-zinc-800 text-zinc-300 border-zinc-700' :
                    'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse'
                  }`}>
                    {status === 'ready' ? 'Food Ready!' :
                     status === 'served' ? 'Served to Table' :
                     status === 'completed' ? 'Settled & Paid' :
                     status === 'preparing' ? 'Kitchen Cooking...' : 'Order Received'}
                  </span>
                  {isBillSent && status !== 'completed' && (
                    <span className="block text-[9px] font-extrabold uppercase text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md mt-1">
                      Bill Dispatched to Cashier
                    </span>
                  )}
                </div>
              </div>

              {/* Stepper Progress Bar */}
              <div className="space-y-2 py-1">
                <div className="grid grid-cols-4 gap-1 text-center text-[9px] font-bold text-zinc-400">
                  <span className={statusStep >= 1 ? 'text-emerald-400' : ''}>Placed</span>
                  <span className={statusStep >= 2 ? 'text-amber-400 font-extrabold' : ''}>Cooking</span>
                  <span className={statusStep >= 3 ? 'text-emerald-400 font-extrabold' : ''}>Ready</span>
                  <span className={statusStep >= 4 ? 'text-blue-400 font-extrabold' : ''}>Served</span>
                </div>
                <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                  <div className={`h-full transition-all duration-500 ${
                    statusStep === 1 ? 'w-1/4 bg-amber-500' :
                    statusStep === 2 ? 'w-2/4 bg-amber-500' :
                    statusStep === 3 ? 'w-3/4 bg-emerald-500' :
                    'w-full bg-blue-500'
                  }`} />
                </div>
              </div>

              {/* Itemized Dishes Status list */}
              {trackedOrder?.items && trackedOrder.items.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                  <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">Ordered Dishes Status</p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {trackedOrder.items.map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-xs text-zinc-200">
                        <span className="font-semibold">{item.quantity}x {item.name}</span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
                          item.status === 'ready' || item.status === 'served'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {item.status === 'ready' ? 'Cooked' : item.status === 'served' ? 'Served' : 'Preparing'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons for Service & Bill */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800">
                <button
                  onClick={handleCallWaiter}
                  className="py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl font-extrabold text-xs uppercase flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Bell className="h-3.5 w-3.5" />
                  Call Waiter
                </button>
                <button
                  onClick={handleRequestBill}
                  className="py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-500/20"
                >
                  <Receipt className="h-3.5 w-3.5" />
                  Request Bill
                </button>
              </div>
            </div>
          );
        })()}

        {/* Search & Category Filter Bar */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search delicious dishes, drinks, or desserts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/40"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {['all', 'mains', 'pizza', 'drinks', 'desserts'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition border ${
                  selectedCategory === cat
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                {cat}
              </button>
            ))}
            <button
              onClick={() => setVegOnly(!vegOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                vegOnly
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              🌱 Veg Only
            </button>
          </div>
        </div>

        {/* Menu Catalog Grid */}
        {filteredMenuItems.length === 0 ? (
          <div className="border border-zinc-850 bg-zinc-900/40 rounded-3xl p-8 text-center space-y-3 my-4 shadow-xl">
            <div className="h-12 w-12 rounded-2xl bg-zinc-800/80 text-zinc-400 flex items-center justify-center mx-auto border border-zinc-750">
              <Utensils className="h-6 w-6 text-zinc-400" />
            </div>
            <h3 className="text-base font-extrabold text-white">No Dishes Available Yet</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              This restaurant has not added any active menu items yet. If you are the restaurant admin, please add dishes in your Admin Panel.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredMenuItems.map((item) => (
            <div
              key={item.id}
              className="border border-zinc-850 bg-zinc-900/60 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-zinc-750 transition shadow-lg"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <h3 className="font-extrabold text-white text-sm">{item.name}</h3>
                  <span className="font-black text-emerald-400 text-sm">₹{item.price}</span>
                </div>
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{item.description}</p>
              </div>

              <div className="pt-2 flex justify-between items-center border-t border-zinc-850">
                <span className="text-[10px] text-zinc-500 font-semibold flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {item.preparationTime || 10} mins
                </span>
                {cart.find((c) => c.menuItem.id === item.id) ? (
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-xl shadow-inner">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="p-1 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition"
                      title="Decrease Quantity"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="font-extrabold text-xs text-emerald-400 min-w-[16px] text-center">
                      {cart.find((c) => c.menuItem.id === item.id)?.quantity || 0}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="p-1 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition"
                      title="Increase Quantity"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => addToCart(item)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-500/10 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Dish
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        )}
      </main>

      {/* Sticky Bottom Floating Cart Action Bar */}
      {totalCartCount > 0 && !isCartOpen && (
        <div className="fixed bottom-4 left-0 right-0 z-40 px-4 max-w-lg mx-auto">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full flex items-center justify-between px-5 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-2xl shadow-2xl shadow-emerald-500/30 transition transform hover:scale-[1.01]"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-xl bg-white/20 flex items-center justify-center font-extrabold text-xs text-white">
                {totalCartCount}
              </div>
              <div className="text-left">
                <span className="block text-xs uppercase tracking-wider font-extrabold">View Cart Order</span>
                <span className="text-[10px] text-emerald-100 font-medium">{tableName} • Ready to submit</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-mono font-black">
              <span>₹{cartTotal.toFixed(2)}</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </button>
        </div>
      )}

      {/* Cart Drawer Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-lg border border-zinc-800 bg-zinc-950 p-6 rounded-t-3xl sm:rounded-3xl space-y-5 text-white shadow-2xl relative">
            <button
              onClick={() => setIsCartOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 border-b border-zinc-850 pb-3">
              <ShoppingBag className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-extrabold text-white">Your Table Order Summary</h3>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400 font-semibold uppercase">Your Name (Optional)</label>
              <input
                type="text"
                placeholder="Enter customer name..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/40"
              />
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto divide-y divide-zinc-850">
              {cart.map((c) => (
                <div key={c.menuItem.id} className="pt-3 first:pt-0 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-sm text-white">{c.menuItem.name}</h4>
                    <span className="text-xs text-zinc-400">₹{c.menuItem.price} each</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-xl">
                      <button onClick={() => updateQuantity(c.menuItem.id, -1)} className="text-zinc-400 hover:text-white">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="font-bold text-xs">{c.quantity}</span>
                      <button onClick={() => updateQuantity(c.menuItem.id, 1)} className="text-zinc-400 hover:text-white">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="font-bold text-xs text-emerald-400 font-mono">
                      ₹{c.menuItem.price * c.quantity}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-zinc-850 pt-3 space-y-1 text-xs text-zinc-400">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST (5%)</span>
                <span>₹{tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm text-white pt-2 border-t border-zinc-800">
                <span>Total Amount</span>
                <span className="text-emerald-400">₹{cartTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={isSubmittingOrder}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSubmittingOrder ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Sending Order to Kitchen...</span>
                </>
              ) : (
                <span>Confirm & Submit Table Order • ₹{cartTotal.toFixed(2)}</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
