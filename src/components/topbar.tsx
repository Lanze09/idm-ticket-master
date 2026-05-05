'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, ShieldCheck, User } from 'lucide-react';
import type { Project, Role } from '@/lib/types';
import toast from 'react-hot-toast';

export function Topbar({
  user,
  projects,
}: {
  user: { name: string; email: string; role: Role };
  projects: Project[];
}) {
  const router = useRouter();
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    toast.success('Signed out');
    router.push('/');
    router.refresh();
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center gap-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="text-accenture-500 font-bold text-xl leading-none">▸</span>
          <span className="font-semibold tracking-tight text-slate-800">
            IDM <span className="text-accenture-600">Ticket Master</span>
          </span>
        </Link>
        <div className="hidden md:flex text-xs text-slate-500 ml-3">
          {user.role === 'admin'
            ? <span className="badge bg-accenture-50 text-accenture-700 border-accenture-200">
                <ShieldCheck className="h-3 w-3" /> Admin · all projects
              </span>
            : <span className="badge bg-slate-100 text-slate-700 border-slate-200">
                <User className="h-3 w-3" /> {projects.map((p) => p.code).join(' · ') || 'No projects'}
              </span>}
        </div>
        <div className="flex-1" />
        <div className="text-right text-xs text-slate-600 hidden sm:block leading-tight">
          <div className="font-medium text-slate-800">{user.name}</div>
          <div className="text-slate-500">{user.email}</div>
        </div>
        <button onClick={logout} className="btn-ghost" title="Sign out">
          <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
