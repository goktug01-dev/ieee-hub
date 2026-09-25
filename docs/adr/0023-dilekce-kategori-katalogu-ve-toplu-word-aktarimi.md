# ADR-0023: Dilekçe kategori kataloğu ve toplu Word aktarımı

- **Durum:** Kabul Edildi
- **Tarih:** 2026-09-25
- **Karar vericiler:** TechOps Başkanlığı
- **İlgili:** ADR-0017, ADR-0020, ADR-0021, WP-12

## Bağlam

Kurumsal belge klasöründe istifa, savunma, denetim, harcama, risk, zimmet, YK kararı, atama ve TechOps gibi farklı ama ilişkili Word belgeleri bulunur. Tek ve uzun bir şablon listesi hem üyenin doğru belgeyi bulmasını hem de Evrak Sorumlusunun kataloğu yönetmesini zorlaştırır.

## Karar

1. Dilekçe kategorileri `settings/org.petitionCategories` alanında tutulur ve Kurum Ayarları ekranından düzenlenir.
2. Her `petitionTemplates` kaydı bir kategori taşıyabilir. Yeni dilekçe ekranı, şablon yönetimi ve evrak arşivi aynı kategori bilgisini filtre olarak kullanır.
3. Kategori dilekçe kaydına kopyalanmaz. Arşiv, `templateId` üzerinden şablon kategorisini çözer; böylece kategori adı düzeltildiğinde geçmiş kayıtlar da yeni sınıflandırmayı kullanır.
4. Yönetim ekranı birden çok `.docx` dosyasını tek seçimde alabilir. Dosya adından kategori, ad ve evrak serisi önerilir; aktarılan belgeler **taslak** kalır.
5. Toplu aktarım otomatik yayım yapmaz. Alan etiketleri ve onay zinciri insan tarafından kontrol edilmeden belge kullanıma açılamaz.

## Başlangıç kataloğu

- Üyelik ve Görev
- Disiplin ve Denetim
- Finans ve Harcama
- Etkinlik ve Risk
- Envanter ve Zimmet
- Yönetim Kurulu
- Atama ve Seçim
- TechOps
- Genel

## Sonuçlar

**Olumlu:** Üyeler belgeyi daha hızlı bulur; mevcut klasör tek tek meta veri girişi yapılmadan taslak kataloğa alınabilir. Kategori listesi kod değişikliği olmadan yönetilebilir.

**Olumsuz:** Dosya adından sınıflandırma bir öneridir; yanlış eşleşme şablon editöründe düzeltilmelidir. Eski bir şablon silinirse arşivde kategori `Genel` olarak gösterilir.
