import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { hubNavigation, isHubNavActive, searchHubNavigation } from '../lib/navigation';
import { roleChoiceLabel, sameNamedRoles } from '../lib/roleCatalog';
import { computeVisibleTo, stepRequiredApprovals } from '../lib/workflow';
import { eligibleRoles } from '../lib/inbox';
import { validateSteps } from '../lib/templates';
import type { Access, ApprovalStep, Petition, Role, WithId } from '../lib/types';

const expiry = Timestamp.fromDate(new Date('2100-01-01'));
const access: Access = { superAdmin: false, perms: {}, roleKeys: {}, tokens: ['uid:person'] };
const personal: ApprovalStep = { name: 'Kişisel imza', recipientMode: 'person', roleIds: [], unitMode: 'branch', unitId: null };

describe('işe göre gezinme', () => {
  it('yönetim ve puan işlemleri yalnız ilgili yetkilerle görünür', () => {
    const member = hubNavigation(access, null).flatMap((section) => section.items);
    expect(member.some((item) => item.to.startsWith('/yonetim/') || item.to === '/actor')).toBe(false);
    const manager = hubNavigation({ ...access, perms: { 'members.manage': expiry } }, 'cs').flatMap((section) => section.items);
    expect(manager.some((item) => item.to === '/yonetim/uyeler')).toBe(true);
    expect(manager.some((item) => item.to === '/yonetim/roller')).toBe(false);
    expect(manager.some((item) => item.to === '/birimler/cs')).toBe(true);
  });
  it('Türkçe/ASCII arama ve iş adları aynı kataloğa erişir; adresler tekildir', () => {
    const sections = hubNavigation({ ...access, superAdmin: true }, 'cs');
    const paths = sections.flatMap((section) => section.items.map((item) => item.to));
    expect(new Set(paths).size).toBe(paths.length);
    expect(searchHubNavigation(sections, 'uye onay').flatMap((section) => section.items).map((item) => item.to)).toContain('/yonetim/uyeler');
    expect(searchHubNavigation(sections, 'gorev ata').flatMap((section) => section.items).map((item) => item.to)).toContain('/gorevler');
    expect(searchHubNavigation(sections, 'dijital envanter').flatMap((section) => section.items).map((item) => item.to)).toEqual(['/yonetim/envanter']);
    expect(isHubNavActive({ to: '/dilekceler' }, '/dilekceler/yeni')).toBe(true);
    expect(isHubNavActive({ to: '/gorevler' }, '/gorevlerim')).toBe(false);
  });
});

describe('rol kataloğu', () => {
  const role = (id: string, name: string, scope: Role['scope'] = 'unit'): WithId<Role> => ({ id, name, scope, permissions: [], active: true, order: 1 });
  it('aynı ad/kapsam kopyalarını ayırır; kol geneli ve komite rolleri kopya sayılmaz', () => {
    const roles = [role('one', 'Başkan Yardımcısı'), role('two', '  BAŞKAN   YARDIMCISI  '), role('branch', 'Başkan Yardımcısı', 'branch')];
    expect(sameNamedRoles(roles[0], roles).map((item) => item.id)).toEqual(['one', 'two']);
    expect(roleChoiceLabel(roles[0], roles)).toBe('Başkan Yardımcısı · one');
    expect(roleChoiceLabel(roles[2], roles)).toBe('Başkan Yardımcısı');
  });
});

describe('kişiye imza', () => {
  const petition = { ownerUid: 'owner', status: 'pending', steps: [personal], unitId: 'branch', currentStep: 0, stepRecipients: { '0': 'person' }, stepApprovalRoleIds: [] } as unknown as Petition;
  it('rolü olmayan seçili kişi onaylar; sahip, farklı kişi ve tekrar onay engellenir', () => {
    expect(eligibleRoles(petition, null, 'person')).toEqual(['uid:person']);
    expect(eligibleRoles(petition, access, 'owner')).toEqual([]);
    expect(eligibleRoles(petition, access, 'other')).toEqual([]);
    expect(eligibleRoles({ ...petition, stepApprovalRoleIds: ['uid:person'] }, access, 'person')).toEqual([]);
    expect(computeVisibleTo('owner', 'branch', [personal], { '0': 'person' })).toContain('uid:person');
    expect(stepRequiredApprovals(personal)).toBe(1);
  });
  it('şablonda kişi ve makam adımları açıkça ayrılır', () => {
    expect(validateSteps([personal])).toEqual([]);
    expect(validateSteps([{ ...personal, roleIds: ['chair'] }])).not.toEqual([]);
    expect(validateSteps([{ ...personal, recipientMode: 'role' }])).not.toEqual([]);
    expect(validateSteps(Array(11).fill(personal))).not.toEqual([]);
  });
});
