import { Alert, Badge, Button, Card, Group, SegmentedControl, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { useCollection } from '../lib/hooks';
import { siteQrController, type EventPoints } from '../lib/siteWorkflow';
import { eventPointsStatusColor, eventPointsStatusLabel, SitePublicationStatus } from '../components/SiteWorkflows';
import { SiteConnection, useSite } from '../lib/siteIntegration';
import { EmptyState, ErrorAlert, PageHeader } from '../components/ui';
import { useOrg } from '../lib/org';
import type { HubEvent } from '../lib/opsTypes';
export function ActorPage() {
  const { access, can } = useAuth();
  const { unitName } = useOrg();
  const { config } = useSite();
  const allowed = siteQrController(access);
  const requests = useCollection<EventPoints>(allowed ? 'eventPointRequests' : null);
  const events = useCollection<HubEvent>(allowed ? 'events' : null);
  const [filter, setFilter] = useState('pending');
  if (!allowed) return <EmptyState title="Bu alan ACTOR görevine aittir" />;
  const pending = requests.data.filter(item => item.status === 'requested');
  const items = requests.data.filter(item => filter === 'all' || (filter === 'pending' ? item.status === 'requested' : ['approved', 'closed'].includes(item.status)))
    .sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
  return <Stack gap="lg">
    <PageHeader title="ACTOR · Aktiflik puanı ve QR" description="Önce puan önerisini değerlendirin. Doğruladığınız QR, yetkili site hesabınız bağlıyken studentbranches sitesine aktarılır." />
    <SiteConnection capability="qr" />
    <Text size="sm" c="dimmed">Sıra: öneriyi aç → puanı doğrula veya gerekçeyle geri gönder → site aktarımını kontrol et → etkinlikte puan QR’ını paylaş. Bu QR, vTools’un etkinlik bağlantısı QR’ından farklıdır.</Text>
    <SegmentedControl value={filter} onChange={setFilter} data={[{ value: 'pending', label: `Karar bekleyen (${pending.length})` }, { value: 'approved', label: 'Doğrulanan / kapatılan' }, { value: 'all', label: 'Tüm öneriler' }]} />
    <ErrorAlert error={requests.error || events.error} />
    {items.map(item => {
      const event = events.data.find(event => event.id === item.eventId);
      const mapped = !!config?.siteUnitMap?.[item.unitId];
      return <Card key={item.id} withBorder><Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap"><div><Text fw={700}>{event?.name ?? 'Etkinlik yükleniyor…'}</Text><Text size="sm" c="dimmed">{unitName(item.unitId)} · {item.points} puan{item.proposedPoints !== undefined ? ` (komite önerisi ${item.proposedPoints})` : ''}</Text></div><Badge color={eventPointsStatusColor[item.status]}>{eventPointsStatusLabel[item.status]}</Badge></Group>
        <Text size="sm">{item.note}</Text>
        {['approved', 'closed'].includes(item.status) && <SitePublicationStatus kind="qr" id={item.eventId} version={item.updatedAt} />}
        {!mapped && <Alert color="orange" title="Site komitesi eşleştirilmemiş">{unitName(item.unitId)} biriminin sitedeki komitesi seçilmeden QR aktarılamaz. {can('external.firebase.manage') ? <Button component={Link} to="/yonetim/harici-firebase?sekme=kurulum" variant="subtle" size="xs">Komite eşlemesini tamamla</Button> : 'TechOps’tan bu komiteyi site bağlantısına eklemesini isteyin.'}</Alert>}
        <Button component={Link} to={`/etkinlikler/${item.eventId}?sekme=puan`} variant="light">Etkinliği ve puan önerisini aç</Button>
      </Stack></Card>;
    })}
    {!requests.loading && !items.length && <EmptyState title={filter === 'pending' ? 'Kararınızı bekleyen puan önerisi yok' : 'Bu görünümde puan önerisi yok'} description="Geri gönderilen önerileri Tüm öneriler görünümünde bulabilirsiniz." />}
  </Stack>;
}
