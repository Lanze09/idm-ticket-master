import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listProjects, listProjectsForUser } from '@/lib/projects';
import { listAdmins, getUserById } from '@/lib/users';
import { TicketCreateForm } from '@/components/ticket-create-form';

export const dynamic = 'force-dynamic';

export default async function NewTicketPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const me = getUserById(session.userId)!;
  const projects = session.role === 'admin' ? listProjects() : listProjectsForUser(session.userId);
  const admins = session.role === 'admin' ? listAdmins() : [];

  return (
    <TicketCreateForm
      role={session.role}
      me={me}
      projects={projects}
      admins={admins}
    />
  );
}
