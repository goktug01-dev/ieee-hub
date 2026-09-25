# IEEE İKÇÜ Hub

IEEE İzmir Kâtip Çelebi Üniversitesi Öğrenci Kolu'nun iç operasyon portalı. İlk sürümün kapsamı:

**Canlı sistem:** https://ieee-hub-techops.web.app

- **E-dilekçe:** Kurumun kendi **Word** dilekçe formatları Hub'a yüklenir ya da Hub içinde oluşturulur. Word içindeki `{alan_adi}` etiketleri kendiliğinden forma dönüşür. Dilekçe doldurulurken belge anında önizlenir. Hem **kol geneli** hem **komite içi** dilekçe gönderilebilir.
- **Rol bazlı onay:** Her şablonun kendi onay zinciri vardır (örneğin Komite Başkanı → Genel Sekreter → Başkan). Onaylayan kişinin rolü, birimi, görev süresi ve adım sırası güvenlik kurallarıyla denetlenir. İade, ret ve düzeltip yeniden gönderme desteklenir.
- **Evrak numarası ve doğrulama:** Numaralar boşluksuz ve seri bazlıdır (`IEEEIKCU-2026-ETK-0007`). Belge Word olarak indirilebilir ya da tarayıcıdan PDF'e yazdırılabilir. Herkese açık `/dogrula/{kod}` sayfası belgenin gerçek olup olmadığını gösterir.
- **Arayüzden düzenlenen organizasyon:** Komiteler ve birimler, roller ve yetkileri, dönemler, görev atamaları, **seçimler** (sonuçlar tek tıkla göreve işlenir), üye onayı, kurum ayarları ve denetim kaydı.

> **Maliyet: 0 TL.** Hub, Firebase'in ücretsiz **Spark** planında sunucu kodu olmadan çalışır. Faturalandırma hesabı gerekmez, bu yüzden beklenmedik fatura riski de yoktur ([ADR-0017](docs/adr/0017-ucretsiz-spark-plani-kurallar-tek-guvenilir-katman.md)). Firestore bölgesi **europe-west1**'dir ([ADR-0018](docs/adr/0018-firestore-bolgesi-europe-west1-ve-hub-uyeligi.md)).

Programın dayanağı: **TechOps Dijital Dönüşüm, Veri Yönetişimi ve Raporlama Otomasyonu Bildirgesi** (IEEE/240826/SÜ/22, Rev 00). Tasarım dokümanları [docs/](docs/README.md) klasöründedir. Önce [uygulanan mimariyi](docs/mimari/uygulanan-mimari.md) okuyun.

## Hızlı başlangıç (yerel geliştirme)

Gerekenler: **Node.js 22+** ve **Java 21+** (Firebase emülatörleri için).

```bash
npm install
npm run emulators      # 1. terminal: Auth + Firestore emülatörleri (arayüz: http://127.0.0.1:4000)
npm run dev            # 2. terminal: http://localhost:5173
```

`.env.development` varsayılan olarak emülatöre bağlanır. İzin verilen kurucu hesabı ilk kurulumu üstlenir ve kurulum sihirbazı açılır. Sihirbaz varsayılan rolleri, isteğe bağlı örnek komiteleri ve iki örnek dilekçe şablonunu oluşturur.

## Testler

```bash
npm run typecheck
npm test               # birim testleri
npm run test:rules     # güvenlik kuralı testleri (emülatör)
npm run test:e2e       # uçtan uca: gerçek istemci kodu + gerçek kurallar (emülatör)
```

Uçtan uca test şu akışı baştan sona çalıştırır: kurulum, üye onayı, görev atama, komite dilekçesi, sahte onay girişimlerinin reddi, üç adımlı onay, belge içeriğinin kontrolü, doğrulama kaydı, iade ve yeniden gönderim, görevi sona eren kişinin onay yetkisini kaybetmesi. GitHub Actions bu testleri her push'ta çalıştırır.

## Canlıya alma (ücretsiz)

1. [Firebase Console](https://console.firebase.google.com)'da yeni proje açın. Plan **Spark** kalsın; faturalandırma eklemeyin. Proje kurumsal bir Google hesabına ait olsun ve en az iki yönetici tanımlansın (Bildirge §5.3).
2. **Firestore Database → Create database →** konum olarak **`europe-west1`** seçin (bu seçim sonradan değiştirilemez), *production mode* ile başlayın.
3. **Authentication → Sign-in method:** *Google* ve *E-posta/Şifre* sağlayıcılarını etkinleştirin.
4. **Proje ayarları → Uygulamalarınız → Web uygulaması ekle.** Çıkan değerleri canlı derleme için `apps/hub/.env.production.local` dosyasına yazın (örnek: [`apps/hub/.env.example`](apps/hub/.env.example)). Yerel geliştirmeyi gerçek projeye bağlamak gerekirse ayrı olarak `apps/hub/.env.development.local` kullanın. Firebase web yapılandırması gizli değildir; asıl güvenlik Firestore kuralları ve Authentication ayarlarındadır.
5. `.firebaserc` içindeki proje kimliğini dağıtım hedefinizle değiştirin.
6. Dağıtın:

   ```bash
   npx firebase login
   npm run deploy         # derleme + Hosting + Firestore kuralları ve dizinleri
   ```

7. `https://<proje>.web.app` adresini açın. İlk kurulum yalnızca Firestore kurallarındaki izinli kurucu e-postasıyla yapılabilir; mevcut canlı hedefte bu hesap `techopsieee@gmail.com` adresidir. Kurulumdan sonra **Kurum ayarları**'ndan logo ve evrak numarası biçimini, **Komiteler ve birimler**'den gerçek birim listesini düzenleyin.

### GitHub Actions ile otomatik dağıtım

`main` dalına her gönderimde [`ci.yml`](.github/workflows/ci.yml) önce tür denetimi, derleme, güvenlik kuralları ve uçtan uca testleri çalıştırır. Canlı dağıtım yalnızca bu kontrollerin tamamı başarılı olursa başlar. Günlük sağlık kontrolü canlı rotaları dışarıdan denetler; Dependabot bağımlılık ve GitHub Actions güncellemeleri için haftalık/aylık PR açar.

- **Variables:** `FIREBASE_PROJECT_ID`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_APP_ID`
- **Secret:** `FIREBASE_SERVICE_ACCOUNT` (Google Cloud Console → IAM → servis hesabı JSON anahtarı). Hesaba yalnızca şu roller verilir: *Firebase Hosting Admin*, *Firebase Rules Admin*, *Cloud Datastore Index Admin*, *Service Usage Consumer*. Mevcut canlı hedefte bu değişkenler ve en düşük yetkili `github-actions-deploy` hesabı kuruludur.

## Word şablonu hazırlama

Mevcut dilekçenizi Word'de açın ve doldurulacak yerlere süslü parantezle alan adı yazın:

```
Adı Soyadı : {ad_soyad}
Etkinlik   : {etkinlik_adi} — {etkinlik_tarihi}
Sayı: {evrak_no}                                  Tarih: {tarih}
```

**Dilekçe şablonları → Yeni şablon → Word dosyası yükle** adımlarından sonra alanlar otomatik algılanır. Soru metinlerini ve alan türlerini düzenleyin, onay zincirini tanımlayın ve **Yayımla**'ya basın. Sistemin doldurduğu etiketlerin (`{evrak_no}`, `{dilekce_sahibi}`, `{onay_1_ad}`, `{#onaylar}…{/onaylar}` …) listesi şablon editöründeki yardım bölümündedir. Word kullanmak istemeyenler için **Sistemde oluştur** seçeneği aynı biçimde bir .docx üretir.

## Depo yapısı

```
ieee-hub/
├── apps/hub/                 # React + Vite + Mantine arayüzü
│   └── src/
│       ├── lib/              # iş mantığı: erişim, dilekçe akışı, Word hattı, şablonlar, kurulum
│       ├── pages/            # ekranlar (petitions/, admin/, public/)
│       └── __tests__/        # birim + uçtan uca testler
├── firebase/
│   ├── firestore.rules       # tek güvenilir katman (tüm yetki kontrolleri)
│   ├── firestore.indexes.json
│   └── tests/                # kural testleri
├── docs/                     # ADR'ler, çalışma paketleri, mimari, RBAC, modüller
├── .github/workflows/        # CI (test) ve Deploy
└── firebase.json
```

## Bilinen sınırlar (Spark planı)

- E-posta bildirimi yok. Bekleyen onaylar Hub'daki sayaçta görünür.
- Çevrim içi gizli oylama yok. Seçim genel kurulda yapılır, sonuçlar Hub'a işlenir.
- Dört göz onayı (ADR-0008), acil erişim (ADR-0010), koşullu onay adımı ve MFA sonraki sürümlere bırakıldı.
- Word belgesine QR görseli basılmaz. Doğrulama bağlantısı ve kodu metin olarak basılır; QR, Hub'daki dilekçe sayfasında görünür.

Ayrıntılar: [ADR-0017](docs/adr/0017-ucretsiz-spark-plani-kurallar-tek-guvenilir-katman.md).

## Gizli bilgiler

Şifre, özel API anahtarı ve servis hesabı dosyası bu depoya **eklenmez** (Bildirge §6.2, §12.5). Firebase web yapılandırması gizli değildir; `.env*.local` dosyaları yine de depoya girmez. `VITE_` ile başlayan her değişken tarayıcı paketinde görünür; HeptaCert anahtarı gibi gizli değerler bu değişkenlere kesinlikle yazılmaz.
