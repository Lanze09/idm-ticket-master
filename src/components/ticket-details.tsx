'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeft, Save, Send, ShieldAlert, MessageSquare, History, AlertTriangle, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type {
  Activity, MockLifecycle, Role, Severity, TicketRow, TicketStatus, User,
} from '@/lib/types';
import { MOCK_LIFECYCLE_OPTIONS, SEVERITY_OPTIONS, STATUS_OPTIONS } from '@/lib/types';
import { priorityBadgeStyle, severityBadgeStyle, statusBadgeStyle } from '@/lib/priority';
import { slaIndicators } from '@/lib/sla';
import { cn } from '@/lib/utils';

type Tab = 'details' | 'activities';

export function TicketDetails({
  role,
  ticket: initialTicket,
  activities: initialActivities,
  admins,
}: {
  role: Role;
  ticket: TicketRow;
  activities: Activity[];
  admins: User[];
}) {
  const [tab, setTab] = useState<Tab>('details');
  const [ticket, setTicket] = useState<TicketRow>(initialTicket);
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [saving, setSaving] = useState(false);

  // Editable form state seeded from ticket
  const [encounteredIn, setEncounteredIn] = useState(ticket.encounteredIn);
  const [issue, setIssue] = useState(ticket.issue);
  const [goLive, setGoLive] = useState(Boolean(ticket.goLive));
  const [production, setProduction] = useState(Boolean(ticket.production));
  const [mockLifecycle, setMockLifecycle] = useState<MockLifecycle | ''>(ticket.mockLifecycle ?? '');

  const [severity, setSeverity] = useState<Severity>(ticket.severity);
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [assignedToId, setAssignedToId] = useState<number | ''>(ticket.assignedToId ?? '');
  const [escalated, setEscalated] = useState<boolean>(Boolean(ticket.escalated));

  const sla = slaIndicators(ticket);
  const isClosed = ticket.status === 'Closed';

  const userCanEditDetails = role === 'admin' || (!isClosed && ticket.createdById === ticket.createdById);
  // Note: for non-admin we still gate on ownership inside the API (createdById === session.userId).

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        encounteredIn, issue, goLive, production,
        mockLifecycle: mockLifecycle || null,
      };
      if (role === 'admin') {
        body.severity = severity;
        body.status = status;
        body.assignedToId = assignedToId === '' ? null : assignedToId;
        body.escalated = escalated;
      }
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Failed to save');
      }
      const j = await res.json();
      setTicket(j.ticket);
      // Refresh activities to pick up auto-logged system entries.
      const a = await fetch(`/api/tickets/${ticket.id}/activities`, { cache: 'no-store' });
      if (a.ok) {
        const aj = await a.json();
        setActivities(aj.activities || []);
      }
      toast.success('Ticket updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function postComment(message: string) {
    if (!message.trim()) return;
    const res = await fetch(`/api/tickets/${ticket.id}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || 'Failed to post comment');
    }
    const j = await res.json();
    setActivities((prev) => [...prev, j.activity]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <div className="flex items-center gap-2">
          <span className={cn('badge', statusBadgeStyle(ticket.status))}>{ticket.status}</span>
          <span className={cn('badge', severityBadgeStyle(ticket.severity))}>Sev: {ticket.severity}</span>
          <span className={cn('badge', priorityBadgeStyle(ticket.priority))}>Pri: {ticket.priority}</span>
          {Boolean(ticket.escalated) && (
            <span className="badge bg-purple-100 text-purple-800 border-purple-200">
              <ShieldAlert className="h-3 w-3" /> Escalated
            </span>
          )}
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-mono">{ticket.ticketNumber}</div>
            <h1 className="text-lg font-semibold tracking-tight">{ticket.encounteredIn}</h1>
          </div>
          {role === 'admin' && (
            <SlaBanner ticket={ticket} />
          )}
        </div>

        <div className="px-5 pt-3 flex items-center gap-1 border-b border-slate-100">
          <TabButton active={tab === 'details'} onClick={() => setTab('details')} icon={<Save className="h-4 w-4" />}>
            Ticket Details
          </TabButton>
          <TabButton active={tab === 'activities'} onClick={() => setTab('activities')} icon={<History className="h-4 w-4" />}>
            Activities <span className="ml-1 text-xs text-slate-500">({activities.length})</span>
          </TabButton>
        </div>

        {tab === 'details' ? (
          <DetailsTab
            role={role}
            ticket={ticket}
            isClosed={isClosed}
            sla={sla}
            admins={admins}
            saving={saving}
            onSave={save}
            // controlled inputs
            encounteredIn={encounteredIn} setEncounteredIn={setEncounteredIn}
            issue={issue} setIssue={setIssue}
            goLive={goLive} setGoLive={setGoLive}
            production={production} setProduction={setProduction}
            mockLifecycle={mockLifecycle} setMockLifecycle={setMockLifecycle}
            severity={severity} setSeverity={setSeverity}
            status={status} setStatus={setStatus}
            assignedToId={assignedToId} setAssignedToId={setAssignedToId}
            escalated={escalated} setEscalated={setEscalated}
            canEdit={userCanEditDetails}
          />
        ) : (
          <ActivitiesTab
            activities={activities}
            onPost={postComment}
            disabled={isClosed && role !== 'admin'}
          />
        )}
      </div>
    </div>
  );
}

function SlaBanner({ ticket }: { ticket: TicketRow }) {
  const sla = slaIndicators(ticket);
  if (!ticket.acknowledgedAt) {
    return (
      <div className="text-xs text-slate-500">SLA not yet started — admin acknowledgement required.</div>
    );
  }
  if (!ticket.slaExpiresAt) return null;
  const dt = format(new Date(ticket.slaExpiresAt), 'yyyy-MM-dd HH:mm');
  if (sla.riskLevel === 'expired') {
    return (
      <div className="badge bg-rose-100 text-rose-800 border-rose-200">
        <AlertTriangle className="h-3 w-3" /> SLA expired ({dt})
      </div>
    );
  }
  if (sla.riskLevel === 'warning') {
    return (
      <div className="badge bg-amber-100 text-amber-800 border-amber-200">
        <Clock className="h-3 w-3" /> Expiring soon ({dt})
      </div>
    );
  }
  return (
    <div className="badge bg-emerald-50 text-emerald-700 border-emerald-200">
      <Clock className="h-3 w-3" /> On track — expires {dt}
    </div>
  );
}

function TabButton({
  active, onClick, icon, children,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative px-3 py-2 text-sm font-medium inline-flex items-center gap-2 transition',
        active ? 'text-accenture-700' : 'text-slate-500 hover:text-slate-700',
      )}
    >
      {icon}
      {children}
      {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-accenture-500 rounded" />}
    </button>
  );
}

interface DetailsProps {
  role: Role; ticket: TicketRow; isClosed: boolean;
  sla: ReturnType<typeof slaIndicators>;
  admins: User[]; saving: boolean; onSave: () => void;
  encounteredIn: string; setEncounteredIn: (v: string) => void;
  issue: string; setIssue: (v: string) => void;
  goLive: boolean; setGoLive: (v: boolean) => void;
  production: boolean; setProduction: (v: boolean) => void;
  mockLifecycle: MockLifecycle | ''; setMockLifecycle: (v: MockLifecycle | '') => void;
  severity: Severity; setSeverity: (v: Severity) => void;
  status: TicketStatus; setStatus: (v: TicketStatus) => void;
  assignedToId: number | ''; setAssignedToId: (v: number | '') => void;
  escalated: boolean; setEscalated: (v: boolean) => void;
  canEdit: boolean;
}

function DetailsTab(p: DetailsProps) {
  const isAdmin = p.role === 'admin';
  const readonly = !p.canEdit;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 p-5">
      <div className="lg:col-span-2 space-y-4">
        <Field label="Issue / Description">
          <textarea
            className="input min-h-[120px] resize-y"
            value={p.issue}
            disabled={readonly || (p.isClosed && !isAdmin)}
            onChange={(e) => p.setIssue(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Encountered In">
            <input className="input" value={p.encounteredIn}
              disabled={readonly || (p.isClosed && !isAdmin)}
              onChange={(e) => p.setEncounteredIn(e.target.value)} />
          </Field>
          <Field label="MOCK Lifecycle">
            <select
              className="input" value={p.mockLifecycle}
              disabled={readonly || (p.isClosed && !isAdmin)}
              onChange={(e) => p.setMockLifecycle(e.target.value as MockLifecycle | '')}
            >
              <option value="">— Select —</option>
              {MOCK_LIFECYCLE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Go-Live Related">
            <ToggleInline value={p.goLive} onChange={p.setGoLive} disabled={readonly || (p.isClosed && !isAdmin)} />
          </Field>
          <Field label="Production Issue">
            <ToggleInline value={p.production} onChange={p.setProduction} disabled={readonly || (p.isClosed && !isAdmin)} />
          </Field>
        </div>
      </div>

      <aside className="space-y-3">
        <ReadonlyMeta label="Ticket Number" value={p.ticket.ticketNumber} mono />
        <ReadonlyMeta label="Project" value={`${p.ticket.projectName} (${p.ticket.projectCode})`} />
        <ReadonlyMeta label="Created By" value={`${p.ticket.createdByName} · ${p.ticket.createdByEmail}`} />
        <ReadonlyMeta label="Date Created" value={format(new Date(p.ticket.createdAt), 'yyyy-MM-dd HH:mm')} />
        <ReadonlyMeta label="Last Updated" value={format(new Date(p.ticket.updatedAt), 'yyyy-MM-dd HH:mm')} />
        {isAdmin && p.ticket.acknowledgedAt && (
          <ReadonlyMeta label="Acknowledged At" value={format(new Date(p.ticket.acknowledgedAt), 'yyyy-MM-dd HH:mm')} />
        )}

        {/* User-visible read-only severity/status when non-admin */}
        {!isAdmin && (
          <>
            <ReadonlyMeta label="Severity (set by admin)" value={p.ticket.severity} />
            <ReadonlyMeta label="Status (set by admin)" value={p.ticket.status} />
            <ReadonlyMeta label="Assigned Support" value={p.ticket.assignedToName ?? 'Not yet assigned'} />
          </>
        )}

        {/* Admin controls */}
        {isAdmin && (
          <>
            <Field label="Status">
              <select className="input" value={p.status} onChange={(e) => p.setStatus(e.target.value as TicketStatus)}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Severity">
              <select className="input" value={p.severity} onChange={(e) => p.setSeverity(e.target.value as Severity)}>
                {SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">Severity = technical complexity / impact (admin only).</p>
            </Field>
            <Field label="Assign To">
              <select
                className="input" value={p.assignedToId}
                onChange={(e) => p.setAssignedToId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">— Unassigned —</option>
                {p.admins.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} · {a.email}</option>
                ))}
              </select>
            </Field>
            <Field label="Escalation">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox" checked={p.escalated} onChange={(e) => p.setEscalated(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-accenture-600 focus:ring-accenture-500"
                />
                Mark as escalated (immune to auto-expiry)
              </label>
            </Field>
          </>
        )}

        <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
          <button onClick={p.onSave} className="btn-primary" disabled={p.saving || readonly || (p.isClosed && !isAdmin)}>
            <Save className="h-4 w-4" /> {p.saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function ReadonlyMeta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="text-sm">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
      <div className={cn('text-slate-800', mono && 'font-mono')}>{value}</div>
    </div>
  );
}

function ToggleInline({
  value, onChange, disabled,
}: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button" disabled={disabled} onClick={() => onChange(false)}
        className={cn('px-3 py-1.5 text-sm rounded-md border transition',
          !value
            ? 'bg-slate-900 text-white border-slate-900'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50')}
      >No</button>
      <button
        type="button" disabled={disabled} onClick={() => onChange(true)}
        className={cn('px-3 py-1.5 text-sm rounded-md border transition',
          value
            ? 'bg-emerald-600 text-white border-emerald-600'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50')}
      >Yes</button>
    </div>
  );
}

function ActivitiesTab({
  activities, onPost, disabled,
}: { activities: Activity[]; onPost: (m: string) => Promise<void>; disabled?: boolean }) {
  const [message, setMessage] = useState('');
  const [posting, setPosting] = useState(false);

  async function send() {
    if (!message.trim()) return;
    setPosting(true);
    try {
      await onPost(message);
      setMessage('');
      toast.success('Activity added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="p-5 space-y-4">
      <div className="space-y-2">
        {activities.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-sm">No activities yet.</div>
        ) : (
          <ul className="space-y-3">
            {activities.map((a) => (
              <li key={a.id} className={cn(
                'rounded-lg border px-4 py-3 text-sm',
                a.type === 'system'
                  ? 'border-slate-200 bg-slate-50 text-slate-700'
                  : 'border-accenture-200 bg-accenture-50/50 text-slate-800',
              )}>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span className="font-medium text-slate-700">
                    {a.type === 'system' ? 'System' : a.userName}
                  </span>
                  <span>{format(new Date(a.createdAt), 'yyyy-MM-dd HH:mm')}</span>
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">{a.message}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-slate-100 pt-4">
        <label className="label flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" /> Add your activity
        </label>
        <div className="flex gap-2 items-end">
          <textarea
            className="input min-h-[80px] resize-y flex-1"
            placeholder={disabled
              ? 'This ticket is closed.'
              : 'Investigation notes, follow-up, file/log requests…'}
            value={message} disabled={disabled || posting}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button onClick={send} className="btn-primary" disabled={disabled || posting || !message.trim()}>
            <Send className="h-4 w-4" /> {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
