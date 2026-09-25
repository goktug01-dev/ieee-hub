# ADR-0022: Birim çalışma alanları ve Sekreterlik Defteri

- **Durum:** Kabul Edildi
- **Tarih:** 2026-09-25
- **Karar vericiler:** TechOps Başkanlığı
- **İlgili:** ADR-0017, ADR-0019, WP-05, WP-09, WP-10

## Bağlam

Hub'daki görev, etkinlik, dilekçe, iletişim, bütçe ve devir ekranları işlevsel olsa da bir komitenin günlük işlerini tek bağlamda göstermiyordu. Ayrıca Genel Sekreterin toplantı, karar, gelen-giden evrak ve takip kayıtları için kronolojik bir kurumsal deftere ihtiyacı vardı.

## Karar

1. Her aktif birim için `/birimler/{birimId}` adresinde bir çalışma alanı sunulur. Erişim, aktif birim üyeliği veya kol geneli görüntüleme/yönetim yetkisiyle sınırlıdır.
2. Kullanıcının seçtiği birim tarayıcıda saklanır. Görev, etkinlik, dilekçe, iletişim ve bütçe bağlantıları `birim` sorgu parametresiyle mevcut ekranları önceden filtreler; eski adresler çalĿmaya devam eder.
3. Ana sayfada “Benim alanım / Komitem” geçişi bulunur. Birim görünümü açık görevleri, aktif projeleri, etkinlikleri, iletişim taleplerini ve ekibi özetler.
4. `secretaryLedger/{id}` koleksiyonu toplantı tutanağı, YK/birim kararı, gelen-giden evrak, takip kaydı ve serbest not tutar. Drive belgesi sisteme kopyalanmaz; bağlantı olarak saklanır.
5. Defteri yalnızca `secretary.ledger.manage` izni olanlar yönetir. Bu izin varsayılan Genel Sekreter rolünde bulunur. Eski kurulumlardaki aktif `branch__genel-sekreter` rol anahtarı geriye dönük uyumluluk için aynı yetkiyi verir.
6. Oluşturma, güncelleme ve silme işlemleri denetim kaydına yazılır. Firestore kuralları oluşturan kişiyi ve zaman damgalarını doğrular.

## Sonuçlar

**Olumlu:** Komiteler ayrı bir uygulama veya kopya veri modeli olmadan kendi işlerine odaklanır. Genel Sekreter kurumsal hafızayı aranabilir ve filtrelenebilir tek defterde tutar.

**Olumsuz:** Çalışma alanı yeni bir veri kopyası değil, mevcut koleksiyonların birim kesitidir; bu nedenle bir kaydın doğru `unitId` ile açılması gerekir. Spark planı nedeniyle dosyalar Drive'da kalır.
