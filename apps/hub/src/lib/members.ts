import { where } from 'firebase/firestore';
import { useMemo } from 'react';
import { useCollection } from './hooks';
import type { Member } from './types';

/** Aktif üyeler ve seçim kutuları için hazır liste. */
export function useActiveMembers(enabled = true) {
  const members = useCollection<Member>(enabled ? 'members' : null, [where('status', '==', 'active')], 'active-members');
  const options = useMemo(
    () =>
      members.data
        .map((m) => ({ value: m.uid, label: m.displayName }))
        .sort((a, b) => a.label.localeCompare(b.label, 'tr')),
    [members.data],
  );
  const nameOf = useMemo(() => {
    const map = new Map(members.data.map((m) => [m.uid, m.displayName]));
    return (uid: string) => map.get(uid) ?? '—';
  }, [members.data]);
  return { members: members.data, options, nameOf, loading: members.loading };
}
