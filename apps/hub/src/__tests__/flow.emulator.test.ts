/**
 * Uçtan uca akış: gerçek istemci kodu + gerçek güvenlik kuralları (Firebase Emulator).
 * Çalıştırma: npm run test:e2e (kök dizinde)
 */
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import PizZip from 'pizzip';
import { beforeAll, describe, expect, it } from 'vitest';
import { auth, db } from '../firebase';
import { createAssignments } from '../lib/assignments';
import {
  createDraft,
  decidePetition,
  renderPetitionDocx,
  resubmitPetition,
  submitPetition,
  withdrawPetition,
} from '../lib/petitions';
import { claimFounder, markSetupDone, seedOrganization } from '../lib/setup';
import type { Access, Assignment, Petition, PetitionTemplate, PetitionVerification } from '../lib/types';

const PROJECT = 'demo-ieee-hub';
const PW = 'secret123';
const run = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

const uids: Record<string, string> = {};

async function register(key: string, name: string) {
  await signOut(auth);
  const c = await createUserWithEmailAndPassword(auth, `${key}@ogr.ikc.edu.tr`, PW);
  await updateProfile(c.user, { displayName: name });
  uids[key] = c.user.uid;
  return c.user.uid;
}

async function as(key: string) {
  await signOut(auth);
  await signInWithEmailAndPassword(auth, `${key}@ogr.ikc.edu.tr`, PW);
}

async function applyForMembership(key: string, name: string) {
  const uid = await register(key, name);
  await setDoc(doc(db, 'members', uid), {
    uid,
    displayName: name,
    email: `${key}@ogr.ikc.edu.tr`,
    photoURL: null,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

async function template(id: string) {
  const s = await getDoc(doc(db, 'petitionTemplates', id));
  return { id, ...(s.data() as PetitionTemplate) };
}

run('uçtan uca dilekçe akışı', () => {
  beforeAll(async () => {
    await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
    await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  });

  it('kurulum: kurucu yönetici, roller, birimler, örnek şablonlar', async () => {
    await register('baskan', 'Ayşe Başkan');
    await claimFounder('Ayşe Başkan');
    await seedOrganization(
      {
        orgName: 'IEEE İKÇÜ Öğrenci Kolu',
        orgShortName: 'IEEE İKÇÜ',
        founderRoleId: 'baskan',
        includeSampleUnits: true,
        includeSampleTemplates: true,
      },
      () => undefined,
    );
    await markSetupDone();
    const t = await template('etkinlik-izin');
    expect(t.currentVersion).toBe(1);
    expect(t.active).toBe(true);
  });

  it('ikinci kişi kurucu olamaz; başvurular onay bekler', async () => {
    await applyForMembership('gs', 'Mehmet Sekreter');
    await expect(claimFounder('Mehmet Sekreter')).rejects.toThrow();
    await applyForMembership('cs', 'Zeynep CS Başkanı');
    await applyForMembership('uye', 'Can Üye');
    // Onaylanmamış üye organizasyon verisini okuyamaz
    await expect(getDocs(collection(db, 'units'))).rejects.toThrow();
  });

  it('yönetici üyeleri onaylar ve görev atar', async () => {
    await as('baskan');
    for (const k of ['gs', 'cs', 'uye']) await updateDoc(doc(db, 'members', uids[k]), { status: 'active' });
    const now = new Date();
    const start = { startsAt: (await import('firebase/firestore')).Timestamp.fromDate(now), endsAt: null, termId: null };
    const res = await createAssignments([
      { uid: uids.gs, memberName: 'Mehmet Sekreter', roleId: 'genel-sekreter', roleName: 'Genel Sekreter', unitId: 'branch', unitName: 'Kol Geneli', ...start },
      { uid: uids.cs, memberName: 'Zeynep CS Başkanı', roleId: 'birim-baskani', roleName: 'Başkan', unitId: 'cs', unitName: 'Computer Society', ...start },
    ]);
    expect(res.failed).toEqual([]);
    const acc = (await getDoc(doc(db, 'access', uids.cs))).data() as Access;
    expect(acc.tokens).toEqual(expect.arrayContaining(['role:cs__birim-baskani', 'unit:cs']));
  });

  let petitionId = '';

  it('üye komite dilekçesi oluşturur ve gönderir (evrak no atanır)', async () => {
    await as('uye');
    const t = await template('etkinlik-izin');
    petitionId = await createDraft({
      template: t,
      unitId: 'cs',
      unitName: 'Computer Society',
      title: 'Yapay Zekâ Günü',
      data: { etkinlik_adi: 'Yapay Zekâ Günü', etkinlik_tarihi: '2026-10-12', etkinlik_yeri: 'A Blok', aciklama: 'Açıklama' },
    });
    const no = await submitPetition(
      petitionId,
      { etkinlik_adi: 'Yapay Zekâ Günü', etkinlik_tarihi: '2026-10-12', etkinlik_yeri: 'A Blok', aciklama: 'Açıklama' },
      'Yapay Zekâ Günü',
    );
    expect(no).toBe(`IEEEIKCU-${new Date().getUTCFullYear()}-ETK-0001`);
  });

  it('dilekçe sahibi kendi dilekçesini onaylayamaz; sıra dışı rol onaylayamaz', async () => {
    await expect(
      decidePetition({ petitionId, decision: 'approve', roleId: 'birim-baskani', roleName: 'Başkan', unitName: 'CS', comment: '' }),
    ).rejects.toThrow();
    await as('gs');
    await expect(
      decidePetition({ petitionId, decision: 'approve', roleId: 'genel-sekreter', roleName: 'Genel Sekreter', unitName: 'Kol Geneli', comment: '' }),
    ).rejects.toThrow();
  });

  it('komite başkanı onay kutusunda görür ve onaylar', async () => {
    await as('cs');
    const acc = (await getDoc(doc(db, 'access', uids.cs))).data() as Access;
    const inbox = await getDocs(
      query(collection(db, 'petitions'), where('visibleTo', 'array-contains-any', acc.tokens), where('status', '==', 'pending')),
    );
    expect(inbox.docs.map((d) => d.id)).toContain(petitionId);
    await decidePetition({ petitionId, decision: 'approve', roleId: 'birim-baskani', roleName: 'Başkan', unitName: 'Computer Society', comment: 'Uygundur' });
  });

  it('GS ve Başkan onaylar; belge ve doğrulama kaydı tutarlı', async () => {
    await as('gs');
    await decidePetition({ petitionId, decision: 'approve', roleId: 'genel-sekreter', roleName: 'Genel Sekreter', unitName: 'Kol Geneli', comment: '' });
    await as('baskan');
    await decidePetition({ petitionId, decision: 'approve', roleId: 'baskan', roleName: 'Öğrenci Kolu Başkanı', unitName: 'Kol Geneli', comment: '' });

    const p = (await getDoc(doc(db, 'petitions', petitionId))).data() as Petition;
    expect(p.status).toBe('approved');
    expect(p.approvals).toHaveLength(3);

    const blob = await renderPetitionDocx(p, { orgName: 'IEEE İKÇÜ', settings: null });
    const xml = new PizZip(await blob.arrayBuffer()).file('word/document.xml')!.asText();
    expect(xml).toContain(p.documentNo!);
    expect(xml).toContain('Zeynep CS Başkanı');
    expect(xml).toContain('12.10.2026');

    await signOut(auth);
    const v = (await getDoc(doc(db, 'petitionVerifications', p.verificationCode!))).data() as PetitionVerification;
    expect(v.status).toBe('approved');
    expect(v.approvals).toHaveLength(3);
    expect(v.documentNo).toBe(p.documentNo);
  });

  it('iade → düzeltme → aynı numarayla yeniden gönderim → geri çekme', async () => {
    await as('uye');
    const t = await template('etkinlik-izin');
    const data = { etkinlik_adi: 'Atölye', etkinlik_tarihi: '2026-11-01', etkinlik_yeri: 'B Blok', aciklama: 'x' };
    const id = await createDraft({ template: t, unitId: 'cs', unitName: 'Computer Society', title: 'Atölye', data });
    const no = await submitPetition(id, data, 'Atölye');
    expect(no.endsWith('-0002')).toBe(true);

    await as('cs');
    await expect(
      decidePetition({ petitionId: id, decision: 'return', roleId: 'birim-baskani', roleName: 'Başkan', unitName: 'CS', comment: '' }),
    ).rejects.toThrow();
    await decidePetition({ petitionId: id, decision: 'return', roleId: 'birim-baskani', roleName: 'Başkan', unitName: 'CS', comment: 'Tarihi düzeltin' });

    await as('uye');
    await resubmitPetition(id, { ...data, etkinlik_tarihi: '2026-11-08' }, 'Atölye');
    let p = (await getDoc(doc(db, 'petitions', id))).data() as Petition;
    expect(p.status).toBe('pending');
    expect(p.revision).toBe(2);
    expect(p.documentNo).toBe(no);

    await withdrawPetition(id);
    p = (await getDoc(doc(db, 'petitions', id))).data() as Petition;
    expect(p.status).toBe('withdrawn');
  });

  it('görev sonlandırılınca onay yetkisi hemen kalkar', async () => {
    await as('baskan');
    const asg = await getDocs(query(collection(db, 'assignments'), where('uid', '==', uids.cs), where('status', '==', 'active')));
    const { endAssignments } = await import('../lib/assignments');
    await endAssignments(asg.docs.map((d) => ({ id: d.id, ...(d.data() as Assignment) })));

    await as('uye');
    const t = await template('etkinlik-izin');
    const data = { etkinlik_adi: 'Söyleşi', etkinlik_tarihi: '2026-12-01', etkinlik_yeri: 'C', aciklama: 'y' };
    const id = await createDraft({ template: t, unitId: 'cs', unitName: 'Computer Society', title: 'Söyleşi', data });
    await submitPetition(id, data, 'Söyleşi');

    await as('cs');
    await expect(
      decidePetition({ petitionId: id, decision: 'approve', roleId: 'birim-baskani', roleName: 'Başkan', unitName: 'CS', comment: '' }),
    ).rejects.toThrow();
  });
});
