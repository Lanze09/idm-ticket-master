import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createTicket, listTicketsForSession } from '@/lib/tickets';
import { sendTicketNotification } from '@/lib/email';
import type { MockLifecycle, Severity, TicketStatus } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const status = (searchParams.get('status') ?? 'all') as 'open' | 'closed' | 'all';
  const projectIdRaw = searchParams.get('projectId');
  const projectId = projectIdRaw ? Number(projectIdRaw) : null;
  const search = searchParams.get('search') ?? undefined;
  const expiry = (searchParams.get('expiry') ?? 'all') as 'expired' | 'expiring' | 'all';

  const tickets = listTicketsForSession(session, { status, projectId, search, expiry });
  return NextResponse.json({ tickets });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const projectId = Number(body.projectId);
  const encounteredIn = String(body.encounteredIn || '').trim();
  const issue = String(body.issue || '').trim();
  const goLive = Boolean(body.goLive);
  const production = Boolean(body.production);
  const mockLifecycle = (body.mockLifecycle as MockLifecycle | null) ?? null;

  if (!projectId || !encounteredIn || !issue) {
    return NextResponse.json({ error: 'projectId, encounteredIn, and issue are required' }, { status: 400 });
  }

  const adminFields = session.role === 'admin'
    ? {
      severity: body.severity as Severity | undefined,
      status: body.status as TicketStatus | undefined,
      assignedToId: body.assignedToId === null || body.assignedToId === undefined
        ? null
        : Number(body.assignedToId),
    }
    : {};

  try {
    const ticket = createTicket({
      session,
      projectId,
      encounteredIn,
      issue,
      goLive,
      production,
      mockLifecycle,
      ...adminFields,
    });
    await sendTicketNotification({ event: 'created', ticket });
    return NextResponse.json({ ticket });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create ticket';
    const status = msg === 'FORBIDDEN_PROJECT' ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
