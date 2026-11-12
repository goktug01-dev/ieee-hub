# E-posta bildirimlerini açma

Gönderici: `techopsieee@gmail.com`. Firebase Spark ve mevcut public GitHub deposu kullanılır. Ayrı alan adı, Blaze veya sunucu kurulmaz. Bildirimler anlık değildir; yaklaşık 10 dakikada bir kontrol planlanır ve GitHub çalıştırmaları gecikebilir. Karar: [ADR-0043](adr/0043-github-actions-ve-gmail-ile-e-posta-bildirimleri.md).

## Bir defalık hesap bağlantısı

1. Kodun, Firestore kurallarının ve indekslerinin canlıya dağıtılmış olduğunu doğrulayın. Gmail hesabında [iki adımlı doğrulamayı ve uygulama şifresini](https://support.google.com/mail/answer/185833) açın. Bu seçenek hesap politikasına bağlı olarak kullanılamayabilir; bu durumda normal hesap şifresiyle denemeyin.
2. Kendi etkileşimli terminalinizde proje kökünde `npm run mail:setup` çalıştırın. Betik mevcut `gh` oturumunu ve deponun Firebase web değişkenlerini kullanır; hedefleri gösterir. Uygulama şifresini yalnız bu terminaldeki gizli giriş alanına yazın. Sohbete, `.env` dosyasına veya Hub formuna yazmayın.
3. Betik SMTP bağlantısını **mail atmadan** doğrular, ayrı ve yetkisiz bir Firebase Auth otomasyon hesabı oluşturur; Firebase kimliğini ve Gmail uygulama şifresini GitHub repository secrets içine stdin üzerinden kaydeder. Depoda Secrets/Variables yönetim yetkisi gerekir. Secret adları `MAIL_FIREBASE_CREDENTIALS` ve `MAIL_GMAIL_APP_PASSWORD`; variables `MAIL_SENDER_EMAIL` ve `MAIL_ENABLED` olur. Dağıtım servis hesabı kullanılmaz. Zamanlama `false` kalır.
4. Betiğin verdiği **Bildirim hesabı kimliği**ni Hub → Kurum ayarları → E-posta bildirim servisi alanına girin. Gönderici adresini kontrol edin; erişimi açıp **Bildirim ayarlarını kaydet** düğmesine basın. Bir Hub üyesini yürütücü seçmeyin.
5. GitHub Actions → **E-posta bildirimleri** → **Run workflow**: `dry_run` açıkken başlatın. SMTP doğrulanır ve uygun alıcılar değerlendirilir; mail atılmaz, günlük kota ve teslim kayıtları değişmez. Hub’daki son servis kontrolünde sonucu kontrol edin. İndeks hazır değilse veya bağlantı hatası varsa canlı gönderime geçmeyin.
6. Kendi doğrulanmış Hub hesabınıza bir test görevi atayın. Aynı workflow'u `dry_run` kapalı bir kez çalıştırın; kendi gelen kutunuzu ve Hub gönderim kaydını doğrulayın. SMTP kabulü gelen kutusuna teslim garantisi değildir. Sonra `gh variable set MAIL_ENABLED --repo goktug01-dev/ieee-hub --body true` ile periyodik gönderimi açın.

Kurulumu yeniden çalıştırmak yeni otomasyon kimliği üretir ve zamanlamayı kapatır; yeni UID Hub ayarına yazılmadan açılmaz. Eski kullanılmayan otomasyon hesabını Firebase Authentication’dan kaldırabilirsiniz. Gmail şifresi değişince veya Google uygulama şifresini iptal edince bağlantıyı yeniden kurun. Başarısız kurulumda oluşturulmuş yeni hesabın kaldırılması denenir; Secrets adları ve eski otomasyon hesapları konsoldan kontrol edilmelidir.

## Üyelerin ilk kullanımı

Doğrulanmış e-postası olan aktif üyeler yeni Hub sürümüne giriş yapınca kendi doğrulanmış adresleriyle alıcı dizinine eklenir. Profilim → **E-posta bildirimleri** üzerinden dilekçe ve görev maillerini ayrı ayrı kapatabilirler. E-posta/şifre hesabı doğrulanmamışsa aynı bölümden doğrulama bağlantısı gönderilir ve kontrol edilir.

İlk kurulumda üyeler giriş yaptıktan sonra yetkili yönetici **Mevcut bekleyenleri kuyruğa al** düğmesini kullanabilir. Görev rolü veya adresi sonradan değiştiyse aynı işlem güncel alıcıları tekrar çözer. Daha önce gönderilen aynı dilekçe adımı/revizyonu veya aynı görev ataması aynı kişiye yeniden gönderilmez.

Güncelleme (2026-11-12): Yeni kuyruk kaydında alıcı kaydı veya onay makamı bulunamazsa ilk 24 saat boyunca 30 dakika aralık hedefiyle yeniden kontrol edilir; GitHub gecikmeleri bu kontrolü de geciktirir. Süre sonunda veya kapatılmış tercihte kayıt işlenir. Eski sürümde işlenmiş kayıtlar kendiliğinden açılmaz; üyeler Profilim ekranında alıcı kaydının hazır olduğunu doğruladıktan sonra yönetici bekleyenleri yeniden kuyruğa almalıdır.

## İşleyiş ve sınırlar

- Hub gönderim, yeniden gönderim, onay/karar ve görev yazma işlemiyle aynı transaction içinde `mailSignals` kaydı yazar. Oryantasyon görevleri de normal görev oluşturma yolunu kullanır. Eski istemci, Firebase Console veya bu yazma işlevlerini kullanmayan başka bir sistem mail sinyali üretmez; mevcut bekleyenleri kuyruğa alma bunun için de kullanılabilir.
- Sinyalde alıcı adresi, mail metni veya dilekçe içeriği bulunmaz. Yürütücü gerçek kaydı okuyup güncel sorumlu/rolü çözer. Mailde yalnız Hub bağlantısı vardır. Dilekçe sahibi kendi dilekçesinin onaycısı olarak bildirilmez; zaten onay vermiş makam ve süresi bitmiş rol atlanır.
- Otomasyon yalnız işaretlenmiş kaynağı tekil okuyabilir; görev/dilekçe listesi, üye profilleri ve tüzük dosyalarına erişemez. Alıcı adresine erişim aktif üyelik ve tedbir kontrolüne bağlıdır; rol çözmek için erişim özetleri salt okunur açılır. Kaynaklara, rollere ve üyeliklere yazamaz.
- Günlük sayaç Türkiye takvimine göre gönderim **denemelerini** sayar. Varsayılan sınır tur başına 20, günlük 200; yönetici daha aşağı ayarlayabilir. Gmail’in diğer kullanımları ve sağlayıcı kotası ayrıca geçerlidir. Kayıtların işlenmesi Firestore Spark kotasından okuma/yazma tüketir; boş kuyrukta tüm geçmiş/üye koleksiyonları taranmaz.
- Geçici SMTP reddinde artan bekleme uygulanır. Kalıcı ret, kesilmiş gönderim veya kabulden sonra yazılamamış makbuz yöneticinin incelemesini gerektirir. **Yeniden dene** belirsiz teslimde çift mail üretebilir; arayüz bunun için açık uyarı gösterir. Tam olarak bir kez teslim garantisi verilmez.
- GitHub’da 60 gün depo etkinliği olmazsa zamanlama kapanabilir. Son servis kontrolünü izleyin. Bu sistem hukuki tebliğ ve kritik süreler için tek kanal değildir.

## Durdurma

Hub’daki servis erişimini kapatmak Firebase okuma/gönderim kaydı yetkisini hemen keser; alınmış ve SMTP’ye gönderilmekte olan bir mail geri alınamaz. `gh variable set MAIL_ENABLED --repo goktug01-dev/ieee-hub --body false` sonraki zamanlanmış işleri de durdurur. Gerekirse Gmail uygulama şifresini ve Firebase otomasyon hesabını iptal edin.

## Kontroller

`npm run test:mail` gönderim mantığını gerçek SMTP kullanmadan sınar. `npm run test:rules` hem yeni güvenlik kurallarını hem gerçek Firestore SDK ile kuyruk → kota → sahte SMTP → makbuz akışını çalıştırır. `npm run test:e2e` gerçek Hub yazma işlemlerini sınar. Gmail ile gerçek bağlantı ve gelen kutusu doğrulaması hesap bağlantısından sonra ayrıca yapılmalıdır.
