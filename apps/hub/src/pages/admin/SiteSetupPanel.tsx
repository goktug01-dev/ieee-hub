import { Alert, Button, Card, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useState } from 'react';
import { ref, update } from 'firebase/database';
import { externalServices } from '../../lib/externalFirebase';
import { useOrg } from '../../lib/org';
import type { ExternalFirebaseConfig } from '../../lib/opsTypes';
import { notifyError, notifySuccess } from '../../components/ui';

export function SiteSetupPanel({ config, onChange, stored }: { config: Omit<ExternalFirebaseConfig, 'updatedAt' | 'updatedBy'>; onChange: (patch: Partial<ExternalFirebaseConfig>) => void; stored: ExternalFirebaseConfig | null }) {
  const { units } = useOrg();
  const [uid, setUid] = useState(''), [capability, setCapability] = useState<string | null>('qr');
  const [expires, setExpires] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const grant = async (revoke: boolean) => {
    setBusy(true);
    try {
      if (!stored) throw new Error('Bağlantı ayarını önce kaydedin.');
      if (!uid.trim() || /[.#$\[\]/]/.test(uid)) throw new Error('Geçerli site Authentication UID’si girin.');
      const services = externalServices(stored);
      if (!services.auth.currentUser || !services.realtime) throw new Error('Site yöneticisi hesabıyla bağlanın.');
      if (!capability || !revoke && (!expires || Date.parse(expires) <= Date.now())) throw new Error('Görev bitiş tarihini girin.');
      await update(ref(services.realtime, `site_access/${uid.trim()}`), { [capability]: revoke ? null : Date.parse(expires!) });
      notifySuccess(revoke ? 'Site işlem yetkisi kaldırıldı.' : 'Site işlem yetkisi görev bitişine kadar verildi.');
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  };
  return <Card withBorder><Stack><Text fw={600}>Hub → Web sitesi otomasyonu</Text><Text size="sm">YK onaylı etkinlikler ve Hub’dan yayımlanan duyurular, yetkili kişinin site oturumu açıkken otomatik aktarılır. QR puanı komite önerisi ve ACTOR doğrulamasından sonra oluşturulur.</Text>
    <Group grow><TextInput label="Site etkinlik takvimi yolu" value={config.siteEventsPath || 'events'} onChange={e => onChange({ siteEventsPath: e.currentTarget.value })} /><TextInput label="Site duyuruları yolu" value={config.siteAnnouncementsPath || 'public_announcements'} onChange={e => onChange({ siteAnnouncementsPath: e.currentTarget.value })} /><TextInput label="Puan QR dizini" value={config.siteQrPath || 'valid_qrs'} onChange={e => onChange({ siteQrPath: e.currentTarget.value })} /></Group>
    <Text fw={600}>Hub birimi → Site komitesi</Text>{units.filter(u => u.active && u.id !== 'branch').map(u => <TextInput key={u.id} label={u.name} placeholder="Site komite kimliği" value={config.siteUnitMap?.[u.id] || ''} onChange={e => onChange({ siteUnitMap: { ...config.siteUnitMap, [u.id]: e.currentTarget.value.trim() } })} />)}
    <TextInput label="Puan QR bağlantı şablonu" description="{qrId} QR kimliği, {committeeId} site komite kimliğiyle değiştirilir." value={config.siteQrUrlTemplate || 'https://studentbranches.ieee.org/tr-ikcu/profile/?qr_id={qrId}'} onChange={e => onChange({ siteQrUrlTemplate: e.currentTarget.value })} />
    <Alert color="blue">Hub’daki görev ve site işlem yetkisi birlikte gereklidir. ACTOR’a yalnız QR doğrulaması; YK başkanı/yardımcısına duyuru ve etkinlik; üyelik sorumlusuna üyelik yetkisi verin. Site kuralları güncel olmalı.</Alert>
    <Group align="end"><TextInput label="Kişinin site Authentication UID’si" value={uid} onChange={e => setUid(e.currentTarget.value)} /><Select label="Site işlem yetkisi" data={[{ value: 'qr', label: 'ACTOR · Puan QR’ı' }, { value: 'calendar', label: 'Onaylı etkinlik aktarımı' }, { value: 'announcements', label: 'Site duyuruları' }, { value: 'members', label: 'Site üyelik onayı' }]} value={capability} onChange={setCapability} /><DateTimePicker label="Görev / yetki bitişi" value={expires} onChange={setExpires} /></Group><Group><Button loading={busy} onClick={() => void grant(false)}>Site işlem yetkisini ver</Button><Button color="orange" variant="light" loading={busy} onClick={() => void grant(true)}>Yetkiyi kaldır</Button></Group>
  </Stack></Card>;
}
