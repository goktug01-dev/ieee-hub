# ADR-0040: Hub onayları siteye aktarılır; puan QR’ını ACTOR doğrular

- **Durum:** Kabul Edildi
- **Tarih:** 2026-10-03
- **İlgili:** ADR-0017, ADR-0027, ADR-0035, ADR-0036, ADR-0039; İKÇÜ 2025–2026 revizyon tüzüğü Madde 22, 24, 28–37
- **Karar dayanağı:** Kullanıcının Hub süreçlerini web sitesine otomatik aktarma isteği ve ACTOR’ün tüzükteki Aktiflik Denetleyicisi olduğuna ilişkin açıklaması.

## Bağlam

Salt uzak kayıt formları iş akışını karşılamaz. YK onayı tamamlanan Hub etkinlikleri sitedeki etkinlik takvimine düşmeli, YK başkanı/yardımcısı Hub üzerinden site duyurusu yayımlayabilmeli ve site üyelikleri Hub’dan yönetilebilmelidir. Tüzüğe göre puan komite ile ACTOR tarafından belirlenir, doğrulama ACTOR tarafından yapılır ve etkinlik sonrası puan değişmez. ACTOR bağımsız ve seçimle belirlenen görevdir; teknik yönetici ayrıcalığı bu görevin yerine geçmez.

## Karar

Hub etkinliği ve duyurusu kaynak kayıt olur. Yetkili kişinin açık Hub oturumu, kişinin site Firebase hesabıyla açtığı ikincil oturum üzerinden sunucudan doğruladığı kaynakları RTDB’ye aktarır. Spark planına uygun olarak sunucu ve zamanlanmış görev eklenmez. Bekleyen kaynaklar bağlantı yeniden açılınca taranır; kararlı kimlikler tekrar aktarımda mükerrer kayıt oluşturmaz. `siteSync` yalnız görünür aktarım makbuzudur ve kaynak sürümüyle eşleşmelidir.

- Onaylanmış etkinlikler `events/hub-{eventId}` yoluna yayımlanır. İptalde Hub’a ait uzak kayıt kaldırılır. Yalnız başlık, açıklama, başlangıç/bitiş ve konum aktarılır.
- `siteAnnouncements` kayıtları YK başkanı/yardımcısı veya açık duyuru izniyle yönetilir ve `public_announcements/hub-{id}` yoluna aktarılır. Yazar korunur; yayından kaldırma uzak kaydı kaldırır, Hub kaydını korur.
- Komite onaylı etkinlik için `eventPointRequests/{eventId}` kaydına puan, gerekçe ve son kullanım zamanı önerir. ACTOR onayı sonrası aynı kimlikli `committee_qrs/{siteCommittee}/hub-event-{id}` ve `valid_qrs/hub-event-{id}` atomik yazılır. Puan, oluşturma ve son kullanım zamanı değişmez; QR kapanabilir, silinmez. `hub_qr_audit` zaman damgalı ve eklemeli denetim kaydıdır.
- Yeni QR’ların süresi dolduğunda site kuralları normal üyelerin QR okumasını reddeder. Açık ACTOR oturumu etkinlik iptali/bitişi ve QR süresi için kapatma aktarımı da yapar.
- Hub ve site üyelikleri ayrı kalır. Site üyelik sorumlusu `approved`, sıralama ve gerekçeli üyelik denetimini atomik günceller; üyelik işlem yetkisi puan düzenleme izni sağlamaz.
- Hub birimi/site komitesi eşlemesi ve veri yolları yönetim arayüzünden düzenlenir. `site_access/{siteUid}` içindeki tarihli `calendar`, `announcements`, `qr`, `members` yetkilerini site admini verir. Hub rolü uzak projede kendiliğinden yetki oluşturmaz.

## Sonuçlar ve sınırlar

İki Firebase projesinin kuralları birbirini okuyamaz. Hub onayı Hub kurallarında, uzak yazma yetkisi site kurallarında doğrulanır. Uzak işlem yetkisi verilen kişilere güvenilir; site kuralları tek başına Hub onayını kanıtlayamaz. Tarayıcı kapalıyken anında veya kesintisiz aktarım garantisi yoktur. Başarısız aktarımlar kaybolmaz; sonraki yetkili oturumda tekrar denenir. Site kuralları Hub deploy’una eklenmez ve site projesinde ayrıca yayımlanır.

Mevcut ana sayfa duyuruları WordPress REST API’den okuduğu için RTDB’ye yazmak tek başına ana sayfayı değiştirmez. `firebase/site-home-integration.html` bir kez WordPress ana sayfasına eklenir. Hub Hosting’deki `site-announcements-widget.js`, herkese açık Hub duyurularını aynı bölümün başına ekler; eski WordPress duyurularını korur, metinleri HTML olarak çalıştırmaz ve yalnız HTTP(S) bağlantıları kullanır. Yükleme hatasında mevcut WordPress bölümü çalışmaya devam eder. Bu kurulum WordPress düzenleme erişimi gerektirir.

ACTOR rolünü tanımlamak veya atamak tüzükteki seçim/Denetleme onayı yerine geçmez; sistem görevin resmi sonucunu kaydeder. Eski site puan kazanma/tüketme algoritması bu değişiklikte yeniden yazılmaz.

## Doğrulama

Hub Firestore ve site RTDB emülatörleri rol ayrımını, puan değişmezliğini, üyelik iznini, QR kapanmasını ve yazar korumasını sınar. İstemci testleri kaynak onayını, atomik QR aktarımını, iptali, hata makbuzunu ve yeniden denemeyi kapsar. Canlı WordPress kurulumu ve gerçek üyeyle QR okutma ayrıca doğrulanır.
