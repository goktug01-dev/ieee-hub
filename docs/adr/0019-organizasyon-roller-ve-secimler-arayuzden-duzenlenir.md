# ADR-0019: Organizasyon, roller, dönemler ve seçimler arayüzden düzenlenir

- **Durum:** Kabul Edildi
- **Tarih:** 2026-09-24
- **Karar vericiler:** TechOps Başkanlığı
- **Onay kaydı:** Proje sahibinin 2026-09-24 tarihli talimatı ("seçimler, başkanlar, komiteler; her şey sistemden düzenlenebilir olmalı"). YK karar numarası işlenecek.
- **Yerini aldığı kararlar:** [ADR-0005](0005-rbac-modeli.md) §1 ("roller kodda tanımlanır") ve §3 ("rol kataloğunu değiştirmek bir kod değişikliğidir"). Kapsamlı ve dönem bazlı model (ADR-0005 §1'in geri kalanı, ADR-0007) geçerliliğini korur.
- **İlgili:** AS-01, AS-02, AS-03, WP-10, WP-11

## Bağlam

Organizasyon her yıl değişir: komiteler açılır/kapanır, unvanlar değişir, seçimle yeni başkanlar gelir. ADR-0005, rolleri kodda tutmayı ve her değişikliği PR ile yapmayı öneriyordu. Bu, her dönem geliştirici gerektirir ve kullanıcının "her şey sistemden düzenlenebilir olmalı" gereksinimini karşılamaz.

## Karar

1. **Arayüzden düzenlenenler** (`org.manage` izniyle):
   - **Birimler** (`units`): komite, başkanlık, departman, proje ekibi; ad, kısa kod, üst birim, aktif/pasif. Birimler silinmez, pasifleştirilir.
   - **Roller** (`roles`): ad, kapsam (`branch` = kol geneli, `unit` = komite/birim içi), açıklama ve **izinler**.
   - **Dönemler** (`terms`): başlangıç/bitiş, aktif dönem. Dönem kapatılınca o döneme bağlı tüm görevler sona erer.
   - **Kurum ayarları**: ad, logo, evrak numarası biçimi, doğrulama adresi, izinli e-posta alan adları.
2. **Görev atamaları** (`assignments`, `assignments.manage` izniyle): kişi + rol + birim + dönem + başlangıç/bitiş. "Mevcut görevliyi sonlandır" seçeneği görev devrini tek adımda yapar.
3. **Seçimler** (`elections`, `elections.manage` izniyle): seçim kaydı, pozisyonlar (rol + birim), adaylar, oy sayıları ve kazanan. **"Görevlere işle"** düğmesi kazananları seçimin dönemine atar, isteğe bağlı olarak önceki görevlileri sonlandırır.
   - Hub **çevrim içi oylama yapmaz.** Gizli oylama; oyların kimlikten ayrılmasını gerektirir, bu da sunucu kodu olmadan güvenle yapılamaz (ADR-0017). Seçim genel kurulda yapılır, sonuçlar Hub'a işlenir.
4. **İzin kataloğu kodda sabittir** (`apps/hub/src/lib/permissions.ts` + `firebase/firestore.rules`). Bir iznin *ne açtığı* kurallarda tanımlıdır ve değiştirmek kod değişikliğidir. *Hangi rolün hangi izne sahip olduğu* ise arayüzden düzenlenir.

   | İzin | Açtığı yetki |
   |---|---|
   | `org.manage` (kritik) | Birim, rol, dönem, kurum ayarları |
   | `members.manage` | Üye onayı, askıya alma |
   | `assignments.manage` (kritik) | Görev atama/sonlandırma, erişim özetlerini yenileme |
   | `elections.manage` | Seçim kayıtları |
   | `templates.manage` | Dilekçe şablonları ve sürüm yayımı |
   | `petitions.readAll` | Tüm dilekçeler (evrak arşivi) |
   | `audit.read` | Denetim kaydı |
   | `unit.petitions.read` (birim kapsamlı) | Rolün atandığı birimin ve alt birimlerinin dilekçeleri |

5. Dilekçe **onay yetkisi izinden değil, rolden gelir**: şablonun onay adımı "şu birimdeki şu rol(ler)" der; o rolü o birimde taşıyan herkes onaylayabilir. Kalıtım yoktur (tam eşleşme); ikame, adıma birden çok rol eklenerek yapılır (örn. Başkan **veya** Başkan Yardımcısı).
6. **Kurucu yönetici** (`superAdmin`): sistemi kuran ilk kişi. Tüm yönetim izinlerine sahiptir, başka kişilere devredebilir. Yönetim devrinde yeni ekibe devredilip eski ekipten kaldırılır (WP-10).

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Roller ve izin atamaları veritabanında, izin kataloğu kodda (seçilen) | Organizasyon değişiklikleri geliştirici gerektirmez; güvenlik sınırı (izinlerin anlamı) yine test edilen kodda | "Sessiz yetki genişlemesi" mümkün → denetim kaydı ve kritik izin uyarısıyla azaltılır |
| Roller kodda (ADR-0005) | Her değişiklik incelenir | Her dönem geliştirici gerekir; kullanıcı gereksinimine aykırı |
| Serbest izin tanımı (arayüzden yeni izin eklemek) | Tam esneklik | Kurallarda karşılığı olmayan izin anlamsızdır; yanıltıcı |

## Sonuçlar

**Olumlu:** YK, komite açma, unvan değiştirme, seçim sonuçlarını işleme ve dönem devrini geliştiriciye ihtiyaç duymadan yapar.

**Olumsuz:** Kritik izinleri (`org.manage`, `assignments.manage`) taşıyan kişi yetki yapısını değiştirebilir. Bu izinler yalnızca YK kararıyla verilmeli; tüm değişiklikler denetim kaydına yazılır.

**Riskler:** Bir rolün izinleri değiştiğinde, o rolü taşıyanların erişim özetleri otomatik yenilenir; ancak yenilemeyi yapan kişinin `assignments.manage` izni yoksa yenileme başarısız olur ve "Erişimleri yenile" düğmesiyle tamamlanmalıdır.
