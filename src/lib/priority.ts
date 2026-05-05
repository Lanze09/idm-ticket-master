import type { Priority, Severity, Ticket } from './types';
import { slaIndicators } from './sla';

/**
 * Priority is DERIVED, not user-set.
 * Inputs: production flag, go-live flag, admin severity, SLA expiry proximity.
 *
 * Rules (in precedence order):
 *  1. Production flag → at least High
 *  2. Severity Critical → at least High
 *  3. Go-Live flag → at least Medium
 *  4. SLA expired or expiring soon → bump up by one notch
 *  5. Severity High → at least Medium
 *  6. Default → Low
 */
export function derivePriority(t: Ticket): Priority {
  let level: 0 | 1 | 2 = 0; // 0=Low, 1=Medium, 2=High

  if (t.production) level = Math.max(level, 2) as 2;
  if (t.severity === 'Critical') level = Math.max(level, 2) as 2;
  if (t.goLive) level = Math.max(level, 1) as 1 | 2;
  if (t.severity === 'High') level = Math.max(level, 1) as 1 | 2;

  // SLA proximity bump
  const sla = slaIndicators(t);
  if (sla.expired || sla.expiringSoon) {
    level = Math.min(2, level + 1) as 0 | 1 | 2;
  }

  return (['Low', 'Medium', 'High'] as Priority[])[level]!;
}

export function priorityBadgeStyle(p: Priority): string {
  switch (p) {
    case 'High': return 'bg-rose-100 text-rose-800 border-rose-200';
    case 'Medium': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'Low': return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export function severityBadgeStyle(s: Severity): string {
  switch (s) {
    case 'Critical': return 'bg-red-600 text-white border-red-700';
    case 'High': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'Low': return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export function statusBadgeStyle(s: Ticket['status']): string {
  switch (s) {
    case 'New': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Open': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'Pending': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'On-Hold': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'Closed': return 'bg-slate-200 text-slate-700 border-slate-300';
  }
}
