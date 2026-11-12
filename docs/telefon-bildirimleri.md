# Telefon bildirimleri

Mevcut telefona kurulabilen Hub uygulamasına Web Push eklenmiştir. Spark ve mevcut `web.app` alanı korunur. GitHub Actions gönderir; saatlerce gecikme olabilir. E-posta ve cihaz tercihleri birbirinden bağımsızdır. Karar: [ADR-0044](adr/0044-github-actions-ile-web-push.md).

## Bir defalık kurulum

1. `npm run push:setup` anahtarları üretir; özel anahtarı yalnız `PUSH_VAPID_KEYS` GitHub Secrets'a stdin ile kaydeder. Açık anahtar `PUSH_PUBLIC_KEY` variable'ıdır. Mevcut açık anahtar varsa değiştirmez. Şifre veya özel anahtar sohbete/dosyaya yazılmaz.
2. CI dağıtımı açık anahtarı yönetim formuna başlangıç değeri olarak verir. **Kurum ayarları → Telefon bildirim servisi**: genel anahtarı kontrol edin, servisi açıp kaydedin. Mail yürütücüsü erişimi ve `MAIL_ENABLED` de açık olmalıdır. Mail kurulumunu yeniden çalıştırmayın; aynı bot kullanılır.
3. Üyeler yeni sürüme girince çağrı otomatik görünür. **Bildirimleri aç** düğmesine dokununca tarayıcı sistem izni sorar. iPhone/iPad: iOS 16.4 veya sonrası, uygulamayı önce Ana Ekran'a ekleyip simgesinden açmak gerekir. Chrome/Android, Firefox ve Safari push uçları desteklenir; desteklenmeyen uç kaydedilmez.
4. **Profilim → Telefon bildirimleri** bölümünden bu cihazın görev ve dilekçe tercihleri ayrı değiştirilebilir veya kayıt kapatılabilir. Her cihazda ayrı izin verilir. Tarayıcı ayarından engellenmiş izin Hub tarafından geri açılamaz.
5. Kendi hesabınıza test görevi atayın; GitHub Actions → **Telefon bildirimleri** kuru kontrolünü çalıştırın. Ardından `dry_run=false` gerçek deneme yapın. Push servisinin kabulü telefonda görüntülendiğini tek başına kanıtlamaz. Gerçek telefon/işletim sistemi izni ayrıca doğrulanır.

Eski işler için üyeler cihazlarını kaydettikten sonra **Mevcut bekleyenleri kuyruğa al** düğmesini kullanın; mail ve push ayrı kuyruklara eklenir. Önceden gönderilen aynı kanal/cihaz bildirimi tekrarlanmaz. Toplu yeniden kuyruklama beş kaynaklık paketler kullanır; güvenlik kurallarının belge erişim sınırı korunur.

## Kontrol ve durdurma

`npm run test:push`, `npm run test:rules`, `npm run test:e2e` ve `npm run smoke:push` kullanılır. Tarayıcı testinde push sağlayıcısı taklit edilir; gerçek telefona veya dış ağa bildirim gönderilmez. Service worker testleri genel içerik ve güvenli Hub yönlendirmesini sınar.

Kurum ayarından telefon servisini kapatmak yeni push denemelerini durdurur; mail servisini veya `MAIL_ENABLED` değişkenini kapatmak iki arka plan kanalını da durdurur. Gönderilmekte olan bildirim geri alınamaz. Cihaz kayıtları ve özel uçları loglara yazılmaz. Üyelik askıya alındığında veya tüzük tedbiri varsa bot cihaz kaydını okuyamaz.
