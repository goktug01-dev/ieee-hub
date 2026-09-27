# ADR-0029: Tüzük herkese açık ve sürümlü yayımlanır

- **Durum:** Kabul Edildi
- **Tarih:** 2026-09-27
- **Karar vericiler:** IEEE İKÇÜ Yönetim Kurulu

## Bağlam

Öğrenci Kolu tüzüğünün güncel metnine üyelerin ve dış ziyaretçilerin giriş yapmadan ulaşabilmesi, hangi sürümün yürürlükte olduğunun anlaşılması ve eski sürümlerin kaybolmaması gerekir. Spark planında Cloud Storage yoktur.

## Karar

1. `/tuzuk` sayfası giriş gerektirmez; güncel PDF veya Word dosyasını tarayıcıda gösterir ve indirir.
2. Dosya en fazla 4 MB olur ve Firestore'da 700 bin karakteri aşmayan base64 parçalar hâlinde saklanır.
3. Her yayımlama yeni, değiştirilemez bir `statuteVersions` kaydı oluşturur. `statutes/current` yalnız yürürlükteki sürüme işaret eden aynı üstveriyi taşır.
4. Dosya SHA-256 ile doğrulanır. Eski sürümler herkese açık arşivde kalır.
5. Yayımlama `org.manage` veya `secretary.ledger.manage` yetkisine bağlıdır ve denetim kaydıyla aynı batch içinde yazılır.

## Sonuçlar

Güncel tüzük tek bir sabit bağlantıdan paylaşılır, yönetim değişiminde dosya kaybolmaz ve sürüm geçmişi korunur. Public okuma bilinçli olduğundan bu alana kişisel veya gizli belge yüklenmez.

## Uygulama

Arayüz `apps/hub/src/pages/public/StatutePage.tsx`, dosya hattı `apps/hub/src/lib/statutes.ts`, güvenlik sınırı `firebase/firestore.rules` içindedir.
