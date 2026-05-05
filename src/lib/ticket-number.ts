import { db } from './db';

/**
 * Ticket number format: IDM-YYYYMM-NNNN
 * Sequence is global and monotonically increasing.
 */
export function nextTicketNumber(): string {
  const conn = db();
  const row = conn.prepare('SELECT COUNT(*) AS n FROM tickets').get() as { n: number };
  const seq = String(row.n + 1).padStart(4, '0');
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `IDM-${yyyymm}-${seq}`;
}
