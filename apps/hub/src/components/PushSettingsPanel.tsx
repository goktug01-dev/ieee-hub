import { Alert,Button,Card,Stack,Switch,Text,TextInput,Title } from '@mantine/core';
import { doc,serverTimestamp,setDoc } from 'firebase/firestore';
import { useEffect,useState } from 'react';
import { db } from '../firebase';
import { useDoc } from '../lib/hooks';
import type { PushConfig } from '../lib/push';
import { notifyError,notifySuccess } from './ui';
export function PushSettingsPanel() {
  const current=useDoc<PushConfig>('settings/push'),health=useDoc<{at:{toDate:()=>Date};result:string;sent:number;uncertain:number}>('pushHealth/current');
  const [form,setForm]=useState({enabled:false,publicKey:import.meta.env.VITE_PUSH_PUBLIC_KEY||''}),[busy,setBusy]=useState(false);
  useEffect(()=>{if(current.data)setForm({enabled:current.data.enabled,publicKey:current.data.publicKey});},[current.data]);
  return <Card><Stack><Title order={5}>Telefon bildirim servisi</Title><Text size="sm">Mevcut GitHub Actions yürütücüsü ve Firebase Spark kullanılır. E-posta yürütücüsünün erişimi ve GitHub zamanlaması da açık olmalı. Mail ile cihaz tercihleri birbirinden bağımsızdır.</Text>
    <Alert>Bir defalık kurulum: npm run push:setup çıktısındaki açık anahtarı girin. Gizli anahtar bu ekrana yazılmaz. Üyeler telefonlarından Profilim bölümünde bu cihaz için izin verir. GitHub gecikmeleri push bildirimlerine de yansır.</Alert>
    <Switch label="Telefon bildirim servisini aç" checked={form.enabled} onChange={e=>setForm({...form,enabled:e.currentTarget.checked})}/>
    <TextInput label="Web Push açık anahtarı" value={form.publicKey} onChange={e=>setForm({...form,publicKey:e.currentTarget.value.trim()})}/>
    <Button loading={busy} disabled={!/^[A-Za-z0-9_-]{87}$/.test(form.publicKey)} onClick={async()=>{setBusy(true);try{await setDoc(doc(db,'settings/push'),{...form,updatedAt:serverTimestamp()});notifySuccess('Telefon bildirim servisi kaydedildi.');}catch(e){notifyError(e);}finally{setBusy(false);}}}>Telefon bildirim ayarlarını kaydet</Button>
    <Text size="sm">İlk kurulumdan önceki işler için üyeler kayıt olduktan sonra yukarıdaki “Mevcut bekleyenleri kuyruğa al” işlemini kullanın. Aynı cihazdaki aynı atama tekrar gönderilmez.</Text>
    {health.data&&<Text size="sm">Son kontrol: {health.data.at.toDate().toLocaleString('tr-TR')} · {health.data.result} · Push servisi kabul etti: {health.data.sent} · Belirsiz: {health.data.uncertain}</Text>}
    {(current.error||health.error)&&<Alert color="red">Telefon bildirim ayarları okunamadı.</Alert>}
  </Stack></Card>;
}
