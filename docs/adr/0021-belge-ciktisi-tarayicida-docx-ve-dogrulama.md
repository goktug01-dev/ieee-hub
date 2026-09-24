# ADR-0021: Belge çıktısı tarayıcıda üretilir (.docx + yazdır/PDF); doğrulama herkese açık kayıtla yapılır

- **Durum:** Kabul Edildi
- **Tarih:** 2026-09-24
- **Karar vericiler:** TechOps Başkanlığı
- **Yerini aldığı kararlar:** [ADR-0015](0015-pdf-uretimi-ve-dogrulama.md)
- **İlgili:** ADR-0014, ADR-0017, ADR-0020, AS-12, AS-14

## Bağlam

ADR-0015, PDF'in sunucuda üretilip Storage'da saklanmasını öngörüyordu. Spark planında sunucu ve Storage yoktur (ADR-0017). Şablonlar artık Word tabanlıdır (ADR-0020).

## Karar

1. Belge **her açılışta tarayıcıda** üretilir: şablon sürümünün .docx dosyası + dilekçe verisi + onaylar → doldurulmuş .docx. Dosya saklanmaz; aynı veriden her zaman aynı içerik üretilir.
2. Kullanıcı belgeyi:
   - Hub içinde **önizler** (docx-preview; sayfa görünümü),
   - **Word (.docx)** olarak indirir (birebir kurumsal biçim),
   - **Yazdır / PDF** düğmesiyle tarayıcının yazdırma penceresinden PDF'e kaydeder.
3. **Doğrulama:**
   - Gönderimde tahmin edilemez bir kod üretilir (12 karakter, Crockford Base32, ~60 bit).
   - `petitionVerifications/{kod}` kaydı herkese açık **tek doküman okuması** ile görülebilir, listelenemez. İçerik yoktur: evrak no, şablon adı, birim, durum, maskelenmiş sahip adı ve onaylar (ad, unvan, karar, zaman).
   - Kural, bu kaydın aynı batch'teki dilekçeyle **alan alan aynı** olmasını zorunlu kılar; bu nedenle kayıt sahte biçimde "onaylandı" gösterilemez.
   - Doğrulama sayfası: `/dogrula/{kod}` (giriş gerektirmez). Hub'daki dilekçe sayfası QR kodunu gösterir; belgeye `{dogrulama_url}` ve `{dogrulama_kodu}` basılır.
4. Onay ifadesi: "Elektronik olarak onaylanmıştır" (5070 sayılı Kanun kapsamında e-imza değildir; ADR-0012 §1 geçerlidir). El imzası görseli yoktur (AS-14).
5. Arşiv: Evrak Sorumlusu onaylanan belgeyi indirip Drive'daki dilekçe klasörüne yükler (yarı otomatik; ADR-0015 §7 ile aynı).

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Tarayıcıda .docx + yazdır/PDF (seçilen) | Ücretsiz, Word biçimi birebir, saklama maliyeti yok | PDF, kullanıcının tarayıcısının yazdırma motoruyla oluşur; PDF'in bayt özeti saklanmaz |
| Tarayıcıda doğrudan PDF üretimi (pdf-lib vb.) | Tutarlı PDF | Word düzenini PDF'e çevirmek tarayıcıda güvenilir değil |
| Sunucuda PDF (ADR-0015) | Güvenilir çıktı | Blaze gerektirir |

## Sonuçlar

**Olumlu:** Depolama kotası tüketilmez. Belge her zaman güncel onay durumunu yansıtır.

**Olumsuz:** "Elimdeki PDF'in baytları sistemdekiyle aynı mı?" kontrolü yapılamaz; doğrulama **içerik kaydı** (evrak no + onaylar) üzerinden yapılır. Bu, iç süreçler ve üniversiteye sunulan belgeler için yeterli kabul edilmiştir; ıslak/e-imza gereken belgelerde ADR-0012 §7 geçerlidir.
