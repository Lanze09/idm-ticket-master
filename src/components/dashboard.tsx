'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Filter, RefreshCw, AlertTriangle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Project, Role, TicketRow, TicketStatus } from '@/lib/types';
import { TicketTable } from './ticket-table';
import { cn } from '@/lib/utils';

type Tab = 'open' | 'closed';

export function Dashboard({
  role,
  projects,
  initialTickets,
  counts,
}: {
  role: Role;
  projects: Project[];
  initialTickets: TicketRow[];
  counts: { open: number; closed: number };
}) {
  const [tab, setTab] = useState<Tab>('open');
  const [tickets, setTickets] = useState<TicketRow[]>(initialTickets);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [expiry, setExpiry] = useState<'all' | 'expired' | 'expiring'>('all');
  const [tabCounts, setTabCounts] = useState(counts);

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab, projectId, expiry]);

  async function reload(opts?: { silent?: boolean }) {
    if (!opts?.silent) setLoading(true);
    const params = new URLSearchParams();
    params.set('status', tab);
    if (projectId !== 'all') params.set('projectId', projectId);
    if (search.trim()) params.set('search', search.trim());
    if (role === 'admin' && expiry !== 'all') params.set('expiry', expiry);

    try {
      const res = await fetch(`/api/tickets?${params.toString()}`, { cache: 'no-store' });
      const j = await res.json();
      setTickets(j.tickets || []);

      // Refresh counts in parallel (silent)
      const [openRes, closedRes] = await Promise.all([
        fetch('/api/tickets?status=open', { cache: 'no-store' }),
        fetch('/api/tickets?status=closed', { cache: 'no-store' }),
      ]);
      const [openJ, closedJ] = await Promise.all([openRes.json(), closedRes.json()]);
      setTabCounts({ open: openJ.tickets?.length ?? 0, closed: closedJ.tickets?.length ?? 0 });
    } catch {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }

  const filteredTickets = useMemo(() => {
    if (statusFilter === 'all') return tickets;
    return tickets.filter((t) => t.status === statusFilter);
  }, [tickets, statusFilter]);

  function clearFilters() {
    setSearch('');
    setProjectId('all');
    setStatusFilter('all');
    setExpiry('all');
    setTimeout(() => reload({ silent: true }), 0);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">IDM — Ticket Support</h1>
          <p className="text-sm text-slate-500">
            {role === 'admin'
              ? 'Global view across all projects. SLA, expiry and risk indicators are visible.'
              : 'Tickets visible to your assigned project(s) only.'}
          </p>
        </div>
        <Link href="/dashboard/tickets/new" className="btn-primary">
          <Plus className="h-4 w-4" /> Create ticket
        </Link>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2 border-b border-slate-200 -mx-4 px-4 mb-4">
          <button
            onClick={() => setTab('open')}
            className={cn(
              'relative px-4 py-2 text-sm font-medium transition',
              tab === 'open' ? 'text-accenture-700' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            Open Tickets
            <span className="ml-2 text-xs text-slate-500">({tabCounts.open})</span>
            {tab === 'open' && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-accenture-500 rounded" />}
          </button>
          <button
            onClick={() => setTab('closed')}
            className={cn(
              'relative px-4 py-2 text-sm font-medium transition',
              tab === 'closed' ? 'text-accenture-700' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            Closed Tickets
            <span className="ml-2 text-xs text-slate-500">({tabCounts.closed})</span>
            {tab === 'closed' && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-accenture-500 rounded" />}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,auto,auto,auto] gap-2 mb-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search by ticket number, issue, or environment…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') reload(); }}
            />
          </div>
          <select
            className="input min-w-[160px]"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            className="input min-w-[140px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TicketStatus | 'all')}
          >
            <option value="all">All statuses</option>
            <option value="New">New</option>
            <option value="Open">Open</option>
            <option value="Pending">Pending</option>
            <option value="On-Hold">On-Hold</option>
            <option value="Closed">Closed</option>
          </select>
          {role === 'admin' && (
            <select
              className="input min-w-[150px]"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value as typeof expiry)}
              title="SLA Expiry filter (admin only)"
            >
              <option value="all">All expiry</option>
              <option value="expiring">Expiring soon</option>
              <option value="expired">Expired</option>
            </select>
          )}
          <div className="flex gap-2">
            <button onClick={() => reload()} className="btn-secondary" disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Go
            </button>
            <button onClick={clearFilters} className="btn-ghost">
              <Filter className="h-4 w-4" /> Clear
            </button>
          </div>
        </div>

        {role === 'admin' && (
          <div className="flex flex-wrap gap-3 mb-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-rose-600" /> Expired
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3 text-amber-600" /> Expiring soon
            </span>
          </div>
        )}

        <TicketTable role={role} tickets={filteredTickets} loading={loading} />
      </div>
    </div>
  );
}
