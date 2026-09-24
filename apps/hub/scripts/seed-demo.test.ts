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

  await signOut(auth);
  expect(Object.keys(uid)).toHaveLength(DEMO_ACCOUNTS.length);
});
