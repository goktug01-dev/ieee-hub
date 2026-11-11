import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { beforeAll, beforeEach, afterAll, test } from 'vitest';
let env: RulesTestEnvironment;
const far = Timestamp.fromDate(new Date('2100-01-01'));
beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-site-workflow', firestore: { host: '127.0.0.1', port: 8085, rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } }); });
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    for (const uid of ['chair','president','vice','actor','admin','member','expired']) {
      await setDoc(doc(db,'members',uid),{ status:'active' });
      await setDoc(doc(db,'access',uid),{ superAdmin:uid === 'admin', perms:{}, roleKeys: uid === 'president' ? { branch__baskan:far } : uid === 'vice' ? { 'branch__baskan-yardimcisi':far } : uid === 'actor' ? { branch__actor:far } : uid === 'expired' ? { branch__actor:Timestamp.fromMillis(1) } : {}, unitPerms:{}, tokens:[] });
    }
    await setDoc(doc(db,'events','e'),{ status:'approved', unitId:'cs', ownerUids:['chair'], updatedAt:Timestamp.fromMillis(100), name:'Test' });
    await setDoc(doc(db,'externalIntegrations','firebase'),{ apiKey:'web-key' });
  });
});
const dbFor = (uid: string) => env.authenticatedContext(uid).firestore();
const announcement = (uid: string) => ({ title:'Başlık',content:'Metin',link:'',pinned:false,status:'published',createdBy:uid,createdAt:serverTimestamp(),updatedBy:uid,updatedAt:serverTimestamp() });
test('Başkan ve yardımcısı site duyurusu yayımlar; normal üye yayımlayamaz', async () => {
  await assertSucceeds(setDoc(doc(dbFor('president'),'siteAnnouncements','a'),announcement('president')));
  await assertSucceeds(setDoc(doc(dbFor('vice'),'siteAnnouncements','b'),announcement('vice')));
  await assertFails(setDoc(doc(dbFor('member'),'siteAnnouncements','c'),announcement('member')));
  await assertSucceeds(updateDoc(doc(dbFor('vice'),'siteAnnouncements','a'),{ content:'Düzenlendi',updatedBy:'vice',updatedAt:serverTimestamp() }));
  await assertFails(updateDoc(doc(dbFor('vice'),'siteAnnouncements','a'),{ createdBy:'vice',updatedBy:'vice',updatedAt:serverTimestamp() }));
});
test('Komite puan önerir; yalnız ACTOR doğrular, puan değiştirilemez', async () => {
  const request = { eventId:'e',unitId:'cs',points:20,note:'Komite önerisi',status:'requested',expiresAt:far,requestedBy:'chair',createdAt:serverTimestamp(),updatedAt:serverTimestamp() };
  await assertFails(setDoc(doc(dbFor('member'),'eventPointRequests','e'),{...request,requestedBy:'member'}));
  await assertSucceeds(setDoc(doc(dbFor('chair'),'eventPointRequests','e'),request));
  const approval = (uid: string) => ({ status:'approved',approvedBy:uid,approvedAt:serverTimestamp(),updatedAt:serverTimestamp() });
  await assertFails(updateDoc(doc(dbFor('president'),'eventPointRequests','e'),approval('president')));
  await assertFails(updateDoc(doc(dbFor('admin'),'eventPointRequests','e'),approval('admin')));
  await assertFails(updateDoc(doc(dbFor('expired'),'eventPointRequests','e'),approval('expired')));
  await assertSucceeds(updateDoc(doc(dbFor('actor'),'eventPointRequests','e'),approval('actor')));
  await assertFails(updateDoc(doc(dbFor('actor'),'eventPointRequests','e'),{points:99,updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(doc(dbFor('actor'),'eventPointRequests','e'),{status:'closed',updatedAt:serverTimestamp()}));
});
test('Site operatörü bağlantıyı okur ama ayarı değiştiremez', async () => {
  await assertSucceeds(getDoc(doc(dbFor('vice'),'externalIntegrations','firebase')));
  await assertSucceeds(getDoc(doc(dbFor('actor'),'externalIntegrations','firebase')));
  await assertFails(getDoc(doc(dbFor('member'),'externalIntegrations','firebase')));
  await assertFails(updateDoc(doc(dbFor('vice'),'externalIntegrations','firebase'),{apiKey:'different'}));
});
test('Aktarım makbuzu yalnız ilgili yetkiyle ve güncel kaynak sürümüyle yazılır', async () => {
  const receipt = (uid: string) => ({ kind:'event',sourceId:'e',sourceUpdatedAt:Timestamp.fromMillis(100),status:'synced',error:'',remoteId:'hub-e',remoteProjectId:'site',updatedAt:serverTimestamp(),byUid:uid });
  await assertFails(setDoc(doc(dbFor('member'),'siteSync','event__e'),receipt('member')));
  await assertFails(setDoc(doc(dbFor('actor'),'siteSync','event__e'),receipt('actor')));
  await assertSucceeds(setDoc(doc(dbFor('admin'),'siteSync','event__e'),receipt('admin')));
  await assertFails(setDoc(doc(dbFor('admin'),'siteSync','event__e'),{...receipt('admin'),sourceUpdatedAt:Timestamp.fromMillis(1)}));
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(),'eventPointRequests','e'),{updatedAt:Timestamp.fromMillis(200)}));
  const qrReceipt = (uid: string) => ({...receipt(uid),kind:'qr',sourceUpdatedAt:Timestamp.fromMillis(200),remoteId:'hub-event-e'});
  await assertFails(setDoc(doc(dbFor('admin'),'siteSync','qr__e'),qrReceipt('admin')));
  await assertSucceeds(setDoc(doc(dbFor('actor'),'siteSync','qr__e'),qrReceipt('actor')));
});
