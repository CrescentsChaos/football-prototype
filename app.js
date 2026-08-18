/* Apex Football Simulator - Core Engine */
const App = (() => {
  let teamsData = { national: [], club: [] };
  let allTeams = [];
  let stats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, cards: {}, motm: {} };
  let currentMatch = null;
  let simInterval = null;
  let simSpeed = 400;
  let isPlaying = false;
  let tournament = null;
  let tournamentType = 'worldcup';

  const FORMATIONS = {
    '4-3-3': { name: '4-3-3', slots: ['GK','RB','CB','CB','LB','CM','CM','CM','RW','ST','LW'] },
    '4-4-2': { name: '4-4-2', slots: ['GK','RB','CB','CB','LB','RM','CM','CM','LM','ST','ST'] },
    '4-2-3-1': { name: '4-2-3-1', slots: ['GK','RB','CB','CB','LB','CDM','CDM','CAM','RW','LW','ST'] },
    '3-5-2': { name: '3-5-2', slots: ['GK','CB','CB','CB','RWB','CM','CM','CM','LWB','ST','ST'] },
    '4-5-1': { name: '4-5-1', slots: ['GK','RB','CB','CB','LB','RM','CM','CDM','CM','LM','ST'] },
    '3-4-3': { name: '3-4-3', slots: ['GK','CB','CB','CB','RM','CM','CM','LM','RW','ST','LW'] },
    '5-3-2': { name: '5-3-2', slots: ['GK','RWB','CB','CB','CB','LWB','CM','CM','CM','ST','ST'] },
    '4-1-4-1': { name: '4-1-4-1', slots: ['GK','RB','CB','CB','LB','CDM','RM','CM','CM','LM','ST'] }
  };

  const POS_COMPAT = {
    GK: ['GK'], CB: ['CB','RB','LB'], RB: ['RB','CB','RWB','RM'], LB: ['LB','CB','LWB','LM'],
    RWB: ['RWB','RB','RM'], LWB: ['LWB','LB','LM'], CDM: ['CDM','CM','CB'], CM: ['CM','CDM','CAM'],
    CAM: ['CAM','CM','RW','LW','ST'], RM: ['RM','RW','RWB','CM'], LM: ['LM','LW','LWB','CM'],
    RW: ['RW','RM','ST','CAM'], LW: ['LW','LM','ST','CAM'], ST: ['ST','RW','LW','CAM']
  };

  async function init() {
    try {
      const res = await fetch('teams.json');
      teamsData = await res.json();
      allTeams = [...teamsData.national, ...teamsData.club];
      loadStats();
      populateTeamSelects();
      populateFormations();
      bindNav();
      renderTeamsList();
    } catch (e) {
      console.error(e);
      document.body.innerHTML = '<div style="padding:40px;text-align:center;color:#ff5252"><h2>Error loading teams.json</h2></div>';
    }
  }

  function bindNav() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => switchView(tab.dataset.view));
    });
  }

  function switchView(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('view-' + view)?.classList.add('active');
    document.querySelector(`.nav-tab[data-view="${view}"]`)?.classList.add('active');
    if (view === 'leaderboard') showLeaderboard('goals');
    if (view === 'teams') renderTeamsList();
  }

  function goToMatch() {
    switchView('match');
    document.getElementById('match-setup').style.display = 'block';
    document.getElementById('match-live').style.display = 'none';
  }

  function goToTournament(type) {
    tournamentType = type;
    switchView('tournament');
    document.getElementById('tournament-setup').style.display = 'block';
    document.getElementById('tournament-live').style.display = 'none';
    const isWC = type === 'worldcup';
    document.getElementById('tournament-title').textContent = isWC ? 'World Cup Setup' : 'Champions League Setup';
    document.getElementById('tournament-desc').textContent = isWC
      ? 'Select national teams. Minimum 4 (8 or 16 recommended).'
      : 'Select club teams. Minimum 4 for knockout tournament.';
    renderTournamentTeamSelect();
  }

  function populateTeamSelects() {
    const home = document.getElementById('home-team');
    const away = document.getElementById('away-team');
    home.innerHTML = ''; away.innerHTML = '';
    [{ label: 'National Teams', teams: teamsData.national }, { label: 'Club Teams', teams: teamsData.club }].forEach(g => {
      const og1 = document.createElement('optgroup'); og1.label = g.label;
      const og2 = document.createElement('optgroup'); og2.label = g.label;
      g.teams.forEach(t => {
        og1.appendChild(new Option(`${t.flag} ${t.name}`, t.id));
        og2.appendChild(new Option(`${t.flag} ${t.name}`, t.id));
      });
      home.appendChild(og1); away.appendChild(og2);
    });
    if (teamsData.national.length > 1) {
      home.value = teamsData.national[0].id;
      away.value = teamsData.national[1].id;
    }
    updateTeamPreview('home'); updateTeamPreview('away');
  }

  function populateFormations() {
    ['home-formation', 'away-formation'].forEach(id => {
      const sel = document.getElementById(id);
      sel.innerHTML = '';
      Object.keys(FORMATIONS).forEach(k => sel.appendChild(new Option(FORMATIONS[k].name, k)));
      sel.value = '4-3-3';
    });
  }

  function getTeam(id) { return allTeams.find(t => t.id === id); }

  function updateTeamPreview(side) {
    const team = getTeam(document.getElementById(side + '-team').value);
    const el = document.getElementById(side + '-preview');
    if (!team) { el.innerHTML = ''; return; }
    el.innerHTML = `<span class="team-flag">${team.flag}</span><div><div class="team-name">${team.name}</div><div style="font-size:0.8rem;color:var(--text-muted)">${team.players.length} players</div></div>`;
  }

  function buildSquad(team, formationKey) {
    const formation = FORMATIONS[formationKey];
    const players = shuffleArray([...team.players]);
    const used = new Set();
    const starting = [];
    for (const slot of formation.slots) {
      const candidates = players.filter(p => !used.has(p.id) && canPlay(p, slot))
        .sort((a, b) => {
          const aExact = a.pos.includes(slot) ? 1 : 0;
          const bExact = b.pos.includes(slot) ? 1 : 0;
          if (bExact !== aExact) return bExact - aExact;
          return b.ovr - a.ovr;
        });
      if (candidates.length) {
        used.add(candidates[0].id);
        starting.push({ ...candidates[0], slot, isStarter: true });
      }
    }
    const remaining = players.filter(p => !used.has(p.id)).sort((a, b) => b.ovr - a.ovr);
    const subs = [];
    for (let i = 0; i < remaining.length && (starting.length + subs.length) < 25; i++) {
      subs.push({ ...remaining[i], slot: remaining[i].pos[0], isStarter: false });
    }
    return { starting, subs, formation: formationKey, all: [...starting, ...subs] };
  }

  function canPlay(player, slot) {
    return player.pos.some(p => (POS_COMPAT[slot] || [slot]).includes(p) || p === slot);
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function startMatch() {
    const homeId = document.getElementById('home-team').value;
    const awayId = document.getElementById('away-team').value;
    if (homeId === awayId) { toast('Select two different teams'); return; }
    const homeTeam = getTeam(homeId), awayTeam = getTeam(awayId);
    const homeForm = document.getElementById('home-formation').value;
    const awayForm = document.getElementById('away-formation').value;
    const homeSquad = buildSquad(homeTeam, homeForm);
    const awaySquad = buildSquad(awayTeam, awayForm);

    currentMatch = {
      home: { team: homeTeam, squad: homeSquad, score: 0, stats: blankStats() },
      away: { team: awayTeam, squad: awaySquad, score: 0, stats: blankStats() },
      minute: 0, events: [], status: '1st Half', finished: false,
      homeOnPitch: homeSquad.starting.map(p => p.id),
      awayOnPitch: awaySquad.starting.map(p => p.id),
      homeSubsUsed: 0, awaySubsUsed: 0, maxSubs: 5,
      injuries: [], cards: { home: {}, away: {} }, possession: 50
    };

    document.getElementById('match-setup').style.display = 'none';
    document.getElementById('match-live').style.display = 'block';
    updateScoreboard(); renderLineups();
    document.getElementById('events-feed').innerHTML = '';
    addEvent(0, 'whistle', 'Kick off!', null);
    isPlaying = false;
    document.getElementById('btn-play').textContent = '▶ Play';
  }

  function blankStats() {
    return { shots: 0, shotsOn: 0, possession: 50, fouls: 0, corners: 0, saves: 0, passes: 0, yellows: 0, reds: 0 };
  }

  function quickSimMatch() { startMatch(); simToEnd(); }

  function toggleSim() {
    if (!currentMatch || currentMatch.finished) return;
    isPlaying = !isPlaying;
    document.getElementById('btn-play').textContent = isPlaying ? '⏸ Pause' : '▶ Play';
    if (isPlaying) {
      simInterval = setInterval(() => {
        if (currentMatch.finished) { clearInterval(simInterval); isPlaying = false; document.getElementById('btn-play').textContent = '▶ Play'; return; }
        tick();
      }, simSpeed);
    } else clearInterval(simInterval);
  }

  function setSpeed(val) {
    simSpeed = parseInt(val);
    const labels = { 800: 'Slow', 400: 'Normal', 150: 'Fast', 40: 'Turbo' };
    document.getElementById('sim-speed-label').textContent = 'Speed: ' + (labels[val] || 'Custom');
    if (isPlaying) {
      clearInterval(simInterval);
      simInterval = setInterval(() => { if (currentMatch.finished) { clearInterval(simInterval); isPlaying = false; return; } tick(); }, simSpeed);
    }
  }

  function simToEnd() {
    if (!currentMatch || currentMatch.finished) return;
    clearInterval(simInterval); isPlaying = false;
    document.getElementById('btn-play').textContent = '▶ Play';
    while (!currentMatch.finished) tick(true);
  }

  function resetMatch() {
    clearInterval(simInterval); isPlaying = false; currentMatch = null;
    document.getElementById('match-setup').style.display = 'block';
    document.getElementById('match-live').style.display = 'none';
  }

  function tick(silent) {
    if (!currentMatch || currentMatch.finished) return;
    const m = currentMatch;
    m.minute++;
    if (m.minute === 45) { m.status = 'Half Time'; addEvent(45, 'whistle', 'Half time', null); updateScoreboard(); if (!silent) return; }
    if (m.minute === 46) { m.status = '2nd Half'; addEvent(46, 'whistle', 'Second half begins', null); }
    if (m.minute >= 90) {
      const stoppage = 1 + Math.floor(Math.random() * 5);
      if (m.minute >= 90 + stoppage) { endMatch(); return; }
      m.status = 'Stoppage Time';
    }
    generateEvents(silent);
    if (m.minute >= 55 && m.minute <= 85 && Math.random() < 0.08) trySubstitution(Math.random() < 0.5 ? 'home' : 'away');
    if (Math.random() < 0.012) tryInjury(Math.random() < 0.5 ? 'home' : 'away');
    updateScoreboard();
    if (!silent) updateStatsPanel();
  }

  function generateEvents(silent) {
    const m = currentMatch;
    const homeStr = calcTeamStrength(m.home);
    const awayStr = calcTeamStrength(m.away);
    const total = homeStr.att + awayStr.att + 50;
    const homeChance = (homeStr.att + 10) / total;
    m.possession = Math.max(30, Math.min(70, m.possession + (Math.random() - 0.5) * 4));
    m.home.stats.possession = Math.round(m.possession);
    m.away.stats.possession = 100 - m.home.stats.possession;
    if (Math.random() > 0.55) return;

    const r = Math.random();
    const attackingSide = Math.random() < homeChance ? 'home' : 'away';
    const defendingSide = attackingSide === 'home' ? 'away' : 'home';
    const attTeam = m[attackingSide], defTeam = m[defendingSide];

    if (r < 0.22) {
      const shooter = pickPlayer(attTeam, ['ST','RW','LW','CAM','CM','RM','LM']);
      if (!shooter) return;
      attTeam.stats.shots++;
      if (Math.random() < (0.35 + shooter.att / 300)) {
        attTeam.stats.shotsOn++;
        const gk = pickPlayer(defTeam, ['GK']);
        if (Math.random() < (gk ? 0.55 + gk.def / 400 : 0.6)) {
          if (gk) { defTeam.stats.saves++; recordStat('saves', gk, defTeam.team); addEvent(m.minute, 'save', `Great save by <span class="player">${gk.name}</span>!`, attackingSide); }
        } else {
          const assister = pickPlayer(attTeam, ['CAM','CM','RW','LW','ST','RM','LM'], shooter.id);
          attTeam.score++;
          recordStat('goals', shooter, attTeam.team);
          if (assister && Math.random() < 0.7) {
            recordStat('assists', assister, attTeam.team);
            addEvent(m.minute, 'goal', `GOAL! <span class="player">${shooter.name}</span> scores! Assisted by <span class="player">${assister.name}</span>`, attackingSide, true);
          } else {
            addEvent(m.minute, 'goal', `GOAL! <span class="player">${shooter.name}</span> finds the net!`, attackingSide, true);
          }
        }
      } else {
        addEvent(m.minute, 'shot', `Shot by <span class="player">${shooter.name}</span> goes wide`, attackingSide);
      }
    } else if (r < 0.32) {
      attTeam.stats.corners++;
      addEvent(m.minute, 'corner', `Corner for ${attTeam.team.short}`, attackingSide);
      if (Math.random() < 0.12) {
        const scorer = pickPlayer(attTeam, ['ST','CB','CM','CAM']);
        if (scorer) { attTeam.score++; recordStat('goals', scorer, attTeam.team); addEvent(m.minute, 'goal', `GOAL from the corner! <span class="player">${scorer.name}</span>!`, attackingSide, true); }
      }
    } else if (r < 0.45) {
      const fouler = pickPlayer(defTeam, ['CB','CDM','CM','RB','LB','ST']);
      if (!fouler) return;
      defTeam.stats.fouls++;
      const cardRoll = Math.random();
      if (cardRoll < 0.12) {
        m.cards[defendingSide][fouler.id] = (m.cards[defendingSide][fouler.id] || 0) + 1;
        defTeam.stats.yellows++;
        recordStat('cards', fouler, defTeam.team);
        if (m.cards[defendingSide][fouler.id] >= 2) {
          defTeam.stats.reds++;
          addEvent(m.minute, 'red', `RED CARD! <span class="player">${fouler.name}</span> sent off (2nd yellow)`, defendingSide);
          removeFromPitch(defendingSide, fouler.id);
        } else addEvent(m.minute, 'yellow', `Yellow card for <span class="player">${fouler.name}</span>`, defendingSide);
      } else if (cardRoll < 0.15) {
        defTeam.stats.reds++;
        recordStat('cards', fouler, defTeam.team);
        addEvent(m.minute, 'red', `RED CARD! <span class="player">${fouler.name}</span> is sent off!`, defendingSide);
        removeFromPitch(defendingSide, fouler.id);
      } else addEvent(m.minute, 'foul', `Foul by <span class="player">${fouler.name}</span>`, defendingSide);
    } else if (r < 0.55) {
      const taker = pickPlayer(attTeam, ['CAM','CM','ST','RW','LW']);
      if (taker && Math.random() < 0.15) {
        attTeam.stats.shots++; attTeam.stats.shotsOn++;
        if (Math.random() < 0.3) {
          attTeam.score++; recordStat('goals', taker, attTeam.team);
          addEvent(m.minute, 'goal', `Brilliant free-kick! <span class="player">${taker.name}</span> scores!`, attackingSide, true);
        } else addEvent(m.minute, 'shot', `Free-kick by <span class="player">${taker.name}</span> saved/wide`, attackingSide);
      }
    } else if (r < 0.65) {
      const p = pickPlayer(attTeam, ['CM','CAM','CDM','RB','LB']);
      if (p) { attTeam.stats.passes++; if (Math.random() < 0.3) addEvent(m.minute, 'pass', `Nice play involving <span class="player">${p.name}</span>`, attackingSide); }
    } else if (r < 0.72) {
      const p = pickPlayer(attTeam, ['ST','RW','LW']);
      if (p) addEvent(m.minute, 'offside', `Offside against <span class="player">${p.name}</span>`, attackingSide);
    } else if (r < 0.8) {
      const p = pickPlayer(attTeam, ['ST','CAM','RW','LW']);
      if (p) { attTeam.stats.shots++; addEvent(m.minute, 'miss', `Big chance missed by <span class="player">${p.name}</span>!`, attackingSide); }
    } else if (Math.random() < 0.4) {
      addEvent(m.minute, 'pressure', `${attTeam.team.short} applying pressure`, attackingSide);
    }
  }

  function calcTeamStrength(side) {
    const ids = side === currentMatch.home ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    const onPitch = side.squad.all.filter(p => ids.includes(p.id));
    if (!onPitch.length) return { att: 50, def: 50 };
    return {
      att: onPitch.reduce((s, p) => s + p.att, 0) / onPitch.length,
      def: onPitch.reduce((s, p) => s + p.def, 0) / onPitch.length
    };
  }

  function pickPlayer(side, preferredPos, excludeId) {
    const ids = side === currentMatch.home ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    let pool = side.squad.all.filter(p => ids.includes(p.id) && p.id !== excludeId);
    const preferred = pool.filter(p => p.pos.some(pos => preferredPos.includes(pos)) || preferredPos.includes(p.slot));
    if (preferred.length) pool = preferred;
    if (!pool.length) return null;
    pool.sort((a, b) => (b.ovr + Math.random() * 15) - (a.ovr + Math.random() * 15));
    return pool[0];
  }

  function trySubstitution(side) {
    const m = currentMatch, sideData = m[side];
    const used = side === 'home' ? m.homeSubsUsed : m.awaySubsUsed;
    if (used >= m.maxSubs) return;
    const onPitchIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const onPitch = sideData.squad.starting.filter(p => onPitchIds.includes(p.id));
    const sorted = [...onPitch].sort((a, b) => a.ovr - b.ovr);
    const candidatesOut = sorted.slice(0, Math.max(2, Math.floor(sorted.length / 2)));
    if (!candidatesOut.length) return;
    const outPlayer = candidatesOut[Math.floor(Math.random() * candidatesOut.length)];
    const availableSubs = sideData.squad.subs.filter(p => !onPitchIds.includes(p.id) && !m.injuries.includes(p.id));
    if (!availableSubs.length) return;
    let candidatesIn = availableSubs.filter(p => canPlay(p, outPlayer.slot));
    if (!candidatesIn.length) candidatesIn = availableSubs;
    candidatesIn.sort((a, b) => b.ovr - a.ovr);
    const top = candidatesIn.slice(0, Math.min(3, candidatesIn.length));
    const inPlayer = top[Math.floor(Math.random() * top.length)];
    const idx = onPitchIds.indexOf(outPlayer.id);
    if (idx >= 0) onPitchIds[idx] = inPlayer.id;
    if (side === 'home') m.homeSubsUsed++; else m.awaySubsUsed++;
    addEvent(m.minute, 'sub', `Substitution (${sideData.team.short}): <span class="player">${inPlayer.name}</span> replaces <span class="player">${outPlayer.name}</span>`, side);
  }

  function tryInjury(side) {
    const m = currentMatch, sideData = m[side];
    const onPitchIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const pool = sideData.squad.all.filter(p => onPitchIds.includes(p.id) && p.pos[0] !== 'GK');
    if (!pool.length) return;
    const injured = pool[Math.floor(Math.random() * pool.length)];
    m.injuries.push(injured.id);
    addEvent(m.minute, 'injury', `⚠ Injury! <span class="player">${injured.name}</span> is down`, side);
    const used = side === 'home' ? m.homeSubsUsed : m.awaySubsUsed;
    if (used < m.maxSubs) {
      const availableSubs = sideData.squad.subs.filter(p => !onPitchIds.includes(p.id) && !m.injuries.includes(p.id));
      if (availableSubs.length) {
        let candidates = availableSubs.filter(p => canPlay(p, injured.slot || injured.pos[0]));
        if (!candidates.length) candidates = availableSubs;
        candidates.sort((a, b) => b.ovr - a.ovr);
        const inPlayer = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))];
        const idx = onPitchIds.indexOf(injured.id);
        if (idx >= 0) onPitchIds[idx] = inPlayer.id;
        if (side === 'home') m.homeSubsUsed++; else m.awaySubsUsed++;
        addEvent(m.minute, 'sub', `Forced sub: <span class="player">${inPlayer.name}</span> comes on for injured <span class="player">${injured.name}</span>`, side);
      } else removeFromPitch(side, injured.id);
    } else removeFromPitch(side, injured.id);
  }

  function removeFromPitch(side, playerId) {
    const arr = side === 'home' ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    const idx = arr.indexOf(playerId);
    if (idx >= 0) arr.splice(idx, 1);
  }

  function endMatch() {
    const m = currentMatch;
    m.finished = true; m.status = 'Full Time'; m.minute = 90;
    clearInterval(simInterval); isPlaying = false;
    document.getElementById('btn-play').textContent = '▶ Play';
    addEvent(90, 'whistle', `Full Time! ${m.home.team.short} ${m.home.score} - ${m.away.score} ${m.away.team.short}`, null);
    if (m.away.score === 0) {
      const gk = m.home.squad.starting.find(p => p.pos.includes('GK'));
      if (gk) recordStat('cleanSheets', gk, m.home.team);
    }
    if (m.home.score === 0) {
      const gk = m.away.squad.starting.find(p => p.pos.includes('GK'));
      if (gk) recordStat('cleanSheets', gk, m.away.team);
    }
    const allPlayers = [...m.home.squad.all, ...m.away.squad.all];
    let best = null, bestScore = -1;
    allPlayers.forEach(p => {
      const g = stats.goals[p.id]?.count || 0, a = stats.assists[p.id]?.count || 0, s = stats.saves[p.id]?.count || 0;
      const score = g * 3 + a * 2 + s * 0.5 + p.ovr / 20 + Math.random();
      if (score > bestScore) { bestScore = score; best = p; }
    });
    if (best) {
      const team = m.home.squad.all.find(p => p.id === best.id) ? m.home.team : m.away.team;
      recordStat('motm', best, team);
      addEvent(90, 'motm', `Man of the Match: <span class="player">${best.name}</span>`, null);
    }
    saveStats(); updateScoreboard(); updateStatsPanel();
  }

  function addEvent(minute, type, text, side, isGoal) {
    currentMatch.events.push({ minute, type, text, side });
    const feed = document.getElementById('events-feed');
    if (!feed) return;
    const icons = { goal: '⚽', save: '🧤', yellow: '🟨', red: '🟥', sub: '🔄', injury: '🩹', corner: '🚩', foul: '💢', shot: '👟', miss: '😮', pass: '➡️', offside: '🚫', whistle: '📢', pressure: '🔥', motm: '⭐' };
    const div = document.createElement('div');
    div.className = 'event-item' + (isGoal || type === 'goal' ? ' event-goal' : '') + (type === 'red' ? ' event-card-red' : '') + (type === 'injury' ? ' event-injury' : '');
    div.innerHTML = `<span class="event-time">${minute}'</span><span class="event-icon">${icons[type] || '•'}</span><span class="event-text">${text}</span>`;
    feed.insertBefore(div, feed.firstChild);
  }

  function updateScoreboard() {
    if (!currentMatch) return;
    const m = currentMatch;
    document.getElementById('live-home-flag').textContent = m.home.team.flag;
    document.getElementById('live-home-name').textContent = m.home.team.name;
    document.getElementById('live-home-form').textContent = FORMATIONS[m.home.squad.formation].name;
    document.getElementById('live-away-flag').textContent = m.away.team.flag;
    document.getElementById('live-away-name').textContent = m.away.team.name;
    document.getElementById('live-away-form').textContent = FORMATIONS[m.away.squad.formation].name;
    document.getElementById('live-home-score').textContent = m.home.score;
    document.getElementById('live-away-score').textContent = m.away.score;
    document.getElementById('live-minute').textContent = m.minute + "'";
    document.getElementById('live-status').textContent = m.status;
  }

  function updateStatsPanel() {
    if (!currentMatch) return;
    const h = currentMatch.home.stats, a = currentMatch.away.stats;
    const ts = h.shots + a.shots || 1, ton = h.shotsOn + a.shotsOn || 1, tc = h.corners + a.corners || 1, tf = h.fouls + a.fouls || 1, tsv = h.saves + a.saves || 1;
    document.getElementById('live-stats').innerHTML = `
      <div class="stat-row"><span class="stat-val">${h.shots}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${(h.shots/ts)*50}%"></div><div class="stat-bar-away" style="width:${(a.shots/ts)*50}%"></div></div><span class="stat-val">${a.shots}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Shots</div>
      <div class="stat-row"><span class="stat-val">${h.shotsOn}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${(h.shotsOn/ton)*50}%"></div><div class="stat-bar-away" style="width:${(a.shotsOn/ton)*50}%"></div></div><span class="stat-val">${a.shotsOn}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">On Target</div>
      <div class="stat-row"><span class="stat-val">${h.possession}%</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${h.possession/2}%"></div><div class="stat-bar-away" style="width:${a.possession/2}%"></div></div><span class="stat-val">${a.possession}%</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Possession</div>
      <div class="stat-row"><span class="stat-val">${h.corners}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${(h.corners/tc)*50}%"></div><div class="stat-bar-away" style="width:${(a.corners/tc)*50}%"></div></div><span class="stat-val">${a.corners}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Corners</div>
      <div class="stat-row"><span class="stat-val">${h.fouls}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${(h.fouls/tf)*50}%"></div><div class="stat-bar-away" style="width:${(a.fouls/tf)*50}%"></div></div><span class="stat-val">${a.fouls}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Fouls</div>
      <div class="stat-row"><span class="stat-val">${h.saves}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${(h.saves/tsv)*50}%"></div><div class="stat-bar-away" style="width:${(a.saves/tsv)*50}%"></div></div><span class="stat-val">${a.saves}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Saves</div>
      <div class="stat-row"><span class="stat-val">${h.yellows}</span><div class="stat-bar-wrap"></div><span class="stat-val">${a.yellows}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted)">Yellow Cards</div>`;
  }

  function renderLineups() {
    if (!currentMatch) return;
    const m = currentMatch;
    const html = (side) => {
      const s = m[side];
      let h = `<div class="lineup-team"><h4>${s.team.flag} ${s.team.name} (${FORMATIONS[s.squad.formation].name})</h4><ul class="player-list">`;
      s.squad.starting.forEach(p => {
        const on = (side === 'home' ? m.homeOnPitch : m.awayOnPitch).includes(p.id);
        const inj = m.injuries.includes(p.id);
        h += `<li class="player-item ${inj ? 'injured' : ''}"><span class="player-pos">${p.slot}</span> ${p.name} ${!on && !inj ? '(off)' : ''} ${inj ? '🩹' : ''}<span class="player-ovr">${p.ovr}</span></li>`;
      });
      h += `<li style="margin-top:8px;color:var(--text-muted);font-size:0.8rem">Substitutes</li>`;
      s.squad.subs.forEach(p => {
        const on = (side === 'home' ? m.homeOnPitch : m.awayOnPitch).includes(p.id);
        h += `<li class="player-item sub"><span class="player-pos">${p.pos[0]}</span> ${p.name} ${on ? '(on)' : ''}<span class="player-ovr">${p.ovr}</span></li>`;
      });
      return h + '</ul></div>';
    };
    document.getElementById('lineup-display').innerHTML = html('home') + html('away');
  }

  function recordStat(type, player, team) {
    if (!stats[type][player.id]) stats[type][player.id] = { id: player.id, name: player.name, team: team.name, teamId: team.id, count: 0 };
    stats[type][player.id].count++;
  }

  function saveStats() { try { localStorage.setItem('apexSimStats', JSON.stringify(stats)); } catch(e) {} }
  function loadStats() { try { const s = localStorage.getItem('apexSimStats'); if (s) stats = JSON.parse(s); } catch(e) {} }

  function showLeaderboard(type) {
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.toggle('active', t.dataset.lb === type));
    const data = Object.values(stats[type] || {}).sort((a, b) => b.count - a.count).slice(0, 20);
    const el = document.getElementById('leaderboard-content');
    if (!data.length) {
      el.innerHTML = `<div class="empty-state"><div class="icon">📊</div><p>No ${type} recorded yet. Simulate matches!</p></div>`;
      return;
    }
    const labels = { goals: 'Goals', assists: 'Assists', saves: 'Saves', cleanSheets: 'Clean Sheets', cards: 'Cards', motm: 'MOTM' };
    el.innerHTML = `<table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>${labels[type]||type}</th></tr></thead><tbody>
      ${data.map((p,i) => `<tr><td class="lb-rank">${i+1}</td><td class="lb-player">${p.name}</td><td class="lb-team">${p.team}</td><td style="font-weight:700;color:var(--accent-gold)">${p.count}</td></tr>`).join('')}
    </tbody></table>`;
  }

  function renderTournamentTeamSelect() {
    const pool = tournamentType === 'worldcup' ? teamsData.national : teamsData.club;
    const el = document.getElementById('tournament-teams');
    el.innerHTML = pool.map(t => `<label class="team-check selected" data-id="${t.id}"><input type="checkbox" value="${t.id}" checked><span>${t.flag} ${t.name}</span></label>`).join('');
    el.querySelectorAll('.team-check').forEach(l => {
      l.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') { const cb = l.querySelector('input'); cb.checked = !cb.checked; }
        l.classList.toggle('selected', l.querySelector('input').checked);
      });
    });
  }

  function selectAllTeams() {
    document.querySelectorAll('#tournament-teams input').forEach(cb => { cb.checked = true; cb.closest('.team-check').classList.add('selected'); });
  }
  function deselectAllTeams() {
    document.querySelectorAll('#tournament-teams input').forEach(cb => { cb.checked = false; cb.closest('.team-check').classList.remove('selected'); });
  }

  function startTournament() {
    const selected = [...document.querySelectorAll('#tournament-teams input:checked')].map(cb => getTeam(cb.value));
    if (selected.length < 4) { toast('Select at least 4 teams'); return; }
    let teams = shuffleArray([...selected]);
    const groupSize = 4;
    const numGroups = Math.floor(teams.length / groupSize) || 1;
    const groups = [];
    for (let i = 0; i < numGroups; i++) {
      groups.push({
        name: String.fromCharCode(65 + i),
        teams: teams.slice(i * groupSize, (i + 1) * groupSize).map(t => ({
          team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0
        }))
      });
    }
    tournament = { type: tournamentType, groups, knockout: [], stage: 'groups', fixtures: [], results: [] };
    generateGroupFixtures();
    document.getElementById('tournament-setup').style.display = 'none';
    document.getElementById('tournament-live').style.display = 'block';
    renderGroups();
    document.getElementById('tour-stage-title').textContent = 'Group Stage';
    document.getElementById('bracket').innerHTML = '<p style="color:var(--text-muted)">Knockout bracket appears after groups.</p>';
    document.getElementById('btn-sim-round').textContent = 'Simulate Round';
  }

  function generateGroupFixtures() {
    tournament.fixtures = [];
    tournament.groups.forEach((g, gi) => {
      const ts = g.teams;
      for (let i = 0; i < ts.length; i++)
        for (let j = i + 1; j < ts.length; j++)
          tournament.fixtures.push({ group: gi, home: ts[i].team.id, away: ts[j].team.id, played: false, homeScore: null, awayScore: null });
    });
    shuffleArray(tournament.fixtures);
  }

  function renderGroups() {
    document.getElementById('groups-container').innerHTML = tournament.groups.map(g => {
      const sorted = [...g.teams].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      return `<div class="group-card"><h4>Group ${g.name}</h4><table class="group-table"><thead><tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead><tbody>
        ${sorted.map(t => `<tr><td>${t.team.flag} ${t.team.short}</td><td>${t.played}</td><td>${t.won}</td><td>${t.drawn}</td><td>${t.lost}</td><td>${t.gf-t.ga}</td><td class="pts">${t.pts}</td></tr>`).join('')}
      </tbody></table></div>`;
    }).join('');
  }

  function simTournamentRound() {
    if (!tournament) return;
    if (tournament.stage === 'groups') {
      const unplayed = tournament.fixtures.filter(f => !f.played);
      if (!unplayed.length) { advanceToKnockout(); return; }
      const batch = unplayed.slice(0, Math.max(2, Math.ceil(unplayed.length / 3)));
      batch.forEach(f => {
        const home = getTeam(f.home), away = getTeam(f.away);
        const result = simQuickMatch(home, away);
        f.played = true; f.homeScore = result.home; f.awayScore = result.away;
        const g = tournament.groups[f.group];
        const ht = g.teams.find(t => t.team.id === f.home), at = g.teams.find(t => t.team.id === f.away);
        ht.played++; at.played++;
        ht.gf += result.home; ht.ga += result.away; at.gf += result.away; at.ga += result.home;
        if (result.home > result.away) { ht.won++; ht.pts += 3; at.lost++; }
        else if (result.away > result.home) { at.won++; at.pts += 3; ht.lost++; }
        else { ht.drawn++; at.drawn++; ht.pts++; at.pts++; }
      });
      renderGroups();
      const remaining = tournament.fixtures.filter(f => !f.played).length;
      document.getElementById('tour-stage-title').textContent = remaining ? `Group Stage — ${remaining} matches left` : 'Group Stage Complete';
      if (!remaining) setTimeout(() => advanceToKnockout(), 400);
    } else if (tournament.stage === 'knockout') simKnockoutRound();
  }

  function simAllTournament() {
    if (!tournament) return;
    while (tournament.stage === 'groups' && tournament.fixtures.some(f => !f.played)) simTournamentRound();
    if (tournament.stage === 'groups') advanceToKnockout();
    while (tournament.stage === 'knockout' && !tournament.champion) simKnockoutRound();
  }

  function advanceToKnockout() {
    const qualifiers = [];
    tournament.groups.forEach(g => {
      const sorted = [...g.teams].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      qualifiers.push(sorted[0].team, sorted[1].team);
    });
    while (qualifiers.length & (qualifiers.length - 1)) qualifiers.pop();
    if (qualifiers.length < 2) { toast('Not enough qualifiers'); return; }
    tournament.stage = 'knockout';
    tournament.knockout = [{ name: getRoundName(qualifiers.length), matches: [] }];
    for (let i = 0; i < qualifiers.length; i += 2)
      tournament.knockout[0].matches.push({ home: qualifiers[i], away: qualifiers[i+1], homeScore: null, awayScore: null, winner: null, played: false });
    renderBracket();
    document.getElementById('tour-stage-title').textContent = tournament.knockout[0].name;
    document.getElementById('btn-sim-round').textContent = 'Simulate Knockout Round';
  }

  function getRoundName(n) {
    if (n >= 16) return 'Round of 16'; if (n === 8) return 'Quarter-finals';
    if (n === 4) return 'Semi-finals'; if (n === 2) return 'Final'; return 'Knockout';
  }

  function simKnockoutRound() {
    const current = tournament.knockout[tournament.knockout.length - 1];
    const unplayed = current.matches.filter(m => !m.played);
    if (!unplayed.length) return;
    unplayed.forEach(m => {
      const result = simQuickMatch(m.home, m.away);
      m.homeScore = result.home; m.awayScore = result.away; m.played = true;
      if (result.home === result.away) {
        m.winner = Math.random() < 0.5 ? m.home : m.away;
        if (m.winner === m.home) m.homeScore++; else m.awayScore++;
        m.penalties = true;
      } else m.winner = result.home > result.away ? m.home : m.away;
    });
    renderBracket();
    const winners = current.matches.map(m => m.winner);
    if (winners.length === 1) {
      tournament.champion = winners[0];
      document.getElementById('tour-stage-title').textContent = `🏆 Champions: ${winners[0].flag} ${winners[0].name}`;
      toast(`${winners[0].name} win the ${tournament.type === 'worldcup' ? 'World Cup' : 'Champions League'}!`);
      return;
    }
    const nextMatches = [];
    for (let i = 0; i < winners.length; i += 2)
      nextMatches.push({ home: winners[i], away: winners[i+1], homeScore: null, awayScore: null, winner: null, played: false });
    tournament.knockout.push({ name: getRoundName(winners.length), matches: nextMatches });
    document.getElementById('tour-stage-title').textContent = getRoundName(winners.length);
    renderBracket();
  }

  function simQuickMatch(homeTeam, awayTeam) {
    const homeSquad = buildSquad(homeTeam, '4-3-3');
    const awaySquad = buildSquad(awayTeam, '4-3-3');
    const homeStr = homeSquad.starting.reduce((s, p) => s + p.att + p.ovr, 0) / homeSquad.starting.length;
    const awayStr = awaySquad.starting.reduce((s, p) => s + p.att + p.ovr, 0) / awaySquad.starting.length;
    const homeExp = (homeStr / (homeStr + awayStr)) * 2.4;
    const awayExp = (awayStr / (homeStr + awayStr)) * 2.4;
    const homeGoals = poisson(homeExp), awayGoals = poisson(awayExp);
    for (let i = 0; i < homeGoals; i++) {
      const scorer = homeSquad.starting.filter(p => !p.pos.includes('GK')).sort((a,b) => b.att - a.att)[Math.floor(Math.random()*3)] || homeSquad.starting[10];
      if (scorer) recordStat('goals', scorer, homeTeam);
      if (Math.random() < 0.65) {
        const ast = homeSquad.starting[Math.floor(Math.random()*8)+1];
        if (ast && ast.id !== scorer?.id) recordStat('assists', ast, homeTeam);
      }
    }
    for (let i = 0; i < awayGoals; i++) {
      const scorer = awaySquad.starting.filter(p => !p.pos.includes('GK')).sort((a,b) => b.att - a.att)[Math.floor(Math.random()*3)] || awaySquad.starting[10];
      if (scorer) recordStat('goals', scorer, awayTeam);
      if (Math.random() < 0.65) {
        const ast = awaySquad.starting[Math.floor(Math.random()*8)+1];
        if (ast && ast.id !== scorer?.id) recordStat('assists', ast, awayTeam);
      }
    }
    if (awayGoals === 0) { const gk = homeSquad.starting.find(p => p.pos.includes('GK')); if (gk) recordStat('cleanSheets', gk, homeTeam); }
    if (homeGoals === 0) { const gk = awaySquad.starting.find(p => p.pos.includes('GK')); if (gk) recordStat('cleanSheets', gk, awayTeam); }
    const homeGk = homeSquad.starting.find(p => p.pos.includes('GK'));
    const awayGk = awaySquad.starting.find(p => p.pos.includes('GK'));
    if (homeGk) for (let i = 0; i < Math.floor(Math.random()*4) + awayGoals; i++) recordStat('saves', homeGk, homeTeam);
    if (awayGk) for (let i = 0; i < Math.floor(Math.random()*4) + homeGoals; i++) recordStat('saves', awayGk, awayTeam);
    saveStats();
    return { home: homeGoals, away: awayGoals };
  }

  function poisson(lambda) {
    const L = Math.exp(-lambda); let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L && k < 10);
    return k - 1;
  }

  function renderBracket() {
    const el = document.getElementById('bracket');
    if (!tournament.knockout.length) { el.innerHTML = '<p style="color:var(--text-muted)">No knockout matches yet.</p>'; return; }
    el.innerHTML = tournament.knockout.map(round => `
      <div class="round"><div class="round-title">${round.name}</div>
      ${round.matches.map(m => `
        <div class="bracket-match ${m.played ? 'played' : ''}">
          <div class="bracket-team ${m.winner?.id === m.home.id ? 'winner' : ''}"><span>${m.home.flag} ${m.home.short}</span><span class="bracket-score">${m.played ? m.homeScore : '-'}</span></div>
          <div class="bracket-team ${m.winner?.id === m.away.id ? 'winner' : ''}"><span>${m.away.flag} ${m.away.short}</span><span class="bracket-score">${m.played ? m.awayScore : '-'}</span></div>
          ${m.penalties ? '<div style="font-size:0.7rem;color:var(--text-muted);text-align:center">pens</div>' : ''}
        </div>`).join('')}
      </div>`).join('');
  }

  function resetTournament() {
    tournament = null;
    document.getElementById('tournament-setup').style.display = 'block';
    document.getElementById('tournament-live').style.display = 'none';
    document.getElementById('btn-sim-round').textContent = 'Simulate Round';
  }

  function filterTeams(type) { renderTeamsList(type); }

  function renderTeamsList(filter = 'all') {
    let list = allTeams;
    if (filter === 'national') list = teamsData.national;
    if (filter === 'club') list = teamsData.club;
    document.getElementById('teams-list').innerHTML = list.map(t => `
      <div class="team-check" style="cursor:default;flex-direction:column;align-items:flex-start;gap:4px">
        <div style="display:flex;align-items:center;gap:8px"><span style="font-size:1.5rem">${t.flag}</span><strong>${t.name}</strong></div>
        <div style="font-size:0.8rem;color:var(--text-muted)">${t.players.length} players · ${t.short}</div>
      </div>`).join('');
  }

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  return {
    init, switchView, goToMatch, goToTournament, updateTeamPreview,
    startMatch, quickSimMatch, toggleSim, setSpeed, simToEnd, resetMatch,
    showLeaderboard, selectAllTeams, deselectAllTeams, startTournament,
    simTournamentRound, simAllTournament, resetTournament, filterTeams
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
