'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import type { MockLifecycle, Project, Role, Severity, TicketStatus, User } from '@/lib/types';
import { MOCK_LIFECYCLE_OPTIONS, SEVERITY_OPTIONS, STATUS_OPTIONS } from '@/lib/types';

export function TicketCreateForm({
  role,
  me,
  projects,
  admins,
}: {
  role: Role;
  me: User;
  projects: Project[];
  admins: User[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [projectId, setProjectId] = useState<number | ''>(projects[0]?.id ?? '');
  const [encounteredIn, setEncounteredIn] = useState('');
  const [issue, setIssue] = useState('');
  const [goLive, setGoLive] = useState(false);
  const [production, setProduction] = useState(false);
  const [mockLifecycle, setMockLifecycle] = useState<MockLifecycle | ''>('');

  // Admin-only
  const [severity, setSeverity] = useState<Severity>('Low');
  const [status, setStatus] = useState<TicketStatus>('New');
  const [assignedToId, setAssignedToId] = useState<number | ''>('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) { toast.error('Please pick a project'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          encounteredIn: encounteredIn.trim(),
          issue: issue.trim(),
          goLive,
          production,
          mockLifecycle: mockLifecycle || null,
          ...(role === 'admin' ? {
            severity,
            status,
            assignedToId: assignedToId === '' ? null : assignedToId,
          } : {}),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Failed to create ticket');
      }
      const j = await res.json();
      toast.success(`Ticket ${j.ticket.ticketNumber} created`);
      router.push(`/dashboard/tickets/${j.ticket.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>
      <div className="card p-6 space-y-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Create new ticket</h1>
          <p className="text-sm text-slate-500">
            Read-only fields are auto-populated. The Activities panel becomes available after creation.
          </p>
        </div>

        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Auto-populated, read-only */}
          <ReadonlyField label="Ticket Number" value="(auto-generated on save)" />
          <ReadonlyField label="Date Created" value={format(new Date(), 'yyyy-MM-dd HH:mm')} />
          <ReadonlyField label="Created By" value={me.name} sub={me.email} />
          <div>
            <label className="label">Project</label>
            <select
              className="input"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')}
              required
              disabled={projects.length === 1 && role !== 'admin'}
            >
              {projects.length === 0 && <option value="">— no projects —</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {role !== 'admin' && (
              <p className="text-[11px] text-slate-500 mt-1">Limited to your assigned projects.</p>
            )}
          </div>

          {/* User-fillable */}
          <div>
            <label className="label">Encountered In <span className="text-rose-500">*</span></label>
            <input
              className="input" required maxLength={200}
              placeholder="e.g. Conversion Run #42"
              value={encounteredIn} onChange={(e) => setEncounteredIn(e.target.value)}
            />
          </div>
          <div>
            <label className="label">MOCK Lifecycle</label>
            <select
              className="input"
              value={mockLifecycle}
              onChange={(e) => setMockLifecycle(e.target.value as MockLifecycle | '')}
            >
              <option value="">— Select —</option>
              {MOCK_LIFECYCLE_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="label">Issue / Description <span className="text-rose-500">*</span></label>
            <textarea
              className="input min-h-[120px] resize-y" required
              placeholder="Concise summary, error messages, environment, steps to reproduce…"
              value={issue} onChange={(e) => setIssue(e.target.value)}
            />
          </div>

          <ToggleField
            label="Go-Live Related?"
            value={goLive} onChange={setGoLive}
            yesHint="Mark as Yes if this issue is related to a Go-Live event."
          />
          <ToggleField
            label="Production Issue?"
            value={production} onChange={setProduction}
            yesHint="Mark as Yes if this issue is occurring in PROD."
          />

          {/* Admin-only */}
          {role === 'admin' && (
            <>
              <div>
                <label className="label">Severity (admin)</label>
                <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
                  {SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Status (admin)</label>
                <select className="input" value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label">Assign To (admin)</label>
                <select
                  className="input"
                  value={assignedToId}
                  onChange={(e) => setAssignedToId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">— Unassigned —</option>
                  {admins.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} · {a.email}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Link href="/dashboard" className="btn-ghost">Cancel</Link>
            <button type="submit" className="btn-primary" disabled={submitting}>
              <Save className="h-4 w-4" /> {submitting ? 'Creating…' : 'Create ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReadonlyField({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="input bg-slate-50 text-slate-700 cursor-default select-text">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function ToggleField({
  label, value, onChange, yesHint,
}: { label: string; value: boolean; onChange: (v: boolean) => void; yesHint?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button" onClick={() => onChange(false)}
          className={`px-4 py-2 rounded-md border text-sm font-medium transition ${
            !value
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >No</button>
        <button
          type="button" onClick={() => onChange(true)}
          className={`px-4 py-2 rounded-md border text-sm font-medium transition ${
            value
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >Yes</button>
      </div>
      {yesHint && <p className="text-[11px] text-slate-500 mt-1">{yesHint}</p>}
    </div>
  );
}
