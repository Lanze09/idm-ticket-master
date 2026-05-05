import nodemailer from 'nodemailer';
import type { TicketRow } from './types';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) return null; // No SMTP configured — fall back to console.

  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

function recipients(): string[] {
  const idm = (process.env.EMAIL_IDM_DISTRIBUTION || '').split(',').map((s) => s.trim()).filter(Boolean);
  const conv = (process.env.EMAIL_CONVERSION_DISTRIBUTION || '').split(',').map((s) => s.trim()).filter(Boolean);
  return Array.from(new Set([...idm, ...conv]));
}

export type NotificationEvent =
  | 'created'
  | 'status_changed'
  | 'updated'
  | 'severity_changed'
  | 'assigned'
  | 'escalated';

export async function sendTicketNotification(args: {
  event: NotificationEvent;
  ticket: TicketRow;
  context?: string;
}): Promise<void> {
  const subjectMap: Record<NotificationEvent, string> = {
    created: `[IDM] Ticket created — ${args.ticket.ticketNumber}`,
    status_changed: `[IDM] Status updated — ${args.ticket.ticketNumber}`,
    updated: `[IDM] Ticket updated — ${args.ticket.ticketNumber}`,
    severity_changed: `[IDM] Severity updated — ${args.ticket.ticketNumber}`,
    assigned: `[IDM] Ticket assigned — ${args.ticket.ticketNumber}`,
    escalated: `[IDM] Ticket escalated — ${args.ticket.ticketNumber}`,
  };

  const lines = [
    `Ticket Number: ${args.ticket.ticketNumber}`,
    `Issue: ${args.ticket.issue}`,
    `Status: ${args.ticket.status}`,
    `Severity: ${args.ticket.severity}`,
    `Priority: ${args.ticket.priority}`,
    `Assigned To: ${args.ticket.assignedToName || 'Not yet assigned'}`,
    `Project: ${args.ticket.projectName}`,
  ];
  if (args.context) lines.push('', args.context);

  const text = lines.join('\n');
  const tx = getTransporter();
  const to = recipients();

  if (!tx || to.length === 0) {
    // Console fallback so the dev sees notification flow.
    // eslint-disable-next-line no-console
    console.log('\n[email:mock]', subjectMap[args.event], '\nTo:', to.join(', ') || '(none)', '\n', text, '\n');
    return;
  }

  await tx.sendMail({
    from: process.env.SMTP_FROM || 'IDM Ticket Support <noreply@example.com>',
    to,
    subject: subjectMap[args.event],
    text,
  });
}
