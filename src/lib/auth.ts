import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { db } from './db';
import type { Project, Role, SessionPayload, UserWithProjects } from './types';

const COOKIE_NAME = 'idm_session';
const COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error('AUTH_SECRET is missing or too short. Set it in .env.local');
  }
  return new TextEncoder().encode(s);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  cookies().delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function requireSession(): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) throw new Error('UNAUTHORIZED');
  return s;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const s = await requireSession();
  if (s.role !== 'admin') throw new Error('FORBIDDEN');
  return s;
}

export function authenticate(email: string, password: string): SessionPayload | null {
  const conn = db();
  const row = conn
    .prepare('SELECT id, email, name, role, password_hash FROM users WHERE email = ? COLLATE NOCASE')
    .get(email) as { id: number; email: string; name: string; role: Role; password_hash: string } | undefined;
  if (!row) return null;

  const ok = bcrypt.compareSync(password, row.password_hash);
  if (!ok) return null;

  return { userId: row.id, email: row.email, name: row.name, role: row.role };
}

export function getUserWithProjects(userId: number): UserWithProjects | null {
  const conn = db();
  const user = conn
    .prepare('SELECT id, email, name, role FROM users WHERE id = ?')
    .get(userId) as { id: number; email: string; name: string; role: Role } | undefined;
  if (!user) return null;

  const projects = conn
    .prepare(`
      SELECT p.id, p.code, p.name FROM projects p
      JOIN user_projects up ON up.project_id = p.id
      WHERE up.user_id = ?
      ORDER BY p.name
    `)
    .all(userId) as Project[];

  return { ...user, projects };
}

/**
 * Returns the project IDs a user can see.
 * Admins see all projects (returns null = "no restriction").
 */
export function visibleProjectIds(session: SessionPayload): number[] | null {
  if (session.role === 'admin') return null;
  const conn = db();
  const rows = conn
    .prepare('SELECT project_id FROM user_projects WHERE user_id = ?')
    .all(session.userId) as { project_id: number }[];
  return rows.map((r) => r.project_id);
}
