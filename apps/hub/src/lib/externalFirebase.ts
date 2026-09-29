import { deleteApp, getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserSessionPersistence,
  getAuth,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
} from 'firebase/auth';
import {
  getDatabase,
  get as getRealtime,
  push as pushRealtime,
  ref,
  remove as removeRealtime,
  serverTimestamp as realtimeServerTimestamp,
  set as setRealtime,
  update as updateRealtime,
  type Database,
} from 'firebase/database';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  query,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { ExternalFirebaseConfig, ExternalFirebaseResource } from './opsTypes';

export interface ExternalRecord {
  id: string;
  data: Record<string, unknown>;
}

export interface ExternalPointUser {
  id: string;
  name: string;
  surname: string;
  email: string;
  department: string;
  approved: boolean;
  points: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  raw: Record<string, unknown>;
}

export interface ExternalPointChange {
  id: string;
  points: number;
  lifetimeEarned?: number;
  lifetimeSpent?: number;
}

interface ExternalServices {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  realtime: Database | null;
}

const appName = (projectId: string) => `ieee-hub-external-${projectId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

export function externalServices(config: ExternalFirebaseConfig): ExternalServices {
  const name = appName(config.projectId);
  const options: FirebaseOptions = {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    appId: config.appId,
    ...(config.databaseURL ? { databaseURL: config.databaseURL } : {}),
  };
  const app = getApps().some((item) => item.name === name) ? getApp(name) : initializeApp(options, name);
  return { app, auth: getAuth(app), firestore: getFirestore(app), realtime: config.databaseURL ? getDatabase(app) : null };
}

export async function connectExternalGoogle(config: ExternalFirebaseConfig) {
  const { auth } = externalServices(config);
  await setPersistence(auth, browserSessionPersistence);
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export async function connectExternalEmail(config: ExternalFirebaseConfig, email: string, password: string) {
  const { auth } = externalServices(config);
  await setPersistence(auth, browserSessionPersistence);
  return signInWithEmailAndPassword(auth, email, password);
}

export async function disconnectExternal(config: ExternalFirebaseConfig) {
  return signOut(externalServices(config).auth);
}

export async function resetExternalConnection(projectId: string) {
  const name = appName(projectId);
  const app = getApps().find((item) => item.name === name);
  if (app) await deleteApp(app);
}

function plain(value: unknown): unknown {
  if (value instanceof Timestamp) return { $timestamp: value.toDate().toISOString() };
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  return value;
}

function restore(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(restore);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.$timestamp === 'string' && Object.keys(record).length === 1) return Timestamp.fromDate(new Date(record.$timestamp));
    return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, restore(item)]));
  }
  return value;
}

export function stringifyExternalData(data: Record<string, unknown>) {
  return JSON.stringify(plain(data), null, 2);
}

export function parseExternalData(text: string): Record<string, unknown> {
  const value = restore(JSON.parse(text));
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Kayıt içeriği bir JSON nesnesi olmalı.');
  return value as Record<string, unknown>;
}

export async function readExternalResource(config: ExternalFirebaseConfig, resource: ExternalFirebaseResource): Promise<ExternalRecord[]> {
  const services = externalServices(config);
  if (!services.auth.currentUser) throw new Error('Önce harici Firebase projesinde oturum açın.');
  if (resource.database === 'firestore') {
    const snapshot = await getDocs(query(collection(services.firestore, resource.path), limit(100)));
    return snapshot.docs.map((item) => ({ id: item.id, data: item.data() }));
  }
  if (!services.realtime) throw new Error('Realtime Database URL yapılandırılmamış.');
  const snapshot = await getRealtime(ref(services.realtime, resource.path));
  const value = snapshot.val() as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).map(([id, data]) => ({
    id,
    data: data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : { value: data },
  })).slice(0, 100);
}

function cleanPath(path: string, fallback: string) {
  const clean = (path || fallback).replace(/^\/+|\/+$/g, '');
  if (!clean || clean.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error('Geçersiz Realtime Database yolu.');
  return clean;
}

const finiteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;

/** IEEE Puan kullanıcılarını canlı RTDB'den okur; veri Hub veritabanına kopyalanmaz. */
export async function readExternalPointUsers(config: ExternalFirebaseConfig, resource: ExternalFirebaseResource): Promise<ExternalPointUser[]> {
  const services = externalServices(config);
  if (!services.auth.currentUser) throw new Error('Önce harici Firebase projesinde oturum açın.');
  if (!services.realtime) throw new Error('Realtime Database URL yapılandırılmamış.');
  const usersPath = cleanPath(resource.path, 'users');
  const value = (await getRealtime(ref(services.realtime, usersPath))).val() as Record<string, unknown> | null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([id, item]) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const data = item as Record<string, unknown>;
    return [{
      id,
      name: String(data.name ?? ''),
      surname: String(data.surname ?? ''),
      email: String(data.email ?? ''),
      department: String(data.department ?? ''),
      approved: data.approved === true,
      points: finiteNumber(data.sadakat),
      lifetimeEarned: finiteNumber(data.lifetime_earned),
      lifetimeSpent: finiteNumber(data.lifetime_spent ?? data.lifetime_spend),
      raw: data,
    }];
  }).sort((a, b) => `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`, 'tr'));
}

/** Puan değişikliklerini, sıralama önbelleğini ve denetim kaydını tek RTDB update'iyle yazar. */
export async function writeExternalPointChanges(
  config: ExternalFirebaseConfig,
  resource: ExternalFirebaseResource,
  users: ExternalPointUser[],
  changes: ExternalPointChange[],
  reason: string,
) {
  const services = externalServices(config);
  const actor = services.auth.currentUser;
  if (!actor) throw new Error('Harici Firebase oturumu kapalı.');
  if (!services.realtime) throw new Error('Realtime Database URL yapılandırılmamış.');
  if (!reason.trim()) throw new Error('İşlem gerekçesi zorunludur.');
  if (!changes.length) throw new Error('Değiştirilecek kullanıcı yok.');

  const usersPath = cleanPath(resource.path, 'users');
  const leaderboardPath = cleanPath(resource.leaderboardPath ?? '', 'leaderboard_public');
  const auditPath = cleanPath(resource.auditPath ?? '', 'admin_point_audit');
  const byId = new Map(users.map((user) => [user.id, user]));
  const updates: Record<string, unknown> = {};
  for (const change of changes) {
    if (!byId.has(change.id) || change.id.includes('/')) throw new Error('Puan kaydında geçersiz kullanıcı kimliği.');
    if (![change.points, change.lifetimeEarned, change.lifetimeSpent].filter((value) => value !== undefined).every((value) => Number.isFinite(value) && value! >= 0)) {
      throw new Error('Puan değerleri sıfır veya pozitif sayı olmalıdır.');
    }
    updates[`${usersPath}/${change.id}/sadakat`] = change.points;
    if (change.lifetimeEarned !== undefined) updates[`${usersPath}/${change.id}/lifetime_earned`] = change.lifetimeEarned;
    if (change.lifetimeSpent !== undefined) {
      updates[`${usersPath}/${change.id}/lifetime_spent`] = change.lifetimeSpent;
      if ('lifetime_spend' in byId.get(change.id)!.raw) updates[`${usersPath}/${change.id}/lifetime_spend`] = null;
    }
  }

  const changeMap = new Map(changes.map((change) => [change.id, change]));
  const ranked = users
    .filter((user) => user.approved)
    .map((user) => ({ ...user, points: changeMap.get(user.id)?.points ?? user.points }))
    .sort((a, b) => b.points - a.points || `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`, 'tr'));
  ranked.forEach((user, index) => {
    updates[`${leaderboardPath}/me/${user.id}`] = { rank: index + 1, score: user.points };
  });
  updates[`${leaderboardPath}/top10`] = ranked.slice(0, 10).map((user) => ({ name: `${user.name} ${user.surname}`.trim(), score: user.points }));
  updates[`${leaderboardPath}/updatedAt`] = realtimeServerTimestamp();

  const auditKey = pushRealtime(ref(services.realtime, auditPath)).key;
  if (!auditKey) throw new Error('Denetim kaydı kimliği üretilemedi.');
  updates[`${auditPath}/${auditKey}`] = {
    action: changes.length === users.length ? 'reset_all_current_points' : 'update_points',
    actorUid: actor.uid,
    affectedUids: changes.map((change) => change.id),
    reason: reason.trim(),
    at: realtimeServerTimestamp(),
  };
  await updateRealtime(ref(services.realtime), updates);
}

export async function writeExternalRecord(config: ExternalFirebaseConfig, resource: ExternalFirebaseResource, id: string, data: Record<string, unknown>) {
  const services = externalServices(config);
  if (!services.auth.currentUser) throw new Error('Harici Firebase oturumu kapalı.');
  if (!id.trim() || id.includes('/')) throw new Error('Kayıt kimliği boş olamaz ve “/” içeremez.');
  if (resource.database === 'firestore') return setDoc(doc(services.firestore, resource.path, id), data);
  if (!services.realtime) throw new Error('Realtime Database URL yapılandırılmamış.');
  return setRealtime(ref(services.realtime, `${resource.path}/${id}`), data);
}

export async function deleteExternalRecord(config: ExternalFirebaseConfig, resource: ExternalFirebaseResource, id: string) {
  const services = externalServices(config);
  if (!services.auth.currentUser) throw new Error('Harici Firebase oturumu kapalı.');
  if (resource.database === 'firestore') return deleteDoc(doc(services.firestore, resource.path, id));
  if (!services.realtime) throw new Error('Realtime Database URL yapılandırılmamış.');
  return removeRealtime(ref(services.realtime, `${resource.path}/${id}`));
}

export function fieldValue(data: Record<string, unknown>, path: string): string {
  let value: unknown = data;
  for (const part of path.split('.')) {
    if (!value || typeof value !== 'object') return '';
    value = (value as Record<string, unknown>)[part];
  }
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(plain(value));
  return String(value);
}
