import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  type DocumentData,
  type Query,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { WithId } from './types';

interface State<T> {
  data: T;
  loading: boolean;
  error: Error | null;
}

/** Tek bir dokümanı canlı dinler. path null ise dinlemez. */
export function useDoc<T>(path: string | null): State<WithId<T> | null> {
  const [state, setState] = useState<State<WithId<T> | null>>({ data: null, loading: !!path, error: null });

  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      doc(db, path),
      (snap) =>
        setState({
          data: snap.exists() ? ({ id: snap.id, ...(snap.data() as T) } as WithId<T>) : null,
          loading: false,
          error: null,
        }),
      (error) => setState({ data: null, loading: false, error }),
    );
  }, [path]);

  return state;
}

/**
 * Bir koleksiyonu (isteğe bağlı kısıtlarla) canlı dinler.
 * `key` kısıtlar değiştiğinde yeniden abone olmak için kullanılır.
 */
export function useCollection<T>(
  path: string | null,
  constraints: QueryConstraint[] = [],
  key = '',
): State<WithId<T>[]> {
  const [state, setState] = useState<State<WithId<T>[]>>({ data: [], loading: !!path, error: null });

  const q = useMemo<Query<DocumentData> | null>(
    () => (path ? query(collection(db, path), ...constraints) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, key],
  );

  useEffect(() => {
    if (!q) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      q,
      (snap) =>
        setState({
          data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }) as WithId<T>),
          loading: false,
          error: null,
        }),
      (error) => {
        console.error(path, error);
        setState({ data: [], loading: false, error });
      },
    );
  }, [q, path]);

  return state;
}
