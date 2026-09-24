import { Button, Group, Modal, MultiSelect, Select, SimpleGrid, Stack, TextInput, Textarea } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { hasUnitPermission } from '../lib/access';
import { useCollection } from '../lib/hooks';
import { useActiveMembers } from '../lib/members';
import { createTask, updateTask, type NewTask } from '../lib/ops';
import { TASK_PRIORITY, TASK_STATUS } from '../lib/opsLabels';
import type { HubEvent, Project, Task, TaskPriority, TaskStatus } from '../lib/opsTypes';
import { useOrg } from '../lib/org';
import type { WithId } from '../lib/types';
import { notifyError, notifySuccess } from './ui';

const EMPTY: NewTask = {
  title: '',
  description: '',
  unitId: '',
  unitName: '',
  projectId: null,
  eventId: null,
  assigneeUid: '',
  assigneeName: '',
  supporterUids: [],
  supporterNames: [],
  startDate: null,
  dueDate: null,
  priority: 'normal',
  status: 'todo',
  doneCriteria: '',
  fileLink: '',
};

/** Görev oluşturma / düzenleme penceresi. */
export function TaskModal({
  opened,
  onClose,
  task,
  preset,
}: {
  opened: boolean;
  onClose: () => void;
  task?: WithId<Task> | null;
  preset?: Partial<NewTask>;
}) {
  const { access } = useAuth();
  const { units, unitName } = useOrg();
  const { options: memberOptions, nameOf } = useActiveMembers(opened);
  const [f, setF] = useState<NewTask>(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!opened) return;
    if (task) {
      const { code: _c, createdBy: _a, createdByName: _b, createdAt: _d, updatedAt: _e, completedAt: _g, id: _i, ...rest } = task;
      setF({ ...EMPTY, ...rest });
    } else setF({ ...EMPTY, ...preset });
  }, [opened, task, preset]);

  const unitChoices = useMemo(
    () =>
      units
        .filter(
          (u) =>
            u.active &&
            (hasUnitPermission(access, u.id, 'unit.tasks.manage', 'work.manageAll') || hasUnitPermission(access, u.id, 'unit.manage')),
        )
        .map((u) => ({ value: u.id, label: `${u.name} (${u.shortCode})` })),
    [units, access],
  );

  const projects = useCollection<Project>(f.unitId ? 'projects' : null, [where('unitId', '==', f.unitId)], `p-${f.unitId}`);
  const events = useCollection<HubEvent>(f.unitId ? 'events' : null, [where('unitId', '==', f.unitId)], `e-${f.unitId}`);

  const set = <K extends keyof NewTask>(k: K, v: NewTask[K]) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    if (!f.title.trim() || !f.unitId || !f.assigneeUid || !f.doneCriteria.trim()) {
      return notifyError(new Error('Başlık, birim, sorumlu ve tamamlanma ölçütü zorunludur.'), 'Eksik bilgi');
    }
    setBusy(true);
    const payload: NewTask = {
      ...f,
      unitName: unitName(f.unitId),
      assigneeName: nameOf(f.assigneeUid),
      supporterNames: f.supporterUids.map(nameOf),
    };
    try {
      if (task) {
        await updateTask(task.id, payload, task.status);
        notifySuccess('Görev güncellendi.');
      } else {
        const short = units.find((u) => u.id === f.unitId)?.shortCode ?? 'GRV';
        await createTask(payload, short);
        notifySuccess(`${payload.assigneeName} kişisine atandı.`, 'Görev oluşturuldu');
      }
      onClose();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={task ? `Görevi düzenle · ${task.code}` : 'Yeni görev'} size="lg">
      <Stack>
        <TextInput label="Başlık" required value={f.title} onChange={(e) => set('title', e.currentTarget.value)} data-autofocus />
        <Textarea label="Açıklama" autosize minRows={2} value={f.description} onChange={(e) => set('description', e.currentTarget.value)} />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label="Birim"
            required
            data={unitChoices}
            value={f.unitId || null}
            onChange={(v) => setF((x) => ({ ...x, unitId: v ?? '', projectId: null, eventId: null }))}
            searchable
            disabled={!!task}
          />
          <Select label="Sorumlu (tek kişi)" required data={memberOptions} value={f.assigneeUid || null} onChange={(v) => set('assigneeUid', v ?? '')} searchable />
        </SimpleGrid>
        <MultiSelect label="Destek verenler" data={memberOptions} value={f.supporterUids} onChange={(v) => set('supporterUids', v)} searchable />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label="Proje"
            data={projects.data.map((p) => ({ value: p.id, label: p.name }))}
            value={f.projectId}
            onChange={(v) => set('projectId', v)}
            clearable
            allowDeselect
            disabled={!f.unitId}
          />
          <Select
            label="Etkinlik"
            data={events.data.map((e) => ({ value: e.id, label: `${e.code} · ${e.name}` }))}
            value={f.eventId}
            onChange={(v) => set('eventId', v)}
            clearable
            allowDeselect
            disabled={!f.unitId}
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <DateInput label="Başlangıç" valueFormat="DD.MM.YYYY" value={f.startDate} onChange={(v) => set('startDate', v)} clearable />
          <DateInput label="Son tarih" valueFormat="DD.MM.YYYY" value={f.dueDate} onChange={(v) => set('dueDate', v)} clearable />
          <Select
            label="Öncelik"
            data={Object.entries(TASK_PRIORITY).map(([value, m]) => ({ value, label: m.label }))}
            value={f.priority}
            onChange={(v) => set('priority', (v ?? 'normal') as TaskPriority)}
          />
          <Select
            label="Durum"
            data={Object.entries(TASK_STATUS).map(([value, m]) => ({ value, label: m.label }))}
            value={f.status}
            onChange={(v) => set('status', (v ?? 'todo') as TaskStatus)}
          />
        </SimpleGrid>
        <TextInput
          label="Tamamlanma ölçütü"
          description="Görev ne zaman bitmiş sayılır?"
          required
          value={f.doneCriteria}
          onChange={(e) => set('doneCriteria', e.currentTarget.value)}
        />
        <TextInput label="Dosya bağlantısı (Drive)" value={f.fileLink} onChange={(e) => set('fileLink', e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Vazgeç
          </Button>
          <Button onClick={save} loading={busy}>
            {task ? 'Kaydet' : 'Oluştur'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
