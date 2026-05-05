import type { Severity, Ticket, TicketStatus } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

// Hours of allowed resolution time per severity. Severity = technical complexity.
// Higher complexity gets MORE time (per requirements).
const SLA_HOURS_BY_SEVERITY: Record<Severity, number> = {
  Low: 2 * 24,        // 2 days
  Medium: 3 * 24,     // 3 days
  High: 5 * 24,       // 5 days
  Critical: 7 * 24,   // 7 days (most complex; biggest investigation window)
};

// Auto-close inactivity window per the lifecycle diagram (15 days).
export const AUTO_CLOSE_INACTIVITY_DAYS = 15;

export function slaWindowMs(severity: Severity): number {
  return SLA_HOURS_BY_SEVERITY[severity] * 60 * 60 * 1000;
}

export function isSlaPaused(status: TicketStatus): boolean {
  return status === 'Pending' || status === 'On-Hold';
}

export function isSlaActive(status: TicketStatus): boolean {
  return status === 'Open';
}

/**
 * Calculate when SLA expires from acknowledgement,
 * accounting for time already paused.
 */
export function calculateExpiry(args: {
  acknowledgedAt: string;
  severity: Severity;
  pausedMs: number;
}): string {
  const ackMs = new Date(args.acknowledgedAt).getTime();
  return new Date(ackMs + slaWindowMs(args.severity) + args.pausedMs).toISOString();
}

export interface SlaIndicators {
  expiresAt: string | null;
  expired: boolean;
  expiringSoon: boolean;
  hoursRemaining: number | null;
  riskLevel: 'none' | 'ok' | 'warning' | 'expired';
}

/**
 * Compute live SLA risk indicators for the admin dashboard.
 * Tickets that are paused show their stored expiry; we don't advance the clock.
 */
export function slaIndicators(ticket: Ticket, now = new Date()): SlaIndicators {
  if (!ticket.acknowledgedAt || ticket.status === 'Closed' || !ticket.slaExpiresAt) {
    return {
      expiresAt: ticket.slaExpiresAt,
      expired: false,
      expiringSoon: false,
      hoursRemaining: null,
      riskLevel: 'none',
    };
  }

  const expires = new Date(ticket.slaExpiresAt).getTime();
  const remaining = expires - now.getTime();
  const hoursRemaining = remaining / (60 * 60 * 1000);

  // Escalated / production / high-priority tickets must not auto-expire,
  // but we still surface the risk indicator so admins know.
  const expired = remaining <= 0;
  const expiringSoon = !expired && remaining <= DAY_MS;

  let riskLevel: SlaIndicators['riskLevel'];
  if (expired) riskLevel = 'expired';
  else if (expiringSoon) riskLevel = 'warning';
  else riskLevel = 'ok';

  return {
    expiresAt: ticket.slaExpiresAt,
    expired,
    expiringSoon,
    hoursRemaining,
    riskLevel,
  };
}

/**
 * Should this ticket be allowed to auto-expire to Closed?
 * Per requirements: high-priority, production, and escalated tickets must NOT auto-expire.
 */
export function isAutoExpiryAllowed(ticket: Ticket): boolean {
  if (ticket.escalated) return false;
  if (ticket.production) return false;
  if (ticket.priority === 'High') return false;
  return true;
}
