/*@CHUNK:c0001:START*/
  function formationShape(formationKey) {
    const key = formationKey || '4-3-3';
    if (formationShapeCache[key]) return formationShapeCache[key];
    const formation = FORMATIONS[key] || FORMATIONS['4-3-3'];
    let def = 0, fwd = 0, mid = 0;
    formation.slots.forEach(s => {
      if (s === 'GK') return;
      def += SHAPE_DEF_WEIGHT[s] || 0;
      fwd += SHAPE_FWD_WEIGHT[s] || 0;
      mid += SHAPE_MID_WEIGHT[s] || 0;
    });
    const shape = { def, fwd, mid };
    formationShapeCache[key] = shape;
    return shape;
  }
/*@CHUNK:c0001:END*/

/*@CHUNK:c0002:START*/
  // How many natural wide bodies (wing-backs / wide mids / wingers) a
  // formation puts on the pitch — used alongside formationShape() to match
  // a formation to a manager's style preference (Out Wide/Overload want
  // width; narrower diamonds/back-threes-without-wing-backs don't offer it).
/*@CHUNK:c0002:END*/

/*@CHUNK:c0003:START*/
  function formationWideCount(formationKey) {
    const formation = FORMATIONS[formationKey] || FORMATIONS['4-3-3'];
    return formation.slots.filter(s => WIDE_SLOTS.has(s)).length;
  }
/*@CHUNK:c0003:END*/

/*@CHUNK:c0004:START*/

/*@CHUNK:c0004:END*/

/*@CHUNK:c0005:START*/
  function lineOf(p) {
    if (!p) return 'MID';
    const slot = p.slot || (p.pos || [])[0] || 'CM';
    return POS_LINE[slot] || 'MID';
  }
/*@CHUNK:c0005:END*/

/*@CHUNK:c0095:START*/

  // Picks a formation for a team. If the team has a "formation" key set in
  // teams.json (matching a valid FORMATIONS entry) that formation is used
  // strictly as the team's default starting shape — though it can still be
  // changed mid-match via the live tactics panel. Otherwise a formation is
  // deterministically derived from the team's id/name so the same team
  // tends to line up the same way match to match, while different teams
  // spread out across the available formation pool instead of everyone
  // randomly converging on the same one or two shapes.
/*@CHUNK:c0095:END*/

/*@CHUNK:c0096:START*/
  function pickTeamFormation(team) {
    if (team && team.formation && FORMATIONS[team.formation]) return team.formation;
    if (team && team._aiFormation && FORMATIONS[team._aiFormation]) return team._aiFormation;
    // Formation choice now follows from the manager's identity instead of a
    // flat hash of the team name — a Long Ball/defensive-minded manager's
    // team gravitates toward compact, defense-heavy shapes; a Possession
    // manager toward a numbers-up midfield; Overload/Out Wide toward shapes
    // with genuine width. Still deterministic per team for the session (so
    // it doesn't re-roll every match) via a stable hash, but the hash now
    // only picks among the handful of formations that actually fit the
    // manager's style, not all twenty regardless of identity.
    const style = getManagerPlaystyle(team);
    const pref = PLAYSTYLE_FORM_PREF[style] || { fwd: 0.6, def: 0.6, wide: 0.6, mid: 0.6 };
    const keys = Object.keys(FORMATIONS);
    const idKey = (team && (team.id || team.name)) || '';
    let hash = 0;
    for (let i = 0; i < idKey.length; i++) hash = (hash * 31 + idKey.charCodeAt(i)) >>> 0;
    const scored = keys.map(k => {
      const shape = formationShape(k);
      const wide = formationWideCount(k);
      const score = shape.fwd * pref.fwd + shape.def * pref.def + shape.mid * (pref.mid || 0.6) + wide * (pref.wide || 0.6);
      return { k, score };
    }).sort((a, b) => b.score - a.score);
    const poolSize = Math.min(5, scored.length);
    const pick = scored[hash % poolSize].k;
    if (team) team._aiFormation = pick;
    return pick;
  }
/*@CHUNK:c0096:END*/

/*@CHUNK:c0228:START*/

  // ---- Opening-instructions AI: what a manager sets up with at kickoff,
  // driven by the actual quality gap between the two sides plus identity —
  // not a flat "balanced" default that made every kickoff feel the same.
/*@CHUNK:c0228:END*/

/*@CHUNK:c0229:START*/
  function decideOpeningTactic(selfStr, oppStr, style) {
    const gap = (selfStr.ovr || 75) - (oppStr.ovr || 75);
    const counterMinded = ['Quick Counter', 'Long Ball Counter', 'Long Ball'].includes(style);
    const possessionMinded = style === 'Possession';
    if (gap <= -4) return seededRandom() < 0.6 ? 'defend' : 'balanced';
    if (gap >= 5) return seededRandom() < (possessionMinded ? 0.65 : 0.5) ? (possessionMinded ? 'press' : 'attack') : 'balanced';
    if (counterMinded && gap < 2) return seededRandom() < 0.35 ? 'defend' : 'balanced';
    if (possessionMinded) return seededRandom() < 0.4 ? 'press' : 'balanced';
    return 'balanced';
  }
/*@CHUNK:c0229:END*/

/*@CHUNK:c0236:START*/


/*@CHUNK:c0236:END*/

/*@CHUNK:c0237:START*/
  function trySubstitution(side) {
    const m = currentMatch;
    if (!m) return;
    const sideData = m[side];
    const otherSide = side === 'home' ? 'away' : 'home';
    const oppData = m[otherSide];
    const used = side === 'home' ? m.homeSubsUsed : m.awaySubsUsed;
    if (used >= (m.maxSubs || 5)) return;
    if (!m.leftPitch) m.leftPitch = { home: [], away: [] };
    const leftIds = m.leftPitch[side] || (m.leftPitch[side] = []);
    if (!m.subLog) m.subLog = { home: {}, away: {} };
    if (!m.cards) m.cards = { home: {}, away: {} };
    const onPitchIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    // Game-state context: is this side chasing the game or protecting a
    // lead late on? Drives which line gets sacrificed and what comes on,
    // so a losing side's subs read as "throwing men forward" and a
    // winning side's subs read as genuine game management — not the same
    // like-for-like swap regardless of the scoreline.
    const diff = (sideData.score || 0) - ((m[otherSide] || {}).score || 0);
    const chasing = diff <= -1 && m.minute >= 60;
    const protectingLead = diff >= 1 && m.minute >= 72;
    // Anyone currently on pitch (starter or previous sub)
    const allPlayers = [...(sideData.squad.starting || []), ...(sideData.squad.subs || [])];
    const onPitch = allPlayers.filter(p => onPitchIds.includes(p.id) && !m.injuries.includes(p.id));
    // Prefer lower rated / tired-looking out. Exclude GKs, and — normally —
    // exclude players who already came on as a substitute themselves, since a
    // manager doesn't typically sub off a sub they just brought on. Fall back
    // to including them only if there's genuinely no other outfield option.
    const alreadySubbedIn = (p) => !!(m.subLog[side] && m.subLog[side][p.id] && m.subLog[side][p.id].inMin != null);
    let outfieldPool = onPitch.filter(p => (p.slot || (p.pos||[])[0]) !== 'GK');
    let freshPool = outfieldPool.filter(p => !alreadySubbedIn(p));
    let pool = freshPool.length ? freshPool : outfieldPool;
    // Chasing the game: the sacrifice comes from the back/deep midfield to
    // free up a spot for fresh legs further forward. Protecting a lead: the
    // sacrifice comes from the front line to bring on defensive cover.
    if (chasing) {
      const backPool = pool.filter(p => lineOf(p) === 'DEF' || lineOf(p) === 'MID');
      if (backPool.length) pool = backPool;
    } else if (protectingLead) {
      const frontPool = pool.filter(p => lineOf(p) === 'FWD' || lineOf(p) === 'MID');
      if (frontPool.length) pool = frontPool;
    }

    // ---- Composite "who comes off" score -----------------------------
    // Real managerial reasoning folded into one weighted pick instead of a
    // single "lowest OVR for their line" heuristic: raw fatigue, the real
    // risk of a second yellow costing the side a man, how the player has
    // actually performed so far this match, a genuine tactical mismatch
    // against this specific opponent, plus the scoreline/line-weight bias
    // the engine already had.
    const oppStr = calcTeamStrength(oppData);
    const LINE_SUB_WEIGHT = chasing ? { FWD: 0.5, MID: 1.1, DEF: 1.4, GK: 0 }
      : protectingLead ? { FWD: 1.5, MID: 1.1, DEF: 0.3, GK: 0 }
      : { FWD: 1.3, MID: 1.15, DEF: 0.65, GK: 0 };
    const scored = pool.map(p => {
      const line = lineOf(p);
      let score = Math.max(0.15, (96 - (p.ovr || 70)) * (LINE_SUB_WEIGHT[line] || 1));
      // Fatigue: a genuinely gassed player (see engine/fatigue.js) is a
      // strong candidate to come off, and increasingly so as the second
      // half wears on.
      const stamina = getStamina(m, side, p.id);
      if (m.minute >= 58) score += Math.max(0, 72 - stamina) * 0.55;
      // Second-yellow risk: booked earlier and still out there for a
      // fast/aggressive closing stretch is exactly the profile that ends
      // up costing the team a man — pull them before that happens rather
      // than reacting to it after.
      const hasYellow = (m.cards[side] && m.cards[side][p.id]) >= 1;
      if (hasYellow && m.minute >= 55) score += 24 + Math.min(20, (m.minute - 55) * 0.6);
      // Poor match rating so far — a genuinely bad game, not just tired or
      // booked. Only weighed once there's enough of a sample to mean
      // anything.
      const ps = m.playerMatchStats && m.playerMatchStats[p.id];
      if (ps && ((ps.passes || 0) + (ps.tackles || 0) + (ps.shots || 0)) >= 5) {
        const liveRating = calcPlayerRating(Object.assign({}, ps, { pos: p.slot || (p.pos || [])[0] }));
        if (liveRating < 6.2) score += (6.2 - liveRating) * 14;
      }
      // Tactical mismatch: a defender being physically overrun by a
      // quicker opposing attack, or a midfielder outclassed technically by
      // the opposing midfield, reads as a player who needs help now.
      if (line === 'DEF' && (oppStr.pac || 70) - (p.pac || 70) >= 10) score += 10;
      if (line === 'MID' && (oppStr.tec || 70) - (p.tec || 70) >= 10) score += 8;
      return { p, w: score, stamina, hasYellow };
    });
    const totalW = scored.reduce((s, x) => s + x.w, 0);
    let outPick = null;
    if (totalW > 0) {
      let r = seededRandom() * totalW;
      for (const x of scored) { r -= x.w; if (r <= 0) { outPick = x; break; } }
    }
    if (!outPick) outPick = scored[Math.floor(seededRandom() * scored.length)];
    if (!outPick) return;
    const outPlayer = outPick.p;

    // A substitute can only come from the bench, must not already be on the
    // pitch, and — critically — must never have left the pitch already this
    // match (whether as a starter subbed off, a substitute subbed off again,
    // or a player sent off/injured out).
    const availableSubs = (sideData.squad.subs || []).filter(p =>
      !onPitchIds.includes(p.id) && !m.injuries.includes(p.id) && !leftIds.includes(p.id));
    if (!availableSubs.length) return;

    // Tiered matching so the incoming player is a genuine like-for-like
    // replacement: exact slot first, then anyone who shares the outgoing
    // player's position line (defender for defender, forward for forward),
    // and only loosen to broad position-compatibility or "whoever's left" if
    // the bench truly has nothing closer. Chasing/protecting a lead can
    // override this with a deliberate change of line (attacker on for a
    // defender, or vice versa) when the bench actually offers one.
    const outSlot = outPlayer.slot || (outPlayer.pos || [])[0] || 'CM';
    const outLine = lineOf(outPlayer);
    let candidatesIn = availableSubs.filter(p => (p.slot || (p.pos || [])[0]) === outSlot);
    let matchedOwnPosition = true;
    let tacticalChange = false;
    if (chasing) {
      const attackers = availableSubs.filter(p => lineOf(p) === 'FWD');
      if (attackers.length && outLine !== 'FWD') { candidatesIn = attackers; matchedOwnPosition = false; tacticalChange = true; }
    } else if (protectingLead) {
      const defenders = availableSubs.filter(p => lineOf(p) === 'DEF' || (lineOf(p) === 'MID' && (p.slot === 'CDM' || (p.pos||[]).includes('CDM'))));
      if (defenders.length && outLine !== 'DEF') { candidatesIn = defenders; matchedOwnPosition = false; tacticalChange = true; }
    }
    if (!candidatesIn.length) { candidatesIn = availableSubs.filter(p => lineOf(p) === outLine); tacticalChange = false; }
    if (!candidatesIn.length) { candidatesIn = availableSubs.filter(p => canPlay(p, outSlot)); matchedOwnPosition = false; tacticalChange = false; }
    if (!candidatesIn.length) { candidatesIn = availableSubs; matchedOwnPosition = false; tacticalChange = false; }

    // Positional need on top of raw quality: if this line is specifically
    // being outrun by the opponent (the same mismatch signal that pushed
    // this player toward being subbed off in the first place), prefer the
    // bench option with real recovery pace to counter it rather than just
    // the highest OVR among the tiered candidates.
    const needsPace = outLine === 'DEF' && (oppStr.pac || 70) - (outPlayer.pac || 70) >= 10;
    candidatesIn = candidatesIn.slice().sort((a, b) => {
      if (needsPace) {
        const d = (b.pac || 70) - (a.pac || 70);
        if (Math.abs(d) >= 4) return d;
      }
      return (b.ovr || 70) - (a.ovr || 70);
    });
    const top = candidatesIn.slice(0, Math.min(3, candidatesIn.length));
    const inPlayer = top[Math.floor(seededRandom() * top.length)];
    const idx = onPitchIds.indexOf(outPlayer.id);
    if (idx >= 0) onPitchIds[idx] = inPlayer.id;
    markLeftPitch(m, side, outPlayer.id);
    resetFatigueFor(m, side, inPlayer.id);
    if (side === 'home') m.homeSubsUsed++; else m.awaySubsUsed++;
    m.subLog[side][outPlayer.id] = Object.assign({}, m.subLog[side][outPlayer.id] || {}, { outMin: m.minute, replacedBy: inPlayer.name });
    m.subLog[side][inPlayer.id] = Object.assign({}, m.subLog[side][inPlayer.id] || {}, { inMin: m.minute, replaced: outPlayer.name });
    // A substitute plays their own main position, not a borrowed one — only
    // fall back to the outgoing player's slot when the bench had nobody
    // positionally close, purely so the pitch shape still makes sense.
    if (!matchedOwnPosition) inPlayer.slot = tacticalChange ? (inPlayer.pos || [outSlot])[0] : outSlot;
    else if (!inPlayer.slot) inPlayer.slot = (inPlayer.pos || ['CM'])[0];
    const tag = tacticalChange ? (chasing ? ' <span style="opacity:0.6">(attacking change)</span>' : ' <span style="opacity:0.6">(defensive change)</span>') : '';
    // Surface the real reason behind a notable change (booked/tiring) in
    // the event log, same spirit as the tactical tag above.
    const reasonBits = [];
    if (outPick.hasYellow && m.minute >= 55) reasonBits.push('booked, managing risk');
    if (outPick.stamina < 40) reasonBits.push('tiring');
    const reasonTag = reasonBits.length ? ` <span style="opacity:0.55">(${reasonBits.join(', ')})</span>` : '';
    addEvent(m.minute, 'sub',
      `Substitution · ${sideData.team.short}${tag}${reasonTag}<br><span style="color:#4ade80">▲ In</span> <span class="player">${inPlayer.name}</span><br><span style="color:#f87171">▼ Out</span> <span class="player">${outPlayer.name}</span> <span style="opacity:0.6">(${used+1}/${m.maxSubs})</span>`,
      side);
    if (!m.quietSim) { renderLineups(); renderPitch(); }
  }
/*@CHUNK:c0237:END*/

/*@CHUNK:c0238:START*/

  // A manager who's just gone down to 10 men often reshapes rather than just
  // absorbing the loss — most commonly sacrificing an attacker to bring on a
  // recognised defender when the sent-off player was part of the back line,
  // to restore defensive numbers. This is a reaction, not a guarantee: it
  // only fires for a lost defender, needs a defender left on the bench, and
  // doesn't happen every single time (some managers/situations just play on).
/*@CHUNK:c0238:END*/

/*@CHUNK:c0239:START*/
  function handleRedCardReshuffle(side, sentOffPlayer) {
    const m = currentMatch;
    if (!m || !sentOffPlayer || m.finished) return;
    if (lineOf(sentOffPlayer) !== 'DEF') return;
    const used = side === 'home' ? m.homeSubsUsed : m.awaySubsUsed;
    if (used >= (m.maxSubs || 5)) return;
    if (seededRandom() > 0.72) return;
    const sideData = m[side];
    const onPitchIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    if (!m.leftPitch) m.leftPitch = { home: [], away: [] };
    const leftIds = m.leftPitch[side] || (m.leftPitch[side] = []);
    const availableSubs = (sideData.squad.subs || []).filter(p =>
      !onPitchIds.includes(p.id) && !m.injuries.includes(p.id) && !leftIds.includes(p.id));
    const benchDef = availableSubs.filter(p => lineOf(p) === 'DEF').sort((a, b) => (b.ovr || 70) - (a.ovr || 70));
    if (!benchDef.length) return; // no defensive cover available on the bench
    const inPlayer = benchDef[0];

    // Sacrifice the most advanced remaining outfield player to restore
    // defensive numbers — a forward first, then a midfielder, mirroring how
    // real managers reshape after going down to 10 men.
    const allPlayers = [...(sideData.squad.starting || []), ...(sideData.squad.subs || [])];
    const onPitch = allPlayers.filter(p => onPitchIds.includes(p.id) && !m.injuries.includes(p.id));
    if (!m.subLog) m.subLog = { home: {}, away: {} };
    const alreadySubbedIn = (p) => !!(m.subLog[side] && m.subLog[side][p.id] && m.subLog[side][p.id].inMin != null);
    let candidatesOut = onPitch.filter(p => lineOf(p) === 'FWD' && !alreadySubbedIn(p));
    if (!candidatesOut.length) candidatesOut = onPitch.filter(p => lineOf(p) === 'FWD');
    if (!candidatesOut.length) candidatesOut = onPitch.filter(p => lineOf(p) === 'MID' && !alreadySubbedIn(p));
    if (!candidatesOut.length) candidatesOut = onPitch.filter(p => lineOf(p) === 'MID');
    if (!candidatesOut.length) return; // nothing sensible to sacrifice — leave it
    candidatesOut.sort((a, b) => (a.ovr || 70) - (b.ovr || 70));
    const outPlayer = candidatesOut[0];

    const idx = onPitchIds.indexOf(outPlayer.id);
    if (idx >= 0) onPitchIds[idx] = inPlayer.id;
    markLeftPitch(m, side, outPlayer.id);
    resetFatigueFor(m, side, inPlayer.id);
    if (side === 'home') m.homeSubsUsed++; else m.awaySubsUsed++;
    m.subLog[side][outPlayer.id] = Object.assign({}, m.subLog[side][outPlayer.id] || {}, { outMin: m.minute, replacedBy: inPlayer.name });
    m.subLog[side][inPlayer.id] = Object.assign({}, m.subLog[side][inPlayer.id] || {}, { inMin: m.minute, replaced: outPlayer.name });
    if (!inPlayer.slot) inPlayer.slot = (inPlayer.pos || ['CB'])[0];
    const newUsed = side === 'home' ? m.homeSubsUsed : m.awaySubsUsed;
    addEvent(m.minute, 'sub',
      `Tactical reshuffle · ${sideData.team.short} reorganise after going down to 10 men<br><span style="color:#4ade80">▲ In</span> <span class="player">${inPlayer.name}</span> <span style="opacity:0.6">(defensive cover)</span><br><span style="color:#f87171">▼ Out</span> <span class="player">${outPlayer.name}</span> <span style="opacity:0.6">(${newUsed}/${m.maxSubs})</span>`,
      side);
    if (!m.quietSim) { renderLineups(); renderPitch(); }
  }
/*@CHUNK:c0239:END*/

/*@CHUNK:c0240:START*/

/*@CHUNK:c0240:END*/

/*@CHUNK:c0241:START*/
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
    if (!m.quietSim) { renderLineups(); updateScoreboard(); }
    toast(sideData.team.short + ' → ' + formKey);
  }
/*@CHUNK:c0241:END*/

/*@CHUNK:c0242:START*/

/*@CHUNK:c0242:END*/

/*@CHUNK:c0243:START*/
  function setTacticsLive(side, tactic) {
    const m = currentMatch;
    if (!m || m.finished) return;
    if (!m.tactics) m.tactics = { home: 'balanced', away: 'balanced' };
    m.tactics[side] = tactic;
    const labels = { attack: 'all-out attack', balanced: 'balanced approach', defend: 'defensive block', press: 'high press' };
    addEvent(m.minute, 'whistle', `📋 ${m[side].team.short} go ${labels[tactic] || tactic}`, side);
    toast(m[side].team.short + ': ' + (labels[tactic] || tactic));
  }
/*@CHUNK:c0243:END*/

/*@CHUNK:c0244:START*/

  // Picks a formation clearly more attacking in shape than the current one
  // (most forward-weighted bodies among the alternatives), for the AI's
  // late-game "throw men forward" reshape.
/*@CHUNK:c0244:END*/

/*@CHUNK:c0245:START*/
  function pickMoreAttackingFormation(curKey) {
    const keys = Object.keys(FORMATIONS).filter(k => k !== curKey);
    keys.sort((a, b) => formationShape(b).fwd - formationShape(a).fwd);
    return keys[0];
  }
/*@CHUNK:c0245:END*/

/*@CHUNK:c0246:START*/
  // Picks a formation clearly more defensive in shape than the current one,
  // for the AI's late-game "shut up shop" reshape.
/*@CHUNK:c0246:END*/

/*@CHUNK:c0247:START*/
  function pickMoreDefensiveFormation(curKey) {
    const keys = Object.keys(FORMATIONS).filter(k => k !== curKey);
    keys.sort((a, b) => formationShape(b).def - formationShape(a).def);
    return keys[0];
  }
/*@CHUNK:c0247:END*/

/*@CHUNK:c0248:START*/

  // ===================================================================
  // ===================== IN-MATCH TACTICAL AI =======================
  // ===================================================================
  // Runs every simulated minute and reacts to the actual game state —
  // scoreline, time remaining, and the manager's identity — so a team
  // chasing a goal genuinely presses higher / throws men forward / goes
  // to a more attacking shape, and a team protecting a lead genuinely
  // drops off / tightens up / brings on a defensive body late on. Each
  // side gets at most one instruction change per cooldown window and at
  // most one AI-driven formation reshape per match, so it reads as a
  // deliberate, occasional managerial decision rather than constant noise.
/*@CHUNK:c0248:END*/

/*@CHUNK:c0249:START*/
  function runTacticalAI() {
    const m = currentMatch;
    if (!m || m.finished || m.inET || m.inPens || m._awaitingET) return;
    evaluateTacticalAI('home', 'away');
    evaluateTacticalAI('away', 'home');
  }
/*@CHUNK:c0249:END*/

/*@CHUNK:c0250:START*/

/*@CHUNK:c0250:END*/

/*@CHUNK:c0251:START*/
  function evaluateTacticalAI(side, otherSide) {
    const m = currentMatch;
    if (!m) return;
    const sideData = m[side], oppData = m[otherSide];
    if (!sideData || !oppData) return;
    if (!m.tacticalAI) m.tacticalAI = { home: { lastChange: -999 }, away: { lastChange: -999 } };
    const ai = m.tacticalAI[side];
    const minute = m.minute;
    const diff = (sideData.score || 0) - (oppData.score || 0);
    const style = getManagerPlaystyle(sideData.team);
    const aggressive = ['Overload', 'Quick Counter', 'Long Ball Counter'].includes(style);
    const currentTac = (m.tactics && m.tactics[side]) || 'balanced';
    let targetTac = currentTac;

    if (diff <= -1 && minute >= 60) {
      // Chasing the game: press higher, and once it's later and/or a two-
      // goal gap, go all out.
      targetTac = (diff <= -2 && minute >= 72) || minute >= 82 ? 'attack' : 'press';
    } else if (diff >= 1 && minute >= 70) {
      // Protecting a lead: ease off first, then properly shut up shop
      // as full time approaches.
      targetTac = minute >= 83 ? 'defend' : 'balanced';
    } else if (diff === 0 && minute >= 65 && aggressive) {
      // Level game, aggressive manager identity — more likely to gamble
      // on pressing for a winner than a patient/counter-minded one.
      targetTac = seededRandom() < 0.35 ? 'press' : currentTac;
    } else if (diff === 0 && minute < 60 && currentTac !== 'balanced' && seededRandom() < 0.1) {
      // Early-game overreactions settle back down if the game's still level.
      targetTac = 'balanced';
    }

    if (targetTac !== currentTac && minute - ai.lastChange >= 12) {
      setTacticsLive(side, targetTac);
      ai.lastChange = minute;
    }

    // Live formation reshape: reserved for clear, late situations, and only
    // once per side per match, so it reads as a real "extra attacker" or
    // "back five to see it out" moment rather than constant reshuffling.
    if (!m.formationAIUsed) m.formationAIUsed = { home: false, away: false };
    if (m.formationAIUsed[side]) return;
    const curForm = sideData.squad.formation;
    if (!curForm) return;
    const shape = formationShape(curForm);
    if (diff <= -1 && minute >= 75 && shape.fwd <= SHAPE_BASELINE.fwd + 0.4) {
      const target = pickMoreAttackingFormation(curForm);
      if (target && target !== curForm) {
        changeFormationLive(side, target);
        m.formationAIUsed[side] = true;
      }
    } else if (diff >= 1 && minute >= 82 && shape.def <= SHAPE_BASELINE.def + 0.4) {
      const target = pickMoreDefensiveFormation(curForm);
      if (target && target !== curForm) {
        changeFormationLive(side, target);
        m.formationAIUsed[side] = true;
      }
    }
  }
/*@CHUNK:c0251:END*/
