import { Badge, Button, Card, Group, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconCalendarStar, IconFilePlus, IconListCheck, IconPlus, IconSpeakerphone, IconUsers } from '@tabler/icons-react';
import { where } from 'firebase/firestore';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { hasUnitPermission } from '../lib/access';
import { useCollection } from '../lib/hooks';
import type { Assignment } from '../lib/types';
import type { ContentRequest, HubEvent, Project, Task } from '../lib/opsTypes';
import { useOrg } from '../lib/org';

function Metric({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Card padding="md">
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text size="xs" c="dimmed">{label}</Text>
          <Text fw={700} fz={24}>{value}</Text>
        </div>
        <ThemeIcon variant="light" color={color} radius="xl" size={38}>{icon}</ThemeIcon>
      </Group>
    </Card>
  );
}

export function UnitOverview({ unitId, compact = false }: { unitId: string; compact?: boolean }) {
  const { access } = useAuth();
  const { unitName } = useOrg();
  const tasks = useCollection<Task>('tasks', [where('unitId', '==', unitId)], `unit-overview-t-${unitId}`);
  const projects = useCollection<Project>('projects', [where('unitId', '==', unitId)], `unit-overview-p-${unitId}`);
  const events = useCollection<HubEvent>('events', [where('unitId', '==', unitId)], `unit-overview-e-${unitId}`);
  const content = useCollection<ContentRequest>('contentRequests', [where('requestingUnitId', '==', unitId)], `unit-overview-c-${unitId}`);
  const assignments = useCollection<Assignment>('assignments', [where('unitId', '==', unitId)], `unit-overview-a-${unitId}`);
  const canManage = hasUnitPermission(access, unitId, 'unit.manage', 'work.manageAll');
  const canPropose = hasUnitPermission(access, unitId, 'unit.events.propose', 'events.manageAll') || canManage;
  const openTasks = tasks.data.filter((task) => !['done', 'cancelled'].includes(task.status));
  const activeProjects = projects.data.filter((project) => ['planning', 'active'].includes(project.status));
  const upcomingEvents = events.data.filter((event) => !['rejected', 'cancelled', 'reported', 'archived'].includes(event.status));
  const openRequests = content.data.filter((request) => !['published', 'rejected', 'cancelled'].includes(request.status));
  const activeTeam = assignments.data.filter((assignment) => assignment.status === 'active');

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, md: 5 }}>
        <Metric label="Açık görev" value={openTasks.length} icon={<IconListCheck size={19} />} color="teal" />
        <Metric label="Aktif proje" value={activeProjects.length} icon={<IconListCheck size={19} />} color="blue" />
        <Metric label="Etkinlik" value={upcomingEvents.length} icon={<IconCalendarStar size={19} />} color="grape" />
        <Metric label="İletişim talebi" value={openRequests.length} icon={<IconSpeakerphone size={19} />} color="orange" />
        <Metric label="Aktif ekip" value={activeTeam.length} icon={<IconUsers size={19} />} color="cyan" />
      </SimpleGrid>

      <Card>
        <Group justify="space-between" mb="sm" wrap="wrap">
          <div>
            <Text fw={600}>Hızlı işlemler</Text>
            <Text size="sm" c="dimmed">{unitName(unitId)} bağlamı formlara hazır gelir.</Text>
          </div>
          <Group gap="xs">
            {canManage && <Button component={Link} to={`/gorevler?sekme=pano&birim=${unitId}&yeni=1`} size="xs" leftSection={<IconPlus size={14} />}>Görev oluştur</Button>}
            {canPropose && <Button component={Link} to={`/etkinlikler?birim=${unitId}&yeni=1`} size="xs" variant="light" leftSection={<IconCalendarStar size={14} />}>Etkinlik öner</Button>}
            <Button component={Link} to={`/dilekceler/yeni?birim=${unitId}`} size="xs" variant="light" leftSection={<IconFilePlus size={14} />}>Dilekçe oluştur</Button>
            {canPropose && <Button component={Link} to={`/iletisim?birim=${unitId}&yeni=1`} size="xs" variant="light" leftSection={<IconSpeakerphone size={14} />}>İçerik talep et</Button>}
          </Group>
        </Group>
      </Card>

      {!compact && (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Card>
            <Group justify="space-between" mb="sm"><Text fw={600}>Öncelikli görevler</Text><Button component={Link} to={`/gorevler?sekme=pano&birim=${unitId}`} variant="subtle" size="xs">Tümü</Button></Group>
            <Stack gap="xs">
              {openTasks.length ? openTasks.slice(0, 6).map((task) => (
                <Group key={task.id} justify="space-between" wrap="nowrap">
                  <Text size="sm" lineClamp={1}>{task.title}</Text>
                  <Badge variant="light" color={task.status === 'blocked' ? 'red' : 'blue'}>{task.assigneeName}</Badge>
                </Group>
              )) : <Text size="sm" c="dimmed">Açık görev yok.</Text>}
            </Stack>
          </Card>
          <Card>
            <Group justify="space-between" mb="sm"><Text fw={600}>Süreçteki etkinlikler</Text><Button component={Link} to={`/etkinlikler?birim=${unitId}`} variant="subtle" size="xs">Tümü</Button></Group>
            <Stack gap="xs">
              {upcomingEvents.length ? upcomingEvents.slice(0, 6).map((event) => (
                <Group key={event.id} justify="space-between" wrap="nowrap">
                  <Text component={Link} to={`/etkinlikler/${event.id}`} size="sm" lineClamp={1}>{event.name}</Text>
                  <Badge variant="light">{event.status}</Badge>
                </Group>
              )) : <Text size="sm" c="dimmed">Süreçte etkinlik yok.</Text>}
            </Stack>
          </Card>
        </SimpleGrid>
      )}
    </Stack>
  );
}
