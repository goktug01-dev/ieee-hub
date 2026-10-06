import { Alert, Badge, Button, Card, Group, Modal, Progress, SegmentedControl, SimpleGrid, Stack, Table, Text, TextInput, Textarea, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { IconArrowLeft, IconCheck } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { cancelBoardVote, castBallot, closeBoardVote, recordDecision, voteDecisionId } from '../../lib/boardOps';
import {
  CHOICE_LABELS,
  OUTCOME_COLORS,
  OUTCOME_LABELS,
  RULE_LABELS,
  SCOPE_LABELS,
  tallyVote,
  type Ballot,
  type BallotChoice,
  type BodyTally,
  type BoardVote,
} from '../../lib/boards';
import { useCollection, useDoc } from '../../lib/hooks';
import type { WithId } from '../../lib/types';
import { useBoardAccess } from '../../lib/useBoards';

export function BoardVotePage() {
  const { id } = useParams();
  const { user, member } = useAuth();
  const access = useBoardAccess();
  const vote = useDoc<BoardVote>(id ? `boardVotes/${id}` : null);
  const ballots = useCollection<Ballot>(id ? `boardVotes/${id}/ballots` : null, [], `ballots-${id}`);
  const [busy, setBusy] = useState<BallotChoice | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [recordOpened, recordModal] = useDisclosure(false);
  const [recorded, setRecorded] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { if (vote.data?.decisionId) setRecorded(true); }, [vote.data?.decisionId]);

  const byUid = useMemo(() => Object.fromEntries(ballots.data.map((ballot) => [ballot.id, ballot])), [ballots.data]);
  const tally = useMemo(() => (vote.data ? tallyVote(vote.data, byUid) : null), [vote.data, byUid]);

  if (vote.loading) return <SectionLoader />;
  if (!vote.data || !tally) return <EmptyState title="Oylama bulunamadı" description="Silinmiş olabilir ya da bu oylamayı görme yetkiniz yok." />;
  const v = vote.data;
  const me = user ? v.roster[user.uid] : undefined;
  const recused = !!user && v.recusedUids.includes(user.uid);
  const expired = v.closesAt.toMillis() <= now;
  const canVote = !!me && !recused && v.status === 'open' && !expired;
  const myBallot = user ? byUid[user.uid] : undefined;
  const allVoted = Object.keys(v.roster).filter((uid) => !v.recusedUids.includes(uid)).every((uid) => byUid[uid]);
  const storedMismatch = v.result && v.result.outcome !== tally.outcome;

  const vote_ = async (choice: BallotChoice) => {
    setBusy(choice);
    try {
      await castBallot(v.id, choice, member?.displayName ?? user?.displayName ?? '');
      notifySuccess(`Oyunuz kaydedildi: ${CHOICE_LABELS[choice]}. Oylama kapanana kadar değiştirebilirsiniz.`);
    } catch (error) {
      notifyError(error, 'Oy kaydedilemedi');
    } finally {
      setBusy(null);
    }
  };

  const close = () =>
    modals.openConfirmModal({
      title: 'Oylama kapatılsın mı?',
      children: (
        <Stack gap="xs">
          <Text size="sm">Kapanan oylamada oy verilemez ve oy değiştirilemez. Sonuç oy pusulalarından hesaplanır.</Text>
          <Text size="sm" fw={600}>Şu anki sonuç: {OUTCOME_LABELS[tally.outcome]}</Text>
          {!allVoted && !expired && <Text size="sm" c="orange">Henüz oy kullanmamış üyeler var ve son oy zamanı gelmedi.</Text>}
        </Stack>
      ),
      labels: { confirm: 'Kapat', cancel: 'Vazgeç' },
      onConfirm: () => closeBoardVote(v).then((result) => notifySuccess(`Oylama kapandı: ${OUTCOME_LABELS[result.outcome]}.`)).catch(notifyError),
    });

  const cancel = () =>
    modals.openConfirmModal({
      title: 'Oylama iptal edilsin mi?',
      children: <Text size="sm">İptal edilen oylama sonuç üretmez ve karar defterine işlenemez. Verilen oylar kayıtta kalır.</Text>,
      labels: { confirm: 'İptal et', cancel: 'Vazgeç' },
      confirmProps: { color: 'red' },
      onConfirm: () => cancelBoardVote(v).then(() => notifySuccess('Oylama iptal edildi.')).catch(notifyError),
    });

  return (
    <Stack>
      <div>
        <Button component={Link} to="/kurullar" variant="subtle" leftSection={<IconArrowLeft size={16} />} px={0}>Kurullar</Button>
        <Group gap="sm" align="center">
          <Title order={2}>{v.title}</Title>
          {v.status === 'open' ? <Badge color={expired ? 'orange' : 'blue'}>{expired ? 'Süre doldu' : 'Açık'}</Badge> : v.status === 'cancelled' ? <Badge color="gray">İptal edildi</Badge> : <Badge color="dark">Kapandı</Badge>}
          {v.isDecree && <Badge color="grape">YKK</Badge>}
        </Group>
        <Text c="dimmed" size="sm">
          {SCOPE_LABELS[v.scope]} · {RULE_LABELS[v.rule]} · Son oy {dayjs(v.closesAt.toDate()).format('DD.MM.YYYY HH:mm')} · Açan {v.createdByName}
        </Text>
      </div>

      {v.description && <Card withBorder><Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{v.description}</Text></Card>}

      {me && (
        <Card withBorder>
          <Stack gap="sm">
            <Text fw={600}>Oyunuz</Text>
            {recused ? (
              <Alert color="gray" variant="light">Bu oylama hakkınızda olduğu için oy kullanamazsınız (Md. 16-EK.a).</Alert>
            ) : canVote ? (
              <>
                <Group gap="xs">
                  {(['yes', 'no', 'abstain'] as BallotChoice[]).map((choice) => (
                    <Button
                      key={choice}
                      variant={myBallot?.choice === choice ? 'filled' : 'default'}
                      color={choice === 'yes' ? 'green' : choice === 'no' ? 'red' : 'gray'}
                      leftSection={myBallot?.choice === choice ? <IconCheck size={16} /> : undefined}
                      loading={busy === choice}
                      disabled={!!busy}
                      onClick={() => void vote_(choice)}
                    >
                      {CHOICE_LABELS[choice]}
                    </Button>
                  ))}
                </Group>
                <Text size="xs" c="dimmed">
                  {myBallot ? `Kayıtlı oyunuz: ${CHOICE_LABELS[myBallot.choice]}. Oylama kapanana kadar değiştirebilirsiniz.` : 'Henüz oy vermediniz.'} Oylar açıktır; kurul üyeleri kimin ne oy verdiğini görür.
                </Text>
              </>
            ) : (
              <Text size="sm">{myBallot ? `Oyunuz: ${CHOICE_LABELS[myBallot.choice]}` : 'Oy kullanmadınız.'}</Text>
            )}
          </Stack>
        </Card>
      )}

      <Card withBorder>
        <Group justify="space-between" mb="sm">
          <Title order={4}>{v.status === 'open' ? 'Anlık sayım' : 'Sonuç'}</Title>
          <Badge size="lg" color={OUTCOME_COLORS[tally.outcome]}>{OUTCOME_LABELS[tally.outcome]}</Badge>
        </Group>
        <SimpleGrid cols={{ base: 1, md: tally.bodies.length > 1 ? 2 : 1 }}>
          {tally.bodies.map((body) => <BodyCard key={body.label} body={body} />)}
        </SimpleGrid>
        {storedMismatch && <Alert color="red" mt="sm">Kayıtlı sonuç ({OUTCOME_LABELS[v.result!.outcome]}) oy pusulalarından hesaplanan sonuçla uyuşmuyor. Genel Sekretere bildirin.</Alert>}
        {v.status === 'closed' && v.closedByName && <Text size="xs" c="dimmed" mt="sm">Kapatan: {v.closedByName}{v.closedAt ? ` · ${dayjs(v.closedAt.toDate()).format('DD.MM.YYYY HH:mm')}` : ''}</Text>}
      </Card>

      <Card withBorder>
        <Title order={4} mb="sm">Oy hakkı olan üyeler</Title>
        <Table.ScrollContainer minWidth={520}>
          <Table verticalSpacing="xs">
            <Table.Thead><Table.Tr><Table.Th>Üye</Table.Th><Table.Th>Görev</Table.Th><Table.Th>Kurul</Table.Th><Table.Th>Oy</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {Object.entries(v.roster).sort(([, a], [, b]) => a.name.localeCompare(b.name, 'tr')).map(([uid, entry]) => {
                const ballot = byUid[uid];
                return (
                  <Table.Tr key={uid}>
                    <Table.Td>{entry.name}{uid === v.chairUid && v.scope !== 'joint' ? <Badge ml={6} size="xs" variant="light">Başkan</Badge> : null}</Table.Td>
                    <Table.Td><Text size="sm">{entry.roleName}</Text><Text size="xs" c="dimmed">{entry.unitName}</Text></Table.Td>
                    <Table.Td>{entry.boards.map((board) => board.toUpperCase().replace('IK', 'İK')).join(' + ')}</Table.Td>
                    <Table.Td>
                      {v.recusedUids.includes(uid) ? <Badge color="gray" variant="outline">Oy kullanamaz</Badge>
                        : ballot ? <Badge color={ballot.choice === 'yes' ? 'green' : ballot.choice === 'no' ? 'red' : 'gray'}>{CHOICE_LABELS[ballot.choice]}</Badge>
                          : <Text size="sm" c="dimmed">—</Text>}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>

      {access.isAdmin && (
        <Group justify="space-between">
          {v.status === 'open' ? <Button color="red" variant="subtle" onClick={cancel}>Oylamayı iptal et</Button> : <span />}
          <Group gap="xs">
            {v.status === 'open' && <Button onClick={close}>Oylamayı kapat</Button>}
            {v.status === 'closed' && !v.decisionId && !recorded && <Button onClick={recordModal.open}>Karar defterine işle</Button>}
            {(v.decisionId || recorded) && <Button component={Link} to="/kurullar?sekme=karar-defteri" variant="default">Karar defterinde görüntüle</Button>}
          </Group>
        </Group>
      )}
      {access.isAdmin && v.status === 'closed' && <RecordVoteModal opened={recordOpened} onClose={recordModal.close} onRecorded={() => setRecorded(true)} vote={{ ...v, id: v.id }} summary={tally.summary} outcome={tally.outcome} />}
    </Stack>
  );
}

function BodyCard({ body }: { body: BodyTally }) {
  const participated = body.yes + body.no + body.abstain;
  const pct = (n: number) => (body.eligible ? (n / body.eligible) * 100 : 0);
  return (
    <Card withBorder padding="sm">
      <Group justify="space-between" mb={6}>
        <Text fw={600}>{body.label}</Text>
        <Badge variant="light" color={OUTCOME_COLORS[body.outcome]}>{OUTCOME_LABELS[body.outcome]}</Badge>
      </Group>
      <Progress.Root size="lg" mb={6}>
        <Progress.Section value={pct(body.yes)} color="green" />
        <Progress.Section value={pct(body.no)} color="red" />
        <Progress.Section value={pct(body.abstain)} color="gray" />
      </Progress.Root>
      <Text size="sm">{body.yes} kabul · {body.no} ret · {body.abstain} çekimser · {body.notVoted} oy kullanmadı</Text>
      <Text size="xs" c="dimmed">
        Tam sayı {body.fullSize} · nisap {body.quorum} (katılım {participated}){body.required !== null ? ` · gereken kabul ${body.required}` : ''}
      </Text>
      {body.notes.map((note) => <Text key={note} size="xs" mt={4}>{note}</Text>)}
    </Card>
  );
}

function RecordVoteModal({ opened, onClose, onRecorded, vote, summary, outcome }: { opened: boolean; onClose: () => void; onRecorded: () => void; vote: WithId<BoardVote>; summary: string; outcome: string }) {
  const [date, setDate] = useState(dayjs(vote.closedAt?.toDate() ?? new Date()).format('YYYY-MM-DD'));
  const [text, setText] = useState(vote.description || vote.title);
  const [chairWord, setChairWord] = useState<string>('');
  const [visibility, setVisibility] = useState<'members' | 'board'>('board');
  const [busy, setBusy] = useState(false);
  const needsChair = outcome === 'tie_chair' || outcome === 'pending';
  const board = vote.scope === 'yk' || vote.scope === 'ik' ? vote.scope : 'joint';
  const decree = vote.isDecree && vote.result?.outcome === 'accepted';

  const submit = async () => {
    setBusy(true);
    try {
      const result = needsChair && chairWord ? `${summary} — YK Başkanının son sözü (Md. 46): ${chairWord}` : summary;
      const { number } = await recordDecision(
        {
          board, kind: decree ? 'decree' : 'decision', date, title: vote.title, text, result, correctsId: null, visibility,
          visibleUids: vote.visibleUids,
          source: { type: 'vote', id: vote.id, label: `Oylama: ${vote.title}`.slice(0, 200) },
        },
        voteDecisionId(vote.id),
      );
      notifySuccess(`Karar ${number} numarasıyla deftere işlendi.`);
      onRecorded();
      onClose();
    } catch (error) {
      notifyError(error, 'Karar işlenemedi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Karar defterine işle" size="lg">
      <Stack>
        <Alert variant="light">{summary}</Alert>
        {decree && <Alert color="grape" variant="light">Kabul edilen YKK, kararname olarak işlenir ve aynı gün Denetleme Kurulu’nun incelemesine sunulmalıdır (Md. 40-EK.b).</Alert>}
        {needsChair && (
          <SegmentedControl
            value={chairWord}
            onChange={setChairWord}
            data={[{ value: '', label: 'Son söz girilmedi' }, { value: 'Kabul', label: 'YK Başkanı: Kabul' }, { value: 'Ret', label: 'YK Başkanı: Ret' }]}
          />
        )}
        <TextInput type="date" label="Karar tarihi" value={date} onChange={(e) => setDate(e.currentTarget.value)} required />
        <Textarea label="Karar metni" autosize minRows={4} maxLength={10000} value={text} onChange={(e) => setText(e.currentTarget.value)} required />
        <SegmentedControl value={visibility} onChange={(value) => setVisibility(value as 'members' | 'board')} data={[{ value: 'board', label: 'Yalnız kurul üyeleri görür' }, { value: 'members', label: 'Tüm aktif üyeler görür' }]} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Vazgeç</Button>
          <Button onClick={() => void submit()} loading={busy} disabled={!text.trim() || !date}>Deftere işle</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
