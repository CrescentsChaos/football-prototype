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
    // A break is a straight foot race against a retreating defence — once
    // it's already sprung (see the Acceleration-driven counterProb in
    // resolveTurnover), it's sustained top Speed that decides whether the
    // carrier actually outruns the defensive line to a better chance.
    const oppTeamData = m[otherSide];
    const oppPace = calcTeamStrength(oppTeamData).pac || 70;
    const speedEdge = Math.max(-0.05, Math.min(0.09,
      (xattr(shooter, 'spd', shooter.pac || 70) * staminaMultiplier(shooter) - oppPace) / 220));
    addEvent(m.minute, 'pressure', `${breakTeam.team.short} break at real pace!`, breakingSide);
    const breakChannel = seededRandom() < 0.5 ? 'L' : (seededRandom() < 0.5 ? 'C' : 'R');
    // A break goes straight at the exposed defence — the ball is already
    // effectively in the attacking third by the time it's sprung.
    setBallZone(breakingSide, 'ATT', breakChannel);
    resolveChanceCreation(breakingSide, otherSide, shooter, breakChannel, speedEdge);
  }
/*@CHUNK:c0219:END*/

/*@CHUNK:c0220:START*/

  // ===== Duels phase resolution: the ball has been lost (pass cut out, or =====
  // ===== beaten in a 1v1) — who wins it, and does it spring a transition?
/*@CHUNK:c0220:END*/

/*@CHUNK:c0221:START*/
  function resolveTurnover(attackingSide, defendingSide, contestedPlayer, winner, fromThird, toThird, kind, channel) {
    const m = currentMatch;
    if (!m) return;
    const defTeam = m[defendingSide];
    const defenderPlayer = winner || pickMarker(defTeam, mirrorDefenderPos(toThird + '_C'), null, mirrorZoneKey(toThird + '_C'));
    if (!defenderPlayer) return;
    // The ball just changed hands in defendingSide's own zone — mirror the
    // third (attacker's ATT is the defender's DEF, and vice versa) so the
    // live ball-location snapshot flips to the winning side's perspective.
    // Purely a rendering aid for ui/matchUI.js::renderPitch (see the note in
    // possession.js) — never read by the simulation itself.
    const mirroredThird = toThird === 'ATT' ? 'DEF' : toThird === 'DEF' ? 'ATT' : 'MID';
    setBallZone(defendingSide, mirroredThird, channel || 'C');
    // The zone label above is written from the winner's side and reuses the
    // attacker's channel label as-is, but the ball itself hasn't moved — it
    // is still where the attacker lost it — so its point is resolved from
    // the attacker's own zone instead (otherwise a wide turnover would
    // teleport the ball to the opposite touchline).
    m.ballPos = ballPointForZone(attackingSide, toThird, channel || 'C');
    if (!m.playerMatchStats) m.playerMatchStats = {};
    if (!m.playerMatchStats[defenderPlayer.id]) m.playerMatchStats[defenderPlayer.id] = blankPlayerMatchStats(defenderPlayer);
    const ps = m.playerMatchStats[defenderPlayer.id];

    // A mistimed challenge trying to win the ball back becomes a foul.
    // Gamesmanship: the attacker being challenged is the one who's good at
    // winning free-kicks off contact, so a defender up against one commits
    // a few more fouls trying to dispossess them.
    const aggression = foulProneness(defenderPlayer);
    // Toned down from the original — real defenders concede far fewer
    // fouls per genuine challenge than this used to model, and the old
    // rate (combined with the independent secondary-event fouls below)
    // was producing far more cards/reds than a real match sees.
    // The 'duel' kind used to carry an extra +15% surcharge on top of
    // aggression — but a duel win is exactly the outcome a defensive
    // midfielder/CB records far more often than any other position simply
    // by doing their job, so that surcharge landed almost entirely on
    // those positions and made high-aggression DMs disproportionately
    // likely to be flagged for a foul purely from winning the ball back.
    // Dropped to parity (1.0) so aggression alone — not the type of
    // contest a busy defensive position wins most often — drives the risk.
    let foulChance = 0.05 * aggression * (kind === 'duel' ? 1.0 : 0.6);
    if (contestedPlayer && hasSkill(contestedPlayer, 'Gamesmanship')) foulChance *= 1.2;
    // Cynical: a genuine "take one for the team" tactical foul specifically
    // to stop a break before it's sprung — gated to the same toThird ===
    // 'ATT' breakaway context that already unlocks a penalty shout below
    // (see nearBox in resolveFoul), not just any old duel. The card-side
    // discount for this same context lives in resolveFoul (engine/
    // referee.js), keyed off the 'breakaway' context tag passed below.
    const breakawayContext = toThird === 'ATT';
    const defenderPersonality = (defenderPlayer.expandedAttrs && defenderPlayer.expandedAttrs.personality) || [];
    if (breakawayContext && defenderPersonality.includes('Cynical')) foulChance *= 1.6;
    if (seededRandom() < foulChance) {
      resolveFoul(defendingSide, attackingSide, defenderPlayer, contestedPlayer, breakawayContext, false, breakawayContext ? 'breakaway' : null);
      return;
    }

    const roll = seededRandom();
    if (roll < 0.55) {
      // Interception and tackle are alternative outcomes of this same roll,
      // not two separate actions — crediting both here double-counted every
      // interception as a tackle too, inflating both the individual and
      // (via the interceptions/tackles totals the Defenders' Award sums in
      // ui/statisticsUI.js) the season-long defensive totals. Same fix
      // already applied to the equivalent off-ball roll in defending.js.
      ps.interceptions = (ps.interceptions || 0) + 1;
      defTeam.stats.interceptions = (defTeam.stats.interceptions || 0) + 1;
      if (seededRandom() < 0.4) {
        const flavor = styleFlavor(defenderPlayer, INTERCEPTION_FLAVOR);
        addEvent(m.minute, 'pass', flavor
          ? `<span class="player">${defenderPlayer.name}</span> (${defTeam.team.short}) ${flavor}.`
          : `Interception by <span class="player">${defenderPlayer.name}</span> (${defTeam.team.short}).`, defendingSide);
      }
    } else {
      ps.tackles = (ps.tackles || 0) + 1;
      // Team tackles for a normal tackle win — the interception branch
      // above already updates defTeam.stats.interceptions live; a tackle
      // win was only ever credited to the player, never the team.
      defTeam.stats.tackles = (defTeam.stats.tackles || 0) + 1;
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
    // Springing the break itself is about explosive acceleration from a
    // standing start, not sustained top speed — Acceleration is the
    // specific attribute for that first burst, so it (not the generic pac
    // blend) decides how likely the counter actually gets going.
    const burst = xattr(defenderPlayer, 'accel', defenderPlayer.pac || 70) * staminaMultiplier(defenderPlayer);
    // transitionSpeedMult (how quickly this manager's team turns a
    // regain into a break) and counterpressIntensity (how sharply they
    // react to winning the ball back at all) are individual DNA traits on
    // top of the broad counterBonus archetype nudge already folded into
    // defMods.counterBonus.
    const counterProb = Math.max(0.03, Math.min(0.6,
      0.08 * defMods.counterBonus * spaceFactor * (defMods.transitionSpeedMult || 1)
      + (burst - 70) / 300 + counterSkillBonus
      + ((defMods.counterpressIntensity != null ? defMods.counterpressIntensity : 0.5) - 0.5) * 0.06));
    if (seededRandom() < counterProb) runFastBreak(defendingSide, attackingSide);
  }
/*@CHUNK:c0221:END*/
