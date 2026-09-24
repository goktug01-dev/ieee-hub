# ADR-0016: HeptaCert aktarımı: önce CSV, backend hazır olunca API

- **Durum:** Önerildi
- **Tarih:** 2026-09-22
- **Karar vericiler:** TechOps Başkanlığı
- **İlgili:** WP-06, ADR-0004, Bildirge §10


> **Uygulama notu (2026-09-24):** Spark planında sunucu kodu ve Secret Manager olmadığı için ikinci aşama (API entegrasyonu) yapılamaz; CSV aktarımı kalıcı yöntemdir. Bkz. [ADR-0017](0017-ucretsiz-spark-plani-kurallar-tek-guvenilir-katman.md).

## Bağlam

Bildirge §10 kararları bu ADR'nin dayanağıdır: HeptaCert etkinlik operasyonunu yürütür. IEEE İKÇÜ, etkinlik ve katılımcı geçmişinin kurumsal kopyasını kendi sisteminde tutar. Aktarım etkinlik sonunda yapılır. Birinci yöntem REST API, yedek yöntem CSV'dir. API anahtarı tarayıcıda, WordPress'te, GitHub'da, Firebase veritabanında veya Drive'da bulunamaz (§10.6).

## Karar

1. **Aşama 1 (ilk devreye alma):** Etkinlik sorumlusu HeptaCert'ten dışa aktardığı CSV/Excel dosyasını Hub'daki etkinlik sayfasına yükler. Dosya tarayıcıda ayrıştırılır, satırlar callable fonksiyona gönderilir ve fonksiyon doğrulayıp yazar. Ham dosya saklanmaz.
2. **Aşama 2:** ADR-0004 uygulanıp Secret Manager hazır olduğunda, `importFromHeptaCert` fonksiyonu API'den veri çeker. CSV yolu yedek olarak kalır.
3. **Aynı aktarımın tekrar çalıştırılması çift kayıt üretmez:** Katılımcı doküman kimliği `hc_{heptacertParticipantId}` olur. Bu kimlik yoksa `sha256(eventId + normalizedEmail)` kullanılır.
4. Her aktarım `syncRuns` kaydı üretir. Kayıtta Bildirge §10.5'teki tüm sayaçlar tutulur. Kaynak sayı ile aktarılan sayı arasında fark varsa veri kalitesi uyarısı oluşur.
5. Katılımcı verisi üye profilini **değiştirmez** (Bildirge §6.4). E-posta eşleşmesi varsa yalnızca `linkedUid` alanı doldurulur.
6. CSV sütun eşlemesi `packages/shared/src/schemas/heptacert.ts` dosyasında **veri sözleşmesi** olarak tanımlanır. HeptaCert dışa aktarım biçimi değişirse sözleşme sürümü artırılır.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Önce CSV, sonra API (seçilen) | Bildirge §10.6 ile uyumlu, hemen kullanılabilir | Aşama 1'de elle adım var |
| Yalnızca API | Tam otomatik | Backend hazır olmadan kullanılamaz |
| Apps Script ile API | Bildirge §6.10'da var | Anahtar Apps Script özelliklerinde tutulur; hesap bağımlılığı oluşur |

## Sonuçlar

**Olumlu:** İlk etkinlikten itibaren kurumsal kopya oluşur.
**Olumsuz:** Aşama 1'de sütun eşleme hataları olabilir. Yükleme ekranı, yazmadan önce önizleme ve hata listesi gösterir.

## Uygulama notları

- Callable: `importParticipants({ eventId, source: "csv" | "api", rows? })`
- Aktarım sonrası ekranda özet gösterilir: kaynak / eklenen / güncellenen / hatalı / tekrarlanan sayıları.
