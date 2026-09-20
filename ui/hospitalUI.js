/*@CHUNK:chos01:START*/
  // ========== HOSPITAL TAB ==========
  // Renders every player currently sidelined (injuryBook entries with
  // matchesLeft > 0), across every team, with the full detail recorded by
  // tryInjury() in engine/injuries.js: what the injury is (name/bodyPart/
  // severity, resolved against injury.json via injuryDefsData), how it
  // happened (the "cause" flavor line plus opponent/competition/minute
  // context), and how many matches are left until the player is available
  // again. Search/severity-filter/sort are kept as small local state here
  // rather than in js/state.js since they're pure UI/view state, the same
  // treatment historyActiveTab and seasonActiveTab get.
  let hospitalFilter = { search: '', severity: 'all', sort: 'matchesLeft' };
/*@CHUNK:chos01:END*/

/*@CHUNK:chos02:START*/
  // One row per currently-injured player, resolved against the live roster
  // (findPlayerAndTeam, from ui/playersUI.js) for portrait/position, but
  // reading every injury fact straight from the injuryBook record itself —
  // that record is the single source of truth for which team the injury
  // happened at, so this never double-lists a player who has both a club
  // and a national entry in allTeams.
  function getHospitalEntries() {
    const q = (hospitalFilter.search || '').trim().toLowerCase();
    let list = Object.keys(injuryBook).map(pid => {
      const rec = injuryBook[pid];
      if (!rec || !(rec.matchesLeft > 0)) return null;
      const found = (typeof findPlayerAndTeam === 'function') ? findPlayerAndTeam(pid) : null;
      const player = (found && found.player) || { id: pid, name: rec.playerName, num: null, pos: [] };
      const team = (found && found.team) || null;
      return { id: pid, player, team, rec };
    }).filter(Boolean);

    if (hospitalFilter.severity !== 'all') {
      list = list.filter(e => (e.rec.severity || 'Minor') === hospitalFilter.severity);
    }
    if (q) {
      list = list.filter(e =>
        (e.player.name || e.rec.playerName || '').toLowerCase().includes(q) ||
        (e.rec.teamName || '').toLowerCase().includes(q) ||
        (e.rec.type || '').toLowerCase().includes(q) ||
        (e.rec.bodyPart || '').toLowerCase().includes(q));
    }
    const sevOrder = { Severe: 0, Major: 1, Moderate: 2, Minor: 3 };
    list.sort((a, b) => {
      if (hospitalFilter.sort === 'name') return (a.player.name || '').localeCompare(b.player.name || '');
      if (hospitalFilter.sort === 'team') return (a.rec.teamName || '').localeCompare(b.rec.teamName || '');
      if (hospitalFilter.sort === 'severity') {
        const d = (sevOrder[a.rec.severity] ?? 9) - (sevOrder[b.rec.severity] ?? 9);
        return d !== 0 ? d : (b.rec.matchesLeft || 0) - (a.rec.matchesLeft || 0);
      }
      return (b.rec.matchesLeft || 0) - (a.rec.matchesLeft || 0);
    });
    return list;
  }
/*@CHUNK:chos02:END*/

/*@CHUNK:chos03:START*/
  function hospitalSeverityClass(sev) {
    const s = (sev || '').toLowerCase();
    if (s === 'severe') return 'sev-severe';
    if (s === 'major') return 'sev-major';
    if (s === 'moderate') return 'sev-moderate';
    return 'sev-minor';
  }
/*@CHUNK:chos03:END*/

/*@CHUNK:chos04:START*/
  // How-it-happened + context line: the random flavor cause from
  // injury.json, plus the opponent/competition/minute the injury actually
  // occurred in, when tryInjury() had that context to record.
  function hospitalCauseLine(rec) {
    const parts = [];
    if (rec.cause) parts.push(rec.cause);
    const ctx = [];
    if (rec.opponent) ctx.push('vs ' + rec.opponent);
    if (rec.competition) ctx.push(rec.competition);
    if (rec.minute != null) ctx.push(rec.minute + "'");
    if (ctx.length) parts.push('(' + ctx.join(' · ') + ')');
    return parts.join(' ') || 'No further details recorded.';
  }
/*@CHUNK:chos04:END*/

/*@CHUNK:chos05:START*/
  function renderHospitalList() {
    const listEl = document.getElementById('hospital-list');
    const summaryEl = document.getElementById('hospital-summary');
    if (!listEl) return;

    const allOut = Object.keys(injuryBook).filter(pid => injuryBook[pid] && injuryBook[pid].matchesLeft > 0);
    const counts = { Minor: 0, Moderate: 0, Major: 0, Severe: 0 };
    allOut.forEach(pid => {
      const s = injuryBook[pid].severity || 'Minor';
      if (counts[s] != null) counts[s]++;
    });
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="hospital-stat-row">
          <div class="hospital-stat"><div class="val">${allOut.length}</div><div class="lbl">Total Out</div></div>
          <div class="hospital-stat sev-minor"><div class="val">${counts.Minor}</div><div class="lbl">Minor</div></div>
          <div class="hospital-stat sev-moderate"><div class="val">${counts.Moderate}</div><div class="lbl">Moderate</div></div>
          <div class="hospital-stat sev-major"><div class="val">${counts.Major}</div><div class="lbl">Major</div></div>
          <div class="hospital-stat sev-severe"><div class="val">${counts.Severe}</div><div class="lbl">Severe</div></div>
        </div>`;
    }

    const entries = getHospitalEntries();
    if (!entries.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="icon">🏥</div><p>${allOut.length ? 'No injuries match your filters.' : 'No injuries right now — every squad is fully fit.'}</p></div>`;
      return;
    }

    listEl.innerHTML = `<div class="table-scroll"><table class="lb-table hospital-table"><thead><tr>
      <th>Player</th><th>Team</th><th>Injury</th><th>Body Part</th><th>Severity</th><th>How it happened</th><th>Return</th>
    </tr></thead><tbody>
      ${entries.map(e => {
        const p = e.player, rec = e.rec, team = e.team;
        const total = rec.matchesTotal || rec.matchesLeft || 1;
        const done = Math.max(0, Math.min(total, total - rec.matchesLeft));
        const pct = Math.round(100 * done / total);
        return `<tr onclick="App.showPlayerProfile('${p.id}')" style="cursor:pointer">
          <td><div style="display:flex;align-items:center;gap:8px">
            <div class="lb-avatar" style="width:28px;height:28px">${playerAvatarMark(p)}</div>
            <span>${p.name || rec.playerName}</span>
          </div></td>
          <td>${team ? `${teamMark(team, 18)} ${team.name}` : (rec.teamName || '—')}</td>
          <td>${rec.type || '—'}</td>
          <td>${rec.bodyPart || '—'}</td>
          <td><span class="injury-badge ${hospitalSeverityClass(rec.severity)}">${rec.severity || 'Minor'}</span></td>
          <td style="max-width:260px;color:var(--text-2);font-size:0.8rem">${hospitalCauseLine(rec)}</td>
          <td>
            <div style="font-weight:700;white-space:nowrap">${rec.matchesLeft} match${rec.matchesLeft > 1 ? 'es' : ''} left</div>
            <div class="hospital-progress"><div class="hospital-progress-fill" style="width:${pct}%"></div></div>
          </td>
        </tr>`;
      }).join('')}
    </tbody></table></div>`;
  }
/*@CHUNK:chos05:END*/

/*@CHUNK:chos06:START*/
  // Debounced — renderHospitalList() rebuilds the whole injured-players
  // table from scratch, so tying it to every keystroke was unnecessary lag.
  const _debouncedRenderHospitalList = debounce(renderHospitalList, 150);
  function searchHospital(v) { hospitalFilter.search = v || ''; _debouncedRenderHospitalList(); }
  function filterHospitalSeverity(v) { hospitalFilter.severity = v || 'all'; renderHospitalList(); }
  function sortHospital(v) { hospitalFilter.sort = v || 'matchesLeft'; renderHospitalList(); }
/*@CHUNK:chos06:END*/
