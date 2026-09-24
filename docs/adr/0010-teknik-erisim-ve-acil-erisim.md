# ADR-0010: TechOps teknik erişimi iş verisini kapsamaz; acil erişim süreci

- **Durum:** Önerildi
- **Tarih:** 2026-09-22
- **Karar vericiler:** TechOps Başkanlığı; onay: Yönetim Kurulu
- **İlgili:** WP-11, ADR-0009, Bildirge §5.3, §5.4, §8.2, §12.4


> **Uygulama notu (2026-09-24):** Acil erişim süreci **henüz uygulanmadı.** İlk sürümde "kurucu yönetici" (`superAdmin`) tüm yönetim izinlerine sahiptir; bu yetki YK'ya verilmeli, TechOps'a yalnızca gerektiğinde ve süreli olarak devredilmelidir. Bkz. [ADR-0019](0019-organizasyon-roller-ve-secimler-arayuzden-duzenlenir.md) §6.

## Bağlam

Bildirge §8.2: "TechOps, üye, sponsor veya finans verilerinin iş amacıyla sahibi değildir. Teknik erişim, yalnızca sistem yönetimi ve sorun çözme amacıyla kullanılacaktır." Ancak Firebase'de proje yöneticisi olan kişi konsoldan her veriye erişebilir. Teknik gerçeklik ile ilke arasında bir boşluk vardır.

## Karar

### 1. Uygulama içi
- `sys.admin` rolü iş verisi okuma izni **taşımaz** ([yetki matrisi §10](../rbac/yetki-matrisi.md)).
- Hata ayıklama için iş verisine erişim gerekirse **acil erişim** (break-glass) kullanılır:
  1. `sys.admin` gerekçe, kapsam (örn. `petition.read @ petition/{id}` veya `people.profile.read_full @ branch`) ve süre (en fazla 4 saat) belirterek talep açar.
  2. Başkan veya GS (talep edenden farklı kişi) onaylar.
  3. Onayla birlikte `breakGlassGrants/{id}` kaydı oluşur ve `access` özetine süreli olarak eklenir.
  4. Tüm YK üyelerine bildirim gider. Süre bitince erişim otomatik olarak kalkar.
  5. Acil erişim süresince yapılan tüm callable işlemler `source: "breakglass"` etiketiyle kaydedilir.

### 2. Google Cloud / Firebase konsolu (IAM)
- Proje **Owner** rolü en fazla **2 kişide** bulunur: TechOps Başkanı ve Başkan (veya GS). Bildirge §5.3'teki "en az iki yönetici" kuralını karşılar ve üst sınır koyar.
- Diğer TechOps geliştiricileri üretim projesinde IAM rolü **almaz.** Dağıtımlar GitHub Actions servis hesabıyla yapılır (en az yetkili özel rol: Hosting, Functions, Rules dağıtımı).
- Geliştirme ve test **Emulator Suite** ve **staging** projesinde, sentetik veriyle yapılır. Üretim verisi geliştirme ortamına kopyalanmaz.
- Firestore için **Data Access** denetim kayıtları açılır. Böylece konsoldan yapılan veri okumaları da kaydedilir.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Varsayılan erişimsizlik + acil erişim (seçilen) | Bildirge §8.2 teknik olarak uygulanır | Hata ayıklama yavaşlar |
| TechOps'a tam okuma yetkisi | Hızlı destek | Bildirge §8.2 ve §5.4'e aykırı |

## Sonuçlar

**Olumlu:** Kişisel veriye teknik erişim görünür ve istisnai hâle gelir.

**Olumsuz:** Acil bir üretim hatasında onaycıya ulaşılamazsa çözüm gecikir. Onaycı listesinde en az iki kişi olması bu riski azaltır.

## Uygulama notları

- Callable'lar: `requestBreakGlass`, `approveBreakGlass`, `endBreakGlass`.
- Zamanlanmış görev her 15 dakikada süresi biten izinleri kapatır. Kurallar da ayrıca izin bitiş zamanını kontrol eder.
- Aylık yönetim raporunda "Acil erişim kullanımları" bölümü bulunur.
