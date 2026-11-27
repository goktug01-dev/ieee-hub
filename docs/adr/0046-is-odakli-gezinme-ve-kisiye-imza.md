# ADR-0046: İş odaklı gezinme, rol ayrımı ve kişiye imza

- **Durum:** Kabul Edildi
- **Tarih:** 2026-11-27
- **Karar vericiler / Onay kaydı:** Kullanıcının sistem genelinde sadeleştirme, kopya rol sorununu giderme ve kişiye imza gönderme talebi. Uygulama yereldir; canlı veri temizliği veya yayın yapılmadı.
- **İlgili:** ADR-0019, ADR-0020, ADR-0022, ADR-0024, ADR-0033, ADR-0040

## Bağlam

Geniş yetkili kullanıcılar aynı anda onlarca menü bağlantısı görüyordu. Ana sayfadaki komite özeti ile komite çalışma alanı aynı görevi tekrarlıyordu. Yapılacak iş ataması ile resmî görev ataması; fiziksel demirbaş ile dijital sistem envanteri benzer adlarla sunuluyordu. Rol seçimleri aynı adlı farklı kayıtları ayırt etmiyordu. Dilekçelerin bütün imza adımları bir makam gerektiriyordu.

## Karar

- Ana sayfa kişisel işleri özetler; komite özeti tek komite çalışma alanında bulunur. Bu alan etkinlik, toplantı, oda, görev, dilekçe, iletişim, bütçe, devir ve yetkili kullanıcılar için ilan yönetimine bağlantı verir. Başvuru yönetimi birim bağlantısını devralır.
- Günlük bağlantılar açık kalır; diğer bağlantılar Etkinlik ve iletişim, Ekip ve üyelik, Belgeler ve kaynaklar, Sistem yönetimi gruplarında açılır. Menü ve Ctrl/⌘+K ile açılan işlem araması aynı izinli kataloğu kullanır. Arama kayıt içeriklerini sorgulamaz; yapılabilecek işlemleri bulur.
- Resmî atama ekranı **Rol ve makam atamaları**, teknik envanter **Dijital sistem envanteri** adını kullanır. Yapılacak işler ve fiziksel demirbaş kendi ekranlarında kalır.
- Rol kataloğu aynı ad/kapsam kayıtlarını işaretler, aktif atamaları gösterir, izinleri isteğe bağlı açar. Arayüzden aynı ad/kapsamda yeni rol oluşturulması engellenir. Seçim kutuları aynı adlı rollerde kimliği gösterir. Farklı kapsamlar kopya sayılmaz. Mevcut roller kendiliğinden birleştirilmez veya silinmez; görev ve yayımlanmış şablon referansları korunur.
- Şablon yöneticisi bir imza adımını `recipientMode: person` olarak açabilir. Bu adımda gönderici kendisi dışında aktif bir Hub üyesi seçer. Varsayılan `role` davranışı mevcut şablonlarda değişmez. Gönderici bir makam adımını kişisel adıma çeviremez.
- Seçimler taslakta `stepRecipients` haritasında (adım indeksi → Auth UID) saklanır. Gönderimden sonra ve iade/yeniden gönderimde değişmez. Kişinin imzası `roleId: uid:<uid>`, `roleName: Kişisel imza` olarak kaydolur; resmî bir unvanı temsil etmez. Kendi dilekçesini imzalama, sıra atlama, eski imzaları değiştirme ve eski oturumla karar verme engelleri korunur.
- Kişiye imza zincirleri en çok 10 toplam adım ve 3 kişisel adımdır. Böylece alıcı doğrulaması Spark Security Rules belge erişim sınırına sığar. Gönderimde aktif üyelik kontrol edilir; karar anında aktif üyelik ve yürürlükteki erişim tedbirleri yeniden denetlenir.
- Alıcı UID'si görünürlük listesine eklenir. Rolü veya erişim belgesi olmayan aktif alıcı da onay kutusunu kullanabilir. Mail ve push aynı kişisel alıcıyı çözer; bildirim tercihleri ve mevcut kuyruk/kota kuralları geçerlidir.
- Kişiye imza içeren bir dilekçe, etkinliğin resmî makam onayı yerine kullanılamaz. Hem arayüz hem kurallar bu ayrımı uygular.
- Şablonlar ekranı, konu/açıklama ve kişisel imza adımı hazır gelen **Kişisel imza şablonu** taslağı oluşturabilir. Yönetici kontrol edip yayımlar. Canlı şablonlar otomatik değiştirilmez.
- Etkinlik sekmeleri hazırlık, iletişim, katılım, puan/QR ve kapanış sırasını izler; seçilen sekme adreste tutulur, yenileme ve geri/ileri gezinmesi çalışır.
- Doğrudan açılan komite adresi organizasyon verisi yüklenmeden geri yönlendirilmez. Word önizlemesi kart genişliğine göre ölçeklenir; dar ekranda belgenin kenarları kesilmez ve yazdırmada gerçek boyut korunur.

## Sonuçlar ve sınırlar

Bu değişiklik gezinme, isimlendirme, rol inceleme ve kişiye imza sorunlarını ele alır. Başvuru, gönüllülük, kurul koltuğu, resmî rol ve IEEE üyeliği farklı veri/yetki modelleridir; kayıtlar ad benzerliğine göre taşınmaz. Mevcut kopya rolleri kaldırmak için atamalar, açık dilekçeler, yayımlanmış şablonlar, kurul koltukları ve tüzük eşlemeleri ayrı incelenmelidir. Eski yayımlanmış şablon sürümleri değiştirilemez.

## Doğrulama

`usability.test.ts` menü izinlerini, Türkçe/ASCII aramayı, rol kapsam ayrımını ve kişisel onay uygunluğunu sınar. Kural testleri sahte alıcıları, görünürlük eksikliğini, imza taklidini ve alıcı değiştirmeyi reddeder; karma zincirde belge erişim sınırı ayrıca sınanır. Gerçek SDK testi kişisel gönderim → iade → revizyon → imza → Word çıktısını kapsar. Mail/push testleri kişisel alıcıyı kontrol eder. `npm run smoke:usability` demo ortamında menü, rol karşılaştırması, komite bağlamı, şablon hazırlama, kişisel imza ve mobil aramayı sınar.
