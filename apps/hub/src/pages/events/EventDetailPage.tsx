import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Grid,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { Dropzone } from '@mantine/dropzone';
import { modals } from '@mantine/modals';
import { IconArrowLeft, IconArrowRight, IconCheck, IconDownload, IconFileTypeCsv, IconPlus, IconPrinter } from '@tabler/icons-react';
import { orderBy, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { MetaBadge, dueInfo } from '../../components/MetaBadge';
import { TaskDrawer } from '../../components/TaskDrawer';
import { TaskModal } from '../../components/TaskModal';
import { EmptyState, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { hasPermission, hasUnitPermission } from '../../lib/access';
import { fmtDateTime } from '../../lib/format';
import { EMPTY_VTOOLS_DATA, vtoolsMissingFields, vtoolsPreparationRows } from '../../lib/eventExports';
import { useCollection, useDoc } from '../../lib/hooks';
import { useActiveMembers } from '../../lib/members';
import {
  approveEventWithPetition,
  downloadText,
  importParticipants,
  previewParticipantsCsv,
  toCsv,
  updateEvent,
  type CsvPreview,
} from '../../lib/ops';
import { CONTENT_STATUS, CONTENT_TYPES, EVENT_FLOW, EVENT_STATUS, EVENT_TYPES, TASK_STATUS } from '../../lib/opsLabels';
import type { ContentRequest, HubEvent, Participant, SyncRun, Task, VToolsEventData } from '../../lib/opsTypes';
import type { Petition } from '../../lib/types';
import { fmtEventDate } from './EventsPage';

export function EventDetailPage() {
  const { id } = useParams();
  const { user, access } = useAuth();
  const { data: e, loading } = useDoc<HubEvent>(`events/${id}`);
  const [tab, setTab] = useState<string | null>('genel');

  if (loading) return <SectionLoader />;
  if (!e || !id) return <EmptyState title="Etkinlik bulunamadı" />;

  const isOwner = e.ownerUids.includes(user!.uid);
  const canManage = isOwner || hasUnitPermission(access, e.unitId, 'unit.manage', 'events.manageAll');
  const canParticipants = canManage;
  const flowIdx = EVENT_FLOW.indexOf(e.status);
  const next = flowIdx >= 0 && flowIdx < EVENT_FLOW.length - 1 ? EVENT_FLOW[flowIdx + 1] : null;

  const advance = () => {
    if (!next) return;
    if (next === 'reported' && !Object.values(e.checklist).every(Boolean)) {
      return notifyError(new Error('Raporlandı durumuna geçmeden önce kapanış kontrol listesini tamamlayın.'), 'Kapanış eksik');
    }
    modals.openConfirmModal({
      title: `Durum: ${EVENT_STATUS[next].label}`,
      children: <Text size="sm">Etkinlik bir sonraki aşamaya geçirilsin mi?</Text>,
      labels: { confirm: 'İlerlet', cancel: 'Vazgeç' },
      onConfirm: () => updateEvent(id, { status: next }).catch(notifyError),
    });
  };

  return (
    <Stack>
      <Anchor component={Link} to="/etkinlikler" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} /> Etkinlikler
        </Group>
      </Anchor>
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Group gap="sm">
            <Title order={2}>{e.name}</Title>
            <MetaBadge map={EVENT_STATUS} value={e.status} />
          </Group>
          <Text c="dimmed" size="sm">
            {e.code} · {e.unitName} · {e.type} · {fmtEventDate(e.startsAt)}
            {e.location ? ` · ${e.location}` : ''}
          </Text>
        </div>
        {canManage && (
          <Group gap="xs">
            {next && (
              <Button rightSection={<IconArrowRight size={16} />} onClick={advance}>
                {EVENT_STATUS[next].label}
              </Button>
            )}
            {!['cancelled', 'rejected', 'archived', 'proposed'].includes(e.status) && (
              <Button
                variant="subtle"
                color="red"
                onClick={() =>
                  modals.openConfirmModal({
                    title: 'Etkinlik iptal edilsin mi?',
                    labels: { confirm: 'İptal et', cancel: 'Vazgeç' },
                    confirmProps: { color: 'red' },
                    onConfirm: () => updateEvent(id, { status: 'cancelled' }).catch(notifyError),
                  })
                }
              >
                İptal et
              </Button>
            )}
          </Group>
        )}
      </Group>

      {flowIdx >= 0 && (
        <Stepper active={flowIdx} size="xs" allowNextStepsSelect={false}>
          {EVENT_FLOW.map((s) => (
            <Stepper.Step key={s} label={EVENT_STATUS[s].label} />
          ))}
        </Stepper>
      )}

      {e.status === 'proposed' && <ApprovalPanel e={e} id={id} canManage={canManage} />}
      {e.status === 'rejected' && (
        <Alert color="red" title="Öneri reddedildi">
          {e.decisionNote || 'Gerekçe belirtilmedi.'} {e.decidedByName ? `— ${e.decidedByName}` : ''}
        </Alert>
      )}

      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="genel">Genel</Tabs.Tab>
          <Tabs.Tab value="gorevler">Görev planı</Tabs.Tab>
          {canParticipants && <Tabs.Tab value="katilimci">Katılımcılar (HeptaCert)</Tabs.Tab>}
          <Tabs.Tab value="kapanis">Kapanış ve rapor</Tabs.Tab>
          <Tabs.Tab value="vtools">vTools hazırlık</Tabs.Tab>
          <Tabs.Tab value="iletisim">İletişim</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="genel">
          <General e={e} id={id} canManage={canManage} />
        </Tabs.Panel>
        <Tabs.Panel value="gorevler">
          <EventTasks e={e} id={id} />
        </Tabs.Panel>
        <Tabs.Panel value="katilimci">{canParticipants && <Participants e={e} id={id} />}</Tabs.Panel>
        <Tabs.Panel value="kapanis">
          <Closing e={e} id={id} canManage={canManage} />
        </Tabs.Panel>
        <Tabs.Panel value="vtools">
          <VToolsPreparation e={e} id={id} canManage={canManage} />
        </Tabs.Panel>
        <Tabs.Panel value="iletisim">
          <EventContent id={id} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function ApprovalPanel({ e, id, canManage }: { e: HubEvent; id: string; canManage: boolean }) {
  const { user } = useAuth();
  const petitions = useCollection<Petition>(
    canManage ? 'petitions' : null,
    [where('ownerUid', '==', user!.uid), where('status', '==', 'approved')],
    `pa-${user!.uid}`,
  );
  const options = petitions.data.filter((p) => p.unitId === e.unitId);
  const [pid, setPid] = useState<string | null>(null);
  return (
    <Alert color="yellow" title="Öneri onay bekliyor">
      <Stack gap="xs">
        <Text size="sm">
          Etkinlik, YK kararıyla (Etkinlikler sayfasında "Onay bekleyen öneriler") veya bu birim adına onaylanmış bir etkinlik izin
          dilekçesiyle onaylanır.
        </Text>
        {canManage && (
          <Group align="flex-end" wrap="wrap">
            <Select
              label="Onaylanmış dilekçenizi bağlayın"
              placeholder={options.length ? 'Dilekçe seçin' : 'Bu birim için onaylı dilekçeniz yok'}
              data={options.map((p) => ({ value: p.id, label: `${p.documentNo} · ${p.title}` }))}
              value={pid}
              onChange={setPid}
              w={360}
            />
            <Button
              disabled={!pid}
              onClick={() => {
                const p = options.find((x) => x.id === pid)!;
                approveEventWithPetition(id, p.id, p.documentNo ?? '')
                  .then(() => notifySuccess('Etkinlik onaylı dilekçeyle onaylandı.'))
                  .catch(notifyError);
              }}
            >
              Dilekçeyle onayla
            </Button>
            <Button component={Link} to="/dilekceler/yeni" variant="subtle">
              Etkinlik izin dilekçesi yaz
            </Button>
          </Group>
        )}
      </Stack>
    </Alert>
  );
}

function General({ e, id, canManage }: { e: HubEvent; id: string; canManage: boolean }) {
  const { options, nameOf } = useActiveMembers(canManage);
  const [f, setF] = useState(e);
  const [busy, setBusy] = useState(false);
  useEffect(() => setF(e), [e]);
  const ro = !canManage;

  const save = async () => {
    setBusy(true);
    try {
      await updateEvent(id, {
        name: f.name,
        type: f.type,
        description: f.description,
        startsAt: f.startsAt,
        endsAt: f.endsAt,
        location: f.location,
        expectedParticipants: f.expectedParticipants,
        ownerUids: f.ownerUids,
        ownerNames: f.ownerUids.map(nameOf),
        heptacertLink: f.heptacertLink,
        driveLink: f.driveLink,
        registrationLink: f.registrationLink,
        budgetPlanned: f.budgetPlanned,
      });
      notifySuccess('Etkinlik güncellendi.');
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Grid gap="lg">
      <Grid.Col span={{ base: 12, md: 8 }}>
        <Card>
          <Stack>
            <TextInput label="Ad" value={f.name} onChange={(x) => setF({ ...f, name: x.currentTarget.value })} readOnly={ro} />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select label="Tür" data={EVENT_TYPES} value={f.type} onChange={(v) => setF({ ...f, type: v ?? f.type })} readOnly={ro} />
              <TextInput label="Yer" value={f.location} onChange={(x) => setF({ ...f, location: x.currentTarget.value })} readOnly={ro} />
              <DateTimePicker label="Başlangıç" valueFormat="DD.MM.YYYY HH:mm" value={f.startsAt} onChange={(v) => setF({ ...f, startsAt: v })} readOnly={ro} />
              <DateTimePicker label="Bitiş" valueFormat="DD.MM.YYYY HH:mm" value={f.endsAt} onChange={(v) => setF({ ...f, endsAt: v })} readOnly={ro} />
              <NumberInput label="Tahmini katılımcı" value={f.expectedParticipants ?? ''} onChange={(v) => setF({ ...f, expectedParticipants: v === '' ? null : Number(v) })} readOnly={ro} />
              <NumberInput label="Planlanan bütçe (TL)" value={f.budgetPlanned ?? ''} onChange={(v) => setF({ ...f, budgetPlanned: v === '' ? null : Number(v) })} readOnly={ro} thousandSeparator="." decimalSeparator="," />
            </SimpleGrid>
            <MultiSelect label="Etkinlik sorumluları" data={options.length ? options : f.ownerUids.map((u, i) => ({ value: u, label: f.ownerNames[i] ?? u }))} value={f.ownerUids} onChange={(v) => setF({ ...f, ownerUids: v })} readOnly={ro} searchable />
            <Textarea label="Açıklama" autosize minRows={3} value={f.description} onChange={(x) => setF({ ...f, description: x.currentTarget.value })} readOnly={ro} />
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <TextInput label="Kayıt bağlantısı" value={f.registrationLink} onChange={(x) => setF({ ...f, registrationLink: x.currentTarget.value })} readOnly={ro} />
              <TextInput label="HeptaCert etkinliği" value={f.heptacertLink} onChange={(x) => setF({ ...f, heptacertLink: x.currentTarget.value })} readOnly={ro} />
              <TextInput label="Drive klasörü" description="03_Etkinlikler/{dönem}/{kod}_{ad}" value={f.driveLink} onChange={(x) => setF({ ...f, driveLink: x.currentTarget.value })} readOnly={ro} />
            </SimpleGrid>
            {canManage && (
              <Group justify="flex-end">
                <Button onClick={save} loading={busy}>
                  Kaydet
                </Button>
              </Group>
            )}
          </Stack>
        </Card>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 4 }}>
        <Card>
          <Stack gap={6}>
            <Text fw={600}>Özet</Text>
            <Text size="sm">Sorumlular: {e.ownerNames.join(', ')}</Text>
            <Text size="sm">Öneren: {e.createdByName}</Text>
            {e.petitionNo && (
              <Text size="sm">
                İzin dilekçesi: <b>{e.petitionNo}</b>
              </Text>
            )}
            {e.decisionNote && <Text size="sm">Karar notu: {e.decisionNote}</Text>}
            {e.registrationLink && (
              <Anchor href={e.registrationLink} target="_blank" size="sm">
                Kayıt sayfası
              </Anchor>
            )}
            {e.heptacertLink && (
              <Anchor href={e.heptacertLink} target="_blank" size="sm">
                HeptaCert etkinliği
              </Anchor>
            )}
            {e.driveLink && (
              <Anchor href={e.driveLink} target="_blank" size="sm">
                Drive klasörü
              </Anchor>
            )}
          </Stack>
        </Card>
      </Grid.Col>
    </Grid>
  );
}

function VToolsPreparation({ e, id, canManage }: { e: HubEvent; id: string; canManage: boolean }) {
  const { orgSettings, user } = useAuth();
  const [data, setData] = useState<VToolsEventData>({ ...EMPTY_VTOOLS_DATA, ...(e.vtools ?? {}) });
  const [busy, setBusy] = useState(false);
  useEffect(() => setData({ ...EMPTY_VTOOLS_DATA, ...(e.vtools ?? {}) }), [e.vtools]);
  const eventWithDraft = { ...e, vtools: data };
  const missing = vtoolsMissingFields(eventWithDraft, orgSettings);
  const set = <K extends keyof VToolsEventData>(key: K, value: VToolsEventData[K]) => setData((current) => ({ ...current, [key]: value }));

  const save = async (reported = false) => {
    setBusy(true);
    try {
      const next = reported
        ? { ...data, reportedAt: new Date().toISOString(), reportedBy: user!.displayName ?? user!.email ?? '' }
        : data;
      await updateEvent(id, { vtools: next, vtoolsStatus: reported ? 'reported' : e.vtoolsStatus === 'not_required' ? 'pending' : e.vtoolsStatus });
      setData(next);
      notifySuccess(reported ? 'vTools bildirimi kaydedildi.' : 'vTools hazırlığı kaydedildi.');
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack>
      <Alert color="blue" variant="light">
        Bu ekran vTools Events / L31 formuna girilecek veriyi hazırlar. İndirilen CSV bir çalışma ve devir paketidir; vTools'un
        belgelenmiş bir toplu yükleme formatı değildir. Resmî gönderim vTools'ta yetkili kişi tarafından yapılır.
      </Alert>
      {(!orgSettings.vtoolsOrganizationName || !orgSettings.vtoolsSpoid || !orgSettings.vtoolsContactEmail) && (
        <Alert color="yellow" title="Kurum vTools bilgileri eksik">
          Kurum ayarlarında organizasyon birimi, SPOID ve iletişim e-postasını bir kez tanımlayın.
        </Alert>
      )}
      <Card>
        <Stack>
          <Group justify="space-between">
            <Text fw={600}>L31 / vTools alanları</Text>
            {e.vtoolsStatus === 'reported' ? <Badge color="green">Bildirildi</Badge> : e.vtoolsStatus === 'not_required' ? <Badge color="gray">Gerekmiyor</Badge> : <Badge color="yellow">Hazırlanıyor</Badge>}
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Etkinlik kategorisi" placeholder="Örn. Technical" value={data.category} onChange={(x) => set('category', x.currentTarget.value)} readOnly={!canManage} />
            <TextInput label="Alt kategori" value={data.subcategory} onChange={(x) => set('subcategory', x.currentTarget.value)} readOnly={!canManage} />
            <Select
              label="Konum türü"
              data={[{ value: 'physical', label: 'Fiziksel' }, { value: 'virtual', label: 'Çevrim içi' }, { value: 'hybrid', label: 'Hibrit' }]}
              value={data.locationType}
              onChange={(value) => set('locationType', (value ?? 'physical') as VToolsEventData['locationType'])}
              readOnly={!canManage}
            />
            <TextInput label="Etiketler" description="Virgülle ayırın" value={data.tags} onChange={(x) => set('tags', x.currentTarget.value)} readOnly={!canManage} />
            <NumberInput label="IEEE üyesi katılımcı" min={0} value={data.ieeeAttendees ?? ''} onChange={(value) => set('ieeeAttendees', value === '' ? null : Number(value))} readOnly={!canManage} />
            <NumberInput label="Üye olmayan katılımcı" min={0} value={data.guestAttendees ?? ''} onChange={(value) => set('guestAttendees', value === '' ? null : Number(value))} readOnly={!canManage} />
            <TextInput label="vTools etkinlik kimliği" description="Gönderim sonrası vTools'taki sayısal kimlik" value={data.eventId} onChange={(x) => set('eventId', x.currentTarget.value)} readOnly={!canManage} />
          </SimpleGrid>
          <Textarea label="Gündem" autosize minRows={3} value={data.agenda} onChange={(x) => set('agenda', x.currentTarget.value)} readOnly={!canManage} />
          <Text size="sm">
            Toplam katılımcı: <b>{e.report?.participantCount ?? '—'}</b>
          </Text>
          {missing.length ? (
            <Alert color="orange" title={`${missing.length} eksik / uyumsuz alan`}>
              {missing.join(', ')}
            </Alert>
          ) : (
            <Alert color="green" icon={<IconCheck size={16} />}>vTools veri paketi hazır.</Alert>
          )}
          <Group justify="space-between" wrap="wrap">
            <Button
              variant="default"
              leftSection={<IconDownload size={16} />}
              onClick={() => downloadText(toCsv(vtoolsPreparationRows([eventWithDraft], orgSettings)), `${e.code}_vtools_hazirlik.csv`)}
            >
              Hazırlık CSV'si
            </Button>
            {canManage && (
              <Group gap="xs">
                <Button variant="default" loading={busy} onClick={() => void save(false)}>Taslağı kaydet</Button>
                <Button
                  color="green"
                  loading={busy}
                  disabled={missing.length > 0 || !data.eventId.trim()}
                  onClick={() => void save(true)}
                >
                  vTools'ta bildirildi
                </Button>
                <Button
                  variant="subtle"
                  color="gray"
                  onClick={() => updateEvent(id, { vtools: data, vtoolsStatus: 'not_required' }).then(() => notifySuccess('vTools bildirimi gerekmiyor olarak işaretlendi.')).catch(notifyError)}
                >
                  Gerekmiyor
                </Button>
              </Group>
            )}
          </Group>
          {data.reportedAt && <Text size="xs" c="dimmed">Bildirim: {data.reportedBy} · {new Date(data.reportedAt).toLocaleString('tr-TR')}</Text>}
        </Stack>
      </Card>
    </Stack>
  );
}

function EventTasks({ e, id }: { e: HubEvent; id: string }) {
  const { access } = useAuth();
  const tasks = useCollection<Task>('tasks', [where('unitId', '==', e.unitId), where('eventId', '==', id)], `et-${id}`);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const canCreate = hasUnitPermission(access, e.unitId, 'unit.tasks.manage', 'work.manageAll') || hasUnitPermission(access, e.unitId, 'unit.manage');
  const done = tasks.data.filter((t) => t.status === 'done').length;
  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {done}/{tasks.data.length} görev tamamlandı
        </Text>
        {canCreate && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setOpen(true)}>
            Görev ekle
          </Button>
        )}
      </Group>
      {tasks.error ? (
        <Text size="sm" c="dimmed">
          Görev planını görmek için bu birimde görevli olmanız gerekir.
        </Text>
      ) : tasks.data.length === 0 ? (
        <EmptyState title="Görev planı boş" />
      ) : (
        <Table highlightOnHover>
          <Table.Tbody>
            {tasks.data.map((t) => {
              const due = dueInfo(t.dueDate, t.status === 'done');
              return (
                <Table.Tr key={t.id} onClick={() => setSel(t.id)} style={{ cursor: 'pointer' }}>
                  <Table.Td ff="monospace">{t.code}</Table.Td>
                  <Table.Td>{t.title}</Table.Td>
                  <Table.Td>{t.assigneeName}</Table.Td>
                  <Table.Td>{due && <Badge color={due.color}>{due.label}</Badge>}</Table.Td>
                  <Table.Td>
                    <MetaBadge map={TASK_STATUS} value={t.status} />
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
      <TaskModal opened={open} onClose={() => setOpen(false)} preset={{ unitId: e.unitId, eventId: id }} />
      <TaskDrawer task={tasks.data.find((t) => t.id === sel) ?? null} onClose={() => setSel(null)} />
    </Stack>
  );
}

function Participants({ e, id }: { e: HubEvent; id: string }) {
  const participants = useCollection<Participant>(`events/${id}/participants`, [], `pp-${id}`);
  const runs = useCollection<SyncRun>(`events/${id}/syncRuns`, [orderBy('at', 'desc')], `sr-${id}`);
  const [preview, setPreview] = useState<{ file: string; data: CsvPreview } | null>(null);
  const [busy, setBusy] = useState(false);

  const onDrop = async (files: File[]) => {
    const f = files[0];
    const text = await f.text();
    setPreview({ file: f.name, data: previewParticipantsCsv(text) });
  };

  const doImport = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const r = await importParticipants(id, preview.file, preview.data);
      notifySuccess(`${r.added} yeni, ${r.updated} güncellenen, ${r.duplicates} tekrar, ${r.errors} hatalı satır.`, 'Aktarım tamamlandı');
      setPreview(null);
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () =>
    downloadText(
      toCsv([['Ad Soyad', 'E-posta', 'Katıldı', 'Sertifika'], ...participants.data.map((p) => [p.name, p.email, p.attended ? 'Evet' : 'Hayır', p.certificate])]),
      `${e.code}_katilimcilar.csv`,
    );

  const attended = participants.data.filter((p) => p.attended).length;

  return (
    <Stack>
      <Alert color="blue" variant="light">
        HeptaCert'ten indirdiğiniz katılımcı CSV'sini yükleyin. Aynı dosyayı tekrar yüklemek çift kayıt oluşturmaz; kayıtlar e-posta
        adresine göre güncellenir. Temiz bir aktarım kapanış kontrolünü ve rapordaki katılımcı sayısını otomatik günceller.
        Katılımcı listesi kişisel veridir ve yalnızca etkinlik sorumluları ile birim yöneticileri görür.
      </Alert>
      <Group justify="flex-end">
        <Button
          size="xs"
          variant="subtle"
          leftSection={<IconDownload size={14} />}
          onClick={() => downloadText(toCsv([['Ad Soyad', 'E-posta', 'Katıldı', 'Sertifika'], ['Örnek Katılımcı', 'ornek@example.org', 'Evet', '']]), 'heptacert_aktarim_sablonu.csv')}
        >
          Aktarım şablonunu indir
        </Button>
      </Group>
      <Dropzone onDrop={(f) => void onDrop(f)} accept={['text/csv', 'application/vnd.ms-excel', 'text/plain']} maxFiles={1}>
        <Group justify="center" mih={80} style={{ pointerEvents: 'none' }}>
          <IconFileTypeCsv size={36} stroke={1.5} />
          <div>
            <Text fw={500}>CSV dosyasını sürükleyin veya seçin</Text>
            <Text size="xs" c="dimmed">
              Beklenen başlıklar: Ad Soyad, E-posta, Katıldı, Sertifika (virgül veya noktalı virgül)
            </Text>
          </div>
        </Group>
      </Dropzone>
      {preview && (
        <Card>
          <Stack>
            <Text fw={600}>Önizleme: {preview.file}</Text>
            <Group gap="xs">
              <Badge color="green">{preview.data.rows.length} geçerli</Badge>
              <Badge color="gray">{preview.data.duplicates} tekrar</Badge>
              <Badge color="red">{preview.data.errors.length} hata</Badge>
            </Group>
            {preview.data.errors.length > 0 && (
              <Alert color="red" variant="light">
                {preview.data.errors.slice(0, 8).map((x) => (
                  <div key={x}>{x}</div>
                ))}
                {preview.data.errors.length > 8 && <div>… ve {preview.data.errors.length - 8} satır daha</div>}
              </Alert>
            )}
            {preview.data.warnings.length > 0 && (
              <Alert color="yellow" variant="light">
                {preview.data.warnings.map((x) => <div key={x}>{x}</div>)}
              </Alert>
            )}
            <Table fz="sm">
              <Table.Tbody>
                {preview.data.rows.slice(0, 5).map((r) => (
                  <Table.Tr key={r.email}>
                    <Table.Td>{r.name}</Table.Td>
                    <Table.Td>{r.email}</Table.Td>
                    <Table.Td>{r.attended ? 'Katıldı' : '—'}</Table.Td>
                    <Table.Td>{r.certificate}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setPreview(null)}>
                Vazgeç
              </Button>
              <Button onClick={doImport} loading={busy} disabled={!preview.data.rows.length}>
                {preview.data.rows.length} kaydı aktar
              </Button>
            </Group>
          </Stack>
        </Card>
      )}
      <Group justify="space-between">
        <Text fw={600}>
          Katılımcılar: {participants.data.length} (katılan {attended})
        </Text>
        <Button size="xs" variant="default" leftSection={<IconDownload size={14} />} onClick={exportCsv} disabled={!participants.data.length}>
          CSV indir
        </Button>
      </Group>
      {participants.data.length > 0 && (
        <Table.ScrollContainer minWidth={560} mah={360}>
          <Table striped fz="sm">
            <Table.Tbody>
              {participants.data.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>{p.name}</Table.Td>
                  <Table.Td>{p.email}</Table.Td>
                  <Table.Td>{p.attended ? <Badge color="green">Katıldı</Badge> : <Badge color="gray">Kayıtlı</Badge>}</Table.Td>
                  <Table.Td>{p.certificate}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      {runs.data.length > 0 && (
        <Card>
          <Text fw={600} mb="xs">
            Aktarım geçmişi
          </Text>
          {runs.data.map((r) => (
            <Group key={r.id} gap="xs" align="center">
              <Badge size="xs" color={r.reconciled === false ? 'red' : r.errors ? 'orange' : 'green'}>
                {r.reconciled === false ? 'sayım hatası' : r.errors ? 'kısmi' : 'doğrulandı'}
              </Badge>
              <Text size="xs" c="dimmed">
                {fmtDateTime(r.at)} · {r.byName} · {r.fileName}: {r.total} satır = {r.added} yeni + {r.updated} güncellenen + {r.duplicates} tekrar + {r.errors} hatalı
                {r.dataContractVersion ? ` · ${r.dataContractVersion}` : ''}
              </Text>
            </Group>
          ))}
        </Card>
      )}
    </Stack>
  );
}

const CHECKLIST: { key: keyof HubEvent['checklist']; label: string }[] = [
  { key: 'dataTransferred', label: 'Katılımcı verileri HeptaCert’ten Hub’a aktarıldı' },
  { key: 'tasksClosed', label: 'Etkinlik görevleri kapatıldı' },
  { key: 'filesArchived', label: 'Fotoğraf ve dosyalar Drive arşivine kaldırıldı' },
  { key: 'budgetEntered', label: 'Bütçe gerçekleşen tutarları girildi' },
];

function Closing({ e, id, canManage }: { e: HubEvent; id: string; canManage: boolean }) {
  const { access, user } = useAuth();
  const [report, setReport] = useState(e.report);
  useEffect(() => setReport(e.report), [e.report]);
  const canApproveReport = hasPermission(access, 'events.manageAll');
  const ro = !canManage || e.reportApproved;

  return (
    <Grid gap="lg">
      <Grid.Col span={{ base: 12, md: 5 }}>
        <Card>
          <Text fw={600} mb="sm">
            Kapanış kontrol listesi
          </Text>
          <Stack gap="xs">
            {CHECKLIST.map((c) => (
              <Checkbox
                key={c.key}
                label={c.label}
                checked={e.checklist[c.key]}
                disabled={!canManage}
                onChange={(x) => updateEvent(id, { checklist: { ...e.checklist, [c.key]: x.currentTarget.checked } }).catch(notifyError)}
              />
            ))}
          </Stack>
        </Card>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 7 }}>
        <Card className="print-area">
          <Group justify="space-between" mb="sm">
            <Text fw={600}>Etkinlik sonu raporu</Text>
            {e.reportApproved ? <Badge color="green">Onaylandı</Badge> : <Badge color="gray">Taslak</Badge>}
          </Group>
          <Stack>
            <Text size="sm" c="dimmed">
              {e.code} · {e.name} · {e.unitName} · {fmtEventDate(e.startsAt)}
            </Text>
            <NumberInput label="Katılımcı sayısı" value={report.participantCount ?? ''} onChange={(v) => setReport({ ...report, participantCount: v === '' ? null : Number(v) })} readOnly={ro} />
            <Textarea label="Özet" autosize minRows={3} value={report.summary} onChange={(x) => setReport({ ...report, summary: x.currentTarget.value })} readOnly={ro} />
            <Textarea label="Çıktılar ve etki" autosize minRows={2} value={report.outcomes} onChange={(x) => setReport({ ...report, outcomes: x.currentTarget.value })} readOnly={ro} />
            <Textarea label="Öğrenilenler / öneriler" autosize minRows={2} value={report.lessons} onChange={(x) => setReport({ ...report, lessons: x.currentTarget.value })} readOnly={ro} />
            <Group justify="flex-end">
              <Button variant="default" leftSection={<IconPrinter size={16} />} onClick={() => window.print()}>
                Yazdır / PDF
              </Button>
              {!ro && (
                <Button onClick={() => updateEvent(id, { report }).then(() => notifySuccess('Rapor kaydedildi.')).catch(notifyError)}>
                  Raporu kaydet
                </Button>
              )}
              {canApproveReport && !e.reportApproved && (
                <Button
                  color="green"
                  leftSection={<IconCheck size={16} />}
                  onClick={() =>
                    updateEvent(id, { reportApproved: true, reportApprovedBy: user!.displayName ?? '' })
                      .then(() => notifySuccess('Etkinlik raporu onaylandı.'))
                      .catch(notifyError)
                  }
                >
                  Raporu onayla
                </Button>
              )}
            </Group>
            {e.reportApproved && e.reportApprovedBy && (
              <Text size="xs" c="dimmed">
                Onaylayan: {e.reportApprovedBy}
              </Text>
            )}
          </Stack>
        </Card>
      </Grid.Col>
    </Grid>
  );
}

function EventContent({ id }: { id: string }) {
  const requests = useCollection<ContentRequest>('contentRequests', [where('eventId', '==', id)], `ce-${id}`);
  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Etkinlik tanıtımı, etkinlik onaylanmadan yayına alınamaz.
        </Text>
        <Button component={Link} to={`/iletisim?etkinlik=${id}`} size="xs" leftSection={<IconPlus size={14} />}>
          İçerik talebi aç
        </Button>
      </Group>
      {requests.data.length === 0 ? (
        <EmptyState title="Bu etkinlik için içerik talebi yok" />
      ) : (
        <Table>
          <Table.Tbody>
            {requests.data.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>{CONTENT_TYPES[r.type] ?? r.type}</Table.Td>
                <Table.Td>{r.channels.join(', ')}</Table.Td>
                <Table.Td>
                  <MetaBadge map={CONTENT_STATUS} value={r.status} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
