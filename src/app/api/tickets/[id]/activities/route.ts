import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { appendActivity, getTicketByIdForSession, listActivities } from '@/lib/tickets';

export const runtime = 'nodejs';

interface Ctx { params: { id: string } }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const id = Number(ctx.params.id);
  const ticket = getTicketByIdForSession(session, id);
  if (!ticket) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ activities: listActivities(id) });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const id = Number(ctx.params.id);
  const ticket = getTicketByIdForSession(session, id);
  if (!ticket) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const message = String(body.message || '').trim();
  if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

  const activity = appendActivity({
    ticketId: id, userId: session.userId, type: 'comment', message,
  });
  return NextResponse.json({ activity });
}
