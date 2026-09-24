/**
 * İlk kurulum: kurucu yönetici + varsayılan organizasyon.
 * Buradaki her şey kurulumdan sonra arayüzden düzenlenebilir.
 */
import { Timestamp, doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { rebuildAccess } from './access';
import { DEFAULT_BUILDER } from './docx';
import { DEFAULT_ORG_SETTINGS } from './petitions';
import { createTemplate, publishTemplate, saveBuilderDraft, saveDraftContent } from './templates';
import type { ApprovalStep, Role, TemplateContent, Unit } from './types';
import { BRANCH } from './types';

export const DEFAULT_ROLES: Record<string, Role> = {
  baskan: {
    name: 'Öğrenci Kolu Başkanı',
    scope: 'branch',
    description: 'Nihai onay makamı.',
    permissions: [
      'org.manage',
      'members.manage',
      'assignments.manage',
      'elections.manage',
      'templates.manage',
      'petitions.readAll',
      'audit.read',
    ],
    active: true,
    order: 1,
  },
  'baskan-yardimcisi': {
    name: 'Başkan Yardımcısı',
    scope: 'branch',
    description: 'Başkanın ikamesi.',
    permissions: ['members.manage', 'petitions.readAll'],
    active: true,
    order: 2,
  },
  'genel-sekreter': {
    name: 'Genel Sekreter',
    scope: 'branch',
    description: 'Evrak, dilekçe süreci, üyelik ve görev kayıtları.',
    permissions: [
      'members.manage',
      'assignments.manage',
      'elections.manage',
      'templates.manage',
      'petitions.readAll',
      'audit.read',
    ],
    active: true,
    order: 3,
  },
  sayman: {
    name: 'Sayman',
    scope: 'branch',
    description: 'Finansal kayıtlar ve harcama dilekçeleri.',
    permissions: ['petitions.readAll'],
    active: true,
    order: 4,
  },
  'yk-uyesi': {
    name: 'YK Üyesi',
    scope: 'branch',
    description: 'Yönetim Kurulu üyesi.',
    permissions: [],
    active: true,
    order: 5,
  },
  'kol-koordinasyon-uyesi': {
    name: 'Kol Koordinasyon Üyesi',
    scope: 'branch',
    description: 'Öğrenci Kolu genelinde koordinasyon görevi.',
    permissions: [],
    active: true,
    order: 6,
  },
  danisman: {
    name: 'Akademik Danışman',
    scope: 'branch',
    description: 'Öğrenci Kolu danışmanı; şablonda tanımlıysa dilekçe onaylar.',
    permissions: ['petitions.readAll'],
    active: true,
    order: 7,
  },
  'birim-baskani': {
    name: 'Başkan',
    scope: 'unit',
    description: 'Komite / başkanlık başkanı. Birim dilekçelerinin ilk onay makamı.',
    permissions: ['unit.petitions.read'],
    active: true,
    order: 10,
  },
  'birim-baskan-yardimcisi': {
    name: 'Başkan Yardımcısı',
    scope: 'unit',
    description: 'Birim başkanının ikamesi.',
    permissions: ['unit.petitions.read'],
    active: true,
    order: 11,
  },
  'koordinasyon-uyesi': {
    name: 'Koordinasyon Üyesi',
    scope: 'unit',
    description: 'Birim içinde görev ve proje koordinasyonu.',
    permissions: [],
    active: true,
    order: 12,
  },
  gonullu: {
    name: 'Gönüllü',
    scope: 'unit',
    description: 'Birim gönüllüsü.',
    permissions: [],
    active: true,
    order: 13,
  },
};

export const SAMPLE_UNITS: Record<string, Unit> = {
  yk: { name: 'Yönetim Kurulu', shortCode: 'YK', type: 'board', parentId: null, active: true, order: 0 },
  cs: { name: 'Computer Society', shortCode: 'CS', type: 'committee', parentId: null, active: true, order: 1 },
  ras: { name: 'Robotics and Automation Society', shortCode: 'RAS', type: 'committee', parentId: null, active: true, order: 2 },
  wie: { name: 'Women in Engineering', shortCode: 'WIE', type: 'committee', parentId: null, active: true, order: 3 },
  techops: {
    name: 'Teknik Operasyon ve Altyapı Dairesi Başkanlığı',
    shortCode: 'TO',
    type: 'directorate',
    parentId: null,
    active: true,
    order: 4,
  },
};

function academicYear(now = new Date()) {
  const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    id: `${y}-${y + 1}`,
    name: `${y}-${y + 1} Dönemi`,
    startsAt: Timestamp.fromDate(new Date(y, 8, 1)),
    endsAt: Timestamp.fromDate(new Date(y + 1, 7, 31, 23, 59, 59)),
  };
}

/** Adım 1: kurucu yönetici (kurallar bunu yalnızca sistemde hiç kurulum yokken kabul eder). */
export async function claimFounder(displayName: string) {
  const u = auth.currentUser!;
  const batch = writeBatch(db);
  batch.set(doc(db, 'members', u.uid), {
    uid: u.uid,
    displayName,
    email: u.email ?? '',
    photoURL: u.photoURL ?? null,
    status: 'active',
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'access', u.uid), {
    superAdmin: true,
    perms: {},
    roleKeys: {},
    tokens: [`uid:${u.uid}`],
    updatedAt: serverTimestamp(),
    updatedBy: u.uid,
  });
  batch.set(doc(db, 'system', 'bootstrap'), { uid: u.uid, at: serverTimestamp() });
  await batch.commit();
}

export interface SeedOptions {
  orgName: string;
  orgShortName: string;
  founderRoleId: string | null;
  includeSampleUnits: boolean;
  includeSampleTemplates: boolean;
}

/** Adım 2: varsayılan roller, birimler, dönem, ayarlar ve örnek şablonlar. */
export async function seedOrganization(opts: SeedOptions, onProgress: (msg: string) => void) {
  const u = auth.currentUser!;
  const term = academicYear();

  onProgress('Kurum ayarları ve roller oluşturuluyor…');
  const batch = writeBatch(db);
  batch.set(doc(db, 'settings', 'public'), { orgName: opts.orgName, orgShortName: opts.orgShortName, logoDataUrl: null });
  batch.set(doc(db, 'settings', 'org'), { ...DEFAULT_ORG_SETTINGS, activeTermId: term.id });
  for (const [id, role] of Object.entries(DEFAULT_ROLES)) batch.set(doc(db, 'roles', id), role);
  if (opts.includeSampleUnits) {
    for (const [id, unit] of Object.entries(SAMPLE_UNITS)) batch.set(doc(db, 'units', id), unit);
  }
  batch.set(doc(db, 'terms', term.id), {
    name: term.name,
    startsAt: term.startsAt,
    endsAt: term.endsAt,
    status: 'active',
  });
  if (opts.founderRoleId) {
    const role = DEFAULT_ROLES[opts.founderRoleId];
    batch.set(doc(db, 'assignments', `${u.uid}_${opts.founderRoleId}_${term.id}`), {
      uid: u.uid,
      memberName: u.displayName ?? u.email ?? '',
      roleId: opts.founderRoleId,
      roleName: role.name,
      unitId: BRANCH,
      unitName: 'Kol Geneli',
      termId: term.id,
      startsAt: term.startsAt,
      endsAt: term.endsAt,
      status: 'active',
      source: 'manual',
      createdBy: u.uid,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
  await rebuildAccess(u.uid);

  if (opts.includeSampleTemplates) {
    onProgress('Örnek dilekçe şablonları hazırlanıyor…');
    await seedTemplate(
      'genel-dilekce',
      {
        name: 'Genel Dilekçe (Kol Geneli)',
        description: 'Yönetim Kuruluna hitaben serbest metinli dilekçe.',
        category: 'Genel',
        scope: 'branch',
        unitIds: [],
        series: 'GEN',
      },
      {
        ...DEFAULT_BUILDER,
        subject: '{konu}',
        body: '{dilekce_metni}\n\nGereğinin yapılmasını arz ederim.',
      },
      [
        { name: 'Genel Sekreter', roleIds: ['genel-sekreter'], unitMode: 'branch', unitId: null },
        { name: 'Öğrenci Kolu Başkanı', roleIds: ['baskan', 'baskan-yardimcisi'], unitMode: 'branch', unitId: null },
      ],
    );
    await seedTemplate(
      'etkinlik-izin',
      {
        name: 'Etkinlik İzin Dilekçesi (Komite)',
        description: 'Komite/başkanlık etkinlikleri için izin talebi.',
        category: 'Etkinlik',
        scope: 'unit',
        unitIds: [],
        series: 'ETK',
      },
      { ...DEFAULT_BUILDER, subject: 'Etkinlik izni hk.' },
      [
        { name: 'Birim Başkanı', roleIds: ['birim-baskani', 'birim-baskan-yardimcisi'], unitMode: 'petition', unitId: null },
        { name: 'Genel Sekreter', roleIds: ['genel-sekreter'], unitMode: 'branch', unitId: null },
        { name: 'Öğrenci Kolu Başkanı', roleIds: ['baskan', 'baskan-yardimcisi'], unitMode: 'branch', unitId: null },
      ],
    );
  }
  onProgress('Tamamlandı.');
}

async function seedTemplate(
  id: string,
  meta: Parameters<typeof createTemplate>[1],
  spec: typeof DEFAULT_BUILDER,
  steps: ApprovalStep[],
) {
  await createTemplate(id, meta);
  const { content } = await saveBuilderDraft(id, null, spec);
  const withSteps: TemplateContent = { ...content, steps };
  await saveDraftContent(id, withSteps);
  await publishTemplate(id, 'İlk sürüm (kurulum sihirbazı)');
}

export async function markSetupDone() {
  await setDoc(doc(db, 'settings', 'setup'), { done: true, at: serverTimestamp() });
}
