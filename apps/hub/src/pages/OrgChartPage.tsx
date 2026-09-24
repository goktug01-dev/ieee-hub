import { Avatar, Badge, Card, Group, SegmentedControl, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { where } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { EmptyState, PageHeader, SectionLoader } from '../components/ui';
import { UNIT_TYPE_LABEL } from '../lib/format';
import { useCollection } from '../lib/hooks';
import { useOrg } from '../lib/org';
import type { Assignment, WithId } from '../lib/types';
import { BRANCH } from '../lib/types';

/** Kimin hangi görevde olduğunu herkese şeffaf biçimde gösterir (Bildirge §5.7). */
export function OrgChartPage() {
  const { units, roles, loading } = useOrg();
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const asg = useCollection<Assignment>('assignments', [where('status', '==', 'active')], 'active-asg');

  const roleOrder = useMemo(() => new Map(roles.map((r) => [r.id, r.order])), [roles]);

  const byUnit = useMemo(() => {
    const m = new Map<string, WithId<Assignment>[]>();
    for (const a of asg.data) {
      if (!m.has(a.unitId)) m.set(a.unitId, []);
      m.get(a.unitId)!.push(a);
    }
    for (const list of m.values()) list.sort((a, b) => (roleOrder.get(a.roleId) ?? 99) - (roleOrder.get(b.roleId) ?? 99));
    return m;
  }, [asg.data, roleOrder]);

  const s = q.toLocaleLowerCase('tr');
  const match = (a: Assignment) => !s || `${a.memberName} ${a.roleName}`.toLocaleLowerCase('tr').includes(s);

  const blocks = [
    { id: BRANCH, name: 'Kol Geneli Görevler', shortCode: 'KOL', type: 'board' as const, active: true },
    ...units.filter((u) => u.active),
  ].filter((u) => type === 'all' || u.type === type || (type === 'board' && u.id === BRANCH));

  if (loading || asg.loading) return <SectionLoader />;

  return (
    <Stack>
      <PageHeader title="Organizasyon" description="Bu dönemdeki görevliler. Görev atamaları Yönetim menüsünden düzenlenir." />
      <Group wrap="wrap">
        <TextInput
          placeholder="Kişi veya görev ara…"
          leftSection={<IconSearch size={16} />}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          style={{ flex: '1 1 240px' }}
        />
        <SegmentedControl
          value={type}
          onChange={setType}
          data={[
            { value: 'all', label: 'Tümü' },
            { value: 'board', label: 'Yönetim' },
            { value: 'committee', label: 'Komiteler' },
            { value: 'directorate', label: 'Başkanlıklar' },
          ]}
        />
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {blocks.map((u) => {
          const people = (byUnit.get(u.id) ?? []).filter(match);
          if (s && people.length === 0) return null;
          return (
            <Card key={u.id}>
              <Group justify="space-between" mb="sm" wrap="nowrap">
                <div style={{ minWidth: 0 }}>
                  <Title order={5} lineClamp={1}>
                    {u.name}
                  </Title>
                  <Text size="xs" c="dimmed">
                    {u.id === BRANCH ? 'Öğrenci Kolu geneli' : UNIT_TYPE_LABEL[u.type]}
                  </Text>
                </div>
                <Badge variant="outline">{u.shortCode}</Badge>
              </Group>
              {people.length === 0 ? (
                <Text size="sm" c="dimmed">
                  Atanmış görevli yok.
                </Text>
              ) : (
                <Stack gap={8}>
                  {people.map((a) => (
                    <Group key={a.id} gap="sm" wrap="nowrap">
                      <Avatar name={a.memberName} color="initials" radius="xl" size={32} />
                      <div style={{ minWidth: 0 }}>
                        <Text size="sm" fw={500} truncate>
                          {a.memberName}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {a.roleName}
                        </Text>
                      </div>
                    </Group>
                  ))}
                </Stack>
              )}
            </Card>
          );
        })}
      </SimpleGrid>
      {blocks.length === 0 && <EmptyState title="Birim yok" />}
    </Stack>
  );
}
