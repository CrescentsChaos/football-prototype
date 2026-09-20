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

  // ===================================================================
  // ============ FORMATION/SUBSTITUTION POSITIONAL FIT =================
  // ===================================================================
  // A real bipartite matching (Kuhn's algorithm with augmenting paths),
  // not just a greedy best-fit pass — so "can this squad actually fill
  // this formation" is answered correctly even when a greedy slot-by-slot
  // assignment would wrongly claim it can't (or silently strand someone
  // in a slot they're not compatible with). n is at most ~11 here, so
  // this is effectively instant.
  //
  // Preferring each player's exact position first (slotOrderFor) doesn't
  // change *whether* a full matching exists, only which valid matching we
  // land on — so results still read as natural fits rather than an
  // arbitrary technically-legal shuffle.
  function slotOrderFor(player, slots) {
    const order = slots.map((slot, i) => ({ i, slot }));
    order.sort((a, b) => {
      const aFit = (player.pos || []).includes(a.slot) ? 1 : 0;
      const bFit = (player.pos || []).includes(b.slot) ? 1 : 0;
      return bFit - aFit;
    });
    return order;
  }

  // Returns an array (indexed by slot position) of player indices forming
  // a complete, fully position-compatible assignment of `players` onto
  // `formKey`'s slots — or null if no such complete assignment exists.
  function matchPlayersToFormation(players, formKey) {
    const formation = FORMATIONS[formKey];
    if (!formation) return null;
    const slots = formation.slots;
    if (!players || !players.length || players.length > slots.length) return null;
    const slotToPlayer = new Array(slots.length).fill(-1);

    function tryAssign(playerIdx, visited) {
      const order = slotOrderFor(players[playerIdx], slots);
      for (const entry of order) {
        const s = entry.i, slot = entry.slot;
        if (visited.has(s)) continue;
        if (!canPlay(players[playerIdx], slot)) continue;
        visited.add(s);
        if (slotToPlayer[s] === -1 || tryAssign(slotToPlayer[s], visited)) {
          slotToPlayer[s] = playerIdx;
          return true;
        }
      }
      return false;
    }

    for (let i = 0; i < players.length; i++) {
      const visited = new Set();
      if (!tryAssign(i, visited)) return null;
    }
    return slotToPlayer;
  }

  // Whether `players` (typically the 11 currently on the pitch) can all be
  // placed somewhere they're actually comfortable in `formKey` — the gate
  // changeFormationLive() checks before ever applying a reshape, so a
  // manager (AI or human) never switches into a shape that would strand
  // one of their own players out of position.
  function canFormationFitSquad(players, formKey) {
    return matchPlayersToFormation(players, formKey) !== null;
  }

  // Where an incoming substitute should actually line up. Prefers the
  // exact slot the outgoing player vacated (the normal like-for-like
  // case), but only if the sub is genuinely comfortable there — a
  // deliberate tactical swap (attacker on for a defender, or vice versa)
  // or a forced emergency sub should never leave the incoming player
  // parked in a position they can't play. Falls back to their own
  // natural position if it's part of the current formation, then to any
  // formation slot they can play, and only as an absolute last resort to
  // their natural position anyway (better than nothing when even the
  // formation's own slot list has no fit — e.g. a badly thinned-out bench).
  // `occupantPlayers` is everyone else currently on the pitch for this side
  // (i.e. excluding the outgoing player, who's leaving, and the incoming
  // sub, who doesn't have a slot yet) — used to make sure the slot handed
  // back is actually still free. Without this, a sub whose natural/fallback
  // slot was already held by an existing teammate (e.g. a second player
  // both tagged 'CB' because the formation only has one open CB berth)
  // ended up rendered nowhere near where they were actually subbed on:
  // renderPitch()'s slot lookup can only match one player per named slot,
  // so the loser of that collision gets swept into whichever slot is still
  // empty — usually the very one this player just vacated — which is what
  // made a defender look like they'd been sent on up front, or a forward
  // like they'd dropped into the back line.
  function pickSlotForIncomingSub(inPlayer, formationKey, outSlot, occupantPlayers) {
    const formation = FORMATIONS[formationKey] || FORMATIONS['4-3-3'];
    const occupied = {};
    (occupantPlayers || []).forEach((p) => {
      if (p && p.slot) occupied[p.slot] = (occupied[p.slot] || 0) + 1;
    });
    const slotCounts = {};
    formation.slots.forEach((s) => { slotCounts[s] = (slotCounts[s] || 0) + 1; });
    const isFree = (s) => (occupied[s] || 0) < (slotCounts[s] || 0);

    if (outSlot && canPlay(inPlayer, outSlot) && isFree(outSlot)) return outSlot;
    const natural = (inPlayer.pos || [])[0];
    if (natural && formation.slots.includes(natural) && isFree(natural)) return natural;
    const compatSlot = formation.slots.find(s => canPlay(inPlayer, s) && isFree(s));
    if (compatSlot) return compatSlot;
    // Nothing both comfortable and free — a manager never actually sends a
    // player on to a position they can't play, so there's no safe landing
    // spot for this particular sub right now. Returning null tells the
    // caller (trySubstitution) to look for a different incoming player
    // instead of forcing this one into the vacated slot regardless of fit.
    return null;
  }
/*@CHUNK:c0005:END*/

/*@CHUNK:c0095:START*/

  // Picks a formation for a team. If the team's manager has a "formation"
  // key set in teams.json (team.manager.formation, matching a valid
  // FORMATIONS entry) that formation is used strictly as the team's default
  // starting shape — though it can still be changed mid-match via the live
  // tactics panel. Otherwise a formation is deterministically derived from
  // the team's id/name so the same team tends to line up the same way match
  // to match, while different teams spread out across the available
  // formation pool instead of everyone randomly converging on the same one
  // or two shapes.
/*@CHUNK:c0095:END*/

/*@CHUNK:c0096:START*/
  function pickTeamFormation(team) {
    const setFormation = team && team.manager && team.manager.formation;
    if (setFormation && FORMATIONS[setFormation]) return setFormation;
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
    const basePref = PLAYSTYLE_FORM_PREF[style] || { fwd: 0.6, def: 0.6, wide: 0.6, mid: 0.6 };
    // Layer this specific manager's DNA on top of the style archetype so
    // two managers running the same nominal system don't converge on the
    // same formation-scoring vector — a high-risk/verticality manager
    // within a style leans further forward than a cautious one running
    // the identical playstyle label, etc.
    const dna = getManagerDNA(team);
    const pref = {
      fwd: basePref.fwd * (0.75 + dna.risk * 0.5) * (0.85 + dna.verticality * 0.3),
      def: basePref.def * (0.7 + (1 - dna.risk) * 0.5) * (0.85 + dna.compactness * 0.3),
      wide: basePref.wide * (0.6 + dna.width * 0.8),
      mid: (basePref.mid || 0.6) * (0.7 + dna.positionalFreedom * 0.6)
    };
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
  function decideOpeningTactic(selfStr, oppStr, style, team) {
    const gap = (selfStr.ovr || 75) - (oppStr.ovr || 75);
    // With a team reference we read the manager's own DNA (risk/directness)
    // on top of the style label, so opening instructions vary manager to
    // manager instead of just archetype to archetype.
    const dna = team ? getManagerDNA(team) : null;
    const risk = dna ? dna.risk : 0.5;
    const directness = dna ? dna.directness : 0.5;
    const counterMinded = ['Quick Counter', 'Long Ball Counter', 'Long Ball'].includes(style) || directness > 0.62;
    const possessionMinded = style === 'Possession' || (dna && dna.tempo > 0.62 && directness < 0.4);
    const pressChance = Math.max(0.25, Math.min(0.85, 0.5 + (risk - 0.5) * 0.4));
    if (gap <= -4) return seededRandom() < Math.max(0.35, 0.6 - (risk - 0.5) * 0.3) ? 'defend' : 'balanced';
    if (gap >= 5) return seededRandom() < (possessionMinded ? Math.min(0.85, pressChance + 0.15) : pressChance) ? (possessionMinded ? 'press' : 'attack') : 'balanced';
    if (counterMinded && gap < 2) return seededRandom() < Math.max(0.15, 0.35 - (risk - 0.5) * 0.2) ? 'defend' : 'balanced';
    if (possessionMinded) return seededRandom() < Math.min(0.65, 0.4 + (risk - 0.5) * 0.2) ? 'press' : 'balanced';
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
    const chasing = diff <= -1 && (m.dispMin != null ? m.dispMin : m.minute) >= 60;
    const protectingLead = diff >= 1 && (m.dispMin != null ? m.dispMin : m.minute) >= 72;
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
      if ((m.dispMin != null ? m.dispMin : m.minute) >= 58) score += Math.max(0, 72 - stamina) * 0.55;
      // Second-yellow risk: booked earlier and still out there for a
      // fast/aggressive closing stretch is exactly the profile that ends
      // up costing the team a man — pull them before that happens rather
      // than reacting to it after.
      const hasYellow = (m.cards[side] && m.cards[side][p.id]) >= 1;
      if (hasYellow && (m.dispMin != null ? m.dispMin : m.minute) >= 55) score += 24 + Math.min(20, ((m.dispMin != null ? m.dispMin : m.minute) - 55) * 0.6);
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
      // Only throw an EXTRA attacker forward (converting what would've
      // been a MID/DEF-for-MID/DEF swap into a FWD coming on) if the
      // attackers already out there are actually running low on legs.
      // Fresh, fit forwards don't get reinforced just because the
      // scoreline says "chasing" — a manager doesn't load up on
      // attackers who are still doing fine. If the current front line is
      // fit, this branch is skipped entirely: the substitution falls
      // through to the normal like-for-like tiers below, and if the
      // bench has nothing that fits THOSE either, no substitution
      // happens this call (see the "no further fallback" comment below).
      const onPitchAttackers = onPitch.filter(p => lineOf(p) === 'FWD');
      const avgAttackerStamina = onPitchAttackers.length
        ? onPitchAttackers.reduce((s, p) => s + getStamina(m, side, p.id), 0) / onPitchAttackers.length
        : 100;
      const attackersNeedFreshening = avgAttackerStamina < 68;
      const attackers = availableSubs.filter(p => lineOf(p) === 'FWD');
      if (attackers.length && outLine !== 'FWD' && attackersNeedFreshening) { candidatesIn = attackers; matchedOwnPosition = false; tacticalChange = true; }
    } else if (protectingLead) {
      const defenders = availableSubs.filter(p => lineOf(p) === 'DEF' || (lineOf(p) === 'MID' && (p.slot === 'CDM' || (p.pos||[]).includes('CDM'))));
      if (defenders.length && outLine !== 'DEF') { candidatesIn = defenders; matchedOwnPosition = false; tacticalChange = true; }
    }
    if (!candidatesIn.length) { candidatesIn = availableSubs.filter(p => lineOf(p) === outLine); tacticalChange = false; }
    if (!candidatesIn.length) { candidatesIn = availableSubs.filter(p => canPlay(p, outSlot)); matchedOwnPosition = false; tacticalChange = false; }
    // No further fallback: a manager doesn't send on a player who can't
    // actually play anywhere near the role being vacated. If the bench
    // genuinely offers nobody position-compatible, skip this substitution
    // rather than force someone into a position they're not comfortable
    // in — trySubstitution() gets called again on later minutes (see
    // engine/matchEngine.js), so a fitting sub can still happen once one
    // becomes available (e.g. after a different sub or in a wider window).
    if (!candidatesIn.length) return;

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
    // Only ever commit to an incoming sub who actually has a suitable spot
    // to land in — never force someone into a position they can't play.
    // Check the top few candidates (by quality) in order and take the
    // first one who resolves to a real slot; pickSlotForIncomingSub()
    // returns null when nothing fits, which this now respects instead of
    // overriding it with a forced placement.
    const restOfPitch = onPitch.filter(p => p.id !== outPlayer.id);
    const top = candidatesIn.slice(0, Math.min(3, candidatesIn.length));
    let inPlayer = null, inSlot = null;
    for (const cand of top) {
      const slot = pickSlotForIncomingSub(cand, sideData.squad.formation, outSlot, restOfPitch);
      if (slot) { inPlayer = cand; inSlot = slot; break; }
    }
    if (!inPlayer) {
      // None of the leading candidates has anywhere position-legal to
      // play right now — don't sub anyone on. trySubstitution() gets
      // called again on later minutes, so a fitting sub can still happen
      // once one becomes available.
      return;
    }
    const idx = onPitchIds.indexOf(outPlayer.id);
    if (idx >= 0) onPitchIds[idx] = inPlayer.id;
    markLeftPitch(m, side, outPlayer.id);
    resetFatigueFor(m, side, inPlayer.id);
    if (side === 'home') m.homeSubsUsed++; else m.awaySubsUsed++;
    const subDispMin = m.dispMin != null ? m.dispMin : m.minute;
    m.subLog[side][outPlayer.id] = Object.assign({}, m.subLog[side][outPlayer.id] || {}, { outMin: subDispMin, replacedBy: inPlayer.name });
    m.subLog[side][inPlayer.id] = Object.assign({}, m.subLog[side][inPlayer.id] || {}, { inMin: subDispMin, replaced: outPlayer.name });
    // The substitute inherits the outgoing player's exact pitch slot
    // (outSlot) whenever they're actually comfortable there — the normal
    // like-for-like case, and also what keeps the on-pitch rendering
    // correctly index-aligned (see buildSquad() in ui/teamUI.js and
    // drawTeam() in ui/matchUI.js). For a deliberate tactical change
    // (tacticalChange above — an attacker on for a defender or vice
    // versa), the incoming player is picked specifically because they're
    // NOT the same kind of player as who's going off, so forcing them
    // into outSlot would be exactly the "playing out of position" bug
    // this is fixing; pickSlotForIncomingSub() gives them their own
    // natural slot within the current formation instead (falling back to
    // any formation slot they can actually play if their exact position
    // isn't part of this shape).
    inPlayer.slot = inSlot;
    const tag = tacticalChange ? (chasing ? ' <span style="opacity:0.6">(attacking change)</span>' : ' <span style="opacity:0.6">(defensive change)</span>') : '';
    // Surface the real reason behind a notable change (booked/tiring) in
    // the event log, same spirit as the tactical tag above.
    const reasonBits = [];
    if (outPick.hasYellow && (m.dispMin != null ? m.dispMin : m.minute) >= 55) reasonBits.push('booked, managing risk');
    if (outPick.stamina < 40) reasonBits.push('tiring');
    const reasonTag = reasonBits.length ? ` <span style="opacity:0.55">(${reasonBits.join(', ')})</span>` : '';
    addEvent(m.minute, 'sub',
      `Substitution · ${sideData.team.short}${tag}${reasonTag}<br><span style="color:#4ade80">▲ In</span> <span class="player">${inPlayer.name}</span><br><span style="color:#f87171">▼ Out</span> <span class="player">${outPlayer.name}</span> <span style="opacity:0.6">(${used+1}/${m.maxSubs})</span>`,
      side);
    if (!m.quietSim) { renderLineups(); renderPitch(); }
  }

  // Career Mode's player-driven substitution — same bookkeeping as the tail
  // end of trySubstitution() above (pitch slot handoff, subLog, leftPitch,
  // fatigue reset, event feed) but with BOTH the outgoing and incoming
  // player chosen by the person instead of the automatic weighted pick, so
  // it works for any manager identity, situation, or plain personal
  // preference rather than only the AI's own reasoning. Called from the
  // Manage panel in ui/matchUI.js — never from the AI's own tick() loop.
  function manualSubstitute(side, outPlayerId, inPlayerId) {
    const m = currentMatch;
    if (!m || m.finished) { toast('No match in progress'); return false; }
    const sideData = m[side];
    if (!sideData) return false;
    const used = side === 'home' ? m.homeSubsUsed : m.awaySubsUsed;
    if (used >= (m.maxSubs || 5)) { toast('No substitutions remaining'); return false; }
    if (!m.leftPitch) m.leftPitch = { home: [], away: [] };
    const leftIds = m.leftPitch[side] || (m.leftPitch[side] = []);
    if (!m.subLog) m.subLog = { home: {}, away: {} };
    const onPitchIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const allPlayers = [...(sideData.squad.starting || []), ...(sideData.squad.subs || [])];
    const outPlayer = allPlayers.find(p => p.id === outPlayerId);
    const inPlayer = allPlayers.find(p => p.id === inPlayerId);
    if (!outPlayer || !onPitchIds.includes(outPlayer.id)) { toast('That player is not on the pitch'); return false; }
    if (!inPlayer || onPitchIds.includes(inPlayer.id) || leftIds.includes(inPlayer.id) || (m.injuries || []).includes(inPlayer.id)) {
      toast('That substitute is not available'); return false;
    }
    const outSlot = outPlayer.slot || (outPlayer.pos || [])[0] || 'CM';
    const restOfPitch = allPlayers.filter(p => onPitchIds.includes(p.id) && p.id !== outPlayer.id);
    const slot = pickSlotForIncomingSub(inPlayer, sideData.squad.formation, outSlot, restOfPitch) || outSlot;
    const idx = onPitchIds.indexOf(outPlayer.id);
    if (idx >= 0) onPitchIds[idx] = inPlayer.id;
    markLeftPitch(m, side, outPlayer.id);
    resetFatigueFor(m, side, inPlayer.id);
    if (side === 'home') m.homeSubsUsed++; else m.awaySubsUsed++;
    const subDispMin = m.dispMin != null ? m.dispMin : m.minute;
    m.subLog[side][outPlayer.id] = Object.assign({}, m.subLog[side][outPlayer.id] || {}, { outMin: subDispMin, replacedBy: inPlayer.name });
    m.subLog[side][inPlayer.id] = Object.assign({}, m.subLog[side][inPlayer.id] || {}, { inMin: subDispMin, replaced: outPlayer.name });
    inPlayer.slot = slot;
    addEvent(m.minute, 'sub',
      `Substitution · ${sideData.team.short}<br><span style="color:#4ade80">▲ In</span> <span class="player">${inPlayer.name}</span><br><span style="color:#f87171">▼ Out</span> <span class="player">${outPlayer.name}</span> <span style="opacity:0.6">(${used + 1}/${m.maxSubs})</span>`,
      side);
    if (!m.quietSim) { renderLineups(); renderPitch(); updateScoreboard(); }
    toast(inPlayer.name + ' on for ' + outPlayer.name);
    return true;
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

/*@CHUNK:c0238b:START*/
  // A sent-off goalkeeper is a special case of the above, not an omission:
  // real Laws of the Game let a team bring on a substitute at all (the red
  // card only removes that one player, it doesn't forbid using a sub slot),
  // so a manager with subs in hand brings on the reserve keeper — sacrificing
  // an outfield player for him, same "who gets sacrificed" logic as the
  // defender reshuffle below. Previously nothing at all handled a sent-off
  // GK: the team was left with zero players actually on the pitch flagged
  // as goalkeeper, and every shot/penalty/corner GK lookup elsewhere in the
  // engine would silently fall back to weighting the *entire* outfield pool
  // by attacking ability — meaning a different random attacker "made the
  // save" almost every time, re-rolled shot to shot, with GK stats
  // (saves/claims/psxg) piling up on whoever that happened to be. Bringing
  // on a real reserve keeper when one's available — and, when it isn't,
  // designating a single persistent outfield stand-in (sideData.emergencyGkId,
  // read by activeGoalkeeper() in engine/matchEngine.js) for the rest of the
  // match — replaces that phantom with either a genuine keeper or a
  // consistent, visible converted defender, exactly once.
/*@CHUNK:c0238b:END*/

/*@CHUNK:c0238c:START*/
  function handleGoalkeeperSentOff(side, sentOffGk) {
    const m = currentMatch;
    if (!m || !sentOffGk || m.finished) return;
    const sideData = m[side];
    const onPitchIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    if (!m.leftPitch) m.leftPitch = { home: [], away: [] };
    const leftIds = m.leftPitch[side] || (m.leftPitch[side] = []);
    const used = side === 'home' ? m.homeSubsUsed : m.awaySubsUsed;

    if (used < (m.maxSubs || 5)) {
      const availableSubs = (sideData.squad.subs || []).filter(p =>
        !onPitchIds.includes(p.id) && !m.injuries.includes(p.id) && !leftIds.includes(p.id));
      const benchGk = availableSubs.filter(p => (p.pos || []).includes('GK')).sort((a, b) => (b.ovr || 70) - (a.ovr || 70))[0];
      if (benchGk) {
        const allPlayers = [...(sideData.squad.starting || []), ...(sideData.squad.subs || [])];
        const onPitch = allPlayers.filter(p => onPitchIds.includes(p.id) && p.id !== sentOffGk.id && !m.injuries.includes(p.id));
        if (!onPitch.length) return;
        // Sacrifice the weakest remaining outfield player to make room for
        // the specialist — unlike the defender reshuffle, shape doesn't
        // matter here (any outfield slot can be freed up for a keeper), so
        // this just takes the lowest-rated player on the pitch.
        const outPlayer = [...onPitch].sort((a, b) => (a.ovr || 70) - (b.ovr || 70))[0];
        const idx = onPitchIds.indexOf(outPlayer.id);
        if (idx >= 0) onPitchIds[idx] = benchGk.id;
        markLeftPitch(m, side, outPlayer.id);
        resetFatigueFor(m, side, benchGk.id);
        if (side === 'home') m.homeSubsUsed++; else m.awaySubsUsed++;
        if (!m.subLog) m.subLog = { home: {}, away: {} };
        const subDispMin = m.dispMin != null ? m.dispMin : m.minute;
        m.subLog[side][outPlayer.id] = Object.assign({}, m.subLog[side][outPlayer.id] || {}, { outMin: subDispMin, replacedBy: benchGk.name });
        m.subLog[side][benchGk.id] = Object.assign({}, m.subLog[side][benchGk.id] || {}, { inMin: subDispMin, replaced: outPlayer.name });
        benchGk.slot = 'GK';
        const newUsed = side === 'home' ? m.homeSubsUsed : m.awaySubsUsed;
        addEvent(m.minute, 'sub',
          `Goalkeeper sent off · ${sideData.team.short} bring on a replacement keeper<br><span style="color:#4ade80">▲ In</span> <span class="player">${benchGk.name}</span> <span style="opacity:0.6">(GK)</span><br><span style="color:#f87171">▼ Out</span> <span class="player">${outPlayer.name}</span> <span style="opacity:0.6">(${newUsed}/${m.maxSubs})</span>`,
          side);
        if (!m.quietSim) { renderLineups(); renderPitch(); }
        return;
      }
    }

    // No fit reserve keeper available (or no subs left) — an outfield
    // player has to pull on the gloves for the rest of the match. Prefer a
    // recognised defender over whichever attacker happens to be on the
    // ball next, same instinct real managers show, and make the choice
    // once rather than re-deciding it shot by shot.
    const onPitch = (sideData.squad.all || []).filter(p => onPitchIds.includes(p.id) && p.id !== sentOffGk.id);
    if (!onPitch.length) return;
    const standIn = [...onPitch].sort((a, b) => {
      const aDef = lineOf(a) === 'DEF' ? 1 : 0, bDef = lineOf(b) === 'DEF' ? 1 : 0;
      if (aDef !== bDef) return bDef - aDef;
      return (b.ovr || 70) - (a.ovr || 70);
    })[0];
    sideData.emergencyGkId = standIn.id;
    addEvent(m.minute, 'sub', `${sideData.team.short} have no keeper left to bring on — <span class="player">${standIn.name}</span> takes the gloves for the rest of the match.`, side);
  }
/*@CHUNK:c0238c:END*/

/*@CHUNK:c0239:START*/
  function handleRedCardReshuffle(side, sentOffPlayer) {
    const m = currentMatch;
    if (!m || !sentOffPlayer || m.finished) return;
    if (lineOf(sentOffPlayer) === 'GK') { handleGoalkeeperSentOff(side, sentOffPlayer); return; }
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
    const subDispMin = m.dispMin != null ? m.dispMin : m.minute;
    m.subLog[side][outPlayer.id] = Object.assign({}, m.subLog[side][outPlayer.id] || {}, { outMin: subDispMin, replacedBy: inPlayer.name });
    m.subLog[side][inPlayer.id] = Object.assign({}, m.subLog[side][inPlayer.id] || {}, { inMin: subDispMin, replaced: outPlayer.name });
    // Same fix as the regular substitution above: the incoming defender
    // takes over a slot they can actually play — the sacrificed
    // forward/midfielder's exact slot if the defender is comfortable
    // there, otherwise their own natural defensive slot within the
    // current formation — rather than being forced into an attacking
    // slot they have no business playing.
    inPlayer.slot = pickSlotForIncomingSub(inPlayer, sideData.squad.formation, outPlayer.slot || (outPlayer.pos || ['CB'])[0], onPitch.filter(p => p.id !== outPlayer.id));
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
    if (!m || m.finished) return false;
    if (!FORMATIONS[formKey]) return false;
    const sideData = m[side];
    const onIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const all = [...(sideData.squad.starting||[]), ...(sideData.squad.subs||[])];
    const onPitch = onIds.map(id => all.find(p => p.id === id)).filter(Boolean);

    // Gate the whole reshape on every current player actually being able
    // to fill a slot in the new shape — a real manager doesn't switch
    // formation if it leaves one of his own players stranded out of
    // position. matchPlayersToFormation() finds a genuine full matching
    // (not just a greedy best-fit that can wrongly fail or wrongly
    // force a mismatch), so this is the single source of truth both for
    // "can we do this" and, if so, "who goes where".
    const assignment = matchPlayersToFormation(onPitch, formKey);
    if (!assignment) {
      toast(sideData.team.short + ': squad not comfortable in ' + formKey + ' — formation change skipped');
      // The native <select> already shows the rejected formation (the
      // user just picked it) even though squad.formation never changed —
      // snap it back immediately rather than leaving it out of sync until
      // the next natural renderLineups() call.
      const selEl = document.getElementById('live-form-' + side);
      if (selEl) selEl.value = sideData.squad.formation || '4-3-3';
      return false;
    }

    sideData.squad.formation = formKey;
    const slots = FORMATIONS[formKey].slots;
    assignment.forEach((playerIdx, slotIdx) => {
      if (playerIdx === -1) return;
      onPitch[playerIdx].slot = slots[slotIdx];
    });
    addEvent(m.minute, 'whistle', `📐 ${sideData.team.short} switch shape to ${formKey}`, side);
    if (!m.quietSim) { renderLineups(); updateScoreboard(); }
    toast(sideData.team.short + ' → ' + formKey);
    return true;
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
  // Picks a formation clearly more attacking in shape than the current
  // one (most forward-weighted bodies among the alternatives) that the
  // side currently on the pitch can actually fill without anyone playing
  // out of position — for the AI's late-game "throw men forward" reshape.
  // Returns null if nothing more attacking fits this exact XI.
  function pickMoreAttackingFormation(curKey, onPitchPlayers) {
    const keys = Object.keys(FORMATIONS).filter(k => k !== curKey);
    keys.sort((a, b) => formationShape(b).fwd - formationShape(a).fwd);
    return keys.find(k => canFormationFitSquad(onPitchPlayers, k)) || null;
  }
/*@CHUNK:c0245:END*/

/*@CHUNK:c0246:START*/
  // Picks a formation clearly more defensive in shape than the current one,
  // for the AI's late-game "shut up shop" reshape.
/*@CHUNK:c0246:END*/

/*@CHUNK:c0247:START*/
  // Picks a formation clearly more defensive in shape than the current
  // one that the side currently on the pitch can actually fill without
  // anyone playing out of position, for the AI's late-game "shut up
  // shop" reshape. Returns null if nothing more defensive fits this
  // exact XI.
  function pickMoreDefensiveFormation(curKey, onPitchPlayers) {
    const keys = Object.keys(FORMATIONS).filter(k => k !== curKey);
    keys.sort((a, b) => formationShape(b).def - formationShape(a).def);
    return keys.find(k => canFormationFitSquad(onPitchPlayers, k)) || null;
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
    // Career Mode: the AI manager never overrides the person's own tactics/
    // formation on the side they're controlling — see setTacticsLive/
    // changeFormationLive calls from the Manage panel in ui/matchUI.js.
    if (m.userSide !== 'home') evaluateTacticalAI('home', 'away');
    if (m.userSide !== 'away') evaluateTacticalAI('away', 'home');
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
    const minute = m.dispMin != null ? m.dispMin : m.minute;
    const diff = (sideData.score || 0) - (oppData.score || 0);
    const dna = getManagerDNA(sideData.team);
    // Fatigue and opponent-strength context feed the manager's reaction —
    // a gassed team or a clearly stronger opponent tempers even a
    // high-risk manager's instinct to gamble; a weaker opponent or a
    // fresh XI makes the gamble easier to justify.
    const onIdsNow = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const allSidePlayers0 = [...(sideData.squad.starting || []), ...(sideData.squad.subs || [])];
    const onPitchNow = (onIdsNow || []).map(id => allSidePlayers0.find(p => p.id === id)).filter(Boolean);
    const avgFatigue = onPitchNow.length ? onPitchNow.reduce((s, p) => s + staminaMultiplier(p), 0) / onPitchNow.length : 1;
    const oppGap = (calcTeamStrength(oppData).ovr || 75) - (calcTeamStrength(sideData).ovr || 75);
    const reaction = getManagerMatchReaction(sideData.team, { minute, fatigue: avgFatigue, oppGap });
    const currentTac = (m.tactics && m.tactics[side]) || 'balanced';
    let targetTac = currentTac;

    // Urgency shifts how early a chasing manager pushes the panic button —
    // a high-risk/low-composure manager presses/goes for it noticeably
    // sooner than a patient one in the exact same scoreline.
    const pressFrom = Math.round(60 - reaction.urgency * 12);
    const allOutFrom = Math.round(72 - reaction.urgency * 10);
    const allOutLatest = Math.round(82 - reaction.urgency * 6);
    const easeFrom = Math.round(70 + (dna.matchManagement - 0.5) * 8);
    const shutUpShopFrom = Math.round(83 + (dna.matchManagement - 0.5) * 6);

    if (diff <= -1 && minute >= pressFrom) {
      // Chasing the game: press higher, and once it's later and/or a two-
      // goal gap, go all out — both thresholds pulled earlier for a more
      // urgent manager identity.
      targetTac = (diff <= -2 && minute >= allOutFrom) || minute >= allOutLatest ? 'attack' : 'press';
    } else if (diff >= 1 && minute >= easeFrom) {
      // Protecting a lead: ease off first, then properly shut up shop as
      // full time approaches — a composed manager games this later/safer.
      targetTac = minute >= shutUpShopFrom ? 'defend' : 'balanced';
    } else if (diff === 0 && minute >= 65) {
      // Level game — whether this manager gambles on pressing for a
      // winner now comes straight from his own risk appetite/composure,
      // not a fixed list of "aggressive" styles.
      targetTac = seededRandom() < reaction.gambleChance ? 'press' : currentTac;
    } else if (diff === 0 && minute < 60 && currentTac !== 'balanced' && seededRandom() < Math.max(0.03, 0.1 + (dna.matchManagement - 0.5) * 0.1)) {
      // Early-game overreactions settle back down if the game's still
      // level — a composed manager corrects course a little more readily.
      targetTac = 'balanced';
    }

    if (targetTac !== currentTac && minute - ai.lastChange >= reaction.cooldown) {
      setTacticsLive(side, targetTac);
      ai.lastChange = minute;
    }

    // Live formation reshape: reserved for clear, late situations, and only
    // once per side per match, so it reads as a real "extra attacker" or
    // "back five to see it out" moment rather than constant reshuffling.
    // Most real managers stick to their starting shape for the entire
    // 90 minutes regardless of the scoreline — a genuine mid-match reshape
    // is the exception, not the norm. So the very first minute this side
    // qualifies for a reshape, we flip a single coin (roughly 1 in 4) for
    // whether this particular manager is even the type to do it at all —
    // decided once and remembered, not re-rolled every minute the
    // situation persists (a per-minute roll would make *some* minute
    // hitting near-certain over a 10-15 minute window, defeating the
    // point). A miss retires the idea for the rest of the match, same as
    // a manager who talked himself out of it once the moment passed. Only
    // actually fires if a suitably-shaped formation exists that the
    // current on-pitch XI can fill without anyone playing out of
    // position — see pickMoreAttackingFormation/pickMoreDefensiveFormation
    // and changeFormationLive's own gate above.
    if (!m.formationAIUsed) m.formationAIUsed = { home: false, away: false };
    if (!m.formationAIRoll) m.formationAIRoll = { home: null, away: null };
    if (m.formationAIUsed[side]) return;
    const RESHAPE_CHANCE = 0.25;
    const curForm = sideData.squad.formation;
    if (!curForm) return;
    const shape = formationShape(curForm);
    const onIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const allSidePlayers = [...(sideData.squad.starting || []), ...(sideData.squad.subs || [])];
    const onPitchPlayers = onIds.map(id => allSidePlayers.find(p => p.id === id)).filter(Boolean);
    const qualifiesAttacking = diff <= -1 && minute >= 75 && shape.fwd <= SHAPE_BASELINE.fwd + 0.4;
    const qualifiesDefensive = diff >= 1 && minute >= 82 && shape.def <= SHAPE_BASELINE.def + 0.4;
    if (!qualifiesAttacking && !qualifiesDefensive) return;
    if (m.formationAIRoll[side] === null) {
      m.formationAIRoll[side] = seededRandom() < RESHAPE_CHANCE;
    }
    if (!m.formationAIRoll[side]) { m.formationAIUsed[side] = true; return; }
    if (qualifiesAttacking) {
      const target = pickMoreAttackingFormation(curForm, onPitchPlayers);
      if (target && changeFormationLive(side, target)) {
        m.formationAIUsed[side] = true;
      }
    } else if (qualifiesDefensive) {
      const target = pickMoreDefensiveFormation(curForm, onPitchPlayers);
      if (target && changeFormationLive(side, target)) {
        m.formationAIUsed[side] = true;
      }
    }
  }
/*@CHUNK:c0251:END*/
