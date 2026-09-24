# E-Dilekçe — Veri Modeli

> **Güncelleme (2026-09-24):** Uygulanan veri modeli: [Uygulanan mimari §2](../../mimari/uygulanan-mimari.md#2-koleksiyonlar). Hash zinciri ve ayrı `signatures` alt koleksiyonu yoktur; onaylar dilekçenin değiştirilemez `approvals` listesinde tutulur.

Firestore koleksiyonları. Genel model: [firestore-veri-modeli.md](../../mimari/firestore-veri-modeli.md). Tüm zaman alanları sunucu zamanıdır (`serverTimestamp`). Uygulamada bu şemaların kaynağı `packages/shared/src/schemas/petition.ts` (zod) olacaktır.

## 1. Koleksiyonlar

```
petitionTemplates/{templateId}
petitionTemplates/{templateId}/versions/{version}
petitions/{petitionId}
petitions/{petitionId}/revisions/{revision}
petitions/{petitionId}/signatures/{signatureId}
counters/{seriesKey}
petitionVerifications/{verificationCode}
```

## 2. `petitionTemplates/{templateId}`

Şablonun kimliği ve güncel durumu. Yalnızca Functions/yayın betiği yazar.

| Alan | Tip | Açıklama |
|---|---|---|
| `id` | string | Örn. `etkinlik-izin` |
| `title` | string | "Etkinlik Düzenleme İzin Dilekçesi" |
| `formCode` | string | Kurumsal form kodu (PDF'teki "Doküman No") |
| `series` | string | Evrak serisi (örn. `ETK`) |
| `activeVersion` | number \| null | Yeni dilekçelerde kullanılan sürüm. `null` ise yeni dilekçe açılamaz. |
| `status` | `active` \| `retired` | |
| `category` | string | Katalogda gruplama |

## 3. `petitionTemplates/{templateId}/versions/{version}`

Şablonun tam tanımı. **Değiştirilemez.** Format: [sablon-formati.md](sablon-formati.md). Ek alanlar:

| Alan | Tip | Açıklama |
|---|---|---|
| `definition` | object | Şablon JSON'u (doğrulanmış) |
| `definitionHash` | string | `SHA-256(JCS(definition))` |
| `publishedAt` | timestamp | PDF'teki "Yayın Tarihi" |
| `publishedBy` | string | Yayını yapan (CI/betik kimliği ve PR numarası) |
| `sourceCommit` | string | Git commit SHA |

## 4. `petitions/{petitionId}`

| Alan | Tip | Açıklama |
|---|---|---|
| `templateId` | string | |
| `templateVersion` | number | Dilekçe oluşturulduğunda sabitlenir |
| `status` | enum | `draft` \| `in_review` \| `returned` \| `approved` \| `rejected` \| `withdrawn` \| `archived` |
| `ownerUid` | string | Dilekçe sahibi |
| `ownerSnapshot` | object | Gönderim anındaki `{ displayName, unitId, unitName, roleTitle }`. Kişinin sonradan birim değiştirmesi eski dilekçeyi etkilemez. |
| `unitId` | string | Dilekçenin ait olduğu birim (varsayılan: sahibinin birimi). Güvenlik kurallarında U kapsamı için kullanılır. |
| `title` | string | Şablondaki `titleTemplate` alanından üretilir |
| `documentNo` | string \| null | Gönderimde atanır ([ADR-0014](../../adr/0014-evrak-numaralandirma.md)) |
| `currentRevision` | number | 0 = hiç gönderilmemiş taslak |
| `draftData` | object | Taslak alan değerleri. Yalnızca `draft`/`returned` durumunda sahibi yazar. |
| `contentHash` | string \| null | Güncel revizyonun içerik özeti |
| `steps` | array | Aşağıya bakınız |
| `currentStepIndex` | number \| null | |
| `activeEligibleUids` | string[] | Aktif adımın `eligibleUids` kopyası. "İmza bekleyenler" sorgusu (`array-contains`) ve okuma kuralı için. Adım yoksa boş dizi. |
| `signerUids` | string[] | Bu dilekçede herhangi bir revizyonda imza atmış kişiler (okuma kuralı için) |
| `verificationCode` | string \| null | Gönderimde üretilir |
| `pdf` | object \| null | `{ storagePath, sha256, generatedAt, revision }` |
| `archive` | object \| null | `{ driveFileId?, archivedAt, archivedBy }` |
| `retentionUntil` | timestamp | Şablonun saklama kuralından hesaplanır |
| `createdAt`, `submittedAt`, `decidedAt`, `updatedAt` | timestamp | |

### `steps[]` öğesi

| Alan | Tip | Açıklama |
|---|---|---|
| `stepId` | string | Şablondaki adım kimliği |
| `label` | string | "Komite Başkanı Onayı" |
| `status` | enum | `waiting` \| `active` \| `approved` \| `rejected` \| `returned` \| `skipped` |
| `resolvedScope` | object | Adım açıldığında çözülen kapsam: `{ unitId? }` |
| `eligibleUids` | string[] | Adım açıldığında uygun imzacılar. Rol değişikliklerinde yeniden hesaplanır. Yalnızca okuma kuralı ve bildirim için kullanılır. İmza yetkisi imza anında sunucuda **yeniden doğrulanır**. |
| `escalated` | boolean | `fallback` rolüne yükseldi mi |
| `activatedAt`, `completedAt` | timestamp | |
| `signatureId` | string \| null | Adımı kapatan imza kaydı |

## 5. `petitions/{id}/revisions/{revision}`

Her gönderimde bir revizyon oluşturulur. **Değiştirilemez.**

| Alan | Tip | Açıklama |
|---|---|---|
| `revision` | number | 1, 2, … |
| `data` | object | Alan değerleri (şablona göre doğrulanmış) |
| `renderedBody` | string | Yer tutucuları doldurulmuş dilekçe metni |
| `contentHash` | string | Aşağıdaki kanonik içerik özeti |
| `submittedAt` | timestamp | |
| `submittedBy` | string | |

### İçerik özeti (content hash)

```
contentHash = SHA-256( JCS({
  "schema": "ieee-ikcu/petition-content/v1",
  "petitionId": "...",
  "documentNo": "...",
  "templateId": "...",
  "templateVersion": 3,
  "templateDefinitionHash": "...",
  "revision": 2,
  "owner": { "uid": "...", "displayName": "...", "unitId": "..." },
  "data": { ... },
  "renderedBody": "..."
}) )
```

JCS: RFC 8785 JSON Canonicalization Scheme. Hash yalnızca sunucuda hesaplanır. İstemcinin gönderdiği hash kabul edilmez.

## 6. `petitions/{id}/signatures/{signatureId}`

**Değiştirilemez, silinemez.** Yalnızca Functions yazar.

| Alan | Tip | Açıklama |
|---|---|---|
| `stepId` | string | |
| `revision` | number | İmzanın ait olduğu revizyon |
| `contentHash` | string | İmza anındaki içerik özeti |
| `decision` | enum | `approve` \| `reject` \| `return` |
| `comment` | string \| null | Ret ve iade için zorunlu |
| `signer` | object | `{ uid, displayName, email }` (imza anındaki anlık görüntü) |
| `signedAsRole` | object | `{ roleId, unitId?, roleTitle, assignmentId }` |
| `onBehalfOf` | object \| null | İkame imzada asıl rol: `{ roleId, unitId?, roleTitle }` |
| `authContext` | object | `{ authTime, mfa: boolean, reauthWithinSeconds }` |
| `signedAt` | timestamp | Sunucu zamanı |
| `prevChainHash` | string | Önceki imzanın `chainHash` değeri. İlk imzada `SHA-256("petition:" + petitionId)` |
| `chainHash` | string | `SHA-256(prevChainHash + JCS(imzanın çekirdek alanları))` |

IP adresi ve tarayıcı bilgisi imza kaydına yazılmaz. Güvenlik amaçlı istek kayıtları Cloud Logging'de standart saklama süresiyle tutulur (veri minimizasyonu).

## 7. `counters/{seriesKey}`

`seriesKey = {YYYY}_{SERİ}` (örn. `2026_ETK`). `{ next: number }`. Yalnızca `submitPetition` fonksiyonu transaction içinde artırır.

## 8. `petitionVerifications/{verificationCode}`

Herkese açık doğrulama için **ayrı ve minimum** kopya. Doğrulama fonksiyonu yalnızca bu dokümanı okur.

| Alan | Açıklama |
|---|---|
| `petitionId` | İç referans. Doğrulama çıktısında gösterilmez. |
| `documentNo`, `templateTitle`, `status` | |
| `ownerMasked` | "G*** K***" biçiminde maskelenmiş ad |
| `signatures` | `[{ displayName, roleTitle, onBehalfOf?, decision, signedAt }]` |
| `contentHash`, `pdfSha256` | |
| `updatedAt` | |

## 9. İndeksler (ilk tahmin)

| Koleksiyon | Alanlar | Kullanım |
|---|---|---|
| `petitions` | `ownerUid ASC, updatedAt DESC` | Dilekçelerim |
| `petitions` | `status ASC, unitId ASC, updatedAt DESC` | Birim listesi |
| `petitions` | `status ASC, templateId ASC, submittedAt DESC` | GS listesi |
| `petitions` | `activeEligibleUids ARRAY_CONTAINS, updatedAt DESC` | İmza bekleyenler |

Firestore dizi içindeki nesne alanlarını (`steps[].eligibleUids`) sorgulayamaz. İmza kutusu bu yüzden üst seviyedeki `activeEligibleUids` alanını kullanır.
