/**
 * competitions.js
 *
 * Registry of every selectable Tournament-tab format, plus the shared logic
 * for resolving each format's eligible team pool from leagues.json.
 *
 * Every format below reuses one of the four tournament engines that already
 * exist in simulation/tournamentEngine.js, simulation/worldEngine.js,
 * simulation/knockoutEngine.js and simulation/leagueTournamentEngine.js — no
 * new simulation logic is introduced here:
 *   'groups'   — group stage + single-match knockout (World Cup engine)
 *   'league'   — league phase + playoffs + two-leg knockout (Champions
 *                League engine)
 *   'knockout' — straight single-elimination bracket from Round 1 (a
 *                lighter reuse of the same knockout bracket the other two
 *                engines advance into once their group/league phase ends)
 *   'table'    — a real home-and-away, double round-robin domestic league
 *                season (Premier League, La Liga, Serie A, Bundesliga,
 *                Ligue 1) — no groups and no knockout bracket, table topper
 *                is champion. Reuses the exact same scheduler/table math as
 *                Season Calendar's per-league competitions.
 *
 * `pool` selects which side of teams.json the team picker offers ('national'
 * or 'club'). `leaguesKey`, when set, looks up that competition's eligible
 * team names in leagues.json and restricts the picker to just those
 * clubs/nations; when null (World Cup, Champions League) the full national/
 * club pool is offered, exactly as before this file existed.
 */
/*@CHUNK:ccomp01:START*/
  const TOURNAMENT_FORMATS = {
    'worldcup': { name: 'World Cup', short: 'World Cup', engine: 'groups', pool: 'national', leaguesKey: null,
      desc: 'Select national teams. Supports groups (48 teams, World Cup style — use the Tournament Size picker below to scale up to a 64- or 128-team field instead).' },
    'ucl': { name: 'Champions League', short: 'Champions League', engine: 'league', pool: 'club', leaguesKey: null,
      desc: 'Champions League 2024+ format: select up to 36 clubs (use the Tournament Size picker below to scale up to 72 or 144). League phase (8 matches each), playoffs, two-leg knockouts, single final.' },
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
/*@CHUNK:ccomp01:END*/
