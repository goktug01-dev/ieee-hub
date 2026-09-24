import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconLock, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  orderBy,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { MetaBadge } from '../../components/MetaBadge';
import { EmptyState, PageHeader, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { db } from '../../firebase';
import { hasPermission } from '../../lib/access';
import { fmtDate, fmtRelative } from '../../lib/format';
import { useCollection, useDoc } from '../../lib/hooks';
import { useActiveMembers } from '../../lib/members';
import { sponsorLockKey } from '../../lib/ops';
import { ACTIVE_SPONSOR_STAGES, SPONSOR_STAGE } from '../../lib/opsLabels';
import type { Sponsor, SponsorContact, SponsorContactRequest, SponsorInteraction, SponsorStage } from '../../lib/opsTypes';
import { useOrg } from '../../lib/org';
import type { WithId } from '../../lib/types';

const STAGES = Object.keys(SPONSOR_STAGE) as SponsorStage[];

export function SponsorsPage() {
  const { access, user } = useAuth();
  const canRead = hasPermission(access, 'sponsors.read') || hasPermission(access, 'sponsors.manage');
  const canManage = hasPermission(access, 'sponsors.manage');
  const all = useCollection<Sponsor>(canRead ? 'sponsors' : null, [orderBy('companyName')], 'sponsors');
  const own = useCollection<Sponsor>('sponsors', [where('ownerUid', '==', user!.uid)], `own-${user!.uid}`);
  const incoming = useCollection<SponsorContactRequest>('sponsorContactRequests', [where('ownerUid', '==', user!.uid)], `in-${user!.uid}`);
  const [tab, setTab] = useState<string | null>(canRead ? 'havuz' : 'sorgula');
  const [sel, setSel] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const list = canRead ? all.data : own.data;
  const selected = [...all.data, ...own.data].find((s) => s.id === sel) ?? null;
  const openIncoming = incoming.data.filter((r) => r.status === 'open');

  return (
    <Stack>
      <PageHeader
        title="Sponsorluk"
        description="Sponsor havuzu, görüşme geçmişi ve sponsor kilidi. Aynı firmayla birden çok kişinin görüşmesini önlemek için firmanın bir sorumlusu vardır."
        actions={
          canManage && (
            <Button leftSection={<IconPlus size={18} />} onClick={() => setNewOpen(true)}>
              Sponsor ekle
            </Button>
          )
        }
      />
      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List mb="md">
          {(canRead || own.data.length > 0) && <Tabs.Tab value="havuz">{canRead ? 'Havuz' : 'Sorumlu olduğum firmalar'}</Tabs.Tab>}
          <Tabs.Tab value="sorgula">Firma sorgula</Tabs.Tab>
          <Tabs.Tab value="talepler" rightSection={openIncoming.length ? <Badge size="xs" color="red" circle>{openIncoming.length}</Badge> : null}>
            İletişim talepleri
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="havuz">
          {all.loading && canRead ? (
            <SectionLoader />
          ) : list.length === 0 ? (
            <EmptyState title="Sponsor kaydı yok" />
          ) : (
            <ScrollArea type="auto" offsetScrollbars>
              <Group align="flex-start" wrap="nowrap">
                {STAGES.map((s) => {
                  const col = list.filter((x) => x.stage === s);
                  return (
                    <Paper key={s} withBorder p="sm" w={230} miw={210} bg="var(--mantine-color-default-hover)">
                      <Group justify="space-between" mb="xs">
                        <MetaBadge map={SPONSOR_STAGE} value={s} />
                        <Text size="sm" c="dimmed">
                          {col.length}
                        </Text>
                      </Group>
                      <Stack gap="xs">
                        {col.map((sp) => {
                          const overdue = sp.nextActionDate && new Date(sp.nextActionDate).getTime() < Date.now() - 864e5;
                          const missing = ACTIVE_SPONSOR_STAGES.includes(sp.stage) && !sp.nextActionDate;
                          return (
                            <Card key={sp.id} padding="xs" radius="md" onClick={() => setSel(sp.id)} style={{ cursor: 'pointer' }}>
                              <Text size="sm" fw={600}>
                                {sp.companyName}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {sp.ownerName}
                              </Text>
                              {sp.nextActionDate && (
                                <Text size="xs" c={overdue ? 'red' : 'dimmed'}>
                                  {fmtDate(new Date(sp.nextActionDate))}: {sp.nextAction}
                                </Text>
                              )}
                              {missing && (
                                <Badge size="xs" color="orange" mt={4}>
                                  Sonraki işlem yok
                                </Badge>
                              )}
                            </Card>
                          );
                        })}
                      </Stack>
                    </Paper>
                  );
                })}
              </Group>
            </ScrollArea>
          )}
        </Tabs.Panel>
        <Tabs.Panel value="sorgula">
          <LockLookup />
        </Tabs.Panel>
        <Tabs.Panel value="talepler">
          <ContactRequests incoming={incoming.data} />
        </Tabs.Panel>
      </Tabs>
      <SponsorModal opened={newOpen} onClose={() => setNewOpen(false)} />
      <SponsorDrawer s={selected} onClose={() => setSel(null)} />
    </Stack>
  );
}

function LockLookup() {
  const { user, access } = useAuth();
  const { unitName } = useOrg();
  const [name, setName] = useState('');
  const [res, setRes] = useState<null | { found: false } | { found: true; companyName: string; ownerName: string; ownerUid: string; key: string }>(null);
  const [msg, setMsg] = useState('');
  const mine = useCollection<SponsorContactRequest>('sponsorContactRequests', [where('byUid', '==', user!.uid)], `by-${user!.uid}`);

  const check = async () => {
    const key = sponsorLockKey(name);
    const s = await getDoc(doc(db, 'sponsorLocks', key));
    setRes(s.exists() ? { found: true, key, ...(s.data() as { companyName: string; ownerName: string; ownerUid: string }) } : { found: false });
  };

  const request = async () => {
    if (!res || !res.found || !msg.trim()) return;
    try {
      const unit = Object.keys(access?.memberOf ?? {})[0];
      await addDoc(collection(db, 'sponsorContactRequests'), {
        lockKey: res.key,
        companyName: res.companyName,
        ownerUid: res.ownerUid,
        ownerName: res.ownerName,
        byUid: user!.uid,
        byName: user!.displayName ?? '',
        unitName: unit ? unitName(unit) : '',
        message: msg,
        status: 'open',
        createdAt: serverTimestamp(),
      });
      notifySuccess(`${res.ownerName} kişisine iletildi.`, 'İletişim talebi gönderildi');
      setMsg('');
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
      <Card>
        <Stack>
          <Text fw={600}>Bu firmayla görüşen var mı?</Text>
          <Text size="sm" c="dimmed">
            Bir firmayla iletişime geçmeden önce sorgulayın. Firmanın sorumlusu varsa doğrudan iletişime geçmek yerine sorumluya talep gönderin.
          </Text>
          <Group align="flex-end">
            <TextInput label="Firma adı" style={{ flex: 1 }} value={name} onChange={(e) => setName(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && void check()} />
            <Button leftSection={<IconSearch size={16} />} onClick={() => void check()} disabled={!name.trim()}>
              Sorgula
            </Button>
          </Group>
          {res && !res.found && (
            <Alert color="green">Kayıtlı sorumlu yok. Görüşmeye başlamadan önce Sponsorluk Sorumlusuna bildirin ki firma havuza eklensin.</Alert>
          )}
          {res && res.found && (
            <Alert color="yellow" icon={<IconLock size={18} />} title={`${res.companyName} kilitli`}>
              <Stack gap="xs">
                <Text size="sm">Firmanın sorumlusu: {res.ownerName}. İletişim bilgileri yalnızca sorumlu ve sponsorluk yöneticilerinde.</Text>
                <Textarea placeholder="Neden iletişime geçmek istiyorsunuz? (etkinlik, tarih, talep)" value={msg} onChange={(e) => setMsg(e.currentTarget.value)} />
                <Button size="xs" onClick={() => void request()} disabled={!msg.trim()}>
                  Sorumluya talep gönder
                </Button>
              </Stack>
            </Alert>
          )}
        </Stack>
      </Card>
      <Card>
        <Text fw={600} mb="sm">
          Gönderdiğim talepler
        </Text>
        {mine.data.length === 0 ? (
          <Text size="sm" c="dimmed">
            Talep yok.
          </Text>
        ) : (
          mine.data.map((r) => (
            <Group key={r.id} justify="space-between" mb="xs" wrap="nowrap">
              <div>
                <Text size="sm">{r.companyName}</Text>
                <Text size="xs" c="dimmed">
                  {r.ownerName} · {fmtRelative(r.createdAt)}
                  {r.response ? ` · “${r.response}”` : ''}
                </Text>
              </div>
              <Badge color={r.status === 'open' ? 'yellow' : r.status === 'approved' ? 'green' : 'red'}>
                {r.status === 'open' ? 'Bekliyor' : r.status === 'approved' ? 'Uygun' : 'Uygun değil'}
              </Badge>
            </Group>
          ))
        )}
      </Card>
    </SimpleGrid>
  );
}

function ContactRequests({ incoming }: { incoming: WithId<SponsorContactRequest>[] }) {
  const [resp, setResp] = useState<Record<string, string>>({});
  if (!incoming.length) return <EmptyState title="Size gelen iletişim talebi yok" />;
  const answer = (r: WithId<SponsorContactRequest>, status: 'approved' | 'declined') =>
    updateDoc(doc(db, 'sponsorContactRequests', r.id), { status, response: resp[r.id] ?? '', respondedAt: serverTimestamp() })
      .then(() => notifySuccess('Yanıt gönderildi.'))
      .catch(notifyError);
  return (
    <Stack>
      {incoming.map((r) => (
        <Card key={r.id}>
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <div style={{ flex: '1 1 300px' }}>
              <Text fw={600}>
                {r.companyName} · {r.byName} {r.unitName ? `(${r.unitName})` : ''}
              </Text>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {r.message}
              </Text>
              <Text size="xs" c="dimmed">
                {fmtRelative(r.createdAt)}
              </Text>
            </div>
            {r.status === 'open' ? (
              <Stack gap="xs" w={280}>
                <TextInput placeholder="Yanıt" value={resp[r.id] ?? ''} onChange={(e) => setResp({ ...resp, [r.id]: e.currentTarget.value })} />
                <Group grow>
                  <Button size="xs" color="green" onClick={() => void answer(r, 'approved')}>
                    Uygun
                  </Button>
                  <Button size="xs" variant="light" color="red" onClick={() => void answer(r, 'declined')}>
                    Uygun değil
                  </Button>
                </Group>
              </Stack>
            ) : (
              <Badge color={r.status === 'approved' ? 'green' : 'red'}>{r.status === 'approved' ? 'Uygun' : 'Uygun değil'}</Badge>
            )}
          </Group>
        </Card>
      ))}
    </Stack>
  );
}

const EMPTY_SPONSOR = { companyName: '', sector: '', website: '', stage: 'prospect' as SponsorStage, ownerUid: '', nextActionDate: null as string | null, nextAction: '', proposalLinks: '', amount: null as number | null, notes: '' };

function SponsorModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { options, nameOf } = useActiveMembers(opened);
  const [f, setF] = useState(EMPTY_SPONSOR);
  const save = async () => {
    if (!f.companyName.trim() || !f.ownerUid) return notifyError(new Error('Firma adı ve sorumlu zorunludur.'), 'Eksik bilgi');
    const key = sponsorLockKey(f.companyName);
    if ((await getDoc(doc(db, 'sponsorLocks', key))).exists()) return notifyError(new Error('Bu firma zaten havuzda.'));
    try {
      const ref = doc(collection(db, 'sponsors'));
      const batch = writeBatch(db);
      batch.set(ref, { ...f, lockKey: key, ownerName: nameOf(f.ownerUid), eventIds: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      batch.set(doc(db, 'sponsorLocks', key), { companyName: f.companyName, ownerUid: f.ownerUid, ownerName: nameOf(f.ownerUid), sponsorId: ref.id });
      await batch.commit();
      notifySuccess('Sponsor havuza eklendi ve sorumluya kilitlendi.');
      setF(EMPTY_SPONSOR);
      onClose();
    } catch (e) {
      notifyError(e);
    }
  };
  return (
    <Modal opened={opened} onClose={onClose} title="Sponsor ekle">
      <Stack>
        <TextInput label="Firma adı" required value={f.companyName} onChange={(e) => setF({ ...f, companyName: e.currentTarget.value })} />
        <Group grow>
          <TextInput label="Sektör" value={f.sector} onChange={(e) => setF({ ...f, sector: e.currentTarget.value })} />
          <TextInput label="Web sitesi" value={f.website} onChange={(e) => setF({ ...f, website: e.currentTarget.value })} />
        </Group>
        <Select label="Sponsor sorumlusu (tek kişi)" required data={options} value={f.ownerUid || null} onChange={(v) => setF({ ...f, ownerUid: v ?? '' })} searchable />
        <Group justify="flex-end">
          <Button onClick={save}>Ekle</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function SponsorDrawer({ s, onClose }: { s: WithId<Sponsor> | null; onClose: () => void }) {
  const { access, user } = useAuth();
  const canManage = hasPermission(access, 'sponsors.manage');
  const isOwner = s?.ownerUid === user?.uid;
  const canEdit = canManage || isOwner;
  const { options, nameOf } = useActiveMembers(!!s && canManage);
  const [f, setF] = useState<WithId<Sponsor> | null>(s);
  useEffect(() => setF(s), [s]);
  const interactions = useCollection<SponsorInteraction>(s ? `sponsors/${s.id}/interactions` : null, [orderBy('date', 'desc')], s?.id ?? '');
  const contacts = useDoc<{ list: SponsorContact[] }>(s && canEdit ? `sponsors/${s.id}/private/contacts` : null);
  const [it, setIt] = useState({ date: new Date().toISOString().slice(0, 10) as string | null, channel: 'E-posta', summary: '', nextAction: '' });
  const [cList, setCList] = useState<SponsorContact[]>([]);
  useEffect(() => setCList(contacts.data?.list ?? []), [contacts.data]);
  if (!s || !f) return null;

  const save = async () => {
    try {
      const ownerChanged = f.ownerUid !== s.ownerUid;
      await updateDoc(doc(db, 'sponsors', s.id), {
        stage: f.stage,
        sector: f.sector,
        website: f.website,
        nextActionDate: f.nextActionDate,
        nextAction: f.nextAction,
        proposalLinks: f.proposalLinks,
        amount: f.amount,
        notes: f.notes,
        ...(canManage ? { ownerUid: f.ownerUid, ownerName: nameOf(f.ownerUid) } : {}),
        updatedAt: serverTimestamp(),
      });
      if (canManage && ownerChanged) {
        await setDoc(doc(db, 'sponsorLocks', s.lockKey), { companyName: s.companyName, ownerUid: f.ownerUid, ownerName: nameOf(f.ownerUid), sponsorId: s.id });
      }
      notifySuccess('Kaydedildi.');
    } catch (e) {
      notifyError(e);
    }
  };

  const addInteraction = async () => {
    if (!it.summary.trim() || !it.date) return;
    try {
      await addDoc(collection(db, 'sponsors', s.id, 'interactions'), { ...it, byUid: user!.uid, byName: user!.displayName ?? '', at: serverTimestamp() });
      if (it.nextAction) await updateDoc(doc(db, 'sponsors', s.id), { nextAction: it.nextAction, updatedAt: serverTimestamp() });
      setIt({ ...it, summary: '', nextAction: '' });
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <Drawer opened={!!s} onClose={onClose} position="right" size="xl" title={<Text fw={700}>{s.companyName}</Text>}>
      <Stack>
        <SimpleGrid cols={2}>
          <Select label="Aşama" data={Object.entries(SPONSOR_STAGE).map(([value, m]) => ({ value, label: m.label }))} value={f.stage} onChange={(v) => setF({ ...f, stage: (v ?? f.stage) as SponsorStage })} readOnly={!canEdit} />
          {canManage ? (
            <Select label="Sorumlu" data={options} value={f.ownerUid} onChange={(v) => setF({ ...f, ownerUid: v ?? f.ownerUid })} searchable />
          ) : (
            <TextInput label="Sorumlu" value={s.ownerName} readOnly />
          )}
          <DateInput label="Sonraki işlem tarihi" valueFormat="DD.MM.YYYY" value={f.nextActionDate} onChange={(v) => setF({ ...f, nextActionDate: v })} readOnly={!canEdit} clearable />
          <TextInput label="Sonraki işlem" value={f.nextAction} onChange={(e) => setF({ ...f, nextAction: e.currentTarget.value })} readOnly={!canEdit} />
          <TextInput label="Sektör" value={f.sector} onChange={(e) => setF({ ...f, sector: e.currentTarget.value })} readOnly={!canEdit} />
          <NumberInput label="Anlaşma tutarı (TL)" value={f.amount ?? ''} onChange={(v) => setF({ ...f, amount: v === '' ? null : Number(v) })} readOnly={!canEdit} thousandSeparator="." decimalSeparator="," />
        </SimpleGrid>
        <TextInput label="Teklif dosyaları (Drive)" value={f.proposalLinks} onChange={(e) => setF({ ...f, proposalLinks: e.currentTarget.value })} readOnly={!canEdit} />
        {f.website && (
          <Anchor href={f.website.startsWith('http') ? f.website : `https://${f.website}`} target="_blank" size="sm">
            {f.website}
          </Anchor>
        )}
        <Textarea label="Notlar" autosize minRows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.currentTarget.value })} readOnly={!canEdit} />
        {canEdit && (
          <Group justify="flex-end">
            <Button onClick={() => void save()}>Kaydet</Button>
          </Group>
        )}

        {canEdit && (
          <Card>
            <Group gap="xs" mb="xs">
              <IconLock size={16} />
              <Text fw={600}>İletişim kişileri (yalnızca sorumlu ve yöneticiler)</Text>
            </Group>
            <Text size="xs" c="dimmed" mb="xs">
              Yalnızca iş iletişim bilgisi tutulur (ad, unvan, iş e-postası). Kişisel telefon tutulmaz.
            </Text>
            <Table>
              <Table.Tbody>
                {cList.map((c, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>
                      <TextInput size="xs" placeholder="Ad" value={c.name} onChange={(e) => setCList(cList.map((x, j) => (j === i ? { ...x, name: e.currentTarget.value } : x)))} />
                    </Table.Td>
                    <Table.Td>
                      <TextInput size="xs" placeholder="Unvan" value={c.title} onChange={(e) => setCList(cList.map((x, j) => (j === i ? { ...x, title: e.currentTarget.value } : x)))} />
                    </Table.Td>
                    <Table.Td>
                      <TextInput size="xs" placeholder="İş e-postası" value={c.email} onChange={(e) => setCList(cList.map((x, j) => (j === i ? { ...x, email: e.currentTarget.value } : x)))} />
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon variant="subtle" color="red" onClick={() => setCList(cList.filter((_, j) => j !== i))} aria-label="Sil">
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Group mt="xs">
              <Button size="xs" variant="light" onClick={() => setCList([...cList, { name: '', title: '', email: '' }])}>
                Kişi ekle
              </Button>
              <Button size="xs" onClick={() => setDoc(doc(db, 'sponsors', s.id, 'private', 'contacts'), { list: cList }).then(() => notifySuccess('Kişiler kaydedildi.')).catch(notifyError)}>
                Kişileri kaydet
              </Button>
            </Group>
          </Card>
        )}

        <Card>
          <Text fw={600} mb="sm">
            Görüşme geçmişi
          </Text>
          {canEdit && (
            <Stack gap="xs" mb="md">
              <Group grow>
                <DateInput valueFormat="DD.MM.YYYY" value={it.date} onChange={(v) => setIt({ ...it, date: v })} />
                <Select data={['E-posta', 'Telefon', 'Yüz yüze', 'Çevrim içi toplantı', 'LinkedIn']} value={it.channel} onChange={(v) => setIt({ ...it, channel: v ?? 'E-posta' })} />
              </Group>
              <Textarea placeholder="Görüşme özeti" value={it.summary} onChange={(e) => setIt({ ...it, summary: e.currentTarget.value })} />
              <TextInput placeholder="Sonraki işlem" value={it.nextAction} onChange={(e) => setIt({ ...it, nextAction: e.currentTarget.value })} />
              <Button size="xs" onClick={() => void addInteraction()} disabled={!it.summary.trim()}>
                Görüşme ekle
              </Button>
            </Stack>
          )}
          {interactions.data.length === 0 ? (
            <Text size="sm" c="dimmed">
              Kayıt yok.
            </Text>
          ) : (
            interactions.data.map((x) => (
              <div key={x.id} style={{ marginBottom: 8 }}>
                <Text size="sm">
                  <b>{fmtDate(new Date(x.date))}</b> · {x.channel} · {x.byName}
                </Text>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {x.summary}
                </Text>
                {x.nextAction && (
                  <Text size="xs" c="dimmed">
                    Sonraki: {x.nextAction}
                  </Text>
                )}
              </div>
            ))
          )}
        </Card>
      </Stack>
    </Drawer>
  );
}
