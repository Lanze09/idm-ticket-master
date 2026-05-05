'use client';

import Link from 'next/link';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { AlertTriangle, Clock, Flame, Rocket, ShieldAlert } from 'lucide-react';
import type { Role, TicketRow } from '@/lib/types';
import { priorityBadgeStyle, severityBadgeStyle, statusBadgeStyle } from '@/lib/priority';
import { slaIndicators } from '@/lib/sla';
import { cn } from '@/lib/utils';

export function TicketTable({
  role,
  tickets,
  loading,
}: {
  role: Role;
  tickets: TicketRow[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="py-16 text-center text-slate-500 text-sm">Loading tickets…</div>
    );
  }
  if (!tickets.length) {
    return (
      <div className="py-16 text-center text-slate-500 text-sm">
        No tickets to show. Try clearing filters or creating a new ticket.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] tracking-wide">
          <tr>
            <th className="text-left font-semibold px-3 py-2.5">Ticket #</th>
            <th className="text-left font-semibold px-3 py-2.5">Encountered In</th>
            <th className="text-left font-semibold px-3 py-2.5 min-w-[260px]">Issue</th>
            <th className="text-left font-semibold px-3 py-2.5">Status</th>
            <th className="text-left font-semibold px-3 py-2.5">Date Created</th>
            <th className="text-left font-semibold px-3 py-2.5">Severity</th>
            <th className="text-left font-semibold px-3 py-2.5">Priority</th>
            <th className="text-left font-semibold px-3 py-2.5">Created By</th>
            <th className="text-left font-semibold px-3 py-2.5">Assigned To</th>
            <th className="text-left font-semibold px-3 py-2.5">Mock</th>
            <th className="text-left font-semibold px-3 py-2.5">Prod / Go-Live</th>
            {role === 'admin' && (
              <>
                <th className="text-left font-semibold px-3 py-2.5">Project</th>
                <th className="text-left font-semibold px-3 py-2.5">SLA Expiry</th>
                <th className="text-left font-semibold px-3 py-2.5">Risk</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {tickets.map((t) => (
            <TicketRowItem key={t.id} ticket={t} role={role} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TicketRowItem({ ticket, role }: { ticket: TicketRow; role: Role }) {
  const sla = slaIndicators(ticket);
  return (
    <tr className="hover:bg-slate-50/60 transition">
      <td className="px-3 py-2.5">
        <Link
          href={`/dashboard/tickets/${ticket.id}`}
          className="font-mono text-accenture-700 hover:underline"
        >
          {ticket.ticketNumber}
        </Link>
      </td>
      <td className="px-3 py-2.5 text-slate-700">{ticket.encounteredIn}</td>
      <td className="px-3 py-2.5 text-slate-700 max-w-md truncate" title={ticket.issue}>{ticket.issue}</td>
      <td className="px-3 py-2.5">
        <span className={cn('badge', statusBadgeStyle(ticket.status))}>{ticket.status}</span>
      </td>
      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
        {format(new Date(ticket.createdAt), 'yyyy-MM-dd HH:mm')}
      </td>
      <td className="px-3 py-2.5">
        <span className={cn('badge', severityBadgeStyle(ticket.severity))}>{ticket.severity}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className={cn('badge', priorityBadgeStyle(ticket.priority))}>{ticket.priority}</span>
      </td>
      <td className="px-3 py-2.5 text-slate-700">{ticket.createdByName}</td>
      <td className="px-3 py-2.5 text-slate-700">
        {ticket.assignedToName ?? <span className="text-slate-400 italic">unassigned</span>}
      </td>
      <td className="px-3 py-2.5 text-slate-600">
        {ticket.mockLifecycle ?? <span className="text-slate-400">—</span>}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex gap-1">
          {ticket.production ? (
            <span className="badge bg-rose-100 text-rose-800 border-rose-200" title="Production">
              <Flame className="h-3 w-3" /> P
            </span>
          ) : null}
          {ticket.goLive ? (
            <span className="badge bg-amber-100 text-amber-800 border-amber-200" title="Go-Live">
              <Rocket className="h-3 w-3" /> G
            </span>
          ) : null}
          {!ticket.production && !ticket.goLive && <span className="text-slate-400">—</span>}
        </div>
      </td>
      {role === 'admin' && (
        <>
          <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{ticket.projectCode}</td>
          <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
            {ticket.slaExpiresAt
              ? format(new Date(ticket.slaExpiresAt), 'yyyy-MM-dd HH:mm')
              : <span className="text-slate-400">—</span>}
          </td>
          <td className="px-3 py-2.5">
            {ticket.escalated ? (
              <span className="badge bg-purple-100 text-purple-800 border-purple-200" title="Escalated">
                <ShieldAlert className="h-3 w-3" /> Escalated
              </span>
            ) : sla.riskLevel === 'expired' ? (
              <span className="badge bg-rose-100 text-rose-800 border-rose-200">
                <AlertTriangle className="h-3 w-3" /> Expired
              </span>
            ) : sla.riskLevel === 'warning' ? (
              <span className="badge bg-amber-100 text-amber-800 border-amber-200">
                <Clock className="h-3 w-3" /> {ticket.slaExpiresAt
                  ? formatDistanceToNowStrict(new Date(ticket.slaExpiresAt), { addSuffix: true })
                  : 'Soon'}
              </span>
            ) : sla.riskLevel === 'ok' ? (
              <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200">On track</span>
            ) : (
              <span className="text-slate-400 text-xs">Not started</span>
            )}
          </td>
        </>
      )}
    </tr>
  );
}
