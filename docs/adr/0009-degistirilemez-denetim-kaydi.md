# ADR-0009: Değiştirilemez denetim kaydı

- **Durum:** Önerildi
- **Tarih:** 2026-09-22
- **Karar vericiler:** TechOps Başkanlığı; onay: Yönetim Kurulu (saklama süresi)
- **İlgili:** WP-11, WP-12, ADR-0012, Bildirge §5.7, §11.9, AS-09


> **Uygulama notu (2026-09-24):** Denetim kaydı (`auditLog`) kurallarla yalnızca eklenebilir, değiştirilemez ve silinemez kılındı; kayıtlar istemci tarafından, kritik işlemlerde işlemle aynı batch içinde yazılır. Hash zinciri ve sunucu tarafı kayıt yoktur. Sınırlar için [ADR-0017](0017-ucretsiz-spark-plani-kurallar-tek-guvenilir-katman.md) "Olumsuz" bölümüne bakın.

## Bağlam

Bildirge §5.7: "Veri aktarımları, rol değişiklikleri, rapor üretimleri ve kritik yönetici işlemleri kayıt altına alınacaktır. Bir işlemin kim tarafından ve ne zaman yapıldığı belirlenebilir olmalıdır." İmza modülünün güvenilirliği de denetim kaydının güvenilirliğine bağlıdır.

## Karar

1. `auditLogs` koleksiyonuna **yalnızca Cloud Functions** yazar. Security Rules tüm istemci yazmalarını, güncellemelerini ve silmelerini reddeder.
2. Kayıt biçimi:

   ```json
   {
     "at": "<serverTimestamp>",
     "action": "rbac.assignment.approve",
     "actor": { "uid": "…", "displayName": "…", "roles": ["branch.secretary"] },
     "source": "callable | trigger | scheduler | bootstrap | breakglass",
     "target": { "type": "roleAssignment", "id": "…" },
     "summary": "Ayşe Y. → unit.chair @ cs (2026-2027)",
     "changes": { "status": ["pending_approval", "active"] },
     "reason": "YK 2026/14 sayılı karar",
     "requestId": "…"
   }
   ```

3. Kayıtlara kişisel veri **kopyalanmaz.** Yalnızca kimlikler, durum değişiklikleri ve kısa özet yazılır. Dilekçe içeriği denetim kaydında yer almaz.
4. Kaydedilen işlemler: tüm rol atama işlemleri, acil erişim işlemleri, dilekçe durum geçişleri ve imzalar, evrak numarası düzeltmeleri, şablon etkinleştirme/emekliye ayırma, içe aktarmalar, rapor onayları, `access` özeti uyuşmazlıkları, üyelik durumu değişiklikleri.
5. Aylık dışa aktarım: Her ayın ilk günü önceki ayın kayıtları JSONL olarak Drive'daki `09_TechOps_ve_Sistemler/Guvenlik/Denetim` klasörüne yazılır. Dosyanın SHA-256 değeri bir sonraki ayın ilk kaydına eklenir.
6. Saklama süresi: **2 akademik yıl** önerilir (AS-09). Süre dolan kayıtlar zamanlanmış görevle silinir; silme işleminin kendisi de kaydedilir.
7. Dilekçe imzaları, denetim kaydına ek olarak dilekçe bazında **hash zinciri** taşır ([ADR-0012](0012-rol-bazli-elektronik-onay.md)).

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Functions-only Firestore koleksiyonu + aylık dışa aktarım (seçilen) | Basit, sorgulanabilir, uygulama içinde görüntülenebilir | Firebase proje sahipleri teknik olarak değiştirebilir |
| Global hash zinciri (her kayıt bir öncekine bağlı) | Değişiklik tespit edilebilir | Tüm yazmalar tek bir sayaç üzerinden sıralanır ve darboğaz oluşur. Yalnızca dilekçe imzalarında (düşük hacim) uygulanır. |
| BigQuery / harici log servisi | Güçlü analiz | Ek maliyet ve karmaşıklık |

## Sonuçlar

**Olumlu:** "Bu yetkiyi kim, ne zaman verdi?" sorusu uygulama içinden cevaplanır.

**Sınırlamalar (açıkça kabul edilir):** Firebase proje **Owner** rolündeki kişiler konsoldan veriyi değiştirebilir. Önlemler:
- Owner sayısı 2 ile sınırlanır (TechOps Başkanı + Başkan veya GS) ([ADR-0010](0010-teknik-erisim-ve-acil-erisim.md)).
- Google Cloud **Admin Activity** denetim kayıtları (varsayılan açık, ücretsiz) konsol ve IAM işlemlerini tutar.
- Aylık dışa aktarımlar ve hash değerleri Drive'da ayrı erişim yetkisiyle saklanır.

## Uygulama notları

- `functions/src/audit/log.ts`: `writeAudit(tx, entry)` fonksiyonu, işlemle **aynı transaction** içinde çağrılır. İşlem başarısız olursa kayıt da yazılmaz; işlem başarılıysa kayıt mutlaka yazılır.
- Görüntüleme: `/yonetim/denetim` (`audit.read`) ve `/sistem/kayitlar` (`audit.read_technical`).
