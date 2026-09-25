import { ActionIcon, Anchor, Badge, Button, Group, Modal, Select, SimpleGrid, Stack, Table, Text, TextInput, Textarea } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { modals } from '@mantine/modals';
import { IconEdit, IconExternalLink, IconPlus, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { addDoc, collection, deleteDoc, doc, orderBy, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, PageHeader, SectionLoader, notifyError, notifySuccess } from '../components/ui';
import { db } from '../firebase';
import { logAudit } from '../lib/audit';
import { useCollection } from '../lib/hooks';
import type { SecretaryLedgerEntry, SecretaryLedgerKind } from '../lib/opsTypes';
import { useOrg } from '../lib/org';
import { BRANCH, type WithId } from '../lib/types';

const KINDS: Record<SecretaryLedgerKind, { label: string; color: string }> = {
  meeting: { label: 'Toplantı tutanağı', color: 'blue' },
  board_decision: { label: 'YK kararı', color: 'grape' },
  unit_decision: { label: 'Birim kararı', color: 'cyan' },
  incoming: { label: 'Gelen evrak', color: 'green' },
  outgoing: { label: 'Giden evrak', color: 'orange' },
  follow_up: { label: 'Takip kaydı', color: 'yellow' },
  note: { label: 'Not', color: 'gray' },
};

type Draft = Omit<SecretaryLedgerEntry, 'createdBy' | 'createdByName' | 'createdAt' | 'updatedAt'>;
const emptyDraft = (): Draft => ({
  kind: 'meeting', date: dayjs().format('YYYY-MM-DD'), referenceNo: '', title: '', unitId: BRANCH,
  unitName: 'Kol Geneli', summary: '', attendees: '', followUpDate: null, fileLink: '',
});

export function SecretaryLedgerPage() {
  const { user, member } = useAuth();
  const { unitOptions, unitName } = useOrg();
  const entries = useCollection<SecretaryLedgerEntry>('secretaryLedger', [orderBy('date', 'desc')], 'secretary-ledger');
  const [editing, setEditing] = useState<{ id: string | null; data: Draft } | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const [unit, setUnit] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.toLocaleLowerCase('tr');
    return entries.data.filter((entry) => (!kind || entry.kind === kind) && (!unit || entry.unitId === unit)
      && (!q || `${entry.title} ${entry.referenceNo} ${entry.summary}`.toLocaleLowerCase('tr').includes(q)));
  }, [entries.data, kind, unit, query]);

  const save = async () => {
    if (!editing || !editing.data.title.trim() || !editing.data.date) return;
    setBusy(true);
    try {
      const payload = { ...editing.data, unitName: unitName(editing.data.unitId), updatedAt: serverTimestamp() };
      if (editing.id) {
        await updateDoc(doc(db, 'secretaryLedger', editing.id), payload);
        await logAudit('secretaryLedger.update', `secretaryLedger/${editing.id}`, { title: editing.data.title });
      } else {
        const ref = await addDoc(collection(db, 'secretaryLedger'), {
          ...payload,
          createdBy: user!.uid,
          createdByName: member?.displayName ?? user!.displayName ?? '',
          createdAt: serverTimestamp(),
        });
        await logAudit('secretaryLedger.create', `secretaryLedger/${ref.id}`, { title: editing.data.title });
      }
      notifySuccess(editing.id ? 'Defter kaydı güncellendi.' : 'Defter kaydı oluşturuldu.');
      setEditing(null);
    } catch (error) { notifyError(error); } finally { setBusy(false); }
  };

  const remove = (entry: WithId<SecretaryLedgerEntry>) => modals.openConfirmModal({
    title: 'Defter kaydı silinsin mi?',
    children: <Text size="sm">“{entry.title}” kalıcı olarak silinir.</Text>,
    labels: { confirm: 'Sil', cancel: 'Vazgeç' }, confirmProps: { color: 'red' },
    onConfirm: () => deleteDoc(doc(db, 'secretaryLedger', entry.id))
      .then(() => logAudit('secretaryLedger.delete', `secretaryLedger/${entry.id}`, { title: entry.title }))
      .then(() => notifySuccess('Defter kaydı silindi.')).catch(notifyError),
  });

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setEditing((current) => current ? ({ ...current, data: { ...current.data, [key]: value } }) : current);

  return (
    <Stack>
      <PageHeader title="Sekreterlik defteri" description="Toplantı tutanakları, kararlar, gelen-giden evrak ve takip notlarının kronolojik kurumsal kaydı."
        actions={<Button leftSection={<IconPlus size={18} />} onClick={() => setEditing({ id: null, data: emptyDraft() })}>Yeni kayıt</Button>} />
      <Group wrap="wrap">
        <TextInput placeholder="Başlık, sayı veya içerik ara…" value={query} onChange={(event) => setQuery(event.currentTarget.value)} style={{ flex: '1 1 260px' }} />
        <Select placeholder="Kayıt türü" data={Object.entries(KINDS).map(([value, meta]) => ({ value, label: meta.label }))} value={kind} onChange={setKind} clearable w={210} />
        <Select placeholder="Birim" data={unitOptions({ includeBranch: true, onlyActive: false })} value={unit} onChange={setUnit} clearable searchable w={240} />
      </Group>
      {entries.loading ? <SectionLoader /> : filtered.length === 0 ? <EmptyState title="Defter kaydı bulunamadı" description="Toplantı, karar, gelen-giden evrak ve takip notları burada tutulur." /> : (
        <Table.ScrollContainer minWidth={900}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead><Table.Tr><Table.Th>Tarih / sayı</Table.Th><Table.Th>Tür</Table.Th><Table.Th>Konu</Table.Th><Table.Th>Birim</Table.Th><Table.Th>Takip</Table.Th><Table.Th w={90} /></Table.Tr></Table.Thead>
            <Table.Tbody>{filtered.map((entry) => (
              <Table.Tr key={entry.id}>
                <Table.Td><Text size="sm">{dayjs(entry.date).format('DD.MM.YYYY')}</Text><Text size="xs" c="dimmed">{entry.referenceNo || '—'}</Text></Table.Td>
                <Table.Td><Badge color={KINDS[entry.kind].color} variant="light">{KINDS[entry.kind].label}</Badge></Table.Td>
                <Table.Td><Text fw={500} size="sm">{entry.title}</Text><Text size="xs" c="dimmed" lineClamp={2}>{entry.summary}</Text></Table.Td>
                <Table.Td><Text size="sm">{entry.unitName}</Text></Table.Td>
                <Table.Td>{entry.followUpDate ? <Text size="sm">{dayjs(entry.followUpDate).format('DD.MM.YYYY')}</Text> : '—'}</Table.Td>
                <Table.Td><Group gap={2} wrap="nowrap">{entry.fileLink && <ActionIcon component="a" href={entry.fileLink} target="_blank" variant="subtle" aria-label="Dosyayı aç"><IconExternalLink size={16} /></ActionIcon>}<ActionIcon variant="subtle" onClick={() => { const { id: _id, createdBy: _a, createdByName: _b, createdAt: _c, updatedAt: _d, ...data } = entry; setEditing({ id: entry.id, data }); }} aria-label="Düzenle"><IconEdit size={16} /></ActionIcon><ActionIcon variant="subtle" color="red" onClick={() => remove(entry)} aria-label="Sil"><IconTrash size={16} /></ActionIcon></Group></Table.Td>
              </Table.Tr>
            ))}</Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <Modal opened={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Defter kaydını düzenle' : 'Yeni defter kaydı'} size="lg">
        {editing && <Stack>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select label="Kayıt türü" data={Object.entries(KINDS).map(([value, meta]) => ({ value, label: meta.label }))} value={editing.data.kind} onChange={(value) => set('kind', (value ?? 'note') as SecretaryLedgerKind)} required />
            <DateInput label="Tarih" value={editing.data.date} onChange={(value) => set('date', value ?? '')} valueFormat="DD.MM.YYYY" required />
            <TextInput label="Karar / evrak sayısı" value={editing.data.referenceNo} onChange={(event) => set('referenceNo', event.currentTarget.value)} />
            <Select label="Birim" data={unitOptions({ includeBranch: true, onlyActive: false })} value={editing.data.unitId} onChange={(value) => set('unitId', value ?? BRANCH)} searchable required />
          </SimpleGrid>
          <TextInput label="Konu / başlık" value={editing.data.title} onChange={(event) => set('title', event.currentTarget.value)} required />
          <Textarea label="Tutanak / karar / açıklama" value={editing.data.summary} onChange={(event) => set('summary', event.currentTarget.value)} minRows={6} autosize required />
          <TextInput label="Katılanlar" description="Virgülle ayırabilirsiniz" value={editing.data.attendees} onChange={(event) => set('attendees', event.currentTarget.value)} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}><DateInput label="Takip tarihi" value={editing.data.followUpDate} onChange={(value) => set('followUpDate', value)} valueFormat="DD.MM.YYYY" clearable /><TextInput label="Drive / belge bağlantısı" value={editing.data.fileLink} onChange={(event) => set('fileLink', event.currentTarget.value)} /></SimpleGrid>
          {editing.data.fileLink && <Anchor href={editing.data.fileLink} target="_blank" size="sm">Bağlantıyı kontrol et</Anchor>}
          <Group justify="flex-end"><Button variant="default" onClick={() => setEditing(null)}>Vazgeç</Button><Button onClick={save} loading={busy}>Kaydet</Button></Group>
        </Stack>}
      </Modal>
    </Stack>
  );
}
