import { describe, expect, it } from 'vitest';
import { statutoryCasesLink, statutoryTab } from '../lib/statutoryNavigation';
import { statutoryObligations, type ObligationSources } from '../lib/statutoryObligations';
import { DEFAULT_STATUTORY_POLICY } from '../lib/statuteCatalog';
import { Timestamp } from 'firebase/firestore';
import type { StatutoryPolicy } from '../lib/statutoryTypes';

describe('Tüzük süreç bağlantıları', () => {
  it('dosya, tür, kişi ve birim kimliğini URL alanı olarak güvenle taşır', () => {
    const url = new URL(statutoryCasesLink({ kind: 'appeal', caseId: 'a&sekme=takip', subjectUid: 'samet', unitId: 'cs' }), 'https://hub.example');
    expect(url.searchParams.get('sekme')).toBe('dosyalar');
    expect(url.searchParams.get('dosya')).toBe('a&sekme=takip');
    expect(url.searchParams.get('surec')).toBe('appeal');
    expect(url.searchParams.get('birim')).toBe('cs');
    expect(url.searchParams.get('uye')).toBe('samet');
  });
  it('bilinmeyen veya görünmeyen sekme boş ekran oluşturmaz', () => {
    expect(statutoryTab(new URLSearchParams('sekme=bilinmeyen'), true, true)).toBe('dosyalar');
    expect(statutoryTab(new URLSearchParams('sekme=takip'), false, false)).toBe('dosyalar');
    expect(statutoryTab(new URLSearchParams('sekme=ayarlar'), true, false)).toBe('dosyalar');
    expect(statutoryTab(new URLSearchParams('sekme=takip'), true, false)).toBe('takip');
  });
  it('yıllık kartlar kendi süreç türünü açar; aynı sayfaya boş bağlantı üretmez', () => {
    const sources = { events: [], units: [], assignments: [], meetings: [], projects: [], reports: [], handovers: [], assets: [], members: [], inventory: [], cases: [], term: { id: 'term', startsAt: Timestamp.fromMillis(1000), endsAt: Timestamp.fromMillis(100000) } } as unknown as ObligationSources;
    const policy = { ...DEFAULT_STATUTORY_POLICY, publishedBy: 'u', publishedAt: Timestamp.now() } as StatutoryPolicy;
    const annual = statutoryObligations(sources, policy, 50000).filter(item => item.id.startsWith('annual-'));
    expect(annual).toHaveLength(5);
    for (const item of annual) {
      const url = new URL(item.link, 'https://hub.example');
      expect(url.searchParams.get('sekme')).toBe('dosyalar');
      expect(url.searchParams.get('surec')).toBe(item.id.slice('annual-'.length));
    }
  });
});
