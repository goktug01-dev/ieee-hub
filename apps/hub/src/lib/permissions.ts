/**
 * İzin kataloğu. Roller ve rollerin izinleri Hub arayüzünden düzenlenir (docs/adr/0019);
 * izinlerin kendisi (neyi açtıkları) Firestore kurallarında sabittir. Buraya yeni izin eklemek,
 * firebase/firestore.rules dosyasında karşılığını yazmayı gerektirir.
 */
export type PermissionId =
  | 'org.manage'
  | 'members.manage'
  | 'assignments.manage'
  | 'elections.manage'
  | 'templates.manage'
  | 'petitions.readAll'
  | 'audit.read'
  | 'unit.petitions.read';

export interface PermissionDef {
  id: PermissionId;
  label: string;
  description: string;
  /** branch: kol geneli yetki. unit: rolün atandığı birimde (ve alt birimlerinde) geçerli. */
  scope: 'branch' | 'unit';
  critical?: boolean;
}

export const PERMISSIONS: PermissionDef[] = [
  {
    id: 'org.manage',
    label: 'Organizasyonu yönet',
    description: 'Birimler, roller, dönemler ve kurum ayarlarını düzenler.',
    scope: 'branch',
    critical: true,
  },
  {
    id: 'members.manage',
    label: 'Üyeleri yönet',
    description: 'Üyelik başvurularını onaylar, üyeliği askıya alır.',
    scope: 'branch',
  },
  {
    id: 'assignments.manage',
    label: 'Görev atamalarını yönet',
    description: 'Kişilere rol atar, görevleri sonlandırır, erişimleri yeniden hesaplar.',
    scope: 'branch',
    critical: true,
  },
  {
    id: 'elections.manage',
    label: 'Seçimleri yönet',
    description: 'Seçim kaydı oluşturur, adayları ve sonuçları girer.',
    scope: 'branch',
  },
  {
    id: 'templates.manage',
    label: 'Dilekçe şablonlarını yönet',
    description: 'Word şablonu yükler, sistemde şablon oluşturur, onay zincirini tanımlar ve sürüm yayımlar.',
    scope: 'branch',
  },
  {
    id: 'petitions.readAll',
    label: 'Tüm dilekçeleri gör (arşiv)',
    description: 'Kol genelindeki tüm dilekçeleri ve evrak arşivini görür.',
    scope: 'branch',
  },
  {
    id: 'audit.read',
    label: 'Denetim kaydını gör',
    description: 'Sistemde yapılan tüm yönetim işlemlerinin kaydını görür.',
    scope: 'branch',
  },
  {
    id: 'unit.petitions.read',
    label: 'Birimin dilekçelerini gör',
    description: 'Rolün atandığı birimin ve alt birimlerinin dilekçelerini görür.',
    scope: 'unit',
  },
];

export const PERMISSION_MAP = Object.fromEntries(PERMISSIONS.map((p) => [p.id, p])) as Record<
  PermissionId,
  PermissionDef
>;
