# Firestore Veri Modeli

> **Güncelleme (2026-09-24):** Uygulanan veri modeli ve koleksiyon bazlı yetkiler için [Uygulanan mimari §2](uygulanan-mimari.md#2-koleksiyonlar) esas alınır. Bu doküman hedef modeldir.

Hub'daki tüm koleksiyonların özeti. Modül ayrıntıları ilgili dokümanlardadır. Uygulamada her koleksiyonun zod şeması `packages/shared/src/schemas/` altında tutulur.

## 1. Yazma yetkisi sınıfları

| Sınıf | Anlamı |
|---|---|
| **F** | Yalnızca Cloud Functions (Admin SDK) yazar. İstemci yazmaları kurallarla reddedilir. |
| **R** | İstemci, Security Rules denetiminde doğrudan yazabilir. |
| **İ** | Değiştirilemez (immutable). Oluşturulduktan sonra güncellenemez ve silinemez. |

## 2. Koleksiyonlar

### Kimlik ve RBAC ([WP-11](../work-packages/WP-11-rbac.md))

| Koleksiyon | Yazma | Açıklama |
|---|---|---|
| `people/{uid}` | F | RTDB'den yansıtılan asgari profil: `displayName`, `email`, `membershipStatus`, `photoURL`, `updatedAt`. Ana kayıt RTDB'dir. |
| `terms/{termId}` | F | `{ id: "2026-2027", startsAt, endsAt, handoverOpensAt, status }` |
| `units/{unitId}` | F | [Organizasyon modeli](../rbac/organizasyon-modeli.md) |
| `roleAssignments/{id}` | F | `{ uid, roleId, scope: { kind: "branch" } \| { kind: "unit", unitId }, termId, startsAt, endsAt, status, requestedBy, approvedBy, reason, createdAt, decidedAt, revokedAt, revokedBy, revokeReason }` |
| `access/{uid}` | F | Türetilmiş erişim özeti (§3) |
| `breakGlassGrants/{id}` | F | Acil erişim talepleri ve süreli izinler ([ADR-0010](../adr/0010-teknik-erisim-ve-acil-erisim.md)) |

### Operasyon (WP-05 … WP-08)

| Koleksiyon | Yazma | Açıklama |
|---|---|---|
| `projects/{id}` | R | `unitId`, `ownerUid`, `status`, tarihler, Drive bağlantısı |
| `tasks/{id}` | R | Bildirge §9.5 zorunlu alanları. `unitId`, `projectId?`, `assigneeUid` (tek sorumlu), `supporterUids`, `startDate`, `dueDate`, `priority`, `status`, `doneCriteria`, `fileLink` |
| `events/{id}` | F/R | Kimlik = etkinlik kodu (`EVT-2026-001`). Onay ve kapanış geçişleri F, diğer alanlar R. |
| `events/{id}/participants/{pid}` | F | HeptaCert kurumsal kopyası (Bildirge §10.4) |
| `syncRuns/{id}` | F, İ | Eşitleme kaydı (Bildirge §10.5) |
| `contentRequests/{id}` | R | İletişim talepleri |
| `sponsors/{id}`, `sponsors/{id}/interactions/{iid}` | R | Sponsor havuzu ve görüşmeler |
| `budgets/{id}` | R | Etkinlik/birim bütçe özeti ve Sheets bağlantısı |

### E-Dilekçe ([WP-12](../work-packages/WP-12-e-dilekce.md))

[E-Dilekçe veri modeli](../moduller/e-dilekce/veri-modeli.md): `petitionTemplates`, `petitions`, `revisions` (İ), `signatures` (İ), `counters`, `petitionVerifications`.

### Raporlama, denetim ve sistem

| Koleksiyon | Yazma | Açıklama |
|---|---|---|
| `auditLogs/{id}` | F, İ | [ADR-0009](../adr/0009-degistirilemez-denetim-kaydi.md) |
| `automationRuns/{id}` | F, İ | Bildirge §11.9 |
| `dataQualityFlags/{id}` | F | Bildirge §11.8 uyarıları; `resolvedAt`, `resolvedBy` |
| `reports/{id}` | F | Üretilen raporların üst verisi, Drive/Docs bağlantısı, onay durumu |
| `vtoolsPackages/{id}` | F/R | Hazırlanıyor → Kontrol Bekliyor → Gönderildi → Onaylandı (Bildirge §11.7) |
| `accessTasks/{id}` | F/R | Harici sistem erişim görevleri ([atama kuralları §7](../rbac/atama-kurallari.md)) |
| `notifications/{uid}/items/{id}` | F | Uygulama içi bildirimler. Kullanıcı yalnızca `readAt` alanını günceller (R). |
| `config/{doc}` | F | Sistem yapılandırması (numaralandırma formatı, özellik bayrakları) |

## 3. `access/{uid}`: erişim özeti

Security Rules, izin kontrolü için her istekte bu dokümanı okur (`get()`). Doküman yalnızca Functions tarafından, `roleAssignments` değiştiğinde ve her gece yeniden hesaplanır.

```json
{
  "uid": "abc123",
  "isMember": true,
  "branchPerms": ["org.unit.read", "people.directory.read", "task.read", "petition.create"],
  "unitPerms": {
    "cs": ["project.read", "project.manage", "task.create", "task.manage", "people.contact.read"]
  },
  "roles": [
    { "roleId": "unit.chair", "unitId": "cs", "assignmentId": "ra_001", "endsAt": "2027-06-30T20:59:59Z" }
  ],
  "validUntil": "2027-06-30T20:59:59Z",
  "version": 42,
  "computedAt": "2026-09-22T18:00:00Z"
}
```

- `unitPerms` alt birimlere **genişletilmiş** olarak yazılır. Kurallar ağaç dolaşmaz; örneğin `techops` başkanının izinleri `techops-mevzuat` anahtarında da bulunur.
- `validUntil`, aktif atamaların en erken bitiş tarihidir. Kurallar `request.time < validUntil` koşulunu kontrol eder. Süresi dolmuş özet hiçbir izin vermez.
- Doküman boyutu: 50 birimde yaklaşık 20 izin ile ~20 KB olur. Firestore'un 1 MiB doküman sınırının çok altındadır.

**Kural örneği (taslak):**

```
function access() {
  return get(/databases/$(database)/documents/access/$(request.auth.uid)).data;
}
function valid(a) { return a.isMember && request.time < a.validUntil; }
function hasBranch(perm) { let a = access(); return valid(a) && perm in a.branchPerms; }
function hasUnit(perm, unitId) {
  let a = access();
  return valid(a) && (perm in a.branchPerms || (unitId in a.unitPerms && perm in a.unitPerms[unitId]));
}

match /tasks/{taskId} {
  allow read: if hasUnit('task.read', resource.data.unitId)
              || request.auth.uid == resource.data.assigneeUid
              || request.auth.uid in resource.data.supporterUids;
}
```

## 4. Adlandırma kuralları

- Koleksiyon adları çoğul ve `camelCase` (`roleAssignments`).
- Kimlikler: anlamlı kalıcı kimlik varsa o kullanılır (`units/cs`, `events/EVT-2026-001`, `terms/2026-2027`). Yoksa Firestore otomatik kimliği kullanılır.
- Zaman alanları `...At` (timestamp), tarih alanları `...Date` (`YYYY-MM-DD` string, saat dilimi hatalarını önlemek için).
- Silme yerine `status: "archived"` / `"cancelled"` tercih edilir (Bildirge §5.7).
