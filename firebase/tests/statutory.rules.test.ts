import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, doc, getDoc, getDocs, collection, query, where, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { beforeAll, beforeEach, afterAll, test } from 'vitest';
import { DEFAULT_STATUTORY_POLICY as policy } from '../../apps/hub/src/lib/statuteCatalog';

let env: RulesTestEnvironment;
const far=Timestamp.fromDate(new Date('2100-01-01'));
const proposal={termId:'year',threshold:10,inclusive:false,spendPercent:25,affectedArticles:[]};
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-statutory',firestore:{host:'127.0.0.1',port:8085,rules:readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});});
afterAll(async()=>{await env?.cleanup();});
beforeEach(async()=>{
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    for(const [uid,authority] of Object.entries({member:'',other:'',president:'president',secretary:'secretary',actor:'actor',audit:'audit',advisor:'advisor',techops:'techops',admin:''})) {
      await setDoc(doc(db,'members',uid),{uid,status:'active'});
      await setDoc(doc(db,'access',uid),{superAdmin:uid==='admin',perms:authority?{'governance.read':far}:{},unitPerms:{},roleKeys:authority?{[policy.roles[authority]]:far}:{},tokens:[],memberOf:[]});
    }
    await setDoc(doc(db,'statutoryPolicies','p'),{...policy,publishedAt:Timestamp.now(),publishedBy:'admin'});
    await setDoc(doc(db,'settings','statutory'),{policyId:'p'});
    await setDoc(doc(db,'terms','year'),{startsAt:Timestamp.fromMillis(1),endsAt:far});
  });
});
const dbFor=(uid:string)=>env.authenticatedContext(uid).firestore();
const caseData=(kind:string,uid='member',subjectUid:string|null='other')=>({kind,title:'Gerekçeli başvuru',summary:'Yazılı gerekçe',subjectUid,unitId:'branch',proposal,policyId:'p',confidential:policy.flows[kind].confidential,step:0,status:'open',createdBy:uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),stageStartedAt:serverTimestamp()});
async function seedCase(id:string,kind:string,step:number,status='open',subjectUid:string|null='other') {
  await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'governanceCases',id),{...caseData(kind),createdAt:Timestamp.now(),updatedAt:Timestamp.now(),stageStartedAt:Timestamp.now(),step,status,subjectUid}));
}
function decide(uid:string,id:string,kind:string,step:number,extras:{effect?:boolean;proofId?:string;expiresAt?:Timestamp}={}) {
  const db=dbFor(uid),b=writeBatch(db),f=policy.flows[kind];
  b.set(doc(db,'governanceCases',id,'actions',String(step)),{caseId:id,step,authority:f.stages[step].authority,actorUid:uid,decision:'approve',note:'Gerekçeli karar',proofId:extras.proofId||'',proofUrl:'https://example.org/tutanak',at:serverTimestamp()});
  b.update(doc(db,'governanceCases',id),{step:step+1,status:step+1===f.stages.length?'approved':'open',updatedAt:serverTimestamp(),stageStartedAt:serverTimestamp()});
  if(extras.effect) b.set(doc(db,'governanceHolds','other','scopes',f.effect==='actor_suspend'?'actor':'all'),{caseId:id,uid:'other',scope:f.effect==='actor_suspend'?'actor':'all',expiresAt:extras.expiresAt||far,byUid:uid,at:serverTimestamp()});
  return b.commit();
}
test('Üye dosya açabilir; gizli şikâyet yürütme ve teknik yöneticiden korunur',async()=>{
  await assertSucceeds(setDoc(doc(dbFor('member'),'governanceCases','private'),caseData('confidential_complaint','member',null)));
  await assertSucceeds(getDoc(doc(dbFor('member'),'governanceCases','private')));
  await assertSucceeds(getDoc(doc(dbFor('audit'),'governanceCases','private')));
  await assertSucceeds(getDocs(query(collection(dbFor('audit'),'governanceCases'),where('confidential','==',true))));
  await assertSucceeds(getDoc(doc(dbFor('advisor'),'governanceCases','private')));
  for(const uid of ['other','admin','president','secretary','techops']) await assertFails(getDoc(doc(dbFor(uid),'governanceCases','private')));
  await assertFails(setDoc(doc(dbFor('member'),'governanceCases','invalid'),caseData('confidential_complaint')));
});
test('Aşama makam ve atomik kayıt ister; yönetici ayrıcalığı makam yerine geçmez',async()=>{
  await assertSucceeds(setDoc(doc(dbFor('member'),'governanceCases','appeal'),caseData('appeal')));
  await assertFails(decide('admin','appeal','appeal',0));
  await assertFails(decide('president','appeal','appeal',0));
  await assertFails(updateDoc(doc(dbFor('audit'),'governanceCases','appeal'),{step:1,status:'open',updatedAt:serverTimestamp(),stageStartedAt:serverTimestamp()}));
  await assertSucceeds(decide('audit','appeal','appeal',0));
  await assertFails(updateDoc(doc(dbFor('audit'),'governanceCases','appeal','actions','0'),{note:'Tahrif'}));
  await assertSucceeds(decide('secretary','appeal','appeal',1));
});
test('Erişimi kapatılan ilgili üye savunmasını gönderebilir; makam imzası atamaz',async()=>{
  await seedCase('d','discipline',1,'open','other');
  await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'governanceHolds','other','scopes','all'),{expiresAt:far}));
  await assertSucceeds(getDoc(doc(dbFor('other'),'governanceCases','d')));
  await assertSucceeds(decide('other','d','discipline',1));
  await assertFails(decide('other','d','discipline',2));
});
test('ACTOR tedbiri son imzayla atomik, en fazla yedi gün; eski karar tekrar uzatılamaz',async()=>{
  await seedCase('hold','actor_temporary_suspension',0);
  await assertFails(decide('secretary','hold','actor_temporary_suspension',0));
  await assertFails(decide('secretary','hold','actor_temporary_suspension',0,{effect:true}));
  await assertSucceeds(decide('secretary','hold','actor_temporary_suspension',0,{effect:true,expiresAt:Timestamp.fromMillis(Date.now()+6*86400000)}));
  await assertFails(updateDoc(doc(dbFor('secretary'),'governanceHolds','other','scopes','actor'),{expiresAt:Timestamp.fromMillis(Date.now()+7*86400000),at:serverTimestamp()}));
});
test('Acil tedbir farklı iki görevli imzası ister ve tamamlanınca erişimi kapatır',async()=>{
  await seedCase('emergency','emergency_access',0);
  await assertSucceeds(decide('president','emergency','emergency_access',0));
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'access','president'),{[`roleKeys.${policy.roles.secretary}`]:far}));
  await assertFails(decide('president','emergency','emergency_access',1,{effect:true}));
  await assertSucceeds(decide('secretary','emergency','emergency_access',1,{effect:true}));
  await assertFails(getDocs(collection(dbFor('other'),'events')));
});
test('Kurul oylaması kabul, doğru kapsam/nisap ve ilgilinin çekilmesini gerektirir',async()=>{
  await seedCase('d','president_discipline',2);
  const vote={status:'closed',scope:'yk',rule:'unanimous',result:{outcome:'accepted'},roster:{other:{},president:{}},recusedUids:[]};
  await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'boardVotes','v'),vote));
  await assertFails(decide('secretary','d','president_discipline',2,{proofId:'v'}));
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'boardVotes','v'),{recusedUids:['other']}));
  await assertSucceeds(decide('secretary','d','president_discipline',2,{proofId:'v'}));
});
test('Baraj onay dosyasına bağlı ve değişmez; değişmez tüzük maddelerine süreç açılamaz',async()=>{
  await assertFails(setDoc(doc(dbFor('member'),'governanceCases','change'),{...caseData('charter_change'),proposal:{...proposal,affectedArticles:['81']}}));
  await assertSucceeds(setDoc(doc(dbFor('member'),'governanceCases','change'),{...caseData('charter_change'),proposal:{...proposal,affectedArticles:['78']}}));
  await seedCase('threshold','activity_threshold',4,'approved');
  const data={title:'Yıl',termId:'year',threshold:10,inclusive:false,spendPercent:25,caseId:'threshold',status:'published',startsAt:Timestamp.fromMillis(1),endsAt:far,createdBy:'secretary',createdAt:serverTimestamp()};
  await assertFails(setDoc(doc(dbFor('secretary'),'activityYears','year'),{...data,threshold:99}));
  await assertSucceeds(setDoc(doc(dbFor('secretary'),'activityYears','year'),data));
  await assertFails(updateDoc(doc(dbFor('secretary'),'activityYears','year'),{threshold:11}));
});
test('Yıllık XP ACTOR ve ayrı DK doğrulaması ister; üye ve teknik yönetici başkasının puanını okuyamaz',async()=>{
  await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'activityYears','year'),{}));
  const record={uid:'other',yearId:'year',siteUid:'site',annualXp:20,balance:0,registered:true,reachable:true,priorAdministrativeTerm:false,ieeeActive:false,status:'actor_verified',actorUid:'actor',actorAt:serverTimestamp(),note:'Yıllık kayıt'};
  await assertFails(setDoc(doc(dbFor('admin'),'annualActivity','year','members','other'),record));
  await assertSucceeds(setDoc(doc(dbFor('actor'),'annualActivity','year','members','other'),record));
  await assertSucceeds(getDoc(doc(dbFor('other'),'annualActivity','year','members','other')));
  for(const uid of ['member','admin','techops']) await assertFails(getDoc(doc(dbFor(uid),'annualActivity','year','members','other')));
  await assertFails(updateDoc(doc(dbFor('actor'),'annualActivity','year','members','other'),{status:'final',auditUid:'actor',auditAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(doc(dbFor('audit'),'annualActivity','year','members','other'),{status:'final',auditUid:'audit',auditAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(dbFor('actor'),'annualActivity','year','members','other'),{annualXp:100}));
});
test('ACTOR manuel atanamaz; kesinleşmiş seçim ve tamamlanmış güven dosyası gerekir',async()=>{
  const assignment={uid:'other',roleId:'actor',unitId:'branch',status:'active',source:'manual',createdBy:'admin',createdAt:serverTimestamp()};
  await assertFails(setDoc(doc(dbFor('admin'),'assignments','a'),assignment));
  await seedCase('actor-election','actor_election',4,'approved');
  await env.withSecurityRulesDisabled(async ctx=>{
    await setDoc(doc(ctx.firestore(),'electionAdmissions','e__branch__actor__other'),{uid:'other',roleId:'actor',unitId:'branch',electionId:'e',status:'verified'});
    await setDoc(doc(ctx.firestore(),'elections','e'),{status:'completed',positions:[{uid:'other',roleId:'actor',unitId:'branch',winnerUid:'other'}]});
  });
  await assertSucceeds(setDoc(doc(dbFor('admin'),'assignments','a'),{...assignment,source:'election',electionId:'e',governanceCaseId:'actor-election'}));
});
test('Denetleme aday uygunluğunu yıllık XP, IEEE ve önceki İK görevinden doğrular; eski adaylık yasağı aşılmaz',async()=>{
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    await setDoc(doc(db,'elections','e'),{activityYearId:'year',status:'nominations'});
    await setDoc(doc(db,'activityYears','year'),{threshold:10,inclusive:false});
    await setDoc(doc(db,'annualActivity','year','members','other'),{status:'final',registered:true,reachable:true,annualXp:20,ieeeActive:true,priorAdministrativeTerm:true});
  });
  const data={electionId:'e',uid:'other',unitId:'branch',roleId:'baskan',yearId:'year',annualXp:20,status:'verified',byUid:'audit',at:serverTimestamp()};
  await assertFails(setDoc(doc(dbFor('admin'),'electionAdmissions','e__branch__baskan__other'),{...data,byUid:'admin'}));
  await assertSucceeds(setDoc(doc(dbFor('audit'),'electionAdmissions','e__branch__baskan__other'),data));
  await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'candidateBans','other'),{caseId:'old'}));
  await assertFails(setDoc(doc(dbFor('audit'),'electionAdmissions','e__branch__sayman__other'),{...data,roleId:'sayman'}));
});
test('Finans yöneticisi tüzük bütçe onay zincirini atlayamaz',async()=>{
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'access','secretary'),{perms:{'finance.manage':far}}));
  const data={unitId:'branch',status:'approved',docsLink:'https://example.org/mali',governanceCaseId:'budget'};
  await assertFails(setDoc(doc(dbFor('secretary'),'budgets','b'),data));
  await seedCase('budget','budget',3,'approved');
  await assertSucceeds(setDoc(doc(dbFor('secretary'),'budgets','b'),data));
});
test('Tüzük için iki Genel Kurul arasında 15 gün ve ilkinde 2/3 şartları aranır',async()=>{
  await seedCase('charter','charter_change',1);
  const data={caseId:'charter',round:1,previousId:null,heldAt:Timestamp.fromMillis(Date.now()-16*86400000),totalMembers:30,attendance:20,yes:14,no:6,abstain:0,minutesUrl:'https://example.org/ga',createdBy:'secretary',createdAt:serverTimestamp()};
  await assertSucceeds(setDoc(doc(dbFor('secretary'),'assemblyRecords','first'),data));
  await env.withSecurityRulesDisabled(async ctx=>{await updateDoc(doc(ctx.firestore(),'governanceCases','charter'),{step:2});await setDoc(doc(ctx.firestore(),'governanceCases','charter','actions','1'),{proofId:'first'});});
  await assertFails(setDoc(doc(dbFor('secretary'),'assemblyRecords','early'),{...data,round:2,previousId:'first',heldAt:Timestamp.fromMillis(Date.now()-3*86400000)}));
  await assertSucceeds(setDoc(doc(dbFor('secretary'),'assemblyRecords','second'),{...data,round:2,previousId:'first',heldAt:Timestamp.now()}));
  await assertFails(updateDoc(doc(dbFor('secretary'),'assemblyRecords','first'),{yes:20}));
});
