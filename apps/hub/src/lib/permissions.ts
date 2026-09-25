/**
 * İzin kataloğu. Roller ve rollerin izinleri Hub arayüzünden düzenlenir (docs/adr/0019);
 * izinlerin kendisi (neyi açtıkları) Firestore kurallarında sabittir. Buraya yeni izin eklemek,
 * firebase/firestore.rules dosyasında karşılığını yazmayı gerektirir.
 */
export type PermissionId =
  // Kol geneli
  | 'org.manage'
  | 'members.manage'
  | 'assignments.manage'
  | 'elections.manage'
  | 'templates.manage'
  | 'petitions.readAll'
  | 'audit.read'
  | 'work.manageAll'
  | 'events.approve'
  | 'events.manageAll'
  | 'content.manage'
  | 'sponsors.read'
  | 'sponsors.manage'
  | 'finance.read'
  | 'finance.manage'
  | 'reports.read'
  | 'reports.approve'
  | 'secretary.ledger.manage'
  | 'inventory.manage'
  | 'handover.manage'
  // Birim kapsamlı
  | 'unit.petitions.read'
  | 'unit.manage'
  | 'unit.tasks.manage'
  | 'unit.events.propose';

export type PermissionGroup = 'Organizasyon' | 'Dilekçe' | 'Görev ve etkinlik' | 'İletişim' | 'Sponsorluk ve finans' | 'Raporlama ve denetim' | 'Birim içi';

export interface PermissionDef {
  id: PermissionId;
  label: string;
  description: string;
  /** branch: kol geneli yetki. unit: rolün atandığı birimde (ve alt birimlerinde) geçerli. */
  scope: 'branch' | 'unit';
  group: PermissionGroup;
  critical?: boolean;
}

export const PERMISSIONS: PermissionDef[] = [
  { id: 'org.manage', group: 'Organizasyon', scope: 'branch', critical: true, label: 'Organizasyonu yönet', description: 'Birimler, roller, dönemler ve kurum ayarlarını düzenler.' },
  { id: 'members.manage', group: 'Organizasyon', scope: 'branch', label: 'Üyeleri yönet', description: 'Üyelik başvurularını onaylar, üyeliği askıya alır, ayrılış işlemini yapar.' },
  { id: 'assignments.manage', group: 'Organizasyon', scope: 'branch', critical: true, label: 'Görev atamalarını yönet', description: 'Kişilere rol atar, görevleri sonlandırır, erişimleri yeniden hesaplar.' },
  { id: 'elections.manage', group: 'Organizasyon', scope: 'branch', label: 'Seçimleri yönet', description: 'Seçim kaydı oluşturur, adayları ve sonuçları girer.' },
  { id: 'handover.manage', group: 'Organizasyon', scope: 'branch', label: 'Devir paketlerini yönet', description: 'Tüm devir paketlerini görür ve kabul eder.' },

  { id: 'templates.manage', group: 'Dilekçe', scope: 'branch', label: 'Dilekçe şablonlarını yönet', description: 'Word şablonu yükler, sistemde şablon oluşturur, onay zincirini tanımlar ve sürüm yayımlar.' },
  { id: 'petitions.readAll', group: 'Dilekçe', scope: 'branch', label: 'Tüm dilekçeleri gör (arşiv)', description: 'Kol genelindeki tüm dilekçeleri ve evrak arşivini görür.' },

  { id: 'work.manageAll', group: 'Görev ve etkinlik', scope: 'branch', label: 'Tüm görev ve projeleri yönet', description: 'Tüm birimlerin görev ve projelerini görür ve düzenler.' },
  { id: 'events.approve', group: 'Görev ve etkinlik', scope: 'branch', label: 'Etkinlik önerilerini onayla', description: 'Etkinlik önerilerini onaylar veya reddeder.' },
  { id: 'events.manageAll', group: 'Görev ve etkinlik', scope: 'branch', label: 'Tüm etkinlikleri yönet', description: 'Tüm etkinlikleri ve katılımcı listelerini yönetir, etkinlik raporlarını onaylar.' },

  { id: 'content.manage', group: 'İletişim', scope: 'branch', label: 'İletişim taleplerini yönet', description: 'İçerik taleplerini kabul eder, sorumlu atar, yayın takvimini yönetir.' },

  { id: 'sponsors.read', group: 'Sponsorluk ve finans', scope: 'branch', label: 'Sponsor havuzunu gör', description: 'Sponsor havuzunu ve görüşme geçmişini görür.' },
  { id: 'sponsors.manage', group: 'Sponsorluk ve finans', scope: 'branch', label: 'Sponsorları yönet', description: 'Sponsor kaydı, aşama ve sorumlu atamasını yönetir; iletişim bilgilerini görür.' },
  { id: 'finance.read', group: 'Sponsorluk ve finans', scope: 'branch', label: 'Bütçeleri gör', description: 'Tüm bütçe özetlerini ve finansal belge bağlantılarını görür.' },
  { id: 'finance.manage', group: 'Sponsorluk ve finans', scope: 'branch', label: 'Bütçeleri yönet', description: 'Bütçe kaydı, planlanan ve gerçekleşen tutarları girer.' },

  { id: 'reports.read', group: 'Raporlama ve denetim', scope: 'branch', label: 'Raporları gör', description: 'Operasyon ve yönetim raporlarını, veri kalitesi uyarılarını görür.' },
  { id: 'reports.approve', group: 'Raporlama ve denetim', scope: 'branch', label: 'Raporları onayla', description: 'Rapor anlık görüntüsünü resmî olarak kabul eder ve arşivler.' },
  { id: 'secretary.ledger.manage', group: 'Raporlama ve denetim', scope: 'branch', label: 'Sekreterlik defterini yönet', description: 'Toplantı tutanağı, karar, gelen-giden evrak ve takip notlarını kaydeder.' },
  { id: 'audit.read', group: 'Raporlama ve denetim', scope: 'branch', label: 'Denetim kaydını gör', description: 'Sistemde yapılan tüm yönetim işlemlerinin kaydını görür.' },
  { id: 'inventory.manage', group: 'Raporlama ve denetim', scope: 'branch', label: 'Sistem envanterini yönet', description: 'Sistem, erişim, kişisel veri ve risk envanterini yönetir; sorun bildirimlerini görür.' },

  { id: 'unit.manage', group: 'Birim içi', scope: 'unit', label: 'Birimi yönet', description: 'Birimde görev, proje ve etkinlikleri yönetir; gönüllü başvurularını karara bağlar; içerik taleplerini onaylar.' },
  { id: 'unit.tasks.manage', group: 'Birim içi', scope: 'unit', label: 'Birimde görev oluştur', description: 'Birimde görev ve proje oluşturur, atar, düzenler.' },
  { id: 'unit.events.propose', group: 'Birim içi', scope: 'unit', label: 'Etkinlik öner ve içerik talep et', description: 'Birim adına etkinlik önerir ve iletişim birimine içerik talebi açar.' },
  { id: 'unit.petitions.read', group: 'Birim içi', scope: 'unit', label: 'Birimin dilekçelerini gör', description: 'Birimin ve alt birimlerinin dilekçelerini görür.' },
];

export const PERMISSION_MAP = Object.fromEntries(PERMISSIONS.map((p) => [p.id, p])) as Record<PermissionId, PermissionDef>;

export const UNIT_PERMISSIONS = PERMISSIONS.filter((p) => p.scope === 'unit').map((p) => p.id);
