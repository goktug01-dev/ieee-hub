/** Operasyon modüllerinin (WP-01, WP-04…WP-10) veri tipleri. */
import type { Timestamp } from 'firebase/firestore';

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Task {
  code: string;
  title: string;
  description: string;
  unitId: string;
  unitName: string;
  projectId: string | null;
  eventId: string | null;
  assigneeUid: string;
  assigneeName: string;
  supporterUids: string[];
  supporterNames: string[];
  startDate: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  statusNote?: string;
  doneCriteria: string;
  fileLink: string;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt: Timestamp | null;
}

export interface TaskComment {
  byUid: string;
  byName: string;
  text: string;
  at: Timestamp;
}

export type ProjectStatus = 'planning' | 'active' | 'completed' | 'cancelled';

export interface Project {
  name: string;
  unitId: string;
  unitName: string;
  ownerUid: string;
  ownerName: string;
  goal: string;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  fileLink: string;
  closingNote: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type EventStatus =
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'planning'
  | 'registration_open'
  | 'held'
  | 'closing'
  | 'reported'
  | 'archived'
  | 'cancelled';

export interface ClosingChecklist {
  dataTransferred: boolean;
  tasksClosed: boolean;
  filesArchived: boolean;
  budgetEntered: boolean;
}

export interface EventReport {
  participantCount: number | null;
  summary: string;
  outcomes: string;
  lessons: string;
}

export interface HubEvent {
  code: string;
  name: string;
  unitId: string;
  unitName: string;
  type: string;
  description: string;
  startsAt: string | null;
  endsAt: string | null;
  location: string;
  expectedParticipants: number | null;
  status: EventStatus;
  ownerUids: string[];
  ownerNames: string[];
  petitionId: string | null;
  petitionNo: string | null;
  heptacertLink: string;
  driveLink: string;
  registrationLink: string;
  budgetPlanned: number | null;
  checklist: ClosingChecklist;
  report: EventReport;
  reportApproved: boolean;
  reportApprovedBy?: string | null;
  vtoolsStatus: 'not_required' | 'pending' | 'reported';
  decisionNote?: string;
  decidedByName?: string;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Participant {
  name: string;
  email: string;
  attended: boolean;
  certificate: string;
  extra: Record<string, string>;
  importedAt: Timestamp;
}

export interface SyncRun {
  at: Timestamp;
  by: string;
  byName: string;
  fileName: string;
  total: number;
  added: number;
  updated: number;
  duplicates: number;
  errors: number;
  errorRows: string[];
}

export type ContentStatus =
  | 'requested'
  | 'accepted'
  | 'in_production'
  | 'awaiting_approval'
  | 'scheduled'
  | 'published'
  | 'rejected'
  | 'cancelled';

export interface ContentRequest {
  requestingUnitId: string;
  requestingUnitName: string;
  requestedBy: string;
  requestedByName: string;
  type: string;
  channels: string[];
  desiredPublishDate: string | null;
  brief: string;
  draftText: string;
  assets: string;
  eventId: string | null;
  eventName: string | null;
  assigneeUid: string | null;
  assigneeName: string | null;
  status: ContentStatus;
  scheduledDate: string | null;
  publishedLink: string;
  performance: { reach: number | null; engagement: number | null };
  rejectReason: string;
  approvedByName?: string;
  approvalNote?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type SponsorStage = 'prospect' | 'contacted' | 'proposal_sent' | 'negotiating' | 'agreed' | 'declined' | 'dormant';

export interface Sponsor {
  companyName: string;
  lockKey: string;
  sector: string;
  website: string;
  stage: SponsorStage;
  ownerUid: string;
  ownerName: string;
  nextActionDate: string | null;
  nextAction: string;
  proposalLinks: string;
  eventIds: string[];
  amount: number | null;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SponsorContact {
  name: string;
  title: string;
  email: string;
}

export interface SponsorInteraction {
  date: string;
  channel: string;
  summary: string;
  nextAction: string;
  byUid: string;
  byName: string;
  at: Timestamp;
}

export interface SponsorContactRequest {
  lockKey: string;
  companyName: string;
  ownerUid: string;
  ownerName: string;
  byUid: string;
  byName: string;
  unitName: string;
  message: string;
  status: 'open' | 'approved' | 'declined';
  response?: string;
  createdAt: Timestamp;
}

export interface BudgetLine {
  label: string;
  planned: number;
  actual: number;
}

export interface Budget {
  title: string;
  scope: 'event' | 'unit';
  unitId: string;
  unitName: string;
  eventId: string | null;
  termId: string | null;
  lines: BudgetLine[];
  plannedTotal: number;
  actualTotal: number;
  sheetLink: string;
  docsLink: string;
  status: 'draft' | 'approved' | 'closed';
  updatedAt: Timestamp;
}

export interface VolunteerApplication {
  uid: string;
  name: string;
  email: string;
  unitId: string;
  unitName: string;
  motivation: string;
  availability: string;
  status: 'pending' | 'accepted' | 'rejected';
  decidedBy?: string;
  decidedByName?: string;
  decisionNote?: string;
  createdAt: Timestamp;
  decidedAt?: Timestamp;
}

export interface Handover {
  authorUid: string;
  authorName: string;
  roleId: string;
  roleName: string;
  unitId: string;
  unitName: string;
  termId: string | null;
  sections: Record<string, string>;
  status: 'draft' | 'submitted' | 'accepted';
  visibleTo: string[];
  reviewNote?: string;
  reviewedByName?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type InventoryKind = 'system' | 'access' | 'data' | 'risk';

export interface InventoryItem {
  kind: InventoryKind;
  title: string;
  fields: Record<string, string>;
  updatedAt: Timestamp;
  updatedByName: string;
}

export interface Feedback {
  byUid: string;
  byName: string;
  page: string;
  category: string;
  text: string;
  status: 'open' | 'resolved';
  response?: string;
  at: Timestamp;
}

export interface ReportSnapshot {
  type: 'weekly' | 'monthly';
  title: string;
  periodStart: string;
  periodEnd: string;
  data: Record<string, unknown>;
  status: 'draft' | 'approved';
  generatedBy: string;
  generatedByName: string;
  generatedAt: Timestamp;
  approvedByName?: string;
  approvedAt?: Timestamp;
}
