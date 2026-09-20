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
    const urgent = m && (m.dispMin != null ? m.dispMin : m.minute) >= 75 && diff < 0;
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
    // Close-range effort calls for the Short Free Kick specialist; a
    // longer-distance dead ball calls for the Long Free Kick specialist
    // (more Kicking Power / Lofted Pass in the formula). Falls back to the
    // generic weighted pick if the designated taker isn't on the pitch.
    const onPitchIds = attackingSide === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const designatedTaker = attTeam.roles && (closeRange ? attTeam.roles.shortFreeKick : attTeam.roles.longFreeKick);
    const taker = (designatedTaker && onPitchIds.includes(designatedTaker.id))
      ? designatedTaker
      : pickPlayer(attTeam, ['CAM', 'CM', 'ST', 'RW', 'LW']);
    if (!taker) return;
    if (!m.playerMatchStats) m.playerMatchStats = {};
    const routine = pickFreeKickRoutine(attTeam, closeRange);

    if (routine === 'direct' || routine === 'quickrestart') {
      const quick = routine === 'quickrestart';
      attTeam.stats.shots++;
      if (!m.playerMatchStats[taker.id]) m.playerMatchStats[taker.id] = blankPlayerMatchStats(taker);
      m.playerMatchStats[taker.id].shots++;
      const fkGk = activeGoalkeeper(defendingSide);
      addEvent(m.minute, 'shot', quick
        ? `<span class="player">${taker.name}</span> takes it quickly — the defence isn't set!`
        : `<span class="player">${taker.name}</span> stands over the free-kick...`, attackingSide);
      // A quick restart catches an unorganised wall — a genuinely better
      // sight of goal than a fully set-up direct effort. Set-Piece
      // Specialist stacks its own composure boost on top, always on (no
      // stakes gate, unlike Ice-Cold/Bottler in pickFkOutcome itself).
      const spBoost = ((taker.expandedAttrs && taker.expandedAttrs.personality) || []).includes('Set-Piece Specialist') ? 0.05 : 0;
      const fk = pickFkOutcome(taker, fkGk, (quick ? 0.08 : 0) + spBoost);
      if (fk.scored) {
        attTeam.stats.shotsOn++;
        attTeam.score++;
        recordStat('goals', taker, attTeam.team);
        m.playerMatchStats[taker.id].goals++;
        m.playerMatchStats[taker.id].xg += 0.12 + seededRandom() * 0.1;
        pushGoal(attackingSide, taker, m.minute, fk.text);
        addEvent(m.minute, 'goal', `${emojiImg('goal', 'Goal')} Free-kick goal! <span class="player">${taker.name}</span> — ${fk.text}`, attackingSide, true);
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
        // Same designated-target boost as resolveCorner() (engine/
        // shooting.js) — this delivery is functionally a corner, so the
        // players actually pushed forward and stationed for exactly this
        // situation should be the ones more likely to get on the end of
        // it, not just whoever has the single highest aerial rating on
        // the roster regardless of where they're tactically posted.
        const scorer = pickPlayerCustomWeighted(attTeam, ['ST', 'CB', 'CAM'], (p) => aerialSkill(p, false) * 2 * aerialTargetBoost(attTeam, p.id), taker.id);
        if (scorer) {
          attTeam.stats.shots++;
          if (!m.playerMatchStats[scorer.id]) m.playerMatchStats[scorer.id] = blankPlayerMatchStats(scorer);
          if (!m.playerMatchStats[taker.id]) m.playerMatchStats[taker.id] = blankPlayerMatchStats(taker);
          m.playerMatchStats[scorer.id].shots++;
          // Getting on the end of the delivery only earns a shot on goal —
          // it still has to beat the keeper, the same fix already applied
          // to the equivalent corner routine (resolveCorner, engine/
          // shooting.js). This used to credit the goal the instant
          // crossChance succeeded, with no goalkeeper anywhere in the
          // pipeline — a free-kick delivery run as its own separate goal
          // engine instead of through the shared save resolution every
          // other chance in the match goes through.
          const gk = activeGoalkeeper(defendingSide);
          const shotQuality = Math.max(0.05, Math.min(0.98, aerialSkill(scorer, false)));
          if (gk) bumpExtStat(gk, 'psxg', +(0.22 + shotQuality * 0.15).toFixed(3));
          const saveResult = resolveGkSave(gk, scorer, shotQuality, { isHeader: true, closeRange: false, chanceType: 'cross' });
          m.playerMatchStats[scorer.id].xg += 0.22 + seededRandom() * 0.15;
          if (saveResult.saved) {
            attTeam.stats.shotsOn++;
            if (gk) {
              defTeam.stats.saves++;
              recordStat('saves', gk, defTeam.team);
              if (!m.playerMatchStats[gk.id]) m.playerMatchStats[gk.id] = blankPlayerMatchStats(gk);
              m.playerMatchStats[gk.id].saves = (m.playerMatchStats[gk.id].saves || 0) + 1;
              addEvent(m.minute, 'save', `🧤 Free-kick delivery met by <span class="player">${scorer.name}</span> — ${saveResult.saveType === 'catch' ? pickCatchDesc(gk, scorer) : pickSaveDesc(gk, scorer)}`, attackingSide);
            } else {
              addEvent(m.minute, 'miss', `Free-kick delivery met by <span class="player">${scorer.name}</span> but it drifts off target`, attackingSide);
            }
            return;
          }
          attTeam.stats.shotsOn++;
          attTeam.score++;
          recordStat('goals', scorer, attTeam.team);
          recordStat('assists', taker, attTeam.team);
          m.playerMatchStats[scorer.id].goals++;
          m.playerMatchStats[taker.id].assists++;
          m.playerMatchStats[taker.id].xa += 0.2 + seededRandom() * 0.3;
          // Same reasoning as the corner routine in resolveCorner()
          // (engine/shooting.js): a converted free-kick delivery is a
          // clear-cut chance for whoever heads it home, so the taker's
          // Big Chances Created should move with the assist instead of
          // being left at 0 for a set-piece-heavy creator.
          bumpExtStat(taker, 'bigChancesCreated', 1);
          pushGoal(attackingSide, scorer, m.minute, 'header from a direct free-kick');
          addEvent(m.minute, 'goal', `Free-kick delivery converted. <span class="player">${scorer.name}</span> heads home`, attackingSide, true);
        }
      } else {
        // Delivery defended — a crowded box gives a sliver of a chance
        // someone in white/red/blue turns it into his own net instead.
        const ogCulprit = pickPlayerCustomWeighted(defTeam, ['CB', 'CDM'], (p) => aerialSkill(p, true) * 2);
        maybeOwnGoal(attackingSide, defendingSide, ogCulprit, 'turns the free-kick delivery into his own net', 0.006);
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
    // Indirect free-kicks can't be shot straight in, so the taker rolls it
    // to a team-mate whenever one's available — that team-mate, not the
    // taker, is the one who actually strikes it. Crediting the shot to
    // the taker regardless meant he racked up a "shot" on his stat line
    // even on the passages where he never took one.
    const layoff = pickPlayer(attTeam, ['CM', 'CAM', 'ST'], taker.id);
    const effectiveShooter = layoff || taker;
    attTeam.stats.shots++;
    if (!m.playerMatchStats[effectiveShooter.id]) m.playerMatchStats[effectiveShooter.id] = blankPlayerMatchStats(effectiveShooter);
    m.playerMatchStats[effectiveShooter.id].shots++;
    if (seededRandom() < 0.18) {
      const scorer = effectiveShooter;
      // Beating the wall only earns a shot on target — it still has to get
      // past the keeper, the same fix already applied to the equivalent
      // corner and free-kick-crossing routines. This used to credit the
      // goal outright with no goalkeeper anywhere in the pipeline.
      const gk = activeGoalkeeper(defendingSide);
      const shotQuality = Math.max(0.05, Math.min(0.98, finishingEdge(scorer) + positioningEdge(scorer) + 0.6));
      if (gk) bumpExtStat(gk, 'psxg', +(0.18 + shotQuality * 0.15).toFixed(3));
      const saveResult = resolveGkSave(gk, scorer, shotQuality, { closeRange: false, chanceType: 'freekick' });
      if (!m.playerMatchStats[scorer.id]) m.playerMatchStats[scorer.id] = blankPlayerMatchStats(scorer);
      m.playerMatchStats[scorer.id].xg += 0.18 + seededRandom() * 0.1;
      if (saveResult.saved) {
        if (gk) {
          defTeam.stats.saves++;
          recordStat('saves', gk, defTeam.team);
          if (!m.playerMatchStats[gk.id]) m.playerMatchStats[gk.id] = blankPlayerMatchStats(gk);
          m.playerMatchStats[gk.id].saves = (m.playerMatchStats[gk.id].saves || 0) + 1;
          addEvent(m.minute, 'save', `🧤 First-time strike from <span class="player">${scorer.name}</span> — ${saveResult.saveType === 'catch' ? pickCatchDesc(gk, scorer) : pickSaveDesc(gk, scorer)}`, attackingSide);
        } else {
          addEvent(m.minute, 'miss', `First-time strike from <span class="player">${scorer.name}</span> drifts off target`, attackingSide);
        }
        return;
      }
      attTeam.stats.shotsOn++;
      attTeam.score++;
      recordStat('goals', scorer, attTeam.team);
      if (scorer !== taker) {
        recordStat('assists', taker, attTeam.team);
        // Same reasoning as the other set-piece assist paths above: the
        // layoff that leads straight to a first-time finish is a
        // clear-cut chance, so it counts toward the taker's Big Chances
        // Created just like the assist does.
        bumpExtStat(taker, 'bigChancesCreated', 1);
      }
      m.playerMatchStats[scorer.id].goals++;
      pushGoal(attackingSide, scorer, m.minute, 'first-time strike from an indirect routine');
      addEvent(m.minute, 'goal', `${emojiImg('goal', 'Goal')} Worked short and finished! <span class="player">${scorer.name}</span> converts the indirect routine`, attackingSide, true);
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
        const oppTeam = m[oppSide];
        // Same designated-target boost as resolveCorner()/the free-kick
        // crossing routine above — a long throw is delivered into the
        // same kind of crowded box, so it should find the same tactically
        // posted aerial targets more often, not just whoever has the
        // highest raw heading stat regardless of where they're playing.
        const scorer = pickPlayerCustomWeighted(team, ['ST', 'CB', 'CDM'], (p) => aerialSkill(p, false) * 2 * aerialTargetBoost(team, p.id), thrower.id);
        // The flick-on still has to win the header against a marker, the
        // same aerial contest a long punt from a goal kick goes through
        // (see resolveGoalKick below) — previously this rolled straight
        // into a goal with no defender or goalkeeper anywhere in the way,
        // making it a far more direct route to goal than any other
        // set-piece delivery in the engine.
        const defender = pickPlayerCustomWeighted(oppTeam, ['CB', 'CDM'], (p) => aerialSkill(p, true) * 2);
        const wonHeader = scorer && (!defender || aerialSkill(scorer, false) + seededRandom() * 0.3 > aerialSkill(defender, true) + seededRandom() * 0.3);
        if (wonHeader) {
          if (!m.playerMatchStats) m.playerMatchStats = {};
          if (!m.playerMatchStats[scorer.id]) m.playerMatchStats[scorer.id] = blankPlayerMatchStats(scorer);
          team.stats.shots++;
          m.playerMatchStats[scorer.id].shots++;
          const gk = activeGoalkeeper(oppSide);
          const shotQuality = Math.max(0.05, Math.min(0.98, aerialSkill(scorer, false)));
          const saveResult = resolveGkSave(gk, scorer, shotQuality, { isHeader: true, closeRange: true, chanceType: 'cross' });
          m.playerMatchStats[scorer.id].xg += 0.16 + seededRandom() * 0.1;
          if (saveResult.saved) {
            team.stats.shotsOn++;
            if (gk) {
              oppTeam.stats.saves++;
              recordStat('saves', gk, oppTeam.team);
              if (!m.playerMatchStats[gk.id]) m.playerMatchStats[gk.id] = blankPlayerMatchStats(gk);
              m.playerMatchStats[gk.id].saves = (m.playerMatchStats[gk.id].saves || 0) + 1;
              addEvent(m.minute, 'save', `🧤 Long throw flick-on from <span class="player">${scorer.name}</span> — kept out by <span class="player">${gk.name}</span>`, side);
            } else {
              addEvent(m.minute, 'miss', `Long throw flick-on from <span class="player">${scorer.name}</span> — off target`, side);
            }
          } else {
            team.stats.shotsOn++; team.score++;
            recordStat('goals', scorer, team.team);
            m.playerMatchStats[scorer.id].goals++;
            pushGoal(side, scorer, m.minute, 'header from a long throw');
            addEvent(m.minute, 'goal', `${emojiImg('goal', 'Goal')} Long throw flick-on converted! <span class="player">${scorer.name}</span> heads home`, side, true);
          }
        } else if (defender) {
          addEvent(m.minute, 'whistle', `Long throw claimed by the defence — <span class="player">${defender.name}</span> heads it clear`, oppSide);
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
    const gk = activeGoalkeeper(side);
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
      // Same designated-target boost as the other deliveries above — a
      // long punt is the keeper's own version of finding a specific
      // aerial outlet, so it should favor whoever's actually the team's
      // go-to target in the air, not just the single best heading stat.
      const target = pickPlayerCustomWeighted(team, ['ST', 'CB'], (p) => aerialSkill(p, false) * 2 * aerialTargetBoost(team, p.id));
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
