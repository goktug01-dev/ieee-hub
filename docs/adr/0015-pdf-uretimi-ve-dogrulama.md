# ADR-0015: PDF sunucuda üretilir, QR ile doğrulanır

- **Durum:** Yerini Aldı ([ADR-0021](0021-belge-ciktisi-tarayicida-docx-ve-dogrulama.md))
- **Tarih:** 2026-09-22
- **Karar vericiler:** TechOps Başkanlığı
- **İlgili:** WP-12, ADR-0004, ADR-0012, ADR-0014, AS-12, AS-14

## Bağlam

Onaylanan dilekçenin kurumsal başlıklı (logo, Doküman No, Yayın Tarihi, Rev No, Sayfa x/y) bir PDF olarak üretilmesi, arşivlenmesi ve gerektiğinde harici kişilere verilmesi gerekir. PDF'i alan kişi, belgenin gerçekten Hub'da onaylandığını doğrulayabilmelidir.

## Karar

1. **Kütüphane:** `@react-pdf/renderer`. PDF düzeni `packages/pdf` içinde React bileşenleri olarak yazılır. Aynı bileşen:
   - Tarayıcıda taslak önizlemesi (**"TASLAK — GEÇERSİZ"** filigranı ile),
   - Sunucuda nihai PDF üretimi için kullanılır.
2. **Yazı tipi:** Türkçe karakterleri (İ, ı, ş, ğ, ü, ö, ç) eksiksiz destekleyen, açık lisanslı bir yazı tipi (Noto Sans, OFL) PDF'e gömülür.
3. **Üretim zamanı:** Dilekçe `approved` olduğunda bir Firestore tetikleyicisi PDF'i üretir. PDF, `gs://<bucket>/petitions/{petitionId}/{documentNo}_r{revision}.pdf` yoluna yazılır. Dosyanın SHA-256 değeri dilekçe dokümanına kaydedilir.
4. **Erişim:** Storage kuralları doğrudan istemci erişimini kapatır. İndirme için `getPetitionPdfUrl` callable'ı `petition.read` iznini kontrol eder ve **15 dakikalık** imzalı URL döndürür.
5. **Doğrulama:**
   - Dilekçe gönderildiğinde tahmin edilemez bir `verificationCode` üretilir (12 karakter, Crockford Base32, ~60 bit).
   - PDF altbilgisinde QR kodu ve kod metni bulunur: `https://<hub-alan-adı>/dogrula/<kod>` (AS-12).
   - Doğrulama sayfası kimlik doğrulaması istemez. Yalnızca `petitionVerifications/{kod}` dokümanını gösterir: evrak no, şablon adı, durum, maskelenmiş sahip adı, imzalar (ad, unvan, karar, tarih), içerik özeti ve PDF özeti. **Dilekçe içeriği gösterilmez.**
   - Kullanıcı elindeki PDF'i sayfaya sürükleyip bırakırsa, SHA-256 değeri **tarayıcıda** hesaplanır ve kayıtlı değerle karşılaştırılır. Dosya sunucuya gönderilmez.
6. **İmza bloğu:** Her onaylanan adım için: adım adı, ad-soyad, unvan (+ "adına" bilgisi), "Elektronik olarak onaylanmıştır", tarih-saat. El imzası görseli yoktur (AS-14).
7. **Arşiv kopyası:** Evrak Sorumlusu, onaylanan PDF'in Drive'daki `00_Yonetim_ve_Yonerge/Dilekceler/{dönem}` klasörüne kopyalanmasını tetikler. İlk dönemde bu işlem yarı otomatiktir (tek tıkla indir + Drive'a yükle kontrol listesi). Drive API ile tam otomasyon, kurumsal bir servis hesabı ve paylaşılan klasör yetkisi sağlandığında yapılır.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| @react-pdf/renderer, sunucu + tarayıcı (seçilen) | Tek bileşen iki yerde çalışır; hafiftir; Functions içinde çalışır | CSS'in tamamını desteklemez (düzen basit tutulur) |
| Puppeteer / headless Chrome ile HTML → PDF | Tam CSS desteği | Functions'da yüksek bellek ve soğuk başlangıç; maliyet |
| pdf-lib ile elle çizim | Düşük seviye kontrol | Düzen kodu uzun ve bakımı zor |
| Google Docs şablonu + Apps Script | Bildirge §6.10'da var | Apps Script hesap bağımlılığı, kotalar, Hub dışına veri çıkışı |

## Sonuçlar

**Olumlu:** Önizleme ile nihai çıktı birebir aynıdır. Harici kişiler belgeyi hesap açmadan doğrulayabilir.

**Olumsuz:** Kütüphane sürümü değişirse aynı veriden üretilen PDF'in baytları değişebilir. Bu nedenle bütünlüğün asıl dayanağı **içerik özetidir** (`contentHash`). PDF özeti ise yalnızca verilen belirli dosyayı tanımlar.

**Riskler:** Doğrulama sayfası kod tahmini için kötüye kullanılabilir. 60 bitlik rastgele kod tahmini pratikte imkânsız kılar. Ayrıca App Check ve Hosting önbelleği kullanılır. Doğrulama çıktısı maskelenmiş ve asgari veridir.

## Uygulama notları

- `packages/pdf/src/layouts/KurumsalV1.tsx`: Bildirge başlık tablosunun birebir düzeni. Logo varlıkları `packages/pdf/assets/` altında tutulur.
- PDF anlık görüntü testi: `fixtures/sample.json` ile üretilen PDF, sayfa görüntülerine dönüştürülür ve piksel karşılaştırması yapılır (CI).
- Fonksiyon bellek ayarı: 512 MiB ile başlanır, ölçülerek ayarlanır.
