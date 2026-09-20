/**
 * leagueTournamentEngine.js
 *
 * Full home-and-away domestic league seasons (Premier League, La Liga,
 * Serie A, Bundesliga, Ligue 1) played out inside Tournament mode.
 *
 * This does not introduce a new scheduler or table math — it reuses the
 * exact double round-robin builder and standings math Season Calendar's
 * per-league competitions already use (buildDoubleRoundRobinRounds,
 * blankSeasonRow, applyResultToTable, sortedTable, simulateRoundFixtures in
 * simulation/seasonEngine.js), and the same champion/awards/trophy pipeline
 * every other tournament format shares (assignTournamentAwards, setChampion,
 * pushTeamTrophy, etc. in simulation/tournamentEngine.js).
 *
 * tournament.format is 'table' here — distinct from 'league', which is the
 * Champions League league-phase-then-knockout format. A 'table' tournament
 * has no groups and no knockout bracket: the club that tops the table after
 * every matchday is champion, exactly like a real league season.
 */
/*@CHUNK:ctle0001:START*/
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
    if (btn) { btn.textContent = 'Simulate Matchday'; btn.disabled = false; }
    toast((cfg.name || 'League') + ': ' + teams.length + ' clubs, ' + rounds.length + '-matchday season');
  }
/*@CHUNK:ctle0001:END*/

/*@CHUNK:ctle0002:START*/
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
/*@CHUNK:ctle0002:END*/

/*@CHUNK:ctle0003:START*/
  // Bulk-simulates the current matchday only (the "Simulate Matchday"
  // button) — called from _simTournamentRoundWork()'s format dispatch.
  function simLeagueTournamentRound() {
    if (!tournament || tournament.format !== 'table') return;
    const round = tournament.rounds[tournament.currentRound];
    if (!round) { finishLeagueTournament(); renderLeagueTableTournament(); refreshTournamentStatsUI(); return; }
    simulateRoundFixtures(round, { allowET: false, allowPens: false, skipCareer: true }, (fx) => {
      applyResultToTable(tournament.table, fx.home, fx.away, fx.homeScore, fx.awayScore);
    });
    // Career Mode: hold this matchday here if the person's own fixture is
    // still pending (same skipCareer pattern as simulateLeagueRound in
    // simulation/seasonEngine.js) — playLeagueTournamentFixture()/
    // simLeagueTournamentFixture() advance currentRound for real once
    // they've actually played it.
    if (!round.every(f => f.played)) { renderLeagueTableTournament(); refreshTournamentStatsUI(); return; }
    tournament.currentRound++;
    if (tournament.currentRound >= tournament.rounds.length) {
      finishLeagueTournament();
    }
    // Always re-render, whether this was an ordinary matchday or the final
    // one — previously the final-matchday branch skipped this call entirely,
    // so the standings table/fixture list stayed frozen on the second-to-last
    // matchday's state (e.g. showing 37 of 38 games played) and the "Simulate
    // Matchday" button/title never updated to reflect the season being over,
    // even though tournament.table and tournament.champion were already
    // correct underneath.
    renderLeagueTableTournament();
    if (tournament.currentRound < tournament.rounds.length) {
      const stageTitle = document.getElementById('tour-stage-title');
      if (stageTitle) stageTitle.textContent = 'Matchday ' + (tournament.currentRound + 1) + ' of ' + tournament.rounds.length;
    }
    refreshTournamentStatsUI();
  }
/*@CHUNK:ctle0003:END*/

/*@CHUNK:ctle0004:START*/
  // Simulates every remaining matchday — called from _simAllTournamentWork()'s
  // format dispatch, which supplies the same progress-bar/yielding helpers
  // (updateLoading, updateLoadingProgress, simTick) every other bulk-sim path
  // in that function already uses, so a full-season sim doesn't freeze the tab.
  async function simAllLeagueTournament(updateLoading, updateLoadingProgress, startTime) {
    if (!tournament || tournament.format !== 'table') return;
    // Career Mode: see simulateSeasonToEnd's identical guard in
    // simulation/seasonEngine.js — fast-forwarding the whole competition
    // isn't compatible with playing your own club's matches by hand.
    if (careerTeamId) { toast('Career Mode: play your own matches first — simulating the whole competition is disabled while managing a club.'); return; }
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
/*@CHUNK:ctle0004:END*/

/*@CHUNK:ctle0005:START*/
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
/*@CHUNK:ctle0005:END*/

/*@CHUNK:ctle0006:START*/
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
    // Career Mode: keep the person's own club at its real formation/custom
    // XI instead of randomizing it — same treatment as playSeasonFixture in
    // simulation/seasonEngine.js. Only the AI opponent still gets randomized.
    const isCareerHome = careerTeamId && home.id === careerTeamId;
    const isCareerAway = careerTeamId && away.id === careerTeamId;
    const formKeys = Object.keys(FORMATIONS);
    const hf = isCareerHome ? pickTeamFormation(home) : formKeys[Math.floor(seededRandom() * formKeys.length)];
    const af = isCareerAway ? pickTeamFormation(away) : formKeys[Math.floor(seededRandom() * formKeys.length)];
    const hForm = document.getElementById('home-formation');
    const aForm = document.getElementById('away-formation');
    if (hForm) hForm.value = hf;
    if (aForm) aForm.value = af;
    if (!isCareerHome) customLineups.home = null;
    if (!isCareerAway) customLineups.away = null;
    updateTeamPreview('home'); updateTeamPreview('away');
    startMatch();
    toast((isCareerHome || isCareerAway) ? 'Your match — take control!' : ((tournament.competitionName || 'League') + ' — live · formations randomized'));
  }
/*@CHUNK:ctle0006:END*/
