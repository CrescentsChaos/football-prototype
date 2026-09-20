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

/*@CHUNK:c0079b:START*/
  // Wraps a player's display name in a gold "enhanced" span wherever
  // player-attributes.json gave them an expanded attribute sheet (see
  // applyExpandedPlayerAttributes in data/playerDatabase.js). Every list/row
  // that renders a player name across the app should go through this
  // instead of interpolating player.name directly, so enhanced players are
  // recognizable at a glance everywhere, not just on their profile page.
  //
  // Accepts either a full player object (checked directly for .attrBoosted)
  // or a lighter-weight record like a match/season stat row that only
  // carries an id — those are resolved through the id->player index so the
  // highlight still works without each call site needing to look the
  // player up itself.
  function playerNameHTML(playerOrStatRow, displayNameOverride) {
    if (!playerOrStatRow) return displayNameOverride || '';
    const name = displayNameOverride != null ? displayNameOverride : (playerOrStatRow.name || '');
    let boosted = !!playerOrStatRow.attrBoosted;
    if (!boosted && playerOrStatRow.attrBoosted === undefined && playerOrStatRow.id != null) {
      const found = findPlayerAndTeam(playerOrStatRow.id);
      if (found) boosted = !!found.player.attrBoosted;
    }
    return boosted ? `<span class="player-name-enhanced" title="Enhanced attribute player">${name}</span>` : name;
  }
/*@CHUNK:c0079b:END*/

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
    const clickable = p && p.id != null;
    return `<div class="lb-player-cell${clickable ? ' player-clickable' : ''}"${clickable ? ` onclick="App.showPlayerProfile('${p.id}')"` : ''}>${lbAvatar(p, size)}<span class="lb-player-name">${playerNameHTML(p)}</span></div>`;
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

/*@CHUNK:cchamp01:START*/
  // Shared "champion presentation" banner — the competition's own trophy
  // (trophyMark, keyed off the competition/trophy name in trophies.json)
  // next to the winning team's own crest (teamMark) and name, in one
  // consistent hero card. Used anywhere a competition announces its
  // winner — the Tournament tab's Final Standings and a Season domestic
  // cup/World Cup summary — instead of each screen inventing its own
  // plain-text "Champion: <name>" line or a bare numbered "1" podium slot.
  function championBannerHTML(compName, champion, opts) {
    opts = opts || {};
    const trophySize = opts.trophySize || 52;
    const teamSize = opts.teamSize || 32;
    const label = opts.label || 'Champions';
    if (!champion) {
      return `<div class="champion-banner champion-banner-empty">
        <div class="champion-banner-trophy">${trophyMark(compName, trophySize)}</div>
        <div class="champion-banner-body">
          <div class="champion-banner-label">${label}</div>
          <div class="champion-banner-tbd">TBD</div>
        </div>
      </div>`;
    }
    return `<div class="champion-banner">
      <div class="champion-banner-trophy">${trophyMark(compName, trophySize)}</div>
      <div class="champion-banner-body">
        <div class="champion-banner-label">${label}</div>
        <div class="champion-banner-team">
          ${teamMark(champion, teamSize)}
          <span class="champion-banner-name">${champion.name}</span>
        </div>
      </div>
    </div>`;
  }
/*@CHUNK:cchamp01:END*/

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


  // Trophy Cabinet: every trophy a player has personally won, newest first —
  // both individual awards (Golden Boot, Ballon d'Or, ...) AND team trophies
  // (World Cup, Champions League, league titles, cups) earned by any squad
  // they were part of. Matched by player id (not name) so two different
  // players who happen to share a name never share a cabinet — trophies
  // recorded before this fix (with no id/playerIds on file) fall back to a
  // name match so nothing already won just disappears.
/*@CHUNK:c0476:END*/

/*@CHUNK:c0476b:START*/
  function playerWonTrophies(player) {
    if (!player) return [];
    return trophies.filter(t => {
      if (t.playerId != null) return t.playerId === player.id;
      if (Array.isArray(t.playerIds) && t.playerIds.length) return t.playerIds.includes(player.id);
      // Legacy entry from before ids were recorded — name is all we have.
      return t.player === player.name;
    });
  }
/*@CHUNK:c0476b:END*/

/*@CHUNK:c0476c:START*/
  // The `type` recorded alongside a trophy (e.g. "Premier League (Y1)",
  // "World Cup Tournament", "Season Y2 (Global)") identifies which
  // competition/run it actually came from. Strips only the
  // year/round number so the SAME competition repeated across years still
  // reads as one recurring honor, while two DIFFERENT competitions that
  // happen to hand out an award with the same name (Golden Boot, Golden
  // Ball and Golden Glove are each awarded separately by the league, by
  // the Champions League, by a standalone World Cup, etc.) stay distinct.
  function trophySeriesKey(t) {
    const normalized = (t.type || '')
      .replace(/\(Y\d+\)/g, '')
      .replace(/Awards Round \d+/, 'Awards Round')
      .trim();
    return t.name + '::' + normalized;
  }

  // Groups a player's won trophies so winning the same trophy in the same
  // competition/tournament more than once shows as a single card with a
  // "×N" badge instead of one card per win — but a Golden Boot/Golden
  // Ball/Golden Glove (or any other award) won in a DIFFERENT competition
  // or tournament gets its own separate card, keyed by trophySeriesKey()
  // above rather than by award name alone. Keeps the most recent
  // date/type for display/sort ordering.
  function groupPlayerTrophies(list) {
    const groups = {};
    list.forEach(t => {
      const key = trophySeriesKey(t);
      if (!groups[key] || (t.date || 0) > (groups[key].date || 0)) {
        groups[key] = { name: t.name, type: t.type, date: t.date || 0, count: (groups[key] ? groups[key].count : 0) + 1 };
      } else {
        groups[key].count++;
      }
    });
    return Object.values(groups).sort((a, b) => (b.date || 0) - (a.date || 0));
  }
/*@CHUNK:c0476c:END*/

/*@CHUNK:c0477:START*/
  function playerTrophyCabinetHTML(player) {
    const grouped = groupPlayerTrophies(playerWonTrophies(player));
    if (!grouped.length) return '';
    return `<div class="card-title" style="margin-top:14px">🏆 Trophy Cabinet</div>
      <div class="trophy-cabinet-grid">
        ${grouped.map(t => `<div class="trophy-cabinet-item" title="${t.type || ''}">${trophyMark(t.name, 56)}<div class="tc-name">${t.name}${t.count > 1 ? ` <span class="tc-count">×${t.count}</span>` : ''}</div><div class="tc-type">${t.type || ''}</div></div>`).join('')}
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

/*@CHUNK:c0478b:START*/

  // Bio strip for an enhanced player's profile — age, height, preferred
  // foot, weak foot rating, injury resilience, and their skill-card list.
  // All of it comes straight off the expanded attribute sheet
  // (player-attributes.json), so this only ever gets called for a boosted
  // player — see showPlayerProfile()'s bioHTML.
  function renderPlayerBioHTML(attr) {
    const facts = [];
    if (typeof attr.age === 'number') facts.push(['Age', attr.age]);
    if (typeof attr.height_cm === 'number') facts.push(['Height', Math.round(attr.height_cm) + ' cm']);
    if (attr.preferred_foot) facts.push(['Foot', attr.preferred_foot]);
    if (typeof attr['weak foot'] === 'number') facts.push(['Weak Foot', attr['weak foot'] + '★']);
    if (attr.injury_res) facts.push(['Injury Res.', attr.injury_res]);
    const factsHTML = facts.length
      ? `<div class="profile-stats-grid">${facts.map(([lbl, val]) => `<div class="profile-stat"><div class="val">${val}</div><div class="lbl">${lbl}</div></div>`).join('')}</div>`
      : '';
    const skillsHTML = (attr.skills || []).length
      ? `<div class="card-title" style="margin-top:10px">Skills</div>
         <div>${attr.skills.map(sk => `<span class="playstyle-tag">${sk}</span>`).join('')}</div>`
      : '';
    if (!factsHTML && !skillsHTML) return '';
    return `<div class="card-title" style="margin-top:8px">Bio</div>${factsHTML}${skillsHTML}`;
  }

/*@CHUNK:c0478b:END*/

/*@CHUNK:cstat01:START*/
  // Color tier for any 0-100(+) stat/attribute bar: red under 70, orange
  // 70-79, green 80-89, mint 90+. Used everywhere a raw attribute or the
  // compact ATT/DEF/PHY/PAC/TEC bars are rendered, so the same number
  // always reads the same color regardless of which view it's shown in.
  function statTierClass(v) {
    const n = Number(v);
    if (!isFinite(n)) return 'stat-tier-red';
    if (n >= 90) return 'stat-tier-mint';
    if (n >= 80) return 'stat-tier-green';
    if (n >= 70) return 'stat-tier-orange';
    return 'stat-tier-red';
  }
/*@CHUNK:cstat01:END*/

/*@CHUNK:c0479:START*/
  function expandedAttrRowsHTML(player) {
    const attr = player.expandedAttrs || {};
    return EXPANDED_ATTR_GROUPS.map((group) => {
      const rows = group.keys.filter(([k]) => typeof attr[k] === 'number');
      if (!rows.length) return '';
      return `<div class="expanded-attr-group">
        <div class="expanded-attr-group-title">${group.label}</div>
        ${rows.map(([k, label]) => `
          <div class="attr-bar-row expanded">
            <span class="attr-name">${label}</span>
            <div class="attr-track"><div class="attr-fill ${statTierClass(attr[k])}" style="width:${Math.min(100, attr[k])}%"></div></div>
            <span class="attr-val ${statTierClass(attr[k])}">${attr[k]}</span>
          </div>`).join('')}
      </div>`;
    }).join('');
  }
/*@CHUNK:c0479:END*/

/*@CHUNK:c0480:START*/
  // Five-axis attribute radar (ATT/PAC/TEC/DEF/PHY), rendered as a plain
  // inline SVG rather than a canvas — unlike the rating/form and
  // contribution charts, a pentagon needs no post-layout resize logic, so
  // it can just be pure markup with no matching draw*() call. Works for
  // every player regardless of attrBoosted status: those five compact
  // stats always exist (see applyExpandedPlayerAttributes in
  // data/playerDatabase.js), so this reads directly off player.att/def/
  // pac/phy/tec rather than the expanded sheet.
  const RADAR_AXES = [
    ['PAC', 'pac'], ['ATT', 'att'], ['TEC', 'tec'], ['DEF', 'def'], ['PHY', 'phy']
  ];
  function renderPlayerAttributeRadarHTML(player) {
    const cx = 100, cy = 96, r = 74, maxV = 99;
    const angleFor = (i) => (Math.PI / 180) * (i * (360 / RADAR_AXES.length) - 90);
    const pointFor = (i, val) => {
      const dist = r * (Math.max(0, Math.min(maxV, val || 0)) / maxV);
      const a = angleFor(i);
      return [cx + dist * Math.cos(a), cy + dist * Math.sin(a)];
    };
    const ringPoints = (frac) => RADAR_AXES.map((_, i) => {
      const a = angleFor(i);
      return `${cx + r * frac * Math.cos(a)},${cy + r * frac * Math.sin(a)}`;
    }).join(' ');
    const dataPoints = RADAR_AXES.map(([, key], i) => pointFor(i, player[key]).join(',')).join(' ');
    const labels = RADAR_AXES.map(([label, key], i) => {
      const a = angleFor(i);
      const lx = cx + (r + 18) * Math.cos(a);
      const ly = cy + (r + 18) * Math.sin(a);
      const v = player[key];
      return `<text x="${lx}" y="${ly - 4}" text-anchor="middle" class="radar-axis-label">${label}</text>
              <text x="${lx}" y="${ly + 9}" text-anchor="middle" class="radar-axis-val ${statTierClass(v)}">${v != null ? v : '-'}</text>`;
    }).join('');
    const rings = [0.25, 0.5, 0.75, 1].map(f => `<polygon points="${ringPoints(f)}" class="radar-ring"/>`).join('');
    const spokes = RADAR_AXES.map((_, i) => {
      const a = angleFor(i);
      return `<line x1="${cx}" y1="${cy}" x2="${cx + r * Math.cos(a)}" y2="${cy + r * Math.sin(a)}" class="radar-spoke"/>`;
    }).join('');
    return `<div class="card-title" style="margin-top:14px">Attribute Radar</div>
      <div class="player-chart-wrap radar-wrap">
        <svg viewBox="0 0 200 192" class="radar-svg">
          ${rings}${spokes}
          <polygon points="${dataPoints}" class="radar-shape"/>
          ${labels}
        </svg>
      </div>`;
  }
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
    // "Career (competitive)" below reads from careerStats (never reset by
    // End Season), not the season-scoped `stats` leaderboard bucket.
    const g = playerCareerCount('goals', playerId);
    const a = playerCareerCount('assists', playerId);
    const s = playerCareerCount('saves', playerId);
    const motm = playerCareerCount('motm', playerId);
    const y = playerCareerCount('yellows', playerId);
    const rd = playerCareerCount('reds', playerId);
    const apps = playerCareerCount('ratings', playerId);
    // Newer career totals — interceptions/blocks/big chances created/missed
    // and xG/xA all accumulate the same way goals/assists do (see
    // recordStatCount() calls in engine/matchEngine.js::endMatch), so they
    // read off careerStats via the same playerCareerCount() helper as
    // everything else above. Avg rating is the one exception: it's a mean,
    // not a running total, so it's read straight off the ratings bucket's
    // own `.avg` field instead.
    const ints = playerCareerCount('interceptions', playerId);
    const blk = playerCareerCount('blocks', playerId);
    const cc = playerCareerCount('chancesCreated', playerId);
    const bcm = playerCareerCount('bigChancesMissed', playerId);
    const xgTotal = playerCareerCount('xg', playerId);
    const xaTotal = playerCareerCount('xa', playerId);
    const avgRatingEntry = (careerStats.ratings || {})[playerId];
    const avgRating = avgRatingEntry && avgRatingEntry.count ? avgRatingEntry.avg : null;
    // Goal+assist involvement expressed as minutes per contribution (e.g.
    // "a goal or assist every 80 minutes") rather than contributions per
    // minute — needs a real minutes total (careerStats.minutes, fed by the
    // same computeMinutesPlayed() figure used everywhere else) rather than
    // just apps, since a bench-heavy career shouldn't read the same as a
    // nailed-on starter's.
    const careerMinutes = ((careerStats.minutes || {})[playerId] || {}).count || 0;
    const gaMinPerGA = (careerMinutes > 0 && (g + a) > 0) ? (careerMinutes / (g + a)) : null;
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
      ? `<span class="attr-boost-badge" title="Overall derived from expanded attribute data and position">★ Enhanced</span>`
      : '';
    const signatureNote = (boosted && player.signatureBonus > 0)
      ? `<div style="color:var(--text-2);font-size:0.75rem;margin-top:2px">+${player.signatureBonus} OVR — signature attributes for their playstyle run well above the rest of their sheet</div>`
      : '';
    // Playstyle tags render for ANY player who carries one — an enhanced
    // player's own authored tag(s), or the position-appropriate tag every
    // regular player now receives from assignPlaystylesToRegularPlayers()
    // (data/playerDatabase.js). The auto-assigned case gets its own muted
    // "· assigned" qualifier and a dashed tag style so it still reads as
    // distinct from a hand-authored signature playstyle.
    const playstyleList = (player.expandedAttrs && player.expandedAttrs.playstyle) || [];
    const playstyleTagsHTML = playstyleList.length
      ? `<div style="margin-top:6px">${playstyleList.map(s => {
          const desc = PLAYSTYLE_DESCRIPTIONS[s] || '';
          const cls = player.autoPlaystyle ? 'playstyle-tag auto-assigned' : 'playstyle-tag';
          const title = player.autoPlaystyle ? `${desc} (assigned by position)` : desc;
          return `<span class="${cls}" title="${title}">${s}${player.autoPlaystyle ? ' <em>· assigned</em>' : ''}</span>`;
        }).join('')}</div>`
      : '';
    // Personality traits only ever exist on a hand-authored expanded
    // attribute sheet (player-attributes.json) — most players have none,
    // so this whole block is naturally absent for them.
    const personalityList = (player.expandedAttrs && player.expandedAttrs.personality) || [];
    const personalityTagsHTML = personalityList.length
      ? `<div style="margin-top:6px">${personalityList.map(s => {
          const desc = PERSONALITY_DESCRIPTIONS[s] || '';
          return `<span class="playstyle-tag personality-tag" title="${desc}">${s}</span>`;
        }).join('')}</div>`
      : '';
    // Bio block: age/height/foot only exist on the expanded attribute sheet
    // (player-attributes.json), so this whole section is naturally absent
    // for a regular, non-enhanced player rather than showing empty fields.
    const bioHTML = (boosted && player.expandedAttrs) ? renderPlayerBioHTML(player.expandedAttrs) : '';
    // Currently-injured banner — full detail lives on the Hospital tab, but
    // a quick pointer here means a coach checking a specific player's
    // profile doesn't have to go hunting for it separately.
    const injRec = (typeof isPlayerInjured === 'function' && isPlayerInjured(playerId)) ? injuryBook[playerId] : null;
    const injuryHTML = injRec ? `
      <div class="hospital-inline-banner">
        🩹 <strong>${injRec.type || 'Injured'}</strong>${injRec.bodyPart ? ' (' + injRec.bodyPart + ')' : ''} — out for ${injRec.matchesLeft} more match${injRec.matchesLeft > 1 ? 'es' : ''}${injRec.cause ? `<div style="color:var(--text-2);font-size:0.78rem;margin-top:2px">${injRec.cause}${injRec.opponent ? ' vs ' + injRec.opponent : ''}</div>` : ''}
      </div>` : '';
    content.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar" style="background:${primary};border:3px solid ${secondary};color:${secondary}">${playerAvatarMark(player)}</div>
        <div>
          <h2 style="margin:0 0 4px;font-size:1.2rem">${playerNameHTML(player)}</h2>
          <div style="color:var(--text-2);font-size:0.85rem">${(function () {
            const aff = getPlayerAffiliations(player.id);
            if (aff.club && aff.national) {
              return `${teamMark(aff.club, 18)} ${aff.club.name} · ${teamMark(aff.national, 18)} ${aff.national.name}`;
            }
            return `${team ? teamMark(team, 18) : ''} ${(team && team.name) || ''}`;
          })()} · ${(player.pos||[])[0] || ''}</div>
          <div style="color:var(--gold);font-weight:700;margin-top:4px">OVR ${player.ovr || '—'} ${formArrow(player)} <span style="color:var(--text-2);font-weight:400;font-size:0.78rem">${formLabel(player)}</span>${boostBadge}</div>
          ${signatureNote}
          ${playstyleTagsHTML}
          ${personalityTagsHTML}
        </div>
      </div>
      ${injuryHTML}
      ${matchBlock}
      ${bioHTML}
      ${renderPlayerAttributeRadarHTML(player)}
      <div class="card-title">Career (competitive)</div>
      <div class="profile-stats-grid">
        <div class="profile-stat"><div class="val">${apps}</div><div class="lbl">Apps</div></div>
        <div class="profile-stat"><div class="val">${g}</div><div class="lbl">Goals</div></div>
        <div class="profile-stat"><div class="val">${a}</div><div class="lbl">Assists</div></div>
        <div class="profile-stat"><div class="val">${motm}</div><div class="lbl">MOTM</div></div>
        <div class="profile-stat"><div class="val">${s}</div><div class="lbl">Saves</div></div>
        <div class="profile-stat"><div class="val">${y}</div><div class="lbl">Yellows</div></div>
        <div class="profile-stat"><div class="val">${rd}</div><div class="lbl">Reds</div></div>
        <div class="profile-stat"><div class="val">${avgRating != null ? avgRating.toFixed(2) : '—'}</div><div class="lbl">Avg Rating</div></div>
        <div class="profile-stat"><div class="val">${cc}</div><div class="lbl">Big Chances Created</div></div>
        <div class="profile-stat"><div class="val">${bcm}</div><div class="lbl">Big Chances Missed</div></div>
        <div class="profile-stat"><div class="val">${xgTotal.toFixed(2)}</div><div class="lbl">xG</div></div>
        <div class="profile-stat"><div class="val">${xaTotal.toFixed(2)}</div><div class="lbl">xA</div></div>
        <div class="profile-stat"><div class="val">${ints}</div><div class="lbl">Interceptions</div></div>
        <div class="profile-stat"><div class="val">${blk}</div><div class="lbl">Blocks</div></div>
        <div class="profile-stat"><div class="val">${gaMinPerGA != null ? Math.round(gaMinPerGA) : '—'}</div><div class="lbl">Mins / G+A</div></div>
      </div>
      ${renderPlayerRatingFormChartHTML(player.id)}
      ${renderPlayerContributionChartHTML(player.id)}
      ${renderPlayerMatchLogHTML(player.id)}
      ${renderPlayerInjuryLogHTML(player.id)}
      <div style="margin-top:8px">
        ${boosted && player.expandedAttrs
          ? expandedAttrRowsHTML(player)
          : [['ATT',player.att],['DEF',player.def],['PHY',player.phy],['PAC',player.pac],['TEC',player.tec]].map(([n,v]) => `
              <div class="attr-bar-row"><span class="attr-name">${n}</span>
                <div class="attr-track"><div class="attr-fill ${statTierClass(v)}" style="width:${Math.min(100, v||50)}%"></div></div>
                <span class="attr-val ${statTierClass(v)}">${v||'-'}</span></div>`).join('')}
      </div>
      ${playerTrophyCabinetHTML(player)}      <div class="modal-actions"><button class="btn btn-secondary" onclick="document.getElementById('player-modal').classList.remove('active')">Close</button></div>`;
    modal.classList.add('active');
    // Canvas needs real layout dimensions (clientWidth) to size itself —
    // wait a frame after the modal's just been made visible/laid out.
    requestAnimationFrame(() => {
      drawPlayerRatingFormChart(player.id);
      drawPlayerContributionChart(player.id);
    });
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
    const formKey = pickTeamFormation(team);
    const formation = (FORMATIONS[formKey] && FORMATIONS[formKey].name) || formKey;
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
          <div style="color:var(--gold);font-size:0.8rem;margin-top:2px;font-weight:700">🧩 ${formation}</div>
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
          const wonCount = playerWonTrophies(p).length;
          return `
          <button type="button" class="team-squad-row" onclick="App.showPlayerProfile('${p.id}')">
            <span class="tsr-avatar">${playerAvatarMark(p)}</span>
            <span class="tsr-name">${playerNameHTML(p)}${wonCount ? ` <span class="tsr-trophy-badge" title="${wonCount} award${wonCount===1?'':'s'} won">🏆${wonCount > 1 ? '×' + wonCount : ''}</span>` : ''}</span>
            <span class="tsr-pos">${(p.pos||[])[0] || ''}</span>
            ${formArrow(p)}
            <span class="player-ovr">${p.ovr || ''}</span>
          </button>`;
        }).join('')}
      </div>
      ${renderTeamMatchLogHTML(team.id)}
      <div class="modal-actions"><button class="btn btn-secondary" onclick="document.getElementById('team-modal').classList.remove('active')">Close</button></div>`;
    modal.classList.add('active');
  }
/*@CHUNK:c0483:END*/
