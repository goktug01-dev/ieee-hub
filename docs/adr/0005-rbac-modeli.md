# ADR-0005: Kapsamlı, dönem bazlı RBAC modeli

- **Durum:** Kısmen yerini aldı — §1 "roller kodda" ve §3 için [ADR-0019](0019-organizasyon-roller-ve-secimler-arayuzden-duzenlenir.md); kapsamlı model geçerli
- **Tarih:** 2026-09-22
- **Karar vericiler:** TechOps Başkanlığı; onay: Yönetim Kurulu
- **İlgili:** WP-11, ADR-0006, ADR-0007, ADR-0008, Bildirge §5.4, §8, AS-01, AS-02, AS-03

## Bağlam

IEEE İKÇÜ'de yetki bir kişinin **unvanından** ve **hangi birimde** olduğundan gelir. CS Komite Başkanı kendi komitesinde geniş yetkiye sahiptir, RAS komitesinde yetkisi yoktur. Genel Sekreter tüm birimlerin evrakını görür, ama finans verisini düzenleyemez. Yapı şu katmanlardan oluşur: Yönetim Kurulu → komiteler/başkanlıklar → başkan ve başkan yardımcıları → koordinasyon üyeleri → gönüllüler.

Gereksinimler:
- En az yetki ilkesi (Bildirge §5.4)
- Aynı kişinin farklı birimlerde farklı rolleri olabilmesi
- Her yıl değişen yönetim (dönem bağımlılığı)
- Yetkinin kimde olduğunun her an açıkça görülebilmesi ve denetlenebilmesi (Bildirge §5.7)

## Karar

### 1. Model: kapsamlı RBAC

`Kişi —(rol ataması: rol + kapsam + dönem)→ Rol —(içerir)→ İzinler`

- **Rol**, sabit bir izin kümesidir. Roller ve izinleri **kodda** tanımlanır (`packages/shared/src/rbac/roles.ts`, `permissions.ts`). Veritabanında rol tanımı yoktur, yalnızca **rol ataması** vardır.
- **Kapsam** iki türlüdür: `branch` (kol geneli) veya `unit:<id>` (birim ve tüm alt birimleri).
- **İzin** `alan.eylem` biçimindedir (`task.create`, `petition.read`). İzin, verildiği kapsamda geçerlidir.
- Rol kalıtımı yalnızca **izinler için** geçerlidir (`unit.chair` ⊇ `unit.vice_chair` ⊇ `unit.coordinator` ⊇ `unit.volunteer`). Onay zincirlerinde roller tam eşleşmeyle aranır.
- Varsayılan **ret**: tanımlanmamış her izin reddedilir.

Rol kataloğu: [rbac/rol-katalogu.md](../rbac/rol-katalogu.md). Yetki matrisi: [rbac/yetki-matrisi.md](../rbac/yetki-matrisi.md).

### 2. Karar fonksiyonu

```ts
can(principal: Principal, permission: PermissionId, target: { unitId?: string; ownerUids?: string[] }): boolean
```

1. `principal.activeAssignments` içinden, `now` anında geçerli olanlar alınır.
2. Her atamanın rolünün izin kümesi (kalıtımla) genişletilir.
3. İzin `branch` kapsamlı bir atamada varsa → **izin verilir**.
4. İzin, `target.unitId` birimini veya bir atasını kapsayan bir birim atamasında varsa → **izin verilir**.
5. İzin "O" (kendi/ilişki) kapsamında tanımlıysa ve `principal.uid ∈ target.ownerUids` ise → **izin verilir**.
6. Aksi hâlde **reddedilir**.

Aynı fonksiyon Functions'da (yetkili karar), istemcide (yalnızca arayüz) ve kural testlerinin üretiminde kullanılır.

### 3. Rol kataloğunu değiştirmek

Yeni rol veya izin eklemek bir **kod değişikliğidir** (PR + inceleme). Rolün izin kümesini genişleten değişiklik, yetki matrisini güncelleyen PR ile birlikte YK onayına sunulur. Bu, "sessiz yetki genişlemesini" önler.

### 4. İlişki bazlı kontroller (sınırlı)

Bazı yetkiler rolden değil, kaynakla kurulan ilişkiden gelir:

| İlişki | Alan | Örnek izin |
|---|---|---|
| Görev sorumlusu / destek veren | `tasks.assigneeUid`, `supporterUids` | `task.update_status` (O) |
| Etkinlik sorumlusu | `events.ownerUids` | `event.manage` (O) |
| Dilekçe sahibi | `petitions.ownerUid` | `petition.read`, `petition.withdraw` (O) |
| Aktif adımda uygun imzacı | `petitions.activeEligibleUids` | `petition.read` (O) |

Bu, tam bir ReBAC/ABAC sistemi değildir. İlişkiler az sayıdadır ve her biri yetki matrisinde açıkça listelenir.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Kapsamlı RBAC + sınırlı ilişki kontrolü (seçilen) | Organizasyon yapısına birebir uyar, anlaşılır, denetlenebilir | Birim ağacı genişletmesi gerekir |
| Düz RBAC (kapsamsız roller: "cs_chair", "ras_chair"…) | Basit | Rol sayısı birim sayısıyla katlanır; yeni komite = kod değişikliği |
| Rolleri veritabanında tanımlamak (yönetici arayüzünden düzenlenebilir) | Esnek | İzin genişlemesi PR/inceleme dışında olur; güvenlik kurallarıyla tutarlılık zorlaşır; test edilemez |
| Tam ABAC / politika motoru (OPA, Cedar) | Çok güçlü | Bu ölçek için gereksiz karmaşıklık; Security Rules ile entegrasyonu zor |

## Sonuçlar

**Olumlu:** Yeni komite açmak yalnızca bir `units` kaydıdır, kod gerekmez. "Kimin neye erişimi var?" sorusu `roleAssignments` sorgusuyla cevaplanır.

**Olumsuz:** Rol kataloğunda değişiklik geliştirici gerektirir. Bu bilinçli bir tercihtir.

**Riskler:** Rol kataloğu gerçek organizasyonla uyuşmayabilir (AS-01, AS-03). WP11-T01'de organizasyon envanteri çıkarıldıktan sonra katalog kesinleştirilir.

## Uygulama notları

```ts
// packages/shared/src/rbac/roles.ts (taslak)
export const ROLES = {
  'unit.volunteer':   { kind: 'unit',   inherits: [],                   perms: ['project.read', 'task.read'] },
  'unit.coordinator': { kind: 'unit',   inherits: ['unit.volunteer'],   perms: ['task.create', 'task.manage', 'task.update_status', 'event.propose', 'content.request.create', 'people.contact.read'] },
  'unit.vice_chair':  { kind: 'unit',   inherits: ['unit.coordinator'], perms: ['project.manage', 'event.manage', 'rbac.assignment.read'] },
  'unit.chair':       { kind: 'unit',   inherits: ['unit.vice_chair'],  perms: ['event.participant.read', 'report.ops.read', 'dataquality.read', 'finance.read'] },
  'branch.secretary': { kind: 'branch', inherits: ['board.member'],     perms: ['petition.read', 'petition.archive', 'report.approve'] },
  // ...
} as const satisfies Record<string, RoleDef>;
```

- `roles.ts` ve `permissions.ts` üzerinde birim testleri: döngüsel kalıtım yok, her izin en az bir rolde tanımlı, `sys.admin` iş verisi izinleri taşımıyor.
