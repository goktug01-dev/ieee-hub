import { where } from 'firebase/firestore';
import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { DEFAULT_BOARDS, buildRoster, type BoardsSettings } from './boards';
import { useCollection, useDoc } from './hooks';
import type { Assignment } from './types';

/** settings/boards (arayüzden düzenlenir) + tüzüğe göre varsayılanlar. */
export function useBoardsSettings(): { settings: BoardsSettings; loading: boolean } {
  const state = useDoc<Partial<BoardsSettings>>('settings/boards');
  return useMemo(() => {
    const data: Partial<BoardsSettings> = state.data ?? {};
    return {
      settings: {
        yk: { ...DEFAULT_BOARDS.yk, ...(data.yk ?? {}) },
        ik: { ...DEFAULT_BOARDS.ik, ...(data.ik ?? {}) },
        chairRoleKey: data.chairRoleKey !== undefined ? data.chairRoleKey : DEFAULT_BOARDS.chairRoleKey,
      },
      loading: state.loading,
    };
  }, [state.data, state.loading]);
}

export function useActiveAssignments() {
  return useCollection<Assignment>('assignments', [where('status', '==', 'active')], 'boards-active-assignments');
}

/** Oturumdaki kişinin kurul üyelikleri ve kurul yöneticisi (Genel Sekreter / organizasyon) olup olmadığı. */
export function useBoardAccess() {
  const { user, can } = useAuth();
  const { settings, loading } = useBoardsSettings();
  const assignments = useActiveAssignments();
  const roster = useMemo(() => buildRoster(settings, assignments.data, ['yk', 'ik']), [settings, assignments.data]);
  const mine = user ? roster[user.uid] : undefined;
  return {
    settings,
    assignments: assignments.data,
    roster,
    loading: loading || assignments.loading,
    isAdmin: can('secretary.ledger.manage') || can('org.manage'),
    canManageMeetings: can('secretary.ledger.manage'),
    myBoards: mine?.boards ?? [],
  };
}
