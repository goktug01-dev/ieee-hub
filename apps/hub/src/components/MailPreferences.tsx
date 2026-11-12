import { Alert, Button, Card, Group, Stack, Switch, Text, Title } from '@mantine/core';
import { reload, sendEmailVerification } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { db } from '../firebase';
import { useDoc } from '../lib/hooks';
import { registerMailRecipient, type MailRecipient } from '../lib/mail';
import { notifyError, notifySuccess } from './ui';

export function MailRegistration() {
  const { user } = useAuth();
  useEffect(() => {
    void registerMailRecipient().catch(() => { /* Profil ekranı yeniden denemeyi ve hatayı gösterir. */ });
  }, [user?.uid, user?.emailVerified]);
  return null;
}

export function MailPreferences() {
  const { user } = useAuth();
  const state = useDoc<MailRecipient>(`mailRecipients/${user!.uid}`);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(user!.emailVerified);
  const [optimistic, setOptimistic] = useState<{ petitions: boolean; tasks: boolean } | null>(null);
  useEffect(() => {
    if (optimistic && state.data?.petitions === optimistic.petitions && state.data?.tasks === optimistic.tasks) setOptimistic(null);
  }, [state.data, optimistic]);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try { await action(); } catch (e) { notifyError(e); } finally { setBusy(false); }
  };
  const save = async (key: 'petitions' | 'tasks', value: boolean) => {
    const next = { petitions: optimistic?.petitions ?? state.data?.petitions ?? true,
      tasks: optimistic?.tasks ?? state.data?.tasks ?? true, [key]: value };
    setOptimistic(next); setBusy(true);
    try {
      await registerMailRecipient();
      await setDoc(doc(db, 'mailRecipients', user!.uid), { email: user!.email, ...next, updatedAt: serverTimestamp() });
    } catch (e) { setOptimistic(null); notifyError(e); } finally { setBusy(false); }
  };
  return <Card data-testid="mail-preferences"><Stack>
    <Title order={5}>E-posta bildirimleri</Title>
    <Text size="sm">Bildirim adresiniz: {user!.email}. Dilekçe metni ve ekleri mailde gönderilmez. Kontroller yaklaşık 10 dakikada bir planlanır; teslim gecikebilir.</Text>
    {!verified ? <>
      <Alert color="yellow">Mail alabilmek için e-posta adresinizi doğrulayın.</Alert>
      <Group>
        <Button loading={busy} onClick={() => void run(async () => { await sendEmailVerification(user!); notifySuccess('Doğrulama bağlantısı gönderildi.'); })}>Doğrulama maili gönder</Button>
        <Button variant="default" loading={busy} onClick={() => void run(async () => {
          await reload(user!); await user!.getIdToken(true); setVerified(user!.emailVerified);
          if (user!.emailVerified) { await registerMailRecipient(); notifySuccess('Adresiniz doğrulandı.'); }
          else notifySuccess('Adres henüz doğrulanmamış. Maildeki bağlantıyı açın.');
        })}>Doğrulamayı kontrol et</Button>
      </Group>
    </> : <>
      {!state.loading && !state.data && <Alert color="yellow">Bildirim alıcı kaydınız henüz tamamlanmadı. Adres doğrulaması tek başına yeterli değildir; aşağıdaki düğmeyle kaydı tamamlayın.</Alert>}
      {!state.loading && !state.data && <Button loading={busy} onClick={()=>void run(async()=>{await registerMailRecipient();notifySuccess('Bildirim alıcı kaydı tamamlandı.');})}>Bildirim kaydını tamamla</Button>}
      {state.data && <Text size="sm" c="green">Bildirim alıcı kaydınız hazır.</Text>}
      <Switch label="Onayımı bekleyen dilekçeler için mail gönder" checked={optimistic?.petitions ?? state.data?.petitions ?? false} disabled={busy || state.loading || !state.data} onChange={e => void save('petitions', e.currentTarget.checked)} />
      <Switch label="Bana yeni görev atandığında mail gönder" checked={optimistic?.tasks ?? state.data?.tasks ?? false} disabled={busy || state.loading || !state.data} onChange={e => void save('tasks', e.currentTarget.checked)} />
      {state.error && <Alert color="red">Bildirim tercihleri okunamadı. Sayfayı yenileyip tekrar deneyin.</Alert>}
    </>}
  </Stack></Card>;
}
