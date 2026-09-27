# ADR-0031: Komite başvuruları ayrı kariyer vitrini ve tarihli ilanlarla yürütülür

- **Durum:** Kabul Edildi
- **Tarih:** 2026-09-27
- **Karar vericiler:** Proje sahibi; TechOps
- **Onay kaydı:** Proje sahibinin 2026-09-27 tarihli talebi (komite/YK başvurularının Hub'dan açılması ve ayrı Firebase adresinden yapılması)
- **İlgili:** WP-04, WP-11, ADR-0017, ADR-0018, ADR-0027

## Bağlam

Standart IEEE İKÇÜ üyelik süreci başka bir Firebase projesinde yürür ve Hub bu kaydın sahibi değildir. Buna karşılık komiteler, Yönetim Kurulu ve proje ekipleri dönemsel gönüllü alımı yapmak; adaylara farklı sorular yöneltmek; başvuruları incelemek ve kabul edilen kişiyi kendi çalışma alanlarına almak zorundadır. Eski `volunteerApplications` akışı sürekli açık ve tek tiptir; ilan dönemi, vitrin ve özel soru desteği yoktur.

Spark planında Cloud Functions ve Cloud Storage bulunmadığından başvuru güvenliği Firestore Rules ile, dosyasız form verisi üzerinden sağlanmalıdır.

## Karar

1. Hub, komite/YK yöneticilerinin `recruitmentCalls` üzerinde taslak ilan oluşturduğu, başlangıç-bitiş tarihi, kontenjan, açıklama ve en fazla on özel soru belirlediği bir yönetim ekranı sunar.
2. Açık ilanlar aynı Firebase projesindeki ikinci Hosting sitesinde, `https://ieee-ikcu-kariyer.web.app` adresinde girişsiz görüntülenir. Firebase site kimliği nokta içeremediği için `career.ieee-ikcu.firebase.app` biçimi kullanılmaz. Kurumsal alan adı edinildiğinde örneğin `kariyer.ieeeikcu.org` bu siteye bağlanabilir.
3. Başvuru göndermek için Firebase Auth oturumu gerekir; başvuru sahibinin Hub'da aktif üyeliğe sahip olması gerekmez. Kariyer oturumu standart IEEE üyeliği oluşturmaz ve üyelik sürecinin yerine geçmez.
4. Her aday bir ilana yalnız bir kez başvurabilir. Belge kimliği `ilanId__uid` biçiminde deterministiktir. Aday başvurusunu geri çekebilir fakat içeriğini sonradan değiştiremez.
5. Birim yöneticisi yalnız kendi biriminin ilanını ve adaylarını yönetir; kol geneli atama yöneticisi tüm birimleri yönetebilir. Açık olmayan ilanlar kamuya görünmez.
6. Kabul kararı mevcut güvenli gönüllü rolü ve standart oryantasyon görevlerini oluşturur. Standart IEEE üyelik doğrulaması ayrı sistemde kalır; otomatik üyelik onayı yapılmaz.
7. Başvuruda dosya yüklenmez. Özgeçmiş/dosya ihtiyacı ileride güvenli ve bütçeli bir depolama kararıyla ayrıca ele alınır.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Aynı proje, ikinci Hosting sitesi (seçilen) | Sıfır ek maliyet; ortak Auth/Firestore; aday vitrini iç sistemden ayrılır | İki dağıtım hedefi; yeni alan adı Auth yetkili alanlarına eklenmelidir |
| Yalnız Hub içinde başvuru | En basit dağıtım | Aday deneyimi iç operasyon arayüzüne karışır; aktif Hub üyeliği engeli doğurur |
| Ayrı Firebase projesi | Tam izolasyon | Veri senkronu, ikinci kural seti ve kimlik eşleme yükü |
| Anonim form | Giriş sürtünmesi az | Spam, sahiplik doğrulaması ve güvenli durum takibi zayıf |

## Sonuçlar

**Olumlu:** Aday deneyimi sadeleşir; her komite geliştiriciye ihtiyaç duymadan kendi dönemsel alımını açar; yönetici yalnız yetkili olduğu birimin kişisel verisini görür; kabul mevcut görev/oryantasyon akışına bağlanır.

**Olumsuz / maliyet:** Google oturumunun ikinci Hosting alanında çalışması için alan adı Firebase Authentication “Authorized domains” listesinde bulunmalıdır. Dosya yükleme ve otomatik e-posta yoktur.

**Riskler ve önlemler:** Kişisel veri yalnız başvuru sahibi ve ilgili birim yöneticisine açıktır. Firestore Rules; ilan tarihini, tekil belge kimliğini, değiştirilemez başvuru içeriğini ve birim kapsamını doğrular. Aydınlatma/onay kutusu zorunludur. Saklama süresi ve veri silme talebi ayrıca yönetişim kararı gerektirir.

## Uygulama notları

- Aday vitrini: `apps/hub/src/pages/public/CareerPage.tsx`
- Yönetim: `apps/hub/src/pages/work/RecruitmentPage.tsx`
- İş mantığı: `apps/hub/src/lib/recruitment.ts`
- Koleksiyonlar: `recruitmentCalls`, `recruitmentApplications`
- Hosting hedefleri: `hub`, `career` (`firebase.json`, `.firebaserc`)
- Güvenlik: `firebase/firestore.rules`; test: `firebase/tests/modules.test.ts`
