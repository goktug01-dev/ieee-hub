import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  MultiSelect,
  NumberInput,
  Radio,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { modals } from '@mantine/modals';
import { IconArrowLeft, IconCheck, IconPlus, IconTrash, IconTrophy } from '@tabler/icons-react';
import { deleteDoc, doc, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { db } from '../../firebase';
import { createAssignments } from '../../lib/assignments';
import { logAudit } from '../../lib/audit';
import { dateStringToTs, tsToDateString } from '../../lib/format';
import { useCollection, useDoc } from '../../lib/hooks';
import { useOrg } from '../../lib/org';
import type { Election, ElectionPosition, Member } from '../../lib/types';
import { BRANCH } from '../../lib/types';
import { ELECTION_STATUS } from './ElectionsPage';

const ELECTION_TYPES = [
  { value: 'general_assembly', label: 'Olağan / olağanüstü genel kurul' },
  { value: 'board', label: 'Yönetim kurulu içi seçim' },
  { value: 'unit', label: 'Komite / birim seçimi' },
  { value: 'by_election', label: 'Ara seçim' },
];

const VOTING_METHODS = [
  { value: 'secret_ballot', label: 'Gizli oy, açık sayım (fiziksel)' },
  { value: 'open_vote', label: 'Açık oylama' },
  { value: 'appointment', label: 'Atama / oy kullanılmadı' },
];

function electionIssues(e: Election): string[] {
  const issues: string[] = [];
  if (!e.termId) issues.push('Dönem seçilmedi.');
  if (!e.date) issues.push('Seçim tarihi girilmedi.');
  if (!e.positions.length) issues.push('En az bir pozisyon eklenmeli.');
  if (e.eligibleVoters != null && e.totalVotes != null && e.totalVotes > e.eligibleVoters) issues.push('Kullanılan oy, seçmen sayısından fazla.');
  if (e.quorumRequired != null && e.totalVotes != null && e.totalVotes < e.quorumRequired) issues.push('Toplantı/seçim nisabı sağlanmadı.');
  e.positions.forEach((p, index) => {
    if (!p.candidates.length) issues.push(`${index + 1}. pozisyonda aday yok.`);
    const counted = p.candidates.reduce((sum, c) => sum + c.votes, 0) + (p.blankVotes ?? 0) + (p.invalidVotes ?? 0);
    if (e.votingMethod !== 'appointment' && e.totalVotes != null && counted !== e.totalVotes) {
      issues.push(`${index + 1}. pozisyonda aday + boş + geçersiz oy toplamı ${counted}; kullanılan oy ${e.totalVotes}.`);
    }
    const sortedVotes = p.candidates.map((candidate) => candidate.votes).sort((a, b) => b - a);
    if (p.winnerUid && sortedVotes.length > 1 && sortedVotes[0] === sortedVotes[1] && !p.tieBreakNote?.trim()) {
      issues.push(`${index + 1}. pozisyonda eşitlik var; ikinci tur / kura / kurul kararı notu zorunlu.`);
    }
    if (['completed', 'applied'].includes(e.status) && !p.winnerUid) issues.push(`${index + 1}. pozisyonun kazananı belirlenmedi.`);
    if (p.winnerUid && !p.candidates.some((c) => c.uid === p.winnerUid)) issues.push(`${index + 1}. pozisyonun kazananı aday listesinde değil.`);
  });
  return issues;
}

export function ElectionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { roles, terms, unitOptions, unitName, roleName } = useOrg();
  const { data: election, loading } = useDoc<Election>(`elections/${id}`);
  const members = useCollection<Member>('members', [where('status', '==', 'active')], 'active-members');
  const [draft, setDraft] = useState<Election | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [replace, setReplace] = useState(true);
  const [newPos, setNewPos] = useState<{ roleId: string | null; unitId: string | null }>({ roleId: null, unitId: null });

  useEffect(() => {
    if (election && !dirty) setDraft(election);
  }, [election, dirty]);

  if (loading || !draft) return loading ? <SectionLoader /> : <EmptyState title="Seçim bulunamadı" />;

  const locked = ['completed', 'applied', 'cancelled'].includes(draft.status);
  const setupLocked = ['voting', 'completed', 'applied', 'cancelled'].includes(draft.status);
  const issues = electionIssues(draft);
  const memberName = (uid: string) => members.data.find((m) => m.uid === uid)?.displayName ?? uid;
  const update = (patch: Partial<Election>) => {
    setDraft({ ...draft, ...patch });
    setDirty(true);
  };
  const updatePos = (key: string, patch: Partial<ElectionPosition>) =>
    update({ positions: draft.positions.map((p) => (p.key === key ? { ...p, ...patch } : p)) });

  const addPosition = () => {
    const role = roles.find((r) => r.id === newPos.roleId);
    if (!role) return;
    const unitId = role.scope === 'branch' ? BRANCH : newPos.unitId;
    if (!unitId) return;
    update({
      positions: [...draft.positions, { key: `${Date.now()}`, roleId: role.id, unitId, candidates: [], winnerUid: null, blankVotes: 0, invalidVotes: 0, tieBreakNote: '' }],
    });
    setNewPos({ roleId: null, unitId: null });
  };

  const save = async () => {
    setBusy(true);
    try {
      const {
        title, termId, date, description, positions, eligibleVoters, totalVotes, quorumRequired, status,
        electionType, votingMethod, minutesUrl, decisionNo, electionChair, electionClerk, resultNote,
      } = draft;
      await updateDoc(doc(db, 'elections', id!), {
        title,
        termId,
        date,
        description: description ?? '',
        positions,
        eligibleVoters: eligibleVoters ?? null,
        totalVotes: totalVotes ?? null,
        quorumRequired: quorumRequired ?? null,
        electionType: electionType ?? 'general_assembly',
        votingMethod: votingMethod ?? 'secret_ballot',
        minutesUrl: minutesUrl ?? '',
        decisionNo: decisionNo ?? '',
        electionChair: electionChair ?? '',
        electionClerk: electionClerk ?? '',
        resultNote: resultNote ?? '',
        status,
        updatedAt: serverTimestamp(),
      });
      setDirty(false);
      notifySuccess('Seçim kaydedildi.');
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  const autoWinners = () => {
    const baseIssues = electionIssues({ ...draft, status: 'voting' });
    if (baseIssues.length) return notifyError(new Error(baseIssues.join('\n')), 'Sonuçlar kesinleştirilemedi');
    const positions = draft.positions.map((p) => {
        const sorted = [...p.candidates].sort((a, b) => b.votes - a.votes);
        const tie = sorted.length > 1 && sorted[0].votes === sorted[1].votes;
        return { ...p, winnerUid: sorted.length && !tie ? sorted[0].uid : p.winnerUid };
    });
    const unresolved = positions.filter((p) => !p.winnerUid);
    update({ positions, status: unresolved.length ? 'voting' : 'completed' });
    if (unresolved.length) notifyError(new Error('Eşit oy bulunan pozisyonlarda kazananı seçin, eşitlik çözüm notunu yazın ve yeniden kesinleştirin.'), 'Eşitlik var');
  };

  const apply = () => {
    const winners = draft.positions.filter((p) => p.winnerUid);
    if (!winners.length) return notifyError(new Error('Kazananı belirlenmiş pozisyon yok.'));
    const term = terms.find((t) => t.id === draft.termId);
    modals.openConfirmModal({
      title: 'Sonuçlar görevlere işlensin mi?',
      children: (
        <Stack gap={4}>
          {winners.map((p) => (
            <Text size="sm" key={p.key}>
              <b>{memberName(p.winnerUid!)}</b> → {roleName(p.roleId)}
              {p.unitId !== BRANCH ? ` (${unitName(p.unitId)})` : ''}
            </Text>
          ))}
          <Text size="sm" c="dimmed" mt="xs">
            {term ? `Görev süresi: ${term.name}. ` : ''}
            {replace ? 'Aynı roldeki mevcut görevliler sonlandırılır.' : 'Mevcut görevliler korunur.'}
          </Text>
        </Stack>
      ),
      labels: { confirm: 'Görevlere işle', cancel: 'Vazgeç' },
      onConfirm: async () => {
        setBusy(true);
        try {
          if (dirty) await save();
          const now = dateStringToTs(tsToDateString(new Date()))!;
          await createAssignments(
            winners.map((p) => ({
              uid: p.winnerUid!,
              memberName: memberName(p.winnerUid!),
              roleId: p.roleId,
              roleName: roleName(p.roleId),
              unitId: p.unitId,
              unitName: unitName(p.unitId),
              termId: draft.termId,
              startsAt: term && term.startsAt.toMillis() > Date.now() ? term.startsAt : now,
              endsAt: term?.endsAt ?? null,
              note: draft.title,
              source: 'election',
              electionId: id!,
            })),
            { replaceExisting: replace },
          );
          await updateDoc(doc(db, 'elections', id!), { status: 'applied', appliedAt: serverTimestamp(), updatedAt: serverTimestamp() });
          await logAudit('election.apply', `elections/${id}`, { title: draft.title, positions: winners.length });
          notifySuccess(`${winners.length} görev ataması yapıldı.`, 'Seçim sonuçları işlendi');
        } catch (e) {
          notifyError(e);
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const remove = () =>
    modals.openConfirmModal({
      title: 'Seçim kaydı silinsin mi?',
      labels: { confirm: 'Sil', cancel: 'Vazgeç' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'elections', id!));
          await logAudit('election.delete', `elections/${id}`, { title: draft.title });
          navigate('/yonetim/secimler');
        } catch (e) {
          notifyError(e);
        }
      },
    });

  const memberOptions = members.data.map((m) => ({ value: m.uid, label: m.displayName }));
  const newRole = roles.find((r) => r.id === newPos.roleId);

  return (
    <Stack>
      <Anchor component={Link} to="/yonetim/secimler" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} /> Seçimler
        </Group>
      </Anchor>
      <Group justify="space-between" wrap="wrap">
        <Group gap="sm">
          <Title order={2}>{draft.title}</Title>
          <Badge color={ELECTION_STATUS[draft.status].color}>{ELECTION_STATUS[draft.status].label}</Badge>
        </Group>
        <Group gap="xs">
          {!locked && (
            <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={remove}>
              Sil
            </Button>
          )}
          <Button onClick={save} loading={busy} disabled={!dirty} variant={dirty ? 'filled' : 'default'}>
            {dirty ? 'Değişiklikleri kaydet' : 'Kaydedildi'}
          </Button>
        </Group>
      </Group>

      {draft.status === 'applied' && (
        <Alert color="green" icon={<IconCheck size={18} />}>
          Bu seçimin sonuçları görev atamalarına işlendi. Değişiklik gerekiyorsa Görev atamaları ekranını kullanın.
        </Alert>
      )}
      {draft.status === 'cancelled' && <Alert color="red">Bu seçim iptal edildi; kayıt denetim izi için korunuyor.</Alert>}

      {!locked && (
        <Card>
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={600}>Seçim aşaması</Text>
              <Text size="sm" c="dimmed">Aday listesi oylama başlayınca, oy sayıları sonuç kesinleşince kilitlenir.</Text>
            </div>
            <Group gap="xs">
              {draft.status === 'draft' && <Button variant="light" onClick={() => update({ status: 'nominations' })}>Adaylık sürecini aç</Button>}
              {draft.status === 'nominations' && <Button color="orange" onClick={() => update({ status: 'voting' })} disabled={!draft.positions.length}>Adaylıkları kapat, oylamaya geç</Button>}
              {draft.status === 'voting' && <Button color="blue" leftSection={<IconTrophy size={16} />} onClick={autoWinners}>Sayımı doğrula ve sonucu kesinleştir</Button>}
              {['draft', 'nominations', 'voting'].includes(draft.status) && <Button variant="subtle" color="red" onClick={() => update({ status: 'cancelled' })}>İptal et</Button>}
            </Group>
          </Group>
        </Card>
      )}

      <Card>
        <Stack>
          <Group grow wrap="wrap">
            <TextInput label="Başlık" value={draft.title} onChange={(e) => update({ title: e.currentTarget.value })} disabled={locked} />
            <Select label="Dönem" data={terms.map((t) => ({ value: t.id, label: t.name }))} value={draft.termId} onChange={(v) => update({ termId: v })} disabled={locked} />
            <DateInput
              label="Tarih"
              valueFormat="DD.MM.YYYY"
              value={tsToDateString(draft.date)}
              onChange={(v) => update({ date: dateStringToTs(v) })}
              disabled={locked}
            />
          </Group>
          <Group grow wrap="wrap">
            <Select label="Seçim türü" data={ELECTION_TYPES} value={draft.electionType ?? 'general_assembly'} onChange={(v) => update({ electionType: (v ?? 'general_assembly') as Election['electionType'] })} disabled={setupLocked} />
            <Select label="Oylama yöntemi" data={VOTING_METHODS} value={draft.votingMethod ?? 'secret_ballot'} onChange={(v) => update({ votingMethod: (v ?? 'secret_ballot') as Election['votingMethod'] })} disabled={setupLocked} />
          </Group>
          <Group grow>
            <NumberInput label="Oy kullanma hakkı olan" value={draft.eligibleVoters ?? ''} onChange={(v) => update({ eligibleVoters: v === '' ? null : Number(v) })} disabled={locked} min={0} />
            <NumberInput label="Kullanılan oy" value={draft.totalVotes ?? ''} onChange={(v) => update({ totalVotes: v === '' ? null : Number(v) })} disabled={locked} min={0} />
            <NumberInput label="Gerekli nisap" value={draft.quorumRequired ?? ''} onChange={(v) => update({ quorumRequired: v === '' ? null : Number(v) })} disabled={locked} min={0} />
          </Group>
          <Group grow wrap="wrap">
            <TextInput label="Divan / seçim kurulu başkanı" value={draft.electionChair ?? ''} onChange={(e) => update({ electionChair: e.currentTarget.value })} disabled={locked} />
            <TextInput label="Katip / sayım sorumlusu" value={draft.electionClerk ?? ''} onChange={(e) => update({ electionClerk: e.currentTarget.value })} disabled={locked} />
          </Group>
          <Group grow wrap="wrap">
            <TextInput label="Karar / tutanak numarası" value={draft.decisionNo ?? ''} onChange={(e) => update({ decisionNo: e.currentTarget.value })} disabled={locked} />
            <TextInput label="İmzalı tutanak / Drive bağlantısı" value={draft.minutesUrl ?? ''} onChange={(e) => update({ minutesUrl: e.currentTarget.value })} disabled={locked} />
          </Group>
          <Textarea label="Açıklama / tutanak notu" autosize minRows={2} value={draft.description ?? ''} onChange={(e) => update({ description: e.currentTarget.value })} disabled={locked} />
          <Textarea label="Sonuç ve eşitlik çözüm notu" autosize minRows={2} value={draft.resultNote ?? ''} onChange={(e) => update({ resultNote: e.currentTarget.value })} disabled={locked} />
        </Stack>
      </Card>

      {issues.length > 0 && (
        <Alert color="orange" title="Seçim kaydındaki kontroller">
          {issues.map((issue) => <div key={issue}>{issue}</div>)}
        </Alert>
      )}

      <Group justify="space-between">
        <Title order={4}>Pozisyonlar ve adaylar</Title>
        {draft.status === 'voting' && draft.positions.length > 0 && (
          <Button variant="light" leftSection={<IconTrophy size={16} />} onClick={autoWinners}>
            En çok oy alanı kazanan yap
          </Button>
        )}
      </Group>

      {draft.positions.map((p) => (
        <Card key={p.key}>
          <Group justify="space-between" mb="sm">
            <div>
              <Text fw={600}>{roleName(p.roleId)}</Text>
              <Text size="sm" c="dimmed">
                {unitName(p.unitId)}
              </Text>
            </div>
            {!setupLocked && (
              <ActionIcon variant="subtle" color="red" onClick={() => update({ positions: draft.positions.filter((x) => x.key !== p.key) })} aria-label="Pozisyonu kaldır">
                <IconTrash size={16} />
              </ActionIcon>
            )}
          </Group>
          <MultiSelect
            label="Adaylar"
            placeholder="Aday ekle…"
            searchable
            data={memberOptions}
            value={p.candidates.map((c) => c.uid)}
            onChange={(uids) =>
              updatePos(p.key, {
                candidates: uids.map((uid) => p.candidates.find((c) => c.uid === uid) ?? { uid, name: memberName(uid), votes: 0 }),
                winnerUid: uids.includes(p.winnerUid ?? '') ? p.winnerUid : null,
              })
            }
            disabled={setupLocked}
            mb="sm"
          />
          {p.candidates.length > 0 && (
            <Radio.Group value={p.winnerUid ?? ''} onChange={(v) => updatePos(p.key, { winnerUid: v || null })}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Aday</Table.Th>
                    <Table.Th w={140}>Oy</Table.Th>
                    <Table.Th w={100}>Kazanan</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {p.candidates.map((c) => (
                    <Table.Tr key={c.uid}>
                      <Table.Td>{c.name}</Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="xs"
                          min={0}
                          value={c.votes}
                          disabled={locked}
                          onChange={(v) =>
                            updatePos(p.key, { candidates: p.candidates.map((x) => (x.uid === c.uid ? { ...x, votes: Number(v) || 0 } : x)) })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <Radio value={c.uid} disabled={locked} aria-label="Kazanan" />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Radio.Group>
          )}
          {p.candidates.length > 0 && draft.votingMethod !== 'appointment' && (
            <Group grow mt="sm">
              <NumberInput label="Boş oy" min={0} value={p.blankVotes ?? 0} disabled={locked} onChange={(v) => updatePos(p.key, { blankVotes: Number(v) || 0 })} />
              <NumberInput label="Geçersiz oy" min={0} value={p.invalidVotes ?? 0} disabled={locked} onChange={(v) => updatePos(p.key, { invalidVotes: Number(v) || 0 })} />
            </Group>
          )}
          {p.candidates.length > 1 && (
            <TextInput mt="sm" label="Eşitlik / ikinci tur açıklaması" value={p.tieBreakNote ?? ''} disabled={locked} onChange={(e) => updatePos(p.key, { tieBreakNote: e.currentTarget.value })} />
          )}
        </Card>
      ))}

      {!setupLocked && (
        <Card>
          <Text fw={600} mb="sm">
            Pozisyon ekle
          </Text>
          <Group align="flex-end" wrap="wrap">
            <Select
              label="Rol"
              data={roles.filter((r) => r.active).map((r) => ({ value: r.id, label: `${r.name}${r.scope === 'unit' ? ' (birim)' : ''}` }))}
              value={newPos.roleId}
              onChange={(v) => setNewPos({ ...newPos, roleId: v })}
              searchable
              w={260}
            />
            {newRole?.scope === 'unit' && (
              <Select label="Birim" data={unitOptions()} value={newPos.unitId} onChange={(v) => setNewPos({ ...newPos, unitId: v })} searchable w={260} />
            )}
            <Button leftSection={<IconPlus size={16} />} variant="light" onClick={addPosition} disabled={!newRole || (newRole.scope === 'unit' && !newPos.unitId)}>
              Ekle
            </Button>
          </Group>
        </Card>
      )}

      {draft.status === 'completed' && draft.positions.every((p) => p.winnerUid) && (
        <Card style={{ borderColor: 'var(--mantine-color-green-5)', borderWidth: 2 }}>
          <Stack>
            <Text fw={600}>Sonuçları görevlere işle</Text>
            <Checkbox checked={replace} onChange={(e) => setReplace(e.currentTarget.checked)} label="Aynı roldeki mevcut görevlileri sonlandır (görev devri)" />
            {!can('assignments.manage') && (
              <Alert color="yellow">
                Kazananların yetkilerinin etkinleşmesi için "Görev atamalarını yönet" yetkisi gerekir. Sonuçları işledikten sonra bu
                yetkiye sahip biri Görev atamaları ekranında "Erişimleri yenile"ye basmalıdır.
              </Alert>
            )}
            <Group>
              <Button color="green" leftSection={<IconCheck size={16} />} onClick={apply} loading={busy}>
                Görevlere işle
              </Button>
            </Group>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
