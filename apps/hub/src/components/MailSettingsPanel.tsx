import { Alert, Badge, Button, Card, Group, NumberInput, Stack, Switch, Table, Text, TextInput, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { Timestamp, doc, limit, orderBy, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { db } from '../firebase';
import { fmtDateTime } from '../lib/format';
import { useCollection, useDoc } from '../lib/hooks';
import { DEFAULT_MAIL_SETTINGS, queuePendingMail, type MailSettings } from '../lib/mail';
import { notifyError, notifySuccess } from './ui';

interface Delivery { signalId: string; recipientUid: string; state: string; updatedAt: Timestamp; errorCode: string; }
interface Health { at: Timestamp; mode: string; result: string; sent: number; skipped: number; uncertain: number; errorCode: string; }
const labels: Record<string,string> = { sending: 'Gönderim kesilmiş olabilir', sent: 'SMTP kabul etti', failed: 'Başarısız', uncertain: 'Teslim belirsiz', skipped: 'Atlandı' };

export function MailSettingsPanel() {
  const { can } = useAuth();
  const config = useDoc<MailSettings>('settings/mail');
  const health = useDoc<Health>('mailHealth/current');
  const deliveries = useCollection<Delivery>('mailDeliveries', [orderBy('updatedAt', 'desc'), limit(20)], 'mail-deliveries');
  const [form, setForm] = useState(DEFAULT_MAIL_SETTINGS);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (config.data) {
      const { enabled, workerUid, senderEmail, hubUrl, maxPerRun, maxPerDay } = config.data;
      setForm({ enabled, workerUid, senderEmail, hubUrl, maxPerRun, maxPerDay });
    }
  }, [config.data]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); } catch (e) { notifyError(e); } finally { setBusy(false); }
  };
  const retry = (item: Delivery & { id: string }) => modals.openConfirmModal({
    title: 'Gönderimi yeniden dene',
    children: <Text size="sm">Önceki mailin teslimi belirsizse yeniden denemek aynı maili ikinci kez gönderebilir. Alıcının gelen kutusunu kontrol ederek devam edin.</Text>,
    labels: { confirm: 'Riski bilerek yeniden dene', cancel: 'Vazgeç' },
    onConfirm: () => void run(async () => {
      const batch = writeBatch(db);
      batch.update(doc(db, 'mailDeliveries', item.id), { state: 'failed', nextAttemptAt: serverTimestamp(), updatedAt: serverTimestamp() });
      // Kuyruğun kimlik ve kaynak sürümü alanları korunur; yönetici yeniden açabilir.
      const { getDoc } = await import('firebase/firestore');
      const target = doc(db, 'mailSignals', item.signalId);
      const signal = (await getDoc(target)).data();
      if (!signal) throw new Error('Bildirim kaydı bulunamadı.');
      batch.set(target, { kind: signal.kind, sourceId: signal.sourceId, sourceVersion: signal.sourceVersion,
        queuedAt: serverTimestamp(), readyAt: serverTimestamp(), state: 'pending' });
      await batch.commit(); notifySuccess('Yeniden deneme kuyruğa alındı.');
    }),
  });
  return <Card data-testid="mail-settings"><Stack>
    <Title order={5}>E-posta bildirim servisi</Title>
    <Text size="sm">GitHub Actions, kulübün Gmail hesabından gönderir. Firebase Spark kalır; anlık teslim garantisi yoktur. Gmail şifresi veya uygulama şifresi bu ekrana girilmez.</Text>
    <Alert color="yellow">Bazı üyelere mail gitmiyorsa Profilim → E-posta bildirimleri bölümünde adres doğrulamasını, alıcı kaydını ve ilgili bildirimin açık olduğunu kontrol ettirin. Ardından mevcut bekleyenleri kuyruğa alabilirsiniz. Atlanan sayısı tek başına gönderim hatası değildir; kapalı tercihler ve önceden gönderilenler de atlanır. GitHub zamanlaması saatlerce gecikebilir.</Alert>
    {[config.error, health.error, deliveries.error].filter(Boolean).map((e,i) => <Alert key={i} color="red">Bildirim verisi okunamadı: {e!.message}</Alert>)}
    <Switch label="Mail yürütücüsünün veri erişimini aç" description="Gönderimi durdurmak için kapatın. GitHub zamanlaması ayrıca kurulmuş olmalıdır." checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.currentTarget.checked })} />
    <TextInput label="Gönderici Gmail adresi" value={form.senderEmail} onChange={e => setForm({ ...form, senderEmail: e.currentTarget.value.trim().toLowerCase() })} />
    <TextInput label="Bildirim hesabı kimliği" description="npm run mail:setup sonunda verilen Firebase UID. Ayrı otomasyon hesabıdır; bir Hub üyesi seçmeyin." value={form.workerUid} onChange={e => setForm({ ...form, workerUid: e.currentTarget.value.trim() })} />
    <TextInput label="Hub adresi" description="HTTPS site kökü; sonunda / olmadan girin." value={form.hubUrl} onChange={e => setForm({ ...form, hubUrl: e.currentTarget.value.trim().replace(/\/$/, '') })} />
    <Group grow>
      <NumberInput label="Bir çalıştırmada en fazla gönderim denemesi" min={1} max={30} value={form.maxPerRun} onChange={v => setForm({ ...form, maxPerRun: Number(v) || 1 })} />
      <NumberInput label="Günlük en fazla gönderim denemesi" min={1} max={200} value={form.maxPerDay} onChange={v => setForm({ ...form, maxPerDay: Number(v) || 1 })} />
    </Group>
    <Group>
      <Button loading={busy} onClick={() => void run(async () => { await setDoc(doc(db, 'settings/mail'), { ...form, updatedAt: serverTimestamp() }); notifySuccess('Bildirim ayarları kaydedildi.'); })}>Bildirim ayarlarını kaydet</Button>
      <Button variant="light" loading={busy} disabled={!can('petitions.readAll') || !can('work.manageAll')} onClick={() => void run(async () => { const count = await queuePendingMail(); notifySuccess(`${count} bekleyen kayıt kuyruğa alındı. Önceden gönderilen aynı bildirimler tekrarlanmaz.`); })}>Mevcut bekleyenleri kuyruğa al</Button>
    </Group>
    {health.data ? <Alert color={health.data.result === 'error' || health.data.uncertain ? 'yellow' : 'blue'} title="Son servis kontrolü">
      <Text size="sm">{fmtDateTime(health.data.at)} · {health.data.mode === 'dry-run' ? 'Kuru kontrol, mail gönderilmedi' : 'Canlı gönderim'} · SMTP kabul etti: {health.data.sent} · Atlanan: {health.data.skipped} · Belirsiz: {health.data.uncertain}</Text>
      {health.data.result === 'error' && <Text size="sm">Çalışma tamamlanamadı. GitHub Actions bağlantısını ve hesap kurulumunu kontrol edin.</Text>}
      {health.data.result === 'disabled' && <Text size="sm">Servis ayarlardan kapalı.</Text>}
    </Alert> : <Alert color="yellow">Servis henüz çalışmamış. Kurulumdan sonra GitHub Actions’ta “E-posta bildirimleri” iş akışını kuru kontrol ile başlatın. Kuralları ve indeksleri yayımlamadan çalıştırmayın.</Alert>}
    {health.data && Date.now() - health.data.at.toMillis() > 45 * 60000 && <Alert color="yellow">Son kontrolden bu yana 45 dakikadan fazla geçmiş. GitHub zamanlamasını ve çalışma sonuçlarını kontrol edin.</Alert>}
    <Text size="sm" c="dimmed">Gmail’in kendi kotası ayrıca geçerlidir. SMTP kabulü, alıcının gelen kutusuna teslim edildiği anlamına gelmez. 60 gün repo etkinliği olmazsa GitHub zamanlaması kapanabilir.</Text>
    {deliveries.data.length > 0 && <Table.ScrollContainer minWidth={650}><Table><Table.Thead><Table.Tr><Table.Th>Son işlem</Table.Th><Table.Th>Bildirim kaydı</Table.Th><Table.Th>Durum</Table.Th><Table.Th>İşlem</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{deliveries.data.map(item => <Table.Tr key={item.id}>
      <Table.Td>{fmtDateTime(item.updatedAt)}</Table.Td><Table.Td>{item.signalId}</Table.Td><Table.Td><Badge color={item.state === 'sent' ? 'green' : 'yellow'}>{labels[item.state] ?? item.state}</Badge></Table.Td>
      <Table.Td>{['failed','uncertain','sending'].includes(item.state) && <Button size="xs" variant="light" onClick={() => retry(item)} disabled={busy}>Yeniden dene</Button>}</Table.Td>
    </Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer>}
  </Stack></Card>;
}
