import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconChevronLeft, IconChevronRight, IconPlus } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { addDoc, collection, doc, orderBy, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { MetaBadge } from '../../components/MetaBadge';
import { EmptyState, PageHeader, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { db } from '../../firebase';
import { hasPermission, hasUnitPermission } from '../../lib/access';
import { fmtDate, fmtRelative } from '../../lib/format';
import { useCollection } from '../../lib/hooks';
import { useActiveMembers } from '../../lib/members';
import { CHANNELS, CONTENT_STATUS, CONTENT_TYPES } from '../../lib/opsLabels';
import type { ContentRequest, ContentStatus, HubEvent } from '../../lib/opsTypes';
import { useOrg } from '../../lib/org';
import type { WithId } from '../../lib/types';
import { BRANCH } from '../../lib/types';

const BOARD: ContentStatus[] = ['requested', 'accepted', 'in_production', 'awaiting_approval', 'scheduled', 'published'];

export function ContentPage() {
  const { access, user } = useAuth();
  const { units } = useOrg();
  const [params] = useSearchParams();
  const requests = useCollection<ContentRequest>('contentRequests', [orderBy('createdAt', 'desc')], 'content');
  const isComms = hasPermission(access, 'content.manage');
  const [tab, setTab] = useState<string | null>(isComms ? 'pano' : 'talepler');
  const [newOpen, setNewOpen] = useState(!!params.get('etkinlik'));
  const [sel, setSel] = useState<string | null>(null);

  const requestUnits = [
    ...(isComms ? [{ value: BRANCH, label: 'Kol Geneli' }] : []),
    ...units
      .filter((u) => u.active && (hasUnitPermission(access, u.id, 'unit.events.propose') || hasUnitPermission(access, u.id, 'unit.manage') || isComms))
      .map((u) => ({ value: u.id, label: u.name })),
  ];
  const mine = requests.data.filter((r) => r.requestedBy === user!.uid || hasUnitPermission(access, r.requestingUnitId, 'unit.manage'));
  const selected = requests.data.find((r) => r.id === sel) ?? null;

  return (
    <Stack>
      <PageHeader
        title="İletişim"
        description="İçerik talepleri, iletişim biriminin üretim panosu ve yayın takvimi. Etkinlik tanıtımları, etkinlik onaylanmadan yayına alınamaz."
        actions={
          requestUnits.length > 0 && (
            <Button leftSection={<IconPlus size={18} />} onClick={() => setNewOpen(true)}>
              İçerik talebi
            </Button>
          )
        }
      />
      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List mb="md">
          {isComms && <Tabs.Tab value="pano">Üretim panosu</Tabs.Tab>}
          <Tabs.Tab value="talepler">Taleplerim ve birimim ({mine.length})</Tabs.Tab>
          <Tabs.Tab value="takvim">Yayın takvimi</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="pano">
          {requests.loading ? (
            <SectionLoader />
          ) : (
            <ScrollArea type="auto" offsetScrollbars>
              <Group align="flex-start" wrap="nowrap">
                {BOARD.map((s) => {
                  const col = requests.data.filter((r) => r.status === s);
                  return (
                    <Paper key={s} withBorder p="sm" w={250} miw={230} bg="var(--mantine-color-default-hover)">
                      <Group justify="space-between" mb="sm">
                        <MetaBadge map={CONTENT_STATUS} value={s} />
                        <Text size="sm" c="dimmed">
                          {col.length}
                        </Text>
                      </Group>
                      <Stack gap="xs">
                        {col.map((r) => (
                          <RequestCard key={r.id} r={r} onOpen={() => setSel(r.id)} />
                        ))}
                      </Stack>
                    </Paper>
                  );
                })}
              </Group>
            </ScrollArea>
          )}
        </Tabs.Panel>
        <Tabs.Panel value="talepler">
          {mine.length === 0 ? (
            <EmptyState title="Talep yok" />
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
              {mine.map((r) => (
                <RequestCard key={r.id} r={r} onOpen={() => setSel(r.id)} />
              ))}
            </SimpleGrid>
          )}
        </Tabs.Panel>
        <Tabs.Panel value="takvim">
          <CalendarView requests={requests.data} onOpen={setSel} />
        </Tabs.Panel>
      </Tabs>
      <NewRequest opened={newOpen} onClose={() => setNewOpen(false)} unitChoices={requestUnits} presetEventId={params.get('etkinlik')} />
      <RequestDrawer r={selected} onClose={() => setSel(null)} />
    </Stack>
  );
}

function RequestCard({ r, onOpen }: { r: WithId<ContentRequest>; onOpen: () => void }) {
  const date = r.scheduledDate ?? r.desiredPublishDate;
  return (
    <Card padding="sm" radius="md" onClick={onOpen} style={{ cursor: 'pointer' }}>
      <Group justify="space-between" gap={4} wrap="nowrap">
        <Text size="xs" c="dimmed">
          {CONTENT_TYPES[r.type] ?? r.type}
        </Text>
        <MetaBadge map={CONTENT_STATUS} value={r.status} size="xs" />
      </Group>
      <Text size="sm" fw={600} lineClamp={2} mt={4}>
        {r.eventName ?? r.brief.slice(0, 60)}
      </Text>
      <Text size="xs" c="dimmed" mt={4}>
        {r.requestingUnitName} · {date ? fmtDate(new Date(date)) : 'tarih yok'}
      </Text>
      <Group gap={4} mt={4}>
        {r.channels.slice(0, 3).map((c) => (
          <Badge key={c} size="xs" variant="outline" color="gray">
            {c}
          </Badge>
        ))}
      </Group>
    </Card>
  );
}

function NewRequest({
  opened,
  onClose,
  unitChoices,
  presetEventId,
}: {
  opened: boolean;
  onClose: () => void;
  unitChoices: { value: string; label: string }[];
  presetEventId: string | null;
}) {
  const { user } = useAuth();
  const { unitName } = useOrg();
  const events = useCollection<HubEvent>(opened ? 'events' : null, [orderBy('createdAt', 'desc')], 'ev-content');
  const [f, setF] = useState({
    requestingUnitId: '',
    type: 'announcement',
    channels: ['Instagram'] as string[],
    desiredPublishDate: null as string | null,
    brief: '',
    assets: '',
    eventId: null as string | null,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (opened && presetEventId && events.data.length) {
      const ev = events.data.find((e) => e.id === presetEventId);
      if (ev) setF((x) => ({ ...x, eventId: ev.id, requestingUnitId: ev.unitId, type: 'event_promo' }));
    }
  }, [opened, presetEventId, events.data]);

  const save = async () => {
    if (!f.requestingUnitId || !f.brief.trim()) return notifyError(new Error('Birim ve talep açıklaması zorunludur.'), 'Eksik bilgi');
    setBusy(true);
    const ev = events.data.find((e) => e.id === f.eventId);
    try {
      await addDoc(collection(db, 'contentRequests'), {
        ...f,
        requestingUnitName: unitName(f.requestingUnitId),
        requestedBy: user!.uid,
        requestedByName: user!.displayName ?? '',
        eventName: ev?.name ?? null,
        draftText: '',
        assigneeUid: null,
        assigneeName: null,
        status: 'requested',
        scheduledDate: null,
        publishedLink: '',
        performance: { reach: null, engagement: null },
        rejectReason: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      notifySuccess('Talep iletişim birimine iletildi.');
      onClose();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="İçerik talebi" size="lg">
      <Stack>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select label="Talep eden birim" data={unitChoices} value={f.requestingUnitId || null} onChange={(v) => setF({ ...f, requestingUnitId: v ?? '' })} required />
          <Select label="Tür" data={Object.entries(CONTENT_TYPES).map(([value, label]) => ({ value, label }))} value={f.type} onChange={(v) => setF({ ...f, type: v ?? 'other' })} />
        </SimpleGrid>
        <Select
          label="İlgili etkinlik"
          data={events.data.filter((e) => !f.requestingUnitId || e.unitId === f.requestingUnitId).map((e) => ({ value: e.id, label: `${e.code} · ${e.name}` }))}
          value={f.eventId}
          onChange={(v) => setF({ ...f, eventId: v })}
          clearable
          allowDeselect
          searchable
        />
        <MultiSelect label="Kanallar" data={CHANNELS} value={f.channels} onChange={(v) => setF({ ...f, channels: v })} />
        <DateInput label="İstenen yayın tarihi" valueFormat="DD.MM.YYYY" value={f.desiredPublishDate} onChange={(v) => setF({ ...f, desiredPublishDate: v })} clearable />
        <Textarea label="Talep açıklaması (brief)" description="Hedef kitle, ana mesaj, olmazsa olmaz bilgiler" autosize minRows={4} value={f.brief} onChange={(e) => setF({ ...f, brief: e.currentTarget.value })} required />
        <TextInput label="Görseller / dosyalar (Drive bağlantısı)" value={f.assets} onChange={(e) => setF({ ...f, assets: e.currentTarget.value })} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Vazgeç
          </Button>
          <Button onClick={save} loading={busy}>
            Gönder
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function RequestDrawer({ r, onClose }: { r: WithId<ContentRequest> | null; onClose: () => void }) {
  const { access, user } = useAuth();
  const { options, nameOf } = useActiveMembers(!!r);
  const [f, setF] = useState<WithId<ContentRequest> | null>(r);
  const [note, setNote] = useState('');
  useEffect(() => setF(r), [r]);
  if (!r || !f) return null;
  const isComms = hasPermission(access, 'content.manage');
  const isApprover = r.requestingUnitId === BRANCH ? isComms : hasUnitPermission(access, r.requestingUnitId, 'unit.manage');

  const patch = async (p: Partial<ContentRequest> & Record<string, unknown>, msg: string) => {
    try {
      await updateDoc(doc(db, 'contentRequests', r.id), { ...p, updatedAt: serverTimestamp() });
      notifySuccess(msg);
    } catch (e) {
      notifyError(e);
    }
  };

  const save = () =>
    patch(
      {
        assigneeUid: f.assigneeUid,
        assigneeName: f.assigneeUid ? nameOf(f.assigneeUid) : null,
        draftText: f.draftText,
        scheduledDate: f.scheduledDate,
        publishedLink: f.publishedLink,
        performance: f.performance,
        channels: f.channels,
      },
      'Kaydedildi.',
    );

  return (
    <Drawer opened={!!r} onClose={onClose} position="right" size="lg" title={<Text fw={700}>{CONTENT_TYPES[r.type] ?? r.type}</Text>}>
      <Stack>
        <Group gap={6}>
          <MetaBadge map={CONTENT_STATUS} value={r.status} />
          <Badge variant="light" color="gray">
            {r.requestingUnitName}
          </Badge>
          {r.eventName && <Badge variant="outline">{r.eventName}</Badge>}
        </Group>
        <Text size="sm" c="dimmed">
          {r.requestedByName} · {fmtRelative(r.createdAt)} · istenen tarih {r.desiredPublishDate ? fmtDate(new Date(r.desiredPublishDate)) : '—'}
        </Text>
        <Text style={{ whiteSpace: 'pre-wrap' }}>{r.brief}</Text>
        {r.assets && (
          <Anchor href={r.assets} target="_blank" size="sm">
            Dosyalar
          </Anchor>
        )}
        {r.rejectReason && <Alert color="red">Red gerekçesi: {r.rejectReason}</Alert>}
        {r.approvalNote && <Alert color="blue">Birim notu: {r.approvalNote}</Alert>}

        {isComms && !['published', 'rejected', 'cancelled'].includes(r.status) && (
          <Card>
            <Stack>
              <Select label="Sorumlu (iletişim birimi)" data={options} value={f.assigneeUid} onChange={(v) => setF({ ...f, assigneeUid: v })} searchable clearable allowDeselect />
              <MultiSelect label="Kanallar" data={CHANNELS} value={f.channels} onChange={(v) => setF({ ...f, channels: v })} />
              <Textarea label="Metin taslağı" autosize minRows={4} value={f.draftText} onChange={(e) => setF({ ...f, draftText: e.currentTarget.value })} />
              <DateInput label="Planlanan yayın tarihi" valueFormat="DD.MM.YYYY" value={f.scheduledDate} onChange={(v) => setF({ ...f, scheduledDate: v })} clearable />
              <Group>
                <Button variant="default" onClick={() => void save()}>
                  Kaydet
                </Button>
                {r.status === 'requested' && <Button onClick={() => void patch({ status: 'accepted' }, 'Talep kabul edildi.')}>Kabul et</Button>}
                {(r.status === 'accepted' || r.status === 'requested') && (
                  <Button variant="light" onClick={() => void patch({ status: 'in_production' }, 'Hazırlanıyor.')}>
                    Hazırlamaya başla
                  </Button>
                )}
                {r.status === 'in_production' && (
                  <Button
                    onClick={() =>
                      void patch(
                        r.requestingUnitId === BRANCH ? { status: 'scheduled', draftText: f.draftText } : { status: 'awaiting_approval', draftText: f.draftText },
                        r.requestingUnitId === BRANCH ? 'Yayına hazır.' : 'Birim onayına gönderildi.',
                      )
                    }
                  >
                    {r.requestingUnitId === BRANCH ? 'Yayına hazır' : 'Birim onayına gönder'}
                  </Button>
                )}
              </Group>
              {r.status === 'scheduled' && (
                <Group align="flex-end">
                  <TextInput label="Yayın bağlantısı" style={{ flex: 1 }} value={f.publishedLink} onChange={(e) => setF({ ...f, publishedLink: e.currentTarget.value })} />
                  <Button color="green" onClick={() => void patch({ status: 'published', publishedLink: f.publishedLink }, 'Yayımlandı olarak işaretlendi.')}>
                    Yayımlandı
                  </Button>
                </Group>
              )}
              <Group align="flex-end">
                <TextInput label="Red gerekçesi" style={{ flex: 1 }} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
                <Button color="red" variant="light" disabled={!note.trim()} onClick={() => void patch({ status: 'rejected', rejectReason: note }, 'Talep reddedildi.')}>
                  Reddet
                </Button>
              </Group>
            </Stack>
          </Card>
        )}

        {r.status === 'awaiting_approval' && isApprover && (
          <Card style={{ borderColor: 'var(--mantine-color-yellow-5)', borderWidth: 2 }}>
            <Stack>
              <Text fw={600}>Birim onayınız bekleniyor</Text>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {r.draftText || 'Metin taslağı yok.'}
              </Text>
              <Textarea label="Not" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
              <Group>
                <Button color="green" onClick={() => void patch({ status: 'scheduled', approvedBy: user!.uid, approvedByName: user!.displayName ?? '', approvedAt: serverTimestamp(), approvalNote: note }, 'İçerik onaylandı.')}>
                  Onayla
                </Button>
                <Button variant="light" color="orange" onClick={() => void patch({ status: 'in_production', approvedBy: user!.uid, approvedByName: user!.displayName ?? '', approvedAt: serverTimestamp(), approvalNote: note }, 'Düzeltme için geri gönderildi.')}>
                  Düzeltme iste
                </Button>
              </Group>
            </Stack>
          </Card>
        )}

        {r.status === 'published' && (
          <Card>
            <Stack>
              <Text fw={600}>Yayın sonrası performans</Text>
              {r.publishedLink && (
                <Anchor href={r.publishedLink} target="_blank" size="sm">
                  Yayın
                </Anchor>
              )}
              <Group grow>
                <NumberInput label="Erişim" value={f.performance.reach ?? ''} onChange={(v) => setF({ ...f, performance: { ...f.performance, reach: v === '' ? null : Number(v) } })} readOnly={!isComms} />
                <NumberInput label="Etkileşim" value={f.performance.engagement ?? ''} onChange={(v) => setF({ ...f, performance: { ...f.performance, engagement: v === '' ? null : Number(v) } })} readOnly={!isComms} />
              </Group>
              {isComms && (
                <Button variant="default" onClick={() => void save()}>
                  Kaydet
                </Button>
              )}
            </Stack>
          </Card>
        )}

        {r.requestedBy === user!.uid && r.status === 'requested' && (
          <Button variant="subtle" color="red" onClick={() => void patch({ status: 'cancelled' }, 'Talep iptal edildi.')}>
            Talebi iptal et
          </Button>
        )}
      </Stack>
    </Drawer>
  );
}

function CalendarView({ requests, onOpen }: { requests: WithId<ContentRequest>[]; onOpen: (id: string) => void }) {
  const [month, setMonth] = useState(dayjs().startOf('month'));
  const items = useMemo(
    () =>
      requests
        .filter((r) => !['rejected', 'cancelled'].includes(r.status))
        .map((r) => ({ r, date: r.scheduledDate ?? r.desiredPublishDate }))
        .filter((x) => x.date),
    [requests],
  );
  const start = month.startOf('month').subtract((month.startOf('month').day() + 6) % 7, 'day');
  const days = Array.from({ length: 42 }, (_, i) => start.add(i, 'day'));
  return (
    <Stack>
      <Group justify="space-between">
        <ActionIcon variant="default" onClick={() => setMonth(month.subtract(1, 'month'))} aria-label="Önceki ay">
          <IconChevronLeft size={16} />
        </ActionIcon>
        <Text fw={600}>{month.format('MMMM YYYY')}</Text>
        <ActionIcon variant="default" onClick={() => setMonth(month.add(1, 'month'))} aria-label="Sonraki ay">
          <IconChevronRight size={16} />
        </ActionIcon>
      </Group>
      <ScrollArea type="auto">
        <SimpleGrid cols={7} spacing={4} miw={700}>
          {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d) => (
            <Text key={d} size="xs" c="dimmed" ta="center" fw={600}>
              {d}
            </Text>
          ))}
          {days.map((d) => {
            const list = items.filter((x) => dayjs(x.date).isSame(d, 'day'));
            return (
              <Paper key={d.toString()} withBorder p={4} mih={86} opacity={d.month() === month.month() ? 1 : 0.45}>
                <Text size="xs" fw={d.isSame(dayjs(), 'day') ? 700 : 400} c={d.isSame(dayjs(), 'day') ? 'blue' : undefined}>
                  {d.date()}
                </Text>
                <Stack gap={2}>
                  {list.map(({ r }) => (
                    <Badge
                      key={r.id}
                      size="xs"
                      color={CONTENT_STATUS[r.status].color}
                      variant={r.scheduledDate ? 'filled' : 'light'}
                      style={{ cursor: 'pointer', maxWidth: '100%' }}
                      onClick={() => onOpen(r.id)}
                    >
                      {(r.eventName ?? CONTENT_TYPES[r.type]).slice(0, 18)}
                    </Badge>
                  ))}
                </Stack>
              </Paper>
            );
          })}
        </SimpleGrid>
      </ScrollArea>
      <Text size="xs" c="dimmed">
        Dolu rozet: planlanan yayın tarihi. Açık rozet: talep edilen tarih.
      </Text>
    </Stack>
  );
}
