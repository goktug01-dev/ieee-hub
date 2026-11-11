import { Alert, Button, Card, Group, Stack, Text, TextInput } from '@mantine/core';
import { useState } from 'react';
import { doc, getDocFromServer, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { db } from '../firebase';
import { hasRoleKey } from '../lib/access';
import { useCollection, useDoc } from '../lib/hooks';
import type { Election } from '../lib/types';
import type { AnnualActivity, StatutoryPolicy } from '../lib/statutoryTypes';
import { notifyError, notifySuccess, ErrorAlert } from './ui';

export interface ElectionAdmission { electionId:string;uid:string;unitId:string;roleId:string;yearId:string;annualXp:number;status:'verified';byUid:string; }
export function ElectionEligibilityPanel({id,election}:{id:string;election:Election}) {
  const {user,access}=useAuth();
  const current=useDoc<{policyId:string}>('settings/statutory');
  const policy=useDoc<StatutoryPolicy>(current.data?`statutoryPolicies/${current.data.policyId}`:null);
  const list=useCollection<ElectionAdmission>('electionAdmissions',[where('electionId','==',id)],`admission-${id}`);
  const [uid,setUid]=useState(''),[exceptionCaseId,setExceptionCaseId]=useState(''),[busy,setBusy]=useState(false);
  const audit=!!policy.data&&hasRoleKey(access,policy.data.roles.audit);
  if(!current.data)return null;
  const certify=async(unitId:string,roleId:string)=>{setBusy(true);try{
    if(!election.activityYearId)throw new Error('Önce ilan edilmiş aktiflik yılını seçip seçim kaydını kaydedin.');
    const record=(await getDocFromServer(doc(db,'annualActivity',election.activityYearId,'members',uid.trim()))).data() as AnnualActivity|undefined;
    if(!record||record.status!=='final')throw new Error('Bu üyenin ACTOR–Denetleme yıllık doğrulaması tamamlanmamış.');
    await setDoc(doc(db,'electionAdmissions',`${id}__${unitId}__${roleId}__${uid.trim()}`),{electionId:id,uid:uid.trim(),unitId,roleId,yearId:election.activityYearId,annualXp:record.annualXp,status:'verified',byUid:user!.uid,at:serverTimestamp(),exceptionCaseId:exceptionCaseId.trim()});
    notifySuccess('Adayın yıllık aktifliği, görev şartları ve geçmiş adaylık yasağı kurallarla doğrulandı.');
  }catch(e){notifyError(e);}finally{setBusy(false);}};
  return <Card withBorder><Stack><Alert title="Denetleme: aday uygunluğu">Tüzük politikası etkin olduğunda YK/İK/ACTOR seçim sonuçlarının görevlere işlenmesi bu doğrulamaya bağlıdır. Baraj harcanabilir bakiyeden etkilenmez. YK için önceki İK görevi ve aktif IEEE üyeliği gerekir. Eşitlikte yıllık XP, sonrasında fiziksel kura kullanılır. İstisna gerektiren adaylar gerekçeli Denetleme dosyasında ayrıca değerlendirilir.</Alert><ErrorAlert error={list.error}/>{list.data.map(r=><Text key={r.id} size="sm">{r.uid} → {r.unitId} / {r.roleId} · {r.annualXp} yıllık XP</Text>)}{audit&&['draft','nominations'].includes(election.status)&&<><TextInput label="Adayın Hub UID’si" value={uid} onChange={e=>setUid(e.currentTarget.value)}/><TextInput label="Varsa onayli Denetleme aday istisnasi dosya kimligi" value={exceptionCaseId} onChange={e=>setExceptionCaseId(e.currentTarget.value)}/><Group>{election.positions.map(p=><Button key={p.key} size="xs" loading={busy} disabled={!uid.trim()} onClick={()=>void certify(p.unitId,p.roleId)}>{p.unitId} / {p.roleId} uygunluğunu doğrula</Button>)}</Group></>}</Stack></Card>;
}
