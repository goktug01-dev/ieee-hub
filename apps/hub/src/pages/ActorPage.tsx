import { Badge, Button, Card, Group, Stack, Text } from '@mantine/core';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { useCollection } from '../lib/hooks';
import { siteQrController, type EventPoints } from '../lib/siteWorkflow';
import { eventPointsStatusColor, eventPointsStatusLabel } from '../components/SiteWorkflows';
import { SiteConnection } from '../lib/siteIntegration';
import { EmptyState, ErrorAlert, PageHeader } from '../components/ui';
export function ActorPage() {
  const { access } = useAuth();
  const allowed = siteQrController(access);
  const requests = useCollection<EventPoints>(allowed ? 'eventPointRequests' : null);
  if (!allowed) return <EmptyState title="Bu alan ACTOR görevine aittir" />;
  return <Stack><PageHeader title="ACTOR · Aktiflik puanı ve QR" description="Komitelerin puan önerilerini inceleyin; olduğu gibi ya da puanı değiştirerek doğrulayın veya komiteye geri gönderin." /><SiteConnection /><ErrorAlert error={requests.error} />{[...requests.data].sort((a, b) => (a.status === 'requested' ? 0 : 1) - (b.status === 'requested' ? 0 : 1) || (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0)).map(p => <Card key={p.id} withBorder><Group justify="space-between"><div><Text fw={600}>{p.points} puan · {p.unitId}{p.proposedPoints !== undefined ? ` (komite önerisi ${p.proposedPoints})` : ''}</Text><Text size="sm">{p.note}</Text><Badge color={eventPointsStatusColor[p.status]}>{eventPointsStatusLabel[p.status]}</Badge></div><Button component={Link} to={`/etkinlikler/${p.eventId}?sekme=puan`}>Etkinliği ve puan önerisini aç</Button></Group></Card>)}{!requests.data.length && <EmptyState title="Puan önerisi yok" />}</Stack>;
}
