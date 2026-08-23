/*@CHUNK:cp001:START*/

  // ========== PLAYERS TAB ==========
  // Flat, lazily-rendered list of every player across all teams. All players
  // already live in memory via teamsData (loaded once from teams.json), so
  // nothing extra is fetched here — the performance concern with ~5,500
  // players is DOM size, not data size. So we only ever render a bounded
  // "page" of rows at a time (playersShown), growing it on Load More,
  // instead of ever putting every player into the DOM at once.
  let playersFilter = 'all';       // 'all' | 'national' | 'club'
  let playersPosFilter = 'all';    // 'all' | 'GK' | 'DEF' | 'MID' | 'FWD'
  let playersSearch = '';
  let playersSort = 'ovr';
  const PLAYERS_PAGE_SIZE = 40;
  let playersShown = PLAYERS_PAGE_SIZE;
  let playersCompareMode = false;
  let playersCompareSelection = []; // up to 3 player ids
  let _allPlayersFlatCache = null;
  const PLAYERS_COMPARE_MAX = 3;

/*@CHUNK:cp001:END*/

/*@CHUNK:cp002:START*/

  // Builds (once, cached) a flat [{player, team, isNational}] list across
  // every team. Cheap — teamsData is already fully resident in memory —
  // rendering is where the actual cost lives, and that's handled separately
  // by windowing (see renderPlayersList).
  function getAllPlayersFlat() {
    if (_allPlayersFlatCache) return _allPlayersFlatCache;
    const flat = [];
    (teamsData.national || []).forEach(t => (t.players || []).forEach(p => flat.push({ player: p, team: t, isNational: true })));
    (teamsData.club || []).forEach(t => (t.players || []).forEach(p => flat.push({ player: p, team: t, isNational: false })));
    _allPlayersFlatCache = flat;
    return flat;
  }

/*@CHUNK:cp002:END*/

/*@CHUNK:cp003:START*/

  // Shared player+team lookup, also used by showPlayerProfile.
  function findPlayerAndTeam(playerId) {
    for (const t of allTeams) {
      const p = (t.players || []).find(x => x.id === playerId);
      if (p) return { player: p, team: t };
    }
    return null;
  }

/*@CHUNK:cp003:END*/

/*@CHUNK:cp004:START*/

  function playerCareerCount(bucket, playerId) {
    return ((stats[bucket] || {})[playerId] || {}).count || 0;
  }

/*@CHUNK:cp004:END*/

/*@CHUNK:cp005:START*/

  function getFilteredSortedPlayers() {
    let list = getAllPlayersFlat();
    if (playersFilter === 'national') list = list.filter(e => e.isNational);
    else if (playersFilter === 'club') list = list.filter(e => !e.isNational);
    if (playersPosFilter !== 'all') {
      list = list.filter(e => POS_LINE[(e.player.pos || [])[0]] === playersPosFilter);
    }
    if (playersSearch) {
      list = list.filter(e =>
        (e.player.name || '').toLowerCase().includes(playersSearch) ||
        (e.team.name || '').toLowerCase().includes(playersSearch) ||
        (e.team.short || '').toLowerCase().includes(playersSearch)
      );
    }
    list = [...list];
    if (playersSort === 'name') list.sort((a, b) => (a.player.name || '').localeCompare(b.player.name || ''));
    else if (playersSort === 'goals') list.sort((a, b) => playerCareerCount('goals', b.player.id) - playerCareerCount('goals', a.player.id));
    else if (playersSort === 'assists') list.sort((a, b) => playerCareerCount('assists', b.player.id) - playerCareerCount('assists', a.player.id));
    else if (playersSort === 'apps') list.sort((a, b) => playerCareerCount('ratings', b.player.id) - playerCareerCount('ratings', a.player.id));
    else list.sort((a, b) => (b.player.ovr || 0) - (a.player.ovr || 0));
    return list;
  }

/*@CHUNK:cp005:END*/

/*@CHUNK:cp006:START*/

  function searchPlayers(q) {
    playersSearch = (q || '').trim().toLowerCase();
    renderPlayersList(true);
  }

/*@CHUNK:cp006:END*/

/*@CHUNK:cp007:START*/

  function sortPlayers(mode) {
    playersSort = mode || 'ovr';
    renderPlayersList(true);
  }

/*@CHUNK:cp007:END*/

/*@CHUNK:cp008:START*/

  function filterPlayersPos(pos) {
    playersPosFilter = pos || 'all';
    renderPlayersList(true);
  }

/*@CHUNK:cp008:END*/

/*@CHUNK:cp009:START*/

  function filterPlayersType(type) {
    playersFilter = type || 'all';
    renderPlayersList(true);
  }

/*@CHUNK:cp009:END*/

/*@CHUNK:cp010:START*/

  function loadMorePlayers() {
    playersShown += PLAYERS_PAGE_SIZE;
    renderPlayersList(false);
  }

/*@CHUNK:cp010:END*/

/*@CHUNK:cp011:START*/

  function renderPlayerRow(entry) {
    const p = entry.player, t = entry.team;
    const selected = playersCompareSelection.indexOf(p.id) !== -1;
    const clickAction = playersCompareMode ? `App.togglePlayerCompare('${p.id}')` : `App.showPlayerProfile('${p.id}')`;
    const primary = t.color || '#d4af37';
    return `<div class="team-check${selected ? ' selected' : ''}" style="cursor:pointer;border-left:3px solid ${primary}" onclick="${clickAction}">
      <div style="display:flex;align-items:center;gap:8px;width:100%">
        <span class="tsr-avatar" style="width:36px;height:36px;flex-shrink:0">${playerAvatarMark(p)}</span>
        <div style="flex:1;min-width:0">
          <strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</strong>
          <div style="font-size:0.75rem;color:var(--text-2);display:flex;align-items:center;gap:4px">${teamMark(t, 14)}<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.short || t.name}</span> · ${(p.pos || []).join('/')}</div>
        </div>
        ${playersCompareMode ? `<span class="compare-check${selected ? ' checked' : ''}">${selected ? '✓' : ''}</span>` : ''}
        ${formArrow(p)}
        <span class="player-ovr">${p.ovr || ''}</span>
      </div>
    </div>`;
  }

/*@CHUNK:cp011:END*/

/*@CHUNK:cp012:START*/

  function renderPlayersList(reset) {
    if (reset) playersShown = PLAYERS_PAGE_SIZE;
    const list = getFilteredSortedPlayers();
    const el = document.getElementById('players-list');
    if (!el) return;
    const countEl = document.getElementById('players-count');
    if (countEl) countEl.textContent = list.length ? `${list.length} player${list.length === 1 ? '' : 's'} · showing ${Math.min(playersShown, list.length)}` : '';
    if (!list.length) {
      el.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><p>No players match your search.</p></div>';
      const moreBtn = document.getElementById('players-load-more');
      if (moreBtn) moreBtn.style.display = 'none';
      return;
    }
    const slice = list.slice(0, playersShown);
    el.innerHTML = slice.map(renderPlayerRow).join('');
    const moreBtn = document.getElementById('players-load-more');
    if (moreBtn) moreBtn.style.display = list.length > playersShown ? 'inline-flex' : 'none';
  }

/*@CHUNK:cp012:END*/

/*@CHUNK:cp013:START*/

  // ========== PLAYER COMPARISON ==========
  function togglePlayersCompareMode() {
    playersCompareMode = !playersCompareMode;
    if (!playersCompareMode) playersCompareSelection = [];
    const btn = document.getElementById('players-compare-toggle');
    if (btn) btn.classList.toggle('active', playersCompareMode);
    const tray = document.getElementById('players-compare-tray');
    const actions = document.getElementById('players-compare-actions');
    if (tray) tray.style.display = playersCompareMode ? 'flex' : 'none';
    if (actions) actions.style.display = playersCompareMode ? 'flex' : 'none';
    renderPlayersCompareTray();
    renderPlayersList(false);
  }

/*@CHUNK:cp013:END*/

/*@CHUNK:cp014:START*/

  function togglePlayerCompare(playerId) {
    const idx = playersCompareSelection.indexOf(playerId);
    if (idx !== -1) {
      playersCompareSelection.splice(idx, 1);
    } else {
      if (playersCompareSelection.length >= PLAYERS_COMPARE_MAX) {
        toast(`You can compare up to ${PLAYERS_COMPARE_MAX} players — remove one first`);
        return;
      }
      playersCompareSelection.push(playerId);
    }
    renderPlayersCompareTray();
    renderPlayersList(false);
  }

/*@CHUNK:cp014:END*/

/*@CHUNK:cp015:START*/

  function clearPlayersCompare() {
    playersCompareSelection = [];
    renderPlayersCompareTray();
    renderPlayersList(false);
  }

/*@CHUNK:cp015:END*/

/*@CHUNK:cp016:START*/

  function renderPlayersCompareTray() {
    const tray = document.getElementById('players-compare-tray');
    const goBtn = document.getElementById('players-compare-go');
    if (goBtn) goBtn.disabled = playersCompareSelection.length < 2;
    if (!tray) return;
    if (!playersCompareSelection.length) {
      tray.innerHTML = `<span style="color:var(--text-muted);font-size:0.8rem">Tap players below to add them to comparison (up to ${PLAYERS_COMPARE_MAX})</span>`;
      return;
    }
    tray.innerHTML = playersCompareSelection.map(id => {
      const found = findPlayerAndTeam(id);
      if (!found) return '';
      return `<span class="compare-chip">${teamMark(found.team, 14)} ${found.player.name}<button type="button" onclick="event.stopPropagation();App.togglePlayerCompare('${id}')" aria-label="Remove ${found.player.name}">✕</button></span>`;
    }).join('');
  }

/*@CHUNK:cp016:END*/

/*@CHUNK:cp017:START*/

  function openPlayersCompare() {
    if (playersCompareSelection.length < 2) { toast('Select at least 2 players to compare'); return; }
    renderPlayersCompareView();
    const modal = document.getElementById('compare-modal');
    if (modal) modal.classList.add('active');
  }

/*@CHUNK:cp017:END*/

/*@CHUNK:cp018:START*/

  function compareRowsHTML(label, entries, getVal, fmt) {
    const vals = entries.map(e => getVal(e.player));
    let bestIdx = -1, bestVal = -Infinity;
    vals.forEach((v, i) => { if (v > bestVal) { bestVal = v; bestIdx = i; } });
    const cells = vals.map((v, i) => `<span class="compare-row-val${(i === bestIdx && vals.length > 1 && bestVal > 0) ? ' best' : ''}">${fmt ? fmt(v) : v}</span>`).join('');
    return `<div class="compare-row"><span class="compare-row-label">${label}</span>${cells}</div>`;
  }

/*@CHUNK:cp018:END*/

/*@CHUNK:cp019:START*/

  function renderPlayersCompareView() {
    const entries = playersCompareSelection.map(findPlayerAndTeam).filter(Boolean);
    const content = document.getElementById('compare-modal-content');
    if (!content || !entries.length) return;
    const n = entries.length;
    const header = entries.map(e => `<div class="compare-col-head">
        <div class="profile-avatar" style="width:52px;height:52px;margin:0 auto 6px;background:${e.team.color || '#d4af37'};border:2px solid ${e.team.secondary || '#fff'};color:${e.team.secondary || '#fff'}">${playerAvatarMark(e.player)}</div>
        <div style="font-weight:700;font-size:0.82rem;line-height:1.2">${e.player.name}</div>
        <div style="font-size:0.68rem;color:var(--text-2);margin-top:2px">${teamMark(e.team, 14)} ${e.team.short || ''} · ${(e.player.pos || []).join('/')}</div>
        <div style="color:var(--gold);font-weight:800;margin-top:3px">${e.player.ovr || '—'} <span style="font-size:0.6rem;font-weight:600;color:var(--text-3)">OVR</span></div>
      </div>`).join('');

    const attrRows = [['ATT', 'att'], ['DEF', 'def'], ['PHY', 'phy'], ['PAC', 'pac'], ['TEC', 'tec']]
      .map(([label, key]) => compareRowsHTML(label, entries, p => p[key] || 0)).join('');

    const careerRows = [
      ['Apps', p => playerCareerCount('ratings', p.id)],
      ['Goals', p => playerCareerCount('goals', p.id)],
      ['Assists', p => playerCareerCount('assists', p.id)],
      ['MOTM', p => playerCareerCount('motm', p.id)],
      ['Saves', p => playerCareerCount('saves', p.id)],
      ['Yellows', p => playerCareerCount('yellows', p.id)],
      ['Reds', p => playerCareerCount('reds', p.id)]
    ].map(([label, fn]) => compareRowsHTML(label, entries, fn)).join('');

    content.innerHTML = `
      <div class="card-title">Player Comparison</div>
      <div class="compare-grid" style="grid-template-columns:repeat(${n},1fr)">${header}</div>
      <div class="card-title" style="margin-top:14px">Attributes</div>
      ${attrRows}
      <div class="card-title" style="margin-top:14px">Career (competitive)</div>
      ${careerRows}
      <div class="modal-actions"><button class="btn btn-secondary" onclick="document.getElementById('compare-modal').classList.remove('active')">Close</button></div>`;
  }

/*@CHUNK:cp019:END*/

/*@CHUNK:cp020:START*/

  // ========== PLAYER MATCH LOG ==========
  // playerMatchLog[playerId] -> [{opponent, opponentShort, competition,
  // minutes, goals, assists, shots, xg, rating}], newest first, capped per
  // player so persisted save size stays bounded. Populated at full-time —
  // see recordPlayerMatchLog() in matchEngine.js.
  let playerMatchLog = {};

/*@CHUNK:cp020:END*/

/*@CHUNK:cp021:START*/

  function renderPlayerMatchLogHTML(playerId) {
    const log = playerMatchLog[playerId] || [];
    if (!log.length) return '';
    const rows = log.slice(0, 10).map(e => {
      const rc = (e.rating || 0) >= 7.5 ? 'rating-high' : (e.rating || 0) >= 6.5 ? 'rating-mid' : 'rating-low';
      return `<tr>
        <td>${e.opponentShort || e.opponent || '—'}</td>
        <td>${e.competition || ''}</td>
        <td>${e.minutes}'</td>
        <td>${e.goals || 0}</td>
        <td>${e.assists || 0}</td>
        <td>${e.shots || 0}</td>
        <td>${(e.xg || 0).toFixed(2)}</td>
        <td><span class="rating-badge ${rc}">${(e.rating || 0).toFixed(1)}</span></td>
      </tr>`;
    }).join('');
    return `<div class="card-title" style="margin-top:14px">Match Log <span style="color:var(--text-muted);font-weight:400;font-size:0.72rem">(last ${Math.min(log.length, 10)})</span></div>
      <div class="match-log-wrap">
        <table class="match-log-table">
          <thead><tr><th>Opp</th><th>Comp</th><th>Min</th><th>G</th><th>A</th><th>Sh</th><th>xG</th><th>Rtg</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

/*@CHUNK:cp021:END*/
