import { Timestamp, collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { rebuildAccessMany } from './access';
import { auditInBatch } from './audit';
import type { Assignment } from './types';

export interface NewAssignment {
  uid: string;
  memberName: string;
  roleId: string;
  roleName: string;
  unitId: string;
  unitName: string;
  termId: string | null;
  startsAt: Timestamp;
  endsAt: Timestamp | null;
  note?: string;
  source?: 'manual' | 'election';
  electionId?: string | null;
}

/** Görev atar, isteğe bağlı olarak aynı rolün önceki sahiplerini sonlandırır, erişimleri yeniden hesaplar. */
export async function createAssignments(items: NewAssignment[], opts: { replaceExisting?: boolean } = {}) {
  const me = auth.currentUser!.uid;
  const affected = new Set<string>();
  const batch = writeBatch(db);

  if (opts.replaceExisting) {
    for (const it of items) {
      const snap = await getDocs(
        query(
          collection(db, 'assignments'),
          where('roleId', '==', it.roleId),
          where('unitId', '==', it.unitId),
          where('status', '==', 'active'),
        ),
      );
      snap.docs
        .filter((d) => (d.data() as Assignment).uid !== it.uid)
        .forEach((d) => {
          batch.update(d.ref, { status: 'ended', endedAt: serverTimestamp(), endedBy: me });
          affected.add((d.data() as Assignment).uid);
        });
    }
  }

  for (const it of items) {
    const ref = doc(collection(db, 'assignments'));
    batch.set(ref, {
      ...it,
      note: it.note ?? '',
      source: it.source ?? 'manual',
      electionId: it.electionId ?? null,
      status: 'active',
      createdBy: me,
      createdAt: serverTimestamp(),
      endedAt: null,
      endedBy: null,
    });
    affected.add(it.uid);
    auditInBatch(batch, 'assignment.create', `assignments/${ref.id}`, {
      uid: it.uid,
      memberName: it.memberName,
      role: it.roleName,
      unit: it.unitName,
    });
  }
  await batch.commit();
  return rebuildAccessMany(affected);
}

export async function endAssignments(list: (Assignment & { id: string })[], reason = '') {
  const me = auth.currentUser!.uid;
  const batch = writeBatch(db);
  for (const a of list) {
    batch.update(doc(db, 'assignments', a.id), { status: 'ended', endedAt: serverTimestamp(), endedBy: me });
    auditInBatch(batch, 'assignment.end', `assignments/${a.id}`, {
      memberName: a.memberName,
      role: a.roleName,
      unit: a.unitName,
      reason,
    });
  }
  await batch.commit();
  return rebuildAccessMany(list.map((a) => a.uid));
}
