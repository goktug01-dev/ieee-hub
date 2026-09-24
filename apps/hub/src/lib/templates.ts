import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { auditInBatch, logAudit } from './audit';
import { buildDocxFromSpec, inspectDocx, mergeFields, writeChunks } from './docx';
import type { ApprovalStep, BuilderSpec, PetitionTemplate, TemplateContent } from './types';

export interface TemplateMeta {
  name: string;
  description: string;
  category: string;
  scope: 'branch' | 'unit';
  unitIds: string[];
  series: string;
}

export async function createTemplate(id: string, meta: TemplateMeta): Promise<void> {
  const ref = doc(db, 'petitionTemplates', id);
  if ((await getDoc(ref)).exists()) throw new Error('Bu kimlikte bir şablon zaten var.');
  await setDoc(ref, {
    ...meta,
    active: false,
    currentVersion: 0,
    latestVersion: 0,
    draft: null,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid ?? '',
    updatedAt: serverTimestamp(),
  });
  await logAudit('template.create', `petitionTemplates/${id}`, { name: meta.name });
}

export async function updateTemplateMeta(id: string, meta: Partial<TemplateMeta> & { active?: boolean }) {
  await updateDoc(doc(db, 'petitionTemplates', id), { ...meta, updatedAt: serverTimestamp() });
  await logAudit('template.update', `petitionTemplates/${id}`, meta as Record<string, unknown>);
}

/** Yüklenen Word dosyasını taslağa kaydeder, etiketleri algılayıp alanları birleştirir. */
export async function saveDraftFile(
  id: string,
  current: TemplateContent | null,
  file: { name: string; buf: ArrayBuffer; source: 'upload' | 'builder'; builder?: BuilderSpec | null },
): Promise<{ content: TemplateContent; warnings: string[] }> {
  const inspected = inspectDocx(file.buf);
  if (inspected.errors.length) throw new Error(`Word dosyası okunamadı:\n${inspected.errors.join('\n')}`);
  const chunkCount = await writeChunks(db, `petitionTemplates/${id}/draftChunks`, file.buf, current?.chunkCount ?? 0);
  const content: TemplateContent = {
    source: file.source,
    fileName: file.name,
    sizeBytes: file.buf.byteLength,
    chunkCount,
    fields: mergeFields(inspected.fieldTags, current?.fields ?? []),
    steps: current?.steps ?? [],
    builder: file.builder ?? null,
  };
  await updateDoc(doc(db, 'petitionTemplates', id), { draft: content, updatedAt: serverTimestamp() });
  const warnings = inspected.unsupportedLoops.map(
    (l) => `"{#${l}}" tekrar bloğu desteklenmiyor; yalnızca {#onaylar} kullanılabilir.`,
  );
  return { content, warnings };
}

export async function saveBuilderDraft(id: string, current: TemplateContent | null, spec: BuilderSpec) {
  const buf = await buildDocxFromSpec(spec);
  return saveDraftFile(id, current, { name: 'sistem-sablonu.docx', buf, source: 'builder', builder: spec });
}

export async function saveDraftContent(id: string, content: TemplateContent) {
  await updateDoc(doc(db, 'petitionTemplates', id), { draft: content, updatedAt: serverTimestamp() });
}

export function validateSteps(steps: ApprovalStep[]): string[] {
  const errors: string[] = [];
  if (!steps.length) errors.push('En az bir onay adımı tanımlayın.');
  steps.forEach((s, i) => {
    if (!s.name.trim()) errors.push(`${i + 1}. adımın adı boş.`);
    if (!s.roleIds.length) errors.push(`${i + 1}. adımda en az bir rol seçin.`);
    if (s.unitMode === 'fixed' && !s.unitId) errors.push(`${i + 1}. adım için birim seçin.`);
  });
  return errors;
}

/**
 * Taslağı yeni, değiştirilemez bir sürüm olarak yayımlar ve yürürlüğe alır.
 * Süreçteki dilekçeler kendi sürümleriyle devam eder.
 */
export async function publishTemplate(id: string, changeNote: string): Promise<number> {
  const tRef = doc(db, 'petitionTemplates', id);
  const t = (await getDoc(tRef)).data() as PetitionTemplate & { latestVersion?: number };
  const draft = t.draft;
  if (!draft) throw new Error('Yayımlanacak taslak yok. Önce Word dosyası yükleyin veya şablonu oluşturun.');
  const errors = validateSteps(draft.steps);
  if (errors.length) throw new Error(errors.join('\n'));

  const chunks = await getDocs(query(collection(db, `petitionTemplates/${id}/draftChunks`), orderBy('index')));
  const next = Math.max(t.latestVersion ?? 0, t.currentVersion ?? 0) + 1;
  const u = auth.currentUser!;
  const batch = writeBatch(db);
  batch.set(doc(db, `petitionTemplates/${id}/versions/${next}`), {
    ...draft,
    version: next,
    publishedAt: serverTimestamp(),
    publishedBy: u.uid,
    publishedByName: u.displayName ?? u.email ?? '',
    changeNote,
  });
  chunks.docs.slice(0, draft.chunkCount).forEach((c) => {
    batch.set(doc(db, `petitionTemplates/${id}/versions/${next}/chunks/${c.id}`), c.data());
  });
  batch.update(tRef, { currentVersion: next, latestVersion: next, active: true, updatedAt: serverTimestamp() });
  auditInBatch(batch, 'template.publish', `petitionTemplates/${id}`, { version: next, changeNote });
  await batch.commit();
  return next;
}

/** Önceki bir sürümü yeniden yürürlüğe alır. */
export async function setCurrentVersion(id: string, version: number) {
  await updateDoc(doc(db, 'petitionTemplates', id), { currentVersion: version, updatedAt: serverTimestamp() });
  await logAudit('template.rollback', `petitionTemplates/${id}`, { version });
}
