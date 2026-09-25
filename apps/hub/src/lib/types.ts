import type { Timestamp } from 'firebase/firestore';

/** Kol geneli (Öğrenci Kolu) kapsamı için kullanılan sabit birim kimliği. */
export const BRANCH = 'branch';

export type WithId<T> = T & { id: string };

export type MemberStatus = 'pending' | 'active' | 'suspended' | 'left';

export interface Member {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
  phone?: string;
  department?: string;
  studentNo?: string;
  status: MemberStatus;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface Access {
  superAdmin: boolean;
  /** İzin → bitiş zamanı */
  perms: Record<string, Timestamp>;
  /** "birimId__rolId" → bitiş zamanı */
  roleKeys: Record<string, Timestamp>;
  /** Dilekçe görünürlük anahtarları (uid:…, role:…, unit:…) */
  tokens: string[];
  /** Birim kapsamlı izinler: "birimId__izin" → bitiş zamanı (alt birimlere genişletilmiş) */
  unitPerms?: Record<string, Timestamp>;
  /** Kişinin görevli olduğu birimler: birimId → bitiş zamanı (alt birimlere genişletilmiş) */
  memberOf?: Record<string, Timestamp>;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export type UnitType = 'board' | 'committee' | 'directorate' | 'department' | 'project_team' | 'other';

export interface Unit {
  name: string;
  shortCode: string;
  type: UnitType;
  parentId: string | null;
  description?: string;
  active: boolean;
  order: number;
}

export type RoleScope = 'branch' | 'unit';

export interface Role {
  name: string;
  scope: RoleScope;
  description?: string;
  permissions: string[];
  active: boolean;
  order: number;
}

export type TermStatus = 'planned' | 'active' | 'closed';

export interface Term {
  name: string;
  startsAt: Timestamp;
  endsAt: Timestamp;
  status: TermStatus;
}

export interface Assignment {
  uid: string;
  memberName: string;
  roleId: string;
  roleName: string;
  unitId: string;
  unitName: string;
  termId: string | null;
  startsAt: Timestamp;
  endsAt: Timestamp | null;
  status: 'active' | 'ended';
  source: 'manual' | 'election';
  electionId?: string | null;
  note?: string;
  createdBy: string;
  createdAt: Timestamp;
  endedAt?: Timestamp | null;
  endedBy?: string | null;
}

export interface ElectionCandidate {
  uid: string;
  name: string;
  votes: number;
}

export interface ElectionPosition {
  key: string;
  roleId: string;
  unitId: string;
  candidates: ElectionCandidate[];
  winnerUid: string | null;
}

export type ElectionStatus = 'draft' | 'completed' | 'applied';

export interface Election {
  title: string;
  termId: string | null;
  date: Timestamp | null;
  description?: string;
  status: ElectionStatus;
  positions: ElectionPosition[];
  eligibleVoters?: number | null;
  totalVotes?: number | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  appliedAt?: Timestamp | null;
}

// ---------- Dilekçe şablonları ----------

export type FieldType = 'text' | 'textarea' | 'date' | 'number' | 'select' | 'email' | 'phone';

export interface TemplateField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  help?: string;
  /** Bu alan dilekçe sahibinin profilinden otomatik doldurulur. */
  prefill?: 'displayName' | 'email' | 'phone' | 'department' | 'studentNo' | null;
}

export type StepUnitMode = 'petition' | 'branch' | 'fixed';

export interface ApprovalStep {
  name: string;
  roleIds: string[];
  unitMode: StepUnitMode;
  unitId: string | null;
}

export interface BuilderSpec {
  orgLines: string[];
  recipient: string;
  subject: string;
  body: string;
  closing: string;
  includeDocMeta: boolean;
  includeApprovals: boolean;
  includeVerification: boolean;
}

export interface TemplateContent {
  source: 'upload' | 'builder';
  fileName: string;
  sizeBytes: number;
  chunkCount: number;
  fields: TemplateField[];
  steps: ApprovalStep[];
  builder?: BuilderSpec | null;
}

export interface PetitionTemplate {
  name: string;
  description?: string;
  category?: string;
  scope: 'branch' | 'unit';
  /** Boşsa tüm birimlerde kullanılabilir (scope = unit). */
  unitIds: string[];
  series: string;
  active: boolean;
  currentVersion: number;
  latestVersion?: number;
  draft: TemplateContent | null;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
}

export interface TemplateVersion extends TemplateContent {
  version: number;
  publishedAt: Timestamp;
  publishedBy: string;
  publishedByName: string;
  changeNote?: string;
}

// ---------- Dilekçeler ----------

export type PetitionStatus = 'draft' | 'pending' | 'returned' | 'approved' | 'rejected' | 'withdrawn';

export type Decision = 'approve' | 'reject' | 'return';

export interface ApprovalRecord {
  step: number;
  stepName: string;
  revision: number;
  uid: string;
  name: string;
  roleId: string;
  roleName: string;
  unitId: string;
  unitName: string;
  decision: Decision;
  at: Timestamp;
}

export interface PetitionNote {
  approvalIndex: number;
  text: string;
}

export interface Petition {
  templateId: string;
  templateVersion: number;
  templateName: string;
  unitId: string;
  unitName: string;
  ownerUid: string;
  ownerName: string;
  title: string;
  data: Record<string, string>;
  status: PetitionStatus;
  visibleTo: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Gönderimden sonra
  steps?: ApprovalStep[];
  currentStep?: number;
  counterId?: string;
  documentSeq?: number;
  documentNo?: string;
  verificationCode?: string;
  revision?: number;
  approvals?: ApprovalRecord[];
  notes?: PetitionNote[];
  submittedAt?: Timestamp;
  completedAt?: Timestamp;
}

export interface PetitionVerification {
  petitionId: string;
  status: PetitionStatus;
  approvals: ApprovalRecord[];
  documentNo: string;
  templateName: string;
  revision: number;
  ownerMasked: string;
  unitName?: string;
  submittedAt: Timestamp;
  updatedAt: Timestamp;
}

// ---------- Ayarlar ----------

export interface PublicSettings {
  orgName: string;
  orgShortName: string;
  logoDataUrl?: string | null;
  loginNote?: string;
}

export interface OrgSettings {
  activeTermId: string | null;
  numberingPrefix: string;
  numberingPattern: string;
  verifyBaseUrl: string;
  allowedEmailDomains: string[];
  /** Gönüllü başvurusu kabul edilince atanacak birim rolü. */
  volunteerRoleId: string;
  /** Kabul edilen gönüllüye otomatik açılan oryantasyon görevleri. */
  orientationItems: string[];
  /** Şablon kataloğu ve evrak arşivinde kullanılan yönetilebilir kategoriler. */
  petitionCategories: string[];
  /** IEEE vTools Events için kolun resmî organizasyon bilgileri. */
  vtoolsOrganizationName: string;
  vtoolsSpoid: string;
  vtoolsContactEmail: string;
  vtoolsTimeZone: string;
}

export interface AuditEntry {
  at: Timestamp;
  actorUid: string;
  actorName: string;
  action: string;
  target: string;
  details?: Record<string, unknown>;
}
