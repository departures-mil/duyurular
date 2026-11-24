/* Kumanda (D-pad) gezintisi: yön tuşları odağı ekranda o yöndeki en yakın düğmeye taşır; OK = tıklama (tarayıcı kendisi yapar).
   Açık pencere (modal) varsa yalnız onun içinde gezilir. pick() saf işlevdir (test/app.test.js). */
(function (g) {
  'use strict';
  /** from, cands: {x,y,w,h} dikdörtgenler; dir: 'left'|'right'|'up'|'down'. Dönen: seçilen adayın sırası ya da -1. */
  function pick(from, cands, dir) {
    var fx = from.x + from.w / 2, fy = from.y + from.h / 2;
    function ara(kati) {
      var best = -1, bestScore = Infinity;
      for (var i = 0; i < cands.length; i++) {
        var c = cands[i], cx = c.x + c.w / 2, cy = c.y + c.h / 2, dx = cx - fx, dy = cy - fy, main, cross, overlap, ok;
        if (dir === 'right') { ok = kati ? c.x >= from.x + from.w - 4 : dx > 0; main = Math.max(0, c.x - (from.x + from.w)); cross = Math.abs(dy); overlap = c.y < from.y + from.h && c.y + c.h > from.y; }
        else if (dir === 'left') { ok = kati ? c.x + c.w <= from.x + 4 : dx < 0; main = Math.max(0, from.x - (c.x + c.w)); cross = Math.abs(dy); overlap = c.y < from.y + from.h && c.y + c.h > from.y; }
        else if (dir === 'down') { ok = kati ? c.y >= from.y + from.h - 4 : dy > 0; main = Math.max(0, c.y - (from.y + from.h)); cross = Math.abs(dx); overlap = c.x < from.x + from.w && c.x + c.w > from.x; }
        else { ok = kati ? c.y + c.h <= from.y + 4 : dy < 0; main = Math.max(0, from.y - (c.y + c.h)); cross = Math.abs(dx); overlap = c.x < from.x + from.w && c.x + c.w > from.x; }
        if (!ok) continue;
        // aynı satırda/sütunda (örtüşen) aday varsa her zaman o yeğlenir
        var score = overlap ? main + cross * 0.3 : 1e6 + main + cross * 2.5;
        if (score < bestScore) { bestScore = score; best = i; }
      }
      return best;
    }
    return ara(true);   // yalnız tamamen o yönde olanlar (yoksa odak yerinde kalır / alan kaydırılır)
  }

  var SEL = 'button:not([disabled]),a[href],input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function visible(el) {
    if (!el.getClientRects().length) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var s = g.getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
  }
  function scope() {
    var m = g.document.querySelectorAll('.modal-backdrop');
    return m.length ? m[m.length - 1] : g.document.body;
  }
  function focusables(root) { return Array.prototype.filter.call(root.querySelectorAll(SEL), visible); }
  function first(root) {
    root = root || scope();
    var l = focusables(root);
    var pri = root.querySelector('.modal-footer .btn.primary:not([disabled])') || root.querySelector('[data-autofocus]:not([disabled])');
    return pri && visible(pri) ? pri : l[0] || null;
  }
  function focus(el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function rect(el) { var r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }
  function move(dir) {
    var root = scope(), cur = g.document.activeElement;
    var list = focusables(root);
    if (!cur || cur === g.document.body || !root.contains(cur)) { focus(first(root)); return true; }
    var cands = list.filter(function (e) { return e !== cur; });
    var i = pick(rect(cur), cands.map(rect), dir);
    if (i >= 0) { focus(cands[i]); return true; }
    // Kaydırılabilir alanda daha aşağıda/yukarıda görünmeyen öğe yoksa sayfayı kaydır
    var sc = cur.closest && cur.closest('.content, .modal-body');
    if (sc && (dir === 'down' || dir === 'up')) { sc.scrollBy(0, dir === 'down' ? 120 : -120); return true; }
    return false;
  }
  var KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  function install() {
    var d = g.document;
    d.addEventListener('keydown', function (e) {
      var dir = KEYS[e.key]; if (!dir || e.altKey || e.ctrlKey || e.metaKey) return;
      var a = d.activeElement, tag = a && a.tagName;
      if (tag === 'TEXTAREA' || (tag === 'INPUT' && /^(text|email|password|search|number|url|tel)$/i.test(a.type || 'text') && (dir === 'left' || dir === 'right'))) return;
      if (tag === 'SELECT' && (dir === 'up' || dir === 'down')) return;
      if (move(dir)) e.preventDefault();
    }, true);
    // Pencere açılınca odak içine, kapanınca önceki yere
    var stack = [];
    new g.MutationObserver(function () {
      var m = d.querySelectorAll('.modal-backdrop');
      if (m.length > stack.length) { stack.push(d.activeElement); var top = m[m.length - 1]; setTimeout(function () { if (!top.contains(d.activeElement)) focus(first(top)); }, 30); }
      else if (m.length < stack.length) { var prev = stack.pop(); setTimeout(function () { if (prev && prev.isConnected && visible(prev)) focus(prev); else focus(first()); }, 30); }
    }).observe(d.body, { childList: true });
  }
  var api = { pick: pick, move: move, first: first, focus: focus, install: install };
  g.Dpad = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
