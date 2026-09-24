# ADR-0018: Firestore bölgesi europe-west1; Hub üyeliği kendi kaydını tutar

- **Durum:** Kabul Edildi
- **Tarih:** 2026-09-24
- **Karar vericiler:** TechOps Başkanlığı
- **Onay kaydı:** Proje sahibinin 2026-09-24 tarihli talimatı (bölge: `europe-west1`). YK karar numarası işlenecek.
- **Yerini aldığı kararlar:** [ADR-0003](0003-hub-veri-deposu-firestore.md) §3–§5 (RTDB yansıması ve `europe-west3` önerisi). ADR-0003 §1 (operasyon verisi Firestore'da) geçerliliğini korur.
- **İlgili:** AS-09, AS-10, AS-11, ADR-0017

## Bağlam

- AS-11 cevaplandı: Firestore bölgesi **`europe-west1`** (Belçika). Bu seçim, veritabanı oluşturulurken yapılır ve **sonradan değiştirilemez**.
- ADR-0003, üye verisini RTDB'de tutup Hub'a bir tetikleyici fonksiyonla yansıtmayı öngörüyordu. Spark planında tetikleyici fonksiyon yoktur (ADR-0017).

## Karar

1. Hub'ın Firestore veritabanı (`(default)`) `europe-west1` bölgesinde oluşturulur. Spark planının ücretsiz kotası bu bölgede de geçerlidir.
2. Hub kendi üyelik kaydını tutar: `members/{uid}`. Hub'a ilk kez giriş yapan kişi `pending` (onay bekliyor) durumunda kaydedilir; `members.manage` iznine sahip kişi onaylar, askıya alır veya başvuruyu siler.
3. Mevcut RTDB üyelik sistemi (WordPress) değiştirilmez ve Hub'a otomatik bağlanmaz. İki kayıt arasındaki uyum ilk dönemde **elle** sağlanır (üye onay ekranında e-posta alan adı kontrolü yardımcı olur). Otomatik eşleme ileride bütçe/backend olursa yeni ADR ile değerlendirilir.
4. Hub, kişisel veriyi asgari tutar: ad-soyad, e-posta, isteğe bağlı telefon, bölüm ve öğrenci numarası (dilekçe formlarını otomatik doldurmak için).

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Hub'ın kendi `members` kaydı + elle onay (seçilen) | Spark'ta çalışır, basit, WordPress'e dokunmaz | Üye listesi iki yerde; elle uyum gerekir |
| Tarayıcıdan RTDB'yi doğrudan okumak | Tek kayıt | RTDB kurallarının Hub kullanıcılarına açılması gerekir; kural güvenliği bilinmiyor (AS-10) |
| Üyeliği tamamen Hub'a taşımak | Tek kayıt | WordPress sayfalarının yeniden yazılması; ilk dönem için gereksiz risk |

## Sonuçlar

**Olumlu:** Hub bağımsız çalışır; üye onayı Hub içinden yapılır.

**Olumsuz:** Üye kaydı iki sistemde tutulur. Bildirge §5.2 (tek ana kayıt) açısından geçici bir istisnadır; WP-04 kapsamında yeniden değerlendirilir.

**KVKK notu:** Veri AB içinde (Belçika) barındırılır. Yurt dışına aktarım değerlendirmesi Danışman ve üniversiteyle yapılır (AS-09). Bu ADR veri konumunu belirler, hukuki uygunluk hakkında karar vermez.
