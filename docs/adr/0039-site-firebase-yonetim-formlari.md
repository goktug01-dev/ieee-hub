# ADR-0039: Site Firebase yönetim formları

- Durum: Yerini Aldı ([ADR-0040](0040-hub-site-otomasyonu-ve-actor-dogrulamasi.md))
- Tarih: 2026-10-03

ADR-0027’deki ikincil oturum korunur. Komite, duyuru, etkinlik, teknik etkinlik ve komite QR kayıtları mevcut site RTDB yollarına doğrudan yazılır; Hub’a kopyalanmaz. Hazır görünümler arayüzden eklenir ve yolları düzenlenebilir. Komite kimlikleri siteye aittir; Hub birimleriyle otomatik eşleme yapılmaz.

QR bağlantı şablonu görünüm ayarında tutulur; `{qrId}` ve `{committeeId}` URL kodlanarak doldurulur. Kullanıcının verdiği URL biçimi `https://studentbranches.ieee.org/tr-ikcu/profile/?qr_id={qrId}` varsayılanıdır. Komite QR kaydı ve yapılandırılabilir `valid_qrs` dizinindeki aynı kimlikli kayıt oluşturma, güncelleme ve silmede tek atomik güncellemeyle eşlenir. Site tarayıcısının gerçek veri şeması ve QR tüketim davranışı canlıda ayrıca doğrulanmalıdır. Bu değişiklik QR okutma veya puan kazanma algoritmasını değiştirmez.

Uzak kurallar `firebase/site.database.rules.json` dosyasında, kullanıcının sağladığı kök `site_firebase_rules.json` ile aynı içerikte tutulur. Dağıtım Hub projesinin varsayılan deploy komutuna eklenmez. Site kuralları ayrı RTDB emülatöründe `npx firebase emulators:exec --config firebase/site-emulators.json --only database --project demo-ieee-site "npm test -w firebase -- --run tests/site.database.test.ts"` ile denenir.

Başkanların mevcut kaydı başka komiteye taşıyarak sahiplenmesi engellenir; yazar kimliği düzenlemelerde korunur. `valid_qrs` yazma yetkisi kayıt seviyesinde değerlendirilir. Boş sıralama RTDB’nin boş nesneleri silme davranışını destekler. Puan denetim kayıtları yalnız admin tarafından oluşturulur ve değiştirilemez.

Eski kullanıcı puan yazma ve QR tüketim yetkileri korunmuştur. Bunların uçtan uca güvenliğini değerlendirmek için site tarayıcı kodu gerekir; mevcut şema tek başına okutma, tekrar kullanım ve puan tutarlılığını doğrulamaya yeterli değildir.
