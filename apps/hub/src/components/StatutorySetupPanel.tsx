import { Alert, Button, Card, Group, NumberInput, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { useState } from 'react';
import { db } from '../firebase';
import { initialStatutoryPolicy, publishStatutoryPolicy, reserveAllocation } from '../lib/statutory';
import type { StatutoryPolicy } from '../lib/statutoryTypes';
import type { Role } from '../lib/types';
import { DEFAULT_BOARDS } from '../lib/boards';
import { notifyError, notifySuccess } from './ui';

export const STATUTORY_ROLES: Record<string,Role> = {
  'dis-isler-yardimcisi':{name:'Dış İşlerden Sorumlu Başkan Yardımcısı',scope:'branch',permissions:['sponsors.read','sponsors.manage','finance.read','governance.read','reports.read'],active:true,order:3},
  'teknik-projeler-yardimcisi':{name:'Teknik Projelerden Sorumlu Başkan Yardımcısı',scope:'branch',permissions:['work.manageAll','events.manageAll','inventory.manage','governance.read','reports.read'],active:true,order:6},
  'denetleme-baskani':{name:'Denetleme Kurulu Başkanı',scope:'branch',permissions:['governance.read','audit.read','elections.manage','reports.read','finance.read'],active:true,order:12},
  'denetleme-uyesi':{name:'Denetleme Kurulu Asil Üyesi',scope:'branch',permissions:['governance.read','audit.read','reports.read','finance.read'],active:true,order:13},
  'denetleme-yedek':{name:'Denetleme Kurulu Yedek Üyesi',scope:'branch',permissions:[],active:true,order:14},
  'akademik-danisman':{name:'Akademik Danışman',scope:'branch',permissions:['governance.read','reports.read'],active:true,order:15},
  'techops-baskani':{name:'TechOps Başkanı',scope:'branch',permissions:['inventory.manage','external.firebase.manage','governance.read','audit.read'],active:true,order:16},
  'techops-stajyeri':{name:'TechOps Stajyeri',scope:'unit',permissions:[],active:true,order:17},
  'koordinasyon-uyesi':{name:'Komite Koordinasyon Üyesi',scope:'unit',permissions:[],active:true,order:18},
  'komite-danismani':{name:'Komite Danışman Öğretim Görevlisi',scope:'unit',permissions:[],active:true,order:19},
};

export function StatutorySetupPanel({policy}:{policy:StatutoryPolicy|null}) {
  const [draft,setDraft]=useState<Omit<StatutoryPolicy,'publishedBy'|'publishedAt'>>(()=>policy?{name:policy.name,roles:policy.roles,holidays:policy.holidays,flows:policy.flows,limits:policy.limits}:initialStatutoryPolicy());
  const [busy,setBusy]=useState(false),[carryover,setCarryover]=useState<number|string>(0);
  const save=async()=>{setBusy(true);try{await publishStatutoryPolicy(draft);notifySuccess('Yeni politika sürümü yayımlandı; açık dosyalar önceki sürümde kalır.');}catch(e){notifyError(e);}finally{setBusy(false);}};
  const provision=async()=>{setBusy(true);try{const batch=writeBatch(db);for(const [id,data] of Object.entries(STATUTORY_ROLES))if(!(await getDoc(doc(db,'roles',id))).exists())batch.set(doc(db,'roles',id),data);await batch.commit();notifySuccess('Eksik rol tanımları eklendi. Görevliler resmî karar / seçim sonucuna göre ayrıca atanmalı.');}catch(e){notifyError(e);}finally{setBusy(false);}};
  const allocations=reserveAllocation(Number(carryover)||0,draft.limits.reservePercent);
  return <Stack><Alert title="Sürüm ve makam eşlemesi">Tüzük sürecini imzalayan kişi ilgili aktif görevi taşımalıdır. Teknik yönetici ayrıcalığı makam imzası yerine geçmez. Görevler ve kurul koltukları arayüzden düzenlenir.</Alert><Group><Button variant="light" loading={busy} onClick={()=>void provision()}>Eksik tüzük rollerini ekle</Button><Button variant="light" loading={busy} onClick={async()=>{setBusy(true);try{await setDoc(doc(db,'settings','boards'),DEFAULT_BOARDS);notifySuccess('Tüzükteki altı YK koltuğu ve İK koltukları kaydedildi. Görev atamalarını kontrol edin.');}catch(e){notifyError(e);}finally{setBusy(false);}}}>Tüzük kurul koltuklarını uygula</Button></Group>
    <TextInput label="Politika / tüzük sürümü adı" value={draft.name} onChange={e=>setDraft({...draft,name:e.currentTarget.value})}/>
    <Text fw={600}>Onay makamı → aktif rol anahtarı</Text>{Object.entries(draft.roles).map(([authority,key])=><TextInput key={authority} label={authority} description="birimKimliği__rolKimliği" value={key} onChange={e=>setDraft({...draft,roles:{...draft.roles,[authority]:e.currentTarget.value}})}/>)}
    <Textarea label="Resmî tatiller (YYYY-MM-DD; her satıra bir tarih)" description="İş günü hesaplarına hafta sonları ve bu tarihler dahil edilmez." value={draft.holidays.join('\n')} onChange={e=>setDraft({...draft,holidays:e.currentTarget.value.split(/\s+/).filter(Boolean)})}/>
    <Text fw={600}>Süre ve oranlar</Text>{Object.entries(draft.limits).map(([key,value])=><NumberInput key={key} label={key} min={0} max={key==='reservePercent'?100:365} value={value} onChange={v=>setDraft({...draft,limits:{...draft.limits,[key]:Number(v)}})}/>)}
    <Card withBorder><NumberInput label="Yeni döneme devreden kasa (TL)" min={0} value={carryover} onChange={setCarryover}/><Text>Acil Durum Fonu: {allocations.reserve.toLocaleString('tr-TR')} TL · Kullanılabilir: {allocations.operating.toLocaleString('tr-TR')} TL</Text><Text size="xs">Madde 61: hesaplama özeti. Gerçek kasa hareketi finansal belgeyle kaydedilir.</Text></Card>
    <Text fw={600}>Aşama süreleri</Text>{Object.entries(draft.flows).map(([kind,f])=><Card key={kind} withBorder><Text fw={600}>{f.label} · Md. {f.articles}</Text><Text size="sm">{f.description}</Text>{f.stages.map((s,index)=><NumberInput key={index} label={`${s.label} (${s.businessDays?'iş günü':'takvim günü'})`} min={0} max={365} value={s.days} onChange={v=>setDraft({...draft,flows:{...draft.flows,[kind]:{...f,stages:f.stages.map((stage,i)=>i===index?{...stage,days:Number(v)}:stage)}}})}/>)}</Card>)}
    <Button loading={busy} onClick={()=>void save()}>Tüzük süreç politikasını yayımla</Button>
  </Stack>;
}
