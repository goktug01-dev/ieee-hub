import type { Timestamp } from 'firebase/firestore';
import { BRANCH, type Assignment, type WithId } from './types';

/*
 * Kurullar (Yönetim Kurulu, İdari Kurul) ve kurul oylamaları.
 * Oy sayımı tüzüğe göre yapılır:
 *  - Md. 40: YK üye tam sayısının salt çoğunluğu ile toplanır; oy eşitliğinde YK Başkanının oyu iki sayılır (altın oy).
 *  - Md. 40-EK.a: YKK (kararname) için üye tam sayısının en az üçte ikisinin kabul oyu gerekir.
 *  - Md. 46: YK Başkanı İK toplantılarına başkanlık eder; eşitlikte son söz onundur.
 *  - Md. 46-EK.a: YK + İK ortak kararlarında altın oy işlemez; eşitlikte konu Denetleme Kurulu'na havale edilir.
 *  - Md. 31: "Hem YK hem İK" onayı gereken kararlarda her kurul ayrı ayrı kabul etmelidir.
 *  - Md. 16-EK.a: Hakkında karar verilen üye oylamaya katılamaz; eşikler kalan tam sayı üzerinden hesaplanır.
 * Sayım her zaman oy pusulalarından yeniden hesaplanır; kayıtlı sonuç yalnızca anlık görüntüdür.
 */

export type BoardId = 'yk' | 'ik';
/** yk / ik: tek kurul; joint: iki kurul tek havuzda eşit oyla (Md. 30, 32); both: her kurul ayrı ayrı (Md. 31). */
export type VoteScope = BoardId | 'joint' | 'both';
/** majority: oy çokluğu; absolute: tam sayının salt çoğunluğu; twoThirds: tam sayının 2/3'ü; unanimous: oy birliği. */
export type VoteRule = 'majority' | 'absolute' | 'twoThirds' | 'unanimous';
export type BallotChoice = 'yes' | 'no' | 'abstain';

/** Kurul koltuğu: bir birimdeki rol. unitId null ise komite (birim) rolleri, hangi komitede olursa olsun. */
export interface BoardSeat {
  roleId: string;
  unitId: string | null;
}

export interface BoardConfig {
  name: string;
  shortName: string;
  seats: BoardSeat[];
  /** Tüzükteki üye tam sayısı (YK için 6). Boşsa görevdeki üye sayısı kullanılır. */
  fullSize: number | null;
}

export interface BoardsSettings {
  yk: BoardConfig;
  ik: BoardConfig;
  /** Altın oy / son söz sahibi rol anahtarı ("birim__rol"), örn. "branch__baskan". */
  chairRoleKey: string | null;
}

export const DEFAULT_BOARDS: BoardsSettings = {
  yk: {
    name: 'Yönetim Kurulu',
    shortName: 'YK',
    seats: [
      { roleId: 'baskan', unitId: BRANCH },
      { roleId: 'baskan-yardimcisi', unitId: BRANCH },
      { roleId: 'genel-sekreter', unitId: BRANCH },
      { roleId: 'sayman', unitId: BRANCH },
      { roleId: 'yk-uyesi', unitId: BRANCH },
    ],
    fullSize: 6,
  },
  ik: {
    name: 'İdari Kurul',
    shortName: 'İK',
    seats: [
      { roleId: 'birim-baskani', unitId: null },
      { roleId: 'birim-baskan-yardimcisi', unitId: null },
    ],
    fullSize: null,
  },
  chairRoleKey: `${BRANCH}__baskan`,
};

export const SCOPE_LABELS: Record<VoteScope, string> = {
  yk: 'Yönetim Kurulu',
  ik: 'İdari Kurul',
  joint: 'YK + İK ortak (tek havuz)',
  both: 'YK ve İK ayrı ayrı',
};

export const RULE_LABELS: Record<VoteRule, string> = {
  majority: 'Oy çokluğu',
  absolute: 'Salt çoğunluk (tam sayının yarısından fazlası)',
  twoThirds: 'Üçte iki (tam sayının 2/3’ü)',
  unanimous: 'Oy birliği',
};

export const CHOICE_LABELS: Record<BallotChoice, string> = { yes: 'Kabul', no: 'Ret', abstain: 'Çekimser' };

/** Oy hakkı olan kişinin oylama anındaki görev bilgisi. */
export interface RosterEntry {
  name: string;
  roleKey: string;
  roleName: string;
  unitName: string;
  boards: BoardId[];
}
export type Roster = Record<string, RosterEntry>;

export interface Ballot {
  choice: BallotChoice;
  name: string;
  at: Timestamp;
}

export interface BoardVote {
  title: string;
  description: string;
  scope: VoteScope;
  rule: VoteRule;
  /** YKK (Yönetim Kurulu Kararnamesi) ise kararname olarak işlenir. */
  isDecree: boolean;
  status: 'open' | 'closed' | 'cancelled';
  closesAt: Timestamp;
  roster: Roster;
  recusedUids: string[];
  fullSizes: Record<BoardId, number>;
  chairUid: string | null;
  meetingId: string | null;
  visibleUids: string[];
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  closedAt?: Timestamp;
  closedByName?: string;
  result?: VoteResultSnapshot;
  decisionId?: string;
}

export type BodyOutcome =
  | 'accepted'
  | 'rejected'
  | 'no_quorum'
  /** İK eşitliği: son söz YK Başkanında (Md. 46). */
  | 'tie_chair'
  /** Ortak oylamada eşitlik: Denetleme Kurulu'na havale (Md. 46-EK.a). */
  | 'tie_referred';

export interface BodyTally {
  label: string;
  fullSize: number;
  quorum: number;
  eligible: number;
  yes: number;
  no: number;
  abstain: number;
  notVoted: number;
  required: number | null;
  outcome: BodyOutcome;
  notes: string[];
}

export type VoteOutcome = BodyOutcome | 'pending';

export interface VoteTally {
  bodies: BodyTally[];
  outcome: VoteOutcome;
  summary: string;
}

export interface VoteResultSnapshot {
  outcome: VoteOutcome;
  summary: string;
  counts: { yes: number; no: number; abstain: number };
}

export const OUTCOME_LABELS: Record<VoteOutcome, string> = {
  accepted: 'Kabul edildi',
  rejected: 'Reddedildi',
  no_quorum: 'Nisap sağlanamadı',
  tie_chair: 'Eşitlik — son söz YK Başkanında',
  tie_referred: 'Eşitlik — Denetleme Kurulu’na havale',
  pending: 'Sonuçlanmadı',
};

export const OUTCOME_COLORS: Record<VoteOutcome, string> = {
  accepted: 'green',
  rejected: 'red',
  no_quorum: 'orange',
  tie_chair: 'yellow',
  tie_referred: 'yellow',
  pending: 'gray',
};

/** Salt çoğunluk: n'nin yarısından fazlası (6 → 4, 5 → 3). */
export const absoluteMajority = (n: number) => Math.floor(n / 2) + 1;
/** Üçte iki (6 → 4, 9 → 6, 10 → 7). */
export const twoThirds = (n: number) => Math.ceil((2 * n) / 3);

interface BodyInput {
  label: string;
  uids: string[];
  /** Tüzükteki tam sayı; null ise uid sayısı. */
  configuredFullSize: number | null;
  /** majority kuralında eşitlik çözümü. */
  tieBreak: 'goldenVote' | 'chair' | 'referred';
}

function tallyBody(body: BodyInput, rule: VoteRule, recused: Set<string>, ballots: Record<string, BallotChoice>, chairUid: string | null): BodyTally {
  const notes: string[] = [];
  const eligibleUids = body.uids.filter((uid) => !recused.has(uid));
  const recusedHere = body.uids.length - eligibleUids.length;
  const baseSize = Math.max(body.configuredFullSize ?? body.uids.length, body.uids.length);
  // Md. 16-EK.a: oylamaya katılamayan üye tam sayıdan düşülür.
  const fullSize = Math.max(baseSize - recusedHere, 0);
  if (recusedHere) notes.push(`${recusedHere} üye hakkında karar verildiği için oylamaya katılamaz; eşikler ${fullSize} kişi üzerinden hesaplandı (Md. 16-EK.a).`);
  if (body.configuredFullSize && body.uids.length < body.configuredFullSize) {
    notes.push(`Tam sayı ${body.configuredFullSize}; görevde ${body.uids.length} üye var. Boş koltuklar kabul oyu sayılmaz.`);
  }

  let yes = 0;
  let no = 0;
  let abstain = 0;
  for (const uid of eligibleUids) {
    const choice = ballots[uid];
    if (choice === 'yes') yes += 1;
    else if (choice === 'no') no += 1;
    else if (choice === 'abstain') abstain += 1;
  }
  const participated = yes + no + abstain;
  const quorum = absoluteMajority(fullSize);
  const base = { label: body.label, fullSize, quorum, eligible: eligibleUids.length, yes, no, abstain, notVoted: eligibleUids.length - participated };

  if (fullSize === 0) return { ...base, required: null, outcome: 'no_quorum', notes: [...notes, 'Oy kullanabilecek üye yok.'] };
  // Md. 40: kurul tam sayının salt çoğunluğu ile toplanır (katılım = kabul + ret + çekimser).
  if (participated < quorum) {
    return { ...base, required: null, outcome: 'no_quorum', notes: [...notes, `Katılım ${participated}; nisap için en az ${quorum} üyenin oy kullanması gerekir.`] };
  }

  if (rule === 'absolute' || rule === 'twoThirds' || rule === 'unanimous') {
    const required = rule === 'absolute' ? absoluteMajority(fullSize) : rule === 'twoThirds' ? twoThirds(fullSize) : fullSize;
    notes.push(`${RULE_LABELS[rule]}: en az ${required} kabul oyu gerekir.`);
    return { ...base, required, outcome: yes >= required ? 'accepted' : 'rejected', notes };
  }

  // Oy çokluğu: çekimser oylar nisaba sayılır, kabul/ret karşılaştırmasına sayılmaz.
  if (yes > no) return { ...base, required: null, outcome: 'accepted', notes };
  if (no > yes) return { ...base, required: null, outcome: 'rejected', notes };
  if (body.tieBreak === 'goldenVote') {
    const chairChoice = chairUid && eligibleUids.includes(chairUid) ? ballots[chairUid] : undefined;
    if (chairChoice === 'yes' || chairChoice === 'no') {
      notes.push(`Oylar eşit (${yes}–${no}); YK Başkanının oyu iki sayıldı (altın oy, Md. 40).`);
      return { ...base, required: null, outcome: chairChoice === 'yes' ? 'accepted' : 'rejected', notes };
    }
    notes.push(`Oylar eşit (${yes}–${no}) ve YK Başkanı kabul/ret oyu kullanmadığı için altın oy işletilemedi; karar alınamadı.`);
    return { ...base, required: null, outcome: 'rejected', notes };
  }
  if (body.tieBreak === 'chair') {
    notes.push(`Oylar eşit (${yes}–${no}); son söz YK Başkanındadır (Md. 46).`);
    return { ...base, required: null, outcome: 'tie_chair', notes };
  }
  notes.push(`Oylar eşit (${yes}–${no}); ortak oylamada altın oy işlemez, konu Denetleme Kurulu’na havale edilir (Md. 46-EK.a).`);
  return { ...base, required: null, outcome: 'tie_referred', notes };
}

type TallyInput = Pick<BoardVote, 'scope' | 'rule' | 'roster' | 'recusedUids' | 'fullSizes' | 'chairUid'>;

export function tallyVote(vote: TallyInput, ballotsByUid: Record<string, Pick<Ballot, 'choice'>>): VoteTally {
  // Yalnızca listedeki kişilerin oyları sayılır (kurallar zaten başkasının oy vermesine izin vermez).
  const ballots: Record<string, BallotChoice> = {};
  for (const [uid, ballot] of Object.entries(ballotsByUid)) if (vote.roster[uid]) ballots[uid] = ballot.choice;
  const recused = new Set(vote.recusedUids);
  const membersOf = (board: BoardId) => Object.keys(vote.roster).filter((uid) => vote.roster[uid].boards.includes(board));

  let bodies: BodyTally[];
  if (vote.scope === 'joint') {
    // Tek havuz: iki kuruldaki herkes bir oy; aynı kişi iki kurulda olsa bile tek oy (Md. 30, 32).
    const uids = Object.keys(vote.roster);
    const overlap = membersOf('yk').filter((uid) => vote.roster[uid].boards.includes('ik')).length;
    const configured = vote.fullSizes.yk + vote.fullSizes.ik - overlap;
    bodies = [tallyBody({ label: 'YK + İK ortak', uids, configuredFullSize: configured, tieBreak: 'referred' }, vote.rule, recused, ballots, vote.chairUid)];
  } else {
    const boards: BoardId[] = vote.scope === 'both' ? ['yk', 'ik'] : [vote.scope];
    bodies = boards.map((board) =>
      tallyBody(
        {
          label: board === 'yk' ? 'Yönetim Kurulu' : 'İdari Kurul',
          uids: membersOf(board),
          configuredFullSize: vote.fullSizes[board],
          // Altın oy yalnız YK'nın kendi oylamasında geçerlidir (Md. 40, 46-EK.a).
          tieBreak: board === 'yk' ? 'goldenVote' : 'chair',
        },
        vote.rule,
        recused,
        ballots,
        vote.chairUid,
      ),
    );
  }

  const outcomes = bodies.map((body) => body.outcome);
  let outcome: VoteOutcome;
  if (outcomes.length === 1) outcome = outcomes[0];
  else if (outcomes.includes('no_quorum')) outcome = 'no_quorum';
  else if (outcomes.includes('rejected')) outcome = 'rejected';
  else if (outcomes.every((item) => item === 'accepted')) outcome = 'accepted';
  else outcome = 'pending';

  const counts = bodies.map((body) => `${body.label}: ${body.yes} kabul, ${body.no} ret, ${body.abstain} çekimser`).join(' · ');
  const summary = `${OUTCOME_LABELS[outcome]} (${RULE_LABELS[vote.rule].split(' (')[0].toLowerCase()}) — ${counts}`;
  return { bodies, outcome, summary };
}

export function snapshotResult(tally: VoteTally): VoteResultSnapshot {
  const counts = tally.bodies.reduce(
    (sum, body) => ({ yes: sum.yes + body.yes, no: sum.no + body.no, abstain: sum.abstain + body.abstain }),
    { yes: 0, no: 0, abstain: 0 },
  );
  return { outcome: tally.outcome, summary: tally.summary, counts };
}

// ---------- Kurul üyeleri ----------

export const roleKeyOf = (unitId: string, roleId: string) => `${unitId}__${roleId}`;

export function seatMatches(seat: BoardSeat, assignment: Pick<Assignment, 'roleId' | 'unitId'>): boolean {
  if (seat.roleId !== assignment.roleId) return false;
  return seat.unitId === null ? assignment.unitId !== BRANCH : seat.unitId === assignment.unitId;
}

function assignmentActive(assignment: Assignment, now: number): boolean {
  return (
    assignment.status === 'active' &&
    assignment.startsAt.toMillis() <= now &&
    (!assignment.endsAt || assignment.endsAt.toMillis() > now)
  );
}

/** Görevdeki atamalardan kurul üyelerini çıkarır. Bir kişi birden çok koltukta olsa da tek kayıt olur. */
export function buildRoster(settings: BoardsSettings, assignments: WithId<Assignment>[], boards: BoardId[], now = Date.now()): Roster {
  const roster: Roster = {};
  for (const board of boards) {
    for (const assignment of assignments) {
      if (!assignmentActive(assignment, now) || !settings[board].seats.some((seat) => seatMatches(seat, assignment))) continue;
      const existing = roster[assignment.uid];
      if (existing) {
        if (!existing.boards.includes(board)) existing.boards.push(board);
        continue;
      }
      roster[assignment.uid] = {
        name: assignment.memberName,
        roleKey: roleKeyOf(assignment.unitId, assignment.roleId),
        roleName: assignment.roleName,
        unitName: assignment.unitName,
        boards: [board],
      };
    }
  }
  return roster;
}

export function boardsForScope(scope: VoteScope | 'joint'): BoardId[] {
  return scope === 'yk' || scope === 'ik' ? [scope] : ['yk', 'ik'];
}

/** Altın oy / son söz sahibi: YK üyeleri arasında başkan rolünü taşıyan kişi. */
export function findChair(settings: BoardsSettings, roster: Roster): string | null {
  if (!settings.chairRoleKey) return null;
  return Object.keys(roster).find((uid) => roster[uid].roleKey === settings.chairRoleKey && roster[uid].boards.includes('yk')) ?? null;
}

/** Karar numarası: YK-2026/007. */
export function decisionNumber(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}/${String(seq).padStart(3, '0')}`;
}

export const DECISION_PREFIX: Record<BoardId | 'joint', string> = { yk: 'YK', ik: 'İK', joint: 'İKYK' };

export interface BoardDecision {
  board: BoardId | 'joint';
  year: number;
  seq: number;
  number: string;
  counterId: string;
  kind: 'decision' | 'decree';
  date: string;
  title: string;
  text: string;
  result: string;
  source: { type: 'vote' | 'meeting' | 'manual'; id: string | null; label: string };
  correctsId: string | null;
  visibility: 'members' | 'board';
  visibleUids: string[];
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
}
