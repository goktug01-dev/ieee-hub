# WP-04 — Üye ve Gönüllü Yönetimi

| | |
|---|---|
| **Durum** | Planlandı |
| **Paket sorumlusu** | TechOps geliştirici (belirlenecek) |
| **Süreç sahibi** | Üyelik sorumlusu (`fn.membership`) |
| **Takvim** | Hafta 7–8 |
| **Bağımlılıklar** | WP-11 (roller, `people` yansıması), WP-01 (RTDB şeması) |
| **İlgili ADR'ler** | ADR-0003, ADR-0007 |
| **Kaynak** | Bildirge §3.2, §6.4, §8.6, §9.4 |

## Amaç

Üyelik ve gönüllülük yaşam döngüsünü standartlaştırmak: başvuru → değerlendirme → kabul → oryantasyon → birim ataması → görev alma → dönem değerlendirmesi → ayrılma ve erişim kapatma.

## Kapsam

**Dahil:** RTDB kurallarının gözden geçirilmesi; Hub'da üyelik durumu yönetimi (RTDB'ye yazan callable); gönüllü başvurusu ve birime kabul; oryantasyon kontrol listesi; profilde görev geçmişi; ayrılma süreci.

**Hariç:** WordPress üyelik sayfalarının yeniden yazılması; üye verisinin Firestore'a taşınması (ADR-0003).

## Çıktılar

| # | Çıktı |
|---|---|
| Ç1 | Gözden geçirilmiş ve testli RTDB güvenlik kuralları |
| Ç2 | Üyelik yönetimi ekranı (`fn.membership`) |
| Ç3 | Gönüllü başvuru akışı (üye → birim seçimi → birim başkanı kararı → `unit.volunteer` ataması) |
| Ç4 | Otomatik oryantasyon görev listesi |
| Ç5 | Profil: aktif roller ve görev geçmişi |
| Ç6 | Ayrılma akışı |

## Görevler

| ID | Görev | Hafta | Bağımlılık |
|---|---|---|---|
| WP04-T01 | RTDB kurallarını incele: kişi yalnızca kendi profilini okuyup yazabilmeli; üyelik durumu alanını yalnızca sunucu yazabilmeli. Emulator testleri. | 7 | WP01-T05 |
| WP04-T02 | `setMembershipStatus` callable: `fn.membership` izni; RTDB'ye yazar; denetim kaydı; `people` yansıması tetikleyiciyle güncellenir | 7 | WP11-T04 |
| WP04-T03 | Üyelik başvuruları listesi ve karar ekranı | 7 | T02 |
| WP04-T04 | Gönüllü başvurusu: üye birim seçer, kısa motivasyon yazar → birimin `unit.chair`/`unit.vice_chair`'ına düşer → kabul edilirse `unit.volunteer` ataması (dört göz gerekmez) | 8 | WP-11 |
| WP04-T05 | Oryantasyon: kabul edilen gönüllüye otomatik görevler (Discord kanalı, Google Group, Hub kullanım kılavuzu, KVKK ve gizlilik taahhüdü) | 8 | WP-05 |
| WP04-T06 | Profil sayfası: aktif roller, görev geçmişi (süresi dolmuş atamalar), kendi görevleri | 8 | WP-11 |
| WP04-T07 | Ayrılma: kişi veya birim başkanı başlatır → tüm atamalar sonlandırılır → erişim görevleri oluşur ([atama kuralları §7](../rbac/atama-kurallari.md)) | 8 | WP-11 |
| WP04-T08 | Dönem sonu değerlendirme formu (birim başkanı doldurur, kişisel sıralama yok, yalnızca birime görünür) | 8 | — |

## Kabul kriterleri

- [ ] K1: Yeni gönüllülerin tamamı standart başvuru ve oryantasyon sürecinden geçiyor (Bildirge §9.4). Pilot dönemde başvuru kaydı olmadan oluşturulan `unit.volunteer` ataması sayısı 0.
- [ ] K2: RTDB'de üyelik durumu alanına istemciden yazma denemesi kural testinde reddediliyor.
- [ ] K3: Ayrılan kişilerin %100'ünde Hub rolleri aynı gün, harici erişim görevleri 7 gün içinde kapatılmış.
- [ ] K4: Üyelik durumu `suspended` yapılan kişi, 1 dakika içinde Hub'da hiçbir birim verisini okuyamıyor.

## Riskler

| Risk | Olasılık | Etki | Önlem |
|---|---|---|---|
| RTDB kural değişikliğinin çalışan WordPress üyelik sayfalarını bozması | Orta | Yüksek | Kurallar önce staging'de, WordPress sayfalarının staging kopyasıyla test edilir |

## Açık sorular

- AS-10
