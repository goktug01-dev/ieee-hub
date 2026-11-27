import {
  ActionIcon,
  AppShell,
  Avatar,
  Badge,
  Burger,
  Button,
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
import { useDisclosure, useHotkeys } from '@mantine/hooks';
import { IconLogout, IconMoon, IconShieldLock, IconSun, IconUserCircle, IconLifebuoy, IconSearch } from '@tabler/icons-react';
import { Suspense, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { hubNavigation, isHubNavActive, type HubNavItem } from '../lib/navigation';
import { NavigationSearch } from './NavigationSearch';
import { useInbox } from '../lib/inbox';
import { SectionLoader } from './ui';
import { useUnitScope } from '../lib/unitScope';
import { AppInstallButton } from './AppInstall';
import { MailRegistration } from './MailPreferences';
import { PushPermissionPrompt } from './PushPermissionPrompt';

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  const { member, publicSettings, signOut, isSuperAdmin, access } = useAuth();
  const { waiting } = useInbox();
  const location = useLocation();
  const navigate = useNavigate();
  const { accessibleUnits, selectedUnitId, setSelectedUnitId } = useUnitScope();
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');

  const sections = hubNavigation(access, selectedUnitId, waiting.length);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [searchOpened, search] = useDisclosure();
  useHotkeys([['mod+K', search.open]]);
  const activeSectionId = sections.find((section) => section.id !== 'daily' && section.items.some((item) => !item.searchOnly && isHubNavActive(item, location.pathname)))?.id;
  useEffect(() => {
    if (activeSectionId) setExpanded((current) => current.includes(activeSectionId) ? current : [...current, activeSectionId]);
  }, [activeSectionId, location.pathname]);

  const renderItem = (item: HubNavItem) => (
    <NavLink
      key={item.to}
      component={Link}
      to={item.to}
      label={item.label}
      leftSection={<item.icon size={18} />}
      active={isHubNavActive(item, location.pathname)}
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
      <NavigationSearch sections={sections} opened={searchOpened} onClose={() => { search.close(); close(); }} />
      <MailRegistration />
      <PushPermissionPrompt />
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
            <ActionIcon variant="default" size="lg" onClick={search.open} aria-label="İşlem bul" hiddenFrom="sm"><IconSearch size={18} /></ActionIcon>
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
                <AppInstallButton menu />
                <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={() => void signOut()}>
                  Çıkış yap
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section mb="sm"><Button fullWidth variant="default" leftSection={<IconSearch size={18} />} onClick={search.open}>İşlem bul</Button></AppShell.Section>
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
            {sections.filter((section) => section.items.some((item) => !item.searchOnly)).map((section) => (
              section.id === 'daily' ? <div key={section.id}>{section.items.map(renderItem)}</div> : (
                <NavLink
                  key={section.id} label={section.label} leftSection={<section.icon size={18} />}
                  opened={expanded.includes(section.id)}
                  onChange={(open) => setExpanded((current) => open ? [...current, section.id] : current.filter((id) => id !== section.id))}
                  childrenOffset={12}
                  style={{ borderRadius: 'var(--mantine-radius-md)' }}
                >
                  {section.items.filter((item) => !item.searchOnly).map(renderItem)}
                </NavLink>
              )
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
