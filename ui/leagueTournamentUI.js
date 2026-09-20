/**
 * leagueTournamentUI.js
 *
 * Renders the domestic-league (format: 'table') Tournament view — a real
 * broadcast-style standings table with qualification/relegation zone
 * striping, plus a matchday fixture list with Play Live/Instant options,
 * instead of the groups grid + knockout bracket every other tournament
 * format uses. This is what makes a league season in Tournament mode feel
 * like the actual competition rather than a reskinned World Cup: no groups,
 * no bracket card, and a table that reads like the real thing.
 */
/*@CHUNK:ctlu0001:START*/
  function renderLeagueTableTournament() {
    const groupsEl = document.getElementById('groups-container');
    const fixEl = document.getElementById('fixture-list');
    if (!tournament || tournament.format !== 'table') return;

    if (groupsEl) groupsEl.innerHTML = renderLeagueStandingsTableHTML(tournament.table);
    if (fixEl) fixEl.innerHTML = renderLeagueTournamentFixturesHTML();

    // Once every matchday has actually been played, retire the "Simulate
    // Matchday" button instead of leaving it sitting there clickable with
    // nothing left to simulate — previously this was never touched here, so
    // a stale render (see simLeagueTournamentRound) could also leave a
    // completed league still showing an active-looking button.
    const btn = document.getElementById('btn-sim-round');
    if (btn) {
      const done = tournament.stage === 'complete' || tournament.currentRound >= tournament.rounds.length;
      btn.disabled = done;
      btn.textContent = done ? 'Season Complete' : 'Simulate Matchday';
    }

    if (tournament.champion) {
      const stageTitle = document.getElementById('tour-stage-title');
      if (stageTitle) stageTitle.innerHTML = 'Champions: ' + teamMark(tournament.champion, 20) + ' ' + tournament.champion.name;
    }
  }
/*@CHUNK:ctlu0001:END*/

/*@CHUNK:ctlu0002:START*/
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
/*@CHUNK:ctlu0002:END*/

/*@CHUNK:ctlu0003:START*/
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
        const isCareerFixture = careerTeamId && (f.home === careerTeamId || f.away === careerTeamId);
        h += `<div class="fixture-item"><span class="fixture-teams">${teamMark(home, 18)} ${home.short} vs ${teamMark(away, 18)} ${away.short}</span>
          ${(!careerTeamId || isCareerFixture) ? `<button class="btn btn-primary btn-sm" onclick="App.playLeagueTournamentFixture(${idx})">▶ Play Live</button>` : ''}
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
/*@CHUNK:ctlu0003:END*/
