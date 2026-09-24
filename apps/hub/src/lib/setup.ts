/**
 * İlk kurulum: kurucu yönetici + varsayılan organizasyon.
 * Buradaki her şey kurulumdan sonra arayüzden düzenlenebilir.
 */
import { Timestamp, doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { rebuildAccess } from './access';
import { DEFAULT_BUILDER } from './docx';
import { PERMISSIONS } from './permissions';
import { DEFAULT_ORG_SETTINGS } from './petitions';
import { createTemplate, publishTemplate, saveBuilderDraft, saveDraftContent } from './templates';
import type { ApprovalStep, Role, TemplateContent, Unit } from './types';
import { BRANCH } from './types';

export const DEFAULT_ROLES: Record<string, Role> = {
  baskan: {
    name: 'Öğrenci Kolu Başkanı',
    scope: 'branch',
    description: 'Nihai onay makamı. Tüm yönetim yetkilerine sahiptir.',
    permissions: PERMISSIONS.filter((p) => p.scope === 'branch').map((p) => p.id),
    active: true,
    order: 1,
  },
  'baskan-yardimcisi': {
    name: 'Başkan Yardımcısı',
    scope: 'branch',
    description: 'Başkanın ikamesi.',
    permissions: ['members.manage', 'petitions.readAll', 'events.approve', 'sponsors.read', 'reports.read', 'work.manageAll'],
    active: true,
    order: 2,
  },
  'genel-sekreter': {
    name: 'Genel Sekreter',
    scope: 'branch',
    description: 'Evrak, dilekçe süreci, üyelik, görev kayıtları, raporlar ve devir.',
    permissions: [
      'members.manage',
      'assignments.manage',
      'elections.manage',
      'templates.manage',
      'petitions.readAll',
      'work.manageAll',
      'events.approve',
      'events.manageAll',
      'reports.read',
      'reports.approve',
      'handover.manage',
      'audit.read',
    ],
    active: true,
    order: 3,
  },
  sayman: {
    name: 'Sayman',
    scope: 'branch',
    description: 'Finansal kayıtlar, bütçeler ve harcama dilekçeleri.',
    permissions: ['petitions.readAll', 'finance.read', 'finance.manage', 'sponsors.read', 'reports.read'],
    active: true,
    order: 4,
  },
  'yk-uyesi': {
    name: 'YK Üyesi',
    scope: 'branch',
    description: 'Yönetim Kurulu üyesi.',
    permissions: ['reports.read'],
    active: true,
    order: 5,
  },
  'kol-koordinasyon-uyesi': {
    name: 'Kol Koordinasyon Üyesi',
    scope: 'branch',
    description: 'Öğrenci Kolu genelinde koordinasyon görevi.',
    permissions: ['work.manageAll'],
    active: true,
    order: 6,
  },
  'iletisim-sorumlusu': {
    name: 'İletişim Sorumlusu',
    scope: 'branch',
    description: 'İçerik taleplerini ve yayın takvimini yönetir.',
    permissions: ['content.manage'],
    active: true,
    order: 7,
  },
  'sponsorluk-sorumlusu': {
    name: 'Sponsorluk Sorumlusu',
    scope: 'branch',
    description: 'Sponsor havuzunu, görüşmeleri ve sponsor kilitlerini yönetir.',
    permissions: ['sponsors.read', 'sponsors.manage'],
    active: true,
    order: 8,
  },
  'sistem-sorumlusu': {
    name: 'Sistem Sorumlusu (TechOps)',
    scope: 'branch',
    description: 'Sistem, erişim, veri ve risk envanteri; destek talepleri.',
    permissions: ['inventory.manage', 'audit.read'],
    active: true,
    order: 9,
  },
  danisman: {
    name: 'Akademik Danışman',
    scope: 'branch',
    description: 'Öğrenci Kolu danışmanı; şablonda tanımlıysa dilekçe onaylar.',
    permissions: ['petitions.readAll', 'finance.read', 'reports.read', 'audit.read'],
    active: true,
    order: 10,
  },
  'birim-baskani': {
    name: 'Başkan',
    scope: 'unit',
    description: 'Komite / başkanlık başkanı. Birim dilekçelerinin ilk onay makamı, birimin görev ve etkinliklerini yönetir.',
    permissions: ['unit.manage', 'unit.tasks.manage', 'unit.events.propose', 'unit.petitions.read'],
    active: true,
    order: 20,
  },
  'birim-baskan-yardimcisi': {
    name: 'Başkan Yardımcısı',
    scope: 'unit',
    description: 'Birim başkanının ikamesi.',
    permissions: ['unit.manage', 'unit.tasks.manage', 'unit.events.propose', 'unit.petitions.read'],
    active: true,
    order: 21,
  },
  'koordinasyon-uyesi': {
    name: 'Koordinasyon Üyesi',
    scope: 'unit',
    description: 'Birim içinde görev oluşturur ve atar, etkinlik önerir, içerik talep eder.',
    permissions: ['unit.tasks.manage', 'unit.events.propose'],
    active: true,
    order: 22,
  },
  gonullu: {
    name: 'Gönüllü',
    scope: 'unit',
    description: 'Birim gönüllüsü. Birimin görevlerini görür, kendine atanan görevleri günceller.',
    permissions: [],
    active: true,
    order: 23,
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
