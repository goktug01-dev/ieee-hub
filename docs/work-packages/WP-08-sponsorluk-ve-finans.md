# WP-08 — Sponsorluk ve Finans

| | |
|---|---|
| **Durum** | Planlandı |
| **Paket sorumlusu** | TechOps geliştirici (belirlenecek) |
| **Süreç sahibi** | Sayman, Sponsorluk sorumlusu |
| **Takvim** | Hafta 11–12 |
| **Bağımlılıklar** | WP-11; isteğe bağlı WP-12 (harcama talebi dilekçesi) |
| **İlgili ADR'ler** | ADR-0005 |
| **Kaynak** | Bildirge §3.6, §4.4, §7, §8.7, §9.8, §14.4 |

## Amaç

Sponsor ilişkilerini ve bütçeleri dönemler arasında aktarılabilir hâle getirmek. Aynı sponsorla farklı kişilerin eşzamanlı iletişime geçmesini önlemek.

## Kapsam

**Dahil:** Sponsor havuzu, görüşme geçmişi, aşama takibi, sonraki işlem tarihi, sponsor sorumluluğu (kilit), etkinlik/birim bütçe özeti ve Sheets bağlantısı, finansal belge bağlantıları.

**Hariç:** Muhasebe kaydı. Finansal kayıtların ana kaynağı Google Sheets ve Drive'dır (Bildirge §7). Hub yalnızca özet ve bağlantı tutar.

## Veri modeli

- `sponsors/{id}`: `companyName`, `sector`, `website`, `stage` (`prospect` → `contacted` → `proposal_sent` → `negotiating` → `agreed` \| `declined` \| `dormant`), `ownerUid` (sponsor sorumlusu, **tek kişi**), `nextActionDate`, `nextAction`, `proposalLinks`, `eventIds`, `history` özeti.
- `sponsors/{id}/interactions/{iid}`: `date`, `channel`, `summary`, `byUid`, `nextAction`.
- İletişim kişileri yalnızca **iş iletişim bilgisi** olarak tutulur (ad, unvan, iş e-postası). Kişisel telefon tutulmaz.
- `budgets/{id}`: `scope` (etkinlik/birim), `plannedTotal`, `actualTotal`, `sheetLink`, `lines` (özet kalemler), `status`.

## Görevler

| ID | Görev | Hafta |
|---|---|---|
| WP08-T01 | Mevcut sponsor Sheets verisinin Hub'a aktarımı (tek seferlik, doğrulamalı) | 11 |
| WP08-T02 | Sponsor şeması, kurallar, yetki matrisi §7 kural testleri | 11 |
| WP08-T03 | Sponsor listesi ve detay; aşama panosu | 11 |
| WP08-T04 | **Sponsor kilidi:** Başka birim bu sponsorla iletişime geçmek isterse, sponsor sorumlusuna talep gönderir. Havuzda sorumlusu olan sponsorun iletişim bilgisi yalnızca sorumlu ve `fn.sponsorship` tarafından görülür. | 12 |
| WP08-T05 | Sonraki işlem tarihi hatırlatmaları; sonraki işlemi olmayan aktif görüşmeler için veri kalitesi uyarısı | 12 |
| WP08-T06 | Bütçe özeti: planlanan/gerçekleşen karşılaştırması, Sheets bağlantısı | 12 |
| WP08-T07 | Harcama/avans talebi dilekçe şablonu (WP-12 ile): onaylanınca bütçe satırına bağlanır | 12 |

## Kabul kriterleri

- [ ] K1: Aktif sponsor görüşmelerinin %100'ünde sorumlu, aşama ve sonraki işlem tarihi var (Bildirge §9.8, §14.4).
- [ ] K2: Sayman, planlanan ve gerçekleşen tutarları etkinlik bazında karşılaştırabiliyor.
- [ ] K3: `fn.sponsorship`, Sayman, Başkan veya KBY olmayan bir kişi sponsor havuzunu göremiyor (kural testi).

## Riskler

| Risk | Olasılık | Etki | Önlem |
|---|---|---|---|
| Finans verisinin Hub ve Sheets'te çift ana kayıt hâline gelmesi | Orta | Yüksek | Hub'da yalnızca özet; ayrıntı Sheets'te; tutar düzenleme yalnızca Sayman |
