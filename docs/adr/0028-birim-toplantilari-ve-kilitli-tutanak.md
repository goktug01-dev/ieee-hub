# ADR-0028: Her birim yapılandırılmış toplantı tutanağı oluşturur

- **Durum:** Kabul Edildi
- **Tarih:** 2026-09-27
- **Karar vericiler:** IEEE İKÇÜ TechOps; süreç sahibi onayı: Yönetim Kurulu
- **Onay kaydı:** Kullanıcı talebi, 2026-09-27
- **İlgili:** WP-05, WP-09, WP-10, ADR-0022

## Bağlam

Sekreterlik Defteri kol genelindeki kronolojik resmî kayıtları Genel Sekreter için tutar. Komiteler ise kendi toplantılarında gündem, katılım, görüşme, karar, sorumlu ve son tarihleri ortak bir yapıda kaydedememektedir.

## Karar

Hub, `meetings` koleksiyonunda birim kapsamlı toplantı kayıtları tutar. Birim üyesi kendi biriminin tutanaklarını okur; `unit.meetings.manage`, `unit.manage`, `work.manageAll` veya `secretary.ledger.manage` yetkisi olanlar taslak oluşturur ve düzenler.

Tutanak; toplantı sayısı, tarih/saat/yer, başkan, tutanak sorumlusu, üyeler ve misafirler, sıralı gündem/görüşme maddeleri, karar numarası, oylama sonucu, sorumlu, son tarih, genel not ve sonraki toplantı tarihini içerir. Sistem bu veriden tarayıcıda Word belgesi üretir. Kesinleşen tutanak değiştirilemez ve silinemez.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Yapılandırılmış Hub kaydı + Word çıktı (seçilen) | Aranabilir, yetkili, takip edilebilir | Yeni ekran ve veri modeli gerekir |
| Yalnız Drive bağlantısı | Kolay | Kararlar ve sorumlular raporlanamaz; bağlantı kaybı riski |
| Sekreterlik Defterini tüm komitelere açmak | Tek ekran | Kol geneli evrak yetkisini gereksiz genişletir |

## Sonuçlar

**Olumlu:**
- Komiteler aynı tutanak standardını kullanır.
- Kararların sorumlusu ve son tarihi belge içinde kalır.

**Olumsuz / maliyet:**
- Kesinleştirme sonrası hata düzeltmek için yeni toplantı/düzeltme kaydı gerekir.

**Riskler ve önlemler:**
- Başka komite verisine erişim Firestore kurallarında birim üyeliğiyle sınanır.
- Taslak Word çıktısı açık biçimde “kesinleşmemiştir” damgası taşır.

## Uygulama notları

Ekranlar `apps/hub/src/pages/meetings/`, Word üretimi `apps/hub/src/lib/meetingDocx.ts`, güvenlik kuralları `firebase/firestore.rules` içindedir.
