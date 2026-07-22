import { db } from '../lib/firebase.js';
import { RoomStayRepository, RoomRepository, OrderRepository } from '@restaurant-qr/infra';
import type { RoomStay, StayGuest, HousekeepingTask, RoomFeedback, RoomTimelineEvent, Room } from '@restaurant-qr/core';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const MOCK_STAYS_KEY = 'restaurant_qr_mock_active_room_stays_db';
const MOCK_GUESTS_KEY = 'restaurant_qr_mock_stay_guests_db';
const MOCK_TASKS_KEY = 'restaurant_qr_mock_housekeeping_tasks_db';
const MOCK_FEEDBACK_KEY = 'restaurant_qr_mock_room_feedback_db';
const MOCK_HISTORY_KEY = 'restaurant_qr_mock_room_history_db';
const MOCK_ROOMS_KEY = 'restaurant_qr_mock_rooms_db';

export class GuestService {
  /**
   * Add a timeline event to active stay record
   */
  static async addTimelineEvent(
    tenantId: string,
    stayId: string,
    action: RoomTimelineEvent['action'],
    actor: RoomTimelineEvent['actor'],
    metadata?: any,
    isMockMode?: boolean
  ): Promise<void> {
    const newEvent: RoomTimelineEvent = {
      id: `evt_${generateUUID().replace(/-/g, '').slice(0, 8)}`,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      action,
      actor,
      metadata
    };

    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_STAYS_KEY);
      if (stored) {
        const stays: RoomStay[] = JSON.parse(stored);
        const idx = stays.findIndex((s) => s.id === stayId);
        if (idx !== -1) {
          stays[idx].timeline = [...(stays[idx].timeline || []), newEvent];
          localStorage.setItem(MOCK_STAYS_KEY, JSON.stringify(stays));
          window.dispatchEvent(new Event('storage'));
        }
      }
      return;
    }

    const repo = new RoomStayRepository(db);
    const stay = await repo.getStayById(tenantId, stayId);
    if (stay) {
      stay.timeline = [...(stay.timeline || []), newEvent];
      await repo.saveStay(tenantId, stay);
    }
  }

  /**
   * Primary Guest Check-In
   */
  static async checkInGuest(
    tenantId: string,
    roomId: string,
    data: { name: string; phone: string; email?: string; guestsCount: number; purpose?: string; notes?: string },
    isMockMode: boolean
  ): Promise<{ stay: RoomStay; guest: StayGuest }> {
    const stayId = `STAY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const guestId = `gst_${generateUUID().replace(/-/g, '').slice(0, 10)}`;
    const sessionToken = generateUUID().replace(/-/g, '');

    // Get room details
    let roomNum = '101';
    let roomName = 'Imperial Cabin';
    if (isMockMode) {
      const roomsStored = localStorage.getItem(MOCK_ROOMS_KEY);
      if (roomsStored) {
        const rooms: Room[] = JSON.parse(roomsStored);
        const matched = rooms.find((r) => r.id === roomId);
        if (matched) {
          roomNum = matched.roomNumber;
          roomName = matched.roomName;
        }
      }
    } else {
      const roomRepo = new RoomRepository(db);
      const room = await roomRepo.getById(tenantId, roomId);
      if (room) {
        roomNum = room.roomNumber;
        roomName = room.roomName;
      }
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    const newStay: RoomStay = {
      id: stayId,
      roomId,
      roomNumber: roomNum,
      roomName: roomName,
      checkInDate: dateStr,
      checkInTime: timeStr,
      status: 'checked-in',
      orderIds: [],
      paymentIds: [],
      timeline: [],
      createdAt: now,
      createdBy: 'customer',
      guestName: data.name,
      phone: data.phone,
      email: data.email || null,
      guestsCount: data.guestsCount,
      purpose: data.purpose || null,
      notes: data.notes || null
    };

    const newGuest: StayGuest = {
      id: guestId,
      stayId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      role: 'Primary',
      status: 'Approved',
      joinedAt: now,
      sessionToken
    };

    if (isMockMode) {
      // Save Stay
      const staysStored = localStorage.getItem(MOCK_STAYS_KEY);
      const staysList = staysStored ? JSON.parse(staysStored) : [];
      staysList.push(newStay);
      localStorage.setItem(MOCK_STAYS_KEY, JSON.stringify(staysList));

      // Save Guest
      const guestsStored = localStorage.getItem(MOCK_GUESTS_KEY);
      const guestsList = guestsStored ? JSON.parse(guestsStored) : [];
      guestsList.push(newGuest);
      localStorage.setItem(MOCK_GUESTS_KEY, JSON.stringify(guestsList));

      // Update Room
      const roomsStored = localStorage.getItem(MOCK_ROOMS_KEY);
      const rooms: Room[] = roomsStored ? JSON.parse(roomsStored) : [];
      const idx = rooms.findIndex((r) => r.id === roomId);
      if (idx !== -1) {
        rooms[idx].status = 'checked-in';
        rooms[idx].activeStayId = stayId;
      } else {
        const newRoom: Room = {
          id: roomId,
          tenantId,
          roomNumber: roomId.replace(/^room_|^table_/, '').slice(0, 4).toUpperCase(),
          roomName: `Cabin Room ${roomId.replace(/^room_|^table_/, '').slice(0, 4).toUpperCase()}`,
          capacity: data.guestsCount || 4,
          billingMode: 'FIXED',
          basePrice: 500,
          status: 'checked-in',
          activeStayId: stayId,
          qr: {
            id: `qr_${roomId}`,
            url: `${window.location.origin}/#/customer/room/${tenantId}/${roomId}`,
            version: 1,
            generatedAt: new Date(),
            enabled: true
          },
          features: [],
          createdAt: new Date()
        };
        rooms.push(newRoom);
      }
      localStorage.setItem(MOCK_ROOMS_KEY, JSON.stringify(rooms));
      window.dispatchEvent(new Event('storage'));
    } else {
      const stayRepo = new RoomStayRepository(db);
      await stayRepo.saveStay(tenantId, newStay);
      await stayRepo.saveGuest(tenantId, newGuest);

      const roomRepo = new RoomRepository(db);
      const room = await roomRepo.getById(tenantId, roomId);
      if (room) {
        room.status = 'checked-in';
        room.activeStayId = stayId;
        await roomRepo.save(tenantId, room);
      }
    }

    // Add Timeline event
    await this.addTimelineEvent(tenantId, stayId, 'CHECK_IN', 'customer', { guestName: data.name }, isMockMode);

    return { stay: newStay, guest: newGuest };
  }

  /**
   * Request to Join Stay (Additional Guest)
   */
  static async requestToJoinStay(
    tenantId: string,
    stayId: string,
    data: { name: string; phone: string },
    isMockMode: boolean
  ): Promise<StayGuest> {
    const guestId = `gst_${generateUUID().replace(/-/g, '').slice(0, 10)}`;
    const sessionToken = generateUUID().replace(/-/g, '');

    let autoApprove = false;
    try {
      if (isMockMode) {
        const guestsStored = localStorage.getItem(MOCK_GUESTS_KEY);
        if (guestsStored) {
          const guestsList: StayGuest[] = JSON.parse(guestsStored);
          const primary = guestsList.find((g) => g.stayId === stayId && g.role === 'Primary');
          if (primary && (primary.phone === 'Staff Check-In' || primary.name === 'Primary Guest')) {
            autoApprove = true;
          }
        }
      } else {
        const repo = new RoomStayRepository(db);
        const guestsList = await repo.listGuestsForStay(tenantId, stayId);
        const primary = guestsList.find((g) => g.stayId === stayId && g.role === 'Primary');
        if (primary && (primary.phone === 'Staff Check-In' || primary.name === 'Primary Guest')) {
          autoApprove = true;
        }
      }
    } catch (e) {
      console.warn('Auto approval check skipped:', e);
    }

    const newGuest: StayGuest = {
      id: guestId,
      stayId,
      name: data.name,
      phone: data.phone,
      role: 'Guest',
      status: autoApprove ? 'Approved' : 'Pending',
      joinedAt: new Date(),
      sessionToken
    };

    if (isMockMode) {
      const guestsStored = localStorage.getItem(MOCK_GUESTS_KEY);
      const guestsList = guestsStored ? JSON.parse(guestsStored) : [];
      guestsList.push(newGuest);
      localStorage.setItem(MOCK_GUESTS_KEY, JSON.stringify(guestsList));
      window.dispatchEvent(new Event('storage'));
    } else {
      const repo = new RoomStayRepository(db);
      await repo.saveGuest(tenantId, newGuest);
    }

    // Log timeline event
    await this.addTimelineEvent(tenantId, stayId, 'JOIN_REQUEST', 'customer', { guestName: data.name }, isMockMode);

    return newGuest;
  }

  /**
   * Approve Guest Stay request
   */
  static async approveGuest(tenantId: string, stayId: string, guestId: string, isMockMode: boolean): Promise<void> {
    let guestName = '';
    if (isMockMode) {
      const guestsStored = localStorage.getItem(MOCK_GUESTS_KEY);
      if (guestsStored) {
        const list: StayGuest[] = JSON.parse(guestsStored);
        const idx = list.findIndex((g) => g.id === guestId);
        if (idx !== -1) {
          list[idx].status = 'Approved';
          guestName = list[idx].name;
          localStorage.setItem(MOCK_GUESTS_KEY, JSON.stringify(list));
          window.dispatchEvent(new Event('storage'));
        }
      }
    } else {
      const repo = new RoomStayRepository(db);
      const guest = await repo.getGuestById(tenantId, guestId);
      if (guest) {
        guest.status = 'Approved';
        guestName = guest.name;
        await repo.saveGuest(tenantId, guest);
      }
    }

    await this.addTimelineEvent(tenantId, stayId, 'JOIN_APPROVED', 'staff', { guestName }, isMockMode);
  }

  /**
   * Reject Guest Stay request
   */
  static async rejectGuest(tenantId: string, stayId: string, guestId: string, isMockMode: boolean): Promise<void> {
    let guestName = '';
    if (isMockMode) {
      const guestsStored = localStorage.getItem(MOCK_GUESTS_KEY);
      if (guestsStored) {
        const list: StayGuest[] = JSON.parse(guestsStored);
        const idx = list.findIndex((g) => g.id === guestId);
        if (idx !== -1) {
          list[idx].status = 'Rejected';
          guestName = list[idx].name;
          localStorage.setItem(MOCK_GUESTS_KEY, JSON.stringify(list));
          window.dispatchEvent(new Event('storage'));
        }
      }
    } else {
      const repo = new RoomStayRepository(db);
      const guest = await repo.getGuestById(tenantId, guestId);
      if (guest) {
        guest.status = 'Rejected';
        guestName = guest.name;
        await repo.saveGuest(tenantId, guest);
      }
    }

    await this.addTimelineEvent(tenantId, stayId, 'JOIN_REJECTED', 'staff', { guestName }, isMockMode);
  }

  /**
   * Verify checkout blockers (Pending kitchen orders or unpaid final invoice)
   */
  static async checkCheckoutBlockers(
    tenantId: string,
    roomId: string,
    stayId: string,
    isMockMode: boolean
  ): Promise<{ canCheckout: boolean; reason?: string }> {
    let orders: any[] = [];
    if (isMockMode) {
      const stored = localStorage.getItem('restaurant_qr_mock_orders_db');
      if (stored) {
        const list = JSON.parse(stored);
        orders = list.filter((o: any) => o.tableId === roomId && o.stayId === stayId);
      }
    } else {
      const repo = new OrderRepository(db);
      const list = await repo.listActive(tenantId);
      orders = list.filter((o) => o.tableId === roomId);
    }

    // 1. Check for cooking/pending orders
    const activeOrders = orders.filter((o) => ['pending', 'accepted', 'preparing', 'ready', 'served'].includes(o.status));
    if (activeOrders.length > 0) {
      return {
        canCheckout: false,
        reason: 'There are still active food/service orders currently in preparation or being served. Please wait for completion.'
      };
    }

    // 2. Check for unpaid orders
    const unpaidOrders = orders.filter((o) => o.payment.status !== 'paid');
    if (unpaidOrders.length > 0) {
      return {
        canCheckout: false,
        reason: 'You have outstanding unpaid orders. Please settle all balances before requesting check-out.'
      };
    }

    return { canCheckout: true };
  }

  /**
   * Finalize checkout summary and archive stay snapshot
   */
  static async finalizeCheckout(
    tenantId: string,
    roomId: string,
    stayId: string,
    isMockMode: boolean
  ): Promise<any> {
    let room: Room | null = null;
    let stay: RoomStay | null = null;
    let guests: StayGuest[] = [];
    let orders: any[] = [];

    const now = new Date();
    const checkOutDate = now.toISOString().slice(0, 10);
    const checkOutTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    if (isMockMode) {
      // Rooms load
      const roomsStored = localStorage.getItem(MOCK_ROOMS_KEY);
      if (roomsStored) {
        const roomsList: Room[] = JSON.parse(roomsStored);
        room = roomsList.find((r) => r.id === roomId) || null;
      }
      // Stays load
      const staysStored = localStorage.getItem(MOCK_STAYS_KEY);
      if (staysStored) {
        const staysList: RoomStay[] = JSON.parse(staysStored);
        stay = staysList.find((s) => s.id === stayId) || null;
      }
      // Guests load
      const guestsStored = localStorage.getItem(MOCK_GUESTS_KEY);
      if (guestsStored) {
        const guestsList: StayGuest[] = JSON.parse(guestsStored);
        guests = guestsList.filter((g) => g.stayId === stayId);
      }
      // Orders load
      const ordersStored = localStorage.getItem('restaurant_qr_mock_orders_db');
      if (ordersStored) {
        const list = JSON.parse(ordersStored);
        orders = list.filter((o: any) => o.tableId === roomId);
      }
    } else {
      const roomRepo = new RoomRepository(db);
      room = await roomRepo.getById(tenantId, roomId);

      const stayRepo = new RoomStayRepository(db);
      stay = await stayRepo.getStayById(tenantId, stayId);
      guests = await stayRepo.listGuestsForStay(tenantId, stayId);

      const orderRepo = new OrderRepository(db);
      const list = await orderRepo.listActive(tenantId);
      orders = list.filter((o) => o.tableId === roomId);
    }

    if (!stay || !room) throw new Error('Stay context or room not found');

    // Calculate food revenue totals
    const foodRevenue = orders.reduce((sum, o) => sum + (o.totals.grandTotal || 0), 0);

    // Calculate room stay charges
    let roomRevenue = 0;
    if (room.billingMode === 'FIXED' || room.billingMode === 'PACKAGE') {
      roomRevenue = room.basePrice || 0;
    } else if (room.billingMode === 'HOURLY') {
      const checkInDateTime = new Date(`${stay.checkInDate}T${stay.checkInTime}`);
      const diffMs = now.getTime() - checkInDateTime.getTime();
      const diffHours = Math.ceil(diffMs / (1000 * 60 * 60)) || 1;
      roomRevenue = diffHours * (room.hourlyRate || 0);
    } else if (room.billingMode === 'MINIMUM_SPEND') {
      const minSpend = room.minimumSpend || 0;
      if (foodRevenue < minSpend) {
        roomRevenue = minSpend - foodRevenue;
      }
    }

    const subtotal = roomRevenue + foodRevenue;
    const serviceChargeVal = room.serviceCharge || 0;
    const tax = Math.round(subtotal * 0.18); // 18% standard VAT/GST
    const grandTotal = subtotal + Math.round(subtotal * (serviceChargeVal / 100)) + tax;

    // Create stay snapshot
    const staySnapshot = {
      ...stay,
      checkOutDate,
      checkOutTime,
      status: 'checked-out' as const,
      orderIds: orders.map(o => o.id),
      roomCharges: roomRevenue,
      foodCharges: foodRevenue,
      tax,
      grandTotal,
      paymentStatus: 'Paid' as const,
      guests,
      orders
    };

    // Update databases
    if (isMockMode) {
      // 1. Save History
      const histStored = localStorage.getItem(MOCK_HISTORY_KEY);
      const histList = histStored ? JSON.parse(histStored) : [];
      histList.push(staySnapshot);
      localStorage.setItem(MOCK_HISTORY_KEY, JSON.stringify(histList));

      // 2. Remove Active Stay
      const staysStored = localStorage.getItem(MOCK_STAYS_KEY);
      if (staysStored) {
        const staysList: RoomStay[] = JSON.parse(staysStored);
        const filtered = staysList.filter((s) => s.id !== stayId);
        localStorage.setItem(MOCK_STAYS_KEY, JSON.stringify(filtered));
      }

      // 3. Update Room (Change state to checkout, clear active stay)
      const roomsStored = localStorage.getItem(MOCK_ROOMS_KEY);
      if (roomsStored) {
        const roomsList: Room[] = JSON.parse(roomsStored);
        const idx = roomsList.findIndex((r) => r.id === roomId);
        if (idx !== -1) {
          roomsList[idx].status = 'checkout';
          roomsList[idx].activeStayId = undefined;
          localStorage.setItem(MOCK_ROOMS_KEY, JSON.stringify(roomsList));
        }
      }

      // 4. Create Housekeeping Task
      const task: HousekeepingTask = {
        id: `task_${generateUUID().replace(/-/g, '').slice(0, 8)}`,
        tenantId,
        roomId,
        roomNumber: room.roomNumber,
        roomName: room.roomName,
        status: 'pending',
        createdAt: now
      };
      const tasksStored = localStorage.getItem(MOCK_TASKS_KEY);
      const tasksList = tasksStored ? JSON.parse(tasksStored) : [];
      tasksList.push(task);
      localStorage.setItem(MOCK_TASKS_KEY, JSON.stringify(tasksList));

      window.dispatchEvent(new Event('storage'));
    } else {
      const stayRepo = new RoomStayRepository(db);
      // Archive snapshot
      await stayRepo.saveHistory(tenantId, staySnapshot);
      // Delete active stay
      await stayRepo.deleteStay(tenantId, stayId);

      // Create Housekeeping Task
      const task: HousekeepingTask = {
        id: `task_${generateUUID().replace(/-/g, '').slice(0, 8)}`,
        tenantId,
        roomId,
        roomNumber: room.roomNumber,
        roomName: room.roomName,
        status: 'pending',
        createdAt: now
      };
      await stayRepo.saveHousekeepingTask(tenantId, task);

      // Reset Room (Move to checkout, clear active stay)
      const roomRepo = new RoomRepository(db);
      room.status = 'checkout';
      room.activeStayId = undefined;
      await roomRepo.save(tenantId, room);
    }

    return staySnapshot;
  }

  /**
   * Submit guest rating card feedback
   */
  static async submitFeedback(
    tenantId: string,
    stayId: string,
    roomId: string,
    roomNumber: string,
    guestName: string,
    ratings: { room: number; food: number; service: number },
    comment?: string,
    isMockMode?: boolean
  ): Promise<void> {
    const feedback: RoomFeedback = {
      id: `fb_${generateUUID().replace(/-/g, '').slice(0, 8)}`,
      tenantId,
      stayId,
      roomId,
      roomNumber,
      guestName,
      ratings,
      comment,
      createdAt: new Date()
    };

    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_FEEDBACK_KEY);
      const list = stored ? JSON.parse(stored) : [];
      list.push(feedback);
      localStorage.setItem(MOCK_FEEDBACK_KEY, JSON.stringify(list));
      window.dispatchEvent(new Event('storage'));
      return;
    }

    const repo = new RoomStayRepository(db);
    await repo.saveFeedback(tenantId, feedback);
  }

  /**
   * Submit a custom service or housekeeping task request (e.g. laundry, amenity)
   */
  static async createServiceRequest(
    tenantId: string,
    roomId: string,
    roomNumber: string,
    roomName: string,
    taskType: HousekeepingTask['taskType'],
    notes: string,
    isMockMode?: boolean
  ): Promise<HousekeepingTask> {
    const task: HousekeepingTask = {
      id: `task_${generateUUID().replace(/-/g, '').slice(0, 8)}`,
      tenantId,
      roomId,
      roomNumber,
      roomName,
      status: 'pending',
      taskType,
      notes,
      createdAt: new Date()
    };

    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_TASKS_KEY);
      const list = stored ? JSON.parse(stored) : [];
      list.push(task);
      localStorage.setItem(MOCK_TASKS_KEY, JSON.stringify(list));
      window.dispatchEvent(new Event('storage'));
      return task;
    }

    const repo = new RoomStayRepository(db);
    await repo.saveHousekeepingTask(tenantId, task);
    return task;
  }
}
