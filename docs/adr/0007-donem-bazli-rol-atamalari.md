# ADR-0007: Rol atamaları döneme bağlı ve sürelidir

- **Durum:** Önerildi
- **Tarih:** 2026-09-22
- **Karar vericiler:** TechOps Başkanlığı; onay: Yönetim Kurulu
- **İlgili:** WP-10, WP-11, [atama kuralları](../rbac/atama-kurallari.md), Bildirge §3.2, §12.4, §14.6, §18


> **Uygulama notu (2026-09-24):** Uygulanır. Süre dolumu için zamanlanmış iş yoktur; kurallar her istekte bitiş zamanını kontrol ettiği için yetki kendiliğinden düşer. Dönem kapatma işlemi o döneme bağlı görevleri toplu sonlandırır. Bkz. [ADR-0017](0017-ucretsiz-spark-plani-kurallar-tek-guvenilir-katman.md), [ADR-0019](0019-organizasyon-roller-ve-secimler-arayuzden-duzenlenir.md).

## Bağlam

- Yönetim her akademik yıl değişir. Bildirge'nin en çok vurguladığı risklerden biri, eski yöneticilerin erişimlerinin açık kalmasıdır (§12.4: "Eski yönetici ve gönüllü erişimleri zamanında kaldırılacaktır").
- Aynı zamanda görev ve sorumluluk geçmişi korunmalıdır (§3.2).
- Devir sürecinde eski ve yeni sorumlunun kısa bir süre birlikte çalışması gerekir.

## Karar

1. Her rol ataması bir **döneme** (`terms/{termId}`) ve bir **bitiş tarihine** (`endsAt`) sahiptir. Bitiş tarihi, dönem sonundan sonra olamaz. Süresiz atama yoktur.
2. Dönem sonunda tüm atamalar **otomatik olarak sona erer.** Uzatma yapılmaz. Yeni dönemde görev alan kişiye yeni atama yapılır. Bu, her yıl bütün yetkilerin bilinçli olarak yeniden verilmesini sağlar.
3. **Devir penceresi:** Yeni dönemin atamaları, önceki dönemin bitişinden en fazla 30 gün önce başlayabilir. Bu sürede eski ve yeni sorumlu birlikte yetkilidir.
4. Sona eren, iptal edilen veya reddedilen atamalar **silinmez.** Bunlar görev geçmişi olarak saklanır ve kişinin profilinde "Görev geçmişi" bölümünde gösterilir.
5. Süre kontrolü iki katmanlıdır: günlük zamanlanmış görev (`expireAssignments`, 03:00 Europe/Istanbul) ve kurallarda `access.validUntil` kontrolü.
6. Dönem bitişinden 14 gün önce **devir raporu** otomatik üretilir.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Döneme bağlı, otomatik sona eren atamalar (seçilen) | Unutulan erişim kalmaz; geçmiş korunur | Her dönem başında toplu atama işi gerekir (toplu atama ekranıyla azaltılır) |
| Süresiz atama, elle kaldırma | Az iş | Bildirge §12.4 riskinin ta kendisi |
| Otomatik uzatma | Kesintisiz | Eski yetkiler sessizce devam eder |

## Sonuçlar

**Olumlu:** "Erişimi kapatılmamış eski kullanıcı" (Bildirge §11.8) Hub içinde yapısal olarak oluşamaz.

**Olumsuz:** Dönem başında yeni atamalar zamanında yapılmazsa birimler yetkisiz kalabilir. Bu yüzden devir raporu, sahipsiz kalacak rolleri 14 gün önceden listeler.

## Uygulama notları

- `terms` dokümanı: `{ id: "2026-2027", startsAt, endsAt, handoverOpensAt = endsAt - 30g, status: "upcoming" | "active" | "closed" }`
- Toplu atama ekranı: bir önceki dönemin atamalarını listeler. Seçilenler için yeni dönem atama **talepleri** oluşturur; dört göz kuralı yine uygulanır.
- `endsAt` saklama biçimi: dönem bitiş gününün 23:59:59 Europe/Istanbul karşılığı, UTC olarak.
