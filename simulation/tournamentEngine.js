/*@CHUNK:c0358:START*/

/*@CHUNK:c0358:END*/

/*@CHUNK:c0359:START*/
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
    tournamentStats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, motm: {}, ratings: {}, puskas: {}, interceptions: {}, tackles: {}, blocks: {}, chancesCreated: {}, bigChancesMissed: {}, xg: {}, xa: {}, bigGames: {}, minutes: {} };
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
/*@CHUNK:c0359:END*/

/*@CHUNK:c0362:START*/

/*@CHUNK:c0362:END*/

/*@CHUNK:c0363:START*/
  function startUCLTournament(selected) {
    let teams = shuffleArray([...selected]);
    // Champions League can be scaled past the real-world 36-club league
    // phase via the Tournament Size picker (36/72/144 — see
    // SCALABLE_TOURNAMENT_SIZES in ui/seasonUI.js); prefer that target, or
    // the largest even count >= 8 if fewer teams were selected (scale
    // format).
    const maxTeams = (tournamentType === 'ucl' && tournamentSize) ? tournamentSize : 36;
    if (teams.length >= maxTeams) teams = teams.slice(0, maxTeams);
    else if (teams.length % 2 === 1) teams = teams.slice(0, teams.length - 1);
    const cfg = TOURNAMENT_FORMATS[tournamentType] || {};
    const compName = cfg.name || 'Champions League';
    if (teams.length < 8) { toast(compName + ' needs at least 8 clubs (' + maxTeams + ' ideal)'); return; }

    const league = teams.map(t => ({
      team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0
    }));

    const matchesPerTeam = teams.length >= maxTeams ? 8 : Math.min(8, teams.length - 1);
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
/*@CHUNK:c0363:END*/

/*@CHUNK:c0364:START*/

/*@CHUNK:c0364:END*/

/*@CHUNK:c0365:START*/
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
/*@CHUNK:c0365:END*/

/*@CHUNK:c0366:START*/

/*@CHUNK:c0366:END*/

/*@CHUNK:c0367:START*/
  function blankLeagueRow(team) {
    return { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 };
  }
/*@CHUNK:c0367:END*/

/*@CHUNK:c0368:START*/

/*@CHUNK:c0368:END*/

/*@CHUNK:c0369:START*/
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
/*@CHUNK:c0369:END*/

/*@CHUNK:c0370:START*/

/*@CHUNK:c0370:END*/

/*@CHUNK:c0371:START*/
  function sortedLeague() {
    return [...(tournament.league || [])].sort((a, b) =>
      b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf
    );
  }
/*@CHUNK:c0371:END*/

/*@CHUNK:c0376:START*/


/*@CHUNK:c0376:END*/

/*@CHUNK:c0377:START*/
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
/*@CHUNK:c0377:END*/

/*@CHUNK:c0380:START*/

/*@CHUNK:c0380:END*/

/*@CHUNK:c0381:START*/
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
/*@CHUNK:c0381:END*/

/*@CHUNK:c0382:START*/

/*@CHUNK:c0382:END*/

/*@CHUNK:c0383:START*/
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
/*@CHUNK:c0383:END*/

/*@CHUNK:c0384:START*/


/*@CHUNK:c0384:END*/

/*@CHUNK:c0385:START*/
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
/*@CHUNK:c0385:END*/

/*@CHUNK:c0386:START*/

/*@CHUNK:c0386:END*/

/*@CHUNK:c0387:START*/
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
      // Same fix as the bulk "Simulate All" loop above: call the actual
      // simulation work directly rather than simPlayoffTie(), which defers
      // the real work behind requestAnimationFrame/setTimeout and would
      // otherwise still be pending when withLoading() (the caller of this
      // whole function) hides the loading overlay and calls finishUCLPlayoffs()/
      // renders the bracket — the same race that could truncate or blank
      // out the Round of 16/Quarter-finals on "Simulate All".
      tournament.playoff.forEach((p, i) => { if (!p.played) _simPlayoffTieWork(i); });
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
/*@CHUNK:c0387:END*/

/*@CHUNK:c0388:START*/

/*@CHUNK:c0388:END*/

/*@CHUNK:c0389:START*/
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
/*@CHUNK:c0389:END*/

/*@CHUNK:c0390:START*/

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
/*@CHUNK:c0390:END*/

/*@CHUNK:c0391:START*/
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
            // Call the actual simulation work directly, NOT simPlayoffTie()
            // — that one wraps it in withLoading(), which defers the real
            // work behind two requestAnimationFrame calls plus a 50ms
            // setTimeout (so a single manual click gets to paint its
            // spinner first) and returns before any of that has actually
            // run. Calling it un-awaited here just fired off 8+ overlapping
            // deferred simulations that raced each other, the "Simulating
            // knockout rounds…" step right below, and even the overlay
            // being hidden once withLoadingProgress() (the caller of this
            // whole function) resolved — which is exactly why R16/QF
            // results were sometimes still showing "-", why the round of
            // 16 could end up truncated straight to a Quarter-finals bracket
            // (finishUCLPlayoffs() below reading still-null p.winner values
            // and buildUCLKnockoutFromTeams() rounding the resulting
            // under-16 team count down to the next power of 2), and why the
            // knockout stage kept visibly simulating after the loading
            // screen had already gone away. _simPlayoffTieWork() is the
            // same low-level function withLoading() eventually calls, just
            // run synchronously in lockstep with this loop — identical to
            // how the knockout-round loop further below already correctly
            // calls simTwoLegTie()/simSingleFinal() directly rather than
            // any UI-wrapped equivalent.
            try { _simPlayoffTieWork(i); } catch (e) { console.warn(e); }
            done++; updateLoadingProgress(done, total, startTime); await simTick();
          }
        }
        // _simPlayoffTieWork() above already calls finishUCLPlayoffs()
        // itself the moment the last tie finishes (advancing tournament.stage
        // to 'knockout'), so this only needs to cover the case where every
        // playoff tie was already played BEFORE this bulk sim even started
        // (stage never got the chance to advance) — checking stage alone
        // avoids redundantly rebuilding the R16 bracket a second time.
        if (tournament.stage === 'playoff') {
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
/*@CHUNK:c0391:END*/

/*@CHUNK:c0392:START*/


/*@CHUNK:c0392:END*/

/*@CHUNK:c0393:START*/
  function simUCLFixture(idx) {
    if (!tournament || !tournament.fixtures[idx] || tournament.fixtures[idx].played) return;
    showLoading('Simulating match…');
    setTimeout(function() {
      try { _simUCLFixtureWork(idx); }
      finally { hideLoading(); refreshTournamentStatsUI(); try { renderUCLLeague(); renderUCLFixtures(); } catch(e) {} persistAll(); }
    }, 30);
  }
/*@CHUNK:c0393:END*/

/*@CHUNK:c0394:START*/
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
/*@CHUNK:c0394:END*/

/*@CHUNK:c0395:START*/

/*@CHUNK:c0395:END*/

/*@CHUNK:c0396:START*/
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
/*@CHUNK:c0396:END*/

/*@CHUNK:c0397:START*/


/*@CHUNK:c0397:END*/

/*@CHUNK:c0398:START*/
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
/*@CHUNK:c0398:END*/

/*@CHUNK:c0399:START*/

/*@CHUNK:c0399:END*/

/*@CHUNK:c0400:START*/
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
/*@CHUNK:c0400:END*/

/*@CHUNK:c0401:START*/

/*@CHUNK:c0401:END*/

/*@CHUNK:c0402:START*/
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
/*@CHUNK:c0402:END*/

/*@CHUNK:c0403:START*/

/*@CHUNK:c0403:END*/

/*@CHUNK:c0404:START*/
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
/*@CHUNK:c0404:END*/

/*@CHUNK:c0405:START*/

/*@CHUNK:c0405:END*/

/*@CHUNK:c0406:START*/
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
/*@CHUNK:c0406:END*/

/*@CHUNK:c0407:START*/

/*@CHUNK:c0407:END*/

/*@CHUNK:c0408:START*/
  function simTwoLegTie(m) {
    // Leg 1 at away stadium (away hosts)
    const r1 = simQuickMatch(m.away, m.home, { allowET: false, allowPens: false });
    m.leg1 = { played: true, homeScore: r1.home, awayScore: r1.away, report: r1.report };
    // Leg 2 at home stadium. aggHomeStart/aggAwayStart tell the match engine
    // what each side is already carrying over from leg 1, so it can decide
    // to go to extra time/penalties based on the AGGREGATE scoreline —
    // exactly like real two-legged UEFA ties — rather than only when leg 2
    // itself happens to finish level (a tie can easily be level on
    // aggregate, e.g. 2-0 then 0-2, while leg 2 alone finishes decisively).
    const r2 = simQuickMatch(m.home, m.away, {
      allowET: true, allowPens: true,
      aggHomeStart: r1.away, aggAwayStart: r1.home
    });
    m.leg2 = { played: true, homeScore: r2.home, awayScore: r2.away, report: r2.report };
    m.aggHome = r1.away + r2.home;
    m.aggAway = r1.home + r2.away;
    m.homeScore = m.aggHome;
    m.awayScore = m.aggAway;
    // r2.pens is now populated whenever the AGGREGATE was level after leg 2
    // (see the aggHomeStart/aggAwayStart-aware checks in engine/
    // matchEngine.js), so it's always trustworthy here — no more coin-flip
    // fallback needed for a tie that's genuinely level on aggregate.
    if (r2.pens) {
      m.winner = r2.pens.home > r2.pens.away ? m.home : m.away;
      m.pens = r2.pens;
      m.penalties = true;
    } else if (m.aggHome > m.aggAway) {
      m.winner = m.home;
    } else {
      m.winner = m.away;
    }
    m.played = true;
    m.report = r2.report;
  }
/*@CHUNK:c0408:END*/

/*@CHUNK:c0409:START*/

/*@CHUNK:c0409:END*/

/*@CHUNK:c0410:START*/
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
/*@CHUNK:c0410:END*/

/*@CHUNK:c0413:START*/


/*@CHUNK:c0413:END*/

/*@CHUNK:c0414:START*/
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
/*@CHUNK:c0414:END*/

/*@CHUNK:c0417:START*/

/*@CHUNK:c0417:END*/

/*@CHUNK:c0418:START*/
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
/*@CHUNK:c0418:END*/

/*@CHUNK:c0419:START*/

/*@CHUNK:c0419:END*/

/*@CHUNK:c0420:START*/
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
/*@CHUNK:c0420:END*/

/*@CHUNK:c0421:START*/


/*@CHUNK:c0421:END*/

/*@CHUNK:c0422:START*/
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

  // Writes the real 3rd Place Play-off result into tournament.thirdPlace/
  // fourthPlace. Called both from setChampion() (bulk-sim path, where the
  // playoff is always already played by the time the Final concludes) and
  // from afterKnockoutMatchPlayed() (single-match Live/Instant path, where
  // the user can play the Final and the 3rd Place Play-off in either
  // order) — so however the two fixtures get played, tournament.thirdPlace/
  // fourthPlace always end up reflecting the actual playoff result, not a
  // semi-final-loser guess that never gets corrected.
  function updateThirdPlaceFromPlayoff(match) {
    if (!match || !match.played) return;
    tournament.thirdPlace = match.winner || null;
    tournament.fourthPlace = match.winner ? (match.winner.id === match.home.id ? match.away : match.home) : null;
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
/*@CHUNK:c0422:END*/

/*@CHUNK:c0423:START*/


/*@CHUNK:c0423:END*/

/*@CHUNK:c0424:START*/
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
    // (World Cup mode), otherwise fall back to the semi-final losers (an
    // interim guess for when the Final finished before the playoff was
    // played — see updateThirdPlaceFromPlayoff(), which overwrites this
    // with the real result the moment that match is actually played,
    // whichever order the user tackles the two fixtures in).
    const thirdPlaceRound = (tournament.knockout || []).find(r => r.name === '3rd Place Play-off');
    if (thirdPlaceRound && thirdPlaceRound.matches && thirdPlaceRound.matches[0] && thirdPlaceRound.matches[0].played) {
      updateThirdPlaceFromPlayoff(thirdPlaceRound.matches[0]);
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
    pushTeamTrophy(tName, team, 'Tournament', runExtra);
    pushManagerAward(tName + ' Winning Manager', team, 'Tournament', runExtra);
    assignTournamentAwards();
    recordIndividualAwardsFromAwardsObject(tournament.awards, tName + ' Tournament', runExtra);
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.innerHTML = 'Champions: ' + teamMark(team, 20) + ' ' + team.name;
    renderTournamentPodium();
    persistAll();
  }
/*@CHUNK:c0424:END*/

/*@CHUNK:c0431:START*/

  
/*@CHUNK:c0431:END*/

/*@CHUNK:c0432:START*/
  // Counts how many matches a given team has actually played so far in the
  // current standalone Tournament, across whichever structures apply to its
  // format — a full round-robin table (domestic league tournament), a
  // league-phase table (Champions League format) and/or a group table
  // (World Cup format) — plus every knockout-stage round layered on top
  // (straight cup knockouts, World Cup knockout, Champions League knockout
  // playoff + bracket). Used below to gauge what share of the team's
  // matches a given player actually featured in, for Golden Ball eligibility.
  function tournamentTeamMatchesPlayed(teamId) {
    if (!tournament || !teamId) return 0;
    let total = 0;
    if (tournament.table && tournament.table.length) {
      const row = tournament.table.find(r => r.team && r.team.id === teamId);
      return row ? (row.played || 0) : 0;
    }
    if (tournament.league && tournament.league.length) {
      const row = tournament.league.find(r => r.team && r.team.id === teamId);
      if (row) total += row.played || 0;
    }
    if (tournament.groups && tournament.groups.length) {
      tournament.groups.forEach(g => {
        const row = (g.teams || []).find(t => t.team && t.team.id === teamId);
        if (row) total += row.played || 0;
      });
    }
    (tournament.knockout || []).forEach(round => {
      (round.matches || []).forEach(m => {
        if (!m.played) return;
        if ((m.home && m.home.id === teamId) || (m.away && m.away.id === teamId)) total++;
      });
    });
    return total;
  }

  // Golden Ball ranking for a standalone Tournament. Unlike the Ballon d'Or
  // (which weighs goals/assists/trophies/consistency holistically off the
  // player's whole body of work), the tournament Golden Ball is now a
  // simpler, stricter test of reliability rather than a hot streak of goal
  // contributions:
  //  - eligibility requires having appeared in at least 90% of the player's
  //    own team's matches in this tournament — a super-sub with a couple of
  //    huge cameos can no longer out-rank the players who started nearly
  //    every game;
  //  - among those eligible, the winner is simply whoever has the highest
  //    average match rating — goals/assists no longer contribute at all;
  //  - ties (and, deliberately, very close calls) favor a player from the
  //    tournament-winning team, then whoever made more appearances.
  function computeTournamentGoldenBallRanking() {
    if (!tournament) return [];
    const championId = tournament.champion ? tournament.champion.id : null;
    return Object.values(tournamentStats.ratings || {})
      .filter(p => (p.count || 0) > 0)
      .map(p => {
        const teamMatches = tournamentTeamMatchesPlayed(p.teamId);
        return Object.assign({}, p, {
          teamMatches,
          appPct: teamMatches > 0 ? (p.count || 0) / teamMatches : 0
        });
      })
      .filter(p => p.appPct >= 0.9)
      .sort((a, b) => {
        if (b.avg !== a.avg) return b.avg - a.avg;
        const aChamp = championId && a.teamId === championId ? 1 : 0;
        const bChamp = championId && b.teamId === championId ? 1 : 0;
        if (bChamp !== aChamp) return bChamp - aChamp;
        return (b.count || 0) - (a.count || 0);
      });
  }

  function assignTournamentAwards() {
    if (!tournament) return;
    const top = (key) => Object.values(tournamentStats[key] || {}).sort((a,b) => b.count - a.count);
    const goals = top('goals');
    const motm = top('motm');
    const ratingsAny = Object.values(tournamentStats.ratings || {})
      .filter(x => (x.count || 0) > 0)
      .sort((a,b) => b.avg - a.avg || b.count - a.count);

    // Golden Ball: 90%-of-team's-matches appearance requirement + highest
    // average rating, preferring the tournament-winning team's players — see
    // computeTournamentGoldenBallRanking() above. Falls back to any-rated
    // player / a repeat MOTM only in the unlikely case nobody clears the
    // 90% appearance bar (e.g. a very short tournament).
    const goldenBallRanking = computeTournamentGoldenBallRanking();

    // Ballon d'Or, Gerd Müller Award and Yashin Trophy are deliberately NOT
    // computed or awarded here. All three are season-wide honors in real
    // life, not single-tournament ones, so none of them should be handed
    // out just for winning one standalone Tournament (World Cup / Champions
    // League run) — they're only ever computed and archived once, off the
    // global `stats` bucket (the player's whole body of work so far), when
    // a season actually ends: either automatically
    // (finalizeSeasonIfComplete) or via the "End Season" button
    // (endSeasonNow), both in seasonEngine.js. Leaving no `ballonDor`,
    // `gerdMuller` or `yashin` key on this awards object means
    // recordIndividualAwardsFromAwardsObject() below won't push any of
    // those three as a premature extra trophy into the case for this one
    // tournament.

    // Golden Boot, Golden Ball and Golden Glove are the three genuine
    // single-tournament individual awards real competitions (World Cup,
    // Euros, Champions League) actually hand out — those stay.
    //
    // Top Assists, Most MOTM, Clean Sheet King and the Puskás Award are NOT
    // standalone-tournament honors in real life — same reasoning as the
    // Ballon d'Or/Gerd Müller/Yashin exclusion above (Puskás is FIFA's own
    // annual/season award; "most assists"/"most MOTM"/"most clean sheets"
    // across a whole season are seasonEngine.js's job via assignCompAwards(),
    // not something a single World Cup/Champions League run should be
    // handing out its own trophy for). Leaving these four keys off means
    // recordIndividualAwardsFromAwardsObject() won't push any of them into
    // the trophy case for a standalone tournament, and the Tournament
    // Awards screen won't display a "winner" for something that was never
    // a real award to begin with.
    tournament.awards = {
      goldenBoot: goals[0] || null,
      goldenBall: goldenBallRanking[0] || ratingsAny[0] || (motm[0] && (motm[0].count >= 2) ? motm[0] : null) || null,
      goldenGlove: computeGoldenGloveRanking(tournamentStats)[0] || null
    };
  }
/*@CHUNK:c0432:END*/

/*@CHUNK:c0441:START*/


/*@CHUNK:c0441:END*/

/*@CHUNK:c0442:START*/
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
/*@CHUNK:c0442:END*/

/*@CHUNK:c0443:START*/
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
/*@CHUNK:c0443:END*/

/*@CHUNK:c0444:START*/

/*@CHUNK:c0444:END*/

/*@CHUNK:c0445:START*/
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
/*@CHUNK:c0445:END*/

/*@CHUNK:c0446:START*/


/*@CHUNK:c0446:END*/

/*@CHUNK:c0447:START*/
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
    // fourthPlace — normally read by setChampion() once the real Final
    // finishes, but the user is free to play the Final first (both
    // fixtures appear together as soon as the semis finish), so this
    // always writes the real result here too. Without it, a playoff played
    // after the Final was silently discarded — setChampion() had already
    // locked in a semi-final-loser guess and, once tournament.champion is
    // set, never runs again to pick up the actual result.
    if (current.name === '3rd Place Play-off') {
      updateThirdPlaceFromPlayoff(current.matches[0]);
      if (tournament.champion) {
        renderTournamentPodium();
        persistAll();
      }
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
/*@CHUNK:c0447:END*/

/*@CHUNK:c0448:START*/


/*@CHUNK:c0448:END*/

/*@CHUNK:c0449:START*/
  function resetTournament() {
    tournament = null;
    const setup = document.getElementById('tournament-setup');
    const live = document.getElementById('tournament-live');
    if (setup) setup.style.display = 'block';
    if (live) live.style.display = 'none';
    const btn = document.getElementById('btn-sim-round');
    if (btn) { btn.textContent = 'Simulate Round'; btn.disabled = false; }
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
/*@CHUNK:c0449:END*/
