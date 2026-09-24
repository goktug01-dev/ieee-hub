# ADR-0014: Evrak numarası gönderimde, sunucuda, seri bazlı atanır

- **Durum:** Önerildi
- **Tarih:** 2026-09-22
- **Karar vericiler:** TechOps Başkanlığı; onay: Yönetim Kurulu, Mevzuat ve Arşiv Yönetimi Departmanı
- **İlgili:** WP-12, AS-05, Bildirge Ek B


> **Uygulama notu (2026-09-24):** Numara sunucu yerine istemci transaction'ında hesaplanır; kurallar sayacın yalnızca ilk gönderimle aynı batch'te ve tam olarak +1 artmasını zorunlu kılar, böylece boşluksuzluk korunur. Yıl, UTC'ye göre alınır (31 Aralık gece yarısı civarında 3 saatlik fark kabul edildi). Biçim Kurum ayarlarından düzenlenir. Bkz. [ADR-0017](0017-ucretsiz-spark-plani-kurallar-tek-guvenilir-katman.md).

## Bağlam

Dilekçelerin resmî yazışmalarda ve arşivde referans verilebilmesi için benzersiz bir evrak numarası gerekir. Mevcut kurumsal belgelerde "IEEE/240826/SÜ/22" biçiminde bir numara kullanılmaktadır; bileşenlerinin anlamı henüz belgelenmemiştir (AS-05).

Ayrıca şu iki kavram birbirinden ayrılmalıdır:
- **Form kodu** (`formCode`): Şablonun kendi kimliğidir. PDF başlığındaki "Doküman No" alanına basılır ve aynı formdan üretilen her dilekçede aynıdır.
- **Evrak sayısı** (`documentNo`): Her dilekçeye özgüdür. Dilekçe metninin üst kısmında "Sayı:" olarak basılır.

## Karar

1. Evrak sayısı, dilekçe **ilk gönderildiğinde** (`draft` → `in_review`) atanır. Taslaklar numara almaz. İade sonrası yeniden gönderimde numara **değişmez.**
2. Varsayılan biçim (AS-05 cevaplanana kadar):

   ```
   IEEEIKCU-{YYYY}-{SERİ}-{NNNN}
   örn. IEEEIKCU-2026-ETK-0007
   ```

   - `YYYY`: Gönderimin takvim yılı (Europe/Istanbul)
   - `SERİ`: Şablonun `series` alanı (2–4 büyük harf)
   - `NNNN`: Yıl + seri bazında 1'den başlayan sıra numarası, 4 haneye tamamlanır

3. Biçim `config/numbering` dokümanında şablon dizesi olarak tutulur (`{prefix}-{year}-{series}-{seq:4}`). AS-05 cevabına göre kod değişikliği yapılmadan uyarlanabilir. Biçim değişikliği yalnızca **yeni yılın başında** yürürlüğe girer; bir yıl içinde karışık biçim oluşmaz.
4. Sayaç `counters/{YYYY}_{SERİ}` dokümanında tutulur ve yalnızca `submitPetition` fonksiyonunun transaction'ı içinde artırılır. Aynı transaction dilekçe durumunu da değiştirdiği için numara **boşluksuz** ilerler.
5. Reddedilen veya geri çekilen dilekçenin numarası **tekrar kullanılmaz.** Bu, evrak defteri uygulamasıyla uyumludur.
6. Hatalı numara düzeltmesi yalnızca GS tarafından, gerekçeyle yapılır (`petition.number.correct`). Eski numara `previousDocumentNos` alanında saklanır ve işlem denetim kaydına yazılır.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Gönderimde, sunucuda, yıl+seri sayaç (seçilen) | Boşluksuz, anlamlı, taslaklar numara tüketmez | Seri başına bir sayaç dokümanı; yazma hızı sınırı (saniyede ~1) bu ölçekte sorun değil |
| Onayda numara verme | Yalnızca onaylananlar numara alır | Süreçteki dilekçeye referans verilemez; evrak kaydı mantığına uymaz |
| Tek global sayaç | En basit | Seri bilgisi kaybolur |
| Rastgele kimlik | Çakışma yok | İnsan tarafından okunamaz, sıra bilgisi yok |

## Sonuçlar

**Olumlu:** Evrak numarası yılın ve dilekçe türünün bilgisini taşır. Drive arşivinde dosya adı olarak doğrudan kullanılabilir.

**Riskler:** AS-05 cevabı mevcut biçimin sürdürülmesini gerektirebilir. Biçim yapılandırılabilir olduğu için etkisi sınırlıdır.

## Uygulama notları

- `functions/src/petitions/numbering.ts`: `formatDocumentNo(pattern, { year, series, seq })` saf fonksiyonu, birim testleriyle birlikte.
- Yıl sınırı testi: 31 Aralık 23:59 ile 1 Ocak 00:00 (Europe/Istanbul) arasındaki gönderimler.
