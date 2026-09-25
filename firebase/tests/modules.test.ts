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
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
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
    for (const u of ['chair', 'csVol', 'rasVol', 'stranger', 'gs', 'sponsorMgr', 'sayman', 'comms', 'newbie', 'coord']) {
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
      unitPerms: { 'cs__unit.tasks.manage': FAR, 'cs__unit.events.propose': FAR },
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
