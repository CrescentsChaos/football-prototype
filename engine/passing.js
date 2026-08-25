/*@CHUNK:c0202:START*/

  // Simulates one minute of team passing for both sides: builds up real per-match
  // pass volume (300-1000+ per team), splits it across on-pitch players by role,
  // and gives each player their own completion (success) rate based on ability.
/*@CHUNK:c0202:END*/

/*@CHUNK:c0203:START*/
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
      if (m.minute > 60) {
        const diff = (team.score || 0) - (oppTeam.score || 0);
        if (diff <= -1) baseVol *= 1 + Math.min(0.18, Math.abs(diff) * 0.08);
        else if (diff >= 1) baseVol *= 1 - Math.min(0.1, diff * 0.04);
      }
      const vol = Math.max(1, baseVol * possShare);
      const weighted = onPitch.map(p => {
        const slot = p.slot || (p.pos || [])[0] || 'CM';
        let w = PASS_POS_WEIGHT[slot] != null ? PASS_POS_WEIGHT[slot] : 1.2;
        if (WIDE_SLOTS.has(slot)) w *= pmods.wingBiasMult; // Out Wide / Overload lean on wide play
        return { p, w };
      });
      const totalW = weighted.reduce((s, x) => s + x.w, 0) || 1;
      weighted.forEach(({ p, w }) => {
        const raw = vol * (w / totalW);
        const count = Math.floor(raw) + (seededRandom() < (raw - Math.floor(raw)) ? 1 : 0);
        if (count <= 0) return;
        if (!m.playerMatchStats[p.id]) m.playerMatchStats[p.id] = blankPlayerMatchStats(p);
        const ps = m.playerMatchStats[p.id];
        // Individual success rate: driven by technical ability + overall, nudged by tactic.
        const skill = ((p.tec || 70) * 0.55 + (p.ovr || 75) * 0.35 + (p.phy || 70) * 0.1) / 100;
        let succRate = Math.min(0.97, Math.max(0.52, 0.64 + skill * 0.34));
        if (tac === 'press') succRate -= 0.03;
        if (tac === 'attack') succRate -= 0.015;
        succRate = Math.min(0.97, Math.max(0.4, succRate + pmods.passAccDelta)); // manager playstyle nudge
        let completed = 0;
        for (let i = 0; i < count; i++) { if (seededRandom() < succRate) completed++; }
        ps.passes = (ps.passes || 0) + count;
        ps.passesCompleted = (ps.passesCompleted || 0) + completed;
        team.stats.passes = (team.stats.passes || 0) + count;
        team.stats.passesCompleted = (team.stats.passesCompleted || 0) + completed;
        if (side === 'home') homeCompletedMin += completed; else awayCompletedMin += completed;
      });
    });
    return { homeCompletedMin, awayCompletedMin };
  }
/*@CHUNK:c0203:END*/

/*@CHUNK:c0206:START*/

  // ---- Attribute-driven ability reads (expanded sheet first, generic
  // derived stat as fallback) that feed every stage of the pipeline below.
/*@CHUNK:c0206:END*/

/*@CHUNK:c0207:START*/
  function passingAbility(p) {
    if (p && p.expandedAttrs) {
      const vals = [p.expandedAttrs.low_pass, p.expandedAttrs.lofted_pass, p.expandedAttrs.ball_con, p.expandedAttrs.tight_pos].filter(v => typeof v === 'number');
      if (vals.length) return vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    return (p.tec || 70) * 0.65 + (p.ovr || 75) * 0.35;
  }
/*@CHUNK:c0207:END*/

/*@CHUNK:c0209:START*/
  function carryingAbility(p) {
    if (p && p.expandedAttrs) {
      const vals = [p.expandedAttrs.dribb, p.expandedAttrs.ball_con, p.expandedAttrs.bal, p.expandedAttrs.spd].filter(v => typeof v === 'number');
      if (vals.length) return vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    return (p.tec || 70) * 0.5 + (p.pac || 70) * 0.3 + (p.ovr || 75) * 0.2;
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
  function resolveChanceCreation(attackingSide, defendingSide, carrier, channel) {
    const m = currentMatch;
    if (!m) return;
    const attTeam = m[attackingSide];
    const styles = (carrier.expandedAttrs && carrier.expandedAttrs.playstyle) || [];
    const wide = channel !== 'C';
    const crossStyle = styles.some(s => ['Cross Specialist', 'Prolific Winger', 'Roaming Flank', 'Offensive Full-back', 'Full-back Finisher'].includes(s));
    const cutInStyle = styles.some(s => s === 'Inside Forward');
    const throughBallStyle = styles.some(s => ['Creative Playmaker', 'Classic No. 10', 'Orchestrator', 'Deep-Lying Forward'].includes(s));

    let chanceType, shooter;
    if (wide && cutInStyle && seededRandom() < 0.55) {
      chanceType = 'dribble'; shooter = carrier;
    } else if (wide && (crossStyle || seededRandom() < 0.55)) {
      chanceType = 'cross';
      shooter = pickPlayerCustomWeighted(attTeam, ['ST', 'CB', 'CAM', 'CM'], (p) => aerialSkill(p) * 2, carrier.id)
        || pickPlayerWeighted(attTeam, ['ST', 'CAM'], GOAL_ROLE_WEIGHT, carrier.id);
    } else if (!wide && throughBallStyle && seededRandom() < 0.5) {
      chanceType = 'throughball';
      shooter = pickPlayerWeighted(attTeam, ['ST', 'CAM', 'RW', 'LW'], GOAL_ROLE_WEIGHT, carrier.id);
    } else if (seededRandom() < 0.16) {
      chanceType = 'longshot'; shooter = carrier;
    } else {
      chanceType = 'openplay';
      shooter = pickPlayerWeighted(attTeam, ['ST', 'RW', 'LW', 'CAM', 'CM', 'RM', 'LM'], GOAL_ROLE_WEIGHT, carrier.id);
    }
    if (!shooter) shooter = carrier;

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
    resolveShot(attackingSide, defendingSide, shooter, chanceType, { assistCandidate: shooter.id !== carrier.id ? carrier : null });
  }
/*@CHUNK:c0215:END*/
