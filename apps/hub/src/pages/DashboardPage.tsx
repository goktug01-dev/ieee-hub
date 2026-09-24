import { Anchor, Badge, Button, Card, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import {
  IconArrowRight,
  IconChecklist,
  IconFilePlus,
  IconFileText,
  IconUserPlus,
} from '@tabler/icons-react';
import { orderBy, where, limit } from 'firebase/firestore';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, StatusBadge } from '../components/ui';
import { fmtRelative } from '../lib/format';
import { useCollection } from '../lib/hooks';
import { useInbox } from '../lib/inbox';
import type { Assignment, Member, Petition } from '../lib/types';
import { useOrg } from '../lib/org';

function StatCard({ label, value, icon, to, color }: { label: string; value: number | string; icon: ReactNode; to: string; color: string }) {
  return (
    <Card component={Link} to={to} style={{ textDecoration: 'none' }}>
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text c="dimmed" size="sm">
            {label}
          </Text>
          <Text fw={700} fz={28}>
            {value}
          </Text>
        </div>
        <ThemeIcon size={48} radius="xl" variant="light" color={color}>
          {icon}
        </ThemeIcon>
      </Group>
    </Card>
  );
}

export function DashboardPage() {
  const { member, user, can } = useAuth();
  const { unitName } = useOrg();
  const inbox = useInbox();
  const mine = useCollection<Petition>(
    'petitions',
    [where('ownerUid', '==', user!.uid), orderBy('updatedAt', 'desc'), limit(8)],
    user!.uid,
  );
  const myRoles = useCollection<Assignment>(
    'assignments',
    [where('uid', '==', user!.uid), where('status', '==', 'active')],
    user!.uid,
  );
  const pendingMembers = useCollection<Member>(
    can('members.manage') ? 'members' : null,
    [where('status', '==', 'pending')],
    'pending',
  );

  const drafts = mine.data.filter((p) => p.status === 'draft' || p.status === 'returned').length;
  const inProgress = mine.data.filter((p) => p.status === 'pending').length;
  const firstName = member?.displayName?.split(' ')[0] ?? '';

  return (
    <Stack gap="xl">
      <Group justify="space-between" wrap="wrap">
        <div>
          <Title order={2}>Merhaba {firstName} 👋</Title>
          <Group gap={6} mt={6}>
            {myRoles.data.length === 0 ? (
              <Text c="dimmed" size="sm">
                Henüz bir görev atamanız yok.
              </Text>
            ) : (
              myRoles.data.map((a) => (
                <Badge key={a.id} variant="light">
                  {a.roleName}
                  {a.unitId !== 'branch' ? ` · ${unitName(a.unitId)}` : ''}
                </Badge>
              ))
            )}
          </Group>
        </div>
        <Button component={Link} to="/dilekceler/yeni" leftSection={<IconFilePlus size={18} />} size="md">
          Yeni dilekçe
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, xs: 2, md: can('members.manage') ? 4 : 3 }}>
        <StatCard label="Onayımı bekleyen" value={inbox.waiting.length} icon={<IconChecklist />} to="/onaylar" color="red" />
        <StatCard label="Süreçteki dilekçelerim" value={inProgress} icon={<IconFileText />} to="/dilekceler" color="blue" />
        <StatCard label="Taslak / iade edilen" value={drafts} icon={<IconFilePlus />} to="/dilekceler" color="orange" />
        {can('members.manage') && (
          <StatCard label="Onay bekleyen üye" value={pendingMembers.data.length} icon={<IconUserPlus />} to="/yonetim/uyeler" color="grape" />
        )}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Card>
          <Group justify="space-between" mb="sm">
            <Text fw={600}>Onayımı bekleyenler</Text>
            <Anchor component={Link} to="/onaylar" size="sm">
              Tümü
            </Anchor>
          </Group>
          {inbox.waiting.length === 0 ? (
            <EmptyState title="Bekleyen onay yok" description="Onayınızı bekleyen dilekçeler burada görünür." />
          ) : (
            <Stack gap="xs">
              {inbox.waiting.slice(0, 6).map((p) => (
                <PetitionRow key={p.id} p={p} />
              ))}
            </Stack>
          )}
        </Card>

        <Card>
          <Group justify="space-between" mb="sm">
            <Text fw={600}>Son dilekçelerim</Text>
            <Anchor component={Link} to="/dilekceler" size="sm">
              Tümü
            </Anchor>
          </Group>
          {mine.data.length === 0 ? (
            <EmptyState
              title="Henüz dilekçeniz yok"
              action={
                <Button component={Link} to="/dilekceler/yeni" variant="light" size="xs">
                  İlk dilekçeni oluştur
                </Button>
              }
            />
          ) : (
            <Stack gap="xs">
              {mine.data.map((p) => (
                <PetitionRow key={p.id} p={p} />
              ))}
            </Stack>
          )}
        </Card>
      </SimpleGrid>
    </Stack>
  );
}

export function PetitionRow({ p }: { p: Petition & { id: string } }) {
  return (
    <Card component={Link} to={`/dilekceler/${p.id}`} padding="sm" radius="md" style={{ textDecoration: 'none' }}>
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <div style={{ minWidth: 0 }}>
          <Text fw={500} truncate>
            {p.title || p.templateName}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {p.documentNo ?? 'Taslak'} · {p.unitId === 'branch' ? 'Kol Geneli' : p.unitName} · {p.ownerName} · {fmtRelative(p.updatedAt)}
          </Text>
        </div>
        <Group gap={6} wrap="nowrap">
          <StatusBadge status={p.status} />
          <IconArrowRight size={16} opacity={0.5} />
        </Group>
      </Group>
    </Card>
  );
}
