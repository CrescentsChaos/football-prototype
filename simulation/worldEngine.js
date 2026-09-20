/*@CHUNK:c0360:START*/

  // Group letter naming, A/B/C… — plain single letters cover the original
  // 12-group cap (up to L) fine, but a scaled-up World Cup (see
  // startWorldCupTournament below) can now run up to 32 groups, which would
  // run past Z into unprintable character codes with a bare
  // String.fromCharCode(65+i). Past Z this rolls over to A2, B2, C2…
  // instead, so every group still gets a readable, unique name no matter
  // how large the Tournament Size pick is.
  function tournamentGroupName(i) {
    const letter = String.fromCharCode(65 + (i % 26));
    const tier = Math.floor(i / 26);
    return tier === 0 ? letter : letter + (tier + 1);
  }

/*@CHUNK:c0360:END*/

/*@CHUNK:c0361:START*/
  function startWorldCupTournament(selected) {
    let teams = shuffleArray([...selected]);
    const groupSize = 4;
    // World Cup can be scaled past the real-world 48-team finals (12
    // groups) via the Tournament Size picker (48/64/128 — see
    // SCALABLE_TOURNAMENT_SIZES in ui/seasonUI.js); every other
    // 'groups'-engine competition (Nations League, Euros, Copa América,
    // AFCON, Asian Cup, Gold Cup) keeps the original 12-group/48-team cap
    // regardless of whatever size was last picked for a World Cup.
    const maxGroups = (tournamentType === 'worldcup' && tournamentSize)
      ? Math.max(1, Math.floor(tournamentSize / groupSize))
      : 12;
    let numGroups = Math.floor(teams.length / groupSize);
    if (numGroups < 1) numGroups = 1;
    if (numGroups > maxGroups) numGroups = maxGroups;
    teams = teams.slice(0, numGroups * groupSize);
    if (teams.length < 4) { toast('Need at least 4 teams for groups'); return; }
    const groups = [];
    for (let i = 0; i < numGroups; i++) {
      groups.push({
        name: tournamentGroupName(i),
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
/*@CHUNK:c0361:END*/

/*@CHUNK:cwc01:START*/
  // ========== NATIONAL-TEAM QUALIFYING + WORLD CUP (every 4 seasons) ==========
  // Eligible pool: every national team in teams.json whose name has no year
  // in it — the "legend"/historic squads (e.g. "Brazil 1962", "England
  // 2010") all carry a year, so this cleanly picks out just the current
  // senior national sides. That pool works through a qualifying campaign
  // (single round-robin groups of ~4) in every non-World-Cup season; the
  // group winner from each group qualifies automatically, and the best
  // remaining runners-up (by points, then goal difference, then goals for)
  // fill the field out to 48 — the modern World Cup's finals size — ready
  // for the World Cup itself the next time year % WORLD_CUP_INTERVAL === 0.
  const WORLD_CUP_FIELD_SIZE = 48;

  // Reserve national sides (e.g. "Italy Reserve") exist only as an extra
  // player pool for club transfers/testing — they're not real qualifying
  // entrants, so they're filtered out here the same way year-suffixed
  // "legend" squads are.
  function nationalQualifyingPool() {
    return (teamsData.national || []).filter(t => t && t.name && !/\d/.test(t.name) && !/\breserve\b/i.test(t.name));
  }

  function startQualifyingCampaign(forYear) {
    const pool = nationalQualifyingPool();
    if (pool.length < 8) { qualifiers = null; return; }
    const shuffled = shuffleArray([...pool]);
    const groupCount = Math.max(1, Math.round(shuffled.length / 4));
    const buckets = Array.from({ length: groupCount }, () => []);
    shuffled.forEach((t, i) => buckets[i % groupCount].push(t));
    qualifiers = {
      forYear,
      name: 'World Cup Qualifying',
      groups: buckets.filter(b => b.length >= 2).map((teams, idx) => ({
        id: idx, teams,
        table: teams.map(blankSeasonRow),
        rounds: buildSingleRoundRobinRounds(teams),
        currentRound: 0
      })),
      qualified: null,
      finished: false,
      stats: blankCompStats()
    };
  }

  // Simulates one round across every still-active qualifying group at once.
  // Once every group has exhausted its rounds, computes the qualified list
  // and marks the campaign finished. Only ever called on the congestion
  // cycle's International slot (see seasonUI.js) — never as a free,
  // play-anytime action — so qualifying fixtures land on realistic
  // international-break weeks instead of competing with domestic football.
  function simulateQualifyingRound() {
    if (!qualifiers || qualifiers.finished) return;
    if (!qualifiers.stats) qualifiers.stats = blankCompStats();
    currentSeasonComp = qualifiers;
    let allDone = true;
    qualifiers.groups.forEach(g => {
      if (g.currentRound >= g.rounds.length) return;
      simulateRoundFixtures(g.rounds[g.currentRound], { allowET: false, allowPens: false }, (fx, h, a, result) => {
        applyResultToTable(g.table, fx.home, fx.away, result.home, result.away);
      });
      g.currentRound++;
      allDone = false;
    });
    currentSeasonComp = null;
    if (!allDone) return;
    const winners = [], wildcards = [];
    qualifiers.groups.forEach(g => {
      const sorted = sortedTable(g.table);
      if (sorted[0]) winners.push(sorted[0].team);
      // Every other group finisher becomes a wildcard candidate — needed
      // because groups of 4 only produce one automatic runner-up each, and
      // with ~22 groups that alone can't fill a 48-team field (22 winners +
      // 22 runners-up caps out at 44); pulling in third-placed teams too
      // gives enough candidates to always reach the full 48.
      sorted.slice(1).forEach(r => wildcards.push(r));
    });
    wildcards.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
    const need = Math.max(0, WORLD_CUP_FIELD_SIZE - winners.length);
    const qualified = winners.concat(wildcards.slice(0, need).map(r => r.team));
    qualifiers.qualified = qualified;
    qualifiers.finished = true;
  }

  // Simulates the entire qualifying campaign in one go — used when a World
  // Cup season arrives and qualifying hasn't been played out round by round.
  function simulateQualifyingToEnd() {
    if (!qualifiers) return;
    let guard = 0;
    while (!qualifiers.finished && guard++ < 100) simulateQualifyingRound();
  }

  // Builds the World Cup finals bracket seed: groups of 4, single
  // round-robin, then a knockout bracket from the group winners/runners-up
  // plus the best third-placed teams — same "best third" shape the
  // continental competitions elsewhere already use, sized here to feed a
  // clean Round of 32 (real 2026-format World Cup: 12 groups of 4, top 2
  // plus the best 8 thirds advance).
  function startWorldCupFromQualifiers(year, qualifiedTeams) {
    let teams = shuffleArray([...(qualifiedTeams || [])]);
    const numGroups = Math.max(1, Math.floor(teams.length / 4));
    teams = teams.slice(0, numGroups * 4);
    const groups = [];
    for (let i = 0; i < numGroups; i++) {
      const gTeams = teams.slice(i * 4, i * 4 + 4);
      groups.push({
        id: i, teams: gTeams,
        table: gTeams.map(blankSeasonRow),
        rounds: buildSingleRoundRobinRounds(gTeams),
        currentRound: 0
      });
    }
    worldCup = {
      year, name: 'World Cup', groups, stage: 'groups', knockoutRound: null, roundName: null,
      champion: null, finished: false, stats: blankCompStats()
    };
  }

  // Picks the knockout field once every World Cup group has finished:
  // every group winner + runner-up, plus enough best third-placed teams to
  // round the field to a power of 2 for a clean bracket.
  function collectWorldCupKnockoutTeams(groups) {
    const winners = [], runnersUp = [], thirds = [];
    groups.forEach(g => {
      const sorted = sortedTable(g.table);
      if (sorted[0]) winners.push(sorted[0].team);
      if (sorted[1]) runnersUp.push(sorted[1].team);
      if (sorted[2]) thirds.push(sorted[2]);
    });
    thirds.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
    let field = winners.concat(runnersUp);
    let size = bracketSizeFor2(field.length + thirds.length);
    const thirdsNeeded = Math.max(0, Math.min(thirds.length, size - field.length));
    field = field.concat(thirds.slice(0, thirdsNeeded).map(r => r.team));
    while (field.length >= 2 && (field.length & (field.length - 1))) field.pop();
    return shuffleArray(field);
  }

  // Like bracketSizeFor() elsewhere, but not capped at 8 — the World Cup
  // knockout starts much bigger (Round of 32).
  function bracketSizeFor2(n) {
    let size = 2;
    while (size * 2 <= n) size *= 2;
    return size;
  }

  // Advances the World Cup one step: a full round of groups, or one
  // knockout round, mirroring simulateUCLStep's stage machine.
  function simulateWorldCupStep() {
    if (!worldCup || worldCup.finished) return;
    if (!worldCup.stats) worldCup.stats = blankCompStats();
    currentSeasonComp = worldCup;
    if (worldCup.stage === 'groups') {
      let allDone = true;
      worldCup.groups.forEach(g => {
        if (g.currentRound >= g.rounds.length) return;
        simulateRoundFixtures(g.rounds[g.currentRound], { allowET: false, allowPens: false }, (fx, h, a, result) => {
          applyResultToTable(g.table, fx.home, fx.away, result.home, result.away);
        });
        g.currentRound++;
        allDone = false;
      });
      if (allDone) {
        const koTeams = collectWorldCupKnockoutTeams(worldCup.groups);
        if (koTeams.length >= 2) {
          worldCup.knockoutRound = buildKnockoutFromWinners(koTeams);
          worldCup.roundName = getRoundName(koTeams.length);
          worldCup.stage = 'knockout';
        } else {
          worldCup.finished = true;
        }
      }
    } else if (worldCup.stage === 'knockout' && worldCup.knockoutRound) {
      simulateRoundFixtures(worldCup.knockoutRound.fixtures, { allowET: true, allowPens: true }, (fx, h, a, result) => {
        fx.winnerId = winnerOfResult(h, a, result).id;
      });
      worldCup.knockoutRound.played = true;
      const winners = worldCup.knockoutRound.fixtures.map(f => getTeam(f.winnerId)).filter(Boolean);
      if (winners.length <= 1) {
        worldCup.champion = winners[0] || null;
        worldCup.finished = true;
        if (worldCup.champion) {
          const extra = { category: 'worldcup', year: worldCup.year };
          pushTeamTrophy('World Cup', worldCup.champion, 'World Cup (Y' + worldCup.year + ')', extra);
          pushManagerAward('World Cup Winning Manager', worldCup.champion, 'World Cup (Y' + worldCup.year + ')', extra);
          recordIndividualAwardsFromAwardsObject(assignCompAwards(worldCup), 'World Cup (Y' + worldCup.year + ')', extra);
        }
      } else {
        worldCup.knockoutRound = buildKnockoutFromWinners(winners);
        worldCup.roundName = getRoundName(winners.length);
      }
    }
    currentSeasonComp = null;
  }

  // Called whenever a season starts/rolls over — decides whether this is a
  // World Cup year (kicks the finals off from whatever qualifying already
  // produced, force-finishing qualifying first if it somehow hasn't
  // finished yet) or a qualifying year (starts a fresh campaign, unless one
  // is already under way for the upcoming World Cup).
  function ensureNationalCycleForSeason(year) {
    const isWorldCupYear = year > 0 && year % WORLD_CUP_INTERVAL === 0;
    if (isWorldCupYear) {
      if (!worldCup || worldCup.year !== year) {
        if (!qualifiers || !qualifiers.finished) simulateQualifyingToEnd();
        const field = (qualifiers && qualifiers.qualified && qualifiers.qualified.length >= 8)
          ? qualifiers.qualified
          : shuffleArray([...nationalQualifyingPool()]).slice(0, WORLD_CUP_FIELD_SIZE);
        startWorldCupFromQualifiers(year, field);
        qualifiers = null;
      }
    } else if (!qualifiers) {
      const nextWC = year - (year % WORLD_CUP_INTERVAL) + WORLD_CUP_INTERVAL;
      startQualifyingCampaign(nextWC);
    }
  }
/*@CHUNK:cwc01:END*/
