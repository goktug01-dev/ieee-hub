# ADR-0025: Seçimler aşamalı yürütülür ve kesinleşen sonuç kilitlenir

- **Durum:** Kabul Edildi
- **Tarih:** 2026-09-26
- **Karar vericiler:** IEEE İKÇÜ TechOps; süreç sahibi onayı: Yönetim Kurulu
- **Onay kaydı:** Kullanıcı talebi, 2026-09-26
- **İlgili:** WP-10, WP-11, ADR-0017, ADR-0019

## Bağlam

Tek ekranda sonuç girmek; adaylık, seçmen/nisap, oy sayımı, tutanak, kesinleştirme ve göreve atama zincirini kanıtlamaz. Spark planında güvenilir sunucu ve gizli oy kasası olmadığı için istemci tabanlı çevrim içi oylama gerçek anonimlik iddiası taşıyamaz.

## Karar

Hub seçimleri taslak, adaylık, oylama/sayım, kesinleşti, görevlere uygulandı veya iptal durumlarıyla yönetir. Aşamalar atlanamaz. Seçmen sayısı, nisap, kullanılan/boş/geçersiz oylar, aday sonuçları, eşitlik çözümü, divan görevlileri, karar numarası ve tutanak bağlantısı kaydedilir. Kesinleşen sonuç değiştirilemez; yalnızca görev atamalarına uygulanabilir.

Hub, fiziksel gizli oy–açık sayım, açık oylama ve atama kayıtlarını yönetir. Güvenilir backend ve ayrı mahremiyet tasarımı olmadan çevrim içi gizli oy toplamaz ve anonimlik iddia etmez.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Aşamalı seçim/tutanak kaydı (seçilen) | Mevcut Spark mimarisinde denetlenebilir ve güvenli | Oy pusulasını çevrim içi toplamaz |
| İstemciden gizli oy toplamak | Kullanımı kolay görünebilir | Yöneticiler ve veri erişimi oy–seçmen bağını görebilir; gerçek gizlilik sağlamaz |

## Sonuçlar

**Olumlu:**
- Eksik nisap, tutarsız oy toplamı ve çözümlenmemiş eşitlik kesinleştirmeyi engeller.
- Seçim sonucu ile görev ataması arasında izlenebilir bağ kurulur.

**Olumsuz / maliyet:**
- Fiziksel seçimin tutanağı ve sayımı yetkili insanlarca sisteme girilir.

**Riskler ve önlemler:**
- Kesinleşmiş sonucun sonradan değiştirilmesi Firestore kurallarıyla engellenir.
- Çevrim içi gizli oy ileride istenirse güvenilir backend, seçmen uygunluğu, tek kullanımlık oy yetkisi ve bağımsız mahremiyet incelemesi gerekir.

## Uygulama notları

Yaşam döngüsü `ElectionDetailPage.tsx` ve `firebase/firestore.rules` içinde uygulanır. Seçim yöneticisi `elections.manage` iznine sahip olmalıdır.
