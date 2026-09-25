# IEEE İKÇÜ Hub — Dokümantasyon

Bu klasör, Hub'ın mimari kararlarını, çalışma paketlerini ve modül tasarımlarını içerir. Dokümanlar kodla birlikte sürümlenir. Değişiklikler Pull Request ile yapılır ([dokümantasyon kuralları](dokumantasyon-kurallari.md)).

## Klasör yapısı

```
docs/
├── README.md                    # Bu dosya
├── dokumantasyon-kurallari.md   # ADR/WP yazım ve onay süreci
├── sozluk.md                    # Temel kavramlar (Bildirge Ek D + yeni kavramlar)
├── acik-sorular.md              # Karar bekleyen sorular (YK / Danışman / TechOps)
├── adr/                         # Mimari karar kayıtları (ADR-0001 …)
├── work-packages/               # Çalışma paketleri (WP-01 … WP-12)
├── mimari/                      # Sistem mimarisi, veri sahipliği, Firestore modeli
├── rbac/                        # Organizasyon modeli, rol kataloğu, yetki matrisi, atama kuralları
└── moduller/
    └── e-dilekce/               # E-Dilekçe ve rol bazlı imza modülü
```

## İçindekiler

### Genel
- [Dokümantasyon kuralları](dokumantasyon-kurallari.md)
- [Sözlük](sozluk.md)
- [Açık sorular](acik-sorular.md)
- [Bildirge – Hub boşluk analizi (2026-09)](bildirge-bosluk-analizi-2026-09.md)
- [Dilekçe kataloğu ve kategori eşlemesi (2026-09)](dilekce-katalogu-2026-09.md)
- [Canlı işletim, dağıtım, izleme ve geri dönüş kılavuzu](canli-isletim.md)

### Mimari
- **[Uygulanan mimari (Spark planı)](mimari/uygulanan-mimari.md)** — şu an çalışan sistem
- [Sistem mimarisi](mimari/sistem-mimarisi.md) (hedef, Blaze varsayımı)
- [Veri sahipliği ve ana kayıt sistemleri](mimari/veri-sahipligi.md)
- [Firestore veri modeli](mimari/firestore-veri-modeli.md)

### RBAC (Rol Bazlı Erişim Kontrolü)
- [Organizasyon modeli](rbac/organizasyon-modeli.md)
- [Rol kataloğu](rbac/rol-katalogu.md)
- [Yetki matrisi](rbac/yetki-matrisi.md)
- [Rol atama kuralları](rbac/atama-kurallari.md)

### Modüller
- [E-Dilekçe: fonksiyonel tanım](moduller/e-dilekce/README.md)
- [E-Dilekçe: veri modeli](moduller/e-dilekce/veri-modeli.md)
- [E-Dilekçe: şablon tanım formatı](moduller/e-dilekce/sablon-formati.md)

### Kararlar ve planlama
- [ADR dizini](adr/README.md)
- [Çalışma paketleri ve takvim](work-packages/README.md)

## 2026-09-24 güncellemesi

Blaze planı alınamadığı için (AS-06) Hub tamamen ücretsiz Spark planında, sunucu kodu olmadan çalışacak şekilde uygulandı. Kararlar: [ADR-0017](adr/0017-ucretsiz-spark-plani-kurallar-tek-guvenilir-katman.md) … [ADR-0021](adr/0021-belge-ciktisi-tarayicida-docx-ve-dogrulama.md). Organizasyon, roller, dönemler, seçimler ve dilekçe şablonları arayüzden düzenlenir.

## Bildirgeye göre eklenenler

Bu dokümantasyon, Bildirge'nin (IEEE/240826/SÜ/22, Rev 00) kapsamını iki noktada genişletir:

1. **WP-11: Kimlik, Rol ve Yetki Yönetimi (RBAC).** Bildirge §8'de tanımlanan yetki modeli; Yönetim Kurulu, komiteler, komite başkanları, başkan yardımcıları ve koordinasyon üyelerinden oluşan yapıya göre, dönem bazlı ve kapsamlı (scoped) bir RBAC sistemine dönüştürülmüştür.
2. **WP-12: E-Dilekçe ve Rol Bazlı İmza.** IEEE İKÇÜ'nün kendi dilekçe formatlarının Hub üzerinden çevrim içi doldurulması, rol bazlı onay zinciriyle imzalanması, evrak numarası alması ve doğrulanabilir PDF olarak arşivlenmesi.

Bu eklemeler, Bildirge'nin bir sonraki revizyonuna (Rev 01) işlenmek üzere Mevzuat ve Arşiv Yönetimi Departmanına önerilir.
