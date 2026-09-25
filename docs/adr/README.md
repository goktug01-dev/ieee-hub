# Mimari Karar Kayıtları (ADR)

Süreç ve durum tanımları: [dokümantasyon kuralları §3](../dokumantasyon-kurallari.md). Yeni ADR için [şablonu](_sablon.md) kopyalayın.

**YK onayı** sütunu, kararın kişisel veri, yetki, imza, maliyet veya organizasyonu etkilediğini ve bu nedenle Yönetim Kurulu kabulü gerektirdiğini gösterir.

| No | Başlık | Durum | YK onayı | İlgili WP |
|---|---|---|---|---|
| [0001](0001-mimari-kararlarin-adr-ile-kaydi.md) | Mimari kararlar ADR ile kaydedilir | Önerildi | — | Tümü |
| [0002](0002-hub-uygulama-yigini.md) | Hub: TypeScript monorepo, React + Vite SPA, Firebase Hosting | Önerildi | — | WP-02 |
| [0003](0003-hub-veri-deposu-firestore.md) | Hub operasyon verisi Firestore'da; üye profili RTDB'de kalır | Kısmen yerini aldı (0018) | ✓ | WP-04, WP-11 |
| [0004](0004-guvenilir-backend-cloud-functions.md) | Güvenilir backend: Cloud Functions ve Blaze planı | Yerini Aldı (0017) | ✓ | Tümü |
| [0005](0005-rbac-modeli.md) | Kapsamlı, dönem bazlı RBAC modeli | Kısmen yerini aldı (0019) | ✓ | WP-11 |
| [0006](0006-yetki-uygulama-noktalari.md) | Yetki kontrolü: Functions esas, Security Rules derinlemesine savunma, custom claims yok | Yerini Aldı (0017) | — | WP-11 |
| [0007](0007-donem-bazli-rol-atamalari.md) | Rol atamaları döneme bağlı ve sürelidir | Önerildi | ✓ | WP-10, WP-11 |
| [0008](0008-kritik-atamalarda-dort-goz.md) | Kritik rol atamalarında dört göz ilkesi | Önerildi | ✓ | WP-11 |
| [0009](0009-degistirilemez-denetim-kaydi.md) | Değiştirilemez denetim kaydı | Önerildi | ✓ | WP-11 |
| [0010](0010-teknik-erisim-ve-acil-erisim.md) | TechOps teknik erişimi iş verisini kapsamaz; acil erişim süreci | Önerildi | ✓ | WP-11 |
| [0011](0011-dilekce-sablonlari-kod-olarak.md) | Dilekçe şablonları depoda sürümlü JSON olarak tutulur | Yerini Aldı (0020) | — | WP-12 |
| [0012](0012-rol-bazli-elektronik-onay.md) | Rol bazlı sistem içi elektronik onay (5070 e-imzası değildir) | Önerildi | ✓ | WP-12 |
| [0013](0013-dilekce-onay-akisi.md) | Dilekçe onay akışı: sıralı adımlar, ikame, koşullu adım | Önerildi | ✓ | WP-12 |
| [0014](0014-evrak-numaralandirma.md) | Evrak numarası gönderimde, sunucuda, seri bazlı atanır | Önerildi | ✓ | WP-12 |
| [0015](0015-pdf-uretimi-ve-dogrulama.md) | PDF sunucuda üretilir, QR ile doğrulanır | Yerini Aldı (0021) | — | WP-12 |
| [0016](0016-heptacert-aktarimi.md) | HeptaCert aktarımı: önce CSV, backend hazır olunca API | Önerildi | — | WP-06 |
| [0017](0017-ucretsiz-spark-plani-kurallar-tek-guvenilir-katman.md) | Ücretsiz Spark planı; sunucu kodu yok, Security Rules tek güvenilir katman | Kabul Edildi | ✓ | Tümü |
| [0018](0018-firestore-bolgesi-europe-west1-ve-hub-uyeligi.md) | Firestore bölgesi europe-west1; Hub üyeliği kendi kaydını tutar | Kabul Edildi | ✓ | WP-04, WP-11 |
| [0019](0019-organizasyon-roller-ve-secimler-arayuzden-duzenlenir.md) | Organizasyon, roller, dönemler ve seçimler arayüzden düzenlenir | Kabul Edildi | ✓ | WP-10, WP-11 |
| [0020](0020-dilekce-sablonlari-word-tabanli.md) | Dilekçe şablonları Word (.docx) tabanlıdır; yüklenir veya sistemde oluşturulur | Kabul Edildi | — | WP-12 |
| [0021](0021-belge-ciktisi-tarayicida-docx-ve-dogrulama.md) | Belge çıktısı tarayıcıda (.docx + yazdır/PDF); herkese açık doğrulama kaydı | Kabul Edildi | — | WP-12 |
| [0022](0022-birim-calisma-alanlari-ve-sekreterlik-defteri.md) | Birim çalışma alanları ve Sekreterlik Defteri | Kabul Edildi | ✓ | WP-05, WP-09, WP-10 |

> 2026-09-24: Blaze planı alınamadığı (AS-06) için sunucu gerektiren kararlar ADR-0017…0021 ile güncellendi. "Uygulama notu" taşıyan ADR'ler geçerlidir, ancak uygulama noktaları ADR-0017'ye göre uyarlanmıştır.
