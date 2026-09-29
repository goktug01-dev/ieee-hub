# ADR-0037: Etkinlik kısıtlamaları dönemlerden bağımsız ve denetlenebilir tutulur

- **Durum:** Kabul Edildi
- **Tarih:** 2026-09-29
- **Karar vericiler:** IEEE İKÇÜ TechOps; uygulayıcı yetki: üye yöneticileri
- **Onay kaydı:** Kullanıcının etkinliklere tekrar alınmaması veya yönetici dikkati gerektiren kişileri sonraki dönemlere aktarma talebi, 2026-09-29
- **İlgili:** ADR-0017, ADR-0019, ADR-0032

## Bağlam

Etkinlik güvenliğini veya düzenini ciddi biçimde bozan kişiler sonraki dönemlerde yeniden başvurabilir. Serbest metinli ve silinebilir bir “kara liste” hem kişisel veri hem de keyfî karar riski taşır. Etkinlik sorumlularının gerekçenin tamamını görmeden katılımcı aktarımında uygulanacak sonucu bilmesi gerekir.

## Karar

Sistem iki seviye kullanır: `blocked` katılım aktarımını engeller, `watch` sorumluya dikkat uyarısı gösterir. Tam kayıt `eventRestrictions` koleksiyonunda ad, e-posta, somut gerekçe, kaynak etkinlik/kanıt, süre, inceleme tarihi ve oluşturan/kaldıran denetim alanlarıyla tutulur. Kayıt silinmez; kaldırıldığında pasifleştirilir.

E-posta normalize edilip SHA-256 özetiyle `eventRestrictionIndex/{hash}` koruma indeksi oluşturulur. İndeks gerekçe ve açık kimlik taşımaz. Etkinlik sorumluları yalnız bildikleri e-postanın özetini tekil okuyabilir, indeksi listeleyemez. Katılımcı dokümanının kimliği aynı özet olduğundan Firestore Rules, etkin bir `blocked` kaydı varsa istemci atlatmaya çalışsa bile yazmayı reddeder.

Kısıtlamalar bir döneme bağlanmaz. Bitiş tarihi olmayan kayıt dönemler arasında sürer; süreli kayıt zaman dolunca katılımcı yazımını engellemez. Yalnız `members.manage` izni olanlar tam kayıt oluşturabilir, görebilir ve kaldırabilir.

## Sonuçlar

Kısıtlamalar dönem devrinde kopyalanmaz; zaten küresel ve süreklidir. Katılımcı aktarımı hem arayüzde hem güvenlik kurallarında korunur. Somut gerekçe, kanıt ve yeniden inceleme tarihi veri minimizasyonu ve hesap verebilirlik için zorunlu çalışma pratiğidir.
