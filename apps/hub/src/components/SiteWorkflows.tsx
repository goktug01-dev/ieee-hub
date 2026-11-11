import { Alert, Badge, Button, Card, Checkbox, Group, Modal, NumberInput, Stack, Table, Text, TextInput, Textarea } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Timestamp } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { useCollection, useDoc } from '../lib/hooks';
import { SiteConnection, useSite } from '../lib/siteIntegration';
import { decideEventPoints, eventIsPublic, proposeEventPoints, saveSiteAnnouncement, siteQrController, type EventPoints, type SiteAnnouncement, type SiteSyncStatus } from '../lib/siteWorkflow';
import { readExternalPointUsers, writeExternalMembershipChanges, type ExternalPointUser } from '../lib/externalFirebase';
import type { HubEvent } from '../lib/opsTypes';
import { EmptyState, ErrorAlert, SectionLoader, notifyError, notifySuccess } from './ui';

export function SitePublicationStatus({ kind, id, version }: { kind: 'event' | 'announcement' | 'qr'; id: string; version?: Timestamp | null }) {
  const result = useDoc<SiteSyncStatus>(`siteSync/${kind}__${id}`);
  const current = !!version && !!result.data?.sourceUpdatedAt?.isEqual(version);
  return <Badge color={current && result.data?.status === 'synced' ? 'teal' : current && result.data?.status === 'failed' ? 'red' : 'yellow'} title={current ? result.data?.error || undefined : undefined}>{current && result.data?.status === 'synced' ? 'Siteye aktarıldı' : current && result.data?.status === 'failed' ? 'Site aktarımı başarısız' : 'Site aktarımı bekliyor'}</Badge>;
}

export function SiteAnnouncementsPanel() {
  const list = useCollection<SiteAnnouncement>('siteAnnouncements');
  const [editing, setEditing] = useState<{ id: string | null; title: string; content: string; link: string; pinned: boolean; status: 'published' | 'withdrawn' } | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim() || !editing.content.trim()) return notifyError(new Error('Başlık ve duyuru metni zorunludur.'));
    setBusy(true);
    try { await saveSiteAnnouncement(editing.id, { title: editing.title.trim(), content: editing.content.trim(), link: editing.link.trim(), pinned: editing.pinned, status: editing.status }); setEditing(null); notifySuccess('Duyuru kaydedildi; siteye otomatik aktarılacak.'); }
    catch (e) { notifyError(e); } finally { setBusy(false); }
  };
  return <Stack><SiteConnection /><Group justify="space-between"><Text fw={600}>Web sitesi duyuruları</Text><Button onClick={() => setEditing({ id: null, title: '', content: '', link: '', pinned: false, status: 'published' })}>Siteye duyuru ekle</Button></Group><ErrorAlert error={list.error} />
    {list.loading ? <SectionLoader /> : !list.data.length ? <EmptyState title="Henüz site duyurusu yok" /> : list.data.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)).map(item => <Card key={item.id} withBorder><Stack gap="xs"><Group justify="space-between"><Text fw={600}>{item.title}</Text><Group><Badge color={item.status === 'published' ? 'blue' : 'gray'}>{item.status === 'published' ? 'Yayında' : 'Geri çekildi'}</Badge><SitePublicationStatus kind="announcement" id={item.id} version={item.updatedAt} /></Group></Group><Text style={{ whiteSpace: 'pre-wrap' }}>{item.content}</Text><Button variant="light" onClick={() => setEditing(item)}>Düzenle / yayından kaldır</Button></Stack></Card>)}
    <Modal opened={!!editing} onClose={() => setEditing(null)} title="Web sitesi duyurusu" size="lg">{editing && <Stack><TextInput label="Başlık" maxLength={160} required value={editing.title} onChange={e => setEditing({ ...editing, title: e.currentTarget.value })} /><Textarea label="Duyuru metni" required autosize minRows={5} value={editing.content} onChange={e => setEditing({ ...editing, content: e.currentTarget.value })} /><TextInput label="Bağlantı (isteğe bağlı)" value={editing.link} onChange={e => setEditing({ ...editing, link: e.currentTarget.value })} /><Checkbox label="Sabitlenmiş duyuru" checked={editing.pinned} onChange={e => setEditing({ ...editing, pinned: e.currentTarget.checked })} /><Checkbox label="Web sitesinde yayımla" checked={editing.status === 'published'} onChange={e => setEditing({ ...editing, status: e.currentTarget.checked ? 'published' : 'withdrawn' })} /><Button onClick={() => void save()} loading={busy}>Kaydet ve siteye aktar</Button></Stack>}</Modal>
  </Stack>;
}

export function EventPointsPanel({ id, event, canManage }: { id: string; event: HubEvent; canManage: boolean }) {
  const { access } = useAuth();
  const { config, user } = useSite();
  const request = useDoc<EventPoints>(`eventPointRequests/${id}`);
  const sync = useDoc<SiteSyncStatus>(`siteSync/qr__${id}`);
  const isActor = siteQrController(access);
  const [points, setPoints] = useState<number | string>(0), [note, setNote] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(event.endsAt || (event.startsAt ? new Date(Date.parse(event.startsAt) + 86400000).toISOString() : null));
  const [busy, setBusy] = useState(false), [image, setImage] = useState('');
  const p = request.data;
  const ended = ['held', 'closing', 'reported', 'archived', 'cancelled', 'rejected'].includes(event.status) || !!event.endsAt && Date.parse(event.endsAt) <= Date.now();
  const action = async (fn: () => Promise<unknown>, msg: string) => { setBusy(true); try { await fn(); notifySuccess(msg); } catch (e) { notifyError(e); } finally { setBusy(false); } };
  return <Stack><Alert color="blue" title="Komite önerisi → ACTOR doğrulaması → Puan QR’ı">Etkinlik puanını komite önerir; ACTOR doğrular ve QR’ı oluşturur. Onaylanan puan değiştirilemez. Etkinlik bitince QR yeni puan işlemlerine kapanır.</Alert>
    {isActor && <SiteConnection />}<ErrorAlert error={request.error} />
    {!eventIsPublic(event) ? <Text>Önce etkinliğin YK / izin dilekçesi onayı tamamlanmalı.</Text> : request.loading ? <SectionLoader /> : !p ? canManage && !ended ? <Card withBorder><Stack><NumberInput label="Komitenin önerdiği aktiflik puanı" min={0} max={100000} allowDecimal={false} value={points} onChange={setPoints} /><Textarea label="Puan gerekçesi" required value={note} onChange={e => setNote(e.currentTarget.value)} /><DateTimePicker label="QR son kullanım zamanı" value={expiresAt} onChange={setExpiresAt} /><Button loading={busy} disabled={!expiresAt || !note.trim()} onClick={() => void action(() => proposeEventPoints(id, event, Number(points), note, new Date(expiresAt!)), 'Puan önerisi ACTOR doğrulamasına gönderildi.')}>ACTOR doğrulamasına gönder</Button></Stack></Card> : <Text>Puan önerisi bulunmuyor.</Text> : <Card withBorder><Stack><Group><Text fw={700}>{p.points} puan</Text><Badge>{p.status === 'requested' ? 'ACTOR onayı bekliyor' : p.status === 'approved' ? 'ACTOR doğruladı' : 'QR kapatıldı'}</Badge>{p.status !== 'requested' && <SitePublicationStatus kind="qr" id={id} version={p.updatedAt} />}</Group><Text>{p.note}</Text><Text size="sm">QR son kullanım: {p.expiresAt.toDate().toLocaleString('tr-TR')}</Text>
      {isActor && p.status === 'requested' && <Button loading={busy} disabled={ended || p.expiresAt.toMillis() <= Date.now()} onClick={() => void action(() => decideEventPoints(id), 'ACTOR doğrulaması kaydedildi; puan QR’ı siteye oluşturulacak.')}>Puanı doğrula ve QR oluştur</Button>}
      {isActor && p.status === 'approved' && <Button color="orange" variant="light" loading={busy} onClick={() => void action(() => decideEventPoints(id, true), 'QR kapatıldı; siteye aktarılacak.')}>QR’ı kapat</Button>}
      {isActor && p.status === 'approved' && !ended && p.expiresAt.toMillis() > Date.now() && <Button variant="light" disabled={!user || !config || sync.data?.status !== 'synced' || !sync.data.sourceUpdatedAt?.isEqual(p.updatedAt)} onClick={async () => { try { const template = config?.siteQrUrlTemplate || 'https://studentbranches.ieee.org/tr-ikcu/profile/?qr_id={qrId}'; const link = template.replaceAll('{qrId}', encodeURIComponent(`hub-event-${id}`)).replaceAll('{committeeId}', encodeURIComponent(config?.siteUnitMap?.[event.unitId] || '')); const url = new URL(link); if (!['https:', 'http:'].includes(url.protocol) || !template.includes('{qrId}')) throw new Error('TechOps geçerli bir QR bağlantı şablonu tanımlamalı.'); setImage(await QRCode.toDataURL(url.href)); } catch (e) { notifyError(e); } }}>Puan QR’ını görüntüle</Button>}
    </Stack></Card>}
    <Modal opened={!!image} onClose={() => setImage('')} title="Etkinlik puan QR’ı"><Stack><img src={image} alt="Puan QR’ı" /><Button component="a" href={image} download={`${event.code}-puan-qr.png`}>PNG indir</Button></Stack></Modal>
  </Stack>;
}

export function SiteMembersPanel() {
  const { config, user } = useSite();
  const [users, setUsers] = useState<ExternalPointUser[]>([]), [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState<Error | null>(null);
  const [change, setChange] = useState<{ id: string; approved: boolean; reason: string } | null>(null);
  const resource = { id: 'site-members', label: 'Site üyeleri', database: 'realtime' as const, path: 'users', displayFields: [], readOnly: false };
  const load = async () => { if (!config || !user) { setUsers([]); return; } setBusy(true); setError(null); try { setUsers(await readExternalPointUsers(config, resource)); } catch (e) { setUsers([]); setError(e as Error); } finally { setBusy(false); } };
  useEffect(() => { void load(); }, [config?.projectId, user?.uid]);
  return <Stack><SiteConnection /><Text size="sm">Web sitesindeki üyelik başvuruları. Hub üyeliği ve site üyeliği ayrı kayıtlardır.</Text><Group><TextInput placeholder="Üye ara" value={search} onChange={e => setSearch(e.currentTarget.value)} /><Button variant="light" onClick={() => void load()} loading={busy}>Yenile</Button></Group><ErrorAlert error={error} /><Table><Table.Thead><Table.Tr><Table.Th>Üye</Table.Th><Table.Th>Site üyeliği</Table.Th><Table.Th /></Table.Tr></Table.Thead><Table.Tbody>{users.filter(u => `${u.name} ${u.surname} ${u.email}`.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr'))).map(u => <Table.Tr key={u.id}><Table.Td>{u.name} {u.surname}<Text size="xs">{u.email}</Text></Table.Td><Table.Td><Badge color={u.approved ? 'green' : 'yellow'}>{u.approved ? 'Onaylı' : 'Onay bekliyor'}</Badge></Table.Td><Table.Td><Button size="xs" color={u.approved ? 'orange' : 'green'} onClick={() => setChange({ id: u.id, approved: !u.approved, reason: '' })}>{u.approved ? 'Askıya al' : 'Site üyeliğini onayla'}</Button></Table.Td></Table.Tr>)}</Table.Tbody></Table>
    <Modal opened={!!change} onClose={() => setChange(null)} title="Site üyeliği">{change && <Stack><Textarea label="İşlem gerekçesi" required value={change.reason} onChange={e => setChange({ ...change, reason: e.currentTarget.value })} /><Button loading={busy} disabled={!change.reason.trim()} onClick={async () => { if (!config) return; setBusy(true); try { await writeExternalMembershipChanges(config, resource, users, [change], change.reason); setChange(null); await load(); notifySuccess('Site üyeliği güncellendi.'); } catch (e) { notifyError(e); } finally { setBusy(false); } }}>Siteye kaydet</Button></Stack>}</Modal>
  </Stack>;
}
