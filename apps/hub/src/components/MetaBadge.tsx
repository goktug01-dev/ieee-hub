import { Badge, type BadgeProps } from '@mantine/core';

/** Durum sözlüklerinden (label + color) rozet üretir. */
export function MetaBadge<K extends string>({
  map,
  value,
  ...props
}: { map: Record<K, { label: string; color: string }>; value: K } & Omit<BadgeProps, 'color' | 'children'>) {
  const m = map[value];
  if (!m) return null;
  return (
    <Badge color={m.color} {...props}>
      {m.label}
    </Badge>
  );
}

export function dueInfo(due: string | null, done: boolean): { label: string; color: string } | null {
  if (!due || done) return null;
  const days = Math.ceil((new Date(due).getTime() - new Date(new Date().toDateString()).getTime()) / 864e5);
  if (days < 0) return { label: `${-days} gün gecikti`, color: 'red' };
  if (days === 0) return { label: 'Bugün', color: 'orange' };
  if (days <= 2) return { label: `${days} gün kaldı`, color: 'yellow' };
  return null;
}
