import { Anchor, Badge, Button, Card, Group, Modal, SegmentedControl, Select, SimpleGrid, Stack, Table, Text, TextInput, Textarea } from '@mantine/core';
import { IconBan, IconPlus, IconSearch } from '@tabler/icons-react';
import { orderBy } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorAlert, PageHeader, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { addEventRestriction, liftEventRestriction } from '../../lib/eventRestrictions';
import { fmtDateTime } from '../../lib/format';
import { useCollection } from '../../lib/hooks';
import type { EventRestriction, EventRestrictionLevel, HubEvent } from '../../lib/opsTypes';
import type { WithId } from '../../lib/types';

const blank = () => ({ personName: '', email: '', level: 'blocked' as EventRestrictionLevel, reason: '', sourceEventId: null as string | null, evidenceLink: '', endsOn: null as string | null, reviewOn: null as string | null });

function current(item: EventRestriction, today = new Date().toISOString().slice(0, 10)) {
  return item.active && (!item.endsOn || item.endsOn >= today);
}

export function EventRestrictionsPage() {
  const restrictions = useCollection<EventRestriction>('eventRestrictions', [orderBy('createdAt', 'desc')], 'event-restrictions');
  const events = useCollection<HubEvent>('events', [orderBy('createdAt', 'desc')], 'restriction-events');
  const [filter, setFilter] = useState('active');
  const [query, setQuery] = useState('');
  const [opened, setOpened] = useState(false);
  const [form, setForm] = useState(blank());
  const [lift, setLift] = useState<{ item: WithId<EventRestriction>; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => restrictions.data.filter((item) => {
    const isCurrent = current(item);
    if (filter === 'active' && !isCurrent) return false;
    if (filter === 'blocked' && (!isCurrent || item.level !== 'blocked')) return false;
    if (filter === 'watch' && (!isCurrent || item.level !== 'watch')) return false;
    if (filter === 'history' && isCurrent) return false;
    const q = query.trim().toLocaleLowerCase('tr-TR');
    return !q || `${item.personName} ${item.email} ${item.reason}`.toLocaleLowerCase('tr-TR').includes(q);
  }), [restrictions.data, filter, query]);

  const eventOptions = events.data.map((event) => ({ value: event.id, label: `${event.code} · ${event.name}` }));

  const save = async () => {
    setBusy(true);
    try {
      const source = events.data.find((event) => event.id === form.sourceEventId);
      await addEventRestriction({ ...form, sourceEventName: source?.name ?? '' });
      setForm(blank()); setOpened(false); notifySuccess('Etkinlik kısıtlaması dönemler arası kayıt altına alındı.');
    } catch (error) { notifyError(error); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!lift) return;
    setBusy(true);
    try {
      await liftEventRestriction(lift.item.id, lift.item.emailHash, lift.reason);
      setLift(null); notifySuccess('Kısıtlama kaldırıldı; geçmiş kayıt korundu.');
    } catch (error) { notifyError(error); } finally { setBusy(false); }
  };

  return <Stack>
    <PageHeader title="Etkinlik kısıtlamaları" description="Etkinliğe alınmaması gereken veya yönetici dikkati gerektiren kişileri dönemlerden bağımsız ve denetlenebilir biçimde yönetin." actions={<Button leftSection={<IconPlus size={16} />} onClick={() => setOpened(true)}>Kısıtlama ekle</Button>} />
    <Card withBorder>
      <Stack gap="sm">
        <Text size="sm">Bu kayıtlar üyelikten ayrıdır. <b>Katılım engeli</b> HeptaCert/CSV aktarımını durdurur; <b>dikkat kaydı</b> sorumluya uyarı gösterir. Gerekçeler yalnız üye yönetimi yetkisi olanlarca görülür.</Text>
        <Group wrap="wrap">
          <SegmentedControl value={filter} onChange={setFilter} data={[{ value: 'active', label: 'Etkin' }, { value: 'blocked', label: 'Engelliler' }, { value: 'watch', label: 'Dikkat kayıtları' }, { value: 'history', label: 'Geçmiş' }, { value: 'all', label: 'Tümü' }]} />
          <TextInput placeholder="Ad, e-posta veya gerekçe ara" leftSection={<IconSearch size={16} />} value={query} onChange={(event) => setQuery(event.currentTarget.value)} style={{ flex: '1 1 280px' }} />
        </Group>
      </Stack>
    </Card>
    <ErrorAlert error={restrictions.error} />
    {restrictions.loading ? <SectionLoader /> : rows.length === 0 ? <EmptyState title="Kısıtlama kaydı yok" /> : <Table.ScrollContainer minWidth={1000}><Table striped highlightOnHover><Table.Thead><Table.Tr><Table.Th>Kişi</Table.Th><Table.Th>Seviye</Table.Th><Table.Th>Gerekçe</Table.Th><Table.Th>Kaynak</Table.Th><Table.Th>Süre</Table.Th><Table.Th>Kayıt</Table.Th><Table.Th /></Table.Tr></Table.Thead><Table.Tbody>{rows.map((item) => { const isCurrent = current(item); return <Table.Tr key={item.id}><Table.Td><Text fw={600}>{item.personName}</Text><Text size="xs" c="dimmed">{item.email}</Text></Table.Td><Table.Td><Badge color={!isCurrent ? 'gray' : item.level === 'blocked' ? 'red' : 'yellow'}>{!isCurrent ? 'Sona erdi' : item.level === 'blocked' ? 'Katılım engeli' : 'Dikkat kaydı'}</Badge></Table.Td><Table.Td><Text size="sm" lineClamp={3}>{item.reason}</Text>{item.evidenceLink && <Anchor href={item.evidenceLink} target="_blank" size="xs">Kanıt/olay bağlantısı</Anchor>}</Table.Td><Table.Td>{item.sourceEventName || '—'}</Table.Td><Table.Td><Text size="sm">{item.endsOn ? `${item.endsOn} tarihine kadar` : 'Dönemler arası · süresiz'}</Text>{item.reviewOn && <Text size="xs" c="dimmed">İnceleme: {item.reviewOn}</Text>}</Table.Td><Table.Td><Text size="sm">{item.createdByName}</Text><Text size="xs" c="dimmed">{fmtDateTime(item.createdAt)}</Text>{item.liftReason && <Text size="xs" c="dimmed">Kaldırma: {item.liftReason}</Text>}</Table.Td><Table.Td>{isCurrent && <Button size="xs" variant="light" color="orange" onClick={() => setLift({ item, reason: '' })}>Kaldır</Button>}</Table.Td></Table.Tr>; })}</Table.Tbody></Table></Table.ScrollContainer>}

    <Modal opened={opened} onClose={() => setOpened(false)} title="Dönemler arası etkinlik kısıtlaması" size="lg"><Stack>
      <SimpleGrid cols={{ base: 1, sm: 2 }}><TextInput label="Kişi adı" required value={form.personName} onChange={(event) => setForm({ ...form, personName: event.currentTarget.value })} /><TextInput label="E-posta" description="Katılımcı aktarımında eşleştirme anahtarıdır" required value={form.email} onChange={(event) => setForm({ ...form, email: event.currentTarget.value })} /></SimpleGrid>
      <SegmentedControl fullWidth value={form.level} onChange={(value) => setForm({ ...form, level: value as EventRestrictionLevel })} data={[{ value: 'blocked', label: 'Katılım engeli' }, { value: 'watch', label: 'Yönetici dikkat kaydı' }]} />
      <Textarea label="Somut olay ve gerekçe" description="Hakaret içermeyen, doğrulanabilir ve işle ilgili açıklama yazın." required autosize minRows={4} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.currentTarget.value })} />
      <Select label="Kaynak etkinlik" clearable searchable data={eventOptions} value={form.sourceEventId} onChange={(value) => setForm({ ...form, sourceEventId: value })} />
      <TextInput label="Kanıt / olay kaydı bağlantısı" placeholder="Drive bağlantısı (isteğe bağlı)" value={form.evidenceLink} onChange={(event) => setForm({ ...form, evidenceLink: event.currentTarget.value })} />
      <SimpleGrid cols={{ base: 1, sm: 2 }}><TextInput type="date" label="Bitiş tarihi" description="Boşsa dönemler arası süresiz" value={form.endsOn ?? ''} onChange={(event) => setForm({ ...form, endsOn: event.currentTarget.value || null })} /><TextInput type="date" label="Yeniden inceleme tarihi" value={form.reviewOn ?? ''} onChange={(event) => setForm({ ...form, reviewOn: event.currentTarget.value || null })} /></SimpleGrid>
      <Group justify="flex-end"><Button variant="default" onClick={() => setOpened(false)}>Vazgeç</Button><Button color={form.level === 'blocked' ? 'red' : 'yellow'} leftSection={<IconBan size={16} />} onClick={save} loading={busy} disabled={!form.personName.trim() || !form.email.trim() || form.reason.trim().length < 10}>Kaydı oluştur</Button></Group>
    </Stack></Modal>

    <Modal opened={!!lift} onClose={() => setLift(null)} title="Kısıtlamayı kaldır">{lift && <Stack><Text size="sm"><b>{lift.item.personName}</b> için kayıt pasifleştirilecek; geçmiş ve denetim izi korunacak.</Text><Textarea label="Kaldırma gerekçesi" required value={lift.reason} onChange={(event) => setLift({ ...lift, reason: event.currentTarget.value })} /><Group justify="flex-end"><Button variant="default" onClick={() => setLift(null)}>Vazgeç</Button><Button color="orange" onClick={remove} loading={busy} disabled={lift.reason.trim().length < 5}>Kısıtlamayı kaldır</Button></Group></Stack>}</Modal>
  </Stack>;
}
