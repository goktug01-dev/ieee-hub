import { ActionIcon, Alert, Badge, Button, Group, Modal, Select, SimpleGrid, Stack, Table, Tabs, Text, TextInput, Textarea } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconDownload, IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, PageHeader, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { db } from '../../firebase';
import { fmtDate } from '../../lib/format';
import { useCollection } from '../../lib/hooks';
import { downloadText, toCsv } from '../../lib/ops';
import type { InventoryItem, InventoryKind } from '../../lib/opsTypes';
import type { WithId } from '../../lib/types';

interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'select';
  options?: string[];
  inTable?: boolean;
}

const KINDS: Record<InventoryKind, { label: string; titleLabel: string; description: string; fields: FieldDef[] }> = {
  system: {
    label: 'Sistemler',
    titleLabel: 'Sistem',
    description: 'Kullanılan her sistem: amaç, sahip hesap, yöneticiler ve kurtarma yöntemi. Her kritik sistemde en az iki yönetici olmalı.',
    fields: [
      { key: 'purpose', label: 'Amaç', inTable: true },
      { key: 'ownerAccount', label: 'Sahip hesap', inTable: true },
      { key: 'admins', label: 'Yöneticiler (virgülle)', inTable: true },
      { key: 'criticality', label: 'Kritiklik', type: 'select', options: ['Kritik', 'Önemli', 'Düşük'], inTable: true },
      { key: 'accessMethod', label: 'Erişim biçimi' },
      { key: 'recovery', label: 'Kurtarma yöntemi', type: 'textarea' },
      { key: 'cost', label: 'Maliyet' },
      { key: 'dataTypes', label: 'Tuttuğu veri türleri' },
      { key: 'notes', label: 'Notlar', type: 'textarea' },
    ],
  },
  access: {
    label: 'Hesap ve erişimler',
    titleLabel: 'Kişi',
    description: 'Kim, hangi sistemde, hangi yetkiyle. Eski yönetimden kalan erişimleri işaretleyin. Bu liste yalnızca envanter yetkisi olanlara açıktır.',
    fields: [
      { key: 'system', label: 'Sistem', inTable: true },
      { key: 'level', label: 'Yetki', type: 'select', options: ['Sahip', 'Yönetici', 'Düzenleyici', 'Görüntüleyici'], inTable: true },
      { key: 'status', label: 'Durum', type: 'select', options: ['Aktif', 'Kapatılacak', 'Kapatıldı', 'Eski yönetimden kalan'], inTable: true },
      { key: 'reviewDate', label: 'Gözden geçirme tarihi', inTable: true },
      { key: 'notes', label: 'Notlar', type: 'textarea' },
    ],
  },
  data: {
    label: 'Kişisel veri envanteri',
    titleLabel: 'Veri alanı',
    description: 'Her kişisel veri alanı için amaç, kaynak, sistem, erişen roller, saklama süresi ve silme yöntemi (KVKK).',
    fields: [
      { key: 'purpose', label: 'Amaç', inTable: true },
      { key: 'system', label: 'Sistem', inTable: true },
      { key: 'source', label: 'Kaynak' },
      { key: 'roles', label: 'Erişen roller' },
      { key: 'retention', label: 'Saklama süresi', inTable: true },
      { key: 'deletion', label: 'Silme yöntemi' },
      { key: 'thirdParties', label: 'Üçüncü taraflar' },
    ],
  },
  risk: {
    label: 'Riskler',
    titleLabel: 'Risk',
    description: 'Bildirge §15 riskleri ve yeni riskler: olasılık, etki, sorumlu, önlem.',
    fields: [
      { key: 'likelihood', label: 'Olasılık', type: 'select', options: ['Yüksek', 'Orta', 'Düşük'], inTable: true },
      { key: 'impact', label: 'Etki', type: 'select', options: ['Yüksek', 'Orta', 'Düşük'], inTable: true },
      { key: 'owner', label: 'Sorumlu', inTable: true },
      { key: 'status', label: 'Durum', type: 'select', options: ['Açık', 'Önlem alınıyor', 'Kapandı'], inTable: true },
      { key: 'mitigation', label: 'Önlem', type: 'textarea' },
    ],
  },
};

export function InventoryPage() {
  const [tab, setTab] = useState<InventoryKind>('system');
  return (
    <Stack>
      <PageHeader
        title="Envanter"
        description='"Hangi sistem var, kim yönetiyor, kaybedersek nasıl kurtarırız?" sorularının yazılı cevabı (WP-01). Şifre veya gizli anahtar bu kayıtlara yazılmaz.'
      />
      <Tabs value={tab} onChange={(v) => setTab((v ?? 'system') as InventoryKind)} keepMounted={false}>
        <Tabs.List mb="md">
          {(Object.keys(KINDS) as InventoryKind[]).map((k) => (
            <Tabs.Tab key={k} value={k}>
              {KINDS[k].label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {(Object.keys(KINDS) as InventoryKind[]).map((k) => (
          <Tabs.Panel key={k} value={k}>
            <Register kind={k} />
          </Tabs.Panel>
        ))}
      </Tabs>
    </Stack>
  );
}

function Register({ kind }: { kind: InventoryKind }) {
  const { user } = useAuth();
  const def = KINDS[kind];
  const items = useCollection<InventoryItem>('inventory', [where('kind', '==', kind)], `inv-${kind}`);
  const [edit, setEdit] = useState<{ id: string | null; title: string; fields: Record<string, string> } | null>(null);
  const tableFields = def.fields.filter((f) => f.inTable);

  const save = async () => {
    if (!edit || !edit.title.trim()) return;
    const payload = { kind, title: edit.title.trim(), fields: edit.fields, updatedAt: serverTimestamp(), updatedByName: user!.displayName ?? '' };
    try {
      if (edit.id) await updateDoc(doc(db, 'inventory', edit.id), payload);
      else await addDoc(collection(db, 'inventory'), payload);
      notifySuccess('Kaydedildi.');
      setEdit(null);
    } catch (e) {
      notifyError(e);
    }
  };

  const singleAdmin = (i: WithId<InventoryItem>) =>
    kind === 'system' && i.fields.criticality === 'Kritik' && (i.fields.admins ?? '').split(',').filter((x) => x.trim()).length < 2;

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap">
        <Text size="sm" c="dimmed" maw={720}>
          {def.description}
        </Text>
        <Group gap="xs">
          <Button
            size="xs"
            variant="default"
            leftSection={<IconDownload size={14} />}
            onClick={() => downloadText(toCsv([[def.titleLabel, ...def.fields.map((f) => f.label)], ...items.data.map((i) => [i.title, ...def.fields.map((f) => i.fields[f.key] ?? '')])]), `envanter_${kind}.csv`)}
          >
            CSV
          </Button>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setEdit({ id: null, title: '', fields: {} })}>
            Kayıt ekle
          </Button>
        </Group>
      </Group>
      {kind === 'system' && items.data.some(singleAdmin) && (
        <Alert color="red" variant="light">
          Tek yöneticili kritik sistem var: {items.data.filter(singleAdmin).map((i) => i.title).join(', ')}. İkinci yönetici ekleyin (Bildirge §5.3).
        </Alert>
      )}
      {items.loading ? (
        <SectionLoader />
      ) : items.data.length === 0 ? (
        <EmptyState title="Kayıt yok" />
      ) : (
        <Table.ScrollContainer minWidth={720}>
          <Table highlightOnHover verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{def.titleLabel}</Table.Th>
                {tableFields.map((f) => (
                  <Table.Th key={f.key}>{f.label}</Table.Th>
                ))}
                <Table.Th>Güncelleme</Table.Th>
                <Table.Th w={70} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.data.map((i) => (
                <Table.Tr key={i.id}>
                  <Table.Td fw={500}>
                    {i.title} {singleAdmin(i) && <Badge color="red" size="xs">tek yönetici</Badge>}
                  </Table.Td>
                  {tableFields.map((f) => (
                    <Table.Td key={f.key}>{i.fields[f.key] ?? '—'}</Table.Td>
                  ))}
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {fmtDate(i.updatedAt)} · {i.updatedByName}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={2} wrap="nowrap">
                      <ActionIcon variant="subtle" onClick={() => setEdit({ id: i.id, title: i.title, fields: i.fields })} aria-label="Düzenle">
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label="Sil"
                        onClick={() =>
                          modals.openConfirmModal({
                            title: `${i.title} silinsin mi?`,
                            labels: { confirm: 'Sil', cancel: 'Vazgeç' },
                            confirmProps: { color: 'red' },
                            onConfirm: () => deleteDoc(doc(db, 'inventory', i.id)).catch(notifyError),
                          })
                        }
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      <Modal opened={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Kaydı düzenle' : 'Yeni kayıt'} size="lg">
        {edit && (
          <Stack>
            <TextInput label={def.titleLabel} required value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.currentTarget.value })} />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              {def.fields
                .filter((f) => f.type !== 'textarea')
                .map((f) =>
                  f.type === 'select' ? (
                    <Select
                      key={f.key}
                      label={f.label}
                      data={f.options ?? []}
                      value={edit.fields[f.key] ?? null}
                      onChange={(v) => setEdit({ ...edit, fields: { ...edit.fields, [f.key]: v ?? '' } })}
                      clearable
                      allowDeselect
                    />
                  ) : (
                    <TextInput key={f.key} label={f.label} value={edit.fields[f.key] ?? ''} onChange={(e) => setEdit({ ...edit, fields: { ...edit.fields, [f.key]: e.currentTarget.value } })} />
                  ),
                )}
            </SimpleGrid>
            {def.fields
              .filter((f) => f.type === 'textarea')
              .map((f) => (
                <Textarea key={f.key} label={f.label} autosize minRows={2} value={edit.fields[f.key] ?? ''} onChange={(e) => setEdit({ ...edit, fields: { ...edit.fields, [f.key]: e.currentTarget.value } })} />
              ))}
            <Group justify="flex-end">
              <Button onClick={() => void save()}>Kaydet</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
