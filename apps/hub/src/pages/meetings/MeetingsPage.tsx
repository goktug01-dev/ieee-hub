import { Badge, Button, Card, Group, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconPlus } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { addDoc, collection, serverTimestamp, where } from 'firebase/firestore';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, PageHeader, SectionLoader, notifyError } from '../../components/ui';
import { db } from '../../firebase';
import { hasUnitPermission } from '../../lib/access';
import { useCollection } from '../../lib/hooks';
import type { Meeting } from '../../lib/opsTypes';
import { useUnitScope } from '../../lib/unitScope';

export function MeetingsPage() {
  const navigate = useNavigate();
  const { user, member, access, can } = useAuth();
  const { selectedUnit } = useUnitScope();
  const meetings = useCollection<Meeting>(selectedUnit ? 'meetings' : null, selectedUnit ? [where('unitId', '==', selectedUnit.id)] : [], `meetings:${selectedUnit?.id ?? ''}`);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [busy, setBusy] = useState(false);
  const canManage = !!selectedUnit && (
    hasUnitPermission(access, selectedUnit.id, 'unit.meetings.manage')
    || hasUnitPermission(access, selectedUnit.id, 'unit.manage')
    || can('work.manageAll')
    || can('secretary.ledger.manage')
  );

  const create = async () => {
    if (!selectedUnit || !title.trim()) return;
    setBusy(true);
    try {
      const ref = await addDoc(collection(db, 'meetings'), {
        unitId: selectedUnit.id,
        unitName: selectedUnit.name,
        title: title.trim(),
        meetingNo: '', date, startTime: '', endTime: '', location: '', chairName: '', recorderName: '',
        attendeeUids: [], attendeeNames: [], guestAttendees: '', agenda: [], decisions: [], generalNotes: '',
        nextMeetingDate: null, status: 'draft', createdBy: user!.uid,
        createdByName: member?.displayName ?? user!.displayName ?? '', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      navigate(`/toplantilar/${ref.id}`);
    } catch (error) { notifyError(error); } finally { setBusy(false); }
  };

  const sorted = [...meetings.data].sort((a, b) => b.date.localeCompare(a.date));
  return <Stack>
    <PageHeader title="Toplantılar ve tutanaklar" description="Seçili komitenin gündem, katılım, karar ve takip maddelerini tek tutanakta yönetin." />
    {!selectedUnit ? <EmptyState title="Erişebildiğiniz bir komite yok" description="Bir komite görevi atandığında toplantılar burada görünür." /> : <>
      {canManage && <Card withBorder>
        <Group align="end" wrap="wrap">
          <TextInput label="Yeni toplantı" placeholder="Örn. Ekim ayı komite toplantısı" value={title} onChange={(event) => setTitle(event.currentTarget.value)} style={{ flex: '1 1 300px' }} />
          <DateInput label="Tarih" value={date} onChange={(value) => setDate(value ?? dayjs().format('YYYY-MM-DD'))} valueFormat="DD.MM.YYYY" w={170} />
          <Button leftSection={<IconPlus size={17} />} onClick={create} loading={busy} disabled={!title.trim()}>Oluştur</Button>
        </Group>
      </Card>}
      {meetings.loading ? <SectionLoader /> : sorted.length === 0 ? <EmptyState title="Henüz toplantı yok" description={canManage ? 'Yukarıdan ilk toplantı kaydını oluşturabilirsiniz.' : 'Komite yöneticisi toplantı oluşturduğunda burada görünür.'} /> :
        <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>{sorted.map((meeting) => <Card key={meeting.id} withBorder style={{ cursor: 'pointer' }} onClick={() => navigate(`/toplantilar/${meeting.id}`)}>
          <Group justify="space-between" align="flex-start" wrap="nowrap"><div><Text fw={600}>{meeting.title}</Text><Text size="sm" c="dimmed">{dayjs(meeting.date).format('DD.MM.YYYY')} · {meeting.meetingNo || 'Sayı verilmedi'}</Text></div><Badge color={meeting.status === 'final' ? 'green' : 'yellow'}>{meeting.status === 'final' ? 'Kesinleşti' : 'Taslak'}</Badge></Group>
          <Text size="sm" mt="md">{meeting.agenda.length} gündem · {meeting.decisions.length} karar · {meeting.attendeeNames.length} katılımcı</Text>
        </Card>)}</SimpleGrid>}
    </>}
  </Stack>;
}
