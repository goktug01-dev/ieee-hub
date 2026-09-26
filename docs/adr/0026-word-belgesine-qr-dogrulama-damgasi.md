# ADR-0026: Üretilen Word belgesine QR doğrulama damgası eklenir

- **Durum:** Kabul Edildi
- **Tarih:** 2026-09-26
- **Karar vericiler:** IEEE İKÇÜ TechOps
- **Onay kaydı:** Kullanıcı talebi, 2026-09-26
- **İlgili:** WP-12, ADR-0021

## Bağlam

Doğrulama kodunun yalnızca sistem kaydında bulunması, indirilen veya basılan belgenin onay durumunu görünür kılmaz. Belgeyi teslim alan kişi hızlı ve hatasız biçimde herkese açık doğrulama ekranına ulaşabilmelidir.

## Karar

Hub, doğrulama kodu atanmış her Word çıktısının sonuna evrak numarası, doğrulama kodu, durum metni ve doğrulama adresini taşıyan QR damgası ekler. Onaylı belgede “ELEKTRONİK OLARAK ONAYLANMIŞTIR” ifadesi kullanılır. QR, belgenin kendisine gömülü PNG'dir; harici görsel servisine bağlı değildir.

Bu damga 5070 sayılı Kanun kapsamında güvenli elektronik imza değildir. Doğruluğun kaynağı, QR ile açılan salt okunur Hub doğrulama kaydıdır.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Gömülü QR (seçilen) | Telefonla okunur; basılı belgede kalır; çevrim dışı üretilir | Belge boyutunu az miktarda artırır |
| Yalnız metin kodu | Basit | Elle giriş hatasına açıktır; görünürlüğü düşüktür |
| Barkod | Tarayıcılarla uyumlu | Uzun URL için QR kadar uygun değildir |

## Sonuçlar

**Olumlu:**
- Belgeyi alan kişi durum ve onay özetini doğrudan doğrulayabilir.
- Şablon yükleme ve sistem içi Word oluşturucu aynı damgayı kullanır.

**Olumsuz / maliyet:**
- QR, indirme/önizleme sırasında tarayıcıda yeniden üretilir.

**Riskler ve önlemler:**
- Damga tek başına güvenilmez; doğrulama ekranındaki evrak numarası ve durum karşılaştırılır.

## Uygulama notları

OOXML damgası `apps/hub/src/lib/docx.ts` içindeki `appendVerificationStamp` ile eklenir. QR hedefi kurum ayarındaki doğrulama taban adresi ve belge doğrulama kodundan oluşur.
