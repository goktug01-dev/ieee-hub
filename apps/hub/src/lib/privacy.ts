import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { logAudit } from './audit';
import type { PolicyKind, PublicSettings } from './types';

/*
 * Herkese açık politika metinleri (KVKK aydınlatma, çerez, kullanım koşulları).
 * Taslaklar hukuki görüş yerine geçmez; köşeli parantezli alanlar kurum tarafından
 * doldurulmadan yayımlanamaz ve yayımlamadan önce hukuki danışmanla gözden geçirilmelidir.
 */

const RIGHTS = `Haklarınız
KVKK md. 11 uyarınca; kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini isteme, KVKK md. 7'deki şartlar çerçevesinde silinmesini veya yok edilmesini isteme, düzeltme ve silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme, münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuç ortaya çıkmasına itiraz etme ve kanuna aykırı işleme sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme haklarına sahipsiniz.

Başvuru yolu
Bu haklarınıza ilişkin taleplerinizi, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'e uygun olarak yazılı şekilde veya [BAŞVURU E-POSTA ADRESİ] adresine kayıtlı e-posta adresinizden iletebilirsiniz. Talepleriniz en geç otuz gün içinde ücretsiz olarak sonuçlandırılır.`;

const HOSTING = `Sistem Google LLC'nin Firebase hizmeti üzerinde çalışır ve veriler Avrupa Birliği'nde (Belçika) bulunan sunucularda saklanır. Bu yurt dışı aktarım KVKK md. 9 kapsamında [YURT DIŞI AKTARIM DAYANAĞI] kapsamında gerçekleştirilir.`;

const RECRUITMENT = `KİŞİSEL VERİLERİN KORUNMASI HAKKINDA AYDINLATMA METNİ
Komite ve Ekip Başvuruları

1. Veri sorumlusu
6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca kişisel verileriniz, veri sorumlusu sıfatıyla [VERİ SORUMLUSU UNVANI VE ADRESİ] tarafından aşağıda açıklanan kapsamda işlenmektedir.

2. İşlenen kişisel veriler
- Kimlik ve iletişim: ad soyad, e-posta adresi, telefon numarası
- Öğrenim ve üyelik: bölüm, öğrenci numarası, IEEE üye numarası (varsa)
- Başvuru içeriği: motivasyon yazısı, haftalık uygunluk, ilana özel soruların yanıtları
- Süreç kayıtları: başvuru tarihi, başvuru durumu, adaya iletilen karar notu
- Hesap bilgisi: giriş için kullandığınız Google veya e-posta hesabının kimliği

3. İşleme amaçları
- Başvurunuzun ilgili komite veya Yönetim Kurulu tarafından değerlendirilmesi
- Başvuru süreciyle ilgili sizinle iletişim kurulması
- Başvurunuzun kabul edilmesi hâlinde gönüllü kaydınızın oluşturulması ve oryantasyon sürecinin yürütülmesi
- Başvuru ve karar kayıtlarının hesap verebilirlik amacıyla saklanması

4. Hukuki sebep ve toplama yöntemi
Kişisel verileriniz, bu sayfadaki başvuru formu aracılığıyla elektronik ortamda sizden toplanır ve KVKK md. 5/2-(c) "bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması" ile md. 5/2-(f) "ilgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla veri sorumlusunun meşru menfaatleri için zorunlu olması" hukuki sebeplerine dayanılarak işlenir.

5. Aktarım
Başvurunuzu yalnızca başvurduğunuz birimin yöneticileri ve kolun organizasyon yöneticileri görebilir. Kişisel verileriniz başka üçüncü kişilerle paylaşılmaz; ancak yasal yükümlülük hâlinde yetkili kamu kurumlarına aktarılabilir.
${HOSTING}

6. Saklama süresi
Başvuru kayıtları başvurunun sonuçlandığı dönemin bitiminden itibaren [SAKLAMA SÜRESİ] süreyle saklanır; sürenin sonunda silinir, yok edilir veya anonim hâle getirilir.

7. ${RIGHTS}`;

const MEMBERS = `KİŞİSEL VERİLERİN KORUNMASI HAKKINDA AYDINLATMA METNİ
Hub Üyeleri ve Görevlileri

1. Veri sorumlusu
6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca kişisel verileriniz, veri sorumlusu sıfatıyla [VERİ SORUMLUSU UNVANI VE ADRESİ] tarafından aşağıda açıklanan kapsamda işlenmektedir.

2. İşlenen kişisel veriler
- Kimlik ve iletişim: ad soyad, e-posta adresi, profil bilgileri
- Görev bilgileri: birim üyelikleri, rol ve görev atamaları, görev süreleri
- İşlem kayıtları: dilekçe içerikleri ve onay adımları, görevler, etkinlik ve toplantı kayıtları, zimmet ve devir kayıtları
- Güvenlik kayıtları: kimin hangi işlemi ne zaman yaptığını gösteren denetim kayıtları
- Hesap bilgisi: giriş için kullandığınız Google veya e-posta hesabının kimliği

3. İşleme amaçları
- Öğrenci kolu faaliyetlerinin, dilekçe ve onay süreçlerinin tüzüğe uygun yürütülmesi
- Görev ve yetkilerin atanması, erişimin bu yetkilere göre sınırlandırılması
- Etkinlik, proje, bütçe ve raporlama süreçlerinin yürütülmesi
- Dönem devirlerinin ve kurumsal hafızanın sağlanması
- Hesap verebilirlik ve bilgi güvenliğinin sağlanması

4. Hukuki sebep ve toplama yöntemi
Kişisel verileriniz, Hub'a giriş yaptığınızda ve Hub'ı kullandıkça elektronik ortamda toplanır ve KVKK md. 5/2-(c) "bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması", md. 5/2-(ç) "veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi için zorunlu olması" ve md. 5/2-(f) "veri sorumlusunun meşru menfaatleri için zorunlu olması" hukuki sebeplerine dayanılarak işlenir.

5. Aktarım
Verileriniz Hub içinde yalnızca görevi gereği erişmesi gereken yetkililerle paylaşılır. Onaylanmış bir belgenin doğrulama sayfasında belge sahibinin adı maskelenerek gösterilir. Verileriniz yasal yükümlülük hâlinde yetkili kamu kurumlarına aktarılabilir.
${HOSTING}

6. Saklama süresi
Kayıtlar, üyeliğin veya görevin sona ermesinden itibaren [SAKLAMA SÜRESİ] süreyle saklanır; tüzük veya mevzuat gereği daha uzun saklanması gereken kayıtlar bu süre boyunca tutulur. Sürenin sonunda silinir, yok edilir veya anonim hâle getirilir.

7. ${RIGHTS}`;

const COOKIES = `ÇEREZ VE YEREL DEPOLAMA POLİTİKASI

1. Özet
Bu site reklam, pazarlama, analiz veya izleme amaçlı çerez kullanmaz ve ziyaretçileri başka sitelerde takip etmez. Yalnızca sitenin çalışması için zorunlu olan tarayıcı depolaması kullanılır. Zorunlu depolama için KVKK ve Kişisel Verilerin Korunması Kurumu Çerez Uygulamaları Hakkında Rehber uyarınca açık rıza aranmaz; bu metin bilgilendirme amacıyla yayımlanır.

2. Kullanılan depolama alanları
- Oturum bilgisi (IndexedDB: firebaseLocalStorageDb): giriş yaptığınızda oturumunuzun açık kalmasını sağlar. Çıkış yaptığınızda silinir.
- Veri önbelleği (IndexedDB: Firestore önbelleği): sayfaların hızlı açılması ve gereksiz sunucu isteklerinin önlenmesi için görüntülediğiniz kayıtların bir kopyasını tarayıcınızda tutar.
- Tema tercihi (localStorage: mantine-color-scheme-value): açık veya koyu tema seçiminizi hatırlar.
- Birim seçimi (localStorage, yalnız Hub): Hub içinde son seçtiğiniz birimi hatırlar.

3. Üçüncü taraflar
"Google ile giriş" seçeneğini kullandığınızda açılan pencere Google'a aittir ve Google kendi çerezlerini kendi politikası kapsamında kullanır. Site Google Firebase üzerinde barındırılır; barındırma hizmeti güvenlik amacıyla teknik erişim kayıtları (IP adresi, zaman, istenen sayfa) tutabilir.

4. Depolamayı yönetme
Tarayıcınızın ayarlarından site verilerini dilediğiniz zaman silebilirsiniz. Zorunlu depolamayı engellemeniz hâlinde giriş yapamayabilir veya başvuru gönderemeyebilirsiniz.

5. İletişim
Sorularınız için [İLETİŞİM E-POSTA ADRESİ] adresine yazabilirsiniz.`;

const TERMS = `KULLANIM KOŞULLARI

1. Kapsam
Bu koşullar, [VERİ SORUMLUSU UNVANI VE ADRESİ] tarafından işletilen kariyer sayfası ve Hub uygulamasının ("Site") kullanımına uygulanır. Siteyi kullanarak bu koşulları kabul etmiş olursunuz.

2. Hesap
Başvuru veya Hub hesabınızın güvenliğinden siz sorumlusunuz. Hesabınızı başkasıyla paylaşmamalı, başka birinin adına işlem yapmamalısınız. Hesap yalnızca başvuru ve kol içi işlemler içindir; tek başına IEEE üyeliği oluşturmaz.

3. Doğru bilgi
Başvuru ve Hub işlemlerinde verdiğiniz bilgilerin doğru ve güncel olması gerekir. Gerçeğe aykırı bilgiyle yapılan başvurular değerlendirmeye alınmayabilir.

4. Yasaklanan kullanımlar
Siteyi hukuka aykırı amaçlarla kullanmak; güvenlik önlemlerini aşmaya, yetkiniz olmayan verilere erişmeye veya sistemi aksatmaya çalışmak; başkalarının kişisel verilerini izinsiz toplamak veya paylaşmak yasaktır. Bu tür kullanımlarda hesap askıya alınabilir.

5. İçerik
Sitedeki ilan, tüzük ve belgeler öğrenci koluna aittir; kaynak gösterilmeden ticari amaçla çoğaltılamaz. Başvuru içeriğiniz yalnızca değerlendirme amacıyla kullanılır.

6. Sorumluluk
Site gönüllüler tarafından sunulur ve kesintisiz çalışacağı garanti edilmez. Bakım veya teknik sorunlar nedeniyle erişim geçici olarak durabilir.

7. Kişisel veriler
Kişisel verilerinizin işlenmesine ilişkin bilgiler ilgili KVKK aydınlatma metinlerinde, tarayıcı depolamasına ilişkin bilgiler Çerez ve Yerel Depolama Politikası'nda yer alır.

8. Değişiklikler
Bu koşullar güncellenebilir; yürürlükteki sürüm ve yayım tarihi bu sayfada gösterilir.

9. İletişim
Sorularınız için [İLETİŞİM E-POSTA ADRESİ] adresine yazabilirsiniz.`;

export interface PolicyDefinition {
  kind: PolicyKind;
  /** settings/public üzerindeki yürürlükteki sürüm işaretçisi. */
  field: keyof Pick<PublicSettings, 'recruitmentPrivacyNoticeId' | 'memberPrivacyNoticeId' | 'cookiePolicyId' | 'termsId'>;
  label: string;
  defaultTitle: string;
  template: string;
  /** Kısa yol: /politika/{slug} */
  slug: string;
}

export const POLICIES: PolicyDefinition[] = [
  {
    kind: 'recruitment',
    field: 'recruitmentPrivacyNoticeId',
    label: 'KVKK — Başvurular',
    defaultTitle: 'KVKK Aydınlatma Metni — Komite ve Ekip Başvuruları',
    template: RECRUITMENT,
    slug: 'kvkk-basvuru',
  },
  {
    kind: 'members',
    field: 'memberPrivacyNoticeId',
    label: 'KVKK — Hub üyeleri',
    defaultTitle: 'KVKK Aydınlatma Metni — Hub Üyeleri ve Görevlileri',
    template: MEMBERS,
    slug: 'kvkk-uyeler',
  },
  {
    kind: 'cookies',
    field: 'cookiePolicyId',
    label: 'Çerez politikası',
    defaultTitle: 'Çerez ve Yerel Depolama Politikası',
    template: COOKIES,
    slug: 'cerez',
  },
  {
    kind: 'terms',
    field: 'termsId',
    label: 'Kullanım koşulları',
    defaultTitle: 'Kullanım Koşulları',
    template: TERMS,
    slug: 'kullanim-kosullari',
  },
];

export const policyByKind = (kind: PolicyKind) => POLICIES.find((policy) => policy.kind === kind)!;
export const policyBySlug = (slug: string) => POLICIES.find((policy) => policy.slug === slug) ?? null;

export const RECRUITMENT_PRIVACY_TEMPLATE = RECRUITMENT;

const PLACEHOLDER = /\[[A-ZÇĞİÖŞÜ0-9 -]{3,}\]/g;

/** Doldurulmamış [BÜYÜK HARF] yer tutucularını döndürür. */
export function privacyPlaceholders(body: string): string[] {
  return [...new Set(body.match(PLACEHOLDER) ?? [])];
}

/** Demo ve testler için yer tutucuları verilen değerle doldurur. */
export function fillPlaceholders(body: string, value: string): string {
  return body.replace(PLACEHOLDER, value);
}

export interface PrivacyNoticeInput {
  title: string;
  versionLabel: string;
  body: string;
}

export function validatePrivacyNotice(input: PrivacyNoticeInput): string | null {
  if (!input.title.trim() || input.title.trim().length > 200) return 'Başlık 1–200 karakter olmalıdır.';
  if (!input.versionLabel.trim() || input.versionLabel.trim().length > 60) return 'Sürüm etiketi 1–60 karakter olmalıdır.';
  if (input.body.trim().length < 200 || input.body.trim().length > 30000) return 'Metin 200–30.000 karakter olmalıdır.';
  const missing = privacyPlaceholders(input.body);
  if (missing.length) return `Doldurulmamış alanlar var: ${missing.join(', ')}`;
  return null;
}

/**
 * Yeni, değiştirilemez bir politika sürümü yayımlar ve settings/public işaretçisini ona çevirir.
 * Eski sürümler silinmez; başvurular onayladıkları sürümün kimliğini saklar.
 */
export async function publishPolicy(kind: PolicyKind, input: PrivacyNoticeInput): Promise<string> {
  const error = validatePrivacyNotice(input);
  if (error) throw new Error(error);
  const policy = policyByKind(kind);
  const id = crypto.randomUUID();
  const batch = writeBatch(db);
  batch.set(doc(db, 'privacyNotices', id), {
    kind,
    title: input.title.trim(),
    versionLabel: input.versionLabel.trim(),
    body: input.body.trim(),
    publishedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'settings', 'public'), { [policy.field]: id }, { merge: true });
  await batch.commit();
  await logAudit('policy.publish', `privacyNotices/${id}`, { kind, versionLabel: input.versionLabel.trim() });
  return id;
}

export const publishRecruitmentPrivacyNotice = (input: PrivacyNoticeInput) => publishPolicy('recruitment', input);
