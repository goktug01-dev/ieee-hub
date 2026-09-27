import { Anchor, Box, Card, Container, Divider, Group, Image, Stack, Text, Title } from '@mantine/core';
import { Link, useParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, ErrorAlert, SectionLoader } from '../../components/ui';
import { PolicyLinks } from '../../components/PolicyLinks';
import { useDoc } from '../../lib/hooks';
import { POLICIES, policyBySlug } from '../../lib/privacy';
import type { PrivacyNotice } from '../../lib/types';

const dateTime = (value: PrivacyNotice['publishedAt']) =>
  new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(value.toDate());

/** Herkese açık politika sayfası: /politika/{slug}. Yürürlükteki sürümü gösterir. */
export function PolicyPage() {
  const { slug = '' } = useParams();
  const { publicSettings } = useAuth();
  const policy = policyBySlug(slug);
  const id = policy ? publicSettings[policy.field] ?? null : null;
  const notice = useDoc<PrivacyNotice>(id ? `privacyNotices/${id}` : null);
  const careerHost = window.location.hostname.includes('ieee-ikcu-kariyer');

  return (
    <Box mih="100vh" bg="var(--mantine-color-body)" py={{ base: 'lg', sm: 40 }}>
      <Container size="md">
        <Stack>
          <Group gap="sm">
            <Image src={publicSettings.logoDataUrl ?? '/favicon.svg'} h={36} w={36} fit="contain" alt="" />
            <Anchor component={Link} to={careerHost ? '/' : '/kariyer'} fw={700} c="inherit" underline="never">
              {publicSettings.orgShortName}
            </Anchor>
          </Group>
          {!policy ? (
            <EmptyState title="Sayfa bulunamadı" />
          ) : notice.loading ? (
            <SectionLoader />
          ) : notice.error ? (
            <ErrorAlert error={notice.error} />
          ) : !notice.data ? (
            <EmptyState title={policy.defaultTitle} description="Bu metin henüz yayımlanmadı." />
          ) : (
            <Card>
              <Title order={1} fz={{ base: 24, sm: 30 }}>{notice.data.title}</Title>
              <Text size="xs" c="dimmed" mt={4}>Sürüm {notice.data.versionLabel} · Yayım: {dateTime(notice.data.publishedAt)}</Text>
              <Divider my="md" />
              <Text size="sm" lh={1.7} style={{ whiteSpace: 'pre-wrap' }}>{notice.data.body}</Text>
            </Card>
          )}
          <PolicyLinks kinds={POLICIES.map((item) => item.kind).filter((kind) => kind !== policy?.kind)} />
        </Stack>
      </Container>
    </Box>
  );
}
