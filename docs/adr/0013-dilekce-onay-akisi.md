# ADR-0013: Dilekçe onay akışı: sıralı adımlar, ikame, koşullu adım

- **Durum:** Önerildi
- **Tarih:** 2026-09-22
- **Karar vericiler:** TechOps Başkanlığı; onay: Yönetim Kurulu
- **İlgili:** WP-12, ADR-0005, ADR-0011, ADR-0012, [fonksiyonel tanım §4–5](../moduller/e-dilekce/README.md)


> **Uygulama notu (2026-09-24):** Sıralı adımlar, `anyOf` roller (ikame bunun üzerinden), onay/iade/ret ve iade sonrası baştan başlama uygulanır ve kurallarla zorlanır. Koşullu adım (`when`), `fallback` ve hatırlatmalar ilk sürümde **yoktur.** Bkz. [ADR-0017](0017-ucretsiz-spark-plani-kurallar-tek-guvenilir-katman.md).

## Bağlam

Dilekçeler, organizasyon hiyerarşisinde yukarı doğru ilerleyen imza zincirlerinden geçer. Örnek zincir: komite başkanı → Genel Sekreter → Başkan → (gerekirse) Danışman. Gerçek hayatta şu durumlar da yaşanır:

- Başkan yoktur veya ulaşılamaz; yardımcısı onun adına imzalar.
- Dilekçeyi yazan kişi zaten komite başkanıdır; kendi dilekçesini onaylayamaz.
- Rol boştur (dönem başı, istifa).
- Bazı onaylar yalnızca belirli koşullarda gerekir (kampüs dışı etkinlik, belirli tutarın üzerindeki harcama).
- İmzacı dilekçeyi düzeltme için geri gönderir.

## Karar

### 1. Yapı
- Onay zinciri, şablonda tanımlı **sıralı adımlardan** oluşur. Paralel adım ilk dönemde yoktur.
- Her adımda `anyOf` rol listesi bulunur. Uygun imzacılardan **birinin** kararı adımı kapatır.

### 2. Adım açılırken imzacı çözümü
Adım açıldığında sunucu, uygun imzacıları (`eligibleUids`) şu sırayla belirler:
1. `when` koşulu sağlanmıyorsa adım `skipped` olur ve bir sonraki adıma geçilir.
2. `anyOf` rollerini, adımın kapsamında (örn. `petition_unit`) aktif olarak taşıyan kişiler bulunur.
3. `substitutes` rollerini taşıyan kişiler eklenir. Bu kişiler imzalarsa kayıt "adına" (`onBehalfOf`) olarak işaretlenir.
4. Dilekçe sahibi listeden **çıkarılır.**
5. Liste boşsa `fallback` rolleri aynı kuralla çözülür ve adım `escalated: true` olarak işaretlenir.
6. Liste hâlâ boşsa adım `active` kalır, ancak dilekçe GS'nin **Takılı Dilekçeler** listesine düşer ve GS'ye bildirim gider.

`eligibleUids` yalnızca bildirim ve okuma kuralı içindir. Rol atamaları değiştiğinde (`roleAssignments` tetikleyicisi) süreçteki dilekçelerin aktif adımları yeniden çözülür. **İmza yetkisi, imza anında sunucuda baştan doğrulanır.**

### 3. Kararlar

| Karar | Etki |
|---|---|
| `approve` | Adım `approved` olur. Sonraki adım açılır. Son adımsa dilekçe `approved` olur. |
| `return` | Gerekçe zorunlu. Dilekçe `returned` olur. Sahibi düzeltip yeniden gönderir, yeni revizyon oluşur ve zincir **baştan başlar** (`onReturn: "restart"`). Önceki revizyonun imzaları geçmişte kalır ama yeni revizyon için geçersizdir. |
| `reject` | Gerekçe zorunlu. Dilekçe `rejected` olur (nihai). |

### 4. Eşzamanlılık
- İmza işlemi, `petitionId + revision + stepId` üzerinden **iyimser kilit** ile yapılır. İki uygun imzacı aynı anda imzalarsa transaction'ı ilk tamamlanan kazanır; ikincisi "Bu adım başka bir yetkili tarafından sonuçlandırıldı" hatası alır.
- Dilekçe sahibi, bir adım imzalanırken dilekçeyi geri çekerse aynı transaction kuralı uygulanır.

### 5. Süre ve hatırlatma
- `reminderAfterDays` (varsayılan 3) gün geçen adımlar için günlük hatırlatma gönderilir.
- 7 günü geçen adımlar veri kalitesi uyarısı olur ve haftalık operasyon raporunda (Bildirge §11.4) "Yönetim kararı bekleyen konular" altında listelenir.
- İlk dönemde otomatik yükseltme (süre dolunca bir üst makama geçme) **yoktur.** Karar insanda kalır (Bildirge §5.6).

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Sıralı adım + anyOf + ikame + fallback + koşul (seçilen) | Gerçek süreci karşılar, anlaşılır | Paralel onay yok |
| Genel iş akışı motoru (BPMN) | Her senaryo modellenebilir | Bu ölçek için aşırı karmaşık |
| Sabit zincir (her dilekçe aynı imzacılardan geçer) | Çok basit | Kurumsal formların farklı zincirleri karşılanamaz |
| Resmî vekâlet kaydı (tarih aralıklı yetki devri) | Esnek | İlk dönemde ikame rol yeterlidir. Gerekirse ikinci dönemde eklenir. |

## Sonuçlar

**Olumlu:** Rol boşlukları ve kendi dilekçesini onaylama durumları sistematik olarak çözülür.

**Olumsuz:** İade sonrası zincirin baştan başlaması, küçük düzeltmelerde bile tüm imzaların yeniden alınmasını gerektirir. Bu bilinçli bir tercihtir: içerik değiştiyse önceki onay yeni içeriği kapsamaz.

## Uygulama notları

- Saf fonksiyon: `packages/shared/src/petitions/workflow.ts` → `nextState(petition, template, event)`. Durum makinesi burada tek yerde tanımlanır ve kapsamlı birim testleri yazılır.
- Çözümleyici: `functions/src/petitions/resolveEligibleSigners.ts`
- Callable'lar: `submitPetition`, `signPetitionStep`, `withdrawPetition`, `resubmitPetition`.
