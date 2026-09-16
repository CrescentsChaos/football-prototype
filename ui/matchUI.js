/*@CHUNK:c0052:START*/

  // Tries each URL in order, returns the first successful JSON response, or
  // null if every candidate fails/404s. Used for every optional/primary
  // startup JSON file below so those files can all be requested at once via
  // Promise.all instead of one after another — previously each of the 6
  // files below fully awaited (including its own up-to-3-URL fallback
  // chain) before the next one even started, which is what made startup
  // feel laggy. Nothing about the fallback/cache-busting behavior itself
  // changed, only the fact that the 6 chains now run concurrently.
  async function fetchFirstJson(urls, label) {
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
        if (!res.ok) continue;
        const data = await res.json();
        if (data && typeof data === 'object') {
          if (label) console.log('Loaded', label, 'from', url);
          return data;
        }
      } catch (err) { console.warn('Fetch failed', url, err); }
    }
    return null;
  }

  // Some players in teams.json legitimately appear twice under the SAME id
  // — once on their national side, once on their club — because they're
  // the same real person (e.g. Pelé for Brazil 1962 and Santos 1962-63).
  // That's fine and is what lets getAllPlayersFlat() merge them into one
  // profile showing both affiliations. But a handful of ids collide by
  // accident between two DIFFERENT players on the same squad (a genuine
  // data bug) — those must never be treated as "the same player", since
  // merging them would corrupt stats, squad selection, and substitution
  // bookkeeping (all keyed by player id). This repairs that second case by
  // giving every genuinely-colliding duplicate a fresh, unique id before
  // anything else in the app touches teamsData, while leaving true
  // same-player-same-id pairs (matching name) completely untouched so the
  // national/club merge in getAllPlayersFlat() keeps working.
  function repairDuplicatePlayerIds() {
    const seen = {}; // id -> first player object seen with that id
    const allIds = new Set();
    (teamsData.national || []).forEach(t => (t.players || []).forEach(p => allIds.add(p.id)));
    (teamsData.club || []).forEach(t => (t.players || []).forEach(p => allIds.add(p.id)));
    let renamed = 0;
    const rename = (p) => {
      let n = 2, newId;
      do { newId = p.id + '__dup' + n; n++; } while (allIds.has(newId));
      allIds.add(newId);
      p.id = newId;
      renamed++;
    };
    [...(teamsData.national || []), ...(teamsData.club || [])].forEach(t => {
      (t.players || []).forEach(p => {
        if (!p || !p.id) return;
        const prior = seen[p.id];
        if (!prior) { seen[p.id] = p; return; }
        // Same id already seen. Same name -> genuinely the same real
        // player on a second squad, leave as-is (this is the merge case).
        // Different name -> accidental collision between two different
        // players; give this one a new id so they stop clobbering each
        // other's stats/selection.
        if (prior.name !== p.name) rename(p);
      });
    });
    if (renamed) console.warn('Repaired', renamed, 'colliding duplicate player id(s) in teams.json');
  }

  async function init() {
    try {
      const isHosted = location.protocol === 'http:' || location.protocol === 'https:';
      const urlSet = (file) => isHosted
        ? [file + '?v=' + Date.now() + '&r=' + seededRandom().toString(36).slice(2), './' + file + '?v=' + Date.now(), file]
        : [file + '?v=' + Date.now()];

      // All 6 startup JSON files (1 required, 5 optional) load concurrently.
      const [teamsJson, leaguesJson, playersJson, trophiesJson, managersJson, attrJson] = await Promise.all([
        fetchFirstJson(urlSet('teams.json'), 'teams'),
        fetchFirstJson(urlSet('leagues.json'), 'leagues'),
        fetchFirstJson(urlSet('players.json'), 'player portraits'),
        fetchFirstJson(urlSet('trophies.json'), 'trophy images'),
        fetchFirstJson(urlSet('managers.json'), 'manager portraits'),
        fetchFirstJson(urlSet('player-attributes.json'), 'expanded player attributes')
      ]);

      let loaded = null;
      let source = 'embedded';
      if (teamsJson && ((teamsJson.national && teamsJson.national.length) || (teamsJson.club && teamsJson.club.length))) {
        loaded = teamsJson;
        source = 'teams.json';
      }
      teamsData = loaded || TEAMS_DATA;
      if (!loaded) {
        source = 'embedded';
        console.warn('Using EMBEDDED team data — teams.json was NOT loaded from server');
      }
      repairDuplicatePlayerIds();
      allTeams = [...(teamsData.national || []), ...(teamsData.club || [])];
      if (!allTeams.length) throw new Error('No teams found');
      // Resolve every team's manager playstyle now (teams.json "playstyle" if
      // set, otherwise a random one) so it's stable for the rest of the session.
      allTeams.forEach(getManagerPlaystyle);
      // Snapshot each player's raw teams.json overall (rawOvr) before form
      // restoration or attribute boosting touch p.ovr at all — the overall
      // system below always derives a non-expanded player's baseline from
      // this untouched value, so the -5% adjustment can never compound
      // across repeated init() calls or save/reload sessions.
      allTeams.forEach(t => (t.players || []).forEach(p => { if (typeof p.rawOvr !== 'number') p.rawOvr = p.ovr; }));

      // leagues.json — optional, falls back to manual club selection in
      // Season Setup when absent.
      if (leaguesJson) leaguesData = leaguesJson;

      // players.json — optional, players just show their shirt number
      // instead of a portrait when absent.
      if (playersJson) playerPortraits = playersJson;

      // trophies.json — optional, trophies show the 🏆 emoji instead of an
      // image when absent.
      if (trophiesJson) trophyImages = trophiesJson;

      // managers.json — optional layer on top of the embedded
      // MANAGER_PORTRAITS_DATA baseline that's already loaded by default.
      if (managersJson) {
        const clean = { ...managersJson };
        delete clean._comment;
        managerPortraits = { ...MANAGER_PORTRAITS_DATA, ...clean };
      }

      // player-attributes.json — optional; the app works exactly as before
      // for any player not listed here.
      if (attrJson) playerAttributesData = attrJson;

      loadStats();
      loadPersistedGameState();
      restorePlayerForms();
      applyExpandedPlayerAttributes();
      // Canonicalize every player's position codes (CF -> ST, RWF -> RW,
      // CMF -> CM, DMF -> CDM, SS/AMF -> CAM, etc.) so formation auto-fill,
      // substitutions, and position filters treat every naming variant of
      // the same real position identically — see normalizeAllPositions()
      // in js/state.js for why this has to run after
      // applyExpandedPlayerAttributes() (which is what sets pos from the
      // raw, non-canonical player-attributes.json codes in the first place).
      normalizeAllPositions(allTeams);
      populateTeamSelects();
      populateFormations();
      bindNav();
      renderTeamsList();
      restoreTournamentUI();
      restoreSeasonUI();
      const savedView = (function () { try { return localStorage.getItem('apexActiveView'); } catch (e) { return null; } })();
      if (savedView && savedView !== 'home' && document.getElementById('view-' + savedView)) switchView(savedView);
      setupAutoSave();
      try {
        if (sessionStorage.getItem('apexJustReset') === '1') {
          sessionStorage.removeItem('apexJustReset');
          setTimeout(() => toast('All data reset — fresh start'), 300);
        }
        if (sessionStorage.getItem('apexJustImported') === '1') {
          sessionStorage.removeItem('apexJustImported');
          setTimeout(() => toast('Save imported — progress restored'), 300);
        }
      } catch (e) {}
      console.log('Apex Sim ready:', allTeams.length, 'teams | source:', source);
      window.__APEX_DATA_SOURCE = source;
    } catch (e) {
      console.error(e);
      alert('Error loading game: ' + e.message);
    }
  }

/*@CHUNK:c0052:END*/

/*@CHUNK:c0053:START*/
  function bindNav() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        if (view) switchView(view);
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      }
    });
  }
/*@CHUNK:c0053:END*/

/*@CHUNK:c0054:START*/

/*@CHUNK:c0054:END*/

/*@CHUNK:c0055:START*/
  function switchView(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => { t.classList.remove('active'); t.removeAttribute('aria-current'); });
    const viewEl = document.getElementById('view-' + view);
    if (viewEl) viewEl.classList.add('active');
    const tabEl = document.querySelector(`.nav-tab[data-view="${view}"]`);
    if (tabEl) { tabEl.classList.add('active'); tabEl.setAttribute('aria-current', 'page'); }
    if (view === 'leaderboard') showLeaderboard('goals');
    if (view === 'awards') showAwards('overview');
    if (view === 'history') showHistory(historyActiveTab || 'team');
    if (view === 'teams') renderTeamsList();
    if (view === 'players') renderPlayersList(false);
    if (view === 'season') goToSeason();
  }
/*@CHUNK:c0055:END*/

/*@CHUNK:c0056:START*/

/*@CHUNK:c0056:END*/

/*@CHUNK:c0057:START*/
  function randomMatch(category) {
    // category: 'national' | 'club' | 'all'
    let pool = allTeams;
    if (category === 'national') pool = teamsData.national || [];
    if (category === 'club') pool = teamsData.club || [];
    if (pool.length < 2) { toast('Need at least 2 teams'); return; }
    const shuffled = shuffleArray([...pool]);
    const home = shuffled[0], away = shuffled[1];
    goToMatch();
    const homeSel = document.getElementById('home-team');
    const awaySel = document.getElementById('away-team');
    if (homeSel) homeSel.value = home.id;
    if (awaySel) awaySel.value = away.id;
    updateTeamPreview('home'); updateTeamPreview('away');
    // Formations reflect each team's set formation (from teams.json) if any,
    // otherwise a per-team default that spreads teams across the pool.
    const hf = document.getElementById('home-formation');
    const af = document.getElementById('away-formation');
    if (hf) hf.value = pickTeamFormation(home);
    if (af) af.value = pickTeamFormation(away);
    toast(`${home.flag||''} ${home.name} vs ${away.flag||''} ${away.name}`);
  }
/*@CHUNK:c0057:END*/

/*@CHUNK:c0058:START*/

/*@CHUNK:c0058:END*/

/*@CHUNK:c0059:START*/
  function goToMatch() {
    switchView('match');
    const setup = document.getElementById('match-setup');
    const live = document.getElementById('match-live');
    if (setup) setup.style.display = 'block';
    if (live) live.style.display = 'none';
    // Plain Kick Off from Home — not linked to any tournament or season fixture.
    // `tournament` must be cleared here too (not just the fixture-index flags
    // below): matchCompetitionLabel() checks `tournament` first when labelling
    // a completed match for the player/team match logs, so a stale tournament
    // object left over from a previous tournament run (only ever cleared by
    // resetTournament(), never just by navigating away) caused every
    // "friendly" match played afterward to be mislabelled with the old
    // tournament's name instead of falling through to "Friendly".
    tournament = null;
    window._tourFixtureIdx = null;
    window._uclFixtureIdx = null;
    window._koRoundIdx = null;
    window._koMatchIdx = null;
    window._fromTournament = false;
    window._seasonFixture = null;
    window._backTarget = null;
    currentSeasonComp = null;
  }
/*@CHUNK:c0059:END*/

/*@CHUNK:c0131:START*/

  
  
  
/*@CHUNK:c0131:END*/

/*@CHUNK:c0132:START*/
  function showETPrompt(drawn, pensOnly) {
    let el = document.getElementById('et-prompt');
    if (!el) {
      const live = document.getElementById('match-live');
      if (!live) return;
      el = document.createElement('div');
      el.id = 'et-prompt';
      el.className = 'et-prompt';
      live.insertBefore(el, live.firstChild.nextSibling);
    }
    if (pensOnly) {
      el.innerHTML = `<p>Still level after extra time. Take the penalty shootout?</p>
        <button class="btn btn-primary btn-sm" onclick="App.continueToPens()">⚽ Penalties</button>
        <button class="btn btn-secondary btn-sm" onclick="App.skipETAndEnd()">End as draw</button>`;
    } else {
      el.innerHTML = `<p>Full time and the scores are level.</p>
        ${currentMatch.allowET ? '<button class="btn btn-primary btn-sm" onclick="App.continueToET()">⏱ Extra Time</button>' : ''}
        ${currentMatch.allowPens ? '<button class="btn btn-primary btn-sm" onclick="App.continueToPens()">⚽ Penalties</button>' : ''}
        <button class="btn btn-secondary btn-sm" onclick="App.skipETAndEnd()">End as draw</button>`;
    }
    el.classList.add('show');
  }
/*@CHUNK:c0132:END*/

/*@CHUNK:c0133:START*/

/*@CHUNK:c0133:END*/

/*@CHUNK:c0134:START*/
  function hideETPrompt() {
    const el = document.getElementById('et-prompt');
    if (el) { el.classList.remove('show'); el.innerHTML = ''; }
  }
/*@CHUNK:c0134:END*/

/*@CHUNK:c0153:START*/

/*@CHUNK:c0153:END*/

/*@CHUNK:c0154:START*/
  function renderGoalTimeline() {
    const homeEl = document.getElementById('home-goal-scorers');
    const awayEl = document.getElementById('away-goal-scorers');
    if (!currentMatch) {
      if (homeEl) homeEl.innerHTML = '';
      if (awayEl) awayEl.innerHTML = '';
      return;
    }
    const goals = currentMatch.goalList || [];
    const fmt = (arr) => arr.map(g => {
      return `<div class="scorer-line"><span class="gt-min">${g.minute}'</span> ${g.player}${g.pen ? ' <span class="pen-tag">[Penalty]</span>' : ''}${g.num != null && g.num !== '' ? ' · '+g.num : ''}</div>`;
    }).join('');
    if (homeEl) homeEl.innerHTML = fmt(goals.filter(g => g.side === 'home'));
    if (awayEl) awayEl.innerHTML = fmt(goals.filter(g => g.side === 'away'));
  }
/*@CHUNK:c0154:END*/

/*@CHUNK:c0157:START*/

  // Shared row renderer so a tournament/season match report and the live
  // post-match panel render a player's rating line identically.
/*@CHUNK:c0157:END*/

/*@CHUNK:c0158:START*/
  function renderRatingRow(p, motmId) {
    const isMotm = motmId != null && p.id === motmId;
    const rc = isMotm ? 'rating-motm' : (p.rating || 0) >= 7.5 ? 'rating-high' : (p.rating || 0) >= 6.5 ? 'rating-mid' : 'rating-low';
    const icons = (p.goals ? '⚽'.repeat(Math.min(p.goals, 3)) : '') + (p.assists ? '🎯'.repeat(Math.min(p.assists, 2)) : '');
    return `<div class="pm-player" onclick="App.showPlayerProfile('${p.id}')" style="cursor:pointer">
        <span class="player-num">${p.num || ''}</span>
        <span style="flex:1;font-weight:600">${playerNameHTML(p)}${isMotm ? ' <span title="Man of the Match">⭐</span>' : ''}</span>
        <span>${icons}</span>
        <span class="xg">xG ${(p.xg || 0).toFixed(2)} · xA ${(p.xa || 0).toFixed(2)}</span>
        <span class="rating-badge ${rc}">${(p.rating || 0).toFixed(1)}</span>
      </div>`;
  }
/*@CHUNK:c0158:END*/

/*@CHUNK:cx904:START*/

  // Renders the full Attack / Passing / Defense / Physical / Goalkeeping
  // stat breakdown as a series of small side-by-side tables, using
  // whatever the two teams' stats objects carry (deriveExtendedMatchStats
  // in engine/matchEngine.js fills these in for every match at full time).
  function renderCategorizedTeamStatsHTML(h, a) {
    const hs = h.stats || {}, as_ = a.stats || {};
    const row = (label, key, suffix) =>
      `<tr><td>${label}</td><td>${hs[key] !== undefined ? hs[key] : 0}${suffix || ''}</td><td>${as_[key] !== undefined ? as_[key] : 0}${suffix || ''}</td></tr>`;
    const section = (title, rowsHtml) =>
      `<div class="card-title" style="margin-top:14px">${title}</div><div class="table-scroll"><table class="lb-table" style="margin-bottom:6px"><thead><tr><th></th><th>${h.short}</th><th>${a.short}</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;

    const attack = row('Shots', 'shots') + row('On Target', 'shotsOn') + row('Big Chances', 'bigChances') + row('Big Chances Missed', 'bigChancesMissed')
      + row('Touches', 'touches') + row('Touches In Box', 'touchesInBox') + row('Progressive Carries', 'progressiveCarries') + row('Carries', 'carries')
      + row('Dribbles', 'dribbles') + row('Successful Dribbles', 'successfulDribbles') + row('Offsides', 'offsides');

    const passAcc = (v) => v ? Math.round(100 * (v.passesCompleted || 0) / v.passes) + '%' : '—';
    const passing = row('Passes', 'passes') + row('Completed', 'passesCompleted')
      + `<tr><td>Pass Accuracy</td><td>${hs.passes ? passAcc(hs) : '—'}</td><td>${as_.passes ? passAcc(as_) : '—'}</td></tr>`
      + row('Progressive Passes', 'progressivePasses') + row('Key Passes', 'keyPasses') + row('Through Balls', 'throughBalls')
      + row('Crosses', 'crosses') + row('Switches', 'switches') + row('Long Balls', 'longBalls') + row('Final-Third Passes', 'finalThirdPasses');

    const defense = row('Tackles', 'tackles') + row('Interceptions', 'interceptions') + row('Blocks', 'blocks') + row('Clearances', 'clearances')
      + row('Headed Clearances', 'headedClearances') + row('Defensive Errors', 'defensiveErrors') + row('Recoveries', 'recoveries')
      + row('Pressures', 'pressures') + row('Aerial Duels', 'aerialDuels');

    const physical = row('Distance (km)', 'distance') + row('Sprints', 'sprints') + row('High-Speed Runs', 'highSpeedRuns')
      + row('Accelerations', 'accelerations') + row('Decelerations', 'decelerations');

    const gk = row('Saves', 'saves') + row('Punches', 'punches') + row('Claims', 'claims') + row('Crosses Stopped', 'crossesStopped')
      + row('Goals Prevented', 'goalsPrevented') + row('PSxG', 'psxg') + row('Distribution', 'distribution', '%');

    return section('⚔️ Attack', attack) + section('🎯 Passing', passing) + section('🛡️ Defense', defense) + section('🏃 Physical', physical) + section('🧤 Goalkeeping', gk);
  }
/*@CHUNK:cx904:END*/

/*@CHUNK:c0159:START*/

  let _reportLegsCtx = null; // { legs: [{label, report}], activeIdx, aggText }

/*@CHUNK:c0159:END*/

/*@CHUNK:c0160:START*/
  function showMatchReport(report, legsCtx) {
    _reportLegsCtx = legsCtx || null;
    const ctx = _reportLegsCtx;
    if (!report) { toast('No match details available'); return; }
    const modal = document.getElementById('match-report-modal');
    const content = document.getElementById('match-report-content');
    if (!modal || !content) return;
    const h = report.home, a = report.away;
    const scoreLine = (h.penScore != null)
      ? `${h.score} (${h.penScore}) - (${a.penScore}) ${a.score}`
      : `${h.score} - ${a.score}`;
    const goalsH = (report.goals || []).filter(g => g.side === 'home');
    const goalsA = (report.goals || []).filter(g => g.side === 'away');
    const fmtG = (arr) => arr.map(g => `${g.minute}' ${g.player}${g.pen || /^penalty/i.test(g.method || '') ? ' <span class="pen-tag">[Penalty]</span>' : ''}`).join('<br>') || '—';
    // Prefer the home/away-split ratings captured by buildMatchReport; fall back
    // to the old flat map for any legacy report objects saved before this split existed.
    const homeRatings = h.ratings || Object.values(report.ratings || {});
    const awayRatings = a.ratings || [];
    let eventsHtml = (report.events || []).filter(e => e.type !== 'pressure' || seededRandom() < 0.3).slice(-80).map(e => {
      const t = (e.text || '').replace(/<[^>]+>/g, '');
      return `<div class="report-event"><span class="re-min">${e.minute}'</span> <span class="re-type">${e.type}</span> ${t}</div>`;
    }).join('');
    // show important events only for cleaner view
    eventsHtml = (report.events || []).filter(e => ['goal','yellow','red','injury','sub','pen','var','motm','whistle','save','miss'].includes(e.type)).map(e => {
      const t = (e.text || '').replace(/<[^>]+>/g, '');
      return `<div class="report-event"><span class="re-min">${e.minute}'</span> ${t}</div>`;
    }).join('');
    const legTabsHtml = (ctx && ctx.legs && ctx.legs.length > 1)
      ? `<div style="display:flex;gap:6px;justify-content:center;margin-bottom:10px;flex-wrap:wrap">
          ${ctx.legs.map((leg, i) => `<button class="btn btn-sm ${i === ctx.activeIdx ? 'btn-primary' : 'btn-secondary'}" onclick="App.showMatchReportLeg(${i})">${leg.label}</button>`).join('')}
        </div>
        ${ctx.aggText ? `<div style="text-align:center;font-size:0.8rem;color:var(--accent-gold);margin-bottom:8px">${ctx.aggText}</div>` : ''}`
      : '';
    content.innerHTML = `
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-size:0.85rem;color:var(--text-muted)">Match Report</div>
        ${legTabsHtml}
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:8px">
          <div style="flex:1;text-align:left"><div style="font-size:1.4rem">${teamMark(h, 28)}</div><strong>${h.name}</strong><div class="goal-scorers">${fmtG(goalsH)}</div></div>
          <div style="font-size:1.6rem;font-weight:800;color:var(--accent-gold)">${scoreLine}</div>
          <div style="flex:1;text-align:right"><div style="font-size:1.4rem">${teamMark(a, 28)}</div><strong>${a.name}</strong><div class="goal-scorers away-scorers">${fmtG(goalsA)}</div></div>
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px">${h.formation||''} vs ${a.formation||''}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">🏟️ ${report.venue || 'Wembley Stadium'}</div>
      </div>
      <div class="card-title">Key Events</div>
      <div style="max-height:220px;overflow-y:auto;margin-bottom:12px">${eventsHtml || '<span style="color:var(--text-muted)">No events logged</span>'}</div>
      <div class="card-title">Team Stats</div>
      <div class="table-scroll"><table class="lb-table" style="margin-bottom:12px"><thead><tr><th></th><th>${h.short}</th><th>${a.short}</th></tr></thead>
      <tbody>
        <tr><td>Shots</td><td>${(h.stats&&h.stats.shots)||0}</td><td>${(a.stats&&a.stats.shots)||0}</td></tr>
        <tr><td>On Target</td><td>${(h.stats&&h.stats.shotsOn)||0}</td><td>${(a.stats&&a.stats.shotsOn)||0}</td></tr>
        <tr><td>Possession</td><td>${(h.stats&&h.stats.possession)||50}%</td><td>${(a.stats&&a.stats.possession)||50}%</td></tr>
        <tr><td>Passes</td><td>${(h.stats&&h.stats.passes)||0}</td><td>${(a.stats&&a.stats.passes)||0}</td></tr>
        <tr><td>Passes completed</td><td>${(h.stats&&h.stats.passesCompleted)||0}</td><td>${(a.stats&&a.stats.passesCompleted)||0}</td></tr>
        <tr><td>Pass accuracy</td><td>${(h.stats&&h.stats.passes)?Math.round(100*(h.stats.passesCompleted||0)/h.stats.passes)+'%':'—'}</td><td>${(a.stats&&a.stats.passes)?Math.round(100*(a.stats.passesCompleted||0)/a.stats.passes)+'%':'—'}</td></tr>
        <tr><td>Interceptions</td><td>${(h.stats&&h.stats.interceptions)||0}</td><td>${(a.stats&&a.stats.interceptions)||0}</td></tr>
        <tr><td>Blocks</td><td>${(h.stats&&h.stats.blocks)||0}</td><td>${(a.stats&&a.stats.blocks)||0}</td></tr>
        <tr><td>Corners</td><td>${(h.stats&&h.stats.corners)||0}</td><td>${(a.stats&&a.stats.corners)||0}</td></tr>
        <tr><td>Fouls</td><td>${(h.stats&&h.stats.fouls)||0}</td><td>${(a.stats&&a.stats.fouls)||0}</td></tr>
        <tr><td>Saves</td><td>${(h.stats&&h.stats.saves)||0}</td><td>${(a.stats&&a.stats.saves)||0}</td></tr>
        <tr><td>Yellow / Red</td><td>${(h.stats&&h.stats.yellows)||0} / ${(h.stats&&h.stats.reds)||0}</td><td>${(a.stats&&a.stats.yellows)||0} / ${(a.stats&&a.stats.reds)||0}</td></tr>
      </tbody></table></div>
      ${renderCategorizedTeamStatsHTML(h, a)}
      <div class="card-title" style="margin-top:14px">Player Ratings (${homeRatings.length + awayRatings.length} players)</div>
      <div style="max-height:280px;overflow-y:auto">
        <div style="font-size:0.8rem;color:var(--accent-gold);margin:8px 0 4px">${teamMark(h, 18)} ${h.name}</div>
        ${homeRatings.map(p => renderRatingRow(p, report.motmId)).join('') || '<div style="color:var(--text-muted);font-size:0.85rem">No data</div>'}
        <div style="font-size:0.8rem;color:var(--accent-gold);margin:12px 0 4px">${teamMark(a, 18)} ${a.name}</div>
        ${awayRatings.map(p => renderRatingRow(p, report.motmId)).join('') || '<div style="color:var(--text-muted);font-size:0.85rem">No data</div>'}
      </div>
      <div class="modal-actions"><button class="btn btn-secondary" onclick="document.getElementById('match-report-modal').classList.remove('active')">Close</button></div>`;
    modal.classList.add('active');
  }
/*@CHUNK:c0160:END*/

/*@CHUNK:c0161:START*/

  // Switch the currently-open match report modal to a different leg (two-leg ties only).
/*@CHUNK:c0161:END*/

/*@CHUNK:c0162:START*/
  function showMatchReportLeg(idx) {
    if (!_reportLegsCtx || !_reportLegsCtx.legs || !_reportLegsCtx.legs[idx]) return;
    _reportLegsCtx.activeIdx = idx;
    showMatchReport(_reportLegsCtx.legs[idx].report, _reportLegsCtx);
  }
/*@CHUNK:c0162:END*/

/*@CHUNK:c0163:START*/

/*@CHUNK:c0163:END*/

/*@CHUNK:c0164:START*/
  function viewFixtureReport(idx) {
    if (!tournament || !tournament.fixtures[idx] || !tournament.fixtures[idx].report) {
      toast('No detailed report for this match');
      return;
    }
    showMatchReport(tournament.fixtures[idx].report, null);
  }
/*@CHUNK:c0164:END*/

/*@CHUNK:c0165:START*/

/*@CHUNK:c0165:END*/

/*@CHUNK:c0166:START*/
  function viewKnockoutReport(ri, mi) {
    const m = tournament && tournament.knockout[ri] && tournament.knockout[ri].matches[mi];
    if (!m) { toast('No detailed report for this match'); return; }
    if (m.twoLeg !== false && m.leg1 && m.leg2 && m.leg1.report && m.leg2.report) {
      const aggText = (m.aggHome != null) ? `Aggregate: ${m.home.short} ${m.aggHome} - ${m.aggAway} ${m.away.short}${m.penalties ? ' (on penalties)' : ''}` : '';
      const legs = [
        { label: `Leg 1 · ${m.leg1.report.home.short} home`, report: m.leg1.report },
        { label: `Leg 2 · ${m.leg2.report.home.short} home`, report: m.leg2.report }
      ];
      showMatchReport(legs[1].report, { legs, activeIdx: 1, aggText });
      return;
    }
    if (!m.report) { toast('No detailed report for this match'); return; }
    showMatchReport(m.report, null);
  }
/*@CHUNK:c0166:END*/

/*@CHUNK:c0262:START*/

  
/*@CHUNK:c0262:END*/

/*@CHUNK:c0263:START*/
  function renderMomentumAndHeat() {
    const m = currentMatch;
    if (!m || m.quietSim) return;
    let wrap = document.getElementById('momentum-heat');
    if (!wrap) {
      const live = document.getElementById('match-live');
      const lineup = document.getElementById('lineup-display');
      if (!live) return;
      wrap = document.createElement('div');
      wrap.id = 'momentum-heat';
      if (lineup && lineup.parentNode) lineup.parentNode.insertBefore(wrap, lineup);
      else live.appendChild(wrap);
    }
    wrap.innerHTML = `
      <div class="momentum-wrap"><h4>Match Momentum</h4><canvas id="momentum-canvas" height="80"></canvas></div>
      <div class="heatmap-wrap"><h4>Activity Heat (zones)</h4><canvas id="heatmap-canvas" height="140"></canvas></div>`;
    // Momentum: walk events, +1 home goal/shot, -1 away
    const canvas = document.getElementById('momentum-canvas');
    if (canvas) {
      const w = canvas.parentElement.clientWidth || 300;
      canvas.width = w;
      const ctx = canvas.getContext('2d');
      const events = m.events || [];
      let mom = 0;
      const pts = [{x:0, y:0}];
      events.forEach((e, i) => {
        let d = 0;
        if (e.type === 'goal') d = e.side === 'home' ? 3 : (e.side === 'away' ? -3 : 0);
        else if (e.type === 'shot' || e.type === 'miss') d = e.side === 'home' ? 1 : (e.side === 'away' ? -1 : 0);
        else if (e.type === 'save') d = e.side === 'home' ? -0.8 : (e.side === 'away' ? 0.8 : 0);
        else if (e.type === 'yellow' || e.type === 'red') d = e.side === 'home' ? -0.5 : (e.side === 'away' ? 0.5 : 0);
        mom = Math.max(-12, Math.min(12, mom + d));
        pts.push({ x: (e.minute || i) / Math.max(m.minute, 90), y: mom });
      });
      const homeCol = m.home.team.color || '#3d8bfd';
      const awayCol = m.away.team.color || '#ef4444';
      ctx.clearRect(0, 0, w, 80);
      ctx.fillStyle = '#0a1210';
      ctx.fillRect(0, 0, w, 80);
      // midline
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(w, 40); ctx.stroke();
      // Fill home (above mid = home momentum) and away (below)
      if (pts.length > 1) {
        for (let i = 1; i < pts.length; i++) {
          const x0 = pts[i-1].x * w, x1 = pts[i].x * w;
          const y0 = 40 - (pts[i-1].y / 12) * 36;
          const y1 = 40 - (pts[i].y / 12) * 36;
          const midY = (y0 + y1) / 2;
          ctx.beginPath();
          ctx.moveTo(x0, 40); ctx.lineTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x1, 40);
          ctx.closePath();
          ctx.fillStyle = midY < 40 ? homeCol + '55' : awayCol + '55';
          ctx.fill();
        }
      }
      ctx.beginPath();
      pts.forEach((p, i) => {
        const x = p.x * w;
        const y = 40 - (p.y / 12) * 36;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#f0c14b';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Legend
      ctx.fillStyle = homeCol;
      ctx.fillRect(8, 6, 10, 10);
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.fillText(m.home.team.short || 'HOME', 22, 15);
      ctx.fillStyle = awayCol;
      ctx.fillRect(w - 70, 6, 10, 10);
      ctx.fillStyle = '#fff';
      ctx.fillText(m.away.team.short || 'AWAY', w - 56, 15);
    }
    // Heatmap: 3x3 zones from event sides + random based on possession
    const hc = document.getElementById('heatmap-canvas');
    if (hc) {
      const w = hc.parentElement.clientWidth || 300;
      hc.width = w;
      const ctx = hc.getContext('2d');
      const grid = Array.from({length: 3}, () => [0,0,0]);
      (m.events || []).forEach(e => {
        const row = e.side === 'home' ? 2 : (e.side === 'away' ? 0 : 1);
        const col = Math.floor(seededRandom() * 3);
        let wgt = 1;
        if (e.type === 'goal') wgt = 4;
        else if (e.type === 'shot' || e.type === 'miss') wgt = 2;
        else if (e.type === 'save') wgt = 2;
        grid[row][col] += wgt;
      });
      // blend possession
      const hp = (m.home.stats && m.home.stats.possession) || 50;
      for (let c = 0; c < 3; c++) {
        grid[2][c] += hp / 25;
        grid[0][c] += (100 - hp) / 25;
      }
      let max = 1;
      grid.forEach(r => r.forEach(v => { if (v > max) max = v; }));
      const cellW = w / 3, cellH = 140 / 3;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const t = grid[r][c] / max;
          ctx.fillStyle = `rgba(34,197,94,${0.1 + t * 0.75})`;
          ctx.fillRect(c * cellW + 1, r * cellH + 1, cellW - 2, cellH - 2);
        }
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(0.5, 0.5, w - 1, 139);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '10px sans-serif';
      ctx.fillText(m.away.team.short || 'AWAY', 8, 14);
      ctx.fillText(m.home.team.short || 'HOME', 8, 134);
    }
  }
/*@CHUNK:c0263:END*/

/*@CHUNK:c0266:START*/

/*@CHUNK:c0266:END*/

/*@CHUNK:c0267:START*/
  function addEvent(minute, type, text, side, isGoal) {
    if (!currentMatch) return;
    currentMatch.events.push({ minute, type, text, side });
    if (currentMatch.quietSim) return;
    const feed = document.getElementById('events-feed');
    if (!feed) return;
    const icons = { goal: '⚽', save: '🧤', yellow: '🟨', red: '🟥', sub: '🔄', injury: '🩹', corner: '🚩', foul: '⚠️', tackle: '🦵', shot: '👟', miss: '❌', pass: '➡️', offside: '🚫', whistle: '📢', pressure: '🔥', motm: '⭐', var: '📺', pen: '⚽', skill: '✨', handball: '✋', et: '⏱️' };
    const div = document.createElement('div');
    div.className = 'event-item' + (isGoal || type === 'goal' ? ' event-goal' : '') + (type === 'red' ? ' event-card-red' : '') + (type === 'injury' ? ' event-injury' : '') + (type === 'var' ? ' event-var' : '') + (type === 'pen' ? ' event-pen' : '');
    div.innerHTML = `<span class="event-time">${minute}'</span><span class="event-icon">${icons[type] || '•'}</span><span class="event-text">${text}</span>`;
    feed.insertBefore(div, feed.firstChild);
    if (['goal','sub','yellow','red','injury','pen'].includes(type)) {
      try { renderLineups(); } catch (e) {}
    }
  }
/*@CHUNK:c0267:END*/

/*@CHUNK:c0268:START*/

/*@CHUNK:c0268:END*/

/*@CHUNK:c0269:START*/
  function updateScoreboard() {
    if (!currentMatch) return;
    if (currentMatch.quietSim) return;
    const m = currentMatch;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const setHTML = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
    setHTML('live-home-flag', teamMark(m.home.team, 26));
    set('live-home-name', m.home.team.short || m.home.team.name);
    set('live-home-form', (FORMATIONS[m.home.squad.formation] || {}).name || '');
    setHTML('live-away-flag', teamMark(m.away.team, 26));
    set('live-away-name', m.away.team.short || m.away.team.name);
    set('live-away-form', (FORMATIONS[m.away.squad.formation] || {}).name || '');
    const hm = document.getElementById('live-home-mgr');
    const am = document.getElementById('live-away-mgr');
    const hStyle = getManagerPlaystyle(m.home.team);
    const aStyle = getManagerPlaystyle(m.away.team);
    const hMgrName = m.home.team.manager ? m.home.team.manager.name : '';
    const aMgrName = m.away.team.manager ? m.away.team.manager.name : '';
    if (hm) hm.innerHTML = hMgrName ? managerAvatarMark(m.home.team.manager, 18) + ' ' + hMgrName + (hStyle ? ' (' + hStyle + ')' : '') : '';
    if (am) am.innerHTML = aMgrName ? aMgrName + (aStyle ? ' (' + aStyle + ')' : '') + ' ' + managerAvatarMark(m.away.team.manager, 18) : '';
    const hs = m.home.penScore != null ? `${m.home.score} (${m.home.penScore})` : m.home.score;
    const as_ = m.away.penScore != null ? `${m.away.score} (${m.away.penScore})` : m.away.score;
    // Pop the scoreline when it actually changes, so a goal feels like a
    // goal rather than the number just silently updating.
    const popIfChanged = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      const changed = el.textContent !== String(val) && el.dataset.popped !== undefined;
      el.textContent = val;
      el.dataset.popped = '1';
      if (changed) {
        el.classList.remove('score-pop');
        void el.offsetWidth; // restart animation
        el.classList.add('score-pop');
      }
    };
    popIfChanged('live-home-score', hs);
    popIfChanged('live-away-score', as_);
    set('live-minute', m.inPens ? 'Pens' : (m.minute + "'"));
    set('live-status', m.status);
    set('live-venue', '🏟️ ' + getStadium(m.home.team));
    renderGoalTimeline();
  }
/*@CHUNK:c0269:END*/

/*@CHUNK:c0270:START*/

/*@CHUNK:c0270:END*/

/*@CHUNK:c0271:START*/
  function updateStatsPanel() {
    if (!currentMatch) return;
    if (currentMatch.quietSim) return;
    const h = currentMatch.home.stats, a = currentMatch.away.stats;
    const ts = (h.shots + a.shots) || 1, ton = (h.shotsOn + a.shotsOn) || 1;
    const tc = (h.corners + a.corners) || 1, tf = (h.fouls + a.fouls) || 1, tsv = (h.saves + a.saves) || 1;
    const el = document.getElementById('live-stats');
    if (!el) return;
    const hp = (v, t) => t ? Math.round((v/t)*100) : 50;
    el.innerHTML = `
      <div class="stat-row"><span class="stat-val">${h.shots}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${hp(h.shots,ts)}%"></div><div class="stat-bar-away" style="width:${hp(a.shots,ts)}%"></div></div><span class="stat-val">${a.shots}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Shots</div>
      <div class="stat-row"><span class="stat-val">${h.shotsOn}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${hp(h.shotsOn,ton)}%"></div><div class="stat-bar-away" style="width:${hp(a.shotsOn,ton)}%"></div></div><span class="stat-val">${a.shotsOn}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">On Target</div>
      <div class="stat-row"><span class="stat-val">${h.possession}%</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${h.possession}%"></div><div class="stat-bar-away" style="width:${a.possession}%"></div></div><span class="stat-val">${a.possession}%</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Possession</div>
      <div class="stat-row"><span class="stat-val">${h.corners}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${hp(h.corners,tc)}%"></div><div class="stat-bar-away" style="width:${hp(a.corners,tc)}%"></div></div><span class="stat-val">${a.corners}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Corners</div>
      <div class="stat-row"><span class="stat-val">${h.fouls}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${hp(h.fouls,tf)}%"></div><div class="stat-bar-away" style="width:${hp(a.fouls,tf)}%"></div></div><span class="stat-val">${a.fouls}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Fouls</div>
      <div class="stat-row"><span class="stat-val">${h.saves}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${hp(h.saves,tsv)}%"></div><div class="stat-bar-away" style="width:${hp(a.saves,tsv)}%"></div></div><span class="stat-val">${a.saves}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Saves</div>
      <div class="stat-row"><span class="stat-val">${h.yellows}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${hp(h.yellows,h.yellows+a.yellows||1)}%"></div><div class="stat-bar-away" style="width:${hp(a.yellows,h.yellows+a.yellows||1)}%"></div></div><span class="stat-val">${a.yellows}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted)">Yellow Cards</div>`;
  }
/*@CHUNK:c0271:END*/

/*@CHUNK:c0272:START*/


/*@CHUNK:c0272:END*/

/*@CHUNK:c0273:START*/
  function renderPitch() {
    if (!currentMatch) return;
    const m = currentMatch;
    const wrap = document.getElementById('pitch-display');
    if (!wrap) return;

    const luminance = (c) => {
      if (!c || c[0] !== '#') return 128;
      let hex = c.replace('#','');
      if (hex.length === 3) hex = hex.split('').map(ch => ch+ch).join('');
      if (hex.length < 6) return 128;
      const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
      return (r*299 + g*587 + b*114) / 1000;
    };

    const drawTeam = (side) => {
      const s = m[side];
      const form = FORMATIONS[s.squad.formation] || FORMATIONS['4-3-3'];
      const coords = form.coords || [];
      const slots = form.slots || [];
      const onPitchIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
      const allPlayers = [...(s.squad.starting || []), ...(s.squad.subs || []), ...(s.squad.all || [])];
      // Unique by id
      const byId = {};
      allPlayers.forEach(p => { if (p && p.id) byId[p.id] = p; });
      // Map current on-pitch players into formation slots
      const onPitchPlayers = onPitchIds.map(id => byId[id]).filter(Boolean);
      const assigned = new Set();
      const slotPlayers = [];
      slots.forEach((slot, idx) => {
        // Prefer player already marked with this slot
        let pick = onPitchPlayers.find(p => !assigned.has(p.id) && (p.slot === slot || (p.pos || []).includes(slot)));
        if (!pick) pick = onPitchPlayers.find(p => !assigned.has(p.id) && canPlay(p, slot));
        if (!pick) pick = onPitchPlayers.find(p => !assigned.has(p.id));
        if (pick) {
          assigned.add(pick.id);
          slotPlayers[idx] = pick;
        }
      });
      // Any remaining on-pitch players fill empty slots
      onPitchPlayers.forEach(p => {
        if (assigned.has(p.id)) return;
        const empty = slots.findIndex((_, i) => !slotPlayers[i]);
        if (empty >= 0) { slotPlayers[empty] = p; assigned.add(p.id); }
      });

      let primary = s.team.color || '#1a237e';
      let secondary = s.team.secondary || '#ffffff';
      const textCol = luminance(primary) > 160 ? '#0a0e17' : '#ffffff';
      const used = [];
      let dots = '';
      slotPlayers.forEach((p, idx) => {
        if (!p) return;
        let c = coords[idx] || [50, 50];
        let x = c[0], y = c[1];
        // Collision avoidance: name labels are wider than the dot, so push
        // apart when two dots sit too close together (weighted distance,
        // since labels overflow horizontally more than vertically).
        //
        // Two things were wrong with the previous version, and together
        // they visibly warped most formations' shapes (4-3-3, 4-1-4-1,
        // every back-three/back-five system, etc.):
        //  1. It pushed a dot toward/away from whichever neighbor it
        //     happened to collide with, rather than away from the pitch's
        //     own center line — for a symmetric formation (e.g. a central
        //     CDM sitting between two wide CMs) this dragged the CENTER
        //     player sideways into one teammate's territory instead of
        //     nudging outward, breaking left/right symmetry.
        //  2. It also jittered players vertically, which pulled the
        //     center-back of every back-three formation out of its
        //     designed deeper "sweeper" spot and flattened the back line.
        // The fix: only ever push horizontally, and always outward from
        // pitch-center (x=50) based on the dot's OWN side — so a nudge
        // preserves the formation's shape/symmetry instead of distorting
        // it. The goalkeeper is also excluded from the check entirely: it
        // sits alone at the byline and its designed proximity to a deep
        // center-back (intentional in back-three systems) was being
        // mistaken for a dot overlap.
        if (idx !== 0) {
          for (let t = 0; t < 8; t++) {
            const hit = used.find(u => Math.hypot((u.x - x) * 1.5, u.y - y) < 16);
            if (!hit) break;
            const dir = (x - 50) >= 0 ? 1 : -1;
            x += dir * 4;
            x = Math.max(8, Math.min(92, x));
          }
        }
        if (idx !== 0) used.push({ x, y });

        const isSubOn = (s.squad.subs || []).some(sub => sub.id === p.id);
        dots += `<div class="player-dot${isSubOn ? ' sub-on' : ''}" style="left:${x}%;top:${y}%;background:${primary};border:2px solid ${secondary}">
          <span class="dot-avatar">${playerAvatarMark(p)}</span>
          <span class="dot-label"><span class="dot-num">${p.num || ''}</span><span class="dot-name">${playerNameHTML(p, abbreviateName(p.name))}</span></span>
        </div>`;
      });
      const mgrTag = s.team.manager && s.team.manager.name
        ? `<span class="pitch-mgr">${managerAvatarMark(s.team.manager, 16)} ${s.team.manager.name}</span>` : '';
      return `<div class="mini-pitch team-pitch">
        <div class="pitch-label">${teamMark(s.team, 16)} ${s.team.short} · ${form.name}${mgrTag}</div>
        ${dots}
      </div>`;
    };

    wrap.innerHTML = `<div class="pitch-pair">${drawTeam('home')}${drawTeam('away')}</div>`;
  }
/*@CHUNK:c0273:END*/

/*@CHUNK:c0274:START*/


/*@CHUNK:c0274:END*/

/*@CHUNK:c0275:START*/
  function playerLineIcons(ps, subInfo, onPitch, inj) {
    let icons = '';
    if (ps) {
      for (let i = 0; i < (ps.goals || 0); i++) icons += '<span class="li-icon" title="Goal">⚽</span>';
      for (let i = 0; i < (ps.assists || 0); i++) icons += '<span class="li-icon" title="Assist">🅰️</span>';
      if (ps.yellow) icons += '<span class="li-icon" title="Yellow">🟨</span>';
      if (ps.red) icons += '<span class="li-icon" title="Red">🟥</span>';
    }
    if (inj) icons += '<span class="li-icon" title="Injured">🩹</span>';
    if (subInfo && subInfo.outMin != null) icons += `<span class="li-sub out" title="Subbed off">🔻${subInfo.outMin}'</span>`;
    if (subInfo && subInfo.inMin != null) icons += `<span class="li-sub in" title="Subbed on">🔺${subInfo.inMin}'</span>`;
    return icons;
  }
/*@CHUNK:c0275:END*/

/*@CHUNK:c0276:START*/

/*@CHUNK:c0276:END*/

/*@CHUNK:c0277:START*/
  function liveRatingBadge(ps) {
    if (!ps) return '<span class="rating-badge rating-mid">6.0</span>';
    const r = calcPlayerRating(ps);
    ps.rating = r;
    const cls = r >= 7.5 ? 'rating-high' : r >= 6.5 ? 'rating-mid' : 'rating-low';
    return `<span class="rating-badge ${cls}">${r.toFixed(1)}</span>`;
  }
/*@CHUNK:c0277:END*/

/*@CHUNK:c0278:START*/

/*@CHUNK:c0278:END*/

/*@CHUNK:c0279:START*/
  function renderLineups() {
    if (!currentMatch) return;
    const m = currentMatch;
    if (!m.playerMatchStats) m.playerMatchStats = {};
    if (!m.subLog) m.subLog = { home: {}, away: {} };

    const row = (p, side, isSubList) => {
      const onPitchIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
      const on = onPitchIds.includes(p.id);
      const inj = (m.injuries || []).includes(p.id);
      if (!m.playerMatchStats[p.id]) m.playerMatchStats[p.id] = blankPlayerMatchStats(p);
      const ps = m.playerMatchStats[p.id];
      // Keep the live rating badge in sync with the current scoreline too,
      // not just the final rating computed at full time in endMatch.
      ps.goalsConceded = side === 'home' ? m.away.score : m.home.score;
      const subInfo = (m.subLog[side] || {})[p.id];
      const sentOff = !!ps.red;
      const icons = playerLineIcons(ps, subInfo, on, inj);
      const rating = liveRatingBadge(ps);
      const dim = (!on && !inj && !sentOff && !(subInfo && subInfo.outMin != null)) ? 'opacity:0.55' : '';
      const pos = p.slot || (p.pos || [''])[0] || '';
      const passAcc = ps.passes ? Math.round(100 * (ps.passesCompleted || 0) / ps.passes) : null;
      const passInfo = (ps.passes > 0)
        ? `<span class="player-passes" title="Passes completed / attempted">${ps.passesCompleted || 0}/${ps.passes} <em>(${passAcc}%)</em></span>`
        : '';
      return `<li class="player-item ${isSubList ? 'sub' : ''} ${inj ? 'injured' : ''} ${sentOff ? 'sent-off' : ''}" onclick="App.showPlayerProfile('${p.id}')" style="cursor:pointer;${dim}">
        <span class="player-num">${p.num || ''}</span>
        <span class="player-pos">${pos}</span>
        <span class="player-name">${playerNameHTML(p)}${sentOff ? ' <span class="sent-off-tag">SENT OFF</span>' : ''}</span>
        ${passInfo}
        <span class="player-icons">${icons}</span>
        ${rating}
      </li>`;
    };

    const html = (side) => {
      const s = m[side];
      const used = side === 'home' ? m.homeSubsUsed : m.awaySubsUsed;
      const form = (FORMATIONS[s.squad.formation] || {}).name || s.squad.formation || '';
      const tac = (m.tactics && m.tactics[side]) || 'balanced';
      let h = `<div class="lineup-team">
        <h4>${teamMark(s.team, 18)} ${s.team.short || s.team.name} · ${form}
          <span class="subs-badge">${used}/${m.maxSubs || 5} subs</span>
          <span class="tac-badge">${tac}</span>
        </h4>
        <ul class="player-list">`;
      // Starting XI order, including those subbed off
      (s.squad.starting || []).forEach(p => { h += row(p, side, false); });
      // Subs: original bench + any who came on already listed? Show all bench pool
      h += `<li class="bench-label">Substitutes</li>`;
      (s.squad.subs || []).forEach(p => { h += row(p, side, true); });
      return h + '</ul></div>';
    };

    const el = document.getElementById('lineup-display');
    if (el) el.innerHTML = html('home') + html('away');
    // Live tactics / formation controls during match
    let ctrl = document.getElementById('live-tactics-bar');
    if (!ctrl) {
      const parent = document.getElementById('lineup-display');
      if (parent && parent.parentNode) {
        ctrl = document.createElement('div');
        ctrl.id = 'live-tactics-bar';
        parent.parentNode.insertBefore(ctrl, parent);
      }
    }
    if (ctrl && !m.finished && !m.quietSim) {
      const forms = Object.keys(FORMATIONS).map(f => `<option value="${f}">${f}</option>`).join('');
      ctrl.innerHTML = `
        <div class="live-tac-row">
          <span class="live-tac-label">Home</span>
          <select id="live-form-home" onchange="App.changeFormationLive('home', this.value)">${forms}</select>
          <select id="live-tac-home" onchange="App.setTacticsLive('home', this.value)">
            <option value="balanced">Balanced</option>
            <option value="attack">Attack</option>
            <option value="defend">Defend</option>
            <option value="press">Press</option>
          </select>
          <span class="live-tac-label">Away</span>
          <select id="live-form-away" onchange="App.changeFormationLive('away', this.value)">${forms}</select>
          <select id="live-tac-away" onchange="App.setTacticsLive('away', this.value)">
            <option value="balanced">Balanced</option>
            <option value="attack">Attack</option>
            <option value="defend">Defend</option>
            <option value="press">Press</option>
          </select>
        </div>`;
      const fh = document.getElementById('live-form-home');
      const fa = document.getElementById('live-form-away');
      const th = document.getElementById('live-tac-home');
      const ta = document.getElementById('live-tac-away');
      if (fh) fh.value = m.home.squad.formation || '4-3-3';
      if (fa) fa.value = m.away.squad.formation || '4-3-3';
      if (th) th.value = (m.tactics && m.tactics.home) || 'balanced';
      if (ta) ta.value = (m.tactics && m.tactics.away) || 'balanced';
    } else if (ctrl && m.finished) {
      ctrl.innerHTML = '';
    }
    renderPitch();
  }
/*@CHUNK:c0279:END*/

/*@CHUNK:c0464:START*/


/*@CHUNK:c0464:END*/

/*@CHUNK:c0465:START*/
  function showLoading(msg) {
    let el = document.getElementById('loading-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'loading-overlay';
      el.innerHTML = '<div class="loading-box"><div class="loading-spinner"></div><div class="loading-text" id="loading-text">Simulating…</div>'
        + '<div class="loading-progress-track" id="loading-progress-track" style="display:none"><div class="loading-progress-fill" id="loading-progress-fill" style="width:0%"></div></div>'
        + '<div class="loading-sub" id="loading-sub">Please wait</div></div>';
      document.body.appendChild(el);
    }
    const t = document.getElementById('loading-text');
    const s = document.getElementById('loading-sub');
    const track = document.getElementById('loading-progress-track');
    const fill = document.getElementById('loading-progress-fill');
    if (t) t.textContent = msg || 'Simulating…';
    if (s) s.textContent = 'Please wait — do not close the page';
    // Reset any progress bar from a previous run until updateLoadingProgress()
    // is explicitly called again (plain single-shot sims never call it, so
    // they correctly stay a bare spinner with no bar).
    if (track) track.style.display = 'none';
    if (fill) fill.style.width = '0%';
    el.classList.add('show');
  }
/*@CHUNK:c0465:END*/

/*@CHUNK:c0466:START*/

/*@CHUNK:c0466:END*/

/*@CHUNK:c0467:START*/
  function hideLoading() {
    const el = document.getElementById('loading-overlay');
    if (el) el.classList.remove('show');
  }
/*@CHUNK:c0467:END*/

/*@CHUNK:c0468:START*/

  // Formats a millisecond duration as a short "Xm Ys" / "Xs" string for the
  // progress bar's estimated-time-remaining label.
  function formatEtaDuration(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    if (totalSec < 1) return '<1s';
    if (totalSec < 60) return totalSec + 's';
    const m = Math.floor(totalSec / 60), s = totalSec % 60;
    return m + 'm ' + (s ? s + 's' : '');
  }

  // Updates the loading overlay's progress bar (fill width + ETA label)
  // given how many of `total` work units are done and when the whole
  // operation started. `startTime` should be a Date.now() timestamp taken
  // right before the first unit was simulated — the ETA is extrapolated
  // from the average time-per-unit seen so far, so it gets more accurate
  // as the simulation progresses. Shows/reveals the bar on first call so
  // plain single-shot sims (which never call this) keep the old bare
  // spinner look.
  function updateLoadingProgress(done, total, startTime) {
    const track = document.getElementById('loading-progress-track');
    const fill = document.getElementById('loading-progress-fill');
    const s = document.getElementById('loading-sub');
    if (!track || !fill) return;
    track.style.display = 'block';
    const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 0;
    fill.style.width = pct + '%';
    if (s) {
      if (done >= total) {
        s.textContent = 'Finishing up…';
      } else {
        const elapsed = Date.now() - startTime;
        const perUnit = done > 0 ? elapsed / done : 0;
        const etaMs = perUnit * Math.max(0, total - done);
        s.textContent = `${pct}% · ${done}/${total} · ~${formatEtaDuration(etaMs)} remaining`;
      }
    }
  }

  // A zero-work "tick" that yields control back to the browser for one
  // frame so a progress bar update actually gets painted before the next
  // chunk of (synchronous) simulation work runs. Used between individual
  // match simulations in bulk sim loops (simAllTournament, Simulate To End
  // of Season) — see their async loops in tournamentEngine.js / seasonEngine.js.
  function simTick() {
    return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  }
/*@CHUNK:c0468:END*/

/*@CHUNK:c0469:START*/
  function withLoading(msg, fn) {
    showLoading(msg || 'Simulating…');
    // Double rAF so the overlay is painted before heavy sync work
    return new Promise(function(resolve) {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          setTimeout(function() {
            let result;
            try {
              result = fn();
            } catch (e) {
              console.error(e);
              toast('Error: ' + (e && e.message ? e.message : e));
            } finally {
              hideLoading();
              persistAll();
            }
            resolve(result);
          }, 50);
        });
      });
    });
  }
/*@CHUNK:c0469:END*/

/*@CHUNK:c0469b:START*/
  // Async counterpart to withLoading() for bulk sims that need to show real
  // incremental progress (Simulate All / Simulate To End of Season) instead
  // of a single blocking spinner. `asyncFn` is an async function that does
  // its own repeated updateLoadingProgress()+await simTick() calls between
  // chunks of work — this wrapper just handles showing/hiding the overlay
  // and the same error/persist handling as withLoading().
  async function withLoadingProgress(msg, asyncFn) {
    showLoading(msg || 'Simulating…');
    await simTick();
    await simTick();
    let result;
    try {
      result = await asyncFn();
    } catch (e) {
      console.error(e);
      toast('Error: ' + (e && e.message ? e.message : e));
    } finally {
      hideLoading();
      persistAll();
    }
    return result;
  }
/*@CHUNK:c0469b:END*/

/*@CHUNK:c0470:START*/

/*@CHUNK:c0470:END*/

/*@CHUNK:c0471:START*/
  function toast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
/*@CHUNK:c0471:END*/

/*@CHUNK:c0472:START*/

  
/*@CHUNK:c0472:END*/

/*@CHUNK:c0473:START*/
  function renderPostMatchRatings() {
    if (!currentMatch || !currentMatch.playerMatchStats) return;
    if (currentMatch.quietSim) return;
    const el = document.getElementById('post-match-ratings');
    if (!el) return;
    const m = currentMatch;
    const entries = Object.values(m.playerMatchStats).sort((a,b) => b.rating - a.rating);
    let h = '<div class="card-title">Post-Match Ratings (' + entries.length + ' players)</div>';
    // Group by team
    const homeIds = new Set((m.home.squad.all||[]).map(p=>p.id));
    const homeP = entries.filter(p => homeIds.has(p.id));
    const awayP = entries.filter(p => !homeIds.has(p.id));
    h += `<div style="font-size:0.8rem;color:var(--accent-gold);margin:8px 0 4px">${m.home.team.flag||''} ${m.home.team.name}</div>`;
    h += homeP.map(p => renderRatingRow(p, m.motmId)).join('') || '<div style="color:var(--text-muted);font-size:0.85rem">No data</div>';
    h += `<div style="font-size:0.8rem;color:var(--accent-gold);margin:12px 0 4px">${m.away.team.flag||''} ${m.away.team.name}</div>`;
    h += awayP.map(p => renderRatingRow(p, m.motmId)).join('') || '<div style="color:var(--text-muted);font-size:0.85rem">No data</div>';
    el.innerHTML = h;
    el.style.display = 'block';
  }
/*@CHUNK:c0473:END*/

/*@CHUNK:c0474:START*/

/*@CHUNK:c0474:END*/

/*@CHUNK:c0475:START*/
  function returnToTournament() {
    const backBtn = document.getElementById('back-to-tournament');
    if (backBtn) { backBtn.style.display = 'none'; backBtn.classList.remove('show'); }
    window._fromTournament = false;
    const target = window._backTarget === 'season' ? 'season' : 'tournament';
    window._backTarget = null;
    if (target === 'season') {
      switchView('season');
      try { renderSeasonDashboard(); } catch (e) {}
      toast('Back to season — results updated');
      return;
    }
    switchView('tournament');
    if (tournament) {
      try { refreshTournamentStatsUI(); } catch (e) {}
      try { renderGroups(); } catch (e) {}
      try { renderBracket(); } catch (e) {}
      try { if (typeof renderUCLTable === 'function') renderUCLTable(); } catch (e) {}
      try { renderTournamentAwards(); } catch (e) {}
    }
    toast('Back to tournament — results updated');
  }
/*@CHUNK:c0475:END*/

/*@CHUNK:c0598:START*/

  return {
    setRngSeed, getRngSeed,
    init, switchView, goToMatch, goToTournament, selectTournamentFormat, updateTeamPreview,
    startMatch, quickSimMatch, toggleSim, setSpeed, simToEnd, finishMatch, resetMatch,
    showLeaderboard, selectAllTeams, deselectAllTeams, startTournament,
    simTournamentRound, simAllTournament, resetTournament, filterTeams,
    showAwards, goToSquadBuilder, playTournamentMatch, simSingleFixture,
    returnToTournament, showPlayerProfile, showTeamProfile, randomMatch,
    resetLeaderboard, manualSave, exportSave, triggerImportSave, importSaveFile,
    searchTeams, sortTeams, searchTournamentTeams,
    openSquadBuilder, setSquadSlot, toggleBench, openSlotPicker, closeSlotPicker,
    playKnockoutMatch, updateTournamentSelectedCount, autoFillSquadBuilder,
    saveSquadBuilder, closeSquadBuilder, onFormationChange, changeFormationLive,
    setTacticsLive, continueToET, continueToPens, skipETAndEnd,
    renderMomentumAndHeat, showLoading, hideLoading, refreshTournamentStatsUI,
    simKnockoutMatch, viewFixtureReport, viewKnockoutReport, showMatchReport, showMatchReportLeg,
    simUCLFixture, playUCLFixture, simPlayoffTie, viewPlayoffReport,
    goToSeason, searchSeasonTeams, toggleSeasonTeam, autoFillSeason, clearSeasonSetup,
    startSeason, simulateSeasonWeek, simulateSeasonToEnd, startNewSeasonYear, resetSeason,
    showSeasonComp, showSeasonSubTab, viewSeasonReport, showHistory,
    simSeasonFixture, playSeasonFixture,
    searchPlayers, sortPlayers, filterPlayersPos, filterPlayersType, loadMorePlayers,
    togglePlayersCompareMode, togglePlayerCompare, clearPlayersCompare, openPlayersCompare
  };
})();

// Expose for inline onclick handlers
try { window.App = App; } catch (e) {}

// ========== SEARCHABLE DROPDOWNS ==========
// Auto-enhances every native <select> in the page (present now or added
// later, e.g. formation pickers rebuilt mid-match) into a searchable custom
// dropdown: a button + panel with a text search box, instead of the plain
// browser <select> list. The original <select> stays in the DOM (hidden) as
// the real source of truth, so all existing .value reads/writes and
// onchange="" handlers keep working untouched.
(function () {
/*@CHUNK:c0598:END*/

/*@CHUNK:c0599:START*/
  function closeAllPanels(except) {
    document.querySelectorAll('.ss-wrap.open').forEach(w => { if (w !== except) w.classList.remove('open'); });
  }
/*@CHUNK:c0599:END*/

/*@CHUNK:c0600:START*/

/*@CHUNK:c0600:END*/

/*@CHUNK:c0601:START*/
  function collectOptions(select) {
    const items = [];
    Array.from(select.children).forEach(node => {
      if (node.tagName === 'OPTGROUP') {
        Array.from(node.children).forEach(opt => items.push({ value: opt.value, label: opt.textContent, group: node.label, logo: opt.dataset.logo, flag: opt.dataset.flag, name: opt.dataset.name }));
      } else if (node.tagName === 'OPTION') {
        items.push({ value: node.value, label: node.textContent, group: null, logo: node.dataset.logo, flag: node.dataset.flag, name: node.dataset.name });
      }
    });
    return items;
  }
/*@CHUNK:c0601:END*/

/*@CHUNK:c0602:START*/

/*@CHUNK:c0602:END*/

/*@CHUNK:c0603:START*/
  // Local mirror of teamMark() (defined inside the main App closure in
  // ui/playerUI.js, and NOT reachable from this separate IIFE — calling the
  // real teamMark() here throws "teamMark is not defined" and silently
  // aborts renderOptions(), which is why searching/opening the team
  // dropdowns showed no results at all). Kept intentionally identical to
  // teamMark()'s output (logo image with flag-emoji fallback) so the two
  // never visually diverge.
  function ssTeamMark(logo, flag, size) {
    size = size || 22;
    const f = flag || '⚽';
    if (logo) {
      const src = 'assets/logos/' + logo;
      return `<span class="team-mark" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.82)}px"><img src="${src}" alt="" loading="lazy" onerror="this.parentElement.textContent='${f}'"></span>`;
    }
    return `<span class="team-mark" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.82)}px">${f}</span>`;
  }
  function enhanceSelect(select) {
    if (!select || select.dataset.ssEnhanced || select.closest('.ss-wrap')) return;
    select.dataset.ssEnhanced = '1';

    const wrap = document.createElement('div');
    wrap.className = 'ss-wrap ' + select.className;
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add('ss-native');
    select.tabIndex = -1;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'ss-trigger';
    if (select.hasAttribute('aria-label')) trigger.setAttribute('aria-label', select.getAttribute('aria-label'));
    wrap.appendChild(trigger);

    const isTeamSelect = select.id === 'home-team' || select.id === 'away-team';
    const panel = document.createElement('div');
    panel.className = 'ss-panel';
    panel.innerHTML = (isTeamSelect ? `<div class="ss-tabs">
        <button type="button" class="ss-tab active" data-cat="all">All</button>
        <button type="button" class="ss-tab" data-cat="National Teams">National</button>
        <button type="button" class="ss-tab" data-cat="Club Teams">Clubs</button>
      </div>` : '') +
      `<div class="ss-search-wrap"><input type="text" class="ss-search" placeholder="Search…" autocomplete="off" spellcheck="false"></div>
      <div class="ss-options" role="listbox"></div>`;
    wrap.appendChild(panel);

    const searchInput = panel.querySelector('.ss-search');
    const optionsEl = panel.querySelector('.ss-options');
    let activeCat = 'all';

    function updateTrigger() {
      const opt = select.options[select.selectedIndex];
      trigger.textContent = opt ? opt.textContent : 'Select…';
    }

    function renderOptions() {
      const q = (searchInput.value || '').trim().toLowerCase();
      let items = collectOptions(select);
      if (isTeamSelect && activeCat !== 'all') items = items.filter(i => i.group === activeCat);
      if (q) items = items.filter(i => i.label.toLowerCase().includes(q));
      if (!items.length) { optionsEl.innerHTML = '<div class="ss-empty">No matches</div>'; return; }
      let html = '';
      let lastGroup;
      items.forEach(i => {
        if (i.group !== lastGroup) {
          if (i.group && (!isTeamSelect || activeCat === 'all')) html += `<div class="ss-group-label">${i.group}</div>`;
          lastGroup = i.group;
        }
        const sel = i.value === select.value ? ' selected' : '';
        // Team dropdowns show the club/country logo (falling back to the
        // flag emoji when no logo is set — same behavior as everywhere
        // else in the app, via teamMark()) instead of just the flag
        // character baked into the plain option text.
        const rowLabel = isTeamSelect
          ? `${ssTeamMark(i.logo, i.flag, 18)} <span>${i.name || i.label}</span>`
          : i.label;
        html += `<div class="ss-option${sel}" data-value="${String(i.value).replace(/"/g, '&quot;')}" role="option">${rowLabel}</div>`;
      });
      optionsEl.innerHTML = html;
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !wrap.classList.contains('open');
      closeAllPanels(wrap);
      wrap.classList.toggle('open', willOpen);
      if (willOpen) {
        searchInput.value = '';
        renderOptions();
        setTimeout(() => searchInput.focus(), 0);
      }
    });

    searchInput.addEventListener('input', renderOptions);
    panel.addEventListener('click', (e) => e.stopPropagation());

    if (isTeamSelect) {
      panel.querySelectorAll('.ss-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          panel.querySelectorAll('.ss-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          activeCat = tab.dataset.cat;
          renderOptions();
        });
      });
    }

    optionsEl.addEventListener('click', (e) => {
      const opt = e.target.closest('.ss-option');
      if (!opt) return;
      select.value = opt.dataset.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      wrap.classList.remove('open');
    });

    // Keep the trigger label in sync even when code sets select.value
    // programmatically (no native 'change' event fires in that case).
    const proto = window.HTMLSelectElement && HTMLSelectElement.prototype;
    const desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.configurable) {
      Object.defineProperty(select, 'value', {
        get() { return desc.get.call(select); },
        set(v) { desc.set.call(select, v); updateTrigger(); },
        configurable: true
      });
    }

    // Options list changes (e.g. formation <select> rebuilt) — refresh label/list.
    new MutationObserver(() => { updateTrigger(); if (wrap.classList.contains('open')) renderOptions(); })
      .observe(select, { childList: true });

    updateTrigger();
  }
/*@CHUNK:c0603:END*/

/*@CHUNK:c0604:START*/

  document.addEventListener('click', () => closeAllPanels(null));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllPanels(null); });

/*@CHUNK:c0604:END*/

/*@CHUNK:c0605:START*/
  function scanAndEnhance(root) {
    (root || document).querySelectorAll('select').forEach(enhanceSelect);
  }
/*@CHUNK:c0605:END*/

/*@CHUNK:c0606:START*/

  document.addEventListener('DOMContentLoaded', () => scanAndEnhance(document));
  if (document.readyState !== 'loading') scanAndEnhance(document);

  // Catch selects created later (formation pickers, live tactics selects, etc.)
  new MutationObserver((mutations) => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'SELECT') enhanceSelect(node);
        else if (node.querySelectorAll) scanAndEnhance(node);
      });
    });
  }).observe(document.body || document.documentElement, { childList: true, subtree: true });
})();

// ========== SCROLL TO TOP / BOTTOM ==========
(function () {
/*@CHUNK:c0606:END*/

/*@CHUNK:c0607:START*/
  function init() {
    const group = document.getElementById('scroll-fab-group');
    const topBtn = document.getElementById('scroll-fab-top');
    const bottomBtn = document.getElementById('scroll-fab-bottom');
    if (!group || !topBtn || !bottomBtn) return;

    function toggleVisibility() {
      const scrollable = document.documentElement.scrollHeight > window.innerHeight + 200;
      group.classList.toggle('show', scrollable);
      const nearTop = window.scrollY < 200;
      const nearBottom = window.scrollY + window.innerHeight > document.documentElement.scrollHeight - 200;
      topBtn.classList.toggle('disabled', nearTop);
      bottomBtn.classList.toggle('disabled', nearBottom);
    }

    topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    bottomBtn.addEventListener('click', () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
    window.addEventListener('scroll', toggleVisibility, { passive: true });
    window.addEventListener('resize', toggleVisibility);
    new MutationObserver(toggleVisibility).observe(document.body, { childList: true, subtree: true });
    toggleVisibility();
  }
/*@CHUNK:c0607:END*/
