export const HEPTACERT_CSV_CONTRACT_VERSION = 'heptacert-csv-v1';

/** Basit, tırnak destekli CSV/TSV ayrıştırıcı (virgül, noktalı virgül veya sekme). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const separators = [',', ';', '\t'] as const;
  const sep = separators.reduce((best, candidate) =>
    firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best,
  );
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
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

const HEADER_ALIASES: Record<string, string[]> = {
  name: ['ad soyad', 'adsoyad', 'name', 'full name', 'isim', 'ad', 'katılımcı', 'katilimci', 'participant name'],
  email: ['e-posta', 'eposta', 'email', 'e-mail', 'mail', 'email address', 'e posta adresi'],
  attended: ['katıldı', 'katildi', 'attended', 'attendance', 'check-in', 'checkin', 'checked in', 'yoklama', 'durum'],
  certificate: ['sertifika', 'certificate', 'sertifika no', 'certificate id', 'certificate code', 'sertifika kodu'],
};

const normalizeHeader = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ı]/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export interface CsvPreview {
  columns: { name: number; email: number; attended: number; certificate: number };
  rows: { name: string; email: string; attended: boolean; certificate: string; extra: Record<string, string> }[];
  errors: string[];
  duplicates: number;
  headers: string[];
  sourceRows: number;
  warnings: string[];
}

export function previewParticipantsCsv(text: string): CsvPreview {
  const rows = parseCsv(text);
  const headers = (rows[0] ?? []).map((header) => header.trim());
  const lower = headers.map(normalizeHeader);
  const find = (key: keyof typeof HEADER_ALIASES) => {
    const aliases = HEADER_ALIASES[key].map(normalizeHeader);
    return lower.findIndex((header) => aliases.includes(header));
  };
  const columns = { name: find('name'), email: find('email'), attended: find('attended'), certificate: find('certificate') };
  const errors: string[] = [];
  const warnings: string[] = [];
  if (columns.email < 0) errors.push('E-posta sütunu bulunamadı (başlık: "E-posta" veya "Email").');
  if (columns.name < 0) warnings.push('Ad soyad sütunu bulunamadı; katılımcı adları boş aktarılacak.');
  if (columns.attended < 0) warnings.push('Katılım sütunu bulunamadı; tüm satırlar katıldı kabul edilecek.');
  if (columns.certificate < 0) warnings.push('Sertifika sütunu bulunamadı; sertifika kodları boş aktarılacak.');
  const seen = new Set<string>();
  let duplicates = 0;
  const output: CsvPreview['rows'] = [];
  rows.slice(1).forEach((row, index) => {
    const email = (row[columns.email] ?? '').trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      errors.push(`Satır ${index + 2}: geçersiz e-posta "${email}"`);
      return;
    }
    if (seen.has(email)) {
      duplicates++;
      return;
    }
    seen.add(email);
    const attendance = columns.attended >= 0 ? (row[columns.attended] ?? '').trim().toLocaleLowerCase('tr') : '';
    const extra: Record<string, string> = {};
    headers.forEach((header, column) => {
      if (![columns.name, columns.email, columns.attended, columns.certificate].includes(column) && row[column]?.trim()) {
        extra[header] = row[column].trim();
      }
    });
    output.push({
      name: columns.name >= 0 ? (row[columns.name] ?? '').trim() : '',
      email,
      attended: columns.attended < 0 ? true : ['1', 'evet', 'yes', 'true', 'x', 'katıldı', 'katildi', 'var', 'checked in'].includes(attendance),
      certificate: columns.certificate >= 0 ? (row[columns.certificate] ?? '').trim() : '',
      extra,
    });
  });
  return { columns, rows: output, errors, duplicates, headers, sourceRows: Math.max(0, rows.length - 1), warnings };
}
