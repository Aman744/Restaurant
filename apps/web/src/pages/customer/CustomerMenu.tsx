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
  Clock,
  X,
  ShoppingBag,
  CheckCircle2,
  ChevronRight,
  Loader2
} from 'lucide-react';

const MOCK_MENU_KEY = 'restaurant_qr_mock_menu_db';
const MOCK_ORDERS_KEY = 'restaurant_qr_mock_orders_db';

const DEFAULT_SAMPLE_MENU: MenuItem[] = [
  {
    id: 'item_01',
    tenantId: 'tenant_dev_123',
    categoryId: 'mains',
    name: 'Truffle Mushroom Burger',
    description: 'Artisanal brioche bun, black truffle aioli, aged cheddar & wild mushrooms',
    price: 450,
    images: ['https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80'],
    dietaryTags: ['veg'],
    allergens: ['gluten', 'dairy'],
    stockStatus: 'in-stock',
    preparationTime: 12,
    isActive: true
  },
  {
    id: 'item_02',
    tenantId: 'tenant_dev_123',
    categoryId: 'pizza',
    name: 'Wood-Fired Margherita Pizza',
    description: 'San Marzano tomato sauce, fresh mozzarella di bufala & sweet basil',
    price: 520,
    images: ['https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=600&q=80'],
    dietaryTags: ['veg'],
    allergens: ['gluten', 'dairy'],
    stockStatus: 'in-stock',
    preparationTime: 15,
    isActive: true
  },
  {
    id: 'item_03',
    tenantId: 'tenant_dev_123',
    categoryId: 'mains',
    name: 'Paneer Butter Masala & Naan',
    description: 'Cottage cheese cubes simmered in rich velvety tomato cashew gravy',
    price: 380,
    images: ['https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80'],
    dietaryTags: ['veg'],
    allergens: ['dairy', 'nuts'],
    stockStatus: 'in-stock',
    preparationTime: 10,
    isActive: true
  },
  {
    id: 'item_04',
    tenantId: 'tenant_dev_123',
    categoryId: 'drinks',
    name: 'Fresh Mint Lime Soda',
    description: 'Sparkling mineral soda with freshly squeezed lime and crushed mint leaves',
    price: 120,
    images: ['https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80'],
    dietaryTags: ['vegan'],
    allergens: [],
    stockStatus: 'in-stock',
    preparationTime: 5,
    isActive: true
  }
];

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

export const CustomerMenu: React.FC = () => {
  const { tenantId = 'tenant_dev_123', tableId = 'table_01' } = useParams<{ tenantId: string; tableId: string }>();
  const { isMockMode } = useAuth();
  const toast = useToast();

  // Database / state values
  const [restaurantName, setRestaurantName] = useState('Aman\'s Restaurant & Bar');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  const formatTableName = (tId: string) => {
    const match = tId.match(/\d+$/);
    if (match) {
      return `Table ${parseInt(match[0], 10)}`;
    }
    return `Table ${tId.replace(/^table_|^tb_/, '').toUpperCase()}`;
  };

  const [tableName, setTableName] = useState(() => formatTableName(tableId));

  // Fetch restaurant details and menu items
  useEffect(() => {
    let active = true;

    setTableName(formatTableName(tableId));

    if (isMockMode) {
      const cached = localStorage.getItem(MOCK_MENU_KEY);
      if (cached && active) {
        const parsed = JSON.parse(cached);
        setMenuItems(parsed.length > 0 ? parsed : DEFAULT_SAMPLE_MENU);
      } else if (active) {
        setMenuItems(DEFAULT_SAMPLE_MENU);
      }

      const cachedTables = localStorage.getItem('restaurant_qr_mock_tables_db');
      if (cachedTables) {
        try {
          const tablesList = JSON.parse(cachedTables);
          const matchTable = tablesList.find((t: any) => t.id === tableId);
          if (matchTable && matchTable.number && active) {
            setTableName(matchTable.number);
          }
        } catch (e) {}
      }

      setRestaurantName('Aman\'s Restaurant & Bar');
      setLoading(false);
    } else {
      getDoc(doc(db, 'tenants', tenantId)).then((snap: any) => {
        if (snap.exists() && active) {
          setRestaurantName(snap.data().name || 'Aman\'s Restaurant & Bar');
        }
      });

      const menuCol = collection(db, 'tenants', tenantId, 'menu_items').withConverter(MenuItemConverter);
      const unsub = onSnapshot(menuCol, (snap: any) => {
        if (active) {
          const items = snap.docs.map((d: any) => d.data() as MenuItem).filter((i: MenuItem) => i.isActive);
          setMenuItems(items.length > 0 ? items : DEFAULT_SAMPLE_MENU);
          setLoading(false);
        }
      });

      getDoc(doc(db, 'tenants', tenantId, 'tables', tableId)).then((snap: any) => {
        if (active && snap.exists()) {
          const tData = snap.data();
          if (tData?.number) {
            setTableName(tData.number);
          }
        }
      }).catch(() => {});

      return () => {
        active = false;
        unsub();
      };
    }
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

  // Filter menu items
  const filteredMenuItems = menuItems.filter((item) => {
    if (vegOnly && !item.dietaryTags.includes('veg') && !item.dietaryTags.includes('vegan')) {
      return false;
    }
    if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
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
      totalPrice: c.menuItem.price * c.quantity,
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
              t.id === tableId ? { ...t, status: 'occupied' } : t
            );
            localStorage.setItem('restaurant_qr_mock_tables_db', JSON.stringify(updatedTables));
            window.dispatchEvent(new Event('storage'));
          } catch (e) {}
        }

        const cached = localStorage.getItem(MOCK_ORDERS_KEY);
        const existingOrders = cached ? JSON.parse(cached) : [];
        const fullMockOrder: Order = {
          ...orderPayload,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        existingOrders.push(fullMockOrder);
        localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(existingOrders));
        setTrackedOrder(fullMockOrder);
      } else {
        await setDoc(doc(db, 'tenants', tenantId, 'orders', orderId), {
          ...orderPayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        for (const item of newOrderItems) {
          await setDoc(doc(db, 'tenants', tenantId, 'orders', orderId, 'order_items', item.id), item);
        }

        try {
          await setDoc(doc(db, 'tenants', tenantId, 'tables', tableId), { status: 'occupied' }, { merge: true });
        } catch (err) {}
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
        {/* Track Active Order Banner */}
        {placedOrderId && (
          <div className="border border-emerald-500/30 bg-emerald-500/10 p-4 rounded-2xl space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black uppercase text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Order Placed Successfully!
              </span>
              <span className="text-xs font-mono text-zinc-400">ID: #{placedOrderId}</span>
            </div>
            <p className="text-xs text-zinc-300">
              Status:{' '}
              <strong className="text-emerald-400 uppercase">
                {trackedOrder?.status || 'Sent to Kitchen'}
              </strong>
            </p>
          </div>
        )}

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredMenuItems.map((item) => (
            <div
              key={item.id}
              className="border border-zinc-850 bg-zinc-900/60 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-zinc-750 transition shadow-lg"
            >
              <div className="space-y-2">
                {item.images && item.images[0] && (
                  <img
                    src={item.images[0]}
                    alt={item.name}
                    className="w-full h-36 object-cover rounded-xl border border-zinc-800"
                  />
                )}
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
