# ADR-0003: Hub operasyon verisi Firestore'da; üye profili RTDB'de kalır

- **Durum:** Kısmen yerini aldı — §3–§5 için [ADR-0018](0018-firestore-bolgesi-europe-west1-ve-hub-uyeligi.md); §1 geçerli
- **Tarih:** 2026-09-22
- **Karar vericiler:** TechOps Başkanlığı; onay: Yönetim Kurulu
- **İlgili:** WP-04, WP-11, Bildirge §5.2, §6.4, §7, AS-09, AS-10, AS-11

## Bağlam

- Mevcut üyelik sistemi Firebase Realtime Database (RTDB) kullanır ve çalışmaktadır. Bildirge §6.4, üye profillerinin RTDB'de kalmasını öngörür.
- Hub'ın verisi (görevler, etkinlikler, roller, dilekçeler) ilişkisel yapıdadır ve çok alanlı sorgu (birim + durum + tarih) gerektirir. RTDB'nin sorgu yetenekleri bu ihtiyaç için yetersizdir.
- Her veri türünün tek bir ana kaydı olmalıdır (Bildirge §5.2).

## Karar

1. Hub'ın operasyon verisi **Cloud Firestore**'da (Native mode) tutulur.
2. Üye profili ve üyelik durumunun ana kaydı **RTDB'de kalır.**
3. Hub, RTDB'deki üye verisinin asgari bir yansımasını `people/{uid}` koleksiyonunda tutar. Yansımayı yalnızca bir RTDB tetikleyici fonksiyonu (`onValueWritten`) günceller. Hub arayüzü RTDB'ye doğrudan bağlanmaz.
4. Üyelik durumu değişikliği Hub'dan yapılacaksa (`membership.status.manage`), callable fonksiyon **RTDB'ye** yazar. Yansıma tetikleyici üzerinden güncellenir. Böylece tek yazma noktası RTDB olarak kalır.
5. Firestore bölgesi `europe-west3` olarak önerilir (AS-11). Bu seçim **kalıcıdır.**

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Firestore + RTDB yansıması (seçilen) | Mevcut üyelik sistemi bozulmaz. Güçlü sorgu ve doküman bazlı güvenlik kuralları sağlanır. | İki veritabanı; yansıma tutarlılığı izlenmelidir. |
| Her şey RTDB'de | Tek veritabanı | Karmaşık sorgular istemcide yapılır, güvenlik kuralları yol bazlıdır, ölçeklenmez |
| Üyeliği de Firestore'a taşımak | Tek veritabanı | Çalışan WordPress üyelik sayfalarının yeniden yazılması gerekir. İlk dönem için gereksiz risk. İkinci dönemde yeni bir ADR ile değerlendirilebilir. |
| Harici SQL (Supabase, Cloud SQL) | İlişkisel model | Firebase Auth ile ek entegrasyon, maliyet, ikinci sağlayıcı |

## Sonuçlar

**Olumlu:** Üyelik sistemi değişmeden kalır. Hub hızlı başlar.

**Olumsuz:** Yansıma gecikmesi saniyeler düzeyindedir. Üyelik onayından hemen sonra Hub erişimi birkaç saniye gecikebilir.

**Riskler ve önlemler:**
- Yansıma kopabilir. Gece çalışan bir karşılaştırma işi RTDB ve `people` kayıt sayısını ve durumlarını karşılaştırır. Uyuşmazlıklar veri kalitesi uyarısı olarak raporlanır (Bildirge §11.8).
- RTDB güvenlik kuralları zayıf olabilir. WP-04'te RTDB kuralları gözden geçirilir (Bildirge §6.4).
- KVKK: Firebase verisi yurt dışında barındırılır. Hukuki değerlendirme Danışman ve üniversiteyle yapılır (AS-09). Bu ADR veri konumunu belirler, hukuki uygunluk hakkında karar vermez.

## Uygulama notları

- `people` yansımasına yalnızca Hub'ın ihtiyaç duyduğu alanlar kopyalanır: `displayName`, `email`, `membershipStatus`, `photoURL`. Telefon, bölüm vb. alanlar RTDB'de kalır ve `people.profile.read_full` izniyle callable fonksiyon üzerinden okunur.
- RTDB üye şeması WP-01'de belgelendiğinde (AS-10) bu ADR'ye alan eşleme tablosu eklenir.
