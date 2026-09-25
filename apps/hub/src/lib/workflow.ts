/**
 * Dilekçe akışının küçük, saf yardımcıları. Word kütüphanelerini içe aktarmaz; böylece
 * ana paket küçük kalır (Word motoru yalnızca dilekçe ekranlarında yüklenir).
 */
import type { ApprovalStep, OrgSettings } from './types';
import { BRANCH } from './types';


const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** 12 karakter, ~60 bit rastgelelik: tahmin edilemez doğrulama kodu. */
export function newVerificationCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => CROCKFORD[b % 32]).join('');
}

export function stepUnitId(step: ApprovalStep, petitionUnitId: string): string {
  if (step.unitMode === 'petition') return petitionUnitId;
  if (step.unitMode === 'branch') return BRANCH;
  return step.unitId ?? BRANCH;
}

/** Dilekçeyi kimlerin görebileceği: sahibi, birim okuyucuları ve zincirdeki tüm roller. */
export function computeVisibleTo(ownerUid: string, unitId: string, steps: ApprovalStep[]): string[] {
  const set = new Set<string>([`uid:${ownerUid}`, `unit:${unitId}`]);
  for (const s of steps) {
    const u = stepUnitId(s, unitId);
    for (const r of s.roleIds) set.add(`role:${u}__${r}`);
  }
  return [...set].slice(0, 40);
}

export function formatDocumentNo(pattern: string, parts: { prefix: string; year: number; series: string; seq: number }) {
  return pattern
    .replace('{prefix}', parts.prefix)
    .replace('{year}', String(parts.year))
    .replace('{series}', parts.series)
    .replace(/\{seq(?::(\d+))?\}/, (_m, pad) => String(parts.seq).padStart(Number(pad ?? 0), '0'));
}

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  activeTermId: null,
  numberingPrefix: 'IEEEIKCU',
  numberingPattern: '{prefix}-{year}-{series}-{seq:4}',
  verifyBaseUrl: '',
  allowedEmailDomains: [],
  volunteerRoleId: 'gonullu',
  orientationItems: [
    'Birimin Discord kanalına katıl',
    'Birimin Google Grubuna katıl',
    'Hub kullanım kılavuzunu oku',
    'KVKK ve gizlilik taahhüdünü onayla',
  ],
  vtoolsOrganizationName: '',
  vtoolsSpoid: '',
  vtoolsContactEmail: '',
  vtoolsTimeZone: 'Europe/Istanbul',
};

export function verifyUrl(settings: OrgSettings | null, code: string) {
  const base = settings?.verifyBaseUrl?.trim() || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base.replace(/\/$/, '')}/dogrula/${code}`;
}
