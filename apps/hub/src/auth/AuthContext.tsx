import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { hasPermission } from '../lib/access';
import { useDoc } from '../lib/hooks';
import { DEFAULT_ORG_SETTINGS } from '../lib/workflow';
import type { Access, Member, OrgSettings, PublicSettings } from '../lib/types';
import type { PermissionId } from '../lib/permissions';

export type AuthPhase =
  | 'loading'
  | 'signedOut'
  | 'needsFounder' // sistemde hiç kurulum yok
  | 'needsSeed' // kurucu var, organizasyon kurulmadı
  | 'pending' // üyelik onayı bekleniyor
  | 'suspended'
  | 'active';

interface AuthValue {
  phase: AuthPhase;
  user: User | null;
  member: Member | null;
  access: Access | null;
  publicSettings: PublicSettings;
  orgSettings: OrgSettings;
  can: (perm: PermissionId) => boolean;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthValue | null>(null);

const DEFAULT_PUBLIC: PublicSettings = { orgName: 'IEEE İKÇÜ Öğrenci Kolu', orgShortName: 'IEEE İKÇÜ' };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [bootstrapped, setBootstrapped] = useState<boolean | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setAuthReady(true);
      }),
    [],
  );

  const uid = user?.uid ?? null;
  const memberState = useDoc<Member>(uid ? `members/${uid}` : null);
  const accessState = useDoc<Access>(uid ? `access/${uid}` : null);
  const publicState = useDoc<PublicSettings>('settings/public');
  const isActive = memberState.data?.status === 'active';
  const orgState = useDoc<OrgSettings>(isActive ? 'settings/org' : null);
  const setupState = useDoc<{ done: boolean }>(isActive ? 'settings/setup' : null);

  // Kurulum yapılmış mı? (system/bootstrap giriş yapmış herkese okunur)
  useEffect(() => {
    if (!uid) {
      setBootstrapped(null);
      return;
    }
    getDoc(doc(db, 'system', 'bootstrap'))
      .then((s) => setBootstrapped(s.exists()))
      .catch(() => setBootstrapped(true));
  }, [uid, memberState.data?.status]);

  // İlk girişte üyelik kaydı (onay bekleyen) otomatik oluşturulur.
  useEffect(() => {
    if (!user || memberState.loading || memberState.data || bootstrapped !== true) return;
    setDoc(doc(db, 'members', user.uid), {
      uid: user.uid,
      displayName: user.displayName ?? user.email?.split('@')[0] ?? 'Yeni üye',
      email: user.email ?? '',
      photoURL: user.photoURL ?? null,
      status: 'pending',
      createdAt: serverTimestamp(),
    }).catch((e) => console.error('Üyelik kaydı oluşturulamadı', e));
  }, [user, memberState.loading, memberState.data, bootstrapped]);

  const access = accessState.data;

  const phase: AuthPhase = useMemo(() => {
    if (!authReady) return 'loading';
    if (!user) return 'signedOut';
    if (bootstrapped === null || memberState.loading) return 'loading';
    if (!bootstrapped) return 'needsFounder';
    const m = memberState.data;
    if (!m || m.status === 'pending') return 'pending';
    if (m.status === 'suspended' || m.status === 'left') return 'suspended';
    if (setupState.loading || accessState.loading) return 'loading';
    if (!setupState.data?.done && access?.superAdmin) return 'needsSeed';
    return 'active';
  }, [authReady, user, bootstrapped, memberState, setupState, accessState.loading, access?.superAdmin]);

  const value = useMemo<AuthValue>(
    () => ({
      phase,
      user,
      member: memberState.data,
      access,
      publicSettings: { ...DEFAULT_PUBLIC, ...(publicState.data ?? {}) },
      orgSettings: { ...DEFAULT_ORG_SETTINGS, ...(orgState.data ?? {}) },
      can: (perm) => isActive && hasPermission(access, perm),
      isSuperAdmin: !!access?.superAdmin,
      signOut: () => fbSignOut(auth),
    }),
    [phase, user, memberState.data, access, publicState.data, orgState.data, isActive],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth, AuthProvider dışında kullanıldı');
  return v;
}
