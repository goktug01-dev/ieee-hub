# WP-01 — Dijital Yönetişim ve Sistem Envanteri

| | |
|---|---|
| **Durum** | Planlandı |
| **Paket sorumlusu** | TechOps Başkanı |
| **Süreç sahibi** | TechOps Başkanlığı |
| **Takvim** | Hafta 1–4 |
| **Bağımlılıklar** | — |
| **İlgili ADR'ler** | ADR-0001, ADR-0003 |
| **Kaynak** | Bildirge §9.1, §12.1, §15 |

## Amaç

Kullanılan sistemleri, hesapları, verileri, süreçleri ve sahiplikleri kayıt altına almak. Bu paket bitince "hangi sistem var, kim yönetiyor, kaybedersek nasıl kurtarırız?" sorularının cevabı yazılı olur. WP-11'in yetki matrisi ve WP-12'nin dilekçe envanteri bu paketin çıktılarına dayanır.

## Kapsam

**Dahil:** WordPress, Firebase (Auth, RTDB), HeptaCert, Google Drive/Sheets/Forms/Groups, Apps Script, Looker Studio, GitHub, Discord, WhatsApp grupları, vTools, alan adları, ortak e-posta hesapları.

**Hariç:** Kişisel cihazlar, kişisel sosyal medya hesapları.

## Çıktılar

| # | Çıktı | Biçim / konum |
|---|---|---|
| Ç1 | Sistem envanteri | Sheets: `09_TechOps_ve_Sistemler/Sistem_Envanteri` |
| Ç2 | Hesap ve erişim envanteri | Sheets, **erişimi kısıtlı** (Başkan, GS, TechOps Başkanı): `09_TechOps_ve_Sistemler/Guvenlik` |
| Ç3 | Veri envanteri (Bildirge §12.1 alanlarıyla) | Sheets |
| Ç4 | RTDB üye şeması ve mevcut güvenlik kuralları | `docs/mimari/rtdb-uye-semasi.md` (AS-10) |
| Ç5 | Süreç sahibi listesi | Sheets |
| Ç6 | Yetki matrisi taslağı | WP-11'e girdi: [rbac/yetki-matrisi.md](../rbac/yetki-matrisi.md) |
| Ç7 | Risk listesi | Sheets. Bildirge §15'teki riskler + yeni riskler |
| Ç8 | Mevcut durum ve risk raporu | Docs: `08_Raporlar` |

## Görevler

| ID | Görev | Sorumlu | Hafta | Bağımlılık |
|---|---|---|---|---|
| WP01-T01 | Sistem envanteri şablonunu hazırla: sistem, amaç, sahip hesap, yöneticiler ve sayıları (hedef: en az 2), erişim biçimi, kurtarma yöntemi, maliyet, veri türleri | TechOps | 1 | — |
| WP01-T02 | Her sistem için envanteri doldur. Tek yöneticili sistemleri işaretle. | TechOps | 1–2 | T01 |
| WP01-T03 | Hesap ve erişim envanteri: kim, hangi sistemde, hangi yetkiyle. Eski yönetimden kalan erişimleri işaretle. | TechOps + GS | 1–2 | T01 |
| WP01-T04 | Veri envanteri: her kişisel veri alanı için amaç, kaynak, sistem, erişen roller, saklama süresi, silme yöntemi, üçüncü taraflar | TechOps + Mevzuat ve Arşiv | 2–3 | T02 |
| WP01-T05 | RTDB şemasını ve güvenlik kurallarını dışa aktar ve belgele. Bölgesini tespit et. | TechOps | 2 | — |
| WP01-T06 | Süreç sahibi listesi (etkinlik, üyelik, dilekçe, sponsorluk, finans, iletişim, raporlama) | GS | 3 | — |
| WP01-T07 | Süreç akışları: etkinlik, gönüllü katılımı, dilekçe, sponsor görüşmesi (Bildirge §5.1) | Süreç sahipleri + TechOps | 3–4 | T06 |
| WP01-T08 | Risk listesi ve mevcut durum raporu | TechOps Başkanı | 2, 4 | T02–T05 |
| WP01-T09 | Tek yöneticili kritik sistemlere ikinci yönetici ekle | TechOps + YK | 3–4 | T02 |

## Kabul kriterleri

- [ ] K1: Envanterdeki her kritik sistem için amaç, sahip, yönetici, erişim biçimi ve kurtarma yöntemi alanları dolu (Bildirge §9.1).
- [ ] K2: Her kritik sistemde en az iki yönetici var; yoksa sorumlusu ve tarihi belli bir aksiyon açılmış.
- [ ] K3: Veri envanterindeki her kişisel veri alanının amaç ve saklama süresi dolu.
- [ ] K4: RTDB şeması `docs/mimari/rtdb-uye-semasi.md` dosyasında belgelenmiş.
- [ ] K5: Mevcut durum ve risk raporu YK'ya sunulmuş.

## Riskler

| Risk | Olasılık | Etki | Önlem |
|---|---|---|---|
| Eski yönetimin hesap bilgilerine ulaşılamaması | Orta | Yüksek | Kurtarma e-postası/telefonu üzerinden erişim; IEEE Global Webmaster ile iletişim |
| Erişim envanterinin kendisinin sızması | Düşük | Yüksek | Ç2 kısıtlı klasörde tutulur, şifre içermez (Bildirge §12.5) |

## Açık sorular

- AS-10
