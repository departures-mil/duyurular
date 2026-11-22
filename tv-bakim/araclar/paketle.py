#!/usr/bin/env python3
"""TV Bakım APK paketleme — aapt2/Gradle gerekmeden (bulutta çalışır).
   python3 araclar/paketle.py <sürüm> <versionCode> "<tr notu>" "<en note>" "<ar>"
Gereken: ARACLAR klasöründe android-all.jar (Maven Central: org.robolectric:android-all), dx.jar
(com.jakewharton.android.repackaged:dalvik-dx), uber.jar (uber-apk-signer, GitHub sürümleri); ANAHTAR_KLASORU (tvbakim.jks + sifre.txt).
Yöntem: önceki APK'daki ikili AndroidManifest.xml + resources.arsc + res/ aynen alınır (yalnız sürüm alanları yamalanır);
assets/www ve classes.dex yeniden üretilir; apksig ile v1+v2+v3 imzalanır."""
import hashlib, json, os, struct, subprocess, sys, zipfile, glob, shutil, datetime, tempfile

SURUM, KOD = sys.argv[1], int(sys.argv[2])
NOT = (sys.argv[3:6] + [''] * 3)[:3]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AR = os.environ.get('ARACLAR', '/tmp/claude-0/sdk')
K = os.environ['ANAHTAR_KLASORU']
G = os.path.join(ROOT, 'guncelleme')
base = sorted(glob.glob(os.path.join(G, 'TV-Bakim-*.apk')))[-1]
print('şablon APK:', os.path.basename(base))

def patch_manifest(d):
    """İkili AXML: manifest öğesindeki versionCode/versionName yamalanır (versionName aynı uzunlukta olmalı: UTF-16)."""
    d = bytearray(d); off = 8; strs = []
    while off < len(d):
        ct, chs, csz = struct.unpack('<HHI', d[off:off + 8])
        if ct == 0x0001:
            n, ss, flags, so, sto = struct.unpack('<IIIII', d[off + 8:off + 28])
            assert not (flags & 0x100), 'UTF-8 dizi havuzu beklenmiyordu'
            offs = struct.unpack('<%dI' % n, d[off + 28:off + 28 + 4 * n])
            for o in offs:
                p = off + so + o
                l = struct.unpack('<H', d[p:p + 2])[0]; p += 2
                strs.append((d[p:p + 2 * l].decode('utf-16-le'), p, l))
        elif ct == 0x0102:
            name = struct.unpack('<I', d[off + 20:off + 24])[0]
            if strs[name][0] == 'manifest':
                acnt = struct.unpack('<H', d[off + 28:off + 30])[0]
                for i in range(acnt):
                    a = off + 36 + i * 20
                    an, raw, typ = struct.unpack('<I', d[a + 4:a + 8])[0], struct.unpack('<I', d[a + 8:a + 12])[0], d[a + 15]
                    if strs[an][0] == 'versionCode':
                        d[a + 16:a + 20] = struct.pack('<I', KOD)
                    elif strs[an][0] == 'versionName':
                        s, p, l = strs[raw]
                        assert len(SURUM) == l, 'versionName uzunluğu %d karakter olmalı' % l
                        d[p:p + 2 * l] = SURUM.encode('utf-16-le')
                return bytes(d)
        off += csz
    raise SystemExit('manifest bulunamadı')

B = tempfile.mkdtemp()
cls = os.path.join(B, 'cls'); os.makedirs(cls)
src = glob.glob(os.path.join(ROOT, 'android/src/**/*.java'), recursive=True)
subprocess.run(['javac', '-nowarn', '--release', '8', '-encoding', 'UTF-8', '-classpath', os.path.join(AR, 'android-all.jar'), '-d', cls] + src, check=True)
subprocess.run(['java', '-cp', os.path.join(AR, 'dx.jar'), 'com.android.dx.command.Main', '--dex', '--min-sdk-version=21', '--output=' + os.path.join(B, 'classes.dex'), cls], check=True)
# R sınıfı: şablon APK'daki ile aynı kimlikler (res değişmedi) — kaynak kodda R kullanılmıyor.
unsigned = os.path.join(B, 'unsigned.apk')
with zipfile.ZipFile(base) as zin, zipfile.ZipFile(unsigned, 'w') as zout:
    for it in zin.infolist():
        n = it.filename
        if n.startswith('META-INF/') or n.startswith('assets/') or n == 'classes.dex': continue
        data = zin.read(n)
        if n == 'AndroidManifest.xml': data = patch_manifest(data)
        zi = zipfile.ZipInfo(n, (1980, 1, 1, 0, 0, 0)); zi.compress_type = zipfile.ZIP_DEFLATED
        zout.writestr(zi, data)
    www = os.path.join(ROOT, 'www')
    for dp, _, fs in os.walk(www):
        for f in sorted(fs):
            full = os.path.join(dp, f); rel = 'assets/www/' + os.path.relpath(full, www).replace(os.sep, '/')
            zi = zipfile.ZipInfo(rel, (1980, 1, 1, 0, 0, 0)); zi.compress_type = zipfile.ZIP_DEFLATED
            zout.writestr(zi, open(full, 'rb').read())
    zi = zipfile.ZipInfo('classes.dex', (1980, 1, 1, 0, 0, 0)); zi.compress_type = zipfile.ZIP_DEFLATED
    zout.writestr(zi, open(os.path.join(B, 'classes.dex'), 'rb').read())
# imza: uber-apk-signer (zipalign + v1 + v2 + v3; https://github.com/patrickfav/uber-apk-signer)
pw = open(os.path.join(K, 'sifre.txt')).read().strip()
subprocess.run(['java', '-jar', os.path.join(AR, 'uber.jar'), '--apks', unsigned, '--ks', os.path.join(K, 'tvbakim.jks'), '--ksAlias', 'tvbakim',
                '--ksPass', pw, '--ksKeyPass', pw, '--out', B, '--allowResign', '--overwrite'], check=True)
signed = [f for f in glob.glob(os.path.join(B, '*.apk')) if f != unsigned]
assert len(signed) == 1, signed
for f in glob.glob(os.path.join(G, 'TV-Bakim-*.apk*')): os.remove(f)
out = os.path.join(G, 'TV-Bakim-%s.apk' % SURUM)
shutil.move(signed[0], out)
b = open(out, 'rb').read()
m = {'version': SURUM, 'code': KOD, 'apk': os.path.basename(out), 'size': len(b), 'sha256': hashlib.sha256(b).hexdigest(),
     'date': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'notes': {'tr': NOT[0], 'en': NOT[1] or NOT[0], 'ar': NOT[2] or NOT[0]}}
json.dump(m, open(os.path.join(G, 'surum.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
shutil.rmtree(B, ignore_errors=True)
print('hazır', SURUM, len(b), 'bayt', m['sha256'])
