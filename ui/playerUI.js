/*@CHUNK:c0070:START*/
  // ========== TEAM LOGOS / PLAYER PORTRAITS ==========
  // Renders a team's logo (from assets/logos/<team.logo>, set via the "logo"
  // field in teams.json) as a small inline mark, falling back to the flag
  // emoji if no logo is set or the image fails to load.
/*@CHUNK:c0070:END*/

/*@CHUNK:c0071:START*/
  function teamMark(team, size) {
    size = size || 22;
    const flag = (team && team.flag) || '⚽';
    if (team && team.logo) {
      const src = 'assets/logos/' + team.logo;
      return `<span class="team-mark" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.82)}px"><img src="${src}" alt="" loading="lazy" onerror="this.parentElement.textContent='${flag}'"></span>`;
    }
    return `<span class="team-mark" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.82)}px">${flag}</span>`;
  }
/*@CHUNK:c0071:END*/

/*@CHUNK:c0072:START*/

  // Larger circular version for profile-avatar style containers (fills the
  // whole circle). Falls back to the flag emoji on missing/broken image.
/*@CHUNK:c0072:END*/

/*@CHUNK:c0073:START*/
  function teamAvatarMark(team) {
    const flag = (team && team.flag) || '⚽';
    if (team && team.logo) {
      const src = 'assets/logos/' + team.logo;
      return `<img src="${src}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:50%" onerror="this.outerHTML='${flag}'">`;
    }
    return flag;
  }
/*@CHUNK:c0073:END*/

/*@CHUNK:c0074:START*/

  // Looks up a player's portrait filename in players.json. Supports both
  // keying conventions: by player id (e.g. "rma26_7") or by exact player
  // name (e.g. "Vinicius Junior") — id is checked first since it's the
  // more specific, collision-proof key. Returns null if neither is found.
/*@CHUNK:c0074:END*/

/*@CHUNK:c0075:START*/
  function resolvePlayerPortrait(player) {
    if (!player) return null;
    if (player.id != null && playerPortraits[player.id]) return playerPortraits[player.id];
    if (player.name && playerPortraits[player.name]) return playerPortraits[player.name];
    return null;
  }
/*@CHUNK:c0075:END*/

/*@CHUNK:c0076:START*/

  // Renders a player's portrait (from assets/portraits/<file>, looked up by
  // id or name in players.json) filling a circular avatar container. Falls
  // back to assets/portraits/none.png when no entry exists in players.json,
  // and further falls back to the player's shirt number if even none.png
  // fails to load.
/*@CHUNK:c0076:END*/

/*@CHUNK:c0077:START*/
  function playerAvatarMark(player) {
    const num = (player && player.num != null) ? player.num : '?';
    const file = resolvePlayerPortrait(player);
    const src = 'assets/portraits/' + (file || 'none.png');
    return `<img src="${src}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.outerHTML='${num}'">`;
  }
/*@CHUNK:c0077:END*/

/*@CHUNK:c0078:START*/

  // Shortens a full name to "F. Lastname" for tight spaces like formation
  // dots — e.g. "Alessandro Nesta" -> "A. Nesta". Only abbreviates when the
  // surname is longer than 2 characters; short surnames (and single-word
  // names, which have nothing to abbreviate) are left as-is.
/*@CHUNK:c0078:END*/

/*@CHUNK:c0079:START*/
  function abbreviateName(fullName) {
    const trimmed = (fullName || '').trim();
    const spaceIdx = trimmed.indexOf(' ');
    if (spaceIdx === -1) return trimmed;
    const first = trimmed.slice(0, spaceIdx);
    const last = trimmed.slice(spaceIdx + 1).trim();
    if (last.length > 2 && first.length) return first[0] + '. ' + last;
    return trimmed;
  }
/*@CHUNK:c0079:END*/

/*@CHUNK:c0080:START*/

  // Renders a small circular portrait for leaderboard/award rows, looked up
  // by id or name in players.json (same source as playerAvatarMark). Falls
  // back to assets/portraits/none.png when no portrait is found, and
  // further falls back to the player's initials on a coloured circle if
  // even none.png fails to load — this keeps two different players who
  // happen to share a name from silently displaying as visually identical
  // avatars, since initials are still derived per-row from that row's own
  // name/id, never borrowed from another row.
/*@CHUNK:c0080:END*/

/*@CHUNK:c0081:START*/
  function initialsOf(name) {
    return (name || '?').trim().split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
  }
/*@CHUNK:c0081:END*/

/*@CHUNK:c0082:START*/
  function lbAvatar(p, size) {
    size = size || 34;
    const initials = initialsOf(p && p.name);
    const file = resolvePlayerPortrait(p);
    const src = 'assets/portraits/' + (file || 'none.png');
    return `<span class="lb-avatar" style="width:${size}px;height:${size}px"><img src="${src}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.parentElement.classList.add('lb-avatar-fallback');this.outerHTML='${initials}'"></span>`;
  }
/*@CHUNK:c0082:END*/

/*@CHUNK:c0083:START*/
  // Player name + portrait, for use inside a leaderboard/award table cell.
/*@CHUNK:c0083:END*/

/*@CHUNK:c0084:START*/
  function lbPlayerCell(p, size) {
    return `<div class="lb-player-cell">${lbAvatar(p, size)}<span class="lb-player-name">${p.name}</span></div>`;
  }
/*@CHUNK:c0084:END*/

/*@CHUNK:c0085:START*/
  // Rank badge for position i (0-indexed): medal for top 3, plain number after.
/*@CHUNK:c0085:END*/

/*@CHUNK:c0086:START*/
  function rankBadge(i) {
    const n = i + 1;
    if (n === 1) return `<span class="lb-rank-badge rank-1">🥇</span>`;
    if (n === 2) return `<span class="lb-rank-badge rank-2">🥈</span>`;
    if (n === 3) return `<span class="lb-rank-badge rank-3">🥉</span>`;
    return `<span class="lb-rank-badge">${n}</span>`;
  }
/*@CHUNK:c0086:END*/

/*@CHUNK:c0087:START*/

  // Renders a trophy image (from assets/trophies/<file>, looked up by exact
  // trophy/competition name in trophies.json) inside a rounded container,
  // falling back to the 🏆 emoji when no image is mapped for that name.
/*@CHUNK:c0087:END*/

/*@CHUNK:c0088:START*/
  function trophyMark(name, size) {
    size = size || 40;
    const file = name && trophyImages[name];
    if (file) {
      const src = 'assets/trophies/' + file;
      return `<span class="trophy-mark" style="width:${size}px;height:${size}px"><img src="${src}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain" onerror="this.parentElement.outerHTML='<span class=&quot;trophy-mark trophy-mark-fallback&quot; style=&quot;width:${size}px;height:${size}px;font-size:${Math.round(size*0.6)}px&quot;>🏆</span>'"></span>`;
    }
    return `<span class="trophy-mark trophy-mark-fallback" style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.6)}px">🏆</span>`;
  }
/*@CHUNK:c0088:END*/

/*@CHUNK:c0089:START*/

  // Looks up a manager's portrait filename in managers.json. Tries an exact
  // name match first, then falls back to a trimmed/case-insensitive match so
  // small formatting differences between teams.json and managers.json (extra
  // whitespace, different casing) don't silently drop a portrait that exists.
/*@CHUNK:c0089:END*/

/*@CHUNK:c0090:START*/
  function resolveManagerPortrait(manager) {
    if (!manager || !manager.name) return null;
    if (managerPortraits[manager.name]) return managerPortraits[manager.name];
    const target = manager.name.trim().toLowerCase();
    for (const key in managerPortraits) {
      if (key.trim().toLowerCase() === target) return managerPortraits[key];
    }
    return null;
  }
/*@CHUNK:c0090:END*/

/*@CHUNK:c0091:START*/

  // Renders a manager's portrait (from assets/mportraits/<file>, looked up by
  // name in managers.json) inside a circular avatar. Falls back to
  // assets/mportraits/none.png when no entry exists in managers.json, and
  // further falls back to a suit-and-tie badge if even none.png fails to load.
  // Used anywhere a manager appears: match setup preview, live scoreboard,
  // formation pitch label, Teams tab list, and the full Team profile modal.
/*@CHUNK:c0091:END*/

/*@CHUNK:c0092:START*/
  function managerAvatarMark(manager, size) {
    size = size || 32;
    const file = resolveManagerPortrait(manager);
    const src = 'assets/mportraits/' + (file || 'none.png');
    return `<span class="mgr-avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.55)}px"><img src="${src}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.parentElement.classList.add('mgr-avatar-fallback');this.innerHTML='🧑\u200d💼'"></span>`;
  }
/*@CHUNK:c0092:END*/

/*@CHUNK:c0476:START*/


  // Trophy Cabinet: every individual award a player (matched by exact name,
  // same convention as playerPortraits/trophyImages) has won, newest first.
/*@CHUNK:c0476:END*/

/*@CHUNK:c0477:START*/
  function playerTrophyCabinetHTML(playerName) {
    const won = trophies.filter(t => t.player === playerName).sort((a, b) => (b.date || 0) - (a.date || 0));
    if (!won.length) return '';
    return `<div class="card-title" style="margin-top:14px">🏆 Trophy Cabinet</div>
      <div class="trophy-cabinet-grid">
        ${won.map(t => `<div class="trophy-cabinet-item" title="${t.type || ''}">${trophyMark(t.name, 56)}<div class="tc-name">${t.name}</div><div class="tc-type">${t.type || ''}</div></div>`).join('')}
      </div>`;
  }
/*@CHUNK:c0477:END*/

/*@CHUNK:c0478:START*/

  // Renders the full expanded attribute sheet (grouped, individual raw
  // ratings) for a player whose stats come from player-attributes.json —
  // shown instead of the generic merged ATT/DEF/PHY/PAC/TEC bars, since a
  // player with a detailed sheet should have their actual detailed sheet
  // visible, not just the 5-stat blend it was compressed into. A rating
  // that was lifted by the manager's tactic affinity is marked so it's
  // clear the boost reached the individual attribute, not just the OVR.
/*@CHUNK:c0478:END*/

/*@CHUNK:c0479:START*/
  function expandedAttrRowsHTML(player) {
    const attr = player.expandedAttrs || {};
    const boostedKeys = new Set();
    if (player.managerAttrBoosted && player.affinityStyle) {
      (attr.playstyle || []).forEach((style) => {
        const suited = PLAYSTYLE_AFFINITY[style];
        if (suited && suited.includes(player.affinityStyle)) {
          (PLAYSTYLE_KEY_ATTRS[style] || []).forEach(k => boostedKeys.add(k));
        }
      });
    }
    return EXPANDED_ATTR_GROUPS.map((group) => {
      const rows = group.keys.filter(([k]) => typeof attr[k] === 'number');
      if (!rows.length) return '';
      return `<div class="expanded-attr-group">
        <div class="expanded-attr-group-title">${group.label}</div>
        ${rows.map(([k, label]) => `
          <div class="attr-bar-row expanded${boostedKeys.has(k) ? ' mgr-boosted' : ''}">
            <span class="attr-name">${label}</span>
            <div class="attr-track"><div class="attr-fill" style="width:${attr[k]}%"></div></div>
            <span class="attr-val">${attr[k]}</span>
          </div>`).join('')}
      </div>`;
    }).join('');
  }
/*@CHUNK:c0479:END*/

/*@CHUNK:c0480:START*/

/*@CHUNK:c0480:END*/

/*@CHUNK:c0481:START*/
  function showPlayerProfile(playerId) {
    let player = null, team = null;
    const found = findPlayerAndTeam(playerId);
    if (found) { player = found.player; team = found.team; }
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
    const boosted = !!player.attrBoosted;
    const boostBadge = boosted
      ? `<span class="attr-boost-badge" title="Overall derived from expanded attribute data, position, and manager-tactic affinity">★ Enhanced</span>`
      : '';
    const affinityNote = (boosted && player.affinityBonus > 0)
      ? `<div style="color:var(--text-2);font-size:0.75rem;margin-top:2px">+${player.affinityBonus} OVR — fits ${team ? team.name + "'s" : "the"} ${player.affinityStyle} setup</div>`
      : '';
    const signatureNote = (boosted && player.signatureBonus > 0)
      ? `<div style="color:var(--text-2);font-size:0.75rem;margin-top:2px">+${player.signatureBonus} OVR — signature attributes for their playstyle run well above the rest of their sheet</div>`
      : '';
    const managerAttrNote = (boosted && player.managerAttrBoosted)
      ? `<div style="color:var(--gold);font-size:0.75rem;margin-top:2px">⬆ Manager coaching is sharpening this player's playstyle attributes (marked below)</div>`
      : '';
    const playstyleTagsHTML = (boosted && player.expandedAttrs && (player.expandedAttrs.playstyle || []).length)
      ? `<div style="margin-top:6px">${player.expandedAttrs.playstyle.map(s => {
          const suited = (PLAYSTYLE_AFFINITY[s] || []).includes(player.affinityStyle);
          const desc = PLAYSTYLE_DESCRIPTIONS[s] || '';
          return `<span class="playstyle-tag${suited ? ' affinity-match' : ''}" title="${desc}">${s}</span>`;
        }).join('')}</div>`
      : '';
    content.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar" style="background:${primary};border:3px solid ${secondary};color:${secondary}">${playerAvatarMark(player)}</div>
        <div>
          <h2 style="margin:0 0 4px;font-size:1.2rem">${player.name}</h2>
          <div style="color:var(--text-2);font-size:0.85rem">${team ? teamMark(team, 18) : ''} ${(team && team.name) || ''} · ${(player.pos||[]).join('/')}</div>
          <div style="color:var(--gold);font-weight:700;margin-top:4px">OVR ${player.ovr || '—'} ${formArrow(player)} <span style="color:var(--text-2);font-weight:400;font-size:0.78rem">${formLabel(player)}</span>${boostBadge}</div>
          ${affinityNote}
          ${signatureNote}
          ${managerAttrNote}
          ${playstyleTagsHTML}
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
      ${renderPlayerMatchLogHTML(player.id)}
      <div style="margin-top:8px">
        ${boosted && player.expandedAttrs
          ? expandedAttrRowsHTML(player)
          : [['ATT',player.att],['DEF',player.def],['PHY',player.phy],['PAC',player.pac],['TEC',player.tec]].map(([n,v]) => `
              <div class="attr-bar-row"><span class="attr-name">${n}</span>
                <div class="attr-track"><div class="attr-fill" style="width:${v||50}%"></div></div>
                <span class="attr-val">${v||'-'}</span></div>`).join('')}
      </div>
      ${playerTrophyCabinetHTML(player.name)}      <div class="modal-actions"><button class="btn btn-secondary" onclick="document.getElementById('player-modal').classList.remove('active')">Close</button></div>`;
    modal.classList.add('active');
  }
/*@CHUNK:c0481:END*/

/*@CHUNK:c0482:START*/


/*@CHUNK:c0482:END*/

/*@CHUNK:c0483:START*/
  function showTeamProfile(teamId) {
    const team = getTeam(teamId);
    if (!team) { toast('Team not found'); return; }
    const primary = team.color || '#d4af37';
    const secondary = team.secondary || '#fff';
    const mgr = team.manager || {};
    const mgrStyle = getManagerPlaystyle(team);
    const mgrAwardCount = mgr.name ? trophies.filter(t => t.manager === mgr.name).length : 0;
    const players = [...(team.players || [])].sort((a,b) => (b.ovr||0)-(a.ovr||0));
    const avg = players.length ? (players.reduce((s,p) => s + (p.ovr||70), 0) / players.length).toFixed(1) : '—';
    const modal = document.getElementById('team-modal');
    const content = document.getElementById('team-modal-content');
    if (!modal || !content) return;
    content.innerHTML = `
      <div class="profile-header" style="border-bottom:2px solid ${primary};padding-bottom:14px">
        <div class="profile-avatar profile-avatar-logo" style="color:${secondary};font-size:1.6rem">${teamAvatarMark(team)}</div>
        <div style="flex:1;min-width:0">
          <h2 style="margin:0 0 4px;font-size:1.25rem">${team.name}</h2>
          <div style="color:var(--text-2);font-size:0.85rem">${team.short || ''} · ${players.length} players · Avg OVR ${avg}</div>
          <div style="color:var(--text-2);font-size:0.8rem;margin-top:2px">🏟️ ${getStadium(team)}</div>
        </div>
      </div>
      <div class="card-title" style="margin-top:14px">Manager</div>
      <div class="manager-profile-row">
        ${managerAvatarMark(mgr, 56)}
        <div style="flex:1;min-width:0">
          <div style="font-weight:700">${mgr.name || '—'}</div>
          <div style="color:var(--text-2);font-size:0.8rem">${mgr.ovr ? mgr.ovr + ' OVR · ' : ''}<span class="playstyle-tag">${mgrStyle}</span></div>
          <div style="color:var(--gold);font-size:0.78rem;margin-top:2px">🏅 ${mgrAwardCount} manager award${mgrAwardCount === 1 ? '' : 's'}</div>
        </div>
      </div>
      <div class="card-title" style="margin-top:14px">Squad <span style="color:var(--text-muted);font-weight:400;font-size:0.78rem">(🏆 = trophy cabinet)</span></div>
      <div class="team-squad-list">
        ${players.map(p => {
          const wonCount = trophies.filter(t => t.player === p.name).length;
          return `
          <button type="button" class="team-squad-row" onclick="App.showPlayerProfile('${p.id}')">
            <span class="tsr-avatar">${playerAvatarMark(p)}</span>
            <span class="tsr-name">${p.name}${wonCount ? ` <span class="tsr-trophy-badge" title="${wonCount} award${wonCount===1?'':'s'} won">🏆${wonCount > 1 ? '×' + wonCount : ''}</span>` : ''}</span>
            <span class="tsr-pos">${(p.pos||[]).join('/')}</span>
            ${formArrow(p)}
            <span class="player-ovr">${p.ovr || ''}</span>
          </button>`;
        }).join('')}
      </div>
      <div class="modal-actions"><button class="btn btn-secondary" onclick="document.getElementById('team-modal').classList.remove('active')">Close</button></div>`;
    modal.classList.add('active');
  }
/*@CHUNK:c0483:END*/
