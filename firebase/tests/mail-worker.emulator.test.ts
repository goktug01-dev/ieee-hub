import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, doc, getDoc, getDocs, collection, setDoc, updateDoc } from 'firebase/firestore';
import { beforeAll, beforeEach, afterAll, expect, test } from 'vitest';
import { processMail } from '../../scripts/mail/core.mjs';
import { mailStore } from '../../scripts/mail/store.mjs';
import { processPush } from '../../scripts/push/core.mjs';

let env: RulesTestEnvironment;
const version=Timestamp.fromMillis(1000), far=Timestamp.fromDate(new Date('2100-01-01'));
const config={enabled:true,workerUid:'bot',senderEmail:'techopsieee@gmail.com',hubUrl:'https://example.web.app',maxPerRun:20,maxPerDay:200};
const source={status:'todo',assigneeUid:'owner',mailAssignmentKey:'a',updatedAt:version,createdAt:version};
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-mail-worker',firestore:{host:'127.0.0.1',port:8085,rules:readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});});
afterAll(async()=>{await env?.cleanup();});
beforeEach(async()=>{
  await env.clearFirestore(); await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    await setDoc(doc(db,'settings/mail'),config);
    await setDoc(doc(db,'members/owner'),{status:'active'});
    await setDoc(doc(db,'access/owner'),{roleKeys:{cs__chair:far},tokens:['role:cs__chair']});
    await setDoc(doc(db,'mailRecipients/owner'),{email:'owner@example.com',tasks:true,petitions:true});
    await setDoc(doc(db,'tasks/t'),source);
    await setDoc(doc(db,'mailSignals/task_t'),{kind:'task',sourceId:'t',sourceVersion:version,queuedAt:version,readyAt:version,state:'pending'});
  });
});
const bot=()=>env.authenticatedContext('bot').firestore();
const transport=(calls:string[])=>({verify:async()=>{},sendMail:async(message:{to:{address:string}})=>{calls.push(message.to.address);return{accepted:[message.to.address]};}});

test('Push ayrı kuyruk/kota/makbuz kullanır; mail kaydını kapatmaz ve aynı cihaza mükerrer göndermez',async()=>{
  const publicKey='A'.repeat(87);
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    await setDoc(doc(db,'settings/push'),{enabled:true,publicKey});
    await setDoc(doc(db,'pushSubscriptions/owner/devices/d'),{endpoint:'https://fcm.googleapis.com/fcm/send/test',p256dh:publicKey,auth:'A'.repeat(22),publicKey,tasks:true,petitions:true});
    await setDoc(doc(db,'pushSignals/task_t'),{kind:'task',sourceId:'t',sourceVersion:version,queuedAt:version,readyAt:version,state:'pending'});
  });
  const db=bot(),calls:string[]=[],store=mailStore(db,'push');
  const run=()=>processPush({store,publicKey,dryRun:false,send:async(_device:unknown,payload:string)=>{calls.push(payload);}});
  const result=await run();expect(result.result).toBe('ok');expect(result.sent).toBe(1);
  expect((await getDoc(doc(db,'mailSignals/task_t'))).data()!.state).toBe('pending');
  expect((await getDocs(collection(db,'pushDeliveries'))).size).toBe(1);
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'pushSignals/task_t'),{state:'pending'}));
  await run();expect(calls).toHaveLength(1);
});

test('Gerçek SDK ve kurallarla kota rezervasyonu → SMTP kabulü → makbuz ve kuyruk kapanışı',async()=>{
  const db=bot(),calls:string[]=[],store=mailStore(db);
  const result=await processMail({store,transport:transport(calls),sender:config.senderEmail,dryRun:false});
  expect(result.result).toBe('ok'); expect(result.sent).toBe(1); expect(calls).toEqual(['owner@example.com']);
  expect((await getDoc(doc(db,'mailSignals/task_t'))).data()!.state).toBe('processed');
  const receipts=await getDocs(collection(db,'mailDeliveries')); expect(receipts.docs[0].data().state).toBe('sent');
  const daily=await getDocs(collection(db,'mailDaily')); expect(daily.docs[0].data().attempts).toBe(1);
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'mailSignals/task_t'),{state:'pending'}));
  await processMail({store,transport:transport(calls),sender:config.senderEmail,dryRun:false}); expect(calls).toHaveLength(1);
});
test('Dilekçe makamı sorgusu, aktif adım ve doğrulanmış alıcı dizini birlikte çözülür',async()=>{
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore(); await updateDoc(doc(db,'mailSignals/task_t'),{state:'processed'});
    await setDoc(doc(db,'petitions/p'),{status:'pending',revision:1,currentStep:0,ownerUid:'applicant',unitId:'cs',steps:[{unitMode:'petition',roleIds:['chair']}],visibleTo:['role:cs__chair'],updatedAt:version});
    await setDoc(doc(db,'mailSignals/petition_p'),{kind:'petition',sourceId:'p',sourceVersion:version,queuedAt:version,readyAt:version,state:'pending'});
  });
  const calls:string[]=[]; const result=await processMail({store:mailStore(bot()),transport:transport(calls),sender:config.senderEmail,dryRun:false});
  expect(result.result).toBe('ok'); expect(result.sent).toBe(1); expect(calls).toEqual(['owner@example.com']);
});
test('Tedbirli üyenin adresine erişim reddi gönderime dönüşmez',async()=>{
  await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'governanceHolds/owner/scopes/all'),{expiresAt:far}));
  const calls:string[]=[]; const result=await processMail({store:mailStore(bot()),transport:transport(calls),sender:config.senderEmail,dryRun:false});
  expect(result.result).toBe('ok'); expect(result.sent).toBe(0); expect(calls).toHaveLength(0);
});
test('Kuru kontrol kalıcı gönderim ve günlük kota kaydı oluşturmaz',async()=>{
  const db=bot(),calls:string[]=[];
  const result=await processMail({store:mailStore(db),transport:transport(calls),sender:config.senderEmail,dryRun:true});
  expect(result.result).toBe('ok'); expect(calls).toHaveLength(0);
  expect((await getDocs(collection(db,'mailDeliveries'))).empty).toBe(true);
  expect((await getDocs(collection(db,'mailDaily'))).empty).toBe(true);
  expect((await getDoc(doc(db,'mailSignals/task_t'))).data()!.state).toBe('pending');
});
test('Gönderim sırasında yeniden kuyruğa giren daha yeni sürüm kapatılmaz',async()=>{
  const store=mailStore(bot()); const [old]=await store.signals(20);
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'mailSignals/task_t'),{sourceVersion:Timestamp.fromMillis(1001),queuedAt:Timestamp.fromMillis(1001)}));
  await store.finishSignal(old,'processed');
  expect((await getDoc(doc(bot(),'mailSignals/task_t'))).data()!.state).toBe('pending');
});

test('İki yürütücü aynı teslim için yarışınca yalnız biri kota ve gönderim rezervasyonu alır',async()=>{
  const store=mailStore(bot());
  const identity={signalId:'task_t',recipientUid:'owner',fingerprint:'task:t:owner:a'};
  const attempts=await Promise.all([store.claim('race',identity,config,Date.now()),store.claim('race',identity,config,Date.now())]);
  expect(attempts.filter(Boolean)).toHaveLength(1);
  const daily=await getDocs(collection(bot(),'mailDaily'));
  expect(daily.docs[0].data().attempts).toBe(1);
});

test('Aynı günlük sayaç için yarışan farklı teslimler güvenli tekrar okumayla iki ayrı rezervasyon alır',async()=>{
  const store=mailStore(bot());
  const identity={signalId:'task_t',recipientUid:'owner',fingerprint:'task:t:owner:a'};
  const attempts=await Promise.all([store.claim('first',identity,config,Date.now()),store.claim('second',identity,config,Date.now())]);
  expect(attempts.filter(Boolean)).toHaveLength(2);
  const daily=await getDocs(collection(bot(),'mailDaily'));
  expect(daily.docs[0].data().attempts).toBe(2);
});
