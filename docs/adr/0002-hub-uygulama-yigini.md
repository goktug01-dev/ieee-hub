# ADR-0002: Hub: TypeScript monorepo, React + Vite SPA, Firebase Hosting

- **Durum:** Önerildi
- **Tarih:** 2026-09-22
- **Karar vericiler:** TechOps Başkanlığı
- **İlgili:** WP-02, ADR-0003, ADR-0004, Bildirge §4.1, §5.8, §6.2, §6.5, AS-12

## Bağlam

- Hub, onlarca kullanıcılı, yetki kontrolü yoğun bir iç yönetim uygulamasıdır. SEO ve sunucu tarafı render ihtiyacı yoktur.
- Mevcut kimlik altyapısı Firebase'dir (Bildirge §6.3).
- Geliştirici ekip gönüllü öğrencilerden oluşur ve her yıl değişir. Seçilen teknolojinin yaygın, iyi belgelenmiş ve öğrenilmesi kolay olması gerekir.
- WordPress sayfalarına `innerHTML` ile kod eklemek Bildirge §4.1'de risk olarak tanımlanmıştır.
- Dilekçe şablonları, RBAC tanımları ve doğrulama şemaları hem istemcide hem sunucuda **aynı kodla** çalışmalıdır.

## Karar

| Katman | Seçim |
|---|---|
| Dil | TypeScript (`strict`) |
| Depo | pnpm workspaces monorepo: `apps/hub`, `functions`, `packages/shared`, `packages/petition-templates`, `packages/pdf` |
| Arayüz | React + Vite, SPA |
| UI bileşenleri | Mantine (form, tablo, tarih seçici, Türkçe yerelleştirme) |
| Yönlendirme | React Router |
| Sunucu durumu | TanStack Query + Firebase JS SDK (modüler) |
| Formlar ve doğrulama | react-hook-form + zod (şemalar `packages/shared` içinde, Functions ile ortak) |
| Barındırma | Firebase Hosting. Başlangıçta varsayılan `*.web.app` alan adı kullanılır (AS-12). |
| Backend | Cloud Functions 2. nesil, Node.js 22, TypeScript ([ADR-0004](0004-guvenilir-backend-cloud-functions.md)) |
| Test | Vitest (birim), Firebase Emulator Suite + `@firebase/rules-unit-testing` (güvenlik kuralları), Playwright (pilot öncesi uçtan uca) |
| Kalite | ESLint, Prettier, `tsc --noEmit` |
| CI/CD | GitHub Actions: her PR'da lint + tip kontrolü + test + kural testleri + staging önizleme kanalı. `main` dalına birleştirmede staging, etiketle (`v*`) production dağıtımı. |

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| React + Vite SPA (seçilen) | En yaygın ekosistem, basit barındırma, Firebase ile doğal uyum | SSR yok (ihtiyaç da yok) |
| Next.js | Güçlü çatı | SSR/Server Actions için ek barındırma gerekir. Firebase ile karmaşıklığı artırır, getirisi bu projede düşük. |
| Vue / Angular | Olgun | Ekip ve topluluk bilgisi daha dar (varsayım, ekip yetkinliğine göre yeniden değerlendirilebilir) |
| WordPress içinde özel sayfa | Mevcut altyapı | Bildirge §4.1 ve §6.1'e aykırı, yetki kontrolü zayıf |
| Low-code (AppSheet, Glide, Softr) | Hızlı başlangıç | RBAC ve imza gereksinimleri karşılanamaz, veri taşınabilirliği zayıf (Bildirge §5.8) |

## Sonuçlar

**Olumlu:** Tek dil ve paylaşılan şemalar sayesinde istemci ve sunucu doğrulaması aynı kodla yapılır. Dilekçe PDF'inin tarayıcıdaki önizlemesi ile sunucudaki çıktısı aynı bileşenden üretilir.

**Olumsuz:** Monorepo kurulumu ilk hafta ek iş gerektirir.

**Riskler ve önlemler:** Ekip React bilmiyorsa ilk iki hafta eğitim planlanır. Ekip çoğunluğu başka bir çatıda yetkinse bu ADR, implementasyon başlamadan yeniden değerlendirilir.

## Uygulama notları

- Node sürümü `.nvmrc` ve `engines` alanında sabitlenir.
- Arayüz dili Türkçedir. Metinler `apps/hub/src/i18n/tr.ts` dosyasında toplanır; ikinci dil ilk dönemde yoktur.
- Mobil uyumluluk: temel ekranlar (görevlerim, imza bekleyenler, dilekçe formu) telefonda kullanılabilir olmalıdır.
