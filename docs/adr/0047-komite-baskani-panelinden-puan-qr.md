# ADR-0047: Komite başkanı site panelinden puan QR'ı oluşturabilir

- **Durum:** Kabul Edildi; kullanıcı 2026-11-25 tarihinde “presidental paneli de açık bırakalım, ordan da atama yapabilelim” talimatını verdi.
- **Tarih:** 2026-11-25
- **İlgili:** ADR-0040 (QR yazma yetkisini genişletir; Hub ACTOR akışı aynen kalır)

## Bağlam

ADR-0040 site kurallarında `committee_qrs` ve `valid_qrs` yazmayı yalnız `site_access/{uid}/qr` yetkisine bağladı. Site kuralları yayımlanınca studentbranches president panelinden QR oluşturma kapandı. İlk canlı kullanımda Hub akışı komite eşlemesi eksikliği yüzünden aktarım yapamadı ve etkinlik günü QR üretilemedi. Kullanıcı eski panel yolunun da açık kalmasını istedi.

## Karar

Site RTDB kurallarında iki yol birlikte geçerlidir:

- **Hub / ACTOR yolu (değişmedi):** `site_access.qr` yetkisi olan hesap QR oluşturur; puan, oluşturma ve son kullanım zamanı değişmez; kayıt silinmez.
- **Panel yolu (geri açıldı):** Komite başkanı (`committees/{id}/presidentUid`) yalnız kendi komitesinin `committee_qrs/{id}/…` kaydını ve `committeeId` alanı kendi komitesi olan `valid_qrs/…` kaydını oluşturur, değiştirir ve siler. Site admini tüm komiteler için aynı işlemi yapar. `valid_qrs` kaydının komitesi sonradan değiştirilemez.
- `hub-` ile başlayan QR kimlikleri yalnız ACTOR yoluna aittir; başkan ve site admini bu kayıtları değiştiremez veya silemez.

## Sonuçlar

**Olumlu:** Hub aktarımı kesilse de komite etkinlik günü QR üretebilir; Hub kaynaklı QR'ların değişmezliği korunur.

**Olumsuz / maliyet:** Panelden açılan QR'larda puan ACTOR doğrulamasından geçmez ve sonradan değiştirilebilir; tüzükteki ACTOR doğrulaması bu kayıtlar için kurumsal süreçle sağlanmalıdır. Panel QR'ları `hub_qr_audit` denetim kaydına düşmez.

**Riskler ve önlemler:** Panel `valid_qrs` kaydına `committeeId` yazmıyorsa başkan yazması reddedilir; bu durumda panel kodu bu alanı ekleyecek şekilde güncellenir. Kurallar Hub dağıtımıyla değil, site projesinin Realtime Database › Rules ekranından ayrıca yayımlanır.

## Uygulama notları

`firebase/site.database.rules.json` ve `firebase/tests/site.database.test.ts` (`npm run test:site`).
