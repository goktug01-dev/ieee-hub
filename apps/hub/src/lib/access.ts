import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Access, Assignment, Role, Unit, WithId } from './types';

/** Süresiz atamalar için kullanılan uzak bitiş zamanı. */
export const FAR_FUTURE = Timestamp.fromDate(new Date('2100-01-01T00:00:00Z'));

function later(a: Timestamp | undefined, b: Timestamp): Timestamp {
  return !a || b.toMillis() > a.toMillis() ? b : a;
}

/** Bir birim ve tüm alt birimlerinin kimlikleri. */
export function descendantsOf(unitId: string, units: WithId<Unit>[]): string[] {
  const out = [unitId];
  const queue = [unitId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const u of units) {
      if (u.parentId === cur && !out.includes(u.id)) {
        out.push(u.id);
        queue.push(u.id);
      }
    }
  }
  return out;
}

/**
 * Kişinin aktif görev atamalarından erişim özetini hesaplar.
 * Saf fonksiyondur; test edilebilir.
 */
export function computeAccess(
  uid: string,
  assignments: Assignment[],
  roles: Record<string, Role>,
  units: WithId<Unit>[],
  now = Date.now(),
): Pick<Access, 'perms' | 'roleKeys' | 'tokens'> {
  const perms: Record<string, Timestamp> = {};
  const roleKeys: Record<string, Timestamp> = {};
  const tokens = new Set<string>([`uid:${uid}`]);

  for (const a of assignments) {
    if (a.status !== 'active') continue;
    if (a.startsAt && a.startsAt.toMillis() > now) continue;
    if (a.endsAt && a.endsAt.toMillis() <= now) continue;
    const role = roles[a.roleId];
    if (!role || !role.active) continue;
    const exp = a.endsAt ?? FAR_FUTURE;
    const key = `${a.unitId}__${a.roleId}`;
    roleKeys[key] = later(roleKeys[key], exp);
    tokens.add(`role:${key}`);

    for (const p of role.permissions) {
      if (p === 'unit.petitions.read') {
        const scope = a.unitId === 'branch' ? ['branch'] : descendantsOf(a.unitId, units);
        scope.forEach((u) => tokens.add(`unit:${u}`));
      } else if (!p.startsWith('unit.')) {
        perms[p] = later(perms[p], exp);
      }
    }
  }

  return { perms, roleKeys, tokens: [...tokens] };
}

/** Kişinin erişim özetini Firestore'daki güncel atamalardan yeniden yazar. */
export async function rebuildAccess(uid: string): Promise<void> {
  const [asgSnap, rolesSnap, unitsSnap, currentSnap] = await Promise.all([
    getDocs(query(collection(db, 'assignments'), where('uid', '==', uid), where('status', '==', 'active'))),
    getDocs(collection(db, 'roles')),
    getDocs(collection(db, 'units')),
    getDoc(doc(db, 'access', uid)),
  ]);
  const roles = Object.fromEntries(rolesSnap.docs.map((d) => [d.id, d.data() as Role]));
  const units = unitsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Unit) }));
  const computed = computeAccess(
    uid,
    asgSnap.docs.map((d) => d.data() as Assignment),
    roles,
    units,
  );
  const superAdmin = currentSnap.exists() ? !!(currentSnap.data() as Access).superAdmin : false;
  await setDoc(doc(db, 'access', uid), {
    superAdmin,
    ...computed,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid ?? '',
  });
}

/** Birden çok kişinin erişim özetini sırayla yeniden hesaplar. */
export async function rebuildAccessMany(uids: Iterable<string>): Promise<{ ok: number; failed: string[] }> {
  let ok = 0;
  const failed: string[] = [];
  for (const uid of new Set(uids)) {
    try {
      await rebuildAccess(uid);
      ok++;
    } catch (e) {
      console.error('rebuildAccess', uid, e);
      failed.push(uid);
    }
  }
  return { ok, failed };
}

export function hasPermission(access: Access | null, perm: string): boolean {
  if (!access) return false;
  if (access.superAdmin) return true;
  const exp = access.perms?.[perm];
  return !!exp && exp.toMillis() > Date.now();
}

export function hasRoleKey(access: Access | null, key: string): boolean {
  const exp = access?.roleKeys?.[key];
  return !!exp && exp.toMillis() > Date.now();
}
