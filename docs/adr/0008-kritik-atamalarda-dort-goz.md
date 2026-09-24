# ADR-0008: Kritik rol atamalarında dört göz ilkesi

- **Durum:** Önerildi
- **Tarih:** 2026-09-22
- **Karar vericiler:** TechOps Başkanlığı; onay: Yönetim Kurulu
- **İlgili:** WP-11, [atama kuralları §2](../rbac/atama-kurallari.md), Bildirge §5.6, §15


> **Uygulama notu (2026-09-24):** Bu karar **henüz uygulanmadı.** İlk sürümde kritik izinli rollerin ataması tek kişiyle yapılır; arayüz kritik izinler için uyarı gösterir ve her atama denetim kaydına yazılır. Dört göz, sunucu kodu olmadan da kurallarla (bekleyen atama + farklı onaylayan) uygulanabilir; sonraki sürümde ele alınacak. Bkz. [ADR-0017](0017-ucretsiz-spark-plani-kurallar-tek-guvenilir-katman.md), [ADR-0019](0019-organizasyon-roller-ve-secimler-arayuzden-duzenlenir.md).

## Bağlam

Bildirge §5.6: "Yetki verme gibi kritik işlemler insan kontrolü olmadan tamamlanmayacaktır." Tek bir yöneticinin hesabı ele geçirilirse veya bir yönetici hata yaparsa, kol geneli yetkiler (üye verisi, dilekçe onayı, finans) yanlış kişilere verilebilir.

## Karar

1. [Atama kuralları tablosunda](../rbac/atama-kurallari.md) "Dört göz: Evet" olan roller, bir kişinin **talebi** ve **farklı** bir yetkilinin **onayı** ile aktif olur.
2. Talep eden, onaylayan ve atanan kişi birbirinden farklı olmalıdır. Bu kontrol sunucuda yapılır.
3. Bekleyen talep 7 gün içinde onaylanmazsa düşer (`lapsed`).
4. Birim içi alt roller (`unit.coordinator`, `unit.volunteer`) dört göz gerektirmez. Bunları birim başkanı veya başkan yardımcısı tek başına atar, işlem denetim kaydına yazılır. Gerekçe: günlük operasyonun yavaşlamaması ve bu rollerin kişisel veri kapsamının dar olması.
5. **Sonlandırma** dört göz gerektirmez.
6. Sistemin ilk kurulumu için tek seferlik **ön yükleme** betiği kullanılır ([atama kuralları §4](../rbac/atama-kurallari.md)).

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Kritik rollerde dört göz (seçilen) | Tek hesap ele geçirilmesine karşı koruma | Onaycı bulunamazsa gecikme olur |
| Tüm atamalarda dört göz | En güvenli | Gönüllü eklemek bile YK onayı ister; kullanılabilirlik düşer (Bildirge §5.9) |
| Dört göz yok, yalnızca denetim kaydı | Hızlı | Hasar sonradan fark edilir |

## Sonuçlar

**Olumlu:** Kol geneli yetkiler iki kişinin bilgisi dahilinde verilir.

**Olumsuz:** YK'da aynı anda en az iki aktif onaycı bulunmalıdır. Bu yüzden devir raporu, onaycı sayısı 2'nin altına düşecekse uyarı üretir.

**Riskler:** İki yöneticinin birlikte kötüye kullanımı engellenemez. Bu durum denetim kaydı ve Danışmanın `audit.read` erişimiyle tespit edilebilir.

## Uygulama notları

- Callable'lar: `requestRoleAssignment`, `approveRoleAssignment`, `rejectRoleAssignment`, `revokeRoleAssignment`.
- Bekleyen talepler için onaycılara uygulama içi bildirim ve e-posta gönderilir.
- Onay ekranı, atanacak kişinin mevcut rollerini ve talebin gerekçesini gösterir. Gerekçe alanı zorunludur.
