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

  const locked = draft.status === 'applied';
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
      positions: [...draft.positions, { key: `${Date.now()}`, roleId: role.id, unitId, candidates: [], winnerUid: null }],
    });
    setNewPos({ roleId: null, unitId: null });
  };

  const save = async () => {
    setBusy(true);
    try {
      const { title, termId, date, description, positions, eligibleVoters, totalVotes, status } = draft;
      await updateDoc(doc(db, 'elections', id!), {
        title,
        termId,
        date,
        description: description ?? '',
        positions,
        eligibleVoters: eligibleVoters ?? null,
        totalVotes: totalVotes ?? null,
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

  const autoWinners = () =>
    update({
      positions: draft.positions.map((p) => {
        const sorted = [...p.candidates].sort((a, b) => b.votes - a.votes);
        const tie = sorted.length > 1 && sorted[0].votes === sorted[1].votes;
        return { ...p, winnerUid: sorted.length && !tie ? sorted[0].uid : p.winnerUid };
      }),
      status: 'completed',
    });

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

      {locked && (
        <Alert color="green" icon={<IconCheck size={18} />}>
          Bu seçimin sonuçları görev atamalarına işlendi. Değişiklik gerekiyorsa Görev atamaları ekranını kullanın.
        </Alert>
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
          <Group grow>
            <NumberInput label="Oy kullanma hakkı olan" value={draft.eligibleVoters ?? ''} onChange={(v) => update({ eligibleVoters: v === '' ? null : Number(v) })} disabled={locked} min={0} />
            <NumberInput label="Kullanılan oy" value={draft.totalVotes ?? ''} onChange={(v) => update({ totalVotes: v === '' ? null : Number(v) })} disabled={locked} min={0} />
          </Group>
          <Textarea label="Açıklama / tutanak notu" autosize minRows={2} value={draft.description ?? ''} onChange={(e) => update({ description: e.currentTarget.value })} disabled={locked} />
        </Stack>
      </Card>

      <Group justify="space-between">
        <Title order={4}>Pozisyonlar ve adaylar</Title>
        {!locked && draft.positions.length > 0 && (
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
            {!locked && (
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
            disabled={locked}
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
        </Card>
      ))}

      {!locked && (
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

      {!locked && draft.positions.some((p) => p.winnerUid) && (
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
