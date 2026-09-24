# ADR-0011: Dilekçe şablonları depoda sürümlü JSON olarak tutulur

- **Durum:** Yerini Aldı ([ADR-0020](0020-dilekce-sablonlari-word-tabanli.md))
- **Tarih:** 2026-09-22
- **Karar vericiler:** TechOps Başkanlığı
- **İlgili:** WP-12, [şablon formatı](../moduller/e-dilekce/sablon-formati.md), ADR-0013, Bildirge §5.1, §10.4 (form sürümü), §11.8

## Bağlam

- IEEE İKÇÜ'nün kendine ait dilekçe formatları vardır (AS-04). Bunlar Hub'da doldurulabilir hâle getirilecektir.
- Bir dilekçe şablonu yalnızca form alanlarından ibaret değildir: resmî metin, onay zinciri, PDF düzeni, KVKK sınıflandırması ve saklama süresi de şablonun parçasıdır. Onay zincirindeki bir hata, yanlış kişiye imza yetkisi verilmesi anlamına gelir.
- Bildirge, form sürümünün kaydedilmesini (§10.4) ve "form sürümü bulunmayan cevabın" veri kalitesi hatası sayılmasını (§11.8) ister.
- Kurumsal formlar ISO tarzı bir başlık kullanır: Doküman No, Yayın Tarihi, Rev No.

## Karar

1. Her şablon `packages/petition-templates/templates/<id>/v<N>.json` dosyasında tanımlanır. Şema zod ile yazılır ve istemci, sunucu ve CI aynı şemayı kullanır.
2. Yayınlanmış bir sürüm dosyası **değiştirilemez.** Değişiklik gerekirse `v<N+1>.json` oluşturulur. PDF başlığındaki "Rev No" bu sürümden otomatik türetilir.
3. Her dilekçe oluşturulduğu anda şablon sürümüne **sabitlenir** (`templateVersion`). Yeni sürüm yayınlandığında süreçteki dilekçeler eski sürümle devam eder.
4. Yayın süreci:
   1. Evrak Sorumlusu veya GS değişiklik talebini açar (Hub görevi veya GitHub issue).
   2. TechOps şablonu dönüştürür ve PR açar.
   3. CI şablonu doğrular ve örnek verilerle PDF anlık görüntüsü üretir.
   4. `CODEOWNERS` kuralı gereği TechOps geliştiricisi **ve** Evrak Sorumlusu/GS PR'ı onaylar.
   5. Birleştirmeden sonra CI, sürümü Firestore'a (`petitionTemplates/{id}/versions/{v}`) yazar.
   6. Sürüm **pasif** olarak yayınlanır. Evrak Sorumlusu Hub'dan etkinleştirir (`petition.template.manage`). Böylece teknik yayın ile kurumsal yürürlüğe alma birbirinden ayrılır.
5. Şablon tanımının SHA-256 özeti (`definitionHash`) dilekçenin içerik özetine dahil edilir. İmza, belirli bir şablon sürümüne bağlıdır.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Depoda sürümlü JSON + CI doğrulaması (seçilen) | Kod incelemesi, değiştirilemez sürüm, otomatik test, onay zinciri hatalarının yayından önce yakalanması | Metin değişikliği için bile geliştirici gerekir |
| Hub içinde görsel şablon oluşturucu | Teknik olmayan kişiler düzenleyebilir | Büyük geliştirme maliyeti; onay zinciri hataları incelenmeden canlıya çıkar. İkinci dönemde, bu ADR'nin tanımladığı şemanın arayüzü olarak değerlendirilebilir. |
| Google Forms | Hazır, kolay | Rol bazlı imza yok, veri Hub dışında kalır, RBAC yok |
| Word şablonu + birleştirme (docx) | Mevcut formatlar doğrudan kullanılır | Alan doğrulaması yok, PDF çıktısı tutarsız, onay zinciri tanımlanamaz |

## Sonuçlar

**Olumlu:** Her dilekçenin hangi şablon metniyle ve hangi onay zinciriyle işlendiği kesin olarak bilinir.

**Olumsuz:** Şablon değişiklikleri TechOps kapasitesine bağlıdır. Bu nedenle "yazım hatası düzeltme" gibi küçük değişiklikler için tek günlük hizmet hedefi konur.

## Uygulama notları

- `pnpm templates:validate` ve `pnpm templates:publish` komutları [şablon formatı §3](../moduller/e-dilekce/sablon-formati.md) kurallarını uygular.
- `.github/CODEOWNERS`: `packages/petition-templates/templates/ @ieee-ikcu/techops @ieee-ikcu/evrak`
