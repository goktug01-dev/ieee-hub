import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Timestamp } from 'firebase/firestore';
import type { PetitionStatus, UnitType } from './types';

dayjs.extend(relativeTime);
dayjs.locale('tr');

type TimeLike = Timestamp | Date | null | undefined;

function toDate(t: TimeLike): Date | null {
  if (!t) return null;
  return t instanceof Timestamp ? t.toDate() : t;
}

export function fmtDate(t: TimeLike): string {
  const d = toDate(t);
  return d ? dayjs(d).format('DD.MM.YYYY') : '—';
}

export function fmtDateTime(t: TimeLike): string {
  const d = toDate(t);
  return d ? dayjs(d).format('DD.MM.YYYY HH:mm') : '—';
}

export function fmtRelative(t: TimeLike): string {
  const d = toDate(t);
  return d ? dayjs(d).fromNow() : '—';
}

/** Mantine tarih bileşenlerinin 'YYYY-MM-DD' değerleri ile Timestamp arasında dönüşüm. */
export function tsToDateString(t: TimeLike): string | null {
  const d = toDate(t);
  return d ? dayjs(d).format('YYYY-MM-DD') : null;
}

export function dateStringToTs(s: string | null | undefined, endOfDay = false): Timestamp | null {
  if (!s) return null;
  const d = endOfDay ? dayjs(s).endOf('day') : dayjs(s).startOf('day');
  return Timestamp.fromDate(d.toDate());
}

export const STATUS_META: Record<PetitionStatus, { label: string; color: string }> = {
  draft: { label: 'Taslak', color: 'gray' },
  pending: { label: 'Onay sürecinde', color: 'blue' },
  returned: { label: 'Düzeltme için iade edildi', color: 'orange' },
  approved: { label: 'Onaylandı', color: 'green' },
  rejected: { label: 'Reddedildi', color: 'red' },
  withdrawn: { label: 'Geri çekildi', color: 'dark' },
};

export const DECISION_LABEL = {
  approve: 'Onayladı',
  reject: 'Reddetti',
  return: 'Düzeltme için iade etti',
} as const;

export const UNIT_TYPE_LABEL: Record<UnitType, string> = {
  board: 'Yönetim Kurulu',
  committee: 'Komite',
  directorate: 'Başkanlık / Daire',
  department: 'Departman',
  project_team: 'Proje ekibi',
  other: 'Diğer',
};

/** "Göktuğ Kocatürk" → "Gö**** Ko*******" (herkese açık doğrulama sayfası için). */
export function maskName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w[0] + '*' : w.slice(0, 2) + '*'.repeat(Math.min(w.length - 2, 6))))
    .join(' ');
}

/** Türkçe karakterleri sadeleştirip kimlik (slug) üretir. */
export function slugify(s: string): string {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u' };
  return s
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşü]/g, (c) => map[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** "ad_soyad" → "Ad Soyad" */
export function humanizeKey(key: string): string {
  return key
    .replace(/[_\-.]+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w ? w[0].toLocaleUpperCase('tr') + w.slice(1) : w))
    .join(' ');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
