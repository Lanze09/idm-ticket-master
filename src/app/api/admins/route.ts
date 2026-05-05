import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listAdmins } from '@/lib/users';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  return NextResponse.json({ admins: listAdmins() });
}
