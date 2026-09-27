/**
 * Hub kullanma kılavuzu: Yardım sayfasındaki kılavuz ve indirilebilir Word belgesi bu tek kaynaktan üretilir.
 * Arayüzde menü, sekme veya düğme adı değiştiğinde ilgili bölüm aynı değişiklikte güncellenmelidir.
 */

export type ManualAudience = 'member' | 'manager' | 'admin';

export const MANUAL_AUDIENCES: Record<ManualAudience, { label: string; description: string }> = {
  member: { label: 'Üye ve gönüllüler', description: 'Giriş, profil, görevler, dilekçeler, gönüllülük ve günlük kullanım.' },
  manager: { label: 'Birim başkanları', description: 'Onaylar, birim yönetimi, ilanlar, etkinlik, toplantı, iletişim ve devir.' },
  admin: { label: 'YK ve yöneticiler', description: 'Üyeler, görev atamaları, dönemler, seçimler, şablonlar, ayarlar ve politikalar.' },
};

export interface ManualSection {
  id: string;
  audiences: ManualAudience[];
  title: string;
  /** Menüde nerede olduğu, örn. "Dilekçe › Yeni dilekçe". */
  where: string;
  summary: string;
  steps: string[];
  tips?: string[];
}

export const MANUAL: ManualSection[] = [
  // ---------- Üye ve gönüllüler ----------
  {
    id: 'giris',
    audiences: ['member'],
    title: 'Hub’a giriş ve üyelik onayı',
    where: 'Giriş ekranı',
    summary: 'Hub’a Google hesabınızla veya e-posta ve şifreyle girersiniz. İlk girişten sonra hesabınız yönetici onayı bekler.',
    steps: [
      'Giriş ekranında “Google ile devam et”i seçin ya da e-posta ve şifrenizle giriş yapın. Hesabınız yoksa “Hesabın yok mu? Kayıt ol” bağlantısıyla hesap oluşturun.',
      'İlk girişte “Üyelik onayı bekleniyor” ekranını görürsünüz. Bu sırada bir işlem yapmanız gerekmez.',
      'Yönetici üyeliğinizi onayladığında sayfayı yenileyin; ana sayfa ve menü açılır.',
      'Yanlış hesapla girdiyseniz “Farklı hesapla giriş yap” ile çıkış yapın.',
    ],
    tips: [
      'Mümkünse üniversite e-posta adresinizi kullanın; yöneticiler izin verilen alan adları dışındaki hesapları işaretli görür.',
      'Hub’daki hesap IEEE üyeliği yerine geçmez; IEEE üyeliği ayrı sistemde yürür.',
    ],
  },
  {
    id: 'arayuz',
    audiences: ['member'],
    title: 'Ana sayfa ve menü',
    where: 'Ana sayfa · sol menü · üst çubuk',
    summary: 'Ana sayfa açık görevlerinizi, onayınızı bekleyen dilekçeleri, süreçteki dilekçelerinizi ve yaklaşan etkinlikleri özetler.',
    steps: [
      'Sol menünün üstündeki “Çalışma alanı” seçiminden görevli olduğunuz komiteyi seçin; menüde o komitenin çalışma alanı bağlantısı çıkar.',
      'Menü yalnızca yetkinizin olduğu sayfaları gösterir. Bir sayfayı göremiyorsanız görev atamanızda o yetki yoktur.',
      'Üst çubuktaki ay/güneş düğmesiyle açık ve koyu tema arasında geçiş yapın; seçiminiz bu tarayıcıda hatırlanır.',
      'Sağ üstteki adınıza tıklayarak “Profilim ve görevlerim” sayfasına gidebilir veya çıkış yapabilirsiniz.',
    ],
  },
  {
    id: 'profil',
    audiences: ['member'],
    title: 'Profil bilgileri',
    where: 'Sağ üst › Profilim ve görevlerim',
    summary: 'Profilinizdeki ad, bölüm, öğrenci numarası ve telefon, dilekçe formlarında ilgili alanlara otomatik yazılır.',
    steps: [
      'Sağ üstteki adınızdan “Profilim ve görevlerim” sayfasını açın.',
      'Ad soyad, bölüm, öğrenci no ve telefon alanlarını doldurup kaydedin.',
    ],
    tips: ['Telefon numaranızı yalnız gerekli ise girin; dilekçelerde ve görev kayıtlarında görevliler tarafından görülebilir.'],
  },
  {
    id: 'gorevlerim',
    audiences: ['member'],
    title: 'Görevlerim',
    where: 'Görevler ve projeler › Görevlerim',
    summary: 'Size atanan görevler gecikenler, bu hafta ve diğer açık görevler olarak gruplanır. Hub’a girilmeyen iş resmî görev sayılmaz.',
    steps: [
      'Görevler ve projeler sayfasında “Görevlerim” sekmesini açın.',
      'Bir göreve tıklayarak ayrıntıyı, tamamlanma ölçütünü ve dosya bağlantısını görün.',
      'Çalışmaya başlayınca durumu “Devam ediyor”, bitirince “Tamamlandı” yapın.',
      'Takıldığınızda durumu “Engellendi” yapın ve yoruma nedenini yazın; birim yöneticiniz görür.',
    ],
    tips: ['“Tamamlananları gizle” ile listeyi sadeleştirebilirsiniz.'],
  },
  {
    id: 'dilekce-yaz',
    audiences: ['member'],
    title: 'Dilekçe yazma ve gönderme',
    where: 'Dilekçe › Yeni dilekçe',
    summary: 'Dilekçeler şablondan oluşturulur; formu doldururken belge sağda anında oluşur ve onay zinciri gösterilir.',
    steps: [
      'Yeni dilekçe sayfasında dilekçenin kol geneli mi yoksa bir komite/birim adına mı olduğunu seçin.',
      'Şablon listesinden dilekçe türünü seçin; arama kutusu ve kategori filtresiyle daraltabilirsiniz.',
      '“Dilekçe başlığı” alanına listelerde görünecek kısa bir ad yazın (belgeye basılmaz).',
      'Formu doldurun; sağdaki belge önizlemesi ve altındaki onay zinciri anında güncellenir.',
      'Hazır değilseniz “Taslak kaydet”; hazırsanız “Onaya gönder” deyin ve onaylayın. Evrak numarası gönderimde atanır.',
    ],
    tips: [
      'Gönderilen dilekçe onay zincirindeki ilk makama düşer; durumunu Dilekçeler › Dilekçelerim sekmesinden izleyin.',
      'Kullanabileceğiniz şablon yoksa Genel Sekreterliğe başvurun; şablonlar yönetimden eklenir.',
    ],
  },
  {
    id: 'dilekce-takip',
    audiences: ['member'],
    title: 'Dilekçe takibi, iade ve belge doğrulama',
    where: 'Dilekçe › Dilekçeler',
    summary: 'Dilekçenin hangi adımda olduğunu, onay geçmişini ve onaylı belgeyi dilekçe sayfasında görürsünüz.',
    steps: [
      'Dilekçeler sayfasında “Dilekçelerim” sekmesinden dilekçeyi açın.',
      'İade edildiyse gerekçeyi okuyun, gerekli alanları düzeltin ve “Düzelt ve yeniden gönder” deyin.',
      'Vazgeçtiyseniz süreçteki dilekçeyi “Geri çek” ile geri alabilirsiniz; taslakları silebilirsiniz.',
      'Onaylanan dilekçeyi “PDF olarak kaydet” ile indirin. Belgedeki QR kod ve 12 karakterlik doğrulama kodu, belgenin gerçekliğini gösterir.',
    ],
    tips: [
      'Herkes giriş yapmadan “Belge doğrula” sayfasından (/dogrula) kodu girerek belgeyi doğrulayabilir; sayfada sahibin adı maskelenir.',
    ],
  },
  {
    id: 'gonulluluk',
    audiences: ['member'],
    title: 'Gönüllülük başvurusu',
    where: 'Organizasyon › Gönüllülük',
    summary: 'Hub üyesi olarak başka bir komite veya birimde gönüllü olmak için buradan başvurursunuz.',
    steps: [
      '“Başvur / başvurularım” sekmesinde birimi seçin.',
      'Neden gönüllü olmak istediğinizi ve haftalık ayırabileceğiniz zamanı yazıp “Başvur” deyin.',
      'Başvurunuzun durumunu aynı sekmedeki “Başvurularım” listesinden izleyin; isterseniz “Geri çek” ile geri alın.',
      'Kabul edildiğinizde gönüllü rolünüz ve oryantasyon görevleriniz otomatik oluşur; görevler Görevlerim’de görünür.',
    ],
    tips: ['Komite ve Yönetim Kurulunun tarihli alım ilanları için menüdeki “Açık başvurular” sayfasına bakın.'],
  },
  {
    id: 'kariyer-aday',
    audiences: ['member'],
    title: 'Açık başvurular (kariyer sayfası)',
    where: 'Organizasyon › Açık başvurular · ieee-ikcu-kariyer.web.app',
    summary: 'Komitelerin ve Yönetim Kurulunun tarihli ilanları herkese açık kariyer sayfasında yayımlanır; kulüp dışından da başvurulabilir.',
    steps: [
      'Kariyer sayfasında açık pozisyonları inceleyin ve “Başvur” (giriş yapmadıysanız “Giriş yap ve başvur”) deyin.',
      'Google veya e-posta ile giriş yapın; bu hesap yalnız başvurunuzu takip etmeniz içindir.',
      'Formu doldurun, KVKK Aydınlatma Metni’ni okuyup onay kutusunu işaretleyin ve “Başvuruyu gönder” deyin.',
      'Başvurunuzun durumu ve varsa birimin notu sayfanın üstündeki “Başvurularım” bölümünde görünür. Karar verilmeden önce “Geri çek” ile geri alabilirsiniz.',
    ],
  },
  {
    id: 'toplanti-uye',
    audiences: ['member'],
    title: 'Toplantılar ve tutanaklar',
    where: 'Operasyon › Toplantılar',
    summary: 'Komitenizin toplantı gündemini, kararlarını ve kesinleşmiş tutanaklarını buradan okursunuz.',
    steps: [
      'Toplantılar sayfasında komitenizi seçin ve toplantıyı açın.',
      'Kesinleşmiş tutanağı “Word tutanağı” ile indirebilirsiniz.',
    ],
  },
  {
    id: 'icerik-talebi',
    audiences: ['member', 'manager'],
    title: 'İçerik (tanıtım) talebi',
    where: 'Operasyon › İletişim',
    summary: 'Afiş, duyuru ve sosyal medya istekleri iletişim birimine WhatsApp yerine buradan iletilir.',
    steps: [
      '“Taleplerim ve birimim” sekmesinde “İçerik talebi” açın.',
      'Talep eden birimi, türü, ilgili etkinliği, istenen yayın tarihini ve kanalları seçin.',
      '“Talep açıklaması (brief)” alanına hedef kitle, ana mesaj ve olmazsa olmaz bilgileri yazın; görseller için Drive bağlantısı ekleyin.',
      'İletişim birimi talebi kabul eder, üretim panosunda hazırlar; hazırlanan içerik yayından önce birim onayınıza düşer.',
    ],
    tips: ['Etkinlik tanıtımı, etkinlik onaylanmadan yayına alınamaz.'],
  },
  {
    id: 'sponsor-sorgu',
    audiences: ['member'],
    title: 'Sponsor firma sorgulama',
    where: 'Operasyon › Sponsorluk › Firma sorgula',
    summary: 'Aynı firmayla birden çok kişinin görüşmesini önlemek için her firmanın tek sorumlusu vardır.',
    steps: [
      'Bir firmayla görüşmeden önce “Firma sorgula” sekmesinde firma adını arayın.',
      'Firma havuzdaysa sorumlusuna iletişim talebi gönderin; kendiniz doğrudan görüşmeyin.',
      'Havuzda yoksa sponsorluk sorumlusundan firmanın size atanmasını isteyin.',
    ],
  },
  {
    id: 'devir-uye',
    audiences: ['member', 'manager'],
    title: 'Devir paketi hazırlama ve teslim alma',
    where: 'Organizasyon › Devir paketleri',
    summary: 'Görev süreniz biterken bir sonraki kişiye bırakacağınız bilgileri paket olarak hazırlarsınız; paket aynı rolü devralan kişiye görünür.',
    steps: [
      '“Hazırladıklarım” sekmesinde “Paket oluştur” deyin ve paketin hangi göreviniz için olduğunu seçin.',
      'Süren işler, takvim, hesaplar ve erişimler, bütçe, dosyalar, paydaşlar ve öneriler bölümlerini doldurup “Kaydet” deyin.',
      'Hazır olduğunda “Teslim et” deyin.',
      'Size devredilen paketler “Bana devredilenler” sekmesindedir; okuyup “Kabul et” veya eksikse not yazarak “Eksik, geri gönder” deyin.',
    ],
    tips: ['Pakete şifre ve kişisel telefon yazmayın; hesap erişimleri Envanter üzerinden devredilir.'],
  },
  {
    id: 'yardim',
    audiences: ['member'],
    title: 'Sorun bildirme',
    where: 'Yardım › Sorun bildir',
    summary: 'Hata, yetki sorunu, soru ve önerilerinizi TechOps’a buradan iletirsiniz.',
    steps: [
      'Türü (Hata, Öneri, Yetki sorunu, Soru) seçin ve hangi sayfada olduğunu yazın.',
      'Ne olduğunu ve ne beklediğinizi yazıp “Gönder” deyin.',
      'Yanıtı aynı sayfadaki “Bildirimlerim” listesinde görürsünüz.',
    ],
  },

  // ---------- Birim başkanları ----------
  {
    id: 'onaylar',
    audiences: ['manager'],
    title: 'Dilekçe onaylama, iade ve ret',
    where: 'Onayımı bekleyenler',
    summary: 'Görev atamanız gereği kararınızı bekleyen dilekçeler burada listelenir. Onay hakkı rolünüzden gelir.',
    steps: [
      'Onayımı bekleyenler sayfasından dilekçeyi açın ve belgeyi inceleyin.',
      'Birden fazla rolünüz varsa “Hangi rolünüzle karar veriyorsunuz?” alanından doğru rolü seçin.',
      'Onaylayın, düzeltme için iade edin veya reddedin. İade ve ret için “Not / gerekçe” zorunludur; dilekçe sahibi ve sonraki onaycılar görür.',
      'Son 15 dakika içinde giriş yapmadıysanız “Kimliğinizi doğrulayın” penceresinde şifrenizi girmeniz istenir.',
    ],
    tips: [
      'Kendi dilekçenizi onaylayamazsınız; verilen onaylar sonradan değiştirilemez.',
      'Adımda nisap varsa dilekçe, gerekli sayıda farklı makam onaylayınca sonraki adıma geçer.',
    ],
  },
  {
    id: 'birim-alani',
    audiences: ['manager'],
    title: 'Komite çalışma alanı',
    where: 'Sol menü › [Komite adı] › Komite çalışma alanı',
    summary: 'Komitenizin görevlerini, etkinliklerini, toplantılarını ve üyelerini tek sayfada özetler.',
    steps: [
      'Sol menünün üstündeki “Çalışma alanı” seçiminden komitenizi seçin.',
      '“Komite çalışma alanı” bağlantısını açın; kartlardan ilgili sayfalara geçin.',
    ],
  },
  {
    id: 'gorev-ata',
    audiences: ['manager'],
    title: 'Görev ve proje yönetimi',
    where: 'Görevler ve projeler › Birim panosu / Projeler',
    summary: 'Her görevin tek sorumlusu, son tarihi ve tamamlanma ölçütü olur. Birim panosu birimde görevi olan herkese açıktır.',
    steps: [
      'Görevler ve projeler sayfasında “Yeni görev” deyin.',
      'Başlık, birim, sorumlu (tek kişi) ve “Görev ne zaman bitmiş sayılır?” sorusunu yanıtlayan tamamlanma ölçütünü girin; gerekirse destek verenleri, son tarihi, önceliği, projeyi ve Drive bağlantısını ekleyin.',
      'Panoda kartları sürükleyerek durum değiştirin; “Liste” görünümüne de geçebilirsiniz.',
      'Birden çok görevi kapsayan işler için “Projeler” sekmesinde “Yeni proje” açın; amaç, tarih ve Drive klasörünü girin, bitince kapanış değerlendirmesini yazın.',
    ],
    tips: ['Geciken görevler Raporlar › Haftalık operasyon’da sorumlusuyla birlikte listelenir.'],
  },
  {
    id: 'gonullu-yonet',
    audiences: ['manager'],
    title: 'Gönüllü başvurularını değerlendirme',
    where: 'Organizasyon › Gönüllülük › Birimime gelen başvurular',
    summary: 'Hub üyelerinin biriminize yaptığı gönüllülük başvurularını kabul veya reddedersiniz.',
    steps: [
      '“Birimime gelen başvurular” sekmesini açın.',
      'Gerekirse “Not (başvurana görünür)” alanına açıklama yazın; nota iç değerlendirme yazmayın.',
      '“Kabul et” dediğinizde gönüllü rolü ve oryantasyon görevleri otomatik oluşur; “Reddet” ile başvuruyu kapatın.',
      'Aktif gönüllünün görevini gerektiğinde “Sonlandır” ile bitirin.',
    ],
    tips: ['Birim yöneticileri yalnız kurum ayarlarında belirlenen gönüllü rolünü verip alabilir.'],
  },
  {
    id: 'ilan',
    audiences: ['manager'],
    title: 'Alım ilanı açma ve adayları değerlendirme',
    where: 'Organizasyon › Başvuru yönetimi',
    summary: 'Tarihli ilan açıp kariyer sayfasında yayımlarsınız; kulüp dışından gelen adayları değerlendirir, kabul edilenleri gönüllü yaparsınız.',
    steps: [
      '“Yönettiğiniz birim” alanında birimi seçin ve “Yeni ilan aç” deyin.',
      'İlan başlığı, pozisyon, kartta görünecek kısa açıklama, ayrıntılar, beklentiler, başlangıç ve bitiş tarihi ile isteğe bağlı kontenjanı girin.',
      'Gerekirse “Soru ekle” ile en fazla 10 özel soru ekleyin. “Seçenek” türünde her seçeneği yazıp Enter’a basın (en az iki).',
      '“Taslağı oluştur” deyin. Taslağı “Düzenle” ile değiştirebilir, kontrol ettikten sonra “Yayımla” ile kariyer sayfasına çıkarabilirsiniz.',
      'Adayları “Adayları yönet” ile açın. “İncelemeye al”, “Yedeğe al”, “Kabul et” veya “Olumsuz” deyin. Kabul, gönüllü rolünü ve oryantasyon görevlerini oluşturur.',
      'Alım bitince “Başvuruyu kapat”, dönem sonunda “Arşivle” deyin.',
    ],
    tips: [
      '“Adaya gösterilecek not” adayın kariyer sayfasında görünür; iç değerlendirme yazmayın.',
      'Yayımlanan ilanın soruları değiştirilemez; önemli bir değişiklik gerekiyorsa ilanı kapatıp yeni ilan açın.',
      'Kabul ve olumsuz kararları kesindir; sonradan değiştirilemez.',
      'Kurum ayarlarında başvuru KVKK metni yayımlı değilse kariyer sayfası başvuru kabul etmez.',
    ],
  },
  {
    id: 'etkinlik',
    audiences: ['manager'],
    title: 'Etkinlik önerme ve yürütme',
    where: 'Operasyon › Etkinlikler',
    summary: 'Etkinlik öneriden kapanış raporuna kadar Hub’da izlenir; YK kararıyla veya onaylanmış etkinlik izin dilekçesiyle onaylanır.',
    steps: [
      '“Etkinlik öner” deyin; ad, düzenleyen birim, tür, tarih, yer, tahmini katılımcı ve sorumluları girip “Öneriyi gönder” deyin.',
      'Onay için etkinlik sayfasındaki “Onaylanmış dilekçenizi bağlayın” alanından aynı birimin onaylı etkinlik izin dilekçesini seçin veya YK kararını bekleyin.',
      '“Görev planı” sekmesinde etkinlik görevlerini, “İletişim” sekmesinde tanıtım taleplerini yönetin.',
      '“vTools hazırlık” sekmesinde IEEE vTools bildirimi için gereken bilgileri tamamlayıp “Hazırlık CSV’si”ni indirin; vTools’a girdikten sonra vTools etkinlik kimliğini kaydedin.',
      '“Katılımcılar (HeptaCert)” sekmesinde HeptaCert’ten indirdiğiniz katılımcı CSV’sini yükleyin; aynı dosyayı tekrar yüklemek çift kayıt oluşturmaz.',
      '“Kapanış ve rapor” sekmesinde katılımcı sayılarını, özeti, çıktıları ve öğrenilenleri girin.',
    ],
    tips: ['Kapanışı geciken etkinlikler Raporlar › Aylık yönetim’de listelenir.'],
  },
  {
    id: 'toplanti-yonet',
    audiences: ['manager'],
    title: 'Toplantı ve tutanak yönetimi',
    where: 'Operasyon › Toplantılar',
    summary: 'Gündem, katılım, kararlar ve takip maddeleri tek tutanakta tutulur; kesinleşen tutanak değiştirilemez.',
    steps: [
      'Komiteyi seçin, “Yeni toplantı” alanına başlık yazıp “Oluştur” deyin.',
      'Tarih, yer, toplantı başkanı, tutanak sorumlusu ve katılan üyeleri girin.',
      '“Madde ekle” ile gündem maddelerini ve görüşme notlarını, “Karar ekle” ile karar no, karar, oylama biçimi, sorumlu ve son tarihi girin.',
      'Kontrol ettikten sonra “Kesinleştir” deyin ve “Word tutanağı” ile belgeyi indirin.',
    ],
    tips: ['Kesinleşmemiş taslak “Taslağı sil” ile silinebilir; kesinleşen tutanak kalıcıdır.'],
  },
  {
    id: 'butce',
    audiences: ['manager'],
    title: 'Bütçe özeti',
    where: 'Operasyon › Bütçeler',
    summary: 'Etkinlik ve birim bütçelerinin planlanan ve gerçekleşen tutarları özetlenir; ana finansal kayıt Sheets ve Drive’da kalır.',
    steps: [
      'Birim filtresinden biriminizi seçin.',
      'Yeni bütçe kaydında başlık, kapsam, etkinlik, Sheets bağlantısı ve finansal belgeler klasörünü girin.',
      'Kalemleri planlanan ve gerçekleşen tutarlarla güncel tutun.',
    ],
  },

  // ---------- YK ve yöneticiler ----------
  {
    id: 'uyeler',
    audiences: ['admin'],
    title: 'Üye onayı, askıya alma ve ayrılış',
    where: 'Yönetim › Üyeler',
    summary: 'Hub’a giriş yapan kişiler önce onay bekler; onaylanan üyeler dilekçe oluşturabilir ve görev alabilir.',
    steps: [
      '“Onay bekliyor” filtresinden yeni hesapları görün; kimliği doğrulayıp “Onayla” veya “Reddet” deyin.',
      'Gerektiğinde “Üyeliği askıya al” ile erişimi durdurun; “Yeniden etkinleştir” ile geri açın.',
      'Kol’dan ayrılan kişi için “Ayrılış işlemi” başlatın: Discord, Google Grupları, Drive paylaşımları ve diğer hesaplar kontrol listesini tamamlayın.',
      'Üyeye buradan doğrudan “Görev ata” da diyebilirsiniz.',
    ],
    tips: ['İzin verilen e-posta alan adları dışındaki hesaplar işaretli görünür; alan adları Kurum ayarlarında düzenlenir.'],
  },
  {
    id: 'atamalar',
    audiences: ['admin'],
    title: 'Görev atamaları ve yetkiler',
    where: 'Yönetim › Görev atamaları',
    summary: 'Kimin hangi birimde hangi rolde olduğu; yetkiler ve dilekçe onay hakları buradan gelir ve anında geçerli olur.',
    steps: [
      '“Görev ata” deyin; kişiyi, birimi, rolü ve dönemi seçin.',
      'Başlangıç ve (gerekirse) bitiş tarihini ve karar notunu (örn. “YK kararı 2026/14”) girin.',
      'Yeni başkan atanırken “Bu roldeki mevcut görevlileri sonlandır” seçeneğiyle eski görevlinin görevini aynı anda bitirin.',
      'Biten görevleri “Görevi sonlandır” ile kapatın. Yetki görünümünde tutarsızlık varsa “Erişimleri yenile” deyin.',
    ],
    tips: ['Yönetim yetkisi içeren rol atamaları denetim kaydına yazılır.'],
  },
  {
    id: 'donemler',
    audiences: ['admin'],
    title: 'Dönem yönetimi',
    where: 'Yönetim › Dönemler',
    summary: 'Görevler döneme bağlıdır; dönem kapatıldığında o döneme ait görevler sona erer ve eski yetkiler açık kalmaz.',
    steps: [
      '“Yeni dönem” ile başlangıç ve bitiş tarihlerini girin.',
      'Dönem başladığında “Aktif dönem yap” deyin.',
      'Devir tamamlandığında eski dönemi “Dönemi kapat” ile kapatın.',
    ],
  },
  {
    id: 'secimler',
    audiences: ['admin'],
    title: 'Seçim kaydı',
    where: 'Yönetim › Seçimler',
    summary: 'Genel kurul ve komite seçimlerinin kaydı tutulur; sonuç görev atamalarına işlenir. Oylama fiziksel yapılır, Hub sonucu kaydeder.',
    steps: [
      '“Yeni seçim” ile başlık, dönem ve seçim tarihini girin; açılan seçim sayfasında pozisyonları (birim ve rol) ekleyin.',
      '“Adaylık sürecini aç” deyin ve adayları girin.',
      '“Adaylıkları kapat, oylamaya geç” deyin.',
      'Oylamadan sonra oy hakkı olan, kullanılan, boş ve geçersiz oy sayılarını, adayların oylarını, divan ve katip bilgisini ve tutanak bağlantısını girin.',
      '“Sayımı doğrula ve sonucu kesinleştir” deyin; kazananlar görev atamalarına işlenir, isterseniz eski görevliler sonlandırılır.',
    ],
    tips: ['Eşitlik veya ikinci tur durumunu “Eşitlik / ikinci tur açıklaması” alanına yazın.'],
  },
  {
    id: 'birimler-roller',
    audiences: ['admin'],
    title: 'Komiteler, birimler ve roller',
    where: 'Yönetim › Komiteler ve birimler / Roller ve yetkiler',
    summary: 'Birimler ve rollerin neler yapabileceği arayüzden düzenlenir. Birimler silinmez, pasifleştirilir; geçmiş kayıtlar bozulmaz.',
    steps: [
      'Komiteler ve birimler sayfasında birim ekleyin: ad, kısa kod (evrak ve raporlarda görünür), tür, üst birim ve sıra.',
      'Kullanılmayan birimi “Aktif” işaretini kaldırarak pasifleştirin.',
      'Roller ve yetkiler sayfasında rolün adını, açıklamasını ve yetkilerini düzenleyin.',
    ],
    tips: ['Dilekçe onay zincirleri rollere göre kurulduğundan rol değişikliği onay akışlarını etkiler.'],
  },
  {
    id: 'sablonlar',
    audiences: ['admin'],
    title: 'Dilekçe şablonları',
    where: 'Yönetim › Dilekçe şablonları',
    summary: 'Mevcut Word dilekçeleri yüklenir veya sistemde yeni şablon oluşturulur. Word içindeki {alan_adi} etiketleri form alanına dönüşür.',
    steps: [
      '“Yeni şablon” ile ad, kategori, evrak serisi (2–6 harf) ve kullanabilecek birimleri girin; ya da “Word klasöründen aktar” ile toplu yükleyin.',
      '“1. Belge” sekmesinde Word dosyasını yükleyin veya metni sistemde yazın; doldurulacak yerlere {alan_adi} yazın.',
      'Alanlar sekmesinde alan türlerini ve zorunlulukları düzenleyin.',
      'Onay zincirinde her adım için adım adını, onaylayabilecek rolleri, hangi birimdeki yetkilinin onaylayacağını ve onay kuralını (biri, tümü veya nisap) belirleyin.',
      '“Yeni sürüm yayımla” deyin ve değişiklik notunu yazın.',
    ],
    tips: ['Yayımlanan sürümdeki değişiklik yalnızca yeni gönderimleri etkiler; önceki dilekçeler kendi sürümleriyle kalır.'],
  },
  {
    id: 'tuzuk',
    audiences: ['admin'],
    title: 'Tüzük yayımlama',
    where: 'Organizasyon › Tüzük',
    summary: 'Tüzük herkese açık yayımlanır; her yayım değiştirilemez bir sürüm olarak arşivlenir.',
    steps: [
      'Tüzük sayfasında PDF veya Word dosyasını (en fazla 4 MB) seçin.',
      'Başlık, sürüm / karar bilgisi ve açıklamayı girip “Yayımla” deyin.',
    ],
  },
  {
    id: 'raporlar',
    audiences: ['admin', 'manager'],
    title: 'Raporlar',
    where: 'Operasyon › Raporlar',
    summary: 'Raporlar operasyon verilerinden anlık hesaplanır; Genel Sekreter onayından geçmeden resmî kabul edilmez.',
    steps: [
      '“Haftalık operasyon” ve “Aylık yönetim” sekmelerinden görev, etkinlik, dilekçe, sponsor ve bütçe özetlerini inceleyin.',
      'Resmî kayıt için raporda “Arşive kaydet” deyin; taslak rapor “Arşiv” sekmesinde onaya sunulur.',
      '“Dilekçe metrikleri” onay sürelerini, “Veri kalitesi” eksik kayıtları, “Devir ve onaycılar” onaycısı olmayan adımları, “vTools” bildirilecek etkinlikleri gösterir.',
    ],
    tips: ['Dönem başında “Devir ve onaycılar” sekmesini kontrol edin; onaycısı olmayan dilekçe adımı süreçleri kilitler.'],
  },
  {
    id: 'sekreterlik',
    audiences: ['admin'],
    title: 'Sekreterlik defteri',
    where: 'Operasyon › Sekreterlik defteri',
    summary: 'Toplantı tutanakları, kararlar, gelen-giden evrak ve takip notlarının kronolojik kurumsal kaydıdır.',
    steps: [
      '“Yeni kayıt” deyin; kayıt türü, tarih, karar / evrak sayısı, konu, birim ve açıklamayı girin.',
      'Varsa katılanları, takip tarihini ve Drive bağlantısını ekleyip “Kaydet” deyin.',
    ],
  },
  {
    id: 'sponsor-yonet',
    audiences: ['admin'],
    title: 'Sponsor havuzu',
    where: 'Operasyon › Sponsorluk › Havuz',
    summary: 'Sponsor havuzu, görüşme geçmişi ve sponsor kilidi burada yönetilir.',
    steps: [
      '“Sponsor ekle” ile firma adını, sektörü, web sitesini ve tek sorumluyu girin.',
      'Görüşme aşamasını, sonraki işlemi ve sonraki işlem tarihini güncel tutun; anlaşma tutarını ve teklif dosyalarını ekleyin.',
      'Sorumlusu olduğunuz firmalar için gelen iletişim taleplerini talepler sekmesinden yanıtlayın.',
    ],
    tips: ['Sonraki işlem tarihi geçmiş görüşmeler Raporlar › Aylık yönetim’de listelenir.'],
  },
  {
    id: 'demirbas',
    audiences: ['admin'],
    title: 'Demirbaş ve zimmet',
    where: 'Operasyon › Demirbaş ve zimmet',
    summary: 'Fiziksel varlıkların kimde, nerede ve hangi durumda olduğu hareket geçmişiyle izlenir; kayıtlar silinmez.',
    steps: [
      '“Demirbaş ekle” ile varlık adı, kategori, fiziksel konum, birim ve varsa seri numarası, alım bilgileri ve garanti bitişini girin.',
      '“Düzenle / zimmet” ile zimmetli kişiyi, durumu ve konumu değiştirin; “Bu hareketin açıklaması” alanına nedenini yazın.',
      '“QR etiket indir” ile etiketi yazdırıp varlığın üzerine yapıştırın.',
    ],
    tips: ['QR etiket yalnız kayda götürür; ek yetki vermez.'],
  },
  {
    id: 'envanter',
    audiences: ['admin'],
    title: 'Sistem envanteri (TechOps)',
    where: 'Yönetim › Envanter',
    summary: 'Kolun kullandığı sistemler, erişimler, veriler ve riskler kayıt altında tutulur.',
    steps: [
      'Her sistem için yöneticileri ve erişim bilgisinin nerede tutulduğunu kaydedin (şifre yazmayın).',
      'Tek yöneticili kritik sistemlere ikinci yönetici ekleyin; bu sistemler işaretli görünür.',
    ],
  },
  {
    id: 'ayarlar',
    audiences: ['admin'],
    title: 'Kurum ayarları',
    where: 'Yönetim › Kurum ayarları',
    summary: 'Kurum kimliği, evrak numarası biçimi, doğrulama adresi, gönüllülük ve vTools ayarları buradadır.',
    steps: [
      'Kurum adı, kısa ad, logo ve giriş ekranı notunu düzenleyin.',
      'Evrak numarası ön ekini ve biçimini ({prefix} {year} {series} {seq:4}) belirleyin; örnek numara anında gösterilir.',
      'Varsayılan dönemi, doğrulama adresini ve izin verilen e-posta alan adlarını girin.',
      'vTools organizasyon birimi, SPOID, iletişim e-postası ve saat dilimini girin.',
      'Kabul edilen gönüllüye atanacak rolü, oryantasyon görevlerini ve dilekçe kategorilerini düzenleyip “Kaydet” deyin.',
    ],
  },
  {
    id: 'politikalar',
    audiences: ['admin'],
    title: 'KVKK ve politika metinleri',
    where: 'Yönetim › Kurum ayarları › Politikalar ve KVKK metinleri',
    summary: 'Başvuru ve üye KVKK aydınlatma metinleri, çerez politikası ve kullanım koşulları herkese açık, değiştirilemez sürümler olarak yayımlanır.',
    steps: [
      'Sekmelerden politikayı seçin. İlk açılışta hazır taslak gelir.',
      'Köşeli parantezli alanları (veri sorumlusu, yurt dışı aktarım dayanağı, saklama süresi, iletişim adresleri) hukuki görüşe göre doldurun.',
      'Sürüm etiketini girin ve “Yeni sürüm olarak yayımla” deyin. Metin /politika/… adresinde ve sayfaların alt bilgisinde görünür.',
    ],
    tips: [
      'Başvuru KVKK metni yayımlanmadan kariyer sayfası başvuru kabul etmez.',
      'Yayımlanan sürüm değiştirilemez; düzeltme için yeni sürüm yayımlayın. Her başvuru onayladığı sürümü saklar.',
    ],
  },
  {
    id: 'denetim',
    audiences: ['admin'],
    title: 'Denetim kaydı',
    where: 'Yönetim › Denetim kaydı',
    summary: 'Yönetim işlemlerinin kaydıdır; kayıtlar yalnızca eklenebilir, değiştirilemez ve silinemez.',
    steps: ['Kimin hangi işlemi ne zaman yaptığını inceleyin. Dilekçe onayları ayrıca her dilekçenin kendi geçmişinde tutulur.'],
  },
  {
    id: 'destek-gelen',
    audiences: ['admin'],
    title: 'Destek taleplerini yanıtlama (TechOps)',
    where: 'Yardım › Gelen talepler',
    summary: 'Üyelerin sorun bildirimleri burada toplanır.',
    steps: ['Talebi okuyun, “Yanıt” alanına açıklamayı yazın ve “Çözüldü” deyin; yanıt bildirimi yapan kişiye görünür.'],
  },
];

export function manualFor(audience: ManualAudience | 'all', query = ''): ManualSection[] {
  const q = query.trim().toLocaleLowerCase('tr-TR');
  return MANUAL.filter((section) => audience === 'all' || section.audiences.includes(audience)).filter((section) => {
    if (!q) return true;
    return [section.title, section.where, section.summary, ...section.steps, ...(section.tips ?? [])]
      .join(' ')
      .toLocaleLowerCase('tr-TR')
      .includes(q);
  });
}
