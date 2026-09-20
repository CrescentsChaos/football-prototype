/*@CHUNK:cp001:START*/

  // ========== PLAYERS TAB ==========
  // Flat, lazily-rendered list of every player across all teams. All players
  // already live in memory via teamsData (loaded once from teams.json), so
  // nothing extra is fetched here — the performance concern with ~5,500
  // players is DOM size, not data size. So we only ever render a bounded
  // "page" of rows at a time (playersShown), growing it on Load More,
  // instead of ever putting every player into the DOM at once.
  let playersFilter = 'all';       // 'all' | 'national' | 'club'
  // 'all' | a broad line (GK/DEF/MID/FWD, see POS_LINE_GROUPS) | a specific
  // slot code (CB, RB, LB, RWB, LWB, CDM, CM, CAM, RM, LM, RW, LW, ST — see
  // POS_ROLE_NAMES in js/state.js).
  let playersPosFilter = 'all';
  let playersRatingFilter = 'all'; // 'all' | 'elite' | 'great' | 'good' | 'dev' — see ovrTierMatches()
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

  // Builds (once, cached) a flat [{player, team, isNational, hasClub,
  // hasNational, clubTeam, nationalTeam}] list across every team. Cheap —
  // teamsData is already fully resident in memory — rendering is where the
  // actual cost lives, and that's handled separately by windowing (see
  // renderPlayersList).
  //
  // A real player who shows up on both a national side and a club (same id,
  // same name — see repairDuplicatePlayerIds() in ui/matchUI.js, which has
  // already split off any *accidental* id collisions between different
  // players before this ever runs) is merged into a single entry here
  // instead of appearing as two separate rows, with both team references
  // attached so the UI can show "Club · Country" together. The club
  // appearance is preferred as the entry's primary `player`/`team` (richer
  // data — logo, stadium, etc.) when both exist.
  function getAllPlayersFlat() {
    if (_allPlayersFlatCache) return _allPlayersFlatCache;
    const byId = {};
    const order = [];
    (teamsData.national || []).forEach(t => (t.players || []).forEach(p => {
      if (!p || !p.id) return;
      if (!byId[p.id]) {
        byId[p.id] = { player: p, team: t, isNational: true, hasNational: true, hasClub: false, nationalTeam: t, clubTeam: null };
        order.push(p.id);
      } else {
        byId[p.id].hasNational = true;
        byId[p.id].nationalTeam = t;
      }
    }));
    (teamsData.club || []).forEach(t => (t.players || []).forEach(p => {
      if (!p || !p.id) return;
      if (!byId[p.id]) {
        byId[p.id] = { player: p, team: t, isNational: false, hasNational: false, hasClub: true, nationalTeam: null, clubTeam: t };
        order.push(p.id);
      } else {
        byId[p.id].hasClub = true;
        byId[p.id].clubTeam = t;
        // Prefer the club appearance as the primary display record.
        byId[p.id].player = p;
        byId[p.id].team = t;
        byId[p.id].isNational = false;
      }
    }));
    const flat = order.map(id => byId[id]);
    _allPlayersFlatCache = flat;
    return flat;
  }

  // Both team affiliations (club/national) for a merged player entry, or
  // nulls if that side doesn't exist for this player. Used to show "Club ·
  // Country" together wherever a player's team affiliation is displayed.
  function getPlayerAffiliations(playerId) {
    const e = getPlayerTeamIndex()[playerId];
    if (!e) return { club: null, national: null };
    return { club: e.clubTeam || null, national: e.nationalTeam || null };
  }

/*@CHUNK:cp002:END*/

/*@CHUNK:cp003:START*/

  // id -> {player, team} lookup index, built once (lazily, cached) off of
  // getAllPlayersFlat(). findPlayerAndTeam used to do a fresh linear scan
  // across every team's full roster on every single call — with ~5,500
  // players that added up fast anywhere it ran per-row (player profile
  // opens, leaderboards, name-highlight lookups), which was a real
  // contributor to the app feeling laggy. Same invalidation lifetime as
  // _allPlayersFlatCache above (built once per loaded roster).
  let _playerTeamIndexCache = null;
  function getPlayerTeamIndex() {
    if (_playerTeamIndexCache) return _playerTeamIndexCache;
    const idx = {};
    getAllPlayersFlat().forEach((e) => { idx[e.player.id] = e; });
    _playerTeamIndexCache = idx;
    return idx;
  }

  // Shared player+team lookup, also used by showPlayerProfile. O(1) via
  // getPlayerTeamIndex() instead of scanning every team's roster.
  function findPlayerAndTeam(playerId) {
    const e = getPlayerTeamIndex()[playerId];
    return e ? { player: e.player, team: e.team } : null;
  }

/*@CHUNK:cp003:END*/

/*@CHUNK:cp004:START*/

  function playerCareerCount(bucket, playerId) {
    return ((careerStats[bucket] || {})[playerId] || {}).count || 0;
  }

/*@CHUNK:cp004:END*/

/*@CHUNK:cp005:START*/

  function getFilteredSortedPlayers() {
    let list = getAllPlayersFlat();
    // hasNational/hasClub (not the single isNational flag) so a merged
    // player who appears on both sides still shows up under either filter.
    if (playersFilter === 'national') list = list.filter(e => e.hasNational);
    else if (playersFilter === 'club') list = list.filter(e => e.hasClub);
    if (playersPosFilter !== 'all') {
      // A broad line ("all defenders") still matches by primary position
      // only, same as before; a specific slot code (RB, CDM, ST...) matches
      // any position in the player's pos array, so a utility player shows
      // up under every slot they can actually play, not just their first.
      if (POS_LINE_GROUPS.indexOf(playersPosFilter) !== -1) {
        list = list.filter(e => POS_LINE[(e.player.pos || [])[0]] === playersPosFilter);
      } else {
        list = list.filter(e => (e.player.pos || []).indexOf(playersPosFilter) !== -1);
      }
    }
    if (playersRatingFilter !== 'all') {
      list = list.filter(e => ovrTierMatches(e.player.ovr, playersRatingFilter));
    }
    if (playersSearch) {
      list = list.filter(e => {
        const p = e.player;
        const skills = (p.expandedAttrs && p.expandedAttrs.skills) || [];
        const styles = (p.expandedAttrs && p.expandedAttrs.playstyle) || [];
        return (p.name || '').toLowerCase().includes(playersSearch) ||
          (e.team.name || '').toLowerCase().includes(playersSearch) ||
          (e.team.short || '').toLowerCase().includes(playersSearch) ||
          skills.some(s => s.toLowerCase().includes(playersSearch)) ||
          styles.some(s => s.toLowerCase().includes(playersSearch));
      });
    }
    list = [...list];
    if (playersSort === 'name') list.sort((a, b) => (a.player.name || '').localeCompare(b.player.name || ''));
    else if (playersSort === 'goals') list.sort((a, b) => playerCareerCount('goals', b.player.id) - playerCareerCount('goals', a.player.id));
    else if (playersSort === 'assists') list.sort((a, b) => playerCareerCount('assists', b.player.id) - playerCareerCount('assists', a.player.id));
    else if (playersSort === 'apps') list.sort((a, b) => playerCareerCount('ratings', b.player.id) - playerCareerCount('ratings', a.player.id));
    else if (playersSort === 'age') {
      // Age/height only exist on the expanded attribute sheet, so players
      // without one sort to the bottom regardless of direction rather than
      // clumping at either end as false zeros.
      list.sort((a, b) => {
        const av = a.player.expandedAttrs && a.player.expandedAttrs.age;
        const bv = b.player.expandedAttrs && b.player.expandedAttrs.age;
        if (typeof av !== 'number' && typeof bv !== 'number') return 0;
        if (typeof av !== 'number') return 1;
        if (typeof bv !== 'number') return -1;
        return av - bv;
      });
    }
    else if (playersSort === 'height') {
      list.sort((a, b) => {
        const av = a.player.expandedAttrs && a.player.expandedAttrs.height_cm;
        const bv = b.player.expandedAttrs && b.player.expandedAttrs.height_cm;
        if (typeof av !== 'number' && typeof bv !== 'number') return 0;
        if (typeof av !== 'number') return 1;
        if (typeof bv !== 'number') return -1;
        return bv - av;
      });
    }
    else if (playersSort === 'trophies') {
      // Counts each player's total trophies won (team trophies via
      // playerIds + individual awards via playerId) in one pass over the
      // trophy case, rather than re-filtering the whole `trophies` array
      // per player (which is what playerWonTrophies() does, and would be
      // far too slow run once per row across the whole player pool).
      const counts = {};
      trophies.forEach(t => {
        if (t.playerId != null) counts[t.playerId] = (counts[t.playerId] || 0) + 1;
        else if (Array.isArray(t.playerIds) && t.playerIds.length) {
          t.playerIds.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
        }
      });
      list.sort((a, b) => (counts[b.player.id] || 0) - (counts[a.player.id] || 0));
    }
    else if (playersSort === 'liveRating') {
      // Best current form first (A > B > C > D > E — see LIVE_RATINGS /
      // ensurePlayerConditionProfile() in engine/form.js). Ties (e.g. two
      // players both on "B") fall back to OVR so the order still feels
      // stable and meaningful within a tier.
      const TIER_RANK = { A: 5, B: 4, C: 3, D: 2, E: 1 };
      list.sort((a, b) => {
        ensurePlayerConditionProfile(a.player);
        ensurePlayerConditionProfile(b.player);
        const av = TIER_RANK[a.player.liveRating] || 0;
        const bv = TIER_RANK[b.player.liveRating] || 0;
        if (bv !== av) return bv - av;
        return (b.player.ovr || 0) - (a.player.ovr || 0);
      });
    }
    else list.sort((a, b) => (b.player.ovr || 0) - (a.player.ovr || 0));
    return list;
  }

/*@CHUNK:cp005:END*/

/*@CHUNK:cp006:START*/

  // Debounced — getFilteredSortedPlayers() filters/sorts the entire player
  // pool (every squad across every team) on each call, which is expensive
  // enough that running it on every keystroke was the main source of
  // typing lag on the Players page.
  const _debouncedRenderPlayersListReset = debounce(() => renderPlayersList(true), 150);
  function searchPlayers(q) {
    playersSearch = (q || '').trim().toLowerCase();
    _debouncedRenderPlayersListReset();
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

/*@CHUNK:cp009b:START*/

  function filterPlayersRating(tier) {
    playersRatingFilter = tier || 'all';
    renderPlayersList(true);
  }

/*@CHUNK:cp009b:END*/

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
    // Age/height only exist on the expanded attribute sheet — shown inline
    // only for those players so the Age/Height sort options have a visible
    // reference point in the list itself.
    const attr = p.expandedAttrs;
    const bioBit = attr && (typeof attr.age === 'number' || typeof attr.height_cm === 'number')
      ? ` · ${typeof attr.age === 'number' ? attr.age + 'y' : ''}${(typeof attr.age === 'number' && typeof attr.height_cm === 'number') ? ' · ' : ''}${typeof attr.height_cm === 'number' ? Math.round(attr.height_cm) + 'cm' : ''}`
      : '';
    // A merged player (same real person on both a club and a national
    // side) shows both affiliations together instead of just one.
    const teamLine = (entry.clubTeam && entry.nationalTeam)
      ? `${teamMark(entry.clubTeam, 14)}<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${entry.clubTeam.short || entry.clubTeam.name}</span> · ${teamMark(entry.nationalTeam, 14)}<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${entry.nationalTeam.short || entry.nationalTeam.name}</span>`
      : `${teamMark(t, 14)}<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.short || t.name}</span>`;
    return `<div class="team-check${selected ? ' selected' : ''}" style="cursor:pointer;border-left:3px solid ${primary}" onclick="${clickAction}">
      <div style="display:flex;align-items:center;gap:8px;width:100%">
        <span class="tsr-avatar" style="width:36px;height:36px;flex-shrink:0">${playerAvatarMark(p)}</span>
        <div style="flex:1;min-width:0">
          <strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${playerNameHTML(p)}</strong>
          <div style="font-size:0.75rem;color:var(--text-2);display:flex;align-items:center;gap:4px">${teamLine} · ${(p.pos || [])[0] || ''}${bioBit}</div>
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
      return `<span class="compare-chip">${teamMark(found.team, 14)} ${playerNameHTML(found.player)}<button type="button" onclick="event.stopPropagation();App.togglePlayerCompare('${id}')" aria-label="Remove ${found.player.name}">✕</button></span>`;
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

  // getVal may return null (attribute doesn't apply to that player, e.g. a
  // GK-only rating for an outfield player) — null values render as '—' and
  // are excluded from the best-value comparison entirely, instead of being
  // coerced to 0 and dragging that player's column down.
  function compareRowsHTML(label, entries, getVal, fmt) {
    const vals = entries.map(e => getVal(e.player));
    let bestIdx = -1, bestVal = -Infinity;
    vals.forEach((v, i) => { if (v != null && v > bestVal) { bestVal = v; bestIdx = i; } });
    const cells = vals.map((v, i) => `<span class="compare-row-val${(i === bestIdx && vals.length > 1 && bestVal > 0) ? ' best' : ''}">${v == null ? '—' : (fmt ? fmt(v) : v)}</span>`).join('');
    return `<div class="compare-row"><span class="compare-row-label">${label}</span>${cells}</div>`;
  }

/*@CHUNK:cp018:END*/

/*@CHUNK:cp018b:START*/

  // Detailed per-rating comparison for enhanced (expanded-attribute)
  // players — the 25+ individual eFootball-style ratings behind a boosted
  // player's att/def/pac/phy/tec, grouped the same way as the profile page
  // (see EXPANDED_ATTR_GROUPS / expandedAttrRowsHTML in playerUI.js). Only
  // rendered once at least 2 of the compared players actually carry an
  // expandedAttrs sheet — comparing a single enhanced player against
  // regular players' (nonexistent) detailed ratings isn't meaningful.
  // Players without a given rating (e.g. a regular player with no sheet at
  // all, or a GK-only rating for an outfield player) show '—' for that row
  // rather than a misleading overwritten 0.
  function expandedCompareRowsHTML(entries) {
    const enhancedCount = entries.filter(e => e.player.attrBoosted && e.player.expandedAttrs).length;
    if (enhancedCount < 2) return '';
    return EXPANDED_ATTR_GROUPS.map((group) => {
      const rows = group.keys.filter(([k]) => entries.some(e => e.player.expandedAttrs && typeof e.player.expandedAttrs[k] === 'number'));
      if (!rows.length) return '';
      const rowsHTML = rows.map(([k, label]) => compareRowsHTML(label, entries, (p) => {
        return (p.expandedAttrs && typeof p.expandedAttrs[k] === 'number') ? p.expandedAttrs[k] : null;
      })).join('');
      return `<div class="card-title" style="margin-top:14px">${group.label}</div>${rowsHTML}`;
    }).join('');
  }

/*@CHUNK:cp018b:END*/

/*@CHUNK:cp018c:START*/

  // When every compared player lines up on both position and playstyle,
  // the raw attribute rows alone don't answer the question that actually
  // motivated the comparison — "which of these should I pick?" — so this
  // works out a winner (highest OVR) and returns a banner naming them,
  // along with which column header should get the crown highlight. Only
  // enhanced players carry playstyle tags at all, so this only fires when
  // every player in the comparison is enhanced and shares the exact same
  // position and at least one playstyle tag.
  function playersComparePositionMatch(entries) {
    if (entries.length < 2) return null;
    const positions = entries.map(e => (e.player.pos || [])[0] || null);
    if (positions.some(p => !p) || !positions.every(p => p === positions[0])) return null;
    const styleLists = entries.map(e => (e.player.attrBoosted && e.player.expandedAttrs && e.player.expandedAttrs.playstyle) || []);
    if (styleLists.some(list => !list.length)) return null;
    const commonStyles = styleLists.reduce((acc, list) => acc.filter(s => list.includes(s)));
    if (!commonStyles.length) return null;
    let bestIdx = 0;
    entries.forEach((e, i) => { if ((e.player.ovr || 0) > (entries[bestIdx].player.ovr || 0)) bestIdx = i; });
    return { position: positions[0], styles: commonStyles, bestIdx };
  }

  function bestPickBannerHTML(entries, match) {
    if (!match) return '';
    const best = entries[match.bestIdx].player;
    return `<div class="compare-best-pick">🏆 Best pick at <strong>${match.position}</strong> (${match.styles.join(', ')}): ${playerNameHTML(best)} — ${best.ovr || '—'} OVR</div>`;
  }

/*@CHUNK:cp018c:END*/

/*@CHUNK:cp019:START*/

  function renderPlayersCompareView() {
    const entries = playersCompareSelection.map(findPlayerAndTeam).filter(Boolean);
    const content = document.getElementById('compare-modal-content');
    if (!content || !entries.length) return;
    const n = entries.length;
    const posMatch = playersComparePositionMatch(entries);
    const header = entries.map((e, i) => `<div class="compare-col-head${posMatch && posMatch.bestIdx === i ? ' best' : ''}">
        <div class="profile-avatar" style="width:52px;height:52px;margin:0 auto 6px;background:${e.team.color || '#d4af37'};border:2px solid ${e.team.secondary || '#fff'};color:${e.team.secondary || '#fff'}">${playerAvatarMark(e.player)}</div>
        <div style="font-weight:700;font-size:0.82rem;line-height:1.2">${playerNameHTML(e.player)}</div>
        <div style="font-size:0.68rem;color:var(--text-2);margin-top:2px">${teamMark(e.team, 14)} ${e.team.short || ''} · ${(e.player.pos || [])[0] || ''}</div>
        <div style="color:var(--gold);font-weight:800;margin-top:3px">${e.player.ovr || '—'} <span style="font-size:0.6rem;font-weight:600;color:var(--text-3)">OVR</span></div>
      </div>`).join('');

    // Core (att/def/pac/phy/tec) rows — these already reflect an enhanced
    // player's derived, expanded-attribute-driven values (applied in
    // applyExpandedPlayerAttributes), same as everywhere else in the app.
    const attrRows = [['ATT', 'att'], ['DEF', 'def'], ['PHY', 'phy'], ['PAC', 'pac'], ['TEC', 'tec']]
      .map(([label, key]) => compareRowsHTML(label, entries, p => p[key] || 0)).join('');

    // The individual eFootball-style ratings behind those core numbers —
    // this is what actually differentiates two enhanced players who happen
    // to land on similar att/def/pac/phy/tec.
    const enhancedRows = expandedCompareRowsHTML(entries);

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
      ${bestPickBannerHTML(entries, posMatch)}
      <div class="compare-grid" style="grid-template-columns:repeat(${n},1fr)">${header}</div>
      <div class="card-title" style="margin-top:14px">Attributes</div>
      ${attrRows}
      ${enhancedRows ? `<div class="card-title" style="margin-top:14px">Enhanced Attributes</div>${enhancedRows}` : ''}
      <div class="card-title" style="margin-top:14px">Career (competitive)</div>
      ${careerRows}
      <div class="modal-actions"><button class="btn btn-secondary" onclick="document.getElementById('compare-modal').classList.remove('active')">Close</button></div>`;
  }

/*@CHUNK:cp019:END*/

/*@CHUNK:cp020:START*/

  // ========== PLAYER MATCH LOG ==========
  // playerMatchLog[playerId] -> array of entries, newest first, capped per
  // player so persisted save size stays bounded. Populated at full-time —
  // see recordPlayerMatchLog() in matchEngine.js.
  //
  // Current entries are compact arrays: [opponentTeamId, competition,
  // minutes, goals, assists, shots, xg, rating] — the opponent's
  // name/short/logo/flag are looked up from opponentTeamId via getTeam()
  // instead of being persisted on every entry (see readPlayerLogEntry()).
  //
  // Saves made before this format change still have plain objects
  // ({opponent, opponentShort, opponentLogo, opponentFlag, competition,
  // minutes, ...}) sitting in the 30-entry cap — those age out naturally
  // as new matches are recorded, and readPlayerLogEntry() understands both
  // shapes in the meantime so old saves keep rendering correctly.
  let playerMatchLog = {};

/*@CHUNK:cp020:END*/

/*@CHUNK:cp020b:START*/

  const PML_OPP = 0, PML_COMP = 1, PML_MIN = 2, PML_G = 3, PML_A = 4, PML_SH = 5, PML_XG = 6, PML_RTG = 7;

  // Normalizes one playerMatchLog entry (new compact array OR legacy
  // object) into a plain object the renderer can use uniformly.
  function readPlayerLogEntry(e) {
    if (Array.isArray(e)) {
      const opp = getTeam(e[PML_OPP]);
      return {
        opponentShort: (opp && (opp.short || opp.name)) || '—',
        opponentLogo: opp ? opp.logo : null,
        opponentFlag: opp ? opp.flag : null,
        competition: e[PML_COMP],
        minutes: e[PML_MIN],
        goals: e[PML_G],
        assists: e[PML_A],
        shots: e[PML_SH],
        xg: e[PML_XG],
        rating: e[PML_RTG]
      };
    }
    // Legacy object-shaped entry from a pre-format-change save.
    return {
      opponentShort: e.opponentShort || e.opponent || '—',
      opponentLogo: e.opponentLogo,
      opponentFlag: e.opponentFlag,
      competition: e.competition,
      minutes: e.minutes,
      goals: e.goals,
      assists: e.assists,
      shots: e.shots,
      xg: e.xg,
      rating: e.rating
    };
  }

/*@CHUNK:cp020b:END*/

/*@CHUNK:cp021:START*/

  function renderPlayerMatchLogHTML(playerId) {
    const log = playerMatchLog[playerId] || [];
    if (!log.length) return '';
    const rows = log.slice(0, 10).map(raw => {
      const e = readPlayerLogEntry(raw);
      const rc = (e.rating || 0) >= 7.5 ? 'rating-high' : (e.rating || 0) >= 6.5 ? 'rating-mid' : 'rating-low';
      const oppMark = teamMark({ logo: e.opponentLogo, flag: e.opponentFlag }, 16);
      return `<tr>
        <td><span style="display:inline-flex;align-items:center;gap:4px">${oppMark}${e.opponentShort}</span></td>
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

/*@CHUNK:cp021c:START*/

  // ========== PLAYER INJURY LOG ==========
  // injuryLog[playerId] -> array of past injury records, newest first,
  // capped at 20 — see its declaration in js/state.js and where entries get
  // pushed in tryInjury() (engine/injuries.js). Unlike injuryBook (which
  // only ever holds the player's CURRENT injury and is deleted once they're
  // fit again), this is a permanent history — reuses hospitalSeverityClass()
  // and hospitalCauseLine() from ui/hospitalUI.js so severity coloring and
  // the "how it happened" line read identically to the live Hospital tab.
  function renderPlayerInjuryLogHTML(playerId) {
    const log = injuryLog[playerId] || [];
    if (!log.length) return '';
    const rows = log.slice(0, 10).map(rec => {
      const out = rec.matchesOut || 1;
      return `<tr>
        <td>${rec.type || '—'}</td>
        <td>${rec.bodyPart || '—'}</td>
        <td><span class="injury-badge ${hospitalSeverityClass(rec.severity)}">${rec.severity || 'Minor'}</span></td>
        <td style="color:var(--text-2);font-size:0.8rem">${hospitalCauseLine(rec)}</td>
        <td>${out} match${out > 1 ? 'es' : ''}</td>
        <td>${rec.matchDay ? 'MD ' + rec.matchDay : '—'}</td>
      </tr>`;
    }).join('');
    return `<div class="card-title" style="margin-top:14px">Injury Log <span style="color:var(--text-muted);font-weight:400;font-size:0.72rem">(last ${Math.min(log.length, 10)})</span></div>
      <div class="match-log-wrap">
        <table class="match-log-table injury-log-table">
          <thead><tr><th>Injury</th><th>Body Part</th><th>Severity</th><th>How it happened</th><th>Out</th><th>MD</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

/*@CHUNK:cp021c:END*/

/*@CHUNK:cp021b:START*/

  // ========== LIVE RATING vs IN-MATCH FORM GRAPH ==========
  // Small canvas chart for the player profile plotting, for each of the
  // player's last 10 logged matches (oldest -> newest, left to right):
  //   - their actual rating in that match ("Live rating" — gold line)
  //   - the liveRating letter tier that rating would produce, per the
  //     same A/B/C/D/E thresholds updateLiveRatingAfterMatch() uses in
  //     engine/form.js ("In-match form" — blue dashed line)
  // so a coach can see at a glance whether a player's raw numbers and
  // their resulting form tier are trending together or diverging.
  // Markup only here — actual drawing happens in
  // drawPlayerRatingFormChart() once the canvas is in the DOM (see
  // showPlayerProfile() in ui/playerUI.js), same split as
  // renderMomentumAndHeat()/its canvas in ui/matchUI.js.
  function renderPlayerRatingFormChartHTML(playerId) {
    const log = playerMatchLog[playerId] || [];
    if (!log.length) return '';
    return `<div class="card-title" style="margin-top:14px">Live Rating vs Form <span style="color:var(--text-muted);font-weight:400;font-size:0.72rem">(last ${Math.min(log.length, 10)})</span></div>
      <div class="rating-form-wrap">
        <canvas id="rating-form-canvas" height="120"></canvas>
        <div class="rating-form-legend">
          <span><i class="rf-dot rf-dot-rating"></i>Match rating</span>
          <span><i class="rf-dot rf-dot-form"></i>Form tier (A–E)</span>
        </div>
      </div>`;
  }

  // Same breakpoints as updateLiveRatingAfterMatch() in engine/form.js —
  // kept in sync deliberately rather than calling that function, since
  // that one also *writes* p.liveRating and we only want to read here.
  function ratingToFormTier(rating) {
    const r = rating || 0;
    if (r >= 8.9) return 'A';
    if (r >= 7.9) return 'B';
    if (r >= 6.9) return 'C';
    if (r >= 5.9) return 'D';
    return 'E';
  }
  const RF_TIER_VALUE = { A: 9.5, B: 8.5, C: 7.5, D: 6.5, E: 5.5 };

  function drawPlayerRatingFormChart(playerId) {
    const canvas = document.getElementById('rating-form-canvas');
    if (!canvas || !canvas.parentElement) return;
    const log = (playerMatchLog[playerId] || []).slice(0, 10).map(readPlayerLogEntry).reverse();
    if (!log.length) return;
    const w = canvas.parentElement.clientWidth || 300;
    const h = 120;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a1210';
    ctx.fillRect(0, 0, w, h);

    const padL = 24, padR = 10, padT = 10, padB = 18;
    const plotW = Math.max(1, w - padL - padR), plotH = h - padT - padB;
    const minV = 4, maxV = 10;
    const yFor = (v) => padT + plotH - ((Math.max(minV, Math.min(maxV, v)) - minV) / (maxV - minV)) * plotH;
    const xFor = (i) => padL + (log.length === 1 ? plotW / 2 : (i / (log.length - 1)) * plotW);

    // Gridlines + scale labels
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.font = '9px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'left';
    [4, 6, 8, 10].forEach(v => {
      const y = yFor(v);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillText(String(v), 3, y + 3);
    });

    // Form-tier line (blue, dashed) — drawn first so the rating line sits
    // on top where the two series overlap.
    ctx.beginPath();
    ctx.setLineDash([4, 3]);
    log.forEach((e, i) => {
      const x = xFor(i), y = yFor(RF_TIER_VALUE[ratingToFormTier(e.rating)]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#3d8bfd';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    log.forEach((e, i) => {
      const tier = ratingToFormTier(e.rating);
      const x = xFor(i), y = yFor(RF_TIER_VALUE[tier]);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#3d8bfd'; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tier, x, y - 7);
    });

    // Match rating line (gold)
    ctx.beginPath();
    log.forEach((e, i) => {
      const x = xFor(i), y = yFor(e.rating || 0);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#f0c14b';
    ctx.lineWidth = 2;
    ctx.stroke();
    log.forEach((e, i) => {
      const x = xFor(i), y = yFor(e.rating || 0);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#f0c14b'; ctx.fill();
    });

    // X-axis: opponent short name per match
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    log.forEach((e, i) => {
      ctx.fillText((e.opponentShort || '').slice(0, 3).toUpperCase(), xFor(i), h - 4);
    });
    ctx.textAlign = 'left';
  }

/*@CHUNK:cp021b:END*/

/*@CHUNK:cp021d:START*/

  // ========== GOALS/ASSISTS/xG CONTRIBUTION CHART ==========
  // Grouped bar chart for the player profile: for each of the player's last
  // 8 logged matches (oldest -> newest, left to right), a goals bar and an
  // assists bar side by side, with xG plotted as a line over the top — so
  // a coach can see at a glance whether a player's output is keeping pace
  // with the chances his xG says he's getting. Same markup/draw split as
  // renderPlayerRatingFormChartHTML/drawPlayerRatingFormChart just above.
  function renderPlayerContributionChartHTML(playerId) {
    const log = playerMatchLog[playerId] || [];
    if (!log.length) return '';
    return `<div class="card-title" style="margin-top:14px">Goal Contribution <span style="color:var(--text-muted);font-weight:400;font-size:0.72rem">(last ${Math.min(log.length, 8)})</span></div>
      <div class="rating-form-wrap">
        <canvas id="contribution-canvas" height="120"></canvas>
        <div class="rating-form-legend">
          <span><i class="rf-dot rf-dot-goals"></i>Goals</span>
          <span><i class="rf-dot rf-dot-assists"></i>Assists</span>
          <span><i class="rf-dot rf-dot-xg"></i>xG</span>
        </div>
      </div>`;
  }

  function drawPlayerContributionChart(playerId) {
    const canvas = document.getElementById('contribution-canvas');
    if (!canvas || !canvas.parentElement) return;
    const log = (playerMatchLog[playerId] || []).slice(0, 8).map(readPlayerLogEntry).reverse();
    if (!log.length) return;
    const w = canvas.parentElement.clientWidth || 300;
    const h = 120;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a1210';
    ctx.fillRect(0, 0, w, h);

    const padL = 22, padR = 10, padT = 10, padB = 18;
    const plotW = Math.max(1, w - padL - padR), plotH = h - padT - padB;
    const maxCount = Math.max(1, ...log.map(e => Math.max(e.goals || 0, e.assists || 0, e.xg || 0)));
    const yFor = (v) => padT + plotH - (Math.min(maxCount, v) / maxCount) * plotH;
    const slotW = plotW / log.length;
    const barW = Math.max(3, slotW * 0.28);

    // Gridlines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.font = '9px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'left';
    const steps = Math.min(4, maxCount);
    for (let s = 0; s <= steps; s++) {
      const v = (maxCount / steps) * s;
      const y = yFor(v);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillText(String(Math.round(v)), 2, y + 3);
    }

    // Goals + assists grouped bars
    log.forEach((e, i) => {
      const slotX = padL + i * slotW + slotW / 2;
      const gx = slotX - barW * 0.6, ax = slotX + barW * 0.6 - barW;
      const gy = yFor(e.goals || 0), ay = yFor(e.assists || 0);
      ctx.fillStyle = '#f0c14b';
      ctx.fillRect(gx - barW / 2, gy, barW, (padT + plotH) - gy);
      ctx.fillStyle = '#3d8bfd';
      ctx.fillRect(ax - barW / 2, ay, barW, (padT + plotH) - ay);
    });

    // xG line (mint), drawn over the bars
    ctx.beginPath();
    log.forEach((e, i) => {
      const x = padL + i * slotW + slotW / 2, y = yFor(e.xg || 0);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#3ddc97';
    ctx.lineWidth = 2;
    ctx.stroke();
    log.forEach((e, i) => {
      const x = padL + i * slotW + slotW / 2, y = yFor(e.xg || 0);
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#3ddc97'; ctx.fill();
    });

    // X-axis: opponent short name per match
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    log.forEach((e, i) => {
      ctx.fillText((e.opponentShort || '').slice(0, 3).toUpperCase(), padL + i * slotW + slotW / 2, h - 4);
    });
    ctx.textAlign = 'left';
  }

/*@CHUNK:cp021d:END*/
