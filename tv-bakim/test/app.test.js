// TV Bakım — Node testleri (bağımlılıksız): saf mantık, D-pad seçimi, çeviriler, sürüm tutarlılığı, çekirdek kopyası, güvenlik kuralları.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const B = require('../www/js/bakim.js');
const Dpad = require('../www/js/dpad.js');
const surum = require('../araclar/surum.js');

test('boyut biçimi (tr/en/ar, Arapçada Batı rakamları)', () => {
  assert.strictEqual(B.size(0, 'tr'), '0 B');
  assert.strictEqual(B.size(1536, 'en'), '2 KB');
  assert.strictEqual(B.size(4.2 * 1048576, 'tr'), '4,2 MB');
  assert.strictEqual(B.size(1.25 * 1073741824, 'en'), '1.25 GB');
  assert.match(B.size(3 * 1073741824, 'ar'), /^3[.,]00 GB$/);
  assert.deepStrictEqual(B.duration(9 * 864e5 + 5 * 3600e3 + 7 * 60e3), { d: 9, h: 5, m: 7 });
});

const ITEMS = [
  { id: 0, rel: 'Download/a.apk', size: 100, cat: 'apk' },
  { id: 1, rel: 'DCIM/.thumbnails/1.jpg', size: 10, cat: 'thumbs' },
  { id: 2, rel: 'x.tmp', size: 5, cat: 'temp' },
  { id: 3, rel: 'Movies/big.mkv', size: 5000, cat: 'big' },
  { id: 4, rel: 'a.log', size: 7, cat: 'log' },
  { id: 5, rel: 'LOST.DIR/1', size: 3, cat: 'lost' },
  { id: 6, rel: 'q', size: 1, cat: 'bilinmeyen' }
];

test('gruplar ve seçim: büyük dosyalar varsayılan seçili değil, istisnalar', () => {
  const g = B.group(ITEMS);
  assert.deepStrictEqual(g.map((x) => x.cat), ['apk', 'thumbs', 'temp', 'log', 'lost', 'big']);
  const sel = B.newSelection();
  let s = B.selected(sel, ITEMS);
  assert.deepStrictEqual(s.ids.sort(), [0, 1, 2, 4, 5]);
  assert.strictEqual(s.bytes, 125);
  B.toggleItem(sel, ITEMS[3]);           // büyük dosyayı tek tek seç
  B.toggleItem(sel, ITEMS[0]);           // apk'yı çıkar
  s = B.selected(sel, ITEMS);
  assert.deepStrictEqual(s.ids.sort(), [1, 2, 3, 4, 5]);
  B.toggleItem(sel, ITEMS[0]);           // geri al → istisna kalkar
  assert.ok(B.isSelected(sel, ITEMS[0]));
  assert.ok(!sel.on[0] && !sel.off[0]);
  B.toggleCat(sel, g, 'big');            // kategori açılınca istisnalar temizlenir
  assert.ok(sel.cats.big && !sel.on[3]);
  B.toggleCat(sel, g, 'big');
  assert.ok(!B.isSelected(sel, ITEMS[3]));
});

test('otomatik taşıma yalnız kesin gereksizler (apk ve büyük ASLA)', () => {
  const c = B.certainIds(ITEMS);
  assert.deepStrictEqual(c.ids.sort(), [1, 2, 4, 5]);
  // Java tarafıyla aynı küme
  const java = rd('android/src/com/departures/tvbakim/Tarama.java');
  const m = /kesinGereksiz\(String cat\) \{\s*return ([^;]+);/.exec(java);
  for (const k of ['thumbs', 'temp', 'log', 'lost']) assert.ok(m[1].includes('"' + k + '"'), k);
  for (const k of ['apk', 'big']) assert.ok(!m[1].includes('"' + k + '"'), k);
});

test('animasyon durumu, kurulum adımları, ağ değerlendirmesi, uygulama sıralaması', () => {
  assert.strictEqual(B.anim({ animWindow: 1, animTransition: 1, animator: 1 }).state, 'default');
  assert.strictEqual(B.anim({ animWindow: 0.5, animTransition: 0.5, animator: 0.5 }).state, 'fast');
  assert.strictEqual(B.anim({ animWindow: 0, animTransition: 0, animator: 0 }).state, 'off');
  assert.strictEqual(B.anim({ animWindow: 0.5, animTransition: 1, animator: 0.5 }).state, 'default');
  assert.strictEqual(B.anim({}).state, 'unknown');
  const steps = B.setupSteps({ storagePerm: true, usagePerm: false, usageSizes: true, animWindow: 1, animTransition: 1, animator: 1, installPerm: false, sdk: 30, oldApp: true, adb: true });
  assert.deepStrictEqual(steps.map((s) => s.id), ['storage', 'usage', 'anim', 'install', 'old', 'adb']);
  assert.deepStrictEqual(B.setupCount(steps), { done: 1, total: 6 });
  const eski = B.setupSteps({ storagePerm: true, usageSizes: false, sdk: 22, animWindow: 0.5, animTransition: 0.5, animator: 0.5 });
  assert.deepStrictEqual(B.setupCount(eski), { done: 2, total: 2 });
  assert.strictEqual(B.netRating(40, 30), 'excellent');
  assert.strictEqual(B.netRating(40, 200), 'good');
  assert.strictEqual(B.netRating(6, 20), 'ok');
  assert.strictEqual(B.netRating(1, 20), 'poor');
  const a = B.sortApps([{ name: 'b', apk: 5 }, { name: 'a', app: 1, data: 2, cache: 3 }, { name: 'c', apk: 9 }]);
  assert.deepStrictEqual(a.map((x) => x.name), ['c', 'a', 'b']);
  assert.ok(B.disk({ diskTotal: 100, diskFree: 5 }).low);
});

test('D-pad: yön tuşu o yöndeki en yakın öğeyi seçer', () => {
  const from = { x: 100, y: 100, w: 100, h: 40 };
  const c = [
    { x: 220, y: 100, w: 100, h: 40 },   // 0 sağda, aynı satır
    { x: 400, y: 30, w: 100, h: 40 },    // 1 sağ üst, uzak
    { x: 100, y: 160, w: 100, h: 40 },   // 2 altta
    { x: 0, y: 100, w: 80, h: 40 },      // 3 solda
    { x: 120, y: 30, w: 60, h: 40 },     // 4 üstte
    { x: 300, y: 170, w: 100, h: 40 }    // 5 sağ alt
  ];
  assert.strictEqual(Dpad.pick(from, c, 'right'), 0);
  assert.strictEqual(Dpad.pick(from, c, 'down'), 2);
  assert.strictEqual(Dpad.pick(from, c, 'left'), 3);
  assert.strictEqual(Dpad.pick(from, c, 'up'), 4);
  assert.strictEqual(Dpad.pick(from, [c[3]], 'right'), -1);
  // menü (solda dikey) → içerik (sağda): satırı örtüşen öğe yeğlenir
  assert.strictEqual(Dpad.pick({ x: 0, y: 300, w: 200, h: 40 }, [{ x: 240, y: 80, w: 300, h: 100 }, { x: 240, y: 290, w: 300, h: 60 }], 'right'), 1);
});

test('çeviriler: tr/en/ar anahtarları aynı, değişkenler aynı, boş metin yok', () => {
  const ctx = {}; new Function('globalThis', rd('www/js/metinler.js'))(ctx);
  const M = ctx.TV_METIN, tr = Object.keys(M.tr).sort();
  for (const l of ['en', 'ar']) {
    assert.deepStrictEqual(Object.keys(M[l]).sort(), tr, l + ' anahtarları');
    for (const k of tr) {
      const v = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
      assert.strictEqual(v(M[l][k]), v(M.tr[k]), l + ' ' + k + ' değişkenleri');
      assert.ok(M[l][k].trim(), l + ' ' + k);
    }
  }
  // arayüzde kullanılan her tv.* anahtarı sözlükte var
  const src = rd('www/js/app.js') + rd('www/js/kabuk.js');
  const used = new Set();
  for (const m of src.matchAll(/T\('(tv\.[\w.]+)'/g)) if (!m[1].endsWith('.')) used.add(m[1]);
  for (const k of used) assert.ok(M.tr[k] !== undefined, 'eksik: ' + k);
  for (const p of ['home', 'clean', 'apps', 'speed', 'net', 'trash', 'setup', 'settings']) { assert.ok(M.tr['tv.nav.' + p]); assert.ok(M.tr['tv.sub.' + p]); }
  for (const c of B.CATS) { assert.ok(M.ar['tv.cat.' + c]); assert.ok(M.ar['tv.cat.' + c + '.d']); }
  for (const s of ['storage', 'usage', 'anim', 'install', 'old', 'adb']) { assert.ok(M.en['tv.setup.' + s]); assert.ok(M.en['tv.setup.' + s + '.d']); }
});

test('sürüm tutarlılığı: package.json = surum.js = NEWS[0] = release-notes.json; versionCode', () => {
  const v = surum.version();
  assert.match(v, /^\d+\.\d+\.\d+$/);
  const ctx = {}; new Function('window', rd('www/js/surum.js'))(ctx);
  assert.deepStrictEqual(ctx.APP_RELEASE, { version: v, code: surum.versionCode(v) });
  const n = surum.news();
  assert.strictEqual(n[0].v, v);
  for (const x of n) for (const l of ['tr', 'en', 'ar']) assert.ok(Array.isArray(x[l]) && x[l].length, x.v + ' ' + l);
  assert.deepStrictEqual(JSON.parse(rd('release-notes.json')), surum.notesOf(n[0]));
  assert.ok(surum.versionCode('1.1.0') > 3, '1.0.2 kodu 3 idi');
  assert.strictEqual(surum.versionCode('1.10.0'), 11000);
  assert.ok(surum.versionCode('2.0.0') > surum.versionCode('1.99.99'));
  assert.throws(() => surum.versionCode('1.100.0'));
  assert.ok(rd('android/AndroidManifest.xml').includes('android:versionCode="@VERSION_CODE@"'));
});

test('çekirdek kopyası: VERSION, yerel ek, dosyalar', () => {
  const v = rd('cekirdek/VERSION');
  assert.match(v, /^ortak-cekirdek [0-9a-f]{40}/);
  const core = rd('www/cekirdek/fc-core.js');
  assert.ok(core.includes("typeof h.update.run === 'function'"), 'yerel ek: update.run');
  for (const f of ['css/tokens.css', 'css/core.css', 'fonts/inter-latin-400-normal.woff2', 'fonts/noto-sans-arabic-arabic-400-normal.woff2'])
    assert.ok(fs.existsSync(path.join(ROOT, 'www/cekirdek', f)), f);
  const html = rd('www/index.html');
  for (const s of ['cekirdek/fc-core.js', 'js/surum.js', 'js/metinler.js', 'js/bakim.js', 'js/dpad.js', 'js/kabuk.js', 'js/app.js']) assert.ok(html.includes(s), s);
  assert.ok(html.indexOf('js/kabuk.js') < html.indexOf('js/app.js'));
  assert.match(html, /Content-Security-Policy[^>]*script-src 'self'/);
  assert.ok(!/<script>/.test(html), 'satır içi betik yok (CSP)');
  const kb = rd('www/js/kabuk.js');
  assert.ok(kb.includes("repo: 'duyurular'") && kb.includes("app: 'tv-bakim'") && kb.includes("channel: 'android'"));
  assert.ok(kb.includes("registerScheme('klasik'"));
  assert.ok(kb.includes('usage: { firebase: false, ai: false }'));
});

test('güvenlik: manifest ve köprü yasakları', () => {
  const man = rd('android/AndroidManifest.xml').replace(/<!--[\s\S]*?-->/g, '');
  for (const p of ['WRITE_SECURE_SETTINGS', 'QUERY_ALL_PACKAGES', 'KILL_BACKGROUND_PROCESSES', 'WRITE_SETTINGS'])
    assert.ok(!man.includes(p), 'yasak izin: ' + p);
  assert.match(man, /usesCleartextTraffic="false"/);
  assert.match(man, /android:minSdkVersion="21"/);
  assert.match(man, /android:targetSdkVersion="34"/);
  assert.match(man, /package="com\.departures\.tvbakim"/);   // paket adı DEĞİŞMEZ
  assert.match(man, /<queries>/);
  assert.match(man, /UpdateFileProvider[\s\S]*?exported="false"/);
  const dir = path.join(ROOT, 'android/src/com/departures/tvbakim');
  const java = fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  for (const bad of ['127.0.0.1', '5555', 'Adb', 'pm grant', 'adb_enabled', 'putInt(', 'putFloat(', 'Settings.Global.put', 'Settings.Secure.put',
    'setAllowUniversalAccessFromFileURLs(true)', 'setAllowFileAccess(true)', 'killBackgroundProcesses', 'forceStop', 'Runtime.getRuntime', 'ProcessBuilder', 'http://'])
    assert.ok(!java.includes(bad), 'yasak: ' + bad);
  assert.ok(!fs.existsSync(path.join(dir, 'Adb.java')));
  // JS köprüsü yöntemleri: yalnız bu liste (genişlerse test bilerek güncellenmeli)
  const methods = (src) => [...src.matchAll(/@JavascriptInterface\s+public\s+(?:synchronized\s+)?\S+\s+(\w+)\(/g)].map((m) => m[1]).sort();
  assert.deepStrictEqual(methods(fs.readFileSync(path.join(dir, 'TvBridge.java'), 'utf8')), [
    'appDetails', 'apps', 'cancelScan', 'clearOwnCache', 'emptyTrash', 'info', 'legacy', 'legacyDone', 'netTest', 'openApp', 'openSettings',
    'requestStorage', 'restore', 'scan', 'tasi', 'trash', 'trashList', 'uninstall'].sort());
  assert.deepStrictEqual(methods(fs.readFileSync(path.join(dir, 'FcBridge.java'), 'utf8')),
    ['apkUpdate', 'appVersion', 'moveTaskToBack', 'openExternal', 'updateBegin', 'updateChunk', 'updateFinish']);
  const tv = fs.readFileSync(path.join(dir, 'TvBridge.java'), 'utf8');
  // çöp kutusuna taşıma yalnız tarama numarasıyla (yol kabul edilmez); kalıcı silme yerel onay penceresinden sonra
  assert.match(tv, /public void trash\(String idsJson\)/);
  assert.match(tv, /setPositiveButton\(yes, \(x, w\) -> kaliciSil\(idsJson\)\)/);
  assert.ok(!/\.delete\(\)/.test(tv.replace(/private static long temizle\([\s\S]*?\n    }\n/, '')), 'TvBridge başka yerde dosya silmez');
  const fc = fs.readFileSync(path.join(dir, 'FcBridge.java'), 'utf8');
  assert.match(fc, /https:\/\/github\.com\/departures-mil\/duyurular\/releases\/download\//);
  assert.match(fc, /WRONG_SIGNATURE/);
  const ma = fs.readFileSync(path.join(dir, 'MainActivity.java'), 'utf8');
  assert.match(ma, /setAllowFileAccess\(false\)/);
  assert.match(ma, /setAllowUniversalAccessFromFileURLs\(false\)/);
  assert.match(ma, /MIXED_CONTENT_NEVER_ALLOW/);
  assert.match(ma, /\/departures-mil\/duyurular\/releases\//);
});

test('derleme betiği: sürüm uzunluk sınırı yok, imza anahtarı depoda yok', () => {
  const sh = rd('araclar/apk.sh');
  assert.ok(sh.includes('--target-sdk-version 34') && sh.includes('--min-sdk-version 21'));
  assert.ok(!fs.existsSync(path.join(ROOT, 'araclar/paketle.py')));
  const all = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === 'node_modules' || e.name.startsWith('.') ? [] : all(path.join(d, e.name))) : [path.join(d, e.name)]);
  for (const f of all(ROOT)) assert.ok(!/\.(jks|keystore|pem|p12)$/i.test(f) && !/sifre\.txt$/.test(f), 'anahtar dosyası: ' + f);
});
