# WP-10 — Eğitim, Geçiş ve Yönetim Devri

| | |
|---|---|
| **Durum** | Planlandı |
| **Paket sorumlusu** | TechOps Başkanı |
| **Süreç sahibi** | Yönetim Kurulu |
| **Takvim** | Hafta 15–16 (pilot hazırlığı hafta 13'ten itibaren) |
| **Bağımlılıklar** | Tüm WP'ler |
| **İlgili ADR'ler** | ADR-0007, ADR-0008 |
| **Kaynak** | Bildirge §9.10, §14.6, §16, §17, §18 |

## Amaç

Sistemin yalnızca TechOps'un bildiği bir yapı olmaktan çıkarılması. Kullanıcıların sistemi benimsemesi ve dönem sonunda kontrollü devir.

## Görevler

| ID | Görev | Hafta |
|---|---|---|
| WP10-T01 | Pilot grubu seçimi: 1 komite, GS, 1 etkinlik ekibi (Bildirge §16) | 13 |
| WP10-T02 | Rol bazlı kısa kılavuzlar (1–2 sayfa): Gönüllü, Koordinasyon Üyesi, Birim Başkanı, GS/Evrak, Sayman/Sponsorluk, Sistem Yöneticisi | 13–14 |
| WP10-T03 | Destek kanalı: Discord `#hub-destek` + Hub içi "Sorun bildir" formu | 13 |
| WP10-T04 | Pilot: gerçek etkinlik, gerçek görevler, gerçek dilekçeler; geri bildirim formu | 15 |
| WP10-T05 | Pilot sonuç ve hata raporu | 15 |
| WP10-T06 | Eğitim oturumları: komite başkanlarına ayrı oturum (Bildirge §16), YK'ya ayrı oturum | 15–16 |
| WP10-T07 | Eski yöntemlerin kapanış tarihinin duyurulması (WhatsApp görevleri, Word dilekçeleri) | 15 |
| WP10-T08 | Devir paketleri (Bildirge §18 listesi): her YK ve birim başkanlığı rolü için | 16 |
| WP10-T09 | Teknik devir paketi: mimari, ADR'ler, çalışma kılavuzları (runbook), erişim envanteri, faturalandırma hesabı | 16 |
| WP10-T10 | Dönem sonu erişim gözden geçirmesi: Firebase, GitHub, Google Groups, Drive, WordPress, HeptaCert, Apps Script, Looker sahipleri (Bildirge §18) | 16 |
| WP10-T11 | RBAC devir raporunun incelenmesi (WP11-T19): sahipsiz kalacak roller, onaycı sayısı | 16 |
| WP10-T12 | Dönem sonu kabul raporu (Bildirge §17'deki 17 madde + WP-11/WP-12 kabul kriterleri) ve YK kabul kararı | 16 |

## Kabul kriterleri

- [ ] K1: Yönetim, komite başkanları ve ilgili kullanıcılar eğitim almış (katılım listesi).
- [ ] K2: Yönetim ve başkanlık rollerinin %100'ünde devir paketi var (Bildirge §14.6).
- [ ] K3: Teknik devir paketini kullanarak TechOps dışından bir kişi, staging'e bir dağıtım yapabilmiş (tatbikat).
- [ ] K4: Erişim envanteri güncel. Eski yöneticilerin erişimleri kapatılmış.
- [ ] K5: YK dönem sonu kabul kararı alınmış. Eksik maddeler sorumlu ve tarihle kabul raporuna yazılmış.
