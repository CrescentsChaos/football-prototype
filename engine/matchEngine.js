/*@CHUNK:c0127:START*/

/*@CHUNK:c0127:END*/

/*@CHUNK:cstakes01:START*/
  // Whether the current moment carries extra pressure — a derby (teams.json
  // "rivals", optional), a cup/season final, or a close scoreline deep in
  // the second half. Cheap to call per-shot/per-foul rather than cached
  // once at kickoff, since the close-and-late leg of it genuinely changes
  // minute to minute. Feeds the Big-Game/Fragile composure read in
  // shooting.js.
  function computeStakes(homeTeam, awayTeam, competition, minute, scoreDiff) {
    const isDerby = Array.isArray(homeTeam.rivals) && homeTeam.rivals.includes(awayTeam.id);
    const isFinal = competition && competition.stage === 'final';
    const isCloseLate = minute > 75 && Math.abs(scoreDiff) <= 1;
    return isDerby || isFinal || isCloseLate;
  }
/*@CHUNK:cstakes01:END*/

/*@CHUNK:cslowstart01:START*/
  // Slow Starter personality: reduced effectiveness in the first ~15
  // minutes of a match, partially offset as the half wears on. This is a
  // genuine per-minute (m.minute) read, so it lives here in matchEngine.js
  // alongside the match clock rather than being baked into the per-match,
  // kickoff-rolled condition system in form.js — but it's applied through
  // that same conditionMultiplier() choke point (see the call in form.js)
  // so every existing shooting/passing/defending/goalkeeping read site
  // picks it up automatically instead of needing its own wiring.
  function slowStarterMultiplier(p) {
    const m = currentMatch;
    if (!m || !p || !p.expandedAttrs) return 1;
    if (!(p.expandedAttrs.personality || []).includes('Slow Starter')) return 1;
    const minute = m.minute || 0;
    if (minute >= 15) return 1;
    // Starts ~15% down at kickoff, linearly recovers back to neutral by
    // minute 15.
    return 1 - 0.15 * (1 - minute / 15);
  }
/*@CHUNK:cslowstart01:END*/

/*@CHUNK:c0128:START*/
  function startMatch() {
    const homeSel = document.getElementById('home-team');
    const awaySel = document.getElementById('away-team');
    if (!homeSel || !awaySel) return;
    const homeId = homeSel.value;
    const awayId = awaySel.value;
    if (!homeId || !awayId || homeId === awayId) { toast('Select two different teams'); return; }
    const homeTeam = getTeam(homeId);
    const awayTeam = getTeam(awayId);
    if (!homeTeam || !awayTeam) { toast('Team not found'); return; }
    const homeForm = (document.getElementById('home-formation') || {}).value || '4-3-3';
    const awayForm = (document.getElementById('away-formation') || {}).value || '4-3-3';
    let homeSquad = (customLineups.home && customLineups.home.formation === homeForm && customLineups.home._teamId === homeTeam.id)
      ? customLineups.home : buildSquad(homeTeam, homeForm);
    let awaySquad = (customLineups.away && customLineups.away.formation === awayForm && customLineups.away._teamId === awayTeam.id)
      ? customLineups.away : buildSquad(awayTeam, awayForm);
    homeSquad = dedupeSquad(homeSquad);
    awaySquad = dedupeSquad(awaySquad);

    currentMatch = {
      home: { team: homeTeam, squad: homeSquad, score: 0, stats: blankStats() },
      away: { team: awayTeam, squad: awaySquad, score: 0, stats: blankStats() },
      minute: 0, events: [], status: '1st Half', finished: false,
      // Match-clock state (see updateMatchClock) — the first half starts
      // its own 45-minute regulation window right away; the display minute
      // and label are recomputed every tick.
      period: 'H1', periodStartRaw: 0, periodBaseDisplay: 0, periodDuration: 45, periodStoppage: null,
      dispMin: 0, dispLabel: "0'",
      homeOnPitch: homeSquad.starting.map(p => p.id),
      awayOnPitch: awaySquad.starting.map(p => p.id),
      homeSubsUsed: 0, awaySubsUsed: 0, maxSubs: 5,
      injuries: [], cards: { home: {}, away: {} }, possession: 50,
      subLog: { home: {}, away: {} }, // playerId -> { outMin, inMin, replaced, replacedBy }
      leftPitch: { home: [], away: [] }, // playerIds who have left the pitch (sub'd off, sent off, or injured off) — can never return
      tactics: { home: 'balanced', away: 'balanced' },
      playerMatchStats: {},
      goalList: []
    };
    currentMatch.home.roles = assignMatchRoles(currentMatch.home);
    currentMatch.away.roles = assignMatchRoles(currentMatch.away);
    // Career Mode: which side (if either) the person is manually managing —
    // set once here from the shared careerTeamId (js/state.js), and read
    // everywhere a live match needs to know whether to let the AI drive a
    // side (runTacticalAI/trySubstitution in engine/tactics.js) or leave it
    // to the person's own tactics/formation/substitution calls instead.
    currentMatch.userSide = careerTeamId && homeTeam.id === careerTeamId ? 'home'
      : careerTeamId && awayTeam.id === careerTeamId ? 'away' : null;
    // Form & Condition system (engine/form.js) — roll every squad member's
    // match condition once, right here at kickoff, before anything reads it.
    rollMatchConditions(currentMatch);
    // Opening tactical instructions now come from the matchup, not a flat
    // "balanced" default every time: a clear underdog tends to sit in and
    // be harder to break down, a clear favourite tends to push on, and a
    // counter-minded manager identity nudges an otherwise even matchup
    // toward pressing higher up — so kickoff already feels shaped by who's
    // actually playing before a single ball is kicked.
    const openStrHome = calcTeamStrength(currentMatch.home);
    const openStrAway = calcTeamStrength(currentMatch.away);
    currentMatch.tactics.home = decideOpeningTactic(openStrHome, openStrAway, getManagerPlaystyle(homeTeam), homeTeam);
    currentMatch.tactics.away = decideOpeningTactic(openStrAway, openStrHome, getManagerPlaystyle(awayTeam), awayTeam);

    const setup = document.getElementById('match-setup');
    const live = document.getElementById('match-live');
    if (setup) setup.style.display = 'none';
    if (live) live.style.display = 'block';
    const pm = document.getElementById('post-match-ratings');
    if (pm) { pm.style.display = 'none'; pm.innerHTML = ''; }
    const backBtn = document.getElementById('back-to-tournament');
    if (backBtn) { backBtn.style.display = 'none'; backBtn.classList.remove('show'); }
    updateScoreboard();
    renderLineups();
    const feed = document.getElementById('events-feed');
    if (feed) feed.innerHTML = '';
    // Clear previous match stats UI
    ['live-home-score','live-away-score'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = '0'; });
    const minEl = document.getElementById('live-minute'); if (minEl) minEl.textContent = "0'";
    const stEl = document.getElementById('live-status'); if (stEl) stEl.textContent = '1st Half';
    const hg = document.getElementById('home-goal-scorers'); if (hg) hg.innerHTML = '';
    const ag = document.getElementById('away-goal-scorers'); if (ag) ag.innerHTML = '';
    const statsEl = document.getElementById('match-stats'); if (statsEl) statsEl.innerHTML = '';
    const pm2 = document.getElementById('post-match-ratings'); if (pm2) { pm2.style.display = 'none'; pm2.innerHTML = ''; }
    const kickMsgs = [
      'Kick off! The referee starts the contest.',
      "And we're underway!",
      'The match is live — kick-off taken.',
      'Here we go! First whistle blown.'
    ];
    addEvent(0, 'whistle', kickMsgs[Math.floor(seededRandom()*kickMsgs.length)], null);
    currentMatch.countForLeaderboard = !!(tournament || window._tourFixtureIdx != null || window._koRoundIdx != null || window._tourLeagueFixtureIdx != null || window._seasonFixture != null);
    currentMatch.allowET = !!(document.getElementById('opt-et') && document.getElementById('opt-et').checked);
    currentMatch.allowPens = !!(document.getElementById('opt-pens') && document.getElementById('opt-pens').checked);
    const gt = document.getElementById('goal-timeline');
    if (gt) gt.innerHTML = '';
    isPlaying = false;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = '▶ Play';
    // Career Mode: reveal the manage panel toggle only when the person is
    // actually controlling one of the two sides in this match.
    const mgBtn = document.getElementById('btn-career-manage');
    if (mgBtn) mgBtn.style.display = currentMatch.userSide ? 'inline-flex' : 'none';
    const mgPanel = document.getElementById('career-manage-panel');
    if (mgPanel) mgPanel.style.display = 'none';
    if (currentMatch.userSide) renderCareerPanel();
  }
/*@CHUNK:c0128:END*/

/*@CHUNK:c0129:START*/

/*@CHUNK:c0129:END*/

/*@CHUNK:c0130:START*/
  function blankStats() {
    return {
      shots: 0, shotsOn: 0, possession: 50, fouls: 0, corners: 0, saves: 0, passes: 0, passesCompleted: 0, interceptions: 0, blocks: 0, yellows: 0, reds: 0, xg: 0,
      // Attack
      bigChances: 0, bigChancesMissed: 0, bigChancesCreated: 0, touches: 0, touchesInBox: 0, progressiveCarries: 0, carries: 0, dribbles: 0, successfulDribbles: 0, offsides: 0,
      // Passing
      progressivePasses: 0, keyPasses: 0, throughBalls: 0, crosses: 0, switches: 0, longBalls: 0, finalThirdPasses: 0,
      // Defense
      tackles: 0, clearances: 0, headedClearances: 0, defensiveErrors: 0, recoveries: 0, pressures: 0, aerialDuels: 0,
      // Physical
      distance: 0, sprints: 0, highSpeedRuns: 0, accelerations: 0, decelerations: 0,
      // Goalkeeping
      punches: 0, claims: 0, crossesStopped: 0, goalsPrevented: 0, psxg: 0, distribution: 0
    };
  }
/*@CHUNK:c0130:END*/

/*@CHUNK:c0135:START*/

/*@CHUNK:c0135:END*/

/*@CHUNK:c0136:START*/
  function continueToET() {
    const m = currentMatch;
    if (!m) return;
    hideETPrompt();
    m._awaitingET = false;
    m.inET = true;
    m.status = 'Extra Time (1st Half)';
    addEvent(m.minute, 'et', 'Extra time begins — two periods of 15 minutes', null);
    // The clock itself doesn't restart at 90' until the next tick — see the
    // pendingPeriod handling at the top of tick().
    m.pendingPeriod = { period: 'ET1', base: 90, duration: 15, status: 'Extra Time (1st Half)' };
    updateScoreboard();
    isPlaying = true;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = '⏸ Pause';
    const speed = parseInt((document.getElementById('sim-speed') || {}).value || '400', 10);
    clearInterval(simInterval);
    simInterval = setInterval(() => tick(false), speed);
  }
/*@CHUNK:c0136:END*/

/*@CHUNK:c0137:START*/

/*@CHUNK:c0137:END*/

/*@CHUNK:c0138:START*/
  function continueToPens() {
    const m = currentMatch;
    if (!m) return;
    hideETPrompt();
    m._awaitingET = false;
    m._awaitingPens = false;
    runPenaltyShootout();
  }
/*@CHUNK:c0138:END*/

/*@CHUNK:c0139:START*/

/*@CHUNK:c0139:END*/

/*@CHUNK:c0140:START*/
  function skipETAndEnd() {
    hideETPrompt();
    if (currentMatch) {
      currentMatch._awaitingET = false;
      currentMatch._awaitingPens = false;
    }
    endMatch();
  }
/*@CHUNK:c0140:END*/

/*@CHUNK:c0151:START*/

/*@CHUNK:c0151:END*/

/*@CHUNK:c0152:START*/
  function pushGoal(side, player, minute, methodDesc) {
    if (!currentMatch) return;
    if (!currentMatch.goalList) currentMatch.goalList = [];
    const isPen = /^penalty/i.test(methodDesc || '');
    // dispMin/dispLabel are the match-clock reading at the moment of the
    // goal (e.g. 90 / "90+2'") — see updateMatchClock — while `minute`
    // stays the raw tick for anything that needs strict chronological order.
    const dispMin = currentMatch.dispMin != null ? currentMatch.dispMin : minute;
    const dispLabel = currentMatch.dispLabel || (minute + "'");
    // id is included alongside the name so a saved report can drop the
    // name and rehydrate it from the id later (see teamRefReplacer /
    // teamRefReviver in simulation/seasonEngine.js) — this was previously
    // the single biggest chunk of a match report's persisted size, since
    // there was no id here to recover the name from at all.
    currentMatch.goalList.push({ side, player: player.name, id: player.id, num: player.num, minute, dispMin, dispLabel, method: methodDesc || '', pen: isPen });
    renderGoalTimeline();
  }
/*@CHUNK:c0152:END*/

/*@CHUNK:c0155:START*/

/*@CHUNK:c0155:END*/

/*@CHUNK:c0156:START*/
  function buildMatchReport(m) {
    if (!m) return null;
    const allStats = m.playerMatchStats ? JSON.parse(JSON.stringify(m.playerMatchStats)) : {};
    const homeIds = new Set((m.home.squad && m.home.squad.all || []).map(p => p.id));
    const homeRatings = [], awayRatings = [];
    Object.values(allStats).forEach(ps => {
      (homeIds.has(ps.id) ? homeRatings : awayRatings).push(ps);
    });
    const byRating = (x, y) => (y.rating || 0) - (x.rating || 0);
    homeRatings.sort(byRating);
    awayRatings.sort(byRating);
    return {
      venue: getStadium(m.home.team),
      home: { id: m.home.team.id, name: m.home.team.name, short: m.home.team.short, flag: m.home.team.flag, logo: m.home.team.logo, score: m.home.score, penScore: m.home.penScore, stats: JSON.parse(JSON.stringify(m.home.stats || {})), formation: m.home.squad && m.home.squad.formation, ratings: homeRatings },
      away: { id: m.away.team.id, name: m.away.team.name, short: m.away.team.short, flag: m.away.team.flag, logo: m.away.team.logo, score: m.away.score, penScore: m.away.penScore, stats: JSON.parse(JSON.stringify(m.away.stats || {})), formation: m.away.squad && m.away.squad.formation, ratings: awayRatings },
      events: (m.events || []).map(e => ({ minute: e.minute, dispMin: e.dispMin, dispLabel: e.dispLabel, type: e.type, text: e.text, side: e.side })),
      goals: JSON.parse(JSON.stringify(m.goalList || [])),
      ratings: allStats,
      motmId: m.motmId || null,
      finished: true
    };
  }

  // Lightweight counterpart to buildMatchReport() — used for every
  // auto-simmed fixture (anything that goes through simQuickMatch, i.e.
  // any match the user never actually watches). A full report carries a
  // ~30-field playerMatchStats blob per player plus the entire event log,
  // which is fine for the handful of matches someone watches live but
  // balloons storage the instant you bulk-sim a whole tournament or
  // season — this keeps just what a results page actually needs: final
  // score, who scored (and when/how), who was booked/sent off, and MOTM.
  // Marked `light: true` so the report modal (ui/matchUI.js) knows to
  // skip the sections (team stats, player ratings) it has no data for.
  function buildLightMatchReport(m) {
    if (!m) return null;
    const cardEvents = (m.events || []).filter(e => e.type === 'yellow' || e.type === 'red');
    const cardsForSide = (side, squad) => {
      const ids = new Set((squad && squad.all || []).map(p => p.id));
      const list = [];
      Object.values(m.playerMatchStats || {}).forEach(ps => {
        if (!ids.has(ps.id)) return;
        if (ps.red) list.push({ id: ps.id, player: ps.name, num: ps.num, type: 'red' });
        else if (ps.yellow) list.push({ id: ps.id, player: ps.name, num: ps.num, type: 'yellow' });
      });
      list.forEach(c => {
        const ev = cardEvents.find(e => e.side === side && e.type === c.type && (e.text || '').indexOf(c.player) !== -1);
        if (ev) { c.minute = ev.minute; c.dispMin = ev.dispMin; c.dispLabel = ev.dispLabel; }
      });
      return list;
    };
    // Who performed, in a few words: assist providers and keepers' save
    // counts. Deliberately just id/name/num/count — not the full per-player
    // stat blob buildMatchReport captures — so this stays cheap to store
    // while still answering "who set that up" / "who kept us in it".
    const performersForSide = (squad) => {
      const ids = new Set((squad && squad.all || []).map(p => p.id));
      const assists = [], saves = [];
      Object.values(m.playerMatchStats || {}).forEach(ps => {
        if (!ids.has(ps.id)) return;
        if (ps.assists > 0) assists.push({ id: ps.id, player: ps.name, num: ps.num, count: ps.assists });
        if (ps.saves > 0) saves.push({ id: ps.id, player: ps.name, num: ps.num, count: ps.saves });
      });
      assists.sort((x, y) => y.count - x.count);
      saves.sort((x, y) => y.count - x.count);
      return { assists, saves };
    };
    const homePerf = performersForSide(m.home.squad);
    const awayPerf = performersForSide(m.away.squad);
    // Injuries: m.injuries is just a list of playerIds picked up this match
    // (see engine/injuries.js) — cross-reference with injuryBook, which
    // still holds this match's fresh record for each of them at the point
    // buildLightMatchReport runs, to pull the injury type and lay-off length.
    const injuriesForSide = (side, squad) => {
      const ids = new Set((squad && squad.all || []).map(p => p.id));
      const list = [];
      (m.injuries || []).forEach(pid => {
        if (!ids.has(pid)) return;
        const rec = injuryBook[pid];
        list.push({
          id: pid,
          player: rec ? rec.playerName : ((squad.all || []).find(p => p.id === pid) || {}).name || '',
          type: rec ? rec.type : '',
          severity: rec ? rec.severity : '',
          matchesOut: rec ? rec.matchesTotal : null,
          minute: rec ? rec.minute : null
        });
      });
      return list;
    };
    return {
      light: true,
      venue: getStadium(m.home.team),
      home: { id: m.home.team.id, name: m.home.team.name, short: m.home.team.short, flag: m.home.team.flag, logo: m.home.team.logo, score: m.home.score, penScore: m.home.penScore, formation: m.home.squad && m.home.squad.formation, assists: homePerf.assists, saves: homePerf.saves },
      away: { id: m.away.team.id, name: m.away.team.name, short: m.away.team.short, flag: m.away.team.flag, logo: m.away.team.logo, score: m.away.score, penScore: m.away.penScore, formation: m.away.squad && m.away.squad.formation, assists: awayPerf.assists, saves: awayPerf.saves },
      goals: JSON.parse(JSON.stringify(m.goalList || [])),
      cards: { home: cardsForSide('home', m.home.squad), away: cardsForSide('away', m.away.squad) },
      injuries: { home: injuriesForSide('home', m.home.squad), away: injuriesForSide('away', m.away.squad) },
      motmId: m.motmId || null,
      finished: true
    };
  }
/*@CHUNK:c0156:END*/

/*@CHUNK:c0167:START*/


/*@CHUNK:c0167:END*/

/*@CHUNK:c0168:START*/
  function blankPlayerMatchStats(p) {
    return {
      id: p.id, name: p.name, num: p.num, pos: (p.pos||[])[0], ovr: p.ovr,
      goals: 0, assists: 0, shots: 0, saves: 0, tackles: 0, passes: 0, xg: 0, xa: 0, rating: 6.0, yellow: false, red: false,
      // Attack
      bigChances: 0, bigChancesMissed: 0, bigChancesCreated: 0, touches: 0, touchesInBox: 0, progressiveCarries: 0, carries: 0, dribbles: 0, successfulDribbles: 0, offsides: 0,
      // Passing
      progressivePasses: 0, keyPasses: 0, throughBalls: 0, crosses: 0, switches: 0, longBalls: 0, finalThirdPasses: 0,
      // Defense
      interceptions: 0, blocks: 0, clearances: 0, headedClearances: 0, defensiveErrors: 0, recoveries: 0, pressures: 0, aerialDuels: 0,
      // Physical
      distance: 0, sprints: 0, highSpeedRuns: 0, accelerations: 0, decelerations: 0,
      // Goalkeeping
      punches: 0, claims: 0, crossesStopped: 0, goalsPrevented: 0, psxg: 0, distribution: 0
    };
  }
/*@CHUNK:c0168:END*/

/*@CHUNK:cx900b:START*/
  // Shared live-tracking helper for the extended stat sheet (Attack/
  // Passing/Defense/Physical/Goalkeeping) — ensures a player's match-stats
  // record exists, then bumps one field by `amt` (default 1). Called from
  // every phase of the pipeline (engine/possession.js, engine/passing.js,
  // engine/shooting.js) so these numbers build up live, minute by minute,
  // from genuine simulated events — the same pattern already used for the
  // "core" stats (shots, passes, tackles, ...) — rather than being
  // reconstructed out of thin air after the final whistle.
  function bumpExtStat(p, key, amt) {
    const m = currentMatch;
    if (!m || !p) return null;
    if (!m.playerMatchStats) m.playerMatchStats = {};
    if (!m.playerMatchStats[p.id]) m.playerMatchStats[p.id] = blankPlayerMatchStats(p);
    const ps = m.playerMatchStats[p.id];
    ps[key] = (ps[key] || 0) + (amt == null ? 1 : amt);
    return ps;
  }
/*@CHUNK:cx900b:END*/

/*@CHUNK:cx900c:START*/
  // The single source of truth for "who is actually in goal for this side
  // right now". A real specialist keeper still out there always wins. If
  // he's been sent off (see handleGoalkeeperSentOff in engine/tactics.js),
  // this falls back to whichever outfield player that side has designated
  // to wear the gloves for the rest of the match (sideData.emergencyGkId) —
  // a persistent, explicit stand-in rather than every call site quietly
  // re-picking a different random outfield player of its own. Every GK
  // lookup used for actual gameplay (shot-stopping, penalties, corners,
  // free-kicks, the shootout) should go through this instead of a raw
  // position filter, or a keeper who's been sent off keeps "saving" shots
  // as a phantom, and the shootout/clean-sheet code can end up crediting
  // him for a match he was dismissed from.
  function activeGoalkeeper(side) {
    const m = currentMatch;
    if (!m) return null;
    const sideData = m[side];
    if (!sideData) return null;
    const onIds = side === 'home' ? (m.homeOnPitch || []) : (m.awayOnPitch || []);
    const leftIds = (m.leftPitch && m.leftPitch[side]) || [];
    const pool = sideData.squad.all || [];
    const realGk = pool.find(p => onIds.includes(p.id) && !leftIds.includes(p.id) && (p.pos || []).includes('GK'));
    if (realGk) return realGk;
    const emgId = sideData.emergencyGkId;
    if (emgId && onIds.includes(emgId) && !leftIds.includes(emgId)) {
      return pool.find(p => p.id === emgId) || null;
    }
    return null;
  }
/*@CHUNK:cx900c:END*/

/*@CHUNK:cx901:START*/

  // Broad role bucket for extended-stats generation below — GK / DEF / MID / FWD.
  function posGroupOf(posArr, primaryPos) {
    const pp = (primaryPos || (posArr || [])[0] || 'CM').toUpperCase();
    const list = (posArr || []).map(x => (x || '').toUpperCase());
    if (pp === 'GK' || list.includes('GK')) return 'GK';
    if (['CB', 'RB', 'LB', 'RWB', 'LWB'].includes(pp) || list.some(x => ['CB','RB','LB','RWB','LWB'].includes(x))) return 'DEF';
    if (['CM', 'CDM', 'CAM', 'RM', 'LM'].includes(pp) || list.some(x => ['CM','CDM','CAM','RM','LM'].includes(x))) return 'MID';
    return 'FWD';
  }
/*@CHUNK:cx901:END*/

/*@CHUNK:cx902:START*/

  // Finalizes the full extended stat sheet (Attack/Passing/Defense/Physical/
  // Goalkeeping) for every player involved in the match, then sums each
  // field into the team totals so the team sheet always agrees exactly with
  // what's shown per-player underneath it. Runs once at full time (called
  // from endMatch(), after ratings/goalsConceded are finalised).
  //
  // Every field below is now built up LIVE, minute by minute, from genuine
  // simulated events (see bumpExtStat() and its call sites across
  // engine/possession.js, engine/passing.js, engine/shooting.js,
  // engine/defending.js and engine/offside.js) rather than reconstructed
  // from scratch here off nothing but the player's role and minutes played.
  // This function's own job is now just three things: (1) a same-match
  // backfill for the handful of fields a live loop can genuinely miss for a
  // given player (clearances/headed clearances — see the ps._liveClr /
  // ps._liveHeadedClr flags), (2) a couple of fields that are honestly
  // still a deterministic *formula* over other real numbers rather than a
  // directly-observable single event (touches, touches in the box,
  // recoveries, distribution, goals prevented), and (3) the physical
  // figures (distance/sprints/high-speed runs/accelerations/decelerations),
  // which — with no literal player-position tracking in this engine — are
  // now derived deterministically from this player's own real workload this
  // match (how many real actions they were actually involved in) instead of
  // an independent random roll keyed only off position and minutes.
  const EXTENDED_STAT_KEYS = ['bigChances','bigChancesMissed','bigChancesCreated','touches','touchesInBox','progressiveCarries','carries',
    'dribbles','successfulDribbles','offsides','progressivePasses','keyPasses','throughBalls','crosses',
    'switches','longBalls','finalThirdPasses','tackles','clearances','headedClearances','defensiveErrors',
    'recoveries','pressures','aerialDuels','distance','sprints','highSpeedRuns','accelerations','decelerations',
    'punches','claims','crossesStopped','goalsPrevented','psxg'];

  function deriveExtendedMatchStats(m) {
    if (!m) return;
    ['home', 'away'].forEach(side => {
      const teamSide = m[side];
      const squadAll = (teamSide.squad && teamSide.squad.all) || [];
      squadAll.forEach(p => {
        const ps = m.playerMatchStats[p.id];
        if (!ps) return;
        const minutes = computeMinutesPlayed(m, p.id, p.name, side);
        const played = minutes > 0 || ps.goals || ps.assists || ps.shots || ps.saves || ps.tackles || ps.passes || ps.interceptions || ps.blocks;
        if (!played) return;
        const posArr = (ps.posArr && ps.posArr.length) ? ps.posArr : (p.pos || []);
        const group = posGroupOf(posArr, ps.pos);
        const minFrac = Math.max(0.15, Math.min(1, minutes / 90));
        const passes = ps.passes || 0, passesC = ps.passesCompleted || 0, shots = ps.shots || 0;
        const tackles = ps.tackles || 0, ints = ps.interceptions || 0, blocks = ps.blocks || 0;
        const carries = ps.carries || 0, dribbles = ps.dribbles || 0;
        const saves = ps.saves || 0, claims = ps.claims || 0, punches = ps.punches || 0;
        const rv = (mean, spread) => Math.max(0, mean + (seededRandom() * 2 - 1) * spread);

        // ---- Clearances/headed clearances: genuinely live-simulated
        // minute-by-minute (see simulateDefensiveActions in
        // engine/defending.js), which sets ps._liveClr / ps._liveHeadedClr —
        // this backfill only kicks in as a fallback for a player that live
        // loop never actually touched this match (e.g. a slot outside its
        // table), so the sheet never shows a suspicious flat zero.
        if (!ps._liveClr) {
          ps.clearances = Math.round(rv((group === 'DEF' ? 7.3 : group === 'MID' ? 1.4 : 0.3) * minFrac, group === 'DEF' ? 3 : 0.7));
        }
        if (!ps._liveHeadedClr) {
          ps.headedClearances = Math.round(ps.clearances * 0.3);
        }

        // ---- Touches / touches in the box: a real sum of every on-the-
        // ball action this player is actually recorded for this match
        // (attempted passes, carries, dribbles, shots, defensive actions,
        // saves/claims/punches for a keeper) rather than a position-
        // flavoured guess — a player who did more, touched the ball more.
        ps.touches = passes + carries + dribbles + shots + tackles + ints + blocks + ps.clearances + saves + claims + punches;
        ps.touchesInBox = shots + (ps.bigChances || 0);

        // ---- Recoveries: every genuine regain is already tallied
        // somewhere else on the sheet (a tackle, an interception, a block,
        // a clearance IS a recovery), so this is a real sum, not an
        // independent random figure.
        ps.recoveries = tackles + ints + blocks + ps.clearances;

        // ---- Physical: no literal player-position tracking exists in
        // this engine, so these are built deterministically from this
        // player's own real workload this match (touches, pressing/marking
        // events, regains, minutes) instead of a random roll keyed only off
        // position and minutes — two players with the same real involvement
        // this match now read the same physically, too.
        const roleBase = group === 'GK' ? 4.5 : group === 'DEF' ? 7.4 : group === 'MID' ? 8.6 : 8.0;
        ps.distance = +(roleBase * minFrac + (ps.touches + ps.pressures + ps.recoveries) * 0.028).toFixed(1);
        ps.sprints = Math.round(carries + dribbles + ps.pressures * 0.5 + ps.recoveries * 0.4);
        ps.highSpeedRuns = Math.round(ps.sprints * (group === 'FWD' ? 0.5 : group === 'MID' ? 0.42 : 0.35));
        ps.accelerations = Math.round(carries + dribbles + ps.pressures + ps.recoveries * 0.5);
        ps.decelerations = Math.round(ps.accelerations * 0.9);

        // ---- Distribution / Goals Prevented: both genuinely derived math
        // over other real numbers, not invented — distribution is this
        // player's own real pass accuracy, and Goals Prevented is real
        // live-tallied psxg (see resolveShot in engine/shooting.js) minus
        // real goals conceded, the usual "keeper overperformance" read.
        ps.distribution = passes ? Math.round((passesC / passes) * 100) : 0;
        if (group === 'GK') {
          ps.goalsPrevented = +((ps.psxg || 0) - (ps.goalsConceded || 0)).toFixed(2);
        }
      });

      EXTENDED_STAT_KEYS.forEach(k => { teamSide.stats[k] = 0; });
      squadAll.forEach(p => {
        const ps = m.playerMatchStats[p.id];
        if (!ps) return;
        EXTENDED_STAT_KEYS.forEach(k => { if (typeof ps[k] === 'number') teamSide.stats[k] += ps[k]; });
      });
      teamSide.stats.distance = +teamSide.stats.distance.toFixed(1);
      teamSide.stats.psxg = +teamSide.stats.psxg.toFixed(2);
      teamSide.stats.goalsPrevented = +teamSide.stats.goalsPrevented.toFixed(2);
      // Team-wide distribution accuracy is the side's overall pass accuracy,
      // not a sum of individual keeper numbers.
      teamSide.stats.distribution = teamSide.stats.passes ? Math.round((teamSide.stats.passesCompleted / teamSide.stats.passes) * 100) : 0;
    });
  }
/*@CHUNK:cx902:END*/

/*@CHUNK:cp022:START*/

  // Human-readable name for whatever's currently being simulated, used both
  // for the per-player match log and anywhere else a competition label is
  // needed. Falls back to "Friendly" for a plain Kick Off match.
  function matchCompetitionLabel(m) {
    if (tournament) {
      if (tournament.competitionName) return tournament.competitionName;
      return tournament.type === 'worldcup' ? 'World Cup' : 'Champions League';
    }
    if (currentSeasonComp && currentSeasonComp.name) return currentSeasonComp.name;
    if (m && m.countForLeaderboard) return 'Cup';
    return 'Friendly';
  }

/*@CHUNK:cp022:END*/

/*@CHUNK:cp023:START*/

  // Best-effort minutes played from this match's sub log (exact) plus a
  // fallback scan of the event feed for a red card naming this player
  // (subs already record an exact minute; a straight red doesn't go through
  // subLog at all, so this is the only record of when that player's
  // involvement actually ended).
  function computeMinutesPlayed(m, playerId, playerName, side) {
    const endMin = Math.max(m.dispMin || 90, 90);
    const log = (m.subLog && m.subLog[side] && m.subLog[side][playerId]) || {};
    const start = typeof log.inMin === 'number' ? log.inMin : 0;
    let end = typeof log.outMin === 'number' ? log.outMin : endMin;
    if (typeof log.outMin !== 'number' && playerName) {
      const evt = (m.events || []).find(e => e.type === 'red' && e.text && e.text.indexOf(playerName) !== -1);
      if (evt) end = Math.min(end, evt.dispMin != null ? evt.dispMin : evt.minute);
    }
    return Math.max(0, Math.min(end, endMin) - start);
  }

/*@CHUNK:cp023:END*/

/*@CHUNK:cp024:START*/

  // Appends this match's line to the player's persistent match log (see
  // playerMatchLog in ui/playersUI.js). Called once per involved player at
  // full time, right after their rating for this match is finalised.
  //
  // STORAGE FORMAT: each entry is a compact array, NOT an object —
  // [opponentTeamId, competition, minutes, goals, assists, shots, xg, rating]
  // (see PML_* index constants below). We used to store the opponent's
  // full name/short/logo/flag on every single entry, which is what a team
  // object already gives us for free via getTeam(id) — that redundancy was
  // most of this save key's size (see renderPlayerMatchLogHTML in
  // ui/playersUI.js, which resolves the opponent back through getTeam()).
  // Only the opponent's id needs to be persisted.
  function recordPlayerMatchLog(m, player, team, opponentTeam, ps, side) {
    if (!player || !team) return;
    const minutes = computeMinutesPlayed(m, player.id, player.name, side);
    if (minutes <= 0 && !(ps.goals || ps.assists || ps.shots)) return; // never actually took part
    if (!playerMatchLog[player.id]) playerMatchLog[player.id] = [];
    playerMatchLog[player.id].unshift([
      opponentTeam ? opponentTeam.id : null,
      matchCompetitionLabel(m),
      minutes,
      ps.goals || 0,
      ps.assists || 0,
      ps.shots || 0,
      Math.round((ps.xg || 0) * 100) / 100,
      ps.rating || 0
    ]);
    if (playerMatchLog[player.id].length > 30) playerMatchLog[player.id].length = 30;
  }

/*@CHUNK:cp024:END*/

/*@CHUNK:cp024b:START*/

  // Appends this match's line to a team's persistent match log (see
  // teamMatchLog in ui/teamUI.js). Called once per side at full time, right
  // after both players' match logs are recorded, so the two stay in sync.
  //
  // STORAGE FORMAT: compact array — [opponentTeamId, competition,
  // scoreFor, scoreAgainst] (see TML_* index constants below). W/D/L is
  // derived from scoreFor vs scoreAgainst at render time instead of being
  // stored, and opponent name/short/logo/flag are resolved via getTeam(id)
  // — same reasoning as recordPlayerMatchLog above.
  function recordTeamMatchLog(m, team, opponentTeam, scoreFor, scoreAgainst) {
    if (!team || !opponentTeam) return;
    if (!teamMatchLog[team.id]) teamMatchLog[team.id] = [];
    teamMatchLog[team.id].unshift([
      opponentTeam.id || null,
      matchCompetitionLabel(m),
      scoreFor,
      scoreAgainst
    ]);
    if (teamMatchLog[team.id].length > 30) teamMatchLog[team.id].length = 30;
  }

/*@CHUNK:cp024b:END*/

/*@CHUNK:c0185:START*/


/*@CHUNK:c0185:END*/

/*@CHUNK:c0186:START*/
  function calcPlayerRating(ps) {
    // Position-aware, activity-based, no random noise
    if (!ps) return 6.0;
    const goals = ps.goals || 0;
    const assists = ps.assists || 0;
    const shots = ps.shots || 0;
    const saves = ps.saves || 0;
    const tackles = ps.tackles || 0;
    const passes = ps.passes || 0;
    const xg = ps.xg || 0;
    const xa = ps.xa || 0;
    const pos = (ps.pos || ps.slot || '').toString().toUpperCase();
    const isGK = pos === 'GK' || (ps.posArr || []).includes('GK');
    const isDef = ['CB','RB','LB','RWB','LWB','DEF'].some(x => pos.includes(x)) || (ps.posArr || []).some(p => ['CB','RB','LB','RWB','LWB'].includes(p));
    const isMid = ['CM','CDM','CAM','RM','LM','DM','AM'].some(x => pos.includes(x)) || (ps.posArr || []).some(p => ['CM','CDM','CAM','RM','LM'].includes(p));

    let r = 6.0;

    const passesC = ps.passesCompleted || 0;
    const ints = ps.interceptions || 0;
    const blocks = ps.blocks || 0;
    // Goals conceded by the player's team this match — set by the caller
    // (endMatch / renderLineups) from the live/final scoreline. A back line
    // and keeper shipping a hatful of goals should be dragged down for it,
    // even if they racked up passes/tackles along the way; conceding 0-1 is
    // normal and isn't penalized.
    const conceded = ps.goalsConceded || 0;
    if (isGK) {
      r += Math.min(saves * 0.35, 2.4);
      if (saves >= 4) r += 0.25;
      if (saves >= 7) r += 0.35;
      if (ps.cleanSheet) r += 0.6;
      if (goals > 0) r += 1.5;
      r += Math.min(passes * 0.01, 0.25);
      r += Math.min(passesC * 0.015, 0.2);
      if (conceded >= 2) r -= Math.min((conceded - 1) * 0.45, 3.2);
      if (ps.yellow) r -= 0.35;
      if (ps.red) r -= 2.0;
    } else if (isDef) {
      // Defensive actions and pass volume used to be capped *separately*
      // (tackles up to +1.6, interceptions +1.2, blocks +0.9, passes +0.45,
      // completed passes +0.4 — up to +4.55 combined). Since the match sim
      // gives every CB/full-back realistic tackle counts and heavy pass
      // volume most matches just by playing 90 minutes, that let defenders
      // stack those caps and sit near the rating ceiling on a routine game
      // with zero goal involvement, crowding out attackers for MOTM. Now
      // defensive actions and passing each have one combined cap instead,
      // so an ordinary solid game lands in the 7s and genuine standout
      // contributions (or a goal/assist) are what push a defender higher.
      r += Math.min(tackles * 0.18 + ints * 0.2 + blocks * 0.15, 1.3);
      r += Math.min(passes * 0.008 + passesC * 0.012, 0.35);
      r += assists * 0.7;
      r += goals * 1.1;
      r += Math.min(shots * 0.08, 0.3);
      if (tackles + ints >= 6) r += 0.2;
      if (conceded >= 2) r -= Math.min((conceded - 1) * 0.35, 2.6);
      if (ps.yellow) r -= 0.4;
      if (ps.red) r -= 1.8;
    } else if (isMid) {
      // Same fix as defenders above: passing and defensive-action credit
      // are combined caps now instead of stacking separately (previously up
      // to +1.2 passing and +1.5 defensive actions before any goal/assist).
      r += assists * 0.95;
      r += goals * 1.15;
      r += Math.min(passes * 0.012 + passesC * 0.016, 0.55);
      r += Math.min(tackles * 0.1 + ints * 0.12, 0.5);
      r += Math.min(shots * 0.1, 0.45);
      r += Math.min(xa * 0.2, 0.4);
      r += Math.min(xg * 0.15, 0.3);
      if (passesC >= 30) r += 0.2;
      if (assists >= 2) r += 0.3;
      if (conceded >= 3) r -= Math.min((conceded - 2) * 0.15, 1.0);
      if (ps.yellow) r -= 0.35;
      if (ps.red) r -= 1.8;
    } else {
      r += goals * 1.25;
      r += assists * 0.85;
      r += Math.min(shots * 0.12, 0.6);
      if (shots > 0 && goals > 0) r += Math.min(goals / shots, 1) * 0.35;
      r += Math.min(xg * 0.25, 0.5);
      r += Math.min(xa * 0.15, 0.35);
      r += Math.min(passes * 0.01, 0.25);
      r += Math.min(passesC * 0.015, 0.2);
      r += Math.min(tackles * 0.1, 0.3);
      if (goals >= 2) r += 0.35;
      if (goals >= 3) r += 0.4;
      if (ps.yellow) r -= 0.35;
      if (ps.red) r -= 1.7;
    }

    // Passing success rate matters, not just volume — reward crisp, reliable passers
    // and dock players who give the ball away a lot, once they've had enough passes
    // for the sample to mean something.
    if (passes >= 8) {
      const acc = passesC / passes;
      const accDelta = (acc - 0.78) * (isGK ? 0.5 : isDef ? 0.9 : isMid ? 1.1 : 0.6);
      r += Math.max(-0.4, Math.min(0.35, accDelta));
    }

    // Shared involvement floor — but a heavy defeat still drags this down;
    // doing nothing notable in a 7-1 loss isn't a neutral 6.0 game.
    const actions = goals + assists + shots + saves + tackles + Math.floor(passes / 5);
    const concededFloorPenalty = (isGK || isDef) ? Math.min(Math.max(conceded - 1, 0) * 0.4, 3.0)
      : isMid ? Math.min(Math.max(conceded - 2, 0) * 0.15, 1.0) : 0;
    if (actions === 0) r = 6.0 - concededFloorPenalty;
    else if (actions === 1 && !isGK) r = Math.max(r, 6.2 - concededFloorPenalty);

    r += Math.max(-0.12, Math.min(0.18, ((ps.ovr || 75) - 75) * 0.008));

    // Small organic variance so two players with an identical stat-line don't
    // always come out with the exact same rating — mirrors the "eye test"
    // component of a real match rating without swinging results wildly.
    r += (seededRandom() - 0.5) * 0.22;

    // Keep ratings realistic: a good, solid game should land in the high 7s/8s.
    // Only a genuine breakout performance — a hat-trick, a brace-plus-assist, a big
    // multi-goal contribution, or a standout shutout for a GK/defender — should be
    // able to push into the 9.9-10.0 territory. Non-breakout games get a *soft*,
    // slightly randomized ceiling each time (not a fixed 9.2 wall every match) so
    // ratings feel more dynamic while still rarely maxing out without a big game.
    const isBreakout = isGK
      ? (saves >= 7 && (ps.cleanSheet || goals === 0) && !ps.red)
      : isDef
        ? ((goals >= 1 && ps.cleanSheet) || (goals + assists >= 3) || (goals >= 2 && assists >= 1)) && !ps.red
        : (goals >= 3 || (goals >= 2 && assists >= 1) || assists >= 3 || goals + assists >= 4) && !ps.red;
    let cap = isBreakout ? 10.0 : 8.7 + seededRandom() * 0.9; // ~8.7-9.6, varies match to match
    // Big Occasion Riser: rating ceiling raised specifically in cup/
    // knockout matches — distinct from Big-Game's shot-quality focus in
    // shooting.js, this touches the rating formula itself so a big-
    // occasion riser's whole game reads a notch higher on the day it
    // matters most, not just his shooting. ps.isBigGame/ps.personality are
    // set on the ratingInput copy by the caller below, right before this
    // function is invoked.
    if (!isBreakout && ps.isBigGame && (ps.personality || []).includes('Big Occasion Riser')) {
      cap = Math.min(10.0, cap + 0.5);
    }
    return Math.max(2.5, Math.min(cap, Math.round(r * 10) / 10));
  }
/*@CHUNK:c0186:END*/

/*@CHUNK:c0187:START*/


/*@CHUNK:c0187:END*/

/*@CHUNK:c0188:START*/
  function quickSimMatch() { startMatch(); if (currentMatch) simToEnd(); }

/*@CHUNK:c0188:END*/

/*@CHUNK:c0189:START*/
  function toggleSim() {
    if (!currentMatch || currentMatch.finished) return;
    isPlaying = !isPlaying;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = isPlaying ? '⏸ Pause' : '▶ Play';
    if (isPlaying) {
      simInterval = setInterval(() => {
        if (!currentMatch || currentMatch.finished) {
          clearInterval(simInterval); isPlaying = false;
          if (btn) btn.textContent = '▶ Play';
          return;
        }
        tick();
      }, simSpeed);
    } else {
      clearInterval(simInterval);
    }
  }
/*@CHUNK:c0189:END*/

/*@CHUNK:c0190:START*/

/*@CHUNK:c0190:END*/

/*@CHUNK:c0191:START*/
  function setSpeed(val) {
    simSpeed = parseInt(val) || 400;
    const labels = { 800: 'Slow', 400: 'Normal', 150: 'Fast', 40: 'Turbo' };
    const lbl = document.getElementById('sim-speed-label');
    if (lbl) lbl.textContent = 'Speed: ' + (labels[val] || 'Custom');
    if (isPlaying) {
      clearInterval(simInterval);
      simInterval = setInterval(() => {
        if (!currentMatch || currentMatch.finished) { clearInterval(simInterval); isPlaying = false; return; }
        tick();
      }, simSpeed);
    }
  }
/*@CHUNK:c0191:END*/

/*@CHUNK:c0192:START*/

/*@CHUNK:c0192:END*/

/*@CHUNK:c0193:START*/
  function simToEnd() {
    if (!currentMatch || currentMatch.finished) return;
    clearInterval(simInterval); isPlaying = false;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = '▶ Play';
    // Instant Result has no one to click the ET/pens prompt, so resolve draws
    // straight through instead of stalling at m._awaitingET — that stall was
    // what let the minute counter run past 90 and climb well past 200 while
    // safety just kept ticking without ever finishing. quietSim additionally
    // suppresses all live-view rendering, which is correct here since this is
    // used for the "Instant Result" button, not a fast-forward of a match the
    // user is actively watching (see finishMatch() for that).
    currentMatch.silentDeep = true;
    currentMatch.quietSim = true;
    let safety = 0;
    while (currentMatch && !currentMatch.finished && safety < 200) {
      tick(true);
      safety++;
    }
  }
/*@CHUNK:c0193:END*/

/*@CHUNK:c0194:START*/

  // "Finish Match" — unlike Instant Result, this is used mid-live-match, so it
  // should visibly race through the remaining minutes (scoreboard/events feed
  // still updating) rather than silently jumping straight to a final result.
  // It reuses silentDeep so any ET/pens decision auto-resolves instead of
  // stalling on a prompt (same reasoning as Instant Result), but leaves
  // quietSim off so every tick still renders — it's a fast Play, not a
  // silent one.
/*@CHUNK:c0194:END*/

/*@CHUNK:c0195:START*/
  function finishMatch() {
    if (!currentMatch || currentMatch.finished) return;
    clearInterval(simInterval);
    isPlaying = true;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = '⏩ Fast-forwarding…';
    currentMatch.silentDeep = true;
    currentMatch.quietSim = false;
    const FF_MS = 18; // fast enough to feel like a fast-forward, not a jump-cut
    simInterval = setInterval(() => {
      if (!currentMatch) { clearInterval(simInterval); isPlaying = false; return; }
      if (currentMatch.finished) {
        clearInterval(simInterval); isPlaying = false;
        if (btn) btn.textContent = '▶ Play';
        return;
      }
      // silent=true on the tick call so it doesn't stop for the normal
      // half-time pause (which is separate from the silentDeep/ET handling
      // above) — Finish Match should never stall waiting for another click.
      tick(true);
      updateStatsPanel();
    }, FF_MS);
  }
/*@CHUNK:c0195:END*/

/*@CHUNK:c0196:START*/

/*@CHUNK:c0196:END*/

/*@CHUNK:c0197:START*/
  function resetMatch() {
    clearInterval(simInterval); isPlaying = false; currentMatch = null;
    const setup = document.getElementById('match-setup');
    const live = document.getElementById('match-live');
    if (setup) setup.style.display = 'block';
    if (live) live.style.display = 'none';
    const mgBtn = document.getElementById('btn-career-manage');
    if (mgBtn) mgBtn.style.display = 'none';
    const mgPanel = document.getElementById('career-manage-panel');
    if (mgPanel) mgPanel.style.display = 'none';
  }
/*@CHUNK:c0197:END*/

/*@CHUNK:c0198:START*/

/*@CHUNK:c0198:END*/

/*@CHUNK:c0198a:START*/

  // ========== CONTEXTUAL ADDED TIME ==========
  // Real stoppage time isn't a flat random number — the fourth official
  // builds it up from what actually happened in the half: ball retrieved
  // from the net and the restart after every goal, the walk to the technical
  // area for every substitution, treatment/stretcher time for injuries, the
  // referee jogging to the pitchside monitor (or waiting on a check) for
  // every VAR review, cards taking a moment to brandish and log, and a
  // time-wasting allowance when fouls pile up late in the half (a leading
  // side "managing the clock"). This scans the half's own event log so two
  // otherwise-identical matches with different incident counts get
  // different, explainable stoppage totals instead of the same dice roll.
/*@CHUNK:c0198a:END*/

/*@CHUNK:c0198b:START*/
  function computeAddedTime(m, fromMin, toMin, capMinutes) {
    const evs = (m.events || []).filter(e => e.minute >= fromMin && e.minute <= toMin);
    const count = (type) => evs.filter(e => e.type === type).length;
    const goals = count('goal');
    const subs = count('sub');
    const injuries = count('injury');
    const varChecks = count('var');
    const cards = count('yellow') + count('red');
    // Late fouls/handballs (closing quarter of the half) read as a proxy for
    // a team managing — or wasting — the clock rather than genuine 50-50s.
    const lateWindow = Math.max(fromMin, toMin - 15);
    const lateFouls = evs.filter(e => (e.type === 'foul' || e.type === 'handball') && e.minute >= lateWindow).length;
    const lateCards = evs.filter(e => (e.type === 'yellow' || e.type === 'red') && e.minute >= lateWindow).length;

    const goalTime = goals * 0.5;                       // ball back to center circle + restart
    const celebrationTime = goals * 0.45 + evs.filter(e => e.type === 'goal' && e.minute >= lateWindow).length * 0.25; // mobbed-by-teammates time, longer for late/dramatic goals
    const subTime = subs * 0.4;                         // walk-off/walk-on + board held up
    const injuryTime = injuries * 1.6;                   // treatment or stretcher
    const varTime = varChecks * 1.1;                     // review + pitchside monitor
    const cardTime = cards * 0.15;                       // brandishing + logging the name
    const timeWastingTime = lateFouls * 0.25 + lateCards * 0.2; // clock management called out by the ref

    const raw = goalTime + celebrationTime + subTime + injuryTime + varTime + cardTime + timeWastingTime;
    // Every period gets its own realistic ceiling so added time — however
    // eventful the period was — can never run away toward infinity: a
    // 45-minute half can eat into a longer stoppage than a 15-minute
    // period of extra time reasonably would.
    const cap = capMinutes || 11;
    const minutes = Math.max(1, Math.min(cap, Math.round(raw)));
    return {
      minutes,
      breakdown: { goals, subs, injuries, var: varChecks, cards, timeWasting: lateFouls + lateCards }
    };
  }
/*@CHUNK:c0198b:END*/

/*@CHUNK:c0198c:START*/

  // Human-readable rundown of what built up a stoppage-time total, used in
  // the announcement event so the extra minutes feel earned rather than
  // arbitrary.
/*@CHUNK:c0198c:END*/

/*@CHUNK:c0198d:START*/
  function describeAddedTime(added) {
    const b = added.breakdown;
    const parts = [];
    if (b.goals) parts.push(b.goals + ' goal celebration' + (b.goals > 1 ? 's' : ''));
    if (b.subs) parts.push(b.subs + ' substitution' + (b.subs > 1 ? 's' : ''));
    if (b.injuries) parts.push(b.injuries + ' injury stoppage' + (b.injuries > 1 ? 's' : ''));
    if (b.var) parts.push(b.var + ' VAR check' + (b.var > 1 ? 's' : ''));
    if (b.cards) parts.push(b.cards + ' card' + (b.cards > 1 ? 's' : ''));
    if (b.timeWasting) parts.push('time-wasting');
    return parts.length ? parts.join(', ') : 'general stoppages';
  }
/*@CHUNK:c0198d:END*/

/*@CHUNK:c0198e:START*/

  // ========== MATCH-CLOCK DISPLAY ==========
  // m.minute is only the raw simulation tick — it never resets and just
  // keeps climbing straight through stoppage time, extra time and
  // penalties. Nothing shown to the person should read straight off it.
  // Instead every period (1st half, 2nd half, each period of extra time)
  // tracks its own start (periodStartRaw), its own regulation length
  // (periodDuration) and, once that length is reached, its own added/
  // stoppage time (periodStoppage) — computed once from the events that
  // actually happened in that period, then capped so it can never run
  // away. This turns the raw tick into a real match-clock label: the
  // second half resumes counting from 45', extra time resets to 90'
  // instead of continuing to climb past 100', and the second period of
  // extra time resets to 105'. Any added time within a period is always
  // shown as "<periodEnd>+<n>'", exactly like a real match clock.
  function updateMatchClock(m) {
    const elapsed = Math.max(0, m.minute - (m.periodStartRaw || 0));
    const dur = m.periodDuration || 45;
    const base = m.periodBaseDisplay || 0;
    if (elapsed <= dur) {
      m.dispMin = base + elapsed;
      m.dispLabel = m.dispMin + "'";
    } else {
      m.dispMin = base + dur;
      m.dispLabel = m.dispMin + '+' + (elapsed - dur) + "'";
    }
  }
/*@CHUNK:c0198e:END*/

/*@CHUNK:c0199:START*/
  function tick(silent) {
    if (!currentMatch || currentMatch.finished) return;
    const m = currentMatch;
    m.minute++;

    // A period transition (half time -> 2nd half, full time -> extra time,
    // end of the first period of extra time -> second period) is queued by
    // the code below rather than applied immediately, so it activates right
    // here, on the first tick of the new period. That's what makes the
    // match-clock genuinely restart — 45' for the second half, 90' for
    // extra time, 105' for its second period — instead of continuing to
    // climb from wherever the previous period's stoppage time left off.
    if (m.pendingPeriod) {
      const p = m.pendingPeriod;
      m.pendingPeriod = null;
      m.period = p.period;
      m.periodStartRaw = m.minute;
      m.periodBaseDisplay = p.base;
      m.periodDuration = p.duration;
      m.periodStoppage = null;
      m.status = p.status;
      if (p.announce) addEvent(m.minute, p.announceType || 'whistle', p.announce, null);
    }
    updateMatchClock(m);

    // ===== First half =====
    if (m.period === 'H1') {
      const elapsed = m.minute - m.periodStartRaw;
      if (elapsed >= m.periodDuration) {
        if (m.periodStoppage == null) {
          const added = computeAddedTime(m, m.periodStartRaw + 1, m.periodStartRaw + m.periodDuration, 6);
          m.periodStoppage = added.minutes;
          addEvent(m.minute, 'whistle', `📋 ${added.minutes} minute${added.minutes === 1 ? '' : 's'} of first-half stoppage time signalled: ${describeAddedTime(added)}`, null);
          updateMatchClock(m);
        }
        m.status = 'Stoppage Time';
        if (elapsed >= m.periodDuration + m.periodStoppage) {
          m.status = 'Half Time';
          addEvent(m.minute, 'whistle', '—— HALF TIME ——', null);
          addEvent(m.minute, 'whistle', 'Tap Play to start 2nd half', null);
          m.pendingPeriod = { period: 'H2', base: 45, duration: 45, status: '2nd Half', announce: 'Second half begins' };
          updateScoreboard();
          // Pause at half time (unless turbo finish) — either way the next
          // tick() call is what actually kicks off the second half.
          if (!silent) {
            clearInterval(simInterval);
            isPlaying = false;
            const btn = document.getElementById('btn-play');
            if (btn) btn.textContent = '▶ 2nd Half';
          }
          return;
        }
      }
    }

    // ===== Second half =====
    if (m.period === 'H2' && !m.inET && !m.inPens && !m._awaitingET) {
      const elapsed = m.minute - m.periodStartRaw;
      if (elapsed >= m.periodDuration) {
        if (m.periodStoppage == null) {
          const added = computeAddedTime(m, m.periodStartRaw + 1, m.periodStartRaw + m.periodDuration, 11);
          m.periodStoppage = added.minutes;
          addEvent(m.minute, 'whistle', `📋 ${added.minutes} minute${added.minutes === 1 ? '' : 's'} of stoppage time signalled: ${describeAddedTime(added)}`, null);
          updateMatchClock(m);
        }
        m.status = 'Stoppage Time';
        if (elapsed >= m.periodDuration + m.periodStoppage) {
          // Two-legged ties (see simTwoLegTie in simulation/tournamentEngine.js)
          // pass aggHomeStart/aggAwayStart — the goals already banked from leg
          // 1 — so a tie can go to extra time even when THIS leg alone isn't
          // level, as long as the tie is level on aggregate (real UEFA rule
          // since the away-goals rule was scrapped in 2021). For a single-leg
          // match (domestic cups, World Cup, the Final) both start at 0, so
          // this is identical to the old plain m.home.score === m.away.score
          // check.
          const drawn = (m.home.score + (m.aggHomeStart || 0)) === (m.away.score + (m.aggAwayStart || 0));
          if (drawn && (m.allowET || m.allowPens)) {
            // Instant/bulk sims have no one to click the prompt, so resolve
            // immediately instead of stalling on a prompt nobody can answer.
            if (m.silentDeep) {
              addEvent(m.minute, 'whistle', `Full time ${m.home.team.short} ${m.home.score}-${m.away.score} ${m.away.team.short} — scores level`, null);
              if (m.allowET) {
                m.inET = true;
                m.status = 'Extra Time (1st Half)';
                addEvent(m.minute, 'et', 'Extra time begins — two periods of 15 minutes', null);
                m.pendingPeriod = { period: 'ET1', base: 90, duration: 15, status: 'Extra Time (1st Half)' };
              } else {
                runPenaltyShootout();
              }
              return;
            }
            // Pause — user chooses to continue to ET / pens
            m._awaitingET = true;
            m.status = 'Full Time';
            addEvent(m.minute, 'whistle', `Full time ${m.home.team.short} ${m.home.score}-${m.away.score} ${m.away.team.short} — scores level`, null);
            clearInterval(simInterval); isPlaying = false;
            const btn = document.getElementById('btn-play');
            if (btn) btn.textContent = '▶ Play';
            updateScoreboard();
            showETPrompt(drawn);
            return;
          }
          endMatch();
          return;
        }
      }
    }

    // ===== Extra time, first period (restarts the clock at 90') =====
    if (m.period === 'ET1' && !m.inPens) {
      const elapsed = m.minute - m.periodStartRaw;
      if (elapsed >= m.periodDuration) {
        if (m.periodStoppage == null) {
          const added = computeAddedTime(m, m.periodStartRaw + 1, m.periodStartRaw + m.periodDuration, 3);
          m.periodStoppage = added.minutes;
          addEvent(m.minute, 'et', `📋 ${added.minutes} minute${added.minutes === 1 ? '' : 's'} added at the end of the first half of extra time`, null);
          updateMatchClock(m);
        }
        m.status = 'Stoppage Time (ET)';
        if (elapsed >= m.periodDuration + m.periodStoppage) {
          // Half time of extra time, at 105' — mirrors the normal half-time
          // break (paused for a live match, seamless for a fast/silent sim).
          m.status = 'Half Time (ET)';
          addEvent(m.minute, 'et', '—— END OF THE FIRST HALF OF EXTRA TIME ——', null);
          addEvent(m.minute, 'et', 'Tap Play to start the second half of extra time', null);
          m.pendingPeriod = { period: 'ET2', base: 105, duration: 15, status: 'Extra Time (2nd Half)', announce: 'Second half of extra time begins', announceType: 'et' };
          updateScoreboard();
          if (!silent) {
            clearInterval(simInterval);
            isPlaying = false;
            const btn = document.getElementById('btn-play');
            if (btn) btn.textContent = '▶ 2nd Half (ET)';
          }
          return;
        }
      }
      if (seededRandom() < 0.0025) tryInjury(seededRandom() < 0.5 ? 'home' : 'away');
    }

    // ===== Extra time, second period (restarts the clock at 105', usually
    // ends at 120' — but, like every other period here, can run a little
    // long on added time, never indefinitely) =====
    if (m.period === 'ET2' && !m.inPens) {
      const elapsed = m.minute - m.periodStartRaw;
      if (elapsed >= m.periodDuration) {
        if (m.periodStoppage == null) {
          const added = computeAddedTime(m, m.periodStartRaw + 1, m.periodStartRaw + m.periodDuration, 3);
          m.periodStoppage = added.minutes;
          addEvent(m.minute, 'et', `📋 ${added.minutes} minute${added.minutes === 1 ? '' : 's'} added at the end of extra time`, null);
          updateMatchClock(m);
        }
        m.status = 'Stoppage Time (ET)';
        if (elapsed >= m.periodDuration + m.periodStoppage) {
          // Same aggregate-aware check as the full-time draw check above —
          // still level on aggregate after extra time means penalties,
          // even if this leg alone finished ahead/behind on the night.
          const stillDrawn = (m.home.score + (m.aggHomeStart || 0)) === (m.away.score + (m.aggAwayStart || 0));
          if (stillDrawn && m.allowPens) {
            if (m.silentDeep) {
              addEvent(m.minute, 'et', 'Extra time finished — still level. Straight to penalties.', null);
              runPenaltyShootout();
              return;
            }
            m._awaitingPens = true;
            m.status = 'ET Full Time';
            addEvent(m.minute, 'et', 'Extra time finished — still level. Penalty shootout?', null);
            clearInterval(simInterval); isPlaying = false;
            const btn = document.getElementById('btn-play');
            if (btn) btn.textContent = '▶ Play';
            updateScoreboard();
            showETPrompt(true, true);
            return;
          }
          endMatch();
          return;
        }
      }
      if (seededRandom() < 0.0025) tryInjury(seededRandom() < 0.5 ? 'home' : 'away');
    }

    generateEvents();
    updateFatigue();
    runTacticalAI();
    // Substitutions: aim for at least 3 per team (max 5). Uses the display
    // minute (m.dispMin), not the raw tick, so a first-half that ran long
    // on stoppage time can't nudge this window earlier or later than it
    // should be.
    if (m.dispMin >= 55 && m.dispMin <= 88 && !m.inET) {
      const homeDiff = (m.home.score || 0) - (m.away.score || 0);
      const awayDiff = -homeDiff;
      const needHome = (m.homeSubsUsed || 0) < 3;
      const needAway = (m.awaySubsUsed || 0) < 3;
      const windowLeft = Math.max(1, 88 - m.dispMin);
      // Higher urgency if still below 3
      let pHome = needHome ? Math.min(0.55, 0.12 + (3 - m.homeSubsUsed) * 0.12 / windowLeft * 8) : 0.06;
      let pAway = needAway ? Math.min(0.55, 0.12 + (3 - m.awaySubsUsed) * 0.12 / windowLeft * 8) : 0.06;
      if (m.dispMin >= 70) { pHome *= 1.3; pAway *= 1.3; }
      // A team chasing the game brings changes on earlier and more urgently;
      // one comfortably ahead can afford to take its time — so subs stop
      // landing on a flat, identical clock every match.
      if (homeDiff <= -1) pHome *= (homeDiff <= -2 ? 1.6 : 1.3);
      else if (homeDiff >= 2) pHome *= 0.75;
      if (awayDiff <= -1) pAway *= (awayDiff <= -2 ? 1.6 : 1.3);
      else if (awayDiff >= 2) pAway *= 0.75;
      // Fatigue nudges timing too — a visibly gassed side brings changes
      // earlier than the scoreline-only read above would suggest.
      if (teamAvgStamina('home') < 55) pHome *= 1.25;
      if (teamAvgStamina('away') < 55) pAway *= 1.25;
      // Career Mode: the AI never auto-substitutes for the side the person
      // is manually managing — subs for that side only ever come from
      // manualSubstitute() via the Manage panel (see ui/matchUI.js).
      if (m.userSide !== 'home' && seededRandom() < pHome) trySubstitution('home');
      if (m.userSide !== 'away' && seededRandom() < pAway) trySubstitution('away');
    }
    // Late forced catch-up so each side reaches 3 if possible
    if (m.dispMin === 80 || m.dispMin === 84 || m.dispMin === 87) {
      if (m.userSide !== 'home' && (m.homeSubsUsed || 0) < 3) trySubstitution('home');
      if (m.userSide !== 'away' && (m.awaySubsUsed || 0) < 3) trySubstitution('away');
    }
    if (seededRandom() < 0.0015) tryInjury(seededRandom() < 0.5 ? 'home' : 'away');
    updateScoreboard();
    if (!silent) updateStatsPanel();
    // Keep the live pitch view's dynamic player markers moving in step with
    // the simulation — same quietSim guard every other per-tick render uses
    // (bulk/instant sims skip this entirely, see simToEnd()).
    if (!m.quietSim) renderPitch();
  }
/*@CHUNK:c0199:END*/

/*@CHUNK:c0224:START*/

  // ===== Secondary match texture: set pieces / handballs / VAR that the =====
  // ===== headline possession pipeline above doesn't already cover, kept at
  // a low independent rate so cards/set-pieces still accumulate realistically
  // without duplicating shots the pipeline already generated this minute.
/*@CHUNK:c0224:END*/

/*@CHUNK:c0225:START*/
  function maybeSecondaryMatchEvent() {
    const m = currentMatch;
    if (!m || seededRandom() > 0.22) return;
    const side = seededRandom() < 0.5 ? 'home' : 'away';
    const defSide = side === 'home' ? 'away' : 'home';
    const attTeam = m[side], defTeam = m[defSide];
    const roll = seededRandom();
    // Roll shares below were rebalanced to bring fouls/cards/handballs down
    // to realistic per-match volume: free-kick, handball, and VAR-review
    // shares are all cut well back from their original width (they were
    // independently stacking on top of the turnover-based fouls in
    // transitions.js and producing far more cards/reds than a real match),
    // with the freed-up probability mass handed to the non-foul texture
    // events (throw-ins/goal-kicks/misc) so the overall "something happens"
    // rate this function fires at is unchanged.
    if (roll < 0.10) {
      // Direct free-kick — always the consequence of an actual, logged foul
      // (never conjured out of nowhere). The fouler is picked from the
      // defending side committing a midfield/wide challenge, resolveFoul
      // handles the real foul/card bookkeeping, and only if that foul left
      // the taking side with a genuine dangerous set-piece (and didn't just
      // end in a red card stopping play) does a routine get taken —
      // resolveFreeKickRoutine (engine/setpieces.js) then picks between a
      // direct strike, a quick restart, a crossed delivery, a short
      // link-up, or an indirect routine inside the box.
      const fouler = pickPlayer(defTeam, ['CM', 'CDM', 'CB', 'RB', 'LB', 'RWB', 'LWB']);
      const victim = pickPlayer(attTeam, ['CAM', 'CM', 'ST', 'RW', 'LW']);
      if (fouler) {
        const result = resolveFoul(defSide, side, fouler, victim, false);
        if (result && result.outcome !== 'red' && result.outcome !== 'penalty' && seededRandom() < 0.35) {
          const closeRange = seededRandom() < 0.45;
          resolveFreeKickRoutine(side, defSide, closeRange);
        }
      }
    } else if (roll < 0.27) {
      // Throw-in — normal, long, or a tactical retaining throw. Whichever
      // side is more naturally in possession here is picked at random
      // (the possession pipeline above already decides the headline
      // sequence each minute, so this is deliberately independent texture).
      resolveThrowIn(seededRandom() < 0.5 ? side : defSide);
    } else if (roll < 0.44) {
      // Goal kick — taken by the side that was defending this passage,
      // short/medium/long distribution via resolveGoalKick (engine/setpieces.js).
      resolveGoalKick(defSide);
    } else if (roll < 0.49) {
      // Handball — genuinely rare in a real match (most matches see zero or
      // one shout), and the vast majority of shouts are just a regular
      // foul; only a small share are actually given as a penalty. The
      // commentary always matches what's actually awarded instead of
      // asserting a penalty and then only sometimes delivering one.
      const p = pickPlayer(defTeam, ['CB', 'RB', 'LB', 'CDM', 'ST']);
      if (p) {
        const nearBox = seededRandom() < 0.45;
        const givenAsPen = nearBox && seededRandom() < 0.22;
        if (givenAsPen) {
          addEvent(m.minute, 'handball', `Handball against <span class="player">${p.name}</span> — referee points to the spot!`, defSide);
          resolveFoul(defSide, side, p, null, true, true);
        } else {
          addEvent(m.minute, 'handball', `Appeal for handball against <span class="player">${p.name}</span>${nearBox ? ' waved away' : ' — referee says ball to hand'}`, defSide);
          resolveFoul(defSide, side, p, null, false);
        }
      }
    } else if (roll < 0.55) {
      // VAR — red-card review, most of which correctly confirm there's no
      // red. The straight-red outcome is now a genuine rarity (a real
      // match seeing a VAR-overturned red is a notable, not routine,
      // event) and still runs through the same card bookkeeping as any
      // other red so fouls/cards stats stay consistent.
      const player = pickPlayer(defTeam, ['CB', 'ST', 'CDM', 'CM']);
      addEvent(m.minute, 'var', `📺 VAR checking possible red card (${defTeam.team.short})...`, defSide);
      if (player && seededRandom() < 0.05) {
        defTeam.stats.fouls++;
        if (!m.foulCounts) m.foulCounts = { home: {}, away: {} };
        m.foulCounts[defSide][player.id] = (m.foulCounts[defSide][player.id] || 0) + 1;
        defTeam.stats.reds++;
        recordStat('cards', player, defTeam.team);
        recordStat('reds', player, defTeam.team);
        if (!m.playerMatchStats) m.playerMatchStats = {};
        if (!m.playerMatchStats[player.id]) m.playerMatchStats[player.id] = blankPlayerMatchStats(player);
        m.playerMatchStats[player.id].red = true;
        addEvent(m.minute, 'red', `VAR: Red card! <span class="player">${player.name}</span> (${defTeam.team.short}) sent off`, defSide);
        removeFromPitch(defSide, player.id);
        handleRedCardReshuffle(defSide, player);
      } else {
        const noRedLines = [
          `VAR: No red card — challenge by ${player ? player.name : 'the defender'} was mistimed but not violent conduct`,
          `VAR: Yellow card only — ${player ? player.name : 'player'} caught the man, not excessive force`,
          `VAR: On-field decision stands — no red card for ${player ? player.name : 'the defender'}`
        ];
        addEvent(m.minute, 'var', noRedLines[Math.floor(seededRandom() * noRedLines.length)], defSide);
        if (player && seededRandom() < 0.35 && (m.cards[defSide][player.id] || 0) < 1) {
          m.cards[defSide][player.id] = (m.cards[defSide][player.id] || 0) + 1;
          defTeam.stats.yellows++;
          recordStat('yellows', player, defTeam.team);
          if (!m.playerMatchStats) m.playerMatchStats = {};
          if (!m.playerMatchStats[player.id]) m.playerMatchStats[player.id] = blankPlayerMatchStats(player);
          m.playerMatchStats[player.id].yellow = true;
          addEvent(m.minute, 'yellow', `${emojiImg('yellow_card', 'Yellow card')} Yellow card — <span class="player">${player.name}</span> booked after VAR review`, defSide);
        }
      }
    } else if (roll < 0.78) {
      const att = pickPlayer(attTeam, ['ST', 'CAM', 'RW', 'LW', 'CM']);
      const def = pickPlayer(defTeam, ['CB', 'RB', 'LB', 'CDM']);
      const rare = seededRandom();
      if (rare < 0.2) {
        addEvent(m.minute, 'whistle', `Rain starts to lash the pitch — footing becomes tricky`, null);
      } else if (rare < 0.4 && def) {
        if (!m.playerMatchStats) m.playerMatchStats = {};
        if (!m.playerMatchStats[def.id]) m.playerMatchStats[def.id] = blankPlayerMatchStats(def);
        m.playerMatchStats[def.id].tackles = (m.playerMatchStats[def.id].tackles || 0) + 1;
        const tackleFlavor = styleFlavor(def, TACKLE_FLAVOR) || 'times a sliding tackle to perfection on the edge of the box';
        addEvent(m.minute, 'tackle', `<span class="player">${def.name}</span> ${tackleFlavor}`, defSide);
      } else if (rare < 0.6 && att) {
        const passFlavor = styleFlavor(att, THROUGH_BALL_FLAVOR) || 'threads a defence-splitting ball into the channel';
        addEvent(m.minute, 'pass', `<span class="player">${att.name}</span> ${passFlavor}`, side);
      } else if (rare < 0.8) {
        const gk = pickPlayer(defTeam, ['GK']);
        if (gk) {
          defTeam.stats.saves++;
          recordStat('saves', gk, defTeam.team);
          if (!m.playerMatchStats) m.playerMatchStats = {};
          if (!m.playerMatchStats[gk.id]) m.playerMatchStats[gk.id] = blankPlayerMatchStats(gk);
          m.playerMatchStats[gk.id].saves = (m.playerMatchStats[gk.id].saves || 0) + 1;
          addEvent(m.minute, 'save', `<span class="player">${gk.name}</span> rushes off the line to smother a through ball`, defSide);
        }
      } else {
        addEvent(m.minute, 'whistle', `The crowd sense a goal — noise levels rise as ${attTeam.team.short} advance`, null);
      }
    } else {
      const lines = [
        `${attTeam.team.short} recycle possession in the final third`,
        `${attTeam.team.short} work an opening down the flank`,
        `Patient build-up from ${attTeam.team.short}`,
        `${defTeam.team.short} hold a high line under pressure`,
        `Cross claimed comfortably — ${defTeam.team.short} clear`
      ];
      addEvent(m.minute, 'pressure', lines[Math.floor(seededRandom() * lines.length)], side);
    }
  }
/*@CHUNK:c0225:END*/

/*@CHUNK:c0226:START*/

  // ===== Top-level per-minute orchestrator: Possession phase decides who =====
  // ===== gets this minute's headline sequence, then hands off to the
  // Zones->Movement->Passing->Duels->Transitions->Chance->Shots->GK pipeline.
/*@CHUNK:c0226:END*/

/*@CHUNK:c0227:START*/
  function generateEvents() {
    const m = currentMatch;
    if (!m) return;

    // ---- Background per-minute stat accumulation (pass volume + off-ball
    // defensive activity), independent of which side wins the headline
    // sequence below — this is what keeps every outfield player's pass/
    // tackle counts building up realistically across 90 minutes.
    simulateMinutePassing();
    simulateDefensiveActions();
    simulateRoutineFouls();

    const homeStr = calcTeamStrength(m.home);
    const awayStr = calcTeamStrength(m.away);
    const homeMods = getPlaystyleMods(m.home.team);
    const awayMods = getPlaystyleMods(m.away.team);

    // ===== Possession phase: which side's build-up is this minute's =====
    // ===== headline sequence? Driven by attacking quality vs the opponent's
    // defensive quality, run through a logistic curve so a genuine quality
    // gap (a title contender's front line vs a relegation-battler's back
    // line) shows up clearly over 90 minutes/a season, while a small home
    // nudge and a soft floor/ceiling keep upsets possible.
    const mgrEdge = (homeStr.mgr - awayStr.mgr) * 0.15;
    let homeCreate = homeStr.att * 0.62 + (100 - awayStr.def) * 0.28 + homeStr.ovr * 0.10;
    let awayCreate = awayStr.att * 0.62 + (100 - homeStr.def) * 0.28 + awayStr.ovr * 0.10;
    // Game-state realism: a team chasing the game late pushes players forward
    // and creates more (higher risk, higher reward); one nursing a lead sits in.
    if ((m.dispMin != null ? m.dispMin : m.minute) > 55) {
      const dm = m.dispMin != null ? m.dispMin : m.minute;
      const diff = (m.home.score || 0) - (m.away.score || 0);
      const urgency = Math.min(1, (dm - 55) / 35);
      if (diff <= -1) homeCreate += Math.min(10, Math.abs(diff) * 4) * urgency;
      else if (diff >= 1) homeCreate -= Math.min(6, diff * 2.5) * urgency;
      if (diff >= 1) awayCreate += Math.min(10, diff * 4) * urgency;
      else if (diff <= -1) awayCreate -= Math.min(6, Math.abs(diff) * 2.5) * urgency;
    }
    const HOME_ADV = 4.0;
    const jitter = (seededRandom() - 0.5) * 7; // real ebb-and-flow, not a static edge all 90 minutes
    const qualityGap = (homeCreate - awayCreate) + HOME_ADV + mgrEdge + jitter;
    let homeChance = 1 / (1 + Math.exp(-qualityGap / 13));
    homeChance = Math.min(0.90, Math.max(0.10, homeChance));

    // Possession % derived from actual completed-pass share (like real match
    // data providers compute it), tugged toward the side with the real
    // ball-control edge and smoothed minute to minute.
    const hp = m.home.stats.passes || 0, ap = m.away.stats.passes || 0;
    const passShareTarget = (hp + ap) > 0 ? 100 * hp / (hp + ap) : 50;
    const ctrlBias = Math.max(-14, Math.min(14, (((homeStr.tec * 0.55 + homeStr.ovr * 0.25 + (homeStr.mgr || 75) * 0.20)
      - (awayStr.tec * 0.55 + awayStr.ovr * 0.25 + (awayStr.mgr || 75) * 0.20)) * 0.9) + 1.5));
    const styleBias = Math.max(-8, Math.min(8, (homeMods.possBias - awayMods.possBias) * 0.5));
    const target = Math.max(20, Math.min(80, passShareTarget * 0.62 + (50 + ctrlBias + styleBias) * 0.38));
    m.possession = m.possession + (target - m.possession) * 0.16 + (seededRandom() - 0.5) * 1.2;
    m.possession = Math.max(18, Math.min(82, m.possession));
    m.home.stats.possession = Math.round(m.possession);
    m.away.stats.possession = 100 - m.home.stats.possession;

    // Stronger teams create more moments — some minutes are just quiet.
    const intensity = 0.42 + (homeStr.ovr + awayStr.ovr) / 500;
    if (seededRandom() > intensity) {
      if (seededRandom() < 0.08) {
        const side = seededRandom() < 0.5 ? m.home : m.away;
        const p = pickPlayer(side, ['CM', 'CDM', 'CAM', 'CB']);
        if (p) {
          const quiet = [
            `<span class="player">${p.name}</span> recycles possession calmly`,
            `<span class="player">${p.name}</span> breaks up the play and resets`,
            `<span class="player">${p.name}</span> switches the point of attack`,
            `<span class="player">${p.name}</span> finds a teammate under no pressure`,
            `Spell of possession — <span class="player">${p.name}</span> dictates the tempo`
          ];
          addEvent(m.minute, 'pass', quiet[Math.floor(seededRandom() * quiet.length)], side === m.home ? 'home' : 'away');
        }
      }
      maybeSecondaryMatchEvent();
      return;
    }

    // ===== Hand off to the phase pipeline: Zones -> Movement -> Passing -> =====
    // ===== Duels -> Transitions -> Chance Creation -> Shots -> GK, all
    // shaped by real player attributes and each side's tactics/playstyle.
    const attackingSide = seededRandom() < homeChance ? 'home' : 'away';
    runPossessionSequence(attackingSide);

    // Occasional independent texture (set pieces / cards / VAR) at a low
    // rate so the match keeps its color beyond just the headline sequence.
    maybeSecondaryMatchEvent();
  }
/*@CHUNK:c0227:END*/

/*@CHUNK:c0230:START*/

/*@CHUNK:c0230:END*/

/*@CHUNK:c0231:START*/
  function calcTeamStrength(side) {
    if (!currentMatch || !side) return { att: 50, def: 50, tec: 50, gk: 70 };
    const isHome = side === currentMatch.home;
    const ids = isHome ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    const onPitch = (side.squad.all || []).filter(p => ids.includes(p.id));
    if (!onPitch.length) return { att: 50, def: 50, tec: 50, gk: 70 };
    const mgr = (side.team.manager && side.team.manager.ovr) || 75;
    const pmods = getPlaystyleMods(side.team);
    const avg = (key, fallback) => onPitch.reduce((s, p) => s + (p[key] != null ? p[key] : fallback), 0) / onPitch.length;
    // ---- Positional weighting: att/def are no longer a flat average across
    // every player on the pitch (which let a GK/CB weigh in on attacking
    // strength exactly as much as a striker, and a striker drag down
    // defensive strength exactly as much as a center-back). Each player's
    // contribution is scaled by posAttWeight()/posDefWeight() (js/state.js),
    // keyed off the slot he's actually deployed in this match — a striker's
    // finishing now drives attacking strength, a center-back's defending
    // now drives defensive strength, and the goalkeeper contributes 0 to
    // both (his shot-stopping is the separate `gk` field below instead).
    // Falls back to a even split if, somehow, every weight comes back 0
    // (e.g. a side stuck with only its GK on the pitch).
    const weightedAvg = (statKey, weightFn, fallback) => {
      let wSum = 0, vSum = 0;
      onPitch.forEach(p => {
        const w = weightFn(p);
        wSum += w;
        vSum += w * (p[statKey] != null ? p[statKey] : fallback);
      });
      return wSum > 0 ? vSum / wSum : avg(statKey, fallback);
    };
    // Small, realistic home-field boost — crowd support and matchday familiarity
    // lift a side's sharpness a touch, on both ends of the pitch.
    const homeBoostAtt = isHome ? 1.2 : 0;
    const homeBoostDef = isHome ? 1.0 : 0;
    // ---- Formation shape now feeds directly into team strength: an
    // attack-heavy formation (extra forwards/wide bodies) lifts att at the
    // cost of def, a defensive shape (extra CBs/wing-backs, fewer forwards)
    // does the reverse, and a midfield-heavy shape nudges control (tec).
    const shape = formationShape(side.squad && side.squad.formation);
    const attShape = (shape.fwd - SHAPE_BASELINE.fwd) * 1.6 + (shape.mid - SHAPE_BASELINE.mid) * 0.25;
    const defShape = (shape.def - SHAPE_BASELINE.def) * 1.7 - (shape.fwd - SHAPE_BASELINE.fwd) * 0.35 + (shape.mid - SHAPE_BASELINE.mid) * 0.15;
    const midShape = (shape.mid - SHAPE_BASELINE.mid) * 0.4;
    // The goalkeeper's own shot-stopping contribution, entirely separate
    // from the outfield att/def numbers above (see gkShotStoppingRating()
    // in engine/goalkeeper.js).
    const gk = activeGoalkeeper(isHome ? 'home' : 'away');
    return {
      // Manager overall now carries real weight: a top tactician visibly lifts
      // both ends of the pitch, a poor one visibly drags them down.
      att: weightedAvg('att', posAttWeight, 70) + (mgr - 75) * 0.18 + pmods.attBonus + homeBoostAtt + attShape,
      def: weightedAvg('def', posDefWeight, 70) + (mgr - 75) * 0.16 + pmods.defBonus + homeBoostDef + defShape,
      tec: avg('tec', 70) + midShape,
      ovr: avg('ovr', 75),
      phy: avg('phy', 70),
      pac: avg('pac', 70),
      mgr: mgr,
      shape: shape,
      gk: gkShotStoppingRating(gk)
    };
  }
/*@CHUNK:c0231:END*/

/*@CHUNK:c0264:START*/

/*@CHUNK:c0264:END*/

/*@CHUNK:c0265:START*/
  function endMatch() {
    const m = currentMatch;
    if (!m) return;
    m.finished = true;
    if (!m.inET && !m.inPens) { m.status = 'Full Time'; if ((m.dispMin || 0) < 90) m.dispMin = 90; }
    else if (m.inPens) m.status = 'FT (Pens)';
    else { m.status = 'Full Time (ET)'; if ((m.dispMin || 0) < 120) m.dispMin = 120; }
    m.dispLabel = m.inPens ? 'Pens' : (m.dispLabel && parseInt(m.dispLabel, 10) >= (m.dispMin || 0) ? m.dispLabel : m.dispMin + "'");
    clearInterval(simInterval); isPlaying = false;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = '▶ Play';
    try { renderMomentumAndHeat, showLoading, hideLoading, refreshTournamentStatsUI(); } catch(e) {}
    if (tournament) { try { refreshTournamentStatsUI(); } catch(e) {} }
    addEvent(m.minute || 90, 'whistle', `Full Time! ${m.home.team.short} ${m.home.score} - ${m.away.score} ${m.away.team.short}`, null);
    // Clean sheet credit: the goalkeeper always qualified for this (as
    // before), but a clean sheet is a back-line achievement, not just a
    // keeper one — the back four/five (CB/RB/LB/RWB/LWB) who were actually
    // on the pitch at full time share the credit too. This used to be
    // GK-only, which meant a defender's own stat line — and the
    // Defenders' Award, which scores clean sheets alongside interceptions
    // and tackles (see the 'defenders' branch in ui/statisticsUI.js) —
    // could never actually reflect the clean sheets they helped keep.
    // The eligible-id sets computed here are reused below (see
    // homeCleanSheetIds/awayCleanSheetIds) to also set the per-match
    // ps.cleanSheet flag that calcPlayerRating reads for its GK/defender
    // breakout-rating check.
    function cleanSheetEligibleIds(side) {
      const onPitchIds = side === 'home' ? (m.homeOnPitch || []) : (m.awayOnPitch || []);
      const allSquad = (m[side].squad && m[side].squad.all) || [];
      const ids = new Set();
      // Whoever is actually in goal at the final whistle — not just
      // whichever GK started the match. squad.starting never changes once
      // the teamsheet is set, so a sent-off keeper (removed from onPitchIds
      // by removeFromPitch(), see engine/injuries.js) still showed up here
      // and picked up a clean-sheet credit for a match he didn't finish,
      // while a substitute keeper who came on and actually saw it through
      // got nothing. Filtering on onPitchIds fixes both sides of that at
      // once: it naturally resolves to the sub if one came on, and to
      // nobody at all if the team's had to finish with an outfield
      // stand-in (activeGoalkeeper() in this file) rather than a specialist.
      const gk = allSquad.find(p => onPitchIds.includes(p.id) && (p.pos || []).includes('GK'));
      if (gk) ids.add(gk.id);
      allSquad.forEach(p => {
        if (onPitchIds.includes(p.id) && (p.pos || []).some(pos => ['CB','RB','LB','RWB','LWB'].includes(pos))) ids.add(p.id);
      });
      return ids;
    }
    const homeCleanSheetIds = m.away.score === 0 ? cleanSheetEligibleIds('home') : new Set();
    const awayCleanSheetIds = m.home.score === 0 ? cleanSheetEligibleIds('away') : new Set();
    homeCleanSheetIds.forEach(id => {
      const p = (m.home.squad.all || []).find(x => x.id === id);
      if (p) recordStat('cleanSheets', p, m.home.team);
    });
    awayCleanSheetIds.forEach(id => {
      const p = (m.away.squad.all || []).find(x => x.id === id);
      if (p) recordStat('cleanSheets', p, m.away.team);
    });
    // Compute ratings for everyone who played, then MOTM = highest rating
    if (!m.playerMatchStats) m.playerMatchStats = {};
    // Flag this match as a "big game" (knockout-stage/final, or two top-tier
    // sides going at it) once, up front, so every recordRating() call below
    // for this match consistently feeds the bigGames award-scoring bucket.
    m.isBigGame = isBigGameContext(m);
    const allOnPitch = [...(m.home.squad.starting||[]), ...(m.away.squad.starting||[])];
    // Include subs who came on
    const onIds = new Set([...(m.homeOnPitch||[]), ...(m.awayOnPitch||[])]);
    const allInvolved = [...(m.home.squad.all||[]), ...(m.away.squad.all||[])].filter(p =>
      onIds.has(p.id) || allOnPitch.some(s => s.id === p.id) || (m.playerMatchStats[p.id] && (
        m.playerMatchStats[p.id].goals || m.playerMatchStats[p.id].assists || m.playerMatchStats[p.id].shots || m.playerMatchStats[p.id].saves
      ))
    );
    const pool = allInvolved.length ? allInvolved : allOnPitch;
    pool.forEach(p => {
      if (!m.playerMatchStats[p.id]) m.playerMatchStats[p.id] = blankPlayerMatchStats(p);
      const ps = m.playerMatchStats[p.id];
      // Ensure pos info for rating formula
      if (!ps.posArr || !ps.posArr.length) ps.posArr = p.pos || [];
      if (!ps.pos) ps.pos = p.slot || (p.pos||[])[0] || '';
      if (!ps.slot) ps.slot = p.slot || ps.pos;
      // Clean sheet flag for GK rating, and goals conceded for GK/DEF/MID
      // rating penalty (see calcPlayerRating) — both come from the actual
      // final scoreline, keyed off which side this player was on.
      const concededSide = (m.home.squad.all||[]).find(x => x.id === p.id) ? 'home' : 'away';
      ps.goalsConceded = concededSide === 'home' ? m.away.score : m.home.score;
      // Same eligibility (GK + on-pitch back line) as the season clean-sheet
      // stat recorded above, so the per-match rating flag and the
      // season/career leaderboard count never disagree about who kept it.
      const csIds = concededSide === 'home' ? homeCleanSheetIds : awayCleanSheetIds;
      if (csIds.has(p.id)) ps.cleanSheet = true;
      // Rating uses a small activity floor for players who genuinely played
      // but happened to see very little of the ball (e.g. a sub on for the
      // last few minutes) so they don't get an unfairly harsh 0-stat rating.
      // Crucially this floor is applied to a throwaway copy used only for
      // the rating formula — it never touches the real ps.saves/tackles/
      // passes fields that the stats panel, match report, and leaderboards
      // read from, so those always stay exactly in sync with what actually
      // happened (and was reported) in the match.
      let ratingInput = ps;
      if (onIds.has(p.id)) {
        const pos = (ps.pos || '').toUpperCase();
        const isGK = pos === 'GK' || (ps.posArr||[]).includes('GK');
        const isDef = ['CB','RB','LB','RWB','LWB'].some(x => pos.includes(x) || (ps.posArr||[]).includes(x));
        const isMid = ['CM','CDM','CAM','RM','LM'].some(x => pos.includes(x) || (ps.posArr||[]).includes(x));
        const floors = isGK ? { saves: ps.saves > 0 ? ps.saves : 1, passes: ps.passes > 0 ? ps.passes : 6, passesCompleted: ps.passes > 0 ? ps.passesCompleted : 5 }
          : isDef ? { tackles: ps.tackles > 0 ? ps.tackles : 2, passes: ps.passes > 0 ? ps.passes : 12, passesCompleted: ps.passes > 0 ? ps.passesCompleted : 10 }
          : isMid ? { tackles: ps.tackles > 0 ? ps.tackles : 1, passes: ps.passes > 0 ? ps.passes : 18, passesCompleted: ps.passes > 0 ? ps.passesCompleted : 15 }
          : { passes: ps.passes > 0 ? ps.passes : 8, passesCompleted: ps.passes > 0 ? ps.passesCompleted : 6 };
        ratingInput = Object.assign({}, ps, floors);
      }
      // Big Occasion Riser reads these two off the ratingInput copy inside
      // calcPlayerRating — never mutates the real ps object.
      ratingInput = Object.assign({}, ratingInput, {
        isBigGame: m.isBigGame,
        personality: (p.expandedAttrs && p.expandedAttrs.personality) || []
      });
      ps.rating = calcPlayerRating(ratingInput);
      const teamObj = (m.home.squad.all||[]).find(x=>x.id===p.id) ? m.home.team : m.away.team;
      recordRating(p, teamObj, ps.rating);
      // Nudge this player's persistent form (and therefore their effective
      // OVR) based on how they actually played in this match — the real
      // roster player, not the shallow per-match squad clone, so it sticks.
      const realPlayer = (teamObj.players || []).find(x => x.id === p.id);
      if (realPlayer) updateLiveRatingAfterMatch(realPlayer, ps.rating);
      const oppTeamObj = concededSide === 'home' ? m.away.team : m.home.team;
      recordPlayerMatchLog(m, p, teamObj, oppTeamObj, ps, concededSide);
      // Feed the season-long "Interceptions" leaderboard and Defenders' Award
      // with this match's accumulated defensive totals.
      if (ps.interceptions > 0) recordStatCount('interceptions', p, teamObj, ps.interceptions);
      if (ps.tackles > 0) recordStatCount('tackles', p, teamObj, ps.tackles);
      // Blocks and xG/xA are also real, live-simulated per-match totals by
      // this point (set in engine/defending.js, engine/shooting.js, and
      // engine/setpieces.js as the match runs) — feed them into the same
      // season/career leaderboard buckets as everything else above so a
      // player's profile and the Statistics tab can show season/career
      // totals for them, not just this-match numbers.
      if (ps.blocks > 0) recordStatCount('blocks', p, teamObj, ps.blocks);
      if (ps.xg > 0) recordStatCount('xg', p, teamObj, ps.xg);
      if (ps.xa > 0) recordStatCount('xa', p, teamObj, ps.xa);
      // Feed the "minutes" bucket so the Avg Rating leaderboard can require
      // a minimum share of available playing time (see showLeaderboard).
      const minutesPlayed = computeMinutesPlayed(m, p.id, p.name, concededSide);
      if (minutesPlayed > 0) recordStatCount('minutes', p, teamObj, minutesPlayed);
    });
    // Anyone on either roster who didn't actually feature this match —
    // unused substitutes, and anyone outside the matchday squad entirely —
    // has their run of form reset back to neutral ("B") rather than
    // keeping whatever liveRating they carried in. A hot or cold streak is
    // about actually playing; sitting a match out doesn't extend it either
    // way.
    const featuredIds = new Set(pool.map(p => p.id));
    [m.home.team, m.away.team].forEach(team => {
      (team.players || []).forEach(rp => {
        if (featuredIds.has(rp.id)) return;
        ensurePlayerConditionProfile(rp);
        if (rp.liveRating !== 'B') rp.liveRating = 'B';
      });
    });
    // Fill in the full Attack/Passing/Defense/Physical/Goalkeeping stat sheet
    // for every player who took part, then roll those up into each side's
    // team totals — see deriveExtendedMatchStats() below.
    deriveExtendedMatchStats(m);
    // Big Chances Created (player profile / leaderboard) is the season/
    // career total of real big chances a player actually created for a
    // teammate — see bigChancesCreated in engine/shooting.js::resolveShot —
    // rather than every key pass regardless of the resulting chance's
    // quality. Both this and bigChancesMissed only exist on ps once
    // deriveExtendedMatchStats() above has run, so this has to be its own
    // pass over `pool` rather than folding into the interceptions/tackles/
    // blocks/xG/xA loop earlier, which runs before that derivation.
    pool.forEach(p => {
      const ps = m.playerMatchStats[p.id];
      if (!ps) return;
      const teamObj = (m.home.squad.all||[]).find(x=>x.id===p.id) ? m.home.team : m.away.team;
      if (ps.bigChancesCreated > 0) recordStatCount('chancesCreated', p, teamObj, ps.bigChancesCreated);
      if (ps.bigChancesMissed > 0) recordStatCount('bigChancesMissed', p, teamObj, ps.bigChancesMissed);
    });
    let best = null, bestR = -1;
    Object.values(m.playerMatchStats).forEach(ps => {
      if (ps.rating > bestR) { bestR = ps.rating; best = ps; }
    });
    if (best) {
      const team = (m.home.squad.all || []).find(p => p.id === best.id) ? m.home.team : m.away.team;
      const playerObj = [...(m.home.squad.all||[]), ...(m.away.squad.all||[])].find(p => p.id === best.id) || best;
      recordStat('motm', playerObj, team);
      addEvent(90, 'motm', `Player of the Match: <span class="player">${best.name}</span> (${best.rating.toFixed(1)})`, null);
      // Stash the MOTM's player id on the match itself so any ratings list
      // (live post-match panel, match report modal) can pick them out and
      // render their rating badge in the MOTM color — see renderRatingRow()
      // in ui/matchUI.js.
      m.motmId = best.id;
    }
    recordTeamMatchLog(m, m.home.team, m.away.team, m.home.score, m.away.score);
    recordTeamMatchLog(m, m.away.team, m.home.team, m.away.score, m.home.score);
    /* ratings live in lineup */ renderLineups();
    globalMatchDay++;
    // Progress injury/suspension countdowns for both squads. A match only counts
    // against a ban if the player sat it out entirely (no stats recorded this
    // match) — a player freshly injured or sent off *during* this match already
    // has stats here, so their ban starts counting from their team's next match.
    [m.home.team, m.away.team].forEach(teamObj => {
      if (!teamObj) return;
      (teamObj.players || []).forEach(p => {
        const inj = injuryBook[p.id];
        if (inj && inj.matchesLeft > 0 && !m.playerMatchStats[p.id]) {
          inj.matchesLeft--;
          if (inj.matchesLeft <= 0) delete injuryBook[p.id];
        }
        const sus = suspensionBook[p.id];
        if (sus && sus.matchesLeft > 0 && !m.playerMatchStats[p.id]) {
          sus.matchesLeft--;
          if (sus.matchesLeft <= 0) delete suspensionBook[p.id];
        }
      });
    });
    // Ban anyone sent off this match for their team's next match
    Object.entries(m.playerMatchStats).forEach(([id, ps]) => {
      if (!ps.red) return;
      const onHome = (m.home.squad.all || []).some(p => p.id === id);
      const teamObj = onHome ? m.home.team : m.away.team;
      suspensionBook[id] = {
        matchesLeft: 1,
        teamName: teamObj ? teamObj.name : '',
        playerName: ps.name
      };
    });
    try { localStorage.setItem('apexInjuryBook', JSON.stringify(injuryBook)); } catch(e) {}
    try { localStorage.setItem('apexSuspensionBook', JSON.stringify(suspensionBook)); } catch(e) {}
    saveStats();
    updateScoreboard();
    updateStatsPanel();
    if (tournament || window._fromTournament || typeof window._tourFixtureIdx === 'number' || typeof window._koRoundIdx === 'number' || typeof window._uclFixtureIdx === 'number' || typeof window._tourLeagueFixtureIdx === 'number' || window._seasonFixture) {
      const backBtn = document.getElementById('back-to-tournament');
      if (backBtn) {
        backBtn.style.display = 'flex';
        backBtn.classList.add('show');
        const backBtnLabel = backBtn.querySelector('button');
        if (backBtnLabel) backBtnLabel.textContent = window._seasonFixture ? '← Back to Season' : '← Back to Tournament';
      }
    }
    // If this was a tournament match, update fixture
    
    // UCL league live result
    if (typeof window._uclFixtureIdx === 'number' && tournament && tournament.fixtures) {
      const f = tournament.fixtures[window._uclFixtureIdx];
      if (f && !f.played && currentMatch) {
        f.played = true;
        f.homeScore = currentMatch.home.score;
        f.awayScore = currentMatch.away.score;
        f.report = buildMatchReport(currentMatch);
        applyLeagueResult(f.home, f.away, f.homeScore, f.awayScore);
        window._uclFixtureIdx = null;
        if (tournament.fixtures.every(x => x.played)) advanceUCLFromLeague();
        refreshTournamentStatsUI();
      }
    }
    // Domestic league (table format) live result — writes back into the
    // current matchday of tournament.rounds and tournament.table, then
    // advances to the next matchday (or crowns the champion) once every
    // fixture in the round has been played. Mirrors the UCL league block
    // above, but against the plain double round-robin table instead of
    // tournament.league.
    if (typeof window._tourLeagueFixtureIdx === 'number' && tournament && tournament.format === 'table') {
      const round = tournament.rounds[tournament.currentRound];
      const f = round && round[window._tourLeagueFixtureIdx];
      if (f && !f.played && currentMatch) {
        f.played = true;
        f.homeScore = currentMatch.home.score;
        f.awayScore = currentMatch.away.score;
        f.report = buildMatchReport(currentMatch);
        applyResultToTable(tournament.table, f.home, f.away, f.homeScore, f.awayScore);
        window._tourLeagueFixtureIdx = null;
        if (round.every(x => x.played)) {
          tournament.currentRound++;
          if (tournament.currentRound >= tournament.rounds.length) finishLeagueTournament();
        }
        try { renderLeagueTableTournament(); } catch (e) {}
        refreshTournamentStatsUI();
        toast('League match result saved!');
      }
    }
    // Knockout live result
    if (typeof window._koRoundIdx === 'number' && typeof window._koMatchIdx === 'number' && tournament) {
      const km = tournament.knockout[window._koRoundIdx] && tournament.knockout[window._koRoundIdx].matches[window._koMatchIdx];
      if (km && !km.played && currentMatch) {
        km.played = true;
        km.homeScore = currentMatch.home.score;
        km.awayScore = currentMatch.away.score;
        km.report = buildMatchReport(currentMatch);
        if (currentMatch.home.penScore != null) {
          km.penalties = true;
          // Winner by pens or score
          if (currentMatch.home.score !== currentMatch.away.score) {
            km.winner = currentMatch.home.score > currentMatch.away.score ? km.home : km.away;
          } else {
            km.winner = (currentMatch.home.penScore > currentMatch.away.penScore) ? km.home : km.away;
            km.homeScore = currentMatch.home.score;
            km.awayScore = currentMatch.away.score;
          }
        } else if (currentMatch.home.score === currentMatch.away.score) {
          km.winner = seededRandom() < 0.5 ? km.home : km.away;
          km.penalties = true;
        } else {
          km.winner = currentMatch.home.score > currentMatch.away.score ? km.home : km.away;
        }
        const ri = window._koRoundIdx;
        window._koRoundIdx = null;
        window._koMatchIdx = null;
        afterKnockoutMatchPlayed(ri);
        refreshTournamentStatsUI();
        toast('Knockout result saved!');
        const backBtn = document.getElementById('back-to-tournament');
        if (backBtn) { backBtn.style.display = 'flex'; backBtn.classList.add('show'); }
        renderBracket();
        renderTournamentLeaderboard();
      }
    }
    if (typeof window._tourFixtureIdx === 'number' && tournament && tournament.fixtures[window._tourFixtureIdx]) {
      const f = tournament.fixtures[window._tourFixtureIdx];
      if (!f.played && currentMatch) {
        f.played = true;
        f.homeScore = currentMatch.home.score;
        f.awayScore = currentMatch.away.score;
        f.report = buildMatchReport(currentMatch);
        const g = tournament.groups[f.group];
        if (g) {
          const ht = g.teams.find(t => t.team.id === f.home);
          const at = g.teams.find(t => t.team.id === f.away);
          if (ht && at) {
            ht.played++; at.played++;
            ht.gf += f.homeScore; ht.ga += f.awayScore;
            at.gf += f.awayScore; at.ga += f.homeScore;
            if (f.homeScore > f.awayScore) { ht.won++; ht.pts += 3; at.lost++; }
            else if (f.awayScore > f.homeScore) { at.won++; at.pts += 3; ht.lost++; }
            else { ht.drawn++; at.drawn++; ht.pts++; at.pts++; }
          }
        }
        window._tourFixtureIdx = null;
        refreshTournamentStatsUI();
        toast('Tournament match result saved!');
      }
    }
    // Season Calendar live result — mirrors the tournament fixture handling
    // above, but writes back into the current league/UCL matchday and league
    // table, then advances the round once every fixture in it is played.
    if (window._seasonFixture && season) {
      const { compKey, idx } = window._seasonFixture;
      const cup = isCupKey(compKey);
      const comp = resolveSeasonComp(compKey);
      const round = comp && comp.rounds && comp.rounds[comp.currentRound];
      const f = round && round[idx];
      if (f && !f.played && currentMatch) {
        f.played = true;
        f.homeScore = currentMatch.home.score;
        f.awayScore = currentMatch.away.score;
        f.report = buildMatchReport(currentMatch);
        if (cup) {
          if (currentMatch.home.penScore != null) f.pens = { home: currentMatch.home.penScore, away: currentMatch.away.penScore };
          const home = getTeam(f.home), away = getTeam(f.away);
          f.winnerId = winnerOfResult(home, away, { home: f.homeScore, away: f.awayScore, pens: f.pens }).id;
        } else {
          applyResultToTable(comp.table, f.home, f.away, f.homeScore, f.awayScore);
        }
        window._seasonFixture = null;
        currentSeasonComp = null;
        advanceSeasonRoundIfComplete(comp, compKey);
        refreshTournamentStatsUI();
        toast((cup ? 'Cup' : 'Season') + ' match result saved!');
      }
    }
    persistAll();
  }
/*@CHUNK:c0265:END*/

/*@CHUNK:c0427:START*/


/*@CHUNK:c0427:END*/

/*@CHUNK:c0428:START*/
  function simQuickMatch(homeTeam, awayTeam, opts) {
    // Full deep simulation — same engine as live matches (goals, cards, MOTM, injuries, ratings)
    opts = opts || {};
    const prevMatch = currentMatch;
    const prevFixture = window._tourFixtureIdx;
    const prevKoR = window._koRoundIdx;
    const prevKoM = window._koMatchIdx;
    const prevLeagueFixture = window._tourLeagueFixtureIdx;
    // Prevent live tournament hooks from double-writing during bulk sim
    window._tourFixtureIdx = undefined;
    window._koRoundIdx = undefined;
    window._koMatchIdx = undefined;
    window._tourLeagueFixtureIdx = undefined;

    const hf = opts.homeForm || pickTeamFormation(homeTeam);
    const af = opts.awayForm || pickTeamFormation(awayTeam);
    const homeSquad = buildSquad(homeTeam, hf);
    const awaySquad = buildSquad(awayTeam, af);

    currentMatch = {
      home: { team: homeTeam, squad: homeSquad, score: 0, stats: blankStats(), penScore: null },
      away: { team: awayTeam, squad: awaySquad, score: 0, stats: blankStats(), penScore: null },
      minute: 0,
      status: '1st Half',
      finished: false,
      events: [],
      period: 'H1', periodStartRaw: 0, periodBaseDisplay: 0, periodDuration: 45, periodStoppage: null,
      dispMin: 0, dispLabel: "0'",
      homeOnPitch: homeSquad.starting.map(p => p.id),
      awayOnPitch: awaySquad.starting.map(p => p.id),
      homeSubsUsed: 0,
      awaySubsUsed: 0,
      maxSubs: 5,
      injuries: [],
      cards: { home: {}, away: {} },
      // possession must start at 50 here exactly like startMatch() does —
      // without it, m.possession is undefined the first time generateEvents()
      // smooths it toward a target, which turns it into NaN. NaN then poisons
      // qualityGap/homeChance downstream, and `seededRandom() < NaN` is always
      // false, so the "away" side wins every single attacking-side roll for
      // the whole match — hence one team racking up 20+ shots while the other
      // gets 0-5 (and the report showing a flat 50/50 possession is just the
      // "||50" display fallback masking the NaN, not a real 50/50 game).
      possession: 50,
      subLog: { home: {}, away: {} },
      leftPitch: { home: [], away: [] }, // playerIds who have left the pitch (sub'd off, sent off, or injured off) — can never return
      playerMatchStats: {},
      goalList: [],
      allowET: !!opts.allowET,
      allowPens: !!opts.allowPens,
      // Goals already banked from leg 1 of a two-legged tie (see
      // simTwoLegTie in simulation/tournamentEngine.js) — 0/0 for every
      // single-leg match, which makes the aggregate-aware draw checks
      // above behave exactly like the old single-match checks.
      aggHomeStart: opts.aggHomeStart || 0,
      aggAwayStart: opts.aggAwayStart || 0,
      silentDeep: true,
      quietSim: true,
      countForLeaderboard: tournament ? true : !!opts.countForLeaderboard,
      inET: false,
      inPens: false
    };
    currentMatch.home.roles = assignMatchRoles(currentMatch.home);
    currentMatch.away.roles = assignMatchRoles(currentMatch.away);
    // Form & Condition system (engine/form.js) — same per-kickoff roll as
    // the interactive startMatch() path above.
    rollMatchConditions(currentMatch);

    let safety = 0;
    while (currentMatch && !currentMatch.finished && safety < 250) {
      tick(true);
      safety++;
    }
    // Force finish if somehow stuck
    if (currentMatch && !currentMatch.finished) {
      endMatch();
    }

    // simQuickMatch is exclusively the auto-sim path (every call site bulk-
    // simulates fixtures the user hasn't chosen to watch live — see
    // simulation/tournamentEngine.js, seasonEngine.js, leagueTournamentEngine.js),
    // so it only ever needs the lightweight report, not the full stat sheet.
    const report = currentMatch ? buildLightMatchReport(currentMatch) : null;
    const result = {
      home: currentMatch ? currentMatch.home.score : 0,
      away: currentMatch ? currentMatch.away.score : 0,
      pens: currentMatch && currentMatch.home.penScore != null
        ? { home: currentMatch.home.penScore, away: currentMatch.away.penScore }
        : null,
      report
    };

    currentMatch = prevMatch;
    window._tourFixtureIdx = prevFixture;
    window._koRoundIdx = prevKoR;
    window._koMatchIdx = prevKoM;
    window._tourLeagueFixtureIdx = prevLeagueFixture;
    saveStats();
    return result;
  }
/*@CHUNK:c0428:END*/

/*@CHUNK:c0429:START*/

/*@CHUNK:c0429:END*/

/*@CHUNK:c0430:START*/
  function poisson(lambda) {
    const L = Math.exp(-Math.max(0.1, lambda));
    let k = 0, p = 1;
    do { k++; p *= seededRandom(); } while (p > L && k < 10);
    return k - 1;
  }
/*@CHUNK:c0430:END*/
