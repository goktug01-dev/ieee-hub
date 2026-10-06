import { Timestamp, doc, getDocs, collection, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { logAudit } from './audit';
import {
  DECISION_PREFIX,
  buildRoster,
  boardsForScope,
  decisionNumber,
  findChair,
  snapshotResult,
  tallyVote,
  type Ballot,
  type BallotChoice,
  type BoardDecision,
  type BoardId,
  type BoardVote,
  type BoardsSettings,
  type Roster,
  type VoteRule,
  type VoteScope,
} from './boards';
import type { Assignment, WithId } from './types';

function who() {
  const user = auth.currentUser;
  if (!user) throw new Error('Bu işlem için giriş yapmalısınız.');
  return { uid: user.uid, name: user.displayName ?? user.email ?? '' };
}

export interface NewVoteInput {
  title: string;
  description: string;
  scope: VoteScope;
  rule: VoteRule;
  isDecree: boolean;
  closesAt: Date;
  recusedUids: string[];
  meetingId: string | null;
}

/** Oylamayı açar; oy hakkı listesi o anki görev atamalarından alınır ve oylama boyunca değişmez. */
export async function createBoardVote(settings: BoardsSettings, assignments: WithId<Assignment>[], input: NewVoteInput): Promise<string> {
  const me = who();
  if (!input.title.trim()) throw new Error('Oylama konusu girin.');
  if (input.closesAt.getTime() <= Date.now() + 60_000) throw new Error('Bitiş zamanı en az bir dakika sonrası olmalı.');
  if (input.isDecree && (input.scope !== 'yk' || input.rule !== 'twoThirds')) throw new Error('YKK yalnız Yönetim Kurulu’nun üçte iki oyuyla çıkarılabilir.');
  const roster = buildRoster(settings, assignments, boardsForScope(input.scope));
  if (!Object.keys(roster).length) throw new Error('Bu kurulda görevde üye bulunamadı. Kurul ayarlarını ve görev atamalarını kontrol edin.');
  const recusedUids = input.recusedUids.filter((uid) => roster[uid]);
  const fullSizes: Record<BoardId, number> = {
    yk: settings.yk.fullSize ?? Object.values(roster).filter((entry) => entry.boards.includes('yk')).length,
    ik: settings.ik.fullSize ?? Object.values(roster).filter((entry) => entry.boards.includes('ik')).length,
  };
  const ref = doc(collection(db, 'boardVotes'));
  await setDoc(ref, {
    title: input.title.trim(),
    description: input.description.trim(),
    scope: input.scope,
    rule: input.rule,
    isDecree: input.isDecree,
    status: 'open',
    closesAt: Timestamp.fromDate(input.closesAt),
    roster,
    recusedUids,
    fullSizes,
    chairUid: findChair(settings, roster),
    meetingId: input.meetingId,
    visibleUids: [...new Set([...Object.keys(roster), me.uid])],
    createdBy: me.uid,
    createdByName: me.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAudit('board.vote.open', ref.path, { title: input.title.trim(), scope: input.scope, rule: input.rule });
  return ref.id;
}

export async function castBallot(voteId: string, choice: BallotChoice, name: string) {
  const me = who();
  await setDoc(doc(db, 'boardVotes', voteId, 'ballots', me.uid), { choice, name, at: serverTimestamp() });
}

export async function loadBallots(voteId: string): Promise<Record<string, Ballot>> {
  const snap = await getDocs(collection(db, 'boardVotes', voteId, 'ballots'));
  return Object.fromEntries(snap.docs.map((item) => [item.id, item.data() as Ballot]));
}

/** Oylamayı kapatır; sonuç oy pusulalarından hesaplanıp anlık görüntü olarak saklanır. */
export async function closeBoardVote(vote: WithId<BoardVote>) {
  const me = who();
  const ballots = await loadBallots(vote.id);
  const result = snapshotResult(tallyVote(vote, ballots));
  await updateDoc(doc(db, 'boardVotes', vote.id), {
    status: 'closed',
    closedAt: serverTimestamp(),
    closedByName: me.name,
    result,
    updatedAt: serverTimestamp(),
  });
  await logAudit('board.vote.close', `boardVotes/${vote.id}`, { outcome: result.outcome });
  return result;
}

export async function cancelBoardVote(vote: WithId<BoardVote>) {
  const me = who();
  await updateDoc(doc(db, 'boardVotes', vote.id), { status: 'cancelled', closedAt: serverTimestamp(), closedByName: me.name, updatedAt: serverTimestamp() });
  await logAudit('board.vote.cancel', `boardVotes/${vote.id}`, { title: vote.title });
}

export interface DecisionInput {
  board: BoardId | 'joint';
  kind: 'decision' | 'decree';
  date: string;
  title: string;
  text: string;
  result: string;
  source: BoardDecision['source'];
  correctsId: string | null;
  visibility: 'members' | 'board';
  visibleUids: string[];
}

/**
 * Karar defterine numaralı kayıt ekler. Sayaç işlem içinde +1 artırılır; kurallar numaranın
 * boşluksuz ve tekrarsız ilerlemesini, kaydın sonradan değiştirilmemesini zorunlu kılar.
 * Aynı toplantı kararı veya oylama iki kez işlenemez (belge kimliği kaynaktan türetilir).
 */
export async function recordDecision(input: DecisionInput, decisionId?: string): Promise<{ id: string; number: string }> {
  const me = who();
  if (!input.title.trim() || !input.text.trim()) throw new Error('Karar başlığı ve metni zorunludur.');
  const year = Number(input.date.slice(0, 4));
  if (!year) throw new Error('Karar tarihini girin.');
  const counterId = `${input.board}_${year}`;
  const ref = decisionId ? doc(db, 'boardDecisions', decisionId) : doc(collection(db, 'boardDecisions'));
  const counterRef = doc(db, 'decisionCounters', counterId);
  const number = await runTransaction(db, async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists()) throw new Error(`Bu kayıt karar defterine zaten işlenmiş (${existing.data().number}).`);
    const counter = await tx.get(counterRef);
    const seq = (counter.exists() ? (counter.data().value as number) : 0) + 1;
    const num = decisionNumber(DECISION_PREFIX[input.board], year, seq);
    tx.set(counterRef, { value: seq, lastDecisionId: ref.id });
    tx.set(ref, {
      board: input.board,
      year,
      seq,
      number: num,
      counterId,
      kind: input.kind,
      date: input.date,
      title: input.title.trim(),
      text: input.text.trim(),
      result: input.result.trim(),
      source: input.source,
      correctsId: input.correctsId,
      visibility: input.visibility,
      visibleUids: input.visibleUids,
      createdBy: me.uid,
      createdByName: me.name,
      createdAt: serverTimestamp(),
    });
    if (input.source.type === 'vote' && input.source.id) {
      tx.update(doc(db, 'boardVotes', input.source.id), { decisionId: ref.id, updatedAt: serverTimestamp() });
    }
    return num;
  });
  await logAudit('board.decision.record', ref.path, { number, board: input.board });
  return { id: ref.id, number };
}

export const voteDecisionId = (voteId: string) => `v_${voteId}`;
export const meetingDecisionId = (meetingId: string, itemId: string) => `m_${meetingId}_${itemId}`;

export function rosterUids(roster: Roster): string[] {
  return Object.keys(roster);
}
