import { Timestamp } from 'firebase/firestore';
import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';
import { computeAccess } from '../lib/access';
import { DEFAULT_BUILDER, buildDocxFromSpec, inspectDocx, renderDocx } from '../lib/docx';
import { maskName, slugify } from '../lib/format';
import { computeVisibleTo, formatDocumentNo, newVerificationCode } from '../lib/petitions';
import type { Assignment, Role } from '../lib/types';

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

describe('evrak numarası', () => {
  it('varsayılan biçim', () => {
    expect(formatDocumentNo('{prefix}-{year}-{series}-{seq:4}', { prefix: 'IEEEIKCU', year: 2026, series: 'ETK', seq: 7 })).toBe(
      'IEEEIKCU-2026-ETK-0007',
    );
  });
  it('dolgusuz sıra', () => {
    expect(formatDocumentNo('{series}/{seq}', { prefix: '', year: 2026, series: 'GEN', seq: 12 })).toBe('GEN/12');
  });
});

describe('yardımcılar', () => {
  it('doğrulama kodu 12 karakter ve Crockford alfabesinde', () => {
    const c = newVerificationCode();
    expect(c).toMatch(/^[0-9A-HJKMNP-TV-Z]{12}$/);
  });
  it('ad maskeleme', () => {
    expect(maskName('Göktuğ Kocatürk')).toBe('Gö**** Ko******');
  });
  it('slug', () => {
    expect(slugify('Başkan Yardımcısı')).toBe('baskan-yardimcisi');
  });
});

describe('erişim özeti', () => {
  const roles: Record<string, Role> = {
    chair: { name: 'Başkan', scope: 'unit', permissions: ['unit.petitions.read'], active: true, order: 1 },
    gs: { name: 'GS', scope: 'branch', permissions: ['templates.manage', 'members.manage'], active: true, order: 2 },
    off: { name: 'Pasif', scope: 'branch', permissions: ['org.manage'], active: false, order: 3 },
  };
  const units = [
    { id: 'techops', name: 'TechOps', shortCode: 'TO', type: 'directorate' as const, parentId: null, active: true, order: 1 },
    { id: 'mevzuat', name: 'Mevzuat', shortCode: 'MA', type: 'department' as const, parentId: 'techops', active: true, order: 2 },
  ];
  const base = { memberName: 'x', roleName: 'x', unitName: 'x', termId: null, source: 'manual' as const, createdBy: 'x', createdAt: ts('2026-01-01') };

  it('birim rolü alt birimleri de görür, kol geneli izinler perms’e yazılır, süresi dolan atlanır', () => {
    const asg: Assignment[] = [
      { ...base, uid: 'u', roleId: 'chair', unitId: 'techops', startsAt: ts('2026-01-01'), endsAt: null, status: 'active' },
      { ...base, uid: 'u', roleId: 'gs', unitId: 'branch', startsAt: ts('2026-01-01'), endsAt: ts('2099-01-01'), status: 'active' },
      { ...base, uid: 'u', roleId: 'gs', unitId: 'branch', startsAt: ts('2020-01-01'), endsAt: ts('2021-01-01'), status: 'active' },
      { ...base, uid: 'u', roleId: 'off', unitId: 'branch', startsAt: ts('2026-01-01'), endsAt: null, status: 'active' },
    ];
    const a = computeAccess('u', asg, roles, units, Date.parse('2026-10-01'));
    expect(a.tokens).toEqual(expect.arrayContaining(['uid:u', 'role:techops__chair', 'unit:techops', 'unit:mevzuat', 'role:branch__gs']));
    expect(Object.keys(a.perms).sort()).toEqual(['members.manage', 'templates.manage']);
    expect(a.perms['org.manage']).toBeUndefined();
    expect(a.roleKeys['branch__gs'].toDate().getUTCFullYear()).toBe(2099);
  });

  it('dilekçe görünürlüğü zincirdeki roller için hesaplanır', () => {
    const v = computeVisibleTo('owner', 'cs', [
      { name: 'a', roleIds: ['chair', 'vice'], unitMode: 'petition', unitId: null },
      { name: 'b', roleIds: ['gs'], unitMode: 'branch', unitId: null },
      { name: 'c', roleIds: ['chair'], unitMode: 'fixed', unitId: 'techops' },
    ]);
    expect(v).toEqual(['uid:owner', 'unit:cs', 'role:cs__chair', 'role:cs__vice', 'role:branch__gs', 'role:techops__chair']);
  });
});

describe('Word şablon hattı', () => {
  it('oluşturucu → etiket algılama → doldurma', async () => {
    const buf = await buildDocxFromSpec({ ...DEFAULT_BUILDER, subject: '{konu}' });
    const info = inspectDocx(buf);
    expect(info.errors).toEqual([]);
    expect(info.fieldTags).toEqual(expect.arrayContaining(['konu', 'etkinlik_tarihi', 'etkinlik_yeri', 'etkinlik_adi', 'aciklama']));
    expect(info.reservedTags).toEqual(expect.arrayContaining(['evrak_no', 'tarih', 'dilekce_sahibi', 'onaylar']));

    const blob = renderDocx(buf, {
      konu: 'Etkinlik izni',
      etkinlik_adi: 'Yapay Zekâ Günü',
      etkinlik_tarihi: '12.10.2026',
      etkinlik_yeri: 'A Blok',
      aciklama: 'Satır 1\nSatır 2',
      evrak_no: 'IEEEIKCU-2026-ETK-0001',
      tarih: '24.09.2026',
      dilekce_sahibi: 'Ayşe Yılmaz',
      onaylar: [{ adim: 'Başkan', ad_soyad: 'Ali', unvan: 'Başkan', karar: 'Onayladı', onay_tarihi: '24.09.2026 10:00' }],
    });
    const xml = new PizZip(await blob.arrayBuffer()).file('word/document.xml')!.asText();
    expect(xml).toContain('IEEEIKCU-2026-ETK-0001');
    expect(xml).toContain('Yapay Zekâ Günü');
    expect(xml).toContain('Ayşe Yılmaz');
    expect(xml).not.toContain('{etkinlik_adi}');
  });
});
