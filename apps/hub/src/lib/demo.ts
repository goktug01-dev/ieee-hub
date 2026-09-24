/**
 * Yalnızca emülatörde görünen demo hesapları (firebase/demo-data).
 * Gerçek projede bu hesaplar yoktur; giriş ekranı listeyi yalnızca emülatör modunda gösterir.
 */
export const DEMO_PASSWORD = 'demo1234';

export interface DemoAccount {
  key: string;
  email: string;
  name: string;
  description: string;
  roleId?: string;
  roleName?: string;
  unitId?: string;
  unitName?: string;
  department?: string;
  studentNo?: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    key: 'baskan',
    email: 'baskan@demo.ieee',
    name: 'Ayşe Yılmaz',
    description: 'Öğrenci Kolu Başkanı · kurucu yönetici (her şeyi düzenler)',
    roleId: 'baskan',
    roleName: 'Öğrenci Kolu Başkanı',
    unitId: 'branch',
    unitName: 'Kol Geneli',
  },
  {
    key: 'gs',
    email: 'gs@demo.ieee',
    name: 'Mehmet Demir',
    description: 'Genel Sekreter · şablonlar, üyeler, görevler, arşiv',
    roleId: 'genel-sekreter',
    roleName: 'Genel Sekreter',
    unitId: 'branch',
    unitName: 'Kol Geneli',
  },
  {
    key: 'cs',
    email: 'cs@demo.ieee',
    name: 'Zeynep Kaya',
    description: 'CS Komite Başkanı · komite dilekçelerini onaylar',
    roleId: 'birim-baskani',
    roleName: 'Başkan',
    unitId: 'cs',
    unitName: 'Computer Society',
  },
  {
    key: 'sayman',
    email: 'sayman@demo.ieee',
    name: 'Elif Şahin',
    description: 'Sayman',
    roleId: 'sayman',
    roleName: 'Sayman',
    unitId: 'branch',
    unitName: 'Kol Geneli',
  },
  {
    key: 'uye',
    email: 'uye@demo.ieee',
    name: 'Can Arslan',
    description: 'CS Koordinasyon Üyesi · dilekçe yazar',
    roleId: 'koordinasyon-uyesi',
    roleName: 'Koordinasyon Üyesi',
    unitId: 'cs',
    unitName: 'Computer Society',
    department: 'Bilgisayar Mühendisliği',
    studentNo: '220101042',
  },
  {
    key: 'gonullu',
    email: 'gonullu@demo.ieee',
    name: 'Deniz Öztürk',
    description: 'RAS Gönüllüsü',
    roleId: 'gonullu',
    roleName: 'Gönüllü',
    unitId: 'ras',
    unitName: 'Robotics and Automation Society',
  },
  {
    key: 'yeni',
    email: 'yeni@demo.ieee',
    name: 'Ali Çelik',
    description: 'Üyelik onayı bekleyen yeni kayıt',
  },
];
