# ADR-0006: Yetki kontrolü: Functions esas, Security Rules derinlemesine savunma, custom claims yok

- **Durum:** Yerini Aldı ([ADR-0017](0017-ucretsiz-spark-plani-kurallar-tek-guvenilir-katman.md))
- **Tarih:** 2026-09-22
- **Karar vericiler:** TechOps Başkanlığı
- **İlgili:** WP-11, ADR-0004, ADR-0005, [Firestore veri modeli §3](../mimari/firestore-veri-modeli.md)

## Bağlam

Firebase'de yetki üç yerde kontrol edilebilir: istemci, Firestore Security Rules ve Cloud Functions. Rolleri kurallara taşımanın yaygın yolu **custom claims** (kimlik jetonuna eklenen alanlar) kullanmaktır. Ancak:

- Custom claims en fazla 1000 bayttır. Birim bazlı izinler bu sınırı kolayca aşar.
- Jeton en fazla 1 saat eski kalabilir. Yetkisi kaldırılan kişi, jeton yenilenene kadar yetkili kalır.
- Claim'ler sorgulanamaz. "Kimin hangi rolü var?" sorusu cevaplanamaz.

## Karar

1. **Yetkinin kaynağı** `roleAssignments` koleksiyonudur.
2. **Functions (yetkili karar noktası):** Her callable, çağıranın aktif atamalarını Firestore'dan okur (istek başına bir sorgu) ve `can()` ile karar verir. Kritik koleksiyonlara yalnızca Functions yazar (sınıf **F**, [veri modeli](../mimari/firestore-veri-modeli.md)).
3. **Security Rules (okuma ve basit yazmalar):** Kurallar `access/{uid}` dokümanını okur. Bu doküman Functions tarafından `roleAssignments` değişince yeniden hesaplanan, türetilmiş bir **erişim özetidir**. Kurallar ayrıca `request.time < access.validUntil` koşulunu kontrol eder.
4. **Custom claims** yetki için **kullanılmaz.**
5. **İstemci** aynı `can()` fonksiyonunu yalnızca arayüz için (düğme gösterme/gizleme) kullanır.
6. Rol sonlandırıldığında `access/{uid}` aynı transaction içinde güncellenir. Kurallar bir sonraki istekte güncel özeti okur, yani yetki kaybı **anında** geçerli olur.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Functions + `access` özeti okuyan kurallar (seçilen) | Anında iptal, sorgulanabilir, boyut sınırı sorun değil | Kural başına bir `get()` okuması (maliyet: okuma başına +1 doküman okuma) |
| Custom claims | Kurallarda ek okuma yok | 1000 bayt sınırı, 1 saate varan gecikme, sorgulanamaz |
| Kuralların doğrudan `roleAssignments` sorgulaması | Türetilmiş veri yok | Kurallar koleksiyon sorgusu yapamaz; yalnızca kimliği bilinen dokümanları `get()` ile okuyabilir |

## Sonuçlar

**Olumlu:** Yetki kaybı anında etkili olur. Tek bir doğruluk kaynağı vardır.

**Olumsuz:** Her kural değerlendirmesinde `access` dokümanı okunur. Aynı istek içinde tekrarlanan `get()` önbelleğe alınır. Liste sorgularında bu okuma sorgu başına bir kez sayılır. Beklenen hacimde ücretsiz kota içinde kalır.

**Riskler ve önlemler:**
- *`access` özetinin `roleAssignments` ile uyuşmaması:* Gece çalışan iş tüm özetleri yeniden hesaplar ve farkları denetim kaydına yazar. Özette `version` alanı tutulur.
- *Kural hataları:* Yetki matrisindeki her satır için Emulator'de otomatik izin/ret testi yazılır. Testler `permissions.ts` dosyasından üretilir. CI'da kural testi başarısızsa birleştirme yapılamaz.

## Uygulama notları

- `functions/src/rbac/recomputeAccess.ts`: `roleAssignments/{id}` yazımında tetiklenir; kişinin tüm aktif atamalarından `branchPerms`, `unitPerms` (alt birimlere genişletilmiş) ve `validUntil` alanlarını hesaplar.
- `units` ağacı değiştiğinde (üst birim değişimi) etkilenen tüm kişilerin özetleri yeniden hesaplanır.
- `firebase/firestore.rules` dosyasının başında `access()`, `hasBranch()`, `hasUnit()`, `isSelf()` yardımcı fonksiyonları tanımlanır.
- Rules test dosyası: `firebase/tests/rules.matrix.test.ts`. Her `(rol, izin, kapsam)` üçlüsü için beklenen sonuç `permissions.ts` dosyasından üretilir.
