import path from 'path';
import fs from 'fs';
// @ts-ignore - node:sqlite has no published @types yet
import { DatabaseSync } from 'node:sqlite';

type RunResult = { changes: number; lastInsertRowid: number | bigint };
type RawStatement = {
  run(...params: unknown[]): RunResult;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
};
type Statement = {
  run(...params: unknown[]): RunResult;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
};
export interface Db {
  prepare(sql: string): Statement;
  exec(sql: string): void;
  close(): void;
}

let _db: Db | null = null;

// node:sqlite returns rows with `null` prototype, which React Server Components
// reject when passed to Client Components. Re-spread to plain objects.
function plain<T>(value: unknown): T {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) } as T;
  }
  return value as T;
}

function wrap(stmt: RawStatement): Statement {
  return {
    run: (...params) => stmt.run(...params),
    get: (...params) => {
      const r = stmt.get(...params);
      return r === undefined || r === null ? r : plain(r);
    },
    all: (...params) => stmt.all(...params).map((r) => plain(r)),
  };
}

export function db(): Db {
  if (_db) return _db;

  const dbPath = process.env.DATABASE_PATH || './data/idm-ticket-master.db';
  const absolutePath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
  const dir = path.dirname(absolutePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const conn = new DatabaseSync(absolutePath);
  conn.exec('PRAGMA journal_mode = WAL;');
  conn.exec('PRAGMA foreign_keys = ON;');

  initSchema(conn);

  const wrapped: Db = {
    prepare: (sql: string) => wrap(conn.prepare(sql) as RawStatement),
    exec: (sql: string) => conn.exec(sql),
    close: () => conn.close(),
  };
  _db = wrapped;
  return wrapped;
}

function initSchema(conn: { exec(sql: string): void }): void {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','user')),
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_projects (
      user_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, project_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT UNIQUE NOT NULL,
      project_id INTEGER NOT NULL,
      created_by_id INTEGER NOT NULL,
      encountered_in TEXT NOT NULL,
      issue TEXT NOT NULL,
      go_live INTEGER NOT NULL DEFAULT 0,
      production INTEGER NOT NULL DEFAULT 0,
      mock_lifecycle TEXT,
      status TEXT NOT NULL DEFAULT 'New',
      severity TEXT NOT NULL DEFAULT 'Low',
      priority TEXT NOT NULL DEFAULT 'Low',
      assigned_to_id INTEGER,
      escalated INTEGER NOT NULL DEFAULT 0,
      acknowledged_at TEXT,
      sla_paused_at TEXT,
      sla_accumulated_paused_ms INTEGER NOT NULL DEFAULT 0,
      sla_expires_at TEXT,
      closed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (created_by_id) REFERENCES users(id),
      FOREIGN KEY (assigned_to_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS tickets_project_idx ON tickets(project_id);
    CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets(status);
    CREATE INDEX IF NOT EXISTS tickets_assigned_idx ON tickets(assigned_to_id);

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('comment','system')),
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS activities_ticket_idx ON activities(ticket_id);
  `);
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
