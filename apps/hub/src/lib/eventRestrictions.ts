import { Timestamp, collection, doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { sha256Hex } from './docx';
import type { EventRestriction, EventRestrictionIndex, EventRestrictionLevel } from './opsTypes';

export interface RestrictionMatch {
  id: string;
  restrictionId: string;
  name: string;
  email: string;
  level: EventRestrictionLevel;
}

export interface NewEventRestriction {
  personName: string;
  email: string;
  level: EventRestrictionLevel;
  reason: string;
  sourceEventId: string | null;
  sourceEventName: string;
  evidenceLink: string;
  endsOn: string | null;
  reviewOn: string | null;
}

export const normalizeRestrictionEmail = (email: string) => email.trim().toLocaleLowerCase('en-US');

export async function restrictionHash(email: string) {
  const normalized = normalizeRestrictionEmail(email);
  return (await sha256Hex(new TextEncoder().encode(normalized).buffer as ArrayBuffer)).slice(0, 32);
}

export function restrictionIsCurrent(index: Pick<EventRestrictionIndex, 'expiresAt'>, now = Date.now()) {
  return index.expiresAt.toMillis() > now;
}

function expiresAt(endsOn: string | null) {
  if (!endsOn) return Timestamp.fromDate(new Date('9999-12-31T23:59:59.000Z'));
  return Timestamp.fromDate(new Date(`${endsOn}T23:59:59+03:00`));
}

function actor() {
  const user = auth.currentUser;
  if (!user) throw new Error('Oturum kapalı.');
  return { uid: user.uid, name: user.displayName ?? user.email ?? '' };
}

export async function addEventRestriction(input: NewEventRestriction) {
  const who = actor();
  const email = normalizeRestrictionEmail(input.email);
  if (!input.personName.trim() || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Kişi adı ve geçerli e-posta zorunludur.');
  if (input.reason.trim().length < 10) throw new Error('Somut olay ve gerekçe en az 10 karakter olmalıdır.');
  if (input.endsOn && input.endsOn < new Date().toISOString().slice(0, 10)) throw new Error('Bitiş tarihi geçmişte olamaz.');

  const emailHash = await restrictionHash(email);
  const restrictionRef = doc(collection(db, 'eventRestrictions'));
  const indexRef = doc(db, 'eventRestrictionIndex', emailHash);
  const auditRef = doc(collection(db, 'auditLog'));
  const expiry = expiresAt(input.endsOn);
  await runTransaction(db, async (transaction) => {
    const current = await transaction.get(indexRef);
    if (current.exists() && restrictionIsCurrent(current.data() as EventRestrictionIndex)) throw new Error('Bu kişi için zaten etkin bir kısıtlama var.');
    transaction.set(restrictionRef, {
      personName: input.personName.trim(), email, emailHash, level: input.level, reason: input.reason.trim(),
      sourceEventId: input.sourceEventId, sourceEventName: input.sourceEventName.trim(), evidenceLink: input.evidenceLink.trim(),
      endsOn: input.endsOn, reviewOn: input.reviewOn, active: true,
      createdBy: who.uid, createdByName: who.name, createdAt: serverTimestamp(),
    } satisfies Omit<EventRestriction, 'createdAt'> & { createdAt: unknown });
    transaction.set(indexRef, { restrictionId: restrictionRef.id, level: input.level, expiresAt: expiry, updatedAt: serverTimestamp() });
    transaction.set(auditRef, { at: serverTimestamp(), actorUid: who.uid, actorName: who.name, action: 'eventRestriction.create', target: `eventRestrictions/${restrictionRef.id}`, details: { level: input.level, sourceEventId: input.sourceEventId, endsOn: input.endsOn } });
  });
  return restrictionRef.id;
}

export async function liftEventRestriction(restrictionId: string, emailHash: string, reason: string) {
  const who = actor();
  if (reason.trim().length < 5) throw new Error('Kaldırma gerekçesi zorunludur.');
  const restrictionRef = doc(db, 'eventRestrictions', restrictionId);
  const indexRef = doc(db, 'eventRestrictionIndex', emailHash);
  const auditRef = doc(collection(db, 'auditLog'));
  await runTransaction(db, async (transaction) => {
    const [restriction, index] = await Promise.all([transaction.get(restrictionRef), transaction.get(indexRef)]);
    if (!restriction.exists() || restriction.data().active !== true) throw new Error('Etkin kısıtlama bulunamadı.');
    transaction.update(restrictionRef, { active: false, liftedBy: who.uid, liftedByName: who.name, liftedAt: serverTimestamp(), liftReason: reason.trim() });
    if (index.exists() && index.data().restrictionId === restrictionId) transaction.delete(indexRef);
    transaction.set(auditRef, { at: serverTimestamp(), actorUid: who.uid, actorName: who.name, action: 'eventRestriction.lift', target: `eventRestrictions/${restrictionId}`, details: { reason: reason.trim() } });
  });
}

export async function findParticipantRestrictions(rows: Array<{ name: string; email: string }>): Promise<RestrictionMatch[]> {
  const identities = await Promise.all(rows.map(async (row) => ({ ...row, email: normalizeRestrictionEmail(row.email), id: await restrictionHash(row.email) })));
  const unique = [...new Map(identities.map((item) => [item.id, item])).values()];
  const matches = await Promise.all(unique.map(async (item) => {
    const snapshot = await getDoc(doc(db, 'eventRestrictionIndex', item.id));
    if (!snapshot.exists()) return null;
    const index = snapshot.data() as EventRestrictionIndex;
    if (!restrictionIsCurrent(index)) return null;
    return { ...item, restrictionId: index.restrictionId, level: index.level } satisfies RestrictionMatch;
  }));
  return matches.filter((item): item is RestrictionMatch => item !== null);
}
