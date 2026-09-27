import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import QRCode from 'qrcode';
import { auth, db } from '../firebase';
import { auditInBatch } from './audit';
import type { Asset, AssetMovementType } from './opsTypes';

export type AssetInput = Omit<Asset, 'lastMovementId' | 'createdBy' | 'createdByName' | 'createdAt' | 'updatedBy' | 'updatedByName' | 'updatedAt'>;

function actor() {
  const user = auth.currentUser;
  if (!user) throw new Error('Bu işlem için giriş yapmalısınız.');
  return { uid: user.uid, name: user.displayName ?? user.email ?? 'Yetkili kullanıcı' };
}

function stateOf(asset: Pick<Asset, 'status' | 'location' | 'custodianName'>) {
  return { status: asset.status, location: asset.location, custodianName: asset.custodianName };
}

function movementType(previous: Asset, next: AssetInput): AssetMovementType {
  if (next.status === 'lost') return 'lost';
  if (next.status === 'retired') return 'retire';
  if (next.status === 'maintenance') return 'maintenance';
  if (previous.custodianUid && !next.custodianUid) return 'return';
  if (previous.custodianUid !== next.custodianUid) return 'assign';
  if (previous.location !== next.location) return 'move';
  return 'update';
}

export async function createAsset(input: AssetInput, note: string): Promise<string> {
  const by = actor();
  const ref = doc(collection(db, 'assets'));
  const movementRef = doc(collection(db, 'assetMovements'));
  const payload = {
    ...input,
    lastMovementId: movementRef.id,
    createdBy: by.uid,
    createdByName: by.name,
    createdAt: serverTimestamp(),
    updatedBy: by.uid,
    updatedByName: by.name,
    updatedAt: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(ref, payload);
  batch.set(movementRef, {
    assetId: ref.id,
    assetCode: input.code,
    assetName: input.name,
    type: 'create',
    note,
    from: null,
    to: stateOf(input),
    byUid: by.uid,
    byName: by.name,
    at: serverTimestamp(),
  });
  auditInBatch(batch, 'asset.create', `assets/${ref.id}`, { code: input.code, name: input.name });
  await batch.commit();
  return ref.id;
}

export async function updateAsset(id: string, previous: Asset, input: AssetInput, note: string) {
  const by = actor();
  const type = movementType(previous, input);
  const movementRef = doc(collection(db, 'assetMovements'));
  const batch = writeBatch(db);
  batch.update(doc(db, 'assets', id), {
    ...input,
    lastMovementId: movementRef.id,
    updatedBy: by.uid,
    updatedByName: by.name,
    updatedAt: serverTimestamp(),
  });
  batch.set(movementRef, {
    assetId: id,
    assetCode: input.code,
    assetName: input.name,
    type,
    note,
    from: stateOf(previous),
    to: stateOf(input),
    byUid: by.uid,
    byName: by.name,
    at: serverTimestamp(),
  });
  auditInBatch(batch, `asset.${type}`, `assets/${id}`, { code: input.code, note });
  await batch.commit();
}

export async function downloadAssetQr(assetId: string, asset: Pick<Asset, 'code' | 'name'>) {
  const target = `${window.location.origin}/demirbas?varlik=${encodeURIComponent(assetId)}`;
  const qrUrl = await QRCode.toDataURL(target, { width: 420, margin: 2, errorCorrectionLevel: 'M' });
  const qr = new Image();
  qr.src = qrUrl;
  await qr.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 560;
  canvas.height = 650;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Etiket oluşturulamadı.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#00629b';
  ctx.fillRect(0, 0, canvas.width, 64);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 27px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('IEEE İKÇÜ DEMİRBAŞ', canvas.width / 2, 42);
  ctx.drawImage(qr, 70, 78, 420, 420);
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 32px Arial';
  ctx.fillText(asset.code, canvas.width / 2, 535);
  ctx.font = '24px Arial';
  const label = asset.name.length > 34 ? `${asset.name.slice(0, 32)}…` : asset.name;
  ctx.fillText(label, canvas.width / 2, 575);
  ctx.font = '16px Arial';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('QR kodu okutarak güncel zimmet kaydını görüntüleyin.', canvas.width / 2, 615);
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `${asset.code.replace(/[^A-Za-z0-9_-]/g, '_')}_qr.png`;
  link.click();
}
