import { Alert,Button,Card,Group,Stack,Switch,Text,Title } from '@mantine/core';
import { useEffect,useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useDoc } from '../lib/hooks';
import { disablePush,enablePush,pushBinding,savePushPreference,type PushConfig,type PushDevice } from '../lib/push';
import { notifyError,notifySuccess } from './ui';
export function PushPreferences() {
  const {user}=useAuth();const config=useDoc<PushConfig>('settings/push');
  const [binding,setBinding]=useState(pushBinding),[busy,setBusy]=useState(false);
  useEffect(()=>{const refresh=()=>setBinding(pushBinding());window.addEventListener('ieee-push-device-changed',refresh);return()=>window.removeEventListener('ieee-push-device-changed',refresh);},[]);
  const device=useDoc<PushDevice>(binding && binding.uid===user?.uid?`pushSubscriptions/${binding.uid}/devices/${binding.id}`:null);
  const run=async(fn:()=>Promise<void>)=>{setBusy(true);try{await fn();setBinding(pushBinding());}catch(e){notifyError(e);}finally{setBusy(false);}};
  const active=device.data&&device.data.publicKey===config.data?.publicKey;
  return <Card data-testid="push-preferences"><Stack><Title order={5}>Telefon bildirimleri</Title>
    <Text size="sm">Bu cihaz için görev ve dilekçe bildirimleri. GitHub Actions zamanlaması kullanılır; uygulama kapalıyken de gelebilir, saatlerce gecikebilir. Kilit ekranında özel içerik gösterilmez.</Text>
    <Text size="sm">iPhone/iPad: iOS 16.4 veya sonrası; önce uygulamayı Ana Ekran’a ekleyip simgesinden açın. Her cihazda ayrı izin gerekir.</Text>
    {(!config.data?.enabled)&&<Alert color="yellow">Telefon bildirim servisi henüz açılmamış. Kurum ayarlarından etkinleştirilmelidir.</Alert>}
    {(config.error||device.error)&&<Alert color="red">Bildirim ayarları okunamadı. Yenileyip tekrar deneyin.</Alert>}
    {active?<><Text c="green" size="sm">Bu cihaz kayıtlı.</Text><Switch label="Bu cihazda görev bildirimi" checked={device.data!.tasks} disabled={busy} onChange={e=>{const value=e.currentTarget.checked;void run(async()=>{await savePushPreference('tasks',value);notifySuccess('Telefon bildirim tercihi kaydedildi.');});}}/><Switch label="Bu cihazda dilekçe bildirimi" checked={device.data!.petitions} disabled={busy} onChange={e=>{const value=e.currentTarget.checked;void run(async()=>{await savePushPreference('petitions',value);notifySuccess('Telefon bildirim tercihi kaydedildi.');});}}/></>:null}
    <Group>{!active&&<Button loading={busy} disabled={!config.data?.enabled} onClick={()=>void run(async()=>{await enablePush(config.data!);notifySuccess('Bu cihazda telefon bildirimleri açıldı.');})}>Bu cihazda bildirimleri aç</Button>}
    {binding?.uid===user?.uid&&<Button variant="default" loading={busy} onClick={()=>void run(async()=>{await disablePush();notifySuccess('Bu cihazın bildirim kaydı kaldırıldı.');})}>Bu cihazda bildirimleri kapat</Button>}</Group>
  </Stack></Card>;
}
