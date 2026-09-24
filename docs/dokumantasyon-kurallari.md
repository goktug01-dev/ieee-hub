# Dokümantasyon Kuralları

## 1. Genel ilkeler

- Dokümanlar **Türkçe** yazılır. Kod tanımlayıcıları (koleksiyon adları, rol kimlikleri, izin kimlikleri, alan adları) **İngilizce** ve `snake_case`/`camelCase` olur. Dokümanlarda bu kimlikler `kod` biçiminde gösterilir.
- Dosya adları ASCII karakterlerle, küçük harf ve tire ile yazılır (`yetki-matrisi.md`). Bildirge Ek B'deki isimlendirme standardı Drive belgeleri içindir; depodaki Markdown dosyalarına uygulanmaz.
- Her değişiklik Pull Request ile yapılır. Doğrudan `main` dalına yazılmaz.
- Bir bilgi tek yerde tutulur. Başka dokümanlar o yere bağlantı verir, bilgiyi kopyalamaz.

## 2. Tek doğruluk kaynağı kuralı

| Bilgi | Uygulama öncesi kaynak | Uygulama sonrası kaynak |
|---|---|---|
| İzin kataloğu (izinlerin anlamı) | `docs/rbac/*.md` | `apps/hub/src/lib/permissions.ts` + `firebase/firestore.rules` |
| Roller, birimler, dönemler, görevliler | `docs/rbac/*.md` | Hub arayüzü (Firestore `roles`, `units`, `terms`, `assignments`) — [ADR-0019](adr/0019-organizasyon-roller-ve-secimler-arayuzden-duzenlenir.md) |
| Dilekçe şablonları | `docs/moduller/e-dilekce/sablon-formati.md` | Hub arayüzü (Firestore `petitionTemplates`, Word dosyaları) — [ADR-0020](adr/0020-dilekce-sablonlari-word-tabanli.md) |
| Firestore veri modeli | `docs/mimari/firestore-veri-modeli.md` | `apps/hub/src/lib/types.ts` + [uygulanan mimari](mimari/uygulanan-mimari.md) |

Kod ile doküman çelişirse, uygulama başladıktan sonra **kod esas alınır** ve doküman aynı PR içinde düzeltilir.

## 3. ADR (Mimari Karar Kaydı)

- Konum: `docs/adr/NNNN-kisa-baslik.md`. Numara sırayla artar ve tekrar kullanılmaz.
- Şablon: [adr/_sablon.md](adr/_sablon.md)
- Durumlar:

| Durum | Anlamı |
|---|---|
| Önerildi | Taslak. Tartışmaya açık. |
| Kabul Edildi | Onaylandı; uygulanır. |
| Reddedildi | Değerlendirildi, uygulanmayacak. Kayıt silinmez. |
| Yerini Aldı (ADR-XXXX) | Yeni bir ADR ile değiştirildi. Kayıt silinmez. |
| Kullanımdan Kalktı | Artık geçerli değil; yerine yeni karar gelmedi. |

- **Onay yetkisi:**
  - Yalnızca teknik kararlar (kütüphane, test, CI vb.): TechOps Başkanı ve en az bir TechOps geliştiricisi (PR onayı).
  - Kişisel veri, yetki, imza, maliyet veya organizasyonu etkileyen kararlar: TechOps önerir, **Yönetim Kurulu** kabul eder (Bildirge §8.1). Karar YK toplantı kararına bağlantı verilerek işlenir.
- Kabul edilmiş bir ADR düzenlenmez. Değişiklik gerekiyorsa yeni ADR yazılır ve eskisi "Yerini Aldı" olarak işaretlenir. Yazım hatası düzeltmeleri bu kuralın dışındadır.
- Ana kayıt sistemini değiştiren her karar ADR ile belgelenir (Bildirge §7).

## 4. Work Package (Çalışma Paketi)

- Konum: `docs/work-packages/WP-NN-kisa-baslik.md`
- Şablon: [work-packages/_sablon.md](work-packages/_sablon.md)
- WP-01 … WP-10, Bildirge §9'daki paketlerdir. Numaraları korunur. WP-11 ve sonrası bu dokümantasyonla eklenmiştir.
- Görevler `WPNN-TNN` biçiminde kimliklendirilir (örn. `WP11-T05`). Hub'daki görev modülü devreye girince bu görevler Hub'a taşınır ve WP dokümanı görevlerin Hub bağlantısını gösterir.
- Durumlar: `Planlandı` → `Devam Ediyor` → `Kabul Bekliyor` → `Tamamlandı` (veya `Ertelendi`).
- Kabul kriterleri **test edilebilir** yazılır. "İyi çalışır" gibi ifadeler kabul kriteri sayılmaz.

## 5. Açık sorular

- Bir konu için karar gerekiyorsa ve karar TechOps'un yetkisinde değilse [acik-sorular.md](acik-sorular.md) dosyasına `AS-NN` kimliğiyle eklenir.
- Soru cevaplandığında cevap, tarih ve karar veren yazılır. İlgili ADR/WP güncellenir.
