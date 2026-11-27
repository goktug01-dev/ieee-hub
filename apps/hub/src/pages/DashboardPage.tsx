import { Anchor, Badge, Button, Group, SegmentedControl, Select, Stack, Text, Title } from '@mantine/core';
import { IconArrowRight, IconArrowUpRight, IconFilePlus } from '@tabler/icons-react';
import { orderBy, where, limit } from 'firebase/firestore';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, StatusBadge } from '../components/ui';
import { fmtRelative } from '../lib/format';
import { useCollection } from '../lib/hooks';
import { useInbox } from '../lib/inbox';
import type { Assignment, Member, Petition } from '../lib/types';
import type { HubEvent, Task } from '../lib/opsTypes';
import { dueInfo } from '../components/MetaBadge';
import dayjs from 'dayjs';
import { useOrg } from '../lib/org';
import { useUnitScope } from '../lib/unitScope';
import { UnitOverview } from '../components/UnitOverview';

/** Sayı panosunun küçük kutusu. `note` kırmızı etiketle gösterilir (ör. gecikmiş görev). */
function Kpi({ label, value, to, note }: { label: string; value: number; to: string; note?: string }) {
  return (
    <Link to={to} className="hub-kpi">
      <IconArrowUpRight size={20} stroke={2.2} className="hub-kpi-go" aria-hidden />
      <span className="hub-kpi-value">{value}</span>
      <span>
        {note && <span className="hub-kpi-note">{note}</span>}
        <span className="hub-kpi-label" style={{ display: 'block', marginTop: note ? 6 : 0 }}>
          {label}
        </span>
      </span>
    </Link>
  );
}

/** Ana sayfa bölümü: başlık, "Tümü" bağlantısı ve altında satır listesi. */
function Panel({ title, to, children }: { title: string; to: string; children: ReactNode }) {
  return (
    <section>
      <div className="hub-panel-head">
        <Title order={4}>{title}</Title>
        <Anchor component={Link} to={to} size="sm">
          Tümü
        </Anchor>
      </div>
      {children}
    </section>
  );
}

export function DashboardPage() {
  const { member, user, can } = useAuth();
  const { unitName } = useOrg();
  const { accessibleUnits, selectedUnitId, selectedUnit, setSelectedUnitId } = useUnitScope();
  const [scope, setScope] = useState<'mine' | 'unit'>('mine');
  const inbox = useInbox();
  const mine = useCollection<Petition>(
    'petitions',
    [where('ownerUid', '==', user!.uid), orderBy('updatedAt', 'desc'), limit(8)],
    user!.uid,
  );
  const myRoles = useCollection<Assignment>(
    'assignments',
    [where('uid', '==', user!.uid), where('status', '==', 'active')],
    user!.uid,
  );
  const myTasks = useCollection<Task>('tasks', [where('assigneeUid', '==', user!.uid)], `dash-t-${user!.uid}`);
  const events = useCollection<HubEvent>('events', [orderBy('createdAt', 'desc'), limit(60)], 'dash-ev');
  const openTasks = myTasks.data
    .filter((t) => !['done', 'cancelled'].includes(t.status))
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  const overdueCount = openTasks.filter((t) => dueInfo(t.dueDate, false)?.color === 'red').length;
  const upcoming = events.data
    .filter((e) => e.startsAt && new Date(e.startsAt).getTime() > Date.now() - 864e5 && !['cancelled', 'rejected', 'proposed'].includes(e.status))
    .sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''))
    .slice(0, 5);
  const pendingMembers = useCollection<Member>(
    can('members.manage') ? 'members' : null,
    [where('status', '==', 'pending')],
    'pending',
  );

  const drafts = mine.data.filter((p) => p.status === 'draft' || p.status === 'returned').length;
  const inProgress = mine.data.filter((p) => p.status === 'pending').length;
  const firstName = member?.displayName?.split(' ')[0] ?? '';
  const scopeControl = accessibleUnits.length > 0 && (
    <Group justify="space-between" wrap="wrap">
      <SegmentedControl
        value={scope}
        onChange={(value) => setScope(value as 'mine' | 'unit')}
        data={[{ value: 'mine', label: 'Benim alanım' }, { value: 'unit', label: 'Komitem' }]}
      />
      {scope === 'unit' && (
        <Select
          value={selectedUnitId}
          onChange={setSelectedUnitId}
          data={accessibleUnits.map((unit) => ({ value: unit.id, label: `${unit.name} (${unit.shortCode})` }))}
          allowDeselect={false}
          searchable
          w={280}
        />
      )}
    </Group>
  );

  if (scope === 'unit' && selectedUnit) {
    return (
      <Stack gap="xl">
        {scopeControl}
        <Group justify="space-between" wrap="wrap">
          <div><Title order={2}>{selectedUnit.name}</Title><Text c="dimmed">Komite çalışma alanının güncel özeti</Text></div>
          <Button component={Link} to={`/birimler/${selectedUnit.id}`} variant="light">Çalışma alanını aç</Button>
        </Group>
        <UnitOverview unitId={selectedUnit.id} />
      </Stack>
    );
  }

  const showMembers = can('members.manage');

  return (
    <Stack gap={48}>
      {scopeControl}
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="lg">
        <div>
          <span className="hub-date-line">{dayjs().format('D MMMM YYYY, dddd')}</span>
          <Title order={1}>Merhaba {firstName}</Title>
          <Group gap={6} mt={14}>
            {myRoles.data.length === 0 ? (
              <Text c="dimmed" size="sm">
                Henüz bir görev atamanız yok.
              </Text>
            ) : (
              myRoles.data.map((a) => (
                <Badge key={a.id} variant="light" color="gray" size="lg">
                  {a.roleName}
                  {a.unitId !== 'branch' ? `, ${unitName(a.unitId)}` : ''}
                </Badge>
              ))
            )}
          </Group>
        </div>
        <Button component={Link} to="/dilekceler/yeni" leftSection={<IconFilePlus size={18} stroke={1.8} />} size="md">
          Yeni dilekçe
        </Button>
      </Group>

      <nav className="hub-kpis" aria-label="Özet">
        <Link to="/onaylar" className="hub-kpi" data-hero>
          <IconArrowUpRight size={26} stroke={2.4} className="hub-kpi-go" aria-hidden />
          <span className="hub-kpi-status">
            <span className="hub-kpi-dot" aria-hidden />
            {inbox.waiting.length ? 'Kararını bekleyen dilekçeler var' : 'Bekleyen onay yok'}
          </span>
          <span>
            <span className="hub-kpi-value" style={{ display: 'block' }}>
              {inbox.waiting.length}
            </span>
            <span className="hub-kpi-label" style={{ display: 'block', marginTop: 10 }}>
              Onayımı bekleyen dilekçe
            </span>
          </span>
        </Link>
        <Kpi label="Açık görevlerim" value={openTasks.length} to="/gorevler" note={overdueCount ? `${overdueCount} gecikmiş` : undefined} />
        <Kpi label="Süreçteki dilekçelerim" value={inProgress} to="/dilekceler" />
        <Kpi label="Taslak veya iade edilen" value={drafts} to="/dilekceler" />
        {showMembers && <Kpi label="Onay bekleyen üye" value={pendingMembers.data.length} to="/yonetim/uyeler" />}
      </nav>

      <div className="hub-bento">
        <div className="hub-stack">
          <Panel title="Onayımı bekleyenler" to="/onaylar">
            {inbox.waiting.length === 0 ? (
              <EmptyState title="Bekleyen onay yok" description="Onayınızı bekleyen dilekçeler burada görünür." />
            ) : (
              inbox.waiting.slice(0, 6).map((p) => <PetitionRow key={p.id} p={p} />)
            )}
          </Panel>

          <Panel title="Son dilekçelerim" to="/dilekceler">
            {mine.data.length === 0 ? (
              <EmptyState
                title="Henüz dilekçeniz yok"
                action={
                  <Button component={Link} to="/dilekceler/yeni" variant="default" size="xs">
                    İlk dilekçeni oluştur
                  </Button>
                }
              />
            ) : (
              mine.data.map((p) => <PetitionRow key={p.id} p={p} />)
            )}
          </Panel>
        </div>

        <div className="hub-stack">
          <Panel title="Görevlerim" to="/gorevler">
            {openTasks.length === 0 ? (
              <EmptyState title="Açık göreviniz yok" />
            ) : (
              openTasks.slice(0, 6).map((t) => {
                const due = dueInfo(t.dueDate, false);
                return (
                  <Link key={t.id} to="/gorevler" className="hub-row">
                    <div style={{ minWidth: 0 }}>
                      <Text size="sm" fw={500} truncate className="hub-row-title">
                        {t.title}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t.code}
                      </Text>
                    </div>
                    {due ? (
                      <Badge size="sm" color={due.color}>
                        {due.label}
                      </Badge>
                    ) : (
                      <Text size="xs" c="dimmed">
                        {t.dueDate ? dayjs(t.dueDate).format('DD.MM') : ''}
                      </Text>
                    )}
                  </Link>
                );
              })
            )}
          </Panel>

          <Panel title="Yaklaşan etkinlikler" to="/etkinlikler">
            {upcoming.length === 0 ? (
              <EmptyState title="Yaklaşan etkinlik yok" />
            ) : (
              upcoming.map((e) => (
                <Link key={e.id} to={`/etkinlikler/${e.id}`} className="hub-row" style={{ justifyContent: 'flex-start', gap: 16 }}>
                  <span className="hub-date">
                    <span className="hub-date-day">{dayjs(e.startsAt).format('D')}</span>
                    <span className="hub-date-month">{dayjs(e.startsAt).format('MMM')}</span>
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" fw={500} truncate className="hub-row-title">
                      {e.name}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {dayjs(e.startsAt).format('HH:mm')}, {e.unitName}
                    </Text>
                  </div>
                </Link>
              ))
            )}
          </Panel>
        </div>
      </div>
    </Stack>
  );
}

/** Dilekçe satırı: ana sayfada ve "Onayımı bekleyenler" sayfasında kullanılır. */
export function PetitionRow({ p }: { p: Petition & { id: string } }) {
  return (
    <Link to={`/dilekceler/${p.id}`} className="hub-row">
      <div style={{ minWidth: 0 }}>
        <Text fw={500} truncate className="hub-row-title">
          {p.title || p.templateName}
        </Text>
        <Text size="xs" c="dimmed" truncate>
          {[p.documentNo ?? 'Taslak', p.unitId === 'branch' ? 'Kol Geneli' : p.unitName, p.ownerName, fmtRelative(p.updatedAt)].join(', ')}
        </Text>
      </div>
      <Group gap={10} wrap="nowrap" style={{ flex: 'none' }}>
        <StatusBadge status={p.status} />
        <IconArrowRight size={16} className="hub-row-arrow" aria-hidden />
      </Group>
    </Link>
  );
}
