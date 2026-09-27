import { collection, doc, getDocs, orderBy, query, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { auditInBatch } from './audit';
import { base64ToBuffer, bufferToBase64, sha256Hex } from './docx';
import type { StatuteVersion } from './types';

export const MAX_STATUTE_BYTES = 4 * 1024 * 1024;
export const PDF_MIME = 'application/pdf';
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const CHUNK_CHARS = 700_000;

export function statuteMime(file: Pick<File, 'name' | 'type'>): string | null {
  const lower = file.name.toLocaleLowerCase('tr-TR');
  if (file.type === PDF_MIME || lower.endsWith('.pdf')) return PDF_MIME;
  if (file.type === DOCX_MIME || lower.endsWith('.docx')) return DOCX_MIME;
  return null;
}

export function validateStatuteFile(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  if (!statuteMime(file)) return 'Yalnızca PDF veya Word (.docx) dosyası yüklenebilir.';
  if (file.size <= 0) return 'Dosya boş.';
  if (file.size > MAX_STATUTE_BYTES) return 'Tüzük dosyası en fazla 4 MB olabilir.';
  return null;
}

export async function publishStatute(input: {
  file: File;
  title: string;
  versionLabel: string;
  summary: string;
}): Promise<string> {
  const error = validateStatuteFile(input.file);
  if (error) throw new Error(error);
  const user = auth.currentUser;
  if (!user) throw new Error('Tüzük yayımlamak için giriş yapmalısınız.');

  const buffer = await input.file.arrayBuffer();
  const base64 = bufferToBase64(buffer);
  const chunkCount = Math.max(1, Math.ceil(base64.length / CHUNK_CHARS));
  const versionId = crypto.randomUUID();
  const mimeType = statuteMime(input.file)!;
  const metadata = {
    versionId,
    title: input.title.trim(),
    versionLabel: input.versionLabel.trim(),
    summary: input.summary.trim(),
    fileName: input.file.name,
    mimeType,
    size: input.file.size,
    sha256: await sha256Hex(buffer),
    chunkCount,
    publishedAt: serverTimestamp(),
    publishedByName: user.displayName ?? user.email ?? 'Yetkili kullanıcı',
  };

  if (!metadata.title || !metadata.versionLabel) throw new Error('Başlık ve sürüm bilgisi zorunludur.');

  const batch = writeBatch(db);
  batch.set(doc(db, 'statuteVersions', versionId), metadata);
  for (let index = 0; index < chunkCount; index++) {
    batch.set(doc(db, `statuteVersions/${versionId}/chunks/${String(index).padStart(3, '0')}`), {
      index,
      data: base64.slice(index * CHUNK_CHARS, (index + 1) * CHUNK_CHARS),
    });
  }
  batch.set(doc(db, 'statutes', 'current'), metadata);
  auditInBatch(batch, 'statute.publish', `statuteVersions/${versionId}`, {
    versionLabel: metadata.versionLabel,
    fileName: metadata.fileName,
    sha256: metadata.sha256,
  });
  await batch.commit();
  return versionId;
}

export async function loadStatuteFile(version: Pick<StatuteVersion, 'versionId' | 'mimeType' | 'sha256'>): Promise<Blob> {
  const snap = await getDocs(query(collection(db, `statuteVersions/${version.versionId}/chunks`), orderBy('index')));
  if (snap.empty) throw new Error('Tüzük dosyasının parçaları bulunamadı.');
  const buffer = base64ToBuffer(snap.docs.map((item) => item.data().data as string).join(''));
  if ((await sha256Hex(buffer)) !== version.sha256) throw new Error('Dosya bütünlük kontrolü başarısız oldu.');
  return new Blob([buffer], { type: version.mimeType });
}

export async function downloadStatute(version: StatuteVersion) {
  const blob = await loadStatuteFile(version);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = version.fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
