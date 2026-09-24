# Rol Kataloğu

> **Güncelleme (2026-09-24):** Roller artık Hub'ın *Roller ve yetkiler* ekranından düzenlenir ([ADR-0019](../adr/0019-organizasyon-roller-ve-secimler-arayuzden-duzenlenir.md)). Kurulumda gelen varsayılan roller `apps/hub/src/lib/setup.ts` içindedir; izin kataloğu `apps/hub/src/lib/permissions.ts` içindedir. Bu doküman kavramsal referanstır.

Hub'daki tüm roller bu dokümanda tanımlanır. Uygulamada kaynak `packages/shared/src/rbac/roles.ts` dosyası olacaktır ([dokümantasyon kuralları §2](../dokumantasyon-kurallari.md)). Rol izinleri: [yetki matrisi](yetki-matrisi.md). Kimin kimi atayabileceği: [atama kuralları](atama-kurallari.md).

## 1. Rol grupları

| Grup | Kapsam | Açıklama |
|---|---|---|
| Taban roller | Otomatik | Atanmaz. Kimlik ve üyelik durumundan türetilir. |
| Yönetim Kurulu rolleri | `branch` | Öğrenci Kolu geneli yönetim görevleri. |
| Birim rolleri | `unit:<id>` | Komite, başkanlık, departman ve ekip içi görevler. |
| Fonksiyonel roller | `branch` | Bildirge §8'de tanımlanan, birimden bağımsız sorumluluklar. |
| Sistem rolleri | `branch` | Teknik yönetim. İş verisine erişim vermez. |

## 2. Taban roller

| Rol ID | Ad | Nasıl elde edilir | Not |
|---|---|---|---|
| `authenticated` | Giriş yapmış kullanıcı | Firebase Auth ile giriş | Üyelik onayı yok. Yalnızca profilini ve üyelik başvuru durumunu görür. |
| `member` | Onaylı üye | RTDB'de üyelik durumu `approved` | Hub'a tam giriş yapar. Dilekçe oluşturabilir, kendi görevlerini görür. |

## 3. Yönetim Kurulu rolleri (`branch`)

| Rol ID | Ad | Kalıtım | Tanım |
|---|---|---|---|
| `board.member` | YK Üyesi | — | Yönetim Kurulu kararlarına katılır. Kol geneli operasyon raporlarını ve etkinlik onay taleplerini görür. |
| `branch.chair` | Öğrenci Kolu Başkanı | `board.member` | Nihai onay makamı. Kritik rol atamalarını talep eder ve onaylar. Acil erişim taleplerini onaylar. |
| `branch.vice_chair` | Başkan Yardımcısı | `board.member` | Başkanın ikame rolü. Başkanın yetkilerinin çoğunu taşır. |
| `branch.secretary` | Genel Sekreter | `board.member` | Kurumsal kayıtlar, evrak ve rapor onayı (Bildirge §8.3). Dilekçe sürecinin sahibidir. |
| `branch.treasurer` | Sayman | `board.member` | Finansal kayıtlar ve bütçe (Bildirge §8.7). |

## 4. Birim rolleri (`unit:<id>`)

Her birim tipinde (komite, başkanlık, departman, proje ekibi) aynı roller kullanılır. Rolün adı birim tipine göre gösterilir ("Komite Başkanı", "Daire Başkanı", "Proje Lideri").

| Rol ID | Ad | Kalıtım | Tanım |
|---|---|---|---|
| `unit.volunteer` | Gönüllü | — | Birimin görevlerini ve projelerini görür. Kendine atanan görevleri günceller (Bildirge §8.8). |
| `unit.coordinator` | Koordinasyon Üyesi | `unit.volunteer` | Birim içinde görev ve proje oluşturur, atar, takip eder. Etkinlik önerir. İletişim talebi açar. |
| `unit.vice_chair` | Birim Başkan Yardımcısı | `unit.coordinator` | Başkanın ikame rolü. Birim üyelerinin iletişim bilgilerine erişir. Gönüllü ve koordinasyon üyesi atar. |
| `unit.chair` | Birim Başkanı | `unit.vice_chair` | Birimin sorumlusu (Bildirge §8.4). Birim dilekçelerinin ilk onay makamıdır. Birim raporlarını onaylar. |

> **Kalıtım yalnızca izinler için geçerlidir.** Onay zincirlerinde roller **tam eşleşmeyle** aranır. Örnek: bir onay adımı `unit.vice_chair` istiyorsa, `unit.chair` bu adımı yalnızca şablonda ikame olarak tanımlıysa imzalayabilir ([ADR-0013](../adr/0013-dilekce-onay-akisi.md)).

## 5. Fonksiyonel roller (`branch`)

| Rol ID | Ad | Tanım | Bildirge |
|---|---|---|---|
| `fn.membership` | Üyelik Sorumlusu | Üyelik başvurularını değerlendirir, durumları yönetir. | §8.6 |
| `fn.sponsorship` | Sponsorluk Sorumlusu | Sponsor havuzunu ve görüşmeleri yönetir. | §8.7 |
| `fn.vtools` | vTools Sorumlusu | vTools paketlerini hazırlar ve gönderim durumunu işler. | §6.12, §11.7 |
| `fn.records` | Evrak ve Arşiv Sorumlusu | Dilekçe şablonlarının yayın/emeklilik işlemleri, evrak arşivi, numara düzeltmeleri. Mevzuat ve Arşiv Yönetimi Departmanı ile eşleşir. | §3.1 |

Etkinlik sorumlusu (Bildirge §8.5) bir rol olarak değil, **kaynak ilişkisi** olarak modellenir: `events/{id}.ownerUids`. Etkinlik sorumluluğu etkinliğe bağlıdır ve etkinlik kapanınca sona erer ([ADR-0005 §4](../adr/0005-rbac-modeli.md)).

## 6. Diğer roller

| Rol ID | Ad | Kapsam | Tanım |
|---|---|---|---|
| `branch.advisor` | Öğrenci Kolu Danışmanı | `branch` | Salt okuma gözetimi (yönetim raporları, finans özeti, denetim kaydı). Şablonda tanımlıysa dilekçe onaylar (AS-07). |
| `sys.admin` | Sistem Yöneticisi | `branch` | TechOps teknik yöneticisi. Sistem yapılandırması, otomasyon kayıtları, içe aktarma işlemleri. **Üye, finans, sponsor ve dilekçe içeriklerine erişemez.** Bu verilere yalnızca acil erişimle ulaşabilir ([ADR-0010](../adr/0010-teknik-erisim-ve-acil-erisim.md)). |

## 7. Rol eşleme örnekleri

| Kişi (örnek) | Rol atamaları |
|---|---|
| Öğrenci Kolu Başkanı | `branch.chair` |
| Genel Sekreter | `branch.secretary` |
| CS Komite Başkanı | `unit.chair @ cs` |
| CS Başkan Yardımcısı | `unit.vice_chair @ cs` |
| CS Koordinasyon Üyesi | `unit.coordinator @ cs` |
| TechOps Başkanı (YK üyesiyse) | `unit.chair @ techops`, `board.member`, `sys.admin` (dört göz onayıyla) |
| Mevzuat ve Arşiv Departmanı sorumlusu | `unit.chair @ techops-mevzuat`, `fn.records` |
| Etkinliğe katılan sıradan üye | `member` (atama yok) |
