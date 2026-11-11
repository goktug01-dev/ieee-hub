import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where, writeBatch, type DocumentReference, type DocumentData } from 'firebase/firestore';
import { auth, db } from '../firebase';

export interface MailSettings {
  enabled: boolean;
  workerUid: string;
  senderEmail: string;
  hubUrl: string;
  maxPerRun: number;
  maxPerDay: number;
}
export const DEFAULT_MAIL_SETTINGS: MailSettings = {
  enabled: false, workerUid: '', senderEmail: 'techopsieee@gmail.com',
  hubUrl: 'https://ieee-hub-techops.web.app', maxPerRun: 20, maxPerDay: 200,
};
export interface MailRecipient { email: string; petitions: boolean; tasks: boolean; }

/** Alıcı ve içerik yazılmaz; yürütücü kaynağı ve güncel yetkiyi kendisi çözer. */
export function queueMail(writer: { set(ref: DocumentReference, data: DocumentData): unknown }, kind: 'petition' | 'task', sourceId: string) {
  writer.set(doc(db, 'mailSignals', `${kind}_${sourceId}`), {
    kind, sourceId, sourceVersion: serverTimestamp(), queuedAt: serverTimestamp(), readyAt: serverTimestamp(), state: 'pending',
  });
}

export async function registerMailRecipient() {
  const user = auth.currentUser;
  if (!user?.emailVerified || !user.email) return;
  await user.getIdToken(true);
  const target = doc(db, 'mailRecipients', user.uid);
  await runTransaction(db, async tx => {
    const current = await tx.get(target);
    if (!current.exists()) tx.set(target, { email: user.email, petitions: true, tasks: true, updatedAt: serverTimestamp() });
    else if (current.data().email !== user.email) tx.update(target, { email: user.email, updatedAt: serverTimestamp() });
  });
}

/** Eski bekleyen kayıtları yetkili yöneticinin açık işlemiyle kuyruğa ekler. */
export async function queuePendingMail(): Promise<number> {
  const petitions = await getDocs(query(collection(db, 'petitions'), where('status', '==', 'pending')));
  const tasks = await getDocs(query(collection(db, 'tasks'), where('status', 'in', ['todo', 'in_progress', 'blocked'])));
  const items = [...petitions.docs.map(d => ({ kind: 'petition' as const, d })), ...tasks.docs.map(d => ({ kind: 'task' as const, d }))];
  for (let offset = 0; offset < items.length; offset += 10) {
    const batch = writeBatch(db);
    for (const { kind, d } of items.slice(offset, offset + 10)) batch.set(doc(db, 'mailSignals', `${kind}_${d.id}`), {
      kind, sourceId: d.id, sourceVersion: d.data().updatedAt, queuedAt: serverTimestamp(), readyAt: serverTimestamp(), state: 'pending',
    });
    await batch.commit();
  }
  return items.length;
}
