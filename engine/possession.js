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

    let carrier = pickPlayer(attTeam, ZONE_POS_MAP['DEF_' + channel]) || pickPlayer(attTeam, ['CB', 'GK']);
    if (!carrier) return;

    for (let i = 0; i < 2; i++) { // DEF->MID, then MID->ATT
      const fromThird = PITCH_THIRDS[i], toThird = PITCH_THIRDS[i + 1];
      // Occasional switch of play between thirds.
      if (seededRandom() < 0.22) channel = PITCH_CHANNELS[Math.floor(seededRandom() * 3)];
      const targetZone = toThird + '_' + channel;

      // ===== Movement phase: who makes themselves available in that zone? =====
      const targetPlayer = pickPlayer(attTeam, ZONE_POS_MAP[targetZone], carrier.id) || carrier;

      // ===== Passing phase: can the carrier find them? =====
      const passerSkill = passingAbility(carrier);
      const marker = pickPlayer(defTeam, mirrorDefenderPos(targetZone));
      const pressure = marker ? defensivePressure(marker) : 60;
      let passChance = 0.5 + (passerSkill - pressure) / 130 + attMods.passAccDelta;
      if (tac === 'attack') passChance -= 0.03;
      if (tac === 'press') passChance -= 0.015;
      if (defTac === 'press') passChance -= 0.05;
      if (defTac === 'defend') passChance -= 0.03; // compact shape is harder to pass through
      passChance = Math.max(0.30, Math.min(0.93, passChance));

      if (seededRandom() >= passChance) {
        resolveTurnover(attackingSide, defendingSide, carrier, marker, fromThird, toThird, 'pass');
        return;
      }

      // ===== Duels phase: even a completed pass can be won back under =====
      // ===== immediate pressure (a 1v1 press right as the ball arrives).
      const duelChance = Math.max(0.35, Math.min(0.95,
        0.78 + (carryingAbility(targetPlayer) - pressure) / 160 + (attMods.wingBiasMult - 1) * 0.05 - (defTac === 'press' ? 0.05 : 0)));
      if (seededRandom() >= duelChance) {
        resolveTurnover(attackingSide, defendingSide, targetPlayer, marker, fromThird, toThird, 'duel');
        return;
      } else if (seededRandom() < 0.12) {
        addEvent(m.minute, 'skill', `✨ ${pickSkillDesc(targetPlayer, marker)}`, attackingSide);
      }

      carrier = targetPlayer;
    }

    // ===== Chance Creation phase (reached the final third) =====
    resolveChanceCreation(attackingSide, defendingSide, carrier, channel);
  }
/*@CHUNK:c0223:END*/

/*@CHUNK:c0232:START*/

/*@CHUNK:c0232:END*/

/*@CHUNK:c0233:START*/
  function pickPlayer(side, preferredPos, excludeId) {
    if (!currentMatch || !side) return null;
    const ids = side === currentMatch.home ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    let pool = (side.squad.all || []).filter(p => ids.includes(p.id) && p.id !== excludeId);
    if (preferredPos && preferredPos.length) {
      const preferred = pool.filter(p => (p.pos || []).some(pos => preferredPos.includes(pos)) || preferredPos.includes(p.slot));
      if (preferred.length) pool = preferred;
    }
    if (!pool.length) return null;
    // Weight selection toward higher ovr / relevant attrs (mild curve — this
    // path covers secondary events like corners/fouls, so quality should
    // nudge things without dominating the way it does for the main
    // goal/assist picker above).
    const weights = pool.map(p => {
      const composite = (p.ovr || 70) + (p.att || 70) * 0.3 + (p.tec || 70) * 0.2;
      let w = Math.pow(Math.max(composite, 40) / 92, 1.4) * 92;
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

/*@CHUNK:c0234:START*/

  // Realistic role tendencies: strikers/wingers get on the scoresheet far more
  // than they create, while attacking mids/central mids are the primary creators.
  // Defenders/holding mids chip in occasionally (set pieces, late runs) but rarely lead scoring.
  // NOTE: these weights combine multiplicatively with each player's own attributes
  // (att/ovr/tec) in pickPlayerWeighted, and strikers/wingers already carry higher
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
      // separation in ability (a Mbappe/Haaland-tier ovr/att/tec vs a squad
      // fill-in) compounds into a clearly higher share of goals/assists over
      // a season — like real-world Golden Boot races — without ever reducing
      // a lesser player's chance to zero on any single kick. This is
      // symmetric for every player regardless of club, so it favors quality,
      // not any particular team.
      const composite = (p.ovr || 70) * 0.5 + (p.att || 70) * 0.35 + (p.tec || 70) * 0.15;
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
