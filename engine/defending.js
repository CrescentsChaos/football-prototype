/*@CHUNK:c0046:START*/
  // Defensive-action edges — specific tackling/interception skills beyond
  // the generic def-based chance already used for the base roll.
/*@CHUNK:c0046:END*/

/*@CHUNK:c0047:START*/
  function defActionEdge(p) {
    if (!p || !p.expandedAttrs) return { chance: 0, interceptBias: 0 };
    let chance = curvedStat(xattr(p, 'tack', 70), 70, 29, 1.6) * 0.0087;
    // Interception bias now scales continuously with Defensive Awareness
    // (reading the game/anticipating the pass) instead of only moving in
    // fixed jumps from specific skills/playstyles — a player with a
    // genuinely elite def_awr reads passing lanes better than one who
    // merely has the "Interception" skill tag but an average rating.
    let interceptBias = curvedStat(xattr(p, 'def_awr', 70), 70, 29, 1.6) * 0.0638;
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
    // Playstyle-driven defensive edge — data-driven via PLAYSTYLE_BEHAVIOR
    // (engine/playstyleBehavior.js): Destroyer/Anchor Man actively hunt the
    // ball, Build Up/Box-to-Box/Defensive Full-back read the game well
    // enough to time a challenge but less aggressively, and every other
    // tagged style contributes its own distinct edge here too.
    chance += playstyleEdgeSum(p, 'defChance');
    interceptBias += playstyleEdgeSum(p, 'interceptBias');
    return { chance: chance * staminaMultiplier(p), interceptBias };
  }
/*@CHUNK:c0047:END*/

/*@CHUNK:cdef01:START*/
  // Shared foul-proneness read used by both the possession-sequence duel
  // path (engine/transitions.js) and set-piece/open-play fouls
  // (engine/referee.js) and the continuous per-minute defensive actions
  // below — a single source of truth so a genuinely reckless/aggressive
  // defender reads the same disciplinary risk everywhere in the engine.
  // Aggression is the primary driver (more willing to fly into challenges);
  // Defensive Awareness now genuinely offsets it in BOTH directions —
  // elite awareness earns a real discount for well-timed challenges, not
  // just "no extra penalty" — and high Physical Contact adds a little more
  // (more contact, more free-kicks given away even on well-timed tackles).
  //
  // Previously the Awareness term only ever ADDED risk for poor awareness
  // (max(0, 65 - defAwr)) and did nothing at all once awareness passed 65
  // — so it could never distinguish a genuinely elite, well-timed tackler
  // from a merely-average one at the same aggression level. Real top
  // ball-winning CBs (Konaté, Cubarsí, Huijsen, Rodri, ...) tend to have
  // BOTH very high aggression AND very high awareness in this data set —
  // under the old formula that awareness bought them nothing, so their
  // aggression alone (uncapped per-term, up to +0.56) pushed foulProneness
  // to ~1.5–1.7, roughly 50–70% more foul-prone than the baseline every
  // single duel, all season — which is exactly what produced 15-24
  // yellows / 3-6 reds in 38 matches for these players. Making the
  // Awareness term signed (it can now reduce v, not just fail to increase
  // it) brings that same group down to a realistic ~1.1-1.3.
/*@CHUNK:cdef01:END*/

/*@CHUNK:cdef01b:START*/
  // Further re-tuned: high-aggression DMs/CBs were still coming out
  // disproportionately foul/card-heavy over a season even after the signed
  // Awareness term above — the aggression term's slope (/70) and the 1.8
  // ceiling let a genuinely elite, high-engagement destroyer (who also
  // *wins the ball back* far more often than other positions, and so rolls
  // this disciplinary check far more often — see resolveTurnover in
  // engine/transitions.js) stack a modestly-elevated per-duel risk into a
  // large season total. Slope eased (/90) and the ceiling brought down to
  // 1.5 so aggression still matters — a reckless player is still visibly
  // more foul-prone than a disciplined one — without letting the volume of
  // duels a defensive-midfielder/CB naturally wins turn into a
  // multiplicatively unrealistic disciplinary record.
  function foulProneness(p) {
    if (!p || !p.expandedAttrs) {
      return 1 + Math.max(0, (75 - (p && p.def || 70)) / 90) + Math.max(0, (((p && p.phy) || 70) - 80) / 120);
    }
    const aggr = xattr(p, 'aggr', 70);
    const defAwr = xattr(p, 'def_awr', 70);
    const phyCon = xattr(p, 'phy_con', 70);
    let v = 1 + Math.max(0, aggr - 65) / 90 + (65 - defAwr) / 130 + Math.max(0, phyCon - 78) / 170;
    return Math.max(0.55, Math.min(1.5, v));
  }
/*@CHUNK:cdef01b:END*/

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
  // Retuned down from an earlier, much busier version so a typical starting CB's
  // full-match tackles/interceptions land close to real-world per-game averages
  // (~3.6 tackles, ~1.5 interceptions) instead of nearly double that.
  const DEF_ACTION_BASE = {
    CB: 0.0207, RB: 0.0219, LB: 0.0219, RWB: 0.0232, LWB: 0.0232, CDM: 0.0246,
    CM: 0.0138, RM: 0.0067, LM: 0.0067, RW: 0.0049, LW: 0.0049, CAM: 0.0058, ST: 0.0031, GK: 0
  };

  // Per-minute base chance of a *clearance* — a separate off-the-ball action
  // from the tackle/interception/block roll above: heading or hacking a
  // dangerous ball out of the danger area rather than winning it off an
  // opponent's feet. Weighted toward centre-backs, tuned so a starting CB
  // averages close to the real-world per-game figure (~7.3 clearances).
  const CLEARANCE_BASE = {
    CB: 0.085, RB: 0.037, LB: 0.037, RWB: 0.037, LWB: 0.037, CDM: 0.0226,
    CM: 0.009, RM: 0.0045, LM: 0.0045, RW: 0.0034, LW: 0.0034, CAM: 0.0045, ST: 0.0023, GK: 0
  };

  // Flavor text for the off-the-ball defensive actions below — these are
  // genuinely silent, minute-by-minute stat contributions most of the
  // time (so the feed isn't swamped with routine tackles), but a fraction
  // of them now surface as an actual event line so live/off-the-ball
  // defending is visible in the commentary, not just the stat sheet.
  const OFFBALL_TACKLE_DESC = [
    (n, t) => `<span class="player">${n}</span> times the challenge perfectly and wins it back (${t})`,
    (n, t) => `Strong tackle from <span class="player">${n}</span> breaks up the attack`,
    (n, t) => `<span class="player">${n}</span> (${t}) slides in and comes away with the ball`,
    (n, t) => `<span class="player">${n}</span> muscles the ball off his man`
  ];
  const OFFBALL_INTERCEPT_DESC = [
    (n, t) => `<span class="player">${n}</span> reads the pass and cuts it out`,
    (n, t) => `Intercepted! <span class="player">${n}</span> (${t}) steps in front of the ball`,
    (n, t) => `<span class="player">${n}</span> anticipates the ball into space and snuffs it out`,
    (n, t) => `Sharp interception from <span class="player">${n}</span> ends the move`
  ];
  const OFFBALL_BLOCK_DESC = [
    (n, t) => `<span class="player">${n}</span> gets a body in the way to block the pass`,
    (n, t) => `<span class="player">${n}</span> (${t}) throws himself in front of it to cut the ball out`,
    (n, t) => `Blocked by <span class="player">${n}</span> — the pass never gets through`
  ];
  const OFFBALL_CLEARANCE_DESC = [
    (n, t) => `<span class="player">${n}</span> gets across to clear the danger`,
    (n, t) => `Last-ditch clearance from <span class="player">${n}</span> (${t})`,
    (n, t) => `<span class="player">${n}</span> heads it clear from the edge of the box`,
    (n, t) => `<span class="player">${n}</span> hacks it clear under pressure`,
    (n, t) => `Composed clearance by <span class="player">${n}</span> (${t})`
  ];
  function pickOffBallDesc(bank, p, team) {
    const f = bank[Math.floor(seededRandom() * bank.length)];
    return f(p.name, (team && team.team && team.team.short) || '');
  }

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
      const oppSide = side === 'home' ? 'away' : 'home';
      const ids = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
      const onPitch = (team.squad.all || []).filter(p => ids.includes(p.id));
      if (!onPitch.length) return;
      const oppTeamData = m[oppSide];
      const oppStr = calcTeamStrength(oppTeamData);
      const pressureMult = 0.85 + Math.max(0, (oppStr.att || 70) - 68) / 90;
      onPitch.forEach(p => {
        const slot = p.slot || (p.pos || [])[0] || 'CM';
        const base = DEF_ACTION_BASE[slot];
        if (!base) return;
        // Defensive Engagement and the (Awareness + Tackling) execution
        // blend now drive two genuinely different things: def_eng decides
        // how often this player is even involved in a defensive passage at
        // all (his work-rate/willingness to close it down), while
        // def_awr/tack decide how well he does once he is. A high-work-rate
        // but technically limited destroyer and a positionally brilliant
        // but low-energy sweeper now read very differently over 90 minutes,
        // instead of both being flattened into one generic `def` number.
        const defAwr = xattr(p, 'def_awr', p.def != null ? p.def : 70);
        const tack = xattr(p, 'tack', p.def != null ? p.def : 70);
        const defEng = xattr(p, 'def_eng', p.def != null ? p.def : 70);
        const engagementMult = (0.75 + (defEng / 100) * 0.5) * staminaMultiplier(p);
        // Curved rather than a flat blend: a genuinely elite tackler/reader
        // of the game (90+) closes the gap on a merely-good one (75-80) by
        // more than a straight line would ever let him.
        const execSkill = curvedAttr(defAwr, 70) * 0.4 + curvedAttr(tack, 70) * 0.6;
        const skillMult = 0.72 + (execSkill / 100) * 0.6;
        // Specific tackling/interception traits (Sliding Tackle, Interception,
        // Man Marking, Blocker) add on top of the generic def-based chance,
        // and interceptBias skews *which* kind of action a specialist gets.
        const actionEdge = defActionEdge(p);
        // Grinder: tackle/interception success specifically rises when his
        // team is behind — a genuine game-state gate, not a flat bonus.
        let grinderMult = 1;
        if (((p.expandedAttrs && p.expandedAttrs.personality) || []).includes('Grinder')) {
          const losing = side === 'home' ? m.home.score < m.away.score : m.away.score < m.home.score;
          if (losing) grinderMult = 1.18;
        }
        const chance = Math.min(0.24, (base * skillMult * engagementMult * pressureMult + actionEdge.chance) * grinderMult);
        if (seededRandom() >= chance) return;
        // Aggression carries a real cost: the more aggressively a player
        // throws himself into challenges, the more of those attempts turn
        // into a mistimed foul instead of a clean action — this is the
        // continuous per-minute defensive loop's own disciplinary risk,
        // separate from (and in addition to) the duel-losing foul chance
        // already modeled in resolveTurnover/resolveFoul.
        // Eased alongside foulProneness above: this fires on every one of a
        // high-engagement position's (CDM in particular has the highest
        // DEF_ACTION_BASE) many defensive-action attempts per match, so its
        // aggression slope was compounding with sheer attempt volume to
        // over-card those positions specifically. Lower base + gentler
        // slope keeps a reckless player's extra risk real without letting
        // it multiply out of proportion over 90 minutes of attempts.
        const foulRisk = Math.min(0.15, 0.035 + Math.max(0, xattr(p, 'aggr', 70) - 65) / 260);
        if (seededRandom() < foulRisk) {
          const victim = pickPlayer(oppTeamData, ['ST', 'CAM', 'RW', 'LW', 'CM'], null);
          resolveFoul(side, oppSide, p, victim, false);
          return;
        }
        if (!m.playerMatchStats[p.id]) m.playerMatchStats[p.id] = blankPlayerMatchStats(p);
        const ps = m.playerMatchStats[p.id];
        const roll = seededRandom();
        // Baseline dropped from 0.5 to 0.35 — interceptions/tackles used to
        // split roughly 50/50, which pushed a busy CB's interception count
        // well above real-game averages. Pure interception reading
        // (def_awr) and specific interception traits still bias this up
        // per-player, same as before.
        const interceptCut = Math.min(0.75, 0.235 + actionEdge.interceptBias);
        if (roll < interceptCut) {
          // Interception and tackle are alternative outcomes of this same
          // roll (see the comment above interceptCut), not two separate
          // actions — crediting both here double-counted every single
          // interception as a tackle too, inflating both the individual
          // and (via the interceptions/tackles totals the Defenders' Award
          // sums in ui/statisticsUI.js) the season-long defensive totals.
          ps.interceptions = (ps.interceptions || 0) + 1;
          team.stats.interceptions = (team.stats.interceptions || 0) + 1;
          if (seededRandom() < 0.14) addEvent(m.minute, 'whistle', pickOffBallDesc(OFFBALL_INTERCEPT_DESC, p, team), side);
        } else if (roll < 0.85) {
          ps.tackles = (ps.tackles || 0) + 1;
          if (seededRandom() < 0.14) addEvent(m.minute, 'whistle', pickOffBallDesc(OFFBALL_TACKLE_DESC, p, team), side);
        } else {
          ps.blocks = (ps.blocks || 0) + 1;
          team.stats.blocks = (team.stats.blocks || 0) + 1;
          if (seededRandom() < 0.14) addEvent(m.minute, 'whistle', pickOffBallDesc(OFFBALL_BLOCK_DESC, p, team), side);
        }
      });

      // ---- Clearances — a genuinely separate off-the-ball action from the
      // tackle/interception/block roll above: heading or hacking a
      // dangerous ball out of the area rather than winning it off a man.
      // Independent per-minute roll so it doesn't crowd out (or get
      // crowded out by) the tackle/interception roll on the same player
      // in the same minute — in real matches a defender can easily both
      // tackle and clear the danger in the same passage of play.
      onPitch.forEach(p => {
        const slot = p.slot || (p.pos || [])[0] || 'CM';
        const clrBase = CLEARANCE_BASE[slot];
        if (!clrBase) return;
        if (!m.playerMatchStats[p.id]) m.playerMatchStats[p.id] = blankPlayerMatchStats(p);
        const ps = m.playerMatchStats[p.id];
        // Both flags are set here, unconditionally, for every eligible
        // on-pitch player every minute — BEFORE we know whether this
        // minute's clearance/headed-clearance rolls actually succeed.
        // Previously _liveHeadedClr was only set inside the "a clearance
        // just happened" branch below, so a player who racked up real
        // clearances but never once won the 35% headed-clearance sub-roll
        // still had _liveHeadedClr stuck at its default (falsy) — and
        // deriveExtendedMatchStats() then "backfilled" their genuine,
        // live-simulated zero with a formula guess derived from their
        // clearance total, silently replacing a real number with a
        // synthetic one. Marking both as live-tracked up front means a
        // real zero stays a real zero; only a player the live loop never
        // reached at all (no CLEARANCE_BASE entry for their slot — GK)
        // still gets the random backfill.
        ps._liveClr = true; // tells deriveExtendedMatchStats not to overwrite this with a random backfill figure
        ps._liveHeadedClr = true; // ditto — for headedClearances specifically
        const defAwr = xattr(p, 'def_awr', p.def != null ? p.def : 70);
        const jmp = xattr(p, 'jmp', p.phy != null ? p.phy : 70);
        const phyCon = xattr(p, 'phy_con', p.phy != null ? p.phy : 70);
        const clrSkillMult = 0.82 + (curvedAttr(defAwr, 70) * 0.4 + curvedAttr(jmp, 70) * 0.35 + curvedAttr(phyCon, 70) * 0.25) / 100 * 0.4;
        const clrChance = Math.min(0.22, clrBase * clrSkillMult * pressureMult * staminaMultiplier(p));
        if (seededRandom() >= clrChance) return;
        ps.clearances = (ps.clearances || 0) + 1;
        if (seededRandom() < 0.35) ps.headedClearances = (ps.headedClearances || 0) + 1;
        team.stats.clearances = (team.stats.clearances || 0) + 1;
        if (seededRandom() < 0.12) addEvent(m.minute, 'whistle', pickOffBallDesc(OFFBALL_CLEARANCE_DESC, p, team), side);
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

/*@CHUNK:c0205b:START*/
  // The mirrored zone key itself (not just the position list) — needed so
  // marker selection can apply the same playstyle-based positioning
  // affinity a carrier gets, e.g. an Anchor Man screening in front of his
  // own back line should actually be the one found there more often than
  // whichever teammate merely has the higher generic rating.
  function mirrorZoneKey(zoneKey) {
    const [third, ch] = zoneKey.split('_');
    const defThird = third === 'ATT' ? 'DEF' : third === 'DEF' ? 'ATT' : 'MID';
    return defThird + '_' + ch;
  }
/*@CHUNK:c0205b:END*/

/*@CHUNK:c0205c:START*/
  // Playstyle-driven pitch-positioning affinity: how much more (or less)
  // likely a player is to actually be the one found in a given zone,
  // beyond what his base position slot already implies. A Goal Poacher/Fox
  // in the Box striker realistically doesn't drop into midfield to help
  // build play, while a Deep-Lying Forward does; a Cross Specialist hugs
  // the touchline instead of drifting inside; an Anchor Man screens
  // centrally in front of the back line instead of joining the attack.
  // Applied as a weight multiplier on top of the normal ability-based
  // selection in pickPlayer()/pickMarker() wherever a zoneKey is supplied.
  function zoneAffinityMultiplier(player, zoneKey) {
    if (!zoneKey || !player || !player.expandedAttrs) return 1;
    const styles = player.expandedAttrs.playstyle || [];
    if (!styles.length) return 1;
    const parts = zoneKey.split('_');
    const third = parts[0], ch = parts[1];
    const central = ch === 'C';
    let mult = 1;
    styles.forEach((s) => {
      if (s === 'Goal Poacher' || s === 'Fox in the Box') {
        if (third === 'ATT' && central) mult *= 1.5;
        else if (third === 'MID') mult *= 0.55;
        else if (third === 'DEF') mult *= 0.25;
      } else if (s === 'Deep-Lying Forward' || s === 'Hole Player') {
        if (third === 'MID' && central) mult *= 1.4;
        else if (third === 'ATT' && central) mult *= 0.9;
      } else if (s === 'Target Man') {
        if (third === 'ATT' && central) mult *= 1.3;
        if (!central) mult *= 0.75;
      } else if (s === 'Dummy Runner' || s === 'Extra Frontman') {
        if (third === 'ATT') mult *= 1.25;
      } else if (s === 'Creative Playmaker' || s === 'Classic No. 10' || s === 'Orchestrator') {
        if (central && third !== 'DEF') mult *= 1.35;
        else if (!central) mult *= 0.8;
      } else if (s === 'Prolific Winger' || s === 'Cross Specialist' || s === 'Roaming Flank') {
        if (!central) mult *= 1.35;
        else mult *= 0.7;
      } else if (s === 'Inside Forward') {
        if (central && third !== 'DEF') mult *= 1.35;
      } else if (s === 'Box-to-Box') {
        if (third === 'DEF' || third === 'ATT') mult *= 1.2;
      } else if (s === 'Destroyer' || s === 'Anchor Man') {
        if (third === 'ATT') mult *= 0.35;
        else if (third === 'DEF' || (third === 'MID' && central)) mult *= 1.25;
      } else if (s === 'Build Up') {
        if (third === 'DEF') mult *= 1.15;
      } else if (s === 'Offensive Full-back' || s === 'Full-back Finisher') {
        if (!central && third !== 'DEF') mult *= 1.4;
      } else if (s === 'Defensive Full-back') {
        if (third === 'DEF') mult *= 1.25;
        else if (third === 'ATT') mult *= 0.6;
      }
    });
    return Math.max(0.15, Math.min(2.2, mult));
  }
/*@CHUNK:c0205c:END*/

/*@CHUNK:c0208:START*/
  // `carrier` is optional (existing call sites that don't have one in
  // scope keep working exactly as before) — when supplied, a genuine
  // spatial read (engine/spatialModel.js::markingDistance()) tightens or
  // loosens the attribute-based pressure number below: the same marker
  // closing down from 3 pitch-length-units away presses harder than one
  // still 25 units off, on top of whatever their attributes already say
  // about how good they are at applying it once there.
  function defensivePressure(p, carrier) {
    if (p && p.expandedAttrs) {
      // Distinct weighting instead of a flat average: Defensive Awareness
      // (positioning/anticipation) and Tackling (execution) are what
      // actually close a player down and win the ball, Defensive
      // Engagement (work-rate) is why he's even there to apply it, and
      // Aggression contributes a smaller, more situational push.
      const defAwr = xattr(p, 'def_awr', null);
      const defEng = xattr(p, 'def_eng', null);
      const tack = xattr(p, 'tack', null);
      const aggr = xattr(p, 'aggr', null);
      const base = (defAwr != null && defEng != null && tack != null && aggr != null)
        ? (curvedAttr(defAwr, 70) * 0.35 + curvedAttr(tack, 70) * 0.3 + curvedAttr(defEng, 70) * 0.2 + curvedAttr(aggr, 70) * 0.15)
        : (curvedAttr(p.def || 70, 70) * 0.7 + curvedAttr(p.ovr || 75, 75) * 0.3);
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
      // The manager's own pressing/compactness DNA lifts (or blunts) every
      // defender's ability to close a man down, on top of that player's
      // raw attributes — a genuinely high-pressing, compact manager's
      // side closes space quicker as a unit than the same eleven bodies
      // playing for a passive one.
      const sd = playerSideData(p);
      if (sd) {
        const dna = getManagerDNA(sd.side.team);
        bonus += (dna.pressing - 0.5) * 3 + (dna.compactness - 0.5) * 2;
      }
      // A tired defender presses/closes down a yard slower than a fresh one.
      let distanceMult = 1;
      if (carrier) {
        // markingDistance() is now the true straight-line distance on the
        // shared pitch (sideways gap included), where a possession-sequence
        // marker typically sits ~10 units away (a tight, goal-side marking
        // job) to ~60+ (loose, covering off a zone rather than a man) —
        // mapped onto a 0.7x-1.25x multiplier so genuinely tight marking
        // meaningfully outweighs loose zonal coverage, without a wildly
        // out-of-position marker ever pressing harder than a well-attributed
        // one standing right next to the carrier. Recalibrated from the
        // old 1.3 - dist/50 (tuned for the vertical-gap-only distance) so
        // the AVERAGE multiplier — and with it the match balance — is
        // unchanged now that the distance also counts the sideways gap.
        const dist = markingDistance(carrier, p);
        distanceMult = Math.max(0.7, Math.min(1.25, 1.39 - dist / 64));
      }
      return (base + bonus) * staminaMultiplier(p) * conditionMultiplier(p) * distanceMult;
    }
    return (curvedAttr(p.def || 70, 70) * 0.7 + curvedAttr(p.ovr || 75, 75) * 0.3) * conditionMultiplier(p);
  }
/*@CHUNK:c0208:END*/
