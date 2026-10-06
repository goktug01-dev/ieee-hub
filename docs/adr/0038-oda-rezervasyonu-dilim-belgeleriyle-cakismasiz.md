# ADR-0038: Oda rezervasyonu yarım saatlik dilim belgeleriyle çakışmasız tutulur

- **Durum:** Kabul Edildi
- **Tarih:** 2026-10-06
- **Karar vericiler:** TechOps Başkanlığı (depo sahibinin talebi)
- **İlgili:** WP-05, WP-11, ADR-0017, ADR-0019

## Bağlam

Kulüp odası mülakat, komite toplantısı ve benzeri işler için ortak kullanılıyor. Saatler mesajlaşma gruplarında sözlü ayrıldığı için aynı saate iki komite gelebiliyor. İstenen: odanın kullanım saatleri birbiriyle çakışmasın, biri mülakat için odayı almışken başkası aynı saate toplantı koyamasın ve rezervasyonu yalnızca komite başkanları yapabilsin.

Spark planında sunucu kodu yoktur ([ADR-0017](0017-ucretsiz-spark-plani-kurallar-tek-guvenilir-katman.md)); çakışma denetimi istemcide bırakılamaz. Firestore kuralları ise koleksiyon sorgulayamaz ve döngü kuramaz: "bu aralıkla kesişen başka rezervasyon var mı" sorusu kurallarda doğrudan sorulamaz.

## Karar

1. Oda günü yarım saatlik 48 dilime bölünür. Alınan her dilim `roomSlots/{odaId}_{YYYY-AA-GG}_{dilim}` kimlikli tek bir belgedir. Kurallar kimliğin belgedeki oda, tarih ve dilimle birebir aynı olmasını şart koşar; dilim belgesi güncellenemez. Aynı dilim için ikinci belge oluşturulamadığından çakışma, istemci ne gönderirse göndersin kurallarda engellenir.
2. Bir rezervasyon, ortak `groupId` taşıyan bitişik dilimlerdir ve tek batch ile yazılır: dilimlerden biri doluysa hiçbiri yazılmaz. Ayrı bir "rezervasyon" üst belgesi tutulmaz; takvim dilim belgelerinden birleştirilir.
3. Rezervasyonu yalnızca ilgili birimde `unit.room.reserve` izni olan kişi, kendi birimi adına yapar. Varsayılan kurulumda bu izin yalnızca komite başkanı (`birim-baskani`) rolündedir; başkan yardımcısı dahil diğer rollere **Roller ve yetkiler** ekranından verilebilir ([ADR-0019](0019-organizasyon-roller-ve-secimler-arayuzden-duzenlenir.md)). Takvimi her aktif üye okur.
4. Odalar `rooms` koleksiyonunda arayüzden tanımlanır (`org.manage`): ad, konum, açılış ve kapanış dilimi, en fazla kaç gün sonrasına rezervasyon yapılabileceği, açık/kapalı durumu. Oda silinmez, kapatılır. Kurallar dilimin oda saatleri içinde, henüz bitmemiş ve izin verilen ufuk içinde olmasını denetler.
5. İptal, dilim belgelerini silmektir. Rezervasyonu yapan kişi, birimin `unit.room.reserve` yetkilisi (örneğin göreve yeni gelen başkan) veya organizasyon yöneticisi iptal eder. Bitmiş dilimler kullanım geçmişi olarak kalır; onları yalnızca organizasyon yöneticisi silebilir.
6. Tarih ve dilimler oda saatidir (Türkiye, UTC+3 sabit). Kurallar ve istemci aynı kaymayı kullanır; tarayıcının saat dilimi sonucu değiştirmez.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Dilim başına belge (seçilen) | Çakışma belge kimliğiyle kesin olarak engellenir; her belge kendi başına doğrulanır; eş zamanlı iki istekte ilk yazan alır | 3 saatlik rezervasyon 6 yazma; en küçük birim 30 dakika |
| Başlangıç–bitiş taşıyan tek rezervasyon belgesi | Tek yazma, serbest süre | Kurallar kesişen kaydı sorgulayamaz; çakışma yalnız istemcide denetlenir, yani güvenilmez |
| Gün başına tek belge, içinde dilim haritası | Tek belge, az okuma | Kurallarda döngü olmadığından eklenen dilimlerin sahipliği ve değerleri alan alan doğrulanamaz; iptal yetkisi dilim bazında ayrıştırılamaz |

## Sonuçlar

**Olumlu:**
- Aynı saat iki kez alınamaz; bu güvence arayüze değil kurallara dayanır.
- Sunucu kodu ve ek dizin gerekmez; haftalık takvim yalnızca `date` aralığıyla sorgulanır.
- Rezervasyon yetkisi koda sabit değildir, rol ekranından yönetilir.

**Olumsuz / maliyet:**
- Yazma sayısı süreyle artar (saat başına 2). Günde 20.000 yazma kotasında ihmal edilebilir.
- Rezervasyonun saati veya başlığı düzenlenemez; iptal edilip yeniden alınır.
- Yinelenen (her hafta) rezervasyon yoktur; her hafta ayrı alınır.

**Riskler ve önlemler:**
- *Batch başına belge erişim sınırı (20):* Her dilim yazımı kurallarda aynı üç belgeye bakar (`members/{uid}`, `access/{uid}`, `rooms/{id}`). Aynı belgeye tekrar erişim sınırdan yalnızca bir kez düşer; emülatörde 28 dilimlik (08:00–22:00) tek batch kural testiyle doğrulanır. Kurala dilime özgü yeni bir `get()` eklenirse bu test kırılır.
- *Mevcut kurulumlar:* Bu karardan önce oluşturulmuş rol belgelerinde yeni izin yoktur. Organizasyon yöneticisi komite başkanı rolüne "Oda rezervasyonu yap" iznini bir kez işaretler ve en az bir oda tanımlar; rol kaydı rolü taşıyanların erişim özetini yeniden hesaplar.
- *Saat dilimi:* Türkiye'de yaz saati uygulaması geri gelirse kurallardaki ve `lib/rooms.ts` içindeki UTC+3 kayması birlikte güncellenir.

## Uygulama notları

- Kurallar: `firebase/firestore.rules` → "Oda rezervasyonu" (`rooms`, `roomSlots`). Testler: `firebase/tests/modules.test.ts` → "oda rezervasyonu".
- İş mantığı: `apps/hub/src/lib/rooms.ts` (`createBooking`, `cancelBooking`, `groupBookings`, `validateBookingRequest`). İzin: `apps/hub/src/lib/permissions.ts` → `unit.room.reserve`.
- Arayüz: `apps/hub/src/pages/rooms/RoomsPage.tsx`, menüde **Operasyon › Oda rezervasyonu** (`/oda-rezervasyonu`).
- Reddedilen bir yazımda istemci o günün dilimlerini yeniden okur; neden çakışmaysa kullanıcıya "Bu aralık az önce doldu" iletisini gösterir.
