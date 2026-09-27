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
    for (const u of ['chair', 'csVol', 'rasVol', 'stranger', 'gs', 'sponsorMgr', 'sayman', 'comms', 'newbie', 'coord', 'techops']) {
      await setDoc(doc(db, 'members', u), { uid: u, status: 'active', displayName: u, createdAt: Timestamp.now() });
    }
    await setDoc(doc(db, 'settings', 'org'), { volunteerRoleId: 'gonullu' });
    await setDoc(doc(db, 'access', 'chair'), {
      ...baseAccess('chair'),
      roleKeys: { 'cs__birim-baskani': FAR },
      tokens: ['uid:chair', 'role:cs__birim-baskani', 'unit:cs'],
      unitPerms: { 'cs__unit.manage': FAR, 'cs__unit.tasks.manage': FAR, 'cs__unit.events.propose': FAR },
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
      perms: { 'work.manageAll': FAR, 'events.approve': FAR, 'events.manageAll': FAR },
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
    createdBy: 'chair', createdByName: 'chair', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });

  it('birim yöneticisi taslak açar; yalnız yayımlanmış ilan anonim vitrinde görünür', async () => {
    await assertSucceeds(setDoc(doc(ctx('chair'), 'recruitmentCalls', 'c1'), call()));
    const publicDb = env.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(getDoc(doc(publicDb, 'recruitmentCalls', 'c1')));
    await assertSucceeds(updateDoc(doc(ctx('chair'), 'recruitmentCalls', 'c1'), { status: 'open', updatedAt: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(publicDb, 'recruitmentCalls', 'c1')));
    await assertSucceeds(getDocs(query(collection(publicDb, 'recruitmentCalls'), where('status', '==', 'open'))));
    await assertFails(setDoc(doc(ctx('rasVol'), 'recruitmentCalls', 'bad'), { ...call(), createdBy: 'rasVol', createdByName: 'rasVol' }));
  });

  it('Hub üyeliği olmayan oturum açık ilana bir kez başvurur; ilgili başkan değerlendirir', async () => {
    await setDoc(doc(ctx('chair'), 'recruitmentCalls', 'c1'), call());
    await updateDoc(doc(ctx('chair'), 'recruitmentCalls', 'c1'), { status: 'open', updatedAt: serverTimestamp() });
    const application = {
      callId: 'c1', callTitle: 'CS Güz Ekip Alımı', unitId: 'cs', unitName: 'Computer Society',
      uid: 'candidate', name: 'Aday Kişi', email: 'aday@example.com', phone: '', department: 'Bilgisayar Mühendisliği',
      studentNo: '', ieeeMemberNo: '', motivation: 'Komitenin teknik etkinliklerinde sorumluluk almak ve birlikte üretmek istiyorum.',
      availability: 'Haftada dört saat', answers: {}, privacyConsent: true, status: 'pending',
      submittedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(ctx('candidate'), 'recruitmentApplications', 'c1__candidate'), application));
    await assertFails(setDoc(doc(ctx('candidate'), 'recruitmentApplications', 'another-id'), application));
    await assertSucceeds(getDoc(doc(ctx('candidate'), 'recruitmentApplications', 'c1__candidate')));
    await assertFails(getDoc(doc(ctx('rasVol'), 'recruitmentApplications', 'c1__candidate')));
    await assertSucceeds(updateDoc(doc(ctx('chair'), 'recruitmentApplications', 'c1__candidate'), {
      status: 'reviewing', reviewedBy: 'chair', reviewedByName: 'chair', reviewedAt: serverTimestamp(),
      decisionNote: 'Görüşmeye çağrılacak', updatedAt: serverTimestamp(),
    }));
  });

  it('kapalı ilana başvuru ve başvuru içeriğini sonradan değiştirme reddedilir', async () => {
    await setDoc(doc(ctx('chair'), 'recruitmentCalls', 'c1'), call());
    const application = {
      callId: 'c1', callTitle: 'CS Güz Ekip Alımı', unitId: 'cs', unitName: 'Computer Society',
      uid: 'candidate', name: 'Aday Kişi', email: 'aday@example.com', phone: '', department: 'Bilgisayar Mühendisliği',
      studentNo: '', ieeeMemberNo: '', motivation: 'Komitenin teknik etkinliklerinde sorumluluk almak ve birlikte üretmek istiyorum.',
      availability: '', answers: {}, privacyConsent: true, status: 'pending', submittedAt: serverTimestamp(), updatedAt: serverTimestamp(),
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
