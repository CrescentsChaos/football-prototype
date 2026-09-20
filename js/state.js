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
  let stats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, cards: {}, motm: {}, puskas: {}, ratings: {}, interceptions: {}, tackles: {}, blocks: {}, chancesCreated: {}, bigChancesMissed: {}, xg: {}, xa: {}, bigGames: {}, minutes: {} };
  let tournamentStats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, motm: {}, ratings: {}, puskas: {}, interceptions: {}, tackles: {}, blocks: {}, chancesCreated: {}, bigChancesMissed: {}, xg: {}, xa: {}, bigGames: {}, minutes: {} };
  // Permanent, never-reset per-player totals (goals, assists, apps, etc.)
  // across every season the save has ever played — this is what the
  // Players tab / player profile's "Career (competitive)" panel reads from.
  // `stats` above is deliberately a *season-scoped* leaderboard bucket used
  // to compute the current season's Golden Boot/Ballon d'Or/etc. and gets
  // wiped by archiveAndResetGlobalAwards() at every season end; careerStats
  // uses the exact same shape but is only ever added to, never reset, so
  // ending a season doesn't erase a player's lifetime totals.
  let careerStats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, cards: {}, motm: {}, puskas: {}, ratings: {}, interceptions: {}, tackles: {}, blocks: {}, chancesCreated: {}, bigChancesMissed: {}, xg: {}, xa: {}, bigGames: {}, minutes: {} };
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
  // playerId -> array of past injury records, newest first, capped at 20 per
  // player so persisted save size stays bounded — unlike injuryBook above
  // (only ever holds a player's CURRENT injury, deleted once they're fit
  // again), this is a permanent history that survives recovery, matches,
  // and End Season alike. Populated alongside injuryBook in tryInjury() (see
  // engine/injuries.js). Each entry: { defId, type, bodyPart, severity,
  // cause, opponent, competition, minute, matchesOut, teamName, matchDay }.
  // Rendered on the player profile by renderPlayerInjuryLogHTML() in
  // ui/playersUI.js.
  let injuryLog = {};
  let suspensionBook = {}; // playerId -> { matchesLeft, teamName, playerName } — 1-match ban after a red card
  let globalMatchDay = 1;
  // {name, team, type, date, category:'season'|'season-global'|'tournament', year, player, run}
  // name    — matches a key in trophies.json so trophyMark() can resolve an image
  // team    — winning club/nation (team trophies) or the winning player's team (individual awards)
  // player  — winning player's name, only set for individual awards (feeds the Teams-tab trophy cabinet)
  // year    — season year (season/season-global trophies)
  // run     — shared id for every trophy awarded out of the same standalone tournament run
  let trophies = [];
  // Counter for the "End Season" button's standalone awards cycle — used to
  // tag/group archived global awards (Ballon d'Or, Gerd Müller Award, etc.) when
  // it's pressed with no Season Calendar running, so History can still
  // group them sensibly. Bumped once per standalone press, independent of
  // any season's own `year`.
  let standaloneAwardsRound = 0;
  let currentMatch = null;
  let simInterval = null;
  let simSpeed = 400;
  let isPlaying = false;
  let tournament = null;
  let tournamentType = 'worldcup';
  // Optional scale-up override for the two formats big enough to have a
  // real-world field size worth exceeding (World Cup: 48 -> 64/128 teams;
  // Champions League: 36 -> 72/144 clubs). null means "use the format's
  // normal real-world size" — see the Tournament Size picker wired up in
  // selectTournamentFormat()/selectTournamentSize() (ui/seasonUI.js) and
  // consumed by startWorldCupTournament()/startUCLTournament()
  // (simulation/tournamentEngine.js). Ignored by every other format.
  let tournamentSize = null;

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
  // Each domestic league also runs its own single-elimination domestic cup
  // (season.cups[leagueKey]) alongside the league table — same club pool,
  // reusing the exact knockout-bracket machinery the Champions League
  // knockout stage already uses (buildKnockoutFromWinners/winnerOfResult).
  const SEASON_CUP_NAMES = {
    epl: 'FA Cup', laliga: 'Copa del Rey', seriea: 'Coppa Italia',
    bundesliga: 'DFB-Pokal', ligue1: 'Coupe de France'
  };
  // Real top-flight seasons run August through May — used purely for the
  // "Month" label on the season header, derived from how far through the
  // league's fixture list the season currently is (see computeSeasonMonth).
  const FOOTBALL_MONTHS = ['August', 'September', 'October', 'November', 'December',
    'January', 'February', 'March', 'April', 'May'];
  // The World Cup is played once every 4 seasons (a real-life-style 4-year
  // cycle) — see startQualifyingCampaign/startWorldCupFromQualifiers in
  // simulation/worldEngine.js. Every OTHER season, the pool of senior
  // national teams (any team in teamsData.national whose name has no year
  // in it — the "legend"/historic squads all do, e.g. "Brazil 1962") plays
  // through a qualifying campaign to whittle down to the 48-team World Cup
  // field, exactly like real FIFA qualifying feeding the finals.
  const WORLD_CUP_INTERVAL = 4;
  let worldCup = null; // active World Cup finals object, or null between cycles
  let qualifiers = null; // active qualifying campaign object, or null
  let season = null; // active season object, or null if not started
  let seasonSetup = {
    selections: { epl: new Set(), laliga: new Set(), seriea: new Set(), bundesliga: new Set(), ligue1: new Set() },
    search: { epl: '', laliga: '', seriea: '', bundesliga: '', ligue1: '' }
  };
  // ========== CAREER MODE ==========
  // The single club (or none) the person is manually managing, shared across
  // both Season Calendar and Tournament mode — like FIFA/eFootball Career
  // Mode. When set: that club's own fixtures must be played live (with
  // manual tactics/formation/subs — see engine/tactics.js) instead of being
  // auto-simmed by "Simulate Matchday"/"Simulate Round", and every OTHER
  // club's "Play Live" option is hidden in favour of "Instant" only, so the
  // person only ever steps onto the pitch for their own team's matches.
  let careerTeamId = null;
  let seasonActiveTab = 'epl';
  let seasonActiveSubTab = 'table'; // 'table' | 'stats' | 'awards' — sub-view within a league/UCL tab
  let seasonReportRegistry = []; // flat list of match reports referenced by index from season fixture cards
  let historyActiveTab = 'team'; // 'team' | 'individual' — which History sub-tab is showing
  let historyAwardFilter = 'all'; // 'all' or a specific trophy name — filters the current History sub-tab

  const FORMATIONS = {
    '4-3-3': { name: '4-3-3', slots: ['GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'CDM', 'CM', 'RW', 'ST', 'LW'],
    coords: [[50,92],[89.3,70.6],[62,75],[35,75.2],[10.7,70.6],[73.2,43.1],[50.8,57.1],[28.2,43.1],[89.3,24.4],[50,18],[11.8,25]] },
    '4-4-2': { name: '4-4-2', slots: ['GK','RB','CB','CB','LB','RM','CM','CM','LM','ST','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[82,48],[58,50],[42,50],[18,48],[58,20],[42,20]] },
    '4-2-3-1': { name: '4-2-3-1', slots: ['GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'CDM', 'CAM', 'RW', 'LW', 'ST'],
    coords: [[50,92],[88.6,73],[64,75.5],[38,75],[12.8,72.1],[66.9,53],[35.2,53.2],[49.9,31.8],[78,30],[22,30],[49.1,15.4]] },
    '3-5-2': { name: '3-5-2', slots: ['GK','CB','CB','CB','RB','CM','CM','CM','LB','ST','ST'],
      coords: [[50,92],[68,75],[50,78],[32,75],[88,55],[62,48],[50,50],[38,48],[12,55],[58,20],[42,20]] },
      '3-5-2-cm': { name: '3-5-2 (Mid)', slots: ['GK', 'CB', 'CB', 'CB', 'RM', 'CM', 'CM', 'CM', 'LM', 'ST', 'ST'],
    coords: [[50,92],[80.5,72.5],[53.2,74.2],[23.7,73.3],[93,43.6],[71.5,45],[50.6,44.9],[32.3,44.5],[11.7,43.2],[66.9,16.2],[34.7,16]] },
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

  // Player-to-slot eligibility (canPlay(), in ui/teamUI.js) is decided
  // purely by whether the slot is literally one of the player's own listed
  // positions (after alias canonicalization below) — there is no separate
  // "tactically adjacent position" compatibility table. A table like that
  // used to live here and get consulted for eligibility, which is what let
  // a player be selected/subbed into a real position he doesn't actually
  // play (e.g. a pure centre-back at CDM, a pure striker out on the wing)
  // just because the two positions were deemed broadly similar.

  // Sensible in-slot role changes for the squad builder — tapping a
  // position on the pitch (e.g. CM) offers only the handful of role
  // shifts that stay tactically coherent for that same physical slot
  // (CM can push forward to CAM or drop to CDM; it can't become a
  // winger or a centre-back). This is a squad-builder display convenience
  // only — it answers "what can this slot itself become in the editor",
  // never "is a given player eligible to fill this slot" (that's canPlay()
  // above, decided solely by the player's own listed positions). Every
  // list includes its own code first so callers can always fall back to
  // "no change" as option one.
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
  // sweeper (SW). FORMATIONS/POS_LINE and canPlay() only ever speak the
  // one canonical code per position (e.g. ST, not CF) — so any player whose
  // pos array uses a variant spelling would silently never match a
  // formation slot at all, exact or otherwise. That's the "ST gets
  // preferred over CF" bias: normalizePositions() (called once per team
  // right after teams.json/player-attributes.json load, see init() in
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
  // The four broad-line values POS_LINE can produce — used by the Players
  // tab position filter to tell a broad-line pick ("all defenders") apart
  // from a specific-slot pick ("RB" only), since both share the same
  // <select> (see filterPlayersPos() in ui/playersUI.js).
  const POS_LINE_GROUPS = ['GK', 'DEF', 'MID', 'FWD'];

  // Shared OVR-tier bucketing for the Players/Teams tab rating filters —
  // one scale so "Elite"/"Great"/"Good"/"Development" mean the same cutoffs
  // everywhere they're offered (see filterPlayersRating() in ui/playersUI.js
  // and filterTeamsRating() in ui/teamUI.js).
  function ovrTierMatches(ovr, tier) {
    const v = ovr || 0;
    if (tier === 'elite') return v >= 85;
    if (tier === 'great') return v >= 75 && v < 85;
    if (tier === 'good') return v >= 65 && v < 75;
    if (tier === 'dev') return v < 65;
    return true;
  }
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

  // ---- Per-position contribution to team ATTACKING/DEFENSIVE strength
  // (calcTeamStrength() in engine/matchEngine.js). These are distinct from
  // the SHAPE_* weights above: SHAPE_* measures how a *formation's slot
  // count* shifts strength (more forwards = more attacking bodies on the
  // pitch), while POS_ATT_WEIGHT/POS_DEF_WEIGHT measure how much a given
  // *player*, in the slot he's actually playing, should count toward each
  // end of the team's strength rating. Previously every outfield player
  // (and the GK) counted equally toward both att and def regardless of
  // position, so a back four could make a mediocre attack look dangerous
  // and a strong front three drag a poor defense's rating up — this table
  // is what makes a striker's finishing actually drive attacking strength
  // and a center-back's defending actually drive defensive strength, while
  // a player miscast out of position (or out of possession entirely, like
  // a CB's attacking input) counts for comparatively little.
  // The goalkeeper is intentionally 0 in both: his shot-stopping is its own
  // separate contribution (see gkShotStoppingRating() in
  // engine/goalkeeper.js and the `gk` field calcTeamStrength() returns),
  // not a blend into the outfield att/def numbers.
  const POS_ATT_WEIGHT = {
    GK: 0,
    CB: 0.10, RB: 0.10, LB: 0.10, RWB: 0.10, LWB: 0.10,
    CDM: 0.25,
    CM: 0.45,
    CAM: 0.75,
    RM: 0.55, LM: 0.55,
    RW: 0.85, LW: 0.85,
    ST: 1.00, CF: 1.00
  };
  const POS_DEF_WEIGHT = {
    GK: 0,
    CB: 1.00,
    RB: 0.85, LB: 0.85, RWB: 0.85, LWB: 0.85,
    CDM: 0.75,
    CM: 0.35,
    CAM: 0.20,
    RM: 0.25, LM: 0.25,
    RW: 0.10, LW: 0.10,
    ST: 0, CF: 0
  };
  // Whichever slot a player is actually deployed in this match (their
  // formation slot, falling back to their primary listed position) is what
  // should decide their positional weight — a winger pushed into CM should
  // weigh in like a CM, not like a winger.
  function posWeightSlot(p) {
    return (p && (p.slot || (p.pos || [])[0])) || 'CM';
  }
  function posAttWeight(p) {
    const slot = posWeightSlot(p);
    return POS_ATT_WEIGHT[slot] != null ? POS_ATT_WEIGHT[slot] : 0.45;
  }
  function posDefWeight(p) {
    const slot = posWeightSlot(p);
    return POS_DEF_WEIGHT[slot] != null ? POS_DEF_WEIGHT[slot] : 0.35;
  }
/*@CHUNK:c0000:END*/
