# Veri Sahipliği ve Ana Kayıt Sistemleri

> **Güncelleme (2026-09-24):** Hub üyeliği şimdilik RTDB'den bağımsız, kendi `members` kaydıyla tutulur ([ADR-0018](../adr/0018-firestore-bolgesi-europe-west1-ve-hub-uyeligi.md)).

Bildirge §7 tablosunun güncel hâlidir. Bildirge'deki satırlar korunmuş, Hub'daki yeni veri türleri eklenmiştir (**yeni** olarak işaretli). Ana kayıt sistemi değiştiğinde bu tablo güncellenir ve değişiklik bir ADR ile belgelenir (Bildirge §7, §5.2).

| Veri türü | Ana kayıt sistemi | Hub'daki karşılığı | Sorumlu birim |
|---|---|---|---|
| Kullanıcı kimliği ve giriş | Firebase Authentication | — | TechOps |
| Üye profili | Firebase Realtime Database | `people/{uid}` (salt okunur yansıma) | Üyelik sorumlusu / TechOps |
| Üyelik durumu | Firebase Realtime Database | `people/{uid}.membershipStatus` (yansıma) | Üyelik sorumlusu |
| Komite ve organizasyon rolleri | IEEE İKÇÜ Hub | `units`, `roleAssignments` | Yönetim / TechOps |
| **Dönemler** (yeni) | IEEE İKÇÜ Hub | `terms` | Genel Sekreter |
| **Erişim özeti** (yeni, türetilmiş) | IEEE İKÇÜ Hub | `access/{uid}`. Ana kayıt değildir; `roleAssignments` kaydından her zaman yeniden üretilebilir. | TechOps |
| Görev ve projeler | IEEE İKÇÜ Hub | `projects`, `tasks` | Komite ve proje sorumluları |
| Etkinlik ana kaydı | IEEE İKÇÜ Hub | `events` | Etkinlik sorumlusu |
| Katılımcı başvuruları | HeptaCert | `events/{id}/participants` (kurumsal kopya) | Etkinlik sorumlusu |
| Katılım/check-in | HeptaCert, ardından IEEE kurumsal kopyası | `events/{id}/participants` | Etkinlik sorumlusu / TechOps |
| Sertifika verisi | HeptaCert | — (ilk dönem kapsam dışı) | Yetkilendirilmiş etkinlik ekibi |
| Etkinlik belgeleri | Google Drive | Bağlantı | Etkinlik sorumlusu |
| İletişim talepleri ve yayın planı | IEEE İKÇÜ Hub | `contentRequests` | İletişim birimi |
| Sponsor görüşmeleri | IEEE İKÇÜ Hub veya kontrollü Sheet | `sponsors` | Sponsorluk sorumlusu |
| Finansal kayıtlar | Google Sheets ve Drive | Özet ve bağlantı | Sayman |
| Raporlama verileri | Raporlama amaçlı Google Sheets | `reports` (üretilen rapor üst verisi) | TechOps / Genel Sekreter |
| Resmî IEEE bildirim durumu | IEEE İKÇÜ Hub | `vtoolsPackages` | vTools sorumlusu |
| **Dilekçe şablonları** (yeni) | GitHub (`packages/petition-templates`) | `petitionTemplates` (yayınlanmış kopya) | Evrak ve Arşiv Sorumlusu / Genel Sekreter |
| **Dilekçeler ve revizyonlar** (yeni) | IEEE İKÇÜ Hub | `petitions`, `petitions/*/revisions` | Genel Sekreterlik |
| **İmza kayıtları** (yeni) | IEEE İKÇÜ Hub | `petitions/*/signatures` | Genel Sekreterlik |
| **Evrak numarası sayaçları** (yeni) | IEEE İKÇÜ Hub | `counters` | Evrak ve Arşiv Sorumlusu |
| **Onaylı dilekçe PDF'leri** (yeni) | Cloud Storage | `petitions/{id}.pdf` | Evrak ve Arşiv Sorumlusu |
| **Dilekçe arşiv kopyası** (yeni) | Google Drive (`00_Yonetim_ve_Yonerge/Dilekceler/{dönem}`) | `petitions/{id}.archive` | Evrak ve Arşiv Sorumlusu |
| **Denetim kayıtları** (yeni) | IEEE İKÇÜ Hub | `auditLogs` | Genel Sekreter (iş) / TechOps (teknik) |
| **Otomasyon ve eşitleme kayıtları** (yeni) | IEEE İKÇÜ Hub | `automationRuns`, `syncRuns` | TechOps |
| Kaynak kod | GitHub | — | TechOps |

## Drive yapısına eklenecek klasör

Bildirge Ek A'daki yapıya aşağıdaki klasör eklenir:

```
00_Yonetim_ve_Yonerge
└── Dilekceler
    └── 2026-2027
        └── IEEEIKCU-2026-ETK-0001_Etkinlik-Izin.pdf
```

Dosya adı, Bildirge Ek B'deki standartla uyumlu olarak evrak numarasıyla başlar.
