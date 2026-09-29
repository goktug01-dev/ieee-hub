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

export interface VToolsEventData {
  category: string;
  subcategory: string;
  locationType: 'physical' | 'virtual' | 'hybrid';
  tags: string;
  agenda: string;
  ieeeAttendees: number | null;
  guestAttendees: number | null;
  eventId: string;
  reportedAt: string | null;
  reportedBy: string;
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
  /** Eski kayıtlarda bulunmayabilir; arayüz varsayılanlarla birleştirir. */
  vtools?: VToolsEventData;
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
  source?: 'heptacert_csv';
  dataContractVersion?: string;
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
  source?: 'heptacert_csv';
  dataContractVersion?: string;
  sourceRows?: number;
  validRows?: number;
  reconciled?: boolean;
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

export type RecruitmentCallStatus = 'draft' | 'open' | 'closed' | 'archived';
export type RecruitmentQuestionType = 'short' | 'long' | 'choice' | 'boolean';

export interface RecruitmentQuestion {
  id: string;
  label: string;
  type: RecruitmentQuestionType;
  required: boolean;
  options: string[];
}

/** Komite/YK tarafından açılan tarihli gönüllü alım ilanı. */
export interface RecruitmentCall {
  unitId: string;
  unitName: string;
  title: string;
  roleTitle: string;
  summary: string;
  description: string;
  expectations: string;
  capacity: number | null;
  status: RecruitmentCallStatus;
  opensAt: Timestamp;
  closesAt: Timestamp;
  questions: RecruitmentQuestion[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** recruitmentCalls/{id}/internal/meta — ilanı açan kişi; yalnız birim yöneticileri okur. */
export interface RecruitmentCallMeta {
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
}

export type RecruitmentApplicationStatus = 'pending' | 'reviewing' | 'waitlisted' | 'accepted' | 'rejected' | 'withdrawn';

/** Kariyer vitrini üzerinden bir ilana gönderilen başvuru. */
export interface RecruitmentApplication {
  callId: string;
  callTitle: string;
  unitId: string;
  unitName: string;
  uid: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  studentNo: string;
  ieeeMemberNo: string;
  motivation: string;
  availability: string;
  answers: Record<string, string>;
  privacyConsent: true;
  /** Adayın okuduğunu beyan ettiği aydınlatma metni sürümü (privacyNotices/{id}). */
  privacyNoticeId: string;
  status: RecruitmentApplicationStatus;
  submittedAt: Timestamp;
  updatedAt: Timestamp;
  reviewedAt?: Timestamp;
  /** Adaya gösterilen karar notu. */
  decisionNote?: string;
}

/** recruitmentApplications/{id}/internal/review — son değerlendiren; aday okuyamaz. */
export interface RecruitmentReview {
  reviewedBy: string;
  reviewedByName: string;
  reviewedAt: Timestamp;
  status: Exclude<RecruitmentApplicationStatus, 'pending' | 'withdrawn'>;
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

export type AssetStatus = 'available' | 'assigned' | 'maintenance' | 'lost' | 'retired';
export type AssetCondition = 'good' | 'needs_service' | 'damaged';

export interface Asset {
  code: string;
  name: string;
  category: string;
  description: string;
  serialNo: string;
  unitId: string;
  unitName: string;
  location: string;
  status: AssetStatus;
  condition: AssetCondition;
  custodianUid: string | null;
  custodianName: string;
  purchaseDate: string | null;
  purchaseValue: number | null;
  warrantyEndDate: string | null;
  notes: string;
  lastMovementId: string;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedBy: string;
  updatedByName: string;
  updatedAt: Timestamp;
}

export type AssetMovementType = 'create' | 'update' | 'assign' | 'return' | 'move' | 'maintenance' | 'lost' | 'retire';

export interface AssetMovement {
  assetId: string;
  assetCode: string;
  assetName: string;
  type: AssetMovementType;
  note: string;
  from: { status: AssetStatus; location: string; custodianName: string } | null;
  to: { status: AssetStatus; location: string; custodianName: string };
  byUid: string;
  byName: string;
  at: Timestamp;
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

export type SecretaryLedgerKind = 'meeting' | 'board_decision' | 'unit_decision' | 'incoming' | 'outgoing' | 'follow_up' | 'note';

export interface SecretaryLedgerEntry {
  kind: SecretaryLedgerKind;
  date: string;
  referenceNo: string;
  title: string;
  unitId: string;
  unitName: string;
  summary: string;
  attendees: string;
  followUpDate: string | null;
  fileLink: string;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MeetingAgendaItem {
  id: string;
  title: string;
  notes: string;
}

export interface MeetingDecision {
  id: string;
  number: string;
  text: string;
  vote: string;
  responsible: string;
  dueDate: string | null;
}

export interface Meeting {
  unitId: string;
  unitName: string;
  title: string;
  meetingNo: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  chairName: string;
  recorderName: string;
  attendeeUids: string[];
  attendeeNames: string[];
  guestAttendees: string;
  agenda: MeetingAgendaItem[];
  decisions: MeetingDecision[];
  generalNotes: string;
  nextMeetingDate: string | null;
  status: 'draft' | 'final';
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  finalizedBy?: string;
  finalizedByName?: string;
  finalizedAt?: Timestamp;
  /** Kurul toplantısı: YK, İK veya İK-YK ortak. Birim toplantılarında yoktur. */
  boardId?: 'yk' | 'ik' | 'joint';
  /** Toplantı açılırken görevdeki kurul üyeleri (nisap hesabı için). */
  boardRoster?: import('./boards').Roster;
  /** Kurul toplantısını okuyabilecekler (kurul üyeleri + oluşturan). */
  visibleUids?: string[];
}

export interface ExternalFirebaseResource {
  id: string;
  label: string;
  database: 'firestore' | 'realtime';
  path: string;
  displayFields: string[];
  readOnly: boolean;
  /** Hazır yönetim arayüzü; boşsa genel JSON tablosu kullanılır. */
  preset?: 'points-users';
  /** Puan görünümünün RTDB sıralama önbelleği yolu. */
  leaderboardPath?: string;
  /** Yönetim işlemlerinin uzak RTDB içindeki denetim kaydı yolu. */
  auditPath?: string;
}

export type EventRestrictionLevel = 'watch' | 'blocked';

/** Dönemlerden bağımsız etkinlik katılım kısıtlaması. Gerekçe yalnız yetkili yöneticilere açıktır. */
export interface EventRestriction {
  personName: string;
  email: string;
  emailHash: string;
  level: EventRestrictionLevel;
  reason: string;
  sourceEventId: string | null;
  sourceEventName: string;
  evidenceLink: string;
  endsOn: string | null;
  reviewOn: string | null;
  active: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  liftedBy?: string;
  liftedByName?: string;
  liftedAt?: Timestamp;
  liftReason?: string;
}

/** Katılımcı içe aktarımında kullanılan, gerekçe veya kimlik taşımayan koruma indeksi. */
export interface EventRestrictionIndex {
  restrictionId: string;
  level: EventRestrictionLevel;
  expiresAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ExternalFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  databaseURL: string;
  resources: ExternalFirebaseResource[];
  updatedBy: string;
  updatedAt: Timestamp;
}
