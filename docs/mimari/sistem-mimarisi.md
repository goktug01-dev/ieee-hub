# Sistem Mimarisi

> **Güncelleme (2026-09-24):** Bu doküman Blaze + Cloud Functions varsayımıyla yazılmış **hedef** mimaridir. Blaze alınamadığı için (AS-06) uygulanan mimari farklıdır: [Uygulanan mimari](uygulanan-mimari.md), [ADR-0017](../adr/0017-ucretsiz-spark-plani-kurallar-tek-guvenilir-katman.md).

Bildirge §6'daki hedef mimarinin Hub açısından somutlaştırılmış hâlidir. Kararların gerekçeleri ADR'lerdedir.

## 1. Bağlam diyagramı

```mermaid
flowchart LR
    subgraph Kullanicilar[Kullanıcılar]
        U1[Üye / Gönüllü]
        U2[Komite ve YK]
        U3[Harici doğrulayıcı]
    end

    subgraph Firebase["Firebase projesi (kurumsal hesap)"]
        HOST[Hosting<br/>Hub SPA]
        AUTH[Authentication]
        RTDB[(Realtime Database<br/>üye profili ve üyelik durumu)]
        FS[(Cloud Firestore<br/>Hub operasyon verisi)]
        FN[Cloud Functions<br/>güvenilir işlemler]
        ST[(Cloud Storage<br/>dilekçe PDF'leri)]
        SM[Secret Manager]
    end

    WP[WordPress<br/>kamu sitesi ve üyelik sayfaları]
    HC[HeptaCert]
    GW[Google Drive / Sheets]
    AS[Apps Script]
    LS[Looker Studio]
    VT[IEEE vTools]
    GH[GitHub<br/>kaynak kod + CI]

    U1 & U2 --> HOST
    U3 -->|QR doğrulama| HOST
    WP --> AUTH
    WP --> RTDB
    HOST --> AUTH
    HOST -->|okuma, güvenlik kurallarıyla| FS
    HOST -->|callable| FN
    FN --> FS
    FN --> RTDB
    FN --> ST
    FN --> SM
    FN -->|CSV / REST API| HC
    FN -->|rapor tabloları| GW
    AS --> GW
    GW --> LS
    FN -.->|veri paketi, gönderim elle| VT
    GH -->|deploy| HOST
    GH -->|deploy| FN
```

## 2. Bileşenler

| Bileşen | Sorumluluk | ADR |
|---|---|---|
| Hub SPA (`apps/hub`) | Kullanıcı arayüzü. Okumaları güvenlik kurallarıyla doğrudan Firestore'dan yapar. Kritik yazmalar için callable fonksiyon çağırır. | [0002](../adr/0002-hub-uygulama-yigini.md) |
| Firebase Auth | Tek kimlik. WordPress üyelik sistemiyle ortak kullanılır. | Bildirge §6.3 |
| Realtime Database | Üye profili ve üyelik durumunun **ana kaydı**. Hub bu veriyi değiştirmez, yalnızca yansıtır. | [0003](../adr/0003-hub-veri-deposu-firestore.md) |
| Cloud Firestore | Hub'ın tüm operasyon verisi: birimler, roller, görevler, etkinlikler, dilekçeler, denetim kayıtları. | [0003](../adr/0003-hub-veri-deposu-firestore.md) |
| Cloud Functions (`functions/`) | Rol atamaları, dilekçe durum geçişleri ve imzalar, evrak numarası, PDF üretimi, içe aktarma, zamanlanmış işler, denetim kaydı. | [0004](../adr/0004-guvenilir-backend-cloud-functions.md), [0006](../adr/0006-yetki-uygulama-noktalari.md) |
| Cloud Storage | Onaylanmış dilekçe PDF'leri. İstemci doğrudan okuyamaz, kısa ömürlü imzalı URL ile indirir. | [0015](../adr/0015-pdf-uretimi-ve-dogrulama.md) |
| Secret Manager | HeptaCert API anahtarı ve diğer gizli bilgiler | Bildirge §10.6 |
| Google Drive / Sheets | Belge arşivi, finans ana kaydı, raporlama veri katmanı | Bildirge §6.7–6.9 |

## 3. Güvenlik katmanları

```mermaid
flowchart TB
    A[İstemci: arayüz yetki kontrolü<br/>yalnızca kullanıcı deneyimi içindir, güvenlik sağlamaz] --> B
    B[Firebase App Check<br/>yalnızca Hub uygulamasından gelen istekler] --> C
    C{İşlem türü}
    C -->|okuma, basit yazma| D[Firestore Security Rules<br/>access/uid özetine göre]
    C -->|kritik yazma| E[Callable Function<br/>can principal, permission, scope<br/>aktif roleAssignments üzerinden]
    E --> F[Denetim kaydı]
    D --> G[(Firestore)]
    E --> G
```

Kural: Güvenliğin kaynağı **sunucudur** (Functions + Security Rules). Arayüzde gizlenen bir düğme güvenlik önlemi sayılmaz.

## 4. Kritik akış: Dilekçe imzalama

```mermaid
sequenceDiagram
    actor I as İmzacı
    participant H as Hub SPA
    participant F as signPetitionStep (Function)
    participant DB as Firestore

    I->>H: "Onayla" (rol seçimi + beyan)
    H->>H: auth_time kontrolü, gerekirse yeniden giriş
    H->>F: { petitionId, revision, stepId, roleAssignmentId, decision, comment, expectedContentHash }
    F->>DB: transaction başlat
    F->>DB: petition, aktif adım, roleAssignment oku
    F->>F: durum = in_review? adım aktif mi? revizyon eşleşiyor mu?
    F->>F: rol ataması aktif mi, kapsam doğru mu, imzacı ≠ sahip?
    F->>F: expectedContentHash == saklanan contentHash?
    F->>DB: signature yaz (chainHash), adımı kapat, sonraki adımı aç
    F->>DB: auditLog yaz
    F-->>H: { signatureId, newStatus }
    Note over F,DB: Son adımsa status=approved ve PDF üretimi tetiklenir
```

## 5. Ortamlar

| Ortam | Firebase projesi | Veri | Kullanım |
|---|---|---|---|
| `local` | Emulator Suite | Sentetik seed verisi | Geliştirme, birim ve kural testleri |
| `staging` | Ayrı Firebase projesi | Sentetik veri, **gerçek kişisel veri yok** | PR önizleme kanalları, pilot öncesi kabul |
| `production` | Kurumsal Firebase projesi (mevcut üyelik projesi) | Gerçek veri | Canlı |

Geliştiriciler üretim verisine erişmez. Üretim verisiyle hata ayıklama gerekiyorsa acil erişim süreci uygulanır ([ADR-0010](../adr/0010-teknik-erisim-ve-acil-erisim.md)).

## 6. Bölge

Firestore, Functions ve Storage için `europe-west3` (Frankfurt) önerilir (AS-11). Firestore bölgesi **proje oluşturulduktan sonra değiştirilemez**. Mevcut RTDB'nin bölgesi WP-01 envanterinde tespit edilecektir (AS-10).
