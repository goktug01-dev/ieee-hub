# ADR-0048: Site bağlantısı işlem yetkisini gösterir; vTools hazırlığı adımlarla yürütülür

- **Durum:** Kabul Edildi
- **Tarih:** 2026-11-27
- **Karar vericiler:** Proje sahibi
- **Onay kaydı:** Kullanıcının harici Firebase karmaşıklığını, ACTOR–studentbranches bağlantısını ve vTools doldurma sürecini iyileştirme talebi.
- **İlgili:** ADR-0027, ADR-0039, ADR-0040, ADR-0045, ADR-0046

## Bağlam

Tek yönetim ekranı bağlantı, kurulum, siteye giriş ve ham veri bakımını birlikte sunuyordu. Site oturumu sağlayıcısının temizliği sayfa geçişlerinde ve React StrictMode altında oturumu kapatabiliyordu. Girişin tamamlanması aktarım yetkisinin olduğu anlamına gelmiyordu. vTools formunda hangi bilginin nereden alınacağı ve resmî raporlamanın ne zaman tamamlandığı belirsizdi.

## Karar

Hub, site hesabını tek bağlantı kartından yönetir. Sağlayıcı kaldırılırken yalnız gözlemcisi kapatılır; Hub çıkışı veya hesap değişimi site oturumlarını kapatır. Kullanıcı kendi site yetkilerini uzak kurallara tabi olarak okur; QR için site yöneticiliği yerine açık, süreli QR yetkisi aranır. Tanı başarısızsa yetkili varsayılmaz. Uzak Firebase kuralları son yetki denetimidir; yeni Hub izni veya sunucu eklenmez.

Web sitesi bağlantısı, bağlantı durumu / kurulum / veri yönetimi sekmelerine ayrılır. Komite eşlemesi sitenin mevcut komite adlarıyla yapılır. Site yöneticisi, kişinin site UID’sine görev bitişiyle işlem yetkisi verir. Ham veri yolları gelişmiş bakım alanında kalır. ACTOR önce bekleyen önerileri, ardından doğrulanmış kayıtların aktarım durumunu görür.

vTools hazırlığı etkinlik bilgileri, kategori/katılım ve resmî gönderim takibi olmak üzere üç adımlıdır. Mevcut etkinlik ve kapanış verisi tekrar yazılmaz; form bilgileri kopyalanabilir. IEEE’nin resmî rehberleri arayüzden açılır. SPOID bilinmiyorsa hazırlık engellenmez; organizasyon birimi adı ve iletişim e-postası gereklidir. Katılım sayıları negatif veya kesirli olamaz ve toplamla eşleşmelidir. vTools adresi pozitif sayısal kimliğe çevrilir. Kullanıcı resmî etkinlik sonrası raporu gönderdiğini açıkça belirtmeden Hub’da bildirildi işaretlenmez. CSV çalışma dosyasıdır; otomatik resmî gönderim veya toplu yükleme iddiası yoktur.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Ortak bağlantı tanısı ve adımlı hazırlık (seçilen) | Mevcut ücretsiz yapıda anlaşılır hata ve işlem akışı | Site kuralları ve IEEE görev kaydı ayrıca doğru olmalı |
| Site yönetici hesabını paylaşmak | Tek hesapla giriş | Kişiye ait yetki ve izlenebilirliği bozar |
| vTools’a belgesiz otomatik gönderim | Daha az manuel giriş | Desteklenen entegrasyon ve yetki modeli yok |

## Sonuçlar

Site projesi kuralları Hub dağıtımıyla yayımlanmaz. Canlı siteye erişimi bulunmayan dağıtım hesabının IAM yetkisi bu arayüz değişikliğiyle aşılmaz. Site tanısı yalnız kendi yetki ve yönetici kayıtlarını okur; aktarım başarısı her kayıt için ayrıca tutulur.

`smoke:site-vtools` yalnız demo Auth/Firestore/RTDB emülatörlerinde gerçek tarayıcı ve gerçek site kurallarıyla bağlantı, yetki, oturum, QR aktarımı ve vTools hazırlığını sınar. Canlı veriye test kaydı yazılmaz.
