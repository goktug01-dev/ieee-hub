/**
 * Dilekçe işlemleri. Tüm doğrulamalar firebase/firestore.rules içinde tekrar yapılır;
 * buradaki kod yalnızca kuralların kabul edeceği yazmayı hazırlar.
 */
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { reauthenticateWithPopup, GoogleAuthProvider, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth, db } from '../firebase';
import { readChunks, renderDocx } from './docx';
import { DECISION_LABEL, STATUS_META, fmtDate, fmtDateTime, maskName } from './format';
import type {
  ApprovalRecord,
  Decision,
  OrgSettings,
  Petition,
  PetitionTemplate,
  PetitionVerification,
  TemplateVersion,
  WithId,
} from './types';
import { BRANCH } from './types';
import {
  DEFAULT_ORG_SETTINGS,
  computeVisibleTo,
  formatDocumentNo,
  newVerificationCode,
  stepUnitId,
  verifyUrl,
} from './workflow';

export {
  DEFAULT_ORG_SETTINGS,
  computeVisibleTo,
  formatDocumentNo,
  newVerificationCode,
  stepUnitId,
  verifyUrl,
} from './workflow';

// ---------- Taslak ----------

export async function createDraft(input: {
  template: WithId<PetitionTemplate>;
  unitId: string;
  unitName: string;
  title: string;
  data: Record<string, string>;
}): Promise<string> {
  const u = auth.currentUser!;
  const ref = await addDoc(collection(db, 'petitions'), {
    templateId: input.template.id,
    templateVersion: input.template.currentVersion,
    templateName: input.template.name,
    unitId: input.unitId,
    unitName: input.unitName,
    ownerUid: u.uid,
    ownerName: u.displayName ?? u.email ?? '',
    title: input.title,
    data: input.data,
    status: 'draft',
    visibleTo: [`uid:${u.uid}`],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateDraft(id: string, patch: Partial<Pick<Petition, 'title' | 'data' | 'unitId' | 'unitName'>>) {
  await updateDoc(doc(db, 'petitions', id), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteDraft(id: string) {
  await deleteDoc(doc(db, 'petitions', id));
}

// ---------- Gönderim ----------

function verificationPayload(p: Petition, petitionId: string, code: string, submittedAt: unknown) {
  return {
    petitionId,
    status: p.status,
    approvals: p.approvals ?? [],
    documentNo: p.documentNo ?? '',
    templateName: p.templateName,
    revision: p.revision ?? 1,
    ownerMasked: maskName(p.ownerName),
    unitName: p.unitName,
    submittedAt,
    updatedAt: serverTimestamp(),
    code,
  };
}

/**
 * Taslağı onaya gönderir: evrak numarası (boşluksuz sayaç), doğrulama kodu ve onay zinciri
 * tek transaction içinde yazılır. Eşzamanlı gönderimlerde Firestore transaction'ı yeniden dener.
 */
export async function submitPetition(petitionId: string, data: Record<string, string>, title: string): Promise<string> {
  const settingsSnap = await getDoc(doc(db, 'settings', 'org'));
  const settings = { ...DEFAULT_ORG_SETTINGS, ...(settingsSnap.data() as Partial<OrgSettings> | undefined) };

  return runTransaction(db, async (tx) => {
    const pRef = doc(db, 'petitions', petitionId);
    const pSnap = await tx.get(pRef);
    if (!pSnap.exists()) throw new Error('Dilekçe bulunamadı.');
    const p = pSnap.data() as Petition;
    if (p.status !== 'draft') throw new Error('Bu dilekçe zaten gönderilmiş.');

    const tSnap = await tx.get(doc(db, 'petitionTemplates', p.templateId));
    const t = tSnap.data() as PetitionTemplate;
    if (!t?.active) throw new Error('Bu şablon şu anda kullanıma kapalı.');
    if (t.currentVersion !== p.templateVersion) {
      throw new Error('Şablonun yeni bir sürümü yayımlandı. Lütfen taslağı güncel sürümle yeniden oluşturun.');
    }
    const vSnap = await tx.get(doc(db, 'petitionTemplates', p.templateId, 'versions', String(p.templateVersion)));
    const v = vSnap.data() as TemplateVersion;

    const year = new Date().getUTCFullYear();
    const counterId = `${t.series}_${year}`;
    const cRef = doc(db, 'counters', counterId);
    const cSnap = await tx.get(cRef);
    const seq = cSnap.exists() ? (cSnap.data().value as number) + 1 : 1;
    const documentNo = formatDocumentNo(settings.numberingPattern, {
      prefix: settings.numberingPrefix,
      year,
      series: t.series,
      seq,
    });
    const code = newVerificationCode();

    const next: Petition = {
      ...p,
      data,
      title,
      status: 'pending',
      steps: v.steps,
      currentStep: 0,
      counterId,
      documentSeq: seq,
      documentNo,
      verificationCode: code,
      revision: 1,
      approvals: [],
      notes: [],
      visibleTo: computeVisibleTo(p.ownerUid, p.unitId, v.steps),
    };

    tx.update(pRef, {
      data,
      title,
      status: 'pending',
      steps: v.steps,
      currentStep: 0,
      counterId,
      documentSeq: seq,
      documentNo,
      verificationCode: code,
      revision: 1,
      approvals: [],
      notes: [],
      visibleTo: next.visibleTo,
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.set(cRef, { value: seq, lastPetitionId: petitionId });
    tx.set(doc(db, 'petitionVerifications', code), verificationPayload(next, petitionId, code, serverTimestamp()));
    return documentNo;
  });
}

/** İade edilen dilekçeyi düzeltip yeniden gönderir (aynı evrak no, yeni revizyon). */
export async function resubmitPetition(petitionId: string, data: Record<string, string>, title: string) {
  await runTransaction(db, async (tx) => {
    const pRef = doc(db, 'petitions', petitionId);
    const pSnap = await tx.get(pRef);
    const p = pSnap.data() as Petition;
    if (p.status !== 'returned') throw new Error('Yalnızca iade edilen dilekçeler yeniden gönderilebilir.');
    const vRef = doc(db, 'petitionVerifications', p.verificationCode!);
    const next: Petition = { ...p, data, title, status: 'pending', currentStep: 0, revision: (p.revision ?? 1) + 1 };
    tx.update(pRef, {
      data,
      title,
      status: 'pending',
      currentStep: 0,
      revision: next.revision,
      visibleTo: p.visibleTo,
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.update(vRef, {
      status: 'pending',
      approvals: p.approvals ?? [],
      documentNo: p.documentNo,
      templateName: p.templateName,
      revision: next.revision,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function withdrawPetition(petitionId: string) {
  await runTransaction(db, async (tx) => {
    const pRef = doc(db, 'petitions', petitionId);
    const p = (await tx.get(pRef)).data() as Petition;
    tx.update(pRef, { status: 'withdrawn', completedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    tx.update(doc(db, 'petitionVerifications', p.verificationCode!), {
      status: 'withdrawn',
      approvals: p.approvals ?? [],
      documentNo: p.documentNo,
      templateName: p.templateName,
      revision: p.revision,
      updatedAt: serverTimestamp(),
    });
  });
}

// ---------- Onay ----------

const REAUTH_AFTER_MS = 14 * 60 * 1000;

/** Kurallar son 15 dakika içinde giriş ister; gerekirse kullanıcıdan yeniden kimlik doğrulaması alınır. */
export async function ensureRecentLogin(askPassword: () => Promise<string | null>): Promise<boolean> {
  const u = auth.currentUser;
  if (!u) return false;
  const token = await u.getIdTokenResult();
  const authTime = new Date(token.authTime).getTime();
  if (Date.now() - authTime < REAUTH_AFTER_MS) return true;

  const providers = u.providerData.map((p) => p.providerId);
  if (providers.includes('google.com')) {
    await reauthenticateWithPopup(u, new GoogleAuthProvider());
  } else {
    const pw = await askPassword();
    if (!pw) return false;
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email!, pw));
  }
  await u.getIdToken(true);
  return true;
}

export interface DecisionInput {
  petitionId: string;
  decision: Decision;
  roleId: string;
  roleName: string;
  unitName: string;
  comment: string;
}

export async function decidePetition(input: DecisionInput) {
  const u = auth.currentUser!;
  await runTransaction(db, async (tx) => {
    const pRef = doc(db, 'petitions', input.petitionId);
    const p = (await tx.get(pRef)).data() as Petition;
    if (p.status !== 'pending') throw new Error('Bu dilekçe artık onay sürecinde değil.');
    const stepIdx = p.currentStep ?? 0;
    const step = p.steps![stepIdx];
    const unitId = stepUnitId(step, p.unitId);
    const approvals = p.approvals ?? [];
    const notes = p.notes ?? [];

    const record: ApprovalRecord = {
      step: stepIdx,
      stepName: step.name,
      revision: p.revision ?? 1,
      uid: u.uid,
      name: u.displayName ?? u.email ?? '',
      roleId: input.roleId,
      roleName: input.roleName,
      unitId,
      unitName: input.unitName,
      decision: input.decision,
      at: Timestamp.now(),
    };
    const newApprovals = [...approvals, record];
    const comment = input.comment.trim();
    const newNotes = comment ? [...notes, { approvalIndex: approvals.length, text: comment }] : notes;

    const isLast = stepIdx === p.steps!.length - 1;
    const patch: Record<string, unknown> = {
      approvals: newApprovals,
      notes: newNotes,
      updatedAt: serverTimestamp(),
    };
    let status: Petition['status'] = 'pending';
    if (input.decision === 'approve' && !isLast) {
      patch.currentStep = stepIdx + 1;
    } else if (input.decision === 'approve') {
      status = 'approved';
      patch.completedAt = serverTimestamp();
    } else if (input.decision === 'reject') {
      status = 'rejected';
      patch.completedAt = serverTimestamp();
    } else {
      status = 'returned';
    }
    patch.status = status;
    tx.update(pRef, patch);
    tx.update(doc(db, 'petitionVerifications', p.verificationCode!), {
      status,
      approvals: newApprovals,
      documentNo: p.documentNo,
      templateName: p.templateName,
      revision: p.revision,
      updatedAt: serverTimestamp(),
    });
  });
}

// ---------- Belge üretimi ----------

export function templateData(
  p: Petition,
  opts: { orgName: string; settings: OrgSettings | null; data?: Record<string, string> },
): Record<string, unknown> {
  const data = opts.data ?? p.data;
  const approvals = (p.approvals ?? []).filter((a) => a.revision === (p.revision ?? 1));
  const perStep: Record<string, string> = {};
  approvals.forEach((a) => {
    const n = a.step + 1;
    perStep[`onay_${n}_ad`] = a.name;
    perStep[`onay_${n}_unvan`] = `${a.roleName}${a.unitId !== BRANCH ? ` (${a.unitName})` : ''}`;
    perStep[`onay_${n}_tarih`] = fmtDateTime(a.at);
    perStep[`onay_${n}_karar`] = DECISION_LABEL[a.decision];
  });
  const formatted: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    formatted[k] = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').reverse().join('.') : v;
  }
  return {
    ...formatted,
    ...perStep,
    kurum_adi: opts.orgName,
    evrak_no: p.documentNo ?? 'TASLAK',
    tarih: fmtDate(p.submittedAt ?? Timestamp.now()),
    birim: p.unitId === BRANCH ? 'Kol Geneli' : p.unitName,
    dilekce_sahibi: p.ownerName,
    sablon_adi: p.templateName,
    revizyon: String(p.revision ?? 1),
    dogrulama_kodu: p.verificationCode ?? '—',
    dogrulama_url: p.verificationCode ? verifyUrl(opts.settings, p.verificationCode) : '—',
    onay_durumu: STATUS_META[p.status].label,
    onaylar: approvals.map((a) => ({
      adim: a.stepName,
      ad_soyad: a.name,
      unvan: a.roleName,
      birim_adi: a.unitId === BRANCH ? 'Kol Geneli' : a.unitName,
      karar: DECISION_LABEL[a.decision],
      onay_tarihi: fmtDateTime(a.at),
    })),
  };
}

export async function loadVersionFile(templateId: string, version: number): Promise<ArrayBuffer> {
  return readChunks(db, `petitionTemplates/${templateId}/versions/${version}/chunks`);
}

export async function renderPetitionDocx(
  p: Petition,
  opts: { orgName: string; settings: OrgSettings | null; data?: Record<string, string> },
): Promise<Blob> {
  const buf = await loadVersionFile(p.templateId, p.templateVersion);
  return renderDocx(buf, templateData(p, opts));
}

export function petitionFileName(p: Petition): string {
  const base = (p.documentNo ?? `TASLAK-${p.templateName}`).replace(/[^\w\-.ğüşıöçĞÜŞİÖÇ ]+/g, '_');
  return `${base}.docx`;
}

export type { PetitionVerification };
