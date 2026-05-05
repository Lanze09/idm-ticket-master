export type Role = 'admin' | 'user';

export type TicketStatus = 'New' | 'Open' | 'Pending' | 'On-Hold' | 'Closed';

export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';

export type Priority = 'Low' | 'Medium' | 'High';

export type MockLifecycle =
  | 'Mock0' | 'Mock1' | 'Mock2' | 'Mock3' | 'Mock4'
  | 'Mock5' | 'Mock6' | 'Mock7' | 'Mock8' | 'Mock9'
  | 'PRE-SIT' | 'SIT' | 'UAT' | 'RECON' | 'PROD';

export const MOCK_LIFECYCLE_OPTIONS: MockLifecycle[] = [
  'Mock0', 'Mock1', 'Mock2', 'Mock3', 'Mock4',
  'Mock5', 'Mock6', 'Mock7', 'Mock8', 'Mock9',
  'PRE-SIT', 'SIT', 'UAT', 'RECON', 'PROD',
];

export const SEVERITY_OPTIONS: Severity[] = ['Low', 'Medium', 'High', 'Critical'];
export const STATUS_OPTIONS: TicketStatus[] = ['New', 'Open', 'Pending', 'On-Hold', 'Closed'];

export interface Project {
  id: number;
  code: string;
  name: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface UserWithProjects extends User {
  projects: Project[];
}

export interface Ticket {
  id: number;
  ticketNumber: string;
  projectId: number;
  createdById: number;
  encounteredIn: string;
  issue: string;
  goLive: 0 | 1;
  production: 0 | 1;
  mockLifecycle: MockLifecycle | null;
  status: TicketStatus;
  severity: Severity;
  priority: Priority;
  assignedToId: number | null;
  escalated: 0 | 1;
  acknowledgedAt: string | null;   // ISO timestamp
  slaPausedAt: string | null;
  slaAccumulatedPausedMs: number;
  slaExpiresAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketRow extends Ticket {
  projectCode: string;
  projectName: string;
  createdByName: string;
  createdByEmail: string;
  assignedToName: string | null;
  assignedToEmail: string | null;
}

export interface Activity {
  id: number;
  ticketId: number;
  userId: number;
  userName: string;
  type: 'comment' | 'system';
  message: string;
  createdAt: string;
}

export interface SessionPayload {
  userId: number;
  email: string;
  name: string;
  role: Role;
}
