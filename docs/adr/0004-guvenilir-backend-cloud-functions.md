# ADR-0004: Güvenilir backend: Cloud Functions ve Blaze planı

- **Durum:** Yerini Aldı ([ADR-0017](0017-ucretsiz-spark-plani-kurallar-tek-guvenilir-katman.md)) — AS-06: Blaze planı alınamıyor
- **Tarih:** 2026-09-22
- **Karar vericiler:** TechOps Başkanlığı; onay: Yönetim Kurulu (maliyet ve faturalandırma)
- **İlgili:** Tüm WP'ler, ADR-0006, ADR-0012, ADR-0015, ADR-0016, Bildirge §5.6, §6.10, §10.6, §15, AS-06

## Bağlam

Hub'daki bazı işlemler istemciye (tarayıcıya) güvenilerek yapılamaz:

| İşlem | Neden sunucu gerekir |
|---|---|
| Rol ataması ve dört göz onayı | Yetki yükseltme saldırısına en açık nokta |
| Dilekçe imzası | Rol ataması, adım sırası, içerik özeti ve imzacı ≠ sahip kontrolleri tek bir transaction içinde, güvenilir ortamda yapılmalıdır |
| Evrak numarası | Sıralı ve boşluksuz sayaç |
| İçerik özeti (SHA-256) | Security Rules hash hesaplayamaz |
| PDF üretimi ve saklama | Güvenilir çıktı, Storage yazımı |
| HeptaCert API | Bildirge §10.6: API anahtarı tarayıcıda, Firebase veritabanında veya Drive'da bulunamaz |
| Zamanlanmış işler | Rol süresi dolumu, hatırlatmalar, haftalık rapor |
| Denetim kaydı | İstemcinin yazdığı denetim kaydı güvenilir değildir |

Firebase'in ücretsiz **Spark** planında Cloud Functions, Secret Manager ve yeni Cloud Storage kovaları kullanılamaz. Bunlar **Blaze** (kullandıkça öde) planı gerektirir. Blaze planında da ücretsiz kotalar geçerlidir. Bu ölçekte (≤ 100 aktif kullanıcı) aylık maliyetin 0 veya birkaç dolar düzeyinde kalması beklenir. Ancak plan için bir faturalandırma hesabı (kredi/banka kartı) gerekir.

## Karar

1. Firebase projesi **Blaze** planına alınır.
2. Faturalandırma hesabı kişisel değil **kurumsal** sahiplikte yönetilir. Hesaba en az iki yönetici tanımlanır (Bildirge §5.3). Kimin adına açılacağı YK tarafından belirlenir (AS-06).
3. Bütçe alarmları kurulur: aylık **5 USD** (uyarı) ve **10 USD** (acil). Alarmlar Sayman, TechOps Başkanı ve Başkan'a e-postayla gider.
4. Kritik işlemler **callable Cloud Functions** (2. nesil, `europe-west3`) ile yapılır. İstemci bu koleksiyonlara doğrudan yazamaz ([ADR-0006](0006-yetki-uygulama-noktalari.md)).
5. Gizli bilgiler (HeptaCert API anahtarı vb.) **Secret Manager**'da tutulur.
6. Callable fonksiyonlar **App Check** zorunluluğuyla çalışır (reCAPTCHA Enterprise sağlayıcısı, ücretsiz kota).
7. `minInstances: 0` kullanılır (soğuk başlangıç kabul edilir, maliyet sıfıra yakın kalır).

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Blaze + Cloud Functions (seçilen) | Güvenilir, tek platform, ücretsiz kota bu ölçek için yeterli | Faturalandırma hesabı gerekir. Kötüye kullanımda maliyet riski doğar (bütçe alarmı ve App Check ile azaltılır). |
| Spark + yalnızca Security Rules | Sıfır maliyet, kart gerekmez | İmza, numaralandırma ve hash güvenilir biçimde yapılamaz. HeptaCert API kullanılamaz. Karmaşık kurallar hataya açıktır. İmza modülü bu koşulda güvenilir olamaz. |
| Spark + Apps Script'i backend olarak kullanmak | Ücretsiz, Bildirge §6.10'da zaten var | Script sahibinin kişisel hesabına bağımlılık (Bildirge §6.10 uyarısı), yürütme kotaları, Firebase Auth jetonu doğrulaması zahmetli, test ve CI zayıf |
| Ayrı sunucu (VPS, Render vb.) | Tam kontrol | İkinci sağlayıcı, bakım ve güvenlik yükü |

## Sonuçlar

**Olumlu:** RBAC ve imza gereksinimleri güvenilir biçimde karşılanır. HeptaCert API entegrasyonunun Bildirge §10.6'daki ön koşulu sağlanır.

**Olumsuz:** Faturalandırma hesabı gerekir. Bütçe alarmı **harcamayı durdurmaz**, yalnızca uyarır.

**Riskler ve önlemler:**
- *Beklenmedik maliyet:* Bütçe alarmı, App Check, fonksiyonlarda `maxInstances` sınırı (örn. 5), sorgularda sayfalama. İsteğe bağlı olarak bütçe aşımında faturalandırmayı kapatan bir "acil durdurma" fonksiyonu kurulabilir. Bu fonksiyon tüm sistemi durdurur ve ayrıca YK kararı gerektirir.
- *Faturalandırma hesabının kaybı (yönetim değişimi):* Hesap sahipliği devir kontrol listesine eklenir (Bildirge §18).
- *YK Blaze'i onaylamazsa:* İmza ve RBAC modülleri güvenlik gereksinimlerini karşılayamaz. Bu durumda WP-11 ve WP-12 kapsamı daraltılır ve yeni bir ADR yazılır. O zamana kadar geliştirme Emulator Suite üzerinde sürer; emülatör Blaze gerektirmez.

## Uygulama notları

- Fonksiyonlar `functions/src/{domain}/` altında gruplanır: `rbac`, `petitions`, `events`, `reports`, `sync`, `audit`.
- Her callable şu sırayı izler: `requireAuth` → `requireAppCheck` → girdi doğrulaması (zod) → `can()` kontrolü → transaction → denetim kaydı. Ortak ara katman `functions/src/lib/callable.ts` dosyasında tanımlanır.
- Hata mesajları kullanıcıya Türkçe ve bilgi sızdırmayacak biçimde döner (örn. "Bu işlem için yetkiniz yok"). Ayrıntılar yalnızca loglara yazılır.
