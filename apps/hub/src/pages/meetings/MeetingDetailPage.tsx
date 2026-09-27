import { ActionIcon, Alert, Badge, Button, Card, Group, MultiSelect, SimpleGrid, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { modals } from '@mantine/modals';
import { IconArrowLeft, IconDownload, IconPlus, IconTrash } from '@tabler/icons-react';
import { deleteDoc, doc, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { db } from '../../firebase';
import { hasUnitPermission } from '../../lib/access';
import { useCollection, useDoc } from '../../lib/hooks';
import { buildMeetingMinutes, downloadMeetingMinutes } from '../../lib/meetingDocx';
import type { Meeting, MeetingAgendaItem, MeetingDecision } from '../../lib/opsTypes';
import type { Member } from '../../lib/types';

const key = () => crypto.randomUUID();

export function MeetingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, member, access, can } = useAuth();
  const source = useDoc<Meeting>(id ? `meetings/${id}` : null);
  const members = useCollection<Member>('members', [where('status', '==', 'active')], 'meeting-members');
  const [draft, setDraft] = useState<Meeting | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (source.data && !dirty) setDraft(source.data); }, [source.data, dirty]);
  const memberMap = useMemo(() => new Map(members.data.map((item) => [item.uid, item.displayName])), [members.data]);

  if (source.loading || !draft) return source.loading ? <SectionLoader /> : <EmptyState title="Toplantı bulunamadı" />;
  const canManage = hasUnitPermission(access, draft.unitId, 'unit.meetings.manage')
    || hasUnitPermission(access, draft.unitId, 'unit.manage') || can('work.manageAll') || can('secretary.ledger.manage');
  const editable = canManage && draft.status === 'draft';
  const update = (patch: Partial<Meeting>) => { setDraft({ ...draft, ...patch }); setDirty(true); };
  const setAgenda = (index: number, patch: Partial<MeetingAgendaItem>) => update({ agenda: draft.agenda.map((item, i) => i === index ? { ...item, ...patch } : item) });
  const setDecision = (index: number, patch: Partial<MeetingDecision>) => update({ decisions: draft.decisions.map((item, i) => i === index ? { ...item, ...patch } : item) });

  const save = async (): Promise<boolean> => {
    if (!id || !draft.title.trim() || !draft.date) return false;
    setBusy(true);
    try {
      const { id: _id, createdAt: _createdAt, ...payload } = draft as Meeting & { id?: string };
      await updateDoc(doc(db, 'meetings', id), { ...payload, updatedAt: serverTimestamp() });
      setDirty(false); notifySuccess('Toplantı kaydedildi.'); return true;
    } catch (error) { notifyError(error); return false; } finally { setBusy(false); }
  };
  const finalize = () => modals.openConfirmModal({
    title: 'Tutanak kesinleştirilsin mi?',
    children: <Text size="sm">Kesinleşen tutanak değiştirilemez ve silinemez. Eksik gündem veya kararları önce kontrol edin.</Text>,
    labels: { confirm: 'Kesinleştir', cancel: 'Vazgeç' }, confirmProps: { color: 'green' },
    onConfirm: async () => {
      if (!id) return;
      try {
        if (dirty && !(await save())) return;
        await updateDoc(doc(db, 'meetings', id), {
          status: 'final', finalizedBy: user!.uid, finalizedByName: member?.displayName ?? user!.displayName ?? '',
          finalizedAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        setDirty(false); notifySuccess('Toplantı tutanağı kesinleşti.');
      } catch (error) { notifyError(error); }
    },
  });
  const download = async () => { try { downloadMeetingMinutes(await buildMeetingMinutes(draft), draft); } catch (error) { notifyError(error); } };

  return <Stack>
    <Group justify="space-between" align="flex-start" wrap="wrap"><div><Button component={Link} to="/toplantilar" variant="subtle" leftSection={<IconArrowLeft size={16} />} px={0}>Toplantılar</Button><Group><Title order={2}>{draft.title}</Title><Badge color={draft.status === 'final' ? 'green' : 'yellow'}>{draft.status === 'final' ? 'Kesinleşti' : 'Taslak'}</Badge></Group><Text c="dimmed">{draft.unitName}</Text></div><Group><Button variant="default" leftSection={<IconDownload size={17} />} onClick={download}>Word tutanağı</Button>{editable && <Button onClick={save} loading={busy} disabled={!dirty}>Kaydet</Button>}{editable && <Button color="green" onClick={finalize}>Kesinleştir</Button>}</Group></Group>
    {draft.status === 'final' && <Alert color="green">Bu tutanak kesinleşmiştir; kayıt ve kararlar kilitlidir.</Alert>}
    <Card withBorder><Stack>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}><TextInput label="Başlık" value={draft.title} onChange={(e) => update({ title: e.currentTarget.value })} disabled={!editable} required /><TextInput label="Toplantı sayısı" value={draft.meetingNo} onChange={(e) => update({ meetingNo: e.currentTarget.value })} disabled={!editable} placeholder="Örn. CS-2026-04" /><DateInput label="Tarih" value={draft.date} onChange={(value) => update({ date: value ?? '' })} valueFormat="DD.MM.YYYY" disabled={!editable} required /><TextInput label="Başlangıç" type="time" value={draft.startTime} onChange={(e) => update({ startTime: e.currentTarget.value })} disabled={!editable} /><TextInput label="Bitiş" type="time" value={draft.endTime} onChange={(e) => update({ endTime: e.currentTarget.value })} disabled={!editable} /><TextInput label="Yer / çevrim içi bağlantı" value={draft.location} onChange={(e) => update({ location: e.currentTarget.value })} disabled={!editable} /></SimpleGrid>
      <SimpleGrid cols={{ base: 1, sm: 2 }}><TextInput label="Toplantı başkanı" value={draft.chairName} onChange={(e) => update({ chairName: e.currentTarget.value })} disabled={!editable} /><TextInput label="Tutanak sorumlusu" value={draft.recorderName} onChange={(e) => update({ recorderName: e.currentTarget.value })} disabled={!editable} /></SimpleGrid>
      <MultiSelect label="Katılan üyeler" data={members.data.map((item) => ({ value: item.uid, label: item.displayName }))} value={draft.attendeeUids} onChange={(uids) => update({ attendeeUids: uids, attendeeNames: uids.map((uid) => memberMap.get(uid) ?? uid) })} searchable disabled={!editable} />
      <TextInput label="Misafir katılımcılar" description="Üye listesinde olmayanları virgülle ayırın" value={draft.guestAttendees} onChange={(e) => update({ guestAttendees: e.currentTarget.value })} disabled={!editable} />
    </Stack></Card>

    <Card withBorder><Group justify="space-between"><Title order={3}>Gündem ve görüşmeler</Title>{editable && <Button size="xs" variant="light" leftSection={<IconPlus size={15} />} onClick={() => update({ agenda: [...draft.agenda, { id: key(), title: '', notes: '' }] })}>Madde ekle</Button>}</Group><Stack mt="md">{draft.agenda.length === 0 && <Text c="dimmed" size="sm">Gündem maddesi yok.</Text>}{draft.agenda.map((item, index) => <Card key={item.id} withBorder padding="sm"><Group align="flex-start" wrap="nowrap"><Stack gap="xs" style={{ flex: 1 }}><TextInput label={`${index + 1}. gündem maddesi`} value={item.title} onChange={(e) => setAgenda(index, { title: e.currentTarget.value })} disabled={!editable} /><Textarea label="Görüşme notları" value={item.notes} onChange={(e) => setAgenda(index, { notes: e.currentTarget.value })} autosize minRows={2} disabled={!editable} /></Stack>{editable && <ActionIcon color="red" variant="subtle" mt={26} onClick={() => update({ agenda: draft.agenda.filter((_, i) => i !== index) })} aria-label="Gündemi sil"><IconTrash size={17} /></ActionIcon>}</Group></Card>)}</Stack></Card>

    <Card withBorder><Group justify="space-between"><Title order={3}>Kararlar ve takip</Title>{editable && <Button size="xs" variant="light" leftSection={<IconPlus size={15} />} onClick={() => update({ decisions: [...draft.decisions, { id: key(), number: '', text: '', vote: '', responsible: '', dueDate: null }] })}>Karar ekle</Button>}</Group><Stack mt="md">{draft.decisions.length === 0 && <Text c="dimmed" size="sm">Karar kaydı yok.</Text>}{draft.decisions.map((decision, index) => <Card key={decision.id} withBorder padding="sm"><Group align="flex-start" wrap="nowrap"><Stack gap="xs" style={{ flex: 1 }}><SimpleGrid cols={{ base: 1, sm: 2 }}><TextInput label="Karar no" value={decision.number} onChange={(e) => setDecision(index, { number: e.currentTarget.value })} disabled={!editable} placeholder={String(index + 1)} /><TextInput label="Oylama / kabul biçimi" value={decision.vote} onChange={(e) => setDecision(index, { vote: e.currentTarget.value })} disabled={!editable} placeholder="Oy birliği / 5 kabul, 1 ret" /></SimpleGrid><Textarea label="Karar" value={decision.text} onChange={(e) => setDecision(index, { text: e.currentTarget.value })} autosize minRows={2} disabled={!editable} /><SimpleGrid cols={{ base: 1, sm: 2 }}><TextInput label="Sorumlu" value={decision.responsible} onChange={(e) => setDecision(index, { responsible: e.currentTarget.value })} disabled={!editable} /><DateInput label="Son tarih" value={decision.dueDate} onChange={(value) => setDecision(index, { dueDate: value })} valueFormat="DD.MM.YYYY" clearable disabled={!editable} /></SimpleGrid></Stack>{editable && <ActionIcon color="red" variant="subtle" mt={26} onClick={() => update({ decisions: draft.decisions.filter((_, i) => i !== index) })} aria-label="Kararı sil"><IconTrash size={17} /></ActionIcon>}</Group></Card>)}</Stack></Card>

    <Card withBorder><Stack><Textarea label="Genel notlar" value={draft.generalNotes} onChange={(e) => update({ generalNotes: e.currentTarget.value })} autosize minRows={3} disabled={!editable} /><DateInput label="Sonraki toplantı tarihi" value={draft.nextMeetingDate} onChange={(value) => update({ nextMeetingDate: value })} valueFormat="DD.MM.YYYY" clearable disabled={!editable} w={{ base: '100%', sm: 240 }} /></Stack></Card>
    {editable && <Group justify="space-between"><Button color="red" variant="subtle" onClick={() => modals.openConfirmModal({ title: 'Taslak silinsin mi?', children: <Text size="sm">Bu toplantı taslağı kalıcı olarak silinir.</Text>, labels: { confirm: 'Sil', cancel: 'Vazgeç' }, confirmProps: { color: 'red' }, onConfirm: () => id && deleteDoc(doc(db, 'meetings', id)).then(() => navigate('/toplantilar')).catch(notifyError) })}>Taslağı sil</Button><Button onClick={save} loading={busy} disabled={!dirty}>Değişiklikleri kaydet</Button></Group>}
  </Stack>;
}
