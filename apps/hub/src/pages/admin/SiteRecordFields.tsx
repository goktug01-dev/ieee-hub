import { Checkbox, NumberInput, Select, Stack, TextInput, Textarea } from '@mantine/core';

export const siteFields: Record<string, { key: string; label: string; type?: 'number' | 'boolean' | 'text'; choices?: string[]; required?: boolean; max?: number }[]> = {
  committees: [{ key: 'name', label: 'Komite adı', required: true, max: 80 }, { key: 'presidentUid', label: 'Başkanın site Firebase UID’si', max: 128 }],
  public_announcements: [{ key: 'title', label: 'Başlık', required: true, max: 160 }, { key: 'content', label: 'Duyuru metni', type: 'text', required: true }, { key: 'committeeId', label: 'Komite kimliği' }, { key: 'tag', label: 'Etiket' }, { key: 'link', label: 'Bağlantı' }, { key: 'pinned', label: 'Sabitlenmiş', type: 'boolean' }],
  committee_announcements: [{ key: 'title', label: 'Başlık', required: true, max: 160 }, { key: 'content', label: 'Duyuru metni', type: 'text', required: true }, { key: 'tag', label: 'Etiket' }, { key: 'link', label: 'Bağlantı' }, { key: 'pinned', label: 'Sabitlenmiş', type: 'boolean' }],
  committee_qrs: [{ key: 'event', label: 'Etkinlik adı', required: true, max: 160 }, { key: 'puan', label: 'Katılım puanı', type: 'number', required: true }, { key: 'active', label: 'QR aktif', type: 'boolean' }],
  technical_events: [{ key: 'title', label: 'Etkinlik adı', required: true, max: 160 }, { key: 'committeeId', label: 'Komite kimliği', required: true, max: 40 }, { key: 'description', label: 'Açıklama', type: 'text' }, { key: 'pointCost', label: 'Katılım için harcanacak puan', type: 'number', required: true }, { key: 'location', label: 'Yer', max: 200 }, { key: 'start', label: 'Başlangıç (sitenin tarih biçimi)' }, { key: 'status', label: 'Durum', choices: ['open', 'archived'] }],
  events: [{ key: 'title', label: 'Başlık', required: true, max: 120 }, { key: 'desc', label: 'Açıklama', type: 'text', max: 5000 }, { key: 'start', label: 'Başlangıç', required: true }, { key: 'end', label: 'Bitiş' }, { key: 'location', label: 'Yer', max: 200 }, { key: 'visibility', label: 'Görünürlük', choices: ['public', 'members'], required: true }, { key: 'status', label: 'Durum', choices: ['pending', 'published'], required: true }],
};

export function siteKind(path: string) {
  const parts = path.split('/');
  return siteFields[parts[0]] && (parts.length === 1 && !parts[0].startsWith('committee_') || parts.length === 2 && parts[0].startsWith('committee_')) ? parts[0] : null;
}

export function SiteRecordFields({ kind, data, onChange, readOnly }: { kind: string; data: Record<string, unknown>; onChange: (data: Record<string, unknown>) => void; readOnly: boolean }) {
  const change = (key: string, value: unknown) => {
    const next = { ...data };
    if (value === '' || value === null) delete next[key]; else next[key] = value;
    onChange(next);
  };
  return <Stack>{siteFields[kind].map((field) => field.type === 'boolean'
    ? <Checkbox key={field.key} label={field.label} checked={data[field.key] === true} disabled={readOnly} onChange={(e) => change(field.key, e.currentTarget.checked)} />
    : field.type === 'number' ? <NumberInput key={field.key} label={field.label} required={field.required} value={typeof data[field.key] === 'number' ? data[field.key] as number : ''} min={field.key === 'puan' ? -100000 : 0} max={100000} disabled={readOnly} onChange={(value) => change(field.key, value === '' ? '' : Number(value))} />
    : field.choices ? <Select key={field.key} label={field.label} required={field.required} data={field.choices} value={String(data[field.key] ?? '') || null} disabled={readOnly} onChange={(value) => change(field.key, value)} />
    : field.type === 'text' ? <Textarea key={field.key} label={field.label} required={field.required} maxLength={field.max} value={String(data[field.key] ?? '')} readOnly={readOnly} autosize minRows={4} onChange={(e) => change(field.key, e.currentTarget.value)} />
    : <TextInput key={field.key} label={field.label} required={field.required} maxLength={field.max} value={String(data[field.key] ?? '')} readOnly={readOnly} onChange={(e) => change(field.key, e.currentTarget.value)} />)}</Stack>;
}
