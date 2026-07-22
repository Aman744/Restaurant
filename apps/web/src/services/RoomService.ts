import { db } from '../lib/firebase.js';
import { RoomRepository, RoomReservationRepository } from '@restaurant-qr/infra';
import type { Room, RoomReservation } from '@restaurant-qr/core';
import { GuestService } from './GuestService.js';

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

const MOCK_ROOMS_KEY = 'restaurant_qr_mock_rooms_db';
const MOCK_RESERVATIONS_KEY = 'restaurant_qr_mock_reservations_db';

export class RoomService {
  /**
   * Helper to validate state transitions (Finite State Machine)
   */
  private static validateTransition(current: string, next: string): boolean {
    if (next === 'maintenance') return true; // Allowed from any state
    if (current === 'maintenance' && next === 'available') return true;

    switch (current) {
      case 'available':
        return next === 'reserved' || next === 'checked-in';
      case 'reserved':
        return next === 'checked-in' || next === 'available' || next === 'cancelled';
      case 'checked-in':
        return next === 'occupied' || next === 'checkout' || next === 'available';
      case 'occupied':
        return next === 'bill-open' || next === 'checkout';
      case 'bill-open':
        return next === 'checkout';
      case 'checkout':
        return next === 'cleaning' || next === 'available';
      case 'cleaning':
        return next === 'inspection' || next === 'available';
      case 'inspection':
        return next === 'available';
      default:
        return true; // Allow recovery transitions
    }
  }

  /**
   * Provision room with structured QR code object and pricing configurations
   */
  static async createRoom(
    tenantId: string, 
    data: Omit<Room, 'id' | 'tenantId' | 'createdAt' | 'status' | 'qr'>, 
    isMockMode: boolean
  ): Promise<Room> {
    const roomId = `room_${generateUUID().replace(/-/g, '').slice(0, 12)}`;
    const qrId = `qr_${generateUUID().replace(/-/g, '').slice(0, 16)}`;
    const qrUrl = `${window.location.origin}/#/customer/room/${tenantId}/${roomId}`;

    const newRoom: Room = {
      ...data,
      id: roomId,
      tenantId,
      status: 'available',
      qr: {
        id: qrId,
        url: qrUrl,
        version: 1,
        generatedAt: new Date(),
        enabled: true
      },
      createdAt: new Date()
    };

    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_ROOMS_KEY);
      const parsed: Room[] = stored ? JSON.parse(stored) : [];
      parsed.push(newRoom);
      localStorage.setItem(MOCK_ROOMS_KEY, JSON.stringify(parsed));
      return newRoom;
    }

    const repo = new RoomRepository(db);
    await repo.save(tenantId, newRoom);
    return newRoom;
  }

  /**
   * Room state changer using FSM transitions check
   */
  static async updateRoomStatus(
    tenantId: string, 
    roomId: string, 
    nextStatus: Room['status'], 
    isMockMode: boolean
  ): Promise<Room> {
    let room: Room | null = null;
    let repo: RoomRepository | null = null;

    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_ROOMS_KEY);
      if (stored) {
        const parsed: Room[] = JSON.parse(stored);
        const idx = parsed.findIndex((r) => r.id === roomId);
        if (idx !== -1) {
          room = parsed[idx];
          if (!this.validateTransition(room.status, nextStatus)) {
            throw new Error(`Invalid room state transition from ${room.status} to ${nextStatus}`);
          }
          room.status = nextStatus;
          if (nextStatus === 'available') {
            room.activeOrderId = undefined;
            room.activeStayId = undefined;
          }
          parsed[idx] = room;
          localStorage.setItem(MOCK_ROOMS_KEY, JSON.stringify(parsed));
          return room;
        }
      }
      throw new Error('Room not found');
    }

    repo = new RoomRepository(db);
    room = await repo.getById(tenantId, roomId);
    if (!room) throw new Error('Room not found');

    if (!this.validateTransition(room.status, nextStatus)) {
      throw new Error(`Invalid room state transition from ${room.status} to ${nextStatus}`);
    }

    room.status = nextStatus;
    if (nextStatus === 'available') {
      room.activeOrderId = undefined;
      room.activeStayId = undefined;
    }
    await repo.save(tenantId, room);
    return room;
  }

  /**
   * Check in a room from the staff dashboard (creates the active stay document and guest session token)
   */
  static async checkInRoom(
    tenantId: string, 
    roomId: string, 
    isMockMode: boolean,
    guestDetails?: { name: string; phone: string; email?: string; guestsCount?: number; purpose?: string; notes?: string }
  ): Promise<Room> {
    const defaultFields = {
      name: guestDetails?.name || 'Primary Guest',
      phone: guestDetails?.phone || 'Staff Check-In',
      email: guestDetails?.email || '',
      guestsCount: guestDetails?.guestsCount || 2,
      purpose: guestDetails?.purpose || 'Private Dining',
      notes: guestDetails?.notes || 'Session provisioned via staff dashboard check-in.'
    };

    const { stay } = await GuestService.checkInGuest(tenantId, roomId, defaultFields, isMockMode);

    let room: Room | null = null;
    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_ROOMS_KEY);
      if (stored) {
        const parsed: Room[] = JSON.parse(stored);
        const idx = parsed.findIndex((r) => r.id === roomId);
        if (idx !== -1) {
          room = parsed[idx];
          room.status = 'checked-in';
          room.activeStayId = stay.id;
          parsed[idx] = room;
          localStorage.setItem(MOCK_ROOMS_KEY, JSON.stringify(parsed));
          window.dispatchEvent(new Event('storage'));
          return room;
        }
      }
      throw new Error('Room not found');
    }

    const repo = new RoomRepository(db);
    room = await repo.getById(tenantId, roomId);
    if (!room) throw new Error('Room not found');

    room.status = 'checked-in';
    room.activeStayId = stay.id;
    await repo.save(tenantId, room);
    return room;
  }

  /**
   * Reserves a room and publishes reservations ledger details
   */
  static async reserveRoom(
    tenantId: string,
    roomId: string,
    data: Omit<RoomReservation, 'id' | 'tenantId' | 'roomId' | 'reservationNumber' | 'createdAt' | 'status'>,
    isMockMode: boolean
  ): Promise<RoomReservation> {
    const resId = `res_${generateUUID().replace(/-/g, '').slice(0, 12)}`;
    const serial = Math.floor(1000 + Math.random() * 9000);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const resNum = `RES-${dateStr}-${serial}`;

    const newRes: RoomReservation = {
      ...data,
      id: resId,
      reservationNumber: resNum,
      tenantId,
      roomId,
      status: 'reserved',
      createdAt: new Date()
    };

    if (isMockMode) {
      // 1. Save reservation
      const storedRes = localStorage.getItem(MOCK_RESERVATIONS_KEY);
      const parsedRes: RoomReservation[] = storedRes ? JSON.parse(storedRes) : [];
      parsedRes.push(newRes);
      localStorage.setItem(MOCK_RESERVATIONS_KEY, JSON.stringify(parsedRes));

      // 2. Set room state to reserved
      await this.updateRoomStatus(tenantId, roomId, 'reserved', true);
      return newRes;
    }

    const repo = new RoomRepository(db);
    const room = await repo.getById(tenantId, roomId);
    if (!room) throw new Error('Room not found');
    
    if (!this.validateTransition(room.status, 'reserved')) {
      throw new Error(`Invalid room state transition from ${room.status} to reserved`);
    }

    room.status = 'reserved';
    await repo.save(tenantId, room);

    const resRepo = new RoomReservationRepository(db);
    await resRepo.save(tenantId, roomId, newRes);
    return newRes;
  }

  /**
   * Guest Check-In workflow
   */
  static async checkInGuest(
    tenantId: string,
    roomId: string,
    orderId: string,
    isMockMode: boolean
  ): Promise<Room> {
    let room: Room | null = null;
    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_ROOMS_KEY);
      if (stored) {
        const parsed: Room[] = JSON.parse(stored);
        const idx = parsed.findIndex((r) => r.id === roomId);
        if (idx !== -1) {
          room = parsed[idx];
          if (!this.validateTransition(room.status, 'checked-in')) {
            throw new Error(`Invalid transition to checked-in from ${room.status}`);
          }
          room.status = 'checked-in';
          room.activeOrderId = orderId;
          parsed[idx] = room;
          localStorage.setItem(MOCK_ROOMS_KEY, JSON.stringify(parsed));
          return room;
        }
      }
      throw new Error('Room not found');
    }

    const repo = new RoomRepository(db);
    room = await repo.getById(tenantId, roomId);
    if (!room) throw new Error('Room not found');
    
    if (!this.validateTransition(room.status, 'checked-in')) {
      throw new Error(`Invalid transition to checked-in from ${room.status}`);
    }

    room.status = 'checked-in';
    room.activeOrderId = orderId;
    await repo.save(tenantId, room);
    return room;
  }

  /**
   * Guest Check-Out workflow
   */
  static async checkOutGuest(
    tenantId: string,
    roomId: string,
    isMockMode: boolean
  ): Promise<Room> {
    let room: Room | null = null;
    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_ROOMS_KEY);
      if (stored) {
        const parsed: Room[] = JSON.parse(stored);
        room = parsed.find((r) => r.id === roomId) || null;
      }
    } else {
      const repo = new RoomRepository(db);
      room = await repo.getById(tenantId, roomId);
    }

    if (room && room.activeStayId) {
      try {
        await GuestService.finalizeCheckout(tenantId, roomId, room.activeStayId, isMockMode);
      } catch (err) {
        console.error('Failed to finalize stay checkout details:', err);
      }
    }

    return this.updateRoomStatus(tenantId, roomId, 'checkout', isMockMode);
  }

  /**
   * Update room details (Name, category, billing setup, details)
   */
  static async updateRoom(
    tenantId: string,
    roomId: string,
    data: Partial<Omit<Room, 'id' | 'tenantId' | 'createdAt' | 'qr'>>,
    isMockMode: boolean
  ): Promise<Room> {
    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_ROOMS_KEY);
      if (stored) {
        const parsed: Room[] = JSON.parse(stored);
        const idx = parsed.findIndex((r) => r.id === roomId);
        if (idx !== -1) {
          const updatedRoom = { ...parsed[idx], ...data, updatedAt: new Date() };
          parsed[idx] = updatedRoom;
          localStorage.setItem(MOCK_ROOMS_KEY, JSON.stringify(parsed));
          return updatedRoom;
        }
      }
      throw new Error('Room not found');
    }

    const repo = new RoomRepository(db);
    const existing = await repo.getById(tenantId, roomId);
    if (!existing) throw new Error('Room not found');

    const updatedRoom: Room = {
      ...existing,
      ...data,
      updatedAt: new Date()
    };
    await repo.save(tenantId, updatedRoom);
    return updatedRoom;
  }

  /**
   * Delete room
   */
  static async deleteRoom(tenantId: string, roomId: string, isMockMode: boolean): Promise<void> {
    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_ROOMS_KEY);
      if (stored) {
        const parsed: Room[] = JSON.parse(stored);
        const updated = parsed.filter((r) => r.id !== roomId);
        localStorage.setItem(MOCK_ROOMS_KEY, JSON.stringify(updated));
      }
      return;
    }
    const repo = new RoomRepository(db);
    await repo.delete(tenantId, roomId);
  }
}
