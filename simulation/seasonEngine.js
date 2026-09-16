/*@CHUNK:c0306:START*/

  // ========== TROPHY CASE (team trophies + individual awards) ==========
  // Every entry uses `name` to key into trophies.json (via trophyMark()) so
  // it always renders with a real trophy/medal image. Individual awards also
  // set `player` — that's what powers the Teams-tab trophy cabinet and the
  // History tab's "Individual Awards" list.
/*@CHUNK:c0306:END*/

/*@CHUNK:c0307:START*/
  function saveTrophiesToStorage() {
    try { return safeSetItem('apexTrophies', JSON.stringify(trophies)); } catch (e) { return false; }
  }
/*@CHUNK:c0307:END*/

/*@CHUNK:c0308:START*/
  function pushTeamTrophy(name, teamName, type, extra) {
    const t = Object.assign({ name, team: teamName, type, date: Date.now() }, extra || {});
    trophies.push(t);
    saveTrophiesToStorage();
    return t;
  }
/*@CHUNK:c0308:END*/

/*@CHUNK:c0309:START*/
  function pushIndividualTrophy(awardName, playerObj, type, extra) {
    if (!playerObj || !playerObj.name) return null;
    const t = Object.assign({ name: awardName, team: playerObj.team || '', player: playerObj.name, type, date: Date.now() }, extra || {});
    trophies.push(t);
    saveTrophiesToStorage();
    return t;
  }
/*@CHUNK:c0309:END*/

/*@CHUNK:c0310:START*/
  // Manager awards live alongside individual player awards in the trophy
  // case, but key off `manager` (a name) instead of `player` — awarded
  // whenever their team lifts a trophy (league title, UCL, or a standalone
  // World Cup/Champions League run), crediting the manager for that
  // team's success. Shows in Awards > Manager and History > Individual.
/*@CHUNK:c0310:END*/

/*@CHUNK:c0311:START*/
  function pushManagerAward(awardName, team, type, extra) {
    if (!team || !team.manager || !team.manager.name) return null;
    const t = Object.assign({ name: awardName, team: team.name, manager: team.manager.name, type, date: Date.now() }, extra || {});
    trophies.push(t);
    saveTrophiesToStorage();
    return t;
  }
/*@CHUNK:c0311:END*/

/*@CHUNK:c0312:START*/
  // Records the individual awards computed for a tournament/competition's
  // `.awards` object (already produced by assignTournamentAwards() /
  // assignCompAwards()) into the trophy case, one entry per winner.
/*@CHUNK:c0312:END*/

/*@CHUNK:c0313:START*/
  function recordIndividualAwardsFromAwardsObject(awardsObj, type, extra) {
    if (!awardsObj) return;
    const map = [
      ['goldenBoot', 'Golden Boot'], ['goldenBall', 'Golden Ball'], ['goldenGlove', 'Golden Glove'],
      ['goldenClean', 'Clean Sheet King'], ['topAssists', 'Top Assists'], ['mostMotm', 'Most MOTM'],
      ['bestAvgRating', 'Best Avg Rating']
    ];
    map.forEach(([key, awardName]) => {
      if (awardsObj[key]) pushIndividualTrophy(awardName, awardsObj[key], type, extra);
    });
  }
/*@CHUNK:c0313:END*/

/*@CHUNK:c0314:START*/

  // Ballon d'Or ranking algorithm, shared by the interactive Awards > Ballon
  // d'Or tab and the automatic season-end archiving — kept in one place so
  // both always agree on who the leader is. Pass in a `stats`-shaped object
  // (global `stats`, a competition's `comp.stats`, etc).
  const BALLON_MIN_APPS = 3;
/*@CHUNK:c0314:END*/

/*@CHUNK:c0315:START*/

  // Holistic "best player" scoring shared by the Ballon d'Or ranking (season/
  // global `stats`) and the tournament Golden Ball (`tournamentStats`) — a
  // real MVP vote isn't just "who scored/rated highest", it weighs where
  // those numbers came from. Folds in:
  //  - individual statistics: raw production (goals/assists/MOTM/saves/
  //    clean sheets/Puskas contenders) plus overall match rating quality.
  //  - domestic performance: rating quality sustained across a league campaign.
  //  - continental performance: the season's Champions League run (or a
  //    standalone Champions League tournament), weighted above domestic
  //    since continental football carries more real-world Ballon d'Or weight.
  //  - international performance: a World Cup run, weighted highest of all —
  //    a big international tournament moves the needle more than a single
  //    club season ever does.
  //  - trophies: lifting a league title, continental trophy, or international
  //    trophy with the squad that season, plus a small nod to past individual
  //    silverware (established quality/reputation).
  //  - consistency: low match-to-match rating variance at a genuinely good
  //    level, not just one or two standout performances propping up an average.
  //  - big games: how a player performed specifically in knockout-stage/final
  //    fixtures and clashes against other top sides, not just accumulated bulk.
  function computeContextualPlayerScores(baseStats, minApps) {
    const src = baseStats || stats;
    const MIN_APPS = minApps || BALLON_MIN_APPS;
    const scores = {};
    const ensure = (p) => {
      if (!scores[p.id]) scores[p.id] = { id: p.id, name: p.name, team: p.team, pts: 0, goals: 0, assists: 0, motm: 0, avg: 0, apps: 0, noms: 0, trophyPts: 0, consistency: 0, bigGamePts: 0 };
      return scores[p.id];
    };

    // ---- Individual statistics ----
    Object.values(src.ratings || {}).forEach(p => {
      const e = ensure(p);
      e.apps = p.count || 0;
      e.avg = p.avg || 0;
    });
    Object.values(src.goals || {}).forEach(p => { const e = ensure(p); e.goals = p.count; e.pts += p.count * 3.2; });
    Object.values(src.assists || {}).forEach(p => { const e = ensure(p); e.assists = p.count; e.pts += p.count * 2.1; });
    Object.values(src.motm || {}).forEach(p => { const e = ensure(p); e.motm = p.count; e.pts += p.count * 3.6; });
    Object.values(src.saves || {}).forEach(p => { const e = ensure(p); e.pts += p.count * 0.3; });
    Object.values(src.cleanSheets || {}).forEach(p => { const e = ensure(p); e.pts += p.count * 1.6; });
    Object.values(src.puskas || {}).forEach(p => { const e = ensure(p); e.pts += p.count * 1.2; });
    Object.values(scores).forEach(e => {
      if (e.apps >= MIN_APPS && e.avg > 0) e.pts += e.avg * Math.min(e.apps, 15) * 0.65;
      else if (e.apps > 0 && e.apps < MIN_APPS) e.pts += e.avg * 0.12;
    });

    // ---- Domestic performance (league campaign quality) ----
    if (season && Array.isArray(season.leagues)) {
      season.leagues.forEach(lg => {
        if (!lg.stats) return;
        Object.values(lg.stats.ratings || {}).forEach(p => {
          const e = ensure(p);
          if (p.count >= 3 && p.avg > 0) e.pts += p.avg * Math.min(p.count, 20) * 0.35;
        });
        Object.values(lg.stats.goals || {}).forEach(p => { const e = ensure(p); e.pts += p.count * 0.6; });
        Object.values(lg.stats.assists || {}).forEach(p => { const e = ensure(p); e.pts += p.count * 0.4; });
      });
    }

    // ---- Continental performance (season UCL run, or a standalone UCL tournament) ----
    if (season && season.ucl && season.ucl.stats) {
      Object.values(season.ucl.stats.ratings || {}).forEach(p => {
        const e = ensure(p);
        if (p.count >= 2 && p.avg > 0) e.pts += p.avg * Math.min(p.count, 13) * 0.55;
      });
      Object.values(season.ucl.stats.goals || {}).forEach(p => { const e = ensure(p); e.pts += p.count * 1.3; });
      Object.values(season.ucl.stats.assists || {}).forEach(p => { const e = ensure(p); e.pts += p.count * 0.9; });
    }
    if (tournament && tournament.type === 'ucl' && tournamentStats && tournamentStats !== src) {
      Object.values(tournamentStats.ratings || {}).forEach(p => {
        const e = ensure(p);
        if (p.count >= 2 && p.avg > 0) e.pts += p.avg * Math.min(p.count, 13) * 0.55;
      });
    }

    // ---- International performance (World Cup — highest single-tournament weight) ----
    if (tournament && tournament.type === 'worldcup' && tournamentStats) {
      Object.values(tournamentStats.ratings || {}).forEach(p => {
        const e = ensure(p);
        if (p.count >= 2 && p.avg > 0) e.pts += p.avg * Math.min(p.count, 7) * 0.9;
      });
      Object.values(tournamentStats.goals || {}).forEach(p => { const e = ensure(p); e.pts += p.count * 1.6; });
      Object.values(tournamentStats.assists || {}).forEach(p => { const e = ensure(p); e.pts += p.count * 1.1; });
    }

    // ---- Big games (knockout-stage/final fixtures and top-vs-top clashes) ----
    const bigGameSources = [
      src.bigGames,
      season && season.ucl && season.ucl.stats && season.ucl.stats.bigGames,
      tournamentStats && tournamentStats !== src && tournamentStats.bigGames
    ];
    bigGameSources.forEach(bg => {
      if (!bg) return;
      Object.values(bg).forEach(p => {
        const e = ensure(p);
        if (p.count > 0 && p.avg > 0) { e.pts += p.avg * Math.min(p.count, 10) * 0.5; e.bigGamePts = Math.round(e.bigGamePts + p.avg * Math.min(p.count, 10) * 0.5); }
      });
    });

    // ---- Trophies (team success this season/tournament + individual pedigree) ----
    Object.values(scores).forEach(e => {
      const aff = findPlayerTeams(e.id) || {};
      let trophyPts = 0;
      if (season && Array.isArray(season.leagues)) {
        season.leagues.forEach(lg => { if (lg.champion && aff.club === lg.champion.name) trophyPts += 3; });
        if (season.ucl && season.ucl.champion && aff.club === season.ucl.champion.name) trophyPts += 5;
      }
      if (tournament && tournament.champion) {
        if (tournament.type === 'worldcup' && aff.national === tournament.champion.name) trophyPts += 6;
        if (tournament.type === 'ucl' && aff.club === tournament.champion.name) trophyPts += 5;
      }
      const pastIndividual = (trophies || []).filter(t => t.player === e.name).length;
      trophyPts += Math.min(pastIndividual, 5) * 0.4;
      e.pts += trophyPts;
      e.trophyPts = Math.round(trophyPts * 10) / 10;
    });

    // ---- Consistency (steady quality across recent appearances, not one hot streak) ----
    Object.values(scores).forEach(e => {
      const rEntry = (src.ratings || {})[e.id];
      const recent = rEntry && rEntry.recent;
      if (recent && recent.length >= 5) {
        const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
        const variance = recent.reduce((a, b) => a + (b - mean) * (b - mean), 0) / recent.length;
        const stdev = Math.sqrt(variance);
        const consistencyBonus = mean >= 6.3 ? Math.max(0, 2.4 - stdev) * 1.1 : 0;
        e.pts += consistencyBonus;
        e.consistency = Math.round(consistencyBonus * 10) / 10;
      }
    });

    // ---- Award-show nomination bonus: a genuine contender shows up across ----
    // ---- multiple individual categories, not just one ----
    const awardLeaders = {
      goldenboot: new Set(Object.values(src.goals || {}).sort((a,b)=>b.count-a.count).slice(0,50).map(p=>p.id)),
      assists: new Set(Object.values(src.assists || {}).sort((a,b)=>b.count-a.count).slice(0,50).map(p=>p.id)),
      motm: new Set(Object.values(src.motm || {}).sort((a,b)=>b.count-a.count).slice(0,50).map(p=>p.id)),
      yashin: new Set(Object.values(src.saves || {}).sort((a,b)=>b.count-a.count).slice(0,50).map(p=>p.id)),
      puskas: new Set(Object.values(src.puskas || {}).sort((a,b)=>b.count-a.count).slice(0,50).map(p=>p.id))
    };
    Object.values(scores).forEach(e => {
      let noms = 0;
      Object.values(awardLeaders).forEach(set => { if (set.has(e.id)) noms++; });
      e.noms = noms;
      if (noms >= 2) e.pts += (noms - 1) * 1.2;
    });

    return scores;
  }
/*@CHUNK:c0315:END*/

/*@CHUNK:c0315b:START*/
  function computeBallonRanking(statsSource) {
    const src = statsSource || stats;
    const MIN_APPS = BALLON_MIN_APPS;
    const scores = computeContextualPlayerScores(src, MIN_APPS);
    return Object.values(scores)
      .filter(p => p.pts > 0 && (p.apps >= MIN_APPS || p.goals + p.assists + p.motm >= 3))
      .sort((a,b) => b.pts - a.pts || b.apps - a.apps)
      .slice(0, 50);
  }
/*@CHUNK:c0315b:END*/

/*@CHUNK:c0316:START*/

  // Snapshots the current global leaderboard leaders (Golden Boot, Ballon
  // d'Or, Golden Glove/Yashin, Top Assists, Most MOTM) into the trophy case
  // as individual awards for the season that just ended, then wipes `stats`
  // and `tournamentStats` so the new season's leaderboard & Awards tab start
  // from zero. Team trophies (league/UCL winners) are left untouched — the
  // trophy case is a permanent record, only the live leaderboard resets.
/*@CHUNK:c0316:END*/

/*@CHUNK:c0317:START*/
  function archiveAndResetGlobalAwards(year) {
    const extra = { category: 'season-global', year };
    const type = 'Season Y' + year + ' (Global)';
    const topOf = (key) => Object.values(stats[key] || {}).sort((a,b) => b.count - a.count)[0] || null;
    pushIndividualTrophy('Golden Boot', topOf('goals'), type, extra);
    pushIndividualTrophy('Top Assists', topOf('assists'), type, extra);
    pushIndividualTrophy('Most MOTM', topOf('motm'), type, extra);
    pushIndividualTrophy('Golden Glove', topOf('saves'), type, extra);
    pushIndividualTrophy('Clean Sheet King', topOf('cleanSheets'), type, extra);
    const ballon = computeBallonRanking(stats)[0] || null;
    pushIndividualTrophy("Ballon d'Or", ballon, type, extra);
    stats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, cards: {}, motm: {}, puskas: {}, ratings: {}, interceptions: {}, tackles: {}, bigGames: {} };
    // Only clear tournamentStats if there's no standalone Tournament (World
    // Cup/UCL, separate from the Season Calendar) currently in progress —
    // otherwise this would wipe that tournament's own live leaderboard mid-run.
    if (!tournament || tournament.champion) {
      tournamentStats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, motm: {}, ratings: {}, puskas: {}, interceptions: {}, tackles: {}, bigGames: {} };
    }
    saveStats();
  }
/*@CHUNK:c0317:END*/

/*@CHUNK:c0318:START*/

  // Called after every season-mutating sim step. Fires exactly once, right
  // when a season's last matchday completes (all leagues + the Champions
  // League finished) — archives that season's individual award winners and
  // resets the global leaderboard/Awards tab for the new season ahead.
/*@CHUNK:c0318:END*/

/*@CHUNK:c0319:START*/
  function finalizeSeasonIfComplete() {
    if (!season || season.archived) return;
    if (!seasonIsComplete()) return;
    season.archived = true;
    season.completedAt = Date.now();
    archiveAndResetGlobalAwards(season.year);
    toast('Season ' + season.year + ' complete! Awards & leaderboard archived to History and reset.');
  }
/*@CHUNK:c0319:END*/

/*@CHUNK:c0320:START*/

  // True once we've warned the person this session that browser storage is
  // full — avoids re-toasting every 4s from the autosave interval below.
  let _storageQuotaWarned = false;
/*@CHUNK:c0320:END*/

/*@CHUNK:c0321:START*/
  function isQuotaError(e) {
    return !!e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014 ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED');
  }
/*@CHUNK:c0321:END*/

/*@CHUNK:c0322:START*/
  // Wraps localStorage.setItem so a full-storage failure is surfaced to the
  // person (once per session) instead of vanishing into an empty catch.
  // Silently swallowing a failed write here is exactly how a browser save
  // could quietly stop matching the matches actually played — the write
  // looks like it happened (no error shown) but the old, smaller value is
  // still sitting in localStorage. Returns true on success, false on failure.
/*@CHUNK:c0322:END*/

/*@CHUNK:c0323:START*/
  function safeSetItem(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      if (isQuotaError(e) && !_storageQuotaWarned) {
        _storageQuotaWarned = true;
        toast('Browser storage is full — use Export Save now to back up your progress to a file');
      }
      return false;
    }
  }
/*@CHUNK:c0323:END*/

/*@CHUNK:c0324:START*/

/*@CHUNK:c0324:END*/

/*@CHUNK:c0325:START*/
  function saveStats() {
    let ok = true;
    try {
      ok = safeSetItem('apexSimStats', JSON.stringify(stats)) && ok;
      ok = safeSetItem('apexInjuryBook', JSON.stringify(injuryBook)) && ok;
      ok = safeSetItem('apexSuspensionBook', JSON.stringify(suspensionBook)) && ok;
      ok = safeSetItem('apexMatchDay', String(globalMatchDay)) && ok;
      ok = safeSetItem('apexPlayerMatchLog', JSON.stringify(playerMatchLog)) && ok;
      ok = safeSetItem('apexTeamMatchLog', JSON.stringify(teamMatchLog)) && ok;
    } catch(e) { ok = false; }
    return ok;
  }
/*@CHUNK:c0325:END*/

/*@CHUNK:c0326:START*/
  function loadStats() {
    try {
      const s = localStorage.getItem('apexSimStats');
      if (s) stats = JSON.parse(s);
      if (!stats.ratings) stats.ratings = {};
      const t = localStorage.getItem('apexTrophies');
      if (t) trophies = JSON.parse(t);
      const ib = localStorage.getItem('apexInjuryBook');
      if (ib) injuryBook = JSON.parse(ib);
      const sb = localStorage.getItem('apexSuspensionBook');
      if (sb) suspensionBook = JSON.parse(sb);
      const md = localStorage.getItem('apexMatchDay');
      if (md) globalMatchDay = parseInt(md, 10) || 1;
      const pml = localStorage.getItem('apexPlayerMatchLog');
      if (pml) playerMatchLog = JSON.parse(pml);
      const tml = localStorage.getItem('apexTeamMatchLog');
      if (tml) teamMatchLog = JSON.parse(tml);
    } catch(e) {}
  }
/*@CHUNK:c0326:END*/

/*@CHUNK:c0327:START*/

  // ========== FULL PROGRESS PERSISTENCE (survive a page refresh) ==========
  // Stats/trophies/injury/suspension books are already saved above. This
  // additionally persists the in-progress Season Calendar and standalone
  // Tournament (World Cup / Champions League) state — plus a couple of small
  // UI bits (which nav tab and which season sub-tab were open) — so a
  // refresh (or reopening the app later) drops the person back exactly
  // where they left off instead of wiping their run.
/*@CHUNK:c0327:END*/

/*@CHUNK:c0328:START*/
  function persistAll() {
    let ok = true;
    try {
      if (season) ok = safeSetItem('apexSeason', JSON.stringify(season)) && ok;
      else localStorage.removeItem('apexSeason');
      if (tournament) ok = safeSetItem('apexTournament', JSON.stringify(tournament)) && ok;
      else localStorage.removeItem('apexTournament');
      ok = safeSetItem('apexTournamentType', tournamentType) && ok;
      ok = safeSetItem('apexTournamentStats', JSON.stringify(tournamentStats)) && ok;
      ok = safeSetItem('apexSeasonActiveTab', seasonActiveTab) && ok;
      ok = safeSetItem('apexSeasonActiveSubTab', seasonActiveSubTab) && ok;
      ok = persistPlayerForms() && ok;
      const activeTab = document.querySelector('.nav-tab.active');
      if (activeTab && activeTab.dataset.view) safeSetItem('apexActiveView', activeTab.dataset.view);
    } catch (e) { ok = false; }
    return ok;
  }
/*@CHUNK:c0328:END*/

/*@CHUNK:c0329:START*/

/*@CHUNK:c0329:END*/

/*@CHUNK:c0330:START*/
  function loadPersistedGameState() {
    try {
      const s = localStorage.getItem('apexSeason');
      if (s) season = JSON.parse(s);
    } catch (e) { season = null; }
    try {
      const t = localStorage.getItem('apexTournament');
      if (t) tournament = JSON.parse(t);
    } catch (e) { tournament = null; }
    try {
      const tt = localStorage.getItem('apexTournamentType');
      if (tt) tournamentType = tt;
    } catch (e) {}
    try {
      const ts = localStorage.getItem('apexTournamentStats');
      if (ts) tournamentStats = JSON.parse(ts);
    } catch (e) {}
    try {
      const sat = localStorage.getItem('apexSeasonActiveTab');
      if (sat) seasonActiveTab = sat;
      const sst = localStorage.getItem('apexSeasonActiveSubTab');
      if (sst) seasonActiveSubTab = sst;
    } catch (e) {}
  }
/*@CHUNK:c0330:END*/

/*@CHUNK:c0331:START*/

  // Re-hydrates the Tournament view's UI from a restored `tournament` object
  // (called once on load, before the person has clicked back into that tab)
  // so the setup/live panels and bracket are already correct whenever they do.
/*@CHUNK:c0331:END*/

/*@CHUNK:c0332:START*/
  function restoreTournamentUI() {
    if (!tournament) return;
    const setup = document.getElementById('tournament-setup');
    const live = document.getElementById('tournament-live');
    if (setup) setup.style.display = 'none';
    if (live) live.style.display = 'block';
    const cfg = TOURNAMENT_FORMATS[tournamentType] || TOURNAMENT_FORMATS.worldcup;
    const title = document.getElementById('tournament-title');
    const desc = document.getElementById('tournament-desc');
    if (title) title.textContent = cfg.name + ' Setup';
    if (desc) desc.textContent = cfg.desc;
    const select = document.getElementById('tour-format-select');
    if (select) select.value = tournamentType;
    try {
      if (tournament.format === 'league') { renderUCLLeague(); renderUCLFixtures(); }
      else { renderGroups(); }
      renderBracket();
      if (tournament.champion) renderTournamentPodium();
      renderTournamentLeaderboard();
    } catch (e) {}
  }
/*@CHUNK:c0332:END*/

/*@CHUNK:c0333:START*/

/*@CHUNK:c0333:END*/

/*@CHUNK:c0334:START*/
  function restoreSeasonUI() {
    if (!season) return;
    try { renderSeasonDashboard(); } catch (e) {}
    const setup = document.getElementById('season-setup');
    const dash = document.getElementById('season-dashboard');
    if (setup) setup.style.display = 'none';
    if (dash) dash.style.display = 'block';
  }
/*@CHUNK:c0334:END*/

/*@CHUNK:c0335:START*/

  // Belt-and-braces autosave: most mutating actions already call persistAll()
  // directly, but a periodic save plus a save right before the tab is hidden
  // or closed means nothing is ever more than a couple seconds from being
  // safely on disk, even from an edge case that isn't explicitly wired up.
/*@CHUNK:c0335:END*/

/*@CHUNK:c0336:START*/
  function setupAutoSave() {
    setInterval(persistAll, 4000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistAll(); });
    window.addEventListener('beforeunload', persistAll);
    window.addEventListener('pagehide', persistAll);
  }
/*@CHUNK:c0336:END*/

/*@CHUNK:c0337:START*/

  // Manual save, triggered by the header Save button. persistAll() already
  // runs constantly in the background (autosave, mutating actions, tab
  // hide/close), so this doesn't do anything those don't already cover —
  // it exists purely so the person can get an explicit, visible confirmation
  // that their progress is safely written to this browser's storage right now.
/*@CHUNK:c0337:END*/

/*@CHUNK:c0338:START*/
  function manualSave() {
    const okSeason = persistAll();
    const okStats = saveStats();
    const ok = okSeason && okStats;
    const btn = document.getElementById('manual-save-btn');
    if (btn) {
      const label = btn.querySelector('.save-btn-label');
      const prevLabel = label ? label.textContent : null;
      btn.classList.add('just-saved');
      if (label) label.textContent = ok ? 'Saved!' : 'Storage full!';
      setTimeout(() => {
        btn.classList.remove('just-saved');
        if (label && prevLabel !== null) label.textContent = prevLabel;
      }, 1200);
    }
    // safeSetItem() already toasts a one-time "storage is full" warning on
    // failure, so only toast the happy path here to avoid two conflicting
    // messages.
    if (ok) toast('Progress saved');
  }
/*@CHUNK:c0338:END*/

/*@CHUNK:c0339:START*/

  // ========== EXPORT / IMPORT SAVE FILE ==========
  // Every piece of persisted state this app writes is namespaced under a
  // localStorage key starting with "apex" (see resetLeaderboard() below,
  // which relies on the same fact). That makes a full, exact export/import
  // straightforward: grab every "apex*" key verbatim (already-serialized
  // JSON strings, numbers-as-strings, etc.) and write them back out exactly
  // as they were, rather than re-deriving anything from in-memory state.
  // This is what lets a save survive a browser switch or a full wipe/refresh.
  // Builds the export payload straight from the live in-memory game state
  // (season, tournament, stats, trophies, etc.) rather than reading it back
  // out of localStorage. This matters because localStorage writes can fail
  // silently under quota pressure (a long season's accumulated match
  // reports can get large) — if that happens, the localStorage copy can be
  // an older, smaller snapshot than what's actually on screen, and an
  // export built from localStorage would quietly ship that stale, earlier
  // point instead of the matches actually just played. Reading straight
  // from memory means the export always matches exactly what's currently
  // showing, independent of whether the last autosave tick succeeded.
/*@CHUNK:c0339:END*/

/*@CHUNK:c0340:START*/
  function collectExportData() {
    const data = {};
    // Start from whatever's already in localStorage, so any "apex*" key
    // this function doesn't special-case below (small UI/session bits)
    // still makes it into the export.
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('apex') === 0) data[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    // Now overwrite every key that has a live in-memory source of truth,
    // so these always reflect the exact current point — not a possibly
    // stale localStorage copy.
    try {
      if (season) data.apexSeason = JSON.stringify(season);
      else delete data.apexSeason;
      if (tournament) data.apexTournament = JSON.stringify(tournament);
      else delete data.apexTournament;
      data.apexTournamentType = tournamentType;
      data.apexTournamentStats = JSON.stringify(tournamentStats);
      data.apexSeasonActiveTab = seasonActiveTab;
      data.apexSeasonActiveSubTab = seasonActiveSubTab;
      data.apexSimStats = JSON.stringify(stats);
      data.apexTrophies = JSON.stringify(trophies);
      data.apexInjuryBook = JSON.stringify(injuryBook);
      data.apexSuspensionBook = JSON.stringify(suspensionBook);
      data.apexMatchDay = String(globalMatchDay);
      data.apexPlayerForms = JSON.stringify(collectPlayerFormsMap());
      data.apexPlayerMatchLog = JSON.stringify(playerMatchLog);
      data.apexTeamMatchLog = JSON.stringify(teamMatchLog);
    } catch (e) {}
    return data;
  }
/*@CHUNK:c0340:END*/

/*@CHUNK:c0341:START*/

/*@CHUNK:c0341:END*/

/*@CHUNK:c0342:START*/
  function exportSave() {
    try {
      // Best-effort: also try to flush to localStorage so autosave/reload
      // stay in sync. If this fails (e.g. storage is full), the export
      // below still succeeds and is still exact — it doesn't depend on
      // this write having worked.
      try { persistAll(); saveStats(); } catch (e) {}
      const data = collectExportData();
      if (!Object.keys(data).length) {
        toast('Nothing to export yet — play a bit first');
        return;
      }
      const payload = {
        app: 'apex-sim',
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        data
      };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = url;
      a.download = `apex-sim-save-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast('Save file exported');
    } catch (e) {
      console.error('Export failed', e);
      toast('Export failed — see console for details');
    }
  }
/*@CHUNK:c0342:END*/

/*@CHUNK:c0343:START*/

/*@CHUNK:c0343:END*/

/*@CHUNK:c0344:START*/
  function triggerImportSave() {
    const input = document.getElementById('import-save-input');
    if (input) { input.value = ''; input.click(); }
  }
/*@CHUNK:c0344:END*/

/*@CHUNK:c0345:START*/

/*@CHUNK:c0345:END*/

/*@CHUNK:c0346:START*/
  function importSaveFile(event) {
    const input = event && event.target;
    const file = input && input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        const data = payload && payload.data && typeof payload.data === 'object' ? payload.data : null;
        const validKeys = data ? Object.keys(data).filter(k => k.indexOf('apex') === 0) : [];
        if (!data || !validKeys.length) {
          toast("That file doesn't look like an APEX SIM save");
          return;
        }
        if (!confirm('Import this save? This will REPLACE all current progress — leaderboard, trophies, history, active season, tournament, everything — with the contents of this file. This cannot be undone.')) {
          return;
        }
        // Clear every existing "apex*" key first so nothing from the
        // current save (e.g. a key this version writes that an older
        // export doesn't have) bleeds into the restored state.
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf('apex') === 0) keysToRemove.push(k);
        }
        keysToRemove.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
        // Track failures instead of swallowing them — a quota failure here
        // would otherwise reload the page into a save that's silently
        // missing the season/tournament progress the file actually had.
        // Write apexSeason/apexTournament FIRST — they're by far the
        // largest keys in a save (full league tables, fixtures, and match
        // reports), so if this browser's storage quota runs out partway
        // through, it should be a small, incidental key that fails to
        // restore — never the season or tournament progress itself, which
        // is exactly what was going missing before this ordering existed.
        const priorityKeys = ['apexSeason', 'apexTournament'];
        const orderedKeys = [
          ...priorityKeys.filter(k => validKeys.indexOf(k) !== -1),
          ...validKeys.filter(k => priorityKeys.indexOf(k) === -1)
        ];
        const failedKeys = [];
        orderedKeys.forEach(k => { if (!safeSetItem(k, data[k])) failedKeys.push(k); });
        if (failedKeys.length) {
          alert('Import partially failed — this browser\'s storage is full, so ' +
            failedKeys.length + ' item(s) from the file (' + failedKeys.join(', ') +
            ') could not be restored. Free up space (e.g. import in a different browser, ' +
            'or clear old site data) and try again.');
        }
        try { sessionStorage.setItem('apexJustImported', '1'); } catch (e) {}
        location.reload();
      } catch (err) {
        console.error('Import failed', err);
        toast('Import failed — file is not valid JSON');
      } finally {
        if (input) input.value = '';
      }
    };
    reader.onerror = () => { toast('Could not read that file'); if (input) input.value = ''; };
    reader.readAsText(file);
  }
/*@CHUNK:c0346:END*/

/*@CHUNK:c0415:START*/

/*@CHUNK:c0415:END*/

/*@CHUNK:c0416:START*/
  function getRoundName(teamCount) {
    // teamCount = number of teams still in the competition for this round
    if (teamCount >= 32) return 'Round of 32';
    if (teamCount >= 16) return 'Round of 16';
    if (teamCount >= 8) return 'Quarter-finals';
    if (teamCount >= 4) return 'Semi-finals';
    if (teamCount >= 2) return 'Final';
    return 'Knockout';
  }
/*@CHUNK:c0416:END*/

/*@CHUNK:c0493:START*/

  // Season Calendar only plays with the current 2026-27 squads — a club may have
  // other-season entries in teams.json (e.g. historical or future rosters) that
  // must never be selectable for leagues, whether auto-matched via leagues.json
  // or picked manually.
  const SEASON_YEAR_TAG = '2026-27';
/*@CHUNK:c0493:END*/

/*@CHUNK:c0494:START*/
  function isCurrentSeasonSquad(t) {
    return !!(t && t.name && t.name.indexOf(SEASON_YEAR_TAG) !== -1);
  }
/*@CHUNK:c0494:END*/

/*@CHUNK:c0495:START*/
  function seasonClubPool() {
    return (teamsData.club || []).filter(isCurrentSeasonSquad);
  }
/*@CHUNK:c0495:END*/

/*@CHUNK:c0496:START*/

  // leagues.json lists teams like "Real Madrid 2026-27" — strip the season
  // suffix so it can be matched against whatever team names teams.json uses.
/*@CHUNK:c0496:END*/

/*@CHUNK:c0497:START*/
  function normalizeLeagueName(s) {
    return (s || '').toLowerCase().replace(/\s*\d{4}-\d{2,4}\s*$/, '').trim();
  }
/*@CHUNK:c0497:END*/

/*@CHUNK:c0498:START*/

  // Resolves the club roster leagues.json defines for a given league name
  // (e.g. "La Liga") against the clubs actually present in teams.json.
  // Returns [] if leagues.json has no entry or none of its names match yet
  // (e.g. before teams.json has been filled in) — callers should fall back
  // to the full club pool in that case.
/*@CHUNK:c0498:END*/

/*@CHUNK:c0499:START*/
  function getLeagueTeamPool(leagueName) {
    const names = leaguesData[leagueName];
    if (!names || !names.length) return [];
    const pool = seasonClubPool();
    const matched = [];
    names.forEach(n => {
      const norm = normalizeLeagueName(n);
      let t = pool.find(x => (x.name || '').toLowerCase() === (n || '').toLowerCase());
      if (!t) t = pool.find(x => normalizeLeagueName(x.name) === norm);
      if (!t) t = pool.find(x => norm && (normalizeLeagueName(x.name).includes(norm) || norm.includes(normalizeLeagueName(x.name))));
      if (t && !matched.includes(t)) matched.push(t);
    });
    return matched;
  }
/*@CHUNK:c0499:END*/

/*@CHUNK:c0510:START*/

  // ---------- scheduling helpers ----------
/*@CHUNK:c0510:END*/

/*@CHUNK:c0511:START*/
  function circleMethodRounds(teamIds) {
    let ids = teamIds.slice();
    if (ids.length % 2 !== 0) ids.push(null);
    const n = ids.length;
    const rounds = [];
    let arr = ids.slice();
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i], b = arr[n - 1 - i];
        if (a != null && b != null) pairs.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
      }
      rounds.push(pairs);
      const fixed = arr[0];
      const rest = arr.slice(1);
      rest.unshift(rest.pop());
      arr = [fixed, ...rest];
    }
    return rounds;
  }
/*@CHUNK:c0511:END*/

/*@CHUNK:c0512:START*/

/*@CHUNK:c0512:END*/

/*@CHUNK:c0513:START*/
  function buildDoubleRoundRobinRounds(teams) {
    const ids = teams.map(t => t.id);
    if (ids.length < 2) return [];
    const firstLeg = circleMethodRounds(ids);
    const secondLeg = firstLeg.map(round => round.map(([a, b]) => [b, a]));
    return [...firstLeg, ...secondLeg].map(pairs => pairs.map(([home, away]) => ({
      home, away, played: false, homeScore: null, awayScore: null, report: null
    })));
  }
/*@CHUNK:c0513:END*/

/*@CHUNK:c0514:START*/

/*@CHUNK:c0514:END*/

/*@CHUNK:c0515:START*/
  function blankSeasonRow(team) {
    return { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 };
  }
/*@CHUNK:c0515:END*/

/*@CHUNK:c0516:START*/

/*@CHUNK:c0516:END*/

/*@CHUNK:c0517:START*/
  function applyResultToTable(table, homeId, awayId, hg, ag) {
    const ht = table.find(r => r.team.id === homeId);
    const at = table.find(r => r.team.id === awayId);
    if (!ht || !at) return;
    ht.played++; at.played++;
    ht.gf += hg; ht.ga += ag; at.gf += ag; at.ga += hg;
    if (hg > ag) { ht.won++; ht.pts += 3; at.lost++; }
    else if (ag > hg) { at.won++; at.pts += 3; ht.lost++; }
    else { ht.drawn++; at.drawn++; ht.pts++; at.pts++; }
  }
/*@CHUNK:c0517:END*/

/*@CHUNK:c0518:START*/

/*@CHUNK:c0518:END*/

/*@CHUNK:c0519:START*/
  function sortedTable(table) {
    return [...table].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
  }
/*@CHUNK:c0519:END*/

/*@CHUNK:c0520:START*/

/*@CHUNK:c0520:END*/

/*@CHUNK:c0521:START*/
  function bracketSizeFor(n) {
    let size = 2;
    while (size * 2 <= n && size * 2 <= 8) size *= 2;
    return size;
  }
/*@CHUNK:c0521:END*/

/*@CHUNK:c0522:START*/

/*@CHUNK:c0522:END*/

/*@CHUNK:c0523:START*/
  function seedPairsForSize(size) {
    if (size === 8) return [[0, 7], [3, 4], [2, 5], [1, 6]];
    if (size === 4) return [[0, 3], [1, 2]];
    return [[0, 1]];
  }
/*@CHUNK:c0523:END*/

/*@CHUNK:c0524:START*/

/*@CHUNK:c0524:END*/

/*@CHUNK:c0525:START*/
  function winnerOfResult(homeTeam, awayTeam, result) {
    if (result.home > result.away) return homeTeam;
    if (result.away > result.home) return awayTeam;
    if (result.pens) return result.pens.home > result.pens.away ? homeTeam : awayTeam;
    return seededRandom() < 0.5 ? homeTeam : awayTeam;
  }
/*@CHUNK:c0525:END*/

/*@CHUNK:c0526:START*/

/*@CHUNK:c0526:END*/

/*@CHUNK:c0527:START*/
  function simulateRoundFixtures(round, opts, onResult) {
    (round || []).forEach(fx => {
      if (fx.played) return;
      const homeTeam = getTeam(fx.home), awayTeam = getTeam(fx.away);
      if (!homeTeam || !awayTeam) { fx.played = true; return; }
      const result = simQuickMatch(homeTeam, awayTeam, { countForLeaderboard: true, allowET: !!opts.allowET, allowPens: !!opts.allowPens });
      fx.played = true;
      fx.homeScore = result.home;
      fx.awayScore = result.away;
      fx.report = result.report;
      fx.pens = result.pens;
      if (onResult) onResult(fx, homeTeam, awayTeam, result);
    });
  }
/*@CHUNK:c0527:END*/

/*@CHUNK:c0528:START*/

/*@CHUNK:c0528:END*/

/*@CHUNK:c0529:START*/
  function buildKnockoutFixtures(teamsInSeed, pairsIdx) {
    return { fixtures: pairsIdx.map(([i, j]) => ({
      home: teamsInSeed[i].id, away: teamsInSeed[j].id, played: false, homeScore: null, awayScore: null, report: null, winnerId: null
    })), played: false };
  }
/*@CHUNK:c0529:END*/

/*@CHUNK:c0530:START*/

/*@CHUNK:c0530:END*/

/*@CHUNK:c0531:START*/
  function buildKnockoutFromWinners(winners) {
    const fixtures = [];
    for (let i = 0; i < winners.length; i += 2) {
      const swap = seededRandom() < 0.5;
      const h = swap ? winners[i] : winners[i + 1];
      const a = swap ? winners[i + 1] : winners[i];
      fixtures.push({ home: h.id, away: a.id, played: false, homeScore: null, awayScore: null, report: null, winnerId: null });
    }
    return { fixtures, played: false };
  }
/*@CHUNK:c0531:END*/

/*@CHUNK:c0532:START*/

  // ---------- Champions League qualification ----------
  // Year 1: no table exists yet, so seed qualifiers by squad strength (like
  // a pre-season club-strength ranking). Every later year uses the actual
  // final league standings (real-life style: table-toppers qualify).
/*@CHUNK:c0532:END*/

/*@CHUNK:c0533:START*/
  function computeInitialUCLQualifiers(leagueTeams) {
    const qualifiers = [];
    SEASON_LEAGUE_DEFS.forEach(def => {
      const ranked = [...(leagueTeams[def.key] || [])].sort((a, b) => teamAvgOvr(b) - teamAvgOvr(a));
      ranked.slice(0, UCL_QUALIFY_PER_LEAGUE).forEach(t => qualifiers.push(t));
    });
    return qualifiers;
  }
/*@CHUNK:c0533:END*/

/*@CHUNK:c0534:START*/

/*@CHUNK:c0534:END*/

/*@CHUNK:c0535:START*/
  function computeUCLQualifiersFromStandings() {
    const qualifiers = [];
    SEASON_LEAGUE_DEFS.forEach(def => {
      const comp = season.leagues[def.key];
      if (!comp) return;
      const standings = sortedTable(comp.table).map(r => r.team);
      standings.slice(0, UCL_QUALIFY_PER_LEAGUE).forEach(t => qualifiers.push(t));
    });
    return qualifiers;
  }
/*@CHUNK:c0535:END*/

/*@CHUNK:c0536:START*/

  // ---------- starting a season ----------
/*@CHUNK:c0536:END*/

/*@CHUNK:c0537:START*/
  function startSeason() {
    const leagueTeams = {};
    let msg = '';
    for (const def of SEASON_LEAGUE_DEFS) {
      const ids = [...seasonSetup.selections[def.key]];
      if (ids.length < 4) msg += `${def.name} needs at least 4 clubs (has ${ids.length}). `;
      leagueTeams[def.key] = ids.map(id => getTeam(id)).filter(Boolean);
    }
    const el = document.getElementById('season-setup-msg');
    if (msg) { if (el) el.textContent = msg; toast('Fix the leagues highlighted below'); return; }
    if (el) el.textContent = '';

    const leagues = {};
    SEASON_LEAGUE_DEFS.forEach(def => {
      const teams = leagueTeams[def.key];
      leagues[def.key] = {
        key: def.key, name: def.name, teams,
        table: teams.map(blankSeasonRow),
        rounds: buildDoubleRoundRobinRounds(teams),
        currentRound: 0,
        champion: null,
        finished: false,
        stats: blankCompStats()
      };
    });

    // Champions League candidates qualify automatically — top clubs from
    // each domestic league, not a manual pick.
    const uclTeams = computeInitialUCLQualifiers(leagueTeams);
    const matchesPerTeam = Math.max(2, Math.min(8, uclTeams.length - 1));
    const leagueFixtures = generateUCLLeagueFixtures(uclTeams, matchesPerTeam);
    const uclRounds = [];
    for (let r = 1; r <= matchesPerTeam; r++) uclRounds.push(leagueFixtures.filter(f => f.round === r));

    const ucl = {
      key: 'ucl', name: 'Champions League', teams: uclTeams,
      table: uclTeams.map(blankSeasonRow),
      rounds: uclRounds,
      currentRound: 0,
      matchesPerTeam,
      stage: 'league',
      bracketSize: null,
      knockout: { qf: null, sf: null, final: null },
      champion: null,
      finished: false,
      stats: blankCompStats()
    };

    season = { year: 1, week: 0, daySlot: 0, leagues, ucl };
    seasonActiveTab = 'epl';
    seasonActiveSubTab = 'table';
    renderSeasonDashboard();
    const setup = document.getElementById('season-setup');
    const dash = document.getElementById('season-dashboard');
    if (setup) setup.style.display = 'none';
    if (dash) dash.style.display = 'block';
    toast('Season started — good luck!');
    persistAll();
  }
/*@CHUNK:c0537:END*/

/*@CHUNK:c0538:START*/

/*@CHUNK:c0538:END*/

/*@CHUNK:c0539:START*/
  function crownLeagueChampion(comp) {
    const standings = sortedTable(comp.table);
    comp.champion = standings[0] ? standings[0].team : null;
    if (comp.champion) {
      const year = season ? season.year : 1;
      const extra = { category: 'season', year };
      pushTeamTrophy(comp.name, comp.champion.name, 'League (Y' + year + ')', extra);
      pushManagerAward(comp.name + ' Manager of the Season', comp.champion, 'League (Y' + year + ')', extra);
      recordIndividualAwardsFromAwardsObject(assignCompAwards(comp), comp.name + ' (Y' + year + ')', extra);
    }
  }
/*@CHUNK:c0539:END*/

/*@CHUNK:c0540:START*/

/*@CHUNK:c0540:END*/

/*@CHUNK:c0541:START*/
  function simulateLeagueRound(comp) {
    if (!comp || comp.finished) return;
    if (comp.currentRound >= comp.rounds.length) { comp.finished = true; crownLeagueChampion(comp); return; }
    if (!comp.stats) comp.stats = blankCompStats();
    currentSeasonComp = comp;
    simulateRoundFixtures(comp.rounds[comp.currentRound], { allowET: false, allowPens: false }, (fx, h, a, result) => {
      applyResultToTable(comp.table, fx.home, fx.away, result.home, result.away);
    });
    currentSeasonComp = null;
    comp.currentRound++;
    if (comp.currentRound >= comp.rounds.length) { comp.finished = true; crownLeagueChampion(comp); }
  }
/*@CHUNK:c0541:END*/

/*@CHUNK:c0542:START*/

  // Builds the UCL knockout bracket from final league-phase standings.
  // Shared by the batch simulator (simulateUCLStep) and the per-fixture
  // live/instant path (advanceSeasonRoundIfComplete) so both routes into
  // the knockout stage behave identically.
/*@CHUNK:c0542:END*/

/*@CHUNK:c0543:START*/
  function buildUCLBracketFromLeagueTable(comp) {
    const size = bracketSizeFor(comp.teams.length);
    comp.bracketSize = size;
    const standings = sortedTable(comp.table).map(r => r.team);
    const qualifiers = standings.slice(0, size);
    const firstRound = buildKnockoutFixtures(qualifiers, seedPairsForSize(size));
    if (size <= 2) { comp.knockout.final = firstRound; comp.stage = 'final'; }
    else if (size === 4) { comp.knockout.sf = firstRound; comp.stage = 'sf'; }
    else { comp.knockout.qf = firstRound; comp.stage = 'qf'; }
  }
/*@CHUNK:c0543:END*/

/*@CHUNK:c0544:START*/

/*@CHUNK:c0544:END*/

/*@CHUNK:c0545:START*/
  function simulateUCLStep(comp) {
    if (!comp || comp.finished) return;
    if (!comp.stats) comp.stats = blankCompStats();
    currentSeasonComp = comp;
    if (comp.stage === 'league') {
      if (comp.currentRound >= comp.rounds.length) { comp.stage = 'transition'; }
      else {
        simulateRoundFixtures(comp.rounds[comp.currentRound], { allowET: false, allowPens: false }, (fx, h, a, result) => {
          applyResultToTable(comp.table, fx.home, fx.away, result.home, result.away);
        });
        comp.currentRound++;
      }
      if (comp.currentRound >= comp.rounds.length) buildUCLBracketFromLeagueTable(comp);
    } else if (comp.stage === 'qf') {
      simulateRoundFixtures(comp.knockout.qf.fixtures, { allowET: true, allowPens: true }, (fx, h, a, result) => {
        fx.winnerId = winnerOfResult(h, a, result).id;
      });
      comp.knockout.qf.played = true;
      const winners = comp.knockout.qf.fixtures.map(f => getTeam(f.winnerId));
      comp.knockout.sf = buildKnockoutFromWinners(winners);
      comp.stage = 'sf';
    } else if (comp.stage === 'sf') {
      simulateRoundFixtures(comp.knockout.sf.fixtures, { allowET: true, allowPens: true }, (fx, h, a, result) => {
        fx.winnerId = winnerOfResult(h, a, result).id;
      });
      comp.knockout.sf.played = true;
      const winners = comp.knockout.sf.fixtures.map(f => getTeam(f.winnerId));
      comp.knockout.final = buildKnockoutFromWinners(winners);
      comp.stage = 'final';
    } else if (comp.stage === 'final') {
      simulateRoundFixtures(comp.knockout.final.fixtures, { allowET: true, allowPens: true }, (fx, h, a, result) => {
        fx.winnerId = winnerOfResult(h, a, result).id;
      });
      comp.knockout.final.played = true;
      const champ = getTeam(comp.knockout.final.fixtures[0].winnerId);
      comp.champion = champ;
      comp.finished = true;
      if (champ) {
        const year = season ? season.year : 1;
        const extra = { category: 'season', year };
        pushTeamTrophy('Champions League', champ.name, 'Season (Y' + year + ')', extra);
        pushManagerAward('Champions League Winning Manager', champ, 'Season (Y' + year + ')', extra);
        recordIndividualAwardsFromAwardsObject(assignCompAwards(comp), 'Champions League (Y' + year + ')', extra);
      }
    }
    currentSeasonComp = null;
  }
/*@CHUNK:c0545:END*/

/*@CHUNK:c0546:START*/

  // Derives the season-wide "Matchday" counter from actual progress instead
  // of a manually-incremented counter, so it stays correct no matter which
  // route a fixture was played through (live, instant, or bulk simulate) —
  // this is what's shown as "Year N · Matchday W" in the season header.
  // Matchday W means "every domestic league AND the Champions League have
  // completed round W" (a finished competition, or the Champions League
  // once it has left its league phase for the knockout stage, is treated
  // as having completed all of its rounds) — so the counter only advances
  // once the slowest competition catches up. Previously this only looked
  // at the 5 domestic leagues, so the Matchday label could tick forward
  // even while the Champions League still had that matchday's fixtures
  // sitting unplayed — fixed by folding the UCL into the same calculation.
/*@CHUNK:c0546:END*/

/*@CHUNK:c0547:START*/
  function computeSeasonWeek(s) {
    if (!s || !s.leagues) return 0;
    // A finished competition's currentRound stops moving forever, and so
    // does the UCL's once it leaves its league phase for the knockout
    // bracket (progress from there is tracked via the bracket, not
    // currentRound) — neither should ever act as a floor on the
    // season-wide matchday count, or the very first competition to reach
    // either state permanently freezes every other competition that's
    // still progressing.
    const active = seasonCompEntries(s).filter(({ key, comp }) => {
      if (!comp || comp.finished) return false;
      if (key === 'ucl' && comp.stage !== 'league') return false;
      return true;
    });
    if (!active.length) {
      const finalRounds = seasonCompEntries(s).map(({ comp }) => comp ? comp.rounds.length : 0);
      return finalRounds.length ? Math.max(...finalRounds) : 0;
    }
    return Math.min(...active.map(({ comp }) => comp.currentRound));
  }
/*@CHUNK:c0547:END*/

/*@CHUNK:c0547b:START*/

  // ========== STRICT MATCHDAY GATING ==========
  // Every competition that makes up a season (the 5 domestic leagues plus
  // the Champions League) advances matchday-by-matchday in lockstep: none
  // of them may start playing their NEXT round's fixtures until every
  // competition has finished the CURRENT one. This is what makes "Matchday
  // W" a single, meaningful, season-wide number instead of each league
  // silently racing ahead at its own pace while the header still claims
  // an earlier, incomplete matchday.
  //
  // The Champions League knockout stage (quarterfinals onward) is the one
  // exception: those ties aren't part of the regular per-matchday cadence
  // (they're the season's coverage of one-off knockout weeks), so once the
  // UCL has left its league phase it's always treated as "due" rather than
  // being held back waiting on the domestic leagues.
  function seasonCompEntries(s) {
    s = s || season;
    if (!s || !s.leagues) return [];
    const entries = SEASON_LEAGUE_DEFS.map(def => ({ key: def.key, comp: s.leagues[def.key] }));
    entries.push({ key: 'ucl', comp: s.ucl });
    return entries;
  }
/*@CHUNK:c0547b:END*/

/*@CHUNK:c0547c:START*/
  // True once `comp` has nothing left to play for the CURRENT global
  // matchday (either finished outright, or — UCL knockout only — past the
  // point where "matchday number" applies at all).
  function seasonCompDoneWithMatchday(key, comp, targetIdx) {
    if (!comp || comp.finished) return true;
    if (key === 'ucl' && comp.stage !== 'league') return true;
    return comp.currentRound > targetIdx;
  }
/*@CHUNK:c0547c:END*/

/*@CHUNK:c0547d:START*/
  // Whether `comp` is allowed to simulate/play a fixture right now — false
  // if it has already completed the current global matchday and is simply
  // waiting on slower competitions to catch up before the day can turn over,
  // OR if today's fixture-congestion slot belongs to a different competition
  // (e.g. it's a UCL day, so the domestic leagues sit idle until the cycle
  // comes back round to them).
  function seasonCompCanPlayNow(key, comp) {
    if (!season || !comp || comp.finished) return false;
    if (key === 'ucl' && comp.stage !== 'league') return true;
    const slot = currentCongestionSlot();
    if (!seasonKeysForCongestionComp(slot.comp).includes(key)) return false;
    return comp.currentRound <= computeSeasonWeek(season);
  }

  // Human-readable reason a fixture can't be played right now, for the
  // toasts in simSeasonFixture/playSeasonFixture — distinguishes "it's not
  // this competition's day yet" from "the matchday itself isn't finished".
  function seasonBlockedFixtureMessage(compKey) {
    const slot = currentCongestionSlot();
    const eligible = seasonKeysForCongestionComp(slot.comp);
    if (!eligible.includes(compKey)) {
      return "It's " + slot.day + " — " + slot.comp + " fixtures only today. Simulate today's matches first to move on.";
    }
    const due = seasonMatchesDue();
    return 'Matchday ' + (computeSeasonWeek(season) + 1) + " isn't finished yet — " +
      due.length + (due.length === 1 ? ' match is' : ' matches are') + ' still due elsewhere first';
  }
/*@CHUNK:c0547d:END*/

/*@CHUNK:c0547e:START*/
  // Every still-unplayed fixture blocking the season from advancing past
  // its current matchday — i.e. every fixture, across every competition,
  // that belongs to the matchday the header is currently showing. Used to
  // tell the person exactly which matches are still due before the day
  // can change.
  function seasonMatchesDue() {
    if (!season) return [];
    const targetIdx = computeSeasonWeek(season);
    const due = [];
    seasonCompEntries().forEach(({ key, comp }) => {
      if (!comp || comp.finished) return;
      if (key === 'ucl' && comp.stage !== 'league') return;
      if (comp.currentRound !== targetIdx) return;
      const round = comp.rounds[comp.currentRound] || [];
      round.forEach(f => {
        if (f.played) return;
        const home = getTeam(f.home), away = getTeam(f.away);
        due.push({ compName: comp.name, compKey: key, home: home ? home.short : '?', away: away ? away.short : '?' });
      });
    });
    return due;
  }
/*@CHUNK:c0547e:END*/

/*@CHUNK:c0548:START*/

  // Advances a competition's matchday once every fixture in the current
  // round has been played (whether via live play, instant sim, or batch
  // simulation). Mirrors the round-increment logic that used to live only
  // inside simulateLeagueRound/simulateUCLStep.
/*@CHUNK:c0548:END*/

/*@CHUNK:c0549:START*/
  function advanceSeasonRoundIfComplete(comp, compKey) {
    if (!comp || !comp.rounds) return;
    const round = comp.rounds[comp.currentRound];
    if (!round || !round.length || !round.every(f => f.played)) return;
    comp.currentRound++;
    if (compKey === 'ucl') {
      if (comp.currentRound >= comp.rounds.length) buildUCLBracketFromLeagueTable(comp);
    } else if (comp.currentRound >= comp.rounds.length) {
      comp.finished = true;
      crownLeagueChampion(comp);
    }
    // Keep the season-wide Matchday counter in sync — this is the fix for
    // live/instant single-fixture play never advancing it (only the bulk
    // "Simulate Matchday" actions used to update it directly).
    if (season) { season.week = computeSeasonWeek(season); advanceCongestionSlotIfComplete(); }
    finalizeSeasonIfComplete();
  }
/*@CHUNK:c0549:END*/

/*@CHUNK:c0550:START*/

  // Simulates a single fixture from the current matchday instantly (no live
  // view), same as the "Instant" option tournaments already offer.
/*@CHUNK:c0550:END*/

/*@CHUNK:c0551:START*/
  function simSeasonFixture(compKey, idx) {
    if (!season) return;
    const comp = compKey === 'ucl' ? season.ucl : season.leagues[compKey];
    if (!comp || comp.finished) return;
    if (!seasonCompCanPlayNow(compKey, comp)) {
      toast(seasonBlockedFixtureMessage(compKey));
      return;
    }
    const round = comp.rounds[comp.currentRound];
    const f = round && round[idx];
    if (!f || f.played) return;
    const home = getTeam(f.home), away = getTeam(f.away);
    if (!home || !away) { f.played = true; return; }
    showLoading('Simulating match…');
    setTimeout(function() {
      try {
        if (!comp.stats) comp.stats = blankCompStats();
        currentSeasonComp = comp;
        const result = simQuickMatch(home, away, { countForLeaderboard: true, allowET: false, allowPens: false });
        currentSeasonComp = null;
        f.played = true; f.homeScore = result.home; f.awayScore = result.away; f.report = result.report; f.pens = result.pens;
        applyResultToTable(comp.table, f.home, f.away, result.home, result.away);
        advanceSeasonRoundIfComplete(comp, compKey);
        renderSeasonDashboard();
        persistAll();
      } finally { hideLoading(); }
    }, 30);
  }
/*@CHUNK:c0551:END*/

/*@CHUNK:c0552:START*/

  // Plays a single fixture from the current matchday live in the Match view —
  // same flow as playTournamentMatch/playUCLFixture, but writes the result
  // back into the season's league table instead of a tournament bracket.
/*@CHUNK:c0552:END*/

/*@CHUNK:c0553:START*/
  function playSeasonFixture(compKey, idx) {
    if (!season) return;
    const comp = compKey === 'ucl' ? season.ucl : season.leagues[compKey];
    if (!comp || comp.finished) return;
    if (!seasonCompCanPlayNow(compKey, comp)) {
      toast(seasonBlockedFixtureMessage(compKey));
      return;
    }
    const round = comp.rounds[comp.currentRound];
    const f = round && round[idx];
    if (!f || f.played) return;
    const home = getTeam(f.home), away = getTeam(f.away);
    if (!home || !away) return;
    window._seasonFixture = { compKey, idx };
    window._tourFixtureIdx = null;
    window._uclFixtureIdx = null;
    window._koRoundIdx = null;
    window._koMatchIdx = null;
    window._fromTournament = false;
    window._backTarget = 'season';
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
    if (!comp.stats) comp.stats = blankCompStats();
    currentSeasonComp = comp;
    startMatch();
    toast((comp.name || 'Season') + ' — live · formations randomized');
  }
/*@CHUNK:c0553:END*/

/*@CHUNK:c0554:START*/

/*@CHUNK:c0554:END*/

/*@CHUNK:c0555:START*/
  function seasonIsComplete() {
    if (!season) return true;
    return SEASON_LEAGUE_DEFS.every(def => season.leagues[def.key].finished) && season.ucl.finished;
  }
/*@CHUNK:c0555:END*/

/*@CHUNK:c0556:START*/

/*@CHUNK:c0556:END*/

/*@CHUNK:c0557:START*/
  function simulateSeasonWeek() {
    if (!season) return;
    withLoading('Simulating matchday…', function() {
      // Only simulate competitions that are actually still due for THIS
      // matchday — a competition that's already raced ahead (or, for the
      // UCL, moved into its knockout stage) is left alone so the day only
      // turns over once literally everything due has been played.
      const targetIdx = computeSeasonWeek(season);
      const eligibleKeys = new Set(seasonKeysForCongestionComp(currentCongestionSlot().comp));
      seasonCompEntries().forEach(({ key, comp }) => {
        if (!comp || comp.finished) return;
        // Knockout ties (QF/SF/Final) are one-off weeks outside the normal
        // matchday cadence and congestion cycle entirely, so they must be
        // checked — and simulated — before the matchday/congestion gates
        // below, not filtered out by them.
        if (key === 'ucl' && comp.stage !== 'league') { simulateUCLStep(comp); return; }
        if (seasonCompDoneWithMatchday(key, comp, targetIdx)) return;
        if (!eligibleKeys.has(key)) return; // not today's competition
        if (key === 'ucl') simulateUCLStep(comp); else simulateLeagueRound(comp);
      });
      season.week = computeSeasonWeek(season);
      advanceCongestionSlotIfComplete();
      finalizeSeasonIfComplete();
      renderSeasonDashboard();
      persistAll();
      saveStats();
    });
  }
/*@CHUNK:c0557:END*/

/*@CHUNK:c0558:START*/

/*@CHUNK:c0558:END*/

/*@CHUNK:c0559:START*/
  function simulateSeasonToEnd() {
    if (!season) return;
    // Rough denominator for the progress bar: the most matchdays any single
    // still-active competition has left. Not exact (competitions advance at
    // different rates and some weeks skip a competition entirely), but a
    // reasonable estimate that self-corrects as remaining rounds shrink.
    const estimatedWeeks = Math.max(1, ...seasonCompEntries()
      .map(({ comp }) => (comp && !comp.finished) ? Math.max(0, comp.rounds.length - comp.currentRound) : 0));
    withLoadingProgress('Simulating rest of season…', async function() {
      let safety = 0;
      const startTime = Date.now();
      // "Simulate to End" fast-forwards past the fixture-congestion cadence
      // on purpose — it's a bulk skip-ahead action, not a day-by-day play
      // session, so every competition due for the matchday plays regardless
      // of whose day it is in the congestion cycle.
      while (!seasonIsComplete() && safety < 1000) {
        const targetIdx = computeSeasonWeek(season);
        let playedSomething = false;
        seasonCompEntries().forEach(({ key, comp }) => {
          if (!comp || comp.finished) return;
          // Knockout ties must be checked — and simulated — before the
          // matchday gate below, since seasonCompDoneWithMatchday treats
          // them as "done with the matchday" (correctly, so they don't
          // block the domestic leagues) but that's not the same as "don't
          // simulate them"; without this they'd never advance in a bulk
          // sim and the season would never actually finish.
          if (key === 'ucl' && comp.stage !== 'league') { simulateUCLStep(comp); playedSomething = true; return; }
          if (seasonCompDoneWithMatchday(key, comp, targetIdx)) return;
          if (key === 'ucl') simulateUCLStep(comp); else simulateLeagueRound(comp);
          playedSomething = true;
        });
        season.week = computeSeasonWeek(season);
        safety++;
        updateLoadingProgress(Math.min(safety, estimatedWeeks), estimatedWeeks, startTime);
        await simTick();
        // Safety valve: if a pass through every competition made no
        // progress at all, stop rather than spin forever.
        if (!playedSomething) break;
      }
      updateLoadingProgress(estimatedWeeks, estimatedWeeks, startTime);
      advanceCongestionSlotIfComplete();
      finalizeSeasonIfComplete();
      renderSeasonDashboard();
      persistAll();
      saveStats();
    });
  }
/*@CHUNK:c0559:END*/

/*@CHUNK:c0560:START*/

/*@CHUNK:c0560:END*/

/*@CHUNK:c0561:START*/
  function startNewSeasonYear() {
    if (!season) return;
    if (!seasonIsComplete()) { toast('Finish this season first (or Simulate To End)'); return; }
    const year = season.year + 1;
    const leagues = {};
    SEASON_LEAGUE_DEFS.forEach(def => {
      const teams = season.leagues[def.key].teams;
      leagues[def.key] = {
        key: def.key, name: def.name, teams,
        table: teams.map(blankSeasonRow),
        rounds: buildDoubleRoundRobinRounds(teams),
        currentRound: 0, champion: null, finished: false,
        stats: blankCompStats()
      };
    });
    // Re-qualify the Champions League from this season's just-finished
    // final standings — the top clubs from each league carry forward.
    const uclTeams = computeUCLQualifiersFromStandings();
    const matchesPerTeam = Math.max(2, Math.min(8, uclTeams.length - 1));
    const leagueFixtures = generateUCLLeagueFixtures(uclTeams, matchesPerTeam);
    const uclRounds = [];
    for (let r = 1; r <= matchesPerTeam; r++) uclRounds.push(leagueFixtures.filter(f => f.round === r));
    season = {
      year, week: 0, daySlot: 0, leagues,
      ucl: { key: 'ucl', name: 'Champions League', teams: uclTeams, table: uclTeams.map(blankSeasonRow),
        rounds: uclRounds, currentRound: 0, matchesPerTeam, stage: 'league', bracketSize: null,
        knockout: { qf: null, sf: null, final: null }, champion: null, finished: false,
        stats: blankCompStats() }
    };
    renderSeasonDashboard();
    toast('Year ' + year + ' kicks off!');
    persistAll();
  }
/*@CHUNK:c0561:END*/

/*@CHUNK:c0562:START*/

/*@CHUNK:c0562:END*/

/*@CHUNK:c0563:START*/
  function resetSeason() {
    if (!confirm('Reset the season? All standings and fixtures will be lost.')) return;
    season = null;
    seasonActiveTab = 'epl';
    seasonActiveSubTab = 'table';
    seasonSetup = {
      selections: { epl: new Set(), laliga: new Set(), seriea: new Set(), bundesliga: new Set(), ligue1: new Set() },
      search: { epl: '', laliga: '', seriea: '', bundesliga: '', ligue1: '' }
    };
    renderSeasonSetup();
    const setup = document.getElementById('season-setup');
    const dash = document.getElementById('season-dashboard');
    if (setup) setup.style.display = 'block';
    if (dash) dash.style.display = 'none';
    toast('Season reset');
    persistAll();
  }
/*@CHUNK:c0563:END*/
