# ADR-0033: Onay makamları kendilerine ayrılan Word alanlarını karar anında doldurur

- **Durum:** Kabul Edildi
- **Tarih:** 2026-09-29
- **Karar vericiler:** IEEE İKÇÜ TechOps; süreç sahibi: Genel Sekreterlik
- **Onay kaydı:** Kullanıcı talebi, 2026-09-29; örnek: `22_KOMİTE_AÇMA_DİLEKÇESİ.docx`
- **İlgili:** WP-12, ADR-0012, ADR-0013, ADR-0020, ADR-0024

## Bağlam

Bazı dilekçelerde başvuru sahibinin doldurduğu bilgilerden ayrı olarak Denetleme Kurulu, Yönetim Kurulu veya başkanlıkların doldurması gereken “uygundur”, “uygun değildir”, gerekçe, karar bilgisi ve makam adı alanları vardır. Mevcut akış yetkilinin kararını ve elektronik onay kaydını tutuyor, ancak Word içindeki bu özel alanları yalnız başvuru formunun parçası olarak ele alıyordu.

## Karar

Şablondaki herhangi bir kullanıcı alanı bir onay adımına bağlanabilir. Bağlanan alan başvuru sahibinin formunda gösterilmez. Yalnız etkin adımdaki yetkili karar verirken alanı doldurabilir; değer dilekçenin `approvalData` haritasında başvuru verisinden ayrı saklanır ve Word çıktısında ilgili etikete yazılır.

Alanlar metin, tarih, sayı, seçenek ve işaret kutusu olabilir. Bağlama şablon sürümüyle dondurulur. Bir alan yalnız bir onay adımına bağlanabilir. Yetkili yalnız kendi etkin adımına bağlanan ve daha önce doldurulmamış alanları yazabilir; Firestore kuralları farklı alanlara yazmayı ve önceki makam değerini değiştirmeyi reddeder. İade sonrası yeni revizyonda makam alanları temizlenir ve süreç baştan yürür.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Adıma bağlı makam alanları (seçilen) | Her Word şablonuna uyar; arayüzden ayarlanır; başvuru verisinden ayrıdır | Şablon yöneticisinin alan-adım bağını doğru kurması gerekir |
| Dilekçe türüne özel sabit kod | İlk örnek için hızlı | Yeni komite ve başkanlık şerhlerinde geliştirici gerekir |
| Yalnız elektronik onay tablosu | Daha basit | Kurumun mevcut Word biçimindeki resmî şerh alanlarını doldurmaz |

## Sonuçlar

**Olumlu:** Kurullar imza kaydına ek olarak belgenin kendi değerlendirme alanlarını doldurabilir. Başvuru sahibi resmî şerh alanlarını arayüzden veya çıktı üretiminde taklit edemez.

**Olumsuz / maliyet:** Eski şablonlar bu özelliği kullanmak için yeni sürüm olarak yayımlanmalıdır.

**Riskler ve önlemler:** Aynı alanın birden fazla makama bağlanması yayımlama doğrulamasında engellenir. Güvenlik yalnız arayüze bırakılmaz; `firebase/firestore.rules` veri farkını etkin adımın `responseFieldKeys` listesiyle sınırlar.

## Uygulama notları

Veri modeli `TemplateField`, `ApprovalStep.responseFieldKeys` ve `Petition.approvalData`; şablon arayüzü `TemplateEditorPage.tsx`; karar arayüzü `PetitionDetailPage.tsx`; yazma işlemi `lib/petitions.ts` içindedir.
