import { ActionIcon, Avatar, Badge, Button, Group, Menu, SegmentedControl, Stack, Table, Text, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconCheck, IconDots, IconPlayerPause, IconPlayerPlay, IconSearch, IconUserShield, IconX } from '@tabler/icons-react';
import { deleteDoc, doc, orderBy, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { AssignmentModal } from '../../components/AssignmentModal';
import { EmptyState, ErrorAlert, PageHeader, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { db } from '../../firebase';
import { logAudit } from '../../lib/audit';
import { fmtDate } from '../../lib/format';
import { useCollection } from '../../lib/hooks';
import type { Assignment, Member, MemberStatus } from '../../lib/types';
import { useAuth } from '../../auth/AuthContext';

const STATUS: Record<MemberStatus, { label: string; color: string }> = {
  pending: { label: 'Onay bekliyor', color: 'yellow' },
  active: { label: 'Aktif', color: 'green' },
  suspended: { label: 'Askıda', color: 'red' },
};

export function MembersPage() {
  const { user, orgSettings } = useAuth();
  const [filter, setFilter] = useState<string>('pending');
  const [q, setQ] = useState('');
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const members = useCollection<Member>('members', [orderBy('createdAt', 'desc')], 'members');
  const asg = useCollection<Assignment>('assignments', [where('status', '==', 'active')], 'active-asg');

  const rolesOf = useMemo(() => {
    const m = new Map<string, Assignment[]>();
    asg.data.forEach((a) => m.set(a.uid, [...(m.get(a.uid) ?? []), a]));
    return m;
  }, [asg.data]);

  const counts = useMemo(() => {
    const c = { pending: 0, active: 0, suspended: 0 };
    members.data.forEach((m) => c[m.status]++);
    return c;
  }, [members.data]);

  const rows = members.data.filter((m) => {
    const s = q.toLocaleLowerCase('tr');
    return (filter === 'all' || m.status === filter) && (!s || `${m.displayName} ${m.email}`.toLocaleLowerCase('tr').includes(s));
  });

  const domainOk = (email: string) =>
    !orgSettings.allowedEmailDomains.length || orgSettings.allowedEmailDomains.some((d) => email.toLowerCase().endsWith(`@${d.toLowerCase()}`));

  const setStatus = async (m: Member, status: MemberStatus) => {
    try {
      await updateDoc(doc(db, 'members', m.uid), { status, updatedAt: serverTimestamp() });
      await logAudit(`member.${status}`, `members/${m.uid}`, { name: m.displayName, email: m.email });
      notifySuccess(`${m.displayName}: ${STATUS[status].label}`);
    } catch (e) {
      notifyError(e);
    }
  };

  const reject = (m: Member) =>
    modals.openConfirmModal({
      title: 'Başvuru silinsin mi?',
      children: <Text size="sm">{m.displayName} ({m.email}) kaydı silinir. Kişi tekrar giriş yaparsa yeni başvuru oluşur.</Text>,
      labels: { confirm: 'Sil', cancel: 'Vazgeç' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'members', m.uid));
          await logAudit('member.delete', `members/${m.uid}`, { name: m.displayName, email: m.email });
        } catch (e) {
          notifyError(e);
        }
      },
    });

  return (
    <Stack>
      <PageHeader title="Üyeler" description="Hub’a giriş yapan kişiler önce onay bekler. Onaylanan üyeler dilekçe oluşturabilir ve görev alabilir." />
      <Group wrap="wrap">
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          data={[
            { value: 'pending', label: `Onay bekleyen (${counts.pending})` },
            { value: 'active', label: `Aktif (${counts.active})` },
            { value: 'suspended', label: `Askıda (${counts.suspended})` },
            { value: 'all', label: 'Tümü' },
          ]}
        />
        <TextInput placeholder="Ad veya e-posta…" leftSection={<IconSearch size={16} />} value={q} onChange={(e) => setQ(e.currentTarget.value)} style={{ flex: '1 1 220px' }} />
      </Group>
      <ErrorAlert error={members.error} />
      {members.loading ? (
        <SectionLoader />
      ) : rows.length === 0 ? (
        <EmptyState title={filter === 'pending' ? 'Onay bekleyen başvuru yok' : 'Üye bulunamadı'} />
      ) : (
        <Table.ScrollContainer minWidth={760}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Kişi</Table.Th>
                <Table.Th>Görevleri</Table.Th>
                <Table.Th>Kayıt</Table.Th>
                <Table.Th>Durum</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((m) => (
                <Table.Tr key={m.uid}>
                  <Table.Td>
                    <Group gap="sm" wrap="nowrap">
                      <Avatar src={m.photoURL ?? undefined} name={m.displayName} color="initials" radius="xl" />
                      <div>
                        <Text size="sm" fw={500}>
                          {m.displayName}
                        </Text>
                        <Text size="xs" c={domainOk(m.email) ? 'dimmed' : 'orange'}>
                          {m.email}
                          {!domainOk(m.email) && ' · izin verilen alan adı dışında'}
                        </Text>
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {(rolesOf.get(m.uid) ?? []).map((a) => (
                        <Badge key={a.roleId + a.unitId} size="sm" variant="outline">
                          {a.roleName}
                          {a.unitId !== 'branch' ? ` · ${a.unitName}` : ''}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{fmtDate(m.createdAt)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={STATUS[m.status].color}>{STATUS[m.status].label}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      {m.status === 'pending' && (
                        <>
                          <Button size="xs" color="green" leftSection={<IconCheck size={14} />} onClick={() => void setStatus(m, 'active')}>
                            Onayla
                          </Button>
                          <Button size="xs" variant="subtle" color="red" leftSection={<IconX size={14} />} onClick={() => reject(m)}>
                            Reddet
                          </Button>
                        </>
                      )}
                      {m.status !== 'pending' && m.uid !== user?.uid && (
                        <Menu position="bottom-end">
                          <Menu.Target>
                            <ActionIcon variant="subtle" aria-label="İşlemler">
                              <IconDots size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            {m.status === 'active' && (
                              <Menu.Item leftSection={<IconUserShield size={16} />} onClick={() => setAssignFor(m.uid)}>
                                Görev ata
                              </Menu.Item>
                            )}
                            {m.status === 'active' ? (
                              <Menu.Item color="red" leftSection={<IconPlayerPause size={16} />} onClick={() => void setStatus(m, 'suspended')}>
                                Üyeliği askıya al
                              </Menu.Item>
                            ) : (
                              <Menu.Item leftSection={<IconPlayerPlay size={16} />} onClick={() => void setStatus(m, 'active')}>
                                Yeniden etkinleştir
                              </Menu.Item>
                            )}
                          </Menu.Dropdown>
                        </Menu>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      <AssignmentModal opened={!!assignFor} onClose={() => setAssignFor(null)} presetUid={assignFor ?? undefined} />
    </Stack>
  );
}
