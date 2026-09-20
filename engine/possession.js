/*@CHUNK:c0050:START*/
  // Like pickPlayer, but the caller supplies the weighting function directly
  // instead of the fixed ovr/att/tec composite — used where an expanded
  // trait (aerial ability, etc.) should drive selection instead.
/*@CHUNK:c0050:END*/

/*@CHUNK:c0051:START*/
  function pickPlayerCustomWeighted(side, preferredPos, weightFn, excludeId) {
    if (!currentMatch || !side) return null;
    const ids = side === currentMatch.home ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    let pool = (side.squad.all || []).filter((p) => ids.includes(p.id) && p.id !== excludeId);
    if (preferredPos && preferredPos.length) {
      const preferred = pool.filter((p) => (p.pos || []).some((pos) => preferredPos.includes(pos)) || preferredPos.includes(p.slot));
      if (preferred.length) pool = preferred;
    }
    if (!pool.length) return null;
    const weights = pool.map((p) => Math.max(0.05, weightFn(p)));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = seededRandom() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }
/*@CHUNK:c0051:END*/

/*@CHUNK:c0222:START*/

  // ===== The core pipeline: Zones -> Movement -> Passing -> Duels, one =====
  // ===== zone transition at a time, until the ball reaches the final third
  // (Chance Creation) or is lost along the way (Transitions).
/*@CHUNK:c0222:END*/

/*@CHUNK:c0223:START*/
  function runPossessionSequence(attackingSide) {
    const m = currentMatch;
    if (!m) return;
    const defendingSide = attackingSide === 'home' ? 'away' : 'home';
    const attTeam = m[attackingSide], defTeam = m[defendingSide];
    const attMods = getPlaystyleMods(attTeam.team);
    const tac = (m.tactics && m.tactics[attackingSide]) || 'balanced';
    const defTac = (m.tactics && m.tactics[defendingSide]) || 'balanced';

    // ===== Zones phase: which channel does this sequence develop through? =====
    // Out Wide / Overload-minded managers lean wide; Possession/Long Ball
    // sides are more likely to build centrally.
    const wideBias = Math.max(0.15, Math.min(0.85, 0.42 * attMods.wingBiasMult));
    let channel = seededRandom() < wideBias ? (seededRandom() < 0.5 ? 'L' : 'R') : 'C';

    let carrier = pickPlayer(attTeam, ZONE_POS_MAP['DEF_' + channel], null, 'DEF_' + channel) || pickPlayer(attTeam, ['CB', 'GK']);
    if (!carrier) return;
    // Live ball-location tracking for the pitch view (ui/matchUI.js::
    // renderPitch): a lightweight {side, third, channel} snapshot of where
    // the ball currently is, from the possessing side's own perspective.
    // Purely a rendering aid — nothing in the simulation math reads this
    // back, so it's safe to update at every phase without affecting results.
    setBallZone(attackingSide, 'DEF', channel);
    // Attack Trigger: while this player has the ball, the whole team reads
    // the attacking picture better — a small boost to both finding a
    // team-mate and winning the ball back under pressure for as long as
    // they're the one carrying the move forward.
    const attackTriggerBonus = hasSkill(carrier, 'Attack Trigger') ? 0.025 : 0;

    for (let i = 0; i < 2; i++) { // DEF->MID, then MID->ATT
      const fromThird = PITCH_THIRDS[i], toThird = PITCH_THIRDS[i + 1];

      // ===== Decision phase: the carrier is on the ball right now — what do =====
      // ===== they actually try to do with it? Evaluated fresh every time the
      // ball changes hands, rather than the engine always assuming "pass".
      const carrierMarker = pickMarker(defTeam, mirrorDefenderPos(fromThird + '_' + channel), null, mirrorZoneKey(fromThird + '_' + channel));
      // A marker being called on to close the carrier down at all IS a
      // genuine defensive-pressure event, whatever the carrier goes on to
      // do with the ball — tallied live rather than guessed after the fact.
      if (carrierMarker) bumpExtStat(carrierMarker, 'pressures', 1);
      const decision = decideBallAction(carrier, carrierMarker, fromThird + '_' + channel, tac, defTac, attMods,
        ['pass', 'dribble', 'carry', 'backpass', 'switch', 'hold']);

      if (decision.action === 'backpass') {
        // Plays it safe and recycles — the move fizzles out this minute
        // rather than being forced forward into a bad situation.
        addEvent(m.minute, 'pass', `<span class="player">${carrier.name}</span> plays it back — no risks taken`, attackingSide);
        return;
      }

      let holdBonus = 0;
      if (decision.action === 'switch') {
        const others = PITCH_CHANNELS.filter((c) => c !== channel);
        channel = others[Math.floor(seededRandom() * others.length)];
        const chanName = channel === 'L' ? 'left' : channel === 'R' ? 'right' : 'middle';
        addEvent(m.minute, 'pass', `<span class="player">${carrier.name}</span> switches the play out to the ${chanName}`, attackingSide);
        bumpExtStat(carrier, 'switches', 1);
      } else if (seededRandom() < 0.1) {
        // Small residual drift so channel isn't only ever changed by an
        // explicit switch decision — real play still meanders a little.
        channel = PITCH_CHANNELS[Math.floor(seededRandom() * 3)];
      }

      if (decision.action === 'dribble' || decision.action === 'carry') {
        const runMarker = pickMarker(defTeam, mirrorDefenderPos(fromThird + '_' + channel), null, mirrorZoneKey(fromThird + '_' + channel));
        if (runMarker) bumpExtStat(runMarker, 'pressures', 1);
        const runPressure = runMarker ? defensivePressure(runMarker, carrier) : 60;
        // Base raised from 0.62 -> 0.72 (see passChance/duelChance below for
        // the full explanation): the old bases made a possession sequence
        // die out long before reaching the final third far more often than
        // real buildup play does, starving both ends of the pitch of shots
        // and, in turn, keepers of saves.
        // Showboat: the higher dribble attempt rate itself lives in
        // decisionModel.js's evaluateBallActions; the flip side — slightly
        // higher turnover risk once he actually goes for it — lives here.
        const showboatPenalty = ((carrier.expandedAttrs && carrier.expandedAttrs.personality) || []).includes('Showboat') ? 0.04 : 0;
        const carryChance = Math.max(0.30, Math.min(0.93,
          0.86 + (carryingAbility(carrier) - runPressure) / 140 + attackTriggerBonus - showboatPenalty));
        // Carries/dribbles are now tallied live off this exact roll — every
        // attempt counts as a carry (and, if this was specifically a
        // take-on rather than just driving forward, a dribble attempt
        // too); a successful one that survives the roll below also
        // advances the ball a full zone, i.e. it's progressive by
        // definition in this model.
        bumpExtStat(carrier, 'carries', 1);
        if (decision.action === 'dribble') bumpExtStat(carrier, 'dribbles', 1);
        const carrySuccess = seededRandom() < carryChance;
        if (!carrySuccess) {
          resolveTurnover(attackingSide, defendingSide, carrier, runMarker, fromThird, toThird, 'carry', channel);
          return;
        }
        bumpExtStat(carrier, 'progressiveCarries', 1);
        if (decision.action === 'dribble') bumpExtStat(carrier, 'successfulDribbles', 1);
        if (seededRandom() < 0.25) {
          addEvent(m.minute, 'skill', `${carrier.name} ${decision.action === 'dribble' ? 'dribbles past a challenge' : 'drives forward with the ball'}`, attackingSide);
        }
        setBallZone(attackingSide, toThird, channel);
        continue; // carrier advances the ball themselves — no pass needed this phase
      }

      if (decision.action === 'hold') {
        holdBonus = 0.04;
        if (seededRandom() < 0.35) addEvent(m.minute, 'pass', `<span class="player">${carrier.name}</span> shields it and waits for support`, attackingSide);
      }

      const targetZone = toThird + '_' + channel;

      // ===== Movement phase: who makes themselves available in that zone? =====
      const targetPlayer = pickPlayer(attTeam, ZONE_POS_MAP[targetZone], carrier.id, targetZone) || carrier;
      // The move is developing into this zone even before the pass is
      // resolved below — a real side shifts its shape toward the ball as
      // it travels, not only once it safely arrives.
      setBallZone(attackingSide, toThird, channel);

      // ===== Passing phase: can the carrier find them? =====
      const passerSkill = passingAbility(carrier);
      const marker = pickMarker(defTeam, mirrorDefenderPos(targetZone), null, mirrorZoneKey(targetZone));
      if (marker) bumpExtStat(marker, 'pressures', 1);
      const pressure = marker ? defensivePressure(marker, carrier) : 60;
      // Base raised from 0.5 -> 0.62: with two zone transitions (DEF->MID,
      // MID->ATT) chained together and EACH one gated behind both this pass
      // check AND the duel check right below, the old 0.5/0.78 bases only
      // let a sequence survive one full transition ~39% of the time —
      // squaring that across both transitions meant barely 1 in 6
      // possessions ever reached the final third at all, which was
      // starving shot volume (and therefore goals AND keeper saves, since
      // neither can happen without a shot reaching the box first) well
      // below a real match's output. This still leaves plenty of turnovers
      // (see resolveTurnover) — it just stops the pipe from being throttled
      // this hard before the ball even reaches a dangerous area.
      let passChance = 0.80 + (passerSkill - pressure) / 130 + attMods.passAccDelta + attackTriggerBonus
        + holdBonus + (decision.action === 'switch' ? 0.05 : 0);
      // A genuine numbers-up situation in the zone the ball is going into
      // gives the receiver real support to actually find, on top of
      // whatever the pass/pressure numbers already say — and the reverse
      // when the defence outnumbers the attack there.
      passChance += Math.max(-0.06, Math.min(0.06, localOverload(attackingSide, defendingSide, targetZone) * 0.02));
      if (tac === 'attack') passChance -= 0.03;
      if (tac === 'press') passChance -= 0.015;
      if (defTac === 'press') passChance -= 0.05;
      if (defTac === 'defend') passChance -= 0.03; // compact shape is harder to pass through
      // Tight Possession is specifically about composure in tight spaces
      // under close pressure — so it only matters here, against a genuine
      // high press, rather than being folded into every pass regardless of
      // context (that's what the blended passerSkill above already covers).
      if (defTac === 'press') {
        const tightPos = xattr(carrier, 'tight_pos', null);
        if (tightPos != null) passChance += ((tightPos - 70) / 100) * 0.12;
      }
      passChance = Math.max(0.30, Math.min(0.93, passChance));

      if (seededRandom() >= passChance) {
        resolveTurnover(attackingSide, defendingSide, carrier, marker, fromThird, toThird, 'pass', channel);
        return;
      }

      // ===== Duels phase: even a completed pass can be won back under =====
      // ===== immediate pressure (a 1v1 press right as the ball arrives).
      // Base raised from 0.78 -> 0.87 — see passChance above for why both
      // of these needed to come up together.
      const duelChance = Math.max(0.35, Math.min(0.95,
        0.91 + (carryingAbility(targetPlayer) - pressure) / 160 + (attMods.wingBiasMult - 1) * 0.05 - (defTac === 'press' ? 0.05 : 0) + attackTriggerBonus));
      if (seededRandom() >= duelChance) {
        resolveTurnover(attackingSide, defendingSide, targetPlayer, marker, fromThird, toThird, 'duel', channel);
        return;
      } else if (seededRandom() < 0.12) {
        addEvent(m.minute, 'skill', `✨ ${pickSkillDesc(targetPlayer, marker)}`, attackingSide);
      }

      // The pass just survived both the pass check and the duel check —
      // a genuinely completed pass that advanced the ball a full zone
      // (progressive by definition here), into the final third specifically
      // when this was the MID->ATT transition.
      bumpExtStat(carrier, 'progressivePasses', 1);
      if (toThird === 'ATT') bumpExtStat(carrier, 'finalThirdPasses', 1);
      carrier = targetPlayer;
    }

    // ===== Chance Creation phase (reached the final third) =====
    // A genuinely high/stretched defensive line (engine/spatialModel.js::
    // chanceSpaceBonus) creates a real edge here on top of whatever the
    // carrier's own attributes/playstyle already earn — a deep, compact
    // block should be harder to create a clean chance against than the
    // exact same defenders standing in a high, stretched line.
    resolveChanceCreation(attackingSide, defendingSide, carrier, channel, chanceSpaceBonus(defendingSide));
  }
/*@CHUNK:c0223:END*/

/*@CHUNK:c0232:START*/

/*@CHUNK:c0232:END*/

/*@CHUNK:c0233:START*/
  function pickPlayer(side, preferredPos, excludeId, zoneKey) {
    if (!currentMatch || !side) return null;
    const ids = side === currentMatch.home ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    let pool = (side.squad.all || []).filter(p => ids.includes(p.id) && p.id !== excludeId);
    if (preferredPos && preferredPos.length) {
      const preferred = pool.filter(p => (p.pos || []).some(pos => preferredPos.includes(pos)) || preferredPos.includes(p.slot));
      if (preferred.length) pool = preferred;
    }
    if (!pool.length) return null;
    // Weight selection toward higher-quality players (mild curve — this
    // path covers secondary events like corners/fouls, so quality should
    // nudge things without dominating the way it does for the main
    // goal/assist picker above). Specific attributes (att/tec) outweigh the
    // single overall number, same principle as the main picker below —
    // a player's actual finishing/technical ability should matter more than
    // the one flattened rating.
    //
    // `att` is derived almost entirely from finishing/shooting attributes
    // (see deriveStatsFromAttributes in data/playerDatabase.js — fin,
    // off_awr, head, place_kick, kick_pwr), while `tec` is the
    // passing/vision/dribbling composite (ball_con, dribb, low_pass,
    // lofted_pass, curl, tight_pos). This function is the one that decides
    // who actually receives the ball at every stage of a possession
    // sequence — including build-up (DEF zone) and midfield (MID zone),
    // where nobody is shooting. Leading with `att` there used to mean
    // strikers/wingers consistently out-weighted genuine playmakers and
    // attacking full-backs for the ball in zones where finishing ability
    // has nothing to do with who should be found — starving them of the
    // touches (and progressive/final-third passes) they'd need to actually
    // rack up the assists their real-world counterparts do. Only in the
    // final third (ATT zone) — and for the no-zoneKey secondary events
    // this function also serves (corners, fouls, throw-ins, etc.), where a
    // live scoring threat finding space is a fair proxy for "who gets
    // found" — does `att` lead; build-up and midfield selection leads with
    // `tec` instead.
    const zoneThird = zoneKey ? zoneKey.slice(0, 3) : null;
    const isBuildupOrMidfield = zoneThird === 'DEF' || zoneThird === 'MID';
    const weights = pool.map(p => {
      const composite = isBuildupOrMidfield
        ? (p.tec || 70) * 0.6 + (p.att || 70) * 0.4 + (p.ovr || 70) * 0.5
        : (p.att || 70) * 0.6 + (p.tec || 70) * 0.4 + (p.ovr || 70) * 0.5;
      // Offensive Awareness is specifically about finding space/making
      // yourself available when the team is attacking — so it nudges how
      // often a player gets found at all, on top of (not instead of) the
      // raw ability composite above.
      const offAwr = p.expandedAttrs ? xattr(p, 'off_awr', null) : null;
      const offAwrNudge = offAwr != null ? (offAwr - 70) * 0.15 : 0;
      let w = Math.pow(Math.max(composite + offAwrNudge, 40) / 92, 1.4) * 92;
      // Playstyle-driven pitch positioning: only applied when the caller
      // actually supplies a zoneKey (the possession pipeline's zone-based
      // carrier/target selection) — every other pickPlayer() call site
      // (corners, fouls, throw-ins, etc.) is unaffected since it never
      // passes one.
      if (zoneKey) w *= zoneAffinityMultiplier(p, zoneKey);
      return Math.max(5, w);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = seededRandom() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }
/*@CHUNK:c0233:END*/

/*@CHUNK:c0233b:START*/
  // Marking/pressure selection for the possession pipeline. Distinct from
  // pickPlayer() above on purpose: pickPlayer's composite leans on
  // attacking ability (att/tec) which is the right read for "who gets
  // found/scores/assists", but the wrong one for "who's actually the man
  // closing this ball carrier down" — that used to mean whichever nearby
  // player had the flashiest attacking numbers (often, confusingly, an
  // elite CDM with strong all-around ratings) got selected as marker
  // essentially every time. This weights by genuine defensive quality
  // instead, and applies the same playstyle zone affinity so a screening
  // Anchor Man/Destroyer is realistically the one found there.
  function pickMarker(side, preferredPos, excludeId, zoneKey) {
    if (!currentMatch || !side) return null;
    const ids = side === currentMatch.home ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    let pool = (side.squad.all || []).filter(p => ids.includes(p.id) && p.id !== excludeId);
    if (preferredPos && preferredPos.length) {
      const preferred = pool.filter(p => (p.pos || []).some(pos => preferredPos.includes(pos)) || preferredPos.includes(p.slot));
      if (preferred.length) pool = preferred;
    }
    if (!pool.length) return null;
    const weights = pool.map(p => {
      const defAwr = xattr(p, 'def_awr', null);
      const tack = xattr(p, 'tack', null);
      const defEng = xattr(p, 'def_eng', null);
      const composite = (defAwr != null && tack != null && defEng != null)
        ? (defAwr * 0.4 + tack * 0.35 + defEng * 0.25)
        : ((p.def || 70) * 0.75 + (p.ovr || 70) * 0.25);
      let w = Math.pow(Math.max(composite, 40) / 85, 1.3) * 85;
      if (zoneKey) w *= zoneAffinityMultiplier(p, zoneKey);
      return Math.max(5, w);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = seededRandom() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }
/*@CHUNK:c0233b:END*/

/*@CHUNK:c0234:START*/

  // Realistic role tendencies: strikers/wingers get on the scoresheet far more
  // than they create, while attacking mids/central mids are the primary creators.
  // Defenders/holding mids chip in occasionally (set pieces, late runs) but rarely lead scoring.
  // NOTE: these weights combine multiplicatively with each player's own attributes
  // (att/fin/off_awr/ovr/tec — see pickPlayerWeighted) and strikers/wingers already carry higher
  // 'att' ratings than midfielders. A wide spread here compounds with that and makes
  // strikers score far more than real-world scoring share (~ST 35-40%, wide/CAM
  // ~35-40%, CM/deep ~15-20%, defenders ~5-8%). Keep the spread modest.
  const GOAL_ROLE_WEIGHT = { ST: 1.9, CF: 1.9, RW: 1.7, LW: 1.7, CAM: 1.4, RM: 1.25, LM: 1.25, CM: 0.85, CDM: 0.45, RWB: 0.35, LWB: 0.35, RB: 0.3, LB: 0.3, CB: 0.2, GK: 0.01 };
  const ASSIST_ROLE_WEIGHT = { CAM: 2.0, CM: 1.75, RW: 1.65, LW: 1.65, RM: 1.4, LM: 1.4, ST: 1.0, CF: 1.0, CDM: 0.85, RWB: 0.8, LWB: 0.8, RB: 0.8, LB: 0.8, CB: 0.25, GK: 0.02 };
  // Penalty duty in real football overwhelmingly goes to strikers/wingers, with the
  // occasional attacking mid; deep midfielders almost never take them.
  const PEN_TAKER_ROLE_WEIGHT = { ST: 3.3, CF: 3.3, RW: 2.5, LW: 2.5, CAM: 1.0, RM: 0.7, LM: 0.7, CM: 0.3, CDM: 0.1, CB: 0.05 };

  // Like pickPlayer, but multiplies selection weight by a role-tendency table so
  // (for example) strikers/wingers are picked as goalscorers far more often than
  // central/defensive midfielders, matching real-world scoring distributions.
/*@CHUNK:c0234:END*/

/*@CHUNK:c0235:START*/
  function pickPlayerWeighted(side, preferredPos, roleWeights, excludeId) {
    if (!currentMatch || !side) return null;
    const ids = side === currentMatch.home ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    let pool = (side.squad.all || []).filter(p => ids.includes(p.id) && p.id !== excludeId);
    if (preferredPos && preferredPos.length) {
      const preferred = pool.filter(p => (p.pos || []).some(pos => preferredPos.includes(pos)) || preferredPos.includes(p.slot));
      if (preferred.length) pool = preferred;
    }
    if (!pool.length) return null;
    const weights = pool.map(p => {
      const slot = p.slot || (p.pos || [])[0] || 'CM';
      const roleW = (roleWeights && roleWeights[slot] != null) ? roleWeights[slot] : 1;
      // Composite quality (0-100ish scale). Raised to a modest power so real
      // separation in ability (a Mbappe/Haaland-tier finisher vs a squad
      // fill-in) compounds into a clearly higher share of goals/assists over
      // a season — like real-world Golden Boot races — without ever reducing
      // a lesser player's chance to zero on any single kick. This is
      // symmetric for every player regardless of club, so it favors quality,
      // not any particular team.
      // `tec` (ball control/dribbling/passing/curl) is a playmaking stat, not
      // a shooting one — it used to carry 25% of this composite, on par with
      // `att`/`ovr`, which let technical-but-non-clinical players out-score
      // genuine finishers. Finishing and Offensive Awareness (when the
      // player has an expanded attribute sheet) now take that weight
      // instead, since those are what actually make someone a goalscorer;
      // `tec` is reduced to a minor nudge. Falls back to a still-tec-light
      // att/ovr/tec blend for players without expanded attributes.
      const fin = xattr(p, 'fin', null);
      const offAwr = xattr(p, 'off_awr', null);
      const composite = (fin != null && offAwr != null)
        ? ((p.att || 70) * 0.40 + fin * 0.25 + offAwr * 0.15 + (p.ovr || 70) * 0.15 + (p.tec || 70) * 0.05)
        : ((p.att || 70) * 0.55 + (p.ovr || 70) * 0.30 + (p.tec || 70) * 0.15);
      const w = Math.pow(Math.max(composite, 30) / 70, 2.2) * 100 * roleW;
      return Math.max(1, w);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = seededRandom() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }
/*@CHUNK:c0235:END*/
