export function statutoryCasesLink({ kind, caseId, unitId, subjectUid }: { kind?: string; caseId?: string; unitId?: string; subjectUid?: string } = {}): string {
  const params = new URLSearchParams({ sekme: 'dosyalar' });
  if (kind) params.set('surec', kind);
  if (caseId) params.set('dosya', caseId);
  if (unitId) params.set('birim', unitId);
  if (subjectUid) params.set('uye', subjectUid);
  return `/surecler?${params}`;
}

export function statutoryTab(params: URLSearchParams, oversight: boolean, configure: boolean): string {
  const allowed = ['dosyalar', 'aktiflik', ...(oversight ? ['takip', 'genelkurul', 'yedek'] : []), ...(configure ? ['ayarlar'] : [])];
  const requested = params.get('sekme') || 'dosyalar';
  return allowed.includes(requested) ? requested : 'dosyalar';
}
