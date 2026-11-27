/* TV Bakım — ortak çekirdek yapıştırıcısı (cekirdek/fc-core.js). app.js'ten ÖNCE yüklenir.
   Burada: "klasik" renk şeması (1.0.x görünümü), 1.0.x ayarlarının taşınması, Android güncellemesi (kurulu APK + FCD1 yama →
   yeni APK, ortak ApkPatchInstaller; olmazsa tam APK), çekirdeğin başlatılması (güncelleme kanalı: departures-mil/duyurular
   Releases → latest.json → "android"), üst çubuk (Ayarlar · Duyurular · Güncelle · tema · dil | Kapat), ayarlar düzeni
   (Görünüm · Bakım · Android ayarları · … · Admin ile iletişim EN SON), ilk açılış rehberi ve "neler yeni". */
(function (g) {
  'use strict';
  var FC = g.FC, ui = FC.ui;
  var REL = g.APP_RELEASE || { version: '0.0.0' }, VER = REL.version;
  var AB = g.AndroidBridge || null, TVB = g.TV || null;
  var T = function (k, v) { return FC.t(k, v); };

  /* ---------- "klasik": 1.0.x stil.css renkleri (tek mod: koyu) ---------- */
  var KLASIK = {
    '--bg': '#0b1220', '--bg-grid': '#0000', '--panel': '#131d33', '--panel-solid': '#131d33', '--panel-hover': '#1b2844',
    '--border': '#22325a', '--border-strong': '#2c3d66', '--border-w': '1px', '--text': '#eef3ff', '--muted': '#9fb0d0', '--label': '#c9d5ee',
    '--nav-text': '#9fb0d0', '--nav-title': '#7d8fb3', '--accent': '#36c39a', '--accent-2': '#2a8cff', '--on-accent': '#06121f',
    '--primary-1': '#2a8cff', '--primary-2': '#2a8cff', '--active-1': '#2a8cff38', '--active-2': '#2a8cff1a', '--active-line': '#2a8cff80',
    '--accent-soft': '#16324a', '--accent-line': '#36c39a66', '--focus': '#ffd34d', '--focus-w': '3px', '--focus-ring': '#ffd34d59',
    '--danger': '#ff6b6b', '--warn': '#f5b84b', '--ok': '#36c39a', '--ok-text': '#5ee0b6', '--danger-text': '#ff8f8f', '--warn-text': '#ffe2a8',
    '--ok-soft': '#123528', '--ok-line': '#36c39a59', '--danger-soft': '#3a1a1f', '--danger-line': '#ff6b6b59', '--warn-soft': '#3a2a10', '--warn-line': '#f5b84b59',
    '--sidebar-bg': '#0e1830', '--topbar-bg': '#0e1830f2', '--modal-bg': '#131d33', '--modal-border': '#2c3d66', '--backdrop': '#000000b3',
    '--toast-bg': '#22325a', '--toast-text': '#eef3ff', '--toast-line': '#2c3d66', '--toast-err-bg': '#3a1a1f', '--toast-err-text': '#ffffff', '--toast-err-line': '#ff6b6b59',
    '--badge-text': '#eef3ff', '--badge-bg': '#1b2844', '--badge-line': '#2c3d66', '--on-badge': '#06121f',
    '--bar-track': '#0b1a2a', '--scroll-thumb': '#9fb0d040', '--glow-1': '#0000', '--glow-2': '#0000',
    '--shadow-pop': '0 8px 24px #00000080', '--shadow-modal': '0 20px 60px #000000a6', '--shadow-toast': '0 8px 24px #00000080'
  };
  FC.look.registerScheme('klasik', { label: { tr: 'Klasik (eski görünüm)', en: 'Classic (previous look)', ar: 'الكلاسيكي (المظهر السابق)' }, dark: KLASIK });

  /* ---------- 1.0.x ayarları (file:// kökeni; MainActivity bir kez okuyup köprüye verdi) ---------- */
  var eski = {};
  try { eski = JSON.parse(TVB && TVB.legacy ? TVB.legacy() : '{}') || {}; } catch (e) { eski = {}; }
  var ESKI = Object.keys(eski).length > 0;
  if (ESKI) {
    if (/^(tr|en|ar)$/.test(eski['tv.dil'] || '') && FC.storage.get('lang', null) == null) FC.i18n.set(eski['tv.dil']);
    if (eski['tv.oto'] === '0' && FC.storage.get('tv.auto', null) == null) FC.storage.set('tv.auto', false);
    if (+eski['tv.son'] > 0 && FC.storage.get('tv.last', null) == null) FC.storage.set('tv.last', +eski['tv.son']);
    if (FC.storage.get('whatsnew.seen', null) == null) FC.storage.set('whatsnew.seen', '1.0.2');   // "neler yeni" gösterilsin
    if (FC.storage.get('onboarding.done', null) == null) FC.storage.set('onboarding.done', true);
    try { TVB.legacyDone(); } catch (e) { /* yoksay */ }
  }

  /* ---------- Android güncellemesi: indirme + yama + kurulum yerelde (FcBridge.apkUpdate) ---------- */
  if (FC.host.kind === 'android' && AB && typeof AB.apkUpdate === 'function') {
    FC.host.update.run = function (plan, onEv) {
      return new Promise(function (resolve, reject) {
        g.__fcApk = function (ev) {
          if (!ev) return;
          if (ev.type === 'progress') onEv({ patch: !!ev.patch, done: ev.done, total: ev.total, finished: !!ev.finished });
          else if (ev.type === 'patchFailed') onEv({ patchFailed: true, error: ev.error });
          else if (ev.type === 'installing') onEv({ installing: true });
          else if (ev.type === 'done') resolve(ev.result || 'done');
          else if (ev.type === 'error') reject(Object.assign(new Error(ev.error || 'FAILED'), { code: ev.error || 'FAILED' }));
        };
        try {
          AB.apkUpdate(JSON.stringify({ version: plan.version, full: plan.full, patch: plan.mode === 'patch' ? { url: plan.url, sha256: plan.sha256, size: plan.size } : null }));
        } catch (e) { reject(e); }
      });
    };
    FC.host.can.update = true;
  }
  /* Android: latest.json yerelde indirilir (WebView'den GitHub'a fetch CORS'a takılır → "Failed to fetch"); ortak-cekirdek 1c11eb0 ile aynı sözleşme */
  if (FC.host.kind === 'android' && AB && typeof AB.httpGet === 'function') {
    var httpSeq = 0, httpWait = {};
    window.__fcHttp = function (id, r) { var f = httpWait[id]; if (f) { delete httpWait[id]; f(r || {}); } };
    FC.host.net = {
      maxBytes: 2 * 1024 * 1024,
      download: function (url, onProgress) {
        return new Promise(function (resolve, reject) {
          var id = 'h' + (++httpSeq) + '_' + Date.now();
          var to = setTimeout(function () { delete httpWait[id]; reject(Object.assign(new Error('TIMEOUT'), { code: 'TIMEOUT' })); }, 45000);
          httpWait[id] = function (r) {
            clearTimeout(to);
            if (r.error) return reject(Object.assign(new Error(String(r.error)), { code: 'NETWORK' }));
            if (r.status !== 200) return reject(Object.assign(new Error('HTTP_' + r.status), { code: 'HTTP_' + r.status }));
            var b = new TextEncoder().encode(String(r.body || ''));
            if (onProgress) try { onProgress({ done: b.length, finished: true }); } catch (e) { /* yok */ }
            resolve(b);
          };
          try { AB.httpGet(id, url); } catch (e) { clearTimeout(to); delete httpWait[id]; reject(e); }
        });
      }
    };
  }
  /* ---------- çekirdek ---------- */
  // Sürümler departures-mil/duyurular deposunun Releases'inde (ayrı depo yok); latest.json "app": "tv-bakim", kanal "android".
  FC.init({ app: 'tv-bakim', repo: 'duyurular', version: VER, channel: 'android', announcements: true, whatsnew: false, onboarding: false });
  function notlar(v) {
    var n = (g.TV_NEWS || []).filter(function (x) { return x.v === v; })[0];
    return n ? { tr: n.tr.join('\n'), en: n.en.join('\n'), ar: n.ar.join('\n') } : null;
  }
  var wn = FC.whatsnew.start({ version: VER, notes: notlar });

  /* ---------- üst çubuk: Ayarlar · Duyurular · ✦ · Güncelle · tema · dil | Kapat (TV'de Küçült/Orta/Tam ekran yok) ---------- */
  function ustCubuk(bar, ayarlarAc) {
    var b = ui.el('button.btn.small.top-act.settings-act', { type: 'button', 'data-k': 'top-settings' });
    function ciz() { b.innerHTML = ui.icon('settings') + '<span class="top-act-label">' + ui.esc(T('tv.settings')) + '</span>'; b.title = T('tv.settings'); }
    b.addEventListener('click', ayarlarAc); ciz(); FC.i18n.onChange(ciz);
    return FC.topbar.mount(bar, { before: [b, FC.announcements.button()], sync: false, lan: false });
  }

  /* ---------- ayarlar ---------- */
  function ayarlar(kutu, kartlar, rehber) {
    return FC.settings.build(kutu, { cards: kartlar, usage: { firebase: false, ai: false }, about: { version: VER }, onboarding: rehber });
  }

  /* ---------- ilk açılış: çekirdek rehberi (dil → görünüm → bitti), sonra Kurulum sayfası ---------- */
  function rehberAyar(bitince) { return { firebase: false, ai: false, onClose: bitince }; }
  function ilkAcilis(bitince) {
    if (wn) return false;
    var m = FC.onboarding.maybeStart(rehberAyar(bitince));
    return !!m;
  }

  g.Kabuk = { version: VER, legacy: ESKI, whatsnew: wn, ustCubuk: ustCubuk, ayarlar: ayarlar, rehberAyar: rehberAyar, ilkAcilis: ilkAcilis };
})(typeof globalThis !== 'undefined' ? globalThis : this);
