import { Alert, Badge, Button, Card, Group, Select, SimpleGrid, Stack, Table, Tabs, Text, Textarea, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconCheck, IconHeartHandshake, IconX } from '@tabler/icons-react';
import { deleteDoc, doc, orderBy, where } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, PageHeader, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { db } from '../../firebase';
import { hasPermission, unitsWithPermission } from '../../lib/access';
import { fmtDate, fmtRelative } from '../../lib/format';
import { useCollection } from '../../lib/hooks';
import { applyAsVolunteer, decideVolunteer, endVolunteer } from '../../lib/ops';
import type { VolunteerApplication } from '../../lib/opsTypes';
import { useOrg } from '../../lib/org';
import type { Assignment, WithId } from '../../lib/types';

const APP_STATUS = {
  pending: { label: 'Değerlendiriliyor', color: 'yellow' },
  accepted: { label: 'Kabul edildi', color: 'green' },
  rejected: { label: 'Olumsuz', color: 'red' },
} as const;

export function VolunteerPage() {
  const { user, access, orgSettings } = useAuth();
  const { units } = useOrg();
  const managed = useMemo(() => {
    const ids = hasPermission(access, 'assignments.manage') ? units.map((u) => u.id) : unitsWithPermission(access, 'unit.manage');
    return units.filter((u) => ids.includes(u.id));
  }, [access, units]);
  const [tab, setTab] = useState<string | null>(managed.length ? 'yonet' : 'basvur');

  return (
    <Stack>
      <PageHeader
        title="Gönüllülük"
        description="Bir komite veya birimde gönüllü olmak için başvurun. Birim yöneticisi kabul ettiğinde gönüllü rolünüz ve oryantasyon görevleriniz otomatik oluşur."
      />
      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="basvur">Başvur / başvurularım</Tabs.Tab>
          {managed.length > 0 && <Tabs.Tab value="yonet">Birimime gelen başvurular</Tabs.Tab>}
        </Tabs.List>
        <Tabs.Panel value="basvur">
          <Apply uid={user!.uid} />
        </Tabs.Panel>
        <Tabs.Panel value="yonet">
          <Manage unitIds={managed.map((u) => u.id)} volunteerRoleId={orgSettings.volunteerRoleId} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function Apply({ uid }: { uid: string }) {
  const { unitOptions } = useOrg();
  const mine = useCollection<VolunteerApplication>('volunteerApplications', [where('uid', '==', uid)], `va-${uid}`);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [motivation, setMotivation] = useState('');
  const [availability, setAvailability] = useState('');
  const [busy, setBusy] = useState(false);
  const pendingFor = new Set(mine.data.filter((a) => a.status === 'pending').map((a) => a.unitId));
  const opts = unitOptions().filter((o) => !pendingFor.has(o.value));

  const submit = async () => {
    if (!unitId || motivation.trim().length < 20) {
      return notifyError(new Error('Birim seçin ve en az birkaç cümleyle motivasyonunuzu yazın.'), 'Eksik bilgi');
    }
    setBusy(true);
    try {
      await applyAsVolunteer({ unitId, unitName: opts.find((o) => o.value === unitId)?.label.replace(/^[— ]+/, '') ?? unitId, motivation, availability });
      notifySuccess('Başvurunuz birim yöneticisine iletildi.', 'Başvuru alındı');
      setUnitId(null);
      setMotivation('');
      setAvailability('');
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
      <Card>
        <Stack>
          <Group gap="xs">
            <IconHeartHandshake size={20} />
            <Text fw={600}>Gönüllü başvurusu</Text>
          </Group>
          <Select label="Birim" data={opts} value={unitId} onChange={setUnitId} searchable required placeholder="Komite veya birim seçin" />
          <Textarea
            label="Neden bu birimde gönüllü olmak istiyorsunuz?"
            autosize
            minRows={4}
            value={motivation}
            onChange={(e) => setMotivation(e.currentTarget.value)}
            required
          />
          <TextInput label="Haftalık ayırabileceğiniz zaman" placeholder="örn. haftada 3-4 saat, hafta sonları" value={availability} onChange={(e) => setAvailability(e.currentTarget.value)} />
          <Button onClick={submit} loading={busy}>
            Başvur
          </Button>
        </Stack>
      </Card>
      <Card>
        <Text fw={600} mb="sm">
          Başvurularım
        </Text>
        {mine.loading ? (
          <SectionLoader />
        ) : mine.data.length === 0 ? (
          <Text size="sm" c="dimmed">
            Henüz başvurunuz yok.
          </Text>
        ) : (
          <Stack gap="sm">
            {mine.data.map((a) => (
              <Group key={a.id} justify="space-between" wrap="nowrap">
                <div>
                  <Text size="sm" fw={500}>
                    {a.unitName}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {fmtRelative(a.createdAt)}
                    {a.decisionNote ? ` · “${a.decisionNote}”` : ''}
                  </Text>
                </div>
                <Group gap={4} wrap="nowrap">
                  <Badge color={APP_STATUS[a.status].color}>{APP_STATUS[a.status].label}</Badge>
                  {a.status === 'pending' && (
                    <Button size="compact-xs" variant="subtle" color="red" onClick={() => void deleteDoc(doc(db, 'volunteerApplications', a.id))}>
                      Geri çek
                    </Button>
                  )}
                </Group>
              </Group>
            ))}
          </Stack>
        )}
      </Card>
    </SimpleGrid>
  );
}

function Manage({ unitIds, volunteerRoleId }: { unitIds: string[]; volunteerRoleId: string }) {
  const { units, unitName } = useOrg();
  const [unitId, setUnitId] = useState<string>(unitIds[0]);
  const apps = useCollection<VolunteerApplication>(
    'volunteerApplications',
    [where('unitId', '==', unitId), orderBy('createdAt', 'desc')],
    `vam-${unitId}`,
  );
  const vols = useCollection<Assignment>(
    'assignments',
    [where('unitId', '==', unitId), where('roleId', '==', volunteerRoleId), where('status', '==', 'active')],
    `vols-${unitId}-${volunteerRoleId}`,
  );
  const short = units.find((u) => u.id === unitId)?.shortCode ?? 'GRV';

  const decide = (a: WithId<VolunteerApplication>, accept: boolean) => {
    let note = '';
    modals.openConfirmModal({
      title: accept ? `${a.name} kabul edilsin mi?` : `${a.name} başvurusu reddedilsin mi?`,
      children: (
        <Stack gap="xs">
          {accept && (
            <Alert color="blue" variant="light">
              Kişiye bu dönem için gönüllü rolü atanır, birim panosunu görmeye başlar ve oryantasyon görevleri açılır.
            </Alert>
          )}
          <Textarea label="Not (başvurana görünür)" onChange={(e) => (note = e.currentTarget.value)} />
        </Stack>
      ),
      labels: { confirm: accept ? 'Kabul et' : 'Reddet', cancel: 'Vazgeç' },
      confirmProps: { color: accept ? 'green' : 'red' },
      onConfirm: async () => {
        try {
          const r = await decideVolunteer(a, accept, note, short);
          notifySuccess(accept ? `${r.orientationTasks} oryantasyon görevi açıldı.` : 'Başvuru reddedildi.', accept ? 'Gönüllü kabul edildi' : undefined);
        } catch (e) {
          notifyError(e);
        }
      },
    });
  };

  const pending = apps.data.filter((a) => a.status === 'pending');

  return (
    <Stack>
      <Select
        data={unitIds.map((id) => ({ value: id, label: unitName(id) }))}
        value={unitId}
        onChange={(v) => v && setUnitId(v)}
        w={300}
        allowDeselect={false}
      />
      <Card>
        <Text fw={600} mb="sm">
          Bekleyen başvurular ({pending.length})
        </Text>
        {apps.loading ? (
          <SectionLoader />
        ) : pending.length === 0 ? (
          <EmptyState title="Bekleyen başvuru yok" />
        ) : (
          <Stack>
            {pending.map((a) => (
              <Card key={a.id} padding="sm">
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <div style={{ flex: '1 1 300px' }}>
                    <Text fw={600}>{a.name}</Text>
                    <Text size="xs" c="dimmed">
                      {a.email} · {fmtRelative(a.createdAt)}
                      {a.availability ? ` · ${a.availability}` : ''}
                    </Text>
                    <Text size="sm" mt={6} style={{ whiteSpace: 'pre-wrap' }}>
                      {a.motivation}
                    </Text>
                  </div>
                  <Group gap="xs">
                    <Button size="xs" color="green" leftSection={<IconCheck size={14} />} onClick={() => decide(a, true)}>
                      Kabul et
                    </Button>
                    <Button size="xs" variant="light" color="red" leftSection={<IconX size={14} />} onClick={() => decide(a, false)}>
                      Reddet
                    </Button>
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Card>
      <Card>
        <Text fw={600} mb="sm">
          Birimin gönüllüleri ({vols.data.length})
        </Text>
        {vols.data.length === 0 ? (
          <Text size="sm" c="dimmed">
            Aktif gönüllü yok.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={480}>
            <Table>
              <Table.Tbody>
                {vols.data.map((v) => (
                  <Table.Tr key={v.id}>
                    <Table.Td>{v.memberName}</Table.Td>
                    <Table.Td>{fmtDate(v.startsAt)} – {v.endsAt ? fmtDate(v.endsAt) : 'süresiz'}</Table.Td>
                    <Table.Td ta="right">
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        color="red"
                        onClick={() =>
                          modals.openConfirmModal({
                            title: 'Gönüllülük sonlandırılsın mı?',
                            children: <Text size="sm">{v.memberName} birim panosuna erişimini kaybeder.</Text>,
                            labels: { confirm: 'Sonlandır', cancel: 'Vazgeç' },
                            confirmProps: { color: 'red' },
                            onConfirm: () =>
                              endVolunteer(v.id, v.uid, v.unitId, v.roleId)
                                .then(() => notifySuccess('Gönüllülük sonlandırıldı.'))
                                .catch(notifyError),
                          })
                        }
                      >
                        Sonlandır
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>
    </Stack>
  );
}
