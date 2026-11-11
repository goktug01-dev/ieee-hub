import type { Timestamp } from 'firebase/firestore';

export type StatutoryAuthority = 'subject' | 'committee' | 'yk' | 'ik' | 'joint' | 'audit' | 'advisor' | 'president' | 'secretary' | 'finance' | 'actor' | 'techops' | 'external' | 'technical' | 'assembly';
export interface StatutoryStage {
  label: string;
  authority: StatutoryAuthority;
  proof: 'document' | 'board_vote' | 'election' | 'assembly';
  days: number;
  businessDays: boolean;
  voteRule?: 'majority' | 'absolute' | 'twoThirds' | 'unanimous';
  assemblyRound?: number;
}
export interface StatutoryFlow {
  label: string;
  articles: string;
  description: string;
  confidential: boolean;
  stages: StatutoryStage[];
  effect: 'record' | 'suspend' | 'actor_suspend' | 'candidate_ban' | 'committee_passive' | 'committee_closed' | 'actor_elected' | 'restore';
  implicitApproval: false;
}
export interface StatutoryPolicy {
  name: string;
  roles: Record<string, string>;
  holidays: string[];
  flows: Record<string, StatutoryFlow>;
  limits: { archiveDays: number; boardMeetingDays: number; weeklyReportDays: number; digitalHandoverHours: number; actorHandoverDays: number; technicalHandoverDays: number; electionHandoverDays: number; activityHandoverDays: number; retentionYears: number; reservePercent: number; boardAbsences: number; consecutiveAbsences: number; assemblyMinimumSecond: number };
  publishedBy: string;
  publishedAt: Timestamp;
}
export interface StatutoryCase {
  kind: string; title: string; summary: string; subjectUid: string | null; unitId: string;
  policyId: string; confidential: boolean; step: number;
  proposal: { termId: string; threshold: number; inclusive: boolean; spendPercent: number; affectedArticles: string[] };
  status: 'open' | 'approved' | 'rejected' | 'cancelled';
  createdBy: string; createdAt: Timestamp; updatedAt: Timestamp;
  stageStartedAt: Timestamp; appliedAt?: Timestamp; appliedBy?: string;
  sourceCaseId?: string;
}
export interface StatutoryAction {
  caseId: string; step: number; authority: StatutoryAuthority; actorUid: string;
  decision: 'approve' | 'reject'; note: string; proofId: string; proofUrl: string; at: Timestamp;
}
export interface GovernanceHold {
  caseId: string; uid: string; scope: 'all' | 'actor'; expiresAt: Timestamp;
  byUid: string; at: Timestamp;
}
export interface ActivityYear {
  title: string; termId: string; threshold: number; inclusive: boolean; spendPercent: number;
  caseId: string; status: 'published'; startsAt: Timestamp; endsAt: Timestamp;
  createdBy: string; createdAt: Timestamp;
}
export interface AnnualActivity {
  uid: string; yearId: string; siteUid: string; annualXp: number; balance: number;
  registered: boolean; reachable: boolean; priorAdministrativeTerm: boolean; ieeeActive: boolean;
  status: 'actor_verified' | 'final'; actorUid: string; actorAt: Timestamp;
  auditUid?: string; auditAt?: Timestamp; note: string;
}
export interface AssemblyRecord {
  caseId: string; round: number; previousId: string | null; heldAt: Timestamp;
  totalMembers: number; attendance: number; yes: number; no: number; abstain: number;
  minutesUrl: string; createdBy: string; createdAt: Timestamp;
}
export interface StatutoryObligation {
  id: string; title: string; article: string; owner: string; dueAt: number;
  severity: 'overdue' | 'upcoming' | 'review'; link: string; detail: string;
}
