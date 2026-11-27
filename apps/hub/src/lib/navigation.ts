import {
  IconArrowsExchange, IconBallpen, IconBan, IconBook2, IconBriefcase2,
  IconBuildingCommunity, IconBuildingStore, IconCalendarEvent, IconCalendarStar,
  IconChartBar, IconChecklist, IconCoin, IconDatabaseCog, IconDoor, IconFilePlus,
  IconFileText, IconGavel, IconHeartHandshake, IconHistory, IconHome,
  IconLifebuoy, IconListCheck, IconNotebook, IconPackage, IconServer,
  IconSettings, IconShieldLock, IconSitemap, IconSpeakerphone, IconTemplate, IconUserCircle,
  IconUsers, IconUsersGroup, IconUserShield,
} from '@tabler/icons-react';
import { hasPermission, unitsWithPermission } from './access';
import { siteQrController } from './siteWorkflow';
import type { Access } from './types';

export interface HubNavItem {
  to: string;
  label: string;
  description: string;
  icon: typeof IconHome;
  keywords?: string;
  badge?: number;
  exact?: boolean;
  /** Oluşturma ve profil bağlantıları aramada bulunur; menüyü tekrarlamaz. */
  searchOnly?: boolean;
}

export interface HubNavSection {
  id: string;
  label: string;
  icon: typeof IconHome;
  items: HubNavItem[];
}

/** Menü ve işlem araması aynı izinlere ve aynı adres kataloğuna dayanır. */
export function hubNavigation(access: Access | null, unitId: string | null, waiting = 0): HubNavSection[] {
  const can = (permission: string) => hasPermission(access, permission);
  const manager = unitsWithPermission(access, 'unit.manage').length > 0;
  const any = (...permissions: string[]) => permissions.some(can);
  const sections: HubNavSection[] = [
    {
      id: 'daily', label: 'Günlük işler', icon: IconHome,
      items: [
        { to: '/', label: 'Ana sayfa', description: 'Kişisel işleriniz, bekleyen onaylar ve yaklaşan etkinlikler.', icon: IconHome, exact: true },
        ...(unitId ? [{ to: `/birimler/${unitId}`, label: 'Komite çalışma alanı', description: 'Seçili komitenin ekibi, işleri ve hızlı işlemleri.', icon: IconBuildingCommunity, keywords: 'komitem birim' }] : []),
        { to: '/onaylar', label: 'Onayımı bekleyenler', description: 'İmzanızı veya kararınızı bekleyen dilekçeler.', icon: IconChecklist, badge: waiting },
        { to: '/gorevler', label: 'Görevler ve projeler', description: 'Yapılacak işler, sorumlular, son tarihler ve proje panosu.', icon: IconListCheck, keywords: 'iş ata kanban yapılacak' },
      ],
    },
    {
      id: 'events', label: 'Etkinlik ve iletişim', icon: IconCalendarStar,
      items: [
        { to: '/etkinlikler', label: 'Etkinlikler', description: 'Etkinlik önerisi, onay, katılımcılar ve kapanış raporu.', icon: IconCalendarStar, keywords: 'takvim heptacert vtools puan qr' },
        { to: '/toplantilar', label: 'Toplantılar', description: 'Toplantı planı, gündem, yoklama ve tutanak.', icon: IconUsersGroup },
        { to: '/oda-rezervasyonu', label: 'Oda rezervasyonu', description: 'Oda takvimini inceleyin; yetkiniz varsa boş bir saat ayırın.', icon: IconDoor },
        { to: '/iletisim', label: 'İletişim', description: 'Afiş, sosyal medya, içerik talebi ve web sitesi duyuruları.', icon: IconSpeakerphone, keywords: 'yayın tasarım duyuru' },
        ...(siteQrController(access) ? [{ to: '/actor', label: 'ACTOR · Puan ve QR', description: 'Etkinlik katılım puanları ve QR doğrulaması.', icon: IconShieldLock }] : []),
      ],
    },
    {
      id: 'team', label: 'Ekip ve üyelik', icon: IconUsers,
      items: [
        { to: '/organizasyon', label: 'Organizasyon şeması', description: 'Hangi birimde kim görevli? Birimler ve görevli kişiler.', icon: IconSitemap },
        { to: '/kurullar', label: 'Kurullar ve karar defteri', description: 'Kurul üyeleri, gündemler, oylamalar ve karar kayıtları.', icon: IconGavel },
        { to: '/kariyer', label: 'Açık başvurular', description: 'Tarihli komite ve yönetim kurulu ilanlarını inceleyip başvurun.', icon: IconBriefcase2, keywords: 'kariyer ilan aday' },
        { to: '/gonulluluk', label: 'Gönüllülük', description: 'Hub üyelerinin birime gönüllü katılımı ve oryantasyonu.', icon: IconHeartHandshake, keywords: 'başvuru' },
        ...(manager || can('assignments.manage') ? [{ to: '/basvuru-yonetimi', label: 'Başvuru yönetimi', description: 'Kariyer ilanlarını açın ve ilanlara gelen adayları değerlendirin.', icon: IconUsersGroup }] : []),
        ...(can('members.manage') ? [
          { to: '/yonetim/uyeler', label: 'Üyeler', description: 'Hub üyeliği, üye onayları ve web sitesi üyeleri.', icon: IconUsers },
          { to: '/yonetim/etkinlik-kisitlamalari', label: 'Etkinlik kısıtlamaları', description: 'Üyelerin etkinlik katılım kısıtlamalarını yönetin.', icon: IconBan },
        ] : []),
        ...(can('assignments.manage') ? [{ to: '/yonetim/atamalar', label: 'Rol ve makam atamaları', description: 'Başkan, sekreter ve gönüllü gibi resmî görevleri kişilere atayın.', icon: IconUserShield, keywords: 'görev atamaları yetki' }] : []),
        ...(can('elections.manage') ? [{ to: '/yonetim/secimler', label: 'Seçimler', description: 'Adaylar, fiziksel oy sayımı ve seçim sonuçları.', icon: IconBallpen }] : []),
      ],
    },
    {
      id: 'records', label: 'Belgeler ve kaynaklar', icon: IconFileText,
      items: [
        { to: '/dilekceler', label: 'Dilekçeler', description: 'Dilekçelerinizi oluşturun, durumlarını ve onay geçmişini izleyin.', icon: IconFileText },
        { to: '/dilekceler/yeni', label: 'Yeni dilekçe', description: 'Şablon seçerek yeni bir dilekçe hazırlayın.', icon: IconFilePlus, searchOnly: true },
        { to: '/surecler', label: 'Tüzük süreçleri', description: 'Tüzüğe bağlı dosyalar, makam imzaları ve yıllık aktiflik.', icon: IconShieldLock },
        { to: '/tuzuk', label: 'Tüzük', description: 'Yayımlanan tüzük metnini okuyun ve önceki sürümleri indirin.', icon: IconBook2 },
        { to: '/sponsorluk', label: 'Sponsorluk', description: 'Firma havuzu, iletişim kilitleri ve sponsorluk görüşmeleri.', icon: IconBuildingStore },
        ...(any('inventory.manage', 'finance.read', 'finance.manage', 'secretary.ledger.manage', 'work.manageAll') ? [{ to: '/demirbas', label: 'Demirbaş ve zimmet', description: 'Fiziksel eşyalar, teslimler, konum ve hareket geçmişi.', icon: IconPackage, keywords: 'envanter ekipman malzeme' }] : []),
        ...(any('finance.read', 'finance.manage') || manager ? [{ to: '/butceler', label: 'Bütçeler', description: 'Birim bütçeleri, gelir, gider ve gerçekleşen harcamalar.', icon: IconCoin }] : []),
        ...(any('reports.read', 'reports.approve') ? [{ to: '/raporlar', label: 'Raporlar', description: 'Haftalık ve aylık özetler, veri kalitesi ve vTools raporları.', icon: IconChartBar }] : []),
        ...(can('secretary.ledger.manage') ? [{ to: '/sekreterlik-defteri', label: 'Sekreterlik defteri', description: 'Resmî evrak ve sekreterlik kayıtları.', icon: IconNotebook }] : []),
        { to: '/devir', label: 'Devir paketleri', description: 'Dönem sonunda görev, belge ve kurumsal hafızayı devredin.', icon: IconArrowsExchange },
      ],
    },
    {
      id: 'settings', label: 'Sistem yönetimi', icon: IconSettings,
      items: [
        ...(can('org.manage') ? [
          { to: '/yonetim/birimler', label: 'Komiteler ve birimler', description: 'Birim yapısını, adlarını ve bağlılıklarını düzenleyin.', icon: IconBuildingCommunity },
          { to: '/yonetim/roller', label: 'Roller ve yetkiler', description: 'Rol tanımları ve rollerin kullanabileceği izinler.', icon: IconShieldLock },
          { to: '/yonetim/donemler', label: 'Dönemler', description: 'Yönetim dönemleri ve başlangıç/bitiş tarihleri.', icon: IconCalendarEvent },
          { to: '/yonetim/ayarlar', label: 'Kurum ayarları', description: 'Kurum bilgileri, bildirim servisleri ve politikalar.', icon: IconSettings, keywords: 'mail eposta telefon bildirim kvkk logo' },
        ] : []),
        ...(can('templates.manage') ? [{ to: '/yonetim/sablonlar', label: 'Dilekçe şablonları', description: 'Word şablonları, form alanları ve onay zincirleri.', icon: IconTemplate }] : []),
        ...(can('inventory.manage') ? [{ to: '/yonetim/envanter', label: 'Dijital sistem envanteri', description: 'Yazılımlar, hesap erişimleri, veri envanteri ve teknik riskler.', icon: IconServer, keywords: 'techops kurtarma' }] : []),
        ...(can('external.firebase.manage') ? [{ to: '/yonetim/harici-firebase', label: 'Web sitesi bağlantısı', description: 'Studentbranches bağlantısı, komite eşlemesi ve site yetkileri.', icon: IconDatabaseCog, keywords: 'harici firebase entegrasyon site kurulum' }] : []),
        ...(can('audit.read') ? [{ to: '/yonetim/denetim', label: 'Denetim kaydı', description: 'Sistemde yapılan işlemlerin geçmişini inceleyin.', icon: IconHistory }] : []),
      ],
    },
    {
      id: 'support', label: 'Hesap ve destek', icon: IconLifebuoy,
      items: [
        { to: '/profil', label: 'Profilim ve görevlerim', description: 'Kişisel bilgiler, resmî görevler ve bildirim tercihleri.', icon: IconUserCircle, searchOnly: true },
        { to: '/yardim', label: 'Yardım ve destek', description: 'Kullanma kılavuzu, uygulama kurulumu ve sorun bildirimi.', icon: IconLifebuoy, searchOnly: true },
      ],
    },
  ];
  return sections.filter((section) => section.items.length > 0);
}

export function isHubNavActive(item: Pick<HubNavItem, 'to' | 'exact'>, pathname: string): boolean {
  return pathname === item.to || (!item.exact && pathname.startsWith(`${item.to}/`));
}

function searchText(value: string): string {
  return value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
}

export function searchHubNavigation(sections: HubNavSection[], query: string): HubNavSection[] {
  const words = searchText(query).trim().split(/\s+/).filter(Boolean);
  return sections.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      const text = searchText(`${section.label} ${item.label} ${item.description} ${item.keywords ?? ''}`);
      return words.every((word) => text.includes(word));
    }),
  })).filter((section) => section.items.length > 0);
}
