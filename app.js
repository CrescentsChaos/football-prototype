/* Apex Football Simulator - Fixed (no external fetch) */
var App = (() => {
  // ========== EMBEDDED TEAMS DATA ==========
  const TEAMS_DATA = {};


  let teamsData = { national: [], club: [] };
  let allTeams = [];
  // leagues.json: { "La Liga": ["Real Madrid 2026-27", ...], ... } — defines which
  // clubs belong to which domestic league, independent of teams.json.
  let leaguesData = {};
  let stats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, cards: {}, motm: {}, puskas: {}, ratings: {} };
  let tournamentStats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, motm: {}, ratings: {}, puskas: {} };
    // Clear previous tournament UI
    const clearIds = ['tour-stats-preview', 'tour-awards', 'tour-podium', 'bracket', 'groups-container', 'fixture-list'];
    clearIds.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    const st = document.getElementById('tour-stage-title');
    if (st) st.textContent = 'Starting…';
  // playerId -> { type, matchesLeft, teamName, playerName } — counts down once per
  // this player's team's match played while they're sidelined
  let injuryBook = {};
  let suspensionBook = {}; // playerId -> { matchesLeft, teamName, playerName } — 1-match ban after a red card
  let globalMatchDay = 1;
  let trophies = []; // {name, team, type, date}
  let currentMatch = null;
  let simInterval = null;
  let simSpeed = 400;
  let isPlaying = false;
  let tournament = null;
  let tournamentType = 'worldcup';

  // ========== SEASON CALENDAR ==========
  // "name" must match a key in leagues.json exactly so team pools can be
  // looked up automatically instead of picked by hand.
  const SEASON_LEAGUE_DEFS = [
    { key: 'epl', name: 'Premier League' },
    { key: 'laliga', name: 'La Liga' },
    { key: 'seriea', name: 'Serie A' },
    { key: 'bundesliga', name: 'Bundesliga' },
    { key: 'ligue1', name: 'Ligue 1' }
  ];
  // How many table-toppers from each domestic league qualify as Champions
  // League candidates the following season (real-life style qualification).
  const UCL_QUALIFY_PER_LEAGUE = 4;
  let season = null; // active season object, or null if not started
  let seasonSetup = {
    selections: { epl: new Set(), laliga: new Set(), seriea: new Set(), bundesliga: new Set(), ligue1: new Set() },
    search: { epl: '', laliga: '', seriea: '', bundesliga: '', ligue1: '' }
  };
  let seasonActiveTab = 'epl';
  let seasonReportRegistry = []; // flat list of match reports referenced by index from season fixture cards

  const FORMATIONS = {
    '4-3-3': { name: '4-3-3', slots: ['GK','RB','CB','CB','LB','CM','CM','CM','RW','ST','LW'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[62,50],[50,48],[38,50],[78,28],[50,18],[22,28]] },
    '4-4-2': { name: '4-4-2', slots: ['GK','RB','CB','CB','LB','RM','CM','CM','LM','ST','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[82,48],[58,50],[42,50],[18,48],[58,20],[42,20]] },
    '4-2-3-1': { name: '4-2-3-1', slots: ['GK','RB','CB','CB','LB','CDM','CDM','CAM','RW','LW','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[58,55],[42,55],[50,38],[78,30],[22,30],[50,16]] },
    '3-5-2': { name: '3-5-2', slots: ['GK','CB','CB','CB','RWB','CM','CM','CM','LWB','ST','ST'],
      coords: [[50,92],[68,75],[50,78],[32,75],[88,55],[62,48],[50,50],[38,48],[12,55],[58,20],[42,20]] },
    '4-5-1': { name: '4-5-1', slots: ['GK','RB','CB','CB','LB','RM','CM','CDM','CM','LM','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[82,45],[62,48],[50,55],[38,48],[18,45],[50,18]] },
    '3-4-3': { name: '3-4-3', slots: ['GK','CB','CB','CB','RM','CM','CM','LM','RW','ST','LW'],
      coords: [[50,92],[68,75],[50,78],[32,75],[82,50],[58,48],[42,48],[18,50],[78,25],[50,16],[22,25]] },
    '5-3-2': { name: '5-3-2', slots: ['GK','RWB','CB','CB','CB','LWB','CM','CM','CM','ST','ST'],
      coords: [[50,92],[88,68],[68,75],[50,78],[32,75],[12,68],[62,48],[50,50],[38,48],[58,20],[42,20]] },
    '4-1-4-1': { name: '4-1-4-1', slots: ['GK','RB','CB','CB','LB','CDM','RM','CM','CM','LM','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[50,58],[82,42],[58,45],[42,45],[18,42],[50,16]] },
    '4-3-2-1': { name: '4-3-2-1', slots: ['GK','RB','CB','CB','LB','CM','CM','CM','CAM','CAM','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[62,52],[50,50],[38,52],[62,32],[38,32],[50,16]] },
    '3-4-2-1': { name: '3-4-2-1', slots: ['GK','CB','CB','CB','RM','CM','CM','LM','CAM','CAM','ST'],
      coords: [[50,92],[68,75],[50,78],[32,75],[85,50],[58,52],[42,52],[15,50],[62,30],[38,30],[50,14]] },
    '4-4-1-1': { name: '4-4-1-1', slots: ['GK','RB','CB','CB','LB','RM','CM','CM','LM','CAM','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[82,48],[58,52],[42,52],[18,48],[50,32],[50,16]] },
    '5-4-1': { name: '5-4-1', slots: ['GK','RWB','CB','CB','CB','LWB','RM','CM','CM','LM','ST'],
      coords: [[50,92],[88,68],[68,75],[50,78],[32,75],[12,68],[80,45],[58,50],[42,50],[20,45],[50,18]] }
  };

  const POS_COMPAT = {
    GK: ['GK'], CB: ['CB','RB','LB'], RB: ['RB','CB','RWB','RM'], LB: ['LB','CB','LWB','LM'],
    RWB: ['RWB','RB','RM'], LWB: ['LWB','LB','LM'], CDM: ['CDM','CM','CB'], CM: ['CM','CDM','CAM'],
    CAM: ['CAM','CM','RW','LW','ST'], RM: ['RM','RW','RWB','CM'], LM: ['LM','LW','LWB','CM'],
    RW: ['RW','RM','ST','CAM'], LW: ['LW','LM','ST','CAM'], ST: ['ST','RW','LW','CAM']
  };

  async function init() {
    try {
      let loaded = null;
      let source = 'embedded';
      const isHosted = location.protocol === 'http:' || location.protocol === 'https:';
      if (isHosted) {
        const urls = [
          'teams.json?v=' + Date.now() + '&r=' + Math.random().toString(36).slice(2),
          './teams.json?v=' + Date.now(),
          'teams.json'
        ];
        for (const url of urls) {
          try {
            const res = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
            if (!res.ok) continue;
            const data = await res.json();
            if (data && ((data.national && data.national.length) || (data.club && data.club.length))) {
              loaded = data;
              source = 'teams.json';
              console.log('Loaded teams from', url);
              break;
            }
          } catch (err) {
            console.warn('Fetch failed', url, err);
          }
        }
      } else {
        try {
          const res = await fetch('teams.json?v=' + Date.now(), { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (data && (data.national || data.club)) { loaded = data; source = 'teams.json'; }
          }
        } catch (e) {}
      }
      teamsData = loaded || TEAMS_DATA;
      if (!loaded) {
        source = 'embedded';
        console.warn('Using EMBEDDED team data — teams.json was NOT loaded from server');
      }
      allTeams = [...(teamsData.national || []), ...(teamsData.club || [])];
      if (!allTeams.length) throw new Error('No teams found');

      // Load leagues.json (which clubs belong to which domestic league).
      // Optional — the app still works without it, it just falls back to
      // manual club selection in Season Setup.
      try {
        const lUrls = isHosted
          ? ['leagues.json?v=' + Date.now() + '&r=' + Math.random().toString(36).slice(2), './leagues.json?v=' + Date.now(), 'leagues.json']
          : ['leagues.json?v=' + Date.now()];
        for (const url of lUrls) {
          try {
            const res = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
            if (!res.ok) continue;
            const data = await res.json();
            if (data && typeof data === 'object') { leaguesData = data; console.log('Loaded leagues from', url); break; }
          } catch (err) { console.warn('Fetch failed', url, err); }
        }
      } catch (e) { console.warn('leagues.json not loaded', e); }

      loadStats();
      populateTeamSelects();
      populateFormations();
      bindNav();
      renderTeamsList();
      console.log('Apex Sim ready:', allTeams.length, 'teams | source:', source);
      window.__APEX_DATA_SOURCE = source;
    } catch (e) {
      console.error(e);
      alert('Error loading game: ' + e.message);
    }
  }

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

  function switchView(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => { t.classList.remove('active'); t.removeAttribute('aria-current'); });
    const viewEl = document.getElementById('view-' + view);
    if (viewEl) viewEl.classList.add('active');
    const tabEl = document.querySelector(`.nav-tab[data-view="${view}"]`);
    if (tabEl) { tabEl.classList.add('active'); tabEl.setAttribute('aria-current', 'page'); }
    if (view === 'leaderboard') showLeaderboard('goals');
    if (view === 'awards') showAwards('overview');
    if (view === 'teams') renderTeamsList();
    if (view === 'season') goToSeason();
  }

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
    // Random formations
    const forms = Object.keys(FORMATIONS);
    const hf = document.getElementById('home-formation');
    const af = document.getElementById('away-formation');
    if (hf) hf.value = forms[Math.floor(Math.random()*forms.length)];
    if (af) af.value = forms[Math.floor(Math.random()*forms.length)];
    toast(`${home.flag||''} ${home.name} vs ${away.flag||''} ${away.name}`);
  }

  function goToMatch() {
    switchView('match');
    const setup = document.getElementById('match-setup');
    const live = document.getElementById('match-live');
    if (setup) setup.style.display = 'block';
    if (live) live.style.display = 'none';
  }

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

  function populateTeamSelects() {
    const home = document.getElementById('home-team');
    const away = document.getElementById('away-team');
    if (!home || !away) return;
    home.innerHTML = ''; away.innerHTML = '';
    const groups = [
      { label: 'National Teams', teams: teamsData.national || [] },
      { label: 'Club Teams', teams: teamsData.club || [] }
    ];
    groups.forEach(g => {
      if (!g.teams.length) return;
      const og1 = document.createElement('optgroup'); og1.label = g.label;
      const og2 = document.createElement('optgroup'); og2.label = g.label;
      g.teams.forEach(t => {
        og1.appendChild(new Option((t.flag || '') + ' ' + t.name, t.id));
        og2.appendChild(new Option((t.flag || '') + ' ' + t.name, t.id));
      });
      home.appendChild(og1); away.appendChild(og2);
    });
    if ((teamsData.national || []).length > 1) {
      home.value = teamsData.national[0].id;
      away.value = teamsData.national[1].id;
    } else if (allTeams.length > 1) {
      home.value = allTeams[0].id;
      away.value = allTeams[1].id;
    }
    updateTeamPreview('home');
    updateTeamPreview('away');
  }

  function populateFormations() {
    ['home-formation', 'away-formation'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = '';
      Object.keys(FORMATIONS).forEach(k => sel.appendChild(new Option(FORMATIONS[k].name, k)));
      sel.value = '4-3-3';
    });
  }

  function getTeam(id) { return allTeams.find(t => t.id === id); }

  // Every match is played at the home team's stadium. Falls back to Wembley
  // Stadium whenever a team in teams.json doesn't define its own "stadium".
  function getStadium(team) { return (team && team.stadium) ? team.stadium : 'Wembley Stadium'; }

  function updateTeamPreview(side) {
    const sel = document.getElementById(side + '-team');
    const el = document.getElementById(side + '-preview');
    if (!sel || !el) return;
    const team = getTeam(sel.value);
    if (!team) { el.innerHTML = ''; return; }
    const mgr = team.manager ? team.manager.name : '';
    const venueLine = side === 'home' ? `<div style="font-size:0.8rem;color:var(--text-muted)">🏟️ ${getStadium(team)}</div>` : '';
    el.innerHTML = `<span class="team-flag">${team.flag || ''}</span><div><div class="team-name">${team.name}</div><div class="manager-name">${mgr ? 'Manager: ' + mgr : ''}</div><div style="font-size:0.8rem;color:var(--text-muted)">${(team.players||[]).length} players</div>${venueLine}</div>`;
  }

  function buildSquad(team, formationKey) {
    const formation = FORMATIONS[formationKey] || FORMATIONS['4-3-3'];
    const players = shuffleArray([...(team.players || [])].filter(p => !isPlayerInjured(p.id) && !isPlayerSuspended(p.id)));
    if (players.length < 11) {
      // Emergency: allow injured/suspended if roster too thin
      players.push(...shuffleArray([...(team.players||[])].filter(p => isPlayerInjured(p.id) || isPlayerSuspended(p.id))));
    }
    const used = new Set();
    const starting = [];
    for (const slot of formation.slots) {
      const candidates = players.filter(p => !used.has(p.id) && canPlay(p, slot))
        .sort((a, b) => {
          const aExact = (a.pos || []).includes(slot) ? 1 : 0;
          const bExact = (b.pos || []).includes(slot) ? 1 : 0;
          if (bExact !== aExact) return bExact - aExact;
          return (b.ovr || 70) - (a.ovr || 70);
        });
      if (candidates.length) {
        used.add(candidates[0].id);
        starting.push({ ...candidates[0], slot, isStarter: true });
      }
    }
    // Fallback fill if not enough
    while (starting.length < 11) {
      const leftover = players.find(p => !used.has(p.id));
      if (!leftover) break;
      used.add(leftover.id);
      starting.push({ ...leftover, slot: (leftover.pos || ['CM'])[0], isStarter: true });
    }
    const remaining = players.filter(p => !used.has(p.id)).sort((a, b) => (b.ovr||70) - (a.ovr||70));
    const subs = [];
    for (let i = 0; i < remaining.length && (starting.length + subs.length) < 25; i++) {
      subs.push({ ...remaining[i], slot: (remaining[i].pos || ['CM'])[0], isStarter: false });
    }
    const _seen = new Set();
    const _st = [];
    for (const p of starting) { if (_seen.has(p.id)) continue; _seen.add(p.id); _st.push(p); }
    const _su = [];
    for (const p of subs) { if (_seen.has(p.id)) continue; _seen.add(p.id); _su.push(p); }
    return { starting: _st, subs: _su, formation: formationKey, all: [..._st, ..._su] };
  }

  function canPlay(player, slot) {
    const positions = player.pos || [];
    return positions.some(p => (POS_COMPAT[slot] || [slot]).includes(p) || p === slot);
  }

  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }


  let customLineups = { home: null, away: null };
  let sbSide = null;
  let sbDraft = null;

  function onFormationChange(side) {
    if (customLineups[side]) customLineups[side] = null;
  }

  function openSquadBuilder(side) {
    try {
    sbSide = side;
    const teamSel = document.getElementById(side + '-team');
    const formSel = document.getElementById(side + '-formation');
    const teamId = teamSel && teamSel.value;
    const formKey = (formSel && formSel.value) || '4-3-3';
    const team = getTeam(teamId);
    if (!team) { toast('Select a team first'); return; }
    const panel = document.getElementById('squad-builder-panel');
    if (!panel) { toast('Squad builder UI missing — re-upload index.html'); return; }

    const formation = FORMATIONS[formKey] || FORMATIONS['4-3-3'];
    const players = [];
    const seenP = new Set();
    (team.players || []).forEach(p => {
      if (p && p.id && !seenP.has(p.id)) { seenP.add(p.id); players.push(p); }
    });
    let slots = {};
    let bench = new Set();
    if (customLineups[side] && customLineups[side].formation === formKey) {
      customLineups[side].starting.forEach((p, i) => { slots[i] = p.id; });
      (customLineups[side].subs || []).forEach(p => bench.add(p.id));
    } else {
      const auto = buildSquad(team, formKey);
      auto.starting.forEach((p, i) => { slots[i] = p.id; });
      (auto.subs || []).slice(0, 9).forEach(p => bench.add(p.id));
    }
    sbDraft = { team: team, formation: formKey, slots: slots, bench: bench, players: players };
    document.getElementById('sb-title').textContent = (side === 'home' ? 'HOME' : 'AWAY') + ' · ' + team.name + ' · ' + formKey;
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    renderSquadBuilderUI();
    } catch (err) {
      console.error(err);
      toast('Squad builder error: ' + (err && err.message ? err.message : err));
    }
  }

  function getUsedInDraft() {
    const used = new Set(Object.values(sbDraft.slots).filter(Boolean));
    sbDraft.bench.forEach(function(id) { used.add(id); });
    return used;
  }

  function renderSquadBuilderUI() {
    if (!sbDraft) return;
    const slotsEl = document.getElementById('sb-slots');
    const benchEl = document.getElementById('sb-bench');
    if (!slotsEl || !benchEl) return;
    const formation = FORMATIONS[sbDraft.formation] || FORMATIONS['4-3-3'];
    const used = getUsedInDraft();

    slotsEl.innerHTML = formation.slots.map(function(slot, i) {
      const selectedId = sbDraft.slots[i] || '';
      const selectedP = sbDraft.players.find(function(p) { return p.id === selectedId; });
      const label = selectedP
        ? (selectedP.num || '?') + ' · ' + selectedP.name + ' · ' + selectedP.ovr
        : 'Tap to pick ' + slot;
      return '<div class="sb-slot' + (selectedId ? ' filled' : '') + '">' +
        '<label>' + slot + '</label>' +
        '<button type="button" class="sb-pick-btn" onclick="App.openSlotPicker(' + i + ')">' + label + '</button>' +
        (selectedId ? '<button type="button" class="sb-clear-btn" onclick="App.setSquadSlot(' + i + ',\'\')">✕</button>' : '') +
        '</div>';
    }).join('');

    // Picker panel
    let picker = document.getElementById('sb-picker');
    if (!picker) {
      picker = document.createElement('div');
      picker.id = 'sb-picker';
      picker.className = 'sb-picker';
      picker.style.display = 'none';
      slotsEl.parentNode.insertBefore(picker, slotsEl.nextSibling);
    }

    const starterIds = new Set(Object.values(sbDraft.slots).filter(Boolean));
    const benchPool = sbDraft.players.filter(function(p) { return !starterIds.has(p.id); });
    benchEl.innerHTML = benchPool.map(function(p) {
      const checked = sbDraft.bench.has(p.id);
      return '<label class="sb-bench-item' + (checked ? ' on' : '') + '">' +
        '<input type="checkbox"' + (checked ? ' checked' : '') +
        ' onchange="App.toggleBench(\'' + p.id + '\', this.checked)">' +
        '<span class="sb-bench-num">' + (p.num || '?') + '</span>' +
        '<span class="sb-bench-name">' + p.name + '</span>' +
        '<span class="sb-bench-meta">' + ((p.pos || [])[0] || '') + ' · ' + p.ovr + '</span></label>';
    }).join('') || '<p style="color:var(--text-3)">No remaining players</p>';
  }

  function openSlotPicker(index) {
    if (!sbDraft) return;
    const formation = FORMATIONS[sbDraft.formation] || FORMATIONS['4-3-3'];
    const slot = formation.slots[index];
    const used = getUsedInDraft();
    const selected = sbDraft.slots[index] || '';
    const list = sbDraft.players
      .filter(function(p) { return !used.has(p.id) || p.id === selected; })
      .sort(function(a, b) {
        const aFit = (a.pos || []).includes(slot) ? 1 : 0;
        const bFit = (b.pos || []).includes(slot) ? 1 : 0;
        if (bFit !== aFit) return bFit - aFit;
        return (b.ovr || 70) - (a.ovr || 70);
      });
    let picker = document.getElementById('sb-picker');
    if (!picker) return;
    picker.style.display = 'block';
    picker.innerHTML = '<div class="sb-picker-head"><strong>Select ' + slot + '</strong>' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="App.closeSlotPicker()">Close</button></div>' +
      '<div class="sb-picker-list">' + list.map(function(p) {
        const fit = (p.pos || []).includes(slot);
        return '<button type="button" class="sb-picker-item' + (p.id === selected ? ' selected' : '') + '" onclick="App.setSquadSlot(' + index + ',\'' + p.id + '\');App.closeSlotPicker()">' +
          '<span class="sb-bench-num">' + (p.num || '?') + '</span>' +
          '<span class="sb-bench-name">' + p.name + '</span>' +
          '<span class="sb-bench-meta">' + (p.pos || []).join('/') + ' · ' + p.ovr + (fit ? ' · fit' : '') + '</span></button>';
      }).join('') + '</div>';
    picker.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeSlotPicker() {
    const picker = document.getElementById('sb-picker');
    if (picker) { picker.style.display = 'none'; picker.innerHTML = ''; }
  }


  function setSquadSlot(index, playerId) {
    if (!sbDraft) return;
    if (!playerId) {
      delete sbDraft.slots[index];
    } else {
      Object.keys(sbDraft.slots).forEach(function(k) {
        if (+k !== index && sbDraft.slots[k] === playerId) delete sbDraft.slots[k];
      });
      sbDraft.bench.delete(playerId);
      sbDraft.slots[index] = playerId;
    }
    renderSquadBuilderUI();
  }

  function toggleBench(playerId, on) {
    if (!sbDraft) return;
    if (on) {
      if (Object.values(sbDraft.slots).indexOf(playerId) >= 0) return;
      if (sbDraft.bench.size >= 14) { toast('Max 14 substitutes'); renderSquadBuilderUI(); return; }
      sbDraft.bench.add(playerId);
    } else {
      sbDraft.bench.delete(playerId);
    }
    renderSquadBuilderUI();
  }

  function autoFillSquadBuilder() {
    if (!sbDraft) return;
    const auto = buildSquad(sbDraft.team, sbDraft.formation);
    sbDraft.slots = {};
    auto.starting.forEach(function(p, i) { sbDraft.slots[i] = p.id; });
    sbDraft.bench = new Set(auto.subs.slice(0, 9).map(function(p) { return p.id; }));
    renderSquadBuilderUI();
    toast('Best XI auto-filled');
  }

  function saveSquadBuilder() {
    if (!sbDraft || !sbSide) return;
    const formation = FORMATIONS[sbDraft.formation] || FORMATIONS['4-3-3'];
    const starting = [];
    const used = new Set();
    for (let i = 0; i < formation.slots.length; i++) {
      const id = sbDraft.slots[i];
      if (!id || used.has(id)) { toast('Fill every starting slot with unique players'); return; }
      const p = sbDraft.players.find(function(x) { return x.id === id; });
      if (!p) continue;
      used.add(id);
      starting.push(Object.assign({}, p, { slot: formation.slots[i], isStarter: true }));
    }
    if (starting.length < 11) { toast('Need 11 unique starters'); return; }
    const subs = [];
    sbDraft.bench.forEach(function(id) {
      if (used.has(id)) return;
      const p = sbDraft.players.find(function(x) { return x.id === id; });
      if (p) {
        used.add(id);
        subs.push(Object.assign({}, p, { slot: (p.pos || ['CM'])[0], isStarter: false }));
      }
    });
    customLineups[sbSide] = {
      starting: starting, subs: subs, formation: sbDraft.formation,
      all: starting.concat(subs), _teamId: sbDraft.team.id
    };
    toast((sbSide === 'home' ? 'Home' : 'Away') + ' lineup saved (' + starting.length + '+' + subs.length + ')');
    closeSquadBuilder();
    updateTeamPreview(sbSide);
  }

  function closeSquadBuilder() {
    const panel = document.getElementById('squad-builder-panel');
    if (panel) panel.style.display = 'none';
    sbDraft = null;
  }

  function dedupeSquad(sq) {
    const seen = new Set();
    const starting = [];
    (sq.starting || []).forEach(function(p) {
      if (!p || !p.id || seen.has(p.id)) return;
      seen.add(p.id); starting.push(p);
    });
    const subs = [];
    (sq.subs || []).forEach(function(p) {
      if (!p || !p.id || seen.has(p.id)) return;
      seen.add(p.id); subs.push(p);
    });
    return Object.assign({}, sq, { starting: starting, subs: subs, all: starting.concat(subs) });
  }

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
      tactics: { home: 'balanced', away: 'balanced' },
      playerMatchStats: {},
      goalList: []
    };

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
    addEvent(0, 'whistle', kickMsgs[Math.floor(Math.random()*kickMsgs.length)], null);
    currentMatch.countForLeaderboard = !!(tournament || window._tourFixtureIdx != null || window._koRoundIdx != null);
    currentMatch.allowET = !!(document.getElementById('opt-et') && document.getElementById('opt-et').checked);
    currentMatch.allowPens = !!(document.getElementById('opt-pens') && document.getElementById('opt-pens').checked);
    const gt = document.getElementById('goal-timeline');
    if (gt) gt.innerHTML = '';
    isPlaying = false;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = '▶ Play';
  }

  function blankStats() {
    return { shots: 0, shotsOn: 0, possession: 50, fouls: 0, corners: 0, saves: 0, passes: 0, passesCompleted: 0, interceptions: 0, blocks: 0, yellows: 0, reds: 0, xg: 0 };
  }

  
  
  
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

  function hideETPrompt() {
    const el = document.getElementById('et-prompt');
    if (el) { el.classList.remove('show'); el.innerHTML = ''; }
  }

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

  function continueToPens() {
    const m = currentMatch;
    if (!m) return;
    hideETPrompt();
    m._awaitingET = false;
    m._awaitingPens = false;
    runPenaltyShootout();
  }

  function skipETAndEnd() {
    hideETPrompt();
    if (currentMatch) {
      currentMatch._awaitingET = false;
      currentMatch._awaitingPens = false;
    }
    endMatch();
  }


  function runPenaltyShootout() {
    const m = currentMatch;
    if (!m || m.inPens) return;
    m.inPens = true;
    m.status = 'Penalties';
    addEvent(m.minute, 'pen', '⚽ Penalty shootout!', null);
    updateScoreboard();

    // Order the takers list so recognised penalty takers (strikers/wingers, then
    // attacking mids) step up before defenders/holding mids, same as real teams do.
    const penOrderScore = (p) => (p.att || 0) + (PEN_TAKER_ROLE_WEIGHT[p.slot || (p.pos||[])[0]] || 0.4) * 12;
    const homeTakers = (m.home.squad.starting || []).filter(p => !(p.pos||[]).includes('GK')).sort((a,b)=>penOrderScore(b)-penOrderScore(a));
    const awayTakers = (m.away.squad.starting || []).filter(p => !(p.pos||[]).includes('GK')).sort((a,b)=>penOrderScore(b)-penOrderScore(a));

    // Silent/bulk sims (quick-sim, tournament auto-play) still resolve instantly —
    // only a real, on-screen live match animates the shootout kick by kick.
    if (m.silentDeep) {
      const st = { homePens: 0, awayPens: 0, round: 0, phase: 'regular', sudden: 0 };
      for (let i = 0; i < 5; i++) {
        st.round = i;
        takePenaltyKick(m, 'home', homeTakers, i, st);
        takePenaltyKick(m, 'away', awayTakers, i, st);
        const left = 4 - i;
        if (st.homePens > st.awayPens + left || st.awayPens > st.homePens + left) break;
      }
      let sd = 0;
      while (st.homePens === st.awayPens && sd < 20) {
        st.phase = 'sudden'; st.sudden = sd;
        takePenaltyKick(m, 'home', homeTakers, 5 + sd, st);
        takePenaltyKick(m, 'away', awayTakers, 5 + sd, st);
        sd++;
      }
      m.home.penScore = st.homePens;
      m.away.penScore = st.awayPens;
      addEvent(m.minute, 'whistle', `Penalties: ${m.home.team.short} ${st.homePens} - ${st.awayPens} ${m.away.team.short}`, null);
      endMatch();
      return;
    }

    clearInterval(simInterval);
    isPlaying = false;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = '▶ Play';

    m._pensState = { homePens: 0, awayPens: 0, round: 0, sudden: 0, turn: 'home', phase: 'regular' };
    const stepDelay = Math.max(700, Math.min(1400, simSpeed * 2.5));
    // First kick fires right away so it doesn't feel like a stall, then one kick per interval tick.
    stepPenaltyShootout(homeTakers, awayTakers);
    simInterval = setInterval(() => stepPenaltyShootout(homeTakers, awayTakers), stepDelay);
  }

  // Resolves a single penalty kick and updates score/events. Shared by the instant
  // (silentDeep) and animated (live) shootout paths so outcomes are computed the same way.
  function takePenaltyKick(m, side, takers, kickIndex, st) {
    if (!takers.length) return;
    const taker = takers[kickIndex % takers.length];
    const out = pickPenOutcome();
    const teamShort = m[side].team.short;
    if (out.scored) {
      st[side === 'home' ? 'homePens' : 'awayPens']++;
      addEvent(m.minute, 'pen', `⚽ ${taker.name} (${teamShort}) ${out.text} [${st.homePens}-${st.awayPens}]`, side);
    } else {
      addEvent(m.minute, 'pen', `❌ ${taker.name} (${teamShort}) — ${out.text} [${st.homePens}-${st.awayPens}]`, side);
    }
  }

  // Advances the live penalty shootout by exactly one kick, alternating home/away,
  // so the person watching sees each penalty land before the next one is taken.
  function stepPenaltyShootout(homeTakers, awayTakers) {
    const m = currentMatch;
    if (!m || !m._pensState) { clearInterval(simInterval); return; }
    const st = m._pensState;
    const side = st.turn;
    const takers = side === 'home' ? homeTakers : awayTakers;
    const kickIndex = st.phase === 'regular' ? st.round : (5 + st.sudden);
    takePenaltyKick(m, side, takers, kickIndex, st);
    m.home.penScore = st.homePens;
    m.away.penScore = st.awayPens;
    updateScoreboard();

    if (st.turn === 'home') {
      st.turn = 'away';
      return; // wait for the next tick to take away's kick in the same round
    }
    // Away just kicked — the round is complete, decide what happens next.
    st.turn = 'home';
    if (st.phase === 'regular') {
      const left = 4 - st.round;
      if (st.homePens > st.awayPens + left || st.awayPens > st.homePens + left) {
        finishPenaltyShootout();
        return;
      }
      st.round++;
      if (st.round >= 5) {
        if (st.homePens === st.awayPens) { st.phase = 'sudden'; st.sudden = 0; }
        else { finishPenaltyShootout(); return; }
      }
    } else {
      if (st.homePens !== st.awayPens) { finishPenaltyShootout(); return; }
      st.sudden++;
    }
  }

  function finishPenaltyShootout() {
    const m = currentMatch;
    if (!m) return;
    clearInterval(simInterval);
    const st = m._pensState || { homePens: m.home.penScore || 0, awayPens: m.away.penScore || 0 };
    m.home.penScore = st.homePens;
    m.away.penScore = st.awayPens;
    addEvent(m.minute, 'whistle', `Penalties: ${m.home.team.short} ${st.homePens} - ${st.awayPens} ${m.away.team.short}`, null);
    endMatch();
  }

  function maybeOffsideDisallow(side, scorer, minute) {
    const m = currentMatch;
    if (!m || Math.random() > 0.16) return false; // ~16% of goals get a check
    const team = m[side];
    addEvent(minute, 'var', `📺 VAR checking possible offside in the build-up to ${team.team.short}'s goal...`, side);
    // Pace of attacker vs defence line slightly affects
    const defLine = calcTeamStrength(m[side === 'home' ? 'away' : 'home']);
    const offsideLikely = 0.35 + Math.max(0, (defLine.pac || 70) - (scorer.pac || 70)) / 200;
    if (Math.random() < offsideLikely) {
      team.score = Math.max(0, team.score - 1);
      // remove last goal from list for this side/scorer
      if (m.goalList && m.goalList.length) {
        for (let i = m.goalList.length - 1; i >= 0; i--) {
          if (m.goalList[i].side === side && m.goalList[i].player === scorer.name) {
            m.goalList.splice(i, 1);
            break;
          }
        }
      }
      // undo goal stat (best effort)
      if (stats.goals && stats.goals[scorer.id]) stats.goals[scorer.id].count = Math.max(0, stats.goals[scorer.id].count - 1);
      if (tournament && tournamentStats.goals && tournamentStats.goals[scorer.id]) {
        tournamentStats.goals[scorer.id].count = Math.max(0, tournamentStats.goals[scorer.id].count - 1);
      }
      if (m.playerMatchStats && m.playerMatchStats[scorer.id]) {
        m.playerMatchStats[scorer.id].goals = Math.max(0, (m.playerMatchStats[scorer.id].goals || 1) - 1);
      }
      addEvent(minute, 'var', `VAR: Goal disallowed — <span class="player">${scorer.name}</span> was offside`, side);
      renderGoalTimeline();
      return true;
    }
    addEvent(minute, 'var', `VAR: Goal stands — onside`, side);
    return false;
  }

  function pushGoal(side, player, minute, methodDesc) {
    if (!currentMatch) return;
    if (!currentMatch.goalList) currentMatch.goalList = [];
    currentMatch.goalList.push({ side, player: player.name, num: player.num, minute, method: methodDesc || '' });
    renderGoalTimeline();
  }

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
      const isPen = g.method && /penalt/i.test(g.method);
      const methodBit = isPen ? ' <span class="gt-method">[Penalty]</span>' : '';
      return `<div class="scorer-line"><span class="gt-min">${g.minute}'</span> ${g.player}${g.num != null && g.num !== '' ? ' · '+g.num : ''}${methodBit}</div>`;
    }).join('');
    if (homeEl) homeEl.innerHTML = fmt(goals.filter(g => g.side === 'home'));
    if (awayEl) awayEl.innerHTML = fmt(goals.filter(g => g.side === 'away'));
  }

  function buildMatchReport(m) {
    if (!m) return null;
    return {
      venue: getStadium(m.home.team),
      home: { id: m.home.team.id, name: m.home.team.name, short: m.home.team.short, flag: m.home.team.flag, score: m.home.score, penScore: m.home.penScore, stats: JSON.parse(JSON.stringify(m.home.stats || {})), formation: m.home.squad && m.home.squad.formation },
      away: { id: m.away.team.id, name: m.away.team.name, short: m.away.team.short, flag: m.away.team.flag, score: m.away.score, penScore: m.away.penScore, stats: JSON.parse(JSON.stringify(m.away.stats || {})), formation: m.away.squad && m.away.squad.formation },
      events: (m.events || []).map(e => ({ minute: e.minute, type: e.type, text: e.text, side: e.side })),
      goals: JSON.parse(JSON.stringify(m.goalList || [])),
      ratings: m.playerMatchStats ? JSON.parse(JSON.stringify(m.playerMatchStats)) : {},
      finished: true
    };
  }

  function showMatchReport(report) {
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
    const fmtG = (arr) => arr.map(g => `${g.minute}' ${g.player}${g.method ? ' ('+g.method+')' : ''}`).join('<br>') || '—';
    const ratings = Object.values(report.ratings || {}).sort((x,y) => (y.rating||0)-(x.rating||0));
    const homeIds = new Set(); // approximate by team name match later
    let eventsHtml = (report.events || []).filter(e => e.type !== 'pressure' || Math.random() < 0.3).slice(-80).map(e => {
      const t = (e.text || '').replace(/<[^>]+>/g, '');
      return `<div class="report-event"><span class="re-min">${e.minute}'</span> <span class="re-type">${e.type}</span> ${t}</div>`;
    }).join('');
    // show important events only for cleaner view
    eventsHtml = (report.events || []).filter(e => ['goal','yellow','red','injury','sub','pen','var','motm','whistle','save','miss'].includes(e.type)).map(e => {
      const t = (e.text || '').replace(/<[^>]+>/g, '');
      return `<div class="report-event"><span class="re-min">${e.minute}'</span> ${t}</div>`;
    }).join('');
    content.innerHTML = `
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-size:0.85rem;color:var(--text-muted)">Match Report</div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:8px">
          <div style="flex:1;text-align:left"><div style="font-size:1.4rem">${h.flag||''}</div><strong>${h.name}</strong><div class="goal-scorers">${fmtG(goalsH)}</div></div>
          <div style="font-size:1.6rem;font-weight:800;color:var(--accent-gold)">${scoreLine}</div>
          <div style="flex:1;text-align:right"><div style="font-size:1.4rem">${a.flag||''}</div><strong>${a.name}</strong><div class="goal-scorers away-scorers">${fmtG(goalsA)}</div></div>
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
      <div class="card-title">Player Ratings</div>
      <div style="max-height:200px;overflow-y:auto">
        ${ratings.slice(0,22).map(p => {
          const rc = (p.rating||0) >= 7.5 ? 'rating-high' : (p.rating||0) >= 6.5 ? 'rating-mid' : 'rating-low';
          return `<div class="pm-player"><span class="player-num">${p.num||''}</span><span style="flex:1">${p.name}</span><span class="rating-badge ${rc}">${(p.rating||0).toFixed(1)}</span></div>`;
        }).join('') || '—'}
      </div>
      <div class="modal-actions"><button class="btn btn-secondary" onclick="document.getElementById('match-report-modal').classList.remove('active')">Close</button></div>`;
    modal.classList.add('active');
  }

  function viewFixtureReport(idx) {
    if (!tournament || !tournament.fixtures[idx] || !tournament.fixtures[idx].report) {
      toast('No detailed report for this match');
      return;
    }
    showMatchReport(tournament.fixtures[idx].report);
  }

  function viewKnockoutReport(ri, mi) {
    const m = tournament && tournament.knockout[ri] && tournament.knockout[ri].matches[mi];
    if (!m || !m.report) { toast('No detailed report for this match'); return; }
    showMatchReport(m.report);
  }


  function blankPlayerMatchStats(p) {
    return { id: p.id, name: p.name, num: p.num, pos: (p.pos||[])[0], ovr: p.ovr, goals: 0, assists: 0, shots: 0, saves: 0, tackles: 0, passes: 0, xg: 0, xa: 0, rating: 6.0, yellow: false, red: false };
  }

  function pickGoalMethod(shooter) {
    const methods = [
      { desc: 'low driven finish across the keeper', xg: 0.38, puskas: false },
      { desc: 'side-footed placement into the far corner', xg: 0.36, puskas: false },
      { desc: 'powerful right-footed strike', xg: 0.33, puskas: false },
      { desc: 'left-footed drive', xg: 0.32, puskas: false },
      { desc: 'towering header', xg: 0.30, puskas: false },
      { desc: 'glancing near-post header', xg: 0.28, puskas: false },
      { desc: 'tap-in from close range', xg: 0.58, puskas: false },
      { desc: 'poacher\'s finish at the far post', xg: 0.48, puskas: false },
      { desc: 'deflected effort that wrong-foots the keeper', xg: 0.22, puskas: false },
      { desc: 'low screamer into the bottom corner', xg: 0.16, puskas: true },
      { desc: 'dipping shot from outside the box', xg: 0.14, puskas: true },
      { desc: 'rising drive that flies into the roof of the net', xg: 0.13, puskas: true },
      { desc: 'knuckleball strike that swerves late', xg: 0.12, puskas: true },
      { desc: 'blitz curler into the top corner', xg: 0.15, puskas: true },
      { desc: 'inch-perfect curled finish around the wall', xg: 0.17, puskas: true },
      { desc: 'chip over the advancing keeper', xg: 0.20, puskas: true },
      { desc: 'first-time volley on the half-turn', xg: 0.18, puskas: true },
      { desc: 'overhead kick', xg: 0.10, puskas: true },
      { desc: 'bicycle kick', xg: 0.09, puskas: true },
      { desc: 'rabona finish', xg: 0.08, puskas: true },
      { desc: 'solo run from halfway, then cool finish', xg: 0.19, puskas: true },
      { desc: 'cut inside and arrowed shot near post', xg: 0.24, puskas: false },
      { desc: 'rebound smashed home', xg: 0.42, puskas: false },
      { desc: 'toe-poke under the keeper', xg: 0.40, puskas: false }
    ];
    const spectacular = methods.filter(m => m.puskas);
    const normal = methods.filter(m => !m.puskas);
    const tec = shooter.tec || 70;
    if (tec > 88 && Math.random() < 0.42) return spectacular[Math.floor(Math.random() * spectacular.length)];
    if (tec > 82 && Math.random() < 0.28) return spectacular[Math.floor(Math.random() * spectacular.length)];
    return Math.random() < 0.18 ? spectacular[Math.floor(Math.random()*spectacular.length)] : normal[Math.floor(Math.random()*normal.length)];
  }

  function pickMissDesc(shooter) {
    const foot = Math.random() < 0.55 ? 'right footed' : 'left footed';
    const areas = [
      foot + ' shot from outside the box misses to the left',
      foot + ' shot from outside the box is too high',
      foot + ' shot from the centre of the box misses to the right',
      foot + ' shot from the right side of the box is close, but misses to the left',
      foot + ' shot from the left side of the box misses to the right',
      'header from the centre of the box misses to the left',
      'header from the centre of the box is too high',
      foot + ' shot from outside the box is blocked',
      foot + ' shot from the centre of the box is blocked',
      foot + ' shot from a difficult angle on the right misses to the left',
      'first-time ' + foot + ' shot from outside the box is high and wide to the left',
      foot + ' volley from the centre of the box is too high'
    ];
    return areas[Math.floor(Math.random() * areas.length)];
  }

  function sofascoreMiss(shooter, team) {
    return 'Attempt missed. <span class="player">' + shooter.name + '</span> (' + (team.short || team.name) + ') ' + pickMissDesc(shooter) + '.';
  }

  function sofascoreSave(gk, shooter, team, defTeam) {
    const foot = Math.random() < 0.55 ? 'right footed' : 'left footed';
    const lines = [
      'Attempt saved. <span class="player">' + shooter.name + '</span> (' + (team.short||'') + ') ' + foot + ' shot from the centre of the box is saved in the centre of the goal by <span class="player">' + gk.name + '</span> (' + (defTeam.short||'') + ').',
      'Attempt saved. <span class="player">' + shooter.name + '</span> (' + (team.short||'') + ') ' + foot + ' shot from outside the box is saved in the bottom left corner by <span class="player">' + gk.name + '</span>.',
      'Attempt saved. <span class="player">' + shooter.name + '</span> (' + (team.short||'') + ') header from the centre of the box is saved in the top centre of the goal by <span class="player">' + gk.name + '</span>.',
      '<span class="player">' + gk.name + '</span> (' + (defTeam.short||'') + ') saves a ' + foot + ' shot from <span class="player">' + shooter.name + '</span> at full stretch.'
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  }


  function pickSaveDesc(gk, shooter) {
    const list = [
      `strong hands from <span class="player">${gk.name}</span> to push away a fierce drive`,
      `<span class="player">${gk.name}</span> dives full length to tip a curler around the post`,
      `reflex save — <span class="player">${gk.name}</span> blocks from point-blank range`,
      `<span class="player">${gk.name}</span> gets down quickly to hold a low shot`,
      `spectacular tip over from <span class="player">${gk.name}</span> as a rising shot threatens the top corner`,
      `<span class="player">${gk.name}</span> parries a knuckleball, then gathers at the second attempt`,
      `brave claim by <span class="player">${gk.name}</span> under pressure from the striker`
    ];
    return list[Math.floor(Math.random() * list.length)];
  }

  function pickSkillDesc(player, opponent) {
    const moves = [
      'elastico', 'roulette', 'step-over', 'double touch', 'body feint',
      'rabona', 'sombrero flick', 'rainbow flick', 'marseille turn',
      'shoulder drop', 'scissors', 'stop-and-go', 'drag-back'
    ];
    const move = moves[Math.floor(Math.random() * moves.length)];
    const opp = opponent ? opponent.name : 'the defender';
    const ends = [
      `beats ${opp} with a ${move}`,
      `uses a ${move} to leave ${opp} on the ground`,
      `sells ${opp} with a sharp ${move}`,
      `skins ${opp} using a ${move} and accelerates clear`,
      `bamboozles ${opp} with a ${move} on the touchline`
    ];
    return `<span class="player">${player.name}</span> ${ends[Math.floor(Math.random() * ends.length)]}`;
  }

  function pickPenOutcome() {
    // precise outcomes for pens
    const outcomes = [
      { scored: true, text: 'sends the keeper the wrong way — bottom left' },
      { scored: true, text: 'smashes high into the top-right corner' },
      { scored: true, text: 'cool finish down the middle as the keeper dives early' },
      { scored: true, text: 'low and hard to the keeper\'s right' },
      { scored: true, text: 'panenka chip that floats under the bar' },
      { scored: false, text: 'saved — the keeper guesses correctly and palms it away to his left' },
      { scored: false, text: 'saved low to the right — strong hand from the goalkeeper' },
      { scored: false, text: 'crashes against the crossbar and stays out' },
      { scored: false, text: 'skewed wide of the left post' },
      { scored: false, text: 'keeper tips it onto the upright — rebound cleared' }
    ];
    // ~72% score rate
    const scoredOnes = outcomes.filter(o => o.scored);
    const missedOnes = outcomes.filter(o => !o.scored);
    if (Math.random() < 0.72) return scoredOnes[Math.floor(Math.random() * scoredOnes.length)];
    return missedOnes[Math.floor(Math.random() * missedOnes.length)];
  }

  function pickFkOutcome() {
    const outcomes = [
      { scored: true, text: 'whipped curler over the wall into the top corner' },
      { scored: true, text: 'knuckleball that dips late under the bar' },
      { scored: true, text: 'low drive that skids under the jumping wall' },
      { scored: true, text: 'rising shot into the far top corner' },
      { scored: false, text: 'cleared off the line after the keeper was beaten' },
      { scored: false, text: 'kept out — the keeper tips a curling effort over the bar' },
      { scored: false, text: 'struck into the wall and spun away for a corner' },
      { scored: false, text: 'inches over the crossbar' },
      { scored: false, text: 'curls wide of the far post' }
    ];
    const scoredOnes = outcomes.filter(o => o.scored);
    const missedOnes = outcomes.filter(o => !o.scored);
    if (Math.random() < 0.22) return scoredOnes[Math.floor(Math.random() * scoredOnes.length)];
    return missedOnes[Math.floor(Math.random() * missedOnes.length)];
  }


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
    if (isGK) {
      r += Math.min(saves * 0.35, 2.4);
      if (saves >= 4) r += 0.25;
      if (saves >= 7) r += 0.35;
      if (ps.cleanSheet) r += 0.6;
      if (goals > 0) r += 1.5;
      r += Math.min(passes * 0.01, 0.25);
      r += Math.min(passesC * 0.015, 0.2);
      if (ps.yellow) r -= 0.35;
      if (ps.red) r -= 2.0;
    } else if (isDef) {
      r += Math.min(tackles * 0.28, 1.6);
      r += Math.min(ints * 0.3, 1.2);
      r += Math.min(blocks * 0.25, 0.9);
      r += Math.min(passes * 0.015, 0.45);
      r += Math.min(passesC * 0.02, 0.4);
      r += assists * 0.7;
      r += goals * 1.1;
      r += Math.min(shots * 0.08, 0.3);
      if (tackles + ints >= 4) r += 0.25;
      if (ps.yellow) r -= 0.4;
      if (ps.red) r -= 1.8;
    } else if (isMid) {
      r += assists * 0.95;
      r += goals * 1.15;
      r += Math.min(passes * 0.02, 0.65);
      r += Math.min(passesC * 0.025, 0.55);
      r += Math.min(tackles * 0.18, 0.8);
      r += Math.min(ints * 0.22, 0.7);
      r += Math.min(shots * 0.1, 0.45);
      r += Math.min(xa * 0.2, 0.4);
      r += Math.min(xg * 0.15, 0.3);
      if (passesC >= 25) r += 0.25;
      if (assists >= 2) r += 0.3;
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

    // Shared involvement floor
    const actions = goals + assists + shots + saves + tackles + Math.floor(passes / 5);
    if (actions === 0) r = 6.0;
    else if (actions === 1 && !isGK) r = Math.max(r, 6.2);

    r += Math.max(-0.12, Math.min(0.18, ((ps.ovr || 75) - 75) * 0.008));

    // Keep ratings realistic: a good, solid game should land in the high 7s/8s.
    // Only a genuine breakout performance — a hat-trick, a brace-plus-assist, a big
    // multi-goal contribution, or a standout shutout for a GK/defender — should be
    // able to push into the 9.9-10.0 territory. Everything else is capped below that.
    const isBreakout = isGK
      ? (saves >= 7 && (ps.cleanSheet || goals === 0) && !ps.red)
      : isDef
        ? ((goals >= 1 && ps.cleanSheet) || (goals + assists >= 3) || (goals >= 2 && assists >= 1)) && !ps.red
        : (goals >= 3 || (goals >= 2 && assists >= 1) || assists >= 3 || goals + assists >= 4) && !ps.red;
    const cap = isBreakout ? 10.0 : 9.2;
    return Math.max(4.0, Math.min(cap, Math.round(r * 10) / 10));
  }


  function quickSimMatch() { startMatch(); if (currentMatch) simToEnd(); }

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

  function simToEnd() {
    if (!currentMatch || currentMatch.finished) return;
    clearInterval(simInterval); isPlaying = false;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = '▶ Play';
    let safety = 0;
    while (currentMatch && !currentMatch.finished && safety < 200) {
      tick(true);
      safety++;
    }
  }

  function resetMatch() {
    clearInterval(simInterval); isPlaying = false; currentMatch = null;
    const setup = document.getElementById('match-setup');
    const live = document.getElementById('match-live');
    if (setup) setup.style.display = 'block';
    if (live) live.style.display = 'none';
  }

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
      if (!m._stoppage) m._stoppage = 1 + Math.floor(Math.random() * 5);
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
      if (Math.random() < 0.0025) tryInjury(Math.random() < 0.5 ? 'home' : 'away');
    }
    generateEvents();
    // Substitutions: aim for at least 3 per team (max 5)
    if (m.minute >= 55 && m.minute <= 88 && !m.inET) {
      const needHome = (m.homeSubsUsed || 0) < 3;
      const needAway = (m.awaySubsUsed || 0) < 3;
      const windowLeft = Math.max(1, 88 - m.minute);
      // Higher urgency if still below 3
      let pHome = needHome ? Math.min(0.55, 0.12 + (3 - m.homeSubsUsed) * 0.12 / windowLeft * 8) : 0.06;
      let pAway = needAway ? Math.min(0.55, 0.12 + (3 - m.awaySubsUsed) * 0.12 / windowLeft * 8) : 0.06;
      if (m.minute >= 70) { pHome *= 1.3; pAway *= 1.3; }
      if (Math.random() < pHome) trySubstitution('home');
      if (Math.random() < pAway) trySubstitution('away');
    }
    // Late forced catch-up so each side reaches 3 if possible
    if (m.minute === 80 || m.minute === 84 || m.minute === 87) {
      if ((m.homeSubsUsed || 0) < 3) trySubstitution('home');
      if ((m.awaySubsUsed || 0) < 3) trySubstitution('away');
    }
    if (Math.random() < 0.0015) tryInjury(Math.random() < 0.5 ? 'home' : 'away');
    updateScoreboard();
    if (!silent) updateStatsPanel();
  }

  // Position-based share of a team's passing volume. Higher = touches the ball more often.
  const PASS_POS_WEIGHT = {
    GK: 0.55, CB: 1.75, RB: 1.3, LB: 1.3, RWB: 1.3, LWB: 1.3,
    CDM: 1.95, CM: 1.85, CAM: 1.45, RM: 1.2, LM: 1.2, RW: 1.0, LW: 1.0, ST: 0.7
  };

  // Simulates one minute of team passing for both sides: builds up real per-match
  // pass volume (300-1000+ per team), splits it across on-pitch players by role,
  // and gives each player their own completion (success) rate based on ability.
  function simulateMinutePassing() {
    const m = currentMatch;
    if (!m) return;
    if (!m.playerMatchStats) m.playerMatchStats = {};
    let homeCompletedMin = 0, awayCompletedMin = 0;
    ['home', 'away'].forEach(side => {
      const team = m[side];
      const ids = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
      const onPitch = (team.squad.all || []).filter(p => ids.includes(p.id));
      if (!onPitch.length) return;
      const tac = (m.tactics && m.tactics[side]) || 'balanced';
      // Recent possession share feeds back into how much of the ball this team gets —
      // clamped so it can't spiral away from realistic bounds.
      const possShare = Math.max(0.75, Math.min(1.3, ((team.stats.possession || 50)) / 50));
      let baseVol = 5.2 + Math.random() * 2.6; // ~5.2-7.8 team passes per minute baseline
      if (tac === 'attack') baseVol *= 1.08;
      if (tac === 'defend') baseVol *= 0.86;
      if (tac === 'press') baseVol *= 0.78;
      const vol = Math.max(1, baseVol * possShare);
      const weighted = onPitch.map(p => {
        const slot = p.slot || (p.pos || [])[0] || 'CM';
        return { p, w: PASS_POS_WEIGHT[slot] != null ? PASS_POS_WEIGHT[slot] : 1.2 };
      });
      const totalW = weighted.reduce((s, x) => s + x.w, 0) || 1;
      weighted.forEach(({ p, w }) => {
        const raw = vol * (w / totalW);
        const count = Math.floor(raw) + (Math.random() < (raw - Math.floor(raw)) ? 1 : 0);
        if (count <= 0) return;
        if (!m.playerMatchStats[p.id]) m.playerMatchStats[p.id] = blankPlayerMatchStats(p);
        const ps = m.playerMatchStats[p.id];
        // Individual success rate: driven by technical ability + overall, nudged by tactic.
        const skill = ((p.tec || 70) * 0.55 + (p.ovr || 75) * 0.35 + (p.phy || 70) * 0.1) / 100;
        let succRate = Math.min(0.97, Math.max(0.52, 0.64 + skill * 0.34));
        if (tac === 'press') succRate -= 0.03;
        if (tac === 'attack') succRate -= 0.015;
        let completed = 0;
        for (let i = 0; i < count; i++) { if (Math.random() < succRate) completed++; }
        ps.passes = (ps.passes || 0) + count;
        ps.passesCompleted = (ps.passesCompleted || 0) + completed;
        team.stats.passes = (team.stats.passes || 0) + count;
        team.stats.passesCompleted = (team.stats.passesCompleted || 0) + completed;
        if (side === 'home') homeCompletedMin += completed; else awayCompletedMin += completed;
      });
    });
    return { homeCompletedMin, awayCompletedMin };
  }

  function generateEvents() {
    const m = currentMatch;
    if (!m) return;
    const homeStr = calcTeamStrength(m.home);
    const awayStr = calcTeamStrength(m.away);
    const total = homeStr.att + awayStr.att + 50;
    const homeChance = (homeStr.att + 10) / total;
    // Build up real passing volume for both teams this minute (feeds player stats + rating).
    simulateMinutePassing();
    // Possession is now derived from actual completed-pass share (like real match data
    // providers compute it), smoothed minute to minute so it doesn't jump around wildly.
    const hp = m.home.stats.passes || 0, ap = m.away.stats.passes || 0;
    const passShareTarget = (hp + ap) > 0 ? 100 * hp / (hp + ap) : 50;
    // Slight tug toward the technically stronger side so quality shows up immediately, not just late.
    const techBias = Math.max(-6, Math.min(6, (homeStr.tec - awayStr.tec) * 0.5));
    const target = Math.max(22, Math.min(78, passShareTarget * 0.8 + (50 + techBias) * 0.2));
    m.possession = m.possession + (target - m.possession) * 0.12 + (Math.random() - 0.5) * 1.2;
    m.possession = Math.max(20, Math.min(80, m.possession));
    m.home.stats.possession = Math.round(m.possession);
    m.away.stats.possession = 100 - m.home.stats.possession;
    // Stronger teams create more moments
    const intensity = 0.42 + (homeStr.ovr + awayStr.ovr) / 500;
    if (Math.random() > intensity) {
      // Quiet spell with occasional texture
      if (Math.random() < 0.08) {
        const side = Math.random() < 0.5 ? m.home : m.away;
        const p = pickPlayer(side, ['CM','CDM','CAM','CB']);
        if (p) {
          const quiet = [
            `<span class="player">${p.name}</span> recycles possession calmly`,
            `<span class="player">${p.name}</span> breaks up the play and resets`,
            `<span class="player">${p.name}</span> switches the point of attack`,
            `<span class="player">${p.name}</span> finds a teammate under no pressure`,
            `Spell of possession — <span class="player">${p.name}</span> dictates the tempo`
          ];
          addEvent(m.minute, 'pass', quiet[Math.floor(Math.random()*quiet.length)], side === m.home ? 'home' : 'away');
        }
      }
      return;
    }

    const r = Math.random();
    const attackingSide = Math.random() < homeChance ? 'home' : 'away';
    const defendingSide = attackingSide === 'home' ? 'away' : 'home';
    const attTeam = m[attackingSide], defTeam = m[defendingSide];

    if (r < 0.22) {
      const shooter = pickPlayerWeighted(attTeam, ['ST','RW','LW','CAM','CM','RM','LM'], GOAL_ROLE_WEIGHT);
      if (!shooter) return;
      attTeam.stats.shots++;
      // Attributes matter: att/tec/ovr vs defence
      const shotQuality = ((shooter.att || 70) * 0.45 + (shooter.tec || 70) * 0.35 + (shooter.ovr || 75) * 0.2) / 100;
      const defAvg = calcTeamStrength(defTeam).def / 100;
      const onTargetChance = Math.min(0.62, Math.max(0.14, 0.18 + shotQuality * 0.32 - defAvg * 0.14));
      if (Math.random() < onTargetChance) {
        attTeam.stats.shotsOn++;
        if (!m.playerMatchStats) m.playerMatchStats={};
        if (!m.playerMatchStats[shooter.id]) m.playerMatchStats[shooter.id]=blankPlayerMatchStats(shooter);
        m.playerMatchStats[shooter.id].shots++;
        const gk = pickPlayer(defTeam, ['GK']);
        const gkSkill = gk ? ((gk.def || 70) * 0.5 + (gk.ovr || 75) * 0.3 + (gk.tec || 70) * 0.2) / 100 : 0.7;
        const saveChance = Math.min(0.88, Math.max(0.35, 0.46 + gkSkill * 0.38 - shotQuality * 0.22));
        if (Math.random() < saveChance) {
          if (gk) {
            defTeam.stats.saves++;
            recordStat('saves', gk, defTeam.team);
            addEvent(m.minute, 'save', `Great save by <span class="player">${gk.name}</span>!`, attackingSide);
          }
        } else {
          const assister = pickPlayerWeighted(attTeam, ['CAM','CM','RW','LW','ST','RM','LM'], ASSIST_ROLE_WEIGHT, shooter.id);
          attTeam.score++;
          const method = pickGoalMethod(shooter);
          recordStat('goals', shooter, attTeam.team);
          if (method.puskas) recordStat('puskas', shooter, attTeam.team);
          pushGoal(attackingSide, shooter, m.minute, method.desc);
          // track xG
          if (!m.playerMatchStats) m.playerMatchStats = {};
          if (!m.playerMatchStats[shooter.id]) m.playerMatchStats[shooter.id] = blankPlayerMatchStats(shooter);
          m.playerMatchStats[shooter.id].goals++;
          m.playerMatchStats[shooter.id].xg += method.xg;
          if (assister && Math.random() < 0.7) {
            recordStat('assists', assister, attTeam.team);
            if (!m.playerMatchStats[assister.id]) m.playerMatchStats[assister.id] = blankPlayerMatchStats(assister);
            m.playerMatchStats[assister.id].assists++;
            m.playerMatchStats[assister.id].xa += 0.3 + Math.random() * 0.4;
            addEvent(m.minute, 'goal', `Goal! <span class="player">${shooter.name}</span> (${attTeam.team.short}) — ${method.desc}. Assisted by <span class="player">${assister.name}</span>.`, attackingSide, true);
          } else {
            addEvent(m.minute, 'goal', `Goal! <span class="player">${shooter.name}</span> (${attTeam.team.short}) — ${method.desc}.`, attackingSide, true);
          }
          maybeOffsideDisallow(attackingSide, shooter, m.minute);
        }
      } else {
        if (!m.playerMatchStats) m.playerMatchStats={};
        if (!m.playerMatchStats[shooter.id]) m.playerMatchStats[shooter.id]=blankPlayerMatchStats(shooter);
        m.playerMatchStats[shooter.id].shots++;
        m.playerMatchStats[shooter.id].xg += 0.05 + Math.random()*0.1;
        addEvent(m.minute, 'miss', sofascoreMiss(shooter, attTeam.team), attackingSide);
      }
    } else if (r < 0.32) {
      attTeam.stats.corners++;
      addEvent(m.minute, 'corner', `Corner for ${attTeam.team.short}`, attackingSide);
      if (Math.random() < 0.03) {
        const scorer = pickPlayer(attTeam, ['ST','CB','CM','CAM']);
        if (scorer) {
          attTeam.score++;
          recordStat('goals', scorer, attTeam.team);
          if (!m.playerMatchStats) m.playerMatchStats = {};
          if (!m.playerMatchStats[scorer.id]) m.playerMatchStats[scorer.id] = blankPlayerMatchStats(scorer);
          m.playerMatchStats[scorer.id].goals++;
          m.playerMatchStats[scorer.id].xg += 0.28 + Math.random() * 0.15;
          const corTaker = pickPlayer(attTeam, ['CM','CAM','RW','LW','RB','LB'], scorer.id);
          if (corTaker && Math.random() < 0.65) {
            recordStat('assists', corTaker, attTeam.team);
            if (!m.playerMatchStats[corTaker.id]) m.playerMatchStats[corTaker.id] = blankPlayerMatchStats(corTaker);
            m.playerMatchStats[corTaker.id].assists++;
            m.playerMatchStats[corTaker.id].xa += 0.2 + Math.random() * 0.3;
          }
          pushGoal(attackingSide, scorer, m.minute, 'header from corner');
          addEvent(m.minute, 'goal', `Corner converted. <span class="player">${scorer.name}</span> (${scorer.num||''}) heads home`, attackingSide, true);
        }
      }
    } else if (r < 0.45) {
      const fouler = pickPlayer(defTeam, ['CB','CDM','CM','RB','LB','ST']);
      if (!fouler) return;
      defTeam.stats.fouls++;
      if (!m.foulCounts) m.foulCounts = { home: {}, away: {} };
      m.foulCounts[defendingSide][fouler.id] = (m.foulCounts[defendingSide][fouler.id] || 0) + 1;
      const foulCount = m.foulCounts[defendingSide][fouler.id];
      const alreadyYellow = (m.cards[defendingSide][fouler.id] || 0) >= 1;
      const aggression = 1 + Math.max(0, (75 - (fouler.def || 70)) / 80) + Math.max(0, ((fouler.phy || 70) - 80) / 100);
      let yellowChance = 0.08 * aggression + (foulCount - 1) * 0.14;
      let straightRedChance = 0.004 * aggression;
      if (alreadyYellow) yellowChance += 0.12;
      if (foulCount >= 3) yellowChance += 0.12;
      yellowChance = Math.min(0.72, yellowChance);
      const roll = Math.random();
      const victim = pickPlayer(attTeam, ['ST','RW','LW','CAM','CM']);
      const foulText = victim
        ? `<span class="player">${fouler.name}</span> fouls <span class="player">${victim.name}</span>`
        : `Foul by <span class="player">${fouler.name}</span>`;
      if (roll < straightRedChance && !alreadyYellow) {
        defTeam.stats.reds++;
        recordStat('cards', fouler, defTeam.team);
        recordStat('reds', fouler, defTeam.team);
        if (!m.playerMatchStats) m.playerMatchStats = {};
        if (!m.playerMatchStats[fouler.id]) m.playerMatchStats[fouler.id] = blankPlayerMatchStats(fouler);
        m.playerMatchStats[fouler.id].red = true;
        addEvent(m.minute, 'red', `🟥 Straight red! ${foulText} — reckless challenge`, defendingSide);
        removeFromPitch(defendingSide, fouler.id);
      } else if (roll < straightRedChance + yellowChance) {
        m.cards[defendingSide][fouler.id] = (m.cards[defendingSide][fouler.id] || 0) + 1;
        defTeam.stats.yellows++;
        recordStat('cards', fouler, defTeam.team);
        recordStat('yellows', fouler, defTeam.team);
        if (!m.playerMatchStats) m.playerMatchStats = {};
        if (!m.playerMatchStats[fouler.id]) m.playerMatchStats[fouler.id] = blankPlayerMatchStats(fouler);
        m.playerMatchStats[fouler.id].yellow = true;
        if (m.cards[defendingSide][fouler.id] >= 2) {
          defTeam.stats.reds++;
          recordStat('reds', fouler, defTeam.team);
          m.playerMatchStats[fouler.id].red = true;
          addEvent(m.minute, 'red', `🟥 Second yellow → red! ${foulText}`, defendingSide);
          removeFromPitch(defendingSide, fouler.id);
        } else {
          addEvent(m.minute, 'yellow', `🟨 Yellow card — ${foulText}${foulCount > 1 ? ' (repeated fouls)' : ''}`, defendingSide);
        }
      } else {
        addEvent(m.minute, 'foul', foulText + (foulCount > 1 ? ' — referee has a word' : ''), defendingSide);
      }
    
} else if (r < 0.55) {
      const taker = pickPlayer(attTeam, ['CAM','CM','ST','RW','LW']);
      if (taker && Math.random() < 0.18) {
        attTeam.stats.shots++;
        const fk = pickFkOutcome();
        addEvent(m.minute, 'shot', `<span class="player">${taker.name}</span> stands over the free-kick...`, attackingSide);
        if (fk.scored) {
          attTeam.stats.shotsOn++;
          attTeam.score++;
          recordStat('goals', taker, attTeam.team);
          if (!m.playerMatchStats) m.playerMatchStats = {};
          if (!m.playerMatchStats[taker.id]) m.playerMatchStats[taker.id] = blankPlayerMatchStats(taker);
          m.playerMatchStats[taker.id].goals++;
          m.playerMatchStats[taker.id].xg += 0.12 + Math.random() * 0.1;
          pushGoal(attackingSide, taker, m.minute, fk.text);
          addEvent(m.minute, 'goal', `⚽ Free-kick goal! <span class="player">${taker.name}</span> — ${fk.text}`, attackingSide, true);
          if (Math.random() < 0.55) recordStat('puskas', taker, attTeam.team);
        } else {
          if (fk.text.includes('keeper') || fk.text.includes('tips')) {
            attTeam.stats.shotsOn++;
            const gk = pickPlayer(defTeam, ['GK']);
            if (gk) { defTeam.stats.saves++; recordStat('saves', gk, defTeam.team); }
          }
          addEvent(m.minute, 'miss', `Free-kick from <span class="player">${taker.name}</span> — ${fk.text}`, attackingSide);
        }
      }
    } else if (r < 0.58) {
      // Flavor text only — the actual pass volume/accuracy is already tracked
      // every minute in simulateMinutePassing(), so we just narrate it here.
      const p = pickPlayer(attTeam, ['CM','CAM','CDM','RB','LB','CB','RW','LW']);
      if (p && Math.random() < 0.3) {
        const ps = (m.playerMatchStats && m.playerMatchStats[p.id]) || null;
        const pAcc = ps && ps.passes ? Math.round(100 * (ps.passesCompleted || 0) / ps.passes) : null;
        addEvent(m.minute, 'pass',
          pAcc != null
            ? `Pass. <span class="player">${p.name}</span> (${attTeam.team.short}) — ${pAcc}% passing accuracy so far.`
            : `Pass. <span class="player">${p.name}</span> (${attTeam.team.short}) keeps the move going.`,
          attackingSide);
      }
    } else if (r < 0.66) {
      const def = pickPlayer(defTeam, ['CB','CDM','CM','RB','LB']);
      if (def) {
        if (!m.playerMatchStats) m.playerMatchStats = {};
        if (!m.playerMatchStats[def.id]) m.playerMatchStats[def.id] = blankPlayerMatchStats(def);
        if (Math.random() < 0.55) {
          defTeam.stats.interceptions = (defTeam.stats.interceptions || 0) + 1;
          m.playerMatchStats[def.id].interceptions = (m.playerMatchStats[def.id].interceptions || 0) + 1;
          m.playerMatchStats[def.id].tackles = (m.playerMatchStats[def.id].tackles || 0) + 1;
          if (Math.random() < 0.45) {
            addEvent(m.minute, 'pass', `Interception by <span class="player">${def.name}</span> (${defTeam.team.short}).`, defendingSide);
          }
        } else {
          defTeam.stats.blocks = (defTeam.stats.blocks || 0) + 1;
          m.playerMatchStats[def.id].blocks = (m.playerMatchStats[def.id].blocks || 0) + 1;
          if (Math.random() < 0.45) {
            addEvent(m.minute, 'shot', `Attempt blocked. Blocked by <span class="player">${def.name}</span> (${defTeam.team.short}).`, defendingSide);
          }
        }
      }
    } else if (r < 0.72) {
      const p = pickPlayer(attTeam, ['ST','RW','LW']);
      if (p) addEvent(m.minute, 'offside', `Offside against <span class="player">${p.name}</span>`, attackingSide);
    } else if (r < 0.8) {
      const p = pickPlayer(attTeam, ['ST','CAM','RW','LW']);
      if (p) {
        attTeam.stats.shots++;
        addEvent(m.minute, 'miss', `Big chance missed by <span class="player">${p.name}</span>!`, attackingSide);
      }
    } else if (r < 0.85) {
      // Skill move / dribble
      const p = pickPlayer(attTeam, ['RW','LW','CAM','ST','RM','LM']);
      if (p && Math.random() < 0.5) {
        addEvent(m.minute, 'skill', `✨ Skill move by <span class="player">${p.name}</span>! Beats the defender`, attackingSide);
      }
    } else if (r < 0.9) {
      // Handball
      const p = pickPlayer(defTeam, ['CB','RB','LB','CDM','ST']);
      if (p) {
        defTeam.stats.fouls++;
        addEvent(m.minute, 'handball', `Handball against <span class="player">${p.name}</span> — referee points to the spot`, defendingSide);
        if (Math.random() < 0.10) {
          const taker = pickPlayerWeighted(attTeam, ['ST','RW','LW','CAM','CM'], PEN_TAKER_ROLE_WEIGHT);
          if (taker) {
            addEvent(m.minute, 'pen', `Penalty to ${attTeam.team.short}. <span class="player">${taker.name}</span> on the spot.`, attackingSide);
            attTeam.stats.shots++;
            if (!m.playerMatchStats) m.playerMatchStats = {};
            if (!m.playerMatchStats[taker.id]) m.playerMatchStats[taker.id] = blankPlayerMatchStats(taker);
            m.playerMatchStats[taker.id].shots++;
            const po = pickPenOutcome();
            if (po.scored) {
              attTeam.stats.shotsOn++;
              attTeam.score++;
              recordStat('goals', taker, attTeam.team);
              m.playerMatchStats[taker.id].goals++;
              m.playerMatchStats[taker.id].xg += 0.76 + Math.random() * 0.08;
              pushGoal(attackingSide, taker, m.minute, 'penalty — ' + po.text);
              addEvent(m.minute, 'goal', `⚽ Penalty goal! <span class="player">${taker.name}</span> ${po.text}`, attackingSide, true);
            } else {
              const gk = pickPlayer(defTeam, ['GK']);
              if (po.text.includes('saved') || po.text.includes('palms') || po.text.includes('hand')) {
                attTeam.stats.shotsOn++;
                if (gk) { defTeam.stats.saves++; recordStat('saves', gk, defTeam.team); }
              }
              addEvent(m.minute, 'miss', `Penalty missed — <span class="player">${taker.name}</span>: ${po.text}`, attackingSide);
            }
          }
        }
      }
    } else if (r < 0.94) {
      // VAR — coherent sequence for one side
      const varSide = attackingSide;
      const varTeam = attTeam;
      const defSide = defendingSide;
      const scenario = Math.random();
      if (scenario < 0.42) {
        // Potential goal review
        addEvent(m.minute, 'var', `📺 VAR checking possible offside in the build-up (${varTeam.team.short})...`, varSide);
        if (Math.random() < 0.55) {
          addEvent(m.minute, 'var', `VAR: Goal stands for ${varTeam.team.short}`, varSide);
        } else {
          addEvent(m.minute, 'var', `VAR: Goal disallowed — offside against ${varTeam.team.short}`, varSide);
        }
      } else if (scenario < 0.87) {
        // Penalty review for attacking team
        const fouled = pickPlayer(attTeam, ['ST','RW','LW','CAM']);
        const fouler = pickPlayer(defTeam, ['CB','RB','LB','CDM']);
        addEvent(m.minute, 'var', `📺 VAR checking penalty claim — foul on ${fouled?fouled.name:'attacker'} by ${fouler?fouler.name:'defender'} (${varTeam.team.short})...`, varSide);
        if (Math.random() < 0.5) {
          addEvent(m.minute, 'var', `VAR: Penalty awarded to ${varTeam.team.short}!`, varSide);
          const taker = pickPlayerWeighted(attTeam, ['ST','RW','LW','CAM','CM'], PEN_TAKER_ROLE_WEIGHT) || fouled;
          if (taker) {
            addEvent(m.minute, 'pen', `Penalty to ${varTeam.team.short}. <span class="player">${taker.name}</span> places the ball on the spot.`, varSide);
            attTeam.stats.shots++;
            if (!m.playerMatchStats) m.playerMatchStats = {};
            if (!m.playerMatchStats[taker.id]) m.playerMatchStats[taker.id] = blankPlayerMatchStats(taker);
            m.playerMatchStats[taker.id].shots++;
            const po = pickPenOutcome();
            if (po.scored) {
              attTeam.stats.shotsOn++;
              attTeam.score++;
              recordStat('goals', taker, attTeam.team);
              m.playerMatchStats[taker.id].goals++;
              m.playerMatchStats[taker.id].xg += 0.76 + Math.random() * 0.08;
              pushGoal(varSide, taker, m.minute, 'penalty — ' + po.text);
              addEvent(m.minute, 'goal', `⚽ Penalty goal! <span class="player">${taker.name}</span> ${po.text}`, varSide, true);
            } else {
              const gk = pickPlayer(defTeam, ['GK']);
              if (po.text.includes('saved') || po.text.includes('palms') || po.text.includes('hand')) {
                attTeam.stats.shotsOn++;
                if (gk) { defTeam.stats.saves++; recordStat('saves', gk, defTeam.team); }
              }
              addEvent(m.minute, 'miss', `Penalty missed — <span class="player">${taker.name}</span>: ${po.text}`, varSide);
            }
          }
        } else {
          addEvent(m.minute, 'var', `VAR: No penalty — play on`, null);
        }
      } else {
        // Red card review
        const player = pickPlayer(defTeam, ['CB','ST','CDM','CM']);
        addEvent(m.minute, 'var', `📺 VAR checking possible red card (${defTeam.team.short})...`, defSide);
        if (player && Math.random() < 0.16) {
          defTeam.stats.reds++;
          recordStat('reds', player, defTeam.team);
          if (!m.playerMatchStats) m.playerMatchStats = {};
          if (!m.playerMatchStats[player.id]) m.playerMatchStats[player.id] = blankPlayerMatchStats(player);
          m.playerMatchStats[player.id].red = true;
          addEvent(m.minute, 'red', `VAR: Red card! <span class="player">${player.name}</span> (${defTeam.team.short}) sent off`, defSide);
          removeFromPitch(defSide, player.id);
        } else {
          const noRedLines = [
            `VAR: No red card — challenge by ${player ? player.name : 'the defender'} was mistimed but not violent conduct`,
            `VAR: Yellow card only — ${player ? player.name : 'player'} caught the man, not excessive force`,
            `VAR: On-field decision stands — no red card for ${player ? player.name : 'the defender'}`,
            `VAR: Review complete — foul confirmed, yellow sufficient for ${player ? player.name : 'the challenge'}`
          ];
          addEvent(m.minute, 'var', noRedLines[Math.floor(Math.random() * noRedLines.length)], defSide);
          if (player && Math.random() < 0.5 && (m.cards[defSide][player.id] || 0) < 1) {
            m.cards[defSide][player.id] = (m.cards[defSide][player.id] || 0) + 1;
            defTeam.stats.yellows++;
            recordStat('yellows', player, defTeam.team);
            if (!m.playerMatchStats) m.playerMatchStats = {};
            if (!m.playerMatchStats[player.id]) m.playerMatchStats[player.id] = blankPlayerMatchStats(player);
            m.playerMatchStats[player.id].yellow = true;
            addEvent(m.minute, 'yellow', `🟨 Yellow card — <span class="player">${player.name}</span> booked after VAR review`, defSide);
          }
        }
      }
    } else if (r < 0.97 && Math.random() < 0.18) {
      const rare = Math.random();
      const att = pickPlayer(attTeam, ['ST','CAM','RW','LW','CM']);
      const def = pickPlayer(defTeam, ['CB','RB','LB','CDM']);
      if (rare < 0.12) {
        addEvent(m.minute, 'whistle', `Rain starts to lash the pitch — footing becomes tricky`, null);
      } else if (rare < 0.24 && att) {
        addEvent(m.minute, 'miss', `<span class="player">${att.name}</span> steals in at the far post but side-foots wide of the upright`, attackingSide);
      } else if (rare < 0.36) {
        addEvent(m.minute, 'whistle', `Stoppage as the referee speaks to both captains after a flare-up`, null);
      } else if (rare < 0.48 && def) {
        addEvent(m.minute, 'foul', `<span class="player">${def.name}</span> times a sliding tackle to perfection on the edge of the box`, defendingSide);
      } else if (rare < 0.58 && att) {
        addEvent(m.minute, 'skill', pickSkillDesc(att, pickPlayer(defTeam, ['CB','RB','LB','CDM','CM'])), attackingSide);
      } else if (rare < 0.68 && att) {
        addEvent(m.minute, 'pass', `<span class="player">${att.name}</span> threads a defence-splitting ball into the channel`, attackingSide);
      } else if (rare < 0.78) {
        const gk = pickPlayer(defTeam, ['GK']);
        if (gk) addEvent(m.minute, 'save', `<span class="player">${gk.name}</span> rushes off the line to smother a through ball`, defendingSide);
      } else if (rare < 0.88 && att) {
        addEvent(m.minute, 'shot', `<span class="player">${att.name}</span> hits a first-time volley — always rising over the bar`, attackingSide);
        attTeam.stats.shots++;
      } else {
        addEvent(m.minute, 'whistle', `The crowd sense a goal — noise levels rise as ${attTeam.team.short} advance`, null);
      }
    } else if (Math.random() < 0.35) {
      const lines = [
        `${attTeam.team.short} recycle possession in the final third`,
        `${attTeam.team.short} work an opening down the flank`,
        `Patient build-up from ${attTeam.team.short}`,
        `${defTeam.team.short} hold a high line under pressure`,
        `Cross claimed comfortably — ${defTeam.team.short} clear`
      ];
      addEvent(m.minute, 'pressure', lines[Math.floor(Math.random()*lines.length)], attackingSide);
    }
  }

  function calcTeamStrength(side) {
    if (!currentMatch || !side) return { att: 50, def: 50, tec: 50 };
    const isHome = side === currentMatch.home;
    const ids = isHome ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    const onPitch = (side.squad.all || []).filter(p => ids.includes(p.id));
    if (!onPitch.length) return { att: 50, def: 50, tec: 50 };
    const mgr = (side.team.manager && side.team.manager.ovr) || 75;
    const avg = (key, fallback) => onPitch.reduce((s, p) => s + (p[key] != null ? p[key] : fallback), 0) / onPitch.length;
    return {
      att: avg('att', 70) + (mgr - 75) * 0.12,
      def: avg('def', 70) + (mgr - 75) * 0.1,
      tec: avg('tec', 70),
      ovr: avg('ovr', 75),
      phy: avg('phy', 70),
      pac: avg('pac', 70)
    };
  }

  function pickPlayer(side, preferredPos, excludeId) {
    if (!currentMatch || !side) return null;
    const ids = side === currentMatch.home ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    let pool = (side.squad.all || []).filter(p => ids.includes(p.id) && p.id !== excludeId);
    if (preferredPos && preferredPos.length) {
      const preferred = pool.filter(p => (p.pos || []).some(pos => preferredPos.includes(pos)) || preferredPos.includes(p.slot));
      if (preferred.length) pool = preferred;
    }
    if (!pool.length) return null;
    // Weight selection toward higher ovr / relevant attrs
    const weights = pool.map(p => {
      let w = (p.ovr || 70) + (p.att || 70) * 0.3 + (p.tec || 70) * 0.2;
      return Math.max(5, w);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  // Realistic role tendencies: strikers/wingers get on the scoresheet far more
  // than they create, while attacking mids/central mids are the primary creators.
  // Defenders/holding mids chip in occasionally (set pieces, late runs) but rarely lead scoring.
  // NOTE: these weights combine multiplicatively with each player's own attributes
  // (att/ovr/tec) in pickPlayerWeighted, and strikers/wingers already carry higher
  // 'att' ratings than midfielders. A wide spread here compounds with that and makes
  // strikers score far more than real-world scoring share (~ST 35-40%, wide/CAM
  // ~35-40%, CM/deep ~15-20%, defenders ~5-8%). Keep the spread modest.
  const GOAL_ROLE_WEIGHT = { ST: 1.9, CF: 1.9, RW: 1.7, LW: 1.7, CAM: 1.4, RM: 1.25, LM: 1.25, CM: 0.85, CDM: 0.45, RWB: 0.35, LWB: 0.35, RB: 0.3, LB: 0.3, CB: 0.2, GK: 0.01 };
  const ASSIST_ROLE_WEIGHT = { CAM: 2.0, CM: 1.75, RW: 1.65, LW: 1.65, RM: 1.4, LM: 1.4, ST: 1.0, CF: 1.0, CDM: 0.85, RWB: 0.8, LWB: 0.8, RB: 0.8, LB: 0.8, CB: 0.25, GK: 0.02 };
  // Penalty duty in real football overwhelmingly goes to strikers/wingers, with the
  // occasional attacking mid; deep midfielders almost never take them.
  const PEN_TAKER_ROLE_WEIGHT = { ST: 3.3, CF: 3.3, RW: 2.5, LW: 2.5, CAM: 1.0, RM: 0.7, LM: 0.7, CM: 0.3, CDM: 0.1, CB: 0.05 };

  // Like pickPlayer, but multiplies selection weight by a role-tendency table so
  // (for example) strikers/wingers are picked as goalscorers far more often than
  // central/defensive midfielders, matching real-world scoring distributions.
  function pickPlayerWeighted(side, preferredPos, roleWeights, excludeId) {
    if (!currentMatch || !side) return null;
    const ids = side === currentMatch.home ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    let pool = (side.squad.all || []).filter(p => ids.includes(p.id) && p.id !== excludeId);
    if (preferredPos && preferredPos.length) {
      const preferred = pool.filter(p => (p.pos || []).some(pos => preferredPos.includes(pos)) || preferredPos.includes(p.slot));
      if (preferred.length) pool = preferred;
    }
    if (!pool.length) return null;
    const weights = pool.map(p => {
      const slot = p.slot || (p.pos || [])[0] || 'CM';
      const roleW = (roleWeights && roleWeights[slot] != null) ? roleWeights[slot] : 1;
      const w = ((p.ovr || 70) + (p.att || 70) * 0.3 + (p.tec || 70) * 0.2) * roleW;
      return Math.max(1, w);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }


  function trySubstitution(side) {
    const m = currentMatch;
    if (!m) return;
    const sideData = m[side];
    const used = side === 'home' ? m.homeSubsUsed : m.awaySubsUsed;
    if (used >= (m.maxSubs || 5)) return;
    const onPitchIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    // Anyone currently on pitch (starter or previous sub)
    const allPlayers = [...(sideData.squad.starting || []), ...(sideData.squad.subs || [])];
    const onPitch = allPlayers.filter(p => onPitchIds.includes(p.id) && !m.injuries.includes(p.id));
    // Prefer lower rated / tired-looking out
    const sorted = [...onPitch].sort((a, b) => (a.ovr || 70) - (b.ovr || 70));
    const candidatesOut = sorted.filter(p => (p.slot || (p.pos||[])[0]) !== 'GK').slice(0, Math.max(2, Math.floor(sorted.length / 2)));
    if (!candidatesOut.length) return;
    const outPlayer = candidatesOut[Math.floor(Math.random() * candidatesOut.length)];
    const availableSubs = (sideData.squad.subs || []).filter(p => !onPitchIds.includes(p.id) && !m.injuries.includes(p.id));
    if (!availableSubs.length) return;
    let candidatesIn = availableSubs.filter(p => canPlay(p, outPlayer.slot || (outPlayer.pos||[])[0]));
    if (!candidatesIn.length) candidatesIn = availableSubs;
    candidatesIn.sort((a, b) => (b.ovr || 70) - (a.ovr || 70));
    const top = candidatesIn.slice(0, Math.min(3, candidatesIn.length));
    const inPlayer = top[Math.floor(Math.random() * top.length)];
    const idx = onPitchIds.indexOf(outPlayer.id);
    if (idx >= 0) onPitchIds[idx] = inPlayer.id;
    if (side === 'home') m.homeSubsUsed++; else m.awaySubsUsed++;
    if (!m.subLog) m.subLog = { home: {}, away: {} };
    m.subLog[side][outPlayer.id] = Object.assign({}, m.subLog[side][outPlayer.id] || {}, { outMin: m.minute, replacedBy: inPlayer.name });
    m.subLog[side][inPlayer.id] = Object.assign({}, m.subLog[side][inPlayer.id] || {}, { inMin: m.minute, replaced: outPlayer.name });
    // Carry slot for in player
    inPlayer.slot = outPlayer.slot || (outPlayer.pos || ['CM'])[0];
    addEvent(m.minute, 'sub',
      `Substitution · ${sideData.team.short}<br><span style="color:#4ade80">▲ In</span> <span class="player">${inPlayer.name}</span><br><span style="color:#f87171">▼ Out</span> <span class="player">${outPlayer.name}</span> <span style="opacity:0.6">(${used+1}/${m.maxSubs})</span>`,
      side);
    if (!m.silentDeep) { renderLineups(); renderPitch(); }
  }

  function changeFormationLive(side, formKey) {
    const m = currentMatch;
    if (!m || m.finished) return;
    if (!FORMATIONS[formKey]) return;
    const sideData = m[side];
    sideData.squad.formation = formKey;
    // Reassign slots for on-pitch players by best fit
    const onIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const all = [...(sideData.squad.starting||[]), ...(sideData.squad.subs||[])];
    const onPitch = onIds.map(id => all.find(p => p.id === id)).filter(Boolean);
    const slots = FORMATIONS[formKey].slots.slice();
    const used = new Set();
    const assigned = [];
    slots.forEach(slot => {
      const cand = onPitch.filter(p => !used.has(p.id) && canPlay(p, slot))
        .sort((a,b) => ((b.pos||[]).includes(slot)?1:0) - ((a.pos||[]).includes(slot)?1:0) || (b.ovr||0)-(a.ovr||0));
      if (cand[0]) { used.add(cand[0].id); cand[0].slot = slot; assigned.push(cand[0]); }
    });
    onPitch.filter(p => !used.has(p.id)).forEach((p, i) => {
      p.slot = slots[assigned.length + i] || (p.pos||['CM'])[0];
    });
    addEvent(m.minute, 'whistle', `📐 ${sideData.team.short} switch shape to ${formKey}`, side);
    if (!m.silentDeep) { renderLineups(); updateScoreboard(); }
    toast(sideData.team.short + ' → ' + formKey);
  }

  function setTacticsLive(side, tactic) {
    const m = currentMatch;
    if (!m || m.finished) return;
    if (!m.tactics) m.tactics = { home: 'balanced', away: 'balanced' };
    m.tactics[side] = tactic;
    const labels = { attack: 'all-out attack', balanced: 'balanced approach', defend: 'defensive block', press: 'high press' };
    addEvent(m.minute, 'whistle', `📋 ${m[side].team.short} go ${labels[tactic] || tactic}`, side);
    toast(m[side].team.short + ': ' + (labels[tactic] || tactic));
  }


  function isPlayerInjured(playerId) {
    const rec = injuryBook[playerId];
    return !!rec && rec.matchesLeft > 0;
  }

  function isPlayerSuspended(playerId) {
    const rec = suspensionBook[playerId];
    return !!rec && rec.matchesLeft > 0;
  }

  function tryInjury(side) {
    const m = currentMatch;
    if (!m) return;
    const sideData = m[side];
    const onPitchIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const pool = (sideData.squad.all || []).filter(p => onPitchIds.includes(p.id) && (p.pos || [])[0] !== 'GK' && !isPlayerInjured(p.id));
    if (!pool.length) return;
    const injured = pool[Math.floor(Math.random() * pool.length)];
    const injuryTypes = [
      { type: 'Ankle sprain', min: 1, max: 3 },
      { type: 'Hamstring strain', min: 2, max: 5 },
      { type: 'Knee knock', min: 1, max: 2 },
      { type: 'Calf strain', min: 2, max: 4 },
      { type: 'Shoulder injury', min: 1, max: 3 },
      { type: 'Concussion protocol', min: 1, max: 2 },
      { type: 'Groin strain', min: 2, max: 4 },
      { type: 'Fractured metatarsal', min: 4, max: 8 },
      { type: 'ACL concern (precaution)', min: 3, max: 6 },
      { type: 'Muscle fatigue / cramp', min: 1, max: 1 }
    ];
    // Weighted toward minor
    const roll = Math.random();
    let info;
    if (roll < 0.55) info = injuryTypes[Math.floor(Math.random() * 3)];
    else if (roll < 0.85) info = injuryTypes[3 + Math.floor(Math.random() * 4)];
    else info = injuryTypes[7 + Math.floor(Math.random() * 3)];
    const outMatches = info.min + Math.floor(Math.random() * (info.max - info.min + 1));
    injuryBook[injured.id] = {
      type: info.type,
      matchesLeft: outMatches,
      teamName: sideData.team.name,
      playerName: injured.name
    };
    m.injuries.push(injured.id);
    addEvent(m.minute, 'injury',
      `🩹 <span class="player">${injured.name}</span> — ${info.type}. Out for ${outMatches} match${outMatches>1?'es':''}`,
      side);
    try { localStorage.setItem('apexInjuryBook', JSON.stringify(injuryBook)); } catch(e) {}
    const used = side === 'home' ? m.homeSubsUsed : m.awaySubsUsed;
    if (used < m.maxSubs) {
      const availableSubs = (sideData.squad.subs || []).filter(p => !onPitchIds.includes(p.id) && !m.injuries.includes(p.id) && !isPlayerInjured(p.id));
      if (availableSubs.length) {
        let candidates = availableSubs.filter(p => canPlay(p, injured.slot || (injured.pos || ['CM'])[0]));
        if (!candidates.length) candidates = availableSubs;
        candidates.sort((a, b) => (b.ovr || 70) - (a.ovr || 70));
        const inPlayer = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))];
        const idx = onPitchIds.indexOf(injured.id);
        if (idx >= 0) onPitchIds[idx] = inPlayer.id;
        if (side === 'home') m.homeSubsUsed++; else m.awaySubsUsed++;
        addEvent(m.minute, 'sub', `Forced sub: <span class="player">${inPlayer.name}</span> replaces injured <span class="player">${injured.name}</span>`, side);
      } else {
        removeFromPitch(side, injured.id);
      }
    } else {
      removeFromPitch(side, injured.id);
    }
  }

  function removeFromPitch(side, playerId) {
    if (!currentMatch) return;
    const arr = side === 'home' ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    const idx = arr.indexOf(playerId);
    if (idx >= 0) arr.splice(idx, 1);
  }

  
  function renderMomentumAndHeat() {
    const m = currentMatch;
    if (!m || m.silentDeep) return;
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
        const col = Math.floor(Math.random() * 3);
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
      // Deterministic baseline for players who saw the pitch (no random — fair awards)
      if (onIds.has(p.id)) {
        const pos = (ps.pos || '').toUpperCase();
        const isGK = pos === 'GK' || (ps.posArr||[]).includes('GK');
        const isDef = ['CB','RB','LB','RWB','LWB'].some(x => pos.includes(x) || (ps.posArr||[]).includes(x));
        const isMid = ['CM','CDM','CAM','RM','LM'].some(x => pos.includes(x) || (ps.posArr||[]).includes(x));
        if (isGK) {
          if (!(ps.saves > 0)) ps.saves = Math.max(ps.saves || 0, 1);
          if (!(ps.passes > 0)) { ps.passes = 6; ps.passesCompleted = 5; }
        } else if (isDef) {
          if (!(ps.tackles > 0)) ps.tackles = 2;
          if (!(ps.passes > 0)) { ps.passes = 12; ps.passesCompleted = 10; }
        } else if (isMid) {
          if (!(ps.passes > 0)) { ps.passes = 18; ps.passesCompleted = 15; }
          if (!(ps.tackles > 0)) ps.tackles = 1;
        } else {
          if (!(ps.passes > 0)) { ps.passes = 8; ps.passesCompleted = 6; }
        }
      }
      // Clean sheet flag for GK rating
      if ((ps.pos === 'GK' || (ps.posArr||[]).includes('GK'))) {
        const side = (m.home.squad.all||[]).find(x => x.id === p.id) ? 'home' : 'away';
        if ((side === 'home' && m.away.score === 0) || (side === 'away' && m.home.score === 0)) ps.cleanSheet = true;
      }
      ps.rating = calcPlayerRating(ps);
      const teamObj = (m.home.squad.all||[]).find(x=>x.id===p.id) ? m.home.team : m.away.team;
      recordRating(p, teamObj, ps.rating);
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
    if (tournament || window._fromTournament || typeof window._tourFixtureIdx === 'number' || typeof window._koRoundIdx === 'number' || typeof window._uclFixtureIdx === 'number') {
      const backBtn = document.getElementById('back-to-tournament');
      if (backBtn) {
        backBtn.style.display = 'flex';
        backBtn.classList.add('show');
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
          km.winner = Math.random() < 0.5 ? km.home : km.away;
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
  }

    // Always offer return after any tournament-linked live match
    if (tournament || window._fromTournament) {
      const backBtn = document.getElementById('back-to-tournament');
      if (backBtn) { backBtn.style.display = 'flex'; backBtn.classList.add('show'); }
    }

  function addEvent(minute, type, text, side, isGoal) {
    if (!currentMatch) return;
    currentMatch.events.push({ minute, type, text, side });
    if (currentMatch.silentDeep) return;
    const feed = document.getElementById('events-feed');
    if (!feed) return;
    const icons = { goal: '⚽', save: '🧤', yellow: '🟨', red: '🟥', sub: '🔄', injury: '🩹', corner: '🚩', foul: '⚠️', shot: '👟', miss: '❌', pass: '➡️', offside: '🚫', whistle: '📢', pressure: '🔥', motm: '⭐', var: '📺', pen: '⚽', skill: '✨', handball: '✋', et: '⏱️' };
    const div = document.createElement('div');
    div.className = 'event-item' + (isGoal || type === 'goal' ? ' event-goal' : '') + (type === 'red' ? ' event-card-red' : '') + (type === 'injury' ? ' event-injury' : '') + (type === 'var' ? ' event-var' : '') + (type === 'pen' ? ' event-pen' : '');
    div.innerHTML = `<span class="event-time">${minute}'</span><span class="event-icon">${icons[type] || '•'}</span><span class="event-text">${text}</span>`;
    feed.insertBefore(div, feed.firstChild);
    if (['goal','sub','yellow','red','injury','pen'].includes(type)) {
      try { renderLineups(); } catch (e) {}
    }
  }

  function updateScoreboard() {
    if (!currentMatch) return;
    if (currentMatch.silentDeep) return;
    const m = currentMatch;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('live-home-flag', m.home.team.flag || '');
    set('live-home-name', m.home.team.short || m.home.team.name);
    set('live-home-form', (FORMATIONS[m.home.squad.formation] || {}).name || '');
    set('live-away-flag', m.away.team.flag || '');
    set('live-away-name', m.away.team.short || m.away.team.name);
    set('live-away-form', (FORMATIONS[m.away.squad.formation] || {}).name || '');
    const hm = document.querySelector('.score-team.home .mgr');
    const am = document.querySelector('.score-team.away .mgr');
    if (hm) hm.textContent = m.home.team.manager ? m.home.team.manager.name : '';
    if (am) am.textContent = m.away.team.manager ? m.away.team.manager.name : '';
    const hs = m.home.penScore != null ? `${m.home.score} (${m.home.penScore})` : m.home.score;
    const as_ = m.away.penScore != null ? `${m.away.score} (${m.away.penScore})` : m.away.score;
    set('live-home-score', hs);
    set('live-away-score', as_);
    set('live-minute', m.inPens ? 'Pens' : (m.minute + "'"));
    set('live-status', m.status);
    set('live-venue', '🏟️ ' + getStadium(m.home.team));
    renderGoalTimeline();
  }

  function updateStatsPanel() {
    if (!currentMatch) return;
    if (currentMatch.silentDeep) return;
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
        for (let t = 0; t < 6; t++) {
          if (!used.some(u => Math.hypot(u.x - x, u.y - y) < 8)) break;
          x = Math.max(10, Math.min(90, x + (t % 2 ? 6 : -6)));
          y = Math.max(8, Math.min(92, y + (t % 3 ? 5 : -4)));
        }
        used.push({ x, y });
        const label = (p.name || '').split(' ').pop();
        const isSubOn = (s.squad.subs || []).some(sub => sub.id === p.id);
        dots += `<div class="player-dot${isSubOn ? ' sub-on' : ''}" style="left:${x}%;top:${y}%;background:${primary};color:${textCol};border:2px solid ${secondary}">
          <span class="dot-num">${p.num || ''}</span>
          <span class="dot-name">${label}</span>
        </div>`;
      });
      return `<div class="mini-pitch team-pitch">
        <div class="pitch-label">${s.team.flag || ''} ${s.team.short} · ${form.name}</div>
        ${dots}
      </div>`;
    };

    wrap.innerHTML = `<div class="pitch-pair">${drawTeam('home')}${drawTeam('away')}</div>`;
  }


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

  function liveRatingBadge(ps) {
    if (!ps) return '<span class="rating-badge rating-mid">6.0</span>';
    const r = calcPlayerRating(ps);
    ps.rating = r;
    const cls = r >= 7.5 ? 'rating-high' : r >= 6.5 ? 'rating-mid' : 'rating-low';
    return `<span class="rating-badge ${cls}">${r.toFixed(1)}</span>`;
  }

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
        <span class="player-name">${p.name}${sentOff ? ' <span class="sent-off-tag">SENT OFF</span>' : ''}</span>
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
        <h4>${s.team.flag || ''} ${s.team.short || s.team.name} · ${form}
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
    if (ctrl && !m.finished && !m.silentDeep) {
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


  function recordRating(player, team, rating) {
    if (!player || !team) return;
    const competitive = !!(tournament || (currentMatch && currentMatch.countForLeaderboard));
    if (competitive) {
    if (!stats.ratings) stats.ratings = {};
    if (!stats.ratings[player.id]) {
      const aff = findPlayerTeams(player.id);
      stats.ratings[player.id] = { id: player.id, name: player.name, team: team.name, teamId: team.id, count: 0, sum: 0, avg: 0, national: aff.national, club: aff.club };
    }
    const e = stats.ratings[player.id];
    e.count++;
    e.sum += rating;
    e.avg = Math.round((e.sum / e.count) * 100) / 100;
    }
    if (tournament) {
      if (!tournamentStats.ratings) tournamentStats.ratings = {};
      if (!tournamentStats.ratings[player.id]) {
        const aff = findPlayerTeams(player.id);
        tournamentStats.ratings[player.id] = { id: player.id, name: player.name, team: team.name, teamId: team.id, count: 0, sum: 0, avg: 0, national: aff.national, club: aff.club };
      }
      const te = tournamentStats.ratings[player.id];
      te.count++;
      te.sum += rating;
      te.avg = Math.round((te.sum / te.count) * 100) / 100;
    }
  }

  function findPlayerTeams(playerId) {
    let national = null, club = null;
    (teamsData.national || []).forEach(t => {
      if ((t.players || []).some(p => p.id === playerId)) national = t.name;
    });
    (teamsData.club || []).forEach(t => {
      if ((t.players || []).some(p => p.id === playerId)) club = t.name;
    });
    // Same player may only exist on one team in our data; also check by name match across
    if (!national || !club) {
      let pname = null;
      allTeams.forEach(t => {
        const p = (t.players || []).find(x => x.id === playerId);
        if (p) pname = p.name;
      });
      if (pname) {
        (teamsData.national || []).forEach(t => {
          if ((t.players || []).some(p => p.name === pname)) national = t.name;
        });
        (teamsData.club || []).forEach(t => {
          if ((t.players || []).some(p => p.name === pname)) club = t.name;
        });
      }
    }
    return { national, club };
  }

  function recordStat(type, player, team) {
    if (!player || !team) return;
    // Friendlies do not feed global leaderboard — only competitive (tournament) matches
    const competitive = !!(tournament || (currentMatch && currentMatch.countForLeaderboard));
    if (competitive) {
      if (!stats[type]) stats[type] = {};
      if (!stats[type][player.id]) {
        const aff = findPlayerTeams(player.id);
        stats[type][player.id] = {
          id: player.id, name: player.name, team: team.name, teamId: team.id, count: 0,
          national: aff.national, club: aff.club
        };
      }
      stats[type][player.id].count++;
    }
    if (tournament) {
      if (!tournamentStats[type]) tournamentStats[type] = {};
      if (!tournamentStats[type][player.id]) {
        const aff = findPlayerTeams(player.id);
        tournamentStats[type][player.id] = {
          id: player.id, name: player.name, team: team.name, teamId: team.id, count: 0,
          national: aff.national, club: aff.club
        };
      }
      tournamentStats[type][player.id].count++;
    }
  }

  function saveStats() {
    try {
      localStorage.setItem('apexSimStats', JSON.stringify(stats));
      localStorage.setItem('apexInjuryBook', JSON.stringify(injuryBook));
      localStorage.setItem('apexSuspensionBook', JSON.stringify(suspensionBook));
      localStorage.setItem('apexMatchDay', String(globalMatchDay));
    } catch(e) {}
  }
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
    } catch(e) {}
  }

  function resetLeaderboard() {
    if (!confirm('Reset all leaderboard stats? This cannot be undone.')) return;
    stats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, cards: {}, motm: {}, puskas: {}, ratings: {} };
    tournamentStats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, motm: {}, ratings: {}, puskas: {} };
    // Clear previous tournament UI
    const clearIds = ['tour-stats-preview', 'tour-awards', 'tour-podium', 'bracket', 'groups-container', 'fixture-list'];
    clearIds.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    const st = document.getElementById('tour-stage-title');
    if (st) st.textContent = 'Starting…';
    try { localStorage.removeItem('apexSimStats'); } catch(e) {}
    saveStats();
    showLeaderboard('goals');
    toast('Leaderboard reset');
  }

  function showLeaderboard(type) {
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.toggle('active', t.dataset.lb === type));
    let data;
    if (type === 'ratings') {
      data = Object.values(stats.ratings || {}).filter(x => x.count > 0).sort((a, b) => b.avg - a.avg || b.count - a.count).slice(0, 20);
    } else {
      data = Object.values(stats[type] || {}).sort((a, b) => b.count - a.count).slice(0, 20);
    }
    const el = document.getElementById('leaderboard-content');
    if (!el) return;
    if (!data.length) {
      el.innerHTML = `<div class="empty-state"><div class="icon">📊</div><p>No ${type} recorded yet. Simulate matches!</p></div>`;
      return;
    }
    const labels = { goals: 'Goals', assists: 'Assists', saves: 'Saves', cleanSheets: 'Clean Sheets', yellows: 'Yellow Cards', reds: 'Red Cards', cards: 'Cards', motm: 'MOTM', puskas: 'Puskas Nominees', ratings: 'Avg Rating' };
    const appsCol = type === 'ratings' ? '' : '<th>Apps</th>';
    el.innerHTML = `<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th>${appsCol}<th>${labels[type]||type}</th></tr></thead><tbody>
      ${data.map((p,i) => {
        const aff = [p.national, p.club].filter(Boolean).join(' · ') || p.team;
        const apps = (stats.ratings && stats.ratings[p.id]) ? stats.ratings[p.id].count : 0;
        const appsCell = type === 'ratings' ? '' : `<td>${apps}</td>`;
        return `<tr><td class="lb-rank">${i+1}</td><td class="lb-player">${p.name}</td><td class="lb-team">${aff}</td>${appsCell}<td style="font-weight:700;color:var(--accent-gold)">${type==='ratings' ? (p.avg!=null?p.avg.toFixed(2):'—')+' ('+p.count+' apps)' : p.count}</td></tr>`;
      }).join('')}
    </tbody></table></div>`;
  }

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
        <span>${t.flag || ''} ${t.name}</span>
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


  function selectAllTeams() {
    setTimeout(updateTournamentSelectedCount, 0);
    document.querySelectorAll('#tournament-teams input').forEach(cb => {
      cb.checked = true;
      const parent = cb.closest('.team-check');
      if (parent) parent.classList.add('selected');
    });
  }
  function deselectAllTeams() {
    document.querySelectorAll('#tournament-teams input').forEach(cb => {
      cb.checked = false;
      const parent = cb.closest('.team-check');
      if (parent) parent.classList.remove('selected');
    });
  }

  function startTournament() {
    const selected = [...document.querySelectorAll('#tournament-teams input:checked')].map(cb => getTeam(cb.value)).filter(Boolean);
    if (selected.length < 4) { toast('Select at least 4 teams'); return; }

    tournamentStats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, motm: {}, ratings: {}, puskas: {} };
    // Clear previous tournament UI
    const clearIds = ['tour-stats-preview', 'tour-awards', 'tour-podium', 'bracket', 'groups-container', 'fixture-list'];
    clearIds.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    const st = document.getElementById('tour-stage-title');
    if (st) st.textContent = 'Starting…';

    if (tournamentType === 'ucl') {
      startUCLTournament(selected);
    } else {
      startWorldCupTournament(selected);
    }

    const setup = document.getElementById('tournament-setup');
    const live = document.getElementById('tournament-live');
    if (setup) setup.style.display = 'none';
    if (live) live.style.display = 'block';
    renderTournamentLeaderboard();
  }

  function startWorldCupTournament(selected) {
    let teams = shuffleArray([...selected]);
    const groupSize = 4;
    let numGroups = Math.floor(teams.length / groupSize);
    if (numGroups < 1) numGroups = 1;
    if (numGroups > 12) numGroups = 12;
    teams = teams.slice(0, numGroups * groupSize);
    if (teams.length < 4) { toast('Need at least 4 teams for groups'); return; }
    const groups = [];
    for (let i = 0; i < numGroups; i++) {
      groups.push({
        name: String.fromCharCode(65 + i),
        teams: teams.slice(i * groupSize, (i + 1) * groupSize).map(t => ({
          team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0
        }))
      });
    }
    tournament = { type: 'worldcup', format: 'groups', groups, knockout: [], stage: 'groups', fixtures: [], champion: null, playoff: [] };
    generateGroupFixtures();
    renderGroups();
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = 'Group Stage';
    const bracket = document.getElementById('bracket');
    if (bracket) bracket.innerHTML = '<p style="color:var(--text-muted)">Knockout bracket appears after groups.</p>';
    const btn = document.getElementById('btn-sim-round');
    if (btn) btn.textContent = 'Simulate Round';
  }

  function startUCLTournament(selected) {
    let teams = shuffleArray([...selected]);
    // Prefer 36; if fewer, use largest even count >= 8 (scale format)
    if (teams.length >= 36) teams = teams.slice(0, 36);
    else if (teams.length % 2 === 1) teams = teams.slice(0, teams.length - 1);
    if (teams.length < 8) { toast('Champions League needs at least 8 clubs (36 ideal)'); return; }

    const league = teams.map(t => ({
      team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0
    }));

    const matchesPerTeam = teams.length >= 36 ? 8 : Math.min(8, teams.length - 1);
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
      matchesPerTeam
    };

    renderUCLLeague();
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = 'League Phase (' + matchesPerTeam + ' matches each)';
    const bracket = document.getElementById('bracket');
    if (bracket) bracket.innerHTML = '<p style="color:var(--text-muted)">Playoffs & knockout appear after the league phase.</p>';
    const btn = document.getElementById('btn-sim-round');
    if (btn) btn.textContent = 'Simulate League Round';
    toast('UCL league phase: ' + teams.length + ' teams, ' + fixtures.length + ' matches');
  }

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

  function blankLeagueRow(team) {
    return { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 };
  }

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

  function sortedLeague() {
    return [...(tournament.league || [])].sort((a, b) =>
      b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf
    );
  }

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
      h += `<tr${mark}><td>${i+1}</td><td>${r.team.flag||''} ${r.team.name}</td><td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td><td>${r.gf}</td><td>${r.ga}</td><td>${gd}</td><td><b>${r.pts}</b></td></tr>`;
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
        h += `<div class="fixture-item"><span class="fixture-teams">${home.flag||''} ${home.short} vs ${away.flag||''} ${away.short}</span>
          <button class="btn btn-primary btn-sm" onclick="App.playUCLFixture(${idx})">▶ Live</button>
          <button class="btn btn-secondary btn-sm" onclick="App.simUCLFixture(${idx})">⚡ Instant</button></div>`;
      });
      if (played.length) {
        h += '<div class="card-title" style="margin-top:12px">Recent Results</div>';
        played.reverse().forEach(f => {
          const home = getTeam(f.home), away = getTeam(f.away);
          const idx = tournament.fixtures.indexOf(f);
          h += `<div class="fixture-item played" style="cursor:pointer" onclick="App.viewFixtureReport(${idx})">
            <span class="fixture-teams">${home.flag||''} ${home.short} ${f.homeScore}-${f.awayScore} ${away.short}</span>
            <span style="font-size:0.7rem;color:var(--accent-gold)">Details</span></div>`;
        });
      }
    }
    if (tournament.stage === 'playoff' || (tournament.playoff && tournament.playoff.length)) {
      h += '<div class="card-title" style="margin-top:12px">Knockout Playoffs (two legs)</div>';
      (tournament.playoff || []).forEach((p, i) => {
        const status = p.played ? (`Agg ${p.aggHome}-${p.aggAway} → ${p.winner ? p.winner.short : ''}`) : (p.leg1 && p.leg1.played ? 'Leg 2' : 'Leg 1');
        h += `<div class="fixture-item ${p.played?'played':''}">
          <span class="fixture-teams">${p.home.flag||''} ${p.home.short} vs ${p.away.flag||''} ${p.away.short} <small>(${status})</small></span>`;
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


  function generateGroupFixtures() {
    tournament.fixtures = [];
    tournament.groups.forEach((g, gi) => {
      const ts = g.teams;
      for (let i = 0; i < ts.length; i++)
        for (let j = i + 1; j < ts.length; j++)
          tournament.fixtures.push({ group: gi, home: ts[i].team.id, away: ts[j].team.id, played: false });
    });
    shuffleArray(tournament.fixtures);
  }

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
        ${sorted.map(t => `<tr><td>${t.team.flag || ''} ${t.team.short}</td><td>${t.played}</td><td>${t.won}</td><td>${t.drawn}</td><td>${t.lost}</td><td>${t.gf - t.ga}</td><td class="pts">${t.pts}</td></tr>`).join('')}
      </tbody></table></div>`;
    }).join('');
    // Fixture list with live play option
    const fixEl = document.getElementById('fixture-list');
    if (fixEl && tournament.stage === 'groups') {
      const unplayed = tournament.fixtures.filter(f => !f.played).slice(0, 8);
      const played = tournament.fixtures.filter(f => f.played).slice(-6);
      let h = '<div class="card-title" style="margin-top:12px">Upcoming Fixtures</div>';
      unplayed.forEach((f, i) => {
        const home = getTeam(f.home), away = getTeam(f.away);
        if (!home || !away) return;
        h += `<div class="fixture-item"><span class="fixture-teams">${home.flag} ${home.short} vs ${away.flag} ${away.short}</span>
          <button class="btn btn-primary btn-sm" onclick="App.playTournamentMatch(${tournament.fixtures.indexOf(f)})">▶ Play Live</button>
          <button class="btn btn-secondary btn-sm" onclick="App.simSingleFixture(${tournament.fixtures.indexOf(f)})">⚡ Instant</button></div>`;
      });
      if (played.length) {
        h += '<div class="card-title" style="margin-top:12px">Recent Results</div>';
        played.reverse().forEach(f => {
          const home = getTeam(f.home), away = getTeam(f.away);
          if (!home || !away) return;
          const idx = tournament.fixtures.indexOf(f);
          h += `<div class="fixture-item played" style="cursor:pointer" onclick="App.viewFixtureReport(${idx})" title="View full match report">
            <span class="fixture-teams">${home.flag} ${home.short} vs ${away.flag} ${away.short}</span>
            <span class="fixture-score">${f.homeScore} - ${f.awayScore}</span>
            <span style="font-size:0.7rem;color:var(--accent-gold);margin-left:6px">Details</span>
          </div>`;
        });
      }
      fixEl.innerHTML = h;
    }
  }

  function simSingleFixture(idx) {
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
  }

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
    switchView('match');
    const homeSel = document.getElementById('home-team');
    const awaySel = document.getElementById('away-team');
    if (homeSel) homeSel.value = home.id;
    if (awaySel) awaySel.value = away.id;
    const formKeys = Object.keys(FORMATIONS);
    const hf = formKeys[Math.floor(Math.random() * formKeys.length)];
    const af = formKeys[Math.floor(Math.random() * formKeys.length)];
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


  function simTournamentRound() {
    if (!tournament) return;
    withLoading('Simulating round…', function() {
      _simTournamentRoundWork();
      refreshTournamentStatsUI();
    });
  }

  function _simTournamentRoundWork() {
    if (!tournament) return;
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
      tournament.playoff.forEach((p, i) => { if (!p.played) simPlayoffTie(i); });
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

  function simAllTournament() {
    if (!tournament) return;
    withLoading('Simulating full tournament…', function() {
      _simAllTournamentWork();
    });
  }

  function _simAllTournamentWork() {
    if (!tournament) return;
    const updateLoading = (msg) => {
      const t = document.getElementById('loading-text');
      if (t) t.textContent = msg;
    };

    // ========== UCL / League format ==========
    if (tournament.format === 'league' || tournament.type === 'ucl') {
      updateLoading('Simulating league phase…');
      (tournament.fixtures || []).forEach((f) => {
        if (f.played) return;
        const home = getTeam(f.home), away = getTeam(f.away);
        if (!home || !away) return;
        const result = simQuickMatch(home, away, { countForLeaderboard: true });
        f.played = true;
        f.homeScore = result.home;
        f.awayScore = result.away;
        f.report = result.report;
        applyLeagueResult(f.home, f.away, result.home, result.away);
      });

      if (tournament.stage === 'league' || !tournament.playoff) {
        try { advanceUCLFromLeague(); } catch (e) { console.warn(e); }
      }

      updateLoading('Simulating playoffs…');
      if (tournament.playoff && tournament.playoff.length) {
        tournament.playoff.forEach((p, i) => {
          if (!p.played) {
            try { simPlayoffTie(i); } catch (e) { console.warn(e); }
          }
        });
        if (tournament.stage === 'playoff' || tournament.playoff.every(p => p.played)) {
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

        round.matches.forEach((m) => {
          if (m.played || !m.home || !m.away) return;
          if (isFinal || m.twoLeg === false) simSingleFinal(m);
          else simTwoLegTie(m);
        });

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

      assignTournamentAwards();
      try { renderUCLLeague(); } catch (e) {}
      try { renderBracket(); } catch (e) {}
      try { refreshTournamentStatsUI(); } catch (e) {}
      if (tournament.champion) {
        const stageTitle = document.getElementById('tour-stage-title');
        if (stageTitle) stageTitle.textContent = 'Champions: ' + (tournament.champion.flag || '') + ' ' + tournament.champion.name;
        toast(tournament.champion.name + ' win the Champions League!');
      } else {
        toast('Tournament simulation finished');
      }
      return;
    }

    // ========== World Cup path ==========
    updateLoading('Simulating group stage…');
    (tournament.fixtures || []).forEach((f) => {
      if (f.played) return;
      const home = getTeam(f.home), away = getTeam(f.away);
      if (!home || !away) return;
      const result = simQuickMatch(home, away, { countForLeaderboard: true });
      f.played = true;
      f.homeScore = result.home;
      f.awayScore = result.away;
      f.report = result.report;
      const g = tournament.groups && tournament.groups[f.group];
      if (!g) return;
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

      round.matches.forEach((m) => {
        if (m.played || !m.home || !m.away) return;
        const result = simQuickMatch(m.home, m.away, { allowET: true, allowPens: true, countForLeaderboard: true });
        m.homeScore = result.home;
        m.awayScore = result.away;
        m.played = true;
        m.report = result.report;
        if (result.pens) {
          m.penalties = true;
          m.winner = result.pens.home > result.pens.away ? m.home : m.away;
        } else if (result.home > result.away) m.winner = m.home;
        else if (result.away > result.home) m.winner = m.away;
        else {
          m.penalties = true;
          m.winner = Math.random() < 0.5 ? m.home : m.away;
        }
      });

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

    tournament.stage = tournament.champion ? 'complete' : (tournament.knockout && tournament.knockout.length ? 'knockout' : tournament.stage);
    assignTournamentAwards();
    try { renderGroups(); } catch (e) {}
    try { renderBracket(); } catch (e) {}
    try { refreshTournamentStatsUI(); } catch (e) {}
    if (tournament.champion) {
      const stageTitle = document.getElementById('tour-stage-title');
      if (stageTitle) stageTitle.textContent = 'Champions: ' + (tournament.champion.flag || '') + ' ' + tournament.champion.name;
      toast(tournament.champion.name + ' win the tournament!');
    } else {
      toast('Tournament simulation finished');
    }
  }


  function simUCLFixture(idx) {
    if (!tournament || !tournament.fixtures[idx] || tournament.fixtures[idx].played) return;
    showLoading('Simulating match…');
    setTimeout(function() {
      try { _simUCLFixtureWork(idx); }
      finally { hideLoading(); refreshTournamentStatsUI(); try { renderUCLLeague(); renderUCLFixtures(); } catch(e) {} }
    }, 30);
  }
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

  function playUCLFixture(idx) {
    if (!tournament || !tournament.fixtures[idx] || tournament.fixtures[idx].played) return;
    window._uclFixtureIdx = idx;
    window._tourFixtureIdx = idx;
    window._koRoundIdx = null;
    window._koMatchIdx = null;
    window._fromTournament = true;
    const f = tournament.fixtures[idx];
    switchView('match');
    const homeSel = document.getElementById('home-team');
    const awaySel = document.getElementById('away-team');
    if (homeSel) homeSel.value = f.home;
    if (awaySel) awaySel.value = f.away;
    const formKeys = Object.keys(FORMATIONS);
    const hf = formKeys[Math.floor(Math.random() * formKeys.length)];
    const af = formKeys[Math.floor(Math.random() * formKeys.length)];
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

  function simPlayoffTie(idx) {
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
      if (r2.pens) p.winner = r2.pens.home > r2.pens.away ? p.home : p.away;
      else p.winner = Math.random() < 0.5 ? p.home : p.away;
      p.penalties = true;
    }
    p.played = true;
    renderUCLFixtures();
    if (tournament.playoff.every(x => x.played)) finishUCLPlayoffs();
    refreshTournamentStatsUI();
  }

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

  function simTwoLegTie(m) {
    // Leg 1 at away stadium (away hosts)
    const r1 = simQuickMatch(m.away, m.home, { allowET: false, allowPens: false });
    m.leg1 = { played: true, homeScore: r1.home, awayScore: r1.away, report: r1.report };
    // Leg 2 at home stadium
    const r2 = simQuickMatch(m.home, m.away, { allowET: true, allowPens: true });
    m.leg2 = { played: true, homeScore: r2.home, awayScore: r2.away, report: r2.report };
    m.aggHome = r1.away + r2.home;
    m.aggAway = r1.home + r2.away;
    m.homeScore = m.aggHome;
    m.awayScore = m.aggAway;
    if (m.aggHome > m.aggAway) m.winner = m.home;
    else if (m.aggAway > m.aggHome) m.winner = m.away;
    else {
      if (r2.pens) m.winner = r2.pens.home > r2.pens.away ? m.home : m.away;
      else m.winner = Math.random() < 0.5 ? m.home : m.away;
      m.penalties = true;
    }
    m.played = true;
    m.report = r2.report;
  }

  function simSingleFinal(m) {
    const result = simQuickMatch(m.home, m.away, { allowET: true, allowPens: true });
    m.homeScore = result.home;
    m.awayScore = result.away;
    m.played = true;
    m.report = result.report;
    m.twoLeg = false;
    if (result.pens) {
      m.penalties = true;
      m.winner = result.pens.home > result.pens.away ? m.home : m.away;
    } else if (result.home === result.away) {
      m.penalties = true;
      m.winner = Math.random() < 0.5 ? m.home : m.away;
    } else {
      m.winner = result.home > result.away ? m.home : m.away;
    }
  }

  function viewPlayoffReport(idx) {
    const p = tournament && tournament.playoff && tournament.playoff[idx];
    if (!p) return;
    const rep = (p.leg2 && p.leg2.report) || (p.leg1 && p.leg1.report);
    if (rep) showMatchReport(rep);
    else toast('Aggregate: ' + p.aggHome + '-' + p.aggAway);
  }


  function advanceToKnockout() {
    if (!tournament) return;
    if (tournament.stage === 'knockout' || tournament.stage === 'complete') return;
    if (tournament.knockout && tournament.knockout.length) return;
    const qualifiers = [];
    const thirdPlaces = [];
    tournament.groups.forEach(g => {
      const sorted = [...g.teams].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      if (sorted[0]) qualifiers.push(sorted[0].team);
      if (sorted[1]) qualifiers.push(sorted[1].team);
      if (sorted[2]) thirdPlaces.push(sorted[2]);
    });
    // FIFA-style: if we have 12 groups (24 auto + need 8 thirds → 32)
    if (tournament.groups.length >= 8 && thirdPlaces.length) {
      thirdPlaces.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      const need = 32 - qualifiers.length;
      if (need > 0) {
        thirdPlaces.slice(0, need).forEach(t => qualifiers.push(t.team));
      }
    }
    // Always force power of 2 (2,4,8,16,32)
    while (qualifiers.length >= 2 && (qualifiers.length & (qualifiers.length - 1))) {
      qualifiers.pop();
    }
    if (qualifiers.length < 2) { toast('Not enough qualifiers'); return; }
    tournament.stage = 'knockout';
    tournament.knockout = [{ name: getRoundName(qualifiers.length), matches: [] }];
    for (let i = 0; i < qualifiers.length; i += 2) {
      tournament.knockout[0].matches.push({
        home: qualifiers[i], away: qualifiers[i + 1],
        homeScore: null, awayScore: null, winner: null, played: false
      });
    }
    renderBracket();
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = tournament.knockout[0].name;
    const btn = document.getElementById('btn-sim-round');
    if (btn) btn.textContent = 'Simulate Knockout Round';
  }

  function getRoundName(teamCount) {
    // teamCount = number of teams still in the competition for this round
    if (teamCount >= 32) return 'Round of 32';
    if (teamCount >= 16) return 'Round of 16';
    if (teamCount >= 8) return 'Quarter-finals';
    if (teamCount >= 4) return 'Semi-finals';
    if (teamCount >= 2) return 'Final';
    return 'Knockout';
  }

  function simKnockoutRound() {
    if (!tournament || !tournament.knockout || !tournament.knockout.length) return false;
    // If called from UI button, show loading
    if (!currentMatch || !currentMatch.silentDeep) {
      withLoading('Simulating knockout round…', function() {
        _simKnockoutRoundWork();
        refreshTournamentStatsUI();
      });
      return true;
    }
    return _simKnockoutRoundWork();
  }

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
        createNextKnockoutRound(winners);
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
        m.winner = result.pens.home > result.pens.away ? m.home : m.away;
      } else if (result.home === result.away) {
        m.penalties = true;
        m.winner = Math.random() < 0.5 ? m.home : m.away;
      } else {
        m.winner = result.home > result.away ? m.home : m.away;
      }
    });

    const winners = current.matches.map(m => m.winner).filter(Boolean);
    if (winners.length === 1) {
      setChampion(winners[0]);
    } else if (winners.length >= 2) {
      createNextKnockoutRound(winners);
    }
    renderBracket();
    renderTournamentLeaderboard();
    return true;
  }


  function createNextKnockoutRound(winners) {
    let list = (winners || []).filter(Boolean);
    if (list.length % 2 === 1) list = list.slice(0, list.length - 1);
    if (list.length < 2) {
      if (winners && winners[0]) setChampion(winners[0]);
      return;
    }
    const name = getRoundName(list.length);
    const last = tournament.knockout[tournament.knockout.length - 1];
    if (last && last.name === name && !last.matches.every(m => m.played)) return;
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
    // Third place: prefer SF losers if available
    const sf = (tournament.knockout || []).find(r => r.name === 'Semi-finals');
    if (sf && sf.matches && sf.matches.length >= 2) {
      const losers = sf.matches.map(m => {
        if (!m.winner) return null;
        return m.winner.id === m.home.id ? m.away : m.home;
      }).filter(Boolean);
      tournament.thirdPlace = losers[0] || null;
      tournament.fourthPlace = losers[1] || null;
    }
    assignTournamentAwards();
    const tName = tournament.type === 'worldcup' ? 'World Cup' : 'Champions League';
    trophies.push({ name: tName, team: team.name, type: 'Tournament', date: Date.now() });
    try { localStorage.setItem('apexTrophies', JSON.stringify(trophies)); } catch(e) {}
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = 'Champions: ' + (team.flag || '') + ' ' + team.name;
    renderTournamentPodium();
  }

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
          <div class="place-team">${second ? (second.flag||'') + ' ' + second.name : '—'}</div>
          <div class="place-label">Runners-up</div>
        </div>
        <div class="podium-place first">
          <div class="place-num">1</div>
          <div class="place-team">${first.flag||''} ${first.name}</div>
          <div class="place-label">Champions</div>
        </div>
        <div class="podium-place">
          <div class="place-num">3</div>
          <div class="place-team">${third ? (third.flag||'') + ' ' + third.name : '—'}</div>
          <div class="place-label">Third place</div>
        </div>
      </div>`;
  }


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

    const forms = Object.keys(FORMATIONS);
    const hf = opts.homeForm || forms[Math.floor(Math.random() * forms.length)];
    const af = opts.awayForm || forms[Math.floor(Math.random() * forms.length)];
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
      playerMatchStats: {},
      goalList: [],
      allowET: !!opts.allowET,
      allowPens: !!opts.allowPens,
      silentDeep: true,
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

  function poisson(lambda) {
    const L = Math.exp(-Math.max(0.1, lambda));
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L && k < 10);
    return k - 1;
  }

  
  function assignTournamentAwards() {
    if (!tournament) return;
    const top = (key) => Object.values(tournamentStats[key] || {}).sort((a,b) => b.count - a.count);
    const goals = top('goals');
    const assists = top('assists');
    const saves = top('saves');
    const motm = top('motm');
    const cleanSheets = top('cleanSheets');
    const puskas = top('puskas');
    const ratingsAny = Object.values(tournamentStats.ratings || {})
      .filter(x => (x.count || 0) > 0)
      .sort((a,b) => b.avg - a.avg || b.count - a.count);

    // Golden Ball: a composite of G+A, average rating, MOTM count and "award show"
    // presence across the other individual categories — not rating alone — so a
    // quiet-but-consistent passer can't out-rank a genuine standout performer.
    const goldenScores = {};
    const ensureG = (p) => {
      if (!goldenScores[p.id]) goldenScores[p.id] = { id: p.id, name: p.name, team: p.team, count: 0, avg: 0, apps: 0, pts: 0, goals: 0, assists: 0, motm: 0 };
      return goldenScores[p.id];
    };
    goals.forEach(p => { const e = ensureG(p); e.goals = p.count; e.pts += p.count * 4; });
    assists.forEach(p => { const e = ensureG(p); e.assists = p.count; e.pts += p.count * 2.5; });
    motm.forEach(p => { const e = ensureG(p); e.motm = p.count; e.pts += p.count * 5; });
    cleanSheets.forEach(p => { const e = ensureG(p); e.pts += p.count * 1.5; });
    puskas.forEach(p => { const e = ensureG(p); e.pts += p.count * 1.5; });
    Object.values(tournamentStats.ratings || {}).forEach(p => {
      const e = ensureG(p);
      e.apps = p.count || 0;
      e.avg = p.avg || 0;
      if (e.apps >= 3 && e.avg > 0) e.pts += e.avg * Math.min(e.apps, 15) * 0.9;
      else if (e.apps > 0) e.pts += e.avg * 0.15;
    });
    // Award-show-appearance bonus: nominee across multiple individual tournament awards
    const topSets = {
      goldenboot: new Set(goals.slice(0,10).map(p=>p.id)),
      assists: new Set(assists.slice(0,10).map(p=>p.id)),
      motm: new Set(motm.slice(0,10).map(p=>p.id)),
      glove: new Set(saves.slice(0,10).map(p=>p.id)),
      puskas: new Set(puskas.slice(0,10).map(p=>p.id))
    };
    Object.values(goldenScores).forEach(e => {
      let noms = 0;
      Object.values(topSets).forEach(set => { if (set.has(e.id)) noms++; });
      if (noms >= 2) e.pts += (noms - 1) * 1.4;
      e.count = Math.round(e.pts);
    });
    const goldenBallData = Object.values(goldenScores)
      .filter(e => e.pts > 0 && (e.apps >= 3 || e.goals + e.assists + e.motm >= 3))
      .sort((a,b) => b.pts - a.pts || b.apps - a.apps);

    tournament.awards = {
      goldenBoot: goals[0] || null,
      goldenBall: goldenBallData[0] || ratingsAny[0] || (motm[0] && (motm[0].count >= 2) ? motm[0] : null) || null,
      goldenGlove: saves[0] || null,
      topAssists: assists[0] || null,
      mostMotm: motm[0] || null
    };
  }

  function renderTournamentAwards() {
    const el = document.getElementById('tour-awards');
    if (!el || !tournament) return;
    if (!tournament.awards) assignTournamentAwards();
    const a = tournament.awards || {};
    const card = (title, icon, p, extra) => {
      if (!p) return `<div class="award-mini"><div class="am-title">${icon} ${title}</div><div class="am-empty">TBD</div></div>`;
      return `<div class="award-mini"><div class="am-title">${icon} ${title}</div>
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

  function refreshTournamentStatsUI() {
    if (!tournament) return;
    try {
      assignTournamentAwards();
      renderTournamentAwards();
      renderTournamentLeaderboard();
    } catch (e) { console.warn(e); }
  }

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
      ${arr.map((p,i)=>`<div style="font-size:0.85rem;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04)">${i+1}. ${p.name} <span style="color:var(--text-muted)">${p.team||''}</span> — <b>${p.count}</b></div>`).join('')||'<span style="color:var(--text-muted)">—</span>'}</div>`;
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
            <span>${m.home.flag || ''} ${m.home.short}</span>
            <span class="bracket-score">${m.played ? (m.twoLeg !== false && m.aggHome != null ? m.aggHome : m.homeScore) : '-'}</span>
          </div>
          <div class="bracket-team ${m.winner && m.winner.id === m.away.id ? 'winner' : ''}">
            <span>${m.away.flag || ''} ${m.away.short}</span>
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
      else if (result.home === result.away) { m.penalties = true; m.winner = Math.random() < 0.5 ? m.home : m.away; }
      else m.winner = result.home > result.away ? m.home : m.away;
    }
    afterKnockoutMatchPlayed(roundIdx);
    refreshTournamentStatsUI();
  }

  function playKnockoutMatch(roundIdx, matchIdx) {
    if (!tournament || !tournament.knockout[roundIdx]) return;
    const m = tournament.knockout[roundIdx].matches[matchIdx];
    if (!m || m.played || !m.home || !m.away) return;
    window._koRoundIdx = roundIdx;
    window._koMatchIdx = matchIdx;
    window._tourFixtureIdx = null;
    window._uclFixtureIdx = null;
    window._fromTournament = true;
    switchView('match');
    const homeSel = document.getElementById('home-team');
    const awaySel = document.getElementById('away-team');
    if (homeSel) homeSel.value = m.home.id;
    if (awaySel) awaySel.value = m.away.id;
    const formKeys = Object.keys(FORMATIONS);
    const hf = formKeys[Math.floor(Math.random() * formKeys.length)];
    const af = formKeys[Math.floor(Math.random() * formKeys.length)];
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


  function afterKnockoutMatchPlayed(roundIdx) {
    const current = tournament.knockout[roundIdx];
    if (!current.matches.every(x => x.played)) {
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


  function resetTournament() {
    tournament = null;
    const setup = document.getElementById('tournament-setup');
    const live = document.getElementById('tournament-live');
    if (setup) setup.style.display = 'block';
    if (live) live.style.display = 'none';
    const btn = document.getElementById('btn-sim-round');
    if (btn) btn.textContent = 'Simulate Round';
  }

  let teamsFilter = 'all';
  let teamsSearch = '';
  let teamsSort = 'name';
  let tourTeamsSearch = '';

  function teamAvgOvr(t) {
    const ps = t.players || [];
    if (!ps.length) return 0;
    return ps.reduce((s, p) => s + (p.ovr || 70), 0) / ps.length;
  }

  function filterTeams(type) {
    teamsFilter = type || 'all';
    renderTeamsList();
  }

  function searchTeams(q) {
    teamsSearch = (q || '').trim().toLowerCase();
    renderTeamsList();
  }

  function sortTeams(mode) {
    teamsSort = mode || 'name';
    renderTeamsList();
  }

  function getFilteredTeamsList() {
    let list = allTeams;
    if (teamsFilter === 'national') list = teamsData.national || [];
    if (teamsFilter === 'club') list = teamsData.club || [];
    if (teamsSearch) {
      list = list.filter(t =>
        (t.name || '').toLowerCase().includes(teamsSearch) ||
        (t.short || '').toLowerCase().includes(teamsSearch) ||
        ((t.manager && t.manager.name) || '').toLowerCase().includes(teamsSearch)
      );
    }
    list = [...list];
    if (teamsSort === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else if (teamsSort === 'ovr') list.sort((a, b) => teamAvgOvr(b) - teamAvgOvr(a));
    else if (teamsSort === 'players') list.sort((a, b) => (b.players || []).length - (a.players || []).length);
    return list;
  }

  function renderTeamsList() {
    const list = getFilteredTeamsList();
    const el = document.getElementById('teams-list');
    if (!el) return;
    if (!list.length) {
      el.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><p>No teams match your search.</p></div>';
      return;
    }
    el.innerHTML = list.map(t => {
      const ovr = teamAvgOvr(t).toFixed(0);
      const primary = t.color || '#d4af37';
      return `<div class="team-check" style="cursor:pointer;border-left:3px solid ${primary}" onclick="App.showTeamProfile('${t.id}')">
        <div style="display:flex;align-items:center;gap:8px;width:100%">
          <span style="font-size:1.5rem">${t.flag || '⚽'}</span>
          <div style="flex:1;min-width:0">
            <strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name}</strong>
            <div style="font-size:0.75rem;color:var(--text-2)">${(t.players || []).length} players · ${t.short || ''}</div>
            <div style="font-size:0.7rem;color:var(--gold)">${(t.manager && t.manager.name) || ''}</div>
          </div>
          <span class="player-ovr">${ovr}</span>
        </div>
      </div>`;
    }).join('');
  }

  function searchTournamentTeams(q) {
    tourTeamsSearch = (q || '').trim().toLowerCase();
    renderTournamentTeamSelect();
  }


  function showLoading(msg) {
    let el = document.getElementById('loading-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'loading-overlay';
      el.innerHTML = '<div class="loading-box"><div class="loading-spinner"></div><div class="loading-text" id="loading-text">Simulating…</div><div class="loading-sub" id="loading-sub">Please wait</div></div>';
      document.body.appendChild(el);
    }
    const t = document.getElementById('loading-text');
    const s = document.getElementById('loading-sub');
    if (t) t.textContent = msg || 'Simulating…';
    if (s) s.textContent = 'Please wait — do not close the page';
    el.classList.add('show');
  }

  function hideLoading() {
    const el = document.getElementById('loading-overlay');
    if (el) el.classList.remove('show');
  }

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
            }
            resolve(result);
          }, 50);
        });
      });
    });
  }

  function toast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  
  function renderPostMatchRatings() {
    if (!currentMatch || !currentMatch.playerMatchStats) return;
    if (currentMatch.silentDeep) return;
    const el = document.getElementById('post-match-ratings');
    if (!el) return;
    const m = currentMatch;
    const entries = Object.values(m.playerMatchStats).sort((a,b) => b.rating - a.rating);
    let h = '<div class="card-title">Post-Match Ratings (' + entries.length + ' players)</div>';
    // Group by team
    const homeIds = new Set((m.home.squad.all||[]).map(p=>p.id));
    const homeP = entries.filter(p => homeIds.has(p.id));
    const awayP = entries.filter(p => !homeIds.has(p.id));
    const row = (p) => {
      const rc = p.rating >= 7.5 ? 'rating-high' : p.rating >= 6.5 ? 'rating-mid' : 'rating-low';
      const icons = (p.goals ? '⚽'.repeat(Math.min(p.goals,3)) : '') + (p.assists ? '🎯'.repeat(Math.min(p.assists,2)) : '');
      return `<div class="pm-player" onclick="App.showPlayerProfile('${p.id}')" style="cursor:pointer">
        <span class="player-num">${p.num||''}</span>
        <span style="flex:1;font-weight:600">${p.name}</span>
        <span>${icons}</span>
        <span class="xg">xG ${(p.xg||0).toFixed(2)} · xA ${(p.xa||0).toFixed(2)}</span>
        <span class="rating-badge ${rc}">${p.rating.toFixed(1)}</span>
      </div>`;
    };
    h += `<div style="font-size:0.8rem;color:var(--accent-gold);margin:8px 0 4px">${m.home.team.flag||''} ${m.home.team.name}</div>`;
    h += homeP.map(row).join('') || '<div style="color:var(--text-muted);font-size:0.85rem">No data</div>';
    h += `<div style="font-size:0.8rem;color:var(--accent-gold);margin:12px 0 4px">${m.away.team.flag||''} ${m.away.team.name}</div>`;
    h += awayP.map(row).join('') || '<div style="color:var(--text-muted);font-size:0.85rem">No data</div>';
    el.innerHTML = h;
    el.style.display = 'block';
  }

  function returnToTournament() {
    const backBtn = document.getElementById('back-to-tournament');
    if (backBtn) { backBtn.style.display = 'none'; backBtn.classList.remove('show'); }
    window._fromTournament = false;
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


  function showPlayerProfile(playerId) {
    let player = null, team = null;
    for (const t of allTeams) {
      const p = (t.players || []).find(x => x.id === playerId);
      if (p) { player = p; team = t; break; }
    }
    // Fallback from current match stats object
    if (!player && currentMatch && currentMatch.playerMatchStats && currentMatch.playerMatchStats[playerId]) {
      const ms = currentMatch.playerMatchStats[playerId];
      player = { id: playerId, name: ms.name, num: ms.num, pos: [ms.pos], ovr: ms.ovr, att: 70, def: 70, phy: 70, pac: 70, tec: 70 };
      team = (currentMatch.home.squad.all || []).find(p => p.id === playerId) ? currentMatch.home.team
        : ((currentMatch.away.squad.all || []).find(p => p.id === playerId) ? currentMatch.away.team : { name: '—', flag: '', color: '#d4af37', secondary: '#fff' });
    }
    if (!player) { toast('Player not found'); return; }
    const g = (stats.goals[playerId] || {}).count || 0;
    const a = (stats.assists[playerId] || {}).count || 0;
    const s = (stats.saves[playerId] || {}).count || 0;
    const motm = (stats.motm[playerId] || {}).count || 0;
    const y = (stats.yellows[playerId] || {}).count || 0;
    const rd = (stats.reds[playerId] || {}).count || 0;
    const apps = (stats.ratings[playerId] || {}).count || 0;
    const primary = (team && team.color) || '#d4af37';
    const secondary = (team && team.secondary) || '#fff';
    const ms = (currentMatch && currentMatch.playerMatchStats && currentMatch.playerMatchStats[playerId]) || null;
    const modal = document.getElementById('player-modal');
    const content = document.getElementById('player-modal-content');
    if (!modal || !content) return;
    let matchBlock = '';
    if (ms) {
      const rc = (ms.rating || 0) >= 7.5 ? 'rating-high' : (ms.rating || 0) >= 6.5 ? 'rating-mid' : 'rating-low';
      matchBlock = `
        <div class="card-title" style="margin-top:8px">This Match</div>
        <div class="profile-stats-grid">
          <div class="profile-stat"><div class="val">${ms.goals || 0}</div><div class="lbl">Goals</div></div>
          <div class="profile-stat"><div class="val">${ms.assists || 0}</div><div class="lbl">Assists</div></div>
          <div class="profile-stat"><div class="val">${ms.shots || 0}</div><div class="lbl">Shots</div></div>
          <div class="profile-stat"><div class="val">${ms.saves || 0}</div><div class="lbl">Saves</div></div>
          <div class="profile-stat"><div class="val">${ms.tackles || 0}</div><div class="lbl">Tackles</div></div>
          <div class="profile-stat"><div class="val">${ms.passes || 0}</div><div class="lbl">Passes</div></div>
          <div class="profile-stat"><div class="val">${ms.passesCompleted || 0}</div><div class="lbl">Completed</div></div>
          <div class="profile-stat"><div class="val">${ms.passes ? Math.round(100 * (ms.passesCompleted || 0) / ms.passes) + '%' : '—'}</div><div class="lbl">Pass Acc.</div></div>
          <div class="profile-stat"><div class="val">${ms.interceptions || 0}</div><div class="lbl">Interceptions</div></div>
          <div class="profile-stat"><div class="val">${ms.blocks || 0}</div><div class="lbl">Blocks</div></div>
          <div class="profile-stat"><div class="val">${(ms.xg || 0).toFixed(2)}</div><div class="lbl">xG</div></div>
          <div class="profile-stat"><div class="val">${(ms.xa || 0).toFixed(2)}</div><div class="lbl">xA</div></div>
          <div class="profile-stat"><div class="val"><span class="rating-badge ${rc}">${(ms.rating || 0).toFixed(1)}</span></div><div class="lbl">Rating</div></div>
          <div class="profile-stat"><div class="val">${ms.yellow ? 'Y' : '—'} ${ms.red ? 'R' : ''}</div><div class="lbl">Cards</div></div>
        </div>`;
    }
    content.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar" style="background:${primary};border:3px solid ${secondary};color:${secondary}">${player.num || '?'}</div>
        <div>
          <h2 style="margin:0 0 4px;font-size:1.2rem">${player.name}</h2>
          <div style="color:var(--text-2);font-size:0.85rem">${(team && team.flag) || ''} ${(team && team.name) || ''} · ${(player.pos||[]).join('/')}</div>
          <div style="color:var(--gold);font-weight:700;margin-top:4px">OVR ${player.ovr || '—'}</div>
        </div>
      </div>
      ${matchBlock}
      <div class="card-title">Career (competitive)</div>
      <div class="profile-stats-grid">
        <div class="profile-stat"><div class="val">${apps}</div><div class="lbl">Apps</div></div>
        <div class="profile-stat"><div class="val">${g}</div><div class="lbl">Goals</div></div>
        <div class="profile-stat"><div class="val">${a}</div><div class="lbl">Assists</div></div>
        <div class="profile-stat"><div class="val">${motm}</div><div class="lbl">MOTM</div></div>
        <div class="profile-stat"><div class="val">${s}</div><div class="lbl">Saves</div></div>
        <div class="profile-stat"><div class="val">${y}</div><div class="lbl">Yellows</div></div>
        <div class="profile-stat"><div class="val">${rd}</div><div class="lbl">Reds</div></div>
      </div>
      <div style="margin-top:8px">
        ${[['ATT',player.att],['DEF',player.def],['PHY',player.phy],['PAC',player.pac],['TEC',player.tec]].map(([n,v]) => `
          <div class="attr-bar-row"><span class="attr-name">${n}</span>
            <div class="attr-track"><div class="attr-fill" style="width:${v||50}%"></div></div>
            <span class="attr-val">${v||'-'}</span></div>`).join('')}
      </div>
      <div class="modal-actions"><button class="btn btn-secondary" onclick="document.getElementById('player-modal').classList.remove('active')">Close</button></div>`;
    modal.classList.add('active');
  }


  function showTeamProfile(teamId) {
    const team = getTeam(teamId);
    if (!team) { toast('Team not found'); return; }
    const primary = team.color || '#d4af37';
    const secondary = team.secondary || '#fff';
    const mgr = team.manager || {};
    const players = [...(team.players || [])].sort((a,b) => (b.ovr||0)-(a.ovr||0));
    const avg = players.length ? (players.reduce((s,p) => s + (p.ovr||70), 0) / players.length).toFixed(1) : '—';
    const modal = document.getElementById('team-modal');
    const content = document.getElementById('team-modal-content');
    if (!modal || !content) return;
    content.innerHTML = `
      <div class="profile-header" style="border-bottom:2px solid ${primary};padding-bottom:14px">
        <div class="profile-avatar" style="background:${primary};border:3px solid ${secondary};color:${secondary};font-size:1.6rem">${team.flag || '⚽'}</div>
        <div style="flex:1;min-width:0">
          <h2 style="margin:0 0 4px;font-size:1.25rem">${team.name}</h2>
          <div style="color:var(--text-2);font-size:0.85rem">${team.short || ''} · ${players.length} players · Avg OVR ${avg}</div>
          <div style="color:var(--gold);font-size:0.8rem;margin-top:4px">Manager: ${mgr.name || '—'} ${mgr.ovr ? '· ' + mgr.ovr + ' OVR' : ''}</div>
          <div style="color:var(--text-2);font-size:0.8rem;margin-top:2px">🏟️ ${getStadium(team)}</div>
        </div>
      </div>
      <div class="card-title" style="margin-top:14px">Squad</div>
      <div class="team-squad-list">
        ${players.map(p => `
          <button type="button" class="team-squad-row" onclick="App.showPlayerProfile('${p.id}')">
            <span class="player-num">${p.num || ''}</span>
            <span class="tsr-name">${p.name}</span>
            <span class="tsr-pos">${(p.pos||[]).join('/')}</span>
            <span class="player-ovr">${p.ovr || ''}</span>
          </button>`).join('')}
      </div>
      <div class="modal-actions"><button class="btn btn-secondary" onclick="document.getElementById('team-modal').classList.remove('active')">Close</button></div>`;
    modal.classList.add('active');
  }


  function showAwards(type) {
    document.querySelectorAll('.award-tab').forEach(t => t.classList.toggle('active', t.dataset.award === type));
    const el = document.getElementById('awards-content');
    if (!el) return;
    if (type === 'goldenboot') {
      const data = Object.values(stats.goals || {}).sort((a,b) => b.count - a.count).slice(0, 50);
      if (!data.length) { el.innerHTML = '<div class="empty-state"><div class="icon">⚽</div><p>No goals yet.</p></div>'; return; }
      el.innerHTML = '<div class="award-card"><div class="award-icon">👟</div><div class="award-info"><h4>Golden Boot</h4><p class="award-winner">' + data[0].name + ' (' + data[0].team + ') — ' + data[0].count + ' goals</p></div></div>' +
        '<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Apps</th><th>Goals</th></tr></thead><tbody>' +
        data.map((p,i) => '<tr><td class="lb-rank">'+(i+1)+'</td><td class="lb-player">'+p.name+'</td><td class="lb-team">'+p.team+'</td><td>'+((stats.ratings&&stats.ratings[p.id])?stats.ratings[p.id].count:0)+'</td><td style="font-weight:700;color:var(--accent-gold)">'+p.count+'</td></tr>').join('') +
        '</tbody></table></div>';
    } else if (type === 'ballon') {
      // Ballon d'Or: need meaningful sample size — min 3 competitive appearances
      const MIN_APPS = 3;
      const scores = {};
      const ensure = (p) => {
        if (!scores[p.id]) scores[p.id] = { id: p.id, name: p.name, team: p.team, pts: 0, goals: 0, assists: 0, motm: 0, avg: 0, apps: 0, noms: 0 };
        return scores[p.id];
      };
      Object.values(stats.ratings || {}).forEach(p => {
        const e = ensure(p);
        e.apps = p.count || 0;
        e.avg = p.avg || 0;
      });
      Object.values(stats.goals || {}).forEach(p => { const e = ensure(p); e.goals = p.count; e.pts += p.count * 4; });
      Object.values(stats.assists || {}).forEach(p => { const e = ensure(p); e.assists = p.count; e.pts += p.count * 2.5; });
      Object.values(stats.motm || {}).forEach(p => { const e = ensure(p); e.motm = p.count; e.pts += p.count * 5; });
      Object.values(stats.saves || {}).forEach(p => { const e = ensure(p); e.pts += p.count * 0.35; });
      Object.values(stats.cleanSheets || {}).forEach(p => { const e = ensure(p); e.pts += p.count * 2; });
      Object.values(stats.puskas || {}).forEach(p => { const e = ensure(p); e.pts += p.count * 1.5; });
      // Rating contribution only if enough appearances (prevents 1-game 9.9 winners)
      Object.values(scores).forEach(e => {
        if (e.apps >= MIN_APPS && e.avg > 0) {
          // Scale rating points by log of apps so volume + quality both matter
          e.pts += e.avg * Math.min(e.apps, 15) * 0.9;
        } else if (e.apps > 0 && e.apps < MIN_APPS) {
          // Tiny contribution only — cannot win on rating alone
          e.pts += e.avg * 0.15;
        }
      });
      // "Award show appearance" bonus: being a nominee/contender on other individual
      // award leaderboards (Golden Boot, Assists, MOTM, Yashin-type keeper form, Puskás)
      // is itself worth something toward the overall Ballon d'Or case — being in the
      // conversation across multiple award shows should count for something.
      const awardLeaders = {
        goldenboot: new Set(Object.values(stats.goals || {}).sort((a,b)=>b.count-a.count).slice(0,50).map(p=>p.id)),
        assists: new Set(Object.values(stats.assists || {}).sort((a,b)=>b.count-a.count).slice(0,50).map(p=>p.id)),
        motm: new Set(Object.values(stats.motm || {}).sort((a,b)=>b.count-a.count).slice(0,50).map(p=>p.id)),
        yashin: new Set(Object.values(stats.saves || {}).sort((a,b)=>b.count-a.count).slice(0,50).map(p=>p.id)),
        puskas: new Set(Object.values(stats.puskas || {}).sort((a,b)=>b.count-a.count).slice(0,50).map(p=>p.id))
      };
      Object.values(scores).forEach(e => {
        let noms = 0;
        Object.values(awardLeaders).forEach(set => { if (set.has(e.id)) noms++; });
        e.noms = noms;
        if (noms >= 2) e.pts += (noms - 1) * 1.4; // each extra award-show appearance nudges the case
      });
      const data = Object.values(scores)
        .filter(p => p.pts > 0 && (p.apps >= MIN_APPS || p.goals + p.assists + p.motm >= 3))
        .sort((a,b) => b.pts - a.pts || b.apps - a.apps)
        .slice(0, 50);
      if (!data.length) {
        el.innerHTML = '<div class="empty-state"><div class="icon">🥇</div><p>Need players with at least ' + MIN_APPS + ' competitive appearances (or strong goal/assist tallies) for Ballon d\'Or.</p></div>';
        return;
      }
      const leader = data[0];
      el.innerHTML = '<div class="award-card"><div class="award-icon">🥇</div><div class="award-info"><h4>Ballon d\'Or</h4><p class="award-winner">' + leader.name + '</p><p style="color:var(--text-2);font-size:0.85rem">' + leader.team + ' · ' + leader.goals + 'G ' + leader.assists + 'A · ' + leader.motm + ' MOTM · ' + leader.apps + ' apps' + (leader.avg ? ' · Avg ' + leader.avg.toFixed(2) : '') + (leader.noms >= 2 ? ' · ' + leader.noms + ' award-show nods' : '') + '</p><p style="color:var(--gold);font-weight:700;margin-top:4px">' + Math.round(leader.pts) + ' Ballon points</p><p style="font-size:0.72rem;color:var(--text-3);margin-top:6px">Min ' + MIN_APPS + ' appearances required for rating weight</p></div></div>' +
        '<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Apps</th><th>G</th><th>A</th><th>Avg</th><th>Noms</th><th>Pts</th></tr></thead><tbody>' +
        data.map((p,i) => '<tr><td class="lb-rank">'+(i+1)+'</td><td class="lb-player">'+p.name+'</td><td class="lb-team">'+p.team+'</td><td>'+p.apps+'</td><td>'+p.goals+'</td><td>'+p.assists+'</td><td>'+(p.avg?p.avg.toFixed(2):'—')+'</td><td>'+(p.noms||0)+'</td><td style="font-weight:700;color:var(--gold)">'+Math.round(p.pts)+'</td></tr>').join('') +
        '</tbody></table></div>';
    } else if (type === 'puskas') {
      // Puskás Award — best/most spectacular individual goal, tallied by nominee count
      const data = Object.values(stats.puskas || {}).sort((a,b) => b.count - a.count).slice(0, 30);
      if (!data.length) { el.innerHTML = '<div class="empty-state"><div class="icon">🎬</div><p>No standout goals nominated yet.</p></div>'; return; }
      el.innerHTML = '<div class="award-card"><div class="award-icon">🎬</div><div class="award-info"><h4>Puskás Award</h4><p class="award-winner">' + data[0].name + '</p><p style="color:var(--text-2);font-size:0.85rem">' + data[0].team + ' · ' + data[0].count + ' nominated goal' + (data[0].count === 1 ? '' : 's') + '</p></div></div>' +
        '<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Apps</th><th>Nominated Goals</th></tr></thead><tbody>' +
        data.map((p,i) => '<tr><td class="lb-rank">'+(i+1)+'</td><td class="lb-player">'+p.name+'</td><td class="lb-team">'+p.team+'</td><td>'+((stats.ratings&&stats.ratings[p.id])?stats.ratings[p.id].count:0)+'</td><td style="font-weight:700;color:var(--accent-gold)">'+p.count+'</td></tr>').join('') +
        '</tbody></table></div>';
    } else if (type === 'muller') {
      // Gerd Müller Award — best pure striker: goals heavily weighted, ST/CF preference
      const scores = {};
      Object.values(stats.goals || {}).forEach(p => {
        scores[p.id] = { id: p.id, name: p.name, team: p.team, goals: p.count, assists: 0, pts: p.count * 5 };
      });
      Object.values(stats.assists || {}).forEach(p => {
        if (!scores[p.id]) scores[p.id] = { id: p.id, name: p.name, team: p.team, goals: 0, assists: 0, pts: 0 };
        scores[p.id].assists = p.count;
        scores[p.id].pts += p.count * 0.8;
      });
      // Bonus if player is a striker on roster
      Object.values(scores).forEach(s => {
        let isST = false;
        for (const t of allTeams) {
          const pl = (t.players || []).find(x => x.id === s.id);
          if (pl && (pl.pos || []).some(pos => ['ST','CF','FW'].includes(pos))) { isST = true; break; }
        }
        if (isST) s.pts += 2;
      });
      const data = Object.values(scores).filter(p => p.goals > 0).sort((a,b) => b.pts - a.pts || b.goals - a.goals).slice(0, 50);
      if (!data.length) { el.innerHTML = '<div class="empty-state"><div class="icon">🎯</div><p>No strikers on the scoresheet yet.</p></div>'; return; }
      el.innerHTML = '<div class="award-card"><div class="award-icon">🎯</div><div class="award-info"><h4>Gerd Müller Award</h4><p class="award-winner">' + data[0].name + '</p><p style="color:var(--text-2);font-size:0.85rem">Best striker · ' + data[0].goals + ' goals · ' + data[0].team + '</p></div></div>' +
        '<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Apps</th><th>Goals</th><th>Pts</th></tr></thead><tbody>' +
        data.map((p,i) => '<tr><td class="lb-rank">'+(i+1)+'</td><td class="lb-player">'+p.name+'</td><td class="lb-team">'+p.team+'</td><td>'+((stats.ratings&&stats.ratings[p.id])?stats.ratings[p.id].count:0)+'</td><td>'+p.goals+'</td><td style="font-weight:700;color:var(--gold)">'+Math.round(p.pts)+'</td></tr>').join('') +
        '</tbody></table></div>';
    } else if (type === 'yashin') {
      // Yashin Award — best goalkeeper: saves + clean sheets
      const scores = {};
      Object.values(stats.saves || {}).forEach(p => {
        scores[p.id] = { id: p.id, name: p.name, team: p.team, saves: p.count, clean: 0, pts: p.count * 1.2 };
      });
      Object.values(stats.cleanSheets || {}).forEach(p => {
        if (!scores[p.id]) scores[p.id] = { id: p.id, name: p.name, team: p.team, saves: 0, clean: 0, pts: 0 };
        scores[p.id].clean = p.count;
        scores[p.id].pts += p.count * 4;
      });
      Object.values(stats.motm || {}).forEach(p => {
        if (scores[p.id]) scores[p.id].pts += p.count * 3;
      });
      Object.values(stats.ratings || {}).forEach(p => {
        if (scores[p.id]) scores[p.id].pts += (p.avg || 0) * Math.min(p.count, 10) * 0.3;
      });
      const data = Object.values(scores).filter(p => p.saves > 0 || p.clean > 0).sort((a,b) => b.pts - a.pts).slice(0, 50);
      if (!data.length) { el.innerHTML = '<div class="empty-state"><div class="icon">🧤</div><p>No goalkeeper stats yet.</p></div>'; return; }
      el.innerHTML = '<div class="award-card"><div class="award-icon">🧤</div><div class="award-info"><h4>Yashin Trophy</h4><p class="award-winner">' + data[0].name + '</p><p style="color:var(--text-2);font-size:0.85rem">Best goalkeeper · ' + data[0].saves + ' saves · ' + data[0].clean + ' clean sheets · ' + data[0].team + '</p></div></div>' +
        '<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Apps</th><th>Saves</th><th>CS</th><th>Pts</th></tr></thead><tbody>' +
        data.map((p,i) => '<tr><td class="lb-rank">'+(i+1)+'</td><td class="lb-player">'+p.name+'</td><td class="lb-team">'+p.team+'</td><td>'+((stats.ratings&&stats.ratings[p.id])?stats.ratings[p.id].count:0)+'</td><td>'+p.saves+'</td><td>'+p.clean+'</td><td style="font-weight:700;color:var(--gold)">'+Math.round(p.pts)+'</td></tr>').join('') +
        '</tbody></table></div>';
    } else if (type === 'trophies') {
      if (!trophies.length) { el.innerHTML = '<div class="empty-state"><div class="icon">🏆</div><p>No trophies won yet. Complete a tournament!</p></div>'; return; }
      el.innerHTML = trophies.map(t => '<div class="award-card"><div class="award-icon">🏆</div><div class="award-info"><h4>'+t.name+'</h4><p class="award-winner">'+t.team+'</p><p>'+t.type+'</p></div></div>').join('');
    } else {
      // overview
      const topScorer = Object.values(stats.goals||{}).sort((a,b)=>b.count-a.count)[0];
      const topAst = Object.values(stats.assists||{}).sort((a,b)=>b.count-a.count)[0];
      const topMotm = Object.values(stats.motm||{}).sort((a,b)=>b.count-a.count)[0];
      el.innerHTML = `
        <div class="award-card"><div class="award-icon">👟</div><div class="award-info"><h4>Golden Boot Leader</h4><p class="award-winner">${topScorer ? topScorer.name + ' — ' + topScorer.count + ' goals' : '—'}</p></div></div>
        <div class="award-card"><div class="award-icon">🎯</div><div class="award-info"><h4>Top Assists</h4><p class="award-winner">${topAst ? topAst.name + ' — ' + topAst.count : '—'}</p></div></div>
        <div class="award-card"><div class="award-icon">⭐</div><div class="award-info"><h4>Most MOTM</h4><p class="award-winner">${topMotm ? topMotm.name + ' — ' + topMotm.count : '—'}</p></div></div>
        <div class="award-card"><div class="award-icon">🏆</div><div class="award-info"><h4>Trophies</h4><p class="award-winner">${trophies.length} won</p></div></div>`;
    }
  }

  // ========== SEASON CALENDAR: setup ==========
  function goToSeason() {
    if (season) { renderSeasonDashboard(); }
    else { renderSeasonSetup(); }
    const setup = document.getElementById('season-setup');
    const dash = document.getElementById('season-dashboard');
    if (setup) setup.style.display = season ? 'none' : 'block';
    if (dash) dash.style.display = season ? 'block' : 'none';
  }

  function seasonClubPool() {
    return (teamsData.club || []);
  }

  // leagues.json lists teams like "Real Madrid 2026-27" — strip the season
  // suffix so it can be matched against whatever team names teams.json uses.
  function normalizeLeagueName(s) {
    return (s || '').toLowerCase().replace(/\s*\d{4}-\d{2,4}\s*$/, '').trim();
  }

  // Resolves the club roster leagues.json defines for a given league name
  // (e.g. "La Liga") against the clubs actually present in teams.json.
  // Returns [] if leagues.json has no entry or none of its names match yet
  // (e.g. before teams.json has been filled in) — callers should fall back
  // to the full club pool in that case.
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
              <span>${t.flag || ''} ${t.name}</span>
            </label>`;
          }).join('') || '<div class="empty-state"><p>No clubs found</p></div>'}
        </div>
      </div>`;
    }).join('') + `<div class="card" style="margin-bottom:14px;border-color:var(--accent-gold)">
        <div class="card-title">🏆 Champions League</div>
        <div style="color:var(--text-muted);font-size:0.85rem">No manual selection needed — the top ${UCL_QUALIFY_PER_LEAGUE} clubs from each league table automatically qualify as Champions League candidates. In Year 1 (before any table exists), qualifiers are seeded from each club's squad strength.</div>
      </div>`;
  }

  function searchSeasonTeams(compKey, value) {
    seasonSetup.search[compKey] = value;
    renderSeasonSetup();
  }

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

  function clearSeasonSetup() {
    Object.values(seasonSetup.selections).forEach(s => s.clear());
    renderSeasonSetup();
  }

  // ---------- scheduling helpers ----------
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

  function buildDoubleRoundRobinRounds(teams) {
    const ids = teams.map(t => t.id);
    if (ids.length < 2) return [];
    const firstLeg = circleMethodRounds(ids);
    const secondLeg = firstLeg.map(round => round.map(([a, b]) => [b, a]));
    return [...firstLeg, ...secondLeg].map(pairs => pairs.map(([home, away]) => ({
      home, away, played: false, homeScore: null, awayScore: null, report: null
    })));
  }

  function blankSeasonRow(team) {
    return { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 };
  }

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

  function sortedTable(table) {
    return [...table].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
  }

  function bracketSizeFor(n) {
    let size = 2;
    while (size * 2 <= n && size * 2 <= 8) size *= 2;
    return size;
  }

  function seedPairsForSize(size) {
    if (size === 8) return [[0, 7], [3, 4], [2, 5], [1, 6]];
    if (size === 4) return [[0, 3], [1, 2]];
    return [[0, 1]];
  }

  function winnerOfResult(homeTeam, awayTeam, result) {
    if (result.home > result.away) return homeTeam;
    if (result.away > result.home) return awayTeam;
    if (result.pens) return result.pens.home > result.pens.away ? homeTeam : awayTeam;
    return Math.random() < 0.5 ? homeTeam : awayTeam;
  }

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

  function buildKnockoutFixtures(teamsInSeed, pairsIdx) {
    return { fixtures: pairsIdx.map(([i, j]) => ({
      home: teamsInSeed[i].id, away: teamsInSeed[j].id, played: false, homeScore: null, awayScore: null, report: null, winnerId: null
    })), played: false };
  }

  function buildKnockoutFromWinners(winners) {
    const fixtures = [];
    for (let i = 0; i < winners.length; i += 2) {
      const swap = Math.random() < 0.5;
      const h = swap ? winners[i] : winners[i + 1];
      const a = swap ? winners[i + 1] : winners[i];
      fixtures.push({ home: h.id, away: a.id, played: false, homeScore: null, awayScore: null, report: null, winnerId: null });
    }
    return { fixtures, played: false };
  }

  // ---------- Champions League qualification ----------
  // Year 1: no table exists yet, so seed qualifiers by squad strength (like
  // a pre-season club-strength ranking). Every later year uses the actual
  // final league standings (real-life style: table-toppers qualify).
  function computeInitialUCLQualifiers(leagueTeams) {
    const qualifiers = [];
    SEASON_LEAGUE_DEFS.forEach(def => {
      const ranked = [...(leagueTeams[def.key] || [])].sort((a, b) => teamAvgOvr(b) - teamAvgOvr(a));
      ranked.slice(0, UCL_QUALIFY_PER_LEAGUE).forEach(t => qualifiers.push(t));
    });
    return qualifiers;
  }

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

  // ---------- starting a season ----------
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
        finished: false
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
      finished: false
    };

    season = { year: 1, week: 0, leagues, ucl };
    seasonActiveTab = 'epl';
    renderSeasonDashboard();
    const setup = document.getElementById('season-setup');
    const dash = document.getElementById('season-dashboard');
    if (setup) setup.style.display = 'none';
    if (dash) dash.style.display = 'block';
    toast('Season started — good luck!');
  }

  function crownLeagueChampion(comp) {
    const standings = sortedTable(comp.table);
    comp.champion = standings[0] ? standings[0].team : null;
    if (comp.champion) {
      trophies.push({ name: comp.name, team: comp.champion.name, type: 'League (Y' + (season ? season.year : 1) + ')', date: Date.now() });
      try { localStorage.setItem('apexTrophies', JSON.stringify(trophies)); } catch (e) {}
    }
  }

  function simulateLeagueRound(comp) {
    if (!comp || comp.finished) return;
    if (comp.currentRound >= comp.rounds.length) { comp.finished = true; crownLeagueChampion(comp); return; }
    simulateRoundFixtures(comp.rounds[comp.currentRound], { allowET: false, allowPens: false }, (fx, h, a, result) => {
      applyResultToTable(comp.table, fx.home, fx.away, result.home, result.away);
    });
    comp.currentRound++;
    if (comp.currentRound >= comp.rounds.length) { comp.finished = true; crownLeagueChampion(comp); }
  }

  function simulateUCLStep(comp) {
    if (!comp || comp.finished) return;
    if (comp.stage === 'league') {
      if (comp.currentRound >= comp.rounds.length) { comp.stage = 'transition'; }
      else {
        simulateRoundFixtures(comp.rounds[comp.currentRound], { allowET: false, allowPens: false }, (fx, h, a, result) => {
          applyResultToTable(comp.table, fx.home, fx.away, result.home, result.away);
        });
        comp.currentRound++;
      }
      if (comp.currentRound >= comp.rounds.length) {
        const size = bracketSizeFor(comp.teams.length);
        comp.bracketSize = size;
        const standings = sortedTable(comp.table).map(r => r.team);
        const qualifiers = standings.slice(0, size);
        const firstRound = buildKnockoutFixtures(qualifiers, seedPairsForSize(size));
        if (size <= 2) { comp.knockout.final = firstRound; comp.stage = 'final'; }
        else if (size === 4) { comp.knockout.sf = firstRound; comp.stage = 'sf'; }
        else { comp.knockout.qf = firstRound; comp.stage = 'qf'; }
      }
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
        trophies.push({ name: 'Champions League', team: champ.name, type: 'Season (Y' + (season ? season.year : 1) + ')', date: Date.now() });
        try { localStorage.setItem('apexTrophies', JSON.stringify(trophies)); } catch (e) {}
      }
    }
  }

  function seasonIsComplete() {
    if (!season) return true;
    return SEASON_LEAGUE_DEFS.every(def => season.leagues[def.key].finished) && season.ucl.finished;
  }

  function simulateSeasonWeek() {
    if (!season) return;
    withLoading('Simulating matchday…', function() {
      SEASON_LEAGUE_DEFS.forEach(def => simulateLeagueRound(season.leagues[def.key]));
      simulateUCLStep(season.ucl);
      season.week++;
      renderSeasonDashboard();
      if (seasonIsComplete()) toast('Season complete — check the standings and Trophies!');
    });
  }

  function simulateSeasonToEnd() {
    if (!season) return;
    withLoading('Simulating rest of season…', function() {
      let safety = 0;
      while (!seasonIsComplete() && safety < 500) {
        SEASON_LEAGUE_DEFS.forEach(def => simulateLeagueRound(season.leagues[def.key]));
        simulateUCLStep(season.ucl);
        season.week++;
        safety++;
      }
      renderSeasonDashboard();
      toast('Season complete — check the standings and Trophies!');
    });
  }

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
        currentRound: 0, champion: null, finished: false
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
      year, week: 0, leagues,
      ucl: { key: 'ucl', name: 'Champions League', teams: uclTeams, table: uclTeams.map(blankSeasonRow),
        rounds: uclRounds, currentRound: 0, matchesPerTeam, stage: 'league', bracketSize: null,
        knockout: { qf: null, sf: null, final: null }, champion: null, finished: false }
    };
    renderSeasonDashboard();
    toast('Year ' + year + ' kicks off!');
  }

  function resetSeason() {
    if (!confirm('Reset the season? All standings and fixtures will be lost.')) return;
    season = null;
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
  }

  function showSeasonComp(key) {
    seasonActiveTab = key;
    renderSeasonDashboard();
  }

  function renderSeasonDashboard() {
    if (!season) return;
    seasonReportRegistry = []; // rebuilt fresh each render so onclick indices stay valid
    const title = document.getElementById('season-status-title');
    if (title) title.textContent = 'Year ' + season.year + ' · Matchday ' + season.week;
    const tabsEl = document.getElementById('season-comp-tabs');
    if (tabsEl) {
      const tabs = [...SEASON_LEAGUE_DEFS, { key: 'ucl', name: 'Champions League' }];
      tabsEl.innerHTML = tabs.map(def => {
        const comp = def.key === 'ucl' ? season.ucl : season.leagues[def.key];
        const flag = comp.finished ? ' 🏆' : '';
        return `<button class="lb-tab ${seasonActiveTab === def.key ? 'active' : ''}" onclick="App.showSeasonComp('${def.key}')">${def.name}${flag}</button>`;
      }).join('');
    }
    const contentEl = document.getElementById('season-comp-content');
    if (!contentEl) return;
    const comp = seasonActiveTab === 'ucl' ? season.ucl : season.leagues[seasonActiveTab];
    if (!comp) { contentEl.innerHTML = ''; return; }
    contentEl.innerHTML = seasonActiveTab === 'ucl' ? renderUCLSeasonHTML(comp) : renderLeagueCompHTML(comp);
  }

  function renderStandingsTable(comp, highlightTop) {
    const sorted = sortedTable(comp.table);
    let h = '<table class="group-table"><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>';
    sorted.forEach((r, i) => {
      const gd = r.gf - r.ga;
      const mark = (highlightTop && i < highlightTop) ? ' style="background:rgba(0,200,83,0.12)"' : '';
      h += `<tr${mark}><td>${i + 1}</td><td>${r.team.flag || ''} ${r.team.name}</td><td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td><td>${r.gf}</td><td>${r.ga}</td><td>${gd}</td><td><b>${r.pts}</b></td></tr>`;
    });
    h += '</tbody></table>';
    return h;
  }

  function renderFixtureList(fixtures) {
    const unplayed = fixtures.filter(f => !f.played).slice(0, 10);
    const played = fixtures.filter(f => f.played).slice(-8).reverse();
    let h = '';
    if (unplayed.length) {
      h += '<div class="card-title" style="margin-top:12px">Upcoming</div>';
      unplayed.forEach(f => {
        const home = getTeam(f.home), away = getTeam(f.away);
        if (!home || !away) return;
        h += `<div class="fixture-item"><span class="fixture-teams">${home.flag || ''} ${home.short} vs ${away.flag || ''} ${away.short}</span></div>`;
      });
    }
    if (played.length) {
      h += '<div class="card-title" style="margin-top:12px">Recent Results</div>';
      played.forEach(f => {
        const home = getTeam(f.home), away = getTeam(f.away);
        if (!home || !away) return;
        const reportIdx = f.report ? seasonReportRegistry.push(f.report) - 1 : -1;
        h += `<div class="fixture-item played" style="cursor:${reportIdx >= 0 ? 'pointer' : 'default'}" ${reportIdx >= 0 ? `onclick="App.viewSeasonReport(${reportIdx})"` : ''}>
          <span class="fixture-teams">${home.flag || ''} ${home.short} ${f.homeScore}-${f.awayScore} ${away.short}</span>
          ${reportIdx >= 0 ? '<span style="font-size:0.7rem;color:var(--accent-gold)">Details</span>' : ''}</div>`;
      });
    }
    return h;
  }

  function renderLeagueCompHTML(comp) {
    let h = '<div class="group-card league-table-wrap">';
    h += '<h4>' + comp.name + (comp.finished ? ' — Champion: ' + (comp.champion ? comp.champion.flag + ' ' + comp.champion.name : '—') : '') + '</h4>';
    h += renderStandingsTable(comp, UCL_QUALIFY_PER_LEAGUE);
    h += `<p style="font-size:0.75rem;color:var(--text-muted);margin-top:6px">Green: top ${UCL_QUALIFY_PER_LEAGUE} qualify for next season's Champions League</p>`;
    h += '</div>';
    const allFixtures = [].concat(...comp.rounds);
    h += renderFixtureList(allFixtures);
    return h;
  }

  function renderKnockoutRoundHTML(title, ko) {
    if (!ko) return '';
    let h = '<div class="card-title" style="margin-top:12px">' + title + '</div>';
    ko.fixtures.forEach(f => {
      const home = getTeam(f.home), away = getTeam(f.away);
      if (!home || !away) return;
      if (!f.played) {
        h += `<div class="fixture-item"><span class="fixture-teams">${home.flag || ''} ${home.short} vs ${away.flag || ''} ${away.short}</span></div>`;
      } else {
        const reportIdx = f.report ? seasonReportRegistry.push(f.report) - 1 : -1;
        const pensTxt = f.pens ? ` (pens ${f.pens.home}-${f.pens.away})` : '';
        const winner = getTeam(f.winnerId);
        h += `<div class="fixture-item played" style="cursor:${reportIdx >= 0 ? 'pointer' : 'default'}" ${reportIdx >= 0 ? `onclick="App.viewSeasonReport(${reportIdx})"` : ''}>
          <span class="fixture-teams">${home.flag || ''} ${home.short} ${f.homeScore}-${f.awayScore} ${away.short}${pensTxt} <small style="color:var(--accent-gold)">→ ${winner ? winner.short : '?'}</small></span></div>`;
      }
    });
    return h;
  }

  function renderUCLSeasonHTML(comp) {
    let h = '<div class="group-card league-table-wrap">';
    h += '<h4>' + comp.name + (comp.finished ? ' — Champion: ' + (comp.champion ? comp.champion.flag + ' ' + comp.champion.name : '—') : '') + '</h4>';
    if (comp.stage === 'league' || !comp.bracketSize) {
      h += renderStandingsTable(comp, comp.teams.length >= 8 ? 8 : comp.teams.length);
      h += '</div>';
      const allFixtures = [].concat(...comp.rounds);
      h += renderFixtureList(allFixtures);
    } else {
      h += renderStandingsTable(comp, comp.bracketSize);
      h += '</div>';
      h += renderKnockoutRoundHTML('Quarterfinals', comp.knockout.qf);
      h += renderKnockoutRoundHTML('Semifinals', comp.knockout.sf);
      h += renderKnockoutRoundHTML('Final', comp.knockout.final);
    }
    return h;
  }

  function viewSeasonReport(idx) {
    const report = seasonReportRegistry[idx];
    if (!report) { toast('No detailed report for this match'); return; }
    showMatchReport(report);
  }

  function goToSquadBuilder() {
    switchView('match');
    const setup = document.getElementById('match-setup');
    const live = document.getElementById('match-live');
    if (setup) setup.style.display = 'block';
    if (live) live.style.display = 'none';
    toast('Pick teams & formations, then Kick Off. Lineups are auto-built by formation.');
  }

  return {
    init, switchView, goToMatch, goToTournament, updateTeamPreview,
    startMatch, quickSimMatch, toggleSim, setSpeed, simToEnd, resetMatch,
    showLeaderboard, selectAllTeams, deselectAllTeams, startTournament,
    simTournamentRound, simAllTournament, resetTournament, filterTeams,
    showAwards, goToSquadBuilder, playTournamentMatch, simSingleFixture,
    returnToTournament, showPlayerProfile, showTeamProfile, randomMatch,
    resetLeaderboard, searchTeams, sortTeams, searchTournamentTeams,
    openSquadBuilder, setSquadSlot, toggleBench, openSlotPicker, closeSlotPicker,
    playKnockoutMatch, updateTournamentSelectedCount, autoFillSquadBuilder,
    saveSquadBuilder, closeSquadBuilder, onFormationChange, changeFormationLive,
    setTacticsLive, continueToET, continueToPens, skipETAndEnd,
    renderMomentumAndHeat, showLoading, hideLoading, refreshTournamentStatsUI,
    simKnockoutMatch, viewFixtureReport, viewKnockoutReport, showMatchReport,
    simUCLFixture, playUCLFixture, simPlayoffTie, viewPlayoffReport,
    goToSeason, searchSeasonTeams, toggleSeasonTeam, autoFillSeason, clearSeasonSetup,
    startSeason, simulateSeasonWeek, simulateSeasonToEnd, startNewSeasonYear, resetSeason,
    showSeasonComp, viewSeasonReport
  };
})();

// Expose for inline onclick handlers
try { window.App = App; } catch (e) {}

// Start the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
