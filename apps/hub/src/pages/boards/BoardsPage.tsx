import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconGavel, IconPlus, IconPrinter, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { addDoc, collection, doc, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, PageHeader, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { db } from '../../firebase';
import { logAudit } from '../../lib/audit';
import { createBoardVote, recordDecision } from '../../lib/boardOps';
import {
  OUTCOME_COLORS,
  OUTCOME_LABELS,
  RULE_LABELS,
  SCOPE_LABELS,
  absoluteMajority,
  boardsForScope,
  buildRoster,
  twoThirds,
  type BoardDecision,
  type BoardId,
  type BoardSeat,
  type BoardVote,
  type BoardsSettings,
  type Roster,
  type VoteRule,
  type VoteScope,
} from '../../lib/boards';
import { useCollection } from '../../lib/hooks';
import type { Meeting } from '../../lib/opsTypes';
import { useOrg } from '../../lib/org';
import { printArea } from '../../lib/print';
import { BRANCH, type WithId } from '../../lib/types';
import { useBoardAccess } from '../../lib/useBoards';

const BOARD_LABELS: Record<BoardId | 'joint', string> = { yk: 'Yönetim Kurulu', ik: 'İdari Kurul', joint: 'İK-YK ortak' };
const localInput = (date: Date) => dayjs(date).format('YYYY-MM-DDTHH:mm');

export function BoardsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('sekme') ?? 'oylamalar';
  return (
    <Stack>
      <PageHeader
        title="Kurullar"
        description="Yönetim Kurulu ve İdari Kurul oylamaları, karar defteri ve kurul toplantı tutanakları. Sayım tüzüğe göre yapılır (Md. 16-EK.a, 40, 46, 46-EK.a)."
      />
      <Tabs value={tab} onChange={(value) => setParams(value ? { sekme: value } : {})} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="oylamalar">Oylamalar</Tabs.Tab>
          <Tabs.Tab value="karar-defteri">Karar defteri</Tabs.Tab>
          <Tabs.Tab value="toplantilar">Kurul toplantıları</Tabs.Tab>
          <Tabs.Tab value="uyeler">Üyeler ve ayarlar</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="oylamalar"><VotesTab /></Tabs.Panel>
        <Tabs.Panel value="karar-defteri"><DecisionsTab /></Tabs.Panel>
        <Tabs.Panel value="toplantilar"><MeetingsTab /></Tabs.Panel>
        <Tabs.Panel value="uyeler"><MembersTab /></Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

// ---------- Oylamalar ----------

function VotesTab() {
  const { user } = useAuth();
  const access = useBoardAccess();
  const votes = useCollection<BoardVote>(
    'boardVotes',
    access.isAdmin ? [] : [where('visibleUids', 'array-contains', user!.uid)],
    `board-votes-${access.isAdmin ? 'all' : user!.uid}`,
  );
  const [opened, modal] = useDisclosure(false);
  const navigate = useNavigate();
  const sorted = [...votes.data].sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  const open = sorted.filter((vote) => vote.status === 'open');
  const past = sorted.filter((vote) => vote.status !== 'open');

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <Text size="sm" c="dimmed" maw={720}>
          Oylamalar açık oylamadır: kurul üyeleri kimin ne oy verdiğini görür. Oy hakkı, oylama açıldığı anda görevdeki kurul üyelerinden belirlenir ve oylama boyunca değişmez.
        </Text>
        {access.isAdmin && <Button leftSection={<IconPlus size={16} />} onClick={modal.open}>Yeni oylama</Button>}
      </Group>
      {votes.loading ? <SectionLoader /> : sorted.length === 0 ? (
        <EmptyState title="Oylama yok" description={access.isAdmin ? 'İlk oylamayı “Yeni oylama” ile açın.' : 'Üyesi olduğunuz kurulda oylama açıldığında burada görünür.'} />
      ) : (
        <>
          {open.length > 0 && <Title order={5}>Açık oylamalar</Title>}
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            {open.map((vote) => <VoteCard key={vote.id} vote={vote} onOpen={() => navigate(`/kurullar/oylama/${vote.id}`)} />)}
          </SimpleGrid>
          {past.length > 0 && <Title order={5} mt="md">Sonuçlanan oylamalar</Title>}
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            {past.map((vote) => <VoteCard key={vote.id} vote={vote} onOpen={() => navigate(`/kurullar/oylama/${vote.id}`)} />)}
          </SimpleGrid>
        </>
      )}
      {access.isAdmin && <NewVoteModal opened={opened} onClose={modal.close} settings={access.settings} assignments={access.assignments} />}
    </Stack>
  );
}

function VoteCard({ vote, onOpen }: { vote: WithId<BoardVote>; onOpen: () => void }) {
  const outcome = vote.result?.outcome;
  return (
    <Card withBorder style={{ cursor: 'pointer' }} onClick={onOpen}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div>
          <Text fw={600}>{vote.title}</Text>
          <Text size="sm" c="dimmed">{SCOPE_LABELS[vote.scope]} · {RULE_LABELS[vote.rule].split(' (')[0]}{vote.isDecree ? ' · YKK' : ''}</Text>
        </div>
        {vote.status === 'open' ? <Badge color="blue">Açık</Badge> : vote.status === 'cancelled' ? <Badge color="gray">İptal</Badge> : (
          <Badge color={outcome ? OUTCOME_COLORS[outcome] : 'gray'}>{outcome ? OUTCOME_LABELS[outcome] : 'Kapandı'}</Badge>
        )}
      </Group>
      <Text size="xs" c="dimmed" mt="sm">
        {vote.status === 'open' ? `Son oy: ${dayjs(vote.closesAt.toDate()).format('DD.MM.YYYY HH:mm')}` : vote.result?.summary ?? ''}
        {vote.decisionId ? ' · Karar defterine işlendi' : ''}
      </Text>
    </Card>
  );
}

function NewVoteModal({ opened, onClose, settings, assignments }: { opened: boolean; onClose: () => void; settings: BoardsSettings; assignments: ReturnType<typeof useBoardAccess>['assignments'] }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<VoteScope>('yk');
  const [rule, setRule] = useState<VoteRule>('majority');
  const [isDecree, setIsDecree] = useState(false);
  const [closesAt, setClosesAt] = useState(localInput(dayjs().add(2, 'day').hour(23).minute(59).toDate()));
  const [recused, setRecused] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const roster = useMemo(() => buildRoster(settings, assignments, boardsForScope(scope)), [settings, assignments, scope]);
  const preview = thresholds(settings, roster, scope, rule, recused.length);

  const submit = async () => {
    setBusy(true);
    try {
      const id = await createBoardVote(settings, assignments, {
        title, description, scope, rule, isDecree, closesAt: new Date(closesAt), recusedUids: recused, meetingId: null,
      });
      notifySuccess('Oylama açıldı; kurul üyeleri oy verebilir.');
      onClose();
      navigate(`/kurullar/oylama/${id}`);
    } catch (error) {
      notifyError(error, 'Oylama açılamadı');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Yeni kurul oylaması" size="lg">
      <Stack>
        <TextInput label="Konu" required maxLength={200} value={title} onChange={(e) => setTitle(e.currentTarget.value)} placeholder="Örn. 2026 güz dönemi bütçe revizyonu" />
        <Textarea label="Açıklama / karar önerisi" autosize minRows={3} maxLength={5000} value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
        <Select
          label="Kim oy verecek?"
          data={(Object.keys(SCOPE_LABELS) as VoteScope[]).map((value) => ({ value, label: SCOPE_LABELS[value] }))}
          value={scope}
          allowDeselect={false}
          onChange={(value) => { const next = (value ?? 'yk') as VoteScope; setScope(next); setRecused([]); if (next !== 'yk') setIsDecree(false); }}
          description={
            scope === 'joint' ? 'İki kurul tek havuzda, herkes eşit oyla (Md. 30, 32). Eşitlikte konu Denetleme Kurulu’na gider.'
              : scope === 'both' ? 'Her kurul ayrı ayrı sayılır; karar ancak iki kurul da kabul ederse geçer (Md. 31).'
                : scope === 'yk' ? 'Eşitlikte YK Başkanının oyu iki sayılır (Md. 40).' : 'Eşitlikte son söz YK Başkanındadır (Md. 46).'
          }
        />
        <Select
          label="Karar yeter sayısı"
          data={(Object.keys(RULE_LABELS) as VoteRule[]).map((value) => ({ value, label: RULE_LABELS[value] }))}
          value={rule}
          allowDeselect={false}
          disabled={isDecree}
          onChange={(value) => setRule((value ?? 'majority') as VoteRule)}
        />
        {scope === 'yk' && (
          <Checkbox
            label="Yönetim Kurulu Kararnamesi (YKK) — üye tam sayısının en az 2/3’ü gerekir (Md. 40-EK.a)"
            checked={isDecree}
            onChange={(e) => { setIsDecree(e.currentTarget.checked); if (e.currentTarget.checked) setRule('twoThirds'); }}
          />
        )}
        <MultiSelect
          label="Oylamaya katılamayacak üyeler"
          description="Hakkında karar verilen üye (ihraç, görevden alma vb.) oy kullanamaz; eşikler kalan tam sayı üzerinden hesaplanır (Md. 16-EK.a)."
          data={Object.entries(roster).map(([uid, entry]) => ({ value: uid, label: `${entry.name} — ${entry.roleName}` }))}
          value={recused}
          onChange={setRecused}
          searchable
          clearable
        />
        <TextInput type="datetime-local" label="Son oy zamanı" required value={closesAt} onChange={(e) => setClosesAt(e.currentTarget.value)} />
        <Alert variant="light" color="blue" title="Oy hakkı ve eşikler">
          <Stack gap={4}>
            {preview.map((line) => <Text key={line} size="sm">{line}</Text>)}
            <Text size="xs" c="dimmed">Liste oylama açıldığı anki görev atamalarından alınır ve sonradan değişmez.</Text>
          </Stack>
        </Alert>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Vazgeç</Button>
          <Button onClick={() => void submit()} loading={busy} disabled={!title.trim() || !Object.keys(roster).length}>Oylamayı aç</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Oylama açılmadan önce gösterilen, tüzüğe göre nisap ve karar eşiği özeti. */
function thresholds(settings: BoardsSettings, roster: Roster, scope: VoteScope, rule: VoteRule, recused: number): string[] {
  const count = (board: BoardId) => Object.values(roster).filter((entry) => entry.boards.includes(board)).length;
  const describe = (label: string, seated: number, full: number) => {
    const size = Math.max(full, seated) - recused;
    const need = rule === 'majority' ? 'kabul oyu retten fazla olmalı' : `en az ${rule === 'absolute' ? absoluteMajority(size) : rule === 'twoThirds' ? twoThirds(size) : size} kabul`;
    return `${label}: görevde ${seated} üye, tam sayı ${size}; nisap ${absoluteMajority(size)} katılım; ${need}.`;
  };
  if (scope === 'joint') {
    const overlap = Object.values(roster).filter((entry) => entry.boards.length === 2).length;
    const full = (settings.yk.fullSize ?? count('yk')) + (settings.ik.fullSize ?? count('ik')) - overlap;
    return [describe('YK + İK ortak', Object.keys(roster).length, full)];
  }
  return boardsForScope(scope).map((board) => describe(settings[board].name, count(board), settings[board].fullSize ?? count(board)));
}

// ---------- Karar defteri ----------

function DecisionsTab() {
  const { user } = useAuth();
  const access = useBoardAccess();
  const all = useCollection<BoardDecision>(access.isAdmin ? 'boardDecisions' : null, [], 'board-decisions-all');
  const pub = useCollection<BoardDecision>(access.isAdmin ? null : 'boardDecisions', [where('visibility', '==', 'members')], 'board-decisions-public');
  const mine = useCollection<BoardDecision>(access.isAdmin ? null : 'boardDecisions', [where('visibleUids', 'array-contains', user!.uid)], `board-decisions-${user!.uid}`);
  const [board, setBoard] = useState<string>('all');
  const [year, setYear] = useState<string | null>(String(new Date().getFullYear()));
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<WithId<BoardDecision> | null>(null);
  const [opened, modal] = useDisclosure(false);

  const decisions = useMemo(() => {
    const map = new Map<string, WithId<BoardDecision>>();
    for (const item of [...all.data, ...pub.data, ...mine.data]) map.set(item.id, item);
    return [...map.values()];
  }, [all.data, pub.data, mine.data]);
  const years = [...new Set([String(new Date().getFullYear()), ...decisions.map((item) => String(item.year))])].sort().reverse();
  const q = query.trim().toLocaleLowerCase('tr-TR');
  const filtered = decisions
    .filter((item) => (board === 'all' || item.board === board) && (!year || String(item.year) === year))
    .filter((item) => !q || `${item.number} ${item.title} ${item.text}`.toLocaleLowerCase('tr-TR').includes(q))
    .sort((a, b) => (a.board === b.board ? a.seq - b.seq : a.board.localeCompare(b.board)));
  const loading = all.loading || pub.loading || mine.loading;

  return (
    <Stack>
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Group align="flex-end" wrap="wrap">
          <SegmentedControl value={board} onChange={setBoard} data={[{ value: 'all', label: 'Tümü' }, { value: 'yk', label: 'YK' }, { value: 'ik', label: 'İK' }, { value: 'joint', label: 'Ortak' }]} />
          <Select w={110} data={years} value={year} onChange={setYear} aria-label="Yıl" />
          <TextInput placeholder="Karar ara…" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
        </Group>
        <Group gap="xs">
          <Button variant="default" leftSection={<IconPrinter size={16} />} onClick={() => printArea(`Karar defteri ${year ?? ''}`)} disabled={!filtered.length}>Yazdır / PDF</Button>
          {access.isAdmin && <Button leftSection={<IconPlus size={16} />} onClick={modal.open}>Elle karar ekle</Button>}
        </Group>
      </Group>
      <Text size="sm" c="dimmed">
        Karar defteri Genel Sekreterin sorumluluğundadır (Md. 53). Kayıtlar kurul, yıl ve sıra numarasıyla boşluksuz numaralanır; işlenen karar değiştirilemez, düzeltme yeni kararla yapılır.
      </Text>
      {loading ? <SectionLoader /> : filtered.length === 0 ? <EmptyState title="Kayıt yok" description="Kapanan oylamalardan veya kesinleşen kurul tutanaklarından karar işlendiğinde burada görünür." /> : (
        <Card withBorder className="print-area" padding="sm">
          <Title order={4} mb="sm">Karar Defteri {year ?? ''}{board !== 'all' ? ` — ${BOARD_LABELS[board as BoardId | 'joint']}` : ''}</Title>
          <Table.ScrollContainer minWidth={720}>
            <Table verticalSpacing="xs" striped highlightOnHover>
              <Table.Thead>
                <Table.Tr><Table.Th>No</Table.Th><Table.Th>Tarih</Table.Th><Table.Th>Konu ve karar</Table.Th><Table.Th>Sonuç</Table.Th><Table.Th>Kaynak</Table.Th></Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((item) => (
                  <Table.Tr key={item.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(item)}>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}><Text fw={600} size="sm">{item.number}</Text>{item.kind === 'decree' && <Badge size="xs" color="grape">YKK</Badge>}</Table.Td>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>{dayjs(item.date).format('DD.MM.YYYY')}</Table.Td>
                    <Table.Td><Text size="sm" fw={500}>{item.title}</Text><Text size="xs" c="dimmed" lineClamp={2}>{item.text}</Text></Table.Td>
                    <Table.Td><Text size="xs">{item.result || '—'}</Text></Table.Td>
                    <Table.Td><Text size="xs">{item.source.label}{item.correctsId ? ' · düzeltme' : ''}</Text>{item.visibility === 'board' && <Badge size="xs" variant="outline">Kurula özel</Badge>}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
      <Modal opened={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.number} — ${selected.title}` : ''} size="lg">
        {selected && (
          <Stack gap="xs">
            <Text size="sm" c="dimmed">{BOARD_LABELS[selected.board]} · {dayjs(selected.date).format('DD.MM.YYYY')} · {selected.kind === 'decree' ? 'Yönetim Kurulu Kararnamesi' : 'Karar'}</Text>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{selected.text}</Text>
            {selected.result && <Alert variant="light">{selected.result}</Alert>}
            <Text size="xs" c="dimmed">
              Kaynak: {selected.source.type === 'vote' && selected.source.id ? <Link to={`/kurullar/oylama/${selected.source.id}`}>{selected.source.label}</Link>
                : selected.source.type === 'meeting' && selected.source.id ? <Link to={`/toplantilar/${selected.source.id}`}>{selected.source.label}</Link>
                  : selected.source.label} · İşleyen: {selected.createdByName}
            </Text>
            {selected.correctsId && <Text size="xs" c="orange">Bu karar önceki bir kaydı düzeltir: {decisions.find((item) => item.id === selected.correctsId)?.number ?? selected.correctsId}</Text>}
          </Stack>
        )}
      </Modal>
      {access.isAdmin && <ManualDecisionModal opened={opened} onClose={modal.close} decisions={decisions} roster={access.roster} />}
    </Stack>
  );
}

function ManualDecisionModal({ opened, onClose, decisions, roster }: { opened: boolean; onClose: () => void; decisions: WithId<BoardDecision>[]; roster: Roster }) {
  const [board, setBoard] = useState<BoardId | 'joint'>('yk');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [visibility, setVisibility] = useState<'members' | 'board'>('board');
  const [correctsId, setCorrectsId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const uids = Object.keys(roster).filter((uid) => board === 'joint' || roster[uid].boards.includes(board));
      const { number } = await recordDecision({
        board, kind: 'decision', date, title, text, result, correctsId, visibility, visibleUids: uids,
        source: { type: 'manual', id: null, label: 'Elle kayıt' },
      });
      notifySuccess(`Karar ${number} numarasıyla deftere işlendi.`);
      setTitle(''); setText(''); setResult(''); setCorrectsId(null);
      onClose();
    } catch (error) {
      notifyError(error, 'Karar işlenemedi');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal opened={opened} onClose={onClose} title="Karar defterine elle kayıt" size="lg">
      <Stack>
        <Alert variant="light" color="yellow">Hub dışında (ör. yüz yüze toplantıda) alınmış bir kararı işlemek içindir. Oylama veya tutanaktan gelen kararlar kendi ekranından işlenir. Kayıt sonradan değiştirilemez.</Alert>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select label="Kurul" data={(['yk', 'ik', 'joint'] as const).map((value) => ({ value, label: BOARD_LABELS[value] }))} value={board} allowDeselect={false} onChange={(value) => setBoard((value ?? 'yk') as BoardId | 'joint')} />
          <TextInput type="date" label="Karar tarihi" required value={date} onChange={(e) => setDate(e.currentTarget.value)} />
        </SimpleGrid>
        <TextInput label="Konu" required maxLength={200} value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
        <Textarea label="Karar metni" required autosize minRows={4} maxLength={10000} value={text} onChange={(e) => setText(e.currentTarget.value)} />
        <TextInput label="Oylama sonucu" placeholder="Örn. 5 kabul, 1 ret ile oy çokluğuyla" value={result} onChange={(e) => setResult(e.currentTarget.value)} />
        <Select label="Düzelttiği karar" placeholder="Yoksa boş bırakın" clearable searchable data={decisions.map((item) => ({ value: item.id, label: `${item.number} — ${item.title}` }))} value={correctsId} onChange={setCorrectsId} />
        <SegmentedControl value={visibility} onChange={(value) => setVisibility(value as 'members' | 'board')} data={[{ value: 'board', label: 'Yalnız kurul üyeleri görür' }, { value: 'members', label: 'Tüm aktif üyeler görür' }]} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Vazgeç</Button>
          <Button onClick={() => void submit()} loading={busy} disabled={!title.trim() || !text.trim()}>Deftere işle</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ---------- Kurul toplantıları ----------

function MeetingsTab() {
  const { user, member } = useAuth();
  const access = useBoardAccess();
  const navigate = useNavigate();
  const meetings = useCollection<Meeting>(
    'meetings',
    access.canManageMeetings ? [where('boardId', 'in', ['yk', 'ik', 'joint'])] : [where('visibleUids', 'array-contains', user!.uid)],
    `board-meetings-${access.canManageMeetings ? 'all' : user!.uid}`,
  );
  const [board, setBoard] = useState<BoardId | 'joint'>('yk');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const roster = buildRoster(access.settings, access.assignments, board === 'joint' ? ['yk', 'ik'] : [board]);
      const ref = await addDoc(collection(db, 'meetings'), {
        unitId: BRANCH,
        unitName: BOARD_LABELS[board],
        boardId: board,
        boardRoster: roster,
        visibleUids: [...new Set([...Object.keys(roster), user!.uid])],
        title: title.trim(),
        meetingNo: '', date, startTime: '', endTime: '', location: '', chairName: '', recorderName: member?.displayName ?? '',
        attendeeUids: [], attendeeNames: [], guestAttendees: '', agenda: [], decisions: [], generalNotes: '',
        nextMeetingDate: null, status: 'draft', createdBy: user!.uid,
        createdByName: member?.displayName ?? user!.displayName ?? '', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      navigate(`/toplantilar/${ref.id}`);
    } catch (error) {
      notifyError(error, 'Toplantı oluşturulamadı');
    } finally {
      setBusy(false);
    }
  };

  const sorted = [...meetings.data].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Stack>
      <Text size="sm" c="dimmed">
        YK toplantısı en az 20 günde bir yapılır (Md. 42); İK-YK ortak toplantısı haftalıktır ve İK üyeleri haftalık rapor sunar (Md. 78.d). Kesinleşen tutanağın kararları tek tıkla karar defterine işlenir.
      </Text>
      {access.canManageMeetings && (
        <Card withBorder>
          <Group align="flex-end" wrap="wrap">
            <Select label="Kurul" w={180} data={(['yk', 'ik', 'joint'] as const).map((value) => ({ value, label: BOARD_LABELS[value] }))} value={board} allowDeselect={false} onChange={(value) => setBoard((value ?? 'yk') as BoardId | 'joint')} />
            <TextInput label="Toplantı" placeholder="Örn. YK olağan toplantısı" value={title} onChange={(e) => setTitle(e.currentTarget.value)} style={{ flex: '1 1 240px' }} />
            <TextInput type="date" label="Tarih" value={date} onChange={(e) => setDate(e.currentTarget.value)} w={170} />
            <Button leftSection={<IconPlus size={16} />} onClick={() => void create()} loading={busy} disabled={!title.trim()}>Oluştur</Button>
          </Group>
        </Card>
      )}
      {meetings.loading ? <SectionLoader /> : sorted.length === 0 ? <EmptyState title="Kurul toplantısı yok" /> : (
        <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
          {sorted.map((meeting) => (
            <Card key={meeting.id} withBorder style={{ cursor: 'pointer' }} onClick={() => navigate(`/toplantilar/${meeting.id}`)}>
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <div>
                  <Text fw={600}>{meeting.title}</Text>
                  <Text size="sm" c="dimmed">{meeting.unitName} · {dayjs(meeting.date).format('DD.MM.YYYY')}</Text>
                </div>
                <Badge color={meeting.status === 'final' ? 'green' : 'yellow'}>{meeting.status === 'final' ? 'Kesinleşti' : 'Taslak'}</Badge>
              </Group>
              <Text size="sm" mt="sm">{meeting.agenda.length} gündem · {meeting.decisions.length} karar · {meeting.attendeeNames.length} katılımcı</Text>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}

// ---------- Üyeler ve ayarlar ----------

function MembersTab() {
  const { can } = useAuth();
  const access = useBoardAccess();
  const chairName = Object.values(access.roster).find((entry) => entry.roleKey === access.settings.chairRoleKey)?.name;
  return (
    <Stack>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {(['yk', 'ik'] as const).map((board) => {
          const members = Object.entries(access.roster).filter(([, entry]) => entry.boards.includes(board));
          const full = access.settings[board].fullSize ?? members.length;
          return (
            <Card key={board} withBorder>
              <Group justify="space-between" mb="xs">
                <Title order={5}>{access.settings[board].name}</Title>
                <Badge variant="light">{members.length}{access.settings[board].fullSize ? ` / ${full}` : ''} üye</Badge>
              </Group>
              <Text size="xs" c="dimmed" mb="sm">Nisap {absoluteMajority(full)} · salt çoğunluk {absoluteMajority(full)} · üçte iki {twoThirds(full)}</Text>
              {access.loading ? <SectionLoader /> : members.length === 0 ? <Text size="sm" c="dimmed">Görevde üye yok. Koltuk ayarlarını ve görev atamalarını kontrol edin.</Text> : (
                <Stack gap={4}>
                  {members.map(([uid, entry]) => (
                    <Group key={uid} justify="space-between" wrap="nowrap">
                      <Text size="sm">{entry.name}</Text>
                      <Text size="xs" c="dimmed" ta="right">{entry.roleName}{entry.unitName && board === 'ik' ? ` · ${entry.unitName}` : ''}{entry.roleKey === access.settings.chairRoleKey ? ' · altın oy' : ''}</Text>
                    </Group>
                  ))}
                </Stack>
              )}
            </Card>
          );
        })}
      </SimpleGrid>
      <Text size="sm" c="dimmed">Altın oy / son söz: {chairName ?? 'atanmamış'}. Kurul üyeleri görev atamalarından otomatik belirlenir; görev ataması değişince liste de değişir.</Text>
      {can('org.manage') && <BoardSettingsCard settings={access.settings} />}
    </Stack>
  );
}

function BoardSettingsCard({ settings }: { settings: BoardsSettings }) {
  const { roles, units } = useOrg();
  const [draft, setDraft] = useState<BoardsSettings>(settings);
  const [busy, setBusy] = useState(false);
  const unitOptions = [
    { value: '__any__', label: 'Herhangi bir komite' },
    { value: BRANCH, label: 'Kol geneli' },
    ...units.filter((unit) => unit.active).map((unit) => ({ value: unit.id, label: unit.name })),
  ];
  const roleOptions = roles.filter((role) => role.active).map((role) => ({ value: role.id, label: `${role.name}${role.scope === 'branch' ? ' (kol geneli)' : ''}` }));
  const setSeats = (board: BoardId, seats: BoardSeat[]) => setDraft({ ...draft, [board]: { ...draft[board], seats } });

  const save = async () => {
    setBusy(true);
    try {
      await setDoc(doc(db, 'settings', 'boards'), draft);
      await logAudit('board.settings.update', 'settings/boards', { yk: draft.yk.seats.length, ik: draft.ik.seats.length });
      notifySuccess('Kurul ayarları kaydedildi.');
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card withBorder>
      <Stack>
        <Group gap="xs"><IconGavel size={18} /><Title order={5}>Kurul ayarları</Title></Group>
        <Text size="sm" c="dimmed">Hangi görevlerin hangi kurulda oy hakkı olduğunu belirleyin. Tüzük: YK 6 asil üye (Md. 39); İK komite başkanları, başkan yardımcıları ve TechOps Başkanı (Md. 76).</Text>
        {(['yk', 'ik'] as const).map((board) => (
          <Card key={board} withBorder padding="sm">
            <Stack gap="xs">
              <Group justify="space-between" wrap="wrap">
                <Text fw={600}>{draft[board].name}</Text>
                <NumberInput
                  label="Tüzükteki tam sayı"
                  description="Boşsa görevdeki üye sayısı"
                  w={200}
                  min={1}
                  max={100}
                  value={draft[board].fullSize ?? ''}
                  onChange={(value) => setDraft({ ...draft, [board]: { ...draft[board], fullSize: value === '' ? null : Number(value) } })}
                />
              </Group>
              {draft[board].seats.map((seat, index) => (
                <Group key={`${board}-${index}`} align="flex-end" wrap="wrap">
                  <Select label="Rol" data={roleOptions} value={seat.roleId} searchable style={{ flex: '1 1 200px' }} onChange={(value) => setSeats(board, draft[board].seats.map((item, i) => i === index ? { ...item, roleId: value ?? item.roleId } : item))} />
                  <Select label="Birim" data={unitOptions} value={seat.unitId ?? '__any__'} style={{ flex: '1 1 200px' }} allowDeselect={false} onChange={(value) => setSeats(board, draft[board].seats.map((item, i) => i === index ? { ...item, unitId: value === '__any__' ? null : value } : item))} />
                  <Button variant="subtle" color="red" px="xs" aria-label="Koltuğu kaldır" onClick={() => setSeats(board, draft[board].seats.filter((_, i) => i !== index))}><IconTrash size={16} /></Button>
                </Group>
              ))}
              <Button size="xs" variant="default" w="fit-content" leftSection={<IconPlus size={14} />} onClick={() => setSeats(board, [...draft[board].seats, { roleId: roleOptions[0]?.value ?? '', unitId: board === 'yk' ? BRANCH : null }])}>Koltuk ekle</Button>
            </Stack>
          </Card>
        ))}
        <Select
          label="Altın oy / son söz sahibi (YK Başkanı)"
          description="YK eşitliğinde oyu iki sayılır (Md. 40); İK eşitliğinde son söz onundur (Md. 46). Ortak oylamada işlemez."
          data={roles.filter((role) => role.scope === 'branch').map((role) => ({ value: `${BRANCH}__${role.id}`, label: role.name }))}
          value={draft.chairRoleKey}
          clearable
          onChange={(value) => setDraft({ ...draft, chairRoleKey: value })}
        />
        <Group justify="flex-end"><Button onClick={() => void save()} loading={busy}>Kaydet</Button></Group>
      </Stack>
    </Card>
  );
}
