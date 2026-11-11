/**
 * Oda rezervasyonu (docs/adr/0038).
 * Her yarım saatlik dilim tek bir belgedir: roomSlots/{oda}_{tarih}_{dilim}. Aynı kimlikle ikinci
 * belge oluşturulamadığı için çakışmayı istemci değil Firestore kuralları engeller; buradaki
 * denetimler yalnızca kullanıcıya erken ve anlaşılır uyarı vermek içindir.
 * Tarih ve dilimler oda saatidir (Türkiye, UTC+3 sabit); tarayıcının saat diliminden bağımsızdır.
 */
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { logAudit } from './audit';
import type { WithId } from './types';

export const SLOT_MINUTES = 30;
export const SLOTS_PER_DAY = 48;
const ROOM_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;

export type RoomBookingKind = 'interview' | 'meeting' | 'event' | 'other';

export const ROOM_KIND_META: Record<RoomBookingKind, { label: string; color: string }> = {
  interview: { label: 'Mülakat', color: 'grape' },
  meeting: { label: 'Toplantı', color: 'blue' },
  event: { label: 'Etkinlik / çalışma', color: 'teal' },
  other: { label: 'Diğer', color: 'gray' },
};

export interface Room {
  name: string;
  location: string;
  note: string;
  /** Kullanıma açık ilk dilim (16 = 08:00). */
  openSlot: number;
  /** Kullanıma kapalı ilk dilim (44 = 22:00). */
  closeSlot: number;
  /** En fazla kaç gün sonrasına rezervasyon yapılabilir. */
  maxDaysAhead: number;
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export type RoomInput = Pick<Room, 'name' | 'location' | 'note' | 'openSlot' | 'closeSlot' | 'maxDaysAhead' | 'active'>;

export const DEFAULT_ROOM: RoomInput = {
  name: 'Kulüp Odası',
  location: '',
  note: '',
  openSlot: 16,
  closeSlot: 44,
  maxDaysAhead: 60,
  active: true,
};

export interface RoomSlot {
  roomId: string;
  /** YYYY-MM-DD */
  date: string;
  /** 0–47; dilim n, n × 30. dakikada başlar. */
  slot: number;
  /** Aynı rezervasyonun dilimlerini birleştirir. */
  groupId: string;
  unitId: string;
  unitName: string;
  kind: RoomBookingKind;
  title: string;
  note: string;
  byUid: string;
  byName: string;
  createdAt: Timestamp | null;
}

/** Aynı rezervasyona ait bitişik dilimlerin birleşimi. `endSlot` dahil değildir. */
export interface RoomBooking extends Omit<RoomSlot, 'slot' | 'createdAt'> {
  startSlot: number;
  endSlot: number;
  slotIds: string[];
}

export function slotId(roomId: string, date: string, slot: number): string {
  return `${roomId}_${date}_${String(slot).padStart(2, '0')}`;
}

/** Dilimin başlangıç saati; 48 için "24:00". */
export function slotTime(slot: number): string {
  const minutes = slot * SLOT_MINUTES;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function slotRange(startSlot: number, endSlot: number): string {
  return `${slotTime(startSlot)}–${slotTime(endSlot)}`;
}

/** Oda saatine göre bugünün tarihi ve içinde bulunulan dilim. */
export function roomNow(now = Date.now()): { date: string; slot: number } {
  const local = new Date(now + ROOM_UTC_OFFSET_MS);
  return {
    date: local.toISOString().slice(0, 10),
    slot: Math.floor((local.getUTCHours() * 60 + local.getUTCMinutes()) / SLOT_MINUTES),
  };
}

/** Dilim bitti mi? Biten dilim ne alınabilir ne iptal edilebilir. */
export function slotEnded(date: string, slot: number, now = Date.now()): boolean {
  const current = roomNow(now);
  return date < current.date || (date === current.date && slot < current.slot);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

/** Tarihin içinde bulunduğu haftanın pazartesisi. */
export function weekStart(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

/** Dilim belgelerini rezervasyonlara birleştirir (oda, tarih ve saat sırasıyla). */
export function groupBookings(slots: WithId<RoomSlot>[]): RoomBooking[] {
  const sorted = [...slots].sort(
    (a, b) => a.roomId.localeCompare(b.roomId) || a.date.localeCompare(b.date) || a.slot - b.slot,
  );
  const out: RoomBooking[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && last.groupId === s.groupId && last.roomId === s.roomId && last.date === s.date && last.endSlot === s.slot) {
      last.endSlot = s.slot + 1;
      last.slotIds.push(s.id);
      continue;
    }
    out.push({
      roomId: s.roomId,
      date: s.date,
      groupId: s.groupId,
      unitId: s.unitId,
      unitName: s.unitName,
      kind: s.kind,
      title: s.title,
      note: s.note,
      byUid: s.byUid,
      byName: s.byName,
      startSlot: s.slot,
      endSlot: s.slot + 1,
      slotIds: [s.id],
    });
  }
  return out;
}

/** İstenen aralıkla kesişen mevcut rezervasyonlar. */
export function conflictingBookings(
  bookings: RoomBooking[],
  roomId: string,
  date: string,
  startSlot: number,
  endSlot: number,
): RoomBooking[] {
  return bookings.filter((b) => b.roomId === roomId && b.date === date && b.startSlot < endSlot && startSlot < b.endSlot);
}

export interface BookingRequest {
  room: WithId<Room>;
  date: string;
  startSlot: number;
  endSlot: number;
}

/** Kurallardaki sınırların istemci karşılığı; sorun yoksa null döner. */
export function validateBookingRequest(req: BookingRequest, now = Date.now()): string | null {
  const { room, date, startSlot, endSlot } = req;
  if (!room.active) return 'Bu oda şu anda rezervasyona kapalı.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Tarih seçin.';
  if (!Number.isInteger(startSlot) || !Number.isInteger(endSlot) || endSlot <= startSlot) {
    return 'Bitiş saati başlangıçtan sonra olmalı.';
  }
  if (startSlot < room.openSlot || endSlot > room.closeSlot) {
    return `Oda yalnızca ${slotRange(room.openSlot, room.closeSlot)} saatleri arasında kullanılabilir.`;
  }
  if (slotEnded(date, startSlot, now)) return 'Geçmiş bir saat için rezervasyon yapılamaz.';
  if (daysBetween(roomNow(now).date, date) >= room.maxDaysAhead) {
    return `En fazla ${room.maxDaysAhead} gün sonrasına rezervasyon yapılabilir.`;
  }
  return null;
}

export class RoomConflictError extends Error {
  constructor(public readonly conflicts: RoomBooking[]) {
    super(
      `Bu aralık az önce doldu: ${conflicts
        .map((c) => `${slotRange(c.startSlot, c.endSlot)} ${c.unitName} (${c.title})`)
        .join(', ')}. Başka bir saat seçin.`,
    );
    this.name = 'RoomConflictError';
  }
}

export interface BookingInput extends BookingRequest {
  unitId: string;
  unitName: string;
  kind: RoomBookingKind;
  title: string;
  note: string;
  byName: string;
}

/**
 * Rezervasyonu tek batch ile yazar: dilimlerden biri doluysa hiçbiri yazılmaz.
 * Reddedilirse nedeni çakışma mı diye bakar ve anlaşılır hata fırlatır.
 */
export async function createBooking(input: BookingInput): Promise<string> {
  const problem = validateBookingRequest(input);
  if (problem) throw new Error(problem);
  const uid = auth.currentUser!.uid;
  const groupId = doc(collection(db, 'roomSlots')).id;
  const batch = writeBatch(db);
  for (let slot = input.startSlot; slot < input.endSlot; slot++) {
    const data: Omit<RoomSlot, 'createdAt'> & { createdAt: unknown } = {
      roomId: input.room.id,
      date: input.date,
      slot,
      groupId,
      unitId: input.unitId,
      unitName: input.unitName,
      kind: input.kind,
      title: input.title.trim(),
      note: input.note.trim(),
      byUid: uid,
      byName: input.byName,
      createdAt: serverTimestamp(),
    };
    batch.set(doc(db, 'roomSlots', slotId(input.room.id, input.date, slot)), data);
  }
  try {
    await batch.commit();
  } catch (e) {
    if ((e as { code?: string }).code === 'permission-denied') {
      const taken = await getDocs(query(collection(db, 'roomSlots'), where('date', '==', input.date)));
      const conflicts = conflictingBookings(
        groupBookings(taken.docs.map((d) => ({ id: d.id, ...(d.data() as RoomSlot) }))),
        input.room.id,
        input.date,
        input.startSlot,
        input.endSlot,
      );
      if (conflicts.length) throw new RoomConflictError(conflicts);
    }
    throw e;
  }
  return groupId;
}

/**
 * Rezervasyonu iptal eder (dilimleri boşaltır). Bitmiş dilimler kullanım geçmişi olarak kalır;
 * `includeEnded` yalnızca organizasyon yöneticisi için anlamlıdır.
 */
export async function cancelBooking(booking: RoomBooking, includeEnded = false): Promise<number> {
  const ids = booking.slotIds.filter((_, i) => includeEnded || !slotEnded(booking.date, booking.startSlot + i));
  if (!ids.length) return 0;
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(db, 'roomSlots', id)));
  await batch.commit();
  return ids.length;
}

export function validateRoom(input: RoomInput): string | null {
  if (!input.name.trim()) return 'Oda adı gerekli.';
  if (input.closeSlot <= input.openSlot) return 'Kapanış saati açılıştan sonra olmalı.';
  if (!Number.isInteger(input.maxDaysAhead) || input.maxDaysAhead < 1 || input.maxDaysAhead > 365) {
    return 'İleri tarih sınırı 1–365 gün arasında olmalı.';
  }
  return null;
}

export function roomDocData(input: RoomInput) {
  return {
    name: input.name.trim(),
    location: input.location.trim(),
    note: input.note.trim(),
    openSlot: input.openSlot,
    closeSlot: input.closeSlot,
    maxDaysAhead: input.maxDaysAhead,
    active: input.active,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser!.uid,
  };
}

export async function saveRoom(id: string | null, input: RoomInput): Promise<string> {
  const problem = validateRoom(input);
  if (problem) throw new Error(problem);
  if (id) {
    await updateDoc(doc(db, 'rooms', id), roomDocData(input));
    await logAudit('room.update', `rooms/${id}`, { name: input.name.trim(), active: input.active });
    return id;
  }
  const ref = await addDoc(collection(db, 'rooms'), { ...roomDocData(input), createdAt: serverTimestamp() });
  await logAudit('room.create', ref.path, { name: input.name.trim() });
  return ref.id;
}
