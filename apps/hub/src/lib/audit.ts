import { addDoc, collection, serverTimestamp, type WriteBatch, doc } from 'firebase/firestore';
import { auth, db } from '../firebase';

function entry(action: string, target: string, details?: Record<string, unknown>) {
  const u = auth.currentUser;
  return {
    at: serverTimestamp(),
    actorUid: u?.uid ?? '',
    actorName: u?.displayName ?? u?.email ?? '',
    action,
    target,
    details: details ?? {},
  };
}

/** Denetim kaydına ekler. Kayıt başarısız olsa bile asıl işlemi bozmaz. */
export async function logAudit(action: string, target: string, details?: Record<string, unknown>) {
  try {
    await addDoc(collection(db, 'auditLog'), entry(action, target, details));
  } catch (e) {
    console.warn('Denetim kaydı yazılamadı', e);
  }
}

/** Asıl işlemle aynı batch içinde denetim kaydı ekler (ya ikisi de yazılır ya hiçbiri). */
export function auditInBatch(batch: WriteBatch, action: string, target: string, details?: Record<string, unknown>) {
  batch.set(doc(collection(db, 'auditLog')), entry(action, target, details));
}
