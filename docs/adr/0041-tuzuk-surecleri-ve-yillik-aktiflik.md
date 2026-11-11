# ADR-0041 — Tüzük süreçleri ve yıllık aktiflik

- Durum: Kabul Edildi
- Tarih: 2026-10-03
- Dayanak: Kullanıcının sağladığı İKÇÜ 2025–2026 revizyon tüzüğü; ADR-0017, ADR-0019 ve ADR-0040.

## Karar

Tüzük işlemleri değişmez `statutoryPolicies` sürümlerine bağlı `governanceCases` dosyalarında yürür. İmzalar makamın aktif rolünden gelir; teknik yönetici ayrıcalığı makam yerine geçmez. Kurul kararları kesinleşmiş Hub oylamasına, seçim ve Genel Kurul aşamaları tutanak kaydına bağlanır. Aşamalar atlanamaz; geçmiş imzalar değişmez. Gizli şikâyet yürütme ve teknik yönetici izinlerinden bağımsız olarak başvuran, Denetleme ve Danışmana açılır.

Tedbir ve kalıcı adaylık yasağı son onayla atomik yazılır. Geçici ACTOR tedbiri en fazla yedi takvim günüdür; eski karar tekrar kullanılarak uzatılamaz. Tedbir sonrası inceleme dosyası istemci tarafından aynı işlemde açılır. Savunma ve itiraz ekranı aktif Hub erişimi gerektirmez. Sürenin dolması otomatik ihraç veya onay üretmez.

Yıllık baraj önerisi dosya oluşturulurken kilitlenir; yayımlanan `activityYears` kaydı öneri ve dönem tarihleriyle eşleşmek zorundadır. `annualActivity` ACTOR doğrulaması ve farklı bir Denetleme görevlisinin kesinleştirmesini taşır. Normal üye yalnız kendi kaydını okur. Seçimden gelen kritik görev atamaları Denetlemenin değişmez aday uygunluk kaydı ve kazanan sonucu ile eşleşir. ACTOR için ayrıca seçim/onay/güven dosyası gerekir; YK görevinin sona ermesi ve ACTOR ataması aynı görev batch'inde yazılır.

Site eğitim yılı açılışı önceki kullanıcı kayıtlarını özel arşive alır, bakiyeleri sıfırlar ve yıllık kazanım başlangıcını kaydeder. İşlem ve arşiv tek RTDB çok-yollu güncellemesidir; aynı yıl yeniden açılamaz. Site yetkileri Hub yetkilerinden bağımsız, süreli `activity` ve `backup` kabiliyetleridir. Üye sıralaması normal üyelere kapatılır. Yeni site RTDB kuralları ayrı projede yayımlanmalıdır.

Süre ve yükümlülükler mevcut kaynaklardan hesaplanır: etkinlik arşivi, haftalık rapor, YK toplantısı, mazeretli/mazeretsiz devamsızlık, dönemsel teslimler, dijital devir, zimmet ve saklama süresi. Erişim hataları görünürdür. Bütçeyi onaylı duruma geçirmek tamamlanmış bütçe süreç dosyası ve mali belge gerektirir.

## Sınırlar

Spark kısıtı korunur: sunucu, zamanlanmış iş ve Cloud Functions eklenmez. Kapalı tarayıcıda aktarım/yedek çalışmaz. Yedek dosyaları tarayıcıda AES-256-GCM ile şifrelenir; parola sunucuya yazılmaz. İki ortama teslim kaydı kullanıcının belgelendirdiği teslimdir, depolama sağlayıcısı doğrulaması değildir.

Tüzüğün tamamı kendiliğinden yürütülmez. Fiziksel gizli oy, ıslak imza, SKS onayı, hukuki nitelendirme, devamsızlık mazereti, danışman kanaati ve dış hesap sahipliği belge ve yetkili incelemesi gerektirir. YK blok liste/tur usulü gibi fiziksel seçim koşulları tutanakta doğrulanır. Kaynak sitedeki mevcut QR kazanım verisi ACTOR/DK tarafından denetlenir; yıllık başlangıç hesabı eski puan yazım kodunu yeniden güvenli hâle getirmez. Bu sürüm, tüm tüzük maddelerinin otomatik veya teknik olarak doğrulandığı iddiasını taşımaz.

## Doğrulama

Kural testleri; gizlilik, makam/sıra, atomik tedbir, yedi günlük sınır, adaylık, yıllık baraj ve Genel Kurul koşullarını sınar. Gerçek istemci emülatör testi tedbir → takip dosyası → gizli itiraz → açık erişim iadesini yürütür. RTDB testleri yıl arşivi, tek seferlik açılış, sıralama gizliliği ve süreli yedek okumasını doğrular. Üretim yayını bu kontroller ve derleme sonrasında yapılır.
