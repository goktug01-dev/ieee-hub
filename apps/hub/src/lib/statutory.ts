import { Timestamp, collection, doc, getDocFromServer, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { hasPermission, hasRoleKey, hasUnitPermission } from './access';
import { auditInBatch } from './audit';
import { createAssignments } from './assignments';
import type { Access, Assignment, WithId } from './types';
import type { StatutoryCase, StatutoryPolicy, StatutoryStage, AnnualActivity, ActivityYear } from './statutoryTypes';
import { DEFAULT_STATUTORY_POLICY, IMMUTABLE_ARTICLES } from './statuteCatalog';

export const DAY = 86400000;
/** Türkiye takvimi; hafta sonu ve arayüzden girilen resmî tatiller süreye sayılmaz. */
export function addStatutoryDays(start: number, count: number, business: boolean, holidays: string[] = []): number {
  const date = new Date(start + 3 * 3600000);
  const excluded = new Set(holidays);
  let remaining = Math.max(0, Math.floor(count));
  while (remaining) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (!business || (weekday !== 0 && weekday !== 6 && !excluded.has(date.toISOString().slice(0,10)))) remaining--;
  }
  return date.getTime() - 3 * 3600000;
}
export function caseDeadline(c: StatutoryCase, p: StatutoryPolicy): number | null {
  const stage = p.flows[c.kind]?.stages[c.step];
  return c.status === 'open' && stage?.days && c.stageStartedAt ? addStatutoryDays(c.stageStartedAt.toMillis(), stage.days, stage.businessDays, p.holidays) : null;
}
export function canSignStatutoryStage(a: Access | null, p: StatutoryPolicy, c: StatutoryCase, stage: StatutoryStage, uid: string): boolean {
  if (stage.authority === 'subject') return c.subjectUid === uid;
  if (c.subjectUid === uid) return false;
  if (stage.authority === 'committee') return hasUnitPermission(a, c.unitId, 'unit.manage');
  if (['yk','ik','joint','assembly'].includes(stage.authority)) return hasRoleKey(a, p.roles.secretary) || hasRoleKey(a, p.roles.president);
  if (stage.authority === 'secretary') return hasRoleKey(a, p.roles.secretary) || hasRoleKey(a, p.roles.advisor);
  return hasRoleKey(a, p.roles[stage.authority]);
}
export function activityEligible(record: AnnualActivity | null | undefined, year: ActivityYear | null | undefined) {
  return !!record && !!year && record.status === 'final' && record.registered && record.reachable && (year.inclusive ? record.annualXp >= year.threshold : record.annualXp > year.threshold);
}
export function reserveAllocation(amount: number, percent: number) {
  const total = Math.round(amount * 100);
  const reserve = Math.round(total * percent / 100);
  return { reserve: reserve / 100, operating: (total - reserve) / 100 };
}

export async function publishStatutoryPolicy(input: Omit<StatutoryPolicy,'publishedBy'|'publishedAt'>) {
  for (const [kind, flow] of Object.entries(input.flows)) {
    if (!flow.stages.length || flow.stages.length > 10 || flow.implicitApproval !== false) throw new Error(`${kind}: geçerli onay aşamaları gerekir.`);
    if (flow.stages.some(s => s.days < 0 || s.days > 365)) throw new Error('Süre 0–365 gün olmalı.');
  }
  const ref = doc(collection(db,'statutoryPolicies'));
  const batch = writeBatch(db);
  batch.set(ref, {...input, publishedBy:auth.currentUser!.uid,publishedAt:serverTimestamp()});
  batch.set(doc(db,'settings','statutory'),{policyId:ref.id,updatedBy:auth.currentUser!.uid,updatedAt:serverTimestamp()});
  auditInBatch(batch,'statutory.policy.publish',ref.path,{name:input.name});
  await batch.commit();
}
export async function createStatutoryCase(input: Pick<StatutoryCase,'kind'|'title'|'summary'|'subjectUid'|'unitId'|'proposal'>, policyId: string, policy: StatutoryPolicy) {
  const flow = policy.flows[input.kind];
  if (!flow || !input.title.trim() || !input.summary.trim()) throw new Error('Süreç, başlık ve gerekçe zorunludur.');
  if (input.kind === 'charter_change' && (!input.proposal.affectedArticles.length || input.proposal.affectedArticles.some(a=>IMMUTABLE_ARTICLES.includes(a)))) throw new Error('Değiştirilecek maddeleri seçin. Tüzüğün değişmez maddeleri için süreç açılamaz.');
  if (['suspend','actor_suspend','candidate_ban','actor_elected','restore'].includes(flow.effect) && !input.subjectUid) throw new Error('Bu süreç için ilgili üyeyi belirtin.');
  const target=doc(collection(db,'governanceCases'));
  await setDoc(target,{...input,title:input.title.trim(),summary:input.summary.trim(),subjectUid:flow.confidential ? null : input.subjectUid,policyId,confidential:flow.confidential,step:0,status:'open',createdBy:auth.currentUser!.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),stageStartedAt:serverTimestamp()});
  return target.id;
}
export async function decideStatutoryCase(id: string, approve: boolean, note: string, proofId: string, proofUrl: string) {
  if (!note.trim()) throw new Error('Gerekçeli karar notu zorunludur.');
  const target=doc(db,'governanceCases',id), snap=await getDocFromServer(target);
  const c=snap.data() as StatutoryCase;
  if (c.status !== 'open') throw new Error('Bu süreç açık değil.');
  const policy=(await getDocFromServer(doc(db,'statutoryPolicies',c.policyId))).data() as StatutoryPolicy;
  const f=policy.flows[c.kind], stage=f.stages[c.step], complete=approve && c.step+1===f.stages.length;
  const uid=auth.currentUser!.uid;
  const batch=writeBatch(db);
  batch.set(doc(db,'governanceCases',id,'actions',String(c.step)),{caseId:id,step:c.step,authority:stage.authority,actorUid:uid,decision:approve?'approve':'reject',note:note.trim(),proofId:proofId.trim(),proofUrl:proofUrl.trim(),at:serverTimestamp()});
  batch.update(target,{step:approve?c.step+1:c.step,status:!approve?'rejected':complete?'approved':'open',stageStartedAt:serverTimestamp(),updatedAt:serverTimestamp()});
  // Tedbir ve adaylık yasağı son gerekli onayla aynı atomik işlemde yürürlüğe girer.
  if (complete && c.subjectUid && ['suspend','actor_suspend','candidate_ban'].includes(f.effect)) {
    const expiresAt=c.kind==='actor_temporary_suspension'?Timestamp.fromMillis(Date.now()+7*DAY):Timestamp.fromDate(new Date('2100-01-01'));
    const scope=f.effect==='actor_suspend'?'actor':'all';
    batch.set(doc(db,'governanceHolds',c.subjectUid,'scopes',scope),{caseId:id,uid:c.subjectUid,scope,expiresAt,byUid:uid,at:serverTimestamp()});
    if (f.effect==='candidate_ban' && !(await getDocFromServer(doc(db,'candidateBans',c.subjectUid))).exists()) batch.set(doc(db,'candidateBans',c.subjectUid),{uid:c.subjectUid,caseId:id,byUid:uid,at:serverTimestamp()});
  }
  if(complete && c.subjectUid && f.effect==='restore') for(const scope of ['all','actor']) batch.set(doc(db,'governanceHolds',c.subjectUid,'scopes',scope),{caseId:id,uid:c.subjectUid,scope,expiresAt:Timestamp.now(),byUid:uid,at:serverTimestamp()});
  const followup:Record<string,string>={precaution:'precaution_review',emergency_access:'emergency_ratification',actor_temporary_suspension:'actor_review'};
  if(complete && followup[c.kind] && policy.flows[followup[c.kind]]) batch.set(doc(db,'governanceCases',`${id}-review`),{kind:followup[c.kind],sourceCaseId:id,title:`${c.title}: takip`.slice(0,200),summary:`Kaynak dosya: ${id}. Gerekçe: ${c.summary}`.slice(0,20000),subjectUid:c.subjectUid,unitId:c.unitId,proposal:c.proposal,policyId:c.policyId,confidential:false,step:0,status:'open',createdBy:uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),stageStartedAt:serverTimestamp()});
  await batch.commit();
}
/** Kesinleşmiş kararın veri etkisini uygular; kurul kararını kendi başına üretmez. */
export async function applyStatutoryCase(id: string, access: Access | null) {
  const target=doc(db,'governanceCases',id), snap=await getDocFromServer(target), c=snap.data() as StatutoryCase;
  if (c.status!=='approved' || c.appliedAt) throw new Error('Uygulanacak yeni bir kesinleşmiş karar bulunamadı.');
  const policy=(await getDocFromServer(doc(db,'statutoryPolicies',c.policyId))).data() as StatutoryPolicy;
  const effect=policy.flows[c.kind].effect;
  let appliedAssignmentId:string|null=null;
  if (effect==='actor_elected') {
    if (!hasPermission(access,'assignments.manage') || !c.subjectUid) throw new Error('Görev kaydına işlemek için görev atama yetkilisi gerekir.');
    const first=(await getDocFromServer(doc(db,'governanceCases',id,'actions','0'))).data()!;
    const election=(await getDocFromServer(doc(db,'elections',first.proofId))).data()!;
    const assignments=await getDocs(query(collection(db,'assignments'),where('uid','==',c.subjectUid),where('status','==','active')));
    const board=(await getDocFromServer(doc(db,'settings','boards'))).data();
    const ykRoles: string[]=board?.yk?.seats?.filter((s:{unitId:string})=>s.unitId==='branch').map((s:{roleId:string})=>s.roleId) || ['baskan','baskan-yardimcisi','genel-sekreter','sayman','yk-uyesi'];
    const incompatible=assignments.docs.map(d=>({id:d.id,...d.data()} as WithId<Assignment>)).filter(a=>a.unitId==='branch' && ykRoles.includes(a.roleId));
    const member=(await getDocFromServer(doc(db,'members',c.subjectUid))).data()!;
    const term=election.termId?(await getDocFromServer(doc(db,'terms',election.termId))).data():null;
    const roleId=policy.roles.actor.split('__').slice(1).join('__');
    const already=(await getDocs(query(collection(db,'assignments'),where('uid','==',c.subjectUid),where('roleId','==',roleId),where('status','==','active')))).docs.some(d=>d.data().governanceCaseId===id);
    if(!already) { const result=await createAssignments([{uid:c.subjectUid,memberName:member.displayName,roleId,roleName:'ACTOR',unitId:'branch',unitName:'Öğrenci Kolu',termId:election.termId,startsAt:term?.startsAt && term.startsAt.toMillis()>Date.now()?term.startsAt:Timestamp.now(),endsAt:term?.endsAt||Timestamp.fromMillis(Date.now()+365*DAY),source:'election',electionId:first.proofId,governanceCaseId:id,note:`Tüzük Madde 30–37 · ${c.title}`}],{replaceExisting:true,endExisting:incompatible}); if(result.failed.length) throw new Error('Görev kaydedildi ancak erişim yeniden hesaplanamadı. Görev atamaları ekranından erişimleri yeniden hesaplayın.'); }
    appliedAssignmentId=(await getDocs(query(collection(db,'assignments'),where('uid','==',c.subjectUid),where('roleId','==',roleId),where('status','==','active')))).docs.find(d=>d.data().governanceCaseId===id)?.id||null;
    if(!appliedAssignmentId)throw new Error('ACTOR görev kaydı doğrulanamadı.');
  }
  const batch=writeBatch(db);
  if (effect==='committee_passive' || effect==='committee_closed') {
    batch.update(doc(db,'units',c.unitId),{active:false,statutoryStatus:effect==='committee_passive'?'passive':'closed',governanceCaseId:id,statutoryChangedAt:serverTimestamp()});
  }
  batch.update(target,{appliedAt:serverTimestamp(),appliedBy:auth.currentUser!.uid,updatedAt:serverTimestamp(),...(appliedAssignmentId?{appliedAssignmentId}: {})});
  await batch.commit();
}

export async function publishActivityYear(input: Omit<ActivityYear,'createdBy'|'createdAt'|'status'>) {
  if(input.threshold<0 || !Number.isInteger(input.threshold) || input.spendPercent<0 || input.spendPercent>100 || input.endsAt.toMillis()<=input.startsAt.toMillis()) throw new Error('Baraj, oran ve yıl tarihlerini kontrol edin.');
  await setDoc(doc(db,'activityYears',input.termId),{...input,status:'published',createdBy:auth.currentUser!.uid,createdAt:serverTimestamp()});
}
export async function verifyAnnualActivity(yearId:string,input:Omit<AnnualActivity,'yearId'|'status'|'actorUid'|'actorAt'|'auditUid'|'auditAt'>) {
  await setDoc(doc(db,'annualActivity',yearId,'members',input.uid),{...input,yearId,status:'actor_verified',actorUid:auth.currentUser!.uid,actorAt:serverTimestamp()});
}
export async function finalizeAnnualActivity(yearId:string,uid:string) {
  const {updateDoc}=await import('firebase/firestore');
  await updateDoc(doc(db,'annualActivity',yearId,'members',uid),{status:'final',auditUid:auth.currentUser!.uid,auditAt:serverTimestamp()});
}
export const initialStatutoryPolicy = () => structuredClone(DEFAULT_STATUTORY_POLICY);
