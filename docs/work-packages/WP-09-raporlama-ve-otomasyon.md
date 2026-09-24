# WP-09 — Raporlama ve Otomasyon

| | |
|---|---|
| **Durum** | Planlandı |
| **Paket sorumlusu** | TechOps geliştirici (belirlenecek) |
| **Süreç sahibi** | Genel Sekreter (içerik), TechOps (altyapı) |
| **Takvim** | Hafta 13–14 |
| **Bağımlılıklar** | WP-05, WP-06, WP-12 (veri kaynakları), ADR-0004 (zamanlanmış işler) |
| **İlgili ADR'ler** | ADR-0004, ADR-0009 |
| **Kaynak** | Bildirge §3.7, §9.9, §11, Ek C |

## Amaç

Operasyonel verileri yönetim ve faaliyet raporlarına otomatik veya yarı otomatik dönüştürmek. Raporlar insan kontrolünden geçmeden resmî kabul edilmez (Bildirge §5.6, §11.3).

## Mimari

```
Firestore (operasyon) ──► Functions (zamanlanmış dışa aktarım, kişisel veri süzülür)
                              │
                              ▼
               Google Sheets: report_* tabloları (raporlama veri katmanı)
                              │
               ┌──────────────┼──────────────┐
               ▼              ▼              ▼
        Looker Studio   Docs şablonu → PDF   vTools veri paketi
```

- `report_*` tabloları Bildirge §11.2'deki listeyle aynıdır. Buna `report_petitions` eklenir.
- Sheets'e yazım, kurumsal bir servis hesabıyla ve yalnızca `08_Raporlar/Veri` klasörüne yapılır.
- Rapor tablolarında kişi bazlı kimlik yerine **birim bazlı toplamlar** kullanılır. Kişi adı yalnızca "sorumlusu olmayan / geciken görev" gibi eylem gerektiren listelerde yer alır (Bildirge §5.10).

## Görevler

| ID | Görev | Hafta |
|---|---|---|
| WP09-T01 | `report_*` tablo şemaları (veri sözleşmesi) ve dışa aktarım fonksiyonu | 13 |
| WP09-T02 | `automationRuns` kaydı ve hata/yeniden deneme mekanizması (Bildirge §11.9–11.10) | 13 |
| WP09-T03 | Veri kalitesi kontrolleri (Bildirge §11.8 listesi + "7 günden uzun bekleyen dilekçe adımı", "sahipsiz kalacak rol") | 13 |
| WP09-T04 | Haftalık operasyon raporu: her pazartesi 09:00 (Europe/Istanbul); Hub içi sayfa + e-posta özeti | 14 |
| WP09-T05 | Aylık yönetim raporu: Docs şablonu doldurma → PDF → `08_Raporlar`; GS onayı | 14 |
| WP09-T06 | Etkinlik sonu raporu (Bildirge §11.3) | 14 |
| WP09-T07 | Looker Studio panoları: görev, etkinlik, katılım, sponsorluk hattı, dilekçe süreleri | 14 |
| WP09-T08 | vTools paketi: bildirilecek etkinlikler, eksik alanlar, metin/tablo çıktısı, durum takibi (Bildirge §11.7) | 14 |
| WP09-T09 | Dilekçe metrikleri: şablon ve birim bazında açılan/onaylanan/reddedilen sayıları, adım bazında ortalama onay süresi | 13 |

## Kabul kriterleri

- [ ] K1: En az bir etkinlik raporu, bir haftalık operasyon raporu ve bir aylık yönetim raporu sistem tarafından hazırlanmış (Bildirge §9.9).
- [ ] K2: Her rapor üretimi `automationRuns` kaydı bırakıyor. Başarısız çalıştırma sorumluya bildirim gönderiyor.
- [ ] K3: Aynı dönem için rapor ikinci kez üretildiğinde tablolarda çift satır oluşmuyor.
- [ ] K4: `report_*` tablolarında e-posta, telefon veya dilekçe içeriği bulunmuyor (otomatik kontrol).
- [ ] K5: vTools paketi test edilmiş (Bildirge §17 madde 13).
