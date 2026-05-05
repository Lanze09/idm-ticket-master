import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listProjects, listProjectsForUser } from '@/lib/projects';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const projects = session.role === 'admin'
    ? listProjects()
    : listProjectsForUser(session.userId);
  return NextResponse.json({ projects });
}
