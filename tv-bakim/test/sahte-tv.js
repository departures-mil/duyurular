/* Sahte TV köprüsü (yalnız testler ve ekran görüntüleri için; APK'ya GİRMEZ): window.TV + window.AndroidBridge.
   Playwright page.addInitScript(sahteTv, secenekler) ile yüklenir. Gerçek köprünün (TvBridge.java) yanıt biçimleriyle aynı. */
'use strict';
module.exports = function sahteTv(o) {
  o = o || {};
  const GB = 1073741824, MB = 1048576, now = Date.now(), day = 864e5;
  const log = (window.__tvLog = []);
  const emit = (k, d, ms) => setTimeout(() => window.__tv && window.__tv(k, d), ms || 20);
  const items = [
    { id: 0, rel: 'Download/YouTube-Kids-9.12.apk', size: 48 * MB, mtime: now - 40 * day, cat: 'apk' },
    { id: 1, rel: 'Download/Spotify-TV.apk', size: 71 * MB, mtime: now - 12 * day, cat: 'apk' },
    { id: 2, rel: 'Download/Kodi-21.1.apk', size: 92 * MB, mtime: now - 90 * day, cat: 'apk' },
    { id: 3, rel: 'DCIM/.thumbnails/1700001.jpg', size: 180 * 1024, mtime: now - 5 * day, cat: 'thumbs' },
    { id: 4, rel: 'DCIM/.thumbnails/1700002.jpg', size: 210 * 1024, mtime: now - 5 * day, cat: 'thumbs' },
    { id: 5, rel: 'Pictures/.thumbnails/.thumbdata4--1967290299', size: 38 * MB, mtime: now - 60 * day, cat: 'thumbs' },
    { id: 6, rel: 'Download/film-fragman.mp4.crdownload', size: 214 * MB, mtime: now - 3 * day, cat: 'temp' },
    { id: 7, rel: 'tmp/update.tmp', size: 6 * MB, mtime: now - 30 * day, cat: 'temp' },
    { id: 8, rel: 'Android-logs/player.log', size: 3 * MB, mtime: now - 2 * day, cat: 'log' },
    { id: 9, rel: 'LOST.DIR/1234', size: 12 * MB, mtime: now - 200 * day, cat: 'lost' },
    { id: 10, rel: 'Movies/Tatil-2024.mkv', size: 3.4 * GB, mtime: now - 300 * day, cat: 'big' }
  ];
  let trash = o.trash ? [
    { id: '20261120-101500-1-11', at: now - 4 * day, size: 92 * MB, orig: 'Download/Kodi-20.apk', name: 'Kodi-20.apk' },
    { id: '20261121-090000-2-22', at: now - 3 * day, size: 2 * MB, orig: 'Download/eski.log', name: 'eski.log' }
  ] : [];
  const info = Object.assign({
    version: '1.1.0', sdk: 30, android: '11', model: 'Mi Box S', brand: 'Xiaomi', tv: true,
    ramFree: 0.74 * GB, ramTotal: 1.9 * GB, lowMem: false, diskFree: 1.6 * GB, diskTotal: 8 * GB, ownCache: 2.4 * MB,
    uptimeMs: 9 * day + 5 * 3600e3, animWindow: 1, animTransition: 1, animator: 1, devOptions: false, adb: true,
    storagePerm: true, storagePermKind: 'all-files', usagePerm: true, usageSizes: true, installPerm: false, oldApp: true, trashBytes: 0
  }, o.info || {});
  window.TV = {
    info: () => { info.trashBytes = trash.reduce((m, x) => m + x.size, 0); return JSON.stringify(info); },
    clearOwnCache: () => { log.push('clearOwnCache'); const f = info.ownCache; info.ownCache = 0; return JSON.stringify({ freed: f }); },
    scan: () => {
      log.push('scan');
      if (!info.storagePerm) return emit('scan', { ok: false, needPermission: true });
      emit('scanProgress', { scanned: 500, found: 4 }, 10);
      emit('scan', { ok: true, items: items.filter((x) => !x.gone), scanned: 4210, truncated: false }, o.scanMs || 40);
    },
    cancelScan: () => log.push('cancelScan'),
    trash: (ids) => {
      ids = JSON.parse(ids); log.push('trash:' + ids.join(','));
      let bytes = 0;
      ids.forEach((id) => { const it = items.find((x) => x.id === id); if (it && !it.gone) { it.gone = true; bytes += it.size; trash.push({ id: 't' + id, at: Date.now(), size: it.size, orig: it.rel, name: it.rel.split('/').pop() }); } });
      emit('trashed', { moved: ids.length, bytes, failed: 0 });
    },
    trashList: () => JSON.stringify({ items: trash, total: trash.reduce((m, x) => m + x.size, 0), folder: 'TVBakim-CopKutusu', permission: !!info.storagePerm }),
    restore: (ids) => { ids = JSON.parse(ids); log.push('restore:' + ids.join(',')); trash = trash.filter((x) => ids.indexOf(x.id) < 0); emit('restored', { ok: ids.length, failed: 0 }); },
    emptyTrash: (ids, title, msg, yes, no) => { log.push('emptyTrash:' + JSON.parse(ids).join(',') + '|' + title); emit('emptied', { cancelled: true }); },
    apps: () => emit('apps', { usage: !!info.usagePerm, items: [
      { pkg: 'com.google.android.youtube.tv', name: 'YouTube', sys: true, apk: 61 * MB, app: 120 * MB, data: 310 * MB, cache: 420 * MB },
      { pkg: 'com.netflix.ninja', name: 'Netflix', sys: false, apk: 70 * MB, app: 95 * MB, data: 160 * MB, cache: 210 * MB },
      { pkg: 'org.xbmc.kodi', name: 'Kodi', sys: false, apk: 88 * MB, app: 101 * MB, data: 640 * MB, cache: 55 * MB },
      { pkg: 'com.spotify.tv.android', name: 'Spotify', sys: false, apk: 35 * MB, app: 42 * MB, data: 90 * MB, cache: 180 * MB },
      { pkg: 'tr.gov.trt.tabii', name: 'tabii', sys: false, apk: 28 * MB, app: 33 * MB, data: 12 * MB, cache: 40 * MB }
    ] }),
    openApp: (p) => { log.push('openApp:' + p); return true; },
    appDetails: (p) => { log.push('appDetails:' + p); return true; },
    uninstall: (p) => { log.push('uninstall:' + p); return true; },
    openSettings: (w) => { log.push('openSettings:' + w); return true; },
    requestStorage: () => { log.push('requestStorage'); return 'opened'; },
    netTest: () => {
      log.push('netTest');
      const r = { connected: true, type: 'wifi' };
      emit('net', { phase: 'link', result: Object.assign({}, r) }, 10);
      emit('net', { phase: 'done', result: Object.assign(r, { dnsMs: 18, pingMs: 34, pingOk: 4, downBytes: 22e6, downMs: 8000, mbps: 41.6, downCode: 200 }) }, 40);
    },
    legacy: () => JSON.stringify(o.legacy || {}),
    legacyDone: () => log.push('legacyDone'),
    tasi: () => {}
  };
  window.AndroidBridge = {
    appVersion: () => info.version,
    moveTaskToBack: () => log.push('moveTaskToBack'),
    openExternal: (u) => log.push('openExternal:' + u),
    apkUpdate: (p) => log.push('apkUpdate:' + p),
    updateBegin: () => true, updateChunk: () => true, updateFinish: () => '{"ok":true}'
  };
};
