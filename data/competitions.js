/**
 * competitions.js
 *
 * Registry of every selectable Tournament-tab format, plus the shared logic
 * for resolving each format's eligible team pool from leagues.json.
 *
 * Every format below reuses one of the three tournament engines that already
 * exist in simulation/tournamentEngine.js, simulation/worldEngine.js and
 * simulation/knockoutEngine.js — no new simulation logic is introduced here:
 *   'groups'   — group stage + single-match knockout (World Cup engine)
 *   'league'   — league phase + playoffs + two-leg knockout (Champions
 *                League engine)
 *   'knockout' — straight single-elimination bracket from Round 1 (a
 *                lighter reuse of the same knockout bracket the other two
 *                engines advance into once their group/league phase ends)
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
      desc: 'Select national teams. Supports groups (up to 48 teams, World Cup style).' },
    'ucl': { name: 'Champions League', short: 'Champions League', engine: 'league', pool: 'club', leaguesKey: null,
      desc: 'Champions League 2024+ format: select up to 36 clubs. League phase (8 matches each), playoffs, two-leg knockouts, single final.' },
    'nations-league': { name: 'Nations League', short: 'Nations League', engine: 'groups', pool: 'national', leaguesKey: 'Nations League',
      desc: 'European nations in groups, then knockout. Team picker is restricted to the eligible nations in leagues.json.' },
    'euros': { name: 'European Championship', short: 'Euros', engine: 'groups', pool: 'national', leaguesKey: 'Euros',
      desc: 'European nations compete through groups and knockouts.' },
    'copa-america': { name: 'Copa América', short: 'Copa América', engine: 'groups', pool: 'national', leaguesKey: 'Copa América',
      desc: 'South American nations compete through groups and knockouts.' },
    'afcon': { name: 'Africa Cup of Nations', short: 'AFCON', engine: 'groups', pool: 'national', leaguesKey: 'AFCON',
      desc: 'African nations compete through groups and knockouts.' },
    'asian-cup': { name: 'AFC Asian Cup', short: 'Asian Cup', engine: 'groups', pool: 'national', leaguesKey: 'Asian Cup',
      desc: 'Asian nations compete through groups and knockouts.' },
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
/*@CHUNK:ccomp01:END*/
