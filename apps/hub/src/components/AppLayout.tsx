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
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure, useHotkeys, useLocalStorage, useMediaQuery, useOs } from '@mantine/hooks';
import {
  IconBuildingCommunity,
  IconCalendarEvent,
  IconChecklist,
  IconChevronDown,
  IconFilePlus,
  IconFileText,
  IconHistory,
  IconHome,
  IconLogout,
  IconMoon,
  IconSearch,
  IconSelector,
  IconSettings,
  IconShieldLock,
  IconSitemap,
  IconGavel,
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
  IconUsersGroup,
  IconDatabaseCog,
  IconBook2,
  IconPackage,
  IconBan,
  IconBriefcase2,
  IconDoor,
} from '@tabler/icons-react';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { unitsWithPermission } from '../lib/access';
import { useInbox } from '../lib/inbox';
import { SectionLoader } from './ui';
import type { PermissionId } from '../lib/permissions';
import { useUnitScope } from '../lib/unitScope';
import { siteQrController } from '../lib/siteWorkflow';
import { AppInstallButton } from './AppInstall';
import { MailRegistration } from './MailPreferences';
import { PushPermissionPrompt } from './PushPermissionPrompt';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  perm?: PermissionId;
  badge?: number;
  exact?: boolean;
}

interface NavSection {
  /** Açık/kapalı durumunun tarayıcıda hatırlanması için sabit anahtar. */
  id: string;
  label: string | null;
  items: NavItem[];
}

/** Arama için Türkçe kurallarıyla küçük harfe çevirir (İ → i, I → ı). */
const fold = (s: string) => s.toLocaleLowerCase('tr');

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
  const { member, publicSettings, can, signOut, isSuperAdmin, access } = useAuth();
  const { waiting } = useInbox();
  const location = useLocation();
  const navigate = useNavigate();
  const { accessibleUnits, selectedUnitId, selectedUnit, setSelectedUnitId } = useUnitScope();
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');

  const unitManager = unitsWithPermission(access, 'unit.manage').length > 0;
  const sections: NavSection[] = [
    {
      id: 'genel',
      label: null,
      items: [
        { to: '/', label: 'Ana sayfa', icon: <IconHome size={17} stroke={1.6} />, exact: true },
        { to: '/onaylar', label: 'Onayımı bekleyenler', icon: <IconChecklist size={17} stroke={1.6} />, badge: waiting.length },
        { to: '/gorevler', label: 'Görevler ve projeler', icon: <IconListCheck size={17} stroke={1.6} /> },
      ],
    },
    {
      id: 'komite',
      label: selectedUnit ? selectedUnit.name : 'Komitem',
      items: selectedUnit
        ? [{ to: `/birimler/${selectedUnit.id}`, label: 'Komite çalışma alanı', icon: <IconBuildingCommunity size={17} stroke={1.6} /> }]
        : [],
    },
    {
      id: 'dilekce',
      label: 'Dilekçe',
      items: [
        { to: '/dilekceler/yeni', label: 'Yeni dilekçe', icon: <IconFilePlus size={17} stroke={1.6} />, exact: true },
        { to: '/dilekceler', label: 'Dilekçeler', icon: <IconFileText size={17} stroke={1.6} /> },
      ],
    },
    {
      id: 'operasyon',
      label: 'Operasyon',
      items: [
        { to: '/etkinlikler', label: 'Etkinlikler', icon: <IconCalendarStar size={17} stroke={1.6} /> },
        { to: '/surecler', label: 'Tüzük süreçleri', icon: <IconShieldLock size={17} stroke={1.6} /> },
        ...(siteQrController(access) ? [{ to: '/actor', label: 'ACTOR · Puan ve QR', icon: <IconShieldLock size={17} stroke={1.6} /> }] : []),
        { to: '/toplantilar', label: 'Toplantılar', icon: <IconUsersGroup size={17} stroke={1.6} /> },
        { to: '/oda-rezervasyonu', label: 'Oda rezervasyonu', icon: <IconDoor size={17} stroke={1.6} /> },
        { to: '/iletisim', label: 'İletişim', icon: <IconSpeakerphone size={17} stroke={1.6} /> },
        { to: '/sponsorluk', label: 'Sponsorluk', icon: <IconBuildingStore size={17} stroke={1.6} /> },
        ...(can('inventory.manage') || can('finance.read') || can('finance.manage') || can('secretary.ledger.manage') || can('work.manageAll') ? [{ to: '/demirbas', label: 'Demirbaş ve zimmet', icon: <IconPackage size={17} stroke={1.6} /> }] : []),
        ...(can('finance.read') || can('finance.manage') || unitManager ? [{ to: '/butceler', label: 'Bütçeler', icon: <IconCoin size={17} stroke={1.6} /> }] : []),
        ...(can('reports.read') || can('reports.approve') ? [{ to: '/raporlar', label: 'Raporlar', icon: <IconChartBar size={17} stroke={1.6} /> }] : []),
        ...(can('secretary.ledger.manage') ? [{ to: '/sekreterlik-defteri', label: 'Sekreterlik defteri', icon: <IconNotebook size={17} stroke={1.6} /> }] : []),
      ],
    },
    {
      id: 'organizasyon',
      label: 'Organizasyon',
      items: [
        { to: '/organizasyon', label: 'Organizasyon şeması', icon: <IconSitemap size={17} stroke={1.6} /> },
        { to: '/kurullar', label: 'Kurullar ve karar defteri', icon: <IconGavel size={17} stroke={1.6} /> },
        { to: '/tuzuk', label: 'Tüzük', icon: <IconBook2 size={17} stroke={1.6} /> },
        { to: '/kariyer', label: 'Açık başvurular', icon: <IconBriefcase2 size={17} stroke={1.6} /> },
        { to: '/gonulluluk', label: 'Gönüllülük', icon: <IconHeartHandshake size={17} stroke={1.6} /> },
        ...(unitManager || can('assignments.manage') ? [{ to: '/basvuru-yonetimi', label: 'Başvuru yönetimi', icon: <IconUsersGroup size={17} stroke={1.6} /> }] : []),
        { to: '/devir', label: 'Devir paketleri', icon: <IconArrowsExchange size={17} stroke={1.6} /> },
      ],
    },
    {
      id: 'yonetim',
      label: 'Yönetim',
      items: (
        [
          { to: '/yonetim/uyeler', label: 'Üyeler', icon: <IconUsers size={17} stroke={1.6} />, perm: 'members.manage' },
          { to: '/yonetim/etkinlik-kisitlamalari', label: 'Etkinlik kısıtlamaları', icon: <IconBan size={17} stroke={1.6} />, perm: 'members.manage' },
          { to: '/yonetim/atamalar', label: 'Görev atamaları', icon: <IconUserShield size={17} stroke={1.6} />, perm: 'assignments.manage' },
          { to: '/yonetim/secimler', label: 'Seçimler', icon: <IconBallpen size={17} stroke={1.6} />, perm: 'elections.manage' },
          { to: '/yonetim/birimler', label: 'Komiteler ve birimler', icon: <IconBuildingCommunity size={17} stroke={1.6} />, perm: 'org.manage' },
          { to: '/yonetim/roller', label: 'Roller ve yetkiler', icon: <IconShieldLock size={17} stroke={1.6} />, perm: 'org.manage' },
          { to: '/yonetim/donemler', label: 'Dönemler', icon: <IconCalendarEvent size={17} stroke={1.6} />, perm: 'org.manage' },
          { to: '/yonetim/sablonlar', label: 'Dilekçe şablonları', icon: <IconTemplate size={17} stroke={1.6} />, perm: 'templates.manage' },
          { to: '/yonetim/envanter', label: 'Envanter', icon: <IconServer size={17} stroke={1.6} />, perm: 'inventory.manage' },
          { to: '/yonetim/harici-firebase', label: 'Harici Firebase', icon: <IconDatabaseCog size={17} stroke={1.6} />, perm: 'external.firebase.manage' },
          { to: '/yonetim/ayarlar', label: 'Kurum ayarları', icon: <IconSettings size={17} stroke={1.6} />, perm: 'org.manage' },
          { to: '/yonetim/denetim', label: 'Denetim kaydı', icon: <IconHistory size={17} stroke={1.6} />, perm: 'audit.read' },
        ] as NavItem[]
      ).filter((i) => !i.perm || can(i.perm)),
    },
  ];

  const isActive = (item: NavItem) =>
    item.exact ? location.pathname === item.to : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`) && !(item.to === '/dilekceler' && location.pathname === '/dilekceler/yeni');

  // Kapatılan menü bölümleri tarayıcıda hatırlanır; varsayılan olarak hepsi açıktır.
  const [collapsed, setCollapsed] = useLocalStorage<string[]>({
    key: 'hub-nav-collapsed',
    defaultValue: [],
    getInitialValueInEffect: false,
  });
  const visibleSections = sections.filter((sec) => sec.items.length);
  const activeSectionId = visibleSections.find((sec) => sec.items.some(isActive))?.id;

  // Kapalı bir bölümdeki sayfaya gidilirse (ör. ana sayfadaki bir bağlantıyla) o bölüm açılır.
  useEffect(() => {
    if (activeSectionId && collapsed.includes(activeSectionId)) {
      setCollapsed((prev) => prev.filter((id) => id !== activeSectionId));
    }
  }, [activeSectionId, collapsed, setCollapsed]);

  const toggleSection = (id: string) =>
    setCollapsed((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const navLinkClasses = { root: 'hub-nav-link', section: 'hub-nav-section', label: 'hub-nav-label' };

  const renderItem = (item: NavItem) => (
    <NavLink
      key={item.to}
      component={Link}
      to={item.to}
      label={item.label}
      leftSection={item.icon}
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

  const renderSection = (sec: NavSection) => {
    const group = <div className="hub-nav-group">{sec.items.map(renderItem)}</div>;
    if (!sec.label) return <div key={sec.id}>{group}</div>;

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

  // ---- Menüde arama (Ctrl+K / ⌘K) ----
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const os = useOs();
  const modKey = os === 'macos' || os === 'ios' ? '⌘' : 'Ctrl';
  useHotkeys([['mod+K', () => searchRef.current?.focus()]]);
  const helpItem: NavItem = { to: '/yardim', label: 'Yardım ve destek', icon: <IconLifebuoy size={17} stroke={1.6} /> };
  const q = fold(query.trim());
  const results = q
    ? [...visibleSections.flatMap((sec) => sec.items), helpItem].filter(
        (item, i, all) => fold(item.label).includes(q) && all.findIndex((x) => x.to === item.to) === i,
      )
    : [];
  const clearSearch = () => setQuery('');

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
      <MailRegistration />
      <PushPermissionPrompt />
      <AppShell.Header className="hub-header">
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} size="sm" aria-label="Menüyü aç" />
            <Brand name={publicSettings.orgShortName} logo={publicSettings.logoDataUrl} />
          </Group>
          <Group gap="xs" wrap="nowrap">
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

      <AppShell.Navbar className="hub-side">
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

          <TextInput
            ref={searchRef}
            mt="sm"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) {
                navigate(results[0].to);
                clearSearch();
                close();
                e.currentTarget.blur();
              }
              if (e.key === 'Escape') {
                clearSearch();
                e.currentTarget.blur();
              }
            }}
            placeholder="Menüde ara"
            aria-label="Menüde ara"
            leftSection={<IconSearch size={15} stroke={2} />}
            rightSection={query ? null : <Kbd size="xs" className="hub-kbd">{modKey} K</Kbd>}
            rightSectionWidth={60}
            classNames={{ input: 'hub-search-input' }}
          />
        </AppShell.Section>

        <AppShell.Section grow component={ScrollArea} className="hub-side-nav">
          <nav aria-label="Ana menü">
            {q ? (
              results.length ? (
                <div className="hub-nav-group" onClick={clearSearch}>
                  {results.map(renderItem)}
                </div>
              ) : (
                <Text size="sm" c="dimmed" px={12} py="md">
                  &ldquo;{query.trim()}&rdquo; ile eşleşen sayfa yok.
                </Text>
              )
            ) : (
              visibleSections.map(renderSection)
            )}
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
