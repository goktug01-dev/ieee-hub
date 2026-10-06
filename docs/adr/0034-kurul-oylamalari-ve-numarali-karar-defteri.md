# ADR-0034: Kurul oylamaları sabit üye listesiyle yürür ve kararlar numaralı deftere işlenir

- **Durum:** Kabul Edildi
- **Tarih:** 2026-09-29
- **Karar vericiler:** IEEE İKÇÜ TechOps; onay: Yönetim Kurulu
- **Onay kaydı:** Kullanıcının kurul toplantıları, oylama ve karar defteri talebi, 2026-09-29
- **İlgili:** WP-09, WP-10, WP-11, ADR-0022, ADR-0024, ADR-0028

## Bağlam

Yönetim Kurulu (YK) ve İdari Kurul (İK) oylamalarının tüzükteki tam sayı, toplantı nisabı, salt/üçte iki/oybirliği kurallarıyla hesaplanması; çekilen üyenin oy kullanmaması; ortak üyelerin iki kez sayılmaması ve kesinleşen kararların boşluksuz numarayla kalıcı deftere yazılması gerekir. Kurul toplantıları mevcut `meetings` yapısından kopuk ayrı bir sistem olmamalıdır.

## Karar

Kurul üyeliği arayüzden düzenlenen koltuk ayarları ve dönemli görev atamalarından hesaplanır. Oylama açılırken üye listesi dondurulur; daha sonraki görev değişikliği o oylamanın oy hakkını değiştirmez. Oy veren kişi dondurulmuş listede olmalı ve ilgili rolü oy anında hâlâ taşımalıdır. Oylar açık oydur, kurul üyeleri pusulaları görür ve kapanana kadar kendi oyunu değiştirebilir.

Sayım saf ve test edilebilir istemci modülünde yapılır; Firestore kuralları pusulaların sahipliğini, rol geçerliliğini, kapanış sonrası değişmezliği ve oylama içeriğinin değişmemesini uygular. YK/İK ayrı veya ortak sonuç üretir. YKK yalnız YK kapsamında üçte iki kuralıyla açılır.

Karar defteri `boardDecisions` koleksiyonunda yalnız eklenebilir kayıttır. `decisionCounters/{kurul_yıl}` sayacı karar kaydıyla aynı işlemde tam bir artar. Oylama ve toplantı kararları kaynak kimliğinden türetilen belge kimliği sayesinde ikinci kez işlenemez. Kurul toplantıları `meetings` koleksiyonunda `boardId`, dondurulmuş `boardRoster` ve `visibleUids` etiketi taşır; mevcut tutanak ekranı ve değişmez kesinleştirme kuralı kullanılır.

## Değerlendirilen seçenekler

| Seçenek | Artılar | Eksiler |
|---|---|---|
| Mevcut toplantı yapısı + kurul etiketi (seçilen) | Tek tutanak modeli; mükerrer modül yok; karar kaynağı izlenir | Kurul görünürlüğü için ek alanlar gerekir |
| Kurullar için ayrı toplantı koleksiyonu | İzole model | Aynı gündem/tutanak işlevi iki kez geliştirilir |
| Yalnız serbest metin sonuç kaydı | Basit | Nisap, oy hakkı ve pusula denetimi kanıtlanamaz |

## Sonuçlar

**Olumlu:** Tüzük kuralları tekrar üretilebilir şekilde hesaplanır; karar numarası çakışmaz veya atlanmaz; kesin kayıt değiştirilemez.

**Olumsuz / maliyet:** Çevrim içi oylama açık oydur; gerçek anonim gizli oy sağlamaz. Gizli oy gereken süreç fiziksel yürütülüp sonucu elle karar defterine yazılır.

**Riskler ve önlemler:** İstemciye güvenilmez; kritik yazmalar Firestore Rules ve emülatör saldırı testleriyle korunur. Dondurulmuş listede rolü sonradan biten kişi oy kullanamaz.

## Uygulama notları

Sayım `lib/boards.ts`, işlemler `lib/boardOps.ts`, erişim `lib/useBoards.ts`, arayüz `pages/boards`, kurallar `firebase/firestore.rules` içindedir.
