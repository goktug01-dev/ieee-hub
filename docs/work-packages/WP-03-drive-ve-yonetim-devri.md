# WP-03 — Drive ve Yönetim Devri

| | |
|---|---|
| **Durum** | Planlandı |
| **Paket sorumlusu** | Mevzuat ve Arşiv Yönetimi Departmanı |
| **Süreç sahibi** | Genel Sekreterlik |
| **Takvim** | Hafta 5–6 |
| **Bağımlılıklar** | WP-01 (hesap ve erişim envanteri) |
| **İlgili ADR'ler** | ADR-0015 (dilekçe arşiv klasörü) |
| **Kaynak** | Bildirge §3.1, §4.5, §6.7, §6.8, §9.3, Ek A, Ek B |

## Amaç

Kurumsal belgeleri merkezi, düzenli ve devredilebilir biçimde yönetmek. Erişimleri tek tek kişiler yerine Google Groups üzerinden vermek.

## Çıktılar

| # | Çıktı | Biçim / konum |
|---|---|---|
| Ç1 | Ek A klasör yapısı + `00_Yonetim_ve_Yonerge/Dilekceler/{dönem}` | Google Drive |
| Ç2 | Komite/birim bazlı Google Groups | Her `units` kaydı için bir grup |
| Ç3 | Bireysel paylaşımların gruplara taşınma raporu | Sheets |
| Ç4 | Dosya isimlendirme standardı duyurusu (Ek B) | Docs + Discord duyurusu |
| Ç5 | Kritik dosya yedekleme yöntemi | `09_TechOps_ve_Sistemler/Yedekleme` |
| Ç6 | Birim ↔ Google Group eşlemesi | `units/{id}.googleGroupEmail` (WP-11) |

## Görevler

| ID | Görev | Hafta | Bağımlılık |
|---|---|---|---|
| WP03-T01 | Drive sahipliğini netleştir: Paylaşılan Drive (Workspace varsa) veya kurumsal ortak hesap. En az 2 yönetici. | 5 | WP-01 |
| WP03-T02 | Ek A klasör yapısını ve `Dilekceler` klasörünü oluştur | 5 | T01 |
| WP03-T03 | Google Groups oluştur: `yk@`, `techops@`, her komite ve başkanlık için bir grup. Her grupta en az 2 yönetici. | 5 | AS-02 |
| WP03-T04 | Klasörleri gruplara paylaş. Bireysel paylaşımları tespit edip kaldır (istisna listesi ile). | 5–6 | T02, T03 |
| WP03-T05 | Mevcut dağınık dosyaları yeni yapıya taşı; eski konumlara "taşındı" notu bırak | 6 | T02 |
| WP03-T06 | `07_Sablonlar`: rapor, toplantı tutanağı, devir paketi şablonları | 6 | T02 |
| WP03-T07 | Kritik dosyalar için aylık dışa aktarım/yedek yöntemi | 6 | T01 |
| WP03-T08 | Hub'da `units.googleGroupEmail` alanının doldurulması. Rol değişikliklerinde oluşturulacak erişim görevleri için eşleme ([atama kuralları §7](../rbac/atama-kurallari.md)). | 6 | WP-11 |

## Kabul kriterleri

- [ ] K1: Aktif döneme ait kritik belgelerin en az %90'ı merkezi klasör yapısında (Bildirge §9.3). Örneklem kontrolüyle ölçülür.
- [ ] K2: Tüm komite klasörleri grup üzerinden paylaşılmış. Bireysel paylaşımlar yalnızca istisna listesinde.
- [ ] K3: Her Google Group'ta en az 2 yönetici var.
- [ ] K4: Drive sahipliği kişisel bir hesaba bağlı değil.

## Riskler

| Risk | Olasılık | Etki | Önlem |
|---|---|---|---|
| Workspace yokluğunda Paylaşılan Drive kullanılamaması | Yüksek | Orta | Kurumsal ortak hesabın sahipliği; iki yönetici; kurtarma bilgileri devir kontrolünde |
| Dosya taşımada bağlantıların kırılması | Orta | Düşük | Google Drive "taşı" işlemi dosya kimliğini korur; kopyalama yapılmaz |

## Açık sorular

- AS-02
