import { Alert, Anchor, Badge, Button, Card, Checkbox, CopyButton, Group, NumberInput, Select, SimpleGrid, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { EMPTY_VTOOLS_DATA, VTOOLS_PREPARATION_HEADERS, vtoolsMissingFields, vtoolsPreparationRow, vtoolsPreparationRows } from '../lib/eventExports';
import { downloadText, toCsv, updateEvent } from '../lib/ops';
import type { HubEvent, VToolsEventData } from '../lib/opsTypes';
import { parseVtoolsEventId, VTOOLS_CATEGORIES, VTOOLS_LINKS } from '../lib/vtoolsGuide';
import { notifyError, notifySuccess } from './ui';

export function VToolsPreparation({ e, id, canManage }: { e: HubEvent; id: string; canManage: boolean }) {
  const { orgSettings, user, can } = useAuth();
  const [data, setData] = useState<VToolsEventData>({ ...EMPTY_VTOOLS_DATA, ...(e.vtools ?? {}) });
  const [busy, setBusy] = useState(false), [confirmed, setConfirmed] = useState(false);
  useEffect(() => { setData({ ...EMPTY_VTOOLS_DATA, ...(e.vtools ?? {}) }); setConfirmed(false); }, [e.vtools]);
  const eventWithDraft = { ...e, vtools: data };
  const missing = vtoolsMissingFields(eventWithDraft, orgSettings);
  const eventId = parseVtoolsEventId(data.eventId);
  const set = <K extends keyof VToolsEventData>(key: K, value: VToolsEventData[K]) => { setConfirmed(false); setData(current => ({ ...current, [key]: value })); };
  const rows = vtoolsPreparationRow(eventWithDraft, orgSettings);
  const copyText = VTOOLS_PREPARATION_HEADERS.map((label, index) => `${label}: ${rows[index] ?? '—'}`).join('\n');
  const save = async (reported = false) => {
    if (reported && (missing.length || !eventId || !confirmed)) return;
    setBusy(true);
    try {
      if (data.eventId.trim() && !eventId) throw new Error('vTools etkinlik adresini veya sayısal etkinlik kimliğini girin.');
      const next = { ...data, eventId: eventId ?? '', ...(reported ? { reportedAt: new Date().toISOString(), reportedBy: user!.displayName ?? user!.email ?? '' } : {}) };
      await updateEvent(id, { vtools: next, vtoolsStatus: reported ? 'reported' : e.vtoolsStatus === 'not_required' ? 'pending' : e.vtoolsStatus });
      setData(next); setConfirmed(false);
      notifySuccess(reported ? 'Resmî bildirimin takip kaydı Hub’a işlendi.' : 'vTools hazırlığı kaydedildi.');
    } catch (error) { notifyError(error); } finally { setBusy(false); }
  };
  const categoryOptions = data.category && !VTOOLS_CATEGORIES.some(item => item.value === data.category)
    ? [...VTOOLS_CATEGORIES, { value: data.category, label: `${data.category} · Mevcut değer`, description: '' }] : VTOOLS_CATEGORIES;
  return <Stack>
    <Alert title="vTools’u nasıl dolduracağım?" color="blue">Önce aşağıdaki bilgileri hazırlayın, sonra IEEE hesabınızla vTools’a girip resmî formu gönderin. Hub bu formu sizin yerinize göndermez. Studentbranches puan QR’ı ve site hesabı bu işlemden ayrıdır.</Alert>
    <Card withBorder><Stack>
      <Group justify="space-between"><Title order={4}>1. Etkinlik bilgilerini kontrol et</Title><Badge color={e.vtoolsStatus === 'reported' ? 'teal' : 'gray'}>{e.vtoolsStatus === 'reported' ? 'Bildirildi' : e.vtoolsStatus === 'not_required' ? 'Gerekmiyor' : 'Hazırlanıyor'}</Badge></Group>
      <Text size="sm">Başlık, tarih, yer ve açıklama etkinliğinizden; toplam katılımcı Kapanış sekmesinden alınır. Kurum bilgileri tüm etkinliklerde ortak kullanılır.</Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>{[
        ['Etkinlik başlığı', e.name], ['Başlangıç / bitiş', `${rows[3]} ${rows[4]} → ${rows[5]} ${rows[6]} (${orgSettings.vtoolsTimeZone})`],
        ['Yer', e.location], ['Primary Host / Organizasyon birimi', orgSettings.vtoolsOrganizationName],
        ['İletişim e-postası', orgSettings.vtoolsContactEmail], ['Kapanıştaki toplam katılımcı', e.report?.participantCount?.toString() ?? ''],
      ].map(([label, value]) => <div key={label}><Text size="xs" c="dimmed">{label}</Text><Text size="sm" style={{ overflowWrap: 'anywhere' }}>{value || 'Henüz girilmedi'}</Text></div>)}</SimpleGrid>
      <Textarea label="vTools’a aktarılacak açıklama / özet" value={e.report?.summary?.trim() || e.description} readOnly autosize minRows={2} maxRows={5} />
      <Group><Button component={Link} to={`/etkinlikler/${id}?sekme=genel`} variant="subtle" size="xs">Etkinlik bilgileri</Button><Button component={Link} to={`/etkinlikler/${id}?sekme=kapanis`} variant="subtle" size="xs">Kapanış ve toplam katılımcı</Button>{can('org.manage') && <Button component={Link} to="/yonetim/ayarlar" variant="subtle" size="xs">Kurum vTools ayarları</Button>}</Group>
      {(!orgSettings.vtoolsOrganizationName || !orgSettings.vtoolsContactEmail) && <Alert color="yellow">Kurum yöneticisi organizasyon birimi adını ve iletişim e-postasını Kurum ayarlarında bir kez tanımlamalı. SPOID biliniyorsa eklenir; vTools’ta ev sahibi birimi adıyla da seçebilirsiniz.</Alert>}
    </Stack></Card>
    <Card withBorder><Stack>
      <Title order={4}>2. Kategori ve gerçek katılımı tamamla</Title>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Select label="Etkinlik kategorisi" placeholder="İçeriğe uygun kategoriyi seçin" data={categoryOptions} value={data.category || null} onChange={value => { setConfirmed(false); setData(current => ({ ...current, category: value ?? '', subcategory: value === 'Technical' ? '' : current.subcategory })); }} readOnly={!canManage} description={categoryOptions.find(item => item.value === data.category)?.description} />
        <TextInput label="Alt kategori" description={data.category === 'Technical' ? 'Technical için alt kategori kullanılmaz.' : 'Seçtiğiniz kategori için vTools’ta sunulan alt kategoriyi yazın.'} value={data.subcategory} onChange={x => set('subcategory', x.currentTarget.value)} disabled={data.category === 'Technical'} readOnly={!canManage} />
        <Select label="Konum türü" data={[{ value: 'physical', label: 'Fiziksel' }, { value: 'virtual', label: 'Çevrim içi' }, { value: 'hybrid', label: 'Hibrit' }]} value={data.locationType} onChange={value => set('locationType', (value ?? 'physical') as VToolsEventData['locationType'])} readOnly={!canManage} />
        <TextInput label="Etiketler" description="İsteğe bağlı; virgülle ayırın." value={data.tags} onChange={x => set('tags', x.currentTarget.value)} readOnly={!canManage} />
        <NumberInput label="IEEE üyesi katılımcı" description="Gerçek IEEE üyeliğine göre sayın; Hub/site hesabı üyelik kanıtı değildir." min={0} allowDecimal={false} value={data.ieeeAttendees ?? ''} onChange={value => set('ieeeAttendees', value === '' ? null : Number(value))} readOnly={!canManage} />
        <NumberInput label="Üye olmayan katılımcı" description="Bu iki sayı Kapanış sekmesindeki toplam katılımcıya eşit olmalı." min={0} allowDecimal={false} value={data.guestAttendees ?? ''} onChange={value => set('guestAttendees', value === '' ? null : Number(value))} readOnly={!canManage} />
      </SimpleGrid>
      <Textarea label="Gündem" description="İsteğe bağlı; oturumların akışını yazın." autosize minRows={2} value={data.agenda} onChange={x => set('agenda', x.currentTarget.value)} readOnly={!canManage} />
      <Anchor href={VTOOLS_LINKS.categories} target="_blank" rel="noreferrer" size="sm">IEEE kategori ve alt kategori rehberi</Anchor>
      {missing.length ? <Alert color="orange" title="Hazırlıkta tamamlanacaklar">{missing.join(', ')}</Alert> : <Alert color="teal">Hazırlık tamam. Bilgileri kopyalayıp resmî vTools formuna geçebilirsiniz.</Alert>}
      <Group>{canManage && <Button variant="default" loading={busy} onClick={() => void save()}>Taslağı kaydet</Button>}<CopyButton value={copyText}>{({ copied, copy }) => <Button onClick={copy} variant="light">{copied ? 'Kopyalandı' : 'Form bilgilerini kopyala'}</Button>}</CopyButton><Button variant="subtle" onClick={() => downloadText(toCsv(vtoolsPreparationRows([eventWithDraft], orgSettings)), `${e.code}_vtools_hazirlik.csv`)}>Hazırlık CSV’sini indir</Button></Group>
      <Text size="xs" c="dimmed">CSV bir çalışma / devir dosyasıdır; vTools’a toplu yükleme dosyası değildir. Kaydetmeden kopyalanan veya indirilen bilgiler bu ekrandaki taslağı içerir.</Text>
    </Stack></Card>
    <Card withBorder><Stack>
      <Title order={4}>3. vTools’ta gönder, Hub’da takip et</Title>
      <Text size="sm">IEEE hesabınızla giriş yapın ve Manage Events bölümünü açın. Gelecek etkinlik için Create Event kullanın. Etkinlik bittiyse File a Report for a Past Event yolundan ilerleyin; etkinlik zaten kayıtlıysa mevcut kaydı seçin, kayıtlı değilse yeni etkinlik seçeneğini kullanın. Primary Host alanında doğru öğrenci kolunu / birimi seçin, bilgileri kontrol edip gönderin.</Text>
      <Group><Button component="a" href={VTOOLS_LINKS.events} target="_blank" rel="noreferrer">IEEE vTools’u aç</Button><Anchor href={VTOOLS_LINKS.create} target="_blank" rel="noreferrer" size="sm">Etkinlik oluşturma</Anchor><Anchor href={VTOOLS_LINKS.existingReport} target="_blank" rel="noreferrer" size="sm">Kayıtlı etkinliği raporla</Anchor><Anchor href={VTOOLS_LINKS.newReport} target="_blank" rel="noreferrer" size="sm">Kayıtlı olmayanı raporla</Anchor></Group>
      <Alert color="blue">Primary Host listesinde kolunuz görünmüyorsa IEEE’deki görev kaydınızı kol yöneticisiyle kontrol edin. Hub’da rol almak vTools yetkisi vermez. Yalnız etkinliği oluşturmak, etkinlik sonrası raporun gönderildiği anlamına gelmez.</Alert>
      <TextInput label="vTools etkinlik bağlantısı veya kimliği" placeholder="https://events.vtools.ieee.org/m/123456" description="Resmî etkinlik sayfasının adresini yapıştırın veya sayısal kimliğini yazın." value={data.eventId} onChange={x => set('eventId', x.currentTarget.value)} readOnly={!canManage} error={data.eventId.trim() && !eventId ? 'Geçerli bir vTools etkinlik adresi veya sayısal kimlik girin.' : undefined} />
      {canManage && <><Checkbox label="Etkinlik sonrası raporu vTools’ta gerçekten gönderdim." checked={confirmed} onChange={x => setConfirmed(x.currentTarget.checked)} /><Group><Button color="teal" disabled={missing.length > 0 || !eventId || !confirmed} loading={busy} onClick={() => void save(true)}>Bildirimi Hub’a işle</Button><Button variant="subtle" color="gray" onClick={() => updateEvent(id, { vtools: { ...data, eventId: eventId ?? data.eventId }, vtoolsStatus: 'not_required' }).then(() => notifySuccess('vTools bildirimi gerekmiyor olarak işaretlendi.')).catch(notifyError)}>Gerekmiyor</Button></Group></>}
      {data.reportedAt && <Text size="xs" c="dimmed">Hub takip kaydı: {data.reportedBy} · {new Date(data.reportedAt).toLocaleString('tr-TR')}</Text>}
    </Stack></Card>
  </Stack>;
}
