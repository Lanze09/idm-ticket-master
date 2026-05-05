import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { LoginForm } from '@/components/login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect('/dashboard');

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-accenture-700 via-accenture-500 to-accenture-300 p-10 text-white">
        <div className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <span className="text-accenture-100">▸</span> Accenture
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="text-4xl font-bold leading-tight">IDM Ticket Master</h1>
          <p className="text-lg text-accenture-50/95">
            Centralized ticketing for Intelligent Data Migration. Raise issues, track SLAs,
            collaborate with IDM Support — all in one place.
          </p>
          <ul className="space-y-2 text-sm text-accenture-50/90">
            <li>• Project-aware data privacy</li>
            <li>• Severity governed by IDM Support</li>
            <li>• Full audit trail per ticket</li>
            <li>• Automated SLA tracking & escalation</li>
          </ul>
        </div>
        <div className="text-xs text-accenture-50/70">© Accenture myConcerto — Oracle Cloud Conversion</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <LoginForm />
      </div>
    </main>
  );
}
