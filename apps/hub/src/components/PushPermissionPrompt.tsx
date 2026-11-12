import { Alert,Button,Group,Modal,Stack,Text } from '@mantine/core';
import { useEffect,useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useDoc } from '../lib/hooks';
import { enablePush,pushBinding,type PushConfig } from '../lib/push';
import { AppInstallButton } from './AppInstall';
import { notifyError,notifySuccess } from './ui';

/** İzin çağrısı girişte görünür; işletim sistemi izni yalnız düğmeye basınca istenir. */
export function PushPermissionPrompt() {
  const {user}=useAuth(),config=useDoc<PushConfig>('settings/push');
  const [opened,setOpened]=useState(false),[busy,setBusy]=useState(false);
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const installed=window.matchMedia('(display-mode: standalone)').matches||!!(navigator as Navigator&{standalone?:boolean}).standalone;
  const needsInstall=ios&&!installed;
  const supported='Notification' in window&&'PushManager' in window&&'serviceWorker' in navigator;
  const key=`ieee-push-prompt:${user?.uid}`;
  useEffect(()=>{
    if(!config.data?.enabled||!user||sessionStorage.getItem(key)||pushBinding()?.uid===user.uid)return;
    if(!needsInstall&&(!supported||Notification.permission==='denied'))return;
    sessionStorage.setItem(key,'shown');setOpened(true);
  },[config.data?.enabled,user?.uid,key,needsInstall,supported]);
  return <Modal opened={opened} onClose={()=>{if(!busy)setOpened(false);}} title="Görev bildirimlerini telefonunda al" centered>
    <Stack><Text size="sm">Yeni görev ve onay bekleyen dilekçeleri bu cihazda bildirim olarak alabilirsin. Teslim gecikebilir; kilit ekranında özel içerik paylaşılmaz.</Text>
      {needsInstall?<><Alert>iPhone/iPad’de önce uygulamayı Ana Ekran’a ekle, sonra simgesinden aç. Bildirim iznini uygulamanın içinde verebilirsin.</Alert><AppInstallButton/></>:<Button loading={busy} onClick={async()=>{setBusy(true);try{await enablePush(config.data!);setOpened(false);notifySuccess('Bu cihazda telefon bildirimleri açıldı.');}catch(e){notifyError(e);}finally{setBusy(false);}}}>Bildirimleri aç</Button>}
      <Group justify="flex-end"><Button variant="subtle" disabled={busy} onClick={()=>setOpened(false)}>Şimdilik değil</Button></Group>
      <Text size="xs" c="dimmed">Tercihini daha sonra Profilim → Telefon bildirimleri bölümünden değiştirebilirsin.</Text>
    </Stack>
  </Modal>;
}
