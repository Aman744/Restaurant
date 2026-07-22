import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  getDocs,
  query,
  where
} from 'firebase/firestore';
import type { RoomStay, StayGuest, HousekeepingTask, RoomFeedback } from '@restaurant-qr/core';

export const RoomStayConverter: any = {
  toFirestore(stay: RoomStay): any {
    return {
      roomId: stay.roomId,
      roomNumber: stay.roomNumber,
      roomName: stay.roomName,
      checkInDate: stay.checkInDate,
      checkInTime: stay.checkInTime,
      checkOutDate: stay.checkOutDate || null,
      checkOutTime: stay.checkOutTime || null,
      status: stay.status,
      orderIds: stay.orderIds || [],
      paymentIds: stay.paymentIds || [],
      invoiceId: stay.invoiceId || null,
      timeline: stay.timeline || [],
      createdAt: stay.createdAt || new Date(),
      createdBy: stay.createdBy,
      guestName: stay.guestName || null,
      phone: stay.phone || null,
      email: stay.email || null,
      guestsCount: stay.guestsCount || null,
      purpose: stay.purpose || null,
      notes: stay.notes || null
    };
  },
  fromFirestore(snapshot: any, options: any): RoomStay {
    const data = snapshot.data(options);
    const toDate = (val: any): Date => {
      if (!val) return new Date();
      if (typeof val.toDate === 'function') return val.toDate();
      return new Date(val);
    };
    return {
      id: snapshot.id,
      roomId: data.roomId,
      roomNumber: data.roomNumber,
      roomName: data.roomName,
      checkInDate: data.checkInDate,
      checkInTime: data.checkInTime,
      checkOutDate: data.checkOutDate || undefined,
      checkOutTime: data.checkOutTime || undefined,
      status: data.status,
      orderIds: data.orderIds || [],
      paymentIds: data.paymentIds || [],
      invoiceId: data.invoiceId || undefined,
      timeline: data.timeline || [],
      createdAt: toDate(data.createdAt),
      createdBy: data.createdBy,
      guestName: data.guestName || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
      guestsCount: data.guestsCount || undefined,
      purpose: data.purpose || undefined,
      notes: data.notes || undefined
    };
  }
};

export const StayGuestConverter: any = {
  toFirestore(guest: StayGuest): any {
    return {
      stayId: guest.stayId,
      name: guest.name,
      phone: guest.phone,
      email: guest.email || null,
      role: guest.role,
      status: guest.status,
      joinedAt: guest.joinedAt || new Date(),
      sessionToken: guest.sessionToken
    };
  },
  fromFirestore(snapshot: any, options: any): StayGuest {
    const data = snapshot.data(options);
    const toDate = (val: any): Date => {
      if (!val) return new Date();
      if (typeof val.toDate === 'function') return val.toDate();
      return new Date(val);
    };
    return {
      id: snapshot.id,
      stayId: data.stayId,
      name: data.name,
      phone: data.phone,
      email: data.email || undefined,
      role: data.role,
      status: data.status,
      joinedAt: toDate(data.joinedAt),
      sessionToken: data.sessionToken
    };
  }
};

export const HousekeepingTaskConverter: any = {
  toFirestore(task: HousekeepingTask): any {
    return {
      tenantId: task.tenantId,
      roomId: task.roomId,
      roomNumber: task.roomNumber,
      roomName: task.roomName,
      status: task.status,
      assignedTo: task.assignedTo || null,
      assignedStaffName: task.assignedStaffName || null,
      createdAt: task.createdAt || new Date(),
      completedAt: task.completedAt || null,
      taskType: task.taskType || 'cleaning',
      notes: task.notes || null
    };
  },
  fromFirestore(snapshot: any, options: any): HousekeepingTask {
    const data = snapshot.data(options);
    const toDate = (val: any): Date => {
      if (!val) return new Date();
      if (typeof val.toDate === 'function') return val.toDate();
      return new Date(val);
    };
    return {
      id: snapshot.id,
      tenantId: data.tenantId,
      roomId: data.roomId,
      roomNumber: data.roomNumber,
      roomName: data.roomName,
      status: data.status,
      assignedTo: data.assignedTo || undefined,
      assignedStaffName: data.assignedStaffName || undefined,
      createdAt: toDate(data.createdAt),
      completedAt: data.completedAt ? toDate(data.completedAt) : undefined,
      taskType: data.taskType || 'cleaning',
      notes: data.notes || undefined
    };
  }
};

export const RoomFeedbackConverter: any = {
  toFirestore(feedback: RoomFeedback): any {
    return {
      tenantId: feedback.tenantId,
      stayId: feedback.stayId,
      roomId: feedback.roomId,
      roomNumber: feedback.roomNumber,
      guestName: feedback.guestName,
      ratings: feedback.ratings,
      comment: feedback.comment || null,
      createdAt: feedback.createdAt || new Date()
    };
  },
  fromFirestore(snapshot: any, options: any): RoomFeedback {
    const data = snapshot.data(options);
    const toDate = (val: any): Date => {
      if (!val) return new Date();
      if (typeof val.toDate === 'function') return val.toDate();
      return new Date(val);
    };
    return {
      id: snapshot.id,
      tenantId: data.tenantId,
      stayId: data.stayId,
      roomId: data.roomId,
      roomNumber: data.roomNumber,
      guestName: data.guestName,
      ratings: data.ratings,
      comment: data.comment || undefined,
      createdAt: toDate(data.createdAt)
    };
  }
};

export class RoomStayRepository {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  // Active Stays
  async getStayById(tenantId: string, stayId: string): Promise<RoomStay | null> {
    const docRef = doc(this.db, 'tenants', tenantId, 'active_room_stays', stayId).withConverter(RoomStayStayConverter());
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as RoomStay) : null;
  }

  async saveStay(tenantId: string, stay: RoomStay): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'active_room_stays', stay.id).withConverter(RoomStayStayConverter());
    await setDoc(docRef, stay);
  }

  async deleteStay(tenantId: string, stayId: string): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'active_room_stays', stayId);
    await deleteDoc(docRef);
  }

  // Stay Guests
  async getGuestById(tenantId: string, guestId: string): Promise<StayGuest | null> {
    const docRef = doc(this.db, 'tenants', tenantId, 'stay_guests', guestId).withConverter(StayGuestConverter);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as StayGuest) : null;
  }

  async saveGuest(tenantId: string, guest: StayGuest): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'stay_guests', guest.id).withConverter(StayGuestConverter);
    await setDoc(docRef, guest);
  }

  async listGuestsForStay(tenantId: string, stayId: string): Promise<StayGuest[]> {
    const colRef = collection(this.db, 'tenants', tenantId, 'stay_guests').withConverter(StayGuestConverter);
    const q = query(colRef, where('stayId', '==', stayId));
    const snap = await getDocs(q);
    return snap.docs.map((d: any) => d.data() as StayGuest);
  }

  // Housekeeping Tasks
  async saveHousekeepingTask(tenantId: string, task: HousekeepingTask): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'housekeeping_tasks', task.id).withConverter(HousekeepingTaskConverter);
    await setDoc(docRef, task);
  }

  async listHousekeepingTasks(tenantId: string): Promise<HousekeepingTask[]> {
    const colRef = collection(this.db, 'tenants', tenantId, 'housekeeping_tasks').withConverter(HousekeepingTaskConverter);
    const snap = await getDocs(colRef);
    return snap.docs.map((d: any) => d.data() as HousekeepingTask);
  }

  // Room Feedback
  async saveFeedback(tenantId: string, feedback: RoomFeedback): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'room_feedback', feedback.id).withConverter(RoomFeedbackConverter);
    await setDoc(docRef, feedback);
  }

  // Stay History Archive
  async saveHistory(tenantId: string, staySnapshot: any): Promise<void> {
    const docRef = doc(this.db, 'tenants', tenantId, 'room_history', staySnapshot.id);
    
    const cleanUndefined = (obj: any): any => {
      if (obj === null || obj === undefined) return null;
      if (Array.isArray(obj)) return obj.map(cleanUndefined);
      if (typeof obj === 'object') {
        if (obj instanceof Date) return obj;
        if (typeof obj.toDate === 'function') return obj; // Preserve firestore timestamps
        const clean: any = {};
        for (const key of Object.keys(obj)) {
          const val = obj[key];
          if (val !== undefined) {
            clean[key] = cleanUndefined(val);
          }
        }
        return clean;
      }
      return obj;
    };

    await setDoc(docRef, cleanUndefined(staySnapshot));
  }

  async listHistory(tenantId: string): Promise<any[]> {
    const colRef = collection(this.db, 'tenants', tenantId, 'room_history');
    const snap = await getDocs(colRef);
    return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
  }
}

// Internal compatibility helper
function RoomStayStayConverter(): any {
  return RoomStayConverter;
}
