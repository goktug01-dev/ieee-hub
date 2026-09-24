# WP-07 — İletişim Yönetimi

| | |
|---|---|
| **Durum** | Planlandı |
| **Paket sorumlusu** | TechOps geliştirici (belirlenecek) |
| **Süreç sahibi** | İletişim birimi |
| **Takvim** | Hafta 11–12 |
| **Bağımlılıklar** | WP-11 |
| **İlgili ADR'ler** | ADR-0005 |
| **Kaynak** | Bildirge §3.5, §9.7 |

## Amaç

İçerik taleplerini ve yayınları planlı biçimde yönetmek. Talep eden birim, iletişim birimi ve yayın takvimi tek bir yerde birleşir.

## Veri modeli ve akış

`contentRequests/{id}`: `requestingUnitId`, `requestedBy`, `type` (duyuru, etkinlik tanıtımı, etkinlik sonrası paylaşım, sponsor teşekkürü, diğer), `channels` (Instagram, LinkedIn, X, web sitesi, e-posta, Discord), `desiredPublishDate`, `brief`, `draftText`, `assets` (Drive bağlantıları), `eventId?`, `assigneeUid`, `status`, `publishedAt`, `performance` (erişim, etkileşim; elle girilir).

```
requested → accepted → in_production → awaiting_approval → scheduled → published
         ↘ rejected (gerekçeli)
```

`awaiting_approval` durumunda talep eden birimin başkanı veya yardımcısı içeriği onaylar. Etkinlik tanıtımları için etkinliğin `approved` durumda olması zorunludur.

## Görevler

| ID | Görev | Hafta |
|---|---|---|
| WP07-T01 | Şema, kurallar, yetki matrisi §6 kural testleri | 11 |
| WP07-T02 | Talep formu (etkinlik sayfasından ön doldurmalı) | 11 |
| WP07-T03 | İletişim birimi panosu: gelen talepler, sorumlu atama, durum | 11–12 |
| WP07-T04 | Yayın takvimi görünümü (aylık/haftalık) | 12 |
| WP07-T05 | Yayın sonrası performans kaydı (elle giriş) | 12 |
| WP07-T06 | Haftalık rapora "Bekleyen içerik talepleri" bölümü | 12 |

## Kabul kriterleri

- [ ] K1: Yeni içerik talepleri, sorumlusu ve yayın tarihi bulunan ortak sistem üzerinden yürütülüyor (Bildirge §9.7).
- [ ] K2: Onaylanmamış etkinlik için tanıtım talebi `scheduled` durumuna geçemiyor (sunucu kontrolü).
- [ ] K3: Yayın takvimi, iletişim birimi dışındaki YK üyeleri tarafından görüntülenebiliyor.
