import { Alert, Badge, Button, Card, Group, SimpleGrid, Stack, Table, Tabs, Text, Title } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { IconAlertTriangle, IconCheck, IconDeviceFloppy, IconDownload, IconPrinter } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { addDoc, collection, doc, getDoc, orderBy, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, PageHeader, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { db } from '../../firebase';
import { hasPermission } from '../../lib/access';
import { fmtDateTime } from '../../lib/format';
import { vtoolsData, vtoolsMissingFields, vtoolsPreparationRows } from '../../lib/eventExports';
import { useCollection } from '../../lib/hooks';
import { downloadText, toCsv } from '../../lib/ops';
import { ACTIVE_SPONSOR_STAGES, EVENT_STATUS } from '../../lib/opsLabels';
import type { Budget, ContentRequest, HubEvent, ReportSnapshot, Sponsor, Task, VolunteerApplication } from '../../lib/opsTypes';
import { useOrg } from '../../lib/org';
import type { Assignment, Member, Petition, PetitionTemplate, TemplateVersion, WithId } from '../../lib/types';
import { BRANCH } from '../../lib/types';
import { stepUnitId } from '../../lib/workflow';

const DAY = 864e5;
const tsMs = (t: { toMillis(): number } | null | undefined) => (t ? t.toMillis() : 0);

function Stat({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <Card padding="md">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={700} fz={24} c={color}>
        {value}
      </Text>
    </Card>
  );
}

function useData() {
  const { access } = useAuth();
  const can = (p: string) => hasPermission(access, p);
  const allTasks = can('work.manageAll') || can('reports.read');
  const tasks = useCollection<Task>(allTasks ? 'tasks' : null, [], 'r-tasks');
  const events = useCollection<HubEvent>('events', [orderBy('createdAt', 'desc')], 'r-events');
  const petitions = useCollection<Petition>(can('petitions.readAll') ? 'petitions' : null, [orderBy('updatedAt', 'desc')], 'r-pet');
  const content = useCollection<ContentRequest>('contentRequests', [], 'r-content');
  const sponsors = useCollection<Sponsor>(can('sponsors.read') || can('sponsors.manage') ? 'sponsors' : null, [], 'r-sp');
  const budgets = useCollection<Budget>(can('finance.read') || can('finance.manage') ? 'budgets' : null, [], 'r-bud');
  const members = useCollection<Member>('members', [], 'r-mem');
  const assignments = useCollection<Assignment>('assignments', [where('status', '==', 'active')], 'r-asg');
  const templates = useCollection<PetitionTemplate>('petitionTemplates', [where('active', '==', true)], 'r-tpl');
  const vapps = useCollection<VolunteerApplication>(can('members.manage') ? 'volunteerApplications' : null, [where('status', '==', 'pending')], 'r-va');
  return {
    tasks: tasks.data,
    events: events.data,
    petitions: petitions.data.filter((p) => p.status !== 'draft'),
    content: content.data,
    sponsors: sponsors.data,
    budgets: budgets.data,
    members: members.data,
    assignments: assignments.data,
    templates: templates.data,
    vapps: vapps.data,
    has: { tasks: allTasks, petitions: can('petitions.readAll'), sponsors: can('sponsors.read') || can('sponsors.manage'), finance: can('finance.read') || can('finance.manage'), members: can('members.manage') },
    loading: events.loading || members.loading || assignments.loading,
  };
}

type Data = ReturnType<typeof useData>;

export function ReportsPage() {
  const d = useData();
  const [tab, setTab] = useState<string | null>('haftalik');
  if (d.loading) return <SectionLoader />;
  return (
    <Stack>
      <PageHeader
        title="Raporlar"
        description="Operasyon verilerinden anlık hesaplanan raporlar. Raporlar Genel Sekreter onayından geçmeden resmî kabul edilmez; onaylanan rapor yalnızca toplamlarla arşivlenir."
      />
      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="haftalik">Haftalık operasyon</Tabs.Tab>
          <Tabs.Tab value="aylik">Aylık yönetim</Tabs.Tab>
          <Tabs.Tab value="dilekce">Dilekçe metrikleri</Tabs.Tab>
          <Tabs.Tab value="kalite">Veri kalitesi</Tabs.Tab>
          <Tabs.Tab value="vtools">vTools</Tabs.Tab>
          <Tabs.Tab value="devir">Devir ve onaycılar</Tabs.Tab>
          <Tabs.Tab value="arsiv">Arşiv</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="haftalik">
          <Weekly d={d} />
        </Tabs.Panel>
        <Tabs.Panel value="aylik">
          <Monthly d={d} />
        </Tabs.Panel>
        <Tabs.Panel value="dilekce">
          <PetitionMetrics d={d} />
        </Tabs.Panel>
        <Tabs.Panel value="kalite">
          <Quality d={d} />
        </Tabs.Panel>
        <Tabs.Panel value="vtools">
          <VTools d={d} />
        </Tabs.Panel>
        <Tabs.Panel value="devir">
          <Handover d={d} />
        </Tabs.Panel>
        <Tabs.Panel value="arsiv">
          <Archive />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function SnapshotBar({ type, title, periodStart, periodEnd, data }: { type: ReportSnapshot['type']; title: string; periodStart: string; periodEnd: string; data: Record<string, unknown> }) {
  const { user } = useAuth();
  const save = () =>
    addDoc(collection(db, 'reports'), {
      type,
      title,
      periodStart,
      periodEnd,
      data,
      status: 'draft',
      generatedBy: user!.uid,
      generatedByName: user!.displayName ?? '',
      generatedAt: serverTimestamp(),
    })
      .then(() => notifySuccess('Rapor taslak olarak arşive kaydedildi; Genel Sekreter onayına hazır.'))
      .catch(notifyError);
  return (
    <Group justify="flex-end">
      <Button variant="default" leftSection={<IconPrinter size={16} />} onClick={() => window.print()}>
        Yazdır / PDF
      </Button>
      <Button leftSection={<IconDeviceFloppy size={16} />} onClick={() => void save()}>
        Arşive kaydet
      </Button>
    </Group>
  );
}

// ---------------- Haftalık operasyon ----------------

function Weekly({ d }: { d: Data }) {
  const { unitName } = useOrg();
  const now = Date.now();
  const openTasks = d.tasks.filter((t) => !['done', 'cancelled'].includes(t.status));
  const overdue = openTasks.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < now - DAY / 2);
  const noDue = openTasks.filter((t) => !t.dueDate);
  const doneWeek = d.tasks.filter((t) => t.status === 'done' && tsMs(t.completedAt) > now - 7 * DAY);
  const upcoming = d.events.filter((e) => e.startsAt && new Date(e.startsAt).getTime() > now && new Date(e.startsAt).getTime() < now + 14 * DAY && !['cancelled', 'rejected'].includes(e.status));
  const proposed = d.events.filter((e) => e.status === 'proposed');
  const staleClosing = d.events.filter((e) => ['held', 'closing'].includes(e.status) && e.endsAt && new Date(e.endsAt).getTime() < now - 7 * DAY);
  const stuckPetitions = d.petitions.filter((p) => p.status === 'pending' && tsMs(p.updatedAt) < now - 7 * DAY);
  const pendingPetitions = d.petitions.filter((p) => p.status === 'pending');
  const waitingContent = d.content.filter((c) => ['requested', 'accepted'].includes(c.status));
  const awaitingApproval = d.content.filter((c) => c.status === 'awaiting_approval');
  const sponsorsOverdue = d.sponsors.filter((s) => s.nextActionDate && new Date(s.nextActionDate).getTime() < now - DAY && ACTIVE_SPONSOR_STAGES.includes(s.stage));
  const pendingMembers = d.members.filter((m) => m.status === 'pending');

  const byUnit = useMemo(() => {
    const m = new Map<string, { open: number; overdue: number; done: number }>();
    for (const t of d.tasks) {
      const x = m.get(t.unitId) ?? { open: 0, overdue: 0, done: 0 };
      if (!['done', 'cancelled'].includes(t.status)) x.open++;
      if (overdue.includes(t)) x.overdue++;
      if (doneWeek.includes(t)) x.done++;
      m.set(t.unitId, x);
    }
    return [...m.entries()];
  }, [d.tasks, overdue, doneWeek]);

  const start = dayjs().subtract(7, 'day').format('YYYY-MM-DD');
  const end = dayjs().format('YYYY-MM-DD');

  return (
    <Stack className="print-area">
      <Title order={4}>
        Haftalık operasyon raporu · {dayjs(start).format('DD.MM')} – {dayjs(end).format('DD.MM.YYYY')}
      </Title>
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }}>
        {d.has.tasks && <Stat label="Açık görev" value={openTasks.length} />}
        {d.has.tasks && <Stat label="Geciken görev" value={overdue.length} color={overdue.length ? 'red' : undefined} />}
        {d.has.tasks && <Stat label="Bu hafta tamamlanan" value={doneWeek.length} color="green" />}
        <Stat label="14 gün içindeki etkinlik" value={upcoming.length} />
        {d.has.petitions && <Stat label="Onay sürecindeki dilekçe" value={pendingPetitions.length} />}
        <Stat label="Onay bekleyen üye" value={pendingMembers.length} color={pendingMembers.length ? 'orange' : undefined} />
      </SimpleGrid>

      {!d.has.tasks && (
        <Alert color="gray" variant="light">
          Görev verileri için "Raporları gör" veya "Tüm görev ve projeleri yönet" yetkisi gerekir.
        </Alert>
      )}

      <Section title="Yönetim kararı bekleyen konular">
        <List
          rows={[
            ...proposed.map((e) => ({ k: `ev-${e.id}`, a: `Etkinlik önerisi: ${e.name}`, b: e.unitName, link: `/etkinlikler/${e.id}` })),
            ...stuckPetitions.map((p) => ({ k: `p-${p.id}`, a: `7 günden uzun bekleyen dilekçe: ${p.documentNo}`, b: p.steps?.[p.currentStep ?? 0]?.name ?? '', link: `/dilekceler/${p.id}` })),
            ...awaitingApproval.map((c) => ({ k: `c-${c.id}`, a: `Birim onayı bekleyen içerik: ${c.eventName ?? c.brief.slice(0, 40)}`, b: c.requestingUnitName, link: '/iletisim' })),
          ]}
        />
      </Section>

      {d.has.tasks && (
        <Section title="Geciken görevler (sorumluya hatırlatın)">
          <List rows={overdue.map((t) => ({ k: t.id, a: `${t.code} · ${t.title}`, b: `${t.assigneeName} · ${dayjs(t.dueDate).format('DD.MM')}`, link: `/gorevler?sekme=pano&birim=${t.unitId}` }))} />
        </Section>
      )}

      {d.has.tasks && (
        <Section title="Birim bazında görevler">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Birim</Table.Th>
                <Table.Th>Açık</Table.Th>
                <Table.Th>Geciken</Table.Th>
                <Table.Th>Bu hafta tamamlanan</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {byUnit.map(([u, x]) => (
                <Table.Tr key={u}>
                  <Table.Td>{unitName(u)}</Table.Td>
                  <Table.Td>{x.open}</Table.Td>
                  <Table.Td c={x.overdue ? 'red' : undefined}>{x.overdue}</Table.Td>
                  <Table.Td>{x.done}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Section>
      )}

      <Section title="Yaklaşan etkinlikler (14 gün)">
        <List rows={upcoming.map((e) => ({ k: e.id, a: `${e.code} · ${e.name}`, b: `${dayjs(e.startsAt).format('DD.MM HH:mm')} · ${EVENT_STATUS[e.status].label}`, link: `/etkinlikler/${e.id}` }))} />
      </Section>
      <Section title="Kapanışı geciken etkinlikler">
        <List rows={staleClosing.map((e) => ({ k: e.id, a: `${e.code} · ${e.name}`, b: EVENT_STATUS[e.status].label, link: `/etkinlikler/${e.id}` }))} />
      </Section>
      <Section title="Bekleyen içerik talepleri">
        <List rows={waitingContent.map((c) => ({ k: c.id, a: c.eventName ?? c.brief.slice(0, 50), b: c.requestingUnitName, link: '/iletisim' }))} />
      </Section>
      {d.has.sponsors && (
        <Section title="Sonraki işlem tarihi geçmiş sponsor görüşmeleri">
          <List rows={sponsorsOverdue.map((s) => ({ k: s.id, a: s.companyName, b: `${s.ownerName} · ${s.nextAction}`, link: '/sponsorluk' }))} />
        </Section>
      )}
      {noDue.length > 0 && d.has.tasks && (
        <Text size="sm" c="dimmed">
          Son tarihi olmayan açık görev: {noDue.length} (hedef: görevlerin en az %90'ında son tarih).
        </Text>
      )}
      <SnapshotBar
        type="weekly"
        title={`Haftalık operasyon raporu ${dayjs(end).format('DD.MM.YYYY')}`}
        periodStart={start}
        periodEnd={end}
        data={{
          acikGorev: openTasks.length,
          gecikenGorev: overdue.length,
          tamamlananGorev: doneWeek.length,
          sonTarihsizGorev: noDue.length,
          yaklasanEtkinlik: upcoming.length,
          onayBekleyenEtkinlik: proposed.length,
          surectekiDilekce: pendingPetitions.length,
          yediGundenUzunBekleyenDilekce: stuckPetitions.length,
          bekleyenIcerik: waitingContent.length,
          onayBekleyenUye: pendingMembers.length,
          birimler: Object.fromEntries(byUnit.map(([u, x]) => [unitName(u), x])),
        }}
      />
    </Stack>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <Text fw={600} mb="xs">
        {title}
      </Text>
      {children}
    </Card>
  );
}

function List({ rows }: { rows: { k: string; a: string; b: string; link?: string }[] }) {
  if (!rows.length)
    return (
      <Text size="sm" c="dimmed">
        Yok.
      </Text>
    );
  return (
    <Stack gap={4}>
      {rows.map((r) => (
        <Group key={r.k} justify="space-between" wrap="nowrap" gap="xs">
          {r.link ? (
            <Text size="sm" component={Link} to={r.link} truncate>
              {r.a}
            </Text>
          ) : (
            <Text size="sm" truncate>
              {r.a}
            </Text>
          )}
          <Text size="xs" c="dimmed" ta="right">
            {r.b}
          </Text>
        </Group>
      ))}
    </Stack>
  );
}

// ---------------- Aylık yönetim ----------------

function Monthly({ d }: { d: Data }) {
  const [month, setMonth] = useState<string | null>(dayjs().startOf('month').format('YYYY-MM-DD'));
  const m0 = dayjs(month ?? undefined).startOf('month');
  const from = m0.valueOf();
  const to = m0.endOf('month').valueOf();
  const inRange = (ms: number) => ms >= from && ms <= to;

  const opened = d.petitions.filter((p) => inRange(tsMs(p.submittedAt)));
  const approved = d.petitions.filter((p) => p.status === 'approved' && inRange(tsMs(p.completedAt)));
  const rejected = d.petitions.filter((p) => p.status === 'rejected' && inRange(tsMs(p.completedAt)));
  const avgDays = approved.length ? approved.reduce((a, p) => a + (tsMs(p.completedAt) - tsMs(p.submittedAt)), 0) / approved.length / DAY : 0;
  const held = d.events.filter((e) => e.startsAt && inRange(new Date(e.startsAt).getTime()) && ['held', 'closing', 'reported', 'archived'].includes(e.status));
  const participants = held.reduce((a, e) => a + (e.report?.participantCount ?? 0), 0);
  const tasksDone = d.tasks.filter((t) => t.status === 'done' && inRange(tsMs(t.completedAt)));
  const tasksCreated = d.tasks.filter((t) => inRange(tsMs(t.createdAt)));
  const published = d.content.filter((c) => c.status === 'published' && inRange(tsMs(c.updatedAt)));
  const agreed = d.sponsors.filter((s) => s.stage === 'agreed');
  const planned = d.budgets.reduce((a, b) => a + b.plannedTotal, 0);
  const actual = d.budgets.reduce((a, b) => a + b.actualTotal, 0);

  const data = {
    acilanDilekce: opened.length,
    onaylananDilekce: approved.length,
    reddedilenDilekce: rejected.length,
    ortalamaOnayGun: Number(avgDays.toFixed(1)),
    gerceklesenEtkinlik: held.length,
    katilimci: participants,
    olusturulanGorev: tasksCreated.length,
    tamamlananGorev: tasksDone.length,
    yayimlananIcerik: published.length,
    anlasilanSponsor: agreed.length,
    butcePlanlanan: planned,
    butceGerceklesen: actual,
  };

  return (
    <Stack className="print-area">
      <Group justify="space-between">
        <Title order={4}>Aylık yönetim raporu · {m0.format('MMMM YYYY')}</Title>
        <MonthPickerInput value={month} onChange={setMonth} valueFormat="MMMM YYYY" w={200} />
      </Group>
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }}>
        {d.has.petitions && <Stat label="Açılan dilekçe" value={opened.length} />}
        {d.has.petitions && <Stat label="Onaylanan / reddedilen" value={`${approved.length} / ${rejected.length}`} />}
        {d.has.petitions && <Stat label="Ortalama onay süresi" value={`${avgDays.toFixed(1)} gün`} />}
        <Stat label="Gerçekleşen etkinlik" value={held.length} />
        <Stat label="Toplam katılımcı" value={participants} />
        {d.has.tasks && <Stat label="Görev (açılan / biten)" value={`${tasksCreated.length} / ${tasksDone.length}`} />}
        <Stat label="Yayımlanan içerik" value={published.length} />
        {d.has.sponsors && <Stat label="Anlaşılan sponsor (toplam)" value={agreed.length} />}
        {d.has.finance && <Stat label="Bütçe (planlanan / gerçekleşen)" value={`${planned.toLocaleString('tr-TR')} / ${actual.toLocaleString('tr-TR')} ₺`} />}
      </SimpleGrid>
      <Section title="Bu ay gerçekleşen etkinlikler">
        <List rows={held.map((e) => ({ k: e.id, a: `${e.code} · ${e.name}`, b: `${e.unitName} · ${e.report?.participantCount ?? '—'} katılımcı`, link: `/etkinlikler/${e.id}` }))} />
      </Section>
      <SnapshotBar type="monthly" title={`Aylık yönetim raporu ${m0.format('MMMM YYYY')}`} periodStart={m0.format('YYYY-MM-DD')} periodEnd={m0.endOf('month').format('YYYY-MM-DD')} data={data} />
    </Stack>
  );
}

// ---------------- Dilekçe metrikleri ----------------

function PetitionMetrics({ d }: { d: Data }) {
  if (!d.has.petitions) return <EmptyState title="Bu rapor için tüm dilekçeleri görme yetkisi gerekir" />;
  const byTemplate = new Map<string, { n: number; approved: number; rejected: number; pending: number; days: number[] }>();
  const stepTimes = new Map<string, number[]>();
  for (const p of d.petitions) {
    const x = byTemplate.get(p.templateName) ?? { n: 0, approved: 0, rejected: 0, pending: 0, days: [] };
    x.n++;
    if (p.status === 'approved') {
      x.approved++;
      x.days.push((tsMs(p.completedAt) - tsMs(p.submittedAt)) / DAY);
    }
    if (p.status === 'rejected') x.rejected++;
    if (p.status === 'pending' || p.status === 'returned') x.pending++;
    byTemplate.set(p.templateName, x);
    const rev = (p.approvals ?? []).filter((a) => a.revision === (p.revision ?? 1));
    let prev = tsMs(p.submittedAt);
    for (const a of rev) {
      const key = `${p.templateName} · ${a.stepName}`;
      stepTimes.set(key, [...(stepTimes.get(key) ?? []), (tsMs(a.at) - prev) / DAY]);
      prev = tsMs(a.at);
    }
  }
  const avg = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : '—');
  const rows = [...byTemplate.entries()];
  return (
    <Stack>
      <Card>
        <Group justify="space-between" mb="xs">
          <Text fw={600}>Şablon bazında</Text>
          <Button
            size="xs"
            variant="default"
            leftSection={<IconDownload size={14} />}
            onClick={() => downloadText(toCsv([['Şablon', 'Toplam', 'Onaylı', 'Ret', 'Süreçte', 'Ort. gün'], ...rows.map(([k, x]) => [k, x.n, x.approved, x.rejected, x.pending, avg(x.days)])]), 'dilekce_metrikleri.csv')}
          >
            CSV
          </Button>
        </Group>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Şablon</Table.Th>
              <Table.Th>Toplam</Table.Th>
              <Table.Th>Onaylı</Table.Th>
              <Table.Th>Ret</Table.Th>
              <Table.Th>Süreçte</Table.Th>
              <Table.Th>Ort. onay (gün)</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map(([k, x]) => (
              <Table.Tr key={k}>
                <Table.Td>{k}</Table.Td>
                <Table.Td>{x.n}</Table.Td>
                <Table.Td>{x.approved}</Table.Td>
                <Table.Td>{x.rejected}</Table.Td>
                <Table.Td>{x.pending}</Table.Td>
                <Table.Td>{avg(x.days)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
      <Card>
        <Text fw={600} mb="xs">
          Adım bazında ortalama karar süresi (gün)
        </Text>
        <Table>
          <Table.Tbody>
            {[...stepTimes.entries()].map(([k, xs]) => (
              <Table.Tr key={k}>
                <Table.Td>{k}</Table.Td>
                <Table.Td>{avg(xs)}</Table.Td>
                <Table.Td c="dimmed">{xs.length} karar</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}

// ---------------- Veri kalitesi ----------------

function Quality({ d }: { d: Data }) {
  const now = Date.now();
  const { units } = useOrg();
  const warnings: { level: 'red' | 'orange' | 'yellow'; text: string; link?: string }[] = [];
  if (d.has.tasks) {
    const open = d.tasks.filter((t) => !['done', 'cancelled'].includes(t.status));
    const noDue = open.filter((t) => !t.dueDate);
    if (open.length && noDue.length / open.length > 0.1) warnings.push({ level: 'orange', text: `Açık görevlerin %${Math.round((noDue.length / open.length) * 100)}'inde son tarih yok (hedef ≤ %10).`, link: '/gorevler?sekme=pano' });
    open.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < now - DAY).forEach((t) => warnings.push({ level: 'red', text: `Geciken görev: ${t.code} ${t.title} (${t.assigneeName})` }));
  }
  if (d.has.petitions) {
    d.petitions.filter((p) => p.status === 'pending' && tsMs(p.updatedAt) < now - 7 * DAY).forEach((p) => warnings.push({ level: 'red', text: `7 günden uzun bekleyen dilekçe adımı: ${p.documentNo} (${p.steps?.[p.currentStep ?? 0]?.name})`, link: `/dilekceler/${p.id}` }));
  }
  d.events.filter((e) => ['approved', 'planning', 'registration_open'].includes(e.status) && !e.startsAt).forEach((e) => warnings.push({ level: 'orange', text: `Tarihi belirsiz etkinlik: ${e.code} ${e.name}`, link: `/etkinlikler/${e.id}` }));
  d.events.filter((e) => ['held', 'closing'].includes(e.status) && e.endsAt && new Date(e.endsAt).getTime() < now - 14 * DAY).forEach((e) => warnings.push({ level: 'orange', text: `14 günü geçmiş, raporlanmamış etkinlik: ${e.code} ${e.name}`, link: `/etkinlikler/${e.id}` }));
  d.sponsors.filter((s) => ACTIVE_SPONSOR_STAGES.includes(s.stage) && !s.nextActionDate).forEach((s) => warnings.push({ level: 'yellow', text: `Sonraki işlemi olmayan aktif sponsor görüşmesi: ${s.companyName} (${s.ownerName})`, link: '/sponsorluk' }));
  d.members.filter((m) => m.status === 'pending' && tsMs(m.createdAt) < now - 7 * DAY).forEach((m) => warnings.push({ level: 'yellow', text: `7 günden uzun onay bekleyen üyelik: ${m.displayName}`, link: '/yonetim/uyeler' }));
  d.vapps.filter((a) => tsMs(a.createdAt) < now - 7 * DAY).forEach((a) => warnings.push({ level: 'yellow', text: `7 günden uzun bekleyen gönüllü başvurusu: ${a.name} → ${a.unitName}` }));
  const chairRoles = ['birim-baskani'];
  units.filter((u) => u.active && u.type === 'committee' && !d.assignments.some((a) => a.unitId === u.id && chairRoles.includes(a.roleId))).forEach((u) => warnings.push({ level: 'orange', text: `Başkanı atanmamış komite: ${u.name}`, link: '/yonetim/atamalar' }));

  if (!warnings.length) return <Alert color="green" icon={<IconCheck size={18} />}>Veri kalitesi uyarısı yok.</Alert>;
  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">
        {warnings.length} uyarı
      </Text>
      {warnings.map((w, i) => (
        <Alert key={i} color={w.level} variant="light" icon={<IconAlertTriangle size={16} />} p="xs">
          {w.link ? (
            <Text size="sm" component={Link} to={w.link}>
              {w.text}
            </Text>
          ) : (
            <Text size="sm">{w.text}</Text>
          )}
        </Alert>
      ))}
    </Stack>
  );
}

// ---------------- vTools ----------------

function VTools({ d }: { d: Data }) {
  const { access, user, orgSettings } = useAuth();
  const list = d.events.filter((e) => ['held', 'closing', 'reported', 'archived'].includes(e.status) && e.vtoolsStatus !== 'not_required');
  const missing = (e: HubEvent) => vtoolsMissingFields(e, orgSettings);
  const canMark = (e: HubEvent) => e.ownerUids.includes(user!.uid) || hasPermission(access, 'events.manageAll');
  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          IEEE vTools Events / L31 için form-hazırlık paketi. Eksik alanları etkinlikte tamamlayın; resmî gönderimi vTools'ta insan
          kontrolüyle yapın. CSV doğrudan toplu yükleme dosyası değildir.
        </Text>
        <Button
          size="xs"
          variant="default"
          leftSection={<IconDownload size={14} />}
          onClick={() =>
            downloadText(
              toCsv(vtoolsPreparationRows(list, orgSettings)),
              'vtools_l31_hazirlik_paketi.csv',
            )
          }
        >
          vTools hazırlık paketi (CSV)
        </Button>
      </Group>
      {list.length === 0 ? (
        <EmptyState title="Bildirilecek etkinlik yok" />
      ) : (
        <Table.ScrollContainer minWidth={700}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Etkinlik</Table.Th>
                <Table.Th>Eksik alanlar</Table.Th>
                <Table.Th>Durum</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.map((e) => {
                const m = missing(e);
                return (
                  <Table.Tr key={e.id}>
                    <Table.Td>
                      <Text component={Link} to={`/etkinlikler/${e.id}`} size="sm">
                        {e.code} · {e.name}
                      </Text>
                    </Table.Td>
                    <Table.Td>{m.length ? <Badge color="orange">{m.join(', ')}</Badge> : <Badge color="green">tam</Badge>}</Table.Td>
                    <Table.Td>{e.vtoolsStatus === 'reported' ? <Badge color="green">Bildirildi</Badge> : <Badge color="yellow">Bildirilecek</Badge>}</Table.Td>
                    <Table.Td>
                      {e.vtoolsStatus !== 'reported' && canMark(e) && (
                        <Button
                          component={Link}
                          to={`/etkinlikler/${e.id}`}
                          size="compact-xs"
                          variant="light"
                        >
                          {m.length ? 'Eksikleri tamamla' : vtoolsData(e).eventId ? 'Kontrol et ve bildir' : 'vTools kimliği gir'}
                        </Button>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  );
}

// ---------------- Devir ve onaycılar (RBAC) ----------------

function Handover({ d }: { d: Data }) {
  const { roleName, unitName, units } = useOrg();
  const [versions, setVersions] = useState<Record<string, TemplateVersion>>({});
  useEffect(() => {
    Promise.all(
      d.templates.map(async (t) => {
        const s = await getDoc(doc(db, 'petitionTemplates', t.id, 'versions', String(t.currentVersion)));
        return [t.id, s.exists() ? (s.data() as TemplateVersion) : null] as const;
      }),
    ).then((pairs) => setVersions(Object.fromEntries(pairs.filter(([, v]) => v).map(([k, v]) => [k, v!]))));
  }, [d.templates]);

  const holders = (unit: string, role: string) => d.assignments.filter((a) => a.unitId === unit && a.roleId === role);
  const rows: { tpl: string; step: string; unit: string; roles: string; count: number }[] = [];
  for (const t of d.templates) {
    const v = versions[t.id];
    if (!v) continue;
    const unitScope = t.scope === 'branch' ? [BRANCH] : (t.unitIds.length ? t.unitIds : units.filter((u) => u.active).map((u) => u.id));
    for (const s of v.steps) {
      const targetUnits = s.unitMode === 'petition' ? unitScope : [stepUnitId(s, BRANCH)];
      for (const u of targetUnits) {
        const count = new Set(s.roleIds.flatMap((r) => holders(u, r).map((a) => a.uid))).size;
        rows.push({ tpl: t.name, step: s.name, unit: unitName(u), roles: s.roleIds.map(roleName).join(' / '), count });
      }
    }
  }
  const soon = d.assignments.filter((a) => a.endsAt && a.endsAt.toMillis() < Date.now() + 30 * DAY);
  const problems = rows.filter((r) => r.count < 2);

  return (
    <Stack>
      <Alert color={problems.some((r) => r.count === 0) ? 'red' : 'blue'} variant="light">
        Onaylayacak kimsesi olmayan adımlar dilekçeleri kilitler. Her adımda en az iki onaycı (asıl + ikame) olması önerilir.
      </Alert>
      <Card>
        <Text fw={600} mb="xs">
          Onaycı sayısı 2'nin altında olan adımlar ({problems.length})
        </Text>
        {problems.length === 0 ? (
          <Text size="sm" c="dimmed">
            Yok.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={640}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Şablon</Table.Th>
                  <Table.Th>Adım</Table.Th>
                  <Table.Th>Birim</Table.Th>
                  <Table.Th>Roller</Table.Th>
                  <Table.Th>Onaycı</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {problems.map((r, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>{r.tpl}</Table.Td>
                    <Table.Td>{r.step}</Table.Td>
                    <Table.Td>{r.unit}</Table.Td>
                    <Table.Td>{r.roles}</Table.Td>
                    <Table.Td>
                      <Badge color={r.count === 0 ? 'red' : 'orange'}>{r.count}</Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>
      <Card>
        <Text fw={600} mb="xs">
          30 gün içinde sona erecek görevler ({soon.length})
        </Text>
        <List rows={soon.map((a) => ({ k: a.id, a: `${a.memberName} · ${a.roleName}`, b: `${a.unitName} · ${a.endsAt ? dayjs(a.endsAt.toDate()).format('DD.MM.YYYY') : ''}`, link: '/yonetim/atamalar' }))} />
      </Card>
    </Stack>
  );
}

// ---------------- Arşiv ----------------

function Archive() {
  const { access, user } = useAuth();
  const list = useCollection<ReportSnapshot>('reports', [orderBy('generatedAt', 'desc')], 'reports');
  const canApprove = hasPermission(access, 'reports.approve');
  const [open, setOpen] = useState<WithId<ReportSnapshot> | null>(null);
  if (list.loading) return <SectionLoader />;
  if (!list.data.length) return <EmptyState title="Arşivde rapor yok" description="Haftalık veya aylık raporda 'Arşive kaydet'e basın." />;
  return (
    <Stack>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Rapor</Table.Th>
            <Table.Th>Hazırlayan</Table.Th>
            <Table.Th>Durum</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {list.data.map((r) => (
            <Table.Tr key={r.id} onClick={() => setOpen(r)} style={{ cursor: 'pointer' }}>
              <Table.Td>{r.title}</Table.Td>
              <Table.Td>
                {r.generatedByName} · {fmtDateTime(r.generatedAt)}
              </Table.Td>
              <Table.Td>{r.status === 'approved' ? <Badge color="green">Onaylı · {r.approvedByName}</Badge> : <Badge color="gray">Taslak</Badge>}</Table.Td>
              <Table.Td>
                {canApprove && r.status === 'draft' && (
                  <Button
                    size="compact-xs"
                    color="green"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateDoc(doc(db, 'reports', r.id), { status: 'approved', approvedBy: user!.uid, approvedByName: user!.displayName ?? '', approvedAt: serverTimestamp() })
                        .then(() => notifySuccess('Rapor resmî olarak onaylandı.'))
                        .catch(notifyError);
                    }}
                  >
                    Onayla
                  </Button>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {open && (
        <Card className="print-area">
          <Group justify="space-between">
            <Title order={5}>{open.title}</Title>
            <Button size="xs" variant="default" leftSection={<IconPrinter size={14} />} onClick={() => window.print()}>
              Yazdır
            </Button>
          </Group>
          <Table mt="sm">
            <Table.Tbody>
              {Object.entries(open.data).map(([k, v]) => (
                <Table.Tr key={k}>
                  <Table.Td>{k}</Table.Td>
                  <Table.Td>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}
    </Stack>
  );
}
