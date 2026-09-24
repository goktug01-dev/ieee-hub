# AI devir notu — IEEE İKÇÜ Hub

Bu dosya, bu depoda çalışacak **AI asistanları** (Claude Code, Codex, Cursor, Copilot vb.) ve onları kullanan geliştiriciler içindir. Çalışmaya başlamadan önce tamamını okuyun. Son güncelleme: 2026-09-24.

## 1. Proje bir bakışta

IEEE İzmir Kâtip Çelebi Üniversitesi Öğrenci Kolu'nun iç operasyon portalı: e-dilekçe ve rol bazlı onay, görev/proje, etkinlik, iletişim, sponsorluk, bütçe, raporlar, organizasyon (birim, rol, dönem, seçim), envanter ve devir. Dayanak: TechOps Dijital Dönüşüm Bildirgesi (IEEE/240826/SÜ/22). Tasarım: [docs/](docs/README.md); güncel mimari: [docs/mimari/uygulanan-mimari.md](docs/mimari/uygulanan-mimari.md).

## 2. Değişmez kısıtlar (kullanıcı kararları)

Bunları "iyileştirme" adına değiştirmeyin; değişiklik gerekiyorsa önce kullanıcıya sorun ve yeni ADR yazın.

1. **Maliyet sıfır: Firebase Spark planı.** Blaze yok → Cloud Functions, Secret Manager, zamanlanmış iş, Cloud Storage **yok**. Sunucu kodu gerektiren bir çözüm önermeyin ([ADR-0017](docs/adr/0017-ucretsiz-spark-plani-kurallar-tek-guvenilir-katman.md)).
2. **Firestore bölgesi `europe-west1`** ([ADR-0018](docs/adr/0018-firestore-bolgesi-europe-west1-ve-hub-uyeligi.md)).
3. **Her şey arayüzden düzenlenebilir:** birimler, roller ve izin atamaları, dönemler, seçimler, görevliler, dilekçe şablonları ([ADR-0019](docs/adr/0019-organizasyon-roller-ve-secimler-arayuzden-duzenlenir.md)). Yeni bir yapılandırmayı koda sabitlemeyin.
4. **Dilekçe şablonları Word (.docx):** yüklenir veya sistemde oluşturulur, `{etiket}`'ler forma dönüşür; kol geneli ve komite içi dilekçeler var ([ADR-0020](docs/adr/0020-dilekce-sablonlari-word-tabanli.md)).
5. **Dil:** arayüz ve dokümanlar Türkçe; kod kimlikleri (koleksiyon, alan, izin adları) İngilizce.
6. **Git:** commit'lere ve PR'lara **hiçbir AI katkı satırı eklenmez** (`Co-Authored-By: …`, "Generated with …" vb. yok). Commit'ler yalnızca depo sahibinin git kimliğiyle atılır. `main` dalına doğrudan push yerine PR tercih edilir.

## 3. Güvenlik modeli — en önemli bölüm

Sunucu olmadığı için **`firebase/firestore.rules` tek güvenilir katmandır.** İstemci koduna (`apps/hub/src`) asla güvenmeyin; arayüzdeki gizle/göster yalnızca kullanıcı deneyimi içindir.

- Yetki özeti `access/{uid}`: `superAdmin`, `perms` (kol geneli izin → bitiş), `unitPerms` (`"birim__izin"` → bitiş), `roleKeys` (`"birim__rol"` → bitiş), `memberOf`, `tokens` (dilekçe/devir görünürlüğü). İstemcide `lib/access.ts → computeAccess` görev atamalarından hesaplar; kurallar bitiş zamanını her istekte `request.time` ile karşılaştırır.
- İzin kataloğu `apps/hub/src/lib/permissions.ts` ile kurallar **birlikte** değişir. Yeni izin = kurallarda karşılığı + test.
- Dilekçe onayı izinden değil **rolden** gelir (şablon adımı "şu birimdeki şu rol"). Kurallar: rol ve birim eşleşmesi, sıra, sahibi onaylayamaz, son 15 dk giriş, önceki onaylar değişmez, evrak sayacı yalnızca +1 ve gönderimle aynı batch'te, doğrulama kaydı dilekçeyle alan alan aynı.
- Birim yöneticisi yalnızca **gönüllü rolünü** kendi biriminde verip alabilir (`access` üzerinde sınırlı güncelleme, `lastDelegation` alanı).
- Firestore kuralları istek başına **1000 ifade** sınırına sahiptir; `update` kurallarını duruma göre dallara ayırın. Liste dilimi `list[0:0]` emülatörde hata verir; boş durumu ayrıca ele alın. Dizi içinde `serverTimestamp()` kullanılamaz.
- Var olmayan dokümana `updateDoc`, kurallar yüzünden `not-found` yerine `permission-denied` döner.

**Kural değişikliği yaptıysanız `npm run test:rules` ve `npm run test:e2e` geçmeden bitmiş saymayın.**

## 4. Depo yapısı ve komutlar

```
apps/hub/            React 19 + Vite 8 + Mantine 9 + React Router 8 (TypeScript 7)
  src/lib/           iş mantığı: access, petitions, workflow, docx, templates, ops, setup, demo
  src/pages/         ekranlar (petitions, work, events, content, finance, reports, admin, public)
  src/__tests__/     birim + uçtan uca (emülatör) testleri
  scripts/           seed-demo.test.ts (demo verisi), smoke.mjs (tarayıcı duman testi)
firebase/            firestore.rules, firestore.indexes.json, tests/ (kural testleri), demo-data/
docs/                ADR'ler, çalışma paketleri, mimari, RBAC
baslat.cmd           Windows: çift tıkla → emülatör + arayüz + demo hesapları
```

| Komut (kök dizin) | Ne yapar |
|---|---|
| `npm run emulators` | Auth + Firestore emülatörü, `firebase/demo-data` ile |
| `npm run dev` | Arayüz, http://localhost:5173 (emülatöre bağlanır) |
| `npm run typecheck` / `npm run build` | Tip denetimi / üretim derlemesi |
| `npm test` | Birim testleri |
| `npm run test:rules` | Kural testleri (emülatör, Java gerekir) |
| `npm run test:e2e` | Gerçek istemci kodu + gerçek kurallar |
| `npm run demo:rebuild` | Demo verisini yeniden üretir (tohumlama gerçek kurallar altında çalışır) |
| `npm run smoke` | Kurulu Edge ile tüm sayfaları gezer, JS hatası arar, ekran görüntüsü alır |

**Windows notları:** PowerShell betik engeli varsa `npm` yerine `npm.cmd` kullanın. Java yoksa `baslat.cmd` taşınabilir Java'yı `.tools/jre` altına indirir; komut satırında `JAVA_HOME=.tools/jre` verin. Demo hesapları giriş ekranında (yalnızca emülatör modunda), şifre `demo1234`.

## 5. Nerede kaldık (2026-09-24)

**Commit'li (2 commit):** ilk sürüm (e-dilekçe, RBAC, organizasyon, seçimler, şablonlar, doğrulama) ve demo hesapları + `baslat.cmd`.

**Yazıldı ve test edildi, COMMIT'LENMEDİ:** operasyon modülleri — görev/proje (kanban), gönüllü başvurusu + oryantasyon, etkinlik (dilekçeyle onay, HeptaCert CSV, kapanış raporu), iletişim (talep, pano, takvim, birim onayı), sponsorluk (kilit, iletişim talebi), bütçe, raporlar (haftalık, aylık, dilekçe metrikleri, veri kalitesi, vTools, devir), envanter, devir paketleri, yardım/sorun bildir, üye ayrılış işlemi. Kural testi 35/35, birim+uçtan uca 18/18 geçti; demo verisi yeniden üretildi; derleme temiz.

**Yarım / yapılmadı — buradan devam edin:**

1. **Tarayıcı duman testi** (`npm run smoke`) kullanıcının isteğiyle yarıda kesildi. Yeni ekranlar tarayıcıda hiç açılmadı; önce bunu çalıştırın, çıkan hataları düzeltin, `apps/hub/smoke-shots/` görüntülerini inceleyin.
2. **Commit:** yukarıdaki değişiklikleri anlamlı bir mesajla commit'leyin (AI satırı yok, bkz. §2.6).
3. **Dokümantasyon:** yeni modüller için ADR (ör. ADR-0022: operasyon modülleri ve birim kapsamlı izinler), `docs/mimari/uygulanan-mimari.md` koleksiyon tablosu, WP-01/04…10 "Güncelleme" notları, `docs/adr/README.md` dizini.
4. **GitHub:** hedef, **`ieeetechops` kullanıcı hesabı altında public repo**. Şu an orada yalnızca boş `ieeetechops/ieeetechops` (profil README adı) var ve yerel kimlik `goktug01-dev`'in yazma yetkisi yok. Kullanıcıdan depo adını ve collaborator erişimini bekleyin; kendiniz depo açmaya veya başka hesabın kimlik bilgisini kullanmaya çalışmayın.
5. **Canlıya alma:** README "Canlıya alma" adımları (Firebase projesi, `europe-west1`, Auth sağlayıcıları, `.env.local`, `npm run deploy`) kullanıcı tarafından yapılacak.

**Bilinen sınırlar (bilinçli):** e-posta bildirimi yok, çevrim içi gizli oylama yok, dört göz onayı (ADR-0008) ve acil erişim (ADR-0010) yok, koşullu onay adımı ve MFA yok, Word belgesine QR görseli basılmıyor, dönem sonu değerlendirme formu (WP04-T08) yok.

## 6. Çalışma biçimi

- Kullanıcı Türkçe konuşur; kısa ve somut ara bilgi verin. "Dur" derse çalışan süreçleri (emülatör, Vite, headless Edge) kapatıp bekleyin.
- Bilgisayar ayarını değiştiren işlerden (PowerShell politikası, sistem geneline kurulum) ve dış dünyaya yazan işlerden (GitHub, Firebase deploy) önce onay alın.
- Yeni mimari karar = yeni ADR (`docs/adr/_sablon.md`); kabul edilmiş ADR düzenlenmez, "Yerini Aldı" ile işaretlenir.
- Kod ile doküman çelişirse kod esastır; aynı değişiklikte dokümanı düzeltin.
- Kullanıcıya "bitti" demeden önce ilgili testleri çalıştırın ve sonucu olduğu gibi bildirin; tarayıcıda denenmemiş ekranı "çalışıyor" diye sunmayın.
