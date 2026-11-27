# ADR-0045: ACTOR puan önerisini değiştirerek doğrular veya komiteye geri gönderir

- **Durum:** Kabul Edildi
- **Tarih:** 2026-11-27
- **Karar vericiler:** Depo sahibi (kullanıcı talebi)
- **Onay kaydı:** Bu değişikliğin PR'ı
- **İlgili:** ADR-0040, ADR-0041; İKÇÜ 2025–2026 revizyon tüzüğü Madde 22, 24, 28–37

## Bağlam

ADR-0040'a göre komite `eventPointRequests/{eventId}` kaydıyla puan önerir, ACTOR yalnız olduğu gibi doğrulayabilir. Uygulamada komite başkanları etkinlik puanını isabetli kestiremiyor. ACTOR'ün elinde ya yanlış puanı onaylamak ya da hiç onaylamamak seçeneği kalıyor, ve öneri kaydı bir kez oluşturulduğu için komite düzeltme de yapamıyor. Tüzüğe göre puanı komite ile ACTOR birlikte belirler; doğrulama ACTOR'e aittir.

## Karar

Doğrulama bekleyen (`requested`) öneride ACTOR iki yeni işlem yapabilir:

- **Değiştirerek doğrulama:** ACTOR farklı bir puan girerek doğrular. Komitenin önerdiği puan `proposedPoints` alanına yazılır, gerekçe `actorNote` alanına girer ve zorunludur. Kurallar `proposedPoints` değerinin önceki `points` değerine eşit olmasını, puanın 0–100000 arası tam sayı olmasını ve başka alanın değişmemesini zorunlu kılar.
- **Geri gönderme:** ACTOR zorunlu gerekçeyle öneriyi `returned` durumuna alır (`actorNote`, `returnedBy`, `returnedAt`).

Etkinlik sahibi veya yöneticisi geri gönderilen öneride puanı, gerekçeyi ve QR son kullanım zamanını düzeltir ve öneriyi yeniden `requested` durumuna getirir. `createdAt` ile ACTOR'ün geri gönderme notu korunur.

Değişmeyenler: Doğrulanmış (`approved`) puan, oluşturma ve son kullanım zamanı değiştirilemez. Komite bekleyen öneriyi kendisi değiştiremez. ACTOR yetkisi yine yalnız `branch__actor` rolünden veya süreli `site.qr.manage` izninden gelir. Geri gönderilen öneri için siteye QR yazılmaz.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| A (seçilen): ACTOR doğrulamadan önce değiştirir veya geri gönderir | Tek adımda düzeltme; komitenin önerisi ve ACTOR gerekçesi kayıtta kalır | Komite önerisi ile doğrulanan puan farklı olabilir, ama bu açıkça gösterilir |
| B: Yalnız geri gönderme | Puanı komite belirler | Her düzeltme bir tur daha gerektirir; etkinlik yaklaşırken QR gecikir |
| C: Doğrulamadan sonra da değiştirme | Esnek | Okutulmuş QR'ların puanı değişir; tüzükteki "etkinlik sonrası puan değişmez" kuralına aykırıdır |

## Sonuçlar

**Olumlu:**
- Puanı ACTOR kesinleştirir; komitenin önerisi ve değişiklik gerekçesi denetlenebilir kalır.
- ACTOR kamu özetinde geri gönderilen ve ACTOR tarafından değiştirilen öneri sayısı da raporlanır.

**Olumsuz / maliyet:**
- Bir öneri belgesinde yalnız son ACTOR notu tutulur. Ayrı bir hareket geçmişi yoktur. Önceki geri gönderme notu, ACTOR puanı değiştirerek doğrularsa yeni gerekçeyle değişir.

**Riskler ve önlemler:**
- Gerekçesiz puan değişikliğini kurallar reddeder. ACTOR'ün kendi yönettiği komiteye ilişkin bağımsızlık ihlali tüzük süreciyle (Denetleme) incelenir; teknik olarak engellenmez.

## Uygulama notları

- Kurallar: `firebase/firestore.rules` › `eventPointRequests`. Testler: `firebase/tests/site-workflow.rules.test.ts`.
- İstemci: `apps/hub/src/lib/siteWorkflow.ts` (`approveEventPoints`, `returnEventPoints`, `closeEventPoints`, `proposeEventPoints(..., resubmit)`), `apps/hub/src/components/SiteWorkflows.tsx` › `EventPointsPanel`.
- Site aktarımı yalnız `approved` ve `closed` durumunu işler.
