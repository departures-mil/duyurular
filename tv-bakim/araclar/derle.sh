#!/usr/bin/env bash
# TV Bakım APK derlemesi (Gradle gerekmez).
#   araclar/derle.sh <sürüm> <versionCode>      ör. araclar/derle.sh 1.0.1 2
# Araçlar: ANDROID_TOOLS (varsayılan /home/claude/tools) altında bt/android-15 (build-tools 35) ve pf/android-35.
#   indir: https://dl.google.com/android/repository/build-tools_r35_linux.zip, platform-35_r02.zip
# İmza anahtarı depoda DEĞİL: C:\Claude Programlarım\_Anahtarlar\TVBakim (tvbakim.jks + sifre.txt) → ANAHTAR_KLASORU
# Çıktı: guncelleme/TV-Bakim-<sürüm>.apk + guncelleme/surum.json
set -euo pipefail
SURUM="$1"; KOD="$2"; NOT_TR="${3:-}"; NOT_EN="${4:-$NOT_TR}"; NOT_AR="${5:-$NOT_TR}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK="${ANDROID_TOOLS:-/home/claude/tools}"
BT="$(ls -d "$SDK"/bt/*/ | head -1)"; JAR="$SDK/pf/android-35/android.jar"
K="${ANAHTAR_KLASORU:?anahtar klasörü gerekli}"
B="$(mktemp -d)"; trap 'rm -rf "$B"' EXIT
mkdir -p "$B/assets" "$B/gen" "$B/cls"
cp -r "$ROOT/www" "$B/assets/www"
sed -e "s/@VERSION_CODE@/$KOD/" -e "s/@VERSION_NAME@/$SURUM/" "$ROOT/android/AndroidManifest.xml" > "$B/AndroidManifest.xml"
"$BT/aapt2" compile --dir "$ROOT/android/res" -o "$B/res.zip"
"$BT/aapt2" link -o "$B/base.apk" -I "$JAR" --manifest "$B/AndroidManifest.xml" -R "$B/res.zip" \
  --java "$B/gen" -A "$B/assets" --min-sdk-version 21 --target-sdk-version 29 --auto-add-overlay
javac -nowarn --release 8 -encoding UTF-8 -classpath "$JAR" -d "$B/cls" $(find "$ROOT/android/src" "$B/gen" -name '*.java') 2>&1 | grep -v "^Picked up\|^warning\|^Note:\|^1 warning" || true
"$BT/d8" --release --min-api 21 --lib "$JAR" --output "$B" $(find "$B/cls" -name '*.class')
(cd "$B" && cp base.apk unsigned.apk && zip -q -j unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 "$B/unsigned.apk" "$B/aligned.apk"
PW="$(tr -d '\r\n' < "$K/sifre.txt")"
OUT="$ROOT/guncelleme/TV-Bakim-$SURUM.apk"
rm -f "$ROOT"/guncelleme/TV-Bakim-*.apk
"$BT/apksigner" sign --ks "$K/tvbakim.jks" --ks-key-alias tvbakim --ks-pass "pass:$PW" --key-pass "pass:$PW" --out "$OUT" "$B/aligned.apk"
"$BT/apksigner" verify "$OUT"
python3 - "$OUT" "$SURUM" "$KOD" "$NOT_TR" "$NOT_EN" "$NOT_AR" <<'PY'
import hashlib, json, os, sys, datetime
f, v, k, tr, en, ar = sys.argv[1:7]
b = open(f, 'rb').read()
m = {'version': v, 'code': int(k), 'apk': os.path.basename(f), 'size': len(b), 'sha256': hashlib.sha256(b).hexdigest(),
     'date': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'notes': {'tr': tr, 'en': en, 'ar': ar}}
json.dump(m, open(os.path.join(os.path.dirname(f), 'surum.json'), 'w'), ensure_ascii=False, indent=1)
print('hazır', v, len(b), 'bayt')
PY
