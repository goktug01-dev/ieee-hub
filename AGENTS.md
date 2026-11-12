# AI devir notu — IEEE İKÇÜ Hub

Bu dosya, bu depoda çalışacak **AI asistanları** (Claude Code, Codex, Cursor, Copilot vb.) ve onları kullanan geliştiriciler içindir. Çalışmaya başlamadan önce tamamını okuyun. Son güncelleme: 2026-11-11.

## Güncel devam noktası (2026-11-11)

- 2026-11-12 mail incelemesi: bazı kişilere mail gitmediği bildirildi. Son çalışmalarda SMTP hatası yok; zamanlama arasında saatlik boşluklar var. Eksik alıcı/boş makam ilk 24 saat yeniden kontrol edilir; eski işlenmiş işler üyeler kaydolduktan sonra yönetici tarafından yeniden kuyruğa alınır. Atanmış iş örneği verildi fakat kişinin canlı alıcı kaydı görülmedi; bunun her eksik mailin kesin nedeni olduğu söylenmemeli.
- Kullanıcı gecikmeli Web Push'u mevcut ücretsiz yapıyla ve girişte otomatik izin çağrısıyla onayladı (ADR-0044). VAPID anahtarı GitHub Secrets/variable içine kuruldu. Hub kurum ayarından servis açılmalı; gerçek cihaz izni ve teslimi ayrıca doğrulanmalı. Otomatik çağrı girişte görünür, sistem izni yalnız düğmeye dokununca istenir. `test:push`, `smoke:push`, kural ve e2e testleri vardır. Mail erişimi ve MAIL_ENABLED iki kanalın ortak ana durdurma denetimidir.

- GitHub'daki `4f943c0` sürümü (2026-10-06) oda rezervasyonu ve CI güncellemelerini içeriyordu; yereldeki eski tabanla birleştirildi. Aşağıdaki eski §5 notu güncel Git durumunu yansıtmaz.
- Hub–site otomasyonu, ACTOR puan/QR doğrulaması ve tüzük/yıllık aktiflik çalışmaları ayrı commit'te kaydedildi (ADR-0039–0041). PWA ayrı commit'tedir. Oda rezervasyonunun yayımlanmış ADR-0038 numarası korundu; önceki commitlenmemiş ADR numaraları kaydırıldı.
- Telefona kurulabilen PWA desteği eklendi (ADR-0042): giriş, kullanıcı menüsü ve Yardım üzerinden kurulum; yalnız statik bağlantısız ekranını saklayan üretim worker'ı. `npm run smoke:pwa` demo emülatörleriyle ayrı üretim derlemesini sınar; normal `dist` çıktısını değiştirmez.
- Kullanıcı **GitHub Actions + Gmail** çözümünü ve `techopsieee@gmail.com` göndericisini onayladı (ADR-0043); istisna Web Push'a genişletildi (ADR-0044). Firebase Spark kalır. Kurulum: `docs/e-posta-kurulumu.md`, `docs/telefon-bildirimleri.md`. Gizli anahtarlar sohbete/dosyaya alınmaz; GitHub Secrets'a stdin ile yazılır.
- Mail sürümünde 101 Firestore/SDK testi, 75 birim/gerçek istemci testi, 14 mail mantığı testi ve 77 sayfalık genel tarayıcı kontrolü geçti; üretim derlemesi temiz. `npm run smoke:mail` doğrulama, tercih kalıcılığı, servis ayarı, ilk kuyruklama ve mobil görünümü sınar. Site RTDB testleri `npm run test:site` ile ayrıca CI'da çalışır. Gerçek Gmail gönderimi run `43058725075` ile başarılı oldu (1 gönderim); kullanıcı mailin ulaştığını doğruladı ve ardından GitHub `MAIL_ENABLED=true` açıldı.
- Tüzük kurulumu rol adı + anahtarı + aktif görevlilerle seçim sunar. Aynı adlı rolleri otomatik birleştirmeyin/silmeyin ve kişi ataması yapmayın. Kullanıcının paylaştığı PDF mevcut katalog metniyle aynıdır; canlı politika henüz bu çalışma kapsamında yayımlanmadı. Kurul koltuklarını üzerine yazan kestirme kaldırıldı; Kurullar › Üyeler ve ayarlar üzerinden incelenir. `npm run smoke:statutory` yalnız demo emülatöründe aynı adlı rol ayrımı ve politika kaydını sınar.
- Kullanıcı commit ve siteye yayın için 2026-11-11 tarihinde açık talimat verdi. Yayın PR üzerinden `main` birleştirmesi ve GitHub Actions ile yapılır; canlı durum için son CI çalışmasını kontrol edin. Ayrı site RTDB kuralları ve WordPress duyuru bileşeni Hub dağıtımıyla otomatik kurulmaz (ADR-0040).
- Bu ortamda Firebase CLI ortam değişkenlerini debug günlüğüne yazabiliyor. Komut süreçlerinde `DEBUG` boş bırakılmalı; ortamın tamamını veya gizli değerleri çıktıya vermeyin.

## 1. Proje bir bakışta

IEEE İzmir Kâtip Çelebi Üniversitesi Öğrenci Kolu'nun iç operasyon portalı: e-dilekçe ve rol bazlı onay, görev/proje, etkinlik, iletişim, sponsorluk, bütçe, raporlar, organizasyon (birim, rol, dönem, seçim), envanter ve devir. Dayanak: TechOps Dijital Dönüşüm Bildirgesi (IEEE/240826/SÜ/22). Tasarım: [docs/](docs/README.md); güncel mimari: [docs/mimari/uygulanan-mimari.md](docs/mimari/uygulanan-mimari.md).

## 2. Değişmez kısıtlar (kullanıcı kararları)

Bunları "iyileştirme" adına değiştirmeyin; değişiklik gerekiyorsa önce kullanıcıya sorun ve yeni ADR yazın.

1. **Maliyet sıfır: Firebase Spark planı.** Blaze, Cloud Functions, Secret Manager, Firebase zamanlanmış iş ve Cloud Storage yok. Onaylı arka plan istisnası mevcut public GitHub Actions ile Gmail ve Web Push gönderimidir ([ADR-0043](docs/adr/0043-github-actions-ve-gmail-ile-e-posta-bildirimleri.md), [ADR-0044](docs/adr/0044-github-actions-ile-web-push.md)). Hub veri/onay yetkisi Firestore kurallarındadır. Diğer sunucu çözümleri için ADR-0017 geçerlidir.
2. **Firestore bölgesi `europe-west1`** ([ADR-0018](docs/adr/0018-firestore-bolgesi-europe-west1-ve-hub-uyeligi.md)).
3. **Her şey arayüzden düzenlenebilir:** birimler, roller ve izin atamaları, dönemler, seçimler, görevliler, dilekçe şablonları ([ADR-0019](docs/adr/0019-organizasyon-roller-ve-secimler-arayuzden-duzenlenir.md)). Yeni bir yapılandırmayı koda sabitlemeyin.
4. **Dilekçe şablonları Word (.docx):** yüklenir veya sistemde oluşturulur, `{etiket}`'ler forma dönüşür; kol geneli ve komite içi dilekçeler var ([ADR-0020](docs/adr/0020-dilekce-sablonlari-word-tabanli.md)).
5. **Dil:** arayüz ve dokümanlar Türkçe; kod kimlikleri (koleksiyon, alan, izin adları) İngilizce.
6. **Git:** commit'lere ve PR'lara **hiçbir AI katkı satırı eklenmez** (`Co-Authored-By: …`, "Generated with …" vb. yok). Commit'ler yalnızca depo sahibinin git kimliğiyle atılır. `main` dalına doğrudan push yerine PR tercih edilir.

## 3. Güvenlik modeli — en önemli bölüm

Hub veri ve onay yetkileri için **`firebase/firestore.rules` tek güvenilir katmandır.** İstemci koduna (`apps/hub/src`) asla güvenmeyin; arayüzdeki gizle/göster yalnızca kullanıcı deneyimi içindir. Mail yürütücüsü Admin SDK kullanmaz; ayrı Auth kimliğiyle kurallara tabidir ve yalnız mail işlem/kota/sağlık kayıtlarını yazabilir.

- Yetki özeti `access/{uid}`: `superAdmin`, `perms` (kol geneli izin → bitiş), `unitPerms` (`"birim__izin"` → bitiş), `roleKeys` (`"birim__rol"` → bitiş), `memberOf`, `tokens` (dilekçe/devir görünürlüğü). İstemcide `lib/access.ts → computeAccess` görev atamalarından hesaplar; kurallar bitiş zamanını her istekte `request.time` ile karşılaştırır.
- İzin kataloğu `apps/hub/src/lib/permissions.ts` ile kurallar **birlikte** değişir. Yeni izin = kurallarda karşılığı + test.
- Dilekçe onayı izinden değil **rolden** gelir (şablon adımı "şu birimdeki şu rol"). Adım politikası rollerden biri, tüm makamlar veya belirli nisap olabilir. Kurallar: rol ve birim eşleşmesi, sıra/nisap, aynı rolün bir kez sayılması, sahibi onaylayamaz, son 15 dk giriş, önceki onaylar değişmez, evrak sayacı yalnızca +1 ve gönderimle aynı batch'te, doğrulama kaydı dilekçeyle alan alan aynı.
- Birim yöneticisi yalnızca **gönüllü rolünü** kendi biriminde verip alabilir (`access` üzerinde sınırlı güncelleme, `lastDelegation` alanı).
- Birim toplantıları `meetings` koleksiyonundadır: birim üyeleri okur; `unit.meetings.manage` / `unit.manage` yetkilileri taslak yönetir; kesinleşen tutanak kurallarda değişmezdir.
- Harici Firebase bağlantısı servis hesabı kullanmaz. `external.firebase.manage` paneli açar; kullanıcı uzak projede ayrıca oturum açar ve uzak Security Rules nihai yetkidir ([ADR-0027](docs/adr/0027-harici-firebase-ikincil-oturum.md)).
- Tüzük `statutes/current` ve değiştirilemez `statuteVersions/{id}/chunks` kayıtlarında tutulur; tamamı bilinçli olarak public okunur, yalnız organizasyon yöneticisi/Genel Sekreter yayımlar ([ADR-0029](docs/adr/0029-herkese-acik-tuzuk-arsivi.md)).
- Fiziksel demirbaş silinmez; `assets` durumu güncellenirken `assetMovements` hareketi aynı batch'te eklenir. QR etiketi yetki aşmaz ([ADR-0030](docs/adr/0030-demirbas-zimmet-ve-hareket-defteri.md)).
- Komite/YK alımları `recruitmentCalls` + `recruitmentApplications` ile yürür. Açık ilan herkese görünür; başvuru Auth ister ama aktif Hub üyeliği istemez. Başvuruyu yalnız sahibi ve ilgili birim yöneticisi okur; ilanı açan ve başvuruyu değerlendiren kişinin kimliği herkese/adaya açık belgelere yazılmaz, yalnız yöneticilerin okuduğu `internal/meta` ve `internal/review` alt belgelerinde tutulur; başvuru yürürlükteki KVKK aydınlatma metni sürümünü (`privacyNotices`, değiştirilemez) `privacyNoticeId` ile taşımak zorundadır, yayımlı metin yoksa başvuru alınmaz ([ADR-0032](docs/adr/0032-kariyer-kvkk-aydinlatma-ve-kimlik-gizliligi.md)); standart IEEE üyeliği ayrı sistemde kalır ([ADR-0031](docs/adr/0031-ayri-kariyer-vitrini-ve-tarihli-birim-basvurulari.md)).
- Oda rezervasyonu `rooms` + `roomSlots` ile yürür. Her yarım saatlik dilim tek belgedir (`{oda}_{tarih}_{dilim}`); kimlik tekil olduğu için çakışmayı kurallar engeller, dilim güncellenmez, iptal silmedir. Yalnız birimde `unit.room.reserve` izni olan (varsayılan: komite başkanı) alır. Dilim kuralına dilime özgü yeni `get()` eklemeyin: bir rezervasyonun tüm dilimleri tek batch'tir ve batch başına 20 farklı belge erişimi sınırı vardır ([ADR-0038](docs/adr/0038-oda-rezervasyonu-dilim-belgeleriyle-cakismasiz.md)).
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

**Bilinen sınırlar (bilinçli):** e-posta bildirimi yok, gerçek anonimlik sağlayan çevrim içi gizli oylama yok (fiziksel gizli oy süreci ve sonucu yönetilir), kritik rol atamasında dört göz (ADR-0008) ve acil erişim (ADR-0010) yok, koşullu onay adımı ve MFA yok, dönem sonu değerlendirme formu (WP04-T08) yok. Harici Firebase entegrasyonu için uzak proje web yapılandırması, açık veri yolları, kullanıcı hesabı ve güvenlik kuralları ayrıca sağlanmalıdır.

## 6. Çalışma biçimi

- Kullanıcı Türkçe konuşur; kısa ve somut ara bilgi verin. "Dur" derse çalışan süreçleri (emülatör, Vite, headless Edge) kapatıp bekleyin.
- Bilgisayar ayarını değiştiren işlerden (PowerShell politikası, sistem geneline kurulum) ve dış dünyaya yazan işlerden (GitHub, Firebase deploy) önce onay alın.
- Yeni mimari karar = yeni ADR (`docs/adr/_sablon.md`); kabul edilmiş ADR düzenlenmez, "Yerini Aldı" ile işaretlenir.
- Kod ile doküman çelişirse kod esastır; aynı değişiklikte dokümanı düzeltin.
- Kullanma kılavuzu `apps/hub/src/lib/manual.ts` tek kaynaktır (Yardım › Kullanma kılavuzu ve Word çıktısı buradan üretilir). Menü, sekme veya düğme adı değişen ya da yeni iş akışı eklenen her değişiklikte ilgili bölümü aynı commit'te güncelleyin.
- Kullanıcıya "bitti" demeden önce ilgili testleri çalıştırın ve sonucu olduğu gibi bildirin; tarayıcıda denenmemiş ekranı "çalışıyor" diye sunmayın.
