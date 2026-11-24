/* TV Bakım — saf mantık (DOM'suz; Node'da test edilir: test/app.test.js).
   Boyut biçimi, gereksiz dosya grupları ve seçim, kurulum adımları, animasyon durumu, ağ değerlendirmesi, uygulama sıralaması. */
(function (g) {
  'use strict';
  var CATS = ['apk', 'thumbs', 'temp', 'log', 'lost', 'big'];
  var DEFAULT_ON = { apk: true, thumbs: true, temp: true, log: true, lost: true, big: false };
  var CERTAIN = { thumbs: true, temp: true, log: true, lost: true };   // isteğe bağlı otomatik taşıma (Tarama.kesinGereksiz ile aynı)

  function locale(lang) { return lang === 'ar' ? 'ar-u-nu-latn' : lang === 'en' ? 'en-US' : 'tr-TR'; }
  function num(n, d, lang) {
    try { return Number(n).toLocaleString(locale(lang), { minimumFractionDigits: d, maximumFractionDigits: d }); } catch (e) { return Number(n).toFixed(d); }
  }
  /** 0 B · 812 KB · 4,2 MB · 1,25 GB */
  function size(b, lang) {
    b = Math.max(0, +b || 0);
    var NB = '\u00a0';
    if (b < 1024) return num(b, 0, lang) + NB + 'B';
    if (b < 1048576) return num(b / 1024, 0, lang) + NB + 'KB';
    if (b < 1073741824) return num(b / 1048576, b < 10485760 ? 1 : 0, lang) + NB + 'MB';
    return num(b / 1073741824, b < 10737418240 ? 2 : 1, lang) + NB + 'GB';
  }
  function duration(ms) {
    ms = Math.max(0, +ms || 0);
    return { d: Math.floor(ms / 86400000), h: Math.floor(ms / 3600000) % 24, m: Math.floor(ms / 60000) % 60 };
  }

  /** Tarama sonucu → kategori grupları (yalnız var olanlar, sabit sırada). */
  function group(items) {
    var by = {};
    (items || []).forEach(function (it) {
      var c = CATS.indexOf(it.cat) >= 0 ? it.cat : null; if (!c) return;
      var gr = by[c] || (by[c] = { cat: c, count: 0, bytes: 0, items: [] });
      gr.count++; gr.bytes += +it.size || 0; gr.items.push(it);
    });
    return CATS.filter(function (c) { return by[c]; }).map(function (c) {
      by[c].items.sort(function (a, b) { return (b.size || 0) - (a.size || 0); });
      return by[c];
    });
  }
  /** Seçim durumu: kategori açık/kapalı + tek tek istisnalar. sel = {cats:{apk:true…}, off:{id:true}, on:{id:true}} */
  function newSelection() { var c = {}; CATS.forEach(function (k) { c[k] = DEFAULT_ON[k]; }); return { cats: c, off: {}, on: {} }; }
  function isSelected(sel, it) {
    if (sel.on[it.id]) return true;
    if (sel.off[it.id]) return false;
    return !!sel.cats[it.cat];
  }
  function toggleItem(sel, it) {
    var now = isSelected(sel, it);
    delete sel.on[it.id]; delete sel.off[it.id];
    if (now !== !sel.cats[it.cat]) (now ? sel.off : sel.on)[it.id] = true;
    return !now;
  }
  function toggleCat(sel, groups, cat) {
    sel.cats[cat] = !sel.cats[cat];
    groups.forEach(function (gr) { if (gr.cat === cat) gr.items.forEach(function (it) { delete sel.on[it.id]; delete sel.off[it.id]; }); });
    return sel.cats[cat];
  }
  function selected(sel, items) {
    var ids = [], bytes = 0;
    (items || []).forEach(function (it) { if (isSelected(sel, it)) { ids.push(it.id); bytes += +it.size || 0; } });
    return { ids: ids, bytes: bytes, count: ids.length };
  }
  /** "Kesin gereksiz" (otomatik taşınabilir) olanlar — apk ve büyük dosyalar ASLA. */
  function certainIds(items) {
    var ids = [], bytes = 0;
    (items || []).forEach(function (it) { if (CERTAIN[it.cat]) { ids.push(it.id); bytes += +it.size || 0; } });
    return { ids: ids, bytes: bytes, count: ids.length };
  }

  /** Animasyon ölçeği: 'off' (hepsi 0) · 'fast' (hepsi ≤ 0.5) · 'default' (en az biri > 0.5) · 'unknown' */
  function anim(info) {
    if (!info || info.animWindow == null) return { state: 'unknown', value: null };
    var v = [info.animWindow, info.animTransition, info.animator].map(Number);
    var max = Math.max.apply(null, v);
    if (v.every(function (x) { return x === 0; })) return { state: 'off', value: 0 };
    return { state: max <= 0.5 ? 'fast' : 'default', value: max };
  }
  function scaleText(v) { return v === 0 ? '0' : (Math.round(v * 100) / 100) + 'x'; }

  /** Kurulum adımları: [{id, done, need (yapılması gereken mi), optional}] */
  function setupSteps(info) {
    info = info || {};
    var a = anim(info);
    var s = [
      { id: 'storage', done: !!info.storagePerm, need: true },
      { id: 'usage', done: !!info.usagePerm, need: !!info.usageSizes, optional: true },
      { id: 'anim', done: a.state === 'fast' || a.state === 'off', need: true, optional: true },
      { id: 'install', done: !!info.installPerm, need: (info.sdk || 0) >= 26, optional: true }
    ];
    if (info.oldApp) s.push({ id: 'old', done: false, need: true });
    if (info.adb) s.push({ id: 'adb', done: false, need: true, optional: true });
    return s;
  }
  function setupCount(steps) {
    var need = steps.filter(function (x) { return x.need; });
    return { done: need.filter(function (x) { return x.done; }).length, total: need.length };
  }

  /** Ağ: Mbit/sn ve gecikmeye göre değerlendirme. */
  function netRating(mbps, pingMs) {
    mbps = +mbps || 0;
    if (mbps >= 25 && (pingMs < 0 || pingMs <= 80)) return 'excellent';
    if (mbps >= 10) return 'good';
    if (mbps >= 4) return 'ok';
    return 'poor';
  }

  function appTotal(a) { return a.app != null ? (+a.app || 0) + (+a.data || 0) + (+a.cache || 0) : (+a.apk || 0); }
  function sortApps(list) {
    return (list || []).slice().sort(function (a, b) { return appTotal(b) - appTotal(a) || String(a.name).localeCompare(String(b.name)); });
  }

  /** Depolama doluluk oranı ve uyarı. */
  function disk(info) {
    var t = +(info && info.diskTotal) || 0, f = +(info && info.diskFree) || 0;
    var used = t ? Math.min(1, Math.max(0, (t - f) / t)) : 0;
    return { used: used, low: t > 0 && f / t < 0.1 };
  }

  var api = {
    CATS: CATS, DEFAULT_ON: DEFAULT_ON, size: size, num: num, duration: duration, group: group,
    newSelection: newSelection, isSelected: isSelected, toggleItem: toggleItem, toggleCat: toggleCat, selected: selected, certainIds: certainIds,
    anim: anim, scaleText: scaleText, setupSteps: setupSteps, setupCount: setupCount, netRating: netRating, appTotal: appTotal, sortApps: sortApps, disk: disk
  };
  g.TVBakim = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
