/* Tests for apex-store.js / apex-drive.js.   Setup once:  npm i jsdom fake-indexeddb    Run:  node test/save-harness.js */
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const { IDBFactory } = require('fake-indexeddb');
const ROOT = path.join(__dirname, '..');
const SRC = n => fs.readFileSync(path.join(ROOT, n), 'utf8');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  PASS ', m); } else { fail++; console.log('  FAIL ', m); } }
const sleep = ms => new Promise(r => setTimeout(r, ms));

class FakeLS {                      // survives "page loads" (shared between windows like a real browser profile)
  constructor() { this.m = new Map(); this.quota = Infinity; }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { v = String(v); if (this.quota !== Infinity && v.length > this.quota) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } this.m.set(k, v); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
let bid = 0;
function browser() { return { ls: new FakeLS(), idb: new IDBFactory(), id: 'b' + (++bid) + ':' }; }
function page(b, extra) {
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://user.github.io/football/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  Object.defineProperty(w, 'localStorage', { configurable: true, get: () => b.ls });
  w.indexedDB = b.idb; w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.Blob = Blob; w.Response = Response;
  w.CompressionStream = CompressionStream; w.DecompressionStream = DecompressionStream; w.BroadcastChannel = class extends BroadcastChannel { constructor(n) { super(b.id + n); } };   // channels are per browser profile
  w.fetch = (...a) => (extra && extra.fetch ? extra.fetch(...a) : Promise.reject(new Error('no network')));
  w.eval(SRC('apex-store.js'));
  return w;
}
async function loaded(b) { const w = page(b); await w.ApexStore.ready; return w; }
const big = n => 'x'.repeat(n);

(async () => {
  console.log('1. fresh start + migration from an old localStorage-only save');
  let b = browser();
  b.ls.setItem('apexSeason', '{"y":1}'); b.ls.setItem('apexTrophies', '[1,2]'); b.ls.setItem('someOther', 'keep');
  let w = await loaded(b);
  ok(w.ApexStore.status().mode === 'indexeddb', 'uses IndexedDB');
  ok(w.localStorage.getItem('apexSeason') === '{"y":1}', 'old localStorage data is visible through the shim');
  ok(w.localStorage.length === 2 && w.localStorage.key(0) === 'apexSeason', 'length/key() enumerate only game keys');
  await w.ApexStore.flush();
  w = await loaded({ ls: new FakeLS(), idb: b.idb });        // new browser profile LS wiped, IDB kept
  ok(w.localStorage.getItem('apexTrophies') === '[1,2]', 'migrated data lives in IndexedDB (survives localStorage wipe)');

  console.log('2. write, flush, reload');
  b = browser(); w = await loaded(b);
  w.localStorage.setItem('apexTournament', '{"round":3}'); w.localStorage.setItem('apexMatchDay', '12');
  await w.ApexStore.flush();
  w = await loaded(b);
  ok(w.localStorage.getItem('apexTournament') === '{"round":3}' && w.localStorage.getItem('apexMatchDay') === '12', 'values survive a reload');

  console.log('3. page closes BEFORE the async IndexedDB write finishes (localStorage mirror rescues it)');
  b = browser(); w = await loaded(b);
  w.localStorage.setItem('apexTournament', 'OLD'); await w.ApexStore.flush();
  w.localStorage.setItem('apexTournament', 'NEWEST');            // no flush: simulated crash/navigation
  w = await loaded(b);
  ok(w.localStorage.getItem('apexTournament') === 'NEWEST', 'newest value recovered from the mirror');

  console.log('4. delete + immediate reload (reset flow) does not resurrect old data');
  b = browser(); w = await loaded(b);
  w.localStorage.setItem('apexSeason', 'S'); await w.ApexStore.flush();
  w.localStorage.removeItem('apexSeason');                         // no flush before reload
  w = await loaded(b);
  ok(w.localStorage.getItem('apexSeason') === null, 'tombstone wins over the older IndexedDB value');

  console.log('5. very large save (bigger than localStorage can hold)');
  b = browser(); b.ls.quota = 100000; w = await loaded(b);
  const huge = big(3 * 1024 * 1024);
  w.localStorage.setItem('apexTournament', huge); w.localStorage.setItem('apexSeason', 'small');
  await w.ApexStore.flush();
  w = await loaded(b);
  ok(w.localStorage.getItem('apexTournament') === huge, '3 MB value stored and restored (real localStorage quota was 100 KB)');
  w.localStorage.setItem('apexTournament', huge + 'y'); await w.ApexStore.flush();
  ok(b.ls.getItem('apexTournament') === null, 'no stale partial copy left in the real localStorage');

  console.log('6. stale-tab protection');
  b = browser(); const A = await loaded(b); const B = await loaded(b);
  A.localStorage.setItem('apexTournament', 'from-A'); await A.ApexStore.flush(); await sleep(60);
  ok(B.ApexStore.status().stale.indexOf('apexTournament') >= 0, 'tab B is told the save changed elsewhere');
  B.localStorage.setItem('apexTournament', 'from-B-stale');
  ok(B.localStorage.getItem('apexTournament') !== 'from-B-stale', 'stale tab write is refused');
  B.localStorage.setItem('apexActiveView', 'x'); ok(B.localStorage.getItem('apexActiveView') === 'x', 'UI-only keys are never blocked');
  const C = await loaded(b);
  ok(C.localStorage.getItem('apexTournament') === 'from-A', 'a fresh load sees tab A data (not B stale data)');

  console.log('7. snapshots: create, list, restore, prune');
  b = browser(); w = await loaded(b);
  w.localStorage.setItem('apexSeason', 'v1'); w.localStorage.setItem('apexMatchDay', '5');
  const s1 = await w.ApexStore.snapshot('Week 5', 'manual');
  ok(s1 && s1.size > 0 && s1.info.season, 'snapshot created (gzip ' + s1.size + ' B of ' + s1.raw + ' B)');
  w.localStorage.setItem('apexSeason', 'v2-bad');
  await w.ApexStore.restoreSnapshot(s1.id);
  ok(w.localStorage.getItem('apexSeason') === 'v1', 'restore brings back the old state');
  const list = await w.ApexStore.listSnapshots();
  ok(list.some(x => x.kind === 'safety'), 'a safety snapshot of the replaced state was taken automatically');
  for (let i = 0; i < 9; i++) { w.localStorage.setItem('apexMatchDay', String(10 + i)); await w.ApexStore.snapshot('a' + i, 'auto'); }
  ok((await w.ApexStore.listSnapshots()).filter(x => x.kind === 'auto').length <= 6, 'old automatic snapshots are pruned');
  w = await loaded(b); ok((await w.ApexStore.listSnapshots()).length > 0, 'snapshots survive reload');

  console.log('8. replaceAll (import / cloud load) replaces, not merges');
  b = browser(); w = await loaded(b);
  w.localStorage.setItem('apexSeason', 's'); w.localStorage.setItem('apexQualifiers', 'q');
  await w.ApexStore.replaceAll({ apexSeason: 'new', apexTrophies: 't' }, { reason: 'test' });
  ok(w.localStorage.getItem('apexSeason') === 'new' && w.localStorage.getItem('apexQualifiers') === null && w.localStorage.getItem('apexTrophies') === 't', 'keys replaced, extras removed');
  w = await loaded(b); ok(w.localStorage.getItem('apexQualifiers') === null, 'removal persisted');

  console.log('9. export payload compatible with the game\'s import format');
  const p = w.ApexStore.exportPayload();
  ok(p.app === 'apex-sim' && p.data.apexSeason === 'new' && !('ApexDev.meta' in p.data), 'envelope + only game keys');

  await driveTests();
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

/* ---------------- Google Drive (mocked REST + sign-in) ---------------- */
function mockDrive() {
  const files = new Map(); let n = 0, tick = 1;
  const api = {
    files, calls: [],
    fetch: async (url, o = {}) => {
      const u = new URL(url), method = (o.method || 'GET').toUpperCase(); api.calls.push(method + ' ' + u.pathname);
      if (!/Bearer tok/.test((o.headers || {}).Authorization || '')) return new Response('no', { status: 401 });
      const js = (x, s = 200) => new Response(JSON.stringify(x), { status: s });
      if (u.pathname === '/drive/v3/files' && method === 'GET') return js({ files: [...files.values()].sort((a, b) => b.t - a.t).map(f => ({ id: f.id, name: f.name, modifiedTime: new Date(f.t * 1000).toISOString(), size: String(f.bytes.length), appProperties: f.props })) });
      if (u.pathname.startsWith('/upload/drive/v3/files')) {
        const buf = Buffer.from(await new Response(o.body).arrayBuffer());
        const bnd = /boundary=(.+)$/.exec(o.headers['Content-Type'])[1];
        const parts = buf.toString('latin1').split('--' + bnd);
        const metaTxt = parts[1].split('\r\n\r\n')[1].replace(/\r\n$/, ''); const meta = JSON.parse(metaTxt);
        const start = buf.indexOf('\r\n\r\n', buf.indexOf('application/gzip')) + 4, end = buf.lastIndexOf('\r\n--' + bnd + '--');
        const bytes = buf.subarray(start, end);
        const id = method === 'PATCH' ? u.pathname.split('/').pop() : 'f' + (++n);
        const prev = files.get(id) || {};
        const rec = { id, name: meta.name || prev.name, props: meta.appProperties || prev.props, bytes, t: ++tick };
        files.set(id, rec); return js({ id, name: rec.name, modifiedTime: new Date(rec.t * 1000).toISOString(), appProperties: rec.props });
      }
      let m;
      if ((m = /^\/drive\/v3\/files\/([^/]+)\/copy$/.exec(u.pathname))) { const s = files.get(m[1]); const id = 'f' + (++n); const meta = JSON.parse(o.body); files.set(id, { id, name: meta.name, props: meta.appProperties, bytes: s.bytes, t: ++tick }); return js({ id }); }
      if ((m = /^\/drive\/v3\/files\/([^/]+)$/.exec(u.pathname))) {
        if (method === 'DELETE') { files.delete(m[1]); return new Response('', { status: 204 }); }
        if (u.searchParams.get('alt') === 'media') return new Response(files.get(m[1]).bytes);
      }
      return new Response('unhandled ' + method + u.pathname, { status: 404 });
    }
  };
  return api;
}
async function driveTests() {
  console.log('10. Google Drive sync (mock)');
  const cloud = mockDrive();
  const mk = async (b) => {
    const w = page(b, { fetch: cloud.fetch });
    await w.ApexStore.ready;
    w.google = { accounts: { oauth2: { initTokenClient: (c) => ({ requestAccessToken: () => setTimeout(() => c.callback({ access_token: 'tok', expires_in: 3600 }), 5) }), revoke: () => {} } } };
    w.eval(SRC('apex-drive.js')); return w;
  };
  let b1 = browser(); let w1 = await mk(b1);
  w1.ApexDrive.setClientId('123.apps.googleusercontent.com');
  w1.localStorage.setItem('apexSeason', 'S1'); w1.localStorage.setItem('apexTournament', 'T1');
  let r = await w1.ApexDrive.connect();
  ok(r.result === 'pushed-first', 'first connect uploads the save');
  const main = [...cloud.files.values()].find(f => f.name === 'apex-save-main.json.gz');
  ok(main && main.bytes[0] === 0x1f, 'cloud file is gzip-compressed');
  r = await w1.ApexDrive.sync({}); ok(r.result === 'in-sync', 'second sync: nothing to do');

  w1.localStorage.setItem('apexTournament', 'T2');
  r = await w1.ApexDrive.sync({}); ok(r.result === 'pushed', 'local change is pushed');
  ok([...cloud.files.values()].some(f => f.name.startsWith('apex-backup-')), 'previous cloud save kept as a backup before overwriting');

  // new device pulls
  let b2 = browser(); let w2 = await mk(b2); w2.ApexDrive.setClientId('123.apps.googleusercontent.com');
  r = await w2.ApexDrive.connect();
  ok(r.result === 'pulled' && w2.localStorage.getItem('apexTournament') === 'T2', 'fresh device downloads the cloud save');

  // device 2 changes + syncs; device 1 (unchanged) sees remote newer
  w2.localStorage.setItem('apexTournament', 'T3'); await w2.ApexDrive.sync({});
  r = await w1.ApexDrive.sync({ auto: true, askBeforePull: true });
  ok(r.result === 'remote-newer', 'device 1 is told a newer cloud save exists (no silent overwrite)');
  r = await w1.ApexDrive.resolveConflict('cloud');
  ok(r.result === 'pulled' && w1.localStorage.getItem('apexTournament') === 'T3', 'choosing the cloud save loads it');

  // true conflict
  w1.localStorage.setItem('apexTournament', 'T4-dev1'); w2.localStorage.setItem('apexTournament', 'T4-dev2');
  await w2.ApexDrive.sync({});
  r = await w1.ApexDrive.sync({});
  ok(r.result === 'conflict', 'both devices changed -> conflict, nothing overwritten');
  ok([...cloud.files.values()].some(f => f.name === 'apex-save-main.json.gz'), 'cloud save still intact');
  r = await w1.ApexDrive.resolveConflict('local');
  ok(r.result === 'pushed', 'keeping this device uploads it (after a backup)');
  const nb = [...cloud.files.values()].filter(f => f.name.startsWith('apex-backup-')).length;
  ok(nb >= 1 && nb <= 6, 'backups are kept and capped (' + nb + ')');

  // named slot
  await w1.ApexDrive.saveSlot('Before the final');
  ok([...cloud.files.values()].some(f => f.name === 'apex-slot-Before the final.json.gz'), 'named cloud slot saved');
  const files = await w1.ApexDrive.listFiles(); ok(files.length >= 3, 'listFiles works (' + files.length + ' files)');

  // expired token handling
  w1.ApexDrive.disconnect(); ok(!w1.ApexDrive.status().connected, 'disconnect clears the connection');
}
