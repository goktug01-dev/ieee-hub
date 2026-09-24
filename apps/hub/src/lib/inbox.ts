import { orderBy, where } from 'firebase/firestore';
import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { hasRoleKey } from './access';
import { useCollection } from './hooks';
import { stepUnitId } from './workflow';
import type { Access, Petition, WithId } from './types';

/** Dilekçenin şu anki adımında kullanıcının onay verebileceği roller. */
export function eligibleRoles(p: Petition, access: Access | null, uid: string | undefined): string[] {
  if (p.status !== 'pending' || !p.steps || p.ownerUid === uid) return [];
  const step = p.steps[p.currentStep ?? 0];
  if (!step) return [];
  const unit = stepUnitId(step, p.unitId);
  return step.roleIds.filter((r) => hasRoleKey(access, `${unit}__${r}`));
}

/** Kullanıcının görebildiği süreçteki dilekçeler ve bunlardan onayını bekleyenler. */
export function useInbox() {
  const { access, user } = useAuth();
  const tokens = useMemo(() => (access?.tokens ?? []).slice(0, 30), [access?.tokens]);
  const roleTokens = tokens.filter((t) => t.startsWith('role:'));
  const key = tokens.join('|');

  const visible = useCollection<Petition>(
    roleTokens.length ? 'petitions' : null,
    [where('visibleTo', 'array-contains-any', tokens), where('status', '==', 'pending'), orderBy('updatedAt', 'desc')],
    key,
  );

  const waiting = useMemo<WithId<Petition>[]>(
    () => visible.data.filter((p) => eligibleRoles(p, access, user?.uid).length > 0),
    [visible.data, access, user?.uid],
  );

  return { waiting, loading: visible.loading, error: visible.error };
}
