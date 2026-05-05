import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getTicketByIdForSession, listActivities } from '@/lib/tickets';
import { listAdmins } from '@/lib/users';
import { TicketDetails } from '@/components/ticket-details';

export const dynamic = 'force-dynamic';

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect('/');

  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const ticket = getTicketByIdForSession(session, id);
  if (!ticket) notFound();

  const activities = listActivities(id);
  const admins = session.role === 'admin' ? listAdmins() : [];

  return <TicketDetails role={session.role} ticket={ticket} activities={activities} admins={admins} />;
}
