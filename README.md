# Duyurular

🌐 **İndirme sitesi (TR · EN · AR):** https://departures-mil.github.io/duyurular/ (kaynak `site/`, veriler GitHub Releases'ten 15 dakikada bir)

📥 **Bütün programların indirme linkleri:** [INDIRME-LINKLERI.md](INDIRME-LINKLERI.md) (15 dakikada bir kendiliğinden yenilenir)

Bütün programlara giden admin duyuruları. Programlar şu dosyayı okur (30 dakikada bir ve açılışta):

`https://raw.githubusercontent.com/departures-mil/duyurular/main/duyurular.json`

- `panel/Duyuru-Paneli.html` — admin paneli (geliştiricinin bilgisayarında).
- `istemci/duyuru.js` — web arayüzlü programlara eklenen ortak istemci.

## Duyuru biçimi
```json
{
  "id": "20261122070000-ab12",
  "tarih": "2026-11-22T07:00:00Z",
  "baslik": { "tr": "...", "en": "...", "ar": "..." },
  "metin":  { "tr": "...", "en": "...", "ar": "..." },
  "hedef": ["*"],                 // ya da ["kitaplik","mahzen"]
  "onem": "normal",               // ya da "onemli"
  "aktif": true,
  "link": "https://...",          // isteğe bağlı
  "altSurum": "1.0.0",            // isteğe bağlı: bu sürüm ve üstü görür
  "ustSurum": "1.0.4",            // isteğe bağlı: bu sürüm ve altı görür
  "baslangic": "...", "bitis": "...",
  "guncellemeDugmesi": true       // duyuruda "Şimdi güncelle" düğmesi
}
```
Program kimlikleri: falcon-ofis, kitaplik, mahzen, bereket-defter, organizer, aile-ajandasi, ofis-gunlugu, sinav-hazirlama,
cv-maker, merkezi-servis, baski-hesabi, comm-calc, kalori-hesaplayici, desktop-duzen, ing-mufredat, iha-mufredat, tv-bakim.

`tv-bakim/` — TV Bakım uygulamasının kaynağı ve güncelleme kanalı (ayrı depo açılamadığı için burada).
