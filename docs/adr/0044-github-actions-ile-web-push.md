# ADR-0044: Mevcut GitHub Actions yürütücüsüyle Web Push

- **Durum:** Kabul Edildi; kullanıcı 2026-11-12 tarihinde “Gecikme olabilir; mevcut ücretsiz yapıyla ilerle” yanıtını verdi. Girişte bildirim izni çağrısının otomatik görünmesini ayrıca istedi.
- **İlgili:** ADR-0017, ADR-0042, ADR-0043

## Karar

Spark, mevcut Hosting alan adı ve GitHub Actions korunur. ADR-0043'teki dar arka plan yürütücüsü istisnası telefon Web Push gönderimine genişletilir; başka sunucu, ücretli servis veya Admin SDK eklenmez. Ayrı Auth botu Firestore kurallarına tabidir. Mail erişimi ve `MAIL_ENABLED` ortak ana durdurma denetimidir; `settings/push.enabled` yalnız push kanalını kapatır.

Push için ayrı sinyal, makbuz, günlük sayaç ve sağlık koleksiyonları kullanılır. Kaynak güncelliği, rol, görünürlük, aktif üyelik/tedbir ve cihaz tercihi gönderimden önce kontrol edilir. Aynı atama/adım + kişi + cihaz dedup anahtarıdır; SMTP'den bağımsızdır. Her iş için en fazla beş cihaz okunur; çalıştırma/günlük deneme sınırları mail ayarlarından alınır ve push sayacında ayrıca uygulanır. Belirsiz/kesilmiş gönderim kendiliğinden tekrarlanmaz. Açık geçici ret sonraki çalıştırmalara bırakılır, kalıcı ret işlenmiş sayılır. Yeni alıcı/makam ilk 24 saat sınırlı kontrol edilir.

VAPID özel anahtarı yalnız GitHub Secrets'a stdin üzerinden kaydedilir; genel anahtar repository variable ve Hub ayarındadır. Uç adresi ve şifreleme anahtarları yalnız cihaz sahibi ile aktif alıcı için bot tarafından okunur. Cihaz uçlarında yalnız Chrome/FCM, Firefox ve Apple'ın HTTPS push alanları kabul edilir. Kilit ekranı yükü genel görev/dilekçe türü ve rastgele görünümlü dedup etiketi içerir; kişi, başlık, içerik ve belge bağlantısı içermez. Tıklama yalnız Hub içindeki onay/görev sayfasını açar.

Aktif üye girişinde izin çağrısı otomatik görünür. Tarayıcı sistem izni yalnız kullanıcının düğmeye dokunmasıyla istenir; reddedilmiş izin otomatik tekrar istenmez. iPhone/iPad'de Ana Ekran kurulumu yönlendirmesi gösterilir. Oturum kapatmada mevcut cihaz aboneliğini kaldırma denenir; çevrimdışı çıkış bunu garanti edemez. Profilde cihaz kaydı ayrıca kapatılabilir. Özel içerik hiçbir durumda bildirim yüküne konmaz.

## Sınırlar

GitHub zamanlaması ve cihaz push servisleri gecikebilir; anlık teslim veya tam bir kez teslim garantisi verilmez. Eski kayıtlar üyeler cihazlarını açtıktan sonra yönetici tarafından yeniden kuyruğa alınır. Anahtar döndürme otomatik yapılmaz; yeniden abonelik gerektirir. Güvenlik sınırı Firestore kurallarıdır, arayüz gizleme değildir. Gerçek telefon teslimi üyelerin izin vermesinden sonra ayrıca sınanmalıdır.
