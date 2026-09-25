import type { HubEvent, VToolsEventData } from './opsTypes';
import type { OrgSettings } from './types';

export const EMPTY_VTOOLS_DATA: VToolsEventData = {
  category: '',
  subcategory: '',
  locationType: 'physical',
  tags: '',
  agenda: '',
  ieeeAttendees: null,
  guestAttendees: null,
  eventId: '',
  reportedAt: null,
  reportedBy: '',
};

/**
 * vTools'un herkese açık Events API/CSV alanlarıyla ve L31 formunda gereken hazırlık
 * alanlarıyla uyumlu çalışma sayfası. Bu dosya bir vTools toplu-yükleme formatı değildir.
 */
export const VTOOLS_PREPARATION_HEADERS = [
  'Internal Event Code',
  'Event Title',
  'Description / L31 Summary',
  'Start Date',
  'Start Time',
  'End Date',
  'End Time',
  'Time Zone',
  'Event Category',
  'Event Sub-category',
  'Location Type',
  'Event Location',
  'Organizational Unit',
  'SPOID',
  'Contact Email',
  'Tags',
  'Agenda',
  'Number of Attendance',
  'Number of IEEE Member Attendees',
  'Number of Non-Member Attendees',
  'Registration URL',
  'HeptaCert URL',
  'Evidence / Drive URL',
  'vTools Event ID',
  'Reported On',
  'Reported By',
] as const;

const dateParts = (iso: string | null, timeZone: string) => {
  if (!iso) return { date: '', time: '' };
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return { date: '', time: '' };
  const date = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(value);
  return { date, time };
};

export function vtoolsData(event: HubEvent): VToolsEventData {
  return { ...EMPTY_VTOOLS_DATA, ...(event.vtools ?? {}) };
}

export function vtoolsMissingFields(event: HubEvent, settings: OrgSettings): string[] {
  const data = vtoolsData(event);
  const missing: string[] = [];
  if (!event.name.trim()) missing.push('etkinlik başlığı');
  if (!event.startsAt) missing.push('başlangıç');
  if (!event.endsAt) missing.push('bitiş');
  if (!event.report?.summary?.trim() && !event.description.trim()) missing.push('açıklama/özet');
  if (!data.category.trim()) missing.push('vTools kategorisi');
  if (data.locationType !== 'virtual' && !event.location.trim()) missing.push('yer');
  if (!settings.vtoolsOrganizationName.trim()) missing.push('organizasyon birimi');
  if (!settings.vtoolsSpoid.trim()) missing.push('SPOID');
  if (!settings.vtoolsContactEmail.trim()) missing.push('iletişim e-postası');
  if (event.report?.participantCount === null || event.report?.participantCount === undefined) missing.push('toplam katılımcı');
  if (data.ieeeAttendees === null) missing.push('IEEE üyesi katılımcı');
  if (data.guestAttendees === null) missing.push('üye olmayan katılımcı');
  if (
    event.report?.participantCount !== null &&
    event.report?.participantCount !== undefined &&
    data.ieeeAttendees !== null &&
    data.guestAttendees !== null &&
    data.ieeeAttendees + data.guestAttendees !== event.report.participantCount
  ) {
    missing.push('katılımcı toplamı uyuşmuyor');
  }
  return missing;
}

export function vtoolsPreparationRow(event: HubEvent, settings: OrgSettings): (string | number | null)[] {
  const data = vtoolsData(event);
  const start = dateParts(event.startsAt, settings.vtoolsTimeZone);
  const end = dateParts(event.endsAt, settings.vtoolsTimeZone);
  return [
    event.code,
    event.name,
    event.report?.summary?.trim() || event.description,
    start.date,
    start.time,
    end.date,
    end.time,
    settings.vtoolsTimeZone,
    data.category,
    data.subcategory,
    data.locationType,
    event.location,
    settings.vtoolsOrganizationName,
    settings.vtoolsSpoid,
    settings.vtoolsContactEmail,
    data.tags,
    data.agenda,
    event.report?.participantCount ?? null,
    data.ieeeAttendees,
    data.guestAttendees,
    event.registrationLink,
    event.heptacertLink,
    event.driveLink,
    data.eventId,
    data.reportedAt,
    data.reportedBy,
  ];
}

export function vtoolsPreparationRows(events: HubEvent[], settings: OrgSettings) {
  return [VTOOLS_PREPARATION_HEADERS.slice(), ...events.map((event) => vtoolsPreparationRow(event, settings))];
}
