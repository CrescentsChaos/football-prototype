/*@CHUNK:c0048:START*/
  // Injury-proneness multiplier for the "who gets injured" weighted pick.
/*@CHUNK:c0048:END*/

/*@CHUNK:c0049:START*/
  function injuryWeightMult(p) {
    if (!p || !p.expandedAttrs) return 1;
    // Was reading "injurey_res" (typo) against the real "injury_res" field,
    // so this never actually matched Low/Medium/High — every player got the
    // same neutral 1x regardless of their sheet. Fixed so injury resistance
    // finally does what its tooltip says.
    const res = p.expandedAttrs.injury_res;
    let mult = 1;
    if (res === 'Low') mult = 1.5;
    else if (res === 'High') mult = 0.6;
    // Physical Contact is a separate, continuous factor on top of the
    // Low/Medium/High tier above — a player who holds up poorly in physical
    // duels picks up more knocks independent of his general durability tier.
    const phyCon = xattr(p, 'phy_con', 75);
    mult *= Math.max(0.75, Math.min(1.35, 1 + (75 - phyCon) / 160));
    // Aggressive, duel-heavy styles pick up more knocks than a positionally
    // disciplined one, independent of their base injury resistance rating.
    if (hasStyle(p, 'Destroyer') || hasStyle(p, 'Box-to-Box')) mult *= 1.15;
    if (hasStyle(p, 'Anchor Man') || hasStyle(p, 'Orchestrator')) mult *= 0.9;
    // A player already running on empty this match is a genuinely bigger
    // injury risk right now — ties the live fatigue model directly into
    // who goes down, not just their sheet-level resistance rating.
    const side = playerMatchSide(p);
    if (side) {
      const stamina = getStamina(currentMatch, side, p.id);
      if (stamina < 50) mult *= 1 + (50 - stamina) / 140;
    }
    // Brittle/Iron Man: personality-level injury-risk multiplier, layered
    // on top of (not instead of) the injury_res stat above — a player can
    // be rated High injury_res on paper and still carry the Brittle tag
    // (or vice versa), same as any other stat/personality combo elsewhere.
    const personality = p.expandedAttrs.personality || [];
    if (personality.includes('Brittle')) mult *= 1.35;
    if (personality.includes('Iron Man')) mult *= 0.7;
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

/*@CHUNK:cinj01:START*/
  // Picks a random injury definition from injury.json (injuryDefsData),
  // weighted toward minor knocks and only rarely landing on something
  // severe — same overall shape as the old hardcoded table, but now backed
  // by the richer, editable injury.json catalogue (id, bodyPart, severity,
  // description, flavor "causes" text) that the Hospital tab reads from too.
  function pickInjuryDef() {
    const defs = (injuryDefsData && injuryDefsData.length) ? injuryDefsData : INJURY_DEFS_DATA;
    const byTier = {
      Minor: defs.filter(d => d.severity === 'Minor'),
      Moderate: defs.filter(d => d.severity === 'Moderate'),
      Major: defs.filter(d => d.severity === 'Major'),
      Severe: defs.filter(d => d.severity === 'Severe')
    };
    const roll = seededRandom();
    let tier;
    if (roll < 0.55) tier = 'Minor';
    else if (roll < 0.85) tier = 'Moderate';
    else if (roll < 0.97) tier = 'Major';
    else tier = 'Severe';
    // If the loaded injury.json is missing a whole tier (e.g. a trimmed
    // custom file), fall back to any tier that does have entries rather
    // than throwing — degrade gracefully instead of failing the match sim.
    let pool = byTier[tier];
    if (!pool.length) pool = defs.filter(d => d && d.minMatches != null);
    if (!pool.length) pool = defs;
    return pool[Math.floor(seededRandom() * pool.length)];
  }
/*@CHUNK:cinj01:END*/

/*@CHUNK:cinj02:START*/
  // How far apart two broad position groups (GK/DEF/MID/FWD, from
  // posGroupOf() in engine/matchEngine.js) sit on the pitch — used to pick
  // the least-bad emergency substitute when nobody on the bench plays the
  // injured player's exact slot. DEF/MID and MID/FWD are adjacent (1);
  // DEF/FWD is two steps apart (2); anything touching GK is kept as far
  // away as possible short of literally having no other option.
  function positionGroupDistance(g1, g2) {
    const order = ['GK', 'DEF', 'MID', 'FWD'];
    const i1 = order.indexOf(g1), i2 = order.indexOf(g2);
    if (i1 < 0 || i2 < 0) return 99;
    return Math.abs(i1 - i2);
  }
/*@CHUNK:cinj02:END*/

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
    const info = pickInjuryDef();
    const outMatches = info.minMatches + Math.floor(seededRandom() * (info.maxMatches - info.minMatches + 1));
    // Flavor text for "how it happened" — a random line from this injury
    // type's causes list in injury.json, falling back to a generic phrase
    // for a hand-edited injury.json that leaves causes empty.
    const causeList = (info.causes && info.causes.length) ? info.causes : ['picked up a knock and had to be withdrawn'];
    const cause = causeList[Math.floor(seededRandom() * causeList.length)];
    const oppSide = side === 'home' ? 'away' : 'home';
    const opponent = (m[oppSide] && m[oppSide].team && m[oppSide].team.name) || '';
    const competition = (typeof matchCompetitionLabel === 'function') ? matchCompetitionLabel(m) : '';
    injuryBook[injured.id] = {
      defId: info.id,
      type: info.name,
      bodyPart: info.bodyPart || '',
      severity: info.severity || 'Minor',
      cause: cause,
      opponent: opponent,
      competition: competition,
      minute: (m.dispMin != null ? m.dispMin : m.minute),
      matchesLeft: outMatches,
      matchesTotal: outMatches,
      teamName: sideData.team.name,
      playerName: injured.name
    };
    m.injuries.push(injured.id);
    addEvent(m.minute, 'injury',
      `🩹 <span class="player">${injured.name}</span> ${cause} — ${info.name}. Out for ${outMatches} match${outMatches>1?'es':''}`,
      side);
    // Permanent history entry — see injuryLog's declaration in js/state.js.
    // injuryBook above gets deleted once the player recovers (engine/
    // matchEngine.js), so this is the only lasting record of the injury for
    // the player profile's Injury Log.
    if (!injuryLog[injured.id]) injuryLog[injured.id] = [];
    injuryLog[injured.id].unshift({
      defId: info.id,
      type: info.name,
      bodyPart: info.bodyPart || '',
      severity: info.severity || 'Minor',
      cause: cause,
      opponent: opponent,
      competition: competition,
      minute: (m.dispMin != null ? m.dispMin : m.minute),
      matchesOut: outMatches,
      teamName: sideData.team.name,
      matchDay: globalMatchDay
    });
    if (injuryLog[injured.id].length > 20) injuryLog[injured.id].length = 20;
    try {
      localStorage.setItem('apexInjuryBook', JSON.stringify(injuryBook));
      localStorage.setItem('apexInjuryLog', JSON.stringify(injuryLog));
    } catch(e) {}
    if (!m.leftPitch) m.leftPitch = { home: [], away: [] };
    const leftIds = m.leftPitch[side] || (m.leftPitch[side] = []);
    const used = side === 'home' ? m.homeSubsUsed : m.awaySubsUsed;
    if (used < m.maxSubs) {
      const availableSubs = (sideData.squad.subs || []).filter(p =>
        !onPitchIds.includes(p.id) && !m.injuries.includes(p.id) && !isPlayerInjured(p.id) && !leftIds.includes(p.id));
      if (availableSubs.length) {
        let candidates = availableSubs.filter(p => canPlay(p, injured.slot || (injured.pos || ['CM'])[0]));
        if (!candidates.length) {
          // Nobody on the bench plays the exact vacated slot. This used to
          // just fall back to the entire bench regardless of position —
          // which could send on a bench goalkeeper to play centre-forward,
          // or a centre-back to cover a winger, purely because they had the
          // highest ovr left. Instead, widen outward by broad position
          // group (GK/DEF/MID/FWD) and only take whichever group is
          // actually closest to the one the injured player played in, so
          // the emergency sub is at least in a plausible area of the pitch.
          const injuredGroup = posGroupOf(injured.pos, injured.slot || (injured.pos || ['CM'])[0]);
          const outfieldSubs = availableSubs.filter(p => posGroupOf(p.pos, (p.pos || ['CM'])[0]) !== 'GK');
          // Only reach for a bench goalkeeper if literally nobody else is
          // left to bring on — still forced in that one genuine edge case.
          const widenPool = outfieldSubs.length ? outfieldSubs : availableSubs;
          let bestDist = Infinity;
          widenPool.forEach(p => {
            const d = positionGroupDistance(injuredGroup, posGroupOf(p.pos, (p.pos || ['CM'])[0]));
            if (d < bestDist) bestDist = d;
          });
          candidates = widenPool.filter(p => positionGroupDistance(injuredGroup, posGroupOf(p.pos, (p.pos || ['CM'])[0])) === bestDist);
        }
        candidates.sort((a, b) => (b.ovr || 70) - (a.ovr || 70));
        const inPlayer = candidates[Math.floor(seededRandom() * Math.min(3, candidates.length))];
        const idx = onPitchIds.indexOf(injured.id);
        if (idx >= 0) onPitchIds[idx] = inPlayer.id;
        // Same fix as the other substitution paths in engine/tactics.js:
        // only inherit the injured player's exact slot if the incoming
        // sub is actually comfortable there (the normal case, since
        // candidates above are already filtered to it when possible);
        // otherwise fall back to their own natural position rather than
        // force them somewhere they can't play — this only matters for
        // the rare case where the bench had nobody compatible at all.
        const onPitchNow = (sideData.squad.all || []).filter(p => onPitchIds.includes(p.id) && p.id !== injured.id);
        inPlayer.slot = pickSlotForIncomingSub(inPlayer, sideData.squad.formation, injured.slot || (injured.pos || ['CM'])[0], onPitchNow);
        markLeftPitch(m, side, injured.id);
        resetFatigueFor(m, side, inPlayer.id);
        if (side === 'home') m.homeSubsUsed++; else m.awaySubsUsed++;
        // Same subLog bookkeeping as a normal/tactical substitution (see
        // trySubstitution() above) — without this, renderLineups() in
        // ui/matchUI.js has nothing to read for this pair, so the injured
        // player and their replacement never get the in/out sub icons for
        // this interaction even though the swap happened on the pitch.
        if (!m.subLog) m.subLog = { home: {}, away: {} };
        if (!m.subLog[side]) m.subLog[side] = {};
        const subDispMin = m.dispMin != null ? m.dispMin : m.minute;
        m.subLog[side][injured.id] = Object.assign({}, m.subLog[side][injured.id] || {}, { outMin: subDispMin, replacedBy: inPlayer.name });
        m.subLog[side][inPlayer.id] = Object.assign({}, m.subLog[side][inPlayer.id] || {}, { inMin: subDispMin, replaced: injured.name });
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
