import { Accordion, Tabs, ActionIcon, Alert, Badge, Button, Card, Checkbox, Code, Group, Modal, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Table, Text, TextInput, Textarea, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconDownload, IconEdit, IconPlus, IconRefresh, IconRestore, IconTrash, IconUserCheck, IconUserX } from '@tabler/icons-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { SiteConnection, useSite } from '../../lib/siteIntegration';
import { externalConfigIssues, siteConnectionError } from '../../lib/siteConnection';
import { siteQrController } from '../../lib/siteWorkflow';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, ErrorAlert, PageHeader, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { db } from '../../firebase';
import {
  deleteExternalRecord,
  fieldValue,
  externalPointUserIssues,
  parseExternalData,
  readExternalPointUsers,
  readExternalResource,
  resetExternalConnection,
  stringifyExternalData,
  writeExternalRecord,
  writeExternalPointChanges,
  writeExternalMembershipChanges,
  type ExternalPointUser,
  type ExternalRecord,
} from '../../lib/externalFirebase';
import { useDoc } from '../../lib/hooks';
import type { ExternalFirebaseConfig, ExternalFirebaseResource } from '../../lib/opsTypes';
import { downloadText, toCsv } from '../../lib/ops';
import { SiteRecordFields, siteFields, siteKind } from './SiteRecordFields';
import QRCode from 'qrcode';
import { SiteSetupPanel } from './SiteSetupPanel';

type ConfigDraft = Omit<ExternalFirebaseConfig, 'updatedAt' | 'updatedBy'>;
const emptyConfig = (): ConfigDraft => ({ apiKey: '', authDomain: '', projectId: '', appId: '', databaseURL: '', resources: [] });
const resourceId = () => crypto.randomUUID();

export function ExternalFirebasePage() {
  const { user, access, can } = useAuth();
  const { user: externalUser } = useSite();
  const [params, setParams] = useSearchParams();
  const tab = ['kurulum', 'veriler'].includes(params.get('sekme') ?? '') ? params.get('sekme')! : 'baglanti';
  const setTab = (value: string | null) => setParams(value && value !== 'baglanti' ? { sekme: value } : {});
  const stored = useDoc<ExternalFirebaseConfig>('externalIntegrations/firebase');
  const [configDraft, setConfigDraft] = useState<ConfigDraft>(emptyConfig());
  const [configDirty, setConfigDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [records, setRecords] = useState<ExternalRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [resourceError, setResourceError] = useState<Error | null>(null);
  const [editor, setEditor] = useState<{ originalId: string | null; id: string; json: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [committeeId, setCommitteeId] = useState('');
  const [qrImage, setQrImage] = useState<string | null>(null);
  const connectionKey = stored.data ? [stored.data.projectId, stored.data.apiKey, stored.data.authDomain, stored.data.appId, stored.data.databaseURL].join('|') : '';

  useEffect(() => {
    if (stored.data && !configDirty) {
      setConfigDraft({ apiKey: stored.data.apiKey, authDomain: stored.data.authDomain, projectId: stored.data.projectId, appId: stored.data.appId, databaseURL: stored.data.databaseURL ?? '', resources: stored.data.resources ?? [], siteEventsPath: stored.data.siteEventsPath || 'events', siteAnnouncementsPath: stored.data.siteAnnouncementsPath || 'public_announcements', siteQrPath: stored.data.siteQrPath || 'valid_qrs', siteQrUrlTemplate: stored.data.siteQrUrlTemplate || 'https://studentbranches.ieee.org/tr-ikcu/profile/?qr_id={qrId}', siteUnitMap: stored.data.siteUnitMap || {} });
      setSelectedId((current) => current ?? stored.data!.resources?.[0]?.id ?? null);
    }
  }, [stored.data, configDirty]);

  const configured = !!stored.data?.apiKey && !!stored.data?.projectId && !!stored.data?.appId;
  const selected = stored.data?.resources?.find((item) => item.id === selectedId) ?? null;
  useEffect(() => { setEditor(null); setQrImage(null); }, [selectedId, externalUser?.uid, connectionKey]);

  const load = async () => {
    if (!stored.data || !selected || selected.preset === 'points-users') return;
    setLoadingRecords(true); setResourceError(null);
    try { setRecords(await readExternalResource(stored.data, selected)); }
    catch (error) { setRecords([]); setResourceError(error as Error); }
    finally { setLoadingRecords(false); }
  };
  useEffect(() => { if (tab === 'veriler' && externalUser && selected && selected.preset !== 'points-users') void load(); else setRecords([]); }, [tab, externalUser?.uid, selected?.id, connectionKey]);

  const updateConfig = <K extends keyof ConfigDraft>(key: K, value: ConfigDraft[K]) => { setConfigDraft((current) => ({ ...current, [key]: value })); setConfigDirty(true); };
  const updateResource = (index: number, patch: Partial<ExternalFirebaseResource>) => updateConfig('resources', configDraft.resources.map((item, i) => i === index ? { ...item, ...patch } : item));
  const saveConfig = async () => {
    const issues = externalConfigIssues(configDraft);
    if (issues.length) return notifyError(new Error(issues.join(' ')));
    if (configDraft.resources.some((item) => !item.label.trim() || !item.path.trim())) return notifyError(new Error('Her veri görünümünün adı ve yolu dolu olmalı.'));
    setBusy(true);
    try {
      const previousConnection = stored.data ? [stored.data.projectId, stored.data.apiKey, stored.data.authDomain, stored.data.appId, stored.data.databaseURL].join('|') : '';
      const nextConnection = [configDraft.projectId, configDraft.apiKey, configDraft.authDomain, configDraft.appId, configDraft.databaseURL].join('|');
      if (stored.data?.projectId && previousConnection !== nextConnection) await resetExternalConnection(stored.data.projectId);
      await setDoc(doc(db, 'externalIntegrations', 'firebase'), { ...configDraft, updatedBy: user!.uid, updatedAt: serverTimestamp() });
      setConfigDirty(false);
      notifySuccess('Web sitesi bağlantı ayarı kaydedildi.');
    } catch (error) { notifyError(error); } finally { setBusy(false); }
  };

  const saveRecord = async () => {
    if (!stored.data || !selected || !editor) return;
    setBusy(true);
    try {
      if (editor.originalId && editor.originalId !== editor.id) throw new Error('Mevcut kaydın kimliği değiştirilemez. Yeni kayıt oluşturun.');
      const data = parseExternalData(editor.json);
      const kind = selected.database === 'realtime' ? siteKind(selected.path) : null;
      if (kind === 'events' && !editor.originalId) data.id = editor.id;
      if (kind) for (const field of siteFields[kind]) {
        if (field.required && (data[field.key] === undefined || data[field.key] === '')) throw new Error(`${field.label} zorunludur.`);
      }
      await writeExternalRecord(stored.data, selected, editor.id, data);
      setEditor(null); await load(); notifySuccess('Harici kayıt kaydedildi.');
    } catch (error) { notifyError(error); } finally { setBusy(false); }
  };
  const removeRecord = (record: ExternalRecord) => {
    if (!stored.data || !selected) return;
    modals.openConfirmModal({ title: 'Harici kayıt silinsin mi?', children: <Text size="sm"><Code>{selected.path}/{record.id}</Code> uzak Firebase projesinden kalıcı olarak silinir.</Text>, labels: { confirm: 'Kalıcı sil', cancel: 'Vazgeç' }, confirmProps: { color: 'red' }, onConfirm: () => deleteExternalRecord(stored.data!, selected, record.id).then(load).then(() => notifySuccess('Harici kayıt silindi.')).catch(notifyError) });
  };

  const columns = useMemo(() => selected?.displayFields?.filter(Boolean) ?? [], [selected]);
  const formKind = selected?.database === 'realtime' ? siteKind(selected.path) : null;
  const addSiteViews = () => {
    if (!committeeId.trim() || /[.#$\[\]/]/.test(committeeId)) return notifyError(new Error('Geçerli bir komite kimliği girin.'));
    const paths = ['committees', 'public_announcements', 'events', 'technical_events', `committee_announcements/${committeeId.trim()}`, `committee_qrs/${committeeId.trim()}`];
    const labels = ['Komiteler', 'Site duyuruları', 'Site etkinlikleri', 'Teknik etkinlikler', 'Komite duyuruları', 'Komite puan QR’ları'];
    updateConfig('resources', [...configDraft.resources, ...paths.flatMap((path, index) => configDraft.resources.some((r) => r.database === 'realtime' && r.path === path) ? [] : [{ id: resourceId(), label: `${labels[index]}${index > 3 ? ` · ${committeeId.trim()}` : ''}`, database: 'realtime' as const, path, displayFields: siteFields[path.split('/')[0]].map((f) => f.key).slice(0, 4), readOnly: false, ...(index === 5 ? { qrRegistryPath: 'valid_qrs', qrUrlTemplate: 'https://studentbranches.ieee.org/tr-ikcu/profile/?qr_id={qrId}' } : {}) }])]);
  };
  const newRecord = () => {
    const id = crypto.randomUUID();
    const kind = selected?.database === 'realtime' ? siteKind(selected.path) : null;
    const data: Record<string, unknown> = kind ? { ...(kind !== 'committees' ? { createdAt: Date.now() } : {}), ...(kind === 'committee_qrs' ? { active: true, puan: 0 } : {}), ...(kind === 'technical_events' ? { pointCost: 0, status: 'open' } : {}), ...(kind === 'events' ? { id, createdBy: externalUser!.uid, visibility: 'members', status: 'pending' } : {}) } : {};
    setEditor({ originalId: null, id, json: stringifyExternalData(data) });
  };
  if (stored.loading) return <SectionLoader />;
  return <Stack>
    <PageHeader title="Web sitesi ve entegrasyonlar" description="Bağlantı durumunu kontrol edin; kurulum ayarları ve gelişmiş veri işlemleri ayrı sekmelerdedir." />
    <SiteConnection />
    <Tabs value={tab} onChange={setTab} keepMounted={false}>
      <Tabs.List mb="md"><Tabs.Tab value="baglanti">Bağlantı durumu</Tabs.Tab><Tabs.Tab value="kurulum">Kurulum</Tabs.Tab><Tabs.Tab value="veriler">Veri yönetimi</Tabs.Tab></Tabs.List>
      <Tabs.Panel value="baglanti"><Stack>
        <Card withBorder><Stack gap="sm"><Title order={3}>Hangi işi nereden yapacağım?</Title><Text size="sm">1. Kurulum: TechOps site projesini bir kez tanımlar, komiteleri eşleştirir ve site yöneticisi işlem yetkilerini verir.</Text><Text size="sm">2. Bağlanma: ACTOR veya ilgili görevli yukarıdan kendi studentbranches profil/puan hesabıyla giriş yapar. Bağlantı kartı o hesabın yetkilerini gösterir.</Text><Text size="sm">3. Günlük işler: puan önerisini etkinlikte değerlendirin; aktarım sonucunu aynı kayıtta kontrol edin. Ham veritabanı kaydı oluşturmanız gerekmez.</Text>
        <Group><Button component={Link} to="/etkinlikler" variant="light">Etkinlik ve puan QR işlemleri</Button>{siteQrController(access) && <Button component={Link} to="/actor" variant="light">ACTOR önerilerini aç</Button>}{can('members.manage') && <Button component={Link} to="/yonetim/uyeler" variant="light">Üyeler ve site üyelikleri</Button>}</Group></Stack></Card>
        <Alert color="blue">Web sitesinin puan QR’ı ile vTools’un etkinlik kaydı farklı işlerdir. vTools hazırlığı için ilgili etkinlikte vTools hazırlık sekmesini açın.</Alert>
      </Stack></Tabs.Panel>
      <Tabs.Panel value="kurulum"><Stack>
        <Alert color="blue" title="TechOps için tek seferlik kurulum">Önce web uygulaması bilgilerini kaydedin, ardından site hesabıyla bağlanıp komiteleri eşleştirin. Son olarak site yöneticisi ACTOR hesabına süreli QR yetkisi verir. Hub yöneticiliği site yöneticiliği yerine geçmez.</Alert>
            <Card withBorder><Group justify="space-between"><div><Title order={3}>Firebase web uygulaması</Title><Text size="sm" c="dimmed">Firebase Console → Proje ayarları → Web uygulaması değerlerini kullanın.</Text></div><Button onClick={saveConfig} loading={busy} disabled={!configDirty}>Bağlantı ayarını kaydet</Button></Group>
      <SimpleGrid cols={{ base: 1, sm: 2 }} mt="md"><TextInput label="API key" value={configDraft.apiKey} onChange={(e) => updateConfig('apiKey', e.currentTarget.value)} /><TextInput label="Auth domain" placeholder="proje.firebaseapp.com" value={configDraft.authDomain} onChange={(e) => updateConfig('authDomain', e.currentTarget.value)} /><TextInput label="Project ID" value={configDraft.projectId} onChange={(e) => updateConfig('projectId', e.currentTarget.value)} /><TextInput label="App ID" value={configDraft.appId} onChange={(e) => updateConfig('appId', e.currentTarget.value)} /><TextInput label="Realtime Database URL" description="Yalnız RTDB kullanılıyorsa gerekir" value={configDraft.databaseURL} onChange={(e) => updateConfig('databaseURL', e.currentTarget.value)} /></SimpleGrid>
    </Card>
        <Alert color="blue" title="Google ile giriş için Hub adresini yetkilendir">Site projesinde Firebase Authentication → Settings → Authorized domains listesine <Code>{window.location.hostname}</Code> eklenmeli. Google giriş yöntemi de site projesinde açık olmalı. Bu işlem Hub projesinde değil, yukarıdaki site projesinde yapılır.</Alert>
        <SiteSetupPanel config={configDraft} stored={stored.data} onChange={patch => { setConfigDraft(current => ({ ...current, ...patch })); setConfigDirty(true); }} />
        <Group justify="flex-end"><Button onClick={saveConfig} loading={busy} disabled={!configDirty}>Kurulumu kaydet</Button></Group>
        <Text size="sm" c="dimmed">Firebase web yapılandırması gizli anahtar değildir. Servis hesabı JSON’u, özel anahtar veya ortak yönetici şifresi bu alana girilmez.</Text>
      </Stack></Tabs.Panel>
      <Tabs.Panel value="veriler"><Stack>
        <Text size="sm" c="dimmed">Bu bölüm TechOps’un bakım ve veri yönetimi içindir. Normal etkinlik ve ACTOR işlemleri için Bağlantı durumu sekmesindeki bağlantıları kullanın.</Text>
        <Accordion variant="contained"><Accordion.Item value="views"><Accordion.Control>Gelişmiş veri görünümü ayarları</Accordion.Control><Accordion.Panel>      <Stack mt="lg">
        <Group align="end"><TextInput label="Site komite kimliği" description="Mevcut committees kaydının kimliği; Hub birim kimliğinden farklı olabilir." value={committeeId} onChange={(e) => setCommitteeId(e.currentTarget.value)} /><Button variant="light" onClick={addSiteViews}>Site yönetim görünümlerini ekle</Button></Group>
        <Group justify="space-between" wrap="wrap">
          <Text fw={600}>İzin verilen veri yolları</Text>
          <Group gap="xs">
            <Button size="xs" variant="light" leftSection={<IconPlus size={15} />} onClick={() => updateConfig('resources', [...configDraft.resources, { id: resourceId(), label: 'IEEE Puan yönetimi', database: 'realtime', path: 'users', displayFields: [], readOnly: false, preset: 'points-users', leaderboardPath: 'leaderboard_public', auditPath: 'admin_point_audit' }])}>IEEE Puan görünümü ekle</Button>
            <Button size="xs" variant="default" leftSection={<IconPlus size={15} />} onClick={() => updateConfig('resources', [...configDraft.resources, { id: resourceId(), label: 'Genel veri', database: 'firestore', path: '', displayFields: ['name'], readOnly: true }])}>Genel görünüm ekle</Button>
          </Group>
        </Group>
        {configDraft.resources.map((resource, index) => (
          <Card key={resource.id} withBorder padding="sm">
            <Group align="flex-end" wrap="wrap">
              <TextInput label="Ad" value={resource.label} onChange={(e) => updateResource(index, { label: e.currentTarget.value })} style={{ flex: '1 1 170px' }} />
              {resource.preset === 'points-users' ? <Badge mb={10}>IEEE Puan · Realtime DB</Badge> : <SegmentedControl data={[{ value: 'firestore', label: 'Firestore' }, { value: 'realtime', label: 'Realtime DB' }]} value={resource.database} onChange={(value) => updateResource(index, { database: value as ExternalFirebaseResource['database'] })} />}
              <TextInput label={resource.preset === 'points-users' ? 'Kullanıcılar yolu' : 'Koleksiyon / yol'} value={resource.path} onChange={(e) => updateResource(index, { path: e.currentTarget.value.replace(/^\/+|\/+$/g, '') })} style={{ flex: '1 1 210px' }} />
              {resource.preset === 'points-users' ? <>
                <TextInput label="Sıralama yolu" value={resource.leaderboardPath ?? ''} onChange={(e) => updateResource(index, { leaderboardPath: e.currentTarget.value.replace(/^\/+|\/+$/g, '') })} style={{ flex: '1 1 190px' }} />
                <TextInput label="Denetim yolu" value={resource.auditPath ?? ''} onChange={(e) => updateResource(index, { auditPath: e.currentTarget.value.replace(/^\/+|\/+$/g, '') })} style={{ flex: '1 1 190px' }} />
              </> : <TextInput label="Tablo alanları" description="Virgülle ayırın; iç içe alan: profil.ad" value={resource.displayFields.join(', ')} onChange={(e) => updateResource(index, { displayFields: e.currentTarget.value.split(',').map((item) => item.trim()).filter(Boolean) })} style={{ flex: '2 1 280px' }} />}
              {resource.database === 'realtime' && siteKind(resource.path) === 'committee_qrs' && <TextInput label="Puan QR bağlantı şablonu" placeholder="https://site.example/puan?qr={qrId}" description="{qrId} ve isteğe bağlı {committeeId} kullanın." value={resource.qrUrlTemplate ?? ''} onChange={(e) => updateResource(index, { qrUrlTemplate: e.currentTarget.value })} />}{resource.qrUrlTemplate !== undefined && <TextInput label="QR registry" value={resource.qrRegistryPath ?? ''} onChange={(e) => updateResource(index, { qrRegistryPath: e.currentTarget.value })} />}<Checkbox label="Salt okunur" checked={resource.readOnly} onChange={(e) => updateResource(index, { readOnly: e.currentTarget.checked })} mb={8} />
              <ActionIcon color="red" variant="subtle" mb={4} onClick={() => updateConfig('resources', configDraft.resources.filter((_, i) => i !== index))}><IconTrash size={17} /></ActionIcon>
            </Group>
          </Card>
        ))}
      </Stack><Button mt="md" onClick={saveConfig} loading={busy} disabled={!configDirty}>Görünüm ayarlarını kaydet</Button></Accordion.Panel></Accordion.Item></Accordion>
        {!configured ? <EmptyState title="Önce Kurulum sekmesini tamamlayın" /> : !externalUser ? <Text size="sm">Verileri görmek için yukarıdaki bağlantı kartından site hesabınızla giriş yapın.</Text> : <>
      <Card withBorder><Group justify="space-between" align="flex-end" wrap="wrap"><div><Text size="sm" c="dimmed">Uzak oturum</Text><Text fw={600}>{externalUser.email ?? externalUser.displayName ?? externalUser.uid}</Text></div><Group><Select label="Veri görünümü" data={(stored.data?.resources ?? []).map((item) => ({ value: item.id, label: `${item.label} · ${item.database}` }))} value={selectedId} onChange={setSelectedId} w={280} />{selected?.preset !== 'points-users' && <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={load} disabled={!selected}>Yenile</Button>}{selected && !selected.readOnly && selected.preset !== 'points-users' && <Button leftSection={<IconPlus size={16} />} onClick={newRecord}>Kayıt ekle</Button>}</Group></Group></Card>
      <ErrorAlert error={resourceError ? siteConnectionError(resourceError) : null} />
      {!selected ? <EmptyState title="Veri görünümü seçin" /> : selected.preset === 'points-users' ? <PointsPanel config={stored.data!} resource={selected} /> : resourceError ? null : loadingRecords ? <SectionLoader /> : records.length === 0 ? <EmptyState title="Kayıt bulunamadı" description="Yol boş olabilir veya uzak Firebase kuralları bu hesabın okumasına izin vermiyor olabilir." /> : <Table.ScrollContainer minWidth={700}><Table striped highlightOnHover><Table.Thead><Table.Tr><Table.Th>Kimlik</Table.Th>{columns.map((column) => <Table.Th key={column}>{column}</Table.Th>)}<Table.Th w={90} /></Table.Tr></Table.Thead><Table.Tbody>{records.map((record) => <Table.Tr key={record.id}><Table.Td><Code>{record.id}</Code></Table.Td>{columns.map((column) => <Table.Td key={column}><Text size="sm" lineClamp={2}>{fieldValue(record.data, column) || '—'}</Text></Table.Td>)}<Table.Td><Group gap={2} wrap="nowrap"><ActionIcon variant="subtle" onClick={() => setEditor({ originalId: record.id, id: record.id, json: stringifyExternalData(record.data) })}><IconEdit size={16} /></ActionIcon>{!selected.readOnly && <ActionIcon color="red" variant="subtle" onClick={() => removeRecord(record)}><IconTrash size={16} /></ActionIcon>}</Group></Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer>}
    </>}
      </Stack></Tabs.Panel>
    </Tabs>

    <Modal opened={!!qrImage} onClose={() => setQrImage(null)} title="Puan QR bağlantısı"><Stack><Text size="sm">Bu QR sitenin profil sayfasını açar. Üyeler telefondan okutarak siteye gider.</Text>{qrImage && <><img src={qrImage} alt="Etkinlik puan QR’ı" /><Button component="a" href={qrImage} download="etkinlik-qr.png">PNG indir</Button></>}</Stack></Modal>
    <Modal opened={!!editor} onClose={() => setEditor(null)} title={editor?.originalId ? 'Harici kaydı görüntüle / düzenle' : 'Harici kayıt ekle'} size="xl">{editor && <Stack><TextInput label="Kayıt kimliği" value={editor.id} onChange={(e) => setEditor({ ...editor, id: e.currentTarget.value })} disabled={!!editor.originalId} required /><>{formKind ? <SiteRecordFields kind={formKind} data={parseExternalData(editor.json)} onChange={(data) => setEditor({ ...editor, json: stringifyExternalData(data) })} readOnly={!!selected?.readOnly} /> : <Textarea label="JSON veri" value={editor.json} onChange={(e) => setEditor({ ...editor, json: e.currentTarget.value })} autosize minRows={16} styles={{ input: { fontFamily: 'monospace' } }} readOnly={!!selected?.readOnly} />}</><Text size="xs" c="dimmed">Firestore zamanları <Code>{'{ "$timestamp": "2026-09-27T12:00:00.000Z" }'}</Code> biçimiyle korunur.</Text><Group justify="flex-end">{formKind === 'committee_qrs' && editor.originalId && <Button variant="light" onClick={async () => { try { const template = selected?.qrUrlTemplate ?? ''; if (!template.includes('{qrId}')) throw new Error('Önce bu görünümün puan QR bağlantı şablonunu ayarlayın.'); const url = new URL(template.replaceAll('{qrId}', encodeURIComponent(editor.id)).replaceAll('{committeeId}', encodeURIComponent(selected!.path.split('/')[1]))); if (!['https:', 'http:'].includes(url.protocol)) throw new Error('QR bağlantısı HTTP veya HTTPS olmalıdır.'); setQrImage(await QRCode.toDataURL(url.href)); } catch (error) { notifyError(error); } }}>Puan QR’ını görüntüle</Button>}<Button variant="default" onClick={() => setEditor(null)}>Kapat</Button>{!selected?.readOnly && <Button onClick={saveRecord} loading={busy}>Uzak projeye kaydet</Button>}</Group></Stack>}</Modal>
  </Stack>;
}

function PointsPanel({ config, resource }: { config: ExternalFirebaseConfig; resource: ExternalFirebaseResource }) {
  const [users, setUsers] = useState<ExternalPointUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [search, setSearch] = useState('');
  const [membershipFilter, setMembershipFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [edit, setEdit] = useState<{ user: ExternalPointUser; points: number; earned: number; spent: number; reason: string } | null>(null);
  const [membershipAction, setMembershipAction] = useState<{ ids: string[]; approved: boolean; reason: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPhrase, setResetPhrase] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true); setError(null);
    try { setUsers(await readExternalPointUsers(config, resource)); }
    catch (loadError) { setUsers([]); setError(loadError as Error); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [config.projectId, resource.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    return users
      .filter((item) => !q || `${item.name} ${item.surname} ${item.email} ${item.department}`.toLocaleLowerCase('tr-TR').includes(q))
      .filter((item) => {
        if (membershipFilter === 'approved') return item.approved;
        if (membershipFilter === 'unapproved') return !item.approved;
        if (membershipFilter === 'issues') return externalPointUserIssues(item).length > 0;
        if (membershipFilter === 'locked') return item.technicalLocked;
        return true;
      });
  }, [users, search, membershipFilter]);
  const total = users.reduce((sum, item) => sum + item.points, 0);
  const issueCount = users.filter((item) => externalPointUserIssues(item).length > 0).length;
  const filteredIds = filtered.map((item) => item.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));
  const someFilteredSelected = filteredIds.some((id) => selectedIds.includes(id));

  const saveEdit = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      await writeExternalPointChanges(config, resource, users, [{ id: edit.user.id, points: edit.points, lifetimeEarned: edit.earned, lifetimeSpent: edit.spent }], edit.reason);
      setEdit(null); await load(); notifySuccess('Puan kaydı ve sıralama güncellendi.');
    } catch (saveError) { notifyError(saveError); } finally { setBusy(false); }
  };
  const resetAll = async () => {
    setBusy(true);
    try {
      await writeExternalPointChanges(config, resource, users, users.map((item) => ({ id: item.id, points: 0 })), resetReason);
      setResetOpen(false); setResetPhrase(''); setResetReason(''); await load(); notifySuccess('Tüm güncel puanlar sıfırlandı; yaşam boyu kazanılan/harcanan değerler korundu.');
    } catch (resetError) { notifyError(resetError); } finally { setBusy(false); }
  };
  const saveMembership = async () => {
    if (!membershipAction) return;
    setBusy(true);
    try {
      await writeExternalMembershipChanges(config, resource, users, membershipAction.ids.map((id) => ({ id, approved: membershipAction.approved })), membershipAction.reason);
      setMembershipAction(null); setSelectedIds([]); await load();
      notifySuccess(membershipAction.approved ? 'Üyelikler onaylandı ve sıralama güncellendi.' : 'Üyelikler askıya alındı ve sıralamadan çıkarıldı.');
    } catch (membershipError) { notifyError(membershipError); } finally { setBusy(false); }
  };
  const exportMembers = () => downloadText(toCsv([
    ['Ad', 'Soyad', 'E-posta', 'Telefon', 'Bölüm', 'Üyelik', 'Güncel puan', 'Toplam kazanılan', 'Toplam harcanan', 'Etkinlik', 'Rol', 'Komite', 'KVKK', 'Teknik kilit', 'Veri uyarıları'],
    ...filtered.map((item) => [item.name, item.surname, item.email, item.phone, item.department, item.approved ? 'Onaylı' : 'Onaysız', item.points, item.lifetimeEarned, item.lifetimeSpent, item.eventCount, item.roleCount, item.committeeCount, item.kvkkConsent ? 'Var' : 'Yok', item.technicalLocked ? 'Kilitli' : 'Açık', externalPointUserIssues(item).join(', ')]),
  ]), `ieee-uyeler-${new Date().toISOString().slice(0, 10)}.csv`);

  if (loading) return <SectionLoader />;
  return <Stack>
    <ErrorAlert error={error} />
    <Alert color="teal" title="Canlı IEEE Puan ve üyelik yönetimi">Veriler uzak Realtime Database içinde kalır. Puan ve üyelik değişiklikleri sıralamayı aynı işlemde yeniler ve <Code>{resource.auditPath || 'admin_point_audit'}</Code> yoluna gerekçeli denetim kaydı ekler.</Alert>
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }}>
      <Card withBorder><Text size="xs" c="dimmed">Kullanıcı</Text><Text fw={700} size="xl">{users.length}</Text></Card>
      <Card withBorder><Text size="xs" c="dimmed">Onaylı kullanıcı</Text><Text fw={700} size="xl">{users.filter((item) => item.approved).length}</Text></Card>
      <Card withBorder><Text size="xs" c="dimmed">Onay bekleyen / askıda</Text><Text fw={700} size="xl">{users.filter((item) => !item.approved).length}</Text></Card>
      <Card withBorder><Text size="xs" c="dimmed">Toplam güncel puan</Text><Text fw={700} size="xl">{total.toLocaleString('tr-TR')}</Text></Card>
      <Card withBorder><Text size="xs" c="dimmed">Veri uyarısı</Text><Text fw={700} size="xl" c={issueCount ? 'orange' : undefined}>{issueCount}</Text></Card>
    </SimpleGrid>
    <Card withBorder>
      <Stack gap="sm">
        <Group justify="space-between" align="end" wrap="wrap">
          <TextInput label="Üye ara" placeholder="Ad, e-posta veya bölüm" value={search} onChange={(event) => setSearch(event.currentTarget.value)} style={{ flex: '1 1 300px' }} />
          <Group><Button variant="default" leftSection={<IconDownload size={16} />} onClick={exportMembers}>CSV indir</Button><Button variant="default" leftSection={<IconRefresh size={16} />} onClick={load}>Yenile</Button>{!resource.readOnly && <Button color="red" variant="light" leftSection={<IconRestore size={16} />} onClick={() => setResetOpen(true)}>Tüm güncel puanları sıfırla</Button>}</Group>
        </Group>
        <Group justify="space-between" wrap="wrap">
          <SegmentedControl value={membershipFilter} onChange={setMembershipFilter} data={[{ value: 'all', label: 'Tümü' }, { value: 'approved', label: 'Onaylı' }, { value: 'unapproved', label: 'Onaysız' }, { value: 'issues', label: 'Veri uyarısı' }, { value: 'locked', label: 'Teknik kilitli' }]} />
          {!resource.readOnly && selectedIds.length > 0 && <Group gap="xs"><Text size="sm" c="dimmed">{selectedIds.length} üye seçildi</Text><Button size="xs" color="green" leftSection={<IconUserCheck size={14} />} onClick={() => setMembershipAction({ ids: selectedIds, approved: true, reason: '' })}>Onayla</Button><Button size="xs" color="orange" variant="light" leftSection={<IconUserX size={14} />} onClick={() => setMembershipAction({ ids: selectedIds, approved: false, reason: '' })}>Askıya al</Button></Group>}
        </Group>
      </Stack>
    </Card>
    {users.length === 0 && !error ? <EmptyState title="Kullanıcı bulunamadı" description="users yolu boş olabilir veya uzak güvenlik kuralları okumaya izin vermiyor olabilir." /> : filtered.length === 0 ? <EmptyState title="Filtreye uyan üye yok" /> : <Table.ScrollContainer minWidth={1250}><Table striped highlightOnHover stickyHeader><Table.Thead><Table.Tr><Table.Th><Checkbox aria-label="Filtrelenen üyelerin tümünü seç" checked={allFilteredSelected} indeterminate={someFilteredSelected && !allFilteredSelected} onChange={() => setSelectedIds(allFilteredSelected ? selectedIds.filter((id) => !filteredIds.includes(id)) : [...new Set([...selectedIds, ...filteredIds])])} /></Table.Th><Table.Th>Üye</Table.Th><Table.Th>Bölüm</Table.Th><Table.Th>Güncel</Table.Th><Table.Th>Toplam kazanılan</Table.Th><Table.Th>Toplam harcanan</Table.Th><Table.Th>Katılım</Table.Th><Table.Th>Durum</Table.Th><Table.Th>Veri kontrolü</Table.Th><Table.Th /></Table.Tr></Table.Thead><Table.Tbody>{filtered.map((item) => { const issues = externalPointUserIssues(item); return <Table.Tr key={item.id}><Table.Td><Checkbox aria-label={`${item.name} ${item.surname} seç`} checked={selectedIds.includes(item.id)} onChange={() => setSelectedIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} /></Table.Td><Table.Td><Text fw={600}>{item.name} {item.surname}</Text><Text size="xs" c="dimmed">{item.email}</Text></Table.Td><Table.Td>{item.department || '—'}</Table.Td><Table.Td><Text fw={700}>{item.points.toLocaleString('tr-TR')}</Text></Table.Td><Table.Td>{item.lifetimeEarned.toLocaleString('tr-TR')}</Table.Td><Table.Td>{item.lifetimeSpent.toLocaleString('tr-TR')}</Table.Td><Table.Td><Text size="sm">{item.eventCount} etkinlik</Text><Text size="xs" c="dimmed">{item.roleCount} rol · {item.committeeCount} komite</Text></Table.Td><Table.Td><Stack gap={3}><Badge color={item.approved ? 'green' : 'gray'}>{item.approved ? 'Onaylı' : 'Onaysız'}</Badge>{item.technicalLocked && <Badge color="red" variant="light">Teknik kilitli</Badge>}</Stack></Table.Td><Table.Td>{issues.length ? <Text size="xs" c="orange">{issues.join(' · ')}</Text> : <Badge color="teal" variant="light">Temiz</Badge>}</Table.Td><Table.Td>{!resource.readOnly && <Group gap={2} wrap="nowrap"><ActionIcon variant="subtle" aria-label="Puanı düzenle" onClick={() => setEdit({ user: item, points: item.points, earned: item.lifetimeEarned, spent: item.lifetimeSpent, reason: '' })}><IconEdit size={16} /></ActionIcon><ActionIcon variant="subtle" color={item.approved ? 'orange' : 'green'} aria-label={item.approved ? 'Üyeliği askıya al' : 'Üyeliği onayla'} onClick={() => setMembershipAction({ ids: [item.id], approved: !item.approved, reason: '' })}>{item.approved ? <IconUserX size={16} /> : <IconUserCheck size={16} />}</ActionIcon></Group>}</Table.Td></Table.Tr>; })}</Table.Tbody></Table></Table.ScrollContainer>}

    <Modal opened={!!edit} onClose={() => setEdit(null)} title="Üye puanını düzenle">{edit && <Stack><Text fw={600}>{edit.user.name} {edit.user.surname}</Text><NumberInput label="Güncel kullanılabilir puan" min={0} value={edit.points} onChange={(value) => setEdit({ ...edit, points: Number(value) || 0 })} /><NumberInput label="Yaşam boyu kazanılan" min={0} value={edit.earned} onChange={(value) => setEdit({ ...edit, earned: Number(value) || 0 })} /><NumberInput label="Yaşam boyu harcanan" min={0} value={edit.spent} onChange={(value) => setEdit({ ...edit, spent: Number(value) || 0 })} /><Textarea label="İşlem gerekçesi" required value={edit.reason} onChange={(event) => setEdit({ ...edit, reason: event.currentTarget.value })} /><Group justify="flex-end"><Button variant="default" onClick={() => setEdit(null)}>Vazgeç</Button><Button onClick={saveEdit} loading={busy} disabled={!edit.reason.trim()}>Uzak veritabanına kaydet</Button></Group></Stack>}</Modal>

    <Modal opened={!!membershipAction} onClose={() => setMembershipAction(null)} title={membershipAction?.approved ? 'Üyelikleri onayla' : 'Üyelikleri askıya al'}>{membershipAction && <Stack><Alert color={membershipAction.approved ? 'green' : 'orange'}>{membershipAction.ids.length} üyenin durumu değiştirilecek. {membershipAction.approved ? 'Üyeler puan sıralamasına dahil edilir.' : 'Üyeler silinmez; giriş onayı kaldırılır ve puan sıralamasından çıkarılır.'}</Alert><Textarea label="İşlem gerekçesi" required value={membershipAction.reason} onChange={(event) => setMembershipAction({ ...membershipAction, reason: event.currentTarget.value })} /><Group justify="flex-end"><Button variant="default" onClick={() => setMembershipAction(null)}>Vazgeç</Button><Button color={membershipAction.approved ? 'green' : 'orange'} onClick={saveMembership} loading={busy} disabled={!membershipAction.reason.trim()}>{membershipAction.approved ? 'Üyelikleri onayla' : 'Üyelikleri askıya al'}</Button></Group></Stack>}</Modal>

    <Modal opened={resetOpen} onClose={() => setResetOpen(false)} title="Tüm güncel puanları sıfırla"><Stack><Alert color="red">Bu işlem {users.length} kullanıcının <Code>sadakat</Code> değerini sıfırlar. Yaşam boyu kazanılan ve harcanan puanlar korunur. İşlem uzak veritabanında uygulanır.</Alert><Textarea label="İşlem gerekçesi" required value={resetReason} onChange={(event) => setResetReason(event.currentTarget.value)} /><TextInput label={<span>Onaylamak için <Code>PUANLARI SIFIRLA</Code> yazın</span>} value={resetPhrase} onChange={(event) => setResetPhrase(event.currentTarget.value)} /><Group justify="flex-end"><Button variant="default" onClick={() => setResetOpen(false)}>Vazgeç</Button><Button color="red" onClick={resetAll} loading={busy} disabled={resetPhrase !== 'PUANLARI SIFIRLA' || !resetReason.trim() || users.length === 0}>Puanları sıfırla</Button></Group></Stack></Modal>
  </Stack>;
}
