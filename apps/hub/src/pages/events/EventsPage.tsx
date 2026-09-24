import { Badge, Button, Card, Group, Modal, MultiSelect, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { modals } from '@mantine/modals';
import { IconCalendarPlus, IconCheck, IconMapPin, IconX } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { orderBy } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { MetaBadge } from '../../components/MetaBadge';
import { EmptyState, PageHeader, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { hasPermission, hasUnitPermission } from '../../lib/access';
import { useCollection } from '../../lib/hooks';
import { useActiveMembers } from '../../lib/members';
import { decideEvent, proposeEvent } from '../../lib/ops';
import { EVENT_STATUS, EVENT_TYPES } from '../../lib/opsLabels';
import type { HubEvent } from '../../lib/opsTypes';
import { useOrg } from '../../lib/org';
import type { WithId } from '../../lib/types';

export function fmtEventDate(s: string | null) {
  return s ? dayjs(s).format('DD MMM YYYY, HH:mm') : 'Tarih belirlenmedi';
}

export function EventsPage() {
  const { access } = useAuth();
  const { units, unitOptions } = useOrg();
  const navigate = useNavigate();
  const events = useCollection<HubEvent>('events', [orderBy('createdAt', 'desc')], 'events');
  const [view, setView] = useState('upcoming');
  const [unit, setUnit] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const canApprove = hasPermission(access, 'events.approve');
  const proposeUnits = units.filter(
    (u) => u.active && (hasUnitPermission(access, u.id, 'unit.events.propose', 'events.manageAll') || hasUnitPermission(access, u.id, 'unit.manage')),
  );

  const now = Date.now();
  const list = useMemo(() => {
    return events.data
      .filter((e) => !unit || e.unitId === unit)
      .filter((e) => {
        const t = e.startsAt ? new Date(e.startsAt).getTime() : Infinity;
        if (view === 'upcoming') return !['rejected', 'cancelled', 'archived', 'reported'].includes(e.status) && (t >= now - 864e5 || e.status === 'proposed');
        if (view === 'past') return ['held', 'closing', 'reported', 'archived'].includes(e.status) || (t < now - 864e5 && e.status !== 'proposed');
        return true;
      })
      .sort((a, b) => (a.startsAt ?? '9999').localeCompare(b.startsAt ?? '9999') * (view === 'past' ? -1 : 1));
  }, [events.data, unit, view, now]);

  const pending = events.data.filter((e) => e.status === 'proposed');

  const decide = (e: WithId<HubEvent>, approve: boolean) => {
    let note = '';
    modals.openConfirmModal({
      title: `${e.name} ${approve ? 'onaylansın' : 'reddedilsin'} mı?`,
      children: <Textarea label="Karar notu" onChange={(x) => (note = x.currentTarget.value)} />,
      labels: { confirm: approve ? 'Onayla' : 'Reddet', cancel: 'Vazgeç' },
      confirmProps: { color: approve ? 'green' : 'red' },
      onConfirm: () => decideEvent(e.id, approve, note).then(() => notifySuccess('Karar kaydedildi.')).catch(notifyError),
    });
  };

  return (
    <Stack>
      <PageHeader
        title="Etkinlikler"
        description="Öneriden kapanış raporuna kadar tüm etkinlikler. Etkinlik, YK kararıyla veya onaylanmış etkinlik izin dilekçesiyle onaylanır."
        actions={
          proposeUnits.length > 0 && (
            <Button leftSection={<IconCalendarPlus size={18} />} onClick={() => setOpen(true)}>
              Etkinlik öner
            </Button>
          )
        }
      />

      {canApprove && pending.length > 0 && (
        <Card style={{ borderColor: 'var(--mantine-color-yellow-5)', borderWidth: 2 }}>
          <Text fw={600} mb="sm">
            Onay bekleyen öneriler ({pending.length})
          </Text>
          <Stack gap="xs">
            {pending.map((e) => (
              <Group key={e.id} justify="space-between" wrap="wrap">
                <div>
                  <Text component={Link} to={`/etkinlikler/${e.id}`} fw={500} size="sm">
                    {e.code} · {e.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {e.unitName} · {fmtEventDate(e.startsAt)} · öneren {e.createdByName}
                  </Text>
                </div>
                <Group gap="xs">
                  <Button size="xs" color="green" leftSection={<IconCheck size={14} />} onClick={() => decide(e, true)}>
                    Onayla
                  </Button>
                  <Button size="xs" variant="light" color="red" leftSection={<IconX size={14} />} onClick={() => decide(e, false)}>
                    Reddet
                  </Button>
                </Group>
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      <Group wrap="wrap">
        <SegmentedControl
          value={view}
          onChange={setView}
          data={[
            { value: 'upcoming', label: 'Yaklaşan ve süreçteki' },
            { value: 'past', label: 'Geçmiş' },
            { value: 'all', label: 'Tümü' },
          ]}
        />
        <Select placeholder="Birim" data={unitOptions({ onlyActive: false })} value={unit} onChange={setUnit} clearable allowDeselect searchable w={240} />
      </Group>

      {events.loading ? (
        <SectionLoader />
      ) : list.length === 0 ? (
        <EmptyState title="Etkinlik yok" />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {list.map((e) => (
            <Card key={e.id} component={Link} to={`/etkinlikler/${e.id}`} style={{ textDecoration: 'none' }}>
              <Group justify="space-between" mb={6} wrap="nowrap">
                <MetaBadge map={EVENT_STATUS} value={e.status} />
                <Text size="xs" c="dimmed" ff="monospace">
                  {e.code}
                </Text>
              </Group>
              <Text fw={600} lineClamp={2}>
                {e.name}
              </Text>
              <Text size="sm" c="dimmed">
                {fmtEventDate(e.startsAt)}
              </Text>
              <Group gap={4} mt={6}>
                <Badge variant="light" color="gray">
                  {e.unitName}
                </Badge>
                {e.location && (
                  <Badge variant="outline" color="gray" leftSection={<IconMapPin size={10} />}>
                    {e.location.slice(0, 28)}
                  </Badge>
                )}
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <ProposeModal opened={open} onClose={() => setOpen(false)} unitChoices={proposeUnits.map((u) => ({ value: u.id, label: u.name }))} onCreated={(id) => navigate(`/etkinlikler/${id}`)} />
    </Stack>
  );
}

function ProposeModal({
  opened,
  onClose,
  unitChoices,
  onCreated,
}: {
  opened: boolean;
  onClose: () => void;
  unitChoices: { value: string; label: string }[];
  onCreated: (id: string) => void;
}) {
  const { user } = useAuth();
  const { unitName } = useOrg();
  const { options, nameOf } = useActiveMembers(opened);
  const [f, setF] = useState({
    name: '',
    unitId: '',
    type: EVENT_TYPES[0],
    description: '',
    startsAt: null as string | null,
    endsAt: null as string | null,
    location: '',
    expectedParticipants: null as number | null,
    ownerUids: [] as string[],
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!f.name.trim() || !f.unitId) return notifyError(new Error('Ad ve birim zorunludur.'), 'Eksik bilgi');
    setBusy(true);
    const owners = f.ownerUids.length ? f.ownerUids : [user!.uid];
    try {
      const id = await proposeEvent({ ...f, unitName: unitName(f.unitId), ownerUids: owners, ownerNames: owners.map(nameOf) });
      notifySuccess('Öneri YK onayına sunuldu.', 'Etkinlik önerildi');
      onClose();
      onCreated(id);
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Etkinlik öner" size="lg">
      <Stack>
        <TextInput label="Etkinlik adı" required value={f.name} onChange={(e) => setF({ ...f, name: e.currentTarget.value })} />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select label="Düzenleyen birim" required data={unitChoices} value={f.unitId || null} onChange={(v) => setF({ ...f, unitId: v ?? '' })} />
          <Select label="Tür" data={EVENT_TYPES} value={f.type} onChange={(v) => setF({ ...f, type: v ?? EVENT_TYPES[0] })} />
          <DateTimePicker label="Başlangıç" valueFormat="DD.MM.YYYY HH:mm" value={f.startsAt} onChange={(v) => setF({ ...f, startsAt: v })} clearable />
          <DateTimePicker label="Bitiş" valueFormat="DD.MM.YYYY HH:mm" value={f.endsAt} onChange={(v) => setF({ ...f, endsAt: v })} clearable />
          <TextInput label="Yer" value={f.location} onChange={(e) => setF({ ...f, location: e.currentTarget.value })} />
          <NumberInput label="Tahmini katılımcı" min={0} value={f.expectedParticipants ?? ''} onChange={(v) => setF({ ...f, expectedParticipants: v === '' ? null : Number(v) })} />
        </SimpleGrid>
        <MultiSelect label="Etkinlik sorumluları" description="Boş bırakılırsa siz sorumlu olursunuz" data={options} value={f.ownerUids} onChange={(v) => setF({ ...f, ownerUids: v })} searchable />
        <Textarea label="Açıklama ve amaç" autosize minRows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.currentTarget.value })} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Vazgeç
          </Button>
          <Button onClick={save} loading={busy}>
            Öneriyi gönder
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
