# TV Bakım (v1.0.0'dan itibaren yeni sürüm)

Android TV / TV kutusu için bakım uygulaması. USB bellekten APK kurulup açıldığında bakımı **kendiliğinden** yapar:
arka plan uygulamalarını kapatır (RAM), önbellekleri siler, gereksiz dosyaları (geçici/günlük/küçük resim, LOST.DIR,
uygulama dış önbellekleri, boş klasörler) temizler, menü animasyonlarını 0.5x yapar. Fotoğraf, video ve belgelere dokunmaz.

- **Tam Yetki (bir kez):** TV'de "Ağ hata ayıklaması" açıksa uygulama TV'nin kendi ADB'sine (127.0.0.1:5555) bağlanır,
  kendine `WRITE_SECURE_SETTINGS` verir; bundan sonra bütün uygulamaların önbelleği topluca silinir (`pm trim-caches`),
  hızlandırma ve "Derin optimizasyon" (`cmd package bg-dexopt-job`) kendiliğinden yapılır.
- Türkçe / English / العربية; sağ üstte Güncelle, Ayarlar, Küçült, Kapat. Ayarlar'ın sonunda Kullanım Limitleri ve
  "Admin ile iletişime geç". Admin duyuruları (`tv-bakim` kimliği) gelir.
- Paket adı `com.departures.tvbakim` (eski `tr.tvbakim` ile yan yana kurulur; uygulama eskisini kaldırmayı önerir).

## Güncelleme kanalı
`tv-bakim/guncelleme/surum.json` + `TV-Bakim-<sürüm>.apk`. Uygulama açılışta bakar; "Güncelle" APK'yı yüzde, MB ve hızla
indirir, sha256 ile doğrular ve kurulum penceresini açar.

## Sürüm geçmişi
- **1.0.1:** Arka Plan Kısıtlama (kendiliğinden başlayan uygulamaların arka planı kesilir, istisna listesi), Depolama Analizi
  (klasör boyutları, 200 MB+ dosyalar, bırakılmış .apk'ları tek tuşla silme), Derin Optimizasyona `sm fstrim` (TRIM),
  açılışta kendiliğinden Tam Yetki (ağ hata ayıklaması açıksa), animasyonları tamamen kapatma seçeneği, uygulama "Durdur".
- **1.0.0:** İlk sürüm.

## Yeni sürüm
Bulutta (aapt2/Gradle olmadan): `ANAHTAR_KLASORU=<tvbakim.jks + sifre.txt klasörü> ARACLAR=<android-all.jar, dx.jar, uber.jar klasörü>
python3 araclar/paketle.py 1.0.2 3 "tr notu" "en note" "ar"` — önceki APK'daki ikili manifest sürüm alanları yamalanır
(sürüm adı 5 karakter kalmalı: 1.0.9'dan sonra 1.1.0), `www` ve Java yeniden paketlenir, uber-apk-signer ile v1+v2+v3 imzalanır.
Araçlar: Maven Central `org.robolectric:android-all:14-robolectric-10818077`, `com.jakewharton.android.repackaged:dalvik-dx:16.0.1`;
GitHub `patrickfav/uber-apk-signer` v1.3.0. Manifest/res değişecekse `araclar/derle.sh` (aapt2 ile) kullanılır.
versionCode her sürümde artar → `git add -A && git commit && git push`.
