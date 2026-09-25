# WP-06 — Etkinlik Yönetimi ve HeptaCert Entegrasyonu

| | |
|---|---|
| **Durum** | Uygulandı; gerçek etkinlik pilotu bekliyor |
| **Paket sorumlusu** | TechOps geliştirici (belirlenecek) |
| **Süreç sahibi** | Etkinlik sorumluları; onay: Yönetim Kurulu |
| **Takvim** | Hafta 9–10 |
| **Bağımlılıklar** | WP-05 (görev planı), WP-11; isteğe bağlı WP-12 (etkinlik izin dilekçesi) |
| **İlgili ADR'ler** | ADR-0016, ADR-0013 |
| **Kaynak** | Bildirge §3.4, §6.6, §9.6, §10, §11.3 |

## Amaç

Etkinlikleri öneriden kapanış raporuna kadar tek bir süreç üzerinden yürütmek ve HeptaCert verilerinin kurumsal kopyasını IEEE İKÇÜ'nün kontrolünde tutmak.

## Etkinlik durum makinesi

Bildirge §9.6'daki 15 adımlık yaşam döngüsü aşağıdaki durumlara eşlenir:

| Durum | Bildirge adımları | Geçişi yapan |
|---|---|---|
| `proposed` | 1 Öneri | Koor.+ (`event.propose`) |
| `approved` / `rejected` | 2–3 Değerlendirme, onay | YK (`event.approve`) veya etkinlik izin dilekçesinin onayı |
| `planning` | 4–7 Ekip, bütçe/sponsor, görev planı, HeptaCert etkinliği | Etkinlik sorumlusu |
| `registration_open` | 8 Kayıt ve iletişim | Etkinlik sorumlusu |
| `held` | 9–10 Uygulama, check-in | Etkinlik sorumlusu |
| `closing` | 11–12 Kapatma, verilerin IEEE'ye aktarımı | Etkinlik sorumlusu |
| `reported` | 13 Otomatik rapor (kontrol edilmiş) | Etkinlik sorumlusu + GS (`event.report.approve`) |
| `archived` | 14–15 vTools hazırlığı, arşiv | vTools sorumlusu / Evrak |

**E-Dilekçe ile bağlantı:** WP-12 hazır olduğunda, etkinlik onayı "Etkinlik Düzenleme İzin Dilekçesi" üzerinden yürütülür. Dilekçe onaylanınca bağlı etkinlik (`event_ref` alanı) otomatik olarak `approved` durumuna geçer ve dilekçenin evrak numarası etkinliğe yazılır. WP-12 hazır değilse Hub'daki basit YK onay düğmesi kullanılır.

## Görevler

| ID | Görev | Hafta | Bağımlılık |
|---|---|---|---|
| WP06-T01 | Etkinlik kodu standardı `EVT-{YYYY}-{NNN}`; sunucu atar (`proposeEvent`) | 9 | — |
| WP06-T02 | Durum makinesi (`packages/shared/src/events/workflow.ts`) ve callable geçişler | 9 | T01 |
| WP06-T03 | Öneri formu ve YK onay ekranı | 9 | T02 |
| WP06-T04 | Etkinlik sayfası: ekip (`ownerUids` + ekip üyeleri), görev planı (WP-05 görevleri `eventId` ile), bütçe planı (WP-08), sponsorlar, HeptaCert bağlantısı, Drive klasörü | 9–10 | T02 |
| WP06-T05 | Drive etkinlik klasörü: `03_Etkinlikler/{dönem}/{kod}_{ad}` (ilk dönemde kontrol listesiyle elle; ikinci dönemde Apps Script) | 9 | WP-03 |
| WP06-T06 | HeptaCert CSV içe aktarım: yükleme, önizleme, hata listesi, idempotent yazım, `syncRuns` (ADR-0016) | 10 | — |
| WP06-T07 | Kapatma kontrol listesi: veri aktarımı yapıldı mı, görevler kapandı mı, dosyalar arşivde mi, bütçe gerçekleşeni girildi mi | 10 | T06 |
| WP06-T08 | Etkinlik sonu raporu verisinin hazırlanması (Bildirge §11.3); rapor üretimi WP-09'da | 10 | T07 |
| WP06-T09 | E-Dilekçe bağlantısı: `etkinlik-izin` dilekçesi onayı → etkinlik `approved` | 11–12 | WP-12 |
| WP06-T10 | HeptaCert API aktarımı (aşama 2, Secret Manager) | 13+ | ADR-0004 |

## Kabul kriterleri

- [ ] K1: En az bir gerçek etkinlik bu sürecin tamamı kullanılarak yürütülmüş (Bildirge §9.6).
- [ ] K2: Yeni etkinliklerin %100'ünde benzersiz etkinlik kodu var (Bildirge §14.3).
- [ ] K3: HeptaCert kullanılan etkinliklerde kurumsal kopya oluşturulmuş; `syncRuns` kaydında kaynak kayıt sayısı = eklenen + güncellenen + hatalı + tekrarlanan.
- [ ] K4: Aynı CSV'nin iki kez içe aktarılması çift kayıt üretmiyor (otomatik test).
- [x] K5: Etkinlik sorumlusu olmayan bir gönüllü katılımcı listesini göremiyor (kural testi).

## Uygulama güncellemesi (2026-09-25)

- Etkinlik durum makinesi, izin dilekçesi/YK onayı, görev bağı, kapanış listesi ve rapor arayüzde uygulanmıştır.
- HeptaCert aktarımı CSV/TSV başlık eş adlarını tanır, önizleme yapar, e-posta bazında idempotent yazar ve her aktarımda veri sözleşmesi sürümüyle mutabakat kaydı oluşturur.
- Hatasız aktarım, `dataTransferred` kontrolünü ve etkinlik raporundaki fiilî katılımcı sayısını otomatik günceller.
- Spark planında API anahtarı güvenli saklanamadığından HeptaCert REST API kullanılmaz; CSV/TSV kurumsal senkron yöntemidir.
- vTools Events/L31 için kategori, konum türü, IEEE/üye olmayan katılımcı ayrımı, SPOID ve resmî takip kimliği içeren form-hazırlık CSV'si üretilir. Resmî bildirim vTools'ta yetkili insan tarafından tamamlanır.
