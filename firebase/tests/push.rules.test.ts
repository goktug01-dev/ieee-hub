import { readFileSync } from 'node:fs';
import { initializeTestEnvironment,assertFails,assertSucceeds,type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection,doc,getDoc,getDocs,serverTimestamp,setDoc,updateDoc } from 'firebase/firestore';
import { beforeAll,beforeEach,afterAll,test } from 'vitest';
let env:RulesTestEnvironment;
const publicKey='A'.repeat(87),id='a'.repeat(64);
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-push-rules',firestore:{host:'127.0.0.1',port:8085,rules:readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});});
afterAll(async()=>{await env?.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  for(const uid of ['u','other','admin']){await setDoc(doc(db,'members',uid),{status:'active'});await setDoc(doc(db,'access',uid),{superAdmin:uid==='admin',perms:{},roleKeys:{},tokens:[]});}
  await setDoc(doc(db,'settings/mail'),{enabled:true,workerUid:'bot'});await setDoc(doc(db,'settings/push'),{enabled:true,publicKey});
});});
const dbFor=(uid:string)=>env.authenticatedContext(uid).firestore();
const value=()=>({endpoint:'https://fcm.googleapis.com/fcm/send/test',p256dh:publicKey,auth:'A'.repeat(22),publicKey,petitions:true,tasks:true,updatedAt:serverTimestamp()});
test('Cihaz yalnız sahibi tarafından kaydedilir; diğer üye okuyamaz ve genel liste alınamaz',async()=>{
  await assertSucceeds(setDoc(doc(dbFor('u'),`pushSubscriptions/u/devices/${id}`),value()));
  await assertFails(setDoc(doc(dbFor('other'),`pushSubscriptions/u/devices/${id}`),value()));
  await assertFails(getDoc(doc(dbFor('other'),`pushSubscriptions/u/devices/${id}`)));
  await assertSucceeds(getDocs(collection(dbFor('bot'),'pushSubscriptions/u/devices')));
  await assertFails(getDocs(collection(dbFor('bot'),'pushSubscriptions')));
});
test('Keyfi ağ hedefi, özel alan ve eski anahtar kaydedilemez; servis kapatılınca kayıt kabul edilmez',async()=>{
  for(const changes of [{endpoint:'https://127.0.0.1/private'},{publicKey:'B'.repeat(87)},{admin:true}])await assertFails(setDoc(doc(dbFor('u'),`pushSubscriptions/u/devices/${id}`),{...value(),...changes}));
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'settings/push'),{enabled:false}));
  await assertFails(setDoc(doc(dbFor('u'),`pushSubscriptions/u/devices/${id}`),value()));
});
test('Üyelik askıdaysa cihaz uçları yürütücüye kapanır; ayar şeması genel settings kuralıyla aşılamaz',async()=>{
  await setDoc(doc(dbFor('u'),`pushSubscriptions/u/devices/${id}`),value());
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'members/u'),{status:'suspended'}));
  await assertFails(getDocs(collection(dbFor('bot'),'pushSubscriptions/u/devices')));
  await assertFails(setDoc(doc(dbFor('admin'),'settings/push'),{enabled:true,publicKey,updatedAt:serverTimestamp(),privateKey:'secret'}));
  await assertFails(setDoc(doc(dbFor('u'),'settings/push'),{enabled:true,publicKey,updatedAt:serverTimestamp()}));
});
