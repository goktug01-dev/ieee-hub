import { ActionIcon, Anchor, Badge, Button, Card, Group, Modal, NumberInput, Progress, Select, SimpleGrid, Stack, Table, Text, TextInput } from '@mantine/core';
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { addDoc, collection, doc, orderBy, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, PageHeader, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { db } from '../../firebase';
import { hasPermission, unitsWithPermission } from '../../lib/access';
import { useCollection } from '../../lib/hooks';
import type { Budget, BudgetLine, HubEvent } from '../../lib/opsTypes';
import { useOrg } from '../../lib/org';
import type { WithId } from '../../lib/types';

const tl = (n: number) => n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
const STATUS = { draft: { label: 'Taslak', color: 'gray' }, approved: { label: 'Onaylı', color: 'blue' }, closed: { label: 'Kapandı', color: 'green' } } as const;

export function BudgetsPage() {
  const { access, orgSettings } = useAuth();
  const { units } = useOrg();
  const [params, setParams] = useSearchParams();
  const canAll = hasPermission(access, 'finance.read') || hasPermission(access, 'finance.manage');
  const canManage = hasPermission(access, 'finance.manage');
  const myUnits = unitsWithPermission(access, 'unit.manage');
  const requestedUnit = params.get('birim');
  const scopedUnit = requestedUnit && (canAll || myUnits.includes(requestedUnit)) ? requestedUnit : (myUnits[0] ?? null);
  const all = useCollection<Budget>(canAll ? 'budgets' : null, [orderBy('updatedAt', 'desc')], 'budgets');
  const unitBudgets = useCollection<Budget>(!canAll && scopedUnit ? 'budgets' : null, [where('unitId', '==', scopedUnit ?? '-')], `bu-${scopedUnit}`);
  const list = canAll ? all.data.filter((budget) => !requestedUnit || budget.unitId === requestedUnit) : unitBudgets.data;
  const [edit, setEdit] = useState<{ id: string | null; data: Budget } | null>(null);

  const totals = useMemo(() => list.reduce((a, b) => ({ p: a.p + b.plannedTotal, r: a.r + b.actualTotal }), { p: 0, r: 0 }), [list]);

  const blank = (): Budget => ({
    title: '',
    scope: 'event',
    unitId: '',
    unitName: '',
    eventId: null,
    termId: orgSettings.activeTermId,
    lines: [{ label: '', planned: 0, actual: 0 }],
    plannedTotal: 0,
    actualTotal: 0,
    sheetLink: '',
    docsLink: '',
    status: 'draft',
    updatedAt: null as never,
  });

  return (
    <Stack>
      <PageHeader
        title="Bütçeler"
        description="Etkinlik ve birim bütçelerinin özeti. Finansal kayıtların ana kaynağı Sheets ve Drive'dır; Hub özet ve bağlantı tutar."
        actions={
          canManage && (
            <Button leftSection={<IconPlus size={18} />} onClick={() => setEdit({ id: null, data: blank() })}>
              Yeni bütçe
            </Button>
          )
        }
      />
      {(canAll || myUnits.length > 1) && (
        <Select
          label="Birim filtresi"
          placeholder="Tüm birimler"
          data={units.filter((unit) => canAll || myUnits.includes(unit.id)).map((unit) => ({ value: unit.id, label: unit.name }))}
          value={requestedUnit}
          onChange={(value) => {
            const next = new URLSearchParams(params);
            value ? next.set('birim', value) : next.delete('birim');
            setParams(next, { replace: true });
          }}
          clearable={canAll}
          searchable
          maw={420}
        />
      )}
      {list.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <Card>
            <Text c="dimmed" size="sm">
              Planlanan
            </Text>
            <Text fw={700} fz={24}>
              {tl(totals.p)}
            </Text>
          </Card>
          <Card>
            <Text c="dimmed" size="sm">
              Gerçekleşen
            </Text>
            <Text fw={700} fz={24}>
              {tl(totals.r)}
            </Text>
          </Card>
          <Card>
            <Text c="dimmed" size="sm">
              Fark
            </Text>
            <Text fw={700} fz={24} c={totals.r > totals.p ? 'red' : 'green'}>
              {tl(totals.p - totals.r)}
            </Text>
          </Card>
        </SimpleGrid>
      )}
      {(canAll ? all.loading : unitBudgets.loading) ? (
        <SectionLoader />
      ) : list.length === 0 ? (
        <EmptyState title="Bütçe kaydı yok" description={canAll || myUnits.length ? undefined : 'Bütçeleri Sayman ve birim yöneticileri görür.'} />
      ) : (
        <Table.ScrollContainer minWidth={760}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Bütçe</Table.Th>
                <Table.Th>Birim</Table.Th>
                <Table.Th>Planlanan</Table.Th>
                <Table.Th>Gerçekleşen</Table.Th>
                <Table.Th w={160}>Kullanım</Table.Th>
                <Table.Th>Durum</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.map((b) => {
                const pct = b.plannedTotal ? Math.round((b.actualTotal / b.plannedTotal) * 100) : 0;
                return (
                  <Table.Tr key={b.id}>
                    <Table.Td>
                      <Text fw={500} size="sm">
                        {b.title}
                      </Text>
                      <Group gap={6}>
                        {b.sheetLink && (
                          <Anchor href={b.sheetLink} target="_blank" size="xs">
                            Sheets
                          </Anchor>
                        )}
                        {b.docsLink && (
                          <Anchor href={b.docsLink} target="_blank" size="xs">
                            Belgeler
                          </Anchor>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>{b.unitName}</Table.Td>
                    <Table.Td>{tl(b.plannedTotal)}</Table.Td>
                    <Table.Td>{tl(b.actualTotal)}</Table.Td>
                    <Table.Td>
                      <Progress value={Math.min(pct, 100)} color={pct > 100 ? 'red' : 'blue'} />
                      <Text size="xs" c="dimmed">
                        %{pct}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={STATUS[b.status].color}>{STATUS[b.status].label}</Badge>
                    </Table.Td>
                    <Table.Td>
                      {canManage && (
                        <ActionIcon variant="subtle" onClick={() => setEdit({ id: b.id, data: b })} aria-label="Düzenle">
                          <IconEdit size={16} />
                        </ActionIcon>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      <BudgetModal edit={edit} onClose={() => setEdit(null)} />
    </Stack>
  );
}

function BudgetModal({ edit, onClose }: { edit: { id: string | null; data: Budget } | null; onClose: () => void }) {
  const { unitOptions, unitName } = useOrg();
  const events = useCollection<HubEvent>(edit ? 'events' : null, [orderBy('createdAt', 'desc')], 'ev-budget');
  const [f, setF] = useState<Budget | null>(null);
  const cur = f ?? edit?.data ?? null;
  if (!edit || !cur) return null;
  const set = (p: Partial<Budget>) => setF({ ...cur, ...p });
  const setLine = (i: number, p: Partial<BudgetLine>) => set({ lines: cur.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) });

  const save = async () => {
    if (!cur.title.trim() || !cur.unitId) return notifyError(new Error('Başlık ve birim zorunludur.'), 'Eksik bilgi');
    const plannedTotal = cur.lines.reduce((a, l) => a + (l.planned || 0), 0);
    const actualTotal = cur.lines.reduce((a, l) => a + (l.actual || 0), 0);
    const { id: _id, ...rest } = cur as WithId<Budget>;
    const payload = { ...rest, unitName: unitName(cur.unitId), plannedTotal, actualTotal, updatedAt: serverTimestamp() };
    try {
      if (edit.id) await updateDoc(doc(db, 'budgets', edit.id), payload);
      else await addDoc(collection(db, 'budgets'), payload);
      notifySuccess('Bütçe kaydedildi.');
      setF(null);
      onClose();
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <Modal opened onClose={() => { setF(null); onClose(); }} title={edit.id ? 'Bütçeyi düzenle' : 'Yeni bütçe'} size="xl">
      <Stack>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="Başlık" required value={cur.title} onChange={(e) => set({ title: e.currentTarget.value })} />
          <Select label="Birim" required data={unitOptions({ includeBranch: true })} value={cur.unitId || null} onChange={(v) => set({ unitId: v ?? '' })} searchable />
          <Select label="Kapsam" data={[{ value: 'event', label: 'Etkinlik bütçesi' }, { value: 'unit', label: 'Birim / dönem bütçesi' }]} value={cur.scope} onChange={(v) => set({ scope: (v ?? 'event') as Budget['scope'] })} />
          {cur.scope === 'event' && (
            <Select label="Etkinlik" data={events.data.map((e) => ({ value: e.id, label: `${e.code} · ${e.name}` }))} value={cur.eventId} onChange={(v) => set({ eventId: v })} searchable clearable allowDeselect />
          )}
          <TextInput label="Sheets bağlantısı" value={cur.sheetLink} onChange={(e) => set({ sheetLink: e.currentTarget.value })} />
          <TextInput label="Finansal belgeler (Drive)" value={cur.docsLink} onChange={(e) => set({ docsLink: e.currentTarget.value })} />
          <Select label="Durum" data={Object.entries(STATUS).map(([value, m]) => ({ value, label: m.label }))} value={cur.status} onChange={(v) => set({ status: (v ?? 'draft') as Budget['status'] })} />
        </SimpleGrid>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Kalem</Table.Th>
              <Table.Th w={160}>Planlanan (TL)</Table.Th>
              <Table.Th w={160}>Gerçekleşen (TL)</Table.Th>
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {cur.lines.map((l, i) => (
              <Table.Tr key={i}>
                <Table.Td>
                  <TextInput size="xs" value={l.label} onChange={(e) => setLine(i, { label: e.currentTarget.value })} />
                </Table.Td>
                <Table.Td>
                  <NumberInput size="xs" min={0} value={l.planned} onChange={(v) => setLine(i, { planned: Number(v) || 0 })} thousandSeparator="." decimalSeparator="," />
                </Table.Td>
                <Table.Td>
                  <NumberInput size="xs" min={0} value={l.actual} onChange={(v) => setLine(i, { actual: Number(v) || 0 })} thousandSeparator="." decimalSeparator="," />
                </Table.Td>
                <Table.Td>
                  <ActionIcon variant="subtle" color="red" onClick={() => set({ lines: cur.lines.filter((_, j) => j !== i) })} aria-label="Sil">
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Group justify="space-between">
          <Button size="xs" variant="light" onClick={() => set({ lines: [...cur.lines, { label: '', planned: 0, actual: 0 }] })}>
            Kalem ekle
          </Button>
          <Text size="sm">
            Toplam: {tl(cur.lines.reduce((a, l) => a + (l.planned || 0), 0))} / {tl(cur.lines.reduce((a, l) => a + (l.actual || 0), 0))}
          </Text>
        </Group>
        <Group justify="flex-end">
          <Button onClick={() => void save()}>Kaydet</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
