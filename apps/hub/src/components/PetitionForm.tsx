import { Checkbox, NumberInput, Select, SimpleGrid, Stack, TextInput, Textarea } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import type { Member, TemplateField } from '../lib/types';

export function prefillValues(fields: TemplateField[], member: Member | null, base: Record<string, string> = {}) {
  const out: Record<string, string> = { ...base };
  for (const f of fields) {
    if (out[f.key]) continue;
    if (f.prefill && member) out[f.key] = String(member[f.prefill] ?? '');
    else out[f.key] = out[f.key] ?? '';
  }
  return out;
}

export function missingRequired(fields: TemplateField[], values: Record<string, string>): TemplateField[] {
  return fields.filter((f) => f.required && !String(values[f.key] ?? '').trim());
}

export function PetitionForm({
  fields,
  values,
  onChange,
  showErrors,
  disabled,
}: {
  fields: TemplateField[];
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  showErrors?: boolean;
  disabled?: boolean;
}) {
  const set = (key: string, v: string) => onChange({ ...values, [key]: v });
  const err = (f: TemplateField) => (showErrors && f.required && !String(values[f.key] ?? '').trim() ? 'Bu alan zorunlu' : undefined);

  const short = fields.filter((f) => f.type !== 'textarea');
  const long = fields.filter((f) => f.type === 'textarea');

  const render = (f: TemplateField) => {
    const common = {
      label: f.label,
      description: f.help || undefined,
      required: f.required,
      error: err(f),
      disabled,
    };
    switch (f.type) {
      case 'textarea':
        return (
          <Textarea key={f.key} {...common} autosize minRows={4} maxRows={14} value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.currentTarget.value)} />
        );
      case 'date':
        return (
          <DateInput
            key={f.key}
            {...common}
            valueFormat="DD.MM.YYYY"
            placeholder="GG.AA.YYYY"
            clearable
            value={values[f.key] || null}
            onChange={(v) => set(f.key, v ?? '')}
          />
        );
      case 'number':
        return (
          <NumberInput
            key={f.key}
            {...common}
            thousandSeparator="."
            decimalSeparator=","
            value={values[f.key] === '' || values[f.key] === undefined ? '' : Number(values[f.key])}
            onChange={(v) => set(f.key, v === '' ? '' : String(v))}
          />
        );
      case 'select':
        return (
          <Select
            key={f.key}
            {...common}
            data={f.options ?? []}
            value={values[f.key] || null}
            onChange={(v) => set(f.key, v ?? '')}
            searchable
          />
        );
      case 'email':
        return <TextInput key={f.key} {...common} type="email" value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.currentTarget.value)} />;
      case 'phone':
        return <TextInput key={f.key} {...common} type="tel" value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.currentTarget.value)} />;
      case 'checkbox':
        return (
          <Checkbox
            key={f.key}
            {...common}
            mt="md"
            checked={values[f.key] === '☒'}
            onChange={(e) => set(f.key, e.currentTarget.checked ? '☒' : '')}
          />
        );
      default:
        return <TextInput key={f.key} {...common} value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.currentTarget.value)} />;
    }
  };

  return (
    <Stack gap="md">
      {short.length > 0 && <SimpleGrid cols={{ base: 1, sm: 2 }}>{short.map(render)}</SimpleGrid>}
      {long.map(render)}
    </Stack>
  );
}
