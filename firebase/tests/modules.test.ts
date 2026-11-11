import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  arrayUnion,
  collection,
  doc,
  deleteDoc,
  deleteField,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const FAR = Timestamp.fromDate(new Date('2100-01-01T00:00:00Z'));
let env: RulesTestEnvironment;

const ctx = (uid: string): Firestore =>
  env.authenticatedContext(uid, { auth_time: Math.floor(Date.now() / 1000) }).firestore() as unknown as Firestore;

const baseAccess = (uid: string) => ({ superAdmin: false, perms: {}, roleKeys: {}, tokens: [`uid:${uid}`], unitPerms: {}, memberOf: {} });

async function seed() {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore() as unknown as Firestore;
    for (const u of ['chair', 'csVol', 'rasVol', 'stranger', 'gs', 'sponsorMgr', 'sayman', 'comms', 'newbie', 'coord', 'techops', 'orgAdmin']) {
      await setDoc(doc(db, 'members', u), { uid: u, status: 'active', displayName: u, createdAt: Timestamp.now() });
    }
    await setDoc(doc(db, 'settings', 'org'), { volunteerRoleId: 'gonullu' });
    await setDoc(doc(db, 'privacyNotices', 'n1'), {
      kind: 'recruitment', title: 'KVKK', versionLabel: 'v1', body: 'x'.repeat(300), publishedAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'settings', 'public'), { orgName: 'IEEE', orgShortName: 'IEEE', recruitmentPrivacyNoticeId: 'n1' });
    await setDoc(doc(db, 'access', 'orgAdmin'), { ...baseAccess('orgAdmin'), perms: { 'org.manage': FAR } });
    await setDoc(doc(db, 'access', 'chair'), {
      ...baseAccess('chair'),
      roleKeys: { 'cs__birim-baskani': FAR },
      tokens: ['uid:chair', 'role:cs__birim-baskani', 'unit:cs'],
      unitPerms: { 'cs__unit.manage': FAR, 'cs__unit.tasks.manage': FAR, 'cs__unit.events.propose': FAR, 'cs__unit.room.reserve': FAR },
      memberOf: { cs: FAR },
    });
    await setDoc(doc(db, 'access', 'coord'), {
      ...baseAccess('coord'),
      unitPerms: { 'cs__unit.tasks.manage': FAR, 'cs__unit.events.propose': FAR, 'cs__unit.meetings.manage': FAR },
      memberOf: { cs: FAR },
    });
    await setDoc(doc(db, 'access', 'csVol'), { ...baseAccess('csVol'), memberOf: { cs: FAR } });
    await setDoc(doc(db, 'access', 'rasVol'), { ...baseAccess('rasVol'), memberOf: { ras: FAR } });
    await setDoc(doc(db, 'access', 'stranger'), baseAccess('stranger'));
    await setDoc(doc(db, 'access', 'gs'), {
      ...baseAccess('gs'),
      perms: { 'work.manageAll': FAR, 'events.approve': FAR, 'events.manageAll': FAR, 'members.manage': FAR },
      roleKeys: { 'branch__genel-sekreter': FAR },
      tokens: ['uid:gs', 'role:branch__genel-sekreter'],
    });
    await setDoc(doc(db, 'access', 'sponsorMgr'), { ...baseAccess('sponsorMgr'), perms: { 'sponsors.manage': FAR } });
    await setDoc(doc(db, 'access', 'sayman'), { ...baseAccess('sayman'), perms: { 'finance.read': FAR, 'finance.manage': FAR } });
    await setDoc(doc(db, 'access', 'comms'), { ...baseAccess('comms'), perms: { 'content.manage': FAR } });
    await setDoc(doc(db, 'access', 'techops'), { ...baseAccess('techops'), perms: { 'external.firebase.manage': FAR } });

    await setDoc(doc(db, 'tasks', 't1'), {
      code: 'CS-0001', title: 'Afiş', unitId: 'cs', assigneeUid: 'csVol', supporterUids: [], status: 'todo',
      priority: 'normal', doneCriteria: 'Afiş onaylandı', createdBy: 'chair',
    });
    await setDoc(doc(db, 'events', 'e1'), {
      code: 'EVT-2026-001', name: 'AI Günü', unitId: 'cs', status: 'proposed', ownerUids: ['coord'], createdBy: 'coord',
    });
    await setDoc(doc(db, 'petitions', 'pOk'), { status: 'approved', unitId: 'cs', ownerUid: 'coord', visibleTo: [] });
    await setDoc(doc(db, 'petitions', 'pRas'), { status: 'approved', unitId: 'ras', ownerUid: 'coord', visibleTo: [] });
    await setDoc(doc(db, 'contentRequests', 'c1'), {
      requestingUnitId: 'cs', requestedBy: 'coord', status: 'in_production', eventId: 'e1', type: 'event_promo',
    });
    await setDoc(doc(db, 'sponsors', 's1'), { companyName: 'Acme', ownerUid: 'coord', stage: 'contacted' });
    await setDoc(doc(db, 'sponsorLocks', 'acme'), { companyName: 'Acme', ownerName: 'coord', ownerUid: 'coord' });
    await setDoc(doc(db, 'budgets', 'b1'), { unitId: 'cs', title: 'CS', plannedTotal: 100 });
    await setDoc(doc(db, 'budgets', 'b2'), { unitId: 'ras', title: 'RAS', plannedTotal: 100 });
    await setDoc(doc(db, 'handovers', 'h1'), {
      authorUid: 'oldChair', roleId: 'birim-baskani', unitId: 'cs', status: 'submitted',
      visibleTo: ['uid:oldChair', 'role:cs__birim-baskani'],
    });
  });

}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ieee-hub',
    firestore: { rules: readFileSync(fileURLToPath(new URL('../firestore.rules', import.meta.url)), 'utf8') },
  });
});
afterAll(async () => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

describe('sekreterlik defteri', () => {
  it('yalnızca yetkili rol kayıt oluşturur ve okur', async () => {
    const entry = {
      kind: 'meeting', date: '2026-09-25', referenceNo: 'YK-2026-01', title: 'YK toplantısı',
      unitId: 'branch', unitName: 'Kol Geneli', summary: 'Gündem ve kararlar', attendees: '',
      followUpDate: null, fileLink: '', createdBy: 'gs', createdByName: 'GS', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(ctx('gs'), 'secretaryLedger', 'l1'), entry));
    await assertFails(setDoc(doc(ctx('stranger'), 'secretaryLedger', 'l2'), { ...entry, createdBy: 'stranger' }));
    await assertFails(getDoc(doc(ctx('stranger'), 'secretaryLedger', 'l1')));
  });
});

describe('birim toplantıları', () => {
  const meeting = (over: Record<string, unknown> = {}) => ({
    unitId: 'cs', unitName: 'Computer Society', title: 'Aylık toplantı', meetingNo: 'CS-2026-04',
    date: '2026-09-27', startTime: '19:00', endTime: '20:00', location: 'B-201',
    chairName: 'Başkan', recorderName: 'Sekreter', attendeeUids: ['csVol'], attendeeNames: ['csVol'],
    guestAttendees: '', agenda: [], decisions: [], generalNotes: '', nextMeetingDate: null,
    status: 'draft', createdBy: 'coord', createdByName: 'coord', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    ...over,
  });

  it('birim toplantı yetkilisi oluşturur; aynı birimin üyesi okur, başka birim okuyamaz', async () => {
    await assertSucceeds(setDoc(doc(ctx('coord'), 'meetings', 'm1'), meeting()));
    await assertSucceeds(getDocs(query(collection(ctx('csVol'), 'meetings'), where('unitId', '==', 'cs'))));
    await assertFails(getDoc(doc(ctx('rasVol'), 'meetings', 'm1')));
    await assertFails(setDoc(doc(ctx('csVol'), 'meetings', 'm2'), meeting({ createdBy: 'csVol' })));
  });

  it('kesinleşen tutanak değiştirilmez ve silinmez', async () => {
    await setDoc(doc(ctx('coord'), 'meetings', 'm1'), meeting());
    await assertSucceeds(updateDoc(doc(ctx('coord'), 'meetings', 'm1'), {
      status: 'final', finalizedBy: 'coord', finalizedByName: 'coord', finalizedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(ctx('coord'), 'meetings', 'm1'), { title: 'Sonradan değişti', updatedAt: serverTimestamp() }));
  });
});

describe('harici Firebase bağlantı ayarı', () => {
  it('yalnız özel TechOps izni olan kullanıcı okuyup yazar', async () => {
    const config = { apiKey: 'public-web-key', authDomain: 'x.firebaseapp.com', projectId: 'x', appId: '1:x:web:y', databaseURL: '', resources: [], updatedBy: 'techops', updatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(ctx('techops'), 'externalIntegrations', 'firebase'), config));
    await assertSucceeds(getDoc(doc(ctx('techops'), 'externalIntegrations', 'firebase')));
    await assertFails(getDoc(doc(ctx('stranger'), 'externalIntegrations', 'firebase')));
    await assertFails(setDoc(doc(ctx('stranger'), 'externalIntegrations', 'firebase'), { ...config, updatedBy: 'stranger' }));
  });
});

describe('herkese açık tüzük', () => {
  const metadata = (versionId: string) => ({
    versionId,
    title: 'IEEE İKÇÜ Öğrenci Kolu Tüzüğü',
    versionLabel: '2026 Rev. 1',
    summary: 'Genel kurulda kabul edildi.',
    fileName: 'tuzuk.pdf',
    mimeType: 'application/pdf',
    size: 8,
    sha256: 'a'.repeat(64),
    chunkCount: 1,
    publishedAt: serverTimestamp(),
    publishedByName: 'Genel Sekreter',
  });

  it('yetkili yeni sürümü atomik yayımlar; girişsiz ziyaretçi güncel dosyayı ve arşivi okur', async () => {
    const db = ctx('gs');
    const batch = writeBatch(db);
    batch.set(doc(db, 'statuteVersions', 'v1'), metadata('v1'));
    batch.set(doc(db, 'statuteVersions/v1/chunks', '000'), { index: 0, data: 'JVBERi0x' });
    batch.set(doc(db, 'statutes', 'current'), metadata('v1'));
    await assertSucceeds(batch.commit());

    const publicDb = env.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertSucceeds(getDoc(doc(publicDb, 'statutes', 'current')));
    await assertSucceeds(getDocs(collection(publicDb, 'statuteVersions')));
    await assertSucceeds(getDocs(collection(publicDb, 'statuteVersions/v1/chunks')));
  });

  it('sıradan üye yayımlayamaz ve yayımlanmış sürüm değiştirilemez', async () => {
    await assertFails(setDoc(doc(ctx('stranger'), 'statuteVersions', 'bad'), metadata('bad')));
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), 'statuteVersions', 'v1'), { ...metadata('v1'), publishedAt: Timestamp.now() });
    });
    await assertFails(updateDoc(doc(ctx('gs'), 'statuteVersions', 'v1'), { summary: 'Değiştirildi' }));
  });
});

describe('demirbaş ve zimmet', () => {
  const asset = (by = 'sayman') => ({
    code: 'DMB-2026-0001', name: 'Dizüstü bilgisayar', category: 'Bilgisayar', description: '', serialNo: 'SN-1',
    unitId: 'branch', unitName: 'Kol Geneli', location: 'Kulüp odası', status: 'available', condition: 'good',
    custodianUid: null, custodianName: '', purchaseDate: null, purchaseValue: 1000, warrantyEndDate: null, notes: '', lastMovementId: 'am1',
    createdBy: by, createdByName: by, createdAt: serverTimestamp(), updatedBy: by, updatedByName: by, updatedAt: serverTimestamp(),
  });

  it('envanter/finans yetkilisi kaydeder ve hareket ekler; yetkisiz üye göremez', async () => {
    const db = ctx('sayman');
    const batch = writeBatch(db);
    batch.set(doc(db, 'assets', 'a1'), asset());
    batch.set(doc(db, 'assetMovements', 'am1'), {
      assetId: 'a1', assetCode: 'DMB-2026-0001', assetName: 'Dizüstü bilgisayar', type: 'create', note: 'İlk kayıt',
      from: null, to: { status: 'available', location: 'Kulüp odası', custodianName: '' }, byUid: 'sayman', byName: 'sayman', at: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(doc(ctx('sayman'), 'assets', 'a1')));
    await assertFails(getDoc(doc(ctx('stranger'), 'assets', 'a1')));
    await assertFails(setDoc(doc(ctx('stranger'), 'assets', 'a2'), asset('stranger')));
  });

  it('demirbaş silinemez; hareket geçmişi değiştirilemez', async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.firestore() as unknown as Firestore;
      await setDoc(doc(db, 'assets', 'a1'), { ...asset(), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
      await setDoc(doc(db, 'assetMovements', 'am1'), { assetId: 'a1', assetCode: 'DMB-2026-0001', assetName: 'Dizüstü bilgisayar', type: 'create', note: '', from: null, to: {}, byUid: 'sayman', byName: 'sayman', at: Timestamp.now() });
    });
    await assertFails(deleteDoc(doc(ctx('sayman'), 'assets', 'a1')));
    await assertFails(updateDoc(doc(ctx('sayman'), 'assetMovements', 'am1'), { note: 'değişti' }));
  });
});

describe('görevler', () => {
  const task = (over: Record<string, unknown> = {}) => ({
    code: 'CS-0002', title: 'Salon', unitId: 'cs', assigneeUid: 'csVol', supporterUids: [], status: 'todo',
    priority: 'high', doneCriteria: 'Rezervasyon', createdBy: 'coord', ...over,
  });

  it('koordinasyon üyesi kendi biriminde görev açar, başka birimde açamaz', async () => {
    await assertSucceeds(setDoc(doc(ctx('coord'), 'tasks', 't2'), task()));
    await assertFails(setDoc(doc(ctx('coord'), 'tasks', 't3'), task({ unitId: 'ras' })));
  });

  it('birim üyesi birim panosunu sorgular; başka birimin gönüllüsü göremez', async () => {
    await assertSucceeds(getDocs(query(collection(ctx('csVol'), 'tasks'), where('unitId', '==', 'cs'))));
    await assertFails(getDocs(query(collection(ctx('rasVol'), 'tasks'), where('unitId', '==', 'cs'))));
    await assertFails(getDoc(doc(ctx('rasVol'), 'tasks', 't1')));
  });

  it('sorumlu yalnızca durumu günceller', async () => {
    await assertSucceeds(updateDoc(doc(ctx('csVol'), 'tasks', 't1'), { status: 'in_progress', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(ctx('csVol'), 'tasks', 't1'), { title: 'değişti' }));
    await assertSucceeds(getDocs(query(collection(ctx('csVol'), 'tasks'), where('assigneeUid', '==', 'csVol'))));
  });
});

describe('gönüllü kabulü (birim başkanı yetki devri)', () => {
  const delegation = { unitId: 'cs', roleId: 'gonullu', by: 'chair' };

  it('başkan erişim özeti olmayan üyeye yalnızca gönüllü rolünü verebilir', async () => {
    const db = ctx('chair');
    await assertSucceeds(
      setDoc(doc(db, 'assignments', 'a1'), { uid: 'newbie', roleId: 'gonullu', unitId: 'cs', status: 'active', source: 'volunteer' }),
    );
    await assertFails(
      setDoc(doc(db, 'assignments', 'a2'), { uid: 'newbie', roleId: 'birim-baskani', unitId: 'cs', status: 'active', source: 'volunteer' }),
    );
    await assertFails(
      setDoc(doc(db, 'assignments', 'a3'), { uid: 'newbie', roleId: 'gonullu', unitId: 'ras', status: 'active', source: 'volunteer' }),
    );
    await assertSucceeds(
      setDoc(doc(db, 'access', 'newbie'), {
        superAdmin: false, perms: {}, unitPerms: {},
        roleKeys: { cs__gonullu: FAR }, memberOf: { cs: FAR }, tokens: ['uid:newbie', 'role:cs__gonullu'],
        lastDelegation: delegation, updatedAt: serverTimestamp(),
      }),
    );
  });

  it('başkan mevcut özeti genişletirken başka yetki ekleyemez', async () => {
    const db = ctx('chair');
    const ref = doc(db, 'access', 'rasVol');
    await assertSucceeds(
      updateDoc(ref, {
        'roleKeys.cs__gonullu': FAR, 'memberOf.cs': FAR, tokens: arrayUnion('role:cs__gonullu'),
        lastDelegation: delegation, updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(updateDoc(ref, { 'perms.org.manage': FAR, lastDelegation: delegation }));
    await assertFails(updateDoc(ref, { 'roleKeys.cs__birim-baskani': FAR, lastDelegation: delegation }));
    await assertFails(updateDoc(ref, { 'memberOf.ras2': FAR, 'roleKeys.cs__gonullu': FAR, lastDelegation: delegation }));
    await assertFails(
      updateDoc(doc(ctx('csVol'), 'access', 'rasVol'), { 'roleKeys.cs__gonullu': FAR, lastDelegation: { ...delegation, by: 'csVol' } }),
    );
  });
});

describe('komite ve YK başvuru ilanları', () => {
  const nextWeek = Timestamp.fromDate(new Date(Date.now() + 7 * 864e5));
  const yesterday = Timestamp.fromDate(new Date(Date.now() - 864e5));
  const call = (status = 'draft') => ({
    unitId: 'cs', unitName: 'Computer Society', title: 'CS Güz Ekip Alımı', roleTitle: 'Etkinlik ekibi gönüllüsü',
    summary: 'Birlikte teknik etkinlikler üretmek isteyen ekip arkadaşları arıyoruz.', description: '', expectations: '',
    capacity: 8, status, opensAt: yesterday, closesAt: nextWeek, questions: [],
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  const application = () => ({
    callId: 'c1', callTitle: 'CS Güz Ekip Alımı', unitId: 'cs', unitName: 'Computer Society',
    uid: 'candidate', name: 'Aday Kişi', email: 'aday@example.com', phone: '', department: 'Bilgisayar Mühendisliği',
    studentNo: '', ieeeMemberNo: '', motivation: 'Komitenin teknik etkinliklerinde sorumluluk almak ve birlikte üretmek istiyorum.',
    availability: '', answers: {}, privacyConsent: true, privacyNoticeId: 'n1', status: 'pending', submittedAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  const meta = (uid: string) => ({ createdBy: uid, createdByName: uid, createdAt: serverTimestamp() });
  // İlan ve açanın kimliğini taşıyan internal/meta aynı batch'te yazılır.
  const createCall = (uid: string, id: string, data: Record<string, unknown> = call(), metaData: Record<string, unknown> = meta(uid)) => {
    const db = ctx(uid);
    const batch = writeBatch(db);
    batch.set(doc(db, 'recruitmentCalls', id), data);
    batch.set(doc(db, 'recruitmentCalls', id, 'internal', 'meta'), metaData);
    return batch.commit();
  };
  // Karar ve değerlendirenin kimliğini taşıyan internal/review aynı batch'te yazılır.
  const review = (uid: string, status: string, reviewer = uid) => {
    const db = ctx(uid);
    const batch = writeBatch(db);
    batch.update(doc(db, 'recruitmentApplications', 'c1__candidate'), {
      status, reviewedAt: serverTimestamp(), decisionNote: '', updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'recruitmentApplications', 'c1__candidate', 'internal', 'review'), {
      reviewedBy: reviewer, reviewedByName: reviewer, reviewedAt: serverTimestamp(), status,
    });
    return batch.commit();
  };
  const openCall = async () => {
    await createCall('chair', 'c1');
    await updateDoc(doc(ctx('chair'), 'recruitmentCalls', 'c1'), { status: 'open', updatedAt: serverTimestamp() });
  };

  it('birim yöneticisi taslak açar; yalnız yayımlanmış ilan anonim vitrinde görünür', async () => {
    await assertSucceeds(createCall('chair', 'c1'));
    const publicDb = env.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(getDoc(doc(publicDb, 'recruitmentCalls', 'c1')));
    await assertSucceeds(updateDoc(doc(ctx('chair'), 'recruitmentCalls', 'c1'), { status: 'open', updatedAt: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(publicDb, 'recruitmentCalls', 'c1')));
    await assertSucceeds(getDocs(query(collection(publicDb, 'recruitmentCalls'), where('status', '==', 'open'))));
    await assertFails(createCall('rasVol', 'bad'));
  });

  it('ilanı açanın kimliği herkese açık belgeye yazılamaz; yalnız yöneticiler okur', async () => {
    const publicDb = env.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(createCall('chair', 'leak', { ...call(), createdBy: 'chair', createdByName: 'chair' }));
    await assertFails(setDoc(doc(ctx('chair'), 'recruitmentCalls', 'nometa'), call()));
    await assertFails(createCall('chair', 'spoof', call(), meta('rasVol')));
    await openCall();
    await assertSucceeds(getDoc(doc(ctx('chair'), 'recruitmentCalls', 'c1', 'internal', 'meta')));
    await assertFails(getDoc(doc(publicDb, 'recruitmentCalls', 'c1', 'internal', 'meta')));
    await assertFails(getDoc(doc(ctx('candidate'), 'recruitmentCalls', 'c1', 'internal', 'meta')));
    await assertFails(updateDoc(doc(ctx('chair'), 'recruitmentCalls', 'c1', 'internal', 'meta'), { createdByName: 'x' }));
    await assertFails(updateDoc(doc(ctx('chair'), 'recruitmentCalls', 'c1'), { createdByName: 'chair', updatedAt: serverTimestamp() }));
  });

  it('eski sürümden kalan kişi alanları ilk güncellemede silinmek zorundadır', async () => {
    await env.withSecurityRulesDisabled(async (admin) => {
      await setDoc(doc(admin.firestore(), 'recruitmentCalls', 'legacy'), {
        ...call(), createdBy: 'chair', createdByName: 'Başkan', createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      });
    });
    const ref = doc(ctx('chair'), 'recruitmentCalls', 'legacy');
    await assertFails(updateDoc(ref, { status: 'open', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { status: 'open', updatedAt: serverTimestamp(), createdBy: deleteField(), createdByName: deleteField() }));
  });

  it('değerlendirenin kimliği adaya görünmez; kayıtsız veya sahte kimlikli karar reddedilir', async () => {
    await openCall();
    await setDoc(doc(ctx('candidate'), 'recruitmentApplications', 'c1__candidate'), application());
    const appRef = doc(ctx('chair'), 'recruitmentApplications', 'c1__candidate');
    await assertFails(updateDoc(appRef, {
      status: 'reviewing', reviewedBy: 'chair', reviewedByName: 'chair', reviewedAt: serverTimestamp(), decisionNote: '', updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(appRef, { status: 'reviewing', reviewedAt: serverTimestamp(), decisionNote: '', updatedAt: serverTimestamp() }));
    await assertFails(review('chair', 'reviewing', 'rasVol'));
    await assertFails(setDoc(doc(ctx('chair'), 'recruitmentApplications', 'c1__candidate', 'internal', 'review'), {
      reviewedBy: 'chair', reviewedByName: 'chair', reviewedAt: serverTimestamp(), status: 'reviewing',
    }));
    await assertSucceeds(review('chair', 'reviewing'));
    await assertSucceeds(review('chair', 'accepted'));
    await assertSucceeds(getDoc(doc(ctx('chair'), 'recruitmentApplications', 'c1__candidate', 'internal', 'review')));
    await assertFails(getDoc(doc(ctx('candidate'), 'recruitmentApplications', 'c1__candidate', 'internal', 'review')));
    await assertFails(getDoc(doc(ctx('rasVol'), 'recruitmentApplications', 'c1__candidate', 'internal', 'review')));
    await assertFails(review('chair', 'rejected'));
  });

  it('KVKK aydınlatma metni zorunludur: yayımlı sürüm dışında veya metin yokken başvuru alınmaz', async () => {
    await openCall();
    const ref = doc(ctx('candidate'), 'recruitmentApplications', 'c1__candidate');
    await assertFails(setDoc(ref, { ...application(), privacyNoticeId: 'eski-surum' }));
    const { privacyNoticeId: _omit, ...withoutNotice } = application();
    await assertFails(setDoc(ref, withoutNotice));
    await assertFails(setDoc(ref, { ...application(), privacyConsent: false }));
    await env.withSecurityRulesDisabled(async (admin) => {
      await setDoc(doc(admin.firestore(), 'settings', 'public'), { orgName: 'IEEE', orgShortName: 'IEEE' });
    });
    await assertFails(setDoc(ref, application()));
  });

  it('aydınlatma metni herkese açık, değiştirilemez sürümlerle yalnız organizasyon yöneticisince yayımlanır', async () => {
    const publicDb = env.unauthenticatedContext().firestore() as unknown as Firestore;
    const notice = { kind: 'recruitment', title: 'KVKK', versionLabel: 'v2', body: 'y'.repeat(300), publishedAt: serverTimestamp() };
    const publish = (uid: string, id: string, data: Record<string, unknown> = notice, pointer = id) => {
      const db = ctx(uid);
      const batch = writeBatch(db);
      batch.set(doc(db, 'privacyNotices', id), data);
      batch.set(doc(db, 'settings', 'public'), { recruitmentPrivacyNoticeId: pointer }, { merge: true });
      return batch.commit();
    };
    await assertSucceeds(getDoc(doc(publicDb, 'privacyNotices', 'n1')));
    await assertFails(publish('chair', 'n2'));
    await assertFails(publish('orgAdmin', 'short', { ...notice, body: 'kısa' }));
    await assertFails(publish('orgAdmin', 'extra', { ...notice, publishedByName: 'Yönetici' }));
    await assertFails(setDoc(doc(ctx('orgAdmin'), 'settings', 'public'), { recruitmentPrivacyNoticeId: 'yok' }, { merge: true }));
    await assertFails(publish('orgAdmin', 'wrongkind', { ...notice, kind: 'unknown' }));
    // Çerez politikası, başvuru metni yerine yürürlüğe konamaz; kendi işaretçisine konabilir.
    const adminDb = ctx('orgAdmin');
    const cookies = writeBatch(adminDb);
    cookies.set(doc(adminDb, 'privacyNotices', 'cookie1'), { ...notice, kind: 'cookies' });
    cookies.set(doc(adminDb, 'settings', 'public'), { recruitmentPrivacyNoticeId: 'cookie1' }, { merge: true });
    await assertFails(cookies.commit());
    const cookiesOk = writeBatch(adminDb);
    cookiesOk.set(doc(adminDb, 'privacyNotices', 'cookie1'), { ...notice, kind: 'cookies' });
    cookiesOk.set(doc(adminDb, 'settings', 'public'), { cookiePolicyId: 'cookie1' }, { merge: true });
    await assertSucceeds(cookiesOk.commit());
    await assertFails(setDoc(doc(ctx('orgAdmin'), 'settings', 'public'), { termsId: 'cookie1' }, { merge: true }));
    await assertSucceeds(publish('orgAdmin', 'n2'));
    await assertFails(updateDoc(doc(ctx('orgAdmin'), 'privacyNotices', 'n2'), { body: 'z'.repeat(300) }));
    await assertFails(deleteDoc(doc(ctx('orgAdmin'), 'privacyNotices', 'n1')));
    // Yeni sürüm yürürlüğe girince eski sürüme bağlı başvuru reddedilir.
    await openCall();
    await assertFails(setDoc(doc(ctx('candidate'), 'recruitmentApplications', 'c1__candidate'), application()));
    await assertSucceeds(setDoc(doc(ctx('candidate'), 'recruitmentApplications', 'c1__candidate'), { ...application(), privacyNoticeId: 'n2' }));
  });

  it('Hub üyeliği olmayan oturum açık ilana bir kez başvurur; ilgili başkan değerlendirir', async () => {
    await createCall('chair', 'c1');
    await updateDoc(doc(ctx('chair'), 'recruitmentCalls', 'c1'), { status: 'open', updatedAt: serverTimestamp() });
    const application = {
      callId: 'c1', callTitle: 'CS Güz Ekip Alımı', unitId: 'cs', unitName: 'Computer Society',
      uid: 'candidate', name: 'Aday Kişi', email: 'aday@example.com', phone: '', department: 'Bilgisayar Mühendisliği',
      studentNo: '', ieeeMemberNo: '', motivation: 'Komitenin teknik etkinliklerinde sorumluluk almak ve birlikte üretmek istiyorum.',
      availability: 'Haftada dört saat', answers: {}, privacyConsent: true, privacyNoticeId: 'n1', status: 'pending',
      submittedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(ctx('candidate'), 'recruitmentApplications', 'c1__candidate'), application));
    await assertFails(setDoc(doc(ctx('candidate'), 'recruitmentApplications', 'another-id'), application));
    await assertSucceeds(getDoc(doc(ctx('candidate'), 'recruitmentApplications', 'c1__candidate')));
    await assertFails(getDoc(doc(ctx('rasVol'), 'recruitmentApplications', 'c1__candidate')));
    await assertSucceeds(review('chair', 'reviewing'));
  });

  it('kapalı ilana başvuru ve başvuru içeriğini sonradan değiştirme reddedilir', async () => {
    await createCall('chair', 'c1');
    const application = {
      callId: 'c1', callTitle: 'CS Güz Ekip Alımı', unitId: 'cs', unitName: 'Computer Society',
      uid: 'candidate', name: 'Aday Kişi', email: 'aday@example.com', phone: '', department: 'Bilgisayar Mühendisliği',
      studentNo: '', ieeeMemberNo: '', motivation: 'Komitenin teknik etkinliklerinde sorumluluk almak ve birlikte üretmek istiyorum.',
      availability: '', answers: {}, privacyConsent: true, privacyNoticeId: 'n1', status: 'pending', submittedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    await assertFails(setDoc(doc(ctx('candidate'), 'recruitmentApplications', 'c1__candidate'), application));
    await updateDoc(doc(ctx('chair'), 'recruitmentCalls', 'c1'), { status: 'open', updatedAt: serverTimestamp() });
    await setDoc(doc(ctx('candidate'), 'recruitmentApplications', 'c1__candidate'), application);
    await assertFails(updateDoc(doc(ctx('candidate'), 'recruitmentApplications', 'c1__candidate'), { motivation: 'Değiştirildi', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(ctx('candidate'), 'recruitmentApplications', 'c1__candidate'), { status: 'withdrawn', updatedAt: serverTimestamp() }));
  });
});

describe('etkinlikler', () => {
  it('sorumlu dilekçesiz onaylayamaz; aynı birimin onaylı dilekçesiyle onaylar', async () => {
    const db = ctx('coord');
    await assertFails(updateDoc(doc(db, 'events', 'e1'), { status: 'approved', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'events', 'e1'), { status: 'approved', petitionId: 'pRas', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db, 'events', 'e1'), { status: 'approved', petitionId: 'pOk', petitionNo: 'X', updatedAt: serverTimestamp() }));
  });

  it('YK onayı', async () => {
    await assertFails(updateDoc(doc(ctx('csVol'), 'events', 'e1'), { status: 'approved' }));
    await assertSucceeds(updateDoc(doc(ctx('gs'), 'events', 'e1'), { status: 'approved', decisionNote: 'ok', updatedAt: serverTimestamp() }));
  });

  it('katılımcı listesini yalnızca sorumlu ve yöneticiler görür', async () => {
    await assertSucceeds(setDoc(doc(ctx('coord'), 'events', 'e1', 'participants', 'p1'), { name: 'x' }));
    await assertFails(getDocs(collection(ctx('csVol'), 'events', 'e1', 'participants')));
  });

  it('dönemler arası kısıtlama gerekçesini gizler ve engelli katılımcı yazımını kurallarda durdurur', async () => {
    const hash = 'a'.repeat(32);
    const restriction = {
      personName: 'Kişi', email: 'kisi@example.org', emailHash: hash, level: 'blocked', reason: 'Etkinlik güvenliğini ihlal eden somut olay.',
      sourceEventId: 'e1', sourceEventName: 'AI Günü', evidenceLink: '', endsOn: null, reviewOn: null, active: true,
      createdBy: 'gs', createdByName: 'Genel Sekreter', createdAt: serverTimestamp(),
    };
    const coordDb = ctx('coord');
    const denied = writeBatch(coordDb);
    denied.set(doc(coordDb, 'eventRestrictions', 'r-denied'), { ...restriction, createdBy: 'coord' });
    await assertFails(denied.commit());

    const db = ctx('gs');
    const batch = writeBatch(db);
    batch.set(doc(db, 'eventRestrictions', 'r1'), restriction);
    batch.set(doc(db, 'eventRestrictionIndex', hash), { restrictionId: 'r1', level: 'blocked', expiresAt: FAR, updatedAt: serverTimestamp() });
    await assertSucceeds(batch.commit());

    await assertFails(getDoc(doc(ctx('coord'), 'eventRestrictions', 'r1')));
    await assertSucceeds(getDoc(doc(ctx('coord'), 'eventRestrictionIndex', hash)));
    await assertFails(getDocs(collection(ctx('coord'), 'eventRestrictionIndex')));
    await assertFails(setDoc(doc(ctx('coord'), 'events', 'e1', 'participants', hash), { name: 'Kişi', email: 'kisi@example.org' }));
    const lift = writeBatch(db);
    lift.update(doc(db, 'eventRestrictions', 'r1'), { active: false, liftedBy: 'gs', liftedByName: 'Genel Sekreter', liftedAt: serverTimestamp(), liftReason: 'İnceleme tamamlandı.' });
    lift.delete(doc(db, 'eventRestrictionIndex', hash));
    await assertSucceeds(lift.commit());
    await assertSucceeds(setDoc(doc(ctx('coord'), 'events', 'e1', 'participants', hash), { name: 'Kişi', email: 'kisi@example.org' }));
  });

  it('dikkat kaydı katılımı engellemez, süresi dolan engel uygulanmaz', async () => {
    const watchHash = 'b'.repeat(32);
    const expiredHash = 'c'.repeat(32);
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.firestore() as unknown as Firestore;
      await setDoc(doc(db, 'eventRestrictionIndex', watchHash), { restrictionId: 'w1', level: 'watch', expiresAt: FAR, updatedAt: Timestamp.now() });
      await setDoc(doc(db, 'eventRestrictionIndex', expiredHash), { restrictionId: 'x1', level: 'blocked', expiresAt: Timestamp.fromDate(new Date('2020-01-01')), updatedAt: Timestamp.now() });
    });
    await assertSucceeds(setDoc(doc(ctx('coord'), 'events', 'e1', 'participants', watchHash), { name: 'Dikkat' }));
    await assertSucceeds(setDoc(doc(ctx('coord'), 'events', 'e1', 'participants', expiredHash), { name: 'Süresi doldu' }));
  });
});

describe('iletişim', () => {
  it('onaylanmamış etkinliğin tanıtımı takvime alınamaz', async () => {
    await assertFails(updateDoc(doc(ctx('comms'), 'contentRequests', 'c1'), { status: 'scheduled' }));
    await env.withSecurityRulesDisabled(async (c) => {
      await updateDoc(doc(c.firestore() as unknown as Firestore, 'events', 'e1'), { status: 'approved' });
    });
    await assertSucceeds(updateDoc(doc(ctx('comms'), 'contentRequests', 'c1'), { status: 'awaiting_approval' }));
    await assertFails(updateDoc(doc(ctx('comms'), 'contentRequests', 'c1'), { status: 'scheduled' }));
    await assertSucceeds(updateDoc(doc(ctx('chair'), 'contentRequests', 'c1'), { status: 'scheduled', approvedBy: 'chair' }));
  });
});

describe('sponsorluk ve finans', () => {
  it('üye sponsor kilidini tek kayıt olarak sorgular, havuzu listeleyemez', async () => {
    await assertSucceeds(getDoc(doc(ctx('stranger'), 'sponsorLocks', 'acme')));
    await assertFails(getDocs(collection(ctx('stranger'), 'sponsorLocks')));
    await assertFails(getDoc(doc(ctx('stranger'), 'sponsors', 's1')));
  });

  it('sponsor sorumlusu kendi sponsorlarını sorgular; iletişim bilgisi kilitli', async () => {
    await assertSucceeds(getDocs(query(collection(ctx('coord'), 'sponsors'), where('ownerUid', '==', 'coord'))));
    await assertSucceeds(setDoc(doc(ctx('coord'), 'sponsors', 's1', 'private', 'contacts'), { list: [] }));
    await assertFails(getDoc(doc(ctx('sayman'), 'sponsors', 's1', 'private', 'contacts')));
  });

  it('birim yöneticisi yalnızca kendi biriminin bütçesini sorgular', async () => {
    await assertSucceeds(getDocs(query(collection(ctx('chair'), 'budgets'), where('unitId', '==', 'cs'))));
    await assertFails(getDocs(query(collection(ctx('chair'), 'budgets'), where('unitId', '==', 'ras'))));
    await assertSucceeds(getDocs(collection(ctx('sayman'), 'budgets')));
  });
});

describe('devir paketleri', () => {
  it('rolün yeni sahibi önceki devir paketini görür', async () => {
    await assertSucceeds(
      getDocs(query(collection(ctx('chair'), 'handovers'), where('visibleTo', 'array-contains-any', ['uid:chair', 'role:cs__birim-baskani']))),
    );
    await assertFails(getDoc(doc(ctx('csVol'), 'handovers', 'h1')));
  });
});

describe('kurul oylamaları ve karar defteri', () => {
  const PAST = Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));
  const entry = (roleKey: string, boards: string[]) => ({ name: roleKey, roleKey, roleName: roleKey, unitName: 'x', boards });
  const roster = {
    ykBaskan: entry('branch__baskan', ['yk']),
    ykUye: entry('branch__yk-uyesi', ['yk']),
    ykEski: entry('branch__yk-uyesi', ['yk']),
    chair: entry('cs__birim-baskani', ['ik']),
  };
  const newVote = (extra: Record<string, unknown> = {}) => ({
    title: 'Bütçe revizyonu', description: '', scope: 'both', rule: 'majority', isDecree: false, status: 'open',
    closesAt: FAR, roster, recusedUids: ['ykUye'], fullSizes: { yk: 6, ik: 5 }, chairUid: 'ykBaskan', meetingId: null,
    visibleUids: [...Object.keys(roster), 'gs'], createdBy: 'gs', createdByName: 'GS',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
  });
  const ballot = (choice = 'yes') => ({ choice, name: 'x', at: serverTimestamp() });

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.firestore() as unknown as Firestore;
      const people = [['ykBaskan', 'branch__baskan', FAR], ['ykUye', 'branch__yk-uyesi', FAR], ['ykEski', 'branch__yk-uyesi', PAST]] as const;
      for (const [uid, roleKey, until] of people) {
        await setDoc(doc(db, 'members', uid), { uid, status: 'active', displayName: uid, createdAt: Timestamp.now() });
        await setDoc(doc(db, 'access', uid), { ...baseAccess(uid), roleKeys: { [roleKey]: until }, memberOf: { branch: until } });
      }
    });
  });

  it('oylamayı yalnız Genel Sekreter açar; liste görünürlükte olmalı, YKK yalnız YK 2/3 ile açılır', async () => {
    await assertSucceeds(setDoc(doc(ctx('gs'), 'boardVotes', 'v1'), newVote()));
    await assertFails(setDoc(doc(ctx('chair'), 'boardVotes', 'v2'), newVote({ createdBy: 'chair' })));
    await assertFails(setDoc(doc(ctx('gs'), 'boardVotes', 'v3'), newVote({ visibleUids: ['gs'] })));
    await assertFails(setDoc(doc(ctx('gs'), 'boardVotes', 'v4'), newVote({ isDecree: true })));
    await assertSucceeds(setDoc(doc(ctx('gs'), 'boardVotes', 'v5'), newVote({ isDecree: true, scope: 'yk', rule: 'twoThirds' })));
    await assertSucceeds(getDoc(doc(ctx('chair'), 'boardVotes', 'v1')));
    await assertFails(getDoc(doc(ctx('stranger'), 'boardVotes', 'v1')));
  });

  it('herkes yalnız kendi adına, görevi sürerken ve oylama açıkken oy verir', async () => {
    await setDoc(doc(ctx('gs'), 'boardVotes', 'v1'), newVote());
    const b = (uid: string, as = uid) => doc(ctx(as), 'boardVotes', 'v1', 'ballots', uid);
    await assertSucceeds(setDoc(b('ykBaskan'), ballot('yes')));
    await assertSucceeds(setDoc(b('ykBaskan'), ballot('no')));
    await assertSucceeds(setDoc(b('chair'), ballot('abstain')));
    await assertFails(setDoc(b('ykBaskan', 'chair'), ballot('yes')));
    await assertFails(setDoc(b('stranger'), ballot('yes')));
    await assertFails(setDoc(b('ykEski'), ballot('yes')));
    await assertFails(setDoc(b('ykUye'), ballot('yes')));
    await assertFails(setDoc(b('chair'), ballot('maybe')));
    await assertFails(deleteDoc(b('ykBaskan')));
    await assertSucceeds(getDoc(b('ykBaskan', 'chair')));
    await assertFails(getDoc(b('ykBaskan', 'stranger')));
  });

  it('oylama içeriği değişmez; kapandıktan sonra oy verilemez; karar defteri numaralı ve değiştirilemez', async () => {
    await setDoc(doc(ctx('gs'), 'boardVotes', 'v1'), newVote());
    await setDoc(doc(ctx('ykBaskan'), 'boardVotes', 'v1', 'ballots', 'ykBaskan'), ballot('yes'));
    const vRef = doc(ctx('gs'), 'boardVotes', 'v1');
    await assertFails(updateDoc(vRef, { title: 'Değişti', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(vRef, { roster: { gs: entry('x', ['yk']) }, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(ctx('chair'), 'boardVotes', 'v1'), { status: 'closed', closedAt: serverTimestamp(), closedByName: 'x', updatedAt: serverTimestamp() }));
    const result = { outcome: 'accepted', summary: 'Kabul', counts: { yes: 1, no: 0, abstain: 0 } };
    await assertSucceeds(updateDoc(vRef, { status: 'closed', closedAt: serverTimestamp(), closedByName: 'GS', result, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(ctx('chair'), 'boardVotes', 'v1', 'ballots', 'chair'), ballot('yes')));

    const manual = { type: 'manual', id: null, label: 'Elle' };
    const decision = (seq: number, extra: Record<string, unknown> = {}) => ({
      board: 'yk', year: 2026, seq, number: `YK-2026/00${seq}`, counterId: 'yk_2026', kind: 'decision', date: '2026-09-29',
      title: 'Bütçe revizyonu', text: 'Kabul edildi.', result: 'Kabul', source: { type: 'vote', id: 'v1', label: 'Oylama' },
      correctsId: null, visibility: 'board', visibleUids: Object.keys(roster), createdBy: 'gs', createdByName: 'GS', createdAt: serverTimestamp(), ...extra,
    });
    const record = (seq: number, id: string, extra: Record<string, unknown> = {}, linkVote = true) => {
      const db = ctx('gs');
      const batch = writeBatch(db);
      batch.set(doc(db, 'decisionCounters', 'yk_2026'), { value: seq, lastDecisionId: id });
      batch.set(doc(db, 'boardDecisions', id), decision(seq, extra));
      if (linkVote) batch.update(doc(db, 'boardVotes', 'v1'), { decisionId: id, updatedAt: serverTimestamp() });
      return batch.commit();
    };
    await assertFails(record(2, 'd0')); // numara 1 ile başlar
    await assertFails(record(1, 'd0', {}, false)); // oylamaya bağlanmadan işlenemez
    await assertSucceeds(record(1, 'd1'));
    await assertFails(record(2, 'd2')); // aynı oylama ikinci kez işlenemez
    await assertFails(record(3, 'd3', { source: manual }, false)); // numara atlanamaz
    await assertSucceeds(record(2, 'd2', { source: manual, visibility: 'members', visibleUids: [] }, false));
    await assertFails(updateDoc(doc(ctx('gs'), 'boardDecisions', 'd1'), { text: 'Değişti' }));
    await assertFails(deleteDoc(doc(ctx('gs'), 'boardDecisions', 'd1')));
    await assertSucceeds(getDoc(doc(ctx('chair'), 'boardDecisions', 'd1')));
    await assertFails(getDoc(doc(ctx('stranger'), 'boardDecisions', 'd1'))); // kurula özel
    await assertSucceeds(getDoc(doc(ctx('stranger'), 'boardDecisions', 'd2'))); // üyelere açık
    // Kararname (YKK) yalnız kabul edilmiş YKK oylamasından işlenir.
    await assertFails(record(3, 'd3', { kind: 'decree', source: manual }, false));
  });

  it('kurul toplantısını kurul üyesi okur; kurul dışı okuyamaz', async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore() as unknown as Firestore, 'meetings', 'ik1'), {
        unitId: 'branch', unitName: 'İdari Kurul', title: 'İK toplantısı', date: '2026-09-29', status: 'draft',
        attendeeUids: [], attendeeNames: [], agenda: [], decisions: [], boardId: 'ik', visibleUids: ['chair'],
      });
    });
    await assertSucceeds(getDoc(doc(ctx('chair'), 'meetings', 'ik1')));
    await assertFails(getDoc(doc(ctx('stranger'), 'meetings', 'ik1')));
  });
});

describe('oda rezervasyonu', () => {
  // Tarih ve dilimler oda saatidir (UTC+3).
  const day = (offset: number) => new Date(Date.now() + 3 * 3600e3 + offset * 86400e3).toISOString().slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  const slotRef = (uid: string, date: string, slot: number, roomId = 'oda') => doc(ctx(uid), 'roomSlots', `${roomId}_${date}_${pad(slot)}`);
  const slotData = (uid: string, date: string, slot: number, extra: Record<string, unknown> = {}) => ({
    roomId: 'oda', date, slot, groupId: 'g1', unitId: 'cs', unitName: 'Computer Society', kind: 'interview',
    title: 'Mülakat', note: '', byUid: uid, byName: uid, createdAt: serverTimestamp(), ...extra,
  });
  const book = (uid: string, date: string, from: number, to: number, extra: Record<string, unknown> = {}) => {
    const db = ctx(uid);
    const batch = writeBatch(db);
    for (let slot = from; slot < to; slot++) {
      batch.set(doc(db, 'roomSlots', `oda_${date}_${pad(slot)}`), slotData(uid, date, slot, extra));
    }
    return batch.commit();
  };
  const roomData = (uid: string, extra: Record<string, unknown> = {}) => ({
    name: 'Kulüp Odası', location: 'Merkezi Derslik', note: '', openSlot: 16, closeSlot: 44, maxDaysAhead: 60,
    active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: uid, ...extra,
  });

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.firestore() as unknown as Firestore;
      for (const u of ['rasChair', 'csVice']) {
        await setDoc(doc(db, 'members', u), { uid: u, status: 'active', displayName: u, createdAt: Timestamp.now() });
      }
      await setDoc(doc(db, 'access', 'rasChair'), {
        ...baseAccess('rasChair'), unitPerms: { 'ras__unit.manage': FAR, 'ras__unit.room.reserve': FAR }, memberOf: { ras: FAR },
      });
      // Başkan yardımcısı: birimi yönetir ama oda rezervasyonu izni yoktur.
      await setDoc(doc(db, 'access', 'csVice'), { ...baseAccess('csVice'), unitPerms: { 'cs__unit.manage': FAR }, memberOf: { cs: FAR } });
      await setDoc(doc(db, 'rooms', 'oda'), {
        name: 'Kulüp Odası', location: '', note: '', openSlot: 16, closeSlot: 44, maxDaysAhead: 60, active: true,
        createdAt: Timestamp.now(), updatedAt: Timestamp.now(), updatedBy: 'orgAdmin',
      });
      await setDoc(doc(db, 'rooms', 'kapali'), {
        name: 'Kapalı oda', location: '', note: '', openSlot: 16, closeSlot: 44, maxDaysAhead: 60, active: false,
        createdAt: Timestamp.now(), updatedAt: Timestamp.now(), updatedBy: 'orgAdmin',
      });
    });
  });

  it('odayı yalnız organizasyon yöneticisi tanımlar; oda silinmez', async () => {
    await assertSucceeds(setDoc(doc(ctx('orgAdmin'), 'rooms', 'yeni'), roomData('orgAdmin')));
    await assertFails(setDoc(doc(ctx('chair'), 'rooms', 'yeni2'), roomData('chair')));
    await assertFails(setDoc(doc(ctx('orgAdmin'), 'rooms', 'bozuk'), roomData('orgAdmin', { openSlot: 30, closeSlot: 20 })));
    await assertSucceeds(updateDoc(doc(ctx('orgAdmin'), 'rooms', 'yeni'), { active: false, updatedAt: serverTimestamp(), updatedBy: 'orgAdmin' }));
    await assertFails(deleteDoc(doc(ctx('orgAdmin'), 'rooms', 'yeni')));
    await assertSucceeds(getDoc(doc(ctx('csVol'), 'rooms', 'oda')));
  });

  it('yalnız komite başkanı kendi birimi adına rezervasyon yapar', async () => {
    const d = day(2);
    await assertSucceeds(book('chair', d, 20, 24));
    for (const uid of ['csVice', 'coord', 'csVol', 'stranger', 'gs', 'orgAdmin']) {
      await assertFails(book(uid, d, 30, 31));
    }
    await assertFails(book('chair', d, 30, 31, { unitId: 'ras' })); // başka birim adına
    await assertFails(book('chair', d, 30, 31, { byUid: 'rasChair' })); // başkası adına
    await assertFails(book('chair', d, 30, 31, { kind: 'parti' }));
    await assertFails(book('chair', d, 30, 31, { title: '' }));
    await assertSucceeds(getDocs(collection(ctx('csVol'), 'roomSlots'))); // takvimi her aktif üye görür
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore() as unknown as Firestore, 'roomSlots')));
  });

  it('dolu dilim ikinci kez alınamaz; çakışan rezervasyonun hiçbir dilimi yazılmaz', async () => {
    const d = day(2);
    await assertSucceeds(book('chair', d, 20, 24)); // 10:00–12:00
    await assertFails(book('rasChair', d, 22, 26, { unitId: 'ras', groupId: 'g2' })); // 11:00–13:00 çakışır
    const leaked = await getDoc(slotRef('rasChair', d, 24));
    if (leaked.exists()) throw new Error('çakışan rezervasyonun bir dilimi yazıldı');
    await assertFails(book('chair', d, 23, 24, { groupId: 'g3' })); // kendi dilimini de ezemez
    await assertFails(updateDoc(slotRef('chair', d, 20), { title: 'Değişti' }));
    await assertSucceeds(book('rasChair', d, 24, 26, { unitId: 'ras', groupId: 'g2' })); // bitişik aralık serbest
    await assertSucceeds(book('rasChair', day(3), 20, 24, { unitId: 'ras', groupId: 'g4' })); // başka gün serbest
  });

  it('kimlik, saat ve tarih sınırları kurallarda denetlenir', async () => {
    const d = day(2);
    await assertFails(setDoc(doc(ctx('chair'), 'roomSlots', `oda_${d}_21`), slotData('chair', d, 20))); // kimlik ≠ dilim
    await assertFails(setDoc(doc(ctx('chair'), 'roomSlots', 'serbest-kimlik'), slotData('chair', d, 20)));
    await assertFails(book('chair', d, 15, 16)); // açılıştan önce
    await assertFails(book('chair', d, 44, 45)); // kapanıştan sonra
    await assertFails(book('chair', day(-1), 20, 21)); // geçmiş gün
    await assertFails(book('chair', day(61), 20, 21)); // ufkun ötesi
    await assertSucceeds(book('chair', day(59), 20, 21));
    await assertFails(setDoc(doc(ctx('chair'), 'roomSlots', 'oda_2026-13-45_20'), slotData('chair', '2026-13-45', 20)));
    await assertFails(setDoc(slotRef('chair', d, 20, 'kapali'), slotData('chair', d, 20, { roomId: 'kapali' }))); // pasif oda
    await assertFails(setDoc(slotRef('chair', d, 20, 'yok'), slotData('chair', d, 20, { roomId: 'yok' }))); // olmayan oda
    await assertFails(setDoc(slotRef('chair', d, 20), { ...slotData('chair', d, 20), approved: true })); // fazladan alan
  });

  it('tam günlük rezervasyon tek batch ile yazılır', async () => {
    await assertSucceeds(book('chair', day(2), 16, 44)); // 08:00–22:00, 28 dilim
  });

  it('iptal: sahibi, birimin başkanı veya organizasyon yöneticisi; bitmiş dilim geçmişte kalır', async () => {
    const d = day(2);
    await assertSucceeds(book('chair', d, 20, 24));
    await assertFails(deleteDoc(slotRef('rasChair', d, 20)));
    await assertFails(deleteDoc(slotRef('csVice', d, 20)));
    await assertSucceeds(deleteDoc(slotRef('chair', d, 20)));
    await assertSucceeds(deleteDoc(slotRef('orgAdmin', d, 21)));
    await assertSucceeds(book('rasChair', d, 20, 22, { unitId: 'ras', groupId: 'g2' })); // boşalan dilim yeniden alınır

    const past = day(-2);
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.firestore() as unknown as Firestore;
      await setDoc(doc(db, 'roomSlots', `oda_${past}_20`), { ...slotData('chair', past, 20), createdAt: Timestamp.now() });
      // Önceki başkanın gelecekteki rezervasyonu: birimin yeni başkanı iptal edebilir.
      await setDoc(doc(db, 'roomSlots', `oda_${d}_30`), { ...slotData('oldChair', d, 30), createdAt: Timestamp.now() });
    });
    await assertFails(deleteDoc(slotRef('chair', past, 20)));
    await assertSucceeds(deleteDoc(slotRef('orgAdmin', past, 20)));
    await assertSucceeds(deleteDoc(slotRef('chair', d, 30)));
  });
});
