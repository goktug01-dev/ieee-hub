# ADR-0036: Onaylanan etkinlikler canlı takvim görünümüne otomatik yansır

- **Durum:** Kabul Edildi
- **Tarih:** 2026-09-29
- **Karar vericiler:** IEEE İKÇÜ TechOps
- **Onay kaydı:** Kullanıcının onaylanan etkinlikleri takvimle eşitleme talebi, 2026-09-29
- **İlgili:** ADR-0017, ADR-0027

## Bağlam

Etkinlik kayıtları zaten Firestore'da tek güvenilir kaynak olarak tutulur. Aynı etkinliği ayrı bir takvim koleksiyonuna kopyalamak tutarsızlık ve Spark planında sunucu tarafı senkron ihtiyacı doğurur.

## Karar

Etkinlik Takvimi ayrı veri yazmaz; `events` koleksiyonundaki tarihi bulunan ve öneri/ret/iptal durumunda olmayan kayıtları canlı olarak gösterir. Böylece bir etkinlik onaylandığında takvimde otomatik görünür, tarihi veya durumu değiştiğinde ayrıca senkron işlemi gerekmez.

Harici takvimler için görünür etkinliklerden standart `.ics` dosyası üretilir. Bu dosya Google, Outlook ve Apple Takvim'e aktarılabilir; iki yönlü veya sürekli harici API senkronu değildir.

## Sonuçlar

Hub içi takvim her zaman etkinlik kaydıyla tutarlıdır ve ek güvenlik kuralı/arka uç gerektirmez. Harici takvime sürekli otomatik yazma istenirse hedef takvim, OAuth yetkileri ve çakışma politikası için ayrı bir karar gerekir.
