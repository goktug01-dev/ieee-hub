# WP-11 — Kimlik, Rol ve Yetki Yönetimi (RBAC)

> **Güncelleme (2026-09-24):** İlk sürüm uygulandı: birimler, roller, dönemler, görev atamaları, seçimler, üye onayı, erişim özeti ve kurallar. Sapmalar: roller veritabanında ([ADR-0019](../adr/0019-organizasyon-roller-ve-secimler-arayuzden-duzenlenir.md)), Functions yerine kurallar ([ADR-0017](../adr/0017-ucretsiz-spark-plani-kurallar-tek-guvenilir-katman.md)); dört göz ve acil erişim henüz yok.

| | |
|---|---|
| **Durum** | Planlandı |
| **Paket sorumlusu** | TechOps Başkanı (teknik), Genel Sekreter (organizasyon verisi) |
| **Süreç sahibi** | Yönetim Kurulu |
| **Takvim** | Hafta 1–4 (tasarım ve onay), 5–8 (geliştirme), 14 (güvenlik testi), 16 (devir) |
| **Bağımlılıklar** | WP-01 (envanter), WP-02 (monorepo, CI) |
| **Bağımlı paketler** | WP-04, WP-05, WP-06, WP-07, WP-08, WP-12 — yetki gerektiren tüm modüller |
| **İlgili ADR'ler** | ADR-0003, ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0010 |
| **Kaynak** | Bildirge §5.3, §5.4, §5.7, §8, §12.4, §14.6, §18 (bu paket Bildirge'ye eklenmiştir) |

## Amaç

IEEE İKÇÜ'nün organizasyon yapısını (Yönetim Kurulu → komiteler ve başkanlıklar → başkan, başkan yardımcıları → koordinasyon üyeleri → gönüllüler) Hub'da **kapsamlı, dönem bazlı ve denetlenebilir** bir RBAC sistemi olarak kurmak. Bu paket bittiğinde:

- Her kişinin hangi birimde, hangi rolle, hangi tarihe kadar yetkili olduğu Hub'da görülür.
- Yetki verme işlemleri kurallara bağlıdır ve kaydedilir. Kritik roller iki kişinin onayıyla verilir.
- Dönem sonunda yetkiler otomatik olarak kapanır.
- Diğer modüller yetki kontrolü için tek bir `can()` fonksiyonunu ve ortak kural yardımcılarını kullanır.

## Kapsam

**Dahil:**
- Organizasyon modeli: birimler, dönemler ([organizasyon modeli](../rbac/organizasyon-modeli.md))
- Rol kataloğu ve yetki matrisi ([rol kataloğu](../rbac/rol-katalogu.md), [yetki matrisi](../rbac/yetki-matrisi.md))
- Rol atama, onay, sonlandırma, süre dolumu ([atama kuralları](../rbac/atama-kurallari.md))
- Erişim özeti (`access/{uid}`) ve Security Rules yardımcıları
- `people` yansıması (RTDB → Firestore)
- Denetim kaydı altyapısı (tüm modüllerin kullanacağı)
- Acil erişim
- Arayüz: organizasyon şeması, birim sayfası, rol yönetimi, "Yetkilerim"
- Dönem devri araçları ve devir raporu

**Hariç (ilk dönem):**
- Google Groups, Drive, GitHub, HeptaCert erişimlerinin otomatik eşitlenmesi (yerine erişim görevleri)
- Resmî vekâlet kayıtları (ikame roller yeterli, [ADR-0013](../adr/0013-dilekce-onay-akisi.md))
- Hub içinden rol tanımı düzenleme ([ADR-0005](../adr/0005-rbac-modeli.md): roller koddadır)

## Çıktılar

| # | Çıktı | Konum |
|---|---|---|
| Ç1 | YK onaylı rol kataloğu ve yetki matrisi | `docs/rbac/`, YK karar kaydı |
| Ç2 | RBAC paylaşılan paketi: `roles.ts`, `permissions.ts`, `can()`, tipler | `packages/shared/src/rbac/` |
| Ç3 | Firestore koleksiyonları ve indeksleri: `terms`, `units`, `roleAssignments`, `access`, `people`, `auditLogs`, `breakGlassGrants`, `accessTasks` | `firebase/firestore.indexes.json` |
| Ç4 | Callable ve tetikleyici fonksiyonlar | `functions/src/rbac/`, `functions/src/audit/` |
| Ç5 | Security Rules yardımcıları ve matrisle üretilen kural testleri | `firebase/firestore.rules`, `firebase/tests/` |
| Ç6 | Ön yükleme betiği ve çalıştırma kılavuzu | `scripts/bootstrap-admins.ts`, `docs/runbook/bootstrap.md` |
| Ç7 | Arayüz ekranları | `apps/hub/src/features/org/`, `.../rbac/` |
| Ç8 | Devir raporu | Hub sayfası + PDF/Sheets çıktısı |
| Ç9 | Güvenlik testi raporu | `docs/guvenlik/wp11-test-raporu.md` |

## Görevler

| ID | Görev | Hafta | Bağımlılık |
|---|---|---|---|
| **Tasarım ve onay** | | | |
| WP11-T01 | Organizasyon envanteri: birimler, tipleri, üst birimleri, kısa kodları; YK unvanları; "koordinasyon üyesi" tanımı; mevcut kişi-rol listesi | 1–2 | AS-01, AS-02, AS-03 |
| WP11-T02 | Rol kataloğu ve yetki matrisinin YK'ya sunulması ve onayı; ADR-0005, 0007, 0008, 0009, 0010 kabulü | 3–4 | T01 |
| **Çekirdek** | | | |
| WP11-T03 | `packages/shared/src/rbac`: `roles.ts`, `permissions.ts`, kalıtım genişletme, `can(principal, perm, target)`; birim testleri (döngü yok, her izin en az bir rolde, `sys.admin` iş verisi izni taşımıyor) | 5 | T02, WP-02 |
| WP11-T04 | `people` yansıması: RTDB `onValueWritten` tetikleyicisi + gece karşılaştırma işi (ADR-0003) | 5 | WP01-T05 |
| WP11-T05 | Şemalar (zod) ve koleksiyonlar: `terms`, `units`, `roleAssignments`, `access`, `accessTasks` | 5 | T03 |
| WP11-T06 | Denetim kaydı altyapısı: `writeAudit(tx, entry)`, kurallar (yalnızca okuma, `audit.read`), aylık dışa aktarım işi (ADR-0009) | 5 | T05 |
| WP11-T07 | Callable'lar: `requestRoleAssignment`, `approveRoleAssignment`, `rejectRoleAssignment`, `revokeRoleAssignment`; atama yetki tablosu kontrolleri; talep eden ≠ onaylayan ≠ atanan | 5–6 | T03, T06 |
| WP11-T08 | `recomputeAccess` tetikleyicisi (alt birim genişletmesi, `validUntil`, `version`); `expireAssignments` (günlük 03:00); `lapsePendingRequests` (7 gün); gece `access` tutarlılık kontrolü | 6 | T07 |
| WP11-T09 | Security Rules yardımcıları (`access()`, `hasBranch()`, `hasUnit()`, `isSelf()`); `permissions.ts` dosyasından üretilen kural test matrisi CI'da | 6 | T08 |
| WP11-T10 | Üyelik durumu değişince atamaların askıya alınması/geri açılması ([atama kuralları §6](../rbac/atama-kurallari.md)) | 6 | T04, T08 |
| WP11-T11 | Ön yükleme betiği ve kılavuzu; staging'de tatbikat | 6 | T07 |
| **Arayüz** | | | |
| WP11-T12 | Organizasyon şeması ve birim sayfası (birim ağacı, sorumlular, birim üyeleri) | 7 | T05 |
| WP11-T13 | Rol yönetimi: atama talep formu (kişi, rol, birim, dönem, bitiş, gerekçe); onay kutusu; sonlandırma; toplu dönem ataması | 7–8 | T07 |
| WP11-T14 | "Yetkilerim" sayfası: aktif rollerim, bitiş tarihleri, bu rollerin bana verdiği izinlerin sade dilde açıklaması | 8 | T03 |
| WP11-T15 | Profilde görev geçmişi (süresi dolmuş/sonlandırılmış atamalar) | 8 | T05 |
| WP11-T16 | Erişim görevleri listesi: rol değişikliklerinden doğan harici sistem işleri (Google Group ekle/çıkar vb.) | 8 | T07, WP03-T08 |
| WP11-T17 | Denetim kaydı görüntüleyici (`/yonetim/denetim`), filtreler | 8 | T06 |
| **İleri** | | | |
| WP11-T18 | Acil erişim: `requestBreakGlass`, `approveBreakGlass`, 15 dakikalık kapatma işi, YK bildirimi (ADR-0010) | 8 | T08 |
| WP11-T19 | Devir raporu: dönem bitişine 14 gün kala; sahipsiz kalacak roller, onaycı sayısı < 2 uyarısı, bekleyen dilekçe ve görevler | 13 | T08 |
| WP11-T20 | Güvenlik testi (§ Güvenlik test senaryoları) ve rapor | 14 | Tümü |

## Güvenlik test senaryoları (WP11-T20)

| # | Senaryo | Beklenen |
|---|---|---|
| G1 | Kullanıcı kendine rol atama talebi açar | Reddedilir |
| G2 | Talep eden kişi kendi talebini onaylar | Reddedilir |
| G3 | Atanan kişi kendi atama talebini onaylar | Reddedilir |
| G4 | `unit.chair @ cs`, `unit.coordinator @ ras` atamaya çalışır | Reddedilir |
| G5 | `unit.chair @ cs`, `branch.secretary` rolünü talep eder | Reddedilir |
| G6 | İstemci `roleAssignments`, `access` veya `auditLogs` koleksiyonuna doğrudan yazar | Kurallarca reddedilir |
| G7 | Rolü sonlandırılan kişi, açık oturumdaki bir sonraki isteğinde birim verisi okur | Reddedilir (1 saniye içinde) |
| G8 | Süresi dolmuş atama, zamanlanmış görev çalışmadan önce | `validUntil` nedeniyle reddedilir |
| G9 | `sys.admin`, üye iletişim bilgisini veya dilekçe içeriğini okur | Reddedilir |
| G10 | `sys.admin`, acil erişim onaylandıktan sonra ve süre dolduktan sonra aynı veriyi okur | Önce izin verilir, sonra reddedilir. İki işlem de kaydedilir. |
| G11 | Üyeliği askıya alınan kişi | Tüm birim izinleri kalkar |
| G12 | Birim ağacında üst birim değiştirildi | Eski üst birim başkanının alt birim izinleri kalkar, yenisininki eklenir |
| G13 | Aynı talebe iki onaycı aynı anda onay verir | Tek aktif atama oluşur (transaction) |
| G14 | Callable App Check jetonu olmadan çağrılır | Reddedilir |

## Kabul kriterleri

- [ ] K1: Rol kataloğu ve yetki matrisi YK kararıyla onaylanmış.
- [ ] K2: Yetki matrisindeki her `(rol, izin, kapsam)` satırı için otomatik izin **ve** ret testi var ve CI'da geçiyor.
- [ ] K3: G1–G14 senaryolarının tamamı beklenen sonucu veriyor (güvenlik testi raporu).
- [ ] K4: Tüm aktif YK, birim başkanı ve başkan yardımcısı atamaları Hub'da kayıtlı; her birinin bir dönemi ve bitiş tarihi var.
- [ ] K5: Kritik rollerin %100'ü dört göz onayıyla verilmiş (bootstrap hariç, denetim kaydıyla doğrulanır).
- [ ] K6: Rol sonlandırma ile erişim kaybı arasındaki süre < 5 saniye (ölçülür).
- [ ] K7: YK'da en az 2 aktif onaycı var. Devir raporu dönem sonundan 14 gün önce üretilmiş.
- [ ] K8: Bir YK üyesi, "Yetkilerim" ve "Organizasyon" sayfalarından kimin neye yetkili olduğunu TechOps'a sormadan cevaplayabiliyor (kullanılabilirlik testi, 3 kişi).

## Riskler

| Risk | Olasılık | Etki | Önlem |
|---|---|---|---|
| Organizasyon yapısının dokümanla uyuşmaması (AS-01–03) | Orta | Yüksek | T01'de YK ile birlikte doğrulama; model birim tipi ve kapsam açısından esnek |
| Kural hataları nedeniyle veri sızıntısı | Orta | Yüksek | Matristen üretilen testler; varsayılan ret; güvenlik testi |
| Onaycı bulunamaması nedeniyle atamaların gecikmesi | Orta | Orta | 7 günlük düşme süresi, e-posta hatırlatması, onaycı sayısı uyarısı |
| Dönem başında yetkisiz kalma | Orta | Orta | 30 günlük devir penceresi, toplu atama ekranı, devir raporu |
| Geliştiricinin kendi hesabına yetki vermesi | Düşük | Yüksek | Tüm atamalar callable üzerinden; Firestore'a doğrudan yazmak IAM gerektirir, IAM yetkisi 2 kişiyle sınırlı (ADR-0010) |

## Açık sorular

- AS-01, AS-02, AS-03, AS-06, AS-07, AS-13
