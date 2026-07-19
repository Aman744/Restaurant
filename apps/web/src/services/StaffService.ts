import { db } from '../lib/firebase.js';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { UserConverter } from '@restaurant-qr/infra';
import type { UserProfile, UserRole } from '@restaurant-qr/core';

const MOCK_STAFF_KEY = 'restaurant_qr_mock_staff_db';

export class StaffService {
  /**
   * Creates or provisions a staff profile without storing plain passwords in Firestore
   */
  static async createStaffMember(
    tenantId: string,
    displayName: string,
    email: string,
    role: UserRole,
    isMockMode: boolean
  ): Promise<UserProfile> {
    const uid = `staff_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    const profile: UserProfile = {
      uid,
      email: email.toLowerCase(),
      displayName,
      role,
      tenantId,
      permissions: getPermissionsForRole(role),
      createdAt: new Date()
    };

    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_STAFF_KEY);
      const parsed: UserProfile[] = stored ? JSON.parse(stored) : [];
      parsed.push(profile);
      localStorage.setItem(MOCK_STAFF_KEY, JSON.stringify(parsed));
      return profile;
    }

    // Write profile document to global users collection
    const userDocRef = doc(db, 'users', uid).withConverter(UserConverter);
    await setDoc(userDocRef, profile);

    // Also index under tenant's staff subcollection
    const tenantStaffRef = doc(db, 'tenants', tenantId, 'staff', uid).withConverter(UserConverter);
    await setDoc(tenantStaffRef, profile);

    return profile;
  }

  /**
   * Deletes a staff member
   */
  static async deleteStaffMember(tenantId: string, uid: string, isMockMode: boolean): Promise<void> {
    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_STAFF_KEY);
      if (stored) {
        const parsed: UserProfile[] = JSON.parse(stored);
        const updated = parsed.filter((s) => s.uid !== uid);
        localStorage.setItem(MOCK_STAFF_KEY, JSON.stringify(updated));
      }
      return;
    }

    await deleteDoc(doc(db, 'users', uid));
    await deleteDoc(doc(db, 'tenants', tenantId, 'staff', uid));
  }
}

function getPermissionsForRole(role: UserRole): string[] {
  switch (role) {
    case 'manager':
      return ['staff', 'orders', 'reports', 'kitchen', 'tables'];
    case 'kitchen-staff':
      return ['kds', 'order_status'];
    case 'waiter':
      return ['tables', 'requests', 'serve'];
    case 'cashier':
      return ['billing', 'payments', 'refunds', 'receipts'];
    default:
      return ['dashboard'];
  }
}
