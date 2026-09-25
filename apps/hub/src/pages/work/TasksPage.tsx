import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Paper,
  Progress,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconEdit, IconPlus, IconSearch } from '@tabler/icons-react';
import { addDoc, collection, doc, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { MetaBadge, dueInfo } from '../../components/MetaBadge';
import { TaskDrawer, canManageTask } from '../../components/TaskDrawer';
import { TaskModal } from '../../components/TaskModal';
import { EmptyState, PageHeader, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { db } from '../../firebase';
import { hasPermission, hasUnitPermission, isUnitMember } from '../../lib/access';
import { fmtDate } from '../../lib/format';
import { useCollection } from '../../lib/hooks';
import { useActiveMembers } from '../../lib/members';
import { updateTask } from '../../lib/ops';
import { PROJECT_STATUS, TASK_PRIORITY, TASK_STATUS } from '../../lib/opsLabels';
import type { Project, ProjectStatus, Task, TaskStatus } from '../../lib/opsTypes';
import { useOrg } from '../../lib/org';
import type { WithId } from '../../lib/types';

const BOARD_COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done'];

function TaskCard({ t, onOpen, draggable }: { t: WithId<Task>; onOpen: () => void; draggable?: boolean }) {
  const due = dueInfo(t.dueDate, t.status === 'done' || t.status === 'cancelled');
  return (
    <Card
      padding="sm"
      radius="md"
      onClick={onOpen}
      style={{ cursor: 'pointer' }}
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData('text/task', t.id)}
    >
      <Group justify="space-between" gap={4} wrap="nowrap">
        <Text size="xs" c="dimmed" ff="monospace">
          {t.code}
        </Text>
        <MetaBadge map={TASK_PRIORITY} value={t.priority} size="xs" variant="outline" />
      </Group>
      <Text size="sm" fw={600} mt={4} lineClamp={2}>
        {t.title}
      </Text>
      <Group justify="space-between" mt={6} gap={4}>
        <Text size="xs" c="dimmed" truncate maw={140}>
          {t.assigneeName}
        </Text>
        {due ? (
          <Badge size="xs" color={due.color}>
            {due.label}
          </Badge>
        ) : t.dueDate ? (
          <Text size="xs" c="dimmed">
            {fmtDate(new Date(t.dueDate))}
          </Text>
        ) : null}
      </Group>
    </Card>
  );
}

function sortTasks(a: Task, b: Task) {
  const d = (x: Task) => (x.dueDate ? new Date(x.dueDate).getTime() : Infinity);
  return d(a) - d(b);
}

export function TasksPage() {
  const { user, access } = useAuth();
  const { units } = useOrg();
  const [params, setParams] = useSearchParams();
  const tab = params.get('sekme') ?? 'benim';
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(params.get('yeni') === '1');

  const seeAll = hasPermission(access, 'work.manageAll') || hasPermission(access, 'reports.read');
  const unitChoices = useMemo(
    () => units.filter((u) => seeAll || isUnitMember(access, u.id)).map((u) => ({ value: u.id, label: `${u.name} (${u.shortCode})` })),
    [units, access, seeAll],
  );
  const [unitId, setUnitId] = useState<string | null>(null);
  useEffect(() => {
    if (!unitId && unitChoices.length) setUnitId(params.get('birim') ?? unitChoices[0].value);
  }, [unitChoices, unitId, params]);

  const mine = useCollection<Task>('tasks', [where('assigneeUid', '==', user!.uid)], `mine-${user!.uid}`);
  const supporting = useCollection<Task>('tasks', [where('supporterUids', 'array-contains', user!.uid)], `sup-${user!.uid}`);
  const board = useCollection<Task>(unitId ? 'tasks' : null, [where('unitId', '==', unitId)], `board-${unitId}`);

  const allLoaded = [...mine.data, ...supporting.data, ...board.data];
  const selected = allLoaded.find((t) => t.id === selectedId) ?? null;

  const canCreate = units.some((u) => canManageTask(access, u.id));
  const changeUnit = (value: string | null) => {
    setUnitId(value);
    const next = new URLSearchParams(params);
    value ? next.set('birim', value) : next.delete('birim');
    setParams(next, { replace: true });
  };

  return (
    <Stack>
      <PageHeader
        title="Görevler ve projeler"
        description="Her görevin tek sorumlusu, son tarihi ve tamamlanma ölçütü vardır. Hub'a girilmeyen iş resmî görev sayılmaz."
        actions={
          canCreate && (
            <Button leftSection={<IconPlus size={18} />} onClick={() => setNewOpen(true)}>
              Yeni görev
            </Button>
          )
        }
      />
      <Tabs value={tab} onChange={(v) => { const next = new URLSearchParams(params); next.set('sekme', v ?? 'benim'); setParams(next); }} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="benim">Görevlerim</Tabs.Tab>
          <Tabs.Tab value="pano">Birim panosu</Tabs.Tab>
          <Tabs.Tab value="projeler">Projeler</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="benim">
          <MyTasks tasks={[...mine.data, ...supporting.data.filter((s) => !mine.data.some((m) => m.id === s.id))]} loading={mine.loading} onOpen={setSelectedId} />
        </Tabs.Panel>

        <Tabs.Panel value="pano">
          {unitChoices.length === 0 ? (
            <EmptyState title="Görevli olduğunuz bir birim yok" description="Birim panoları, birimde görevi olan kişilere açıktır." />
          ) : (
            <Board unitId={unitId} setUnitId={changeUnit} unitChoices={unitChoices} tasks={board.data} loading={board.loading} onOpen={setSelectedId} />
          )}
        </Tabs.Panel>

        <Tabs.Panel value="projeler">
          {unitChoices.length === 0 ? (
            <EmptyState title="Görevli olduğunuz bir birim yok" />
          ) : (
            <Projects unitId={unitId} setUnitId={changeUnit} unitChoices={unitChoices} tasks={board.data} />
          )}
        </Tabs.Panel>
      </Tabs>

      <TaskDrawer task={selected} onClose={() => setSelectedId(null)} />
      <TaskModal opened={newOpen} onClose={() => setNewOpen(false)} preset={unitId ? { unitId } : undefined} />
    </Stack>
  );
}

function MyTasks({ tasks, loading, onOpen }: { tasks: WithId<Task>[]; loading: boolean; onOpen: (id: string) => void }) {
  const [showDone, setShowDone] = useState(false);
  if (loading) return <SectionLoader />;
  const open = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled').sort(sortTasks);
  const overdue = open.filter((t) => dueInfo(t.dueDate, false)?.color === 'red');
  const soon = open.filter((t) => !overdue.includes(t) && t.dueDate && new Date(t.dueDate).getTime() - Date.now() < 7 * 864e5);
  const rest = open.filter((t) => !overdue.includes(t) && !soon.includes(t));
  const done = tasks.filter((t) => t.status === 'done' || t.status === 'cancelled');
  if (!tasks.length) return <EmptyState title="Size atanmış görev yok" description="Birim yöneticiniz görev atadığında burada görünür." />;
  const Section = ({ title, list, color }: { title: string; list: WithId<Task>[]; color?: string }) =>
    list.length ? (
      <Stack gap="xs">
        <Text fw={600} c={color}>
          {title} ({list.length})
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {list.map((t) => (
            <TaskCard key={t.id} t={t} onOpen={() => onOpen(t.id)} />
          ))}
        </SimpleGrid>
      </Stack>
    ) : null;
  return (
    <Stack gap="lg">
      <Section title="Gecikenler" list={overdue} color="red" />
      <Section title="Bu hafta" list={soon} />
      <Section title="Diğer açık görevler" list={rest} />
      {done.length > 0 && (
        <Anchor component="button" size="sm" onClick={() => setShowDone((x) => !x)}>
          {showDone ? 'Tamamlananları gizle' : `Tamamlananları göster (${done.length})`}
        </Anchor>
      )}
      {showDone && <Section title="Tamamlanan / iptal" list={done} />}
    </Stack>
  );
}

function Board({
  unitId,
  setUnitId,
  unitChoices,
  tasks,
  loading,
  onOpen,
}: {
  unitId: string | null;
  setUnitId: (v: string | null) => void;
  unitChoices: { value: string; label: string }[];
  tasks: WithId<Task>[];
  loading: boolean;
  onOpen: (id: string) => void;
}) {
  const { access } = useAuth();
  const [view, setView] = useState('kanban');
  const [q, setQ] = useState('');
  const [assignee, setAssignee] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>(null);
  const canManage = unitId ? canManageTask(access, unitId) : false;

  const filtered = tasks
    .filter((t) => t.status !== 'cancelled')
    .filter((t) => !assignee || t.assigneeUid === assignee)
    .filter((t) => !priority || t.priority === priority)
    .filter((t) => !q || `${t.code} ${t.title} ${t.assigneeName}`.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')))
    .sort(sortTasks);
  const assignees = [...new Map(tasks.map((t) => [t.assigneeUid, t.assigneeName])).entries()].map(([value, label]) => ({ value, label }));

  const drop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/task');
    const t = tasks.find((x) => x.id === id);
    if (!t || t.status === status) return;
    try {
      await updateTask(id, { status }, t.status);
    } catch (err) {
      notifyError(err);
    }
  };

  return (
    <Stack>
      <Group wrap="wrap">
        <Select data={unitChoices} value={unitId} onChange={setUnitId} searchable w={260} allowDeselect={false} />
        <TextInput placeholder="Ara…" leftSection={<IconSearch size={16} />} value={q} onChange={(e) => setQ(e.currentTarget.value)} style={{ flex: '1 1 180px' }} />
        <Select placeholder="Sorumlu" data={assignees} value={assignee} onChange={setAssignee} clearable allowDeselect w={180} />
        <Select
          placeholder="Öncelik"
          data={Object.entries(TASK_PRIORITY).map(([value, m]) => ({ value, label: m.label }))}
          value={priority}
          onChange={setPriority}
          clearable
          allowDeselect
          w={140}
        />
        <SegmentedControl value={view} onChange={setView} data={[{ value: 'kanban', label: 'Pano' }, { value: 'liste', label: 'Liste' }]} />
      </Group>
      {loading ? (
        <SectionLoader />
      ) : view === 'kanban' ? (
        <ScrollArea type="auto" offsetScrollbars>
          <Group align="flex-start" wrap="nowrap" gap="md">
            {BOARD_COLUMNS.map((s) => {
              const col = filtered.filter((t) => t.status === s);
              return (
                <Paper
                  key={s}
                  withBorder
                  p="sm"
                  w={290}
                  miw={260}
                  bg="var(--mantine-color-default-hover)"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => void drop(e, s)}
                >
                  <Group justify="space-between" mb="sm">
                    <MetaBadge map={TASK_STATUS} value={s} />
                    <Text size="sm" c="dimmed">
                      {col.length}
                    </Text>
                  </Group>
                  <Stack gap="xs" mih={80}>
                    {col.map((t) => (
                      <TaskCard key={t.id} t={t} onOpen={() => onOpen(t.id)} draggable={canManage} />
                    ))}
                  </Stack>
                </Paper>
              );
            })}
          </Group>
        </ScrollArea>
      ) : filtered.length === 0 ? (
        <EmptyState title="Görev yok" />
      ) : (
        <Table.ScrollContainer minWidth={760}>
          <Table highlightOnHover verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Kod</Table.Th>
                <Table.Th>Görev</Table.Th>
                <Table.Th>Sorumlu</Table.Th>
                <Table.Th>Son tarih</Table.Th>
                <Table.Th>Öncelik</Table.Th>
                <Table.Th>Durum</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((t) => {
                const due = dueInfo(t.dueDate, t.status === 'done');
                return (
                  <Table.Tr key={t.id} onClick={() => onOpen(t.id)} style={{ cursor: 'pointer' }}>
                    <Table.Td ff="monospace">{t.code}</Table.Td>
                    <Table.Td>{t.title}</Table.Td>
                    <Table.Td>{t.assigneeName}</Table.Td>
                    <Table.Td>
                      {t.dueDate ? fmtDate(new Date(t.dueDate)) : <Badge color="orange" variant="outline">yok</Badge>}{' '}
                      {due && (
                        <Badge size="xs" color={due.color}>
                          {due.label}
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <MetaBadge map={TASK_PRIORITY} value={t.priority} variant="outline" />
                    </Table.Td>
                    <Table.Td>
                      <MetaBadge map={TASK_STATUS} value={t.status} />
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      {canManage && view === 'kanban' && (
        <Text size="xs" c="dimmed">
          İpucu: Kartları sütunlar arasında sürükleyerek durumunu değiştirebilirsiniz.
        </Text>
      )}
    </Stack>
  );
}

const EMPTY_PROJECT = { name: '', goal: '', ownerUid: '', status: 'planning' as ProjectStatus, startDate: null as string | null, endDate: null as string | null, fileLink: '', closingNote: '' };

function Projects({
  unitId,
  setUnitId,
  unitChoices,
  tasks,
}: {
  unitId: string | null;
  setUnitId: (v: string | null) => void;
  unitChoices: { value: string; label: string }[];
  tasks: WithId<Task>[];
}) {
  const { access, user } = useAuth();
  const { unitName } = useOrg();
  const { options, nameOf } = useActiveMembers();
  const projects = useCollection<Project>(unitId ? 'projects' : null, [where('unitId', '==', unitId)], `proj-${unitId}`);
  const [edit, setEdit] = useState<{ id: string | null; data: typeof EMPTY_PROJECT } | null>(null);
  const canManage = unitId ? hasUnitPermission(access, unitId, 'unit.manage', 'work.manageAll') : false;

  const save = async () => {
    if (!edit || !unitId || !edit.data.name.trim() || !edit.data.ownerUid) return;
    const payload = { ...edit.data, unitId, unitName: unitName(unitId), ownerName: nameOf(edit.data.ownerUid), updatedAt: serverTimestamp() };
    try {
      if (edit.id) await updateDoc(doc(db, 'projects', edit.id), payload);
      else await addDoc(collection(db, 'projects'), { ...payload, createdAt: serverTimestamp() });
      notifySuccess('Proje kaydedildi.');
      setEdit(null);
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Select data={unitChoices} value={unitId} onChange={setUnitId} searchable w={260} allowDeselect={false} />
        {canManage && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => setEdit({ id: null, data: { ...EMPTY_PROJECT, ownerUid: user!.uid } })}>
            Yeni proje
          </Button>
        )}
      </Group>
      {projects.loading ? (
        <SectionLoader />
      ) : projects.data.length === 0 ? (
        <EmptyState title="Bu birimde proje yok" />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {projects.data.map((p) => {
            const pt = tasks.filter((t) => t.projectId === p.id && t.status !== 'cancelled');
            const done = pt.filter((t) => t.status === 'done').length;
            const pct = pt.length ? Math.round((done / pt.length) * 100) : 0;
            return (
              <Card key={p.id}>
                <Group justify="space-between" wrap="nowrap">
                  <Title order={5}>{p.name}</Title>
                  {(canManage || p.ownerUid === user?.uid) && (
                    <ActionIcon
                      variant="subtle"
                      onClick={() =>
                        setEdit({
                          id: p.id,
                          data: { name: p.name, goal: p.goal, ownerUid: p.ownerUid, status: p.status, startDate: p.startDate, endDate: p.endDate, fileLink: p.fileLink, closingNote: p.closingNote },
                        })
                      }
                      aria-label="Düzenle"
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                  )}
                </Group>
                <Group gap={6} mt={4}>
                  <MetaBadge map={PROJECT_STATUS} value={p.status} />
                  <Text size="xs" c="dimmed">
                    Sorumlu: {p.ownerName}
                  </Text>
                </Group>
                {p.goal && (
                  <Text size="sm" mt="xs" lineClamp={3}>
                    {p.goal}
                  </Text>
                )}
                <Text size="xs" c="dimmed" mt="sm">
                  {done}/{pt.length} görev tamamlandı
                </Text>
                <Progress value={pct} mt={4} />
                {p.fileLink && (
                  <Anchor href={p.fileLink} target="_blank" size="xs" mt="xs">
                    Proje dosyaları
                  </Anchor>
                )}
              </Card>
            );
          })}
        </SimpleGrid>
      )}
      <Modal opened={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Projeyi düzenle' : 'Yeni proje'} size="lg">
        {edit && (
          <Stack>
            <TextInput label="Proje adı" required value={edit.data.name} onChange={(e) => setEdit({ ...edit, data: { ...edit.data, name: e.currentTarget.value } })} />
            <Textarea label="Amaç" autosize minRows={2} value={edit.data.goal} onChange={(e) => setEdit({ ...edit, data: { ...edit.data, goal: e.currentTarget.value } })} />
            <SimpleGrid cols={2}>
              <Select label="Sorumlu" data={options} value={edit.data.ownerUid || null} onChange={(v) => setEdit({ ...edit, data: { ...edit.data, ownerUid: v ?? '' } })} searchable />
              <Select
                label="Durum"
                data={Object.entries(PROJECT_STATUS).map(([value, m]) => ({ value, label: m.label }))}
                value={edit.data.status}
                onChange={(v) => setEdit({ ...edit, data: { ...edit.data, status: (v ?? 'planning') as ProjectStatus } })}
              />
              <DateInput label="Başlangıç" valueFormat="DD.MM.YYYY" value={edit.data.startDate} onChange={(v) => setEdit({ ...edit, data: { ...edit.data, startDate: v } })} clearable />
              <DateInput label="Bitiş" valueFormat="DD.MM.YYYY" value={edit.data.endDate} onChange={(v) => setEdit({ ...edit, data: { ...edit.data, endDate: v } })} clearable />
            </SimpleGrid>
            <TextInput label="Dosya klasörü (Drive)" value={edit.data.fileLink} onChange={(e) => setEdit({ ...edit, data: { ...edit.data, fileLink: e.currentTarget.value } })} />
            {(edit.data.status === 'completed' || edit.data.status === 'cancelled') && (
              <Textarea
                label="Kapanış değerlendirmesi"
                autosize
                minRows={2}
                value={edit.data.closingNote}
                onChange={(e) => setEdit({ ...edit, data: { ...edit.data, closingNote: e.currentTarget.value } })}
              />
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEdit(null)}>
                Vazgeç
              </Button>
              <Button onClick={save}>Kaydet</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
