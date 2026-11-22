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

## Yeni sürüm
`ANAHTAR_KLASORU=<C:\Claude Programlarım\_Anahtarlar\TVBakim kopyası> araclar/derle.sh 1.0.1 2 "tr notu" "en note" "ar"`
(versionCode her sürümde artar) → `git add -A && git commit && git push`.
