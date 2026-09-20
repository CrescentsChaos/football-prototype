/*@CHUNK:c0060:START*/

/*@CHUNK:c0060:END*/

/*@CHUNK:c0061:START*/
  function goToTournament(type) {
    switchView('tournament');
    const setup = document.getElementById('tournament-setup');
    const live = document.getElementById('tournament-live');
    if (setup) setup.style.display = 'block';
    if (live) live.style.display = 'none';
    selectTournamentFormat(type || tournamentType || 'worldcup');
  }
/*@CHUNK:c0061:END*/

/*@CHUNK:ccomp02:START*/
  // Applies a tournament format selection — used by the Home mode-cards, the
  // Tournament tab's own format <select>, and restoreTournamentUI() on
  // reload. Updates tournamentType, the setup card's title/description
  // (from the TOURNAMENT_FORMATS registry), keeps the <select> in sync, and
  // re-renders the eligible team picker for that format.
  function selectTournamentFormat(key) {
    tournamentType = (key && TOURNAMENT_FORMATS[key]) ? key : 'worldcup';
    const cfg = TOURNAMENT_FORMATS[tournamentType];
    const title = document.getElementById('tournament-title');
    const desc = document.getElementById('tournament-desc');
    if (title) title.textContent = cfg.name + ' Setup';
    if (desc) desc.textContent = cfg.desc;
    const select = document.getElementById('tour-format-select');
    if (select && select.value !== tournamentType) select.value = tournamentType;
    // Only wipe the in-progress team selection on a genuine switch to a
    // different format's eligible pool (tourSelectedTeamIdsType tracks
    // which format the current tourSelectedTeamIds belongs to). Re-entering
    // the Tournament tab with the SAME format — including right after a
    // hard refresh, once loadPersistedGameState() has restored both
    // tourSelectedTeamIds and tourSelectedTeamIdsType from storage — must
    // leave a manually-trimmed selection (say 36 of 48 eligible teams)
    // exactly as the person left it, instead of silently reverting to
    // "everyone selected" every time this runs.
    if (tournamentType !== tourSelectedTeamIdsType) {
      tourTeamsSearch = '';
      tourTeamsSort = 'name';
      tourTeamsLeagueFilter = 'all';
      tourTeamsRatingFilter = 'all';
      tourSelectedTeamIds = new Set();
      tourSelectedTeamIdsType = tournamentType;
      const search = document.getElementById('tour-teams-search');
      if (search) search.value = '';
      const sortSel = document.getElementById('tour-teams-sort');
      if (sortSel) sortSel.value = 'name';
      const ratingSel = document.getElementById('tour-teams-rating');
      if (ratingSel) ratingSel.value = 'all';
    }
    // League filter: only worth showing for pools that genuinely span more
    // than one bucket (e.g. Champions League clubs across the top-5
    // leagues) — a single-league cup pool would just offer "All leagues"
    // and that one league, filtering nothing. National-team pools (World
    // Cup, Euros, etc.) don't have a "league" concept at all, so the
    // control stays hidden for those too.
    const leagueWrap = document.getElementById('tour-league-wrap');
    const leagueSelect = document.getElementById('tour-teams-league');
    const leagueOpts = getTournamentLeagueOptions(tournamentType);
    if (leagueOpts && leagueWrap && leagueSelect) {
      leagueWrap.style.display = '';
      leagueSelect.innerHTML = '<option value="all">All leagues</option>' +
        leagueOpts.present.map(lg => `<option value="${lg}">${lg}</option>`).join('') +
        (leagueOpts.hasOther ? '<option value="other">Other</option>' : '');
      leagueSelect.value = tourTeamsLeagueFilter;
    } else {
      if (leagueWrap) leagueWrap.style.display = 'none';
      tourTeamsLeagueFilter = 'all';
    }
    // Tournament Size picker — only World Cup/Champions League can scale
    // past their real-world field size (see SCALABLE_TOURNAMENT_SIZES);
    // every other format hides the control and always plays its one
    // real-world size.
    const sizes = SCALABLE_TOURNAMENT_SIZES[tournamentType];
    const sizeWrap = document.getElementById('tour-size-wrap');
    const sizeSelect = document.getElementById('tour-size-select');
    if (sizes) {
      if (!tournamentSize || sizes.indexOf(tournamentSize) === -1) tournamentSize = sizes[0];
      if (sizeSelect) {
        sizeSelect.innerHTML = sizes.map(s => '<option value="' + s + '">' + s + ' teams' + (s === sizes[0] ? ' (real-world)' : '') + '</option>').join('');
        sizeSelect.value = String(tournamentSize);
      }
      if (sizeWrap) sizeWrap.style.display = '';
    } else {
      tournamentSize = null;
      if (sizeWrap) sizeWrap.style.display = 'none';
    }
    applyTournamentBranding(tournamentType);
    renderTournamentTeamSelect();
  }
/*@CHUNK:ccomp02:END*/

/*@CHUNK:ccomp03:START*/
  // Applies a competition's logo + accent-color theme (from
  // getTournamentBranding()) to the setup card and the live tournament view:
  // sets --tour-color/--tour-color-dim custom properties consumed by the
  // .tour-themed rules in styles.css, and points the #tour-logo-setup /
  // #tour-logo-live <img> tags at assets/images/<logo>. If the image file
  // hasn't been added yet (or fails to load), the logo just stays hidden —
  // the color theme still applies on its own. Also stamps a short format
  // badge ("League Season", "Knockout Cup", "Group Stage", "League Phase")
  // onto both header rows and toggles the format-specific body class, so a
  // competition's whole identity — not just its colors — visibly changes
  // between formats (see .tour-format-* rules in styles.css).
  function applyTournamentBranding(formatKey) {
    const b = getTournamentBranding(formatKey);
    const cfg = TOURNAMENT_FORMATS[formatKey] || {};
    const badgeText = tourEngineBadgeLabel(cfg.engine);
    [
      { root: 'tournament-setup', logo: 'tour-logo-setup', badge: 'tour-format-badge-setup' },
      { root: 'tournament-live', logo: 'tour-logo-live', badge: 'tour-format-badge-live' }
    ].forEach(({ root, logo, badge }) => {
      const rootEl = document.getElementById(root);
      if (rootEl) {
        rootEl.classList.add('tour-themed');
        rootEl.style.setProperty('--tour-color', b.color);
        rootEl.style.setProperty('--tour-color-dim', b.colorDim);
        TOUR_ENGINE_CLASSES.forEach(c => rootEl.classList.remove(c));
        rootEl.classList.add('tour-format-' + (cfg.engine || 'groups'));
      }
      const img = document.getElementById(logo);
      if (img) {
        img.onerror = function() { this.style.display = 'none'; };
        img.alt = cfg.name || '';
        img.title = cfg.name || '';
        img.style.display = '';
        img.src = 'assets/images/' + b.logo;
      }
      const badgeEl = document.getElementById(badge);
      if (badgeEl) badgeEl.textContent = badgeText;
    });
  }
/*@CHUNK:ccomp03:END*/

/*@CHUNK:ccomp04:START*/
  const TOUR_ENGINE_CLASSES = ['tour-format-groups', 'tour-format-league', 'tour-format-knockout', 'tour-format-table'];

  // Short human label for a tournament engine type, used for the format
  // badge stamped next to the competition logo/title so every tournament
  // visibly announces what kind of competition it is, not just its color.
  function tourEngineBadgeLabel(engine) {
    if (engine === 'table') return '⚽ League Season';
    if (engine === 'league') return '🏆 League Phase + Knockout';
    if (engine === 'knockout') return '🏆 Knockout Cup';
    return '🌍 Group Stage';
  }
/*@CHUNK:ccomp04:END*/

/*@CHUNK:c0351:START*/
  // Formats whose real-world field size the Tournament Size picker can
  // scale past (see selectTournamentSize() below and startWorldCupTournament()
  // / startUCLTournament() in simulation/tournamentEngine.js, which read
  // tournamentSize back off js/state.js). Every other format keeps its one
  // real-world size and never shows the picker. The first value in each
  // list is that format's default/real-world size.
  const SCALABLE_TOURNAMENT_SIZES = {
    worldcup: [48, 64, 128],
    ucl: [36, 72, 144]
  };

  // Applies a Tournament Size pick (only reachable while the picker is
  // visible, i.e. tournamentType is a key in SCALABLE_TOURNAMENT_SIZES).
  // Falls back to that format's real-world size on anything unrecognized.
  function selectTournamentSize(size) {
    const sizes = SCALABLE_TOURNAMENT_SIZES[tournamentType];
    const n = parseInt(size, 10);
    tournamentSize = (sizes && sizes.indexOf(n) !== -1) ? n : (sizes ? sizes[0] : null);
    updateTournamentSelectedCount();
  }
/*@CHUNK:c0351:END*/

/*@CHUNK:c0351b:START*/
  // Which domestic leagues (plus an "other" bucket, if applicable) are
  // actually represented in a given tournament format's eligible pool —
  // drives the Tournament tab's League filter options. Returns null when
  // the format's pool isn't club-based, or spans fewer than two buckets
  // (nothing meaningful to filter), so the caller knows to hide the
  // control entirely rather than show a filter with only "All" in it.
  function getTournamentLeagueOptions(formatKey) {
    const cfg = TOURNAMENT_FORMATS[formatKey];
    if (!cfg || cfg.pool !== 'club') return null;
    const pool = getCompetitionEligiblePool(formatKey);
    if (pool.length < 2) return null;
    const poolIds = new Set(pool.map(t => t.id));
    const present = DOMESTIC_LEAGUES.filter(lg => getLeagueTeamPool(lg).some(t => poolIds.has(t.id)));
    const knownIds = new Set();
    present.forEach(lg => getLeagueTeamPool(lg).forEach(t => { if (poolIds.has(t.id)) knownIds.add(t.id); }));
    const hasOther = pool.some(t => !knownIds.has(t.id));
    if (present.length + (hasOther ? 1 : 0) < 2) return null;
    return { present, hasOther };
  }
/*@CHUNK:c0351b:END*/

/*@CHUNK:c0352:START*/
  function renderTournamentTeamSelect() {
    let pool = getCompetitionEligiblePool(tournamentType);
    if (tourTeamsSearch) {
      pool = pool.filter(t =>
        (t.name || '').toLowerCase().includes(tourTeamsSearch) ||
        (t.short || '').toLowerCase().includes(tourTeamsSearch)
      );
    }
    if (tourTeamsLeagueFilter !== 'all') {
      // Mirrors getFilteredTeamsList()'s league matching (ui/teamUI.js) so
      // "Premier League" here means exactly the clubs the Teams tab and
      // Season Calendar would offer under that name.
      if (tourTeamsLeagueFilter === 'other') {
        const known = new Set();
        DOMESTIC_LEAGUES.forEach(name => getLeagueTeamPool(name).forEach(t => known.add(t.id)));
        pool = pool.filter(t => !known.has(t.id));
      } else {
        const ids = new Set(getLeagueTeamPool(tourTeamsLeagueFilter).map(t => t.id));
        pool = pool.filter(t => ids.has(t.id));
      }
    }
    if (tourTeamsRatingFilter !== 'all') {
      pool = pool.filter(t => ovrTierMatches(teamAvgOvr(t), tourTeamsRatingFilter));
    }
    pool = [...pool];
    if (tourTeamsSort === 'ovr') pool.sort((a, b) => teamAvgOvr(b) - teamAvgOvr(a));
    else if (tourTeamsSort === 'players') pool.sort((a, b) => (b.players || []).length - (a.players || []).length);
    else if (tourTeamsSort === 'flag') pool.sort((a, b) => (a.flag || '').localeCompare(b.flag || '') || (a.name || '').localeCompare(b.name || ''));
    else pool.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const el = document.getElementById('tournament-teams');
    if (!el) return;
    // First-ever render for this format (nothing selected yet, no
    // search/league/rating filter narrowing the pool) defaults every
    // eligible team to checked — same "select all by default" behavior as
    // before, just driven by tourSelectedTeamIds instead of a DOM snapshot
    // now.
    const firstRender = tourSelectedTeamIds.size === 0 && !tourTeamsSearch &&
      tourTeamsLeagueFilter === 'all' && tourTeamsRatingFilter === 'all';
    if (firstRender) getCompetitionEligiblePool(tournamentType).forEach(t => tourSelectedTeamIds.add(t.id));
    el.innerHTML = pool.map(t => {
      const checked = tourSelectedTeamIds.has(t.id);
      return `<label class="team-check ${checked ? 'selected' : ''}" data-id="${t.id}">
        <input type="checkbox" value="${t.id}" ${checked ? 'checked' : ''}>
        <span>${teamMark(t, 20)} ${t.name}</span>
        <span class="player-ovr" style="margin-left:auto">${teamAvgOvr(t).toFixed(0)}</span>
      </label>`;
    }).join('') || '<div class="empty-state"><p>No teams found</p></div>';
    el.querySelectorAll('.team-check').forEach(l => {
      const id = l.getAttribute('data-id');
      l.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          const cb = l.querySelector('input');
          if (cb) cb.checked = !cb.checked;
        }
        const cb = l.querySelector('input');
        const isChecked = !!(cb && cb.checked);
        l.classList.toggle('selected', isChecked);
        if (isChecked) tourSelectedTeamIds.add(id); else tourSelectedTeamIds.delete(id);
        updateTournamentSelectedCount();
      });
      l.querySelector('input') && l.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) tourSelectedTeamIds.add(id); else tourSelectedTeamIds.delete(id);
        updateTournamentSelectedCount();
      });
    });
    updateTournamentSelectedCount();
  }
/*@CHUNK:c0352:END*/

/*@CHUNK:c0353:START*/

/*@CHUNK:c0353:END*/

/*@CHUNK:c0354:START*/
  // Persists the current tournament team selection (and which format it
  // belongs to) so a hard refresh restores it via loadPersistedGameState()
  // instead of losing it — see tourSelectedTeamIdsType in ui/teamUI.js and
  // selectTournamentFormat() above for how the format-match check on
  // restore keeps this from being silently reset.
  function persistTourSelectedTeams() {
    safeSetItem('apexTourSelectedTeams', JSON.stringify({ type: tournamentType, ids: [...tourSelectedTeamIds] }));
  }

  function updateTournamentSelectedCount() {
    // tourSelectedTeamIds is authoritative (see renderTournamentTeamSelect) —
    // counting DOM checkboxes here would undercount while a search filter
    // is hiding previously-checked teams.
    persistTourSelectedTeams();
    const n = tourSelectedTeamIds.size;
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
      const cfg = TOURNAMENT_FORMATS[tournamentType];
      const engine = cfg && cfg.engine;
      const need = engine === 'league' ? (tournamentType === 'ucl' ? (tournamentSize || 36) : 36) + ' ideal (min 8)'
        : engine === 'knockout' ? 'a power of 2 — 2/4/8/16/32… (min 2)'
        : engine === 'table' ? 'the full league (18-20 ideal, min 4)'
        : (tournamentType === 'worldcup' ? (tournamentSize || 48) + ' ideal (min 4)' : '4+ (8/16/32/48 ideal)');
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
      tourSelectedTeamIds.add(cb.value);
      const parent = cb.closest('.team-check');
      if (parent) parent.classList.add('selected');
    });
  }
/*@CHUNK:c0356:END*/

/*@CHUNK:c0357:START*/
  function deselectAllTeams() {
    document.querySelectorAll('#tournament-teams input').forEach(cb => {
      cb.checked = false;
      tourSelectedTeamIds.delete(cb.value);
      const parent = cb.closest('.team-check');
      if (parent) parent.classList.remove('selected');
    });
    updateTournamentSelectedCount();
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
        const isCareerFixture = careerTeamId && (f.home === careerTeamId || f.away === careerTeamId);
        h += `<div class="fixture-item"><span class="fixture-teams">${teamMark(home,18)} ${home.short} vs ${teamMark(away,18)} ${away.short}</span>
          ${(!careerTeamId || isCareerFixture) ? `<button class="btn btn-primary btn-sm" onclick="App.playUCLFixture(${idx})">▶ Live</button>` : ''}
          <button class="btn btn-secondary btn-sm" onclick="App.simUCLFixture(${idx})">⚡ Instant</button></div>`;
      });
      if (played.length) {
        h += '<div class="card-title" style="margin-top:12px">Recent Results</div>';
        played.reverse().forEach(f => {
          const home = getTeam(f.home), away = getTeam(f.away);
          const idx = tournament.fixtures.indexOf(f);
          h += `<div class="fixture-item played" style="cursor:pointer" onclick="App.viewFixtureReport(${idx})">
            <span class="fixture-teams">${teamMark(home,18)} ${home.short} ${f.homeScore}-${f.awayScore} ${teamMark(away,18)} ${away.short}</span>
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
    if (tournament && tournament.format === 'table') {
      renderLeagueTableTournament();
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
          const isCareerFixture = careerTeamId && (f.home === careerTeamId || f.away === careerTeamId);
          h += `<div class="fixture-item"><span class="fixture-teams">${teamMark(home,18)} ${home.short} vs ${teamMark(away,18)} ${away.short}</span>
            ${(!careerTeamId || isCareerFixture) ? `<button class="btn btn-primary btn-sm" onclick="App.playTournamentMatch(${tournament.fixtures.indexOf(f)})">▶ Play Live</button>` : ''}
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
      const aggText = (p.aggHome != null) ? `Aggregate: ${p.home.short} ${p.aggHome} - ${p.aggAway} ${p.away.short}${p.penalties ? (p.pens ? ` (pens ${p.pens.home}-${p.pens.away})` : ' (on penalties)') : ''}` : '';
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
    // Lives inside the "Tournament Stats" card (#tour-leaderboard-mini),
    // above the awards row, rather than as its own block above the bracket
    // — keeps every end-of-tournament summary (standings, awards, stat
    // leaders) together in one place instead of scattered across the page.
    let el = document.getElementById('tour-podium');
    if (!el) {
      const statsCard = document.getElementById('tour-leaderboard-mini');
      const awards = document.getElementById('tour-awards');
      if (statsCard) {
        el = document.createElement('div');
        el.id = 'tour-podium';
        if (awards) statsCard.insertBefore(el, awards);
        else statsCard.appendChild(el);
      }
    }
    if (!el || !tournament || !tournament.champion) return;
    const first = tournament.champion;
    const second = tournament.runnersUp;
    const third = tournament.thirdPlace;
    const tName = tournament.competitionName || (tournament.type === 'worldcup' ? 'World Cup' : 'Champions League');
    // Champion gets the full trophy + crest presentation (championBannerHTML,
    // ui/playerUI.js) instead of just being the "1" slot in a bare numbered
    // podium — runners-up/third still show below it, now with medals instead
    // of plain digits.
    el.innerHTML = `
      <div class="card-title">Final Standings</div>
      ${championBannerHTML(tName, first, { trophySize: 56, teamSize: 34 })}
      <div class="podium podium-runnersup">
        <div class="podium-place">
          <div class="place-medal">🥈</div>
          <div class="place-team">${second ? teamMark(second, 20) + ' ' + second.name : '—'}</div>
          <div class="place-label">Runners-up</div>
        </div>
        <div class="podium-place">
          <div class="place-medal">🥉</div>
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
      return `<div class="award-mini" onclick="App.showPlayerProfile('${p.id}')" style="cursor:pointer">${titleHtml}
        ${lbAvatar(p, 44)}
        <div class="am-name">${playerNameHTML(p)}</div>
        <div class="am-meta">${p.team || ''} · ${extra}</div></div>`;
    };
    el.innerHTML = `
      <div class="card-title">Tournament Awards</div>
      <div class="awards-row">
        ${card('Golden Boot', '👟', a.goldenBoot, (a.goldenBoot && a.goldenBoot.count) + ' goals')}
        ${card('Golden Ball', '🏆', a.goldenBall, a.goldenBall && (a.goldenBall.goals != null || a.goldenBall.assists != null)
          ? ((a.goldenBall.goals||0) + 'G ' + (a.goldenBall.assists||0) + 'A' + (a.goldenBall.avg ? ' · Avg ' + a.goldenBall.avg.toFixed(2) : ''))
          : (a.goldenBall && a.goldenBall.avg != null ? ('Avg ' + a.goldenBall.avg.toFixed(2)) : ((a.goldenBall && a.goldenBall.count) + ' MOTM')))}
        ${card('Golden Glove', '🧤', a.goldenGlove, a.goldenGlove ? (a.goldenGlove.saves + ' saves · ' + a.goldenGlove.clean + ' CS') : '')}
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
      if (tournament.champion) renderTournamentPodium();
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
      ${arr.map((p,i)=>`<div class="lb-mini-row ${i<3?'lb-mini-top rank-'+(i+1):''}" onclick="App.showPlayerProfile('${p.id}')" style="cursor:pointer">${rankBadge(i)}${lbAvatar(p,26)}<span class="lb-mini-name">${playerNameHTML(p)}</span><span style="color:var(--text-muted);font-size:0.75rem">${p.team||''}</span><b class="lb-mini-count">${p.count}</b></div>`).join('')||'<span style="color:var(--text-muted)">—</span>'}</div>`;
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
        ${col(emojiImg('goal', 'Goal') + ' Golden Boot', g)}
        ${col(emojiImg('assist', 'Assist') + ' Assists', a)}
        ${col('⭐ MOTM', m)}
        ${col(emojiImg('yellow_card', 'Yellow card') + ' Yellows', y)}
        ${col(emojiImg('red_card', 'Red card') + ' Reds', r)}
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
    el.innerHTML = tournament.knockout.map((round, ri) => `
      <div class="round"><div class="round-title">${round.name}${round.twoLeg ? ' (two legs)' : ''}</div>
      ${round.matches.map((m, mi) => {
        const score = m.played
          ? (m.twoLeg !== false && m.aggHome != null
              ? `Agg ${m.aggHome}-${m.aggAway}`
              : `${m.homeScore} - ${m.awayScore}`)
          : '-';
        const pensText = m.pens ? `pens ${m.pens.home}-${m.pens.away}` : 'pens';
        return `<div class="bracket-match ${m.played ? 'played' : ''}">
          <div class="bracket-team ${m.winner && m.winner.id === m.home.id ? 'winner' : ''}">
            <span>${teamMark(m.home, 18)} ${m.home.short}</span>
            <span class="bracket-score">${m.played ? (m.twoLeg !== false && m.aggHome != null ? m.aggHome : m.homeScore) : '-'}</span>
          </div>
          <div class="bracket-team ${m.winner && m.winner.id === m.away.id ? 'winner' : ''}">
            <span>${teamMark(m.away, 18)} ${m.away.short}</span>
            <span class="bracket-score">${m.played ? (m.twoLeg !== false && m.aggAway != null ? m.aggAway : m.awayScore) : '-'}</span>
          </div>
          ${m.penalties ? '<div style="font-size:0.7rem;color:var(--text-muted);text-align:center">' + pensText + '</div>' : ''}
          ${m.played && m.twoLeg !== false && m.aggHome != null ? '<div style="font-size:0.7rem;color:var(--text-muted);text-align:center">' + score + '</div>' : ''}
          ${(!m.played && m.home && m.away && !tournament.champion) ? `<div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">
            ${(!careerTeamId || m.home.id === careerTeamId || m.away.id === careerTeamId) ? `<button class="btn btn-primary btn-sm" onclick="App.playKnockoutMatch(${ri},${mi})">▶ Live</button>` : ''}
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
    // Career Mode picker — "play as" one club, like a FIFA/eFootball Career
    // Mode. Options are every club currently selected into any league below
    // (the actual pool of clubs that will exist in the season), so this
    // naturally stays in sync as the person ticks/unticks boxes.
    const careerPoolIds = new Set();
    SEASON_LEAGUE_DEFS.forEach(def => seasonSetup.selections[def.key].forEach(id => careerPoolIds.add(id)));
    const careerPool = [...careerPoolIds].map(id => getTeam(id)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
    if (careerTeamId && !careerPoolIds.has(careerTeamId)) careerTeamId = null;
    const careerCard = `<div class="card" style="margin-bottom:14px;border-color:var(--gold)">
        <div class="card-title">🎮 Career Mode</div>
        <div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:8px">Optional — take manual control of one club. You'll play that club's own matches live (with your own tactics, formation changes, and substitutions); every other match in the season is simulated automatically.</div>
        <select onchange="App.setCareerTeam(this.value)" style="width:100%;padding:8px 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-primary)" ${careerPool.length ? '' : 'disabled'}>
          <option value="">— Full AI season (no career club) —</option>
          ${careerPool.map(t => `<option value="${t.id}" ${careerTeamId === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
        </select>
      </div>`;
    el.innerHTML = careerCard + SEASON_LEAGUE_DEFS.map(def => {
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
  // Debounced per-competition — renderSeasonSetup() rebuilds the whole
  // season setup panel (every competition's team list) on each call, so
  // firing that on every keystroke was unnecessary lag. Keyed by compKey
  // since more than one competition's search box can be on screen at once.
  const _seasonSearchDebouncers = {};
  function searchSeasonTeams(compKey, value) {
    seasonSetup.search[compKey] = value;
    if (!_seasonSearchDebouncers[compKey]) {
      _seasonSearchDebouncers[compKey] = debounce(renderSeasonSetup, 150);
    }
    _seasonSearchDebouncers[compKey]();
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

/*@CHUNK:cx903:START*/

  // Repeating 10-slot fixture-congestion pattern: two 5-day domestic weeks
  // (Sat league, Tue continental, Sat league, Tue domestic cup, Sun league)
  // followed by a real-world-style international break — a Tue/Sat double
  // header reserved for World Cup qualifying (or the World Cup finals
  // themselves) once every ~2 domestic weeks, matching how FIFA windows
  // actually interrupt the club calendar rather than letting qualifying
  // play out whenever the person feels like clicking a button.
  // `season.daySlot` tracks the season's actual position in this cycle
  // (separate from the Matchday/round counter) and is what real play is
  // gated against — see seasonCompCanPlayNow and
  // advanceCongestionSlotIfComplete. The Cup slot plays each league's own
  // domestic cup (season.cups) and auto-skips once every cup has finished
  // for the season, same as the UCL slot once the Champions League is done,
  // and the International slot auto-skips once qualifying/the World Cup
  // isn't running (e.g. right at the very start of Year 1).
  const FIXTURE_CONGESTION_CYCLE = [
    { day: 'Sat', comp: 'League' },
    { day: 'Tue', comp: 'UCL' },
    { day: 'Sat', comp: 'League' },
    { day: 'Tue', comp: 'Cup' },
    { day: 'Sun', comp: 'League' },
    { day: 'Sat', comp: 'League' },
    { day: 'Tue', comp: 'UCL' },
    { day: 'Sat', comp: 'League' },
    { day: 'Tue', comp: 'International' },
    { day: 'Sun', comp: 'League' }
  ];

  function currentCongestionSlot() {
    const cyc = FIXTURE_CONGESTION_CYCLE;
    const base = (season && typeof season.daySlot === 'number') ? season.daySlot : 0;
    const idx = ((base % cyc.length) + cyc.length) % cyc.length;
    return cyc[idx];
  }

  // Which season competition keys are eligible to play under a given
  // congestion slot's competition label — 'League' covers all five
  // domestic leagues at once (they're not individually staggered), 'UCL'
  // is just the Champions League, 'Cup' is each league's domestic cup, and
  // 'International' is the national-team World Cup qualifying campaign (or
  // the World Cup finals themselves) — tracked outside `season.leagues`
  // entirely, so it's represented here by the synthetic 'world' key.
  function seasonKeysForCongestionComp(compLabel) {
    if (compLabel === 'League') return SEASON_LEAGUE_DEFS.map(d => d.key);
    if (compLabel === 'UCL') return ['ucl'];
    if (compLabel === 'Cup') return season && season.cups ? Object.keys(season.cups).map(k => 'cup_' + k) : [];
    if (compLabel === 'International') return ['world'];
    return [];
  }

  // Every still-unplayed fixture in the current round of whichever
  // national-team competition is live (qualifying groups, or the World Cup
  // groups/knockout round) — the international-break analogue of
  // seasonCupMatchesDue(). Returns [] whenever nothing is due, which is
  // also what lets advanceCongestionSlotIfComplete skip straight past the
  // International slot when it isn't relevant this cycle.
  function seasonInternationalMatchesDue() {
    const due = [];
    if (worldCup && !worldCup.finished) {
      if (worldCup.stage === 'groups') {
        worldCup.groups.forEach(g => {
          if (g.currentRound >= g.rounds.length) return;
          (g.rounds[g.currentRound] || []).forEach(f => {
            if (f.played) return;
            const home = getTeam(f.home), away = getTeam(f.away);
            due.push({ compName: 'World Cup', compKey: 'world', home: home ? home.short : '?', away: away ? away.short : '?' });
          });
        });
      } else if (worldCup.knockoutRound && !worldCup.knockoutRound.played) {
        worldCup.knockoutRound.fixtures.forEach(f => {
          if (f.played) return;
          const home = getTeam(f.home), away = getTeam(f.away);
          due.push({ compName: 'World Cup', compKey: 'world', home: home ? home.short : '?', away: away ? away.short : '?' });
        });
      }
    } else if (qualifiers && !qualifiers.finished) {
      qualifiers.groups.forEach(g => {
        if (g.currentRound >= g.rounds.length) return;
        (g.rounds[g.currentRound] || []).forEach(f => {
          if (f.played) return;
          const home = getTeam(f.home), away = getTeam(f.away);
          due.push({ compName: 'World Cup Qualifying', compKey: 'world', home: home ? home.short : '?', away: away ? away.short : '?' });
        });
      });
    }
    return due;
  }

  // Every domestic-cup fixture still waiting to be played, across every
  // league's cup — cups sit outside the Matchday/round-count system
  // entirely (like the UCL knockout stage), so they're tracked separately
  // from seasonMatchesDue() and only pulled in on the congestion cycle's
  // Cup day.
  function seasonCupMatchesDue() {
    if (!season || !season.cups) return [];
    const due = [];
    Object.keys(season.cups).forEach(k => {
      const comp = season.cups[k];
      if (!comp || comp.finished) return;
      const round = comp.rounds[comp.currentRound] || [];
      round.forEach(f => {
        if (f.played) return;
        const home = getTeam(f.home), away = getTeam(f.away);
        due.push({ compName: comp.name, compKey: 'cup_' + k, home: home ? home.short : '?', away: away ? away.short : '?' });
      });
    });
    return due;
  }

  // Every fixture still due for TODAY's congestion slot specifically —
  // narrower than seasonMatchesDue(), which covers every competition due
  // for the current matchday regardless of which day's slot they belong to.
  function seasonSlotMatchesDue() {
    if (!season) return [];
    const slotComp = currentCongestionSlot().comp;
    const keys = new Set(seasonKeysForCongestionComp(slotComp));
    if (slotComp === 'International') return seasonInternationalMatchesDue();
    return seasonMatchesDue().concat(seasonCupMatchesDue()).filter(d => keys.has(d.compKey));
  }

  // Moves the season on to the next day in the congestion cycle once
  // nothing due today is left to play. The Cup slot now has real fixtures
  // (each league's domestic cup) once a season is under way, so it's only
  // skipped once every domestic cup has actually finished.
  function advanceCongestionSlotIfComplete() {
    if (!season) return;
    if (typeof season.daySlot !== 'number') season.daySlot = 0;
    let guard = 0;
    while (guard++ < FIXTURE_CONGESTION_CYCLE.length) {
      const slot = currentCongestionSlot();
      if (seasonSlotMatchesDue().length) break;
      season.daySlot++;
    }
  }

  function fixtureCongestionSlot(offset) {
    const cyc = FIXTURE_CONGESTION_CYCLE;
    const base = (season && typeof season.daySlot === 'number') ? season.daySlot : 0;
    const idx = ((base + offset) % cyc.length + cyc.length) % cyc.length;
    return cyc[idx];
  }

  function renderFixtureCongestionHTML() {
    if (!season) return '';
    const uclDone = season.ucl && season.ucl.finished;
    const cupsDone = season.cups && Object.keys(season.cups).length &&
      Object.keys(season.cups).every(k => season.cups[k].finished);
    const intlDone = !worldCup && !qualifiers;
    const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => {
      const slot = fixtureCongestionSlot(i);
      const isCup = slot.comp === 'Cup';
      const isUcl = slot.comp === 'UCL';
      const isIntl = slot.comp === 'International';
      const disabled = (isCup && cupsDone) || (isUcl && uclDone) || (isIntl && intlDone);
      const label = isCup ? 'Cup' : isIntl ? '🌍 Intl' : slot.comp;
      const sub = (isCup && cupsDone) ? 'finished' : (isUcl && uclDone) ? 'finished' : (isIntl && intlDone) ? 'idle' : '';
      const cls = 'congestion-slot' + (i === 0 ? ' congestion-now' : '') + (disabled ? ' congestion-disabled' : '') + (isIntl ? ' congestion-intl' : '');
      const title = slot.day + ' — ' + (isIntl ? 'International Break' : slot.comp);
      return `<div class="${cls}" title="${title}">
        <div class="congestion-day">${slot.day}</div>
        <div class="congestion-comp">${label}</div>
        ${sub ? `<div style="font-size:0.62rem;color:var(--text-muted)">${sub}</div>` : ''}
      </div>`;
    });
    const strip = items.join('<div class="congestion-arrow">→</div>');
    return `<div style="font-size:0.7rem;letter-spacing:1px;color:var(--text-muted);text-transform:uppercase;margin-top:14px">📅 Fixture Congestion</div>
      <div class="congestion-strip">${strip}</div>`;
  }
/*@CHUNK:cx903:END*/

/*@CHUNK:c0569:START*/
  function renderSeasonDashboard() {
    if (!season) return;
    seasonReportRegistry = []; // rebuilt fresh each render so onclick indices stay valid
    const title = document.getElementById('season-status-title');
    if (title) title.textContent = 'Year ' + season.year + ' · ' + computeSeasonMonth(season) + ' · Matchday ' + season.week;
    const congestionEl = document.getElementById('season-congestion');
    if (congestionEl) congestionEl.innerHTML = renderFixtureCongestionHTML();
    const careerBannerEl = document.getElementById('season-career-banner');
    if (careerBannerEl) {
      if (careerTeamId) {
        const club = getTeam(careerTeamId);
        const dueFixture = findCareerFixtureDue();
        careerBannerEl.innerHTML = club ? `<div class="career-banner">
          <div>🎮 Playing as <strong>${club.name}</strong>${dueFixture ? ' — your match is ready!' : ' — sit tight, no match of yours is due this matchday.'}</div>
          ${dueFixture ? `<button class="btn btn-primary btn-sm" onclick="App.playSeasonFixture('${dueFixture.compKey}',${dueFixture.idx})">🎮 Play Your Match</button>` : ''}
        </div>` : '';
      } else {
        careerBannerEl.innerHTML = '';
      }
    }
    const dueEl = document.getElementById('season-due-banner');
    if (dueEl) {
      const slotComp = currentCongestionSlot().comp;
      const due = seasonMatchesDue()
        .concat(slotComp === 'Cup' ? seasonCupMatchesDue() : [])
        .concat(slotComp === 'International' ? seasonInternationalMatchesDue() : []);
      if (due.length) {
        const byComp = {};
        due.forEach(d => { (byComp[d.compName] = byComp[d.compName] || []).push(d.home + ' vs ' + d.away); });
        const lines = Object.keys(byComp).map(name => `<div style="margin-top:2px"><strong>${name}:</strong> ${byComp[name].join(', ')}</div>`).join('');
        const heading = slotComp === 'International'
          ? '⏳ International Break — ' + due.length + (due.length === 1 ? ' match is' : ' matches are') + ' still due before club football resumes:'
          : '⏳ Matchday ' + (season.week + 1) + " isn't complete yet — " + due.length + (due.length === 1 ? ' match is' : ' matches are') + ' still due before the day can change:';
        dueEl.innerHTML = `<div class="empty-state" style="text-align:left;padding:10px 14px;margin-top:10px;border:1px solid var(--accent-gold);border-radius:8px">
          <div style="font-size:0.8rem;color:var(--accent-gold)">${heading}</div>
          ${lines}
        </div>`;
      } else {
        dueEl.innerHTML = '';
      }
    }
    const tabsEl = document.getElementById('season-comp-tabs');
    if (tabsEl) {
      const cupTabs = season.cups ? SEASON_LEAGUE_DEFS.filter(d => season.cups[d.key]).map(d =>
        ({ key: 'cup_' + d.key, name: season.cups[d.key].name })) : [];
      const tabs = [...SEASON_LEAGUE_DEFS, ...cupTabs,
        { key: 'ucl', name: 'Champions League' },
        { key: 'world', name: '🌍 World' },
        { key: 'trophies', name: '🏆 Trophy Room' }];
      tabsEl.innerHTML = tabs.map(def => {
        const comp = def.key === 'ucl' ? season.ucl :
          (def.key === 'trophies' || def.key === 'world') ? null :
          resolveSeasonComp(def.key);
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
    if (seasonActiveTab === 'world') {
      contentEl.innerHTML = renderWorldCupTabHTML();
      return;
    }
    const comp = resolveSeasonComp(seasonActiveTab);
    if (!comp) { contentEl.innerHTML = ''; return; }
    if (!comp.stats) comp.stats = blankCompStats();

    if (isCupKey(seasonActiveTab)) {
      const subTabs = [
        { key: 'table', name: 'Bracket & Fixtures' },
        { key: 'stats', name: 'Stats' },
        { key: 'awards', name: 'Awards' }
      ];
      let h = '<div class="leaderboard-tabs" style="margin-bottom:12px">' + subTabs.map(st =>
        `<button class="lb-tab ${seasonActiveSubTab === st.key ? 'active' : ''}" onclick="App.showSeasonSubTab('${st.key}')">${st.name}</button>`
      ).join('') + '</div>';
      if (seasonActiveSubTab === 'stats') h += renderCompStatsHTML(comp);
      else if (seasonActiveSubTab === 'awards') h += renderCompAwardsHTML(comp);
      else h += renderCupCompHTML(comp, seasonActiveTab);
      contentEl.innerHTML = h;
      return;
    }

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

  // Read-only knockout-bracket summary + fixture list for a single domestic
  // cup — reuses renderFixtureList as-is (it already works generically off
  // comp.rounds/comp.currentRound/comp.finished, table-free).
  function renderCupCompHTML(comp, compKey) {
    let h = '<div class="group-card league-table-wrap">';
    h += '<h4>' + comp.name + '</h4>';
    if (comp.finished && comp.champion) {
      h += championBannerHTML(comp.name, comp.champion, { label: 'Champion', trophySize: 46, teamSize: 28 });
    } else {
      h += '<p style="font-size:0.75rem;color:var(--text-muted)">' + comp.teams.length +
        '-team knockout — currently ' + (comp.roundName || 'in progress') +
        ' (extra time + penalties if level).</p>';
    }
    h += '</div>';
    h += renderFixtureList(comp, compKey);
    return h;
  }

  // World tab: shows whichever national-team competition is currently
  // live — the qualifying campaign feeding the next World Cup, or the
  // World Cup finals itself once its season arrives. Simulating a round is
  // only ever allowed on the congestion cycle's International slot (a
  // real-world-style international break) — never as a free, play-anytime
  // action — so the button is disabled with an explanation the rest of the
  // week.
  function renderWorldCupTabHTML() {
    let h = '';
    const comp = worldCup || qualifiers;
    if (!comp) {
      return '<div class="empty-state"><div class="icon">🌍</div><p>No national-team competition running right now.</p></div>';
    }
    const onIntlSlot = !season || currentCongestionSlot().comp === 'International';
    const subTabs = [{ key: 'table', name: 'Table & Fixtures' }, { key: 'stats', name: 'Stats' }];
    h += '<div class="leaderboard-tabs" style="margin-bottom:12px">' + subTabs.map(st =>
      `<button class="lb-tab ${seasonActiveSubTab === st.key ? 'active' : ''}" onclick="App.showSeasonSubTab('${st.key}')">${st.name}</button>`
    ).join('') + '</div>';

    if (seasonActiveSubTab === 'stats') {
      if (!comp.stats) comp.stats = blankCompStats();
      h += renderCompStatsHTML(comp);
      return h;
    }

    if (!onIntlSlot) {
      h += `<div class="empty-state" style="text-align:left;padding:10px 14px;margin-bottom:12px;border:1px solid var(--accent-gold);border-radius:8px">
        <div style="font-size:0.8rem;color:var(--accent-gold)">🌍 International break fixtures wait for the congestion cycle's Intl slot — check the Fixture Congestion strip above for when the next one lands.</div>
      </div>`;
    }

    if (worldCup) {
      h += '<div class="group-card league-table-wrap"><h4>🌍 World Cup — Year ' + worldCup.year + '</h4>';
      if (worldCup.finished && worldCup.champion) {
        h += championBannerHTML('World Cup', worldCup.champion, { label: 'Champions', trophySize: 46, teamSize: 28 });
      } else if (worldCup.stage === 'groups') {
        h += '<p style="font-size:0.8rem;color:var(--text-muted)">Group stage — ' + worldCup.groups.length + ' groups of 4. Top 2 advance automatically; best third-placed sides fill out the knockout bracket.</p>';
      } else {
        h += '<p style="font-size:0.8rem;color:var(--text-muted)">Knockout stage — ' + (worldCup.roundName || '') + '.</p>';
      }
      if (!worldCup.finished) {
        h += `<button class="btn btn-primary btn-sm" ${onIntlSlot ? '' : 'disabled'} onclick="App.simulateWorldCupStep(); App.advanceCongestionSlotIfComplete(); App.renderSeasonDashboard();">▶ Simulate Next Round</button>`;
      }
      h += '</div>';
      if (worldCup.stage === 'groups') {
        worldCup.groups.forEach(g => {
          h += '<div class="group-card"><h5>Group ' + (g.id + 1) + '</h5>' + renderStandingsTableRows(g.table, { autoQualify: 2, wildcard: 1 }) + '</div>';
        });
      } else if (worldCup.knockoutRound) {
        h += '<div class="group-card"><h5>' + (worldCup.roundName || 'Knockout') + '</h5>' +
          worldCup.knockoutRound.fixtures.map(f => {
            const home = getTeam(f.home), away = getTeam(f.away);
            const score = f.played ? (f.homeScore + ' - ' + f.awayScore) : 'vs';
            return `<div class="fixture-row"><span>${home ? teamMark(home, 18) + ' ' + home.name : '?'}</span><span>${score}</span><span>${away ? teamMark(away, 18) + ' ' + away.name : '?'}</span></div>`;
          }).join('') + '</div>';
      }
    } else if (qualifiers) {
      h += '<div class="group-card league-table-wrap"><h4>🌍 World Cup Qualifying — for Year ' + qualifiers.forYear + '</h4>';
      h += '<p style="font-size:0.8rem;color:var(--text-muted)">' + qualifiers.groups.length +
        ' qualifying groups — group winners qualify automatically, best runners-up fill the 48-team field.</p>';
      if (!qualifiers.finished) {
        h += `<button class="btn btn-primary btn-sm" ${onIntlSlot ? '' : 'disabled'} onclick="App.simulateQualifyingRound(); App.advanceCongestionSlotIfComplete(); App.renderSeasonDashboard();">▶ Simulate Next Round</button>`;
      } else {
        h += '<p style="font-size:0.85rem">✅ Qualifying complete — ' + (qualifiers.qualified ? qualifiers.qualified.length : 0) + ' teams through to the World Cup.</p>';
      }
      h += '</div>';
      qualifiers.groups.forEach(g => {
        h += '<div class="group-card"><h5>Group ' + (g.id + 1) + '</h5>' + renderStandingsTableRows(g.table, { autoQualify: 1, wildcard: g.table.length - 1 }) + '</div>';
      });
    }
    return h;
  }

  // Official-competition-style standings table shared by the World Cup and
  // qualifying group cards — ranked crest rows with a coloured left-edge
  // qualification stripe (green = qualifies automatically, amber = still
  // alive for a wildcard/best-runner-up spot), mirroring the look of a real
  // tournament group table rather than a bare unstyled HTML table.
  function renderStandingsTableRows(table, opts) {
    opts = opts || {};
    const autoQualify = opts.autoQualify || 0;
    const wildcard = opts.wildcard || 0;
    const sorted = sortedTable(table);
    let h = '<div class="fifa-table-wrap"><table class="fifa-table"><thead><tr>' +
      '<th class="ft-pos">#</th><th class="ft-team">Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th>' +
      '</tr></thead><tbody>';
    sorted.forEach((r, i) => {
      const gd = r.gf - r.ga;
      const zoneCls = i < autoQualify ? ' ft-zone-auto' : (i < autoQualify + wildcard ? ' ft-zone-wildcard' : '');
      h += `<tr class="${zoneCls}"><td class="ft-pos"><span class="ft-pos-num">${i + 1}</span></td>` +
        `<td class="ft-team">${teamMark(r.team, 20)}<span class="ft-team-name">${r.team.name}</span></td>` +
        `<td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td>` +
        `<td>${r.gf}</td><td>${r.ga}</td><td>${gd > 0 ? '+' + gd : gd}</td><td class="ft-pts">${r.pts}</td></tr>`;
    });
    h += '</tbody></table></div>';
    if (autoQualify || wildcard) {
      h += '<div class="ft-legend">' +
        (autoQualify ? '<span class="ft-legend-item"><i class="ft-dot ft-dot-auto"></i>Qualifies automatically</span>' : '') +
        (wildcard ? '<span class="ft-legend-item"><i class="ft-dot ft-dot-wildcard"></i>Best-runner-up contention</span>' : '') +
        '</div>';
    }
    return h;
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
      const canPlay = seasonCompCanPlayNow(compKey, comp);
      h += `<div class="card-title" style="margin-top:12px">Matchday ${comp.currentRound + 1} — ${canPlay ? 'Play Now' : 'Waiting on other competitions'}</div>`;
      if (!canPlay) {
        h += `<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px">${comp.name} has finished this matchday already — it can't start the next one until every other competition catches up. See the notice above for what's still due.</div>`;
      }
      currentUnplayed.forEach(f => {
        const home = getTeam(f.home), away = getTeam(f.away);
        if (!home || !away) return;
        const idx = currentRound.indexOf(f);
        const isCareerFixture = careerTeamId && (f.home === careerTeamId || f.away === careerTeamId);
        let actions;
        if (!canPlay) {
          actions = `<button class="btn btn-secondary btn-sm" disabled>⏳ Not due yet</button>`;
        } else if (careerTeamId) {
          // Career Mode: only the person's own fixture can be watched/played
          // live — every other match on the card is Instant-only, so the
          // person only ever steps onto the pitch for their own team.
          actions = isCareerFixture
            ? `<button class="btn btn-primary btn-sm" onclick="App.playSeasonFixture('${compKey}',${idx})">🎮 Play Your Match</button>`
            : `<button class="btn btn-secondary btn-sm" onclick="App.simSeasonFixture('${compKey}',${idx})">⚡ Instant</button>`;
        } else {
          actions = `<button class="btn btn-primary btn-sm" onclick="App.playSeasonFixture('${compKey}',${idx})">▶ Play Live</button>
          <button class="btn btn-secondary btn-sm" onclick="App.simSeasonFixture('${compKey}',${idx})">⚡ Instant</button>`;
        }
        h += `<div class="fixture-item"><span class="fixture-teams">${teamMark(home, 18)} ${home.short} vs ${teamMark(away, 18)} ${away.short}</span>${actions}</div>`;
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
          <span class="fixture-teams">${teamMark(home, 18)} ${home.short} ${f.homeScore}-${f.awayScore} ${teamMark(away, 18)} ${away.short}</span>
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
          <span class="fixture-teams">${teamMark(home, 18)} ${home.short} ${f.homeScore}-${f.awayScore} ${teamMark(away, 18)} ${away.short}${pensTxt} <small style="color:var(--accent-gold)">→ ${winner ? winner.short : '?'}</small></span></div>`;
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
