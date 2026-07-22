import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { db } from '../../lib/firebase.js';
import { collection, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../features/auth/context/AuthContext.js';
import { MenuItemConverter, OrderRepository, RoomStayRepository } from '@restaurant-qr/infra';
import type { MenuItem, Order, OrderItem, OrderStatus, PaymentStatus, RoomStay, StayGuest } from '@restaurant-qr/core';
import { GuestService } from '../../services/GuestService';
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
  Receipt,
  Star,
  Users,
  CheckCircle2,
  ChevronLeft,
  PhoneCall,
  ConciergeBell,
  BellRing
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

    // 1. Try Hash path parsing: /customer/table/TENANT_ID/TABLE_ID or /customer/room/TENANT_ID/ROOM_ID
    if (!tId || tId === 'tenant_dev_123') {
      const hashMatch = href.match(/\/(?:customer\/table|customer\/room)\/([^\/\?#]+)(?:\/([^\/\?#]+))?/);
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
  const isRoom = window.location.href.includes('/customer/room/') || tableId.startsWith('room_');

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
  
  // Premium Room Stay Management States
  const [activeStay, setActiveStay] = useState<RoomStay | null>(null);
  const [currentGuest, setCurrentGuest] = useState<StayGuest | null>(null);
  const [stayGuests, setStayGuests] = useState<StayGuest[]>([]);
  const [pendingJoinGuests, setPendingJoinGuests] = useState<StayGuest[]>([]);
  
  // Checkout & Feedback
  const [showCheckoutSummary, setShowCheckoutSummary] = useState(false);
  const [checkoutBlockReason, setCheckoutBlockReason] = useState<string | null>(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackRatingRoom, setFeedbackRatingRoom] = useState(5);
  const [feedbackRatingFood, setFeedbackRatingFood] = useState(5);
  const [feedbackRatingService, setFeedbackRatingService] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [checkoutCompletedStay, setCheckoutCompletedStay] = useState<any | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  
  // Room service and amenity state parameters
  const [activeNavTab, setActiveNavTab] = useState<'menu' | 'services'>('menu');
  const [waiterCalled, setWaiterCalled] = useState(false);
  const [selectedServiceGroup, setSelectedServiceGroup] = useState<'amenity' | 'features' | 'laundry' | 'concierge' | 'wellness' | 'convenience'>('amenity');
  const [serviceToiletries, setServiceToiletries] = useState({ towels: false, soap: false, shampoo: false, dentalKit: false });
  const [serviceLaundryType, setServiceLaundryType] = useState('regular-wash');
  const [serviceLaundryNotes, setServiceLaundryNotes] = useState('');
  const [serviceWakeupTime, setServiceWakeupTime] = useState('07:00');
  const [dbRoomServices, setDbRoomServices] = useState<any[]>([]);
  const [selectedServiceOptions, setSelectedServiceOptions] = useState<Record<string, string>>({});
  const [wifiConfig, setWifiConfig] = useState({ ssid: 'Grand_Palace_Premium', pass: 'welcome_to_paradise' });
  // Temp form states
  const [checkInFields, setCheckInFields] = useState({ name: '', phone: '', email: '', guestsCount: 2, purpose: 'Private Dining', notes: '' });
  const [joinFields, setJoinFields] = useState({ name: '', phone: '' });
  const [myPendingGuest, setMyPendingGuest] = useState<StayGuest | null>(null);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [vegOnly, setVegOnly] = useState(false);

  // Post-order tracking states
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);

  const formatTableName = (tId?: string) => {
    if (!tId) return isRoom ? 'Room 1' : 'Table 1';
    if (isRoom) {
      const clean = tId.replace(/^room_/, '').slice(0, 6).toUpperCase();
      return `Room ${clean}`;
    }
    if (/^\d+$/.test(tId)) return `Table ${tId}`;
    const clean = tId.replace(/^table_|^tb_|^tbl_/, '').slice(0, 6).toUpperCase();
    return `Table ${clean}`;
  };

  const [tableName, setTableName] = useState(() => formatTableName(tableId));

  // Premium Stay and Guest validation Realtime loop
  useEffect(() => {
    if (!isRoom || !tableId) return;

    let active = true;

    const syncStay = async () => {
      let currentActiveStayId: string | undefined = undefined;

      if (isMockMode) {
        const roomsStored = localStorage.getItem('restaurant_qr_mock_rooms_db');
        if (roomsStored) {
          const rooms: any[] = JSON.parse(roomsStored);
          const matched = rooms.find((r) => r.id === tableId && r.tenantId === tenantId);
          if (matched) {
            currentActiveStayId = matched.activeStayId;
            setTableStatus(matched.status || 'available');
          }
        }
      } else {
        try {
          const roomSnap = await getDoc(doc(db, 'tenants', tenantId, 'rooms', tableId));
          if (roomSnap.exists()) {
            const data = roomSnap.data();
            currentActiveStayId = data?.activeStayId;
            setTableStatus(data?.status || 'available');
          }
        } catch (e) {}
      }

      if (!active) return;

      if (!currentActiveStayId) {
        setActiveStay(null);
        setCurrentGuest(null);
        setStayGuests([]);
        setPendingJoinGuests([]);
        return;
      }

      let loadedStay: RoomStay | null = null;
      if (isMockMode) {
        const staysStored = localStorage.getItem('restaurant_qr_mock_active_room_stays_db');
        if (staysStored) {
          const list = JSON.parse(staysStored);
          loadedStay = list.find((s: any) => s.id === currentActiveStayId) || null;
        }
      } else {
        const repo = new RoomStayRepository(db);
        loadedStay = await repo.getStayById(tenantId, currentActiveStayId);
      }

      if (!active || !loadedStay) {
        return;
      }
      setActiveStay(loadedStay);

      let loadedGuests: StayGuest[] = [];
      if (isMockMode) {
        const guestsStored = localStorage.getItem('restaurant_qr_mock_stay_guests_db');
        if (guestsStored) {
          const list = JSON.parse(guestsStored);
          loadedGuests = list.filter((g: any) => g.stayId === currentActiveStayId);
        }
      } else {
        const repo = new RoomStayRepository(db);
        loadedGuests = await repo.listGuestsForStay(tenantId, currentActiveStayId);
      }

      if (!active) return;
      setStayGuests(loadedGuests.filter(g => g.status === 'Approved'));
      setPendingJoinGuests(loadedGuests.filter(g => g.status === 'Pending'));

      const mySavedToken = localStorage.getItem(`restaurant_qr_stay_token_${tenantId}_${tableId}`);
      if (mySavedToken) {
        const matchGuest = loadedGuests.find((g) => g.sessionToken === mySavedToken);
        if (matchGuest) {
          setCurrentGuest(matchGuest);
          setCustomerName(matchGuest.name);
          setMyPendingGuest(null);
          return;
        }
      }

      if (myPendingGuest) {
        const matchedPending = loadedGuests.find((g) => g.id === myPendingGuest.id);
        if (matchedPending) {
          if (matchedPending.status === 'Approved') {
            localStorage.setItem(`restaurant_qr_stay_token_${tenantId}_${tableId}`, matchedPending.sessionToken);
            setCurrentGuest(matchedPending);
            setCustomerName(matchedPending.name);
            setMyPendingGuest(null);
            toast.success(`Access Approved! Welcome to ${loadedStay.roomName || tableName}.`);
          } else if (matchedPending.status === 'Rejected') {
            setMyPendingGuest(null);
            toast.error('Your request to join this session was declined.');
          }
        }
      }
    };

    syncStay();
    const interval = setInterval(syncStay, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isRoom, tableId, tenantId, isMockMode, myPendingGuest]);

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

      let foundTable = false;

      if (isRoom) {
        const cachedRooms = localStorage.getItem('restaurant_qr_mock_rooms_db');
        if (cachedRooms) {
          try {
            const roomsList = JSON.parse(cachedRooms);
            const matchRoom = roomsList.find((r: any) => r.id === tableId && r.tenantId === tenantId);
            if (matchRoom && active) {
              setTableName(matchRoom.roomName || matchRoom.roomNumber);
              setTableStatus(matchRoom.status || 'available');
              setTableExists(true);
              foundTable = true;
              let currentOrderId = matchRoom.activeOrderId;
              if (!currentOrderId) {
                const cachedOrders = localStorage.getItem(MOCK_ORDERS_KEY);
                if (cachedOrders) {
                  const ordersList = JSON.parse(cachedOrders);
                  const matchingActiveOrder = ordersList
                    .filter((o: any) => o.tableId === tableId && o.status !== 'completed' && o.status !== 'archived')
                    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                  if (matchingActiveOrder) {
                    currentOrderId = matchingActiveOrder.id;
                    matchRoom.activeOrderId = currentOrderId;
                    matchRoom.status = 'occupied';
                    localStorage.setItem('restaurant_qr_mock_rooms_db', JSON.stringify(roomsList));
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
      } else {
        const cachedTables = localStorage.getItem('restaurant_qr_mock_tables_db');
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
      }
      if (!foundTable && active) {
        if (isMockMode) {
          setTableExists(true);
          foundTable = true;
          if (isRoom) {
            const cachedRooms = localStorage.getItem('restaurant_qr_mock_rooms_db');
            const roomsList = cachedRooms ? JSON.parse(cachedRooms) : [];
            const newRoom = {
              id: tableId,
              tenantId,
              number: tableId.replace(/^room_|^table_/, '').slice(0, 4).toUpperCase(),
              seatingCapacity: 4,
              status: 'available',
              qrToken: `tok_room_${tableId}`,
              createdAt: new Date(),
              roomNumber: tableId.replace(/^room_|^table_/, '').slice(0, 4).toUpperCase(),
              roomName: `Cabin Room ${tableId.replace(/^room_|^table_/, '').slice(0, 4).toUpperCase()}`,
              categoryId: 'default',
              billingMode: 'FIXED',
              basePrice: 500,
              isActive: true
            };
            roomsList.push(newRoom);
            localStorage.setItem('restaurant_qr_mock_rooms_db', JSON.stringify(roomsList));
          } else {
            const cachedTables = localStorage.getItem('restaurant_qr_mock_tables_db');
            const tablesList = cachedTables ? JSON.parse(cachedTables) : [];
            const newTable = {
              id: tableId,
              tenantId,
              number: tableId.replace(/^table_/, '').slice(0, 4).toUpperCase(),
              seatingCapacity: 4,
              status: 'available',
              qrToken: `tok_table_${tableId}`,
              createdAt: new Date()
            };
            tablesList.push(newTable);
            localStorage.setItem('restaurant_qr_mock_tables_db', JSON.stringify(tablesList));
          }
          window.dispatchEvent(new Event('storage'));
        } else {
          setTableExists(false);
        }
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

      const spaceDocRef = isRoom 
        ? doc(db, 'tenants', tenantId, 'rooms', tableId)
        : doc(db, 'tenants', tenantId, 'tables', tableId);

      getDoc(spaceDocRef)
        .then(async (snap: any) => {
          if (active) {
            if (snap.exists()) {
              const tData = snap.data();
              setTableName(isRoom ? (tData.roomName || tData.roomNumber) : (tData.number || 'Table'));
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
                    await setDoc(spaceDocRef, { activeOrderId: currentOrderId, status: 'occupied' }, { merge: true });
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
              // Try to auto-create room/table in Firestore if it doesn't exist to avoid 404 blockages during testing!
              try {
                const newSpaceData = isRoom ? {
                  roomNumber: tableId.replace(/^room_|^table_/, '').slice(0, 4).toUpperCase(),
                  roomName: `Cabin Room ${tableId.replace(/^room_|^table_/, '').slice(0, 4).toUpperCase()}`,
                  capacity: 4,
                  status: 'available',
                  createdAt: new Date(),
                  isActive: true,
                  categoryId: 'default',
                  billingMode: 'FIXED',
                  basePrice: 500,
                  qrToken: `tok_room_${tableId}`
                } : {
                  number: tableId.replace(/^table_/, '').slice(0, 4).toUpperCase(),
                  seatingCapacity: 4,
                  status: 'available',
                  createdAt: new Date(),
                  qrToken: `tok_table_${tableId}`
                };
                await setDoc(spaceDocRef, newSpaceData);
                setTableName(isRoom ? `Cabin Room ${tableId.replace(/^room_|^table_/, '').slice(0, 4).toUpperCase()}` : `Table ${tableId.replace(/^table_/, '').slice(0, 4).toUpperCase()}`);
                setTableStatus('available');
                setTableExists(true);
              } catch (err) {
                console.warn('Failed to auto-create space in Firestore:', err);
                setTableExists(false);
              }
            }
          }
        })
        .catch(async () => {
          // If fetch fails, try one last time to auto-create it (if it was just a missing doc, e.g. permission check fallback)
          try {
            const newSpaceData = isRoom ? {
              roomNumber: tableId.replace(/^room_|^table_/, '').slice(0, 4).toUpperCase(),
              roomName: `Cabin Room ${tableId.replace(/^room_|^table_/, '').slice(0, 4).toUpperCase()}`,
              capacity: 4,
              status: 'available',
              createdAt: new Date(),
              isActive: true,
              categoryId: 'default',
              billingMode: 'FIXED',
              basePrice: 500,
              qrToken: `tok_room_${tableId}`
            } : {
              number: tableId.replace(/^table_/, '').slice(0, 4).toUpperCase(),
              seatingCapacity: 4,
              status: 'available',
              createdAt: new Date(),
              qrToken: `tok_table_${tableId}`
            };
            await setDoc(spaceDocRef, newSpaceData);
            setTableName(isRoom ? `Cabin Room ${tableId.replace(/^room_|^table_/, '').slice(0, 4).toUpperCase()}` : `Table ${tableId.replace(/^table_/, '').slice(0, 4).toUpperCase()}`);
            setTableStatus('available');
            if (active) setTableExists(true);
          } catch (err) {
            if (active) setTableExists(false);
          }
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

  // Load room services from DB dynamically
  useEffect(() => {
    if (!isRoom) return;
    let active = true;

    const fetchRoomServices = async () => {
      try {
        let list: any[] = [];
        if (isMockMode) {
          const stored = localStorage.getItem('restaurant_qr_mock_room_services_db');
          if (stored) {
            list = JSON.parse(stored);
          } else {
            const preseeded = [
              { id: 'srv_clean', name: 'Daily room cleaning', category: 'amenity', description: 'Request standard Room Cleaning & vacuuming.', isActive: true },
              { id: 'srv_turndown', name: 'Evening Turndown service', category: 'amenity', description: 'Request evening turndown service.', isActive: true },
              { id: 'srv_pillow', name: 'Pillow Menu Option', category: 'amenity', description: 'Choose your preferred pillow type for a comfortable sleep.', options: ['Memory Foam', 'Down Feather', 'Orthopedic Support'], isActive: true },
              { id: 'srv_minibar', name: 'Mini-bar replenishment', category: 'amenity', description: 'Request replenishment of standard soft drinks, beer, and snacks in your room.', isActive: true },
              { id: 'srv_laundry', name: 'Express Dry Cleaning', category: 'laundry', description: 'Garments collected, dry-cleaned, and delivered back within 4 hours.', price: 450, isActive: true },
              { id: 'srv_massage', name: 'In-Room Swedish Massage', category: 'wellness', description: 'Professional masseuse session in the comfort of your suite.', price: 1800, isActive: true },
              { id: 'srv_airport', name: 'Airport Transfer Shuttle', category: 'concierge', description: 'Private chauffeur luxury vehicle transport to/from International Airport.', price: 2500, isActive: true }
            ];
            localStorage.setItem('restaurant_qr_mock_room_services_db', JSON.stringify(preseeded));
            list = preseeded;
          }
        } else {
          const { collection, getDocs } = await import('firebase/firestore');
          const colRef = collection(db, 'tenants', tenantId, 'room_services');
          const snap = await getDocs(colRef);
          list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }

        // Load Wi-Fi Config
        let wifi = { ssid: 'Grand_Palace_Premium', pass: 'welcome_to_paradise' };
        if (isMockMode) {
          const storedWifi = localStorage.getItem('restaurant_qr_mock_room_wifi_db');
          if (storedWifi) {
            const parsed = JSON.parse(storedWifi);
            wifi = { ssid: parsed.ssid || 'Grand_Palace_Premium', pass: parsed.pass || 'welcome_to_paradise' };
          }
        } else {
          const { doc: getDocRef, getDoc: fetchDoc } = await import('firebase/firestore');
          const wifiDocRef = getDocRef(db, 'tenants', tenantId, 'room_configs', 'wifi');
          const wifiSnap = await fetchDoc(wifiDocRef);
          if (wifiSnap.exists()) {
            const data = wifiSnap.data();
            wifi = { ssid: data.ssid || 'Grand_Palace_Premium', pass: data.pass || 'welcome_to_paradise' };
          }
        }

        if (active) {
          setDbRoomServices(list.filter((s) => s.isActive));
          setWifiConfig(wifi);
        }
      } catch (err) {
        console.error('Failed to load DB room services:', err);
      }
    };

    fetchRoomServices();
    const interval = setInterval(fetchRoomServices, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [tenantId, isRoom, isMockMode]);

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

  const handleCallWaiter = async () => {
    toast.success(`Waiter service call sent for ${tableName}!`);

    // 1. Create Waiter Alert (for Waiter Dashboard)
    const alertId = `alert_${Date.now()}`;
    const alertData = {
      id: alertId,
      tableNumber: tableName,
      type: 'call_waiter' as const,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'pending' as const,
      stayId: activeStay?.id || null,
      guestName: customerName || null,
      isRoom: isRoom
    };

    if (isMockMode) {
      const cachedAlerts = localStorage.getItem('restaurant_qr_mock_waiter_alerts_db');
      const alerts = cachedAlerts ? JSON.parse(cachedAlerts) : [];
      alerts.push(alertData);
      localStorage.setItem('restaurant_qr_mock_waiter_alerts_db', JSON.stringify(alerts));
      window.dispatchEvent(new Event('storage'));
    } else {
      try {
        await setDoc(doc(db, 'tenants', tenantId, 'waiter_alerts', alertId), alertData);
      } catch (err) {
        console.error('Failed to save waiter alert:', err);
      }
    }

    // 2. Create Housekeeping Task (for Rooms Dashboard)
    if (activeStay) {
      try {
        await GuestService.createServiceRequest(
          tenantId,
          tableId,
          activeStay.roomNumber || formatTableName(tableId),
          activeStay.roomName || tableName,
          'waiter' as any,
          'Call Waiter: Guest requested waiter assistance.',
          isMockMode
        );
      } catch (err) {
        console.error('Failed to create room waiter task:', err);
      }
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

      const cachedAlerts = localStorage.getItem('restaurant_qr_mock_waiter_alerts_db');
      const alerts = cachedAlerts ? JSON.parse(cachedAlerts) : [];
      alerts.push({
        id: `alert_bill_${Date.now()}`,
        tableNumber: tableName,
        type: 'bill_request',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'pending',
        stayId: activeStay?.id || null,
        guestName: customerName || null,
        isRoom: isRoom
      });
      localStorage.setItem('restaurant_qr_mock_waiter_alerts_db', JSON.stringify(alerts));
      window.dispatchEvent(new Event('storage'));
    } else if (placedOrderId) {
      try {
        await setDoc(doc(db, 'tenants', tenantId, 'orders', placedOrderId), { billRequested: true, requestedBillAt: new Date(), updatedAt: new Date() }, { merge: true });
        // Also save alert for Waiter Dashboard
        const alertId = `alert_bill_${Date.now()}`;
        await setDoc(doc(db, 'tenants', tenantId, 'waiter_alerts', alertId), {
          id: alertId,
          tableNumber: tableName,
          type: 'bill_request',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'pending',
          stayId: activeStay?.id || null,
          guestName: customerName || null,
          isRoom: isRoom
        });
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
      stayId: activeStay ? activeStay.id : null,
      serviceLocation: isRoom ? { type: 'room', id: tableId, name: tableName } : { type: 'table', id: tableId, name: tableName },
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

      if (activeStay) {
        await GuestService.addTimelineEvent(tenantId, activeStay.id, 'ORDER_PLACED', 'customer', { orderId, amount: cartTotal }, isMockMode);
      }

      setPlacedOrderId(orderId);
      setCart([]);
      setIsCartOpen(false);
    } catch (err: any) {
      toast.error(`Order placement failed: ${err.message}`);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const renderDynamicServicesForGroup = (cat: 'amenity' | 'laundry' | 'wellness' | 'concierge' | 'convenience') => {
    const list = dbRoomServices.filter((s) => s.category === cat);
    if (list.length === 0) return null;

    return (
      <div className="space-y-4 pt-4 border-t border-zinc-850">
        <div className="text-[11px] font-black uppercase text-zinc-400 tracking-wider">Custom service offerings</div>
        {list.map((service) => {
          if (service.options && service.options.length > 0) {
            const selectedOpt = selectedServiceOptions[service.id] || service.options[0];
            return (
              <div key={service.id} className="p-3.5 bg-zinc-950/40 border border-zinc-850 rounded-2xl space-y-3">
                <div>
                  <div className="text-[10px] font-black uppercase text-zinc-500 tracking-wider flex justify-between">
                    <span>{service.name}</span>
                    {service.price && <span className="text-emerald-400 font-extrabold font-sans">₹{service.price}</span>}
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-normal">{service.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div className="space-y-1.5">
                    <select
                      value={selectedOpt}
                      onChange={(e) => setSelectedServiceOptions(prev => ({ ...prev, [service.id]: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-850 text-white text-xs px-2.5 py-2 rounded-xl focus:outline-none focus:border-emerald-500"
                    >
                      {service.options.map((opt: string) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await GuestService.createServiceRequest(
                          tenantId,
                          tableId,
                          activeStay!.roomNumber,
                          activeStay!.roomName,
                          service.category,
                          `${service.name}: Requested ${selectedOpt}.${service.price ? ` Price: ₹${service.price}` : ''}`,
                          isMockMode
                        );
                        toast.success(`Request submitted: ${selectedOpt}`);
                      } catch (err: any) {
                        toast.error(err.message);
                      }
                    }}
                    className="py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Request
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={service.id} className="p-3.5 bg-zinc-950/40 border border-zinc-850 rounded-2xl space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">{service.name}</div>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-normal">{service.description}</p>
                </div>
                {service.price && (
                  <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                    ₹{service.price}
                  </span>
                )}
              </div>
              <button
                onClick={async () => {
                  try {
                    await GuestService.createServiceRequest(
                      tenantId,
                      tableId,
                      activeStay!.roomNumber,
                      activeStay!.roomName,
                      service.category,
                      `Requested: ${service.name}.${service.price ? ` Price: ₹${service.price}` : ''}`,
                      isMockMode
                    );
                    toast.success(`${service.name} requested successfully!`);
                  } catch (err: any) {
                    toast.error(err.message);
                  }
                }}
                className="w-full py-1.5 bg-zinc-800 border border-zinc-700 hover:bg-zinc-750 text-white text-[10px] font-bold rounded-lg transition cursor-pointer text-center"
              >
                Request {service.name}
              </button>
            </div>
          );
        })}
      </div>
    );
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
          <h3 className="text-base font-extrabold uppercase tracking-wider">
            {isRoom ? 'Room is being sanitized' : 'Table is being sanitized'}
          </h3>
          <p className="text-xs text-zinc-400">
            {isRoom 
              ? 'Our staff is currently sanitizing and prepping this room for your stay. Please give us a few moments!'
              : 'Our staff is currently sanitizing and prepping this table for your dining experience. Please give us a few moments!'}
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

  // Premium Room Stay Management Flow Interceptor
  if (isRoom) {
    if (checkoutCompletedStay) {
      if (showFeedbackForm) {
        return (
          <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md border border-zinc-800 bg-zinc-900/90 p-8 rounded-3xl shadow-2xl space-y-6 text-center animate-in fade-in duration-300">
              <div className="inline-flex p-3 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 mb-2">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-black text-white">Rate Your Experience</h2>
              <p className="text-xs text-zinc-400">Please take a moment to rate your visit. Your feedback helps us improve.</p>

              <div className="space-y-4 text-left pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400">Room Ambiance & Comfort</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} type="button" onClick={() => setFeedbackRatingRoom(star)} className="focus:outline-none">
                        <Star className={`h-6 w-6 ${star <= feedbackRatingRoom ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400">Food Quality & Taste</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} type="button" onClick={() => setFeedbackRatingFood(star)} className="focus:outline-none">
                        <Star className={`h-6 w-6 ${star <= feedbackRatingFood ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400">Service & Housekeeping</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} type="button" onClick={() => setFeedbackRatingService(star)} className="focus:outline-none">
                        <Star className={`h-6 w-6 ${star <= feedbackRatingService ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400">Additional Comments</label>
                  <textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Enter any comments..."
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 focus:outline-none rounded-xl p-3 text-xs text-white h-20 resize-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  await GuestService.submitFeedback(
                    tenantId,
                    checkoutCompletedStay.id,
                    checkoutCompletedStay.roomId,
                    checkoutCompletedStay.roomNumber,
                    checkoutCompletedStay.guests?.[0]?.name || 'Guest',
                    { room: feedbackRatingRoom, food: feedbackRatingFood, service: feedbackRatingService },
                    feedbackComment,
                    isMockMode
                  );
                  setShowFeedbackForm(false);
                  setCheckoutCompletedStay(null);
                  toast.success('Thank you for your feedback!');
                }}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/10 transition"
              >
                Submit Feedback
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm border border-zinc-800 bg-zinc-900/90 p-8 rounded-3xl shadow-2xl text-center space-y-5 animate-in fade-in duration-300">
            <div className="inline-flex p-3 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-black text-white">Check-Out Complete!</h2>
            <p className="text-xs text-zinc-400">Thank you for dining with us. We hope you had a premium experience in Room {checkoutCompletedStay.roomNumber}!</p>
            <button
              type="button"
              onClick={() => {
                setCheckoutCompletedStay(null);
                window.location.reload();
              }}
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-white text-xs font-bold rounded-xl transition"
            >
              Done
            </button>
          </div>
        </div>
      );
    }

    // 2. Check-In Success Welcome Screen
    if (checkInSuccess && activeStay && currentGuest) {
      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm border border-zinc-800 bg-zinc-900/90 p-8 rounded-3xl shadow-2xl text-center space-y-5 animate-in fade-in duration-300">
            <div className="inline-flex p-3 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-black text-white">Check-in Successful!</h2>
            <p className="text-xs text-zinc-400">
              Welcome to Room {activeStay.roomNumber} ({activeStay.roomName}), <strong>{currentGuest.name}</strong>!
              Your digital ordering session has been secured.
            </p>
            <button
              type="button"
              onClick={() => setCheckInSuccess(false)}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition"
            >
              Go to Room Services
            </button>
          </div>
        </div>
      );
    }

    // 2. Check-In Form (Vacant Room)
    const isRoomCheckedIn = tableStatus === 'checked-in' || tableStatus === 'occupied';

    if (isRoomCheckedIn && !activeStay) {
      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm border border-zinc-800 bg-zinc-900/90 p-8 rounded-3xl shadow-2xl text-center space-y-5 animate-in fade-in duration-300">
            <div className="inline-flex p-3 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
              <Utensils className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-black text-white">Room is Checked-in</h2>
            <p className="text-xs text-zinc-400">
              This private room has been checked in by our staff. Click below to view the digital food menu.
            </p>
            <button
              type="button"
              onClick={async () => {
                try {
                  const defaultFields = {
                    name: 'Guest',
                    phone: 'Staff Check-In',
                    email: '',
                    guestsCount: 2,
                    purpose: 'Private Dining',
                    notes: 'Auto initialized session via staff check-in.'
                  };
                  const { stay, guest } = await GuestService.checkInGuest(tenantId, tableId, defaultFields, isMockMode);
                  localStorage.setItem(`restaurant_qr_stay_token_${tenantId}_${tableId}`, guest.sessionToken);
                  setActiveStay(stay);
                  setCurrentGuest(guest);
                  setCustomerName(guest.name);
                } catch (err: any) {
                  toast.error(`Failed to open menu: ${err.message}`);
                }
              }}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition"
            >
              Go to Room Services
            </button>
          </div>
        </div>
      );
    }

    if (!activeStay) {
      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center py-10 px-4">
          <div className="w-full max-w-md mx-auto border border-zinc-850 bg-zinc-900/90 p-6 rounded-3xl shadow-2xl space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Utensils className="h-5 w-5 text-emerald-400" />
                Guest Check-In
              </h2>
              <p className="text-xs text-zinc-400">Please complete the check-in form to unlock menu ordering and room services for {tableName}.</p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!checkInFields.name.trim() || !checkInFields.phone.trim()) {
                  toast.error('Guest Name and Mobile Number are required!');
                  return;
                }
                try {
                  const { stay, guest } = await GuestService.checkInGuest(tenantId, tableId, checkInFields, isMockMode);
                  localStorage.setItem(`restaurant_qr_stay_token_${tenantId}_${tableId}`, guest.sessionToken);
                  setActiveStay(stay);
                  setCurrentGuest(guest);
                  setCustomerName(guest.name);
                  setCheckInSuccess(true);
                  toast.success('Successfully checked in!');
                } catch (err: any) {
                  toast.error(`Check-in failed: ${err.message}`);
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400">Guest Name *</label>
                <input
                  type="text"
                  required
                  value={checkInFields.name}
                  onChange={(e) => setCheckInFields({ ...checkInFields, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 focus:outline-none rounded-xl p-3 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  value={checkInFields.phone}
                  onChange={(e) => setCheckInFields({ ...checkInFields, phone: e.target.value })}
                  placeholder="e.g. +91 9876543210"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 focus:outline-none rounded-xl p-3 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400">Email Address (Optional)</label>
                <input
                  type="email"
                  value={checkInFields.email}
                  onChange={(e) => setCheckInFields({ ...checkInFields, email: e.target.value })}
                  placeholder="e.g. guest@example.com"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 focus:outline-none rounded-xl p-3 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400">Number of Guests *</label>
                  <select
                    value={checkInFields.guestsCount}
                    onChange={(e) => setCheckInFields({ ...checkInFields, guestsCount: Number(e.target.value) })}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 focus:outline-none rounded-xl p-3 text-xs text-white"
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                      <option key={n} value={n}>{n} {n === 1 ? 'Guest' : 'Guests'}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400">Purpose of Visit</label>
                  <select
                    value={checkInFields.purpose}
                    onChange={(e) => setCheckInFields({ ...checkInFields, purpose: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 focus:outline-none rounded-xl p-3 text-xs text-white"
                  >
                    <option value="Private Dining">Private Dining</option>
                    <option value="Business Meeting">Business Meeting</option>
                    <option value="Family Celebration">Family Celebration</option>
                    <option value="Casual Gathering">Casual Gathering</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400">Special Notes / Allergen Warnings</label>
                <textarea
                  value={checkInFields.notes}
                  onChange={(e) => setCheckInFields({ ...checkInFields, notes: e.target.value })}
                  placeholder="e.g. Nut allergies, low spice, soft music requested..."
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 focus:outline-none rounded-xl p-3 text-xs text-white h-16 resize-none"
                />
              </div>

              <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl space-y-1 font-mono text-[9px] text-zinc-400">
                <div>CHECK-IN DATE: {new Date().toISOString().slice(0, 10)}</div>
                <div>CHECK-IN TIME: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                <div>ROOM LOCATION: {tableName}</div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/10 transition"
              >
                Check-in
              </button>
            </form>
          </div>
        </div>
      );
    }

    // 3. Request to Join Stay (Occupied Room, guest session pending/unauthenticated)
    if (!currentGuest) {
      if (myPendingGuest) {
        return (
          <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center p-4">
            <div className="w-full max-w-sm mx-auto border border-zinc-850 bg-zinc-900/90 p-8 rounded-3xl shadow-2xl text-center space-y-5 animate-in fade-in duration-300">
              <div className="inline-flex p-3.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full animate-pulse">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-white">Join Request Sent</h3>
                <p className="text-xs text-zinc-400 mt-1">Waiting for the primary guest to approve your device access...</p>
              </div>
              <div className="p-4 bg-zinc-950 rounded-xl space-y-1 border border-zinc-850 text-left font-mono text-[10px] text-zinc-400">
                <div>GUEST NAME: {myPendingGuest.name}</div>
                <div>PHONE NUMBER: {myPendingGuest.phone}</div>
                <div>STAY ID: {activeStay.id}</div>
              </div>
              <p className="text-[10px] text-zinc-500 italic animate-pulse">Please keep this browser window open. Your screen will unlock automatically.</p>
              <button
                type="button"
                onClick={() => setMyPendingGuest(null)}
                className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-400 text-xs font-bold rounded-xl transition"
              >
                Cancel Join Request
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center p-4">
          <div className="w-full max-w-sm mx-auto border border-zinc-850 bg-zinc-900/90 p-6 rounded-3xl shadow-2xl space-y-6 animate-in fade-in duration-300">
            <div className="text-center space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest bg-zinc-950 border border-zinc-800 text-amber-500 px-3 py-1 rounded-full inline-block">
                Session Active
              </span>
              <h2 className="text-lg font-black text-white">{activeStay.roomName || tableName} is Occupied</h2>
              <p className="text-xs text-zinc-400">This dining room has an active checked-in stay. To view the menu or order from your device, submit a join request below.</p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!joinFields.name.trim() || !joinFields.phone.trim()) {
                  toast.error('Your Name and Phone Number are required!');
                  return;
                }
                try {
                  const pendingGst = await GuestService.requestToJoinStay(tenantId, activeStay!.id, joinFields, isMockMode);
                  if (pendingGst.status === 'Approved') {
                    localStorage.setItem(`restaurant_qr_stay_token_${tenantId}_${tableId}`, pendingGst.sessionToken);
                    setCurrentGuest(pendingGst);
                    setCustomerName(pendingGst.name);
                    toast.success(`Access Approved! Welcome to ${activeStay!.roomName || tableName}.`);
                  } else {
                    setMyPendingGuest(pendingGst);
                    toast.success('Join request sent successfully!');
                  }
                } catch (err: any) {
                  toast.error(`Request failed: ${err.message}`);
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400">Your Full Name *</label>
                <input
                  type="text"
                  required
                  value={joinFields.name}
                  onChange={(e) => setJoinFields({ ...joinFields, name: e.target.value })}
                  placeholder="e.g. Jane Doe"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 focus:outline-none rounded-xl p-3 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400">Your Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={joinFields.phone}
                  onChange={(e) => setJoinFields({ ...joinFields, phone: e.target.value })}
                  placeholder="e.g. +91 9876543210"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 focus:outline-none rounded-xl p-3 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/10 transition"
              >
                Request Access to Join Stay
              </button>
            </form>
          </div>
        </div>
      );
    }

    // 4. Checkout Summary & Billing invoice screen
    if (showCheckoutSummary) {
      let foodTotal = 0;
      if (isMockMode) {
        const stored = localStorage.getItem('restaurant_qr_mock_orders_db');
        if (stored) {
          const list = JSON.parse(stored);
          const roomOrders = list.filter((o: any) => o.tableId === tableId && o.stayId === activeStay.id);
          foodTotal = roomOrders.reduce((sum: number, o: any) => sum + (o.totals.grandTotal || 0), 0);
        }
      }

      let roomRate = 0;
      let durationStr = '1h';
      let roomObj: any = null;
      const roomsStored = localStorage.getItem('restaurant_qr_mock_rooms_db');
      if (roomsStored) {
        const rooms: any[] = JSON.parse(roomsStored);
        roomObj = rooms.find((r: any) => r.id === tableId);
      }
      const checkInDateTime = new Date(`${activeStay.checkInDate}T${activeStay.checkInTime}`);
      const diffMs = Date.now() - checkInDateTime.getTime();
      const diffHours = Math.ceil(diffMs / (1000 * 60 * 60)) || 1;
      const diffMin = Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      durationStr = `${Math.floor(diffMs / (1000 * 60 * 60))}h ${diffMin}m`;

      if (roomObj) {
        if (roomObj.billingMode === 'FIXED' || roomObj.billingMode === 'PACKAGE') {
          roomRate = roomObj.basePrice || 0;
        } else if (roomObj.billingMode === 'HOURLY') {
          roomRate = diffHours * (roomObj.hourlyRate || 0);
        } else if (roomObj.billingMode === 'MINIMUM_SPEND') {
          const minSpend = roomObj.minimumSpend || 0;
          if (foodTotal < minSpend) {
            roomRate = minSpend - foodTotal;
          }
        }
      }

      const subtotalVal = roomRate + foodTotal;
      const serviceChargeVal = roomObj?.serviceCharge || 0;
      const taxVal = Math.round(subtotalVal * 0.18);
      const invoiceGrandTotal = subtotalVal + Math.round(subtotalVal * (serviceChargeVal / 100)) + taxVal;

      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 py-10 px-4">
          <div className="w-full max-w-md mx-auto border border-zinc-850 bg-zinc-900/90 p-6 rounded-3xl shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-4">
              <button
                type="button"
                onClick={() => setShowCheckoutSummary(false)}
                className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h2 className="text-sm font-black text-white">Generate Final Invoice</h2>
              <div className="w-8"></div>
            </div>

            {checkoutBlockReason ? (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl space-y-2 text-center animate-in fade-in duration-300">
                <p className="text-xs font-bold">Checkout Request Blocked</p>
                <p className="text-[10px] text-zinc-300 leading-relaxed">{checkoutBlockReason}</p>
                <button
                  type="button"
                  onClick={() => setShowCheckoutSummary(false)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-[10px] font-black rounded-lg text-white transition mt-1"
                >
                  Return to Menu
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-850 pb-1">Stay Details</div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="text-zinc-400">Primary Guest:</div>
                    <div className="text-white text-right font-sans">{activeStay.guestName || 'Jane'}</div>
                    <div className="text-zinc-400">Duration:</div>
                    <div className="text-white text-right">{durationStr}</div>
                    <div className="text-zinc-400">Check-in:</div>
                    <div className="text-white text-right">{activeStay.checkInDate} {activeStay.checkInTime}</div>
                    <div className="text-zinc-400">Check-out:</div>
                    <div className="text-emerald-400 text-right">{new Date().toISOString().slice(0, 10)} {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-850 pb-1">Guests List ({stayGuests.length})</div>
                  <div className="space-y-1">
                    {stayGuests.map((g) => (
                      <div key={g.id} className="flex justify-between items-center text-xs">
                        <span className="text-zinc-300 font-bold">{g.name} <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-950 text-zinc-500 border border-zinc-850 ml-1">{g.role}</span></span>
                        <span className="text-zinc-500 text-[10px]">{g.phone}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-850 pb-1">Invoice Charges</div>
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Food Orders Total:</span>
                      <span className="text-white">₹{foodTotal}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Room Rental Fee ({roomObj?.billingMode}):</span>
                      <span className="text-white">₹{roomRate}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-500">
                      <span>Service Charge ({serviceChargeVal}%):</span>
                      <span>₹{Math.round(subtotalVal * (serviceChargeVal / 100))}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-500">
                      <span>Taxes & GST (18%):</span>
                      <span>₹{taxVal}</span>
                    </div>
                    <div className="flex justify-between text-sm font-black border-t border-dashed border-zinc-800 pt-2 text-white">
                      <span className="text-emerald-400">Invoice Total:</span>
                      <span className="text-emerald-400">₹{invoiceGrandTotal}</span>
                    </div>
                  </div>
                </div>

                {currentGuest.role !== 'Primary' ? (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-center text-[10px] leading-normal font-semibold">
                    Checkout request and bill settlement is restricted to the Primary Guest only.
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const staySnap = await GuestService.finalizeCheckout(tenantId, tableId, activeStay.id, isMockMode);
                        setCheckoutCompletedStay(staySnap);
                        setShowCheckoutSummary(false);
                        setShowFeedbackForm(true);
                      } catch (err: any) {
                        toast.error(`Checkout failed: ${err.message}`);
                      }
                    }}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/10 transition"
                  >
                    Confirm Payment & Settle Invoice (₹{invoiceGrandTotal})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
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

      {/* Premium Stay Header Control Bar */}
      {isRoom && activeStay && currentGuest && (
        <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in slide-in-from-top duration-300">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              Stay Active
            </span>
            <span className="text-zinc-300 font-bold">
              Guest: {currentGuest.name} ({currentGuest.role})
            </span>
            <span className="text-zinc-500">•</span>
            <span className="text-zinc-400 font-mono text-[10px]">
              Stay ID: {activeStay.id}
            </span>
            <span className="text-zinc-500">•</span>
            <span className="text-zinc-400 flex items-center gap-1 font-bold">
              <Users className="h-3.5 w-3.5 text-zinc-500" />
              {stayGuests.length} Guests Checked-In
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await handleCallWaiter();
                await GuestService.addTimelineEvent(tenantId, activeStay.id, 'ORDER_PLACED', 'customer', { request: 'Call Waiter' }, isMockMode);
              }}
              className="px-3 py-1.5 bg-zinc-850 border border-zinc-850 hover:border-zinc-750 text-zinc-300 rounded-xl font-bold transition text-[10px] cursor-pointer"
            >
              Call Waiter
            </button>
            <button
              onClick={async () => {
                toast.success('Housekeeping / cleaning service requested!');
                await GuestService.addTimelineEvent(tenantId, activeStay.id, 'ORDER_PLACED', 'customer', { request: 'Housekeeping' }, isMockMode);
                try {
                  await GuestService.createServiceRequest(
                    tenantId,
                    tableId,
                    activeStay.roomNumber || formatTableName(tableId),
                    activeStay.roomName || tableName,
                    'cleaning',
                    'Room Cleaning requested by guest.',
                    isMockMode
                  );
                } catch (err) {}
              }}
              className="px-3 py-1.5 bg-zinc-850 border border-zinc-850 hover:border-zinc-750 text-zinc-300 rounded-xl font-bold transition text-[10px] cursor-pointer"
            >
              Request Service
            </button>
            <button
              onClick={async () => {
                const blocker = await GuestService.checkCheckoutBlockers(tenantId, tableId, activeStay.id, isMockMode);
                if (!blocker.canCheckout) {
                  setCheckoutBlockReason(blocker.reason || null);
                } else {
                  setCheckoutBlockReason(null);
                }
                setShowCheckoutSummary(true);
              }}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition text-[10px]"
            >
              Checkout
            </button>
          </div>
        </div>
      )}

      {/* Primary Guest Real-Time Joining Approvals Bar */}
      {isRoom && activeStay && currentGuest?.role === 'Primary' && pendingJoinGuests.length > 0 && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 text-xs flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
            <span className="text-amber-400 font-bold">
              {pendingJoinGuests[0].name} ({pendingJoinGuests[0].phone}) wants to join this stay session.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => GuestService.rejectGuest(tenantId, activeStay.id, pendingJoinGuests[0].id, isMockMode)}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-red-400 rounded-lg font-black text-[10px] transition"
            >
              Reject
            </button>
            <button
              onClick={() => GuestService.approveGuest(tenantId, activeStay.id, pendingJoinGuests[0].id, isMockMode)}
              className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-black text-[10px] transition"
            >
              Approve
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* Navigation Tabs (Menu vs Room Services) */}
        {isRoom && activeStay && (
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setActiveNavTab('menu')}
              className={`py-3.5 px-2 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center ${
                activeNavTab === 'menu'
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/5'
                  : 'bg-zinc-900/50 border-zinc-850 text-zinc-400 hover:text-white hover:border-zinc-850 hover:bg-zinc-900'
              }`}
            >
              <Utensils className="h-4.5 w-4.5" />
              <span className="text-[10px] font-black tracking-wider uppercase">Food Menu</span>
            </button>

            <button
              onClick={() => setActiveNavTab('services')}
              className={`py-3.5 px-2 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center ${
                activeNavTab === 'services'
                  ? 'bg-violet-500/10 border-violet-500 text-violet-400 shadow-lg shadow-violet-500/5'
                  : 'bg-zinc-900/50 border-zinc-850 text-zinc-400 hover:text-white hover:border-zinc-850 hover:bg-zinc-900'
              }`}
            >
              <ConciergeBell className="h-4.5 w-4.5" />
              <span className="text-[10px] font-black tracking-wider uppercase">Room Services</span>
            </button>

            <button
              onClick={async () => {
                setWaiterCalled(true);
                toast.success('Waiter has been called to your room. Please wait!');
                await GuestService.addTimelineEvent(tenantId, activeStay.id, 'ORDER_PLACED', 'customer', { request: 'Call Waiter' }, isMockMode);
                setTimeout(() => setWaiterCalled(false), 30000);
              }}
              className={`py-3.5 px-2 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center ${
                waiterCalled
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400 animate-pulse'
                  : 'bg-zinc-900/50 border-zinc-850 text-zinc-400 hover:text-amber-400 hover:border-amber-500/35 hover:bg-zinc-900'
              }`}
            >
              <BellRing className={`h-4.5 w-4.5 ${waiterCalled ? 'animate-bounce' : ''}`} />
              <span className="text-[10px] font-black tracking-wider uppercase">
                {waiterCalled ? 'Called' : 'Call Waiter'}
              </span>
            </button>
          </div>
        )}
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

        {activeNavTab === 'menu' ? (
          <>
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
          </>
        ) : (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Service Categories Grid */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'amenity', label: '🧴 Amenities', desc: 'Toiletries & Cleaning' },
                { id: 'laundry', label: '👕 Laundry', desc: 'Ironing & Wash' },
                { id: 'features', label: '📶 In-Room', desc: 'Wi-Fi, Pillows & Tech' },
                { id: 'concierge', label: '🚗 Travel', desc: 'Transfers & Taxis' },
                { id: 'wellness', label: '🧘 Wellness', desc: 'Spa, Gym & Pools' },
                { id: 'convenience', label: '☎️ Care', desc: 'Wakeups & Doctors' },
              ].map((grp) => (
                <button
                  key={grp.id}
                  onClick={() => setSelectedServiceGroup(grp.id as any)}
                  className={`p-3 text-left rounded-2xl border transition flex flex-col justify-between h-20 cursor-pointer ${
                    selectedServiceGroup === grp.id
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 shadow-lg'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-850 hover:text-zinc-200'
                  }`}
                >
                  <span className="text-xs font-bold">{grp.label}</span>
                  <span className="text-[9px] text-zinc-500 leading-tight block mt-1">{grp.desc}</span>
                </button>
              ))}
            </div>

            {/* Active Service Group Control Panel */}
            <div className="border border-zinc-800 bg-zinc-900/60 p-5 rounded-3xl space-y-4">
              {/* Amenities View */}
              {selectedServiceGroup === 'amenity' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Daily Servicing & replenishment</h3>
                    <p className="text-[10px] text-zinc-500">Select standard private housekeeping items to replenish, or schedule a cabin service.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {[
                      { key: 'towels', label: 'Replenish Fresh Towels' },
                      { key: 'soap', label: ' replenishing Soaps' },
                      { key: 'shampoo', label: ' replenishing Shampoo' },
                      { key: 'dentalKit', label: 'Replenish Dental Kit' }
                    ].map((t) => (
                      <label key={t.key} className="flex items-center gap-2 p-3 bg-zinc-950/40 border border-zinc-850 hover:border-zinc-750 rounded-xl cursor-pointer transition">
                        <input
                          type="checkbox"
                          checked={(serviceToiletries as any)[t.key]}
                          onChange={(e) => setServiceToiletries({ ...serviceToiletries, [t.key]: e.target.checked })}
                          className="h-4 w-4 rounded border-zinc-800 text-emerald-500 focus:ring-emerald-500/20 bg-zinc-950"
                        />
                        <span className="text-xs text-zinc-300 font-semibold">{t.label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-zinc-850">
                    <button
                      onClick={async () => {
                        const items = Object.entries(serviceToiletries)
                          .filter(([_, val]) => val)
                          .map(([key]) => key.toUpperCase())
                          .join(', ');
                        if (!items) {
                          toast.error('Please select at least one amenity item to replenish!');
                          return;
                        }
                        try {
                          await GuestService.createServiceRequest(
                            tenantId,
                            tableId,
                            activeStay!.roomNumber,
                            activeStay!.roomName,
                            'amenity',
                            `Replenish Toiletries: [${items}]`,
                            isMockMode
                          );
                          toast.success('Toiletries replenishment request submitted!');
                          setServiceToiletries({ towels: false, soap: false, shampoo: false, dentalKit: false });
                        } catch (err: any) {
                          toast.error(err.message);
                        }
                      }}
                      className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Request Replenishment
                    </button>
                  </div>

                  {dbRoomServices.filter(s => s.category === 'amenity').map(service => {
                    if (service.options && service.options.length > 0) {
                      const selectedOpt = selectedServiceOptions[service.id] || service.options[0];
                      return (
                        <div key={service.id} className="p-3.5 bg-zinc-950/40 border border-zinc-850 rounded-2xl space-y-3 pt-3 border-t border-zinc-850">
                          <div>
                            <div className="text-[10px] font-black uppercase text-zinc-500 tracking-wider flex justify-between">
                              <span>{service.name}</span>
                              {service.price && <span className="text-emerald-400 font-extrabold font-sans">₹{service.price}</span>}
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-1 leading-normal">{service.description}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3 items-end">
                            <div className="space-y-1.5">
                              <select
                                value={selectedOpt}
                                onChange={(e) => setSelectedServiceOptions(prev => ({ ...prev, [service.id]: e.target.value }))}
                                className="w-full bg-zinc-950 border border-zinc-850 text-white text-xs px-2.5 py-2 rounded-xl focus:outline-none focus:border-emerald-500"
                              >
                                {service.options.map((opt: string) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  await GuestService.createServiceRequest(
                                    tenantId,
                                    tableId,
                                    activeStay!.roomNumber,
                                    activeStay!.roomName,
                                    'amenity',
                                    `${service.name}: Requested ${selectedOpt}.${service.price ? ` Price: ₹${service.price}` : ''}`,
                                    isMockMode
                                  );
                                  toast.success(`Request submitted: ${selectedOpt}`);
                                } catch (err: any) {
                                  toast.error(err.message);
                                }
                              }}
                              className="py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                            >
                              Request
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={service.id} className="p-3.5 bg-zinc-950/40 border border-zinc-850 rounded-2xl space-y-2 pt-3 border-t border-zinc-850">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">{service.name}</div>
                            <p className="text-[10px] text-zinc-400 mt-1 leading-normal">{service.description}</p>
                          </div>
                          {service.price && (
                            <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                              ₹{service.price}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await GuestService.createServiceRequest(
                                tenantId,
                                tableId,
                                activeStay!.roomNumber,
                                activeStay!.roomName,
                                'amenity',
                                `Requested: ${service.name}.${service.price ? ` Price: ₹${service.price}` : ''}`,
                                isMockMode
                              );
                              toast.success(`${service.name} requested successfully!`);
                            } catch (err: any) {
                              toast.error(err.message);
                            }
                          }}
                          className="w-full py-1.5 bg-zinc-800 border border-zinc-700 hover:bg-zinc-750 text-white text-[10px] font-bold rounded-lg transition cursor-pointer text-center"
                        >
                          Request {service.name}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Laundry View */}
              {selectedServiceGroup === 'laundry' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Laundry & Dry-Cleaning Services</h3>
                    <p className="text-[10px] text-zinc-500">Pick laundry action details and list garment items for quick front-desk pick-up.</p>
                  </div>

                  <div className="flex gap-2.5 pt-1">
                    {[
                      { id: 'regular-wash', label: 'Wash & Fold' },
                      { id: 'dry-cleaning', label: 'Dry Cleaning' },
                      { id: 'shoe-shining', label: 'Shoe Shining' }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setServiceLaundryType(opt.id)}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl border transition ${
                          serviceLaundryType === opt.id
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                            : 'bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400">Garment list details *</label>
                    <textarea
                      value={serviceLaundryNotes}
                      onChange={(e) => setServiceLaundryNotes(e.target.value)}
                      placeholder="e.g. 2 formal trousers, 3 cotton shirts (White, Blue)"
                      className="w-full bg-zinc-950 border border-zinc-850 rounded-xl p-3 text-xs focus:outline-none focus:border-emerald-500 text-white min-h-[70px] placeholder-zinc-600 resize-none"
                    />
                  </div>

                  <button
                    onClick={async () => {
                      if (!serviceLaundryNotes.trim()) {
                        toast.error('Please specify laundry items details in the textarea!');
                        return;
                      }
                      try {
                        const labelMap: any = { 'regular-wash': 'Wash & Fold', 'dry-cleaning': 'Dry Cleaning', 'shoe-shining': 'Shoe Shining' };
                        await GuestService.createServiceRequest(
                          tenantId,
                          tableId,
                          activeStay!.roomNumber,
                          activeStay!.roomName,
                          'laundry',
                          `Laundry Pickup: ${labelMap[serviceLaundryType]} - [${serviceLaundryNotes}]`,
                          isMockMode
                        );
                        toast.success('Laundry pickup service requested successfully!');
                        setServiceLaundryNotes('');
                      } catch (err: any) {
                        toast.error(err.message);
                      }
                    }}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Request Laundry Pickup
                  </button>
                  {renderDynamicServicesForGroup('laundry')}
                </div>
              )}

              {/* In-Room Features View */}
              {selectedServiceGroup === 'features' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Smart Cabin Technology</h3>
                    <p className="text-[10px] text-zinc-500">Access private Wi-Fi details and smart room credentials.</p>
                  </div>

                  {/* WiFi credentials */}
                  <div className="p-3.5 bg-zinc-950 border border-zinc-850 rounded-2xl flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Wi-Fi Connection Active</div>
                      <div className="text-xs text-white font-bold font-mono">SSID: {wifiConfig.ssid}</div>
                      <div className="text-[10px] text-zinc-400 font-mono">PASS: {wifiConfig.pass}</div>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(wifiConfig.pass);
                        toast.success('Wi-Fi Password copied to clipboard!');
                      }}
                      className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 hover:bg-zinc-750 text-[10px] font-bold text-white rounded-lg transition"
                    >
                      Copy Pass
                    </button>
                  </div>
                </div>
              )}

              {/* Concierge View */}
              {selectedServiceGroup === 'concierge' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Concierge Services & Transfers</h3>
                    <p className="text-[10px] text-zinc-500">Arrange taxi transfers, limousine shuttles, restaurant reservations or tour bookings.</p>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1 col-span-3 sm:col-span-1">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase">Pickup Transportation</label>
                        <select
                          id="trans_type"
                          className="w-full bg-zinc-950 border border-zinc-850 text-white text-xs p-2 rounded-xl focus:outline-none focus:border-emerald-500"
                        >
                          <option value="Airport Shuttle">Airport Shuttle</option>
                          <option value="Limousine Transfer">Limousine Transfer</option>
                          <option value="Taxi Arrangement">Standard Taxi</option>
                        </select>
                      </div>
                      <div className="space-y-1 col-span-3 sm:col-span-1">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase">Date</label>
                        <input
                          type="date"
                          id="trans_date"
                          defaultValue={new Date().toISOString().slice(0, 10)}
                          className="w-full bg-zinc-950 border border-zinc-850 text-white text-xs p-2 rounded-xl focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="space-y-1 col-span-3 sm:col-span-1">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase">Target Time</label>
                        <input
                          type="time"
                          id="trans_time"
                          defaultValue="12:00"
                          className="w-full bg-zinc-950 border border-zinc-850 text-white text-xs p-2 rounded-xl focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        const typeEl = document.getElementById('trans_type') as HTMLSelectElement;
                        const dateEl = document.getElementById('trans_date') as HTMLInputElement;
                        const timeEl = document.getElementById('trans_time') as HTMLInputElement;
                        try {
                          await GuestService.createServiceRequest(
                            tenantId,
                            tableId,
                            activeStay!.roomNumber,
                            activeStay!.roomName,
                            'concierge',
                            `Transportation: Booked ${typeEl?.value || 'Taxi'} on ${dateEl?.value || new Date().toISOString().slice(0, 10)} at ${timeEl?.value || '12:00'}.`,
                            isMockMode
                          );
                          toast.success('Transportation reservation request submitted!');
                        } catch (err: any) {
                          toast.error(err.message);
                        }
                      }}
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Book Transportation Transfer
                    </button>
                  </div>

                  <div className="pt-2 border-t border-zinc-850 space-y-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400">Concierge Reservations / Guide Bookings</label>
                      <textarea
                        id="concierge_notes"
                        placeholder="Request guidance, tickets, or premium dinner bookings..."
                        className="w-full bg-zinc-950 border border-zinc-850 rounded-xl p-3 text-xs focus:outline-none focus:border-emerald-500 text-white min-h-[60px] placeholder-zinc-600 resize-none"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        const notesEl = document.getElementById('concierge_notes') as HTMLTextAreaElement;
                        if (!notesEl?.value.trim()) {
                          toast.error('Please input details for the concierge request!');
                          return;
                        }
                        try {
                          await GuestService.createServiceRequest(
                            tenantId,
                            tableId,
                            activeStay!.roomNumber,
                            activeStay!.roomName,
                            'concierge',
                            `Concierge: ${notesEl.value}`,
                            isMockMode
                          );
                          toast.success('Concierge request submitted!');
                          notesEl.value = '';
                        } catch (err: any) {
                          toast.error(err.message);
                        }
                      }}
                      className="w-full py-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-750 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Submit Concierge Request
                    </button>
                  </div>
                  {renderDynamicServicesForGroup('concierge')}
                </div>
              )}

              {/* Wellness View */}
              {selectedServiceGroup === 'wellness' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Wellness, Fitness & Spas</h3>
                    <p className="text-[10px] text-zinc-500">Book yoga slots, spas saunas jacuzzis, or private outdoor swimming pool equipment rentals.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-2xl space-y-2">
                      <span className="text-[9px] font-black uppercase text-zinc-500 block">Spa Treatment (Saunas & Massage)</span>
                      <select
                        id="spa_type"
                        className="w-full bg-zinc-900 border border-zinc-800 text-white text-[11px] p-2 rounded-xl focus:outline-none focus:border-emerald-500"
                      >
                        <option value="Deep Tissue Massage">Deep Tissue (60m)</option>
                        <option value="Swedish Therapy">Swedish Therapy (60m)</option>
                        <option value="Sauna Jacuzzi Slot">Sauna & Jacuzzi (90m)</option>
                      </select>
                      <button
                        onClick={async () => {
                          const spaEl = document.getElementById('spa_type') as HTMLSelectElement;
                          try {
                            await GuestService.createServiceRequest(
                              tenantId,
                              tableId,
                              activeStay!.roomNumber,
                              activeStay!.roomName,
                              'wellness',
                              `Wellness: Booked Spa Treatment - [${spaEl?.value || 'Massage'}].`,
                              isMockMode
                            );
                            toast.success('Spa appointment slot requested!');
                          } catch (err: any) {
                            toast.error(err.message);
                          }
                        }}
                        className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded-xl transition cursor-pointer"
                      >
                        Book Spa Appointment
                      </button>
                    </div>

                    <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-2xl space-y-2 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-black uppercase text-zinc-500 block">Gym & Yoga Registration</span>
                        <select
                          id="yoga_time"
                          className="w-full mt-2 bg-zinc-900 border border-zinc-800 text-white text-[11px] p-2 rounded-xl focus:outline-none"
                        >
                          <option value="Morning Session (07:00)">Morning Yoga (07:00)</option>
                          <option value="Evening Session (17:30)">Evening Cardio (17:30)</option>
                        </select>
                      </div>
                      <button
                        onClick={async () => {
                          const timeEl = document.getElementById('yoga_time') as HTMLSelectElement;
                          try {
                            await GuestService.createServiceRequest(
                              tenantId,
                              tableId,
                              activeStay!.roomNumber,
                              activeStay!.roomName,
                              'wellness',
                              `Wellness: Registered for Fitness class - [${timeEl?.value || 'Session'}].`,
                              isMockMode
                            );
                            toast.success('Fitness class registration complete!');
                          } catch (err: any) {
                            toast.error(err.message);
                          }
                        }}
                        className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-white text-[10px] font-bold rounded-xl transition cursor-pointer"
                      >
                        Book Class
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 bg-zinc-950/40 border border-zinc-850 rounded-2xl flex items-center justify-between text-xs">
                    <div>
                      <div className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Pool & Outdoors Access</div>
                      <div className="text-zinc-300 font-semibold mt-1">Indoor pools & Private beach keys</div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await GuestService.createServiceRequest(
                            tenantId,
                            tableId,
                            activeStay!.roomNumber,
                            activeStay!.roomName,
                            'wellness',
                            'Request pool/beach sports equipment rental (goggles, towels, rackets).',
                            isMockMode
                          );
                          toast.success('Outdoor sports equipment rental request registered!');
                        } catch (err: any) {
                          toast.error(err.message);
                        }
                      }}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-white text-[10px] font-bold rounded-xl border border-zinc-700 transition cursor-pointer"
                    >
                      Rent Gear
                    </button>
                  </div>
                  {renderDynamicServicesForGroup('wellness')}
                </div>
              )}

              {/* Convenience View */}
              {selectedServiceGroup === 'convenience' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Additional Conveniences & wake-up Calls</h3>
                    <p className="text-[10px] text-zinc-500">Configure personal alarms, babysitting services, or request doctor-on-call responses.</p>
                  </div>

                  {/* Wakeup call */}
                  <div className="grid grid-cols-3 gap-3 items-end p-3.5 bg-zinc-950 border border-zinc-850 rounded-2xl">
                    <div className="col-span-2 space-y-1">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase block">Wake-up Call Alarm</label>
                      <input
                        type="time"
                        value={serviceWakeupTime}
                        onChange={(e) => setServiceWakeupTime(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-white text-xs p-2 rounded-xl focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await GuestService.createServiceRequest(
                            tenantId,
                            tableId,
                            activeStay!.roomNumber,
                            activeStay!.roomName,
                            'convenience',
                            `Convenience: Wake-up Call configured for ${serviceWakeupTime}.`,
                            isMockMode
                          );
                          toast.success(`Wake-up call scheduled at ${serviceWakeupTime}!`);
                        } catch (err: any) {
                          toast.error(err.message);
                        }
                      }}
                      className="py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition cursor-pointer text-center"
                    >
                      Schedule
                    </button>
                  </div>

                  {/* Emergency and Babysitter buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={async () => {
                        try {
                          await GuestService.createServiceRequest(
                            tenantId,
                            tableId,
                            activeStay!.roomNumber,
                            activeStay!.roomName,
                            'convenience',
                            'URGENT: Doctor-on-call response requested immediately.',
                            isMockMode
                          );
                          toast.success('Urgent Doctor-on-Call request submitted. Staff will contact you immediately!');
                        } catch (err: any) {
                          toast.error(err.message);
                        }
                      }}
                      className="py-3 bg-red-500 hover:bg-red-650 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-red-500/10"
                    >
                      <PhoneCall className="h-4 w-4 animate-bounce" /> Doctor-on-Call
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await GuestService.createServiceRequest(
                            tenantId,
                            tableId,
                            activeStay!.roomNumber,
                            activeStay!.roomName,
                            'convenience',
                            'Request personal babysitting / child-care services.',
                            isMockMode
                          );
                          toast.success('Babysitting request registered! Staff will coordinate details.');
                        } catch (err: any) {
                          toast.error(err.message);
                        }
                      }}
                      className="py-3 bg-zinc-950 border border-zinc-800 hover:border-zinc-750 text-zinc-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Users className="h-4 w-4" /> Babysitting Call
                    </button>
                  </div>
                  {renderDynamicServicesForGroup('convenience')}
                </div>
              )}
            </div>
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
