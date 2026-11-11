import { encryptedExport, decryptBackup } from '../lib/statutoryBackup';
import { Alert, Button, Card, FileInput, Checkbox, Group, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { get, ref } from 'firebase/database';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { hasRoleKey } from '../lib/access';
import { useCollection } from '../lib/hooks';
import { useSite, SiteConnection } from '../lib/siteIntegration';
import { externalServices } from '../lib/externalFirebase';
import type { StatutoryPolicy } from '../lib/statutoryTypes';
import { db } from '../firebase';
import { downloadText } from '../lib/ops';
import { notifyError, notifySuccess } from './ui';

export function StatutoryBackupPanel({policy}:{policy:StatutoryPolicy}) {
  const {user,access}=useAuth(),site=useSite();
  const receipts=useCollection<{digest:string;locations:string[];scope:string;at:{toMillis:()=>number;toDate:()=>Date}}>('backupReceipts');
  const allowed=hasRoleKey(access,policy.roles.techops)||hasRoleKey(access,policy.roles.president);
  const actor=hasRoleKey(access,policy.roles.actor);
  const [backupFile,setBackupFile]=useState<File|null>(null);
  const [password,setPassword]=useState(''),[again,setAgain]=useState(''),[location1,setLocation1]=useState(''),[location2,setLocation2]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[result,setResult]=useState<{digest:string;scope:string}|null>(null);
  const last=[...receipts.data].sort((a,b)=>(b.at?.toMillis()||0)-(a.at?.toMillis()||0))[0];
  const exportSite=async()=>{setBusy(true);try{if(!site.config||!site.user)throw new Error('Site yedekleme yetkili hesabıyla bağlanın.');const remote=externalServices(site.config).realtime;if(!remote)throw new Error('Site RTDB bağlantısı gerekli.');const snapshot=(await get(ref(remote))).val();const {payload,digest}=await encryptedExport({at:new Date().toISOString(),projectId:site.config.projectId,scope:'site-rtdb-full',data:snapshot},password);downloadText(payload,`site-yedek-${new Date().toISOString().slice(0,10)}.encrypted.json`);setResult({digest,scope:'site-rtdb-full'});setPassword('');setAgain('');setConfirmed(false);}catch(e){notifyError(e);}finally{setBusy(false);}};
  const publicActorReport=async()=>{setBusy(true);try{const records=await getDocs(collection(db,'eventPointRequests'));const items=records.docs.map(d=>d.data());downloadText(JSON.stringify({generatedAt:new Date().toISOString(),scope:'actor-public-summary',requests:items.length,approved:items.filter(i=>i.status==='approved').length,closed:items.filter(i=>i.status==='closed').length,note:'Kişisel puan listesi ve üye kimliği içermez. Yıllık resmî rapor, ACTOR ve Denetleme süreç dosyasıyla ayrıca teslim edilir.'},null,2),'actor-faaliyet-ozeti.json');}catch(e){notifyError(e);}finally{setBusy(false);}};
  return <Stack><Alert title="Günlük yedek · iki güvenli ortam · yıllık ACTOR arşivi">Madde 23, 36, 37 ve 70: yedekler iki ayrı güvenli ortamda saklanmalı. Spark ve kapalı tarayıcı kısıtı nedeniyle bu ekran kesintisiz günlük yedek servisi değildir; son teslimi izler ve şifreli site yedeği üretir.</Alert><Card withBorder><Text fw={600}>{last?`Son yedek teslim kaydı: ${last.at?.toDate().toLocaleString('tr-TR')}`:'Henüz doğrulanmış yedek teslimi yok'}</Text>{(!last||Date.now()-last.at.toMillis()>86400000)&&<Alert color="orange">Günlük yedek teslim kaydı eksik veya 24 saatten eski.</Alert>}</Card>{actor&&<Button variant="light" loading={busy} onClick={()=>void publicActorReport()}>Üyelere açık ACTOR faaliyet özeti indir</Button>}
    {allowed&&<><SiteConnection/><PasswordInput label="Yedek şifresi (en az 12 karakter)" description="Şifre saklanmaz. Yedeği açmak için bu şifreyi güvenli ortamda ayrıca koruyun." value={password} onChange={e=>setPassword(e.currentTarget.value)}/><PasswordInput label="Şifreyi tekrar yazın" value={again} onChange={e=>setAgain(e.currentTarget.value)}/><FileInput label="Mevcut sifreli yedegi ac (yerel dosya)" accept=".json" value={backupFile} onChange={setBackupFile}/>{backupFile&&<Button variant="light" loading={busy} disabled={password.length<12} onClick={async()=>{setBusy(true);try{const value=await decryptBackup(await backupFile.text(),password);downloadText(JSON.stringify(value,null,2),'site-yedek-cozulmus.json');setPassword('');setAgain('');notifySuccess('Yedek yerel dosyaya cozuldu.');}catch(e){notifyError(e);}finally{setBusy(false);}}}>Yedegi dogrula ve yerel JSON olarak ac</Button>}<Button disabled={password.length<12||password!==again||!site.user} loading={busy} onClick={()=>void exportSite()}>Tam site RTDB yedeğini şifrele ve indir</Button>{result&&<><Text size="xs">Şifreli dosya SHA-256: {result.digest}</Text><TextInput label="Birinci güvenli ortam / teslim kaydı" value={location1} onChange={e=>setLocation1(e.currentTarget.value)}/><TextInput label="İkinci farklı güvenli ortam / teslim kaydı" value={location2} onChange={e=>setLocation2(e.currentTarget.value)}/><Checkbox label="İndirilen şifreli dosyayı iki farklı güvenli ortamda sakladım; erişimler yalnız TechOps ve YK başkanında." checked={confirmed} onChange={e=>setConfirmed(e.currentTarget.checked)}/><Button disabled={!confirmed||!location1.trim()||!location2.trim()||location1.trim()===location2.trim()} loading={busy} onClick={async()=>{setBusy(true);try{await addDoc(collection(db,'backupReceipts'),{...result,locations:[location1.trim(),location2.trim()],byUid:user!.uid,at:serverTimestamp()});setResult(null);notifySuccess('İki ortama teslim kaydı saklandı.');}catch(e){notifyError(e);}finally{setBusy(false);}}}>İki ortama teslimi kaydet</Button></>}</>}
    <Group>{receipts.data.map(r=><Text key={r.id} size="sm">{r.scope} · {r.locations.join(' / ')}</Text>)}</Group>
  </Stack>;
}
