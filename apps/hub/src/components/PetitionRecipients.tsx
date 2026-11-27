import { Select, Stack, Text } from '@mantine/core';
import { useActiveMembers } from '../lib/members';
import type { ApprovalStep } from '../lib/types';

export function PetitionRecipients({ steps, ownerUid, value, onChange, disabled = false }: {
  steps: ApprovalStep[]; ownerUid: string; value: Record<string, string>;
  onChange: (next: Record<string, string>) => void; disabled?: boolean;
}) {
  const personal = steps.some((step) => step.recipientMode === 'person');
  const { members, loading } = useActiveMembers(personal);
  if (!personal) return null;
  const options = members.filter((member) => member.uid !== ownerUid).map((member) => ({ value: member.uid, label: `${member.displayName} (${member.email})` }));
  return <Stack gap="sm">
    <Text size="sm" c="dimmed">Bu adımlar için doğrudan bir kişi seçebilirsiniz. İstek, seçtiğiniz kişinin onay kutusuna gider; rol ataması gerekmez.</Text>
    {steps.map((step, index) => step.recipientMode === 'person' && <Select
      key={index} label={`${index + 1}. ${step.name} · İmzalayacak kişi`} required searchable
      placeholder={loading ? 'Üyeler yükleniyor…' : 'Kişi seçin'}
      nothingFoundMessage="Aktif üye bulunamadı" data={options}
      value={value[String(index)] ?? null} disabled={disabled || loading}
      error={value[String(index)] && !loading && !options.some((option) => option.value === value[String(index)]) ? 'Bu kişi artık aktif üye değil. Başka bir kişi seçin.' : undefined}
      onChange={(uid) => {
        const next = { ...value };
        if (uid) next[String(index)] = uid;
        else delete next[String(index)];
        onChange(next);
      }}
    />)}
  </Stack>;
}
