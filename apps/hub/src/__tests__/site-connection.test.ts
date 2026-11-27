import { describe, expect, it } from 'vitest';
import { externalConfigIssues, siteCapabilityState, siteConnectionError } from '../lib/siteConnection';
import { parseVtoolsEventId } from '../lib/vtoolsGuide';

describe('site bağlantısı tanısı', () => {
  it('site yöneticiliği QR yetkisinin yerine geçmez', () => {
    const admin = { admin: true, grants: {} };
    expect(siteCapabilityState(admin, 'qr', 100)).toBe('missing');
    expect(siteCapabilityState(admin, 'calendar', 100)).toBe('allowed');
    expect(siteCapabilityState(admin, 'members', 100)).toBe('allowed');
  });
  it('bilinmeyen, eksik ve süresi dolmuş yetkiyi ayırır', () => {
    expect(siteCapabilityState(null, 'qr', 100)).toBe('unknown');
    expect(siteCapabilityState({ admin: false, grants: {} }, 'qr', 100)).toBe('missing');
    for (const qr of [0, 99, 100]) expect(siteCapabilityState({ admin: false, grants: { qr } }, 'qr', 100)).toBe('expired');
    expect(siteCapabilityState({ admin: false, grants: { qr: 101 } }, 'qr', 100)).toBe('allowed');
  });
  it('eksik giriş ayarını ve site hesabına özgü hatayı açıklar', () => {
    expect(externalConfigIssues(null)).toHaveLength(1);
    expect(externalConfigIssues({ apiKey: 'key', appId: 'app', projectId: 'site' })).toEqual(['Auth domain eksik.']);
    expect(siteConnectionError({ code: 'auth/invalid-credential' })).toContain('studentbranches');
    expect(siteConnectionError({ code: 'auth/unauthorized-domain' })).toContain('Authorized domains');
    expect(siteConnectionError({ code: 'PERMISSION_DENIED' })).toContain('yetki');
    expect(siteConnectionError({ code: 'auth/popup-blocked' })).toContain('açılır pencereye izin');
  });
});

describe('vTools resmî etkinlik kimliği', () => {
  it('sayısal kimliği veya resmî etkinlik adresini kabul eder', () => {
    expect(parseVtoolsEventId(' 123456 ')).toBe('123456');
    expect(parseVtoolsEventId('https://events.vtools.ieee.org/m/123456/?utm_source=hub')).toBe('123456');
  });
  it('benzer alan adı, ilgisiz sayfa ve geçersiz kimliği reddeder', () => {
    for (const value of ['', '0', '-1', '1.5', '123abc', 'https://events.vtools.ieee.org.evil.test/m/123', 'https://other.test/m/123', 'https://events.vtools.ieee.org/', 'javascript:alert(1)']) expect(parseVtoolsEventId(value)).toBeNull();
  });
});
