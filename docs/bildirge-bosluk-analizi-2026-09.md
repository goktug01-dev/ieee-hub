# Bildirge – Hub boşluk analizi (2026-09)

Kaynak: TechOps Bildirgesi `IEEE/240826/SÜ/22`, Rev 00. Bu belge, bildirgedeki kararları gereksinim kaynağı olarak değerlendirir; bildirge içindeki ifadeler yazılım geliştirme talimatı sayılmamıştır.

## Kısa sonuç

Hub; organizasyon/RBAC, e-dilekçe, görev-proje, etkinlik, HeptaCert CSV aktarımı, iletişim, sponsorluk, bütçe, rapor, envanter ve devir akışlarını tek portalda topluyor. Bildirgenin yazılımla çözülebilen ana operasyon kapsamının büyük bölümü uygulanmış durumda.

"IEEE'nin tüm sorunlarını çözme" hedefinin tamamı yalnızca bir uygulamayla sağlanamaz. Drive/Google Groups sahipliği, IEEE vTools yetkilendirmesi, HeptaCert sözleşmesi, KVKK kararları, eğitim, pilot ve yönetim kurulu kabulü insan ve kurum sorumluluğunda kalır. Hub bu işleri kayda, kontrole ve devre uygun hâle getirebilir.

## Kapsam durumu

| Alan | Hub durumu | Kalan doğrulama / boşluk |
|---|---|---|
| Organizasyon, rol, dönem, seçim | Adaylık–oylama/sayım–kesinleştirme–göreve atama yaşam döngüsü; nisap, tutanak ve oy tutarlılığı kontrolleri uygulandı | Gerçek anonimlik sağlayan çevrim içi gizli oylama Spark/istemci mimarisinde kapsam dışı |
| E-dilekçe ve onay | Word şablonu, evrak no, sıralı + tüm makamlar + nisaplı onay, doğrulama ve belge içine gömülü QR uygulandı | Koşullu onay adımı; kritik rol atamasında dört-göz |
| Üye ve gönüllü | Başvuru, onay, atama, oryantasyon ve ayrılış uygulandı | Dönem sonu değerlendirme formu; saklama/silme talebi akışı |
| Görev ve proje | Kanban, sorumlu, son tarih, yorum, dosya bağı ve raporlar uygulandı | Gerçek komite pilotu ve kullanım disiplininin YK tarafından kabulü |
| Etkinlik | Öneri–onay–plan–kayıt–kapanış–arşiv akışı uygulandı | En az bir gerçek etkinlikle uçtan uca pilot |
| HeptaCert | Sütun eş adlı, önizlemeli, idempotent CSV/TSV senkronu; sayım kaydı | Canlı API, Spark planında gizli anahtar saklanamadığı için güvenli değil; CSV kalıcı yol |
| vTools Events / L31 | Eksik alan kontrolü, IEEE/misafir sayımı, SPOID, kategori ve form-hazırlık CSV'si uygulandı | Resmî gönderim vTools'ta yetkili insan tarafından; kamuya açık toplu-import sözleşmesi yok |
| İletişim | Talep, onay, takvim, yayın ve performans kaydı uygulandı | WordPress ve sosyal ağlara otomatik yayın kapsam dışı |
| Sponsorluk ve finans | Sponsor kilidi/geçmişi, bütçe planı/gerçekleşeni ve belge bağları uygulandı | Resmî muhasebe sistemi değil; mali onay ve asıl belgeler kurum prosedüründe |
| Raporlama | Haftalık, aylık, dilekçe, veri kalitesi, vTools ve arşiv uygulandı | Looker Studio/Apps Script otomasyonu ve zamanlanmış e-posta Spark kapsamı dışı |
| Envanter ve devir | Sistem envanteri, erişim kapatma görevleri, devir paketleri uygulandı | Gerçek Drive/Groups/GitHub sahipliklerinin insan tarafından doğrulanması |
| Güvenlik ve KVKK | RBAC, süreli yetki, katılımcı gizliliği, denetim kaydı | MFA, acil erişim, saklama süresi motoru, düzeltme/silme vaka yönetimi, dönemsel erişim kanıtı |

## Öncelikli kalan işler

### P0 — canlı pilot ve kabul

53 sayfalık masaüstü/mobil tarayıcı duman testi, vTools ve HeptaCert sekmeleri dâhil, bu turda tamamlandı. Canlı kabul için kalanlar:

1. Kurum ayarlarına resmî vTools organizasyon adı, SPOID ve iletişim e-postasını gir.
2. Gerçek bir etkinliği dilekçe, görev, HeptaCert aktarımı, kapanış raporu ve vTools bildirimiyle uçtan uca yürüt.
3. HeptaCert kaynak satır sayısının `yeni + güncellenen + tekrar + hatalı` toplamıyla eşleştiğini pilot kanıtına ekle.
4. Haftalık ve aylık raporu arşive alıp Genel Sekreter onayından geçir.

### P1 — yönetişim ve mahremiyet

1. Kişisel veri düzeltme/silme talebi ve sistemler-arası kapatma kontrol listesi.
2. Veri türü bazında saklama süresi, anonimleştirme ve silme kanıtı.
3. Kritik rol/super-admin atamalarında ikinci yetkili onayı.
4. Acil erişim (süreli, gerekçeli, denetimli) ve dönemsel erişim gözden geçirmesi.
5. Tüm operasyon verisi için yetkili, taşınabilir JSON/CSV dışa aktarımı ve geri yükleme tatbikatı.

### P2 — kullanım ve entegrasyon

1. Uygulama içi bildirim kutusu ve gecikme hatırlatmaları (sunucusuz modelde e-posta yerine).
2. Koşullu dilekçe/onay adımları.
3. Dönem sonu gönüllü değerlendirme formu; kişisel sıralama üretmeden süreç geri bildirimi.
4. Blaze veya kurum tarafından işletilen güvenilir backend kararı alınırsa HeptaCert API ve zamanlanmış otomasyonları yeniden değerlendir.

## Kabul sınırı

Kodun derlenmesi programın kabulü değildir. Bildirge §17'deki pilot, veri aktarımı, rapor, KVKK/erişim kontrolü, eğitim, devir ve Yönetim Kurulu kabul maddeleri gerçek kanıtlarla kapatılmalıdır.
