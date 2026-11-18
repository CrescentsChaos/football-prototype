/*
 * APEX DRIVE - save sync to the player's own Google Drive (hidden "App Data" folder).
 *
 * - Uses Google Identity Services (token flow) with the narrow scope  drive.appdata :
 *   the game can only see ITS OWN hidden folder - never the person's other Drive files, and it does not show up in
 *   the normal Drive file list.  No server, no secrets: the OAuth Client ID is public by design.
 * - Saves are gzip-compressed JSON in the same envelope as the in-game "Export save" file.
 * - Files:  apex-save-main.json.gz  (the live cloud save)   apex-backup-<time>.json.gz  (rotating copies of every
 *           overwritten main save, newest 6 kept)   apex-slot-<name>.json.gz  (named saves you make on purpose)
 * - Conflict-safe: it remembers a content hash of what was last synced. If BOTH this device and the cloud changed
 *   since then, it never overwrites anything - it asks which one to keep (and a backup is always made first).
 */
(function () {
  'use strict';
  if (window.ApexDrive) return;
  var S = window.ApexStore;
  var SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  var MAIN = 'apex-save-main.json.gz';
  var MAX_BACKUPS = 6;
  var AUTO_PUSH_DELAY = 60000;
  var listeners = [];
  var gisLoading = null, tokenClient = null, token = null, tokenExp = 0, pushTimer = null, busy = false;
  var state = { phase: 'off', message: '', lastSyncAt: 0, conflict: null };

  function cfgId() {
    var v = S.dev('clientId');
    if (v) return v;
    return (window.APEX_CONFIG && window.APEX_CONFIG.googleClientId) || '';
  }
  function emit() { var s = status(); listeners.slice().forEach(function (f) { try { f(s); } catch (e) {} }); }
  function setState(phase, message) { state.phase = phase; state.message = message || ''; emit(); }

  // ---------- content hash of the data that matters (UI-only keys ignored) ----------
  function hashData(data) {
    var keys = Object.keys(data).filter(function (k) { return !S.UI_KEYS[k]; }).sort();
    var h = 2166136261 >>> 0, h2 = 5381 >>> 0, n = 0;
    keys.forEach(function (k) {
      var str = k + '\u0001' + data[k] + '\u0002';
      for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        h ^= c; h = Math.imul(h, 16777619) >>> 0;
        h2 = (Math.imul(h2, 33) ^ c) >>> 0;
      }
      n += str.length;
    });
    return h.toString(36) + h2.toString(36) + n.toString(36);
  }
  function localHash() { return hashData(S.dataObject()); }

  // ---------- Google sign-in ----------
  function loadGis() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gisLoading) return gisLoading;
    gisLoading = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = function () { res(); };
      s.onerror = function () { gisLoading = null; rej(new Error('Could not load Google sign-in (offline or blocked?)')); };
      document.head.appendChild(s);
    });
    return gisLoading;
  }
  function restoreToken() {
    var t = S.dev('token'), e = parseInt(S.dev('tokenExp') || '0', 10) || 0;
    if (t && e > Date.now() + 60000) { token = t; tokenExp = e; }
  }
  function storeToken(t, expiresIn) {
    token = t; tokenExp = Date.now() + (expiresIn || 3600) * 1000;
    S.dev('token', t); S.dev('tokenExp', tokenExp); S.dev('connected', '1');
  }
  function clearToken() { token = null; tokenExp = 0; S.dev('token', null); S.dev('tokenExp', null); }

  // interactive=true must be called from a click (popup). interactive=false tries silently.
  function connect(interactive) {
    var id = cfgId();
    if (!id) return Promise.reject(new Error('Add your Google OAuth Client ID first (see setup steps)'));
    return loadGis().then(function () {
      return new Promise(function (res, rej) {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: id, scope: SCOPE,
          callback: function (r) {
            if (r && r.access_token) { storeToken(r.access_token, parseInt(r.expires_in, 10) || 3600); setState('connected', ''); res(); }
            else rej(new Error((r && (r.error_description || r.error)) || 'Sign-in was not completed'));
          },
          error_callback: function (e) { rej(new Error((e && (e.message || e.type)) || 'Sign-in popup was closed or blocked')); }
        });
        tokenClient.requestAccessToken({ prompt: interactive ? (S.dev('connected') ? '' : 'consent') : '' });
      });
    });
  }
  function disconnect() {
    var t = token;
    clearToken(); S.dev('connected', null); S.dev('lastHash', null); S.dev('driveMainId', null);
    try { if (t && window.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(t, function () {}); } catch (e) {}
    setState('off', '');
  }
  function haveToken() { return !!token && tokenExp > Date.now() + 30000; }
  function ensureToken(interactive) {
    if (haveToken()) return Promise.resolve();
    if (!S.dev('connected')) return Promise.reject(new Error('Not connected to Google Drive'));
    return connect(!!interactive).catch(function (e) {
      setState('reconnect', 'Google session expired - tap Reconnect');
      throw e;
    });
  }

  // ---------- Drive REST ----------
  function authFetch(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ Authorization: 'Bearer ' + token }, opts.headers || {});
    return fetch(url, opts).then(function (r) {
      if (r.status === 401) { clearToken(); setState('reconnect', 'Google session expired - tap Reconnect'); throw new Error('Google session expired'); }
      if (!r.ok) return r.text().then(function (t) { throw new Error('Drive error ' + r.status + ': ' + t.slice(0, 160)); });
      return r;
    });
  }
  var FIELDS = 'id,name,modifiedTime,size,appProperties';
  function listFiles() {
    return authFetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&pageSize=200&orderBy=modifiedTime%20desc&fields=files(' + FIELDS + ')')
      .then(function (r) { return r.json(); }).then(function (j) { return j.files || []; });
  }
  function multipart(meta, bytes) {
    var b = 'apexb' + Math.random().toString(36).slice(2);
    var head = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + b + '\r\nContent-Type: application/gzip\r\n\r\n';
    var blob = new Blob([head, bytes, '\r\n--' + b + '--']);
    return { blob: blob, type: 'multipart/related; boundary=' + b };
  }
  function upload(name, bytes, props, existingId) {
    var meta = { name: name, appProperties: props };
    if (!existingId) meta.parents = ['appDataFolder'];
    var m = multipart(meta, bytes);
    var url = existingId
      ? 'https://www.googleapis.com/upload/drive/v3/files/' + existingId + '?uploadType=multipart&fields=' + FIELDS
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=' + FIELDS;
    return authFetch(url, { method: existingId ? 'PATCH' : 'POST', headers: { 'Content-Type': m.type }, body: m.blob }).then(function (r) { return r.json(); });
  }
  function download(id) {
    return authFetch('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media').then(function (r) { return r.arrayBuffer(); }).then(function (ab) {
      var b = new Uint8Array(ab);
      var gz = b.length > 2 && b[0] === 0x1f && b[1] === 0x8b;
      return S.gunzip(b, gz ? 'gzip' : 'json').then(function (t) { return JSON.parse(t); });
    });
  }
  function copyAsBackup(file) {
    var nm = 'apex-backup-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.json.gz';
    return authFetch('https://www.googleapis.com/drive/v3/files/' + file.id + '/copy?fields=' + FIELDS, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nm, parents: ['appDataFolder'], appProperties: file.appProperties || {} })
    }).then(function (r) { return r.json(); });
  }
  function pruneBackups() {
    return listFiles().then(function (files) {
      var b = files.filter(function (f) { return f.name.indexOf('apex-backup-') === 0; });
      return Promise.all(b.slice(MAX_BACKUPS).map(function (f) { return authFetch('https://www.googleapis.com/drive/v3/files/' + f.id, { method: 'DELETE' }); }));
    });
  }
  function deleteFile(id) { return ensureToken(true).then(function () { return authFetch('https://www.googleapis.com/drive/v3/files/' + id, { method: 'DELETE' }); }); }

  // ---------- push / pull ----------
  function describeLocal() {
    var d = S.dataObject();
    return { hash: hashData(d), season: !!d.apexSeason, tournament: !!d.apexTournament };
  }
  function push(opts) {
    opts = opts || {};
    return ensureToken(!opts.auto).then(function () {
      var payload = S.exportPayload({ device: S.deviceId(), label: opts.label || '' });
      var d = payload.data, h = hashData(d);
      var json = JSON.stringify(payload);
      return Promise.all([S.gzip(json), listFiles()]).then(function (arr) {
        var z = arr[0], files = arr[1];
        var props = { hash: h, dev: S.deviceId(), at: new Date().toISOString(), keys: String(Object.keys(d).length) };
        var isSlot = !!opts.slot;
        var name = isSlot ? 'apex-slot-' + opts.slot.replace(/[^\w\- ]+/g, '').trim().slice(0, 40) + '.json.gz' : MAIN;
        var existing = files.filter(function (f) { return f.name === name; })[0];
        var pre = (existing && !isSlot) ? copyAsBackup(existing).catch(function () {}) : Promise.resolve();
        return pre.then(function () { return upload(name, z.bytes, props, existing && existing.id); }).then(function (f) {
          if (!isSlot) { S.dev('lastHash', h); S.dev('driveMainId', f.id); state.lastSyncAt = Date.now(); S.dev('lastSyncAt', state.lastSyncAt); }
          return pruneBackups().catch(function () {}).then(function () { return f; });
        });
      });
    });
  }
  function pull(fileId, opts) {
    opts = opts || {};
    return ensureToken(true).then(function () { return download(fileId); }).then(function (payload) {
      if (!payload || !payload.data) throw new Error('That cloud file is not an APEX save');
      return S.replaceAll(payload.data, { reason: opts.reason || 'cloud load' }).then(function () {
        if (opts.markSynced) { S.dev('lastHash', hashData(payload.data)); S.dev('driveMainId', fileId); state.lastSyncAt = Date.now(); S.dev('lastSyncAt', state.lastSyncAt); }
        return payload;
      });
    });
  }

  // ---------- sync decision ----------
  function sync(opts) {
    opts = opts || {};
    if (busy) return Promise.resolve({ result: 'busy' });
    busy = true; setState('syncing', 'Checking Google Drive...');
    var finish = function (r) { busy = false; setState('connected', ''); return r; };
    var fail = function (e) { busy = false; if (state.phase !== 'reconnect') setState('error', e.message || String(e)); throw e; };
    return ensureToken(!opts.auto).then(function () { return listFiles(); }).then(function (files) {
      var main = files.filter(function (f) { return f.name === MAIN; })[0];
      var cur = describeLocal();
      var last = S.dev('lastHash') || '';
      var hasLocal = Object.keys(S.dataObject()).filter(function (k) { return !S.UI_KEYS[k]; }).length > 0;
      if (!main) {
        if (!hasLocal) return finish({ result: 'empty' });
        return push({ auto: opts.auto }).then(function () { return finish({ result: 'pushed-first' }); });
      }
      var rh = (main.appProperties || {}).hash || '';
      if (rh && rh === cur.hash) {                              // identical
        S.dev('lastHash', cur.hash); S.dev('driveMainId', main.id); state.lastSyncAt = Date.now(); S.dev('lastSyncAt', state.lastSyncAt);
        return finish({ result: 'in-sync' });
      }
      var localChanged = cur.hash !== last, remoteChanged = rh !== last;
      if (!hasLocal) {                                          // fresh device: just take the cloud save
        return pull(main.id, { markSynced: true, reason: 'first cloud load' }).then(function () { return finish({ result: 'pulled', reload: true }); });
      }
      if (localChanged && !remoteChanged) return push({ auto: opts.auto }).then(function () { return finish({ result: 'pushed' }); });
      if (!localChanged && remoteChanged) {
        if (opts.auto && !opts.askBeforePull) return pull(main.id, { markSynced: true, reason: 'cloud update' }).then(function () { return finish({ result: 'pulled', reload: true }); });
        state.conflict = { kind: 'remote-newer', remote: main, local: cur }; return finish({ result: 'remote-newer', remote: main });
      }
      // both changed (or never synced before and the two differ)
      state.conflict = { kind: 'both', remote: main, local: cur };
      return finish({ result: 'conflict', remote: main, local: cur });
    }).catch(fail);
  }
  function resolveConflict(choice) {
    var c = state.conflict; if (!c) return Promise.resolve();
    state.conflict = null;
    if (choice === 'cloud') return pull(c.remote.id, { markSynced: true, reason: 'cloud choice' }).then(function () { return { result: 'pulled', reload: true }; });
    if (choice === 'local') return push({}).then(function () { return { result: 'pushed' }; });
    emit(); return Promise.resolve({ result: 'cancel' });
  }

  // ---------- auto push after changes ----------
  function noteChanges() {
    if (!S.dev('connected') || S.dev('autoSync') === '0') return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      pushTimer = null;
      if (document.visibilityState === 'hidden' || busy || state.conflict) return;
      sync({ auto: true, askBeforePull: true }).then(function (r) { if (r && (r.result === 'remote-newer' || r.result === 'conflict')) emit(); }).catch(function () {});
    }, AUTO_PUSH_DELAY);
  }
  var lastCount = 0;
  S.on('status', function (s) { if (s.changeCount !== lastCount) { lastCount = s.changeCount; noteChanges(); } });

  function status() {
    var cur = null;
    return {
      configured: !!cfgId(), connected: !!S.dev('connected'), tokenValid: haveToken(), phase: state.phase, message: state.message,
      lastSyncAt: parseInt(S.dev('lastSyncAt') || '0', 10) || 0, conflict: state.conflict, autoSync: S.dev('autoSync') !== '0',
      unsynced: !!S.dev('connected') && localHash() !== (S.dev('lastHash') || '')
    };
  }

  window.ApexDrive = {
    on: function (fn) { listeners.push(fn); },
    status: status, cfgId: cfgId, setClientId: function (v) { S.dev('clientId', (v || '').trim() || null); emit(); },
    setAutoSync: function (on) { S.dev('autoSync', on ? '1' : '0'); emit(); },
    connect: function () { return connect(true).then(function () { return sync({}); }); },
    reconnect: function () { return connect(true).then(function () { return sync({}); }); },
    disconnect: disconnect, listFiles: function () { return ensureToken(true).then(listFiles); },
    push: push, pull: pull, sync: sync, resolveConflict: resolveConflict, deleteFile: deleteFile,
    saveSlot: function (name) { return push({ slot: name || ('slot ' + new Date().toLocaleString()) }); },
    hash: localHash, _hashData: hashData
  };

  restoreToken();
  if (S.dev('connected')) {
    state.phase = haveToken() ? 'connected' : 'reconnect';
    if (!haveToken()) state.message = 'Tap Reconnect to continue syncing';
    // On every page load: if the token is still valid, check the cloud once (quietly).
    if (haveToken()) setTimeout(function () { sync({ auto: true, askBeforePull: true }).then(function (r) { if (r && r.reload) location.reload(); }).catch(function () {}); }, 2500);
  }
})();
