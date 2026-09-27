# ADR-0027: Harici Firebase sistemlerine ikincil kullanıcı oturumuyla bağlanılır

- **Durum:** Kabul Edildi
- **Tarih:** 2026-09-27
- **Karar vericiler:** IEEE İKÇÜ TechOps; erişim kapsamı onayı: Yönetim Kurulu
- **Onay kaydı:** Kullanıcı talebi, 2026-09-27
- **İlgili:** WP-01, WP-04, WP-11, ADR-0010, ADR-0017

## Bağlam

IEEE Puan sistemi ve başka içerikler Hub'dan ayrı bir Firebase projesinde tutulur. TechOps sorumlularının bunları Hub üzerinden görebilmesi ve yönetebilmesi istenir. Spark planında güvenilir sunucu/Secret Manager yoktur; servis hesabı anahtarını tarayıcıya veya Firestore'a koymak tüm projeyi tehlikeye atar.

## Karar

Hub, ayrı Firebase projesini ikincil bir Firebase uygulaması olarak tarayıcıda açar. TechOps görevlisi uzak projenin Firebase Authentication hizmetinde kendi Google veya e-posta hesabıyla ayrıca giriş yapar. Uzak Firestore/Realtime Database kuralları her okuma ve yazmanın nihai güvenlik katmanıdır.

Hub'daki `external.firebase.manage` izni yalnız bağlantı paneline erişimi denetler; uzak projede yetki vermez. Web uygulama yapılandırması ve izin verilen koleksiyon/yol listesi Hub'da saklanır. Servis hesabı, özel anahtar ve ortak yönetici şifresi hiçbir zaman saklanmaz.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| İkincil kullanıcı oturumu (seçilen) | Kişi bazlı iz, Spark uyumu, anahtar yok | Her kullanıcı uzak projede ayrıca yetkilendirilmeli |
| Servis hesabını istemciye koymak | Tek bağlantı | Kritik anahtar herkese açılır; kabul edilemez |
| Veriyi Hub'a kopyalamak | Tek veritabanı görünümü | Çift kaynak, senkronizasyon ve kişisel veri riski |

## Sonuçlar

**Olumlu:**
- Firestore ve Realtime Database için yapılandırılabilir görünümler kullanılabilir.
- Uzak proje kendi erişim kurallarını ve denetim sınırını korur.

**Olumsuz / maliyet:**
- Uzak projenin web yapılandırması, Authentication sağlayıcıları, yetkili alan adları, veri yolları ve kuralları ayrıca hazırlanmalıdır.
- Genel JSON düzenleyici şema doğrulaması yapmaz; yazılabilir yollar dar tutulmalıdır.

**Riskler ve önlemler:**
- Yanlış koleksiyon/yol yapılandırması yalnız yetkili TechOps rolüne açıktır.
- Kritik koleksiyonlar önce salt okunur tanımlanır; uzak kurallar kişi ve işlem bazında en az yetki uygular.

## Uygulama notları

Bağlantı kodu `apps/hub/src/lib/externalFirebase.ts`, panel `ExternalFirebasePage.tsx`, Hub ayarı `externalIntegrations/firebase` belgesidir. Uzak projeye bu depo tarafından kural dağıtımı yapılmaz.
