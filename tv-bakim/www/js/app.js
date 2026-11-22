/* TV Bakım — arayüz. Kumandanın yön tuşları ve OK ile kullanılır. */
(function () {
  'use strict';
  var CH = 'https://raw.githubusercontent.com/departures-mil/duyurular/main/tv-bakim/guncelleme/';
  var B = window.TV || null;                 // Android köprüsü (tarayıcıda yok: deneme kipi)
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ls = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };

  var T = {
    tr: {
      setupT: 'Bir kez: Ağ hata ayıklamasını açın', setupD: 'Android bu ayarı uygulamaya açtırmıyor. Aşağıdaki düğmelerle ilgili ekranları açın; geri dönünce uygulama bağlantıyı kendisi kurar ve kalan bakımı yapar.', later: 'Sonra', never: 'Bir daha gösterme', autoDone: 'Tam yetki alındı; kalan bakım adımları yapıldı.',
      bg: 'Arka Plan Kısıtlama', bgD: 'Kendiliğinden başlayan uygulamaların arka planda çalışmasını keser; RAM hep boş kalır.',
      disk: 'Depolama Analizi', diskD: 'Yer kaplayan klasörleri, büyük dosyaları ve bırakılmış kurulum (.apk) dosyalarını gösterir.',
      sBg: 'Arka plan uygulamaları kısıtlanıyor', rBg: '{n} uygulamanın arka planda çalışması kısıtlandı.', rBgNo: 'Bunun için «Tam Yetki» gerekir.', rBgSkip: 'Kısıtlanacak uygulama yok.',
      boot: 'açılışta başlar', restrict: 'Kısıtla', allow: 'Serbest bırak', restrictAll: 'Hepsini kısıtla', bgNote: 'Serbest bıraktığınız uygulamalar bakımda da kısıtlanmaz. Kısıtlama uygulamayı bozmaz; açınca yine çalışır.',
      stop: 'Durdur', stopped: 'Durduruldu.', folders: 'Klasörler', bigFiles: 'Büyük dosyalar ve kurulum dosyaları', apkTag: 'kurulum dosyası', del: 'Sil', delAll: 'Kurulum dosyalarını sil',
      rDel: '{n} dosya silindi, {mb} yer açıldı.', noneBig: 'Büyük dosya yok.', scanning: 'Taranıyor…', used: 'dolu',
      animSet: 'Menü animasyonu', animHalf: 'Hızlı (0.5x)', animOff: 'Kapalı (en hızlı)', animApplied: 'Uygulandı.', autoAdb: 'Tam yetki kendiliğinden alındı; bakım artık her şeyi yapıyor.',
      app: 'TV Bakım', update: 'Güncelle', settings: 'Ayarlar', minimize: 'Küçült', close: 'Kapat', back: '← Geri',
      oneKey: '★ Tek Tuşla Bakım', oneKeyD: 'RAM, önbellek ve gereksiz dosyaları temizler, menüleri hızlandırır.',
      ram: 'RAM Temizle', ramD: 'Arka planda çalışan uygulamaları kapatır.', cache: 'Önbellekleri Temizle', cacheD: 'Uygulamaların biriken önbelleğini siler.',
      junk: 'Gereksiz Dosyalar', junkD: 'Geçici, günlük ve küçük resim dosyalarını siler. Fotoğraf, video ve belgelerinize dokunmaz.',
      speed: 'Hızlandır', speedD: 'Menü animasyonlarını 0.5x yapar; TV daha çabuk tepki verir.',
      apps: 'Uygulamalar', appsD: 'Yer kaplayan uygulamaları görün, önbelleğini silin ya da kaldırın.',
      hidden: 'Gizli Android Ayarları', hiddenD: 'TV menüsünde gizlenmiş ayar ekranlarını açar.',
      power: 'Tam Yetki (bir kez)', powerD: 'Ağ hata ayıklaması açıksa kendine izin verir: bütün önbellekler topluca silinir, hızlandırma kendiliğinden yapılır.',
      deep: 'Derin Optimizasyon', deepD: 'Depolamayı düzenler (TRIM) ve uygulamaları önceden derler; açılışlar hızlanır (birkaç dakika sürebilir).',
      status: 'Sistem Durumu', ramL: 'RAM', diskL: 'Depolama', upL: 'Açık kalma', animL: 'Animasyon', free: 'boş', of: '/',
      hours: '{h} sa {m} dk', days: '{d} gün', running: 'Bakım yapılıyor…', done: 'Bakım tamamlandı',
      sRam: 'Arka plan uygulamaları kapatılıyor', sCache: 'Önbellekler temizleniyor', sJunk: 'Gereksiz dosyalar siliniyor', sSpeed: 'Menüler hızlandırılıyor', sDeep: 'Uygulamalar optimize ediliyor',
      rRam: '{n} uygulamanın arka plan işi kapatıldı, {mb} RAM boşaldı.', rCache: '{mb} önbellek silindi.', rJunk: '{n} gereksiz dosya silindi, {mb} yer açıldı.',
      rSpeedOk: 'Menü animasyonları 0.5x yapıldı.', rSpeedNo: 'Android bu ayarı izinsiz değiştirtmiyor. «Tam Yetki»yi bir kez açın ya da Geliştirici seçeneklerinden elle yapın.',
      rSpeedSkip: 'Animasyonlar zaten hızlı.', total: 'Toplam açılan yer: {mb}', tip: 'En iyi sonuç için haftada bir çalıştırın. TV çok yavaşsa fişten çekip 1 dakika sonra açın.',
      warnDisk: '⚠ Depolama çok dolu; bu TV\'yi yavaşlatır. Kullanmadığınız uygulamaları kaldırın.', warnRam: '⚠ Boş RAM çok az.', warnUp: '⚠ TV {d} gündür yeniden başlatılmamış.',
      ok: 'Tamam', autoRun: 'Program açılınca bakımı kendiliğinden yap', lang: 'Dil', oldApp: 'Eski «TV Bakım» uygulaması da kurulu. Yenisi her şeyi yapıyor; eskisini kaldırabilirsiniz.',
      removeOld: 'Eskisini kaldır', mine: 'Benim yüklediklerim', all: 'Tüm uygulamalar (sistem dahil, dikkat)', info: 'Önbellek / Durdur', remove: 'Kaldır', none: 'Listelenecek uygulama yok.',
      dev: 'Geliştirici seçenekleri', about: 'Cihaz bilgisi (Derleme numarası)', store: 'Depolama', appsSet: 'Uygulama yönetimi', disp: 'Ekran / Görüntü', wifi: 'Wi‑Fi', date: 'Tarih ve saat', langSet: 'Dil', allSet: 'Android Ayarları (tam menü)',
      notOpen: 'Bu TV bu ekranı gizlemiş, açılamadı.',
      powerHow: 'Tam yetki için (bir kez): 1) «Cihaz bilgisi»ni açıp «Derleme numarası»na 7 kez basın. 2) «Geliştirici seçenekleri»nde «Ağ hata ayıklaması» (ADB over network) seçeneğini açın. 3) Buraya dönüp «Tam Yetki»ye basın; TV\'de çıkan soruda «Her zaman izin ver»i seçin.',
      powerWait: 'Bağlanılıyor… TV ekranında izin sorusu çıkarsa «Her zaman izin ver» seçip Tamam\'a basın.', powerOk: 'Tam yetki alındı. Bundan sonra bakım her şeyi kendiliğinden yapar.', powerNo: 'Bağlanılamadı. Ağ hata ayıklaması açık mı?',
      deepOk: 'Derin optimizasyon tamamlandı.', deepNo: 'Bunun için önce «Tam Yetki» gerekir.',
      upChecking: 'Güncellemeler denetleniyor…', upToDate: 'Program güncel (v{v}).', upNew: 'Yeni sürüm hazır: v{v}', upNow: 'Şimdi güncelle', upFail: 'Güncelleme alınamadı: {e}',
      upInstall: 'İndirildi. Açılan pencerede «Yükle»ye basın.', limits: 'Kullanım Limitleri', browser: 'Deneme kipi (tarayıcı): TV işlemleri yalnız TV\'de çalışır.'
    },
    en: {
      setupT: 'Once: turn on Network debugging', setupD: 'Android does not let an app switch this on. Use the buttons below to open the screens; when you come back the app connects by itself and finishes the maintenance.', later: 'Later', never: 'Do not show again', autoDone: 'Full access obtained; remaining maintenance steps done.',
      bg: 'Background Restriction', bgD: 'Stops self‑starting apps from running in the background; RAM stays free.',
      disk: 'Storage Analysis', diskD: 'Shows folders that take space, large files and leftover installer (.apk) files.',
      sBg: 'Restricting background apps', rBg: 'Background activity of {n} apps restricted.', rBgNo: '«Full Access» is needed for this.', rBgSkip: 'No apps to restrict.',
      boot: 'starts at boot', restrict: 'Restrict', allow: 'Allow', restrictAll: 'Restrict all', bgNote: 'Apps you allow are not restricted by maintenance either. Restriction does not break an app; it still works when opened.',
      stop: 'Stop', stopped: 'Stopped.', folders: 'Folders', bigFiles: 'Large files and installer files', apkTag: 'installer file', del: 'Delete', delAll: 'Delete installer files',
      rDel: '{n} files deleted, {mb} freed.', noneBig: 'No large files.', scanning: 'Scanning…', used: 'used',
      animSet: 'Menu animation', animHalf: 'Fast (0.5x)', animOff: 'Off (fastest)', animApplied: 'Applied.', autoAdb: 'Full access obtained automatically; maintenance now does everything.',
      app: 'TV Care', update: 'Update', settings: 'Settings', minimize: 'Minimize', close: 'Close', back: '← Back',
      oneKey: '★ One‑Key Care', oneKeyD: 'Cleans RAM, caches and junk files and speeds up the menus.',
      ram: 'Free RAM', ramD: 'Closes apps running in the background.', cache: 'Clear Caches', cacheD: 'Deletes the cache apps have piled up.',
      junk: 'Junk Files', junkD: 'Deletes temporary, log and thumbnail files. Your photos, videos and documents are not touched.',
      speed: 'Speed Up', speedD: 'Sets menu animations to 0.5x; the TV responds faster.',
      apps: 'Apps', appsD: 'See apps that take space, clear their cache or uninstall them.',
      hidden: 'Hidden Android Settings', hiddenD: 'Opens settings screens hidden in the TV menu.',
      power: 'Full Access (once)', powerD: 'If network debugging is on, the app grants itself permission: all caches are cleared at once and speed‑up is automatic.',
      deep: 'Deep Optimization', deepD: 'Trims storage (TRIM) and pre‑compiles apps so they open faster (may take a few minutes).',
      status: 'System Status', ramL: 'RAM', diskL: 'Storage', upL: 'Uptime', animL: 'Animation', free: 'free', of: '/',
      hours: '{h} h {m} min', days: '{d} days', running: 'Maintenance running…', done: 'Maintenance complete',
      sRam: 'Closing background apps', sCache: 'Clearing caches', sJunk: 'Deleting junk files', sSpeed: 'Speeding up menus', sDeep: 'Optimizing apps',
      rRam: 'Background work of {n} apps closed, {mb} RAM freed.', rCache: '{mb} of cache deleted.', rJunk: '{n} junk files deleted, {mb} freed.',
      rSpeedOk: 'Menu animations set to 0.5x.', rSpeedNo: 'Android does not allow this without permission. Turn on «Full Access» once, or do it in Developer options.',
      rSpeedSkip: 'Animations are already fast.', total: 'Total space freed: {mb}', tip: 'Run it once a week for best results. If the TV is very slow, unplug it and turn it on again after 1 minute.',
      warnDisk: '⚠ Storage is almost full; this slows the TV. Uninstall apps you do not use.', warnRam: '⚠ Very little free RAM.', warnUp: '⚠ The TV has not been restarted for {d} days.',
      ok: 'OK', autoRun: 'Run maintenance automatically when the app opens', lang: 'Language', oldApp: 'The old «TV Bakım» app is also installed. The new one does everything; you can remove the old one.',
      removeOld: 'Remove the old one', mine: 'Apps I installed', all: 'All apps (incl. system, careful)', info: 'Cache / Stop', remove: 'Uninstall', none: 'No apps to list.',
      dev: 'Developer options', about: 'Device info (Build number)', store: 'Storage', appsSet: 'App management', disp: 'Display', wifi: 'Wi‑Fi', date: 'Date & time', langSet: 'Language', allSet: 'Android Settings (full menu)',
      notOpen: 'This TV hides this screen; it could not be opened.',
      powerHow: 'For full access (once): 1) Open «Device info» and press «Build number» 7 times. 2) In «Developer options» turn on «Network debugging» (ADB over network). 3) Come back and press «Full Access»; choose «Always allow» on the TV prompt.',
      powerWait: 'Connecting… If a permission prompt appears on the TV, choose «Always allow» and press OK.', powerOk: 'Full access granted. From now on maintenance does everything by itself.', powerNo: 'Could not connect. Is network debugging on?',
      deepOk: 'Deep optimization complete.', deepNo: '«Full Access» is needed first.',
      upChecking: 'Checking for updates…', upToDate: 'The app is up to date (v{v}).', upNew: 'New version ready: v{v}', upNow: 'Update now', upFail: 'Update failed: {e}',
      upInstall: 'Downloaded. Press «Install» in the window that opens.', limits: 'Usage limits', browser: 'Demo mode (browser): TV actions work only on the TV.'
    },
    ar: {
      setupT: 'مرة واحدة: فعّل تصحيح الأخطاء عبر الشبكة', setupD: 'لا يسمح أندرويد للتطبيق بتفعيل هذا الإعداد. افتح الشاشات بالأزرار أدناه؛ وعند العودة يتصل التطبيق بنفسه ويكمل الصيانة.', later: 'لاحقاً', never: 'لا تعرض مجدداً', autoDone: 'تم الحصول على الصلاحية الكاملة؛ أُنجزت خطوات الصيانة المتبقية.',
      bg: 'تقييد الخلفية', bgD: 'يمنع التطبيقات التي تبدأ تلقائياً من العمل في الخلفية؛ تبقى الذاكرة فارغة.',
      disk: 'تحليل التخزين', diskD: 'يعرض المجلدات التي تشغل مساحة والملفات الكبيرة وملفات التثبيت (.apk) المتروكة.',
      sBg: 'تقييد تطبيقات الخلفية', rBg: 'قُيّد عمل {n} تطبيق في الخلفية.', rBgNo: 'يلزم تفعيل «الصلاحية الكاملة» لذلك.', rBgSkip: 'لا توجد تطبيقات لتقييدها.',
      boot: 'يبدأ عند الإقلاع', restrict: 'تقييد', allow: 'سماح', restrictAll: 'تقييد الكل', bgNote: 'التطبيقات التي تسمح بها لا تُقيَّد في الصيانة أيضاً. التقييد لا يعطّل التطبيق؛ يعمل عند فتحه.',
      stop: 'إيقاف', stopped: 'تم الإيقاف.', folders: 'المجلدات', bigFiles: 'الملفات الكبيرة وملفات التثبيت', apkTag: 'ملف تثبيت', del: 'حذف', delAll: 'حذف ملفات التثبيت',
      rDel: 'حُذف {n} ملف، وتحرّر {mb}.', noneBig: 'لا توجد ملفات كبيرة.', scanning: 'جارٍ الفحص…', used: 'مستخدم',
      animSet: 'حركة القوائم', animHalf: 'سريع (0.5x)', animOff: 'معطّل (الأسرع)', animApplied: 'تم التطبيق.', autoAdb: 'تم الحصول على الصلاحية الكاملة تلقائياً؛ الصيانة تقوم الآن بكل شيء.',
      app: 'صيانة التلفاز', update: 'تحديث', settings: 'الإعدادات', minimize: 'تصغير', close: 'إغلاق', back: '→ رجوع',
      oneKey: '★ صيانة بزر واحد', oneKeyD: 'ينظّف الذاكرة والذاكرة المؤقتة والملفات غير الضرورية ويسرّع القوائم.',
      ram: 'تحرير الذاكرة', ramD: 'يغلق التطبيقات العاملة في الخلفية.', cache: 'مسح الذاكرة المؤقتة', cacheD: 'يحذف ما تراكم من ذاكرة التطبيقات المؤقتة.',
      junk: 'الملفات غير الضرورية', junkD: 'يحذف الملفات المؤقتة وملفات السجل والصور المصغّرة. لا يمسّ صورك وفيديوهاتك ومستنداتك.',
      speed: 'تسريع', speedD: 'يجعل حركات القوائم 0.5x؛ يستجيب التلفاز أسرع.',
      apps: 'التطبيقات', appsD: 'اعرض التطبيقات التي تشغل مساحة، وامسح ذاكرتها المؤقتة أو أزلها.',
      hidden: 'إعدادات أندرويد المخفية', hiddenD: 'يفتح شاشات الإعدادات المخفية في قائمة التلفاز.',
      power: 'صلاحية كاملة (مرة واحدة)', powerD: 'إن كان تصحيح الأخطاء عبر الشبكة مفعّلاً، يمنح التطبيق نفسه الإذن: تُمسح كل الذاكرة المؤقتة دفعة واحدة ويتم التسريع تلقائياً.',
      deep: 'تحسين عميق', deepD: 'ينظّم التخزين (TRIM) ويجهّز التطبيقات مسبقاً فتفتح أسرع (قد يستغرق بضع دقائق).',
      status: 'حالة النظام', ramL: 'الذاكرة', diskL: 'التخزين', upL: 'مدة التشغيل', animL: 'الحركة', free: 'فارغ', of: '/',
      hours: '{h} س {m} د', days: '{d} يوم', running: 'جارٍ إجراء الصيانة…', done: 'اكتملت الصيانة',
      sRam: 'إغلاق تطبيقات الخلفية', sCache: 'مسح الذاكرة المؤقتة', sJunk: 'حذف الملفات غير الضرورية', sSpeed: 'تسريع القوائم', sDeep: 'تحسين التطبيقات',
      rRam: 'أُغلق عمل {n} تطبيق في الخلفية، وتحرّر {mb} من الذاكرة.', rCache: 'حُذف {mb} من الذاكرة المؤقتة.', rJunk: 'حُذف {n} ملف غير ضروري، وتحرّر {mb}.',
      rSpeedOk: 'أصبحت حركات القوائم 0.5x.', rSpeedNo: 'لا يسمح أندرويد بذلك دون إذن. فعّل «الصلاحية الكاملة» مرة واحدة أو غيّره من خيارات المطوّر.',
      rSpeedSkip: 'الحركات سريعة بالفعل.', total: 'إجمالي المساحة المحرَّرة: {mb}', tip: 'شغّله مرة أسبوعياً لأفضل نتيجة. إن كان التلفاز بطيئاً جداً افصله عن الكهرباء ثم شغّله بعد دقيقة.',
      warnDisk: '⚠ التخزين ممتلئ تقريباً؛ هذا يبطئ التلفاز. أزل التطبيقات التي لا تستخدمها.', warnRam: '⚠ الذاكرة الفارغة قليلة جداً.', warnUp: '⚠ لم يُعَد تشغيل التلفاز منذ {d} يوم.',
      ok: 'حسناً', autoRun: 'إجراء الصيانة تلقائياً عند فتح التطبيق', lang: 'اللغة', oldApp: 'تطبيق «TV Bakım» القديم مثبّت أيضاً. الجديد يقوم بكل شيء؛ يمكنك إزالة القديم.',
      removeOld: 'إزالة القديم', mine: 'التطبيقات التي ثبّتّها', all: 'كل التطبيقات (بما فيها النظام، بحذر)', info: 'الذاكرة المؤقتة / إيقاف', remove: 'إزالة', none: 'لا توجد تطبيقات.',
      dev: 'خيارات المطوّر', about: 'معلومات الجهاز (رقم الإصدار)', store: 'التخزين', appsSet: 'إدارة التطبيقات', disp: 'الشاشة', wifi: 'Wi‑Fi', date: 'التاريخ والوقت', langSet: 'اللغة', allSet: 'إعدادات أندرويد (القائمة الكاملة)',
      notOpen: 'هذا التلفاز يخفي هذه الشاشة؛ تعذّر فتحها.',
      powerHow: 'للصلاحية الكاملة (مرة واحدة): ١) افتح «معلومات الجهاز» واضغط «رقم الإصدار» ٧ مرات. ٢) في «خيارات المطوّر» فعّل «تصحيح الأخطاء عبر الشبكة». ٣) عُد إلى هنا واضغط «صلاحية كاملة»؛ واختر «السماح دائماً» في سؤال التلفاز.',
      powerWait: 'جارٍ الاتصال… إن ظهر سؤال إذن على التلفاز فاختر «السماح دائماً» ثم موافق.', powerOk: 'تم الحصول على الصلاحية الكاملة. من الآن تقوم الصيانة بكل شيء تلقائياً.', powerNo: 'تعذّر الاتصال. هل تصحيح الأخطاء عبر الشبكة مفعّل؟',
      deepOk: 'اكتمل التحسين العميق.', deepNo: 'يلزم تفعيل «الصلاحية الكاملة» أولاً.',
      upChecking: 'جارٍ التحقق من التحديثات…', upToDate: 'التطبيق محدَّث (v{v}).', upNew: 'إصدار جديد جاهز: v{v}', upNow: 'حدّث الآن', upFail: 'تعذّر التحديث: {e}',
      upInstall: 'تم التنزيل. اضغط «تثبيت» في النافذة التي تُفتح.', limits: 'حدود الاستخدام', browser: 'وضع تجريبي (متصفح): عمليات التلفاز تعمل على التلفاز فقط.'
    }
  };

  var APP = window.APP = {
    lang: (function () { var l = ls('tv.dil'); return /^(tr|en|ar)$/.test(l || '') ? l : (/^ar/.test(navigator.language) ? 'ar' : /^tr/.test(navigator.language) ? 'tr' : 'en'); })(),
    version: '1.0.2', found: null, screen: 'home'
  };
  function t(k, v) { var s = (T[APP.lang] && T[APP.lang][k]) || T.tr[k] || k; if (v) for (var x in v) s = s.split('{' + x + '}').join(v[x]); return s; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mb(b) { return IndirmeIlerleme.mb(b || 0, APP.lang); }
  function gb(b) { return (b / 1073741824).toLocaleString(APP.lang === 'ar' ? 'ar' : APP.lang === 'en' ? 'en-US' : 'tr-TR', { maximumFractionDigits: 1 }) + ' GB'; }
  function J(s, d) { try { return JSON.parse(s); } catch (e) { return d; } }
  var toastT;
  window.toast = function (m) { var e = $('#toast'); e.textContent = m; e.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { e.hidden = true; }, 4000); };
  function info() { return B ? J(B.info(), {}) : { version: APP.version, ramFree: 0, ramTotal: 0, diskFree: 0, diskTotal: 0, uptimeMs: 0, anim: 1 }; }
  function later(f) { return new Promise(function (res) { setTimeout(function () { res(f()); }, 30); }); }

  // ---------------------------------------------------------------- çizim
  function applyLang() {
    document.documentElement.lang = APP.lang;
    document.documentElement.dir = APP.lang === 'ar' ? 'rtl' : 'ltr';
    $$('[data-t]').forEach(function (e) { e.textContent = t(e.getAttribute('data-t')); });
    $$('[data-tt]').forEach(function (e) { e.title = t(e.getAttribute('data-tt')); e.setAttribute('aria-label', e.title); });
    document.title = t('app');
    $('#dil').value = APP.lang;
  }

  function statusHtml(i) {
    var up = i.uptimeMs || 0, d = Math.floor(up / 86400000), h = Math.floor(up / 3600000) % 24, m = Math.floor(up / 60000) % 60;
    var upTxt = (d ? t('days', { d: d }) + ' ' : '') + t('hours', { h: h, m: m });
    var warn = [];
    if (i.diskTotal && i.diskFree / i.diskTotal < 0.1) warn.push(t('warnDisk'));
    if (i.lowMem) warn.push(t('warnRam'));
    if (d >= 7) warn.push(t('warnUp', { d: d }));
    return '<div class="stats">' +
      '<div class="stat"><small>' + t('ramL') + '</small><b>' + gb(i.ramFree || 0) + '</b><span>' + t('free') + ' / ' + gb(i.ramTotal || 0) + '</span></div>' +
      '<div class="stat"><small>' + t('diskL') + '</small><b>' + gb(i.diskFree || 0) + '</b><span>' + t('free') + ' / ' + gb(i.diskTotal || 0) + '</span></div>' +
      '<div class="stat"><small>' + t('upL') + '</small><b>' + esc(upTxt) + '</b><span>' + esc((i.brand || '') + ' ' + (i.model || '')) + '</span></div>' +
      '<div class="stat"><small>' + t('animL') + '</small><b>' + (i.anim == null ? '—' : i.anim + 'x') + '</b><span>Android ' + esc(i.android || '') + '</span></div>' +
      '</div>' + (warn.length ? '<div class="warn">' + warn.map(esc).join('<br>') + '</div>' : '');
  }

  function tile(id, k, big) { return '<button class="tile' + (big ? ' big' : '') + '" data-a="' + id + '"><b>' + esc(t(k)) + '</b><span>' + esc(t(k + 'D')) + '</span></button>'; }

  function home() {
    APP.screen = 'home';
    var i = info();
    $('#main').innerHTML =
      (B ? '' : '<div class="warn">' + esc(t('browser')) + '</div>') +
      (B && !i.adb && ls('tv.kur') !== '0' ? '<div class="card setup"><h3>' + esc(t('setupT')) + '</h3><p>' + esc(t('setupD')) + '</p><p class="muted">' + esc(t('powerHow')) + '</p><div class="row">' +
        '<button class="btn pri" data-s="about">' + esc(t('about')) + '</button><button class="btn pri" data-s="dev">' + esc(t('dev')) + '</button>' +
        '<button class="btn" data-a="later">' + esc(t('later')) + '</button><button class="btn" data-a="never">' + esc(t('never')) + '</button></div></div>' : '') +
      (i.oldApp ? '<div class="card old"><span>' + esc(t('oldApp')) + '</span><button class="btn" data-a="old">' + esc(t('removeOld')) + '</button></div>' : '') +
      '<div class="grid">' + tile('all', 'oneKey', true) + tile('ram', 'ram') + tile('cache', 'cache') + tile('junk', 'junk') + tile('speed', 'speed') +
      tile('bg', 'bg') + tile('disk', 'disk') + tile('apps', 'apps') + tile('hidden', 'hidden') + tile('power', 'power') + tile('deep', 'deep') + '</div>' +
      '<h3>' + esc(t('status')) + '</h3>' + statusHtml(i) + '<p class="muted">' + esc(t('tip')) + '</p>';
    bindActions();
    $$('[data-s]').forEach(function (b) { b.onclick = function () { if (!B || !B.openSettings(b.getAttribute('data-s'))) toast(t('notOpen')); }; });
    var f = $('[data-a="all"]'); if (f) f.focus();
  }

  function bindActions() {
    $$('[data-a]').forEach(function (b) {
      b.onclick = function () {
        var a = b.getAttribute('data-a');
        if (a === 'all') runAll(false);
        else if (a === 'ram') single('sRam', doRam);
        else if (a === 'cache') single('sCache', doCache);
        else if (a === 'junk') single('sJunk', doJunk);
        else if (a === 'speed') single('sSpeed', doSpeed);
        else if (a === 'bg') bgScreen();
        else if (a === 'disk') diskScreen();
        else if (a === 'apps') appsScreen(false);
        else if (a === 'hidden') hiddenScreen();
        else if (a === 'power') powerScreen();
        else if (a === 'deep') deep();
        else if (a === 'old') B && B.uninstall('tr.tvbakim');
        else if (a === 'later') { var c = $('.card.setup'); if (c) c.parentNode.removeChild(c); $('[data-a="all"]').focus(); }
        else if (a === 'never') { ls('tv.kur', '0'); home(); }
      };
    });
  }

  // ---------------------------------------------------------------- bakım adımları
  function doRam() { return later(function () { var r = B ? J(B.killBackground(), {}) : { count: 0, freed: 0 }; return { txt: t('rRam', { n: r.count || 0, mb: mb(r.freed) }), bytes: 0 }; }); }
  function doCache() { return later(function () { var r = B ? J(B.clearCaches(), {}) : { freed: 0 }; return { txt: t('rCache', { mb: mb(r.freed) }), bytes: r.freed || 0 }; }); }
  function doJunk() { return later(function () { var r = B ? J(B.cleanJunk(), {}) : { freed: 0, files: 0 }; return { txt: t('rJunk', { n: r.files || 0, mb: mb(r.freed) }), bytes: r.freed || 0 }; }); }
  function doSpeed() {
    return later(function () {
      var i = info(), hedef = animTarget();
      if (i.anim != null && Math.abs(i.anim - hedef) < 0.01) return { txt: t('rSpeedSkip'), bytes: 0 };
      var ok = B ? B.speedUp(hedef) : false;
      return { txt: ok ? t('rSpeedOk') : t('rSpeedNo'), bytes: 0, warn: !ok };
    });
  }

  function animTarget() { return ls('tv.anim') === '0' ? 0 : 0.5; }
  function allowed() { return J(ls('tv.serbest') || '[]', []); }
  function doBg() {
    return later(function () {
      if (!B) return { txt: t('rBgNo'), bytes: 0, warn: true };
      if (!info().adb) return { txt: t('rBgNo'), bytes: 0, warn: true };
      var ok = allowed(), list = J(B.bgApps(), []).filter(function (a) { return ok.indexOf(a.pkg) < 0; }).map(function (a) { return a.pkg; });
      if (!list.length) return { txt: t('rBgSkip'), bytes: 0 };
      var n = B.restrictBackground(JSON.stringify(list), true);
      return n < 0 ? { txt: t('rBgNo'), bytes: 0, warn: true } : { txt: t('rBg', { n: n }), bytes: 0 };
    });
  }

  function progressScreen(steps) {
    APP.screen = 'run';
    $('#main').innerHTML = '<div class="card run"><h2 id="runH">' + esc(t('running')) + '</h2><ol id="steps">' +
      steps.map(function (s, i) { return '<li data-i="' + i + '" class="wait"><b>' + esc(t(s)) + '</b><span></span></li>'; }).join('') +
      '</ol><p id="runTot" class="tot"></p><button class="btn pri" id="runOk" disabled>' + esc(t('ok')) + '</button></div>';
  }
  function stepState(i, cls, txt) { var li = $('#steps li[data-i="' + i + '"]'); if (!li) return; li.className = cls; $('span', li).textContent = txt || ''; }

  async function runSteps(keys, fns) {
    progressScreen(keys);
    var total = 0;
    for (var i = 0; i < fns.length; i++) {
      stepState(i, 'busy', '…');
      try { var r = await fns[i](); total += r.bytes || 0; stepState(i, r.warn ? 'warnx' : 'ok', r.txt); }
      catch (e) { stepState(i, 'warnx', String(e && e.message || e)); }
    }
    $('#runH').textContent = t('done');
    $('#runTot').textContent = t('total', { mb: mb(total) });
    var ok = $('#runOk'); ok.disabled = false; ok.onclick = home; ok.focus();
    ls('tv.son', String(Date.now()));
  }
  function single(k, f) { return runSteps([k], [f]); }
  function runAll() {
    var i = info(), keys = ['sRam', 'sCache', 'sJunk', 'sSpeed'], fns = [doRam, doCache, doJunk, doSpeed];
    if (i.adb) { keys.push('sBg'); fns.push(doBg); }
    return runSteps(keys, fns);
  }

  // ---------------------------------------------------------------- diğer ekranlar
  function sub(title, html) {
    APP.screen = 'sub';
    $('#main').innerHTML = '<div class="subh"><button class="btn" id="geriB">' + esc(t('back')) + '</button><h2>' + esc(title) + '</h2></div>' + html;
    $('#geriB').onclick = home;
  }
  function appsScreen(all) {
    var list = B ? J(B.apps(!!all), []) : [];
    list.sort(function (a, b) { return (b.size || 0) - (a.size || 0); });
    sub(t('apps'), '<div class="row"><button class="btn' + (all ? '' : ' pri') + '" id="aMine">' + esc(t('mine')) + '</button><button class="btn' + (all ? ' pri' : '') + '" id="aAll">' + esc(t('all')) + '</button></div>' +
      (list.length ? '<div class="list">' + list.map(function (a) {
        return '<div class="li"><div><b>' + esc(a.name) + '</b><small>' + esc(a.pkg) + ' · ' + mb(a.size) + '</small></div>' +
          '<button class="btn" data-info="' + esc(a.pkg) + '">' + esc(t('info')) + '</button><button class="btn" data-del="' + esc(a.pkg) + '">' + esc(t('remove')) + '</button></div>';
      }).join('') + '</div>' : '<p class="muted">' + esc(t('none')) + '</p>'));
    $('#aMine').onclick = function () { appsScreen(false); };
    $('#aAll').onclick = function () { appsScreen(true); };
    $$('[data-info]').forEach(function (b) { b.onclick = function () { B && B.appInfo(b.getAttribute('data-info')); }; });
    $$('[data-del]').forEach(function (b) { b.onclick = function () { B && B.uninstall(b.getAttribute('data-del')); }; });
    var f = $('#aMine'); if (f) f.focus();
  }
  function bgScreen() {
    var list = B ? J(B.bgApps(), []) : [], ok = allowed(), adb = info().adb;
    list.sort(function (a, b) { return (b.boot ? 1 : 0) - (a.boot ? 1 : 0) || a.name.localeCompare(b.name); });
    sub(t('bg'), '<p class="muted">' + esc(t('bgNote')) + (adb ? '' : ' ' + t('rBgNo')) + '</p>' +
      '<div class="row"><button class="btn pri" id="bgAll"' + (adb && list.length ? '' : ' disabled') + '>' + esc(t('restrictAll')) + '</button></div>' +
      (list.length ? '<div class="list">' + list.map(function (a) {
        var serbest = ok.indexOf(a.pkg) >= 0;
        return '<div class="li"><div><b>' + esc(a.name) + '</b><small>' + esc(a.pkg) + (a.boot ? ' · ' + esc(t('boot')) : '') + '</small></div>' +
          '<button class="btn' + (serbest ? '' : ' pri') + '" data-bg="' + esc(a.pkg) + '" data-on="' + (serbest ? '1' : '0') + '">' + esc(serbest ? t('restrict') : t('allow')) + '</button>' +
          '<button class="btn" data-stop="' + esc(a.pkg) + '">' + esc(t('stop')) + '</button></div>';
      }).join('') + '</div>' : '<p class="muted">' + esc(t('none')) + '</p>'));
    $('#bgAll').onclick = function () { single('sBg', doBg); };
    $$('[data-bg]').forEach(function (b) {
      b.onclick = function () {
        var pkg = b.getAttribute('data-bg'), kisitla = b.getAttribute('data-on') === '1', l = allowed();
        if (kisitla) { l = l.filter(function (p) { return p !== pkg; }); } else if (l.indexOf(pkg) < 0) l.push(pkg);
        ls('tv.serbest', JSON.stringify(l));
        if (B && adb) B.restrictBackground(JSON.stringify([pkg]), kisitla);
        bgScreen();
      };
    });
    $$('[data-stop]').forEach(function (b) { b.onclick = function () { B && B.forceStop(b.getAttribute('data-stop')); toast(t('stopped')); }; });
    var f = $('#bgAll'); if (f) f.focus();
  }
  function diskScreen() {
    sub(t('disk'), '<p class="muted" id="dScan">' + esc(t('scanning')) + '</p>');
    setTimeout(function () {
      var m = B ? J(B.storageMap(), { dirs: [], big: [] }) : { dirs: [], big: [] };
      var dirs = (m.dirs || []).sort(function (a, b) { return b.size - a.size; }).slice(0, 14);
      var big = (m.big || []).sort(function (a, b) { return (b.apk ? 1 : 0) - (a.apk ? 1 : 0) || b.size - a.size; });
      var apks = big.filter(function (f) { return f.apk; });
      var mx = dirs.length ? dirs[0].size : 1;
      sub(t('disk'), (m.total ? '<p class="tot">' + esc(gb(m.total - m.free)) + ' ' + esc(t('used')) + ' ' + t('of') + ' ' + esc(gb(m.total)) + '</p>' : '') +
        '<h3>' + esc(t('folders')) + '</h3><div class="list">' + dirs.map(function (d) {
          return '<div class="li"><div><b>' + esc(d.path) + '</b><small>' + mb(d.size) + '</small><i class="pbar"><i style="width:' + Math.max(1, Math.round(d.size / mx * 100)) + '%"></i></i></div>' +
            (d.pkg ? '<button class="btn" data-info="' + esc(d.pkg) + '">' + esc(t('info')) + '</button>' : '') + '</div>';
        }).join('') + '</div>' +
        '<h3>' + esc(t('bigFiles')) + '</h3>' + (apks.length ? '<div class="row"><button class="btn pri" id="delApk">' + esc(t('delAll')) + ' (' + apks.length + ', ' + mb(apks.reduce(function (a, f) { return a + f.size; }, 0)) + ')</button></div>' : '') +
        (big.length ? '<div class="list">' + big.map(function (f) {
          return '<div class="li"><div><b>' + esc(f.name) + (f.apk ? ' <small>· ' + esc(t('apkTag')) + '</small>' : '') + '</b><small>' + esc(f.path) + ' · ' + mb(f.size) + '</small></div>' +
            '<button class="btn" data-del-f="' + esc(f.path) + '">' + esc(t('del')) + '</button></div>';
        }).join('') + '</div>' : '<p class="muted">' + esc(t('noneBig')) + '</p>'));
      function sil(paths) { var r = B ? J(B.deleteFiles(JSON.stringify(paths)), {}) : {}; toast(t('rDel', { n: r.files || 0, mb: mb(r.freed) })); diskScreen(); }
      var da = $('#delApk'); if (da) da.onclick = function () { sil(apks.map(function (f) { return f.path; })); };
      $$('[data-del-f]').forEach(function (b) { b.onclick = function () { sil([b.getAttribute('data-del-f')]); }; });
      $$('[data-info]').forEach(function (b) { b.onclick = function () { B && B.appInfo(b.getAttribute('data-info')); }; });
      var f = $('#delApk') || $('[data-del-f]') || $('#geriB'); if (f) f.focus();
    }, 50);
  }
  function hiddenScreen() {
    var items = [['all', 'allSet'], ['dev', 'dev'], ['about', 'about'], ['apps', 'appsSet'], ['storage', 'store'], ['display', 'disp'], ['wifi', 'wifi'], ['date', 'date'], ['lang', 'langSet']];
    sub(t('hidden'), '<div class="grid">' + items.map(function (x) { return '<button class="tile" data-s="' + x[0] + '"><b>' + esc(t(x[1])) + '</b></button>'; }).join('') + '</div>');
    $$('[data-s]').forEach(function (b) { b.onclick = function () { if (!B || !B.openSettings(b.getAttribute('data-s'))) toast(t('notOpen')); }; });
    var f = $('[data-s]'); if (f) f.focus();
  }
  function powerScreen() {
    var i = info();
    sub(t('power'), '<div class="card"><p>' + esc(i.secure ? t('powerOk') : t('powerHow')) + '</p><div class="row">' +
      '<button class="btn" data-s="about">' + esc(t('about')) + '</button><button class="btn" data-s="dev">' + esc(t('dev')) + '</button>' +
      '<button class="btn pri" id="pGo">' + esc(t('power')) + '</button></div><p id="pOut" class="tot"></p></div>');
    $$('[data-s]').forEach(function (b) { b.onclick = function () { if (!B || !B.openSettings(b.getAttribute('data-s'))) toast(t('notOpen')); }; });
    $('#pGo').onclick = function () {
      if (!B) return;
      $('#pOut').textContent = t('powerWait');
      window.__guc = function (ok, secure) { $('#pOut').textContent = ok ? t('powerOk') : t('powerNo'); if (ok) ls('tv.guc', '1'); };
      B.powerMode('__guc');
    };
    $('#pGo').focus();
  }
  function deep() {
    var i = info();
    if (!i.adb) { toast(t('deepNo')); return powerScreen(); }
    progressScreen(['sDeep']); stepState(0, 'busy', '…');
    window.__derin = function (ok) { stepState(0, ok ? 'ok' : 'warnx', ok ? t('deepOk') : t('deepNo')); $('#runH').textContent = t('done'); var b = $('#runOk'); b.disabled = false; b.onclick = home; b.focus(); };
    B.optimize('__derin');
  }

  function settingsScreen() {
    var an = animTarget();
    sub(t('settings'), '<div class="card"><label class="chk"><input type="checkbox" id="sAuto"' + (ls('tv.oto') !== '0' ? ' checked' : '') + '> ' + esc(t('autoRun')) + '</label></div>' +
      '<div class="card"><h3>' + esc(t('animSet')) + '</h3><div class="row"><button class="btn' + (an === 0.5 ? ' pri' : '') + '" data-anim="0.5">' + esc(t('animHalf')) + '</button><button class="btn' + (an === 0 ? ' pri' : '') + '" data-anim="0">' + esc(t('animOff')) + '</button></div></div>' +
      '<div class="card"><h3>' + esc(t('update')) + '</h3><p id="upSt" class="muted">v' + esc(APP.version) + '</p><button class="btn pri" id="sUp">' + esc(t('update')) + '</button></div>' +
      '<div id="ayarSon"></div>');
    $('#sAuto').onchange = function (e) { ls('tv.oto', e.target.checked ? '1' : '0'); };
    $$('[data-anim]').forEach(function (b) { b.onclick = function () { ls('tv.anim', b.getAttribute('data-anim') === '0' ? '0' : '0.5'); var ok = B ? B.speedUp(animTarget()) : false; toast(ok ? t('animApplied') : t('rSpeedNo')); settingsScreen(); }; });
    $('#sUp').onclick = function () { checkUpdate(true); };
    $('#sAuto').focus();
  }

  // ---------------------------------------------------------------- güncelleme (GitHub)
  async function checkUpdate(loud) {
    var st = $('#upSt');
    if (loud) { toast(t('upChecking')); if (st) st.textContent = t('upChecking'); }
    try {
      var r = await fetch(CH + 'surum.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var m = await r.json();
      var cur = info().code || 0;
      if ((m.code || 0) > cur || (!B && m.version !== APP.version)) {
        APP.found = m; $('#updDot').hidden = false;
        var bar = $('#updBar');
        bar.innerHTML = '<span>' + esc(t('upNew', { v: m.version })) + '</span> <span class="muted">' + esc((m.notes && (m.notes[APP.lang] || m.notes.tr)) || '') + '</span> <button class="btn pri" id="ubGo">' + esc(t('upNow')) + '</button>';
        bar.hidden = false; $('#ubGo').onclick = APP.updateNow;
        if (st) st.textContent = t('upNew', { v: m.version });
        if (loud) APP.updateNow();
      } else { if (loud) toast(t('upToDate', { v: APP.version })); if (st) st.textContent = t('upToDate', { v: APP.version }); }
    } catch (e) { if (loud) toast(t('upFail', { e: e.message })); if (st) st.textContent = t('upFail', { e: e.message }); }
  }
  APP.updateNow = function () {
    var m = APP.found; if (!m) return checkUpdate(true);
    if (!B) return;
    var bar = $('#updBar'); bar.hidden = false;
    var samples = [];
    window.__upd = function (got, total, done, err) {
      if (err) { bar.textContent = t('upFail', { e: err }); return; }
      var now = Date.now(); samples.push({ t: now, b: got }); while (samples.length > 2 && now - samples[0].t > 3000) samples.shift();
      var sec = (now - samples[0].t) / 1000, hiz = sec > 0.25 ? (got - samples[0].b) / sec : 0;
      var p = { inen: got, toplam: total, yuzde: total ? got / total * 100 : 0, kalan: total ? total - got : 0, hiz: hiz, bitti: done };
      bar.innerHTML = '<span>' + esc(t('upNew', { v: m.version })) + '</span> <b>' + esc(IndirmeIlerleme.yazi(p, APP.lang)) + '</b>' +
        '<i class="pbar"><i style="width:' + Math.floor(p.yuzde) + '%"></i></i>';
      if (done) toast(t('upInstall'));
    };
    B.downloadUpdate(CH + m.apk, m.size || 0, m.sha256 || '', '__upd');
  };

  // ---------------------------------------------------------------- açılış
  window.__adbHazir = function (ok) {
    if (!ok) return;
    var ilk = ls('tv.guc') !== '1'; ls('tv.guc', '1'); toast(t('autoAdb'));
    if (APP.screen === 'home' && ilk) runSteps(['sCache', 'sSpeed', 'sBg'], [doCache, doSpeed, doBg]).then(function () { toast(t('autoDone')); });
    else if (APP.screen === 'home') home();
  };
  window.geri = function () { if (APP.screen !== 'home' && APP.screen !== 'run') home(); };
  function start() {
    var i = info();
    APP.version = i.version || APP.version;
    $('#ver').textContent = 'v' + APP.version;
    applyLang();
    $('#dil').onchange = function (e) { APP.lang = e.target.value; ls('tv.dil', APP.lang); applyLang(); APP.screen === 'sub' && $('#ayarSon') ? settingsScreen() : home(); };
    $('#bUpd').onclick = function () { APP.found ? APP.updateNow() : checkUpdate(true); };
    $('#bSet').onclick = settingsScreen;
    $('#bMin').onclick = function () { B && B.minimize(); };
    $('#bExit').onclick = function () { B ? B.exit() : window.close(); };
    // İlk açılış ya da ayar açıksa: bakım kendiliğinden yapılır (USB'den kurup açınca her şey hallolur)
    if (B && ls('tv.oto') !== '0') runAll(); else home();
    setTimeout(function () { checkUpdate(false); }, 2500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
