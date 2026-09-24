# WP-05 — Görev ve Proje Yönetimi

| | |
|---|---|
| **Durum** | Planlandı |
| **Paket sorumlusu** | TechOps geliştirici (belirlenecek) |
| **Süreç sahibi** | Komite ve proje sorumluları |
| **Takvim** | Hafta 7–8 |
| **Bağımlılıklar** | WP-11 (izinler ve kurallar) |
| **İlgili ADR'ler** | ADR-0005, ADR-0006 |
| **Kaynak** | Bildirge §3.3, §4.2, §9.5, §11.8, §14.2, §15 |

## Amaç

Görevleri WhatsApp ve Discord mesajlarından çıkarıp, sorumlusu ve son tarihi belli, birim bazlı yetkiyle görülen ortak bir sisteme taşımak.

## Veri modeli

`tasks/{id}` alanları (Bildirge §9.5 zorunlu alanları):

| Alan | Zorunlu | Not |
|---|---|---|
| `code` | ✓ | Görev kimliği, birim kısa kodu ile: `CS-0042` |
| `title`, `description` | ✓ | |
| `unitId`, `projectId?` | ✓ / – | |
| `assigneeUid` | ✓ | **Tek sorumlu** |
| `supporterUids` | – | Destek verenler |
| `startDate`, `dueDate` | – / ✓* | *Hedef: görevlerin en az %90'ında (Bildirge §14.2) |
| `priority` | ✓ | `low` \| `normal` \| `high` \| `urgent` |
| `status` | ✓ | `todo` \| `in_progress` \| `blocked` \| `done` \| `cancelled` |
| `doneCriteria` | ✓ | Tamamlanma ölçütü |
| `fileLink` | – | Drive bağlantısı |
| `createdBy`, `createdAt`, `updatedAt`, `completedAt` | ✓ | |

## Görevler

| ID | Görev | Hafta | Bağımlılık |
|---|---|---|---|
| WP05-T01 | `tasks`, `projects` zod şemaları ve güvenlik kuralları; yetki matrisi §4 satırları için kural testleri | 7 | WP11-T09 |
| WP05-T02 | Görev kodu üretimi (birim bazlı sayaç, callable `createTask`) | 7 | T01 |
| WP05-T03 | "Görevlerim" ekranı (tüm birimlerden bana atananlar, son tarihe göre) | 7 | T01 |
| WP05-T04 | Birim panosu: liste ve kanban görünümü, filtreler (sorumlu, durum, öncelik, proje) | 7–8 | T01 |
| WP05-T05 | Proje sayfası: amaç, sorumlu, görevler, ilerleme, dosyalar, kapanış değerlendirmesi | 8 | T01 |
| WP05-T06 | Bildirimler: görev atandı; son tarihe 2 gün kaldı; gecikti (uygulama içi + günlük e-posta özeti) | 8 | — |
| WP05-T07 | İsteğe bağlı Discord webhook: birim kanalına "yeni görev / tamamlandı" bildirimi (kişisel veri içermez) | 8 | T06 |
| WP05-T08 | Veri kalitesi kontrolleri: sorumlusuz, son tarihsiz, gecikmiş görev (Bildirge §11.8) | 8 | WP-09 altyapısı |
| WP05-T09 | Geçiş kuralı duyurusu: devreye alma tarihinden sonra Hub'a girilmeyen iş resmî görev sayılmaz (Bildirge §15) | 8 | YK kararı |

## Kabul kriterleri

- [ ] K1: Devreye alma tarihinden sonra açılan resmî görevlerin %100'ü Hub'da (Bildirge §9.5, §14.2).
- [ ] K2: Görevlerin %100'ünde sorumlu ve durum alanı dolu (şema zorunluluğu).
- [ ] K3: Görevlerin en az %90'ında son tarih var (rapor ile ölçülür).
- [ ] K4: Başka bir birimin gönüllüsü, o birimin görev detayını okuyamıyor (kural testi).
- [ ] K5: Geciken görevler haftalık operasyon raporunda otomatik listeleniyor.

## Riskler

| Risk | Olasılık | Etki | Önlem |
|---|---|---|---|
| Görevlerin WhatsApp'ta devam etmesi | Yüksek | Orta | YK kararıyla geçiş kuralı; pilot; mobil uyumlu hızlı görev oluşturma |
| Sisteme veri girmenin bürokrasiye dönüşmesi (Bildirge §16) | Orta | Yüksek | Zorunlu alanlar asgari tutulur; hızlı oluşturma formunda yalnızca başlık, sorumlu, son tarih istenir |
