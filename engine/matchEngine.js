/*@CHUNK:c0127:START*/

/*@CHUNK:c0127:END*/

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
    // Opening tactical instructions now come from the matchup, not a flat
    // "balanced" default every time: a clear underdog tends to sit in and
    // be harder to break down, a clear favourite tends to push on, and a
    // counter-minded manager identity nudges an otherwise even matchup
    // toward pressing higher up — so kickoff already feels shaped by who's
    // actually playing before a single ball is kicked.
    const openStrHome = calcTeamStrength(currentMatch.home);
    const openStrAway = calcTeamStrength(currentMatch.away);
    currentMatch.tactics.home = decideOpeningTactic(openStrHome, openStrAway, getManagerPlaystyle(homeTeam));
    currentMatch.tactics.away = decideOpeningTactic(openStrAway, openStrHome, getManagerPlaystyle(awayTeam));

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
    currentMatch.countForLeaderboard = !!(tournament || window._tourFixtureIdx != null || window._koRoundIdx != null || window._seasonFixture != null);
    currentMatch.allowET = !!(document.getElementById('opt-et') && document.getElementById('opt-et').checked);
    currentMatch.allowPens = !!(document.getElementById('opt-pens') && document.getElementById('opt-pens').checked);
    const gt = document.getElementById('goal-timeline');
    if (gt) gt.innerHTML = '';
    isPlaying = false;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = '▶ Play';
  }
/*@CHUNK:c0128:END*/

/*@CHUNK:c0129:START*/

/*@CHUNK:c0129:END*/

/*@CHUNK:c0130:START*/
  function blankStats() {
    return {
      shots: 0, shotsOn: 0, possession: 50, fouls: 0, corners: 0, saves: 0, passes: 0, passesCompleted: 0, interceptions: 0, blocks: 0, yellows: 0, reds: 0, xg: 0,
      // Attack
      bigChances: 0, bigChancesMissed: 0, touches: 0, touchesInBox: 0, progressiveCarries: 0, carries: 0, dribbles: 0, successfulDribbles: 0, offsides: 0,
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
    m.etStart = m.minute;
    m.status = 'Extra Time';
    addEvent(m.minute, 'et', 'Extra time begins — two periods of 15 minutes', null);
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
    currentMatch.goalList.push({ side, player: player.name, num: player.num, minute, method: methodDesc || '', pen: isPen });
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
      events: (m.events || []).map(e => ({ minute: e.minute, type: e.type, text: e.text, side: e.side })),
      goals: JSON.parse(JSON.stringify(m.goalList || [])),
      ratings: allStats,
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
      bigChances: 0, bigChancesMissed: 0, touches: 0, touchesInBox: 0, progressiveCarries: 0, carries: 0, dribbles: 0, successfulDribbles: 0, offsides: 0,
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

  // Fills in the full extended stat sheet (Attack/Passing/Defense/Physical/
  // Goalkeeping) for every player involved in the match, then sums each
  // field into the team totals so the team sheet always agrees exactly with
  // what's shown per-player underneath it. Runs once at full time (called
  // from endMatch(), after ratings/goalsConceded are finalised) rather than
  // tick-by-tick — a handful of the underlying numbers (shots, passes,
  // passesCompleted, tackles, interceptions, blocks, saves, goals, assists)
  // are the real minute-by-minute simulation output; everything else here
  // is a plausible derived breakdown built from those, the player's role,
  // and minutes played, in the same spirit as the existing rating formula.
  const EXTENDED_STAT_KEYS = ['bigChances','bigChancesMissed','touches','touchesInBox','progressiveCarries','carries',
    'dribbles','successfulDribbles','offsides','progressivePasses','keyPasses','throughBalls','crosses',
    'switches','longBalls','finalThirdPasses','tackles','clearances','headedClearances','defensiveErrors',
    'recoveries','pressures','aerialDuels','distance','sprints','highSpeedRuns','accelerations','decelerations',
    'punches','claims','crossesStopped','goalsPrevented','psxg'];

  function deriveExtendedMatchStats(m) {
    if (!m) return;
    ['home', 'away'].forEach(side => {
      const teamSide = m[side];
      const oppSide = side === 'home' ? m.away : m.home;
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
        const shots = ps.shots || 0, passes = ps.passes || 0, passesC = ps.passesCompleted || 0;
        const goals = ps.goals || 0, assists = ps.assists || 0;
        const rv = (mean, spread) => Math.max(0, mean + (seededRandom() * 2 - 1) * spread);
        const rr = (v) => Math.round(v);

        if (group === 'GK') {
          const touches = rv(16 + minFrac * 12, 5);
          ps.touches = rr(touches);
          ps.touchesInBox = ps.touches;
          ps.carries = rr(touches * 0.35);
          ps.progressiveCarries = rr(ps.carries * 0.1);
          ps.dribbles = 0; ps.successfulDribbles = 0; ps.bigChances = 0; ps.bigChancesMissed = 0; ps.offsides = 0;
          ps.progressivePasses = rr(passesC * 0.22);
          ps.keyPasses = 0; ps.throughBalls = 0; ps.crosses = 0;
          ps.switches = rr(passesC * 0.04);
          ps.longBalls = rr(passesC * (0.3 + seededRandom() * 0.2));
          ps.finalThirdPasses = rr(passesC * 0.04);
          ps.clearances = rr(rv(1.5 * minFrac, 1.4));
          ps.headedClearances = rr(ps.clearances * 0.25);
          ps.defensiveErrors = seededRandom() < 0.035 * minFrac ? 1 : 0;
          ps.recoveries = rr(rv(2 * minFrac, 1.4));
          ps.pressures = rr(rv(1 * minFrac, 1));
          ps.aerialDuels = rr(rv(0.6 * minFrac, 0.8));
          ps.distance = +(3.2 + minFrac * 3 + seededRandom()).toFixed(1);
          ps.sprints = rr(rv(1.5 * minFrac, 1.2));
          ps.highSpeedRuns = rr(rv(0.8 * minFrac, 0.8));
          ps.accelerations = rr(rv(2.5 * minFrac, 1.5));
          ps.decelerations = rr(rv(2.5 * minFrac, 1.5));
          const shotsFaced = oppSide.stats.shotsOn || 0;
          ps.punches = rr(rv(shotsFaced * 0.1, 0.6));
          ps.claims = rr(rv(minFrac * 1.3, 1));
          ps.crossesStopped = rr(rv(minFrac * 1.1, 1));
          // Post-shot xG faced ≈ shots-on-target faced × a per-shot quality
          // factor; Goals Prevented is the usual "keeper overperformance"
          // read — how many more goals an average keeper would've conceded
          // facing the same shots.
          ps.psxg = +(shotsFaced * (0.28 + seededRandom() * 0.12)).toFixed(2);
          ps.goalsPrevented = +(ps.psxg - (ps.goalsConceded || 0)).toFixed(2);
          ps.distribution = passes ? rr((passesC / passes) * 100) : 0;
        } else {
          const isDef = group === 'DEF', isMid = group === 'MID', isFwd = group === 'FWD';
          const tackles = ps.tackles || 0, ints = ps.interceptions || 0;
          const touchBase = (isFwd ? 9 : isMid ? 15 : isDef ? 8 : 8) * minFrac;
          ps.touches = rr(touchBase + passes * 1.15 + shots * 1.3 + tackles * 0.5 + ints * 0.4 + rv(0, 3));
          ps.touchesInBox = rr((isFwd ? ps.touches * 0.16 : isMid ? ps.touches * 0.06 : isDef ? ps.touches * 0.025 : 0.03 * ps.touches) + shots * 0.6);
          ps.carries = rr(ps.touches * (0.5 + seededRandom() * 0.12));
          ps.progressiveCarries = rr(ps.carries * (isFwd ? 0.22 : isMid ? 0.18 : isDef ? 0.08 : 0.15));
          const dribbleBase = (isFwd ? 2.0 : isMid ? 1.3 : isDef ? 0.35 : 1) * minFrac + shots * 0.12;
          ps.dribbles = rr(rv(dribbleBase, 1.1));
          ps.successfulDribbles = rr(ps.dribbles * (0.5 + seededRandom() * 0.25));
          ps.offsides = (isFwd && seededRandom() < 0.16 * minFrac) ? (seededRandom() < 0.2 ? 2 : 1) : 0;

          ps.progressivePasses = rr(passesC * (isMid ? 0.22 : isDef ? 0.15 : isFwd ? 0.12 : 0.1));
          ps.keyPasses = rr(passesC * (isMid ? 0.055 : isFwd ? 0.045 : 0.018) + assists * 0.7);
          ps.throughBalls = rr(ps.keyPasses * (0.12 + seededRandom() * 0.15));
          const wide = WIDE_SLOTS.has((ps.slot || ps.pos || '').toUpperCase());
          ps.crosses = rr(passes * (wide ? 0.14 : isFwd ? 0.04 : 0.015) + rv(0, 1));
          ps.switches = rr(passesC * 0.018);
          ps.longBalls = rr(passesC * (isDef ? 0.18 : isMid ? 0.08 : 0.04));
          ps.finalThirdPasses = rr(passesC * (isFwd ? 0.35 : isMid ? 0.3 : isDef ? 0.12 : 0.2));

          ps.clearances = rr(rv((isDef ? 3.2 : isMid ? 0.6 : 0.15) * minFrac, isDef ? 2 : 0.6));
          ps.headedClearances = rr(ps.clearances * (0.3 + seededRandom() * 0.25));
          ps.defensiveErrors = seededRandom() < (isDef ? 0.05 : 0.02) * minFrac ? 1 : 0;
          ps.recoveries = rr(rv((isDef ? 5 : isMid ? 5.5 : 2.5) * minFrac, 2));
          ps.pressures = rr(rv((isFwd ? 4 : isMid ? 5 : 3) * minFrac, 2));
          ps.aerialDuels = rr(rv((isDef ? 3.5 : isFwd ? 2.2 : 1.2) * minFrac, 1.5));

          ps.distance = +((isMid ? 8.8 : isDef ? 7.6 : isFwd ? 8.2 : 5) * minFrac + seededRandom() * 1.2).toFixed(1);
          ps.sprints = rr(rv((isFwd ? 14 : isMid ? 11 : 9) * minFrac, 4));
          ps.highSpeedRuns = rr(ps.sprints * (0.45 + seededRandom() * 0.2));
          ps.accelerations = rr(rv((isFwd ? 10 : 8) * minFrac, 3));
          ps.decelerations = rr(rv((isFwd ? 10 : 8) * minFrac, 3));

          ps.bigChances = rr(ps.keyPasses * 0.35 + assists * 0.6 + (isFwd ? shots * 0.12 : 0));
          const chanceShots = Math.min(shots, rr(shots * 0.4 + (isFwd ? 0.3 : 0)));
          ps.bigChancesMissed = Math.max(0, chanceShots - goals);
          ps.punches = 0; ps.claims = 0; ps.crossesStopped = 0; ps.psxg = 0; ps.goalsPrevented = 0; ps.distribution = 0;
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
    if (tournament) return tournament.type === 'worldcup' ? 'World Cup' : 'Champions League';
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
    const endMin = Math.max(m.minute || 90, 90);
    const log = (m.subLog && m.subLog[side] && m.subLog[side][playerId]) || {};
    const start = typeof log.inMin === 'number' ? log.inMin : 0;
    let end = typeof log.outMin === 'number' ? log.outMin : endMin;
    if (typeof log.outMin !== 'number' && playerName) {
      const evt = (m.events || []).find(e => e.type === 'red' && e.text && e.text.indexOf(playerName) !== -1);
      if (evt) end = Math.min(end, evt.minute);
    }
    return Math.max(0, Math.min(end, endMin) - start);
  }

/*@CHUNK:cp023:END*/

/*@CHUNK:cp024:START*/

  // Appends this match's line to the player's persistent match log (see
  // playerMatchLog in ui/playersUI.js). Called once per involved player at
  // full time, right after their rating for this match is finalised.
  function recordPlayerMatchLog(m, player, team, opponentTeam, ps, side) {
    if (!player || !team) return;
    const minutes = computeMinutesPlayed(m, player.id, player.name, side);
    if (minutes <= 0 && !(ps.goals || ps.assists || ps.shots)) return; // never actually took part
    if (!playerMatchLog[player.id]) playerMatchLog[player.id] = [];
    playerMatchLog[player.id].unshift({
      opponent: opponentTeam ? opponentTeam.name : '—',
      opponentShort: opponentTeam ? (opponentTeam.short || opponentTeam.name) : '—',
      competition: matchCompetitionLabel(m),
      minutes: minutes,
      goals: ps.goals || 0,
      assists: ps.assists || 0,
      shots: ps.shots || 0,
      xg: Math.round((ps.xg || 0) * 100) / 100,
      rating: ps.rating || 0
    });
    if (playerMatchLog[player.id].length > 30) playerMatchLog[player.id].length = 30;
  }

/*@CHUNK:cp024:END*/

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
    const cap = isBreakout ? 10.0 : 8.7 + seededRandom() * 0.9; // ~8.7-9.6, varies match to match
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
  }
/*@CHUNK:c0197:END*/

/*@CHUNK:c0198:START*/

/*@CHUNK:c0198:END*/

/*@CHUNK:c0199:START*/
  function tick(silent) {
    if (!currentMatch || currentMatch.finished) return;
    const m = currentMatch;
    m.minute++;
    if (m.minute === 45) {
      m.status = 'Half Time';
      addEvent(45, 'whistle', '—— HALF TIME ——', null);
      addEvent(45, 'whistle', 'Tap Play to start 2nd half', null);
      updateScoreboard();
      // Pause at half time (unless turbo finish)
      if (!silent) {
        clearInterval(simInterval);
        isPlaying = false;
        const btn = document.getElementById('btn-play');
        if (btn) btn.textContent = '▶ 2nd Half';
        return;
      }
    }
    if (m.minute === 46) {
      m.status = '2nd Half';
      addEvent(46, 'whistle', 'Second half begins', null);
    }
    if (m.minute >= 90 && !m.inET && !m.inPens && !m._awaitingET) {
      if (!m._stoppage) m._stoppage = 1 + Math.floor(seededRandom() * 5);
      if (m.minute >= 90 + m._stoppage) {
        const drawn = m.home.score === m.away.score;
        if (drawn && (m.allowET || m.allowPens)) {
          // Instant/bulk sims have no one to click the prompt, so resolve immediately
          // instead of stalling — this is what was causing 200+ minute "matches".
          if (m.silentDeep) {
            addEvent(m.minute, 'whistle', `Full time ${m.home.team.short} ${m.home.score}-${m.away.score} ${m.away.team.short} — scores level`, null);
            if (m.allowET) {
              m.inET = true;
              m.etStart = m.minute;
              m.status = 'Extra Time';
              addEvent(m.minute, 'et', 'Extra time begins — two periods of 15 minutes', null);
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
      m.status = 'Stoppage ' + (m.minute - 90) + "'";
    }
    // Extra time running
    if (m.inET && !m.inPens) {
      const etMin = m.minute - (m.etStart || 90);
      if (etMin >= 30) {
        if (m.home.score === m.away.score && m.allowPens) {
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
      if (etMin === 15) {
        addEvent(m.minute, 'et', 'End of the first period of extra time', null);
      }
      m.status = 'ET ' + Math.min(etMin, 30) + "'";
      if (seededRandom() < 0.0025) tryInjury(seededRandom() < 0.5 ? 'home' : 'away');
    }
    generateEvents();
    updateFatigue();
    runTacticalAI();
    // Substitutions: aim for at least 3 per team (max 5)
    if (m.minute >= 55 && m.minute <= 88 && !m.inET) {
      const homeDiff = (m.home.score || 0) - (m.away.score || 0);
      const awayDiff = -homeDiff;
      const needHome = (m.homeSubsUsed || 0) < 3;
      const needAway = (m.awaySubsUsed || 0) < 3;
      const windowLeft = Math.max(1, 88 - m.minute);
      // Higher urgency if still below 3
      let pHome = needHome ? Math.min(0.55, 0.12 + (3 - m.homeSubsUsed) * 0.12 / windowLeft * 8) : 0.06;
      let pAway = needAway ? Math.min(0.55, 0.12 + (3 - m.awaySubsUsed) * 0.12 / windowLeft * 8) : 0.06;
      if (m.minute >= 70) { pHome *= 1.3; pAway *= 1.3; }
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
      if (seededRandom() < pHome) trySubstitution('home');
      if (seededRandom() < pAway) trySubstitution('away');
    }
    // Late forced catch-up so each side reaches 3 if possible
    if (m.minute === 80 || m.minute === 84 || m.minute === 87) {
      if ((m.homeSubsUsed || 0) < 3) trySubstitution('home');
      if ((m.awaySubsUsed || 0) < 3) trySubstitution('away');
    }
    if (seededRandom() < 0.0015) tryInjury(seededRandom() < 0.5 ? 'home' : 'away');
    updateScoreboard();
    if (!silent) updateStatsPanel();
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
    if (roll < 0.20) {
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
    } else if (roll < 0.30) {
      // Throw-in — normal, long, or a tactical retaining throw. Whichever
      // side is more naturally in possession here is picked at random
      // (the possession pipeline above already decides the headline
      // sequence each minute, so this is deliberately independent texture).
      resolveThrowIn(seededRandom() < 0.5 ? side : defSide);
    } else if (roll < 0.40) {
      // Goal kick — taken by the side that was defending this passage,
      // short/medium/long distribution via resolveGoalKick (engine/setpieces.js).
      resolveGoalKick(defSide);
    } else if (roll < 0.56) {
      // Handball — the vast majority are just a regular foul; only a small
      // share are actually given as a penalty. The commentary now always
      // matches what's actually awarded instead of asserting a penalty and
      // then only sometimes delivering one.
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
    } else if (roll < 0.68) {
      // VAR — red-card review. A card given after review still traces back
      // to a real foul/challenge that happened on the pitch, so it counts
      // toward fouls (and the 'cards' bucket) exactly like any other card.
      const player = pickPlayer(defTeam, ['CB', 'ST', 'CDM', 'CM']);
      addEvent(m.minute, 'var', `📺 VAR checking possible red card (${defTeam.team.short})...`, defSide);
      if (player && seededRandom() < 0.16) {
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
        if (player && seededRandom() < 0.5 && (m.cards[defSide][player.id] || 0) < 1) {
          m.cards[defSide][player.id] = (m.cards[defSide][player.id] || 0) + 1;
          defTeam.stats.yellows++;
          recordStat('yellows', player, defTeam.team);
          if (!m.playerMatchStats) m.playerMatchStats = {};
          if (!m.playerMatchStats[player.id]) m.playerMatchStats[player.id] = blankPlayerMatchStats(player);
          m.playerMatchStats[player.id].yellow = true;
          addEvent(m.minute, 'yellow', `🟨 Yellow card — <span class="player">${player.name}</span> booked after VAR review`, defSide);
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
    if (m.minute > 55) {
      const diff = (m.home.score || 0) - (m.away.score || 0);
      const urgency = Math.min(1, (m.minute - 55) / 35);
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
    if (!currentMatch || !side) return { att: 50, def: 50, tec: 50 };
    const isHome = side === currentMatch.home;
    const ids = isHome ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    const onPitch = (side.squad.all || []).filter(p => ids.includes(p.id));
    if (!onPitch.length) return { att: 50, def: 50, tec: 50 };
    const mgr = (side.team.manager && side.team.manager.ovr) || 75;
    const pmods = getPlaystyleMods(side.team);
    const avg = (key, fallback) => onPitch.reduce((s, p) => s + (p[key] != null ? p[key] : fallback), 0) / onPitch.length;
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
    return {
      // Manager overall now carries real weight: a top tactician visibly lifts
      // both ends of the pitch, a poor one visibly drags them down.
      att: avg('att', 70) + (mgr - 75) * 0.18 + pmods.attBonus + homeBoostAtt + attShape,
      def: avg('def', 70) + (mgr - 75) * 0.16 + pmods.defBonus + homeBoostDef + defShape,
      tec: avg('tec', 70) + midShape,
      ovr: avg('ovr', 75),
      phy: avg('phy', 70),
      pac: avg('pac', 70),
      mgr: mgr,
      shape: shape
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
    if (!m.inET && !m.inPens) { m.status = 'Full Time'; if (m.minute < 90) m.minute = 90; }
    else if (m.inPens) m.status = 'FT (Pens)';
    else m.status = 'Full Time (ET)';
    clearInterval(simInterval); isPlaying = false;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = '▶ Play';
    try { renderMomentumAndHeat, showLoading, hideLoading, refreshTournamentStatsUI(); } catch(e) {}
    if (tournament) { try { refreshTournamentStatsUI(); } catch(e) {} }
    addEvent(m.minute || 90, 'whistle', `Full Time! ${m.home.team.short} ${m.home.score} - ${m.away.score} ${m.away.team.short}`, null);
    if (m.away.score === 0) {
      const gk = (m.home.squad.starting || []).find(p => (p.pos || []).includes('GK'));
      if (gk) recordStat('cleanSheets', gk, m.home.team);
    }
    if (m.home.score === 0) {
      const gk = (m.away.squad.starting || []).find(p => (p.pos || []).includes('GK'));
      if (gk) recordStat('cleanSheets', gk, m.away.team);
    }
    // Compute ratings for everyone who played, then MOTM = highest rating
    if (!m.playerMatchStats) m.playerMatchStats = {};
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
      if ((ps.pos === 'GK' || (ps.posArr||[]).includes('GK'))) {
        const side = concededSide;
        if ((side === 'home' && m.away.score === 0) || (side === 'away' && m.home.score === 0)) ps.cleanSheet = true;
      }
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
      ps.rating = calcPlayerRating(ratingInput);
      const teamObj = (m.home.squad.all||[]).find(x=>x.id===p.id) ? m.home.team : m.away.team;
      recordRating(p, teamObj, ps.rating);
      // Nudge this player's persistent form (and therefore their effective
      // OVR) based on how they actually played in this match — the real
      // roster player, not the shallow per-match squad clone, so it sticks.
      const realPlayer = (teamObj.players || []).find(x => x.id === p.id);
      if (realPlayer) updatePlayerForm(realPlayer, ps.rating);
      const oppTeamObj = concededSide === 'home' ? m.away.team : m.home.team;
      recordPlayerMatchLog(m, p, teamObj, oppTeamObj, ps, concededSide);
      // Feed the season-long "Interceptions" leaderboard and Defenders' Award
      // with this match's accumulated defensive totals.
      if (ps.interceptions > 0) recordStatCount('interceptions', p, teamObj, ps.interceptions);
      if (ps.tackles > 0) recordStatCount('tackles', p, teamObj, ps.tackles);
    });
    // Fill in the full Attack/Passing/Defense/Physical/Goalkeeping stat sheet
    // for every player who took part, then roll those up into each side's
    // team totals — see deriveExtendedMatchStats() below.
    deriveExtendedMatchStats(m);
    let best = null, bestR = -1;
    Object.values(m.playerMatchStats).forEach(ps => {
      if (ps.rating > bestR) { bestR = ps.rating; best = ps; }
    });
    if (best) {
      const team = (m.home.squad.all || []).find(p => p.id === best.id) ? m.home.team : m.away.team;
      const playerObj = [...(m.home.squad.all||[]), ...(m.away.squad.all||[])].find(p => p.id === best.id) || best;
      recordStat('motm', playerObj, team);
      addEvent(90, 'motm', `Player of the Match: <span class="player">${best.name}</span> (${best.rating.toFixed(1)})`, null);
    }
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
    if (tournament || window._fromTournament || typeof window._tourFixtureIdx === 'number' || typeof window._koRoundIdx === 'number' || typeof window._uclFixtureIdx === 'number' || window._seasonFixture) {
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
      const comp = compKey === 'ucl' ? season.ucl : season.leagues[compKey];
      const round = comp && comp.rounds && comp.rounds[comp.currentRound];
      const f = round && round[idx];
      if (f && !f.played && currentMatch) {
        f.played = true;
        f.homeScore = currentMatch.home.score;
        f.awayScore = currentMatch.away.score;
        f.report = buildMatchReport(currentMatch);
        applyResultToTable(comp.table, f.home, f.away, f.homeScore, f.awayScore);
        window._seasonFixture = null;
        currentSeasonComp = null;
        advanceSeasonRoundIfComplete(comp, compKey);
        refreshTournamentStatsUI();
        toast('Season match result saved!');
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
    // Prevent live tournament hooks from double-writing during bulk sim
    window._tourFixtureIdx = undefined;
    window._koRoundIdx = undefined;
    window._koMatchIdx = undefined;

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
      silentDeep: true,
      quietSim: true,
      countForLeaderboard: tournament ? true : !!opts.countForLeaderboard,
      inET: false,
      inPens: false
    };

    let safety = 0;
    while (currentMatch && !currentMatch.finished && safety < 250) {
      tick(true);
      safety++;
    }
    // Force finish if somehow stuck
    if (currentMatch && !currentMatch.finished) {
      endMatch();
    }

    const report = currentMatch ? buildMatchReport(currentMatch) : null;
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
