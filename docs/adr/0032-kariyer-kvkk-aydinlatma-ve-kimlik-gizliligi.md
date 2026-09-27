# ADR-0032: Kariyer başvurularında KVKK aydınlatması zorunludur ve yönetici kimliği adaya açılmaz

- **Durum:** Kabul Edildi
- **Tarih:** 2026-09-27
- **Karar vericiler:** Proje sahibi; TechOps
- **Onay kaydı:** Proje sahibinin 2026-09-27 tarihli talepleri (kulüp dışına gereksiz bilgi gösterilmemesi; zorunlu KVKK metni)
- **İlgili:** ADR-0017, ADR-0029, ADR-0031

## Bağlam

ADR-0031 ile açılan kariyer vitrini kulüp dışındaki kişilere açıktır. İki eksik vardı:

1. Herkese açık `recruitmentCalls` belgesinde ilanı açanın uid ve adı, adayın okuyabildiği `recruitmentApplications` belgesinde değerlendirenin uid ve adı duruyordu. Arayüz göstermese de bu alanlar istemciden okunabiliyordu.
2. Adaydan kişisel veri toplanırken KVKK md. 10 kapsamında bir aydınlatma metni gösterilmiyor, adayın hangi metni gördüğü kaydedilmiyordu.

## Karar

- İlanı açanın kimliği `recruitmentCalls/{id}/internal/meta`, son değerlendirenin kimliği `recruitmentApplications/{id}/internal/review` alt belgesinde tutulur. Bu belgeleri yalnız ilgili birim yöneticisi (`recruitmentManager`) okur. Kurallar ana belgeyle alt belgenin aynı batch'te ve işlemi yapanın kendi uid'siyle yazılmasını zorunlu kılar. Böylece kimin yaptığı bilgisi korunur, dışarıya açılmaz.
- Eski belgelerdeki `createdBy`/`createdByName`/`reviewedBy`/`reviewedByName` alanları kurallarca kabul edilmez. İstemci her güncellemede bu alanları `deleteField()` ile siler.
- Aydınlatma metinleri `privacyNotices/{id}` altında herkese açık ve değiştirilemez sürümler olarak yayımlanır (ADR-0029'daki tüzük modeliyle aynı). Yürürlükteki sürüm `settings/public.recruitmentPrivacyNoticeId` ile gösterilir; işaretçi yalnız var olan bir sürüme ayarlanabilir.
- Her başvuru `privacyNoticeId` taşır ve kurallar bunun başvuru anında yürürlükte olan sürüm olmasını ister. Yayımlı metin yoksa başvuru alınmaz.
- Metin arayüzden (Kurum ayarları) düzenlenir ve yayımlanır (ADR-0019). Hazır taslaktaki `[BÜYÜK HARF]` yer tutucuları doldurulmadan yayımlama yapılamaz.
- Onay kutusu "okudum ve anladım" beyanıdır, açık rıza değildir. İşleme hukuki sebebi metinde belirtilir.
- Aynı sürüm modeliyle dört politika yayımlanır: başvuru aydınlatma metni (`recruitment`), Hub üyeleri aydınlatma metni (`members`), çerez ve yerel depolama politikası (`cookies`) ve kullanım koşulları (`terms`). İşaretçiler `settings/public` üzerindeki `recruitmentPrivacyNoticeId`, `memberPrivacyNoticeId`, `cookiePolicyId` ve `termsId` alanlarıdır. Kurallar her işaretçinin aynı türde bir sürümü göstermesini ister. Metinler girişsiz olarak `/politika/{kısa-yol}` adresinde (kariyer sitesinde de) yayımlanır; kariyer ve giriş sayfalarının alt bilgisinde bağlantıları bulunur.
- Site reklam, analiz veya izleme çerezi kullanmaz; yalnız zorunlu tarayıcı depolaması (Firebase oturumu, Firestore önbelleği, tema ve birim tercihi) vardır. Bu nedenle çerez onay bandı konmaz, yalnız bilgilendirme metni yayımlanır. İleride analiz veya pazarlama aracı eklenirse onay mekanizması için yeni ADR gerekir.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| A (seçilen): alt belge + sürümlü aydınlatma metni | Kimlik dışarı çıkmaz, hesap verebilirlik kurallarla korunur; hangi metnin onaylandığı ispatlanır | Batch yazımı ve ek kural ifadeleri |
| B: kimlik alanlarını tamamen kaldırmak, yalnız denetim kaydı | Basit | `logAudit` en iyi çabadır ve kurallarca zorunlu değildir; hesap verebilirlik zayıflar |
| C: metni koda gömmek | Basit | ADR-0019'a aykırı; sürüm kanıtı yok |

## Sonuçlar

**Olumlu:**
- Anonim ziyaretçi ve aday, yönetici kimliğini hiçbir yoldan okuyamaz.
- Her başvurunun hangi aydınlatma metni sürümüyle alındığı kalıcı olarak bilinir.

**Olumsuz / maliyet:**
- Metin yayımlanana kadar kariyer vitrini başvuru almaz.
- Yeni sürüm yayımlandığında açık formu olan aday sayfayı yenilemelidir.

**Riskler ve önlemler:**
- Taslak metin hukuki görüş değildir. Veri sorumlusu unvanı, yurt dışı aktarım (Firebase, `europe-west1`) dayanağı ve saklama süresi üniversite veya bir hukukçuyla netleştirilmelidir.
- Saklama süresi dolan başvuruların silinmesi için zamanlanmış iş yoktur (Spark, ADR-0017). Silme elle yapılmalıdır.

## Uygulama notları

- Kurallar: `firebase/firestore.rules` → `settings/public`, `privacyNotices`, `recruitmentCalls/*/internal`, `recruitmentApplications/*/internal`.
- İstemci: `apps/hub/src/lib/privacy.ts`, `lib/recruitment.ts`, `pages/admin/SettingsPage.tsx`, `pages/public/CareerPage.tsx`.
- `settings/{docId}` eşleşmesi artık `public` belgesine yazma izni vermez; kurallar VEYA ile birleştiği için bu, `settings/public` doğrulamasının atlanmasını önler.
