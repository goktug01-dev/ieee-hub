import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { get, ref, set, update } from 'firebase/database';
import { beforeAll, afterAll, beforeEach, test, describe } from 'vitest';

describe.skipIf(!process.env.FIREBASE_DATABASE_EMULATOR_HOST)('Site RTDB kuralları', () => {
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-ieee-site', database: { host: '127.0.0.1', port: 9006, rules: readFileSync(new URL('../site.database.rules.json', import.meta.url), 'utf8') } });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (ctx) => { await set(ref(ctx.database()), { roles_by_uid: { admin: { admin: true } }, site_access: { controller: { qr: Date.now() + 86400000 }, editor: { calendar: Date.now() + 86400000, announcements: Date.now() + 86400000 }, expired: { qr: 1 } }, committees: { a: { name: 'A', presidentUid: 'alice' }, b: { name: 'B', presidentUid: 'bob' } }, technical_events: { old: { title: 'Test', committeeId: 'b', pointCost: 10, createdAt: 1 } } }); });
});
test('Komite başkanı başka komitenin etkinliğini kendi komitesine taşıyamaz', async () => {
  await assertFails(update(ref(env.authenticatedContext('alice').database(), 'technical_events/old'), { committeeId: 'a' }));
});
test('Puan QR kaydı yalnız ACTOR yetkisiyle oluşur ve puanı sonradan değişmez', async () => {
  const db = env.authenticatedContext('controller').database();
  const qr = { event: 'Test', puan: 15, active: true, createdAt: 1, expiresAt: Date.now() + 86400000 };
  await assertSucceeds(set(ref(db, 'committee_qrs/a/qr'), qr));
  await assertFails(set(ref(env.authenticatedContext('alice').database(), 'committee_qrs/a/qr2'), qr));
  await assertFails(set(ref(env.authenticatedContext('admin').database(), 'valid_qrs/admin-qr'), qr));
  await assertFails(set(ref(env.authenticatedContext('expired').database(), 'valid_qrs/expired-qr'), qr));
  await assertSucceeds(set(ref(db, 'valid_qrs/qr'), { ...qr, committeeId: 'a' }));
  await assertFails(update(ref(db, 'valid_qrs/qr'), { puan: 100 }));
  await assertSucceeds(update(ref(db), { 'committee_qrs/a/shared': qr, 'valid_qrs/shared': { ...qr, committeeId: 'a' } }));
  await assertSucceeds(update(ref(db), { 'committee_qrs/a/shared/active': false, 'valid_qrs/shared/active': false }));
  await assertFails(update(ref(db), { 'committee_qrs/a/shared': null, 'valid_qrs/shared': null }));
});
test('Site editörü yalnız Hub kaynaklı etkinlik/duyuru yayımlar', async () => {
  const db = env.authenticatedContext('editor').database();
  const e = { id: 'hub-test', title: 'Test', desc: '', start: '2026-10-10T12:00:00Z', location: '', visibility: 'public', status: 'published', source: 'hub', createdAt: 1, createdBy: 'editor' };
  await assertSucceeds(set(ref(db, 'events/hub-test'), e));
  await assertFails(set(ref(db, 'events/legacy-event'), e));
  await assertSucceeds(set(ref(db, 'public_announcements/hub-test'), { title: 'Test', content: 'Metin', createdAt: 1, createdByUid: 'editor' }));
  await assertSucceeds(update(ref(db, 'public_announcements/hub-test'), { title: 'Güncel duyuru' }));
  await assertFails(update(ref(db, 'public_announcements/hub-test'), { createdByUid: 'someone' }));
  await assertSucceeds(set(ref(db, 'public_announcements/hub-test'), null));
  await assertSucceeds(set(ref(db, 'events/hub-test'), null));
  await assertFails(set(ref(db, 'public_announcements/legacy-announcement'), { title: 'Test', content: 'Metin', createdAt: 1 }));
});
test('Üyelik sorumlusu onay verir; puan ve işlem yetkisi veremez', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await update(ref(ctx.database()), { 'site_access/membership/members': Date.now() + 86400000, 'users/member': { name: 'Üye', email: 'member@example.com', approved: false, sadakat: 7 } });
  });
  const db = env.authenticatedContext('membership', { email: 'operator@example.com' }).database();
  await assertSucceeds(get(ref(db, 'users')));
  await assertSucceeds(update(ref(db), {
    'users/member/approved': true,
    'leaderboard_public/updatedAt': { '.sv': 'timestamp' },
    'admin_point_audit/approval': { action: 'approve_members', actorUid: 'membership', affectedUids: ['member'], reason: 'Başvuru doğrulandı', at: { '.sv': 'timestamp' } },
  }));
  await assertFails(set(ref(db, 'users/member/sadakat'), 100));
  await assertFails(set(ref(db, 'site_access/membership/qr'), Date.now() + 86400000));
  await assertFails(set(ref(db, 'admin_point_audit/points'), { action: 'update_points', actorUid: 'membership', affectedUids: ['member'], reason: 'Puan', at: { '.sv': 'timestamp' } }));
});
test('Üyeler süresi dolan veya kapanan yeni QR’ı okuyamaz', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await set(ref(ctx.database(), 'valid_qrs'), {
      expired: { event: 'Test', puan: 10, active: true, createdAt: 1, expiresAt: 1 },
      closed: { event: 'Test', puan: 10, active: false, createdAt: 1, expiresAt: Date.now() + 86400000 },
      open: { event: 'Test', puan: 10, active: true, createdAt: 1, expiresAt: Date.now() + 86400000 },
    });
  });
  const db = env.authenticatedContext('member').database();
  await assertFails(get(ref(db, 'valid_qrs/expired')));
  await assertFails(get(ref(db, 'valid_qrs/closed')));
  await assertSucceeds(get(ref(db, 'valid_qrs/open')));
});
test('Yetkisiz kullanıcı site kayıtlarını ve denetim kaydını yazamaz', async () => {
  const db = env.authenticatedContext('member').database();
  await assertFails(set(ref(db, 'committees/c'), { name: 'C' }));
  await assertFails(set(ref(db, 'committee_qrs/a/qr'), { event: 'Test', puan: 1, active: true, createdAt: 1 }));
  await assertFails(set(ref(db, 'admin_point_audit/forged'), { action: 'update_points', actorUid: 'member', affectedUids: ['member'], reason: 'Test', at: { '.sv': 'timestamp' } }));
});
test('Admin boş sıralamayı atomik olarak kaydedebilir', async () => {
  await assertSucceeds(update(ref(env.authenticatedContext('admin').database()), { 'leaderboard_public/updatedAt': { '.sv': 'timestamp' }, 'leaderboard_public/me': {}, 'leaderboard_public/top10': [] }));
});
test('Duyuruyu başka admin düzenlerken ilk yazar korunur', async () => {
  const first = env.authenticatedContext('alice').database();
  await assertSucceeds(set(ref(first, 'committee_announcements/a/notice'), { title: 'Test', content: 'Metin', createdAt: 1, createdByUid: 'alice' }));
  await assertSucceeds(update(ref(env.authenticatedContext('admin').database(), 'committee_announcements/a/notice'), { title: 'Yeni' }));
  await assertFails(update(ref(first, 'committee_announcements/a/notice'), { createdByUid: 'someone' }));
});
test('Puan sıralaması üyeye kapalı; tam kök yedeği yalnız süreli yedek yetkisiyle okunur',async()=>{
  await env.withSecurityRulesDisabled(ctx=>update(ref(ctx.database()),{'leaderboard_public/top10':[{name:'Üye',score:7}],'site_access/backup/backup':Date.now()+86400000}));
  await assertFails(get(ref(env.authenticatedContext('member').database(),'leaderboard_public')));
  await assertFails(get(ref(env.authenticatedContext('admin').database())));
  await assertSucceeds(get(ref(env.authenticatedContext('backup').database())));
  await assertFails(update(ref(env.authenticatedContext('backup').database()),{'site_access/backup/qr':Date.now()+86400000}));
});
test('Eğitim yılı arşivi, başlangıç XP ve bakiye sıfırlama atomik; aynı yıl tekrar açılamaz',async()=>{
  await env.withSecurityRulesDisabled(ctx=>update(ref(ctx.database()),{'site_access/controller/activity':Date.now()+86400000,'users/member':{name:'Üye',sadakat:7,lifetime_earned:40,lifetime_spent:33,approved:true}}));
  const db=env.authenticatedContext('controller').database();
  const timestamp={'.sv':'timestamp'};
  const payload={
    'activity_current':{id:'year',startsAt:1,endsAt:Date.now()+86400000,sourceCaseId:'approved',byUid:'controller',at:timestamp},
    'activity_rollovers/year':{yearId:'year',previousYearId:'legacy',sourceCaseId:'approved',byUid:'controller',at:timestamp,memberCount:1},
    'activity_year_archives/year':{previousYearId:'legacy',sourceCaseId:'approved',byUid:'controller',at:timestamp,users:{member:{sadakat:7,lifetime_earned:40}}},
    'users/member/activityYear':'year','users/member/annual_start_earned':40,'users/member/sadakat':0,
  };
  await assertSucceeds(update(ref(db),payload));
  await assertFails(update(ref(db),payload));
  await assertFails(update(ref(env.authenticatedContext('member').database(),'users/member'),{annual_start_earned:0}));
  await assertFails(update(ref(db,'activity_year_archives/year'),{previousYearId:'tampered'}));
});
});
