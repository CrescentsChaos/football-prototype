/*@CHUNK:c0093:START*/

/*@CHUNK:c0093:END*/

/*@CHUNK:c0094:START*/
  function updateTeamPreview(side) {
    const sel = document.getElementById(side + '-team');
    const el = document.getElementById(side + '-preview');
    if (!sel || !el) return;
    const team = getTeam(sel.value);
    if (!team) { el.innerHTML = ''; return; }
    const mgr = team.manager ? team.manager.name : '';
    const style = getManagerPlaystyle(team);
    const venueLine = side === 'home' ? `<div style="font-size:0.8rem;color:var(--text-muted)">🏟️ ${getStadium(team)}</div>` : '';
    const mgrLine = mgr ? `<div class="manager-name">${managerAvatarMark(team.manager, 20)} Manager: ${mgr}${style ? ' <span class="playstyle-tag">· ' + style + '</span>' : ''}</div>` : '';
    el.innerHTML = `<span class="team-flag">${teamMark(team, 32)}</span><div><div class="team-name">${team.name}</div>${mgrLine}<div style="font-size:0.8rem;color:var(--text-muted)">${(team.players||[]).length} players</div>${venueLine}</div>`;
    const formSel = document.getElementById(side + '-formation');
    if (formSel) formSel.value = pickTeamFormation(team);
  }
/*@CHUNK:c0094:END*/

/*@CHUNK:c0097:START*/

/*@CHUNK:c0097:END*/

/*@CHUNK:c0098:START*/
  // How hard the "recently started" rotation penalty bites, and how
  // protected a squad's core spine is from it, depending on the
  // competition. League football sees the heaviest week-to-week rotation
  // (fixture congestion managed domestically); "group tournament" football
  // (Champions League league phase, World Cup/standalone tournament groups
  // and knockouts) sees managers overwhelmingly send out their strongest
  // XI; a domestic cup (once available) would see the heaviest rotation of
  // all, giving fringe players and squad depth their minutes first.
  const ROTATION_PROFILES = {
    league: { decay: 0.2,  penalty: 3.5, rand: 2.5, coreProtect: 0.55 },
    ucl:    { decay: 0.35, penalty: 1.0, rand: 1.0, coreProtect: 0.9 },
    cup:    { decay: 0.15, penalty: 5.5, rand: 3.5, coreProtect: 0.15 }
  };

  // Infers which rotation profile applies to whatever match is about to be
  // built, from the global sim context, so most call sites don't need to
  // know or pass it explicitly. A standalone tournament (World Cup /
  // Champions League tournament mode) is always "group tournament"
  // football; inside a Season, only the Champions League competition
  // counts as one — every domestic league fixture rotates on the heavier
  // "league" profile.
  function inferRotationProfile() {
    if (typeof tournament !== 'undefined' && tournament) return 'ucl';
    if (typeof currentSeasonComp !== 'undefined' && currentSeasonComp && currentSeasonComp.key === 'ucl') return 'ucl';
    return 'league';
  }

  // The tactical "core" of a squad — the first-choice keeper plus the
  // highest-OVR outfield players, a rough proxy for the spine a manager
  // builds their team around (first-choice centre-back pairing, defensive
  // mid, main striker, etc). Core players are much less affected by the
  // rotation penalty below regardless of competition, and are almost never
  // rotated out for important "group tournament" fixtures.
  function computeCoreIds(allPlayers) {
    const core = new Set();
    const gks = allPlayers.filter(p => (p.pos || [])[0] === 'GK').sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    if (gks[0]) core.add(gks[0].id);
    const outfield = allPlayers.filter(p => (p.pos || [])[0] !== 'GK').sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    outfield.slice(0, 6).forEach(p => core.add(p.id));
    return core;
  }

  function buildSquad(team, formationKey, rotationProfile) {
    const formation = FORMATIONS[formationKey] || FORMATIONS['4-3-3'];
    const allPlayers = team.players || [];
    const prof = ROTATION_PROFILES[rotationProfile || inferRotationProfile()] || ROTATION_PROFILES.league;
    const coreIds = computeCoreIds(allPlayers);

    // Soft squad rotation: every player carries a small "recently started"
    // counter that decays a bit each match. Selection score below docks
    // players who've started often lately, so the exact same XI doesn't
    // take the pitch match after match — while still keeping OVR as the
    // dominant factor, so rotation favors genuinely close alternatives
    // rather than randomly benching your best player. How hard that bites,
    // and how protected the squad's core is from it, depends on the
    // competition (see ROTATION_PROFILES above).
    allPlayers.forEach(p => { p._recentStarts = Math.max(0, (p._recentStarts || 0) - prof.decay); });
    const score = (p) => {
      const protect = coreIds.has(p.id) ? prof.coreProtect : 1;
      return (p.ovr || 70) - (p._recentStarts || 0) * prof.penalty * protect + (seededRandom() * prof.rand - prof.rand / 2);
    };

    let players = shuffleArray(allPlayers.filter(p => !isPlayerInjured(p.id) && !isPlayerSuspended(p.id)));
    if (players.length < 11) {
      // Emergency: allow injured/suspended if roster too thin
      players = players.concat(shuffleArray(allPlayers.filter(p => isPlayerInjured(p.id) || isPlayerSuspended(p.id))));
    }

    const used = new Set();
    const slotOf = new Map(); // slot index -> player

    // Pass 1 — a player's FIRST-listed position is their real position and
    // always gets first claim on a matching slot, ahead of anyone who's
    // merely compatible with it. This stops, e.g., a CB who's also listed
    // as RB-compatible from being slotted in at CB ahead of a natural RB
    // just because formation slots happen to be processed in that order.
    formation.slots.forEach((slot, i) => {
      const candidates = players.filter(p => !used.has(p.id) && (p.pos || [])[0] === slot)
        .sort((a, b) => score(b) - score(a));
      if (candidates.length) {
        used.add(candidates[0].id);
        slotOf.set(i, candidates[0]);
      }
    });

    // Pass 2 — only for slots still empty after pass 1 (this formation has
    // no natural fit available). Fill from compatible secondary positions,
    // preferring whoever's closest to a natural fit (lower index in their
    // own pos list) before falling back to plain selection score. A player
    // whose primary position never got a slot in pass 1, and who isn't
    // needed here either, simply stays unused — i.e., benched — rather
    // than being forced out of position to make up the numbers.
    formation.slots.forEach((slot, i) => {
      if (slotOf.has(i)) return;
      const candidates = players.filter(p => !used.has(p.id) && canPlay(p, slot))
        .sort((a, b) => {
          const aIdx = (a.pos || []).indexOf(slot);
          const bIdx = (b.pos || []).indexOf(slot);
          const aRank = aIdx === -1 ? 99 : aIdx;
          const bRank = bIdx === -1 ? 99 : bIdx;
          if (aRank !== bRank) return aRank - bRank;
          return score(b) - score(a);
        });
      if (candidates.length) {
        used.add(candidates[0].id);
        slotOf.set(i, candidates[0]);
      }
    });

    const starting = [];
    formation.slots.forEach((slot, i) => {
      const p = slotOf.get(i);
      if (p) starting.push({ ...p, slot, isStarter: true });
    });

    // Fallback fill if the squad is too thin to fill every slot even via
    // pass 2 — field whoever's left regardless of position, so we always
    // put out 11 players.
    while (starting.length < 11) {
      const leftover = players.find(p => !used.has(p.id));
      if (!leftover) break;
      used.add(leftover.id);
      starting.push({ ...leftover, slot: (leftover.pos || ['CM'])[0], isStarter: true });
    }

    const remaining = players.filter(p => !used.has(p.id)).sort((a, b) => score(b) - score(a));
    const subs = [];
    for (let i = 0; i < remaining.length && (starting.length + subs.length) < 25; i++) {
      subs.push({ ...remaining[i], slot: (remaining[i].pos || ['CM'])[0], isStarter: false });
    }

    // Whoever actually started is now less likely to start again straight
    // away next match (see rotation decay/score above).
    starting.forEach(sp => {
      const orig = allPlayers.find(x => x.id === sp.id);
      if (orig) orig._recentStarts = (orig._recentStarts || 0) + 1;
    });

    const _seen = new Set();
    const _st = [];
    for (const p of starting) { if (_seen.has(p.id)) continue; _seen.add(p.id); _st.push(p); }
    const _su = [];
    for (const p of subs) { if (_seen.has(p.id)) continue; _seen.add(p.id); _su.push(p); }
    return { starting: _st, subs: _su, formation: formationKey, all: [..._st, ..._su], rotationProfile: rotationProfile || inferRotationProfile() };
  }
/*@CHUNK:c0098:END*/

/*@CHUNK:c0099:START*/

/*@CHUNK:c0099:END*/

/*@CHUNK:c0100:START*/
  function canPlay(player, slot) {
    const positions = player.pos || [];
    return positions.some(p => (POS_COMPAT[slot] || [slot]).includes(p) || p === slot);
  }
/*@CHUNK:c0100:END*/

/*@CHUNK:c0101:START*/

/*@CHUNK:c0101:END*/

/*@CHUNK:c0102:START*/
  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
/*@CHUNK:c0102:END*/

/*@CHUNK:c0103:START*/


  let customLineups = { home: null, away: null };
  let sbSide = null;
  let sbDraft = null;

/*@CHUNK:c0103:END*/

/*@CHUNK:c0104:START*/
  function onFormationChange(side) {
    if (customLineups[side]) customLineups[side] = null;
  }
/*@CHUNK:c0104:END*/

/*@CHUNK:c0105:START*/

/*@CHUNK:c0105:END*/

/*@CHUNK:c0106:START*/
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
/*@CHUNK:c0106:END*/

/*@CHUNK:c0107:START*/

/*@CHUNK:c0107:END*/

/*@CHUNK:c0108:START*/
  function getUsedInDraft() {
    const used = new Set(Object.values(sbDraft.slots).filter(Boolean));
    sbDraft.bench.forEach(function(id) { used.add(id); });
    return used;
  }
/*@CHUNK:c0108:END*/

/*@CHUNK:c0109:START*/

/*@CHUNK:c0109:END*/

/*@CHUNK:c0110:START*/
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
/*@CHUNK:c0110:END*/

/*@CHUNK:c0111:START*/

/*@CHUNK:c0111:END*/

/*@CHUNK:c0112:START*/
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
          '<span class="sb-bench-meta">' + ((p.pos || [])[0] || '') + ' · ' + p.ovr + (fit ? ' · fit' : '') + '</span></button>';
      }).join('') + '</div>';
    picker.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
/*@CHUNK:c0112:END*/

/*@CHUNK:c0113:START*/

/*@CHUNK:c0113:END*/

/*@CHUNK:c0114:START*/
  function closeSlotPicker() {
    const picker = document.getElementById('sb-picker');
    if (picker) { picker.style.display = 'none'; picker.innerHTML = ''; }
  }
/*@CHUNK:c0114:END*/

/*@CHUNK:c0115:START*/


/*@CHUNK:c0115:END*/

/*@CHUNK:c0116:START*/
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
/*@CHUNK:c0116:END*/

/*@CHUNK:c0117:START*/

/*@CHUNK:c0117:END*/

/*@CHUNK:c0118:START*/
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
/*@CHUNK:c0118:END*/

/*@CHUNK:c0119:START*/

/*@CHUNK:c0119:END*/

/*@CHUNK:c0120:START*/
  function autoFillSquadBuilder() {
    if (!sbDraft) return;
    const auto = buildSquad(sbDraft.team, sbDraft.formation);
    sbDraft.slots = {};
    auto.starting.forEach(function(p, i) { sbDraft.slots[i] = p.id; });
    sbDraft.bench = new Set(auto.subs.slice(0, 9).map(function(p) { return p.id; }));
    renderSquadBuilderUI();
    toast('Best XI auto-filled');
  }
/*@CHUNK:c0120:END*/

/*@CHUNK:c0121:START*/

/*@CHUNK:c0121:END*/

/*@CHUNK:c0122:START*/
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
/*@CHUNK:c0122:END*/

/*@CHUNK:c0123:START*/

/*@CHUNK:c0123:END*/

/*@CHUNK:c0124:START*/
  function closeSquadBuilder() {
    const panel = document.getElementById('squad-builder-panel');
    if (panel) panel.style.display = 'none';
    sbDraft = null;
  }
/*@CHUNK:c0124:END*/

/*@CHUNK:c0125:START*/

/*@CHUNK:c0125:END*/

/*@CHUNK:c0126:START*/
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
/*@CHUNK:c0126:END*/

/*@CHUNK:c0450:START*/

  let teamsFilter = 'all';
  let teamsSearch = '';
  let teamsSort = 'name';
  let tourTeamsSearch = '';

/*@CHUNK:c0450:END*/

/*@CHUNK:c0451:START*/
  function teamAvgOvr(t) {
    const ps = t.players || [];
    if (!ps.length) return 0;
    return ps.reduce((s, p) => s + (p.ovr || 70), 0) / ps.length;
  }
/*@CHUNK:c0451:END*/

/*@CHUNK:c0452:START*/

/*@CHUNK:c0452:END*/

/*@CHUNK:c0453:START*/
  function filterTeams(type) {
    teamsFilter = type || 'all';
    renderTeamsList();
  }
/*@CHUNK:c0453:END*/

/*@CHUNK:c0454:START*/

/*@CHUNK:c0454:END*/

/*@CHUNK:c0455:START*/
  function searchTeams(q) {
    teamsSearch = (q || '').trim().toLowerCase();
    renderTeamsList();
  }
/*@CHUNK:c0455:END*/

/*@CHUNK:c0456:START*/

/*@CHUNK:c0456:END*/

/*@CHUNK:c0457:START*/
  function sortTeams(mode) {
    teamsSort = mode || 'name';
    renderTeamsList();
  }
/*@CHUNK:c0457:END*/

/*@CHUNK:c0458:START*/

/*@CHUNK:c0458:END*/

/*@CHUNK:c0459:START*/
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
    else if (teamsSort === 'flag') list.sort((a, b) => (a.flag || '').localeCompare(b.flag || '') || (a.name || '').localeCompare(b.name || ''));
    return list;
  }
/*@CHUNK:c0459:END*/

/*@CHUNK:c0460:START*/

/*@CHUNK:c0460:END*/

/*@CHUNK:c0461:START*/
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
          <span style="font-size:1.5rem">${teamMark(t, 32)}</span>
          <div style="flex:1;min-width:0">
            <strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name}</strong>
            <div style="font-size:0.75rem;color:var(--text-2)">${(t.players || []).length} players · ${t.short || ''}</div>
            <div style="font-size:0.7rem;color:var(--gold);display:flex;align-items:center;gap:4px">${t.manager && t.manager.name ? managerAvatarMark(t.manager, 16) : ''}${(t.manager && t.manager.name) || ''} · ${getManagerPlaystyle(t)}</div>
          </div>
          <span class="player-ovr">${ovr}</span>
        </div>
      </div>`;
    }).join('');
  }
/*@CHUNK:c0461:END*/

/*@CHUNK:c0462:START*/

/*@CHUNK:c0462:END*/

/*@CHUNK:c0463:START*/
  function searchTournamentTeams(q) {
    tourTeamsSearch = (q || '').trim().toLowerCase();
    renderTournamentTeamSelect();
  }
/*@CHUNK:c0463:END*/

/*@CHUNK:c0596:START*/

/*@CHUNK:c0596:END*/

/*@CHUNK:c0597:START*/
  function goToSquadBuilder() {
    switchView('match');
    const setup = document.getElementById('match-setup');
    const live = document.getElementById('match-live');
    if (setup) setup.style.display = 'block';
    if (live) live.style.display = 'none';
    window._tourFixtureIdx = null;
    window._uclFixtureIdx = null;
    window._koRoundIdx = null;
    window._koMatchIdx = null;
    window._fromTournament = false;
    window._seasonFixture = null;
    window._backTarget = null;
    currentSeasonComp = null;
    toast('Pick teams & formations, then Kick Off. Lineups are auto-built by formation.');
  }
/*@CHUNK:c0597:END*/

/*@CHUNK:ctml01:START*/

  // ========== TEAM MATCH LOG ==========
  // teamMatchLog[teamId] -> [{opponent, opponentShort, opponentLogo,
  // opponentFlag, competition, scoreFor, scoreAgainst, result}], newest
  // first, capped per team so persisted save size stays bounded. Populated
  // at full-time for both sides — see recordTeamMatchLog() in
  // engine/matchEngine.js.
  let teamMatchLog = {};

/*@CHUNK:ctml01:END*/

/*@CHUNK:ctml02:START*/

  // Renders a team's recent-results log (last 10) with a colored W/D/L tag
  // per row and the opponent's logo + abbreviation. Shares the same
  // "Match Log" look as renderPlayerMatchLogHTML in ui/playersUI.js, and is
  // dropped straight into the team profile modal — see showTeamProfile()
  // in ui/playerUI.js.
  function renderTeamMatchLogHTML(teamId) {
    const log = teamMatchLog[teamId] || [];
    if (!log.length) return '';
    const resultClass = { W: 'result-w', D: 'result-d', L: 'result-l' };
    const rows = log.slice(0, 10).map(e => {
      const oppMark = teamMark({ logo: e.opponentLogo, flag: e.opponentFlag }, 18);
      return `<div class="team-log-row">
        <span class="result-tag ${resultClass[e.result] || 'result-d'}">${e.result}</span>
        <span class="tlr-opp">${oppMark}<span class="tlr-opp-abbr">${e.opponentShort || e.opponent || '—'}</span></span>
        <span class="tlr-score">${e.scoreFor}-${e.scoreAgainst}</span>
        <span class="tlr-comp">${e.competition || ''}</span>
      </div>`;
    }).join('');
    return `<div class="card-title" style="margin-top:14px">Match Log <span style="color:var(--text-muted);font-weight:400;font-size:0.72rem">(last ${Math.min(log.length, 10)})</span></div>
      <div class="match-log-wrap">${rows}</div>`;
  }

/*@CHUNK:ctml02:END*/
