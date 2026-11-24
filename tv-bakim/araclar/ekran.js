#!/usr/bin/env node
/* Ekran görüntüleri (başsız Chromium, TV boyutu: 960×540 CSS piksel × 2 = 1920×1080, sahte TV köprüsü).
     PLAYWRIGHT_CORE=/opt/npm-tools/node_modules/playwright-core PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node araclar/ekran.js <klasör>
   Arayüz gerçek kökeninde (https://tvbakim.local) ve gerçek CSP ile sunulur; dış istekler engellenir. Sayfa hatası olursa çıkış kodu 1. */
'use strict';
const path = require('path'), fs = require('fs');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const sahteTv = require('../test/sahte-tv.js');
const WWW = path.join(__dirname, '..', 'www');
const OUT = path.resolve(process.argv[2] || 'ekran');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };

async function sayfa(browser, s, errors) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: s.h || 540 }, deviceScaleFactor: s.dsf || 2, locale: s.lang === 'ar' ? 'ar' : 'tr-TR' });
  await ctx.route('**/*', (r) => {
    const u = new URL(r.request().url());
    if (u.hostname === 'tvbakim.local') {
      const f = path.join(WWW, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
      if (!f.startsWith(WWW) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
      return r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
    }
    if (/duyurular\.json/.test(u.pathname)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    if (/latest\.json$/.test(u.pathname)) return r.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '' });
    return r.abort();
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(s.name + ': ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::|Failed to load|404/.test(m.text())) errors.push(s.name + ' console: ' + m.text()); });
  await page.addInitScript((s) => {
    const set = (k, v) => localStorage.setItem('fc.' + k, JSON.stringify(v));
    if (s.lang) set('lang', s.lang);
    if (s.theme) set('theme', s.theme);
    if (s.scheme) set('scheme', s.scheme);
    if (!s.firstRun) { set('onboarding.done', true); set('whatsnew.seen', '1.1.0'); set('agent.intro', true); }
    if (s.auto === false) set('tv.auto', false);
  }, s);
  if (!s.browser) await page.addInitScript(sahteTv, s.tv || {});
  await page.goto('https://tvbakim.local/index.html');
  await page.waitForTimeout(400);
  return { ctx, page };
}

const SHOTS = [
  { name: 'tr-falcon-dark', lang: 'tr', theme: 'dark', scheme: 'falcon' },
  { name: 'ar-falcon-light', lang: 'ar', theme: 'light', scheme: 'falcon' },
  { name: 'tr-klasik', lang: 'tr', theme: 'dark', scheme: 'klasik' },
  { name: 'tr-falcon-dark-temizlik', lang: 'tr', theme: 'dark', scheme: 'falcon', go: 'clean', open: 'apk' },
  { name: 'tr-falcon-dark-uygulamalar', lang: 'tr', theme: 'dark', scheme: 'falcon', go: 'apps' },
  { name: 'tr-falcon-dark-ekran-hizi', lang: 'tr', theme: 'dark', scheme: 'falcon', go: 'speed' },
  { name: 'tr-falcon-dark-ag', lang: 'tr', theme: 'dark', scheme: 'falcon', go: 'net', run: '[data-k="net-start"]' },
  { name: 'tr-falcon-dark-cop', lang: 'tr', theme: 'dark', scheme: 'falcon', go: 'trash', tv: { trash: true } },
  { name: 'tr-falcon-dark-kurulum', lang: 'tr', theme: 'dark', scheme: 'falcon', go: 'setup' },
  { name: 'tr-falcon-dark-ayarlar', lang: 'tr', theme: 'dark', scheme: 'falcon', go: 'settings', h: 1500 },
  { name: 'ar-falcon-light-temizlik', lang: 'ar', theme: 'light', scheme: 'falcon', go: 'clean' },
  { name: 'en-falcon-dark-onay', lang: 'en', theme: 'dark', scheme: 'falcon', run: '[data-k="h-move"]' },
  { name: 'tr-falcon-dark-ilk-acilis', lang: 'tr', theme: 'dark', scheme: 'falcon', firstRun: true, auto: false },
  { name: 'tr-tarayici-deneme', lang: 'tr', theme: 'dark', scheme: 'falcon', browser: true }
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await pw.chromium.launch();
  const errors = [];
  for (const s of SHOTS) {
    const { ctx, page } = await sayfa(browser, s, errors);
    if (s.go) { await page.evaluate((id) => window.TVApp.go(id), s.go); await page.waitForTimeout(150); }
    if (s.open) { await page.click('[data-k="open-' + s.open + '"]'); await page.waitForTimeout(100); }
    if (s.run) { await page.click(s.run); await page.waitForTimeout(300); }
    await page.screenshot({ path: path.join(OUT, s.name + '.png'), fullPage: !!s.h });
    await ctx.close();
  }
  await browser.close();
  console.log('ekran görüntüleri:', OUT, SHOTS.length);
  if (errors.length) { console.error('HATALAR:\n' + errors.join('\n')); process.exit(1); }
}
module.exports = { sayfa };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
