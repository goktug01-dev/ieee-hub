/**
 * Demo verisi üretir (emülatör). Çıktı firebase/demo-data klasörüne dışa aktarılır ve
 * `npm run emulators` her açılışta bu veriyle başlar.
 *
 * Yeniden üretmek için (kök dizinde): npm run demo:rebuild
 */
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { Timestamp, addDoc, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { expect, it } from 'vitest';
import { auth, db } from '../src/firebase';
import { createAssignments } from '../src/lib/assignments';
import { approveEventWithPetition, createTask, importParticipants, previewParticipantsCsv, proposeEvent, updateEvent } from '../src/lib/ops';
import { createDraft, decidePetition, submitPetition } from '../src/lib/petitions';
import { claimFounder, markSetupDone, seedOrganization } from '../src/lib/setup';
import type { PetitionTemplate } from '../src/lib/types';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../src/lib/demo';

const uid: Record<string, string> = {};

async function as(key: string) {
  await signOut(auth);
  await signInWithEmailAndPassword(auth, DEMO_ACCOUNTS.find((a) => a.key === key)!.email, DEMO_PASSWORD);
}

async function template(id: string) {
  const s = await getDoc(doc(db, 'petitionTemplates', id));
  return { id, ...(s.data() as PetitionTemplate) };
}

it('demo verisi', async () => {
  // Hesaplar
  for (const a of DEMO_ACCOUNTS) {
    await signOut(auth);
    const c = await createUserWithEmailAndPassword(auth, a.email, DEMO_PASSWORD);
    await updateProfile(c.user, { displayName: a.name });
    uid[a.key] = c.user.uid;
    if (a.key === 'baskan') {
      await claimFounder(a.name);
    } else {
      await setDoc(doc(db, 'members', c.user.uid), {
        uid: c.user.uid,
        displayName: a.name,
        email: a.email,
        photoURL: null,
        status: 'pending',
        department: a.department ?? '',
        studentNo: a.studentNo ?? '',
        createdAt: serverTimestamp(),
      });
    }
  }

  // Kurulum
  await as('baskan');
  await seedOrganization(
    {
      orgName: 'IEEE İzmir Kâtip Çelebi Üniversitesi Öğrenci Kolu',
      orgShortName: 'IEEE İKÇÜ',
      founderRoleId: 'baskan',
      includeSampleUnits: true,
      includeSampleTemplates: true,
    },
    () => undefined,
  );
  await markSetupDone();

  // Üye onayı (biri onay bekler durumda kalır)
  for (const a of DEMO_ACCOUNTS) {
    if (a.key !== 'baskan' && a.key !== 'yeni') await updateDoc(doc(db, 'members', uid[a.key]), { status: 'active' });
  }

  // Görevler
  const term = (await getDoc(doc(db, 'settings', 'org'))).data()!.activeTermId as string;
  const termDoc = (await getDoc(doc(db, 'terms', term))).data()!;
  const base = { termId: term, startsAt: termDoc.startsAt as Timestamp, endsAt: termDoc.endsAt as Timestamp };
  await createAssignments(
    DEMO_ACCOUNTS.filter((a) => a.roleId && a.key !== 'baskan').map((a) => ({
      uid: uid[a.key],
      memberName: a.name,
      roleId: a.roleId!,
      roleName: a.roleName!,
      unitId: a.unitId!,
      unitName: a.unitName!,
      ...base,
    })),
  );

  // Dilekçeler: biri tamamen onaylı, biri GS'de bekliyor, biri iade edilmiş, biri taslak
  await as('uye');
  const etk = await template('etkinlik-izin');
  const d1 = { etkinlik_adi: 'Yapay Zekâ Günü', etkinlik_tarihi: '2026-10-15', etkinlik_yeri: 'Mühendislik Fakültesi A Blok Konferans Salonu', aciklama: 'Sektörden iki konuşmacının katılacağı yarım günlük etkinlik. Tahmini katılımcı sayısı 120.' };
  const p1 = await createDraft({ template: etk, unitId: 'cs', unitName: 'Computer Society', title: 'Yapay Zekâ Günü etkinlik izni', data: d1 });
  await submitPetition(p1, d1, 'Yapay Zekâ Günü etkinlik izni');

  const d2 = { etkinlik_adi: 'Arduino Atölyesi', etkinlik_tarihi: '2026-11-05', etkinlik_yeri: 'Elektronik Laboratuvarı', aciklama: '20 kişilik uygulamalı atölye.' };
  const p2 = await createDraft({ template: etk, unitId: 'cs', unitName: 'Computer Society', title: 'Arduino Atölyesi izni', data: d2 });
  await submitPetition(p2, d2, 'Arduino Atölyesi izni');

  const d3 = { etkinlik_adi: 'Kariyer Sohbetleri', etkinlik_tarihi: '2026-10-20', etkinlik_yeri: 'Kütüphane', aciklama: 'Mezunlarla sohbet.' };
  const p3 = await createDraft({ template: etk, unitId: 'cs', unitName: 'Computer Society', title: 'Kariyer Sohbetleri izni', data: d3 });
  await submitPetition(p3, d3, 'Kariyer Sohbetleri izni');

  const gen = await template('genel-dilekce');
  await createDraft({ template: gen, unitId: 'branch', unitName: 'Kol Geneli', title: 'Oda tahsisi talebi (taslak)', data: { konu: 'Kulüp odası tahsisi', dilekce_metni: '' } });

  await as('cs');
  await decidePetition({ petitionId: p1, decision: 'approve', roleId: 'birim-baskani', roleName: 'Başkan', unitName: 'Computer Society', comment: 'Uygundur.' });
  await decidePetition({ petitionId: p2, decision: 'approve', roleId: 'birim-baskani', roleName: 'Başkan', unitName: 'Computer Society', comment: '' });
  await decidePetition({ petitionId: p3, decision: 'return', roleId: 'birim-baskani', roleName: 'Başkan', unitName: 'Computer Society', comment: 'Etkinlik saatini ve salon rezervasyon bilgisini ekleyin.' });

  await as('gs');
  await decidePetition({ petitionId: p1, decision: 'approve', roleId: 'genel-sekreter', roleName: 'Genel Sekreter', unitName: 'Kol Geneli', comment: '' });
  await as('baskan');
  await decidePetition({ petitionId: p1, decision: 'approve', roleId: 'baskan', roleName: 'Öğrenci Kolu Başkanı', unitName: 'Kol Geneli', comment: '' });

  // Seçim kaydı (sonuçlandı, görevlere işlenmedi)
  await addDoc(collection(db, 'elections'), {
    title: 'RAS Komite Başkanlığı Seçimi',
    termId: term,
    date: Timestamp.fromDate(new Date('2026-10-01')),
    description: 'Komite genel toplantısında el kaldırarak yapıldı.',
    status: 'completed',
    positions: [
      {
        key: '1',
        roleId: 'birim-baskani',
        unitId: 'ras',
        candidates: [
          { uid: uid.uye, name: DEMO_ACCOUNTS.find((a) => a.key === 'uye')!.name, votes: 14 },
          { uid: uid.gonullu, name: DEMO_ACCOUNTS.find((a) => a.key === 'gonullu')!.name, votes: 9 },
        ],
        winnerUid: uid.uye,
      },
    ],
    eligibleVoters: 30,
    totalVotes: 23,
    createdBy: uid.baskan,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    appliedAt: null,
  });

  // ---------- Operasyon modülleri ----------
  const day = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const name = (k: string) => DEMO_ACCOUNTS.find((a) => a.key === k)!.name;

  // Etkinlikler: koordinasyon üyesi önerir; biri onaylı dilekçeyle onaylanır, biri YK onayı bekler.
  await as('uye');
  const ai = await proposeEvent({
    name: 'Yapay Zekâ Günü',
    unitId: 'cs',
    unitName: 'Computer Society',
    type: 'Seminer / konferans',
    description: 'Sektörden iki konuşmacıyla yarım günlük etkinlik.',
    startsAt: '2026-10-15 14:00:00',
    endsAt: '2026-10-15 18:00:00',
    location: 'Mühendislik Fakültesi A Blok Konferans Salonu',
    expectedParticipants: 120,
    ownerUids: [uid.uye],
    ownerNames: [name('uye')],
  });
  const p1Doc = (await getDoc(doc(db, 'petitions', p1))).data()!;
  await approveEventWithPetition(ai, p1, p1Doc.documentNo as string);
  await updateEvent(ai, { status: 'planning', budgetPlanned: 4500 });

  await proposeEvent({
    name: 'Arduino Atölyesi',
    unitId: 'cs',
    unitName: 'Computer Society',
    type: 'Atölye',
    description: '20 kişilik uygulamalı atölye.',
    startsAt: '2026-11-05 13:00:00',
    endsAt: '2026-11-05 17:00:00',
    location: 'Elektronik Laboratuvarı',
    expectedParticipants: 20,
    ownerUids: [uid.uye],
    ownerNames: [name('uye')],
  });

  const spring = await proposeEvent({
    name: 'Bahar Kariyer Günü',
    unitId: 'cs',
    unitName: 'Computer Society',
    type: 'Kariyer',
    description: 'Mezun ve sektör buluşması.',
    startsAt: '2026-05-10 13:00:00',
    endsAt: '2026-05-10 17:00:00',
    location: 'Kültür Merkezi',
    expectedParticipants: 80,
    ownerUids: [uid.uye],
    ownerNames: [name('uye')],
  });
  await as('gs');
  const { decideEvent } = await import('../src/lib/ops');
  await decideEvent(spring, true, 'YK 2026/03 kararı');
  await as('uye');
  for (const st of ['planning', 'registration_open', 'held', 'closing'] as const) await updateEvent(spring, { status: st });
  const csv = 'Ad Soyad;E-posta;Katıldı;Sertifika\nAhmet Yıldız;ahmet@example.com;Evet;HC-001\nSelin Aksoy;selin@example.com;Evet;HC-002\nBurak Tan;burak@example.com;Hayır;\n';
  await importParticipants(spring, 'heptacert_bahar.csv', previewParticipantsCsv(csv));
  await updateEvent(spring, {
    checklist: { dataTransferred: true, tasksClosed: true, filesArchived: false, budgetEntered: false },
    report: { participantCount: 74, summary: '6 firma ve 11 mezun katıldı.', outcomes: '3 staj görüşmesi', lessons: 'Kayıt formu daha erken açılmalı.' },
  });

  // Görevler ve proje (CS başkanı)
  await as('cs');
  await addDoc(collection(db, 'projects'), {
    name: 'Yapay Zekâ Günü organizasyonu',
    unitId: 'cs',
    unitName: 'Computer Society',
    ownerUid: uid.uye,
    ownerName: name('uye'),
    goal: '120 katılımcılı, iki konuşmacılı etkinliği sorunsuz gerçekleştirmek.',
    status: 'active',
    startDate: day(-10),
    endDate: '2026-10-20',
    fileLink: '',
    closingNote: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const base2 = {
    description: '',
    unitId: 'cs',
    unitName: 'Computer Society',
    projectId: null,
    eventId: ai,
    supporterUids: [] as string[],
    supporterNames: [] as string[],
    startDate: day(-7),
    fileLink: '',
  };
  await createTask({ ...base2, title: 'Konuşmacılarla iletişim', assigneeUid: uid.uye, assigneeName: name('uye'), dueDate: day(-2), priority: 'high', status: 'in_progress', doneCriteria: 'İki konuşmacı yazılı onay verdi' }, 'CS');
  await createTask({ ...base2, title: 'Salon rezervasyonu', assigneeUid: uid.uye, assigneeName: name('uye'), dueDate: day(2), priority: 'urgent', status: 'todo', doneCriteria: 'Rezervasyon onay e-postası alındı' }, 'CS');
  await createTask({ ...base2, title: 'Afiş tasarımı', assigneeUid: uid.cs, assigneeName: name('cs'), supporterUids: [uid.uye], supporterNames: [name('uye')], dueDate: day(6), priority: 'normal', status: 'todo', doneCriteria: 'Afiş İletişim birimine teslim edildi' }, 'CS');
  await createTask({ ...base2, eventId: null, title: 'Dönem planını hazırla', assigneeUid: uid.cs, assigneeName: name('cs'), dueDate: day(-12), priority: 'normal', status: 'done', doneCriteria: 'Plan YK ile paylaşıldı' }, 'CS');

  // İletişim talebi
  await as('uye');
  const cr = await addDoc(collection(db, 'contentRequests'), {
    requestingUnitId: 'cs',
    requestingUnitName: 'Computer Society',
    requestedBy: uid.uye,
    requestedByName: name('uye'),
    type: 'event_promo',
    channels: ['Instagram', 'LinkedIn'],
    desiredPublishDate: day(5),
    brief: 'Yapay Zekâ Günü duyurusu: konuşmacılar, tarih, kayıt bağlantısı.',
    assets: '',
    eventId: ai,
    eventName: 'Yapay Zekâ Günü',
    draftText: '',
    assigneeUid: null,
    assigneeName: null,
    status: 'requested',
    scheduledDate: null,
    publishedLink: '',
    performance: { reach: null, engagement: null },
    rejectReason: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await as('baskan');
  await updateDoc(cr, { status: 'in_production', draftText: 'Yapay zekâ dünyasının iki ismi İKÇÜ’de! 15 Ekim, A Blok.', scheduledDate: day(5), updatedAt: serverTimestamp() });
  await updateDoc(cr, { status: 'awaiting_approval', updatedAt: serverTimestamp() });

  // Sponsorluk ve bütçe
  const sp = doc(collection(db, 'sponsors'));
  await setDoc(sp, {
    companyName: 'Ege Yazılım A.Ş.', lockKey: 'ege-yazilim-a-s', sector: 'Yazılım', website: 'egeyazilim.example', stage: 'negotiating',
    ownerUid: uid.uye, ownerName: name('uye'), nextActionDate: day(3), nextAction: 'Teklif revizyonunu gönder', proposalLinks: '', eventIds: [ai], amount: 3000, notes: '',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'sponsorLocks', 'ege-yazilim-a-s'), { companyName: 'Ege Yazılım A.Ş.', ownerUid: uid.uye, ownerName: name('uye'), sponsorId: sp.id });
  await addDoc(collection(db, 'sponsors', sp.id, 'interactions'), { date: day(-4), channel: 'Çevrim içi toplantı', summary: 'Etkinlik sponsorluğu paketleri konuşuldu.', nextAction: 'Teklif revizyonu', byUid: uid.baskan, byName: name('baskan'), at: serverTimestamp() });
  const sp2 = doc(collection(db, 'sponsors'));
  await setDoc(sp2, {
    companyName: 'İzmir Robotik', lockKey: 'izmir-robotik', sector: 'Robotik', website: '', stage: 'contacted',
    ownerUid: uid.sayman, ownerName: name('sayman'), nextActionDate: null, nextAction: '', proposalLinks: '', eventIds: [], amount: null, notes: '',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'sponsorLocks', 'izmir-robotik'), { companyName: 'İzmir Robotik', ownerUid: uid.sayman, ownerName: name('sayman'), sponsorId: sp2.id });
  await addDoc(collection(db, 'budgets'), {
    title: 'Yapay Zekâ Günü bütçesi', scope: 'event', unitId: 'cs', unitName: 'Computer Society', eventId: ai, termId: term,
    lines: [{ label: 'İkram', planned: 2500, actual: 0 }, { label: 'Baskı ve afiş', planned: 800, actual: 650 }, { label: 'Konuşmacı ulaşım', planned: 1200, actual: 0 }],
    plannedTotal: 4500, actualTotal: 650, sheetLink: '', docsLink: '', status: 'approved', updatedAt: serverTimestamp(),
  });

  // Envanter
  const inv = (kind: string, title: string, fields: Record<string, string>) =>
    addDoc(collection(db, 'inventory'), { kind, title, fields, updatedAt: serverTimestamp(), updatedByName: name('baskan') });
  await inv('system', 'Firebase (Hub)', { purpose: 'Hub kimlik ve veritabanı', ownerAccount: 'ieeetechops@…', admins: 'Ayşe Yılmaz, Mehmet Demir', criticality: 'Kritik', recovery: 'İki yönetici; kurallar ve şablonlar depoda' });
  await inv('system', 'WordPress sitesi', { purpose: 'Kurumsal web sitesi ve üyelik', ownerAccount: 'IEEE Global Webmaster', admins: 'Zeynep Kaya', criticality: 'Kritik', recovery: 'Yedekleme eklentisi' });
  await inv('risk', 'Tek yöneticili kritik sistemler', { likelihood: 'Orta', impact: 'Yüksek', owner: 'TechOps Başkanı', status: 'Önlem alınıyor', mitigation: 'Her sisteme ikinci yönetici' });

  // Gönüllü başvurusu (RAS gönüllüsü CS'ye de başvuruyor) ve devir paketi taslağı
  await as('gonullu');
  await addDoc(collection(db, 'volunteerApplications'), {
    uid: uid.gonullu, name: name('gonullu'), email: 'gonullu@demo.ieee', unitId: 'cs', unitName: 'Computer Society',
    motivation: 'Web geliştirme ve etkinlik organizasyonunda deneyim kazanmak istiyorum; RAS’taki atölye tecrübemi paylaşabilirim.',
    availability: 'Haftada 4 saat', status: 'pending', createdAt: serverTimestamp(),
  });
  await as('cs');
  await addDoc(collection(db, 'handovers'), {
    authorUid: uid.cs, authorName: name('cs'), roleId: 'birim-baskani', roleName: 'Başkan', unitId: 'cs', unitName: 'Computer Society', termId: term,
    sections: { ongoing: 'Yapay Zekâ Günü (EVT) planlamada; Arduino atölyesi YK onayında.', lessons: 'Salon rezervasyonunu en az 3 hafta önce yapın.' },
    status: 'draft', visibleTo: [`uid:${uid.cs}`, 'role:cs__birim-baskani'], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });

  await signOut(auth);
  expect(Object.keys(uid)).toHaveLength(DEMO_ACCOUNTS.length);
});
