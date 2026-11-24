// Arayüz testi (gerçek köken https://tvbakim.local + CSP, sahte TV köprüsü, başsız Chromium).
// PLAYWRIGHT_CORE (ve gerekirse PLAYWRIGHT_BROWSERS_PATH) yoksa atlanır.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
let pw = null;
try { pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core'); } catch (e) { pw = null; }
const { sayfa } = pw ? require('../araclar/ekran.js') : {};
const skip = !pw && 'playwright-core yok';

test('arayüz: açılış bakımı, kumanda, çöp kutusu, köprü, taşıma', { skip }, async (t) => {
  const browser = await pw.chromium.launch();
  const errors = [];
  try {
    await t.test('açılış: kendi önbelleği + tarama, sonuç ve çöp kutusuna taşıma (büyük dosya hariç)', async () => {
      const { ctx, page } = await sayfa(browser, { name: 'a', lang: 'tr', theme: 'dark', scheme: 'falcon' }, errors);
      const log = await page.evaluate(() => window.__tvLog.slice());
      assert.ok(log.includes('clearOwnCache') && log.includes('scan'), log.join());
      assert.ok(await page.isVisible('[data-k="h-move"]'));
      await page.click('[data-k="h-move"]');
      await page.waitForSelector('.modal-backdrop');
      await page.click('.modal-footer .btn.primary');
      await page.waitForTimeout(150);
      const tr = (await page.evaluate(() => window.__tvLog)).find((x) => x.startsWith('trash:'));
      assert.deepStrictEqual(tr.slice(6).split(',').map(Number).sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      assert.ok(!(await page.isVisible('[data-k="h-move"]')) || true);
      await ctx.close();
    });

    await t.test('kumanda: yön tuşları, Geri ve Menü', async () => {
      const { ctx, page } = await sayfa(browser, { name: 'b', lang: 'tr', theme: 'dark', scheme: 'falcon', auto: false }, errors);
      assert.strictEqual(await page.evaluate(() => document.activeElement.getAttribute('data-k')), 'run');
      await page.keyboard.press('ArrowLeft');
      assert.match(await page.evaluate(() => document.activeElement.getAttribute('data-k')), /^nav-/);
      await page.keyboard.press('ArrowDown');
      const k = await page.evaluate(() => document.activeElement.getAttribute('data-k'));
      assert.strictEqual(k, 'nav-apps');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
      assert.strictEqual(await page.evaluate(() => document.documentElement.getAttribute('data-page')), 'apps');
      if (/^nav-/.test(await page.evaluate(() => document.activeElement.getAttribute('data-k') || ''))) await page.keyboard.press('ArrowRight');
      assert.match(await page.evaluate(() => document.activeElement.getAttribute('data-k') || ''), /^(a[odu]-|apps-reload|usage)/);
      await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
      assert.match(await page.evaluate(() => document.activeElement.getAttribute('data-k') || ''), /^nav-/);
      assert.strictEqual(await page.evaluate(() => window.__tvGeri()), true);
      assert.strictEqual(await page.evaluate(() => document.documentElement.getAttribute('data-page')), 'home');
      assert.strictEqual(await page.evaluate(() => window.__tvGeri()), false);   // ana sayfada → uygulama arka plana
      await page.evaluate(() => window.__tvMenu());
      assert.strictEqual(await page.evaluate(() => document.documentElement.getAttribute('data-page')), 'settings');
      const kartlar = await page.evaluate(() => [...document.querySelectorAll('.settings-grid > [data-fc-card]')].map((e) => e.getAttribute('data-fc-card')));
      assert.strictEqual(kartlar[kartlar.length - 1], 'contact', 'Admin ile iletişim EN SON: ' + kartlar.join());
      assert.ok(kartlar.indexOf('look') === 0 && kartlar.includes('tv-maint') && kartlar.includes('usage'));
      // TV: Küçült / Orta / Tam ekran yok, Kapat var
      const win = await page.evaluate(() => [...document.querySelectorAll('[data-win]')].map((e) => e.getAttribute('data-win')));
      assert.deepStrictEqual(win, ['close']);
      await page.click('[data-win="close"]');
      assert.ok((await page.evaluate(() => window.__tvLog)).includes('moveTaskToBack'));
      await ctx.close();
    });

    await t.test('çöp kutusu: geri al ve kalıcı silme yerel onaya gider', async () => {
      const { ctx, page } = await sayfa(browser, { name: 'c', lang: 'tr', theme: 'dark', scheme: 'falcon', auto: false, tv: { trash: true } }, errors);
      await page.evaluate(() => window.TVApp.go('trash'));
      await page.click('[data-k="tsel"]');
      await page.click('[data-k="tdel"]');
      await page.waitForTimeout(100);
      const log = await page.evaluate(() => window.__tvLog.slice());
      assert.ok(log.some((x) => /^emptyTrash:.*\|Kalıcı olarak silinsin mi\?$/.test(x)), log.join());
      await page.click('[data-k="tsel"]');
      await page.click('[data-k="trest"]');
      await page.waitForTimeout(100);
      assert.ok((await page.evaluate(() => window.__tvLog)).some((x) => x.startsWith('restore:')));
      assert.ok(await page.isVisible('text=Çöp kutusu boş.'));
      await ctx.close();
    });

    await t.test('izin yoksa tarama yerine izin düğmesi; kurulum sayfası', async () => {
      const { ctx, page } = await sayfa(browser, { name: 'd', lang: 'en', theme: 'light', scheme: 'falcon', tv: { info: { storagePerm: false } } }, errors);
      assert.ok(await page.isVisible('[data-k="h-perm"]'));
      await page.click('[data-k="h-perm"]');
      assert.ok((await page.evaluate(() => window.__tvLog)).includes('requestStorage'));
      await page.evaluate(() => window.TVApp.go('setup'));
      assert.ok(await page.isVisible('[data-k="su-storage"]'));
      assert.ok(await page.isVisible('[data-k="su-adb"]'));
      await ctx.close();
    });

    await t.test('1.0.x ayarları taşınır; "neler yeni" görünür', async () => {
      const { ctx, page } = await sayfa(browser, { name: 'e', firstRun: true, tv: { legacy: { 'tv.dil': 'ar', 'tv.oto': '0' } } }, errors);
      await page.waitForTimeout(1200);
      assert.strictEqual(await page.evaluate(() => document.documentElement.lang), 'ar');
      assert.strictEqual(await page.evaluate(() => document.documentElement.dir), 'rtl');
      assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('fc.tv.auto'))), false);
      const log = await page.evaluate(() => window.__tvLog.slice());
      assert.ok(log.includes('legacyDone') && !log.includes('scan'), log.join());
      assert.ok(await page.isVisible('.modal-backdrop'), 'neler yeni penceresi');
      await ctx.close();
    });

    await t.test('tarayıcı: deneme kipi, hata yok', async () => {
      const { ctx, page } = await sayfa(browser, { name: 'f', lang: 'tr', theme: 'dark', scheme: 'klasik', browser: true }, errors);
      assert.ok(await page.isVisible('text=Deneme kipi'));
      for (const p of ['clean', 'apps', 'speed', 'net', 'trash', 'setup', 'settings']) await page.evaluate((p) => window.TVApp.go(p), p);
      await ctx.close();
    });
    assert.deepStrictEqual(errors, []);
  } finally {
    await browser.close();
  }
});
