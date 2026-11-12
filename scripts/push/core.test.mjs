import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processPush,pushEligible,safeEndpoint } from './core.mjs';
import { createECDH,randomBytes } from 'node:crypto';
import { generateVAPIDKeys,generateRequestDetails } from 'web-push';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const now=1800000000000;
const device={id:'d',endpoint:'https://fcm.googleapis.com/fcm/send/abc',tasks:true,petitions:true,publicKey:'public'};
function fixture() {
  const source={status:'todo',assigneeUid:'u',mailAssignmentKey:'a'},signal={id:'task_t',kind:'task',sourceId:'t',queuedAt:now};
  const records=new Map(),sent=[];let state='pending';
  const store={settings:async()=>({enabled:true,maxPerRun:20,senderEmail:'club@gmail.com'}),pushConfig:async()=>({enabled:true,publicKey:'public'}),
    signals:async()=>state==='pending'?[signal]:[],source:async()=>source,candidates:async()=>[{uid:'u'}],pushDevices:async()=>[device],pushDevice:async()=>device,
    delivery:async id=>records.get(id),claim:async(id,identity)=>{const value={...identity,attempts:1,state:'sending'};records.set(id,value);return value;},
    record:async(id,data)=>records.set(id,data),finishSignal:async(s,value)=>{state=value;},health:async()=>{},pushAccess:async()=>null};
  return {source,signal,records,sent,store,run:(dryRun=false)=>processPush({store,publicKey:'public',dryRun,now:()=>now,send:async(d,p)=>sent.push(p)}),reset:()=>{state='pending';}};
}
test('Aynı cihazdaki aynı atama bir kez bildirilir; başlık ve kişi adı gönderilmez',async()=>{
  const f=fixture();f.source.title='Özel bilgi';assert.equal((await f.run()).sent,1);f.reset();assert.equal((await f.run()).sent,0);
  assert.equal(f.sent.length,1);assert.deepEqual(Object.keys(JSON.parse(f.sent[0])).sort(),['kind','tag']);assert.ok(!f.sent[0].includes('Özel bilgi'));
});
test('Kuru kontrol ve kapalı tercih göndermez; kota rezervasyonu olmadan gönderim olmaz',async()=>{
  const f=fixture();await f.run(true);assert.equal(f.records.size,0);assert.equal(f.sent.length,0);
  f.store.pushDevice=async()=>({...device,tasks:false});await f.run();assert.equal(f.sent.length,0);
  f.reset();f.store.pushDevice=async()=>device;f.store.claim=async()=>null;await f.run();assert.equal(f.sent.length,0);
});
test('Görev kapandığında, cihaz kaldırıldığında veya anahtar değiştiğinde göndermez',async()=>{
  const a=fixture();a.source.status='done';await a.run();assert.equal(a.sent.length,0);
  const b=fixture();b.store.pushDevice=async()=>null;await b.run();assert.equal(b.sent.length,0);
  const c=fixture();c.store.pushDevice=async()=>({...device,publicKey:'old'});await c.run();assert.equal(c.sent.length,0);
});
test('Kesilmiş/belirsiz önceki gönderim otomatik tekrarlanmaz',async()=>{
  const f=fixture();await f.run();for(const [id,v]of f.records)f.records.set(id,{...v,state:'sending'});f.reset();
  assert.equal((await f.run()).uncertain,1);assert.equal(f.sent.length,1);
});
test('Dilekçede güncel makam, görünürlük ve sahibi ayrımı korunur',()=>{
  const source={status:'pending',ownerUid:'owner',currentStep:0,unitId:'cs',steps:[{unitMode:'petition',roleIds:['chair']}],visibleTo:['role:cs__chair']};
  const access={roleKeys:{cs__chair:now+1000},tokens:['role:cs__chair']};
  assert.equal(pushEligible('petition',source,'u',access,device,now),true);
  assert.equal(pushEligible('petition',source,'owner',access,device,now),false);
  assert.equal(pushEligible('petition',source,'u',{...access,tokens:[]},device,now),false);
});
test('Yalnız güvenilir HTTPS push uçları kabul edilir; SSRF, kullanıcı bilgisi, port ve yanıltıcı alan reddedilir',()=>{
  for(const value of ['http://fcm.googleapis.com/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.test/x','https://user@fcm.googleapis.com/x','https://fcm.googleapis.com:8080/x'])assert.equal(safeEndpoint(value),false);
  assert.equal(safeEndpoint('https://web.push.apple.com/abc'),true);
});
test('Gerçek Web Push kütüphanesi VAPID ile imzalı ve şifreli istek üretir; ağ isteği yapılmaz',()=>{
  const keys=generateVAPIDKeys(),ecdh=createECDH('prime256v1');ecdh.generateKeys();
  const request=generateRequestDetails({endpoint:device.endpoint,keys:{p256dh:ecdh.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}},'özel olmayan bildirim',
    {vapidDetails:{subject:'mailto:club@gmail.com',...keys},TTL:3600});
  assert.ok(request.headers.Authorization.startsWith('vapid '));assert.ok(Buffer.isBuffer(request.body));
  assert.ok(!request.body.includes(Buffer.from('özel olmayan bildirim')));
});
test('Service worker yalnız genel metin gösterir ve tıklamada yalnız Hub sayfasını açar',async()=>{
  const handlers={},messages=[],opened=[];
  const self={addEventListener:(name,fn)=>{handlers[name]=fn;},registration:{showNotification:async(title,options)=>messages.push({title,options})},location:{origin:'https://example.web.app'},clients:{openWindow:async url=>opened.push(url)}};
  runInNewContext(readFileSync(new URL('../../apps/hub/public/sw.js',import.meta.url),'utf8'),{self,URL});
  let work;handlers.push({data:{json:()=>({kind:'petition',title:'Özel kişi',url:'https://evil.test'})},waitUntil:promise=>{work=promise;}});await work;
  assert.equal(messages[0].title,'IEEE Hub');assert.ok(!JSON.stringify(messages).includes('Özel kişi'));
  handlers.notificationclick({notification:{data:{path:'https://evil.test'},close(){}},waitUntil:promise=>{work=promise;}});await work;
  assert.deepEqual(opened,['https://example.web.app/gorevler']);
});
