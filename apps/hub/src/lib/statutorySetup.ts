import type { Assignment, Role, Unit, WithId } from './types';

export const STATUTORY_ROLE_LABELS: Record<string, string> = {
  president: 'Öğrenci Kolu Başkanı', internal: 'İç İşlerden Sorumlu Başkan Yardımcısı',
  secretary: 'Genel Sekreter', advisor: 'Akademik Danışman', audit: 'Denetleme Kurulu',
  actor: 'ACTOR', finance: 'Finansal Direktör', techops: 'TechOps Başkanı',
  external: 'Dış İşlerden Sorumlu Başkan Yardımcısı', technical: 'Teknik Projelerden Sorumlu Başkan Yardımcısı',
  committeePresident: 'Komite başkanı', committeeVice: 'Komite başkan yardımcısı',
  committeeCoordination: 'Komite koordinasyon üyesi', committeeAdvisor: 'Komite danışman öğretim görevlisi',
};

export const STATUTORY_LIMIT_LABELS: Record<string, string> = {
  archiveDays: 'Etkinlik arşivini tamamlama (gün)', boardMeetingDays: 'YK toplantıları arasında en fazla (gün)',
  weeklyReportDays: 'Komite rapor aralığı (gün)', digitalHandoverHours: 'Dijital erişim devri (saat)',
  actorHandoverDays: 'ACTOR devir teslimi (gün)', technicalHandoverDays: 'TechOps devir teslimi (gün)',
  electionHandoverDays: 'Seçim sonrası devir teslim (gün)', activityHandoverDays: 'Komite seçimlerini tamamlama (gün)',
  retentionYears: 'Üyelik sonrası veri saklama (yıl)', reservePercent: 'Acil Durum Fonu oranı (%)',
  boardAbsences: 'YK mazeretsiz devamsızlık eşiği (toplantı)', consecutiveAbsences: 'Ardışık mazeretsiz devamsızlık eşiği (toplantı)',
  assemblyMinimumSecond: 'İkinci Genel Kurul toplantısında en az katılımcı',
};

/** Gösterim içindir; imza yetkisini Firestore kuralları denetler. */
export function statutoryRoleChoices(committee: boolean, roles: WithId<Role>[], units: WithId<Unit>[], assignments: Assignment[], now: number) {
  return roles.filter(role => role.active && (!committee || role.scope === 'unit')).flatMap(role => {
    const scopes = committee ? [{ id: '*', name: 'Her komite' }]
      : role.scope === 'branch' ? [{ id: 'branch', name: 'Kol geneli' }]
        : units.filter(unit => unit.active);
    return scopes.map(unit => {
      const holders = assignments.filter(a => a.roleId === role.id && (unit.id === '*' || a.unitId === unit.id)
        && a.status === 'active' && a.startsAt.toMillis() <= now && (!a.endsAt || a.endsAt.toMillis() > now));
      const people = [...new Set(holders.map(a => `${a.memberName}${unit.id === '*' ? ` (${a.unitName})` : ''}`))];
      const value = `${unit.id}__${role.id}`;
      return { value, label: `${role.name} · ${unit.name} · ${value} · ${people.length} aktif görevli`, people };
    });
  });
}

export function validHolidayDates(dates: string[]) {
  return dates.every(value => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
}
