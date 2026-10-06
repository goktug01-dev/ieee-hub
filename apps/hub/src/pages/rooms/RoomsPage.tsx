import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Textarea,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { modals } from '@mantine/modals';
import { IconAlertTriangle, IconChevronLeft, IconChevronRight, IconDoor, IconEdit, IconInfoCircle, IconPlus, IconSettings } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, PageHeader, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { hasUnitPermission } from '../../lib/access';
import { useCollection } from '../../lib/hooks';
import { useOrg } from '../../lib/org';
import {
  DEFAULT_ROOM,
  ROOM_KIND_META,
  SLOTS_PER_DAY,
  addDays,
  cancelBooking,
  conflictingBookings,
  createBooking,
  daysBetween,
  groupBookings,
  roomNow,
  saveRoom,
  slotEnded,
  slotRange,
  slotTime,
  validateBookingRequest,
  validateRoom,
  weekStart,
  type Room,
  type RoomBooking,
  type RoomBookingKind,
  type RoomInput,
  type RoomSlot,
} from '../../lib/rooms';
import type { Unit, WithId } from '../../lib/types';
import { useUnitScope } from '../../lib/unitScope';

const ROW_HEIGHT = 26;
const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const SLOT_OPTIONS = Array.from({ length: SLOTS_PER_DAY + 1 }, (_, slot) => ({ value: String(slot), label: slotTime(slot) }));
const KIND_OPTIONS = (Object.keys(ROOM_KIND_META) as RoomBookingKind[]).map((kind) => ({ value: kind, label: ROOM_KIND_META[kind].label }));

interface Draft {
  date: string;
  startSlot: number;
  endSlot: number;
}

export function RoomsPage() {
  const { user, member, access, can } = useAuth();
  const { units } = useOrg();
  const { selectedUnitId } = useUnitScope();
  const rooms = useCollection<Room>('rooms', [], 'rooms');
  const [now, setNow] = useState(Date.now());
  const today = roomNow(now).date;
  const [week, setWeek] = useState(() => weekStart(roomNow().date));
  const weekEnd = addDays(week, 6);
  const slots = useCollection<RoomSlot>('roomSlots', [where('date', '>=', week), where('date', '<=', weekEnd)], `roomSlots:${week}`);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [detail, setDetail] = useState<RoomBooking | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const canManageRooms = can('org.manage');
  const reserveUnits = useMemo(
    () => units.filter((unit) => unit.active && hasUnitPermission(access, unit.id, 'unit.room.reserve')),
    [units, access],
  );
  const canReserve = reserveUnits.length > 0;

  const sortedRooms = useMemo(() => [...rooms.data].sort((a, b) => a.name.localeCompare(b.name, 'tr')), [rooms.data]);
  const activeRooms = sortedRooms.filter((room) => room.active);
  const room = activeRooms.find((r) => r.id === roomId) ?? activeRooms[0] ?? null;

  const bookings = useMemo(
    () => groupBookings(slots.data).filter((booking) => booking.roomId === room?.id),
    [slots.data, room?.id],
  );

  const canCancel = (booking: RoomBooking) => {
    if (canManageRooms) return true;
    const remaining = !slotEnded(booking.date, booking.endSlot - 1, now);
    return remaining && (booking.byUid === user?.uid || hasUnitPermission(access, booking.unitId, 'unit.room.reserve'));
  };

  const confirmCancel = (booking: RoomBooking) =>
    modals.openConfirmModal({
      title: 'Rezervasyon iptal edilsin mi?',
      children: (
        <Text size="sm">
          <b>{dayjs(booking.date).format('D MMMM dddd')}</b>, {slotRange(booking.startSlot, booking.endSlot)} —{' '}
          {booking.unitName}: {booking.title}. İptal edilen saatler hemen başkalarının kullanımına açılır.
        </Text>
      ),
      labels: { confirm: 'İptal et', cancel: 'Vazgeç' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const removed = await cancelBooking(booking, canManageRooms);
          setDetail(null);
          notifySuccess(removed === booking.slotIds.length ? 'Rezervasyon iptal edildi.' : 'Rezervasyonun kalan saatleri boşaltıldı.');
        } catch (e) {
          notifyError(e);
        }
      },
    });

  const startDraft = (date: string, startSlot: number) => {
    if (!room) return;
    setDraft({ date, startSlot, endSlot: Math.min(startSlot + 2, room.closeSlot) });
  };

  const newBooking = () => {
    if (!room) return;
    const current = roomNow(now);
    const start = Math.max(room.openSlot, current.slot + 1);
    if (start < room.closeSlot) startDraft(current.date, start);
    else startDraft(addDays(current.date, 1), room.openSlot);
  };

  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index));
  const weekLabel =
    dayjs(week).month() === dayjs(weekEnd).month()
      ? `${dayjs(week).format('D')}–${dayjs(weekEnd).format('D MMMM YYYY')}`
      : `${dayjs(week).format('D MMMM')} – ${dayjs(weekEnd).format('D MMMM YYYY')}`;

  return (
    <Stack>
      <PageHeader
        title="Oda rezervasyonu"
        description="Kulüp odasının mülakat, toplantı ve diğer kullanımlar için ayrıldığı saatler. Aynı saat ikinci kez alınamaz."
        actions={
          <>
            {canManageRooms && (
              <Button variant="default" leftSection={<IconSettings size={17} />} onClick={() => setManageOpen(true)}>
                Odalar
              </Button>
            )}
            {canReserve && room && (
              <Button leftSection={<IconPlus size={17} />} onClick={newBooking}>
                Rezervasyon yap
              </Button>
            )}
          </>
        }
      />

      {rooms.loading ? (
        <SectionLoader />
      ) : !room ? (
        <EmptyState
          title="Rezervasyona açık oda yok"
          description={
            canManageRooms
              ? 'Rezervasyon alınabilmesi için önce odayı tanımlayın.'
              : 'Organizasyon yöneticisi bir oda tanımladığında takvim burada görünür.'
          }
          action={
            canManageRooms ? (
              <Button leftSection={<IconPlus size={17} />} onClick={() => setManageOpen(true)}>
                Oda ekle
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {!canReserve && (
            <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
              Rezervasyonu yalnızca komite başkanları yapar. Odaya ihtiyacınız varsa komite başkanınıza iletin; takvimi
              herkes görebilir.
            </Alert>
          )}

          <Card withBorder>
            <Group justify="space-between" wrap="wrap">
              <Group gap="sm" wrap="wrap">
                {activeRooms.length > 1 ? (
                  <Select
                    aria-label="Oda"
                    leftSection={<IconDoor size={16} />}
                    allowDeselect={false}
                    value={room.id}
                    data={activeRooms.map((r) => ({ value: r.id, label: r.name }))}
                    onChange={setRoomId}
                    w={240}
                  />
                ) : (
                  <Group gap={6} wrap="nowrap">
                    <IconDoor size={18} />
                    <Text fw={600}>{room.name}</Text>
                  </Group>
                )}
                <Text size="sm" c="dimmed">
                  {[room.location, `Kullanım saatleri ${slotRange(room.openSlot, room.closeSlot)}`].filter(Boolean).join(' · ')}
                </Text>
              </Group>
              <Group gap="xs" wrap="nowrap">
                <ActionIcon variant="default" onClick={() => setWeek(addDays(week, -7))} aria-label="Önceki hafta">
                  <IconChevronLeft size={16} />
                </ActionIcon>
                <Button variant="default" size="xs" onClick={() => setWeek(weekStart(today))} disabled={week === weekStart(today)}>
                  Bu hafta
                </Button>
                <ActionIcon variant="default" onClick={() => setWeek(addDays(week, 7))} aria-label="Sonraki hafta">
                  <IconChevronRight size={16} />
                </ActionIcon>
                <Text fw={600} miw={150} ta="right">
                  {weekLabel}
                </Text>
              </Group>
            </Group>
            {room.note && (
              <Text size="sm" c="dimmed" mt="xs">
                {room.note}
              </Text>
            )}
          </Card>

          {slots.error ? (
            <Alert color="red" icon={<IconAlertTriangle size={18} />}>
              Rezervasyonlar yüklenemedi. Sayfayı yenileyin.
            </Alert>
          ) : (
            <WeekGrid
              room={room}
              days={days}
              bookings={bookings}
              now={now}
              canReserve={canReserve}
              onPick={startDraft}
              onOpen={setDetail}
            />
          )}

          <Group gap="xs">
            {KIND_OPTIONS.map((kind) => (
              <Badge key={kind.value} variant="light" color={ROOM_KIND_META[kind.value].color}>
                {kind.label}
              </Badge>
            ))}
          </Group>

          <Card withBorder>
            <Text fw={600} mb="xs">
              Bu haftanın rezervasyonları
            </Text>
            {slots.loading ? (
              <SectionLoader />
            ) : bookings.length === 0 ? (
              <Text size="sm" c="dimmed">
                Bu hafta için rezervasyon yok.
              </Text>
            ) : (
              <ScrollArea type="auto">
                <Table miw={640} verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Gün</Table.Th>
                      <Table.Th>Saat</Table.Th>
                      <Table.Th>Komite</Table.Th>
                      <Table.Th>Kullanım</Table.Th>
                      <Table.Th>Rezervasyonu yapan</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {bookings.map((booking) => (
                      <Table.Tr key={`${booking.groupId}-${booking.date}-${booking.startSlot}`}>
                        <Table.Td>{dayjs(booking.date).format('D MMM ddd')}</Table.Td>
                        <Table.Td>{slotRange(booking.startSlot, booking.endSlot)}</Table.Td>
                        <Table.Td>{booking.unitName}</Table.Td>
                        <Table.Td>
                          <Group gap={6} wrap="nowrap">
                            <Badge size="sm" variant="light" color={ROOM_KIND_META[booking.kind].color}>
                              {ROOM_KIND_META[booking.kind].label}
                            </Badge>
                            <Text size="sm" lineClamp={1}>
                              {booking.title}
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>{booking.byName}</Table.Td>
                        <Table.Td ta="right">
                          {canCancel(booking) && (
                            <Button size="compact-xs" variant="subtle" color="red" onClick={() => confirmCancel(booking)}>
                              İptal et
                            </Button>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </Card>
        </>
      )}

      {draft && room && (
        <BookingModal
          key={`${draft.date}-${draft.startSlot}`}
          room={room}
          initial={draft}
          units={reserveUnits}
          defaultUnitId={reserveUnits.some((unit) => unit.id === selectedUnitId) ? selectedUnitId : (reserveUnits[0]?.id ?? null)}
          byName={member?.displayName ?? user?.displayName ?? user?.email ?? ''}
          onClose={() => setDraft(null)}
          onBooked={(date) => {
            setDraft(null);
            setWeek(weekStart(date));
          }}
        />
      )}

      <Modal opened={!!detail} onClose={() => setDetail(null)} title="Rezervasyon" centered>
        {detail && (
          <Stack gap="sm">
            <Group gap="xs">
              <Badge variant="light" color={ROOM_KIND_META[detail.kind].color}>
                {ROOM_KIND_META[detail.kind].label}
              </Badge>
              <Text fw={600}>{detail.title}</Text>
            </Group>
            <Text size="sm">
              {dayjs(detail.date).format('D MMMM YYYY dddd')} · {slotRange(detail.startSlot, detail.endSlot)}
            </Text>
            <Text size="sm">
              {detail.unitName} · rezervasyonu yapan: {detail.byName}
            </Text>
            {detail.note && (
              <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-line' }}>
                {detail.note}
              </Text>
            )}
            {canCancel(detail) && (
              <Group justify="flex-end">
                <Button color="red" variant="light" onClick={() => confirmCancel(detail)}>
                  Rezervasyonu iptal et
                </Button>
              </Group>
            )}
          </Stack>
        )}
      </Modal>

      {canManageRooms && <RoomsModal opened={manageOpen} onClose={() => setManageOpen(false)} rooms={sortedRooms} />}
    </Stack>
  );
}

function WeekGrid({
  room,
  days,
  bookings,
  now,
  canReserve,
  onPick,
  onOpen,
}: {
  room: WithId<Room>;
  days: string[];
  bookings: RoomBooking[];
  now: number;
  canReserve: boolean;
  onPick: (date: string, slot: number) => void;
  onOpen: (booking: RoomBooking) => void;
}) {
  const today = roomNow(now).date;
  const rows = Array.from({ length: room.closeSlot - room.openSlot }, (_, index) => room.openSlot + index);
  const line = '1px solid var(--mantine-color-default-border)';

  return (
    <Card withBorder p={0}>
      <ScrollArea type="auto">
        <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, minmax(104px, 1fr))', minWidth: 800 }}>
          <div style={{ borderBottom: line }} />
          {days.map((date, index) => (
            <div key={date} style={{ padding: '8px 4px', textAlign: 'center', borderBottom: line, borderLeft: line }}>
              <Text size="xs" c={date === today ? 'blue' : 'dimmed'} fw={600}>
                {DAY_LABELS[index]}
              </Text>
              <Text size="sm" fw={date === today ? 700 : 500} c={date === today ? 'blue' : undefined}>
                {dayjs(date).format('D MMM')}
              </Text>
            </div>
          ))}

          <div>
            {rows.map((slot) => (
              <div key={slot} style={{ height: ROW_HEIGHT, paddingRight: 6, textAlign: 'right' }}>
                {slot % 2 === 0 && (
                  <Text size="xs" c="dimmed" lh={1} pt={2}>
                    {slotTime(slot)}
                  </Text>
                )}
              </div>
            ))}
          </div>

          {days.map((date) => {
            const dayBookings = bookings.filter((booking) => booking.date === date);
            const bookable = canReserve && daysBetween(today, date) < room.maxDaysAhead;
            return (
              <div key={date} style={{ position: 'relative', borderLeft: line, height: rows.length * ROW_HEIGHT }}>
                {rows.map((slot) => {
                  const style = {
                    display: 'block',
                    width: '100%',
                    height: ROW_HEIGHT,
                    borderTop: slot === room.openSlot ? undefined : slot % 2 === 0 ? line : '1px dashed var(--mantine-color-default-border)',
                  };
                  const ended = slotEnded(date, slot, now);
                  return bookable && !ended ? (
                    <UnstyledButton
                      key={slot}
                      className="room-free-slot"
                      style={style}
                      onClick={() => onPick(date, slot)}
                      aria-label={`${dayjs(date).format('D MMMM')} ${slotTime(slot)} için rezervasyon yap`}
                    />
                  ) : (
                    <div key={slot} style={{ ...style, background: ended ? 'var(--mantine-color-default-hover)' : undefined }} />
                  );
                })}
                {dayBookings.map((booking) => {
                  const start = Math.max(booking.startSlot, room.openSlot);
                  const end = Math.min(booking.endSlot, room.closeSlot);
                  if (end <= start) return null;
                  const color = ROOM_KIND_META[booking.kind].color;
                  return (
                    <Tooltip
                      key={`${booking.groupId}-${booking.startSlot}`}
                      label={`${slotRange(booking.startSlot, booking.endSlot)} · ${booking.unitName} · ${booking.title}`}
                      withArrow
                    >
                      <UnstyledButton
                        onClick={() => onOpen(booking)}
                        style={{
                          position: 'absolute',
                          top: (start - room.openSlot) * ROW_HEIGHT + 1,
                          height: (end - start) * ROW_HEIGHT - 2,
                          left: 2,
                          right: 2,
                          padding: '2px 6px',
                          overflow: 'hidden',
                          borderRadius: 'var(--mantine-radius-sm)',
                          background: `var(--mantine-color-${color}-light)`,
                          color: `var(--mantine-color-${color}-light-color)`,
                          borderLeft: `3px solid var(--mantine-color-${color}-filled)`,
                        }}
                      >
                        <Text size="xs" fw={700} lh={1.25} truncate>
                          {slotRange(booking.startSlot, booking.endSlot)}
                        </Text>
                        {end - start > 1 && (
                          <Text size="xs" lh={1.25} lineClamp={end - start > 2 ? 2 : 1}>
                            {booking.unitName} · {booking.title}
                          </Text>
                        )}
                      </UnstyledButton>
                    </Tooltip>
                  );
                })}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}

function BookingModal({
  room,
  initial,
  units,
  defaultUnitId,
  byName,
  onClose,
  onBooked,
}: {
  room: WithId<Room>;
  initial: Draft;
  units: WithId<Unit>[];
  defaultUnitId: string | null;
  byName: string;
  onClose: () => void;
  onBooked: (date: string) => void;
}) {
  const [unitId, setUnitId] = useState(defaultUnitId);
  const [date, setDate] = useState(initial.date);
  const [startSlot, setStartSlot] = useState(initial.startSlot);
  const [endSlot, setEndSlot] = useState(initial.endSlot);
  const [kind, setKind] = useState<RoomBookingKind>('meeting');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // Seçilen günün dolu saatleri canlı izlenir; başkası aynı anda alırsa uyarı hemen görünür.
  const daySlots = useCollection<RoomSlot>('roomSlots', [where('date', '==', date)], `roomSlots:day:${date}`);
  const dayBookings = useMemo(
    () => groupBookings(daySlots.data).filter((booking) => booking.roomId === room.id),
    [daySlots.data, room.id],
  );
  const conflicts = conflictingBookings(dayBookings, room.id, date, startSlot, endSlot);
  const problem = validateBookingRequest({ room, date, startSlot, endSlot });
  const unit = units.find((u) => u.id === unitId) ?? null;
  const today = roomNow().date;
  const hours = SLOT_OPTIONS.filter((option) => Number(option.value) >= room.openSlot && Number(option.value) <= room.closeSlot);

  const submit = async () => {
    if (!unit) return;
    setBusy(true);
    try {
      await createBooking({ room, date, startSlot, endSlot, unitId: unit.id, unitName: unit.name, kind, title, note, byName });
      notifySuccess(`${dayjs(date).format('D MMMM')} ${slotRange(startSlot, endSlot)} için oda ayrıldı.`);
      onBooked(date);
    } catch (e) {
      notifyError(e, 'Rezervasyon yapılamadı');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened onClose={onClose} title={`Rezervasyon yap — ${room.name}`} centered size="lg">
      <Stack gap="sm">
        <Select
          label="Komite"
          description="Rezervasyon bu komite adına yapılır."
          allowDeselect={false}
          value={unitId}
          data={units.map((u) => ({ value: u.id, label: `${u.name} (${u.shortCode})` }))}
          onChange={setUnitId}
          disabled={units.length === 1}
          searchable={units.length > 6}
        />
        <Group grow align="flex-start">
          <DateInput
            label="Tarih"
            valueFormat="DD.MM.YYYY dddd"
            value={date}
            minDate={today}
            maxDate={addDays(today, room.maxDaysAhead - 1)}
            onChange={(value) => value && setDate(value)}
          />
          <Select
            label="Başlangıç"
            allowDeselect={false}
            value={String(startSlot)}
            data={hours.slice(0, -1)}
            onChange={(value) => {
              const next = Number(value);
              setStartSlot(next);
              if (endSlot <= next) setEndSlot(Math.min(next + 2, room.closeSlot));
            }}
          />
          <Select
            label="Bitiş"
            allowDeselect={false}
            value={String(endSlot)}
            data={hours.filter((option) => Number(option.value) > startSlot)}
            onChange={(value) => setEndSlot(Number(value))}
          />
        </Group>
        <Group grow align="flex-start">
          <Select label="Kullanım türü" allowDeselect={false} value={kind} data={KIND_OPTIONS} onChange={(value) => setKind(value as RoomBookingKind)} />
          <TextInput
            label="Başlık"
            placeholder="Örn. Yeni dönem gönüllü mülakatları"
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.currentTarget.value)}
            required
          />
        </Group>
        <Textarea label="Not" placeholder="İsteğe bağlı" value={note} maxLength={500} autosize minRows={2} onChange={(event) => setNote(event.currentTarget.value)} />

        {conflicts.length > 0 ? (
          <Alert color="red" icon={<IconAlertTriangle size={18} />} title="Bu saatlerde oda dolu">
            {conflicts.map((c) => `${slotRange(c.startSlot, c.endSlot)} ${c.unitName} (${c.title})`).join(' · ')}
          </Alert>
        ) : problem ? (
          <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
            {problem}
          </Alert>
        ) : dayBookings.length > 0 ? (
          <Text size="sm" c="dimmed">
            Bu gün dolu saatler: {dayBookings.map((b) => `${slotRange(b.startSlot, b.endSlot)} ${b.unitName}`).join(' · ')}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            Bu gün için başka rezervasyon yok.
          </Text>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Vazgeç
          </Button>
          <Button onClick={submit} loading={busy} disabled={!unit || !title.trim() || !!problem || conflicts.length > 0 || daySlots.loading}>
            Odayı ayır
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function RoomsModal({ opened, onClose, rooms }: { opened: boolean; onClose: () => void; rooms: WithId<Room>[] }) {
  const [edit, setEdit] = useState<{ id: string | null; value: RoomInput } | null>(null);
  const [busy, setBusy] = useState(false);
  const problem = edit ? validateRoom(edit.value) : null;
  const patch = (changes: Partial<RoomInput>) => setEdit((current) => (current ? { ...current, value: { ...current.value, ...changes } } : current));

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      await saveRoom(edit.id, edit.value);
      notifySuccess(edit.id ? 'Oda güncellendi.' : 'Oda eklendi.');
      setEdit(null);
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        setEdit(null);
        onClose();
      }}
      title={edit ? (edit.id ? 'Odayı düzenle' : 'Oda ekle') : 'Odalar'}
      centered
      size="lg"
    >
      {edit ? (
        <Stack gap="sm">
          <TextInput label="Oda adı" value={edit.value.name} maxLength={80} onChange={(event) => patch({ name: event.currentTarget.value })} required />
          <TextInput label="Konum" placeholder="Örn. Merkezi Derslik, zemin kat" value={edit.value.location} maxLength={160} onChange={(event) => patch({ location: event.currentTarget.value })} />
          <Group grow align="flex-start">
            <Select label="Açılış" allowDeselect={false} value={String(edit.value.openSlot)} data={SLOT_OPTIONS.slice(0, -1)} onChange={(value) => patch({ openSlot: Number(value) })} />
            <Select label="Kapanış" allowDeselect={false} value={String(edit.value.closeSlot)} data={SLOT_OPTIONS.slice(1)} onChange={(value) => patch({ closeSlot: Number(value) })} />
            <NumberInput
              label="En fazla kaç gün sonrası"
              min={1}
              max={365}
              allowDecimal={false}
              value={edit.value.maxDaysAhead}
              onChange={(value) => patch({ maxDaysAhead: typeof value === 'number' ? value : 0 })}
            />
          </Group>
          <Textarea label="Kullanım notu" description="Takvimin üstünde herkese gösterilir." value={edit.value.note} maxLength={500} autosize minRows={2} onChange={(event) => patch({ note: event.currentTarget.value })} />
          <Switch label="Rezervasyona açık" checked={edit.value.active} onChange={(event) => patch({ active: event.currentTarget.checked })} />
          {problem && (
            <Text size="sm" c="red">
              {problem}
            </Text>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEdit(null)}>
              Geri
            </Button>
            <Button onClick={save} loading={busy} disabled={!!problem}>
              Kaydet
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap="sm">
          {rooms.length === 0 ? (
            <Text size="sm" c="dimmed">
              Henüz oda tanımlanmadı.
            </Text>
          ) : (
            rooms.map((room) => (
              <Card key={room.id} withBorder p="sm">
                <Group justify="space-between" wrap="nowrap">
                  <div style={{ minWidth: 0 }}>
                    <Group gap="xs">
                      <Text fw={600}>{room.name}</Text>
                      <Badge size="sm" color={room.active ? 'green' : 'gray'}>
                        {room.active ? 'Açık' : 'Kapalı'}
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed">
                      {[room.location, slotRange(room.openSlot, room.closeSlot), `${room.maxDaysAhead} gün sonrasına kadar`].filter(Boolean).join(' · ')}
                    </Text>
                  </div>
                  <ActionIcon
                    variant="default"
                    aria-label={`${room.name} odasını düzenle`}
                    onClick={() =>
                      setEdit({
                        id: room.id,
                        value: {
                          name: room.name,
                          location: room.location,
                          note: room.note,
                          openSlot: room.openSlot,
                          closeSlot: room.closeSlot,
                          maxDaysAhead: room.maxDaysAhead,
                          active: room.active,
                        },
                      })
                    }
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                </Group>
              </Card>
            ))
          )}
          <Text size="xs" c="dimmed">
            Oda silinmez; kullanılmayacaksa “Rezervasyona açık” seçeneğini kapatın. Geçmiş rezervasyonlar kayıtta kalır.
          </Text>
          <Group justify="flex-end">
            <Button leftSection={<IconPlus size={17} />} onClick={() => setEdit({ id: null, value: { ...DEFAULT_ROOM } })}>
              Oda ekle
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
