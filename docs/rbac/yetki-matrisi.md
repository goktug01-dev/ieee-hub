# Yetki Matrisi

> **Güncelleme (2026-09-24):** Uygulanan izin kataloğu (8 izin) [ADR-0019 §4](../adr/0019-organizasyon-roller-ve-secimler-arayuzden-duzenlenir.md) içindedir. Bu matristeki görev, etkinlik, finans vb. modüllere ait izinler ilgili modüller geliştirildiğinde eklenecektir.

> **Durum:** Taslak. Yönetim Kurulu onayı bekliyor (WP11-T02). Onaydan sonra `packages/shared/src/rbac/permissions.ts` bu tablonun kaynağı olur. Firestore Rules testleri ve bu doküman o dosyadan üretilir ([ADR-0006](../adr/0006-yetki-uygulama-noktalari.md)).

## 1. Gösterim

| Kısaltma | Kapsam | Anlamı |
|---|---|---|
| **B** | Kol geneli | Tüm birimlerdeki kayıtlar |
| **U** | Birim | Rolün verildiği birim ve alt birimlerindeki kayıtlar |
| **O** | Kendi / ilişki | Kişinin sahibi, sorumlusu veya tarafı olduğu kayıtlar (örn. kendisine atanan görev, kendi dilekçesi, sorumlusu olduğu etkinlik) |

Roller kısaltmaları:

| Kısaltma | Rol |
|---|---|
| Üye | `member` |
| Gön. | `unit.volunteer` |
| Koor. | `unit.coordinator` |
| B.Yrd. | `unit.vice_chair` |
| B.Bşk. | `unit.chair` |
| YK | `board.member` (ve kalıtımla tüm YK rolleri) |
| Başkan | `branch.chair` |
| KBY | `branch.vice_chair` |
| GS | `branch.secretary` |
| Sayman | `branch.treasurer` |
| Danışman | `branch.advisor` |
| Üyelik / Sponsor / vTools / Evrak | `fn.membership` / `fn.sponsorship` / `fn.vtools` / `fn.records` |
| SysAdm | `sys.admin` |

"Koor.+" gösterimi, koordinasyon üyesi ve kalıtımla üstündeki roller (B.Yrd., B.Bşk.) anlamına gelir.

**Kural:** Tabloda bulunmayan her izin **reddedilir** (varsayılan ret).

## 2. Organizasyon ve RBAC

| İzin | Açıklama | Verilen roller (kapsam) |
|---|---|---|
| `org.unit.read` | Birim listesi, birim sayfası, birim sorumluları | Üye (B) |
| `org.unit.manage` | Birim oluşturma, arşivleme, üst birim değiştirme | Başkan (B), GS (B) |
| `rbac.term.manage` | Dönem açma/kapatma, devir penceresi | Başkan (B), GS (B) |
| `rbac.assignment.read` | Rol atamalarını görme | Üye (O), B.Yrd.+ (U), YK (B) |
| `rbac.assignment.request` | Rol ataması talep etme | [Atama kuralları](atama-kurallari.md) tablosuna göre |
| `rbac.assignment.approve` | Dört göz onayı gereken atamayı onaylama | [Atama kuralları](atama-kurallari.md) tablosuna göre |
| `rbac.assignment.revoke` | Rol atamasını sonlandırma | [Atama kuralları](atama-kurallari.md) tablosuna göre |

## 3. Kişiler ve üyelik

| İzin | Açıklama | Verilen roller (kapsam) |
|---|---|---|
| `people.directory.read` | Ad-soyad, birim, rol, profil fotoğrafı | Üye (B) |
| `people.contact.read` | E-posta, telefon | Üye (O), Koor.+ (U), YK (B), Üyelik (B) |
| `people.profile.read_full` | Bölüm, sınıf, IEEE üye no ve diğer profil alanları | Üye (O), Üyelik (B) |
| `membership.status.manage` | Üyelik başvurusu onay/ret, askıya alma | Üyelik (B) |

## 4. Görev ve proje

| İzin | Açıklama | Verilen roller (kapsam) |
|---|---|---|
| `project.read` | Proje görüntüleme | Gön.+ (U), YK (B) |
| `project.manage` | Proje açma, kapatma, sorumlu belirleme | B.Yrd.+ (U) |
| `task.read` | Görev görüntüleme | Üye (O), Gön.+ (U), YK (B) |
| `task.create` | Görev oluşturma ve atama | Koor.+ (U) |
| `task.update_status` | Durum, not ve dosya bağlantısı güncelleme | Üye (O: sorumlu ve destek verenler), Koor.+ (U) |
| `task.manage` | Başlık, sorumlu, tarih değiştirme; iptal | Koor.+ (U) |

**YK birimi kuralı:** Başkan, KBY ve GS, `board` birimindeki proje ve görevlerde B.Bşk. izinlerine sahiptir. YK üyeleri `board` biriminde Koor. izinlerine sahiptir.

## 5. Etkinlik

| İzin | Açıklama | Verilen roller (kapsam) |
|---|---|---|
| `event.read` | Etkinlik temel bilgileri (ad, tarih, yer, birim, durum) | Üye (B) |
| `event.propose` | Etkinlik önerisi oluşturma | Koor.+ (U) |
| `event.approve` | YK onay kararını işleme | Başkan (B), KBY (B), GS (B) |
| `event.manage` | Ekip, görev planı, bütçe planı, HeptaCert bağlantısı, kapatma | Üye (O: etkinlik sorumlusu), B.Yrd.+ (U) |
| `event.participant.read` | Katılımcı listesi (kişisel veri) | Üye (O: etkinlik sorumlusu), B.Bşk. (U) |
| `event.participant.import` | HeptaCert CSV/API aktarımını başlatma | Üye (O: etkinlik sorumlusu), SysAdm (B, yalnızca sayısal sonuç görür) |
| `event.report.approve` | Etkinlik sonu raporunu kontrol ve onay | Üye (O: etkinlik sorumlusu), GS (B) |

## 6. İletişim

| İzin | Açıklama | Verilen roller (kapsam) |
|---|---|---|
| `content.request.create` | İçerik talebi açma | Koor.+ (U) |
| `content.request.read` | İçerik taleplerini görme | Üye (O: talep eden), Gön.+ (U: iletişim birimi), YK (B) |
| `content.request.manage` | Talep onayı, sorumlu atama, yayın takvimi | Koor.+ (U: iletişim birimi) |

## 7. Sponsorluk ve finans

| İzin | Açıklama | Verilen roller (kapsam) |
|---|---|---|
| `sponsor.read` | Sponsor havuzu ve görüşme geçmişi | Sponsor (B), Sayman (B), Başkan (B), KBY (B) |
| `sponsor.manage` | Sponsor kaydı, aşama, sorumlu atama | Sponsor (B) |
| `sponsor.interaction.create` | Görüşme kaydı ekleme | Sponsor (B), Üye (O: görüşmeye atanan kişi) |
| `finance.read` | Bütçe özetleri ve finansal belge bağlantıları | Sayman (B), Başkan (B), Danışman (B), B.Bşk. (U: kendi birim/etkinlik bütçesi) |
| `finance.manage` | Bütçe kaydı, gerçekleşen tutar, belge bağlantısı | Sayman (B) |

Finansal kayıtların ana kaynağı Google Sheets ve Drive'dır (Bildirge §7). Hub yalnızca özet ve bağlantı tutar.

## 8. Raporlama

| İzin | Açıklama | Verilen roller (kapsam) |
|---|---|---|
| `report.ops.read` | Haftalık operasyon raporu | YK (B), B.Bşk. (U: birim kesiti) |
| `report.mgmt.read` | Aylık yönetim ve dönem sonu raporları | YK (B), Danışman (B) |
| `report.generate` | Raporu elle tetikleme | GS (B), SysAdm (B) |
| `report.approve` | Raporu resmî kabul etme | GS (B) |
| `vtools.package.manage` | vTools paketi hazırlama, durum güncelleme | vTools (B), GS (B) |
| `secretary.ledger.manage` | Toplantı, karar, gelen-giden evrak ve takip defterini yönetme | GS (B), Başkan (B) |
| `dataquality.read` | Veri kalitesi uyarıları | YK (B), B.Bşk. (U), SysAdm (B: yalnızca teknik uyarılar) |

## 9. E-Dilekçe

| İzin | Açıklama | Verilen roller (kapsam) |
|---|---|---|
| `petition.template.read` | Şablon kataloğu | Üye (B). Liste, şablonun `canCreate` kuralına göre süzülür. |
| `petition.create` | Dilekçe taslağı oluşturma ve gönderme | Üye (B) ve şablonun `canCreate` kuralı |
| `petition.read` | Dilekçe içeriği ve imza geçmişi | Üye (O: dilekçe sahibi; aktif adımda uygun imzacı; daha önce imzalamış kişi), B.Yrd.+ (U: dilekçe sahibinin birimi), GS (B), Başkan (B), Evrak (B) |
| `petition.withdraw` | Nihai karar öncesi geri çekme | Üye (O: dilekçe sahibi) |
| `petition.sign` | Onay / ret / iade | **Genel izin değildir.** Şablondaki adımın istediği rolü (veya ikame rolü) aktif olarak taşıyan kişi. [ADR-0013](../adr/0013-dilekce-onay-akisi.md) |
| `petition.template.manage` | Şablon sürümünü etkinleştirme / emekliye ayırma | Evrak (B), GS (B) |
| `petition.archive` | Arşivleme, arşiv kopyası oluşturma | Evrak (B), GS (B) |
| `petition.number.correct` | Hatalı evrak numarası düzeltme (gerekçe zorunlu) | GS (B) |
| `petition.verify` | Doğrulama kodu ile sınırlı üst veri sorgulama | Herkes, kimlik doğrulaması olmadan ([ADR-0015](../adr/0015-pdf-uretimi-ve-dogrulama.md)) |

## 10. Denetim ve sistem

| İzin | Açıklama | Verilen roller (kapsam) |
|---|---|---|
| `audit.read` | İş denetim kayıtları (rol, dilekçe, onay işlemleri) | Başkan (B), GS (B), Danışman (B) |
| `audit.read_technical` | Sistem, otomasyon ve eşitleme kayıtları | SysAdm (B), GS (B) |
| `system.config` | Sistem yapılandırması, entegrasyon ayarları | SysAdm (B) |
| `breakglass.request` | Acil erişim talebi | SysAdm (B) |
| `breakglass.approve` | Acil erişim onayı (talep edenden farklı kişi) | Başkan (B), GS (B) |

## 11. Değerlendirme notları

- `sys.admin` rolü bilerek hiçbir iş verisi okuma izni taşımaz (Bildirge §8.2: "TechOps, üye, sponsor veya finans verilerinin iş amacıyla sahibi değildir").
- Kişisel veri içeren izinler (`people.contact.read`, `people.profile.read_full`, `event.participant.read`, `petition.read`) her dönem başında YK tarafından gözden geçirilir (Bildirge §5.4).
- Görev ve aktiflik verileri kişisel sıralama için kullanılmaz (Bildirge §5.10). Bu nedenle "tüm gönüllülerin kişi bazlı performans listesi" gibi bir izin tanımlanmamıştır.
