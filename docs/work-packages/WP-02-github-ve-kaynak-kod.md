# WP-02 — GitHub ve Kaynak Kod Yönetimi

| | |
|---|---|
| **Durum** | Planlandı |
| **Paket sorumlusu** | TechOps geliştirici (belirlenecek) |
| **Süreç sahibi** | TechOps Başkanlığı |
| **Takvim** | Hafta 5–6 |
| **Bağımlılıklar** | WP-01 (sistem envanteri) |
| **İlgili ADR'ler** | ADR-0001, ADR-0002, ADR-0004, ADR-0010 |
| **Kaynak** | Bildirge §4.1, §6.2, §9.2, §12.5 |

## Amaç

WordPress sayfa kodlarının ve Hub kaynak kodunun kişilere veya WordPress sayfalarına bağımlı olmadan sürümlenmesi. Hub geliştirmesinin üzerinde çalışacağı monorepo, CI ve ortamların kurulması.

## Kapsam

**Dahil:** GitHub organizasyonu, depolar, WordPress kodlarının aktarımı, Hub monorepo iskeleti, CI/CD, staging projesi, gizli bilgi yönetimi, kod inceleme süreci.

**Hariç:** WordPress eklenti/tema yönetimi (IEEE Global Webmaster yetkisinde).

## Çıktılar

| # | Çıktı | Biçim / konum |
|---|---|---|
| Ç1 | GitHub organizasyonu (en az 2 sahip, 2FA zorunlu) | `github.com/<org>` |
| Ç2 | `ieee-ikcu-web` deposu: WordPress özel sayfa kodları | Her sayfa için bir klasör: `pages/<slug>/`, sayfa URL eşlemesi, yayın talimatı |
| Ç3 | `ieee-ikcu-hub` deposu (bu depo): monorepo iskeleti | ADR-0002 yapısı |
| Ç4 | CI/CD işlem hatları | `.github/workflows/` |
| Ç5 | `staging` Firebase projesi ve Emulator yapılandırması | `firebase.json`, `.firebaserc` |
| Ç6 | Gizli bilgi politikası | `docs/guvenlik/gizli-bilgi-politikasi.md` |
| Ç7 | Katkı ve kod inceleme süreci | `CONTRIBUTING.md` |

## Görevler

| ID | Görev | Hafta | Bağımlılık |
|---|---|---|---|
| WP02-T01 | GitHub organizasyonunu kurumsal e-postayla oluştur; en az 2 sahip; 2FA zorunluluğu; ekipler: `techops`, `evrak`, `yk-okuma` | 5 | — |
| WP02-T02 | `ieee-ikcu-web` deposu: WordPress'teki her özel sayfanın güncel kodunu aktar, sayfa ↔ dosya eşleme tablosu oluştur, yayın talimatı yaz | 5–6 | T01 |
| WP02-T03 | Bu depoyu organizasyona taşı. pnpm workspaces, TypeScript `strict`, ESLint, Prettier, Vitest kurulumu | 5 | T01 |
| WP02-T04 | `apps/hub` iskeleti: Vite + React + Mantine + React Router + Firebase SDK; giriş sayfası (Firebase Auth) | 5–6 | T03 |
| WP02-T05 | `functions` iskeleti: 2. nesil, Node 22, `europe-west3`, ortak callable ara katmanı (`requireAuth`, App Check, zod, hata eşleme) | 6 | T03 |
| WP02-T06 | `firebase/` klasörü: başlangıç kuralları (varsayılan ret), Emulator Suite yapılandırması, seed betiği (sentetik veri) | 6 | T03 |
| WP02-T07 | Staging Firebase projesini oluştur (AS-06 onayından sonra Blaze + bütçe alarmı) | 6 | AS-06 |
| WP02-T08 | CI: her PR'da `lint`, `typecheck`, `test`, Emulator'de kural testleri, Hosting önizleme kanalı | 6 | T04–T06 |
| WP02-T09 | CD: `main` → staging; `v*` etiketi → production. GitHub → Google Cloud kimlik doğrulaması Workload Identity Federation ile yapılır (JSON anahtar dosyası yok). Dağıtım servis hesabına en az yetkili rol verilir. | 6 | T07 |
| WP02-T10 | Dal koruması: `main` için PR zorunlu, en az 1 onay, CI geçmeli, doğrudan push yasak. `CODEOWNERS`. | 6 | T01 |
| WP02-T11 | Secret scanning ve push protection açılır; gitleaks CI adımı eklenir | 6 | T08 |
| WP02-T12 | README'ler (Bildirge §6.2 listesi: amaç, kurulum, yapılandırma, yayınlama, yetki/sahiplik, güvenlik notları, devir) | 6 | T03 |

## Kabul kriterleri

- [ ] K1: WordPress'te çalışan tüm özel kodların güncel sürümü `ieee-ikcu-web` deposunda bulunuyor. Eşleme tablosundaki her sayfa kontrol edilmiş (Bildirge §9.2).
- [ ] K2: Yeni bir geliştirici README'yi izleyerek `pnpm install && pnpm dev` ile Hub'ı Emulator'de 30 dakika içinde çalıştırabiliyor (bir kişiyle test edilir).
- [ ] K3: `main` dalına CI geçmeden birleştirme yapılamıyor.
- [ ] K4: Depo geçmişinde gitleaks taraması temiz.
- [ ] K5: GitHub organizasyonunda en az 2 sahip var ve 2FA zorunlu.

## Riskler

| Risk | Olasılık | Etki | Önlem |
|---|---|---|---|
| WordPress'teki kodun güncel sürümünün hangisi olduğunun bilinmemesi | Orta | Orta | WordPress sayfasından doğrudan dışa aktarım yapılır; o anki hâli referans kabul edilir |
| Blaze onayı gecikmesi (AS-06) | Orta | Orta | Geliştirme Emulator'de sürer. Staging ve production dağıtımları onaya kadar bekler. |
