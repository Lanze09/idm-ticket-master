import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getTicketByIdForSession, updateTicket } from '@/lib/tickets';
import { sendTicketNotification, type NotificationEvent } from '@/lib/email';
import type { MockLifecycle, Severity, TicketStatus } from '@/lib/types';

export const runtime = 'nodejs';

interface Ctx { params: { id: string } }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'BAD_ID' }, { status: 400 });
  const ticket = getTicketByIdForSession(session, id);
  if (!ticket) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ ticket });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'BAD_ID' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const updates: Parameters<typeof updateTicket>[0]['updates'] = {};

  if (body.encounteredIn !== undefined) updates.encounteredIn = String(body.encounteredIn);
  if (body.issue !== undefined) updates.issue = String(body.issue);
  if (body.goLive !== undefined) updates.goLive = Boolean(body.goLive);
  if (body.production !== undefined) updates.production = Boolean(body.production);
  if (body.mockLifecycle !== undefined) updates.mockLifecycle = body.mockLifecycle as MockLifecycle | null;

  if (session.role === 'admin') {
    if (body.severity !== undefined) updates.severity = body.severity as Severity;
    if (body.status !== undefined) updates.status = body.status as TicketStatus;
    if (body.assignedToId !== undefined) {
      updates.assignedToId = body.assignedToId === null || body.assignedToId === ''
        ? null
        : Number(body.assignedToId);
    }
    if (body.escalated !== undefined) updates.escalated = Boolean(body.escalated);
  }

  try {
    const before = getTicketByIdForSession(session, id);
    const ticket = updateTicket({ session, ticketId: id, updates });

    // Determine notification event(s)
    const events: NotificationEvent[] = [];
    if (before && before.status !== ticket.status) events.push('status_changed');
    if (before && before.severity !== ticket.severity) events.push('severity_changed');
    if (before && before.assignedToId !== ticket.assignedToId) events.push('assigned');
    if (before && before.escalated !== ticket.escalated && ticket.escalated) events.push('escalated');
    if (events.length === 0) events.push('updated');

    for (const event of events) {
      await sendTicketNotification({ event, ticket });
    }
    return NextResponse.json({ ticket });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update ticket';
    const status = msg === 'NOT_FOUND' ? 404 :
      msg === 'FORBIDDEN' || msg === 'FORBIDDEN_FIELDS' || msg === 'TICKET_CLOSED' ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
