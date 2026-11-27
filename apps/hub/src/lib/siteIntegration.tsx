import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Accordion, Alert, Badge, Button, Code, CopyButton, Group, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { db } from '../firebase';
import { useDoc } from './hooks';
import { connectExternalEmail, connectExternalGoogle, disconnectExternal, externalServices, readSiteAccess } from './externalFirebase';
import { hasPermission } from './access';
import { publishSiteSource, siteOperator, siteAnnouncementManager, siteQrController, type SiteKind } from './siteWorkflow';
import type { ExternalFirebaseConfig } from './opsTypes';
import { externalConfigIssues, SITE_CAPABILITIES, siteCapabilityState, siteConnectionError, type SiteAccessInfo, type SiteCapability } from './siteConnection';

interface SiteContextValue { config: ExternalFirebaseConfig | null; configLoading: boolean; user: User | null; busy: boolean; error: string; pending: number; retry: () => void; siteAccess: SiteAccessInfo | null; accessLoading: boolean; accessError: string; lastSyncAt: number | null; }
const SiteContext = createContext<SiteContextValue>({ config: null, configLoading: false, user: null, busy: false, error: '', pending: 0, retry: () => {}, siteAccess: null, accessLoading: false, accessError: '', lastSyncAt: null });
export const useSite = () => useContext(SiteContext);

export function SiteIntegrationProvider({ children }: { children: ReactNode }) {
  const { access, user: hubUser } = useAuth();
  const permitted = siteOperator(access);
  const stored = useDoc<ExternalFirebaseConfig>(permitted ? 'externalIntegrations/firebase' : null);
  const config = stored.data;
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState({ busy: false, error: '', pending: 0, lastSyncAt: null as number | null });
  const [siteAccess, setSiteAccess] = useState<SiteAccessInfo | null>(null);
  const [accessLoading, setAccessLoading] = useState(false), [accessError, setAccessError] = useState('');
  const [retry, setRetry] = useState(0);
  const key = config ? [config.projectId, config.apiKey, config.databaseURL, config.authDomain, config.appId].join('|') : '';
  useEffect(() => {
    setUser(null);
    if (externalConfigIssues(config).length) return;
    // StrictMode deneme temizliği veya herkese açık bir sayfaya geçiş, site oturumunu kapatmamalı.
    try { return onAuthStateChanged(externalServices(config!).auth, setUser); }
    catch (error) { setState({ busy: false, pending: 0, error: siteConnectionError(error), lastSyncAt: null }); }
  }, [key]);
  useEffect(() => {
    setSiteAccess(null); setAccessError(''); setAccessLoading(false);
    if (!config?.databaseURL || !user) return;
    let cancelled = false;
    const check = async () => {
      setAccessLoading(true);
      try { const result = await readSiteAccess(config, user.uid); if (!cancelled) { setSiteAccess(result); setAccessError(''); } }
      catch (error) { if (!cancelled) { setSiteAccess(null); setAccessError(siteConnectionError(error)); } }
      finally { if (!cancelled) setAccessLoading(false); }
    };
    void check();
    const timer = window.setInterval(() => void check(), 30000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [key, user?.uid, retry]);
  const canEvents = hasPermission(access, 'events.approve') || hasPermission(access, 'external.firebase.manage');
  const canAnnouncements = siteAnnouncementManager(access);
  const canQr = siteQrController(access);
  useEffect(() => {
    if (!config?.databaseURL || !user || !hubUser) { setState({ busy: false, error: '', pending: 0, lastSyncAt: null }); return; }
    let cancelled = false, running = false;
    const queue = new Map<string, { kind: SiteKind; id: string; version: string }>();
    const completed = new Map<string, string>();
    const qrExpiries = new Map<string, number>();
    const eventEnds = new Map<string, number>();
    const run = async () => {
      if (running || cancelled) return;
      running = true;
      let error = '';
      let succeeded = false;
      if (queue.size) setState(current => ({ ...current, busy: true, error: '', pending: queue.size }));
      for (const [jobKey, job] of [...queue]) {
        if (cancelled) break;
        if (job.kind === 'qr' && siteCapabilityState(siteAccess, 'qr') !== 'allowed') continue;
        try {
          await publishSiteSource(config, job.kind, job.id);
          succeeded = true;
          completed.set(jobKey, job.version);
          if (queue.get(jobKey)?.version === job.version) queue.delete(jobKey);
        } catch (e) { error = siteConnectionError(e); }
      }
      running = false;
      if (!cancelled) setState(current => ({ busy: false, error, pending: queue.size, lastSyncAt: succeeded ? Date.now() : current.lastSyncAt }));
      const runnable = [...queue.values()].some(job => job.kind !== 'qr' || siteCapabilityState(siteAccess, 'qr') === 'allowed');
      if (!cancelled && !error && runnable) window.setTimeout(() => void run(), 0);
    };
    const watch = (path: string, kind: SiteKind) => onSnapshot(collection(db, path), { includeMetadataChanges: true }, snapshot => {
      if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
      for (const change of snapshot.docChanges({ includeMetadataChanges: true })) {
        if (change.type === 'removed') continue;
        const d = change.doc.data(), id = change.doc.id;
        if (kind === 'event' && canQr) { if (d.endsAt) eventEnds.set(id, Date.parse(d.endsAt)); else eventEnds.delete(id); }
        if (kind === 'event' && !canEvents) continue;
        if (kind === 'qr') { if (!['approved', 'closed'].includes(d.status)) continue; qrExpiries.set(id, d.expiresAt.toMillis()); }
        const version = `${d.updatedAt?.toMillis()}:${kind === 'qr' && d.expiresAt.toMillis() <= Date.now() ? 'expired' : ''}`;
        const jobKey = `${kind}__${id}`;
        if (completed.get(jobKey) !== version) queue.set(jobKey, { kind, id, version });
      }
      // Etkinlik iptali/bitişi ACTOR oturumunda QR'ı da kapatır.
      if (kind === 'event' && canQr) for (const [id] of qrExpiries) queue.set(`qr__${id}`, { kind: 'qr', id, version: `event-${Date.now()}` });
      void run();
    }, e => { if (!cancelled) setState(s => ({ ...s, error: siteConnectionError(e) })); });
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
  }, [key, user?.uid, hubUser?.uid, canEvents, canAnnouncements, canQr, retry, config?.siteEventsPath, config?.siteAnnouncementsPath, config?.siteQrPath, JSON.stringify(config?.siteUnitMap), JSON.stringify(siteAccess)]);
  return <SiteContext.Provider value={{ config, configLoading: stored.loading, user, ...state, error: stored.error?.message || state.error, siteAccess, accessLoading, accessError, retry: () => setRetry(x => x + 1) }}>{children}</SiteContext.Provider>;
}

export function SiteConnection({ capability }: { capability?: SiteCapability }) {
  const { config, configLoading, user, busy, error, pending, retry, siteAccess, accessLoading, accessError, lastSyncAt } = useSite();
  const { can, user: hubUser } = useAuth();
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false), [emailOpen, setEmailOpen] = useState(false);
  const [loginError, setLoginError] = useState('');
  const connect = async (google: boolean) => {
    if (!config) return;
    setConnecting(true); setLoginError('');
    try { if (google) await connectExternalGoogle(config); else { await connectExternalEmail(config, email, password); setPassword(''); } }
    catch (e) { setLoginError(siteConnectionError(e)); } finally { setConnecting(false); }
  };
  const issues = externalConfigIssues(config);
  const permission = capability ? siteCapabilityState(siteAccess, capability) : null;
  const ready = !!user && !!config?.databaseURL && (capability ? permission === 'allowed' : (Object.keys(SITE_CAPABILITIES) as SiteCapability[]).some(item => siteCapabilityState(siteAccess, item) === 'allowed'));
  const support = user && config ? `Hub site bağlantısı\nSite projesi: ${config.projectId}\nSite hesabı: ${user.email ?? ''}\nSite UID: ${user.uid}\nHub adresi: ${window.location.origin}\nİşlem: ${capability ? SITE_CAPABILITIES[capability] : 'Web sitesi bağlantısı'}\nDurum: ${accessError || error || permission || 'Bağlı'}` : '';
  return <Alert color={error || loginError ? 'red' : ready ? 'teal' : 'yellow'} title="Web sitesi bağlantısı"><Stack gap="sm">
    <Text size="sm">Studentbranches profil/puan hesabınızı bağlayın. Bu, Hub girişinizden ve IEEE vTools hesabınızdan ayrı bir oturumdur.</Text>
    {configLoading ? <Text size="sm">Bağlantı ayarı yükleniyor…</Text> : issues.length ? <><Text size="sm">{issues.join(' ')}</Text>{can('external.firebase.manage') && <Button component={Link} to="/yonetim/harici-firebase?sekme=kurulum" size="xs" variant="light">Site bağlantısını kur</Button>}</> : !user ? <>
      <Group><Button size="xs" loading={connecting} onClick={() => void connect(true)}>Site hesabımla bağlan</Button><Button size="xs" variant="subtle" onClick={() => setEmailOpen(x => !x)}>E-posta ile giriş</Button></Group>
      {emailOpen && <form onSubmit={e => { e.preventDefault(); if (email && password) void connect(false); }}><Stack gap="xs"><Text size="sm">Studentbranches profil/puan sayfasında kullandığınız e-posta ve şifreyi girin.</Text><Group align="end" wrap="wrap"><TextInput label="Site e-postası" type="email" autoComplete="username" w={{ base: '100%', sm: 280 }} value={email} onChange={e => setEmail(e.currentTarget.value)} /><PasswordInput label="Site şifresi" autoComplete="current-password" w={{ base: '100%', sm: 220 }} value={password} onChange={e => setPassword(e.currentTarget.value)} /><Button type="submit" loading={connecting} disabled={!email || !password}>Bağlan</Button></Group></Stack></form>}
    </> : <>
      <Group gap="xs"><Badge color="teal">Site girişi tamam</Badge><Text size="sm" fw={600}>{user.email ?? user.displayName}</Text></Group>
      {hubUser?.email !== user.email && <Text size="sm">Hub ve site için farklı hesaplar kullanıyorsunuz. Site yetkisi yukarıdaki hesaba aittir.</Text>}
      {!config?.databaseURL ? <Text size="sm">Web sitesi Realtime Database adresi eksik. TechOps bağlantı kurulumunu tamamlamalı.</Text> : accessLoading ? <Text size="sm">Site işlem yetkileri kontrol ediliyor…</Text> : accessError ? <Text size="sm">{accessError}</Text> : <Group gap="xs">{(capability ? [capability] : Object.keys(SITE_CAPABILITIES) as SiteCapability[]).map(item => { const state = siteCapabilityState(siteAccess, item); return <Badge key={item} color={state === 'allowed' ? 'teal' : 'orange'}>{SITE_CAPABILITIES[item]}: {state === 'allowed' ? 'Yetkili' : state === 'expired' ? 'Süresi dolmuş' : state === 'missing' ? 'Yetki eksik' : 'Kontrol edilemedi'}</Badge>; })}</Group>}
      {capability && !accessLoading && (permission === 'missing' || permission === 'expired') && <Text size="sm">{permission === 'expired' ? 'Site işlem yetkinizin süresi dolmuş.' : 'Hub göreviniz var; bu site hesabına işlem yetkisi henüz verilmemiş.'} Site yöneticisi hesabınıza {SITE_CAPABILITIES[capability]} yetkisini görev bitişine kadar vermeli. Aşağıdan bağlantı bilgisini kopyalayıp TechOps’a iletebilirsiniz.</Text>}
      <Text size="sm">{busy ? 'Kayıtlar siteye aktarılıyor…' : pending ? `${pending} kayıt siteye aktarım bekliyor.` : lastSyncAt ? `Son başarılı aktarım: ${new Date(lastSyncAt).toLocaleTimeString('tr-TR')}` : ready ? 'Bağlantı hazır. Aktarım sonucu her kaydın yanında ayrıca gösterilir.' : 'Giriş yapmak tek başına aktarım yetkisi vermez.'}</Text>
      <Group><Button size="xs" variant="light" onClick={retry} loading={accessLoading}>Yetkiyi ve aktarımı kontrol et</Button><Button size="xs" variant="subtle" onClick={() => void disconnectExternal(config!).catch(e => setLoginError(siteConnectionError(e)))}>Farklı site hesabıyla bağlan</Button></Group>
      <Accordion variant="contained"><Accordion.Item value="details"><Accordion.Control>TechOps’a iletilecek bağlantı bilgisi</Accordion.Control><Accordion.Panel><Stack gap="xs"><Text size="sm">Site hesabı kimliği: <Code style={{ overflowWrap: 'anywhere' }}>{user.uid}</Code></Text><Text size="sm">Proje: {config?.projectId}</Text><CopyButton value={support}>{({ copied, copy }) => <Button size="xs" variant="default" onClick={copy}>{copied ? 'Kopyalandı' : 'Bağlantı bilgisini kopyala'}</Button>}</CopyButton></Stack></Accordion.Panel></Accordion.Item></Accordion>
    </>}
    {(error || loginError) && <Text size="sm">{loginError || error}</Text>}
  </Stack></Alert>;
}
