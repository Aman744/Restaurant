import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/shared/DashboardLayout';
import { ChefHat, Flame, CheckCircle, Clock, Bell, Settings, Search, AlertCircle, RotateCcw } from 'lucide-react';
import type { OrderItem, Order, MenuItem, OrderStatus } from '@restaurant-qr/core';
import { useUserProfile } from '../../features/auth/context/UserContext.js';
import { db } from '../../lib/firebase.js';
import { doc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { OrderRepository, MenuItemConverter } from '@restaurant-qr/infra';
import { useLocation } from 'react-router-dom';
import { EventService } from '../../services/EventService.js';

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

  // Support switching tenants in mock mode / super-admin to view different datasets
  const [tenantList, setTenantList] = useState<{ id: string; name: string }[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState(tenantId);

  useEffect(() => {
    setSelectedTenantId(tenantId);
  }, [tenantId]);

  useEffect(() => {
    if (isMockMode) {
      const stored = localStorage.getItem('restaurant_qr_mock_tenants_db');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const list = parsed.map((t: any) => ({ id: t.id, name: t.name }));
          if (!list.some((t: any) => t.id === 'tenant_dev_123')) {
            list.unshift({ id: 'tenant_dev_123', name: 'My Restaurant (Sandbox)' });
          }
          setTenantList(list);
        } catch (e) {}
      } else {
        setTenantList([
          { id: 'tenant_dev_123', name: 'My Restaurant (Sandbox)' }
        ]);
      }
    }
  }, [isMockMode]);

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
            const parsed = JSON.parse(cached)
              .map((o: any) => ({
                ...o,
                createdAt: parseOrderDate(o.createdAt),
                updatedAt: parseOrderDate(o.updatedAt)
              }))
              .filter((o: any) => o.tenantId === selectedTenantId);
            
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
      const repo = new OrderRepository(db);
      const unsubscribe = repo.subscribeAll(selectedTenantId, (ordersList: Order[]) => {
        if (!active) return;
        setOrders((prev) => {
          if (ordersList.length > prev.length && prev.length > 0) {
            playBellSound();
          }
          return ordersList;
        });
      });

      return () => {
        unsubscribe();
        active = false;
      };
    }
  }, [selectedTenantId, isMockMode]);

  // Sync real-time menu items
  useEffect(() => {
    let active = true;
    const MOCK_MENU_KEY = 'restaurant_qr_mock_menu_db';

    if (isMockMode) {
      const syncMockMenu = () => {
        const cached = localStorage.getItem(MOCK_MENU_KEY);
        if (cached && active) {
          try {
            const parsed = JSON.parse(cached) as MenuItem[];
            setMenuItems(parsed.filter((item) => item.tenantId === selectedTenantId));
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
      const colRef = collection(db, 'tenants', selectedTenantId, 'menu_items').withConverter(MenuItemConverter);
      const unsubscribe = onSnapshot(colRef, (snap: any) => {
        if (active) {
          setMenuItems(snap.docs.map((d: any) => d.data()));
        }
      }, (err: any) => {
        console.error('KDS menu listener error:', err);
      });

      return () => {
        unsubscribe();
        active = false;
      };
    }
  }, [selectedTenantId, isMockMode]);

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
          const updatedItems = o.items.map((i) => i.id === itemId ? { ...i, status: 'ready' as const } : i);
          const allDone = updatedItems.every((i) => i.status === 'ready' || i.status === 'served');
          return {
            ...o,
            items: updatedItems,
            status: allDone ? ('ready' as const) : o.status
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
          let wasAllDone = false;
          const updated = parsed.map((o: any) => {
            if (o.id === orderId) {
              const updatedItems = (o.items || []).map((i: any) => i.id === itemId ? { ...i, status: 'ready' } : i);
              const allDone = updatedItems.length === 0 || updatedItems.every((i: any) => i.status === 'ready' || i.status === 'served');
              wasAllDone = allDone;
              return {
                ...o,
                items: updatedItems,
                status: allDone ? 'ready' : o.status,
                updatedAt: new Date().toISOString()
              };
            }
            return o;
          });
          localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(updated));
          window.dispatchEvent(new Event('storage'));
          if (wasAllDone) {
            await EventService.logEvent(selectedTenantId, 'order.ready', orderId, profile?.uid || 'kitchen', { trigger: 'item_complete', itemId }, true);
          }
        } catch (e) {}
      }
    } else {
      try {
        const repo = new OrderRepository(db);
        const order = await repo.getById(selectedTenantId, orderId);
        if (order) {
          const updatedItems = order.items.map((i) => i.id === itemId ? { ...i, status: 'ready' as const } : i);
          const allDone = updatedItems.every((i) => i.status === 'ready' || i.status === 'served');
          order.items = updatedItems;
          if (allDone) {
            order.status = 'ready';
          }
          order.updatedAt = new Date();
          await repo.save(selectedTenantId, order);
          if (allDone) {
            await EventService.logEvent(selectedTenantId, 'order.ready', orderId, profile?.uid || 'kitchen', { trigger: 'item_complete', itemId }, false);
          }
        }
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
          const updated = parsed.map((o: any) => {
            if (o.id === orderId) {
              const updatedItems = nextStatus === 'ready'
                ? (o.items || []).map((i: any) => ({ ...i, status: 'ready' }))
                : (nextStatus === 'preparing'
                  ? (o.items || []).map((i: any) => i.status === 'pending' ? { ...i, status: 'preparing' } : i)
                  : o.items);
              return { ...o, status: nextStatus, items: updatedItems, updatedAt: new Date().toISOString() };
            }
            return o;
          });
          localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(updated));
          window.dispatchEvent(new Event('storage'));
          if (nextStatus === 'preparing' || nextStatus === 'ready') {
            await EventService.logEvent(selectedTenantId, `order.${nextStatus}`, orderId, profile?.uid || 'kitchen', { trigger: 'kds_update' }, true);
          }
        } catch (e) {}
      }
    } else {
      try {
        const repo = new OrderRepository(db);
        const order = await repo.getById(selectedTenantId, orderId);
        if (order) {
          order.status = nextStatus;
          if (nextStatus === 'preparing') {
            order.items = order.items.map((i) => i.status === 'pending' ? { ...i, status: 'preparing' as const } : i);
          } else if (nextStatus === 'ready') {
            order.items = order.items.map((i) => i.status === 'pending' || i.status === 'preparing' ? { ...i, status: 'ready' as const } : i);
          }
          order.updatedAt = new Date();
          await repo.save(selectedTenantId, order);
          if (nextStatus === 'preparing' || nextStatus === 'ready') {
            await EventService.logEvent(selectedTenantId, `order.${nextStatus}`, orderId, profile?.uid || 'kitchen', { trigger: 'kds_update' }, false);
          }
        }
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
        const itemDocRef = doc(db, 'tenants', selectedTenantId, 'menu_items', itemId);
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
        const itemDocRef = doc(db, 'tenants', selectedTenantId, 'menu_items', itemId);
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
        const itemDocRef = doc(db, 'tenants', selectedTenantId, 'menu_items', itemId);
        await setDoc(itemDocRef, { isActive: !currentActive }, { merge: true });
      } catch (err: any) {
        console.error('Failed to toggle active status:', err);
      }
    }
  };

  // Active Orders for KDS Grid
  const mapToKdsOrder = (o: Order): KDSOrder => {
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
      return matchesStation;
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
  };

  const allKdsOrders = orders.map(mapToKdsOrder);

  // 1. New Orders: status is 'pending', 'preparing', 'accepted'
  const newKdsOrders = allKdsOrders.filter(
    (o) => o.status === 'pending' || o.status === 'preparing' || o.status === 'accepted'
  );

  // 2. Ready Orders: status is 'ready'
  const readyKdsOrders = allKdsOrders.filter((o) => o.status === 'ready');

  // 3. Served Orders: status is 'served'
  const servedKdsOrders = allKdsOrders.filter((o) => o.status === 'served');

  // 4. Completed Kitchen Orders: status is 'completed' or 'archived'
  const completedKdsOrders = allKdsOrders.filter(
    (o) => o.status === 'completed' || o.status === 'archived'
  );

  const categoriesList = ['All Categories', ...Array.from(new Set(menuItems.map((item) => item.categoryId).filter(Boolean)))];

  const filteredMenuItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.categoryId || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All Categories' || item.categoryId === selectedCategory;
    const matchesStock = selectedStockFilter === 'All Statuses' ||
      (selectedStockFilter === 'In Stock' && item.stockStatus === 'in-stock') ||
      (selectedStockFilter === 'Out of Stock' && item.stockStatus === 'out-of-stock') ||
      (selectedStockFilter === 'Limited' && item.stockStatus === 'limited');
    return matchesSearch && matchesCategory && matchesStock;
  });

  const renderOrderCard = (order: any, column: 'new' | 'ready' | 'served' | 'completed') => {
    const isLate = order.elapsedSeconds > 180;
    return (
      <div
        key={order.id}
        className={`border bg-zinc-900/40 rounded-2xl flex flex-col justify-between overflow-hidden shadow-md transition duration-200 hover:border-zinc-800 ${
          order.priority && column === 'new'
            ? 'border-red-500/30'
            : isLate && column === 'new'
            ? 'border-orange-500/30'
            : column === 'ready'
            ? 'border-emerald-500/25'
            : column === 'served'
            ? 'border-blue-500/25'
            : 'border-zinc-850 opacity-80 hover:opacity-100'
        }`}
      >
        {/* Ticket Header */}
        <div className="p-4 border-b border-zinc-900 bg-zinc-900/30 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
              column === 'new' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
              column === 'ready' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              column === 'served' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
              'bg-zinc-850 text-zinc-300 border-zinc-800'
            }`}>
              {order.tableNumber}
            </span>
            <span className="text-xs font-bold text-white">
              #{order.id.slice(-6).toUpperCase()}
            </span>
          </div>
          {column === 'new' && (
            <div className="flex items-center gap-1 text-[11px]">
              <Clock className={`h-3.5 w-3.5 ${isLate ? 'text-red-500 animate-pulse' : 'text-amber-400'}`} />
              <span className={`font-mono font-bold ${isLate ? 'text-red-500' : 'text-amber-400'}`}>
                {formatTimer(order.elapsedSeconds)}
              </span>
            </div>
          )}
        </div>

        {/* Header Metadata */}
        <div className="px-4 py-2 bg-zinc-950/40 border-b border-zinc-900/60 flex items-center justify-between text-[10px] font-medium text-zinc-500">
          <div>
            <span>Guest:</span> <span className="text-zinc-300 font-semibold ml-1">{order.customerName}</span>
          </div>
          <div>
            <span>Bill:</span> <span className="text-emerald-405 font-bold ml-1">₹{order.grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Items List */}
        <div className="p-4 space-y-3 flex-1">
          {order.items.map((item: any) => {
            const isItemReady = item.status === 'ready' || item.status === 'served';
            return (
              <div key={item.id} className="flex justify-between items-start border-b border-zinc-900/40 pb-3 last:border-b-0 last:pb-0">
                <div className="space-y-1 max-w-[70%]">
                  <p className={`text-xs font-bold leading-snug ${isItemReady ? 'text-zinc-500 line-through font-normal' : 'text-white'}`}>
                    {item.quantity}x {item.name}
                  </p>
                  {item.selectedVariant && (
                    <span className="inline-block text-[9px] font-medium bg-zinc-800/60 text-zinc-400 px-2 py-0.5 rounded-full font-mono">
                      {item.selectedVariant.name}
                    </span>
                  )}
                  {item.notes && (
                    <p className="text-[9px] text-orange-400 bg-orange-950/10 border border-orange-500/10 px-2 py-1 rounded-lg leading-relaxed mt-1">
                      💡 {item.notes}
                    </p>
                  )}
                </div>

                {column === 'new' && (
                  <button
                    onClick={() => handleCompleteItem(order.id, item.id)}
                    disabled={isItemReady}
                    className={`flex items-center gap-1 py-1 px-2 text-[9px] font-bold uppercase rounded-lg border transition cursor-pointer ${
                      isItemReady
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                        : 'bg-zinc-900 border-zinc-800 text-white hover:bg-emerald-500 hover:border-emerald-500 hover:text-white'
                    }`}
                  >
                    <Flame className="h-3 w-3 text-orange-400 animate-pulse" />
                    {isItemReady ? 'READY' : 'DONE'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Bar Footer */}
        <div className="p-3 bg-zinc-950/40 border-t border-zinc-900 flex items-center justify-between gap-2 text-xs">
          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border ${
            order.status === 'pending' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
            order.status === 'preparing' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
            order.status === 'ready' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
            order.status === 'served' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
            'bg-zinc-800 text-zinc-300 border-zinc-700'
          }`}>
            {order.status}
          </span>

          <div className="flex items-center gap-1.5">
            {column === 'new' && order.status === 'pending' && (
              <button
                onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[9px] uppercase px-2.5 py-1.5 rounded-lg shadow-md transition cursor-pointer"
              >
                ACCEPT
              </button>
            )}
            {column === 'new' && order.status === 'preparing' && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleUpdateOrderStatus(order.id, 'pending')}
                  className="p-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white border border-zinc-800 rounded-lg transition cursor-pointer"
                  title="Reset to Pending"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleUpdateOrderStatus(order.id, 'ready')}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-black text-[9px] uppercase px-2.5 py-1.5 rounded-lg shadow-md transition cursor-pointer"
                >
                  READY
                </button>
              </div>
            )}
            {(column === 'ready' || column === 'served') && (
              <button
                onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                className="bg-zinc-800 hover:bg-zinc-750 text-emerald-400 border border-zinc-750 font-black text-[9px] uppercase px-2.5 py-1.5 rounded-lg transition cursor-pointer"
              >
                COMPLETE
              </button>
            )}
            {column === 'completed' && (
              <button
                onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
                className="flex items-center gap-1 text-[9px] font-black uppercase text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                RE-OPEN
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

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
                  {(isMockMode || profile?.role === 'super-admin') && tenantList.length > 0 && (
                    <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-850 px-3.5 py-1.5 rounded-xl">
                      <span className="text-[10px] text-zinc-555 font-bold uppercase tracking-wider">Tenant:</span>
                      <select
                        value={selectedTenantId}
                        onChange={(e) => setSelectedTenantId(e.target.value)}
                        className="bg-transparent text-xs text-white focus:outline-none cursor-pointer font-extrabold"
                      >
                        {tenantList.map((t) => (
                          <option key={t.id} value={t.id} className="bg-zinc-950 text-zinc-300">
                            {t.name} ({t.id.slice(7)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
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
                    <div className="space-y-1">
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
                          : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200'
                      }`}
                    >
                      {station}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3">
                {(isMockMode || profile?.role === 'super-admin') && tenantList.length > 0 && (
                  <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-850 px-3.5 py-1.5 rounded-xl">
                    <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider">Tenant Selector:</span>
                    <select
                      value={selectedTenantId}
                      onChange={(e) => setSelectedTenantId(e.target.value)}
                      className="bg-transparent text-xs text-white focus:outline-none cursor-pointer font-extrabold"
                    >
                      {tenantList.map((t) => (
                        <option key={t.id} value={t.id} className="bg-zinc-950 text-zinc-300">
                          {t.name} ({t.id.slice(7)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  onClick={playBellSound}
                  className="p-2 border border-zinc-850 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-900 transition"
                  title="Test Sound Bell"
                >
                  <Bell className="h-4 w-4" />
                </button>
                <span className="text-xs text-zinc-500 font-medium">
                  Total Active: {newKdsOrders.length + readyKdsOrders.length + servedKdsOrders.length} tickets
                </span>
              </div>
            </div>

            {/* 4-Column Board for KDS */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
              {/* Column 1: New Orders */}
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-red-500/5 border border-red-500/10 p-3 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-red-400 animate-pulse" />
                    <span className="text-xs font-black uppercase text-red-400 tracking-wider">New Orders</span>
                  </div>
                  <span className="text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-0.5 rounded-lg">
                    {newKdsOrders.length}
                  </span>
                </div>
                
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                  {newKdsOrders.map((order) => renderOrderCard(order, 'new'))}
                  {newKdsOrders.length === 0 && (
                    <div className="border border-dashed border-zinc-850 py-10 text-center text-zinc-550 rounded-2xl text-[11px]">
                      No new orders in queue
                    </div>
                  )}
                </div>
              </div>

              {/* Column 2: Ready Orders */}
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">Ready Orders</span>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg">
                    {readyKdsOrders.length}
                  </span>
                </div>

                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                  {readyKdsOrders.map((order) => renderOrderCard(order, 'ready'))}
                  {readyKdsOrders.length === 0 && (
                    <div className="border border-dashed border-zinc-850 py-10 text-center text-zinc-550 rounded-2xl text-[11px]">
                      No ready orders waiting
                    </div>
                  )}
                </div>
              </div>

              {/* Column 3: Served Orders */}
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-blue-500/5 border border-blue-500/10 p-3 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-400" />
                    <span className="text-xs font-black uppercase text-blue-400 tracking-wider">Served Orders</span>
                  </div>
                  <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded-lg">
                    {servedKdsOrders.length}
                  </span>
                </div>

                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                  {servedKdsOrders.map((order) => renderOrderCard(order, 'served'))}
                  {servedKdsOrders.length === 0 && (
                    <div className="border border-dashed border-zinc-850 py-10 text-center text-zinc-550 rounded-2xl text-[11px]">
                      No served orders yet
                    </div>
                  )}
                </div>
              </div>

              {/* Column 4: Completed Kitchen Orders */}
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-zinc-800/10 border border-zinc-850 p-3 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-zinc-400" />
                    <span className="text-xs font-black uppercase text-zinc-450 tracking-wider">Completed Orders</span>
                  </div>
                  <span className="text-[10px] font-bold bg-zinc-850 text-zinc-400 border border-zinc-800 px-2.5 py-0.5 rounded-lg">
                    {completedKdsOrders.length}
                  </span>
                </div>

                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                  {completedKdsOrders.map((order) => renderOrderCard(order, 'completed'))}
                  {completedKdsOrders.length === 0 && (
                    <div className="border border-dashed border-zinc-850 py-10 text-center text-zinc-550 rounded-2xl text-[11px]">
                      No completed orders in history
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
