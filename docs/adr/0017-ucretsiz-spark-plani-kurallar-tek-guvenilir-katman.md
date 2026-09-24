# ADR-0017: Ücretsiz Spark planı; sunucu kodu yok, Security Rules tek güvenilir katman

- **Durum:** Kabul Edildi
- **Tarih:** 2026-09-24
- **Karar vericiler:** TechOps Başkanlığı
- **Onay kaydı:** Proje sahibinin 2026-09-24 tarihli talimatı ("Blaze planı alınamaz, bütçe yok; sistem olabildiğince ücretsiz olmalı"). YK karar numarası işlenecek.
- **Yerini aldığı kararlar:** [ADR-0004](0004-guvenilir-backend-cloud-functions.md), [ADR-0006](0006-yetki-uygulama-noktalari.md)
- **Etkilediği kararlar:** ADR-0009, ADR-0012, ADR-0013, ADR-0014, ADR-0015, ADR-0016
- **İlgili:** AS-06, WP-11, WP-12

## Bağlam

ADR-0004, kritik işlemler (imza, evrak numarası, denetim kaydı) için Cloud Functions ve Blaze planı önermişti. Öğrenci Kolunun faturalandırma hesabı açacak bütçesi yoktur (AS-06: **hayır**). Firebase'in ücretsiz **Spark** planında şunlar **yoktur**: Cloud Functions, Secret Manager, zamanlanmış işler ve (2026 itibarıyla) Cloud Storage kovası.

Spark planında kullanılabilenler: Firebase Authentication (Google ve e-posta/şifre), Cloud Firestore (günlük 50 bin okuma, 20 bin yazma, 1 GiB depolama), Firebase Hosting (10 GB depolama, günlük 360 MB aktarım). Bu kotalar ≤ 200 aktif kullanıcılı bir öğrenci topluluğu için yeterlidir.

## Karar

1. Hub tamamen **Spark** planında çalışır. Faturalandırma hesabı açılmaz; bu nedenle beklenmedik fatura riski **sıfırdır** (kota dolarsa hizmet ertesi güne kadar durur, ücret çıkmaz).
2. Sunucu kodu yoktur. **Firestore Security Rules, Hub'ın tek güvenilir katmanıdır.** İstemci ne gönderirse göndersin şu kontroller kurallarda yapılır (`firebase/firestore.rules`):

   | Kontrol | Kuraldaki karşılığı |
   |---|---|
   | Onaylayan kişi, adımda istenen rolü, istenen birimde ve **şu anda** taşıyor | `access/{uid}.roleKeys["birim__rol"] > request.time` |
   | Onaylayan kişi dilekçe sahibi değil | `ownerUid != request.auth.uid` |
   | Adım sırası atlanamaz; karar yalnızca aktif adıma verilir | `approvals[n].step == currentStep`, durum geçişleri tek tek tanımlı |
   | Önceki onaylar değiştirilemez, silinemez | `approvals[0:n] == resource.data.approvals` |
   | Onay zinciri gönderimde şablondan birebir kopyalanır | `steps == get(versions/{v}).steps` |
   | Onaydan önce son 15 dakikada giriş yapılmış | `request.auth.token.auth_time` |
   | Evrak numarası boşluksuz ve tekrarsız | Sayaç yalnızca ilk gönderimle aynı batch'te, `+1` artar (`getAfter`) |
   | Onay sürecinde içerik değiştirilemez | Güncelleme dalları yalnızca izinli alanlara dokunabilir (`affectedKeys().hasOnly`) |
   | Doğrulama kaydı dilekçeyle birebir aynı | `petitionVerifications` yazımı, aynı batch'teki dilekçeyle alan alan karşılaştırılır |
   | Yayımlanmış şablon sürümü değiştirilemez | `versions/{v}`: `update, delete: if false` |
   | Denetim kaydı yalnızca eklenebilir | `auditLog`: `update, delete: if false` |

3. Yetki özeti (`access/{uid}`), görev atamalarından **istemcide** hesaplanır ve yalnızca `assignments.manage` iznine sahip kişi yazabilir. Kurucu yönetici bayrağını (`superAdmin`) yalnızca başka bir kurucu yönetici değiştirebilir.
4. Custom claims kullanılmaz (Admin SDK gerektirir).
5. Bütün kurallar emülatörde otomatik testlerle doğrulanır (`firebase/tests/rules.test.ts`) ve istemci kodu gerçek kurallara karşı uçtan uca test edilir (`apps/hub/src/__tests__/flow.emulator.test.ts`). CI'da testler geçmezse birleştirme yapılmaz.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Spark + yalnızca Security Rules (seçilen) | Sıfır maliyet, kart gerekmez, fatura riski yok | Hash zinciri ve sunucu tarafı PDF yok; bazı işlemler istemcide hesaplanır (aşağıya bakın) |
| Blaze + Cloud Functions (ADR-0004) | En güçlü güvence | Bütçe yok (AS-06 reddedildi) |
| Apps Script'i backend yapmak | Ücretsiz | Kişisel hesap bağımlılığı (Bildirge §6.10), Firebase jetonu doğrulaması zahmetli, test edilemez |
| Ücretsiz katmanlı başka sunucu (Render, Vercel Functions vb.) | Sunucu kodu olur | İkinci sağlayıcı; soğuk başlangıç; Admin SDK anahtarının dışarıda saklanması gerekir (güvenlik riski) |

## Sonuçlar

**Olumlu:** Maliyet sıfır. Devir sırasında devredilecek bir faturalandırma hesabı yoktur. Kuralların tamamı tek dosyada ve testlidir.

**Olumsuz / kabul edilen sınırlar:**
- **Hash zinciri (ADR-0012 §4) yoktur.** Yerine kurallar önceki onayların değiştirilmesini doğrudan engeller. Firebase proje sahibi (konsol erişimi olan kişi) veriyi kurallar dışında değiştirebilir; bu risk proje sahipliğinin kurumsal hesapta ve en az iki yöneticide tutulmasıyla (Bildirge §5.3) yönetilir.
- **Denetim kaydı istemci tarafından yazılır.** Kurallar kaydı değiştirilemez ve silinemez kılar, kişinin kendi adına yazdığını doğrular; ancak bir yöneticinin işlemi kaydı atlayarak yapmasını (tarayıcı konsolundan) tam olarak engelleyemez. Kritik işlemler (şablon yayımı, görev ataması) kayıtla **aynı batch'te** yazılır. Dilekçe onaylarının kanıtı denetim kaydına değil, dilekçenin kendi değiştirilemez `approvals` listesine dayanır.
- **Zamanlanmış iş yoktur.** Süresi dolan görevlerin yetkisi, kurallarda bitiş zamanı kontrol edildiği için **kendiliğinden** kalkar. Görünürlük listeleri ise yöneticinin "Erişimleri yenile" düğmesiyle veya dönem kapatılırken güncellenir.
- **E-posta bildirimi yoktur** (sunucu gerektirir). Bekleyen onaylar Hub'daki "Onayımı bekleyenler" sayacıyla görünür.
- **HeptaCert API entegrasyonu (ADR-0016 ikinci aşama) yapılamaz**; CSV aktarımı kalır.

**Riskler ve önlemler:**
- *Kota aşımı:* İstemci yerel önbellek kullanır (`persistentLocalCache`), listeler sayfalanır. Kota aşılırsa Hub ertesi güne kadar salt okunur/erişilemez olur; ücret doğmaz.
- *Kural hatası:* Her kural değişikliği test gerektirir; CI zorunludur.
- *İleride bütçe bulunursa:* Bu ADR'nin yerini alacak yeni bir ADR ile Functions eklenebilir; veri modeli buna uygundur (kurallar sıkılaştırılır, istemci yazmaları callable'a taşınır).
