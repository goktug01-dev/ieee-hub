# WP-12 — E-Dilekçe ve Rol Bazlı İmza

> **Güncelleme (2026-09-24):** İlk sürüm uygulandı: Word şablonu yükleme + sistem içi oluşturucu, alan editörü, onay zinciri editörü, değiştirilemez sürümler, kol geneli ve komite dilekçeleri, sıralı onay/iade/ret, boşluksuz evrak no, .docx/PDF çıktı, herkese açık doğrulama. Sapmalar: [ADR-0017](../adr/0017-ucretsiz-spark-plani-kurallar-tek-guvenilir-katman.md), [ADR-0020](../adr/0020-dilekce-sablonlari-word-tabanli.md), [ADR-0021](../adr/0021-belge-ciktisi-tarayicida-docx-ve-dogrulama.md). Koşullu adım, hatırlatma e-postası ve MFA henüz yok.

| | |
|---|---|
| **Durum** | Planlandı |
| **Paket sorumlusu** | TechOps geliştirici (belirlenecek) |
| **Süreç sahibi** | Genel Sekreterlik; operasyon: Evrak ve Arşiv Sorumlusu (Mevzuat ve Arşiv Yönetimi Departmanı) |
| **Takvim** | Hafta 1–4 (envanter ve kararlar), 7–13 (geliştirme), 14 (güvenlik testi), 15 (pilot) |
| **Bağımlılıklar** | WP-11 (roller, `can()`, denetim kaydı), WP-02 (monorepo, CI), ADR-0004 (Functions, Storage) |
| **Bağımlı paketler** | WP-06 (etkinlik izni), WP-08 (harcama talebi), WP-09 (dilekçe metrikleri) |
| **İlgili ADR'ler** | ADR-0011, ADR-0012, ADR-0013, ADR-0014, ADR-0015, ADR-0009 |
| **Modül dokümanları** | [Fonksiyonel tanım](../moduller/e-dilekce/README.md), [veri modeli](../moduller/e-dilekce/veri-modeli.md), [şablon formatı](../moduller/e-dilekce/sablon-formati.md) |
| **Kaynak** | Bildirge'ye eklenmiştir. İlgili ilkeler: §5.1, §5.5, §5.6, §5.7, §12 |

## Amaç

IEEE İKÇÜ'nün kendi dilekçe formatlarını Hub üzerinden çevrim içi doldurulabilir, rol bazlı onay zinciriyle çevrim içi imzalanabilir, evrak numaralı ve doğrulanabilir PDF olarak arşivlenebilir hâle getirmek. Bu paket bittiğinde dilekçeler Word dosyası olarak WhatsApp'ta dolaşmaz; her dilekçenin kimde beklediği, kimin hangi rolle onayladığı ve son hâli Hub'da görülür.

## Kapsam

Bkz. [fonksiyonel tanım §2](../moduller/e-dilekce/README.md). Özet:

**Dahil:** Sürümlü şablonlar, dinamik form, taslak ve önizleme, sıralı onay zinciri (ikame, koşul, yedek rol), onay/iade/ret, evrak numarası, sunucu tarafı PDF, QR doğrulama, bildirim ve hatırlatma, saklama süresi, denetim kaydı.

**Hariç:** 5070 güvenli e-imza, görsel şablon tasarımcısı, paralel onay, dosya yükleme (yerine Drive bağlantısı), üniversite EBYS entegrasyonu.

## Çıktılar

| # | Çıktı | Konum |
|---|---|---|
| Ç1 | Dilekçe envanteri ve onay zinciri tablosu | Sheets: `00_Yonetim_ve_Yonerge/Dilekceler/Envanter` |
| Ç2 | Şablon şeması, doğrulayıcı, yayın betiği | `packages/petition-templates/` |
| Ç3 | En az 3 kurumsal şablon (JSON + örnek veri) | `packages/petition-templates/templates/` |
| Ç4 | PDF paketi (KurumsalV1 düzeni) | `packages/pdf/` |
| Ç5 | İş akışı ve hash kütüphanesi | `packages/shared/src/petitions/`, `packages/shared/src/crypto/` |
| Ç6 | Callable ve tetikleyici fonksiyonlar | `functions/src/petitions/` |
| Ç7 | Security Rules ve Storage Rules + testleri | `firebase/` |
| Ç8 | Arayüz ekranları | `apps/hub/src/features/petitions/` |
| Ç9 | Kullanım kılavuzları: dilekçe sahibi, imzacı, evrak sorumlusu | `docs/kilavuz/` + Drive |
| Ç10 | Güvenlik testi raporu, pilot raporu | `docs/guvenlik/`, `08_Raporlar` |

## Görevler

| ID | Görev | Hafta | Bağımlılık |
|---|---|---|---|
| **Envanter ve kararlar** | | | |
| WP12-T01 | Mevcut dilekçe formatlarının toplanması: format, kullanım sıklığı, dolduran rol, onay zinciri, harici imza gereksinimi, içerdiği kişisel veriler | 1–2 | AS-04, AS-08 |
| WP12-T02 | Onay zincirlerinin sadeleştirilmesi ve YK onayı; evrak numarası formatı (AS-05); saklama süreleri (AS-09); "elektronik onay" ifadesinin Danışmanla netleştirilmesi | 3–4 | T01 |
| WP12-T03 | Pilot için en sık kullanılan 3 şablonun seçimi | 4 | T01 |
| **Çekirdek** | | | |
| WP12-T04 | Şablon zod şeması, `templates:validate` (şablon formatı §3 kurallarının tamamı), `templates:publish`, `CODEOWNERS` | 7 | WP-02, WP11-T03 |
| WP12-T05 | PDF paketi: KurumsalV1 başlık tablosu (logo, Doküman No, Yayın Tarihi, Rev No, Sayfa x/y), gövde, imza bloğu, altbilgi QR, TASLAK filigranı, Noto Sans; anlık görüntü testleri | 7–8 | T04 |
| WP12-T06 | Saf iş akışı: `workflow.ts` (durum makinesi, adım çözümü, koşullar); içerik hash'i (JCS + SHA-256) ve imza zinciri; test vektörleri | 8–9 | T04 |
| WP12-T07 | Taslak yazımı (Security Rules ile, yalnızca sahip, yalnızca `draft`/`returned`, yalnızca `draftData`); `submitPetition`: sunucu doğrulaması, evrak numarası (transaction), revizyon, hash, `verificationCode`, ilk adımın açılması, denetim kaydı | 9 | T06, WP11-T06 |
| WP12-T08 | `signPetitionStep` (ADR-0012'deki 7 koşul, iyimser kilit), `withdrawPetition`, `resubmitPetition` | 9–10 | T07 |
| WP12-T09 | İmzacı çözümleyici; `roleAssignments` değişince süreçteki dilekçelerin aktif adımlarını yeniden çözme; "Takılı Dilekçeler" | 10 | T08, WP11-T08 |
| WP12-T10 | PDF üretim tetikleyicisi → Storage; `getPetitionPdfUrl` (15 dk imzalı URL); `petitionVerifications` yazımı; herkese açık `verifyPetition` | 10 | T05, T08 |
| WP12-T11 | Firestore ve Storage kuralları: okuma (sahip, `activeEligibleUids`, `signerUids`, U/B kapsam); `revisions` ve `signatures` değiştirilemez; kural testleri | 10 | T07 |
| **Arayüz** | | | |
| WP12-T12 | Şablon kataloğu; şablondan dinamik form üretimi (react-hook-form + ortak zod); canlı önizleme (TASLAK PDF) | 11 | T04, T05 |
| WP12-T13 | Dilekçelerim; İmza bekleyenler (rol seçimi, beyan, yeniden giriş); dilekçe detayı (zaman çizelgesi, imza geçmişi, revizyon farkı); yönetim listesi; takılı dilekçeler; şablon etkinleştirme | 11–12 | T08–T11 |
| WP12-T14 | Doğrulama sayfası: kod ile sorgu, PDF sürükle-bırak ve tarayıcıda SHA-256 karşılaştırması | 12 | T10 |
| WP12-T15 | Bildirimler: uygulama içi + e-posta (Firestore tetiklemeli e-posta eklentisi, SMTP kimlik bilgileri Secret Manager'da); 3 günlük hatırlatma; günlük özet. E-postada içerik yok. | 12 | T08 |
| WP12-T16 | İlk 3 kurumsal şablonun JSON'a dönüştürülmesi; Evrak Sorumlusu ve GS onayı; PDF çıktısının basılı formla karşılaştırılması | 11–12 | T03, T04 |
| WP12-T17 | Arşiv: onaylanan PDF'in Drive'a kopyalanma kontrol listesi; saklama süresi dolan dilekçelerin anonimleştirilmesi (zamanlanmış iş); evrak defteri görünümü | 12–13 | T10 |
| WP12-T18 | KVKK: modül aydınlatma metni; alan sınıflandırması kontrolü; Danışman görüşü | 12 | AS-09 |
| WP12-T19 | Güvenlik testi (aşağıdaki senaryolar) ve rapor | 14 | Tümü |
| WP12-T20 | Pilot: gerçek dilekçeler | 15 | T19 |

## Güvenlik test senaryoları (WP12-T19)

| # | Senaryo | Beklenen |
|---|---|---|
| P1 | Dilekçe sahibi kendi dilekçesinin bir adımını imzalar | Reddedilir. Adımda başka uygun imzacı yoksa `fallback` rolüne yükselir. |
| P2 | Adımın rolünü taşımayan kullanıcı imzalar | Reddedilir |
| P3 | `unit.chair @ ras`, CS biriminin dilekçesini birim adımında imzalar | Reddedilir (kapsam uyuşmazlığı) |
| P4 | İmzacı, iade sonrası eski revizyonun `expectedContentHash` değeriyle imzalar | Reddedilir |
| P5 | İki uygun imzacı aynı adımı aynı anda onaylar | Yalnızca biri kaydedilir |
| P6 | Son girişi 5 dakikadan eski bir oturumla imza | Reddedilir, yeniden giriş istenir |
| P7 | İstemci `signatures` veya `revisions` dokümanı oluşturur, günceller ya da siler | Kurallarca reddedilir |
| P8 | Sahip, `in_review` durumundaki dilekçenin `draftData` veya `status` alanını değiştirir | Kurallarca reddedilir |
| P9 | Başka birimin gönüllüsü dilekçeyi okur | Reddedilir |
| P10 | İmzaladıktan sonra rolünü kaybeden kişi | Geçmiş imzası geçerli kalır; yeni imza atamaz |
| P11 | Koşullu adım (`mekanTuru`): kampüs içi / kampüs dışı | Danışman adımı sırasıyla `skipped` / `active` |
| P12 | Doğrulama sorgusu | Dilekçe içeriği ve maskelenmemiş sahip adı döndürülmez |
| P13 | Bir imza kaydı konsoldan değiştirilir | Gece bütünlük kontrolü zincir hatası uyarısı üretir |
| P14 | Storage'daki PDF'e doğrudan erişim | Reddedilir. Yalnızca imzalı URL ile erişilir. |
| P15 | Reddedilen dilekçeden sonra yeni gönderim; 31 Aralık/1 Ocak sınırı | Numara tekrar kullanılmaz, yıl doğru değişir, boşluk oluşmaz |
| P16 | Pasif (etkinleştirilmemiş) şablon sürümüyle dilekçe oluşturma | Reddedilir |

## Kabul kriterleri

- [ ] K1: En az 3 kurumsal dilekçe şablonu Hub'da aktif. PDF çıktıları Evrak Sorumlusu tarafından basılı formla karşılaştırılıp onaylanmış.
- [ ] K2: Pilotta en az 5 gerçek dilekçe (en az 2 farklı şablon, en az 1 iade döngüsü) uçtan uca işlenmiş.
- [ ] K3: P1–P16 senaryolarının tamamı beklenen sonucu veriyor.
- [ ] K4: Onaylanan her dilekçenin PDF'i var. QR doğrulaması çalışıyor ve PDF hash'i eşleşiyor.
- [ ] K5: Her yıl ve seri için evrak numaraları boşluksuz (sayaç ile dilekçe listesi karşılaştırılır).
- [ ] K6: Her dilekçenin tüm durum geçişleri ve imzaları denetim kaydında, imza zinciri doğrulaması başarılı.
- [ ] K7: Dilekçe doldurma ve imzalama telefonda tamamlanabiliyor (3 kişiyle kullanılabilirlik testi).
- [ ] K8: Adım bazında ortalama onay süresi raporda görülüyor (WP09-T09).
- [ ] K9: "Elektronik olarak onaylanmıştır" ifadesi ve harici imza gerektiren şablonlar Danışman görüşüyle kesinleşmiş (ADR-0012).

## Riskler

| Risk | Olasılık | Etki | Önlem |
|---|---|---|---|
| Mevcut formatların ve onay zincirlerinin belirsiz olması | Orta | Yüksek | T01–T02 erken başlar; belirsiz zincirler YK kararına bağlanır |
| İmzacıların sistemi kullanmayıp WhatsApp'tan "tamam" demesi | Yüksek | Yüksek | YK kararı: Hub dışı onay geçersizdir (pilot sonrası); e-posta hatırlatmaları; mobil uyumlu imza ekranı |
| Hukuki geçerlilik beklentisinin yanlış anlaşılması | Orta | Orta | ADR-0012; arayüzde ve PDF'te açık ifade; `externalSignatureRequired` |
| Kişisel veri içeren serbest metin alanları | Orta | Orta | Alan bazlı `purpose`; uzunluk sınırları; saklama süresi ve anonimleştirme |
| Blaze onayının gecikmesi (Functions, Storage) | Orta | Yüksek | Emulator'de geliştirme sürer; staging ve pilot onaya bağlıdır (AS-06) |

## Açık sorular

- AS-04, AS-05, AS-06, AS-07, AS-08, AS-09, AS-12, AS-13, AS-14
