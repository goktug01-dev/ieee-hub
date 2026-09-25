import {
  ActionIcon,
  AppShell,
  Avatar,
  Badge,
  Burger,
  Group,
  Image,
  Menu,
  NavLink,
  ScrollArea,
  Select,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBuildingCommunity,
  IconCalendarEvent,
  IconChecklist,
  IconFilePlus,
  IconFileText,
  IconHistory,
  IconHome,
  IconLogout,
  IconMoon,
  IconSettings,
  IconShieldLock,
  IconSitemap,
  IconSun,
  IconTemplate,
  IconUserCircle,
  IconUsers,
  IconUserShield,
  IconBallpen,
  IconListCheck,
  IconCalendarStar,
  IconSpeakerphone,
  IconBuildingStore,
  IconCoin,
  IconChartBar,
  IconHeartHandshake,
  IconArrowsExchange,
  IconServer,
  IconLifebuoy,
  IconNotebook,
} from '@tabler/icons-react';
import { Suspense, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { unitsWithPermission } from '../lib/access';
import { useInbox } from '../lib/inbox';
import { SectionLoader } from './ui';
import type { PermissionId } from '../lib/permissions';
import { useUnitScope } from '../lib/unitScope';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  perm?: PermissionId;
  badge?: number;
  exact?: boolean;
}

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  const { member, publicSettings, can, signOut, isSuperAdmin, access } = useAuth();
  const { waiting } = useInbox();
  const location = useLocation();
  const navigate = useNavigate();
  const { accessibleUnits, selectedUnitId, selectedUnit, setSelectedUnitId } = useUnitScope();
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');

  const unitManager = unitsWithPermission(access, 'unit.manage').length > 0;
  const sections: { label: string | null; items: NavItem[] }[] = [
    {
      label: null,
      items: [
        { to: '/', label: 'Ana sayfa', icon: <IconHome size={18} />, exact: true },
        { to: '/onaylar', label: 'Onayımı bekleyenler', icon: <IconChecklist size={18} />, badge: waiting.length },
        { to: '/gorevler', label: 'Görevler ve projeler', icon: <IconListCheck size={18} /> },
      ],
    },
    {
      label: selectedUnit ? selectedUnit.name : 'Komitem',
      items: selectedUnit
        ? [{ to: `/birimler/${selectedUnit.id}`, label: 'Komite çalışma alanı', icon: <IconBuildingCommunity size={18} /> }]
        : [],
    },
    {
      label: 'Dilekçe',
      items: [
        { to: '/dilekceler/yeni', label: 'Yeni dilekçe', icon: <IconFilePlus size={18} />, exact: true },
        { to: '/dilekceler', label: 'Dilekçeler', icon: <IconFileText size={18} /> },
      ],
    },
    {
      label: 'Operasyon',
      items: [
        { to: '/etkinlikler', label: 'Etkinlikler', icon: <IconCalendarStar size={18} /> },
        { to: '/iletisim', label: 'İletişim', icon: <IconSpeakerphone size={18} /> },
        { to: '/sponsorluk', label: 'Sponsorluk', icon: <IconBuildingStore size={18} /> },
        ...(can('finance.read') || can('finance.manage') || unitManager ? [{ to: '/butceler', label: 'Bütçeler', icon: <IconCoin size={18} /> }] : []),
        ...(can('reports.read') || can('reports.approve') ? [{ to: '/raporlar', label: 'Raporlar', icon: <IconChartBar size={18} /> }] : []),
        ...(can('secretary.ledger.manage') ? [{ to: '/sekreterlik-defteri', label: 'Sekreterlik defteri', icon: <IconNotebook size={18} /> }] : []),
      ],
    },
    {
      label: 'Organizasyon',
      items: [
        { to: '/organizasyon', label: 'Organizasyon şeması', icon: <IconSitemap size={18} /> },
        { to: '/gonulluluk', label: 'Gönüllülük', icon: <IconHeartHandshake size={18} /> },
        { to: '/devir', label: 'Devir paketleri', icon: <IconArrowsExchange size={18} /> },
      ],
    },
    {
      label: 'Yönetim',
      items: (
        [
          { to: '/yonetim/uyeler', label: 'Üyeler', icon: <IconUsers size={18} />, perm: 'members.manage' },
          { to: '/yonetim/atamalar', label: 'Görev atamaları', icon: <IconUserShield size={18} />, perm: 'assignments.manage' },
          { to: '/yonetim/secimler', label: 'Seçimler', icon: <IconBallpen size={18} />, perm: 'elections.manage' },
          { to: '/yonetim/birimler', label: 'Komiteler ve birimler', icon: <IconBuildingCommunity size={18} />, perm: 'org.manage' },
          { to: '/yonetim/roller', label: 'Roller ve yetkiler', icon: <IconShieldLock size={18} />, perm: 'org.manage' },
          { to: '/yonetim/donemler', label: 'Dönemler', icon: <IconCalendarEvent size={18} />, perm: 'org.manage' },
          { to: '/yonetim/sablonlar', label: 'Dilekçe şablonları', icon: <IconTemplate size={18} />, perm: 'templates.manage' },
          { to: '/yonetim/envanter', label: 'Envanter', icon: <IconServer size={18} />, perm: 'inventory.manage' },
          { to: '/yonetim/ayarlar', label: 'Kurum ayarları', icon: <IconSettings size={18} />, perm: 'org.manage' },
          { to: '/yonetim/denetim', label: 'Denetim kaydı', icon: <IconHistory size={18} />, perm: 'audit.read' },
        ] as NavItem[]
      ).filter((i) => !i.perm || can(i.perm)),
    },
  ];

  const isActive = (item: NavItem) =>
    item.exact ? location.pathname === item.to : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`) && !(item.to === '/dilekceler' && location.pathname === '/dilekceler/yeni');

  const renderItem = (item: NavItem) => (
    <NavLink
      key={item.to}
      component={Link}
      to={item.to}
      label={item.label}
      leftSection={item.icon}
      active={isActive(item)}
      onClick={close}
      rightSection={
        item.badge ? (
          <Badge size="sm" color="red" variant="filled" circle>
            {item.badge}
          </Badge>
        ) : null
      }
      style={{ borderRadius: 'var(--mantine-radius-md)' }}
    />
  );

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 272, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding={{ base: 'md', sm: 'xl' }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Menüyü aç" />
            <UnstyledButton component={Link} to="/">
              <Group gap="xs" wrap="nowrap">
                {publicSettings.logoDataUrl ? (
                  <Image src={publicSettings.logoDataUrl} h={32} w="auto" fit="contain" alt="" />
                ) : (
                  <Image src="/favicon.svg" h={32} w={32} alt="" />
                )}
                <div>
                  <Text fw={700} lh={1.1}>
                    {publicSettings.orgShortName}
                  </Text>
                  <Text size="xs" c="dimmed" lh={1.1} visibleFrom="xs">
                    Hub
                  </Text>
                </div>
              </Group>
            </UnstyledButton>
          </Group>

          <Group gap="xs" wrap="nowrap">
            <Tooltip label={scheme === 'dark' ? 'Açık tema' : 'Koyu tema'}>
              <ActionIcon
                variant="default"
                size="lg"
                onClick={() => setColorScheme(scheme === 'dark' ? 'light' : 'dark')}
                aria-label="Tema değiştir"
              >
                {scheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
              </ActionIcon>
            </Tooltip>
            <Menu position="bottom-end" width={220} shadow="md">
              <Menu.Target>
                <UnstyledButton aria-label="Kullanıcı menüsü">
                  <Group gap={8} wrap="nowrap">
                    <Avatar src={member?.photoURL ?? undefined} name={member?.displayName} color="initials" radius="xl" size={34} />
                    <Text size="sm" fw={500} visibleFrom="sm" maw={160} truncate>
                      {member?.displayName}
                    </Text>
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{member?.email}</Menu.Label>
                {isSuperAdmin && (
                  <Menu.Item disabled leftSection={<IconShieldLock size={16} />}>
                    Kurucu yönetici
                  </Menu.Item>
                )}
                <Menu.Item component={Link} to="/profil" leftSection={<IconUserCircle size={16} />}>
                  Profilim ve görevlerim
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={() => void signOut()}>
                  Çıkış yap
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        {accessibleUnits.length > 0 && (
          <AppShell.Section mb="xs">
            <Select
              label="Çalışma alanı"
              size="sm"
              searchable
              allowDeselect={false}
              value={selectedUnitId}
              data={accessibleUnits.map((unit) => ({ value: unit.id, label: `${unit.name} (${unit.shortCode})` }))}
              onChange={(id) => {
                setSelectedUnitId(id);
                if (id) navigate(`/birimler/${id}`);
                close();
              }}
            />
          </AppShell.Section>
        )}
        <AppShell.Section grow component={ScrollArea}>
          <Stack gap={2}>
            {sections
              .filter((sec) => sec.items.length)
              .map((sec) => (
                <div key={sec.label ?? 'genel'}>
                  {sec.label && (
                    <Text size="xs" c="dimmed" fw={600} mt="md" mb={4} px="sm" className="nav-section-label">
                      {sec.label}
                    </Text>
                  )}
                  {sec.items.map(renderItem)}
                </div>
              ))}
          </Stack>
        </AppShell.Section>
        <AppShell.Section>
          <NavLink component={Link} to="/yardim" label="Yardım ve destek" leftSection={<IconLifebuoy size={18} />} active={location.pathname === '/yardim'} onClick={close} style={{ borderRadius: 'var(--mantine-radius-md)' }} />
          <Text size="xs" c="dimmed" px="sm" py="xs">
            {publicSettings.orgName}
          </Text>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <Suspense fallback={<SectionLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </AppShell.Main>
    </AppShell>
  );
}
