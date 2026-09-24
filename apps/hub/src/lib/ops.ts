/**
 * Operasyon modüllerinin yazma işlemleri. Yetki kontrolleri firebase/firestore.rules içindedir.
 */
import {
  Timestamp,
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  where,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { FAR_FUTURE } from './access';
import { auditInBatch, logAudit } from './audit';
import { sha256Hex } from './docx';
import { slugify } from './format';
import type { HubEvent, Participant, Task, VolunteerApplication } from './opsTypes';
import type { OrgSettings, Term } from './types';
import { DEFAULT_ORG_SETTINGS } from './workflow';

function me() {
  const u = auth.currentUser!;
  return { uid: u.uid, name: u.displayName ?? u.email ?? '' };
}

// ---------- Görevler ----------

export type NewTask = Omit<Task, 'code' | 'createdBy' | 'createdByName' | 'createdAt' | 'updatedAt' | 'completedAt'>;

/** Birim kısa koduyla görev kodu üretir (CS-0042) ve görevi oluşturur. */
export async function createTask(input: NewTask, unitShortCode: string): Promise<string> {
  const who = me();
  const ref = doc(collection(db, 'tasks'));
  await runTransaction(db, async (tx) => {
    const cRef = doc(db, 'taskCounters', input.unitId);
    const c = await tx.get(cRef);
    const value = c.exists() ? (c.data().value as number) + 1 : 1;
    tx.set(cRef, { value });
    tx.set(ref, {
      ...input,
      code: `${unitShortCode}-${String(value).padStart(4, '0')}`,
      createdBy: who.uid,
      createdByName: who.name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      completedAt: input.status === 'done' ? serverTimestamp() : null,
    });
  });
  return ref.id;
}

export async function updateTask(id: string, patch: Partial<Task>, prevStatus?: string) {
  const extra: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.status && patch.status !== prevStatus) extra.completedAt = patch.status === 'done' ? serverTimestamp() : null;
  await updateDoc(doc(db, 'tasks', id), { ...patch, ...extra });
}

export async function addTaskComment(taskId: string, text: string) {
  const who = me();
  await addDoc(collection(db, 'tasks', taskId, 'comments'), { byUid: who.uid, byName: who.name, text, at: serverTimestamp() });
}

// ---------- Etkinlikler ----------

export const EMPTY_EVENT_EXTRAS = {
  petitionId: null,
  petitionNo: null,
  heptacertLink: '',
  driveLink: '',
  registrationLink: '',
  budgetPlanned: null,
  checklist: { dataTransferred: false, tasksClosed: false, filesArchived: false, budgetEntered: false },
  report: { participantCount: null, summary: '', outcomes: '', lessons: '' },
  reportApproved: false,
  vtoolsStatus: 'pending' as const,
};

/** Etkinlik önerisi: EVT-{YYYY}-{NNN} kodu sayaçla atanır. */
export async function proposeEvent(
  input: Pick<HubEvent, 'name' | 'unitId' | 'unitName' | 'type' | 'description' | 'startsAt' | 'endsAt' | 'location' | 'expectedParticipants' | 'ownerUids' | 'ownerNames'>,
): Promise<string> {
  const who = me();
  const year = new Date().getFullYear();
  const ref = doc(collection(db, 'events'));
  await runTransaction(db, async (tx) => {
    const cRef = doc(db, 'eventCounters', String(year));
    const c = await tx.get(cRef);
    const value = c.exists() ? (c.data().value as number) + 1 : 1;
    tx.set(cRef, { value });
    tx.set(ref, {
      ...input,
      ...EMPTY_EVENT_EXTRAS,
      code: `EVT-${year}-${String(value).padStart(3, '0')}`,
      status: 'proposed',
      createdBy: who.uid,
      createdByName: who.name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  return ref.id;
}

export async function updateEvent(id: string, patch: Partial<HubEvent>) {
  await updateDoc(doc(db, 'events', id), { ...patch, updatedAt: serverTimestamp() });
}

export async function decideEvent(id: string, approve: boolean, note: string) {
  const who = me();
  const batch = writeBatch(db);
  batch.update(doc(db, 'events', id), {
    status: approve ? 'approved' : 'rejected',
    decisionNote: note,
    decidedBy: who.uid,
    decidedByName: who.name,
    decidedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  auditInBatch(batch, approve ? 'event.approve' : 'event.reject', `events/${id}`, { note });
  await batch.commit();
}

export async function approveEventWithPetition(id: string, petitionId: string, petitionNo: string) {
  const who = me();
  await updateDoc(doc(db, 'events', id), {
    status: 'approved',
    petitionId,
    petitionNo,
    decisionNote: `Etkinlik izin dilekçesi onaylandı (${petitionNo}).`,
    decidedBy: who.uid,
    decidedByName: who.name,
    decidedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ---------- HeptaCert CSV aktarımı ----------

/** Basit, tırnak destekli CSV ayrıştırıcı (virgül veya noktalı virgül). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const HEADER_ALIASES: Record<string, string[]> = {
  name: ['ad soyad', 'adsoyad', 'name', 'full name', 'isim', 'ad', 'katılımcı', 'katilimci'],
  email: ['e-posta', 'eposta', 'email', 'e-mail', 'mail'],
  attended: ['katıldı', 'katildi', 'attended', 'check-in', 'checkin', 'yoklama', 'durum'],
  certificate: ['sertifika', 'certificate', 'sertifika no', 'certificate id', 'sertifika kodu'],
};

export interface CsvPreview {
  columns: { name: number; email: number; attended: number; certificate: number };
  rows: { name: string; email: string; attended: boolean; certificate: string; extra: Record<string, string> }[];
  errors: string[];
  duplicates: number;
  headers: string[];
}

export function previewParticipantsCsv(text: string): CsvPreview {
  const rows = parseCsv(text);
  const headers = (rows[0] ?? []).map((h) => h.trim());
  const lower = headers.map((h) => h.toLocaleLowerCase('tr'));
  const find = (k: keyof typeof HEADER_ALIASES) => lower.findIndex((h) => HEADER_ALIASES[k].includes(h));
  const columns = { name: find('name'), email: find('email'), attended: find('attended'), certificate: find('certificate') };
  const errors: string[] = [];
  if (columns.email < 0) errors.push('E-posta sütunu bulunamadı (başlık: "E-posta" veya "Email").');
  const seen = new Set<string>();
  let duplicates = 0;
  const out: CsvPreview['rows'] = [];
  rows.slice(1).forEach((r, i) => {
    const email = (r[columns.email] ?? '').trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      errors.push(`Satır ${i + 2}: geçersiz e-posta "${email}"`);
      return;
    }
    if (seen.has(email)) {
      duplicates++;
      return;
    }
    seen.add(email);
    const att = columns.attended >= 0 ? (r[columns.attended] ?? '').trim().toLocaleLowerCase('tr') : '';
    const extra: Record<string, string> = {};
    headers.forEach((h, j) => {
      if (![columns.name, columns.email, columns.attended, columns.certificate].includes(j) && r[j]?.trim()) extra[h] = r[j].trim();
    });
    out.push({
      name: columns.name >= 0 ? (r[columns.name] ?? '').trim() : '',
      email,
      attended: columns.attended < 0 ? true : ['1', 'evet', 'yes', 'true', 'x', 'katıldı', 'katildi', 'var'].includes(att),
      certificate: columns.certificate >= 0 ? (r[columns.certificate] ?? '').trim() : '',
      extra,
    });
  });
  return { columns, rows: out, errors, duplicates, headers };
}

/**
 * Katılımcıları idempotent olarak yazar: doküman kimliği e-postanın SHA-256 özetidir,
 * aynı dosya ikinci kez aktarıldığında çift kayıt oluşmaz (WP-06 K4).
 */
export async function importParticipants(eventId: string, fileName: string, preview: CsvPreview) {
  const who = me();
  const existing = new Set((await getDocs(collection(db, 'events', eventId, 'participants'))).docs.map((d) => d.id));
  let added = 0;
  let updated = 0;
  const ids = await Promise.all(preview.rows.map((r) => sha256Hex(new TextEncoder().encode(r.email).buffer as ArrayBuffer)));
  for (let i = 0; i < preview.rows.length; i += 400) {
    const batch = writeBatch(db);
    preview.rows.slice(i, i + 400).forEach((r, j) => {
      const id = ids[i + j].slice(0, 32);
      if (existing.has(id)) updated++;
      else added++;
      const p: Omit<Participant, 'importedAt'> & { importedAt: unknown } = { ...r, importedAt: serverTimestamp() };
      batch.set(doc(db, 'events', eventId, 'participants', id), p);
    });
    await batch.commit();
  }
  const run = {
    at: serverTimestamp(),
    by: who.uid,
    byName: who.name,
    fileName,
    total: preview.rows.length + preview.duplicates + preview.errors.filter((e) => e.startsWith('Satır')).length,
    added,
    updated,
    duplicates: preview.duplicates,
    errors: preview.errors.filter((e) => e.startsWith('Satır')).length,
    errorRows: preview.errors.slice(0, 50),
  };
  await addDoc(collection(db, 'events', eventId, 'syncRuns'), run);
  return run;
}

export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n');
}

export function downloadText(text: string, fileName: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------- Gönüllü başvurusu ve oryantasyon ----------

export async function applyAsVolunteer(input: Pick<VolunteerApplication, 'unitId' | 'unitName' | 'motivation' | 'availability'>) {
  const u = auth.currentUser!;
  await addDoc(collection(db, 'volunteerApplications'), {
    ...input,
    uid: u.uid,
    name: u.displayName ?? '',
    email: u.email ?? '',
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

async function orgSettings(): Promise<OrgSettings> {
  const s = await getDoc(doc(db, 'settings', 'org'));
  return { ...DEFAULT_ORG_SETTINGS, ...(s.data() as Partial<OrgSettings> | undefined) };
}

/**
 * Başvuruyu karara bağlar. Kabulde: gönüllü rolü ataması, erişim özetine sınırlı ekleme
 * (birim yöneticisinin yetkisi yalnızca bu rolle sınırlıdır) ve oryantasyon görevleri.
 */
export async function decideVolunteer(
  app: VolunteerApplication & { id: string },
  accept: boolean,
  note: string,
  unitShortCode: string,
): Promise<{ orientationTasks: number }> {
  const who = me();
  await updateDoc(doc(db, 'volunteerApplications', app.id), {
    status: accept ? 'accepted' : 'rejected',
    decidedBy: who.uid,
    decidedByName: who.name,
    decidedAt: serverTimestamp(),
    decisionNote: note,
  });
  if (!accept) return { orientationTasks: 0 };

  const settings = await orgSettings();
  const roleId = settings.volunteerRoleId;
  const roleSnap = await getDoc(doc(db, 'roles', roleId));
  const roleName = (roleSnap.data()?.name as string) ?? 'Gönüllü';
  let term: (Term & { id: string }) | null = null;
  if (settings.activeTermId) {
    const t = await getDoc(doc(db, 'terms', settings.activeTermId));
    if (t.exists()) term = { id: t.id, ...(t.data() as Term) };
  }
  const endsAt = term?.endsAt ?? null;

  await addDoc(collection(db, 'assignments'), {
    uid: app.uid,
    memberName: app.name,
    roleId,
    roleName,
    unitId: app.unitId,
    unitName: app.unitName,
    termId: term?.id ?? null,
    startsAt: Timestamp.now(),
    endsAt,
    status: 'active',
    source: 'volunteer',
    electionId: null,
    note: 'Gönüllü başvurusu kabulü',
    createdBy: who.uid,
    createdAt: serverTimestamp(),
    endedAt: null,
    endedBy: null,
  });

  const key = `${app.unitId}__${roleId}`;
  const exp = endsAt ?? FAR_FUTURE;
  const delegation = { unitId: app.unitId, roleId, by: who.uid };
  const accRef = doc(db, 'access', app.uid);
  try {
    await updateDoc(accRef, {
      [`roleKeys.${key}`]: exp,
      [`memberOf.${app.unitId}`]: exp,
      tokens: arrayUnion(`role:${key}`),
      lastDelegation: delegation,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    // Özet yoksa güncelleme kurallarda "yetki yok" olarak döner; bu durumda sınırlı oluşturma denenir.
    // Özet varsa bu tam yazım da kurallar tarafından reddedilir, yani yetki genişletilemez.
    const code = (e as { code?: string }).code;
    if (code !== 'not-found' && code !== 'permission-denied') throw e;
    await setDoc(accRef, {
      superAdmin: false,
      perms: {},
      unitPerms: {},
      roleKeys: { [key]: exp },
      memberOf: { [app.unitId]: exp },
      tokens: [`uid:${app.uid}`, `role:${key}`],
      lastDelegation: delegation,
      updatedAt: serverTimestamp(),
    });
  }

  let n = 0;
  for (const item of settings.orientationItems) {
    await createTask(
      {
        title: `Oryantasyon: ${item}`,
        description: 'Gönüllü kabulüyle otomatik oluşturuldu.',
        unitId: app.unitId,
        unitName: app.unitName,
        projectId: null,
        eventId: null,
        assigneeUid: app.uid,
        assigneeName: app.name,
        supporterUids: [],
        supporterNames: [],
        startDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
        priority: 'normal',
        status: 'todo',
        doneCriteria: item,
        fileLink: '',
      },
      unitShortCode,
    );
    n++;
  }
  await logAudit('volunteer.accept', `volunteerApplications/${app.id}`, { name: app.name, unit: app.unitName });
  return { orientationTasks: n };
}

/** Birim yöneticisinin gönüllü görevini sonlandırması (erişim özetinden de kaldırılır). */
export async function endVolunteer(assignmentId: string, uid: string, unitId: string, roleId: string) {
  const who = me();
  await updateDoc(doc(db, 'assignments', assignmentId), { status: 'ended', endedAt: serverTimestamp(), endedBy: who.uid });
  const key = `${unitId}__${roleId}`;
  // Kişinin aynı birimde başka görevi varsa birim üyeliği korunur.
  const others = await getDocs(
    query(collection(db, 'assignments'), where('uid', '==', uid), where('unitId', '==', unitId), where('status', '==', 'active')),
  );
  const keepMembership = others.docs.some((d) => d.id !== assignmentId);
  await updateDoc(doc(db, 'access', uid), {
    [`roleKeys.${key}`]: deleteField(),
    ...(keepMembership ? {} : { [`memberOf.${unitId}`]: deleteField() }),
    tokens: arrayRemove(`role:${key}`),
    lastDelegation: { unitId, roleId, by: who.uid },
    updatedAt: serverTimestamp(),
  });
}

// ---------- Sponsor kilidi ----------

export function sponsorLockKey(companyName: string) {
  return slugify(companyName) || 'firma';
}
