# Organizasyon Modeli

> **Güncelleme (2026-09-24):** Birimler ve roller Hub arayüzünden düzenlenir ([ADR-0019](../adr/0019-organizasyon-roller-ve-secimler-arayuzden-duzenlenir.md)). Koordinasyon üyeliği hem kol genelinde hem komite içinde rol olarak tanımlıdır (AS-01).

RBAC modelinin temelinde IEEE İKÇÜ'nün organizasyon yapısı vardır. Bu doküman, yapının Hub'da **birimler (units)** ve **rol atamaları** ile nasıl temsil edileceğini tanımlar. Karar: [ADR-0005](../adr/0005-rbac-modeli.md).

## 1. Gerçek yapı

```
IEEE İKÇÜ Öğrenci Kolu
├── Yönetim Kurulu
│   ├── Başkan
│   ├── Başkan Yardımcısı
│   ├── Genel Sekreter
│   ├── Sayman
│   └── YK Üyeleri
├── Komiteler (CS, RAS, PES, WIE, … — AS-02)
│   ├── Komite Başkanı
│   ├── Başkan Yardımcısı
│   ├── Koordinasyon Üyeleri
│   └── Gönüllüler
├── Başkanlıklar / Daireler (örn. TechOps — Teknik Operasyon ve Altyapı Dairesi Başkanlığı)
│   ├── Başkan
│   ├── Başkan Yardımcısı
│   ├── Koordinasyon Üyeleri
│   └── Departmanlar (örn. Mevzuat ve Arşiv Yönetimi Departmanı)
└── Proje / Etkinlik ekipleri (dönemlik, geçici)
```

Kurumsal gözetim: **Öğrenci Kolu Danışmanı** (akademisyen). Organizasyon üyesi değildir, ancak bazı onay zincirlerinde yer alabilir (AS-07).

## 2. Hub'daki temsil

### 2.1. Birim (`units`)

Her organizasyon parçası bir birimdir. Birimler `parentId` ile ağaç oluşturur.

| Alan | Açıklama |
|---|---|
| `id` | Kalıcı kimlik (örn. `cs`, `techops`, `techops-mevzuat`). Değiştirilmez. |
| `type` | `board` \| `committee` \| `directorate` \| `department` \| `project_team` \| `event_team` |
| `name` | Görünen ad (örn. "Computer Society Komitesi") |
| `shortCode` | Evrak numarası ve raporlarda kullanılan kısa kod (örn. `CS`, `TO`) |
| `parentId` | Üst birim. Kök birimlerde `null`. |
| `status` | `active` \| `archived`. Birimler silinmez, arşivlenir. Geçmiş rol atamaları ve dilekçeler bozulmaz. |
| `termIds` | Birimin aktif olduğu dönemler (proje ekipleri için anlamlı). |

**Örnek birim ağacı** (AS-02 cevaplanınca güncellenecek):

| id | type | parentId | shortCode |
|---|---|---|---|
| `board` | board | — | `YK` |
| `cs` | committee | — | `CS` |
| `ras` | committee | — | `RAS` |
| `wie` | committee | — | `WIE` |
| `techops` | directorate | — | `TO` |
| `techops-mevzuat` | department | `techops` | `TO-MA` |
| `comms` | directorate | — | `IL` |

### 2.2. Kapsam ve kalıtım

- Bir **birim rolü** o birimde ve **tüm alt birimlerinde** geçerlidir. Örnek: `techops` biriminin başkanı `techops-mevzuat` departmanının görevlerini de yönetebilir.
- Birim rolleri **kardeş birimlere geçmez.** Örnek: CS başkanı RAS görevlerini göremez (yalnızca herkese açık özet alanları görebilir).
- **Kol geneli roller** (`branch` kapsamı) tüm birimleri kapsar. Hangi izinlerin kol genelinde verildiği [yetki matrisinde](yetki-matrisi.md) açıkça yazılıdır. Kol geneli rol, otomatik olarak "her şeyi görme" hakkı vermez.

### 2.3. Yönetim Kurulu

Yönetim Kurulu `board` tipinde bir birim olarak tanımlanır. Ancak YK üyelerinin yetkileri birim kapsamı üzerinden değil, **kol geneli roller** (`branch.chair`, `branch.secretary`, `board.member` …) üzerinden verilir. Bunun nedeni, YK kararlarının tüm birimleri etkilemesidir. `board` birimi YK'nın kendi görevleri, projeleri ve dilekçe evrak serisi için kullanılır.

### 2.4. Bir kişinin birden fazla rolü

Bir kişi aynı anda birden fazla rol taşıyabilir. Örnek: TechOps Başkanı hem `techops` biriminde `unit.chair`, hem de kol genelinde `board.member` olabilir. Etkili izinler, aktif rollerin izinlerinin **birleşimidir**.

İmza yetkisinde birleşim uygulanmaz. İmza anında kişinin **hangi rolüyle** imzaladığı seçilir ve kaydedilir ([ADR-0012](../adr/0012-rol-bazli-elektronik-onay.md)).

### 2.5. Üyelik ile rol ilişkisi

- **Üyelik** (Firebase RTDB'deki onaylı üyelik durumu) Hub'a girişin ön koşuludur. Onaylı üye, rol ataması olmadan da `member` taban rolünü taşır.
- **Rol** ise organizasyon içindeki görevi ifade eder ve Hub'da `roleAssignments` ile verilir.
- Üyeliği askıya alınan veya sona eren kişinin tüm aktif rol atamaları otomatik olarak askıya alınır ([atama kuralları §6](atama-kurallari.md)).
