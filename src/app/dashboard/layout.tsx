import { redirect } from 'next/navigation';
import { getSession, getUserWithProjects } from '@/lib/auth';
import { Topbar } from '@/components/topbar';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect('/');
  const me = getUserWithProjects(s.userId);
  if (!me) redirect('/');

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar
        user={{ name: me.name, email: me.email, role: me.role }}
        projects={me.projects}
      />
      <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 max-w-[1500px] w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
