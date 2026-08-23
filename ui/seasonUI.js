/*@CHUNK:c0060:START*/

/*@CHUNK:c0060:END*/

/*@CHUNK:c0061:START*/
  function goToTournament(type) {
    tournamentType = type || 'worldcup';
    switchView('tournament');
    const setup = document.getElementById('tournament-setup');
    const live = document.getElementById('tournament-live');
    if (setup) setup.style.display = 'block';
    if (live) live.style.display = 'none';
    const isWC = tournamentType === 'worldcup';
    const title = document.getElementById('tournament-title');
    const desc = document.getElementById('tournament-desc');
    if (title) title.textContent = isWC ? 'World Cup Setup' : 'Champions League Setup';
    if (desc) desc.textContent = isWC
      ? 'Select national teams. Supports groups (up to 48 teams, World Cup style).'
      : 'Champions League 2024+ format: select up to 36 clubs. League phase (8 matches each), playoffs, two-leg knockouts, single final.';
    renderTournamentTeamSelect();
  }
/*@CHUNK:c0061:END*/

/*@CHUNK:c0351:START*/

/*@CHUNK:c0351:END*/

/*@CHUNK:c0352:START*/
  function renderTournamentTeamSelect() {
    let pool = tournamentType === 'worldcup' ? (teamsData.national || []) : (teamsData.club || []);
    if (tourTeamsSearch) {
      pool = pool.filter(t =>
        (t.name || '').toLowerCase().includes(tourTeamsSearch) ||
        (t.short || '').toLowerCase().includes(tourTeamsSearch)
      );
    }
    const el = document.getElementById('tournament-teams');
    if (!el) return;
    // Preserve existing checks
    const prevChecked = new Set(
      [...document.querySelectorAll('#tournament-teams input:checked')].map(cb => cb.value)
    );
    const firstRender = prevChecked.size === 0 && !tourTeamsSearch;
    el.innerHTML = pool.map(t => {
      const checked = firstRender || prevChecked.has(t.id);
      return `<label class="team-check ${checked ? 'selected' : ''}" data-id="${t.id}">
        <input type="checkbox" value="${t.id}" ${checked ? 'checked' : ''}>
        <span>${teamMark(t, 20)} ${t.name}</span>
        <span class="player-ovr" style="margin-left:auto">${teamAvgOvr(t).toFixed(0)}</span>
      </label>`;
    }).join('') || '<div class="empty-state"><p>No teams found</p></div>';
    el.querySelectorAll('.team-check').forEach(l => {
      l.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          const cb = l.querySelector('input');
          if (cb) cb.checked = !cb.checked;
        }
        const cb = l.querySelector('input');
        l.classList.toggle('selected', cb && cb.checked);
        updateTournamentSelectedCount();
      });
      l.querySelector('input') && l.querySelector('input').addEventListener('change', updateTournamentSelectedCount);
    });
    updateTournamentSelectedCount();
  }
/*@CHUNK:c0352:END*/

/*@CHUNK:c0353:START*/

/*@CHUNK:c0353:END*/

/*@CHUNK:c0354:START*/
  function updateTournamentSelectedCount() {
    const n = document.querySelectorAll('#tournament-teams input:checked').length;
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
      const need = tournamentType === 'ucl' ? '36 ideal (min 8)' : '4+ (8/16/32/48 ideal)';
      el.innerHTML = '<strong>' + n + '</strong> teams selected <span style="color:var(--text-3)">· ' + need + '</span>';
    }
  }
/*@CHUNK:c0354:END*/

/*@CHUNK:c0355:START*/


/*@CHUNK:c0355:END*/

/*@CHUNK:c0356:START*/
  function selectAllTeams() {
    setTimeout(updateTournamentSelectedCount, 0);
    document.querySelectorAll('#tournament-teams input').forEach(cb => {
      cb.checked = true;
      const parent = cb.closest('.team-check');
      if (parent) parent.classList.add('selected');
    });
  }
/*@CHUNK:c0356:END*/

/*@CHUNK:c0357:START*/
  function deselectAllTeams() {
    document.querySelectorAll('#tournament-teams input').forEach(cb => {
      cb.checked = false;
      const parent = cb.closest('.team-check');
      if (parent) parent.classList.remove('selected');
    });
  }
/*@CHUNK:c0357:END*/

/*@CHUNK:c0372:START*/

/*@CHUNK:c0372:END*/

/*@CHUNK:c0373:START*/
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
/*@CHUNK:c0373:END*/

/*@CHUNK:c0374:START*/

/*@CHUNK:c0374:END*/

/*@CHUNK:c0375:START*/
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
            <span class="fixture-teams">${teamMark(home,18)} ${home.short} ${f.homeScore}-${f.awayScore} ${away.short}</span>
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
/*@CHUNK:c0375:END*/

/*@CHUNK:c0378:START*/

/*@CHUNK:c0378:END*/

/*@CHUNK:c0379:START*/
  function renderGroups() {
    if (tournament && tournament.format === 'league') {
      renderUCLLeague();
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
/*@CHUNK:c0379:END*/

/*@CHUNK:c0411:START*/

/*@CHUNK:c0411:END*/

/*@CHUNK:c0412:START*/
  function viewPlayoffReport(idx) {
    const p = tournament && tournament.playoff && tournament.playoff[idx];
    if (!p) return;
    if (p.leg1 && p.leg2 && p.leg1.report && p.leg2.report) {
      const aggText = (p.aggHome != null) ? `Aggregate: ${p.home.short} ${p.aggHome} - ${p.aggAway} ${p.away.short}${p.penalties ? ' (on penalties)' : ''}` : '';
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
/*@CHUNK:c0412:END*/

/*@CHUNK:c0425:START*/

/*@CHUNK:c0425:END*/

/*@CHUNK:c0426:START*/
  function renderTournamentPodium() {
    let el = document.getElementById('tour-podium');
    if (!el) {
      const bracket = document.getElementById('bracket');
      if (bracket) {
        el = document.createElement('div');
        el.id = 'tour-podium';
        bracket.parentNode.insertBefore(el, bracket);
      }
    }
    if (!el || !tournament || !tournament.champion) return;
    const first = tournament.champion;
    const second = tournament.runnersUp;
    const third = tournament.thirdPlace;
    el.innerHTML = `
      <div class="card-title">Final Standings</div>
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
/*@CHUNK:c0426:END*/

/*@CHUNK:c0433:START*/

/*@CHUNK:c0433:END*/

/*@CHUNK:c0434:START*/
  function renderTournamentAwards() {
    const el = document.getElementById('tour-awards');
    if (!el || !tournament) return;
    if (!tournament.awards) assignTournamentAwards();
    const a = tournament.awards || {};
    const card = (title, icon, p, extra) => {
      const titleHtml = `<div class="am-title">${trophyMark(title, 32)} ${title}</div>`;
      if (!p) return `<div class="award-mini">${titleHtml}<div class="am-empty">TBD</div></div>`;
      return `<div class="award-mini">${titleHtml}
        ${lbAvatar(p, 44)}
        <div class="am-name">${p.name}</div>
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
/*@CHUNK:c0434:END*/

/*@CHUNK:c0435:START*/

/*@CHUNK:c0435:END*/

/*@CHUNK:c0436:START*/
  function refreshTournamentStatsUI() {
    if (!tournament) return;
    try {
      assignTournamentAwards();
      renderTournamentAwards();
      renderTournamentLeaderboard();
    } catch (e) { console.warn(e); }
  }
/*@CHUNK:c0436:END*/

/*@CHUNK:c0437:START*/

/*@CHUNK:c0437:END*/

/*@CHUNK:c0438:START*/
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
      ${arr.map((p,i)=>`<div class="lb-mini-row ${i<3?'lb-mini-top rank-'+(i+1):''}">${rankBadge(i)}${lbAvatar(p,26)}<span class="lb-mini-name">${p.name}</span><span style="color:var(--text-muted);font-size:0.75rem">${p.team||''}</span><b class="lb-mini-count">${p.count}</b></div>`).join('')||'<span style="color:var(--text-muted)">—</span>'}</div>`;
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
        ${col('⚽ Golden Boot', g)}
        ${col('🎯 Assists', a)}
        ${col('⭐ MOTM', m)}
        ${col('🟨 Yellows', y)}
        ${col('🟥 Reds', r)}
        ${col('🧤 Saves', s)}
      </div>
      <div style="margin-top:10px;font-size:0.75rem;color:var(--text-muted)">Matchday ${globalMatchDay} · Full match engine · Injuries tracked</div>`;
  }
/*@CHUNK:c0438:END*/

/*@CHUNK:c0439:START*/

/*@CHUNK:c0439:END*/

/*@CHUNK:c0440:START*/
  function renderBracket() {
    const el = document.getElementById('bracket');
    if (!el || !tournament) return;
    if (!tournament.knockout || !tournament.knockout.length) {
      el.innerHTML = '<p style="color:var(--text-muted)">No knockout matches yet.</p>';
      return;
    }
    const curIdx = tournament.knockout.length - 1;
    el.innerHTML = tournament.knockout.map((round, ri) => `
      <div class="round"><div class="round-title">${round.name}${round.twoLeg ? ' (two legs)' : ''}</div>
      ${round.matches.map((m, mi) => {
        const score = m.played
          ? (m.twoLeg !== false && m.aggHome != null
              ? `Agg ${m.aggHome}-${m.aggAway}`
              : `${m.homeScore} - ${m.awayScore}`)
          : '-';
        return `<div class="bracket-match ${m.played ? 'played' : ''}">
          <div class="bracket-team ${m.winner && m.winner.id === m.home.id ? 'winner' : ''}">
            <span>${teamMark(m.home, 18)} ${m.home.short}</span>
            <span class="bracket-score">${m.played ? (m.twoLeg !== false && m.aggHome != null ? m.aggHome : m.homeScore) : '-'}</span>
          </div>
          <div class="bracket-team ${m.winner && m.winner.id === m.away.id ? 'winner' : ''}">
            <span>${teamMark(m.away, 18)} ${m.away.short}</span>
            <span class="bracket-score">${m.played ? (m.twoLeg !== false && m.aggAway != null ? m.aggAway : m.awayScore) : '-'}</span>
          </div>
          ${m.penalties ? '<div style="font-size:0.7rem;color:var(--text-muted);text-align:center">pens</div>' : ''}
          ${m.played && m.twoLeg !== false && m.aggHome != null ? '<div style="font-size:0.7rem;color:var(--text-muted);text-align:center">' + score + '</div>' : ''}
          ${(!m.played && ri === curIdx && !tournament.champion) ? `<div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="App.playKnockoutMatch(${ri},${mi})">▶ Live</button>
            <button class="btn btn-secondary btn-sm" onclick="App.simKnockoutMatch(${ri},${mi})">⚡ Instant</button>
          </div>` : ''}
          ${m.played ? `<button class="btn btn-secondary btn-sm" style="margin-top:6px;width:100%" onclick="App.viewKnockoutReport(${ri},${mi})">Match Report</button>` : ''}
        </div>`;
      }).join('')}
      </div>`).join('');
  }
/*@CHUNK:c0440:END*/

/*@CHUNK:c0491:START*/


/*@CHUNK:c0491:END*/

/*@CHUNK:c0492:START*/
  function goToSeason() {
    if (season) { renderSeasonDashboard(); }
    else { renderSeasonSetup(); }
    const setup = document.getElementById('season-setup');
    const dash = document.getElementById('season-dashboard');
    if (setup) setup.style.display = season ? 'none' : 'block';
    if (dash) dash.style.display = season ? 'block' : 'none';
  }
/*@CHUNK:c0492:END*/

/*@CHUNK:c0500:START*/

/*@CHUNK:c0500:END*/

/*@CHUNK:c0501:START*/
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
/*@CHUNK:c0501:END*/

/*@CHUNK:c0502:START*/

/*@CHUNK:c0502:END*/

/*@CHUNK:c0503:START*/
  function searchSeasonTeams(compKey, value) {
    seasonSetup.search[compKey] = value;
    renderSeasonSetup();
  }
/*@CHUNK:c0503:END*/

/*@CHUNK:c0504:START*/

/*@CHUNK:c0504:END*/

/*@CHUNK:c0505:START*/
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
/*@CHUNK:c0505:END*/

/*@CHUNK:c0506:START*/

/*@CHUNK:c0506:END*/

/*@CHUNK:c0507:START*/
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
/*@CHUNK:c0507:END*/

/*@CHUNK:c0508:START*/

/*@CHUNK:c0508:END*/

/*@CHUNK:c0509:START*/
  function clearSeasonSetup() {
    Object.values(seasonSetup.selections).forEach(s => s.clear());
    renderSeasonSetup();
  }
/*@CHUNK:c0509:END*/

/*@CHUNK:c0564:START*/

/*@CHUNK:c0564:END*/

/*@CHUNK:c0565:START*/
  function showSeasonComp(key) {
    seasonActiveTab = key;
    seasonActiveSubTab = 'table';
    renderSeasonDashboard();
  }
/*@CHUNK:c0565:END*/

/*@CHUNK:c0566:START*/

/*@CHUNK:c0566:END*/

/*@CHUNK:c0567:START*/
  function showSeasonSubTab(key) {
    seasonActiveSubTab = key;
    renderSeasonDashboard();
  }
/*@CHUNK:c0567:END*/

/*@CHUNK:c0568:START*/

/*@CHUNK:c0568:END*/

/*@CHUNK:c0569:START*/
  function renderSeasonDashboard() {
    if (!season) return;
    seasonReportRegistry = []; // rebuilt fresh each render so onclick indices stay valid
    const title = document.getElementById('season-status-title');
    if (title) title.textContent = 'Year ' + season.year + ' · Matchday ' + season.week;
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
/*@CHUNK:c0569:END*/

/*@CHUNK:c0582:START*/

  // Season-scoped trophy room: shows only trophies won inside this save's season
  // play (domestic leagues + Champions League), grouped by year, newest first.
/*@CHUNK:c0582:END*/

/*@CHUNK:c0583:START*/
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
/*@CHUNK:c0583:END*/

/*@CHUNK:c0584:START*/

/*@CHUNK:c0584:END*/

/*@CHUNK:c0585:START*/
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
/*@CHUNK:c0585:END*/

/*@CHUNK:c0586:START*/

/*@CHUNK:c0586:END*/

/*@CHUNK:c0587:START*/
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
      h += `<div class="card-title" style="margin-top:12px">Matchday ${comp.currentRound + 1} — Play Now</div>`;
      currentUnplayed.forEach(f => {
        const home = getTeam(f.home), away = getTeam(f.away);
        if (!home || !away) return;
        const idx = currentRound.indexOf(f);
        h += `<div class="fixture-item"><span class="fixture-teams">${teamMark(home, 18)} ${home.short} vs ${teamMark(away, 18)} ${away.short}</span>
          <button class="btn btn-primary btn-sm" onclick="App.playSeasonFixture('${compKey}',${idx})">▶ Play Live</button>
          <button class="btn btn-secondary btn-sm" onclick="App.simSeasonFixture('${compKey}',${idx})">⚡ Instant</button></div>`;
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
          <span class="fixture-teams">${teamMark(home, 18)} ${home.short} ${f.homeScore}-${f.awayScore} ${away.short}</span>
          ${reportIdx >= 0 ? '<span style="font-size:0.7rem;color:var(--accent-gold)">Details</span>' : ''}</div>`;
      });
    }
    return h;
  }
/*@CHUNK:c0587:END*/

/*@CHUNK:c0588:START*/

/*@CHUNK:c0588:END*/

/*@CHUNK:c0589:START*/
  function renderLeagueCompHTML(comp, compKey) {
    let h = '<div class="group-card league-table-wrap">';
    h += '<h4>' + comp.name + (comp.finished ? ' — Champion: ' + (comp.champion ? teamMark(comp.champion, 18) + ' ' + comp.champion.name : '—') : '') + '</h4>';
    h += renderStandingsTable(comp, UCL_QUALIFY_PER_LEAGUE);
    h += `<p style="font-size:0.75rem;color:var(--text-muted);margin-top:6px">Green: top ${UCL_QUALIFY_PER_LEAGUE} qualify for next season's Champions League</p>`;
    h += '</div>';
    h += renderFixtureList(comp, compKey);
    return h;
  }
/*@CHUNK:c0589:END*/

/*@CHUNK:c0590:START*/

/*@CHUNK:c0590:END*/

/*@CHUNK:c0591:START*/
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
          <span class="fixture-teams">${teamMark(home, 18)} ${home.short} ${f.homeScore}-${f.awayScore} ${away.short}${pensTxt} <small style="color:var(--accent-gold)">→ ${winner ? winner.short : '?'}</small></span></div>`;
      }
    });
    return h;
  }
/*@CHUNK:c0591:END*/

/*@CHUNK:c0592:START*/

/*@CHUNK:c0592:END*/

/*@CHUNK:c0593:START*/
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
/*@CHUNK:c0593:END*/

/*@CHUNK:c0594:START*/

/*@CHUNK:c0594:END*/

/*@CHUNK:c0595:START*/
  function viewSeasonReport(idx) {
    const report = seasonReportRegistry[idx];
    if (!report) { toast('No detailed report for this match'); return; }
    showMatchReport(report, null);
  }
/*@CHUNK:c0595:END*/
