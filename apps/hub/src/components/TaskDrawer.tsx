import { Anchor, Badge, Button, Divider, Drawer, Group, SegmentedControl, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { IconEdit, IconExternalLink, IconSend } from '@tabler/icons-react';
import { orderBy } from 'firebase/firestore';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { hasUnitPermission } from '../lib/access';
import { fmtDate, fmtDateTime, fmtRelative } from '../lib/format';
import { useCollection } from '../lib/hooks';
import { addTaskComment, updateTask } from '../lib/ops';
import { TASK_PRIORITY, TASK_STATUS } from '../lib/opsLabels';
import type { Task, TaskComment, TaskStatus } from '../lib/opsTypes';
import type { WithId } from '../lib/types';
import { MetaBadge, dueInfo } from './MetaBadge';
import { TaskModal } from './TaskModal';
import { notifyError } from './ui';

export function canManageTask(access: ReturnType<typeof useAuth>['access'], unitId: string) {
  return hasUnitPermission(access, unitId, 'unit.tasks.manage', 'work.manageAll') || hasUnitPermission(access, unitId, 'unit.manage');
}

/** Görev ayrıntısı: durum güncelleme, not, dosya bağlantısı ve yorumlar. */
export function TaskDrawer({ task, onClose }: { task: WithId<Task> | null; onClose: () => void }) {
  const { user, access } = useAuth();
  const [comment, setComment] = useState('');
  const [note, setNote] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const comments = useCollection<TaskComment>(task ? `tasks/${task.id}/comments` : null, [orderBy('at')], task?.id ?? '');

  if (!task) return null;
  const isParticipant = task.assigneeUid === user?.uid || task.supporterUids.includes(user?.uid ?? '');
  const canManage = canManageTask(access, task.unitId);
  const canUpdate = isParticipant || canManage;
  const due = dueInfo(task.dueDate, task.status === 'done' || task.status === 'cancelled');

  const setStatus = async (status: TaskStatus) => {
    try {
      await updateTask(task.id, { status, ...(note.trim() ? { statusNote: note.trim() } : {}) }, task.status);
      setNote('');
    } catch (e) {
      notifyError(e);
    }
  };

  const send = async () => {
    if (!comment.trim()) return;
    try {
      await addTaskComment(task.id, comment.trim());
      setComment('');
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <Drawer opened={!!task} onClose={onClose} position="right" size="lg" title={<Text fw={700}>{task.code}</Text>}>
      <Stack>
        <div>
          <Text fw={700} fz="lg">
            {task.title}
          </Text>
          <Group gap={6} mt={6}>
            <MetaBadge map={TASK_STATUS} value={task.status} />
            <MetaBadge map={TASK_PRIORITY} value={task.priority} variant="outline" />
            {due && <Badge color={due.color}>{due.label}</Badge>}
            <Badge variant="light" color="gray">
              {task.unitName}
            </Badge>
          </Group>
        </div>
        {task.description && <Text style={{ whiteSpace: 'pre-wrap' }}>{task.description}</Text>}
        <Stack gap={4}>
          <Text size="sm">
            <b>Sorumlu:</b> {task.assigneeName}
          </Text>
          {task.supporterNames.length > 0 && (
            <Text size="sm">
              <b>Destek:</b> {task.supporterNames.join(', ')}
            </Text>
          )}
          <Text size="sm">
            <b>Tarih:</b> {task.startDate ? fmtDate(new Date(task.startDate)) : '—'} → {task.dueDate ? fmtDate(new Date(task.dueDate)) : 'son tarih yok'}
          </Text>
          <Text size="sm">
            <b>Tamamlanma ölçütü:</b> {task.doneCriteria}
          </Text>
          {task.fileLink && (
            <Anchor href={task.fileLink} target="_blank" size="sm">
              <Group gap={4}>
                Dosya <IconExternalLink size={14} />
              </Group>
            </Anchor>
          )}
          {task.statusNote && (
            <Text size="sm" c="dimmed">
              Son not: {task.statusNote}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            {task.createdByName} oluşturdu · {fmtDateTime(task.createdAt)}
          </Text>
        </Stack>

        {canUpdate && (
          <>
            <Divider label="Durumu güncelle" />
            <SegmentedControl
              fullWidth
              value={task.status}
              onChange={(v) => void setStatus(v as TaskStatus)}
              data={(['todo', 'in_progress', 'blocked', 'done'] as TaskStatus[]).map((s) => ({ value: s, label: TASK_STATUS[s].label }))}
            />
            <TextInput placeholder="Durum notu (isteğe bağlı, sonraki güncellemeyle kaydedilir)" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
          </>
        )}
        {canManage && (
          <Group>
            <Button variant="default" leftSection={<IconEdit size={16} />} onClick={() => setEditOpen(true)}>
              Düzenle
            </Button>
            {task.status !== 'cancelled' && (
              <Button variant="subtle" color="red" onClick={() => void setStatus('cancelled')}>
                İptal et
              </Button>
            )}
          </Group>
        )}

        <Divider label={`Yorumlar (${comments.data.length})`} />
        <Stack gap="xs">
          {comments.data.map((c) => (
            <div key={c.id}>
              <Text size="sm">
                <b>{c.byName}</b>{' '}
                <Text span size="xs" c="dimmed">
                  {fmtRelative(c.at)}
                </Text>
              </Text>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {c.text}
              </Text>
            </div>
          ))}
        </Stack>
        <Group align="flex-end" wrap="nowrap">
          <Textarea placeholder="Yorum yaz…" autosize minRows={1} style={{ flex: 1 }} value={comment} onChange={(e) => setComment(e.currentTarget.value)} />
          <Button onClick={send} leftSection={<IconSend size={16} />}>
            Gönder
          </Button>
        </Group>
      </Stack>
      <TaskModal opened={editOpen} onClose={() => setEditOpen(false)} task={task} />
    </Drawer>
  );
}
