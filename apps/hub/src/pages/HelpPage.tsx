import { Accordion, Badge, Button, Card, Group, List, Select, SimpleGrid, Stack, Tabs, Text, TextInput, Textarea } from '@mantine/core';
import { IconLifebuoy } from '@tabler/icons-react';
import { addDoc, collection, doc, orderBy, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, PageHeader, notifyError, notifySuccess } from '../components/ui';
import { db } from '../firebase';
import { hasPermission } from '../lib/access';
import { fmtRelative } from '../lib/format';
import { useCollection } from '../lib/hooks';
import type { Feedback } from '../lib/opsTypes';
import type { WithId } from '../lib/types';

/** Rol bazlı kısa kılavuzlar (WP10-T02). */
const GUIDES: { role: string; items: string[] }[] = [
  {
    role: 'Gönüllü',
    items: [
      'Görevlerim sayfasında size atanan işleri görürsünüz; durumu "Devam ediyor" / "Tamamlandı" olarak güncelleyin.',
      'Görevde takıldığınızda durumu "Engellendi" yapıp yorum yazın; koordinatörünüz görür.',
      'Başka bir birimde gönüllü olmak için Gönüllülük sayfasından başvurun.',
      'Dilekçe yazmak için Yeni dilekçe > şablon seçin > formu doldurun. Belge sağda anında oluşur.',
    ],
  },
  {
    role: 'Koordinasyon Üyesi',
    items: [
      'Görevler > Yeni görev: her görevin tek sorumlusu, son tarihi ve tamamlanma ölçütü olmalı.',
      'Birim panosunda kartları sürükleyerek durum değiştirebilirsiniz.',
      'Etkinlikler > Etkinlik öner: öneri YK onayına veya etkinlik izin dilekçesine bağlanır.',
      'İletişim > İçerik talebi: tanıtım isteklerini buradan açın, WhatsApp üzerinden değil.',
    ],
  },
  {
    role: 'Birim Başkanı / Başkan Yardımcısı',
    items: [
      'Onayımı bekleyenler: birim dilekçelerinin ilk onay makamısınız. Onay için son 15 dakikada giriş yapılmış olmalı.',
      'Gönüllülük > Birimime gelen başvurular: kabul ettiğinizde rol ve oryantasyon görevleri kendiliğinden oluşur.',
      'İletişim biriminin hazırladığı içerikler yayından önce onayınıza düşer.',
      'Görev süreniz biterken Devir paketleri sayfasından paketinizi hazırlayın.',
    ],
  },
  {
    role: 'Genel Sekreter / Evrak',
    items: [
      'Dilekçe şablonları: Word dosyasını yükleyin, alanları ve onay zincirini düzenleyin, Yayımla deyin.',
      'Dilekçeler > Tüm evrak: arşiv ve evrak numaraları. Raporlar > Dilekçe metrikleri: onay süreleri.',
      'Raporlar > Haftalık operasyon: "Arşive kaydet" ile taslak oluşturup Arşiv sekmesinden onaylayın.',
      'Raporlar > Devir ve onaycılar: onaycısı olmayan dilekçe adımlarını dönem başında kontrol edin.',
    ],
  },
  {
    role: 'Sayman / Sponsorluk',
    items: [
      'Sponsorluk > Havuz: her firmanın tek sorumlusu vardır; başkaları Firma sorgula ile talep gönderir.',
      'Her aktif görüşmede "Sonraki işlem tarihi" dolu olmalı; boşsa veri kalitesi uyarısı çıkar.',
      'Bütçeler: planlanan ve gerçekleşen tutarları kalem kalem girin; ana kayıt Sheets\'te kalır.',
    ],
  },
  {
    role: 'Sistem Sorumlusu (TechOps)',
    items: [
      'Envanter: her kritik sistemde en az iki yönetici olmalı; tek yöneticili sistemler kırmızı işaretlenir.',
      'Destek talepleri bu sayfanın "Gelen talepler" sekmesindedir.',
      'Kurum ayarları ve kurucu yönetici devri yönetim devrinin parçasıdır.',
    ],
  },
];

export function HelpPage() {
  const { access } = useAuth();
  const isSupport = hasPermission(access, 'inventory.manage');
  const [tab, setTab] = useState<string | null>('kilavuz');
  return (
    <Stack>
      <PageHeader title="Yardım" description="Rolünüze göre kısa kılavuzlar ve sorun bildirimi." />
      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="kilavuz">Kılavuzlar</Tabs.Tab>
          <Tabs.Tab value="bildir">Sorun bildir</Tabs.Tab>
          {isSupport && <Tabs.Tab value="gelen">Gelen talepler</Tabs.Tab>}
        </Tabs.List>
        <Tabs.Panel value="kilavuz">
          <Accordion variant="separated" defaultValue="Gönüllü">
            {GUIDES.map((g) => (
              <Accordion.Item key={g.role} value={g.role}>
                <Accordion.Control>{g.role}</Accordion.Control>
                <Accordion.Panel>
                  <List spacing="xs" size="sm">
                    {g.items.map((i) => (
                      <List.Item key={i}>{i}</List.Item>
                    ))}
                  </List>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Tabs.Panel>
        <Tabs.Panel value="bildir">
          <Report />
        </Tabs.Panel>
        <Tabs.Panel value="gelen">{isSupport && <Inbox />}</Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function Report() {
  const { user } = useAuth();
  const mine = useCollection<Feedback>('feedback', [where('byUid', '==', user!.uid)], `fb-${user!.uid}`);
  const [f, setF] = useState({ category: 'Hata', page: '', text: '' });
  const send = async () => {
    if (!f.text.trim()) return;
    try {
      await addDoc(collection(db, 'feedback'), { ...f, byUid: user!.uid, byName: user!.displayName ?? '', status: 'open', at: serverTimestamp() });
      notifySuccess('Bildiriminiz TechOps’a iletildi.');
      setF({ category: 'Hata', page: '', text: '' });
    } catch (e) {
      notifyError(e);
    }
  };
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
      <Card>
        <Stack>
          <Group gap="xs">
            <IconLifebuoy size={20} />
            <Text fw={600}>Sorun bildir / öneri</Text>
          </Group>
          <Group grow>
            <Select data={['Hata', 'Öneri', 'Yetki sorunu', 'Soru']} value={f.category} onChange={(v) => setF({ ...f, category: v ?? 'Hata' })} />
            <TextInput placeholder="Hangi sayfa?" value={f.page} onChange={(e) => setF({ ...f, page: e.currentTarget.value })} />
          </Group>
          <Textarea placeholder="Ne oldu, ne bekliyordunuz?" autosize minRows={4} value={f.text} onChange={(e) => setF({ ...f, text: e.currentTarget.value })} />
          <Button onClick={() => void send()} disabled={!f.text.trim()}>
            Gönder
          </Button>
        </Stack>
      </Card>
      <Card>
        <Text fw={600} mb="sm">
          Bildirimlerim
        </Text>
        {mine.data.length === 0 ? (
          <Text size="sm" c="dimmed">
            Yok.
          </Text>
        ) : (
          mine.data.map((x) => (
            <div key={x.id} style={{ marginBottom: 10 }}>
              <Group gap={6}>
                <Badge size="xs">{x.category}</Badge>
                <Badge size="xs" color={x.status === 'open' ? 'yellow' : 'green'}>
                  {x.status === 'open' ? 'Açık' : 'Çözüldü'}
                </Badge>
                <Text size="xs" c="dimmed">
                  {fmtRelative(x.at)}
                </Text>
              </Group>
              <Text size="sm">{x.text}</Text>
              {x.response && (
                <Text size="sm" c="blue">
                  Yanıt: {x.response}
                </Text>
              )}
            </div>
          ))
        )}
      </Card>
    </SimpleGrid>
  );
}

function Inbox() {
  const { user } = useAuth();
  const list = useCollection<Feedback>('feedback', [orderBy('at', 'desc')], 'fb-all');
  const [resp, setResp] = useState<Record<string, string>>({});
  if (!list.data.length) return <EmptyState title="Talep yok" />;
  const resolve = (x: WithId<Feedback>) =>
    updateDoc(doc(db, 'feedback', x.id), { status: 'resolved', response: resp[x.id] ?? '', respondedBy: user!.uid, respondedAt: serverTimestamp() }).catch(notifyError);
  return (
    <Stack>
      {list.data.map((x) => (
        <Card key={x.id}>
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <div style={{ flex: '1 1 300px' }}>
              <Group gap={6}>
                <Badge size="xs">{x.category}</Badge>
                <Text size="sm" fw={600}>
                  {x.byName}
                </Text>
                <Text size="xs" c="dimmed">
                  {x.page} · {fmtRelative(x.at)}
                </Text>
              </Group>
              <Text size="sm" mt={4}>
                {x.text}
              </Text>
            </div>
            {x.status === 'open' ? (
              <Group align="flex-end">
                <TextInput placeholder="Yanıt" value={resp[x.id] ?? ''} onChange={(e) => setResp({ ...resp, [x.id]: e.currentTarget.value })} />
                <Button size="xs" onClick={() => void resolve(x)}>
                  Çözüldü
                </Button>
              </Group>
            ) : (
              <Badge color="green">Çözüldü</Badge>
            )}
          </Group>
        </Card>
      ))}
    </Stack>
  );
}
