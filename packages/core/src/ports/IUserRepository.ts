import type { UserProfile } from '../domain/types.js';

export interface IUserRepository {
  getById(uid: string): Promise<UserProfile | null>;
  save(user: UserProfile): Promise<void>;
  delete(uid: string): Promise<void>;
}
