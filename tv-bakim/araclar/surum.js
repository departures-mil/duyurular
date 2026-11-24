#!/usr/bin/env node
/* Sürüm tek kaynak: package.json. Kullanım: node araclar/surum.js X.Y.Z
   Önce www/js/haberler.js TV_NEWS dizisinin EN ÜSTÜNE yeni sürümün kaydını ekleyin (tr/en/ar).
   Yazar: package.json, www/js/surum.js (APP_RELEASE), release-notes.json (latest.json notları).
   versionCode = X*10000 + Y*100 + Z (1.0.2'nin kodu 3'tü; 1.1.0 → 10100). */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
function versionCode(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v));
  if (!m || +m[2] > 99 || +m[3] > 99) throw new Error('sürüm X.Y.Z olmalı (Y, Z ≤ 99): ' + v);
  return +m[1] * 10000 + +m[2] * 100 + +m[3];
}
function version() { return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version; }
function news() { const ctx = {}; new Function('window', fs.readFileSync(path.join(ROOT, 'www/js/haberler.js'), 'utf8'))(ctx); return ctx.TV_NEWS; }
function notesOf(n) { return { tr: n.tr.join('\n'), en: n.en.join('\n'), ar: n.ar.join('\n') }; }
function write(v) {
  versionCode(v);
  const n = news();
  if (!n.length || n[0].v !== v) throw new Error('www/js/haberler.js TV_NEWS en üstünde ' + v + ' yok');
  const pj = path.join(ROOT, 'package.json'), p = JSON.parse(fs.readFileSync(pj, 'utf8'));
  p.version = v; fs.writeFileSync(pj, JSON.stringify(p, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, 'www/js/surum.js'), '/* OTOMATİK: node araclar/surum.js — elle düzenlemeyin */\nwindow.APP_RELEASE = ' + JSON.stringify({ version: v, code: versionCode(v) }) + ';\n');
  fs.writeFileSync(path.join(ROOT, 'release-notes.json'), JSON.stringify(notesOf(n[0]), null, 1) + '\n');
  console.log('sürüm', v, 'versionCode', versionCode(v));
}
module.exports = { version, versionCode, news, notesOf };
if (require.main === module) write(process.argv[2] || version());
