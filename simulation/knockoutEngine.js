/**
 * knockoutEngine.js
 *
 * Straight single-elimination knockout, used for domestic cups (FA Cup, EFL
 * Cup, Copa del Rey, DFB-Pokal, Coppa Italia, Coupe de France) and the
 * one-off Super Cup curtain-raisers (FA Community Shield, Supercopa de
 * España, DFL-Supercup, Supercoppa Italiana, Trophée des Champions).
 *
 * This does not introduce a new bracket/simulation system — it reuses the
 * exact same knockout bracket, live/instant match simulation, rendering and
 * champion/trophy logic (renderBracket, simKnockoutRound, setChampion, etc.
 * in tournamentEngine.js) that the World Cup and Champions League engines
 * already advance into once their group/league phase ends. This just seeds
 * that bracket directly from the selected teams, skipping straight to
 * Round 1 instead of building group tables or a league phase first. Because
 * tournament.type is 'knockout' here (not 'ucl'), every existing knockout
 * match defaults to a single match with extra time + penalties — correct
 * for a cup tie — and no 3rd-place play-off is created (maybeCreateThirdPlacePlayoff
 * only fires for tournament.type === 'worldcup'), matching how domestic cups
 * actually work.
 */
/*@CHUNK:cko0001:START*/
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
/*@CHUNK:cko0001:END*/
