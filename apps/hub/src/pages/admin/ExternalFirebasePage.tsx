import { ActionIcon, Alert, Button, Card, Checkbox, Code, Group, Modal, PasswordInput, SegmentedControl, Select, SimpleGrid, Stack, Table, Text, TextInput, Textarea, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconEdit, IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, ErrorAlert, PageHeader, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { db } from '../../firebase';
import {
  connectExternalEmail,
  connectExternalGoogle,
  deleteExternalRecord,
  disconnectExternal,
  externalServices,
  fieldValue,
  parseExternalData,
  readExternalResource,
  resetExternalConnection,
  stringifyExternalData,
  writeExternalRecord,
  type ExternalRecord,
} from '../../lib/externalFirebase';
import { useDoc } from '../../lib/hooks';
import type { ExternalFirebaseConfig, ExternalFirebaseResource } from '../../lib/opsTypes';

type ConfigDraft = Omit<ExternalFirebaseConfig, 'updatedAt' | 'updatedBy'>;
const emptyConfig = (): ConfigDraft => ({ apiKey: '', authDomain: '', projectId: '', appId: '', databaseURL: '', resources: [] });
const resourceId = () => crypto.randomUUID();

export function ExternalFirebasePage() {
  const { user } = useAuth();
  const stored = useDoc<ExternalFirebaseConfig>('externalIntegrations/firebase');
  const [configDraft, setConfigDraft] = useState<ConfigDraft>(emptyConfig());
  const [configDirty, setConfigDirty] = useState(false);
  const [externalUser, setExternalUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [records, setRecords] = useState<ExternalRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [resourceError, setResourceError] = useState<Error | null>(null);
  const [editor, setEditor] = useState<{ originalId: string | null; id: string; json: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const connectionKey = stored.data ? [stored.data.projectId, stored.data.apiKey, stored.data.authDomain, stored.data.appId, stored.data.databaseURL].join('|') : '';

  useEffect(() => {
    if (stored.data && !configDirty) {
      setConfigDraft({ apiKey: stored.data.apiKey, authDomain: stored.data.authDomain, projectId: stored.data.projectId, appId: stored.data.appId, databaseURL: stored.data.databaseURL ?? '', resources: stored.data.resources ?? [] });
      setSelectedId((current) => current ?? stored.data!.resources?.[0]?.id ?? null);
    }
  }, [stored.data, configDirty]);

  const configured = !!stored.data?.apiKey && !!stored.data?.projectId && !!stored.data?.appId;
  useEffect(() => {
    if (!configured || !stored.data) { setExternalUser(null); return; }
    return onAuthStateChanged(externalServices(stored.data).auth, setExternalUser);
  }, [configured, connectionKey]);
  const selected = stored.data?.resources?.find((item) => item.id === selectedId) ?? null;

  const load = async () => {
    if (!stored.data || !selected) return;
    setLoadingRecords(true); setResourceError(null);
    try { setRecords(await readExternalResource(stored.data, selected)); }
    catch (error) { setRecords([]); setResourceError(error as Error); }
    finally { setLoadingRecords(false); }
  };
  useEffect(() => { if (externalUser && selected) void load(); else setRecords([]); }, [externalUser?.uid, selected?.id]);

  const updateConfig = <K extends keyof ConfigDraft>(key: K, value: ConfigDraft[K]) => { setConfigDraft((current) => ({ ...current, [key]: value })); setConfigDirty(true); };
  const updateResource = (index: number, patch: Partial<ExternalFirebaseResource>) => updateConfig('resources', configDraft.resources.map((item, i) => i === index ? { ...item, ...patch } : item));
  const saveConfig = async () => {
    if (!configDraft.apiKey.trim() || !configDraft.authDomain.trim() || !configDraft.projectId.trim() || !configDraft.appId.trim()) return;
    if (configDraft.resources.some((item) => !item.label.trim() || !item.path.trim())) return notifyError(new Error('Her veri görünümünün adı ve yolu dolu olmalı.'));
    setBusy(true);
    try {
      const previousConnection = stored.data ? [stored.data.projectId, stored.data.apiKey, stored.data.authDomain, stored.data.appId, stored.data.databaseURL].join('|') : '';
      const nextConnection = [configDraft.projectId, configDraft.apiKey, configDraft.authDomain, configDraft.appId, configDraft.databaseURL].join('|');
      if (stored.data?.projectId && previousConnection !== nextConnection) await resetExternalConnection(stored.data.projectId);
      await setDoc(doc(db, 'externalIntegrations', 'firebase'), { ...configDraft, updatedBy: user!.uid, updatedAt: serverTimestamp() });
      setConfigDirty(false);
      if (previousConnection !== nextConnection) setExternalUser(null);
      notifySuccess('Harici Firebase bağlantı ayarı kaydedildi.');
    } catch (error) { notifyError(error); } finally { setBusy(false); }
  };

  const signInGoogle = async () => { if (stored.data) try { await connectExternalGoogle(stored.data); } catch (error) { notifyError(error); } };
  const signInEmail = async () => { if (stored.data) try { await connectExternalEmail(stored.data, email, password); setPassword(''); } catch (error) { notifyError(error); } };
  const saveRecord = async () => {
    if (!stored.data || !selected || !editor) return;
    setBusy(true);
    try {
      if (editor.originalId && editor.originalId !== editor.id) throw new Error('Mevcut kaydın kimliği değiştirilemez. Yeni kayıt oluşturun.');
      await writeExternalRecord(stored.data, selected, editor.id, parseExternalData(editor.json));
      setEditor(null); await load(); notifySuccess('Harici kayıt kaydedildi.');
    } catch (error) { notifyError(error); } finally { setBusy(false); }
  };
  const removeRecord = (record: ExternalRecord) => {
    if (!stored.data || !selected) return;
    modals.openConfirmModal({ title: 'Harici kayıt silinsin mi?', children: <Text size="sm"><Code>{selected.path}/{record.id}</Code> uzak Firebase projesinden kalıcı olarak silinir.</Text>, labels: { confirm: 'Kalıcı sil', cancel: 'Vazgeç' }, confirmProps: { color: 'red' }, onConfirm: () => deleteExternalRecord(stored.data!, selected, record.id).then(load).then(() => notifySuccess('Harici kayıt silindi.')).catch(notifyError) });
  };

  const columns = useMemo(() => selected?.displayFields?.filter(Boolean) ?? [], [selected]);
  if (stored.loading) return <SectionLoader />;
  return <Stack>
    <PageHeader title="Harici Firebase sistemleri" description="IEEE Puan ve diğer ayrı Firebase içeriklerini, o projenin kendi kimlik ve güvenlik kurallarıyla yönetin." />
    <Alert color="blue" title="Güvenlik sınırı">Firebase web yapılandırması gizli anahtar değildir. Servis hesabı JSON'u veya yönetici anahtarı buraya girilmez. Her TechOps sorumlusu uzak projede kendi hesabıyla ayrıca giriş yapar.</Alert>

    <Card withBorder><Group justify="space-between"><div><Title order={3}>Bağlantı ve veri görünümleri</Title><Text size="sm" c="dimmed">Firebase Console → Proje ayarları → Web uygulaması değerlerini kullanın.</Text></div><Button onClick={saveConfig} loading={busy} disabled={!configDirty}>Ayarı kaydet</Button></Group>
      <SimpleGrid cols={{ base: 1, sm: 2 }} mt="md"><TextInput label="API key" value={configDraft.apiKey} onChange={(e) => updateConfig('apiKey', e.currentTarget.value)} /><TextInput label="Auth domain" placeholder="proje.firebaseapp.com" value={configDraft.authDomain} onChange={(e) => updateConfig('authDomain', e.currentTarget.value)} /><TextInput label="Project ID" value={configDraft.projectId} onChange={(e) => updateConfig('projectId', e.currentTarget.value)} /><TextInput label="App ID" value={configDraft.appId} onChange={(e) => updateConfig('appId', e.currentTarget.value)} /><TextInput label="Realtime Database URL" description="Yalnız RTDB kullanılıyorsa gerekir" value={configDraft.databaseURL} onChange={(e) => updateConfig('databaseURL', e.currentTarget.value)} /></SimpleGrid>
      <Stack mt="lg"><Group justify="space-between"><Text fw={600}>İzin verilen veri yolları</Text><Button size="xs" variant="light" leftSection={<IconPlus size={15} />} onClick={() => updateConfig('resources', [...configDraft.resources, { id: resourceId(), label: 'IEEE Puan', database: 'firestore', path: '', displayFields: ['name', 'points'], readOnly: true }])}>Görünüm ekle</Button></Group>
        {configDraft.resources.map((resource, index) => <Card key={resource.id} withBorder padding="sm"><Group align="flex-end" wrap="wrap"><TextInput label="Ad" value={resource.label} onChange={(e) => updateResource(index, { label: e.currentTarget.value })} style={{ flex: '1 1 170px' }} /><SegmentedControl data={[{ value: 'firestore', label: 'Firestore' }, { value: 'realtime', label: 'Realtime DB' }]} value={resource.database} onChange={(value) => updateResource(index, { database: value as ExternalFirebaseResource['database'] })} /><TextInput label="Koleksiyon / yol" value={resource.path} onChange={(e) => updateResource(index, { path: e.currentTarget.value.replace(/^\/+|\/+$/g, '') })} style={{ flex: '1 1 220px' }} /><TextInput label="Tablo alanları" description="Virgülle ayırın; iç içe alan: profil.ad" value={resource.displayFields.join(', ')} onChange={(e) => updateResource(index, { displayFields: e.currentTarget.value.split(',').map((item) => item.trim()).filter(Boolean) })} style={{ flex: '2 1 280px' }} /><Checkbox label="Salt okunur" checked={resource.readOnly} onChange={(e) => updateResource(index, { readOnly: e.currentTarget.checked })} mb={8} /><ActionIcon color="red" variant="subtle" mb={4} onClick={() => updateConfig('resources', configDraft.resources.filter((_, i) => i !== index))}><IconTrash size={17} /></ActionIcon></Group></Card>)}
      </Stack>
    </Card>

    {!configured ? <EmptyState title="Bağlantı henüz yapılandırılmadı" description="Yukarıdaki web uygulaması değerlerini ve puan verisinin koleksiyon/yolunu girin." /> : !externalUser ? <Card withBorder><Title order={3}>Uzak projede oturum aç</Title><Text size="sm" c="dimmed" mt={4}>Bu oturum Hub girişinden ayrıdır ve yalnız bu tarayıcı sekmesi boyunca saklanır.</Text><Group mt="md" align="end" wrap="wrap"><Button onClick={signInGoogle}>Google ile bağlan</Button><TextInput label="E-posta" value={email} onChange={(e) => setEmail(e.currentTarget.value)} /><PasswordInput label="Şifre" value={password} onChange={(e) => setPassword(e.currentTarget.value)} /><Button variant="default" onClick={signInEmail} disabled={!email || !password}>E-posta ile bağlan</Button></Group></Card> : <>
      <Card withBorder><Group justify="space-between" align="flex-end" wrap="wrap"><div><Text size="sm" c="dimmed">Uzak oturum</Text><Text fw={600}>{externalUser.email ?? externalUser.displayName ?? externalUser.uid}</Text></div><Group><Select label="Veri görünümü" data={(stored.data?.resources ?? []).map((item) => ({ value: item.id, label: `${item.label} · ${item.database}` }))} value={selectedId} onChange={setSelectedId} w={280} /><Button variant="default" leftSection={<IconRefresh size={16} />} onClick={load} disabled={!selected}>Yenile</Button>{selected && !selected.readOnly && <Button leftSection={<IconPlus size={16} />} onClick={() => setEditor({ originalId: null, id: '', json: '{\n  \n}' })}>Kayıt ekle</Button>}<Button color="gray" variant="subtle" onClick={() => stored.data && disconnectExternal(stored.data)}>Bağlantıyı kes</Button></Group></Group></Card>
      <ErrorAlert error={resourceError} />
      {loadingRecords ? <SectionLoader /> : !selected ? <EmptyState title="Veri görünümü seçin" /> : records.length === 0 ? <EmptyState title="Kayıt bulunamadı" description="Yol boş olabilir veya uzak Firebase kuralları bu hesabın okumasına izin vermiyor olabilir." /> : <Table.ScrollContainer minWidth={700}><Table striped highlightOnHover><Table.Thead><Table.Tr><Table.Th>Kimlik</Table.Th>{columns.map((column) => <Table.Th key={column}>{column}</Table.Th>)}<Table.Th w={90} /></Table.Tr></Table.Thead><Table.Tbody>{records.map((record) => <Table.Tr key={record.id}><Table.Td><Code>{record.id}</Code></Table.Td>{columns.map((column) => <Table.Td key={column}><Text size="sm" lineClamp={2}>{fieldValue(record.data, column) || '—'}</Text></Table.Td>)}<Table.Td><Group gap={2} wrap="nowrap"><ActionIcon variant="subtle" onClick={() => setEditor({ originalId: record.id, id: record.id, json: stringifyExternalData(record.data) })}><IconEdit size={16} /></ActionIcon>{!selected.readOnly && <ActionIcon color="red" variant="subtle" onClick={() => removeRecord(record)}><IconTrash size={16} /></ActionIcon>}</Group></Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer>}
    </>}

    <Modal opened={!!editor} onClose={() => setEditor(null)} title={editor?.originalId ? 'Harici kaydı görüntüle / düzenle' : 'Harici kayıt ekle'} size="xl">{editor && <Stack><TextInput label="Kayıt kimliği" value={editor.id} onChange={(e) => setEditor({ ...editor, id: e.currentTarget.value })} disabled={!!editor.originalId} required /><Textarea label="JSON veri" value={editor.json} onChange={(e) => setEditor({ ...editor, json: e.currentTarget.value })} autosize minRows={16} styles={{ input: { fontFamily: 'monospace' } }} readOnly={!!selected?.readOnly} /><Text size="xs" c="dimmed">Firestore zamanları <Code>{'{ "$timestamp": "2026-09-27T12:00:00.000Z" }'}</Code> biçimiyle korunur.</Text><Group justify="flex-end"><Button variant="default" onClick={() => setEditor(null)}>Kapat</Button>{!selected?.readOnly && <Button onClick={saveRecord} loading={busy}>Uzak projeye kaydet</Button>}</Group></Stack>}</Modal>
  </Stack>;
}
