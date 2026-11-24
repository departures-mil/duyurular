# TV Bakım (duyurular/tv-bakim)

Ayrıntı: README.md. Kurallar (kullanıcı):
- Yazışma Türkçe; arayüz tr/en/ar (ar RTL). Yeni metin `www/js/metinler.js` içine üç dilde (test denetler).
- Sürüm X.Y.Z / etiket vX.Y.Z; `www/js/haberler.js` en üste not → `node araclar/surum.js X.Y.Z`. Release'ler BU depoda (duyurular), CI `tv-bakim.yml`.
- Paket adı `com.departures.tvbakim`, imza anahtarı (tvbakim.jks) ve köken `https://tvbakim.local` DEĞİŞMEZ.
- Veri kaybı yok: dosyalar çöp kutusuna taşınır; kalıcı silme yalnız yerel onay penceresiyle. ADB / WRITE_SECURE_SETTINGS / ayar değiştirme YOK.
- Ortak çekirdek kopyası `www/cekirdek` (commit `cekirdek/VERSION`); ortak-cekirdek deposunu buradan değiştirme.
- Kullanıcıya APK dosyası gönderme; güncelleme uygulamanın içinden.
