import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc
} from 'firebase/firestore';
import type { UserProfile, IUserRepository } from '@restaurant-qr/core';

export const UserConverter: any = {
  toFirestore(user: UserProfile): any {
    return {
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      tenantId: user.tenantId || null,
      permissions: user.permissions || [],
      createdAt: user.createdAt
    };
  },
  fromFirestore(snapshot: any, options: any): UserProfile {
    const data = snapshot.data(options);
    return {
      uid: snapshot.id,
      email: data.email,
      displayName: data.displayName,
      role: data.role,
      tenantId: data.tenantId || undefined,
      permissions: data.permissions || [],
      createdAt: data.createdAt.toDate()
    };
  }
};

export class UserRepository implements IUserRepository {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async getById(uid: string): Promise<UserProfile | null> {
    const docRef = doc(this.db, 'users', uid).withConverter(UserConverter);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : null;
  }

  async save(user: UserProfile): Promise<void> {
    const docRef = doc(this.db, 'users', user.uid).withConverter(UserConverter);
    await setDoc(docRef, user);
  }

  async delete(uid: string): Promise<void> {
    const docRef = doc(this.db, 'users', uid);
    await deleteDoc(docRef);
  }
}
