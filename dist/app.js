  // ========== DETERMINISTIC RANDOMNESS (seeded PRNG) ==========
  // Replaces seededRandom() everywhere in the simulation so that, given the
  // same seed, every match/season/tournament plays out identically. This is
  // a mulberry32 generator: fast, tiny, and good enough statistical quality
  // for gameplay purposes (not cryptographic).
  const RNG_STORAGE_KEY = 'apex_rng_seed';

  function _hashSeed(str) {
    // Turns any string (or number) into a 32-bit unsigned int seed.
    let h = 1779033703 ^ String(str).length;
    for (let i = 0; i < String(str).length; i++) {
      h = Math.imul(h ^ String(str).charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h >>> 0) || 1;
  }

  function _defaultSeed() {
    try {
      const stored = localStorage.getItem(RNG_STORAGE_KEY);
      if (stored) return _hashSeed(stored);
    } catch (e) { /* localStorage unavailable (e.g. file://) — fall through */ }
    return 0x2f6e2b1;
  }

  let _rngSeed = _defaultSeed();

  function _mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  let _rngFn = _mulberry32(_rngSeed);

  // Drop-in replacement for seededRandom() used throughout the simulation.
  function seededRandom() {
    return _rngFn();
  }

  // Re-seeds the generator. Accepts a number or a string (hashed to a number).
  // Call this before starting a match/season/tournament to reproduce it later.
  function setRngSeed(seed) {
    _rngSeed = typeof seed === 'number' ? (seed >>> 0) : _hashSeed(seed);
    _rngFn = _mulberry32(_rngSeed);
    try { localStorage.setItem(RNG_STORAGE_KEY, String(_rngSeed)); } catch (e) {}
    return _rngSeed;
  }

  function getRngSeed() {
    return _rngSeed;
  }
  // ========== NON-LINEAR ATTRIBUTE IMPACT CURVE ==========
  // Every attribute-driven "edge" in the engine used to be a flat multiplier:
  // (rating - baseline) / span, scaled by a fixed weight. On a straight
  // line, every point of rating is worth exactly the same amount everywhere
  // on the scale — so the gap between an 80 and a 90 read as the same size
  // as the gap between a 90 and a 97, and a 97-rated attribute basically
  // felt like "80, but a bit more of the same multiplier" rather than
  // something genuinely elite.
  //
  // curvedStat() reshapes that: it measures how far a rating sits from a
  // roughly-average baseline, then raises that distance to a power > 1
  // before scaling it back down. Close to baseline, a few points barely
  // move the result (a 68 and a 72 in the same role really do play almost
  // identically). The further out a rating sits in either direction, the
  // more each additional point is worth, so a 97 reads as a clear tier
  // above a 90, which reads as a clear tier above an 80 — not just a
  // bigger number times the same flat rate. Returns a value in -1..1;
  // callers multiply by whatever weight they need for their own formula.
  // (power > 1 is deliberately "convex": it flattens the middle of the
  // scale and steepens the extremes — the opposite of a flat multiplier.)
  function curvedStat(value, baseline, span, power) {
    baseline = baseline != null ? baseline : 70;
    span = span != null ? span : (99 - baseline);
    power = power != null ? power : 1.6;
    if (!span) return 0;
    let raw = (value - baseline) / span;
    raw = Math.max(-1, Math.min(1, raw));
    return Math.sign(raw) * Math.pow(Math.abs(raw), power);
  }

  // Same curve, but returned as an "effective" rating back on the original
  // 1-99 scale instead of a -1..1 edge — a drop-in replacement for a raw
  // stat inside an existing weighted-average formula whose overall shape
  // shouldn't otherwise change. A 97 stays close to 97 (elite ratings are
  // barely compressed); an 80 reads closer to baseline than its raw number
  // suggests (a merely-good rating is worth less than a flat scale implies).
  function curvedAttr(value, baseline, span, power) {
    baseline = baseline != null ? baseline : 70;
    span = span != null ? span : (99 - baseline);
    return baseline + curvedStat(value, baseline, span, power) * span;
  }

  // ========== SHARED UI PERFORMANCE HELPERS ==========
  // debounce(fn, wait) returns a wrapped version of fn that only actually
  // runs once calls stop arriving for `wait` ms — used on the search boxes
  // (players/teams/hospital/season/tournament) so filtering + re-rendering
  // a large list doesn't run on every single keystroke, which is what was
  // causing typing lag on those pages. Each call still records the latest
  // arguments immediately; only the expensive work is delayed.
  function debounce(fn, wait) {
    let t = null;
    return function debounced(...args) {
      if (t) clearTimeout(t);
      t = setTimeout(() => { t = null; fn.apply(this, args); }, wait);
    };
  }

/* Apex Football Simulator - Fixed (no external fetch) */
var App = (() => {
  // ========== EMBEDDED TEAMS DATA ==========
  const TEAMS_DATA = {};


  let teamsData = { national: [], club: [] };
  let allTeams = [];
  // leagues.json: { "La Liga": ["Real Madrid 2026-27", ...], ... } — defines which
  // clubs belong to which domestic league, independent of teams.json.
  let leaguesData = {};
  // players.json: { "Player Full Name": "portrait-file.jpg", ... } — portrait file
  // names are resolved against assets/portraits/. Optional; falls back to the
  // player's shirt number when no portrait is found for their name.
  let playerPortraits = {};
  // trophies.json: { "Trophy or competition name": "trophy-file.png", ... } —
  // image file names are resolved against assets/trophies/. Optional; falls
  // back to the 🏆 emoji when no image is found for a given trophy name.
  let trophyImages = {};
  // managers.json: { "Manager Full Name": "portrait-file.png", ... } — portrait
  // file names are resolved against assets/mportraits/. Optional; falls back to
  // assets/mportraits/none.png, and further to a 🧑‍💼 badge if that also fails.
  // Embedded below (MANAGER_PORTRAITS_DATA) so it works immediately even when
  // index.html is opened directly (file://), where fetch() of local JSON is
  // blocked by the browser. If the app IS served over http(s), a fresh fetch
  // of managers.json (root dir, alongside index.html — NOT inside assets/)
  // is layered on top, so editing managers.json still works without rebuilding.
  const MANAGER_PORTRAITS_DATA = {
    "Carlo Ancelotti": "ancelotti.png",
    "Pep Guardiola": "guardiola.png",
    "Jurgen Klopp": "klopp.png",
    "Diego Simeone": "simeone.png",
    "Xabi Alonso": "alonso.png",
    "Mikel Arteta": "arteta.png",
    "Hansi Flick": "flick.png",
    "Luis Enrique": "enrique.png",
    "Thomas Tuchel": "tuchel.png",
    "Simone Inzaghi": "inzaghi.png"
  };
  let managerPortraits = { ...MANAGER_PORTRAITS_DATA };
  // player-attributes.json (optional): { playerId: { pos, playstyle, off_awr,
  // ball_con, ... , gk_awr, ... } } — a richer, position/role-detailed
  // attribute sheet for specific players. When a player's id has an entry
  // here, it takes over that player's gameplay attributes entirely (att/def/
  // pac/phy/tec/ovr as read from teams.json for that player are ignored —
  // see applyExpandedPlayerAttributes()).
  let playerAttributesData = {};
  let stats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, cards: {}, motm: {}, puskas: {}, ratings: {}, interceptions: {}, tackles: {}, bigGames: {} };
  let tournamentStats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, motm: {}, ratings: {}, puskas: {}, interceptions: {}, tackles: {}, bigGames: {} };
  // Which season competition (a league, or the UCL) is currently being simulated —
  // set for the duration of a simulateRoundFixtures() call so recordStat/recordRating
  // can also tally into that competition's own stat bucket (comp.stats), giving each
  // league/competition its own top scorers, assists, cards, awards, etc.
  let currentSeasonComp = null;
  // injury.json: { injuries: [ { id, name, bodyPart, severity, minMatches,
  // maxMatches, description, causes: [...] }, ... ] } — the catalogue of
  // injury types tryInjury() (engine/injuries.js) picks from, and that the
  // Hospital tab (ui/hospitalUI.js) reads bodyPart/severity/description from.
  // Embedded below (INJURY_DEFS_DATA) so it works immediately even when
  // index.html is opened directly (file://), where fetch() of local JSON is
  // blocked by the browser — same treatment as MANAGER_PORTRAITS_DATA above.
  // If the app IS served over http(s), a fresh fetch of injury.json (root
  // dir, alongside index.html) replaces this list, so editing injury.json
  // (or adding new injury types) works without a rebuild.
  const INJURY_DEFS_DATA = [
    { id: 'cramp', name: 'Muscle Cramp', bodyPart: 'Muscle', severity: 'Minor', minMatches: 1, maxMatches: 1,
      description: 'Sudden involuntary muscle contraction, usually brought on by fatigue or dehydration late in a match.',
      causes: ['felt a muscle seize up and had to be withdrawn as a precaution', 'was struck down by cramp late in the match'] },
    { id: 'ankle_sprain', name: 'Ankle Sprain', bodyPart: 'Ankle', severity: 'Minor', minMatches: 1, maxMatches: 3,
      description: 'A stretching or partial tearing of the ligaments around the ankle joint.',
      causes: ['rolled his ankle after a heavy tackle', 'twisted his ankle awkwardly on the turf', 'went over on his ankle challenging for the ball'] },
    { id: 'knee_knock', name: 'Knee Knock', bodyPart: 'Knee', severity: 'Minor', minMatches: 1, maxMatches: 2,
      description: 'A bruising blow to the knee from a direct collision, with no ligament damage.',
      causes: ['took a knock on the knee in a goalmouth scramble', 'was caught by a stray boot on the knee'] },
    { id: 'dead_leg', name: 'Dead Leg (Contusion)', bodyPart: 'Thigh', severity: 'Minor', minMatches: 1, maxMatches: 2,
      description: 'A deep muscle bruise caused by a direct blow to the thigh, temporarily numbing the leg.',
      causes: ['took a stray knee to the thigh and needed treatment', 'picked up a dead leg after a collision'] },
    { id: 'concussion_protocol', name: 'Concussion Protocol', bodyPart: 'Head', severity: 'Minor', minMatches: 1, maxMatches: 2,
      description: 'Withdrawn as a head-injury precaution to be assessed under concussion protocol.',
      causes: ['clashed heads with an opponent and was taken off for a head-injury assessment', 'took a blow to the head in an aerial challenge'] },
    { id: 'hamstring_strain', name: 'Hamstring Strain', bodyPart: 'Hamstring', severity: 'Moderate', minMatches: 2, maxMatches: 5,
      description: 'A partial tear of the hamstring muscle fibres, typically from an explosive sprint.',
      causes: ['pulled up sharply while chasing a through ball', 'felt his hamstring go mid-sprint'] },
    { id: 'calf_strain', name: 'Calf Strain', bodyPart: 'Calf', severity: 'Moderate', minMatches: 2, maxMatches: 4,
      description: 'A tear in the calf muscle fibres, often from a sudden push-off or change of direction.',
      causes: ['pulled up with a tight calf after pushing off to sprint', 'felt his calf tighten and signalled to the bench'] },
    { id: 'groin_strain', name: 'Groin Strain', bodyPart: 'Groin', severity: 'Moderate', minMatches: 2, maxMatches: 4,
      description: 'A tear in the groin muscles, commonly caused by a sudden stretch or change of direction.',
      causes: ['felt his groin go while stretching for the ball', 'pulled up sharply after a lunging challenge'] },
    { id: 'thigh_strain', name: 'Thigh Strain', bodyPart: 'Thigh', severity: 'Moderate', minMatches: 2, maxMatches: 4,
      description: 'A muscle tear in the front or back of the thigh from a sudden burst of effort.',
      causes: ['pulled up with a tight thigh chasing back', 'felt his quad tighten after a shot'] },
    { id: 'back_spasm', name: 'Back Spasm', bodyPart: 'Back', severity: 'Moderate', minMatches: 2, maxMatches: 3,
      description: 'An involuntary muscle spasm in the lower back, often from an awkward twist or landing.',
      causes: ['landed awkwardly and felt his back seize up', 'twisted awkwardly clearing the ball and felt his back go'] },
    { id: 'shoulder_injury', name: 'Shoulder Injury', bodyPart: 'Shoulder', severity: 'Moderate', minMatches: 2, maxMatches: 4,
      description: 'Bruising or a mild joint sprain in the shoulder from a heavy fall or collision.',
      causes: ['landed heavily on his shoulder after a challenge', 'fell awkwardly onto his shoulder in a goalmouth clash'] },
    { id: 'fractured_metatarsal', name: 'Fractured Metatarsal', bodyPart: 'Foot', severity: 'Major', minMatches: 4, maxMatches: 8,
      description: 'A break in one of the long bones of the foot, usually from a stray boot or a blocked shot.',
      causes: ['was caught late on the foot and immediately went down in pain', 'took a heavy stamp on the foot in a goalmouth scramble'] },
    { id: 'knee_ligament_sprain', name: 'Knee Ligament Sprain (MCL)', bodyPart: 'Knee', severity: 'Major', minMatches: 4, maxMatches: 8,
      description: 'A sprain of the medial collateral ligament from a sideways impact on a planted leg.',
      causes: ['was caught side-on by a heavy challenge on a planted leg', 'buckled at the knee after a sliding tackle from the side'] },
    { id: 'rib_fracture', name: 'Rib Fracture', bodyPart: 'Ribs', severity: 'Major', minMatches: 3, maxMatches: 6,
      description: 'A crack or break in a rib bone, usually from a direct collision or heavy fall.',
      causes: ['took an elbow to the ribs in an aerial duel', 'collided heavily with the goalkeeper going for the ball'] },
    { id: 'facial_fracture', name: 'Facial Fracture', bodyPart: 'Face', severity: 'Major', minMatches: 3, maxMatches: 6,
      description: 'A break to the bones of the face, typically from an accidental clash of heads or a stray elbow.',
      causes: ['clashed heads with an opponent going for the same ball', 'took an accidental elbow to the face'] },
    { id: 'hip_flexor_tear', name: 'Hip Flexor Tear', bodyPart: 'Hip', severity: 'Major', minMatches: 4, maxMatches: 7,
      description: 'A tear in the muscles connecting the thigh to the hip, from an explosive kicking or sprinting motion.',
      causes: ['felt his hip go through on an over-stretched clearance', 'over-extended for a tackle and felt his hip flexor tear'] },
    { id: 'acl_tear', name: 'ACL Tear', bodyPart: 'Knee', severity: 'Severe', minMatches: 16, maxMatches: 30,
      description: "A tear of the anterior cruciate ligament — one of football's most serious injuries, usually needing surgery and months of rehab.",
      causes: ['planted awkwardly and his knee buckled with no one near him', 'landed from a jump with his knee twisting inward and went down clutching it'] },
    { id: 'achilles_rupture', name: 'Achilles Tendon Rupture', bodyPart: 'Achilles', severity: 'Severe', minMatches: 18, maxMatches: 28,
      description: 'A complete tear of the Achilles tendon, one of the longest lay-off injuries in the game.',
      causes: ['pushed off to sprint and went down instantly clutching his ankle', 'felt something snap in his heel with no contact from anyone'] },
    { id: 'fractured_tibia', name: 'Fractured Tibia/Fibula', bodyPart: 'Lower Leg', severity: 'Severe', minMatches: 14, maxMatches: 24,
      description: 'A break to one or both of the lower leg bones, almost always from a serious, high-impact challenge.',
      causes: ['was caught by a reckless, high challenge on the lower leg', 'took the full force of a mistimed tackle on his shin'] }
  ];
  let injuryDefsData = [...INJURY_DEFS_DATA];
  // playerId -> { defId, type, bodyPart, severity, cause, opponent, competition,
  // minute, matchesLeft, matchesTotal, teamName, playerName } — counts down
  // once per this player's team's match played while they're sidelined. Full
  // record is what the Hospital tab (ui/hospitalUI.js) renders per player.
  let injuryBook = {};
  let suspensionBook = {}; // playerId -> { matchesLeft, teamName, playerName } — 1-match ban after a red card
  let globalMatchDay = 1;
  // {name, team, type, date, category:'season'|'season-global'|'tournament', year, player, run}
  // name    — matches a key in trophies.json so trophyMark() can resolve an image
  // team    — winning club/nation (team trophies) or the winning player's team (individual awards)
  // player  — winning player's name, only set for individual awards (feeds the Teams-tab trophy cabinet)
  // year    — season year (season/season-global trophies)
  // run     — shared id for every trophy awarded out of the same standalone tournament run
  let trophies = [];
  let currentMatch = null;
  let simInterval = null;
  let simSpeed = 400;
  let isPlaying = false;
  let tournament = null;
  let tournamentType = 'worldcup';

  // ========== SEASON CALENDAR ==========
  // "name" must match a key in leagues.json exactly so team pools can be
  // looked up automatically instead of picked by hand.
  const SEASON_LEAGUE_DEFS = [
    { key: 'epl', name: 'Premier League' },
    { key: 'laliga', name: 'La Liga' },
    { key: 'seriea', name: 'Serie A' },
    { key: 'bundesliga', name: 'Bundesliga' },
    { key: 'ligue1', name: 'Ligue 1' }
  ];
  // How many table-toppers from each domestic league qualify as Champions
  // League candidates the following season (real-life style qualification).
  const UCL_QUALIFY_PER_LEAGUE = 4;
  let season = null; // active season object, or null if not started
  let seasonSetup = {
    selections: { epl: new Set(), laliga: new Set(), seriea: new Set(), bundesliga: new Set(), ligue1: new Set() },
    search: { epl: '', laliga: '', seriea: '', bundesliga: '', ligue1: '' }
  };
  let seasonActiveTab = 'epl';
  let seasonActiveSubTab = 'table'; // 'table' | 'stats' | 'awards' — sub-view within a league/UCL tab
  let seasonReportRegistry = []; // flat list of match reports referenced by index from season fixture cards
  let historyActiveTab = 'team'; // 'team' | 'individual' — which History sub-tab is showing

  const FORMATIONS = {
    '4-3-3': { name: '4-3-3', slots: ['GK','RB','CB','CB','LB','CM','CDM','CM','RW','ST','LW'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[62,50],[50,48],[38,50],[78,28],[50,18],[22,28]] },
    '4-4-2': { name: '4-4-2', slots: ['GK','RB','CB','CB','LB','RM','CM','CM','LM','ST','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[82,48],[58,50],[42,50],[18,48],[58,20],[42,20]] },
    '4-2-3-1': { name: '4-2-3-1', slots: ['GK','RB','CB','CB','LB','CDM','CDM','CAM','RW','LW','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[58,55],[42,55],[50,38],[78,30],[22,30],[50,16]] },
    '3-5-2': { name: '3-5-2', slots: ['GK','CB','CB','CB','RB','CM','CM','CM','LB','ST','ST'],
      coords: [[50,92],[68,75],[50,78],[32,75],[88,55],[62,48],[50,50],[38,48],[12,55],[58,20],[42,20]] },
    '4-5-1': { name: '4-5-1', slots: ['GK','RB','CB','CB','LB','RM','CM','CDM','CM','LM','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[82,45],[62,48],[50,55],[38,48],[18,45],[50,18]] },
    '3-4-3': { name: '3-4-3', slots: ['GK','CB','CB','CB','RM','CM','CM','LM','RW','ST','LW'],
      coords: [[50,92],[68,75],[50,78],[32,75],[82,50],[58,48],[42,48],[18,50],[78,25],[50,16],[22,25]] },
    '5-3-2': { name: '5-3-2', slots: ['GK', 'RB', 'CB', 'CB', 'CB', 'LB', 'CM', 'CDM', 'CM', 'ST', 'ST'],
    coords: [[50,92],[88,68],[68,75],[50,78],[32,75],[12,68],[72.3,44.3],[52,56.3],[27.9,45.3],[68.4,19.9],[29.4,19.7]] },
    '4-1-4-1': { name: '4-1-4-1', slots: ['GK','RB','CB','CB','LB','CDM','RM','CM','CM','LM','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[50,58],[82,42],[58,45],[42,45],[18,42],[50,16]] },
    '4-3-2-1': { name: '4-3-2-1', slots: ['GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'CDM', 'CM', 'CAM', 'CAM', 'ST'],
    coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[72.6,48.6],[52,59],[29.6,49.7],[67.8,31.1],[31.6,31.5],[49.4,15.5]] },
    '3-4-2-1': { name: '3-4-2-1', slots: ['GK','CB','CB','CB','RM','CM','CM','LM','CAM','CAM','ST'],
      coords: [[50,92],[68,75],[50,78],[32,75],[85,50],[58,52],[42,52],[15,50],[62,30],[38,30],[50,14]] },
    '4-4-1-1': { name: '4-4-1-1', slots: ['GK','RB','CB','CB','LB','CM','CDM','CDM','CM','CAM','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[82,48],[58,52],[42,52],[18,48],[50,32],[50,16]] },
    '5-4-1': { name: '5-4-1', slots: ['GK','RB','CB','CB','CB','LB','CM','CDM','CDM','CM','ST'],
      coords: [[50,92],[88,68],[68,75],[50,78],[32,75],[12,68],[80,45],[58,50],[42,50],[20,45],[50,18]] },
    '4-1-2-1-2': { name: '4-1-2-1-2 (Diamond)', slots: ['GK','RB','CB','CB','LB','CDM','CM','CM','CAM','ST','ST'],
      coords: [[50,92],[80,72],[62,75],[38,75],[20,72],[50,60],[66,46],[34,46],[50,32],[58,16],[42,16]] },
    '4-2-2-2': { name: '4-2-2-2', slots: ['GK','RB','CB','CB','LB','CDM','CDM','CAM','CAM','ST','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[60,55],[40,55],[70,35],[30,35],[58,16],[42,16]] },
    '3-1-4-2': { name: '3-1-4-2', slots: ['GK','CB','CB','CB','CDM','RM','CM','CM','LM','ST','ST'],
      coords: [[50,92],[68,75],[50,78],[32,75],[50,58],[82,42],[60,44],[40,44],[18,42],[58,18],[42,18]] },
    '4-1-3-2': { name: '4-1-3-2', slots: ['GK','RB','CB','CB','LB','CDM','RM','CAM','LM','ST','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[50,58],[78,42],[50,40],[22,42],[58,18],[42,18]] },
    '4-3-3-f9': { name: '4-3-3 (False 9)', slots: ['GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'CDM', 'CM', 'RW', 'ST', 'LW'],
    coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[72.9,49.2],[51.1,58.2],[27.1,49.5],[75,22],[50,34],[25,22]] },
    '4-3-3-cdm': { name: '4-3-3 (Holding)', slots: ['GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'CDM', 'CAM', 'RW', 'ST', 'LW'],
    coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[65.3,43.1],[50.7,61.7],[35.4,43.1],[84.1,28.9],[49.5,17.6],[17.5,30.7]] },
    '4-3-3-cam': { name: '4-3-3 (Attack)', slots: ['GK','RB','CB','CB','LB','CM','CM','CAM','RW','ST','LW'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[62,52],[38,52],[50,38],[78,22],[50,14],[22,22]] },
    '4-2-3-1-narrow': { name: '4-2-3-1 (Narrow)', slots: ['GK','RB','CB','CB','LB','CDM','CDM','CAM','RW','LW','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[58,55],[42,55],[50,38],[66,26],[34,26],[50,16]] },
    '5-3-2-attack': { name: '5-3-2 (Attack)', slots: ['GK','RWB','CB','CB','CB','LWB','CM','CM','CM','ST','ST'],
      coords: [[50,92],[88,62],[68,72],[50,75],[32,72],[12,62],[62,45],[50,48],[38,45],[58,18],[42,18]] },
       '4-2-4': { name: '4-2-4', slots: ['GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'CDM', 'ST', 'RW', 'ST', 'LW'],
    coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[47.5,37.4],[49.2,57],[60.2,18.2],[85.6,27],[35.6,19.3],[14.6,30.7]] },
     '4-1-2-3-st': { name: '4-1-2-3 (3 ST)', slots: ['GK', 'RB', 'CB', 'CB', 'LB', 'CAM', 'CDM', 'CAM', 'ST', 'ST', 'ST'],
    coords: [[50,92],[85,73.9],[62,75],[38,75],[16,75.4],[64.5,39.4],[51.9,56.7],[35.7,38.9],[73.5,16.8],[49.2,17],[25.3,17.1]] }
  };

  const POS_COMPAT = {
    GK: ['GK'], CB: ['CB','RB','LB'], RB: ['RB','CB','RWB','RM'], LB: ['LB','CB','LWB','LM'],
    RWB: ['RWB','RB','RM'], LWB: ['LWB','LB','LM'], CDM: ['CDM','CM','CB'], CM: ['CM','CDM','CAM'],
    CAM: ['CAM','CM','RW','LW','ST','CMF','SS'], RM: ['RM','RW','RWB','CM','RMF'], LM: ['LM','LW','LWB','CM','LMF'],
    RW: ['RW','RM','ST','CAM','RWF'], LW: ['LW','LM','ST','CAM','LWF'], ST: ['ST','RW','LW','CAM','CF','SS'],
    // Several FORMATIONS entries use 'CF' as a distinct slot label from
    // 'ST' (e.g. 4-4-2, 3-5-2, the False 9 shape) even though a player's
    // own position data is always canonicalized to 'ST' — see
  };

  // Sensible in-slot role changes for the squad builder — tapping a
  // position on the pitch (e.g. CM) offers only the handful of role
  // shifts that stay tactically coherent for that same physical slot
  // (CM can push forward to CAM or drop to CDM; it can't become a
  // winger or a centre-back). This is intentionally narrower than
  // POS_COMPAT above, which answers a different question ("which
  // players are eligible to fill this slot") — this answers "what can
  // this slot itself become". Every list includes its own code first so
  // callers can always fall back to "no change" as option one.
  const POS_ROLE_ALTS = {
    GK: ['GK'],
    CB: ['CB'],
    RB: ['RB', 'RWB','CB'],
    LB: ['LB', 'LWB','CB'],
    RWB: ['RWB', 'RB', 'RM'],
    LWB: ['LWB', 'LB', 'LM'],
    CDM: ['CDM', 'CM'],
    CM: ['CM', 'CDM', 'CAM'],
    CAM: ['CAM', 'CM'],
    RM: ['RM', 'RW', 'RWB','CM'],
    LM: ['LM', 'LW', 'LWB', 'CM'],
    RW: ['RW', 'RM'],
    LW: ['LW', 'LM'],
    ST: ['ST']
  };
  // Human-readable names for the role picker — the slot codes alone
  // (CDM, CAM...) aren't self-explanatory to everyone at a glance.
  const POS_ROLE_NAMES = {
    GK: 'Goalkeeper', CB: 'Centre-Back', RB: 'Right-Back', LB: 'Left-Back',
    RWB: 'Right Wing-Back', LWB: 'Left Wing-Back', CDM: 'Defensive Mid',
    CM: 'Central Mid', CAM: 'Attacking Mid', RM: 'Right Mid', LM: 'Left Mid',
    RW: 'Right Wing', LW: 'Left Wing', ST: 'Striker'
  };

  // Different data sources (teams.json, player-attributes.json) name the
  // same real-world position differently — eFootball-style codes (CMF,
  // DMF, AMF, RMF/LMF, RWF/LWF, SS), plain-language ones (AM), even a
  // sweeper (SW). FORMATIONS/POS_COMPAT/POS_LINE above only ever speak the
  // one canonical code per position (e.g. ST, not CF) — so any player whose
  // pos array uses a variant spelling would silently never match a
  // formation slot by exact position, and would fall through to Pass 2's
  // compatibility check where THAT variant is equally absent from
  // POS_COMPAT, so they wouldn't even qualify as a fallback. That's the
  // "ST gets preferred over CF" bias: normalizePositions() (called once per
  // team right after teams.json/player-attributes.json load, see init() in
  // ui/matchUI.js) rewrites every player's pos array to these canonical
  // codes so the exact same eligibility logic treats every naming variant
  // of a position identically, with no formation-slot code needing to
  // change at all.
  const POS_ALIASES = {
    GK: 'GK',
    SW: 'CB', CB: 'CB',
    RB: 'RB', LB: 'LB',
    RWB: 'RWB', LWB: 'LWB',
    CDM: 'CDM', DMF: 'CDM', DM: 'CDM',
    CM: 'CM', CMF: 'CM', MF: 'CM',
    CAM: 'CAM', AM: 'CAM', AMF: 'CAM', SS: 'CAM',
    RM: 'RM', RMF: 'RM',
    LM: 'LM', LMF: 'LM',
    RW: 'RW', RWF: 'RW', RF: 'RW',
    LW: 'LW', LWF: 'LW', LF: 'LW',
    ST: 'ST', CF: 'ST'
  };
  function canonPos(p) { return POS_ALIASES[p] || p; }
  // Normalizes a player's pos array to canonical codes, in place, and
  // dedupes any resulting repeats (e.g. a player listed as both CM and CMF
  // would otherwise end up with 'CM' twice). No-op for a player whose pos
  // is already canonical or missing.
  function normalizePlayerPos(p) {
    if (!p || !p.pos || !p.pos.length) return;
    const seen = new Set();
    const out = [];
    p.pos.forEach((raw) => {
      const c = canonPos(raw);
      if (!seen.has(c)) { seen.add(c); out.push(c); }
    });
    p.pos = out;
  }
  // Normalizes every player on every given team. Safe to call repeatedly
  // (already-canonical positions round-trip unchanged) — called once after
  // the initial teams.json load and again after player-attributes.json
  // overrides a player's pos array (see applyExpandedPlayerAttributes()).
  function normalizeAllPositions(teams) {
    (teams || []).forEach(t => (t.players || []).forEach(normalizePlayerPos));
  }

  // Broad position "line" for a player, used to keep substitutions tactically
  // sensible — like-for-like where possible, and to spot when a red card has
  // left a hole specifically in defence.
  const POS_LINE = {
    GK: 'GK',
    CB: 'DEF', RB: 'DEF', LB: 'DEF', RWB: 'DEF', LWB: 'DEF',
    CDM: 'MID', CM: 'MID', CAM: 'MID', RM: 'MID', LM: 'MID',
    RW: 'FWD', LW: 'FWD', ST: 'FWD', CF: 'FWD'
  };
  // ---- Formation shape: how many defensive/midfield/attacking "bodies" a
  // formation actually puts on the pitch, weighted by how central/committed
  // each slot is to that job (a wing-back counts partly for both defence and
  // attack; a CDM counts mostly defensive-minded, a CAM mostly attacking).
  // This is what lets picking e.g. 3-4-3 over 5-4-1 genuinely open a team up
  // going forward (and expose it at the back) in the match engine itself,
  // not just via which individual players happen to be selected.
  const SHAPE_DEF_WEIGHT = { CB: 1, RB: 0.8, LB: 0.8, RWB: 0.55, LWB: 0.55, CDM: 0.35 };
  const SHAPE_FWD_WEIGHT = { ST: 1, CF: 1, RW: 0.75, LW: 0.75, CAM: 0.4, RM: 0.3, LM: 0.3, RWB: 0.15, LWB: 0.15 };
  const SHAPE_MID_WEIGHT = { CM: 1, CDM: 0.65, CAM: 0.6, RM: 0.7, LM: 0.7, RWB: 0.3, LWB: 0.3 };
  // Baseline reference is 4-3-3 (RB,CB,CB,LB,CM,CM,CM,RW,ST,LW) — every other
  // formation's bonus/penalty is measured as a delta off this neutral shape.
  const SHAPE_BASELINE = { def: 3.6, fwd: 2.5, mid: 3.0 };
  const formationShapeCache = {};
  const TOURNAMENT_FORMATS = {
    'worldcup': { name: 'World Cup', short: 'World Cup', engine: 'groups', pool: 'national', leaguesKey: null,
      desc: 'Select national teams. Supports groups (up to 48 teams, World Cup style).' },
    'ucl': { name: 'Champions League', short: 'Champions League', engine: 'league', pool: 'club', leaguesKey: null,
      desc: 'Champions League 2024+ format: select up to 36 clubs. League phase (8 matches each), playoffs, two-leg knockouts, single final.' },
    'premier-league': { name: 'Premier League', short: 'Premier League', engine: 'table', pool: 'club', leaguesKey: 'Premier League',
      desc: 'England\u2019s top flight: select the full club field for a real home-and-away, double round-robin season. No groups, no bracket — the table topper is champion.' },
    'la-liga': { name: 'La Liga', short: 'La Liga', engine: 'table', pool: 'club', leaguesKey: 'La Liga',
      desc: 'Spain\u2019s top flight: select the full club field for a real home-and-away, double round-robin season. No groups, no bracket — the table topper is champion.' },
    'serie-a': { name: 'Serie A', short: 'Serie A', engine: 'table', pool: 'club', leaguesKey: 'Serie A',
      desc: 'Italy\u2019s top flight: select the full club field for a real home-and-away, double round-robin season. No groups, no bracket — the table topper is champion.' },
    'bundesliga': { name: 'Bundesliga', short: 'Bundesliga', engine: 'table', pool: 'club', leaguesKey: 'Bundesliga',
      desc: 'Germany\u2019s top flight: select the full club field for a real home-and-away, double round-robin season. No groups, no bracket — the table topper is champion.' },
    'ligue-1': { name: 'Ligue 1', short: 'Ligue 1', engine: 'table', pool: 'club', leaguesKey: 'Ligue 1',
      desc: 'France\u2019s top flight: select the full club field for a real home-and-away, double round-robin season. No groups, no bracket — the table topper is champion.' },
    'nations-league': { name: 'Nations League', short: 'Nations League', engine: 'groups', pool: 'national', leaguesKey: 'Nations League',
      desc: 'European nations in groups, then knockout (a 4-group, 16-team League A style split sends both group winners and runners-up straight to the quarter-finals — real UEFA promotion/relegation and the lower-league play-off/final formats aren\u2019t modeled). Team picker is restricted to the eligible nations in leagues.json.' },
    'euros': { name: 'European Championship', short: 'Euros', engine: 'groups', pool: 'national', leaguesKey: 'Euros',
      desc: '24 nations in 6 groups of 4; the top 2 from each group plus the 4 best third-placed teams advance to the Round of 16.' },
    'copa-america': { name: 'Copa América', short: 'Copa América', engine: 'groups', pool: 'national', leaguesKey: 'Copa América',
      desc: '16 nations in 4 groups of 4; the top 2 from each group advance straight to the quarter-finals.' },
    'afcon': { name: 'Africa Cup of Nations', short: 'AFCON', engine: 'groups', pool: 'national', leaguesKey: 'AFCON',
      desc: '24 nations in 6 groups of 4; the top 2 from each group plus the 4 best third-placed teams advance to the Round of 16.' },
    'asian-cup': { name: 'AFC Asian Cup', short: 'Asian Cup', engine: 'groups', pool: 'national', leaguesKey: 'Asian Cup',
      desc: '24 nations in 6 groups of 4; the top 2 from each group plus the 4 best third-placed teams advance to the Round of 16.' },
    'gold-cup': { name: 'CONCACAF Gold Cup', short: 'Gold Cup', engine: 'groups', pool: 'national', leaguesKey: 'Gold Cup',
      desc: 'North/Central American & Caribbean nations compete through groups and knockouts.' },
    'fa-cup': { name: 'FA Cup', short: 'FA Cup', engine: 'knockout', pool: 'club', leaguesKey: 'FA Cup',
      desc: 'English clubs in a straight single-elimination knockout, from Round 1 to the Final.' },
    'efl-cup': { name: 'EFL Cup', short: 'EFL Cup', engine: 'knockout', pool: 'club', leaguesKey: 'EFL Cup',
      desc: 'English clubs in a straight single-elimination knockout, from Round 1 to the Final.' },
    'community-shield': { name: 'FA Community Shield', short: 'Community Shield', engine: 'knockout', pool: 'club', leaguesKey: 'FA Community Shield',
      desc: 'A single curtain-raiser match — pick exactly two English clubs.' },
    'copa-del-rey': { name: 'Copa del Rey', short: 'Copa del Rey', engine: 'knockout', pool: 'club', leaguesKey: 'Copa del Rey',
      desc: 'Spanish clubs in a straight single-elimination knockout, from Round 1 to the Final.' },
    'supercopa-esp': { name: 'Supercopa de España', short: 'Supercopa de España', engine: 'knockout', pool: 'club', leaguesKey: 'Supercopa de España',
      desc: 'A short knockout between Spain\u2019s top clubs — pick 2 or 4.' },
    'dfb-pokal': { name: 'DFB-Pokal', short: 'DFB-Pokal', engine: 'knockout', pool: 'club', leaguesKey: 'DFB-Pokal',
      desc: 'German clubs in a straight single-elimination knockout, from Round 1 to the Final.' },
    'dfl-supercup': { name: 'DFL-Supercup', short: 'DFL-Supercup', engine: 'knockout', pool: 'club', leaguesKey: 'DFL-Supercup',
      desc: 'A single curtain-raiser match — pick exactly two German clubs.' },
    'coppa-italia': { name: 'Coppa Italia', short: 'Coppa Italia', engine: 'knockout', pool: 'club', leaguesKey: 'Coppa Italia',
      desc: 'Italian clubs in a straight single-elimination knockout, from Round 1 to the Final.' },
    'supercoppa-ita': { name: 'Supercoppa Italiana', short: 'Supercoppa Italiana', engine: 'knockout', pool: 'club', leaguesKey: 'Supercoppa Italiana',
      desc: 'A short knockout between Italy\u2019s top clubs — pick 2 or 4.' },
    'coupe-de-france': { name: 'Coupe de France', short: 'Coupe de France', engine: 'knockout', pool: 'club', leaguesKey: 'Coupe de France',
      desc: 'French clubs in a straight single-elimination knockout, from Round 1 to the Final.' },
    'trophee-des-champions': { name: 'Troph\u00e9e des Champions', short: 'Troph\u00e9e des Champions', engine: 'knockout', pool: 'club', leaguesKey: 'Troph\u00e9e des Champions',
      desc: 'A single curtain-raiser match — pick exactly two French clubs.' }
  };

  // Generic name-matching resolver shared by every competition's eligibility
  // list. Mirrors getLeagueTeamPool()'s matching order (exact -> normalized
  // -> loose substring) but works against either the national or the club
  // pool, since it's used for both continental national-team competitions
  // and domestic club competitions.
  function resolveEligiblePool(names, sourcePool) {
    if (!names || !names.length || !sourcePool || !sourcePool.length) return [];
    const matched = [];
    names.forEach(n => {
      const norm = normalizeLeagueName(n);
      let t = sourcePool.find(x => (x.name || '').toLowerCase() === (n || '').toLowerCase());
      if (!t) t = sourcePool.find(x => normalizeLeagueName(x.name) === norm);
      if (!t) t = sourcePool.find(x => norm && (normalizeLeagueName(x.name).includes(norm) || norm.includes(normalizeLeagueName(x.name))));
      if (t && !matched.includes(t)) matched.push(t);
    });
    return matched;
  }

  // Resolves the eligible team-selection pool for a given tournament format
  // key. World Cup and Champions League have no leaguesKey, so they keep
  // offering the full national/club pool exactly as before. Every other
  // format restricts the picker to the names listed under its key in
  // leagues.json — falling back to the full pool (like getLeagueTeamPool()
  // does for the Season Calendar) if leagues.json has no entry yet or none
  // of its names match teams.json.
  function getCompetitionEligiblePool(formatKey) {
    const cfg = TOURNAMENT_FORMATS[formatKey];
    if (!cfg) return [];
    const rawPool = cfg.pool === 'national' ? (teamsData.national || []) : (teamsData.club || []);
    if (!cfg.leaguesKey) return rawPool;
    const fullPool = cfg.pool === 'national' ? rawPool : rawPool.filter(isCurrentSeasonSquad);
    const names = leaguesData[cfg.leaguesKey];
    if (!names || !names.length) return fullPool;
    const matched = resolveEligiblePool(names, fullPool);
    return matched.length ? matched : fullPool;
  }

  // Per-competition logo + accent-color theme. The actual filenames and hex
  // values live in leagues.json under "_tournamentBranding" (one entry per
  // TOURNAMENT_FORMATS key, e.g. "euros", "copa-america"), so a tournament's
  // full identity — eligible teams AND its logo/colors — comes from that one
  // data file; logos themselves are dropped into assets/images/<logo>.
  // Falls back to a neutral gold trophy theme if leagues.json hasn't loaded
  // yet or has no branding entry for a given format, so nothing ever renders
  // broken while assets are still being added.
  const DEFAULT_TOURNAMENT_BRANDING = { logo: 'trophy.png', color: '#f0c14b', colorDim: '#c9a227' };
  function getTournamentBranding(formatKey) {
    const table = (typeof leaguesData !== 'undefined' && leaguesData && leaguesData._tournamentBranding) || {};
    return Object.assign({}, DEFAULT_TOURNAMENT_BRANDING, table[formatKey] || {});
  }

  // ===================================================================
  // ===================== FATIGUE / STAMINA MODEL ====================
  // ===================================================================
  // Every outfield player accumulates fatigue while on the pitch, driven by
  // minutes played, their physical attribute, the team's current tactical
  // intensity (a high press/all-out attack drains far faster than sitting
  // in a defensive block), and their role (wide/forward positions cover
  // more ground than a holding centre-back). A substitute starts fresh the
  // moment they come on. This is read directly by the substitution AI in
  // engine/tactics.js so tired legs are a first-class reason a manager
  // makes a change — not just an after-the-fact proxy via a dropping match
  // rating once the damage is already done.
  function ensureFatigueState(m) {
    if (!m.fatigue) m.fatigue = { home: {}, away: {} };
    return m.fatigue;
  }
  // 0-100, 100 = fully fresh. Defaults to fresh for anyone not yet tracked
  // (covers players who haven't been on the pitch yet this match).
  function getStamina(m, side, playerId) {
    if (!m) return 100;
    const fat = ensureFatigueState(m);
    const rec = fat[side] && fat[side][playerId];
    return rec ? rec.stamina : 100;
  }
  // Per-minute drain rate for a given player — physical attribute, position
  // (wide/forward roles cover more ground than a holding CB or GK), and the
  // team's current tactical intensity all feed in.
  function fatigueDrainRate(p, tac) {
    const slot = p.slot || (p.pos || [])[0] || 'CM';
    if (slot === 'GK') return 0.12;
    const line = POS_LINE[slot] || 'MID';
    const roleLoad = WIDE_SLOTS.has(slot) ? 1.25 : line === 'MID' ? 1.15 : line === 'FWD' ? 1.05 : 0.85;
    // Stamina is the specific attribute for how long a player holds his
    // physical performance before tiring, so it now drives the drain rate
    // directly instead of disappearing into the generic `phy` blend (which
    // also mixes in jump/balance/aggression that have nothing to do with
    // endurance). Physical Contact is a much smaller secondary factor —
    // a robust frame shrugs off the wear of knocks/duels a little better,
    // but it's not a substitute for genuine engine.
    const stam = xattr(p, 'stam', p.phy || 70);
    const phyCon = xattr(p, 'phy_con', p.phy || 70);
    const stamFactor = Math.max(0.62, Math.min(1.42, (100 - stam) / 42));
    const phyConFactor = Math.max(0.93, Math.min(1.07, 0.93 + (100 - phyCon) / 300));
    const tacFactor = tac === 'press' ? 1.35 : tac === 'attack' ? 1.15 : tac === 'defend' ? 0.8 : 1.0;
    let rate = 0.62 * roleLoad * stamFactor * phyConFactor * tacFactor;
    // Fighting Spirit and Track Back both describe a player who holds his
    // intensity/work-rate up under fatigue and pressure — modeled as a
    // genuinely slower stamina drain rather than just a late-game stat bump.
    if (hasSkill(p, 'Fighting Spirit')) rate *= 0.85;
    if (hasSkill(p, 'Track Back')) rate *= 0.94;
    return rate;
  }
  // Runs once per simulated minute for both sides — drains everyone
  // currently on the pitch. Floors out at 8 rather than 0 so an exhausted
  // player is a heavy substitution risk without ever going fully inert.
  function updateFatigue() {
    const m = currentMatch;
    if (!m) return;
    const fat = ensureFatigueState(m);
    ['home', 'away'].forEach(side => {
      const team = m[side];
      const tac = (m.tactics && m.tactics[side]) || 'balanced';
      const onIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
      const all = (team.squad && team.squad.all) || [];
      // Captaincy: a captain on the pitch takes the edge off the whole
      // team's fatigue, not just his own — real captains manage tempo and
      // keep the squad's intensity honest through a long match.
      const captainOnPitch = all.some(x => onIds.includes(x.id) && hasSkill(x, 'Captaincy'));
      onIds.forEach(id => {
        const p = all.find(x => x.id === id);
        if (!p) return;
        if (!fat[side][id]) fat[side][id] = { stamina: 100 };
        const rec = fat[side][id];
        let drain = fatigueDrainRate(p, tac);
        if (captainOnPitch) drain *= 0.93;
        rec.stamina = Math.max(8, rec.stamina - drain);
      });
    });
  }
  // A substitute always comes on fresh — called from trySubstitution(),
  // handleRedCardReshuffle(), and tryInjury()'s forced-sub path so the
  // incoming player's stamina tracking starts clean rather than inheriting
  // whatever the outgoing player's number happened to be.
  function resetFatigueFor(m, side, playerId) {
    const fat = ensureFatigueState(m);
    fat[side][playerId] = { stamina: 100 };
  }
  // Team-wide average stamina among players currently on the pitch — used
  // to nudge overall substitution *timing* (see tick() in matchEngine.js),
  // on top of fatigue driving *who* comes off inside trySubstitution().
  function teamAvgStamina(side) {
    const m = currentMatch;
    if (!m) return 100;
    const onIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    if (!onIds.length) return 100;
    const total = onIds.reduce((s, id) => s + getStamina(m, side, id), 0);
    return total / onIds.length;
  }
  // Which side a given player is actually on this match — every ability
  // read below (passing, carrying, defending, aerials) needs this to look
  // up that player's live stamina, and none of them otherwise know which
  // squad they belong to.
  function playerMatchSide(p) {
    const m = currentMatch;
    if (!m || !p) return null;
    if (m.home && m.home.squad && (m.home.squad.all || []).some((x) => x.id === p.id)) return 'home';
    if (m.away && m.away.squad && (m.away.squad.all || []).some((x) => x.id === p.id)) return 'away';
    return null;
  }
  // The single hook that makes stamina matter *during* the 90 minutes,
  // not just as a trigger for substitutions after the fact. Every major
  // in-match ability read (passing/carrying/defending/aerial duels) now
  // runs its raw attribute number through this multiplier — a player
  // sitting comfortably above ~70 stamina performs at full sharpness,
  // and it tails off smoothly down to a real (but not crippling) ~16%
  // dip once they're running on empty. This is what makes a genuinely
  // high `stam` rating pay off for a full match instead of only ever
  // showing up as a slightly later substitution.
  function staminaMultiplier(p) {
    const m = currentMatch;
    if (!m || !p) return 1;
    const side = playerMatchSide(p);
    if (!side) return 1;
    const stamina = getStamina(m, side, p.id);
    if (stamina >= 70) return 1;
    return Math.max(0.84, 1 - (70 - stamina) * 0.0026);
  }

  // ===================================================================
  // ================ FORM & CONDITION SYSTEM (eFootball-style) ========
  // ===================================================================
  // Two persistent, per-player attributes drive this system:
  //   p.form       — "Unwavering" | "Standard" | "Inconsistent". How
  //                   consistent this player's day-to-day condition is.
  //                   Sourced from player-attributes.json (expanded
  //                   sheet) when present; any player without one
  //                   defaults to "Inconsistent".
  //   p.liveRating — "A" | "B" | "C" | "D" | "E". This player's current
  //                   run of form, starting at "B" and set directly after
  //                   every match from their rating in that match: 8.9+
  //                   is A, 7.9+ is B, 6.9+ is C, 5.9+ is D, anything
  //                   below that is E.
  //
  // Neither of those is the match-to-match number that actually moves
  // the needle in a game — that's the ephemeral, per-match "condition"
  // rolled once at kickoff (rollSquadConditions): "Excellent" | "Good" |
  // "Normal" | "Poor" | "Terrible". The roll is weighted by liveRating
  // (a player on "A" form is far more likely to roll Excellent/Good than
  // one on "E") and spread by form type (Unwavering barely deviates from
  // what liveRating alone would predict; Inconsistent can swing to
  // either extreme).
  //
  // Condition is intentionally kept OUT of the player object's baseOvr/
  // ovr entirely — per-match condition is looked up live off
  // currentMatch.condition (exactly the same pattern engine/fatigue.js
  // already uses for stamina, see staminaMultiplier()) and only ever
  // multiplies an *in-match* ability read. A player's card/base stats
  // and overall never change because of a bad day.
  const FORM_TYPES = ['Unwavering', 'Standard', 'Inconsistent'];
  const LIVE_RATINGS = ['A', 'B', 'C', 'D', 'E'];
  const CONDITIONS = ['Excellent', 'Good', 'Normal', 'Poor', 'Terrible'];

  // Base condition-roll weights per liveRating tier, indexed to match
  // CONDITIONS above (Excellent..Terrible). A/B skew toward the good end,
  // C centers on Normal, D/E skew toward the poor end — per spec.
  const LIVE_RATING_CONDITION_WEIGHTS = {
    A: [40, 35, 18, 5, 2],
    B: [22, 33, 30, 11, 4],
    C: [8, 22, 40, 22, 8],
    D: [4, 11, 30, 33, 22],
    E: [2, 5, 18, 35, 40]
  };

  // How far the roll is allowed to stray from its liveRating-predicted
  // peak. 1.0 leaves the base weights above untouched ("moderate
  // variation"); below 1 compresses the roll tightly around the peak
  // tier ("stable"); above 1 exaggerates the tails so extreme swings
  // become meaningfully more likely ("extreme variation").
  const FORM_TYPE_SPREAD = { Unwavering: 0.45, Standard: 1.0, Inconsistent: 1.85 };

  // Flat effective-attribute multiplier per rolled condition — applied
  // (see conditionMultiplier() below) at the specific shooting/passing/
  // dribbling/defending/physical/positioning/goalkeeping read sites
  // spread across the engine, never to baseOvr/ovr.
  const CONDITION_MULTIPLIER = {
    Excellent: 1.08,
    Good: 1.04,
    Normal: 1.0,
    Poor: 0.94,
    Terrible: 0.86
  };
  // Makes sure a player carries valid form/liveRating values, deriving
  // form from their expanded-attribute sheet (player-attributes.json)
  // the first time this runs for them. Safe to call repeatedly/lazily —
  // every read site below calls this defensively so nothing ever reads
  // undefined form data, even for a player added after the startup pass.
  function ensurePlayerConditionProfile(p) {
    if (!p) return;
    if (!FORM_TYPES.includes(p.form)) {
      const sheetForm = p.expandedAttrs && p.expandedAttrs.form;
      p.form = FORM_TYPES.includes(sheetForm) ? sheetForm : 'Inconsistent';
    }
    if (!LIVE_RATINGS.includes(p.liveRating)) p.liveRating = 'B';
  }
  // Startup pass — run once after applyExpandedPlayerAttributes() so
  // every player's expandedAttrs (and therefore their authored form
  // type) is already resolved, and after restorePlayerConditionState()
  // so a previously-earned liveRating is restored before this fills in
  // anyone still missing one.
  function ensureAllPlayerConditionProfiles() {
    allTeams.forEach(t => (t.players || []).forEach(ensurePlayerConditionProfile));
  }
  // Weighted random condition roll for one player ahead of kickoff.
  function rollPlayerCondition(p) {
    ensurePlayerConditionProfile(p);
    const base = LIVE_RATING_CONDITION_WEIGHTS[p.liveRating] || LIVE_RATING_CONDITION_WEIGHTS.B;
    const spread = FORM_TYPE_SPREAD[p.form] != null ? FORM_TYPE_SPREAD[p.form] : 1.0;
    const peakIdx = base.reduce((best, w, i) => (w > base[best] ? i : best), 0);
    // Stretch/compress each tier's weight by how far it sits from the
    // liveRating's own peak tier — see FORM_TYPE_SPREAD comment above.
    const adjusted = base.map((w, i) => Math.max(0.5, w * Math.pow(spread, Math.abs(i - peakIdx))));
    const total = adjusted.reduce((a, b) => a + b, 0);
    let r = seededRandom() * total;
    for (let i = 0; i < adjusted.length; i++) {
      r -= adjusted[i];
      if (r <= 0) return CONDITIONS[i];
    }
    return CONDITIONS[CONDITIONS.length - 1];
  }
  // Rolls and stores pre-match condition for every player in a squad
  // (starters + bench — a sub might come on) into currentMatch.condition,
  // keyed by side then player id. Called once per match from
  // startMatch(), mirroring how fatigue/stamina state is scoped to
  // currentMatch rather than stored on the player object itself.
  function rollSquadConditions(squad) {
    const out = {};
    ((squad && squad.all) || []).forEach(p => { out[p.id] = rollPlayerCondition(p); });
    return out;
  }

  function rollMatchConditions(m) {
    if (!m) return;
    m.condition = {
      home: rollSquadConditions(m.home.squad),
      away: rollSquadConditions(m.away.squad)
    };
  }
  // Live lookup of a player's rolled condition for the match currently
  // in progress. Falls back to "Normal" (neutral) outside of a match, or
  // for a player this match never rolled a condition for.
  function getPlayerCondition(p) {
    const m = currentMatch;
    if (!m || !p || !m.condition) return 'Normal';
    const side = playerMatchSide(p);
    if (!side) return 'Normal';
    return (m.condition[side] && m.condition[side][p.id]) || 'Normal';
  }
  // The single multiplier every condition-aware ability read below
  // applies, exactly the way staminaMultiplier(p) already gets applied
  // throughout the engine — never touches baseOvr/ovr, only ever scales
  // an in-match performance read (shooting/passing/dribbling/defending/
  // physical/positioning/goalkeeping — see the call sites in
  // shooting.js, passing.js, defending.js and goalkeeper.js).
  function conditionMultiplier(p) {
    const cond = getPlayerCondition(p);
    return CONDITION_MULTIPLIER[cond] != null ? CONDITION_MULTIPLIER[cond] : 1;
  }
  // Post-match progression: a player's liveRating is set directly from
  // their rating in the match that just finished — not drifted/eased
  // toward it — so the tier always reflects the most recent performance:
  //   8.9+ rating -> A,  7.9+ -> B,  6.9+ -> C,  5.9+ -> D,  else -> E.
  function updateLiveRatingAfterMatch(p, rating) {
    if (!p) return;
    ensurePlayerConditionProfile(p);
    if (rating >= 8.9) p.liveRating = 'A';
    else if (rating >= 7.9) p.liveRating = 'B';
    else if (rating >= 6.9) p.liveRating = 'C';
    else if (rating >= 5.9) p.liveRating = 'D';
    else p.liveRating = 'E';
  }
  // Small badge + longer label, both keyed off liveRating — same call
  // signature/markup classes as the old numeric-form version so every
  // existing caller (ui/playerUI.js, ui/playersUI.js) needs no changes
  // at all. Wording is deliberately kept distinct from the CONDITIONS
  // vocabulary below (Excellent/Good/Normal/Poor/Terrible) — liveRating
  // and per-match condition are two different scales, and sharing words
  // between them was the actual cause of a player's lineup badge and
  // profile badge looking like they "didn't match": a match condition
  // of "Poor" next to a liveRating labelled "Good form" reads as a
  // straight contradiction even though the two numbers were never meant
  // to agree. The badge itself is one of the curated PNGs in
  // assets/images/ (a.png, b.png, c.png, d.png, e.png) via emojiImg(),
  // same as the condition badge below, rather than a letter/emoji.
  const LIVE_RATING_DISPLAY = {
    A: { label: 'Rich form', cls: 'form-hot' },
    B: { label: 'Solid form', cls: 'form-up' },
    C: { label: 'Average form', cls: 'form-flat' },
    D: { label: 'Shaky form', cls: 'form-down' },
    E: { label: 'Out of form', cls: 'form-cold' }
  };
  function formArrow(player) {
    ensurePlayerConditionProfile(player);
    const lr = (player && player.liveRating) || 'B';
    const d = LIVE_RATING_DISPLAY[lr] || LIVE_RATING_DISPLAY.B;
    return `<span class="form-arrow ${d.cls}" title="${d.label} (${lr}-rating)">${emojiImg(lr.toLowerCase(), lr + '-rating')}</span>`;
  }
  function formLabel(player) {
    ensurePlayerConditionProfile(player);
    const lr = (player && player.liveRating) || 'B';
    const d = LIVE_RATING_DISPLAY[lr] || LIVE_RATING_DISPLAY.B;
    // Text only — the caller (player profile header) already renders the
    // a.png..e.png badge once via formArrow() right next to this; putting
    // the same image in here too just showed the rating badge twice.
    return d.label;
  }
  // Pre-match condition badge — shown in the lineup list so a rolled
  // "Excellent"/"Poor"/etc. is visible before kickoff, not just inferred
  // from how the match plays out. Rendered as one of the curated PNGs in
  // assets/images/ (excellent.png, good.png, normal.png, poor.png,
  // terrible.png) via the same emojiImg() helper every other in-app icon
  // already uses, rather than as plain uppercase text.
  function conditionBadgeHTML(p) {
    const cond = getPlayerCondition(p);
    const file = cond.toLowerCase();
    return `<span class="cond-badge" title="Match condition: ${cond}">${emojiImg(file, cond)}</span>`;
  }
  // Persistence — only liveRating is stateful/dynamic and needs saving;
  // form is re-derived from player-attributes.json (or defaulted) on
  // every load via ensureAllPlayerConditionProfiles(), so it's never
  // written here. Function name kept as collectPlayerFormsMap()/
  // persistPlayerForms()/restorePlayerForms() since simulation/
  // seasonEngine.js and data/playerDatabase.js already call them by
  // those names for save/load.
  function collectPlayerFormsMap() {
    const map = {};
    allTeams.forEach(t => (t.players || []).forEach(p => {
      if (LIVE_RATINGS.includes(p.liveRating) && p.liveRating !== 'B') {
        map[p.id] = { liveRating: p.liveRating };
      }
    }));
    return map;
  }

  // ===================================================================
  // ===================== OFFSIDE ENGINE ==============================
  // ===================================================================
  // A genuinely spatial read of the offside law instead of a flat dice
  // roll. Every on-pitch player already has an (x,y) position implied by
  // their formation slot (FORMATIONS[key].coords — see js/state.js), with
  // y=92 sitting on a team's own goal line and y≈14-20 at the opposite
  // end. That's converted into a single 0-1 "advancement" value (0 = own
  // goal, 1 = opponent's goal) that's directly comparable between the two
  // sides, since both formations share the same own-goal-at-92 convention.
  // From there the engine reconstructs, for a single passage of play:
  //   - the receiver's position at "the exact moment of the pass" — judged
  //     as a small, mostly-random timing window around the defensive line
  //     itself (not their average formation slot — see evaluateOffside for
  //     why that would over-flag almost every through ball), biased by
  //     pace and off-ball awareness
  //   - the second-last defender's position — the actual legal offside
  //     reference line, almost always the deepest outfield defender and
  //     NOT the goalkeeper
  //   - the goalkeeper's own position, since an advanced/stranded keeper
  //     can itself become the "second-last opponent" instead
  //   - active interference — only a genuine forward pass into space
  //     (chanceType 'throughball') is ever routed through this check in
  //     the first place; backward/square play never is
  //   - rebounds/loose balls and a deliberate defensive touch, both of
  //     which restart the phase of play and clear any prior offside
  //     position under the actual Laws of the Game
  function playerAdvancement(p, formationKey) {
    const formation = FORMATIONS[formationKey] || FORMATIONS['4-3-3'];
    const slot = p.slot || (p.pos || [])[0] || 'CM';
    const idx = formation.slots.indexOf(slot);
    const coord = formation.coords[idx >= 0 ? idx : 0] || [50, 50];
    const y = coord[1];
    return Math.max(0, Math.min(1, (92 - y) / (92 - 14)));
  }
  // The defensive line the officials actually judge against: the second-
  // deepest opponent, expressed on the attacking side's own advancement
  // axis (1 - their own advancement, since the two sides' advancement
  // scales run in opposite physical directions but describe the same
  // pitch). A high press or a chasing team's late push both drag the line
  // higher up the pitch (offside easier to catch); sitting deep pulls it
  // back toward the byline (far harder to catch, at the cost of inviting
  // pressure). Also reports the goalkeeper's own position, since an
  // advanced/stranded keeper can himself become the second-last opponent
  // rather than the usual deepest centre-back.
  function defensiveLineContext(defTeam, defSide) {
    const m = currentMatch;
    const formationKey = defTeam.squad && defTeam.squad.formation;
    const onIds = defSide === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const all = (defTeam.squad && defTeam.squad.all) || [];
    const onPitch = onIds.map(id => all.find(p => p.id === id)).filter(Boolean);
    const gk = onPitch.find(p => (p.slot || (p.pos || [])[0]) === 'GK');
    const outfield = onPitch.filter(p => (p.slot || (p.pos || [])[0]) !== 'GK');
    if (!outfield.length) return { lineShared: 0.78, gkShared: 0.94, gkStranded: false };
    const advs = outfield.map(p => playerAdvancement(p, formationKey)).sort((a, b) => a - b);
    // Deepest outfield defender = smallest advancement = the real offside
    // reference line under the law.
    const deepestOutfield = advs[0];
    const tac = (m.tactics && m.tactics[defSide]) || 'balanced';
    const style = getManagerPlaystyle(defTeam.team);
    const highLineStyle = ['Possession', 'Overload'].includes(style);
    let pushUp = tac === 'press' ? 0.09 : tac === 'attack' ? 0.05 : tac === 'defend' ? -0.07 : 0;
    if (highLineStyle) pushUp += 0.02;
    const lineAdv = Math.max(0.03, Math.min(0.55, deepestOutfield + pushUp));
    const gkAdv = gk ? playerAdvancement(gk, formationKey) : 0.04;
    // A rare sweeper-keeper case: the keeper is sat ahead of the deepest
    // outfield defender, and becomes the offside reference line himself.
    const gkStranded = gkAdv > lineAdv;
    return {
      lineShared: 1 - (gkStranded ? gkAdv : lineAdv),
      gkShared: 1 - gkAdv,
      gkStranded
    };
  }
  // Average Defensive Awareness among the defending side's on-pitch
  // outfield players — the specific attribute for "anticipating attacking
  // movements", which is exactly what holding a disciplined offside line
  // actually is. Used in place of the generic (attack-inclusive) team `def`
  // blend so a back line of genuinely alert defenders plays the trap better
  // than one that's merely physically/technically strong.
  function avgLineDefAwareness(defTeam, defSide) {
    const m = currentMatch;
    const onIds = defSide === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const all = (defTeam.squad && defTeam.squad.all) || [];
    const outfield = onIds.map((id) => all.find((p) => p.id === id)).filter((p) => p && (p.slot || (p.pos || [])[0]) !== 'GK');
    if (!outfield.length) return 70;
    const vals = outfield.map((p) => xattr(p, 'def_awr', p.def || 70));
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  // Core spatial/temporal offside check for a single attacker at "the
  // exact moment of the pass" — used both as a live flag before a chance
  // is even created (through balls / breakaways) and, via the same
  // context, for the post-goal VAR recheck. `moment` distinguishes phases
  // of play the law treats differently:
  //   'throughball' / 'counter' — a genuine forward pass into space; the
  //                                only case actively judged here
  //   'corner' / 'throwin'      — exempt: nobody can be offside receiving
  //                                the ball directly from either
  //   'rebound'                 — exempt: a loose ball off a save/post/bar
  //                                restarts the phase of play
  //   'deflection'              — exempt: a deliberate touch by a defender
  //                                plays the attacker onside regardless of
  //                                their position
  function evaluateOffside(attackingSide, attacker, moment) {
    const m = currentMatch;
    if (!m || !attacker) return { offside: false, checked: false };
    if (moment === 'corner' || moment === 'throwin' || moment === 'rebound' || moment === 'deflection') {
      return { offside: false, checked: false, exempt: true };
    }
    const defSide = attackingSide === 'home' ? 'away' : 'home';
    const attTeam = m[attackingSide], defTeam = m[defSide];
    const ctx = defensiveLineContext(defTeam, defSide);

    // A genuine through-ball run is, by definition, an attempt to arrive
    // right on the defensive line at "the exact moment of the pass" — a
    // player's *typical* formation slot (a striker sits high up the pitch
    // by design) isn't what decides this, or strikers would be given
    // offside on almost every through ball regardless of timing. What
    // actually decides it is a small, mostly-random timing window around
    // that line, biased by pace against the covering defence and, where
    // available, off-the-ball positioning/awareness — a smarter runner
    // times the run to stay just onside; a purely physical one drifts
    // early and gets caught square more often.
    const defAvgPac = calcTeamStrength(defTeam).pac || 70;
    // Timing a run onside is about the explosive first couple of steps
    // (Acceleration), not sustained top speed once already in the clear —
    // blended with a smaller Speed component and scaled down for a tired
    // attacker, same as every other in-match ability read.
    const attackerBurst = (xattr(attacker, 'accel', attacker.pac || 70) * 0.65 + xattr(attacker, 'spd', attacker.pac || 70) * 0.35) * staminaMultiplier(attacker);
    const paceEdge = (attackerBurst - defAvgPac) / 100;
    const awareness = (attacker.expandedAttrs && typeof attacker.expandedAttrs.off_awr === 'number')
      ? (attacker.expandedAttrs.off_awr - 70) / 100 : 0;
    const timing = (seededRandom() - 0.5) * 0.16 - paceEdge * 0.05 - awareness * 0.09;
    const attackerShared = Math.min(1, Math.max(0, ctx.lineShared + timing));

    const margin = attackerShared - ctx.lineShared;
    if (margin <= 0) return { offside: false, checked: true, marginal: margin > -0.04, margin };

    // Discipline of the defensive line itself — a well-organised back line
    // reads the trap and catches a marginal case more often than a shaky
    // one that plays the runner on. Defensive Awareness specifically (not
    // the generic, attack-inclusive `def` blend) is what actually governs
    // holding a coordinated offside line.
    const defDiscipline = avgLineDefAwareness(defTeam, defSide) / 100;
    const catchChance = Math.max(0.08, Math.min(0.85, margin * 4.5 + defDiscipline * 0.15));
    const offside = seededRandom() < catchChance;
    return { offside, checked: true, marginal: margin < 0.05, margin };
  }
  // Applied at the point a through ball / breakaway chance is actually
  // created — checks the spatial model above and, if the flag goes up,
  // ends the passage immediately (no shot, no advantage played), logging
  // it against both the live event feed and the receiver's own offside
  // count. A marginal-but-onside call still gets VAR-style flavor text so
  // genuinely close decisions read as tense rather than routine.
  function checkLiveOffside(attackingSide, attacker, moment) {
    const m = currentMatch;
    const result = evaluateOffside(attackingSide, attacker, moment);
    if (!result.checked) return result;
    if (result.offside) {
      if (!m.playerMatchStats) m.playerMatchStats = {};
      if (!m.playerMatchStats[attacker.id]) m.playerMatchStats[attacker.id] = blankPlayerMatchStats(attacker);
      m.playerMatchStats[attacker.id].offsides = (m.playerMatchStats[attacker.id].offsides || 0) + 1;
      addEvent(m.minute, 'offside', `🚩 Flag up — <span class="player">${attacker.name}</span> caught offside by the last defender`, attackingSide);
    } else if (result.marginal) {
      addEvent(m.minute, 'offside', `Tight call — <span class="player">${attacker.name}</span> ruled level, play continues`, attackingSide);
    }
    return result;
  }

  // ===================================================================
  // ================== FREE-KICK ROUTINES (open play) =================
  // ===================================================================
  // Replaces a single flat "stands over it and shoots" resolution with a
  // genuine choice of routine, shaped by where the foul happened, who's
  // around to take it, and the game state. Corners get equivalent
  // treatment in resolveCorner() (engine/shooting.js).
  function pickFreeKickRoutine(attTeam, closeRange) {
    const hasCrosser = (attTeam.squad.all || []).some(p => hasStyle(p, 'Cross Specialist') || hasStyle(p, 'Prolific Winger') || hasSkill(p, 'Pinpoint Crossing') || hasSkill(p, 'Edged Crossing'));
    const m = currentMatch;
    const diff = m ? (attTeam.score || 0) - (m[attTeam === m.home ? 'away' : 'home'].score || 0) : 0;
    const urgent = m && (m.dispMin != null ? m.dispMin : m.minute) >= 75 && diff < 0;
    const roll = seededRandom();
    if (!closeRange) {
      // Too far out for a direct effort — always a delivery into the box
      // or a short recycle to reset the attack.
      return roll < 0.62 ? 'crossing' : 'short';
    }
    if (urgent && roll < 0.12) return 'quickrestart';
    if (roll < 0.38) return 'direct';
    if (roll < (hasCrosser ? 0.76 : 0.66)) return 'crossing';
    if (roll < 0.87) return 'short';
    return 'indirect';
  }
  function resolveFreeKickRoutine(attackingSide, defendingSide, closeRange) {
    const m = currentMatch;
    if (!m) return;
    const attTeam = m[attackingSide], defTeam = m[defendingSide];
    // Close-range effort calls for the Short Free Kick specialist; a
    // longer-distance dead ball calls for the Long Free Kick specialist
    // (more Kicking Power / Lofted Pass in the formula). Falls back to the
    // generic weighted pick if the designated taker isn't on the pitch.
    const onPitchIds = attackingSide === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const designatedTaker = attTeam.roles && (closeRange ? attTeam.roles.shortFreeKick : attTeam.roles.longFreeKick);
    const taker = (designatedTaker && onPitchIds.includes(designatedTaker.id))
      ? designatedTaker
      : pickPlayer(attTeam, ['CAM', 'CM', 'ST', 'RW', 'LW']);
    if (!taker) return;
    if (!m.playerMatchStats) m.playerMatchStats = {};
    const routine = pickFreeKickRoutine(attTeam, closeRange);

    if (routine === 'direct' || routine === 'quickrestart') {
      const quick = routine === 'quickrestart';
      attTeam.stats.shots++;
      if (!m.playerMatchStats[taker.id]) m.playerMatchStats[taker.id] = blankPlayerMatchStats(taker);
      m.playerMatchStats[taker.id].shots++;
      const fkGk = pickPlayer(defTeam, ['GK']);
      addEvent(m.minute, 'shot', quick
        ? `<span class="player">${taker.name}</span> takes it quickly — the defence isn't set!`
        : `<span class="player">${taker.name}</span> stands over the free-kick...`, attackingSide);
      // A quick restart catches an unorganised wall — a genuinely better
      // sight of goal than a fully set-up direct effort.
      const fk = pickFkOutcome(taker, fkGk, quick ? 0.08 : 0);
      if (fk.scored) {
        attTeam.stats.shotsOn++;
        attTeam.score++;
        recordStat('goals', taker, attTeam.team);
        m.playerMatchStats[taker.id].goals++;
        m.playerMatchStats[taker.id].xg += 0.12 + seededRandom() * 0.1;
        pushGoal(attackingSide, taker, m.minute, fk.text);
        addEvent(m.minute, 'goal', `${emojiImg('goal', 'Goal')} Free-kick goal! <span class="player">${taker.name}</span> — ${fk.text}`, attackingSide, true);
        if (seededRandom() < 0.55) recordStat('puskas', taker, attTeam.team);
        // The taker's own direct shot on goal, not a pass to a team-mate
        // beyond the defence — not an offside-eligible phase of play.
      } else if (fk.saved) {
        attTeam.stats.shotsOn++;
        if (fkGk) {
          defTeam.stats.saves++;
          recordStat('saves', fkGk, defTeam.team);
          if (!m.playerMatchStats[fkGk.id]) m.playerMatchStats[fkGk.id] = blankPlayerMatchStats(fkGk);
          m.playerMatchStats[fkGk.id].saves = (m.playerMatchStats[fkGk.id].saves || 0) + 1;
        }
        addEvent(m.minute, 'save', `🧤 Free-kick from <span class="player">${taker.name}</span> — ${fk.text}`, attackingSide);
      } else {
        addEvent(m.minute, 'miss', `Free-kick from <span class="player">${taker.name}</span> — ${fk.text}`, attackingSide);
        if (fk.wall) resolveCorner(attackingSide);
      }
      return;
    }

    if (routine === 'crossing') {
      // Whipped delivery into the box — resolved like a low-key corner
      // (aerial duel for a specific target), not a guaranteed chance.
      addEvent(m.minute, 'whistle', `<span class="player">${taker.name}</span> whips the free-kick into the box`, attackingSide);
      const crossChance = 0.075 + (hasSkill(taker, 'Pinpoint Crossing') || hasSkill(taker, 'Edged Crossing') ? 0.02 : 0);
      if (seededRandom() < crossChance) {
        const scorer = pickPlayerCustomWeighted(attTeam, ['ST', 'CB', 'CAM'], (p) => aerialSkill(p, false) * 2, taker.id);
        if (scorer) {
          attTeam.stats.shots++; attTeam.stats.shotsOn++; attTeam.score++;
          recordStat('goals', scorer, attTeam.team);
          recordStat('assists', taker, attTeam.team);
          if (!m.playerMatchStats[scorer.id]) m.playerMatchStats[scorer.id] = blankPlayerMatchStats(scorer);
          if (!m.playerMatchStats[taker.id]) m.playerMatchStats[taker.id] = blankPlayerMatchStats(taker);
          m.playerMatchStats[scorer.id].goals++;
          m.playerMatchStats[scorer.id].xg += 0.22 + seededRandom() * 0.15;
          m.playerMatchStats[taker.id].assists++;
          m.playerMatchStats[taker.id].xa += 0.2 + seededRandom() * 0.3;
          pushGoal(attackingSide, scorer, m.minute, 'header from a direct free-kick');
          addEvent(m.minute, 'goal', `Free-kick delivery converted. <span class="player">${scorer.name}</span> heads home`, attackingSide, true);
        }
      } else {
        // Delivery defended — a crowded box gives a sliver of a chance
        // someone in white/red/blue turns it into his own net instead.
        const ogCulprit = pickPlayerCustomWeighted(defTeam, ['CB', 'CDM'], (p) => aerialSkill(p, true) * 2);
        maybeOwnGoal(attackingSide, defendingSide, ogCulprit, 'turns the free-kick delivery into his own net', 0.006);
      }
      return;
    }

    if (routine === 'short') {
      // Short link-up: lay it off to a nearby team-mate, who either shoots
      // from range or slips a genuine forward ball to a runner — the one
      // free-kick routine that's a real offside-eligible phase, since it
      // funnels through resolveChanceCreation() exactly like open play.
      const receiver = pickPlayer(attTeam, ['CM', 'CDM', 'CAM'], taker.id);
      if (!receiver) return;
      addEvent(m.minute, 'pass', `Short routine — <span class="player">${taker.name}</span> rolls it sideways to <span class="player">${receiver.name}</span>`, attackingSide);
      if (seededRandom() < 0.4) resolveChanceCreation(attackingSide, defendingSide, receiver, 'C');
      return;
    }

    // 'indirect' — given for an offence inside the area (offside, an
    // obstruction, or similar). Defenders are allowed to line up right on
    // their own goal-line for this one, so a first-time strike is far more
    // likely to cannon straight into a wall than beat it.
    addEvent(m.minute, 'whistle', `Indirect free-kick to ${attTeam.team.short} — defenders line up on their own goal-line`, attackingSide);
    attTeam.stats.shots++;
    if (!m.playerMatchStats[taker.id]) m.playerMatchStats[taker.id] = blankPlayerMatchStats(taker);
    m.playerMatchStats[taker.id].shots++;
    const layoff = pickPlayer(attTeam, ['CM', 'CAM', 'ST'], taker.id);
    if (seededRandom() < 0.18) {
      const scorer = layoff || taker;
      attTeam.stats.shotsOn++;
      attTeam.score++;
      recordStat('goals', scorer, attTeam.team);
      if (scorer !== taker) recordStat('assists', taker, attTeam.team);
      if (!m.playerMatchStats[scorer.id]) m.playerMatchStats[scorer.id] = blankPlayerMatchStats(scorer);
      m.playerMatchStats[scorer.id].goals++;
      m.playerMatchStats[scorer.id].xg += 0.18 + seededRandom() * 0.1;
      pushGoal(attackingSide, scorer, m.minute, 'first-time strike from an indirect routine');
      addEvent(m.minute, 'goal', `${emojiImg('goal', 'Goal')} Worked short and finished! <span class="player">${scorer.name}</span> converts the indirect routine`, attackingSide, true);
    } else {
      addEvent(m.minute, 'miss', `Blocked by the wall on the line — the indirect routine breaks down`, attackingSide);
      if (seededRandom() < 0.5) resolveCorner(attackingSide);
    }
  }

  // ===================================================================
  // ========================= THROW-INS ================================
  // ===================================================================
  // Three genuine options: a normal throw upfield (can still spring an
  // attack), a long throw hurled straight into the box for a specialist
  // thrower, and a tactical retaining throw that just keeps possession
  // ticking over.
  function resolveThrowIn(side) {
    const m = currentMatch;
    if (!m) return;
    const team = m[side];
    const oppSide = side === 'home' ? 'away' : 'home';
    const thrower = pickPlayer(team, ['RB', 'LB', 'RWB', 'LWB', 'CB']);
    if (!thrower) return;
    const longThrowSpecialist = (thrower.phy || 70) >= 80 || hasStyle(thrower, 'Long Throw') || hasSkill(thrower, 'Long Throws');
    const roll = seededRandom();
    if (longThrowSpecialist && roll < 0.3) {
      addEvent(m.minute, 'whistle', `Long throw hurled into the box by <span class="player">${thrower.name}</span> (${team.team.short})`, side);
      const flickOnChance = 0.035 + (hasSkill(thrower, 'Long Throws') ? 0.01 : 0);
      if (seededRandom() < flickOnChance) {
        const scorer = pickPlayerCustomWeighted(team, ['ST', 'CB', 'CDM'], (p) => aerialSkill(p, false) * 2, thrower.id);
        if (scorer) {
          team.stats.shots++; team.stats.shotsOn++; team.score++;
          recordStat('goals', scorer, team.team);
          if (!m.playerMatchStats) m.playerMatchStats = {};
          if (!m.playerMatchStats[scorer.id]) m.playerMatchStats[scorer.id] = blankPlayerMatchStats(scorer);
          m.playerMatchStats[scorer.id].goals++;
          m.playerMatchStats[scorer.id].xg += 0.16 + seededRandom() * 0.1;
          pushGoal(side, scorer, m.minute, 'header from a long throw');
          addEvent(m.minute, 'goal', `${emojiImg('goal', 'Goal')} Long throw flick-on converted! <span class="player">${scorer.name}</span> heads home`, side, true);
        }
      }
    } else if (roll < (longThrowSpecialist ? 0.55 : 0.7)) {
      addEvent(m.minute, 'pass', `${team.team.short} keep it simple — a short retaining throw down the line`, side);
    } else {
      const receiver = pickPlayer(team, ['CM', 'CAM', 'RM', 'LM', 'ST'], thrower.id);
      if (receiver && seededRandom() < 0.14) {
        resolveChanceCreation(side, oppSide, receiver, seededRandom() < 0.5 ? 'L' : 'R');
      } else {
        addEvent(m.minute, 'whistle', `${team.team.short} throw it long down the line`, side);
      }
    }
  }

  // ===================================================================
  // ========================= GOAL KICKS ================================
  // ===================================================================
  // Short rollout to build from the back (only for a keeper genuinely
  // comfortable on the ball and a side not sat in a defensive block),
  // a medium chip out to midfield, or a long punt contested in the air —
  // the aerial-duel case can spring a genuine second-ball chance.
  function resolveGoalKick(side) {
    const m = currentMatch;
    if (!m) return;
    const team = m[side];
    const oppSide = side === 'home' ? 'away' : 'home';
    const oppTeam = m[oppSide];
    const gk = pickPlayer(team, ['GK']);
    if (!gk) return;
    const tac = (m.tactics && m.tactics[side]) || 'balanced';
    // GK Low Punt sharpens exactly the short/medium distribution this
    // build-from-back check is gating, so a keeper with the skill can
    // credibly play out from the back even without elite raw tec.
    const buildFromBack = ((gk.tec || 70) >= 78 || hasSkill(gk, 'GK Low Punt')) && tac !== 'defend';
    const roll = seededRandom();
    if (!m.playerMatchStats) m.playerMatchStats = {};
    // GK Long Throws: an entirely separate, quicker distribution option
    // straight out of the keeper's hands to a winger, bypassing the
    // punt/rollout choice altogether.
    if (hasSkill(gk, 'GK Long Throws') && roll < 0.18) {
      addEvent(m.minute, 'whistle', `<span class="player">${gk.name}</span> skips the goal-kick and launches a long throw straight down the line`, side);
      if (!m.playerMatchStats[gk.id]) m.playerMatchStats[gk.id] = blankPlayerMatchStats(gk);
      m.playerMatchStats[gk.id].passes = (m.playerMatchStats[gk.id].passes || 0) + 1;
      m.playerMatchStats[gk.id].passesCompleted = (m.playerMatchStats[gk.id].passesCompleted || 0) + 1;
      const receiver = pickPlayer(team, ['RM', 'LM', 'RW', 'LW', 'CM']);
      if (receiver && seededRandom() < 0.16) resolveChanceCreation(side, oppSide, receiver, seededRandom() < 0.5 ? 'L' : 'R');
      return;
    }
    if (buildFromBack && roll < 0.4) {
      addEvent(m.minute, 'pass', `Short rollout from <span class="player">${gk.name}</span> — ${team.team.short} build from the back`, side);
      if (!m.playerMatchStats[gk.id]) m.playerMatchStats[gk.id] = blankPlayerMatchStats(gk);
      m.playerMatchStats[gk.id].passes = (m.playerMatchStats[gk.id].passes || 0) + 1;
      m.playerMatchStats[gk.id].passesCompleted = (m.playerMatchStats[gk.id].passesCompleted || 0) + 1;
    } else if (roll < 0.75) {
      addEvent(m.minute, 'pass', `<span class="player">${gk.name}</span> chips the goal-kick out to midfield`, side);
      // GK Low Punt: a genuinely well-placed medium ball occasionally
      // sticks well enough to spring an immediate chance.
      if (hasSkill(gk, 'GK Low Punt') && seededRandom() < 0.12) {
        const receiver = pickPlayer(team, ['CM', 'CAM'], gk.id);
        if (receiver) resolveChanceCreation(side, oppSide, receiver, 'C');
      }
    } else {
      const target = pickPlayerCustomWeighted(team, ['ST', 'CB'], (p) => aerialSkill(p, false) * 2);
      const defender = pickPlayerCustomWeighted(oppTeam, ['CB'], (p) => aerialSkill(p, true) * 2);
      // GK High Punt: a sharper, more accurate long punt gives the target a
      // genuinely better sight of winning the header, not just a coin-flip
      // against whoever the defence puts up.
      const puntEdge = hasSkill(gk, 'GK High Punt') ? 0.08 : 0;
      const won = target && (!defender || aerialSkill(target, false) + puntEdge + seededRandom() * 0.3 > aerialSkill(defender, true) + seededRandom() * 0.3);
      addEvent(m.minute, 'whistle', (won && target)
        ? `Long punt from <span class="player">${gk.name}</span> — <span class="player">${target.name}</span> wins the aerial duel`
        : `Long punt from <span class="player">${gk.name}</span> — ${oppTeam.team.short} win the header back`, side);
      if (won && target && seededRandom() < 0.1) {
        const receiver = pickPlayer(team, ['CAM', 'CM', 'RW', 'LW'], target.id);
        if (receiver) resolveChanceCreation(side, oppSide, receiver, 'C');
      }
    }
  }

  // ===================================================================
  // ======================== PRE-MATCH ROLES ===========================
  // ===================================================================
  // Assigns real, named players to key match/set-piece duties before
  // kickoff — captain, short/long free-kick takers, penalty taker, left/
  // right corner takers, and the trio of aerial targets sent forward for
  // the team's own corners. Computed once per side (from the starting XI)
  // right after squads are built, using the same expanded-attribute sheet
  // (xattr/hasSkill) every other gameplay hook reads from — every formula
  // below defaults to a neutral rating when a squad has no expanded data,
  // so nothing breaks for a non-enhanced team. Consumed by
  // resolveFreeKickRoutine(), resolveCorner(), the in-game/shootout
  // penalty pickers, and the pre-match lineup display, so the same named
  // player shows up on screen and actually gets sent to take the kick
  // instead of a fresh random pick every time.
  function _roleWeighted(p, weights) {
    if (!p) return -Infinity;
    let score = 0;
    for (const key in weights) score += xattr(p, key, 65) * weights[key];
    return score;
  }

  function _roleSkillBonus(p, skills, amount) {
    if (!p) return 0;
    amount = amount || 5;
    return skills.reduce((sum, s) => sum + (hasSkill(p, s) ? amount : 0), 0);
  }

  function _roleHeightScore(p) {
    const cm = (p && p.expandedAttrs && typeof p.expandedAttrs.height_cm === 'number') ? p.expandedAttrs.height_cm : 178;
    return Math.max(0, Math.min(100, (cm - 165) * 2.2));
  }

  function _roleFoot(p) {
    return (p && p.expandedAttrs && p.expandedAttrs.preferred_foot) || 'Right';
  }

  function _bestForRole(pool, scoreFn, excludeIds) {
    let best = null, bestScore = -Infinity;
    (pool || []).forEach((p) => {
      if (excludeIds && excludeIds.has(p.id)) return;
      const s = scoreFn(p);
      if (s > bestScore) { bestScore = s; best = p; }
    });
    return best;
  }

  // Shared attribute-weight/skill-bonus tables — the single source of
  // truth for both the auto-pick scoring below AND roleFitRating() (the
  // "how good is this player at this role" number shown per-player in the
  // Squad Builder's Match Roles panel), so the two never drift apart.
  // Captain isn't included here since its scoring isn't an attribute
  // blend (see roleFitRating's special case for it).
  const ROLE_ATTR_WEIGHTS = {
    shortFreeKick: { place_kick: 1.0, curl: 0.55, kick_pwr: 0.3, fin: 0.15, 'weak foot': 0.15 },
    longFreeKick: { place_kick: 1.0, curl: 0.55, kick_pwr: 0.55, lofted_pass: 0.3, 'weak foot': 0.15 },
    penalty: { place_kick: 1.0, fin: 0.5, kick_pwr: 0.35, curl: 0.2, 'weak foot': 0.15 },
    leftCorner: { place_kick: 1.0, curl: 0.55, lofted_pass: 0.4, kick_pwr: 0.2, 'weak foot': 0.15 },
    rightCorner: { place_kick: 1.0, curl: 0.55, lofted_pass: 0.4, kick_pwr: 0.2, 'weak foot': 0.15 },
    cornerAtk1: { head: 1.0, jmp: 0.7, phy_con: 0.6, off_awr: 0.35, fin: 0.25 },
    cornerAtk2: { head: 1.0, jmp: 0.7, phy_con: 0.6, off_awr: 0.35, fin: 0.25 },
    cornerAtk3: { head: 1.0, jmp: 0.7, phy_con: 0.6, off_awr: 0.35, fin: 0.25 }
  };
  const ROLE_SKILL_BONUSES = {
    shortFreeKick: ['Knuckle Shot', 'Dipping Shot', 'Chip Shot Control', 'First-time Shot'],
    longFreeKick: ['Long-range Curler', 'Blitz Curler', 'Long Range Shooting', 'Outside Curler'],
    penalty: ['Penalty Specialist'],
    leftCorner: ['Pinpoint Crossing', 'Edged Crossing'],
    rightCorner: ['Pinpoint Crossing', 'Edged Crossing'],
    cornerAtk1: ['Heading', 'Bullet Header', 'Aerial Superiority', 'Aerial Fort'],
    cornerAtk2: ['Heading', 'Bullet Header', 'Aerial Superiority', 'Aerial Fort'],
    cornerAtk3: ['Heading', 'Bullet Header', 'Aerial Superiority', 'Aerial Fort']
  };

  // "How good is this player at this role" — a single 1-99, FIFA-card-style
  // number combining the same attribute weights the auto-picker uses
  // (as a weighted average, so it stays on a familiar 0-100-ish scale
  // regardless of how many attributes feed a given role) with a small
  // flat bump for any of that role's bonus skills. Used purely for
  // display in the Squad Builder — assignMatchRoles()'s own scoring
  // above is unaffected by this normalization.
  function roleFitRating(p, roleKey) {
    if (!p) return null;
    if (roleKey === 'captain') {
      let score = Math.round(p.ovr || 70);
      if (hasSkill(p, 'Captaincy')) score = Math.min(99, score + 8);
      return Math.max(1, Math.min(99, score));
    }
    const weights = ROLE_ATTR_WEIGHTS[roleKey];
    if (!weights) return null;
    let sum = 0, wsum = 0;
    for (const key in weights) { sum += xattr(p, key, 65) * weights[key]; wsum += weights[key]; }
    const base = wsum ? sum / wsum : 0;
    const skills = ROLE_SKILL_BONUSES[roleKey] || [];
    const bonus = skills.reduce((s, sk) => s + (hasSkill(p, sk) ? 3 : 0), 0);
    return Math.max(1, Math.min(99, Math.round(base + bonus)));
  }

  // Computes and returns the full role set for one side (m.home / m.away)
  // straight from its starting XI. Called once per side at match start —
  // never mutates anything on the players themselves.
  function assignMatchRoles(side) {
    const squad = side && side.squad;
    const starting = (squad && squad.starting) || [];
    if (!starting.length) return null;
    const outfield = starting.filter((p) => (p.pos || [])[0] !== 'GK');
    const pool = outfield.length ? outfield : starting;

    // Manual overrides — set from the Squad Builder's Match Roles panel
    // (see sbSetRole()/saveSquadBuilder() in ui/teamUI.js) and carried on
    // squad.manualRoles as { roleKey: playerId }. Any role left unset (or
    // pointing at a player who isn't actually in the starting XI) simply
    // falls through to the same auto-pick logic as before. Corner-box
    // attackers are always auto-picked — there's no manual override for
    // those.
    const manual = (squad && squad.manualRoles) || {};
    const manualPick = (key) => {
      const id = manual[key];
      if (!id) return null;
      return starting.find((p) => p.id === id) || null;
    };

    // Captain — Captaincy is the deciding factor; overall ability is only
    // a tiebreaker when nobody (or several players) carry the trait.
    const captain = manualPick('captain')
      || _bestForRole(starting, (p) => (hasSkill(p, 'Captaincy') ? 500 : 0) + (p.ovr || 70));

    // Short Free Kick — closer-range direct effort: Set Piece Taking
    // leads, Curl/Kicking Power support it, Finishing and weak-foot
    // reliability round it out.
    const shortFreeKick = manualPick('shortFreeKick') || _bestForRole(pool, (p) =>
      _roleWeighted(p, ROLE_ATTR_WEIGHTS.shortFreeKick) + _roleSkillBonus(p, ROLE_SKILL_BONUSES.shortFreeKick, 4));

    // Long Free Kick — same base skill, but Kicking Power and Lofted Pass
    // matter more as the distance to goal grows.
    const longFreeKick = manualPick('longFreeKick') || _bestForRole(pool, (p) =>
      _roleWeighted(p, ROLE_ATTR_WEIGHTS.longFreeKick) + _roleSkillBonus(p, ROLE_SKILL_BONUSES.longFreeKick, 4));

    // Penalty — Set Piece Taking and Finishing lead, Kicking Power and
    // Curl help with placement, Penalty Specialist is a big flat edge.
    const penalty = manualPick('penalty') || _bestForRole(pool, (p) =>
      _roleWeighted(p, ROLE_ATTR_WEIGHTS.penalty)
      + _roleSkillBonus(p, ROLE_SKILL_BONUSES.penalty, 10)
      + _roleSkillBonus(p, ['Chip Shot Control'], 3)) || captain;

    // Corners — Set Piece Taking, Curl and Lofted Pass drive delivery
    // quality; foot preference nudges toward the swing each side naturally
    // produces (a right-footer for an in-swinging left corner, and a
    // left-footer for an in-swinging right corner).
    const cornerBase = (p) => _roleWeighted(p, ROLE_ATTR_WEIGHTS.leftCorner) + _roleSkillBonus(p, ROLE_SKILL_BONUSES.leftCorner, 4);
    const leftCorner = manualPick('leftCorner') || _bestForRole(pool, (p) => cornerBase(p) + (_roleFoot(p) === 'Right' ? 4 : -1));
    const rightCorner = manualPick('rightCorner') || _bestForRole(pool, (p) => cornerBase(p) + (_roleFoot(p) === 'Left' ? 4 : -1));

    // 3 corner-box attackers — the aerial targets pushed forward for the
    // team's own corners: Heading, Jump and Physical Contact lead, Height
    // and Offensive Awareness support, Finishing rounds it out since
    // these are usually the ones getting the actual shot. Each of the
    // three slots (cornerAtk1/2/3) can be manually assigned from the
    // Squad Builder same as any other role — a manual pick fills that
    // slot outright, and any slots left on auto are filled by the best
    // remaining eligible player, highest score first.
    const attackerScore = (p) => _roleWeighted(p, ROLE_ATTR_WEIGHTS.cornerAtk1)
      + _roleHeightScore(p) * 0.15
      + _roleSkillBonus(p, ROLE_SKILL_BONUSES.cornerAtk1, 5);
    const cornerAttackers = [null, null, null];
    const usedIds = new Set();
    ['cornerAtk1', 'cornerAtk2', 'cornerAtk3'].forEach((key, i) => {
      const mp = manualPick(key);
      if (mp && !usedIds.has(mp.id)) { cornerAttackers[i] = mp; usedIds.add(mp.id); }
    });
    for (let i = 0; i < 3; i++) {
      if (cornerAttackers[i]) continue;
      const pick = _bestForRole(pool, attackerScore, usedIds);
      if (!pick) continue;
      cornerAttackers[i] = pick;
      usedIds.add(pick.id);
    }
    const cornerAttackersFinal = cornerAttackers.filter(Boolean);

    return { captain, shortFreeKick, longFreeKick, penalty, leftCorner, rightCorner, cornerAttackers: cornerAttackersFinal };
  }
  // Small HTML badges for the lineup list — captain armband plus icons for
  // whichever set-piece duties this player has been assigned for their
  // side. Purely cosmetic/read-only; safe to call for any player on the
  // sheet, starter or sub.
  function roleBadgesHTML(p, side) {
    const m = currentMatch;
    const roles = m && m[side] && m[side].roles;
    if (!roles || !p) return '';
    let out = '';
    if (roles.captain && roles.captain.id === p.id) out += `<span class="captain-armband" title="Captain">${emojiImg('captain', 'Captain')}</span>`;
    if (roles.penalty && roles.penalty.id === p.id) out += `<span class="li-icon" title="Penalty taker">${emojiImg('penalty_goal', 'Penalty taker')}</span>`;
    const isFk = (roles.shortFreeKick && roles.shortFreeKick.id === p.id) || (roles.longFreeKick && roles.longFreeKick.id === p.id);
    if (isFk) out += `<span class="li-icon" title="Free-kick taker">${emojiImg('freekick', 'Free-kick taker')}</span>`;
    const isLeftCk = roles.leftCorner && roles.leftCorner.id === p.id;
    const isRightCk = roles.rightCorner && roles.rightCorner.id === p.id;
    if (isLeftCk) out += `<span class="li-icon" title="Left corner taker">${emojiImg('left_corner', 'Left corner taker')}</span>`;
    if (isRightCk) out += `<span class="li-icon" title="Right corner taker">${emojiImg('right_corner', 'Right corner taker')}</span>`;
    const isCa = (roles.cornerAttackers || []).some((cp) => cp && cp.id === p.id);
    if (isCa) out += `<span class="li-icon" title="Corner-box attacker">${emojiImg('corner_attacker', 'Corner-box attacker')}</span>`;
    return out;
  }
  function formationShape(formationKey) {
    const key = formationKey || '4-3-3';
    if (formationShapeCache[key]) return formationShapeCache[key];
    const formation = FORMATIONS[key] || FORMATIONS['4-3-3'];
    let def = 0, fwd = 0, mid = 0;
    formation.slots.forEach(s => {
      if (s === 'GK') return;
      def += SHAPE_DEF_WEIGHT[s] || 0;
      fwd += SHAPE_FWD_WEIGHT[s] || 0;
      mid += SHAPE_MID_WEIGHT[s] || 0;
    });
    const shape = { def, fwd, mid };
    formationShapeCache[key] = shape;
    return shape;
  }
  // How many natural wide bodies (wing-backs / wide mids / wingers) a
  // formation puts on the pitch — used alongside formationShape() to match
  // a formation to a manager's style preference (Out Wide/Overload want
  // width; narrower diamonds/back-threes-without-wing-backs don't offer it).
  function formationWideCount(formationKey) {
    const formation = FORMATIONS[formationKey] || FORMATIONS['4-3-3'];
    return formation.slots.filter(s => WIDE_SLOTS.has(s)).length;
  }

  function lineOf(p) {
    if (!p) return 'MID';
    const slot = p.slot || (p.pos || [])[0] || 'CM';
    return POS_LINE[slot] || 'MID';
  }

  // ===================================================================
  // ============ FORMATION/SUBSTITUTION POSITIONAL FIT =================
  // ===================================================================
  // A real bipartite matching (Kuhn's algorithm with augmenting paths),
  // not just a greedy best-fit pass — so "can this squad actually fill
  // this formation" is answered correctly even when a greedy slot-by-slot
  // assignment would wrongly claim it can't (or silently strand someone
  // in a slot they're not compatible with). n is at most ~11 here, so
  // this is effectively instant.
  //
  // Preferring each player's exact position first (slotOrderFor) doesn't
  // change *whether* a full matching exists, only which valid matching we
  // land on — so results still read as natural fits rather than an
  // arbitrary technically-legal shuffle.
  function slotOrderFor(player, slots) {
    const order = slots.map((slot, i) => ({ i, slot }));
    order.sort((a, b) => {
      const aFit = (player.pos || []).includes(a.slot) ? 1 : 0;
      const bFit = (player.pos || []).includes(b.slot) ? 1 : 0;
      return bFit - aFit;
    });
    return order;
  }

  // Returns an array (indexed by slot position) of player indices forming
  // a complete, fully position-compatible assignment of `players` onto
  // `formKey`'s slots — or null if no such complete assignment exists.
  function matchPlayersToFormation(players, formKey) {
    const formation = FORMATIONS[formKey];
    if (!formation) return null;
    const slots = formation.slots;
    if (!players || !players.length || players.length > slots.length) return null;
    const slotToPlayer = new Array(slots.length).fill(-1);

    function tryAssign(playerIdx, visited) {
      const order = slotOrderFor(players[playerIdx], slots);
      for (const entry of order) {
        const s = entry.i, slot = entry.slot;
        if (visited.has(s)) continue;
        if (!canPlay(players[playerIdx], slot)) continue;
        visited.add(s);
        if (slotToPlayer[s] === -1 || tryAssign(slotToPlayer[s], visited)) {
          slotToPlayer[s] = playerIdx;
          return true;
        }
      }
      return false;
    }

    for (let i = 0; i < players.length; i++) {
      const visited = new Set();
      if (!tryAssign(i, visited)) return null;
    }
    return slotToPlayer;
  }

  // Whether `players` (typically the 11 currently on the pitch) can all be
  // placed somewhere they're actually comfortable in `formKey` — the gate
  // changeFormationLive() checks before ever applying a reshape, so a
  // manager (AI or human) never switches into a shape that would strand
  // one of their own players out of position.
  function canFormationFitSquad(players, formKey) {
    return matchPlayersToFormation(players, formKey) !== null;
  }

  // Where an incoming substitute should actually line up. Prefers the
  // exact slot the outgoing player vacated (the normal like-for-like
  // case), but only if the sub is genuinely comfortable there — a
  // deliberate tactical swap (attacker on for a defender, or vice versa)
  // or a forced emergency sub should never leave the incoming player
  // parked in a position they can't play. Falls back to their own
  // natural position if it's part of the current formation, then to any
  // formation slot they can play, and only as an absolute last resort to
  // their natural position anyway (better than nothing when even the
  // formation's own slot list has no fit — e.g. a badly thinned-out bench).
  // `occupantPlayers` is everyone else currently on the pitch for this side
  // (i.e. excluding the outgoing player, who's leaving, and the incoming
  // sub, who doesn't have a slot yet) — used to make sure the slot handed
  // back is actually still free. Without this, a sub whose natural/fallback
  // slot was already held by an existing teammate (e.g. a second player
  // both tagged 'CB' because the formation only has one open CB berth)
  // ended up rendered nowhere near where they were actually subbed on:
  // renderPitch()'s slot lookup can only match one player per named slot,
  // so the loser of that collision gets swept into whichever slot is still
  // empty — usually the very one this player just vacated — which is what
  // made a defender look like they'd been sent on up front, or a forward
  // like they'd dropped into the back line.
  function pickSlotForIncomingSub(inPlayer, formationKey, outSlot, occupantPlayers) {
    const formation = FORMATIONS[formationKey] || FORMATIONS['4-3-3'];
    const occupied = {};
    (occupantPlayers || []).forEach((p) => {
      if (p && p.slot) occupied[p.slot] = (occupied[p.slot] || 0) + 1;
    });
    const slotCounts = {};
    formation.slots.forEach((s) => { slotCounts[s] = (slotCounts[s] || 0) + 1; });
    const isFree = (s) => (occupied[s] || 0) < (slotCounts[s] || 0);

    if (outSlot && canPlay(inPlayer, outSlot) && isFree(outSlot)) return outSlot;
    const natural = (inPlayer.pos || [])[0];
    if (natural && formation.slots.includes(natural) && isFree(natural)) return natural;
    const compatSlot = formation.slots.find(s => canPlay(inPlayer, s) && isFree(s));
    if (compatSlot) return compatSlot;
    // Nothing both comfortable and free — the vacated slot is still the
    // least-bad landing spot (it's the one guaranteed to actually be open),
    // even if the incoming player isn't a natural fit for it.
    return outSlot || natural || 'CM';
  }


  // ========== MANAGER PLAYSTYLES ==========
  // If a team's manager has "playstyle" set in teams.json (and it's one of the
  // names below) that's used as-is; otherwise a random one is assigned once
  // when team data loads and cached onto team.manager.playstyle so it stays
  // consistent for the rest of the session.
  const PLAYSTYLES = ['Long Ball', 'Possession', 'Long Ball Counter', 'Overload', 'Quick Counter', 'Out Wide'];

  // Gameplay effect of each playstyle. These are deliberately modest nudges —
  // enough to give each style a distinct identity over 90 minutes/a season
  // without letting any one style dominate results outright.
  //   attBonus/defBonus   — flat nudge to calcTeamStrength() att/def
  //   passVolMult         — multiplies a team's per-minute pass volume
  //   passAccDelta        — flat nudge to individual pass success rate
  //   possBias            — pts nudge toward/away from more of the ball
  //   wingBiasMult        — multiplies wide players' (RB/LB/RWB/LWB/RM/LM/RW/LW) share of passing/attacking involvement
  //   counterBonus        — nudge to attacking-creation strength that rewards this team when they're defending, i.e. breaking quickly
  const PLAYSTYLE_MODS = {
    'Long Ball':          { attBonus: 1.5,  defBonus: -0.5, passVolMult: 0.82, passAccDelta: -0.045, possBias: -4, wingBiasMult: 1.0,  counterBonus: 0.4 },
    'Possession':         { attBonus: -0.5, defBonus: 1.0,  passVolMult: 1.20, passAccDelta: 0.035,  possBias: 6,  wingBiasMult: 1.0,  counterBonus: -0.6 },
    'Long Ball Counter':  { attBonus: 0.5,  defBonus: 0.5,  passVolMult: 0.80, passAccDelta: -0.03,  possBias: -5, wingBiasMult: 1.0,  counterBonus: 1.4 },
    'Overload':           { attBonus: 1.0,  defBonus: -0.8, passVolMult: 1.05, passAccDelta: 0.0,    possBias: 2,  wingBiasMult: 1.35, counterBonus: 0.1 },
    'Quick Counter':      { attBonus: 0.8,  defBonus: 0.2,  passVolMult: 0.94, passAccDelta: -0.01,  possBias: -2, wingBiasMult: 1.1,  counterBonus: 1.6 },
    'Out Wide':           { attBonus: 0.5,  defBonus: -0.2, passVolMult: 1.0,  passAccDelta: 0.0,    possBias: 1,  wingBiasMult: 1.4,  counterBonus: 0.2 }
  };
  const WIDE_SLOTS = new Set(['RB','LB','RWB','LWB','RM','LM','RW','LW']);

  // Which formation "shape" each manager identity gravitates toward, used by
  // pickTeamFormation() below so a Long Ball manager's team actually lines up
  // differently from a Possession side's, instead of formation being a pure
  // cosmetic hash of the team name.
  //   fwd/def  — how much this style values a formation weighted toward
  //              attacking vs defensive bodies (see formationShape())
  //   wide     — how much it values natural width (wing-backs/wide mids)
  //   mid      — how much it values a numbers-up central midfield
  const PLAYSTYLE_FORM_PREF = {
    'Long Ball':          { fwd: 0.5, def: 1.1, wide: 0.3, mid: 0.3 },
    'Long Ball Counter':  { fwd: 0.6, def: 1.0, wide: 0.4, mid: 0.3 },
    'Quick Counter':      { fwd: 0.7, def: 0.9, wide: 0.5, mid: 0.4 },
    'Possession':         { fwd: 0.5, def: 0.7, wide: 0.3, mid: 1.1 },
    'Overload':           { fwd: 0.9, def: 0.4, wide: 1.3, mid: 0.5 },
    'Out Wide':           { fwd: 0.7, def: 0.5, wide: 1.4, mid: 0.4 }
  };


  // Resolves (and caches) a team's manager playstyle. If teams.json already
  // set a valid manager.playstyle it's kept as-is; otherwise a random one is
  // picked once and stored on the manager object so every part of the UI
  // that reads team.manager.playstyle agrees for the rest of the session.
  function getManagerPlaystyle(team) {
    if (!team) return PLAYSTYLES[0];
    if (!team.manager) team.manager = {};
    if (!PLAYSTYLES.includes(team.manager.playstyle)) {
      team.manager.playstyle = PLAYSTYLES[Math.floor(seededRandom() * PLAYSTYLES.length)];
    }
    return team.manager.playstyle;
  }

  function getPlaystyleMods(team) {
    return PLAYSTYLE_MODS[getManagerPlaystyle(team)] || PLAYSTYLE_MODS['Possession'];
  }

  // ========== EXPANDED PLAYER ATTRIBUTES (player-attributes.json) ==========
  // Optional, per-player override: when player-attributes.json has an entry
  // for a player's id, that entry's much more detailed attribute sheet (25+
  // individual ratings, a set of individual playstyle tags, GK-specific
  // ratings, etc.) is used to derive that player's five gameplay stats
  // (att/def/pac/phy/tec) and overall — completely replacing whatever
  // teams.json had for that player. Everyone else is untouched.

  // Position group -> how much each of the 5 gameplay stats counts toward
  // that group's overall, weights sum to 1 per row. Mirrors a standard
  // FIFA/eFootball-style positional overall calc.
  const ATTR_POS_WEIGHTS = {
    GK:       { def: 0.55, tec: 0.20, phy: 0.15, pac: 0.05, att: 0.05 },
    CB:       { def: 0.45, phy: 0.25, tec: 0.15, pac: 0.10, att: 0.05 },
    FB:       { def: 0.28, pac: 0.27, tec: 0.20, phy: 0.15, att: 0.10 },
    CDM:      { def: 0.35, tec: 0.25, phy: 0.20, pac: 0.10, att: 0.10 },
    CM:       { tec: 0.30, def: 0.20, phy: 0.20, pac: 0.15, att: 0.15 },
    CAM:      { tec: 0.30, att: 0.30, pac: 0.20, phy: 0.10, def: 0.10 },
    WIDE_MID: { pac: 0.28, tec: 0.25, att: 0.25, phy: 0.12, def: 0.10 },
    WINGER:   { pac: 0.30, att: 0.28, tec: 0.25, phy: 0.10, def: 0.07 },
    FWD:      { att: 0.45, pac: 0.20, tec: 0.20, phy: 0.15, def: 0.00 }
  };
  function attrPosGroup(posArr) {
    const p = canonPos((posArr && posArr[0]) || 'CM');
    if (p === 'GK') return 'GK';
    if (p === 'CB') return 'CB';
    if (['RB', 'LB', 'RWB', 'LWB'].includes(p)) return 'FB';
    if (p === 'CDM') return 'CDM';
    if (p === 'CM') return 'CM';
    if (p === 'CAM') return 'CAM';
    if (['RM', 'LM'].includes(p)) return 'WIDE_MID';
    if (['RW', 'LW'].includes(p)) return 'WINGER';
    if (p === 'ST') return 'FWD';
    return 'CM';
  }

  // The full set of individual (eFootball-style) player playstyle tags
  // usable in player-attributes.json, with the human-readable description
  // shown as a tooltip wherever a playstyle tag is rendered in the UI.
  const PLAYSTYLE_DESCRIPTIONS = {
    'Goal Poacher':          'A striker who constantly looks to run behind the defensive line and attack scoring positions.',
    'Fox in the Box':        'A penalty-box specialist who focuses on finding space and finishing chances inside the area.',
    'Target Man':            'A striker who uses strength and positioning to receive the ball and bring teammates into play.',
    'Deep-Lying Forward':    'Drops deeper to receive the ball and create opportunities rather than constantly staying on the defensive line.',
    'Dummy Runner':          'Makes decoy runs to drag defenders away and create space for teammates.',
    'Creative Playmaker':    'Moves intelligently to receive the ball, create chances, and link attacks.',
    'Hole Player':           'Makes aggressive late runs into the box to exploit spaces and score.',
    'Classic No. 10':        'A traditional playmaker who stays relatively central and focuses on passing and creativity.',
    'Prolific Winger':       'Stays wide, attacks the flank, and frequently cuts inside or delivers crosses.',
    'Cross Specialist':      'Positions himself wide and prioritizes delivering accurate crosses into the box.',
    'Roaming Flank':         'Frequently leaves the wing and moves into central areas to participate in attacks.',
    'Inside Forward':        'Starts from a wide position but aggressively cuts inside toward goal.',
    'Box-to-Box':            'Constantly contributes at both ends of the pitch, covering large areas throughout the match.',
    'Destroyer':             'Aggressively presses, tackles, and challenges opponents to win possession.',
    'Anchor Man':            'Holds his defensive position in front of the back line and provides defensive stability.',
    'Orchestrator':          'Controls the tempo from deeper areas through intelligent positioning and passing.',
    'Build Up':              'A defender who drops into good positions and helps initiate attacks from the back.',
    'Extra Frontman':        'A defender who frequently moves forward and joins the attack when opportunities arise.',
    'Offensive Full-back':   'A full-back who aggressively pushes forward to support attacks and provide width.',
    'Full-back Finisher':    'A full-back who makes attacking runs into dangerous areas and can arrive in scoring positions.',
    'Offensive Goalkeeper':  'Proactively comes off his line to sweep up through balls and support a high defensive line.',
    'Defensive Goalkeeper':  'Stays closer to his goal and prioritizes traditional shot-stopping and positioning.'
  };

  // Individual eFootball-style playstyle tag -> which team manager
  // playstyles (see PLAYSTYLES above) it's naturally suited to. Shown in
  // the player profile UI (see ui/playerUI.js) as a "fits the setup" tag
  // so it still reads as useful context, but it no longer feeds an overall
  // or attribute boost — a player's rating is the same regardless of which
  // manager they're playing under.
  const PLAYSTYLE_AFFINITY = {
    'Goal Poacher':          ['Quick Counter', 'Long Ball Counter'],
    'Fox in the Box':        ['Overload', 'Quick Counter'],
    'Target Man':            ['Long Ball', 'Long Ball Counter'],
    'Deep-Lying Forward':    ['Possession'],
    'Dummy Runner':          ['Overload', 'Quick Counter'],
    'Creative Playmaker':    ['Possession', 'Overload'],
    'Hole Player':           ['Overload', 'Possession'],
    'Classic No. 10':        ['Possession'],
    'Prolific Winger':       ['Out Wide', 'Overload'],
    'Cross Specialist':      ['Out Wide'],
    'Roaming Flank':         ['Out Wide', 'Overload'],
    'Inside Forward':        ['Out Wide', 'Quick Counter'],
    'Box-to-Box':            ['Overload', 'Quick Counter'],
    'Destroyer':             ['Long Ball Counter', 'Quick Counter'],
    'Anchor Man':            ['Possession', 'Long Ball Counter'],
    'Orchestrator':          ['Possession'],
    'Build Up':              ['Possession','Long Ball Counter'],
    'Extra Frontman':        ['Overload', 'Long Ball'],
    'Offensive Full-back':   ['Overload', 'Out Wide'],
    'Defensive Full-back': ['Overload','Long Ball Counter'],
    'Full-back Finisher':    ['Overload', 'Out Wide'],
    'Offensive Goalkeeper':  ['Possession', 'Overload'],
    'Defensive Goalkeeper':  ['Long Ball Counter', 'Quick Counter']
  };

  // Flat nudges applied to a player's derived att/def/pac/phy/tec once
  // their raw ratings have been averaged (see deriveStatsFromAttributes
  // below) — this is what stops every player who plays the same position
  // from converging on the same generic profile. Each playstyle pulls the
  // final 5-stat blend in a distinct direction (small, deliberately modest
  // nudges, summed across every tag a player has, then clamped 1-99).
  const PLAYSTYLE_STAT_MODS = {
    'Goal Poacher':          { att: 3,  pac: 2,  def: -2 },
    'Fox in the Box':        { att: 3,  tec: 1,  pac: -1 },
    'Target Man':            { phy: 3,  att: 1,  pac: -2 },
    'Deep-Lying Forward':    { tec: 3,  att: -1 },
    'Dummy Runner':          { pac: 2,  phy: 1,  att: -1 },
    'Creative Playmaker':    { tec: 3,  att: 1,  phy: -1 },
    'Hole Player':           { att: 2,  pac: 2,  def: -1 },
    'Classic No. 10':        { tec: 3,  def: -1 },
    'Prolific Winger':       { pac: 2,  att: 2,  def: -1 },
    'Cross Specialist':      { tec: 2,  pac: 1,  def: -1 },
    'Roaming Flank':         { tec: 2,  pac: 1 },
    'Inside Forward':        { att: 3,  pac: 1,  def: -1 },
    'Box-to-Box':            { phy: 2,  tec: 1,  def: 1 },
    'Destroyer':             { def: 3,  phy: 1,  tec: -1 },
    'Anchor Man':            { def: 3,  tec: 1,  pac: -1 },
    'Orchestrator':          { tec: 3,  def: 1,  pac: -1 },
    'Build Up':              { tec: 2,  def: 1 },
    'Extra Frontman':        { att: 2,  phy: 1,  def: -1 },
    'Offensive Full-back':   { pac: 2,  att: 1,  def: -1 },
    'Defensive Full-back':  { pac: 2,  att: -1,  def: 1 },
    'Full-back Finisher':    { att: 3,  pac: 1,  def: -1 },
    'Offensive Goalkeeper':  { pac: 2,  tec: 2,  def: -1 },
    'Defensive Goalkeeper':  { def: 3,  phy: 1 }
  };

  // Which raw expanded-attribute ratings define each individual playstyle's
  // "signature" traits. A player whose signature attributes for their own
  // playstyle(s) run hotter than their attribute sheet on average gets a
  // bigger push toward their overall than a generic 5-stat blend would give
  // them — see styleSignatureBonus() below.
  const PLAYSTYLE_KEY_ATTRS = {
    'Goal Poacher':          ['off_awr', 'ball_con', 'tight_pos', 'fin', 'spd', 'accel', 'bal'],
    'Fox in the Box':        ['off_awr', 'tight_pos', 'fin', 'ball_con', 'head', 'bal', 'accel'],
    'Target Man':            ['off_awr', 'tight_pos', 'fin', 'head', 'phy_con', 'bal', 'ball_con'],
    'Deep-Lying Forward':    ['off_awr', 'ball_con', 'tight_pos', 'low_pass', 'fin', 'place_kick', 'phy_con'],
    'Dummy Runner':          ['off_awr', 'spd', 'accel', 'stam', 'bal', 'tight_pos'],
    'Creative Playmaker':    ['ball_con', 'dribb', 'tight_pos', 'low_pass', 'lofted_pass', 'place_kick', 'curl'],
    'Hole Player':           ['off_awr', 'tight_pos', 'fin', 'spd', 'accel', 'stam', 'bal'],
    'Classic No. 10':        ['ball_con', 'tight_pos', 'low_pass', 'lofted_pass', 'place_kick', 'curl', 'fin'],
    'Prolific Winger':       ['off_awr', 'ball_con', 'dribb', 'tight_pos', 'spd', 'accel', 'curl'],
    'Cross Specialist':      ['off_awr', 'ball_con', 'low_pass', 'lofted_pass', 'curl', 'spd', 'stam'],
    'Roaming Flank':         ['off_awr', 'ball_con', 'dribb', 'tight_pos', 'low_pass', 'spd', 'stam'],
    'Inside Forward':        ['off_awr', 'ball_con', 'dribb', 'tight_pos', 'fin', 'spd', 'accel'],
    'Box-to-Box':            ['off_awr', 'def_awr', 'def_eng', 'stam', 'spd', 'accel', 'bal', 'phy_con'],
    'Destroyer':             ['def_awr', 'def_eng', 'tack', 'aggr', 'phy_con', 'spd', 'stam'],
    'Anchor Man':            ['def_awr', 'def_eng', 'tack', 'aggr', 'phy_con', 'ball_con', 'low_pass'],
    'Orchestrator':          ['ball_con', 'tight_pos', 'low_pass', 'lofted_pass', 'place_kick', 'curl', 'stam'],
    'Build Up':              ['def_awr', 'ball_con', 'low_pass', 'lofted_pass', 'tight_pos', 'phy_con'],
    'Extra Frontman':        ['def_awr', 'off_awr', 'def_eng', 'tack', 'aggr', 'fin', 'stam'],
    'Offensive Full-back':   ['off_awr', 'spd', 'accel', 'stam', 'low_pass', 'lofted_pass'],
    'Defensive Full-back':   ['def_awr', 'spd', 'accel', 'stam', 'def_eng', 'phy_con'],
    'Full-back Finisher':    ['off_awr', 'fin', 'spd', 'accel', 'dribb', 'ball_con', 'stam'],
    'Offensive Goalkeeper':  ['gk_awr', 'gk_reflex', 'gk_reach', 'gk_parry', 'spd', 'accel', 'ball_con'],
    'Defensive Goalkeeper':  ['gk_awr', 'gk_catch', 'gk_parry', 'gk_reflex', 'gk_reach', 'jmp', 'phy_con']
  };
  // Every raw numeric rating that can appear on an expanded attribute
  // sheet, in display order, grouped for the player-profile UI. GK ratings
  // only render for goalkeepers; outfield ratings only render for outfield
  // players (see expandedAttrRowsHTML below).
  const EXPANDED_ATTR_GROUPS = [
    { label: 'Offense', keys: [
      ['off_awr', 'Off. Awareness'], ['fin', 'Finishing'], ['head', 'Heading'],
      ['place_kick', 'Place Kicking'], ['kick_pwr', 'Kicking Power']
    ] },
    { label: 'Ball Skills', keys: [
      ['ball_con', 'Ball Control'], ['dribb', 'Dribbling'], ['tight_pos', 'Tight Poss.'],
      ['low_pass', 'Low Pass'], ['lofted_pass', 'Lofted Pass'], ['curl', 'Curl']
    ] },
    { label: 'Physical', keys: [
      ['spd', 'Speed'], ['accel', 'Acceleration'], ['stam', 'Stamina'],
      ['phy_con', 'Physical Contact'], ['bal', 'Balance'], ['jmp', 'Jump']
    ] },
    { label: 'Defense', keys: [
      ['def_awr', 'Def. Awareness'], ['def_eng', 'Def. Engagement'], ['tack', 'Tackling'], ['aggr', 'Aggression']
    ] },
    { label: 'Goalkeeping', keys: [
      ['gk_awr', 'GK Awareness'], ['gk_catch', 'GK Catch'], ['gk_parry', 'GK Parry'],
      ['gk_reflex', 'GK Reflexes'], ['gk_reach', 'GK Reach']
    ] }
  ];
  // Average of every numeric raw rating a player's sheet actually has
  // (GK ratings only count for keepers, so a keeper's sheet isn't dragged
  // down by outfield-only zeros and vice versa) — the baseline that a
  // playstyle's signature attributes are compared against.
  // player-attributes.json is hand-authored, and playstyle tags get typed
  // inconsistently just like skill names do ("Fox In The Box" instead of
  // "Fox in the Box", "goal poacher" instead of "Goal Poacher", etc). Every
  // playstyle-driven bonus below — PLAYSTYLE_STAT_MODS, PLAYSTYLE_KEY_ATTRS,
  // the signature-attribute bonus —
  // is a plain exact-string lookup, so a casing/spacing mismatch doesn't
  // error, it just silently matches nothing and that player quietly loses
  // their entire playstyle-driven bonus stack. normalizePlayerPlaystyleTags
  // rewrites every entry's playstyle array to its canonical spelling once,
  // right when the JSON loads (see ui/matchUI.js), so every lookup below
  // can stay a simple exact match and still always resolve correctly.
  function normPlaystyleKey(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  const PLAYSTYLE_CANON_MAP = (() => {
    const map = {};
    Object.keys(PLAYSTYLE_DESCRIPTIONS).forEach((name) => { map[normPlaystyleKey(name)] = name; });
    return map;
  })();
  function canonPlaystyleTag(raw) {
    const key = normPlaystyleKey(raw);
    return PLAYSTYLE_CANON_MAP[key] || raw;
  }
  function normalizePlayerPlaystyleTags(attrData) {
    if (!attrData) return;
    Object.keys(attrData).forEach((id) => {
      const entry = attrData[id];
      if (entry && Array.isArray(entry.playstyle)) {
        entry.playstyle = entry.playstyle.map(canonPlaystyleTag);
      }
    });
  }
  function attrSheetAverage(attr, isGK) {
    const outfieldKeys = ['off_awr','ball_con','tight_pos','fin','spd','accel','bal','head','phy_con',
      'low_pass','place_kick','stam','dribb','lofted_pass','curl','def_awr','def_eng','tack','aggr','jmp','kick_pwr'];
    const gkKeys = ['gk_awr','gk_catch','gk_parry','gk_reflex','gk_reach','spd','accel','bal','phy_con','stam','jmp'];
    const keys = isGK ? gkKeys : outfieldKeys;
    const nums = keys.map(k => attr[k]).filter(v => typeof v === 'number');
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 65;
  }
  // The core "signature attributes push overall up" rule: for each
  // playstyle tag a player has, compare the average of that style's key
  // attributes against the player's own sheet average. Only positive gaps
  // count (a style whose key attributes are actually average or below
  // gives no bonus) and each style's contribution is amplified well beyond
  // the flat +1..+3 PLAYSTYLE_STAT_MODS nudge, so a player built around
  // their style's signature attributes reads as meaningfully better than
  // a same-position player with a flatter, generic spread — even at the
  // same rough attribute total. Multiple matching styles stack, capped so
  // it stays a strong-but-bounded identity bonus rather than unbounded.
  function styleSignatureBonus(attr, styles, isGK) {
    if (!styles || !styles.length) return 0;
    const sheetAvg = attrSheetAverage(attr, isGK);
    let bonus = 0;
    styles.forEach((style) => {
      const keys = PLAYSTYLE_KEY_ATTRS[style];
      if (!keys || !keys.length) return;
      const vals = keys.map(k => attr[k]).filter(v => typeof v === 'number');
      if (!vals.length) return;
      const keyAvg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const gap = keyAvg - sheetAvg;
      if (gap > 0) bonus += gap * 0.55;
    });
    return Math.max(0, Math.min(14, Math.round(bonus)));
  }



  // True if a player's expanded sheet carries the given individual
  // playstyle tag. Used throughout the match-engine "edge" functions below
  // so specific styles diversify in-match behaviour, not just derived stats.
  function hasStyle(p, styleName) {
    return !!(p && p.expandedAttrs && (p.expandedAttrs.playstyle || []).includes(styleName));
  }

  // Returns one random flavor line from the first of the player's playstyle
  // tags that has an entry in the given map, or null if none match. This is
  // how playstyles diversify match commentary itself — not just numbers —
  // every context below (dribbles, through balls, tackles, off-the-ball
  // movement, goals) picks its wording partly from *which* style the player
  // on the ball actually has.
  function styleFlavor(p, map) {
    if (!p || !p.expandedAttrs) return null;
    const styles = p.expandedAttrs.playstyle || [];
    for (let i = 0; i < styles.length; i++) {
      const bank = map[styles[i]];
      if (bank && bank.length) return bank[Math.floor(seededRandom() * bank.length)];
    }
    return null;
  }

  // What a player does immediately *after* beating their man with a skill
  // move — this is where individual playstyle turns a generic "dribbles
  // past" into a distinct passage of play per role.
  const DRIBBLE_FOLLOWUP = {
    'Prolific Winger':      ['then whips a cross in first time', 'before floating a ball across the six-yard box'],
    'Cross Specialist':     ['and immediately looks up for a cross', 'before whipping one into the danger area'],
    'Inside Forward':       ['then cuts inside onto his favoured foot', 'and drives infield looking for the shot'],
    'Roaming Flank':        ['before drifting inside to keep the move going', 'then picks out a pass through the middle'],
    'Goal Poacher':         ['then bursts into the box for the return', 'and darts across his marker looking for space'],
    'Fox in the Box':       ['and spins into the six-yard box', 'before checking his run at the near post'],
    'Hole Player':          ['before arriving late into the box', 'and times a run beyond the last defender'],
    'Creative Playmaker':   ['before threading a pass through the lines', 'and picks out a teammate with the outside of the boot'],
    'Classic No. 10':       ['before slipping a clever ball through', 'and takes a touch to pick his pass'],
    'Dummy Runner':         ['before checking away to drag a marker with him', 'and peels off to open a passing lane'],
    'Box-to-Box':           ['before driving forward with the ball', 'and carries it thirty yards up the pitch'],
    'Deep-Lying Forward':   ['before laying it off and continuing the move', 'and drops deep again looking for the next pass'],
    'Orchestrator':         ['before recycling it and resetting the attack', 'and slows the tempo back down'],
    'Offensive Full-back':  ['before overlapping down the line', 'and gets to the byline looking for a cutback'],
    'Full-back Finisher':   ['before arriving late into the box himself', 'and keeps running into a scoring position']
  };
  // Through-ball / defence-splitting pass flavor by the passer's playstyle.
  const THROUGH_BALL_FLAVOR = {
    'Creative Playmaker':   ['reads the game a yard ahead of everyone and threads a defence-splitting ball into the channel'],
    'Classic No. 10':       ['waits, then slides a perfectly weighted ball through the lines'],
    'Orchestrator':         ['dictates the tempo before releasing a pass through the channel'],
    'Deep-Lying Forward':   ['drops deep to collect, then spins a first-time pass in behind'],
    'Dummy Runner':         ['drags a marker away before slipping the ball into the space he vacated']
  };
  // Tackle-and-win flavor by the defender's playstyle.
  const TACKLE_FLAVOR = {
    'Destroyer':            ['throws himself into a crunching challenge and comes away with the ball'],
    'Anchor Man':           ['reads the danger early and snuffs it out with a perfectly timed tackle'],
    'Box-to-Box':           ['recovers back at full sprint to make a vital tackle on the edge of the box'],
    'Build Up':             ['steps in calmly to win the ball back before it becomes a problem']
  };
  // Interception flavor by the defender's playstyle.
  const INTERCEPTION_FLAVOR = {
    'Destroyer':            ['pounces to intercept, snapping into the passing lane'],
    'Anchor Man':           ['reads the pass superbly and steps in front of his man to intercept'],
    'Orchestrator':         ['anticipates the pass and cuts it out before it develops'],
    'Build Up':             ['calmly intercepts and immediately looks to start a move of his own']
  };
  // "Keeps possession ticking over" flavor by the on-ball player's playstyle.
  const POSSESSION_FLAVOR = {
    'Orchestrator':         ['controls the tempo from deep, in no hurry to give the ball away'],
    'Classic No. 10':       ['pulls the strings from a pocket of space'],
    'Creative Playmaker':   ['probes for an opening, constantly on the move to stay available'],
    'Build Up':             ['brings the ball out from the back under no real pressure'],
    'Deep-Lying Forward':   ['drops off the front line to link the play']
  };
  // Off-the-ball movement flavor for a missed big chance, describing *how*
  // the player got into the position in the first place.
  const BIG_CHANCE_FLAVOR = {
    'Goal Poacher':         ['times a run in behind the last defender'],
    'Fox in the Box':       ['reacts quickest to a loose ball in the six-yard box'],
    'Hole Player':          ['arrives late and unmarked at the back post'],
    'Dummy Runner':         ["ghosts into the space a decoy run opened up"],
    'Inside Forward':       ['cuts in from the flank onto his favoured foot']
  };
  // Extra descriptive clause appended to a goal's method text based on the
  // scorer's playstyle, so the same "tap-in" reads differently for a Fox in
  // the Box than for a Full-back Finisher arriving from deep.
  const GOAL_FLAVOR_SUFFIX = {
    'Goal Poacher':         ['after peeling off the last defender'],
    'Fox in the Box':       ['pouncing first on a loose ball in the six-yard box'],
    'Target Man':           ['rising above his marker'],
    'Hole Player':          ['arriving late and completely unmarked'],
    'Inside Forward':       ['cutting in from the flank onto his stronger foot'],
    'Full-back Finisher':   ['arriving from deep, well beyond his usual position'],
    'Extra Frontman':       ['pushing forward from the back to get on the end of it'],
    'Deep-Lying Forward':   ['picking up the pieces after dropping deep to link play']
  };

  // Derives the 5 gameplay stats from a player-attributes.json entry.
  // Goalkeepers draw def/tec from their GK-specific ratings (shot-stopping,
  // handling, distribution) instead of the outfield ones.
  function deriveStatsFromAttributes(attr, posArr) {
    const isGK = ((posArr && posArr[0]) || attr.pos && attr.pos[0]) === 'GK';
    const avg = (...vals) => {
      const nums = vals.filter(v => typeof v === 'number');
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 60;
    };
    const pac = avg(attr.spd, attr.accel);
    const phy = isGK
      ? avg(attr.phy_con, attr.jmp, attr.bal, attr.stam)
      : avg(attr.phy_con, attr.jmp, attr.bal, attr.stam, attr.aggr);
    const tec = isGK
      ? avg(attr.gk_catch, attr.low_pass, attr.lofted_pass, attr.ball_con)
      : avg(attr.ball_con, attr.dribb, attr.low_pass, attr.lofted_pass, attr.curl, attr.tight_pos);
    const att = isGK
      ? avg(attr.off_awr, attr.kick_pwr, attr.place_kick)
      : avg(attr.fin, attr.off_awr, attr.head, attr.place_kick, attr.kick_pwr);
    const def = isGK
      ? avg(attr.gk_awr, attr.gk_parry, attr.gk_reflex, attr.gk_reach, attr.gk_catch)
      : avg(attr.def_awr, attr.def_eng, attr.tack, attr.aggr);
    // Ceiling raised slightly from the old hard 99 card-max: playstyle
    // nudges (PLAYSTYLE_STAT_MODS below) are allowed to carry an
    // already-elite derived stat a couple of points past 99.
    const clamp = (v) => Math.max(1, Math.min(ATTRIBUTE_CAP, Math.round(v)));
    // Apply each of the player's individual playstyle tags as a small flat
    // nudge to the raw averages above — this is what keeps two players in
    // the same position from converging on an identical 5-stat profile;
    // a Target Man and a Goal Poacher playing the same ST slot come out
    // with a visibly different att/phy/pac balance.
    let pacAdj = pac, phyAdj = phy, tecAdj = tec, attAdj = att, defAdj = def;
    (attr.playstyle || []).forEach((style) => {
      const mod = PLAYSTYLE_STAT_MODS[style];
      if (!mod) return;
      if (mod.pac) pacAdj += mod.pac;
      if (mod.phy) phyAdj += mod.phy;
      if (mod.tec) tecAdj += mod.tec;
      if (mod.att) attAdj += mod.att;
      if (mod.def) defAdj += mod.def;
    });
    return { pac: clamp(pacAdj), phy: clamp(phyAdj), tec: clamp(tecAdj), att: clamp(attAdj), def: clamp(defAdj) };
  }

  function weightedOverall(derived, posArr) {
    const w = ATTR_POS_WEIGHTS[attrPosGroup(posArr)] || ATTR_POS_WEIGHTS.CM;
    return Math.round(derived.att * w.att + derived.def * w.def + derived.pac * w.pac +
      derived.phy * w.phy + derived.tec * w.tec);
  }
  // ===== eFootball-style overall boost =====
  // A flat positional weighted-average (weightedOverall above) treats every
  // stat as interchangeable, so a genuine standout attribute gets diluted
  // into the mean instead of standing out — nothing in a plain average can
  // ever land near the top of the scale. eFootball's overall calc instead
  // leans the final number toward a player's best stats, so a truly special
  // attribute pulls the whole rating up with it. OVERALL_BOOST_LEAN controls
  // how much of the gap between the flat average and the player's peak stat
  // gets folded back in — 0 would be a pure average (old behavior), 1 would
  // just be "OVR = best stat". Only expanded-attribute (enhanced) players
  // run through this; everyone else keeps the plain teams.json number.
  const OVERALL_BOOST_LEAN = 0.38;
  // Raised from 100: individual derived attributes (att/def/pac/phy/tec)
  // are allowed a small amount of headroom above the old "perfect card"
  // ceiling, since PLAYSTYLE_STAT_MODS nudges (see clamp() in
  // deriveStatsFromAttributes) can still occasionally push an already-99
  // stat a couple of points over.
  const OVERALL_CAP = 105;
  const OVERALL_FLOOR = 40;
  // Ceiling for individual derived attributes (att/def/pac/phy/tec) — see
  // clamp() in deriveStatsFromAttributes. A plain (non-boosted) player's
  // authored sheet tops out at 99 anyway; this only matters once
  // PLAYSTYLE_STAT_MODS nudges are stacked on top of an already-elite stat.
  const ATTRIBUTE_CAP = 105;
  // Non-expanded ("regular") players are scaled down relative to the
  // enhanced/expanded-attribute roster so the boosted players read as
  // genuinely special rather than everyone converging on the same numbers.
  const REGULAR_OVR_MULTIPLIER = 0.95;

  function efootballBoostedOverall(derived, posArr) {
    const flatAvg = weightedOverall(derived, posArr);
    const peak = Math.max(derived.att, derived.def, derived.pac, derived.phy, derived.tec);
    return flatAvg + (peak - flatAvg) * OVERALL_BOOST_LEAN;
  }
  // ===== eFootball-2027-style POSITION-based overall (raw attributes) =====
  // weightedOverall/efootballBoostedOverall above compute OVR from the 5
  // *compact* gameplay stats (att/def/pac/phy/tec) — a coarse blend that
  // can't tell "Finishing" from "Heading" once both are folded into "att".
  // Real eFootball instead weighs a fixed, position-specific list of raw
  // attributes directly, so a CF's overall genuinely hinges on Finishing/
  // Off. Awareness/Ball Control etc. while a CB's hinges on Def. Awareness/
  // Tackling/Heading — different players in the same broad area of the
  // pitch (an AMF vs a CMF, a CF vs an SS) get visibly different emphasis
  // instead of collapsing into one generic "attacking mid" or "striker"
  // bucket. This is now the primary OVR base for expanded-attribute
  // players (see applyExpandedPlayerAttributes); weightedOverall/
  // efootballBoostedOverall above are left in place but no longer feed OVR.
  //
  // Each list below is ordered strongest-value-first (as specified) and
  // converted to descending linear weights (first attribute weighted most,
  // last weighted least) that sum to 1 per position — the closest
  // approximation to eFootball's real per-position emphasis without access
  // to their exact proprietary weighting.
  function makeDescendingWeights(orderedKeys) {
    const n = orderedKeys.length;
    const denom = (n * (n + 1)) / 2;
    const weights = {};
    orderedKeys.forEach((k, i) => { weights[k] = (n - i) / denom; });
    return weights;
  }
  const POSITION_ATTR_WEIGHTS = {
    // CF (Centre Forward — covers raw 'CF'/'ST' sheets)
    CF: makeDescendingWeights(['fin', 'off_awr', 'ball_con', 'dribb', 'tight_pos', 'spd', 'accel', 'phy_con', 'head', 'jmp']),
    // SS (Second Striker) — kept distinct from AMF per eFootball's own split
    SS: makeDescendingWeights(['off_awr', 'ball_con', 'dribb', 'tight_pos', 'low_pass', 'fin', 'spd', 'accel', 'curl']),
    // LWF/RWF (wide forwards) — also used for RM/LM (wide mid) sheets,
    // the closest match given no separate wide-mid list was specified.
    WF: makeDescendingWeights(['dribb', 'ball_con', 'tight_pos', 'spd', 'accel', 'off_awr', 'low_pass', 'fin', 'curl']),
    // AMF
    AMF: makeDescendingWeights(['ball_con', 'dribb', 'tight_pos', 'low_pass', 'lofted_pass', 'off_awr', 'fin', 'curl', 'spd', 'accel']),
    // CMF
    CMF: makeDescendingWeights(['low_pass', 'lofted_pass', 'ball_con', 'stam', 'def_awr', 'def_eng', 'dribb', 'tight_pos', 'off_awr']),
    // DMF
    DMF: makeDescendingWeights(['def_awr', 'def_eng', 'tack', 'phy_con', 'stam', 'low_pass', 'ball_con', 'aggr', 'head']),
    // CB
    CB: makeDescendingWeights(['def_awr', 'tack', 'def_eng', 'phy_con', 'head', 'jmp', 'spd', 'accel', 'bal']),
    // LB/RB (also used for wing-backs — no separate list was specified)
    FB: makeDescendingWeights(['def_awr', 'tack', 'def_eng', 'spd', 'accel', 'stam', 'low_pass', 'phy_con', 'bal']),
    // GK — ONLY the 5 goalkeeper-specific ratings, nothing outfield mixed in.
    GK: makeDescendingWeights(['gk_awr', 'gk_catch', 'gk_parry', 'gk_reflex', 'gk_reach'])
  };

  // Maps a player's raw (pre-canonicalization) position string to one of
  // the position groups above. Deliberately reads posArr[0] BEFORE
  // normalizeAllPositions() runs (see init() in ui/matchUI.js — expanded
  // attributes are applied first) so 'SS' is never collapsed into 'CAM'/
  // 'AMF' here the way the broader canonPos() system does elsewhere; this
  // resolver is scoped to the OVR calc only and doesn't affect formation/
  // substitution logic.
  function resolveAttrPositionGroup(posArr) {
    const raw = String((posArr && posArr[0]) || 'CM').toUpperCase();
    if (raw === 'GK') return 'GK';
    if (raw === 'CF' || raw === 'ST') return 'CF';
    if (raw === 'SS') return 'SS';
    if (['LW', 'RW', 'LWF', 'RWF', 'LF', 'RF', 'LM', 'RM', 'LMF', 'RMF'].includes(raw)) return 'WF';
    if (['CAM', 'AM', 'AMF'].includes(raw)) return 'AMF';
    if (['CM', 'CMF', 'MF'].includes(raw)) return 'CMF';
    if (['CDM', 'DM', 'DMF'].includes(raw)) return 'DMF';
    if (raw === 'CB' || raw === 'SW') return 'CB';
    if (['LB', 'RB', 'LWB', 'RWB'].includes(raw)) return 'FB';
    return 'CMF';
  }

  // Computes OVR straight from the (manager-boosted) raw attribute sheet
  // using the position's weight list above, then applies the same
  // "lean toward peak" treatment as efootballBoostedOverall — a truly
  // standout signature attribute for the role still pulls the whole
  // rating up rather than just averaging away.
  function positionalRawOverall(attr, posGroup) {
    const weights = POSITION_ATTR_WEIGHTS[posGroup] || POSITION_ATTR_WEIGHTS.CMF;
    let sum = 0, wsum = 0, peak = -Infinity;
    Object.keys(weights).forEach((k) => {
      const v = attr[k];
      if (typeof v !== 'number') return;
      sum += v * weights[k];
      wsum += weights[k];
      if (v > peak) peak = v;
    });
    const flat = wsum ? sum / wsum : 60;
    if (peak === -Infinity) peak = flat;
    return flat + (peak - flat) * OVERALL_BOOST_LEAN;
  }



  // Applies player-attributes.json to every matching player on every team.
  // Runs once at startup, after restorePlayerForms() so it can safely
  // overwrite this player's persisted baseOvr with the freshly-derived
  // baseline while still preserving their accumulated form delta on top of
  // it — see the form system's comment near applyPlayerForm() for how
  // baseOvr/form/ovr relate.
  function applyExpandedPlayerAttributes() {
    const hasExpandedData = !!(playerAttributesData && Object.keys(playerAttributesData).length);
    const nationalTeams = teamsData.national || [];
    allTeams.forEach((team) => {
      const isNationalTeam = nationalTeams.includes(team);
      (team.players || []).forEach((p) => {
        const rawAttr = hasExpandedData ? playerAttributesData[p.id] : null;
        if (!rawAttr) {
          // Regular (non-enhanced) player: no expanded attribute sheet, so
          // they don't get the eFootball-style peak-stat boost below. To
          // keep enhanced players reading as genuinely special rather than
          // everyone converging on similar numbers, regular players are
          // scaled down a flat 5% off their original teams.json overall.
          // Always derives from p.rawOvr (captured once at load, before any
          // system here touches p.ovr) so this can never compound across
          // repeated calls or save/reload sessions.
          const source = (typeof p.rawOvr === 'number') ? p.rawOvr : (p.baseOvr || p.ovr || 70);
          const scaledBase = Math.max(OVERALL_FLOOR, Math.min(OVERALL_CAP, Math.round(source * REGULAR_OVR_MULTIPLIER)));
          p.baseOvr = scaledBase;
          // Card overall is fixed to baseOvr — the Form & Condition system
          // (engine/form.js) never adjusts it; only in-match effective
          // attributes move with a player's rolled condition.
          p.ovr = scaledBase;
          p.attrBoosted = false;
          return;
        }
        const posArr = (rawAttr.pos && rawAttr.pos.length) ? rawAttr.pos : (p.pos || ['CM']);
        const isGK = posArr[0] === 'GK';
        const attr = rawAttr;
        const derived = deriveStatsFromAttributes(attr, posArr);
        p.att = derived.att; p.def = derived.def; p.pac = derived.pac;
        p.phy = derived.phy; p.tec = derived.tec;
        // The expanded sheet's position list is more detailed (multiple
        // valid roles) — prefer it over teams.json's when present. posArr
        // above (used for stat derivation) still benefits from the sheet's
        // richer list either way; only the player's *displayed*/selectable
        // p.pos is left alone here. National-team squads are the
        // federation's own roster call-up — jersey number AND position for
        // country duty must stay exactly what teams.json says, even for a
        // player whose (club-context) attribute sheet lists a different
        // number/position. p.num is never touched by this function for any
        // team, club or national — it always comes from teams.json.
        if (!isNationalTeam && attr.pos && attr.pos.length) p.pos = attr.pos.slice();
        // A player whose signature attributes for their own playstyle(s)
        // run well above their sheet average gets a much bigger push
        // toward their overall here than the generic 5-stat blend alone
        // would give them.
        const signatureBonus = styleSignatureBonus(attr, attr.playstyle, isGK);
        // Position-based eFootball 2027-style overall: weighs the raw
        // attribute sheet directly using this exact position's own
        // strongly-valued attribute list (see POSITION_ATTR_WEIGHTS).
        const posGroup = resolveAttrPositionGroup(posArr);
        const base = positionalRawOverall(attr, posGroup) + signatureBonus;
        const boostedBase = Math.max(OVERALL_FLOOR, Math.min(OVERALL_CAP, Math.round(base)));
        p.baseOvr = boostedBase;
        // Card overall is fixed to baseOvr — see the non-expanded branch
        // above for why the old form-delta is gone from this line too.
        p.ovr = boostedBase;
        p.expandedAttrs = attr;
        p.attrBoosted = true;
        p.signatureBonus = signatureBonus;
      });
    });
  }

  // ===== Expanded-attribute gameplay hooks =====
  // The functions below are what stop a boosted player's expanded sheet from
  // "fading into" the same generic att/def/pac/phy/tec/ovr numbers everyone
  // else uses. Each one reads specific raw ratings/skills straight off
  // p.expandedAttrs (only set for player-attributes.json matches) and nudges
  // a specific in-match probability — who wins a header, how a penalty or
  // free kick goes, how a tackle resolves, how injury-prone someone is —
  // beyond what the 5 compact stats alone would produce. Every one of them
  // returns a neutral value (0 bonus, or a multiplier that reduces to the
  // pre-existing behaviour) when a player has no expanded sheet, so nothing
  // about the old system changes for anyone else.
  // player-attributes.json is hand-authored data and carries real-world
  // inconsistency in how a skill name is spelled/punctuated ("First-time
  // Shor" instead of "Shot", "GK Direct Throw" instead of "GK Long Throws",
  // "Long-Range Curler" vs "Long-range Curler", etc). hasSkill() normalizes
  // both sides of the comparison (lowercase, strip all non-alphanumerics)
  // so spacing/hyphen/case differences always match, and a small alias
  // table on top catches the genuine misspellings/synonyms that
  // normalization alone can't fix. This is the single source of truth every
  // skill-gated gameplay hook below reads through, so fixing a name here
  // fixes it everywhere at once.
  function normSkillKey(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  const SKILL_NAME_ALIASES = {
    'firsttimeshor': 'firsttimeshot',
    'acrobaticclear': 'acrobaticclearance',
    'acromaticfinishing': 'acrobaticfinishing',
    'aerialforte': 'aerialfort',
    'gkdirectthrow': 'gklongthrows',
    'gklongthrow': 'gklongthrows',
    'longthrow': 'longthrows',
    'risingshots': 'risingshot',
    'longrangeshor': 'longrangeshooting'
  };
  function canonSkillKey(s) {
    const k = normSkillKey(s);
    return SKILL_NAME_ALIASES[k] || k;
  }
  function hasSkill(p, skillName) {
    if (!p || !p.expandedAttrs) return false;
    const target = canonSkillKey(skillName);
    return (p.expandedAttrs.skills || []).some((s) => canonSkillKey(s) === target);
  }
  function xattr(p, key, fallback) {
    const v = p && p.expandedAttrs && p.expandedAttrs[key];
    return typeof v === 'number' ? v : fallback;
  }
  // ===== Match-state context helpers for the game-state-gated skills =====
  // (Fortress, Game-Changing Pass, GK Spirit Roar, Super-Sub) — all of them
  // key off which side a player is on, whether their team is currently
  // ahead/behind, and (for Super-Sub) when they came off the bench. Centralized
  // here so every engine file that needs match-state context reads it the same way.
  function playerSideData(p) {
    const m = currentMatch;
    if (!m || !p) return null;
    const inHome = ((m.home.squad && m.home.squad.all) || []).some((x) => x.id === p.id);
    return { m, side: inHome ? m.home : m.away, opp: inHome ? m.away : m.home, sideKey: inHome ? 'home' : 'away' };
  }
  function playerTeamLeadingSecondHalf(p) {
    const ctx = playerSideData(p);
    if (!ctx || ctx.m.minute < 46) return false;
    return (ctx.side.score || 0) > (ctx.opp.score || 0);
  }
  function playerTeamTrailingOrDrawingSecondHalf(p) {
    const ctx = playerSideData(p);
    if (!ctx || ctx.m.minute < 46) return false;
    return (ctx.side.score || 0) <= (ctx.opp.score || 0);
  }
  // True if the goalkeeper currently on pitch for this player's own team has
  // the given skill (used for GK Directing Defense / GK Spirit Roar, whose
  // effect is on the team's defenders, not the keeper's own actions).
  function teamGkHasSkill(p, skillName) {
    const ctx = playerSideData(p);
    if (!ctx) return false;
    const ids = ctx.sideKey === 'home' ? ctx.m.homeOnPitch : ctx.m.awayOnPitch;
    const gk = ((ctx.side.squad && ctx.side.squad.all) || []).find((x) => ids.includes(x.id) && (x.slot || (x.pos || [])[0]) === 'GK');
    return !!gk && hasSkill(gk, skillName);
  }
  // Super-Sub: only "active" once the player has actually come on as a
  // substitute in the second half — a starter with the skill on their sheet
  // gets no bonus from it.
  function isActingSuperSub(p) {
    if (!p || !hasSkill(p, 'Super-Sub')) return false;
    const ctx = playerSideData(p);
    if (!ctx || !ctx.m.subLog) return false;
    const log = ctx.m.subLog[ctx.sideKey] && ctx.m.subLog[ctx.sideKey][p.id];
    return !!(log && log.inMin != null && log.inMin >= 45);
  }
  // Extra shot-quality nudge (roughly ±0.15) from finishing-specific traits
  // a flat att/tec/ovr blend can't see on its own.
  function finishingEdge(p) {
    if (!p || !p.expandedAttrs) return 0;
    // Curved rather than linear: the max contribution at a 99 Finishing
    // rating is unchanged (still 0.145) but a merely-good 80 now gives up
    // much more of that ceiling than a flat scale would, and a 90+ finisher
    // pulls disproportionately closer to it — see curvedStat() in js/rng.js.
    let edge = curvedStat(xattr(p, 'fin', 70), 70, 29, 1.6) * 0.145;
    if (hasSkill(p, 'Phenomenal Finishing')) edge += 0.06;
    if (hasSkill(p, 'First-time Shot')) edge += 0.02;
    if (hasSkill(p, 'Acrobatic Finishing')) edge += 0.045;
    if (hasSkill(p, 'Low Screamer')) edge += 0.03;
    if (hasSkill(p, 'Chip Shot Control')) edge += 0.02;
    if (hasSkill(p, 'Long Range Shooting')) edge += 0.02;
    // Super-Sub: a real lift once the player has actually come off the
    // bench in the second half — a starter with the skill gets nothing.
    if (isActingSuperSub(p)) edge += 0.03;
    // Willpower: gradually sharper finishing the more shots this player has
    // already had a go at in this match.
    const m = currentMatch;
    if (hasSkill(p, 'Willpower') && m && m.playerMatchStats && m.playerMatchStats[p.id]) {
      edge += Math.min(0.08, (m.playerMatchStats[p.id].shots || 0) * 0.012);
    }
    // Box-focused playstyles get a distinct finishing edge on top of raw
    // finishing rating, so their identity shows up beyond the stat sheet.
    if (hasStyle(p, 'Fox in the Box')) edge += 0.04;
    if (hasStyle(p, 'Goal Poacher')) edge += 0.03;
    if (hasStyle(p, 'Inside Forward')) edge += 0.025;
    if (hasStyle(p, 'Hole Player')) edge += 0.02;
    if (hasStyle(p, 'Full-back Finisher') || hasStyle(p, 'Extra Frontman')) edge += 0.015;
    // A tired finisher's touch/composure in front of goal is a little less
    // reliable than when he's fresh.
    edge *= staminaMultiplier(p);
    return edge;
  }
  // Blitz Curler is a specific finishing identity, not just a flat bonus:
  // a player with the skill only ever finishes with the trademark blitz
  // curl strike (see pickGoalMethod below, which forces that outcome for
  // them), so how good they are at it should come straight from the three
  // attributes that actually make that finish work — the strike itself
  // (Finishing), enough bend to beat the keeper (Curl), and enough pace on
  // it that a strong hand isn't enough to keep it out (Kicking Power) —
  // rather than from generic finishing/free-kick edges built around a much
  // wider variety of finishes. Zero for anyone without the skill, so this
  // has no effect on the wider shooting model.
  function blitzCurlerEdge(p) {
    if (!p || !p.expandedAttrs || !hasSkill(p, 'Blitz Curler')) return 0;
    let edge = curvedStat(xattr(p, 'fin', 70), 70, 29, 1.6) * 0.09
      + curvedStat(xattr(p, 'curl', 70), 70, 29, 1.6) * 0.09
      + curvedStat(xattr(p, 'kick_pwr', 70), 70, 29, 1.6) * 0.05;
    edge *= staminaMultiplier(p);
    return edge;
  }
  // Off-the-ball positioning edge — separate from finishing itself. Off
  // Awareness is specifically about getting into the right spot/angle to
  // shoot from in the first place, so it nudges shot quality on every shot
  // type (including headers, where good movement in the box matters just
  // as much as jumping ability).
  function positioningEdge(p) {
    if (!p || !p.expandedAttrs) return 0;
    return curvedStat(xattr(p, 'off_awr', 70), 70, 29, 1.6) * 0.0522 * staminaMultiplier(p) * conditionMultiplier(p);
  }
  // How hard the shot is actually struck, 0-1 — driven by Kicking Power.
  // This is deliberately kept separate from shotQuality (placement/
  // technique): a powerfully struck shot is genuinely harder for a keeper
  // to keep out/hold onto even when it isn't perfectly placed, and it's
  // what feeds the catch-vs-parry decision in resolveGkSave.
  function shotPowerOf(p) {
    if (!p) return 0.5;
    const kp = xattr(p, 'kick_pwr', null);
    const base = kp != null ? kp : ((p.att || 70) * 0.4 + (p.phy || 70) * 0.6);
    return Math.max(0, Math.min(1, (base - 40) / 55));
  }
  // Aerial ability, 0.05-0.98 — used both to weight who wins headed chances
  // and to nudge conversion once they do. Defaults to a neutral 0.5 (so
  // multiplying by 2 elsewhere reduces to "no change") for non-expanded players.
  // isDefensiveContext: true when this call represents a defender heading
  // the ball away in/near their own box (corner/goal-kick defending) — that's
  // specifically what Aerial Fort covers, as opposed to an attacker winning
  // a header at the other end.
  function aerialSkill(p, isDefensiveContext) {
    if (!p || !p.expandedAttrs) return 0.5;
    // Heading technique is only part of winning an aerial duel — Jump is
    // what actually gets a player above his marker to reach the ball, and
    // Physical Contact is what lets him hold his ground/box the opponent
    // out to win the position in the first place. Blending all three (not
    // just heading) is what separates a genuine aerial threat from a
    // technically good header of a ball who can't out-jump anyone.
    // Each raw rating is run through the curve before blending — a 95
    // Heading rating stands out clearly from an 80, instead of the two
    // being separated by only a flat, easy-to-miss fraction of a point.
    let v = (curvedAttr(xattr(p, 'head', 60), 60, 39, 1.6) * 0.55
      + curvedAttr(xattr(p, 'jmp', 60), 60, 39, 1.6) * 0.3
      + curvedAttr(xattr(p, 'phy_con', 60), 60, 39, 1.6) * 0.15) / 100;
    if (hasSkill(p, 'Aerial Superiority') || hasSkill(p, 'Heading')) v += 0.12;
    if (hasSkill(p, 'Bullet Header')) v += 0.06;
    if (isDefensiveContext && hasSkill(p, 'Aerial Fort')) v += 0.08;
    // A Target Man's whole game is built around winning the aerial duel;
    // defensively-anchored styles also read the flight of a long ball well.
    if (hasStyle(p, 'Target Man')) v += 0.1;
    if (hasStyle(p, 'Anchor Man') || hasStyle(p, 'Destroyer')) v += 0.05;
    // A tired jumper gets up a little less sharply late in the match.
    v *= staminaMultiplier(p) * conditionMultiplier(p);
    return Math.max(0.05, Math.min(0.98, v));
  }
  // GK shot-stopping edges — each one reads a *distinct* goalkeeping
  // attribute for a distinct part of the save, instead of folding
  // gk_awr/gk_catch/gk_parry/gk_reflex/gk_reach into one blended number.
  // See resolveGkSave() below for how they combine into an actual save
  // decision (chance to save at all, then catch vs. parry vs. a rebound).
  function gkReflexEdge(gk) {
    if (!gk || !gk.expandedAttrs) return 0;
    // Curved around the keeper baseline (75) instead of a flat multiplier —
    // preserves the same ceiling at a 99 rating but a merely-good reflex
    // stat no longer buys nearly as much of it.
    let edge = curvedStat(xattr(gk, 'gk_reflex', 75), 75, 24, 1.6) * 0.12;
    if (hasSkill(gk, 'Acrobatic Clearance')) edge += 0.05;
    return edge;
  }
  // Penalty-kick edges: taker's placement + specialist skill; keeper's
  // penalty-specific awareness + save skill.
  function penTakerEdge(p) {
    if (!p || !p.expandedAttrs) return 0;
    let edge = curvedStat(xattr(p, 'place_kick', 70), 70, 29, 1.6) * 0.1015;
    if (hasSkill(p, 'Penalty Specialist')) edge += 0.08;
    if (hasSkill(p, 'Chip Shot Control')) edge += 0.02;
    if (hasStyle(p, 'Fox in the Box') || hasStyle(p, 'Classic No. 10')) edge += 0.03;
    return edge;
  }
  function penGkEdge(gk) {
    if (!gk || !gk.expandedAttrs) return 0;
    let edge = curvedStat(xattr(gk, 'gk_awr', 75), 75, 24, 1.6) * 0.036;
    if (hasSkill(gk, 'GK Penalty Saver')) edge += 0.10;
    return edge;
  }
  // Positioning/anticipation — the baseline read on every single save
  // attempt regardless of shot type, since it's what puts the keeper in
  // the right spot before reflex/reach even come into it.
  function gkPositioningEdge(gk) {
    if (!gk || !gk.expandedAttrs) return 0;
    let edge = curvedStat(xattr(gk, 'gk_awr', 75), 75, 24, 1.6) * 0.096;
    if (hasSkill(gk, 'GK Directing Defense')) edge += 0.015;
    return edge;
  }
  // Reach specifically covers shots placed toward the corners/edges of the
  // frame — the far post on a cross/header, or a well-placed effort from
  // distance — as opposed to a shot the keeper is already square-on to.
  function gkReachEdge(gk) {
    if (!gk || !gk.expandedAttrs) return 0;
    return curvedStat(xattr(gk, 'gk_reach', 75), 75, 24, 1.6) * 0.096;
  }
  // Once a shot is actually going to be kept out, gk_catch decides how
  // often that's a clean, secure take rather than needing to be parried
  // away — a stronger strike (higher shotPower) and a close-range effort
  // both make a clean catch harder to pull off.
  function gkCatchChance(gk, shotPower, closeRange) {
    if (!gk) return 0.4;
    const base = gk.expandedAttrs
      ? curvedAttr(xattr(gk, 'gk_catch', 65), 65, 34, 1.6) / 100
      : (curvedAttr(gk.def || 70, 70) * 0.6 + curvedAttr(gk.tec || 70, 70) * 0.4) / 100;
    let v = base - (shotPower || 0) * 0.28 - (closeRange ? 0.06 : 0);
    if (hasSkill(gk, 'GK Penalty Saver')) v += 0.02;
    return Math.max(0.06, Math.min(0.93, v));
  }
  // When a shot is parried rather than caught, gk_parry decides how
  // *safely* it's directed away — a specialist sends it well clear of
  // danger, a weaker one leaves a genuine rebound sitting up for someone
  // to attack. Returns the chance a dangerous rebound actually follows.
  function gkParryReboundDanger(gk) {
    if (!gk) return 0.16;
    const parry = gk.expandedAttrs
      ? curvedAttr(xattr(gk, 'gk_parry', 65), 65, 34, 1.6)
      : curvedAttr((gk.def || 70) * 0.5 + (gk.ovr || 75) * 0.5, 70);
    return Math.max(0.04, Math.min(0.32, 0.05 + (100 - parry) / 260));
  }
  // Full shot-stopping resolution for a shot that's already confirmed on
  // target. Replaces the old single flat "gkSkill" blend with attribute
  // reads tuned to the actual situation: reflexes matter most when there's
  // barely time to react (close range, headers), reach matters most when
  // the shot is genuinely placed away from the keeper's body (long range,
  // crosses/wide deliveries). Also fatigue-aware: a tired keeper reacts a
  // touch slower, same as any outfield attribute under this model.
  function resolveGkSave(gk, shooter, shotQuality, shotContext) {
    shotContext = shotContext || {};
    const isHeader = !!shotContext.isHeader;
    const closeRange = !!shotContext.closeRange;
    const isLongRange = shotContext.chanceType === 'longshot';
    const isCrossType = shotContext.chanceType === 'cross';
    const shotPower = shotContext.shotPower != null ? shotContext.shotPower : 0.5;
    const fatigueMult = gk ? staminaMultiplier(gk) : 1;

    const posEdge = gk ? gkPositioningEdge(gk) * fatigueMult : 0;
    let situational = 0;
    if (gk) {
      const reflex = gkReflexEdge(gk) * fatigueMult;
      const reach = gkReachEdge(gk) * fatigueMult;
      situational += (closeRange || isHeader) ? reflex * 1.3 : reflex * 0.45;
      situational += (isLongRange || isCrossType) ? reach * 1.2 : reach * 0.35;
    }
    const gkSkillBase = (gk ? (curvedAttr(gk.def || 70, 70) * 0.45 + curvedAttr(gk.ovr || 75, 75) * 0.25 + curvedAttr(gk.tec || 70, 70) * 0.15) / 100 : 0.68) * (gk ? conditionMultiplier(gk) : 1);
    const gkSkill = Math.max(0.05, Math.min(0.98, gkSkillBase + posEdge + situational));
    // Base raised 0.58 -> 0.62 alongside the possession-pipeline shot-volume
    // fix (see engine/possession.js passChance/duelChance/carryChance): once
    // shots started reaching the keeper at something closer to a realistic
    // rate, the shots-on-target -> goal conversion this produced (~40%) ran
    // a bit hot versus the ~33% real-world benchmark noted below — this
    // small bump brings scoring back toward that line without undoing the
    // shot-volume fix itself.
    const saveChance = Math.min(0.94, Math.max(0.28,
      0.62 + gkSkill * 0.38 - shotQuality * 0.22 - shotPower * 0.06 - (isHeader ? 0.03 : 0)));
    if (seededRandom() >= saveChance) return { saved: false };

    // A save happened — decide whether it's a clean catch or a parry (and,
    // if parried, whether it leaves a real rebound chance behind it).
    const catchChance = gkCatchChance(gk, shotPower, closeRange);
    if (seededRandom() < catchChance) return { saved: true, saveType: 'catch', reboundDanger: 0 };
    return { saved: true, saveType: 'parry', reboundDanger: gkParryReboundDanger(gk) };
  }
  // Free-kick taker edge — curl/placement plus specialist skills.
  function fkTakerEdge(p) {
    if (!p || !p.expandedAttrs) return 0;
    let edge = curvedStat(xattr(p, 'curl', 70), 70, 29, 1.6) * 0.145
      + curvedStat(xattr(p, 'place_kick', 70), 70, 29, 1.6) * 0.0967;
    if (hasSkill(p, 'Long Range Curler')) edge += 0.05;
    if (hasSkill(p, 'Knuckle Shot')) edge += 0.04;
    if (hasSkill(p, 'Dipping Shot')) edge += 0.03;
    if (hasSkill(p, 'Blitz Curler')) edge += 0.03;
    if (hasSkill(p, 'Outside Curler')) edge += 0.02;
    if (hasStyle(p, 'Creative Playmaker') || hasStyle(p, 'Classic No. 10')) edge += 0.03;
    if (hasStyle(p, 'Cross Specialist') || hasStyle(p, 'Orchestrator')) edge += 0.02;
    return edge;
  }
  // Dribble/skill-move success edge — dribbling ability plus specific moves.
  function dribbleSuccessEdge(p) {
    if (!p || !p.expandedAttrs) return 0;
    let edge = curvedStat(xattr(p, 'dribb', 70), 70, 29, 1.6) * 0.116;
    const skillMoves = ['Chop Turn', 'Flip Flap', 'Double Touch', 'Marseille Turn', 'Scissors Feint', 'Sole Control', 'Sombrero', 'Cut Behind & Turn', 'Inside Bounce'];
    if (skillMoves.some((s) => hasSkill(p, s))) edge += 0.08;
    if (hasSkill(p, 'Momentum Dribbling')) edge += 0.03;
    if (hasSkill(p, 'Magnetic Feet')) edge += 0.03;
    if (hasSkill(p, 'Acceleration Burst')) edge += 0.02;
    if (hasStyle(p, 'Prolific Winger') || hasStyle(p, 'Inside Forward')) edge += 0.04;
    if (hasStyle(p, 'Roaming Flank') || hasStyle(p, 'Dummy Runner')) edge += 0.03;
    if (hasStyle(p, 'Creative Playmaker')) edge += 0.02;
    edge *= staminaMultiplier(p) * conditionMultiplier(p);
    return edge;
  }
  // Defensive-action edges — specific tackling/interception skills beyond
  // the generic def-based chance already used for the base roll.
  function defActionEdge(p) {
    if (!p || !p.expandedAttrs) return { chance: 0, interceptBias: 0 };
    let chance = curvedStat(xattr(p, 'tack', 70), 70, 29, 1.6) * 0.0087;
    // Interception bias now scales continuously with Defensive Awareness
    // (reading the game/anticipating the pass) instead of only moving in
    // fixed jumps from specific skills/playstyles — a player with a
    // genuinely elite def_awr reads passing lanes better than one who
    // merely has the "Interception" skill tag but an average rating.
    let interceptBias = curvedStat(xattr(p, 'def_awr', 70), 70, 29, 1.6) * 0.0638;
    if (hasSkill(p, 'Sliding Tackle')) chance += 0.01;
    if (hasSkill(p, 'Interception')) { chance += 0.006; interceptBias += 0.15; }
    if (hasSkill(p, 'Man Marking')) chance += 0.006;
    if (hasSkill(p, 'Blocker')) chance += 0.006;
    if (hasSkill(p, 'Track Back')) chance += 0.006;
    if (hasSkill(p, 'Long Reach Tackle')) chance += 0.007;
    // Shadow Hunt: a defender who reads a ball played into the space behind
    // them and reacts before it becomes a real chance — biases toward a
    // clean interception rather than a late/rash tackle.
    if (hasSkill(p, 'Shadow Hunt')) { chance += 0.005; interceptBias += 0.08; }
    // Destroyer/Anchor Man actively hunt the ball; Build Up and Box-to-Box
    // read the game well enough to time a challenge, but less aggressively.
    if (hasStyle(p, 'Destroyer')) { chance += 0.012; interceptBias += 0.05; }
    if (hasStyle(p, 'Anchor Man')) { chance += 0.008; interceptBias += 0.1; }
    if (hasStyle(p, 'Box-to-Box') || hasStyle(p, 'Build Up')) chance += 0.005;
    return { chance: chance * staminaMultiplier(p), interceptBias };
  }
  // Shared foul-proneness read used by both the possession-sequence duel
  // path (engine/transitions.js) and set-piece/open-play fouls
  // (engine/referee.js) and the continuous per-minute defensive actions
  // below — a single source of truth so a genuinely reckless/aggressive
  // defender reads the same disciplinary risk everywhere in the engine.
  // Aggression is the primary driver (more willing to fly into challenges);
  // Defensive Awareness now genuinely offsets it in BOTH directions —
  // elite awareness earns a real discount for well-timed challenges, not
  // just "no extra penalty" — and high Physical Contact adds a little more
  // (more contact, more free-kicks given away even on well-timed tackles).
  //
  // Previously the Awareness term only ever ADDED risk for poor awareness
  // (max(0, 65 - defAwr)) and did nothing at all once awareness passed 65
  // — so it could never distinguish a genuinely elite, well-timed tackler
  // from a merely-average one at the same aggression level. Real top
  // ball-winning CBs (Konaté, Cubarsí, Huijsen, Rodri, ...) tend to have
  // BOTH very high aggression AND very high awareness in this data set —
  // under the old formula that awareness bought them nothing, so their
  // aggression alone (uncapped per-term, up to +0.56) pushed foulProneness
  // to ~1.5–1.7, roughly 50–70% more foul-prone than the baseline every
  // single duel, all season — which is exactly what produced 15-24
  // yellows / 3-6 reds in 38 matches for these players. Making the
  // Awareness term signed (it can now reduce v, not just fail to increase
  // it) brings that same group down to a realistic ~1.1-1.3.
  // Further re-tuned: high-aggression DMs/CBs were still coming out
  // disproportionately foul/card-heavy over a season even after the signed
  // Awareness term above — the aggression term's slope (/70) and the 1.8
  // ceiling let a genuinely elite, high-engagement destroyer (who also
  // *wins the ball back* far more often than other positions, and so rolls
  // this disciplinary check far more often — see resolveTurnover in
  // engine/transitions.js) stack a modestly-elevated per-duel risk into a
  // large season total. Slope eased (/90) and the ceiling brought down to
  // 1.5 so aggression still matters — a reckless player is still visibly
  // more foul-prone than a disciplined one — without letting the volume of
  // duels a defensive-midfielder/CB naturally wins turn into a
  // multiplicatively unrealistic disciplinary record.
  function foulProneness(p) {
    if (!p || !p.expandedAttrs) {
      return 1 + Math.max(0, (75 - (p && p.def || 70)) / 90) + Math.max(0, (((p && p.phy) || 70) - 80) / 120);
    }
    const aggr = xattr(p, 'aggr', 70);
    const defAwr = xattr(p, 'def_awr', 70);
    const phyCon = xattr(p, 'phy_con', 70);
    let v = 1 + Math.max(0, aggr - 65) / 90 + (65 - defAwr) / 130 + Math.max(0, phyCon - 78) / 170;
    return Math.max(0.55, Math.min(1.5, v));
  }
  // Injury-proneness multiplier for the "who gets injured" weighted pick.
  function injuryWeightMult(p) {
    if (!p || !p.expandedAttrs) return 1;
    // Was reading "injurey_res" (typo) against the real "injury_res" field,
    // so this never actually matched Low/Medium/High — every player got the
    // same neutral 1x regardless of their sheet. Fixed so injury resistance
    // finally does what its tooltip says.
    const res = p.expandedAttrs.injury_res;
    let mult = 1;
    if (res === 'Low') mult = 1.5;
    else if (res === 'High') mult = 0.6;
    // Physical Contact is a separate, continuous factor on top of the
    // Low/Medium/High tier above — a player who holds up poorly in physical
    // duels picks up more knocks independent of his general durability tier.
    const phyCon = xattr(p, 'phy_con', 75);
    mult *= Math.max(0.75, Math.min(1.35, 1 + (75 - phyCon) / 160));
    // Aggressive, duel-heavy styles pick up more knocks than a positionally
    // disciplined one, independent of their base injury resistance rating.
    if (hasStyle(p, 'Destroyer') || hasStyle(p, 'Box-to-Box')) mult *= 1.15;
    if (hasStyle(p, 'Anchor Man') || hasStyle(p, 'Orchestrator')) mult *= 0.9;
    // A player already running on empty this match is a genuinely bigger
    // injury risk right now — ties the live fatigue model directly into
    // who goes down, not just their sheet-level resistance rating.
    const side = playerMatchSide(p);
    if (side) {
      const stamina = getStamina(currentMatch, side, p.id);
      if (stamina < 50) mult *= 1 + (50 - stamina) / 140;
    }
    return mult;
  }
  // Like pickPlayer, but the caller supplies the weighting function directly
  // instead of the fixed ovr/att/tec composite — used where an expanded
  // trait (aerial ability, etc.) should drive selection instead.
  function pickPlayerCustomWeighted(side, preferredPos, weightFn, excludeId) {
    if (!currentMatch || !side) return null;
    const ids = side === currentMatch.home ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    let pool = (side.squad.all || []).filter((p) => ids.includes(p.id) && p.id !== excludeId);
    if (preferredPos && preferredPos.length) {
      const preferred = pool.filter((p) => (p.pos || []).some((pos) => preferredPos.includes(pos)) || preferredPos.includes(p.slot));
      if (preferred.length) pool = preferred;
    }
    if (!pool.length) return null;
    const weights = pool.map((p) => Math.max(0.05, weightFn(p)));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = seededRandom() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  // Tries each URL in order, returns the first successful JSON response, or
  // null if every candidate fails/404s. Used for every optional/primary
  // startup JSON file below so those files can all be requested at once via
  // Promise.all instead of one after another — previously each of the 6
  // files below fully awaited (including its own up-to-3-URL fallback
  // chain) before the next one even started, which is what made startup
  // feel laggy. Nothing about the fallback/cache-busting behavior itself
  // changed, only the fact that the 6 chains now run concurrently.
  async function fetchFirstJson(urls, label) {
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
        if (!res.ok) continue;
        const data = await res.json();
        if (data && typeof data === 'object') {
          if (label) console.log('Loaded', label, 'from', url);
          return data;
        }
      } catch (err) { console.warn('Fetch failed', url, err); }
    }
    return null;
  }

  // Some players in teams.json legitimately appear twice under the SAME id
  // — once on their national side, once on their club — because they're
  // the same real person (e.g. Pelé for Brazil 1962 and Santos 1962-63).
  // That's fine and is what lets getAllPlayersFlat() merge them into one
  // profile showing both affiliations. But a handful of ids collide by
  // accident between two DIFFERENT players on the same squad (a genuine
  // data bug) — those must never be treated as "the same player", since
  // merging them would corrupt stats, squad selection, and substitution
  // bookkeeping (all keyed by player id). This repairs that second case by
  // giving every genuinely-colliding duplicate a fresh, unique id before
  // anything else in the app touches teamsData, while leaving true
  // same-player-same-id pairs (matching name) completely untouched so the
  // national/club merge in getAllPlayersFlat() keeps working.
  function repairDuplicatePlayerIds() {
    const seen = {}; // id -> first player object seen with that id
    const allIds = new Set();
    (teamsData.national || []).forEach(t => (t.players || []).forEach(p => allIds.add(p.id)));
    (teamsData.club || []).forEach(t => (t.players || []).forEach(p => allIds.add(p.id)));
    let renamed = 0;
    const rename = (p) => {
      let n = 2, newId;
      do { newId = p.id + '__dup' + n; n++; } while (allIds.has(newId));
      allIds.add(newId);
      p.id = newId;
      renamed++;
    };
    [...(teamsData.national || []), ...(teamsData.club || [])].forEach(t => {
      (t.players || []).forEach(p => {
        if (!p || !p.id) return;
        const prior = seen[p.id];
        if (!prior) { seen[p.id] = p; return; }
        // Same id already seen. Same name -> genuinely the same real
        // player on a second squad, leave as-is (this is the merge case).
        // Different name -> accidental collision between two different
        // players; give this one a new id so they stop clobbering each
        // other's stats/selection.
        if (prior.name !== p.name) rename(p);
      });
    });
    if (renamed) console.warn('Repaired', renamed, 'colliding duplicate player id(s) in teams.json');
  }

  async function init() {
    try {
      const isHosted = location.protocol === 'http:' || location.protocol === 'https:';
      const urlSet = (file) => isHosted
        ? [file + '?v=' + Date.now() + '&r=' + seededRandom().toString(36).slice(2), './' + file + '?v=' + Date.now(), file]
        : [file + '?v=' + Date.now()];

      // All 7 startup JSON files (1 required, 6 optional) load concurrently.
      const [teamsJson, leaguesJson, playersJson, trophiesJson, managersJson, attrJson, injuryJson] = await Promise.all([
        fetchFirstJson(urlSet('teams.json'), 'teams'),
        fetchFirstJson(urlSet('leagues.json'), 'leagues'),
        fetchFirstJson(urlSet('players.json'), 'player portraits'),
        fetchFirstJson(urlSet('trophies.json'), 'trophy images'),
        fetchFirstJson(urlSet('managers.json'), 'manager portraits'),
        fetchFirstJson(urlSet('player-attributes.json'), 'expanded player attributes'),
        fetchFirstJson(urlSet('injury.json'), 'injury definitions')
      ]);

      let loaded = null;
      let source = 'embedded';
      if (teamsJson && ((teamsJson.national && teamsJson.national.length) || (teamsJson.club && teamsJson.club.length))) {
        loaded = teamsJson;
        source = 'teams.json';
      }
      teamsData = loaded || TEAMS_DATA;
      if (!loaded) {
        source = 'embedded';
        console.warn('Using EMBEDDED team data — teams.json was NOT loaded from server');
      }
      repairDuplicatePlayerIds();
      allTeams = [...(teamsData.national || []), ...(teamsData.club || [])];
      if (!allTeams.length) throw new Error('No teams found');
      // Resolve every team's manager playstyle now (teams.json "playstyle" if
      // set, otherwise a random one) so it's stable for the rest of the session.
      allTeams.forEach(getManagerPlaystyle);
      // Snapshot each player's raw teams.json overall (rawOvr) before form
      // restoration or attribute boosting touch p.ovr at all — the overall
      // system below always derives a non-expanded player's baseline from
      // this untouched value, so the -5% adjustment can never compound
      // across repeated init() calls or save/reload sessions.
      allTeams.forEach(t => (t.players || []).forEach(p => { if (typeof p.rawOvr !== 'number') p.rawOvr = p.ovr; }));

      // leagues.json — optional, falls back to manual club selection in
      // Season Setup when absent.
      if (leaguesJson) leaguesData = leaguesJson;

      // players.json — optional, players just show their shirt number
      // instead of a portrait when absent.
      if (playersJson) playerPortraits = playersJson;

      // trophies.json — optional, trophies show the 🏆 emoji instead of an
      // image when absent.
      if (trophiesJson) trophyImages = trophiesJson;

      // managers.json — optional layer on top of the embedded
      // MANAGER_PORTRAITS_DATA baseline that's already loaded by default.
      if (managersJson) {
        const clean = { ...managersJson };
        delete clean._comment;
        managerPortraits = { ...MANAGER_PORTRAITS_DATA, ...clean };
      }

      // player-attributes.json — optional; the app works exactly as before
      // for any player not listed here. Canonicalize every entry's
      // playstyle tag spelling/casing right away (see
      // normalizePlayerPlaystyleTags) so a hand-authored casing mismatch
      // like "Fox In The Box" vs "Fox in the Box" can never silently drop
      // that player's entire playstyle-driven bonus stack.
      if (attrJson) {
        playerAttributesData = attrJson;
        normalizePlayerPlaystyleTags(playerAttributesData);
      }

      // injury.json — optional; the embedded INJURY_DEFS_DATA fallback
      // (js/state.js) already covers the app working with no server at
      // all. A valid fetched file with at least one entry fully replaces
      // it, so editing/extending injury.json's injury catalogue works
      // without a rebuild — same treatment as leagues.json/trophies.json.
      if (injuryJson && Array.isArray(injuryJson.injuries) && injuryJson.injuries.length) {
        injuryDefsData = injuryJson.injuries;
      }

      loadStats();
      loadPersistedGameState();
      restorePlayerForms();
      applyExpandedPlayerAttributes();
      ensureAllPlayerConditionProfiles();
      // Canonicalize every player's position codes (CF -> ST, RWF -> RW,
      // CMF -> CM, DMF -> CDM, SS/AMF -> CAM, etc.) so formation auto-fill,
      // substitutions, and position filters treat every naming variant of
      // the same real position identically — see normalizeAllPositions()
      // in js/state.js for why this has to run after
      // applyExpandedPlayerAttributes() (which is what sets pos from the
      // raw, non-canonical player-attributes.json codes in the first place).
      normalizeAllPositions(allTeams);
      populateTeamSelects();
      populateFormations();
      bindNav();
      renderTeamsList();
      restoreTournamentUI();
      restoreSeasonUI();
      const savedView = (function () { try { return localStorage.getItem('apexActiveView'); } catch (e) { return null; } })();
      if (savedView && savedView !== 'home' && document.getElementById('view-' + savedView)) switchView(savedView);
      setupAutoSave();
      try {
        if (sessionStorage.getItem('apexJustReset') === '1') {
          sessionStorage.removeItem('apexJustReset');
          setTimeout(() => toast('All data reset — fresh start'), 300);
        }
        if (sessionStorage.getItem('apexJustImported') === '1') {
          sessionStorage.removeItem('apexJustImported');
          setTimeout(() => toast('Save imported — progress restored'), 300);
        }
      } catch (e) {}
      console.log('Apex Sim ready:', allTeams.length, 'teams | source:', source);
      window.__APEX_DATA_SOURCE = source;
    } catch (e) {
      console.error(e);
      alert('Error loading game: ' + e.message);
    }
  }

  function bindNav() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        if (view) switchView(view);
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      }
    });
  }

  function switchView(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => { t.classList.remove('active'); t.removeAttribute('aria-current'); });
    const viewEl = document.getElementById('view-' + view);
    if (viewEl) viewEl.classList.add('active');
    const tabEl = document.querySelector(`.nav-tab[data-view="${view}"]`);
    if (tabEl) { tabEl.classList.add('active'); tabEl.setAttribute('aria-current', 'page'); }
    if (view === 'leaderboard') showLeaderboard('goals');
    if (view === 'awards') showAwards('overview');
    if (view === 'history') showHistory(historyActiveTab || 'team');
    if (view === 'teams') renderTeamsList();
    if (view === 'players') renderPlayersList(false);
    if (view === 'hospital') renderHospitalList();
    if (view === 'season') goToSeason();
  }

  function randomMatch(category) {
    // category: 'national' | 'club' | 'all'
    let pool = allTeams;
    if (category === 'national') pool = teamsData.national || [];
    if (category === 'club') pool = teamsData.club || [];
    if (pool.length < 2) { toast('Need at least 2 teams'); return; }
    const shuffled = shuffleArray([...pool]);
    const home = shuffled[0], away = shuffled[1];
    goToMatch();
    const homeSel = document.getElementById('home-team');
    const awaySel = document.getElementById('away-team');
    if (homeSel) homeSel.value = home.id;
    if (awaySel) awaySel.value = away.id;
    updateTeamPreview('home'); updateTeamPreview('away');
    // Formations reflect each team's set formation (from teams.json) if any,
    // otherwise a per-team default that spreads teams across the pool.
    const hf = document.getElementById('home-formation');
    const af = document.getElementById('away-formation');
    if (hf) hf.value = pickTeamFormation(home);
    if (af) af.value = pickTeamFormation(away);
    toast(`${home.flag||''} ${home.name} vs ${away.flag||''} ${away.name}`);
  }
  // Randomizes a single side (home or away) from a chosen pool (club or
  // national), leaving the other side exactly as it is — unlike
  // randomMatch() above, which always re-rolls both sides together from
  // the same pool. Lets the person mix, e.g. a random club side at home
  // against a random national side away, or just re-roll one side without
  // disturbing a pick they already like on the other.
  function randomizeTeamSide(side, category) {
    const otherSide = side === 'home' ? 'away' : 'home';
    let pool = category === 'national' ? (teamsData.national || []) : (teamsData.club || []);
    if (!pool.length) { toast('No teams available'); return; }
    const otherSel = document.getElementById(otherSide + '-team');
    const otherId = otherSel ? otherSel.value : null;
    // Prefer a pick that doesn't duplicate whatever's already on the other
    // side, but fall back to the full pool if that would leave nothing to
    // choose from (e.g. a two-team national pool).
    let candidates = pool.filter(t => t.id !== otherId);
    if (!candidates.length) candidates = pool;
    const pick = shuffleArray(candidates)[0];
    goToMatch();
    const sel = document.getElementById(side + '-team');
    if (sel) sel.value = pick.id;
    updateTeamPreview(side);
    const formSel = document.getElementById(side + '-formation');
    if (formSel) formSel.value = pickTeamFormation(pick);
    toast(`${pick.flag||''} ${pick.name} set as ${side === 'home' ? 'Home' : 'Away'}`);
  }

  function goToMatch() {
    switchView('match');
    const setup = document.getElementById('match-setup');
    const live = document.getElementById('match-live');
    if (setup) setup.style.display = 'block';
    if (live) live.style.display = 'none';
    // Plain Kick Off from Home — not linked to any tournament or season fixture.
    // `tournament` must be cleared here too (not just the fixture-index flags
    // below): matchCompetitionLabel() checks `tournament` first when labelling
    // a completed match for the player/team match logs, so a stale tournament
    // object left over from a previous tournament run (only ever cleared by
    // resetTournament(), never just by navigating away) caused every
    // "friendly" match played afterward to be mislabelled with the old
    // tournament's name instead of falling through to "Friendly".
    tournament = null;
    window._tourFixtureIdx = null;
    window._uclFixtureIdx = null;
    window._koRoundIdx = null;
    window._koMatchIdx = null;
    window._fromTournament = false;
    window._seasonFixture = null;
    window._backTarget = null;
    currentSeasonComp = null;
  }

  function goToTournament(type) {
    switchView('tournament');
    const setup = document.getElementById('tournament-setup');
    const live = document.getElementById('tournament-live');
    if (setup) setup.style.display = 'block';
    if (live) live.style.display = 'none';
    selectTournamentFormat(type || tournamentType || 'worldcup');
  }
  // Applies a tournament format selection — used by the Home mode-cards, the
  // Tournament tab's own format <select>, and restoreTournamentUI() on
  // reload. Updates tournamentType, the setup card's title/description
  // (from the TOURNAMENT_FORMATS registry), keeps the <select> in sync, and
  // re-renders the eligible team picker for that format.
  function selectTournamentFormat(key) {
    tournamentType = (key && TOURNAMENT_FORMATS[key]) ? key : 'worldcup';
    const cfg = TOURNAMENT_FORMATS[tournamentType];
    const title = document.getElementById('tournament-title');
    const desc = document.getElementById('tournament-desc');
    if (title) title.textContent = cfg.name + ' Setup';
    if (desc) desc.textContent = cfg.desc;
    const select = document.getElementById('tour-format-select');
    if (select && select.value !== tournamentType) select.value = tournamentType;
    tourTeamsSearch = '';
    tourSelectedTeamIds = new Set();
    const search = document.getElementById('tour-teams-search');
    if (search) search.value = '';
    applyTournamentBranding(tournamentType);
    renderTournamentTeamSelect();
  }
  // Applies a competition's logo + accent-color theme (from
  // getTournamentBranding()) to the setup card and the live tournament view:
  // sets --tour-color/--tour-color-dim custom properties consumed by the
  // .tour-themed rules in styles.css, and points the #tour-logo-setup /
  // #tour-logo-live <img> tags at assets/images/<logo>. If the image file
  // hasn't been added yet (or fails to load), the logo just stays hidden —
  // the color theme still applies on its own. Also stamps a short format
  // badge ("League Season", "Knockout Cup", "Group Stage", "League Phase")
  // onto both header rows and toggles the format-specific body class, so a
  // competition's whole identity — not just its colors — visibly changes
  // between formats (see .tour-format-* rules in styles.css).
  function applyTournamentBranding(formatKey) {
    const b = getTournamentBranding(formatKey);
    const cfg = TOURNAMENT_FORMATS[formatKey] || {};
    const badgeText = tourEngineBadgeLabel(cfg.engine);
    [
      { root: 'tournament-setup', logo: 'tour-logo-setup', badge: 'tour-format-badge-setup' },
      { root: 'tournament-live', logo: 'tour-logo-live', badge: 'tour-format-badge-live' }
    ].forEach(({ root, logo, badge }) => {
      const rootEl = document.getElementById(root);
      if (rootEl) {
        rootEl.classList.add('tour-themed');
        rootEl.style.setProperty('--tour-color', b.color);
        rootEl.style.setProperty('--tour-color-dim', b.colorDim);
        TOUR_ENGINE_CLASSES.forEach(c => rootEl.classList.remove(c));
        rootEl.classList.add('tour-format-' + (cfg.engine || 'groups'));
      }
      const img = document.getElementById(logo);
      if (img) {
        img.onerror = function() { this.style.display = 'none'; };
        img.alt = cfg.name || '';
        img.title = cfg.name || '';
        img.style.display = '';
        img.src = 'assets/images/' + b.logo;
      }
      const badgeEl = document.getElementById(badge);
      if (badgeEl) badgeEl.textContent = badgeText;
    });
  }
  const TOUR_ENGINE_CLASSES = ['tour-format-groups', 'tour-format-league', 'tour-format-knockout', 'tour-format-table'];

  // Short human label for a tournament engine type, used for the format
  // badge stamped next to the competition logo/title so every tournament
  // visibly announces what kind of competition it is, not just its color.
  function tourEngineBadgeLabel(engine) {
    if (engine === 'table') return '⚽ League Season';
    if (engine === 'league') return '🏆 League Phase + Knockout';
    if (engine === 'knockout') return '🏆 Knockout Cup';
    return '🌍 Group Stage';
  }

  function populateTeamSelects() {
    const home = document.getElementById('home-team');
    const away = document.getElementById('away-team');
    if (!home || !away) return;
    home.innerHTML = ''; away.innerHTML = '';
    const groups = [
      { label: 'National Teams', teams: teamsData.national || [] },
      { label: 'Club Teams', teams: teamsData.club || [] }
    ];
    groups.forEach(g => {
      if (!g.teams.length) return;
      const og1 = document.createElement('optgroup'); og1.label = g.label;
      const og2 = document.createElement('optgroup'); og2.label = g.label;
      g.teams.forEach(t => {
        // Plain flag+name stays as the native <option> text (used for
        // screen readers / the hidden fallback <select>) — the searchable
        // dropdown panel (see enhanceSelect() in ui/matchUI.js) reads these
        // data attributes instead so it can show the team's actual logo,
        // falling back to the flag only when no logo is set.
        const label = (t.flag || '') + ' ' + t.name;
        const opt1 = new Option(label, t.id);
        opt1.dataset.logo = t.logo || '';
        opt1.dataset.flag = t.flag || '';
        opt1.dataset.name = t.name;
        const opt2 = new Option(label, t.id);
        opt2.dataset.logo = t.logo || '';
        opt2.dataset.flag = t.flag || '';
        opt2.dataset.name = t.name;
        og1.appendChild(opt1);
        og2.appendChild(opt2);
      });
      home.appendChild(og1); away.appendChild(og2);
    });
    if ((teamsData.national || []).length > 1) {
      home.value = teamsData.national[0].id;
      away.value = teamsData.national[1].id;
    } else if (allTeams.length > 1) {
      home.value = allTeams[0].id;
      away.value = allTeams[1].id;
    }
    updateTeamPreview('home');
    updateTeamPreview('away');
  }

  function populateFormations() {
    ['home-formation', 'away-formation'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = '';
      Object.keys(FORMATIONS).forEach(k => sel.appendChild(new Option(FORMATIONS[k].name, k)));
      sel.value = '4-3-3';
    });
  }

  function getTeam(id) { return allTeams.find(t => t.id === id); }

  // Every match is played at the home team's stadium. Falls back to Wembley
  // Stadium whenever a team in teams.json doesn't define its own "stadium".
  function getStadium(team) { return (team && team.stadium) ? team.stadium : 'Wembley Stadium'; }

  // ========== TEAM LOGOS / PLAYER PORTRAITS ==========
  // Renders a team's logo (from assets/logos/<team.logo>, set via the "logo"
  // field in teams.json) as a small inline mark, falling back to the flag
  // emoji if no logo is set or the image fails to load.
  function teamMark(team, size) {
    size = size || 22;
    const flag = (team && team.flag) || '⚽';
    if (team && team.logo) {
      const src = 'assets/logos/' + team.logo;
      return `<span class="team-mark" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.82)}px"><img src="${src}" alt="" loading="lazy" onerror="this.parentElement.textContent='${flag}'"></span>`;
    }
    return `<span class="team-mark" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.82)}px">${flag}</span>`;
  }

  // Larger circular version for profile-avatar style containers (fills the
  // whole circle). Falls back to the flag emoji on missing/broken image.
  function teamAvatarMark(team) {
    const flag = (team && team.flag) || '⚽';
    if (team && team.logo) {
      const src = 'assets/logos/' + team.logo;
      return `<img src="${src}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:50%" onerror="this.outerHTML='${flag}'">`;
    }
    return flag;
  }

  // Looks up a player's portrait filename in players.json. Supports both
  // keying conventions: by player id (e.g. "rma26_7") or by exact player
  // name (e.g. "Vinicius Junior") — id is checked first since it's the
  // more specific, collision-proof key. Returns null if neither is found.
  function resolvePlayerPortrait(player) {
    if (!player) return null;
    if (player.id != null && playerPortraits[player.id]) return playerPortraits[player.id];
    if (player.name && playerPortraits[player.name]) return playerPortraits[player.name];
    return null;
  }

  // Renders a player's portrait (from assets/portraits/<file>, looked up by
  // id or name in players.json) filling a circular avatar container. Falls
  // back to assets/portraits/none.png when no entry exists in players.json,
  // and further falls back to the player's shirt number if even none.png
  // fails to load.
  function playerAvatarMark(player) {
    const num = (player && player.num != null) ? player.num : '?';
    const file = resolvePlayerPortrait(player);
    const src = 'assets/portraits/' + (file || 'none.png');
    return `<img src="${src}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.outerHTML='${num}'">`;
  }

  // Shortens a full name to "F. Lastname" for tight spaces like formation
  // dots — e.g. "Alessandro Nesta" -> "A. Nesta". Only abbreviates when the
  // surname is longer than 2 characters; short surnames (and single-word
  // names, which have nothing to abbreviate) are left as-is.
  function abbreviateName(fullName) {
    const trimmed = (fullName || '').trim();
    const spaceIdx = trimmed.indexOf(' ');
    if (spaceIdx === -1) return trimmed;
    const first = trimmed.slice(0, spaceIdx);
    const last = trimmed.slice(spaceIdx + 1).trim();
    if (last.length > 2 && first.length) return first[0] + '. ' + last;
    return trimmed;
  }
  // Wraps a player's display name in a gold "enhanced" span wherever
  // player-attributes.json gave them an expanded attribute sheet (see
  // applyExpandedPlayerAttributes in data/playerDatabase.js). Every list/row
  // that renders a player name across the app should go through this
  // instead of interpolating player.name directly, so enhanced players are
  // recognizable at a glance everywhere, not just on their profile page.
  //
  // Accepts either a full player object (checked directly for .attrBoosted)
  // or a lighter-weight record like a match/season stat row that only
  // carries an id — those are resolved through the id->player index so the
  // highlight still works without each call site needing to look the
  // player up itself.
  function playerNameHTML(playerOrStatRow, displayNameOverride) {
    if (!playerOrStatRow) return displayNameOverride || '';
    const name = displayNameOverride != null ? displayNameOverride : (playerOrStatRow.name || '');
    let boosted = !!playerOrStatRow.attrBoosted;
    if (!boosted && playerOrStatRow.attrBoosted === undefined && playerOrStatRow.id != null) {
      const found = findPlayerAndTeam(playerOrStatRow.id);
      if (found) boosted = !!found.player.attrBoosted;
    }
    return boosted ? `<span class="player-name-enhanced" title="Enhanced attribute player">${name}</span>` : name;
  }

  // Renders a small circular portrait for leaderboard/award rows, looked up
  // by id or name in players.json (same source as playerAvatarMark). Falls
  // back to assets/portraits/none.png when no portrait is found, and
  // further falls back to the player's initials on a coloured circle if
  // even none.png fails to load — this keeps two different players who
  // happen to share a name from silently displaying as visually identical
  // avatars, since initials are still derived per-row from that row's own
  // name/id, never borrowed from another row.
  function initialsOf(name) {
    return (name || '?').trim().split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
  }
  function lbAvatar(p, size) {
    size = size || 34;
    const initials = initialsOf(p && p.name);
    const file = resolvePlayerPortrait(p);
    const src = 'assets/portraits/' + (file || 'none.png');
    return `<span class="lb-avatar" style="width:${size}px;height:${size}px"><img src="${src}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.parentElement.classList.add('lb-avatar-fallback');this.outerHTML='${initials}'"></span>`;
  }
  // Player name + portrait, for use inside a leaderboard/award table cell.
  function lbPlayerCell(p, size) {
    return `<div class="lb-player-cell">${lbAvatar(p, size)}<span class="lb-player-name">${playerNameHTML(p)}</span></div>`;
  }
  // Rank badge for position i (0-indexed): medal for top 3, plain number after.
  function rankBadge(i) {
    const n = i + 1;
    if (n === 1) return `<span class="lb-rank-badge rank-1">🥇</span>`;
    if (n === 2) return `<span class="lb-rank-badge rank-2">🥈</span>`;
    if (n === 3) return `<span class="lb-rank-badge rank-3">🥉</span>`;
    return `<span class="lb-rank-badge">${n}</span>`;
  }

  // Renders a trophy image (from assets/trophies/<file>, looked up by exact
  // trophy/competition name in trophies.json) inside a rounded container,
  // falling back to the 🏆 emoji when no image is mapped for that name.
  function trophyMark(name, size) {
    size = size || 40;
    const file = name && trophyImages[name];
    if (file) {
      const src = 'assets/trophies/' + file;
      return `<span class="trophy-mark" style="width:${size}px;height:${size}px"><img src="${src}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain" onerror="this.parentElement.outerHTML='<span class=&quot;trophy-mark trophy-mark-fallback&quot; style=&quot;width:${size}px;height:${size}px;font-size:${Math.round(size*0.6)}px&quot;>🏆</span>'"></span>`;
    }
    return `<span class="trophy-mark trophy-mark-fallback" style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.6)}px">🏆</span>`;
  }

  // Looks up a manager's portrait filename in managers.json. Tries an exact
  // name match first, then falls back to a trimmed/case-insensitive match so
  // small formatting differences between teams.json and managers.json (extra
  // whitespace, different casing) don't silently drop a portrait that exists.
  function resolveManagerPortrait(manager) {
    if (!manager || !manager.name) return null;
    if (managerPortraits[manager.name]) return managerPortraits[manager.name];
    const target = manager.name.trim().toLowerCase();
    for (const key in managerPortraits) {
      if (key.trim().toLowerCase() === target) return managerPortraits[key];
    }
    return null;
  }

  // Renders a manager's portrait (from assets/mportraits/<file>, looked up by
  // name in managers.json) inside a circular avatar. Falls back to
  // assets/mportraits/none.png when no entry exists in managers.json, and
  // further falls back to a suit-and-tie badge if even none.png fails to load.
  // Used anywhere a manager appears: match setup preview, live scoreboard,
  // formation pitch label, Teams tab list, and the full Team profile modal.
  function managerAvatarMark(manager, size) {
    size = size || 32;
    const file = resolveManagerPortrait(manager);
    const src = 'assets/mportraits/' + (file || 'none.png');
    return `<span class="mgr-avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.55)}px"><img src="${src}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.parentElement.classList.add('mgr-avatar-fallback');this.innerHTML='🧑\u200d💼'"></span>`;
  }

  function updateTeamPreview(side) {
    const sel = document.getElementById(side + '-team');
    const el = document.getElementById(side + '-preview');
    if (!sel || !el) return;
    const team = getTeam(sel.value);
    if (!team) { el.innerHTML = ''; return; }
    const mgr = team.manager ? team.manager.name : '';
    const style = getManagerPlaystyle(team);
    const venueLine = side === 'home' ? `<div style="font-size:0.8rem;color:var(--text-muted)">🏟️ ${getStadium(team)}</div>` : '';
    const mgrLine = mgr ? `<div class="manager-name">${managerAvatarMark(team.manager, 20)} Manager: ${mgr}${style ? ' <span class="playstyle-tag">· ' + style + '</span>' : ''}</div>` : '';
    el.innerHTML = `<span class="team-flag">${teamMark(team, 32)}</span><div><div class="team-name">${team.name}</div>${mgrLine}<div style="font-size:0.8rem;color:var(--text-muted)">${(team.players||[]).length} players</div>${venueLine}</div>`;
    const formSel = document.getElementById(side + '-formation');
    if (formSel) {
      // If this side has a saved custom lineup for the currently-selected
      // team, keep the visible formation dropdown in sync with *that*
      // lineup's formation rather than overwriting it with the team's
      // computed default — otherwise the dropdown (which startMatch()
      // reads to decide whether the custom lineup still applies) silently
      // drifts away from what was actually saved in the Squad Builder,
      // and the custom lineup gets discarded at kickoff even though it
      // saved successfully.
      const custom = customLineups[side];
      formSel.value = (custom && custom._teamId === team.id) ? custom.formation : pickTeamFormation(team);
    }
  }

  // Picks a formation for a team. If the team's manager has a "formation"
  // key set in teams.json (team.manager.formation, matching a valid
  // FORMATIONS entry) that formation is used strictly as the team's default
  // starting shape — though it can still be changed mid-match via the live
  // tactics panel. Otherwise a formation is deterministically derived from
  // the team's id/name so the same team tends to line up the same way match
  // to match, while different teams spread out across the available
  // formation pool instead of everyone randomly converging on the same one
  // or two shapes.
  function pickTeamFormation(team) {
    const setFormation = team && team.manager && team.manager.formation;
    if (setFormation && FORMATIONS[setFormation]) return setFormation;
    if (team && team._aiFormation && FORMATIONS[team._aiFormation]) return team._aiFormation;
    // Formation choice now follows from the manager's identity instead of a
    // flat hash of the team name — a Long Ball/defensive-minded manager's
    // team gravitates toward compact, defense-heavy shapes; a Possession
    // manager toward a numbers-up midfield; Overload/Out Wide toward shapes
    // with genuine width. Still deterministic per team for the session (so
    // it doesn't re-roll every match) via a stable hash, but the hash now
    // only picks among the handful of formations that actually fit the
    // manager's style, not all twenty regardless of identity.
    const style = getManagerPlaystyle(team);
    const pref = PLAYSTYLE_FORM_PREF[style] || { fwd: 0.6, def: 0.6, wide: 0.6, mid: 0.6 };
    const keys = Object.keys(FORMATIONS);
    const idKey = (team && (team.id || team.name)) || '';
    let hash = 0;
    for (let i = 0; i < idKey.length; i++) hash = (hash * 31 + idKey.charCodeAt(i)) >>> 0;
    const scored = keys.map(k => {
      const shape = formationShape(k);
      const wide = formationWideCount(k);
      const score = shape.fwd * pref.fwd + shape.def * pref.def + shape.mid * (pref.mid || 0.6) + wide * (pref.wide || 0.6);
      return { k, score };
    }).sort((a, b) => b.score - a.score);
    const poolSize = Math.min(5, scored.length);
    const pick = scored[hash % poolSize].k;
    if (team) team._aiFormation = pick;
    return pick;
  }

  // How hard the "recently started" rotation penalty bites, and how
  // protected a squad's core spine is from it, depending on the
  // competition. League football sees the heaviest week-to-week rotation
  // (fixture congestion managed domestically); "group tournament" football
  // (Champions League league phase, World Cup/standalone tournament groups
  // and knockouts) sees managers overwhelmingly send out their strongest
  // XI; a domestic cup (once available) would see the heaviest rotation of
  // all, giving fringe players and squad depth their minutes first.
  const ROTATION_PROFILES = {
    league: { decay: 0.2,  penalty: 3.5, rand: 2.5, coreProtect: 0.55 },
    ucl:    { decay: 0.35, penalty: 1.0, rand: 1.0, coreProtect: 0.9 },
    cup:    { decay: 0.15, penalty: 5.5, rand: 3.5, coreProtect: 0.15 }
  };

  // Infers which rotation profile applies to whatever match is about to be
  // built, from the global sim context, so most call sites don't need to
  // know or pass it explicitly. A standalone tournament (World Cup /
  // Champions League tournament mode) is always "group tournament"
  // football; inside a Season, only the Champions League competition
  // counts as one — every domestic league fixture rotates on the heavier
  // "league" profile.
  function inferRotationProfile() {
    if (typeof tournament !== 'undefined' && tournament) return 'ucl';
    if (typeof currentSeasonComp !== 'undefined' && currentSeasonComp && currentSeasonComp.key === 'ucl') return 'ucl';
    return 'league';
  }

  // The tactical "core" of a squad — the first-choice keeper plus the
  // highest-OVR outfield players, a rough proxy for the spine a manager
  // builds their team around (first-choice centre-back pairing, defensive
  // mid, main striker, etc). Core players are much less affected by the
  // rotation penalty below regardless of competition, and are almost never
  // rotated out for important "group tournament" fixtures.
  function computeCoreIds(allPlayers) {
    const core = new Set();
    const gks = allPlayers.filter(p => (p.pos || [])[0] === 'GK').sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    if (gks[0]) core.add(gks[0].id);
    const outfield = allPlayers.filter(p => (p.pos || [])[0] !== 'GK').sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    outfield.slice(0, 6).forEach(p => core.add(p.id));
    return core;
  }

  function buildSquad(team, formationKey, rotationProfile) {
    const formation = FORMATIONS[formationKey] || FORMATIONS['4-3-3'];
    const allPlayers = team.players || [];
    const prof = ROTATION_PROFILES[rotationProfile || inferRotationProfile()] || ROTATION_PROFILES.league;
    const coreIds = computeCoreIds(allPlayers);

    // Soft squad rotation: every player carries a small "recently started"
    // counter that decays a bit each match. Selection score below docks
    // players who've started often lately, so the exact same XI doesn't
    // take the pitch match after match — while still keeping OVR as the
    // dominant factor, so rotation favors genuinely close alternatives
    // rather than randomly benching your best player. How hard that bites,
    // and how protected the squad's core is from it, depends on the
    // competition (see ROTATION_PROFILES above).
    allPlayers.forEach(p => { p._recentStarts = Math.max(0, (p._recentStarts || 0) - prof.decay); });
    const score = (p) => {
      const protect = coreIds.has(p.id) ? prof.coreProtect : 1;
      return (p.ovr || 70) - (p._recentStarts || 0) * prof.penalty * protect + (seededRandom() * prof.rand - prof.rand / 2);
    };

    let players = shuffleArray(allPlayers.filter(p => !isPlayerInjured(p.id) && !isPlayerSuspended(p.id)));
    if (players.length < 11) {
      // Emergency: allow injured/suspended if roster too thin
      players = players.concat(shuffleArray(allPlayers.filter(p => isPlayerInjured(p.id) || isPlayerSuspended(p.id))));
    }

    const used = new Set();
    const slotOf = new Map(); // slot index -> player

    // Pass 1 — a player's FIRST-listed position is their real position and
    // always gets first claim on a matching slot, ahead of anyone who's
    // merely compatible with it. This stops, e.g., a CB who's also listed
    // as RB-compatible from being slotted in at CB ahead of a natural RB
    // just because formation slots happen to be processed in that order.
    formation.slots.forEach((slot, i) => {
      const candidates = players.filter(p => !used.has(p.id) && (p.pos || [])[0] === slot)
        .sort((a, b) => score(b) - score(a));
      if (candidates.length) {
        used.add(candidates[0].id);
        slotOf.set(i, candidates[0]);
      }
    });

    // Pass 2 — only for slots still empty after pass 1 (this formation has
    // no natural fit available). Fill from compatible secondary positions,
    // preferring whoever's closest to a natural fit (lower index in their
    // own pos list) before falling back to plain selection score. A player
    // whose primary position never got a slot in pass 1, and who isn't
    // needed here either, simply stays unused — i.e., benched — rather
    // than being forced out of position to make up the numbers.
    formation.slots.forEach((slot, i) => {
      if (slotOf.has(i)) return;
      const candidates = players.filter(p => !used.has(p.id) && canPlay(p, slot))
        .sort((a, b) => {
          const aIdx = (a.pos || []).indexOf(slot);
          const bIdx = (b.pos || []).indexOf(slot);
          const aRank = aIdx === -1 ? 99 : aIdx;
          const bRank = bIdx === -1 ? 99 : bIdx;
          if (aRank !== bRank) return aRank - bRank;
          return score(b) - score(a);
        });
      if (candidates.length) {
        used.add(candidates[0].id);
        slotOf.set(i, candidates[0]);
      }
    });

    const starting = [];
    formation.slots.forEach((slot, i) => {
      const p = slotOf.get(i);
      if (p) starting.push({ ...p, slot, isStarter: true });
    });

    // Fallback fill if the squad is too thin to fill every slot even via
    // pass 2 — field whoever's left regardless of position, so we always
    // put out 11 players.
    while (starting.length < 11) {
      const leftover = players.find(p => !used.has(p.id));
      if (!leftover) break;
      used.add(leftover.id);
      starting.push({ ...leftover, slot: (leftover.pos || ['CM'])[0], isStarter: true });
    }

    const remaining = players.filter(p => !used.has(p.id)).sort((a, b) => score(b) - score(a));
    const subs = [];
    for (let i = 0; i < remaining.length && (starting.length + subs.length) < 25; i++) {
      subs.push({ ...remaining[i], slot: (remaining[i].pos || ['CM'])[0], isStarter: false });
    }

    // Whoever actually started is now less likely to start again straight
    // away next match (see rotation decay/score above).
    starting.forEach(sp => {
      const orig = allPlayers.find(x => x.id === sp.id);
      if (orig) orig._recentStarts = (orig._recentStarts || 0) + 1;
    });

    const _seen = new Set();
    const _st = [];
    for (const p of starting) { if (_seen.has(p.id)) continue; _seen.add(p.id); _st.push(p); }
    const _su = [];
    for (const p of subs) { if (_seen.has(p.id)) continue; _seen.add(p.id); _su.push(p); }
    return { starting: _st, subs: _su, formation: formationKey, all: [..._st, ..._su], rotationProfile: rotationProfile || inferRotationProfile() };
  }

  function canPlay(player, slot) {
    const positions = player.pos || [];
    return positions.some(p => (POS_COMPAT[slot] || [slot]).includes(p) || p === slot);
  }

  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ===================================================================
  // ===================== SQUAD BUILDER (full page) =====================
  // ===================================================================
  // The Squad Builder is a dedicated full-page lineup/formation editor
  // (view-squadbuilder in index.html), opened per-side from the Match
  // Setup screen. sbDraft below is the in-progress editing state for
  // whichever side (home/away) is currently open; it is discarded on
  // close/save. customLineups[side] is the *saved* result — a squad
  // object (same shape buildSquad() returns) plus manualRoles/
  // customCoords — consumed by startMatch() in engine/matchEngine.js
  // exactly like an auto-built squad, so nothing downstream needs to
  // know a lineup was hand-built.
  let customLineups = { home: null, away: null };
  let sbSide = null;
  let sbDraft = null;
  // Active pointer-drag (player) / coordinate-drag (formation marker) —
  // module-level so the document-level pointermove/pointerup listeners
  // added in sbGrab()/sbCoordMove-family can find them.
  let sbDrag = null;
  let sbCoordDrag = null;
  let sbGhostEl = null;

  function onFormationChange(side) {
    if (customLineups[side]) customLineups[side] = null;
  }
  // Finds where a player currently sits in the in-progress draft — a
  // starting slot, the bench, or (implicitly) the reserves, since reserve
  // players aren't tracked in any set of their own; anyone not in slots
  // or bench simply *is* a reserve. Returns a small "location" object in
  // the same shape sbGrab()/sbPlacePlayer() pass around everywhere.
  function sbLocateInDraft(playerId) {
    for (const k in sbDraft.slots) {
      if (sbDraft.slots[k] === playerId) return { kind: 'slot', id: playerId, slotIdx: +k };
    }
    if (sbDraft.bench.has(playerId)) return { kind: 'bench', id: playerId };
    return { kind: 'reserve', id: playerId };
  }

  // The single move operation behind every interaction in the builder —
  // dragging, tapping-to-place, and the fallback slot picker all funnel
  // through here. Moving a player onto an occupied starting slot swaps
  // the two (the displaced starter lands wherever the incoming player
  // came from — their old slot, the bench, or the bench if they were a
  // reserve, since a starter can never be left with nowhere to go).
  // Moving onto the bench or into reserves just detaches them from
  // wherever they were.
  function sbPlacePlayer(source, destKind, destSlotIdx) {
    if (!sbDraft || !source || !source.id) return;
    if (destKind === 'slot' && source.kind === 'slot' && source.slotIdx === destSlotIdx) return;
    if (destKind === 'bench' && source.kind === 'bench') return;
    if (destKind === 'reserve' && source.kind === 'reserve') return;

    if (destKind === 'bench' && !sbDraft.bench.has(source.id) && sbDraft.bench.size >= 14) {
      toast('Max 14 substitutes');
      return;
    }

    // Detach the moving player from their current spot first.
    if (source.kind === 'slot') delete sbDraft.slots[source.slotIdx];
    if (source.kind === 'bench') sbDraft.bench.delete(source.id);

    if (destKind === 'slot') {
      const occupantId = sbDraft.slots[destSlotIdx];
      if (occupantId && occupantId !== source.id) {
        if (source.kind === 'slot') sbDraft.slots[source.slotIdx] = occupantId; // swap
        else sbDraft.bench.add(occupantId); // displaced starter goes to the bench
      }
      sbDraft.slots[destSlotIdx] = source.id;
      sbDraft.bench.delete(source.id);
    } else if (destKind === 'bench') {
      sbDraft.bench.add(source.id);
    }
    // destKind === 'reserve': already detached above, nothing further to do.
  }

  // One-tap alternatives to dragging a chip between the Substitutes and
  // Reserves lists — same underlying move as a drag/drop onto that zone,
  // just addressable directly from a button on the chip itself. No-ops
  // quietly (via sbPlacePlayer's own guards) if the player is already
  // where they're being asked to go, or the bench is already full.
  function sbMoveToReserve(playerId) {
    if (!sbDraft) return;
    const source = sbLocateInDraft(playerId);
    sbPlacePlayer(source, 'reserve');
    sbDraft.selected = null;
    renderSquadBuilderUI();
  }

  function sbMoveToBench(playerId) {
    if (!sbDraft) return;
    const source = sbLocateInDraft(playerId);
    sbPlacePlayer(source, 'bench');
    sbDraft.selected = null;
    renderSquadBuilderUI();
  }
  function openSquadBuilder(side) {
    try {
      sbSide = side;
      const teamSel = document.getElementById(side + '-team');
      const formSel = document.getElementById(side + '-formation');
      const teamId = teamSel && teamSel.value;
      const team = getTeam(teamId);
      if (!team) { toast('Select a team first'); return; }

      // Prefer whatever formation this side's saved custom lineup actually
      // used (if it's for this same team) over the visible dropdown value —
      // this is what lets a saved custom formation survive even if the
      // dropdown display ever falls out of sync for any reason.
      const savedForTeam = (customLineups[side] && customLineups[side]._teamId === team.id) ? customLineups[side] : null;
      const formKey = (savedForTeam && savedForTeam.formation) || (formSel && formSel.value) || '4-3-3';

      const formation = FORMATIONS[formKey] || FORMATIONS['4-3-3'];
      const players = [];
      const seenP = new Set();
      (team.players || []).forEach(p => {
        if (p && p.id && !seenP.has(p.id)) { seenP.add(p.id); players.push(p); }
      });

      let slots = {};
      let bench = new Set();
      let roles = {};
      let coords = formation.coords.map(c => c.slice());
      let slotRoles = {};
      const saved = customLineups[side];
      if (saved && saved.formation === formKey && saved._teamId === team.id) {
        saved.starting.forEach((p, i) => { slots[i] = p.id; });
        (saved.subs || []).forEach(p => bench.add(p.id));
        roles = Object.assign({}, saved.manualRoles || {});
        if (saved.customCoords) coords = saved.customCoords.map(c => c.slice());
        if (saved.customSlotRoles) slotRoles = Object.assign({}, saved.customSlotRoles);
      } else {
        const auto = buildSquad(team, formKey);
        auto.starting.forEach((p, i) => { slots[i] = p.id; });
        (auto.subs || []).slice(0, 9).forEach(p => bench.add(p.id));
      }

      sbDraft = { side, team, formation: formKey, slots, bench, roles, players, coords, slotRoles, editMode: 'lineup', selected: null };
      switchView('squadbuilder');
      const titleEl = document.getElementById('sb-page-title');
      if (titleEl) titleEl.textContent = (side === 'home' ? 'HOME' : 'AWAY') + ' · ' + team.name;
      sbSwitchTab('bench');
      renderFormationSelect();
      renderSquadBuilderUI();
    } catch (err) {
      console.error(err);
      toast('Squad builder error: ' + (err && err.message ? err.message : err));
    }
  }
  // Lets the person hop between editing the home and away lineups without
  // leaving the page — re-runs openSquadBuilder() for the other side,
  // picking up its own saved/auto lineup exactly as opening it fresh
  // would. Any unsaved change on the side being left behind is dropped,
  // same as tapping Cancel.
  function sbSwitchSide() {
    if (!sbDraft) return;
    openSquadBuilder(sbDraft.side === 'home' ? 'away' : 'home');
  }

  function sbSwitchTab(tab) {
    document.querySelectorAll('.sb-tab').forEach(function(t) { t.classList.toggle('active', t.dataset.sbTab === tab); });
    document.querySelectorAll('.sb-tab-panel').forEach(function(p) { p.style.display = 'none'; });
    const panel = document.getElementById('sb-tab-' + tab);
    if (panel) panel.style.display = 'block';
  }
  function getUsedInDraft() {
    const used = new Set(Object.values(sbDraft.slots).filter(Boolean));
    sbDraft.bench.forEach(function(id) { used.add(id); });
    return used;
  }
  function renderSquadBuilderSideButtons() {
    if (!sbDraft) return;
    const hb = document.getElementById('sb-side-home-btn');
    const ab = document.getElementById('sb-side-away-btn');
    if (hb) hb.classList.toggle('sb-side-active', sbDraft.side === 'home');
    if (ab) ab.classList.toggle('sb-side-active', sbDraft.side === 'away');
  }

  function renderFormationSelect() {
    const sel = document.getElementById('sb-formation-select');
    if (!sel || !sbDraft) return;
    sel.innerHTML = Object.keys(FORMATIONS).map(function(f) {
      return '<option value="' + f + '">' + FORMATIONS[f].name + '</option>';
    }).join('');
    sel.value = sbDraft.formation;
  }
  // Master re-render for the whole page — called after essentially every
  // interaction (drop, tap-to-place, role change, formation swap). The
  // squad involved is small (~25 players) so a full re-render is cheap;
  // the one hot path that isn't re-rendered on every tick is dragging
  // itself (see sbDragMove/sbCoordMove, which move elements directly).
  function renderSquadBuilderUI() {
    if (!sbDraft) return;
    sbDraft._eff = sbEffectiveRoles();
    renderSquadBuilderSideButtons();

    const editBtn = document.getElementById('sb-edit-mode-btn');
    if (editBtn) editBtn.textContent = sbDraft.editMode === 'formation' ? '✓ Done Editing Shape' : '✥ Edit Formation Shape';
    const pitchEl = document.getElementById('sb-pitch');
    if (pitchEl) pitchEl.classList.toggle('sb-pitch-edit', sbDraft.editMode === 'formation');
    const hint = document.getElementById('sb-hint');
    if (hint) {
      hint.textContent = sbDraft.editMode === 'formation'
        ? 'Drag the position markers to reshape your formation, then tap "Done Editing Shape".'
        : 'Drag a player onto the pitch, bench or reserves to place them — or tap a player, then tap where they should go.';
    }

    renderSquadBuilderPitch();

    const benchEl = document.getElementById('sb-bench-list');
    if (benchEl) benchEl.innerHTML = renderSquadBuilderBenchHTML();
    const resEl = document.getElementById('sb-reserves-list');
    if (resEl) resEl.innerHTML = renderSquadBuilderReserveHTML();
    const rolesEl = document.getElementById('sb-roles');
    if (rolesEl) rolesEl.innerHTML = renderSquadBuilderRolesHTML();

    const countsEl = document.getElementById('sb-counts');
    if (countsEl) {
      const starters = Object.values(sbDraft.slots).filter(Boolean).length;
      countsEl.textContent = starters + '/11 starting · ' + sbDraft.bench.size + ' subs · ' +
        (sbDraft.players.length - starters - sbDraft.bench.size) + ' reserve';
    }
    const benchTabBtn = document.querySelector('.sb-tab[data-sb-tab="bench"]');
    if (benchTabBtn) benchTabBtn.textContent = 'Substitutes (' + sbDraft.bench.size + ')';
  }
  // Draws the interactive pitch — same visual language (mini-pitch,
  // player-dot-style markers) as the live match pitch in
  // ui/matchUI.js::renderPitch(), so what you build here is recognizably
  // "the same pitch" you'll see once the match kicks off. In lineup mode
  // each dot is a player (or an empty "+" placeholder); in formation-edit
  // mode every dot becomes a draggable position marker labelled by its
  // slot code, regardless of whether it currently has a player on it.
  function renderSquadBuilderPitch() {
    if (!sbDraft) return;
    const el = document.getElementById('sb-pitch');
    if (!el) return;
    const formation = FORMATIONS[sbDraft.formation] || FORMATIONS['4-3-3'];
    const baseSlots = formation.slots;
    const team = sbDraft.team;
    const primary = team.color || '#1a237e';
    const secondary = team.secondary || '#ffffff';
    const editMode = sbDraft.editMode === 'formation';

    let dots = '';
    baseSlots.forEach(function(baseSlot, idx) {
      // The slot's *effective* role — its own manually-picked alternate
      // (e.g. a CM tapped into playing CAM) if one's been set, otherwise
      // the formation's default code for this position.
      const slot = sbEffectiveSlotCode(idx);
      const c = sbDraft.coords[idx] || formation.coords[idx] || [50, 50];
      const x = c[0], y = c[1];
      const pid = sbDraft.slots[idx];
      const p = pid ? sbDraft.players.find(function(pp) { return pp.id === pid; }) : null;
      const filled = !!p;
      const isSelected = !editMode && sbDraft.selected && sbDraft.selected.kind === 'slot' && sbDraft.selected.slotIdx === idx;
      const roleTag = (!editMode && p) ? sbRoleTagHTML(p.id) : '';
      const avatar = editMode ? '<span class="sb-dot-slot-code">' + baseSlot + '</span>'
        : (p ? playerAvatarMark(p) : '<span class="sb-dot-plus">+</span>');
      // Empty slots show the position code once (as the name line only) —
      // previously both dot-num and dot-name were set to the same slot
      // string, which rendered the position name twice back-to-back
      // (e.g. "CAMCAM").
      const label = editMode ? ''
        : '<span class="dot-label"><span class="dot-num">' + (p ? (p.num || '?') : '') + '</span>' +
          '<span class="dot-name">' + (p ? abbreviateName(p.name) : slot) + '</span></span>';
      // Position code shown above the dot, same badge style as the
      // jersey number below it. Skipped in edit-mode, where the dot's
      // own avatar already displays the slot code front and center.
      const posLabel = editMode ? '' : '<span class="dot-pos">' + slot + '</span>';
      const emptyTapHandler = (!filled && !editMode) ? ' onclick="App.sbEmptySlotTap(' + idx + ')"' : '';
      // Small tappable badge showing the slot's current role code — lets
      // you tap CM to switch it to CAM/CDM etc without disturbing the
      // player-select/drag tap already bound to the rest of the dot.
      // Only rendered where there's actually more than one sensible
      // alternative (a GK or CB slot has nowhere sensible to go).
      const alts = POS_ROLE_ALTS[baseSlot] || [baseSlot];
      const roleBadge = (!editMode && alts.length > 1)
        ? '<span class="sb-slot-role-badge' + (slot !== baseSlot ? ' changed' : '') + '"' +
          ' title="Change position role" onpointerdown="event.stopPropagation()"' +
          ' onclick="event.stopPropagation();App.openSlotRolePicker(' + idx + ')">' + slot + '</span>'
        : '';
      dots += '<div id="sb-dot-' + idx + '" class="sb-dot' + (filled ? ' filled' : '') + (isSelected ? ' selected' : '') + (editMode ? ' edit-mode' : '') + '"' +
        ' data-sb-drop="slot" data-slot-idx="' + idx + '"' +
        ' style="left:' + x + '%;top:' + y + '%;background:' + primary + ';border-color:' + secondary + '"' +
        ' onpointerdown="event.stopPropagation();App.sbGrab(event,\'slot\',' + idx + ')"' + emptyTapHandler + '>' +
        '<span class="dot-avatar">' + avatar + '</span>' + roleTag + roleBadge + posLabel + label +
        '</div>';
    });
    el.innerHTML = '<div class="pitch-label">' + teamMark(team, 16) + ' ' + (team.short || team.name) + ' · ' + formation.name + '</div>' + dots;
  }
  // Resolves slot idx -> its currently-active position code: the manual
  // override in sbDraft.slotRoles if one was picked, else the formation's
  // own default for that slot. Centralized here so every consumer of "what
  // position is this slot" (rendering, the player-eligibility picker, and
  // what actually gets saved/played) agrees with each other.
  function sbEffectiveSlotCode(idx) {
    if (!sbDraft) return null;
    const formation = FORMATIONS[sbDraft.formation] || FORMATIONS['4-3-3'];
    const base = formation.slots[idx];
    const override = sbDraft.slotRoles && sbDraft.slotRoles[idx];
    return (override && (POS_ROLE_ALTS[base] || []).includes(override)) ? override : base;
  }

  // Opens the same picker panel used for choosing a player, but filled
  // with this slot's sensible role alternatives instead (see
  // POS_ROLE_ALTS) — tapping the little position badge on a pitch dot.
  function openSlotRolePicker(idx) {
    if (!sbDraft) return;
    const formation = FORMATIONS[sbDraft.formation] || FORMATIONS['4-3-3'];
    const base = formation.slots[idx];
    const alts = POS_ROLE_ALTS[base] || [base];
    if (alts.length < 2) return;
    const current = sbEffectiveSlotCode(idx);
    let picker = document.getElementById('sb-picker');
    if (!picker) return;
    picker.style.display = 'block';
    picker.innerHTML = '<div class="sb-picker-head"><strong>Position Role</strong>' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="App.closeSlotPicker()">Close</button></div>' +
      '<div class="sb-picker-list">' + alts.map(function(code) {
        const name = POS_ROLE_NAMES[code] || code;
        return '<button type="button" class="sb-picker-item' + (code === current ? ' selected' : '') + '"' +
          ' onclick="App.setSquadSlotRole(' + idx + ',\'' + code + '\')">' +
          '<span class="sb-bench-num">' + code + '</span>' +
          '<span class="sb-bench-name">' + name + '</span>' +
          (code === base ? '<span class="sb-bench-meta">default</span>' : '<span class="sb-bench-meta">alt role</span>') +
          '</button>';
      }).join('') + '</div>';
    picker.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Applies a role change to a slot. Switching a slot's role can leave
  // its current occupant no longer eligible there (e.g. CM -> CAM is
  // fine for most central mids, but not for a pure CDM specialist) — if
  // so, they're bumped back to the bench rather than left illegally
  // filling a position they can't actually play, same as a formation
  // change does.
  function setSquadSlotRole(idx, code) {
    if (!sbDraft) return;
    const formation = FORMATIONS[sbDraft.formation] || FORMATIONS['4-3-3'];
    const base = formation.slots[idx];
    if (code === base) { delete sbDraft.slotRoles[idx]; }
    else { sbDraft.slotRoles[idx] = code; }
    const pid = sbDraft.slots[idx];
    if (pid) {
      const p = sbDraft.players.find(function(x) { return x.id === pid; });
      if (p && !canPlay(p, code)) {
        delete sbDraft.slots[idx];
        if (sbDraft.bench.size < 14) sbDraft.bench.add(pid);
      }
    }
    closeSlotPicker();
    renderSquadBuilderUI();
  }
  function openSlotPicker(index) {
    if (!sbDraft) return;
    const slot = sbEffectiveSlotCode(index);
    const used = getUsedInDraft();
    const selected = sbDraft.slots[index] || '';
    const list = sbDraft.players
      .filter(function(p) { return !used.has(p.id) || p.id === selected; })
      .sort(function(a, b) {
        const aFit = (a.pos || []).includes(slot) ? 1 : 0;
        const bFit = (b.pos || []).includes(slot) ? 1 : 0;
        if (bFit !== aFit) return bFit - aFit;
        return (b.ovr || 70) - (a.ovr || 70);
      });
    let picker = document.getElementById('sb-picker');
    if (!picker) return;
    picker.style.display = 'block';
    picker.innerHTML = '<div class="sb-picker-head"><strong>Select ' + slot + '</strong>' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="App.closeSlotPicker()">Close</button></div>' +
      '<div class="sb-picker-list">' + list.map(function(p) {
        const fit = (p.pos || []).includes(slot);
        return '<button type="button" class="sb-picker-item' + (p.id === selected ? ' selected' : '') + '" onclick="App.setSquadSlot(' + index + ',\'' + p.id + '\')">' +
          '<span class="sb-bench-num">' + (p.num || '?') + '</span>' +
          '<span class="sb-bench-name">' + p.name + '</span>' +
          '<span class="sb-bench-meta">' + ((p.pos || [])[0] || '') + ' · ' + p.ovr + (fit ? ' · fit' : '') + '</span></button>';
      }).join('') + '</div>';
    picker.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  // Combines manual overrides (sbDraft.roles) with the same auto-pick
  // logic the match engine itself uses (assignMatchRoles(), fed a
  // lightweight fake "side" built from the current starting XI) so what
  // shows here — badge on the pitch, "Auto — <name>" hint in the roles
  // panel — is always exactly what would happen if the role were left on
  // Auto. Recomputed once per render and cached on sbDraft._eff.
  function sbEffectiveRoles() {
    if (!sbDraft) return null;
    const formation = FORMATIONS[sbDraft.formation] || FORMATIONS['4-3-3'];
    const startersArr = formation.slots.map(function(slot, i) {
      const id = sbDraft.slots[i];
      const p = id ? sbDraft.players.find(function(x) { return x.id === id; }) : null;
      return p ? Object.assign({}, p, { slot: sbEffectiveSlotCode(i) }) : null;
    }).filter(Boolean);
    const auto = startersArr.length ? assignMatchRoles({ squad: { starting: startersArr } }) : null;
    const pick = function(key) {
      const manualId = (sbDraft.roles || {})[key];
      if (manualId) {
        const mp = startersArr.find(function(p) { return p.id === manualId; });
        if (mp) return mp;
      }
      return auto ? auto[key] : null;
    };
    // The 3 corner-box attackers aren't a single named field on `auto` —
    // they're auto.cornerAttackers[0..2] — but otherwise follow the exact
    // same manual-override-then-auto-fallback pattern as every other role.
    const pickCornerAtk = function(idx) {
      const key = 'cornerAtk' + (idx + 1);
      const manualId = (sbDraft.roles || {})[key];
      if (manualId) {
        const mp = startersArr.find(function(p) { return p.id === manualId; });
        if (mp) return mp;
      }
      return (auto && auto.cornerAttackers) ? (auto.cornerAttackers[idx] || null) : null;
    };
    return {
      captain: pick('captain'), penalty: pick('penalty'),
      shortFreeKick: pick('shortFreeKick'), longFreeKick: pick('longFreeKick'),
      leftCorner: pick('leftCorner'), rightCorner: pick('rightCorner'),
      cornerAtk1: pickCornerAtk(0), cornerAtk2: pickCornerAtk(1), cornerAtk3: pickCornerAtk(2),
      auto: auto, startersArr: startersArr
    };
  }

  function sbRoleTagHTML(playerId) {
    const eff = sbDraft && sbDraft._eff;
    if (!eff) return '';
    let out = '';
    if (eff.captain && eff.captain.id === playerId) out += `<span class="captain-armband" title="Captain">${emojiImg('captain', 'Captain')}</span>`;
    if (eff.penalty && eff.penalty.id === playerId) out += `<span class="sb-role-ic" title="Penalty taker">${emojiImg('penalty_goal', 'Penalty taker')}</span>`;
    const isFk = (eff.shortFreeKick && eff.shortFreeKick.id === playerId) || (eff.longFreeKick && eff.longFreeKick.id === playerId);
    if (isFk) out += `<span class="sb-role-ic" title="Free-kick taker">${emojiImg('freekick', 'Free-kick taker')}</span>`;
    const isLeftCk = eff.leftCorner && eff.leftCorner.id === playerId;
    const isRightCk = eff.rightCorner && eff.rightCorner.id === playerId;
    if (isLeftCk) out += `<span class="sb-role-ic" title="Left corner taker">${emojiImg('left_corner', 'Left corner taker')}</span>`;
    if (isRightCk) out += `<span class="sb-role-ic" title="Right corner taker">${emojiImg('right_corner', 'Right corner taker')}</span>`;
    const isCa = [eff.cornerAtk1, eff.cornerAtk2, eff.cornerAtk3].some(function(p) { return p && p.id === playerId; });
    if (isCa) out += `<span class="sb-role-ic" title="Corner-box attacker">${emojiImg('corner_attacker', 'Corner-box attacker')}</span>`;
    return out;
  }
  function closeSlotPicker() {
    const picker = document.getElementById('sb-picker');
    if (picker) { picker.style.display = 'none'; picker.innerHTML = ''; }
  }
  function sbChipRowHTML(p, kind) {
    const isSel = sbDraft.selected && sbDraft.selected.id === p.id;
    const inj = isPlayerInjured(p.id);
    const susp = isPlayerSuspended(p.id);
    // Bench <-> reserve rows also get a one-tap move button as a
    // drag-and-drop alternative — same move sbPlacePlayer() already does
    // for a drop, just reachable without a pointer drag.
    let moveBtn = '';
    if (kind === 'bench') {
      moveBtn = '<button type="button" class="sb-chip-move" title="Move to reserves"' +
        ' onpointerdown="event.stopPropagation()" onclick="event.stopPropagation();App.sbMoveToReserve(\'' + p.id + '\')">Reserve ⇩</button>';
    } else if (kind === 'reserve') {
      moveBtn = '<button type="button" class="sb-chip-move" title="Move to substitutes"' +
        ' onpointerdown="event.stopPropagation()" onclick="event.stopPropagation();App.sbMoveToBench(\'' + p.id + '\')">Sub ⇧</button>';
    }
    return '<div class="sb-chip' + (isSel ? ' selected' : '') + '"' +
      ' onpointerdown="event.stopPropagation();App.sbGrab(event,\'' + kind + '\',\'' + p.id + '\')">' +
      '<span class="sb-chip-num">' + (p.num || '?') + '</span>' +
      '<span class="sb-chip-name">' + p.name + (inj ? ' 🩹' : '') + (susp ? ' ' + emojiImg('red_card', 'Suspended') : '') + '</span>' +
      '<span class="sb-chip-meta">' + ((p.pos || [])[0] || '') + ' · ' + p.ovr + '</span>' +
      sbRoleTagHTML(p.id) + moveBtn +
      '</div>';
  }

  function renderSquadBuilderBenchHTML() {
    const starterIds = new Set(Object.values(sbDraft.slots).filter(Boolean));
    const benchArr = sbDraft.players.filter(function(p) { return sbDraft.bench.has(p.id) && !starterIds.has(p.id); });
    benchArr.sort(function(a, b) { return (b.ovr || 0) - (a.ovr || 0); });
    if (!benchArr.length) return '<p class="sb-empty-hint">Drag starters here to bench them, or drag a reserve up.</p>';
    return benchArr.map(function(p) { return sbChipRowHTML(p, 'bench'); }).join('');
  }

  function renderSquadBuilderReserveHTML() {
    const starterIds = new Set(Object.values(sbDraft.slots).filter(Boolean));
    const reserveArr = sbDraft.players.filter(function(p) { return !starterIds.has(p.id) && !sbDraft.bench.has(p.id); });
    reserveArr.sort(function(a, b) { return (b.ovr || 0) - (a.ovr || 0); });
    if (!reserveArr.length) return '<p class="sb-empty-hint">Everyone is in the matchday squad.</p>';
    return reserveArr.map(function(p) { return sbChipRowHTML(p, 'reserve'); }).join('');
  }
  function setSquadSlot(index, playerId) {
    if (!sbDraft) return;
    if (!playerId) {
      delete sbDraft.slots[index];
    } else {
      const source = sbLocateInDraft(playerId);
      sbPlacePlayer(source, 'slot', index);
    }
    closeSlotPicker();
    renderSquadBuilderUI();
  }
  function renderSquadBuilderRolesHTML() {
    if (!sbDraft || !sbDraft._eff) return '';
    const eff = sbDraft._eff;
    const starters = eff.startersArr;
    const roleDefs = [
      ['captain', 'Captain'], ['penalty', 'Penalty Taker'],
      ['shortFreeKick', 'Short Free-Kick'], ['longFreeKick', 'Long Free-Kick'],
      ['leftCorner', 'Left Corner'], ['rightCorner', 'Right Corner'],
      ['cornerAtk1', 'Corner Attacker 1'], ['cornerAtk2', 'Corner Attacker 2'], ['cornerAtk3', 'Corner Attacker 3']
    ];
    if (!starters.length) return '<p class="sb-empty-hint">Fill your starting XI to assign match roles.</p>';
    return roleDefs.map(function(def) {
      const key = def[0], label = def[1];
      // The 3 corner-box attacker slots aren't a named field on eff — read
      // them from eff.cornerAtk1/2/3 (computed in sbEffectiveRoles) same
      // as every other role for display purposes.
      const autoP = (key.indexOf('cornerAtk') === 0)
        ? (eff.auto && eff.auto.cornerAttackers && eff.auto.cornerAttackers[+key.slice(-1) - 1])
        : (eff.auto && eff.auto[key]);
      // Each option shows a 1-99 "fit" rating for that role next to the
      // player's name — the same scoring the auto-pick above uses, so the
      // number you see is exactly why the auto pick is who it is.
      const opts = starters.map(function(p) {
        const rating = roleFitRating(p, key);
        return '<option value="' + p.id + '"' + ((sbDraft.roles || {})[key] === p.id ? ' selected' : '') + '>' +
          p.name + (rating != null ? ' — ' + rating : '') + '</option>';
      }).join('');
      const autoRating = autoP ? roleFitRating(autoP, key) : null;
      return '<div class="sb-role-row"><label>' + label + '</label>' +
        '<select onchange="App.sbSetRole(\'' + key + '\', this.value)">' +
        '<option value="">Auto' + (autoP ? ' — ' + autoP.name + (autoRating != null ? ' (' + autoRating + ')' : '') : '') + '</option>' + opts +
        '</select></div>';
    }).join('');
  }

  function sbSetRole(key, playerId) {
    if (!sbDraft) return;
    if (!sbDraft.roles) sbDraft.roles = {};
    sbDraft.roles[key] = playerId || '';
    renderSquadBuilderUI();
  }
  // Tapping empty pitch/bench/reserve space when a player is already
  // "selected" (tap-to-place, the touch-friendly alternative to
  // dragging) drops them there. With nothing selected it's a no-op —
  // dropping onto a filled slot to trigger a swap is handled by sbGrab's
  // tap branch instead, since that needs to know *which* player was
  // tapped.
  function sbZoneGrab(e, zoneKind) {
    if (!sbDraft || !sbDraft.selected) return;
    sbPlacePlayer(sbDraft.selected, zoneKind);
    sbDraft.selected = null;
    renderSquadBuilderUI();
  }

  function sbEmptySlotTap(idx) {
    if (!sbDraft) return;
    if (sbDraft.selected) {
      sbPlacePlayer(sbDraft.selected, 'slot', idx);
      sbDraft.selected = null;
      renderSquadBuilderUI();
    } else {
      openSlotPicker(idx);
    }
  }
  // Pointer-based drag & drop, unified for mouse, touch and pen (Pointer
  // Events). A press-without-moving-far is treated as a *tap* instead of
  // a drag — see sbDragEnd() — which is what powers the
  // tap-a-player/tap-a-destination placement flow on phones where a true
  // drag gesture is fiddlier. In formation-edit mode, grabbing a pitch
  // dot drags its *coordinates* instead (see sbCoordMove/sbCoordUp).
  function sbGrab(e, kind, idOrIdx) {
    if (!sbDraft) return;
    if (kind === 'slot' && sbDraft.editMode === 'formation') {
      e.preventDefault();
      const pitchEl = document.getElementById('sb-pitch');
      if (!pitchEl) return;
      sbCoordDrag = { slotIdx: idOrIdx, pitchEl: pitchEl };
      document.addEventListener('pointermove', sbCoordMove);
      document.addEventListener('pointerup', sbCoordUp, { once: true });
      return;
    }
    const id = kind === 'slot' ? sbDraft.slots[idOrIdx] : idOrIdx;
    if (!id) return;
    const slotIdx = kind === 'slot' ? idOrIdx : undefined;
    e.preventDefault();
    const p = sbDraft.players.find(function(x) { return x.id === id; });
    if (!p) return;
    sbDrag = { kind: kind, id: id, slotIdx: slotIdx, x0: e.clientX, y0: e.clientY, moved: false, player: p };
    document.addEventListener('pointermove', sbDragMove);
    document.addEventListener('pointerup', sbDragEnd, { once: true });
  }

  function sbDragMove(e) {
    if (!sbDrag) return;
    const dx = e.clientX - sbDrag.x0, dy = e.clientY - sbDrag.y0;
    if (!sbDrag.moved && Math.hypot(dx, dy) > 10) {
      sbDrag.moved = true;
      sbCreateGhost(sbDrag.player);
      document.querySelectorAll('[data-sb-drop]').forEach(function(z) { z.classList.add('sb-dz-active'); });
    }
    if (sbDrag.moved) sbMoveGhost(e.clientX, e.clientY);
  }

  function sbDragEnd(e) {
    document.removeEventListener('pointermove', sbDragMove);
    document.querySelectorAll('[data-sb-drop]').forEach(function(z) { z.classList.remove('sb-dz-active'); });
    if (!sbDrag) return;
    const drag = sbDrag; sbDrag = null;
    sbRemoveGhost();
    if (drag.moved) {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const zoneEl = target && target.closest ? target.closest('[data-sb-drop]') : null;
      if (zoneEl) {
        const zk = zoneEl.getAttribute('data-sb-drop');
        if (zk === 'slot') sbPlacePlayer(drag, 'slot', +zoneEl.getAttribute('data-slot-idx'));
        else sbPlacePlayer(drag, zk);
      }
      sbDraft.selected = null;
    } else if (sbDraft.selected && sbDraft.selected.id === drag.id) {
      sbDraft.selected = null; // tapping the already-selected chip deselects it
    } else if (sbDraft.selected) {
      sbPlacePlayer(sbDraft.selected, drag.kind, drag.slotIdx); // tap-to-place onto this chip's spot (swap)
      sbDraft.selected = null;
    } else {
      sbDraft.selected = { kind: drag.kind, id: drag.id, slotIdx: drag.slotIdx }; // first tap: select
    }
    renderSquadBuilderUI();
  }
  function autoFillSquadBuilder() {
    if (!sbDraft) return;
    const auto = buildSquad(sbDraft.team, sbDraft.formation);
    sbDraft.slots = {};
    auto.starting.forEach(function(p, i) { sbDraft.slots[i] = p.id; });
    sbDraft.bench = new Set(auto.subs.slice(0, 9).map(function(p) { return p.id; }));
    sbDraft.selected = null;
    renderSquadBuilderUI();
    toast('Best XI auto-filled');
  }
  // Formation-edit-mode dragging — moves a slot's coordinates rather than
  // a player. Updates the dot's inline position directly on every
  // pointermove (cheap DOM write) instead of going through the full
  // renderSquadBuilderUI() re-render, so reshaping the formation feels
  // smooth; the full re-render only happens once, on release.
  function sbCoordMove(e) {
    if (!sbCoordDrag) return;
    const rect = sbCoordDrag.pitchEl.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    x = Math.max(4, Math.min(96, x));
    y = Math.max(4, Math.min(96, y));
    sbDraft.coords[sbCoordDrag.slotIdx] = [x, y];
    const dot = document.getElementById('sb-dot-' + sbCoordDrag.slotIdx);
    if (dot) { dot.style.left = x + '%'; dot.style.top = y + '%'; }
  }

  function sbCoordUp() {
    document.removeEventListener('pointermove', sbCoordMove);
    sbCoordDrag = null;
  }

  function sbCreateGhost(p) {
    sbRemoveGhost();
    const g = document.createElement('div');
    g.className = 'sb-drag-ghost';
    g.innerHTML = '<span class="sb-chip-num">' + (p.num || '?') + '</span><span>' + p.name + '</span>';
    document.body.appendChild(g);
    sbGhostEl = g;
  }

  function sbMoveGhost(x, y) {
    if (sbGhostEl) { sbGhostEl.style.left = x + 'px'; sbGhostEl.style.top = y + 'px'; }
  }

  function sbRemoveGhost() {
    if (sbGhostEl) { sbGhostEl.remove(); sbGhostEl = null; }
  }
  function saveSquadBuilder() {
    if (!sbDraft || !sbSide) return;
    const formation = FORMATIONS[sbDraft.formation] || FORMATIONS['4-3-3'];
    const starting = [];
    const used = new Set();
    for (let i = 0; i < formation.slots.length; i++) {
      const id = sbDraft.slots[i];
      if (!id || used.has(id)) { toast('Fill every starting slot with unique players'); return; }
      const p = sbDraft.players.find(function(x) { return x.id === id; });
      if (!p) continue;
      used.add(id);
      starting.push(Object.assign({}, p, { slot: sbEffectiveSlotCode(i), isStarter: true }));
    }
    if (starting.length < 11) { toast('Need 11 unique starters'); return; }
    const subs = [];
    sbDraft.bench.forEach(function(id) {
      if (used.has(id)) return;
      const p = sbDraft.players.find(function(x) { return x.id === id; });
      if (p) {
        used.add(id);
        subs.push(Object.assign({}, p, { slot: (p.pos || ['CM'])[0], isStarter: false }));
      }
    });
    const manualRoles = {};
    Object.keys(sbDraft.roles || {}).forEach(function(k) {
      const v = sbDraft.roles[k];
      if (v && starting.some(function(p) { return p.id === v; })) manualRoles[k] = v;
    });
    customLineups[sbSide] = {
      starting: starting, subs: subs, formation: sbDraft.formation,
      all: starting.concat(subs), _teamId: sbDraft.team.id,
      manualRoles: manualRoles, customCoords: sbDraft.coords.map(function(c) { return c.slice(); }),
      customSlotRoles: Object.assign({}, sbDraft.slotRoles)
    };
    // Capture the side before closeSquadBuilder() clears the module-level
    // sbSide/sbDraft — calling updateTeamPreview(sbSide) *after* close used
    // to run it with sbSide already null, which made it silently no-op and
    // leave the home/away formation dropdown showing its old value even
    // though the new formation had just been saved successfully.
    const savedSide = sbSide;
    toast((savedSide === 'home' ? 'Home' : 'Away') + ' lineup saved (' + starting.length + '+' + subs.length + ')');
    closeSquadBuilder();
    updateTeamPreview(savedSide);
  }
  // Switching to a different preset formation tries to keep your current
  // starters on the pitch — each new slot claims the best-fitting player
  // still unclaimed (exact position first, then anyone compatible, then
  // highest OVR), same greedy approach engine/tactics.js::
  // changeFormationLive() uses for an in-match reshape. Anyone the new
  // shape has no room for drops to the bench rather than falling out of
  // the squad entirely.
  //
  // A shape change (e.g. 4-1-3-2 -> 4-3-3) doesn't always have an exact
  // like-for-like replacement among the current XI for every new slot —
  // e.g. going from one holding mid to none, or from two strikers to one
  // plus two wide forwards. Any slot the first pass can't fill from the
  // current starters gets a second pass pulling the best remaining fit
  // from the rest of the squad (bench first, then reserves), with a final
  // fallback that fields *someone* regardless of position so a formation
  // switch never quietly leaves a starting slot empty (which used to make
  // saveSquadBuilder() reject the whole save with no clear reason why).
  function sbSelectFormationPreset(key) {
    if (!sbDraft || !FORMATIONS[key]) return;
    const newFormation = FORMATIONS[key];
    const currentStarters = [];
    Object.keys(sbDraft.slots).forEach(function(k) {
      const id = sbDraft.slots[k];
      const p = sbDraft.players.find(function(x) { return x.id === id; });
      if (p) currentStarters.push(p);
    });
    const used = new Set();
    const newAssign = {};
    newFormation.slots.forEach(function(slot, i) {
      const cand = currentStarters.filter(function(p) { return !used.has(p.id) && canPlay(p, slot); })
        .sort(function(a, b) {
          const aFit = (a.pos || []).includes(slot) ? 1 : 0;
          const bFit = (b.pos || []).includes(slot) ? 1 : 0;
          if (bFit !== aFit) return bFit - aFit;
          return (b.ovr || 0) - (a.ovr || 0);
        });
      if (cand[0]) { used.add(cand[0].id); newAssign[i] = cand[0].id; }
    });
    currentStarters.forEach(function(p) {
      if (!used.has(p.id)) sbDraft.bench.add(p.id);
    });

    // Second pass: any new slot still empty gets filled from the rest of
    // the squad — bench (currently-named subs) before pure reserves, since
    // a bench spot signals "in the matchday 25 on purpose" more than an
    // untouched reserve does.
    const pool = sbDraft.players.filter(function(p) { return !used.has(p.id); })
      .sort(function(a, b) {
        const aBench = sbDraft.bench.has(a.id) ? 1 : 0;
        const bBench = sbDraft.bench.has(b.id) ? 1 : 0;
        if (bBench !== aBench) return bBench - aBench;
        return (b.ovr || 0) - (a.ovr || 0);
      });
    newFormation.slots.forEach(function(slot, i) {
      if (newAssign[i]) return;
      let pick = pool.find(function(p) { return !used.has(p.id) && (p.pos || []).includes(slot); });
      if (!pick) pick = pool.find(function(p) { return !used.has(p.id) && canPlay(p, slot); });
      if (!pick) pick = pool.find(function(p) { return !used.has(p.id); }); // fallback: fill with anyone left
      if (pick) { used.add(pick.id); newAssign[i] = pick.id; sbDraft.bench.delete(pick.id); }
    });

    sbDraft.formation = key;
    sbDraft.slots = newAssign;
    sbDraft.coords = newFormation.coords.map(function(c) { return c.slice(); });
    // A new formation shape means slot index 3 in the old shape isn't the
    // same physical position as slot index 3 in the new one — any manual
    // CM->CAM style role tweaks would silently apply to the wrong slot, so
    // start the new shape with its own default roles.
    sbDraft.slotRoles = {};
    sbDraft.selected = null;
    renderFormationSelect();
    renderSquadBuilderUI();
  }
  function closeSquadBuilder() {
    sbDraft = null;
    sbSide = null;
    closeSlotPicker();
    switchView('match');
  }
  function sbToggleEditMode() {
    if (!sbDraft) return;
    sbDraft.editMode = sbDraft.editMode === 'formation' ? 'lineup' : 'formation';
    sbDraft.selected = null;
    renderSquadBuilderUI();
  }

  function sbResetFormationShape() {
    if (!sbDraft) return;
    const formation = FORMATIONS[sbDraft.formation] || FORMATIONS['4-3-3'];
    sbDraft.coords = formation.coords.map(function(c) { return c.slice(); });
    renderSquadBuilderUI();
    toast('Formation shape reset');
  }

  // Exports the current draft's formation shape — slot codes (including
  // any per-slot role overrides from setSquadSlotRole) and marker
  // coordinates (including any reshaping done in "Edit Formation Shape"
  // mode) — as a downloadable snippet in the exact object shape the
  // built-in FORMATIONS table (js/state.js) uses, so it can be pasted in
  // by hand as a new named entry and picked up by build.js on the next
  // build. This only ever reads sbDraft; it doesn't save/mutate anything.
  function sbExportFormation() {
    if (!sbDraft) return;
    const formation = FORMATIONS[sbDraft.formation] || FORMATIONS['4-3-3'];
    const slots = formation.slots.map(function(_, idx) { return sbEffectiveSlotCode(idx); });
    const coords = sbDraft.coords.map(function(c) {
      const x = Math.round(((c && c[0]) || 0) * 10) / 10;
      const y = Math.round(((c && c[1]) || 0) * 10) / 10;
      return [x, y];
    });
    const baseName = (formation.name || sbDraft.formation) + ' (Custom)';
    const key = 'custom-' + String(sbDraft.formation).replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + Date.now().toString(36).slice(-5);
    const slotsStr = slots.map(function(s) { return "'" + s + "'"; }).join(', ');
    const coordsStr = coords.map(function(c) { return '[' + c[0] + ',' + c[1] + ']'; }).join(',');
    const snippet =
      '// Paste this as a new entry inside the FORMATIONS object in js/state.js,\n' +
      '// then run `node build.js` to fold it into dist/app.js.\n' +
      "  '" + key + "': { name: '" + baseName.replace(/'/g, "\\'") + "', slots: [" + slotsStr + '],\n' +
      '    coords: [' + coordsStr + '] },\n';
    try {
      const blob = new Blob([snippet], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = key + '.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
      toast('Formation exported — paste it into FORMATIONS in js/state.js');
    } catch (e) {
      toast('Export failed: ' + (e && e.message ? e.message : e));
    }
  }
  function dedupeSquad(sq) {
    const seen = new Set();
    const starting = [];
    (sq.starting || []).forEach(function(p) {
      if (!p || !p.id || seen.has(p.id)) return;
      seen.add(p.id); starting.push(p);
    });
    const subs = [];
    (sq.subs || []).forEach(function(p) {
      if (!p || !p.id || seen.has(p.id)) return;
      seen.add(p.id); subs.push(p);
    });
    return Object.assign({}, sq, { starting: starting, subs: subs, all: starting.concat(subs) });
  }

  function startMatch() {
    const homeSel = document.getElementById('home-team');
    const awaySel = document.getElementById('away-team');
    if (!homeSel || !awaySel) return;
    const homeId = homeSel.value;
    const awayId = awaySel.value;
    if (!homeId || !awayId || homeId === awayId) { toast('Select two different teams'); return; }
    const homeTeam = getTeam(homeId);
    const awayTeam = getTeam(awayId);
    if (!homeTeam || !awayTeam) { toast('Team not found'); return; }
    const homeForm = (document.getElementById('home-formation') || {}).value || '4-3-3';
    const awayForm = (document.getElementById('away-formation') || {}).value || '4-3-3';
    let homeSquad = (customLineups.home && customLineups.home.formation === homeForm && customLineups.home._teamId === homeTeam.id)
      ? customLineups.home : buildSquad(homeTeam, homeForm);
    let awaySquad = (customLineups.away && customLineups.away.formation === awayForm && customLineups.away._teamId === awayTeam.id)
      ? customLineups.away : buildSquad(awayTeam, awayForm);
    homeSquad = dedupeSquad(homeSquad);
    awaySquad = dedupeSquad(awaySquad);

    currentMatch = {
      home: { team: homeTeam, squad: homeSquad, score: 0, stats: blankStats() },
      away: { team: awayTeam, squad: awaySquad, score: 0, stats: blankStats() },
      minute: 0, events: [], status: '1st Half', finished: false,
      // Match-clock state (see updateMatchClock) — the first half starts
      // its own 45-minute regulation window right away; the display minute
      // and label are recomputed every tick.
      period: 'H1', periodStartRaw: 0, periodBaseDisplay: 0, periodDuration: 45, periodStoppage: null,
      dispMin: 0, dispLabel: "0'",
      homeOnPitch: homeSquad.starting.map(p => p.id),
      awayOnPitch: awaySquad.starting.map(p => p.id),
      homeSubsUsed: 0, awaySubsUsed: 0, maxSubs: 5,
      injuries: [], cards: { home: {}, away: {} }, possession: 50,
      subLog: { home: {}, away: {} }, // playerId -> { outMin, inMin, replaced, replacedBy }
      leftPitch: { home: [], away: [] }, // playerIds who have left the pitch (sub'd off, sent off, or injured off) — can never return
      tactics: { home: 'balanced', away: 'balanced' },
      playerMatchStats: {},
      goalList: []
    };
    currentMatch.home.roles = assignMatchRoles(currentMatch.home);
    currentMatch.away.roles = assignMatchRoles(currentMatch.away);
    // Form & Condition system (engine/form.js) — roll every squad member's
    // match condition once, right here at kickoff, before anything reads it.
    rollMatchConditions(currentMatch);
    // Opening tactical instructions now come from the matchup, not a flat
    // "balanced" default every time: a clear underdog tends to sit in and
    // be harder to break down, a clear favourite tends to push on, and a
    // counter-minded manager identity nudges an otherwise even matchup
    // toward pressing higher up — so kickoff already feels shaped by who's
    // actually playing before a single ball is kicked.
    const openStrHome = calcTeamStrength(currentMatch.home);
    const openStrAway = calcTeamStrength(currentMatch.away);
    currentMatch.tactics.home = decideOpeningTactic(openStrHome, openStrAway, getManagerPlaystyle(homeTeam));
    currentMatch.tactics.away = decideOpeningTactic(openStrAway, openStrHome, getManagerPlaystyle(awayTeam));

    const setup = document.getElementById('match-setup');
    const live = document.getElementById('match-live');
    if (setup) setup.style.display = 'none';
    if (live) live.style.display = 'block';
    const pm = document.getElementById('post-match-ratings');
    if (pm) { pm.style.display = 'none'; pm.innerHTML = ''; }
    const backBtn = document.getElementById('back-to-tournament');
    if (backBtn) { backBtn.style.display = 'none'; backBtn.classList.remove('show'); }
    updateScoreboard();
    renderLineups();
    const feed = document.getElementById('events-feed');
    if (feed) feed.innerHTML = '';
    // Clear previous match stats UI
    ['live-home-score','live-away-score'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = '0'; });
    const minEl = document.getElementById('live-minute'); if (minEl) minEl.textContent = "0'";
    const stEl = document.getElementById('live-status'); if (stEl) stEl.textContent = '1st Half';
    const hg = document.getElementById('home-goal-scorers'); if (hg) hg.innerHTML = '';
    const ag = document.getElementById('away-goal-scorers'); if (ag) ag.innerHTML = '';
    const statsEl = document.getElementById('match-stats'); if (statsEl) statsEl.innerHTML = '';
    const pm2 = document.getElementById('post-match-ratings'); if (pm2) { pm2.style.display = 'none'; pm2.innerHTML = ''; }
    const kickMsgs = [
      'Kick off! The referee starts the contest.',
      "And we're underway!",
      'The match is live — kick-off taken.',
      'Here we go! First whistle blown.'
    ];
    addEvent(0, 'whistle', kickMsgs[Math.floor(seededRandom()*kickMsgs.length)], null);
    currentMatch.countForLeaderboard = !!(tournament || window._tourFixtureIdx != null || window._koRoundIdx != null || window._tourLeagueFixtureIdx != null || window._seasonFixture != null);
    currentMatch.allowET = !!(document.getElementById('opt-et') && document.getElementById('opt-et').checked);
    currentMatch.allowPens = !!(document.getElementById('opt-pens') && document.getElementById('opt-pens').checked);
    const gt = document.getElementById('goal-timeline');
    if (gt) gt.innerHTML = '';
    isPlaying = false;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = '▶ Play';
  }

  function blankStats() {
    return {
      shots: 0, shotsOn: 0, possession: 50, fouls: 0, corners: 0, saves: 0, passes: 0, passesCompleted: 0, interceptions: 0, blocks: 0, yellows: 0, reds: 0, xg: 0,
      // Attack
      bigChances: 0, bigChancesMissed: 0, touches: 0, touchesInBox: 0, progressiveCarries: 0, carries: 0, dribbles: 0, successfulDribbles: 0, offsides: 0,
      // Passing
      progressivePasses: 0, keyPasses: 0, throughBalls: 0, crosses: 0, switches: 0, longBalls: 0, finalThirdPasses: 0,
      // Defense
      tackles: 0, clearances: 0, headedClearances: 0, defensiveErrors: 0, recoveries: 0, pressures: 0, aerialDuels: 0,
      // Physical
      distance: 0, sprints: 0, highSpeedRuns: 0, accelerations: 0, decelerations: 0,
      // Goalkeeping
      punches: 0, claims: 0, crossesStopped: 0, goalsPrevented: 0, psxg: 0, distribution: 0
    };
  }

  
  
  
  function showETPrompt(drawn, pensOnly) {
    let el = document.getElementById('et-prompt');
    if (!el) {
      const live = document.getElementById('match-live');
      if (!live) return;
      el = document.createElement('div');
      el.id = 'et-prompt';
      el.className = 'et-prompt';
      live.insertBefore(el, live.firstChild.nextSibling);
    }
    if (pensOnly) {
      el.innerHTML = `<p>Still level after extra time. Take the penalty shootout?</p>
        <button class="btn btn-primary btn-sm" onclick="App.continueToPens()">⚽ Penalties</button>
        <button class="btn btn-secondary btn-sm" onclick="App.skipETAndEnd()">End as draw</button>`;
    } else {
      el.innerHTML = `<p>Full time and the scores are level.</p>
        ${currentMatch.allowET ? '<button class="btn btn-primary btn-sm" onclick="App.continueToET()">⏱ Extra Time</button>' : ''}
        ${currentMatch.allowPens ? '<button class="btn btn-primary btn-sm" onclick="App.continueToPens()">⚽ Penalties</button>' : ''}
        <button class="btn btn-secondary btn-sm" onclick="App.skipETAndEnd()">End as draw</button>`;
    }
    el.classList.add('show');
  }

  function hideETPrompt() {
    const el = document.getElementById('et-prompt');
    if (el) { el.classList.remove('show'); el.innerHTML = ''; }
  }

  function continueToET() {
    const m = currentMatch;
    if (!m) return;
    hideETPrompt();
    m._awaitingET = false;
    m.inET = true;
    m.status = 'Extra Time (1st Half)';
    addEvent(m.minute, 'et', 'Extra time begins — two periods of 15 minutes', null);
    // The clock itself doesn't restart at 90' until the next tick — see the
    // pendingPeriod handling at the top of tick().
    m.pendingPeriod = { period: 'ET1', base: 90, duration: 15, status: 'Extra Time (1st Half)' };
    updateScoreboard();
    isPlaying = true;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = '⏸ Pause';
    const speed = parseInt((document.getElementById('sim-speed') || {}).value || '400', 10);
    clearInterval(simInterval);
    simInterval = setInterval(() => tick(false), speed);
  }

  function continueToPens() {
    const m = currentMatch;
    if (!m) return;
    hideETPrompt();
    m._awaitingET = false;
    m._awaitingPens = false;
    runPenaltyShootout();
  }

  function skipETAndEnd() {
    hideETPrompt();
    if (currentMatch) {
      currentMatch._awaitingET = false;
      currentMatch._awaitingPens = false;
    }
    endMatch();
  }


  function runPenaltyShootout() {
    const m = currentMatch;
    if (!m || m.inPens) return;
    m.inPens = true;
    m.status = 'Penalties';
    addEvent(m.minute, 'pen', `${emojiImg('penalty_goal', 'Penalty')} Penalty shootout!`, null);
    updateScoreboard();

    // Order the takers list so recognised penalty takers (strikers/wingers, then
    // attacking mids) step up before defenders/holding mids, same as real teams do.
    const penOrderScore = (p, side) => (p.att || 0) + (PEN_TAKER_ROLE_WEIGHT[p.slot || (p.pos||[])[0]] || 0.4) * 12
      + (side.roles && side.roles.penalty && side.roles.penalty.id === p.id ? 40 : 0);
    // Eligible takers are whoever is actually on the pitch at full time —
    // squad.starting/squad.subs are the fixed pre-match lists and never
    // change, so filtering only on those would let a player who was
    // substituted off (or sent off) hours ago still step up to take a
    // penalty, while a sub who's been on the pitch the whole shootout
    // build-up gets ignored entirely. m.homeOnPitch/m.awayOnPitch is the
    // live list of player ids currently out there (see trySubstitution in
    // engine/tactics.js), so cross-reference against that instead.
    const homeOnPitchIds = m.homeOnPitch || [];
    const awayOnPitchIds = m.awayOnPitch || [];
    const homePool = [...(m.home.squad.starting || []), ...(m.home.squad.subs || [])];
    const awayPool = [...(m.away.squad.starting || []), ...(m.away.squad.subs || [])];
    const homeTakers = homePool.filter(p => homeOnPitchIds.includes(p.id) && !(p.pos||[]).includes('GK')).sort((a,b)=>penOrderScore(b,m.home)-penOrderScore(a,m.home));
    const awayTakers = awayPool.filter(p => awayOnPitchIds.includes(p.id) && !(p.pos||[]).includes('GK')).sort((a,b)=>penOrderScore(b,m.away)-penOrderScore(a,m.away));

    // Silent/bulk sims (quick-sim, tournament auto-play) still resolve instantly —
    // only a real, on-screen live match animates the shootout kick by kick.
    if (m.silentDeep) {
      const st = { homePens: 0, awayPens: 0, round: 0, phase: 'regular', sudden: 0 };
      for (let i = 0; i < 5; i++) {
        st.round = i;
        takePenaltyKick(m, 'home', homeTakers, i, st);
        takePenaltyKick(m, 'away', awayTakers, i, st);
        const left = 4 - i;
        if (st.homePens > st.awayPens + left || st.awayPens > st.homePens + left) break;
      }
      let sd = 0;
      while (st.homePens === st.awayPens && sd < 20) {
        st.phase = 'sudden'; st.sudden = sd;
        takePenaltyKick(m, 'home', homeTakers, 5 + sd, st);
        takePenaltyKick(m, 'away', awayTakers, 5 + sd, st);
        sd++;
      }
      m.home.penScore = st.homePens;
      m.away.penScore = st.awayPens;
      addEvent(m.minute, 'whistle', `Penalties: ${m.home.team.short} ${st.homePens} - ${st.awayPens} ${m.away.team.short}`, null);
      endMatch();
      return;
    }

    clearInterval(simInterval);
    isPlaying = false;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = '▶ Play';

    m._pensState = { homePens: 0, awayPens: 0, round: 0, sudden: 0, turn: 'home', phase: 'regular' };
    const stepDelay = Math.max(700, Math.min(1400, simSpeed * 2.5));
    // First kick fires right away so it doesn't feel like a stall, then one kick per interval tick.
    stepPenaltyShootout(homeTakers, awayTakers);
    simInterval = setInterval(() => stepPenaltyShootout(homeTakers, awayTakers), stepDelay);
  }

  // Resolves a single penalty kick and updates score/events. Shared by the instant
  // (silentDeep) and animated (live) shootout paths so outcomes are computed the same way.
  function takePenaltyKick(m, side, takers, kickIndex, st) {
    if (!takers.length) return;
    const taker = takers[kickIndex % takers.length];
    const oppSide = side === 'home' ? 'away' : 'home';
    const gk = ((m[oppSide].squad && m[oppSide].squad.all) || []).find(p => (p.pos || [])[0] === 'GK');
    const out = pickPenOutcome(taker, gk);
    const teamShort = m[side].team.short;
    if (out.scored) {
      st[side === 'home' ? 'homePens' : 'awayPens']++;
      addEvent(m.minute, 'pen', `${emojiImg('penalty_goal', 'Penalty scored')} ${taker.name} (${teamShort}) ${out.text} [${st.homePens}-${st.awayPens}]`, side);
    } else {
      addEvent(m.minute, 'pen', `${emojiImg('penalty_miss_saved', 'Penalty missed')} ${taker.name} (${teamShort}) — ${out.text} [${st.homePens}-${st.awayPens}]`, side);
    }
  }

  // Advances the live penalty shootout by exactly one kick, alternating home/away,
  // so the person watching sees each penalty land before the next one is taken.
  function stepPenaltyShootout(homeTakers, awayTakers) {
    const m = currentMatch;
    if (!m || !m._pensState) { clearInterval(simInterval); return; }
    const st = m._pensState;
    const side = st.turn;
    const takers = side === 'home' ? homeTakers : awayTakers;
    const kickIndex = st.phase === 'regular' ? st.round : (5 + st.sudden);
    takePenaltyKick(m, side, takers, kickIndex, st);
    m.home.penScore = st.homePens;
    m.away.penScore = st.awayPens;
    updateScoreboard();

    if (st.turn === 'home') {
      st.turn = 'away';
      return; // wait for the next tick to take away's kick in the same round
    }
    // Away just kicked — the round is complete, decide what happens next.
    st.turn = 'home';
    if (st.phase === 'regular') {
      const left = 4 - st.round;
      if (st.homePens > st.awayPens + left || st.awayPens > st.homePens + left) {
        finishPenaltyShootout();
        return;
      }
      st.round++;
      if (st.round >= 5) {
        if (st.homePens === st.awayPens) { st.phase = 'sudden'; st.sudden = 0; }
        else { finishPenaltyShootout(); return; }
      }
    } else {
      if (st.homePens !== st.awayPens) { finishPenaltyShootout(); return; }
      st.sudden++;
    }
  }

  function finishPenaltyShootout() {
    const m = currentMatch;
    if (!m) return;
    clearInterval(simInterval);
    const st = m._pensState || { homePens: m.home.penScore || 0, awayPens: m.away.penScore || 0 };
    m.home.penScore = st.homePens;
    m.away.penScore = st.awayPens;
    addEvent(m.minute, 'whistle', `Penalties: ${m.home.team.short} ${st.homePens} - ${st.awayPens} ${m.away.team.short}`, null);
    endMatch();
  }

  // ---- Own goals ----
  // Genuinely rare — real football sees an own goal roughly once every
  // several dozen matches, not every game — so every call site here rolls
  // a very small probability and almost always returns false. `culprit`
  // is the defending player whose action turned it into his own net;
  // `desc` is a short clause describing how (deflection, header, etc.).
  // Returns true (and fully resolves the goal) if the own goal happened,
  // so the caller can bail out of its own normal resolution immediately.
  function maybeOwnGoal(attackingSide, defendingSide, culprit, desc, chance) {
    const m = currentMatch;
    if (!m || !culprit) return false;
    if (seededRandom() >= (chance != null ? chance : 0.01)) return false;
    const attTeam = m[attackingSide], defTeam = m[defendingSide];
    attTeam.score++;
    if (!m.playerMatchStats) m.playerMatchStats = {};
    if (!m.playerMatchStats[culprit.id]) m.playerMatchStats[culprit.id] = blankPlayerMatchStats(culprit);
    // Recorded under its own leaderboard bucket (not 'goals') so it never
    // inflates the defender's own scoring tally or a top-scorer list —
    // same convention real stats sites use.
    recordStat('ownGoals', culprit, defTeam.team);
    // The goal list/timeline just wants a name to show — tagging it in
    // the name itself means every existing renderer (timeline, match
    // report, season history) shows it correctly with no further changes.
    pushGoal(attackingSide, { id: culprit.id, name: culprit.name + ' (OG)', num: culprit.num }, m.minute, 'own goal');
    addEvent(m.minute, 'goal', `${emojiImg('goal', 'Own goal')} Own goal! <span class="player">${culprit.name}</span> (${defTeam.team.short}) ${desc || 'turns it into his own net'}.`, attackingSide, true);
    return true;
  }
  function maybeOffsideDisallow(side, scorer, minute, moment) {
    const m = currentMatch;
    if (!m) return false;
    moment = moment || 'openplay';
    // Corners, penalties, and a direct free-kick effort are all exempt from
    // this recheck under the actual Laws of the Game — nobody can be ruled
    // offside receiving directly from a corner, and there's no separate
    // "receiver" to judge on a penalty or the taker's own direct free-kick.
    if (moment === 'corner' || moment === 'penalty' || moment === 'directfreekick') return false;
    if (seededRandom() > 0.16) return false; // ~16% of goals get a check at all
    const team = m[side];
    addEvent(minute, 'var', `📺 VAR checking possible offside in the build-up to ${team.team.short}'s goal...`, side);
    // Reuse the same spatial/temporal offside model that judges a live
    // through ball — passer/receiver advancement, the second-last
    // defender's line, and defensive discipline — rather than a separate,
    // disconnected pace-only roll.
    const result = evaluateOffside(side, scorer, 'openplay');
    let offsideLikely;
    if (result && result.checked) {
      offsideLikely = result.offside ? 0.85 : Math.max(0.04, (result.margin || 0) * 2 + 0.05);
    } else {
      // Fallback for the rare case the spatial model has nothing to judge
      // (e.g. missing formation data mid-transition) — the old pace-only
      // read, so a check never silently does nothing.
      const defLine = calcTeamStrength(m[side === 'home' ? 'away' : 'home']);
      offsideLikely = 0.35 + Math.max(0, (defLine.pac || 70) - (scorer.pac || 70)) / 200;
    }
    if (seededRandom() < offsideLikely) {
      team.score = Math.max(0, team.score - 1);
      // remove last goal from list for this side/scorer
      if (m.goalList && m.goalList.length) {
        for (let i = m.goalList.length - 1; i >= 0; i--) {
          if (m.goalList[i].side === side && m.goalList[i].player === scorer.name) {
            m.goalList.splice(i, 1);
            break;
          }
        }
      }
      // undo goal stat (best effort)
      if (stats.goals && stats.goals[scorer.id]) stats.goals[scorer.id].count = Math.max(0, stats.goals[scorer.id].count - 1);
      if (tournament && tournamentStats.goals && tournamentStats.goals[scorer.id]) {
        tournamentStats.goals[scorer.id].count = Math.max(0, tournamentStats.goals[scorer.id].count - 1);
      }
      if (m.playerMatchStats && m.playerMatchStats[scorer.id]) {
        m.playerMatchStats[scorer.id].goals = Math.max(0, (m.playerMatchStats[scorer.id].goals || 1) - 1);
      }
      addEvent(minute, 'var', `VAR: Goal disallowed — <span class="player">${scorer.name}</span> was offside`, side);
      renderGoalTimeline();
      return true;
    }
    addEvent(minute, 'var', `VAR: Goal stands — onside`, side);
    return false;
  }

  function pushGoal(side, player, minute, methodDesc) {
    if (!currentMatch) return;
    if (!currentMatch.goalList) currentMatch.goalList = [];
    const isPen = /^penalty/i.test(methodDesc || '');
    // dispMin/dispLabel are the match-clock reading at the moment of the
    // goal (e.g. 90 / "90+2'") — see updateMatchClock — while `minute`
    // stays the raw tick for anything that needs strict chronological order.
    const dispMin = currentMatch.dispMin != null ? currentMatch.dispMin : minute;
    const dispLabel = currentMatch.dispLabel || (minute + "'");
    // id is included alongside the name so a saved report can drop the
    // name and rehydrate it from the id later (see teamRefReplacer /
    // teamRefReviver in simulation/seasonEngine.js) — this was previously
    // the single biggest chunk of a match report's persisted size, since
    // there was no id here to recover the name from at all.
    currentMatch.goalList.push({ side, player: player.name, id: player.id, num: player.num, minute, dispMin, dispLabel, method: methodDesc || '', pen: isPen });
    renderGoalTimeline();
  }

  function renderGoalTimeline() {
    const homeEl = document.getElementById('home-goal-scorers');
    const awayEl = document.getElementById('away-goal-scorers');
    if (!currentMatch) {
      if (homeEl) homeEl.innerHTML = '';
      if (awayEl) awayEl.innerHTML = '';
      return;
    }
    const goals = currentMatch.goalList || [];
    const fmt = (arr) => arr.map(g => {
      return `<div class="scorer-line"><span class="gt-min">${g.dispLabel || (g.minute + "'")}</span> ${g.player}${g.pen ? ' <span class="pen-tag">[Penalty]</span>' : ''}${g.num != null && g.num !== '' ? ' · '+g.num : ''}</div>`;
    }).join('');
    if (homeEl) homeEl.innerHTML = fmt(goals.filter(g => g.side === 'home'));
    if (awayEl) awayEl.innerHTML = fmt(goals.filter(g => g.side === 'away'));
  }

  function buildMatchReport(m) {
    if (!m) return null;
    const allStats = m.playerMatchStats ? JSON.parse(JSON.stringify(m.playerMatchStats)) : {};
    const homeIds = new Set((m.home.squad && m.home.squad.all || []).map(p => p.id));
    const homeRatings = [], awayRatings = [];
    Object.values(allStats).forEach(ps => {
      (homeIds.has(ps.id) ? homeRatings : awayRatings).push(ps);
    });
    const byRating = (x, y) => (y.rating || 0) - (x.rating || 0);
    homeRatings.sort(byRating);
    awayRatings.sort(byRating);
    return {
      venue: getStadium(m.home.team),
      home: { id: m.home.team.id, name: m.home.team.name, short: m.home.team.short, flag: m.home.team.flag, logo: m.home.team.logo, score: m.home.score, penScore: m.home.penScore, stats: JSON.parse(JSON.stringify(m.home.stats || {})), formation: m.home.squad && m.home.squad.formation, ratings: homeRatings },
      away: { id: m.away.team.id, name: m.away.team.name, short: m.away.team.short, flag: m.away.team.flag, logo: m.away.team.logo, score: m.away.score, penScore: m.away.penScore, stats: JSON.parse(JSON.stringify(m.away.stats || {})), formation: m.away.squad && m.away.squad.formation, ratings: awayRatings },
      events: (m.events || []).map(e => ({ minute: e.minute, dispMin: e.dispMin, dispLabel: e.dispLabel, type: e.type, text: e.text, side: e.side })),
      goals: JSON.parse(JSON.stringify(m.goalList || [])),
      ratings: allStats,
      motmId: m.motmId || null,
      finished: true
    };
  }

  // Lightweight counterpart to buildMatchReport() — used for every
  // auto-simmed fixture (anything that goes through simQuickMatch, i.e.
  // any match the user never actually watches). A full report carries a
  // ~30-field playerMatchStats blob per player plus the entire event log,
  // which is fine for the handful of matches someone watches live but
  // balloons storage the instant you bulk-sim a whole tournament or
  // season — this keeps just what a results page actually needs: final
  // score, who scored (and when/how), who was booked/sent off, and MOTM.
  // Marked `light: true` so the report modal (ui/matchUI.js) knows to
  // skip the sections (team stats, player ratings) it has no data for.
  function buildLightMatchReport(m) {
    if (!m) return null;
    const cardEvents = (m.events || []).filter(e => e.type === 'yellow' || e.type === 'red');
    const cardsForSide = (side, squad) => {
      const ids = new Set((squad && squad.all || []).map(p => p.id));
      const list = [];
      Object.values(m.playerMatchStats || {}).forEach(ps => {
        if (!ids.has(ps.id)) return;
        if (ps.red) list.push({ id: ps.id, player: ps.name, num: ps.num, type: 'red' });
        else if (ps.yellow) list.push({ id: ps.id, player: ps.name, num: ps.num, type: 'yellow' });
      });
      list.forEach(c => {
        const ev = cardEvents.find(e => e.side === side && e.type === c.type && (e.text || '').indexOf(c.player) !== -1);
        if (ev) { c.minute = ev.minute; c.dispMin = ev.dispMin; c.dispLabel = ev.dispLabel; }
      });
      return list;
    };
    // Who performed, in a few words: assist providers and keepers' save
    // counts. Deliberately just id/name/num/count — not the full per-player
    // stat blob buildMatchReport captures — so this stays cheap to store
    // while still answering "who set that up" / "who kept us in it".
    const performersForSide = (squad) => {
      const ids = new Set((squad && squad.all || []).map(p => p.id));
      const assists = [], saves = [];
      Object.values(m.playerMatchStats || {}).forEach(ps => {
        if (!ids.has(ps.id)) return;
        if (ps.assists > 0) assists.push({ id: ps.id, player: ps.name, num: ps.num, count: ps.assists });
        if (ps.saves > 0) saves.push({ id: ps.id, player: ps.name, num: ps.num, count: ps.saves });
      });
      assists.sort((x, y) => y.count - x.count);
      saves.sort((x, y) => y.count - x.count);
      return { assists, saves };
    };
    const homePerf = performersForSide(m.home.squad);
    const awayPerf = performersForSide(m.away.squad);
    // Injuries: m.injuries is just a list of playerIds picked up this match
    // (see engine/injuries.js) — cross-reference with injuryBook, which
    // still holds this match's fresh record for each of them at the point
    // buildLightMatchReport runs, to pull the injury type and lay-off length.
    const injuriesForSide = (side, squad) => {
      const ids = new Set((squad && squad.all || []).map(p => p.id));
      const list = [];
      (m.injuries || []).forEach(pid => {
        if (!ids.has(pid)) return;
        const rec = injuryBook[pid];
        list.push({
          id: pid,
          player: rec ? rec.playerName : ((squad.all || []).find(p => p.id === pid) || {}).name || '',
          type: rec ? rec.type : '',
          severity: rec ? rec.severity : '',
          matchesOut: rec ? rec.matchesTotal : null,
          minute: rec ? rec.minute : null
        });
      });
      return list;
    };
    return {
      light: true,
      venue: getStadium(m.home.team),
      home: { id: m.home.team.id, name: m.home.team.name, short: m.home.team.short, flag: m.home.team.flag, logo: m.home.team.logo, score: m.home.score, penScore: m.home.penScore, formation: m.home.squad && m.home.squad.formation, assists: homePerf.assists, saves: homePerf.saves },
      away: { id: m.away.team.id, name: m.away.team.name, short: m.away.team.short, flag: m.away.team.flag, logo: m.away.team.logo, score: m.away.score, penScore: m.away.penScore, formation: m.away.squad && m.away.squad.formation, assists: awayPerf.assists, saves: awayPerf.saves },
      goals: JSON.parse(JSON.stringify(m.goalList || [])),
      cards: { home: cardsForSide('home', m.home.squad), away: cardsForSide('away', m.away.squad) },
      injuries: { home: injuriesForSide('home', m.home.squad), away: injuriesForSide('away', m.away.squad) },
      motmId: m.motmId || null,
      finished: true
    };
  }

  // Shared row renderer so a tournament/season match report and the live
  // post-match panel render a player's rating line identically.
  function renderRatingRow(p, motmId) {
    const isMotm = motmId != null && p.id === motmId;
    const rc = isMotm ? 'rating-motm' : (p.rating || 0) >= 7.5 ? 'rating-high' : (p.rating || 0) >= 6.5 ? 'rating-mid' : 'rating-low';
    const icons = (p.goals ? emojiImg('goal', 'Goal').repeat(Math.min(p.goals, 3)) : '') + (p.assists ? emojiImg('assist', 'Assist').repeat(Math.min(p.assists, 2)) : '');
    return `<div class="pm-player" onclick="App.showPlayerProfile('${p.id}')" style="cursor:pointer">
        <span class="player-num">${p.num || ''}</span>
        <span style="flex:1;font-weight:600">${playerNameHTML(p)}${isMotm ? ' <span title="Man of the Match">⭐</span>' : ''}</span>
        <span>${icons}</span>
        <span class="xg">xG ${(p.xg || 0).toFixed(2)} · xA ${(p.xa || 0).toFixed(2)}</span>
        <span class="rating-badge ${rc}">${(p.rating || 0).toFixed(1)}</span>
      </div>`;
  }

  // Renders the full Attack / Passing / Defense / Physical / Goalkeeping
  // stat breakdown as a series of small side-by-side tables, using
  // whatever the two teams' stats objects carry (deriveExtendedMatchStats
  // in engine/matchEngine.js fills these in for every match at full time).
  function renderCategorizedTeamStatsHTML(h, a) {
    const hs = h.stats || {}, as_ = a.stats || {};
    const row = (label, key, suffix) =>
      `<tr><td>${label}</td><td>${hs[key] !== undefined ? hs[key] : 0}${suffix || ''}</td><td>${as_[key] !== undefined ? as_[key] : 0}${suffix || ''}</td></tr>`;
    const section = (title, rowsHtml) =>
      `<div class="card-title" style="margin-top:14px">${title}</div><div class="table-scroll"><table class="lb-table" style="margin-bottom:6px"><thead><tr><th></th><th>${h.short}</th><th>${a.short}</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;

    const attack = row('Shots', 'shots') + row('On Target', 'shotsOn') + row('Big Chances', 'bigChances') + row('Big Chances Missed', 'bigChancesMissed')
      + row('Touches', 'touches') + row('Touches In Box', 'touchesInBox') + row('Progressive Carries', 'progressiveCarries') + row('Carries', 'carries')
      + row('Dribbles', 'dribbles') + row('Successful Dribbles', 'successfulDribbles') + row('Offsides', 'offsides');

    const passAcc = (v) => v ? Math.round(100 * (v.passesCompleted || 0) / v.passes) + '%' : '—';
    const passing = row('Passes', 'passes') + row('Completed', 'passesCompleted')
      + `<tr><td>Pass Accuracy</td><td>${hs.passes ? passAcc(hs) : '—'}</td><td>${as_.passes ? passAcc(as_) : '—'}</td></tr>`
      + row('Progressive Passes', 'progressivePasses') + row('Key Passes', 'keyPasses') + row('Through Balls', 'throughBalls')
      + row('Crosses', 'crosses') + row('Switches', 'switches') + row('Long Balls', 'longBalls') + row('Final-Third Passes', 'finalThirdPasses');

    const defense = row('Tackles', 'tackles') + row('Interceptions', 'interceptions') + row('Blocks', 'blocks') + row('Clearances', 'clearances')
      + row('Headed Clearances', 'headedClearances') + row('Defensive Errors', 'defensiveErrors') + row('Recoveries', 'recoveries')
      + row('Pressures', 'pressures') + row('Aerial Duels', 'aerialDuels');

    const physical = row('Distance (km)', 'distance') + row('Sprints', 'sprints') + row('High-Speed Runs', 'highSpeedRuns')
      + row('Accelerations', 'accelerations') + row('Decelerations', 'decelerations');

    const gk = row('Saves', 'saves') + row('Punches', 'punches') + row('Claims', 'claims') + row('Crosses Stopped', 'crossesStopped')
      + row('Goals Prevented', 'goalsPrevented') + row('PSxG', 'psxg') + row('Distribution', 'distribution', '%');

    return section('⚔️ Attack', attack) + section('🎯 Passing', passing) + section('🛡️ Defense', defense) + section('🏃 Physical', physical) + section('🧤 Goalkeeping', gk);
  }

  let _reportLegsCtx = null; // { legs: [{label, report}], activeIdx, aggText }

  function showMatchReport(report, legsCtx) {
    _reportLegsCtx = legsCtx || null;
    const ctx = _reportLegsCtx;
    if (!report) { toast('No match details available'); return; }
    const modal = document.getElementById('match-report-modal');
    const content = document.getElementById('match-report-content');
    if (!modal || !content) return;
    const h = report.home, a = report.away;
    const scoreLine = (h.penScore != null)
      ? `${h.score} (${h.penScore}) - (${a.penScore}) ${a.score}`
      : `${h.score} - ${a.score}`;
    const goalsH = (report.goals || []).filter(g => g.side === 'home');
    const goalsA = (report.goals || []).filter(g => g.side === 'away');
    const fmtG = (arr) => arr.map(g => `${g.dispLabel || (g.minute + "'")} ${g.player}${g.pen || /^penalty/i.test(g.method || '') ? ' <span class="pen-tag">[Penalty]</span>' : ''}`).join('<br>') || '—';
    // Auto-simmed fixtures (anything the user didn't watch live) only carry
    // a lightweight report — score, scorers, cards, MOTM — with none of the
    // full stat sheet or per-player ratings a watched match's report has.
    // See buildLightMatchReport() in engine/matchEngine.js.
    if (report.light) {
      const fmtCards = (arr) => (arr || []).map(c => `${c.dispLabel || (c.minute != null ? c.minute + "'" : '')} ${c.player} ${c.type === 'red' ? '🟥' : '🟨'}`.trim()).join('<br>') || '—';
      const fmtCount = (arr) => (arr || []).map(p => `${p.player}${p.count > 1 ? ' x' + p.count : ''}`).join('<br>') || '—';
      const fmtInjuries = (arr) => (arr || []).map(inj => `${inj.minute != null ? inj.minute + "'" : ''} ${inj.player}${inj.type ? ' — ' + inj.type : ''}${inj.matchesOut ? ` (out ${inj.matchesOut} match${inj.matchesOut > 1 ? 'es' : ''})` : ''}`.trim()).join('<br>') || '—';
      const legTabsHtml2 = (ctx && ctx.legs && ctx.legs.length > 1)
        ? `<div style="display:flex;gap:6px;justify-content:center;margin-bottom:10px;flex-wrap:wrap">
            ${ctx.legs.map((leg, i) => `<button class="btn btn-sm ${i === ctx.activeIdx ? 'btn-primary' : 'btn-secondary'}" onclick="App.showMatchReportLeg(${i})">${leg.label}</button>`).join('')}
          </div>
          ${ctx.aggText ? `<div style="text-align:center;font-size:0.8rem;color:var(--accent-gold);margin-bottom:8px">${ctx.aggText}</div>` : ''}`
        : '';
      content.innerHTML = `
        <div style="text-align:center;margin-bottom:14px">
          <div style="font-size:0.85rem;color:var(--text-muted)">Match Summary</div>
          ${legTabsHtml2}
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:8px">
            <div style="flex:1;text-align:left"><div style="font-size:1.4rem">${teamMark(h, 28)}</div><strong>${h.name}</strong><div class="goal-scorers">${fmtG(goalsH)}</div></div>
            <div style="font-size:1.6rem;font-weight:800;color:var(--accent-gold)">${scoreLine}</div>
            <div style="flex:1;text-align:right"><div style="font-size:1.4rem">${teamMark(a, 28)}</div><strong>${a.name}</strong><div class="goal-scorers away-scorers">${fmtG(goalsA)}</div></div>
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px">${h.formation||''} vs ${a.formation||''}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">🏟️ ${report.venue || 'Wembley Stadium'}</div>
        </div>
        <div class="card-title">Assists</div>
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:12px">
          <div style="flex:1;text-align:left;font-size:0.85rem">${fmtCount(h.assists)}</div>
          <div style="flex:1;text-align:right;font-size:0.85rem">${fmtCount(a.assists)}</div>
        </div>
        <div class="card-title">Saves</div>
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:12px">
          <div style="flex:1;text-align:left;font-size:0.85rem">${fmtCount(h.saves)}</div>
          <div style="flex:1;text-align:right;font-size:0.85rem">${fmtCount(a.saves)}</div>
        </div>
        <div class="card-title">Cards</div>
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:12px">
          <div style="flex:1;text-align:left;font-size:0.85rem">${fmtCards(h.cards || (report.cards && report.cards.home))}</div>
          <div style="flex:1;text-align:right;font-size:0.85rem">${fmtCards(a.cards || (report.cards && report.cards.away))}</div>
        </div>
        <div class="card-title">Injuries</div>
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:12px">
          <div style="flex:1;text-align:left;font-size:0.85rem">${fmtInjuries(report.injuries && report.injuries.home)}</div>
          <div style="flex:1;text-align:right;font-size:0.85rem">${fmtInjuries(report.injuries && report.injuries.away)}</div>
        </div>
        <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">This fixture was auto-simmed, so only a lightweight summary was kept — no full ratings or extended stats.</div>
        <div class="modal-actions"><button class="btn btn-secondary" onclick="document.getElementById('match-report-modal').classList.remove('active')">Close</button></div>`;
      modal.classList.add('active');
      return;
    }
    // Prefer the home/away-split ratings captured by buildMatchReport; fall back
    // to the old flat map for any legacy report objects saved before this split existed.
    const homeRatings = h.ratings || Object.values(report.ratings || {});
    const awayRatings = a.ratings || [];
    let eventsHtml = (report.events || []).filter(e => e.type !== 'pressure' || seededRandom() < 0.3).slice(-80).map(e => {
      const t = (e.text || '').replace(/<[^>]+>/g, '');
      return `<div class="report-event"><span class="re-min">${e.dispLabel || (e.minute + "'")}</span> <span class="re-type">${e.type}</span> ${t}</div>`;
    }).join('');
    // show important events only for cleaner view
    eventsHtml = (report.events || []).filter(e => ['goal','yellow','red','injury','sub','pen','var','motm','whistle','save','miss'].includes(e.type)).map(e => {
      const t = (e.text || '').replace(/<[^>]+>/g, '');
      return `<div class="report-event"><span class="re-min">${e.dispLabel || (e.minute + "'")}</span> ${t}</div>`;
    }).join('');
    const legTabsHtml = (ctx && ctx.legs && ctx.legs.length > 1)
      ? `<div style="display:flex;gap:6px;justify-content:center;margin-bottom:10px;flex-wrap:wrap">
          ${ctx.legs.map((leg, i) => `<button class="btn btn-sm ${i === ctx.activeIdx ? 'btn-primary' : 'btn-secondary'}" onclick="App.showMatchReportLeg(${i})">${leg.label}</button>`).join('')}
        </div>
        ${ctx.aggText ? `<div style="text-align:center;font-size:0.8rem;color:var(--accent-gold);margin-bottom:8px">${ctx.aggText}</div>` : ''}`
      : '';
    content.innerHTML = `
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-size:0.85rem;color:var(--text-muted)">Match Report</div>
        ${legTabsHtml}
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:8px">
          <div style="flex:1;text-align:left"><div style="font-size:1.4rem">${teamMark(h, 28)}</div><strong>${h.name}</strong><div class="goal-scorers">${fmtG(goalsH)}</div></div>
          <div style="font-size:1.6rem;font-weight:800;color:var(--accent-gold)">${scoreLine}</div>
          <div style="flex:1;text-align:right"><div style="font-size:1.4rem">${teamMark(a, 28)}</div><strong>${a.name}</strong><div class="goal-scorers away-scorers">${fmtG(goalsA)}</div></div>
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px">${h.formation||''} vs ${a.formation||''}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">🏟️ ${report.venue || 'Wembley Stadium'}</div>
      </div>
      <div class="card-title">Key Events</div>
      <div style="max-height:220px;overflow-y:auto;margin-bottom:12px">${eventsHtml || '<span style="color:var(--text-muted)">No events logged</span>'}</div>
      <div class="card-title">Team Stats</div>
      <div class="table-scroll"><table class="lb-table" style="margin-bottom:12px"><thead><tr><th></th><th>${h.short}</th><th>${a.short}</th></tr></thead>
      <tbody>
        <tr><td>Shots</td><td>${(h.stats&&h.stats.shots)||0}</td><td>${(a.stats&&a.stats.shots)||0}</td></tr>
        <tr><td>On Target</td><td>${(h.stats&&h.stats.shotsOn)||0}</td><td>${(a.stats&&a.stats.shotsOn)||0}</td></tr>
        <tr><td>Possession</td><td>${(h.stats&&h.stats.possession)||50}%</td><td>${(a.stats&&a.stats.possession)||50}%</td></tr>
        <tr><td>Passes</td><td>${(h.stats&&h.stats.passes)||0}</td><td>${(a.stats&&a.stats.passes)||0}</td></tr>
        <tr><td>Passes completed</td><td>${(h.stats&&h.stats.passesCompleted)||0}</td><td>${(a.stats&&a.stats.passesCompleted)||0}</td></tr>
        <tr><td>Pass accuracy</td><td>${(h.stats&&h.stats.passes)?Math.round(100*(h.stats.passesCompleted||0)/h.stats.passes)+'%':'—'}</td><td>${(a.stats&&a.stats.passes)?Math.round(100*(a.stats.passesCompleted||0)/a.stats.passes)+'%':'—'}</td></tr>
        <tr><td>Interceptions</td><td>${(h.stats&&h.stats.interceptions)||0}</td><td>${(a.stats&&a.stats.interceptions)||0}</td></tr>
        <tr><td>Blocks</td><td>${(h.stats&&h.stats.blocks)||0}</td><td>${(a.stats&&a.stats.blocks)||0}</td></tr>
        <tr><td>Corners</td><td>${(h.stats&&h.stats.corners)||0}</td><td>${(a.stats&&a.stats.corners)||0}</td></tr>
        <tr><td>Fouls</td><td>${(h.stats&&h.stats.fouls)||0}</td><td>${(a.stats&&a.stats.fouls)||0}</td></tr>
        <tr><td>Saves</td><td>${(h.stats&&h.stats.saves)||0}</td><td>${(a.stats&&a.stats.saves)||0}</td></tr>
        <tr><td>Yellow / Red</td><td>${(h.stats&&h.stats.yellows)||0} / ${(h.stats&&h.stats.reds)||0}</td><td>${(a.stats&&a.stats.yellows)||0} / ${(a.stats&&a.stats.reds)||0}</td></tr>
      </tbody></table></div>
      ${renderCategorizedTeamStatsHTML(h, a)}
      <div class="card-title" style="margin-top:14px">Player Ratings (${homeRatings.length + awayRatings.length} players)</div>
      <div style="max-height:280px;overflow-y:auto">
        <div style="font-size:0.8rem;color:var(--accent-gold);margin:8px 0 4px">${teamMark(h, 18)} ${h.name}</div>
        ${homeRatings.map(p => renderRatingRow(p, report.motmId)).join('') || '<div style="color:var(--text-muted);font-size:0.85rem">No data</div>'}
        <div style="font-size:0.8rem;color:var(--accent-gold);margin:12px 0 4px">${teamMark(a, 18)} ${a.name}</div>
        ${awayRatings.map(p => renderRatingRow(p, report.motmId)).join('') || '<div style="color:var(--text-muted);font-size:0.85rem">No data</div>'}
      </div>
      <div class="modal-actions"><button class="btn btn-secondary" onclick="document.getElementById('match-report-modal').classList.remove('active')">Close</button></div>`;
    modal.classList.add('active');
  }

  // Switch the currently-open match report modal to a different leg (two-leg ties only).
  function showMatchReportLeg(idx) {
    if (!_reportLegsCtx || !_reportLegsCtx.legs || !_reportLegsCtx.legs[idx]) return;
    _reportLegsCtx.activeIdx = idx;
    showMatchReport(_reportLegsCtx.legs[idx].report, _reportLegsCtx);
  }

  function viewFixtureReport(idx) {
    if (!tournament || !tournament.fixtures[idx] || !tournament.fixtures[idx].report) {
      toast('No detailed report for this match');
      return;
    }
    showMatchReport(tournament.fixtures[idx].report, null);
  }

  function viewKnockoutReport(ri, mi) {
    const m = tournament && tournament.knockout[ri] && tournament.knockout[ri].matches[mi];
    if (!m) { toast('No detailed report for this match'); return; }
    if (m.twoLeg !== false && m.leg1 && m.leg2 && m.leg1.report && m.leg2.report) {
      const aggText = (m.aggHome != null) ? `Aggregate: ${m.home.short} ${m.aggHome} - ${m.aggAway} ${m.away.short}${m.penalties ? (m.pens ? ` (pens ${m.pens.home}-${m.pens.away})` : ' (on penalties)') : ''}` : '';
      const legs = [
        { label: `Leg 1 · ${m.leg1.report.home.short} home`, report: m.leg1.report },
        { label: `Leg 2 · ${m.leg2.report.home.short} home`, report: m.leg2.report }
      ];
      showMatchReport(legs[1].report, { legs, activeIdx: 1, aggText });
      return;
    }
    if (!m.report) { toast('No detailed report for this match'); return; }
    showMatchReport(m.report, null);
  }


  function blankPlayerMatchStats(p) {
    return {
      id: p.id, name: p.name, num: p.num, pos: (p.pos||[])[0], ovr: p.ovr,
      goals: 0, assists: 0, shots: 0, saves: 0, tackles: 0, passes: 0, xg: 0, xa: 0, rating: 6.0, yellow: false, red: false,
      // Attack
      bigChances: 0, bigChancesMissed: 0, touches: 0, touchesInBox: 0, progressiveCarries: 0, carries: 0, dribbles: 0, successfulDribbles: 0, offsides: 0,
      // Passing
      progressivePasses: 0, keyPasses: 0, throughBalls: 0, crosses: 0, switches: 0, longBalls: 0, finalThirdPasses: 0,
      // Defense
      interceptions: 0, blocks: 0, clearances: 0, headedClearances: 0, defensiveErrors: 0, recoveries: 0, pressures: 0, aerialDuels: 0,
      // Physical
      distance: 0, sprints: 0, highSpeedRuns: 0, accelerations: 0, decelerations: 0,
      // Goalkeeping
      punches: 0, claims: 0, crossesStopped: 0, goalsPrevented: 0, psxg: 0, distribution: 0
    };
  }

  // Broad role bucket for extended-stats generation below — GK / DEF / MID / FWD.
  function posGroupOf(posArr, primaryPos) {
    const pp = (primaryPos || (posArr || [])[0] || 'CM').toUpperCase();
    const list = (posArr || []).map(x => (x || '').toUpperCase());
    if (pp === 'GK' || list.includes('GK')) return 'GK';
    if (['CB', 'RB', 'LB', 'RWB', 'LWB'].includes(pp) || list.some(x => ['CB','RB','LB','RWB','LWB'].includes(x))) return 'DEF';
    if (['CM', 'CDM', 'CAM', 'RM', 'LM'].includes(pp) || list.some(x => ['CM','CDM','CAM','RM','LM'].includes(x))) return 'MID';
    return 'FWD';
  }

  // Fills in the full extended stat sheet (Attack/Passing/Defense/Physical/
  // Goalkeeping) for every player involved in the match, then sums each
  // field into the team totals so the team sheet always agrees exactly with
  // what's shown per-player underneath it. Runs once at full time (called
  // from endMatch(), after ratings/goalsConceded are finalised) rather than
  // tick-by-tick — a handful of the underlying numbers (shots, passes,
  // passesCompleted, tackles, interceptions, blocks, saves, goals, assists)
  // are the real minute-by-minute simulation output; everything else here
  // is a plausible derived breakdown built from those, the player's role,
  // and minutes played, in the same spirit as the existing rating formula.
  const EXTENDED_STAT_KEYS = ['bigChances','bigChancesMissed','touches','touchesInBox','progressiveCarries','carries',
    'dribbles','successfulDribbles','offsides','progressivePasses','keyPasses','throughBalls','crosses',
    'switches','longBalls','finalThirdPasses','tackles','clearances','headedClearances','defensiveErrors',
    'recoveries','pressures','aerialDuels','distance','sprints','highSpeedRuns','accelerations','decelerations',
    'punches','claims','crossesStopped','goalsPrevented','psxg'];

  function deriveExtendedMatchStats(m) {
    if (!m) return;
    ['home', 'away'].forEach(side => {
      const teamSide = m[side];
      const oppSide = side === 'home' ? m.away : m.home;
      const squadAll = (teamSide.squad && teamSide.squad.all) || [];
      squadAll.forEach(p => {
        const ps = m.playerMatchStats[p.id];
        if (!ps) return;
        const minutes = computeMinutesPlayed(m, p.id, p.name, side);
        const played = minutes > 0 || ps.goals || ps.assists || ps.shots || ps.saves || ps.tackles || ps.passes || ps.interceptions || ps.blocks;
        if (!played) return;
        const posArr = (ps.posArr && ps.posArr.length) ? ps.posArr : (p.pos || []);
        const group = posGroupOf(posArr, ps.pos);
        const minFrac = Math.max(0.15, Math.min(1, minutes / 90));
        const shots = ps.shots || 0, passes = ps.passes || 0, passesC = ps.passesCompleted || 0;
        const goals = ps.goals || 0, assists = ps.assists || 0;
        const rv = (mean, spread) => Math.max(0, mean + (seededRandom() * 2 - 1) * spread);
        const rr = (v) => Math.round(v);

        if (group === 'GK') {
          const touches = rv(16 + minFrac * 12, 5);
          ps.touches = rr(touches);
          ps.touchesInBox = ps.touches;
          ps.carries = rr(touches * 0.35);
          ps.progressiveCarries = rr(ps.carries * 0.1);
          ps.dribbles = 0; ps.successfulDribbles = 0; ps.bigChances = 0; ps.bigChancesMissed = 0; ps.offsides = 0;
          ps.progressivePasses = rr(passesC * 0.22);
          ps.keyPasses = 0; ps.throughBalls = 0; ps.crosses = 0;
          ps.switches = rr(passesC * 0.04);
          ps.longBalls = rr(passesC * (0.3 + seededRandom() * 0.2));
          ps.finalThirdPasses = rr(passesC * 0.04);
          ps.clearances = rr(rv(1.5 * minFrac, 1.4));
          ps.headedClearances = rr(ps.clearances * 0.25);
          ps.defensiveErrors = seededRandom() < 0.035 * minFrac ? 1 : 0;
          ps.recoveries = rr(rv(2 * minFrac, 1.4));
          ps.pressures = rr(rv(1 * minFrac, 1));
          ps.aerialDuels = rr(rv(0.6 * minFrac, 0.8));
          ps.distance = +(3.2 + minFrac * 3 + seededRandom()).toFixed(1);
          ps.sprints = rr(rv(1.5 * minFrac, 1.2));
          ps.highSpeedRuns = rr(rv(0.8 * minFrac, 0.8));
          ps.accelerations = rr(rv(2.5 * minFrac, 1.5));
          ps.decelerations = rr(rv(2.5 * minFrac, 1.5));
          const shotsFaced = oppSide.stats.shotsOn || 0;
          ps.punches = rr(rv(shotsFaced * 0.1, 0.6));
          ps.claims = rr(rv(minFrac * 1.3, 1));
          ps.crossesStopped = rr(rv(minFrac * 1.1, 1));
          // Post-shot xG faced ≈ shots-on-target faced × a per-shot quality
          // factor; Goals Prevented is the usual "keeper overperformance"
          // read — how many more goals an average keeper would've conceded
          // facing the same shots.
          ps.psxg = +(shotsFaced * (0.28 + seededRandom() * 0.12)).toFixed(2);
          ps.goalsPrevented = +(ps.psxg - (ps.goalsConceded || 0)).toFixed(2);
          ps.distribution = passes ? rr((passesC / passes) * 100) : 0;
        } else {
          const isDef = group === 'DEF', isMid = group === 'MID', isFwd = group === 'FWD';
          const tackles = ps.tackles || 0, ints = ps.interceptions || 0;
          const touchBase = (isFwd ? 9 : isMid ? 15 : isDef ? 8 : 8) * minFrac;
          ps.touches = rr(touchBase + passes * 1.15 + shots * 1.3 + tackles * 0.5 + ints * 0.4 + rv(0, 3));
          ps.touchesInBox = rr((isFwd ? ps.touches * 0.16 : isMid ? ps.touches * 0.06 : isDef ? ps.touches * 0.025 : 0.03 * ps.touches) + shots * 0.6);
          ps.carries = rr(ps.touches * (0.5 + seededRandom() * 0.12));
          ps.progressiveCarries = rr(ps.carries * (isFwd ? 0.22 : isMid ? 0.18 : isDef ? 0.08 : 0.15));
          const dribbleBase = (isFwd ? 2.0 : isMid ? 1.3 : isDef ? 0.35 : 1) * minFrac + shots * 0.12;
          ps.dribbles = rr(rv(dribbleBase, 1.1));
          ps.successfulDribbles = rr(ps.dribbles * (0.5 + seededRandom() * 0.25));
          ps.offsides = (isFwd && seededRandom() < 0.16 * minFrac) ? (seededRandom() < 0.2 ? 2 : 1) : 0;

          ps.progressivePasses = rr(passesC * (isMid ? 0.22 : isDef ? 0.15 : isFwd ? 0.12 : 0.1));
          ps.keyPasses = rr(passesC * (isMid ? 0.055 : isFwd ? 0.045 : 0.018) + assists * 0.7);
          ps.throughBalls = rr(ps.keyPasses * (0.12 + seededRandom() * 0.15));
          const wide = WIDE_SLOTS.has((ps.slot || ps.pos || '').toUpperCase());
          ps.crosses = rr(passes * (wide ? 0.14 : isFwd ? 0.04 : 0.015) + rv(0, 1));
          ps.switches = rr(passesC * 0.018);
          ps.longBalls = rr(passesC * (isDef ? 0.18 : isMid ? 0.08 : 0.04));
          ps.finalThirdPasses = rr(passesC * (isFwd ? 0.35 : isMid ? 0.3 : isDef ? 0.12 : 0.2));

          // Clearances are now genuinely live-simulated minute-by-minute
          // (see simulateDefensiveActions in engine/defending.js), which
          // sets ps._liveClr — this backfill only kicks in as a fallback
          // for a player that loop never touched (e.g. a slot outside its
          // table). Retuned toward the real-world per-game average for a
          // starting CB (~7.3 clearances) rather than the old, much lower
          // 3.2 mean.
          if (!ps._liveClr) {
            ps.clearances = rr(rv((isDef ? 7.3 : isMid ? 1.4 : 0.3) * minFrac, isDef ? 3 : 0.7));
          }
          ps.headedClearances = rr(ps.clearances * (0.3 + seededRandom() * 0.25));
          ps.defensiveErrors = seededRandom() < (isDef ? 0.05 : 0.02) * minFrac ? 1 : 0;
          ps.recoveries = rr(rv((isDef ? 5 : isMid ? 5.5 : 2.5) * minFrac, 2));
          ps.pressures = rr(rv((isFwd ? 4 : isMid ? 5 : 3) * minFrac, 2));
          ps.aerialDuels = rr(rv((isDef ? 3.5 : isFwd ? 2.2 : 1.2) * minFrac, 1.5));

          ps.distance = +((isMid ? 8.8 : isDef ? 7.6 : isFwd ? 8.2 : 5) * minFrac + seededRandom() * 1.2).toFixed(1);
          ps.sprints = rr(rv((isFwd ? 14 : isMid ? 11 : 9) * minFrac, 4));
          ps.highSpeedRuns = rr(ps.sprints * (0.45 + seededRandom() * 0.2));
          ps.accelerations = rr(rv((isFwd ? 10 : 8) * minFrac, 3));
          ps.decelerations = rr(rv((isFwd ? 10 : 8) * minFrac, 3));

          ps.bigChances = rr(ps.keyPasses * 0.35 + assists * 0.6 + (isFwd ? shots * 0.12 : 0));
          const chanceShots = Math.min(shots, rr(shots * 0.4 + (isFwd ? 0.3 : 0)));
          ps.bigChancesMissed = Math.max(0, chanceShots - goals);
          ps.punches = 0; ps.claims = 0; ps.crossesStopped = 0; ps.psxg = 0; ps.goalsPrevented = 0; ps.distribution = 0;
        }
      });

      EXTENDED_STAT_KEYS.forEach(k => { teamSide.stats[k] = 0; });
      squadAll.forEach(p => {
        const ps = m.playerMatchStats[p.id];
        if (!ps) return;
        EXTENDED_STAT_KEYS.forEach(k => { if (typeof ps[k] === 'number') teamSide.stats[k] += ps[k]; });
      });
      teamSide.stats.distance = +teamSide.stats.distance.toFixed(1);
      teamSide.stats.psxg = +teamSide.stats.psxg.toFixed(2);
      teamSide.stats.goalsPrevented = +teamSide.stats.goalsPrevented.toFixed(2);
      // Team-wide distribution accuracy is the side's overall pass accuracy,
      // not a sum of individual keeper numbers.
      teamSide.stats.distribution = teamSide.stats.passes ? Math.round((teamSide.stats.passesCompleted / teamSide.stats.passes) * 100) : 0;
    });
  }

  function pickGoalMethod(shooter) {
    const methods = [
      { desc: 'low driven finish across the keeper', xg: 0.38, puskas: false },
      { desc: 'side-footed placement into the far corner', xg: 0.36, puskas: false },
      { desc: 'powerful right-footed strike', xg: 0.33, puskas: false },
      { desc: 'left-footed drive', xg: 0.32, puskas: false },
      { desc: 'towering header', xg: 0.30, puskas: false },
      { desc: 'glancing near-post header', xg: 0.28, puskas: false },
      { desc: 'tap-in from close range', xg: 0.58, puskas: false },
      { desc: 'poacher\'s finish at the far post', xg: 0.48, puskas: false },
      { desc: 'deflected effort that wrong-foots the keeper', xg: 0.22, puskas: false },
      { desc: 'low screamer into the bottom corner', xg: 0.16, puskas: true },
      { desc: 'dipping shot from outside the box', xg: 0.14, puskas: true },
      { desc: 'rising drive that flies into the roof of the net', xg: 0.13, puskas: true },
      { desc: 'knuckleball strike that swerves late', xg: 0.12, puskas: true },
      { desc: 'blitz curler into the top corner', xg: 0.15, puskas: true },
      { desc: 'inch-perfect curled finish around the wall', xg: 0.17, puskas: true },
      { desc: 'chip over the advancing keeper', xg: 0.20, puskas: true },
      { desc: 'first-time volley on the half-turn', xg: 0.18, puskas: true },
      { desc: 'overhead kick', xg: 0.10, puskas: true },
      { desc: 'bicycle kick', xg: 0.09, puskas: true },
      { desc: 'rabona finish', xg: 0.08, puskas: true },
      { desc: 'solo run from halfway, then cool finish', xg: 0.19, puskas: true },
      { desc: 'cut inside and arrowed shot near post', xg: 0.24, puskas: false },
      { desc: 'rebound smashed home', xg: 0.42, puskas: false },
      { desc: 'toe-poke under the keeper', xg: 0.40, puskas: false }
    ];
    // Blitz Curler is a real finishing identity, not just a flavor-pool
    // nudge — but it shouldn't be the ONLY thing they ever score with
    // either (a Blitz Curler striker still gets the occasional tap-in,
    // header, rebound, etc.). So it heavily loads the dice toward the
    // trademark blitz curl finish rather than forcing it every time, and
    // how loaded those dice are scales with blitzCurlerEdge() (Finishing/
    // Curl/Kicking Power) — the same attributes feeding shotQuality
    // upstream in resolveShot() — so a genuinely elite blitz curler pulls
    // it off much more often than one who merely has the skill tag.
    if (hasSkill(shooter, 'Blitz Curler')) {
      const blitzChance = Math.max(0.35, Math.min(0.8, 0.5 + blitzCurlerEdge(shooter) * 1.5));
      if (seededRandom() < blitzChance) {
        const blitz = methods.find(m => m.desc === 'blitz curler into the top corner');
        const flavor = seededRandom() < 0.35 ? styleFlavor(shooter, GOAL_FLAVOR_SUFFIX) : null;
        return flavor ? { ...blitz, desc: `${blitz.desc}, ${flavor}` } : blitz;
      }
      // Otherwise falls through to the normal pool below, same as any
      // other player.
    }
    const spectacular = methods.filter(m => m.puskas);
    const normal = methods.filter(m => !m.puskas);
    const tec = shooter.tec || 70;
    // Weighted pick within a pool: a boosted player's specific traits (a great
    // header, a genuine long-range/curl specialist) skew which finish type
    // they're likely to have scored with, instead of every method in the pool
    // being equally likely regardless of who's shooting.
    const weightedPick = (pool) => {
      if (!shooter.expandedAttrs) return pool[Math.floor(seededRandom() * pool.length)];
      const longKeys = ['screamer', 'dipping', 'rising', 'knuckleball', 'curler', 'curled'];
      const weights = pool.map((m) => {
        const d = m.desc.toLowerCase();
        let w = 1;
        if (d.includes('header')) w *= aerialSkill(shooter) * 2;
        else if (longKeys.some(k => d.includes(k))) w *= Math.max(0.2, 1 + fkTakerEdge(shooter) * 3);
        else if (d.includes('tap-in') || d.includes('poacher') || d.includes('toe-poke') || d.includes('rebound')) w *= Math.max(0.2, 1 + finishingEdge(shooter));
        return Math.max(0.05, w);
      });
      const total = weights.reduce((a, b) => a + b, 0);
      let r = seededRandom() * total;
      for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
      return pool[pool.length - 1];
    };
    const chosen = (tec > 88 && seededRandom() < 0.42) ? weightedPick(spectacular)
      : (tec > 82 && seededRandom() < 0.28) ? weightedPick(spectacular)
      : (seededRandom() < 0.18 ? weightedPick(spectacular) : weightedPick(normal));
    // Roughly a third of the time, tack on a playstyle-specific clause
    // describing *how* the scorer got there — the same "tap-in" reads
    // differently for a Fox in the Box than for a Full-back Finisher.
    const flavor = seededRandom() < 0.35 ? styleFlavor(shooter, GOAL_FLAVOR_SUFFIX) : null;
    return flavor ? { ...chosen, desc: `${chosen.desc}, ${flavor}` } : chosen;
  }

  function pickMissDesc(shooter) {
    const foot = seededRandom() < 0.55 ? 'right footed' : 'left footed';
    const areas = [
      foot + ' shot from outside the box misses to the left',
      foot + ' shot from outside the box is too high',
      foot + ' shot from the centre of the box misses to the right',
      foot + ' shot from the right side of the box is close, but misses to the left',
      foot + ' shot from the left side of the box misses to the right',
      'header from the centre of the box misses to the left',
      'header from the centre of the box is too high',
      foot + ' shot from outside the box is blocked',
      foot + ' shot from the centre of the box is blocked',
      foot + ' shot from a difficult angle on the right misses to the left',
      'first-time ' + foot + ' shot from outside the box is high and wide to the left',
      foot + ' volley from the centre of the box is too high'
    ];
    return areas[Math.floor(seededRandom() * areas.length)];
  }

  function sofascoreMiss(shooter, team) {
    return 'Attempt missed. <span class="player">' + shooter.name + '</span> (' + (team.short || team.name) + ') ' + pickMissDesc(shooter) + '.';
  }

  function sofascoreSave(gk, shooter, team, defTeam) {
    const foot = seededRandom() < 0.55 ? 'right footed' : 'left footed';
    const lines = [
      'Attempt saved. <span class="player">' + shooter.name + '</span> (' + (team.short||'') + ') ' + foot + ' shot from the centre of the box is saved in the centre of the goal by <span class="player">' + gk.name + '</span> (' + (defTeam.short||'') + ').',
      'Attempt saved. <span class="player">' + shooter.name + '</span> (' + (team.short||'') + ') ' + foot + ' shot from outside the box is saved in the bottom left corner by <span class="player">' + gk.name + '</span>.',
      'Attempt saved. <span class="player">' + shooter.name + '</span> (' + (team.short||'') + ') header from the centre of the box is saved in the top centre of the goal by <span class="player">' + gk.name + '</span>.',
      '<span class="player">' + gk.name + '</span> (' + (defTeam.short||'') + ') saves a ' + foot + ' shot from <span class="player">' + shooter.name + '</span> at full stretch.'
    ];
    return lines[Math.floor(seededRandom() * lines.length)];
  }


  function pickSaveDesc(gk, shooter) {
    const list = [
      `strong hands from <span class="player">${gk.name}</span> to push away a fierce drive`,
      `<span class="player">${gk.name}</span> dives full length to tip a curler around the post`,
      `reflex save — <span class="player">${gk.name}</span> blocks from point-blank range`,
      `<span class="player">${gk.name}</span> gets down quickly to hold a low shot`,
      `spectacular tip over from <span class="player">${gk.name}</span> as a rising shot threatens the top corner`,
      `<span class="player">${gk.name}</span> parries a knuckleball, then gathers at the second attempt`,
      `brave claim by <span class="player">${gk.name}</span> under pressure from the striker`
    ];
    return list[Math.floor(seededRandom() * list.length)];
  }
  // Distinct flavor for a clean catch (gk_catch) vs. the pickSaveDesc bank
  // above, which reads more like a parry/reflex stop — so a shot-stopper
  // with genuinely strong hands reads differently from one who's mostly
  // getting a hand/foot to things.
  function pickCatchDesc(gk, shooter) {
    const list = [
      `<span class="player">${gk.name}</span> gets both hands to it and holds on comfortably`,
      `safe hands from <span class="player">${gk.name}</span> — gathered cleanly, no danger of a rebound`,
      `<span class="player">${gk.name}</span> reads the shot early and catches it on his line`,
      `composed take from <span class="player">${gk.name}</span>, straight into his grasp`,
      `<span class="player">${gk.name}</span> plucks it out of the air and clutches it to his chest`
    ];
    return list[Math.floor(seededRandom() * list.length)];
  }

  // A real move name (from player-attributes.json's skills list) -> a bank
  // of specific descriptions for it. Two players who both have "Flip Flap"
  // will still see varied wording match to match, but the move named is
  // always the one actually on their sheet — not a random unrelated skill.
  const SKILL_MOVE_TEXT = {
    'Chop Turn': [
      (a, o) => `${a} drags the ball back with a sharp chop turn, spinning away from ${o}`,
      (a, o) => `${a} chops the ball inside off one touch, leaving ${o} facing the wrong way`
    ],
    'Cut Behind & Turn': [
      (a, o) => `${a} shields the ball, cuts it behind his standing leg and spins ${o} clean out of the contest`,
      (a, o) => `${a} rolls it behind his heel and turns away from ${o} in one motion`
    ],
    'Double Touch': [
      (a, o) => `${a} sends ${o} the wrong way with a lightning double touch`,
      (a, o) => `${a} touches it one way then the other — ${o} is left grasping at thin air`
    ],
    'Flip Flap': [
      (a, o) => `${a} pulls out an audacious flip flap and ${o} simply isn't there anymore`,
      (a, o) => `${a} rocks ${o} with a flip flap and glides past`
    ],
    'Marseille Turn': [
      (a, o) => `${a} spins out of a tight spot with a Marseille turn, leaving ${o} chasing shadows`,
      (a, o) => `${a} rolls through a full 360 to shake off ${o}`
    ],
    'Scissors Feint': [
      (a, o) => `${a} scissors his feet over the ball and ${o} bites on the fake`,
      (a, o) => `${a} sends ${o} the wrong way with a scissors feint before accelerating away`
    ],
    'Sole Control': [
      (a, o) => `${a} drags the ball back under his sole, wrong-footing ${o} completely`,
      (a, o) => `${a} rolls it under his foot and ${o} lunges into empty space`
    ],
    'Sombrero': [
      (a, o) => `${a} flicks it up and over ${o}'s head with an outrageous sombrero`,
      (a, o) => `${a} lobs the ball over ${o} with a sombrero flick and collects it on the other side`
    ]
  };
  const GENERIC_MOVE_NAMES = ['elastico', 'roulette', 'step-over', 'body feint', 'shoulder drop', 'stop-and-go', 'drag-back'];

  function pickSkillDesc(player, opponent) {
    const opp = opponent ? opponent.name : 'the defender';
    const nameTag = `<span class="player">${player.name}</span>`;
    // Prefer whatever real skill moves are actually on this player's sheet
    // (player-attributes.json), so the commentary names the move he
    // genuinely has rather than a random generic one.
    const ownMoves = ((player && player.expandedAttrs && player.expandedAttrs.skills) || [])
      .filter((s) => SKILL_MOVE_TEXT[s]);
    let base;
    if (ownMoves.length) {
      const move = ownMoves[Math.floor(seededRandom() * ownMoves.length)];
      const templates = SKILL_MOVE_TEXT[move];
      base = templates[Math.floor(seededRandom() * templates.length)](nameTag, opp);
    } else {
      const move = GENERIC_MOVE_NAMES[Math.floor(seededRandom() * GENERIC_MOVE_NAMES.length)];
      const ends = [
        `beats ${opp} with a ${move}`,
        `uses a ${move} to leave ${opp} on the ground`,
        `sells ${opp} with a sharp ${move}`,
        `skins ${opp} using a ${move} and accelerates clear`,
        `bamboozles ${opp} with a ${move} on the touchline`
      ];
      base = `${nameTag} ${ends[Math.floor(seededRandom() * ends.length)]}`;
    }
    // Layer on a playstyle-specific follow-up, so what happens right after
    // beating the man differs by role, not just the move that beat him.
    const follow = styleFlavor(player, DRIBBLE_FOLLOWUP);
    return follow ? `${base}, ${follow}` : base;
  }

  function pickPenOutcome(taker, gk) {
    // precise outcomes for pens
    const outcomes = [
      { scored: true, text: 'sends the keeper the wrong way — bottom left' },
      { scored: true, text: 'smashes high into the top-right corner' },
      { scored: true, text: 'cool finish down the middle as the keeper dives early' },
      { scored: true, text: 'low and hard to the keeper\'s right' },
      { scored: true, text: 'panenka chip that floats under the bar' },
      { scored: false, saved: true, text: 'saved — the keeper guesses correctly and palms it away to his left' },
      { scored: false, saved: true, text: 'saved low to the right — strong hand from the goalkeeper' },
      { scored: false, saved: false, text: 'crashes against the crossbar and stays out' },
      { scored: false, saved: false, text: 'skewed wide of the left post' },
      { scored: false, saved: true, text: 'keeper tips it onto the upright — rebound cleared' }
    ];
    // ~72% base score rate, nudged by the taker's placement/specialist edge
    // and the keeper's penalty-specific edge — so a real penalty specialist
    // genuinely converts more often than a fringe outfield taker, and a
    // shot-stopper with "GK Penalty Saver" genuinely saves more.
    const scoredOnes = outcomes.filter(o => o.scored);
    const missedOnes = outcomes.filter(o => !o.scored);
    const scoreProb = Math.max(0.35, Math.min(0.95, 0.72 + penTakerEdge(taker) - penGkEdge(gk)));
    if (seededRandom() < scoreProb) return scoredOnes[Math.floor(seededRandom() * scoredOnes.length)];
    return missedOnes[Math.floor(seededRandom() * missedOnes.length)];
  }

  function pickFkOutcome(taker, gk, boost) {
    const outcomes = [
      { scored: true, text: 'whipped curler over the wall into the top corner' },
      { scored: true, text: 'knuckleball that dips late under the bar' },
      { scored: true, text: 'low drive that skids under the jumping wall' },
      { scored: true, text: 'rising shot into the far top corner' },
      { scored: false, saved: false, text: 'cleared off the line after the keeper was beaten' },
      { scored: false, saved: true, text: 'kept out — the keeper tips a curling effort over the bar' },
      { scored: false, saved: false, wall: true, text: 'struck into the wall and spun away for a corner' },
      { scored: false, saved: false, text: 'inches over the crossbar' },
      { scored: false, saved: false, text: 'curls wide of the far post' }
    ];
    const scoredOnes = outcomes.filter(o => o.scored);
    const missedOnes = outcomes.filter(o => !o.scored);
    // `boost` — a small edge for a quick restart caught the defence
    // unorganised (see resolveFreeKickRoutine in engine/setpieces.js);
    // defaults to 0 so every existing call site is unaffected.
    const scoreProb = Math.max(0.06, Math.min(0.6, 0.22 + fkTakerEdge(taker) - gkReflexEdge(gk) * 0.4 + (boost || 0)));
    if (seededRandom() < scoreProb) return scoredOnes[Math.floor(seededRandom() * scoredOnes.length)];
    return missedOnes[Math.floor(seededRandom() * missedOnes.length)];
  }


  function calcPlayerRating(ps) {
    // Position-aware, activity-based, no random noise
    if (!ps) return 6.0;
    const goals = ps.goals || 0;
    const assists = ps.assists || 0;
    const shots = ps.shots || 0;
    const saves = ps.saves || 0;
    const tackles = ps.tackles || 0;
    const passes = ps.passes || 0;
    const xg = ps.xg || 0;
    const xa = ps.xa || 0;
    const pos = (ps.pos || ps.slot || '').toString().toUpperCase();
    const isGK = pos === 'GK' || (ps.posArr || []).includes('GK');
    const isDef = ['CB','RB','LB','RWB','LWB','DEF'].some(x => pos.includes(x)) || (ps.posArr || []).some(p => ['CB','RB','LB','RWB','LWB'].includes(p));
    const isMid = ['CM','CDM','CAM','RM','LM','DM','AM'].some(x => pos.includes(x)) || (ps.posArr || []).some(p => ['CM','CDM','CAM','RM','LM'].includes(p));

    let r = 6.0;

    const passesC = ps.passesCompleted || 0;
    const ints = ps.interceptions || 0;
    const blocks = ps.blocks || 0;
    // Goals conceded by the player's team this match — set by the caller
    // (endMatch / renderLineups) from the live/final scoreline. A back line
    // and keeper shipping a hatful of goals should be dragged down for it,
    // even if they racked up passes/tackles along the way; conceding 0-1 is
    // normal and isn't penalized.
    const conceded = ps.goalsConceded || 0;
    if (isGK) {
      r += Math.min(saves * 0.35, 2.4);
      if (saves >= 4) r += 0.25;
      if (saves >= 7) r += 0.35;
      if (ps.cleanSheet) r += 0.6;
      if (goals > 0) r += 1.5;
      r += Math.min(passes * 0.01, 0.25);
      r += Math.min(passesC * 0.015, 0.2);
      if (conceded >= 2) r -= Math.min((conceded - 1) * 0.45, 3.2);
      if (ps.yellow) r -= 0.35;
      if (ps.red) r -= 2.0;
    } else if (isDef) {
      // Defensive actions and pass volume used to be capped *separately*
      // (tackles up to +1.6, interceptions +1.2, blocks +0.9, passes +0.45,
      // completed passes +0.4 — up to +4.55 combined). Since the match sim
      // gives every CB/full-back realistic tackle counts and heavy pass
      // volume most matches just by playing 90 minutes, that let defenders
      // stack those caps and sit near the rating ceiling on a routine game
      // with zero goal involvement, crowding out attackers for MOTM. Now
      // defensive actions and passing each have one combined cap instead,
      // so an ordinary solid game lands in the 7s and genuine standout
      // contributions (or a goal/assist) are what push a defender higher.
      r += Math.min(tackles * 0.18 + ints * 0.2 + blocks * 0.15, 1.3);
      r += Math.min(passes * 0.008 + passesC * 0.012, 0.35);
      r += assists * 0.7;
      r += goals * 1.1;
      r += Math.min(shots * 0.08, 0.3);
      if (tackles + ints >= 6) r += 0.2;
      if (conceded >= 2) r -= Math.min((conceded - 1) * 0.35, 2.6);
      if (ps.yellow) r -= 0.4;
      if (ps.red) r -= 1.8;
    } else if (isMid) {
      // Same fix as defenders above: passing and defensive-action credit
      // are combined caps now instead of stacking separately (previously up
      // to +1.2 passing and +1.5 defensive actions before any goal/assist).
      r += assists * 0.95;
      r += goals * 1.15;
      r += Math.min(passes * 0.012 + passesC * 0.016, 0.55);
      r += Math.min(tackles * 0.1 + ints * 0.12, 0.5);
      r += Math.min(shots * 0.1, 0.45);
      r += Math.min(xa * 0.2, 0.4);
      r += Math.min(xg * 0.15, 0.3);
      if (passesC >= 30) r += 0.2;
      if (assists >= 2) r += 0.3;
      if (conceded >= 3) r -= Math.min((conceded - 2) * 0.15, 1.0);
      if (ps.yellow) r -= 0.35;
      if (ps.red) r -= 1.8;
    } else {
      r += goals * 1.25;
      r += assists * 0.85;
      r += Math.min(shots * 0.12, 0.6);
      if (shots > 0 && goals > 0) r += Math.min(goals / shots, 1) * 0.35;
      r += Math.min(xg * 0.25, 0.5);
      r += Math.min(xa * 0.15, 0.35);
      r += Math.min(passes * 0.01, 0.25);
      r += Math.min(passesC * 0.015, 0.2);
      r += Math.min(tackles * 0.1, 0.3);
      if (goals >= 2) r += 0.35;
      if (goals >= 3) r += 0.4;
      if (ps.yellow) r -= 0.35;
      if (ps.red) r -= 1.7;
    }

    // Passing success rate matters, not just volume — reward crisp, reliable passers
    // and dock players who give the ball away a lot, once they've had enough passes
    // for the sample to mean something.
    if (passes >= 8) {
      const acc = passesC / passes;
      const accDelta = (acc - 0.78) * (isGK ? 0.5 : isDef ? 0.9 : isMid ? 1.1 : 0.6);
      r += Math.max(-0.4, Math.min(0.35, accDelta));
    }

    // Shared involvement floor — but a heavy defeat still drags this down;
    // doing nothing notable in a 7-1 loss isn't a neutral 6.0 game.
    const actions = goals + assists + shots + saves + tackles + Math.floor(passes / 5);
    const concededFloorPenalty = (isGK || isDef) ? Math.min(Math.max(conceded - 1, 0) * 0.4, 3.0)
      : isMid ? Math.min(Math.max(conceded - 2, 0) * 0.15, 1.0) : 0;
    if (actions === 0) r = 6.0 - concededFloorPenalty;
    else if (actions === 1 && !isGK) r = Math.max(r, 6.2 - concededFloorPenalty);

    r += Math.max(-0.12, Math.min(0.18, ((ps.ovr || 75) - 75) * 0.008));

    // Small organic variance so two players with an identical stat-line don't
    // always come out with the exact same rating — mirrors the "eye test"
    // component of a real match rating without swinging results wildly.
    r += (seededRandom() - 0.5) * 0.22;

    // Keep ratings realistic: a good, solid game should land in the high 7s/8s.
    // Only a genuine breakout performance — a hat-trick, a brace-plus-assist, a big
    // multi-goal contribution, or a standout shutout for a GK/defender — should be
    // able to push into the 9.9-10.0 territory. Non-breakout games get a *soft*,
    // slightly randomized ceiling each time (not a fixed 9.2 wall every match) so
    // ratings feel more dynamic while still rarely maxing out without a big game.
    const isBreakout = isGK
      ? (saves >= 7 && (ps.cleanSheet || goals === 0) && !ps.red)
      : isDef
        ? ((goals >= 1 && ps.cleanSheet) || (goals + assists >= 3) || (goals >= 2 && assists >= 1)) && !ps.red
        : (goals >= 3 || (goals >= 2 && assists >= 1) || assists >= 3 || goals + assists >= 4) && !ps.red;
    const cap = isBreakout ? 10.0 : 8.7 + seededRandom() * 0.9; // ~8.7-9.6, varies match to match
    return Math.max(2.5, Math.min(cap, Math.round(r * 10) / 10));
  }


  function quickSimMatch() { startMatch(); if (currentMatch) simToEnd(); }

  function toggleSim() {
    if (!currentMatch || currentMatch.finished) return;
    isPlaying = !isPlaying;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = isPlaying ? '⏸ Pause' : '▶ Play';
    if (isPlaying) {
      simInterval = setInterval(() => {
        if (!currentMatch || currentMatch.finished) {
          clearInterval(simInterval); isPlaying = false;
          if (btn) btn.textContent = '▶ Play';
          return;
        }
        tick();
      }, simSpeed);
    } else {
      clearInterval(simInterval);
    }
  }

  function setSpeed(val) {
    simSpeed = parseInt(val) || 400;
    const labels = { 800: 'Slow', 400: 'Normal', 150: 'Fast', 40: 'Turbo' };
    const lbl = document.getElementById('sim-speed-label');
    if (lbl) lbl.textContent = 'Speed: ' + (labels[val] || 'Custom');
    if (isPlaying) {
      clearInterval(simInterval);
      simInterval = setInterval(() => {
        if (!currentMatch || currentMatch.finished) { clearInterval(simInterval); isPlaying = false; return; }
        tick();
      }, simSpeed);
    }
  }

  function simToEnd() {
    if (!currentMatch || currentMatch.finished) return;
    clearInterval(simInterval); isPlaying = false;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = '▶ Play';
    // Instant Result has no one to click the ET/pens prompt, so resolve draws
    // straight through instead of stalling at m._awaitingET — that stall was
    // what let the minute counter run past 90 and climb well past 200 while
    // safety just kept ticking without ever finishing. quietSim additionally
    // suppresses all live-view rendering, which is correct here since this is
    // used for the "Instant Result" button, not a fast-forward of a match the
    // user is actively watching (see finishMatch() for that).
    currentMatch.silentDeep = true;
    currentMatch.quietSim = true;
    let safety = 0;
    while (currentMatch && !currentMatch.finished && safety < 200) {
      tick(true);
      safety++;
    }
  }

  // "Finish Match" — unlike Instant Result, this is used mid-live-match, so it
  // should visibly race through the remaining minutes (scoreboard/events feed
  // still updating) rather than silently jumping straight to a final result.
  // It reuses silentDeep so any ET/pens decision auto-resolves instead of
  // stalling on a prompt (same reasoning as Instant Result), but leaves
  // quietSim off so every tick still renders — it's a fast Play, not a
  // silent one.
  function finishMatch() {
    if (!currentMatch || currentMatch.finished) return;
    clearInterval(simInterval);
    isPlaying = true;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = '⏩ Fast-forwarding…';
    currentMatch.silentDeep = true;
    currentMatch.quietSim = false;
    const FF_MS = 18; // fast enough to feel like a fast-forward, not a jump-cut
    simInterval = setInterval(() => {
      if (!currentMatch) { clearInterval(simInterval); isPlaying = false; return; }
      if (currentMatch.finished) {
        clearInterval(simInterval); isPlaying = false;
        if (btn) btn.textContent = '▶ Play';
        return;
      }
      // silent=true on the tick call so it doesn't stop for the normal
      // half-time pause (which is separate from the silentDeep/ET handling
      // above) — Finish Match should never stall waiting for another click.
      tick(true);
      updateStatsPanel();
    }, FF_MS);
  }

  function resetMatch() {
    clearInterval(simInterval); isPlaying = false; currentMatch = null;
    const setup = document.getElementById('match-setup');
    const live = document.getElementById('match-live');
    if (setup) setup.style.display = 'block';
    if (live) live.style.display = 'none';
  }


  // ========== CONTEXTUAL ADDED TIME ==========
  // Real stoppage time isn't a flat random number — the fourth official
  // builds it up from what actually happened in the half: ball retrieved
  // from the net and the restart after every goal, the walk to the technical
  // area for every substitution, treatment/stretcher time for injuries, the
  // referee jogging to the pitchside monitor (or waiting on a check) for
  // every VAR review, cards taking a moment to brandish and log, and a
  // time-wasting allowance when fouls pile up late in the half (a leading
  // side "managing the clock"). This scans the half's own event log so two
  // otherwise-identical matches with different incident counts get
  // different, explainable stoppage totals instead of the same dice roll.
  function computeAddedTime(m, fromMin, toMin, capMinutes) {
    const evs = (m.events || []).filter(e => e.minute >= fromMin && e.minute <= toMin);
    const count = (type) => evs.filter(e => e.type === type).length;
    const goals = count('goal');
    const subs = count('sub');
    const injuries = count('injury');
    const varChecks = count('var');
    const cards = count('yellow') + count('red');
    // Late fouls/handballs (closing quarter of the half) read as a proxy for
    // a team managing — or wasting — the clock rather than genuine 50-50s.
    const lateWindow = Math.max(fromMin, toMin - 15);
    const lateFouls = evs.filter(e => (e.type === 'foul' || e.type === 'handball') && e.minute >= lateWindow).length;
    const lateCards = evs.filter(e => (e.type === 'yellow' || e.type === 'red') && e.minute >= lateWindow).length;

    const goalTime = goals * 0.5;                       // ball back to center circle + restart
    const celebrationTime = goals * 0.45 + evs.filter(e => e.type === 'goal' && e.minute >= lateWindow).length * 0.25; // mobbed-by-teammates time, longer for late/dramatic goals
    const subTime = subs * 0.4;                         // walk-off/walk-on + board held up
    const injuryTime = injuries * 1.6;                   // treatment or stretcher
    const varTime = varChecks * 1.1;                     // review + pitchside monitor
    const cardTime = cards * 0.15;                       // brandishing + logging the name
    const timeWastingTime = lateFouls * 0.25 + lateCards * 0.2; // clock management called out by the ref

    const raw = goalTime + celebrationTime + subTime + injuryTime + varTime + cardTime + timeWastingTime;
    // Every period gets its own realistic ceiling so added time — however
    // eventful the period was — can never run away toward infinity: a
    // 45-minute half can eat into a longer stoppage than a 15-minute
    // period of extra time reasonably would.
    const cap = capMinutes || 11;
    const minutes = Math.max(1, Math.min(cap, Math.round(raw)));
    return {
      minutes,
      breakdown: { goals, subs, injuries, var: varChecks, cards, timeWasting: lateFouls + lateCards }
    };
  }

  // Human-readable rundown of what built up a stoppage-time total, used in
  // the announcement event so the extra minutes feel earned rather than
  // arbitrary.
  function describeAddedTime(added) {
    const b = added.breakdown;
    const parts = [];
    if (b.goals) parts.push(b.goals + ' goal celebration' + (b.goals > 1 ? 's' : ''));
    if (b.subs) parts.push(b.subs + ' substitution' + (b.subs > 1 ? 's' : ''));
    if (b.injuries) parts.push(b.injuries + ' injury stoppage' + (b.injuries > 1 ? 's' : ''));
    if (b.var) parts.push(b.var + ' VAR check' + (b.var > 1 ? 's' : ''));
    if (b.cards) parts.push(b.cards + ' card' + (b.cards > 1 ? 's' : ''));
    if (b.timeWasting) parts.push('time-wasting');
    return parts.length ? parts.join(', ') : 'general stoppages';
  }

  // ========== MATCH-CLOCK DISPLAY ==========
  // m.minute is only the raw simulation tick — it never resets and just
  // keeps climbing straight through stoppage time, extra time and
  // penalties. Nothing shown to the person should read straight off it.
  // Instead every period (1st half, 2nd half, each period of extra time)
  // tracks its own start (periodStartRaw), its own regulation length
  // (periodDuration) and, once that length is reached, its own added/
  // stoppage time (periodStoppage) — computed once from the events that
  // actually happened in that period, then capped so it can never run
  // away. This turns the raw tick into a real match-clock label: the
  // second half resumes counting from 45', extra time resets to 90'
  // instead of continuing to climb past 100', and the second period of
  // extra time resets to 105'. Any added time within a period is always
  // shown as "<periodEnd>+<n>'", exactly like a real match clock.
  function updateMatchClock(m) {
    const elapsed = Math.max(0, m.minute - (m.periodStartRaw || 0));
    const dur = m.periodDuration || 45;
    const base = m.periodBaseDisplay || 0;
    if (elapsed <= dur) {
      m.dispMin = base + elapsed;
      m.dispLabel = m.dispMin + "'";
    } else {
      m.dispMin = base + dur;
      m.dispLabel = m.dispMin + '+' + (elapsed - dur) + "'";
    }
  }
  function tick(silent) {
    if (!currentMatch || currentMatch.finished) return;
    const m = currentMatch;
    m.minute++;

    // A period transition (half time -> 2nd half, full time -> extra time,
    // end of the first period of extra time -> second period) is queued by
    // the code below rather than applied immediately, so it activates right
    // here, on the first tick of the new period. That's what makes the
    // match-clock genuinely restart — 45' for the second half, 90' for
    // extra time, 105' for its second period — instead of continuing to
    // climb from wherever the previous period's stoppage time left off.
    if (m.pendingPeriod) {
      const p = m.pendingPeriod;
      m.pendingPeriod = null;
      m.period = p.period;
      m.periodStartRaw = m.minute;
      m.periodBaseDisplay = p.base;
      m.periodDuration = p.duration;
      m.periodStoppage = null;
      m.status = p.status;
      if (p.announce) addEvent(m.minute, p.announceType || 'whistle', p.announce, null);
    }
    updateMatchClock(m);

    // ===== First half =====
    if (m.period === 'H1') {
      const elapsed = m.minute - m.periodStartRaw;
      if (elapsed >= m.periodDuration) {
        if (m.periodStoppage == null) {
          const added = computeAddedTime(m, m.periodStartRaw + 1, m.periodStartRaw + m.periodDuration, 6);
          m.periodStoppage = added.minutes;
          addEvent(m.minute, 'whistle', `📋 ${added.minutes} minute${added.minutes === 1 ? '' : 's'} of first-half stoppage time signalled: ${describeAddedTime(added)}`, null);
          updateMatchClock(m);
        }
        m.status = 'Stoppage Time';
        if (elapsed >= m.periodDuration + m.periodStoppage) {
          m.status = 'Half Time';
          addEvent(m.minute, 'whistle', '—— HALF TIME ——', null);
          addEvent(m.minute, 'whistle', 'Tap Play to start 2nd half', null);
          m.pendingPeriod = { period: 'H2', base: 45, duration: 45, status: '2nd Half', announce: 'Second half begins' };
          updateScoreboard();
          // Pause at half time (unless turbo finish) — either way the next
          // tick() call is what actually kicks off the second half.
          if (!silent) {
            clearInterval(simInterval);
            isPlaying = false;
            const btn = document.getElementById('btn-play');
            if (btn) btn.textContent = '▶ 2nd Half';
          }
          return;
        }
      }
    }

    // ===== Second half =====
    if (m.period === 'H2' && !m.inET && !m.inPens && !m._awaitingET) {
      const elapsed = m.minute - m.periodStartRaw;
      if (elapsed >= m.periodDuration) {
        if (m.periodStoppage == null) {
          const added = computeAddedTime(m, m.periodStartRaw + 1, m.periodStartRaw + m.periodDuration, 11);
          m.periodStoppage = added.minutes;
          addEvent(m.minute, 'whistle', `📋 ${added.minutes} minute${added.minutes === 1 ? '' : 's'} of stoppage time signalled: ${describeAddedTime(added)}`, null);
          updateMatchClock(m);
        }
        m.status = 'Stoppage Time';
        if (elapsed >= m.periodDuration + m.periodStoppage) {
          const drawn = m.home.score === m.away.score;
          if (drawn && (m.allowET || m.allowPens)) {
            // Instant/bulk sims have no one to click the prompt, so resolve
            // immediately instead of stalling on a prompt nobody can answer.
            if (m.silentDeep) {
              addEvent(m.minute, 'whistle', `Full time ${m.home.team.short} ${m.home.score}-${m.away.score} ${m.away.team.short} — scores level`, null);
              if (m.allowET) {
                m.inET = true;
                m.status = 'Extra Time (1st Half)';
                addEvent(m.minute, 'et', 'Extra time begins — two periods of 15 minutes', null);
                m.pendingPeriod = { period: 'ET1', base: 90, duration: 15, status: 'Extra Time (1st Half)' };
              } else {
                runPenaltyShootout();
              }
              return;
            }
            // Pause — user chooses to continue to ET / pens
            m._awaitingET = true;
            m.status = 'Full Time';
            addEvent(m.minute, 'whistle', `Full time ${m.home.team.short} ${m.home.score}-${m.away.score} ${m.away.team.short} — scores level`, null);
            clearInterval(simInterval); isPlaying = false;
            const btn = document.getElementById('btn-play');
            if (btn) btn.textContent = '▶ Play';
            updateScoreboard();
            showETPrompt(drawn);
            return;
          }
          endMatch();
          return;
        }
      }
    }

    // ===== Extra time, first period (restarts the clock at 90') =====
    if (m.period === 'ET1' && !m.inPens) {
      const elapsed = m.minute - m.periodStartRaw;
      if (elapsed >= m.periodDuration) {
        if (m.periodStoppage == null) {
          const added = computeAddedTime(m, m.periodStartRaw + 1, m.periodStartRaw + m.periodDuration, 3);
          m.periodStoppage = added.minutes;
          addEvent(m.minute, 'et', `📋 ${added.minutes} minute${added.minutes === 1 ? '' : 's'} added at the end of the first half of extra time`, null);
          updateMatchClock(m);
        }
        m.status = 'Stoppage Time (ET)';
        if (elapsed >= m.periodDuration + m.periodStoppage) {
          // Half time of extra time, at 105' — mirrors the normal half-time
          // break (paused for a live match, seamless for a fast/silent sim).
          m.status = 'Half Time (ET)';
          addEvent(m.minute, 'et', '—— END OF THE FIRST HALF OF EXTRA TIME ——', null);
          addEvent(m.minute, 'et', 'Tap Play to start the second half of extra time', null);
          m.pendingPeriod = { period: 'ET2', base: 105, duration: 15, status: 'Extra Time (2nd Half)', announce: 'Second half of extra time begins', announceType: 'et' };
          updateScoreboard();
          if (!silent) {
            clearInterval(simInterval);
            isPlaying = false;
            const btn = document.getElementById('btn-play');
            if (btn) btn.textContent = '▶ 2nd Half (ET)';
          }
          return;
        }
      }
      if (seededRandom() < 0.0025) tryInjury(seededRandom() < 0.5 ? 'home' : 'away');
    }

    // ===== Extra time, second period (restarts the clock at 105', usually
    // ends at 120' — but, like every other period here, can run a little
    // long on added time, never indefinitely) =====
    if (m.period === 'ET2' && !m.inPens) {
      const elapsed = m.minute - m.periodStartRaw;
      if (elapsed >= m.periodDuration) {
        if (m.periodStoppage == null) {
          const added = computeAddedTime(m, m.periodStartRaw + 1, m.periodStartRaw + m.periodDuration, 3);
          m.periodStoppage = added.minutes;
          addEvent(m.minute, 'et', `📋 ${added.minutes} minute${added.minutes === 1 ? '' : 's'} added at the end of extra time`, null);
          updateMatchClock(m);
        }
        m.status = 'Stoppage Time (ET)';
        if (elapsed >= m.periodDuration + m.periodStoppage) {
          if (m.home.score === m.away.score && m.allowPens) {
            if (m.silentDeep) {
              addEvent(m.minute, 'et', 'Extra time finished — still level. Straight to penalties.', null);
              runPenaltyShootout();
              return;
            }
            m._awaitingPens = true;
            m.status = 'ET Full Time';
            addEvent(m.minute, 'et', 'Extra time finished — still level. Penalty shootout?', null);
            clearInterval(simInterval); isPlaying = false;
            const btn = document.getElementById('btn-play');
            if (btn) btn.textContent = '▶ Play';
            updateScoreboard();
            showETPrompt(true, true);
            return;
          }
          endMatch();
          return;
        }
      }
      if (seededRandom() < 0.0025) tryInjury(seededRandom() < 0.5 ? 'home' : 'away');
    }

    generateEvents();
    updateFatigue();
    runTacticalAI();
    // Substitutions: aim for at least 3 per team (max 5). Uses the display
    // minute (m.dispMin), not the raw tick, so a first-half that ran long
    // on stoppage time can't nudge this window earlier or later than it
    // should be.
    if (m.dispMin >= 55 && m.dispMin <= 88 && !m.inET) {
      const homeDiff = (m.home.score || 0) - (m.away.score || 0);
      const awayDiff = -homeDiff;
      const needHome = (m.homeSubsUsed || 0) < 3;
      const needAway = (m.awaySubsUsed || 0) < 3;
      const windowLeft = Math.max(1, 88 - m.dispMin);
      // Higher urgency if still below 3
      let pHome = needHome ? Math.min(0.55, 0.12 + (3 - m.homeSubsUsed) * 0.12 / windowLeft * 8) : 0.06;
      let pAway = needAway ? Math.min(0.55, 0.12 + (3 - m.awaySubsUsed) * 0.12 / windowLeft * 8) : 0.06;
      if (m.dispMin >= 70) { pHome *= 1.3; pAway *= 1.3; }
      // A team chasing the game brings changes on earlier and more urgently;
      // one comfortably ahead can afford to take its time — so subs stop
      // landing on a flat, identical clock every match.
      if (homeDiff <= -1) pHome *= (homeDiff <= -2 ? 1.6 : 1.3);
      else if (homeDiff >= 2) pHome *= 0.75;
      if (awayDiff <= -1) pAway *= (awayDiff <= -2 ? 1.6 : 1.3);
      else if (awayDiff >= 2) pAway *= 0.75;
      // Fatigue nudges timing too — a visibly gassed side brings changes
      // earlier than the scoreline-only read above would suggest.
      if (teamAvgStamina('home') < 55) pHome *= 1.25;
      if (teamAvgStamina('away') < 55) pAway *= 1.25;
      if (seededRandom() < pHome) trySubstitution('home');
      if (seededRandom() < pAway) trySubstitution('away');
    }
    // Late forced catch-up so each side reaches 3 if possible
    if (m.dispMin === 80 || m.dispMin === 84 || m.dispMin === 87) {
      if ((m.homeSubsUsed || 0) < 3) trySubstitution('home');
      if ((m.awaySubsUsed || 0) < 3) trySubstitution('away');
    }
    if (seededRandom() < 0.0015) tryInjury(seededRandom() < 0.5 ? 'home' : 'away');
    updateScoreboard();
    if (!silent) updateStatsPanel();
    // Keep the live pitch view's dynamic player markers moving in step with
    // the simulation — same quietSim guard every other per-tick render uses
    // (bulk/instant sims skip this entirely, see simToEnd()).
    if (!m.quietSim) renderPitch();
  }

  // Position-based share of a team's passing volume. Higher = touches the ball more often.
  const PASS_POS_WEIGHT = {
    GK: 0.55, CB: 1.75, RB: 1.3, LB: 1.3, RWB: 1.3, LWB: 1.3,
    CDM: 1.95, CM: 1.85, CAM: 1.45, RM: 1.2, LM: 1.2, RW: 1.0, LW: 1.0, ST: 0.7
  };

  // Per-minute base chance of a defensive action (tackle/interception/block) for
  // each position, independent of the main event roll above — this is what makes
  // defenders (and holding mids) consistently active across 90 minutes rather than
  // only picking up stats on the rare minutes the main event chain lands on them.
  // Retuned down from an earlier, much busier version so a typical starting CB's
  // full-match tackles/interceptions land close to real-world per-game averages
  // (~3.6 tackles, ~1.5 interceptions) instead of nearly double that.
  const DEF_ACTION_BASE = {
    CB: 0.0207, RB: 0.0219, LB: 0.0219, RWB: 0.0232, LWB: 0.0232, CDM: 0.0246,
    CM: 0.0138, RM: 0.0067, LM: 0.0067, RW: 0.0049, LW: 0.0049, CAM: 0.0058, ST: 0.0031, GK: 0
  };

  // Per-minute base chance of a *clearance* — a separate off-the-ball action
  // from the tackle/interception/block roll above: heading or hacking a
  // dangerous ball out of the danger area rather than winning it off an
  // opponent's feet. Weighted toward centre-backs, tuned so a starting CB
  // averages close to the real-world per-game figure (~7.3 clearances).
  const CLEARANCE_BASE = {
    CB: 0.085, RB: 0.037, LB: 0.037, RWB: 0.037, LWB: 0.037, CDM: 0.0226,
    CM: 0.009, RM: 0.0045, LM: 0.0045, RW: 0.0034, LW: 0.0034, CAM: 0.0045, ST: 0.0023, GK: 0
  };

  // Flavor text for the off-the-ball defensive actions below — these are
  // genuinely silent, minute-by-minute stat contributions most of the
  // time (so the feed isn't swamped with routine tackles), but a fraction
  // of them now surface as an actual event line so live/off-the-ball
  // defending is visible in the commentary, not just the stat sheet.
  const OFFBALL_TACKLE_DESC = [
    (n, t) => `<span class="player">${n}</span> times the challenge perfectly and wins it back (${t})`,
    (n, t) => `Strong tackle from <span class="player">${n}</span> breaks up the attack`,
    (n, t) => `<span class="player">${n}</span> (${t}) slides in and comes away with the ball`,
    (n, t) => `<span class="player">${n}</span> muscles the ball off his man`
  ];
  const OFFBALL_INTERCEPT_DESC = [
    (n, t) => `<span class="player">${n}</span> reads the pass and cuts it out`,
    (n, t) => `Intercepted! <span class="player">${n}</span> (${t}) steps in front of the ball`,
    (n, t) => `<span class="player">${n}</span> anticipates the ball into space and snuffs it out`,
    (n, t) => `Sharp interception from <span class="player">${n}</span> ends the move`
  ];
  const OFFBALL_BLOCK_DESC = [
    (n, t) => `<span class="player">${n}</span> gets a body in the way to block the pass`,
    (n, t) => `<span class="player">${n}</span> (${t}) throws himself in front of it to cut the ball out`,
    (n, t) => `Blocked by <span class="player">${n}</span> — the pass never gets through`
  ];
  const OFFBALL_CLEARANCE_DESC = [
    (n, t) => `<span class="player">${n}</span> gets across to clear the danger`,
    (n, t) => `Last-ditch clearance from <span class="player">${n}</span> (${t})`,
    (n, t) => `<span class="player">${n}</span> heads it clear from the edge of the box`,
    (n, t) => `<span class="player">${n}</span> hacks it clear under pressure`,
    (n, t) => `Composed clearance by <span class="player">${n}</span> (${t})`
  ];
  function pickOffBallDesc(bank, p, team) {
    const f = bank[Math.floor(seededRandom() * bank.length)];
    return f(p.name, (team && team.team && team.team.short) || '');
  }

  // Gives every defender (and holding mid) on the pitch an independent per-minute
  // roll for a tackle/interception/block, weighted by their defensive ability and
  // the pressure they're under from the opposing attack. Runs every minute
  // (including "quiet" minutes) so defensive stats build up naturally over 90
  // minutes instead of relying on the endMatch floor to backfill them.
  function simulateDefensiveActions() {
    const m = currentMatch;
    if (!m) return;
    if (!m.playerMatchStats) m.playerMatchStats = {};
    ['home', 'away'].forEach(side => {
      const team = m[side];
      const oppSide = side === 'home' ? 'away' : 'home';
      const ids = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
      const onPitch = (team.squad.all || []).filter(p => ids.includes(p.id));
      if (!onPitch.length) return;
      const oppTeamData = m[oppSide];
      const oppStr = calcTeamStrength(oppTeamData);
      const pressureMult = 0.85 + Math.max(0, (oppStr.att || 70) - 68) / 90;
      onPitch.forEach(p => {
        const slot = p.slot || (p.pos || [])[0] || 'CM';
        const base = DEF_ACTION_BASE[slot];
        if (!base) return;
        // Defensive Engagement and the (Awareness + Tackling) execution
        // blend now drive two genuinely different things: def_eng decides
        // how often this player is even involved in a defensive passage at
        // all (his work-rate/willingness to close it down), while
        // def_awr/tack decide how well he does once he is. A high-work-rate
        // but technically limited destroyer and a positionally brilliant
        // but low-energy sweeper now read very differently over 90 minutes,
        // instead of both being flattened into one generic `def` number.
        const defAwr = xattr(p, 'def_awr', p.def != null ? p.def : 70);
        const tack = xattr(p, 'tack', p.def != null ? p.def : 70);
        const defEng = xattr(p, 'def_eng', p.def != null ? p.def : 70);
        const engagementMult = (0.75 + (defEng / 100) * 0.5) * staminaMultiplier(p);
        // Curved rather than a flat blend: a genuinely elite tackler/reader
        // of the game (90+) closes the gap on a merely-good one (75-80) by
        // more than a straight line would ever let him.
        const execSkill = curvedAttr(defAwr, 70) * 0.4 + curvedAttr(tack, 70) * 0.6;
        const skillMult = 0.72 + (execSkill / 100) * 0.6;
        // Specific tackling/interception traits (Sliding Tackle, Interception,
        // Man Marking, Blocker) add on top of the generic def-based chance,
        // and interceptBias skews *which* kind of action a specialist gets.
        const actionEdge = defActionEdge(p);
        const chance = Math.min(0.24, base * skillMult * engagementMult * pressureMult + actionEdge.chance);
        if (seededRandom() >= chance) return;
        // Aggression carries a real cost: the more aggressively a player
        // throws himself into challenges, the more of those attempts turn
        // into a mistimed foul instead of a clean action — this is the
        // continuous per-minute defensive loop's own disciplinary risk,
        // separate from (and in addition to) the duel-losing foul chance
        // already modeled in resolveTurnover/resolveFoul.
        // Eased alongside foulProneness above: this fires on every one of a
        // high-engagement position's (CDM in particular has the highest
        // DEF_ACTION_BASE) many defensive-action attempts per match, so its
        // aggression slope was compounding with sheer attempt volume to
        // over-card those positions specifically. Lower base + gentler
        // slope keeps a reckless player's extra risk real without letting
        // it multiply out of proportion over 90 minutes of attempts.
        const foulRisk = Math.min(0.15, 0.035 + Math.max(0, xattr(p, 'aggr', 70) - 65) / 260);
        if (seededRandom() < foulRisk) {
          const victim = pickPlayer(oppTeamData, ['ST', 'CAM', 'RW', 'LW', 'CM'], null);
          resolveFoul(side, oppSide, p, victim, false);
          return;
        }
        if (!m.playerMatchStats[p.id]) m.playerMatchStats[p.id] = blankPlayerMatchStats(p);
        const ps = m.playerMatchStats[p.id];
        const roll = seededRandom();
        // Baseline dropped from 0.5 to 0.35 — interceptions/tackles used to
        // split roughly 50/50, which pushed a busy CB's interception count
        // well above real-game averages. Pure interception reading
        // (def_awr) and specific interception traits still bias this up
        // per-player, same as before.
        const interceptCut = Math.min(0.75, 0.235 + actionEdge.interceptBias);
        if (roll < interceptCut) {
          ps.interceptions = (ps.interceptions || 0) + 1;
          ps.tackles = (ps.tackles || 0) + 1;
          team.stats.interceptions = (team.stats.interceptions || 0) + 1;
          if (seededRandom() < 0.14) addEvent(m.minute, 'whistle', pickOffBallDesc(OFFBALL_INTERCEPT_DESC, p, team), side);
        } else if (roll < 0.85) {
          ps.tackles = (ps.tackles || 0) + 1;
          if (seededRandom() < 0.14) addEvent(m.minute, 'whistle', pickOffBallDesc(OFFBALL_TACKLE_DESC, p, team), side);
        } else {
          ps.blocks = (ps.blocks || 0) + 1;
          team.stats.blocks = (team.stats.blocks || 0) + 1;
          if (seededRandom() < 0.14) addEvent(m.minute, 'whistle', pickOffBallDesc(OFFBALL_BLOCK_DESC, p, team), side);
        }
      });

      // ---- Clearances — a genuinely separate off-the-ball action from the
      // tackle/interception/block roll above: heading or hacking a
      // dangerous ball out of the area rather than winning it off a man.
      // Independent per-minute roll so it doesn't crowd out (or get
      // crowded out by) the tackle/interception roll on the same player
      // in the same minute — in real matches a defender can easily both
      // tackle and clear the danger in the same passage of play.
      onPitch.forEach(p => {
        const slot = p.slot || (p.pos || [])[0] || 'CM';
        const clrBase = CLEARANCE_BASE[slot];
        if (!clrBase) return;
        if (!m.playerMatchStats[p.id]) m.playerMatchStats[p.id] = blankPlayerMatchStats(p);
        const ps = m.playerMatchStats[p.id];
        ps._liveClr = true; // tells deriveExtendedMatchStats not to overwrite this with a random backfill figure
        const defAwr = xattr(p, 'def_awr', p.def != null ? p.def : 70);
        const jmp = xattr(p, 'jmp', p.phy != null ? p.phy : 70);
        const phyCon = xattr(p, 'phy_con', p.phy != null ? p.phy : 70);
        const clrSkillMult = 0.82 + (curvedAttr(defAwr, 70) * 0.4 + curvedAttr(jmp, 70) * 0.35 + curvedAttr(phyCon, 70) * 0.25) / 100 * 0.4;
        const clrChance = Math.min(0.22, clrBase * clrSkillMult * pressureMult * staminaMultiplier(p));
        if (seededRandom() >= clrChance) return;
        ps.clearances = (ps.clearances || 0) + 1;
        if (seededRandom() < 0.35) ps.headedClearances = (ps.headedClearances || 0) + 1;
        team.stats.clearances = (team.stats.clearances || 0) + 1;
        if (seededRandom() < 0.12) addEvent(m.minute, 'whistle', pickOffBallDesc(OFFBALL_CLEARANCE_DESC, p, team), side);
      });
    });
  }
  // Per-position share of a player's passing volume that's realistically a
  // lofted ball (cross/switch/long diagonal) rather than a ground pass —
  // wide defenders and out-and-out crossers live here far more than a
  // holding mid or a striker does. Feeds simulateMinutePassing() below so
  // low_pass and lofted_pass finally drive *different* shares of a
  // player's actual pass volume instead of being blended into one number
  // regardless of what kind of passer he really is.
  const LOFTED_PASS_SHARE = {
    GK: 0.42, CB: 0.14, RB: 0.34, LB: 0.34, RWB: 0.4, LWB: 0.4,
    CDM: 0.14, CM: 0.18, CAM: 0.16, RM: 0.38, LM: 0.38, RW: 0.4, LW: 0.4, ST: 0.12
  };
  function simulateMinutePassing() {
    const m = currentMatch;
    if (!m) return;
    if (!m.playerMatchStats) m.playerMatchStats = {};
    let homeCompletedMin = 0, awayCompletedMin = 0;
    // Ball-control quality — technical ability, overall, and manager combine into
    // how much a team naturally dictates tempo. This (not just pass accuracy) now
    // drives raw pass *volume*, so a clearly superior side genuinely racks up more
    // attempted passes from minute one instead of the two sides staying
    // symmetric-random and drifting back to an even split by full time.
    const homeStr = calcTeamStrength(m.home);
    const awayStr = calcTeamStrength(m.away);
    const ctrl = (s) => s.tec * 0.55 + s.ovr * 0.25 + (s.mgr != null ? s.mgr : 75) * 0.20;
    const ctrlDiff = Math.max(-24, Math.min(24, ctrl(homeStr) - ctrl(awayStr)));
    const ctrlShift = ctrlDiff / 24 * 0.4; // up to +/-40% volume swing from raw quality gap
    ['home', 'away'].forEach(side => {
      const team = m[side];
      const oppTeam = side === 'home' ? m.away : m.home;
      const ids = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
      const onPitch = (team.squad.all || []).filter(p => ids.includes(p.id));
      if (!onPitch.length) return;
      const tac = (m.tactics && m.tactics[side]) || 'balanced';
      const pmods = getPlaystyleMods(team.team);
      // Recent possession share still feeds back a little into how much of the ball
      // this team gets — clamped so it can't spiral away from realistic bounds.
      const possShare = Math.max(0.8, Math.min(1.25, ((team.stats.possession || 50)) / 50));
      let baseVol = 5.2 + seededRandom() * 2.6; // ~5.2-7.8 team passes per minute baseline
      if (tac === 'attack') baseVol *= 1.08;
      if (tac === 'defend') baseVol *= 0.86;
      if (tac === 'press') baseVol *= 0.78;
      baseVol *= pmods.passVolMult; // manager playstyle: direct (Long Ball) vs patient (Possession)
      baseVol *= (side === 'home' ? (1 + ctrlShift) : (1 - ctrlShift)); // raw quality gap
      // Game state: a team chasing the game commits more men forward and sees more
      // of the ball late on; one nursing a lead can afford to sit off it.
      if ((m.dispMin != null ? m.dispMin : m.minute) > 60) {
        const diff = (team.score || 0) - (oppTeam.score || 0);
        if (diff <= -1) baseVol *= 1 + Math.min(0.18, Math.abs(diff) * 0.08);
        else if (diff >= 1) baseVol *= 1 - Math.min(0.1, diff * 0.04);
      }
      const vol = Math.max(1, baseVol * possShare);
      const weighted = onPitch.map(p => {
        const slot = p.slot || (p.pos || [])[0] || 'CM';
        let w = PASS_POS_WEIGHT[slot] != null ? PASS_POS_WEIGHT[slot] : 1.2;
        if (WIDE_SLOTS.has(slot)) w *= pmods.wingBiasMult; // Out Wide / Overload lean on wide play
        return { p, w };
      });
      const totalW = weighted.reduce((s, x) => s + x.w, 0) || 1;
      weighted.forEach(({ p, w }) => {
        const raw = vol * (w / totalW);
        const count = Math.floor(raw) + (seededRandom() < (raw - Math.floor(raw)) ? 1 : 0);
        if (count <= 0) return;
        if (!m.playerMatchStats[p.id]) m.playerMatchStats[p.id] = blankPlayerMatchStats(p);
        const ps = m.playerMatchStats[p.id];
        const slot = p.slot || (p.pos || [])[0] || 'CM';
        // Split this player's volume into ground vs. lofted passes and give
        // each its own success rate — low_pass and lofted_pass now
        // genuinely measure different things instead of being averaged
        // away into one blended "passing" number. A wide/crossing-heavy
        // role attempts far more lofted balls than a deep-lying mid does,
        // so the *same* lofted_pass rating pays off far more for a winger
        // than for a CDM who barely ever needs it.
        const loftedShare = LOFTED_PASS_SHARE[slot] != null ? LOFTED_PASS_SHARE[slot] : 0.22;
        const loftedCount = Math.round(count * loftedShare);
        const groundCount = count - loftedCount;
        const groundSkill = groundPassingAbility(p) / 100;
        const loftedSkill = aerialPassingAbility(p) / 100;
        let groundRate = Math.min(0.97, Math.max(0.55, 0.68 + groundSkill * 0.30));
        let loftedRate = Math.min(0.94, Math.max(0.42, 0.56 + loftedSkill * 0.34));
        if (tac === 'press') { groundRate -= 0.03; loftedRate -= 0.03; }
        if (tac === 'attack') { groundRate -= 0.012; loftedRate -= 0.018; }
        groundRate = Math.min(0.97, Math.max(0.4, groundRate + pmods.passAccDelta));
        loftedRate = Math.min(0.94, Math.max(0.3, loftedRate + pmods.passAccDelta));
        let completed = 0;
        for (let i = 0; i < groundCount; i++) { if (seededRandom() < groundRate) completed++; }
        for (let i = 0; i < loftedCount; i++) { if (seededRandom() < loftedRate) completed++; }
        ps.passes = (ps.passes || 0) + count;
        ps.passesCompleted = (ps.passesCompleted || 0) + completed;
        team.stats.passes = (team.stats.passes || 0) + count;
        team.stats.passesCompleted = (team.stats.passesCompleted || 0) + completed;
        if (side === 'home') homeCompletedMin += completed; else awayCompletedMin += completed;
      });
    });
    return { homeCompletedMin, awayCompletedMin };
  }

  // ===================================================================
  // ===================== REAL MATCH ENGINE ==========================
  // ===================================================================
  // Replaces the old flat "roll one dice, land on an outcome bucket" event
  // generator with an explicit phase pipeline that mirrors how a real
  // possession actually develops:
  //   Possession -> Zones -> Movement -> Passing -> Duels -> Transitions
  //   -> Chance Creation -> Shots -> GK  (with Tactics/manager playstyle
  //   modifying probabilities at every stage).
  // Every stage reads real player attributes — the expanded per-player
  // sheet when available, otherwise the derived 5-stat blend — so a
  // sequence's outcome is genuinely shaped by who's on the ball and who's
  // defending, not a flat percentage roll.

  // ---- Pitch model: 3 thirds x 3 channels, from the POV of the team in
  // possession (their own defensive third -> midfield -> attacking third).
  const PITCH_THIRDS = ['DEF', 'MID', 'ATT'];
  const PITCH_CHANNELS = ['L', 'C', 'R'];
  // Which positions naturally occupy each zone when their team has the
  // ball — used to pick a realistic ball-carrier/target for each stage of
  // a possession sequence instead of a flat "any outfield player" pool.
  const ZONE_POS_MAP = {
    DEF_L: ['LB', 'LWB', 'CB'],       DEF_C: ['CB', 'GK', 'CDM'],       DEF_R: ['RB', 'RWB', 'CB'],
    MID_L: ['LM', 'LW', 'LWB', 'CM'], MID_C: ['CM', 'CDM', 'CAM'],      MID_R: ['RM', 'RW', 'RWB', 'CM'],
    ATT_L: ['LW', 'LM', 'LWB'],       ATT_C: ['ST', 'CF', 'CAM', 'SS'], ATT_R: ['RW', 'RM', 'RWB']
  };
  // The defending team's own zone (mirrored third, same channel) is who's
  // actually responsible for marking a given attacking zone.
  function mirrorDefenderPos(zoneKey) {
    const [third, ch] = zoneKey.split('_');
    const defThird = third === 'ATT' ? 'DEF' : third === 'DEF' ? 'ATT' : 'MID';
    return ZONE_POS_MAP[defThird + '_' + ch] || ZONE_POS_MAP.MID_C;
  }
  // The mirrored zone key itself (not just the position list) — needed so
  // marker selection can apply the same playstyle-based positioning
  // affinity a carrier gets, e.g. an Anchor Man screening in front of his
  // own back line should actually be the one found there more often than
  // whichever teammate merely has the higher generic rating.
  function mirrorZoneKey(zoneKey) {
    const [third, ch] = zoneKey.split('_');
    const defThird = third === 'ATT' ? 'DEF' : third === 'DEF' ? 'ATT' : 'MID';
    return defThird + '_' + ch;
  }
  // Playstyle-driven pitch-positioning affinity: how much more (or less)
  // likely a player is to actually be the one found in a given zone,
  // beyond what his base position slot already implies. A Goal Poacher/Fox
  // in the Box striker realistically doesn't drop into midfield to help
  // build play, while a Deep-Lying Forward does; a Cross Specialist hugs
  // the touchline instead of drifting inside; an Anchor Man screens
  // centrally in front of the back line instead of joining the attack.
  // Applied as a weight multiplier on top of the normal ability-based
  // selection in pickPlayer()/pickMarker() wherever a zoneKey is supplied.
  function zoneAffinityMultiplier(player, zoneKey) {
    if (!zoneKey || !player || !player.expandedAttrs) return 1;
    const styles = player.expandedAttrs.playstyle || [];
    if (!styles.length) return 1;
    const parts = zoneKey.split('_');
    const third = parts[0], ch = parts[1];
    const central = ch === 'C';
    let mult = 1;
    styles.forEach((s) => {
      if (s === 'Goal Poacher' || s === 'Fox in the Box') {
        if (third === 'ATT' && central) mult *= 1.5;
        else if (third === 'MID') mult *= 0.55;
        else if (third === 'DEF') mult *= 0.25;
      } else if (s === 'Deep-Lying Forward' || s === 'Hole Player') {
        if (third === 'MID' && central) mult *= 1.4;
        else if (third === 'ATT' && central) mult *= 0.9;
      } else if (s === 'Target Man') {
        if (third === 'ATT' && central) mult *= 1.3;
        if (!central) mult *= 0.75;
      } else if (s === 'Dummy Runner' || s === 'Extra Frontman') {
        if (third === 'ATT') mult *= 1.25;
      } else if (s === 'Creative Playmaker' || s === 'Classic No. 10' || s === 'Orchestrator') {
        if (central && third !== 'DEF') mult *= 1.35;
        else if (!central) mult *= 0.8;
      } else if (s === 'Prolific Winger' || s === 'Cross Specialist' || s === 'Roaming Flank') {
        if (!central) mult *= 1.35;
        else mult *= 0.7;
      } else if (s === 'Inside Forward') {
        if (central && third !== 'DEF') mult *= 1.35;
      } else if (s === 'Box-to-Box') {
        if (third === 'DEF' || third === 'ATT') mult *= 1.2;
      } else if (s === 'Destroyer' || s === 'Anchor Man') {
        if (third === 'ATT') mult *= 0.35;
        else if (third === 'DEF' || (third === 'MID' && central)) mult *= 1.25;
      } else if (s === 'Build Up') {
        if (third === 'DEF') mult *= 1.15;
      } else if (s === 'Offensive Full-back' || s === 'Full-back Finisher') {
        if (!central && third !== 'DEF') mult *= 1.4;
      } else if (s === 'Defensive Full-back') {
        if (third === 'DEF') mult *= 1.25;
        else if (third === 'ATT') mult *= 0.6;
      }
    });
    return Math.max(0.15, Math.min(2.2, mult));
  }

  // ---- Attribute-driven ability reads (expanded sheet first, generic
  // derived stat as fallback) that feed every stage of the pipeline below.
  // Ground-pass-specific ability — short/medium passing along the deck
  // (through balls, build-up, short link-up). Reads low_pass + ball_con
  // (first touch to set the pass up) + tight_pos (composure to play it
  // under close pressure), deliberately excluding lofted_pass/curl so a
  // genuine ground-passing specialist and a genuine crosser read as
  // different players even at the same blended `tec`.
  function groundPassingAbility(p) {
    if (p && p.expandedAttrs) {
      const vals = [xattr(p, 'low_pass', null), xattr(p, 'ball_con', null), xattr(p, 'tight_pos', null)].filter((v) => v != null);
      const base = vals.length
        ? curvedAttr(vals.reduce((a, b) => a + b, 0) / vals.length, 70)
        : (curvedAttr(p.tec || 70, 70) * 0.65 + curvedAttr(p.ovr || 75, 75) * 0.35);
      return base * staminaMultiplier(p) * conditionMultiplier(p);
    }
    return (curvedAttr(p.tec || 70, 70) * 0.65 + curvedAttr(p.ovr || 75, 75) * 0.35) * staminaMultiplier(p) * conditionMultiplier(p);
  }
  // Aerial/lofted-pass-specific ability — crosses, switches of play, long
  // diagonals. Reads lofted_pass + curl (the whip/bend on a delivery),
  // separate from groundPassingAbility above.
  function aerialPassingAbility(p) {
    if (p && p.expandedAttrs) {
      const vals = [xattr(p, 'lofted_pass', null), xattr(p, 'curl', null)].filter((v) => v != null);
      const base = vals.length
        ? curvedAttr(vals.reduce((a, b) => a + b, 0) / vals.length, 70)
        : (curvedAttr(p.tec || 70, 70) * 0.6 + curvedAttr(p.ovr || 75, 75) * 0.4);
      return base * staminaMultiplier(p) * conditionMultiplier(p);
    }
    return (curvedAttr(p.tec || 70, 70) * 0.6 + curvedAttr(p.ovr || 75, 75) * 0.4) * staminaMultiplier(p) * conditionMultiplier(p);
  }
  function passingAbility(p) {
    if (p && p.expandedAttrs) {
      const vals = [p.expandedAttrs.low_pass, p.expandedAttrs.lofted_pass, p.expandedAttrs.ball_con, p.expandedAttrs.tight_pos].filter(v => typeof v === 'number');
      const base = vals.length
        ? curvedAttr(vals.reduce((a, b) => a + b, 0) / vals.length, 70)
        : (curvedAttr(p.tec || 70, 70) * 0.65 + curvedAttr(p.ovr || 75, 75) * 0.35);
      let bonus = 0;
      if (hasSkill(p, 'Through Passing')) bonus += 2.5;
      if (hasSkill(p, 'Weighted Pass')) bonus += 2;
      if (hasSkill(p, 'Outside Curler')) bonus += 1.5;
      if (hasSkill(p, 'Low Lofted Pass')) bonus += 1.5;
      if (hasSkill(p, 'One Touch Pass')) bonus += 2;
      if (hasSkill(p, 'Heel Trick')) bonus += 1;
      if (hasSkill(p, 'No Look Pass')) bonus += 1;
      if (hasSkill(p, 'Rabona')) bonus += 1;
      if (hasSkill(p, 'Phenomenal Pass')) bonus += 2.5;
      if (hasSkill(p, 'Visionary Pass')) bonus += 2;
      if (hasSkill(p, 'Pinpoint Crossing') || hasSkill(p, 'Edged Crossing')) bonus += 1.5;
      // Game-Changing Pass: sharper distribution specifically when this
      // player's team needs to force the issue — drawing or losing in the
      // second half.
      if (hasSkill(p, 'Game-Changing Pass') && playerTeamTrailingOrDrawingSecondHalf(p)) bonus += 3;
      if (isActingSuperSub(p)) bonus += 2;
      return (base + bonus) * staminaMultiplier(p) * conditionMultiplier(p);
    }
    return (curvedAttr(p.tec || 70, 70) * 0.65 + curvedAttr(p.ovr || 75, 75) * 0.35) * conditionMultiplier(p);
  }
  function defensivePressure(p) {
    if (p && p.expandedAttrs) {
      // Distinct weighting instead of a flat average: Defensive Awareness
      // (positioning/anticipation) and Tackling (execution) are what
      // actually close a player down and win the ball, Defensive
      // Engagement (work-rate) is why he's even there to apply it, and
      // Aggression contributes a smaller, more situational push.
      const defAwr = xattr(p, 'def_awr', null);
      const defEng = xattr(p, 'def_eng', null);
      const tack = xattr(p, 'tack', null);
      const aggr = xattr(p, 'aggr', null);
      const base = (defAwr != null && defEng != null && tack != null && aggr != null)
        ? (curvedAttr(defAwr, 70) * 0.35 + curvedAttr(tack, 70) * 0.3 + curvedAttr(defEng, 70) * 0.2 + curvedAttr(aggr, 70) * 0.15)
        : (curvedAttr(p.def || 70, 70) * 0.7 + curvedAttr(p.ovr || 75, 75) * 0.3);
      let bonus = 0;
      if (hasSkill(p, 'Track Back')) bonus += 1.5;
      if (hasSkill(p, 'Long Reach Tackle')) bonus += 1.5;
      // Fortress: this player's whole side defends better once they're
      // ahead in the second half.
      if (hasSkill(p, 'Fortress') && playerTeamLeadingSecondHalf(p)) bonus += 3;
      // GK Directing Defense / GK Spirit Roar: the team's own keeper
      // organizing (or roaring on) the back line lifts every defender in
      // front of him, not just his own shot-stopping.
      if (teamGkHasSkill(p, 'GK Directing Defense')) bonus += 1.5;
      if (teamGkHasSkill(p, 'GK Spirit Roar') && playerTeamLeadingSecondHalf(p)) bonus += 2;
      // A tired defender presses/closes down a yard slower than a fresh one.
      return (base + bonus) * staminaMultiplier(p) * conditionMultiplier(p);
    }
    return (curvedAttr(p.def || 70, 70) * 0.7 + curvedAttr(p.ovr || 75, 75) * 0.3) * conditionMultiplier(p);
  }
  function carryingAbility(p) {
    if (p && p.expandedAttrs) {
      // Physical Contact now feeds this too — shrugging off a challenge
      // while running with the ball is as much about holding your ground
      // physically as it is about balance/close control.
      const vals = [p.expandedAttrs.dribb, p.expandedAttrs.ball_con, p.expandedAttrs.bal, p.expandedAttrs.spd, p.expandedAttrs.phy_con].filter(v => typeof v === 'number');
      const base = vals.length
        ? curvedAttr(vals.reduce((a, b) => a + b, 0) / vals.length, 70)
        : (curvedAttr(p.tec || 70, 70) * 0.5 + curvedAttr(p.pac || 70, 70) * 0.3 + curvedAttr(p.ovr || 75, 75) * 0.2);
      let bonus = 0;
      if (hasSkill(p, 'Momentum Dribbling')) bonus += 2.5;
      if (hasSkill(p, 'Magnetic Feet')) bonus += 2.5;
      if (hasSkill(p, 'Acceleration Burst')) bonus += 2;
      if (hasSkill(p, 'Attacking Surge')) bonus += 1.5;
      if (isActingSuperSub(p)) bonus += 1.5;
      return (base + bonus) * staminaMultiplier(p) * conditionMultiplier(p);
    }
    return (curvedAttr(p.tec || 70, 70) * 0.5 + curvedAttr(p.pac || 70, 70) * 0.3 + curvedAttr(p.ovr || 75, 75) * 0.2) * conditionMultiplier(p);
  }

  // ---- Shot-type profile: how a chance was created shapes its baseline
  // quality (a through-ball 1-on-1 is a better chance than a hopeful
  // long-range effort; a header off a cross has a lower ceiling but a
  // distinct conversion curve of its own).
  const CHANCE_TYPE_PROFILE = {
    // baseOnTarget values scaled down from the original set (roughly ×0.85)
    // as part of the wider conversion-rate retune below — see resolveShot()
    // for the full explanation of why these needed to come down.
    openplay:    { baseOnTarget: 0.34, baseXg: 0.08, headerWeight: 0 },
    throughball: { baseOnTarget: 0.42, baseXg: 0.15, headerWeight: 0 },
    cross:       { baseOnTarget: 0.37, baseXg: 0.11, headerWeight: 0.72 },
    dribble:     { baseOnTarget: 0.40, baseXg: 0.13, headerWeight: 0 },
    longshot:    { baseOnTarget: 0.24, baseXg: 0.045, headerWeight: 0 },
    counter:     { baseOnTarget: 0.42, baseXg: 0.16, headerWeight: 0 }
  };

  // ===== GK phase (called once a shot is confirmed on target) =====
  // then folds straight back to Shots for a rebound, small % of the time.
  function resolveShot(attackingSide, defendingSide, shooter, chanceType, opts) {
    opts = opts || {};
    const m = currentMatch;
    if (!m || !shooter) return;
    const attTeam = m[attackingSide], defTeam = m[defendingSide];
    const profile = CHANCE_TYPE_PROFILE[chanceType] || CHANCE_TYPE_PROFILE.openplay;
    const isHeader = profile.headerWeight > 0 && seededRandom() < profile.headerWeight;

    // ---- Shots phase: shot quality drawn straight from the shooter's own
    // finishing-relevant attributes and playstyle edges.
    let shotQuality = isHeader
      ? Math.max(0.05, Math.min(0.98, aerialSkill(shooter, false) + positioningEdge(shooter)))
      : Math.max(0.05, Math.min(0.98,
          // Every compact stat that feeds a shot runs through the curve
          // before blending — applies to every shooter (expanded sheet or
          // not) since att/tec/ovr/pac are the one thing every player has,
          // so a genuinely elite finisher's rating stops reading as "a
          // decent player plus a flat multiplier" and starts reading as a
          // real tier above a merely-good one.
          // `att` is itself derived from finishing/off-the-ball positioning/
          // heading/placement/kicking-power (see deriveStatsFromAttributes in
          // data/playerDatabase.js) — i.e. it IS the shooting-specific
          // composite — so it now carries most of the weight here. `tec`
          // (ball control/dribbling/passing/curl) is playmaking ability, not
          // shooting ability, so it's down-weighted to a small nudge instead
          // of being able to inflate shotQuality for a technical player who
          // isn't actually a good finisher. The dedicated finishingEdge()/
          // positioningEdge() skill-specific bonuses below are unchanged.
          (curvedAttr(shooter.att || 70, 70) * 0.62 + curvedAttr(shooter.tec || 70, 70) * 0.10
            + curvedAttr(shooter.ovr || 75, 75) * 0.18 + curvedAttr(shooter.pac || 70, 70) * 0.10) / 100 * conditionMultiplier(shooter)
          + finishingEdge(shooter)
          + positioningEdge(shooter)
          + blitzCurlerEdge(shooter)
          + (chanceType === 'dribble' ? dribbleSuccessEdge(shooter) * 0.5 : 0)
          + (chanceType === 'longshot' ? fkTakerEdge(shooter) * 0.6 : 0)));
    shotQuality = Math.max(0.05, Math.min(0.98, shotQuality + (opts.qualityBonus || 0)));
    // Kicking Power feeds the shot's raw power independently of placement —
    // used below in the GK phase so a fiercely struck effort is genuinely
    // harder to keep out/hold onto than a technically similar but softer one.
    const shotPower = shotPowerOf(shooter);
    if (!m.playerMatchStats) m.playerMatchStats = {};
    if (!m.playerMatchStats[shooter.id]) m.playerMatchStats[shooter.id] = blankPlayerMatchStats(shooter);

    // A defender in the shot's path can block it before it's even on target.
    const blocker = pickPlayer(defTeam, ['CB', 'CDM', 'RB', 'LB']);
    const blockSkill = blocker ? defensivePressure(blocker) / 100 : 0.6;
    const blockChance = Math.max(0.04, Math.min(0.28, 0.15 + blockSkill * 0.10 - shotQuality * 0.10));
    if (seededRandom() < blockChance) {
      // Extremely rare: a blocking body gets the deflection badly wrong and
      // loops it past his own keeper. Own goals stay a genuine rarity —
      // this only fires for a sliver of blocked efforts, same real-world
      // order of magnitude as own goals actually turning up in football.
      if (blocker && maybeOwnGoal(attackingSide, defendingSide, blocker, 'deflects the blocked effort into his own net')) {
        return;
      }
      defTeam.stats.blocks = (defTeam.stats.blocks || 0) + 1;
      if (blocker) {
        if (!m.playerMatchStats[blocker.id]) m.playerMatchStats[blocker.id] = blankPlayerMatchStats(blocker);
        m.playerMatchStats[blocker.id].blocks = (m.playerMatchStats[blocker.id].blocks || 0) + 1;
      }
      m.playerMatchStats[shooter.id].xg += profile.baseXg * 0.4;
      if (blocker && seededRandom() < 0.4) {
        addEvent(m.minute, 'shot', `Attempt blocked. Blocked by <span class="player">${blocker.name}</span> (${defTeam.team.short}).`, defendingSide);
      } else {
        addEvent(m.minute, 'miss', sofascoreMiss(shooter, attTeam.team), attackingSide);
      }
      if (seededRandom() < 0.4) resolveCorner(attackingSide);
      return;
    }

    const defAvg = calcTeamStrength(defTeam).def / 100;
    // Retuned so a full shot -> goal pipeline lands close to real-world
    // conversion (~33% of shots on target actually score, ~10% of all
    // shots become goals) instead of the old formula's ~48%/~22%, which
    // was producing far more goals — and far fewer clean sheets — than a
    // real match. Defensive quality now also weighs more heavily against
    // the shot getting on target in the first place.
    const onTargetChance = Math.min(0.62, Math.max(0.06, profile.baseOnTarget + shotQuality * 0.32 - defAvg * 0.28 + (opts.onTargetBonus || 0)));
    if (seededRandom() >= onTargetChance) {
      m.playerMatchStats[shooter.id].xg += profile.baseXg * 0.5 + seededRandom() * 0.05;
      addEvent(m.minute, 'miss', sofascoreMiss(shooter, attTeam.team), attackingSide);
      // Note: through-ball offside is now judged spatially, up front, in
      // resolveChanceCreation() before the shot is ever attempted — see
      // checkLiveOffside() in engine/offside.js — so there's no separate
      // flat-probability offside roll here anymore.
      return;
    }

    attTeam.stats.shotsOn++;
    // ===== GK phase =====
    // A close-range effort (open play at close quarters, a dribble past
    // the last man, or a cross put away first-time) gives the keeper far
    // less reaction time than a longshot or a header he's had time to
    // set for — resolveGkSave() weights gk_reflex vs. gk_reach by exactly
    // that context, so the two attributes actually mean different things
    // in different situations instead of being interchangeable.
    const gk = pickPlayer(defTeam, ['GK']);
    const closeRangeShot = !isHeader && (chanceType === 'dribble' || chanceType === 'openplay' || chanceType === 'counter');
    const saveResult = resolveGkSave(gk, shooter, shotQuality, { isHeader, chanceType, shotPower, closeRange: closeRangeShot });
    if (saveResult.saved) {
      if (gk) {
        defTeam.stats.saves++;
        recordStat('saves', gk, defTeam.team);
        if (!m.playerMatchStats[gk.id]) m.playerMatchStats[gk.id] = blankPlayerMatchStats(gk);
        m.playerMatchStats[gk.id].saves = (m.playerMatchStats[gk.id].saves || 0) + 1;
        const desc = saveResult.saveType === 'catch' ? pickCatchDesc(gk, shooter) : pickSaveDesc(gk, shooter);
        addEvent(m.minute, 'save', desc, attackingSide);
        // Only a parry (not a clean catch) can leave a rebound behind, and
        // how likely that rebound actually is comes straight from the
        // keeper's own gk_parry rating via saveResult.reboundDanger.
        if (saveResult.saveType === 'parry' && seededRandom() < saveResult.reboundDanger) {
          const reboundShooter = pickPlayerWeighted(attTeam, ['ST', 'CAM', 'RW', 'LW'], GOAL_ROLE_WEIGHT, shooter.id);
          if (reboundShooter) {
            attTeam.stats.shots++;
            addEvent(m.minute, 'shot', `The rebound falls to <span class="player">${reboundShooter.name}</span>!`, attackingSide);
            resolveShot(attackingSide, defendingSide, reboundShooter, 'openplay', { qualityBonus: 0.16, onTargetBonus: 0.1 });
          }
        }
      }
      return;
    }

    // GOAL
    attTeam.score++;
    const method = isHeader ? { desc: 'towering header', xg: 0.3, puskas: false } : pickGoalMethod(shooter);
    recordStat('goals', shooter, attTeam.team);
    if (method.puskas) recordStat('puskas', shooter, attTeam.team);
    pushGoal(attackingSide, shooter, m.minute, method.desc);
    m.playerMatchStats[shooter.id].goals++;
    m.playerMatchStats[shooter.id].xg += (profile.baseXg + shotQuality * 0.3);
    const assister = opts.assistCandidate;
    if (assister && assister.id !== shooter.id && seededRandom() < 0.7) {
      recordStat('assists', assister, attTeam.team);
      if (!m.playerMatchStats[assister.id]) m.playerMatchStats[assister.id] = blankPlayerMatchStats(assister);
      m.playerMatchStats[assister.id].assists++;
      m.playerMatchStats[assister.id].xa += 0.3 + seededRandom() * 0.4;
      addEvent(m.minute, 'goal', `Goal! <span class="player">${shooter.name}</span> (${attTeam.team.short}) — ${method.desc}. Assisted by <span class="player">${assister.name}</span>.`, attackingSide, true);
    } else {
      addEvent(m.minute, 'goal', `Goal! <span class="player">${shooter.name}</span> (${attTeam.team.short}) — ${method.desc}.`, attackingSide, true);
    }
    maybeOffsideDisallow(attackingSide, shooter, m.minute);
  }

  // ===== Corner set piece (reached from a blocked cross/shot) =====
  function resolveCorner(attackingSide) {
    const m = currentMatch;
    if (!m) return;
    const defendingSide = attackingSide === 'home' ? 'away' : 'home';
    const attTeam = m[attackingSide], defTeam = m[defendingSide];
    attTeam.stats.corners = (attTeam.stats.corners || 0) + 1;

    // Routine selection — a corner is no longer one flat resolution. Six
    // realistic deliveries, each with its own target profile and
    // defensive counter: inswinger/outswinger (whipped either way), a
    // near-post flick-on, a far-post header, a dynamic set-up worked to
    // the edge of the box, a crowd-the-keeper scramble ball, or a short
    // corner recycled short.
    const ROUTINE_LABEL = { inswinger: 'inswinging delivery', outswinger: 'outswinging delivery', nearpost: 'near-post flick', farpost: 'far-post header', edge: 'worked to the edge of the box', crowd: 'crowding the keeper', short: 'short corner' };
    const GOAL_DESC = { inswinger: 'header from an inswinging corner', outswinger: 'header from an outswinging corner', nearpost: 'flick-on at the near post', farpost: 'towering header at the far post', edge: 'half-volley from the edge of the box', crowd: 'scrambled in from a crowded six-yard box' };
    const hasShortOption = (attTeam.squad.all || []).some(p => (p.tec || 70) >= 82);
    const roll = seededRandom();
    let routine;
    if (hasShortOption && roll < 0.1) routine = 'short';
    else if (roll < 0.32) routine = 'inswinger';
    else if (roll < 0.5) routine = 'outswinger';
    else if (roll < 0.65) routine = 'nearpost';
    else if (roll < 0.8) routine = 'farpost';
    else if (roll < 0.92) routine = 'crowd';
    else routine = 'edge';
    addEvent(m.minute, 'corner', `Corner for ${attTeam.team.short} — ${ROUTINE_LABEL[routine]}`, attackingSide);

    if (routine === 'short') {
      // Recycled short — rarely a shot on this exact passage, but can
      // still work an opening down the side.
      if (seededRandom() < 0.22) {
        const receiver = pickPlayer(attTeam, ['CM', 'CAM', 'RW', 'LW']);
        if (receiver) resolveChanceCreation(attackingSide, defendingSide, receiver, seededRandom() < 0.5 ? 'L' : 'R');
      }
      return;
    }

    // Defensive setup: zonal marking covers the back-post space and
    // second balls better; man-marking is sharper at matching a specific
    // near-post run or a runner attacking the keeper directly. Either way
    // a genuinely dominant aerial defender assigned to block/screen the
    // main threat trims the chance further.
    const zonal = seededRandom() < 0.5;
    const targetRoles = routine === 'crowd' ? ['ST', 'CB', 'CDM'] : ['ST', 'CB', 'CM', 'CAM'];
    const BASE_CHANCE = { inswinger: 0.062, outswinger: 0.05, nearpost: 0.07, farpost: 0.055, edge: 0.045, crowd: 0.08 };
    let chance = BASE_CHANCE[routine] || 0.05;
    if (zonal && (routine === 'farpost' || routine === 'edge')) chance *= 0.82;
    if (!zonal && (routine === 'nearpost' || routine === 'crowd')) chance *= 0.82;
    const blocker = pickPlayerCustomWeighted(defTeam, ['CB', 'CDM'], (p) => aerialSkill(p, true) * 2);
    if (blocker && aerialSkill(blocker, true) > 0.68) chance *= 0.85;

    // The most realistic own-goal source in the whole engine — a crowded
    // box, bodies flying at a cross under pressure, someone gets the
    // header/clearance badly wrong off his own man. Still a small
    // fraction of corners, same as real football.
    if (blocker && maybeOwnGoal(attackingSide, defendingSide, blocker, `turns ${ROUTINE_LABEL[routine] || 'the corner'} into his own net under pressure`, 0.007)) {
      return;
    }

    if (seededRandom() >= chance) return;
    // The designated corner-box attackers (Heading/Jump/Physical Contact
    // formula) are the players actually stationed in the danger areas for
    // this routine — they're more likely to be the one who gets on the
    // end of it, not guaranteed, since a corner is still a scramble.
    const designatedAttackerIds = new Set(((attTeam.roles && attTeam.roles.cornerAttackers) || []).map(p => p.id));
    const scorer = pickPlayerCustomWeighted(attTeam, targetRoles, (p) => aerialSkill(p, false) * 2 * (designatedAttackerIds.has(p.id) ? 1.35 : 1));
    if (!scorer) return;
    attTeam.stats.shots++;
    attTeam.stats.shotsOn++;
    attTeam.score++;
    recordStat('goals', scorer, attTeam.team);
    if (!m.playerMatchStats) m.playerMatchStats = {};
    if (!m.playerMatchStats[scorer.id]) m.playerMatchStats[scorer.id] = blankPlayerMatchStats(scorer);
    m.playerMatchStats[scorer.id].goals++;
    m.playerMatchStats[scorer.id].xg += 0.24 + seededRandom() * 0.18;
    // Out-swinging/far-post-style deliveries are taken from the side that
    // suits the right-footed/left-footed swing; in-swinging/near-post-style
    // ones from the other. Falls back to the generic pick if the
    // designated taker isn't on the pitch or is the scorer themselves.
    const onPitchIds = attackingSide === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const preferredCornerTaker = attTeam.roles && ((routine === 'outswinger' || routine === 'farpost' || routine === 'edge') ? attTeam.roles.rightCorner : attTeam.roles.leftCorner);
    const corTaker = (preferredCornerTaker && preferredCornerTaker.id !== scorer.id && onPitchIds.includes(preferredCornerTaker.id))
      ? preferredCornerTaker
      : pickPlayer(attTeam, ['CM', 'CAM', 'RW', 'LW', 'RB', 'LB'], scorer.id);
    if (corTaker && seededRandom() < 0.65) {
      recordStat('assists', corTaker, attTeam.team);
      if (!m.playerMatchStats[corTaker.id]) m.playerMatchStats[corTaker.id] = blankPlayerMatchStats(corTaker);
      m.playerMatchStats[corTaker.id].assists++;
      m.playerMatchStats[corTaker.id].xa += 0.2 + seededRandom() * 0.3;
    }
    pushGoal(attackingSide, scorer, m.minute, GOAL_DESC[routine] || 'header from corner');
    addEvent(m.minute, 'goal', `Corner converted (${ROUTINE_LABEL[routine]}). <span class="player">${scorer.name}</span> (${scorer.num || ''}) heads home`, attackingSide, true);
    // Exempt from offside by law — nobody can be offside receiving the
    // ball directly from a corner kick, so no VAR recheck follows.
  }

  // ===== Chance Creation phase (the sequence has reached the final third) =====
  // What kind of chance gets created is shaped by the entry channel and the
  // ball-carrier's/team's playstyle — a wide entry with a Cross Specialist
  // becomes a cross for an aerial target; an Inside Forward cuts in and
  // shoots himself; a central entry through a Creative Playmaker becomes a
  // defence-splitting through ball.
  function resolveChanceCreation(attackingSide, defendingSide, carrier, channel, extraQualityBonus) {
    const m = currentMatch;
    if (!m) return;
    const attTeam = m[attackingSide], defTeam = m[defendingSide];
    const wide = channel !== 'C';
    const tacSelf = (m.tactics && m.tactics[attackingSide]) || 'balanced';
    const tacOpp = (m.tactics && m.tactics[defendingSide]) || 'balanced';
    const mods = getPlaystyleMods(attTeam.team);

    // ===== Decision phase: the ball has reached the final third — what does =====
    // ===== the carrier actually try with it? Shoot himself, cross for a
    // target, thread a through ball, take a man on, or simply lay it off
    // instead of forcing a bad chance? Weighted on the carrier's own
    // attributes/playstyle plus the team's tactical stance, same as the
    // mid-pitch decision in runPossessionSequence().
    const marker = pickMarker(defTeam, mirrorDefenderPos('ATT_' + channel), null, mirrorZoneKey('ATT_' + channel));
    const decision = decideBallAction(carrier, marker, 'ATT_' + channel, tacSelf, tacOpp, mods,
      ['shoot', 'cross', 'throughball', 'dribble', 'pass']);

    let chanceType, shooter;
    switch (decision.action) {
      case 'dribble':
        chanceType = 'dribble'; shooter = carrier;
        break;
      case 'cross':
        chanceType = 'cross';
        shooter = pickPlayerCustomWeighted(attTeam, ['ST', 'CB', 'CAM', 'CM'], (p) => aerialSkill(p) * 2, carrier.id)
          || pickPlayerWeighted(attTeam, ['ST', 'CAM'], GOAL_ROLE_WEIGHT, carrier.id);
        break;
      case 'throughball':
        chanceType = 'throughball';
        shooter = pickPlayerWeighted(attTeam, ['ST', 'CAM', 'RW', 'LW'], GOAL_ROLE_WEIGHT, carrier.id);
        break;
      case 'pass':
        // Opts to recycle rather than force a low-quality look — the chance
        // fizzles out safely instead of every final-third entry ending in a shot.
        addEvent(m.minute, 'pass', `<span class="player">${carrier.name}</span> pulls it back rather than force it`, attackingSide);
        return;
      case 'shoot':
      default:
        chanceType = wide ? 'openplay' : (seededRandom() < 0.3 ? 'longshot' : 'openplay');
        shooter = chanceType === 'longshot' ? carrier
          : pickPlayerWeighted(attTeam, ['ST', 'RW', 'LW', 'CAM', 'CM', 'RM', 'LM'], GOAL_ROLE_WEIGHT, carrier.id);
        break;
    }
    if (!shooter) shooter = carrier;

    // Extra chance-quality edge from the carrier's own passing/crossing
    // flair on this specific delivery — on top of whatever the eventual
    // shooter brings to the shot itself (see finishingEdge et al).
    let creationQualityBonus = extraQualityBonus || 0;
    if (hasSkill(carrier, 'Visionary Pass') || hasSkill(carrier, 'Phenomenal Pass')) creationQualityBonus += 0.03;
    if (chanceType === 'cross' && (hasSkill(carrier, 'Pinpoint Crossing') || hasSkill(carrier, 'Edged Crossing'))) creationQualityBonus += 0.04;
    // Even without a naming crossing skill, a carrier with a genuinely
    // strong Lofted Pass rating still delivers a sharper cross than one
    // who doesn't — the raw attribute matters on top of the skill tags.
    if (chanceType === 'cross') creationQualityBonus += ((xattr(carrier, 'lofted_pass', 70) - 70) / 100) * 0.03;
    if (hasSkill(carrier, 'No Look Pass') || hasSkill(carrier, 'Heel Trick') || hasSkill(carrier, 'Rabona')) creationQualityBonus += 0.015;

    // A through ball is a genuine forward pass into space beyond the
    // defence — the one chance type actively judged for offside before the
    // shot ever happens. A flag here stops the passage immediately, the
    // same as an assistant referee raising it in real time: no shot, no
    // advantage played.
    if (chanceType === 'throughball') {
      const offsideResult = checkLiveOffside(attackingSide, shooter, 'throughball');
      if (offsideResult && offsideResult.offside) return;
    }

    attTeam.stats.shots++;
    if (!m.playerMatchStats) m.playerMatchStats = {};
    if (!m.playerMatchStats[shooter.id]) m.playerMatchStats[shooter.id] = blankPlayerMatchStats(shooter);
    m.playerMatchStats[shooter.id].shots++;
    resolveShot(attackingSide, defendingSide, shooter, chanceType, { assistCandidate: shooter.id !== carrier.id ? carrier : null, qualityBonus: creationQualityBonus });
  }

  // ===== Fouls / cards (reached from a lost duel or lost pass) =====
  // A challenge that happened as the attack was trying to break into the
  // final third has a real chance of being a penalty rather than a free-kick.
  // Every foul is logged here — this is the single source of truth for the
  // fouls stat, cards, and any resulting penalty, so any event that reads as
  // "a foul happened" (including a direct free-kick) always has exactly one
  // matching entry in defTeam.stats.fouls / m.foulCounts behind it.
  // Returns an outcome tag ('penalty' | 'red' | 'yellow' | 'foul') so callers
  // can decide what, if anything, can still follow (e.g. a direct free-kick
  // shouldn't be taken if the fouler just saw red on the same passage of play).
  function resolveFoul(defendingSide, attackingSide, fouler, victim, nearBox, forcePenalty) {
    const m = currentMatch;
    if (!m || !fouler) return { outcome: 'none' };
    const defTeam = m[defendingSide], attTeam = m[attackingSide];
    defTeam.stats.fouls++;
    if (!m.foulCounts) m.foulCounts = { home: {}, away: {} };
    m.foulCounts[defendingSide][fouler.id] = (m.foulCounts[defendingSide][fouler.id] || 0) + 1;
    const foulCount = m.foulCounts[defendingSide][fouler.id];
    const alreadyYellow = (m.cards[defendingSide][fouler.id] || 0) >= 1;
    const aggression = foulProneness(fouler);
    const foulText = victim
      ? `<span class="player">${fouler.name}</span> fouls <span class="player">${victim.name}</span>`
      : `Foul by <span class="player">${fouler.name}</span>`;

    if (nearBox && (forcePenalty || seededRandom() < 0.065)) {
      addEvent(m.minute, 'foul', foulText + ' — inside the area!', defendingSide);
      const onPitchIds = attackingSide === 'home' ? m.homeOnPitch : m.awayOnPitch;
      const designatedTaker = attTeam.roles && attTeam.roles.penalty;
      const taker = (designatedTaker && onPitchIds.includes(designatedTaker.id))
        ? designatedTaker
        : (pickPlayerWeighted(attTeam, ['ST', 'RW', 'LW', 'CAM', 'CM'], PEN_TAKER_ROLE_WEIGHT) || victim);
      if (taker) {
        addEvent(m.minute, 'pen', `Penalty to ${attTeam.team.short}. <span class="player">${taker.name}</span> on the spot.`, attackingSide);
        attTeam.stats.shots++;
        if (!m.playerMatchStats) m.playerMatchStats = {};
        if (!m.playerMatchStats[taker.id]) m.playerMatchStats[taker.id] = blankPlayerMatchStats(taker);
        m.playerMatchStats[taker.id].shots++;
        const penGk = pickPlayer(defTeam, ['GK']);
        const po = pickPenOutcome(taker, penGk);
        if (po.scored) {
          attTeam.stats.shotsOn++;
          attTeam.score++;
          recordStat('goals', taker, attTeam.team);
          m.playerMatchStats[taker.id].goals++;
          m.playerMatchStats[taker.id].xg += 0.76 + seededRandom() * 0.08;
          pushGoal(attackingSide, taker, m.minute, 'penalty — ' + po.text);
          addEvent(m.minute, 'goal', `${emojiImg('penalty_goal', 'Penalty goal')} Penalty goal! <span class="player">${taker.name}</span> ${po.text}`, attackingSide, true, true);
          maybeOffsideDisallow(attackingSide, taker, m.minute, 'penalty');
        } else {
          if (po.saved) {
            attTeam.stats.shotsOn++;
            if (penGk) {
              defTeam.stats.saves++;
              recordStat('saves', penGk, defTeam.team);
              if (!m.playerMatchStats[penGk.id]) m.playerMatchStats[penGk.id] = blankPlayerMatchStats(penGk);
              m.playerMatchStats[penGk.id].saves = (m.playerMatchStats[penGk.id].saves || 0) + 1;
            }
            addEvent(m.minute, 'save', `${emojiImg('penalty_miss_saved', 'Penalty saved')} Penalty saved! <span class="player">${taker.name}</span>'s effort ${po.text}${penGk ? ` — <span class="player">${penGk.name}</span> denies it` : ''}`, attackingSide);
          } else {
            addEvent(m.minute, 'miss', `${emojiImg('penalty_miss_saved', 'Penalty missed')} Penalty missed — <span class="player">${taker.name}</span>: ${po.text}`, attackingSide);
          }
        }
      }
      return { outcome: 'penalty' };
    }

    // Realistic discipline curve: a single, isolated foul is very rarely
    // carded (referees give plenty of "just a foul" outcomes) — cards
    // escalate with genuine repeat/reckless fouling rather than being a
    // near-coinflip from the first challenge onward. Tuned so a match
    // produces on the order of 2-4 yellows combined and a red roughly once
    // every 3-4 matches, matching real-world discipline rates.
    // Escalation terms eased further: combined with foulProneness/foul-
    // selection changes upstream (engine/defending.js, engine/transitions.js)
    // that already reduce how often the same high-aggression player racks
    // up a fast foulCount, the old per-repeat/already-yellow bumps could
    // still stack into an unrealistic run of cards once a player did start
    // repeat-fouling. The third-foul kicker now only applies from a fourth
    // foul on, and every increment is smaller, so repeat fouling still
    // clearly raises the odds of a card without turning into a near-certain
    // yellow (or a cheap second yellow) by a player's third or fourth foul.
    let yellowChance = Math.min(0.45, 0.04 * aggression + (foulCount - 1) * 0.06 + (alreadyYellow ? 0.07 : 0) + (foulCount >= 4 ? 0.05 : 0));
    const straightRedChance = 0.0013 * aggression;
    const roll = seededRandom();
    if (roll < straightRedChance && !alreadyYellow) {
      defTeam.stats.reds++;
      recordStat('cards', fouler, defTeam.team);
      recordStat('reds', fouler, defTeam.team);
      if (!m.playerMatchStats) m.playerMatchStats = {};
      if (!m.playerMatchStats[fouler.id]) m.playerMatchStats[fouler.id] = blankPlayerMatchStats(fouler);
      m.playerMatchStats[fouler.id].red = true;
      addEvent(m.minute, 'red', `${emojiImg('red_card', 'Red card')} Straight red! ${foulText} — reckless challenge`, defendingSide);
      removeFromPitch(defendingSide, fouler.id);
      handleRedCardReshuffle(defendingSide, fouler);
      return { outcome: 'red' };
    } else if (roll < straightRedChance + yellowChance) {
      m.cards[defendingSide][fouler.id] = (m.cards[defendingSide][fouler.id] || 0) + 1;
      defTeam.stats.yellows++;
      recordStat('cards', fouler, defTeam.team);
      recordStat('yellows', fouler, defTeam.team);
      if (!m.playerMatchStats) m.playerMatchStats = {};
      if (!m.playerMatchStats[fouler.id]) m.playerMatchStats[fouler.id] = blankPlayerMatchStats(fouler);
      m.playerMatchStats[fouler.id].yellow = true;
      if (m.cards[defendingSide][fouler.id] >= 2) {
        defTeam.stats.reds++;
        recordStat('reds', fouler, defTeam.team);
        m.playerMatchStats[fouler.id].red = true;
        addEvent(m.minute, 'red', `${emojiImg('red_card', 'Red card')} Second yellow → red! ${foulText}`, defendingSide);
        removeFromPitch(defendingSide, fouler.id);
        handleRedCardReshuffle(defendingSide, fouler);
        return { outcome: 'red' };
      } else {
        addEvent(m.minute, 'yellow', `${emojiImg('yellow_card', 'Yellow card')} Yellow card — ${foulText}${foulCount > 1 ? ' (repeated fouls)' : ''}`, defendingSide);
        return { outcome: 'yellow' };
      }
    } else {
      addEvent(m.minute, 'foul', foulText + (foulCount > 1 ? ' — referee has a word' : ''), defendingSide);
      return { outcome: 'foul' };
    }
  }

  // ===== Transitions phase: a fast break for the side that just won the ball =====
  // Skips the full zone-by-zone grind (the whole point of a counter is that
  // there isn't time for one) and goes almost straight to a shot, with a
  // quality/on-target bump reflecting the exposed, unset defence.
  function runFastBreak(breakingSide, otherSide) {
    const m = currentMatch;
    if (!m) return;
    const breakTeam = m[breakingSide];
    const shooter = pickPlayerWeighted(breakTeam, ['ST', 'RW', 'LW', 'CAM', 'CM'], GOAL_ROLE_WEIGHT);
    if (!shooter) return;
    // A break is a straight foot race against a retreating defence — once
    // it's already sprung (see the Acceleration-driven counterProb in
    // resolveTurnover), it's sustained top Speed that decides whether the
    // carrier actually outruns the defensive line to a better chance.
    const oppTeamData = m[otherSide];
    const oppPace = calcTeamStrength(oppTeamData).pac || 70;
    const speedEdge = Math.max(-0.05, Math.min(0.09,
      (xattr(shooter, 'spd', shooter.pac || 70) * staminaMultiplier(shooter) - oppPace) / 220));
    addEvent(m.minute, 'pressure', `${breakTeam.team.short} break at real pace!`, breakingSide);
    const breakChannel = seededRandom() < 0.5 ? 'L' : (seededRandom() < 0.5 ? 'C' : 'R');
    // A break goes straight at the exposed defence — the ball is already
    // effectively in the attacking third by the time it's sprung.
    m.ballZone = { side: breakingSide, third: 'ATT', channel: breakChannel };
    resolveChanceCreation(breakingSide, otherSide, shooter, breakChannel, speedEdge);
  }

  // ===== Duels phase resolution: the ball has been lost (pass cut out, or =====
  // ===== beaten in a 1v1) — who wins it, and does it spring a transition?
  function resolveTurnover(attackingSide, defendingSide, contestedPlayer, winner, fromThird, toThird, kind, channel) {
    const m = currentMatch;
    if (!m) return;
    const defTeam = m[defendingSide];
    const defenderPlayer = winner || pickMarker(defTeam, mirrorDefenderPos(toThird + '_C'), null, mirrorZoneKey(toThird + '_C'));
    if (!defenderPlayer) return;
    // The ball just changed hands in defendingSide's own zone — mirror the
    // third (attacker's ATT is the defender's DEF, and vice versa) so the
    // live ball-location snapshot flips to the winning side's perspective.
    // Purely a rendering aid for ui/matchUI.js::renderPitch (see the note in
    // possession.js) — never read by the simulation itself.
    const mirroredThird = toThird === 'ATT' ? 'DEF' : toThird === 'DEF' ? 'ATT' : 'MID';
    m.ballZone = { side: defendingSide, third: mirroredThird, channel: channel || 'C' };
    if (!m.playerMatchStats) m.playerMatchStats = {};
    if (!m.playerMatchStats[defenderPlayer.id]) m.playerMatchStats[defenderPlayer.id] = blankPlayerMatchStats(defenderPlayer);
    const ps = m.playerMatchStats[defenderPlayer.id];

    // A mistimed challenge trying to win the ball back becomes a foul.
    // Gamesmanship: the attacker being challenged is the one who's good at
    // winning free-kicks off contact, so a defender up against one commits
    // a few more fouls trying to dispossess them.
    const aggression = foulProneness(defenderPlayer);
    // Toned down from the original — real defenders concede far fewer
    // fouls per genuine challenge than this used to model, and the old
    // rate (combined with the independent secondary-event fouls below)
    // was producing far more cards/reds than a real match sees.
    // The 'duel' kind used to carry an extra +15% surcharge on top of
    // aggression — but a duel win is exactly the outcome a defensive
    // midfielder/CB records far more often than any other position simply
    // by doing their job, so that surcharge landed almost entirely on
    // those positions and made high-aggression DMs disproportionately
    // likely to be flagged for a foul purely from winning the ball back.
    // Dropped to parity (1.0) so aggression alone — not the type of
    // contest a busy defensive position wins most often — drives the risk.
    let foulChance = 0.05 * aggression * (kind === 'duel' ? 1.0 : 0.6);
    if (contestedPlayer && hasSkill(contestedPlayer, 'Gamesmanship')) foulChance *= 1.2;
    if (seededRandom() < foulChance) {
      resolveFoul(defendingSide, attackingSide, defenderPlayer, contestedPlayer, toThird === 'ATT');
      return;
    }

    const roll = seededRandom();
    if (roll < 0.55) {
      ps.interceptions = (ps.interceptions || 0) + 1;
      ps.tackles = (ps.tackles || 0) + 1;
      defTeam.stats.interceptions = (defTeam.stats.interceptions || 0) + 1;
      if (seededRandom() < 0.4) {
        const flavor = styleFlavor(defenderPlayer, INTERCEPTION_FLAVOR);
        addEvent(m.minute, 'pass', flavor
          ? `<span class="player">${defenderPlayer.name}</span> (${defTeam.team.short}) ${flavor}.`
          : `Interception by <span class="player">${defenderPlayer.name}</span> (${defTeam.team.short}).`, defendingSide);
      }
    } else {
      ps.tackles = (ps.tackles || 0) + 1;
      if (seededRandom() < 0.4) {
        const flavor = styleFlavor(defenderPlayer, TACKLE_FLAVOR);
        addEvent(m.minute, 'tackle', flavor
          ? `<span class="player">${defenderPlayer.name}</span> ${flavor}`
          : `Strong challenge from <span class="player">${defenderPlayer.name}</span> (${defTeam.team.short}) wins it back.`, defendingSide);
      }
    }

    // ===== Transitions phase: does the side that just won it break quickly? =====
    const defMods = getPlaystyleMods(defTeam.team);
    const spaceFactor = fromThird === 'ATT' ? 1.3 : fromThird === 'MID' ? 1.0 : 0.55;
    // Acceleration Burst (explosive from a standing start) and Attacking
    // Surge (extra pace once the break is on into the opponent's half) both
    // make the player who's just won the ball more likely to actually spring
    // a fast break with it, on top of their raw pace.
    let counterSkillBonus = 0;
    if (hasSkill(defenderPlayer, 'Acceleration Burst')) counterSkillBonus += 0.03;
    if (hasSkill(defenderPlayer, 'Attacking Surge')) counterSkillBonus += 0.02;
    // Springing the break itself is about explosive acceleration from a
    // standing start, not sustained top speed — Acceleration is the
    // specific attribute for that first burst, so it (not the generic pac
    // blend) decides how likely the counter actually gets going.
    const burst = xattr(defenderPlayer, 'accel', defenderPlayer.pac || 70) * staminaMultiplier(defenderPlayer);
    const counterProb = Math.max(0.03, Math.min(0.55, 0.08 * defMods.counterBonus * spaceFactor + (burst - 70) / 300 + counterSkillBonus));
    if (seededRandom() < counterProb) runFastBreak(defendingSide, attackingSide);
  }

  // ===== Dynamic ball-decision model ============================================
  // Replaces fixed engine branching ("this zone always tries a pass", "wide entry
  // is always a cross-or-cutback coin flip") with an actual decision: whenever a
  // player is on the ball, every plausible action gets a weighted score built from
  // (1) that player's own attributes, (2) the situation around them right now
  // (pitch zone, marking pressure, which channel, game state), and (3) their
  // team's tactical stance and manager playstyle. One action is then drawn from
  // the resulting probability distribution with seededRandom() — so the same
  // player in the same spot won't always do the same thing, but a genuine
  // dribbler in space against a tired full-back will *tend* to run at him far
  // more often than a target man would.
  //
  // Used at two points in the possession pipeline:
  //   - runPossessionSequence() (possession.js): a mid-pitch receiver choosing
  //     between pass / dribble / carry / backpass / switch / hold.
  //   - resolveChanceCreation() (passing.js): the final-third decision between
  //     shoot / cross / through ball / dribble / laying it off instead.
  const BALL_ACTIONS = ['pass', 'dribble', 'carry', 'shoot', 'cross', 'throughball', 'backpass', 'switch', 'hold'];

  // Which broad position group a player's decisions get evaluated as. This
  // is the piece the model was missing: everyone on the ball in midfield
  // was scored off the *same* base table regardless of whether they were a
  // CDM or a striker who'd dropped deep — so a poacher who found himself in
  // midfield behaved (and got dispossessed) like a converted playmaker
  // instead of doing what strikers actually do there, which is look for the
  // link/lay-off rather than try to dribble through a crowded middle.
  function positionGroupOf(p) {
    const slot = (p && (p.slot || (p.pos || [])[0])) || 'CM';
    if (slot === 'GK') return 'GK';
    if (slot === 'CB') return 'CB';
    if (slot === 'RB' || slot === 'LB' || slot === 'RWB' || slot === 'LWB') return 'FB';
    if (slot === 'CDM') return 'CDM';
    if (slot === 'CM') return 'CM';
    if (slot === 'CAM') return 'CAM';
    if (slot === 'RM' || slot === 'LM' || slot === 'RW' || slot === 'LW') return 'WIDE';
    if (slot === 'ST' || slot === 'CF' || slot === 'SS') return 'ST';
    return 'CM';
  }

  // Starting weight for each action before attribute/context/tactic factors
  // are applied, keyed by (a) which third of the pitch the ball is in and
  // (b) the carrier's own position group — a back-line CB and an out-and-
  // out striker read a midfield situation completely differently, and this
  // is what actually encodes that instead of one flat per-third table for
  // everyone. Every action keeps a nonzero floor so an unlikely one (a CB
  // shooting from inside his own half) stays possible at a low rate rather
  // than being hard-excluded — real matches occasionally produce exactly
  // that kind of moment.
  const BASE_ACTION_WEIGHTS_BY_POS = {
    GK: {
      DEF: { pass: 55, dribble: 0.5, carry: 8,  shoot: 0.05, cross: 0.3, throughball: 0.5, backpass: 20, switch: 14, hold: 1 },
      MID: { pass: 52, dribble: 0.5, carry: 8,  shoot: 0.1,  cross: 0.5, throughball: 1,   backpass: 18, switch: 14, hold: 2 },
      ATT: { pass: 46, dribble: 0.5, carry: 6,  shoot: 0.5,  cross: 1,   throughball: 1,    backpass: 12, switch: 10, hold: 3 }
    },
    CB: {
      DEF: { pass: 50, dribble: 3,  carry: 14, shoot: 0.1, cross: 0.3, throughball: 1,   backpass: 18, switch: 12, hold: 3 },
      MID: { pass: 48, dribble: 4,  carry: 12, shoot: 0.3, cross: 1,   throughball: 2,   backpass: 16, switch: 12, hold: 4 },
      ATT: { pass: 40, dribble: 3,  carry: 8,  shoot: 3,   cross: 3,   throughball: 2,   backpass: 10, switch: 8,  hold: 3 }
    },
    FB: {
      DEF: { pass: 46, dribble: 6,  carry: 16, shoot: 0.1, cross: 1,   throughball: 1,   backpass: 15, switch: 12, hold: 3 },
      MID: { pass: 40, dribble: 8,  carry: 16, shoot: 0.3, cross: 4,   throughball: 2,   backpass: 10, switch: 12, hold: 3 },
      ATT: { pass: 28, dribble: 10, carry: 12, shoot: 1,   cross: 14,  throughball: 3,   backpass: 4,  switch: 6,  hold: 3 }
    },
    CDM: {
      DEF: { pass: 52, dribble: 3,  carry: 12, shoot: 0.1, cross: 0.3, throughball: 1.5, backpass: 18, switch: 12, hold: 4 },
      MID: { pass: 50, dribble: 5,  carry: 10, shoot: 0.5, cross: 1.5, throughball: 5,   backpass: 14, switch: 12, hold: 6 },
      ATT: { pass: 34, dribble: 5,  carry: 8,  shoot: 3,   cross: 3,   throughball: 6,   backpass: 6,  switch: 6,  hold: 6 }
    },
    CM: {
      DEF: { pass: 46, dribble: 6,  carry: 14, shoot: 0.2, cross: 0.5, throughball: 2,   backpass: 15, switch: 11, hold: 4 },
      MID: { pass: 42, dribble: 10, carry: 12, shoot: 1,   cross: 3,   throughball: 8,   backpass: 9,  switch: 10, hold: 4 },
      ATT: { pass: 26, dribble: 10, carry: 9,  shoot: 8,   cross: 8,   throughball: 9,   backpass: 4,  switch: 4,  hold: 4 }
    },
    CAM: {
      DEF: { pass: 40, dribble: 6,  carry: 12, shoot: 0.2, cross: 0.5, throughball: 3,   backpass: 15, switch: 10, hold: 4 },
      MID: { pass: 36, dribble: 11, carry: 10, shoot: 2,   cross: 4,   throughball: 14,  backpass: 6,  switch: 8,  hold: 5 },
      ATT: { pass: 18, dribble: 13, carry: 7,  shoot: 16,  cross: 9,   throughball: 15,  backpass: 2,  switch: 3,  hold: 5 }
    },
    WIDE: {
      DEF: { pass: 40, dribble: 8,  carry: 16, shoot: 0.2, cross: 1,   throughball: 1,   backpass: 13, switch: 12, hold: 3 },
      MID: { pass: 34, dribble: 16, carry: 16, shoot: 1,   cross: 5,   throughball: 5,   backpass: 8,  switch: 11, hold: 3 },
      ATT: { pass: 16, dribble: 20, carry: 10, shoot: 12,  cross: 20,  throughball: 6,   backpass: 2,  switch: 6,  hold: 3 }
    },
    ST: {
      // Midfield is a striker's least natural zone to be carrying the ball
      // in — realistically he isn't trying to dribble through a crowded
      // middle against a CDM, he's looking to bring it down and lay it off
      // (hold) or find the simple pass and get back into a threatening
      // position. That's the specific gap the old flat per-third table
      // papered over and what was getting strikers/wingers dispossessed
      // so heavily once every action was actually being attempted.
      DEF: { pass: 38, dribble: 6,  carry: 14, shoot: 0.1, cross: 0.3, throughball: 0.5, backpass: 14, switch: 10, hold: 7  },
      MID: { pass: 34, dribble: 8,  carry: 10, shoot: 1.5, cross: 1.5, throughball: 3,   backpass: 8,  switch: 6,  hold: 20 },
      ATT: { pass: 12, dribble: 10, carry: 6,  shoot: 32,  cross: 4,   throughball: 5,   backpass: 1,  switch: 1,  hold: 8  }
    }
  };

  function baseActionWeights(third, posGroup) {
    const byPos = BASE_ACTION_WEIGHTS_BY_POS[posGroup] || BASE_ACTION_WEIGHTS_BY_POS.CM;
    return byPos[third] || byPos.MID;
  }
  // Player-attribute contribution to each candidate action, reusing the same
  // ability reads the rest of the engine already relies on (passingAbility,
  // carryingAbility, aerialPassingAbility, etc.) so a player who's good at
  // something here is the same player who's good at it everywhere else in the
  // simulation. Returned on roughly the same ~60-95 scale as those helpers.
  function attributeActionScores(p) {
    const ground = groundPassingAbility(p);
    const aerial = aerialPassingAbility(p);
    const carry = carryingAbility(p);
    const vision = curvedAttr(xattr(p, 'vision', p.tec || 70), 70);
    const composure = curvedAttr(xattr(p, 'composure', p.tec || 70), 70);
    const finishing = curvedAttr(xattr(p, 'fin', p.att || 70), 70) * 0.65 + curvedAttr(p.att || 70, 70) * 0.35;
    return {
      pass: ground * 0.7 + vision * 0.3,
      dribble: carry * 0.75 + composure * 0.25,
      carry: carry * 0.8 + curvedAttr(p.pac || 70, 70) * 0.2,
      shoot: finishing,
      cross: aerial,
      throughball: vision * 0.6 + ground * 0.4,
      backpass: ground,
      switch: aerial * 0.5 + vision * 0.5,
      hold: composure * 0.7 + carry * 0.3
    };
  }
  // Builds the weighted score for every action in `allowed`, folding in the
  // situational (pressure) and tactical (team stance / manager playstyle /
  // player traits) factors on top of the raw attribute read above.
  function evaluateBallActions(player, ctx) {
    const third = (ctx.zoneKey || 'MID_C').split('_')[0];
    const posGroup = positionGroupOf(player);
    const base = baseActionWeights(third, posGroup);
    const attr = attributeActionScores(player);
    const pressure = ctx.marker ? defensivePressure(ctx.marker) : 55;
    const styles = (player.expandedAttrs && player.expandedAttrs.playstyle) || [];
    const allowed = ctx.allowed || BALL_ACTIONS;
    // How much heavier pressure discourages (positive) or encourages
    // (negative, i.e. safety-first actions become relatively more attractive)
    // each action — a tight man-marking job makes a risky through ball or
    // dribble far less appealing than simply recycling it.
    const pressureSensitivity = { pass: 0.28, dribble: 1.0, carry: 0.9, shoot: 0.5, cross: 0.45, throughball: 0.9, backpass: -0.9, switch: -0.5, hold: -0.7 };

    const scores = {};
    allowed.forEach((action) => {
      const b = base[action] != null ? base[action] : 1;
      const a = attr[action] != null ? attr[action] / 70 : 1;
      let w = b * a;

      const sens = pressureSensitivity[action] || 0;
      w *= 1 - Math.max(-0.5, Math.min(0.5, sens * ((pressure - 55) / 100)));

      // Tactical stance: an attacking team leans into progressive/risky ball
      // actions, a defensive one prioritises keeping possession safe.
      if (ctx.tacticSelf === 'attack') {
        if (action === 'dribble' || action === 'carry' || action === 'shoot' || action === 'throughball' || action === 'cross') w *= 1.18;
        if (action === 'backpass') w *= 0.7;
      } else if (ctx.tacticSelf === 'defend') {
        if (action === 'backpass' || action === 'hold' || action === 'switch') w *= 1.15;
        if (action === 'dribble' || action === 'throughball' || action === 'shoot') w *= 0.82;
      } else if (ctx.tacticSelf === 'press') {
        if (action === 'pass' || action === 'carry') w *= 1.08;
      }
      // Facing a high press makes it harder to justify a slow build-up ball —
      // safer, quicker options get relatively more attractive.
      if (ctx.tacticOpp === 'press') {
        if (action === 'backpass' || action === 'switch') w *= 1.12;
        if (action === 'throughball') w *= 0.9;
      }

      // Manager playstyle: wide-leaning sides cross/switch more, direct sides
      // (Long Ball) favour progressing the ball over patient recycling.
      if (ctx.mods) {
        if (action === 'cross' || action === 'switch') w *= ctx.mods.wingBiasMult || 1;
        if (action === 'backpass') w *= 1 / Math.max(0.6, ctx.mods.passVolMult || 1);
      }

      // Individual playstyle tags — the same trait tags resolveChanceCreation
      // already recognised for crossers/cutting-in wingers/creative playmakers
      // now shape the decision itself instead of just the fixed cascade.
      if (action === 'dribble' && styles.includes('Inside Forward')) w *= 1.6;
      if (action === 'cross' && styles.some((s) => ['Cross Specialist', 'Prolific Winger', 'Roaming Flank', 'Offensive Full-back', 'Full-back Finisher'].includes(s))) w *= 1.6;
      if (action === 'throughball' && styles.some((s) => ['Creative Playmaker', 'Classic No. 10', 'Orchestrator', 'Deep-Lying Forward'].includes(s))) w *= 1.6;
      if (hasSkill(player, 'Attack Trigger') && (action === 'dribble' || action === 'carry' || action === 'throughball')) w *= 1.08;

      // A pure box player wants the ball played into the box for him to
      // finish, not to drop deep and carry/dribble it up himself — a
      // Goal Poacher/Fox in the Box receiving it outside the area looks to
      // get a shot away or get it back into a dangerous area fast rather
      // than dictate the move.
      if (styles.includes('Goal Poacher') || styles.includes('Fox in the Box')) {
        if (action === 'shoot') w *= 1.35;
        if (action === 'hold') w *= 1.25;
        if (action === 'dribble' || action === 'carry') w *= 0.7;
      }
      // Box-to-box is defined by covering the full length of the pitch —
      // more willing to carry/drive forward with it himself than a
      // stay-at-home teammate in the same shirt number.
      if (styles.includes('Box-to-Box')) {
        if (action === 'carry') w *= 1.3;
        if (action === 'dribble') w *= 1.15;
        if (action === 'backpass' || action === 'hold') w *= 0.85;
      }
      // A deep-lying forward/hole player is a false-nine type who drops to
      // link play — looks to find the pass rather than force a shot.
      if (styles.includes('Deep-Lying Forward') || styles.includes('Hole Player')) {
        if (action === 'pass' || action === 'throughball') w *= 1.3;
        if (action === 'hold') w *= 1.1;
        if (action === 'shoot') w *= 0.9;
      }
      // A target man's whole game is holding the ball up for support to
      // arrive, not beating a man himself.
      if (styles.includes('Target Man')) {
        if (action === 'hold') w *= 1.4;
        if (action === 'dribble') w *= 0.6;
      }
      // Anchor Man/Destroyer sit and screen — they recycle the ball safely
      // rather than gambling on a risky forward action.
      if (styles.includes('Anchor Man') || styles.includes('Destroyer')) {
        if (action === 'backpass' || action === 'pass') w *= 1.2;
        if (action === 'dribble' || action === 'throughball' || action === 'shoot') w *= 0.6;
      }
      // An Orchestrator/Build Up player dictates tempo from deep — favors
      // the considered pass/switch over trying to run past someone.
      if (styles.includes('Orchestrator') || styles.includes('Build Up')) {
        if (action === 'pass' || action === 'switch') w *= 1.25;
        if (action === 'dribble') w *= 0.8;
      }
      // Attacking full-backs/wing-backs bombing forward look to carry the
      // width and get a cross in more than a standard full-back would.
      if (styles.includes('Extra Frontman') || styles.includes('Offensive Full-back') || styles.includes('Full-back Finisher')) {
        if (action === 'carry' || action === 'cross') w *= 1.2;
      }

      scores[action] = Math.max(0.05, w);
    });
    return scores;
  }
  // Draws one action from a { action: weight } distribution — this (not a
  // fixed if/else cascade) is what actually decides the outcome.
  function chooseWeightedAction(scores) {
    const entries = Object.entries(scores);
    if (!entries.length) return 'pass';
    const total = entries.reduce((s, [, w]) => s + w, 0);
    if (!(total > 0)) return entries[0][0];
    let r = seededRandom() * total;
    for (let i = 0; i < entries.length; i++) {
      r -= entries[i][1];
      if (r <= 0) return entries[i][0];
    }
    return entries[entries.length - 1][0];
  }
  // Convenience wrapper used by the call sites: evaluates candidates, picks
  // one by weighted probability, and hands back both so callers can narrate
  // or reuse the scores if they want to.
  function decideBallAction(player, marker, zoneKey, tacticSelf, tacticOpp, mods, allowed) {
    const scores = evaluateBallActions(player, { zoneKey, marker, tacticSelf, tacticOpp, mods, allowed });
    return { action: chooseWeightedAction(scores), scores };
  }

  // ===== The core pipeline: Zones -> Movement -> Passing -> Duels, one =====
  // ===== zone transition at a time, until the ball reaches the final third
  // (Chance Creation) or is lost along the way (Transitions).
  function runPossessionSequence(attackingSide) {
    const m = currentMatch;
    if (!m) return;
    const defendingSide = attackingSide === 'home' ? 'away' : 'home';
    const attTeam = m[attackingSide], defTeam = m[defendingSide];
    const attMods = getPlaystyleMods(attTeam.team);
    const tac = (m.tactics && m.tactics[attackingSide]) || 'balanced';
    const defTac = (m.tactics && m.tactics[defendingSide]) || 'balanced';

    // ===== Zones phase: which channel does this sequence develop through? =====
    // Out Wide / Overload-minded managers lean wide; Possession/Long Ball
    // sides are more likely to build centrally.
    const wideBias = Math.max(0.15, Math.min(0.85, 0.42 * attMods.wingBiasMult));
    let channel = seededRandom() < wideBias ? (seededRandom() < 0.5 ? 'L' : 'R') : 'C';

    let carrier = pickPlayer(attTeam, ZONE_POS_MAP['DEF_' + channel], null, 'DEF_' + channel) || pickPlayer(attTeam, ['CB', 'GK']);
    if (!carrier) return;
    // Live ball-location tracking for the pitch view (ui/matchUI.js::
    // renderPitch): a lightweight {side, third, channel} snapshot of where
    // the ball currently is, from the possessing side's own perspective.
    // Purely a rendering aid — nothing in the simulation math reads this
    // back, so it's safe to update at every phase without affecting results.
    m.ballZone = { side: attackingSide, third: 'DEF', channel: channel };
    // Attack Trigger: while this player has the ball, the whole team reads
    // the attacking picture better — a small boost to both finding a
    // team-mate and winning the ball back under pressure for as long as
    // they're the one carrying the move forward.
    const attackTriggerBonus = hasSkill(carrier, 'Attack Trigger') ? 0.025 : 0;

    for (let i = 0; i < 2; i++) { // DEF->MID, then MID->ATT
      const fromThird = PITCH_THIRDS[i], toThird = PITCH_THIRDS[i + 1];

      // ===== Decision phase: the carrier is on the ball right now — what do =====
      // ===== they actually try to do with it? Evaluated fresh every time the
      // ball changes hands, rather than the engine always assuming "pass".
      const carrierMarker = pickMarker(defTeam, mirrorDefenderPos(fromThird + '_' + channel), null, mirrorZoneKey(fromThird + '_' + channel));
      const decision = decideBallAction(carrier, carrierMarker, fromThird + '_' + channel, tac, defTac, attMods,
        ['pass', 'dribble', 'carry', 'backpass', 'switch', 'hold']);

      if (decision.action === 'backpass') {
        // Plays it safe and recycles — the move fizzles out this minute
        // rather than being forced forward into a bad situation.
        addEvent(m.minute, 'pass', `<span class="player">${carrier.name}</span> plays it back — no risks taken`, attackingSide);
        return;
      }

      let holdBonus = 0;
      if (decision.action === 'switch') {
        const others = PITCH_CHANNELS.filter((c) => c !== channel);
        channel = others[Math.floor(seededRandom() * others.length)];
        const chanName = channel === 'L' ? 'left' : channel === 'R' ? 'right' : 'middle';
        addEvent(m.minute, 'pass', `<span class="player">${carrier.name}</span> switches the play out to the ${chanName}`, attackingSide);
      } else if (seededRandom() < 0.1) {
        // Small residual drift so channel isn't only ever changed by an
        // explicit switch decision — real play still meanders a little.
        channel = PITCH_CHANNELS[Math.floor(seededRandom() * 3)];
      }

      if (decision.action === 'dribble' || decision.action === 'carry') {
        const runMarker = pickMarker(defTeam, mirrorDefenderPos(fromThird + '_' + channel), null, mirrorZoneKey(fromThird + '_' + channel));
        const runPressure = runMarker ? defensivePressure(runMarker) : 60;
        // Base raised from 0.62 -> 0.72 (see passChance/duelChance below for
        // the full explanation): the old bases made a possession sequence
        // die out long before reaching the final third far more often than
        // real buildup play does, starving both ends of the pitch of shots
        // and, in turn, keepers of saves.
        const carryChance = Math.max(0.30, Math.min(0.93,
          0.86 + (carryingAbility(carrier) - runPressure) / 140 + attackTriggerBonus));
        if (seededRandom() >= carryChance) {
          resolveTurnover(attackingSide, defendingSide, carrier, runMarker, fromThird, toThird, 'carry', channel);
          return;
        }
        if (seededRandom() < 0.25) {
          addEvent(m.minute, 'skill', `${carrier.name} ${decision.action === 'dribble' ? 'dribbles past a challenge' : 'drives forward with the ball'}`, attackingSide);
        }
        m.ballZone = { side: attackingSide, third: toThird, channel: channel };
        continue; // carrier advances the ball themselves — no pass needed this phase
      }

      if (decision.action === 'hold') {
        holdBonus = 0.04;
        if (seededRandom() < 0.35) addEvent(m.minute, 'pass', `<span class="player">${carrier.name}</span> shields it and waits for support`, attackingSide);
      }

      const targetZone = toThird + '_' + channel;

      // ===== Movement phase: who makes themselves available in that zone? =====
      const targetPlayer = pickPlayer(attTeam, ZONE_POS_MAP[targetZone], carrier.id, targetZone) || carrier;
      // The move is developing into this zone even before the pass is
      // resolved below — a real side shifts its shape toward the ball as
      // it travels, not only once it safely arrives.
      m.ballZone = { side: attackingSide, third: toThird, channel: channel };

      // ===== Passing phase: can the carrier find them? =====
      const passerSkill = passingAbility(carrier);
      const marker = pickMarker(defTeam, mirrorDefenderPos(targetZone), null, mirrorZoneKey(targetZone));
      const pressure = marker ? defensivePressure(marker) : 60;
      // Base raised from 0.5 -> 0.62: with two zone transitions (DEF->MID,
      // MID->ATT) chained together and EACH one gated behind both this pass
      // check AND the duel check right below, the old 0.5/0.78 bases only
      // let a sequence survive one full transition ~39% of the time —
      // squaring that across both transitions meant barely 1 in 6
      // possessions ever reached the final third at all, which was
      // starving shot volume (and therefore goals AND keeper saves, since
      // neither can happen without a shot reaching the box first) well
      // below a real match's output. This still leaves plenty of turnovers
      // (see resolveTurnover) — it just stops the pipe from being throttled
      // this hard before the ball even reaches a dangerous area.
      let passChance = 0.80 + (passerSkill - pressure) / 130 + attMods.passAccDelta + attackTriggerBonus
        + holdBonus + (decision.action === 'switch' ? 0.05 : 0);
      if (tac === 'attack') passChance -= 0.03;
      if (tac === 'press') passChance -= 0.015;
      if (defTac === 'press') passChance -= 0.05;
      if (defTac === 'defend') passChance -= 0.03; // compact shape is harder to pass through
      // Tight Possession is specifically about composure in tight spaces
      // under close pressure — so it only matters here, against a genuine
      // high press, rather than being folded into every pass regardless of
      // context (that's what the blended passerSkill above already covers).
      if (defTac === 'press') {
        const tightPos = xattr(carrier, 'tight_pos', null);
        if (tightPos != null) passChance += ((tightPos - 70) / 100) * 0.12;
      }
      passChance = Math.max(0.30, Math.min(0.93, passChance));

      if (seededRandom() >= passChance) {
        resolveTurnover(attackingSide, defendingSide, carrier, marker, fromThird, toThird, 'pass', channel);
        return;
      }

      // ===== Duels phase: even a completed pass can be won back under =====
      // ===== immediate pressure (a 1v1 press right as the ball arrives).
      // Base raised from 0.78 -> 0.87 — see passChance above for why both
      // of these needed to come up together.
      const duelChance = Math.max(0.35, Math.min(0.95,
        0.91 + (carryingAbility(targetPlayer) - pressure) / 160 + (attMods.wingBiasMult - 1) * 0.05 - (defTac === 'press' ? 0.05 : 0) + attackTriggerBonus));
      if (seededRandom() >= duelChance) {
        resolveTurnover(attackingSide, defendingSide, targetPlayer, marker, fromThird, toThird, 'duel', channel);
        return;
      } else if (seededRandom() < 0.12) {
        addEvent(m.minute, 'skill', `✨ ${pickSkillDesc(targetPlayer, marker)}`, attackingSide);
      }

      carrier = targetPlayer;
    }

    // ===== Chance Creation phase (reached the final third) =====
    resolveChanceCreation(attackingSide, defendingSide, carrier, channel);
  }

  // ===== Secondary match texture: set pieces / handballs / VAR that the =====
  // ===== headline possession pipeline above doesn't already cover, kept at
  // a low independent rate so cards/set-pieces still accumulate realistically
  // without duplicating shots the pipeline already generated this minute.
  function maybeSecondaryMatchEvent() {
    const m = currentMatch;
    if (!m || seededRandom() > 0.22) return;
    const side = seededRandom() < 0.5 ? 'home' : 'away';
    const defSide = side === 'home' ? 'away' : 'home';
    const attTeam = m[side], defTeam = m[defSide];
    const roll = seededRandom();
    // Roll shares below were rebalanced to bring fouls/cards/handballs down
    // to realistic per-match volume: free-kick, handball, and VAR-review
    // shares are all cut well back from their original width (they were
    // independently stacking on top of the turnover-based fouls in
    // transitions.js and producing far more cards/reds than a real match),
    // with the freed-up probability mass handed to the non-foul texture
    // events (throw-ins/goal-kicks/misc) so the overall "something happens"
    // rate this function fires at is unchanged.
    if (roll < 0.10) {
      // Direct free-kick — always the consequence of an actual, logged foul
      // (never conjured out of nowhere). The fouler is picked from the
      // defending side committing a midfield/wide challenge, resolveFoul
      // handles the real foul/card bookkeeping, and only if that foul left
      // the taking side with a genuine dangerous set-piece (and didn't just
      // end in a red card stopping play) does a routine get taken —
      // resolveFreeKickRoutine (engine/setpieces.js) then picks between a
      // direct strike, a quick restart, a crossed delivery, a short
      // link-up, or an indirect routine inside the box.
      const fouler = pickPlayer(defTeam, ['CM', 'CDM', 'CB', 'RB', 'LB', 'RWB', 'LWB']);
      const victim = pickPlayer(attTeam, ['CAM', 'CM', 'ST', 'RW', 'LW']);
      if (fouler) {
        const result = resolveFoul(defSide, side, fouler, victim, false);
        if (result && result.outcome !== 'red' && result.outcome !== 'penalty' && seededRandom() < 0.35) {
          const closeRange = seededRandom() < 0.45;
          resolveFreeKickRoutine(side, defSide, closeRange);
        }
      }
    } else if (roll < 0.27) {
      // Throw-in — normal, long, or a tactical retaining throw. Whichever
      // side is more naturally in possession here is picked at random
      // (the possession pipeline above already decides the headline
      // sequence each minute, so this is deliberately independent texture).
      resolveThrowIn(seededRandom() < 0.5 ? side : defSide);
    } else if (roll < 0.44) {
      // Goal kick — taken by the side that was defending this passage,
      // short/medium/long distribution via resolveGoalKick (engine/setpieces.js).
      resolveGoalKick(defSide);
    } else if (roll < 0.49) {
      // Handball — genuinely rare in a real match (most matches see zero or
      // one shout), and the vast majority of shouts are just a regular
      // foul; only a small share are actually given as a penalty. The
      // commentary always matches what's actually awarded instead of
      // asserting a penalty and then only sometimes delivering one.
      const p = pickPlayer(defTeam, ['CB', 'RB', 'LB', 'CDM', 'ST']);
      if (p) {
        const nearBox = seededRandom() < 0.45;
        const givenAsPen = nearBox && seededRandom() < 0.22;
        if (givenAsPen) {
          addEvent(m.minute, 'handball', `Handball against <span class="player">${p.name}</span> — referee points to the spot!`, defSide);
          resolveFoul(defSide, side, p, null, true, true);
        } else {
          addEvent(m.minute, 'handball', `Appeal for handball against <span class="player">${p.name}</span>${nearBox ? ' waved away' : ' — referee says ball to hand'}`, defSide);
          resolveFoul(defSide, side, p, null, false);
        }
      }
    } else if (roll < 0.55) {
      // VAR — red-card review, most of which correctly confirm there's no
      // red. The straight-red outcome is now a genuine rarity (a real
      // match seeing a VAR-overturned red is a notable, not routine,
      // event) and still runs through the same card bookkeeping as any
      // other red so fouls/cards stats stay consistent.
      const player = pickPlayer(defTeam, ['CB', 'ST', 'CDM', 'CM']);
      addEvent(m.minute, 'var', `📺 VAR checking possible red card (${defTeam.team.short})...`, defSide);
      if (player && seededRandom() < 0.05) {
        defTeam.stats.fouls++;
        if (!m.foulCounts) m.foulCounts = { home: {}, away: {} };
        m.foulCounts[defSide][player.id] = (m.foulCounts[defSide][player.id] || 0) + 1;
        defTeam.stats.reds++;
        recordStat('cards', player, defTeam.team);
        recordStat('reds', player, defTeam.team);
        if (!m.playerMatchStats) m.playerMatchStats = {};
        if (!m.playerMatchStats[player.id]) m.playerMatchStats[player.id] = blankPlayerMatchStats(player);
        m.playerMatchStats[player.id].red = true;
        addEvent(m.minute, 'red', `VAR: Red card! <span class="player">${player.name}</span> (${defTeam.team.short}) sent off`, defSide);
        removeFromPitch(defSide, player.id);
        handleRedCardReshuffle(defSide, player);
      } else {
        const noRedLines = [
          `VAR: No red card — challenge by ${player ? player.name : 'the defender'} was mistimed but not violent conduct`,
          `VAR: Yellow card only — ${player ? player.name : 'player'} caught the man, not excessive force`,
          `VAR: On-field decision stands — no red card for ${player ? player.name : 'the defender'}`
        ];
        addEvent(m.minute, 'var', noRedLines[Math.floor(seededRandom() * noRedLines.length)], defSide);
        if (player && seededRandom() < 0.35 && (m.cards[defSide][player.id] || 0) < 1) {
          m.cards[defSide][player.id] = (m.cards[defSide][player.id] || 0) + 1;
          defTeam.stats.yellows++;
          recordStat('yellows', player, defTeam.team);
          if (!m.playerMatchStats) m.playerMatchStats = {};
          if (!m.playerMatchStats[player.id]) m.playerMatchStats[player.id] = blankPlayerMatchStats(player);
          m.playerMatchStats[player.id].yellow = true;
          addEvent(m.minute, 'yellow', `${emojiImg('yellow_card', 'Yellow card')} Yellow card — <span class="player">${player.name}</span> booked after VAR review`, defSide);
        }
      }
    } else if (roll < 0.78) {
      const att = pickPlayer(attTeam, ['ST', 'CAM', 'RW', 'LW', 'CM']);
      const def = pickPlayer(defTeam, ['CB', 'RB', 'LB', 'CDM']);
      const rare = seededRandom();
      if (rare < 0.2) {
        addEvent(m.minute, 'whistle', `Rain starts to lash the pitch — footing becomes tricky`, null);
      } else if (rare < 0.4 && def) {
        if (!m.playerMatchStats) m.playerMatchStats = {};
        if (!m.playerMatchStats[def.id]) m.playerMatchStats[def.id] = blankPlayerMatchStats(def);
        m.playerMatchStats[def.id].tackles = (m.playerMatchStats[def.id].tackles || 0) + 1;
        const tackleFlavor = styleFlavor(def, TACKLE_FLAVOR) || 'times a sliding tackle to perfection on the edge of the box';
        addEvent(m.minute, 'tackle', `<span class="player">${def.name}</span> ${tackleFlavor}`, defSide);
      } else if (rare < 0.6 && att) {
        const passFlavor = styleFlavor(att, THROUGH_BALL_FLAVOR) || 'threads a defence-splitting ball into the channel';
        addEvent(m.minute, 'pass', `<span class="player">${att.name}</span> ${passFlavor}`, side);
      } else if (rare < 0.8) {
        const gk = pickPlayer(defTeam, ['GK']);
        if (gk) {
          defTeam.stats.saves++;
          recordStat('saves', gk, defTeam.team);
          if (!m.playerMatchStats) m.playerMatchStats = {};
          if (!m.playerMatchStats[gk.id]) m.playerMatchStats[gk.id] = blankPlayerMatchStats(gk);
          m.playerMatchStats[gk.id].saves = (m.playerMatchStats[gk.id].saves || 0) + 1;
          addEvent(m.minute, 'save', `<span class="player">${gk.name}</span> rushes off the line to smother a through ball`, defSide);
        }
      } else {
        addEvent(m.minute, 'whistle', `The crowd sense a goal — noise levels rise as ${attTeam.team.short} advance`, null);
      }
    } else {
      const lines = [
        `${attTeam.team.short} recycle possession in the final third`,
        `${attTeam.team.short} work an opening down the flank`,
        `Patient build-up from ${attTeam.team.short}`,
        `${defTeam.team.short} hold a high line under pressure`,
        `Cross claimed comfortably — ${defTeam.team.short} clear`
      ];
      addEvent(m.minute, 'pressure', lines[Math.floor(seededRandom() * lines.length)], side);
    }
  }

  // ===== Top-level per-minute orchestrator: Possession phase decides who =====
  // ===== gets this minute's headline sequence, then hands off to the
  // Zones->Movement->Passing->Duels->Transitions->Chance->Shots->GK pipeline.
  function generateEvents() {
    const m = currentMatch;
    if (!m) return;

    // ---- Background per-minute stat accumulation (pass volume + off-ball
    // defensive activity), independent of which side wins the headline
    // sequence below — this is what keeps every outfield player's pass/
    // tackle counts building up realistically across 90 minutes.
    simulateMinutePassing();
    simulateDefensiveActions();

    const homeStr = calcTeamStrength(m.home);
    const awayStr = calcTeamStrength(m.away);
    const homeMods = getPlaystyleMods(m.home.team);
    const awayMods = getPlaystyleMods(m.away.team);

    // ===== Possession phase: which side's build-up is this minute's =====
    // ===== headline sequence? Driven by attacking quality vs the opponent's
    // defensive quality, run through a logistic curve so a genuine quality
    // gap (a title contender's front line vs a relegation-battler's back
    // line) shows up clearly over 90 minutes/a season, while a small home
    // nudge and a soft floor/ceiling keep upsets possible.
    const mgrEdge = (homeStr.mgr - awayStr.mgr) * 0.15;
    let homeCreate = homeStr.att * 0.62 + (100 - awayStr.def) * 0.28 + homeStr.ovr * 0.10;
    let awayCreate = awayStr.att * 0.62 + (100 - homeStr.def) * 0.28 + awayStr.ovr * 0.10;
    // Game-state realism: a team chasing the game late pushes players forward
    // and creates more (higher risk, higher reward); one nursing a lead sits in.
    if ((m.dispMin != null ? m.dispMin : m.minute) > 55) {
      const dm = m.dispMin != null ? m.dispMin : m.minute;
      const diff = (m.home.score || 0) - (m.away.score || 0);
      const urgency = Math.min(1, (dm - 55) / 35);
      if (diff <= -1) homeCreate += Math.min(10, Math.abs(diff) * 4) * urgency;
      else if (diff >= 1) homeCreate -= Math.min(6, diff * 2.5) * urgency;
      if (diff >= 1) awayCreate += Math.min(10, diff * 4) * urgency;
      else if (diff <= -1) awayCreate -= Math.min(6, Math.abs(diff) * 2.5) * urgency;
    }
    const HOME_ADV = 4.0;
    const jitter = (seededRandom() - 0.5) * 7; // real ebb-and-flow, not a static edge all 90 minutes
    const qualityGap = (homeCreate - awayCreate) + HOME_ADV + mgrEdge + jitter;
    let homeChance = 1 / (1 + Math.exp(-qualityGap / 13));
    homeChance = Math.min(0.90, Math.max(0.10, homeChance));

    // Possession % derived from actual completed-pass share (like real match
    // data providers compute it), tugged toward the side with the real
    // ball-control edge and smoothed minute to minute.
    const hp = m.home.stats.passes || 0, ap = m.away.stats.passes || 0;
    const passShareTarget = (hp + ap) > 0 ? 100 * hp / (hp + ap) : 50;
    const ctrlBias = Math.max(-14, Math.min(14, (((homeStr.tec * 0.55 + homeStr.ovr * 0.25 + (homeStr.mgr || 75) * 0.20)
      - (awayStr.tec * 0.55 + awayStr.ovr * 0.25 + (awayStr.mgr || 75) * 0.20)) * 0.9) + 1.5));
    const styleBias = Math.max(-8, Math.min(8, (homeMods.possBias - awayMods.possBias) * 0.5));
    const target = Math.max(20, Math.min(80, passShareTarget * 0.62 + (50 + ctrlBias + styleBias) * 0.38));
    m.possession = m.possession + (target - m.possession) * 0.16 + (seededRandom() - 0.5) * 1.2;
    m.possession = Math.max(18, Math.min(82, m.possession));
    m.home.stats.possession = Math.round(m.possession);
    m.away.stats.possession = 100 - m.home.stats.possession;

    // Stronger teams create more moments — some minutes are just quiet.
    const intensity = 0.42 + (homeStr.ovr + awayStr.ovr) / 500;
    if (seededRandom() > intensity) {
      if (seededRandom() < 0.08) {
        const side = seededRandom() < 0.5 ? m.home : m.away;
        const p = pickPlayer(side, ['CM', 'CDM', 'CAM', 'CB']);
        if (p) {
          const quiet = [
            `<span class="player">${p.name}</span> recycles possession calmly`,
            `<span class="player">${p.name}</span> breaks up the play and resets`,
            `<span class="player">${p.name}</span> switches the point of attack`,
            `<span class="player">${p.name}</span> finds a teammate under no pressure`,
            `Spell of possession — <span class="player">${p.name}</span> dictates the tempo`
          ];
          addEvent(m.minute, 'pass', quiet[Math.floor(seededRandom() * quiet.length)], side === m.home ? 'home' : 'away');
        }
      }
      maybeSecondaryMatchEvent();
      return;
    }

    // ===== Hand off to the phase pipeline: Zones -> Movement -> Passing -> =====
    // ===== Duels -> Transitions -> Chance Creation -> Shots -> GK, all
    // shaped by real player attributes and each side's tactics/playstyle.
    const attackingSide = seededRandom() < homeChance ? 'home' : 'away';
    runPossessionSequence(attackingSide);

    // Occasional independent texture (set pieces / cards / VAR) at a low
    // rate so the match keeps its color beyond just the headline sequence.
    maybeSecondaryMatchEvent();
  }

  // ---- Opening-instructions AI: what a manager sets up with at kickoff,
  // driven by the actual quality gap between the two sides plus identity —
  // not a flat "balanced" default that made every kickoff feel the same.
  function decideOpeningTactic(selfStr, oppStr, style) {
    const gap = (selfStr.ovr || 75) - (oppStr.ovr || 75);
    const counterMinded = ['Quick Counter', 'Long Ball Counter', 'Long Ball'].includes(style);
    const possessionMinded = style === 'Possession';
    if (gap <= -4) return seededRandom() < 0.6 ? 'defend' : 'balanced';
    if (gap >= 5) return seededRandom() < (possessionMinded ? 0.65 : 0.5) ? (possessionMinded ? 'press' : 'attack') : 'balanced';
    if (counterMinded && gap < 2) return seededRandom() < 0.35 ? 'defend' : 'balanced';
    if (possessionMinded) return seededRandom() < 0.4 ? 'press' : 'balanced';
    return 'balanced';
  }

  function calcTeamStrength(side) {
    if (!currentMatch || !side) return { att: 50, def: 50, tec: 50 };
    const isHome = side === currentMatch.home;
    const ids = isHome ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    const onPitch = (side.squad.all || []).filter(p => ids.includes(p.id));
    if (!onPitch.length) return { att: 50, def: 50, tec: 50 };
    const mgr = (side.team.manager && side.team.manager.ovr) || 75;
    const pmods = getPlaystyleMods(side.team);
    const avg = (key, fallback) => onPitch.reduce((s, p) => s + (p[key] != null ? p[key] : fallback), 0) / onPitch.length;
    // Small, realistic home-field boost — crowd support and matchday familiarity
    // lift a side's sharpness a touch, on both ends of the pitch.
    const homeBoostAtt = isHome ? 1.2 : 0;
    const homeBoostDef = isHome ? 1.0 : 0;
    // ---- Formation shape now feeds directly into team strength: an
    // attack-heavy formation (extra forwards/wide bodies) lifts att at the
    // cost of def, a defensive shape (extra CBs/wing-backs, fewer forwards)
    // does the reverse, and a midfield-heavy shape nudges control (tec).
    const shape = formationShape(side.squad && side.squad.formation);
    const attShape = (shape.fwd - SHAPE_BASELINE.fwd) * 1.6 + (shape.mid - SHAPE_BASELINE.mid) * 0.25;
    const defShape = (shape.def - SHAPE_BASELINE.def) * 1.7 - (shape.fwd - SHAPE_BASELINE.fwd) * 0.35 + (shape.mid - SHAPE_BASELINE.mid) * 0.15;
    const midShape = (shape.mid - SHAPE_BASELINE.mid) * 0.4;
    return {
      // Manager overall now carries real weight: a top tactician visibly lifts
      // both ends of the pitch, a poor one visibly drags them down.
      att: avg('att', 70) + (mgr - 75) * 0.18 + pmods.attBonus + homeBoostAtt + attShape,
      def: avg('def', 70) + (mgr - 75) * 0.16 + pmods.defBonus + homeBoostDef + defShape,
      tec: avg('tec', 70) + midShape,
      ovr: avg('ovr', 75),
      phy: avg('phy', 70),
      pac: avg('pac', 70),
      mgr: mgr,
      shape: shape
    };
  }

  function pickPlayer(side, preferredPos, excludeId, zoneKey) {
    if (!currentMatch || !side) return null;
    const ids = side === currentMatch.home ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    let pool = (side.squad.all || []).filter(p => ids.includes(p.id) && p.id !== excludeId);
    if (preferredPos && preferredPos.length) {
      const preferred = pool.filter(p => (p.pos || []).some(pos => preferredPos.includes(pos)) || preferredPos.includes(p.slot));
      if (preferred.length) pool = preferred;
    }
    if (!pool.length) return null;
    // Weight selection toward higher-quality players (mild curve — this
    // path covers secondary events like corners/fouls, so quality should
    // nudge things without dominating the way it does for the main
    // goal/assist picker above). Specific attributes (att/tec) outweigh the
    // single overall number, same principle as the main picker below —
    // a player's actual finishing/technical ability should matter more than
    // the one flattened rating.
    const weights = pool.map(p => {
      const composite = (p.att || 70) * 0.6 + (p.tec || 70) * 0.4 + (p.ovr || 70) * 0.5;
      // Offensive Awareness is specifically about finding space/making
      // yourself available when the team is attacking — so it nudges how
      // often a player gets found at all, on top of (not instead of) the
      // raw ability composite above.
      const offAwr = p.expandedAttrs ? xattr(p, 'off_awr', null) : null;
      const offAwrNudge = offAwr != null ? (offAwr - 70) * 0.15 : 0;
      let w = Math.pow(Math.max(composite + offAwrNudge, 40) / 92, 1.4) * 92;
      // Playstyle-driven pitch positioning: only applied when the caller
      // actually supplies a zoneKey (the possession pipeline's zone-based
      // carrier/target selection) — every other pickPlayer() call site
      // (corners, fouls, throw-ins, etc.) is unaffected since it never
      // passes one.
      if (zoneKey) w *= zoneAffinityMultiplier(p, zoneKey);
      return Math.max(5, w);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = seededRandom() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }
  // Marking/pressure selection for the possession pipeline. Distinct from
  // pickPlayer() above on purpose: pickPlayer's composite leans on
  // attacking ability (att/tec) which is the right read for "who gets
  // found/scores/assists", but the wrong one for "who's actually the man
  // closing this ball carrier down" — that used to mean whichever nearby
  // player had the flashiest attacking numbers (often, confusingly, an
  // elite CDM with strong all-around ratings) got selected as marker
  // essentially every time. This weights by genuine defensive quality
  // instead, and applies the same playstyle zone affinity so a screening
  // Anchor Man/Destroyer is realistically the one found there.
  function pickMarker(side, preferredPos, excludeId, zoneKey) {
    if (!currentMatch || !side) return null;
    const ids = side === currentMatch.home ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    let pool = (side.squad.all || []).filter(p => ids.includes(p.id) && p.id !== excludeId);
    if (preferredPos && preferredPos.length) {
      const preferred = pool.filter(p => (p.pos || []).some(pos => preferredPos.includes(pos)) || preferredPos.includes(p.slot));
      if (preferred.length) pool = preferred;
    }
    if (!pool.length) return null;
    const weights = pool.map(p => {
      const defAwr = xattr(p, 'def_awr', null);
      const tack = xattr(p, 'tack', null);
      const defEng = xattr(p, 'def_eng', null);
      const composite = (defAwr != null && tack != null && defEng != null)
        ? (defAwr * 0.4 + tack * 0.35 + defEng * 0.25)
        : ((p.def || 70) * 0.75 + (p.ovr || 70) * 0.25);
      let w = Math.pow(Math.max(composite, 40) / 85, 1.3) * 85;
      if (zoneKey) w *= zoneAffinityMultiplier(p, zoneKey);
      return Math.max(5, w);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = seededRandom() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  // Realistic role tendencies: strikers/wingers get on the scoresheet far more
  // than they create, while attacking mids/central mids are the primary creators.
  // Defenders/holding mids chip in occasionally (set pieces, late runs) but rarely lead scoring.
  // NOTE: these weights combine multiplicatively with each player's own attributes
  // (att/ovr/tec) in pickPlayerWeighted, and strikers/wingers already carry higher
  // 'att' ratings than midfielders. A wide spread here compounds with that and makes
  // strikers score far more than real-world scoring share (~ST 35-40%, wide/CAM
  // ~35-40%, CM/deep ~15-20%, defenders ~5-8%). Keep the spread modest.
  const GOAL_ROLE_WEIGHT = { ST: 1.9, CF: 1.9, RW: 1.7, LW: 1.7, CAM: 1.4, RM: 1.25, LM: 1.25, CM: 0.85, CDM: 0.45, RWB: 0.35, LWB: 0.35, RB: 0.3, LB: 0.3, CB: 0.2, GK: 0.01 };
  const ASSIST_ROLE_WEIGHT = { CAM: 2.0, CM: 1.75, RW: 1.65, LW: 1.65, RM: 1.4, LM: 1.4, ST: 1.0, CF: 1.0, CDM: 0.85, RWB: 0.8, LWB: 0.8, RB: 0.8, LB: 0.8, CB: 0.25, GK: 0.02 };
  // Penalty duty in real football overwhelmingly goes to strikers/wingers, with the
  // occasional attacking mid; deep midfielders almost never take them.
  const PEN_TAKER_ROLE_WEIGHT = { ST: 3.3, CF: 3.3, RW: 2.5, LW: 2.5, CAM: 1.0, RM: 0.7, LM: 0.7, CM: 0.3, CDM: 0.1, CB: 0.05 };

  // Like pickPlayer, but multiplies selection weight by a role-tendency table so
  // (for example) strikers/wingers are picked as goalscorers far more often than
  // central/defensive midfielders, matching real-world scoring distributions.
  function pickPlayerWeighted(side, preferredPos, roleWeights, excludeId) {
    if (!currentMatch || !side) return null;
    const ids = side === currentMatch.home ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    let pool = (side.squad.all || []).filter(p => ids.includes(p.id) && p.id !== excludeId);
    if (preferredPos && preferredPos.length) {
      const preferred = pool.filter(p => (p.pos || []).some(pos => preferredPos.includes(pos)) || preferredPos.includes(p.slot));
      if (preferred.length) pool = preferred;
    }
    if (!pool.length) return null;
    const weights = pool.map(p => {
      const slot = p.slot || (p.pos || [])[0] || 'CM';
      const roleW = (roleWeights && roleWeights[slot] != null) ? roleWeights[slot] : 1;
      // Composite quality (0-100ish scale). Raised to a modest power so real
      // separation in ability (a Mbappe/Haaland-tier ovr/att/tec vs a squad
      // fill-in) compounds into a clearly higher share of goals/assists over
      // a season — like real-world Golden Boot races — without ever reducing
      // a lesser player's chance to zero on any single kick. This is
      // symmetric for every player regardless of club, so it favors quality,
      // not any particular team. Att + tec (a player's actual finishing and
      // technical ability) together outweigh the flat ovr number — a
      // specialist finisher should out-score a jack-of-all-trades with the
      // same overall rating, not just whoever has the bigger single number.
      const composite = (p.att || 70) * 0.45 + (p.tec || 70) * 0.25 + (p.ovr || 70) * 0.30;
      const w = Math.pow(Math.max(composite, 30) / 70, 2.2) * 100 * roleW;
      return Math.max(1, w);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = seededRandom() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }


  function trySubstitution(side) {
    const m = currentMatch;
    if (!m) return;
    const sideData = m[side];
    const otherSide = side === 'home' ? 'away' : 'home';
    const oppData = m[otherSide];
    const used = side === 'home' ? m.homeSubsUsed : m.awaySubsUsed;
    if (used >= (m.maxSubs || 5)) return;
    if (!m.leftPitch) m.leftPitch = { home: [], away: [] };
    const leftIds = m.leftPitch[side] || (m.leftPitch[side] = []);
    if (!m.subLog) m.subLog = { home: {}, away: {} };
    if (!m.cards) m.cards = { home: {}, away: {} };
    const onPitchIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    // Game-state context: is this side chasing the game or protecting a
    // lead late on? Drives which line gets sacrificed and what comes on,
    // so a losing side's subs read as "throwing men forward" and a
    // winning side's subs read as genuine game management — not the same
    // like-for-like swap regardless of the scoreline.
    const diff = (sideData.score || 0) - ((m[otherSide] || {}).score || 0);
    const chasing = diff <= -1 && (m.dispMin != null ? m.dispMin : m.minute) >= 60;
    const protectingLead = diff >= 1 && (m.dispMin != null ? m.dispMin : m.minute) >= 72;
    // Anyone currently on pitch (starter or previous sub)
    const allPlayers = [...(sideData.squad.starting || []), ...(sideData.squad.subs || [])];
    const onPitch = allPlayers.filter(p => onPitchIds.includes(p.id) && !m.injuries.includes(p.id));
    // Prefer lower rated / tired-looking out. Exclude GKs, and — normally —
    // exclude players who already came on as a substitute themselves, since a
    // manager doesn't typically sub off a sub they just brought on. Fall back
    // to including them only if there's genuinely no other outfield option.
    const alreadySubbedIn = (p) => !!(m.subLog[side] && m.subLog[side][p.id] && m.subLog[side][p.id].inMin != null);
    let outfieldPool = onPitch.filter(p => (p.slot || (p.pos||[])[0]) !== 'GK');
    let freshPool = outfieldPool.filter(p => !alreadySubbedIn(p));
    let pool = freshPool.length ? freshPool : outfieldPool;
    // Chasing the game: the sacrifice comes from the back/deep midfield to
    // free up a spot for fresh legs further forward. Protecting a lead: the
    // sacrifice comes from the front line to bring on defensive cover.
    if (chasing) {
      const backPool = pool.filter(p => lineOf(p) === 'DEF' || lineOf(p) === 'MID');
      if (backPool.length) pool = backPool;
    } else if (protectingLead) {
      const frontPool = pool.filter(p => lineOf(p) === 'FWD' || lineOf(p) === 'MID');
      if (frontPool.length) pool = frontPool;
    }

    // ---- Composite "who comes off" score -----------------------------
    // Real managerial reasoning folded into one weighted pick instead of a
    // single "lowest OVR for their line" heuristic: raw fatigue, the real
    // risk of a second yellow costing the side a man, how the player has
    // actually performed so far this match, a genuine tactical mismatch
    // against this specific opponent, plus the scoreline/line-weight bias
    // the engine already had.
    const oppStr = calcTeamStrength(oppData);
    const LINE_SUB_WEIGHT = chasing ? { FWD: 0.5, MID: 1.1, DEF: 1.4, GK: 0 }
      : protectingLead ? { FWD: 1.5, MID: 1.1, DEF: 0.3, GK: 0 }
      : { FWD: 1.3, MID: 1.15, DEF: 0.65, GK: 0 };
    const scored = pool.map(p => {
      const line = lineOf(p);
      let score = Math.max(0.15, (96 - (p.ovr || 70)) * (LINE_SUB_WEIGHT[line] || 1));
      // Fatigue: a genuinely gassed player (see engine/fatigue.js) is a
      // strong candidate to come off, and increasingly so as the second
      // half wears on.
      const stamina = getStamina(m, side, p.id);
      if ((m.dispMin != null ? m.dispMin : m.minute) >= 58) score += Math.max(0, 72 - stamina) * 0.55;
      // Second-yellow risk: booked earlier and still out there for a
      // fast/aggressive closing stretch is exactly the profile that ends
      // up costing the team a man — pull them before that happens rather
      // than reacting to it after.
      const hasYellow = (m.cards[side] && m.cards[side][p.id]) >= 1;
      if (hasYellow && (m.dispMin != null ? m.dispMin : m.minute) >= 55) score += 24 + Math.min(20, ((m.dispMin != null ? m.dispMin : m.minute) - 55) * 0.6);
      // Poor match rating so far — a genuinely bad game, not just tired or
      // booked. Only weighed once there's enough of a sample to mean
      // anything.
      const ps = m.playerMatchStats && m.playerMatchStats[p.id];
      if (ps && ((ps.passes || 0) + (ps.tackles || 0) + (ps.shots || 0)) >= 5) {
        const liveRating = calcPlayerRating(Object.assign({}, ps, { pos: p.slot || (p.pos || [])[0] }));
        if (liveRating < 6.2) score += (6.2 - liveRating) * 14;
      }
      // Tactical mismatch: a defender being physically overrun by a
      // quicker opposing attack, or a midfielder outclassed technically by
      // the opposing midfield, reads as a player who needs help now.
      if (line === 'DEF' && (oppStr.pac || 70) - (p.pac || 70) >= 10) score += 10;
      if (line === 'MID' && (oppStr.tec || 70) - (p.tec || 70) >= 10) score += 8;
      return { p, w: score, stamina, hasYellow };
    });
    const totalW = scored.reduce((s, x) => s + x.w, 0);
    let outPick = null;
    if (totalW > 0) {
      let r = seededRandom() * totalW;
      for (const x of scored) { r -= x.w; if (r <= 0) { outPick = x; break; } }
    }
    if (!outPick) outPick = scored[Math.floor(seededRandom() * scored.length)];
    if (!outPick) return;
    const outPlayer = outPick.p;

    // A substitute can only come from the bench, must not already be on the
    // pitch, and — critically — must never have left the pitch already this
    // match (whether as a starter subbed off, a substitute subbed off again,
    // or a player sent off/injured out).
    const availableSubs = (sideData.squad.subs || []).filter(p =>
      !onPitchIds.includes(p.id) && !m.injuries.includes(p.id) && !leftIds.includes(p.id));
    if (!availableSubs.length) return;

    // Tiered matching so the incoming player is a genuine like-for-like
    // replacement: exact slot first, then anyone who shares the outgoing
    // player's position line (defender for defender, forward for forward),
    // and only loosen to broad position-compatibility or "whoever's left" if
    // the bench truly has nothing closer. Chasing/protecting a lead can
    // override this with a deliberate change of line (attacker on for a
    // defender, or vice versa) when the bench actually offers one.
    const outSlot = outPlayer.slot || (outPlayer.pos || [])[0] || 'CM';
    const outLine = lineOf(outPlayer);
    let candidatesIn = availableSubs.filter(p => (p.slot || (p.pos || [])[0]) === outSlot);
    let matchedOwnPosition = true;
    let tacticalChange = false;
    if (chasing) {
      // Only throw an EXTRA attacker forward (converting what would've
      // been a MID/DEF-for-MID/DEF swap into a FWD coming on) if the
      // attackers already out there are actually running low on legs.
      // Fresh, fit forwards don't get reinforced just because the
      // scoreline says "chasing" — a manager doesn't load up on
      // attackers who are still doing fine. If the current front line is
      // fit, this branch is skipped entirely: the substitution falls
      // through to the normal like-for-like tiers below, and if the
      // bench has nothing that fits THOSE either, no substitution
      // happens this call (see the "no further fallback" comment below).
      const onPitchAttackers = onPitch.filter(p => lineOf(p) === 'FWD');
      const avgAttackerStamina = onPitchAttackers.length
        ? onPitchAttackers.reduce((s, p) => s + getStamina(m, side, p.id), 0) / onPitchAttackers.length
        : 100;
      const attackersNeedFreshening = avgAttackerStamina < 68;
      const attackers = availableSubs.filter(p => lineOf(p) === 'FWD');
      if (attackers.length && outLine !== 'FWD' && attackersNeedFreshening) { candidatesIn = attackers; matchedOwnPosition = false; tacticalChange = true; }
    } else if (protectingLead) {
      const defenders = availableSubs.filter(p => lineOf(p) === 'DEF' || (lineOf(p) === 'MID' && (p.slot === 'CDM' || (p.pos||[]).includes('CDM'))));
      if (defenders.length && outLine !== 'DEF') { candidatesIn = defenders; matchedOwnPosition = false; tacticalChange = true; }
    }
    if (!candidatesIn.length) { candidatesIn = availableSubs.filter(p => lineOf(p) === outLine); tacticalChange = false; }
    if (!candidatesIn.length) { candidatesIn = availableSubs.filter(p => canPlay(p, outSlot)); matchedOwnPosition = false; tacticalChange = false; }
    // No further fallback: a manager doesn't send on a player who can't
    // actually play anywhere near the role being vacated. If the bench
    // genuinely offers nobody position-compatible, skip this substitution
    // rather than force someone into a position they're not comfortable
    // in — trySubstitution() gets called again on later minutes (see
    // engine/matchEngine.js), so a fitting sub can still happen once one
    // becomes available (e.g. after a different sub or in a wider window).
    if (!candidatesIn.length) return;

    // Positional need on top of raw quality: if this line is specifically
    // being outrun by the opponent (the same mismatch signal that pushed
    // this player toward being subbed off in the first place), prefer the
    // bench option with real recovery pace to counter it rather than just
    // the highest OVR among the tiered candidates.
    const needsPace = outLine === 'DEF' && (oppStr.pac || 70) - (outPlayer.pac || 70) >= 10;
    candidatesIn = candidatesIn.slice().sort((a, b) => {
      if (needsPace) {
        const d = (b.pac || 70) - (a.pac || 70);
        if (Math.abs(d) >= 4) return d;
      }
      return (b.ovr || 70) - (a.ovr || 70);
    });
    const top = candidatesIn.slice(0, Math.min(3, candidatesIn.length));
    const inPlayer = top[Math.floor(seededRandom() * top.length)];
    const idx = onPitchIds.indexOf(outPlayer.id);
    if (idx >= 0) onPitchIds[idx] = inPlayer.id;
    markLeftPitch(m, side, outPlayer.id);
    resetFatigueFor(m, side, inPlayer.id);
    if (side === 'home') m.homeSubsUsed++; else m.awaySubsUsed++;
    const subDispMin = m.dispMin != null ? m.dispMin : m.minute;
    m.subLog[side][outPlayer.id] = Object.assign({}, m.subLog[side][outPlayer.id] || {}, { outMin: subDispMin, replacedBy: inPlayer.name });
    m.subLog[side][inPlayer.id] = Object.assign({}, m.subLog[side][inPlayer.id] || {}, { inMin: subDispMin, replaced: outPlayer.name });
    // The substitute inherits the outgoing player's exact pitch slot
    // (outSlot) whenever they're actually comfortable there — the normal
    // like-for-like case, and also what keeps the on-pitch rendering
    // correctly index-aligned (see buildSquad() in ui/teamUI.js and
    // drawTeam() in ui/matchUI.js). For a deliberate tactical change
    // (tacticalChange above — an attacker on for a defender or vice
    // versa), the incoming player is picked specifically because they're
    // NOT the same kind of player as who's going off, so forcing them
    // into outSlot would be exactly the "playing out of position" bug
    // this is fixing; pickSlotForIncomingSub() gives them their own
    // natural slot within the current formation instead (falling back to
    // any formation slot they can actually play if their exact position
    // isn't part of this shape).
    inPlayer.slot = pickSlotForIncomingSub(inPlayer, sideData.squad.formation, outSlot, onPitch.filter(p => p.id !== outPlayer.id));
    const tag = tacticalChange ? (chasing ? ' <span style="opacity:0.6">(attacking change)</span>' : ' <span style="opacity:0.6">(defensive change)</span>') : '';
    // Surface the real reason behind a notable change (booked/tiring) in
    // the event log, same spirit as the tactical tag above.
    const reasonBits = [];
    if (outPick.hasYellow && (m.dispMin != null ? m.dispMin : m.minute) >= 55) reasonBits.push('booked, managing risk');
    if (outPick.stamina < 40) reasonBits.push('tiring');
    const reasonTag = reasonBits.length ? ` <span style="opacity:0.55">(${reasonBits.join(', ')})</span>` : '';
    addEvent(m.minute, 'sub',
      `Substitution · ${sideData.team.short}${tag}${reasonTag}<br><span style="color:#4ade80">▲ In</span> <span class="player">${inPlayer.name}</span><br><span style="color:#f87171">▼ Out</span> <span class="player">${outPlayer.name}</span> <span style="opacity:0.6">(${used+1}/${m.maxSubs})</span>`,
      side);
    if (!m.quietSim) { renderLineups(); renderPitch(); }
  }

  // A manager who's just gone down to 10 men often reshapes rather than just
  // absorbing the loss — most commonly sacrificing an attacker to bring on a
  // recognised defender when the sent-off player was part of the back line,
  // to restore defensive numbers. This is a reaction, not a guarantee: it
  // only fires for a lost defender, needs a defender left on the bench, and
  // doesn't happen every single time (some managers/situations just play on).
  function handleRedCardReshuffle(side, sentOffPlayer) {
    const m = currentMatch;
    if (!m || !sentOffPlayer || m.finished) return;
    if (lineOf(sentOffPlayer) !== 'DEF') return;
    const used = side === 'home' ? m.homeSubsUsed : m.awaySubsUsed;
    if (used >= (m.maxSubs || 5)) return;
    if (seededRandom() > 0.72) return;
    const sideData = m[side];
    const onPitchIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    if (!m.leftPitch) m.leftPitch = { home: [], away: [] };
    const leftIds = m.leftPitch[side] || (m.leftPitch[side] = []);
    const availableSubs = (sideData.squad.subs || []).filter(p =>
      !onPitchIds.includes(p.id) && !m.injuries.includes(p.id) && !leftIds.includes(p.id));
    const benchDef = availableSubs.filter(p => lineOf(p) === 'DEF').sort((a, b) => (b.ovr || 70) - (a.ovr || 70));
    if (!benchDef.length) return; // no defensive cover available on the bench
    const inPlayer = benchDef[0];

    // Sacrifice the most advanced remaining outfield player to restore
    // defensive numbers — a forward first, then a midfielder, mirroring how
    // real managers reshape after going down to 10 men.
    const allPlayers = [...(sideData.squad.starting || []), ...(sideData.squad.subs || [])];
    const onPitch = allPlayers.filter(p => onPitchIds.includes(p.id) && !m.injuries.includes(p.id));
    if (!m.subLog) m.subLog = { home: {}, away: {} };
    const alreadySubbedIn = (p) => !!(m.subLog[side] && m.subLog[side][p.id] && m.subLog[side][p.id].inMin != null);
    let candidatesOut = onPitch.filter(p => lineOf(p) === 'FWD' && !alreadySubbedIn(p));
    if (!candidatesOut.length) candidatesOut = onPitch.filter(p => lineOf(p) === 'FWD');
    if (!candidatesOut.length) candidatesOut = onPitch.filter(p => lineOf(p) === 'MID' && !alreadySubbedIn(p));
    if (!candidatesOut.length) candidatesOut = onPitch.filter(p => lineOf(p) === 'MID');
    if (!candidatesOut.length) return; // nothing sensible to sacrifice — leave it
    candidatesOut.sort((a, b) => (a.ovr || 70) - (b.ovr || 70));
    const outPlayer = candidatesOut[0];

    const idx = onPitchIds.indexOf(outPlayer.id);
    if (idx >= 0) onPitchIds[idx] = inPlayer.id;
    markLeftPitch(m, side, outPlayer.id);
    resetFatigueFor(m, side, inPlayer.id);
    if (side === 'home') m.homeSubsUsed++; else m.awaySubsUsed++;
    const subDispMin = m.dispMin != null ? m.dispMin : m.minute;
    m.subLog[side][outPlayer.id] = Object.assign({}, m.subLog[side][outPlayer.id] || {}, { outMin: subDispMin, replacedBy: inPlayer.name });
    m.subLog[side][inPlayer.id] = Object.assign({}, m.subLog[side][inPlayer.id] || {}, { inMin: subDispMin, replaced: outPlayer.name });
    // Same fix as the regular substitution above: the incoming defender
    // takes over a slot they can actually play — the sacrificed
    // forward/midfielder's exact slot if the defender is comfortable
    // there, otherwise their own natural defensive slot within the
    // current formation — rather than being forced into an attacking
    // slot they have no business playing.
    inPlayer.slot = pickSlotForIncomingSub(inPlayer, sideData.squad.formation, outPlayer.slot || (outPlayer.pos || ['CB'])[0], onPitch.filter(p => p.id !== outPlayer.id));
    const newUsed = side === 'home' ? m.homeSubsUsed : m.awaySubsUsed;
    addEvent(m.minute, 'sub',
      `Tactical reshuffle · ${sideData.team.short} reorganise after going down to 10 men<br><span style="color:#4ade80">▲ In</span> <span class="player">${inPlayer.name}</span> <span style="opacity:0.6">(defensive cover)</span><br><span style="color:#f87171">▼ Out</span> <span class="player">${outPlayer.name}</span> <span style="opacity:0.6">(${newUsed}/${m.maxSubs})</span>`,
      side);
    if (!m.quietSim) { renderLineups(); renderPitch(); }
  }

  function changeFormationLive(side, formKey) {
    const m = currentMatch;
    if (!m || m.finished) return false;
    if (!FORMATIONS[formKey]) return false;
    const sideData = m[side];
    const onIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const all = [...(sideData.squad.starting||[]), ...(sideData.squad.subs||[])];
    const onPitch = onIds.map(id => all.find(p => p.id === id)).filter(Boolean);

    // Gate the whole reshape on every current player actually being able
    // to fill a slot in the new shape — a real manager doesn't switch
    // formation if it leaves one of his own players stranded out of
    // position. matchPlayersToFormation() finds a genuine full matching
    // (not just a greedy best-fit that can wrongly fail or wrongly
    // force a mismatch), so this is the single source of truth both for
    // "can we do this" and, if so, "who goes where".
    const assignment = matchPlayersToFormation(onPitch, formKey);
    if (!assignment) {
      toast(sideData.team.short + ': squad not comfortable in ' + formKey + ' — formation change skipped');
      // The native <select> already shows the rejected formation (the
      // user just picked it) even though squad.formation never changed —
      // snap it back immediately rather than leaving it out of sync until
      // the next natural renderLineups() call.
      const selEl = document.getElementById('live-form-' + side);
      if (selEl) selEl.value = sideData.squad.formation || '4-3-3';
      return false;
    }

    sideData.squad.formation = formKey;
    const slots = FORMATIONS[formKey].slots;
    assignment.forEach((playerIdx, slotIdx) => {
      if (playerIdx === -1) return;
      onPitch[playerIdx].slot = slots[slotIdx];
    });
    addEvent(m.minute, 'whistle', `📐 ${sideData.team.short} switch shape to ${formKey}`, side);
    if (!m.quietSim) { renderLineups(); updateScoreboard(); }
    toast(sideData.team.short + ' → ' + formKey);
    return true;
  }

  function setTacticsLive(side, tactic) {
    const m = currentMatch;
    if (!m || m.finished) return;
    if (!m.tactics) m.tactics = { home: 'balanced', away: 'balanced' };
    m.tactics[side] = tactic;
    const labels = { attack: 'all-out attack', balanced: 'balanced approach', defend: 'defensive block', press: 'high press' };
    addEvent(m.minute, 'whistle', `📋 ${m[side].team.short} go ${labels[tactic] || tactic}`, side);
    toast(m[side].team.short + ': ' + (labels[tactic] || tactic));
  }

  // Picks a formation clearly more attacking in shape than the current one
  // (most forward-weighted bodies among the alternatives), for the AI's
  // late-game "throw men forward" reshape.
  // Picks a formation clearly more attacking in shape than the current
  // one (most forward-weighted bodies among the alternatives) that the
  // side currently on the pitch can actually fill without anyone playing
  // out of position — for the AI's late-game "throw men forward" reshape.
  // Returns null if nothing more attacking fits this exact XI.
  function pickMoreAttackingFormation(curKey, onPitchPlayers) {
    const keys = Object.keys(FORMATIONS).filter(k => k !== curKey);
    keys.sort((a, b) => formationShape(b).fwd - formationShape(a).fwd);
    return keys.find(k => canFormationFitSquad(onPitchPlayers, k)) || null;
  }
  // Picks a formation clearly more defensive in shape than the current one,
  // for the AI's late-game "shut up shop" reshape.
  // Picks a formation clearly more defensive in shape than the current
  // one that the side currently on the pitch can actually fill without
  // anyone playing out of position, for the AI's late-game "shut up
  // shop" reshape. Returns null if nothing more defensive fits this
  // exact XI.
  function pickMoreDefensiveFormation(curKey, onPitchPlayers) {
    const keys = Object.keys(FORMATIONS).filter(k => k !== curKey);
    keys.sort((a, b) => formationShape(b).def - formationShape(a).def);
    return keys.find(k => canFormationFitSquad(onPitchPlayers, k)) || null;
  }

  // ===================================================================
  // ===================== IN-MATCH TACTICAL AI =======================
  // ===================================================================
  // Runs every simulated minute and reacts to the actual game state —
  // scoreline, time remaining, and the manager's identity — so a team
  // chasing a goal genuinely presses higher / throws men forward / goes
  // to a more attacking shape, and a team protecting a lead genuinely
  // drops off / tightens up / brings on a defensive body late on. Each
  // side gets at most one instruction change per cooldown window and at
  // most one AI-driven formation reshape per match, so it reads as a
  // deliberate, occasional managerial decision rather than constant noise.
  function runTacticalAI() {
    const m = currentMatch;
    if (!m || m.finished || m.inET || m.inPens || m._awaitingET) return;
    evaluateTacticalAI('home', 'away');
    evaluateTacticalAI('away', 'home');
  }

  function evaluateTacticalAI(side, otherSide) {
    const m = currentMatch;
    if (!m) return;
    const sideData = m[side], oppData = m[otherSide];
    if (!sideData || !oppData) return;
    if (!m.tacticalAI) m.tacticalAI = { home: { lastChange: -999 }, away: { lastChange: -999 } };
    const ai = m.tacticalAI[side];
    const minute = m.dispMin != null ? m.dispMin : m.minute;
    const diff = (sideData.score || 0) - (oppData.score || 0);
    const style = getManagerPlaystyle(sideData.team);
    const aggressive = ['Overload', 'Quick Counter', 'Long Ball Counter'].includes(style);
    const currentTac = (m.tactics && m.tactics[side]) || 'balanced';
    let targetTac = currentTac;

    if (diff <= -1 && minute >= 60) {
      // Chasing the game: press higher, and once it's later and/or a two-
      // goal gap, go all out.
      targetTac = (diff <= -2 && minute >= 72) || minute >= 82 ? 'attack' : 'press';
    } else if (diff >= 1 && minute >= 70) {
      // Protecting a lead: ease off first, then properly shut up shop
      // as full time approaches.
      targetTac = minute >= 83 ? 'defend' : 'balanced';
    } else if (diff === 0 && minute >= 65 && aggressive) {
      // Level game, aggressive manager identity — more likely to gamble
      // on pressing for a winner than a patient/counter-minded one.
      targetTac = seededRandom() < 0.35 ? 'press' : currentTac;
    } else if (diff === 0 && minute < 60 && currentTac !== 'balanced' && seededRandom() < 0.1) {
      // Early-game overreactions settle back down if the game's still level.
      targetTac = 'balanced';
    }

    if (targetTac !== currentTac && minute - ai.lastChange >= 12) {
      setTacticsLive(side, targetTac);
      ai.lastChange = minute;
    }

    // Live formation reshape: reserved for clear, late situations, and only
    // once per side per match, so it reads as a real "extra attacker" or
    // "back five to see it out" moment rather than constant reshuffling.
    // Most real managers stick to their starting shape for the entire
    // 90 minutes regardless of the scoreline — a genuine mid-match reshape
    // is the exception, not the norm. So the very first minute this side
    // qualifies for a reshape, we flip a single coin (roughly 1 in 4) for
    // whether this particular manager is even the type to do it at all —
    // decided once and remembered, not re-rolled every minute the
    // situation persists (a per-minute roll would make *some* minute
    // hitting near-certain over a 10-15 minute window, defeating the
    // point). A miss retires the idea for the rest of the match, same as
    // a manager who talked himself out of it once the moment passed. Only
    // actually fires if a suitably-shaped formation exists that the
    // current on-pitch XI can fill without anyone playing out of
    // position — see pickMoreAttackingFormation/pickMoreDefensiveFormation
    // and changeFormationLive's own gate above.
    if (!m.formationAIUsed) m.formationAIUsed = { home: false, away: false };
    if (!m.formationAIRoll) m.formationAIRoll = { home: null, away: null };
    if (m.formationAIUsed[side]) return;
    const RESHAPE_CHANCE = 0.25;
    const curForm = sideData.squad.formation;
    if (!curForm) return;
    const shape = formationShape(curForm);
    const onIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const allSidePlayers = [...(sideData.squad.starting || []), ...(sideData.squad.subs || [])];
    const onPitchPlayers = onIds.map(id => allSidePlayers.find(p => p.id === id)).filter(Boolean);
    const qualifiesAttacking = diff <= -1 && minute >= 75 && shape.fwd <= SHAPE_BASELINE.fwd + 0.4;
    const qualifiesDefensive = diff >= 1 && minute >= 82 && shape.def <= SHAPE_BASELINE.def + 0.4;
    if (!qualifiesAttacking && !qualifiesDefensive) return;
    if (m.formationAIRoll[side] === null) {
      m.formationAIRoll[side] = seededRandom() < RESHAPE_CHANCE;
    }
    if (!m.formationAIRoll[side]) { m.formationAIUsed[side] = true; return; }
    if (qualifiesAttacking) {
      const target = pickMoreAttackingFormation(curForm, onPitchPlayers);
      if (target && changeFormationLive(side, target)) {
        m.formationAIUsed[side] = true;
      }
    } else if (qualifiesDefensive) {
      const target = pickMoreDefensiveFormation(curForm, onPitchPlayers);
      if (target && changeFormationLive(side, target)) {
        m.formationAIUsed[side] = true;
      }
    }
  }

  function isPlayerInjured(playerId) {
    const rec = injuryBook[playerId];
    return !!rec && rec.matchesLeft > 0;
  }

  function isPlayerSuspended(playerId) {
    const rec = suspensionBook[playerId];
    return !!rec && rec.matchesLeft > 0;
  }

  // Picks a random injury definition from injury.json (injuryDefsData),
  // weighted toward minor knocks and only rarely landing on something
  // severe — same overall shape as the old hardcoded table, but now backed
  // by the richer, editable injury.json catalogue (id, bodyPart, severity,
  // description, flavor "causes" text) that the Hospital tab reads from too.
  function pickInjuryDef() {
    const defs = (injuryDefsData && injuryDefsData.length) ? injuryDefsData : INJURY_DEFS_DATA;
    const byTier = {
      Minor: defs.filter(d => d.severity === 'Minor'),
      Moderate: defs.filter(d => d.severity === 'Moderate'),
      Major: defs.filter(d => d.severity === 'Major'),
      Severe: defs.filter(d => d.severity === 'Severe')
    };
    const roll = seededRandom();
    let tier;
    if (roll < 0.55) tier = 'Minor';
    else if (roll < 0.85) tier = 'Moderate';
    else if (roll < 0.97) tier = 'Major';
    else tier = 'Severe';
    // If the loaded injury.json is missing a whole tier (e.g. a trimmed
    // custom file), fall back to any tier that does have entries rather
    // than throwing — degrade gracefully instead of failing the match sim.
    let pool = byTier[tier];
    if (!pool.length) pool = defs.filter(d => d && d.minMatches != null);
    if (!pool.length) pool = defs;
    return pool[Math.floor(seededRandom() * pool.length)];
  }
  function tryInjury(side) {
    const m = currentMatch;
    if (!m) return;
    const sideData = m[side];
    const onPitchIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const pool = (sideData.squad.all || []).filter(p => onPitchIds.includes(p.id) && (p.pos || [])[0] !== 'GK' && !isPlayerInjured(p.id));
    if (!pool.length) return;
    // Weighted by injury resistance (Low/Medium/High from the expanded
    // attribute sheet) instead of a flat uniform pick — a fragile player is
    // genuinely more likely to be the one who goes down.
    const injWeights = pool.map(p => injuryWeightMult(p));
    const injTotal = injWeights.reduce((a, b) => a + b, 0);
    let injR = seededRandom() * injTotal;
    let injured = pool[pool.length - 1];
    for (let i = 0; i < pool.length; i++) {
      injR -= injWeights[i];
      if (injR <= 0) { injured = pool[i]; break; }
    }
    const info = pickInjuryDef();
    const outMatches = info.minMatches + Math.floor(seededRandom() * (info.maxMatches - info.minMatches + 1));
    // Flavor text for "how it happened" — a random line from this injury
    // type's causes list in injury.json, falling back to a generic phrase
    // for a hand-edited injury.json that leaves causes empty.
    const causeList = (info.causes && info.causes.length) ? info.causes : ['picked up a knock and had to be withdrawn'];
    const cause = causeList[Math.floor(seededRandom() * causeList.length)];
    const oppSide = side === 'home' ? 'away' : 'home';
    const opponent = (m[oppSide] && m[oppSide].team && m[oppSide].team.name) || '';
    const competition = (typeof matchCompetitionLabel === 'function') ? matchCompetitionLabel(m) : '';
    injuryBook[injured.id] = {
      defId: info.id,
      type: info.name,
      bodyPart: info.bodyPart || '',
      severity: info.severity || 'Minor',
      cause: cause,
      opponent: opponent,
      competition: competition,
      minute: (m.dispMin != null ? m.dispMin : m.minute),
      matchesLeft: outMatches,
      matchesTotal: outMatches,
      teamName: sideData.team.name,
      playerName: injured.name
    };
    m.injuries.push(injured.id);
    addEvent(m.minute, 'injury',
      `🩹 <span class="player">${injured.name}</span> ${cause} — ${info.name}. Out for ${outMatches} match${outMatches>1?'es':''}`,
      side);
    try { localStorage.setItem('apexInjuryBook', JSON.stringify(injuryBook)); } catch(e) {}
    if (!m.leftPitch) m.leftPitch = { home: [], away: [] };
    const leftIds = m.leftPitch[side] || (m.leftPitch[side] = []);
    const used = side === 'home' ? m.homeSubsUsed : m.awaySubsUsed;
    if (used < m.maxSubs) {
      const availableSubs = (sideData.squad.subs || []).filter(p =>
        !onPitchIds.includes(p.id) && !m.injuries.includes(p.id) && !isPlayerInjured(p.id) && !leftIds.includes(p.id));
      if (availableSubs.length) {
        let candidates = availableSubs.filter(p => canPlay(p, injured.slot || (injured.pos || ['CM'])[0]));
        if (!candidates.length) candidates = availableSubs; // forced — the injured player must leave the pitch either way
        candidates.sort((a, b) => (b.ovr || 70) - (a.ovr || 70));
        const inPlayer = candidates[Math.floor(seededRandom() * Math.min(3, candidates.length))];
        const idx = onPitchIds.indexOf(injured.id);
        if (idx >= 0) onPitchIds[idx] = inPlayer.id;
        // Same fix as the other substitution paths in engine/tactics.js:
        // only inherit the injured player's exact slot if the incoming
        // sub is actually comfortable there (the normal case, since
        // candidates above are already filtered to it when possible);
        // otherwise fall back to their own natural position rather than
        // force them somewhere they can't play — this only matters for
        // the rare case where the bench had nobody compatible at all.
        const onPitchNow = (sideData.squad.all || []).filter(p => onPitchIds.includes(p.id) && p.id !== injured.id);
        inPlayer.slot = pickSlotForIncomingSub(inPlayer, sideData.squad.formation, injured.slot || (injured.pos || ['CM'])[0], onPitchNow);
        markLeftPitch(m, side, injured.id);
        resetFatigueFor(m, side, inPlayer.id);
        if (side === 'home') m.homeSubsUsed++; else m.awaySubsUsed++;
        addEvent(m.minute, 'sub', `Forced sub: <span class="player">${inPlayer.name}</span> replaces injured <span class="player">${injured.name}</span>`, side);
      } else {
        removeFromPitch(side, injured.id);
      }
    } else {
      removeFromPitch(side, injured.id);
    }
  }

  function removeFromPitch(side, playerId) {
    if (!currentMatch) return;
    const arr = side === 'home' ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    const idx = arr.indexOf(playerId);
    if (idx >= 0) arr.splice(idx, 1);
    markLeftPitch(currentMatch, side, playerId);
  }

  // A player who has left the pitch for any reason (substituted off, sent off,
  // or injured off with no replacement) can never take the field again this
  // match — whether they were an original starter or an earlier substitute.
  function markLeftPitch(m, side, playerId) {
    if (!m) return;
    if (!m.leftPitch) m.leftPitch = { home: [], away: [] };
    if (!m.leftPitch[side]) m.leftPitch[side] = [];
    if (!m.leftPitch[side].includes(playerId)) m.leftPitch[side].push(playerId);
  }

  
  function renderMomentumAndHeat() {
    const m = currentMatch;
    if (!m || m.quietSim) return;
    let wrap = document.getElementById('momentum-heat');
    if (!wrap) {
      const live = document.getElementById('match-live');
      const lineup = document.getElementById('lineup-display');
      if (!live) return;
      wrap = document.createElement('div');
      wrap.id = 'momentum-heat';
      if (lineup && lineup.parentNode) lineup.parentNode.insertBefore(wrap, lineup);
      else live.appendChild(wrap);
    }
    wrap.innerHTML = `
      <div class="momentum-wrap"><h4>Match Momentum</h4><canvas id="momentum-canvas" height="80"></canvas></div>
      <div class="heatmap-wrap"><h4>Activity Heat (zones)</h4><canvas id="heatmap-canvas" height="140"></canvas></div>`;
    // Momentum: walk events, +1 home goal/shot, -1 away
    const canvas = document.getElementById('momentum-canvas');
    if (canvas) {
      const w = canvas.parentElement.clientWidth || 300;
      canvas.width = w;
      const ctx = canvas.getContext('2d');
      const events = m.events || [];
      let mom = 0;
      const pts = [{x:0, y:0}];
      events.forEach((e, i) => {
        let d = 0;
        if (e.type === 'goal') d = e.side === 'home' ? 3 : (e.side === 'away' ? -3 : 0);
        else if (e.type === 'shot' || e.type === 'miss') d = e.side === 'home' ? 1 : (e.side === 'away' ? -1 : 0);
        else if (e.type === 'save') d = e.side === 'home' ? -0.8 : (e.side === 'away' ? 0.8 : 0);
        else if (e.type === 'yellow' || e.type === 'red') d = e.side === 'home' ? -0.5 : (e.side === 'away' ? 0.5 : 0);
        mom = Math.max(-12, Math.min(12, mom + d));
        pts.push({ x: (e.dispMin != null ? e.dispMin : (e.minute || i)) / Math.max(m.dispMin || m.minute, 90), y: mom });
      });
      const homeCol = m.home.team.color || '#3d8bfd';
      const awayCol = m.away.team.color || '#ef4444';
      ctx.clearRect(0, 0, w, 80);
      ctx.fillStyle = '#0a1210';
      ctx.fillRect(0, 0, w, 80);
      // midline
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(w, 40); ctx.stroke();
      // Fill home (above mid = home momentum) and away (below)
      if (pts.length > 1) {
        for (let i = 1; i < pts.length; i++) {
          const x0 = pts[i-1].x * w, x1 = pts[i].x * w;
          const y0 = 40 - (pts[i-1].y / 12) * 36;
          const y1 = 40 - (pts[i].y / 12) * 36;
          const midY = (y0 + y1) / 2;
          ctx.beginPath();
          ctx.moveTo(x0, 40); ctx.lineTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x1, 40);
          ctx.closePath();
          ctx.fillStyle = midY < 40 ? homeCol + '55' : awayCol + '55';
          ctx.fill();
        }
      }
      ctx.beginPath();
      pts.forEach((p, i) => {
        const x = p.x * w;
        const y = 40 - (p.y / 12) * 36;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#f0c14b';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Legend
      ctx.fillStyle = homeCol;
      ctx.fillRect(8, 6, 10, 10);
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.fillText(m.home.team.short || 'HOME', 22, 15);
      ctx.fillStyle = awayCol;
      ctx.fillRect(w - 70, 6, 10, 10);
      ctx.fillStyle = '#fff';
      ctx.fillText(m.away.team.short || 'AWAY', w - 56, 15);
    }
    // Heatmap: 3x3 zones from event sides + random based on possession
    const hc = document.getElementById('heatmap-canvas');
    if (hc) {
      const w = hc.parentElement.clientWidth || 300;
      hc.width = w;
      const ctx = hc.getContext('2d');
      const grid = Array.from({length: 3}, () => [0,0,0]);
      (m.events || []).forEach(e => {
        const row = e.side === 'home' ? 2 : (e.side === 'away' ? 0 : 1);
        const col = Math.floor(seededRandom() * 3);
        let wgt = 1;
        if (e.type === 'goal') wgt = 4;
        else if (e.type === 'shot' || e.type === 'miss') wgt = 2;
        else if (e.type === 'save') wgt = 2;
        grid[row][col] += wgt;
      });
      // blend possession
      const hp = (m.home.stats && m.home.stats.possession) || 50;
      for (let c = 0; c < 3; c++) {
        grid[2][c] += hp / 25;
        grid[0][c] += (100 - hp) / 25;
      }
      let max = 1;
      grid.forEach(r => r.forEach(v => { if (v > max) max = v; }));
      const cellW = w / 3, cellH = 140 / 3;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const t = grid[r][c] / max;
          ctx.fillStyle = `rgba(34,197,94,${0.1 + t * 0.75})`;
          ctx.fillRect(c * cellW + 1, r * cellH + 1, cellW - 2, cellH - 2);
        }
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(0.5, 0.5, w - 1, 139);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '10px sans-serif';
      ctx.fillText(m.away.team.short || 'AWAY', 8, 14);
      ctx.fillText(m.home.team.short || 'HOME', 8, 134);
    }
  }

  function endMatch() {
    const m = currentMatch;
    if (!m) return;
    m.finished = true;
    if (!m.inET && !m.inPens) { m.status = 'Full Time'; if ((m.dispMin || 0) < 90) m.dispMin = 90; }
    else if (m.inPens) m.status = 'FT (Pens)';
    else { m.status = 'Full Time (ET)'; if ((m.dispMin || 0) < 120) m.dispMin = 120; }
    m.dispLabel = m.inPens ? 'Pens' : (m.dispLabel && parseInt(m.dispLabel, 10) >= (m.dispMin || 0) ? m.dispLabel : m.dispMin + "'");
    clearInterval(simInterval); isPlaying = false;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = '▶ Play';
    try { renderMomentumAndHeat, showLoading, hideLoading, refreshTournamentStatsUI(); } catch(e) {}
    if (tournament) { try { refreshTournamentStatsUI(); } catch(e) {} }
    addEvent(m.minute || 90, 'whistle', `Full Time! ${m.home.team.short} ${m.home.score} - ${m.away.score} ${m.away.team.short}`, null);
    if (m.away.score === 0) {
      const gk = (m.home.squad.starting || []).find(p => (p.pos || []).includes('GK'));
      if (gk) recordStat('cleanSheets', gk, m.home.team);
    }
    if (m.home.score === 0) {
      const gk = (m.away.squad.starting || []).find(p => (p.pos || []).includes('GK'));
      if (gk) recordStat('cleanSheets', gk, m.away.team);
    }
    // Compute ratings for everyone who played, then MOTM = highest rating
    if (!m.playerMatchStats) m.playerMatchStats = {};
    // Flag this match as a "big game" (knockout-stage/final, or two top-tier
    // sides going at it) once, up front, so every recordRating() call below
    // for this match consistently feeds the bigGames award-scoring bucket.
    m.isBigGame = isBigGameContext(m);
    const allOnPitch = [...(m.home.squad.starting||[]), ...(m.away.squad.starting||[])];
    // Include subs who came on
    const onIds = new Set([...(m.homeOnPitch||[]), ...(m.awayOnPitch||[])]);
    const allInvolved = [...(m.home.squad.all||[]), ...(m.away.squad.all||[])].filter(p =>
      onIds.has(p.id) || allOnPitch.some(s => s.id === p.id) || (m.playerMatchStats[p.id] && (
        m.playerMatchStats[p.id].goals || m.playerMatchStats[p.id].assists || m.playerMatchStats[p.id].shots || m.playerMatchStats[p.id].saves
      ))
    );
    const pool = allInvolved.length ? allInvolved : allOnPitch;
    pool.forEach(p => {
      if (!m.playerMatchStats[p.id]) m.playerMatchStats[p.id] = blankPlayerMatchStats(p);
      const ps = m.playerMatchStats[p.id];
      // Ensure pos info for rating formula
      if (!ps.posArr || !ps.posArr.length) ps.posArr = p.pos || [];
      if (!ps.pos) ps.pos = p.slot || (p.pos||[])[0] || '';
      if (!ps.slot) ps.slot = p.slot || ps.pos;
      // Clean sheet flag for GK rating, and goals conceded for GK/DEF/MID
      // rating penalty (see calcPlayerRating) — both come from the actual
      // final scoreline, keyed off which side this player was on.
      const concededSide = (m.home.squad.all||[]).find(x => x.id === p.id) ? 'home' : 'away';
      ps.goalsConceded = concededSide === 'home' ? m.away.score : m.home.score;
      if ((ps.pos === 'GK' || (ps.posArr||[]).includes('GK'))) {
        const side = concededSide;
        if ((side === 'home' && m.away.score === 0) || (side === 'away' && m.home.score === 0)) ps.cleanSheet = true;
      }
      // Rating uses a small activity floor for players who genuinely played
      // but happened to see very little of the ball (e.g. a sub on for the
      // last few minutes) so they don't get an unfairly harsh 0-stat rating.
      // Crucially this floor is applied to a throwaway copy used only for
      // the rating formula — it never touches the real ps.saves/tackles/
      // passes fields that the stats panel, match report, and leaderboards
      // read from, so those always stay exactly in sync with what actually
      // happened (and was reported) in the match.
      let ratingInput = ps;
      if (onIds.has(p.id)) {
        const pos = (ps.pos || '').toUpperCase();
        const isGK = pos === 'GK' || (ps.posArr||[]).includes('GK');
        const isDef = ['CB','RB','LB','RWB','LWB'].some(x => pos.includes(x) || (ps.posArr||[]).includes(x));
        const isMid = ['CM','CDM','CAM','RM','LM'].some(x => pos.includes(x) || (ps.posArr||[]).includes(x));
        const floors = isGK ? { saves: ps.saves > 0 ? ps.saves : 1, passes: ps.passes > 0 ? ps.passes : 6, passesCompleted: ps.passes > 0 ? ps.passesCompleted : 5 }
          : isDef ? { tackles: ps.tackles > 0 ? ps.tackles : 2, passes: ps.passes > 0 ? ps.passes : 12, passesCompleted: ps.passes > 0 ? ps.passesCompleted : 10 }
          : isMid ? { tackles: ps.tackles > 0 ? ps.tackles : 1, passes: ps.passes > 0 ? ps.passes : 18, passesCompleted: ps.passes > 0 ? ps.passesCompleted : 15 }
          : { passes: ps.passes > 0 ? ps.passes : 8, passesCompleted: ps.passes > 0 ? ps.passesCompleted : 6 };
        ratingInput = Object.assign({}, ps, floors);
      }
      ps.rating = calcPlayerRating(ratingInput);
      const teamObj = (m.home.squad.all||[]).find(x=>x.id===p.id) ? m.home.team : m.away.team;
      recordRating(p, teamObj, ps.rating);
      // Nudge this player's persistent form (and therefore their effective
      // OVR) based on how they actually played in this match — the real
      // roster player, not the shallow per-match squad clone, so it sticks.
      const realPlayer = (teamObj.players || []).find(x => x.id === p.id);
      if (realPlayer) updateLiveRatingAfterMatch(realPlayer, ps.rating);
      const oppTeamObj = concededSide === 'home' ? m.away.team : m.home.team;
      recordPlayerMatchLog(m, p, teamObj, oppTeamObj, ps, concededSide);
      // Feed the season-long "Interceptions" leaderboard and Defenders' Award
      // with this match's accumulated defensive totals.
      if (ps.interceptions > 0) recordStatCount('interceptions', p, teamObj, ps.interceptions);
      if (ps.tackles > 0) recordStatCount('tackles', p, teamObj, ps.tackles);
    });
    // Fill in the full Attack/Passing/Defense/Physical/Goalkeeping stat sheet
    // for every player who took part, then roll those up into each side's
    // team totals — see deriveExtendedMatchStats() below.
    deriveExtendedMatchStats(m);
    let best = null, bestR = -1;
    Object.values(m.playerMatchStats).forEach(ps => {
      if (ps.rating > bestR) { bestR = ps.rating; best = ps; }
    });
    if (best) {
      const team = (m.home.squad.all || []).find(p => p.id === best.id) ? m.home.team : m.away.team;
      const playerObj = [...(m.home.squad.all||[]), ...(m.away.squad.all||[])].find(p => p.id === best.id) || best;
      recordStat('motm', playerObj, team);
      addEvent(90, 'motm', `Player of the Match: <span class="player">${best.name}</span> (${best.rating.toFixed(1)})`, null);
      // Stash the MOTM's player id on the match itself so any ratings list
      // (live post-match panel, match report modal) can pick them out and
      // render their rating badge in the MOTM color — see renderRatingRow()
      // in ui/matchUI.js.
      m.motmId = best.id;
    }
    recordTeamMatchLog(m, m.home.team, m.away.team, m.home.score, m.away.score);
    recordTeamMatchLog(m, m.away.team, m.home.team, m.away.score, m.home.score);
    /* ratings live in lineup */ renderLineups();
    globalMatchDay++;
    // Progress injury/suspension countdowns for both squads. A match only counts
    // against a ban if the player sat it out entirely (no stats recorded this
    // match) — a player freshly injured or sent off *during* this match already
    // has stats here, so their ban starts counting from their team's next match.
    [m.home.team, m.away.team].forEach(teamObj => {
      if (!teamObj) return;
      (teamObj.players || []).forEach(p => {
        const inj = injuryBook[p.id];
        if (inj && inj.matchesLeft > 0 && !m.playerMatchStats[p.id]) {
          inj.matchesLeft--;
          if (inj.matchesLeft <= 0) delete injuryBook[p.id];
        }
        const sus = suspensionBook[p.id];
        if (sus && sus.matchesLeft > 0 && !m.playerMatchStats[p.id]) {
          sus.matchesLeft--;
          if (sus.matchesLeft <= 0) delete suspensionBook[p.id];
        }
      });
    });
    // Ban anyone sent off this match for their team's next match
    Object.entries(m.playerMatchStats).forEach(([id, ps]) => {
      if (!ps.red) return;
      const onHome = (m.home.squad.all || []).some(p => p.id === id);
      const teamObj = onHome ? m.home.team : m.away.team;
      suspensionBook[id] = {
        matchesLeft: 1,
        teamName: teamObj ? teamObj.name : '',
        playerName: ps.name
      };
    });
    try { localStorage.setItem('apexInjuryBook', JSON.stringify(injuryBook)); } catch(e) {}
    try { localStorage.setItem('apexSuspensionBook', JSON.stringify(suspensionBook)); } catch(e) {}
    saveStats();
    updateScoreboard();
    updateStatsPanel();
    if (tournament || window._fromTournament || typeof window._tourFixtureIdx === 'number' || typeof window._koRoundIdx === 'number' || typeof window._uclFixtureIdx === 'number' || typeof window._tourLeagueFixtureIdx === 'number' || window._seasonFixture) {
      const backBtn = document.getElementById('back-to-tournament');
      if (backBtn) {
        backBtn.style.display = 'flex';
        backBtn.classList.add('show');
        const backBtnLabel = backBtn.querySelector('button');
        if (backBtnLabel) backBtnLabel.textContent = window._seasonFixture ? '← Back to Season' : '← Back to Tournament';
      }
    }
    // If this was a tournament match, update fixture
    
    // UCL league live result
    if (typeof window._uclFixtureIdx === 'number' && tournament && tournament.fixtures) {
      const f = tournament.fixtures[window._uclFixtureIdx];
      if (f && !f.played && currentMatch) {
        f.played = true;
        f.homeScore = currentMatch.home.score;
        f.awayScore = currentMatch.away.score;
        f.report = buildMatchReport(currentMatch);
        applyLeagueResult(f.home, f.away, f.homeScore, f.awayScore);
        window._uclFixtureIdx = null;
        if (tournament.fixtures.every(x => x.played)) advanceUCLFromLeague();
        refreshTournamentStatsUI();
      }
    }
    // Domestic league (table format) live result — writes back into the
    // current matchday of tournament.rounds and tournament.table, then
    // advances to the next matchday (or crowns the champion) once every
    // fixture in the round has been played. Mirrors the UCL league block
    // above, but against the plain double round-robin table instead of
    // tournament.league.
    if (typeof window._tourLeagueFixtureIdx === 'number' && tournament && tournament.format === 'table') {
      const round = tournament.rounds[tournament.currentRound];
      const f = round && round[window._tourLeagueFixtureIdx];
      if (f && !f.played && currentMatch) {
        f.played = true;
        f.homeScore = currentMatch.home.score;
        f.awayScore = currentMatch.away.score;
        f.report = buildMatchReport(currentMatch);
        applyResultToTable(tournament.table, f.home, f.away, f.homeScore, f.awayScore);
        window._tourLeagueFixtureIdx = null;
        if (round.every(x => x.played)) {
          tournament.currentRound++;
          if (tournament.currentRound >= tournament.rounds.length) finishLeagueTournament();
        }
        try { renderLeagueTableTournament(); } catch (e) {}
        refreshTournamentStatsUI();
        toast('League match result saved!');
      }
    }
    // Knockout live result
    if (typeof window._koRoundIdx === 'number' && typeof window._koMatchIdx === 'number' && tournament) {
      const km = tournament.knockout[window._koRoundIdx] && tournament.knockout[window._koRoundIdx].matches[window._koMatchIdx];
      if (km && !km.played && currentMatch) {
        km.played = true;
        km.homeScore = currentMatch.home.score;
        km.awayScore = currentMatch.away.score;
        km.report = buildMatchReport(currentMatch);
        if (currentMatch.home.penScore != null) {
          km.penalties = true;
          // Winner by pens or score
          if (currentMatch.home.score !== currentMatch.away.score) {
            km.winner = currentMatch.home.score > currentMatch.away.score ? km.home : km.away;
          } else {
            km.winner = (currentMatch.home.penScore > currentMatch.away.penScore) ? km.home : km.away;
            km.homeScore = currentMatch.home.score;
            km.awayScore = currentMatch.away.score;
          }
        } else if (currentMatch.home.score === currentMatch.away.score) {
          km.winner = seededRandom() < 0.5 ? km.home : km.away;
          km.penalties = true;
        } else {
          km.winner = currentMatch.home.score > currentMatch.away.score ? km.home : km.away;
        }
        const ri = window._koRoundIdx;
        window._koRoundIdx = null;
        window._koMatchIdx = null;
        afterKnockoutMatchPlayed(ri);
        refreshTournamentStatsUI();
        toast('Knockout result saved!');
        const backBtn = document.getElementById('back-to-tournament');
        if (backBtn) { backBtn.style.display = 'flex'; backBtn.classList.add('show'); }
        renderBracket();
        renderTournamentLeaderboard();
      }
    }
    if (typeof window._tourFixtureIdx === 'number' && tournament && tournament.fixtures[window._tourFixtureIdx]) {
      const f = tournament.fixtures[window._tourFixtureIdx];
      if (!f.played && currentMatch) {
        f.played = true;
        f.homeScore = currentMatch.home.score;
        f.awayScore = currentMatch.away.score;
        f.report = buildMatchReport(currentMatch);
        const g = tournament.groups[f.group];
        if (g) {
          const ht = g.teams.find(t => t.team.id === f.home);
          const at = g.teams.find(t => t.team.id === f.away);
          if (ht && at) {
            ht.played++; at.played++;
            ht.gf += f.homeScore; ht.ga += f.awayScore;
            at.gf += f.awayScore; at.ga += f.homeScore;
            if (f.homeScore > f.awayScore) { ht.won++; ht.pts += 3; at.lost++; }
            else if (f.awayScore > f.homeScore) { at.won++; at.pts += 3; ht.lost++; }
            else { ht.drawn++; at.drawn++; ht.pts++; at.pts++; }
          }
        }
        window._tourFixtureIdx = null;
        refreshTournamentStatsUI();
        toast('Tournament match result saved!');
      }
    }
    // Season Calendar live result — mirrors the tournament fixture handling
    // above, but writes back into the current league/UCL matchday and league
    // table, then advances the round once every fixture in it is played.
    if (window._seasonFixture && season) {
      const { compKey, idx } = window._seasonFixture;
      const comp = compKey === 'ucl' ? season.ucl : season.leagues[compKey];
      const round = comp && comp.rounds && comp.rounds[comp.currentRound];
      const f = round && round[idx];
      if (f && !f.played && currentMatch) {
        f.played = true;
        f.homeScore = currentMatch.home.score;
        f.awayScore = currentMatch.away.score;
        f.report = buildMatchReport(currentMatch);
        applyResultToTable(comp.table, f.home, f.away, f.homeScore, f.awayScore);
        window._seasonFixture = null;
        currentSeasonComp = null;
        advanceSeasonRoundIfComplete(comp, compKey);
        refreshTournamentStatsUI();
        toast('Season match result saved!');
      }
    }
    persistAll();
  }

  // Renders one of the curated PNGs in assets/images/ as an inline,
  // emoji-sized icon. Used everywhere a status emoji (goal, assist,
  // captain, penalty, card, ...) used to be a plain unicode character —
  // see the .emoji-icon-img rule in styles.css for sizing.
  function emojiImg(name, title) {
    const t = title || '';
    return `<img src="assets/images/${name}.png" alt="${t}" title="${t}" class="emoji-icon-img">`;
  }
  function addEvent(minute, type, text, side, isGoal, isPenalty) {
    if (!currentMatch) return;
    // dispLabel/dispMin reflect the match clock at the moment this event
    // happened (see updateMatchClock in matchEngine.js) — e.g. "45+2'" or
    // "96'" during extra time — while the raw `minute` is kept only for
    // internal ordering/filtering (computeAddedTime, the momentum chart).
    const dispLabel = currentMatch.inPens ? 'Pens' : (currentMatch.dispLabel || (minute + "'"));
    const dispMin = currentMatch.inPens ? (currentMatch.dispMin || 120) : (currentMatch.dispMin != null ? currentMatch.dispMin : minute);
    currentMatch.events.push({ minute, dispMin, dispLabel, type, text, side });
    if (currentMatch.quietSim) return;
    const feed = document.getElementById('events-feed');
    if (!feed) return;
    const icons = { goal: emojiImg(isPenalty ? 'penalty_goal' : 'goal', isPenalty ? 'Penalty goal' : 'Goal'), save: '🧤', yellow: emojiImg('yellow_card', 'Yellow card'), red: emojiImg('red_card', 'Red card'), sub: '🔄', injury: '🩹', corner: '🚩', foul: '⚠️', tackle: '🦵', shot: '👟', miss: '❌', pass: '➡️', offside: '🚫', whistle: emojiImg('whistle', 'Whistle'), pressure: '🔥', motm: '⭐', var: '📺', pen: emojiImg('penalty_goal', 'Penalty'), skill: '✨', handball: '✋', et: '⏱️' };
    const div = document.createElement('div');
    div.className = 'event-item' + (isGoal || type === 'goal' ? ' event-goal' : '') + (type === 'red' ? ' event-card-red' : '') + (type === 'injury' ? ' event-injury' : '') + (type === 'var' ? ' event-var' : '') + (type === 'pen' ? ' event-pen' : '');
    div.innerHTML = `<span class="event-time">${dispLabel}</span><span class="event-icon">${icons[type] || '•'}</span><span class="event-text">${text}</span>`;
    feed.insertBefore(div, feed.firstChild);
    if (['goal','sub','yellow','red','injury','pen'].includes(type)) {
      try { renderLineups(); } catch (e) {}
    }
  }

  function updateScoreboard() {
    if (!currentMatch) return;
    if (currentMatch.quietSim) return;
    const m = currentMatch;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const setHTML = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
    setHTML('live-home-flag', teamMark(m.home.team, 26));
    set('live-home-name', m.home.team.short || m.home.team.name);
    set('live-home-form', (FORMATIONS[m.home.squad.formation] || {}).name || '');
    setHTML('live-away-flag', teamMark(m.away.team, 26));
    set('live-away-name', m.away.team.short || m.away.team.name);
    set('live-away-form', (FORMATIONS[m.away.squad.formation] || {}).name || '');
    const hm = document.getElementById('live-home-mgr');
    const am = document.getElementById('live-away-mgr');
    const hStyle = getManagerPlaystyle(m.home.team);
    const aStyle = getManagerPlaystyle(m.away.team);
    const hMgrName = m.home.team.manager ? m.home.team.manager.name : '';
    const aMgrName = m.away.team.manager ? m.away.team.manager.name : '';
    if (hm) hm.innerHTML = hMgrName ? managerAvatarMark(m.home.team.manager, 18) + ' ' + hMgrName + (hStyle ? ' (' + hStyle + ')' : '') : '';
    if (am) am.innerHTML = aMgrName ? aMgrName + (aStyle ? ' (' + aStyle + ')' : '') + ' ' + managerAvatarMark(m.away.team.manager, 18) : '';
    const hs = m.home.penScore != null ? `${m.home.score} (${m.home.penScore})` : m.home.score;
    const as_ = m.away.penScore != null ? `${m.away.score} (${m.away.penScore})` : m.away.score;
    // Pop the scoreline when it actually changes, so a goal feels like a
    // goal rather than the number just silently updating.
    const popIfChanged = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      const changed = el.textContent !== String(val) && el.dataset.popped !== undefined;
      el.textContent = val;
      el.dataset.popped = '1';
      if (changed) {
        el.classList.remove('score-pop');
        void el.offsetWidth; // restart animation
        el.classList.add('score-pop');
      }
    };
    popIfChanged('live-home-score', hs);
    popIfChanged('live-away-score', as_);
    set('live-minute', m.inPens ? 'Pens' : (m.dispLabel || (m.minute + "'")));
    set('live-status', m.status);
    set('live-venue', '🏟️ ' + getStadium(m.home.team));
    renderGoalTimeline();
  }

  function updateStatsPanel() {
    if (!currentMatch) return;
    if (currentMatch.quietSim) return;
    const h = currentMatch.home.stats, a = currentMatch.away.stats;
    const ts = (h.shots + a.shots) || 1, ton = (h.shotsOn + a.shotsOn) || 1;
    const tc = (h.corners + a.corners) || 1, tf = (h.fouls + a.fouls) || 1, tsv = (h.saves + a.saves) || 1;
    const el = document.getElementById('live-stats');
    if (!el) return;
    const hp = (v, t) => t ? Math.round((v/t)*100) : 50;
    el.innerHTML = `
      <div class="stat-row"><span class="stat-val">${h.shots}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${hp(h.shots,ts)}%"></div><div class="stat-bar-away" style="width:${hp(a.shots,ts)}%"></div></div><span class="stat-val">${a.shots}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Shots</div>
      <div class="stat-row"><span class="stat-val">${h.shotsOn}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${hp(h.shotsOn,ton)}%"></div><div class="stat-bar-away" style="width:${hp(a.shotsOn,ton)}%"></div></div><span class="stat-val">${a.shotsOn}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">On Target</div>
      <div class="stat-row"><span class="stat-val">${h.possession}%</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${h.possession}%"></div><div class="stat-bar-away" style="width:${a.possession}%"></div></div><span class="stat-val">${a.possession}%</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Possession</div>
      <div class="stat-row"><span class="stat-val">${h.corners}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${hp(h.corners,tc)}%"></div><div class="stat-bar-away" style="width:${hp(a.corners,tc)}%"></div></div><span class="stat-val">${a.corners}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Corners</div>
      <div class="stat-row"><span class="stat-val">${h.fouls}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${hp(h.fouls,tf)}%"></div><div class="stat-bar-away" style="width:${hp(a.fouls,tf)}%"></div></div><span class="stat-val">${a.fouls}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Fouls</div>
      <div class="stat-row"><span class="stat-val">${h.saves}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${hp(h.saves,tsv)}%"></div><div class="stat-bar-away" style="width:${hp(a.saves,tsv)}%"></div></div><span class="stat-val">${a.saves}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Saves</div>
      <div class="stat-row"><span class="stat-val">${h.yellows}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${hp(h.yellows,h.yellows+a.yellows||1)}%"></div><div class="stat-bar-away" style="width:${hp(a.yellows,h.yellows+a.yellows||1)}%"></div></div><span class="stat-val">${a.yellows}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted)">Yellow Cards</div>`;
  }


  // ===================================================================
  // ================= DYNAMIC PITCH POSITIONING MODEL ==================
  // ===================================================================
  // Each formation slot's [x,y] in FORMATIONS is now only a *base*/resting
  // coordinate, not the drawn position. The actual marker position is
  // recalculated on every renderPitch() call from four live inputs:
  //   1. Ball location  — m.ballZone (set by engine/possession.js and
  //      engine/transitions.js as the simulation runs) tells us which
  //      third/channel of the pitch the ball is currently in, and which
  //      side has it.
  //   2. Tactical stance — both sides' m.tactics entries shift how far a
  //      team pushes up in possession / drops off out of possession, and
  //      how eagerly it holds a high line under an opponent press.
  //   3. Role — a winger or full-back roams far more than a centre-back or
  //      goalkeeper; per-slot mobility tables scale how far each position
  //      is willing to travel from its base spot.
  //   4. Teammate/opponent spacing — the existing collision-avoidance pass
  //      still nudges markers apart from their own teammates so labels
  //      never overlap; since each side renders on its own mini-pitch
  //      panel (not a single shared canvas — see .pitch-pair in
  //      styles.css) there's no literal opposing marker to collide with,
  //      so opponent influence is folded into the ball-zone/tactic model
  //      above instead (i.e. a side's shape reacts to how far the OTHER
  //      side has advanced, which is what actually drives real spacing).
  // Every player still has a stable "home" position (their formation
  // coordinate) and only ever *deviates* from it — this keeps the shape
  // recognizable as the chosen formation while making it visibly breathe
  // with the run of play instead of sitting frozen.
  const ROLE_MOBILITY = {
    //         vertical (forward/back push)   horizontal (width shift)
    GK:  { v: 0.10, h: 0.10 },
    CB:  { v: 0.35, h: 0.25 },
    RB:  { v: 0.70, h: 0.90 }, LB:  { v: 0.70, h: 0.90 },
    RWB: { v: 0.85, h: 0.95 }, LWB: { v: 0.85, h: 0.95 },
    CDM: { v: 0.55, h: 0.30 },
    CM:  { v: 0.80, h: 0.40 },
    CAM: { v: 0.90, h: 0.35 },
    RM:  { v: 0.90, h: 0.85 }, LM:  { v: 0.90, h: 0.85 },
    RW:  { v: 0.90, h: 0.85 }, LW:  { v: 0.90, h: 0.85 },
    ST:  { v: 0.60, h: 0.30 }, CF:  { v: 0.60, h: 0.30 }
  };
  const PHASE_VALUE = { DEF: -1, MID: 0, ATT: 1 };
  const CHANNEL_VALUE = { L: -1, C: 0, R: 1 };
  const MAX_VERTICAL_SHIFT = 12;   // percentage points of pitch height
  const MAX_HORIZONTAL_SHIFT = 9;  // percentage points of pitch width
  const MIRROR_THIRD = { ATT: 'DEF', DEF: 'ATT', MID: 'MID' };

  // Tiny deterministic hash so the same player/minute combination always
  // produces the same jitter (no visible flicker on incidental re-renders)
  // while still changing minute to minute — a stand-in for the constant
  // small drift real players show even while "holding" a position.
  function _pitchJitterSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }

  // Computes this player's live [x, y] from their formation base coordinate,
  // the current ball zone, both sides' tactics, and their own role's
  // mobility. `side` is which mini-pitch panel is being drawn (see the note
  // above on why that's the unit of "opponent awareness" here).
  function computeDynamicPosition(baseX, baseY, slotCode, side, playerId) {
    const m = currentMatch;
    const zone = (m && m.ballZone) || { side: null, third: 'MID', channel: 'C' };
    const oppSide = side === 'home' ? 'away' : 'home';

    // This side's own phase of play: directly the ball's third if this side
    // has it, the mirrored third if the opponent has it (their ATT third is
    // literally bearing down on our goal, i.e. our DEF third), or neutral
    // at kickoff/before the ball has moved.
    const ownPhase = !zone.side ? 'MID' : (zone.side === side ? zone.third : (MIRROR_THIRD[zone.third] || 'MID'));
    const channel = zone.channel || 'C';

    const tac = (m && m.tactics && m.tactics[side]) || 'balanced';
    const oppTac = (m && m.tactics && m.tactics[oppSide]) || 'balanced';

    // How far the team pushes up while it has the ball forward of its own
    // half, and how far it's willing to drop off when it doesn't.
    const attackMult = tac === 'attack' ? 1.35 : tac === 'press' ? 1.15 : tac === 'defend' ? 0.7 : 1.0;
    const retreatMult = tac === 'defend' ? 1.3 : tac === 'press' ? 0.55 : tac === 'attack' ? 0.85 : 1.0;
    // A wide-open opponent (playing Attack) stretches the game both ways;
    // a packed-in opponent (playing Defend) compresses it. Balanced/Press
    // are treated as roughly neutral for this specific effect.
    const spaceFactor = oppTac === 'attack' ? 1.15 : oppTac === 'defend' ? 0.8 : 1.0;

    const phaseVal = PHASE_VALUE[ownPhase] || 0;
    const vBias = (phaseVal > 0 ? phaseVal * attackMult : phaseVal * retreatMult) * spaceFactor;
    const hBias = CHANNEL_VALUE[channel] || 0;

    const mob = ROLE_MOBILITY[slotCode] || { v: 0.6, h: 0.5 };
    // Negative sign: a positive (attacking) phase should pull y DOWN toward
    // the opponent's goal, which is the lower end of the formation's y
    // scale (see FORMATIONS — GK sits at y:92, forwards up around y:15-20).
    const dy = -vBias * mob.v * MAX_VERTICAL_SHIFT;
    const dx = hBias * mob.h * MAX_HORIZONTAL_SHIFT;

    const seed = _pitchJitterSeed(`${playerId}-${(m && m.minute) || 0}`);
    const jitterX = ((seed % 100) - 50) / 50 * 1.4;
    const jitterY = ((Math.floor(seed / 100) % 100) - 50) / 50 * 1.4;

    return [
      Math.max(6, Math.min(94, baseX + dx + jitterX)),
      Math.max(6, Math.min(94, baseY + dy + jitterY))
    ];
  }
  function renderPitch() {
    if (!currentMatch) return;
    const m = currentMatch;
    const wrap = document.getElementById('pitch-display');
    if (!wrap) return;

    const luminance = (c) => {
      if (!c || c[0] !== '#') return 128;
      let hex = c.replace('#','');
      if (hex.length === 3) hex = hex.split('').map(ch => ch+ch).join('');
      if (hex.length < 6) return 128;
      const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
      return (r*299 + g*587 + b*114) / 1000;
    };

    const drawTeam = (side) => {
      const s = m[side];
      const form = FORMATIONS[s.squad.formation] || FORMATIONS['4-3-3'];
      // A hand-built lineup from the Squad Builder's formation editor may
      // carry its own custom marker positions (squad.customCoords) rather
      // than the preset's default coords — see saveSquadBuilder() and
      // sbResetFormationShape() in ui/teamUI.js. Falls back to the preset
      // shape for auto-built squads, exactly as before.
      const coords = s.squad.customCoords || form.coords || [];
      const slots = form.slots || [];
      const onPitchIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
      const allPlayers = [...(s.squad.starting || []), ...(s.squad.subs || []), ...(s.squad.all || [])];
      // Unique by id
      const byId = {};
      allPlayers.forEach(p => { if (p && p.id) byId[p.id] = p; });
      // Map current on-pitch players into formation slots
      const onPitchPlayers = onPitchIds.map(id => byId[id]).filter(Boolean);
      const assigned = new Set();
      const slotPlayers = [];
      // Pass 1 — a player's own recorded `.slot` (set authoritatively by
      // buildSquad/trySubstitution/pickSlotForIncomingSub/changeFormationLive)
      // always claims the formation slot it names, before anything else gets
      // a look-in. This used to be OR'd together with a loose secondary-
      // position check (p.pos.includes(slot)) in a single find() — since a
      // player's pos array often lists more than one position (e.g. a CDM
      // who can also play CM), that loose check could win the very first
      // slot iterated (array order, not each player's true slot) and drag a
      // player away from the slot they were actually placed in, while a
      // completely different player then got shuffled into their vacated
      // spot. That's what made a formation change or a substitution *look*
      // like it had put a striker at CDM or a CM at CB on the pitch view,
      // even though the underlying match data (p.slot) was always correct.
      slots.forEach((slot, idx) => {
        const pick = onPitchPlayers.find(p => !assigned.has(p.id) && p.slot === slot);
        if (pick) {
          assigned.add(pick.id);
          slotPlayers[idx] = pick;
        }
      });
      // Pass 2 — only for slots nobody's own `.slot` matched (e.g. stale
      // data after an edge-case state change). Loosen to secondary
      // position, then broad compatibility, then whoever's left — same as
      // before, just demoted to a fallback instead of competing on equal
      // footing with an exact match.
      slots.forEach((slot, idx) => {
        if (slotPlayers[idx]) return;
        let pick = onPitchPlayers.find(p => !assigned.has(p.id) && (p.pos || []).includes(slot));
        if (!pick) pick = onPitchPlayers.find(p => !assigned.has(p.id) && canPlay(p, slot));
        if (!pick) pick = onPitchPlayers.find(p => !assigned.has(p.id));
        if (pick) {
          assigned.add(pick.id);
          slotPlayers[idx] = pick;
        }
      });
      // Any remaining on-pitch players fill empty slots
      onPitchPlayers.forEach(p => {
        if (assigned.has(p.id)) return;
        const empty = slots.findIndex((_, i) => !slotPlayers[i]);
        if (empty >= 0) { slotPlayers[empty] = p; assigned.add(p.id); }
      });

      let primary = s.team.color || '#1a237e';
      let secondary = s.team.secondary || '#ffffff';
      const textCol = luminance(primary) > 160 ? '#0a0e17' : '#ffffff';
      const used = [];
      let dots = '';
      slotPlayers.forEach((p, idx) => {
        if (!p) return;
        let c = coords[idx] || [50, 50];
        // Base/resting coordinate from the formation preset (or a custom
        // Squad Builder shape) — now only the anchor that
        // computeDynamicPosition() continuously deviates from, rather than
        // the drawn position itself. See the model notes above renderPitch().
        let [x, y] = computeDynamicPosition(c[0], c[1], slots[idx], side, p.id);
        // Collision avoidance: name labels are wider than the dot, so push
        // apart when two dots sit too close together (weighted distance,
        // since labels overflow horizontally more than vertically).
        //
        // Two things were wrong with the previous version, and together
        // they visibly warped most formations' shapes (4-3-3, 4-1-4-1,
        // every back-three/back-five system, etc.):
        //  1. It pushed a dot toward/away from whichever neighbor it
        //     happened to collide with, rather than away from the pitch's
        //     own center line — for a symmetric formation (e.g. a central
        //     CDM sitting between two wide CMs) this dragged the CENTER
        //     player sideways into one teammate's territory instead of
        //     nudging outward, breaking left/right symmetry.
        //  2. It also jittered players vertically, which pulled the
        //     center-back of every back-three formation out of its
        //     designed deeper "sweeper" spot and flattened the back line.
        // The fix: only ever push horizontally, and always outward from
        // pitch-center (x=50) based on the dot's OWN side — so a nudge
        // preserves the formation's shape/symmetry instead of distorting
        // it. The goalkeeper is also excluded from the check entirely: it
        // sits alone at the byline and its designed proximity to a deep
        // center-back (intentional in back-three systems) was being
        // mistaken for a dot overlap.
        if (idx !== 0) {
          for (let t = 0; t < 8; t++) {
            const hit = used.find(u => Math.hypot((u.x - x) * 1.5, u.y - y) < 16);
            if (!hit) break;
            const dir = (x - 50) >= 0 ? 1 : -1;
            x += dir * 4;
            x = Math.max(8, Math.min(92, x));
          }
        }
        if (idx !== 0) used.push({ x, y });

        const isSubOn = (s.squad.subs || []).some(sub => sub.id === p.id);
        dots += `<div class="player-dot${isSubOn ? ' sub-on' : ''}" style="left:${x}%;top:${y}%;background:${primary};border:2px solid ${secondary}">
          <span class="dot-pos">${slots[idx] || ''}</span>
          <span class="dot-avatar">${playerAvatarMark(p)}</span>
          <span class="dot-label"><span class="dot-num">${p.num || ''}</span><span class="dot-name">${playerNameHTML(p, abbreviateName(p.name))}</span></span>
        </div>`;
      });
      const mgrStyle = getManagerPlaystyle(s.team);
      // Sits in the same top strip as the team/formation label, tucked into
      // whichever top corner is the *outer* edge of this pitch box (left
      // corner for the home column, right corner for the away column) so
      // its name+playstyle label — which is wider than the box's own
      // corner margin — grows outward into open space instead of into the
      // other team's pitch across the narrow gap between them.
      const mgrSide = `left:${side === 'away' ? '91' : '9'}%;`;
      const mgrDot = s.team.manager && s.team.manager.name
        ? `<div class="player-dot manager-dot" style="${mgrSide}top:11%">
          <span class="dot-avatar">${managerAvatarMark(s.team.manager, 46)}</span>
          <span class="dot-label"><span class="dot-name">${s.team.manager.name}${mgrStyle ? ' · ' + mgrStyle : ''}</span></span>
        </div>` : '';
      return `<div class="mini-pitch team-pitch">
        <div class="pitch-label">${teamMark(s.team, 16)} ${s.team.short} · ${form.name}</div>
        ${dots}
        ${mgrDot}
      </div>`;
    };

    wrap.innerHTML = `<div class="pitch-pair">${drawTeam('home')}${drawTeam('away')}</div>`;
  }


  function playerLineIcons(ps, subInfo, onPitch, inj) {
    let icons = '';
    if (ps) {
      for (let i = 0; i < (ps.goals || 0); i++) icons += `<span class="li-icon" title="Goal">${emojiImg('goal', 'Goal')}</span>`;
      for (let i = 0; i < (ps.assists || 0); i++) icons += `<span class="li-icon" title="Assist">${emojiImg('assist', 'Assist')}</span>`;
      if (ps.yellow) icons += `<span class="li-icon" title="Yellow">${emojiImg('yellow_card', 'Yellow card')}</span>`;
      if (ps.red) icons += `<span class="li-icon" title="Red">${emojiImg('red_card', 'Red card')}</span>`;
    }
    if (inj) icons += '<span class="li-icon" title="Injured">🩹</span>';
    if (subInfo && subInfo.outMin != null) icons += `<span class="li-sub out" title="Subbed off">🔻${subInfo.outMin}'</span>`;
    if (subInfo && subInfo.inMin != null) icons += `<span class="li-sub in" title="Subbed on">🔺${subInfo.inMin}'</span>`;
    return icons;
  }

  function liveRatingBadge(ps) {
    if (!ps) return '<span class="rating-badge rating-mid">6.0</span>';
    const r = calcPlayerRating(ps);
    ps.rating = r;
    const cls = r >= 7.5 ? 'rating-high' : r >= 6.5 ? 'rating-mid' : 'rating-low';
    return `<span class="rating-badge ${cls}">${r.toFixed(1)}</span>`;
  }

  function renderLineups() {
    if (!currentMatch) return;
    const m = currentMatch;
    if (!m.playerMatchStats) m.playerMatchStats = {};
    if (!m.subLog) m.subLog = { home: {}, away: {} };

    const row = (p, side, isSubList) => {
      const onPitchIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
      const on = onPitchIds.includes(p.id);
      const inj = (m.injuries || []).includes(p.id);
      if (!m.playerMatchStats[p.id]) m.playerMatchStats[p.id] = blankPlayerMatchStats(p);
      const ps = m.playerMatchStats[p.id];
      // Keep the live rating badge in sync with the current scoreline too,
      // not just the final rating computed at full time in endMatch.
      ps.goalsConceded = side === 'home' ? m.away.score : m.home.score;
      const subInfo = (m.subLog[side] || {})[p.id];
      const sentOff = !!ps.red;
      const icons = playerLineIcons(ps, subInfo, on, inj);
      const rating = liveRatingBadge(ps);
      const cond = conditionBadgeHTML(p);
      const dim = (!on && !inj && !sentOff && !(subInfo && subInfo.outMin != null)) ? 'opacity:0.55' : '';
      const pos = p.slot || (p.pos || [''])[0] || '';
      return `<li class="player-item ${isSubList ? 'sub' : ''} ${inj ? 'injured' : ''} ${sentOff ? 'sent-off' : ''}" onclick="App.showPlayerProfile('${p.id}')" style="cursor:pointer;${dim}">
        <span class="player-num">${p.num || ''}</span>
        <span class="player-pos">${pos}</span>
        <span class="player-name">${playerNameHTML(p)}${roleBadgesHTML(p, side)}${sentOff ? ' <span class="sent-off-tag">SENT OFF</span>' : ''}</span>
        <span class="player-icons">${icons}</span>
        ${cond}
        ${rating}
      </li>`;
    };

    const html = (side) => {
      const s = m[side];
      const used = side === 'home' ? m.homeSubsUsed : m.awaySubsUsed;
      const form = (FORMATIONS[s.squad.formation] || {}).name || s.squad.formation || '';
      const tac = (m.tactics && m.tactics[side]) || 'balanced';
      let h = `<div class="lineup-team">
        <h4>${teamMark(s.team, 18)} ${s.team.short || s.team.name} · ${form}
          <span class="subs-badge">${used}/${m.maxSubs || 5} subs</span>
          <span class="tac-badge">${tac}</span>
        </h4>
        <ul class="player-list">`;
      // Starting XI order, including those subbed off
      (s.squad.starting || []).forEach(p => { h += row(p, side, false); });
      // Subs: original bench + any who came on already listed? Show all bench pool
      h += `<li class="bench-label">Substitutes</li>`;
      (s.squad.subs || []).forEach(p => { h += row(p, side, true); });
      return h + '</ul></div>';
    };

    const el = document.getElementById('lineup-display');
    if (el) el.innerHTML = html('home') + html('away');
    // Live tactics / formation controls during match
    let ctrl = document.getElementById('live-tactics-bar');
    if (!ctrl) {
      const parent = document.getElementById('lineup-display');
      if (parent && parent.parentNode) {
        ctrl = document.createElement('div');
        ctrl.id = 'live-tactics-bar';
        parent.parentNode.insertBefore(ctrl, parent);
      }
    }
    if (ctrl && !m.finished && !m.quietSim) {
      const forms = Object.keys(FORMATIONS).map(f => `<option value="${f}">${f}</option>`).join('');
      ctrl.innerHTML = `
        <div class="live-tac-row">
          <span class="live-tac-label">Home</span>
          <select id="live-form-home" onchange="App.changeFormationLive('home', this.value)">${forms}</select>
          <select id="live-tac-home" onchange="App.setTacticsLive('home', this.value)">
            <option value="balanced">Balanced</option>
            <option value="attack">Attack</option>
            <option value="defend">Defend</option>
            <option value="press">Press</option>
          </select>
          <span class="live-tac-label">Away</span>
          <select id="live-form-away" onchange="App.changeFormationLive('away', this.value)">${forms}</select>
          <select id="live-tac-away" onchange="App.setTacticsLive('away', this.value)">
            <option value="balanced">Balanced</option>
            <option value="attack">Attack</option>
            <option value="defend">Defend</option>
            <option value="press">Press</option>
          </select>
        </div>`;
      const fh = document.getElementById('live-form-home');
      const fa = document.getElementById('live-form-away');
      const th = document.getElementById('live-tac-home');
      const ta = document.getElementById('live-tac-away');
      if (fh) fh.value = m.home.squad.formation || '4-3-3';
      if (fa) fa.value = m.away.squad.formation || '4-3-3';
      if (th) th.value = (m.tactics && m.tactics.home) || 'balanced';
      if (ta) ta.value = (m.tactics && m.tactics.away) || 'balanced';
    } else if (ctrl && m.finished) {
      ctrl.innerHTML = '';
    }
    renderPitch();
  }


  // Shape used for every per-competition stat bucket: season leagues, the season's
  // UCL, and (already existing) the global `stats` / `tournamentStats` buckets.
  function blankCompStats() {
    return { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, cards: {}, motm: {}, puskas: {}, ratings: {}, interceptions: {}, tackles: {}, bigGames: {} };
  }

  function bumpStatBucket(bucket, type, player, team) {
    bumpStatBucketBy(bucket, type, player, team, 1);
  }

  // Like bumpStatBucket, but adds an arbitrary amount in one go — used for
  // per-match accumulated totals (e.g. interceptions/tackles over 90 minutes)
  // rather than one-off events like a goal or a card.
  function bumpStatBucketBy(bucket, type, player, team, amount) {
    if (!amount) return;
    if (!bucket[type]) bucket[type] = {};
    if (!bucket[type][player.id]) {
      const aff = findPlayerTeams(player.id);
      bucket[type][player.id] = { id: player.id, name: player.name, team: team.name, teamId: team.id, count: 0, national: aff.national, club: aff.club };
    }
    bucket[type][player.id].count += amount;
  }


  // Generalized keyed-average bucket: powers both the plain `ratings` bucket
  // (every appearance) and the `bigGames` bucket (knockout/final/top-clash
  // appearances only) with the same count/sum/avg shape, plus a short rolling
  // history of recent ratings so award scoring can gauge consistency (low
  // variance at a genuinely good level) rather than just a career average.
  function bumpKeyedAvgBucket(bucket, key, player, team, rating) {
    if (!bucket[key]) bucket[key] = {};
    if (!bucket[key][player.id]) {
      const aff = findPlayerTeams(player.id);
      bucket[key][player.id] = { id: player.id, name: player.name, team: team.name, teamId: team.id, count: 0, sum: 0, avg: 0, national: aff.national, club: aff.club, recent: [] };
    }
    const e = bucket[key][player.id];
    e.count++;
    e.sum += rating;
    e.avg = Math.round((e.sum / e.count) * 100) / 100;
    if (!e.recent) e.recent = [];
    e.recent.push(rating);
    if (e.recent.length > 12) e.recent.shift();
  }
  function bumpRatingBucket(bucket, player, team, rating) {
    bumpKeyedAvgBucket(bucket, 'ratings', player, team, rating);
  }

  // A match counts as a "big game" for award-scoring purposes when it's a
  // knockout-stage/final fixture in a tournament or the season's Champions
  // League, or a clash between two genuinely top-tier sides (judged by
  // starting-XI average OVR) — the kind of fixture that actually shapes a
  // Ballon d'Or/Golden Ball case in real life, not just bulk appearances.
  function isBigGameContext(m) {
    if (!m) return false;
    if (tournament && tournament.stage === 'knockout') return true;
    if (currentSeasonComp && ['qf', 'sf', 'final'].includes(currentSeasonComp.stage)) return true;
    const avgOvr = (side) => {
      const arr = (side && side.squad && side.squad.starting) || [];
      if (!arr.length) return 0;
      return arr.reduce((s, p) => s + (p.ovr || 70), 0) / arr.length;
    };
    return avgOvr(m.home) >= 82 && avgOvr(m.away) >= 82;
  }

  function recordRating(player, team, rating) {
    if (!player || !team) return;
    const competitive = !!(tournament || (currentMatch && currentMatch.countForLeaderboard));
    if (competitive) bumpRatingBucket(stats, player, team, rating);
    if (tournament) bumpRatingBucket(tournamentStats, player, team, rating);
    if (currentSeasonComp) {
      if (!currentSeasonComp.stats) currentSeasonComp.stats = blankCompStats();
      bumpRatingBucket(currentSeasonComp.stats, player, team, rating);
    }
    if (currentMatch && currentMatch.isBigGame) {
      if (competitive) bumpKeyedAvgBucket(stats, 'bigGames', player, team, rating);
      if (tournament) bumpKeyedAvgBucket(tournamentStats, 'bigGames', player, team, rating);
      if (currentSeasonComp) {
        if (!currentSeasonComp.stats) currentSeasonComp.stats = blankCompStats();
        bumpKeyedAvgBucket(currentSeasonComp.stats, 'bigGames', player, team, rating);
      }
    }
  }

  // ========== PLAYER FORM & CONDITION ==========
  // The old rolling numeric-form-into-OVR system that used to live in this
  // file has been removed and replaced by the eFootball-style Form &
  // Condition system in engine/form.js (form type + liveRating tier +
  // per-match condition roll). See that file for updatePlayerForm's
  // replacement (updateLiveRatingAfterMatch), formArrow/formLabel, and
  // collectPlayerFormsMap. Nothing here folds into baseOvr/ovr anymore.







  function persistPlayerForms() {
    try {
      return safeSetItem('apexPlayerForms', JSON.stringify(collectPlayerFormsMap()));
    } catch (e) { return false; }
  }
  // Restores each player's persistent liveRating ("A".."E") from a
  // previous session — see collectPlayerFormsMap() in engine/form.js for
  // what gets saved. Deliberately only touches liveRating: baseOvr/ovr
  // are re-derived fresh every load by applyExpandedPlayerAttributes()
  // (which runs after this), and `form` (Unwavering/Standard/
  // Inconsistent) is re-derived from player-attributes.json by
  // ensureAllPlayerConditionProfiles() rather than saved/restored here.
  function restorePlayerForms() {
    try {
      const raw = localStorage.getItem('apexPlayerForms');
      if (!raw) return;
      const map = JSON.parse(raw);
      allTeams.forEach(t => (t.players || []).forEach(p => {
        const e = map[p.id];
        if (e && LIVE_RATINGS.includes(e.liveRating)) p.liveRating = e.liveRating;
      }));
    } catch (e) {}
  }

  function findPlayerTeams(playerId) {
    let national = null, club = null;
    (teamsData.national || []).forEach(t => {
      if ((t.players || []).some(p => p.id === playerId)) national = t.name;
    });
    (teamsData.club || []).forEach(t => {
      if ((t.players || []).some(p => p.id === playerId)) club = t.name;
    });
    // Same real player may exist as two separate roster entries (club + country)
    // with different ids — fall back to a name match to link them. Because
    // different, unrelated players CAN share an identical name, this fallback
    // only accepts a match when it's unambiguous: exactly one other roster
    // entry with that name, and its position overlaps the source player's
    // position. Ambiguous name collisions are left blank rather than risking
    // attributing one player's country/club to a different, same-named player.
    if (!national || !club) {
      let srcPlayer = null;
      allTeams.forEach(t => {
        const p = (t.players || []).find(x => x.id === playerId);
        if (p) srcPlayer = p;
      });
      if (srcPlayer && srcPlayer.name) {
        const pname = srcPlayer.name;
        const srcPos = (srcPlayer.pos || [])[0];
        const posMatches = (p) => !srcPos || !p.pos || !p.pos.length || p.pos.includes(srcPos);
        if (!national) {
          const matches = [];
          (teamsData.national || []).forEach(t => {
            (t.players || []).forEach(p => {
              if (p.id !== playerId && p.name === pname && posMatches(p)) matches.push(t.name);
            });
          });
          const uniqueTeams = [...new Set(matches)];
          if (uniqueTeams.length === 1) national = uniqueTeams[0];
        }
        if (!club) {
          const matches = [];
          (teamsData.club || []).forEach(t => {
            (t.players || []).forEach(p => {
              if (p.id !== playerId && p.name === pname && posMatches(p)) matches.push(t.name);
            });
          });
          const uniqueTeams = [...new Set(matches)];
          if (uniqueTeams.length === 1) club = uniqueTeams[0];
        }
      }
    }
    return { national, club };
  }

  function recordStat(type, player, team) {
    if (!player || !team) return;
    // Friendlies do not feed global leaderboard — only competitive (tournament/season) matches
    const competitive = !!(tournament || (currentMatch && currentMatch.countForLeaderboard));
    if (competitive) bumpStatBucket(stats, type, player, team);
    if (tournament) bumpStatBucket(tournamentStats, type, player, team);
    if (currentSeasonComp) {
      if (!currentSeasonComp.stats) currentSeasonComp.stats = blankCompStats();
      bumpStatBucket(currentSeasonComp.stats, type, player, team);
    }
  }

  // Like recordStat, but adds an accumulated per-match total (e.g. a
  // defender's interception/tackle count for the whole match) in one go.
  function recordStatCount(type, player, team, amount) {
    if (!player || !team || !amount) return;
    const competitive = !!(tournament || (currentMatch && currentMatch.countForLeaderboard));
    if (competitive) bumpStatBucketBy(stats, type, player, team, amount);
    if (tournament) bumpStatBucketBy(tournamentStats, type, player, team, amount);
    if (currentSeasonComp) {
      if (!currentSeasonComp.stats) currentSeasonComp.stats = blankCompStats();
      bumpStatBucketBy(currentSeasonComp.stats, type, player, team, amount);
    }
  }

  // ========== TROPHY CASE (team trophies + individual awards) ==========
  // Every entry uses `name` to key into trophies.json (via trophyMark()) so
  // it always renders with a real trophy/medal image. Individual awards also
  // set `player` — that's what powers the Teams-tab trophy cabinet and the
  // History tab's "Individual Awards" list.
  function saveTrophiesToStorage() {
    try { return safeSetItem('apexTrophies', JSON.stringify(trophies)); } catch (e) { return false; }
  }
  function pushTeamTrophy(name, teamName, type, extra) {
    const t = Object.assign({ name, team: teamName, type, date: Date.now() }, extra || {});
    trophies.push(t);
    saveTrophiesToStorage();
    return t;
  }
  function pushIndividualTrophy(awardName, playerObj, type, extra) {
    if (!playerObj || !playerObj.name) return null;
    const t = Object.assign({ name: awardName, team: playerObj.team || '', player: playerObj.name, type, date: Date.now() }, extra || {});
    trophies.push(t);
    saveTrophiesToStorage();
    return t;
  }
  // Manager awards live alongside individual player awards in the trophy
  // case, but key off `manager` (a name) instead of `player` — awarded
  // whenever their team lifts a trophy (league title, UCL, or a standalone
  // World Cup/Champions League run), crediting the manager for that
  // team's success. Shows in Awards > Manager and History > Individual.
  function pushManagerAward(awardName, team, type, extra) {
    if (!team || !team.manager || !team.manager.name) return null;
    const t = Object.assign({ name: awardName, team: team.name, manager: team.manager.name, type, date: Date.now() }, extra || {});
    trophies.push(t);
    saveTrophiesToStorage();
    return t;
  }
  // Records the individual awards computed for a tournament/competition's
  // `.awards` object (already produced by assignTournamentAwards() /
  // assignCompAwards()) into the trophy case, one entry per winner.
  function recordIndividualAwardsFromAwardsObject(awardsObj, type, extra) {
    if (!awardsObj) return;
    const map = [
      ['goldenBoot', 'Golden Boot'], ['goldenBall', 'Golden Ball'], ['goldenGlove', 'Golden Glove'],
      ['goldenClean', 'Clean Sheet King'], ['topAssists', 'Top Assists'], ['mostMotm', 'Most MOTM'],
      ['bestAvgRating', 'Best Avg Rating'], ['puskas', 'Puskás Award'], ['gerdMuller', 'Gerd Müller Award'],
      ['yashin', 'Yashin Trophy'], ['ballonDor', "Ballon d'Or"]
    ];
    map.forEach(([key, awardName]) => {
      if (awardsObj[key]) pushIndividualTrophy(awardName, awardsObj[key], type, extra);
    });
  }

  // Ballon d'Or ranking algorithm, shared by the interactive Awards > Ballon
  // d'Or tab and the automatic season-end archiving — kept in one place so
  // both always agree on who the leader is. Pass in a `stats`-shaped object
  // (global `stats`, a competition's `comp.stats`, etc).
  const BALLON_MIN_APPS = 3;
  // Real-world trophy prestige, used to weigh a player's career trophy case
  // in the Ballon d'Or scoring below. A World Cup should move the needle far
  // more than a domestic cup — this is what separates "won a trophy" from
  // "won THE trophy" the way the real award does.
  const TROPHY_VALUE = {
    'World Cup': 10,
    'European Championship': 8,
    'Copa América': 7,
    'Champions League': 7,
    'Nations League': 4,
    'Africa Cup of Nations': 4,
    'AFC Asian Cup': 4,
    'CONCACAF Gold Cup': 3,
    'Premier League': 3, 'La Liga': 3, 'Serie A': 3, 'Bundesliga': 3, 'Ligue 1': 3,
    'FA Cup': 1.5, 'Copa del Rey': 1.5, 'DFB-Pokal': 1.5, 'Coppa Italia': 1.5, 'Coupe de France': 1.5,
    'EFL Cup': 1, 'Supercopa de España': 1, 'DFL-Supercup': 1, 'Supercoppa Italiana': 1,
    'FA Community Shield': 0.6, 'Trophée des Champions': 0.6
  };
  const TROPHY_VALUE_DEFAULT = 2; // unrecognized team trophy name (e.g. a custom league/cup) — treat as a mid-tier domestic honor
  const INDIVIDUAL_AWARD_VALUE = { "Ballon d'Or": 2.5, 'Golden Ball': 1.8 };
  const INDIVIDUAL_AWARD_VALUE_DEFAULT = 0.7;
  const CAREER_TROPHY_CAP = 30; // so one long, decorated career can't swamp current-season form entirely

  // Sums a player's permanent trophy case (career-wide, not just this
  // season/tournament — real Ballon d'Or voting weighs pedigree) into a
  // single points value: team trophies count only when won with the
  // player's current club/country (the best proxy available for "won it
  // themselves" rather than a teammate's medal), weighted by how
  // prestigious that competition actually is; past individual awards add a
  // smaller amount on top, with the Ballon d'Or/Golden Ball itself worth
  // the most since winning it before is the single strongest pedigree signal.
  function careerTrophyValue(playerName, aff) {
    let pts = 0;
    (trophies || []).forEach(t => {
      if (t.player === playerName) {
        pts += INDIVIDUAL_AWARD_VALUE[t.name] != null ? INDIVIDUAL_AWARD_VALUE[t.name] : INDIVIDUAL_AWARD_VALUE_DEFAULT;
        return;
      }
      if (t.team && !t.manager) {
        if ((aff.club && t.team === aff.club) || (aff.national && t.team === aff.national)) {
          pts += TROPHY_VALUE[t.name] != null ? TROPHY_VALUE[t.name] : TROPHY_VALUE_DEFAULT;
        }
      }
    });
    return Math.round(Math.min(pts, CAREER_TROPHY_CAP) * 10) / 10;
  }

  // Holistic "best player" scoring shared by the Ballon d'Or ranking (season/
  // global `stats`) and the tournament Golden Ball (`tournamentStats`) — a
  // real MVP vote isn't just "who scored/rated highest", it weighs where
  // those numbers came from. Folds in:
  //  - individual statistics: raw production (goals/assists/MOTM/saves/
  //    clean sheets/Puskas contenders) plus overall match rating quality.
  //  - domestic performance: rating quality sustained across a league campaign.
  //  - continental performance: the season's Champions League run (or a
  //    standalone Champions League tournament), weighted above domestic
  //    since continental football carries more real-world Ballon d'Or weight.
  //  - international performance: a World Cup run, weighted highest of all —
  //    a big international tournament moves the needle more than a single
  //    club season ever does.
  //  - trophies: lifting a league title, continental trophy, or international
  //    trophy with the squad that season, plus a small nod to past individual
  //    silverware (established quality/reputation).
  //  - consistency: low match-to-match rating variance at a genuinely good
  //    level, not just one or two standout performances propping up an average.
  //  - big games: how a player performed specifically in knockout-stage/final
  //    fixtures and clashes against other top sides, not just accumulated bulk.
  function computeContextualPlayerScores(baseStats, minApps) {
    const src = baseStats || stats;
    const MIN_APPS = minApps || BALLON_MIN_APPS;
    const scores = {};
    const ensure = (p) => {
      if (!scores[p.id]) scores[p.id] = { id: p.id, name: p.name, team: p.team, pts: 0, goals: 0, assists: 0, motm: 0, avg: 0, apps: 0, noms: 0, trophyPts: 0, consistency: 0, bigGamePts: 0 };
      return scores[p.id];
    };

    // ---- Individual statistics ----
    Object.values(src.ratings || {}).forEach(p => {
      const e = ensure(p);
      e.apps = p.count || 0;
      e.avg = p.avg || 0;
    });
    Object.values(src.goals || {}).forEach(p => { const e = ensure(p); e.goals = p.count; e.pts += p.count * 3.2; });
    Object.values(src.assists || {}).forEach(p => { const e = ensure(p); e.assists = p.count; e.pts += p.count * 2.1; });
    Object.values(src.motm || {}).forEach(p => { const e = ensure(p); e.motm = p.count; e.pts += p.count * 3.6; });
    Object.values(src.saves || {}).forEach(p => { const e = ensure(p); e.pts += p.count * 0.3; });
    Object.values(src.cleanSheets || {}).forEach(p => { const e = ensure(p); e.pts += p.count * 1.6; });
    Object.values(src.puskas || {}).forEach(p => { const e = ensure(p); e.pts += p.count * 1.2; });
    Object.values(scores).forEach(e => {
      if (e.apps >= MIN_APPS && e.avg > 0) e.pts += e.avg * Math.min(e.apps, 15) * 0.65;
      else if (e.apps > 0 && e.apps < MIN_APPS) e.pts += e.avg * 0.12;
    });

    // ---- Domestic performance (league campaign quality) ----
    if (season && Array.isArray(season.leagues)) {
      season.leagues.forEach(lg => {
        if (!lg.stats) return;
        Object.values(lg.stats.ratings || {}).forEach(p => {
          const e = ensure(p);
          if (p.count >= 3 && p.avg > 0) e.pts += p.avg * Math.min(p.count, 20) * 0.35;
        });
        Object.values(lg.stats.goals || {}).forEach(p => { const e = ensure(p); e.pts += p.count * 0.6; });
        Object.values(lg.stats.assists || {}).forEach(p => { const e = ensure(p); e.pts += p.count * 0.4; });
      });
    }

    // ---- Continental performance (season UCL run, or a standalone UCL tournament) ----
    if (season && season.ucl && season.ucl.stats) {
      Object.values(season.ucl.stats.ratings || {}).forEach(p => {
        const e = ensure(p);
        if (p.count >= 2 && p.avg > 0) e.pts += p.avg * Math.min(p.count, 13) * 0.55;
      });
      Object.values(season.ucl.stats.goals || {}).forEach(p => { const e = ensure(p); e.pts += p.count * 1.3; });
      Object.values(season.ucl.stats.assists || {}).forEach(p => { const e = ensure(p); e.pts += p.count * 0.9; });
    }
    if (tournament && tournament.type === 'ucl' && tournamentStats && tournamentStats !== src) {
      Object.values(tournamentStats.ratings || {}).forEach(p => {
        const e = ensure(p);
        if (p.count >= 2 && p.avg > 0) e.pts += p.avg * Math.min(p.count, 13) * 0.55;
      });
    }

    // ---- International performance (World Cup — highest single-tournament weight) ----
    if (tournament && tournament.type === 'worldcup' && tournamentStats) {
      Object.values(tournamentStats.ratings || {}).forEach(p => {
        const e = ensure(p);
        if (p.count >= 2 && p.avg > 0) e.pts += p.avg * Math.min(p.count, 7) * 0.9;
      });
      Object.values(tournamentStats.goals || {}).forEach(p => { const e = ensure(p); e.pts += p.count * 1.6; });
      Object.values(tournamentStats.assists || {}).forEach(p => { const e = ensure(p); e.pts += p.count * 1.1; });
    }

    // ---- Big games (knockout-stage/final fixtures and top-vs-top clashes) ----
    const bigGameSources = [
      src.bigGames,
      season && season.ucl && season.ucl.stats && season.ucl.stats.bigGames,
      tournamentStats && tournamentStats !== src && tournamentStats.bigGames
    ];
    bigGameSources.forEach(bg => {
      if (!bg) return;
      Object.values(bg).forEach(p => {
        const e = ensure(p);
        if (p.count > 0 && p.avg > 0) { e.pts += p.avg * Math.min(p.count, 10) * 0.5; e.bigGamePts = Math.round(e.bigGamePts + p.avg * Math.min(p.count, 10) * 0.5); }
      });
    });

    // ---- Trophies (real-world Ballon d'Or weighting: what you've actually ----
    // ---- won, and how prestigious it was, carried across the player's ----
    // ---- whole career trophy case — not just a flat "won something" flag) ----
    Object.values(scores).forEach(e => {
      const aff = findPlayerTeams(e.id) || {};
      e.trophyPts = careerTrophyValue(e.name, aff);
      e.pts += e.trophyPts;
    });

    // ---- Consistency (steady quality across recent appearances, not one hot streak) ----
    Object.values(scores).forEach(e => {
      const rEntry = (src.ratings || {})[e.id];
      const recent = rEntry && rEntry.recent;
      if (recent && recent.length >= 5) {
        const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
        const variance = recent.reduce((a, b) => a + (b - mean) * (b - mean), 0) / recent.length;
        const stdev = Math.sqrt(variance);
        const consistencyBonus = mean >= 6.3 ? Math.max(0, 2.4 - stdev) * 1.1 : 0;
        e.pts += consistencyBonus;
        e.consistency = Math.round(consistencyBonus * 10) / 10;
      }
    });

    // ---- Award-show nomination bonus: a genuine contender shows up across ----
    // ---- multiple individual categories, not just one ----
    const awardLeaders = {
      goldenboot: new Set(Object.values(src.goals || {}).sort((a,b)=>b.count-a.count).slice(0,50).map(p=>p.id)),
      assists: new Set(Object.values(src.assists || {}).sort((a,b)=>b.count-a.count).slice(0,50).map(p=>p.id)),
      motm: new Set(Object.values(src.motm || {}).sort((a,b)=>b.count-a.count).slice(0,50).map(p=>p.id)),
      yashin: new Set(Object.values(src.saves || {}).sort((a,b)=>b.count-a.count).slice(0,50).map(p=>p.id)),
      puskas: new Set(Object.values(src.puskas || {}).sort((a,b)=>b.count-a.count).slice(0,50).map(p=>p.id))
    };
    Object.values(scores).forEach(e => {
      let noms = 0;
      Object.values(awardLeaders).forEach(set => { if (set.has(e.id)) noms++; });
      e.noms = noms;
      if (noms >= 2) e.pts += (noms - 1) * 1.2;
    });

    return scores;
  }
  function computeBallonRanking(statsSource) {
    const src = statsSource || stats;
    const MIN_APPS = BALLON_MIN_APPS;
    const scores = computeContextualPlayerScores(src, MIN_APPS);
    return Object.values(scores)
      .filter(p => p.pts > 0 && (p.apps >= MIN_APPS || p.goals + p.assists + p.motm >= 3))
      .sort((a,b) => b.pts - a.pts || b.apps - a.apps)
      .slice(0, 50);
  }
  // Gerd Müller Award (best pure striker) and Yashin Trophy (best
  // goalkeeper) ranking algorithms — kept in one place so the interactive
  // Awards tab and the automatic season/tournament-end archiving always
  // agree on the winner, same pattern as computeBallonRanking above.
  function computeGerdMullerRanking(statsSource) {
    const src = statsSource || stats;
    const scores = {};
    Object.values(src.goals || {}).forEach(p => {
      scores[p.id] = { id: p.id, name: p.name, team: p.team, goals: p.count, assists: 0, pts: p.count * 5 };
    });
    Object.values(src.assists || {}).forEach(p => {
      if (!scores[p.id]) scores[p.id] = { id: p.id, name: p.name, team: p.team, goals: 0, assists: 0, pts: 0 };
      scores[p.id].assists = p.count;
      scores[p.id].pts += p.count * 0.8;
    });
    Object.values(scores).forEach(s => {
      let isST = false;
      for (const t of allTeams) {
        const pl = (t.players || []).find(x => x.id === s.id);
        if (pl && (pl.pos || []).some(pos => ['ST','CF','FW'].includes(pos))) { isST = true; break; }
      }
      if (isST) s.pts += 2;
    });
    return Object.values(scores).filter(p => p.goals > 0).sort((a,b) => b.pts - a.pts || b.goals - a.goals);
  }
  function computeYashinRanking(statsSource) {
    const src = statsSource || stats;
    const scores = {};
    Object.values(src.saves || {}).forEach(p => {
      scores[p.id] = { id: p.id, name: p.name, team: p.team, saves: p.count, clean: 0, pts: p.count * 1.2 };
    });
    Object.values(src.cleanSheets || {}).forEach(p => {
      if (!scores[p.id]) scores[p.id] = { id: p.id, name: p.name, team: p.team, saves: 0, clean: 0, pts: 0 };
      scores[p.id].clean = p.count;
      scores[p.id].pts += p.count * 4;
    });
    Object.values(src.motm || {}).forEach(p => { if (scores[p.id]) scores[p.id].pts += p.count * 3; });
    Object.values(src.ratings || {}).forEach(p => { if (scores[p.id]) scores[p.id].pts += (p.avg || 0) * Math.min(p.count, 10) * 0.3; });
    return Object.values(scores).filter(p => p.saves > 0 || p.clean > 0).sort((a,b) => b.pts - a.pts);
  }

  // Snapshots the current global leaderboard leaders (Golden Boot, Ballon
  // d'Or, Golden Glove, Yashin Trophy, Top Assists, Most MOTM, Clean Sheet
  // King, Puskás Award, Gerd Müller Award) into the trophy case
  // as individual awards for the season that just ended, then wipes `stats`
  // and `tournamentStats` so the new season's leaderboard & Awards tab start
  // from zero. Team trophies (league/UCL winners) are left untouched — the
  // trophy case is a permanent record, only the live leaderboard resets.
  function archiveAndResetGlobalAwards(year) {
    const extra = { category: 'season-global', year };
    const type = 'Season Y' + year + ' (Global)';
    const topOf = (key) => Object.values(stats[key] || {}).sort((a,b) => b.count - a.count)[0] || null;
    pushIndividualTrophy('Golden Boot', topOf('goals'), type, extra);
    pushIndividualTrophy('Top Assists', topOf('assists'), type, extra);
    pushIndividualTrophy('Most MOTM', topOf('motm'), type, extra);
    pushIndividualTrophy('Golden Glove', topOf('saves'), type, extra);
    pushIndividualTrophy('Clean Sheet King', topOf('cleanSheets'), type, extra);
    pushIndividualTrophy('Puskás Award', topOf('puskas'), type, extra);
    pushIndividualTrophy('Gerd Müller Award', computeGerdMullerRanking(stats)[0] || null, type, extra);
    pushIndividualTrophy('Yashin Trophy', computeYashinRanking(stats)[0] || null, type, extra);
    const ballon = computeBallonRanking(stats)[0] || null;
    pushIndividualTrophy("Ballon d'Or", ballon, type, extra);
    stats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, cards: {}, motm: {}, puskas: {}, ratings: {}, interceptions: {}, tackles: {}, bigGames: {} };
    // Only clear tournamentStats if there's no standalone Tournament (World
    // Cup/UCL, separate from the Season Calendar) currently in progress —
    // otherwise this would wipe that tournament's own live leaderboard mid-run.
    if (!tournament || tournament.champion) {
      tournamentStats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, motm: {}, ratings: {}, puskas: {}, interceptions: {}, tackles: {}, bigGames: {} };
    }
    saveStats();
  }

  // Called after every season-mutating sim step. Fires exactly once, right
  // when a season's last matchday completes (all leagues + the Champions
  // League finished) — archives that season's individual award winners and
  // resets the global leaderboard/Awards tab for the new season ahead.
  function finalizeSeasonIfComplete() {
    if (!season || season.archived) return;
    if (!seasonIsComplete()) return;
    season.archived = true;
    season.completedAt = Date.now();
    archiveAndResetGlobalAwards(season.year);
    toast('Season ' + season.year + ' complete! Awards & leaderboard archived to History and reset.');
  }

  // True once we've warned the person this session that browser storage is
  // full — avoids re-toasting every 4s from the autosave interval below.
  let _storageQuotaWarned = false;
  function isQuotaError(e) {
    return !!e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014 ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED');
  }
  // Wraps localStorage.setItem so a full-storage failure is surfaced to the
  // person (once per session) instead of vanishing into an empty catch.
  // Silently swallowing a failed write here is exactly how a browser save
  // could quietly stop matching the matches actually played — the write
  // looks like it happened (no error shown) but the old, smaller value is
  // still sitting in localStorage. Returns true on success, false on failure.
  function safeSetItem(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      if (isQuotaError(e) && !_storageQuotaWarned) {
        _storageQuotaWarned = true;
        toast('Browser storage is full — use Export Save now to back up your progress to a file');
      }
      return false;
    }
  }

  // ========== SAVE-SIZE COMPACTION HELPERS ==========
  // A league table row, a fixture report, a Season/Tournament state tree —
  // all of these embed full team objects (id, name, colors, stadium, and
  // the ENTIRE squad with every player's every attribute) by reference in
  // memory. That's free at runtime (just a pointer), but JSON.stringify
  // has no concept of "I've already written this object" — every place a
  // team is referenced gets the whole squad serialized again from scratch.
  // A single 20-team league table alone was writing out 20 full squads.
  //
  // teamRefReplacer/teamRefReviver are passed straight to JSON.stringify /
  // JSON.parse's second argument — they run automatically at every nesting
  // depth, so they compact every team reference throughout `season` /
  // `tournament` (table rows, fixtures, brackets, groups, ...) without
  // needing to touch each place that builds those structures individually.
  // Detection is unambiguous: only a real entry from allTeams has a
  // `players` array, so nothing else can accidentally match.
  // A match report's home/away side is a much smaller shape than a full
  // team object (no `players` array — see teamRefReplacer above), but it
  // still repeats the same id/name/short/flag/logo on every single played
  // fixture's report (and a table-format tournament persists one report
  // per matchday-fixture). Detected by id+name+score co-occurring, since
  // that combination only shows up on a report's home/away side.
  function isReportTeamSide(v) {
    return !!(v && typeof v === 'object' && typeof v.id === 'string' && typeof v.name === 'string' &&
      Object.prototype.hasOwnProperty.call(v, 'score') && !Array.isArray(v.players));
  }
  function isStrippedReportTeamSide(v) {
    return !!(v && typeof v === 'object' && typeof v.id === 'string' && !('name' in v) &&
      Object.prototype.hasOwnProperty.call(v, 'score'));
  }

  // Goal/card/assist/save entries inside a report carry a player's name
  // AND id side by side (see pushGoal()/buildLightMatchReport() in
  // engine/matchEngine.js) — the id alone is enough to look the name back
  // up via findPlayerAndTeam(). Keyed off id+player(string)+num(number)
  // together, since that specific trio only occurs on these entries.
  function isNamedPlayerRef(v) {
    return !!(v && typeof v === 'object' && typeof v.id === 'string' && typeof v.player === 'string' && typeof v.num === 'number');
  }
  function isStrippedPlayerRef(v) {
    return !!(v && typeof v === 'object' && typeof v.id === 'string' && !('player' in v) && typeof v.num === 'number');
  }
  function playerNameById(id) {
    const found = findPlayerAndTeam(id);
    return (found && found.player && found.player.name) || '';
  }

  function teamRefReplacer(key, value) {
    if (value && typeof value === 'object' && typeof value.id === 'string' && Array.isArray(value.players)) {
      return { $team: value.id };
    }
    if (isReportTeamSide(value)) {
      const stripped = Object.assign({}, value);
      delete stripped.name; delete stripped.short; delete stripped.flag; delete stripped.logo;
      return stripped;
    }
    if (isNamedPlayerRef(value)) {
      const stripped = Object.assign({}, value);
      delete stripped.player;
      return stripped;
    }
    return value;
  }

  function teamRefReviver(key, value) {
    if (value && typeof value === 'object' && typeof value.$team === 'string') {
      return getTeam(value.$team) || value;
    }
    if (isStrippedReportTeamSide(value)) {
      const t = getTeam(value.id);
      if (t) return Object.assign({ name: t.name, short: t.short, flag: t.flag, logo: t.logo }, value);
      return value;
    }
    if (isStrippedPlayerRef(value)) {
      return Object.assign({ player: playerNameById(value.id) }, value);
    }
    return value;
  }

  // Stat "buckets" (apexSimStats / apexTournamentStats — see
  // ui/statisticsUI.js) are keyed by player id already, but every entry
  // was ALSO carrying that same player's id/name/team/teamId/national/club
  // as duplicated strings — all of it re-derivable from the id that's
  // already the object key, via findPlayerAndTeam()/findPlayerTeams(). Only
  // the actual counted numbers (count/sum/avg/recent) can't be recomputed,
  // so those are all that get persisted; compactStatsBook() strips the
  // rest before saving/exporting, and hydrateStatsBook() rebuilds the full
  // shape ui/statisticsUI.js's leaderboards/awards code expects, using
  // current player-database lookups, right after a save is loaded back in.
  function compactStatsBook(book) {
    const out = {};
    Object.keys(book || {}).forEach(cat => {
      const entries = book[cat] || {};
      const compactCat = {};
      Object.keys(entries).forEach(pid => {
        const e = entries[pid];
        if (!e) return;
        const c = { count: e.count || 0 };
        if (typeof e.sum === 'number') c.sum = e.sum;
        if (typeof e.avg === 'number') c.avg = e.avg;
        if (Array.isArray(e.recent) && e.recent.length) c.recent = e.recent;
        compactCat[pid] = c;
      });
      out[cat] = compactCat;
    });
    return out;
  }

  function hydrateStatsBook(book) {
    const out = {};
    Object.keys(book || {}).forEach(cat => {
      const entries = book[cat] || {};
      const hydratedCat = {};
      Object.keys(entries).forEach(pid => {
        const e = entries[pid];
        if (!e) return;
        const found = findPlayerAndTeam(pid);
        const player = found && found.player;
        const team = found && found.team;
        const aff = findPlayerTeams(pid);
        const h = {
          id: pid,
          name: player ? player.name : pid,
          team: team ? team.name : '',
          teamId: team ? team.id : '',
          count: e.count || 0,
          national: aff.national,
          club: aff.club
        };
        if (typeof e.sum === 'number') h.sum = e.sum;
        if (typeof e.avg === 'number') h.avg = e.avg;
        if (e.recent) h.recent = e.recent;
        hydratedCat[pid] = h;
      });
      out[cat] = hydratedCat;
    });
    return out;
  }


  function saveStats() {
    let ok = true;
    try {
      ok = safeSetItem('apexSimStats', JSON.stringify(compactStatsBook(stats))) && ok;
      ok = safeSetItem('apexInjuryBook', JSON.stringify(injuryBook)) && ok;
      ok = safeSetItem('apexSuspensionBook', JSON.stringify(suspensionBook)) && ok;
      ok = safeSetItem('apexMatchDay', String(globalMatchDay)) && ok;
      ok = safeSetItem('apexPlayerMatchLog', JSON.stringify(playerMatchLog)) && ok;
      ok = safeSetItem('apexTeamMatchLog', JSON.stringify(teamMatchLog)) && ok;
    } catch(e) { ok = false; }
    return ok;
  }
  function loadStats() {
    try {
      const s = localStorage.getItem('apexSimStats');
      if (s) stats = hydrateStatsBook(JSON.parse(s));
      if (!stats.ratings) stats.ratings = {};
      const t = localStorage.getItem('apexTrophies');
      if (t) trophies = JSON.parse(t);
      const ib = localStorage.getItem('apexInjuryBook');
      if (ib) injuryBook = JSON.parse(ib);
      const sb = localStorage.getItem('apexSuspensionBook');
      if (sb) suspensionBook = JSON.parse(sb);
      const md = localStorage.getItem('apexMatchDay');
      if (md) globalMatchDay = parseInt(md, 10) || 1;
      const pml = localStorage.getItem('apexPlayerMatchLog');
      if (pml) playerMatchLog = JSON.parse(pml);
      const tml = localStorage.getItem('apexTeamMatchLog');
      if (tml) teamMatchLog = JSON.parse(tml);
    } catch(e) {}
  }

  // ========== FULL PROGRESS PERSISTENCE (survive a page refresh) ==========
  // Stats/trophies/injury/suspension books are already saved above. This
  // additionally persists the in-progress Season Calendar and standalone
  // Tournament (World Cup / Champions League) state — plus a couple of small
  // UI bits (which nav tab and which season sub-tab were open) — so a
  // refresh (or reopening the app later) drops the person back exactly
  // where they left off instead of wiping their run.
  function persistAll() {
    let ok = true;
    try {
      if (season) ok = safeSetItem('apexSeason', JSON.stringify(season, teamRefReplacer)) && ok;
      else localStorage.removeItem('apexSeason');
      if (tournament) ok = safeSetItem('apexTournament', JSON.stringify(tournament, teamRefReplacer)) && ok;
      else localStorage.removeItem('apexTournament');
      ok = safeSetItem('apexTournamentType', tournamentType) && ok;
      ok = safeSetItem('apexTournamentStats', JSON.stringify(compactStatsBook(tournamentStats))) && ok;
      ok = safeSetItem('apexSeasonActiveTab', seasonActiveTab) && ok;
      ok = safeSetItem('apexSeasonActiveSubTab', seasonActiveSubTab) && ok;
      ok = persistPlayerForms() && ok;
      const activeTab = document.querySelector('.nav-tab.active');
      if (activeTab && activeTab.dataset.view) safeSetItem('apexActiveView', activeTab.dataset.view);
    } catch (e) { ok = false; }
    return ok;
  }

  function loadPersistedGameState() {
    try {
      const s = localStorage.getItem('apexSeason');
      if (s) season = JSON.parse(s, teamRefReviver);
    } catch (e) { season = null; }
    try {
      const t = localStorage.getItem('apexTournament');
      if (t) tournament = JSON.parse(t, teamRefReviver);
    } catch (e) { tournament = null; }
    try {
      const tt = localStorage.getItem('apexTournamentType');
      if (tt) tournamentType = tt;
    } catch (e) {}
    try {
      const ts = localStorage.getItem('apexTournamentStats');
      if (ts) tournamentStats = hydrateStatsBook(JSON.parse(ts));
    } catch (e) {}
    try {
      const sat = localStorage.getItem('apexSeasonActiveTab');
      if (sat) seasonActiveTab = sat;
      const sst = localStorage.getItem('apexSeasonActiveSubTab');
      if (sst) seasonActiveSubTab = sst;
    } catch (e) {}
  }

  // Re-hydrates the Tournament view's UI from a restored `tournament` object
  // (called once on load, before the person has clicked back into that tab)
  // so the setup/live panels and bracket are already correct whenever they do.
  function restoreTournamentUI() {
    if (!tournament) return;
    const setup = document.getElementById('tournament-setup');
    const live = document.getElementById('tournament-live');
    if (setup) setup.style.display = 'none';
    if (live) live.style.display = 'block';
    const cfg = TOURNAMENT_FORMATS[tournamentType] || TOURNAMENT_FORMATS.worldcup;
    const title = document.getElementById('tournament-title');
    const desc = document.getElementById('tournament-desc');
    if (title) title.textContent = cfg.name + ' Setup';
    if (desc) desc.textContent = cfg.desc;
    const select = document.getElementById('tour-format-select');
    if (select) select.value = tournamentType;
    applyTournamentBranding(tournament.competition || tournamentType);
    try {
      const bracketCard = document.getElementById('tour-bracket-card');
      if (bracketCard) bracketCard.style.display = (tournament.format === 'table') ? 'none' : '';
      if (tournament.format === 'league') { renderUCLLeague(); renderUCLFixtures(); }
      else { renderGroups(); }
      if (tournament.format !== 'table') renderBracket();
      if (tournament.champion) renderTournamentPodium();
      renderTournamentLeaderboard();
    } catch (e) {}
  }

  function restoreSeasonUI() {
    if (!season) return;
    try { renderSeasonDashboard(); } catch (e) {}
    const setup = document.getElementById('season-setup');
    const dash = document.getElementById('season-dashboard');
    if (setup) setup.style.display = 'none';
    if (dash) dash.style.display = 'block';
  }

  // Belt-and-braces autosave: most mutating actions already call persistAll()
  // directly, but a periodic save plus a save right before the tab is hidden
  // or closed means nothing is ever more than a couple seconds from being
  // safely on disk, even from an edge case that isn't explicitly wired up.
  function setupAutoSave() {
    // Was firing a full JSON.stringify(season)/JSON.stringify(tournament) —
    // both of which can be sizeable once several leagues' squads, fixtures
    // and match reports are loaded — every 4 seconds unconditionally, which
    // showed up as a periodic stutter unrelated to anything the person was
    // actually doing. Almost every mutating action already calls persistAll()
    // directly (see the many call sites elsewhere in this file), so this
    // timer is only a safety net: it can run far less often, and it skips
    // the work entirely when the tab isn't visible or there's nothing to
    // save, instead of paying the stringify cost every tick regardless.
    setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      if (!season && !tournament) return;
      persistAll();
    }, 15000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistAll(); });
    window.addEventListener('beforeunload', persistAll);
    window.addEventListener('pagehide', persistAll);
  }

  // Manual save, triggered by the header Save button. persistAll() already
  // runs constantly in the background (autosave, mutating actions, tab
  // hide/close), so this doesn't do anything those don't already cover —
  // it exists purely so the person can get an explicit, visible confirmation
  // that their progress is safely written to this browser's storage right now.
  // Save/Export/Import live inside a small dropdown off a single header
  // icon (see #save-menu in index.html) rather than sitting on screen as
  // three permanent buttons. forceState lets callers explicitly open/close
  // (used to close the menu after picking an action, and by the outside-
  // click/Escape handlers below) instead of just toggling blindly.
  let _saveMenuListenerAttached = false;
  function toggleSaveMenu(forceState) {
    const menu = document.getElementById('save-menu');
    const toggleBtn = document.getElementById('save-menu-toggle');
    if (!menu) return;
    const shouldOpen = forceState != null ? forceState : !menu.classList.contains('open');
    menu.classList.toggle('open', shouldOpen);
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    if (!_saveMenuListenerAttached) {
      _saveMenuListenerAttached = true;
      document.addEventListener('click', (e) => {
        const m = document.getElementById('save-menu');
        if (m && m.classList.contains('open') && !m.contains(e.target)) toggleSaveMenu(false);
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') toggleSaveMenu(false);
      });
    }
  }
  function manualSave() {
    const okSeason = persistAll();
    const okStats = saveStats();
    const ok = okSeason && okStats;
    const btn = document.getElementById('manual-save-btn');
    if (btn) {
      const label = btn.querySelector('.save-btn-label');
      const prevLabel = label ? label.textContent : null;
      btn.classList.add('just-saved');
      if (label) label.textContent = ok ? 'Saved!' : 'Storage full!';
      setTimeout(() => {
        btn.classList.remove('just-saved');
        if (label && prevLabel !== null) label.textContent = prevLabel;
      }, 1200);
    }
    // safeSetItem() already toasts a one-time "storage is full" warning on
    // failure, so only toast the happy path here to avoid two conflicting
    // messages.
    if (ok) toast('Progress saved');
    toggleSaveMenu(false);
  }

  // ========== EXPORT / IMPORT SAVE FILE ==========
  // Every piece of persisted state this app writes is namespaced under a
  // localStorage key starting with "apex" (see resetLeaderboard() below,
  // which relies on the same fact). That makes a full, exact export/import
  // straightforward: grab every "apex*" key verbatim (already-serialized
  // JSON strings, numbers-as-strings, etc.) and write them back out exactly
  // as they were, rather than re-deriving anything from in-memory state.
  // This is what lets a save survive a browser switch or a full wipe/refresh.
  // Builds the export payload straight from the live in-memory game state
  // (season, tournament, stats, trophies, etc.) rather than reading it back
  // out of localStorage. This matters because localStorage writes can fail
  // silently under quota pressure (a long season's accumulated match
  // reports can get large) — if that happens, the localStorage copy can be
  // an older, smaller snapshot than what's actually on screen, and an
  // export built from localStorage would quietly ship that stale, earlier
  // point instead of the matches actually just played. Reading straight
  // from memory means the export always matches exactly what's currently
  // showing, independent of whether the last autosave tick succeeded.
  function collectExportData() {
    const data = {};
    // Start from whatever's already in localStorage, so any "apex*" key
    // this function doesn't special-case below (small UI/session bits)
    // still makes it into the export.
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('apex') === 0) data[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    // Now overwrite every key that has a live in-memory source of truth,
    // so these always reflect the exact current point — not a possibly
    // stale localStorage copy.
    try {
      if (season) data.apexSeason = JSON.stringify(season, teamRefReplacer);
      else delete data.apexSeason;
      if (tournament) data.apexTournament = JSON.stringify(tournament, teamRefReplacer);
      else delete data.apexTournament;
      data.apexTournamentType = tournamentType;
      data.apexTournamentStats = JSON.stringify(compactStatsBook(tournamentStats));
      data.apexSeasonActiveTab = seasonActiveTab;
      data.apexSeasonActiveSubTab = seasonActiveSubTab;
      data.apexSimStats = JSON.stringify(compactStatsBook(stats));
      data.apexTrophies = JSON.stringify(trophies);
      data.apexInjuryBook = JSON.stringify(injuryBook);
      data.apexSuspensionBook = JSON.stringify(suspensionBook);
      data.apexMatchDay = String(globalMatchDay);
      data.apexPlayerForms = JSON.stringify(collectPlayerFormsMap());
      data.apexPlayerMatchLog = JSON.stringify(playerMatchLog);
      data.apexTeamMatchLog = JSON.stringify(teamMatchLog);
    } catch (e) {}
    return data;
  }

  function exportSave() {
    toggleSaveMenu(false);
    try {
      // Best-effort: also try to flush to localStorage so autosave/reload
      // stay in sync. If this fails (e.g. storage is full), the export
      // below still succeeds and is still exact — it doesn't depend on
      // this write having worked.
      try { persistAll(); saveStats(); } catch (e) {}
      const data = collectExportData();
      if (!Object.keys(data).length) {
        toast('Nothing to export yet — play a bit first');
        return;
      }
      const payload = {
        app: 'apex-sim',
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        data
      };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = url;
      a.download = `apex-sim-save-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast('Save file exported');
    } catch (e) {
      console.error('Export failed', e);
      toast('Export failed — see console for details');
    }
  }

  function triggerImportSave() {
    const input = document.getElementById('import-save-input');
    if (input) { input.value = ''; input.click(); }
    toggleSaveMenu(false);
  }

  function importSaveFile(event) {
    const input = event && event.target;
    const file = input && input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        const data = payload && payload.data && typeof payload.data === 'object' ? payload.data : null;
        const validKeys = data ? Object.keys(data).filter(k => k.indexOf('apex') === 0) : [];
        if (!data || !validKeys.length) {
          toast("That file doesn't look like an APEX SIM save");
          return;
        }
        if (!confirm('Import this save? This will REPLACE all current progress — leaderboard, trophies, history, active season, tournament, everything — with the contents of this file. This cannot be undone.')) {
          return;
        }
        // Clear every existing "apex*" key first so nothing from the
        // current save (e.g. a key this version writes that an older
        // export doesn't have) bleeds into the restored state.
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf('apex') === 0) keysToRemove.push(k);
        }
        keysToRemove.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
        // Track failures instead of swallowing them — a quota failure here
        // would otherwise reload the page into a save that's silently
        // missing the season/tournament progress the file actually had.
        // Write apexSeason/apexTournament FIRST — they're by far the
        // largest keys in a save (full league tables, fixtures, and match
        // reports), so if this browser's storage quota runs out partway
        // through, it should be a small, incidental key that fails to
        // restore — never the season or tournament progress itself, which
        // is exactly what was going missing before this ordering existed.
        const priorityKeys = ['apexSeason', 'apexTournament'];
        const orderedKeys = [
          ...priorityKeys.filter(k => validKeys.indexOf(k) !== -1),
          ...validKeys.filter(k => priorityKeys.indexOf(k) === -1)
        ];
        const failedKeys = [];
        orderedKeys.forEach(k => { if (!safeSetItem(k, data[k])) failedKeys.push(k); });
        if (failedKeys.length) {
          alert('Import partially failed — this browser\'s storage is full, so ' +
            failedKeys.length + ' item(s) from the file (' + failedKeys.join(', ') +
            ') could not be restored. Free up space (e.g. import in a different browser, ' +
            'or clear old site data) and try again.');
        }
        try { sessionStorage.setItem('apexJustImported', '1'); } catch (e) {}
        location.reload();
      } catch (err) {
        console.error('Import failed', err);
        toast('Import failed — file is not valid JSON');
      } finally {
        if (input) input.value = '';
      }
    };
    reader.onerror = () => { toast('Could not read that file'); if (input) input.value = ''; };
    reader.readAsText(file);
  }

  function resetLeaderboard() {
    if (!confirm('Reset EVERYTHING? This wipes all leaderboard stats, trophies, history, the active season, any tournament in progress, injuries/suspensions, player form and saved settings — every piece of stored data for this app on this device. This cannot be undone.')) return;
    // Full factory reset: clear every bit of persisted state, not just the
    // leaderboard tables. We wipe every localStorage key this app owns
    // (all of them are namespaced with the "apex" prefix) rather than
    // trying to enumerate and reset every in-memory variable by hand,
    // then reload so the app boots from a completely clean slate — this
    // guarantees no stale in-memory state (season, tournament, injury
    // book, player forms, etc.) can survive the reset.
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('apex') === 0) keysToRemove.push(k);
      }
      keysToRemove.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
    } catch (e) {}
    try { sessionStorage.setItem('apexJustReset', '1'); } catch (e) {}
    location.reload();
  }

  function showLeaderboard(type) {
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.toggle('active', t.dataset.lb === type));
    let data;
    if (type === 'ratings') {
      data = Object.values(stats.ratings || {}).filter(x => x.count > 0).sort((a, b) => b.avg - a.avg || b.count - a.count).slice(0, 20);
    } else {
      data = Object.values(stats[type] || {}).sort((a, b) => b.count - a.count).slice(0, 20);
    }
    const el = document.getElementById('leaderboard-content');
    if (!el) return;
    if (!data.length) {
      el.innerHTML = `<div class="empty-state"><div class="icon">📊</div><p>No ${type} recorded yet. Simulate matches!</p></div>`;
      return;
    }
    const labels = { goals: 'Goals', assists: 'Assists', saves: 'Saves', cleanSheets: 'Clean Sheets', yellows: 'Yellow Cards', reds: 'Red Cards', cards: 'Cards', motm: 'MOTM', puskas: 'Puskas Nominees', ratings: 'Avg Rating', interceptions: 'Interceptions' };
    const appsCol = type === 'ratings' ? '' : '<th>Apps</th>';
    const top3 = data.slice(0, 3);
    const podium = top3.length ? `<div class="lb-podium">
      ${top3.map((p,i) => `<div class="lb-podium-slot slot-${i+1}">
          <div class="lb-podium-rank">${i===0?'🥇':i===1?'🥈':'🥉'}</div>
          ${lbAvatar(p, 56)}
          <div class="lb-podium-name">${playerNameHTML(p)}</div>
          <div class="lb-podium-team">${[p.national, p.club].filter(Boolean).join(' · ') || p.team || ''}</div>
          <div class="lb-podium-value">${type==='ratings' ? (p.avg!=null?p.avg.toFixed(2):'—') : p.count}</div>
        </div>`).join('')}
    </div>` : '';
    el.innerHTML = `${podium}<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th>${appsCol}<th>${labels[type]||type}</th></tr></thead><tbody>
      ${data.map((p,i) => {
        const aff = [p.national, p.club].filter(Boolean).join(' · ') || p.team;
        const apps = (stats.ratings && stats.ratings[p.id]) ? stats.ratings[p.id].count : 0;
        const appsCell = type === 'ratings' ? '' : `<td>${apps}</td>`;
        return `<tr class="${i<3?'lb-row-top rank-'+(i+1):''}"><td class="lb-rank">${rankBadge(i)}</td><td class="lb-player">${lbPlayerCell(p)}</td><td class="lb-team">${aff}</td>${appsCell}<td style="font-weight:700;color:var(--accent-gold)">${type==='ratings' ? (p.avg!=null?p.avg.toFixed(2):'—')+' ('+p.count+' apps)' : p.count}</td></tr>`;
      }).join('')}
    </tbody></table></div>`;
  }

  function renderTournamentTeamSelect() {
    let pool = getCompetitionEligiblePool(tournamentType);
    if (tourTeamsSearch) {
      pool = pool.filter(t =>
        (t.name || '').toLowerCase().includes(tourTeamsSearch) ||
        (t.short || '').toLowerCase().includes(tourTeamsSearch)
      );
    }
    const el = document.getElementById('tournament-teams');
    if (!el) return;
    // First-ever render for this format (nothing selected yet, no search
    // narrowing the pool) defaults every eligible team to checked — same
    // "select all by default" behavior as before, just driven by
    // tourSelectedTeamIds instead of a DOM snapshot now.
    const firstRender = tourSelectedTeamIds.size === 0 && !tourTeamsSearch;
    if (firstRender) getCompetitionEligiblePool(tournamentType).forEach(t => tourSelectedTeamIds.add(t.id));
    el.innerHTML = pool.map(t => {
      const checked = tourSelectedTeamIds.has(t.id);
      return `<label class="team-check ${checked ? 'selected' : ''}" data-id="${t.id}">
        <input type="checkbox" value="${t.id}" ${checked ? 'checked' : ''}>
        <span>${teamMark(t, 20)} ${t.name}</span>
        <span class="player-ovr" style="margin-left:auto">${teamAvgOvr(t).toFixed(0)}</span>
      </label>`;
    }).join('') || '<div class="empty-state"><p>No teams found</p></div>';
    el.querySelectorAll('.team-check').forEach(l => {
      const id = l.getAttribute('data-id');
      l.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          const cb = l.querySelector('input');
          if (cb) cb.checked = !cb.checked;
        }
        const cb = l.querySelector('input');
        const isChecked = !!(cb && cb.checked);
        l.classList.toggle('selected', isChecked);
        if (isChecked) tourSelectedTeamIds.add(id); else tourSelectedTeamIds.delete(id);
        updateTournamentSelectedCount();
      });
      l.querySelector('input') && l.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) tourSelectedTeamIds.add(id); else tourSelectedTeamIds.delete(id);
        updateTournamentSelectedCount();
      });
    });
    updateTournamentSelectedCount();
  }

  function updateTournamentSelectedCount() {
    // tourSelectedTeamIds is authoritative (see renderTournamentTeamSelect) —
    // counting DOM checkboxes here would undercount while a search filter
    // is hiding previously-checked teams.
    const n = tourSelectedTeamIds.size;
    let el = document.getElementById('tour-selected-count');
    if (!el) {
      const setup = document.getElementById('tournament-setup');
      const grid = document.getElementById('tournament-teams');
      if (grid && grid.parentNode) {
        el = document.createElement('div');
        el.id = 'tour-selected-count';
        el.className = 'tour-selected-count';
        grid.parentNode.insertBefore(el, grid);
      }
    }
    if (el) {
      const cfg = TOURNAMENT_FORMATS[tournamentType];
      const engine = cfg && cfg.engine;
      const need = engine === 'league' ? '36 ideal (min 8)'
        : engine === 'knockout' ? 'a power of 2 — 2/4/8/16/32… (min 2)'
        : engine === 'table' ? 'the full league (18-20 ideal, min 4)'
        : '4+ (8/16/32/48 ideal)';
      el.innerHTML = '<strong>' + n + '</strong> teams selected <span style="color:var(--text-3)">· ' + need + '</span>';
    }
  }


  function selectAllTeams() {
    setTimeout(updateTournamentSelectedCount, 0);
    document.querySelectorAll('#tournament-teams input').forEach(cb => {
      cb.checked = true;
      tourSelectedTeamIds.add(cb.value);
      const parent = cb.closest('.team-check');
      if (parent) parent.classList.add('selected');
    });
  }
  function deselectAllTeams() {
    document.querySelectorAll('#tournament-teams input').forEach(cb => {
      cb.checked = false;
      tourSelectedTeamIds.delete(cb.value);
      const parent = cb.closest('.team-check');
      if (parent) parent.classList.remove('selected');
    });
    updateTournamentSelectedCount();
  }

  function startTournament() {
    // Use the persistent selection set (tourSelectedTeamIds), not a DOM
    // query — a search filter can currently be hiding some checked teams'
    // checkboxes entirely, and reading the DOM here would silently drop
    // them from the tournament instead of just from the visible list.
    const selected = [...tourSelectedTeamIds].map(id => getTeam(id)).filter(Boolean);
    const cfg = TOURNAMENT_FORMATS[tournamentType] || TOURNAMENT_FORMATS.worldcup;
    // Straight-knockout formats (domestic cups, Super Cups) only need a
    // power-of-2 field as small as 2 (a one-off Super Cup match); every
    // other engine still needs the original minimum of 4.
    const minTeams = cfg.engine === 'knockout' ? 2 : 4;
    if (selected.length < minTeams) { toast('Select at least ' + minTeams + ' teams'); return; }

    applyTournamentBranding(tournamentType);
    tournamentStats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, motm: {}, ratings: {}, puskas: {}, interceptions: {}, tackles: {}, bigGames: {} };
    // Wipe the player/team match logs for the new tournament. These logs
    // exist to show recent form (last 10, capped at 30) for whatever's
    // currently being played — carrying entries over from a finished
    // tournament/season into the next one just eats save space for
    // history nobody's looking at anymore (this is what was filling up
    // browser storage after playing through Premier League + a chunk of
    // La Liga back to back). Clearing here, then persisting immediately,
    // makes sure the old entries actually leave localStorage/the save
    // file rather than just being orphaned in memory until autosave.
    playerMatchLog = {};
    teamMatchLog = {};
    saveStats();
    // Clear previous tournament UI
    const clearIds = ['tour-stats-preview', 'tour-awards', 'tour-podium', 'bracket', 'groups-container', 'fixture-list'];
    clearIds.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    // The domestic-league (table) format hides the Knockout Bracket card
    // entirely (there is no bracket) — restore it here before every new
    // tournament starts, so a leftover hide from a previous league season
    // doesn't carry over into a cup/groups/UCL tournament.
    const bracketCard = document.getElementById('tour-bracket-card');
    if (bracketCard) bracketCard.style.display = '';
    const st = document.getElementById('tour-stage-title');
    if (st) st.textContent = 'Starting…';

    if (cfg.engine === 'league') {
      startUCLTournament(selected);
    } else if (cfg.engine === 'knockout') {
      startKnockoutTournament(selected);
    } else if (cfg.engine === 'table') {
      startLeagueTournament(selected);
    } else {
      startWorldCupTournament(selected);
    }
    if (tournament) tournament._runId = Date.now();

    const setup = document.getElementById('tournament-setup');
    const live = document.getElementById('tournament-live');
    if (setup) setup.style.display = 'none';
    if (live) live.style.display = 'block';
    renderTournamentLeaderboard();
    persistAll();
  }

  function startWorldCupTournament(selected) {
    let teams = shuffleArray([...selected]);
    const groupSize = 4;
    let numGroups = Math.floor(teams.length / groupSize);
    if (numGroups < 1) numGroups = 1;
    if (numGroups > 12) numGroups = 12;
    teams = teams.slice(0, numGroups * groupSize);
    if (teams.length < 4) { toast('Need at least 4 teams for groups'); return; }
    const groups = [];
    for (let i = 0; i < numGroups; i++) {
      groups.push({
        name: String.fromCharCode(65 + i),
        teams: teams.slice(i * groupSize, (i + 1) * groupSize).map(t => ({
          team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0
        }))
      });
    }
    const cfg = TOURNAMENT_FORMATS[tournamentType] || {};
    tournament = {
      type: 'worldcup', format: 'groups', groups, knockout: [], stage: 'groups', fixtures: [], champion: null, playoff: [],
      competition: tournamentType, competitionName: cfg.name || 'World Cup'
    };
    generateGroupFixtures();
    renderGroups();
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = 'Group Stage';
    const bracket = document.getElementById('bracket');
    if (bracket) bracket.innerHTML = '<p style="color:var(--text-muted)">Knockout bracket appears after groups.</p>';
    const btn = document.getElementById('btn-sim-round');
    if (btn) btn.textContent = 'Simulate Round';
  }

  function startUCLTournament(selected) {
    let teams = shuffleArray([...selected]);
    // Prefer 36; if fewer, use largest even count >= 8 (scale format)
    if (teams.length >= 36) teams = teams.slice(0, 36);
    else if (teams.length % 2 === 1) teams = teams.slice(0, teams.length - 1);
    const cfg = TOURNAMENT_FORMATS[tournamentType] || {};
    const compName = cfg.name || 'Champions League';
    if (teams.length < 8) { toast(compName + ' needs at least 8 clubs (36 ideal)'); return; }

    const league = teams.map(t => ({
      team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0
    }));

    const matchesPerTeam = teams.length >= 36 ? 8 : Math.min(8, teams.length - 1);
    const fixtures = generateUCLLeagueFixtures(teams, matchesPerTeam);

    tournament = {
      type: 'ucl',
      format: 'league',
      stage: 'league',
      league,
      fixtures,
      playoff: [],
      knockout: [],
      groups: [],
      champion: null,
      matchesPerTeam,
      competition: tournamentType,
      competitionName: compName
    };

    renderUCLLeague();
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = 'League Phase (' + matchesPerTeam + ' matches each)';
    const bracket = document.getElementById('bracket');
    if (bracket) bracket.innerHTML = '<p style="color:var(--text-muted)">Playoffs & knockout appear after the league phase.</p>';
    const btn = document.getElementById('btn-sim-round');
    if (btn) btn.textContent = 'Simulate League Round';
    toast(compName + ' league phase: ' + teams.length + ' teams, ' + fixtures.length + ' matches');
  }
  function startKnockoutTournament(selected) {
    let teams = shuffleArray([...selected]);
    // Force a power of 2 (2, 4, 8, 16, 32…) so the bracket is a clean
    // single-elimination ladder from Round 1 straight through to the Final.
    while (teams.length >= 2 && (teams.length & (teams.length - 1))) teams.pop();
    if (teams.length < 2) { toast('Need at least 2 teams (a power of 2) for a knockout'); return; }

    const cfg = TOURNAMENT_FORMATS[tournamentType] || {};
    const matches = [];
    for (let i = 0; i < teams.length; i += 2) {
      matches.push({
        home: teams[i], away: teams[i + 1],
        homeScore: null, awayScore: null, winner: null, played: false, penalties: false
      });
    }
    tournament = {
      type: 'knockout',
      format: 'knockout',
      stage: 'knockout',
      groups: [],
      fixtures: [],
      knockout: [{ name: getRoundName(teams.length), matches }],
      champion: null,
      playoff: [],
      competition: tournamentType,
      competitionName: cfg.name || 'Cup'
    };

    const fixEl = document.getElementById('fixture-list');
    if (fixEl) fixEl.innerHTML = '';
    const groupsEl = document.getElementById('groups-container');
    if (groupsEl) groupsEl.innerHTML = '';
    renderBracket();
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = tournament.knockout[0].name;
    const btn = document.getElementById('btn-sim-round');
    if (btn) btn.textContent = 'Simulate Knockout Round';
    toast((cfg.name || 'Knockout') + ': ' + teams.length + ' teams, straight knockout');
  }
  function startLeagueTournament(selected) {
    const teams = shuffleArray([...selected]);
    const cfg = TOURNAMENT_FORMATS[tournamentType] || {};
    if (teams.length < 4) { toast((cfg.name || 'League') + ' needs at least 4 clubs'); return; }

    const rounds = buildDoubleRoundRobinRounds(teams);
    tournament = {
      type: 'league-table',
      format: 'table',
      stage: 'table',
      groups: [],
      fixtures: [],
      knockout: [],
      playoff: [],
      table: teams.map(blankSeasonRow),
      rounds,
      currentRound: 0,
      champion: null,
      competition: tournamentType,
      competitionName: cfg.name || 'League'
    };

    const fixEl = document.getElementById('fixture-list');
    if (fixEl) fixEl.innerHTML = '';
    const bracketCard = document.getElementById('tour-bracket-card');
    if (bracketCard) bracketCard.style.display = 'none';

    renderLeagueTableTournament();
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = 'Matchday 1 of ' + rounds.length;
    const btn = document.getElementById('btn-sim-round');
    if (btn) btn.textContent = 'Simulate Matchday';
    toast((cfg.name || 'League') + ': ' + teams.length + ' clubs, ' + rounds.length + '-matchday season');
  }
  // Crowns the table topper once every matchday has been played — mirrors
  // crownLeagueChampion() in Season Calendar, but routes through the shared
  // tournament champion/awards/trophy pipeline (setChampion) instead of the
  // season one, so the trophy lands in the Tournament history, not Season's.
  function finishLeagueTournament() {
    if (!tournament || tournament.champion) return;
    const standings = sortedTable(tournament.table);
    tournament.stage = 'complete';
    tournament.runnersUp = standings[1] ? standings[1].team : null;
    tournament.thirdPlace = standings[2] ? standings[2].team : null;
    tournament.fourthPlace = standings[3] ? standings[3].team : null;
    const champ = standings[0] ? standings[0].team : null;
    if (champ) setChampion(champ);
  }
  // Bulk-simulates the current matchday only (the "Simulate Matchday"
  // button) — called from _simTournamentRoundWork()'s format dispatch.
  function simLeagueTournamentRound() {
    if (!tournament || tournament.format !== 'table') return;
    const round = tournament.rounds[tournament.currentRound];
    if (!round) { finishLeagueTournament(); refreshTournamentStatsUI(); return; }
    simulateRoundFixtures(round, { allowET: false, allowPens: false }, (fx) => {
      applyResultToTable(tournament.table, fx.home, fx.away, fx.homeScore, fx.awayScore);
    });
    tournament.currentRound++;
    if (tournament.currentRound >= tournament.rounds.length) {
      finishLeagueTournament();
    } else {
      renderLeagueTableTournament();
      const stageTitle = document.getElementById('tour-stage-title');
      if (stageTitle) stageTitle.textContent = 'Matchday ' + (tournament.currentRound + 1) + ' of ' + tournament.rounds.length;
    }
    refreshTournamentStatsUI();
  }
  // Simulates every remaining matchday — called from _simAllTournamentWork()'s
  // format dispatch, which supplies the same progress-bar/yielding helpers
  // (updateLoading, updateLoadingProgress, simTick) every other bulk-sim path
  // in that function already uses, so a full-season sim doesn't freeze the tab.
  async function simAllLeagueTournament(updateLoading, updateLoadingProgress, startTime) {
    if (!tournament || tournament.format !== 'table') return;
    const remainingRounds = tournament.rounds.slice(tournament.currentRound);
    const total = remainingRounds.reduce((sum, r) => sum + r.length, 0);
    let done = 0;
    updateLoadingProgress(0, Math.max(total, 1), startTime);
    updateLoading('Simulating the season…');
    while (tournament && tournament.currentRound < tournament.rounds.length) {
      const round = tournament.rounds[tournament.currentRound];
      simulateRoundFixtures(round, { allowET: false, allowPens: false }, (fx) => {
        applyResultToTable(tournament.table, fx.home, fx.away, fx.homeScore, fx.awayScore);
        done++; updateLoadingProgress(done, total, startTime);
      });
      tournament.currentRound++;
      await simTick();
    }
    if (!tournament) return;
    finishLeagueTournament();
    updateLoadingProgress(Math.max(total, 1), Math.max(total, 1), startTime);
    try { renderLeagueTableTournament(); } catch (e) {}
    try { refreshTournamentStatsUI(); } catch (e) {}
    if (tournament.champion) {
      const stageTitle = document.getElementById('tour-stage-title');
      if (stageTitle) stageTitle.innerHTML = 'Champions: ' + teamMark(tournament.champion, 20) + ' ' + tournament.champion.name;
      toast(tournament.champion.name + ' win the ' + (tournament.competitionName || 'League') + '!');
    } else {
      toast('Tournament simulation finished');
    }
  }
  // Instantly simulates one fixture from the current matchday (the
  // "Instant" button in the fixture list) — same shape as simSeasonFixture.
  function simLeagueTournamentFixture(idx) {
    if (!tournament || tournament.format !== 'table') return;
    const round = tournament.rounds[tournament.currentRound];
    const f = round && round[idx];
    if (!f || f.played) return;
    const home = getTeam(f.home), away = getTeam(f.away);
    if (!home || !away) { f.played = true; return; }
    showLoading('Simulating match…');
    setTimeout(function() {
      try {
        const result = simQuickMatch(home, away, { countForLeaderboard: true, allowET: false, allowPens: false });
        f.played = true; f.homeScore = result.home; f.awayScore = result.away; f.report = result.report;
        applyResultToTable(tournament.table, f.home, f.away, result.home, result.away);
        if (round.every(x => x.played)) {
          tournament.currentRound++;
          if (tournament.currentRound >= tournament.rounds.length) finishLeagueTournament();
        }
        renderLeagueTableTournament();
        refreshTournamentStatsUI();
        persistAll();
      } finally { hideLoading(); }
    }, 30);
  }
  // Plays one fixture from the current matchday live in the Match view —
  // mirrors playSeasonFixture/playTournamentMatch, but writes the result
  // back into tournament.table via window._tourLeagueFixtureIdx (handled in
  // engine/matchEngine.js's match-finish dispatch) instead of a season
  // competition or a groups/knockout bracket.
  function playLeagueTournamentFixture(idx) {
    if (!tournament || tournament.format !== 'table') return;
    const round = tournament.rounds[tournament.currentRound];
    const f = round && round[idx];
    if (!f || f.played) return;
    const home = getTeam(f.home), away = getTeam(f.away);
    if (!home || !away) return;
    window._tourLeagueFixtureIdx = idx;
    window._tourFixtureIdx = null;
    window._uclFixtureIdx = null;
    window._koRoundIdx = null;
    window._koMatchIdx = null;
    window._seasonFixture = null;
    window._fromTournament = true;
    window._backTarget = 'tournament';
    currentSeasonComp = null;
    switchView('match');
    const homeSel = document.getElementById('home-team');
    const awaySel = document.getElementById('away-team');
    if (homeSel) homeSel.value = home.id;
    if (awaySel) awaySel.value = away.id;
    const formKeys = Object.keys(FORMATIONS);
    const hf = formKeys[Math.floor(seededRandom() * formKeys.length)];
    const af = formKeys[Math.floor(seededRandom() * formKeys.length)];
    const hForm = document.getElementById('home-formation');
    const aForm = document.getElementById('away-formation');
    if (hForm) hForm.value = hf;
    if (aForm) aForm.value = af;
    customLineups.home = null;
    customLineups.away = null;
    updateTeamPreview('home'); updateTeamPreview('away');
    startMatch();
    toast((tournament.competitionName || 'League') + ' — live · formations randomized');
  }
  function renderLeagueTableTournament() {
    const groupsEl = document.getElementById('groups-container');
    const fixEl = document.getElementById('fixture-list');
    if (!tournament || tournament.format !== 'table') return;

    if (groupsEl) groupsEl.innerHTML = renderLeagueStandingsTableHTML(tournament.table);
    if (fixEl) fixEl.innerHTML = renderLeagueTournamentFixturesHTML();

    if (tournament.champion) {
      const stageTitle = document.getElementById('tour-stage-title');
      if (stageTitle) stageTitle.innerHTML = 'Champions: ' + teamMark(tournament.champion, 20) + ' ' + tournament.champion.name;
    }
  }
  // A real league-table look: gold row for top spot, a blue-tinted band for
  // the next few (continental-qualification feel) and a red-tinted band for
  // the bottom three (relegation feel) — purely visual zone striping, same
  // spirit as every real league table broadcast graphic, scaled to however
  // many clubs are actually in this tournament.
  function renderLeagueStandingsTableHTML(table) {
    const sorted = sortedTable(table);
    const n = sorted.length;
    const continentalSpots = n >= 10 ? 4 : (n >= 6 ? 2 : 1);
    const relegationSpots = n >= 10 ? 3 : (n >= 6 ? 1 : 0);
    let h = '<div class="league-table-wrap"><table class="group-table league-standings-table">' +
      '<thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>';
    sorted.forEach((r, i) => {
      const pos = i + 1;
      const gd = r.gf - r.ga;
      let zoneClass = '';
      if (pos === 1) zoneClass = 'lg-zone-champion';
      else if (pos <= continentalSpots) zoneClass = 'lg-zone-continental';
      else if (pos > n - relegationSpots) zoneClass = 'lg-zone-relegation';
      h += `<tr class="${zoneClass}"><td class="lg-pos">${pos}</td><td>${teamMark(r.team, 18)} ${r.team.name}</td>` +
        `<td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td><td>${r.gf}</td><td>${r.ga}</td>` +
        `<td>${gd > 0 ? '+' : ''}${gd}</td><td><b>${r.pts}</b></td></tr>`;
    });
    h += '</tbody></table>';
    if (continentalSpots || relegationSpots) {
      h += '<div class="lg-table-legend">';
      h += '<span class="lg-legend-item"><i class="lg-zone-champion"></i>Champions</span>';
      if (continentalSpots > 1) h += '<span class="lg-legend-item"><i class="lg-zone-continental"></i>Continental qualification</span>';
      if (relegationSpots) h += '<span class="lg-legend-item"><i class="lg-zone-relegation"></i>Relegation zone</span>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }
  function renderLeagueTournamentFixturesHTML() {
    const rounds = tournament.rounds || [];
    const currentRound = tournament.stage === 'complete' ? [] : (rounds[tournament.currentRound] || []);
    const currentUnplayed = currentRound.filter(f => !f.played);
    const allFixtures = [].concat(...rounds);
    const played = allFixtures.filter(f => f.played).slice(-8).reverse();
    let h = '';
    if (currentUnplayed.length) {
      h += `<div class="card-title" style="margin-top:12px">Matchday ${tournament.currentRound + 1} of ${rounds.length}</div>`;
      currentUnplayed.forEach(f => {
        const home = getTeam(f.home), away = getTeam(f.away);
        if (!home || !away) return;
        const idx = currentRound.indexOf(f);
        h += `<div class="fixture-item"><span class="fixture-teams">${teamMark(home, 18)} ${home.short} vs ${teamMark(away, 18)} ${away.short}</span>
          <button class="btn btn-primary btn-sm" onclick="App.playLeagueTournamentFixture(${idx})">▶ Play Live</button>
          <button class="btn btn-secondary btn-sm" onclick="App.simLeagueTournamentFixture(${idx})">⚡ Instant</button></div>`;
      });
    } else if (tournament.stage !== 'complete') {
      h += '<div class="card-title" style="margin-top:12px">Matchday Complete</div>';
    }
    if (played.length) {
      h += '<div class="card-title" style="margin-top:12px">Recent Results</div>';
      played.forEach(f => {
        const home = getTeam(f.home), away = getTeam(f.away);
        if (!home || !away) return;
        const reportIdx = f.report ? seasonReportRegistry.push(f.report) - 1 : -1;
        h += `<div class="fixture-item played" style="cursor:${reportIdx >= 0 ? 'pointer' : 'default'}" ${reportIdx >= 0 ? `onclick="App.viewSeasonReport(${reportIdx})"` : ''}>
          <span class="fixture-teams">${teamMark(home, 18)} ${home.short} ${f.homeScore}-${f.awayScore} ${teamMark(away, 18)} ${away.short}</span>
          ${reportIdx >= 0 ? '<span style="font-size:0.7rem;color:var(--accent-gold)">Details</span>' : ''}</div>`;
      });
    }
    return h;
  }

  function generateUCLLeagueFixtures(teams, matchesPerTeam) {
    const fixtures = [];
    const opp = {};
    teams.forEach(t => { opp[t.id] = new Set(); });

    for (let round = 1; round <= matchesPerTeam; round++) {
      const order = shuffleArray([...teams]);
      const used = new Set();
      for (const t of order) {
        if (used.has(t.id)) continue;
        if (opp[t.id].size >= matchesPerTeam) continue;
        const candidate = order.find(o =>
          o.id !== t.id &&
          !used.has(o.id) &&
          !opp[t.id].has(o.id) &&
          opp[o.id].size < matchesPerTeam
        );
        if (!candidate) continue;
        used.add(t.id);
        used.add(candidate.id);
        opp[t.id].add(candidate.id);
        opp[candidate.id].add(t.id);
        // Alternate home roughly by round
        const tHome = (round + t.id.length) % 2 === 0;
        const home = tHome ? t : candidate;
        const away = tHome ? candidate : t;
        fixtures.push({
          phase: 'league',
          round,
          home: home.id,
          away: away.id,
          played: false,
          homeScore: null,
          awayScore: null,
          report: null
        });
      }
    }
    return shuffleArray(fixtures);
  }

  function blankLeagueRow(team) {
    return { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 };
  }

  function applyLeagueResult(homeId, awayId, hg, ag) {
    const ht = tournament.league.find(r => r.team.id === homeId);
    const at = tournament.league.find(r => r.team.id === awayId);
    if (!ht || !at) return;
    ht.played++; at.played++;
    ht.gf += hg; ht.ga += ag;
    at.gf += ag; at.ga += hg;
    if (hg > ag) { ht.won++; ht.pts += 3; at.lost++; }
    else if (ag > hg) { at.won++; at.pts += 3; ht.lost++; }
    else { ht.drawn++; at.drawn++; ht.pts++; at.pts++; }
  }

  function sortedLeague() {
    return [...(tournament.league || [])].sort((a, b) =>
      b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf
    );
  }

  function renderUCLLeague() {
    const el = document.getElementById('groups-container');
    if (!el || !tournament || tournament.format !== 'league') return;
    const sorted = sortedLeague();
    let h = '<div class="group-card league-table-wrap" style="grid-column:1/-1"><h4>League Phase Table — all ' + sorted.length + ' teams</h4>';
    h += '<table class="group-table"><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>';
    sorted.forEach((r, i) => {
      const gd = r.gf - r.ga;
      let mark = '';
      if (i < 8) mark = ' style="background:rgba(0,200,83,0.12)"';
      else if (i < 24) mark = ' style="background:rgba(255,171,0,0.1)"';
      else mark = ' style="background:rgba(255,82,82,0.08)"';
      h += `<tr${mark}><td>${i+1}</td><td>${teamMark(r.team, 18)} ${r.team.name}</td><td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td><td>${r.gf}</td><td>${r.ga}</td><td>${gd}</td><td><b>${r.pts}</b></td></tr>`;
    });
    h += '</tbody></table>';
    h += '<p style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">Green: Top 8 → R16 direct · Amber: 9–24 playoff · Red: 25–36 eliminated</p></div>';
    el.innerHTML = h;

    // Fixtures panel
    const fixEl = document.getElementById('fixtures-list') || el;
    // Use existing fixtures area inside renderGroups path — append via fixtures in live view
    const liveFix = document.querySelector('#tournament-live .fixtures-panel') || document.getElementById('fixture-list');
    renderUCLFixtures();
  }

  function renderUCLFixtures() {
    // Find fixtures container used by renderGroups
    let fixEl = document.getElementById('fixture-list');
    if (!fixEl) {
      // inject after groups if missing
      const gc = document.getElementById('groups-container');
      if (gc && !document.getElementById('fixture-list')) {
        const d = document.createElement('div');
        d.id = 'fixture-list';
        gc.parentNode.insertBefore(d, gc.nextSibling);
        fixEl = d;
      }
    }
    if (!fixEl || !tournament) return;
    const unplayed = (tournament.fixtures || []).filter(f => !f.played).slice(0, 12);
    const played = (tournament.fixtures || []).filter(f => f.played).slice(-8);
    let h = '';
    if (tournament.stage === 'league') {
      h += '<div class="card-title" style="margin-top:12px">League Fixtures</div>';
      unplayed.forEach(f => {
        const home = getTeam(f.home), away = getTeam(f.away);
        if (!home || !away) return;
        const idx = tournament.fixtures.indexOf(f);
        h += `<div class="fixture-item"><span class="fixture-teams">${teamMark(home,18)} ${home.short} vs ${teamMark(away,18)} ${away.short}</span>
          <button class="btn btn-primary btn-sm" onclick="App.playUCLFixture(${idx})">▶ Live</button>
          <button class="btn btn-secondary btn-sm" onclick="App.simUCLFixture(${idx})">⚡ Instant</button></div>`;
      });
      if (played.length) {
        h += '<div class="card-title" style="margin-top:12px">Recent Results</div>';
        played.reverse().forEach(f => {
          const home = getTeam(f.home), away = getTeam(f.away);
          const idx = tournament.fixtures.indexOf(f);
          h += `<div class="fixture-item played" style="cursor:pointer" onclick="App.viewFixtureReport(${idx})">
            <span class="fixture-teams">${teamMark(home,18)} ${home.short} ${f.homeScore}-${f.awayScore} ${teamMark(away,18)} ${away.short}</span>
            <span style="font-size:0.7rem;color:var(--accent-gold)">Details</span></div>`;
        });
      }
    }
    if (tournament.stage === 'playoff' || (tournament.playoff && tournament.playoff.length)) {
      h += '<div class="card-title" style="margin-top:12px">Knockout Playoffs (two legs)</div>';
      (tournament.playoff || []).forEach((p, i) => {
        const status = p.played ? (`Agg ${p.aggHome}-${p.aggAway} → ${p.winner ? p.winner.short : ''}`) : (p.leg1 && p.leg1.played ? 'Leg 2' : 'Leg 1');
        h += `<div class="fixture-item ${p.played?'played':''}">
          <span class="fixture-teams">${teamMark(p.home,18)} ${p.home.short} vs ${teamMark(p.away,18)} ${p.away.short} <small>(${status})</small></span>`;
        if (!p.played) {
          h += `<button class="btn btn-secondary btn-sm" onclick="App.simPlayoffTie(${i})">⚡ Sim Tie</button>`;
        } else if (p.report || (p.leg2 && p.leg2.report)) {
          h += `<button class="btn btn-secondary btn-sm" onclick="App.viewPlayoffReport(${i})">Report</button>`;
        }
        h += '</div>';
      });
    }
    fixEl.innerHTML = h;
  }


  function generateGroupFixtures() {
    tournament.fixtures = [];
    // Build a proper round-robin schedule per group (circle method) so each
    // group plays its games across a series of matchdays, then interleave
    // those matchdays across every group — matchday 1 for every group comes
    // before any group's matchday 2, etc. — instead of playing one group's
    // entire schedule before the next group starts.
    const groupRounds = tournament.groups.map(g => circleMethodRounds(g.teams.map(t => t.team.id)));
    const maxMatchdays = groupRounds.reduce((m, r) => Math.max(m, r.length), 0);
    for (let md = 0; md < maxMatchdays; md++) {
      let matchdayFixtures = [];
      tournament.groups.forEach((g, gi) => {
        const pairs = groupRounds[gi][md] || [];
        pairs.forEach(([home, away]) => {
          matchdayFixtures.push({ group: gi, matchday: md + 1, home, away, played: false });
        });
      });
      // Shuffle which group's fixture appears first within the matchday
      // (kickoff order) without breaking the matchday-by-matchday sequence.
      matchdayFixtures = shuffleArray(matchdayFixtures);
      tournament.fixtures.push(...matchdayFixtures);
    }
  }

  function renderGroups() {
    if (tournament && tournament.format === 'league') {
      renderUCLLeague();
      return;
    }
    if (tournament && tournament.format === 'table') {
      renderLeagueTableTournament();
      return;
    }
    const el = document.getElementById('groups-container');
    if (!el || !tournament) return;
    el.innerHTML = tournament.groups.map(g => {
      const sorted = [...g.teams].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      return `<div class="group-card"><h4>Group ${g.name}</h4><table class="group-table"><thead><tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead><tbody>
        ${sorted.map(t => `<tr><td>${teamMark(t.team,16)} ${t.team.short}</td><td>${t.played}</td><td>${t.won}</td><td>${t.drawn}</td><td>${t.lost}</td><td>${t.gf - t.ga}</td><td class="pts">${t.pts}</td></tr>`).join('')}
      </tbody></table></div>`;
    }).join('');
    // Fixture list with live play option — only shown during the active group
    // stage. Once the tournament has moved on to knockouts, this is cleared
    // (see advanceToKnockout) so no stale "Upcoming Fixtures" option lingers.
    const fixEl = document.getElementById('fixture-list');
    if (fixEl && tournament.stage === 'groups') {
      const unplayed = tournament.fixtures.filter(f => !f.played).slice(0, 8);
      const played = tournament.fixtures.filter(f => f.played).slice(-6);
      let h = '';
      if (unplayed.length) {
        h += '<div class="card-title" style="margin-top:12px">Upcoming Fixtures</div>';
        unplayed.forEach((f, i) => {
          const home = getTeam(f.home), away = getTeam(f.away);
          if (!home || !away) return;
          h += `<div class="fixture-item"><span class="fixture-teams">${teamMark(home,18)} ${home.short} vs ${teamMark(away,18)} ${away.short}</span>
            <button class="btn btn-primary btn-sm" onclick="App.playTournamentMatch(${tournament.fixtures.indexOf(f)})">▶ Play Live</button>
            <button class="btn btn-secondary btn-sm" onclick="App.simSingleFixture(${tournament.fixtures.indexOf(f)})">⚡ Instant</button></div>`;
        });
      }
      if (played.length) {
        h += '<div class="card-title" style="margin-top:12px">Recent Results</div>';
        played.reverse().forEach(f => {
          const home = getTeam(f.home), away = getTeam(f.away);
          if (!home || !away) return;
          const idx = tournament.fixtures.indexOf(f);
          h += `<div class="fixture-item played" style="cursor:pointer" onclick="App.viewFixtureReport(${idx})" title="View full match report">
            <span class="fixture-teams">${teamMark(home,18)} ${home.short} vs ${teamMark(away,18)} ${away.short}</span>
            <span class="fixture-score">${f.homeScore} - ${f.awayScore}</span>
            <span style="font-size:0.7rem;color:var(--accent-gold);margin-left:6px">Details</span>
          </div>`;
        });
      }
      fixEl.innerHTML = h;
    }
  }

  function simSingleFixture(idx) {
    if (!tournament || !tournament.fixtures[idx] || tournament.fixtures[idx].played) return;
    withLoading('Simulating match…', function() {
      _simSingleFixtureWork(idx);
    });
  }

  function _simSingleFixtureWork(idx) {
    if (!tournament || !tournament.fixtures[idx] || tournament.fixtures[idx].played) return;
    const f = tournament.fixtures[idx];
    const home = getTeam(f.home), away = getTeam(f.away);
    const result = simQuickMatch(home, away);
    f.played = true; f.homeScore = result.home; f.awayScore = result.away; f.report = result.report;
    const g = tournament.groups[f.group];
    const ht = g.teams.find(t => t.team.id === f.home);
    const at = g.teams.find(t => t.team.id === f.away);
    if (ht && at) {
      ht.played++; at.played++;
      ht.gf += result.home; ht.ga += result.away;
      at.gf += result.away; at.ga += result.home;
      if (result.home > result.away) { ht.won++; ht.pts += 3; at.lost++; }
      else if (result.away > result.home) { at.won++; at.pts += 3; ht.lost++; }
      else { ht.drawn++; at.drawn++; ht.pts++; at.pts++; }
    }
    renderGroups();
    renderTournamentLeaderboard();
    const remaining = tournament.fixtures.filter(x => !x.played).length;
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = remaining ? `Group Stage — ${remaining} matches left` : 'Group Stage Complete';
    if (!remaining && tournament.stage === 'groups') advanceToKnockout();
    persistAll();
  }

  function playTournamentMatch(idx) {
    if (!tournament || !tournament.fixtures[idx] || tournament.fixtures[idx].played) return;
    const f = tournament.fixtures[idx];
    const home = getTeam(f.home), away = getTeam(f.away);
    if (!home || !away) return;
    window._tourFixtureIdx = idx;
    window._uclFixtureIdx = null;
    window._koRoundIdx = null;
    window._koMatchIdx = null;
    window._fromTournament = true;
    window._seasonFixture = null;
    window._backTarget = 'tournament';
    currentSeasonComp = null;
    switchView('match');
    const homeSel = document.getElementById('home-team');
    const awaySel = document.getElementById('away-team');
    if (homeSel) homeSel.value = home.id;
    if (awaySel) awaySel.value = away.id;
    const formKeys = Object.keys(FORMATIONS);
    const hf = formKeys[Math.floor(seededRandom() * formKeys.length)];
    const af = formKeys[Math.floor(seededRandom() * formKeys.length)];
    const hForm = document.getElementById('home-formation');
    const aForm = document.getElementById('away-formation');
    if (hForm) hForm.value = hf;
    if (aForm) aForm.value = af;
    // Clear custom lineups so random formation applies
    customLineups.home = null;
    customLineups.away = null;
    updateTeamPreview('home'); updateTeamPreview('away');
    startMatch();
    toast('Tournament match — live · formations randomized');
  }


  function simTournamentRound() {
    if (!tournament) return;
    withLoading('Simulating round…', function() {
      _simTournamentRoundWork();
      refreshTournamentStatsUI();
      // Some branches of _simTournamentRoundWork (e.g. the group-stage batch
      // path) mutate tournament state directly without saving it themselves —
      // persist here unconditionally so a bulk "Simulate Round" always lands
      // on disk immediately instead of waiting on the next autosave tick.
      persistAll();
      saveStats();
    });
  }

  function _simTournamentRoundWork() {
    if (!tournament) return;
    if (tournament.format === 'table') {
      simLeagueTournamentRound();
      return;
    }
    if (tournament.format === 'league' || tournament.stage === 'league') {
      const unplayed = (tournament.fixtures || []).filter(f => !f.played);
      if (!unplayed.length) { advanceUCLFromLeague(); return; }
      const batch = unplayed.slice(0, Math.max(4, Math.ceil(unplayed.length / 4)));
      batch.forEach(f => {
        const idx = tournament.fixtures.indexOf(f);
        if (idx >= 0) simUCLFixture(idx);
      });
      return;
    }
    if (tournament.stage === 'playoff') {
      tournament.playoff.forEach((p, i) => { if (!p.played) simPlayoffTie(i); });
      return;
    }
    if (tournament.stage === 'groups') {
      const unplayed = tournament.fixtures.filter(f => !f.played);
      if (!unplayed.length) { advanceToKnockout(); return; }
      const batch = unplayed.slice(0, Math.max(2, Math.ceil(unplayed.length / 3)));
      batch.forEach(f => {
        const home = getTeam(f.home), away = getTeam(f.away);
        if (!home || !away) return;
        const result = simQuickMatch(home, away);
        f.played = true; f.homeScore = result.home; f.awayScore = result.away; f.report = result.report;
        const g = tournament.groups[f.group];
        const ht = g.teams.find(t => t.team.id === f.home);
        const at = g.teams.find(t => t.team.id === f.away);
        if (!ht || !at) return;
        ht.played++; at.played++;
        ht.gf += result.home; ht.ga += result.away;
        at.gf += result.away; at.ga += result.home;
        if (result.home > result.away) { ht.won++; ht.pts += 3; at.lost++; }
        else if (result.away > result.home) { at.won++; at.pts += 3; ht.lost++; }
        else { ht.drawn++; at.drawn++; ht.pts++; at.pts++; }
      });
      renderGroups();
      const remaining = tournament.fixtures.filter(f => !f.played).length;
      const stageTitle = document.getElementById('tour-stage-title');
      if (stageTitle) stageTitle.textContent = remaining ? `Group Stage — ${remaining} matches left` : 'Group Stage Complete';
      if (!remaining && tournament.stage === 'groups') advanceToKnockout();
    } else if (tournament.stage === 'knockout') {
      simKnockoutRound();
    }
  }

  function simAllTournament() {
    if (!tournament) return;
    withLoadingProgress('Simulating full tournament…', async function() {
      await _simAllTournamentWork();
      // setChampion()/simPlayoffTie() already persist on the paths that hit
      // them, but not every branch above does (e.g. group-stage fixtures
      // simulated directly in the loop) — persist unconditionally so a
      // full-tournament bulk sim is always saved immediately.
      persistAll();
      saveStats();
    });
  }

  // Rough remaining-match count for a single-elimination bracket, used only
  // to size the "Simulate All" progress bar denominator — counts the
  // current round's unplayed ties plus a geometric estimate of every round
  // still to come (N + N/2 + N/4 + … + 1).
  function estimateRemainingKnockoutMatches(knockout) {
    if (!knockout || !knockout.length) return 0;
    const round = knockout[knockout.length - 1];
    let n = (round && round.matches) ? round.matches.filter(m => !m.played && m.home && m.away).length : 0;
    let total = 0;
    while (n >= 1) { total += n; if (n === 1) break; n = Math.floor(n / 2); }
    return total;
  }
  async function _simAllTournamentWork() {
    if (!tournament) return;
    const updateLoading = (msg) => {
      const t = document.getElementById('loading-text');
      if (t) t.textContent = msg;
    };
    const startTime = Date.now();
    let done = 0;

    // ========== Domestic league (table) format ==========
    if (tournament.format === 'table') {
      await simAllLeagueTournament(updateLoading, updateLoadingProgress, startTime);
      return;
    }

    // ========== UCL / League format ==========
    if (tournament.format === 'league' || tournament.type === 'ucl') {
      const unplayedFixtures = (tournament.fixtures || []).filter(f => !f.played);
      const unplayedPlayoff = (tournament.playoff || []).filter(p => !p.played);
      const total = unplayedFixtures.length + unplayedPlayoff.length
        + estimateRemainingKnockoutMatches(tournament.knockout);
      updateLoadingProgress(0, Math.max(total, 1), startTime);

      updateLoading('Simulating league phase…');
      for (const f of unplayedFixtures) {
        const home = getTeam(f.home), away = getTeam(f.away);
        if (!home || !away) continue;
        const result = simQuickMatch(home, away, { countForLeaderboard: true });
        f.played = true;
        f.homeScore = result.home;
        f.awayScore = result.away;
        f.report = result.report;
        applyLeagueResult(f.home, f.away, result.home, result.away);
        done++; updateLoadingProgress(done, total, startTime); await simTick();
      }

      if (tournament.stage === 'league' || !tournament.playoff) {
        try { advanceUCLFromLeague(); } catch (e) { console.warn(e); }
      }

      updateLoading('Simulating playoffs…');
      if (tournament.playoff && tournament.playoff.length) {
        for (let i = 0; i < tournament.playoff.length; i++) {
          if (!tournament.playoff[i].played) {
            try { simPlayoffTie(i); } catch (e) { console.warn(e); }
            done++; updateLoadingProgress(done, total, startTime); await simTick();
          }
        }
        if (tournament.stage === 'playoff' || tournament.playoff.every(p => p.played)) {
          try { finishUCLPlayoffs(); } catch (e) { console.warn(e); }
        }
      }

      updateLoading('Simulating knockout rounds…');
      let guard = 0;
      while (!tournament.champion && tournament.knockout && tournament.knockout.length && guard < 30) {
        guard++;
        const ri = tournament.knockout.length - 1;
        const round = tournament.knockout[ri];
        if (!round || !round.matches) break;
        const isFinal = round.name === 'Final' || round.matches.length === 1;

        for (const m of round.matches) {
          if (m.played || !m.home || !m.away) continue;
          if (isFinal || m.twoLeg === false) simSingleFinal(m);
          else simTwoLegTie(m);
          done++; updateLoadingProgress(done, total, startTime); await simTick();
        }

        // If any still unplayed, stop this iteration
        if (round.matches.some(m => !m.played && m.home && m.away)) break;

        const winners = round.matches.map(m => m.winner).filter(Boolean);
        if (winners.length <= 1) {
          if (winners[0]) setChampion(winners[0]);
          break;
        }

        // Create next round only if we are still on the last round
        if (ri === tournament.knockout.length - 1) {
          let list = winners.slice();
          if (list.length % 2 === 1) list.pop();
          if (list.length < 2) {
            setChampion(list[0] || winners[0]);
            break;
          }
          const nextMatches = [];
          const nextIsFinal = list.length === 2;
          for (let i = 0; i < list.length; i += 2) {
            if (nextIsFinal) {
              nextMatches.push({
                home: list[i], away: list[i + 1], twoLeg: false, played: false,
                homeScore: null, awayScore: null, winner: null, report: null
              });
            } else {
              nextMatches.push(typeof makeTwoLegTie === 'function'
                ? makeTwoLegTie(list[i], list[i + 1])
                : { home: list[i], away: list[i + 1], twoLeg: true, played: false, homeScore: null, awayScore: null, winner: null });
            }
          }
          tournament.knockout.push({
            name: getRoundName(list.length),
            matches: nextMatches,
            twoLeg: !nextIsFinal
          });
        }
      }

      updateLoadingProgress(Math.max(total, 1), Math.max(total, 1), startTime);
      assignTournamentAwards();
      try { renderUCLLeague(); } catch (e) {}
      try { renderBracket(); } catch (e) {}
      try { refreshTournamentStatsUI(); } catch (e) {}
      if (tournament.champion) {
        const stageTitle = document.getElementById('tour-stage-title');
        if (stageTitle) stageTitle.innerHTML = 'Champions: ' + teamMark(tournament.champion, 20) + ' ' + tournament.champion.name;
        toast(tournament.champion.name + ' win the ' + (tournament.competitionName || 'Champions League') + '!');
      } else {
        toast('Tournament simulation finished');
      }
      return;
    }

    // ========== World Cup path ==========
    const unplayedGroupFixtures = (tournament.fixtures || []).filter(f => !f.played);
    // Knockout bracket doesn't exist yet at this point (it's built by
    // advanceToKnockout() once groups finish), so estimate its match count
    // from the qualifier count instead: a single-elim bracket of Q teams
    // plays exactly Q-1 matches.
    const qualifierEstimate = tournament.knockout && tournament.knockout.length
      ? 0 : (tournament.groups || []).length * 2;
    const knockoutEstimate = tournament.knockout && tournament.knockout.length
      ? estimateRemainingKnockoutMatches(tournament.knockout)
      : Math.max(0, qualifierEstimate - 1);
    const total = unplayedGroupFixtures.length + knockoutEstimate;
    updateLoadingProgress(0, Math.max(total, 1), startTime);

    updateLoading('Simulating group stage…');
    for (const f of unplayedGroupFixtures) {
      const home = getTeam(f.home), away = getTeam(f.away);
      if (!home || !away) continue;
      const result = simQuickMatch(home, away, { countForLeaderboard: true });
      f.played = true;
      f.homeScore = result.home;
      f.awayScore = result.away;
      f.report = result.report;
      const g = tournament.groups && tournament.groups[f.group];
      done++; updateLoadingProgress(done, total, startTime); await simTick();
      if (!g) continue;
      const ht = g.teams.find(t => t.team.id === f.home);
      const at = g.teams.find(t => t.team.id === f.away);
      if (!ht || !at) continue;
      ht.played++; at.played++;
      ht.gf += result.home; ht.ga += result.away;
      at.gf += result.away; at.ga += result.home;
      if (result.home > result.away) { ht.won++; ht.pts += 3; at.lost++; }
      else if (result.away > result.home) { at.won++; at.pts += 3; ht.lost++; }
      else { ht.drawn++; at.drawn++; ht.pts++; at.pts++; }
    }

    if (!tournament.champion && tournament.stage !== 'knockout' && tournament.stage !== 'complete') {
      updateLoading('Advancing to knockout…');
      try { advanceToKnockout(); } catch (e) { console.warn(e); }
    }

    updateLoading('Simulating knockout rounds…');
    let safety = 0;
    while (!tournament.champion && safety < 30) {
      safety++;
      if (!tournament.knockout || !tournament.knockout.length) break;
      const ri = tournament.knockout.length - 1;
      const round = tournament.knockout[ri];
      if (!round || !round.matches) break;

      for (const m of round.matches) {
        if (m.played || !m.home || !m.away) continue;
        const result = simQuickMatch(m.home, m.away, { allowET: true, allowPens: true, countForLeaderboard: true });
        m.homeScore = result.home;
        m.awayScore = result.away;
        m.played = true;
        m.report = result.report;
        if (result.pens) {
          m.penalties = true;
          m.pens = result.pens;
          m.winner = result.pens.home > result.pens.away ? m.home : m.away;
        } else if (result.home > result.away) m.winner = m.home;
        else if (result.away > result.home) m.winner = m.away;
        else {
          m.penalties = true;
          m.winner = seededRandom() < 0.5 ? m.home : m.away;
        }
        done++; updateLoadingProgress(done, total, startTime); await simTick();
      }

      if (round.matches.some(m => m.home && m.away && !m.played)) break;

      const winners = round.matches.map(m => m.winner).filter(Boolean);
      if (winners.length <= 1) {
        if (winners[0]) setChampion(winners[0]);
        break;
      }

      if (ri === tournament.knockout.length - 1) {
        let list = winners.slice();
        if (list.length % 2 === 1) list.pop();
        if (list.length < 2) {
          setChampion(list[0] || winners[0]);
          break;
        }
        maybeCreateThirdPlacePlayoff(round);
        const nextMatches = [];
        for (let i = 0; i < list.length; i += 2) {
          nextMatches.push({
            home: list[i], away: list[i + 1],
            homeScore: null, awayScore: null, winner: null, played: false, report: null
          });
        }
        tournament.knockout.push({
          name: getRoundName(list.length),
          matches: nextMatches
        });
      }
    }

    updateLoadingProgress(Math.max(total, 1), Math.max(total, 1), startTime);
    tournament.stage = tournament.champion ? 'complete' : (tournament.knockout && tournament.knockout.length ? 'knockout' : tournament.stage);
    assignTournamentAwards();
    try { renderGroups(); } catch (e) {}
    try { renderBracket(); } catch (e) {}
    try { refreshTournamentStatsUI(); } catch (e) {}
    if (tournament.champion) {
      const stageTitle = document.getElementById('tour-stage-title');
      if (stageTitle) stageTitle.innerHTML = 'Champions: ' + teamMark(tournament.champion, 20) + ' ' + tournament.champion.name;
      toast(tournament.champion.name + ' win the tournament!');
    } else {
      toast('Tournament simulation finished');
    }
  }


  function simUCLFixture(idx) {
    if (!tournament || !tournament.fixtures[idx] || tournament.fixtures[idx].played) return;
    showLoading('Simulating match…');
    setTimeout(function() {
      try { _simUCLFixtureWork(idx); }
      finally { hideLoading(); refreshTournamentStatsUI(); try { renderUCLLeague(); renderUCLFixtures(); } catch(e) {} persistAll(); }
    }, 30);
  }
  function _simUCLFixtureWork(idx) {
    if (!tournament || !tournament.fixtures[idx] || tournament.fixtures[idx].played) return;
    const f = tournament.fixtures[idx];
    const home = getTeam(f.home), away = getTeam(f.away);
    const result = simQuickMatch(home, away);
    f.played = true; f.homeScore = result.home; f.awayScore = result.away; f.report = result.report;
    applyLeagueResult(f.home, f.away, result.home, result.away);
    renderUCLLeague();
    renderTournamentLeaderboard();
    if (tournament.fixtures.every(x => x.played)) {
      toast('League phase complete');
      advanceUCLFromLeague();
    }
    refreshTournamentStatsUI();
  }

  function playUCLFixture(idx) {
    if (!tournament || !tournament.fixtures[idx] || tournament.fixtures[idx].played) return;
    window._uclFixtureIdx = idx;
    window._tourFixtureIdx = idx;
    window._koRoundIdx = null;
    window._koMatchIdx = null;
    window._fromTournament = true;
    window._seasonFixture = null;
    window._backTarget = 'tournament';
    currentSeasonComp = null;
    const f = tournament.fixtures[idx];
    switchView('match');
    const homeSel = document.getElementById('home-team');
    const awaySel = document.getElementById('away-team');
    if (homeSel) homeSel.value = f.home;
    if (awaySel) awaySel.value = f.away;
    const formKeys = Object.keys(FORMATIONS);
    const hf = formKeys[Math.floor(seededRandom() * formKeys.length)];
    const af = formKeys[Math.floor(seededRandom() * formKeys.length)];
    const hForm = document.getElementById('home-formation');
    const aForm = document.getElementById('away-formation');
    if (hForm) hForm.value = hf;
    if (aForm) aForm.value = af;
    // Clear custom lineups so random formation applies
    customLineups.home = null;
    customLineups.away = null;
    updateTeamPreview('home'); updateTeamPreview('away');
    startMatch();
    toast('UCL match — live · formations randomized');
  }


  function advanceUCLFromLeague() {
    if (!tournament || tournament.format !== 'league') return;
    const sorted = sortedLeague();
    if (sorted.length < 8) {
      // Small field: top half direct, rest playoff or direct KO
      const half = Math.floor(sorted.length / 2);
      const direct = sorted.slice(0, Math.min(8, half)).map(r => r.team);
      buildUCLKnockoutFromTeams(direct.length >= 2 ? direct : sorted.slice(0, 4).map(r => r.team), true);
      return;
    }

    const direct = sorted.slice(0, 8).map(r => r.team);
    const playoffTeams = sorted.slice(8, Math.min(24, sorted.length));
    const eliminated = sorted.slice(24);

    tournament.stage = 'playoff';
    tournament.playoff = [];

    // Pair 9th vs 24th, 10th vs 23rd, ...
    const n = playoffTeams.length;
    for (let i = 0; i < Math.floor(n / 2); i++) {
      const high = playoffTeams[i];
      const low = playoffTeams[n - 1 - i];
      if (!high || !low) continue;
      tournament.playoff.push({
        home: high.team, // higher rank hosts 2nd leg
        away: low.team,
        seedHigh: i + 9,
        seedLow: 24 - i,
        leg1: { played: false, homeScore: null, awayScore: null, report: null },
        leg2: { played: false, homeScore: null, awayScore: null, report: null },
        aggHome: 0,
        aggAway: 0,
        winner: null,
        played: false
      });
    }

    tournament._uclDirect = direct;
    renderUCLLeague();
    renderUCLFixtures();
    renderBracket();
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = 'Knockout Playoffs (9th–24th)';
    const btn = document.getElementById('btn-sim-round');
    if (btn) btn.textContent = 'Simulate Playoffs';
    toast('Top 8 seeded to R16. Playoffs underway.');
  }

  function simPlayoffTie(idx) {
    if (!tournament || !tournament.playoff[idx] || tournament.playoff[idx].played) return;
    withLoading('Simulating match…', function() {
      _simPlayoffTieWork(idx);
    });
  }

  function _simPlayoffTieWork(idx) {
    if (!tournament || !tournament.playoff[idx] || tournament.playoff[idx].played) return;
    const p = tournament.playoff[idx];
    // Leg 1: away team (lower seed) at home vs higher seed
    const leg1Home = p.away, leg1Away = p.home;
    const r1 = simQuickMatch(leg1Home, leg1Away, { allowET: false, allowPens: false });
    p.leg1 = { played: true, homeScore: r1.home, awayScore: r1.away, report: r1.report, homeId: leg1Home.id, awayId: leg1Away.id };
    // Leg 2: higher seed at home
    const r2 = simQuickMatch(p.home, p.away, { allowET: true, allowPens: true });
    p.leg2 = { played: true, homeScore: r2.home, awayScore: r2.away, report: r2.report, homeId: p.home.id, awayId: p.away.id };
    // Aggregate from higher seed perspective: leg1 away goals + leg2 home goals
    p.aggHome = r1.away + r2.home; // higher seed total
    p.aggAway = r1.home + r2.away; // lower seed total
    if (p.aggHome > p.aggAway) p.winner = p.home;
    else if (p.aggAway > p.aggHome) p.winner = p.away;
    else {
      // Pens already may have decided leg2 if scores level after 90 — if still level use pens flag or random
      if (r2.pens) { p.winner = r2.pens.home > r2.pens.away ? p.home : p.away; p.pens = r2.pens; }
      else p.winner = seededRandom() < 0.5 ? p.home : p.away;
      p.penalties = true;
    }
    p.played = true;
    renderUCLFixtures();
    if (tournament.playoff.every(x => x.played)) finishUCLPlayoffs();
    refreshTournamentStatsUI();
    persistAll();
  }

  function finishUCLPlayoffs() {
    const winners = tournament.playoff.map(p => p.winner).filter(Boolean);
    const direct = tournament._uclDirect || sortedLeague().slice(0, 8).map(r => r.team);
    // R16: typically top seeds vs playoff winners — interleave
    const r16 = [];
    for (let i = 0; i < 8; i++) {
      if (direct[i]) r16.push(direct[i]);
      if (winners[i]) r16.push(winners[i]);
    }
    // Ensure 16 teams
    while (r16.length > 16) r16.pop();
    while (r16.length < 16 && winners.length) { /* pad */ break; }
    buildUCLKnockoutFromTeams(r16, false);
  }

  function buildUCLKnockoutFromTeams(teams, singleLegFinalOnly) {
    let list = teams.filter(Boolean);
    while (list.length >= 2 && (list.length & (list.length - 1))) list.pop();
    if (list.length < 2) { toast('Not enough teams for knockout'); return; }
    tournament.stage = 'knockout';
    const matches = [];
    for (let i = 0; i < list.length; i += 2) {
      matches.push(makeTwoLegTie(list[i], list[i + 1]));
    }
    tournament.knockout = [{ name: getRoundName(list.length), matches, twoLeg: list.length > 2 }];
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = getRoundName(list.length);
    const btn = document.getElementById('btn-sim-round');
    if (btn) btn.textContent = 'Simulate Knockout Round';
    renderBracket();
    renderUCLFixtures();
  }

  function makeTwoLegTie(teamA, teamB) {
    return {
      home: teamA,
      away: teamB,
      twoLeg: true,
      leg1: { played: false, homeScore: null, awayScore: null, report: null },
      leg2: { played: false, homeScore: null, awayScore: null, report: null },
      homeScore: null,
      awayScore: null,
      aggHome: null,
      aggAway: null,
      winner: null,
      played: false,
      penalties: false,
      report: null
    };
  }

  function simTwoLegTie(m) {
    // Leg 1 at away stadium (away hosts)
    const r1 = simQuickMatch(m.away, m.home, { allowET: false, allowPens: false });
    m.leg1 = { played: true, homeScore: r1.home, awayScore: r1.away, report: r1.report };
    // Leg 2 at home stadium
    const r2 = simQuickMatch(m.home, m.away, { allowET: true, allowPens: true });
    m.leg2 = { played: true, homeScore: r2.home, awayScore: r2.away, report: r2.report };
    m.aggHome = r1.away + r2.home;
    m.aggAway = r1.home + r2.away;
    m.homeScore = m.aggHome;
    m.awayScore = m.aggAway;
    if (m.aggHome > m.aggAway) m.winner = m.home;
    else if (m.aggAway > m.aggHome) m.winner = m.away;
    else {
      if (r2.pens) { m.winner = r2.pens.home > r2.pens.away ? m.home : m.away; m.pens = r2.pens; }
      else m.winner = seededRandom() < 0.5 ? m.home : m.away;
      m.penalties = true;
    }
    m.played = true;
    m.report = r2.report;
  }

  function simSingleFinal(m) {
    const result = simQuickMatch(m.home, m.away, { allowET: true, allowPens: true });
    m.homeScore = result.home;
    m.awayScore = result.away;
    m.played = true;
    m.report = result.report;
    m.twoLeg = false;
    if (result.pens) {
      m.penalties = true;
      m.pens = result.pens;
      m.winner = result.pens.home > result.pens.away ? m.home : m.away;
    } else if (result.home === result.away) {
      m.penalties = true;
      m.winner = seededRandom() < 0.5 ? m.home : m.away;
    } else {
      m.winner = result.home > result.away ? m.home : m.away;
    }
  }

  function viewPlayoffReport(idx) {
    const p = tournament && tournament.playoff && tournament.playoff[idx];
    if (!p) return;
    if (p.leg1 && p.leg2 && p.leg1.report && p.leg2.report) {
      const aggText = (p.aggHome != null) ? `Aggregate: ${p.home.short} ${p.aggHome} - ${p.aggAway} ${p.away.short}${p.penalties ? (p.pens ? ` (pens ${p.pens.home}-${p.pens.away})` : ' (on penalties)') : ''}` : '';
      const legs = [
        { label: `Leg 1 · ${p.leg1.report.home.short} home`, report: p.leg1.report },
        { label: `Leg 2 · ${p.leg2.report.home.short} home`, report: p.leg2.report }
      ];
      showMatchReport(legs[1].report, { legs, activeIdx: 1, aggText });
      return;
    }
    const rep = (p.leg2 && p.leg2.report) || (p.leg1 && p.leg1.report);
    if (rep) showMatchReport(rep, null);
    else toast('Aggregate: ' + p.aggHome + '-' + p.aggAway);
  }


  // Pairs qualifiers for the first knockout round so that no match is a
  // repeat of a group-stage fixture: every group winner is drawn against a
  // runner-up/third-place team from a DIFFERENT group. Falls back to pairing
  // leftovers among themselves (still avoiding a shared group where possible)
  // if the two pools aren't the same size (e.g. only one group).
  function pairKnockoutAvoidingGroupClashes(qualifiers) {
    const winners = qualifiers.filter(q => q.rank === 1);
    const others = qualifiers.filter(q => q.rank !== 1);

    // A single greedy left-to-right pass can dead-end into a same-group
    // pairing even when a completely clash-free draw exists (classic
    // greedy-matching pitfall — an early pick can strand a later winner with
    // only their own group's runner-up left). Reshuffle and retry a number
    // of times, keeping the best (ideally zero-clash) attempt found.
    function attempt() {
      const wPool = shuffleArray(winners);
      const oPool = shuffleArray(others);
      const usedOthers = new Array(oPool.length).fill(false);
      const pairs = [];
      let clashes = 0;

      wPool.forEach(w => {
        let idx = oPool.findIndex((o, i) => !usedOthers[i] && o.group !== w.group);
        if (idx === -1) { idx = oPool.findIndex((o, i) => !usedOthers[i]); if (idx !== -1) clashes++; }
        if (idx !== -1) {
          usedOthers[idx] = true;
          pairs.push([w.team, oPool[idx].team]);
        }
      });

      let leftover = oPool.filter((o, i) => !usedOthers[i]);
      while (leftover.length >= 2) {
        const a = leftover.shift();
        let bi = leftover.findIndex(b => b.group !== a.group);
        if (bi === -1) { bi = 0; clashes++; }
        const b = leftover.splice(bi, 1)[0];
        pairs.push([a.team, b.team]);
      }

      return { pairs, clashes };
    }

    let best = attempt();
    for (let i = 0; best.clashes > 0 && i < 200; i++) {
      const next = attempt();
      if (next.clashes < best.clashes) best = next;
      if (best.clashes === 0) break;
    }
    return shuffleArray(best.pairs);
  }

  function advanceToKnockout() {
    if (!tournament) return;
    if (tournament.stage === 'knockout' || tournament.stage === 'complete') return;
    if (tournament.knockout && tournament.knockout.length) return;
    // Each qualifier is tagged with its group index and finishing rank
    // (1 = winner, 2 = runner-up, 3 = best third) so the draw can keep group
    // rivals apart in the first knockout round.
    const qualifiers = [];
    const thirdPlaces = [];
    tournament.groups.forEach((g, gi) => {
      const sorted = [...g.teams].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      if (sorted[0]) qualifiers.push({ team: sorted[0].team, group: gi, rank: 1 });
      if (sorted[1]) qualifiers.push({ team: sorted[1].team, group: gi, rank: 2 });
      if (sorted[2]) thirdPlaces.push({ row: sorted[2], group: gi });
    });
    // FIFA/UEFA/CAF/AFC-style: bring in the best third-place teams whenever
    // the direct qualifiers (2 per group) don't already form a clean
    // power-of-two bracket. The target is simply the next power of two at or
    // above the direct-qualifier count:
    //   - Euro/AFCON/Asian Cup (6 groups → 12 direct) → target 16, so the
    //     4 best third-placed teams join the group winners/runners-up for a
    //     Round of 16.
    //   - Copa América / a 4-group Nations League split (4 groups → 8
    //     direct) → target is already 8, so no third-placed teams are
    //     needed and the bracket goes straight to the quarter-finals.
    //   - World Cup (12 groups → 24 direct) → target 32, so the 8 best
    //     thirds join for a Round of 32 (matches the real 2026 format).
    //   - An 8-group split → 16 direct is already a power of two, so no
    //     thirds are added, straight to the Round of 16.
    if (thirdPlaces.length) {
      const direct = qualifiers.length;
      let target = 1;
      while (target < direct) target *= 2;
      const need = target - direct;
      if (need > 0) {
        thirdPlaces.sort((a, b) => b.row.pts - a.row.pts || (b.row.gf - b.row.ga) - (a.row.gf - a.row.ga) || b.row.gf - a.row.gf);
        thirdPlaces.slice(0, need).forEach(t => qualifiers.push({ team: t.row.team, group: t.group, rank: 3 }));
      }
    }
    // Always force power of 2 (2,4,8,16,32) — trim the lowest-priority
    // qualifiers first (best-thirds, then runners-up); group winners are
    // never cut.
    while (qualifiers.length >= 2 && (qualifiers.length & (qualifiers.length - 1))) {
      let cutIdx = -1;
      for (let rank = 3; rank >= 2 && cutIdx === -1; rank--) {
        for (let i = qualifiers.length - 1; i >= 0; i--) {
          if (qualifiers[i].rank === rank) { cutIdx = i; break; }
        }
      }
      if (cutIdx === -1) cutIdx = qualifiers.length - 1;
      qualifiers.splice(cutIdx, 1);
    }
    if (qualifiers.length < 2) { toast('Not enough qualifiers'); return; }
    tournament.stage = 'knockout';
    const pairs = pairKnockoutAvoidingGroupClashes(qualifiers);
    tournament.knockout = [{ name: getRoundName(qualifiers.length), matches: [] }];
    pairs.forEach(([home, away]) => {
      tournament.knockout[0].matches.push({
        home, away,
        homeScore: null, awayScore: null, winner: null, played: false
      });
    });
    // Group stage is over — clear the "Upcoming Fixtures" list so it doesn't
    // linger once the tournament has moved on to the knockout bracket.
    const fixEl = document.getElementById('fixture-list');
    if (fixEl) fixEl.innerHTML = '';
    renderBracket();
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = tournament.knockout[0].name;
    const btn = document.getElementById('btn-sim-round');
    if (btn) btn.textContent = 'Simulate Knockout Round';
  }

  function getRoundName(teamCount) {
    // teamCount = number of teams still in the competition for this round
    if (teamCount >= 32) return 'Round of 32';
    if (teamCount >= 16) return 'Round of 16';
    if (teamCount >= 8) return 'Quarter-finals';
    if (teamCount >= 4) return 'Semi-finals';
    if (teamCount >= 2) return 'Final';
    return 'Knockout';
  }

  function simKnockoutRound() {
    if (!tournament || !tournament.knockout || !tournament.knockout.length) return false;
    // If called from UI button, show loading
    if (!currentMatch || !currentMatch.silentDeep) {
      withLoading('Simulating knockout round…', function() {
        _simKnockoutRoundWork();
        refreshTournamentStatsUI();
        persistAll();
        saveStats();
      });
      return true;
    }
    const res = _simKnockoutRoundWork();
    persistAll();
    saveStats();
    return res;
  }

  function _simKnockoutRoundWork() {
    if (!tournament || !tournament.knockout || !tournament.knockout.length) return false;
    if (tournament.champion) return false;
    const current = tournament.knockout[tournament.knockout.length - 1];
    if (!current || !current.matches.length) return false;

    let unplayed = current.matches.filter(m => !m.played);
    if (!unplayed.length) {
      const winners = current.matches.map(m => m.winner).filter(Boolean);
      if (winners.length === 1) { setChampion(winners[0]); renderBracket(); return false; }
      if (winners.length >= 2) {
        createNextKnockoutRound(winners, current);
        renderBracket();
        return true;
      }
      return false;
    }

    unplayed.forEach(m => {
      if (!m.home || !m.away) return;
      const result = simQuickMatch(m.home, m.away, { allowET: true, allowPens: true });
      m.homeScore = result.home;
      m.awayScore = result.away;
      m.played = true;
      m.report = result.report;
      if (result.pens) {
        m.penalties = true;
        m.pens = result.pens;
        m.winner = result.pens.home > result.pens.away ? m.home : m.away;
      } else if (result.home === result.away) {
        m.penalties = true;
        m.winner = seededRandom() < 0.5 ? m.home : m.away;
      } else {
        m.winner = result.home > result.away ? m.home : m.away;
      }
    });

    const winners = current.matches.map(m => m.winner).filter(Boolean);
    if (winners.length === 1) {
      setChampion(winners[0]);
    } else if (winners.length >= 2) {
      createNextKnockoutRound(winners, current);
    }
    renderBracket();
    renderTournamentLeaderboard();
    return true;
  }


  // Groups-format competitions only (World Cup, Nations League, Euros, Copa
  // América, AFCON, Asian Cup, Gold Cup — every format that goes group stage
  // → knockout; Champions League's league-phase knockout and the straight
  // domestic-cup knockouts never have a 3rd place play-off): when the
  // Semi-finals round has just finished, build a "3rd Place Play-off"
  // fixture between the two semi-final losers and slot it into the bracket
  // alongside the Final. Left unplayed here — same as every other knockout
  // match, it's up to the user to simulate it (Live or Instant) from the
  // bracket view. Callers that DO want it resolved immediately as part of a
  // bulk "simulate everything" action can call simThirdPlacePlayoffNow()
  // right after this.
  function createThirdPlacePlayoffFixture(finishedRound) {
    if (!tournament || tournament.format !== 'groups') return null;
    if (!finishedRound || finishedRound.name !== 'Semi-finals') return null;
    if (tournament.knockout.some(r => r.name === '3rd Place Play-off')) return null;
    const losers = finishedRound.matches.map(m => {
      if (!m.winner) return null;
      return m.winner.id === m.home.id ? m.away : m.home;
    }).filter(Boolean);
    if (losers.length < 2) return null;
    const match = {
      home: losers[0], away: losers[1],
      homeScore: null, awayScore: null, winner: null, played: false, penalties: false
    };
    tournament.knockout.push({ name: '3rd Place Play-off', matches: [match] });
    return match;
  }

  // Instantly resolves an unplayed 3rd Place Play-off match — used only by
  // bulk auto-sim flows (Simulate Round / Simulate All) that are already
  // resolving every other unplayed match without individual user
  // interaction; a single-match Live/Instant sim never calls this, so
  // completing a semi-final there always leaves the 3rd place match for the
  // user to trigger themselves, same as the Final.
  function simThirdPlacePlayoffNow(match) {
    if (!match || match.played) return;
    const result = simQuickMatch(match.home, match.away, { allowET: true, allowPens: true, countForLeaderboard: true });
    match.homeScore = result.home;
    match.awayScore = result.away;
    match.played = true;
    match.report = result.report;
    if (result.pens) {
      match.penalties = true;
      match.pens = result.pens;
      match.winner = result.pens.home > result.pens.away ? match.home : match.away;
    } else if (result.home === result.away) {
      match.penalties = true;
      match.winner = seededRandom() < 0.5 ? match.home : match.away;
    } else {
      match.winner = result.home > result.away ? match.home : match.away;
    }
  }

  // Convenience wrapper for the bulk-sim call sites: create the fixture (if
  // due) and resolve it immediately, preserving their previous "fully
  // automatic" behavior.
  function maybeCreateThirdPlacePlayoff(finishedRound) {
    const match = createThirdPlacePlayoffFixture(finishedRound);
    if (match) simThirdPlacePlayoffNow(match);
  }

  function createNextKnockoutRound(winners, finishedRound) {
    let list = (winners || []).filter(Boolean);
    if (list.length % 2 === 1) list = list.slice(0, list.length - 1);
    if (list.length < 2) {
      if (winners && winners[0]) setChampion(winners[0]);
      return;
    }
    const name = getRoundName(list.length);
    const last = tournament.knockout[tournament.knockout.length - 1];
    if (last && last.name === name && !last.matches.every(m => m.played)) return;
    if (finishedRound) maybeCreateThirdPlacePlayoff(finishedRound);
    const nextMatches = [];
    for (let i = 0; i < list.length; i += 2) {
      nextMatches.push({
        home: list[i], away: list[i + 1],
        homeScore: null, awayScore: null, winner: null, played: false, penalties: false
      });
    }
    tournament.knockout.push({ name, matches: nextMatches });
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = name;
  }


  function setChampion(team) {
    if (!team || !tournament || tournament.champion) return;
    tournament.champion = team;
    tournament.stage = 'complete';
    // Runners-up: loser of final
    const finalRound = (tournament.knockout || []).find(r => r.name === 'Final') || (tournament.knockout || [])[(tournament.knockout || []).length - 1];
    if (finalRound && finalRound.matches && finalRound.matches[0]) {
      const fm = finalRound.matches[0];
      tournament.runnersUp = (fm.winner && fm.winner.id === fm.home.id) ? fm.away : fm.home;
    }
    // Third place: use the actual 3rd Place Play-off result when it exists
    // (World Cup mode), otherwise fall back to the semi-final losers.
    const thirdPlaceRound = (tournament.knockout || []).find(r => r.name === '3rd Place Play-off');
    if (thirdPlaceRound && thirdPlaceRound.matches && thirdPlaceRound.matches[0] && thirdPlaceRound.matches[0].played) {
      const tm = thirdPlaceRound.matches[0];
      tournament.thirdPlace = tm.winner || null;
      tournament.fourthPlace = tm.winner ? (tm.winner.id === tm.home.id ? tm.away : tm.home) : null;
    } else {
      const sf = (tournament.knockout || []).find(r => r.name === 'Semi-finals');
      if (sf && sf.matches && sf.matches.length >= 2) {
        const losers = sf.matches.map(m => {
          if (!m.winner) return null;
          return m.winner.id === m.home.id ? m.away : m.home;
        }).filter(Boolean);
        tournament.thirdPlace = losers[0] || null;
        tournament.fourthPlace = losers[1] || null;
      }
    }
    const tName = tournament.competitionName || (tournament.type === 'worldcup' ? 'World Cup' : 'Champions League');
    const runExtra = { category: 'tournament', run: tournament._runId || Date.now() };
    // Record the team trophy (and manager award) BEFORE computing this
    // tournament's individual awards — the Ballon d'Or / Gerd Müller /
    // Yashin scoring below reads the permanent trophy case for career
    // pedigree, so the cup just won here needs to already be in it.
    pushTeamTrophy(tName, team.name, 'Tournament', runExtra);
    pushManagerAward(tName + ' Winning Manager', team, 'Tournament', runExtra);
    assignTournamentAwards();
    recordIndividualAwardsFromAwardsObject(tournament.awards, tName + ' Tournament', runExtra);
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.innerHTML = 'Champions: ' + teamMark(team, 20) + ' ' + team.name;
    renderTournamentPodium();
    persistAll();
  }

  function renderTournamentPodium() {
    // Lives inside the "Tournament Stats" card (#tour-leaderboard-mini),
    // above the awards row, rather than as its own block above the bracket
    // — keeps every end-of-tournament summary (standings, awards, stat
    // leaders) together in one place instead of scattered across the page.
    let el = document.getElementById('tour-podium');
    if (!el) {
      const statsCard = document.getElementById('tour-leaderboard-mini');
      const awards = document.getElementById('tour-awards');
      if (statsCard) {
        el = document.createElement('div');
        el.id = 'tour-podium';
        if (awards) statsCard.insertBefore(el, awards);
        else statsCard.appendChild(el);
      }
    }
    if (!el || !tournament || !tournament.champion) return;
    const first = tournament.champion;
    const second = tournament.runnersUp;
    const third = tournament.thirdPlace;
    const tName = tournament.competitionName || (tournament.type === 'worldcup' ? 'World Cup' : 'Champions League');
    el.innerHTML = `
      <div class="card-title">${trophyMark(tName, 28)} Final Standings</div>
      <div class="podium">
        <div class="podium-place">
          <div class="place-num">2</div>
          <div class="place-team">${second ? teamMark(second, 20) + ' ' + second.name : '—'}</div>
          <div class="place-label">Runners-up</div>
        </div>
        <div class="podium-place first">
          <div class="place-num">1</div>
          <div class="place-team">${teamMark(first, 20)} ${first.name}</div>
          <div class="place-label">Champions</div>
        </div>
        <div class="podium-place">
          <div class="place-num">3</div>
          <div class="place-team">${third ? teamMark(third, 20) + ' ' + third.name : '—'}</div>
          <div class="place-label">Third place</div>
        </div>
      </div>`;
  }


  function simQuickMatch(homeTeam, awayTeam, opts) {
    // Full deep simulation — same engine as live matches (goals, cards, MOTM, injuries, ratings)
    opts = opts || {};
    const prevMatch = currentMatch;
    const prevFixture = window._tourFixtureIdx;
    const prevKoR = window._koRoundIdx;
    const prevKoM = window._koMatchIdx;
    const prevLeagueFixture = window._tourLeagueFixtureIdx;
    // Prevent live tournament hooks from double-writing during bulk sim
    window._tourFixtureIdx = undefined;
    window._koRoundIdx = undefined;
    window._koMatchIdx = undefined;
    window._tourLeagueFixtureIdx = undefined;

    const hf = opts.homeForm || pickTeamFormation(homeTeam);
    const af = opts.awayForm || pickTeamFormation(awayTeam);
    const homeSquad = buildSquad(homeTeam, hf);
    const awaySquad = buildSquad(awayTeam, af);

    currentMatch = {
      home: { team: homeTeam, squad: homeSquad, score: 0, stats: blankStats(), penScore: null },
      away: { team: awayTeam, squad: awaySquad, score: 0, stats: blankStats(), penScore: null },
      minute: 0,
      status: '1st Half',
      finished: false,
      events: [],
      period: 'H1', periodStartRaw: 0, periodBaseDisplay: 0, periodDuration: 45, periodStoppage: null,
      dispMin: 0, dispLabel: "0'",
      homeOnPitch: homeSquad.starting.map(p => p.id),
      awayOnPitch: awaySquad.starting.map(p => p.id),
      homeSubsUsed: 0,
      awaySubsUsed: 0,
      maxSubs: 5,
      injuries: [],
      cards: { home: {}, away: {} },
      // possession must start at 50 here exactly like startMatch() does —
      // without it, m.possession is undefined the first time generateEvents()
      // smooths it toward a target, which turns it into NaN. NaN then poisons
      // qualityGap/homeChance downstream, and `seededRandom() < NaN` is always
      // false, so the "away" side wins every single attacking-side roll for
      // the whole match — hence one team racking up 20+ shots while the other
      // gets 0-5 (and the report showing a flat 50/50 possession is just the
      // "||50" display fallback masking the NaN, not a real 50/50 game).
      possession: 50,
      subLog: { home: {}, away: {} },
      leftPitch: { home: [], away: [] }, // playerIds who have left the pitch (sub'd off, sent off, or injured off) — can never return
      playerMatchStats: {},
      goalList: [],
      allowET: !!opts.allowET,
      allowPens: !!opts.allowPens,
      silentDeep: true,
      quietSim: true,
      countForLeaderboard: tournament ? true : !!opts.countForLeaderboard,
      inET: false,
      inPens: false
    };
    currentMatch.home.roles = assignMatchRoles(currentMatch.home);
    currentMatch.away.roles = assignMatchRoles(currentMatch.away);
    // Form & Condition system (engine/form.js) — same per-kickoff roll as
    // the interactive startMatch() path above.
    rollMatchConditions(currentMatch);

    let safety = 0;
    while (currentMatch && !currentMatch.finished && safety < 250) {
      tick(true);
      safety++;
    }
    // Force finish if somehow stuck
    if (currentMatch && !currentMatch.finished) {
      endMatch();
    }

    // simQuickMatch is exclusively the auto-sim path (every call site bulk-
    // simulates fixtures the user hasn't chosen to watch live — see
    // simulation/tournamentEngine.js, seasonEngine.js, leagueTournamentEngine.js),
    // so it only ever needs the lightweight report, not the full stat sheet.
    const report = currentMatch ? buildLightMatchReport(currentMatch) : null;
    const result = {
      home: currentMatch ? currentMatch.home.score : 0,
      away: currentMatch ? currentMatch.away.score : 0,
      pens: currentMatch && currentMatch.home.penScore != null
        ? { home: currentMatch.home.penScore, away: currentMatch.away.penScore }
        : null,
      report
    };

    currentMatch = prevMatch;
    window._tourFixtureIdx = prevFixture;
    window._koRoundIdx = prevKoR;
    window._koMatchIdx = prevKoM;
    window._tourLeagueFixtureIdx = prevLeagueFixture;
    saveStats();
    return result;
  }

  function poisson(lambda) {
    const L = Math.exp(-Math.max(0.1, lambda));
    let k = 0, p = 1;
    do { k++; p *= seededRandom(); } while (p > L && k < 10);
    return k - 1;
  }

  
  function assignTournamentAwards() {
    if (!tournament) return;
    const top = (key) => Object.values(tournamentStats[key] || {}).sort((a,b) => b.count - a.count);
    const goals = top('goals');
    const assists = top('assists');
    const saves = top('saves');
    const motm = top('motm');
    const cleanSheets = top('cleanSheets');
    const puskas = top('puskas');
    const ratingsAny = Object.values(tournamentStats.ratings || {})
      .filter(x => (x.count || 0) > 0)
      .sort((a,b) => b.avg - a.avg || b.count - a.count);

    // Golden Ball: the same holistic "best player" scoring as the Ballon
    // d'Or (domestic/continental/international context, trophies, consistency,
    // big-game performances) run against this tournament's own stat bucket —
    // not just G+A and average rating, so a quiet-but-consistent passer can't
    // out-rank a genuine standout, and a genuine standout still needs more
    // than one big night to top a player who was excellent throughout.
    const goldenScores = computeContextualPlayerScores(tournamentStats, 3);
    Object.values(goldenScores).forEach(e => { e.count = Math.round(e.pts); });
    const goldenBallData = Object.values(goldenScores)
      .filter(e => e.pts > 0 && (e.apps >= 3 || e.goals + e.assists + e.motm >= 3))
      .sort((a,b) => b.pts - a.pts || b.apps - a.apps);

    // Ballon d'Or, Gerd Müller Award and Yashin Trophy are season-wide
    // honors in real life, not single-tournament ones — even when a
    // tournament finishes with no Season Calendar running at all, they're
    // computed off the global `stats` bucket (the player's whole body of
    // work so far) rather than just this tournament's own numbers, same as
    // the season-end archiving in seasonEngine.js.
    const ballonDor = computeBallonRanking(stats)[0] || null;
    const gerdMuller = computeGerdMullerRanking(stats)[0] || null;
    const yashin = computeYashinRanking(stats)[0] || null;

    tournament.awards = {
      goldenBoot: goals[0] || null,
      goldenBall: goldenBallData[0] || ratingsAny[0] || (motm[0] && (motm[0].count >= 2) ? motm[0] : null) || null,
      goldenGlove: saves[0] || null,
      goldenClean: cleanSheets[0] || null,
      topAssists: assists[0] || null,
      mostMotm: motm[0] || null,
      puskas: puskas[0] || null,
      ballonDor,
      gerdMuller,
      yashin
    };
  }

  function renderTournamentAwards() {
    const el = document.getElementById('tour-awards');
    if (!el || !tournament) return;
    if (!tournament.awards) assignTournamentAwards();
    const a = tournament.awards || {};
    const card = (title, icon, p, extra) => {
      const titleHtml = `<div class="am-title">${trophyMark(title, 32)} ${title}</div>`;
      if (!p) return `<div class="award-mini">${titleHtml}<div class="am-empty">TBD</div></div>`;
      return `<div class="award-mini" onclick="App.showPlayerProfile('${p.id}')" style="cursor:pointer">${titleHtml}
        ${lbAvatar(p, 44)}
        <div class="am-name">${playerNameHTML(p)}</div>
        <div class="am-meta">${p.team || ''} · ${extra}</div></div>`;
    };
    el.innerHTML = `
      <div class="card-title">Tournament Awards</div>
      <div class="awards-row">
        ${card('Golden Boot', '👟', a.goldenBoot, (a.goldenBoot && a.goldenBoot.count) + ' goals')}
        ${card('Golden Ball', '🏆', a.goldenBall, a.goldenBall && (a.goldenBall.goals != null || a.goldenBall.assists != null)
          ? ((a.goldenBall.goals||0) + 'G ' + (a.goldenBall.assists||0) + 'A' + (a.goldenBall.avg ? ' · Avg ' + a.goldenBall.avg.toFixed(2) : ''))
          : (a.goldenBall && a.goldenBall.avg != null ? ('Avg ' + a.goldenBall.avg.toFixed(2)) : ((a.goldenBall && a.goldenBall.count) + ' MOTM')))}
        ${card('Golden Glove', '🧤', a.goldenGlove, (a.goldenGlove && a.goldenGlove.count) + ' saves')}
        ${card('Top Assists', '🎯', a.topAssists, (a.topAssists && a.topAssists.count) + ' assists')}
      </div>`;
  }

  function refreshTournamentStatsUI() {
    if (!tournament) return;
    try {
      assignTournamentAwards();
      renderTournamentAwards();
      renderTournamentLeaderboard();
      if (tournament.champion) renderTournamentPodium();
    } catch (e) { console.warn(e); }
  }

  function renderTournamentLeaderboard() {
    assignTournamentAwards();
    renderTournamentAwards();
    const el = document.getElementById('tour-stats-preview');
    if (!el) return;
    const top = (key, n) => Object.values(tournamentStats[key] || {}).sort((a,b)=>b.count-a.count).slice(0, n);
    const g = top('goals', 10), a = top('assists', 10), m = top('motm', 10);
    const y = top('yellows', 5), r = top('reds', 5), s = top('saves', 10);
    const hasAny = g.length || a.length || m.length || y.length || r.length;
    if (!hasAny) {
      el.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">Play tournament matches to fill stats (goals, cards, MOTM…).</p>';
      return;
    }
    const col = (title, arr) => `<div><div style="font-weight:700;color:var(--accent-gold);margin-bottom:6px">${title}</div>
      ${arr.map((p,i)=>`<div class="lb-mini-row ${i<3?'lb-mini-top rank-'+(i+1):''}" onclick="App.showPlayerProfile('${p.id}')" style="cursor:pointer">${rankBadge(i)}${lbAvatar(p,26)}<span class="lb-mini-name">${playerNameHTML(p)}</span><span style="color:var(--text-muted);font-size:0.75rem">${p.team||''}</span><b class="lb-mini-count">${p.count}</b></div>`).join('')||'<span style="color:var(--text-muted)">—</span>'}</div>`;
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
        ${col(emojiImg('goal', 'Goal') + ' Golden Boot', g)}
        ${col(emojiImg('assist', 'Assist') + ' Assists', a)}
        ${col('⭐ MOTM', m)}
        ${col(emojiImg('yellow_card', 'Yellow card') + ' Yellows', y)}
        ${col(emojiImg('red_card', 'Red card') + ' Reds', r)}
        ${col('🧤 Saves', s)}
      </div>
      <div style="margin-top:10px;font-size:0.75rem;color:var(--text-muted)">Matchday ${globalMatchDay} · Full match engine · Injuries tracked</div>`;
  }

  function renderBracket() {
    const el = document.getElementById('bracket');
    if (!el || !tournament) return;
    if (!tournament.knockout || !tournament.knockout.length) {
      el.innerHTML = '<p style="color:var(--text-muted)">No knockout matches yet.</p>';
      return;
    }
    el.innerHTML = tournament.knockout.map((round, ri) => `
      <div class="round"><div class="round-title">${round.name}${round.twoLeg ? ' (two legs)' : ''}</div>
      ${round.matches.map((m, mi) => {
        const score = m.played
          ? (m.twoLeg !== false && m.aggHome != null
              ? `Agg ${m.aggHome}-${m.aggAway}`
              : `${m.homeScore} - ${m.awayScore}`)
          : '-';
        const pensText = m.pens ? `pens ${m.pens.home}-${m.pens.away}` : 'pens';
        return `<div class="bracket-match ${m.played ? 'played' : ''}">
          <div class="bracket-team ${m.winner && m.winner.id === m.home.id ? 'winner' : ''}">
            <span>${teamMark(m.home, 18)} ${m.home.short}</span>
            <span class="bracket-score">${m.played ? (m.twoLeg !== false && m.aggHome != null ? m.aggHome : m.homeScore) : '-'}</span>
          </div>
          <div class="bracket-team ${m.winner && m.winner.id === m.away.id ? 'winner' : ''}">
            <span>${teamMark(m.away, 18)} ${m.away.short}</span>
            <span class="bracket-score">${m.played ? (m.twoLeg !== false && m.aggAway != null ? m.aggAway : m.awayScore) : '-'}</span>
          </div>
          ${m.penalties ? '<div style="font-size:0.7rem;color:var(--text-muted);text-align:center">' + pensText + '</div>' : ''}
          ${m.played && m.twoLeg !== false && m.aggHome != null ? '<div style="font-size:0.7rem;color:var(--text-muted);text-align:center">' + score + '</div>' : ''}
          ${(!m.played && m.home && m.away && !tournament.champion) ? `<div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="App.playKnockoutMatch(${ri},${mi})">▶ Live</button>
            <button class="btn btn-secondary btn-sm" onclick="App.simKnockoutMatch(${ri},${mi})">⚡ Instant</button>
          </div>` : ''}
          ${m.played ? `<button class="btn btn-secondary btn-sm" style="margin-top:6px;width:100%" onclick="App.viewKnockoutReport(${ri},${mi})">Match Report</button>` : ''}
        </div>`;
      }).join('')}
      </div>`).join('');
  }


  function simKnockoutMatch(roundIdx, matchIdx) {
    if (!tournament || !tournament.knockout[roundIdx]) return;
    const m = tournament.knockout[roundIdx].matches[matchIdx];
    if (!m || m.played) return;
    showLoading('Simulating match…');
    setTimeout(function() {
      try { _simKnockoutMatchWork(roundIdx, matchIdx); }
      finally { hideLoading(); refreshTournamentStatsUI(); }
    }, 30);
  }
  function _simKnockoutMatchWork(roundIdx, matchIdx) {
    const m = tournament.knockout[roundIdx].matches[matchIdx];
    if (!m || m.played) return;
    const round = tournament.knockout[roundIdx];
    const isFinal = round.name === 'Final' || round.matches.length === 1 || m.twoLeg === false;
    if (tournament.type === 'ucl' && !isFinal) simTwoLegTie(m);
    else if (isFinal) simSingleFinal(m);
    else {
      const result = simQuickMatch(m.home, m.away, { allowET: true, allowPens: true });
      m.homeScore = result.home; m.awayScore = result.away; m.played = true; m.report = result.report;
      if (result.pens) { m.penalties = true; m.winner = result.pens.home > result.pens.away ? m.home : m.away; }
      else if (result.home === result.away) { m.penalties = true; m.winner = seededRandom() < 0.5 ? m.home : m.away; }
      else m.winner = result.home > result.away ? m.home : m.away;
    }
    afterKnockoutMatchPlayed(roundIdx);
    refreshTournamentStatsUI();
  }

  function playKnockoutMatch(roundIdx, matchIdx) {
    if (!tournament || !tournament.knockout[roundIdx]) return;
    const m = tournament.knockout[roundIdx].matches[matchIdx];
    if (!m || m.played || !m.home || !m.away) return;
    window._koRoundIdx = roundIdx;
    window._koMatchIdx = matchIdx;
    window._tourFixtureIdx = null;
    window._uclFixtureIdx = null;
    window._fromTournament = true;
    window._seasonFixture = null;
    window._backTarget = 'tournament';
    currentSeasonComp = null;
    switchView('match');
    const homeSel = document.getElementById('home-team');
    const awaySel = document.getElementById('away-team');
    if (homeSel) homeSel.value = m.home.id;
    if (awaySel) awaySel.value = m.away.id;
    const formKeys = Object.keys(FORMATIONS);
    const hf = formKeys[Math.floor(seededRandom() * formKeys.length)];
    const af = formKeys[Math.floor(seededRandom() * formKeys.length)];
    const hForm = document.getElementById('home-formation');
    const aForm = document.getElementById('away-formation');
    if (hForm) hForm.value = hf;
    if (aForm) aForm.value = af;
    // Clear custom lineups so random formation applies
    customLineups.home = null;
    customLineups.away = null;
    updateTeamPreview('home'); updateTeamPreview('away');
    const et = document.getElementById('opt-et');
    const pens = document.getElementById('opt-pens');
    if (et) et.checked = true;
    if (pens) pens.checked = true;
    startMatch();
    toast('Knockout match — live · ET & pens on · formations randomized');
  }


  function afterKnockoutMatchPlayed(roundIdx) {
    const current = tournament.knockout[roundIdx];
    if (!current.matches.every(x => x.played)) {
      renderBracket();
      renderTournamentLeaderboard();
      return;
    }
    // The 3rd Place Play-off is a side fixture, not a bracket-advancing
    // round — it has just one match, so without this check the generic
    // "winners.length === 1" branch below would wrongly crown its winner
    // tournament champion. Its result only feeds tournament.thirdPlace/
    // fourthPlace, which setChampion() reads once the real Final finishes.
    if (current.name === '3rd Place Play-off') {
      renderBracket();
      renderTournamentLeaderboard();
      return;
    }
    const winners = current.matches.map(m => m.winner).filter(Boolean);
    if (winners.length === 1) {
      setChampion(winners[0]);
      renderBracket();
      renderTournamentLeaderboard();
      return;
    }
    if (winners.length < 2) { renderBracket(); return; }
    // Don't add next if already exists beyond this round
    if (roundIdx < tournament.knockout.length - 1) {
      renderBracket();
      return;
    }
    let list = winners.slice();
    if (list.length % 2 === 1) list.pop();
    const nextIsFinal = list.length === 2;
    // Single-match progression (one Live/Instant sim at a time): only
    // create the 3rd Place Play-off fixture, don't simulate it — the user
    // simulates it themselves from the bracket like any other match.
    createThirdPlacePlayoffFixture(current);
    const nextMatches = [];
    for (let i = 0; i < list.length; i += 2) {
      if (tournament.type === 'ucl' && !nextIsFinal) {
        nextMatches.push(makeTwoLegTie(list[i], list[i+1]));
      } else if (tournament.type === 'ucl' && nextIsFinal) {
        nextMatches.push({
          home: list[i], away: list[i+1], twoLeg: false, played: false,
          homeScore: null, awayScore: null, winner: null, report: null
        });
      } else {
        nextMatches.push({
          home: list[i], away: list[i+1], homeScore: null, awayScore: null,
          winner: null, played: false
        });
      }
    }
    tournament.knockout.push({
      name: getRoundName(list.length),
      matches: nextMatches,
      twoLeg: tournament.type === 'ucl' && !nextIsFinal
    });
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = getRoundName(list.length);
    renderBracket();
    renderTournamentLeaderboard();
  }


  function resetTournament() {
    tournament = null;
    const setup = document.getElementById('tournament-setup');
    const live = document.getElementById('tournament-live');
    if (setup) setup.style.display = 'block';
    if (live) live.style.display = 'none';
    const btn = document.getElementById('btn-sim-round');
    if (btn) btn.textContent = 'Simulate Round';
    // Clear the previous tournament's UI (bracket, podium, groups, fixtures) —
    // this does NOT touch the persistent `trophies` record, so past champions
    // still show up in the Trophy Room afterward.
    const clearIds = ['tour-stats-preview', 'tour-awards', 'tour-podium', 'bracket', 'groups-container', 'fixture-list'];
    clearIds.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    const bracketCard = document.getElementById('tour-bracket-card');
    if (bracketCard) bracketCard.style.display = '';
    const st = document.getElementById('tour-stage-title');
    if (st) st.textContent = 'Starting…';
    persistAll();
  }

  let teamsFilter = 'all';
  let teamsSearch = '';
  let teamsSort = 'name';
  let tourTeamsSearch = '';
  // Authoritative record of which teams are checked for the tournament,
  // independent of the current search filter. renderTournamentTeamSelect()
  // only ever renders the pool matching the *current* search text, so a
  // team checked before a search narrows the list would otherwise vanish
  // from the DOM entirely — reading "which teams are checked" back off
  // the DOM after that (the old approach) permanently forgets it, since
  // its checkbox no longer exists to read. Tracking selection here instead
  // means a team stays selected across searches until explicitly
  // unchecked, deselected, or the format/pool changes.
  let tourSelectedTeamIds = new Set();

  function teamAvgOvr(t) {
    const ps = t.players || [];
    if (!ps.length) return 0;
    return ps.reduce((s, p) => s + (p.ovr || 70), 0) / ps.length;
  }

  function filterTeams(type) {
    teamsFilter = type || 'all';
    renderTeamsList();
  }

  // Debounced — the full team pool can run into the hundreds once every
  // league/competition is loaded, and renderTeamsList() does a full
  // innerHTML rebuild, so filtering + re-rendering on every single
  // keystroke was a real source of typing lag on this page.
  const _debouncedRenderTeamsList = debounce(renderTeamsList, 150);
  function searchTeams(q) {
    teamsSearch = (q || '').trim().toLowerCase();
    _debouncedRenderTeamsList();
  }

  function sortTeams(mode) {
    teamsSort = mode || 'name';
    renderTeamsList();
  }

  function getFilteredTeamsList() {
    let list = allTeams;
    if (teamsFilter === 'national') list = teamsData.national || [];
    if (teamsFilter === 'club') list = teamsData.club || [];
    if (teamsSearch) {
      list = list.filter(t =>
        (t.name || '').toLowerCase().includes(teamsSearch) ||
        (t.short || '').toLowerCase().includes(teamsSearch) ||
        ((t.manager && t.manager.name) || '').toLowerCase().includes(teamsSearch)
      );
    }
    list = [...list];
    if (teamsSort === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else if (teamsSort === 'ovr') list.sort((a, b) => teamAvgOvr(b) - teamAvgOvr(a));
    else if (teamsSort === 'players') list.sort((a, b) => (b.players || []).length - (a.players || []).length);
    else if (teamsSort === 'flag') list.sort((a, b) => (a.flag || '').localeCompare(b.flag || '') || (a.name || '').localeCompare(b.name || ''));
    return list;
  }

  function renderTeamsList() {
    const list = getFilteredTeamsList();
    const el = document.getElementById('teams-list');
    if (!el) return;
    if (!list.length) {
      el.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><p>No teams match your search.</p></div>';
      return;
    }
    el.innerHTML = list.map(t => {
      const ovr = teamAvgOvr(t).toFixed(0);
      const primary = t.color || '#d4af37';
      const formKey = pickTeamFormation(t);
      const formName = (FORMATIONS[formKey] && FORMATIONS[formKey].name) || formKey;
      return `<div class="team-check" style="cursor:pointer;border-left:3px solid ${primary}" onclick="App.showTeamProfile('${t.id}')">
        <div style="display:flex;align-items:center;gap:8px;width:100%">
          <span style="font-size:1.5rem">${teamMark(t, 32)}</span>
          <div style="flex:1;min-width:0">
            <strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name}</strong>
            <div style="font-size:0.75rem;color:var(--text-2)">${(t.players || []).length} players · ${t.short || ''} · ${formName}</div>
            <div style="font-size:0.7rem;color:var(--gold);display:flex;align-items:center;gap:4px">${t.manager && t.manager.name ? managerAvatarMark(t.manager, 16) : ''}${(t.manager && t.manager.name) || ''} · ${getManagerPlaystyle(t)}</div>
          </div>
          <button type="button" class="lineup-btn" title="View lineup" aria-label="View ${t.name} lineup" onclick="event.stopPropagation();App.showTeamLineup('${t.id}')">🧩</button>
          <span class="player-ovr">${ovr}</span>
        </div>
      </div>`;
    }).join('');
  }

  // ========== TEAM LINEUP VIEWER (Teams tab) ==========
  // Shows a team's best XI laid out on the same pitch visual used for live
  // matches (.mini-pitch/.team-pitch + .player-dot markers), without
  // needing an actual match in progress. Builds a fresh best-XI via
  // buildSquad() using the team's own preferred formation (pickTeamFormation)
  // so the shape and starters match what a match kickoff would auto-select.
  function renderTeamLineupPitchHTML(team) {
    const formKey = pickTeamFormation(team);
    const form = FORMATIONS[formKey] || FORMATIONS['4-3-3'];
    const squad = buildSquad(team, formKey);
    const coords = form.coords || [];
    const slots = form.slots || [];
    const primary = team.color || '#1a237e';
    const secondary = team.secondary || '#ffffff';

    // Line players up against their own slot (buildSquad already assigns
    // squad.starting[i].slot === form.slots[i] in the common case), falling
    // back to array order if a slot's own player is somehow missing.
    const usedIds = new Set();
    const slotPlayers = slots.map((slot, i) => {
      // Prefer the player buildSquad() already lined up for this exact
      // slot index (the common case). Only fall back to searching by slot
      // *code* when that's missing, and always skip anyone already placed
      // in an earlier slot — otherwise two players sharing a slot code
      // (e.g. two "CB"s) both resolve to the same first match, so that
      // player gets drawn twice while the other one never appears.
      let p = null;
      if (squad.starting[i] && squad.starting[i].slot === slot && !usedIds.has(squad.starting[i].id)) {
        p = squad.starting[i];
      }
      if (!p) {
        p = squad.starting.find(pl => pl.slot === slot && !usedIds.has(pl.id)) || null;
      }
      if (!p) {
        p = squad.starting.find(pl => !usedIds.has(pl.id)) || null;
      }
      if (p) usedIds.add(p.id);
      return p;
    });

    const used = [];
    let dots = '';
    slotPlayers.forEach((p, idx) => {
      if (!p) return;
      const c = coords[idx] || [50, 50];
      let x = c[0], y = c[1];
      if (idx !== 0) {
        for (let t = 0; t < 8; t++) {
          const hit = used.find(u => Math.hypot((u.x - x) * 1.5, u.y - y) < 16);
          if (!hit) break;
          const dir = (x - 50) >= 0 ? 1 : -1;
          x += dir * 4;
          x = Math.max(8, Math.min(92, x));
        }
        used.push({ x, y });
      }
      dots += `<div class="player-dot" style="left:${x}%;top:${y}%;background:${primary};border:2px solid ${secondary}">
        <span class="dot-pos">${slots[idx] || ''}</span>
        <span class="dot-avatar">${playerAvatarMark(p)}</span>
        <span class="dot-label"><span class="dot-num">${p.num || ''}</span><span class="dot-name">${playerNameHTML(p, abbreviateName(p.name))}</span></span>
      </div>`;
    });

    const mgrStyle = getManagerPlaystyle(team);
    const mgrDot = team.manager && team.manager.name
      ? `<div class="player-dot manager-dot" style="left:9%;top:11%">
        <span class="dot-avatar">${managerAvatarMark(team.manager, 46)}</span>
        <span class="dot-label"><span class="dot-name">${team.manager.name}${mgrStyle ? ' · ' + mgrStyle : ''}</span></span>
      </div>` : '';
    return `<div class="mini-pitch team-pitch">
      <div class="pitch-label">${teamMark(team, 16)} ${team.short || team.name} · ${form.name}</div>
      ${dots}
      ${mgrDot}
    </div>`;
  }

  function showTeamLineup(teamId) {
    const team = getTeam(teamId);
    if (!team) { toast('Team not found'); return; }
    const modal = document.getElementById('lineup-modal');
    const content = document.getElementById('lineup-modal-content');
    if (!modal || !content) return;
    content.innerHTML = `
      <div class="card-title" style="display:flex;align-items:center;gap:8px">${teamMark(team, 22)} ${team.name} — Lineup</div>
      <div class="pitch-wrap">${renderTeamLineupPitchHTML(team)}</div>
    `;
    modal.classList.add('active');
  }

  // Debounced: the club pool can run to a few hundred teams (all five
  // domestic leagues' worth once selected), and renderTournamentTeamSelect()
  // does a full innerHTML rebuild plus re-attaches two listeners per team —
  // doing that on every single keystroke was the main source of typing lag
  // in the tournament team search. Waiting a beat after typing stops keeps
  // the search feeling instant without re-rendering on every keypress.
  let _tourSearchDebounceTimer = null;
  function searchTournamentTeams(q) {
    const value = (q || '').trim().toLowerCase();
    clearTimeout(_tourSearchDebounceTimer);
    _tourSearchDebounceTimer = setTimeout(() => {
      tourTeamsSearch = value;
      renderTournamentTeamSelect();
    }, 160);
  }


  function showLoading(msg) {
    let el = document.getElementById('loading-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'loading-overlay';
      el.innerHTML = '<div class="loading-box"><div class="loading-spinner"></div><div class="loading-text" id="loading-text">Simulating…</div>'
        + '<div class="loading-progress-track" id="loading-progress-track" style="display:none"><div class="loading-progress-fill" id="loading-progress-fill" style="width:0%"></div></div>'
        + '<div class="loading-sub" id="loading-sub">Please wait</div></div>';
      document.body.appendChild(el);
    }
    const t = document.getElementById('loading-text');
    const s = document.getElementById('loading-sub');
    const track = document.getElementById('loading-progress-track');
    const fill = document.getElementById('loading-progress-fill');
    if (t) t.textContent = msg || 'Simulating…';
    if (s) s.textContent = 'Please wait — do not close the page';
    // Reset any progress bar from a previous run until updateLoadingProgress()
    // is explicitly called again (plain single-shot sims never call it, so
    // they correctly stay a bare spinner with no bar).
    if (track) track.style.display = 'none';
    if (fill) fill.style.width = '0%';
    el.classList.add('show');
  }

  function hideLoading() {
    const el = document.getElementById('loading-overlay');
    if (el) el.classList.remove('show');
  }

  // Formats a millisecond duration as a short "Xm Ys" / "Xs" string for the
  // progress bar's estimated-time-remaining label.
  function formatEtaDuration(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    if (totalSec < 1) return '<1s';
    if (totalSec < 60) return totalSec + 's';
    const m = Math.floor(totalSec / 60), s = totalSec % 60;
    return m + 'm ' + (s ? s + 's' : '');
  }

  // Updates the loading overlay's progress bar (fill width + ETA label)
  // given how many of `total` work units are done and when the whole
  // operation started. `startTime` should be a Date.now() timestamp taken
  // right before the first unit was simulated — the ETA is extrapolated
  // from the average time-per-unit seen so far, so it gets more accurate
  // as the simulation progresses. Shows/reveals the bar on first call so
  // plain single-shot sims (which never call this) keep the old bare
  // spinner look.
  function updateLoadingProgress(done, total, startTime) {
    const track = document.getElementById('loading-progress-track');
    const fill = document.getElementById('loading-progress-fill');
    const s = document.getElementById('loading-sub');
    if (!track || !fill) return;
    track.style.display = 'block';
    const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 0;
    fill.style.width = pct + '%';
    if (s) {
      if (done >= total) {
        s.textContent = 'Finishing up…';
      } else {
        const elapsed = Date.now() - startTime;
        const perUnit = done > 0 ? elapsed / done : 0;
        const etaMs = perUnit * Math.max(0, total - done);
        s.textContent = `${pct}% · ${done}/${total} · ~${formatEtaDuration(etaMs)} remaining`;
      }
    }
  }

  // A zero-work "tick" that yields control back to the browser for one
  // frame so a progress bar update actually gets painted before the next
  // chunk of (synchronous) simulation work runs. Used between individual
  // match simulations in bulk sim loops (simAllTournament, Simulate To End
  // of Season) — see their async loops in tournamentEngine.js / seasonEngine.js.
  function simTick() {
    return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  }
  function withLoading(msg, fn) {
    showLoading(msg || 'Simulating…');
    // Double rAF so the overlay is painted before heavy sync work
    return new Promise(function(resolve) {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          setTimeout(function() {
            let result;
            try {
              result = fn();
            } catch (e) {
              console.error(e);
              toast('Error: ' + (e && e.message ? e.message : e));
            } finally {
              hideLoading();
              persistAll();
            }
            resolve(result);
          }, 50);
        });
      });
    });
  }
  // Async counterpart to withLoading() for bulk sims that need to show real
  // incremental progress (Simulate All / Simulate To End of Season) instead
  // of a single blocking spinner. `asyncFn` is an async function that does
  // its own repeated updateLoadingProgress()+await simTick() calls between
  // chunks of work — this wrapper just handles showing/hiding the overlay
  // and the same error/persist handling as withLoading().
  async function withLoadingProgress(msg, asyncFn) {
    showLoading(msg || 'Simulating…');
    await simTick();
    await simTick();
    let result;
    try {
      result = await asyncFn();
    } catch (e) {
      console.error(e);
      toast('Error: ' + (e && e.message ? e.message : e));
    } finally {
      hideLoading();
      persistAll();
    }
    return result;
  }

  function toast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  
  function renderPostMatchRatings() {
    if (!currentMatch || !currentMatch.playerMatchStats) return;
    if (currentMatch.quietSim) return;
    const el = document.getElementById('post-match-ratings');
    if (!el) return;
    const m = currentMatch;
    const entries = Object.values(m.playerMatchStats).sort((a,b) => b.rating - a.rating);
    let h = '<div class="card-title">Post-Match Ratings (' + entries.length + ' players)</div>';
    // Group by team
    const homeIds = new Set((m.home.squad.all||[]).map(p=>p.id));
    const homeP = entries.filter(p => homeIds.has(p.id));
    const awayP = entries.filter(p => !homeIds.has(p.id));
    h += `<div style="font-size:0.8rem;color:var(--accent-gold);margin:8px 0 4px">${m.home.team.flag||''} ${m.home.team.name}</div>`;
    h += homeP.map(p => renderRatingRow(p, m.motmId)).join('') || '<div style="color:var(--text-muted);font-size:0.85rem">No data</div>';
    h += `<div style="font-size:0.8rem;color:var(--accent-gold);margin:12px 0 4px">${m.away.team.flag||''} ${m.away.team.name}</div>`;
    h += awayP.map(p => renderRatingRow(p, m.motmId)).join('') || '<div style="color:var(--text-muted);font-size:0.85rem">No data</div>';
    el.innerHTML = h;
    el.style.display = 'block';
  }

  function returnToTournament() {
    const backBtn = document.getElementById('back-to-tournament');
    if (backBtn) { backBtn.style.display = 'none'; backBtn.classList.remove('show'); }
    window._fromTournament = false;
    const target = window._backTarget === 'season' ? 'season' : 'tournament';
    window._backTarget = null;
    if (target === 'season') {
      switchView('season');
      try { renderSeasonDashboard(); } catch (e) {}
      toast('Back to season — results updated');
      return;
    }
    switchView('tournament');
    if (tournament) {
      try { refreshTournamentStatsUI(); } catch (e) {}
      try { renderGroups(); } catch (e) {}
      try { renderBracket(); } catch (e) {}
      try { if (typeof renderUCLTable === 'function') renderUCLTable(); } catch (e) {}
      try { renderTournamentAwards(); } catch (e) {}
    }
    toast('Back to tournament — results updated');
  }


  // Trophy Cabinet: every individual award a player (matched by exact name,
  // same convention as playerPortraits/trophyImages) has won, newest first.
  function playerTrophyCabinetHTML(playerName) {
    const won = trophies.filter(t => t.player === playerName).sort((a, b) => (b.date || 0) - (a.date || 0));
    if (!won.length) return '';
    return `<div class="card-title" style="margin-top:14px">🏆 Trophy Cabinet</div>
      <div class="trophy-cabinet-grid">
        ${won.map(t => `<div class="trophy-cabinet-item" title="${t.type || ''}">${trophyMark(t.name, 56)}<div class="tc-name">${t.name}</div><div class="tc-type">${t.type || ''}</div></div>`).join('')}
      </div>`;
  }

  // Renders the full expanded attribute sheet (grouped, individual raw
  // ratings) for a player whose stats come from player-attributes.json —
  // shown instead of the generic merged ATT/DEF/PHY/PAC/TEC bars, since a
  // player with a detailed sheet should have their actual detailed sheet
  // visible, not just the 5-stat blend it was compressed into. A rating
  // that was lifted by the manager's tactic affinity is marked so it's
  // clear the boost reached the individual attribute, not just the OVR.

  // Bio strip for an enhanced player's profile — age, height, preferred
  // foot, weak foot rating, injury resilience, and their skill-card list.
  // All of it comes straight off the expanded attribute sheet
  // (player-attributes.json), so this only ever gets called for a boosted
  // player — see showPlayerProfile()'s bioHTML.
  function renderPlayerBioHTML(attr) {
    const facts = [];
    if (typeof attr.age === 'number') facts.push(['Age', attr.age]);
    if (typeof attr.height_cm === 'number') facts.push(['Height', Math.round(attr.height_cm) + ' cm']);
    if (attr.preferred_foot) facts.push(['Foot', attr.preferred_foot]);
    if (typeof attr['weak foot'] === 'number') facts.push(['Weak Foot', attr['weak foot'] + '★']);
    if (attr.injury_res) facts.push(['Injury Res.', attr.injury_res]);
    const factsHTML = facts.length
      ? `<div class="profile-stats-grid">${facts.map(([lbl, val]) => `<div class="profile-stat"><div class="val">${val}</div><div class="lbl">${lbl}</div></div>`).join('')}</div>`
      : '';
    const skillsHTML = (attr.skills || []).length
      ? `<div class="card-title" style="margin-top:10px">Skills</div>
         <div>${attr.skills.map(sk => `<span class="playstyle-tag">${sk}</span>`).join('')}</div>`
      : '';
    if (!factsHTML && !skillsHTML) return '';
    return `<div class="card-title" style="margin-top:8px">Bio</div>${factsHTML}${skillsHTML}`;
  }

  // Color tier for any 0-100(+) stat/attribute bar: red under 70, orange
  // 70-79, green 80-89, mint 90+. Used everywhere a raw attribute or the
  // compact ATT/DEF/PHY/PAC/TEC bars are rendered, so the same number
  // always reads the same color regardless of which view it's shown in.
  function statTierClass(v) {
    const n = Number(v);
    if (!isFinite(n)) return 'stat-tier-red';
    if (n >= 90) return 'stat-tier-mint';
    if (n >= 80) return 'stat-tier-green';
    if (n >= 70) return 'stat-tier-orange';
    return 'stat-tier-red';
  }
  function expandedAttrRowsHTML(player) {
    const attr = player.expandedAttrs || {};
    return EXPANDED_ATTR_GROUPS.map((group) => {
      const rows = group.keys.filter(([k]) => typeof attr[k] === 'number');
      if (!rows.length) return '';
      return `<div class="expanded-attr-group">
        <div class="expanded-attr-group-title">${group.label}</div>
        ${rows.map(([k, label]) => `
          <div class="attr-bar-row expanded">
            <span class="attr-name">${label}</span>
            <div class="attr-track"><div class="attr-fill ${statTierClass(attr[k])}" style="width:${Math.min(100, attr[k])}%"></div></div>
            <span class="attr-val ${statTierClass(attr[k])}">${attr[k]}</span>
          </div>`).join('')}
      </div>`;
    }).join('');
  }

  function showPlayerProfile(playerId) {
    let player = null, team = null;
    const found = findPlayerAndTeam(playerId);
    if (found) { player = found.player; team = found.team; }
    // Fallback from current match stats object
    if (!player && currentMatch && currentMatch.playerMatchStats && currentMatch.playerMatchStats[playerId]) {
      const ms = currentMatch.playerMatchStats[playerId];
      player = { id: playerId, name: ms.name, num: ms.num, pos: [ms.pos], ovr: ms.ovr, att: 70, def: 70, phy: 70, pac: 70, tec: 70 };
      team = (currentMatch.home.squad.all || []).find(p => p.id === playerId) ? currentMatch.home.team
        : ((currentMatch.away.squad.all || []).find(p => p.id === playerId) ? currentMatch.away.team : { name: '—', flag: '', color: '#d4af37', secondary: '#fff' });
    }
    if (!player) { toast('Player not found'); return; }
    const g = (stats.goals[playerId] || {}).count || 0;
    const a = (stats.assists[playerId] || {}).count || 0;
    const s = (stats.saves[playerId] || {}).count || 0;
    const motm = (stats.motm[playerId] || {}).count || 0;
    const y = (stats.yellows[playerId] || {}).count || 0;
    const rd = (stats.reds[playerId] || {}).count || 0;
    const apps = (stats.ratings[playerId] || {}).count || 0;
    const primary = (team && team.color) || '#d4af37';
    const secondary = (team && team.secondary) || '#fff';
    const ms = (currentMatch && currentMatch.playerMatchStats && currentMatch.playerMatchStats[playerId]) || null;
    const modal = document.getElementById('player-modal');
    const content = document.getElementById('player-modal-content');
    if (!modal || !content) return;
    let matchBlock = '';
    if (ms) {
      const rc = (ms.rating || 0) >= 7.5 ? 'rating-high' : (ms.rating || 0) >= 6.5 ? 'rating-mid' : 'rating-low';
      matchBlock = `
        <div class="card-title" style="margin-top:8px">This Match</div>
        <div class="profile-stats-grid">
          <div class="profile-stat"><div class="val">${ms.goals || 0}</div><div class="lbl">Goals</div></div>
          <div class="profile-stat"><div class="val">${ms.assists || 0}</div><div class="lbl">Assists</div></div>
          <div class="profile-stat"><div class="val">${ms.shots || 0}</div><div class="lbl">Shots</div></div>
          <div class="profile-stat"><div class="val">${ms.saves || 0}</div><div class="lbl">Saves</div></div>
          <div class="profile-stat"><div class="val">${ms.tackles || 0}</div><div class="lbl">Tackles</div></div>
          <div class="profile-stat"><div class="val">${ms.passes || 0}</div><div class="lbl">Passes</div></div>
          <div class="profile-stat"><div class="val">${ms.passesCompleted || 0}</div><div class="lbl">Completed</div></div>
          <div class="profile-stat"><div class="val">${ms.passes ? Math.round(100 * (ms.passesCompleted || 0) / ms.passes) + '%' : '—'}</div><div class="lbl">Pass Acc.</div></div>
          <div class="profile-stat"><div class="val">${ms.interceptions || 0}</div><div class="lbl">Interceptions</div></div>
          <div class="profile-stat"><div class="val">${ms.blocks || 0}</div><div class="lbl">Blocks</div></div>
          <div class="profile-stat"><div class="val">${(ms.xg || 0).toFixed(2)}</div><div class="lbl">xG</div></div>
          <div class="profile-stat"><div class="val">${(ms.xa || 0).toFixed(2)}</div><div class="lbl">xA</div></div>
          <div class="profile-stat"><div class="val"><span class="rating-badge ${rc}">${(ms.rating || 0).toFixed(1)}</span></div><div class="lbl">Rating</div></div>
          <div class="profile-stat"><div class="val">${ms.yellow ? 'Y' : '—'} ${ms.red ? 'R' : ''}</div><div class="lbl">Cards</div></div>
        </div>`;
    }
    const boosted = !!player.attrBoosted;
    const boostBadge = boosted
      ? `<span class="attr-boost-badge" title="Overall derived from expanded attribute data and position">★ Enhanced</span>`
      : '';
    const signatureNote = (boosted && player.signatureBonus > 0)
      ? `<div style="color:var(--text-2);font-size:0.75rem;margin-top:2px">+${player.signatureBonus} OVR — signature attributes for their playstyle run well above the rest of their sheet</div>`
      : '';
    const playstyleTagsHTML = (boosted && player.expandedAttrs && (player.expandedAttrs.playstyle || []).length)
      ? `<div style="margin-top:6px">${player.expandedAttrs.playstyle.map(s => {
          const desc = PLAYSTYLE_DESCRIPTIONS[s] || '';
          return `<span class="playstyle-tag" title="${desc}">${s}</span>`;
        }).join('')}</div>`
      : '';
    // Bio block: age/height/foot only exist on the expanded attribute sheet
    // (player-attributes.json), so this whole section is naturally absent
    // for a regular, non-enhanced player rather than showing empty fields.
    const bioHTML = (boosted && player.expandedAttrs) ? renderPlayerBioHTML(player.expandedAttrs) : '';
    // Currently-injured banner — full detail lives on the Hospital tab, but
    // a quick pointer here means a coach checking a specific player's
    // profile doesn't have to go hunting for it separately.
    const injRec = (typeof isPlayerInjured === 'function' && isPlayerInjured(playerId)) ? injuryBook[playerId] : null;
    const injuryHTML = injRec ? `
      <div class="hospital-inline-banner">
        🩹 <strong>${injRec.type || 'Injured'}</strong>${injRec.bodyPart ? ' (' + injRec.bodyPart + ')' : ''} — out for ${injRec.matchesLeft} more match${injRec.matchesLeft > 1 ? 'es' : ''}${injRec.cause ? `<div style="color:var(--text-2);font-size:0.78rem;margin-top:2px">${injRec.cause}${injRec.opponent ? ' vs ' + injRec.opponent : ''}</div>` : ''}
      </div>` : '';
    content.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar" style="background:${primary};border:3px solid ${secondary};color:${secondary}">${playerAvatarMark(player)}</div>
        <div>
          <h2 style="margin:0 0 4px;font-size:1.2rem">${playerNameHTML(player)}</h2>
          <div style="color:var(--text-2);font-size:0.85rem">${(function () {
            const aff = getPlayerAffiliations(player.id);
            if (aff.club && aff.national) {
              return `${teamMark(aff.club, 18)} ${aff.club.name} · ${teamMark(aff.national, 18)} ${aff.national.name}`;
            }
            return `${team ? teamMark(team, 18) : ''} ${(team && team.name) || ''}`;
          })()} · ${(player.pos||[])[0] || ''}</div>
          <div style="color:var(--gold);font-weight:700;margin-top:4px">OVR ${player.ovr || '—'} ${formArrow(player)} <span style="color:var(--text-2);font-weight:400;font-size:0.78rem">${formLabel(player)}</span>${boostBadge}</div>
          ${signatureNote}
          ${playstyleTagsHTML}
        </div>
      </div>
      ${injuryHTML}
      ${matchBlock}
      ${bioHTML}
      <div class="card-title">Career (competitive)</div>
      <div class="profile-stats-grid">
        <div class="profile-stat"><div class="val">${apps}</div><div class="lbl">Apps</div></div>
        <div class="profile-stat"><div class="val">${g}</div><div class="lbl">Goals</div></div>
        <div class="profile-stat"><div class="val">${a}</div><div class="lbl">Assists</div></div>
        <div class="profile-stat"><div class="val">${motm}</div><div class="lbl">MOTM</div></div>
        <div class="profile-stat"><div class="val">${s}</div><div class="lbl">Saves</div></div>
        <div class="profile-stat"><div class="val">${y}</div><div class="lbl">Yellows</div></div>
        <div class="profile-stat"><div class="val">${rd}</div><div class="lbl">Reds</div></div>
      </div>
      ${renderPlayerRatingFormChartHTML(player.id)}
      ${renderPlayerMatchLogHTML(player.id)}
      <div style="margin-top:8px">
        ${boosted && player.expandedAttrs
          ? expandedAttrRowsHTML(player)
          : [['ATT',player.att],['DEF',player.def],['PHY',player.phy],['PAC',player.pac],['TEC',player.tec]].map(([n,v]) => `
              <div class="attr-bar-row"><span class="attr-name">${n}</span>
                <div class="attr-track"><div class="attr-fill ${statTierClass(v)}" style="width:${Math.min(100, v||50)}%"></div></div>
                <span class="attr-val ${statTierClass(v)}">${v||'-'}</span></div>`).join('')}
      </div>
      ${playerTrophyCabinetHTML(player.name)}      <div class="modal-actions"><button class="btn btn-secondary" onclick="document.getElementById('player-modal').classList.remove('active')">Close</button></div>`;
    modal.classList.add('active');
    // Canvas needs real layout dimensions (clientWidth) to size itself —
    // wait a frame after the modal's just been made visible/laid out.
    requestAnimationFrame(() => drawPlayerRatingFormChart(player.id));
  }


  function showTeamProfile(teamId) {
    const team = getTeam(teamId);
    if (!team) { toast('Team not found'); return; }
    const primary = team.color || '#d4af37';
    const secondary = team.secondary || '#fff';
    const mgr = team.manager || {};
    const mgrStyle = getManagerPlaystyle(team);
    const mgrAwardCount = mgr.name ? trophies.filter(t => t.manager === mgr.name).length : 0;
    const players = [...(team.players || [])].sort((a,b) => (b.ovr||0)-(a.ovr||0));
    const avg = players.length ? (players.reduce((s,p) => s + (p.ovr||70), 0) / players.length).toFixed(1) : '—';
    const formKey = pickTeamFormation(team);
    const formation = (FORMATIONS[formKey] && FORMATIONS[formKey].name) || formKey;
    const modal = document.getElementById('team-modal');
    const content = document.getElementById('team-modal-content');
    if (!modal || !content) return;
    content.innerHTML = `
      <div class="profile-header" style="border-bottom:2px solid ${primary};padding-bottom:14px">
        <div class="profile-avatar profile-avatar-logo" style="color:${secondary};font-size:1.6rem">${teamAvatarMark(team)}</div>
        <div style="flex:1;min-width:0">
          <h2 style="margin:0 0 4px;font-size:1.25rem">${team.name}</h2>
          <div style="color:var(--text-2);font-size:0.85rem">${team.short || ''} · ${players.length} players · Avg OVR ${avg}</div>
          <div style="color:var(--text-2);font-size:0.8rem;margin-top:2px">🏟️ ${getStadium(team)}</div>
          <div style="color:var(--gold);font-size:0.8rem;margin-top:2px;font-weight:700">🧩 ${formation}</div>
        </div>
      </div>
      <div class="card-title" style="margin-top:14px">Manager</div>
      <div class="manager-profile-row">
        ${managerAvatarMark(mgr, 56)}
        <div style="flex:1;min-width:0">
          <div style="font-weight:700">${mgr.name || '—'}</div>
          <div style="color:var(--text-2);font-size:0.8rem">${mgr.ovr ? mgr.ovr + ' OVR · ' : ''}<span class="playstyle-tag">${mgrStyle}</span></div>
          <div style="color:var(--gold);font-size:0.78rem;margin-top:2px">🏅 ${mgrAwardCount} manager award${mgrAwardCount === 1 ? '' : 's'}</div>
        </div>
      </div>
      <div class="card-title" style="margin-top:14px">Squad <span style="color:var(--text-muted);font-weight:400;font-size:0.78rem">(🏆 = trophy cabinet)</span></div>
      <div class="team-squad-list">
        ${players.map(p => {
          const wonCount = trophies.filter(t => t.player === p.name).length;
          return `
          <button type="button" class="team-squad-row" onclick="App.showPlayerProfile('${p.id}')">
            <span class="tsr-avatar">${playerAvatarMark(p)}</span>
            <span class="tsr-name">${playerNameHTML(p)}${wonCount ? ` <span class="tsr-trophy-badge" title="${wonCount} award${wonCount===1?'':'s'} won">🏆${wonCount > 1 ? '×' + wonCount : ''}</span>` : ''}</span>
            <span class="tsr-pos">${(p.pos||[])[0] || ''}</span>
            ${formArrow(p)}
            <span class="player-ovr">${p.ovr || ''}</span>
          </button>`;
        }).join('')}
      </div>
      ${renderTeamMatchLogHTML(team.id)}
      <div class="modal-actions"><button class="btn btn-secondary" onclick="document.getElementById('team-modal').classList.remove('active')">Close</button></div>`;
    modal.classList.add('active');
  }


  function showAwards(type) {
    document.querySelectorAll('.award-tab').forEach(t => t.classList.toggle('active', t.dataset.award === type));
    const el = document.getElementById('awards-content');
    if (!el) return;
    if (type === 'goldenboot') {
      const data = Object.values(stats.goals || {}).sort((a,b) => b.count - a.count).slice(0, 50);
      if (!data.length) { el.innerHTML = '<div class="empty-state"><div class="icon">' + emojiImg('goal', 'Goal') + '</div><p>No goals yet.</p></div>'; return; }
      el.innerHTML = '<div class="award-card">' + lbAvatar(data[0], 64) + '<div class="award-info"><h4>' + trophyMark('Golden Boot', 34) + ' Golden Boot</h4><p class="award-winner">' + data[0].name + ' (' + data[0].team + ') — ' + data[0].count + ' goals</p></div></div>' +
        '<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Apps</th><th>Goals</th></tr></thead><tbody>' +
        data.map((p,i) => '<tr class="'+(i<3?'lb-row-top rank-'+(i+1):'')+'"><td class="lb-rank">'+rankBadge(i)+'</td><td class="lb-player">'+lbPlayerCell(p)+'</td><td class="lb-team">'+p.team+'</td><td>'+((stats.ratings&&stats.ratings[p.id])?stats.ratings[p.id].count:0)+'</td><td style="font-weight:700;color:var(--accent-gold)">'+p.count+'</td></tr>').join('') +
        '</tbody></table></div>';
    } else if (type === 'ballon') {
      // Ballon d'Or: need meaningful sample size — min 3 competitive appearances
      const MIN_APPS = BALLON_MIN_APPS;
      const data = computeBallonRanking(stats);
      if (!data.length) {
        el.innerHTML = '<div class="empty-state"><div class="icon">🥇</div><p>Need players with at least ' + MIN_APPS + ' competitive appearances (or strong goal/assist tallies) for Ballon d\'Or.</p></div>';
        return;
      }
      const leader = data[0];
      el.innerHTML = '<div class="award-card">' + lbAvatar(leader, 64) + '<div class="award-info"><h4>' + trophyMark("Ballon d'Or", 34) + ' Ballon d\'Or</h4><p class="award-winner">' + leader.name + '</p><p style="color:var(--text-2);font-size:0.85rem">' + leader.team + ' · ' + leader.goals + 'G ' + leader.assists + 'A · ' + leader.motm + ' MOTM · ' + leader.apps + ' apps' + (leader.avg ? ' · Avg ' + leader.avg.toFixed(2) : '') + (leader.noms >= 2 ? ' · ' + leader.noms + ' award-show nods' : '') + '</p><p style="color:var(--gold);font-weight:700;margin-top:4px">' + Math.round(leader.pts) + ' Ballon points</p><p style="font-size:0.72rem;color:var(--text-3);margin-top:6px">Min ' + MIN_APPS + ' appearances required for rating weight</p></div></div>' +
        '<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Apps</th><th>G</th><th>A</th><th>Avg</th><th>Noms</th><th>Pts</th></tr></thead><tbody>' +
        data.map((p,i) => '<tr class="'+(i<3?'lb-row-top rank-'+(i+1):'')+'"><td class="lb-rank">'+rankBadge(i)+'</td><td class="lb-player">'+lbPlayerCell(p)+'</td><td class="lb-team">'+p.team+'</td><td>'+p.apps+'</td><td>'+p.goals+'</td><td>'+p.assists+'</td><td>'+(p.avg?p.avg.toFixed(2):'—')+'</td><td>'+(p.noms||0)+'</td><td style="font-weight:700;color:var(--gold)">'+Math.round(p.pts)+'</td></tr>').join('') +
        '</tbody></table></div>';
    } else if (type === 'puskas') {
      // Puskás Award — best/most spectacular individual goal, tallied by nominee count
      const data = Object.values(stats.puskas || {}).sort((a,b) => b.count - a.count).slice(0, 30);
      if (!data.length) { el.innerHTML = '<div class="empty-state"><div class="icon">🎬</div><p>No standout goals nominated yet.</p></div>'; return; }
      el.innerHTML = '<div class="award-card">' + lbAvatar(data[0], 64) + '<div class="award-info"><h4>' + trophyMark('Puskás Award', 34) + ' Puskás Award</h4><p class="award-winner">' + data[0].name + '</p><p style="color:var(--text-2);font-size:0.85rem">' + data[0].team + ' · ' + data[0].count + ' nominated goal' + (data[0].count === 1 ? '' : 's') + '</p></div></div>' +
        '<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Apps</th><th>Nominated Goals</th></tr></thead><tbody>' +
        data.map((p,i) => '<tr class="'+(i<3?'lb-row-top rank-'+(i+1):'')+'"><td class="lb-rank">'+rankBadge(i)+'</td><td class="lb-player">'+lbPlayerCell(p)+'</td><td class="lb-team">'+p.team+'</td><td>'+((stats.ratings&&stats.ratings[p.id])?stats.ratings[p.id].count:0)+'</td><td style="font-weight:700;color:var(--accent-gold)">'+p.count+'</td></tr>').join('') +
        '</tbody></table></div>';
    } else if (type === 'muller') {
      // Gerd Müller Award — best pure striker: goals heavily weighted, ST/CF preference
      const scores = {};
      Object.values(stats.goals || {}).forEach(p => {
        scores[p.id] = { id: p.id, name: p.name, team: p.team, goals: p.count, assists: 0, pts: p.count * 5 };
      });
      Object.values(stats.assists || {}).forEach(p => {
        if (!scores[p.id]) scores[p.id] = { id: p.id, name: p.name, team: p.team, goals: 0, assists: 0, pts: 0 };
        scores[p.id].assists = p.count;
        scores[p.id].pts += p.count * 0.8;
      });
      // Bonus if player is a striker on roster
      Object.values(scores).forEach(s => {
        let isST = false;
        for (const t of allTeams) {
          const pl = (t.players || []).find(x => x.id === s.id);
          if (pl && (pl.pos || []).some(pos => ['ST','CF','FW'].includes(pos))) { isST = true; break; }
        }
        if (isST) s.pts += 2;
      });
      const data = Object.values(scores).filter(p => p.goals > 0).sort((a,b) => b.pts - a.pts || b.goals - a.goals).slice(0, 50);
      if (!data.length) { el.innerHTML = '<div class="empty-state"><div class="icon">🎯</div><p>No strikers on the scoresheet yet.</p></div>'; return; }
      el.innerHTML = '<div class="award-card">' + lbAvatar(data[0], 64) + '<div class="award-info"><h4>' + trophyMark('Gerd Müller Award', 34) + ' Gerd Müller Award</h4><p class="award-winner">' + data[0].name + '</p><p style="color:var(--text-2);font-size:0.85rem">Best striker · ' + data[0].goals + ' goals · ' + data[0].team + '</p></div></div>' +
        '<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Apps</th><th>Goals</th><th>Pts</th></tr></thead><tbody>' +
        data.map((p,i) => '<tr class="'+(i<3?'lb-row-top rank-'+(i+1):'')+'"><td class="lb-rank">'+rankBadge(i)+'</td><td class="lb-player">'+lbPlayerCell(p)+'</td><td class="lb-team">'+p.team+'</td><td>'+((stats.ratings&&stats.ratings[p.id])?stats.ratings[p.id].count:0)+'</td><td>'+p.goals+'</td><td style="font-weight:700;color:var(--gold)">'+Math.round(p.pts)+'</td></tr>').join('') +
        '</tbody></table></div>';
    } else if (type === 'yashin') {
      // Yashin Award — best goalkeeper: saves + clean sheets
      const scores = {};
      Object.values(stats.saves || {}).forEach(p => {
        scores[p.id] = { id: p.id, name: p.name, team: p.team, saves: p.count, clean: 0, pts: p.count * 1.2 };
      });
      Object.values(stats.cleanSheets || {}).forEach(p => {
        if (!scores[p.id]) scores[p.id] = { id: p.id, name: p.name, team: p.team, saves: 0, clean: 0, pts: 0 };
        scores[p.id].clean = p.count;
        scores[p.id].pts += p.count * 4;
      });
      Object.values(stats.motm || {}).forEach(p => {
        if (scores[p.id]) scores[p.id].pts += p.count * 3;
      });
      Object.values(stats.ratings || {}).forEach(p => {
        if (scores[p.id]) scores[p.id].pts += (p.avg || 0) * Math.min(p.count, 10) * 0.3;
      });
      const data = Object.values(scores).filter(p => p.saves > 0 || p.clean > 0).sort((a,b) => b.pts - a.pts).slice(0, 50);
      if (!data.length) { el.innerHTML = '<div class="empty-state"><div class="icon">🧤</div><p>No goalkeeper stats yet.</p></div>'; return; }
      el.innerHTML = '<div class="award-card">' + lbAvatar(data[0], 64) + '<div class="award-info"><h4>' + trophyMark('Yashin Trophy', 34) + ' Yashin Trophy</h4><p class="award-winner">' + data[0].name + '</p><p style="color:var(--text-2);font-size:0.85rem">Best goalkeeper · ' + data[0].saves + ' saves · ' + data[0].clean + ' clean sheets · ' + data[0].team + '</p></div></div>' +
        '<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Apps</th><th>Saves</th><th>CS</th><th>Pts</th></tr></thead><tbody>' +
        data.map((p,i) => '<tr class="'+(i<3?'lb-row-top rank-'+(i+1):'')+'"><td class="lb-rank">'+rankBadge(i)+'</td><td class="lb-player">'+lbPlayerCell(p)+'</td><td class="lb-team">'+p.team+'</td><td>'+((stats.ratings&&stats.ratings[p.id])?stats.ratings[p.id].count:0)+'</td><td>'+p.saves+'</td><td>'+p.clean+'</td><td style="font-weight:700;color:var(--gold)">'+Math.round(p.pts)+'</td></tr>').join('') +
        '</tbody></table></div>';
    } else if (type === 'defenders') {
      // Defenders' Award — best defensive campaign: interceptions + tackles,
      // with clean sheets and a defensive-position bonus factored in.
      const scores = {};
      Object.values(stats.interceptions || {}).forEach(p => {
        scores[p.id] = { id: p.id, name: p.name, team: p.team, interceptions: p.count, tackles: 0, clean: 0, pts: p.count * 1.4 };
      });
      Object.values(stats.tackles || {}).forEach(p => {
        if (!scores[p.id]) scores[p.id] = { id: p.id, name: p.name, team: p.team, interceptions: 0, tackles: 0, clean: 0, pts: 0 };
        scores[p.id].tackles = p.count;
        scores[p.id].pts += p.count * 1.1;
      });
      Object.values(stats.cleanSheets || {}).forEach(p => {
        if (scores[p.id]) { scores[p.id].clean = p.count; scores[p.id].pts += p.count * 1.5; }
      });
      Object.values(stats.ratings || {}).forEach(p => {
        if (scores[p.id]) scores[p.id].pts += (p.avg || 0) * Math.min(p.count, 10) * 0.25;
      });
      // Bonus if the player is actually a defender on their roster (CB/RB/LB/RWB/LWB).
      Object.values(scores).forEach(s => {
        let isDef = false;
        for (const t of allTeams) {
          const pl = (t.players || []).find(x => x.id === s.id);
          if (pl && (pl.pos || []).some(pos => ['CB','RB','LB','RWB','LWB'].includes(pos))) { isDef = true; break; }
        }
        if (isDef) s.pts += 3;
      });
      const data = Object.values(scores).filter(p => p.interceptions > 0 || p.tackles > 0).sort((a,b) => b.pts - a.pts).slice(0, 50);
      if (!data.length) { el.innerHTML = '<div class="empty-state"><div class="icon">🧱</div><p>No defensive stats yet.</p></div>'; return; }
      el.innerHTML = '<div class="award-card">' + lbAvatar(data[0], 64) + '<div class="award-info"><h4>' + trophyMark("Defenders' Award", 34) + " Defenders' Award</h4><p class=\"award-winner\">" + data[0].name + '</p><p style="color:var(--text-2);font-size:0.85rem">Best defender · ' + data[0].interceptions + ' interceptions · ' + data[0].tackles + ' tackles · ' + data[0].team + '</p></div></div>' +
        '<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Apps</th><th>Int</th><th>Tkl</th><th>CS</th><th>Pts</th></tr></thead><tbody>' +
        data.map((p,i) => '<tr class="'+(i<3?'lb-row-top rank-'+(i+1):'')+'"><td class="lb-rank">'+rankBadge(i)+'</td><td class="lb-player">'+lbPlayerCell(p)+'</td><td class="lb-team">'+p.team+'</td><td>'+((stats.ratings&&stats.ratings[p.id])?stats.ratings[p.id].count:0)+'</td><td>'+p.interceptions+'</td><td>'+p.tackles+'</td><td>'+p.clean+'</td><td style="font-weight:700;color:var(--gold)">'+Math.round(p.pts)+'</td></tr>').join('') +
        '</tbody></table></div>';
    } else if (type === 'manager') {
      // Manager Award — tallies every manager award won (league titles,
      // Champions League, World Cup) into a leaderboard, crediting the
      // manager currently in charge of the team that earned each award.
      const mgrTrophies = trophies.filter(t => t.manager);
      if (!mgrTrophies.length) { el.innerHTML = '<div class="empty-state"><div class="icon">👔</div><p>No manager awards yet — win a league, Champions League or World Cup.</p></div>'; return; }
      const byMgr = {};
      mgrTrophies.forEach(t => {
        if (!byMgr[t.manager]) byMgr[t.manager] = { name: t.manager, team: t.team, count: 0, latest: 0 };
        byMgr[t.manager].count++;
        byMgr[t.manager].team = t.team; // most recent team on record
        byMgr[t.manager].latest = Math.max(byMgr[t.manager].latest, t.date || 0);
      });
      const data = Object.values(byMgr).sort((a,b) => b.count - a.count || b.latest - a.latest).slice(0, 50);
      const leader = data[0];
      const leaderTeam = allTeams.find(t => t.manager && t.manager.name === leader.name);
      el.innerHTML = '<div class="award-card">' + managerAvatarMark(leaderTeam ? leaderTeam.manager : { name: leader.name }, 64) + '<div class="award-info"><h4>👔 Manager of the Moment</h4><p class="award-winner">' + leader.name + '</p><p style="color:var(--text-2);font-size:0.85rem">' + leader.team + ' · ' + leader.count + ' award' + (leader.count===1?'':'s') + ' won</p></div></div>' +
        '<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Manager</th><th>Team</th><th>Awards</th></tr></thead><tbody>' +
        data.map((m,i) => {
          const t = allTeams.find(tt => tt.manager && tt.manager.name === m.name);
          return '<tr class="'+(i<3?'lb-row-top rank-'+(i+1):'')+'"><td class="lb-rank">'+rankBadge(i)+'</td><td class="lb-player"><div class="lb-player-cell">' + managerAvatarMark(t ? t.manager : { name: m.name }, 34) + '<span class="lb-player-name">'+m.name+'</span></div></td><td class="lb-team">'+m.team+'</td><td style="font-weight:700;color:var(--gold)">'+m.count+'</td></tr>';
        }).join('') +
        '</tbody></table></div>';
    } else if (type === 'trophies') {
      if (!trophies.length) { el.innerHTML = '<div class="empty-state"><div class="icon">🏆</div><p>No trophies won yet. Complete a tournament!</p></div>'; return; }
      el.innerHTML = [...trophies].sort((a,b) => (b.date||0)-(a.date||0)).map(t => '<div class="award-card">' + trophyMark(t.name, 68) + '<div class="award-info"><h4>'+t.name+'</h4><p class="award-winner">'+(t.player ? t.player + (t.team ? ' ('+t.team+')' : '') : t.manager ? '👔 ' + t.manager + (t.team ? ' ('+t.team+')' : '') : t.team)+'</p><p>'+t.type+'</p></div></div>').join('');
    } else {
      // overview
      const topScorer = Object.values(stats.goals||{}).sort((a,b)=>b.count-a.count)[0];
      const topAst = Object.values(stats.assists||{}).sort((a,b)=>b.count-a.count)[0];
      const topMotm = Object.values(stats.motm||{}).sort((a,b)=>b.count-a.count)[0];
      el.innerHTML = `
        <div class="award-card">${topScorer ? lbAvatar(topScorer, 52) : trophyMark('Golden Boot', 68)}<div class="award-info"><h4>${trophyMark('Golden Boot', 30)} Golden Boot Leader</h4><p class="award-winner">${topScorer ? topScorer.name + ' — ' + topScorer.count + ' goals' : '—'}</p></div></div>
        <div class="award-card">${topAst ? lbAvatar(topAst, 52) : trophyMark('Top Assists', 68)}<div class="award-info"><h4>${trophyMark('Top Assists', 30)} Top Assists</h4><p class="award-winner">${topAst ? topAst.name + ' — ' + topAst.count : '—'}</p></div></div>
        <div class="award-card">${topMotm ? lbAvatar(topMotm, 52) : trophyMark('Most MOTM', 68)}<div class="award-info"><h4>${trophyMark('Most MOTM', 30)} Most MOTM</h4><p class="award-winner">${topMotm ? topMotm.name + ' — ' + topMotm.count : '—'}</p></div></div>
        <div class="award-card"><div class="award-icon">🏆</div><div class="award-info"><h4>Trophies</h4><p class="award-winner">${trophies.length} won</p></div></div>`;
    }
  }

  // ========== HISTORY (previous winners, team + individual) ==========
  // Reads straight from the permanent `trophies` case (never cleared by a
  // season reset), grouped newest-first by the run/season-year they came
  // from so each group reads like one completed competition's honours list.
  function trophyGroupKey(t) {
    if (t.category === 'tournament') return 'tournament-' + (t.run || t.date);
    if (t.category === 'season' || t.category === 'season-global') return 'season-' + (t.year != null ? t.year : '?');
    return 'other-' + (t.date || 0);
  }
  function trophyGroupLabel(t) {
    if (t.category === 'tournament') {
      const base = (t.type || '').replace(/\s*Tournament$/, '');
      return base || 'Tournament';
    }
    if (t.category === 'season' || t.category === 'season-global') return 'Season · Year ' + (t.year != null ? t.year : '?');
    return t.type || 'History';
  }

  // Renders the "Season N complete" summary card into the Extras tab after
  // App.endSeasonNow() finishes — the champions crowned and the global
  // individual awards handed out for the season that just closed (built by
  // buildSeasonEndSummary()), plus a pointer to the permanent History tab
  // record and the fact that the next season has already kicked off.
  function renderSeasonEndAnnouncement(summary) {
    const el = document.getElementById('end-season-summary');
    if (!el) return;
    if (!summary) { el.innerHTML = ''; return; }
    const champCard = (t) => `<div class="award-card">${trophyMark(t.name, 52)}<div class="award-info"><h4>${t.name}</h4><p class="award-winner">${t.team}</p></div></div>`;
    const awardMini = (t) => `<div class="award-mini">${trophyMark(t.name, 32)}<div class="am-title">${t.name}</div>` +
      (t.player ? `<div class="am-name">${t.player}</div><div class="am-meta">${t.team || ''}</div>` : '<div class="am-empty">Unclaimed</div>') + '</div>';

    let h = `<div class="group-card" style="margin-top:16px">`;
    h += `<h4>🏁 Season Y${summary.year} — Final Awards</h4>`;
    h += summary.champions.length
      ? summary.champions.map(champCard).join('')
      : '<p style="color:var(--text-muted);font-size:0.85rem">No champions were crowned this season.</p>';
    h += `<h4 style="margin-top:14px">⭐ Individual Awards</h4>`;
    h += summary.globalAwards.length
      ? `<div class="awards-row">${summary.globalAwards.map(awardMini).join('')}</div>`
      : '<p style="color:var(--text-muted);font-size:0.85rem">No individual awards were recorded this season.</p>';
    h += `<p style="color:var(--text-muted);font-size:0.85rem;margin-top:12px">Season Y${summary.year + 1} is already underway — the full record is saved under the History tab.</p>`;
    h += `</div>`;
    el.innerHTML = h;
  }
  function showHistory(type) {
    type = type || historyActiveTab || 'team';
    historyActiveTab = type;
    document.querySelectorAll('#view-history .award-tab').forEach(t => t.classList.toggle('active', t.dataset.history === type));
    const el = document.getElementById('history-content');
    if (!el) return;

    const list = type === 'individual'
      ? trophies.filter(t => t.player || t.manager)
      : trophies.filter(t => !t.player && !t.manager);

    if (!list.length) {
      el.innerHTML = type === 'individual'
        ? '<div class="empty-state"><div class="icon">⭐</div><p>No individual awards recorded yet — finish a tournament or a season.</p></div>'
        : '<div class="empty-state"><div class="icon">🏆</div><p>No champions crowned yet — finish a tournament or a season.</p></div>';
      return;
    }

    const groups = {};
    list.forEach(t => {
      const key = trophyGroupKey(t);
      if (!groups[key]) groups[key] = { label: trophyGroupLabel(t), sortKey: t.date || 0, items: [] };
      groups[key].items.push(t);
      groups[key].sortKey = Math.max(groups[key].sortKey, t.date || 0);
    });
    const orderedKeys = Object.keys(groups).sort((a, b) => groups[b].sortKey - groups[a].sortKey);

    el.innerHTML = orderedKeys.map(key => {
      const g = groups[key];
      const items = g.items.map(t => {
        if (t.player) {
          return `<div class="award-card">${trophyMark(t.name, 64)}<div class="award-info"><h4>${t.name}</h4><p class="award-winner">${t.player}</p><p style="color:var(--text-2);font-size:0.82rem">${t.team || ''}</p></div></div>`;
        }
        if (t.manager) {
          return `<div class="award-card">${trophyMark(t.name, 64)}<div class="award-info"><h4>${t.name}</h4><p class="award-winner">👔 ${t.manager}</p><p style="color:var(--text-2);font-size:0.82rem">${t.team || ''}</p></div></div>`;
        }
        return `<div class="award-card">${trophyMark(t.name, 64)}<div class="award-info"><h4>${t.name}</h4><p class="award-winner">${t.team}</p></div></div>`;
      }).join('');
      return `<div class="group-card" style="margin-bottom:16px"><h4>${g.label}</h4>${items}</div>`;
    }).join('');
  }


  function goToSeason() {
    if (season) { renderSeasonDashboard(); }
    else { renderSeasonSetup(); }
    const setup = document.getElementById('season-setup');
    const dash = document.getElementById('season-dashboard');
    if (setup) setup.style.display = season ? 'none' : 'block';
    if (dash) dash.style.display = season ? 'block' : 'none';
  }

  // Season Calendar only plays with the current 2026-27 squads — a club may have
  // other-season entries in teams.json (e.g. historical or future rosters) that
  // must never be selectable for leagues, whether auto-matched via leagues.json
  // or picked manually.
  const SEASON_YEAR_TAG = '2026-27';
  function isCurrentSeasonSquad(t) {
    return !!(t && t.name && t.name.indexOf(SEASON_YEAR_TAG) !== -1);
  }
  function seasonClubPool() {
    return (teamsData.club || []).filter(isCurrentSeasonSquad);
  }

  // leagues.json lists teams like "Real Madrid 2026-27" — strip the season
  // suffix so it can be matched against whatever team names teams.json uses.
  function normalizeLeagueName(s) {
    return (s || '').toLowerCase().replace(/\s*\d{4}-\d{2,4}\s*$/, '').trim();
  }

  // Resolves the club roster leagues.json defines for a given league name
  // (e.g. "La Liga") against the clubs actually present in teams.json.
  // Returns [] if leagues.json has no entry or none of its names match yet
  // (e.g. before teams.json has been filled in) — callers should fall back
  // to the full club pool in that case.
  function getLeagueTeamPool(leagueName) {
    const names = leaguesData[leagueName];
    if (!names || !names.length) return [];
    const pool = seasonClubPool();
    const matched = [];
    names.forEach(n => {
      const norm = normalizeLeagueName(n);
      let t = pool.find(x => (x.name || '').toLowerCase() === (n || '').toLowerCase());
      if (!t) t = pool.find(x => normalizeLeagueName(x.name) === norm);
      if (!t) t = pool.find(x => norm && (normalizeLeagueName(x.name).includes(norm) || norm.includes(normalizeLeagueName(x.name))));
      if (t && !matched.includes(t)) matched.push(t);
    });
    return matched;
  }

  function renderSeasonSetup() {
    const el = document.getElementById('season-setup-comps');
    if (!el) return;
    const fullPool = seasonClubPool();
    el.innerHTML = SEASON_LEAGUE_DEFS.map(def => {
      const sel = seasonSetup.selections[def.key];
      const q = (seasonSetup.search[def.key] || '').toLowerCase();
      // Prefer the roster leagues.json defines for this league; only fall
      // back to the full club pool (manual picking) if nothing matched yet
      // (e.g. teams.json hasn't been filled in with matching names).
      const leaguePool = getLeagueTeamPool(def.name);
      const usingLeagueFile = leaguePool.length > 0;
      const pool = usingLeagueFile ? leaguePool : fullPool;
      const visible = pool.filter(t => !q || (t.name || '').toLowerCase().includes(q) || (t.short || '').toLowerCase().includes(q));
      return `<div class="card" style="margin-bottom:14px">
        <div class="card-title">${def.name} <span style="color:var(--text-muted);font-weight:400;font-size:0.8rem">(${sel.size} selected${usingLeagueFile ? ' · from leagues.json' : ''})</span></div>
        ${usingLeagueFile ? '' : `<div style="color:var(--text-muted);font-size:0.75rem;margin-bottom:8px">No leagues.json match found yet for ${def.name} — pick clubs manually below (add matching names to teams.json to auto-fill this).</div>`}
        <input type="search" placeholder="Search clubs..." value="${(seasonSetup.search[def.key]||'').replace(/"/g,'&quot;')}" oninput="App.searchSeasonTeams('${def.key}', this.value)" style="margin-bottom:10px;width:100%" autocomplete="off">
        <div class="teams-checkbox-grid">
          ${visible.map(t => {
            const checked = sel.has(t.id);
            const usedElsewhere = !usingLeagueFile && SEASON_LEAGUE_DEFS.some(d => d.key !== def.key && seasonSetup.selections[d.key].has(t.id));
            return `<label class="team-check ${checked ? 'selected' : ''}" style="${usedElsewhere ? 'opacity:0.4' : ''}">
              <input type="checkbox" ${checked ? 'checked' : ''} ${usedElsewhere ? 'disabled' : ''} onchange="App.toggleSeasonTeam('${def.key}','${t.id}')">
              <span>${teamMark(t, 18)} ${t.name}</span>
            </label>`;
          }).join('') || '<div class="empty-state"><p>No clubs found</p></div>'}
        </div>
      </div>`;
    }).join('') + `<div class="card" style="margin-bottom:14px;border-color:var(--accent-gold)">
        <div class="card-title">🏆 Champions League</div>
        <div style="color:var(--text-muted);font-size:0.85rem">No manual selection needed — the top ${UCL_QUALIFY_PER_LEAGUE} clubs from each league table automatically qualify as Champions League candidates. In Year 1 (before any table exists), qualifiers are seeded from each club's squad strength.</div>
      </div>`;
  }

  // Debounced per-competition — renderSeasonSetup() rebuilds the whole
  // season setup panel (every competition's team list) on each call, so
  // firing that on every keystroke was unnecessary lag. Keyed by compKey
  // since more than one competition's search box can be on screen at once.
  const _seasonSearchDebouncers = {};
  function searchSeasonTeams(compKey, value) {
    seasonSetup.search[compKey] = value;
    if (!_seasonSearchDebouncers[compKey]) {
      _seasonSearchDebouncers[compKey] = debounce(renderSeasonSetup, 150);
    }
    _seasonSearchDebouncers[compKey]();
  }

  function toggleSeasonTeam(compKey, teamId) {
    const sel = seasonSetup.selections[compKey];
    if (!sel) return;
    if (sel.has(teamId)) sel.delete(teamId);
    else {
      // A club may only sit in one domestic league at a time.
      SEASON_LEAGUE_DEFS.forEach(d => { if (d.key !== compKey) seasonSetup.selections[d.key].delete(teamId); });
      sel.add(teamId);
    }
    renderSeasonSetup();
  }

  function autoFillSeason() {
    Object.values(seasonSetup.selections).forEach(s => s.clear());
    // Prefer leagues.json rosters where available.
    const leagueFileDefs = SEASON_LEAGUE_DEFS.filter(def => getLeagueTeamPool(def.name).length > 0);
    leagueFileDefs.forEach(def => {
      getLeagueTeamPool(def.name).forEach(t => seasonSetup.selections[def.key].add(t.id));
    });
    // Any leagues without a leagues.json match get a random spread from the remaining pool.
    const remainingDefs = SEASON_LEAGUE_DEFS.filter(def => !leagueFileDefs.includes(def));
    if (remainingDefs.length) {
      const used = new Set(leagueFileDefs.flatMap(def => [...seasonSetup.selections[def.key]]));
      const pool = shuffleArray(seasonClubPool().filter(t => !used.has(t.id)));
      const perLeague = Math.max(4, Math.min(10, Math.floor(pool.length / remainingDefs.length)));
      let cursor = 0;
      remainingDefs.forEach(def => {
        for (let i = 0; i < perLeague && cursor < pool.length; i++) seasonSetup.selections[def.key].add(pool[cursor++].id);
      });
    }
    renderSeasonSetup();
    toast('Auto-filled all leagues' + (leagueFileDefs.length ? ' from leagues.json' : ''));
  }

  function clearSeasonSetup() {
    Object.values(seasonSetup.selections).forEach(s => s.clear());
    renderSeasonSetup();
  }

  // ---------- scheduling helpers ----------
  function circleMethodRounds(teamIds) {
    let ids = teamIds.slice();
    if (ids.length % 2 !== 0) ids.push(null);
    const n = ids.length;
    const rounds = [];
    let arr = ids.slice();
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i], b = arr[n - 1 - i];
        if (a != null && b != null) pairs.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
      }
      rounds.push(pairs);
      const fixed = arr[0];
      const rest = arr.slice(1);
      rest.unshift(rest.pop());
      arr = [fixed, ...rest];
    }
    return rounds;
  }

  function buildDoubleRoundRobinRounds(teams) {
    const ids = teams.map(t => t.id);
    if (ids.length < 2) return [];
    const firstLeg = circleMethodRounds(ids);
    const secondLeg = firstLeg.map(round => round.map(([a, b]) => [b, a]));
    return [...firstLeg, ...secondLeg].map(pairs => pairs.map(([home, away]) => ({
      home, away, played: false, homeScore: null, awayScore: null, report: null
    })));
  }

  function blankSeasonRow(team) {
    return { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 };
  }

  function applyResultToTable(table, homeId, awayId, hg, ag) {
    const ht = table.find(r => r.team.id === homeId);
    const at = table.find(r => r.team.id === awayId);
    if (!ht || !at) return;
    ht.played++; at.played++;
    ht.gf += hg; ht.ga += ag; at.gf += ag; at.ga += hg;
    if (hg > ag) { ht.won++; ht.pts += 3; at.lost++; }
    else if (ag > hg) { at.won++; at.pts += 3; ht.lost++; }
    else { ht.drawn++; at.drawn++; ht.pts++; at.pts++; }
  }

  function sortedTable(table) {
    return [...table].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
  }

  function bracketSizeFor(n) {
    let size = 2;
    while (size * 2 <= n && size * 2 <= 8) size *= 2;
    return size;
  }

  function seedPairsForSize(size) {
    if (size === 8) return [[0, 7], [3, 4], [2, 5], [1, 6]];
    if (size === 4) return [[0, 3], [1, 2]];
    return [[0, 1]];
  }

  function winnerOfResult(homeTeam, awayTeam, result) {
    if (result.home > result.away) return homeTeam;
    if (result.away > result.home) return awayTeam;
    if (result.pens) return result.pens.home > result.pens.away ? homeTeam : awayTeam;
    return seededRandom() < 0.5 ? homeTeam : awayTeam;
  }

  function simulateRoundFixtures(round, opts, onResult) {
    (round || []).forEach(fx => {
      if (fx.played) return;
      const homeTeam = getTeam(fx.home), awayTeam = getTeam(fx.away);
      if (!homeTeam || !awayTeam) { fx.played = true; return; }
      const result = simQuickMatch(homeTeam, awayTeam, { countForLeaderboard: true, allowET: !!opts.allowET, allowPens: !!opts.allowPens });
      fx.played = true;
      fx.homeScore = result.home;
      fx.awayScore = result.away;
      fx.report = result.report;
      fx.pens = result.pens;
      if (onResult) onResult(fx, homeTeam, awayTeam, result);
    });
  }

  function buildKnockoutFixtures(teamsInSeed, pairsIdx) {
    return { fixtures: pairsIdx.map(([i, j]) => ({
      home: teamsInSeed[i].id, away: teamsInSeed[j].id, played: false, homeScore: null, awayScore: null, report: null, winnerId: null
    })), played: false };
  }

  function buildKnockoutFromWinners(winners) {
    const fixtures = [];
    for (let i = 0; i < winners.length; i += 2) {
      const swap = seededRandom() < 0.5;
      const h = swap ? winners[i] : winners[i + 1];
      const a = swap ? winners[i + 1] : winners[i];
      fixtures.push({ home: h.id, away: a.id, played: false, homeScore: null, awayScore: null, report: null, winnerId: null });
    }
    return { fixtures, played: false };
  }

  // ---------- Champions League qualification ----------
  // Year 1: no table exists yet, so seed qualifiers by squad strength (like
  // a pre-season club-strength ranking). Every later year uses the actual
  // final league standings (real-life style: table-toppers qualify).
  function computeInitialUCLQualifiers(leagueTeams) {
    const qualifiers = [];
    SEASON_LEAGUE_DEFS.forEach(def => {
      const ranked = [...(leagueTeams[def.key] || [])].sort((a, b) => teamAvgOvr(b) - teamAvgOvr(a));
      ranked.slice(0, UCL_QUALIFY_PER_LEAGUE).forEach(t => qualifiers.push(t));
    });
    return qualifiers;
  }

  function computeUCLQualifiersFromStandings() {
    const qualifiers = [];
    SEASON_LEAGUE_DEFS.forEach(def => {
      const comp = season.leagues[def.key];
      if (!comp) return;
      const standings = sortedTable(comp.table).map(r => r.team);
      standings.slice(0, UCL_QUALIFY_PER_LEAGUE).forEach(t => qualifiers.push(t));
    });
    return qualifiers;
  }

  // ---------- starting a season ----------
  function startSeason() {
    const leagueTeams = {};
    let msg = '';
    for (const def of SEASON_LEAGUE_DEFS) {
      const ids = [...seasonSetup.selections[def.key]];
      if (ids.length < 4) msg += `${def.name} needs at least 4 clubs (has ${ids.length}). `;
      leagueTeams[def.key] = ids.map(id => getTeam(id)).filter(Boolean);
    }
    const el = document.getElementById('season-setup-msg');
    if (msg) { if (el) el.textContent = msg; toast('Fix the leagues highlighted below'); return; }
    if (el) el.textContent = '';

    const leagues = {};
    SEASON_LEAGUE_DEFS.forEach(def => {
      const teams = leagueTeams[def.key];
      leagues[def.key] = {
        key: def.key, name: def.name, teams,
        table: teams.map(blankSeasonRow),
        rounds: buildDoubleRoundRobinRounds(teams),
        currentRound: 0,
        champion: null,
        finished: false,
        stats: blankCompStats()
      };
    });

    // Champions League candidates qualify automatically — top clubs from
    // each domestic league, not a manual pick.
    const uclTeams = computeInitialUCLQualifiers(leagueTeams);
    const matchesPerTeam = Math.max(2, Math.min(8, uclTeams.length - 1));
    const leagueFixtures = generateUCLLeagueFixtures(uclTeams, matchesPerTeam);
    const uclRounds = [];
    for (let r = 1; r <= matchesPerTeam; r++) uclRounds.push(leagueFixtures.filter(f => f.round === r));

    const ucl = {
      key: 'ucl', name: 'Champions League', teams: uclTeams,
      table: uclTeams.map(blankSeasonRow),
      rounds: uclRounds,
      currentRound: 0,
      matchesPerTeam,
      stage: 'league',
      bracketSize: null,
      knockout: { qf: null, sf: null, final: null },
      champion: null,
      finished: false,
      stats: blankCompStats()
    };

    season = { year: 1, week: 0, daySlot: 0, leagues, ucl };
    seasonActiveTab = 'epl';
    seasonActiveSubTab = 'table';
    renderSeasonDashboard();
    const setup = document.getElementById('season-setup');
    const dash = document.getElementById('season-dashboard');
    if (setup) setup.style.display = 'none';
    if (dash) dash.style.display = 'block';
    toast('Season started — good luck!');
    persistAll();
  }

  function crownLeagueChampion(comp) {
    const standings = sortedTable(comp.table);
    comp.champion = standings[0] ? standings[0].team : null;
    if (comp.champion) {
      const year = season ? season.year : 1;
      const extra = { category: 'season', year };
      pushTeamTrophy(comp.name, comp.champion.name, 'League (Y' + year + ')', extra);
      pushManagerAward(comp.name + ' Manager of the Season', comp.champion, 'League (Y' + year + ')', extra);
      recordIndividualAwardsFromAwardsObject(assignCompAwards(comp), comp.name + ' (Y' + year + ')', extra);
    }
  }

  function simulateLeagueRound(comp) {
    if (!comp || comp.finished) return;
    if (comp.currentRound >= comp.rounds.length) { comp.finished = true; crownLeagueChampion(comp); return; }
    if (!comp.stats) comp.stats = blankCompStats();
    currentSeasonComp = comp;
    simulateRoundFixtures(comp.rounds[comp.currentRound], { allowET: false, allowPens: false }, (fx, h, a, result) => {
      applyResultToTable(comp.table, fx.home, fx.away, result.home, result.away);
    });
    currentSeasonComp = null;
    comp.currentRound++;
    if (comp.currentRound >= comp.rounds.length) { comp.finished = true; crownLeagueChampion(comp); }
  }

  // Builds the UCL knockout bracket from final league-phase standings.
  // Shared by the batch simulator (simulateUCLStep) and the per-fixture
  // live/instant path (advanceSeasonRoundIfComplete) so both routes into
  // the knockout stage behave identically.
  function buildUCLBracketFromLeagueTable(comp) {
    const size = bracketSizeFor(comp.teams.length);
    comp.bracketSize = size;
    const standings = sortedTable(comp.table).map(r => r.team);
    const qualifiers = standings.slice(0, size);
    const firstRound = buildKnockoutFixtures(qualifiers, seedPairsForSize(size));
    if (size <= 2) { comp.knockout.final = firstRound; comp.stage = 'final'; }
    else if (size === 4) { comp.knockout.sf = firstRound; comp.stage = 'sf'; }
    else { comp.knockout.qf = firstRound; comp.stage = 'qf'; }
  }

  function simulateUCLStep(comp) {
    if (!comp || comp.finished) return;
    if (!comp.stats) comp.stats = blankCompStats();
    currentSeasonComp = comp;
    if (comp.stage === 'league') {
      if (comp.currentRound >= comp.rounds.length) { comp.stage = 'transition'; }
      else {
        simulateRoundFixtures(comp.rounds[comp.currentRound], { allowET: false, allowPens: false }, (fx, h, a, result) => {
          applyResultToTable(comp.table, fx.home, fx.away, result.home, result.away);
        });
        comp.currentRound++;
      }
      if (comp.currentRound >= comp.rounds.length) buildUCLBracketFromLeagueTable(comp);
    } else if (comp.stage === 'qf') {
      simulateRoundFixtures(comp.knockout.qf.fixtures, { allowET: true, allowPens: true }, (fx, h, a, result) => {
        fx.winnerId = winnerOfResult(h, a, result).id;
      });
      comp.knockout.qf.played = true;
      const winners = comp.knockout.qf.fixtures.map(f => getTeam(f.winnerId));
      comp.knockout.sf = buildKnockoutFromWinners(winners);
      comp.stage = 'sf';
    } else if (comp.stage === 'sf') {
      simulateRoundFixtures(comp.knockout.sf.fixtures, { allowET: true, allowPens: true }, (fx, h, a, result) => {
        fx.winnerId = winnerOfResult(h, a, result).id;
      });
      comp.knockout.sf.played = true;
      const winners = comp.knockout.sf.fixtures.map(f => getTeam(f.winnerId));
      comp.knockout.final = buildKnockoutFromWinners(winners);
      comp.stage = 'final';
    } else if (comp.stage === 'final') {
      simulateRoundFixtures(comp.knockout.final.fixtures, { allowET: true, allowPens: true }, (fx, h, a, result) => {
        fx.winnerId = winnerOfResult(h, a, result).id;
      });
      comp.knockout.final.played = true;
      const champ = getTeam(comp.knockout.final.fixtures[0].winnerId);
      comp.champion = champ;
      comp.finished = true;
      if (champ) {
        const year = season ? season.year : 1;
        const extra = { category: 'season', year };
        pushTeamTrophy('Champions League', champ.name, 'Season (Y' + year + ')', extra);
        pushManagerAward('Champions League Winning Manager', champ, 'Season (Y' + year + ')', extra);
        recordIndividualAwardsFromAwardsObject(assignCompAwards(comp), 'Champions League (Y' + year + ')', extra);
      }
    }
    currentSeasonComp = null;
  }

  // Derives the season-wide "Matchday" counter from actual progress instead
  // of a manually-incremented counter, so it stays correct no matter which
  // route a fixture was played through (live, instant, or bulk simulate) —
  // this is what's shown as "Year N · Matchday W" in the season header.
  // Matchday W means "every domestic league AND the Champions League have
  // completed round W" (a finished competition, or the Champions League
  // once it has left its league phase for the knockout stage, is treated
  // as having completed all of its rounds) — so the counter only advances
  // once the slowest competition catches up. Previously this only looked
  // at the 5 domestic leagues, so the Matchday label could tick forward
  // even while the Champions League still had that matchday's fixtures
  // sitting unplayed — fixed by folding the UCL into the same calculation.
  function computeSeasonWeek(s) {
    if (!s || !s.leagues) return 0;
    // A finished competition's currentRound stops moving forever, and so
    // does the UCL's once it leaves its league phase for the knockout
    // bracket (progress from there is tracked via the bracket, not
    // currentRound) — neither should ever act as a floor on the
    // season-wide matchday count, or the very first competition to reach
    // either state permanently freezes every other competition that's
    // still progressing.
    const active = seasonCompEntries(s).filter(({ key, comp }) => {
      if (!comp || comp.finished) return false;
      if (key === 'ucl' && comp.stage !== 'league') return false;
      return true;
    });
    if (!active.length) {
      const finalRounds = seasonCompEntries(s).map(({ comp }) => comp ? comp.rounds.length : 0);
      return finalRounds.length ? Math.max(...finalRounds) : 0;
    }
    return Math.min(...active.map(({ comp }) => comp.currentRound));
  }

  // ========== STRICT MATCHDAY GATING ==========
  // Every competition that makes up a season (the 5 domestic leagues plus
  // the Champions League) advances matchday-by-matchday in lockstep: none
  // of them may start playing their NEXT round's fixtures until every
  // competition has finished the CURRENT one. This is what makes "Matchday
  // W" a single, meaningful, season-wide number instead of each league
  // silently racing ahead at its own pace while the header still claims
  // an earlier, incomplete matchday.
  //
  // The Champions League knockout stage (quarterfinals onward) is the one
  // exception: those ties aren't part of the regular per-matchday cadence
  // (they're the season's coverage of one-off knockout weeks), so once the
  // UCL has left its league phase it's always treated as "due" rather than
  // being held back waiting on the domestic leagues.
  function seasonCompEntries(s) {
    s = s || season;
    if (!s || !s.leagues) return [];
    const entries = SEASON_LEAGUE_DEFS.map(def => ({ key: def.key, comp: s.leagues[def.key] }));
    entries.push({ key: 'ucl', comp: s.ucl });
    return entries;
  }
  // True once `comp` has nothing left to play for the CURRENT global
  // matchday (either finished outright, or — UCL knockout only — past the
  // point where "matchday number" applies at all).
  function seasonCompDoneWithMatchday(key, comp, targetIdx) {
    if (!comp || comp.finished) return true;
    if (key === 'ucl' && comp.stage !== 'league') return true;
    return comp.currentRound > targetIdx;
  }
  // Whether `comp` is allowed to simulate/play a fixture right now — false
  // if it has already completed the current global matchday and is simply
  // waiting on slower competitions to catch up before the day can turn over,
  // OR if today's fixture-congestion slot belongs to a different competition
  // (e.g. it's a UCL day, so the domestic leagues sit idle until the cycle
  // comes back round to them).
  function seasonCompCanPlayNow(key, comp) {
    if (!season || !comp || comp.finished) return false;
    if (key === 'ucl' && comp.stage !== 'league') return true;
    const slot = currentCongestionSlot();
    if (!seasonKeysForCongestionComp(slot.comp).includes(key)) return false;
    return comp.currentRound <= computeSeasonWeek(season);
  }

  // Human-readable reason a fixture can't be played right now, for the
  // toasts in simSeasonFixture/playSeasonFixture — distinguishes "it's not
  // this competition's day yet" from "the matchday itself isn't finished".
  function seasonBlockedFixtureMessage(compKey) {
    const slot = currentCongestionSlot();
    const eligible = seasonKeysForCongestionComp(slot.comp);
    if (!eligible.includes(compKey)) {
      return "It's " + slot.day + " — " + slot.comp + " fixtures only today. Simulate today's matches first to move on.";
    }
    const due = seasonMatchesDue();
    return 'Matchday ' + (computeSeasonWeek(season) + 1) + " isn't finished yet — " +
      due.length + (due.length === 1 ? ' match is' : ' matches are') + ' still due elsewhere first';
  }
  // Every still-unplayed fixture blocking the season from advancing past
  // its current matchday — i.e. every fixture, across every competition,
  // that belongs to the matchday the header is currently showing. Used to
  // tell the person exactly which matches are still due before the day
  // can change.
  function seasonMatchesDue() {
    if (!season) return [];
    const targetIdx = computeSeasonWeek(season);
    const due = [];
    seasonCompEntries().forEach(({ key, comp }) => {
      if (!comp || comp.finished) return;
      if (key === 'ucl' && comp.stage !== 'league') return;
      if (comp.currentRound !== targetIdx) return;
      const round = comp.rounds[comp.currentRound] || [];
      round.forEach(f => {
        if (f.played) return;
        const home = getTeam(f.home), away = getTeam(f.away);
        due.push({ compName: comp.name, compKey: key, home: home ? home.short : '?', away: away ? away.short : '?' });
      });
    });
    return due;
  }

  // Advances a competition's matchday once every fixture in the current
  // round has been played (whether via live play, instant sim, or batch
  // simulation). Mirrors the round-increment logic that used to live only
  // inside simulateLeagueRound/simulateUCLStep.
  function advanceSeasonRoundIfComplete(comp, compKey) {
    if (!comp || !comp.rounds) return;
    const round = comp.rounds[comp.currentRound];
    if (!round || !round.length || !round.every(f => f.played)) return;
    comp.currentRound++;
    if (compKey === 'ucl') {
      if (comp.currentRound >= comp.rounds.length) buildUCLBracketFromLeagueTable(comp);
    } else if (comp.currentRound >= comp.rounds.length) {
      comp.finished = true;
      crownLeagueChampion(comp);
    }
    // Keep the season-wide Matchday counter in sync — this is the fix for
    // live/instant single-fixture play never advancing it (only the bulk
    // "Simulate Matchday" actions used to update it directly).
    if (season) { season.week = computeSeasonWeek(season); advanceCongestionSlotIfComplete(); }
    finalizeSeasonIfComplete();
  }

  // Simulates a single fixture from the current matchday instantly (no live
  // view), same as the "Instant" option tournaments already offer.
  function simSeasonFixture(compKey, idx) {
    if (!season) return;
    const comp = compKey === 'ucl' ? season.ucl : season.leagues[compKey];
    if (!comp || comp.finished) return;
    if (!seasonCompCanPlayNow(compKey, comp)) {
      toast(seasonBlockedFixtureMessage(compKey));
      return;
    }
    const round = comp.rounds[comp.currentRound];
    const f = round && round[idx];
    if (!f || f.played) return;
    const home = getTeam(f.home), away = getTeam(f.away);
    if (!home || !away) { f.played = true; return; }
    showLoading('Simulating match…');
    setTimeout(function() {
      try {
        if (!comp.stats) comp.stats = blankCompStats();
        currentSeasonComp = comp;
        const result = simQuickMatch(home, away, { countForLeaderboard: true, allowET: false, allowPens: false });
        currentSeasonComp = null;
        f.played = true; f.homeScore = result.home; f.awayScore = result.away; f.report = result.report; f.pens = result.pens;
        applyResultToTable(comp.table, f.home, f.away, result.home, result.away);
        advanceSeasonRoundIfComplete(comp, compKey);
        renderSeasonDashboard();
        persistAll();
      } finally { hideLoading(); }
    }, 30);
  }

  // Plays a single fixture from the current matchday live in the Match view —
  // same flow as playTournamentMatch/playUCLFixture, but writes the result
  // back into the season's league table instead of a tournament bracket.
  function playSeasonFixture(compKey, idx) {
    if (!season) return;
    const comp = compKey === 'ucl' ? season.ucl : season.leagues[compKey];
    if (!comp || comp.finished) return;
    if (!seasonCompCanPlayNow(compKey, comp)) {
      toast(seasonBlockedFixtureMessage(compKey));
      return;
    }
    const round = comp.rounds[comp.currentRound];
    const f = round && round[idx];
    if (!f || f.played) return;
    const home = getTeam(f.home), away = getTeam(f.away);
    if (!home || !away) return;
    window._seasonFixture = { compKey, idx };
    window._tourFixtureIdx = null;
    window._uclFixtureIdx = null;
    window._koRoundIdx = null;
    window._koMatchIdx = null;
    window._fromTournament = false;
    window._backTarget = 'season';
    switchView('match');
    const homeSel = document.getElementById('home-team');
    const awaySel = document.getElementById('away-team');
    if (homeSel) homeSel.value = home.id;
    if (awaySel) awaySel.value = away.id;
    const formKeys = Object.keys(FORMATIONS);
    const hf = formKeys[Math.floor(seededRandom() * formKeys.length)];
    const af = formKeys[Math.floor(seededRandom() * formKeys.length)];
    const hForm = document.getElementById('home-formation');
    const aForm = document.getElementById('away-formation');
    if (hForm) hForm.value = hf;
    if (aForm) aForm.value = af;
    // Clear custom lineups so random formation applies
    customLineups.home = null;
    customLineups.away = null;
    updateTeamPreview('home'); updateTeamPreview('away');
    if (!comp.stats) comp.stats = blankCompStats();
    currentSeasonComp = comp;
    startMatch();
    toast((comp.name || 'Season') + ' — live · formations randomized');
  }

  function seasonIsComplete() {
    if (!season) return true;
    return SEASON_LEAGUE_DEFS.every(def => season.leagues[def.key].finished) && season.ucl.finished;
  }

  function simulateSeasonWeek() {
    if (!season) return;
    withLoading('Simulating matchday…', function() {
      // Only simulate competitions that are actually still due for THIS
      // matchday — a competition that's already raced ahead (or, for the
      // UCL, moved into its knockout stage) is left alone so the day only
      // turns over once literally everything due has been played.
      const targetIdx = computeSeasonWeek(season);
      const eligibleKeys = new Set(seasonKeysForCongestionComp(currentCongestionSlot().comp));
      seasonCompEntries().forEach(({ key, comp }) => {
        if (!comp || comp.finished) return;
        // Knockout ties (QF/SF/Final) are one-off weeks outside the normal
        // matchday cadence and congestion cycle entirely, so they must be
        // checked — and simulated — before the matchday/congestion gates
        // below, not filtered out by them.
        if (key === 'ucl' && comp.stage !== 'league') { simulateUCLStep(comp); return; }
        if (seasonCompDoneWithMatchday(key, comp, targetIdx)) return;
        if (!eligibleKeys.has(key)) return; // not today's competition
        if (key === 'ucl') simulateUCLStep(comp); else simulateLeagueRound(comp);
      });
      season.week = computeSeasonWeek(season);
      advanceCongestionSlotIfComplete();
      finalizeSeasonIfComplete();
      renderSeasonDashboard();
      persistAll();
      saveStats();
    });
  }

  function simulateSeasonToEnd() {
    if (!season) return;
    // Rough denominator for the progress bar: the most matchdays any single
    // still-active competition has left. Not exact (competitions advance at
    // different rates and some weeks skip a competition entirely), but a
    // reasonable estimate that self-corrects as remaining rounds shrink.
    const estimatedWeeks = Math.max(1, ...seasonCompEntries()
      .map(({ comp }) => (comp && !comp.finished) ? Math.max(0, comp.rounds.length - comp.currentRound) : 0));
    withLoadingProgress('Simulating rest of season…', async function() {
      let safety = 0;
      const startTime = Date.now();
      // "Simulate to End" fast-forwards past the fixture-congestion cadence
      // on purpose — it's a bulk skip-ahead action, not a day-by-day play
      // session, so every competition due for the matchday plays regardless
      // of whose day it is in the congestion cycle.
      while (!seasonIsComplete() && safety < 1000) {
        const targetIdx = computeSeasonWeek(season);
        let playedSomething = false;
        seasonCompEntries().forEach(({ key, comp }) => {
          if (!comp || comp.finished) return;
          // Knockout ties must be checked — and simulated — before the
          // matchday gate below, since seasonCompDoneWithMatchday treats
          // them as "done with the matchday" (correctly, so they don't
          // block the domestic leagues) but that's not the same as "don't
          // simulate them"; without this they'd never advance in a bulk
          // sim and the season would never actually finish.
          if (key === 'ucl' && comp.stage !== 'league') { simulateUCLStep(comp); playedSomething = true; return; }
          if (seasonCompDoneWithMatchday(key, comp, targetIdx)) return;
          if (key === 'ucl') simulateUCLStep(comp); else simulateLeagueRound(comp);
          playedSomething = true;
        });
        season.week = computeSeasonWeek(season);
        safety++;
        updateLoadingProgress(Math.min(safety, estimatedWeeks), estimatedWeeks, startTime);
        await simTick();
        // Safety valve: if a pass through every competition made no
        // progress at all, stop rather than spin forever.
        if (!playedSomething) break;
      }
      updateLoadingProgress(estimatedWeeks, estimatedWeeks, startTime);
      advanceCongestionSlotIfComplete();
      finalizeSeasonIfComplete();
      renderSeasonDashboard();
      persistAll();
      saveStats();
    });
  }

  function startNewSeasonYear() {
    if (!season) return;
    if (!seasonIsComplete()) { toast('Finish this season first (or Simulate To End)'); return; }
    const year = season.year + 1;
    const leagues = {};
    SEASON_LEAGUE_DEFS.forEach(def => {
      const teams = season.leagues[def.key].teams;
      leagues[def.key] = {
        key: def.key, name: def.name, teams,
        table: teams.map(blankSeasonRow),
        rounds: buildDoubleRoundRobinRounds(teams),
        currentRound: 0, champion: null, finished: false,
        stats: blankCompStats()
      };
    });
    // Re-qualify the Champions League from this season's just-finished
    // final standings — the top clubs from each league carry forward.
    const uclTeams = computeUCLQualifiersFromStandings();
    const matchesPerTeam = Math.max(2, Math.min(8, uclTeams.length - 1));
    const leagueFixtures = generateUCLLeagueFixtures(uclTeams, matchesPerTeam);
    const uclRounds = [];
    for (let r = 1; r <= matchesPerTeam; r++) uclRounds.push(leagueFixtures.filter(f => f.round === r));
    season = {
      year, week: 0, daySlot: 0, leagues,
      ucl: { key: 'ucl', name: 'Champions League', teams: uclTeams, table: uclTeams.map(blankSeasonRow),
        rounds: uclRounds, currentRound: 0, matchesPerTeam, stage: 'league', bracketSize: null,
        knockout: { qf: null, sf: null, final: null }, champion: null, finished: false,
        stats: blankCompStats() }
    };
    renderSeasonDashboard();
    toast('Year ' + year + ' kicks off!');
    persistAll();
  }

  // Snapshots the season that just finished — its champions (from
  // `trophies`, category 'season', team-only entries) and its global
  // individual awards (category 'season-global', pushed a moment earlier
  // by archiveAndResetGlobalAwards) — into one small object the Extras tab
  // "End Season" announcement can render. Reads back out of the permanent
  // trophy case rather than the live season/stats objects, since by the
  // time this is called startNewSeasonYear() may already have replaced
  // `season` and the global leaderboard has already been wiped.
  function buildSeasonEndSummary(year) {
    const champions = trophies.filter(t => t.category === 'season' && t.year === year && !t.player && !t.manager);
    const globalAwards = trophies.filter(t => t.category === 'season-global' && t.year === year);
    return { year, champions, globalAwards };
  }

  // Manual "End Season" action (Extras tab) — a one-click way to close out
  // the current season right now instead of grinding through remaining
  // matchdays by hand. Finishes every fixture still outstanding across the
  // 5 domestic leagues + Champions League (same core loop as
  // simulateSeasonToEnd), which crowns each competition's champion as it
  // completes; then finalizes/archives the season's global awards (Golden
  // Boot, Ballon d'Or, Puskás Award, etc. — wiping the live leaderboard for
  // the season ahead), immediately kicks off the next season year, and
  // hands back a summary for the UI to announce.
  async function endSeasonNow() {
    if (!season) { toast('Start a season first — there\'s nothing to end yet.'); return null; }

    let summary = null;
    await withLoadingProgress('Ending season…', async function() {
      const estimatedWeeks = Math.max(1, ...seasonCompEntries()
        .map(({ comp }) => (comp && !comp.finished) ? Math.max(0, comp.rounds.length - comp.currentRound) : 0));
      let safety = 0;
      const startTime = Date.now();
      while (!seasonIsComplete() && safety < 1000) {
        const targetIdx = computeSeasonWeek(season);
        let playedSomething = false;
        seasonCompEntries().forEach(({ key, comp }) => {
          if (!comp || comp.finished) return;
          if (key === 'ucl' && comp.stage !== 'league') { simulateUCLStep(comp); playedSomething = true; return; }
          if (seasonCompDoneWithMatchday(key, comp, targetIdx)) return;
          if (key === 'ucl') simulateUCLStep(comp); else simulateLeagueRound(comp);
          playedSomething = true;
        });
        season.week = computeSeasonWeek(season);
        safety++;
        updateLoadingProgress(Math.min(safety, estimatedWeeks), estimatedWeeks, startTime);
        await simTick();
        if (!playedSomething) break;
      }
      advanceCongestionSlotIfComplete();
      finalizeSeasonIfComplete();

      const finishedYear = season.year;
      summary = buildSeasonEndSummary(finishedYear);
      startNewSeasonYear();
      renderSeasonDashboard();
      persistAll();
      saveStats();
    });
    return summary;
  }
  // Extras-tab entry point: confirms with the person (wording adapts to
  // whether there's actually anything left to force through), runs
  // endSeasonNow(), then renders the resulting summary card and toasts a
  // short confirmation. Kept separate from endSeasonNow() itself so other
  // callers (e.g. a future keyboard shortcut or automated test) can invoke
  // the underlying action without the confirm()/DOM-render coupling.
  async function endSeasonAndAnnounce() {
    if (!season) { toast('Start a season first — there\'s nothing to end yet.'); return; }
    const already = seasonIsComplete();
    const msg = already
      ? 'End Season Y' + season.year + ' now? This hands out the season\'s awards, resets the leaderboard, and kicks off Season Y' + (season.year + 1) + '.'
      : 'End Season Y' + season.year + ' now? Any fixtures still outstanding will be simulated to their conclusion, this season\'s champions crowned, awards handed out, and the leaderboard reset for Season Y' + (season.year + 1) + '.';
    if (!confirm(msg)) return;
    const summary = await endSeasonNow();
    if (summary) {
      renderSeasonEndAnnouncement(summary);
      toast('Season Y' + summary.year + ' complete — awards archived, Season Y' + (summary.year + 1) + ' underway!');
    }
  }
  function resetSeason() {
    if (!confirm('Reset the season? All standings and fixtures will be lost.')) return;
    season = null;
    seasonActiveTab = 'epl';
    seasonActiveSubTab = 'table';
    seasonSetup = {
      selections: { epl: new Set(), laliga: new Set(), seriea: new Set(), bundesliga: new Set(), ligue1: new Set() },
      search: { epl: '', laliga: '', seriea: '', bundesliga: '', ligue1: '' }
    };
    renderSeasonSetup();
    const setup = document.getElementById('season-setup');
    const dash = document.getElementById('season-dashboard');
    if (setup) setup.style.display = 'block';
    if (dash) dash.style.display = 'none';
    toast('Season reset');
    persistAll();
  }

  function showSeasonComp(key) {
    seasonActiveTab = key;
    seasonActiveSubTab = 'table';
    renderSeasonDashboard();
  }

  function showSeasonSubTab(key) {
    seasonActiveSubTab = key;
    renderSeasonDashboard();
  }


  // Repeating 5-slot fixture-congestion pattern: Sat league, Tue continental,
  // Sat league, Tue domestic cup, Sun league — the busy week-to-week rhythm
  // real top-flight calendars follow. `season.daySlot` tracks the season's
  // actual position in this cycle (separate from the Matchday/round counter)
  // and is what real play is gated against — see seasonCompCanPlayNow and
  // advanceCongestionSlotIfComplete. Domestic cup isn't an implemented
  // competition yet, so that slot is auto-skipped and shown greyed-out
  // rather than pretending a cup fixture exists.
  const FIXTURE_CONGESTION_CYCLE = [
    { day: 'Sat', comp: 'League' },
    { day: 'Tue', comp: 'UCL' },
    { day: 'Sat', comp: 'League' },
    { day: 'Tue', comp: 'Cup' },
    { day: 'Sun', comp: 'League' }
  ];

  function currentCongestionSlot() {
    const cyc = FIXTURE_CONGESTION_CYCLE;
    const base = (season && typeof season.daySlot === 'number') ? season.daySlot : 0;
    const idx = ((base % cyc.length) + cyc.length) % cyc.length;
    return cyc[idx];
  }

  // Which season competition keys are eligible to play under a given
  // congestion slot's competition label — 'League' covers all five
  // domestic leagues at once (they're not individually staggered), 'UCL'
  // is just the Champions League, and 'Cup' never resolves to anything
  // since that competition isn't implemented yet.
  function seasonKeysForCongestionComp(compLabel) {
    if (compLabel === 'League') return SEASON_LEAGUE_DEFS.map(d => d.key);
    if (compLabel === 'UCL') return ['ucl'];
    return [];
  }

  // Every fixture still due for TODAY's congestion slot specifically —
  // narrower than seasonMatchesDue(), which covers every competition due
  // for the current matchday regardless of which day's slot they belong to.
  function seasonSlotMatchesDue() {
    if (!season) return [];
    const keys = new Set(seasonKeysForCongestionComp(currentCongestionSlot().comp));
    return seasonMatchesDue().filter(d => keys.has(d.compKey));
  }

  // Moves the season on to the next day in the congestion cycle once
  // nothing due today is left to play — auto-skipping the Cup slot (never
  // has fixtures) so the cycle never stalls waiting on an unimplemented
  // competition.
  function advanceCongestionSlotIfComplete() {
    if (!season) return;
    if (typeof season.daySlot !== 'number') season.daySlot = 0;
    let guard = 0;
    while (guard++ < FIXTURE_CONGESTION_CYCLE.length) {
      const slot = currentCongestionSlot();
      if (slot.comp !== 'Cup' && seasonSlotMatchesDue().length) break;
      season.daySlot++;
    }
  }

  function fixtureCongestionSlot(offset) {
    const cyc = FIXTURE_CONGESTION_CYCLE;
    const base = (season && typeof season.daySlot === 'number') ? season.daySlot : 0;
    const idx = ((base + offset) % cyc.length + cyc.length) % cyc.length;
    return cyc[idx];
  }

  function renderFixtureCongestionHTML() {
    if (!season) return '';
    const uclDone = season.ucl && season.ucl.finished;
    const items = [0, 1, 2, 3, 4].map(i => {
      const slot = fixtureCongestionSlot(i);
      const isCup = slot.comp === 'Cup';
      const isUcl = slot.comp === 'UCL';
      const disabled = isCup || (isUcl && uclDone);
      const label = isCup ? 'Cup' : slot.comp;
      const sub = isCup ? 'not available' : (isUcl && uclDone) ? 'finished' : '';
      const cls = 'congestion-slot' + (i === 0 ? ' congestion-now' : '') + (disabled ? ' congestion-disabled' : '');
      const title = isCup ? 'Domestic cup competition is not available yet' : (slot.day + ' — ' + slot.comp);
      return `<div class="${cls}" title="${title}">
        <div class="congestion-day">${slot.day}</div>
        <div class="congestion-comp">${label}</div>
        ${sub ? `<div style="font-size:0.62rem;color:var(--text-muted)">${sub}</div>` : ''}
      </div>`;
    });
    const strip = items.join('<div class="congestion-arrow">→</div>');
    return `<div style="font-size:0.7rem;letter-spacing:1px;color:var(--text-muted);text-transform:uppercase;margin-top:14px">📅 Fixture Congestion</div>
      <div class="congestion-strip">${strip}</div>`;
  }
  function renderSeasonDashboard() {
    if (!season) return;
    seasonReportRegistry = []; // rebuilt fresh each render so onclick indices stay valid
    const title = document.getElementById('season-status-title');
    if (title) title.textContent = 'Year ' + season.year + ' · Matchday ' + season.week;
    const congestionEl = document.getElementById('season-congestion');
    if (congestionEl) congestionEl.innerHTML = renderFixtureCongestionHTML();
    const dueEl = document.getElementById('season-due-banner');
    if (dueEl) {
      const due = seasonMatchesDue();
      if (due.length) {
        const byComp = {};
        due.forEach(d => { (byComp[d.compName] = byComp[d.compName] || []).push(d.home + ' vs ' + d.away); });
        const lines = Object.keys(byComp).map(name => `<div style="margin-top:2px"><strong>${name}:</strong> ${byComp[name].join(', ')}</div>`).join('');
        dueEl.innerHTML = `<div class="empty-state" style="text-align:left;padding:10px 14px;margin-top:10px;border:1px solid var(--accent-gold);border-radius:8px">
          <div style="font-size:0.8rem;color:var(--accent-gold)">⏳ Matchday ${season.week + 1} isn't complete yet — ${due.length} match${due.length === 1 ? '' : 'es'} still due before the day can change:</div>
          ${lines}
        </div>`;
      } else {
        dueEl.innerHTML = '';
      }
    }
    const tabsEl = document.getElementById('season-comp-tabs');
    if (tabsEl) {
      const tabs = [...SEASON_LEAGUE_DEFS, { key: 'ucl', name: 'Champions League' }, { key: 'trophies', name: '🏆 Trophy Room' }];
      tabsEl.innerHTML = tabs.map(def => {
        const comp = def.key === 'ucl' ? season.ucl : (def.key === 'trophies' ? null : season.leagues[def.key]);
        const flag = comp && comp.finished ? ' 🏆' : '';
        return `<button class="lb-tab ${seasonActiveTab === def.key ? 'active' : ''}" onclick="App.showSeasonComp('${def.key}')">${def.name}${flag}</button>`;
      }).join('');
    }
    const contentEl = document.getElementById('season-comp-content');
    if (!contentEl) return;
    if (seasonActiveTab === 'trophies') {
      contentEl.innerHTML = renderSeasonTrophyRoomHTML();
      return;
    }
    const comp = seasonActiveTab === 'ucl' ? season.ucl : season.leagues[seasonActiveTab];
    if (!comp) { contentEl.innerHTML = ''; return; }
    if (!comp.stats) comp.stats = blankCompStats();

    const subTabs = [
      { key: 'table', name: 'Table & Fixtures' },
      { key: 'stats', name: 'Stats' },
      { key: 'awards', name: 'Awards' }
    ];
    let h = '<div class="leaderboard-tabs" style="margin-bottom:12px">' + subTabs.map(st =>
      `<button class="lb-tab ${seasonActiveSubTab === st.key ? 'active' : ''}" onclick="App.showSeasonSubTab('${st.key}')">${st.name}</button>`
    ).join('') + '</div>';

    if (seasonActiveSubTab === 'stats') {
      h += renderCompStatsHTML(comp);
    } else if (seasonActiveSubTab === 'awards') {
      h += renderCompAwardsHTML(comp);
    } else {
      h += seasonActiveTab === 'ucl' ? renderUCLSeasonHTML(comp) : renderLeagueCompHTML(comp, seasonActiveTab);
    }
    contentEl.innerHTML = h;
  }

  // ---------- per-competition stats & awards (Season Calendar) ----------
  function compStatTop(comp, key, n) {
    return Object.values((comp.stats && comp.stats[key]) || {}).sort((a, b) => b.count - a.count).slice(0, n || 10);
  }

  function compApps(comp, playerId) {
    const r = comp.stats && comp.stats.ratings && comp.stats.ratings[playerId];
    return r ? r.count : 0;
  }

  function renderCompStatTable(comp, title, icon, rows, colLabel) {
    if (!rows.length) {
      return `<div class="group-card" style="margin-bottom:14px"><h4>${icon} ${title}</h4><div class="empty-state" style="padding:16px 0"><p>No data yet — simulate some matchdays.</p></div></div>`;
    }
    return `<div class="group-card" style="margin-bottom:14px"><h4>${icon} ${title}</h4>
      <div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Apps</th><th>${colLabel}</th></tr></thead><tbody>
      ${rows.map((p, i) => `<tr class="${i<3?'lb-row-top rank-'+(i+1):''}"><td class="lb-rank">${rankBadge(i)}</td><td class="lb-player">${lbPlayerCell(p)}</td><td class="lb-team">${p.team}</td><td>${compApps(comp, p.id)}</td><td style="font-weight:700;color:var(--accent-gold)">${p.count}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  }

  function renderCompStatsHTML(comp) {
    let h = '<div class="group-card league-table-wrap" style="margin-bottom:14px"><h4>' + comp.name + ' — Season Stats</h4>' +
      '<p style="font-size:0.8rem;color:var(--text-muted)">Top performers across every matchday played in this competition so far.</p></div>';
    h += renderCompStatTable(comp, 'Top Scorers', emojiImg('goal', 'Goal'), compStatTop(comp, 'goals', 15), 'Goals');
    h += renderCompStatTable(comp, 'Top Assists', emojiImg('assist', 'Assist'), compStatTop(comp, 'assists', 15), 'Assists');
    h += renderCompStatTable(comp, 'Most Saves', '🧤', compStatTop(comp, 'saves', 15), 'Saves');
    h += renderCompStatTable(comp, 'Clean Sheets', '🛡️', compStatTop(comp, 'cleanSheets', 15), 'Clean Sheets');
    h += renderCompStatTable(comp, 'Yellow Cards', emojiImg('yellow_card', 'Yellow card'), compStatTop(comp, 'yellows', 15), 'Yellows');
    h += renderCompStatTable(comp, 'Red Cards', emojiImg('red_card', 'Red card'), compStatTop(comp, 'reds', 15), 'Reds');
    return h;
  }

  function assignCompAwards(comp) {
    const goals = compStatTop(comp, 'goals', 50);
    const assists = compStatTop(comp, 'assists', 50);
    const saves = compStatTop(comp, 'saves', 50);
    const cleanSheets = compStatTop(comp, 'cleanSheets', 50);
    const motm = compStatTop(comp, 'motm', 50);
    const ratingsAny = Object.values((comp.stats && comp.stats.ratings) || {})
      .filter(x => (x.count || 0) > 0)
      .sort((a, b) => b.avg - a.avg || b.count - a.count);
    comp.awards = {
      goldenBoot: goals[0] || null,
      goldenGlove: saves[0] || null,
      goldenClean: cleanSheets[0] || null,
      topAssists: assists[0] || null,
      mostMotm: motm[0] || null,
      bestAvgRating: ratingsAny[0] || null,
      champion: comp.champion || null
    };
    return comp.awards;
  }

  function renderCompAwardsHTML(comp) {
    const a = assignCompAwards(comp);
    const card = (title, icon, p, extra) => {
      const titleHtml = `<div class="am-title">${trophyMark(title, 32)} ${title}</div>`;
      if (!p) return `<div class="award-mini">${titleHtml}<div class="am-empty">TBD</div></div>`;
      return `<div class="award-mini">${titleHtml}
        ${lbAvatar(p, 44)}
        <div class="am-name">${playerNameHTML(p)}</div>
        <div class="am-meta">${p.team || ''} · ${extra}</div></div>`;
    };
    let h = '<div class="card-title">' + comp.name + ' Awards' + (comp.finished ? ' (Final)' : ' (In Progress)') + '</div>';
    h += `<div class="awards-row">
      ${card('Golden Boot', '👟', a.goldenBoot, (a.goldenBoot && a.goldenBoot.count) + ' goals')}
      ${card('Top Assists', '🎯', a.topAssists, (a.topAssists && a.topAssists.count) + ' assists')}
      ${card('Golden Glove', '🧤', a.goldenGlove, (a.goldenGlove && a.goldenGlove.count) + ' saves')}
      ${card('Clean Sheet King', '🛡️', a.goldenClean, (a.goldenClean && a.goldenClean.count) + ' clean sheets')}
      ${card('Most MOTM', '⭐', a.mostMotm, (a.mostMotm && a.mostMotm.count) + ' MOTM')}
      ${card('Best Avg Rating', '📈', a.bestAvgRating, a.bestAvgRating ? (a.bestAvgRating.avg != null ? a.bestAvgRating.avg.toFixed(2) : '—') + ' (' + a.bestAvgRating.count + ' apps)' : '')}
    </div>`;
    if (a.champion) {
      h += `<div class="award-card" style="margin-top:14px">${trophyMark(comp.name, 68)}<div class="award-info"><h4>${comp.name} Champion</h4><p class="award-winner">${teamMark(a.champion, 18) + ' ' + a.champion.name}</p></div></div>`;
    } else {
      h += '<p style="color:var(--text-muted);font-size:0.85rem;margin-top:10px">Champion will be crowned once the competition finishes.</p>';
    }
    return h;
  }

  // Season-scoped trophy room: shows only trophies won inside this save's season
  // play (domestic leagues + Champions League), grouped by year, newest first.
  function renderSeasonTrophyRoomHTML() {
    const seasonTrophies = trophies.filter(t => /^(League|Season)\s*\(Y\d+\)$/.test(t.type));
    if (!seasonTrophies.length) {
      return '<div class="empty-state"><div class="icon">🏆</div><p>No season trophies yet — simulate matchdays until a league or the Champions League finishes.</p></div>';
    }
    const byYear = {};
    seasonTrophies.forEach(t => {
      const m = t.type.match(/Y(\d+)/);
      const y = m ? m[1] : '?';
      if (!byYear[y]) byYear[y] = [];
      byYear[y].push(t);
    });
    const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));
    let h = '<div class="card-title">🏆 Season Trophy Room</div>';
    years.forEach(y => {
      h += `<div class="group-card" style="margin-bottom:14px"><h4>Year ${y}</h4>` +
        byYear[y].map(t => `<div class="award-card">${trophyMark(t.name, 68)}<div class="award-info"><h4>${t.name}</h4><p class="award-winner">${t.team}</p></div></div>`).join('') +
        '</div>';
    });
    return h;
  }

  function renderStandingsTable(comp, highlightTop) {
    const sorted = sortedTable(comp.table);
    let h = '<table class="group-table"><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>';
    sorted.forEach((r, i) => {
      const gd = r.gf - r.ga;
      const mark = (highlightTop && i < highlightTop) ? ' style="background:rgba(0,200,83,0.12)"' : '';
      h += `<tr${mark}><td>${i + 1}</td><td>${teamMark(r.team, 16)} ${r.team.name}</td><td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td><td>${r.gf}</td><td>${r.ga}</td><td>${gd}</td><td><b>${r.pts}</b></td></tr>`;
    });
    h += '</tbody></table>';
    return h;
  }

  function renderFixtureList(comp, compKey) {
    const rounds = comp.rounds || [];
    const currentRound = rounds[comp.currentRound] || [];
    const currentUnplayed = comp.finished ? [] : currentRound.filter(f => !f.played);
    const laterUnplayed = [];
    if (!comp.finished) {
      for (let r = comp.currentRound + 1; r < rounds.length && laterUnplayed.length < 8; r++) {
        (rounds[r] || []).forEach(f => { if (!f.played && laterUnplayed.length < 8) laterUnplayed.push(f); });
      }
    }
    const allFixtures = [].concat(...rounds);
    const played = allFixtures.filter(f => f.played).slice(-8).reverse();
    let h = '';
    if (currentUnplayed.length) {
      const canPlay = seasonCompCanPlayNow(compKey, comp);
      h += `<div class="card-title" style="margin-top:12px">Matchday ${comp.currentRound + 1} — ${canPlay ? 'Play Now' : 'Waiting on other competitions'}</div>`;
      if (!canPlay) {
        h += `<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px">${comp.name} has finished this matchday already — it can't start the next one until every other competition catches up. See the notice above for what's still due.</div>`;
      }
      currentUnplayed.forEach(f => {
        const home = getTeam(f.home), away = getTeam(f.away);
        if (!home || !away) return;
        const idx = currentRound.indexOf(f);
        h += `<div class="fixture-item"><span class="fixture-teams">${teamMark(home, 18)} ${home.short} vs ${teamMark(away, 18)} ${away.short}</span>
          ${canPlay
            ? `<button class="btn btn-primary btn-sm" onclick="App.playSeasonFixture('${compKey}',${idx})">▶ Play Live</button>
          <button class="btn btn-secondary btn-sm" onclick="App.simSeasonFixture('${compKey}',${idx})">⚡ Instant</button>`
            : `<button class="btn btn-secondary btn-sm" disabled>⏳ Not due yet</button>`}</div>`;
      });
    }
    if (laterUnplayed.length) {
      h += '<div class="card-title" style="margin-top:12px">Upcoming</div>';
      laterUnplayed.forEach(f => {
        const home = getTeam(f.home), away = getTeam(f.away);
        if (!home || !away) return;
        h += `<div class="fixture-item"><span class="fixture-teams">${teamMark(home, 18)} ${home.short} vs ${teamMark(away, 18)} ${away.short}</span></div>`;
      });
    }
    if (played.length) {
      h += '<div class="card-title" style="margin-top:12px">Recent Results</div>';
      played.forEach(f => {
        const home = getTeam(f.home), away = getTeam(f.away);
        if (!home || !away) return;
        const reportIdx = f.report ? seasonReportRegistry.push(f.report) - 1 : -1;
        h += `<div class="fixture-item played" style="cursor:${reportIdx >= 0 ? 'pointer' : 'default'}" ${reportIdx >= 0 ? `onclick="App.viewSeasonReport(${reportIdx})"` : ''}>
          <span class="fixture-teams">${teamMark(home, 18)} ${home.short} ${f.homeScore}-${f.awayScore} ${teamMark(away, 18)} ${away.short}</span>
          ${reportIdx >= 0 ? '<span style="font-size:0.7rem;color:var(--accent-gold)">Details</span>' : ''}</div>`;
      });
    }
    return h;
  }

  function renderLeagueCompHTML(comp, compKey) {
    let h = '<div class="group-card league-table-wrap">';
    h += '<h4>' + comp.name + (comp.finished ? ' — Champion: ' + (comp.champion ? teamMark(comp.champion, 18) + ' ' + comp.champion.name : '—') : '') + '</h4>';
    h += renderStandingsTable(comp, UCL_QUALIFY_PER_LEAGUE);
    h += `<p style="font-size:0.75rem;color:var(--text-muted);margin-top:6px">Green: top ${UCL_QUALIFY_PER_LEAGUE} qualify for next season's Champions League</p>`;
    h += '</div>';
    h += renderFixtureList(comp, compKey);
    return h;
  }

  function renderKnockoutRoundHTML(title, ko) {
    if (!ko) return '';
    let h = '<div class="card-title" style="margin-top:12px">' + title + '</div>';
    ko.fixtures.forEach(f => {
      const home = getTeam(f.home), away = getTeam(f.away);
      if (!home || !away) return;
      if (!f.played) {
        h += `<div class="fixture-item"><span class="fixture-teams">${teamMark(home, 18)} ${home.short} vs ${teamMark(away, 18)} ${away.short}</span></div>`;
      } else {
        const reportIdx = f.report ? seasonReportRegistry.push(f.report) - 1 : -1;
        const pensTxt = f.pens ? ` (pens ${f.pens.home}-${f.pens.away})` : '';
        const winner = getTeam(f.winnerId);
        h += `<div class="fixture-item played" style="cursor:${reportIdx >= 0 ? 'pointer' : 'default'}" ${reportIdx >= 0 ? `onclick="App.viewSeasonReport(${reportIdx})"` : ''}>
          <span class="fixture-teams">${teamMark(home, 18)} ${home.short} ${f.homeScore}-${f.awayScore} ${teamMark(away, 18)} ${away.short}${pensTxt} <small style="color:var(--accent-gold)">→ ${winner ? winner.short : '?'}</small></span></div>`;
      }
    });
    return h;
  }

  function renderUCLSeasonHTML(comp) {
    let h = '<div class="group-card league-table-wrap">';
    h += '<h4>' + comp.name + (comp.finished ? ' — Champion: ' + (comp.champion ? teamMark(comp.champion, 18) + ' ' + comp.champion.name : '—') : '') + '</h4>';
    if (comp.stage === 'league' || !comp.bracketSize) {
      h += renderStandingsTable(comp, comp.teams.length >= 8 ? 8 : comp.teams.length);
      h += '</div>';
      h += renderFixtureList(comp, 'ucl');
    } else {
      h += renderStandingsTable(comp, comp.bracketSize);
      h += '</div>';
      h += renderKnockoutRoundHTML('Quarterfinals', comp.knockout.qf);
      h += renderKnockoutRoundHTML('Semifinals', comp.knockout.sf);
      h += renderKnockoutRoundHTML('Final', comp.knockout.final);
    }
    return h;
  }

  function viewSeasonReport(idx) {
    const report = seasonReportRegistry[idx];
    if (!report) { toast('No detailed report for this match'); return; }
    showMatchReport(report, null);
  }

  function goToSquadBuilder() {
    switchView('match');
    const setup = document.getElementById('match-setup');
    const live = document.getElementById('match-live');
    if (setup) setup.style.display = 'block';
    if (live) live.style.display = 'none';
    window._tourFixtureIdx = null;
    window._uclFixtureIdx = null;
    window._koRoundIdx = null;
    window._koMatchIdx = null;
    window._fromTournament = false;
    window._seasonFixture = null;
    window._backTarget = null;
    currentSeasonComp = null;
    toast('Pick teams & formations, then Kick Off. Lineups are auto-built by formation.');
  }

  // ========== TEAM MATCH LOG ==========
  // teamMatchLog[teamId] -> array of entries, newest first, capped per
  // team so persisted save size stays bounded. Populated at full-time for
  // both sides — see recordTeamMatchLog() in engine/matchEngine.js.
  //
  // Current entries are compact arrays: [opponentTeamId, competition,
  // scoreFor, scoreAgainst]. Opponent name/short/logo/flag are looked up
  // from opponentTeamId via getTeam(), and the W/D/L result tag is derived
  // from scoreFor vs scoreAgainst, instead of persisting all of that on
  // every entry (see readTeamLogEntry()).
  //
  // Saves made before this format change still have plain objects
  // ({opponent, opponentShort, opponentLogo, opponentFlag, competition,
  // scoreFor, scoreAgainst, result}) sitting in the 30-entry cap — those
  // age out naturally as new matches are recorded, and readTeamLogEntry()
  // understands both shapes in the meantime so old saves keep rendering.
  let teamMatchLog = {};


  const TML_OPP = 0, TML_COMP = 1, TML_FOR = 2, TML_AGAINST = 3;

  // Normalizes one teamMatchLog entry (new compact array OR legacy
  // object) into a plain object the renderer can use uniformly.
  function readTeamLogEntry(e) {
    if (Array.isArray(e)) {
      const opp = getTeam(e[TML_OPP]);
      const scoreFor = e[TML_FOR], scoreAgainst = e[TML_AGAINST];
      return {
        opponentShort: (opp && (opp.short || opp.name)) || '—',
        opponentLogo: opp ? opp.logo : null,
        opponentFlag: opp ? opp.flag : null,
        competition: e[TML_COMP],
        scoreFor: scoreFor,
        scoreAgainst: scoreAgainst,
        result: scoreFor > scoreAgainst ? 'W' : scoreFor < scoreAgainst ? 'L' : 'D'
      };
    }
    // Legacy object-shaped entry from a pre-format-change save.
    return {
      opponentShort: e.opponentShort || e.opponent || '—',
      opponentLogo: e.opponentLogo,
      opponentFlag: e.opponentFlag,
      competition: e.competition,
      scoreFor: e.scoreFor,
      scoreAgainst: e.scoreAgainst,
      result: e.result
    };
  }


  // Renders a team's recent-results log (last 10) with a colored W/D/L tag
  // per row and the opponent's logo + abbreviation. Shares the same
  // "Match Log" look as renderPlayerMatchLogHTML in ui/playersUI.js, and is
  // dropped straight into the team profile modal — see showTeamProfile()
  // in ui/playerUI.js.
  function renderTeamMatchLogHTML(teamId) {
    const log = teamMatchLog[teamId] || [];
    if (!log.length) return '';
    const resultClass = { W: 'result-w', D: 'result-d', L: 'result-l' };
    const rows = log.slice(0, 10).map(raw => {
      const e = readTeamLogEntry(raw);
      const oppMark = teamMark({ logo: e.opponentLogo, flag: e.opponentFlag }, 18);
      return `<div class="team-log-row">
        <span class="result-tag ${resultClass[e.result] || 'result-d'}">${e.result}</span>
        <span class="tlr-opp">${oppMark}<span class="tlr-opp-abbr">${e.opponentShort}</span></span>
        <span class="tlr-score">${e.scoreFor}-${e.scoreAgainst}</span>
        <span class="tlr-comp">${e.competition || ''}</span>
      </div>`;
    }).join('');
    return `<div class="card-title" style="margin-top:14px">Match Log <span style="color:var(--text-muted);font-weight:400;font-size:0.72rem">(last ${Math.min(log.length, 10)})</span></div>
      <div class="match-log-wrap">${rows}</div>`;
  }


  // ========== PLAYERS TAB ==========
  // Flat, lazily-rendered list of every player across all teams. All players
  // already live in memory via teamsData (loaded once from teams.json), so
  // nothing extra is fetched here — the performance concern with ~5,500
  // players is DOM size, not data size. So we only ever render a bounded
  // "page" of rows at a time (playersShown), growing it on Load More,
  // instead of ever putting every player into the DOM at once.
  let playersFilter = 'all';       // 'all' | 'national' | 'club'
  let playersPosFilter = 'all';    // 'all' | 'GK' | 'DEF' | 'MID' | 'FWD'
  let playersSearch = '';
  let playersSort = 'ovr';
  const PLAYERS_PAGE_SIZE = 40;
  let playersShown = PLAYERS_PAGE_SIZE;
  let playersCompareMode = false;
  let playersCompareSelection = []; // up to 3 player ids
  let _allPlayersFlatCache = null;
  const PLAYERS_COMPARE_MAX = 3;


  // Builds (once, cached) a flat [{player, team, isNational, hasClub,
  // hasNational, clubTeam, nationalTeam}] list across every team. Cheap —
  // teamsData is already fully resident in memory — rendering is where the
  // actual cost lives, and that's handled separately by windowing (see
  // renderPlayersList).
  //
  // A real player who shows up on both a national side and a club (same id,
  // same name — see repairDuplicatePlayerIds() in ui/matchUI.js, which has
  // already split off any *accidental* id collisions between different
  // players before this ever runs) is merged into a single entry here
  // instead of appearing as two separate rows, with both team references
  // attached so the UI can show "Club · Country" together. The club
  // appearance is preferred as the entry's primary `player`/`team` (richer
  // data — logo, stadium, etc.) when both exist.
  function getAllPlayersFlat() {
    if (_allPlayersFlatCache) return _allPlayersFlatCache;
    const byId = {};
    const order = [];
    (teamsData.national || []).forEach(t => (t.players || []).forEach(p => {
      if (!p || !p.id) return;
      if (!byId[p.id]) {
        byId[p.id] = { player: p, team: t, isNational: true, hasNational: true, hasClub: false, nationalTeam: t, clubTeam: null };
        order.push(p.id);
      } else {
        byId[p.id].hasNational = true;
        byId[p.id].nationalTeam = t;
      }
    }));
    (teamsData.club || []).forEach(t => (t.players || []).forEach(p => {
      if (!p || !p.id) return;
      if (!byId[p.id]) {
        byId[p.id] = { player: p, team: t, isNational: false, hasNational: false, hasClub: true, nationalTeam: null, clubTeam: t };
        order.push(p.id);
      } else {
        byId[p.id].hasClub = true;
        byId[p.id].clubTeam = t;
        // Prefer the club appearance as the primary display record.
        byId[p.id].player = p;
        byId[p.id].team = t;
        byId[p.id].isNational = false;
      }
    }));
    const flat = order.map(id => byId[id]);
    _allPlayersFlatCache = flat;
    return flat;
  }

  // Both team affiliations (club/national) for a merged player entry, or
  // nulls if that side doesn't exist for this player. Used to show "Club ·
  // Country" together wherever a player's team affiliation is displayed.
  function getPlayerAffiliations(playerId) {
    const e = getPlayerTeamIndex()[playerId];
    if (!e) return { club: null, national: null };
    return { club: e.clubTeam || null, national: e.nationalTeam || null };
  }


  // id -> {player, team} lookup index, built once (lazily, cached) off of
  // getAllPlayersFlat(). findPlayerAndTeam used to do a fresh linear scan
  // across every team's full roster on every single call — with ~5,500
  // players that added up fast anywhere it ran per-row (player profile
  // opens, leaderboards, name-highlight lookups), which was a real
  // contributor to the app feeling laggy. Same invalidation lifetime as
  // _allPlayersFlatCache above (built once per loaded roster).
  let _playerTeamIndexCache = null;
  function getPlayerTeamIndex() {
    if (_playerTeamIndexCache) return _playerTeamIndexCache;
    const idx = {};
    getAllPlayersFlat().forEach((e) => { idx[e.player.id] = e; });
    _playerTeamIndexCache = idx;
    return idx;
  }

  // Shared player+team lookup, also used by showPlayerProfile. O(1) via
  // getPlayerTeamIndex() instead of scanning every team's roster.
  function findPlayerAndTeam(playerId) {
    const e = getPlayerTeamIndex()[playerId];
    return e ? { player: e.player, team: e.team } : null;
  }


  function playerCareerCount(bucket, playerId) {
    return ((stats[bucket] || {})[playerId] || {}).count || 0;
  }


  function getFilteredSortedPlayers() {
    let list = getAllPlayersFlat();
    // hasNational/hasClub (not the single isNational flag) so a merged
    // player who appears on both sides still shows up under either filter.
    if (playersFilter === 'national') list = list.filter(e => e.hasNational);
    else if (playersFilter === 'club') list = list.filter(e => e.hasClub);
    if (playersPosFilter !== 'all') {
      list = list.filter(e => POS_LINE[(e.player.pos || [])[0]] === playersPosFilter);
    }
    if (playersSearch) {
      list = list.filter(e => {
        const p = e.player;
        const skills = (p.expandedAttrs && p.expandedAttrs.skills) || [];
        const styles = (p.expandedAttrs && p.expandedAttrs.playstyle) || [];
        return (p.name || '').toLowerCase().includes(playersSearch) ||
          (e.team.name || '').toLowerCase().includes(playersSearch) ||
          (e.team.short || '').toLowerCase().includes(playersSearch) ||
          skills.some(s => s.toLowerCase().includes(playersSearch)) ||
          styles.some(s => s.toLowerCase().includes(playersSearch));
      });
    }
    list = [...list];
    if (playersSort === 'name') list.sort((a, b) => (a.player.name || '').localeCompare(b.player.name || ''));
    else if (playersSort === 'goals') list.sort((a, b) => playerCareerCount('goals', b.player.id) - playerCareerCount('goals', a.player.id));
    else if (playersSort === 'assists') list.sort((a, b) => playerCareerCount('assists', b.player.id) - playerCareerCount('assists', a.player.id));
    else if (playersSort === 'apps') list.sort((a, b) => playerCareerCount('ratings', b.player.id) - playerCareerCount('ratings', a.player.id));
    else if (playersSort === 'age') {
      // Age/height only exist on the expanded attribute sheet, so players
      // without one sort to the bottom regardless of direction rather than
      // clumping at either end as false zeros.
      list.sort((a, b) => {
        const av = a.player.expandedAttrs && a.player.expandedAttrs.age;
        const bv = b.player.expandedAttrs && b.player.expandedAttrs.age;
        if (typeof av !== 'number' && typeof bv !== 'number') return 0;
        if (typeof av !== 'number') return 1;
        if (typeof bv !== 'number') return -1;
        return av - bv;
      });
    }
    else if (playersSort === 'height') {
      list.sort((a, b) => {
        const av = a.player.expandedAttrs && a.player.expandedAttrs.height_cm;
        const bv = b.player.expandedAttrs && b.player.expandedAttrs.height_cm;
        if (typeof av !== 'number' && typeof bv !== 'number') return 0;
        if (typeof av !== 'number') return 1;
        if (typeof bv !== 'number') return -1;
        return bv - av;
      });
    }
    else if (playersSort === 'liveRating') {
      // Best current form first (A > B > C > D > E — see LIVE_RATINGS /
      // ensurePlayerConditionProfile() in engine/form.js). Ties (e.g. two
      // players both on "B") fall back to OVR so the order still feels
      // stable and meaningful within a tier.
      const TIER_RANK = { A: 5, B: 4, C: 3, D: 2, E: 1 };
      list.sort((a, b) => {
        ensurePlayerConditionProfile(a.player);
        ensurePlayerConditionProfile(b.player);
        const av = TIER_RANK[a.player.liveRating] || 0;
        const bv = TIER_RANK[b.player.liveRating] || 0;
        if (bv !== av) return bv - av;
        return (b.player.ovr || 0) - (a.player.ovr || 0);
      });
    }
    else list.sort((a, b) => (b.player.ovr || 0) - (a.player.ovr || 0));
    return list;
  }


  // Debounced — getFilteredSortedPlayers() filters/sorts the entire player
  // pool (every squad across every team) on each call, which is expensive
  // enough that running it on every keystroke was the main source of
  // typing lag on the Players page.
  const _debouncedRenderPlayersListReset = debounce(() => renderPlayersList(true), 150);
  function searchPlayers(q) {
    playersSearch = (q || '').trim().toLowerCase();
    _debouncedRenderPlayersListReset();
  }


  function sortPlayers(mode) {
    playersSort = mode || 'ovr';
    renderPlayersList(true);
  }


  function filterPlayersPos(pos) {
    playersPosFilter = pos || 'all';
    renderPlayersList(true);
  }


  function filterPlayersType(type) {
    playersFilter = type || 'all';
    renderPlayersList(true);
  }


  function loadMorePlayers() {
    playersShown += PLAYERS_PAGE_SIZE;
    renderPlayersList(false);
  }


  function renderPlayerRow(entry) {
    const p = entry.player, t = entry.team;
    const selected = playersCompareSelection.indexOf(p.id) !== -1;
    const clickAction = playersCompareMode ? `App.togglePlayerCompare('${p.id}')` : `App.showPlayerProfile('${p.id}')`;
    const primary = t.color || '#d4af37';
    // Age/height only exist on the expanded attribute sheet — shown inline
    // only for those players so the Age/Height sort options have a visible
    // reference point in the list itself.
    const attr = p.expandedAttrs;
    const bioBit = attr && (typeof attr.age === 'number' || typeof attr.height_cm === 'number')
      ? ` · ${typeof attr.age === 'number' ? attr.age + 'y' : ''}${(typeof attr.age === 'number' && typeof attr.height_cm === 'number') ? ' · ' : ''}${typeof attr.height_cm === 'number' ? Math.round(attr.height_cm) + 'cm' : ''}`
      : '';
    // A merged player (same real person on both a club and a national
    // side) shows both affiliations together instead of just one.
    const teamLine = (entry.clubTeam && entry.nationalTeam)
      ? `${teamMark(entry.clubTeam, 14)}<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${entry.clubTeam.short || entry.clubTeam.name}</span> · ${teamMark(entry.nationalTeam, 14)}<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${entry.nationalTeam.short || entry.nationalTeam.name}</span>`
      : `${teamMark(t, 14)}<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.short || t.name}</span>`;
    return `<div class="team-check${selected ? ' selected' : ''}" style="cursor:pointer;border-left:3px solid ${primary}" onclick="${clickAction}">
      <div style="display:flex;align-items:center;gap:8px;width:100%">
        <span class="tsr-avatar" style="width:36px;height:36px;flex-shrink:0">${playerAvatarMark(p)}</span>
        <div style="flex:1;min-width:0">
          <strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${playerNameHTML(p)}</strong>
          <div style="font-size:0.75rem;color:var(--text-2);display:flex;align-items:center;gap:4px">${teamLine} · ${(p.pos || [])[0] || ''}${bioBit}</div>
        </div>
        ${playersCompareMode ? `<span class="compare-check${selected ? ' checked' : ''}">${selected ? '✓' : ''}</span>` : ''}
        ${formArrow(p)}
        <span class="player-ovr">${p.ovr || ''}</span>
      </div>
    </div>`;
  }


  function renderPlayersList(reset) {
    if (reset) playersShown = PLAYERS_PAGE_SIZE;
    const list = getFilteredSortedPlayers();
    const el = document.getElementById('players-list');
    if (!el) return;
    const countEl = document.getElementById('players-count');
    if (countEl) countEl.textContent = list.length ? `${list.length} player${list.length === 1 ? '' : 's'} · showing ${Math.min(playersShown, list.length)}` : '';
    if (!list.length) {
      el.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><p>No players match your search.</p></div>';
      const moreBtn = document.getElementById('players-load-more');
      if (moreBtn) moreBtn.style.display = 'none';
      return;
    }
    const slice = list.slice(0, playersShown);
    el.innerHTML = slice.map(renderPlayerRow).join('');
    const moreBtn = document.getElementById('players-load-more');
    if (moreBtn) moreBtn.style.display = list.length > playersShown ? 'inline-flex' : 'none';
  }


  // ========== PLAYER COMPARISON ==========
  function togglePlayersCompareMode() {
    playersCompareMode = !playersCompareMode;
    if (!playersCompareMode) playersCompareSelection = [];
    const btn = document.getElementById('players-compare-toggle');
    if (btn) btn.classList.toggle('active', playersCompareMode);
    const tray = document.getElementById('players-compare-tray');
    const actions = document.getElementById('players-compare-actions');
    if (tray) tray.style.display = playersCompareMode ? 'flex' : 'none';
    if (actions) actions.style.display = playersCompareMode ? 'flex' : 'none';
    renderPlayersCompareTray();
    renderPlayersList(false);
  }


  function togglePlayerCompare(playerId) {
    const idx = playersCompareSelection.indexOf(playerId);
    if (idx !== -1) {
      playersCompareSelection.splice(idx, 1);
    } else {
      if (playersCompareSelection.length >= PLAYERS_COMPARE_MAX) {
        toast(`You can compare up to ${PLAYERS_COMPARE_MAX} players — remove one first`);
        return;
      }
      playersCompareSelection.push(playerId);
    }
    renderPlayersCompareTray();
    renderPlayersList(false);
  }


  function clearPlayersCompare() {
    playersCompareSelection = [];
    renderPlayersCompareTray();
    renderPlayersList(false);
  }


  function renderPlayersCompareTray() {
    const tray = document.getElementById('players-compare-tray');
    const goBtn = document.getElementById('players-compare-go');
    if (goBtn) goBtn.disabled = playersCompareSelection.length < 2;
    if (!tray) return;
    if (!playersCompareSelection.length) {
      tray.innerHTML = `<span style="color:var(--text-muted);font-size:0.8rem">Tap players below to add them to comparison (up to ${PLAYERS_COMPARE_MAX})</span>`;
      return;
    }
    tray.innerHTML = playersCompareSelection.map(id => {
      const found = findPlayerAndTeam(id);
      if (!found) return '';
      return `<span class="compare-chip">${teamMark(found.team, 14)} ${playerNameHTML(found.player)}<button type="button" onclick="event.stopPropagation();App.togglePlayerCompare('${id}')" aria-label="Remove ${found.player.name}">✕</button></span>`;
    }).join('');
  }


  function openPlayersCompare() {
    if (playersCompareSelection.length < 2) { toast('Select at least 2 players to compare'); return; }
    renderPlayersCompareView();
    const modal = document.getElementById('compare-modal');
    if (modal) modal.classList.add('active');
  }


  // getVal may return null (attribute doesn't apply to that player, e.g. a
  // GK-only rating for an outfield player) — null values render as '—' and
  // are excluded from the best-value comparison entirely, instead of being
  // coerced to 0 and dragging that player's column down.
  function compareRowsHTML(label, entries, getVal, fmt) {
    const vals = entries.map(e => getVal(e.player));
    let bestIdx = -1, bestVal = -Infinity;
    vals.forEach((v, i) => { if (v != null && v > bestVal) { bestVal = v; bestIdx = i; } });
    const cells = vals.map((v, i) => `<span class="compare-row-val${(i === bestIdx && vals.length > 1 && bestVal > 0) ? ' best' : ''}">${v == null ? '—' : (fmt ? fmt(v) : v)}</span>`).join('');
    return `<div class="compare-row"><span class="compare-row-label">${label}</span>${cells}</div>`;
  }


  // Detailed per-rating comparison for enhanced (expanded-attribute)
  // players — the 25+ individual eFootball-style ratings behind a boosted
  // player's att/def/pac/phy/tec, grouped the same way as the profile page
  // (see EXPANDED_ATTR_GROUPS / expandedAttrRowsHTML in playerUI.js). Only
  // rendered once at least 2 of the compared players actually carry an
  // expandedAttrs sheet — comparing a single enhanced player against
  // regular players' (nonexistent) detailed ratings isn't meaningful.
  // Players without a given rating (e.g. a regular player with no sheet at
  // all, or a GK-only rating for an outfield player) show '—' for that row
  // rather than a misleading overwritten 0.
  function expandedCompareRowsHTML(entries) {
    const enhancedCount = entries.filter(e => e.player.attrBoosted && e.player.expandedAttrs).length;
    if (enhancedCount < 2) return '';
    return EXPANDED_ATTR_GROUPS.map((group) => {
      const rows = group.keys.filter(([k]) => entries.some(e => e.player.expandedAttrs && typeof e.player.expandedAttrs[k] === 'number'));
      if (!rows.length) return '';
      const rowsHTML = rows.map(([k, label]) => compareRowsHTML(label, entries, (p) => {
        return (p.expandedAttrs && typeof p.expandedAttrs[k] === 'number') ? p.expandedAttrs[k] : null;
      })).join('');
      return `<div class="card-title" style="margin-top:14px">${group.label}</div>${rowsHTML}`;
    }).join('');
  }


  // When every compared player lines up on both position and playstyle,
  // the raw attribute rows alone don't answer the question that actually
  // motivated the comparison — "which of these should I pick?" — so this
  // works out a winner (highest OVR) and returns a banner naming them,
  // along with which column header should get the crown highlight. Only
  // enhanced players carry playstyle tags at all, so this only fires when
  // every player in the comparison is enhanced and shares the exact same
  // position and at least one playstyle tag.
  function playersComparePositionMatch(entries) {
    if (entries.length < 2) return null;
    const positions = entries.map(e => (e.player.pos || [])[0] || null);
    if (positions.some(p => !p) || !positions.every(p => p === positions[0])) return null;
    const styleLists = entries.map(e => (e.player.attrBoosted && e.player.expandedAttrs && e.player.expandedAttrs.playstyle) || []);
    if (styleLists.some(list => !list.length)) return null;
    const commonStyles = styleLists.reduce((acc, list) => acc.filter(s => list.includes(s)));
    if (!commonStyles.length) return null;
    let bestIdx = 0;
    entries.forEach((e, i) => { if ((e.player.ovr || 0) > (entries[bestIdx].player.ovr || 0)) bestIdx = i; });
    return { position: positions[0], styles: commonStyles, bestIdx };
  }

  function bestPickBannerHTML(entries, match) {
    if (!match) return '';
    const best = entries[match.bestIdx].player;
    return `<div class="compare-best-pick">🏆 Best pick at <strong>${match.position}</strong> (${match.styles.join(', ')}): ${playerNameHTML(best)} — ${best.ovr || '—'} OVR</div>`;
  }


  function renderPlayersCompareView() {
    const entries = playersCompareSelection.map(findPlayerAndTeam).filter(Boolean);
    const content = document.getElementById('compare-modal-content');
    if (!content || !entries.length) return;
    const n = entries.length;
    const posMatch = playersComparePositionMatch(entries);
    const header = entries.map((e, i) => `<div class="compare-col-head${posMatch && posMatch.bestIdx === i ? ' best' : ''}">
        <div class="profile-avatar" style="width:52px;height:52px;margin:0 auto 6px;background:${e.team.color || '#d4af37'};border:2px solid ${e.team.secondary || '#fff'};color:${e.team.secondary || '#fff'}">${playerAvatarMark(e.player)}</div>
        <div style="font-weight:700;font-size:0.82rem;line-height:1.2">${playerNameHTML(e.player)}</div>
        <div style="font-size:0.68rem;color:var(--text-2);margin-top:2px">${teamMark(e.team, 14)} ${e.team.short || ''} · ${(e.player.pos || [])[0] || ''}</div>
        <div style="color:var(--gold);font-weight:800;margin-top:3px">${e.player.ovr || '—'} <span style="font-size:0.6rem;font-weight:600;color:var(--text-3)">OVR</span></div>
      </div>`).join('');

    // Core (att/def/pac/phy/tec) rows — these already reflect an enhanced
    // player's derived, expanded-attribute-driven values (applied in
    // applyExpandedPlayerAttributes), same as everywhere else in the app.
    const attrRows = [['ATT', 'att'], ['DEF', 'def'], ['PHY', 'phy'], ['PAC', 'pac'], ['TEC', 'tec']]
      .map(([label, key]) => compareRowsHTML(label, entries, p => p[key] || 0)).join('');

    // The individual eFootball-style ratings behind those core numbers —
    // this is what actually differentiates two enhanced players who happen
    // to land on similar att/def/pac/phy/tec.
    const enhancedRows = expandedCompareRowsHTML(entries);

    const careerRows = [
      ['Apps', p => playerCareerCount('ratings', p.id)],
      ['Goals', p => playerCareerCount('goals', p.id)],
      ['Assists', p => playerCareerCount('assists', p.id)],
      ['MOTM', p => playerCareerCount('motm', p.id)],
      ['Saves', p => playerCareerCount('saves', p.id)],
      ['Yellows', p => playerCareerCount('yellows', p.id)],
      ['Reds', p => playerCareerCount('reds', p.id)]
    ].map(([label, fn]) => compareRowsHTML(label, entries, fn)).join('');

    content.innerHTML = `
      <div class="card-title">Player Comparison</div>
      ${bestPickBannerHTML(entries, posMatch)}
      <div class="compare-grid" style="grid-template-columns:repeat(${n},1fr)">${header}</div>
      <div class="card-title" style="margin-top:14px">Attributes</div>
      ${attrRows}
      ${enhancedRows ? `<div class="card-title" style="margin-top:14px">Enhanced Attributes</div>${enhancedRows}` : ''}
      <div class="card-title" style="margin-top:14px">Career (competitive)</div>
      ${careerRows}
      <div class="modal-actions"><button class="btn btn-secondary" onclick="document.getElementById('compare-modal').classList.remove('active')">Close</button></div>`;
  }


  // ========== PLAYER MATCH LOG ==========
  // playerMatchLog[playerId] -> array of entries, newest first, capped per
  // player so persisted save size stays bounded. Populated at full-time —
  // see recordPlayerMatchLog() in matchEngine.js.
  //
  // Current entries are compact arrays: [opponentTeamId, competition,
  // minutes, goals, assists, shots, xg, rating] — the opponent's
  // name/short/logo/flag are looked up from opponentTeamId via getTeam()
  // instead of being persisted on every entry (see readPlayerLogEntry()).
  //
  // Saves made before this format change still have plain objects
  // ({opponent, opponentShort, opponentLogo, opponentFlag, competition,
  // minutes, ...}) sitting in the 30-entry cap — those age out naturally
  // as new matches are recorded, and readPlayerLogEntry() understands both
  // shapes in the meantime so old saves keep rendering correctly.
  let playerMatchLog = {};


  const PML_OPP = 0, PML_COMP = 1, PML_MIN = 2, PML_G = 3, PML_A = 4, PML_SH = 5, PML_XG = 6, PML_RTG = 7;

  // Normalizes one playerMatchLog entry (new compact array OR legacy
  // object) into a plain object the renderer can use uniformly.
  function readPlayerLogEntry(e) {
    if (Array.isArray(e)) {
      const opp = getTeam(e[PML_OPP]);
      return {
        opponentShort: (opp && (opp.short || opp.name)) || '—',
        opponentLogo: opp ? opp.logo : null,
        opponentFlag: opp ? opp.flag : null,
        competition: e[PML_COMP],
        minutes: e[PML_MIN],
        goals: e[PML_G],
        assists: e[PML_A],
        shots: e[PML_SH],
        xg: e[PML_XG],
        rating: e[PML_RTG]
      };
    }
    // Legacy object-shaped entry from a pre-format-change save.
    return {
      opponentShort: e.opponentShort || e.opponent || '—',
      opponentLogo: e.opponentLogo,
      opponentFlag: e.opponentFlag,
      competition: e.competition,
      minutes: e.minutes,
      goals: e.goals,
      assists: e.assists,
      shots: e.shots,
      xg: e.xg,
      rating: e.rating
    };
  }


  function renderPlayerMatchLogHTML(playerId) {
    const log = playerMatchLog[playerId] || [];
    if (!log.length) return '';
    const rows = log.slice(0, 10).map(raw => {
      const e = readPlayerLogEntry(raw);
      const rc = (e.rating || 0) >= 7.5 ? 'rating-high' : (e.rating || 0) >= 6.5 ? 'rating-mid' : 'rating-low';
      const oppMark = teamMark({ logo: e.opponentLogo, flag: e.opponentFlag }, 16);
      return `<tr>
        <td><span style="display:inline-flex;align-items:center;gap:4px">${oppMark}${e.opponentShort}</span></td>
        <td>${e.competition || ''}</td>
        <td>${e.minutes}'</td>
        <td>${e.goals || 0}</td>
        <td>${e.assists || 0}</td>
        <td>${e.shots || 0}</td>
        <td>${(e.xg || 0).toFixed(2)}</td>
        <td><span class="rating-badge ${rc}">${(e.rating || 0).toFixed(1)}</span></td>
      </tr>`;
    }).join('');
    return `<div class="card-title" style="margin-top:14px">Match Log <span style="color:var(--text-muted);font-weight:400;font-size:0.72rem">(last ${Math.min(log.length, 10)})</span></div>
      <div class="match-log-wrap">
        <table class="match-log-table">
          <thead><tr><th>Opp</th><th>Comp</th><th>Min</th><th>G</th><th>A</th><th>Sh</th><th>xG</th><th>Rtg</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }


  // ========== LIVE RATING vs IN-MATCH FORM GRAPH ==========
  // Small canvas chart for the player profile plotting, for each of the
  // player's last 10 logged matches (oldest -> newest, left to right):
  //   - their actual rating in that match ("Live rating" — gold line)
  //   - the liveRating letter tier that rating would produce, per the
  //     same A/B/C/D/E thresholds updateLiveRatingAfterMatch() uses in
  //     engine/form.js ("In-match form" — blue dashed line)
  // so a coach can see at a glance whether a player's raw numbers and
  // their resulting form tier are trending together or diverging.
  // Markup only here — actual drawing happens in
  // drawPlayerRatingFormChart() once the canvas is in the DOM (see
  // showPlayerProfile() in ui/playerUI.js), same split as
  // renderMomentumAndHeat()/its canvas in ui/matchUI.js.
  function renderPlayerRatingFormChartHTML(playerId) {
    const log = playerMatchLog[playerId] || [];
    if (!log.length) return '';
    return `<div class="card-title" style="margin-top:14px">Live Rating vs Form <span style="color:var(--text-muted);font-weight:400;font-size:0.72rem">(last ${Math.min(log.length, 10)})</span></div>
      <div class="rating-form-wrap">
        <canvas id="rating-form-canvas" height="120"></canvas>
        <div class="rating-form-legend">
          <span><i class="rf-dot rf-dot-rating"></i>Match rating</span>
          <span><i class="rf-dot rf-dot-form"></i>Form tier (A–E)</span>
        </div>
      </div>`;
  }

  // Same breakpoints as updateLiveRatingAfterMatch() in engine/form.js —
  // kept in sync deliberately rather than calling that function, since
  // that one also *writes* p.liveRating and we only want to read here.
  function ratingToFormTier(rating) {
    const r = rating || 0;
    if (r >= 8.9) return 'A';
    if (r >= 7.9) return 'B';
    if (r >= 6.9) return 'C';
    if (r >= 5.9) return 'D';
    return 'E';
  }
  const RF_TIER_VALUE = { A: 9.5, B: 8.5, C: 7.5, D: 6.5, E: 5.5 };

  function drawPlayerRatingFormChart(playerId) {
    const canvas = document.getElementById('rating-form-canvas');
    if (!canvas || !canvas.parentElement) return;
    const log = (playerMatchLog[playerId] || []).slice(0, 10).map(readPlayerLogEntry).reverse();
    if (!log.length) return;
    const w = canvas.parentElement.clientWidth || 300;
    const h = 120;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a1210';
    ctx.fillRect(0, 0, w, h);

    const padL = 24, padR = 10, padT = 10, padB = 18;
    const plotW = Math.max(1, w - padL - padR), plotH = h - padT - padB;
    const minV = 4, maxV = 10;
    const yFor = (v) => padT + plotH - ((Math.max(minV, Math.min(maxV, v)) - minV) / (maxV - minV)) * plotH;
    const xFor = (i) => padL + (log.length === 1 ? plotW / 2 : (i / (log.length - 1)) * plotW);

    // Gridlines + scale labels
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.font = '9px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'left';
    [4, 6, 8, 10].forEach(v => {
      const y = yFor(v);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillText(String(v), 3, y + 3);
    });

    // Form-tier line (blue, dashed) — drawn first so the rating line sits
    // on top where the two series overlap.
    ctx.beginPath();
    ctx.setLineDash([4, 3]);
    log.forEach((e, i) => {
      const x = xFor(i), y = yFor(RF_TIER_VALUE[ratingToFormTier(e.rating)]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#3d8bfd';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    log.forEach((e, i) => {
      const tier = ratingToFormTier(e.rating);
      const x = xFor(i), y = yFor(RF_TIER_VALUE[tier]);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#3d8bfd'; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tier, x, y - 7);
    });

    // Match rating line (gold)
    ctx.beginPath();
    log.forEach((e, i) => {
      const x = xFor(i), y = yFor(e.rating || 0);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#f0c14b';
    ctx.lineWidth = 2;
    ctx.stroke();
    log.forEach((e, i) => {
      const x = xFor(i), y = yFor(e.rating || 0);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#f0c14b'; ctx.fill();
    });

    // X-axis: opponent short name per match
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    log.forEach((e, i) => {
      ctx.fillText((e.opponentShort || '').slice(0, 3).toUpperCase(), xFor(i), h - 4);
    });
    ctx.textAlign = 'left';
  }


  // Human-readable name for whatever's currently being simulated, used both
  // for the per-player match log and anywhere else a competition label is
  // needed. Falls back to "Friendly" for a plain Kick Off match.
  function matchCompetitionLabel(m) {
    if (tournament) {
      if (tournament.competitionName) return tournament.competitionName;
      return tournament.type === 'worldcup' ? 'World Cup' : 'Champions League';
    }
    if (currentSeasonComp && currentSeasonComp.name) return currentSeasonComp.name;
    if (m && m.countForLeaderboard) return 'Cup';
    return 'Friendly';
  }


  // Best-effort minutes played from this match's sub log (exact) plus a
  // fallback scan of the event feed for a red card naming this player
  // (subs already record an exact minute; a straight red doesn't go through
  // subLog at all, so this is the only record of when that player's
  // involvement actually ended).
  function computeMinutesPlayed(m, playerId, playerName, side) {
    const endMin = Math.max(m.dispMin || 90, 90);
    const log = (m.subLog && m.subLog[side] && m.subLog[side][playerId]) || {};
    const start = typeof log.inMin === 'number' ? log.inMin : 0;
    let end = typeof log.outMin === 'number' ? log.outMin : endMin;
    if (typeof log.outMin !== 'number' && playerName) {
      const evt = (m.events || []).find(e => e.type === 'red' && e.text && e.text.indexOf(playerName) !== -1);
      if (evt) end = Math.min(end, evt.dispMin != null ? evt.dispMin : evt.minute);
    }
    return Math.max(0, Math.min(end, endMin) - start);
  }


  // Appends this match's line to the player's persistent match log (see
  // playerMatchLog in ui/playersUI.js). Called once per involved player at
  // full time, right after their rating for this match is finalised.
  //
  // STORAGE FORMAT: each entry is a compact array, NOT an object —
  // [opponentTeamId, competition, minutes, goals, assists, shots, xg, rating]
  // (see PML_* index constants below). We used to store the opponent's
  // full name/short/logo/flag on every single entry, which is what a team
  // object already gives us for free via getTeam(id) — that redundancy was
  // most of this save key's size (see renderPlayerMatchLogHTML in
  // ui/playersUI.js, which resolves the opponent back through getTeam()).
  // Only the opponent's id needs to be persisted.
  function recordPlayerMatchLog(m, player, team, opponentTeam, ps, side) {
    if (!player || !team) return;
    const minutes = computeMinutesPlayed(m, player.id, player.name, side);
    if (minutes <= 0 && !(ps.goals || ps.assists || ps.shots)) return; // never actually took part
    if (!playerMatchLog[player.id]) playerMatchLog[player.id] = [];
    playerMatchLog[player.id].unshift([
      opponentTeam ? opponentTeam.id : null,
      matchCompetitionLabel(m),
      minutes,
      ps.goals || 0,
      ps.assists || 0,
      ps.shots || 0,
      Math.round((ps.xg || 0) * 100) / 100,
      ps.rating || 0
    ]);
    if (playerMatchLog[player.id].length > 30) playerMatchLog[player.id].length = 30;
  }


  // Appends this match's line to a team's persistent match log (see
  // teamMatchLog in ui/teamUI.js). Called once per side at full time, right
  // after both players' match logs are recorded, so the two stay in sync.
  //
  // STORAGE FORMAT: compact array — [opponentTeamId, competition,
  // scoreFor, scoreAgainst] (see TML_* index constants below). W/D/L is
  // derived from scoreFor vs scoreAgainst at render time instead of being
  // stored, and opponent name/short/logo/flag are resolved via getTeam(id)
  // — same reasoning as recordPlayerMatchLog above.
  function recordTeamMatchLog(m, team, opponentTeam, scoreFor, scoreAgainst) {
    if (!team || !opponentTeam) return;
    if (!teamMatchLog[team.id]) teamMatchLog[team.id] = [];
    teamMatchLog[team.id].unshift([
      opponentTeam.id || null,
      matchCompetitionLabel(m),
      scoreFor,
      scoreAgainst
    ]);
    if (teamMatchLog[team.id].length > 30) teamMatchLog[team.id].length = 30;
  }

  // ========== HOSPITAL TAB ==========
  // Renders every player currently sidelined (injuryBook entries with
  // matchesLeft > 0), across every team, with the full detail recorded by
  // tryInjury() in engine/injuries.js: what the injury is (name/bodyPart/
  // severity, resolved against injury.json via injuryDefsData), how it
  // happened (the "cause" flavor line plus opponent/competition/minute
  // context), and how many matches are left until the player is available
  // again. Search/severity-filter/sort are kept as small local state here
  // rather than in js/state.js since they're pure UI/view state, the same
  // treatment historyActiveTab and seasonActiveTab get.
  let hospitalFilter = { search: '', severity: 'all', sort: 'matchesLeft' };
  // One row per currently-injured player, resolved against the live roster
  // (findPlayerAndTeam, from ui/playersUI.js) for portrait/position, but
  // reading every injury fact straight from the injuryBook record itself —
  // that record is the single source of truth for which team the injury
  // happened at, so this never double-lists a player who has both a club
  // and a national entry in allTeams.
  function getHospitalEntries() {
    const q = (hospitalFilter.search || '').trim().toLowerCase();
    let list = Object.keys(injuryBook).map(pid => {
      const rec = injuryBook[pid];
      if (!rec || !(rec.matchesLeft > 0)) return null;
      const found = (typeof findPlayerAndTeam === 'function') ? findPlayerAndTeam(pid) : null;
      const player = (found && found.player) || { id: pid, name: rec.playerName, num: null, pos: [] };
      const team = (found && found.team) || null;
      return { id: pid, player, team, rec };
    }).filter(Boolean);

    if (hospitalFilter.severity !== 'all') {
      list = list.filter(e => (e.rec.severity || 'Minor') === hospitalFilter.severity);
    }
    if (q) {
      list = list.filter(e =>
        (e.player.name || e.rec.playerName || '').toLowerCase().includes(q) ||
        (e.rec.teamName || '').toLowerCase().includes(q) ||
        (e.rec.type || '').toLowerCase().includes(q) ||
        (e.rec.bodyPart || '').toLowerCase().includes(q));
    }
    const sevOrder = { Severe: 0, Major: 1, Moderate: 2, Minor: 3 };
    list.sort((a, b) => {
      if (hospitalFilter.sort === 'name') return (a.player.name || '').localeCompare(b.player.name || '');
      if (hospitalFilter.sort === 'team') return (a.rec.teamName || '').localeCompare(b.rec.teamName || '');
      if (hospitalFilter.sort === 'severity') {
        const d = (sevOrder[a.rec.severity] ?? 9) - (sevOrder[b.rec.severity] ?? 9);
        return d !== 0 ? d : (b.rec.matchesLeft || 0) - (a.rec.matchesLeft || 0);
      }
      return (b.rec.matchesLeft || 0) - (a.rec.matchesLeft || 0);
    });
    return list;
  }
  function hospitalSeverityClass(sev) {
    const s = (sev || '').toLowerCase();
    if (s === 'severe') return 'sev-severe';
    if (s === 'major') return 'sev-major';
    if (s === 'moderate') return 'sev-moderate';
    return 'sev-minor';
  }
  // How-it-happened + context line: the random flavor cause from
  // injury.json, plus the opponent/competition/minute the injury actually
  // occurred in, when tryInjury() had that context to record.
  function hospitalCauseLine(rec) {
    const parts = [];
    if (rec.cause) parts.push(rec.cause);
    const ctx = [];
    if (rec.opponent) ctx.push('vs ' + rec.opponent);
    if (rec.competition) ctx.push(rec.competition);
    if (rec.minute != null) ctx.push(rec.minute + "'");
    if (ctx.length) parts.push('(' + ctx.join(' · ') + ')');
    return parts.join(' ') || 'No further details recorded.';
  }
  function renderHospitalList() {
    const listEl = document.getElementById('hospital-list');
    const summaryEl = document.getElementById('hospital-summary');
    if (!listEl) return;

    const allOut = Object.keys(injuryBook).filter(pid => injuryBook[pid] && injuryBook[pid].matchesLeft > 0);
    const counts = { Minor: 0, Moderate: 0, Major: 0, Severe: 0 };
    allOut.forEach(pid => {
      const s = injuryBook[pid].severity || 'Minor';
      if (counts[s] != null) counts[s]++;
    });
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="hospital-stat-row">
          <div class="hospital-stat"><div class="val">${allOut.length}</div><div class="lbl">Total Out</div></div>
          <div class="hospital-stat sev-minor"><div class="val">${counts.Minor}</div><div class="lbl">Minor</div></div>
          <div class="hospital-stat sev-moderate"><div class="val">${counts.Moderate}</div><div class="lbl">Moderate</div></div>
          <div class="hospital-stat sev-major"><div class="val">${counts.Major}</div><div class="lbl">Major</div></div>
          <div class="hospital-stat sev-severe"><div class="val">${counts.Severe}</div><div class="lbl">Severe</div></div>
        </div>`;
    }

    const entries = getHospitalEntries();
    if (!entries.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="icon">🏥</div><p>${allOut.length ? 'No injuries match your filters.' : 'No injuries right now — every squad is fully fit.'}</p></div>`;
      return;
    }

    listEl.innerHTML = `<div class="table-scroll"><table class="lb-table hospital-table"><thead><tr>
      <th>Player</th><th>Team</th><th>Injury</th><th>Body Part</th><th>Severity</th><th>How it happened</th><th>Return</th>
    </tr></thead><tbody>
      ${entries.map(e => {
        const p = e.player, rec = e.rec, team = e.team;
        const total = rec.matchesTotal || rec.matchesLeft || 1;
        const done = Math.max(0, Math.min(total, total - rec.matchesLeft));
        const pct = Math.round(100 * done / total);
        return `<tr onclick="App.showPlayerProfile('${p.id}')" style="cursor:pointer">
          <td><div style="display:flex;align-items:center;gap:8px">
            <div class="lb-avatar" style="width:28px;height:28px">${playerAvatarMark(p)}</div>
            <span>${p.name || rec.playerName}</span>
          </div></td>
          <td>${team ? `${teamMark(team, 18)} ${team.name}` : (rec.teamName || '—')}</td>
          <td>${rec.type || '—'}</td>
          <td>${rec.bodyPart || '—'}</td>
          <td><span class="injury-badge ${hospitalSeverityClass(rec.severity)}">${rec.severity || 'Minor'}</span></td>
          <td style="max-width:260px;color:var(--text-2);font-size:0.8rem">${hospitalCauseLine(rec)}</td>
          <td>
            <div style="font-weight:700;white-space:nowrap">${rec.matchesLeft} match${rec.matchesLeft > 1 ? 'es' : ''} left</div>
            <div class="hospital-progress"><div class="hospital-progress-fill" style="width:${pct}%"></div></div>
          </td>
        </tr>`;
      }).join('')}
    </tbody></table></div>`;
  }
  // Debounced — renderHospitalList() rebuilds the whole injured-players
  // table from scratch, so tying it to every keystroke was unnecessary lag.
  const _debouncedRenderHospitalList = debounce(renderHospitalList, 150);
  function searchHospital(v) { hospitalFilter.search = v || ''; _debouncedRenderHospitalList(); }
  function filterHospitalSeverity(v) { hospitalFilter.severity = v || 'all'; renderHospitalList(); }
  function sortHospital(v) { hospitalFilter.sort = v || 'matchesLeft'; renderHospitalList(); }

  return {
    setRngSeed, getRngSeed,
    init, switchView, goToMatch, goToTournament, selectTournamentFormat, updateTeamPreview,
    startMatch, quickSimMatch, toggleSim, setSpeed, simToEnd, finishMatch, resetMatch,
    showLeaderboard, selectAllTeams, deselectAllTeams, startTournament,
    simTournamentRound, simAllTournament, resetTournament, filterTeams,
    showAwards, goToSquadBuilder, playTournamentMatch, simSingleFixture,
    playLeagueTournamentFixture, simLeagueTournamentFixture,
    returnToTournament, showPlayerProfile, showTeamProfile, showTeamLineup, randomMatch, randomizeTeamSide,
    resetLeaderboard, manualSave, exportSave, triggerImportSave, importSaveFile, toggleSaveMenu,
    searchTeams, sortTeams, searchTournamentTeams,
    openSquadBuilder, setSquadSlot, openSlotPicker, closeSlotPicker,
    openSlotRolePicker, setSquadSlotRole,
    playKnockoutMatch, updateTournamentSelectedCount, autoFillSquadBuilder,
    saveSquadBuilder, closeSquadBuilder, onFormationChange, changeFormationLive,
    sbSwitchSide, sbSwitchTab, sbSelectFormationPreset, sbToggleEditMode,
    sbResetFormationShape, sbGrab, sbZoneGrab, sbEmptySlotTap, sbSetRole,
    sbMoveToBench, sbMoveToReserve, sbExportFormation,
    setTacticsLive, continueToET, continueToPens, skipETAndEnd,
    renderMomentumAndHeat, showLoading, hideLoading, refreshTournamentStatsUI,
    simKnockoutMatch, viewFixtureReport, viewKnockoutReport, showMatchReport, showMatchReportLeg,
    simUCLFixture, playUCLFixture, simPlayoffTie, viewPlayoffReport,
    playLeagueTournamentFixture, simLeagueTournamentFixture,
    goToSeason, searchSeasonTeams, toggleSeasonTeam, autoFillSeason, clearSeasonSetup,
    startSeason, simulateSeasonWeek, simulateSeasonToEnd, startNewSeasonYear, resetSeason,
    endSeasonNow, endSeasonAndAnnounce, renderSeasonEndAnnouncement,
    showSeasonComp, showSeasonSubTab, viewSeasonReport, showHistory,
    simSeasonFixture, playSeasonFixture,
    searchPlayers, sortPlayers, filterPlayersPos, filterPlayersType, loadMorePlayers,
    togglePlayersCompareMode, togglePlayerCompare, clearPlayersCompare, openPlayersCompare,
    renderHospitalList, searchHospital, filterHospitalSeverity, sortHospital
  };
})();

// Expose for inline onclick handlers
try { window.App = App; } catch (e) {}

// ========== SEARCHABLE DROPDOWNS ==========
// Auto-enhances every native <select> in the page (present now or added
// later, e.g. formation pickers rebuilt mid-match) into a searchable custom
// dropdown: a button + panel with a text search box, instead of the plain
// browser <select> list. The original <select> stays in the DOM (hidden) as
// the real source of truth, so all existing .value reads/writes and
// onchange="" handlers keep working untouched.
(function () {
  function closeAllPanels(except) {
    document.querySelectorAll('.ss-wrap.open').forEach(w => { if (w !== except) w.classList.remove('open'); });
  }

  function collectOptions(select) {
    const items = [];
    Array.from(select.children).forEach(node => {
      if (node.tagName === 'OPTGROUP') {
        Array.from(node.children).forEach(opt => items.push({ value: opt.value, label: opt.textContent, group: node.label, logo: opt.dataset.logo, flag: opt.dataset.flag, name: opt.dataset.name }));
      } else if (node.tagName === 'OPTION') {
        items.push({ value: node.value, label: node.textContent, group: null, logo: node.dataset.logo, flag: node.dataset.flag, name: node.dataset.name });
      }
    });
    return items;
  }

  // Local mirror of teamMark() (defined inside the main App closure in
  // ui/playerUI.js, and NOT reachable from this separate IIFE — calling the
  // real teamMark() here throws "teamMark is not defined" and silently
  // aborts renderOptions(), which is why searching/opening the team
  // dropdowns showed no results at all). Kept intentionally identical to
  // teamMark()'s output (logo image with flag-emoji fallback) so the two
  // never visually diverge.
  function ssTeamMark(logo, flag, size) {
    size = size || 22;
    const f = flag || '⚽';
    if (logo) {
      const src = 'assets/logos/' + logo;
      return `<span class="team-mark" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.82)}px"><img src="${src}" alt="" loading="lazy" onerror="this.parentElement.textContent='${f}'"></span>`;
    }
    return `<span class="team-mark" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.82)}px">${f}</span>`;
  }
  function enhanceSelect(select) {
    if (!select || select.dataset.ssEnhanced || select.closest('.ss-wrap')) return;
    select.dataset.ssEnhanced = '1';

    const wrap = document.createElement('div');
    wrap.className = 'ss-wrap ' + select.className;
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add('ss-native');
    select.tabIndex = -1;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'ss-trigger';
    if (select.hasAttribute('aria-label')) trigger.setAttribute('aria-label', select.getAttribute('aria-label'));
    wrap.appendChild(trigger);

    const isTeamSelect = select.id === 'home-team' || select.id === 'away-team';
    const panel = document.createElement('div');
    panel.className = 'ss-panel';
    panel.innerHTML = (isTeamSelect ? `<div class="ss-tabs">
        <button type="button" class="ss-tab active" data-cat="all">All</button>
        <button type="button" class="ss-tab" data-cat="National Teams">National</button>
        <button type="button" class="ss-tab" data-cat="Club Teams">Clubs</button>
      </div>` : '') +
      `<div class="ss-search-wrap"><input type="text" class="ss-search" placeholder="Search…" autocomplete="off" spellcheck="false"></div>
      <div class="ss-options" role="listbox"></div>`;
    wrap.appendChild(panel);

    const searchInput = panel.querySelector('.ss-search');
    const optionsEl = panel.querySelector('.ss-options');
    let activeCat = 'all';

    function updateTrigger() {
      const opt = select.options[select.selectedIndex];
      trigger.textContent = opt ? opt.textContent : 'Select…';
    }

    function renderOptions() {
      const q = (searchInput.value || '').trim().toLowerCase();
      let items = collectOptions(select);
      if (isTeamSelect && activeCat !== 'all') items = items.filter(i => i.group === activeCat);
      if (q) items = items.filter(i => i.label.toLowerCase().includes(q));
      // Kickoff team dropdowns: keep results alphabetical by team name
      // (within each group) instead of raw teams.json order, so a search
      // like "re" doesn't come back in a random-looking order.
      if (isTeamSelect) {
        items = items.slice().sort((a, b) => {
          if (a.group !== b.group) return (a.group || '').localeCompare(b.group || '');
          return (a.name || a.label || '').localeCompare(b.name || b.label || '');
        });
      }
      if (!items.length) { optionsEl.innerHTML = '<div class="ss-empty">No matches</div>'; return; }
      let html = '';
      let lastGroup;
      items.forEach(i => {
        if (i.group !== lastGroup) {
          if (i.group && (!isTeamSelect || activeCat === 'all')) html += `<div class="ss-group-label">${i.group}</div>`;
          lastGroup = i.group;
        }
        const sel = i.value === select.value ? ' selected' : '';
        // Team dropdowns show the club/country logo (falling back to the
        // flag emoji when no logo is set — same behavior as everywhere
        // else in the app, via teamMark()) instead of just the flag
        // character baked into the plain option text.
        const rowLabel = isTeamSelect
          ? `${ssTeamMark(i.logo, i.flag, 18)} <span>${i.name || i.label}</span>`
          : i.label;
        html += `<div class="ss-option${sel}" data-value="${String(i.value).replace(/"/g, '&quot;')}" role="option">${rowLabel}</div>`;
      });
      optionsEl.innerHTML = html;
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !wrap.classList.contains('open');
      closeAllPanels(wrap);
      wrap.classList.toggle('open', willOpen);
      if (willOpen) {
        searchInput.value = '';
        renderOptions();
        setTimeout(() => searchInput.focus(), 0);
      }
    });

    searchInput.addEventListener('input', renderOptions);
    panel.addEventListener('click', (e) => e.stopPropagation());

    if (isTeamSelect) {
      panel.querySelectorAll('.ss-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          panel.querySelectorAll('.ss-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          activeCat = tab.dataset.cat;
          renderOptions();
        });
      });
    }

    optionsEl.addEventListener('click', (e) => {
      const opt = e.target.closest('.ss-option');
      if (!opt) return;
      select.value = opt.dataset.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      wrap.classList.remove('open');
    });

    // Keep the trigger label in sync even when code sets select.value
    // programmatically (no native 'change' event fires in that case).
    const proto = window.HTMLSelectElement && HTMLSelectElement.prototype;
    const desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.configurable) {
      Object.defineProperty(select, 'value', {
        get() { return desc.get.call(select); },
        set(v) { desc.set.call(select, v); updateTrigger(); },
        configurable: true
      });
    }

    // Options list changes (e.g. formation <select> rebuilt) — refresh label/list.
    new MutationObserver(() => { updateTrigger(); if (wrap.classList.contains('open')) renderOptions(); })
      .observe(select, { childList: true });

    updateTrigger();
  }

  document.addEventListener('click', () => closeAllPanels(null));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllPanels(null); });

  function scanAndEnhance(root) {
    (root || document).querySelectorAll('select').forEach(enhanceSelect);
  }

  document.addEventListener('DOMContentLoaded', () => scanAndEnhance(document));
  if (document.readyState !== 'loading') scanAndEnhance(document);

  // Catch selects created later (formation pickers, live tactics selects, etc.)
  new MutationObserver((mutations) => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'SELECT') enhanceSelect(node);
        else if (node.querySelectorAll) scanAndEnhance(node);
      });
    });
  }).observe(document.body || document.documentElement, { childList: true, subtree: true });
})();

// ========== SCROLL TO TOP / BOTTOM ==========
(function () {
  function init() {
    const group = document.getElementById('scroll-fab-group');
    const topBtn = document.getElementById('scroll-fab-top');
    const bottomBtn = document.getElementById('scroll-fab-bottom');
    if (!group || !topBtn || !bottomBtn) return;

    function toggleVisibility() {
      const scrollable = document.documentElement.scrollHeight > window.innerHeight + 200;
      group.classList.toggle('show', scrollable);
      const nearTop = window.scrollY < 200;
      const nearBottom = window.scrollY + window.innerHeight > document.documentElement.scrollHeight - 200;
      topBtn.classList.toggle('disabled', nearTop);
      bottomBtn.classList.toggle('disabled', nearBottom);
    }

    topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    bottomBtn.addEventListener('click', () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
    window.addEventListener('scroll', toggleVisibility, { passive: true });
    window.addEventListener('resize', toggleVisibility);
    new MutationObserver(toggleVisibility).observe(document.body, { childList: true, subtree: true });
    toggleVisibility();
  }
  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();
})();

// Start the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
