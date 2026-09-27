import {
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { logAudit } from './audit';
import { onboardVolunteer } from './ops';
import type {
  RecruitmentApplication,
  RecruitmentApplicationStatus,
  RecruitmentCall,
  RecruitmentQuestion,
} from './opsTypes';
import type { WithId } from './types';

export type RecruitmentCallInput = Pick<
  RecruitmentCall,
  'unitId' | 'unitName' | 'title' | 'roleTitle' | 'summary' | 'description' | 'expectations' | 'capacity' | 'opensAt' | 'closesAt' | 'questions'
>;

export type RecruitmentApplicationInput = Pick<
  RecruitmentApplication,
  'phone' | 'department' | 'studentNo' | 'ieeeMemberNo' | 'motivation' | 'availability' | 'answers' | 'privacyConsent'
>;

function currentUser() {
  const user = auth.currentUser;
  if (!user) throw new Error('Bu işlem için giriş yapmalısınız.');
  return { uid: user.uid, name: user.displayName ?? user.email?.split('@')[0] ?? 'Aday', email: user.email ?? '' };
}

export function applicationDocumentId(callId: string, uid: string): string {
  return `${callId}__${uid}`;
}

export function recruitmentCallIsOpen(call: Pick<RecruitmentCall, 'status' | 'opensAt' | 'closesAt'>, now = Date.now()): boolean {
  return call.status === 'open' && call.opensAt.toMillis() <= now && call.closesAt.toMillis() >= now;
}

export function validateRecruitmentCall(input: RecruitmentCallInput): string | null {
  if (!input.unitId || !input.title.trim() || !input.roleTitle.trim() || !input.summary.trim()) return 'Birim, ilan başlığı, pozisyon ve kısa açıklama zorunludur.';
  if (input.title.trim().length > 120 || input.summary.trim().length > 500) return 'Başlık en fazla 120, kısa açıklama en fazla 500 karakter olabilir.';
  if (input.opensAt.toMillis() >= input.closesAt.toMillis()) return 'Başvuru bitişi başlangıçtan sonra olmalıdır.';
  if (input.capacity !== null && (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 500)) return 'Kontenjan 1–500 arasında olmalıdır.';
  if (input.questions.length > 10) return 'Bir ilana en fazla 10 özel soru eklenebilir.';
  for (const question of input.questions) {
    if (!question.id || !question.label.trim()) return 'Tüm özel soruların metni olmalıdır.';
    if (question.type === 'choice' && question.options.filter(Boolean).length < 2) return `“${question.label}” için en az iki seçenek girin.`;
  }
  return null;
}

export async function createRecruitmentCall(input: RecruitmentCallInput): Promise<string> {
  const error = validateRecruitmentCall(input);
  if (error) throw new Error(error);
  const who = currentUser();
  const ref = doc(db, 'recruitmentCalls', crypto.randomUUID());
  await setDoc(ref, {
    ...input,
    status: 'draft',
    createdBy: who.uid,
    createdByName: who.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAudit('recruitment.call.create', ref.path, { unitId: input.unitId, title: input.title });
  return ref.id;
}

export async function setRecruitmentCallStatus(call: WithId<RecruitmentCall>, status: RecruitmentCall['status']) {
  if (status === 'open') {
    const error = validateRecruitmentCall(call);
    if (error) throw new Error(error);
    if (call.closesAt.toMillis() <= Date.now()) throw new Error('Bitiş tarihi geçmiş bir ilan yayımlanamaz.');
  }
  await updateDoc(doc(db, 'recruitmentCalls', call.id), { status, updatedAt: serverTimestamp() });
  await logAudit(`recruitment.call.${status}`, `recruitmentCalls/${call.id}`, { title: call.title, unitId: call.unitId });
}

export async function applyToRecruitmentCall(call: WithId<RecruitmentCall>, input: RecruitmentApplicationInput) {
  const who = currentUser();
  if (!recruitmentCallIsOpen(call)) throw new Error('Bu ilanın başvuru dönemi açık değil.');
  if (!input.department.trim() || input.motivation.trim().length < 40 || !input.privacyConsent) {
    throw new Error('Bölüm, en az 40 karakterlik motivasyon ve aydınlatma onayı zorunludur.');
  }
  const missing = call.questions.find((question) => question.required && !input.answers[question.id]?.trim());
  if (missing) throw new Error(`“${missing.label}” sorusunu yanıtlayın.`);
  const id = applicationDocumentId(call.id, who.uid);
  await setDoc(doc(db, 'recruitmentApplications', id), {
    callId: call.id,
    callTitle: call.title,
    unitId: call.unitId,
    unitName: call.unitName,
    uid: who.uid,
    name: who.name,
    email: who.email,
    ...input,
    status: 'pending',
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function withdrawRecruitmentApplication(application: WithId<RecruitmentApplication>) {
  await updateDoc(doc(db, 'recruitmentApplications', application.id), { status: 'withdrawn', updatedAt: serverTimestamp() });
}

export async function decideRecruitmentApplication(
  application: WithId<RecruitmentApplication>,
  status: Exclude<RecruitmentApplicationStatus, 'pending' | 'withdrawn'>,
  note: string,
  unitShortCode: string,
): Promise<{ orientationTasks: number }> {
  const who = currentUser();
  await updateDoc(doc(db, 'recruitmentApplications', application.id), {
    status,
    reviewedBy: who.uid,
    reviewedByName: who.name,
    reviewedAt: serverTimestamp(),
    decisionNote: note.trim(),
    updatedAt: serverTimestamp(),
  });
  if (status !== 'accepted') {
    await logAudit(`recruitment.application.${status}`, `recruitmentApplications/${application.id}`, { callId: application.callId, unitId: application.unitId });
    return { orientationTasks: 0 };
  }
  return onboardVolunteer(
    { uid: application.uid, name: application.name, unitId: application.unitId, unitName: application.unitName },
    unitShortCode,
    `recruitmentApplications/${application.id}`,
    application.callTitle,
  );
}

export function emptyRecruitmentQuestion(index: number): RecruitmentQuestion {
  return { id: `q_${Date.now()}_${index}`, label: '', type: 'long', required: false, options: [] };
}
