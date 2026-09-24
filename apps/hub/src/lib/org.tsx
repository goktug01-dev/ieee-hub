import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { orderBy } from 'firebase/firestore';
import { useCollection } from './hooks';
import type { Role, Term, Unit, WithId } from './types';
import { BRANCH } from './types';

interface OrgData {
  units: WithId<Unit>[];
  roles: WithId<Role>[];
  terms: WithId<Term>[];
  loading: boolean;
  unitName: (id: string | null | undefined) => string;
  roleName: (id: string) => string;
  /** Seçim kutuları için birim listesi (isteğe bağlı olarak "Kol Geneli" dahil). */
  unitOptions: (opts?: { includeBranch?: boolean; onlyActive?: boolean }) => { value: string; label: string }[];
}

const OrgCtx = createContext<OrgData | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const units = useCollection<Unit>('units', [orderBy('order')], 'units');
  const roles = useCollection<Role>('roles', [orderBy('order')], 'roles');
  const terms = useCollection<Term>('terms', [orderBy('startsAt', 'desc')], 'terms');

  const value = useMemo<OrgData>(() => {
    const unitMap = new Map(units.data.map((u) => [u.id, u]));
    const roleMap = new Map(roles.data.map((r) => [r.id, r]));
    const depth = (u: WithId<Unit>): number => (u.parentId && unitMap.has(u.parentId) ? 1 + depth(unitMap.get(u.parentId)!) : 0);
    return {
      units: units.data,
      roles: roles.data,
      terms: terms.data,
      loading: units.loading || roles.loading || terms.loading,
      unitName: (id) => (!id ? '—' : id === BRANCH ? 'Kol Geneli' : (unitMap.get(id)?.name ?? id)),
      roleName: (id) => roleMap.get(id)?.name ?? id,
      unitOptions: ({ includeBranch = false, onlyActive = true } = {}) => [
        ...(includeBranch ? [{ value: BRANCH, label: 'Kol Geneli (Öğrenci Kolu)' }] : []),
        ...units.data
          .filter((u) => !onlyActive || u.active)
          .map((u) => ({ value: u.id, label: `${'— '.repeat(depth(u))}${u.name} (${u.shortCode})` })),
      ],
    };
  }, [units.data, roles.data, terms.data, units.loading, roles.loading, terms.loading]);

  return <OrgCtx.Provider value={value}>{children}</OrgCtx.Provider>;
}

export function useOrg(): OrgData {
  const v = useContext(OrgCtx);
  if (!v) throw new Error('useOrg, OrgProvider dışında kullanıldı');
  return v;
}
