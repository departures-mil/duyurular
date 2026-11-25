/* Program İndirme Merkezi — veri: veri.json (GitHub'dan her 15 dk), tanıtım: programlar.json */
(function () {
  'use strict';
  var M = window.METIN, L = 'tr', VERI = null, META = { programlar: {}, kategoriler: {} }, LISTE = [];
  var filtre = { q: '', p: '', k: '' };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var T = function (k) { return (M[L] && M[L][k] != null) ? M[L][k] : M.tr[k]; };
  var ua = navigator.userAgent || '';
  var CIHAZ = /Android/i.test(ua) ? 'apk' : /Windows/i.test(ua) ? 'desktop' : '';

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  /* ---------- dil ---------- */
  function ilkDil() {
    var q = (location.search.match(/[?&]lang=(tr|en|ar)/) || [])[1];
    if (q) return q;
    var s = store('dil'); if (s && M[s]) return s;
    var n = (navigator.language || 'tr').slice(0, 2).toLowerCase();
    return M[n] ? n : 'tr';
  }
  function dilKur(l) {
    L = l; store('dil', l);
    var h = document.documentElement;
    h.lang = l; h.dir = l === 'ar' ? 'rtl' : 'ltr';
    document.title = T('baslik');
    document.querySelectorAll('[data-t]').forEach(function (e) { var v = T(e.getAttribute('data-t')); if (typeof v === 'string') e.textContent = v; });
    document.querySelectorAll('[data-tp]').forEach(function (e) { e.placeholder = T(e.getAttribute('data-tp')); });
    document.querySelectorAll('.lang button').forEach(function (b) { b.classList.toggle('on', b.dataset.lang === l); b.setAttribute('aria-pressed', b.dataset.lang === l); });
    sabitler(); temaEtiket(); formKur(); ciz();
    var id = acikId(); if (id) ac(id, true);
  }

  /* ---------- tema ---------- */
  function tema() { return store('tema') || 'auto'; }
  function temaUygula(t) {
    store('tema', t);
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    temaEtiket();
  }
  function temaEtiket() { var b = $('#tema'), t = T('tema')[tema()]; b.title = t; b.setAttribute('aria-label', t); }

  /* ---------- biçim ---------- */
  function tarih(s) {
    if (!s) return '';
    try { return new Intl.DateTimeFormat(L === 'ar' ? 'ar-u-nu-latn' : L === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s)); } catch (e) { return s.slice(0, 10); }
  }
  function sayi(n) { try { return new Intl.NumberFormat(L === 'ar' ? 'ar-u-nu-latn' : L === 'en' ? 'en-GB' : 'tr-TR').format(n || 0); } catch (e) { return String(n || 0); } }
  function mbYaz(m) { return m ? '<span class="ltr">' + sayi(m) + ' MB</span>' : ''; }
  function ad(p) { var m = META.programlar[p.id]; return (m && m.ad && (m.ad[L] || m.ad.tr)) || p.name; }
  function kisa(p) { var m = META.programlar[p.id]; return (m && m.kisa && (m.kisa[L] || m.kisa.tr)) || ''; }
  function kat(p) { var m = META.programlar[p.id]; var k = m && META.kategoriler[m.kategori]; return k ? (k[L] || k.tr) : ''; }
  function ikon(p, lg) {
    var m = META.programlar[p.id] || {}, harf = esc((ad(p) || '?').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2) || '?');
    var img = p.ikon ? '<img src="' + esc(p.ikon) + '" alt="" loading="lazy" onerror="this.remove()">' : '';
    return '<div class="ico' + (lg ? ' lg' : '') + '" style="--c:' + esc(m.renk || '#0b5cad') + '">' + harf.toUpperCase() + img + '</div>';
  }
  function ikonDuzelt() {}

  /* ---------- sabit bölümler ---------- */
  function sabitler() {
    $('#ortak').innerHTML = T('ortak').map(function (o) { return '<div><i>' + o[0] + '</i><span><b>' + esc(o[1]) + '</b><p>' + esc(o[2]) + '</p></span></div>'; }).join('');
    var li = function (a) { return a.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join(''); };
    $('#winAdim').innerHTML = li(T('rehberWinAdim'));
    $('#smartAdim').innerHTML = li(T('smartAdim'));
    $('#apkAdim').innerHTML = li(T('rehberApkAdim'));
    $('#faq').innerHTML = T('sss').map(function (q) { return '<details><summary>' + esc(q[0]) + '</summary><p>' + q[1] + '</p></details>'; }).join('');
    var ks = Object.keys(META.kategoriler);
    $('#kategori').innerHTML = ks.length ? '<button data-k="" class="' + (filtre.k ? '' : 'on') + '">' + esc(T('tumu')) + '</button>' + ks.map(function (k) {
      return '<button data-k="' + k + '" class="' + (filtre.k === k ? 'on' : '') + '">' + esc(META.kategoriler[k][L] || META.kategoriler[k].tr) + '</button>';
    }).join('') : '';
  }

  /* ---------- liste ---------- */
  function listeKur() {
    var gorulen = {};
    LISTE = (VERI ? VERI.programlar : []).filter(function (p) { return p.id !== 'ajandam'; }).map(function (p) { gorulen[p.id] = 1; return p; });
    Object.keys(META.programlar).forEach(function (id) {
      if (!gorulen[id] && META.programlar[id].yakinda) LISTE.push({ id: id, name: id, links: {}, yakinda: true, notlar: [], ekranlar: [] });
    });
    var sira = function (p) { var m = META.programlar[p.id]; return (m && m.sira) || 999; };
    LISTE.sort(function (a, b) {
      var ya = !Object.keys(a.links || {}).length, yb = !Object.keys(b.links || {}).length;
      if (ya !== yb) return ya ? 1 : -1;
      return sira(a) - sira(b) || ad(a).localeCompare(ad(b));
    });
  }
  function istatistik() {
    if (!VERI) return;
    var top = 0, n = 0;
    LISTE.forEach(function (p) { var ls = p.links || {}; if (Object.keys(ls).length) n++; Object.keys(ls).forEach(function (k) { top += ls[k].indirme || 0; }); });
    $('#stats').innerHTML = '<span class="stat"><b>' + sayi(n) + '</b>' + esc(T('programSayisi')) + '</span>' +
      '<span class="stat"><b>' + sayi(top) + '</b>' + esc(T('toplamIndirme')) + '</span>' +
      '<span class="stat"><b>' + esc(tarih(VERI.guncellendi)) + '</b>' + esc(T('sonYenileme')) + '</span>';
    $('#sonYenileme').textContent = T('sonYenileme') + ': ' + new Date(VERI.guncellendi).toLocaleString(L === 'ar' ? 'ar-u-nu-latn' : L === 'en' ? 'en-GB' : 'tr-TR');
  }
  function eslesir(p) {
    var m = META.programlar[p.id] || {};
    if (filtre.p && !(p.links && p.links[filtre.p])) return false;
    if (filtre.k && m.kategori !== filtre.k) return false;
    if (filtre.q) {
      var h = [p.name, p.id, ad(p), kisa(p)].concat(m.ad ? [m.ad.tr, m.ad.en, m.ad.ar] : []).join(' ').toLocaleLowerCase(L);
      if (h.indexOf(filtre.q.toLocaleLowerCase(L)) < 0) return false;
    }
    return true;
  }
  function indirBtn(k, l, kucuk) {
    if (!l) return '';
    var rec = CIHAZ === k ? ' rec' : '';
    return '<a class="btn ' + (k === 'apk' ? 'and' : 'win') + rec + '" href="' + esc(l.url) + '" rel="noopener"' + (rec ? ' title="' + esc(T('onerilen')) + '"' : '') + '>' +
      '<span class="os ' + (k === 'apk' ? 'and' : 'win') + '"></span><span>' + esc(T(k === 'apk' ? 'indirApk' : 'indirWin')) +
      (kucuk ? '' : '<small>' + [esc(l.version), mbYaz(l.mb)].filter(Boolean).join(' · ') + '</small>') + '</span></a>';
  }
  function kart(p) {
    var ls = p.links || {}, yok = !ls.desktop && !ls.apk;
    var pills = [];
    if (ls.desktop) pills.push('<span class="pill w"><span class="os win"></span><span class="ltr">' + esc(ls.desktop.version) + '</span> · ' + esc(tarih(ls.desktop.date)) + '</span>');
    if (ls.apk) pills.push('<span class="pill a"><span class="os and"></span><span class="ltr">' + esc(ls.apk.version) + '</span>' + (ls.apk.date ? ' · ' + esc(tarih(ls.apk.date)) : '') + '</span>');
    if (p.yakinda) pills.push('<span class="pill soon">' + esc(T('yakinda')) + '</span>');
    var ind = Object.keys(ls).reduce(function (s, k) { return s + (ls[k].indirme || 0); }, 0);
    var btns = yok ? '<span class="btn off">' + esc(p.yakinda ? T('yakindaNot') : T('kurulumYok')) + '</span>'
      : (CIHAZ === 'apk' ? indirBtn('apk', ls.apk) + indirBtn('desktop', ls.desktop) : indirBtn('desktop', ls.desktop) + indirBtn('apk', ls.apk));
    return '<article class="card' + (p.yakinda ? ' soon' : '') + '" data-id="' + esc(p.id) + '">' +
      '<div class="card-head">' + ikon(p) + '<div><div class="cat">' + esc(kat(p)) + '</div><h3>' + esc(ad(p)) + '</h3></div></div>' +
      '<p class="desc">' + esc(kisa(p)) + '</p>' +
      (pills.length ? '<div class="meta">' + pills.join('') + '</div>' : '') +
      '<div class="btns">' + btns + '</div>' +
      '<div class="card-foot"><span>' + (ind ? '⬇ ' + sayi(ind) + ' ' + esc(T('indirme')).toLocaleLowerCase(L) : '') + '</span>' +
      (yok && p.yakinda ? '' : '<button class="link" data-ac="' + esc(p.id) + '">' + esc(T('ayrinti')) + ' ›</button>') + '</div></article>';
  }
  function ciz() {
    if (!VERI) return;
    istatistik();
    var g = LISTE.filter(eslesir);
    $('#grid').innerHTML = g.map(kart).join('');
    $('#bos').hidden = g.length > 0;
    ikonDuzelt($('#grid'));
  }

  /* ---------- yenilikler (küçük markdown) ---------- */
  function md(s) {
    var satir = esc(s).split('\n'), out = [], liste = false;
    var ic = function (t) {
      return t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    };
    satir.forEach(function (x) {
      var m = x.match(/^\s*[-*•]\s+(.*)/);
      if (m) { if (!liste) { out.push('<ul>'); liste = true; } out.push('<li>' + ic(m[1]) + '</li>'); return; }
      if (liste) { out.push('</ul>'); liste = false; }
      var h = x.match(/^#{1,6}\s*(.*)/);
      if (h) out.push('<p><b>' + ic(h[1]) + '</b></p>'); else if (x.trim()) out.push('<p>' + ic(x) + '</p>');
    });
    if (liste) out.push('</ul>');
    return out.join('');
  }
  function notMetni(n) { var m = n.metin || {}; return m[L] || m['*'] || m.tr || m.en || m.ar || ''; }

  /* ---------- QR ---------- */
  function qrSvg(text) {
    try {
      var q = qrcode(0, 'M'); q.addData(text); q.make();
      var n = q.getModuleCount(), d = '';
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + c + ' ' + r + 'h1v1h-1z';
      return '<svg viewBox="-2 -2 ' + (n + 4) + ' ' + (n + 4) + '" role="img" aria-label="QR"><path d="' + d + '" fill="#0f1b2d"/></svg>';
    } catch (e) { return ''; }
  }

  /* ---------- ayrıntı ---------- */
  function bul(id) { for (var i = 0; i < LISTE.length; i++) if (LISTE[i].id === id) return LISTE[i]; return null; }
  function acikId() { var m = location.hash.match(/^#p\/(.+)$/); return m ? decodeURIComponent(m[1]) : null; }
  function platKutusu(k, l) {
    var sha = l.sha256 ? '<div class="sha"><code>' + esc(l.sha256) + '</code><button type="button" data-kopya="' + esc(l.sha256) + '">' + esc(T('kopyala')) + '</button></div>' : '<p class="md">' + esc(T('shaYok')) + '</p>';
    var qr = k === 'apk' ? '<div class="qr">' + qrSvg(l.url) + '<p><b>' + esc(T('qrBaslik')) + '</b><br>' + esc(T('qrNot')) + '</p></div>' : '';
    return '<div class="plat"><h4><span class="os ' + (k === 'apk' ? 'and' : 'win') + ' big" style="color:var(--' + (k === 'apk' ? 'and' : 'win') + ')"></span>' +
      esc(T(k === 'apk' ? 'android' : 'windows')) + ' — ' + esc(T(k === 'apk' ? 'apk' : 'kurulum')) + '</h4>' +
      '<dl class="kv"><dt>' + esc(T('surum')) + '</dt><dd class="ltr">' + esc(l.version || '—') + '</dd>' +
      (l.date ? '<dt>' + esc(T('tarih')) + '</dt><dd>' + esc(tarih(l.date)) + '</dd>' : '') +
      (l.mb ? '<dt>' + esc(T('boyut')) + '</dt><dd>' + mbYaz(l.mb) + '</dd>' : '') +
      '<dt>' + esc(T('dosya')) + '</dt><dd class="ltr">' + esc(l.file) + '</dd>' +
      (l.indirme ? '<dt>' + esc(T('indirme')) + '</dt><dd>' + sayi(l.indirme) + '</dd>' : '') + '</dl>' +
      indirBtn(k, l, true) + '<div><div class="cat" style="margin-bottom:4px">' + esc(T('sha')) + '</div>' + sha + '</div>' + qr + '</div>';
  }
  function ac(id, sessiz) {
    var p = bul(id), dlg = $('#detay');
    if (!p) return;
    var m = META.programlar[p.id] || {}, ls = p.links || {};
    var oz = m.ozellik && (m.ozellik[L] || m.ozellik.tr);
    var sira = CIHAZ === 'apk' ? ['apk', 'desktop'] : ['desktop', 'apk'];
    var plat = sira.filter(function (k) { return ls[k]; }).map(function (k) { return platKutusu(k, ls[k]); }).join('');
    var notlar = (p.notlar || []).map(function (n) {
      var t = notMetni(n); if (!t) return '';
      return '<article><h4><span class="ltr">' + esc(n.surum) + '</span><span>' + esc(tarih(n.tarih)) + '</span></h4><div class="md">' + md(t) + '</div></article>';
    }).join('');
    dlg.innerHTML = '<div class="d-head">' + ikon(p, true) + '<div><div class="cat">' + esc(kat(p)) + '</div><h2 id="dBaslik">' + esc(ad(p)) + '</h2></div>' +
      '<button class="d-close" type="button" aria-label="' + esc(T('kapat')) + '" data-kapat>✕</button></div>' +
      '<div class="d-body">' +
      (kisa(p) ? '<p class="md" style="font-size:1rem;margin:0">' + esc(kisa(p)) + '</p>' : '') +
      (oz && oz.length ? '<section><h3>' + esc(T('ozellikler')) + '</h3><ul class="feat">' + oz.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></section>' : '') +
      (plat ? '<section class="plats">' + plat + '</section>' : '<p class="md">' + esc(p.yakinda ? T('yakindaNot') : T('kurulumYok')) + '</p>') +
      (p.ekranlar && p.ekranlar.length ? '<section><h3>' + esc(T('ekranlar')) + '</h3><div class="shots">' + p.ekranlar.map(function (s) { return '<a href="' + esc(s) + '" target="_blank" rel="noopener"><img src="' + esc(s) + '" alt="" loading="lazy"></a>'; }).join('') + '</div></section>' : '') +
      (notlar ? '<section><h3>' + esc(T('yenilikler')) + '</h3><div class="notes">' + notlar + '</div></section>' : '') +
      (p.surumler ? '<p style="margin:0"><a href="' + esc(p.surumler) + '" target="_blank" rel="noopener">' + esc(T('tumSurumler')) + ' ↗</a></p>' : '') +
      '</div>';
    ikonDuzelt(dlg);
    if (!dlg.open) { try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); } }
    if (!sessiz && location.hash !== '#p/' + encodeURIComponent(id)) history.pushState(null, '', '#p/' + encodeURIComponent(id));
  }
  function kapat() {
    var dlg = $('#detay'); if (dlg.open) dlg.close();
    if (acikId()) history.pushState(null, '', location.pathname + location.search);
  }

  /* ---------- iletişim formu (programlardaki "Admin ile iletişim" ile aynı gelen kutusu) ---------- */
  var INBOX = 'https://firestore.googleapis.com/v1/projects/comm-calc-103111111/databases/(default)/documents/mesajlar?key=AIzaSyB12RFS6ENPpmnnPsETfjedNH-3hmNWQvA';
  function yedekAdres() { return atob('').split('').reverse().join(''); }
  function cihazId() {
    var id = store('cihaz');
    if (!id) { var b = new Uint8Array(9); crypto.getRandomValues(b); id = Array.prototype.map.call(b, function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); store('cihaz', id); }
    return id;
  }
  function formKur() {
    var tur = $('#fTur'), pr = $('#fProgram'), sec = pr.value;
    var tt = T('fTurlar'), st = tur.value;
    tur.innerHTML = Object.keys(tt).map(function (k) { return '<option value="' + k + '">' + esc(tt[k]) + '</option>'; }).join('');
    if (st) tur.value = st;
    pr.innerHTML = '<option value="indirme-sitesi">' + esc(T('fGenel')) + '</option>' + LISTE.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(ad(p)) + '</option>'; }).join('');
    if (sec) pr.value = sec;
  }
  function gonder(e) {
    e.preventDefault();
    var durum = $('#fDurum'), btn = $('#fGonder'), mesaj = $('#fMesaj').value.trim();
    durum.className = '';
    if ($('#fBal').value) return; // bot
    if (mesaj.length < 5) { durum.textContent = T('fKisa'); durum.className = 'err'; return; }
    var os = /Android/i.test(ua) ? 'android' : /Win/i.test(ua) ? 'windows' : /Mac/i.test(ua) ? 'mac' : /Linux/i.test(ua) ? 'linux' : 'web';
    var f = { tur: $('#fTur').value, uygulama: $('#fProgram').value, surum: 'site', platform: 'indirme-sitesi/' + os, dil: L,
      mesaj: mesaj.slice(0, 5000), zaman: new Date().toISOString(), cihaz: cihazId() };
    var il = $('#fIletisim').value.trim(); if (il) f.iletisim = il.slice(0, 160);
    btn.disabled = true; btn.textContent = T('fGonderiliyor');
    var body = { fields: {} }; Object.keys(f).forEach(function (k) { body.fields[k] = { stringValue: String(f[k]) }; });
    fetch(INBOX, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.ok; }, function () { return false; })
      .then(function (ok) {
        if (ok) return true;
        var m = { _subject: 'İndirme sitesi: ' + f.tur, _template: 'table', _captcha: 'false', Tur: f.tur, Mesaj: f.mesaj, Uygulama: f.uygulama, Dil: f.dil, Platform: f.platform };
        if (f.iletisim) { m.Iletisim = f.iletisim; if (/@/.test(f.iletisim)) m._replyto = f.iletisim; }
        return fetch('https://formsubmit.co/ajax/' + yedekAdres(), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(m) })
          .then(function (r) { return r.json(); }).then(function (j) { return String(j.success) === 'true'; }, function () { return false; });
      })
      .then(function (ok) {
        btn.disabled = false; btn.textContent = T('fGonder');
        durum.textContent = ok ? T('fTamam') : T('fHata'); durum.className = ok ? 'ok' : 'err';
        if (ok) { $('#fMesaj').value = ''; }
      });
  }

  /* ---------- olaylar ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-lang],[data-p],[data-k],[data-ac],[data-kapat],[data-kopya],#tema');
    if (!t) { if (e.target === $('#detay')) kapat(); return; }
    if (t.dataset.lang) dilKur(t.dataset.lang);
    else if (t.id === 'tema') { var s = ['auto', 'light', 'dark']; temaUygula(s[(s.indexOf(tema()) + 1) % 3]); }
    else if (t.hasAttribute('data-p')) { filtre.p = t.dataset.p; document.querySelectorAll('#platform button').forEach(function (b) { b.classList.toggle('on', b === t); }); ciz(); }
    else if (t.hasAttribute('data-k')) { filtre.k = t.dataset.k; document.querySelectorAll('#kategori button').forEach(function (b) { b.classList.toggle('on', b === t); }); ciz(); }
    else if (t.dataset.ac) ac(t.dataset.ac);
    else if (t.hasAttribute('data-kapat')) kapat();
    else if (t.dataset.kopya) {
      var done = function () { t.textContent = T('kopyalandi'); setTimeout(function () { t.textContent = T('kopyala'); }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(t.dataset.kopya).then(done, function () {}); else done();
    }
  });
  $('#grid').addEventListener('click', function (e) {
    var c = e.target.closest('.card'); if (!c || e.target.closest('a,button')) return;
    var p = bul(c.dataset.id); if (p && !p.yakinda) ac(c.dataset.id);
  });
  $('#ara').addEventListener('input', function (e) { filtre.q = e.target.value.trim(); ciz(); });
  $('#form').addEventListener('submit', gonder);
  $('#detay').addEventListener('close', function () { if (acikId()) history.pushState(null, '', location.pathname + location.search); });
  window.addEventListener('popstate', function () { var id = acikId(); if (id) ac(id, true); else if ($('#detay').open) $('#detay').close(); });

  /* ---------- açılış ---------- */
  var tazele = '?t=' + Math.floor(Date.now() / 300000); // 5 dakikalık önbellek
  L = ilkDil();
  dilKur(L);
  Promise.all([
    fetch('veri.json' + tazele).then(function (r) { return r.json(); }),
    fetch('programlar.json' + tazele).then(function (r) { return r.json(); }).catch(function () { return {}; })
  ]).then(function (x) {
    VERI = x[0]; META = { programlar: x[1].programlar || {}, kategoriler: x[1].kategoriler || {} };
    listeKur(); dilKur(L);
  }).catch(function () {
    $('#grid').innerHTML = '<p class="empty">⚠ veri.json — <a href="https://github.com/departures-mil/duyurular/blob/main/INDIRME-LINKLERI.md">INDIRME-LINKLERI.md</a></p>';
  });
})();
