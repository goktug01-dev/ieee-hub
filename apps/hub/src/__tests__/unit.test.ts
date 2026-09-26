import { Timestamp } from 'firebase/firestore';
import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';
import { computeAccess } from '../lib/access';
import { DEFAULT_BUILDER, appendVerificationStamp, buildDocxFromSpec, inspectDocx, renderDocx } from '../lib/docx';
import { maskName, slugify } from '../lib/format';
import { vtoolsMissingFields, vtoolsPreparationRow } from '../lib/eventExports';
import { parseCsv, previewParticipantsCsv } from '../lib/heptacert';
import { classifyPetitionFile } from '../lib/petitionCategories';
import type { HubEvent } from '../lib/opsTypes';
import { computeVisibleTo, formatDocumentNo, newVerificationCode, stepRequiredApprovals } from '../lib/petitions';
import type { Assignment, Role } from '../lib/types';
import { DEFAULT_ORG_SETTINGS } from '../lib/workflow';
import { validateTemplateContent } from '../lib/templates';

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

describe('dilekçe kategorileri', () => {
  it('kurumsal klasör dosyalarını adından sınıflandırır', () => {
    expect(classifyPetitionFile('04_HARCAMA_BÜTÇE_TALEP_FORMU.docx')).toMatchObject({ category: 'Finans ve Harcama', series: 'HRC' });
    expect(classifyPetitionFile('07_YÖNETİM_KURULU_TOPLANTI_TUTANAĞI_FORMU.docx')).toMatchObject({ category: 'Yönetim Kurulu', series: 'YKK' });
    expect(classifyPetitionFile('12_YÖNETİM_KURULU_ATAMA_KARARNAMESİ.docx')).toMatchObject({ category: 'Atama ve Seçim', series: 'ATM' });
    expect(classifyPetitionFile('20_TECHOPS_STAJYER_ATAMA_TUTANAĞI.docx')).toMatchObject({ category: 'TechOps', series: 'TOP' });
  });
});

describe('şablon yayın doğrulaması', () => {
  it('alan etiketi bulunmayan Word belgesinin yayımlanmasını engeller', () => {
    const errors = validateTemplateContent({
      source: 'upload',
      fileName: 'etiketsiz.docx',
      sizeBytes: 100,
      chunkCount: 1,
      fields: [],
      steps: [{ name: 'Başkan onayı', roleIds: ['baskan'], unitMode: 'branch', unitId: null }],
      builder: null,
    });
    expect(errors).toContain('Word belgesinde doldurulabilir alan etiketi yok. Belgeye {alan_adi} biçiminde en az bir etiket ekleyin.');
  });
});

describe('HeptaCert CSV veri sözleşmesi', () => {
  it('virgül, noktalı virgül ve sekme ayracını algılar', () => {
    expect(parseCsv('A,B\n1,2')[1]).toEqual(['1', '2']);
    expect(parseCsv('A;B\n1;2')[1]).toEqual(['1', '2']);
    expect(parseCsv('A\tB\n1\t2')[1]).toEqual(['1', '2']);
  });

  it('HeptaCert başlık eş adlarını ve tekrarları doğrular', () => {
    const result = previewParticipantsCsv(
      'Participant Name;Email Address;Attendance;Certificate Code\nAyşe;ayse@example.org;checked in;C-1\nAyşe;AYSE@example.org;yes;C-1',
    );
    expect(result.sourceRows).toBe(2);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ name: 'Ayşe', email: 'ayse@example.org', attended: true, certificate: 'C-1' });
    expect(result.duplicates).toBe(1);
    expect(result.errors).toEqual([]);
  });
});

describe('vTools L31 hazırlık paketi', () => {
  const event = {
    code: 'EVT-2026-001',
    name: 'Yapay Zekâ Günü',
    description: 'Teknik etkinlik',
    unitId: 'cs',
    unitName: 'Computer Society',
    type: 'Teknik',
    startsAt: '2026-10-20T09:00:00.000Z',
    endsAt: '2026-10-20T11:00:00.000Z',
    location: 'Kültür Merkezi',
    report: { participantCount: 20, summary: 'Etkinlik özeti', outcomes: '', lessons: '' },
    registrationLink: '',
    heptacertLink: '',
    driveLink: '',
    vtools: {
      category: 'Technical', subcategory: '', locationType: 'physical', tags: '#AI', agenda: '',
      ieeeAttendees: 8, guestAttendees: 12, eventId: '', reportedAt: null, reportedBy: '',
    },
  } as HubEvent;
  const settings = {
    ...DEFAULT_ORG_SETTINGS,
    vtoolsOrganizationName: 'IEEE IKCU Student Branch',
    vtoolsSpoid: 'STB00000',
    vtoolsContactEmail: 'ieee@example.org',
  };

  it('zorunlu alanlar ve katılımcı toplamı tamken hazır kabul eder', () => {
    expect(vtoolsMissingFields(event, settings)).toEqual([]);
    const row = vtoolsPreparationRow(event, settings);
    expect(row).toContain('Europe/Istanbul');
    expect(row).toContain('12:00');
    expect(row).toContain('IEEE IKCU Student Branch');
  });

  it('IEEE ve misafir sayıları toplamını doğrular', () => {
    const broken = { ...event, vtools: { ...event.vtools!, guestAttendees: 11 } };
    expect(vtoolsMissingFields(broken, settings)).toContain('katılımcı toplamı uyuşmuyor');
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

  it('tek, tüm makamlar ve nisap için gerekli onay sayısını hesaplar', () => {
    const base = { name: 'YK', roleIds: ['a', 'b', 'c', 'd'], unitMode: 'branch' as const, unitId: null };
    expect(stepRequiredApprovals(base)).toBe(1);
    expect(stepRequiredApprovals({ ...base, approvalMode: 'all' })).toBe(4);
    expect(stepRequiredApprovals({ ...base, approvalMode: 'quorum', requiredApprovals: 3 })).toBe(3);
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

    const stamped = await appendVerificationStamp(blob, {
      url: 'https://hub.example/dogrula/ABCDEFGHJKMN',
      code: 'ABCDEFGHJKMN',
      documentNo: 'IEEEIKCU-2026-ETK-0001',
      status: 'Onaylandı',
      approved: true,
    });
    const stampedZip = new PizZip(await stamped.arrayBuffer());
    expect(stampedZip.file('word/document.xml')!.asText()).toContain('ELEKTRONİK OLARAK ONAYLANMIŞTIR');
    expect(stampedZip.file('word/document.xml')!.asText()).toContain('ABCDEFGHJKMN');
    expect(stampedZip.file('word/_rels/document.xml.rels')!.asText()).toContain('hub-verification-1.png');
    expect(stampedZip.file('word/media/hub-verification-1.png')).toBeTruthy();
  });
});
