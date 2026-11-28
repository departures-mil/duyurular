/* TV Bakım — ekranlar. Kumandayla (yön tuşları + OK + Geri) kullanılır; dokunmatik/fare da çalışır.
   Yerel işlemler yalnız window.TV (TvBridge.java) üzerinden: durum okuma, kendi önbelleği, tarama → çöp kutusu (geri alınabilir),
   uygulama listesi / sistem ekranları, ağ testi. Tarayıcıda (TV köprüsü yoksa) deneme kipi. */
(function (g) {
  'use strict';
  var FC = g.FC, ui = FC.ui, el = ui.el, B = g.TVBakim, TVB = g.TV || null;
  var T = function (k, v) { return FC.t(k, v); };
  var L = function () { return FC.i18n.lang(); };
  var mb = function (b) { return '\u2066' + B.size(b, L()) + '\u2069'; };   // yön yalıtımı: Arapça metin içinde sayı+birim karışmasın
  var S = FC.storage;

  /* ek simgeler */
  ui.icons.trash = '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>';
  ui.icons.grid = '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>';
  ui.icons.tv = '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>';
  ui.icons.list = '<path d="M9 6h12M9 12h12M9 18h12"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>';
  ui.icons.undo = '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>';
  ui.icons.play = '<path d="m6 4 14 8-14 8z"/>';
  ui.icons.open = '<path d="M7 17 17 7M8 7h9v9"/>';

  var PAGES = [
    { id: 'home', icon: 'home' }, { id: 'clean', icon: 'sparkles' }, { id: 'apps', icon: 'grid' }, { id: 'speed', icon: 'zap' },
    { id: 'net', icon: 'wifi' }, { id: 'trash', icon: 'trash' }, { id: 'setup', icon: 'list' }, { id: 'settings', icon: 'settings' }
  ];
  var st = {
    page: 'home', info: {},
    run: 'idle',                       // idle | busy | done
    scan: { state: 'idle', items: [], groups: [], sel: null, scanned: 0, found: 0, truncated: false, open: {} },
    apps: { state: 'idle', items: [], usage: false },
    net: { state: 'idle', r: null },
    trash: { items: [], total: 0, sel: {}, permission: true },
    ownFreed: null
  };
  var $ = function (id) { return g.document.getElementById(id); };

  /* ---------- köprü ---------- */
  function J(s, d) { try { return JSON.parse(s); } catch (e) { return d; } }
  function info() { st.info = TVB ? J(TVB.info(), {}) : {}; return st.info; }
  var handlers = {};
  g.__tv = function (kind, data) { var h = handlers[kind]; if (h) try { h(data || {}); } catch (e) { setTimeout(function () { throw e; }); } };
  function acil(which) { if (!TVB || !TVB.openSettings(which)) ui.toast(T('tv.open.fail'), 'error'); }

  /* ---------- çizim yardımcıları ---------- */
  function btn(spec, label, icon, onClick, attrs) {
    var b = el('button.btn' + (spec ? '.' + spec : ''), Object.assign({ type: 'button' }, attrs || {}));
    b.innerHTML = (icon ? ui.icon(icon) : '') + '<span>' + ui.esc(label) + '</span>';
    b.addEventListener('click', onClick);
    return b;
  }
  function check(on, label, sub, onClick, key) {
    var b = el('button.tv-check' + (on ? '.on' : ''), { type: 'button', role: 'checkbox', 'aria-checked': String(!!on), 'data-k': key });
    b.innerHTML = '<span class="box">' + (on ? ui.icon('check') : '') + '</span><span class="tx"><span class="t1"></span>' + (sub ? '<span class="t2"></span>' : '') + '</span>';
    b.querySelector('.t1').textContent = label; if (sub) b.querySelector('.t2').textContent = sub;
    b.addEventListener('click', onClick);
    return b;
  }
  function card(title, icon, desc, kids, cls) {
    var c = el('section.card.tv-card' + (cls ? '.' + cls : ''));
    if (title) c.appendChild(el('h3.card-title', { html: (icon ? ui.icon(icon) : '') + '<span>' + ui.esc(title) + '</span>' }));
    if (desc) c.appendChild(el('p.card-desc', { text: desc }));
    (kids || []).forEach(function (k) { if (k) c.appendChild(k); });
    return c;
  }
  function row(kids, cls) { return el('div.fc-row' + (cls ? '.' + cls : ''), null, kids.filter(Boolean)); }
  function notice(kind, text) { return el('div.notice' + (kind ? '.' + kind : ''), { text: text }); }
  function bar(frac, cls) { var b = el('div.tv-bar' + (cls ? '.' + cls : '')); b.appendChild(el('i', { style: 'width:' + Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%' })); return b; }
  function dur(ms) { var d = B.duration(ms); return d.d ? T('tv.dur.dh', d) : T('tv.dur.hm', d); }
  function when(ts) {
    try { return new Date(ts).toLocaleString(L() === 'ar' ? 'ar-u-nu-latn' : L() === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }

  /* ---------- kabuk ---------- */
  function nav() {
    var n = $('nav'); n.innerHTML = '';
    PAGES.forEach(function (p) {
      var b = el('button.nav-item' + (st.page === p.id ? '.active' : ''), { type: 'button', 'data-k': 'nav-' + p.id, 'aria-current': st.page === p.id ? 'page' : null });
      b.innerHTML = ui.icon(p.icon) + '<span>' + ui.esc(T('tv.nav.' + p.id)) + '</span>' + (p.id === 'setup' ? setupBadge() : '') + (p.id === 'trash' && st.info.trashBytes ? '<span class="nav-badge muted">' + ui.esc(mb(st.info.trashBytes)) + '</span>' : '');
      b.addEventListener('click', function () { go(p.id); });
      n.appendChild(b);
    });
    $('brandName').textContent = T('tv.app');
    $('brandTag').textContent = T('tv.tag');
    $('ver').textContent = 'v' + g.Kabuk.version;
  }
  function setupBadge() {
    var c = B.setupCount(B.setupSteps(st.info));
    return TVB && c.done < c.total ? '<span class="nav-badge">' + c.done + '/' + c.total + '</span>' : '';
  }
  function go(id, keepFocus) {
    if (id !== st.page) $('content').scrollTop = 0;
    st.page = id;
    if (id === 'trash') loadTrash();
    if (id === 'apps' && st.apps.state === 'idle') loadApps();
    render(keepFocus);
    if (!keepFocus) { var a = $('content').querySelector('[data-autofocus]'); var nb = g.document.querySelector('[data-k="nav-' + id + '"]'); Dpad.focus(a || nb); }
  }
  function render(keepFocus) {
    var act = g.document.activeElement, key = act && act.getAttribute && act.getAttribute('data-k');
    nav();
    $('pageTitle').textContent = T('tv.nav.' + st.page);
    $('pageSub').textContent = T('tv.sub.' + st.page);
    var c = $('content');
    if (st.page === 'settings') { showSettings(c); }
    else {
      if (settingsGrid && settingsGrid.parentNode) settingsGrid.parentNode.removeChild(settingsGrid);
      c.innerHTML = '';
      if (!TVB) c.appendChild(notice('', T('tv.demo')));
      ({ home: home, clean: clean, apps: apps, speed: speed, net: net, trash: trash, setup: setup })[st.page](c);
    }
    g.document.documentElement.setAttribute('data-page', st.page);
    if (keepFocus) {
      var n = key && g.document.querySelector('[data-k="' + key + '"]');
      if (n && !n.disabled) Dpad.focus(n);
      else if (!g.document.querySelector('.modal-backdrop') && (!g.document.activeElement || g.document.activeElement === g.document.body)) Dpad.focus(Dpad.first($('content')) || g.document.querySelector('.nav-item.active'));
    }
  }
  function refresh() { info(); render(true); }

  /* ---------- bakım ---------- */
  function bakim(oto) {
    if (st.run === 'busy') return;
    st.run = 'busy'; render(true);
    if (TVB) { var r = J(TVB.clearOwnCache(), {}); st.ownFreed = r.freed || 0; }
    info();
    S.set('tv.last', Date.now());
    if (TVB && st.info.storagePerm) scan(oto);
    else { if (TVB) st.scan = { state: 'noperm', items: [], groups: [], sel: null, open: {} }; st.run = 'done'; render(true); }
  }
  function scan(oto) {
    if (!TVB) return;
    st.scan = { state: 'scanning', items: [], groups: [], sel: null, scanned: 0, found: 0, truncated: false, open: {}, auto: !!oto };
    render(true);
    TVB.scan();
  }
  handlers.scanProgress = function (d) {
    st.scan.scanned = d.scanned; st.scan.found = d.found;
    var p = g.document.querySelector('[data-scan-progress]'); if (p) p.textContent = T('tv.clean.scanning', { n: B.num(d.scanned, 0, L()), f: B.num(d.found, 0, L()) });
  };
  handlers.scan = function (d) {
    var auto = st.scan.auto;
    if (!d.ok) { st.scan = { state: d.needPermission ? 'noperm' : 'error', items: [], groups: [], sel: null, open: {}, error: d.error }; }
    else {
      st.scan = { state: 'done', items: d.items || [], groups: B.group(d.items), sel: B.newSelection(), scanned: d.scanned, truncated: !!d.truncated, open: {} };
      if (auto && S.get('tv.autoTrash', false)) {
        var c = B.certainIds(st.scan.items);
        if (c.count) { st.pendingAuto = true; TVB.trash(JSON.stringify(c.ids)); }
      }
    }
    if (st.run === 'busy') st.run = 'done';
    render(true);
  };
  handlers.trashed = function (d) {
    var moved = {}, auto = st.pendingAuto; st.pendingAuto = false;
    ui.toast(auto ? T('tv.set.autoMoved', { n: d.moved || 0, mb: mb(d.bytes) }) : T('tv.clean.moved', { n: d.moved || 0, mb: mb(d.bytes) }), 'ok', 6000);
    if (d.failed) ui.toast(T('tv.clean.movedFail', { n: d.failed }), 'error', 6000);
    // taşınanları listeden çıkar (köprü taşınamayanları bırakır; yeniden taramadan önce dosya durumunu bilmiyoruz → taşınması istenenler)
    (st.lastMove || []).forEach(function (id) { moved[id] = true; });
    if (auto) B.certainIds(st.scan.items).ids.forEach(function (id) { moved[id] = true; });
    st.lastMove = null;
    if (!d.failed) {
      st.scan.items = st.scan.items.filter(function (it) { return !moved[it.id]; });
      st.scan.groups = B.group(st.scan.items);
    } else if (TVB) { scan(false); return; }
    info(); render(true);
  };

  /* ---------- Genel bakış ---------- */
  function home(c) {
    var i = st.info, last = S.get('tv.last', null), busy = st.run === 'busy' || st.scan.state === 'scanning';
    var hero = el('section.card.tv-hero');
    var left = el('div.grow');
    left.appendChild(el('h2', { text: T('tv.run') }));
    left.appendChild(el('p.muted', { text: T('tv.run.desc') }));
    left.appendChild(el('p.tv-small', { text: last ? T('tv.run.last', { t: when(last) }) : T('tv.run.never') }));
    hero.appendChild(left);
    var go_ = btn('primary.big', busy ? T('tv.run.busy') : T('tv.run'), busy ? 'sync' : 'play', function () { bakim(false); }, { 'data-autofocus': '', 'data-k': 'run' });
    if (busy) { go_.disabled = true; go_.querySelector('svg').classList.add('fc-spin'); }
    hero.appendChild(go_);
    c.appendChild(hero);
    // sonuç
    var s = st.scan;
    if (s.state === 'scanning') c.appendChild(notice('', T('tv.clean.scanning', { n: B.num(s.scanned, 0, L()), f: B.num(s.found, 0, L()) }))).setAttribute('data-scan-progress', '');
    else if (s.state === 'noperm') c.appendChild(row([notice('warn', T('tv.run.noPerm')), btn('small', T('tv.setup.grant'), 'key', izinDosya, { 'data-k': 'h-perm' })], 'tv-result'));
    else if (s.state === 'done') {
      var tot = B.selected(B.newSelection(), s.items);
      if (tot.count) c.appendChild(row([el('div.notice.warn.grow', { text: T('tv.run.found', { mb: mb(tot.bytes), n: B.num(tot.count, 0, L()) }) }),
        btn('small.primary', T('tv.clean.move'), 'trash', function () { tasiOnay(tot.ids, tot.bytes); }, { 'data-k': 'h-move' }),
        btn('small', T('tv.clean.showFiles'), 'list', function () { go('clean'); }, { 'data-k': 'h-show' })], 'tv-result'));
      else c.appendChild(notice('ok', T('tv.run.none')));
    }
    // durum kutuları
    var d = B.disk(i), a = B.anim(i), up = B.duration(i.uptimeMs);
    var grid = el('div.tv-stats');
    grid.appendChild(stat('box', T('tv.st.storage'), i.diskTotal ? T('tv.st.free', { a: mb(i.diskFree), b: mb(i.diskTotal) }) : '—', bar(d.used, d.low ? 'bad' : ''), d.low ? T('tv.st.diskLow') : null));
    grid.appendChild(stat('gauge', T('tv.st.ram'), i.ramTotal ? T('tv.st.free', { a: mb(i.ramFree), b: mb(i.ramTotal) }) : '—', bar(i.ramTotal ? 1 - i.ramFree / i.ramTotal : 0, i.lowMem ? 'bad' : ''), T('tv.st.ramNote')));
    grid.appendChild(stat('zap', T('tv.st.anim'), a.state === 'fast' ? T('tv.st.animFast', { v: B.scaleText(a.value) }) : a.state === 'off' ? T('tv.st.animOff') : a.state === 'default' ? T('tv.st.animDefault', { v: B.scaleText(a.value) }) : '—', null, null, a.state === 'default' ? function () { go('speed'); } : null));
    grid.appendChild(stat('tv', T('tv.st.uptime'), i.uptimeMs ? dur(i.uptimeMs) : '—', null, up.d >= 7 ? T('tv.st.uptimeHint') : (i.model ? (i.brand || '') + ' ' + i.model + ' · Android ' + (i.android || '') : null)));
    c.appendChild(grid);
    // kurulum özeti
    if (TVB) {
      var cnt = B.setupCount(B.setupSteps(i));
      if (cnt.done < cnt.total) c.appendChild(row([el('div.grow', null, [el('b', { text: T('tv.setup.title') }), ' · ', el('span.muted', { text: T('tv.setup.count', { a: cnt.done, b: cnt.total }) })]),
        btn('small', T('tv.setup.open'), 'list', function () { go('setup'); }, { 'data-k': 'h-setup' })], 'tv-setup-sum card'));
    }
  }
  function stat(icon, title, value, barEl, note, onClick) {
    var s = el(onClick ? 'button.tv-stat.clickable' : 'div.tv-stat', onClick ? { type: 'button', 'data-k': 'stat-' + icon } : null);
    s.appendChild(el('div.tv-stat-h', { html: ui.icon(icon) + '<span>' + ui.esc(title) + '</span>' }));
    s.appendChild(el('div.tv-stat-v', { text: value }));
    if (barEl) s.appendChild(barEl);
    if (note) s.appendChild(el('div.tv-stat-n', { text: note }));
    if (onClick) s.addEventListener('click', onClick);
    return s;
  }

  /* ---------- Temizlik ---------- */
  function clean(c) {
    var i = st.info;
    // gereksiz dosyalar
    var s = st.scan, kids = [];
    if (s.state === 'scanning') {
      kids.push(el('p.muted', { text: T('tv.clean.scanning', { n: B.num(s.scanned, 0, L()), f: B.num(s.found, 0, L()) }), 'data-scan-progress': '' }));
      kids.push(row([btn('small', T('tv.clean.cancel'), 'x', function () { if (TVB) TVB.cancelScan(); }, { 'data-k': 'scan-stop' })]));
    } else if (s.state === 'noperm' || (TVB && !i.storagePerm)) {
      kids.push(notice('warn', T('tv.run.noPerm')));
      kids.push(row([btn('small.primary', T('tv.setup.grant'), 'key', izinDosya, { 'data-k': 'perm', 'data-autofocus': '' })]));
    } else {
      kids.push(row([btn('small' + (s.state === 'done' ? '' : '.primary'), s.state === 'done' ? T('tv.clean.rescan') : T('tv.clean.scan'), 'sync', function () { scan(false); }, { 'data-k': 'scan', 'data-autofocus': '' })]));
    }
    if (s.state === 'done') {
      if (s.truncated) kids.push(notice('warn', T('tv.clean.cut', { n: s.items.length })));
      if (!s.groups.length) kids.push(notice('ok', T('tv.run.none')));
      s.groups.forEach(function (gr) {
        var on = !!s.sel.cats[gr.cat];
        var head = el('div.tv-group');
        head.appendChild(check(on, T('tv.cat.' + gr.cat) + ' · ' + B.num(gr.count, 0, L()) + ' · ' + mb(gr.bytes), T('tv.cat.' + gr.cat + '.d'), function () { B.toggleCat(s.sel, s.groups, gr.cat); render(true); }, 'cat-' + gr.cat));
        head.appendChild(btn('small.ghost', s.open[gr.cat] ? T('tv.clean.hideFiles') : T('tv.clean.showFiles'), 'list', function () { s.open[gr.cat] = !s.open[gr.cat]; render(true); }, { 'data-k': 'open-' + gr.cat }));
        kids.push(head);
        if (s.open[gr.cat]) {
          var list = el('div.tv-files');
          gr.items.slice(0, 60).forEach(function (it) {
            list.appendChild(check(B.isSelected(s.sel, it), it.rel, mb(it.size) + ' · ' + when(it.mtime), function () { B.toggleItem(s.sel, it); render(true); }, 'f-' + it.id));
          });
          if (gr.items.length > 60) list.appendChild(el('p.tv-small', { text: T('tv.clean.more', { n: gr.items.length - 60 }) }));
          kids.push(list);
        }
      });
      var sel = B.selected(s.sel, s.items);
      if (s.items.length) kids.push(row([el('b.grow', { text: T('tv.clean.selected', { n: B.num(sel.count, 0, L()), mb: mb(sel.bytes) }) }),
        btn('primary', T('tv.clean.move'), 'trash', function () { tasiOnay(sel.ids, sel.bytes); }, { disabled: sel.count ? null : true, 'data-k': 'move' })], 'tv-sticky'));
    } else if (s.state === 'error') kids.push(notice('error', String(s.error || '')));
    c.appendChild(card(T('tv.clean.junk'), 'trash', T('tv.clean.junk.d'), kids));
    c.appendChild(el('section.card.tv-card.tv-inline', null, [el('div.grow', null, [el('b', { text: T('tv.clean.own') }), el('div.tv-small', { text: T('tv.clean.own.d', { mb: mb(i.ownCache || 0) }) })]),
      btn('small', T('tv.clean.own.btn'), 'sparkles', function () {
        var r = TVB ? J(TVB.clearOwnCache(), {}) : { freed: 0 };
        ui.toast(T('tv.clean.own.done', { mb: mb(r.freed || 0) }), 'ok'); refresh();
      }, { 'data-k': 'own' })]));
    c.appendChild(card(T('tv.clean.others'), 'grid', T('tv.clean.others.d'), [row([
      btn('small', T('tv.clean.others.btn'), 'grid', function () { go('apps'); }, { 'data-k': 'to-apps' }),
      btn('small', T('tv.clean.storageSet'), 'ext', function () { acil('storage'); }, { 'data-k': 'set-storage' })])]));
  }
  function tasiOnay(ids, bytes) {
    if (!ids.length) return;
    var body = el('div', null, [el('p', { text: T('tv.clean.confirm', { n: B.num(ids.length, 0, L()), mb: mb(bytes) }) })]);
    ui.modal({ title: T('tv.clean.confirmT'), icon: 'trash', cls: 'small', body: body, buttons: [
      { label: T('tv.trash.no'), cls: 'ghost' }, 'spacer',
      { label: T('tv.clean.move'), cls: 'primary', icon: 'trash', onClick: function () { if (TVB) { st.lastMove = ids.slice(); TVB.trash(JSON.stringify(ids)); } } }
    ] });
  }
  function izinDosya() {
    if (!TVB) return;
    var r = TVB.requestStorage();
    if (r === 'unavailable') ui.toast(T('tv.setup.unavailable'), 'error', 8000);
    if (r === 'granted') refresh();
  }

  /* ---------- Uygulamalar ---------- */
  function loadApps() { if (!TVB) { st.apps.state = 'done'; return; } st.apps.state = 'loading'; TVB.apps(); }
  handlers.apps = function (d) { st.apps = { state: 'done', items: B.sortApps(d.items), usage: !!d.usage }; if (st.page === 'apps') render(true); };
  function apps(c) {
    var a = st.apps, i = st.info;
    if (TVB && i.usageSizes && !a.usage) c.appendChild(row([el('div.notice.warn.grow', { text: T('tv.apps.usageNeed') }), btn('small.primary', T('tv.setup.grant'), 'key', function () { acil('usage'); }, { 'data-k': 'usage' })], 'tv-result'));
    if (a.state === 'loading') { c.appendChild(el('p.muted', { text: T('tv.apps.loading') })); return; }
    if (!a.items.length) { c.appendChild(el('p.muted', { text: T('tv.apps.none') })); return; }
    var top = a.items.reduce(function (m, x) { return Math.max(m, B.appTotal(x)); }, 1), sum = a.items.reduce(function (m, x) { return m + B.appTotal(x); }, 0);
    c.appendChild(row([el('span.muted.grow', { text: T('tv.apps.count', { n: a.items.length, mb: mb(sum) }) }), btn('small.ghost', T('tv.clean.rescan'), 'sync', function () { loadApps(); render(true); }, { 'data-k': 'apps-reload' })]));
    var list = el('div.tv-apps');
    a.items.forEach(function (x, n) {
      var r = el('div.tv-app');
      var txt = el('div.grow');
      txt.appendChild(el('div.tv-app-n', null, [el('b', { text: x.name, dir: 'auto' }), x.sys ? el('span.badge', { text: T('tv.apps.sys') }) : null]));
      txt.appendChild(el('div.tv-small', { text: x.app != null ? T('tv.apps.size', { a: mb(x.app), b: mb(x.data), c: mb(x.cache) }) : T('tv.apps.apkOnly', { a: mb(x.apk) }) }));
      txt.appendChild(bar(B.appTotal(x) / top));
      r.appendChild(el('b.tv-app-s', { text: mb(B.appTotal(x)) }));
      r.appendChild(txt);
      r.appendChild(btn('small', T('tv.apps.open'), 'open', function () { if (!TVB.openApp(x.pkg)) ui.toast(T('tv.apps.cantOpen'), 'error'); }, { 'data-k': 'ao-' + x.pkg, 'data-autofocus': n === 0 ? '' : null }));
      r.appendChild(btn('small', T('tv.apps.details'), 'info', function () { if (!TVB.appDetails(x.pkg)) ui.toast(T('tv.apps.cantOpen'), 'error'); }, { 'data-k': 'ad-' + x.pkg }));
      if (!x.sys) r.appendChild(btn('small.danger-ghost', T('tv.apps.uninstall'), 'trash', function () { st.apps.state = 'stale'; if (!TVB.uninstall(x.pkg)) ui.toast(T('tv.apps.cantOpen'), 'error'); }, { 'data-k': 'au-' + x.pkg }));
      list.appendChild(r);
    });
    c.appendChild(list);
    c.appendChild(el('p.tv-small', { text: T('tv.apps.detailsHint') }));
  }

  /* ---------- Ekran hızı ---------- */
  function speed(c) {
    var i = st.info, a = B.anim(i);
    var vals = el('div.tv-scales');
    [['window', 'animWindow'], ['transition', 'animTransition'], ['animator', 'animator']].forEach(function (p) {
      var v = i[p[1]];
      vals.appendChild(el('div.tv-scale' + (v != null && v <= 0.5 ? '.ok' : ''), null, [el('span', { text: T('tv.speed.' + p[0]) }), el('b', { text: v == null ? '—' : B.scaleText(+v) })]));
    });
    c.appendChild(card(T('tv.speed.now'), 'zap', null, [vals, notice(a.state === 'fast' || a.state === 'off' ? 'ok' : '', a.state === 'fast' || a.state === 'off' ? T('tv.speed.good') : T('tv.speed.can')), el('p.tv-small', { text: T('tv.speed.why') })]));
    var hizli = a.state === 'fast' || a.state === 'off';
    if (i.devRestricted) {
      // Kısıtlı profil / yönetilen kullanıcı: TV "Geliştirici seçenekleri kullanılamaz" der; çözüm ana (sahip) kullanıcıya geçmek.
      c.appendChild(card(T('tv.speed.restricted'), 'key', null, [notice('warn', T('tv.speed.restricted.d')),
        row([btn('small.primary', T('tv.speed.users'), 'ext', function () { acil('users'); }, { 'data-k': 'users', 'data-autofocus': '' })])]));
    } else if (!hizli) {
      var steps = el('ol.tv-steps');
      if (!i.devOptions) {
        // 1. adım: önce "Derleme" 7 kez — bu yapılmadan Geliştirici seçenekleri açılmaz ("kapalı / kullanılamaz" uyarısı bundan).
        steps.appendChild(el('li', null, [el('span', { text: T('tv.speed.step1') }), el('p.tv-small', { text: T('tv.speed.devLocked') }),
          el('p.tv-small', { text: T('tv.speed.paths') }),
          row([btn('small.primary', T('tv.speed.about'), 'info', function () { acil('about'); }, { 'data-k': 'about', 'data-autofocus': '' })])]));
        steps.appendChild(el('li', null, [el('span', { text: T('tv.speed.step2wait') })]));
      } else {
        steps.appendChild(el('li.done', null, [el('span', { text: T('tv.speed.step1ok') })]));
        steps.appendChild(el('li', null, [el('span', { text: T('tv.speed.step2') }),
          row([btn('small.primary', T('tv.setup.openDev'), 'ext', function () { if (!TVB || !TVB.openSettings('dev')) ui.toast(T('tv.speed.devFail'), 'error', 8000); }, { 'data-k': 'dev', 'data-autofocus': '' })])]));
      }
      steps.appendChild(el('li', null, [el('span', { text: T('tv.speed.step3') })]));
      c.appendChild(card(T('tv.setup.howto'), 'list', null, [steps]));
      if (i.accessScreen) c.appendChild(card(T('tv.speed.alt'), 'sparkles', null, [el('p.tv-small', { text: T('tv.speed.alt.d') }),
        row([btn('small', T('tv.speed.openAccess'), 'ext', function () { acil('access'); }, { 'data-k': 'access' })])]));
    }
    var tips = el('ul.tv-tips');
    ['tip1', 'tip2', 'tip3'].forEach(function (k) { tips.appendChild(el('li', { text: T('tv.speed.' + k) })); });
    c.appendChild(card(T('tv.speed.tips'), 'sparkles', null, [tips]));
  }

  /* ---------- Ağ testi ---------- */
  handlers.net = function (d) {
    if (d.phase === 'error') st.net = { state: 'done', r: st.net.r, error: d.error };
    else st.net = { state: d.phase === 'done' ? 'done' : 'busy', r: d.result || st.net.r };
    if (st.page === 'net') render(true);
  };
  function net(c) {
    var n = st.net, r = n.r || {}, busy = n.state === 'busy';
    var b = btn('primary.big', busy ? T('tv.net.busy') : n.state === 'done' ? T('tv.net.again') : T('tv.net.start'), busy ? 'sync' : 'play', function () {
      if (!TVB) return; st.net = { state: 'busy', r: null }; render(true); TVB.netTest();
    }, { 'data-autofocus': '', 'data-k': 'net-start' });
    if (busy) { b.disabled = true; b.querySelector('svg').classList.add('fc-spin'); }
    c.appendChild(row([b, btn('small', T('tv.net.settings'), 'ext', function () { acil('network'); }, { 'data-k': 'net-set' }), el('span.tv-small.grow', { text: T('tv.net.note') })], 'tv-hero-row'));
    var ms = function (v) { return v == null ? '…' : v < 0 ? T('tv.net.fail') : T('tv.net.ms', { n: B.num(v, 0, L()) }); };
    var grid = el('div.tv-stats');
    grid.appendChild(stat('wifi', T('tv.net.link'), r.type ? (r.connected ? T('tv.net.' + (r.type === 'wifi' || r.type === 'ethernet' ? r.type : 'other')) : T('tv.net.none')) : '—'));
    grid.appendChild(stat('globe', T('tv.net.dns'), r.type && r.connected ? ms(r.dnsMs) : '—'));
    grid.appendChild(stat('gauge', T('tv.net.ping'), r.type && r.connected ? ms(r.pingMs) : '—'));
    grid.appendChild(stat('download', T('tv.net.down'), r.mbps != null ? (r.downBytes > 0 ? T('tv.net.mbps', { n: B.num(r.mbps, 1, L()) }) : T('tv.net.fail')) : r.type && r.connected && busy ? '…' : '—'));
    c.appendChild(grid);
    if (n.state === 'done' && r.connected && r.mbps != null && r.downBytes > 0) {
      var k = B.netRating(r.mbps, r.pingMs);
      c.appendChild(notice(k === 'excellent' || k === 'good' ? 'ok' : k === 'ok' ? 'warn' : 'error', T('tv.net.r.' + k)));
    }
    if (n.error) c.appendChild(notice('error', String(n.error)));
  }

  /* ---------- Çöp kutusu ---------- */
  function loadTrash() {
    var d = TVB ? J(TVB.trashList(), { items: [], total: 0 }) : { items: [], total: 0, permission: true };
    var items = (d.items || []).sort(function (a, b) { return b.at - a.at; });
    var sel = {}; items.forEach(function (x) { if (st.trash.sel[x.id]) sel[x.id] = true; });
    st.trash = { items: items, total: d.total || 0, sel: sel, permission: d.permission !== false, folder: d.folder || 'TVBakim-CopKutusu' };
  }
  handlers.restored = function (d) {
    ui.toast(T('tv.trash.restored', { n: d.ok || 0 }), 'ok'); if (d.failed) ui.toast(T('tv.trash.restoreFail', { n: d.failed }), 'error');
    st.trash.sel = {}; loadTrash(); refresh();
  };
  handlers.emptied = function (d) {
    if (d.cancelled) ui.toast(T('tv.trash.cancelled'));
    else ui.toast(T('tv.trash.deleted', { n: d.count || 0, mb: mb(d.bytes) }), 'ok');
    st.trash.sel = {}; loadTrash(); refresh();
  };
  function trash(c) {
    var t = st.trash;
    if (TVB && !t.permission) { c.appendChild(notice('warn', T('tv.trash.noPerm'))); c.appendChild(row([btn('small.primary', T('tv.setup.grant'), 'key', izinDosya, { 'data-k': 'perm', 'data-autofocus': '' })])); return; }
    if (!t.items.length) { c.appendChild(notice('ok', T('tv.trash.empty'))); c.appendChild(el('p.tv-small', { text: T('tv.trash.folder', { f: t.folder || 'TVBakim-CopKutusu' }) })); return; }
    var ids = Object.keys(t.sel).filter(function (k) { return t.sel[k]; }), selBytes = t.items.filter(function (x) { return t.sel[x.id]; }).reduce(function (m, x) { return m + x.size; }, 0);
    var all = ids.length === t.items.length;
    c.appendChild(row([el('b.grow', { text: T('tv.trash.total', { n: B.num(t.items.length, 0, L()), mb: mb(t.total) }) }),
      btn('small', all ? T('tv.trash.selectNone') : T('tv.trash.selectAll'), 'check', function () { t.sel = {}; if (!all) t.items.forEach(function (x) { t.sel[x.id] = true; }); render(true); }, { 'data-k': 'tsel', 'data-autofocus': '' }),
      btn('small.primary', T('tv.trash.restore') + (ids.length ? ' (' + ids.length + ')' : ''), 'undo', function () { if (ids.length && TVB) TVB.restore(JSON.stringify(ids)); }, { disabled: ids.length ? null : true, 'data-k': 'trest' }),
      btn('small.danger-ghost', T('tv.trash.delete') + (ids.length ? ' (' + ids.length + ')' : ''), 'trash', function () {
        if (!ids.length || !TVB) return;
        TVB.emptyTrash(JSON.stringify(ids), T('tv.trash.confirmT'), T('tv.trash.confirm', { n: ids.length, mb: mb(selBytes) }), T('tv.trash.yes'), T('tv.trash.no'));
      }, { disabled: ids.length ? null : true, 'data-k': 'tdel' })], 'tv-sticky'));
    var list = el('div.tv-files');
    t.items.slice(0, 300).forEach(function (x) {
      list.appendChild(check(!!t.sel[x.id], x.name, mb(x.size) + ' · ' + when(x.at) + ' · ' + T('tv.trash.from', { p: x.orig }), function () { t.sel[x.id] = !t.sel[x.id]; render(true); }, 't-' + x.id));
    });
    c.appendChild(list);
    c.appendChild(el('p.tv-small', { text: T('tv.trash.folder', { f: t.folder }) }));
  }

  /* ---------- Kurulum ---------- */
  function setup(c) {
    var i = st.info;
    c.appendChild(el('p.muted.tv-intro', { text: T('tv.setup.intro') }));
    var steps = B.setupSteps(TVB ? i : { storagePerm: false, usageSizes: true, sdk: 30 });
    var list = el('div.tv-setup');
    var first = true;
    steps.forEach(function (s) {
      var r = el('div.tv-setup-row' + (s.done ? '.done' : s.need ? '' : '.na'));
      r.appendChild(el('span.tv-dot', { html: s.done ? ui.icon('check') : s.need ? ui.icon('alert') : ui.icon('minus') }));
      var tx = el('div.grow');
      tx.appendChild(el('b', { text: T('tv.setup.' + s.id) }));
      tx.appendChild(el('span.badge', { text: s.done ? T('tv.setup.ok') : !s.need ? T('tv.setup.na') : s.optional ? T('tv.setup.optional') : T('tv.setup.todo') }));
      tx.appendChild(el('div.tv-small', { text: T('tv.setup.' + s.id + '.d') }));
      r.appendChild(tx);
      var act = null, auto = !s.done && s.need && first ? '' : null;
      if (s.id === 'storage' && !s.done) act = btn('small.primary', T('tv.setup.grant'), 'key', izinDosya, { 'data-k': 'su-storage', 'data-autofocus': auto });
      if (s.id === 'usage' && !s.done && s.need) act = btn('small', T('tv.setup.grant'), 'key', function () { acil('usage'); }, { 'data-k': 'su-usage', 'data-autofocus': auto });
      if (s.id === 'anim' && !s.done) act = btn('small', T('tv.setup.howto'), 'zap', function () { go('speed'); }, { 'data-k': 'su-anim', 'data-autofocus': auto });
      if (s.id === 'install' && !s.done && s.need) act = btn('small', T('tv.setup.grant'), 'key', function () { acil('unknown'); }, { 'data-k': 'su-install', 'data-autofocus': auto });
      if (s.id === 'old') act = btn('small.danger-ghost', T('tv.setup.remove'), 'trash', function () { if (TVB && !TVB.uninstall('tr.tvbakim')) ui.toast(T('tv.apps.cantOpen'), 'error'); }, { 'data-k': 'su-old', 'data-autofocus': auto });
      if (s.id === 'adb') act = btn('small', T('tv.setup.openDev'), 'ext', function () { acil('dev'); }, { 'data-k': 'su-adb', 'data-autofocus': auto });
      if (act) { r.appendChild(act); if (auto != null) first = false; }
      list.appendChild(r);
    });
    c.appendChild(list);
    c.appendChild(el('p.tv-small', { text: T('tv.dpad') }));
  }

  /* ---------- Ayarlar (çekirdek kartları + bakım + Android kısayolları; Admin ile iletişim EN SON) ---------- */
  var settingsGrid = null, maintCard = null, androidCard = null;
  function drawMaint() {
    maintCard.innerHTML = '';
    maintCard.appendChild(el('h3.card-title', { html: ui.icon('sparkles') + '<span>' + ui.esc(T('tv.set.maint')) + '</span>' }));
    maintCard.appendChild(el('p.card-desc', { text: T('tv.set.maint.d') }));
    var auto = S.get('tv.auto', true), at = S.get('tv.autoTrash', false);
    maintCard.appendChild(check(auto, T('tv.set.auto'), null, function () { S.set('tv.auto', !auto); drawMaint(); Dpad.focus(maintCard.querySelector('[data-k="s-auto"]')); }, 's-auto'));
    maintCard.appendChild(check(at, T('tv.set.autoTrash'), T('tv.set.autoTrash.d'), function () { S.set('tv.autoTrash', !at); drawMaint(); Dpad.focus(maintCard.querySelector('[data-k="s-autotrash"]')); }, 's-autotrash'));
  }
  function drawAndroid() {
    androidCard.innerHTML = '';
    androidCard.appendChild(el('h3.card-title', { html: ui.icon('tv') + '<span>' + ui.esc(T('tv.set.android')) + '</span>' }));
    androidCard.appendChild(el('p.card-desc', { text: T('tv.set.android.d') }));
    var r = el('div.fc-row.tv-wrap');
    [['main', 'settings'], ['storage', 'box'], ['apps', 'grid'], ['display', 'tv'], ['wifi', 'wifi'], ['date', 'info'], ['lang', 'globe'], ['about', 'info'], ['dev', 'zap']].forEach(function (p) {
      r.appendChild(btn('small', T('tv.set.s.' + p[0]), p[1], function () { acil(p[0]); }, { 'data-k': 'as-' + p[0] }));
    });
    androidCard.appendChild(r);
  }
  function showSettings(c) {
    c.innerHTML = '';
    if (!settingsGrid) {
      maintCard = el('section.card', { 'data-fc-card': 'tv-maint' }); androidCard = el('section.card', { 'data-fc-card': 'tv-android' });
      var holder = el('div');
      settingsGrid = g.Kabuk.ayarlar(holder, [maintCard, androidCard], g.Kabuk.rehberAyar(function () { go('setup'); })).el;
    }
    drawMaint(); drawAndroid();
    c.appendChild(settingsGrid);
    var f = settingsGrid.querySelector('button'); if (f) f.setAttribute('data-autofocus', '');
  }

  /* ---------- Geri / Menü / dönüş ---------- */
  g.__tvGeri = function () {
    var m = g.document.querySelectorAll('.modal-backdrop');
    if (m.length) { var x = m[m.length - 1].querySelector('.modal-header .icon-btn'); if (x) x.click(); else m[m.length - 1].remove(); return true; }
    var uf = g.document.querySelector('.update-float:not([hidden])');
    if (uf && uf.contains(g.document.activeElement)) { Dpad.focus(g.document.querySelector('.update-act')); return true; }
    if (st.page !== 'home') { go('home'); return true; }
    return false;
  };
  g.__tvMenu = function () { go('settings'); };
  g.__tvResume = function () {
    var once = st.info.storagePerm;
    info();
    if (st.apps.state === 'stale' || (st.page === 'apps' && st.apps.state === 'done')) loadApps();
    if (st.page === 'trash') loadTrash();
    if (!once && st.info.storagePerm && st.scan.state !== 'scanning' && (st.page === 'clean' || st.page === 'home' || st.page === 'setup')) { if (st.page !== 'setup') scan(false); }
    render(true);
  };

  /* ---------- açılış ---------- */
  function start() {
    Dpad.install();
    g.Kabuk.ustCubuk($('topbar'), function () { go('settings'); });
    FC.i18n.onChange(function () { render(true); if (maintCard) { drawMaint(); drawAndroid(); } });
    info();
    render();
    Dpad.focus(Dpad.first($('content')) || g.document.querySelector('.nav-item'));
    var ilk = g.Kabuk.ilkAcilis(function () { go('setup'); });
    if (TVB && S.get('tv.auto', true)) bakim(true);
    else if (!ilk && TVB && g.Kabuk.legacy) go('setup');
  }
  if (g.document.readyState === 'loading') g.document.addEventListener('DOMContentLoaded', start); else start();
  g.TVApp = { state: st, go: go, render: render };
})(typeof globalThis !== 'undefined' ? globalThis : this);
