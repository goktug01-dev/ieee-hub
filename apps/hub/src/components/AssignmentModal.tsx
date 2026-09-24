import { Alert, Button, Checkbox, Group, Modal, Select, Stack, Textarea } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { createAssignments } from '../lib/assignments';
import { dateStringToTs, tsToDateString } from '../lib/format';
import { useCollection } from '../lib/hooks';
import { useOrg } from '../lib/org';
import type { Member } from '../lib/types';
import { BRANCH } from '../lib/types';
import { notifyError, notifySuccess } from './ui';

export function AssignmentModal({
  opened,
  onClose,
  presetUid,
  presetUnitId,
}: {
  opened: boolean;
  onClose: () => void;
  presetUid?: string;
  presetUnitId?: string;
}) {
  const { roles, terms, unitOptions, unitName } = useOrg();
  const { orgSettings } = useAuth();
  const members = useCollection<Member>(opened ? 'members' : null, [where('status', '==', 'active')], 'active-members');

  const [uid, setUid] = useState<string | null>(presetUid ?? null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(presetUnitId ?? null);
  const [termId, setTermId] = useState<string | null>(orgSettings.activeTermId);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (opened) {
      setUid(presetUid ?? null);
      setUnitId(presetUnitId ?? null);
      setTermId(orgSettings.activeTermId);
      setRoleId(null);
      setNote('');
      setReplace(false);
    }
  }, [opened, presetUid, presetUnitId, orgSettings.activeTermId]);

  const role = roles.find((r) => r.id === roleId);
  const term = terms.find((t) => t.id === termId);

  useEffect(() => {
    if (term) {
      setStart(tsToDateString(term.startsAt.toMillis() > Date.now() ? term.startsAt : null) ?? tsToDateString(new Date()));
      setEnd(tsToDateString(term.endsAt));
    } else {
      setStart(tsToDateString(new Date()));
      setEnd(null);
    }
  }, [term]);

  useEffect(() => {
    if (role?.scope === 'branch') setUnitId(BRANCH);
    else if (unitId === BRANCH) setUnitId(presetUnitId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role?.scope]);

  const memberOptions = useMemo(
    () => members.data.map((m) => ({ value: m.uid, label: `${m.displayName} (${m.email})` })),
    [members.data],
  );

  const save = async () => {
    const m = members.data.find((x) => x.uid === uid);
    if (!m || !role || !unitId) return;
    setBusy(true);
    try {
      const res = await createAssignments(
        [
          {
            uid: m.uid,
            memberName: m.displayName,
            roleId: role.id,
            roleName: role.name,
            unitId,
            unitName: unitName(unitId),
            termId,
            startsAt: dateStringToTs(start) ?? dateStringToTs(tsToDateString(new Date()))!,
            endsAt: dateStringToTs(end, true),
            note,
          },
        ],
        { replaceExisting: replace },
      );
      notifySuccess(
        `${m.displayName} → ${role.name}${unitId !== BRANCH ? ` (${unitName(unitId)})` : ''}`,
        res.failed.length ? 'Atandı, ancak bazı erişimler güncellenemedi' : 'Görev atandı',
      );
      onClose();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Görev ata" size="lg">
      <Stack>
        <Select
          label="Kişi"
          placeholder="Üye ara…"
          searchable
          data={memberOptions}
          value={uid}
          onChange={setUid}
          nothingFoundMessage="Aktif üye bulunamadı"
          required
        />
        <Select
          label="Rol"
          data={[
            { group: 'Kol geneli roller', items: roles.filter((r) => r.active && r.scope === 'branch').map((r) => ({ value: r.id, label: r.name })) },
            { group: 'Komite / birim rolleri', items: roles.filter((r) => r.active && r.scope === 'unit').map((r) => ({ value: r.id, label: r.name })) },
          ]}
          value={roleId}
          onChange={setRoleId}
          searchable
          required
        />
        {role?.scope === 'unit' && (
          <Select label="Birim" data={unitOptions()} value={unitId} onChange={setUnitId} searchable required />
        )}
        <Select
          label="Dönem"
          data={terms.map((t) => ({ value: t.id, label: t.name }))}
          value={termId}
          onChange={(v) => setTermId(v)}
          clearable
          allowDeselect
        />
        <Group grow>
          <DateInput label="Başlangıç" valueFormat="DD.MM.YYYY" value={start} onChange={setStart} />
          <DateInput label="Bitiş" description="Boşsa süresiz" valueFormat="DD.MM.YYYY" value={end} onChange={setEnd} clearable />
        </Group>
        <Textarea label="Not" placeholder="örn. YK kararı 2026/14" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        <Checkbox
          checked={replace}
          onChange={(e) => setReplace(e.currentTarget.checked)}
          label="Bu roldeki mevcut görevlileri (aynı birimde) sonlandır"
          description="Örn. yeni başkan atanırken eski başkanın görevi biter."
        />
        {role?.permissions.length ? (
          <Alert color="yellow" variant="light">
            Bu rol yönetim yetkileri içerir. Atama denetim kaydına yazılır.
          </Alert>
        ) : null}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Vazgeç
          </Button>
          <Button onClick={save} loading={busy} disabled={!uid || !roleId || !unitId}>
            Ata
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
