/*@CHUNK:csp01:START*/

  // ===================================================================
  // ================== FREE-KICK ROUTINES (open play) =================
  // ===================================================================
  // Replaces a single flat "stands over it and shoots" resolution with a
  // genuine choice of routine, shaped by where the foul happened, who's
  // around to take it, and the game state. Corners get equivalent
  // treatment in resolveCorner() (engine/shooting.js).
/*@CHUNK:csp01:END*/

/*@CHUNK:csp02:START*/
  function pickFreeKickRoutine(attTeam, closeRange) {
    const hasCrosser = (attTeam.squad.all || []).some(p => hasStyle(p, 'Cross Specialist') || hasStyle(p, 'Prolific Winger') || hasSkill(p, 'Pinpoint Crossing') || hasSkill(p, 'Edged Crossing'));
    const m = currentMatch;
    const diff = m ? (attTeam.score || 0) - (m[attTeam === m.home ? 'away' : 'home'].score || 0) : 0;
    const urgent = m && m.minute >= 75 && diff < 0;
    const roll = seededRandom();
    if (!closeRange) {
      // Too far out for a direct effort — always a delivery into the box
      // or a short recycle to reset the attack.
      return roll < 0.62 ? 'crossing' : 'short';
    }
    if (urgent && roll < 0.12) return 'quickrestart';
    if (roll < 0.38) return 'direct';
    if (roll < (hasCrosser ? 0.76 : 0.66)) return 'crossing';
    if (roll < 0.87) return 'short';
    return 'indirect';
  }
/*@CHUNK:csp02:END*/

/*@CHUNK:csp03:START*/
  function resolveFreeKickRoutine(attackingSide, defendingSide, closeRange) {
    const m = currentMatch;
    if (!m) return;
    const attTeam = m[attackingSide], defTeam = m[defendingSide];
    const taker = pickPlayer(attTeam, ['CAM', 'CM', 'ST', 'RW', 'LW']);
    if (!taker) return;
    if (!m.playerMatchStats) m.playerMatchStats = {};
    const routine = pickFreeKickRoutine(attTeam, closeRange);

    if (routine === 'direct' || routine === 'quickrestart') {
      const quick = routine === 'quickrestart';
      attTeam.stats.shots++;
      if (!m.playerMatchStats[taker.id]) m.playerMatchStats[taker.id] = blankPlayerMatchStats(taker);
      m.playerMatchStats[taker.id].shots++;
      const fkGk = pickPlayer(defTeam, ['GK']);
      addEvent(m.minute, 'shot', quick
        ? `<span class="player">${taker.name}</span> takes it quickly — the defence isn't set!`
        : `<span class="player">${taker.name}</span> stands over the free-kick...`, attackingSide);
      // A quick restart catches an unorganised wall — a genuinely better
      // sight of goal than a fully set-up direct effort.
      const fk = pickFkOutcome(taker, fkGk, quick ? 0.08 : 0);
      if (fk.scored) {
        attTeam.stats.shotsOn++;
        attTeam.score++;
        recordStat('goals', taker, attTeam.team);
        m.playerMatchStats[taker.id].goals++;
        m.playerMatchStats[taker.id].xg += 0.12 + seededRandom() * 0.1;
        pushGoal(attackingSide, taker, m.minute, fk.text);
        addEvent(m.minute, 'goal', `⚽ Free-kick goal! <span class="player">${taker.name}</span> — ${fk.text}`, attackingSide, true);
        if (seededRandom() < 0.55) recordStat('puskas', taker, attTeam.team);
        // The taker's own direct shot on goal, not a pass to a team-mate
        // beyond the defence — not an offside-eligible phase of play.
      } else if (fk.saved) {
        attTeam.stats.shotsOn++;
        if (fkGk) {
          defTeam.stats.saves++;
          recordStat('saves', fkGk, defTeam.team);
          if (!m.playerMatchStats[fkGk.id]) m.playerMatchStats[fkGk.id] = blankPlayerMatchStats(fkGk);
          m.playerMatchStats[fkGk.id].saves = (m.playerMatchStats[fkGk.id].saves || 0) + 1;
        }
        addEvent(m.minute, 'save', `🧤 Free-kick from <span class="player">${taker.name}</span> — ${fk.text}`, attackingSide);
      } else {
        addEvent(m.minute, 'miss', `Free-kick from <span class="player">${taker.name}</span> — ${fk.text}`, attackingSide);
        if (fk.wall) resolveCorner(attackingSide);
      }
      return;
    }

    if (routine === 'crossing') {
      // Whipped delivery into the box — resolved like a low-key corner
      // (aerial duel for a specific target), not a guaranteed chance.
      addEvent(m.minute, 'whistle', `<span class="player">${taker.name}</span> whips the free-kick into the box`, attackingSide);
      const crossChance = 0.075 + (hasSkill(taker, 'Pinpoint Crossing') || hasSkill(taker, 'Edged Crossing') ? 0.02 : 0);
      if (seededRandom() < crossChance) {
        const scorer = pickPlayerCustomWeighted(attTeam, ['ST', 'CB', 'CAM'], (p) => aerialSkill(p, false) * 2, taker.id);
        if (scorer) {
          attTeam.stats.shots++; attTeam.stats.shotsOn++; attTeam.score++;
          recordStat('goals', scorer, attTeam.team);
          recordStat('assists', taker, attTeam.team);
          if (!m.playerMatchStats[scorer.id]) m.playerMatchStats[scorer.id] = blankPlayerMatchStats(scorer);
          if (!m.playerMatchStats[taker.id]) m.playerMatchStats[taker.id] = blankPlayerMatchStats(taker);
          m.playerMatchStats[scorer.id].goals++;
          m.playerMatchStats[scorer.id].xg += 0.22 + seededRandom() * 0.15;
          m.playerMatchStats[taker.id].assists++;
          m.playerMatchStats[taker.id].xa += 0.2 + seededRandom() * 0.3;
          pushGoal(attackingSide, scorer, m.minute, 'header from a direct free-kick');
          addEvent(m.minute, 'goal', `Free-kick delivery converted. <span class="player">${scorer.name}</span> heads home`, attackingSide, true);
        }
      }
      return;
    }

    if (routine === 'short') {
      // Short link-up: lay it off to a nearby team-mate, who either shoots
      // from range or slips a genuine forward ball to a runner — the one
      // free-kick routine that's a real offside-eligible phase, since it
      // funnels through resolveChanceCreation() exactly like open play.
      const receiver = pickPlayer(attTeam, ['CM', 'CDM', 'CAM'], taker.id);
      if (!receiver) return;
      addEvent(m.minute, 'pass', `Short routine — <span class="player">${taker.name}</span> rolls it sideways to <span class="player">${receiver.name}</span>`, attackingSide);
      if (seededRandom() < 0.4) resolveChanceCreation(attackingSide, defendingSide, receiver, 'C');
      return;
    }

    // 'indirect' — given for an offence inside the area (offside, an
    // obstruction, or similar). Defenders are allowed to line up right on
    // their own goal-line for this one, so a first-time strike is far more
    // likely to cannon straight into a wall than beat it.
    addEvent(m.minute, 'whistle', `Indirect free-kick to ${attTeam.team.short} — defenders line up on their own goal-line`, attackingSide);
    attTeam.stats.shots++;
    if (!m.playerMatchStats[taker.id]) m.playerMatchStats[taker.id] = blankPlayerMatchStats(taker);
    m.playerMatchStats[taker.id].shots++;
    const layoff = pickPlayer(attTeam, ['CM', 'CAM', 'ST'], taker.id);
    if (seededRandom() < 0.18) {
      const scorer = layoff || taker;
      attTeam.stats.shotsOn++;
      attTeam.score++;
      recordStat('goals', scorer, attTeam.team);
      if (scorer !== taker) recordStat('assists', taker, attTeam.team);
      if (!m.playerMatchStats[scorer.id]) m.playerMatchStats[scorer.id] = blankPlayerMatchStats(scorer);
      m.playerMatchStats[scorer.id].goals++;
      m.playerMatchStats[scorer.id].xg += 0.18 + seededRandom() * 0.1;
      pushGoal(attackingSide, scorer, m.minute, 'first-time strike from an indirect routine');
      addEvent(m.minute, 'goal', `⚽ Worked short and finished! <span class="player">${scorer.name}</span> converts the indirect routine`, attackingSide, true);
    } else {
      addEvent(m.minute, 'miss', `Blocked by the wall on the line — the indirect routine breaks down`, attackingSide);
      if (seededRandom() < 0.5) resolveCorner(attackingSide);
    }
  }
/*@CHUNK:csp03:END*/

/*@CHUNK:csp04:START*/

  // ===================================================================
  // ========================= THROW-INS ================================
  // ===================================================================
  // Three genuine options: a normal throw upfield (can still spring an
  // attack), a long throw hurled straight into the box for a specialist
  // thrower, and a tactical retaining throw that just keeps possession
  // ticking over.
/*@CHUNK:csp04:END*/

/*@CHUNK:csp05:START*/
  function resolveThrowIn(side) {
    const m = currentMatch;
    if (!m) return;
    const team = m[side];
    const oppSide = side === 'home' ? 'away' : 'home';
    const thrower = pickPlayer(team, ['RB', 'LB', 'RWB', 'LWB', 'CB']);
    if (!thrower) return;
    const longThrowSpecialist = (thrower.phy || 70) >= 80 || hasStyle(thrower, 'Long Throw') || hasSkill(thrower, 'Long Throws');
    const roll = seededRandom();
    if (longThrowSpecialist && roll < 0.3) {
      addEvent(m.minute, 'whistle', `Long throw hurled into the box by <span class="player">${thrower.name}</span> (${team.team.short})`, side);
      const flickOnChance = 0.035 + (hasSkill(thrower, 'Long Throws') ? 0.01 : 0);
      if (seededRandom() < flickOnChance) {
        const scorer = pickPlayerCustomWeighted(team, ['ST', 'CB', 'CDM'], (p) => aerialSkill(p, false) * 2, thrower.id);
        if (scorer) {
          team.stats.shots++; team.stats.shotsOn++; team.score++;
          recordStat('goals', scorer, team.team);
          if (!m.playerMatchStats) m.playerMatchStats = {};
          if (!m.playerMatchStats[scorer.id]) m.playerMatchStats[scorer.id] = blankPlayerMatchStats(scorer);
          m.playerMatchStats[scorer.id].goals++;
          m.playerMatchStats[scorer.id].xg += 0.16 + seededRandom() * 0.1;
          pushGoal(side, scorer, m.minute, 'header from a long throw');
          addEvent(m.minute, 'goal', `⚽ Long throw flick-on converted! <span class="player">${scorer.name}</span> heads home`, side, true);
        }
      }
    } else if (roll < (longThrowSpecialist ? 0.55 : 0.7)) {
      addEvent(m.minute, 'pass', `${team.team.short} keep it simple — a short retaining throw down the line`, side);
    } else {
      const receiver = pickPlayer(team, ['CM', 'CAM', 'RM', 'LM', 'ST'], thrower.id);
      if (receiver && seededRandom() < 0.14) {
        resolveChanceCreation(side, oppSide, receiver, seededRandom() < 0.5 ? 'L' : 'R');
      } else {
        addEvent(m.minute, 'whistle', `${team.team.short} throw it long down the line`, side);
      }
    }
  }
/*@CHUNK:csp05:END*/

/*@CHUNK:csp06:START*/

  // ===================================================================
  // ========================= GOAL KICKS ================================
  // ===================================================================
  // Short rollout to build from the back (only for a keeper genuinely
  // comfortable on the ball and a side not sat in a defensive block),
  // a medium chip out to midfield, or a long punt contested in the air —
  // the aerial-duel case can spring a genuine second-ball chance.
/*@CHUNK:csp06:END*/

/*@CHUNK:csp07:START*/
  function resolveGoalKick(side) {
    const m = currentMatch;
    if (!m) return;
    const team = m[side];
    const oppSide = side === 'home' ? 'away' : 'home';
    const oppTeam = m[oppSide];
    const gk = pickPlayer(team, ['GK']);
    if (!gk) return;
    const tac = (m.tactics && m.tactics[side]) || 'balanced';
    // GK Low Punt sharpens exactly the short/medium distribution this
    // build-from-back check is gating, so a keeper with the skill can
    // credibly play out from the back even without elite raw tec.
    const buildFromBack = ((gk.tec || 70) >= 78 || hasSkill(gk, 'GK Low Punt')) && tac !== 'defend';
    const roll = seededRandom();
    if (!m.playerMatchStats) m.playerMatchStats = {};
    // GK Long Throws: an entirely separate, quicker distribution option
    // straight out of the keeper's hands to a winger, bypassing the
    // punt/rollout choice altogether.
    if (hasSkill(gk, 'GK Long Throws') && roll < 0.18) {
      addEvent(m.minute, 'whistle', `<span class="player">${gk.name}</span> skips the goal-kick and launches a long throw straight down the line`, side);
      if (!m.playerMatchStats[gk.id]) m.playerMatchStats[gk.id] = blankPlayerMatchStats(gk);
      m.playerMatchStats[gk.id].passes = (m.playerMatchStats[gk.id].passes || 0) + 1;
      m.playerMatchStats[gk.id].passesCompleted = (m.playerMatchStats[gk.id].passesCompleted || 0) + 1;
      const receiver = pickPlayer(team, ['RM', 'LM', 'RW', 'LW', 'CM']);
      if (receiver && seededRandom() < 0.16) resolveChanceCreation(side, oppSide, receiver, seededRandom() < 0.5 ? 'L' : 'R');
      return;
    }
    if (buildFromBack && roll < 0.4) {
      addEvent(m.minute, 'pass', `Short rollout from <span class="player">${gk.name}</span> — ${team.team.short} build from the back`, side);
      if (!m.playerMatchStats[gk.id]) m.playerMatchStats[gk.id] = blankPlayerMatchStats(gk);
      m.playerMatchStats[gk.id].passes = (m.playerMatchStats[gk.id].passes || 0) + 1;
      m.playerMatchStats[gk.id].passesCompleted = (m.playerMatchStats[gk.id].passesCompleted || 0) + 1;
    } else if (roll < 0.75) {
      addEvent(m.minute, 'pass', `<span class="player">${gk.name}</span> chips the goal-kick out to midfield`, side);
      // GK Low Punt: a genuinely well-placed medium ball occasionally
      // sticks well enough to spring an immediate chance.
      if (hasSkill(gk, 'GK Low Punt') && seededRandom() < 0.12) {
        const receiver = pickPlayer(team, ['CM', 'CAM'], gk.id);
        if (receiver) resolveChanceCreation(side, oppSide, receiver, 'C');
      }
    } else {
      const target = pickPlayerCustomWeighted(team, ['ST', 'CB'], (p) => aerialSkill(p, false) * 2);
      const defender = pickPlayerCustomWeighted(oppTeam, ['CB'], (p) => aerialSkill(p, true) * 2);
      // GK High Punt: a sharper, more accurate long punt gives the target a
      // genuinely better sight of winning the header, not just a coin-flip
      // against whoever the defence puts up.
      const puntEdge = hasSkill(gk, 'GK High Punt') ? 0.08 : 0;
      const won = target && (!defender || aerialSkill(target, false) + puntEdge + seededRandom() * 0.3 > aerialSkill(defender, true) + seededRandom() * 0.3);
      addEvent(m.minute, 'whistle', (won && target)
        ? `Long punt from <span class="player">${gk.name}</span> — <span class="player">${target.name}</span> wins the aerial duel`
        : `Long punt from <span class="player">${gk.name}</span> — ${oppTeam.team.short} win the header back`, side);
      if (won && target && seededRandom() < 0.1) {
        const receiver = pickPlayer(team, ['CAM', 'CM', 'RW', 'LW'], target.id);
        if (receiver) resolveChanceCreation(side, oppSide, receiver, 'C');
      }
    }
  }
/*@CHUNK:csp07:END*/
