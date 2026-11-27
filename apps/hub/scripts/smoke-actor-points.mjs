import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore';

// Komite önerisi → ACTOR geri gönderir → komite düzeltir → ACTOR puanı değiştirerek doğrular (ADR-0045).
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Yalnız demo emülatörleriyle çalıştırılır.');
Object.assign(process.env,{VITE_FIREBASE_API_KEY:'demo-key',VITE_FIREBASE_AUTH_DOMAIN:'demo-ieee-hub.firebaseapp.com',VITE_FIREBASE_PROJECT_ID:'demo-ieee-hub',VITE_FIREBASE_APP_ID:'demo-app',VITE_USE_EMULATORS:'1',VITE_AUTH_EMULATOR_PORT:'9099',VITE_FIRESTORE_EMULATOR_PORT:'8085'});
const env=await initializeTestEnvironment({projectId:'demo-ieee-hub',firestore:{host:'127.0.0.1',port:8085}});
const admin=async fn=>{let r;await env.withSecurityRulesDisabled(async ctx=>{r=await fn(ctx.firestore());});return r;};
const out=fileURLToPath(new URL('../smoke-shots/actor-points/',import.meta.url));
await mkdir(out,{recursive:true});
const base='http://127.0.0.1:5187';
const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),logLevel:'warn',server:{host:'127.0.0.1',port:5187,strictPort:true}});
let browser;
try {
  const {eventId,actorUid}=await admin(async db=>{
    const event=(await getDocs(collection(db,'events'))).docs.find(d=>d.data().name==='Yapay Zekâ Günü');
    assert.ok(event,'Demo etkinliği bulunamadı.');
    const year=new Date().getFullYear()+1;
    await setDoc(event.ref,{status:'planning',startsAt:`${year}-01-15 14:00:00`,endsAt:`${year}-01-15 18:00:00`},{merge:true});
    const gs=(await getDocs(collection(db,'members'))).docs.find(d=>d.data().email==='gs@demo.ieee');
    assert.ok(gs,'Demo ACTOR adayı bulunamadı.');
    const far=Timestamp.fromMillis(Date.now()+30*86400000);
    await setDoc(doc(db,'roles','actor'),{name:'ACTOR',scope:'branch',permissions:[],active:true,order:98},{merge:true});
    await setDoc(doc(db,'assignments','smoke-actor'),{uid:gs.id,memberName:'Mehmet Demir',roleId:'actor',roleName:'ACTOR',unitId:'branch',unitName:'Kol Geneli',status:'active',startsAt:Timestamp.fromMillis(Date.now()-3600000),endsAt:far});
    const access=(await getDoc(doc(db,'access',gs.id))).data();
    await setDoc(doc(db,'access',gs.id),{roleKeys:{...access.roleKeys,branch__actor:far}},{merge:true});
    return {eventId:event.id,actorUid:gs.id};
  });
  const request=()=>admin(async db=>(await getDoc(doc(db,'eventPointRequests',eventId))).data());
  await server.listen();
  browser=await chromium.launch({executablePath:process.env.BROWSER_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const errors=[];
  const as=async name=>{
    const context=await browser.newContext({viewport:{width:1366,height:950},locale:'tr-TR'});
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(`${name}: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`${name}: ${m.text()}`);});
    await page.goto(base);await page.getByText(name,{exact:true}).click();
    try { await page.getByRole('button',{name:'Kullanıcı menüsü'}).waitFor({timeout:20000}); }
    catch (e) { await page.screenshot({path:out+'login-failure.png',fullPage:true}); throw new Error(`${name} girişi tamamlanmadı: ${e.message.split(String.fromCharCode(10))[0]}`); }
    await page.goto(`${base}/etkinlikler/${eventId}?sekme=puan`);
    await page.getByText('Komite önerisi → ACTOR doğrulaması → Puan QR’ı',{exact:true}).waitFor();
    return {page,context};
  };
  const toast=(page,text)=>page.getByText(text,{exact:true}).first().waitFor();

  // 1. Komite önerir.
  let s=await as('Can Arslan');
  await s.page.getByLabel('Komitenin önerdiği aktiflik puanı').fill('20');
  await s.page.getByLabel('Puan gerekçesi').fill('Yarım günlük seminer.');
  await s.page.getByRole('button',{name:'ACTOR doğrulamasına gönder',exact:true}).click();
  await toast(s.page,'Puan önerisi ACTOR doğrulamasına gönderildi.');
  assert.equal((await request()).status,'requested');
  await s.context.close();

  // 2. ACTOR gerekçesiz geri gönderemez; gerekçeyle geri gönderir.
  s=await as('Mehmet Demir');
  const back=s.page.getByRole('button',{name:'Komiteye geri gönder',exact:true});
  assert.equal(await back.isEnabled(),false,'Gerekçesiz geri gönderme kapalı olmalı.');
  await s.page.getByLabel('ACTOR gerekçesi').fill('Konuşmacı sayısı ve süre gerekçede yok.');
  await back.click();
  await toast(s.page,'Öneri gerekçesiyle komiteye geri gönderildi.');
  let r=await request();
  assert.equal(r.status,'returned');assert.equal(r.returnedBy,actorUid);
  await s.context.close();

  // 3. Komite notu görür, düzeltip yeniden gönderir.
  s=await as('Can Arslan');
  await s.page.getByText('ACTOR’ün geri gönderme gerekçesi',{exact:true}).waitFor();
  await s.page.getByText('Konuşmacı sayısı ve süre gerekçede yok.',{exact:true}).waitFor();
  assert.equal(await s.page.getByLabel('Puan gerekçesi').inputValue(),'Yarım günlük seminer.','Form mevcut öneriyle açılmalı.');
  await s.page.getByLabel('Komitenin önerdiği aktiflik puanı').fill('25');
  await s.page.getByLabel('Puan gerekçesi').fill('İki konuşmacılı, dört saatlik seminer.');
  await s.page.screenshot({path:out+'returned-committee.png',fullPage:true,animations:'disabled'});
  await s.page.getByRole('button',{name:'Düzeltip yeniden gönder',exact:true}).click();
  await toast(s.page,'Düzeltilen öneri yeniden ACTOR doğrulamasına gönderildi.');
  r=await request();
  assert.equal(r.status,'requested');assert.equal(r.points,25);
  await s.context.close();

  // 4. ACTOR puanı değiştirirken gerekçe zorunlu; 40 puanla doğrular.
  s=await as('Mehmet Demir');
  await s.page.getByLabel('ACTOR’ün belirlediği puan').fill('40');
  const approve=s.page.getByRole('button',{name:'40 puan olarak doğrula ve QR oluştur',exact:true});
  assert.equal(await approve.isEnabled(),false,'Gerekçesiz puan değişikliği kapalı olmalı.');
  await s.page.getByLabel('ACTOR gerekçesi').fill('Kol geneli etkinlik ölçeğine göre artırıldı.');
  await s.page.screenshot({path:out+'actor-adjust.png',fullPage:true,animations:'disabled'});
  await approve.click();
  await toast(s.page,'ACTOR doğrulaması kaydedildi; puan QR’ı siteye oluşturulacak.');
  r=await request();
  assert.equal(r.status,'approved');assert.equal(r.points,40);assert.equal(r.proposedPoints,25);assert.equal(r.approvedBy,actorUid);
  await s.page.getByText('Komite önerisi 25 puandı; ACTOR 40 puan olarak doğruladı.',{exact:true}).waitFor();
  await s.page.screenshot({path:out+'approved-desktop.png',fullPage:true,animations:'disabled'});
  await s.page.setViewportSize({width:390,height:844});
  assert.equal(await s.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobilde yatay taşma olmamalı.');
  await s.page.screenshot({path:out+'approved-mobile.png',fullPage:true,animations:'disabled'});
  await s.page.setViewportSize({width:1366,height:950});
  await s.page.goto(`${base}/actor`);
  await s.page.getByText('Doğrulanan / kapatılan', {exact:true}).click();
  await s.page.getByText(/Computer Society · 40 puan \(komite önerisi 25\)/).waitFor();
  await s.page.screenshot({path:out+'actor-page.png',fullPage:true,animations:'disabled'});
  await s.context.close();

  assert.deepEqual(errors,[]);
  console.log('ACTOR puanı: öneri, gerekçeli geri gönderme, komitenin düzeltmesi, gerekçeli puan değişikliğiyle doğrulama, mobil görünüm ve ACTOR listesi geçti.');
} finally {await browser?.close();await server.close();await env.cleanup();}
