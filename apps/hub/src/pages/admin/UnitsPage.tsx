import { ActionIcon, Badge, Button, Group, Modal, NumberInput, Select, Stack, Switch, Table, Text, TextInput, Textarea } from '@mantine/core';
import { IconEdit, IconPlus } from '@tabler/icons-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { EmptyState, PageHeader, notifyError, notifySuccess } from '../../components/ui';
import { db } from '../../firebase';
import { logAudit } from '../../lib/audit';
import { UNIT_TYPE_LABEL, slugify } from '../../lib/format';
import { useOrg } from '../../lib/org';
import type { Unit, UnitType, WithId } from '../../lib/types';

const EMPTY: Unit = { name: '', shortCode: '', type: 'committee', parentId: null, description: '', active: true, order: 10 };

export function UnitsPage() {
  const { units, unitName } = useOrg();
  const [editing, setEditing] = useState<{ id: string | null; data: Unit } | null>(null);
  const [newId, setNewId] = useState('');
  const [busy, setBusy] = useState(false);

  const openNew = () => {
    setNewId('');
    setEditing({ id: null, data: { ...EMPTY, order: (units.at(-1)?.order ?? 0) + 1 } });
  };
  const openEdit = (u: WithId<Unit>) => {
    const { id, ...data } = u;
    setEditing({ id, data: { ...EMPTY, ...data } });
  };

  const save = async () => {
    if (!editing) return;
    const d = editing.data;
    const id = editing.id ?? (newId.trim() || slugify(d.shortCode || d.name));
    if (!d.name.trim() || !d.shortCode.trim() || !id) return;
    if (d.parentId === id) return notifyError(new Error('Bir birim kendi üst birimi olamaz.'));
    setBusy(true);
    try {
      if (!editing.id && (await getDoc(doc(db, 'units', id))).exists()) throw new Error(`"${id}" kimliğiyle bir birim zaten var.`);
      await setDoc(doc(db, 'units', id), { ...d, shortCode: d.shortCode.toUpperCase() });
      await logAudit(editing.id ? 'unit.update' : 'unit.create', `units/${id}`, { name: d.name });
      notifySuccess(editing.id ? 'Birim güncellendi.' : 'Birim oluşturuldu.');
      setEditing(null);
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof Unit>(k: K, v: Unit[K]) => setEditing((e) => (e ? { ...e, data: { ...e.data, [k]: v } } : e));

  return (
    <Stack>
      <PageHeader
        title="Komiteler ve birimler"
        description="Komiteler, başkanlıklar, departmanlar ve proje ekipleri. Birimler silinmez, pasifleştirilir; geçmiş dilekçe ve görevler bozulmaz."
        actions={
          <Button leftSection={<IconPlus size={18} />} onClick={openNew}>
            Yeni birim
          </Button>
        }
      />
      {units.length === 0 ? (
        <EmptyState title="Henüz birim yok" action={<Button size="xs" variant="light" onClick={openNew}>İlk birimi ekle</Button>} />
      ) : (
        <Table.ScrollContainer minWidth={720}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Ad</Table.Th>
                <Table.Th>Kod</Table.Th>
                <Table.Th>Tür</Table.Th>
                <Table.Th>Üst birim</Table.Th>
                <Table.Th>Durum</Table.Th>
                <Table.Th w={48} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {units.map((u) => (
                <Table.Tr key={u.id} style={{ opacity: u.active ? 1 : 0.55 }}>
                  <Table.Td>
                    <Text fw={500} size="sm">
                      {u.name}
                    </Text>
                    <Text size="xs" c="dimmed" ff="monospace">
                      {u.id}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="outline">{u.shortCode}</Badge>
                  </Table.Td>
                  <Table.Td>{UNIT_TYPE_LABEL[u.type]}</Table.Td>
                  <Table.Td>{u.parentId ? unitName(u.parentId) : '—'}</Table.Td>
                  <Table.Td>{u.active ? <Badge color="green">Aktif</Badge> : <Badge color="gray">Pasif</Badge>}</Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" onClick={() => openEdit(u)} aria-label="Düzenle">
                      <IconEdit size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <Modal opened={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Birimi düzenle' : 'Yeni birim'} size="lg">
        {editing && (
          <Stack>
            <TextInput label="Ad" placeholder="örn. Computer Society" required value={editing.data.name} onChange={(e) => set('name', e.currentTarget.value)} />
            <Group grow>
              <TextInput
                label="Kısa kod"
                description="Evrak ve raporlarda görünür"
                placeholder="CS"
                required
                value={editing.data.shortCode}
                onChange={(e) => set('shortCode', e.currentTarget.value.toUpperCase())}
              />
              <Select
                label="Tür"
                data={Object.entries(UNIT_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
                value={editing.data.type}
                onChange={(v) => set('type', (v ?? 'committee') as UnitType)}
              />
            </Group>
            {!editing.id && (
              <TextInput
                label="Kalıcı kimlik"
                description="Değiştirilemez; boş bırakılırsa kısa koddan üretilir"
                placeholder={slugify(editing.data.shortCode || editing.data.name) || 'cs'}
                value={newId}
                onChange={(e) => setNewId(slugify(e.currentTarget.value))}
              />
            )}
            <Select
              label="Üst birim"
              description="Örn. bir departman bir başkanlığa bağlıysa"
              data={units.filter((u) => u.id !== editing.id).map((u) => ({ value: u.id, label: u.name }))}
              value={editing.data.parentId}
              onChange={(v) => set('parentId', v)}
              clearable
              allowDeselect
              searchable
            />
            <Textarea label="Açıklama" value={editing.data.description ?? ''} onChange={(e) => set('description', e.currentTarget.value)} />
            <Group grow>
              <NumberInput label="Sıra" value={editing.data.order} onChange={(v) => set('order', Number(v) || 0)} />
              <Switch mt="lg" label="Aktif" checked={editing.data.active} onChange={(e) => set('active', e.currentTarget.checked)} />
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
