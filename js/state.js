/*@CHUNK:c0000:START*/
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
  let stats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, cards: {}, motm: {}, puskas: {}, ratings: {}, interceptions: {}, tackles: {} };
  let tournamentStats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, motm: {}, ratings: {}, puskas: {}, interceptions: {}, tackles: {} };
  // Which season competition (a league, or the UCL) is currently being simulated —
  // set for the duration of a simulateRoundFixtures() call so recordStat/recordRating
  // can also tally into that competition's own stat bucket (comp.stats), giving each
  // league/competition its own top scorers, assists, cards, awards, etc.
  let currentSeasonComp = null;
  // playerId -> { type, matchesLeft, teamName, playerName } — counts down once per
  // this player's team's match played while they're sidelined
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
    '4-3-3': { name: '4-3-3', slots: ['GK','RB','CB','CB','LB','CM','CM','CM','RW','ST','LW'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[62,50],[50,48],[38,50],[78,28],[50,18],[22,28]] },
    '4-4-2': { name: '4-4-2', slots: ['GK','RB','CB','CB','LB','RM','CM','CM','LM','ST','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[82,48],[58,50],[42,50],[18,48],[58,20],[42,20]] },
    '4-2-3-1': { name: '4-2-3-1', slots: ['GK','RB','CB','CB','LB','CDM','CDM','CAM','RW','LW','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[58,55],[42,55],[50,38],[78,30],[22,30],[50,16]] },
    '3-5-2': { name: '3-5-2', slots: ['GK','CB','CB','CB','RWB','CM','CM','CM','LWB','ST','ST'],
      coords: [[50,92],[68,75],[50,78],[32,75],[88,55],[62,48],[50,50],[38,48],[12,55],[58,20],[42,20]] },
    '4-5-1': { name: '4-5-1', slots: ['GK','RB','CB','CB','LB','RM','CM','CDM','CM','LM','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[82,45],[62,48],[50,55],[38,48],[18,45],[50,18]] },
    '3-4-3': { name: '3-4-3', slots: ['GK','CB','CB','CB','RM','CM','CM','LM','RW','ST','LW'],
      coords: [[50,92],[68,75],[50,78],[32,75],[82,50],[58,48],[42,48],[18,50],[78,25],[50,16],[22,25]] },
    '5-3-2': { name: '5-3-2', slots: ['GK','RWB','CB','CB','CB','LWB','CM','CM','CM','ST','ST'],
      coords: [[50,92],[88,68],[68,75],[50,78],[32,75],[12,68],[62,48],[50,50],[38,48],[58,20],[42,20]] },
    '4-1-4-1': { name: '4-1-4-1', slots: ['GK','RB','CB','CB','LB','CDM','RM','CM','CM','LM','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[50,58],[82,42],[58,45],[42,45],[18,42],[50,16]] },
    '4-3-2-1': { name: '4-3-2-1', slots: ['GK','RB','CB','CB','LB','CM','CM','CM','CAM','CAM','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[62,52],[50,50],[38,52],[62,32],[38,32],[50,16]] },
    '3-4-2-1': { name: '3-4-2-1', slots: ['GK','CB','CB','CB','RM','CM','CM','LM','CAM','CAM','ST'],
      coords: [[50,92],[68,75],[50,78],[32,75],[85,50],[58,52],[42,52],[15,50],[62,30],[38,30],[50,14]] },
    '4-4-1-1': { name: '4-4-1-1', slots: ['GK','RB','CB','CB','LB','RM','CM','CM','LM','CAM','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[82,48],[58,52],[42,52],[18,48],[50,32],[50,16]] },
    '5-4-1': { name: '5-4-1', slots: ['GK','RWB','CB','CB','CB','LWB','RM','CM','CM','LM','ST'],
      coords: [[50,92],[88,68],[68,75],[50,78],[32,75],[12,68],[80,45],[58,50],[42,50],[20,45],[50,18]] },
    '4-1-2-1-2': { name: '4-1-2-1-2 (Diamond)', slots: ['GK','RB','CB','CB','LB','CDM','CM','CM','CAM','ST','ST'],
      coords: [[50,92],[80,72],[62,75],[38,75],[20,72],[50,60],[66,46],[34,46],[50,32],[58,16],[42,16]] },
    '4-2-2-2': { name: '4-2-2-2', slots: ['GK','RB','CB','CB','LB','CDM','CDM','CAM','CAM','ST','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[60,55],[40,55],[70,35],[30,35],[58,16],[42,16]] },
    '3-1-4-2': { name: '3-1-4-2', slots: ['GK','CB','CB','CB','CDM','RM','CM','CM','LM','ST','ST'],
      coords: [[50,92],[68,75],[50,78],[32,75],[50,58],[82,42],[60,44],[40,44],[18,42],[58,18],[42,18]] },
    '4-1-3-2': { name: '4-1-3-2', slots: ['GK','RB','CB','CB','LB','CDM','RM','CAM','LM','ST','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[50,58],[78,42],[50,40],[22,42],[58,18],[42,18]] },
    '4-3-3-f9': { name: '4-3-3 (False 9)', slots: ['GK','RB','CB','CB','LB','CM','CM','CM','RW','ST','LW'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[62,52],[50,50],[38,52],[75,22],[50,34],[25,22]] },
    '4-3-3-cdm': { name: '4-3-3 (Holding)', slots: ['GK','RB','CB','CB','LB','CDM','CM','CM','RW','ST','LW'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[50,55],[64,45],[36,45],[78,28],[50,16],[22,28]] },
    '4-3-3-cam': { name: '4-3-3 (Attack)', slots: ['GK','RB','CB','CB','LB','CM','CM','CAM','RW','ST','LW'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[62,52],[38,52],[50,38],[78,22],[50,14],[22,22]] },
    '4-2-3-1-narrow': { name: '4-2-3-1 (Narrow)', slots: ['GK','RB','CB','CB','LB','CDM','CDM','CAM','RW','LW','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[58,55],[42,55],[50,38],[66,26],[34,26],[50,16]] },
    '5-3-2-attack': { name: '5-3-2 (Attack)', slots: ['GK','RWB','CB','CB','CB','LWB','CM','CM','CM','ST','ST'],
      coords: [[50,92],[88,62],[68,72],[50,75],[32,72],[12,62],[62,45],[50,48],[38,45],[58,18],[42,18]] }
  };

  const POS_COMPAT = {
    GK: ['GK'], CB: ['CB','RB','LB'], RB: ['RB','CB','RWB','RM'], LB: ['LB','CB','LWB','LM'],
    RWB: ['RWB','RB','RM'], LWB: ['LWB','LB','LM'], CDM: ['CDM','CM','CB'], CM: ['CM','CDM','CAM'],
    CAM: ['CAM','CM','RW','LW','ST'], RM: ['RM','RW','RWB','CM'], LM: ['LM','LW','LWB','CM'],
    RW: ['RW','RM','ST','CAM'], LW: ['LW','LM','ST','CAM'], ST: ['ST','RW','LW','CAM']
  };

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
/*@CHUNK:c0000:END*/
