import { Timestamp, doc, getDocFromServer, serverTimestamp, setDoc } from 'firebase/firestore';
import { get, ref, serverTimestamp as remoteTime, update } from 'firebase/database';
import { auth, db } from '../firebase';
import { hasPermission, hasRoleKey } from './access';
import { externalServices } from './externalFirebase';
import type { Access } from './types';
import type { ExternalFirebaseConfig, HubEvent } from './opsTypes';

export interface SiteAnnouncement {
  title: string; content: string; link: string; pinned: boolean;
  status: 'published' | 'withdrawn'; createdBy: string; createdAt: Timestamp;
  updatedBy: string; updatedAt: Timestamp;
}
export interface EventPoints {
  eventId: string; unitId: string; points: number; note: string;
  status: 'requested' | 'approved' | 'closed'; expiresAt: Timestamp;
  requestedBy: string; createdAt: Timestamp; updatedAt: Timestamp;
  approvedBy?: string; approvedAt?: Timestamp;
}
export type SiteKind = 'event' | 'announcement' | 'qr';
export interface SiteSyncStatus {
  kind: SiteKind; sourceId: string; sourceUpdatedAt: Timestamp;
  status: 'synced' | 'failed'; error: string; remoteId: string;
  remoteProjectId: string; updatedAt: Timestamp; byUid: string;
}
export const siteAnnouncementManager = (a: Access | null) => hasPermission(a, 'site.announcements.manage');
export const siteQrController = (a: Access | null) => !!a && (hasRoleKey(a, 'branch__actor') || !!a.perms?.['site.qr.manage'] && a.perms['site.qr.manage'].toMillis() > Date.now());
export const siteOperator = (a: Access | null) => siteAnnouncementManager(a) || siteQrController(a) || ['external.firebase.manage', 'events.approve', 'members.manage'].some(p => hasPermission(a, p));
export const eventIsPublic = (e: HubEvent) => ['approved', 'planning', 'registration_open', 'held', 'closing', 'reported', 'archived'].includes(e.status);
export function siteEventPayload(id: string, e: HubEvent) {
  if (!e.startsAt || !Number.isFinite(Date.parse(e.startsAt))) throw new Error('Site takvimi için etkinliğin başlangıç tarihi gerekli.');
  return { id: `hub-${id}`, title: e.name, desc: e.description, start: e.startsAt, ...(e.endsAt ? { end: e.endsAt } : {}), location: e.location, visibility: 'public', status: 'published', source: 'hub' };
}
export function siteQrPayload(p: EventPoints, e: HubEvent) {
  return { event: e.name, puan: p.points, active: p.status === 'approved' && p.expiresAt.toMillis() > Date.now() && (!e.endsAt || Date.parse(e.endsAt) > Date.now()) && eventIsPublic(e) && !['held', 'closing', 'reported', 'archived'].includes(e.status), createdAt: p.createdAt.toMillis(), expiresAt: p.expiresAt.toMillis() };
}
export async function saveSiteAnnouncement(id: string | null, data: Pick<SiteAnnouncement, 'title' | 'content' | 'link' | 'pinned' | 'status'>) {
  const { collection, doc: makeDoc, updateDoc } = await import('firebase/firestore');
  if (id) return updateDoc(doc(db, 'siteAnnouncements', id), { ...data, updatedBy: auth.currentUser!.uid, updatedAt: serverTimestamp() });
  const target = makeDoc(collection(db, 'siteAnnouncements'));
  await setDoc(target, { ...data, createdBy: auth.currentUser!.uid, createdAt: serverTimestamp(), updatedBy: auth.currentUser!.uid, updatedAt: serverTimestamp() });
}
export async function proposeEventPoints(id: string, e: HubEvent, points: number, note: string, expiresAt: Date) {
  if (!Number.isInteger(points) || points < 0 || points > 100000) throw new Error('Puan 0–100000 arasında tam sayı olmalı.');
  if (!note.trim()) throw new Error('Komitenin puan gerekçesini yazın.');
  if (!eventIsPublic(e) || ['held', 'closing', 'reported', 'archived'].includes(e.status) || expiresAt.getTime() <= Date.now()) throw new Error('QR önerisi onaylı ve henüz bitmemiş etkinlik için yapılabilir.');
  if (e.endsAt && (Date.parse(e.endsAt) <= Date.now() || expiresAt.getTime() > Date.parse(e.endsAt))) throw new Error('QR son kullanım zamanı etkinlik bitişini aşamaz.');
  await setDoc(doc(db, 'eventPointRequests', id), { eventId: id, unitId: e.unitId, points, note: note.trim(), expiresAt: Timestamp.fromDate(expiresAt), status: 'requested', requestedBy: auth.currentUser!.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
export async function decideEventPoints(id: string, close = false) {
  const { updateDoc } = await import('firebase/firestore');
  await updateDoc(doc(db, 'eventPointRequests', id), close ? { status: 'closed', updatedAt: serverTimestamp() } : { status: 'approved', approvedBy: auth.currentUser!.uid, approvedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

/** Uzak kurallar Hub rollerini okuyamaz; her operatör site hesabıyla ayrıca yetkilidir. */
export async function publishSiteSource(config: ExternalFirebaseConfig, kind: SiteKind, id: string) {
  const services = externalServices(config);
  const actor = services.auth.currentUser;
  const hubActor = auth.currentUser?.uid;
  if (!actor || !services.realtime) throw new Error('Web sitesi hesabınıza bağlanın.');
  const sourceCollection = { event: 'events', announcement: 'siteAnnouncements', qr: 'eventPointRequests' }[kind];
  const source = await getDocFromServer(doc(db, sourceCollection, id));
  if (!source.exists()) return;
  const d = source.data();
  let remoteId = `hub-${id}`;
  try {
    const writes: Record<string, unknown> = {};
    if (kind === 'event') {
      const path = `${config.siteEventsPath || 'events'}/${remoteId}`;
      const previous = (await get(ref(services.realtime, path))).val();
      if (eventIsPublic(d as HubEvent)) {
        const payload = { ...siteEventPayload(id, d as HubEvent), createdAt: previous?.createdAt ?? d.createdAt.toMillis(), createdBy: previous?.createdBy ?? actor.uid, ...(previous?.createdByEmail ? { createdByEmail: previous.createdByEmail } : {}) };
        if (Object.keys(payload).some(k => JSON.stringify(previous?.[k]) !== JSON.stringify(payload[k as keyof typeof payload])) || !!previous?.end && !('end' in payload)) writes[path] = payload;
      } else if (previous?.source === 'hub') writes[path] = null;
    } else if (kind === 'announcement') {
      const path = `${config.siteAnnouncementsPath || 'public_announcements'}/${remoteId}`;
      const previous = (await get(ref(services.realtime, path))).val();
      if (d.status === 'published') {
        const payload = { title: d.title, content: d.content, pinned: d.pinned, ...(d.link ? { link: d.link } : {}), createdAt: previous?.createdAt ?? d.createdAt.toMillis(), createdByUid: previous?.createdByUid ?? actor.uid, ...(previous?.createdByEmail ? { createdByEmail: previous.createdByEmail } : {}) };
        if (Object.keys(payload).some(k => JSON.stringify(previous?.[k]) !== JSON.stringify(payload[k as keyof typeof payload])) || !!previous?.link && !d.link) writes[path] = payload;
      } else if (previous) writes[path] = null;
    } else {
      if (d.status === 'requested') return;
      remoteId = `hub-event-${id}`;
      const event = await getDocFromServer(doc(db, 'events', id));
      if (!event.exists()) throw new Error('QR etkinliği bulunamadı.');
      const e = event.data() as HubEvent;
      const committee = config.siteUnitMap?.[e.unitId];
      if (!committee) throw new Error(`${e.unitName} için site komite eşlemesi yapılmamış.`);
      const payload = siteQrPayload(d as EventPoints, e);
      writes[`committee_qrs/${committee}/${remoteId}`] = payload;
      writes[`${config.siteQrPath || 'valid_qrs'}/${remoteId}`] = { ...payload, committeeId: committee };
      const auditKey = `${remoteId}-${d.updatedAt.toMillis()}-${payload.active ? 'active' : 'closed'}`;
      const auditPath = `hub_qr_audit/${auditKey}`;
      if (!(await get(ref(services.realtime, auditPath))).exists()) writes[auditPath] = { actorUid: actor.uid, qrId: remoteId, puan: d.points, active: payload.active, at: remoteTime() };
    }
    if (!hubActor || auth.currentUser?.uid !== hubActor || services.auth.currentUser?.uid !== actor.uid) throw new Error('Aktarım sırasında oturum değişti; yeniden bağlanın.');
    if (Object.keys(writes).length) await update(ref(services.realtime), writes);
    await setDoc(doc(db, 'siteSync', `${kind}__${id}`), { kind, sourceId: id, sourceUpdatedAt: d.updatedAt, status: 'synced', error: '', remoteId, remoteProjectId: config.projectId, byUid: auth.currentUser!.uid, updatedAt: serverTimestamp() });
  } catch (error) {
    await setDoc(doc(db, 'siteSync', `${kind}__${id}`), { kind, sourceId: id, sourceUpdatedAt: d.updatedAt, status: 'failed', error: error instanceof Error ? error.message : 'Site aktarımı başarısız.', remoteId, remoteProjectId: config.projectId, byUid: auth.currentUser!.uid, updatedAt: serverTimestamp() }).catch(() => {});
    throw error;
  }
}
