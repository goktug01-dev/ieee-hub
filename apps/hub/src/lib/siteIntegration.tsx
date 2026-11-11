import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { Alert, Button, Group, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { useAuth } from '../auth/AuthContext';
import { db } from '../firebase';
import { useDoc } from './hooks';
import { connectExternalEmail, connectExternalGoogle, disconnectExternal, externalServices } from './externalFirebase';
import { hasPermission } from './access';
import { publishSiteSource, siteOperator, siteAnnouncementManager, siteQrController, type SiteKind } from './siteWorkflow';
import type { ExternalFirebaseConfig } from './opsTypes';
import { notifyError } from '../components/ui';

interface SiteContextValue { config: ExternalFirebaseConfig | null; user: User | null; busy: boolean; error: string; pending: number; retry: () => void; }
const SiteContext = createContext<SiteContextValue>({ config: null, user: null, busy: false, error: '', pending: 0, retry: () => {} });
export const useSite = () => useContext(SiteContext);

export function SiteIntegrationProvider({ children }: { children: ReactNode }) {
  const { access, user: hubUser } = useAuth();
  const permitted = siteOperator(access);
  const stored = useDoc<ExternalFirebaseConfig>(permitted ? 'externalIntegrations/firebase' : null);
  const config = stored.data;
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState({ busy: false, error: '', pending: 0 });
  const [retry, setRetry] = useState(0);
  const key = config ? [config.projectId, config.apiKey, config.databaseURL, config.authDomain, config.appId].join('|') : '';
  useEffect(() => {
    setUser(null);
    if (!config?.apiKey || !config.databaseURL) return;
    try { const remoteAuth = externalServices(config).auth; const stop = onAuthStateChanged(remoteAuth, setUser); return () => { stop(); void signOut(remoteAuth).catch(() => {}); }; }
    catch (error) { setState({ busy: false, pending: 0, error: String(error) }); }
  }, [key]);
  const canEvents = hasPermission(access, 'events.approve') || hasPermission(access, 'external.firebase.manage');
  const canAnnouncements = siteAnnouncementManager(access);
  const canQr = siteQrController(access);
  useEffect(() => {
    if (!config || !user || !hubUser) { setState({ busy: false, error: '', pending: 0 }); return; }
    let cancelled = false, running = false;
    const queue = new Map<string, { kind: SiteKind; id: string; version: string }>();
    const completed = new Map<string, string>();
    const qrExpiries = new Map<string, number>();
    const eventEnds = new Map<string, number>();
    const run = async () => {
      if (running || cancelled) return;
      running = true;
      let error = '';
      if (queue.size) setState({ busy: true, error: '', pending: queue.size });
      for (const [jobKey, job] of [...queue]) {
        if (cancelled) break;
        try {
          await publishSiteSource(config, job.kind, job.id);
          completed.set(jobKey, job.version);
          if (queue.get(jobKey)?.version === job.version) queue.delete(jobKey);
        } catch (e) { error = e instanceof Error ? e.message : 'Site aktarımı başarısız.'; }
      }
      running = false;
      if (!cancelled) setState({ busy: false, error, pending: queue.size });
      if (!cancelled && !error && queue.size) window.setTimeout(() => void run(), 0);
    };
    const watch = (path: string, kind: SiteKind) => onSnapshot(collection(db, path), { includeMetadataChanges: true }, snapshot => {
      if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
      for (const change of snapshot.docChanges({ includeMetadataChanges: true })) {
        if (change.type === 'removed') continue;
        const d = change.doc.data(), id = change.doc.id;
        if (kind === 'event' && canQr) { if (d.endsAt) eventEnds.set(id, Date.parse(d.endsAt)); else eventEnds.delete(id); }
        if (kind === 'event' && !canEvents) continue;
        if (kind === 'qr') { if (d.status === 'requested') continue; qrExpiries.set(id, d.expiresAt.toMillis()); }
        const version = `${d.updatedAt?.toMillis()}:${kind === 'qr' && d.expiresAt.toMillis() <= Date.now() ? 'expired' : ''}`;
        const jobKey = `${kind}__${id}`;
        if (completed.get(jobKey) !== version) queue.set(jobKey, { kind, id, version });
      }
      // Etkinlik iptali/bitişi ACTOR oturumunda QR'ı da kapatır.
      if (kind === 'event' && canQr) for (const [id] of qrExpiries) queue.set(`qr__${id}`, { kind: 'qr', id, version: `event-${Date.now()}` });
      void run();
    }, e => { if (!cancelled) setState(s => ({ ...s, error: e.message })); });
    const stops = [canEvents || canQr ? watch('events', 'event') : null, canAnnouncements ? watch('siteAnnouncements', 'announcement') : null, canQr ? watch('eventPointRequests', 'qr') : null].filter(Boolean);
    const timer = window.setInterval(() => {
      for (const [id, expiresAt] of qrExpiries) if (Math.min(expiresAt, eventEnds.get(id) || Infinity) <= Date.now()) {
        const jobKey = `qr__${id}`, version = 'expired';
        if (completed.get(jobKey) !== version) queue.set(jobKey, { kind: 'qr', id, version });
      }
      void run();
    }, 60000);
    const online = () => void run();
    window.addEventListener('online', online);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('online', online); stops.forEach(stop => stop!()); };
  }, [key, user?.uid, hubUser?.uid, canEvents, canAnnouncements, canQr, retry, config?.siteEventsPath, config?.siteAnnouncementsPath, config?.siteQrPath, JSON.stringify(config?.siteUnitMap)]);
  return <SiteContext.Provider value={{ config, user, ...state, error: stored.error?.message || state.error, retry: () => setRetry(x => x + 1) }}>{children}</SiteContext.Provider>;
}

export function SiteConnection() {
  const { config, user, busy, error, pending, retry } = useSite();
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false), [emailOpen, setEmailOpen] = useState(false);
  const connect = async (google: boolean) => {
    if (!config) return;
    setConnecting(true);
    try { if (google) await connectExternalGoogle(config); else { await connectExternalEmail(config, email, password); setPassword(''); } }
    catch (e) { notifyError(e); } finally { setConnecting(false); }
  };
  return <Alert color={error ? 'red' : user ? 'teal' : 'yellow'} title="Web sitesi bağlantısı"><Stack gap="xs">
    {!config ? <Text size="sm">TechOps web sitesi bağlantısını yapılandırmalı.</Text> : !user ? <><Text size="sm">Site hesabınızla bir kez bağlanın. Hub onayları ve duyurular bu oturum açıkken otomatik aktarılır; bekleyenler yeniden bağlanınca gönderilir.</Text><Group><Button size="xs" loading={connecting} onClick={() => void connect(true)}>Site hesabımla bağlan</Button><Button size="xs" variant="subtle" onClick={() => setEmailOpen(x => !x)}>E-posta ile giriş</Button></Group>{emailOpen && <Group align="end"><TextInput label="Site e-postası" value={email} onChange={e => setEmail(e.currentTarget.value)} /><PasswordInput label="Şifre" value={password} onChange={e => setPassword(e.currentTarget.value)} /><Button onClick={() => void connect(false)} loading={connecting} disabled={!email || !password}>Bağlan</Button></Group>}</> : <Group justify="space-between"><Text size="sm">{user.email} · {busy ? 'Siteye aktarılıyor…' : pending ? `${pending} kayıt aktarım bekliyor` : 'Otomatik aktarım açık'}</Text><Group><Button size="xs" variant="light" onClick={retry}>Yeniden dene</Button><Button size="xs" variant="subtle" onClick={() => void disconnectExternal(config!).catch(notifyError)}>Bağlantıyı kes</Button></Group></Group>}
    {error && <Text size="sm">{error}</Text>}
  </Stack></Alert>;
}
