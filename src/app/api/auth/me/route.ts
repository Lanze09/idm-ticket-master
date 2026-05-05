import { NextResponse } from 'next/server';
import { getSession, getUserWithProjects } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const me = getUserWithProjects(s.userId);
  if (!me) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ user: me });
}
