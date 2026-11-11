import { Alert, Button, Group, NumberInput, Select, Stack, TextInput } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useDoc } from '../lib/hooks';
import type { StatutoryCase } from '../lib/statutoryTypes';
import { db } from '../firebase';
import { notifyError, notifySuccess } from './ui';

export function StatutoryAssemblyPanel() {
  const {user}=useAuth();
  const [form,setForm]=useState({caseId:'',round:1,previousId:'',heldAt:null as string|null,totalMembers:0,attendance:0,yes:0,no:0,abstain:0,minutesUrl:''}),[busy,setBusy]=useState(false),[saved,setSaved]=useState('');
  const source=useDoc<StatutoryCase>(form.caseId?`governanceCases/${form.caseId}`:null);
  const charter=source.data?.kind!=='general_assembly';
  const quorum=charter?form.attendance*3>=form.totalMembers*2&&form.totalMembers>0:form.round===1?form.attendance*2>form.totalMembers:form.attendance>=18;
  const accepted=charter?form.yes*3>=form.attendance*2&&form.attendance>0:form.yes*2>form.attendance;
  return <Stack><Alert title="Tüzük değişikliği için iki Genel Kurul">Denetleme uygun görüşü, her toplantıda tam sayının 2/3 katılımı ve katılanların 2/3 kabulü gerekir. İkinci toplantı ilkinden en az 15 gün sonra olabilir. Islak / kurumsal imzalı tutanak bağlantısı zorunludur. Bu form gerçek toplantı ve oy yerine geçmez.</Alert><TextInput label="Tüzük değişikliği süreç dosyası kimliği" value={form.caseId} onChange={e=>setForm({...form,caseId:e.currentTarget.value})}/><Select label="Toplantı" data={[{value:'1',label:'Birinci Genel Kurul'},{value:'2',label:'İkinci Genel Kurul'}]} value={String(form.round)} onChange={v=>setForm({...form,round:Number(v)})}/>{form.round===2&&<TextInput label="Birinci tutanak kaydı kimliği" value={form.previousId} onChange={e=>setForm({...form,previousId:e.currentTarget.value})}/>}<DateTimePicker label="Gerçek toplantı zamanı" value={form.heldAt} onChange={v=>setForm({...form,heldAt:v})}/><Group grow>{(['totalMembers','attendance','yes','no','abstain']as const).map(key=><NumberInput key={key} label={{totalMembers:'Aktif üye tam sayısı',attendance:'Katılan',yes:'Kabul',no:'Ret',abstain:'Çekimser'}[key]} min={0} allowDecimal={false} value={form[key]} onChange={v=>setForm({...form,[key]:Number(v)})}/>)}</Group><TextInput label="İmzalı Genel Kurul tutanağı bağlantısı" value={form.minutesUrl} onChange={e=>setForm({...form,minutesUrl:e.currentTarget.value})}/><Alert color={quorum&&accepted?'teal':'yellow'}>Katılım nisabı: {quorum?'sağlandı':'eksik'} · Kabul çoğunluğu: {accepted?'sağlandı':'eksik'} · Oy toplamı: {form.yes+form.no+form.abstain}/{form.attendance}</Alert><Button loading={busy} disabled={!form.caseId||!form.heldAt||!form.minutesUrl} onClick={async()=>{setBusy(true);try{const target=await addDoc(collection(db,'assemblyRecords'),{...form,previousId:form.previousId||null,heldAt:Timestamp.fromDate(new Date(form.heldAt!)),createdBy:user!.uid,createdAt:serverTimestamp()});setSaved(target.id);notifySuccess('Tutanak değişmez kayıt olarak saklandı. Süreç dosyasında bu kimliği kullanın.');}catch(e){notifyError(e);}finally{setBusy(false);}}}>Tutanağı kaydet</Button>{saved&&<Alert color="teal">Tutanak kayıt kimliği: {saved}</Alert>}</Stack>;
}
