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
} from '@tabler/icons-react';
import { Suspense, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { useInbox } from '../lib/inbox';
import { SectionLoader } from './ui';
import type { PermissionId } from '../lib/permissions';

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
  const { member, publicSettings, can, signOut, isSuperAdmin } = useAuth();
  const { waiting } = useInbox();
  const location = useLocation();
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');

  const main: NavItem[] = [
    { to: '/', label: 'Ana sayfa', icon: <IconHome size={18} />, exact: true },
    { to: '/onaylar', label: 'Onayımı bekleyenler', icon: <IconChecklist size={18} />, badge: waiting.length },
    { to: '/dilekceler/yeni', label: 'Yeni dilekçe', icon: <IconFilePlus size={18} />, exact: true },
    { to: '/dilekceler', label: 'Dilekçeler', icon: <IconFileText size={18} /> },
    { to: '/organizasyon', label: 'Organizasyon', icon: <IconSitemap size={18} /> },
  ];

  const admin: NavItem[] = [
    { to: '/yonetim/uyeler', label: 'Üyeler', icon: <IconUsers size={18} />, perm: 'members.manage' },
    { to: '/yonetim/atamalar', label: 'Görev atamaları', icon: <IconUserShield size={18} />, perm: 'assignments.manage' },
    { to: '/yonetim/secimler', label: 'Seçimler', icon: <IconBallpen size={18} />, perm: 'elections.manage' },
    { to: '/yonetim/birimler', label: 'Komiteler ve birimler', icon: <IconBuildingCommunity size={18} />, perm: 'org.manage' },
    { to: '/yonetim/roller', label: 'Roller ve yetkiler', icon: <IconShieldLock size={18} />, perm: 'org.manage' },
    { to: '/yonetim/donemler', label: 'Dönemler', icon: <IconCalendarEvent size={18} />, perm: 'org.manage' },
    { to: '/yonetim/sablonlar', label: 'Dilekçe şablonları', icon: <IconTemplate size={18} />, perm: 'templates.manage' },
    { to: '/yonetim/ayarlar', label: 'Kurum ayarları', icon: <IconSettings size={18} />, perm: 'org.manage' },
    { to: '/yonetim/denetim', label: 'Denetim kaydı', icon: <IconHistory size={18} />, perm: 'audit.read' },
  ].filter((i) => !i.perm || can(i.perm as PermissionId)) as NavItem[];

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
        <AppShell.Section grow component={ScrollArea}>
          <Stack gap={2}>
            {main.map(renderItem)}
            {admin.length > 0 && (
              <>
                <Text size="xs" c="dimmed" fw={600} mt="lg" mb={4} px="sm" className="nav-section-label">
                  Yönetim
                </Text>
                {admin.map(renderItem)}
              </>
            )}
          </Stack>
        </AppShell.Section>
        <AppShell.Section>
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
