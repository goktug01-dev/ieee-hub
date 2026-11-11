import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, doc, collection, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { beforeAll, beforeEach, afterAll, test } from 'vitest';

let env: RulesTestEnvironment;
const version=Timestamp.fromMillis(1000), far=Timestamp.fromDate(new Date('2100-01-01'));
const settings={enabled:true,workerUid:'worker',senderEmail:'techopsieee@gmail.com',hubUrl:'https://example.web.app',maxPerRun:20,maxPerDay:200};
const task={status:'todo',unitId:'cs',assigneeUid:'owner',supporterUids:[],updatedAt:version};
const petition={status:'pending',ownerUid:'owner',visibleTo:['uid:owner','role:cs__chair'],updatedAt:version};
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-mail-rules',firestore:{host:'127.0.0.1',port:8085,rules:readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});});
afterAll(async()=>{await env?.cleanup();});
beforeEach(async()=>{
  await env.clearFirestore(); await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    for(const uid of ['owner','chair','stranger','admin']) {
      await setDoc(doc(db,'members',uid),{status:'active'});
      await setDoc(doc(db,'access',uid),{superAdmin:uid==='admin',perms:{},unitPerms:{},memberOf:{},tokens:[`uid:${uid}`,...(uid==='chair'?['role:cs__chair']:[])],roleKeys:uid==='chair'?{cs__chair:far}:{}});
    }
    await setDoc(doc(db,'settings/mail'),settings);
    await setDoc(doc(db,'tasks/t'),task);
    await setDoc(doc(db,'petitions/p'),petition);
  });
});
const dbFor=(uid:string,verified=true)=>env.authenticatedContext(uid,{email:`${uid}@example.com`,email_verified:verified}).firestore();
const signal=(kind='petition',sourceId='p')=>({kind,sourceId,sourceVersion:version,queuedAt:serverTimestamp(),readyAt:serverTimestamp(),state:'pending'});
const recipient=(email='owner@example.com')=>({email,petitions:true,tasks:true,updatedAt:serverTimestamp()});

test('Doğrulanmış üye yalnız kendi gerçek adresini ve tercihlerini yazar',async()=>{
  await assertFails(setDoc(doc(dbFor('owner',false),'mailRecipients/owner'),recipient()));
  await assertFails(setDoc(doc(dbFor('owner'),'mailRecipients/owner'),recipient('victim@example.com')));
  await assertSucceeds(setDoc(doc(dbFor('owner'),'mailRecipients/owner'),recipient()));
  await assertFails(setDoc(doc(dbFor('stranger'),'mailRecipients/owner'),recipient()));
  await assertFails(setDoc(doc(dbFor('owner'),'mailRecipients/owner'),{...recipient(),roles:['admin']}));
  await assertFails(getDocs(collection(dbFor('owner'),'mailRecipients')));
});
test('Sahte kaynak, alıcı, metin ve kaynak sürümü mail kuyruğuna giremez',async()=>{
  const db=dbFor('owner');
  await assertFails(setDoc(doc(db,'mailSignals/petition_absent'),signal('petition','absent')));
  await assertFails(setDoc(doc(db,'mailSignals/petition_p'),{...signal(),to:'victim@example.com'}));
  await assertFails(setDoc(doc(db,'mailSignals/petition_p'),{...signal(),sourceVersion:far}));
  await assertFails(setDoc(doc(db,'mailSignals/wrong'),signal()));
  await assertFails(setDoc(doc(dbFor('stranger'),'mailSignals/petition_p'),signal()));
  await assertSucceeds(setDoc(doc(db,'mailSignals/petition_p'),signal()));
});
test('Yetkili onaycı kuyruğa ekleyebilir; aynı sürüm normal kullanıcı tarafından sıfırlanamaz',async()=>{
  await assertSucceeds(setDoc(doc(dbFor('chair'),'mailSignals/petition_p'),signal()));
  await assertFails(setDoc(doc(dbFor('owner'),'mailSignals/petition_p'),signal()));
  await assertSucceeds(setDoc(doc(dbFor('admin'),'mailSignals/petition_p'),signal()));
});
test('Görev ve sinyali aynı batch içinde kabul edilir; başka kişinin görevi işaretlenemez',async()=>{
  const db=dbFor('owner'),batch=writeBatch(db);
  batch.update(doc(db,'tasks/t'),{status:'in_progress',updatedAt:serverTimestamp()});
  batch.set(doc(db,'mailSignals/task_t'),{...signal('task','t'),sourceVersion:serverTimestamp()});
  await assertSucceeds(batch.commit());
  await assertFails(setDoc(doc(dbFor('stranger'),'mailSignals/task_t'),signal('task','t')));
});
test('Otomasyon yalnız kuyrukla işaretlenen kaynağı okur; üye, gizli süreç ve kaynak listelerini okuyamaz',async()=>{
  const bot=dbFor('worker');
  await assertFails(getDoc(doc(bot,'petitions/p')));
  await setDoc(doc(dbFor('owner'),'mailSignals/petition_p'),signal());
  await assertSucceeds(getDoc(doc(bot,'petitions/p')));
  await assertFails(getDocs(collection(bot,'petitions')));
  await assertFails(getDocs(collection(bot,'tasks')));
  await assertFails(getDoc(doc(bot,'members/owner')));
  await assertFails(getDoc(doc(bot,'governanceCases/private')));
  await assertFails(getDoc(doc(bot,'settings/org')));
  await assertSucceeds(getDocs(collection(bot,'access')));
  await assertFails(setDoc(doc(bot,'access/worker'),{superAdmin:true}));
  await assertFails(updateDoc(doc(bot,'tasks/t'),{status:'done'}));
});
test('Pasif ve tedbirli üyeye ait mail adresi otomasyondan gizlenir',async()=>{
  await setDoc(doc(dbFor('owner'),'mailRecipients/owner'),recipient());
  await assertSucceeds(getDoc(doc(dbFor('worker'),'mailRecipients/owner')));
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'members/owner'),{status:'suspended'}));
  await assertFails(getDoc(doc(dbFor('worker'),'mailRecipients/owner')));
  await env.withSecurityRulesDisabled(async ctx=>{await updateDoc(doc(ctx.firestore(),'members/owner'),{status:'active'});await setDoc(doc(ctx.firestore(),'governanceHolds/owner/scopes/all'),{expiresAt:far});});
  await assertFails(getDoc(doc(dbFor('worker'),'mailRecipients/owner')));
});
test('Servis kapatıldığında veya kimlik değiştiğinde erişim hemen kesilir',async()=>{
  await updateDoc(doc(dbFor('admin'),'settings/mail'),{enabled:false,updatedAt:serverTimestamp()});
  await assertFails(getDocs(collection(dbFor('worker'),'access')));
  await assertSucceeds(getDoc(doc(dbFor('worker'),'settings/mail')));
  await updateDoc(doc(dbFor('admin'),'settings/mail'),{enabled:true,workerUid:'replacement',updatedAt:serverTimestamp()});
  await assertFails(getDoc(doc(dbFor('worker'),'settings/mail')));
});
test('Normal üye servisi açamaz; şifre ve geniş yönetici hesabı ayarlara yazılamaz',async()=>{
  await assertFails(updateDoc(doc(dbFor('owner'),'settings/mail'),{enabled:false,updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(dbFor('admin'),'settings/mail'),{smtpPassword:'secret',updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(dbFor('admin'),'settings/mail'),{workerUid:'admin',updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(dbFor('admin'),'settings/mail'),{maxPerDay:10000,updatedAt:serverTimestamp()}));
});
test('Günlük sayaç +1 ve ayarlı sınır ister; normal kullanıcı kota yazamaz',async()=>{
  await updateDoc(doc(dbFor('admin'),'settings/mail'),{maxPerDay:2,updatedAt:serverTimestamp()});
  const target=doc(dbFor('worker'),'mailDaily/2026-11-11');
  await assertFails(setDoc(target,{attempts:2,updatedAt:serverTimestamp()}));
  await assertSucceeds(setDoc(target,{attempts:1,updatedAt:serverTimestamp()}));
  await assertSucceeds(setDoc(target,{attempts:2,updatedAt:serverTimestamp()}));
  await assertFails(setDoc(target,{attempts:3,updatedAt:serverTimestamp()}));
  await assertFails(setDoc(doc(dbFor('owner'),'mailDaily/2026-11-11'),{attempts:1,updatedAt:serverTimestamp()}));
});
test('Teslim kaydı yalnız otomasyonda; yönetici belirsiz kaydı açıkça yeniden deneyebilir',async()=>{
  const data={signalId:'petition_p',recipientUid:'owner',fingerprint:'p:1:0',state:'uncertain',attempts:1,nextAttemptAt:far,updatedAt:serverTimestamp(),errorCode:'smtp-uncertain'};
  await assertFails(setDoc(doc(dbFor('owner'),'mailDeliveries/d'),data));
  await assertSucceeds(setDoc(doc(dbFor('worker'),'mailDeliveries/d'),data));
  await assertFails(getDoc(doc(dbFor('owner'),'mailDeliveries/d')));
  await assertSucceeds(updateDoc(doc(dbFor('admin'),'mailDeliveries/d'),{state:'failed',nextAttemptAt:serverTimestamp(),updatedAt:serverTimestamp()}));
  await updateDoc(doc(dbFor('worker'),'mailDeliveries/d'),{state:'sent',updatedAt:serverTimestamp()});
  await assertFails(updateDoc(doc(dbFor('admin'),'mailDeliveries/d'),{state:'failed',nextAttemptAt:serverTimestamp(),updatedAt:serverTimestamp()}));
});
