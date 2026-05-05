import { getSession, getUserWithProjects } from '@/lib/auth';
import { listTicketsForSession } from '@/lib/tickets';
import { listProjects, listProjectsForUser } from '@/lib/projects';
import { Dashboard } from '@/components/dashboard';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = (await getSession())!;
  const me = getUserWithProjects(session.userId)!;
  const initialTickets = listTicketsForSession(session, { status: 'open' });
  const projects = session.role === 'admin' ? listProjects() : listProjectsForUser(session.userId);

  // Pre-compute counts for the tabs.
  const allOpen = listTicketsForSession(session, { status: 'open' }).length;
  const allClosed = listTicketsForSession(session, { status: 'closed' }).length;

  return (
    <Dashboard
      role={me.role}
      projects={projects}
      initialTickets={initialTickets}
      counts={{ open: allOpen, closed: allClosed }}
    />
  );
}
