import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { hasPermission, isUnitMember } from './access';
import { useOrg } from './org';
import type { Unit, WithId } from './types';

interface UnitScopeValue {
  accessibleUnits: WithId<Unit>[];
  selectedUnitId: string | null;
  selectedUnit: WithId<Unit> | null;
  setSelectedUnitId: (id: string | null) => void;
}

const STORAGE_KEY = 'ieee-hub:selected-unit';
const UnitScopeContext = createContext<UnitScopeValue | null>(null);

export function UnitScopeProvider({ children }: { children: ReactNode }) {
  const { access } = useAuth();
  const { units } = useOrg();
  const globalView =
    !!access?.superAdmin ||
    ['org.manage', 'work.manageAll', 'events.manageAll', 'reports.read'].some((permission) => hasPermission(access, permission));
  const accessibleUnits = useMemo(
    () => units.filter((unit) => unit.active && (globalView || isUnitMember(access, unit.id))),
    [units, access, globalView],
  );
  const [selectedUnitId, setSelected] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  useEffect(() => {
    if (!accessibleUnits.length) {
      setSelected(null);
      return;
    }
    if (!selectedUnitId || !accessibleUnits.some((unit) => unit.id === selectedUnitId)) setSelected(accessibleUnits[0].id);
  }, [accessibleUnits, selectedUnitId]);

  const setSelectedUnitId = useCallback((id: string | null) => {
    setSelected(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<UnitScopeValue>(
    () => ({
      accessibleUnits,
      selectedUnitId,
      selectedUnit: accessibleUnits.find((unit) => unit.id === selectedUnitId) ?? null,
      setSelectedUnitId,
    }),
    [accessibleUnits, selectedUnitId, setSelectedUnitId],
  );

  return <UnitScopeContext.Provider value={value}>{children}</UnitScopeContext.Provider>;
}

export function useUnitScope(): UnitScopeValue {
  const value = useContext(UnitScopeContext);
  if (!value) throw new Error('useUnitScope, UnitScopeProvider dışında kullanıldı');
  return value;
}
