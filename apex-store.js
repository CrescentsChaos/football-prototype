/*
 * APEX STORE - durable save storage for the whole game.
 *
 * WHY: the game kept everything in localStorage (~5 MB, synchronous, writes can fail silently, and a failed
 * write left an OLD value that was then loaded again after a refresh = "my tournament got overwritten").
 *
 * WHAT THIS DOES (no game code has to change to benefit):
 *  1. Replaces window.localStorage with a drop-in store for the game's "apex*" keys. Reads/writes stay
 *     synchronous (in-memory), and every change is written behind to IndexedDB (hundreds of MB, not 5 MB).
 *  2. Also mirrors small values into the real localStorage, so a page that closes before the async IndexedDB
 *     write finishes still keeps its last change (newest timestamp wins at boot; deletes use tombstones).
 *  3. Rolling snapshots (auto + manual + "before import/reset") so a bad/overwritten save can be rolled back.
 *  4. Multi-tab guard: if another tab/page changed a save key, this tab stops writing that key (instead of
 *     overwriting newer data with its stale in-memory copy) and tells the person to reload.
 *  5. Persistent-storage request, usage numbers, status events, export/import in the existing save format.
 *
 * Loaded on every page by:  <script src="apex-store.js" data-app="dist/app.js"></script>
 * It loads dist/app.js (and apex-save-ui.js / apex-drive.js) only AFTER the saved data is in memory.
 */
(function () {
  'use strict';
  if (window.ApexStore) return;

  var DB_NAME = 'apex-football-store';
  var DB_VER = 1;
  var PREFIX = 'apex';
  // Device-level settings live in the REAL localStorage under these names (never part of a save / export).
  var DEV = 'ApexDev.';
  // UI-only keys: they change on every page and must not trigger the "changed in another tab" guard or snapshots.
  var UI_KEYS = { apexActiveView: 1, apexSeasonActiveTab: 1, apexSeasonActiveSubTab: 1, apexGalaLater: 1, apexJustReset: 1, apexJustImported: 1 };
  var MIRROR_MAX = 1500000;          // only mirror values smaller than this into the real localStorage
  var FLUSH_DELAY = 250;             // ms debounce for IndexedDB writes
  var AUTO_SNAP_EVERY = 20 * 60e3;   // at most one automatic snapshot every 20 min
  var MAX_AUTO_SNAPS = 6;
  var MAX_MANUAL_SNAPS = 40;

  var realLS = null;
  try { realLS = window.localStorage; realLS.getItem('x'); } catch (e) { realLS = null; }
  var NS = (window.Storage && window.Storage.prototype) || null;
  var N = NS ? { g: NS.getItem, s: NS.setItem, r: NS.removeItem, k: NS.key, c: NS.clear, ld: Object.getOwnPropertyDescriptor(NS, 'length') } : null;
  var useProto = !!(N && realLS && realLS instanceof window.Storage);       // false for test doubles
  var rawGet = function (k) { try { return realLS ? (useProto ? N.g.call(realLS, k) : realLS.getItem(k)) : null; } catch (e) { return null; } };
  var rawSet = function (k, v) { try { if (realLS) { if (useProto) N.s.call(realLS, k, v); else realLS.setItem(k, v); return true; } } catch (e) {} return false; };
  var rawDel = function (k) { try { if (realLS) { if (useProto) N.r.call(realLS, k); else realLS.removeItem(k); } } catch (e) {} };

  var map = Object.create(null);     // key -> string value (live data)
  var ts = Object.create(null);      // key -> last write time (ms)
  var dead = Object.create(null);    // key -> true when deleted (tombstone)
  var dirty = Object.create(null);   // keys waiting for IndexedDB
  var remoteTs = Object.create(null);// key -> ts seen from ANOTHER tab (stale guard)
  var listeners = { status: [], stale: [], change: [] };
  var db = null, mode = 'memory', flushTimer = null, flushing = null, lastErr = null, lastSavedAt = 0, persisted = false;
  var tabId = Math.random().toString(36).slice(2, 10);
  var chan = null, staleKeys = [], bootInfo = {};
  var changeCount = 0;               // local data revision (used by Drive sync)

  function now() { var n = Date.now(); return n; }
  var lastStamp = 0;
  function stamp() { var n = now(); if (n <= lastStamp) n = lastStamp + 1; lastStamp = n; return n; }
  function isGameKey(k) { return typeof k === 'string' && k.indexOf(PREFIX) === 0; }
  function emit(type, arg) { (listeners[type] || []).slice().forEach(function (f) { try { f(arg); } catch (e) { console.error(e); } }); }

  // ---------- IndexedDB helpers ----------
  function idb() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('IndexedDB unavailable'));
      var rq;
      try { rq = indexedDB.open(DB_NAME, DB_VER); } catch (e) { return rej(e); }
      rq.onupgradeneeded = function () {
        var d = rq.result;
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv', { keyPath: 'k' });
        if (!d.objectStoreNames.contains('snaps')) d.createObjectStore('snaps', { keyPath: 'id' });
      };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { rej(rq.error || new Error('IndexedDB open failed')); };
      rq.onblocked = function () { rej(new Error('IndexedDB blocked')); };
    });
  }
  function tx(store, rw, fn) {
    return new Promise(function (res, rej) {
      var t;
      try { t = db.transaction(store, rw ? 'readwrite' : 'readonly'); } catch (e) { return rej(e); }
      var out;
      t.oncomplete = function () { res(out); };
      t.onerror = function () { rej(t.error || new Error('IndexedDB transaction failed')); };
      t.onabort = function () { rej(t.error || new Error('IndexedDB transaction aborted')); };
      try { out = fn(t.objectStore(store), t); } catch (e) { try { t.abort(); } catch (x) {} rej(e); }
    });
  }
  function reqP(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }

  // ---------- real-localStorage mirror metadata ----------
  function readMeta() { try { return JSON.parse(rawGet(DEV + 'meta') || '{}') || {}; } catch (e) { return {}; } }
  var meta = {};                      // key -> [ts, deletedFlag]  (describes the real-localStorage mirror)
  // Written synchronously on every change: it is tiny (a few hundred bytes) and it is what lets the next page load
  // tell that the mirror is newer than IndexedDB when the page closed before the async write finished.
  function saveMeta() { rawSet(DEV + 'meta', JSON.stringify(meta)); }
  function metaNow() { saveMeta(); }

  function mirror(k) {
    if (!realLS) return;
    if (dead[k]) { rawDel(k); meta[k] = [ts[k], 1]; }
    else if (map[k].length < MIRROR_MAX && rawSet(k, map[k])) { meta[k] = [ts[k], 0]; }
    else { rawDel(k); delete meta[k]; }   // too big / no room: don't leave a stale copy behind
    saveMeta();
  }

  // ---------- public localStorage-compatible object ----------
  function keysList() { return Object.keys(map).filter(function (k) { return !dead[k]; }).sort(); }
  var shim = {
    getItem: function (k) { k = String(k); if (!isGameKey(k)) return rawGet(k); return (!dead[k] && k in map) ? map[k] : null; },
    setItem: function (k, v) { setItem(String(k), String(v)); },
    removeItem: function (k) { removeItem(String(k)); },
    key: function (i) { var l = keysList(); return i >= 0 && i < l.length ? l[i] : null; },
    clear: function () { keysList().forEach(removeItem); },
    get length() { return keysList().length; }
  };

  function setItem(k, v) {
    if (!isGameKey(k)) { rawSet(k, v); return; }
    if (!dead[k] && map[k] === v) return;                       // unchanged: no churn
    if (!UI_KEYS[k] && remoteTs[k] && remoteTs[k] > (ts[k] || 0)) {   // newer copy exists in another tab
      noteStale(k); return;                                     // refuse to overwrite it with stale data
    }
    map[k] = v; dead[k] = false; ts[k] = stamp(); dirty[k] = 1;
    if (!UI_KEYS[k]) { changeCount++; }
    mirror(k); announce(k); schedule();
  }
  function removeItem(k) {
    if (!isGameKey(k)) { rawDel(k); return; }
    if (!(k in map) || dead[k]) return;
    if (!UI_KEYS[k] && remoteTs[k] && remoteTs[k] > (ts[k] || 0)) { noteStale(k); return; }
    map[k] = ''; dead[k] = true; ts[k] = stamp(); dirty[k] = 1;
    if (!UI_KEYS[k]) changeCount++;
    mirror(k); announce(k); schedule();
  }
  function noteStale(k) { if (staleKeys.indexOf(k) < 0) staleKeys.push(k); emit('stale', staleKeys.slice()); status(); }
  function announce(k) {
    if (UI_KEYS[k] || !chan) return;
    try { chan.postMessage({ t: tabId, k: k, ts: ts[k] }); } catch (e) {}
  }

  // ---------- write-behind to IndexedDB ----------
  function schedule() {
    status();
    if (flushTimer) return;
    flushTimer = setTimeout(function () { flushTimer = null; flush(); }, FLUSH_DELAY);
  }
  function flush() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    if (!db) { metaNow(); return Promise.resolve(false); }
    if (flushing) return flushing.then(function () { return Object.keys(dirty).length ? flush() : true; });
    var keys = Object.keys(dirty);
    if (!keys.length) { metaNow(); return Promise.resolve(true); }
    var batch = keys.map(function (k) { return { k: k, v: map[k], ts: ts[k], del: !!dead[k] }; });
    keys.forEach(function (k) { delete dirty[k]; });
    flushing = tx('kv', true, function (st) { batch.forEach(function (r) { st.put(r); }); }).then(function () {
      lastSavedAt = now(); lastErr = null; flushing = null; status(); metaNow(); return true;
    }, function (e) {
      keys.forEach(function (k) { if (!(k in dirty) && ts[k] === batch.filter(function (b) { return b.k === k; })[0].ts) dirty[k] = 1; });
      lastErr = e; flushing = null; status();
      if (!flushTimer) flushTimer = setTimeout(function () { flushTimer = null; flush(); }, 4000);   // retry later
      return false;
    });
    return flushing;
  }
  function status() {
    var s = getStatus();
    emit('status', s);
  }
  function getStatus() {
    return { mode: mode, pending: Object.keys(dirty).length + (flushing ? 1 : 0), lastSavedAt: lastSavedAt, error: lastErr ? String(lastErr.message || lastErr) : '',
      persisted: persisted, stale: staleKeys.slice(), keys: keysList().length, changeCount: changeCount };
  }

  // ---------- boot: merge IndexedDB + real-localStorage mirror ----------
  function boot() {
    meta = readMeta();
    var fromLS = Object.create(null);
    if (realLS) {
      for (var i = 0; i < realLS.length; i++) {
        var k = realLS.key(i);
        if (isGameKey(k)) fromLS[k] = realLS.getItem(k);
      }
    }
    var openP = idb().then(function (d) { db = d; mode = 'indexeddb'; return tx('kv', false, function (st) { return reqP(st.getAll()); }); })
      .catch(function (e) { mode = realLS ? 'localstorage-only' : 'memory'; lastErr = e; db = null; return []; });

    return openP.then(function (rows) {
      var fromIDB = Object.create(null);
      (Array.isArray(rows) ? rows : []).forEach(function (r) { fromIDB[r.k] = r; });
      var adoptedLS = 0, migrated = 0;
      var all = Object.create(null);
      Object.keys(fromIDB).forEach(function (k) { all[k] = 1; });
      Object.keys(fromLS).forEach(function (k) { all[k] = 1; });
      Object.keys(meta).forEach(function (k) { all[k] = 1; });
      Object.keys(all).forEach(function (k) {
        if (!isGameKey(k)) return;
        var r = fromIDB[k];
        var m = meta[k];
        var lsHas = k in fromLS;
        var lsTs = m ? m[0] : 0;
        var lsDeleted = !!(m && m[1]);
        var idbTs = r ? r.ts : 0;
        if (r && idbTs >= lsTs) {                                   // IndexedDB is the newer (or only) truth
          if (r.del) { map[k] = ''; dead[k] = true; } else { map[k] = r.v; dead[k] = false; }
          ts[k] = idbTs;
        } else if (m && lsDeleted && lsTs > idbTs) {                // delete happened after the last IDB write
          map[k] = ''; dead[k] = true; ts[k] = lsTs; dirty[k] = 1; adoptedLS++;
        } else if (lsHas && (!r || lsTs > idbTs)) {                 // mirror is newer, or an old pre-upgrade save
          map[k] = fromLS[k]; dead[k] = false;
          ts[k] = lsTs || stamp(); dirty[k] = 1;
          if (!m) migrated++; else adoptedLS++;
        } else if (r) { map[k] = r.del ? '' : r.v; dead[k] = !!r.del; ts[k] = idbTs; }
      });
      bootInfo = { mode: mode, keys: keysList().length, adoptedFromLocalStorage: adoptedLS, migratedFromOldSave: migrated };
      // refresh the mirror so it matches the merged truth
      Object.keys(map).forEach(function (k) { if (dirty[k] || !(meta[k] && meta[k][0] === ts[k])) mirror(k); });
      // install the drop-in localStorage
      var installed = false;
      try {
        Object.defineProperty(window, 'localStorage', { configurable: true, get: function () { return shim; } });
        installed = (window.localStorage === shim);
      } catch (e) { bootInfo.installFailed = String(e); }
      if (!installed && useProto) {
        // Fallback for browsers that refuse to replace window.localStorage: route the real Storage object's methods.
        try {
          var isReal = function (o) { return o === realLS; };
          NS.getItem = function (k) { return isReal(this) ? shim.getItem(k) : N.g.call(this, k); };
          NS.setItem = function (k, v) { return isReal(this) ? shim.setItem(k, v) : N.s.call(this, k, v); };
          NS.removeItem = function (k) { return isReal(this) ? shim.removeItem(k) : N.r.call(this, k); };
          NS.key = function (i) { return isReal(this) ? shim.key(i) : N.k.call(this, i); };
          NS.clear = function () { return isReal(this) ? shim.clear() : N.c.call(this); };
          if (N.ld && N.ld.get) Object.defineProperty(NS, 'length', { configurable: true, get: function () { return isReal(this) ? shim.length : N.ld.get.call(this); } });
          installed = true; bootInfo.installedVia = 'prototype';
        } catch (e) { bootInfo.installFailed2 = String(e); }
      }
      if (!installed) mode = mode + '+noshim';
      try {
        if (window.BroadcastChannel) {
          chan = new BroadcastChannel('apex-store');
          chan.onmessage = function (ev) {
            var m = ev.data; if (!m || m.t === tabId || !isGameKey(m.k) || UI_KEYS[m.k]) return;
            remoteTs[m.k] = Math.max(remoteTs[m.k] || 0, m.ts || 0);
            if (remoteTs[m.k] > (ts[m.k] || 0)) noteStale(m.k);
          };
        }
      } catch (e) {}
      window.addEventListener('storage', function () {});     // (kept: some browsers need a listener to mirror correctly)
      var leave = function () { flush(); metaNow(); };
      window.addEventListener('pagehide', leave);
      window.addEventListener('beforeunload', leave);
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') leave(); });
      try {
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(function (p) { persisted = !!p; status(); }).catch(function () {});
        if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(function (p) { persisted = !!p; status(); }).catch(function () {});
      } catch (e) {}
      return flush();
    }).then(function () { status(); return bootInfo; });
  }

  // ---------- snapshots ----------
  function utf8(s) { return new TextEncoder().encode(s); }
  function unutf8(b) { return new TextDecoder().decode(b); }
  function gzip(str) {
    if (typeof CompressionStream === 'undefined') return Promise.resolve({ enc: 'json', bytes: utf8(str) });
    try {
      var cs = new Response(new Blob([utf8(str)]).stream().pipeThrough(new CompressionStream('gzip')));
      return cs.arrayBuffer().then(function (ab) { return { enc: 'gzip', bytes: new Uint8Array(ab) }; });
    } catch (e) { return Promise.resolve({ enc: 'json', bytes: utf8(str) }); }
  }
  function gunzip(bytes, enc) {
    if (enc !== 'gzip') return Promise.resolve(unutf8(bytes));
    var ds = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
    return ds.text();
  }
  function dataObject() {
    var o = {};
    keysList().forEach(function (k) { o[k] = map[k]; });
    return o;
  }
  function describe(data) {
    var d = { season: false, tournament: false, matchDay: null };
    try { d.season = !!data.apexSeason; d.tournament = !!data.apexTournament; d.matchDay = data.apexMatchDay || null; } catch (e) {}
    return d;
  }
  // Same envelope as the game's own "Export save" so files are interchangeable.
  function exportPayload(extra) {
    var p = { app: 'apex-sim', formatVersion: 2, exportedAt: new Date().toISOString(), tabId: tabId, data: dataObject() };
    if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
    return p;
  }
  function beforeSnapshot() {
    // ask the running game to write its in-memory state first, so the snapshot is exactly what is on screen
    try { if (window.App && typeof window.App.persistNow === 'function') window.App.persistNow(); } catch (e) {}
  }
  function snapshot(label, kind) {
    if (!db) return Promise.reject(new Error('Snapshots need IndexedDB (not available in this browser mode)'));
    beforeSnapshot();
    var data = dataObject();
    if (!Object.keys(data).length) return Promise.resolve(null);
    var json = JSON.stringify({ app: 'apex-sim', formatVersion: 2, data: data });
    return gzip(json).then(function (z) {
      var rec = { id: 's' + now().toString(36) + Math.random().toString(36).slice(2, 5), at: now(), label: label || 'Snapshot', kind: kind || 'manual',
        enc: z.enc, bytes: z.bytes, size: z.bytes.length, raw: json.length, info: describe(data) };
      return tx('snaps', true, function (st) { st.put(rec); }).then(function () { return prune().then(function () { try { rawSet(DEV + 'lastAutoSnap', String(now())); } catch (e) {} return strip(rec); }); });
    });
  }
  function strip(r) { return { id: r.id, at: r.at, label: r.label, kind: r.kind, size: r.size, raw: r.raw, info: r.info }; }
  function listSnapshots() {
    if (!db) return Promise.resolve([]);
    return tx('snaps', false, function (st) { return reqP(st.getAll()); }).then(function (rows) {
      return (rows || []).map(strip).sort(function (a, b) { return b.at - a.at; });
    });
  }
  function readSnapshot(id) {
    return tx('snaps', false, function (st) { return reqP(st.get(id)); }).then(function (r) { if (!r) throw new Error('Snapshot not found'); return gunzip(r.bytes, r.enc).then(function (t) { return JSON.parse(t); }); });
  }
  function prune() {
    return listSnapshots().then(function (list) {
      var del = [];
      var autos = list.filter(function (s) { return s.kind === 'auto'; });
      var manual = list.filter(function (s) { return s.kind !== 'auto'; });
      autos.slice(MAX_AUTO_SNAPS).forEach(function (s) { del.push(s.id); });
      manual.slice(MAX_MANUAL_SNAPS).forEach(function (s) { del.push(s.id); });
      if (!del.length) return;
      return tx('snaps', true, function (st) { del.forEach(function (id) { st.delete(id); }); });
    });
  }
  function deleteSnapshot(id) { return tx('snaps', true, function (st) { st.delete(id); }); }
  function maybeAutoSnapshot() {
    if (!db || !keysList().some(function (k) { return !UI_KEYS[k]; })) return Promise.resolve(null);
    var last = parseInt(rawGet(DEV + 'lastAutoSnap') || '0', 10) || 0;
    if (now() - last < AUTO_SNAP_EVERY) return Promise.resolve(null);
    return snapshot('Auto snapshot', 'auto').catch(function () { return null; });
  }

  // ---------- replace everything (restore / import / cloud load) ----------
  function replaceAll(dataObj, opts) {
    opts = opts || {};
    var keys = Object.keys(dataObj || {}).filter(isGameKey);
    if (!keys.length) return Promise.reject(new Error('That save has no game data'));
    var pre = opts.skipSafety ? Promise.resolve() : snapshot('Before ' + (opts.reason || 'restore'), 'safety').catch(function () {});
    return pre.then(function () {
      staleKeys = []; Object.keys(remoteTs).forEach(function (k) { delete remoteTs[k]; });   // we are deliberately replacing
      keysList().forEach(function (k) { if (keys.indexOf(k) < 0) removeItem(k); });
      var order = ['apexSeason', 'apexTournament'];                                         // biggest first
      keys.sort(function (a, b) { return (order.indexOf(b) >= 0) - (order.indexOf(a) >= 0); });
      keys.forEach(function (k) { var v = dataObj[k]; map[k] = ''; dead[k] = true; setItem(k, String(v)); });
      changeCount++;
      return flush().then(function (ok) {
        if (ok === false && mode === 'indexeddb') throw new Error('Could not write the save to browser storage' + (lastErr ? ': ' + (lastErr.message || lastErr) : ''));
        return keys.length;
      });
    });
  }
  function restoreSnapshot(id) { return readSnapshot(id).then(function (p) { return replaceAll(p.data, { reason: 'restore' }); }); }

  function estimate() {
    try { if (navigator.storage && navigator.storage.estimate) return navigator.storage.estimate().then(function (e) { return { usage: e.usage || 0, quota: e.quota || 0 }; }); } catch (e) {}
    return Promise.resolve({ usage: 0, quota: 0 });
  }
  function dataSize() { var n = 0; keysList().forEach(function (k) { n += k.length + map[k].length; }); return n; }

  // ---------- device settings (real localStorage, never exported) ----------
  function dev(key, val) {
    if (val === undefined) return rawGet(DEV + key);
    if (val === null) rawDel(DEV + key); else rawSet(DEV + key, String(val));
  }
  function deviceId() { var d = dev('deviceId'); if (!d) { d = 'dev-' + Math.random().toString(36).slice(2, 10); dev('deviceId', d); } return d; }

  var api = {
    version: 1,
    tabId: tabId,
    ready: null,
    on: function (type, fn) { (listeners[type] = listeners[type] || []).push(fn); return function () { listeners[type] = listeners[type].filter(function (f) { return f !== fn; }); }; },
    status: getStatus, flush: flush, boot: function () { return bootInfo; },
    snapshot: snapshot, listSnapshots: listSnapshots, readSnapshot: readSnapshot, deleteSnapshot: deleteSnapshot,
    restoreSnapshot: restoreSnapshot, maybeAutoSnapshot: maybeAutoSnapshot,
    exportPayload: exportPayload, replaceAll: replaceAll, dataObject: dataObject,
    estimate: estimate, dataSize: dataSize, dev: dev, deviceId: deviceId,
    gzip: gzip, gunzip: gunzip, isGameKey: isGameKey, UI_KEYS: UI_KEYS,
    changeCount: function () { return changeCount; },
    acknowledgeStale: function () { staleKeys = []; },
    // for the game's reload paths: write everything, THEN reload
    saveAndReload: function () { return flush().then(function () { metaNow(); location.reload(); }, function () { location.reload(); }); }
  };
  window.ApexStore = api;

  api.ready = boot().catch(function (e) { bootInfo = { error: String(e) }; return bootInfo; });

  // ---------- load the app (and UI) only once the data is in memory ----------
  var me = document.currentScript;
  var appSrc = me && me.getAttribute('data-app');
  var base = '';
  if (me && me.src) base = me.src.replace(/[^\/]*$/, '');
  function addScript(src) {
    return new Promise(function (res) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = res;
      (document.body || document.head).appendChild(s);
    });
  }
  api.ready.then(function () {
    var pr = appSrc ? addScript(appSrc) : Promise.resolve();
    return pr.then(function () { return addScript(base + 'apex-config.js?v=1'); }).then(function () {
      return addScript(base + 'apex-drive.js?v=1').then(function () { return addScript(base + 'apex-save-ui.js?v=1'); });
    });
  }).then(function () { setTimeout(maybeAutoSnapshot, 8000); });
})();
