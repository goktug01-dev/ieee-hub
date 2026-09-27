# ADR-0030: Demirbaşlar zimmet ve değiştirilemez hareket defteriyle izlenir

- **Durum:** Kabul Edildi
- **Tarih:** 2026-09-27
- **Karar vericiler:** IEEE İKÇÜ Yönetim Kurulu

## Bağlam

Laptop, kamera, stand, kablo ve benzeri fiziksel varlıkların kimde ve nerede olduğu kişisel tablolarla izlendiğinde dönem devirlerinde kayıt kaybı ve zimmet belirsizliği oluşur. Dijital sistem envanteri fiziksel varlık yaşam döngüsünü karşılamaz.

## Karar

1. Her fiziksel varlık `assets` koleksiyonunda demirbaş kodu, seri numarası, birim, konum, kondisyon, durum, zimmetli kişi, alım/garanti bilgisi ve notlarla tutulur.
2. Kayıt, zimmet, iade, taşıma, bakım, kayıp ve kullanım dışı işlemleri `assetMovements` içinde eklemeli ve değiştirilemez hareket olarak saklanır.
3. Demirbaş silinmez; kullanım dışı durumuna geçirilir. Her değişiklik yapan kişi ve sunucu zamanıyla kaydedilir.
4. QR etiketi Hub adresini ve demirbaş kimliğini taşır. QR erişim yetkisini aşmaz; kullanıcı gerektiğinde giriş yapar.
5. Yönetim `inventory.manage`, `finance.manage` veya `secretary.ledger.manage`; okuma ayrıca `finance.read` ve `work.manageAll` yetkilerine açıktır.

## Sonuçlar

Fiziksel envanter dönemler boyunca izlenebilir, zimmet sorumluluğu ve hareket geçmişi kaybolmaz. CSV dışa aktarımı sayım ve devir çalışmalarını destekler.

## Uygulama

Arayüz `apps/hub/src/pages/assets/AssetsPage.tsx`, işlem hattı `apps/hub/src/lib/assets.ts`, güvenlik sınırı `firebase/firestore.rules` içindedir.
