/*@CHUNK:c0203:START*/
  // Per-position share of a player's passing volume that's realistically a
  // lofted ball (cross/switch/long diagonal) rather than a ground pass —
  // wide defenders and out-and-out crossers live here far more than a
  // holding mid or a striker does. Feeds simulateMinutePassing() below so
  // low_pass and lofted_pass finally drive *different* shares of a
  // player's actual pass volume instead of being blended into one number
  // regardless of what kind of passer he really is.
  const LOFTED_PASS_SHARE = {
    GK: 0.42, CB: 0.14, RB: 0.34, LB: 0.34, RWB: 0.4, LWB: 0.4,
    CDM: 0.14, CM: 0.18, CAM: 0.16, RM: 0.38, LM: 0.38, RW: 0.4, LW: 0.4, ST: 0.12
  };

  // Per-pass chance that a pass is a cross into the box — wide players and
  // wing-backs deliver most of them. Feeds the crosses stat and cleared-
  // cross corners in simulateMinutePassing() below (only crosses that turned
  // into a shot were counted before, ~6 a match against ~25-30 in a real
  // one). Rolled per pass rather than off the lofted-ball count: the
  // lofted split rounds to zero for most single-pass minutes.
  const CROSS_PER_PASS = {
    RB: 0.05, LB: 0.05, RWB: 0.085, LWB: 0.085, RM: 0.085, LM: 0.085, RW: 0.075, LW: 0.075, CAM: 0.015, CM: 0.008
  };
/*@CHUNK:c0203:END*/

/*@CHUNK:c0204b:START*/
  function simulateMinutePassing() {
    const m = currentMatch;
    if (!m) return;
    if (!m.playerMatchStats) m.playerMatchStats = {};
    let homeCompletedMin = 0, awayCompletedMin = 0;
    // Ball-control quality — technical ability, overall, and manager combine into
    // how much a team naturally dictates tempo. This (not just pass accuracy) now
    // drives raw pass *volume*, so a clearly superior side genuinely racks up more
    // attempted passes from minute one instead of the two sides staying
    // symmetric-random and drifting back to an even split by full time.
    const homeStr = calcTeamStrength(m.home);
    const awayStr = calcTeamStrength(m.away);
    const ctrl = (s) => s.tec * 0.55 + s.ovr * 0.25 + (s.mgr != null ? s.mgr : 75) * 0.20;
    const ctrlDiff = Math.max(-24, Math.min(24, ctrl(homeStr) - ctrl(awayStr)));
    const ctrlShift = ctrlDiff / 24 * 0.4; // up to +/-40% volume swing from raw quality gap
    ['home', 'away'].forEach(side => {
      const team = m[side];
      const oppTeam = side === 'home' ? m.away : m.home;
      const ids = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
      const onPitch = (team.squad.all || []).filter(p => ids.includes(p.id));
      if (!onPitch.length) return;
      const tac = (m.tactics && m.tactics[side]) || 'balanced';
      const pmods = getPlaystyleMods(team.team);
      // Recent possession share still feeds back a little into how much of the ball
      // this team gets — clamped so it can't spiral away from realistic bounds.
      const possShare = Math.max(0.8, Math.min(1.25, ((team.stats.possession || 50)) / 50));
      let baseVol = 5.2 + seededRandom() * 2.6; // ~5.2-7.8 team passes per minute baseline
      if (tac === 'attack') baseVol *= 1.08;
      if (tac === 'defend') baseVol *= 0.86;
      if (tac === 'press') baseVol *= 0.78;
      baseVol *= pmods.passVolMult; // manager playstyle: direct (Long Ball) vs patient (Possession)
      baseVol *= (side === 'home' ? (1 + ctrlShift) : (1 - ctrlShift)); // raw quality gap
      // Game state: a team chasing the game commits more men forward and sees more
      // of the ball late on; one nursing a lead can afford to sit off it.
      if ((m.dispMin != null ? m.dispMin : m.minute) > 60) {
        const diff = (team.score || 0) - (oppTeam.score || 0);
        if (diff <= -1) baseVol *= 1 + Math.min(0.18, Math.abs(diff) * 0.08);
        else if (diff >= 1) baseVol *= 1 - Math.min(0.1, diff * 0.04);
      }
      const vol = Math.max(1, baseVol * possShare);
      const weighted = onPitch.map(p => {
        const slot = p.slot || (p.pos || [])[0] || 'CM';
        let w = PASS_POS_WEIGHT[slot] != null ? PASS_POS_WEIGHT[slot] : 1.2;
        if (WIDE_SLOTS.has(slot)) w *= pmods.wingBiasMult; // Out Wide / Overload lean on wide play
        // Overlap-minded managers specifically push their full-backs
        // higher up the passing picture, on top of the general wide bias.
        if ((slot === 'RB' || slot === 'LB' || slot === 'RWB' || slot === 'LWB') && pmods.overlapBias != null) {
          w *= 0.8 + pmods.overlapBias * 0.5;
        }
        return { p, w };
      });
      const totalW = weighted.reduce((s, x) => s + x.w, 0) || 1;
      let cornersWon = 0;
      weighted.forEach(({ p, w }) => {
        const raw = vol * (w / totalW);
        const count = Math.floor(raw) + (seededRandom() < (raw - Math.floor(raw)) ? 1 : 0);
        if (count <= 0) return;
        if (!m.playerMatchStats[p.id]) m.playerMatchStats[p.id] = blankPlayerMatchStats(p);
        const ps = m.playerMatchStats[p.id];
        const slot = p.slot || (p.pos || [])[0] || 'CM';
        // Split this player's volume into ground vs. lofted passes and give
        // each its own success rate — low_pass and lofted_pass now
        // genuinely measure different things instead of being averaged
        // away into one blended "passing" number. A wide/crossing-heavy
        // role attempts far more lofted balls than a deep-lying mid does,
        // so the *same* lofted_pass rating pays off far more for a winger
        // than for a CDM who barely ever needs it.
        const loftedShare = LOFTED_PASS_SHARE[slot] != null ? LOFTED_PASS_SHARE[slot] : 0.22;
        const loftedCount = Math.round(count * loftedShare);
        const groundCount = count - loftedCount;
        const groundSkill = groundPassingAbility(p) / 100;
        const loftedSkill = aerialPassingAbility(p) / 100;
        // Base rates eased ~3.5 points: league-wide completion was landing near 89%
        // against roughly 84-86% in the real top flights.
        let groundRate = Math.min(0.97, Math.max(0.55, 0.645 + groundSkill * 0.30));
        let loftedRate = Math.min(0.94, Math.max(0.42, 0.53 + loftedSkill * 0.34));
        if (tac === 'press') { groundRate -= 0.03; loftedRate -= 0.03; }
        if (tac === 'attack') { groundRate -= 0.012; loftedRate -= 0.018; }
        groundRate = Math.min(0.97, Math.max(0.4, groundRate + pmods.passAccDelta));
        loftedRate = Math.min(0.94, Math.max(0.3, loftedRate + pmods.passAccDelta));
        let completed = 0, loftedCompleted = 0;
        for (let i = 0; i < groundCount; i++) { if (seededRandom() < groundRate) completed++; }
        for (let i = 0; i < loftedCount; i++) { if (seededRandom() < loftedRate) { completed++; loftedCompleted++; } }
        ps.passes = (ps.passes || 0) + count;
        ps.passesCompleted = (ps.passesCompleted || 0) + completed;
        // Long balls: the real per-player lofted-pass share this model
        // already computes above (role/skill-driven, not a flat guess) —
        // previously worked out here and then thrown away, with the stat
        // sheet showing an unrelated random figure instead.
        ps.longBalls = (ps.longBalls || 0) + loftedCompleted;
        team.stats.passes = (team.stats.passes || 0) + count;
        team.stats.passesCompleted = (team.stats.passesCompleted || 0) + completed;
        // Crosses: wide players and full-backs deliver most. Most are cleared, intercepted or overhit; a fair share of the
        // cleared ones go behind for a corner.
        const crossRate = CROSS_PER_PASS[slot] || 0;
        if (crossRate) {
          let crossAtt = 0;
          for (let i = 0; i < count; i++) { if (seededRandom() < crossRate) crossAtt++; }
          if (crossAtt) {
            ps.crosses = (ps.crosses || 0) + crossAtt;
            for (let i = 0; i < crossAtt; i++) { if (seededRandom() < 0.2) cornersWon++; }
          }
        }
        if (side === 'home') homeCompletedMin += completed; else awayCompletedMin += completed;
      });
      // Balls in behind the line: a forward gambles on the run and the
      // pass, and the flag goes up on a share of them. Only the through-
      // ball chances that became shots were judged for offside before
      // (~0.4 flags a match against ~3-4 in the real thing); this judges
      // the many runs that never produced a shot, through the same
      // spatial model (engine/offside.js), so the flags follow the defensive
      // line, pace and awareness rather than a flat roll.
      const runP = 0.125 * (tac === 'attack' ? 1.2 : tac === 'defend' ? 0.75 : tac === 'press' ? 0.9 : 1);
      if (seededRandom() < runP) {
        const runner = pickPlayerWeighted(team, ['ST', 'RW', 'LW', 'CAM'], GOAL_ROLE_WEIGHT);
        if (runner) checkLiveOffside(side, runner, 'throughball', true); // quiet: a 'tight call, play on' line for every background run would flood the feed
      }
      for (let i = 0; i < cornersWon; i++) resolveCorner(side);
    });
    return { homeCompletedMin, awayCompletedMin };
  }
/*@CHUNK:c0204b:END*/

/*@CHUNK:c0206:START*/

  // ---- Attribute-driven ability reads (expanded sheet first, generic
  // derived stat as fallback) that feed every stage of the pipeline below.
/*@CHUNK:c0206:END*/

/*@CHUNK:cpass01:START*/
  // Ground-pass-specific ability — short/medium passing along the deck
  // (through balls, build-up, short link-up). Reads low_pass + ball_con
  // (first touch to set the pass up) + tight_pos (composure to play it
  // under close pressure), deliberately excluding lofted_pass/curl so a
  // genuine ground-passing specialist and a genuine crosser read as
  // different players even at the same blended `tec`.
  function groundPassingAbility(p) {
    if (p && p.expandedAttrs) {
      const vals = [xattr(p, 'low_pass', null), xattr(p, 'ball_con', null), xattr(p, 'tight_pos', null)].filter((v) => v != null);
      const base = vals.length
        ? curvedAttr(vals.reduce((a, b) => a + b, 0) / vals.length, 70)
        : (curvedAttr(p.tec || 70, 70) * 0.65 + curvedAttr(p.ovr || 75, 75) * 0.35);
      return base * staminaMultiplier(p) * conditionMultiplier(p);
    }
    return (curvedAttr(p.tec || 70, 70) * 0.65 + curvedAttr(p.ovr || 75, 75) * 0.35) * staminaMultiplier(p) * conditionMultiplier(p);
  }
/*@CHUNK:cpass01:END*/

/*@CHUNK:cpass02:START*/
  // Aerial/lofted-pass-specific ability — crosses, switches of play, long
  // diagonals. Reads lofted_pass + curl (the whip/bend on a delivery),
  // separate from groundPassingAbility above.
  function aerialPassingAbility(p) {
    if (p && p.expandedAttrs) {
      const vals = [xattr(p, 'lofted_pass', null), xattr(p, 'curl', null)].filter((v) => v != null);
      const base = vals.length
        ? curvedAttr(vals.reduce((a, b) => a + b, 0) / vals.length, 70)
        : (curvedAttr(p.tec || 70, 70) * 0.6 + curvedAttr(p.ovr || 75, 75) * 0.4);
      return base * staminaMultiplier(p) * conditionMultiplier(p);
    }
    return (curvedAttr(p.tec || 70, 70) * 0.6 + curvedAttr(p.ovr || 75, 75) * 0.4) * staminaMultiplier(p) * conditionMultiplier(p);
  }
/*@CHUNK:cpass02:END*/

/*@CHUNK:c0207:START*/
  function passingAbility(p) {
    // Big Occasion Flop: passing accuracy (not just shooting, which is
    // Fragile's domain in shooting.js) drops under stakes — same
    // computeStakes gate as Big-Game/Fragile/Ice-Cold/Bottler.
    let bigOccasionMult = 1;
    if (p && p.expandedAttrs && ((p.expandedAttrs.personality) || []).includes('Big Occasion Flop')) {
      const m = currentMatch;
      if (m && computeStakes(m.home.team, m.away.team, currentSeasonComp || tournament, m.minute, m.home.score - m.away.score)) {
        bigOccasionMult = 0.88;
      }
    }
    if (p && p.expandedAttrs) {
      const vals = [p.expandedAttrs.low_pass, p.expandedAttrs.lofted_pass, p.expandedAttrs.ball_con, p.expandedAttrs.tight_pos].filter(v => typeof v === 'number');
      const base = vals.length
        ? curvedAttr(vals.reduce((a, b) => a + b, 0) / vals.length, 70)
        : (curvedAttr(p.tec || 70, 70) * 0.65 + curvedAttr(p.ovr || 75, 75) * 0.35);
      let bonus = 0;
      if (hasSkill(p, 'Through Passing')) bonus += 2.5;
      if (hasSkill(p, 'Weighted Pass')) bonus += 2;
      if (hasSkill(p, 'Outside Curler')) bonus += 1.5;
      if (hasSkill(p, 'Low Lofted Pass')) bonus += 1.5;
      if (hasSkill(p, 'One Touch Pass')) bonus += 2;
      if (hasSkill(p, 'Heel Trick')) bonus += 1;
      if (hasSkill(p, 'No Look Pass')) bonus += 1;
      if (hasSkill(p, 'Rabona')) bonus += 1;
      if (hasSkill(p, 'Phenomenal Pass')) bonus += 2.5;
      if (hasSkill(p, 'Visionary Pass')) bonus += 2;
      if (hasSkill(p, 'Pinpoint Crossing') || hasSkill(p, 'Edged Crossing')) bonus += 1.5;
      // Game-Changing Pass: sharper distribution specifically when this
      // player's team needs to force the issue — drawing or losing in the
      // second half.
      if (hasSkill(p, 'Game-Changing Pass') && playerTeamTrailingOrDrawingSecondHalf(p)) bonus += 3;
      if (isActingSuperSub(p)) bonus += 2;
      return (base + bonus) * staminaMultiplier(p) * conditionMultiplier(p) * bigOccasionMult;
    }
    return (curvedAttr(p.tec || 70, 70) * 0.65 + curvedAttr(p.ovr || 75, 75) * 0.35) * conditionMultiplier(p) * bigOccasionMult;
  }
/*@CHUNK:c0207:END*/

/*@CHUNK:c0209:START*/
  function carryingAbility(p) {
    if (p && p.expandedAttrs) {
      // Physical Contact now feeds this too — shrugging off a challenge
      // while running with the ball is as much about holding your ground
      // physically as it is about balance/close control.
      const vals = [p.expandedAttrs.dribb, p.expandedAttrs.ball_con, p.expandedAttrs.bal, p.expandedAttrs.spd, p.expandedAttrs.phy_con].filter(v => typeof v === 'number');
      const base = vals.length
        ? curvedAttr(vals.reduce((a, b) => a + b, 0) / vals.length, 70)
        : (curvedAttr(p.tec || 70, 70) * 0.5 + curvedAttr(p.pac || 70, 70) * 0.3 + curvedAttr(p.ovr || 75, 75) * 0.2);
      let bonus = 0;
      if (hasSkill(p, 'Momentum Dribbling')) bonus += 2.5;
      if (hasSkill(p, 'Magnetic Feet')) bonus += 2.5;
      if (hasSkill(p, 'Acceleration Burst')) bonus += 2;
      if (hasSkill(p, 'Attacking Surge')) bonus += 1.5;
      if (isActingSuperSub(p)) bonus += 1.5;
      return (base + bonus) * staminaMultiplier(p) * conditionMultiplier(p);
    }
    return (curvedAttr(p.tec || 70, 70) * 0.5 + curvedAttr(p.pac || 70, 70) * 0.3 + curvedAttr(p.ovr || 75, 75) * 0.2) * conditionMultiplier(p);
  }
/*@CHUNK:c0209:END*/

/*@CHUNK:c0214:START*/

  // ===== Chance Creation phase (the sequence has reached the final third) =====
  // What kind of chance gets created is shaped by the entry channel and the
  // ball-carrier's/team's playstyle — a wide entry with a Cross Specialist
  // becomes a cross for an aerial target; an Inside Forward cuts in and
  // shoots himself; a central entry through a Creative Playmaker becomes a
  // defence-splitting through ball.
/*@CHUNK:c0214:END*/

/*@CHUNK:c0215:START*/
  function resolveChanceCreation(attackingSide, defendingSide, carrier, channel, extraQualityBonus) {
    const m = currentMatch;
    if (!m) return;
    const attTeam = m[attackingSide], defTeam = m[defendingSide];
    const wide = channel !== 'C';
    const tacSelf = (m.tactics && m.tactics[attackingSide]) || 'balanced';
    const tacOpp = (m.tactics && m.tactics[defendingSide]) || 'balanced';
    const mods = getPlaystyleMods(attTeam.team);

    // ===== Decision phase: the ball has reached the final third — what does =====
    // ===== the carrier actually try with it? Shoot himself, cross for a
    // target, thread a through ball, take a man on, or simply lay it off
    // instead of forcing a bad chance? Weighted on the carrier's own
    // attributes/playstyle plus the team's tactical stance, same as the
    // mid-pitch decision in runPossessionSequence().
    const marker = pickMarker(defTeam, mirrorDefenderPos('ATT_' + channel), null, mirrorZoneKey('ATT_' + channel));
    if (marker) bumpExtStat(marker, 'pressures', 1);
    const decision = decideBallAction(carrier, marker, 'ATT_' + channel, tacSelf, tacOpp, mods,
      ['shoot', 'cross', 'throughball', 'dribble', 'pass']);

    let chanceType, shooter;
    switch (decision.action) {
      case 'dribble':
        chanceType = 'dribble'; shooter = carrier;
        // A take-on that goes all the way to a shot himself — a genuine,
        // successful dribble/carry into the box.
        bumpExtStat(carrier, 'carries', 1);
        bumpExtStat(carrier, 'progressiveCarries', 1);
        bumpExtStat(carrier, 'dribbles', 1);
        bumpExtStat(carrier, 'successfulDribbles', 1);
        break;
      case 'cross': {
        // A manager whose DNA leans toward cutbacks trades some of his
        // wide deliveries for a low pull-back to an arriving midfielder
        // instead of a ball into the box for an aerial target — a
        // genuinely distinct chance type (no header, sharper look at
        // goal) rather than just a reskinned cross.
        const cutbackChance = wide ? Math.max(0.06, Math.min(0.55, 0.16 * (mods.cutbackBias || 1))) : 0;
        if (seededRandom() < cutbackChance) {
          chanceType = 'cutback';
          shooter = pickPlayerWeighted(attTeam, ['CAM', 'CM', 'ST', 'RW', 'LW'], GOAL_ROLE_WEIGHT, carrier.id);
        } else {
          chanceType = 'cross';
          bumpExtStat(carrier, 'crosses', 1);
          // aerialSkill(p) * 2 used to decide the cross target almost purely on
          // heading ability, regularly passing over a team's actual first-choice
          // striker in the box for a better header elsewhere on the pitch. A
          // GOAL_ROLE_WEIGHT term (favors ST/CAM/wide — see possession.js) is
          // blended in alongside it so a striker's natural spot to attack a
          // cross from still counts for something, not just who jumps best.
          shooter = pickPlayerCustomWeighted(attTeam, ['ST', 'CB', 'CAM', 'CM'],
            (p) => aerialSkill(p) * 1.3 + (GOAL_ROLE_WEIGHT[p.slot || (p.pos || [])[0]] || 0.5) * 0.5, carrier.id)
            || pickPlayerWeighted(attTeam, ['ST', 'CAM'], GOAL_ROLE_WEIGHT, carrier.id);
        }
        break;
      }
      case 'throughball':
        chanceType = 'throughball';
        bumpExtStat(carrier, 'throughBalls', 1);
        shooter = pickPlayerWeighted(attTeam, ['ST', 'CAM', 'RW', 'LW'], GOAL_ROLE_WEIGHT, carrier.id);
        break;
      case 'pass':
        // Opts to recycle rather than force a low-quality look — the chance
        // fizzles out safely instead of every final-third entry ending in a shot.
        addEvent(m.minute, 'pass', `<span class="player">${carrier.name}</span> pulls it back rather than force it`, attackingSide);
        // Sustained pressure that doesn't yield a shot still forces the
        // odd clearance behind.
        if (seededRandom() < 0.2) resolveCorner(attackingSide);
        return;
      case 'shoot':
      default:
        chanceType = wide ? 'openplay' : (seededRandom() < 0.3 ? 'longshot' : 'openplay');
        shooter = chanceType === 'longshot' ? carrier
          : pickPlayerWeighted(attTeam, ['ST', 'RW', 'LW', 'CAM', 'CM', 'RM', 'LM'], GOAL_ROLE_WEIGHT, carrier.id);
        break;
    }
    if (!shooter) shooter = carrier;

    // Extra chance-quality edge from the carrier's own passing/crossing
    // flair on this specific delivery — on top of whatever the eventual
    // shooter brings to the shot itself (see finishingEdge et al).
    let creationQualityBonus = extraQualityBonus || 0;
    if (hasSkill(carrier, 'Visionary Pass') || hasSkill(carrier, 'Phenomenal Pass')) creationQualityBonus += 0.03;
    if (chanceType === 'cross' && (hasSkill(carrier, 'Pinpoint Crossing') || hasSkill(carrier, 'Edged Crossing'))) creationQualityBonus += 0.04;
    // Even without a naming crossing skill, a carrier with a genuinely
    // strong Lofted Pass rating still delivers a sharper cross than one
    // who doesn't — the raw attribute matters on top of the skill tags.
    if (chanceType === 'cross') creationQualityBonus += ((xattr(carrier, 'lofted_pass', 70) - 70) / 100) * 0.03;
    if (hasSkill(carrier, 'No Look Pass') || hasSkill(carrier, 'Heel Trick') || hasSkill(carrier, 'Rabona')) creationQualityBonus += 0.015;
    // A through ball/cutback that actually arrives at a runner in the
    // half-space (not central, not pinned to the touchline — see
    // engine/spatialModel.js::halfSpaceOf()) is a genuinely sharper angle
    // on goal than the same delivery to a central or wide-on-the-line
    // teammate.
    if ((chanceType === 'throughball' || chanceType === 'cutback') && shooter) {
      const shooterHs = halfSpaceOf(shooter);
      if (shooterHs === 'halfSpaceLeft' || shooterHs === 'halfSpaceRight') creationQualityBonus += 0.03;
    }

    // A through ball is a genuine forward pass into space beyond the
    // defence — the one chance type actively judged for offside before the
    // shot ever happens. A flag here stops the passage immediately, the
    // same as an assistant referee raising it in real time: no shot, no
    // advantage played.
    if (chanceType === 'throughball') {
      const offsideResult = checkLiveOffside(attackingSide, shooter, 'throughball');
      if (offsideResult && offsideResult.offside) return;
    }

    attTeam.stats.shots++;
    if (!m.playerMatchStats) m.playerMatchStats = {};
    if (!m.playerMatchStats[shooter.id]) m.playerMatchStats[shooter.id] = blankPlayerMatchStats(shooter);
    m.playerMatchStats[shooter.id].shots++;
    // A key pass is exactly this: the carrier found a different player who
    // went on to actually shoot — the same condition that already governs
    // whether an eventual goal here also earns the carrier an assist.
    if (shooter.id !== carrier.id) bumpExtStat(carrier, 'keyPasses', 1);
    resolveShot(attackingSide, defendingSide, shooter, chanceType, { assistCandidate: shooter.id !== carrier.id ? carrier : null, qualityBonus: creationQualityBonus, marker: marker });
  }
/*@CHUNK:c0215:END*/
