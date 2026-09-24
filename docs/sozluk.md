# Sözlük

İlk bölüm Bildirge Ek D'den alınmıştır. İkinci bölüm bu dokümantasyonla eklenen kavramları içerir.

## Bildirge Ek D

| Kavram | Tanım |
|---|---|
| Ana kayıt sistemi | Bir veri türünün en güncel ve güvenilir kabul edilen asıl kaynağı. |
| IEEE İKÇÜ Hub | Komite, görev, proje, etkinlik, iletişim, sponsorluk ve raporlama süreçlerini ortaklaştıran iç operasyon portalı. |
| Raporlama veri katmanı | Operasyon sistemlerindeki ham verilerin raporlamaya uygun hâle getirilmiş kopyalarının tutulduğu alan. |
| Veri sözleşmesi | Sistemler arasında hangi alanların, hangi formatta ve hangi kurallarla aktarılacağını belirleyen tanım. |
| Eşitleme kaydı | Bir veri aktarımının ne zaman, kim tarafından, kaç kayıtla ve hangi sonuçla gerçekleştirildiğini gösteren kayıt. |
| En az yetki | Kullanıcıya yalnızca görevini yapabilmesi için gereken erişimin verilmesi ilkesi. |
| Yönetim devri | Görev, bilgi, belge, sistem ve erişimlerin bir yönetim döneminden diğerine kontrollü biçimde aktarılması. |
| Veri minimizasyonu | Yalnızca belirlenen amaç için gerekli kişisel verilerin toplanması ve saklanması. |

## Eklenen kavramlar

### RBAC

| Kavram | Kod karşılığı | Tanım |
|---|---|---|
| Birim | `unit` | Organizasyonun bir parçası: Yönetim Kurulu, komite, başkanlık/daire, departman, proje ekibi. Birimler ağaç yapısındadır. |
| Rol | `role` | Bir kişiye verilen ve izin kümesi taşıyan görev tanımı (örn. `unit.chair`). |
| İzin | `permission` | Belirli bir kaynak üzerinde belirli bir işlemi yapma hakkı (örn. `task.create`). |
| Kapsam | `scope` | Rolün geçerli olduğu alan: `branch` (tüm Öğrenci Kolu) veya belirli bir birim ve alt birimleri. |
| Rol ataması | `roleAssignment` | Bir kişiye, belirli bir kapsamda, belirli bir dönem için rol verilmesi kaydı. |
| Dönem | `term` | Akademik yönetim dönemi (örn. `2026-2027`). Rol atamaları döneme bağlıdır. |
| Erişim özeti | `access/{uid}` | Kişinin aktif rollerinden sunucu tarafından türetilen, güvenlik kurallarının okuduğu izin özeti. |
| Dört göz ilkesi | — | Kritik bir işlemin, talep edenden farklı ikinci bir yetkili tarafından onaylanması. |
| Acil erişim | `breakGlassGrant` | Olağan dışı durumda, gerekçeli, süreli ve kayıtlı olarak verilen geçici yetki. |
| Denetim kaydı | `auditLog` | Kritik bir işlemin kim tarafından, ne zaman, hangi gerekçeyle yapıldığını gösteren, değiştirilemez kayıt. |

### E-Dilekçe

| Kavram | Kod karşılığı | Tanım |
|---|---|---|
| Dilekçe | `petition` | Bir üyenin Hub üzerinden doldurduğu ve onay zincirinden geçen resmî talep belgesi. |
| Dilekçe şablonu (form) | `petitionTemplate` | Bir dilekçe türünün alanlarını, metnini, onay zincirini ve PDF düzenini tanımlayan sürümlü tanım. |
| Form kodu | `formCode` | Şablonun kurumsal doküman numarası. PDF başlığındaki "Doküman No" alanına basılır. |
| Evrak sayısı | `documentNo` | Dilekçeye gönderim anında atanan, benzersiz ve sıralı kayıt numarası. |
| Revizyon | `revision` | Dilekçe içeriğinin bir sürümü. İade edilip düzeltilen dilekçe yeni revizyon alır. |
| Onay adımı | `approvalStep` | Onay zincirinde, belirli rollerden birinin karar vermesi gereken aşama. |
| İmza kaydı | `signature` | Bir onay adımında verilen kararın (onay/ret/iade) imzalayan kişi, rol, zaman ve içerik özetine bağlı kaydı. |
| İkame rol | `substitutes` | Asıl rol sahibinin yerine imza atabilecek rol (örn. başkan yerine başkan yardımcısı). "Adına" olarak kaydedilir. |
| İçerik özeti | `contentHash` | Dilekçe içeriğinin SHA-256 özeti. İmzalar bu özete bağlanır; içerik değişirse imza geçersiz olur. |
| Doğrulama kodu | `verificationCode` | PDF üzerindeki QR/kodla, belgenin Hub kaydıyla eşleştiğinin kontrol edilmesini sağlayan tahmin edilemez kod. |
| Sistem içi elektronik onay | — | Hub'da kimliği doğrulanmış kullanıcının rolüyle verdiği, denetim kaydı tutulan onay. 5070 sayılı Kanun kapsamında "güvenli elektronik imza" **değildir** ([ADR-0012](adr/0012-rol-bazli-elektronik-onay.md)). |
