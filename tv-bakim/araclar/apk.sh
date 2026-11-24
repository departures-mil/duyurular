#!/usr/bin/env bash
# TV Bakım APK — Gradle'sız: aapt2 + javac + d8 + zipalign + apksigner (Kitaplık / Ajandam ile aynı yol).
#   bash araclar/apk.sh            → cikti/TV-Bakim-<sürüm>.apk  (sürüm ve versionCode araclar/surum.js'ten; uzunluk sınırı yok)
# Android SDK: $ANDROID_TOOLS (bt/<sürüm>/, pf/android-NN/) ya da $ANDROID_HOME / $ANDROID_SDK_ROOT (build-tools/, platforms/).
# İmza: ANDROID_KEYSTORE (dosya yolu) + ANDROID_KEYSTORE_PASS (+ ANDROID_KEY_ALIAS [yoksa keystore'daki ilk takma ad], ANDROID_KEY_PASS).
#   Anahtar depoda YOK: C:\Claude Programlarım\_Anahtarlar\TVBakim\tvbakim.jks (+ sifre.txt). Tüm sürümler AYNI anahtarla
#   imzalanmalı; başka anahtarla imzalanan APK kurulu TV Bakım'ın üstüne kurulmaz.
#   Anahtar yoksa APK_IMZASIZ=1 ile yalnız derleme denenir (cikti/TV-Bakim-<sürüm>-imzasiz.apk, CI derleme denetimi).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SURUM="$(node -p "require('$ROOT/araclar/surum.js').version()")"
KOD="$(node -p "require('$ROOT/araclar/surum.js').versionCode('$SURUM')")"

if [ -n "${ANDROID_TOOLS:-}" ]; then
  BT="$(ls -d "$ANDROID_TOOLS"/bt/*/ | sort -V | tail -1)"; PF="$ANDROID_TOOLS/pf"
else
  SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"; [ -n "$SDK" ] || { echo "Android SDK yok (ANDROID_TOOLS / ANDROID_HOME)"; exit 2; }
  BT="$(ls -d "$SDK"/build-tools/*/ | sort -V | tail -1)"; PF="$SDK/platforms"
fi
JAR="$PF/android-35/android.jar"; [ -f "$JAR" ] || JAR="$(ls "$PF"/android-*/android.jar | sort -V | tail -1)"
echo "build-tools: $BT  platform: $JAR  sürüm: $SURUM ($KOD)"

B="$ROOT/.derleme/android"; OUT="$ROOT/cikti"
rm -rf "$B"; mkdir -p "$B/assets" "$B/gen" "$B/classes" "$OUT"
cp -r "$ROOT/www" "$B/assets/www"
cp "$ROOT"/android/assets/* "$B/assets/"
sed -e "s/@VERSION_CODE@/$KOD/" -e "s/@VERSION_NAME@/$SURUM/" "$ROOT/android/AndroidManifest.xml" > "$B/AndroidManifest.xml"
grep -q '@VERSION' "$B/AndroidManifest.xml" && { echo "manifest sürüm alanı yazılamadı"; exit 4; }
"$BT/aapt2" compile --dir "$ROOT/android/res" -o "$B/res.zip"
"$BT/aapt2" link -o "$B/base.apk" -I "$JAR" --manifest "$B/AndroidManifest.xml" -R "$B/res.zip" \
  --java "$B/gen" -A "$B/assets" --min-sdk-version 21 --target-sdk-version 34 --auto-add-overlay \
  -0 woff2 -0 png
javac -nowarn --release 8 -encoding UTF-8 -Xlint:-options -classpath "$JAR" -d "$B/classes" \
  $(find "$ROOT/android/src" "$B/gen" -name '*.java') 2>&1 | grep -v '^warning\|^Note:\|^Picked up\|^[0-9]* warning' || true
for c in com/departures/tvbakim/MainActivity com/departures/tvbakim/TvBridge com/departures/tvbakim/FcBridge com/departuresmil/ortak/ApkPatchInstaller; do
  [ -f "$B/classes/$c.class" ] || { echo "derlenemedi: $c"; exit 5; }
done
"$BT/d8" --release --min-api 21 --lib "$JAR" --output "$B" $(find "$B/classes" -name '*.class')
(cd "$B" && cp base.apk unsigned.apk && zip -q -j -X unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 "$B/unsigned.apk" "$B/aligned.apk"

KS="${ANDROID_KEYSTORE:-}"; PW="${ANDROID_KEYSTORE_PASS:-}"; AL="${ANDROID_KEY_ALIAS:-}"
if [ -z "$KS" ] && [ -n "${ANAHTAR_KLASORU:-}" ]; then KS="$ANAHTAR_KLASORU/tvbakim.jks"; PW="$(tr -d '\r\n' < "$ANAHTAR_KLASORU/sifre.txt")"; fi
if [ -z "$KS" ]; then
  [ -n "${APK_IMZASIZ:-}" ] || { echo "İmza anahtarı yok (ANDROID_KEYSTORE / ANAHTAR_KLASORU)"; exit 3; }
  cp "$B/aligned.apk" "$OUT/TV-Bakim-$SURUM-imzasiz.apk"; echo "İMZASIZ: $OUT/TV-Bakim-$SURUM-imzasiz.apk"; exit 0
fi
if [ -z "$AL" ]; then
  AL="$(keytool -list -keystore "$KS" -storepass "$PW" 2>/dev/null | grep -E 'PrivateKeyEntry' | head -1 | cut -d, -f1)"
  [ -n "$AL" ] || AL=tvbakim
fi
"$BT/apksigner" sign --ks "$KS" --ks-key-alias "$AL" --ks-pass "pass:$PW" --key-pass "pass:${ANDROID_KEY_PASS:-$PW}" \
  --min-sdk-version 21 --out "$OUT/TV-Bakim-$SURUM.apk" "$B/aligned.apk"
"$BT/apksigner" verify --min-sdk-version 21 "$OUT/TV-Bakim-$SURUM.apk"
rm -f "$OUT/TV-Bakim-$SURUM.apk.idsig"
echo "Tamam: $OUT/TV-Bakim-$SURUM.apk (versionName $SURUM, versionCode $KOD)"
