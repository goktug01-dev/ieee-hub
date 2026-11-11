# ADR-0043: GitHub Actions ve Gmail ile e-posta bildirimleri

- **Durum:** Kabul Edildi; kullanıcı GitHub Actions + Gmail çözümünü ve `techopsieee@gmail.com` göndericisini açıkça seçti.
- **Tarih:** 2026-11-11
- **İlgili:** ADR-0017, ADR-0019, ADR-0042

## Bağlam

Kullanıcı bekleyen işler ve yeni dilekçeler için otomatik mail istiyor. Alan adı satın alınmayacak, ayrı sunucu kurulmayacak ve Firebase Spark korunacak. Önceki “sunucu kodu yok” kararı, dışarıda çalışan zamanlanmış mail kodunu da kapsadığından bu istisna kabul edilmeden yürütücü eklenmez.

## Karar

Mevcut public GitHub deposundaki standart Linux Actions çalıştırıcısı mail işini periyodik yürütür; gönderici kulübün mevcut Gmail hesabıdır. Yeni alan adı, Firebase Blaze, yeni barındırma sağlayıcısı veya sürekli açık bilgisayar gerekmez. Bu çözüm arka plan kodu içerir; “sunucu kodu yok” kararına yalnız bildirim gönderimi için sınırlı istisnadır. Hub onayları, yetki kararları ve veri değişiklikleri Firestore Security Rules ile doğrulanmaya devam eder.

İlk kapsam:

- Yeni dilekçe veya onay adımı, yalnız o anda ilgili birim ve rolü taşıyan onaycılara bildirilir. Dilekçe sahibi kendi dilekçesinin onaycısı sayılmaz.
- Yeni görev veya sorumlu değişikliği, güncel görev sorumlusuna bildirilir. Tamamlanmış/iptal edilmiş işler ve görevden ayrılmış üyeler bildirim oluşturmaz.
- Gönderim öncesi kaynak durum ve alıcı erişimi yeniden kontrol edilir. Dilekçe metni, ekleri, savunma ve gizli süreçler mailde yer almaz; kullanıcı ilgili Hub sayfasına yönlendirilir.
- Alıcı adresi tarayıcıdan gelen serbest bir `to` alanından alınmaz. `mailRecipients/{uid}` belgesini yalnız adresi Firebase Auth'ta doğrulanmış aktif hesap kendi token'ındaki e-posta adresiyle yazabilir. Güncel erişim ve bildirim tercihi gönderimden önce yeniden kontrol edilir.
- Kaynak sürümü ve alıcı kimliğine bağlı gönderim kaydı tutulur. Aynı olayın her taramada yeniden gönderilmesi engellenir; hata, yeniden deneme ve günlük gönderim sınırı izlenir. SMTP kabulü ile kayıt yazımı arasında kesinti olursa tam olarak bir kez teslim garantisi verilemez; belirsiz durum görünür tutulur.

## Kimlik bilgileri ve yetki

Gmail için iki adımlı doğrulama ve hesaba uygunsa ayrı uygulama şifresi kullanılır. Şifre yalnız GitHub Actions secret olarak saklanır; sohbete, repoya, Firestore'a veya `VITE_` değişkenine yazılmaz. Kullanıcının normal Gmail şifresi kullanılmaz. Gönderici hesabı tercihi ve Google hesap adımı kullanıcı tarafından tamamlanmalıdır.

Firebase dağıtım hesabı mail için yeniden kullanılmaz. Ayrı ve Hub üyeliği olmayan Firebase Auth kimliği `settings/mail.workerUid` ile tanınır. Yürütücü yalnız sinyali bulunan kaynakları tekil okur, rol çözümü için `access` kayıtlarını salt okunur sorgular ve aktif/tedbirsiz alıcıların mail tercihlerini tekil okur. Üye profilleri, genel kaynak listeleri ve gizli tüzük dosyaları açılmaz. Yalnız `mailDeliveries`, `mailDaily`, `mailHealth` ve sinyalin işlem durumu yazılır. Genel yönetici/IAM yazma yetkisi verilmez.

Hub işlemleri `mailSignals/{kind}_{id}` belgesini kaynakla aynı transaction'da günceller. Kurallar kaynak sürümünü ve çağıranın kaynak erişimini doğrular; mail adresi/metni kabul etmez. Eski istemci veya Console işlemi sinyal üretmez. Yönetici mevcut bekleyenleri açıkça kuyruğa alabilir. İlk girişte doğrulanmış üyeler varsayılan açık operasyon tercihleriyle alıcı dizinine eklenir; Profilim'den kapatabilirler. Dizin kaydı olmayan alıcıya mail gönderilmez.

İş akışı yalnız varsayılan dalda zamanlanır veya yetkili kişi tarafından elle çalıştırılır. PR koduna gönderim sırları verilmez. Tek eşzamanlı yürütme kullanılır; ilk doğrulama gerçek alıcılara mail atmadan kuru çalıştırmadır.

## Maliyet ve teslim sınırları

Public depoda standart GitHub-hosted çalıştırıcılar ücretsizdir; depo görünürlüğü ve çalıştırıcı türü değişirse bu varsayım yeniden değerlendirilir. Firestore okumaları/yazmaları Spark kotasından düşer; her turda bütün üye ve geçmiş dilekçe koleksiyonunu taramak yerine sınırlı bekleyen işler işlenmelidir. Gmail'in hesap ve günlük gönderim sınırları ayrıca geçerlidir; ücretsiz sınırsız mail sözü verilmez.

Önerilen ilk kontrol aralığı 10 dakikadır. Bu, teslim süresi garantisi değildir: GitHub yoğunlukta çalıştırmayı geciktirebilir veya düşürebilir. Public repoda 60 gün etkinlik olmazsa zamanlama kapanabilir. Hub içinde son başarılı çalışma ve hata bilgisi görünür olmalı; mail resmî tebliğ veya kritik süreler için tek kanal sayılmamalıdır.

## Kabul ve doğrulama

Güvenlik kuralları ve gerçek SDK testleri; rol süresi, üyelik tedbiri, yanlış alıcı, sahte mail işi, mükerrer gönderim, kota, SMTP hatası, yeniden deneme ve kapatılmış kaynak davranışını kapsar. Gmail bağlantısı `npm run mail:setup` ile kullanıcı terminalinde tamamlanır; zamanlama ilk kurulumda kapalı kalır. Gerçek SMTP doğrulaması ve ilk test maili tamamlanmadan gerçek teslim iddiası yapılmaz. Ayrıntılar: [kurulum](../e-posta-kurulumu.md).

## Kaynaklar

- [GitHub Actions ücretsiz public repo kullanımı](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [GitHub zamanlama, gecikme ve hareketsizlik sınırları](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [Google uygulama şifreleri](https://support.google.com/mail/answer/185833)
- [Gmail gönderim sınırları](https://support.google.com/mail/answer/22839)
