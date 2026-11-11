# ADR-0042: Hub telefona kurulabilen web uygulaması olarak sunulur

- **Durum:** Kabul Edildi
- **Tarih:** 2026-11-11
- **Karar dayanağı:** Kullanıcının uygulamanın telefonlara kurulabilmesi isteği.
- **İlgili:** ADR-0017, ADR-0031

## Karar

Mevcut React uygulaması manifest, PNG simgeler ve standalone görünümüyle PWA olarak sunulur. Giriş ekranı, kullanıcı menüsü ve Yardım ekranındaki “Uygulamayı yükle” seçeneği desteklenen tarayıcıda kurulum isteği açar; diğer durumda Android/masaüstü ve iPhone/iPad adımlarını gösterir. Otomatik kurulum penceresi yalnız kullanıcı tıklamasıyla açılır. Kariyer alan adı kendi manifestini kullanır.

Üretimde HTTPS veya localhost üzerinde bir servis çalışanı kaydedilir. Yalnız kişisel veri içermeyen `/offline.html` önbelleğe alınır. Uygulama sayfaları, JS, Firebase yanıtları, kimlik doğrulama yardımcı yolları ve kullanıcı belgeleri servis çalışanı önbelleğine girmez. Bağlantı kesilince gezinme için yeniden deneme ekranı, açık uygulamada bağlantı uyarısı gösterilir. Bu karar mevcut Firebase istemcisinin önbellek davranışını değiştirmez; tüm verinin cihazda saklanmadığı iddiası taşımaz.

Servis çalışanı ve manifest yeniden doğrulanan HTTP başlıklarıyla yayımlanır. Yeni uygulama kodu normal ağ isteğiyle alınır; eski uygulama kabuğunu saklayan bir offline-first önbellek eklenmez. Firestore kuralları ve erişim yetkileri bu değişiklikte değiştirilmez.

## Sınırlar

Güncel kayıtlar, giriş ve işlem yapma internet gerektirir. İlk açılış bağlantısızsa kurulum ve bağlantı ekranı henüz cihaza indirilemez. Gerçek cihazın tarayıcısına bağlı kurulum adımları değişebilir; uygulama mağazası paketi oluşturulmaz. Kurulum push veya e-posta izni vermez.

E-posta bildirimleri ayrı karardır. Kullanıcı 2026-11-11 tarihinde harici hizmet eklenmeden önce seçeneklerin görüşülmesini istedi. Bu değişiklik mail sağlayıcısı, arka plan hizmeti, Blaze geçişi veya canlı dağıtım içermez; ADR-0017 geçerlidir.

## Doğrulama

Tip denetimi ve üretim derlemesine ek olarak yerel tarayıcıda manifest/simgeler, kurulum yardım penceresi, servis çalışanının kaydı, bağlantısız gezinme, yalnız statik uyarının önbelleğe alınması ve ağ geri geldiğinde yeniden deneme sınanır. Gerçek Android/iPhone kurulumunun doğrulanması ayrıca gerekir.
