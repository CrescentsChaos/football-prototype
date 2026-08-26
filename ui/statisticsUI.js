/*@CHUNK:c0280:START*/


  // Shape used for every per-competition stat bucket: season leagues, the season's
  // UCL, and (already existing) the global `stats` / `tournamentStats` buckets.
/*@CHUNK:c0280:END*/

/*@CHUNK:c0281:START*/
  function blankCompStats() {
    return { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, cards: {}, motm: {}, puskas: {}, ratings: {}, interceptions: {}, tackles: {}, bigGames: {} };
  }
/*@CHUNK:c0281:END*/

/*@CHUNK:c0282:START*/

/*@CHUNK:c0282:END*/

/*@CHUNK:c0283:START*/
  function bumpStatBucket(bucket, type, player, team) {
    bumpStatBucketBy(bucket, type, player, team, 1);
  }
/*@CHUNK:c0283:END*/

/*@CHUNK:c0284:START*/

  // Like bumpStatBucket, but adds an arbitrary amount in one go — used for
  // per-match accumulated totals (e.g. interceptions/tackles over 90 minutes)
  // rather than one-off events like a goal or a card.
/*@CHUNK:c0284:END*/

/*@CHUNK:c0285:START*/
  function bumpStatBucketBy(bucket, type, player, team, amount) {
    if (!amount) return;
    if (!bucket[type]) bucket[type] = {};
    if (!bucket[type][player.id]) {
      const aff = findPlayerTeams(player.id);
      bucket[type][player.id] = { id: player.id, name: player.name, team: team.name, teamId: team.id, count: 0, national: aff.national, club: aff.club };
    }
    bucket[type][player.id].count += amount;
  }
/*@CHUNK:c0285:END*/

/*@CHUNK:c0286:START*/

/*@CHUNK:c0286:END*/

/*@CHUNK:c0287:START*/

  // Generalized keyed-average bucket: powers both the plain `ratings` bucket
  // (every appearance) and the `bigGames` bucket (knockout/final/top-clash
  // appearances only) with the same count/sum/avg shape, plus a short rolling
  // history of recent ratings so award scoring can gauge consistency (low
  // variance at a genuinely good level) rather than just a career average.
  function bumpKeyedAvgBucket(bucket, key, player, team, rating) {
    if (!bucket[key]) bucket[key] = {};
    if (!bucket[key][player.id]) {
      const aff = findPlayerTeams(player.id);
      bucket[key][player.id] = { id: player.id, name: player.name, team: team.name, teamId: team.id, count: 0, sum: 0, avg: 0, national: aff.national, club: aff.club, recent: [] };
    }
    const e = bucket[key][player.id];
    e.count++;
    e.sum += rating;
    e.avg = Math.round((e.sum / e.count) * 100) / 100;
    if (!e.recent) e.recent = [];
    e.recent.push(rating);
    if (e.recent.length > 12) e.recent.shift();
  }
/*@CHUNK:c0287:END*/

/*@CHUNK:c0287b:START*/
  function bumpRatingBucket(bucket, player, team, rating) {
    bumpKeyedAvgBucket(bucket, 'ratings', player, team, rating);
  }
/*@CHUNK:c0287b:END*/

/*@CHUNK:c0287c:START*/

  // A match counts as a "big game" for award-scoring purposes when it's a
  // knockout-stage/final fixture in a tournament or the season's Champions
  // League, or a clash between two genuinely top-tier sides (judged by
  // starting-XI average OVR) — the kind of fixture that actually shapes a
  // Ballon d'Or/Golden Ball case in real life, not just bulk appearances.
  function isBigGameContext(m) {
    if (!m) return false;
    if (tournament && tournament.stage === 'knockout') return true;
    if (currentSeasonComp && ['qf', 'sf', 'final'].includes(currentSeasonComp.stage)) return true;
    const avgOvr = (side) => {
      const arr = (side && side.squad && side.squad.starting) || [];
      if (!arr.length) return 0;
      return arr.reduce((s, p) => s + (p.ovr || 70), 0) / arr.length;
    };
    return avgOvr(m.home) >= 82 && avgOvr(m.away) >= 82;
  }
/*@CHUNK:c0287c:END*/

/*@CHUNK:c0288:START*/

/*@CHUNK:c0288:END*/

/*@CHUNK:c0289:START*/
  function recordRating(player, team, rating) {
    if (!player || !team) return;
    const competitive = !!(tournament || (currentMatch && currentMatch.countForLeaderboard));
    if (competitive) bumpRatingBucket(stats, player, team, rating);
    if (tournament) bumpRatingBucket(tournamentStats, player, team, rating);
    if (currentSeasonComp) {
      if (!currentSeasonComp.stats) currentSeasonComp.stats = blankCompStats();
      bumpRatingBucket(currentSeasonComp.stats, player, team, rating);
    }
    if (currentMatch && currentMatch.isBigGame) {
      if (competitive) bumpKeyedAvgBucket(stats, 'bigGames', player, team, rating);
      if (tournament) bumpKeyedAvgBucket(tournamentStats, 'bigGames', player, team, rating);
      if (currentSeasonComp) {
        if (!currentSeasonComp.stats) currentSeasonComp.stats = blankCompStats();
        bumpKeyedAvgBucket(currentSeasonComp.stats, 'bigGames', player, team, rating);
      }
    }
  }
/*@CHUNK:c0289:END*/

/*@CHUNK:c0290:START*/

  // ========== DYNAMIC PLAYER FORM ==========
  // Every player carries a rolling `form` value (-5..+5) that moves after
  // every match they play based on that match's rating: good performances
  // push it up, bad ones push it down, and it decays back toward 0 over time
  // so form always reflects *recent* matches, not a whole career. Form is
  // then folded straight into the player's `ovr` (clamped to baseOvr ± 5),
  // which is the single number every other part of the app already reads
  // for squad strength, squad-builder sorting, and display — so a player who
  // plays badly for a stretch genuinely gets a lower rating, and a player on
  // a hot streak genuinely gets a higher one, without a second parallel
  // "true skill" number anywhere else in the codebase.
  const FORM_MIN = -5, FORM_MAX = 5;
  const FORM_DECAY = 0.82;
/*@CHUNK:c0290:END*/

/*@CHUNK:c0291:START*/
  function updatePlayerForm(player, rating) {
    if (!player) return;
    if (typeof player.baseOvr !== 'number') player.baseOvr = player.ovr || 70;
    if (typeof player.form !== 'number') player.form = 0;
    // Decay first so last match's swing fades before this one is applied.
    player.form *= FORM_DECAY;
    if (rating >= 8.2) player.form += 1.6;
    else if (rating >= 7.4) player.form += 1.0;
    else if (rating >= 6.7) player.form += 0.45;
    else if (rating >= 6.1) player.form += 0.1;
    else if (rating >= 5.5) player.form -= 0.5;
    else if (rating >= 4.8) player.form -= 1.1;
    else player.form -= 1.8;
    player.form = Math.max(FORM_MIN, Math.min(FORM_MAX, Math.round(player.form * 100) / 100));
    player.ovr = Math.max(40, Math.min(100, Math.round(player.baseOvr + player.form)));
  }
/*@CHUNK:c0291:END*/

/*@CHUNK:c0292:START*/

  // Small ▲/▼/— indicator used next to a player's OVR wherever a squad list
  // renders one, so a slump or a hot streak is visible at a glance.
/*@CHUNK:c0292:END*/

/*@CHUNK:c0293:START*/
  function formArrow(player) {
    const f = (player && typeof player.form === 'number') ? player.form : 0;
    if (f >= 2.2) return '<span class="form-arrow form-hot" title="On fire">🔥</span>';
    if (f >= 0.6) return '<span class="form-arrow form-up" title="Good form">▲</span>';
    if (f <= -2.2) return '<span class="form-arrow form-cold" title="Poor form">❄️</span>';
    if (f <= -0.6) return '<span class="form-arrow form-down" title="Below par">▼</span>';
    return '<span class="form-arrow form-flat" title="Steady form">—</span>';
  }
/*@CHUNK:c0293:END*/

/*@CHUNK:c0294:START*/
  // Longer text version used in the player profile modal.
/*@CHUNK:c0294:END*/

/*@CHUNK:c0295:START*/
  function formLabel(player) {
    const f = (player && typeof player.form === 'number') ? player.form : 0;
    if (f >= 2.2) return 'On fire 🔥';
    if (f >= 0.6) return 'Good form ▲';
    if (f <= -2.2) return 'Poor form ❄️';
    if (f <= -0.6) return 'Below par ▼';
    return 'Steady —';
  }
/*@CHUNK:c0295:END*/

/*@CHUNK:c0296:START*/

  // Persist every non-zero form value (+ the baseOvr it's measured against)
  // so a page refresh doesn't silently reset every player back to neutral.
/*@CHUNK:c0296:END*/

/*@CHUNK:c0297:START*/
  function collectPlayerFormsMap() {
    const map = {};
    allTeams.forEach(t => (t.players || []).forEach(p => {
      if (typeof p.form === 'number' && Math.abs(p.form) > 0.01) {
        map[p.id] = { form: p.form, baseOvr: p.baseOvr, ovr: p.ovr };
      }
    }));
    return map;
  }
/*@CHUNK:c0297:END*/

/*@CHUNK:c0302:START*/

/*@CHUNK:c0302:END*/

/*@CHUNK:c0303:START*/
  function recordStat(type, player, team) {
    if (!player || !team) return;
    // Friendlies do not feed global leaderboard — only competitive (tournament/season) matches
    const competitive = !!(tournament || (currentMatch && currentMatch.countForLeaderboard));
    if (competitive) bumpStatBucket(stats, type, player, team);
    if (tournament) bumpStatBucket(tournamentStats, type, player, team);
    if (currentSeasonComp) {
      if (!currentSeasonComp.stats) currentSeasonComp.stats = blankCompStats();
      bumpStatBucket(currentSeasonComp.stats, type, player, team);
    }
  }
/*@CHUNK:c0303:END*/

/*@CHUNK:c0304:START*/

  // Like recordStat, but adds an accumulated per-match total (e.g. a
  // defender's interception/tackle count for the whole match) in one go.
/*@CHUNK:c0304:END*/

/*@CHUNK:c0305:START*/
  function recordStatCount(type, player, team, amount) {
    if (!player || !team || !amount) return;
    const competitive = !!(tournament || (currentMatch && currentMatch.countForLeaderboard));
    if (competitive) bumpStatBucketBy(stats, type, player, team, amount);
    if (tournament) bumpStatBucketBy(tournamentStats, type, player, team, amount);
    if (currentSeasonComp) {
      if (!currentSeasonComp.stats) currentSeasonComp.stats = blankCompStats();
      bumpStatBucketBy(currentSeasonComp.stats, type, player, team, amount);
    }
  }
/*@CHUNK:c0305:END*/

/*@CHUNK:c0347:START*/

/*@CHUNK:c0347:END*/

/*@CHUNK:c0348:START*/
  function resetLeaderboard() {
    if (!confirm('Reset EVERYTHING? This wipes all leaderboard stats, trophies, history, the active season, any tournament in progress, injuries/suspensions, player form and saved settings — every piece of stored data for this app on this device. This cannot be undone.')) return;
    // Full factory reset: clear every bit of persisted state, not just the
    // leaderboard tables. We wipe every localStorage key this app owns
    // (all of them are namespaced with the "apex" prefix) rather than
    // trying to enumerate and reset every in-memory variable by hand,
    // then reload so the app boots from a completely clean slate — this
    // guarantees no stale in-memory state (season, tournament, injury
    // book, player forms, etc.) can survive the reset.
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('apex') === 0) keysToRemove.push(k);
      }
      keysToRemove.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
    } catch (e) {}
    try { sessionStorage.setItem('apexJustReset', '1'); } catch (e) {}
    location.reload();
  }
/*@CHUNK:c0348:END*/

/*@CHUNK:c0349:START*/

/*@CHUNK:c0349:END*/

/*@CHUNK:c0350:START*/
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
    const labels = { goals: 'Goals', assists: 'Assists', saves: 'Saves', cleanSheets: 'Clean Sheets', yellows: 'Yellow Cards', reds: 'Red Cards', cards: 'Cards', motm: 'MOTM', puskas: 'Puskas Nominees', ratings: 'Avg Rating', interceptions: 'Interceptions' };
    const appsCol = type === 'ratings' ? '' : '<th>Apps</th>';
    const top3 = data.slice(0, 3);
    const podium = top3.length ? `<div class="lb-podium">
      ${top3.map((p,i) => `<div class="lb-podium-slot slot-${i+1}">
          <div class="lb-podium-rank">${i===0?'🥇':i===1?'🥈':'🥉'}</div>
          ${lbAvatar(p, 56)}
          <div class="lb-podium-name">${playerNameHTML(p)}</div>
          <div class="lb-podium-team">${[p.national, p.club].filter(Boolean).join(' · ') || p.team || ''}</div>
          <div class="lb-podium-value">${type==='ratings' ? (p.avg!=null?p.avg.toFixed(2):'—') : p.count}</div>
        </div>`).join('')}
    </div>` : '';
    el.innerHTML = `${podium}<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th>${appsCol}<th>${labels[type]||type}</th></tr></thead><tbody>
      ${data.map((p,i) => {
        const aff = [p.national, p.club].filter(Boolean).join(' · ') || p.team;
        const apps = (stats.ratings && stats.ratings[p.id]) ? stats.ratings[p.id].count : 0;
        const appsCell = type === 'ratings' ? '' : `<td>${apps}</td>`;
        return `<tr class="${i<3?'lb-row-top rank-'+(i+1):''}"><td class="lb-rank">${rankBadge(i)}</td><td class="lb-player">${lbPlayerCell(p)}</td><td class="lb-team">${aff}</td>${appsCell}<td style="font-weight:700;color:var(--accent-gold)">${type==='ratings' ? (p.avg!=null?p.avg.toFixed(2):'—')+' ('+p.count+' apps)' : p.count}</td></tr>`;
      }).join('')}
    </tbody></table></div>`;
  }
/*@CHUNK:c0350:END*/

/*@CHUNK:c0484:START*/


/*@CHUNK:c0484:END*/

/*@CHUNK:c0485:START*/
  function showAwards(type) {
    document.querySelectorAll('.award-tab').forEach(t => t.classList.toggle('active', t.dataset.award === type));
    const el = document.getElementById('awards-content');
    if (!el) return;
    if (type === 'goldenboot') {
      const data = Object.values(stats.goals || {}).sort((a,b) => b.count - a.count).slice(0, 50);
      if (!data.length) { el.innerHTML = '<div class="empty-state"><div class="icon">⚽</div><p>No goals yet.</p></div>'; return; }
      el.innerHTML = '<div class="award-card">' + lbAvatar(data[0], 64) + '<div class="award-info"><h4>' + trophyMark('Golden Boot', 34) + ' Golden Boot</h4><p class="award-winner">' + data[0].name + ' (' + data[0].team + ') — ' + data[0].count + ' goals</p></div></div>' +
        '<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Apps</th><th>Goals</th></tr></thead><tbody>' +
        data.map((p,i) => '<tr class="'+(i<3?'lb-row-top rank-'+(i+1):'')+'"><td class="lb-rank">'+rankBadge(i)+'</td><td class="lb-player">'+lbPlayerCell(p)+'</td><td class="lb-team">'+p.team+'</td><td>'+((stats.ratings&&stats.ratings[p.id])?stats.ratings[p.id].count:0)+'</td><td style="font-weight:700;color:var(--accent-gold)">'+p.count+'</td></tr>').join('') +
        '</tbody></table></div>';
    } else if (type === 'ballon') {
      // Ballon d'Or: need meaningful sample size — min 3 competitive appearances
      const MIN_APPS = BALLON_MIN_APPS;
      const data = computeBallonRanking(stats);
      if (!data.length) {
        el.innerHTML = '<div class="empty-state"><div class="icon">🥇</div><p>Need players with at least ' + MIN_APPS + ' competitive appearances (or strong goal/assist tallies) for Ballon d\'Or.</p></div>';
        return;
      }
      const leader = data[0];
      el.innerHTML = '<div class="award-card">' + lbAvatar(leader, 64) + '<div class="award-info"><h4>' + trophyMark("Ballon d'Or", 34) + ' Ballon d\'Or</h4><p class="award-winner">' + leader.name + '</p><p style="color:var(--text-2);font-size:0.85rem">' + leader.team + ' · ' + leader.goals + 'G ' + leader.assists + 'A · ' + leader.motm + ' MOTM · ' + leader.apps + ' apps' + (leader.avg ? ' · Avg ' + leader.avg.toFixed(2) : '') + (leader.noms >= 2 ? ' · ' + leader.noms + ' award-show nods' : '') + '</p><p style="color:var(--gold);font-weight:700;margin-top:4px">' + Math.round(leader.pts) + ' Ballon points</p><p style="font-size:0.72rem;color:var(--text-3);margin-top:6px">Min ' + MIN_APPS + ' appearances required for rating weight</p></div></div>' +
        '<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Apps</th><th>G</th><th>A</th><th>Avg</th><th>Noms</th><th>Pts</th></tr></thead><tbody>' +
        data.map((p,i) => '<tr class="'+(i<3?'lb-row-top rank-'+(i+1):'')+'"><td class="lb-rank">'+rankBadge(i)+'</td><td class="lb-player">'+lbPlayerCell(p)+'</td><td class="lb-team">'+p.team+'</td><td>'+p.apps+'</td><td>'+p.goals+'</td><td>'+p.assists+'</td><td>'+(p.avg?p.avg.toFixed(2):'—')+'</td><td>'+(p.noms||0)+'</td><td style="font-weight:700;color:var(--gold)">'+Math.round(p.pts)+'</td></tr>').join('') +
        '</tbody></table></div>';
    } else if (type === 'puskas') {
      // Puskás Award — best/most spectacular individual goal, tallied by nominee count
      const data = Object.values(stats.puskas || {}).sort((a,b) => b.count - a.count).slice(0, 30);
      if (!data.length) { el.innerHTML = '<div class="empty-state"><div class="icon">🎬</div><p>No standout goals nominated yet.</p></div>'; return; }
      el.innerHTML = '<div class="award-card">' + lbAvatar(data[0], 64) + '<div class="award-info"><h4>' + trophyMark('Puskás Award', 34) + ' Puskás Award</h4><p class="award-winner">' + data[0].name + '</p><p style="color:var(--text-2);font-size:0.85rem">' + data[0].team + ' · ' + data[0].count + ' nominated goal' + (data[0].count === 1 ? '' : 's') + '</p></div></div>' +
        '<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Apps</th><th>Nominated Goals</th></tr></thead><tbody>' +
        data.map((p,i) => '<tr class="'+(i<3?'lb-row-top rank-'+(i+1):'')+'"><td class="lb-rank">'+rankBadge(i)+'</td><td class="lb-player">'+lbPlayerCell(p)+'</td><td class="lb-team">'+p.team+'</td><td>'+((stats.ratings&&stats.ratings[p.id])?stats.ratings[p.id].count:0)+'</td><td style="font-weight:700;color:var(--accent-gold)">'+p.count+'</td></tr>').join('') +
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
      el.innerHTML = '<div class="award-card">' + lbAvatar(data[0], 64) + '<div class="award-info"><h4>' + trophyMark('Gerd Müller Award', 34) + ' Gerd Müller Award</h4><p class="award-winner">' + data[0].name + '</p><p style="color:var(--text-2);font-size:0.85rem">Best striker · ' + data[0].goals + ' goals · ' + data[0].team + '</p></div></div>' +
        '<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Apps</th><th>Goals</th><th>Pts</th></tr></thead><tbody>' +
        data.map((p,i) => '<tr class="'+(i<3?'lb-row-top rank-'+(i+1):'')+'"><td class="lb-rank">'+rankBadge(i)+'</td><td class="lb-player">'+lbPlayerCell(p)+'</td><td class="lb-team">'+p.team+'</td><td>'+((stats.ratings&&stats.ratings[p.id])?stats.ratings[p.id].count:0)+'</td><td>'+p.goals+'</td><td style="font-weight:700;color:var(--gold)">'+Math.round(p.pts)+'</td></tr>').join('') +
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
      el.innerHTML = '<div class="award-card">' + lbAvatar(data[0], 64) + '<div class="award-info"><h4>' + trophyMark('Yashin Trophy', 34) + ' Yashin Trophy</h4><p class="award-winner">' + data[0].name + '</p><p style="color:var(--text-2);font-size:0.85rem">Best goalkeeper · ' + data[0].saves + ' saves · ' + data[0].clean + ' clean sheets · ' + data[0].team + '</p></div></div>' +
        '<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Apps</th><th>Saves</th><th>CS</th><th>Pts</th></tr></thead><tbody>' +
        data.map((p,i) => '<tr class="'+(i<3?'lb-row-top rank-'+(i+1):'')+'"><td class="lb-rank">'+rankBadge(i)+'</td><td class="lb-player">'+lbPlayerCell(p)+'</td><td class="lb-team">'+p.team+'</td><td>'+((stats.ratings&&stats.ratings[p.id])?stats.ratings[p.id].count:0)+'</td><td>'+p.saves+'</td><td>'+p.clean+'</td><td style="font-weight:700;color:var(--gold)">'+Math.round(p.pts)+'</td></tr>').join('') +
        '</tbody></table></div>';
    } else if (type === 'defenders') {
      // Defenders' Award — best defensive campaign: interceptions + tackles,
      // with clean sheets and a defensive-position bonus factored in.
      const scores = {};
      Object.values(stats.interceptions || {}).forEach(p => {
        scores[p.id] = { id: p.id, name: p.name, team: p.team, interceptions: p.count, tackles: 0, clean: 0, pts: p.count * 1.4 };
      });
      Object.values(stats.tackles || {}).forEach(p => {
        if (!scores[p.id]) scores[p.id] = { id: p.id, name: p.name, team: p.team, interceptions: 0, tackles: 0, clean: 0, pts: 0 };
        scores[p.id].tackles = p.count;
        scores[p.id].pts += p.count * 1.1;
      });
      Object.values(stats.cleanSheets || {}).forEach(p => {
        if (scores[p.id]) { scores[p.id].clean = p.count; scores[p.id].pts += p.count * 1.5; }
      });
      Object.values(stats.ratings || {}).forEach(p => {
        if (scores[p.id]) scores[p.id].pts += (p.avg || 0) * Math.min(p.count, 10) * 0.25;
      });
      // Bonus if the player is actually a defender on their roster (CB/RB/LB/RWB/LWB).
      Object.values(scores).forEach(s => {
        let isDef = false;
        for (const t of allTeams) {
          const pl = (t.players || []).find(x => x.id === s.id);
          if (pl && (pl.pos || []).some(pos => ['CB','RB','LB','RWB','LWB'].includes(pos))) { isDef = true; break; }
        }
        if (isDef) s.pts += 3;
      });
      const data = Object.values(scores).filter(p => p.interceptions > 0 || p.tackles > 0).sort((a,b) => b.pts - a.pts).slice(0, 50);
      if (!data.length) { el.innerHTML = '<div class="empty-state"><div class="icon">🧱</div><p>No defensive stats yet.</p></div>'; return; }
      el.innerHTML = '<div class="award-card">' + lbAvatar(data[0], 64) + '<div class="award-info"><h4>' + trophyMark("Defenders' Award", 34) + " Defenders' Award</h4><p class=\"award-winner\">" + data[0].name + '</p><p style="color:var(--text-2);font-size:0.85rem">Best defender · ' + data[0].interceptions + ' interceptions · ' + data[0].tackles + ' tackles · ' + data[0].team + '</p></div></div>' +
        '<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Apps</th><th>Int</th><th>Tkl</th><th>CS</th><th>Pts</th></tr></thead><tbody>' +
        data.map((p,i) => '<tr class="'+(i<3?'lb-row-top rank-'+(i+1):'')+'"><td class="lb-rank">'+rankBadge(i)+'</td><td class="lb-player">'+lbPlayerCell(p)+'</td><td class="lb-team">'+p.team+'</td><td>'+((stats.ratings&&stats.ratings[p.id])?stats.ratings[p.id].count:0)+'</td><td>'+p.interceptions+'</td><td>'+p.tackles+'</td><td>'+p.clean+'</td><td style="font-weight:700;color:var(--gold)">'+Math.round(p.pts)+'</td></tr>').join('') +
        '</tbody></table></div>';
    } else if (type === 'manager') {
      // Manager Award — tallies every manager award won (league titles,
      // Champions League, World Cup) into a leaderboard, crediting the
      // manager currently in charge of the team that earned each award.
      const mgrTrophies = trophies.filter(t => t.manager);
      if (!mgrTrophies.length) { el.innerHTML = '<div class="empty-state"><div class="icon">👔</div><p>No manager awards yet — win a league, Champions League or World Cup.</p></div>'; return; }
      const byMgr = {};
      mgrTrophies.forEach(t => {
        if (!byMgr[t.manager]) byMgr[t.manager] = { name: t.manager, team: t.team, count: 0, latest: 0 };
        byMgr[t.manager].count++;
        byMgr[t.manager].team = t.team; // most recent team on record
        byMgr[t.manager].latest = Math.max(byMgr[t.manager].latest, t.date || 0);
      });
      const data = Object.values(byMgr).sort((a,b) => b.count - a.count || b.latest - a.latest).slice(0, 50);
      const leader = data[0];
      const leaderTeam = allTeams.find(t => t.manager && t.manager.name === leader.name);
      el.innerHTML = '<div class="award-card">' + managerAvatarMark(leaderTeam ? leaderTeam.manager : { name: leader.name }, 64) + '<div class="award-info"><h4>👔 Manager of the Moment</h4><p class="award-winner">' + leader.name + '</p><p style="color:var(--text-2);font-size:0.85rem">' + leader.team + ' · ' + leader.count + ' award' + (leader.count===1?'':'s') + ' won</p></div></div>' +
        '<div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Manager</th><th>Team</th><th>Awards</th></tr></thead><tbody>' +
        data.map((m,i) => {
          const t = allTeams.find(tt => tt.manager && tt.manager.name === m.name);
          return '<tr class="'+(i<3?'lb-row-top rank-'+(i+1):'')+'"><td class="lb-rank">'+rankBadge(i)+'</td><td class="lb-player"><div class="lb-player-cell">' + managerAvatarMark(t ? t.manager : { name: m.name }, 34) + '<span class="lb-player-name">'+m.name+'</span></div></td><td class="lb-team">'+m.team+'</td><td style="font-weight:700;color:var(--gold)">'+m.count+'</td></tr>';
        }).join('') +
        '</tbody></table></div>';
    } else if (type === 'trophies') {
      if (!trophies.length) { el.innerHTML = '<div class="empty-state"><div class="icon">🏆</div><p>No trophies won yet. Complete a tournament!</p></div>'; return; }
      el.innerHTML = [...trophies].sort((a,b) => (b.date||0)-(a.date||0)).map(t => '<div class="award-card">' + trophyMark(t.name, 68) + '<div class="award-info"><h4>'+t.name+'</h4><p class="award-winner">'+(t.player ? t.player + (t.team ? ' ('+t.team+')' : '') : t.manager ? '👔 ' + t.manager + (t.team ? ' ('+t.team+')' : '') : t.team)+'</p><p>'+t.type+'</p></div></div>').join('');
    } else {
      // overview
      const topScorer = Object.values(stats.goals||{}).sort((a,b)=>b.count-a.count)[0];
      const topAst = Object.values(stats.assists||{}).sort((a,b)=>b.count-a.count)[0];
      const topMotm = Object.values(stats.motm||{}).sort((a,b)=>b.count-a.count)[0];
      el.innerHTML = `
        <div class="award-card">${topScorer ? lbAvatar(topScorer, 52) : trophyMark('Golden Boot', 68)}<div class="award-info"><h4>${trophyMark('Golden Boot', 30)} Golden Boot Leader</h4><p class="award-winner">${topScorer ? topScorer.name + ' — ' + topScorer.count + ' goals' : '—'}</p></div></div>
        <div class="award-card">${topAst ? lbAvatar(topAst, 52) : trophyMark('Top Assists', 68)}<div class="award-info"><h4>${trophyMark('Top Assists', 30)} Top Assists</h4><p class="award-winner">${topAst ? topAst.name + ' — ' + topAst.count : '—'}</p></div></div>
        <div class="award-card">${topMotm ? lbAvatar(topMotm, 52) : trophyMark('Most MOTM', 68)}<div class="award-info"><h4>${trophyMark('Most MOTM', 30)} Most MOTM</h4><p class="award-winner">${topMotm ? topMotm.name + ' — ' + topMotm.count : '—'}</p></div></div>
        <div class="award-card"><div class="award-icon">🏆</div><div class="award-info"><h4>Trophies</h4><p class="award-winner">${trophies.length} won</p></div></div>`;
    }
  }
/*@CHUNK:c0485:END*/

/*@CHUNK:c0486:START*/

  // ========== HISTORY (previous winners, team + individual) ==========
  // Reads straight from the permanent `trophies` case (never cleared by a
  // season reset), grouped newest-first by the run/season-year they came
  // from so each group reads like one completed competition's honours list.
/*@CHUNK:c0486:END*/

/*@CHUNK:c0487:START*/
  function trophyGroupKey(t) {
    if (t.category === 'tournament') return 'tournament-' + (t.run || t.date);
    if (t.category === 'season' || t.category === 'season-global') return 'season-' + (t.year != null ? t.year : '?');
    return 'other-' + (t.date || 0);
  }
/*@CHUNK:c0487:END*/

/*@CHUNK:c0488:START*/
  function trophyGroupLabel(t) {
    if (t.category === 'tournament') {
      const base = (t.type || '').replace(/\s*Tournament$/, '');
      return base || 'Tournament';
    }
    if (t.category === 'season' || t.category === 'season-global') return 'Season · Year ' + (t.year != null ? t.year : '?');
    return t.type || 'History';
  }
/*@CHUNK:c0488:END*/

/*@CHUNK:c0489:START*/

/*@CHUNK:c0489:END*/

/*@CHUNK:c0490:START*/
  function showHistory(type) {
    type = type || historyActiveTab || 'team';
    historyActiveTab = type;
    document.querySelectorAll('#view-history .award-tab').forEach(t => t.classList.toggle('active', t.dataset.history === type));
    const el = document.getElementById('history-content');
    if (!el) return;

    const list = type === 'individual'
      ? trophies.filter(t => t.player || t.manager)
      : trophies.filter(t => !t.player && !t.manager);

    if (!list.length) {
      el.innerHTML = type === 'individual'
        ? '<div class="empty-state"><div class="icon">⭐</div><p>No individual awards recorded yet — finish a tournament or a season.</p></div>'
        : '<div class="empty-state"><div class="icon">🏆</div><p>No champions crowned yet — finish a tournament or a season.</p></div>';
      return;
    }

    const groups = {};
    list.forEach(t => {
      const key = trophyGroupKey(t);
      if (!groups[key]) groups[key] = { label: trophyGroupLabel(t), sortKey: t.date || 0, items: [] };
      groups[key].items.push(t);
      groups[key].sortKey = Math.max(groups[key].sortKey, t.date || 0);
    });
    const orderedKeys = Object.keys(groups).sort((a, b) => groups[b].sortKey - groups[a].sortKey);

    el.innerHTML = orderedKeys.map(key => {
      const g = groups[key];
      const items = g.items.map(t => {
        if (t.player) {
          return `<div class="award-card">${trophyMark(t.name, 64)}<div class="award-info"><h4>${t.name}</h4><p class="award-winner">${t.player}</p><p style="color:var(--text-2);font-size:0.82rem">${t.team || ''}</p></div></div>`;
        }
        if (t.manager) {
          return `<div class="award-card">${trophyMark(t.name, 64)}<div class="award-info"><h4>${t.name}</h4><p class="award-winner">👔 ${t.manager}</p><p style="color:var(--text-2);font-size:0.82rem">${t.team || ''}</p></div></div>`;
        }
        return `<div class="award-card">${trophyMark(t.name, 64)}<div class="award-info"><h4>${t.name}</h4><p class="award-winner">${t.team}</p></div></div>`;
      }).join('');
      return `<div class="group-card" style="margin-bottom:16px"><h4>${g.label}</h4>${items}</div>`;
    }).join('');
  }
/*@CHUNK:c0490:END*/

/*@CHUNK:c0570:START*/

  // ---------- per-competition stats & awards (Season Calendar) ----------
/*@CHUNK:c0570:END*/

/*@CHUNK:c0571:START*/
  function compStatTop(comp, key, n) {
    return Object.values((comp.stats && comp.stats[key]) || {}).sort((a, b) => b.count - a.count).slice(0, n || 10);
  }
/*@CHUNK:c0571:END*/

/*@CHUNK:c0572:START*/

/*@CHUNK:c0572:END*/

/*@CHUNK:c0573:START*/
  function compApps(comp, playerId) {
    const r = comp.stats && comp.stats.ratings && comp.stats.ratings[playerId];
    return r ? r.count : 0;
  }
/*@CHUNK:c0573:END*/

/*@CHUNK:c0574:START*/

/*@CHUNK:c0574:END*/

/*@CHUNK:c0575:START*/
  function renderCompStatTable(comp, title, icon, rows, colLabel) {
    if (!rows.length) {
      return `<div class="group-card" style="margin-bottom:14px"><h4>${icon} ${title}</h4><div class="empty-state" style="padding:16px 0"><p>No data yet — simulate some matchdays.</p></div></div>`;
    }
    return `<div class="group-card" style="margin-bottom:14px"><h4>${icon} ${title}</h4>
      <div class="table-scroll"><table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Apps</th><th>${colLabel}</th></tr></thead><tbody>
      ${rows.map((p, i) => `<tr class="${i<3?'lb-row-top rank-'+(i+1):''}"><td class="lb-rank">${rankBadge(i)}</td><td class="lb-player">${lbPlayerCell(p)}</td><td class="lb-team">${p.team}</td><td>${compApps(comp, p.id)}</td><td style="font-weight:700;color:var(--accent-gold)">${p.count}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  }
/*@CHUNK:c0575:END*/

/*@CHUNK:c0576:START*/

/*@CHUNK:c0576:END*/

/*@CHUNK:c0577:START*/
  function renderCompStatsHTML(comp) {
    let h = '<div class="group-card league-table-wrap" style="margin-bottom:14px"><h4>' + comp.name + ' — Season Stats</h4>' +
      '<p style="font-size:0.8rem;color:var(--text-muted)">Top performers across every matchday played in this competition so far.</p></div>';
    h += renderCompStatTable(comp, 'Top Scorers', '⚽', compStatTop(comp, 'goals', 15), 'Goals');
    h += renderCompStatTable(comp, 'Top Assists', '🎯', compStatTop(comp, 'assists', 15), 'Assists');
    h += renderCompStatTable(comp, 'Most Saves', '🧤', compStatTop(comp, 'saves', 15), 'Saves');
    h += renderCompStatTable(comp, 'Clean Sheets', '🛡️', compStatTop(comp, 'cleanSheets', 15), 'Clean Sheets');
    h += renderCompStatTable(comp, 'Yellow Cards', '🟨', compStatTop(comp, 'yellows', 15), 'Yellows');
    h += renderCompStatTable(comp, 'Red Cards', '🟥', compStatTop(comp, 'reds', 15), 'Reds');
    return h;
  }
/*@CHUNK:c0577:END*/

/*@CHUNK:c0578:START*/

/*@CHUNK:c0578:END*/

/*@CHUNK:c0579:START*/
  function assignCompAwards(comp) {
    const goals = compStatTop(comp, 'goals', 50);
    const assists = compStatTop(comp, 'assists', 50);
    const saves = compStatTop(comp, 'saves', 50);
    const cleanSheets = compStatTop(comp, 'cleanSheets', 50);
    const motm = compStatTop(comp, 'motm', 50);
    const ratingsAny = Object.values((comp.stats && comp.stats.ratings) || {})
      .filter(x => (x.count || 0) > 0)
      .sort((a, b) => b.avg - a.avg || b.count - a.count);
    comp.awards = {
      goldenBoot: goals[0] || null,
      goldenGlove: saves[0] || null,
      goldenClean: cleanSheets[0] || null,
      topAssists: assists[0] || null,
      mostMotm: motm[0] || null,
      bestAvgRating: ratingsAny[0] || null,
      champion: comp.champion || null
    };
    return comp.awards;
  }
/*@CHUNK:c0579:END*/

/*@CHUNK:c0580:START*/

/*@CHUNK:c0580:END*/

/*@CHUNK:c0581:START*/
  function renderCompAwardsHTML(comp) {
    const a = assignCompAwards(comp);
    const card = (title, icon, p, extra) => {
      const titleHtml = `<div class="am-title">${trophyMark(title, 32)} ${title}</div>`;
      if (!p) return `<div class="award-mini">${titleHtml}<div class="am-empty">TBD</div></div>`;
      return `<div class="award-mini">${titleHtml}
        ${lbAvatar(p, 44)}
        <div class="am-name">${playerNameHTML(p)}</div>
        <div class="am-meta">${p.team || ''} · ${extra}</div></div>`;
    };
    let h = '<div class="card-title">' + comp.name + ' Awards' + (comp.finished ? ' (Final)' : ' (In Progress)') + '</div>';
    h += `<div class="awards-row">
      ${card('Golden Boot', '👟', a.goldenBoot, (a.goldenBoot && a.goldenBoot.count) + ' goals')}
      ${card('Top Assists', '🎯', a.topAssists, (a.topAssists && a.topAssists.count) + ' assists')}
      ${card('Golden Glove', '🧤', a.goldenGlove, (a.goldenGlove && a.goldenGlove.count) + ' saves')}
      ${card('Clean Sheet King', '🛡️', a.goldenClean, (a.goldenClean && a.goldenClean.count) + ' clean sheets')}
      ${card('Most MOTM', '⭐', a.mostMotm, (a.mostMotm && a.mostMotm.count) + ' MOTM')}
      ${card('Best Avg Rating', '📈', a.bestAvgRating, a.bestAvgRating ? (a.bestAvgRating.avg != null ? a.bestAvgRating.avg.toFixed(2) : '—') + ' (' + a.bestAvgRating.count + ' apps)' : '')}
    </div>`;
    if (a.champion) {
      h += `<div class="award-card" style="margin-top:14px">${trophyMark(comp.name, 68)}<div class="award-info"><h4>${comp.name} Champion</h4><p class="award-winner">${teamMark(a.champion, 18) + ' ' + a.champion.name}</p></div></div>`;
    } else {
      h += '<p style="color:var(--text-muted);font-size:0.85rem;margin-top:10px">Champion will be crowned once the competition finishes.</p>';
    }
    return h;
  }
/*@CHUNK:c0581:END*/
