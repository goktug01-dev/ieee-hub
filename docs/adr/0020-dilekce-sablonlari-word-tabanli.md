# ADR-0020: Dilekçe şablonları Word (.docx) tabanlıdır; yüklenir veya sistemde oluşturulur

- **Durum:** Kabul Edildi
- **Tarih:** 2026-09-24
- **Karar vericiler:** TechOps Başkanlığı
- **Onay kaydı:** Proje sahibinin 2026-09-24 tarihli talimatı ("mevcut dilekçe formatlarımız Word; hem yüklediğimiz formata göre hem de sistem üzerinden şablon oluşturabilmeliyiz"). YK karar numarası işlenecek.
- **Yerini aldığı kararlar:** [ADR-0011](0011-dilekce-sablonlari-kod-olarak.md)
- **İlgili:** AS-04, WP-12, ADR-0013, ADR-0017

## Bağlam

- AS-04 kısmen cevaplandı: Mevcut dilekçe formatları **Word** dosyalarıdır. Hem **kol geneli** hem **komite içi** dilekçeler vardır.
- ADR-0011 şablonları depoda JSON olarak tutmayı ve her değişikliği PR ile yapmayı öngörüyordu. Bu, Word formatlarının birebir korunmasını sağlamaz ve her değişiklik için geliştirici gerektirir.
- Spark planında Cloud Storage yoktur (ADR-0017).

## Karar

1. **Şablonun kaynağı bir .docx dosyasıdır.** İki yolla oluşur:
   - **Word yükle:** Kurumun mevcut dilekçesi Word'de açılır, doldurulacak yerlere `{alan_adi}` yazılır ve Hub'a sürükle-bırak ile yüklenir. Logo, yazı tipi, tablo ve sayfa düzeni **aynen korunur.**
   - **Sistemde oluştur:** Başlık satırları, hitap, konu, metin (içinde `{alan_adi}` etiketleriyle), kapanış ve isteğe bağlı bölümler (sayı/tarih satırı, onaylar tablosu, doğrulama alt bilgisi) formdan girilir; Hub bundan etiketli bir .docx üretir. Üretilen dosya indirilip Word'de düzenlenerek yeniden yüklenebilir.
2. Yükleme sırasında etiketler **otomatik algılanır** (docxtemplater) ve her biri bir form alanına dönüşür. Yönetici her alanın soru metnini, türünü (kısa/uzun metin, tarih, sayı, seçenek listesi, e-posta, telefon), zorunluluğunu, yardım metnini ve profilden otomatik doldurma kaynağını düzenler.
3. **Sistem etiketleri** Hub tarafından doldurulur: `{evrak_no}`, `{tarih}`, `{birim}`, `{dilekce_sahibi}`, `{kurum_adi}`, `{dogrulama_kodu}`, `{dogrulama_url}`, `{onay_durumu}`, adım bazlı `{onay_1_ad}` / `{onay_1_unvan}` / `{onay_1_tarih}` / `{onay_1_karar}` ve tekrar eden `{#onaylar}…{/onaylar}` bloğu (Word tablosunun satırı olarak da kullanılabilir).
4. Şablonun **kapsamı** `branch` (kol geneli) veya `unit` (komite/birim içi; isteğe bağlı olarak belirli birimlerle sınırlı) olur. Onay zinciri adımları ([ADR-0013](0013-dilekce-onay-akisi.md)) şablon editöründe tanımlanır: adım adı, onaylayabilecek roller ve birim ("dilekçenin birimi", "kol geneli" veya "belirli birim").
5. **Saklama:** Dosya, Firestore'da base64 parçalar hâlinde tutulur (parça ≤ 700 bin karakter; dosya ≤ 4 MB). Taslak: `petitionTemplates/{id}/draftChunks`; yayımlanmış sürüm: `petitionTemplates/{id}/versions/{v}/chunks`.
6. **Sürümleme:** "Yayımla" düğmesi taslağı yeni bir sürüm olarak dondurur. Yayımlanmış sürüm **değiştirilemez ve silinemez** (kurallarla). Her dilekçe oluşturulduğu sürüme sabitlenir; gönderimde onay zinciri o sürümden birebir kopyalanır. Önceki bir sürüm tek tıkla yeniden yürürlüğe alınabilir.
7. Teknik yayın ile kurumsal yürürlük ayrımı (ADR-0011 §4.6) korunur: şablonun "Kullanıma açık" anahtarı ayrıca kapatılabilir.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Word şablonu + etiket algılama + sistem içi oluşturucu (seçilen) | Mevcut formatlar birebir; teknik olmayan kişi yönetir; iki yol aynı hattan geçer | Word'ün her özelliği tarayıcı önizlemesinde birebir görünmeyebilir (indirilen .docx birebirdir) |
| Depoda sürümlü JSON (ADR-0011) | Kod incelemesi | Word biçimi kaybolur; her değişiklik geliştirici gerektirir |
| Google Docs şablonu + Apps Script | Tanıdık | Kişisel hesap bağımlılığı, veri Hub dışında |
| Yalnızca sistem içi oluşturucu | Basit | Mevcut kurumsal formatlar korunamaz |

## Sonuçlar

**Olumlu:** Genel Sekreterlik / Evrak Sorumlusu, geliştirici olmadan yeni dilekçe türü ekler. Kurumsal biçim korunur.

**Olumsuz:** Görsel (resim) etiketi yoktur (docxtemplater görsel modülü ücretlidir). QR kodu Hub'daki dilekçe sayfasında ve doğrulama sayfasında gösterilir; belgeye doğrulama bağlantısı ve kodu metin olarak basılır.

**Riskler:** Yanlış onay zinciri yanlış kişiye yetki verir. Önlemler: yayımlamadan önce zincir doğrulaması, örnek verili önizleme (onaylar tablosu dahil), yayımın denetim kaydına yazılması ve eski sürüme dönüş imkânı.
