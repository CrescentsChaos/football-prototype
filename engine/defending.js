/*@CHUNK:c0046:START*/
  // Defensive-action edges — specific tackling/interception skills beyond
  // the generic def-based chance already used for the base roll.
/*@CHUNK:c0046:END*/

/*@CHUNK:c0047:START*/
  function defActionEdge(p) {
    if (!p || !p.expandedAttrs) return { chance: 0, interceptBias: 0 };
    let chance = ((xattr(p, 'tack', 70) - 70) / 100) * 0.03;
    let interceptBias = 0;
    if (hasSkill(p, 'Sliding Tackle')) chance += 0.01;
    if (hasSkill(p, 'Interception')) { chance += 0.006; interceptBias += 0.15; }
    if (hasSkill(p, 'Man Marking')) chance += 0.006;
    if (hasSkill(p, 'Blocker')) chance += 0.006;
    if (hasSkill(p, 'Track Back')) chance += 0.006;
    if (hasSkill(p, 'Long Reach Tackle')) chance += 0.007;
    // Shadow Hunt: a defender who reads a ball played into the space behind
    // them and reacts before it becomes a real chance — biases toward a
    // clean interception rather than a late/rash tackle.
    if (hasSkill(p, 'Shadow Hunt')) { chance += 0.005; interceptBias += 0.08; }
    // Destroyer/Anchor Man actively hunt the ball; Build Up and Box-to-Box
    // read the game well enough to time a challenge, but less aggressively.
    if (hasStyle(p, 'Destroyer')) { chance += 0.012; interceptBias += 0.05; }
    if (hasStyle(p, 'Anchor Man')) { chance += 0.008; interceptBias += 0.1; }
    if (hasStyle(p, 'Box-to-Box') || hasStyle(p, 'Build Up')) chance += 0.005;
    return { chance, interceptBias };
  }
/*@CHUNK:c0047:END*/

/*@CHUNK:c0200:START*/

  // Position-based share of a team's passing volume. Higher = touches the ball more often.
  const PASS_POS_WEIGHT = {
    GK: 0.55, CB: 1.75, RB: 1.3, LB: 1.3, RWB: 1.3, LWB: 1.3,
    CDM: 1.95, CM: 1.85, CAM: 1.45, RM: 1.2, LM: 1.2, RW: 1.0, LW: 1.0, ST: 0.7
  };

  // Per-minute base chance of a defensive action (tackle/interception/block) for
  // each position, independent of the main event roll above — this is what makes
  // defenders (and holding mids) consistently active across 90 minutes rather than
  // only picking up stats on the rare minutes the main event chain lands on them.
  const DEF_ACTION_BASE = {
    CB: 0.075, RB: 0.08, LB: 0.08, RWB: 0.085, LWB: 0.085, CDM: 0.09,
    CM: 0.05, RM: 0.025, LM: 0.025, RW: 0.018, LW: 0.018, CAM: 0.022, ST: 0.012, GK: 0
  };

  // Gives every defender (and holding mid) on the pitch an independent per-minute
  // roll for a tackle/interception/block, weighted by their defensive ability and
  // the pressure they're under from the opposing attack. Runs every minute
  // (including "quiet" minutes) so defensive stats build up naturally over 90
  // minutes instead of relying on the endMatch floor to backfill them.
/*@CHUNK:c0200:END*/

/*@CHUNK:c0201:START*/
  function simulateDefensiveActions() {
    const m = currentMatch;
    if (!m) return;
    if (!m.playerMatchStats) m.playerMatchStats = {};
    ['home', 'away'].forEach(side => {
      const team = m[side];
      const ids = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
      const onPitch = (team.squad.all || []).filter(p => ids.includes(p.id));
      if (!onPitch.length) return;
      const oppSide = side === 'home' ? m.away : m.home;
      const oppStr = calcTeamStrength(oppSide);
      const pressureMult = 0.85 + Math.max(0, (oppStr.att || 70) - 68) / 90;
      onPitch.forEach(p => {
        const slot = p.slot || (p.pos || [])[0] || 'CM';
        const base = DEF_ACTION_BASE[slot];
        if (!base) return;
        const defSkill = p.def != null ? p.def : (p.ovr || 70);
        const skillMult = 0.72 + (defSkill / 100) * 0.6;
        // Specific tackling/interception traits (Sliding Tackle, Interception,
        // Man Marking, Blocker) add on top of the generic def-based chance,
        // and interceptBias skews *which* kind of action a specialist gets.
        const actionEdge = defActionEdge(p);
        const chance = Math.min(0.24, base * skillMult * pressureMult + actionEdge.chance);
        if (seededRandom() >= chance) return;
        if (!m.playerMatchStats[p.id]) m.playerMatchStats[p.id] = blankPlayerMatchStats(p);
        const ps = m.playerMatchStats[p.id];
        const roll = seededRandom();
        const interceptCut = Math.min(0.75, 0.5 + actionEdge.interceptBias);
        if (roll < interceptCut) {
          ps.interceptions = (ps.interceptions || 0) + 1;
          ps.tackles = (ps.tackles || 0) + 1;
          team.stats.interceptions = (team.stats.interceptions || 0) + 1;
        } else if (roll < 0.85) {
          ps.tackles = (ps.tackles || 0) + 1;
        } else {
          ps.blocks = (ps.blocks || 0) + 1;
          team.stats.blocks = (team.stats.blocks || 0) + 1;
        }
      });
    });
  }
/*@CHUNK:c0201:END*/

/*@CHUNK:c0204:START*/

  // ===================================================================
  // ===================== REAL MATCH ENGINE ==========================
  // ===================================================================
  // Replaces the old flat "roll one dice, land on an outcome bucket" event
  // generator with an explicit phase pipeline that mirrors how a real
  // possession actually develops:
  //   Possession -> Zones -> Movement -> Passing -> Duels -> Transitions
  //   -> Chance Creation -> Shots -> GK  (with Tactics/manager playstyle
  //   modifying probabilities at every stage).
  // Every stage reads real player attributes — the expanded per-player
  // sheet when available, otherwise the derived 5-stat blend — so a
  // sequence's outcome is genuinely shaped by who's on the ball and who's
  // defending, not a flat percentage roll.

  // ---- Pitch model: 3 thirds x 3 channels, from the POV of the team in
  // possession (their own defensive third -> midfield -> attacking third).
  const PITCH_THIRDS = ['DEF', 'MID', 'ATT'];
  const PITCH_CHANNELS = ['L', 'C', 'R'];
  // Which positions naturally occupy each zone when their team has the
  // ball — used to pick a realistic ball-carrier/target for each stage of
  // a possession sequence instead of a flat "any outfield player" pool.
  const ZONE_POS_MAP = {
    DEF_L: ['LB', 'LWB', 'CB'],       DEF_C: ['CB', 'GK', 'CDM'],       DEF_R: ['RB', 'RWB', 'CB'],
    MID_L: ['LM', 'LW', 'LWB', 'CM'], MID_C: ['CM', 'CDM', 'CAM'],      MID_R: ['RM', 'RW', 'RWB', 'CM'],
    ATT_L: ['LW', 'LM', 'LWB'],       ATT_C: ['ST', 'CF', 'CAM', 'SS'], ATT_R: ['RW', 'RM', 'RWB']
  };
  // The defending team's own zone (mirrored third, same channel) is who's
  // actually responsible for marking a given attacking zone.
/*@CHUNK:c0204:END*/

/*@CHUNK:c0205:START*/
  function mirrorDefenderPos(zoneKey) {
    const [third, ch] = zoneKey.split('_');
    const defThird = third === 'ATT' ? 'DEF' : third === 'DEF' ? 'ATT' : 'MID';
    return ZONE_POS_MAP[defThird + '_' + ch] || ZONE_POS_MAP.MID_C;
  }
/*@CHUNK:c0205:END*/

/*@CHUNK:c0208:START*/
  function defensivePressure(p) {
    if (p && p.expandedAttrs) {
      const vals = [p.expandedAttrs.def_awr, p.expandedAttrs.def_eng, p.expandedAttrs.tack, p.expandedAttrs.aggr].filter(v => typeof v === 'number');
      const base = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : ((p.def || 70) * 0.7 + (p.ovr || 75) * 0.3);
      let bonus = 0;
      if (hasSkill(p, 'Track Back')) bonus += 1.5;
      if (hasSkill(p, 'Long Reach Tackle')) bonus += 1.5;
      // Fortress: this player's whole side defends better once they're
      // ahead in the second half.
      if (hasSkill(p, 'Fortress') && playerTeamLeadingSecondHalf(p)) bonus += 3;
      // GK Directing Defense / GK Spirit Roar: the team's own keeper
      // organizing (or roaring on) the back line lifts every defender in
      // front of him, not just his own shot-stopping.
      if (teamGkHasSkill(p, 'GK Directing Defense')) bonus += 1.5;
      if (teamGkHasSkill(p, 'GK Spirit Roar') && playerTeamLeadingSecondHalf(p)) bonus += 2;
      return base + bonus;
    }
    return (p.def || 70) * 0.7 + (p.ovr || 75) * 0.3;
  }
/*@CHUNK:c0208:END*/
