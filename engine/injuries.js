/*@CHUNK:c0048:START*/
  // Injury-proneness multiplier for the "who gets injured" weighted pick.
/*@CHUNK:c0048:END*/

/*@CHUNK:c0049:START*/
  function injuryWeightMult(p) {
    if (!p || !p.expandedAttrs) return 1;
    const res = p.expandedAttrs.injurey_res;
    let mult = 1;
    if (res === 'Low') mult = 1.5;
    else if (res === 'High') mult = 0.6;
    // Aggressive, duel-heavy styles pick up more knocks than a positionally
    // disciplined one, independent of their base injury resistance rating.
    if (hasStyle(p, 'Destroyer') || hasStyle(p, 'Box-to-Box')) mult *= 1.15;
    if (hasStyle(p, 'Anchor Man') || hasStyle(p, 'Orchestrator')) mult *= 0.9;
    return mult;
  }
/*@CHUNK:c0049:END*/

/*@CHUNK:c0252:START*/

/*@CHUNK:c0252:END*/

/*@CHUNK:c0253:START*/
  function isPlayerInjured(playerId) {
    const rec = injuryBook[playerId];
    return !!rec && rec.matchesLeft > 0;
  }
/*@CHUNK:c0253:END*/

/*@CHUNK:c0254:START*/

/*@CHUNK:c0254:END*/

/*@CHUNK:c0255:START*/
  function isPlayerSuspended(playerId) {
    const rec = suspensionBook[playerId];
    return !!rec && rec.matchesLeft > 0;
  }
/*@CHUNK:c0255:END*/

/*@CHUNK:c0256:START*/

/*@CHUNK:c0256:END*/

/*@CHUNK:c0257:START*/
  function tryInjury(side) {
    const m = currentMatch;
    if (!m) return;
    const sideData = m[side];
    const onPitchIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const pool = (sideData.squad.all || []).filter(p => onPitchIds.includes(p.id) && (p.pos || [])[0] !== 'GK' && !isPlayerInjured(p.id));
    if (!pool.length) return;
    // Weighted by injury resistance (Low/Medium/High from the expanded
    // attribute sheet) instead of a flat uniform pick — a fragile player is
    // genuinely more likely to be the one who goes down.
    const injWeights = pool.map(p => injuryWeightMult(p));
    const injTotal = injWeights.reduce((a, b) => a + b, 0);
    let injR = seededRandom() * injTotal;
    let injured = pool[pool.length - 1];
    for (let i = 0; i < pool.length; i++) {
      injR -= injWeights[i];
      if (injR <= 0) { injured = pool[i]; break; }
    }
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
    const roll = seededRandom();
    let info;
    if (roll < 0.55) info = injuryTypes[Math.floor(seededRandom() * 3)];
    else if (roll < 0.85) info = injuryTypes[3 + Math.floor(seededRandom() * 4)];
    else info = injuryTypes[7 + Math.floor(seededRandom() * 3)];
    const outMatches = info.min + Math.floor(seededRandom() * (info.max - info.min + 1));
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
    if (!m.leftPitch) m.leftPitch = { home: [], away: [] };
    const leftIds = m.leftPitch[side] || (m.leftPitch[side] = []);
    const used = side === 'home' ? m.homeSubsUsed : m.awaySubsUsed;
    if (used < m.maxSubs) {
      const availableSubs = (sideData.squad.subs || []).filter(p =>
        !onPitchIds.includes(p.id) && !m.injuries.includes(p.id) && !isPlayerInjured(p.id) && !leftIds.includes(p.id));
      if (availableSubs.length) {
        let candidates = availableSubs.filter(p => canPlay(p, injured.slot || (injured.pos || ['CM'])[0]));
        if (!candidates.length) candidates = availableSubs;
        candidates.sort((a, b) => (b.ovr || 70) - (a.ovr || 70));
        const inPlayer = candidates[Math.floor(seededRandom() * Math.min(3, candidates.length))];
        const idx = onPitchIds.indexOf(injured.id);
        if (idx >= 0) onPitchIds[idx] = inPlayer.id;
        markLeftPitch(m, side, injured.id);
        resetFatigueFor(m, side, inPlayer.id);
        if (side === 'home') m.homeSubsUsed++; else m.awaySubsUsed++;
        addEvent(m.minute, 'sub', `Forced sub: <span class="player">${inPlayer.name}</span> replaces injured <span class="player">${injured.name}</span>`, side);
      } else {
        removeFromPitch(side, injured.id);
      }
    } else {
      removeFromPitch(side, injured.id);
    }
  }
/*@CHUNK:c0257:END*/

/*@CHUNK:c0258:START*/

/*@CHUNK:c0258:END*/

/*@CHUNK:c0259:START*/
  function removeFromPitch(side, playerId) {
    if (!currentMatch) return;
    const arr = side === 'home' ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    const idx = arr.indexOf(playerId);
    if (idx >= 0) arr.splice(idx, 1);
    markLeftPitch(currentMatch, side, playerId);
  }
/*@CHUNK:c0259:END*/

/*@CHUNK:c0260:START*/

  // A player who has left the pitch for any reason (substituted off, sent off,
  // or injured off with no replacement) can never take the field again this
  // match — whether they were an original starter or an earlier substitute.
/*@CHUNK:c0260:END*/

/*@CHUNK:c0261:START*/
  function markLeftPitch(m, side, playerId) {
    if (!m) return;
    if (!m.leftPitch) m.leftPitch = { home: [], away: [] };
    if (!m.leftPitch[side]) m.leftPitch[side] = [];
    if (!m.leftPitch[side].includes(playerId)) m.leftPitch[side].push(playerId);
  }
/*@CHUNK:c0261:END*/
