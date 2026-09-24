import { Stack } from '@mantine/core';
import { EmptyState, ErrorAlert, PageHeader, SectionLoader } from '../../components/ui';
import { useInbox } from '../../lib/inbox';
import { PetitionRow } from '../DashboardPage';

export function InboxPage() {
  const { waiting, loading, error } = useInbox();
  return (
    <Stack>
      <PageHeader
        title="Onayımı bekleyenler"
        description="Görev atamalarınız gereği kararınızı bekleyen dilekçeler. Kendi dilekçelerinizi onaylayamazsınız."
      />
      <ErrorAlert error={error} />
      {loading ? (
        <SectionLoader />
      ) : waiting.length === 0 ? (
        <EmptyState title="Her şey yolunda" description="Şu anda onayınızı bekleyen dilekçe yok." />
      ) : (
        <Stack gap="xs">
          {waiting.map((p) => (
            <PetitionRow key={p.id} p={p} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
