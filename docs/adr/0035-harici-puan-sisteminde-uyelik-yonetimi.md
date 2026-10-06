# ADR-0035: Harici puan sisteminin üyelik durumu Hub'dan yönetilir

- **Durum:** Kabul Edildi
- **Tarih:** 2026-09-29
- **Karar vericiler:** IEEE İKÇÜ TechOps
- **Onay kaydı:** Kullanıcının puan ve üyelik sisteminde ek yönetim araçları talebi, 2026-09-29
- **İlgili:** ADR-0027, ADR-0033

## Bağlam

IEEE Puan Realtime Database'i Hub Firestore'undan ayrı kalmalıdır. Bununla birlikte yöneticilerin yalnız puanı değil üyelik onayını, teknik kilitleri, KVKK ve eski/eksik alanları da tek ekrandan kontrol etmesi gerekir.

## Karar

Hub uzak projeye ikincil kullanıcı oturumuyla bağlanır. Üyelik onayı tekil veya toplu değiştirilebilir; askıya alma kullanıcı kaydını silmez. Üyelik değişikliği, herkese açık sıralamanın yeniden kurulması ve gerekçeli denetim kaydı tek atomik çok-yollu RTDB güncellemesiyle yazılır. Hub'ın kendi izni uzak projede yetki sağlamaz; uzak Firebase Security Rules son güvenlik katmanıdır.

Kullanıcı verisi Hub Firestore'una kopyalanmaz. Arama, filtre, veri kalitesi uyarısı ve CSV üretimi tarayıcıdaki canlı uzak veri üzerinde yapılır.

## Sonuçlar

Yöneticiler onaysız, teknik kilitli veya veri sorunu bulunan üyeleri bulabilir; üyeleri gerekçeli biçimde onaylayabilir ya da askıya alabilir. Uzak kurallar yazmaya izin vermiyorsa tüm işlem başarısız olur ve sıralama kısmen güncellenmez.
