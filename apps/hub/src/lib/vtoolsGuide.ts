export const VTOOLS_LINKS = {
  events: 'https://events.vtools.ieee.org/',
  create: 'https://kb.ieee.org/vtools/blog/kb/creating-an-event/',
  existingReport: 'https://kb.ieee.org/vtools/blog/kb/file-a-report-for-a-past-event-already-in-the-system/',
  newReport: 'https://kb.ieee.org/vtools/blog/kb/file-a-report-for-a-past-event-not-in-the-system/',
  categories: 'https://kb.ieee.org/vtools/blog/kb/event-categories-and-sub-categories/',
};

export const VTOOLS_CATEGORIES = [
  { value: 'Technical', label: 'Technical · Teknik', description: 'Teknik seminer, atölye veya bilimsel içerik. Bu kategoride alt kategori yok.' },
  { value: 'Professional', label: 'Professional · Mesleki gelişim', description: 'Kariyer ve mesleki beceri odaklı etkinlikler.' },
  { value: 'Nontechnical', label: 'Nontechnical · Teknik olmayan', description: 'Teknik içerik taşımayan etkinlikler; uygun alt kategoriyi vTools’ta kontrol edin.' },
  { value: 'Administrative', label: 'Administrative · İdari', description: 'Yönetim ve organizasyon toplantıları.' },
  { value: 'Humanitarian', label: 'Humanitarian · İnsani çalışmalar', description: 'İnsani ihtiyaçlara ve toplum yararına yönelik çalışmalar.' },
  { value: 'Pre-U STEM Program', label: 'Pre-U STEM Program · Üniversite öncesi STEM', description: 'Üniversite öncesi öğrencilere yönelik STEM programları.' },
];

/** Yalnız resmî vTools etkinlik adresi veya pozitif sayısal kimlik kabul edilir. */
export function parseVtoolsEventId(value: string): string | null {
  const input = value.trim();
  if (/^[1-9]\d*$/.test(input)) return input;
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.hostname !== 'events.vtools.ieee.org' || url.username || url.password) return null;
    return /^\/m\/([1-9]\d*)\/?$/.exec(url.pathname)?.[1] ?? null;
  } catch { return null; }
}

export function validTimeZone(value: string): boolean {
  try { new Intl.DateTimeFormat('tr-TR', { timeZone: value }).format(); return !!value.trim(); }
  catch { return false; }
}
