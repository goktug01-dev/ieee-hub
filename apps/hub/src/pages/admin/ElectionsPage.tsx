import { Badge, Button, Card, Group, Modal, Select, SimpleGrid, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconPlus } from '@tabler/icons-react';
import { addDoc, collection, orderBy, serverTimestamp } from 'firebase/firestore';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, PageHeader, SectionLoader, notifyError } from '../../components/ui';
import { db } from '../../firebase';
import { logAudit } from '../../lib/audit';
import { dateStringToTs, fmtDate } from '../../lib/format';
import { useCollection } from '../../lib/hooks';
import { useOrg } from '../../lib/org';
import type { Election, ElectionStatus } from '../../lib/types';

export const ELECTION_STATUS: Record<ElectionStatus, { label: string; color: string }> = {
  draft: { label: 'Hazırlanıyor', color: 'gray' },
  completed: { label: 'Sonuçlandı', color: 'blue' },
  applied: { label: 'Görevlere işlendi', color: 'green' },
};

export function ElectionsPage() {
  const { user, orgSettings } = useAuth();
  const { terms } = useOrg();
  const navigate = useNavigate();
  const list = useCollection<Election>('elections', [orderBy('createdAt', 'desc')], 'elections');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', termId: orgSettings.activeTermId as string | null, date: null as string | null, description: '' });
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      const ref = await addDoc(collection(db, 'elections'), {
        title: form.title.trim(),
        termId: form.termId,
        date: dateStringToTs(form.date),
        description: form.description,
        status: 'draft',
        positions: [],
        eligibleVoters: null,
        totalVotes: null,
        createdBy: user!.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAudit('election.create', `elections/${ref.id}`, { title: form.title });
      navigate(`/yonetim/secimler/${ref.id}`);
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  const termName = (id: string | null) => terms.find((t) => t.id === id)?.name ?? '—';

  return (
    <Stack>
      <PageHeader
        title="Seçimler"
        description="Genel kurul ve komite seçimlerinin kaydı. Sonuçlar tek tıkla görev atamalarına işlenir; eski görevliler isteğe bağlı olarak sonlandırılır."
        actions={
          <Button leftSection={<IconPlus size={18} />} onClick={() => setOpen(true)}>
            Yeni seçim
          </Button>
        }
      />
      {list.loading ? (
        <SectionLoader />
      ) : list.data.length === 0 ? (
        <EmptyState title="Henüz seçim kaydı yok" description="Örn. '2026-2027 Olağan Genel Kurul' veya 'CS Komite Başkanlığı Seçimi'." />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {list.data.map((e) => (
            <Card key={e.id} component={Link} to={`/yonetim/secimler/${e.id}`} style={{ textDecoration: 'none' }}>
              <Group justify="space-between" mb={6}>
                <Badge color={ELECTION_STATUS[e.status].color}>{ELECTION_STATUS[e.status].label}</Badge>
                <Text size="xs" c="dimmed">
                  {fmtDate(e.date)}
                </Text>
              </Group>
              <Text fw={600}>{e.title}</Text>
              <Text size="sm" c="dimmed">
                {termName(e.termId)} · {e.positions.length} pozisyon
              </Text>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Modal opened={open} onClose={() => setOpen(false)} title="Yeni seçim">
        <Stack>
          <TextInput label="Başlık" placeholder="örn. 2026-2027 Olağan Genel Kurul Seçimi" value={form.title} onChange={(e) => setForm({ ...form, title: e.currentTarget.value })} required />
          <Group grow>
            <Select label="Dönem" data={terms.map((t) => ({ value: t.id, label: t.name }))} value={form.termId} onChange={(v) => setForm({ ...form, termId: v })} />
            <DateInput label="Seçim tarihi" valueFormat="DD.MM.YYYY" value={form.date} onChange={(v) => setForm({ ...form, date: v })} clearable />
          </Group>
          <Textarea label="Açıklama" placeholder="Yöntem, divan, tutanak bilgisi…" value={form.description} onChange={(e) => setForm({ ...form, description: e.currentTarget.value })} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={create} loading={busy}>
              Oluştur
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
