#!/usr/bin/env node
/* ESKİ KANAL KÖPRÜSÜ — 1.0.x kurulumları raw tv-bakim/guncelleme/surum.json okur, versionCode büyükse
   https://raw.githubusercontent.com/departures-mil/duyurular/main/tv-bakim/guncelleme/<apk> dosyasını indirip SHA-256 ile doğrular ve kurar.
   Bu betik son GitHub release'inin (bu depo) latest.json → android APK'sını indirir, doğrular, guncelleme/ klasörüne koyar
   (eski APK'lar silinir) ve surum.json'u yazar. CI'da release'ten SONRA çalışır (tv-bakim.yml → kopru); elle de çalışır:
     node tv-bakim/araclar/eski-kanal.js            (release yoksa ya da android kanalı yoksa hiçbir şeyi değiştirmez)
   APK aynı paket adı + aynı anahtarla imzalı olmalı (CI EXPECTED_CERT denetler); yoksa eski TV'ler güncelleyemez. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const surum = require('./surum.js');
const G = path.join(__dirname, '..', 'guncelleme');
const BASE = 'https://github.com/departures-mil/duyurular/releases';

async function get(u) {
  const r = await fetch(u, { redirect: 'follow', headers: { 'User-Agent': 'tv-bakim-kopru' } });
  if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status + ' ' + u), { status: r.status });
  return Buffer.from(await r.arrayBuffer());
}
async function main() {
  let man;
  try { man = JSON.parse((await get(BASE + '/latest/download/latest.json')).toString('utf8')); }
  catch (e) { if (e.status === 404) { console.log('release/latest.json yok — köprü değişmedi'); return; } throw e; }
  const a = man.assets && man.assets.android;
  if (man.app !== 'tv-bakim' || !a || !/^[0-9a-f]{64}$/.test(a.sha256 || '')) { console.log('android kanalı yok — köprü değişmedi'); return; }
  const eski = fs.existsSync(path.join(G, 'surum.json')) ? JSON.parse(fs.readFileSync(path.join(G, 'surum.json'), 'utf8')) : {};
  const code = surum.versionCode(man.version);
  if ((eski.code || 0) >= code) { console.log('köprü zaten', eski.version); return; }
  const bytes = await get(BASE + '/download/v' + man.version + '/' + a.file);
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== +a.size || sha !== a.sha256) throw new Error('APK doğrulanamadı (boyut/SHA-256)');
  for (const f of fs.readdirSync(G)) if (/^TV-Bakim-.*\.apk(\.idsig)?$/.test(f)) fs.unlinkSync(path.join(G, f));
  const ad = 'TV-Bakim-' + man.version + '.apk';
  fs.writeFileSync(path.join(G, ad), bytes);
  const m = { version: man.version, code, apk: ad, size: bytes.length, sha256: sha, date: man.published || new Date().toISOString(), notes: man.notes || {} };
  fs.writeFileSync(path.join(G, 'surum.json'), JSON.stringify(m, null, 1) + '\n');
  console.log('köprü →', man.version, '(versionCode ' + code + ')');
}
main().catch((e) => { console.error(e.message); process.exit(1); });
