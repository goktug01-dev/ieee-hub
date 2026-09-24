import { ActionIcon, Badge, Button, Group, Menu, Modal, Stack, Table, Text, TextInput } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { modals } from '@mantine/modals';
import { IconDots, IconEdit, IconFlag, IconLock, IconPlus } from '@tabler/icons-react';
import { collection, doc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, PageHeader, notifyError, notifySuccess } from '../../components/ui';
import { db } from '../../firebase';
import { endAssignments } from '../../lib/assignments';
import { logAudit } from '../../lib/audit';
import { dateStringToTs, fmtDate, slugify, tsToDateString } from '../../lib/format';
import { useOrg } from '../../lib/org';
import type { Assignment, Term, TermStatus } from '../../lib/types';

const STATUS: Record<TermStatus, { label: string; color: string }> = {
  planned: { label: 'Planlandı', color: 'gray' },
  active: { label: 'Aktif', color: 'green' },
  closed: { label: 'Kapandı', color: 'dark' },
};

export function TermsPage() {
  const { terms } = useOrg();
  const { orgSettings } = useAuth();
  const [editing, setEditing] = useState<{ id: string | null; name: string; start: string | null; end: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!editing?.name.trim() || !editing.start || !editing.end) return;
    const id = editing.id ?? slugify(editing.name);
    setBusy(true);
    try {
      const existing = terms.find((t) => t.id === id);
      await setDoc(doc(db, 'terms', id), {
        name: editing.name.trim(),
        startsAt: dateStringToTs(editing.start),
        endsAt: dateStringToTs(editing.end, true),
        status: existing?.status ?? 'planned',
      });
      await logAudit(editing.id ? 'term.update' : 'term.create', `terms/${id}`, { name: editing.name });
      notifySuccess('Dönem kaydedildi.');
      setEditing(null);
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  const activate = async (t: Term & { id: string }) => {
    try {
      for (const other of terms.filter((x) => x.status === 'active' && x.id !== t.id)) {
        await updateDoc(doc(db, 'terms', other.id), { status: 'planned' });
      }
      await updateDoc(doc(db, 'terms', t.id), { status: 'active' });
      await setDoc(doc(db, 'settings', 'org'), { ...orgSettings, activeTermId: t.id });
      await logAudit('term.activate', `terms/${t.id}`, { name: t.name });
      notifySuccess(`${t.name} aktif dönem oldu.`);
    } catch (e) {
      notifyError(e);
    }
  };

  const close = (t: Term & { id: string }) =>
    modals.openConfirmModal({
      title: `${t.name} kapatılsın mı?`,
      children: (
        <Text size="sm">
          Bu döneme bağlı tüm <b>aktif görevler sonlandırılır</b> ve yetkileri kalkar. Yeni dönemin görevlileri Seçimler veya
          Görev atamaları ekranından atanmalıdır. Geçmiş dilekçe ve onaylar etkilenmez.
        </Text>
      ),
      labels: { confirm: 'Dönemi kapat', cancel: 'Vazgeç' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const snap = await getDocs(query(collection(db, 'assignments'), where('termId', '==', t.id), where('status', '==', 'active')));
          const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Assignment) }));
          if (list.length) await endAssignments(list, `${t.name} dönemi kapatıldı`);
          await updateDoc(doc(db, 'terms', t.id), { status: 'closed' });
          await logAudit('term.close', `terms/${t.id}`, { name: t.name, endedAssignments: list.length });
          notifySuccess(`${t.name} kapatıldı. ${list.length} görev sonlandırıldı.`);
        } catch (e) {
          notifyError(e);
        }
      },
    });

  const newTerm = () => {
    const y = new Date().getFullYear();
    setEditing({ id: null, name: `${y}-${y + 1} Dönemi`, start: `${y}-09-01`, end: `${y + 1}-08-31` });
  };

  return (
    <Stack>
      <PageHeader
        title="Dönemler"
        description="Görevler döneme bağlıdır. Dönem kapatıldığında o döneme ait görevler sona erer; böylece yönetim devrinde eski yetkiler açık kalmaz."
        actions={
          <Button leftSection={<IconPlus size={18} />} onClick={newTerm}>
            Yeni dönem
          </Button>
        }
      />
      {terms.length === 0 ? (
        <EmptyState title="Dönem yok" />
      ) : (
        <Table.ScrollContainer minWidth={560}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Dönem</Table.Th>
                <Table.Th>Başlangıç</Table.Th>
                <Table.Th>Bitiş</Table.Th>
                <Table.Th>Durum</Table.Th>
                <Table.Th w={48} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {terms.map((t) => (
                <Table.Tr key={t.id}>
                  <Table.Td fw={500}>
                    {t.name} {orgSettings.activeTermId === t.id && <Badge ml={6} size="xs">varsayılan</Badge>}
                  </Table.Td>
                  <Table.Td>{fmtDate(t.startsAt)}</Table.Td>
                  <Table.Td>{fmtDate(t.endsAt)}</Table.Td>
                  <Table.Td>
                    <Badge color={STATUS[t.status].color}>{STATUS[t.status].label}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Menu position="bottom-end">
                      <Menu.Target>
                        <ActionIcon variant="subtle" aria-label="İşlemler">
                          <IconDots size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconEdit size={16} />}
                          onClick={() => setEditing({ id: t.id, name: t.name, start: tsToDateString(t.startsAt), end: tsToDateString(t.endsAt) })}
                        >
                          Düzenle
                        </Menu.Item>
                        {t.status !== 'active' && t.status !== 'closed' && (
                          <Menu.Item leftSection={<IconFlag size={16} />} onClick={() => void activate(t)}>
                            Aktif dönem yap
                          </Menu.Item>
                        )}
                        {t.status !== 'closed' && (
                          <Menu.Item color="red" leftSection={<IconLock size={16} />} onClick={() => close(t)}>
                            Dönemi kapat
                          </Menu.Item>
                        )}
                      </Menu.Dropdown>
                    </Menu>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <Modal opened={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Dönemi düzenle' : 'Yeni dönem'}>
        {editing && (
          <Stack>
            <TextInput label="Ad" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.currentTarget.value })} required />
            <Group grow>
              <DateInput label="Başlangıç" valueFormat="DD.MM.YYYY" value={editing.start} onChange={(v) => setEditing({ ...editing, start: v })} required />
              <DateInput label="Bitiş" valueFormat="DD.MM.YYYY" value={editing.end} onChange={(v) => setEditing({ ...editing, end: v })} required />
            </Group>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEditing(null)}>
                Vazgeç
              </Button>
              <Button onClick={save} loading={busy}>
                Kaydet
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
