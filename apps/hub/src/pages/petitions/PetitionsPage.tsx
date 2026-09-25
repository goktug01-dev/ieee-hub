import { Button, Group, Select, Stack, Table, Tabs, Text, TextInput, Anchor } from '@mantine/core';
import { IconFilePlus, IconSearch } from '@tabler/icons-react';
import { limit, orderBy, where } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, ErrorAlert, PageHeader, SectionLoader, StatusBadge } from '../../components/ui';
import { STATUS_META, fmtDateTime } from '../../lib/format';
import { useCollection } from '../../lib/hooks';
import { useOrg } from '../../lib/org';
import type { Petition, PetitionStatus, WithId } from '../../lib/types';

function PetitionTable({ rows, loading, error, initialUnit }: { rows: WithId<Petition>[]; loading: boolean; error: Error | null; initialUnit?: string | null }) {
  const { unitOptions } = useOrg();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [unit, setUnit] = useState<string | null>(initialUnit ?? null);

  const filtered = useMemo(() => {
    const s = q.toLocaleLowerCase('tr');
    return rows.filter(
      (p) =>
        (!status || p.status === status) &&
        (!unit || p.unitId === unit) &&
        (!s || `${p.title} ${p.documentNo ?? ''} ${p.templateName} ${p.ownerName}`.toLocaleLowerCase('tr').includes(s)),
    );
  }, [rows, q, status, unit]);

  return (
    <Stack>
      <Group wrap="wrap">
        <TextInput
          placeholder="Başlık, evrak no, kişi…"
          leftSection={<IconSearch size={16} />}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          style={{ flex: '1 1 240px' }}
        />
        <Select
          placeholder="Durum"
          clearable
          allowDeselect
          data={Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }))}
          value={status}
          onChange={setStatus}
          w={200}
        />
        <Select
          placeholder="Birim"
          clearable
          allowDeselect
          searchable
          data={unitOptions({ includeBranch: true, onlyActive: false })}
          value={unit}
          onChange={setUnit}
          w={240}
        />
      </Group>
      <ErrorAlert error={error} />
      {loading ? (
        <SectionLoader />
      ) : filtered.length === 0 ? (
        <EmptyState title="Dilekçe bulunamadı" />
      ) : (
        <Table.ScrollContainer minWidth={760}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Evrak no</Table.Th>
                <Table.Th>Başlık</Table.Th>
                <Table.Th>Birim</Table.Th>
                <Table.Th>Sahibi</Table.Th>
                <Table.Th>Durum</Table.Th>
                <Table.Th>Güncelleme</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {p.documentNo ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Anchor component={Link} to={`/dilekceler/${p.id}`} fw={500} size="sm">
                      {p.title || p.templateName}
                    </Anchor>
                    <Text size="xs" c="dimmed">
                      {p.templateName}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{p.unitId === 'branch' ? 'Kol Geneli' : p.unitName}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{p.ownerName}</Text>
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge status={p.status as PetitionStatus} />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{fmtDateTime(p.updatedAt)}</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  );
}

export function PetitionsPage() {
  const { user, access, can } = useAuth();
  const [params] = useSearchParams();
  const initialUnit = params.get('birim');
  const [tab, setTab] = useState<string | null>(params.get('sekme') ?? 'mine');
  const tokens = (access?.tokens ?? []).filter((t) => !t.startsWith('uid:')).slice(0, 30);

  const mine = useCollection<Petition>('petitions', [where('ownerUid', '==', user!.uid), orderBy('updatedAt', 'desc')], `mine-${user!.uid}`);
  const visible = useCollection<Petition>(
    tab === 'visible' && tokens.length ? 'petitions' : null,
    [where('visibleTo', 'array-contains-any', tokens), orderBy('updatedAt', 'desc'), limit(200)],
    tokens.join('|'),
  );
  const all = useCollection<Petition>(
    tab === 'all' && can('petitions.readAll') ? 'petitions' : null,
    [orderBy('updatedAt', 'desc'), limit(300)],
    'all',
  );

  return (
    <Stack>
      <PageHeader
        title="Dilekçeler"
        description="Kendi dilekçeleriniz, görev alanınızdaki dilekçeler ve (yetkiniz varsa) tüm evrak arşivi."
        actions={
          <Button component={Link} to="/dilekceler/yeni" leftSection={<IconFilePlus size={18} />}>
            Yeni dilekçe
          </Button>
        }
      />
      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="mine">Dilekçelerim ({mine.data.length})</Tabs.Tab>
          {tokens.length > 0 && <Tabs.Tab value="visible">Görev alanımdakiler</Tabs.Tab>}
          {can('petitions.readAll') && <Tabs.Tab value="all">Tüm evrak (arşiv)</Tabs.Tab>}
        </Tabs.List>
        <Tabs.Panel value="mine">
          <PetitionTable rows={mine.data} loading={mine.loading} error={mine.error} initialUnit={initialUnit} />
        </Tabs.Panel>
        <Tabs.Panel value="visible">
          <PetitionTable rows={visible.data.filter((p) => p.status !== 'draft')} loading={visible.loading} error={visible.error} initialUnit={initialUnit} />
        </Tabs.Panel>
        <Tabs.Panel value="all">
          <PetitionTable rows={all.data.filter((p) => p.status !== 'draft')} loading={all.loading} error={all.error} initialUnit={initialUnit} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
