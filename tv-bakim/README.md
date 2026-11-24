# TV Bakım (1.1.0'dan beri yeniden yazıldı)

Android TV / TV kutusu bakım uygulaması (`com.departures.tvbakim`). USB bellekten APK ile kurulur; açılışta bakımı kendiliğinden yapar.
Normal (root'suz) bir uygulamanın yapabildiği her şey — dürüstçe:

- **Genel bakış:** depolama, bellek (bilgi; sahte "RAM hızlandırma" yok), animasyon ölçeği, açık kalma süresi, kurulum durumu.
- **Temizlik:** kendi önbelleği; iç bellekte gereksiz dosya taraması (kurulum .apk'ları, küçük resim önbelleği, yarım indirmeler/geçici,
  .log, LOST.DIR, 300 MB+ büyük dosyalar — büyükler kendiliğinden seçilmez). Seçilenler onayla **çöp kutusuna** taşınır
  (`/sdcard/TVBakim-CopKutusu`, `index.tsv`), geri alınabilir; kalıcı silme yalnız çöp kutusunu boşaltırken, Android'in kendi onay
  penceresinden sonra. Diğer uygulamaların önbelleği için sistemin uygulama ekranı açılır (Android başka türlüsüne izin vermez).
  İsteğe bağlı (varsayılan kapalı): "kesin gereksizleri" (küçük resim, geçici, günlük, LOST.DIR) açılışta sormadan çöp kutusuna taşı.
- **Uygulamalar:** başlatıcıda görünen uygulamalar, boyutları (Kullanım erişimi verilirse veri + önbellek, StorageStatsManager),
  Aç / Ayrıntılar (sistem ekranı) / Kaldır (sistemin onay penceresi).
- **Ekran hızı:** animasyon ölçeklerini gösterir, Geliştirici seçeneklerini açar ve 0.5x adımlarını anlatır (ayarı kullanıcı yapar).
- **Ağ testi:** bağlantı türü, DNS, gecikme, indirme hızı (en çok 25 MB).
- **Kurulum:** dosya erişimi, kullanım erişimi, ekran hızı, güncelleme kurma izni, eski `tr.tvbakim`, açık kalmış ADB uyarısı.
- Ortak çekirdek (Falcon görünümü, şemalar — `klasik` = 1.0.x renkleri, tr/en/ar RTL, yazı boyutu, ilk açılış rehberi, neler yeni,
  duyurular, çökme raporu, Kullanım Limitleri "hizmet yok", Ayarlar'ın EN SONUNDA Admin ile iletişim). Kumanda: yön tuşları + OK + Geri.

**Kaldırılanlar (güvenlik):** 1.0.x TV'nin kendi ADB'sine (127.0.0.1:5555) bağlanıp `WRITE_SECURE_SETTINGS` alıyor, geliştirici
seçeneklerini/ADB'yi açık tutuyor, JS'ten herhangi bir yolu silebiliyordu. 1.1.0'da bunların hiçbiri yok; QUERY_ALL_PACKAGES,
KILL_BACKGROUND_PROCESSES, file:// evrensel erişim ve şifresiz trafik de yok. JS köprüsü dar (bkz. `TvBridge.java`, test listesi).

## Yapı
`www/` arayüz (düz JS; `js/bakim.js` saf mantık, `js/dpad.js` kumanda, `js/kabuk.js` çekirdek yapıştırıcısı, `js/app.js` ekranlar,
`js/metinler.js` tr/en/ar, `js/haberler.js` neler yeni), `www/cekirdek/` ortak çekirdek kopyası (`cekirdek/VERSION`),
`android/` kabuk (Gradle'sız): `MainActivity` (https://tvbakim.local kökeni — DEĞİŞMEZ; 1.0.x ayarları `assets/tasi.html` ile bir kez
taşınır), `TvBridge` (window.TV), `FcBridge` (window.AndroidBridge: güncelleme), `Tarama` + `CopKutusu` (saf Java, JVM testli),
`com/departuresmil/ortak/` (FcDelta + ApkPatchInstaller, androidx'siz).

## Sürüm ve yayın
- Sürüm X.Y.Z, tek kaynak `package.json`. Önce `www/js/haberler.js` en üstüne not (tr/en/ar), sonra `node araclar/surum.js X.Y.Z`
  (`www/js/surum.js`, `release-notes.json`). versionCode = X·10000 + Y·100 + Z (1.0.2 = 3 idi).
- **Sürümler `departures-mil/duyurular` deposunun Releases'inde** (ayrı depo yok; bu depoda başka program release'i yapılmaz).
  Etiket `vX.Y.Z`, `latest.json` → `"app": "tv-bakim"`, kanal `android` (asset `TV-Bakim-X.Y.Z-android.apk` + son 5 sürümden FCD1 yamaları).
  Uygulama: kurulu APK + yama → yeni APK (SHA-256), olmazsa tam APK; kurulmadan önce paket adı + imza denetlenir.
- CI `.github/workflows/tv-bakim.yml`: test → APK (imzasız derleme her zaman; imzalı yalnız secret'larla, sertifika 1.0.x ile aynı olmalı)
  → release (yalnız main'de workflow_dispatch) → eski kanal köprüsü (`araclar/eski-kanal.js`: `guncelleme/surum.json` + APK).
  Secret'lar: `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASS`, [`ANDROID_KEY_PASS`], [`ANDROID_KEY_ALIAS`]
  (anahtar: `C:\Claude Programlarım\_Anahtarlar\TVBakim\tvbakim.jks` + `sifre.txt`; depoya girmez). Yoksa android yayını atlanır.
- Yayın: `gh api -X POST repos/departures-mil/duyurular/actions/workflows/tv-bakim.yml/dispatches -f ref=main`

## Test
`npm test` (tv-bakim/ içinde): mantık, çeviriler, sürüm, güvenlik kuralları, Java (JVM testi + android.jar derlemesi; `ANDROID_TOOLS`
ya da `ANDROID_HOME`), arayüz (`PLAYWRIGHT_CORE=…/playwright-core PLAYWRIGHT_BROWSERS_PATH=…`). Ekran görüntüleri:
`node araclar/ekran.js <klasör>` (960×540 CSS × 2 = 1920×1080). APK: `ANDROID_TOOLS=… APK_IMZASIZ=1 bash araclar/apk.sh`.

## Sürüm geçmişi
- **1.1.0:** yeniden yazım (yukarıda). 1.0.x kurulumları eski kanaldan (`guncelleme/surum.json`) yeni APK'ya geçer.
- **1.0.2 / 1.0.1 / 1.0.0:** ADB tabanlı eski sürümler.
