import { ActionIcon, Badge, Button, Group, Menu, Select, Stack, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { IconDots, IconPlus, IconRefresh, IconSearch, IconUserOff } from '@tabler/icons-react';
import { orderBy } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { AssignmentModal } from '../../components/AssignmentModal';
import { EmptyState, ErrorAlert, PageHeader, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { rebuildAccessMany } from '../../lib/access';
import { endAssignments } from '../../lib/assignments';
import { fmtDate } from '../../lib/format';
import { useCollection } from '../../lib/hooks';
import { useOrg } from '../../lib/org';
import type { Assignment } from '../../lib/types';

export function AssignmentsPage() {
  const { orgSettings } = useAuth();
  const { terms, roles, unitOptions, unitName } = useOrg();
  const [opened, { open, close }] = useDisclosure(false);
  const [q, setQ] = useState('');
  const [term, setTerm] = useState<string | null>(orgSettings.activeTermId);
  const [unit, setUnit] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>('active');
  const [busy, setBusy] = useState(false);

  const all = useCollection<Assignment>('assignments', [orderBy('createdAt', 'desc')], 'all-asg');

  const rows = useMemo(() => {
    const s = q.toLocaleLowerCase('tr');
    return all.data.filter(
      (a) =>
        (!term || a.termId === term) &&
        (!unit || a.unitId === unit) &&
        (!role || a.roleId === role) &&
        (!status || a.status === status) &&
        (!s || `${a.memberName} ${a.roleName} ${a.unitName}`.toLocaleLowerCase('tr').includes(s)),
    );
  }, [all.data, q, term, unit, role, status]);

  const end = (a: Assignment & { id: string }) =>
    modals.openConfirmModal({
      title: 'Görev sonlandırılsın mı?',
      children: (
        <Text size="sm">
          <b>{a.memberName}</b> kişisinin <b>{a.roleName}</b> ({unitName(a.unitId)}) görevi bugün itibarıyla sona erer ve
          ilgili yetkileri hemen kalkar. Geçmiş onayları geçerli kalır.
        </Text>
      ),
      labels: { confirm: 'Sonlandır', cancel: 'Vazgeç' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await endAssignments([a]);
          notifySuccess('Görev sonlandırıldı.');
        } catch (e) {
          notifyError(e);
        }
      },
    });

  const rebuildAll = async () => {
    setBusy(true);
    try {
      const uids = new Set(all.data.map((a) => a.uid));
      const res = await rebuildAccessMany(uids);
      notifySuccess(`${res.ok} kişinin erişimi yeniden hesaplandı${res.failed.length ? `, ${res.failed.length} başarısız` : ''}.`);
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack>
      <PageHeader
        title="Görev atamaları"
        description="Kimin hangi birimde hangi rolde olduğu. Yetkiler ve onay hakları buradan gelir; değişiklikler anında geçerli olur."
        actions={
          <>
            <Tooltip label="Rol yetkileri değiştiyse veya süresi dolan görevler varsa tüm erişim özetlerini yeniler">
              <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={rebuildAll} loading={busy}>
                Erişimleri yenile
              </Button>
            </Tooltip>
            <Button leftSection={<IconPlus size={18} />} onClick={open}>
              Görev ata
            </Button>
          </>
        }
      />
      <Group wrap="wrap">
        <TextInput placeholder="Ara…" leftSection={<IconSearch size={16} />} value={q} onChange={(e) => setQ(e.currentTarget.value)} style={{ flex: '1 1 200px' }} />
        <Select placeholder="Dönem" data={terms.map((t) => ({ value: t.id, label: t.name }))} value={term} onChange={setTerm} clearable allowDeselect w={180} />
        <Select placeholder="Birim" data={unitOptions({ includeBranch: true, onlyActive: false })} value={unit} onChange={setUnit} clearable allowDeselect searchable w={220} />
        <Select placeholder="Rol" data={roles.map((r) => ({ value: r.id, label: `${r.name}${r.scope === 'unit' ? ' (birim)' : ''}` }))} value={role} onChange={setRole} clearable allowDeselect searchable w={200} />
        <Select
          placeholder="Durum"
          data={[
            { value: 'active', label: 'Aktif' },
            { value: 'ended', label: 'Sona erdi' },
          ]}
          value={status}
          onChange={setStatus}
          clearable
          allowDeselect
          w={140}
        />
      </Group>
      <ErrorAlert error={all.error} />
      {all.loading ? (
        <SectionLoader />
      ) : rows.length === 0 ? (
        <EmptyState title="Atama bulunamadı" action={<Button variant="light" size="xs" onClick={open}>Görev ata</Button>} />
      ) : (
        <Table.ScrollContainer minWidth={820}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Kişi</Table.Th>
                <Table.Th>Rol</Table.Th>
                <Table.Th>Birim</Table.Th>
                <Table.Th>Süre</Table.Th>
                <Table.Th>Kaynak</Table.Th>
                <Table.Th>Durum</Table.Th>
                <Table.Th w={48} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((a) => {
                const expired = a.status === 'active' && a.endsAt && a.endsAt.toMillis() < Date.now();
                return (
                  <Table.Tr key={a.id}>
                    <Table.Td fw={500}>{a.memberName}</Table.Td>
                    <Table.Td>{a.roleName}</Table.Td>
                    <Table.Td>{unitName(a.unitId)}</Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {fmtDate(a.startsAt)} – {a.endsAt ? fmtDate(a.endsAt) : 'süresiz'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="outline" color={a.source === 'election' ? 'grape' : 'gray'}>
                        {a.source === 'election' ? 'Seçim' : 'Atama'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {a.status === 'ended' ? (
                        <Badge color="gray">Sona erdi</Badge>
                      ) : expired ? (
                        <Badge color="orange">Süresi doldu</Badge>
                      ) : (
                        <Badge color="green">Aktif</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {a.status === 'active' && (
                        <Menu position="bottom-end">
                          <Menu.Target>
                            <ActionIcon variant="subtle" aria-label="İşlemler">
                              <IconDots size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item color="red" leftSection={<IconUserOff size={16} />} onClick={() => end(a)}>
                              Görevi sonlandır
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      <AssignmentModal opened={opened} onClose={close} />
    </Stack>
  );
}
