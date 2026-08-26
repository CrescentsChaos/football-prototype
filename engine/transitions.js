/*@CHUNK:c0218:START*/

  // ===== Transitions phase: a fast break for the side that just won the ball =====
  // Skips the full zone-by-zone grind (the whole point of a counter is that
  // there isn't time for one) and goes almost straight to a shot, with a
  // quality/on-target bump reflecting the exposed, unset defence.
/*@CHUNK:c0218:END*/

/*@CHUNK:c0219:START*/
  function runFastBreak(breakingSide, otherSide) {
    const m = currentMatch;
    if (!m) return;
    const breakTeam = m[breakingSide];
    const shooter = pickPlayerWeighted(breakTeam, ['ST', 'RW', 'LW', 'CAM', 'CM'], GOAL_ROLE_WEIGHT);
    if (!shooter) return;
    addEvent(m.minute, 'pressure', `${breakTeam.team.short} break at real pace!`, breakingSide);
    resolveChanceCreation(breakingSide, otherSide, shooter, seededRandom() < 0.5 ? 'L' : (seededRandom() < 0.5 ? 'C' : 'R'));
  }
/*@CHUNK:c0219:END*/

/*@CHUNK:c0220:START*/

  // ===== Duels phase resolution: the ball has been lost (pass cut out, or =====
  // ===== beaten in a 1v1) — who wins it, and does it spring a transition?
/*@CHUNK:c0220:END*/

/*@CHUNK:c0221:START*/
  function resolveTurnover(attackingSide, defendingSide, contestedPlayer, winner, fromThird, toThird, kind) {
    const m = currentMatch;
    if (!m) return;
    const defTeam = m[defendingSide];
    const defenderPlayer = winner || pickPlayer(defTeam, mirrorDefenderPos(toThird + '_C'));
    if (!defenderPlayer) return;
    if (!m.playerMatchStats) m.playerMatchStats = {};
    if (!m.playerMatchStats[defenderPlayer.id]) m.playerMatchStats[defenderPlayer.id] = blankPlayerMatchStats(defenderPlayer);
    const ps = m.playerMatchStats[defenderPlayer.id];

    // A mistimed challenge trying to win the ball back becomes a foul.
    // Gamesmanship: the attacker being challenged is the one who's good at
    // winning free-kicks off contact, so a defender up against one commits
    // a few more fouls trying to dispossess them.
    const aggression = 1 + Math.max(0, (75 - (defenderPlayer.def || 70)) / 80) + Math.max(0, ((defenderPlayer.phy || 70) - 80) / 100);
    // Toned down from the original — real defenders concede far fewer
    // fouls per genuine challenge than this used to model, and the old
    // rate (combined with the independent secondary-event fouls below)
    // was producing far more cards/reds than a real match sees.
    let foulChance = 0.055 * aggression * (kind === 'duel' ? 1.15 : 0.6);
    if (contestedPlayer && hasSkill(contestedPlayer, 'Gamesmanship')) foulChance *= 1.2;
    if (seededRandom() < foulChance) {
      resolveFoul(defendingSide, attackingSide, defenderPlayer, contestedPlayer, toThird === 'ATT');
      return;
    }

    const roll = seededRandom();
    if (roll < 0.55) {
      ps.interceptions = (ps.interceptions || 0) + 1;
      ps.tackles = (ps.tackles || 0) + 1;
      defTeam.stats.interceptions = (defTeam.stats.interceptions || 0) + 1;
      if (seededRandom() < 0.4) {
        const flavor = styleFlavor(defenderPlayer, INTERCEPTION_FLAVOR);
        addEvent(m.minute, 'pass', flavor
          ? `<span class="player">${defenderPlayer.name}</span> (${defTeam.team.short}) ${flavor}.`
          : `Interception by <span class="player">${defenderPlayer.name}</span> (${defTeam.team.short}).`, defendingSide);
      }
    } else {
      ps.tackles = (ps.tackles || 0) + 1;
      if (seededRandom() < 0.4) {
        const flavor = styleFlavor(defenderPlayer, TACKLE_FLAVOR);
        addEvent(m.minute, 'tackle', flavor
          ? `<span class="player">${defenderPlayer.name}</span> ${flavor}`
          : `Strong challenge from <span class="player">${defenderPlayer.name}</span> (${defTeam.team.short}) wins it back.`, defendingSide);
      }
    }

    // ===== Transitions phase: does the side that just won it break quickly? =====
    const defMods = getPlaystyleMods(defTeam.team);
    const spaceFactor = fromThird === 'ATT' ? 1.3 : fromThird === 'MID' ? 1.0 : 0.55;
    // Acceleration Burst (explosive from a standing start) and Attacking
    // Surge (extra pace once the break is on into the opponent's half) both
    // make the player who's just won the ball more likely to actually spring
    // a fast break with it, on top of their raw pace.
    let counterSkillBonus = 0;
    if (hasSkill(defenderPlayer, 'Acceleration Burst')) counterSkillBonus += 0.03;
    if (hasSkill(defenderPlayer, 'Attacking Surge')) counterSkillBonus += 0.02;
    const counterProb = Math.max(0.03, Math.min(0.55, 0.08 * defMods.counterBonus * spaceFactor + ((defenderPlayer.pac || 70) - 70) / 320 + counterSkillBonus));
    if (seededRandom() < counterProb) runFastBreak(defendingSide, attackingSide);
  }
/*@CHUNK:c0221:END*/
