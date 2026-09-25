export const DEFAULT_PETITION_CATEGORIES = [
  'Üyelik ve Görev',
  'Disiplin ve Denetim',
  'Finans ve Harcama',
  'Etkinlik ve Risk',
  'Envanter ve Zimmet',
  'Yönetim Kurulu',
  'Atama ve Seçim',
  'TechOps',
  'Genel',
] as const;

const RULES: Array<{ category: string; series: string; words: string[] }> = [
  { category: 'Finans ve Harcama', series: 'HRC', words: ['HARCAMA', 'BÜTÇE'] },
  { category: 'Etkinlik ve Risk', series: 'RSK', words: ['GEZİ', 'RİSK'] },
  { category: 'Envanter ve Zimmet', series: 'ZMT', words: ['DEMİRBAŞ', 'ZİMMET', 'TESLİM'] },
  { category: 'TechOps', series: 'TOP', words: ['TECHOPS', 'STAJYER', 'STANDART BELGE'] },
  { category: 'Disiplin ve Denetim', series: 'DNT', words: ['DENETLEME', 'SAVUNMA', 'İTİRAZ', 'VETO', 'SIFIR TOLERANS', 'DİSİPLİN', 'İHRAÇ'] },
  { category: 'Atama ve Seçim', series: 'ATM', words: ['ATAMA', 'SEÇİM', 'KAYYUM', 'AKTİFLİK', 'STATÜ', 'ACTOR'] },
  { category: 'Yönetim Kurulu', series: 'YKK', words: ['YÖNETİM KURULU', 'KARARNAME', 'TOPLANTI TUTANAĞI'] },
  { category: 'Üyelik ve Görev', series: 'UYE', words: ['İSTİFA', 'GÖREVDEN', 'ÜYELİKTEN'] },
];

function normalized(value: string) {
  return value
    .replace(/\.docx$/i, '')
    .replace(/^\d+[_\-\s]*/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyPetitionFile(fileName: string): { name: string; category: string; series: string } {
  const name = normalized(fileName);
  const upper = name.toLocaleUpperCase('tr');
  const match = RULES.find((rule) => rule.words.some((word) => upper.includes(word)));
  return { name, category: match?.category ?? 'Genel', series: match?.series ?? 'GEN' };
}
