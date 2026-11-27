import { Badge, Button, Card, Group, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { IconArrowRight, IconCalendarStar, IconUsersGroup, IconDoor, IconHeartHandshake, IconCoin, IconFileText, IconListCheck, IconReport, IconSpeakerphone } from '@tabler/icons-react';
import { where } from 'firebase/firestore';
import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { UnitOverview } from '../components/UnitOverview';
import { PageHeader, SectionLoader } from '../components/ui';
import { useOrg } from '../lib/org';
import { hasPermission, hasUnitPermission } from '../lib/access';
import { useCollection } from '../lib/hooks';
import { useUnitScope } from '../lib/unitScope';
import type { Assignment } from '../lib/types';

const modules = (unitId: string) => [
  { label: 'Etkinlikler', description: 'Öneri, katılımcılar, puan ve QR işlemleri', to: `/etkinlikler?birim=${unitId}`, icon: IconCalendarStar },
  { label: 'Toplantılar', description: 'Gündem, yoklama ve tutanaklar', to: `/toplantilar?birim=${unitId}`, icon: IconUsersGroup },
  { label: 'Oda rezervasyonu', description: 'Oda takvimi ve boş saatler', to: '/oda-rezervasyonu', icon: IconDoor },
  { label: 'Görevler ve projeler', description: 'Birim panosu, sorumlular ve son tarihler', to: `/gorevler?sekme=pano&birim=${unitId}`, icon: IconListCheck },
  { label: 'Dilekçeler', description: 'Birime bağlı evrak ve yeni dilekçe', to: `/dilekceler?sekme=visible&birim=${unitId}`, icon: IconFileText },
  { label: 'İletişim talepleri', description: 'Afiş, duyuru ve yayın istekleri', to: `/iletisim?birim=${unitId}`, icon: IconSpeakerphone },
  { label: 'Bütçe', description: 'Planlanan ve gerçekleşen bütçe özeti', to: `/butceler?birim=${unitId}`, icon: IconCoin },
  { label: 'Rapor ve devir', description: 'Dönem özeti ve kurumsal hafıza', to: `/devir?birim=${unitId}`, icon: IconReport },
];

export function UnitWorkspacePage() {
  const { unitId = '' } = useParams();
  const { access } = useAuth();
  const { loading: orgLoading } = useOrg();
  const { accessibleUnits, setSelectedUnitId } = useUnitScope();
  const unit = accessibleUnits.find((item) => item.id === unitId);
  const assignments = useCollection<Assignment>(unit ? 'assignments' : null, [where('unitId', '==', unitId)], `unit-team-${unitId}`);

  useEffect(() => {
    if (unit) setSelectedUnitId(unit.id);
  }, [unit, setSelectedUnitId]);

  if (orgLoading) return <SectionLoader />;
  if (!unit) return <Navigate to="/" replace />;
  const team = assignments.data.filter((assignment) => assignment.status === 'active');
  const canRecruit = hasUnitPermission(access, unit.id, 'unit.manage') || hasPermission(access, 'assignments.manage');
  const visibleModules = [...modules(unit.id), ...(canRecruit ? [{ label: 'Başvuru yönetimi', description: 'Komitenin ilanları ve adayları', to: `/basvuru-yonetimi?birim=${unit.id}`, icon: IconHeartHandshake }] : [])].filter((module) => module.to.startsWith('/butceler')
    ? hasPermission(access, 'finance.read') || hasPermission(access, 'finance.manage') || hasUnitPermission(access, unit.id, 'unit.manage')
    : true);

  return (
    <Stack gap="xl">
      <PageHeader
        title={unit.name}
        description={`${unit.shortCode} · ${unit.description || 'Komite çalışma alanı'}`}
        actions={<Button component={Link} to={`/etkinlikler?birim=${unit.id}`}>Etkinlikleri aç</Button>}
      />
      <UnitOverview unitId={unit.id} />

      <div>
        <Text fw={700} mb="sm">Çalışma alanları</Text>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {visibleModules.map((module) => (
            <Card key={module.to} component={Link} to={module.to} style={{ textDecoration: 'none' }}>
              <Group justify="space-between" wrap="nowrap">
                <Group wrap="nowrap">
                  <module.icon size={21} />
                  <div><Text fw={600}>{module.label}</Text><Text size="sm" c="dimmed">{module.description}</Text></div>
                </Group>
                <IconArrowRight size={17} opacity={0.5} />
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      </div>

      <Card>
        <Group justify="space-between" mb="sm"><Text fw={700}>Aktif ekip</Text><Badge variant="light">{team.length} kişi/görev</Badge></Group>
        {team.length ? (
          <Table.ScrollContainer minWidth={560}>
            <Table verticalSpacing="sm">
              <Table.Thead><Table.Tr><Table.Th>Kişi</Table.Th><Table.Th>Rol</Table.Th><Table.Th>Dönem</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>{team.map((assignment) => <Table.Tr key={assignment.id}><Table.Td>{assignment.memberName}</Table.Td><Table.Td>{assignment.roleName}</Table.Td><Table.Td>{assignment.termId ?? '—'}</Table.Td></Table.Tr>)}</Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        ) : <Text size="sm" c="dimmed">Bu birimde aktif görev ataması yok.</Text>}
      </Card>
    </Stack>
  );
}
