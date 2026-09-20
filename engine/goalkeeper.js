/*@CHUNK:c0037:START*/
  // GK shot-stopping edges — each one reads a *distinct* goalkeeping
  // attribute for a distinct part of the save, instead of folding
  // gk_awr/gk_catch/gk_parry/gk_reflex/gk_reach into one blended number.
  // See resolveGkSave() below for how they combine into an actual save
  // decision (chance to save at all, then catch vs. parry vs. a rebound).
/*@CHUNK:c0037:END*/

/*@CHUNK:c0038:START*/
  function gkReflexEdge(gk) {
    if (!gk || !gk.expandedAttrs) return 0;
    // Curved around the keeper baseline (75) instead of a flat multiplier —
    // preserves the same ceiling at a 99 rating but a merely-good reflex
    // stat no longer buys nearly as much of it.
    let edge = curvedStat(xattr(gk, 'gk_reflex', 75), 75, 24, 1.6) * 0.12;
    if (hasSkill(gk, 'Acrobatic Clearance')) edge += 0.05;
    // A shot-stopping-first Defensive Goalkeeper reacts a touch sharper;
    // an Offensive Goalkeeper, whose game is built around sweeping and
    // distribution rather than pure reflexes, gives a little back here.
    edge += playstyleEdgeSum(gk, 'gkReflexEdge');
    return edge;
  }
/*@CHUNK:c0038:END*/

/*@CHUNK:c0041:START*/
  function penGkEdge(gk) {
    if (!gk || !gk.expandedAttrs) return 0;
    let edge = curvedStat(xattr(gk, 'gk_awr', 75), 75, 24, 1.6) * 0.036;
    if (hasSkill(gk, 'GK Penalty Saver')) edge += 0.10;
    return edge;
  }
/*@CHUNK:c0041:END*/

/*@CHUNK:cgk01:START*/
  // Positioning/anticipation — the baseline read on every single save
  // attempt regardless of shot type, since it's what puts the keeper in
  // the right spot before reflex/reach even come into it.
  function gkPositioningEdge(gk) {
    if (!gk || !gk.expandedAttrs) return 0;
    let edge = curvedStat(xattr(gk, 'gk_awr', 75), 75, 24, 1.6) * 0.096;
    if (hasSkill(gk, 'GK Directing Defense')) edge += 0.015;
    // An Offensive Goalkeeper's proactive sweeping/positioning is exactly
    // what this edge represents; a Defensive Goalkeeper trades a little of
    // it away to stay closer to the line.
    edge += playstyleEdgeSum(gk, 'gkPositioningEdge');
    return edge;
  }
/*@CHUNK:cgk01:END*/

/*@CHUNK:cgk02:START*/
  // Reach specifically covers shots placed toward the corners/edges of the
  // frame — the far post on a cross/header, or a well-placed effort from
  // distance — as opposed to a shot the keeper is already square-on to.
  function gkReachEdge(gk) {
    if (!gk || !gk.expandedAttrs) return 0;
    return curvedStat(xattr(gk, 'gk_reach', 75), 75, 24, 1.6) * 0.096;
  }
/*@CHUNK:cgk02:END*/

/*@CHUNK:cgk03:START*/
  // Once a shot is actually going to be kept out, gk_catch decides how
  // often that's a clean, secure take rather than needing to be parried
  // away — a stronger strike (higher shotPower) and a close-range effort
  // both make a clean catch harder to pull off.
  function gkCatchChance(gk, shotPower, closeRange) {
    if (!gk) return 0.4;
    const base = gk.expandedAttrs
      ? curvedAttr(xattr(gk, 'gk_catch', 65), 65, 34, 1.6) / 100
      : (curvedAttr(gk.def || 70, 70) * 0.6 + curvedAttr(gk.tec || 70, 70) * 0.4) / 100;
    let v = base - (shotPower || 0) * 0.28 - (closeRange ? 0.06 : 0);
    if (hasSkill(gk, 'GK Penalty Saver')) v += 0.02;
    return Math.max(0.06, Math.min(0.93, v));
  }
/*@CHUNK:cgk03:END*/

/*@CHUNK:cgk04:START*/
  // When a shot is parried rather than caught, gk_parry decides how
  // *safely* it's directed away — a specialist sends it well clear of
  // danger, a weaker one leaves a genuine rebound sitting up for someone
  // to attack. Returns the chance a dangerous rebound actually follows.
  function gkParryReboundDanger(gk) {
    if (!gk) return 0.16;
    const parry = gk.expandedAttrs
      ? curvedAttr(xattr(gk, 'gk_parry', 65), 65, 34, 1.6)
      : curvedAttr((gk.def || 70) * 0.5 + (gk.ovr || 75) * 0.5, 70);
    return Math.max(0.04, Math.min(0.32, 0.05 + (100 - parry) / 260));
  }
/*@CHUNK:cgk04:END*/

/*@CHUNK:cgk05:START*/
  // Full shot-stopping resolution for a shot that's already confirmed on
  // target. Replaces the old single flat "gkSkill" blend with attribute
  // reads tuned to the actual situation: reflexes matter most when there's
  // barely time to react (close range, headers), reach matters most when
  // the shot is genuinely placed away from the keeper's body (long range,
  // crosses/wide deliveries). Also fatigue-aware: a tired keeper reacts a
  // touch slower, same as any outfield attribute under this model.
  function resolveGkSave(gk, shooter, shotQuality, shotContext) {
    shotContext = shotContext || {};
    const isHeader = !!shotContext.isHeader;
    const closeRange = !!shotContext.closeRange;
    // A direct free-kick is judged like a longshot for reach purposes —
    // it's a placed, dead-ball effort from distance, the same situation
    // gk_reach is meant to represent, not a snap reaction at close range.
    const isLongRange = shotContext.chanceType === 'longshot' || shotContext.chanceType === 'freekick';
    const isCrossType = shotContext.chanceType === 'cross';
    const shotPower = shotContext.shotPower != null ? shotContext.shotPower : 0.5;
    const fatigueMult = gk ? staminaMultiplier(gk) : 1;

    const posEdge = gk ? gkPositioningEdge(gk) * fatigueMult : 0;
    let situational = 0;
    if (gk) {
      const reflex = gkReflexEdge(gk) * fatigueMult;
      const reach = gkReachEdge(gk) * fatigueMult;
      situational += (closeRange || isHeader) ? reflex * 1.3 : reflex * 0.45;
      situational += (isLongRange || isCrossType) ? reach * 1.2 : reach * 0.35;
    }
    const gkSkillBase = (gk ? (curvedAttr(gk.def || 70, 70) * 0.45 + curvedAttr(gk.ovr || 75, 75) * 0.25 + curvedAttr(gk.tec || 70, 70) * 0.15) / 100 : 0.68) * (gk ? conditionMultiplier(gk) : 1);
    const gkSkill = Math.max(0.05, Math.min(0.98, gkSkillBase + posEdge + situational));
    // Base raised 0.58 -> 0.62 alongside the possession-pipeline shot-volume
    // fix (see engine/possession.js passChance/duelChance/carryChance): once
    // shots started reaching the keeper at something closer to a realistic
    // rate, the shots-on-target -> goal conversion this produced (~40%) ran
    // a bit hot versus the ~33% real-world benchmark noted below — this
    // small bump brings scoring back toward that line without undoing the
    // shot-volume fix itself.
    // Nudged 0.62 -> 0.66: with corners, cleared-cross corners and routine
    // free-kick openings now generating realistic set-piece volume (see
    // engine/passing.js / referee.js), overall conversion had drifted to
    // ~36% of shots on target — this brings it back toward the ~33% line.
    const saveChance = Math.min(0.94, Math.max(0.28,
      0.66 + gkSkill * 0.38 - shotQuality * 0.22 - shotPower * 0.06 - (isHeader ? 0.03 : 0)));
    if (seededRandom() >= saveChance) return { saved: false };

    // A save happened — decide whether it's a clean catch or a parry (and,
    // if parried, whether it leaves a real rebound chance behind it).
    const catchChance = gkCatchChance(gk, shotPower, closeRange);
    if (seededRandom() < catchChance) return { saved: true, saveType: 'catch', reboundDanger: 0 };
    return { saved: true, saveType: 'parry', reboundDanger: gkParryReboundDanger(gk) };
  }
/*@CHUNK:cgk05:END*/

/*@CHUNK:cgk07:START*/
  // Single-number shot-stopping rating for a goalkeeper, on the same ~0-99
  // scale as an outfield attribute. This is the GK's own, completely
  // separate contribution to team strength (see the `gk` field
  // calcTeamStrength() returns in engine/matchEngine.js) — it is never
  // blended into the team's outfield att/def averages (POS_ATT_WEIGHT/
  // POS_DEF_WEIGHT in js/state.js both give GK a weight of 0 there).
  // Built from the same expanded goalkeeping attributes resolveGkSave()
  // above reads shot-by-shot (awareness/positioning, reflexes, reach,
  // catching), so a keeper who actually profiles as an elite shot-stopper
  // in-match also shows up as one here — with the same def/ovr/tec fallback
  // resolveGkSave() uses for a keeper with no expanded attribute sheet.
  function gkShotStoppingRating(gk) {
    if (!gk) return 70;
    if (!gk.expandedAttrs) {
      return curvedAttr(gk.def || 70, 70) * 0.6 + curvedAttr(gk.ovr || 75, 75) * 0.25 + curvedAttr(gk.tec || 70, 70) * 0.15;
    }
    const awr = xattr(gk, 'gk_awr', 75);
    const reflex = xattr(gk, 'gk_reflex', 75);
    const reach = xattr(gk, 'gk_reach', 75);
    const catchAttr = xattr(gk, 'gk_catch', 65);
    return awr * 0.30 + reflex * 0.30 + reach * 0.20 + catchAttr * 0.20;
  }
/*@CHUNK:cgk07:END*/

/*@CHUNK:c0175:START*/

/*@CHUNK:c0175:END*/

/*@CHUNK:c0176:START*/
  function sofascoreSave(gk, shooter, team, defTeam) {
    const foot = seededRandom() < 0.55 ? 'right footed' : 'left footed';
    const lines = [
      'Attempt saved. <span class="player">' + shooter.name + '</span> (' + (team.short||'') + ') ' + foot + ' shot from the centre of the box is saved in the centre of the goal by <span class="player">' + gk.name + '</span> (' + (defTeam.short||'') + ').',
      'Attempt saved. <span class="player">' + shooter.name + '</span> (' + (team.short||'') + ') ' + foot + ' shot from outside the box is saved in the bottom left corner by <span class="player">' + gk.name + '</span>.',
      'Attempt saved. <span class="player">' + shooter.name + '</span> (' + (team.short||'') + ') header from the centre of the box is saved in the top centre of the goal by <span class="player">' + gk.name + '</span>.',
      '<span class="player">' + gk.name + '</span> (' + (defTeam.short||'') + ') saves a ' + foot + ' shot from <span class="player">' + shooter.name + '</span> at full stretch.'
    ];
    return lines[Math.floor(seededRandom() * lines.length)];
  }
/*@CHUNK:c0176:END*/

/*@CHUNK:c0177:START*/


/*@CHUNK:c0177:END*/

/*@CHUNK:c0178:START*/
  function pickSaveDesc(gk, shooter) {
    const list = [
      `strong hands from <span class="player">${gk.name}</span> to push away a fierce drive`,
      `<span class="player">${gk.name}</span> dives full length to tip a curler around the post`,
      `reflex save — <span class="player">${gk.name}</span> blocks from point-blank range`,
      `<span class="player">${gk.name}</span> gets down quickly to hold a low shot`,
      `spectacular tip over from <span class="player">${gk.name}</span> as a rising shot threatens the top corner`,
      `<span class="player">${gk.name}</span> parries a knuckleball, then gathers at the second attempt`,
      `brave claim by <span class="player">${gk.name}</span> under pressure from the striker`
    ];
    return list[Math.floor(seededRandom() * list.length)];
  }
/*@CHUNK:c0178:END*/

/*@CHUNK:cgk06:START*/
  // Distinct flavor for a clean catch (gk_catch) vs. the pickSaveDesc bank
  // above, which reads more like a parry/reflex stop — so a shot-stopper
  // with genuinely strong hands reads differently from one who's mostly
  // getting a hand/foot to things.
  function pickCatchDesc(gk, shooter) {
    const list = [
      `<span class="player">${gk.name}</span> gets both hands to it and holds on comfortably`,
      `safe hands from <span class="player">${gk.name}</span> — gathered cleanly, no danger of a rebound`,
      `<span class="player">${gk.name}</span> reads the shot early and catches it on his line`,
      `composed take from <span class="player">${gk.name}</span>, straight into his grasp`,
      `<span class="player">${gk.name}</span> plucks it out of the air and clutches it to his chest`
    ];
    return list[Math.floor(seededRandom() * list.length)];
  }
/*@CHUNK:cgk06:END*/
