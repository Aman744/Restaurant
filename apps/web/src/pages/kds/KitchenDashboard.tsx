import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/shared/DashboardLayout';
import { ChefHat, Flame, CheckCircle, Clock, Bell, Settings, Search, AlertCircle, RotateCcw } from 'lucide-react';
import type { OrderItem, Order, MenuItem, OrderStatus } from '@restaurant-qr/core';
import { useUserProfile } from '../../features/auth/context/UserContext.js';
import { db } from '../../lib/firebase.js';
import { doc, setDoc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { OrderConverter } from '@restaurant-qr/infra';
import { useLocation } from 'react-router-dom';

interface KDSOrder {
  id: string;
  tableNumber: string;
  tableId: string;
  customerName?: string;
  grandTotal: number;
  status: OrderStatus;
  items: OrderItem[];
  elapsedSeconds: number;
  priority: boolean;
}

const MOCK_ORDERS_KEY = 'restaurant_qr_mock_orders_db';

const parseOrderDate = (val: any): Date => {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  if (typeof val.toDate === 'function') return val.toDate();
  if (typeof val.seconds === 'number') return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
};

export const KitchenDashboard: React.FC = () => {
  const { profile } = useUserProfile();
  const tenantId = profile?.tenantId || 'tenant_dev_123';

  const isMockMode = !import.meta.env.VITE_FIREBASE_API_KEY ||
    import.meta.env.VITE_FIREBASE_API_KEY === 'your_api_key_here';

  const location = useLocation();
  const currentView = location.pathname.endsWith('/availability') ? 'inventory' : 'orders';

  const sidebarItems = [
    { name: 'Kitchen Grid', path: '/kitchen', icon: ChefHat },
    { name: 'Dish Availability', path: '/kitchen/availability', icon: Settings },
  ];

  const [activeStation, setActiveStation] = useState<string>('All Stations');
  const [orders, setOrders] = useState<Order[]>([]);
  const [elapsedMap, setElapsedMap] = useState<Record<string, number>>({});
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');
  const [selectedStockFilter, setSelectedStockFilter] = useState<string>('All Statuses');

  const playBellSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch (e) {
      console.warn('Audio context blocked by browser policy:', e);
    }
  };

  // Sync real-time orders (including completed orders for archive view)
  useEffect(() => {
    let active = true;

    if (isMockMode) {
      const syncMockOrders = () => {
        const cached = localStorage.getItem(MOCK_ORDERS_KEY);
        if (cached && active) {
          try {
            const parsed = JSON.parse(cached).map((o: any) => ({
              ...o,
              createdAt: parseOrderDate(o.createdAt),
              updatedAt: parseOrderDate(o.updatedAt)
            }));
            
            setOrders((prev) => {
              if (parsed.length > prev.length && prev.length > 0) {
                playBellSound();
              }
              return parsed;
            });
          } catch (e) {}
        }
      };

      syncMockOrders();
      const interval = setInterval(syncMockOrders, 2000);
      return () => {
        clearInterval(interval);
        active = false;
      };
    } else {
      const colRef = collection(db, 'tenants', tenantId, 'orders').withConverter(OrderConverter);
      
      const unsubscribe = onSnapshot(colRef, async (snap: any) => {
        if (!active) return;
        const ordersList: Order[] = [];
        for (const d of snap.docs) {
          const header = d.data();
          const itemsCol = collection(db, 'tenants', tenantId, 'orders', d.id, 'order_items');
          const itemsSnap = await getDocs(itemsCol);
          ordersList.push({
            ...header,
            items: itemsSnap.docs.map((it: any) => ({ id: it.id, ...it.data() }))
          } as Order);
        }

        setOrders((prev) => {
          if (ordersList.length > prev.length && prev.length > 0) {
            playBellSound();
          }
          return ordersList;
        });
      }, (err: any) => {
        console.error('KDS orders listener error:', err);
      });

      return () => {
        unsubscribe();
        active = false;
      };
    }
  }, [tenantId, isMockMode]);

  // Sync real-time menu items
  useEffect(() => {
    let active = true;
    const MOCK_MENU_KEY = 'restaurant_qr_mock_menu_db';

    if (isMockMode) {
      const syncMockMenu = () => {
        const cached = localStorage.getItem(MOCK_MENU_KEY);
        if (cached && active) {
          try {
            setMenuItems(JSON.parse(cached));
          } catch (e) {}
        }
      };
      syncMockMenu();
      const interval = setInterval(syncMockMenu, 2000);
      return () => {
        clearInterval(interval);
        active = false;
      };
    } else {
      const colRef = collection(db, 'tenants', tenantId, 'menu_items');
      const unsubscribe = onSnapshot(colRef, (snap: any) => {
        if (active) {
          setMenuItems(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as MenuItem)));
        }
      }, (err: any) => {
        console.error('KDS menu listener error:', err);
      });

      return () => {
        unsubscribe();
        active = false;
      };
    }
  }, [tenantId, isMockMode]);

  // Keep timers running with accurate elapsed seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedMap(() => {
        const next: Record<string, number> = {};
        orders.forEach((o) => {
          const createdDate = parseOrderDate(o.createdAt);
          const diffSecs = Math.floor((Date.now() - createdDate.getTime()) / 1000);
          next[o.id] = (diffSecs >= 0 && diffSecs < 7200) ? diffSecs : 120;
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [orders]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins.toString().padStart(2, '0')}m`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCompleteItem = async (orderId: string, itemId: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return {
            ...o,
            items: o.items.map((i) => i.id === itemId ? { ...i, status: 'ready' as const } : i)
          };
        }
        return o;
      })
    );

    if (isMockMode) {
      const cached = localStorage.getItem(MOCK_ORDERS_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const updated = parsed.map((o: any) => {
            if (o.id === orderId) {
              return {
                ...o,
                items: o.items.map((i: any) => i.id === itemId ? { ...i, status: 'ready' } : i)
              };
            }
            return o;
          });
          localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(updated));
        } catch (e) {}
      }
    } else {
      try {
        const itemDocRef = doc(db, 'tenants', tenantId, 'orders', orderId, 'order_items', itemId);
        await setDoc(itemDocRef, { status: 'ready' }, { merge: true });
      } catch (err: any) {
        console.error('Failed to update KDS item status:', err);
      }
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, nextStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
    );

    if (isMockMode) {
      const cached = localStorage.getItem(MOCK_ORDERS_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const updated = parsed.map((o: any) =>
            o.id === orderId ? { ...o, status: nextStatus, updatedAt: new Date().toISOString() } : o
          );
          localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(updated));
          window.dispatchEvent(new Event('storage'));
        } catch (e) {}
      }
    } else {
      try {
        const orderDocRef = doc(db, 'tenants', tenantId, 'orders', orderId);
        await setDoc(orderDocRef, { status: nextStatus, updatedAt: new Date() }, { merge: true });
      } catch (err: any) {
        console.error('Failed to update parent order status:', err);
      }
    }
  };

  const handleUpdateStock = async (itemId: string, status: 'in-stock' | 'limited' | 'out-of-stock') => {
    setMenuItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, stockStatus: status } : item))
    );

    if (isMockMode) {
      const cached = localStorage.getItem('restaurant_qr_mock_menu_db');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const updated = parsed.map((item: any) =>
            item.id === itemId ? { ...item, stockStatus: status } : item
          );
          localStorage.setItem('restaurant_qr_mock_menu_db', JSON.stringify(updated));
        } catch (e) {}
      }
    } else {
      try {
        const itemDocRef = doc(db, 'tenants', tenantId, 'menu_items', itemId);
        await setDoc(itemDocRef, { stockStatus: status }, { merge: true });
      } catch (err: any) {
        console.error('Failed to update stock status:', err);
      }
    }
  };

  const handleUpdatePrepTime = async (itemId: string, prepTime: number) => {
    setMenuItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, preparationTime: prepTime } : item))
    );

    if (isMockMode) {
      const cached = localStorage.getItem('restaurant_qr_mock_menu_db');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const updated = parsed.map((item: any) =>
            item.id === itemId ? { ...item, preparationTime: prepTime } : item
          );
          localStorage.setItem('restaurant_qr_mock_menu_db', JSON.stringify(updated));
        } catch (e) {}
      }
    } else {
      try {
        const itemDocRef = doc(db, 'tenants', tenantId, 'menu_items', itemId);
        await setDoc(itemDocRef, { preparationTime: prepTime }, { merge: true });
      } catch (err: any) {
        console.error('Failed to update prep time:', err);
      }
    }
  };

  const handleToggleActive = async (itemId: string, currentActive: boolean) => {
    setMenuItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, isActive: !currentActive } : item))
    );

    if (isMockMode) {
      const cached = localStorage.getItem('restaurant_qr_mock_menu_db');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const updated = parsed.map((item: any) =>
            item.id === itemId ? { ...item, isActive: !currentActive } : item
          );
          localStorage.setItem('restaurant_qr_mock_menu_db', JSON.stringify(updated));
        } catch (e) {}
      }
    } else {
      try {
        const itemDocRef = doc(db, 'tenants', tenantId, 'menu_items', itemId);
        await setDoc(itemDocRef, { isActive: !currentActive }, { merge: true });
      } catch (err: any) {
        console.error('Failed to toggle active status:', err);
      }
    }
  };

  // Active Orders for KDS Grid
  const kdsOrders: KDSOrder[] = orders
    .map((o) => {
      let safeItems = Array.isArray(o?.items) && o.items.length > 0 ? o.items : [
        {
          id: `item_kds_${o.id}`,
          menuItemId: 'item_01',
          name: 'Chef\'s Special Order Dish',
          quantity: 1,
          unitPrice: o?.totals?.grandTotal || 0,
          totalPrice: o?.totals?.grandTotal || 0,
          stationId: 'main' as const,
          status: 'pending' as const
        }
      ];

      const stationItems = safeItems.filter((item) => {
        const matchesStation =
          activeStation === 'All Stations' ||
          !item.stationId ||
          item.stationId.toLowerCase() === activeStation.toLowerCase();
        
        const itemStatus = item.status || 'pending';
        return matchesStation && (itemStatus === 'pending' || itemStatus === 'preparing');
      });

      return {
        id: o.id,
        tableNumber: o.tableNumber || `Table ${o.tableId || '1'}`,
        tableId: o.tableId || 'unknown_table',
        customerName: o.customerName || 'Guest Customer',
        grandTotal: o.totals?.grandTotal || 0,
        status: o.status || 'pending',
        items: stationItems,
        elapsedSeconds: elapsedMap[o.id] ?? 120,
        priority: safeItems.some((it) => it.notes)
      };
    })
    .filter((o) => o.items.length > 0 && o.status !== 'completed' && o.status !== 'archived' && o.status !== 'ready');

  // Completed Kitchen Orders Section (Fulfilled Prep History)
  const completedKdsOrders: KDSOrder[] = orders
    .map((o) => {
      let safeItems = Array.isArray(o?.items) && o.items.length > 0 ? o.items : [
        {
          id: `item_kds_${o.id}`,
          menuItemId: 'item_01',
          name: 'Chef\'s Special Order Dish',
          quantity: 1,
          unitPrice: o?.totals?.grandTotal || 0,
          totalPrice: o?.totals?.grandTotal || 0,
          stationId: 'main' as const,
          status: 'ready' as const
        }
      ];

      const stationItems = safeItems.filter((item) => {
        const matchesStation =
          activeStation === 'All Stations' ||
          !item.stationId ||
          item.stationId.toLowerCase() === activeStation.toLowerCase();
        return matchesStation;
      });

      return {
        id: o.id,
        tableNumber: o.tableNumber || `Table ${o.tableId || '1'}`,
        tableId: o.tableId || 'unknown_table',
        customerName: o.customerName || 'Guest Customer',
        grandTotal: o.totals?.grandTotal || 0,
        status: o.status || 'ready',
        items: stationItems,
        elapsedSeconds: elapsedMap[o.id] ?? 180,
        priority: false
      };
    })
    .filter((o) => o.status === 'ready' || o.status === 'completed' || o.status === 'served');

  const categoriesList = ['All Categories', ...Array.from(new Set(menuItems.map((item) => item.categoryId).filter(Boolean)))];

  const filteredMenuItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.categoryId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All Categories' || item.categoryId === selectedCategory;
    const matchesStock = selectedStockFilter === 'All Statuses' ||
      (selectedStockFilter === 'In Stock' && item.stockStatus === 'in-stock') ||
      (selectedStockFilter === 'Out of Stock' && item.stockStatus === 'out-of-stock') ||
      (selectedStockFilter === 'Limited' && item.stockStatus === 'limited');
    return matchesSearch && matchesCategory && matchesStock;
  });

  return (
    <DashboardLayout 
      title={currentView === 'inventory' ? "Dish Availability Control" : "Kitchen Display System (KDS)"} 
      sidebarItems={sidebarItems}
    >
      <div className="space-y-6">
        {currentView === 'inventory' ? (
          <div className="space-y-6 animate-fadeIn">
            {/* Inventory Controls & Filters */}
            <div className="space-y-4 border-b border-zinc-900 pb-5">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="relative w-full md:max-w-xs">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search dishes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 text-xs bg-zinc-900 border border-zinc-850 text-white rounded-xl w-full focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="flex bg-zinc-950 p-1 border border-zinc-900 rounded-xl">
                    {['All Statuses', 'In Stock', 'Limited', 'Out of Stock'].map((filter) => {
                      const isActive = selectedStockFilter === filter;
                      return (
                        <button
                          key={filter}
                          onClick={() => setSelectedStockFilter(filter)}
                          className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition cursor-pointer ${
                            isActive 
                              ? 'bg-zinc-800 text-white' 
                              : 'text-zinc-550 hover:text-zinc-300'
                          }`}
                        >
                          {filter}
                        </button>
                      );
                    })}
                  </div>
                  
                  <span className="text-xs text-zinc-500 font-medium ml-auto md:ml-0">
                    Showing: {filteredMenuItems.length} dishes
                  </span>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-2 pt-1">
                {categoriesList.map((category) => {
                  const isActive = selectedCategory === category;
                  return (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-3 py-1.5 text-[10px] font-semibold rounded-lg transition cursor-pointer border ${
                        isActive
                          ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/25'
                          : 'bg-zinc-900 text-zinc-450 border-zinc-850 hover:text-zinc-250 hover:bg-zinc-850'
                      }`}
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Inventory Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMenuItems.map((item) => {
                let statusColor = 'bg-zinc-800 text-zinc-400 border-zinc-700';
                if (item.stockStatus === 'in-stock') statusColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                if (item.stockStatus === 'limited') statusColor = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
                if (item.stockStatus === 'out-of-stock') statusColor = 'bg-red-500/10 text-red-400 border-red-500/20';

                return (
                  <div
                    key={item.id}
                    className="border border-zinc-900 bg-zinc-905/30 rounded-2xl p-4 flex flex-col justify-between space-y-4 hover:border-zinc-800 transition duration-200"
                  >
                    <div className="flex gap-4">
                      {item.images && item.images[0] ? (
                        <img
                          src={item.images[0]}
                          alt={item.name}
                          className="h-16 w-16 rounded-xl object-cover border border-zinc-850"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-400 font-bold text-lg">
                          {item.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 space-y-1">
                        <h4 className="text-sm font-bold text-white leading-snug">{item.name}</h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">
                            {item.categoryId}
                          </span>
                          <span className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${statusColor}`}>
                            {item.stockStatus?.replace('-', ' ') || 'in stock'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stock Quick Controls */}
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold text-zinc-550 uppercase tracking-wider">Availability</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['in-stock', 'limited', 'out-of-stock'] as const).map((status) => {
                          const isActive = item.stockStatus === status;
                          let btnClass = 'bg-zinc-950 text-zinc-500 border border-zinc-900 hover:bg-zinc-900';
                          if (isActive) {
                            if (status === 'in-stock') btnClass = 'bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/10';
                            if (status === 'limited') btnClass = 'bg-yellow-505 text-black border-yellow-600 shadow-md shadow-yellow-500/10';
                            if (status === 'out-of-stock') btnClass = 'bg-red-500 text-white border-red-600 shadow-md shadow-red-500/10';
                          }
                          return (
                            <button
                              key={status}
                              onClick={() => handleUpdateStock(item.id, status)}
                              className={`py-1.5 text-[9px] font-bold uppercase rounded-lg transition cursor-pointer text-center ${btnClass}`}
                            >
                              {status === 'in-stock' ? 'In Stock' : status === 'limited' ? 'Limited' : 'Out Stock'}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Prep Time & Visibility Controls */}
                    <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-zinc-900/60">
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-zinc-550 uppercase tracking-wider">Prep Time</p>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            max="120"
                            value={item.preparationTime || 10}
                            onChange={(e) => handleUpdatePrepTime(item.id, parseInt(e.target.value) || 10)}
                            className="w-12 py-1 text-center font-semibold bg-zinc-950 border border-zinc-900 rounded-lg text-xs text-white focus:outline-none focus:border-orange-500"
                          />
                          <span className="text-[10px] text-zinc-550 font-medium">min</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-zinc-550 uppercase tracking-wider">Visibility</p>
                        <button
                          onClick={() => handleToggleActive(item.id, item.isActive)}
                          className={`w-full py-1 text-[10px] font-bold uppercase rounded-lg border transition text-center cursor-pointer ${
                            item.isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                          }`}
                        >
                          {item.isActive ? 'Visible' : 'Hidden'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredMenuItems.length === 0 && (
                <div className="col-span-full border border-dashed border-zinc-850 py-20 text-center text-zinc-550 rounded-3xl">
                  <AlertCircle className="h-10 w-10 mx-auto text-zinc-600 mb-4 animate-pulse" />
                  <p className="text-sm font-semibold text-zinc-300">No dishes match your filters</p>
                  <p className="text-xs text-zinc-550 mt-1">Try refining your search query or selecting another status</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Active Kitchen Tickets Section */}
            <div className="space-y-6">
              {/* Header Stations Bar */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-b border-zinc-900 pb-4">
                <div className="flex flex-wrap gap-2">
                  {['All Stations', 'Pizza', 'Grill', 'Drinks', 'Dessert'].map((station) => {
                    const isActive = activeStation === station;
                    return (
                      <button
                        key={station}
                        onClick={() => setActiveStation(station)}
                        className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition cursor-pointer ${
                          isActive
                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/15'
                            : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-850 hover:text-zinc-205'
                        }`}
                      >
                        {station}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={playBellSound}
                    className="p-2 border border-zinc-800 text-zinc-455 hover:text-white rounded-xl hover:bg-zinc-900 transition"
                    title="Test Sound Bell"
                  >
                    <Bell className="h-4.5 w-4.5" />
                  </button>
                  <span className="text-xs text-zinc-500 font-medium">
                    Active Queue: {kdsOrders.length} tickets
                  </span>
                </div>
              </div>

              {/* KDS Active Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {kdsOrders.map((order) => {
                  const isLate = order.elapsedSeconds > 180;
                  return (
                    <div
                      key={order.id}
                      className={`border bg-zinc-900/10 rounded-3xl flex flex-col justify-between overflow-hidden shadow-lg transition duration-200 ${
                        order.priority
                          ? 'border-red-500/30'
                          : isLate
                          ? 'border-orange-500/30'
                          : 'border-amber-500/25'
                      }`}
                    >
                      {/* Ticket Header */}
                      <div className="p-5 border-b border-zinc-900 bg-zinc-900/30 flex justify-between items-center">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-xl">
                            {order.tableNumber}
                          </span>
                          <span className="text-sm font-extrabold text-white">
                            #{order.id.slice(-6).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <Clock className={`h-4 w-4 ${isLate ? 'text-red-500 animate-pulse' : 'text-amber-400'}`} />
                          <span className={`font-mono font-bold text-sm ${isLate ? 'text-red-500' : 'text-amber-400'}`}>
                            {formatTimer(order.elapsedSeconds)}
                          </span>
                        </div>
                      </div>

                      {/* Ticket Header Metadata */}
                      <div className="px-5 py-2.5 bg-zinc-950/40 border-b border-zinc-900/60 flex items-center justify-between text-[11px] font-medium text-zinc-400">
                        <div>
                          <span className="text-zinc-550">Customer:</span> <span className="text-zinc-200 font-semibold ml-1">{order.customerName}</span>
                        </div>
                        <div>
                          <span className="text-zinc-550">Total Bill:</span> <span className="text-emerald-400 font-extrabold ml-1">₹{order.grandTotal.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Ticket Items */}
                      <div className="p-5 space-y-4 flex-1">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex justify-between items-center border-b border-zinc-900/40 pb-4 last:border-b-0 last:pb-0">
                            <div className="space-y-1.5 max-w-[70%]">
                              <p className="text-sm font-bold text-white leading-snug">
                                {item.quantity}x {item.name}
                              </p>
                              {item.selectedVariant && (
                                <span className="inline-block text-[10px] font-medium bg-zinc-800 text-zinc-400 px-2.5 py-0.5 rounded-full font-mono">
                                  {item.selectedVariant.name}
                                </span>
                              )}
                              {item.notes && (
                                <p className="text-[10px] text-orange-400 bg-orange-950/15 border border-orange-500/10 px-2 py-1.5 rounded-lg leading-relaxed mt-1">
                                  💡 Note: {item.notes}
                                </p>
                              )}
                            </div>

                            <button
                              onClick={() => handleCompleteItem(order.id, item.id)}
                              className="flex items-center gap-1.5 py-2 px-3.5 text-xs font-bold uppercase rounded-xl border border-zinc-800 bg-zinc-900 text-white hover:bg-emerald-500 hover:border-emerald-500 hover:text-white transition cursor-pointer shadow-md"
                            >
                              <Flame className="h-3.5 w-3.5 text-orange-400" />
                              DONE
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Parent Order Status Controls */}
                      <div className="p-4 bg-zinc-950/40 border-t border-zinc-900 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold text-zinc-500">Status:</span>
                          <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg border ${
                            order.status === 'pending' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            order.status === 'preparing' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                            order.status === 'ready' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            'bg-zinc-800 text-zinc-300 border-zinc-700'
                          }`}>
                            {order.status}
                          </span>
                        </div>

                        <div>
                          {order.status === 'pending' && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg shadow-emerald-500/10 transition cursor-pointer"
                            >
                              ACCEPT ORDER
                            </button>
                          )}
                          {order.status === 'preparing' && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'ready')}
                              className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg shadow-orange-500/10 transition cursor-pointer"
                            >
                              MARK READY
                            </button>
                          )}
                          {(order.status === 'ready' || order.status === 'completed') && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                              className="bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-zinc-700 font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
                            >
                              COMPLETE TICKET
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {kdsOrders.length === 0 && (
                  <div className="col-span-full border border-dashed border-zinc-850 py-16 text-center text-zinc-500 rounded-3xl">
                    <CheckCircle className="h-10 w-10 mx-auto text-emerald-500/20 mb-4 animate-bounce" />
                    <p className="text-sm font-semibold text-zinc-300">All active tickets clear!</p>
                    <p className="text-xs text-zinc-550 mt-1">Check the completed orders section below for fulfilled prep history</p>
                  </div>
                )}
              </div>
            </div>

            {/* Below Section: Completed Kitchen Orders Archive */}
            <div className="pt-8 border-t border-zinc-900 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white tracking-tight">Completed Kitchen Orders</h3>
                    <p className="text-xs text-zinc-500">Fulfilled kitchen prep tickets and ready dish history</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl">
                  {completedKdsOrders.length} Fulfilled Tickets
                </span>
              </div>

              {completedKdsOrders.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {completedKdsOrders.map((order) => (
                    <div
                      key={`completed_${order.id}`}
                      className="border border-zinc-850 bg-zinc-900/40 rounded-3xl p-5 space-y-4 opacity-80 hover:opacity-100 transition duration-200"
                    >
                      <div className="flex justify-between items-center border-b border-zinc-850 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-xl">
                            {order.tableNumber}
                          </span>
                          <span className="text-sm font-bold text-white">#{order.id.slice(-6).toUpperCase()}</span>
                        </div>
                        <span className="text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                          READY / DONE
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex justify-between items-center text-zinc-300">
                            <span className="font-semibold">{item.quantity}x {item.name}</span>
                            <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> READY
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-3 border-t border-zinc-850 flex justify-between items-center text-xs">
                        <span className="text-zinc-500 text-[11px] font-mono">Bill: ₹{order.grandTotal.toFixed(2)}</span>
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
                          className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 px-3 py-1.5 rounded-xl transition cursor-pointer"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Re-Open Ticket
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-zinc-850 py-12 text-center text-zinc-500 rounded-3xl">
                  <p className="text-xs font-semibold text-zinc-400">No completed kitchen tickets in current session</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
