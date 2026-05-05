'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Loader2, LogIn } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { label: 'Admin (full access)', email: 'admin@idm.com', password: 'admin123' },
  { label: 'Northwind user', email: 'northwind.user@idm.com', password: 'user123' },
  { label: 'Contoso user', email: 'contoso.user@idm.com', password: 'user123' },
  { label: 'Multi-project user', email: 'multi.user@idm.com', password: 'user123' },
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Login failed');
      }
      toast.success('Welcome back!');
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  function fill(account: { email: string; password: string }) {
    setEmail(account.email);
    setPassword(account.password);
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-2 lg:hidden">
        <div className="text-2xl font-bold text-accenture-700">▸ Accenture</div>
        <div className="text-slate-500 text-sm">IDM Ticket Master</div>
      </div>
      <div className="card p-8 space-y-5">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="text-sm text-slate-500 mt-1">
            Your role and projects are determined automatically from your account.
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email" type="email" className="input" required
              autoComplete="email" placeholder="you@accenture.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password" type="password" className="input" required
              autoComplete="current-password" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
              : <><LogIn className="h-4 w-4" /> Sign in</>}
          </button>
        </form>
      </div>
      <div className="card p-5 space-y-3">
        <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Demo accounts</div>
        <div className="grid grid-cols-1 gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email} onClick={() => fill(a)} type="button"
              className="text-left text-sm rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50 hover:border-accenture-300 transition"
            >
              <div className="font-medium text-slate-700">{a.label}</div>
              <div className="text-slate-500 text-xs">{a.email} · <span className="font-mono">{a.password}</span></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
