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
  collection,
  doc,
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
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const FAR = Timestamp.fromDate(new Date('2100-01-01T00:00:00Z'));
const PAST = Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));

let env: RulesTestEnvironment;

const nowSec = () => Math.floor(Date.now() / 1000);

function ctx(uid: string, authAgoSec = 10): Firestore {
  return env.authenticatedContext(uid, { auth_time: nowSec() - authAgoSec }).firestore() as unknown as Firestore;
}

// Onay zinciri: 1) dilekçenin birimindeki komite başkanı, 2) kol geneli genel sekreter.
const STEPS = [
  { name: 'Komite Başkanı', roleIds: ['chair'], unitMode: 'petition', unitId: null },
  { name: 'Genel Sekreter', roleIds: ['secretary'], unitMode: 'branch', unitId: null },
];

const VISIBLE = ['uid:owner', 'unit:cs', 'role:cs__chair', 'role:branch__secretary'];

async function seed() {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore() as unknown as Firestore;
    const member = (uid: string, status = 'active') =>
      setDoc(doc(db, 'members', uid), { uid, status, displayName: uid, createdAt: Timestamp.now() });
    await member('owner');
    await member('chair');
    await member('secretary');
    await member('admin');
    await member('stranger');
    await member('pendingUser', 'pending');

    const access = (uid: string, extra: Record<string, unknown>) =>
      setDoc(doc(db, 'access', uid), {
        superAdmin: false,
        perms: {},
        roleKeys: {},
        tokens: [`uid:${uid}`],
        ...extra,
      });
    await access('owner', {});
    await access('stranger', {});
    await access('chair', { roleKeys: { cs__chair: FAR }, tokens: ['uid:chair', 'role:cs__chair', 'unit:cs'] });
    await access('secretary', {
      roleKeys: { branch__secretary: FAR },
      tokens: ['uid:secretary', 'role:branch__secretary'],
    });
    await access('admin', { perms: { 'org.manage': FAR, 'assignments.manage': FAR, 'audit.read': PAST } });

    await setDoc(doc(db, 'petitionTemplates', 'etk'), {
      name: 'Etkinlik İzin Dilekçesi',
      scope: 'unit',
      unitIds: [],
      series: 'ETK',
      active: true,
      currentVersion: 1,
    });
    await setDoc(doc(db, 'petitionTemplates', 'etk', 'versions', '1'), {
      version: 1,
      steps: STEPS,
      fields: [],
    });
    await setDoc(doc(db, 'petitions', 'p1'), {
      templateId: 'etk',
      templateVersion: 1,
      templateName: 'Etkinlik İzin Dilekçesi',
      unitId: 'cs',
      unitName: 'CS',
      ownerUid: 'owner',
      ownerName: 'owner',
      title: 'Test',
      data: { konu: 'x' },
      status: 'draft',
      visibleTo: ['uid:owner'],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });
}

function submitBatch(db: Firestore, opts: { seq?: number; steps?: unknown; code?: string } = {}) {
  const year = new Date().getUTCFullYear();
  const seq = opts.seq ?? 1;
  const code = opts.code ?? 'ABCDEFGHJKMN';
  const b = writeBatch(db);
  b.update(doc(db, 'petitions', 'p1'), {
    status: 'pending',
    steps: opts.steps ?? STEPS,
    currentStep: 0,
    counterId: `ETK_${year}`,
    documentSeq: seq,
    documentNo: `IEEEIKCU-${year}-ETK-000${seq}`,
    verificationCode: code,
    revision: 1,
    approvals: [],
    notes: [],
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    visibleTo: VISIBLE,
  });
  b.set(doc(db, 'counters', `ETK_${year}`), { value: seq, lastPetitionId: 'p1' });
  b.set(doc(db, 'petitionVerifications', code), {
    petitionId: 'p1',
    status: 'pending',
    approvals: [],
    documentNo: `IEEEIKCU-${year}-ETK-000${seq}`,
    templateName: 'Etkinlik İzin Dilekçesi',
    revision: 1,
    ownerMasked: 'O*** ',
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return b;
}

function decisionBatch(
  db: Firestore,
  prev: { approvals: unknown[]; notes: unknown[] },
  a: Record<string, unknown>,
  petitionPatch: Record<string, unknown>,
  withNote = false,
) {
  const approval = { ...a, at: Timestamp.now() };
  const approvals = [...prev.approvals, approval];
  const notes = withNote ? [...prev.notes, { approvalIndex: prev.approvals.length, text: 'gerekçe' }] : prev.notes;
  const b = writeBatch(db);
  b.update(doc(db, 'petitions', 'p1'), { approvals, notes, updatedAt: serverTimestamp(), ...petitionPatch });
  b.update(doc(db, 'petitionVerifications', 'ABCDEFGHJKMN'), {
    status: petitionPatch.status,
    approvals,
    updatedAt: serverTimestamp(),
  });
  return b;
}

const chairApproval = {
  step: 0,
  stepName: 'Komite Başkanı',
  revision: 1,
  uid: 'chair',
  name: 'chair',
  roleId: 'chair',
  roleName: 'Komite Başkanı',
  unitId: 'cs',
  unitName: 'CS',
  decision: 'approve',
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ieee-hub',
    firestore: { rules: readFileSync(fileURLToPath(new URL('../firestore.rules', import.meta.url)), 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

describe('kurulum', () => {
  it('sistemde kurulum yoksa ilk kullanıcı kurucu yönetici olur, ikincisi olamaz', async () => {
    await env.clearFirestore();
    const first = ctx('u1');
    const b = writeBatch(first);
    b.set(doc(first, 'members', 'u1'), { uid: 'u1', status: 'active', createdAt: serverTimestamp() });
    b.set(doc(first, 'access', 'u1'), { superAdmin: true, perms: {}, roleKeys: {}, tokens: ['uid:u1'] });
    b.set(doc(first, 'system', 'bootstrap'), { uid: 'u1', at: serverTimestamp() });
    await assertSucceeds(b.commit());

    const second = ctx('u2');
    const b2 = writeBatch(second);
    b2.set(doc(second, 'members', 'u2'), { uid: 'u2', status: 'active', createdAt: serverTimestamp() });
    b2.set(doc(second, 'access', 'u2'), { superAdmin: true, perms: {}, roleKeys: {}, tokens: ['uid:u2'] });
    await assertFails(b2.commit());
  });

  it('yeni kayıt yalnızca onay bekleyen olarak oluşturulabilir', async () => {
    const db = ctx('newbie');
    await assertFails(setDoc(doc(db, 'members', 'newbie'), { uid: 'newbie', status: 'active', createdAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(db, 'members', 'newbie'), { uid: 'newbie', status: 'pending', createdAt: serverTimestamp() }));
  });
});

describe('organizasyon ve yetki', () => {
  it('onay bekleyen üye organizasyon verisini okuyamaz', async () => {
    await assertFails(getDocs(collection(ctx('pendingUser'), 'units')));
    await assertSucceeds(getDocs(collection(ctx('owner'), 'units')));
  });

  it('birim yazmak org.manage ister', async () => {
    await assertFails(setDoc(doc(ctx('owner'), 'units', 'cs'), { name: 'CS' }));
    await assertSucceeds(setDoc(doc(ctx('admin'), 'units', 'cs'), { name: 'CS' }));
  });

  it('süresi dolmuş izin geçersizdir', async () => {
    await assertFails(getDocs(collection(ctx('admin'), 'auditLog')));
  });

  it('atama yöneticisi kendini kurucu yönetici yapamaz', async () => {
    const db = ctx('admin');
    await assertFails(updateDoc(doc(db, 'access', 'admin'), { superAdmin: true }));
    await assertSucceeds(
      updateDoc(doc(db, 'access', 'owner'), { perms: { 'templates.manage': FAR } }),
    );
  });
});

describe('dilekçe gönderimi', () => {
  it('sahibi sayaç ve doğrulama kaydıyla birlikte gönderir', async () => {
    await assertSucceeds(submitBatch(ctx('owner')).commit());
  });

  it('sayaç atlanamaz', async () => {
    await assertFails(submitBatch(ctx('owner'), { seq: 5 }).commit());
  });

  it('onay zinciri değiştirilerek gönderilemez', async () => {
    await assertFails(submitBatch(ctx('owner'), { steps: [STEPS[1]] }).commit());
  });

  it('başkası gönderemez', async () => {
    await assertFails(submitBatch(ctx('stranger')).commit());
  });
});

describe('okuma ve sorgular', () => {
  beforeEach(async () => {
    await submitBatch(ctx('owner')).commit();
  });

  it('sahibi kendi dilekçelerini sorgular', async () => {
    const db = ctx('owner');
    await assertSucceeds(getDocs(query(collection(db, 'petitions'), where('ownerUid', '==', 'owner'))));
  });

  it('onaycı visibleTo üzerinden sorgular', async () => {
    const db = ctx('chair');
    const snap = await assertSucceeds(
      getDocs(
        query(
          collection(db, 'petitions'),
          where('visibleTo', 'array-contains-any', ['uid:chair', 'role:cs__chair', 'unit:cs']),
          where('status', '==', 'pending'),
        ),
      ),
    );
    expect(snap.size).toBe(1);
  });

  it('ilgisiz üye okuyamaz', async () => {
    await assertFails(getDoc(doc(ctx('stranger'), 'petitions', 'p1')));
    await assertFails(
      getDocs(query(collection(ctx('stranger'), 'petitions'), where('visibleTo', 'array-contains-any', ['role:cs__chair']))),
    );
  });

  it('doğrulama kaydı herkese açık ama listelenemez', async () => {
    const anon = env.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertSucceeds(getDoc(doc(anon, 'petitionVerifications', 'ABCDEFGHJKMN')));
    await assertFails(getDocs(collection(anon, 'petitionVerifications')));
  });
});

describe('onay akışı', () => {
  beforeEach(async () => {
    await submitBatch(ctx('owner')).commit();
  });

  it('doğru rol ilk adımı onaylar', async () => {
    const b = decisionBatch(ctx('chair'), { approvals: [], notes: [] }, chairApproval, {
      status: 'pending',
      currentStep: 1,
    });
    await assertSucceeds(b.commit());
  });

  it('yanlış rol onaylayamaz', async () => {
    const b = decisionBatch(
      ctx('secretary'),
      { approvals: [], notes: [] },
      { ...chairApproval, uid: 'secretary', roleId: 'secretary', unitId: 'branch' },
      { status: 'pending', currentStep: 1 },
    );
    await assertFails(b.commit());
  });

  it('rolü olmayan kişi rol iddia edemez', async () => {
    const b = decisionBatch(ctx('stranger'), { approvals: [], notes: [] }, { ...chairApproval, uid: 'stranger' }, {
      status: 'pending',
      currentStep: 1,
    });
    await assertFails(b.commit());
  });

  it('eski oturumla onay verilemez', async () => {
    const b = decisionBatch(ctx('chair', 3600), { approvals: [], notes: [] }, chairApproval, {
      status: 'pending',
      currentStep: 1,
    });
    await assertFails(b.commit());
  });

  it('doğrulama kaydı dilekçeyle uyuşmazsa işlem reddedilir', async () => {
    const db = ctx('chair');
    const approvals = [{ ...chairApproval, at: Timestamp.now() }];
    const b = writeBatch(db);
    b.update(doc(db, 'petitions', 'p1'), { approvals, notes: [], status: 'pending', currentStep: 1, updatedAt: serverTimestamp() });
    b.update(doc(db, 'petitionVerifications', 'ABCDEFGHJKMN'), { status: 'approved', approvals, updatedAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('iki adım sonunda onaylanır; ret gerekçe ister', async () => {
    await decisionBatch(ctx('chair'), { approvals: [], notes: [] }, chairApproval, {
      status: 'pending',
      currentStep: 1,
    }).commit();

    let prev = { approvals: [] as unknown[], notes: [] as unknown[] };
    await env.withSecurityRulesDisabled(async (c) => {
      const snap = await getDoc(doc(c.firestore() as unknown as Firestore, 'petitions', 'p1'));
      prev = snap.data() as typeof prev;
    });
    const secApproval = {
      ...chairApproval,
      step: 1,
      stepName: 'Genel Sekreter',
      uid: 'secretary',
      roleId: 'secretary',
      unitId: 'branch',
      unitName: 'Kol Geneli',
    };

    await assertFails(
      decisionBatch(ctx('secretary'), prev, { ...secApproval, decision: 'reject' }, {
        status: 'rejected',
        completedAt: serverTimestamp(),
      }).commit(),
    );

    // Ret, gerekçeyle birlikte kabul edilir; burada yalnızca kuralın gerekçesiz reddi engellediği
    // doğrulandı. Onay yolu ayrıca test edilir.
    await assertSucceeds(
      decisionBatch(ctx('secretary'), prev, secApproval, {
        status: 'approved',
        completedAt: serverTimestamp(),
      }).commit(),
    );
  });

  it('gerekçeli iade kabul edilir, dilekçe sahibi düzeltip aynı numarayla yeniden gönderir', async () => {
    const ret = { ...chairApproval, decision: 'return' };
    await assertSucceeds(
      decisionBatch(ctx('chair'), { approvals: [], notes: [] }, ret, { status: 'returned' }, true).commit(),
    );
    const db = ctx('owner');
    const b = writeBatch(db);
    b.update(doc(db, 'petitions', 'p1'), {
      status: 'pending',
      currentStep: 0,
      revision: 2,
      data: { konu: 'düzeltildi' },
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      steps: STEPS,
      visibleTo: VISIBLE,
    });
    let approvals: unknown[] = [];
    await env.withSecurityRulesDisabled(async (c) => {
      const snap = await getDoc(doc(c.firestore() as unknown as Firestore, 'petitions', 'p1'));
      approvals = (snap.data() as { approvals: unknown[] }).approvals;
    });
    b.update(doc(db, 'petitionVerifications', 'ABCDEFGHJKMN'), {
      status: 'pending',
      revision: 2,
      approvals,
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(b.commit());
  });

  it('dilekçe sahibi kendi dilekçesini onaylayamaz', async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.firestore() as unknown as Firestore;
      await updateDoc(doc(db, 'access', 'owner'), { roleKeys: { cs__chair: FAR } });
    });
    const b = decisionBatch(ctx('owner'), { approvals: [], notes: [] }, { ...chairApproval, uid: 'owner' }, {
      status: 'pending',
      currentStep: 1,
    });
    await assertFails(b.commit());
  });
});
