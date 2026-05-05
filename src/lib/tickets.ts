import { db } from './db';
import type {
  Activity, Severity, SessionPayload, Ticket, TicketRow, TicketStatus, MockLifecycle,
} from './types';
import { calculateExpiry, isAutoExpiryAllowed, isSlaPaused, slaIndicators } from './sla';
import { derivePriority } from './priority';
import { nextTicketNumber } from './ticket-number';

interface RawTicketRow {
  id: number;
  ticket_number: string;
  project_id: number;
  created_by_id: number;
  encountered_in: string;
  issue: string;
  go_live: 0 | 1;
  production: 0 | 1;
  mock_lifecycle: MockLifecycle | null;
  status: TicketStatus;
  severity: Severity;
  priority: 'Low' | 'Medium' | 'High';
  assigned_to_id: number | null;
  escalated: 0 | 1;
  acknowledged_at: string | null;
  sla_paused_at: string | null;
  sla_accumulated_paused_ms: number;
  sla_expires_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  project_code: string;
  project_name: string;
  created_by_name: string;
  created_by_email: string;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
}

function mapRow(r: RawTicketRow): TicketRow {
  return {
    id: r.id,
    ticketNumber: r.ticket_number,
    projectId: r.project_id,
    createdById: r.created_by_id,
    encounteredIn: r.encountered_in,
    issue: r.issue,
    goLive: r.go_live,
    production: r.production,
    mockLifecycle: r.mock_lifecycle,
    status: r.status,
    severity: r.severity,
    priority: r.priority,
    assignedToId: r.assigned_to_id,
    escalated: r.escalated,
    acknowledgedAt: r.acknowledged_at,
    slaPausedAt: r.sla_paused_at,
    slaAccumulatedPausedMs: r.sla_accumulated_paused_ms,
    slaExpiresAt: r.sla_expires_at,
    closedAt: r.closed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    projectCode: r.project_code,
    projectName: r.project_name,
    createdByName: r.created_by_name,
    createdByEmail: r.created_by_email,
    assignedToName: r.assigned_to_name,
    assignedToEmail: r.assigned_to_email,
  };
}

const SELECT_BASE = `
  SELECT
    t.id, t.ticket_number, t.project_id, t.created_by_id, t.encountered_in, t.issue,
    t.go_live, t.production, t.mock_lifecycle, t.status, t.severity, t.priority,
    t.assigned_to_id, t.escalated, t.acknowledged_at, t.sla_paused_at,
    t.sla_accumulated_paused_ms, t.sla_expires_at, t.closed_at, t.created_at, t.updated_at,
    p.code AS project_code, p.name AS project_name,
    c.name AS created_by_name, c.email AS created_by_email,
    a.name AS assigned_to_name, a.email AS assigned_to_email
  FROM tickets t
  JOIN projects p ON p.id = t.project_id
  JOIN users c ON c.id = t.created_by_id
  LEFT JOIN users a ON a.id = t.assigned_to_id
`;

export function listTicketsForSession(session: SessionPayload, options?: {
  status?: 'open' | 'closed' | 'all';
  projectId?: number | null;
  search?: string;
  expiry?: 'expired' | 'expiring' | 'all';
}): TicketRow[] {
  runAutoExpiry();

  const conn = db();
  const filters: string[] = [];
  const params: Array<string | number> = [];

  if (session.role !== 'admin') {
    const ids = conn
      .prepare('SELECT project_id FROM user_projects WHERE user_id = ?')
      .all(session.userId) as { project_id: number }[];
    const idList = ids.map((r) => r.project_id);
    if (idList.length === 0) return [];
    filters.push(`t.project_id IN (${idList.map(() => '?').join(',')})`);
    params.push(...idList);
  }

  const status = options?.status ?? 'all';
  if (status === 'open') filters.push("t.status != 'Closed'");
  else if (status === 'closed') filters.push("t.status = 'Closed'");

  if (options?.projectId) {
    filters.push('t.project_id = ?');
    params.push(options.projectId);
  }

  if (options?.search) {
    filters.push('(t.ticket_number LIKE ? OR t.issue LIKE ? OR t.encountered_in LIKE ?)');
    const q = `%${options.search}%`;
    params.push(q, q, q);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = conn.prepare(`${SELECT_BASE} ${where} ORDER BY t.created_at DESC`).all(...params) as RawTicketRow[];
  let mapped = rows.map(mapRow);

  if (session.role === 'admin' && options?.expiry && options.expiry !== 'all') {
    mapped = mapped.filter((t) => {
      const ind = slaIndicators(t);
      if (options.expiry === 'expired') return ind.expired;
      if (options.expiry === 'expiring') return ind.expiringSoon;
      return true;
    });
  }

  return mapped;
}

export function getTicketByIdForSession(session: SessionPayload, id: number): TicketRow | null {
  runAutoExpiry();
  const conn = db();
  const row = conn.prepare(`${SELECT_BASE} WHERE t.id = ?`).get(id) as RawTicketRow | undefined;
  if (!row) return null;
  if (session.role !== 'admin') {
    const allowed = conn
      .prepare('SELECT 1 FROM user_projects WHERE user_id = ? AND project_id = ?')
      .get(session.userId, row.project_id);
    if (!allowed) return null;
  }
  return mapRow(row);
}

function getRawTicket(id: number): RawTicketRow | undefined {
  return db().prepare(`${SELECT_BASE} WHERE t.id = ?`).get(id) as RawTicketRow | undefined;
}

export function createTicket(args: {
  session: SessionPayload;
  projectId: number;
  encounteredIn: string;
  issue: string;
  goLive: boolean;
  production: boolean;
  mockLifecycle: MockLifecycle | null;
  // Admin-only fields:
  severity?: Severity;
  status?: TicketStatus;
  assignedToId?: number | null;
}): TicketRow {
  const conn = db();

  if (args.session.role !== 'admin') {
    const allowed = conn
      .prepare('SELECT 1 FROM user_projects WHERE user_id = ? AND project_id = ?')
      .get(args.session.userId, args.projectId);
    if (!allowed) throw new Error('FORBIDDEN_PROJECT');
  }

  const ticketNumber = nextTicketNumber();
  const now = new Date().toISOString();

  // Defaults from requirements
  const status = args.session.role === 'admin' ? (args.status ?? 'New') : 'New';
  const severity = args.session.role === 'admin' ? (args.severity ?? 'Low') : 'Low';
  const assignedToId = args.session.role === 'admin' ? (args.assignedToId ?? null) : null;

  // SLA only starts at admin acknowledgement; if admin creates a ticket and assigns it,
  // we'll treat that as auto-acknowledgement once status leaves 'New'.
  let acknowledgedAt: string | null = null;
  let slaExpiresAt: string | null = null;
  if (args.session.role === 'admin' && (status !== 'New' || assignedToId)) {
    acknowledgedAt = now;
    slaExpiresAt = calculateExpiry({ acknowledgedAt: now, severity, pausedMs: 0 });
  }

  const tempPriority = derivePriority({
    id: 0,
    ticketNumber,
    projectId: args.projectId,
    createdById: args.session.userId,
    encounteredIn: args.encounteredIn,
    issue: args.issue,
    goLive: args.goLive ? 1 : 0,
    production: args.production ? 1 : 0,
    mockLifecycle: args.mockLifecycle,
    status,
    severity,
    priority: 'Low',
    assignedToId,
    escalated: 0,
    acknowledgedAt,
    slaPausedAt: null,
    slaAccumulatedPausedMs: 0,
    slaExpiresAt,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  const result = conn.prepare(`
    INSERT INTO tickets (
      ticket_number, project_id, created_by_id, encountered_in, issue,
      go_live, production, mock_lifecycle, status, severity, priority,
      assigned_to_id, escalated, acknowledged_at, sla_expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
  `).run(
    ticketNumber, args.projectId, args.session.userId, args.encounteredIn, args.issue,
    args.goLive ? 1 : 0, args.production ? 1 : 0, args.mockLifecycle, status, severity, tempPriority,
    assignedToId, acknowledgedAt, slaExpiresAt, now, now,
  );

  const id = Number(result.lastInsertRowid);
  appendActivity({ ticketId: id, userId: args.session.userId, type: 'system', message: `Ticket created` });

  const created = getRawTicket(id);
  if (!created) throw new Error('Failed to create ticket');
  return mapRow(created);
}

export interface UpdateTicketArgs {
  encounteredIn?: string;
  issue?: string;
  goLive?: boolean;
  production?: boolean;
  mockLifecycle?: MockLifecycle | null;
  severity?: Severity;
  status?: TicketStatus;
  assignedToId?: number | null;
  escalated?: boolean;
}

export function updateTicket(args: { session: SessionPayload; ticketId: number; updates: UpdateTicketArgs }): TicketRow {
  const conn = db();
  const before = getRawTicket(args.ticketId);
  if (!before) throw new Error('NOT_FOUND');

  const isAdmin = args.session.role === 'admin';

  // Non-admins can only edit their own tickets, and only the few user-facing fields.
  if (!isAdmin) {
    const allowed = conn
      .prepare('SELECT 1 FROM user_projects WHERE user_id = ? AND project_id = ?')
      .get(args.session.userId, before.project_id);
    if (!allowed) throw new Error('FORBIDDEN');
    if (before.created_by_id !== args.session.userId) throw new Error('FORBIDDEN');
    if (
      args.updates.severity !== undefined ||
      args.updates.status !== undefined ||
      args.updates.assignedToId !== undefined ||
      args.updates.escalated !== undefined
    ) {
      throw new Error('FORBIDDEN_FIELDS');
    }
    // Closed tickets are read-only for users.
    if (before.status === 'Closed') throw new Error('TICKET_CLOSED');
  }

  const now = new Date().toISOString();

  let acknowledgedAt = before.acknowledged_at;
  let slaPausedAt = before.sla_paused_at;
  let slaAccumulatedPausedMs = before.sla_accumulated_paused_ms;
  let slaExpiresAt = before.sla_expires_at;
  let closedAt = before.closed_at;

  const nextStatus = args.updates.status ?? before.status;
  const nextSeverity = args.updates.severity ?? before.severity;
  const nextAssignedToId = args.updates.assignedToId !== undefined
    ? args.updates.assignedToId
    : before.assigned_to_id;
  const nextEscalated: 0 | 1 = args.updates.escalated !== undefined
    ? (args.updates.escalated ? 1 : 0)
    : before.escalated;

  // First-touch acknowledgement (admin opens a New ticket)
  if (isAdmin && before.status === 'New' && nextStatus === 'Open' && !acknowledgedAt) {
    acknowledgedAt = now;
    slaExpiresAt = calculateExpiry({ acknowledgedAt, severity: nextSeverity, pausedMs: 0 });
  }

  // Pause SLA when entering Pending/On-Hold
  const wasPaused = isSlaPaused(before.status);
  const willBePaused = isSlaPaused(nextStatus);
  if (!wasPaused && willBePaused) {
    slaPausedAt = now;
  }
  // Resume SLA when leaving Pending/On-Hold
  if (wasPaused && !willBePaused && slaPausedAt) {
    const pausedMs = new Date(now).getTime() - new Date(slaPausedAt).getTime();
    slaAccumulatedPausedMs += pausedMs;
    slaPausedAt = null;
    if (acknowledgedAt) {
      slaExpiresAt = calculateExpiry({ acknowledgedAt, severity: nextSeverity, pausedMs: slaAccumulatedPausedMs });
    }
  }

  // Severity change recalculates expiry (only meaningful if already acknowledged)
  if (
    args.updates.severity !== undefined &&
    args.updates.severity !== before.severity &&
    acknowledgedAt
  ) {
    slaExpiresAt = calculateExpiry({ acknowledgedAt, severity: nextSeverity, pausedMs: slaAccumulatedPausedMs });
  }

  // Closing
  if (before.status !== 'Closed' && nextStatus === 'Closed') {
    closedAt = now;
  }
  // Reopening (uncommon but supported)
  if (before.status === 'Closed' && nextStatus !== 'Closed') {
    closedAt = null;
  }

  // First admin assignment can trigger acknowledgement too.
  if (
    isAdmin &&
    !acknowledgedAt &&
    nextAssignedToId !== null &&
    before.assigned_to_id === null
  ) {
    acknowledgedAt = now;
    slaExpiresAt = calculateExpiry({ acknowledgedAt, severity: nextSeverity, pausedMs: 0 });
  }

  // Build updated ticket for priority derivation
  const updatedPreview: Ticket = {
    id: before.id,
    ticketNumber: before.ticket_number,
    projectId: before.project_id,
    createdById: before.created_by_id,
    encounteredIn: args.updates.encounteredIn ?? before.encountered_in,
    issue: args.updates.issue ?? before.issue,
    goLive: args.updates.goLive !== undefined ? (args.updates.goLive ? 1 : 0) : before.go_live,
    production: args.updates.production !== undefined ? (args.updates.production ? 1 : 0) : before.production,
    mockLifecycle: args.updates.mockLifecycle !== undefined ? args.updates.mockLifecycle : before.mock_lifecycle,
    status: nextStatus,
    severity: nextSeverity,
    priority: 'Low',
    assignedToId: nextAssignedToId,
    escalated: nextEscalated,
    acknowledgedAt,
    slaPausedAt,
    slaAccumulatedPausedMs,
    slaExpiresAt,
    closedAt,
    createdAt: before.created_at,
    updatedAt: now,
  };
  const nextPriority = derivePriority(updatedPreview);

  conn.prepare(`
    UPDATE tickets SET
      encountered_in = ?,
      issue = ?,
      go_live = ?,
      production = ?,
      mock_lifecycle = ?,
      status = ?,
      severity = ?,
      priority = ?,
      assigned_to_id = ?,
      escalated = ?,
      acknowledged_at = ?,
      sla_paused_at = ?,
      sla_accumulated_paused_ms = ?,
      sla_expires_at = ?,
      closed_at = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    updatedPreview.encounteredIn,
    updatedPreview.issue,
    updatedPreview.goLive,
    updatedPreview.production,
    updatedPreview.mockLifecycle,
    updatedPreview.status,
    updatedPreview.severity,
    nextPriority,
    updatedPreview.assignedToId,
    updatedPreview.escalated,
    updatedPreview.acknowledgedAt,
    updatedPreview.slaPausedAt,
    updatedPreview.slaAccumulatedPausedMs,
    updatedPreview.slaExpiresAt,
    updatedPreview.closedAt,
    updatedPreview.updatedAt,
    args.ticketId,
  );

  // Audit-trail messages
  const messages: string[] = [];
  if (args.updates.status && args.updates.status !== before.status) {
    messages.push(`Status changed: ${before.status} → ${args.updates.status}`);
  }
  if (args.updates.severity && args.updates.severity !== before.severity) {
    messages.push(`Severity changed: ${before.severity} → ${args.updates.severity}`);
  }
  if (args.updates.assignedToId !== undefined && args.updates.assignedToId !== before.assigned_to_id) {
    const newAssignee = args.updates.assignedToId
      ? (conn.prepare('SELECT name FROM users WHERE id = ?').get(args.updates.assignedToId) as { name: string } | undefined)?.name ?? 'unknown'
      : 'unassigned';
    messages.push(`Assigned to: ${newAssignee}`);
  }
  if (args.updates.escalated !== undefined && (args.updates.escalated ? 1 : 0) !== before.escalated) {
    messages.push(args.updates.escalated ? 'Ticket escalated' : 'Escalation cleared');
  }
  if (
    args.updates.encounteredIn !== undefined && args.updates.encounteredIn !== before.encountered_in ||
    args.updates.issue !== undefined && args.updates.issue !== before.issue ||
    args.updates.goLive !== undefined && (args.updates.goLive ? 1 : 0) !== before.go_live ||
    args.updates.production !== undefined && (args.updates.production ? 1 : 0) !== before.production ||
    args.updates.mockLifecycle !== undefined && args.updates.mockLifecycle !== before.mock_lifecycle
  ) {
    messages.push('Ticket details updated');
  }
  for (const m of messages) {
    appendActivity({ ticketId: args.ticketId, userId: args.session.userId, type: 'system', message: m });
  }

  const after = getRawTicket(args.ticketId);
  if (!after) throw new Error('Failed to read updated ticket');
  return mapRow(after);
}

export function appendActivity(args: {
  ticketId: number;
  userId: number;
  type: 'comment' | 'system';
  message: string;
}): Activity {
  const conn = db();
  const now = new Date().toISOString();
  const result = conn
    .prepare('INSERT INTO activities (ticket_id, user_id, type, message, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(args.ticketId, args.userId, args.type, args.message, now);

  const row = conn
    .prepare(`
      SELECT a.id, a.ticket_id, a.user_id, u.name AS user_name, a.type, a.message, a.created_at
      FROM activities a JOIN users u ON u.id = a.user_id WHERE a.id = ?
    `)
    .get(Number(result.lastInsertRowid)) as {
      id: number; ticket_id: number; user_id: number; user_name: string;
      type: 'comment' | 'system'; message: string; created_at: string;
    };

  return {
    id: row.id,
    ticketId: row.ticket_id,
    userId: row.user_id,
    userName: row.user_name,
    type: row.type,
    message: row.message,
    createdAt: row.created_at,
  };
}

export function listActivities(ticketId: number): Activity[] {
  const conn = db();
  const rows = conn.prepare(`
    SELECT a.id, a.ticket_id, a.user_id, u.name AS user_name, a.type, a.message, a.created_at
    FROM activities a JOIN users u ON u.id = a.user_id
    WHERE a.ticket_id = ?
    ORDER BY a.created_at ASC
  `).all(ticketId) as Array<{
    id: number; ticket_id: number; user_id: number; user_name: string;
    type: 'comment' | 'system'; message: string; created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    ticketId: r.ticket_id,
    userId: r.user_id,
    userName: r.user_name,
    type: r.type,
    message: r.message,
    createdAt: r.created_at,
  }));
}

/**
 * Auto-close tickets per the lifecycle:
 *  - New tickets not acknowledged within 15 days → Closed
 *  - Open tickets with 15 days of no activity → Closed (unless protected)
 */
export function runAutoExpiry(now: Date = new Date()): void {
  const conn = db();
  const cutoff = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();

  const candidates = conn.prepare(`
    SELECT t.id FROM tickets t
    WHERE t.status IN ('New','Open')
      AND t.updated_at < ?
  `).all(cutoff) as { id: number }[];

  for (const { id } of candidates) {
    const raw = getRawTicket(id);
    if (!raw) continue;
    const ticket = mapRow(raw);
    if (!isAutoExpiryAllowed(ticket)) continue;
    conn.prepare(`
      UPDATE tickets SET status='Closed', closed_at=?, updated_at=? WHERE id=?
    `).run(now.toISOString(), now.toISOString(), id);
    appendActivity({
      ticketId: id, userId: ticket.createdById, type: 'system',
      message: 'Auto-closed after 15 days of inactivity',
    });
  }
}
