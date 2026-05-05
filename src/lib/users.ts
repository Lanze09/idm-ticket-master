import { db } from './db';
import type { User } from './types';

export function listAdmins(): User[] {
  return db()
    .prepare("SELECT id, email, name, role FROM users WHERE role = 'admin' ORDER BY name")
    .all() as User[];
}

export function getUserById(id: number): User | null {
  return (db()
    .prepare('SELECT id, email, name, role FROM users WHERE id = ?')
    .get(id) as User | undefined) ?? null;
}
