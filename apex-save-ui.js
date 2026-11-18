/*
 * APEX SAVE MANAGER UI - a small "Saves" pill on every page + a panel with:
 *   - storage health (where the save lives, how much space is used, persistent-storage request)
 *   - snapshots (rollback points: automatic, manual, and "before import / reset")
 *   - export / import save file
 *   - Google Drive (connect, sync, cloud backups, named cloud slots, conflict choices)
 * Self-contained: injects its own CSS (uses the game's theme variables when present).
 */
(function () {
  'use strict';
  if (window.ApexSaveUI) return;
  var S = window.ApexStore, D = window.ApexDrive;
  if (!S) return;

  var css = '' +
    '#apx-pill{position:fixed;right:14px;bottom:14px;z-index:9000;display:flex;gap:8px;align-items:center;background:var(--bg-2,#18231f);color:var(--text,#e9f0ed);border:1px solid var(--border-strong,rgba(255,255,255,.18));border-radius:999px;padding:8px 14px;font:600 13px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.45)}' +
    '#apx-pill:hover{border-color:var(--accent,#4cb782)}#apx-pill .d{width:9px;height:9px;border-radius:50%;background:var(--accent,#4cb782)}' +
    '#apx-pill.warn .d{background:var(--orange,#e0a23c)}#apx-pill.bad .d{background:var(--red,#e5675c)}#apx-pill.busy .d{animation:apxp 1s infinite}@keyframes apxp{50%{opacity:.25}}' +
    '#apx-stale{position:fixed;left:0;right:0;top:0;z-index:9500;background:var(--red,#e5675c);color:#fff;padding:10px 14px;font:600 14px system-ui,sans-serif;text-align:center;display:none}' +
    '#apx-stale button{margin-left:10px;padding:4px 12px;border-radius:6px;border:0;font-weight:700;cursor:pointer}' +
    '#apx-ov{position:fixed;inset:0;z-index:9600;background:rgba(0,0,0,.6);display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 12px}' +
    '#apx-ov.open{display:flex}#apx-box{width:min(720px,100%);background:var(--bg-1,#121b19);color:var(--text,#e9f0ed);border:1px solid var(--border-strong,rgba(255,255,255,.18));border-radius:14px;padding:18px 20px 22px;font:14px/1.45 system-ui,sans-serif}' +
    '#apx-box h2{margin:0 0 2px;font-size:20px}#apx-box h3{margin:20px 0 8px;font-size:15px;color:var(--accent,#4cb782);text-transform:uppercase;letter-spacing:.05em}' +
    '#apx-box .sub{color:var(--text-2,#9db0a9);font-size:13px}#apx-x{float:right;background:none;border:0;color:var(--text-2,#9db0a9);font-size:26px;cursor:pointer;line-height:1}' +
    '#apx-box .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}' +
    '#apx-box button.b{background:var(--bg-3,#20302b);color:var(--text,#e9f0ed);border:1px solid var(--border-strong,rgba(255,255,255,.18));border-radius:8px;padding:8px 13px;font:600 13px system-ui,sans-serif;cursor:pointer}' +
    '#apx-box button.b:hover{border-color:var(--accent,#4cb782)}#apx-box button.p{background:var(--accent,#4cb782);color:var(--accent-ink,#07130d);border-color:transparent}' +
    '#apx-box button.r{color:var(--red,#e5675c)}#apx-box button:disabled{opacity:.5;cursor:default}' +
    '#apx-box input[type=text]{flex:1;min-width:200px;background:var(--bg-0,#0d1513);color:inherit;border:1px solid var(--border-strong,rgba(255,255,255,.18));border-radius:8px;padding:8px 10px;font:13px monospace}' +
    '#apx-box .card{background:var(--bg-2,#18231f);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:10px;padding:10px 12px;margin:6px 0}' +
    '#apx-box .li{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:8px 0;border-top:1px solid var(--border,rgba(255,255,255,.08))}#apx-box .li:first-child{border-top:0}' +
    '#apx-box .bar{height:8px;border-radius:6px;background:var(--bg-0,#0d1513);overflow:hidden}#apx-box .bar i{display:block;height:100%;background:var(--accent,#4cb782)}' +
    '#apx-box .tag{font-size:11px;padding:2px 7px;border-radius:99px;background:var(--bg-3,#20302b);color:var(--text-2,#9db0a9);margin-left:6px}' +
    '#apx-box ol{margin:6px 0 6px 18px;padding:0}#apx-box code{background:var(--bg-0,#0d1513);padding:1px 6px;border-radius:5px;font-size:12px;user-select:all}' +
    '#apx-box .warn{color:var(--orange,#e0a23c)}#apx-box .good{color:var(--accent,#4cb782)}#apx-box .bad{color:var(--red,#e5675c)}' +
    '#apx-toast{position:fixed;left:50%;bottom:70px;transform:translateX(-50%);background:var(--bg-3,#20302b);color:var(--text,#e9f0ed);padding:10px 16px;border-radius:10px;z-index:9700;font:600 13px system-ui,sans-serif;display:none;border:1px solid var(--accent,#4cb782);max-width:90vw}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function el(tag, attrs, html) { var e = document.createElement(tag); if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtB(n) { if (!n) return '0 B'; var u = ['B', 'KB', 'MB', 'GB']; var i = Math.min(3, Math.floor(Math.log(n) / Math.log(1024))); return (n / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + u[i]; }
  function fmtT(t) { if (!t) return 'never'; var d = new Date(t); var s = (Date.now() - t) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }

  var pill = el('div', { id: 'apx-pill', role: 'button', tabindex: '0', title: 'Open Save Manager' }, '<span class="d"></span><span class="t">Saves</span>');
  var stale = el('div', { id: 'apx-stale' }, 'Your save was changed in another tab/page, so this page stopped saving to protect it. <button id="apx-reload">Reload</button>');
  var ov = el('div', { id: 'apx-ov' }, '<div id="apx-box"></div>');
  var toastEl = el('div', { id: 'apx-toast' });
  document.body.appendChild(pill); document.body.appendChild(stale); document.body.appendChild(ov); document.body.appendChild(toastEl);
  var box = ov.firstChild, tmr = null;
  function toast(m) { toastEl.textContent = m; toastEl.style.display = 'block'; clearTimeout(tmr); tmr = setTimeout(function () { toastEl.style.display = 'none'; }, 3800); }
  function persistNow() { try { if (window.App && App.persistNow) App.persistNow(); } catch (e) {} }

  // ---------- pill ----------
  function paintPill() {
    var s = S.status(), d = D ? D.status() : null, cls = '', txt;
    if (s.error && s.pending) { cls = 'bad'; txt = 'Save problem'; }
    else if (s.stale.length) { cls = 'bad'; txt = 'Reload needed'; }
    else if (s.pending) { cls = 'busy'; txt = 'Saving...'; }
    else txt = 'Saved ' + (s.lastSavedAt ? new Date(s.lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
    if (d && d.connected) {
      if (d.conflict) { cls = cls || 'warn'; txt += ' · \u2601 choose'; }
      else if (d.phase === 'reconnect') { cls = cls || 'warn'; txt += ' · \u2601 reconnect'; }
      else if (d.phase === 'syncing') txt += ' · \u2601 syncing';
      else if (d.phase === 'error') { cls = cls || 'warn'; txt += ' · \u2601 error'; }
      else txt += d.unsynced ? ' · \u2601 not synced' : ' · \u2601 synced';
    }
    pill.className = cls; pill.querySelector('.t').textContent = txt;
    stale.style.display = s.stale.length ? 'block' : 'none';
  }
  var pt = null; function paintSoon() { if (pt) return; pt = setTimeout(function () { pt = null; paintPill(); if (ov.classList.contains('open')) render(false); }, 250); }
  S.on('status', paintSoon); if (D) D.on(paintSoon);
  setInterval(paintPill, 20000);
  stale.querySelector('#apx-reload').onclick = function () { location.reload(); };
  pill.onclick = open; pill.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') open(); };

  // ---------- panel ----------
  var snaps = null, files = null, est = null, filesErr = '', busyMsg = '';
  function open() { ov.classList.add('open'); persistNow(); refresh(); }
  function close() { ov.classList.remove('open'); }
  ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  function refresh() {
    render(true);
    S.listSnapshots().then(function (l) { snaps = l; render(false); }, function () { snaps = []; render(false); });
    S.estimate().then(function (e) { est = e; render(false); });
    if (D && D.status().connected) loadFiles();
  }
  function loadFiles() {
    filesErr = ''; D.listFiles().then(function (f) { files = f; render(false); }, function (e) { files = null; filesErr = e.message; render(false); });
  }
  function run(label, p, after) {
    busyMsg = label; render(false);
    return p.then(function (r) { busyMsg = ''; if (after) after(r); render(false); return r; }, function (e) { busyMsg = ''; toast((e && e.message) || String(e)); render(false); });
  }
  function download(name, text, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type || 'application/json' }));
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  function stamp() { var d = new Date(); function p(n) { return ('0' + n).slice(-2); } return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()); }
  function summ(i) { if (!i) return ''; var a = []; if (i.season) a.push('season'); if (i.tournament) a.push('tournament'); if (i.matchDay) a.push('matchday ' + i.matchDay); return a.join(' · '); }

  function render(initial) {
    var s = S.status(), d = D ? D.status() : { configured: false, connected: false }, h = '';
    var inputFocus = document.activeElement && document.activeElement.id;
    h += '<button id="apx-x" aria-label="Close">&times;</button><h2>Save Manager</h2><div class="sub">Where your progress lives, and how to never lose it.</div>';
    if (busyMsg) h += '<div class="card warn">' + esc(busyMsg) + '</div>';

    // --- this device
    var pct = est && est.quota ? Math.min(100, (est.usage / est.quota) * 100) : 0;
    h += '<h3>This device</h3><div class="card">' +
      '<div>Stored in: <b class="' + (s.mode === 'indexeddb' ? 'good' : 'warn') + '">' + (s.mode === 'indexeddb' ? 'IndexedDB (large, durable)' : esc(s.mode) + ' &mdash; limited!') + '</b>' +
      '<span class="tag">' + s.keys + ' items &middot; ' + fmtB(S.dataSize()) + '</span></div>' +
      '<div class="sub" style="margin:6px 0">Last written: ' + fmtT(s.lastSavedAt) + (s.pending ? ' &middot; ' + s.pending + ' pending' : '') + (s.error ? ' &middot; <span class="bad">' + esc(s.error) + '</span>' : '') + '</div>' +
      (est && est.quota ? '<div class="bar"><i style="width:' + pct.toFixed(1) + '%"></i></div><div class="sub">Browser space for this site: ' + fmtB(est.usage) + ' of ' + fmtB(est.quota) + '</div>' : '') +
      '<div class="sub">Protected from automatic cleanup: <b class="' + (s.persisted ? 'good' : 'warn') + '">' + (s.persisted ? 'yes' : 'not yet') + '</b> ' +
      (s.persisted ? '' : '<button class="b" id="apx-persist">Request</button>') + '</div></div>';

    // --- snapshots
    h += '<h3>Snapshots (rollback points)</h3><div class="row"><button class="b p" id="apx-snap">Create snapshot now</button>' +
      '<span class="sub">Automatic ones are taken every ~20 min, and always before an import, reset or cloud load.</span></div><div class="card">';
    if (snaps == null) h += '<div class="sub">Loading...</div>';
    else if (!snaps.length) h += '<div class="sub">No snapshots yet.</div>';
    else snaps.forEach(function (x) {
      h += '<div class="li"><div><b>' + esc(x.label) + '</b><span class="tag">' + esc(x.kind) + '</span><br><span class="sub">' + new Date(x.at).toLocaleString() + ' &middot; ' + fmtB(x.size) + (summ(x.info) ? ' &middot; ' + esc(summ(x.info)) : '') + '</span></div>' +
        '<div><button class="b" data-snap-restore="' + x.id + '">Restore</button> <button class="b" data-snap-dl="' + x.id + '">Download</button> <button class="b r" data-snap-del="' + x.id + '">Delete</button></div></div>';
    });
    h += '</div>';

    // --- file
    h += '<h3>Save file</h3><div class="row"><button class="b" id="apx-exp">Export save file</button><button class="b" id="apx-imp">Import save file</button>' +
      '<input type="file" id="apx-file" accept="application/json,.json,.gz" style="display:none"><span class="sub">Same format as the in-game Export, so old files still work.</span></div>';

    // --- drive
    h += '<h3>Google Drive</h3>' + driveHtml(d);
    box.innerHTML = h;
    wire(d);
    if (inputFocus === 'apx-cid') { var i = box.querySelector('#apx-cid'); if (i) i.focus(); }
  }

  function driveHtml(d) {
    var h = '<div class="card">';
    if (!D) return h + '<div class="warn">Drive module not loaded.</div></div>';
    if (!d.configured) {
      return h + '<div><b>One-time setup</b> (free, ~5 minutes) &mdash; your saves go to a <i>hidden app folder in your own Drive</i>; the game can see nothing else in your Drive.</div><ol>' +
        '<li>Open <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener" style="color:var(--accent,#4cb782)">Google Cloud Console</a> &rarr; create a project (any name).</li>' +
        '<li>APIs &amp; Services &rarr; <b>Library</b> &rarr; enable <b>Google Drive API</b>.</li>' +
        '<li><b>OAuth consent screen</b> &rarr; External &rarr; fill app name + your email &rarr; <b>Add test user</b>: your Google account. Add the scope <code>drive.appdata</code>.</li>' +
        '<li><b>Credentials</b> &rarr; Create credentials &rarr; <b>OAuth client ID</b> &rarr; Web application &rarr; under <i>Authorized JavaScript origins</i> add <code>' + esc(location.origin) + '</code></li>' +
        '<li>Copy the Client ID (ends with <code>.apps.googleusercontent.com</code>) and paste it here:</li></ol>' +
        '<div class="row"><input type="text" id="apx-cid" placeholder="1234567890-abc...apps.googleusercontent.com"><button class="b p" id="apx-cid-save">Save</button></div>' +
        '<div class="sub">Tip: put it in <code>apex-config.js</code> once and every device/browser picks it up automatically.</div></div>';
    }
    if (!d.connected) {
      return h + '<div>Sync your save to Google Drive so a refresh, a cleared browser, or a new phone never loses your tournament.</div>' +
        '<div class="row"><button class="b p" id="apx-conn">Connect Google Drive</button><button class="b" id="apx-cid-edit">Change Client ID</button></div></div>';
    }
    h += '<div>Status: <b class="' + (d.phase === 'error' || d.phase === 'reconnect' ? 'warn' : 'good') + '">' +
      (d.phase === 'syncing' ? 'syncing...' : d.phase === 'reconnect' ? 'needs reconnect' : d.phase === 'error' ? 'error' : 'connected') + '</b>' +
      '<span class="tag">' + (d.unsynced ? 'changes not in cloud yet' : 'cloud is up to date') + '</span></div>' +
      '<div class="sub">Last sync: ' + fmtT(d.lastSyncAt) + (d.message ? ' &middot; <span class="warn">' + esc(d.message) + '</span>' : '') + '</div>';
    if (d.conflict) {
      var c = d.conflict, rp = (c.remote && c.remote.appProperties) || {};
      h += '<div class="card" style="border-color:var(--orange,#e0a23c)"><b class="warn">' + (c.kind === 'both' ? 'Two different saves exist' : 'A newer save is in the cloud') + '</b><div class="sub">Cloud copy: ' +
        (rp.at ? new Date(rp.at).toLocaleString() : 'unknown time') + ' (device ' + esc(rp.dev || '?') + '). Nothing is overwritten until you choose; a backup is always made first.</div>' +
        '<div class="row"><button class="b p" id="apx-use-cloud">Use the cloud save</button>' + (c.kind === 'both' ? '<button class="b" id="apx-use-local">Keep this device&rsquo;s save</button>' : '<button class="b" id="apx-use-local">Keep this device &amp; overwrite cloud</button>') + '<button class="b" id="apx-cancel">Decide later</button></div></div>';
    }
    h += '<div class="row">' + (d.phase === 'reconnect' ? '<button class="b p" id="apx-reconn">Reconnect</button>' : '<button class="b p" id="apx-sync">Sync now</button>') +
      '<button class="b" id="apx-push">Save to cloud now</button><button class="b" id="apx-slot">Save named cloud slot</button>' +
      '<label class="sub"><input type="checkbox" id="apx-auto" ' + (d.autoSync ? 'checked' : '') + '> auto-sync after changes</label></div>';
    h += '<div class="sub" style="margin-top:8px">Cloud files</div>';
    if (filesErr) h += '<div class="bad">' + esc(filesErr) + '</div>';
    else if (!files) h += '<div class="sub">Loading...</div>';
    else if (!files.length) h += '<div class="sub">Nothing in the cloud yet.</div>';
    else files.forEach(function (f) {
      var kind = f.name === 'apex-save-main.json.gz' ? 'live' : f.name.indexOf('apex-backup-') === 0 ? 'backup' : 'slot';
      var nm = kind === 'live' ? 'Live cloud save' : kind === 'backup' ? 'Auto backup' : f.name.replace(/^apex-slot-|\.json\.gz$/g, '');
      h += '<div class="li"><div><b>' + esc(nm) + '</b><span class="tag">' + kind + '</span><br><span class="sub">' + new Date(f.modifiedTime).toLocaleString() + ' &middot; ' + fmtB(parseInt(f.size || '0', 10)) + '</span></div>' +
        '<div><button class="b" data-cloud-load="' + f.id + '">Load</button> ' + (kind !== 'live' ? '<button class="b r" data-cloud-del="' + f.id + '">Delete</button>' : '') + '</div></div>';
    });
    h += '<div class="row"><button class="b" id="apx-disc">Disconnect</button><button class="b" id="apx-cid-edit">Change Client ID</button></div></div>';
    return h;
  }

  function q(id) { return box.querySelector('#' + id); }
  function onc(id, fn) { var e = q(id); if (e) e.onclick = fn; }
  function reloadSoon() { setTimeout(function () { S.saveAndReload(); }, 400); }
  function wire(d) {
    onc('apx-x', close);
    onc('apx-persist', function () { navigator.storage.persist().then(function (p) { toast(p ? 'Storage is now protected' : 'The browser declined (it may allow it after you use the site more or install it)'); S.status(); render(false); }); });
    onc('apx-snap', function () { var n = prompt('Name this snapshot (optional):', ''); if (n === null) return; persistNow(); run('Creating snapshot...', S.snapshot(n || 'Manual snapshot', 'manual'), function () { toast('Snapshot saved'); refresh(); }); });
    box.querySelectorAll('[data-snap-restore]').forEach(function (b) { b.onclick = function () {
      if (!confirm('Restore this snapshot? Your CURRENT progress is snapshotted first, then replaced.')) return;
      run('Restoring...', S.restoreSnapshot(b.getAttribute('data-snap-restore')), function () { toast('Restored - reloading'); reloadSoon(); }); }; });
    box.querySelectorAll('[data-snap-dl]').forEach(function (b) { b.onclick = function () { S.readSnapshot(b.getAttribute('data-snap-dl')).then(function (p) { download('apex-sim-snapshot-' + stamp() + '.json', JSON.stringify(p)); }, function (e) { toast(e.message); }); }; });
    box.querySelectorAll('[data-snap-del]').forEach(function (b) { b.onclick = function () { if (confirm('Delete this snapshot?')) S.deleteSnapshot(b.getAttribute('data-snap-del')).then(refresh); }; });
    onc('apx-exp', function () { persistNow(); download('apex-sim-save-' + stamp() + '.json', JSON.stringify(S.exportPayload())); toast('Save file exported'); });
    onc('apx-imp', function () { var f = q('apx-file'); f.value = ''; f.click(); });
    var fi = q('apx-file'); if (fi) fi.onchange = function () {
      var file = fi.files && fi.files[0]; if (!file) return;
      file.arrayBuffer().then(function (ab) { var b = new Uint8Array(ab); var gz = b.length > 2 && b[0] === 0x1f && b[1] === 0x8b; return S.gunzip(b, gz ? 'gzip' : 'json'); })
        .then(function (t) {
          var p = JSON.parse(t); var data = p && p.data; var keys = data ? Object.keys(data).filter(S.isGameKey) : [];
          if (!keys.length) return toast("That file doesn't look like an APEX SIM save");
          if (!confirm('Import this save? It REPLACES your current progress (a snapshot of the current save is taken first, so you can undo).')) return;
          var clean = {}; keys.forEach(function (k) { clean[k] = data[k]; });
          run('Importing...', S.replaceAll(clean, { reason: 'file import' }), function () { toast('Imported - reloading'); reloadSoon(); });
        }).catch(function () { toast('Could not read that file'); });
    };
    if (!D) return;
    onc('apx-cid-save', function () { var v = q('apx-cid').value.trim(); if (!/\.apps\.googleusercontent\.com$/.test(v)) return toast('That does not look like a Client ID (should end with .apps.googleusercontent.com)'); D.setClientId(v); toast('Client ID saved'); render(false); });
    onc('apx-cid-edit', function () { var v = prompt('Google OAuth Client ID:', D.cfgId()); if (v !== null) { D.setClientId(v); render(false); } });
    onc('apx-conn', function () { persistNow(); run('Opening Google sign-in...', D.connect(), function (r) { handleSync(r); loadFiles(); }); });
    onc('apx-reconn', function () { run('Reconnecting...', D.reconnect(), function (r) { handleSync(r); loadFiles(); }); });
    onc('apx-sync', function () { persistNow(); run('Syncing...', D.sync({}), function (r) { handleSync(r); loadFiles(); }); });
    onc('apx-push', function () { persistNow(); run('Uploading to Drive...', D.push({}), function () { toast('Saved to Google Drive'); loadFiles(); }); });
    onc('apx-slot', function () { var n = prompt('Name for this cloud save (e.g. "Before the final"):', ''); if (n === null) return; persistNow(); run('Uploading...', D.saveSlot(n), function () { toast('Saved as cloud slot'); loadFiles(); }); });
    var au = q('apx-auto'); if (au) au.onchange = function () { D.setAutoSync(au.checked); };
    onc('apx-disc', function () { if (confirm('Disconnect Google Drive on this device? Files already in Drive stay there.')) { D.disconnect(); files = null; render(false); } });
    onc('apx-use-cloud', function () { run('Loading cloud save...', D.resolveConflict('cloud'), function () { toast('Cloud save loaded - reloading'); reloadSoon(); }); });
    onc('apx-use-local', function () { run('Uploading...', D.resolveConflict('local'), function () { toast('Cloud updated'); loadFiles(); }); });
    onc('apx-cancel', function () { D.resolveConflict('cancel'); render(false); });
    box.querySelectorAll('[data-cloud-load]').forEach(function (b) { b.onclick = function () {
      if (!confirm('Load this cloud save? Your current progress is snapshotted first, then replaced.')) return;
      run('Loading...', D.pull(b.getAttribute('data-cloud-load'), { reason: 'cloud load' }), function () { toast('Loaded - reloading'); reloadSoon(); }); }; });
    box.querySelectorAll('[data-cloud-del]').forEach(function (b) { b.onclick = function () { if (confirm('Delete this file from Google Drive?')) D.deleteFile(b.getAttribute('data-cloud-del')).then(loadFiles, function (e) { toast(e.message); }); }; });
  }
  function handleSync(r) {
    if (!r) return;
    if (r.reload) { toast('Cloud save loaded - reloading'); return reloadSoon(); }
    var m = { 'in-sync': 'Already in sync', pushed: 'Uploaded your latest progress', 'pushed-first': 'Uploaded your first cloud save', empty: 'Nothing to sync yet', conflict: 'Two different saves found - choose below', 'remote-newer': 'A newer cloud save exists - choose below' }[r.result];
    if (m) toast(m);
  }

  // A newer cloud save found in the background should be impossible to miss.
  if (D) D.on(function (s) { if (s.conflict && !ov.classList.contains('open')) { toast('Google Drive has a different save - open Saves to choose'); } });

  window.ApexSaveUI = { open: open, close: close, toast: toast };
  paintPill();
})();
