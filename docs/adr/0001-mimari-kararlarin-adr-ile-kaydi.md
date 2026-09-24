# ADR-0001: Mimari kararlar ADR ile kaydedilir

- **Durum:** Önerildi
- **Tarih:** 2026-09-22
- **Karar vericiler:** TechOps Başkanlığı
- **İlgili:** Bildirge §5.7, §7, §18

## Bağlam

Bildirge, ana kayıt sistemi değişikliklerinin "mimari karar kaydıyla" belgelenmesini (§7) ve sistemin tek bir kişiye bağımlı olmamasını (§14.6) şart koşar. Öğrenci kolunda yönetim her yıl değişir. Bir kararın **neden** alındığı yazılmazsa sonraki ekip ya aynı tartışmayı yeniden yapar ya da gerekçesini bilmediği kararı bozar.

## Karar

- Geri dönüşü maliyetli veya birden fazla bileşeni etkileyen her teknik karar, `docs/adr/` altında bir ADR ile kaydedilir.
- ADR'ler kodla aynı depoda, Markdown olarak tutulur ve PR ile değiştirilir.
- Kabul edilmiş ADR düzenlenmez. Karar değişirse yeni ADR yazılır.
- Kişisel veri, yetki, imza, maliyet veya organizasyonu etkileyen ADR'ler YK kabulü gerektirir.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Depoda Markdown ADR (seçilen) | Kodla birlikte sürümlenir, PR ile incelenir, devirde kaybolmaz | Teknik olmayan üyeler için GitHub erişimi gerekir |
| Drive'da Google Docs | Herkes okuyabilir | Kodla bağlantısı kopar, sürüm disiplini zayıf |
| Karar kaydı tutmamak | Sıfır maliyet | Bildirge §7'ye aykırı |

## Sonuçlar

**Olumlu:** Devir paketinin teknik bölümü kendiliğinden oluşur (Bildirge §18).
**Olumsuz:** YK üyelerinin ADR'leri okuması için ADR dizini Drive'daki `09_TechOps_ve_Sistemler/Teknik_Dokumantasyon` klasöründen bağlantıyla paylaşılır.

## Uygulama notları

- Şablon: [_sablon.md](_sablon.md). Dizin: [README.md](README.md).
- PR açıklamasında etkilenen ADR numarası belirtilir.
