import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc,
  collection,
  onSnapshot
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
    return snap.exists() ? (snap.data() as UserProfile) : null;
  }

  async save(user: UserProfile): Promise<void> {
    const docRef = doc(this.db, 'users', user.uid).withConverter(UserConverter);
    await setDoc(docRef, user);
  }

  async delete(uid: string): Promise<void> {
    const docRef = doc(this.db, 'users', uid);
    await deleteDoc(docRef);
  }

  subscribeTenantUsers(tenantId: string, callback: (users: UserProfile[]) => void): () => void {
    const colRef = collection(this.db, 'tenants', tenantId, 'users').withConverter(UserConverter);
    return onSnapshot(colRef, (snap: any) => {
      callback(snap.docs.map((doc: any) => doc.data() as UserProfile));
    }, (err: any) => {
      console.warn("Firestore tenant users subscription permission error:", err);
      callback([]);
    });
  }
}
