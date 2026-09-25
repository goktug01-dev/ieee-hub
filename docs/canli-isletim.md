# Canlı İşletim Kılavuzu

## Dağıtım

- `main` dalına gönderilen her değişiklik CI denetimlerinden geçer.
- Tür denetimi, üretim derlemesi, Firestore kural testleri ve uçtan uca testler başarılı olmadan canlı dağıtım başlamaz.
- Dağıtım Firebase Hosting, Firestore kuralları ve Firestore indekslerini birlikte günceller.
- Canlı hedef: `https://ieee-hub-techops.web.app`
- GitHub `production` ortamı dağıtım geçmişini tutar.

## Kimlik ve gizli bilgiler

- Dağıtımı `github-actions-deploy@ieee-hub-techops.iam.gserviceaccount.com` hesabı yapar.
- Hesap yalnızca Hosting, Firestore kuralları, indeksler ve servis kullanımı için gereken rollere sahiptir.
- JSON anahtarı yalnızca GitHub Actions `FIREBASE_SERVICE_ACCOUNT` secret kasasındadır; depoya ve `.env` dosyalarına girmez.
- Anahtar yılda en az bir kez ve erişim şüphesinde derhal yenilenir; eski anahtar IAM ekranından silinir.
- `VITE_` değişkenleri gizli değildir ve tarayıcı paketinde görünür. HeptaCert anahtarı gibi sırlar burada tutulmaz.

## İzleme

- `Canlı Sağlık Kontrolü` işi her gün ana sayfa ile giriş, dilekçe ve şablon rotalarını denetler.
- Başarısız CI, dağıtım veya sağlık kontrolü GitHub Actions ekranından incelenir.
- Uygulama içi yetki, şablon ve iş akışı değişiklikleri Denetim Kaydı ekranından izlenir.

## Geri dönüş

1. Firebase Console → Hosting → Sürümler bölümünde son çalışan sürümü belirleyin.
2. Acil durumda o sürümü yeniden yayınlayın.
3. Kaynak kodda hatalı değişikliği yeni bir geri alma commit'iyle düzeltin; geçmişi zorla değiştirmeyin.
4. CI tamamlanınca düzeltilmiş sürüm otomatik yayımlanır.

## Dönemsel kontroller

- Aylık: başarısız iş akışları, bağımlılık PR'ları, üye/rol atamaları ve denetim kayıtları.
- Dönem başı: kurum ayarları, aktif dönem, komiteler, SPOID, vTools sorumlusu ve onay zincirleri.
- Dönem sonu: Firebase, GitHub, Google Drive, Groups, HeptaCert ve ortak hesap erişimlerinin devri/kapatılması.
- Üç ayda bir: gerçek bir etkinlikle dilekçe → görev → HeptaCert aktarımı → kapanış raporu → vTools paketi kabul testi.
