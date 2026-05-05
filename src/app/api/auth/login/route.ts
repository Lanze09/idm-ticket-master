import { NextRequest, NextResponse } from 'next/server';
import { authenticate, createSession, setSessionCookie } from '@/lib/auth';
import { seedIfEmpty } from '@/lib/seed';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  await seedIfEmpty();

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim();
  const password = String(body.password || '');

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const session = authenticate(email, password);
  if (!session) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await createSession(session);
  await setSessionCookie(token);
  return NextResponse.json({ ok: true, user: session });
}
