# E-Dilekçe — Şablon Tanım Formatı

> **Güncelleme (2026-09-24):** JSON şablon formatının yerini Word (.docx) + `{etiket}` yaklaşımı aldı ([ADR-0020](../../adr/0020-dilekce-sablonlari-word-tabanli.md)). Etiket listesi ve kullanım Hub'daki şablon editöründe "Word şablonu nasıl hazırlanır?" bölümündedir. Bu doküman alan türleri ve onay zinciri kavramları için referans olarak kalır.

Dilekçe şablonları depoda JSON dosyaları olarak tutulur ([ADR-0011](../../adr/0011-dilekce-sablonlari-kod-olarak.md)):

```
packages/petition-templates/
├── schema/petition-template.schema.ts     # zod şeması (tek doğruluk kaynağı)
├── templates/
│   └── etkinlik-izin/
│       ├── v1.json                         # yayınlandıktan sonra DEĞİŞTİRİLEMEZ
│       ├── v2.json
│       └── fixtures/sample.json            # PDF anlık görüntü testi için örnek veri
└── scripts/
    ├── validate.ts                         # pnpm templates:validate
    └── publish.ts                          # pnpm templates:publish (yalnızca CI)
```

Kurumun mevcut Word/PDF dilekçe formatları (AS-04) bu formata dönüştürülür. Dönüştürme işini TechOps yapar, içerik kontrolünü Evrak Sorumlusu ve Genel Sekreter yapar.

## 1. Örnek: Etkinlik Düzenleme İzin Dilekçesi

> Bu örnek formatı göstermek içindir. Gerçek metin ve onay zinciri mevcut kurumsal formattan alınacaktır.

```json
{
  "id": "etkinlik-izin",
  "version": 1,
  "title": "Etkinlik Düzenleme İzin Dilekçesi",
  "titleTemplate": "{{etkinlikAdi}} — Etkinlik İzni",
  "formCode": "IEEE-FR-001",
  "series": "ETK",
  "category": "Etkinlik",
  "description": "Komite veya başkanlıkların düzenleyeceği etkinlikler için Yönetim Kurulu izni.",

  "canCreate": {
    "anyOf": [
      { "role": "unit.coordinator" },
      { "role": "unit.vice_chair" },
      { "role": "unit.chair" }
    ]
  },
  "unitSelection": "petitioner_units",

  "fields": [
    { "key": "etkinlikAdi", "type": "text", "label": "Etkinlik adı", "required": true, "maxLength": 120,
      "dataClass": "internal", "purpose": "Etkinliğin tanımlanması" },
    { "key": "etkinlik", "type": "event_ref", "label": "Hub etkinlik kaydı", "required": false,
      "dataClass": "internal", "purpose": "Etkinlik kaydıyla ilişkilendirme" },
    { "key": "tarih", "type": "date", "label": "Etkinlik tarihi", "required": true, "min": "today",
      "dataClass": "internal", "purpose": "Planlama" },
    { "key": "baslangicSaati", "type": "time", "label": "Başlangıç saati", "required": true,
      "dataClass": "internal", "purpose": "Planlama" },
    { "key": "bitisSaati", "type": "time", "label": "Bitiş saati", "required": true,
      "dataClass": "internal", "purpose": "Planlama" },
    { "key": "mekanTuru", "type": "select", "label": "Mekân türü", "required": true,
      "options": [
        { "value": "kampus_ici", "label": "Kampüs içi" },
        { "value": "kampus_disi", "label": "Kampüs dışı" },
        { "value": "cevrim_ici", "label": "Çevrim içi" }
      ],
      "dataClass": "internal", "purpose": "Onay zincirinin belirlenmesi" },
    { "key": "mekan", "type": "text", "label": "Mekân / bağlantı", "required": true, "maxLength": 200,
      "dataClass": "internal", "purpose": "Planlama" },
    { "key": "tahminiKatilimci", "type": "integer", "label": "Tahmini katılımcı sayısı", "required": true,
      "min": 1, "max": 5000, "dataClass": "internal", "purpose": "Planlama" },
    { "key": "talepler", "type": "textarea", "label": "Özel talepler (salon, ekipman vb.)", "required": false,
      "maxLength": 1000, "dataClass": "internal", "purpose": "Planlama" }
  ],

  "validations": [
    { "rule": "time_after", "field": "bitisSaati", "other": "baslangicSaati",
      "message": "Bitiş saati başlangıç saatinden sonra olmalıdır." }
  ],

  "body": {
    "addressee": "IEEE İKÇÜ Öğrenci Kolu Yönetim Kurulu Başkanlığına",
    "subject": "Etkinlik düzenleme izni hk.",
    "text": "Öğrenci Kolumuz {{petitioner.unitName}} bünyesinde, {{tarih|date}} tarihinde saat {{baslangicSaati}}–{{bitisSaati}} arasında {{mekan}} adresinde \"{{etkinlikAdi}}\" başlıklı etkinliğin düzenlenmesi planlanmaktadır. Etkinliğe yaklaşık {{tahminiKatilimci}} kişinin katılması beklenmektedir.\n\n{{#talepler}}Etkinlik kapsamındaki taleplerimiz şunlardır: {{talepler}}\n\n{{/talepler}}Gereğini bilgilerinize arz ederim.",
    "closing": { "showDate": true, "showPetitioner": true }
  },

  "approval": {
    "steps": [
      {
        "id": "birim",
        "label": "Birim Başkanı Onayı",
        "anyOf": [ { "role": "unit.chair", "scope": "petition_unit" } ],
        "substitutes": [ { "role": "unit.vice_chair", "scope": "petition_unit" } ],
        "fallback": [ { "role": "branch.secretary" } ]
      },
      {
        "id": "gs",
        "label": "Genel Sekreter Kontrolü",
        "anyOf": [ { "role": "branch.secretary" } ],
        "fallback": [ { "role": "branch.chair" } ]
      },
      {
        "id": "baskan",
        "label": "Başkan Onayı",
        "anyOf": [ { "role": "branch.chair" } ],
        "substitutes": [ { "role": "branch.vice_chair" } ]
      },
      {
        "id": "danisman",
        "label": "Danışman Onayı",
        "when": { "field": "mekanTuru", "in": ["kampus_disi"] },
        "anyOf": [ { "role": "branch.advisor" } ]
      }
    ],
    "onReturn": "restart",
    "reminderAfterDays": 3
  },

  "output": {
    "pdfLayout": "kurumsal-v1",
    "showVerificationQr": true,
    "externalSignatureRequired": false,
    "notifyOnApproval": [ { "role": "branch.secretary" } ]
  },

  "retention": { "basis": "term_end", "plusAcademicYears": 2 }
}
```

## 2. Alan referansı

### 2.1. Üst seviye

| Alan | Zorunlu | Açıklama |
|---|---|---|
| `id` | ✓ | Kalıcı kimlik, `kebab-case`. Değişmez. |
| `version` | ✓ | Tam sayı. Bir önceki yayınlanmış sürümden tam olarak 1 fazla olmalı. |
| `title` | ✓ | Katalogda ve PDF'te görünen ad. |
| `titleTemplate` | | Dilekçe listelerinde görünen başlık (yer tutucu içerebilir). |
| `formCode` | ✓ | Kurumsal form kodu. PDF başlığında "Doküman No" olarak basılır. Şablonlar arasında benzersiz olmalıdır. |
| `series` | ✓ | Evrak numarası serisi, 2–4 büyük harf ([ADR-0014](../../adr/0014-evrak-numaralandirma.md)). |
| `category` | ✓ | Katalog grubu. |
| `canCreate` | ✓ | Kimlerin bu şablonla dilekçe açabileceği. `{ "anyOf": [...] }` veya `"member"` (tüm onaylı üyeler). |
| `unitSelection` | ✓ | `petitioner_units` (sahibinin rol taşıdığı birimlerden biri seçilir), `fixed:<unitId>`, `none` (birimsiz, kol geneli). |
| `fields` | ✓ | Form alanları (§2.2). |
| `validations` | | Alanlar arası doğrulama kuralları (§2.3). |
| `body` | ✓ | Dilekçe metni (§2.4). |
| `approval` | ✓ | Onay zinciri (§2.5). |
| `output` | ✓ | PDF ve bildirim ayarları (§2.6). |
| `retention` | ✓ | Saklama kuralı. |

PDF başlığındaki **Yayın Tarihi** sürümün yayınlandığı tarihten, **Rev No** ise `version - 1` değerinden otomatik gelir. Bildirge başlığındaki "Rev No: 00" düzeniyle uyumludur.

### 2.2. Alan tipleri

| `type` | Girdi | Ek özellikler |
|---|---|---|
| `text` | Tek satır metin | `minLength`, `maxLength`, `pattern` |
| `textarea` | Çok satırlı metin | `maxLength` |
| `integer`, `decimal` | Sayı | `min`, `max` |
| `currency` | TL tutarı | `min`, `max`. Kuruş hassasiyetinde tam sayı olarak saklanır. |
| `date`, `time`, `datetime` | Tarih/saat | `min`, `max` (`"today"` desteklenir) |
| `select`, `multiselect` | Seçenek listesi | `options` |
| `checkbox` | Evet/Hayır | `mustBeTrue` (beyan kutuları için) |
| `member_ref` | Hub'dan üye seçimi | `filter` (örn. aynı birim) |
| `unit_ref` | Birim seçimi | `types` |
| `event_ref` | Hub etkinlik kaydı seçimi | |
| `file_link` | Drive bağlantısı | Yalnızca kurumsal Drive alan adı kabul edilir. İlk dönemde dosya yükleme yoktur. |
| `repeat` | Tekrarlanan satır grubu (örn. harcama kalemleri) | `itemFields`, `minItems`, `maxItems` |

Her alanda zorunlu: `key` (camelCase, benzersiz), `label`, `dataClass`, `purpose`. İsteğe bağlı: `required`, `help`, `placeholder`, `default`, `visibleWhen`.

`dataClass`: `public` \| `internal` \| `personal`. `sensitive` değeri şemada **tanımlı değildir**. Özel nitelikli kişisel veri toplanamaz.

### 2.3. Doğrulama kuralları

| `rule` | Anlamı |
|---|---|
| `time_after`, `date_after` | `field`, `other` alanından sonra olmalı |
| `required_if` | `field`, `when` koşulu sağlanırsa zorunlu |
| `sum_max` | `repeat` alanındaki `itemField` toplamı `max` değerini aşamaz |

Kurallar hem istemcide (anında geri bildirim) hem sunucuda (`submitPetition`) aynı zod şemasıyla çalışır.

### 2.4. Metin (`body`) ve yer tutucular

Mustache'ın kısıtlı bir alt kümesi kullanılır. HTML üretilmez. Metin PDF'e düz paragraf olarak basılır.

| Sözdizimi | Anlamı |
|---|---|
| `{{alan}}` | Alan değeri |
| `{{alan\|date}}` | Biçimlendirici: `date` (22.09.2026), `datetime`, `currency` (1.250,00 TL), `upper` |
| `{{#alan}}…{{/alan}}` | Alan doluysa göster |
| `{{^alan}}…{{/alan}}` | Alan boşsa göster |

Hazır değişkenler: `petitioner.name`, `petitioner.unitName`, `petitioner.roleTitle`, `documentNo`, `submittedDate`.

### 2.5. Onay zinciri (`approval`)

| Alan | Açıklama |
|---|---|
| `steps[].id` | Adım kimliği, şablon içinde benzersiz |
| `steps[].label` | Görünen ad. PDF imza bloğunda kullanılır. |
| `steps[].anyOf` | Kabul edilen roller. Biri yeterlidir. |
| `steps[].substitutes` | İkame roller. İmza "… adına" olarak kaydedilir. |
| `steps[].fallback` | Uygun imzacı yoksa (boş rol veya yalnızca dilekçe sahibi) yükselinecek roller |
| `steps[].when` | Koşul: `{ "field": "...", "in": [...] }` veya `{ "field": "...", "equals": ... }`. Koşul sağlanmazsa adım `skipped` olur. |
| `onReturn` | `restart` (ilk dönemde tek seçenek): iade sonrası zincir baştan başlar. |
| `reminderAfterDays` | Hatırlatma eşiği |

Rol kapsamı (`scope`) değerleri:

| `scope` | Anlamı |
|---|---|
| (yok) | Kol geneli roller için (`branch.*`, `fn.*`, `board.member`) |
| `petition_unit` | Dilekçenin birimi |
| `petition_unit_or_ancestor` | Dilekçenin biriminden başlayarak üst birimlere doğru, rol sahibi bulunan ilk birim |
| `unit:<unitId>` | Sabit birim (örn. `unit:comms`) |

### 2.6. Çıktı (`output`)

| Alan | Açıklama |
|---|---|
| `pdfLayout` | `kurumsal-v1`: Bildirge başlık düzeni (logo, üniversite/topluluk adı, doküman adı, Doküman No, Yayın Tarihi, Rev No, Sayfa) |
| `showVerificationQr` | PDF altbilgisine doğrulama QR'ı ekle |
| `externalSignatureRequired` | `true` ise Hub onayından sonra PDF'in ayrıca ıslak veya e-imzayla imzalanması gerektiği PDF'te ve ekranda belirtilir (AS-08) |
| `notifyOnApproval` | Onaylanınca bilgilendirilecek roller |

## 3. CI doğrulama kuralları

`pnpm templates:validate` her PR'da çalışır. Aşağıdaki durumlarda PR birleştirilemez:

1. Şema (zod) hatası.
2. Yayınlanmış bir sürüm dosyasında değişiklik var (git diff ile kontrol edilir).
3. `version`, önceki sürümden tam olarak 1 fazla değil.
4. `formCode` başka bir şablonla çakışıyor.
5. `body` içindeki yer tutucu tanımsız bir alana başvuruyor.
6. Onay zincirindeki rol `roles.ts` içinde yok, ya da kapsam rol türüyle uyumsuz (örn. `branch.chair` + `petition_unit`).
7. Koşulsuz en az bir adım yok.
8. `personal` sınıfındaki bir alanda `purpose` boş.
9. `fixtures/sample.json` şemaya uymuyor veya PDF anlık görüntüsü değişmiş ve güncellenmemiş.

`templates/**` yolu için `CODEOWNERS` kuralı: TechOps geliştiricisi **ve** Evrak Sorumlusu/Genel Sekreter onayı gerekir.
