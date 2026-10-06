import { Timestamp } from 'firebase/firestore';
import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';
import { computeAccess } from '../lib/access';
import { DEFAULT_BUILDER, appendVerificationStamp, buildDocxFromSpec, inspectDocx, renderDocx } from '../lib/docx';
import { maskName, slugify } from '../lib/format';
import { approvedEventsIcs, isApprovedCalendarEvent, vtoolsMissingFields, vtoolsPreparationRow } from '../lib/eventExports';
import { parseCsv, previewParticipantsCsv } from '../lib/heptacert';
import { classifyPetitionFile } from '../lib/petitionCategories';
import type { HubEvent, Meeting } from '../lib/opsTypes';
import { buildMeetingMinutes } from '../lib/meetingDocx';
import { externalPointUserIssues, parseExternalData, stringifyExternalData } from '../lib/externalFirebase';
import { computeVisibleTo, formatDocumentNo, newVerificationCode, stepRequiredApprovals } from '../lib/petitions';
import type { Assignment, Role } from '../lib/types';
import { DEFAULT_ORG_SETTINGS, applicantFields, responseFieldsForStep } from '../lib/workflow';
import { validateTemplateContent } from '../lib/templates';
import { validateStatuteFile } from '../lib/statutes';
import { applicationDocumentId, recruitmentCallIsOpen, validateRecruitmentCall } from '../lib/recruitment';
import { POLICIES, RECRUITMENT_PRIVACY_TEMPLATE, fillPlaceholders, privacyPlaceholders, validatePrivacyNotice } from '../lib/privacy';
import { MANUAL, MANUAL_AUDIENCES, manualFor, type ManualAudience } from '../lib/manual';
import { buildManualDocx } from '../lib/manualDocx';
import { normalizeRestrictionEmail, restrictionIsCurrent } from '../lib/eventRestrictions';
import { conflictingBookings, groupBookings, roomNow, slotEnded, slotId, slotRange, validateBookingRequest, weekStart, type Room, type RoomSlot } from '../lib/rooms';

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

describe('etkinlik kısıtlamaları', () => {
  it('e-postayı dönemler arası eşleşme için normalize eder', () => {
    expect(normalizeRestrictionEmail('  Kisi@Example.ORG ')).toBe('kisi@example.org');
  });

  it('süresi dolmuş indeksi etkin saymaz', () => {
    expect(restrictionIsCurrent({ expiresAt: ts('2026-10-01T00:00:00Z') }, Date.parse('2026-09-30T00:00:00Z'))).toBe(true);
    expect(restrictionIsCurrent({ expiresAt: ts('2026-10-01T00:00:00Z') }, Date.parse('2026-10-02T00:00:00Z'))).toBe(false);
  });
});

describe('dilekçe makam alanları', () => {
  const fields = [
    { key: 'konu', label: 'Konu', type: 'text' as const, required: true },
    { key: 'uygundur', label: 'Uygundur', type: 'checkbox' as const, required: false },
    { key: 'gerekce', label: 'Gerekçe', type: 'textarea' as const, required: false },
  ];
  const steps = [{ name: 'Denetleme Kurulu', roleIds: ['dk'], unitMode: 'branch' as const, unitId: null, responseFieldKeys: ['uygundur', 'gerekce'] }];

  it('başvuru sahibi ile karar makamının alanlarını ayırır', () => {
    expect(applicantFields(fields, steps).map((field) => field.key)).toEqual(['konu']);
    expect(responseFieldsForStep(fields, steps[0]).map((field) => field.key)).toEqual(['uygundur', 'gerekce']);
  });
});

describe('tüzük dosyası', () => {
  it('PDF ve Word kabul eder; farklı türü ve 4 MB üstünü reddeder', () => {
    expect(validateStatuteFile({ name: 'tuzuk.pdf', type: 'application/pdf', size: 1024 })).toBeNull();
    expect(validateStatuteFile({ name: 'tuzuk.docx', type: '', size: 1024 })).toBeNull();
    expect(validateStatuteFile({ name: 'tuzuk.txt', type: 'text/plain', size: 10 })).toContain('PDF');
    expect(validateStatuteFile({ name: 'buyuk.pdf', type: 'application/pdf', size: 5 * 1024 * 1024 })).toContain('4 MB');
  });
});

describe('başvuru ilanı yardımcıları', () => {
  const call = {
    unitId: 'cs', unitName: 'Computer Society', title: 'Güz ekip alımı', roleTitle: 'Gönüllü',
    summary: 'Teknik etkinliklerde birlikte çalışacak ekip arkadaşları arıyoruz.', description: '', expectations: '',
    capacity: 5, opensAt: ts('2026-09-01'), closesAt: ts('2026-10-01'), questions: [],
  };

  it('ilan tarihini ve tekil başvuru kimliğini belirler', () => {
    expect(recruitmentCallIsOpen({ ...call, status: 'open' }, new Date('2026-09-15').getTime())).toBe(true);
    expect(recruitmentCallIsOpen({ ...call, status: 'closed' }, new Date('2026-09-15').getTime())).toBe(false);
    expect(applicationDocumentId('ilan-1', 'uye-1')).toBe('ilan-1__uye-1');
  });

  it('hatalı tarih ve seçeneksiz özel soruyu reddeder', () => {
    expect(validateRecruitmentCall({ ...call, opensAt: call.closesAt, closesAt: call.opensAt })).toContain('bitişi');
    expect(validateRecruitmentCall({ ...call, questions: [{ id: 'q1', label: 'Alan', type: 'choice', required: true, options: ['Tek'] }] })).toContain('iki seçenek');
    expect(validateRecruitmentCall(call)).toBeNull();
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

  it('yalnız onaylanmış ve tarihli etkinlikleri iCalendar çıktısına alır', () => {
    const approved = { ...event, id: 'evt-1', status: 'approved' as const };
    const proposed = { ...event, id: 'evt-2', status: 'proposed' as const, name: 'Taslak' };
    expect(isApprovedCalendarEvent(approved)).toBe(true);
    expect(isApprovedCalendarEvent(proposed)).toBe(false);
    const ics = approvedEventsIcs([approved, proposed], 'https://hub.example');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:Yapay Zekâ Günü');
    expect(ics).toContain('URL:https://hub.example/etkinlikler/evt-1');
    expect(ics).not.toContain('Taslak');
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

describe('toplantı tutanağı ve harici veri', () => {
  it('yapılandırılmış toplantıyı Word tutanağına dönüştürür', async () => {
    const meeting: Meeting = {
      unitId: 'cs', unitName: 'Computer Society', title: 'Aylık toplantı', meetingNo: 'CS-2026-04',
      date: '2026-09-27', startTime: '19:00', endTime: '20:00', location: 'B-201', chairName: 'Ayşe', recorderName: 'Can',
      attendeeUids: ['u1'], attendeeNames: ['Zeynep Kaya'], guestAttendees: '',
      agenda: [{ id: 'a1', title: 'Etkinlik planı', notes: 'Salon ve konuşmacı görüşüldü.' }],
      decisions: [{ id: 'd1', number: 'CS-04/1', text: 'Salon başvurusu yapılacak.', vote: 'Oy birliği', responsible: 'Can', dueDate: '2026-10-01' }],
      generalNotes: '', nextMeetingDate: null, status: 'final', createdBy: 'u1', createdByName: 'Zeynep', createdAt: ts('2026-09-27'), updatedAt: ts('2026-09-27'),
    };
    const zip = new PizZip(await (await buildMeetingMinutes(meeting)).arrayBuffer());
    const xml = zip.file('word/document.xml')!.asText();
    expect(xml).toContain('TOPLANTI TUTANAĞI');
    expect(xml).toContain('Salon başvurusu yapılacak.');
    expect(xml).toContain('kesinleştirilmiştir');
  });

  it('Firestore zaman işaretlerini JSON düzenlemede türünü koruyarak taşır', () => {
    const original = { name: 'Üye', updatedAt: ts('2026-09-27T12:00:00Z') };
    const parsed = parseExternalData(stringifyExternalData(original));
    expect(parsed.updatedAt).toBeInstanceOf(Timestamp);
    expect((parsed.updatedAt as Timestamp).toDate().toISOString()).toBe('2026-09-27T12:00:00.000Z');
  });

  it('harici üyelik kaydındaki eksik ve eski alanları işaretler', () => {
    const raw = { name: 'Üye', lifetime_spend: 3 };
    const issues = externalPointUserIssues({
      id: 'u1', name: 'Üye', surname: '', email: '', phone: '', department: '', approved: false, kvkkConsent: false,
      technicalLocked: false, eventCount: 0, roleCount: 0, committeeCount: 0, points: 0, lifetimeEarned: 0, lifetimeSpent: 3, raw,
    });
    expect(issues).toEqual(expect.arrayContaining(['üyelik durumu eksik', 'güncel puan alanı eksik', 'eski harcama alanı kullanılıyor', 'KVKK onayı yok', 'e-posta eksik']));
  });
});

describe('KVKK aydınlatma metni', () => {
  it('doldurulmamış yer tutucu varken yayımlanamaz', () => {
    const input = { title: 'KVKK', versionLabel: 'v1', body: RECRUITMENT_PRIVACY_TEMPLATE };
    expect(privacyPlaceholders(RECRUITMENT_PRIVACY_TEMPLATE)).toContain('[SAKLAMA SÜRESİ]');
    expect(validatePrivacyNotice(input)).toContain('Doldurulmamış');
    expect(privacyPlaceholders(RECRUITMENT_PRIVACY_TEMPLATE)).toContain('[BAŞVURU E-POSTA ADRESİ]');
    const filled = fillPlaceholders(RECRUITMENT_PRIVACY_TEMPLATE, 'Doldurulmuş değer');
    expect(validatePrivacyNotice({ ...input, body: filled })).toBeNull();
    expect(validatePrivacyNotice({ ...input, body: 'kısa' })).toContain('200');
  });

  it('her politika taslağı doldurulunca yayımlanabilir ve benzersiz kısa yola sahiptir', () => {
    for (const policy of POLICIES) {
      expect(privacyPlaceholders(policy.template).length).toBeGreaterThan(0);
      expect(validatePrivacyNotice({ title: policy.defaultTitle, versionLabel: 'v1', body: fillPlaceholders(policy.template, 'x') })).toBeNull();
    }
    expect(new Set(POLICIES.map((policy) => policy.slug)).size).toBe(POLICIES.length);
    expect(new Set(POLICIES.map((policy) => policy.field)).size).toBe(POLICIES.length);
  });
});

describe('kullanma kılavuzu', () => {
  it('bölüm kimlikleri benzersiz, her kitlenin bölümü ve her bölümün adımı var', () => {
    expect(new Set(MANUAL.map((section) => section.id)).size).toBe(MANUAL.length);
    for (const audience of Object.keys(MANUAL_AUDIENCES) as ManualAudience[]) expect(manualFor(audience).length).toBeGreaterThan(3);
    for (const section of MANUAL) {
      expect(section.audiences.length).toBeGreaterThan(0);
      expect(section.steps.length).toBeGreaterThan(0);
    }
  });

  it('arama Türkçe büyük/küçük harf duyarsızdır', () => {
    expect(manualFor('all', 'İADE').some((section) => section.id === 'onaylar')).toBe(true);
    expect(manualFor('member', 'kvkk metni yayımlanmadan')).toHaveLength(0);
    expect(manualFor('admin', 'kvkk').some((section) => section.id === 'politikalar')).toBe(true);
  });

  it('Word belgesi üretilir', async () => {
    const blob = await buildManualDocx(['member', 'manager', 'admin'], 'IEEE İKÇÜ');
    expect(blob.size).toBeGreaterThan(5000);
  });
});

describe('oda rezervasyonu', () => {
  const room: Room & { id: string } = { id: 'oda', name: 'Kulüp Odası', location: '', note: '', openSlot: 16, closeSlot: 44, maxDaysAhead: 30, active: true };
  const slot = (date: string, n: number, groupId: string, unitId = 'cs'): RoomSlot & { id: string } => ({
    id: slotId('oda', date, n), roomId: 'oda', date, slot: n, groupId, unitId, unitName: unitId.toUpperCase(), kind: 'meeting',
    title: 'Toplantı', note: '', byUid: 'u1', byName: 'U1', createdAt: null,
  });
  // 6 Ekim 2026 Salı 14:10 (Türkiye) = 11:10 UTC
  const now = Date.parse('2026-10-06T11:10:00Z');

  it('dilim kimliği ve saat biçimi', () => {
    expect(slotId('oda', '2026-10-06', 9)).toBe('oda_2026-10-06_09');
    expect(slotRange(20, 24)).toBe('10:00–12:00');
    expect(slotRange(43, 48)).toBe('21:30–24:00');
  });

  it('oda saati tarayıcının saat diliminden bağımsızdır (UTC+3)', () => {
    expect(roomNow(now)).toEqual({ date: '2026-10-06', slot: 28 });
    expect(roomNow(Date.parse('2026-10-06T21:30:00Z'))).toEqual({ date: '2026-10-07', slot: 1 });
    expect(slotEnded('2026-10-06', 27, now)).toBe(true);
    expect(slotEnded('2026-10-06', 28, now)).toBe(false); // içinde bulunulan dilim henüz bitmedi
    expect(slotEnded('2026-10-05', 40, now)).toBe(true);
    expect(weekStart('2026-10-06')).toBe('2026-10-05');
    expect(weekStart('2026-10-11')).toBe('2026-10-05');
  });

  it('dilimler rezervasyona birleşir; iptalle bölünen grup ayrı gösterilir', () => {
    const bookings = groupBookings([
      slot('2026-10-07', 21, 'a'), slot('2026-10-07', 20, 'a'), slot('2026-10-07', 23, 'a'),
      slot('2026-10-07', 22, 'b', 'ras'), slot('2026-10-08', 20, 'a'),
    ]);
    expect(bookings.map((b) => [b.date, b.startSlot, b.endSlot, b.groupId])).toEqual([
      ['2026-10-07', 20, 22, 'a'], ['2026-10-07', 22, 23, 'b'], ['2026-10-07', 23, 24, 'a'], ['2026-10-08', 20, 21, 'a'],
    ]);
    expect(conflictingBookings(bookings, 'oda', '2026-10-07', 22, 23).map((b) => b.groupId)).toEqual(['b']);
    expect(conflictingBookings(bookings, 'oda', '2026-10-07', 24, 26)).toEqual([]); // bitişik aralık çakışmaz
    expect(conflictingBookings(bookings, 'oda', '2026-10-07', 16, 30)).toHaveLength(3);
    expect(conflictingBookings(bookings, 'baska', '2026-10-07', 16, 30)).toEqual([]);
  });

  it('istek sınırları: oda saatleri, geçmiş ve ileri tarih', () => {
    const check = (date: string, startSlot: number, endSlot: number, r = room) => validateBookingRequest({ room: r, date, startSlot, endSlot }, now);
    expect(check('2026-10-06', 28, 30)).toBeNull();
    expect(check('2026-10-06', 27, 30)).toMatch(/Geçmiş/);
    expect(check('2026-10-07', 14, 18)).toMatch(/08:00–22:00/);
    expect(check('2026-10-07', 42, 46)).toMatch(/08:00–22:00/);
    expect(check('2026-10-07', 22, 22)).toMatch(/Bitiş/);
    expect(check('2026-11-04', 20, 22)).toBeNull(); // 29 gün sonrası
    expect(check('2026-11-05', 20, 22)).toMatch(/30 gün/);
    expect(check('2026-10-07', 20, 22, { ...room, active: false })).toMatch(/kapalı/);
  });
});
