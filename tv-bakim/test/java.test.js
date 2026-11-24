// Java: (1) Tarama + CopKutusu JVM birim testi (javac/java gerekir), (2) tüm Android kaynağının android.jar ile derlenmesi
// (ANDROID_TOOLS / ANDROID_HOME varsa; yoksa atlanır — CI derleme işinde araclar/apk.sh zaten derler).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'android/src');
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const hasJava = (() => { try { run('javac', ['-version']); return true; } catch (e) { return false; } })();

test('Java: tarama ve çöp kutusu (JVM)', { skip: !hasJava && 'javac yok' }, () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'tvj-'));
  run('javac', ['-encoding', 'UTF-8', '-d', out, path.join(SRC, 'com/departures/tvbakim/Tarama.java'), path.join(SRC, 'com/departures/tvbakim/CopKutusu.java'), path.join(__dirname, 'java/CopTest.java')]);
  const r = run('java', ['-cp', out, 'CopTest']);
  assert.match(r, /JAVA TAMAM/);
});

function androidJar() {
  const roots = [];
  if (process.env.ANDROID_TOOLS) roots.push(path.join(process.env.ANDROID_TOOLS, 'pf'));
  for (const v of ['ANDROID_HOME', 'ANDROID_SDK_ROOT']) if (process.env[v]) roots.push(path.join(process.env[v], 'platforms'));
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    const l = fs.readdirSync(r).filter((d) => fs.existsSync(path.join(r, d, 'android.jar'))).sort();
    if (l.length) return path.join(r, l[l.length - 1], 'android.jar');
  }
  return null;
}
const JAR = androidJar();
test('Java: Android kaynağı derlenir (android.jar)', { skip: (!hasJava || !JAR) && 'android.jar yok' }, () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'tva-'));
  const files = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.java')) files.push(p); } })(SRC);
  // R sınıfı aapt2'den gelir; kod R kullanmıyor
  run('javac', ['-nowarn', '--release', '8', '-Xlint:-options', '-encoding', 'UTF-8', '-classpath', JAR, '-d', out].concat(files));
  for (const c of ['com/departures/tvbakim/MainActivity.class', 'com/departures/tvbakim/TvBridge.class', 'com/departures/tvbakim/FcBridge.class', 'com/departuresmil/ortak/ApkPatchInstaller.class'])
    assert.ok(fs.existsSync(path.join(out, c)), c);
});
