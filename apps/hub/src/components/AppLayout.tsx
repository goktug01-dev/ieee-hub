import {
  ActionIcon,
  AppShell,
  Avatar,
  Badge,
  Burger,
  Collapse,
  Group,
  Image,
  Kbd,
  Menu,
  NavLink,
  ScrollArea,
  Select,
  Button,
  Tooltip,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure, useHotkeys, useLocalStorage, useMediaQuery, useOs } from '@mantine/hooks';
import { IconChevronDown, IconLogout, IconMoon, IconSearch, IconSelector, IconShieldLock, IconSun, IconUserCircle } from '@tabler/icons-react';
import { Suspense, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { hubNavigation, isHubNavActive, type HubNavItem, type HubNavSection } from '../lib/navigation';
import { NavigationSearch } from './NavigationSearch';
import { useInbox } from '../lib/inbox';
import { SectionLoader } from './ui';
import { useUnitScope } from '../lib/unitScope';
import { AppInstallButton } from './AppInstall';
import { MailRegistration } from './MailPreferences';
import { PushPermissionPrompt } from './PushPermissionPrompt';

/** Kurum logosu siyah çerçeveli kare bir karo içinde. */
function Brand({ name, logo, onNavigate }: { name: string; logo?: string | null; onNavigate?: () => void }) {
  return (
    <UnstyledButton component={Link} to="/" className="hub-brand" onClick={onNavigate}>
      <span className="hub-brand-tile">
        <Image src={logo || '/favicon.svg'} h={28} w={28} fit="contain" alt="" />
      </span>
      <span className="hub-brand-text">
        <span className="hub-brand-name">{name}</span>
        <span className="hub-brand-sub">Hub</span>
      </span>
    </UnstyledButton>
  );
}

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  const { member, publicSettings, signOut, isSuperAdmin, access } = useAuth();
  const { waiting } = useInbox();
  const location = useLocation();
  const navigate = useNavigate();
  const { accessibleUnits, selectedUnitId, selectedUnit, setSelectedUnitId } = useUnitScope();
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');

  const sections = hubNavigation(access, selectedUnitId, waiting.length);
  const isActive = (item: HubNavItem) => isHubNavActive(item, location.pathname);

  // Günlük işler açık kalır; diğer grupların seçimi tarayıcıda hatırlanır.
  const [collapsed, setCollapsed] = useLocalStorage<string[]>({
    key: 'hub-work-nav-collapsed',
    defaultValue: sections.filter((section) => section.id !== 'daily').map((section) => section.id),
    getInitialValueInEffect: false,
  });
  const visibleSections = sections.map((section) => ({ ...section, items: section.items.filter((item) => !item.searchOnly) })).filter((section) => section.items.length);
  const activeSectionId = visibleSections.find((sec) => sec.items.some(isActive))?.id;

  // Kapalı bir bölümdeki sayfaya gidilirse (ör. ana sayfadaki bir bağlantıyla) o bölüm açılır.
  useEffect(() => {
    if (activeSectionId && collapsed.includes(activeSectionId)) {
      setCollapsed((prev) => prev.filter((id) => id !== activeSectionId));
    }
  }, [activeSectionId, location.pathname, setCollapsed]);

  const toggleSection = (id: string) =>
    setCollapsed((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const navLinkClasses = { root: 'hub-nav-link', section: 'hub-nav-section', label: 'hub-nav-label' };

  const renderItem = (item: HubNavItem) => (
    <NavLink
      key={item.to}
      component={Link}
      to={item.to}
      label={item.label}
      leftSection={<item.icon size={17} stroke={1.6} />}
      active={isActive(item)}
      aria-current={isActive(item) ? 'page' : undefined}
      onClick={close}
      classNames={navLinkClasses}
      rightSection={
        item.badge ? (
          <Badge size="sm" color="red" variant="filled" circle>
            {item.badge}
          </Badge>
        ) : null
      }
    />
  );

  const renderSection = (sec: HubNavSection) => {
    const group = <div className="hub-nav-group">{sec.items.map(renderItem)}</div>;
    if (sec.id === 'daily') return <div key={sec.id}>{group}</div>;

    // Tek bağlantılı bölümü (komite) katlamak anlamsız; yalnızca başlık gösterilir.
    if (sec.items.length < 2) {
      return (
        <div key={sec.id}>
          <div className="hub-nav-heading">
            <span className="hub-nav-heading-text">{sec.label}</span>
          </div>
          {group}
        </div>
      );
    }

    const open = !collapsed.includes(sec.id);
    const panelId = `hub-nav-${sec.id}`;
    return (
      <div key={sec.id}>
        <UnstyledButton
          className="hub-nav-heading"
          onClick={() => toggleSection(sec.id)}
          aria-expanded={open}
          aria-controls={panelId}
        >
          <span className="hub-nav-heading-text">{sec.label}</span>
          <IconChevronDown size={14} className="hub-nav-chevron" data-collapsed={!open || undefined} aria-hidden />
        </UnstyledButton>
        <Collapse expanded={open} id={panelId} transitionDuration={180}>
          {group}
        </Collapse>
      </div>
    );
  };

  const [searchOpened, search] = useDisclosure();
  const os = useOs();
  const modKey = os === 'macos' || os === 'ios' ? '⌘' : 'Ctrl';
  useHotkeys([['mod+K', search.open]]);
  const helpItem = sections.find((section) => section.id === 'support')!.items.find((item) => item.to === '/yardim')!;

  // Masaüstünde üst çubuk yok; kullanıcı menüsü ve tema seçimi sol alttadır.
  const isDesktop = useMediaQuery('(min-width: 48em)', window.matchMedia('(min-width: 48em)').matches, {
    getInitialValueInEffect: false,
  });
  const toggleScheme = () => setColorScheme(scheme === 'dark' ? 'light' : 'dark');

  const userDropdown = (
    <Menu.Dropdown>
      <Menu.Label>{member?.email}</Menu.Label>
      {isSuperAdmin && (
        <Menu.Item disabled leftSection={<IconShieldLock size={16} />}>
          Kurucu yönetici
        </Menu.Item>
      )}
      <Menu.Item component={Link} to="/profil" leftSection={<IconUserCircle size={16} />} onClick={close}>
        Profilim ve görevlerim
      </Menu.Item>
      <Menu.Item leftSection={scheme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />} onClick={toggleScheme}>
        {scheme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
      </Menu.Item>
      <Menu.Divider />
      <AppInstallButton menu />
      <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={() => void signOut()}>
        Çıkış yap
      </Menu.Item>
    </Menu.Dropdown>
  );

  return (
    <AppShell
      layout="alt"
      header={{ height: 56, collapsed: isDesktop }}
      navbar={{ width: 280, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding={{ base: 'lg', sm: 48 }}
      withBorder={false}
    >
      <NavigationSearch sections={sections} opened={searchOpened} onClose={() => { search.close(); close(); }} />
      <MailRegistration />
      <PushPermissionPrompt />
      {/* Kaydırılarak gizlenen alan ekran okuyucu ve klavye odağından da çıkarılır. */}
      <AppShell.Header className="hub-header" inert={isDesktop} aria-hidden={isDesktop || undefined}>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} size="sm" aria-label="Menüyü aç" />
            <Brand name={publicSettings.orgShortName} logo={publicSettings.logoDataUrl} />
          </Group>
          <Group gap="xs" wrap="nowrap">
            <ActionIcon variant="default" size="lg" onClick={search.open} aria-label="İşlem bul"><IconSearch size={17} /></ActionIcon>
            <ActionIcon variant="default" size="lg" onClick={toggleScheme} aria-label="Tema değiştir">
              {scheme === 'dark' ? <IconSun size={17} stroke={1.8} /> : <IconMoon size={17} stroke={1.8} />}
            </ActionIcon>
            <Menu position="bottom-end" width={240}>
              <Menu.Target>
                <UnstyledButton aria-label="Kullanıcı menüsü">
                  <Avatar src={member?.photoURL ?? undefined} name={member?.displayName} color="initials" radius="sm" size={34} />
                </UnstyledButton>
              </Menu.Target>
              {userDropdown}
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className="hub-side" inert={!isDesktop && !opened} aria-hidden={(!isDesktop && !opened) || undefined}>
        <AppShell.Section className="hub-side-top">
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Brand name={publicSettings.orgShortName} logo={publicSettings.logoDataUrl} onNavigate={close} />
            <Tooltip label={scheme === 'dark' ? 'Aydınlık moda geç' : 'Karanlık moda geç'} position="right">
              <ActionIcon
                variant="default"
                size="lg"
                onClick={toggleScheme}
                aria-label={scheme === 'dark' ? 'Aydınlık moda geç' : 'Karanlık moda geç'}
                visibleFrom="sm"
              >
                {scheme === 'dark' ? <IconSun size={17} stroke={1.8} /> : <IconMoon size={17} stroke={1.8} />}
              </ActionIcon>
            </Tooltip>
            <Burger opened={opened} onClick={close} hiddenFrom="sm" size="sm" color="#ebe9e3" aria-label="Menüyü kapat" />
          </Group>

          {accessibleUnits.length > 0 && (
            <Select
              mt="md"
              aria-label="Çalışma alanı"
              searchable
              allowDeselect={false}
              value={selectedUnitId}
              data={accessibleUnits.map((unit) => ({ value: unit.id, label: unit.name }))}
              leftSection={<span className="hub-switch-code">{selectedUnit?.shortCode ?? '-'}</span>}
              leftSectionWidth={44}
              rightSection={<IconSelector size={15} stroke={1.8} />}
              classNames={{ input: 'hub-switch-input' }}
              onChange={(id) => {
                setSelectedUnitId(id);
                if (id) navigate(`/birimler/${id}`);
                close();
              }}
            />
          )}

          <Button mt="sm" fullWidth variant="default" leftSection={<IconSearch size={15} stroke={2} />} rightSection={<Kbd size="xs" className="hub-kbd">{modKey} K</Kbd>} onClick={search.open}>
            İşlem bul
          </Button>
        </AppShell.Section>

        <AppShell.Section grow component={ScrollArea} className="hub-side-nav">
          <nav aria-label="Ana menü">
            {visibleSections.map(renderSection)}
          </nav>
        </AppShell.Section>

        <AppShell.Section className="hub-side-foot">
          <div className="hub-nav-group">{renderItem(helpItem)}</div>
          <Menu position="top-start" width={240}>
            <Menu.Target>
              <UnstyledButton className="hub-user" aria-label="Kullanıcı menüsü">
                <Avatar src={member?.photoURL ?? undefined} name={member?.displayName} color="initials" radius="sm" size={34} />
                <span className="hub-user-text">
                  <span className="hub-user-name">{member?.displayName}</span>
                  <span className="hub-user-mail">{member?.email}</span>
                </span>
                <IconSelector size={15} stroke={1.8} aria-hidden />
              </UnstyledButton>
            </Menu.Target>
            {userDropdown}
          </Menu>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main className="hub-main">
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <Suspense fallback={<SectionLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </AppShell.Main>
    </AppShell>
  );
}
