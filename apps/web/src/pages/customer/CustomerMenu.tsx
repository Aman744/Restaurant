import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../../lib/firebase.js';
import { collection, onSnapshot, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../features/auth/context/AuthContext.js';
import { MenuItemConverter } from '@restaurant-qr/infra';
import type { MenuItem, Order, OrderItem, OrderStatus, PaymentStatus } from '@restaurant-qr/core';
import confetti from 'canvas-confetti';
import { useToast } from '../../components/shared/ToastContext';
import {
  Utensils,
  Plus,
  Minus,
  Search,
  Check,
  ChevronRight,
  Clock,
  X
} from 'lucide-react';

const MOCK_MENU_KEY = 'restaurant_qr_mock_menu_db';
const MOCK_ORDERS_KEY = 'restaurant_qr_mock_orders_db';

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

export const CustomerMenu: React.FC = () => {
  const { tenantId = 'tenant_dev_123', tableId = 'table_01' } = useParams<{ tenantId: string; tableId: string }>();
  const { isMockMode } = useAuth();
  const toast = useToast();

  // Database / state values
  const [restaurantName, setRestaurantName] = useState('Gourmet Restaurant');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Cart states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [vegOnly, setVegOnly] = useState(false);

  // Post-order tracking states
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [tableError, setTableError] = useState(false);

  const [tableName, setTableName] = useState(() => {
    const match = tableId.match(/\d+$/);
    return match ? `Table ${parseInt(match[0])}` : 'Table';
  });

  // Fetch restaurant details and menu items
  useEffect(() => {
    let active = true;

    if (isMockMode) {
      // Load mock menu
      const cached = localStorage.getItem(MOCK_MENU_KEY);
      if (cached && active) {
        setMenuItems(JSON.parse(cached));
      }
      // Load mock table number
      const cachedTables = localStorage.getItem('restaurant_qr_mock_tables_db');
      let foundMock = false;
      if (cachedTables) {
        const tablesList = JSON.parse(cachedTables);
        const matchTable = tablesList.find((t: any) => t.id === tableId);
        if (matchTable && matchTable.number) {
          if (active) {
            setTableName(matchTable.number);
            foundMock = true;
          }
        }
      }
      if (!foundMock && active) {
        setTableError(true);
      }
      setRestaurantName('Mock Bistro & Bar');
      setLoading(false);
    } else {
      // 1. Fetch Tenant Name
      getDoc(doc(db, 'tenants', tenantId)).then((snap: any) => {
        if (snap.exists() && active) {
          setRestaurantName(snap.data().name || 'Gourmet Restaurant');
        }
      });

      // 2. Fetch Menu Items (live updates)
      const menuCol = collection(db, 'tenants', tenantId, 'menu_items').withConverter(MenuItemConverter);
      const unsub = onSnapshot(menuCol, (snap: any) => {
        if (active) {
          setMenuItems(snap.docs.map((d: any) => d.data() as MenuItem).filter((i: MenuItem) => i.isActive));
          setLoading(false);
        }
      });

      // 3. Fetch Table details
      getDoc(doc(db, 'tenants', tenantId, 'tables', tableId)).then((snap: any) => {
        if (active) {
          if (snap.exists()) {
            const tData = snap.data();
            if (tData?.number) {
              setTableName(tData.number);
            } else {
              setTableError(true);
            }
          } else {
            setTableError(true);
          }
        }
      }).catch(() => {
        if (active) setTableError(true);
      });

      return () => {
        active = false;
        unsub();
      };
    }
  }, [isMockMode, tenantId, tableId]);

  // Track placed order status in real time
  useEffect(() => {
    if (!placedOrderId || isMockMode) return;

    const orderDoc = doc(db, 'tenants', tenantId, 'orders', placedOrderId);
    const unsub = onSnapshot(orderDoc, (snap: any) => {
      if (snap.exists()) {
        const orderData = snap.data();
        // Load items subcollection too
        const itemsCol = collection(db, 'tenants', tenantId, 'orders', placedOrderId, 'order_items');
        onSnapshot(itemsCol, (itemsSnap: any) => {
          const itemsList = itemsSnap.docs.map((it: any) => ({ id: it.id, ...it.data() }));
          setTrackedOrder({
            id: snap.id,
            ...orderData,
            items: itemsList
          } as any);
        });
      }
    });

    return () => unsub();
  }, [placedOrderId, tenantId, isMockMode]);

  // Derived menu categories
  const categories = ['all', ...Array.from(new Set(menuItems.map(i => i.categoryId).filter(Boolean)))];

  // Filtered menu list
  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.categoryId === selectedCategory;
    const matchesDiet = !vegOnly || item.dietaryTags.includes('veg') || item.dietaryTags.includes('vegan');
    return matchesSearch && matchesCategory && matchesDiet;
  });

  // Cart operations
  const addToCart = (item: MenuItem) => {
    const existing = cart.find(c => c.menuItem.id === item.id);
    if (existing) {
      setCart(cart.map(c => c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { menuItem: item, quantity: 1 }]);
    }
  };

  const removeFromCart = (item: MenuItem) => {
    const existing = cart.find(c => c.menuItem.id === item.id);
    if (existing && existing.quantity > 1) {
      setCart(cart.map(c => c.menuItem.id === item.id ? { ...c, quantity: c.quantity - 1 } : c));
    } else {
      setCart(cart.filter(c => c.menuItem.id !== item.id));
    }
  };

  const getCartQuantity = (itemId: string) => {
    return cart.find(c => c.menuItem.id === itemId)?.quantity || 0;
  };

  const cartSubtotal = cart.reduce((sum, c) => sum + (c.menuItem.price * c.quantity), 0);
  const gstRate = 0.05; // 5% GST
  const serviceChargeRate = 0.10; // 10% Service Charge
  const tax = cartSubtotal * gstRate;
  const serviceCharge = cartSubtotal * serviceChargeRate;
  const cartTotal = cartSubtotal + tax + serviceCharge;

  // Submit Order logic
  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    
    const customerId = `cust_${Math.floor(Math.random() * 100000)}`;
    const orderId = `ord_${Math.floor(Math.random() * 900000 + 100000)}`;

    const newOrderItems: OrderItem[] = cart.map((c) => ({
      id: `item_${Math.floor(Math.random() * 100000)}`,
      menuItemId: c.menuItem.id,
      name: c.menuItem.name,
      quantity: c.quantity,
      unitPrice: c.menuItem.price,
      totalPrice: c.menuItem.price * c.quantity,
      stationId: 'main',
      status: 'pending'
    }));

    const orderPayload: any = {
      id: orderId,
      tenantId,
      tableId,
      tableNumber: tableName,
      customerId,
      customerName: customerName.trim() || 'Guest Customer',
      status: 'pending' as OrderStatus,
      kitchenStationStatus: { main: 'pending' },
      totals: {
        subtotal: cartSubtotal,
        tax,
        serviceCharge,
        tip: 0,
        discount: 0,
        grandTotal: cartTotal
      },
      payment: {
        status: 'unpaid' as PaymentStatus,
        amountPaid: 0
      }
    };

    try {
      // Transition table status to occupied on order submission
      if (isMockMode) {
        const cachedTables = localStorage.getItem('restaurant_qr_mock_tables_db');
        if (cachedTables) {
          try {
            const parsedTables = JSON.parse(cachedTables);
            const updatedTables = parsedTables.map((t: any) =>
              t.id === tableId ? { ...t, status: 'occupied' } : t
            );
            localStorage.setItem('restaurant_qr_mock_tables_db', JSON.stringify(updatedTables));
            window.dispatchEvent(new Event('storage'));
          } catch (e) {}
        }

        // Save to mock storage
        const cached = localStorage.getItem(MOCK_ORDERS_KEY);
        const existingOrders = cached ? JSON.parse(cached) : [];
        const fullMockOrder: Order = {
          ...orderPayload,
          createdAt: new Date(),
          updatedAt: new Date(),
          items: newOrderItems
        };
        existingOrders.push(fullMockOrder);
        localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(existingOrders));
        
        // Mock live update
        setTrackedOrder(fullMockOrder);
      } else {
        // Save to live Firestore batch-style
        // Write header
        await setDoc(doc(db, 'tenants', tenantId, 'orders', orderId), {
          ...orderPayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Write subcollection items
        for (const item of newOrderItems) {
          await setDoc(doc(db, 'tenants', tenantId, 'orders', orderId, 'order_items', item.id), item);
        }

        // Auto-transition table status in Firestore
        try {
          await setDoc(doc(db, 'tenants', tenantId, 'tables', tableId), { status: 'occupied' }, { merge: true });
        } catch (err) {
          console.error('Failed to auto-occupy table in Firestore:', err);
        }
      }

      // Success actions
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
    }
  };

  if (tableError) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col items-center justify-center p-6 text-center">
        <div className="h-16 w-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6">
          <X className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-bold text-white uppercase tracking-wider">Invalid Table QR Code</h2>
        <p className="text-xs text-zinc-400 max-w-xs mt-3 leading-relaxed">
          This QR code points to a table ID that does not exist or has been decommissioned. Please contact restaurant staff to place your order.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans pb-28">
      {/* 1. Header Hero Panel */}
      <div className="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-zinc-950 border-b border-zinc-900 px-5 pt-8 pb-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              {tableName}
            </span>
            <h1 className="text-xl font-extrabold text-white tracking-tight mt-1.5">{restaurantName}</h1>
            <p className="text-xs text-zinc-500">Scan verified • Multi-Tenant QR Menu</p>
          </div>
          <div className="h-10 w-10 border border-zinc-800 bg-zinc-900/40 rounded-xl flex items-center justify-center text-zinc-300">
            <Utensils className="h-5 w-5 text-emerald-400" />
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mt-6 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search dishes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-zinc-850 bg-zinc-900/40 pl-9 pr-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/30 rounded-xl placeholder-zinc-500"
            />
          </div>
          <button
            onClick={() => setVegOnly(!vegOnly)}
            className={`px-3 py-2 border rounded-xl text-xs font-semibold flex items-center gap-1 transition ${
              vegOnly 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'border-zinc-850 bg-zinc-900/20 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${vegOnly ? 'bg-emerald-400' : 'bg-zinc-650'}`} />
            Veg Only
          </button>
        </div>
      </div>

      {/* 2. Track Order Screen Overlay (If order placed) */}
      {placedOrderId && (
        <div className="max-w-md mx-auto p-5 mt-6 space-y-6">
          <div className="border border-emerald-500/20 bg-emerald-500/5 p-6 rounded-2xl text-center space-y-3 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/5 blur-2xl rounded-full" />
            <div className="h-12 w-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <Check className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-white">Order Sent to Kitchen!</h2>
            <p className="text-xs text-zinc-400">Order ID: <span className="font-mono text-zinc-300 font-bold">#{placedOrderId}</span></p>
            
            <div className="h-px bg-zinc-900/60 my-4" />

            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-extrabold">Live Kitchen Status</span>
              <h3 className="text-base font-bold text-emerald-400 uppercase tracking-widest mt-0.5 animate-pulse">
                {trackedOrder?.status || 'pending'}
              </h3>
            </div>
          </div>

          <div className="border border-zinc-900 bg-zinc-900/30 p-5 rounded-2xl space-y-4">
            <h3 className="text-xs uppercase tracking-wider font-bold text-zinc-400">Order Details</h3>
            <div className="divide-y divide-zinc-900/60">
              {trackedOrder?.items?.map((item) => (
                <div key={item.id} className="py-2.5 flex justify-between text-xs">
                  <div>
                    <span className="font-bold text-zinc-200">{item.name}</span>
                    <span className="text-zinc-500 ml-1.5">x{item.quantity}</span>
                  </div>
                  <span className="font-bold text-zinc-300">₹{item.totalPrice.toFixed(2)}</span>
                </div>
              )) || (
                cart.map((c) => (
                  <div key={c.menuItem.id} className="py-2.5 flex justify-between text-xs">
                    <div>
                      <span className="font-bold text-zinc-200">{c.menuItem.name}</span>
                      <span className="text-zinc-500 ml-1.5">x{c.quantity}</span>
                    </div>
                    <span className="font-bold text-zinc-300">₹{(c.menuItem.price * c.quantity).toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-zinc-900 flex justify-between items-center">
              <span className="text-xs text-zinc-400 font-semibold">Grand Total:</span>
              <span className="text-sm font-extrabold text-white">
                ₹{(trackedOrder?.totals?.grandTotal || cartTotal).toFixed(2)}
              </span>
            </div>
          </div>

          <button
            onClick={() => setPlacedOrderId(null)}
            className="w-full py-3 bg-zinc-900 hover:bg-zinc-850 text-xs font-semibold uppercase tracking-wider rounded-xl transition border border-zinc-800"
          >
            Order Something Else
          </button>
        </div>
      )}

      {/* 3. Catalog Screen */}
      {!placedOrderId && (
        <div className="max-w-md mx-auto px-5 pt-6 space-y-6">
          {/* Categories Carousel */}
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 border text-xs font-bold uppercase tracking-wider rounded-xl transition shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                    : 'border-zinc-900 bg-zinc-900/30 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Catalog Listing */}
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              No dishes found matching filters.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item) => (
                <div key={item.id} className="border border-zinc-900 bg-zinc-900/20 p-4 rounded-2xl flex items-center justify-between gap-4 relative group">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                        item.dietaryTags.includes('veg') || item.dietaryTags.includes('vegan') 
                          ? 'bg-emerald-500' 
                          : 'bg-rose-500'
                      }`} />
                      <h4 className="font-bold text-sm text-white truncate">{item.name}</h4>
                    </div>
                    <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">{item.description}</p>
                    
                    <div className="flex gap-4 items-center pt-1.5">
                      <span className="font-extrabold text-zinc-300 text-sm">₹{item.price.toFixed(2)}</span>
                      <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {item.preparationTime} mins
                      </span>
                    </div>
                  </div>

                  {/* Add / Quantity selector */}
                  <div className="shrink-0">
                    {getCartQuantity(item.id) === 0 ? (
                      <button
                        onClick={() => addToCart(item)}
                        className="h-9 w-9 border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-emerald-400 hover:text-emerald-300 rounded-xl flex items-center justify-center shadow-lg transition duration-200"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg h-9">
                        <button
                          onClick={() => removeFromCart(item)}
                          className="px-2.5 text-zinc-500 hover:text-zinc-300 h-full flex items-center"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="px-1 text-xs font-bold text-white w-5 text-center">
                          {getCartQuantity(item.id)}
                        </span>
                        <button
                          onClick={() => addToCart(item)}
                          className="px-2.5 text-zinc-500 hover:text-zinc-300 h-full flex items-center"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Sticky Floating Cart Bar */}
      {!placedOrderId && cart.length > 0 && (
        <div className="fixed bottom-6 left-5 right-5 max-w-md mx-auto z-40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white p-4 rounded-2xl flex items-center justify-between shadow-2xl transition duration-300 transform active:scale-98 shadow-emerald-500/20"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-white/10 rounded-xl flex items-center justify-center font-bold text-xs text-white">
                {cart.reduce((sum, c) => sum + c.quantity, 0)}
              </div>
              <div className="text-left">
                <span className="text-[10px] text-emerald-100 font-semibold uppercase tracking-wider block">View Cart</span>
                <span className="text-xs font-bold text-white">Review orders</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 font-bold text-sm">
              ₹{cartTotal.toFixed(2)}
              <ChevronRight className="h-4 w-4" />
            </div>
          </button>
        </div>
      )}

      {/* 5. Cart Details Drawer Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md border-t border-zinc-900 bg-zinc-950 p-6 shadow-2xl rounded-t-3xl max-h-[85vh] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-base font-extrabold text-white">Review Table Order</h3>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mt-0.5">{tableName}</p>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-1.5 border border-zinc-900 text-zinc-500 hover:text-zinc-300 rounded-xl transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Items List inside Drawer */}
              <div className="overflow-y-auto max-h-[40vh] divide-y divide-zinc-900/60 pr-1">
                {cart.map((item) => (
                  <div key={item.menuItem.id} className="py-3 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-zinc-200 text-xs">{item.menuItem.name}</h4>
                      <p className="text-[10px] text-zinc-500 mt-0.5">₹{item.menuItem.price.toFixed(2)} each</p>
                    </div>

                    <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden h-8">
                      <button
                        onClick={() => removeFromCart(item.menuItem)}
                        className="px-2 text-zinc-500 hover:text-zinc-300"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="px-1 text-xs font-bold text-white w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => addToCart(item.menuItem)}
                        className="px-2 text-zinc-500 hover:text-zinc-300"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Name Details Input */}
              <div className="mt-6 space-y-1.5">
                <label className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider">Your Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Alex (for KDS notification)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full border border-zinc-900 bg-zinc-900/40 px-3 py-2.5 text-xs focus:outline-none text-zinc-200 rounded-xl placeholder-zinc-650"
                />
              </div>

              {/* Bill Details */}
              <div className="mt-6 p-4 border border-zinc-900 bg-zinc-900/20 rounded-2xl space-y-2.5 text-xs text-zinc-400">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-bold text-zinc-300">₹{cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>CGST & SGST (5%):</span>
                  <span className="font-bold text-zinc-300">₹{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Service Charge (10%):</span>
                  <span className="font-bold text-zinc-300">₹{serviceCharge.toFixed(2)}</span>
                </div>
                <div className="h-px bg-zinc-900/60 my-2" />
                <div className="flex justify-between text-sm text-white font-extrabold">
                  <span>Grand Total:</span>
                  <span>₹{cartTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handlePlaceOrder}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-4 rounded-2xl text-xs uppercase tracking-wider mt-6 shadow-xl shadow-emerald-500/10 transition duration-200"
            >
              Confirm and Place Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
