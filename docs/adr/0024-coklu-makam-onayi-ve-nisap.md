# ADR-0024: Bir onay adımı birden çok makam ve nisap destekler

- **Durum:** Kabul Edildi
- **Tarih:** 2026-09-26
- **Karar vericiler:** IEEE İKÇÜ TechOps; süreç sahibi onayı: Yönetim Kurulu
- **Onay kaydı:** Kullanıcı talebi, 2026-09-26
- **İlgili:** WP-12, ADR-0012, ADR-0013, ADR-0020

## Bağlam

Bazı dilekçelerin aynı aşamada birden çok makam tarafından onaylanması gerekir. Sadece sıralı ve “rollerden biri” yaklaşımı; dört makamın tamamı veya belirli bir nisap gereken süreçleri ifade edemez.

## Karar

Hub, her onay adımında üç politika destekler: rollerden herhangi biri, rollerin tamamı ve belirli sayıda makam. Aynı rol aynı adımda ikinci kez onay veremez. Nisap tamamlanana kadar dilekçe sonraki adıma geçmez; ret ve iade yetkili makamın tek kararıyla mevcut kurallara göre sonuçlanır.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Adım içinde çoklu makam ve nisap (seçilen) | Şablondan ayarlanır; sıralı ve paralel ihtiyaçları birlikte karşılar | Kural ve arayüz daha karmaşıktır |
| Her makamı ayrı sıralı adım yapmak | Basit | Paralel onayı ve “4 makamdan 3'ü” kuralını ifade etmez |

## Sonuçlar

**Olumlu:**
- Dört imza ve benzeri kurul onayları kod değişikliği olmadan tanımlanabilir.
- İlerleme “x/y makam onayı” olarak izlenir.

**Olumsuz / maliyet:**
- Eski şablonlarda politika alanı yoktur; geriye uyumluluk için “rollerden biri” kabul edilir.

**Riskler ve önlemler:**
- İstemci manipülasyonu riski Firestore kurallarında rol tekilliği, eklemeli onay listesi ve nisap kontrolüyle engellenir.

## Uygulama notları

`ApprovalStep.approvalMode`, `ApprovalStep.requiredApprovals` ve `Petition.stepApprovalRoleIds` kullanılır. Kural senaryoları `firebase/tests/rules.test.ts` içinde sınanır.
