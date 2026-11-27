import { Accordion, Alert, Button, Card, Group, Select, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useEffect, useState } from 'react';
import { get, ref, update } from 'firebase/database';
import { externalServices } from '../../lib/externalFirebase';
import { useOrg } from '../../lib/org';
import { useSite } from '../../lib/siteIntegration';
import { SITE_CAPABILITIES, siteConnectionError } from '../../lib/siteConnection';
import type { ExternalFirebaseConfig } from '../../lib/opsTypes';
import { notifyError, notifySuccess } from '../../components/ui';

export function SiteSetupPanel({ config, onChange, stored }: { config: Omit<ExternalFirebaseConfig, 'updatedAt' | 'updatedBy'>; onChange: (patch: Partial<ExternalFirebaseConfig>) => void; stored: ExternalFirebaseConfig | null }) {
  const { units } = useOrg();
  const { user, siteAccess, retry } = useSite();
  const [uid, setUid] = useState(''), [capability, setCapability] = useState<string | null>('qr');
  const [expires, setExpires] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [committees, setCommittees] = useState<{ value: string; label: string }[]>([]);
  const [listError, setListError] = useState(''), [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    setCommittees([]); setListError('');
    if (!stored?.databaseURL || !user) return;
    let cancelled = false;
    setLoading(true);
    get(ref(externalServices(stored).realtime!, 'committees')).then(snapshot => {
      if (cancelled) return;
      setCommittees(Object.entries(snapshot.val() ?? {}).map(([value, item]) => ({ value, label: `${(item as { name?: string })?.name || value} · ${value}` })));
    }).catch(error => { if (!cancelled) setListError(siteConnectionError(error)); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [stored?.projectId, stored?.databaseURL, user?.uid, reload]);
  const grant = async (revoke: boolean) => {
    setBusy(true);
    try {
      if (!stored) throw new Error('Bağlantı ayarını önce kaydedin.');
      if (!uid.trim() || /[.#$\[\]/]/.test(uid)) throw new Error('Geçerli site Authentication UID’si girin.');
      const services = externalServices(stored);
      if (!services.auth.currentUser || !services.realtime) throw new Error('Site yöneticisi hesabıyla bağlanın.');
      if (!capability || !revoke && (!expires || !Number.isFinite(Date.parse(expires)) || Date.parse(expires) <= Date.now())) throw new Error('Gelecekteki görev bitiş tarihini girin.');
      await update(ref(services.realtime, `site_access/${uid.trim()}`), { [capability]: revoke ? null : Date.parse(expires!) });
      retry();
      notifySuccess(revoke ? 'Site işlem yetkisi kaldırıldı.' : 'Site işlem yetkisi görev bitişine kadar verildi.');
    } catch (error) { notifyError(new Error(siteConnectionError(error))); } finally { setBusy(false); }
  };
  return <Stack>
    <Card withBorder><Stack>
      <Group justify="space-between"><Title order={4}>Hub birimlerini sitedeki komitelerle eşleştir</Title><Button size="xs" variant="subtle" loading={loading} disabled={!user} onClick={() => setReload(x => x + 1)}>Site komitelerini yenile</Button></Group>
      <Text size="sm">Her Hub birimi için sitede zaten bulunan komiteyi seçin. Yeni komite veya rol oluşturulmaz. Puan QR’ı bu komite adına aktarılır; değişiklikten sonra Kurulumu kaydet deyin.</Text>
      {!user && <Alert color="yellow">Önce bağlantı ayarını kaydedip yukarıdaki karttan site hesabıyla giriş yapın. Ardından komiteler burada listelenir.</Alert>}
      {listError && <Alert color="orange">{listError}</Alert>}
      {user && !loading && !listError && !committees.length && <Text size="sm">Sitede komite bulunamadı. TechOps site projesini ve mevcut komiteleri kontrol etmeli.</Text>}
      {units.filter(unit => unit.active && unit.id !== 'branch').map(unit => {
        const selected = config.siteUnitMap?.[unit.id] || '';
        const choices = selected && !committees.some(item => item.value === selected) ? [...committees, { value: selected, label: `${selected} · Kayıtlı eşleme; listede doğrulanamadı` }] : committees;
        return <Select key={unit.id} label={unit.name} placeholder="Sitedeki komiteyi seçin" searchable clearable disabled={!user || loading} data={choices} value={selected || null} onChange={value => onChange({ siteUnitMap: { ...config.siteUnitMap, [unit.id]: value ?? '' } })} />;
      })}
    </Stack></Card>
    <Card withBorder><Stack>
      <Title order={4}>Site yöneticisi: kişiye süreli işlem yetkisi ver</Title>
      <Text size="sm">ACTOR kendi site hesabıyla bağlanıp bağlantı bilgisini kopyalar. Site yöneticisi bu bilgideki Site UID’yi aşağıya girer, işlemi ve görev bitişini seçer. Hub UID’si ile site UID’si farklı olabilir.</Text>
      <Alert color={siteAccess?.admin ? 'teal' : 'yellow'}>{siteAccess?.admin ? 'Bağlı site hesabı yönetici olarak doğrulandı.' : 'Bu işlem için site yöneticisi hesabıyla giriş yapmalısınız. Hub yöneticiliği yeterli değildir.'} ACTOR’a QR aktarımı için ayrıca süreli QR yetkisi gerekir.</Alert>
      <TextInput label="Yetki verilecek kişinin Site UID’si" description="Kişinin Web sitesi bağlantısı kartındaki TechOps bağlantı bilgisinden alınır." value={uid} onChange={e => setUid(e.currentTarget.value)} />
      {user && <Button size="xs" variant="subtle" onClick={() => setUid(user.uid)} style={{ alignSelf: 'flex-start' }}>Bağlı site hesabının UID’sini kullan</Button>}
      <SimpleGrid cols={{ base: 1, sm: 2 }}><Select label="İşlem yetkisi" data={Object.entries(SITE_CAPABILITIES).map(([value, label]) => ({ value, label }))} value={capability} onChange={setCapability} /><DateTimePicker label="Görev / yetki bitişi" value={expires} onChange={setExpires} /></SimpleGrid>
      <Group><Button loading={busy} disabled={!siteAccess?.admin || !uid.trim() || !expires} onClick={() => void grant(false)}>Süreli site yetkisini ver</Button><Button color="orange" variant="light" loading={busy} disabled={!siteAccess?.admin || !uid.trim()} onClick={() => void grant(true)}>Seçilen yetkiyi kaldır</Button></Group>
      <Text size="xs" c="dimmed">Bu düğmeler siteye hemen yazar; Kurulumu kaydet düğmesinden bağımsızdır. Son kararı sitenin yayımlanmış güvenlik kuralları verir.</Text>
    </Stack></Card>
    <Accordion variant="contained"><Accordion.Item value="paths"><Accordion.Control>TechOps için gelişmiş aktarım yolları</Accordion.Control><Accordion.Panel><Stack>
      <Text size="sm">Mevcut site yapısıyla aynıysa bu alanları değiştirmeniz gerekmez.</Text>
      <TextInput label="Site etkinlik takvimi yolu" value={config.siteEventsPath || 'events'} onChange={e => onChange({ siteEventsPath: e.currentTarget.value })} />
      <TextInput label="Site duyuruları yolu" value={config.siteAnnouncementsPath || 'public_announcements'} onChange={e => onChange({ siteAnnouncementsPath: e.currentTarget.value })} />
      <TextInput label="Puan QR dizini" value={config.siteQrPath || 'valid_qrs'} onChange={e => onChange({ siteQrPath: e.currentTarget.value })} />
      <TextInput label="Puan QR bağlantı şablonu" description="{qrId} QR kimliği, {committeeId} site komite kimliğiyle değiştirilir." value={config.siteQrUrlTemplate || 'https://studentbranches.ieee.org/tr-ikcu/profile/?qr_id={qrId}'} onChange={e => onChange({ siteQrUrlTemplate: e.currentTarget.value })} />
    </Stack></Accordion.Panel></Accordion.Item></Accordion>
  </Stack>;
}
