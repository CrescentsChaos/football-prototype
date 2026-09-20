/*@CHUNK:cdec01:START*/

  // ===== Dynamic ball-decision model ============================================
  // Replaces fixed engine branching ("this zone always tries a pass", "wide entry
  // is always a cross-or-cutback coin flip") with an actual decision: whenever a
  // player is on the ball, every plausible action gets a weighted score built from
  // (1) that player's own attributes, (2) the situation around them right now
  // (pitch zone, marking pressure, which channel, game state), and (3) their
  // team's tactical stance and manager playstyle. One action is then drawn from
  // the resulting probability distribution with seededRandom() — so the same
  // player in the same spot won't always do the same thing, but a genuine
  // dribbler in space against a tired full-back will *tend* to run at him far
  // more often than a target man would.
  //
  // Used at two points in the possession pipeline:
  //   - runPossessionSequence() (possession.js): a mid-pitch receiver choosing
  //     between pass / dribble / carry / backpass / switch / hold.
  //   - resolveChanceCreation() (passing.js): the final-third decision between
  //     shoot / cross / through ball / dribble / laying it off instead.
/*@CHUNK:cdec01:END*/

/*@CHUNK:cdec02:START*/
  const BALL_ACTIONS = ['pass', 'dribble', 'carry', 'shoot', 'cross', 'throughball', 'backpass', 'switch', 'hold'];

  // Which broad position group a player's decisions get evaluated as. This
  // is the piece the model was missing: everyone on the ball in midfield
  // was scored off the *same* base table regardless of whether they were a
  // CDM or a striker who'd dropped deep — so a poacher who found himself in
  // midfield behaved (and got dispossessed) like a converted playmaker
  // instead of doing what strikers actually do there, which is look for the
  // link/lay-off rather than try to dribble through a crowded middle.
  function positionGroupOf(p) {
    const slot = (p && (p.slot || (p.pos || [])[0])) || 'CM';
    if (slot === 'GK') return 'GK';
    if (slot === 'CB') return 'CB';
    if (slot === 'RB' || slot === 'LB' || slot === 'RWB' || slot === 'LWB') return 'FB';
    if (slot === 'CDM') return 'CDM';
    if (slot === 'CM') return 'CM';
    if (slot === 'CAM') return 'CAM';
    if (slot === 'RM' || slot === 'LM' || slot === 'RW' || slot === 'LW') return 'WIDE';
    if (slot === 'ST' || slot === 'CF' || slot === 'SS') return 'ST';
    return 'CM';
  }

  // Starting weight for each action before attribute/context/tactic factors
  // are applied, keyed by (a) which third of the pitch the ball is in and
  // (b) the carrier's own position group — a back-line CB and an out-and-
  // out striker read a midfield situation completely differently, and this
  // is what actually encodes that instead of one flat per-third table for
  // everyone. Every action keeps a nonzero floor so an unlikely one (a CB
  // shooting from inside his own half) stays possible at a low rate rather
  // than being hard-excluded — real matches occasionally produce exactly
  // that kind of moment.
  const BASE_ACTION_WEIGHTS_BY_POS = {
    GK: {
      DEF: { pass: 55, dribble: 0.5, carry: 8,  shoot: 0.05, cross: 0.3, throughball: 0.5, backpass: 20, switch: 14, hold: 1 },
      MID: { pass: 52, dribble: 0.5, carry: 8,  shoot: 0.1,  cross: 0.5, throughball: 1,   backpass: 18, switch: 14, hold: 2 },
      ATT: { pass: 46, dribble: 0.5, carry: 6,  shoot: 0.5,  cross: 1,   throughball: 1,    backpass: 12, switch: 10, hold: 3 }
    },
    CB: {
      DEF: { pass: 50, dribble: 3,  carry: 14, shoot: 0.1, cross: 0.3, throughball: 1,   backpass: 18, switch: 12, hold: 3 },
      MID: { pass: 48, dribble: 4,  carry: 12, shoot: 0.3, cross: 1,   throughball: 2,   backpass: 16, switch: 12, hold: 4 },
      ATT: { pass: 40, dribble: 3,  carry: 8,  shoot: 3,   cross: 3,   throughball: 2,   backpass: 10, switch: 8,  hold: 3 }
    },
    FB: {
      DEF: { pass: 46, dribble: 6,  carry: 16, shoot: 0.1, cross: 1,   throughball: 1,   backpass: 15, switch: 12, hold: 3 },
      MID: { pass: 40, dribble: 8,  carry: 16, shoot: 0.3, cross: 4,   throughball: 2,   backpass: 10, switch: 12, hold: 3 },
      ATT: { pass: 28, dribble: 10, carry: 12, shoot: 1,   cross: 14,  throughball: 3,   backpass: 4,  switch: 6,  hold: 3 }
    },
    CDM: {
      DEF: { pass: 52, dribble: 3,  carry: 12, shoot: 0.1, cross: 0.3, throughball: 1.5, backpass: 18, switch: 12, hold: 4 },
      MID: { pass: 50, dribble: 5,  carry: 10, shoot: 0.5, cross: 1.5, throughball: 5,   backpass: 14, switch: 12, hold: 6 },
      ATT: { pass: 34, dribble: 5,  carry: 8,  shoot: 3,   cross: 3,   throughball: 6,   backpass: 6,  switch: 6,  hold: 6 }
    },
    CM: {
      DEF: { pass: 46, dribble: 6,  carry: 14, shoot: 0.2, cross: 0.5, throughball: 2,   backpass: 15, switch: 11, hold: 4 },
      MID: { pass: 42, dribble: 10, carry: 12, shoot: 1,   cross: 3,   throughball: 8,   backpass: 9,  switch: 10, hold: 4 },
      ATT: { pass: 26, dribble: 10, carry: 9,  shoot: 8,   cross: 8,   throughball: 9,   backpass: 4,  switch: 4,  hold: 4 }
    },
    CAM: {
      DEF: { pass: 40, dribble: 6,  carry: 12, shoot: 0.2, cross: 0.5, throughball: 3,   backpass: 15, switch: 10, hold: 4 },
      MID: { pass: 36, dribble: 11, carry: 10, shoot: 2,   cross: 4,   throughball: 14,  backpass: 6,  switch: 8,  hold: 5 },
      ATT: { pass: 18, dribble: 13, carry: 7,  shoot: 16,  cross: 9,   throughball: 15,  backpass: 2,  switch: 3,  hold: 5 }
    },
    WIDE: {
      DEF: { pass: 40, dribble: 8,  carry: 16, shoot: 0.2, cross: 1,   throughball: 1,   backpass: 13, switch: 12, hold: 3 },
      MID: { pass: 34, dribble: 16, carry: 16, shoot: 1,   cross: 5,   throughball: 5,   backpass: 8,  switch: 11, hold: 3 },
      ATT: { pass: 16, dribble: 20, carry: 10, shoot: 12,  cross: 20,  throughball: 6,   backpass: 2,  switch: 6,  hold: 3 }
    },
    ST: {
      // Midfield is a striker's least natural zone to be carrying the ball
      // in — realistically he isn't trying to dribble through a crowded
      // middle against a CDM, he's looking to bring it down and lay it off
      // (hold) or find the simple pass and get back into a threatening
      // position. That's the specific gap the old flat per-third table
      // papered over and what was getting strikers/wingers dispossessed
      // so heavily once every action was actually being attempted.
      DEF: { pass: 38, dribble: 6,  carry: 14, shoot: 0.1, cross: 0.3, throughball: 0.5, backpass: 14, switch: 10, hold: 7  },
      MID: { pass: 34, dribble: 8,  carry: 10, shoot: 1.5, cross: 1.5, throughball: 3,   backpass: 8,  switch: 6,  hold: 20 },
      ATT: { pass: 12, dribble: 10, carry: 6,  shoot: 32,  cross: 4,   throughball: 5,   backpass: 1,  switch: 1,  hold: 8  }
    }
  };

  function baseActionWeights(third, posGroup) {
    const byPos = BASE_ACTION_WEIGHTS_BY_POS[posGroup] || BASE_ACTION_WEIGHTS_BY_POS.CM;
    return byPos[third] || byPos.MID;
  }
/*@CHUNK:cdec02:END*/

/*@CHUNK:cdec03:START*/
  // Player-attribute contribution to each candidate action, reusing the same
  // ability reads the rest of the engine already relies on (passingAbility,
  // carryingAbility, aerialPassingAbility, etc.) so a player who's good at
  // something here is the same player who's good at it everywhere else in the
  // simulation. Returned on roughly the same ~60-95 scale as those helpers.
  function attributeActionScores(p) {
    const ground = groundPassingAbility(p);
    const aerial = aerialPassingAbility(p);
    const carry = carryingAbility(p);
    const vision = curvedAttr(xattr(p, 'vision', p.tec || 70), 70);
    const composure = curvedAttr(xattr(p, 'composure', p.tec || 70), 70);
    const finishing = curvedAttr(xattr(p, 'fin', p.att || 70), 70) * 0.65 + curvedAttr(p.att || 70, 70) * 0.35;
    return {
      pass: ground * 0.7 + vision * 0.3,
      dribble: carry * 0.75 + composure * 0.25,
      carry: carry * 0.8 + curvedAttr(p.pac || 70, 70) * 0.2,
      shoot: finishing,
      cross: aerial,
      throughball: vision * 0.6 + ground * 0.4,
      backpass: ground,
      switch: aerial * 0.5 + vision * 0.5,
      hold: composure * 0.7 + carry * 0.3
    };
  }
/*@CHUNK:cdec03:END*/

/*@CHUNK:cdec04:START*/
  // Builds the weighted score for every action in `allowed`, folding in the
  // situational (pressure) and tactical (team stance / manager playstyle /
  // player traits) factors on top of the raw attribute read above.
  function evaluateBallActions(player, ctx) {
    const third = (ctx.zoneKey || 'MID_C').split('_')[0];
    const posGroup = positionGroupOf(player);
    const base = baseActionWeights(third, posGroup);
    const attr = attributeActionScores(player);
    const pressure = ctx.marker ? defensivePressure(ctx.marker, player) : 55;
    const allowed = ctx.allowed || BALL_ACTIONS;
    // How much heavier pressure discourages (positive) or encourages
    // (negative, i.e. safety-first actions become relatively more attractive)
    // each action — a tight man-marking job makes a risky through ball or
    // dribble far less appealing than simply recycling it.
    const pressureSensitivity = { pass: 0.28, dribble: 1.0, carry: 0.9, shoot: 0.5, cross: 0.45, throughball: 0.9, backpass: -0.9, switch: -0.5, hold: -0.7 };

    const scores = {};
    allowed.forEach((action) => {
      const b = base[action] != null ? base[action] : 1;
      const a = attr[action] != null ? attr[action] / 70 : 1;
      let w = b * a;

      const sens = pressureSensitivity[action] || 0;
      w *= 1 - Math.max(-0.5, Math.min(0.5, sens * ((pressure - 55) / 100)));

      // Tactical stance: an attacking team leans into progressive/risky ball
      // actions, a defensive one prioritises keeping possession safe.
      if (ctx.tacticSelf === 'attack') {
        if (action === 'dribble' || action === 'carry' || action === 'shoot' || action === 'throughball' || action === 'cross') w *= 1.18;
        if (action === 'backpass') w *= 0.7;
      } else if (ctx.tacticSelf === 'defend') {
        if (action === 'backpass' || action === 'hold' || action === 'switch') w *= 1.15;
        if (action === 'dribble' || action === 'throughball' || action === 'shoot') w *= 0.82;
      } else if (ctx.tacticSelf === 'press') {
        if (action === 'pass' || action === 'carry') w *= 1.08;
      }
      // Facing a high press makes it harder to justify a slow build-up ball —
      // safer, quicker options get relatively more attractive.
      if (ctx.tacticOpp === 'press') {
        if (action === 'backpass' || action === 'switch') w *= 1.12;
        if (action === 'throughball') w *= 0.9;
      }

      // Manager playstyle: wide-leaning sides cross/switch more, direct sides
      // (Long Ball) favour progressing the ball over patient recycling.
      if (ctx.mods) {
        if (action === 'cross' || action === 'switch') w *= ctx.mods.wingBiasMult || 1;
        if (action === 'backpass') w *= 1 / Math.max(0.6, ctx.mods.passVolMult || 1);
        // ---- Individual manager DNA on top of the broad style multiplier
        // ---- above — this is what makes two managers running the same
        // ---- nominal playstyle still make visibly different decisions
        // ---- on the ball.
        if (action === 'cross') w *= ctx.mods.crossingBias || 1;
        if (action === 'switch') w *= ctx.mods.switchBias || 1;
        if (action === 'throughball') w *= (ctx.mods.throughBallBias || 1) * (0.8 + (ctx.mods.verticality != null ? ctx.mods.verticality : 0.5) * 0.4);
        if (action === 'dribble' || action === 'carry') w *= 0.8 + (ctx.mods.positionalFreedom != null ? ctx.mods.positionalFreedom : 0.5) * 0.4;
        if (action === 'shoot' || action === 'throughball' || action === 'dribble') {
          w *= 0.85 + (ctx.mods.riskAppetite != null ? ctx.mods.riskAppetite : 0.5) * 0.3;
        }
        if (action === 'pass') w *= 0.85 + (ctx.mods.tempoMult != null ? Math.min(1, ctx.mods.tempoMult / 1.25) : 0.8) * 0.3;
      }

      // Individual playstyle tags — data-driven via PLAYSTYLE_BEHAVIOR
      // (engine/playstyleBehavior.js) so every tagged style nudges these
      // weights in its own distinct direction, not just a hand-picked
      // subset behind a fixed if-chain. See that file for the full
      // per-style breakdown; these are internal behavior parameters, not
      // raw attribute values, so two players with identical stat sheets
      // but different tags still play noticeably differently here.
      const styleMult = playstyleActionMult(player, action);
      if (styleMult !== 1) w *= styleMult;
      if (hasSkill(player, 'Attack Trigger') && (action === 'dribble' || action === 'carry' || action === 'throughball')) w *= 1.08;

      // Personality tags (player-attributes.json "personality", optional —
      // undefined on any player without a hand-authored entry, in which case
      // this is a no-op).
      const personality = (player.expandedAttrs && player.expandedAttrs.personality) || [];
      // Selfish/Team Player: nudges the shoot-or-dribble vs. pass-or-
      // through-ball balance directly, independent of position/playstyle.
      if (personality.includes('Selfish')) {
        if (action === 'shoot' || action === 'dribble') w *= 1.2;
        if (action === 'pass' || action === 'throughball' || action === 'cross') w *= 0.88;
      }
      if (personality.includes('Team Player')) {
        if (action === 'pass' || action === 'throughball') w *= 1.2;
        if (action === 'shoot' || action === 'dribble') w *= 0.85;
      }
      // Showboat: attempts more dribbles than the raw ability read alone
      // would justify — the higher turnover risk that comes with it lives
      // in the carryChance calc in engine/possession.js, not here.
      if (personality.includes('Showboat') && action === 'dribble') w *= 1.25;
      // Homebody: a genuine dip in incisive/risky ball actions away from
      // home, nothing to do with pressure or tactics.
      if (personality.includes('Homebody')) {
        const homeCtx = playerSideData(player);
        if (homeCtx && homeCtx.sideKey === 'away' && (action === 'dribble' || action === 'shoot' || action === 'throughball' || action === 'cross')) {
          w *= 0.92;
        }
      }
      // Weak-foot suppression on top of the numeric weak-foot stat itself —
      // a genuinely one-footed player is less willing to shoot or whip in a
      // cross when it would come off his weaker side. This engine doesn't
      // currently track which physical side of the body an action favors,
      // so the suppression applies to both actions outright; gate it with
      // that side-context once/if this model tracks it.
      if (xattr(player, 'weak foot', 70) < 45) {
        if (action === 'cross' || action === 'shoot') w *= 0.9;
      }

      // Half-spaces: a carrier actually standing in a half-space (not
      // central, not touchline-wide — see engine/spatialModel.js::
      // halfSpaceOf()) has a genuinely better passing angle into the box
      // than the same player central or pinned to the line, so through
      // balls/incisive passes get a real bump specifically from being
      // there; a winger pinned wide leans toward the cross he actually
      // has an angle for instead.
      const hs = halfSpaceOf(player);
      if (hs === 'halfSpaceLeft' || hs === 'halfSpaceRight') {
        if (action === 'throughball') w *= 1.15;
        if (action === 'pass') w *= 1.05;
      } else if (hs === 'wideLeft' || hs === 'wideRight') {
        if (action === 'cross') w *= 1.08;
        if (action === 'throughball') w *= 0.92;
      }

      // Local numbers: a genuine attacking overload in this zone right
      // now (engine/spatialModel.js::localOverload()) means more support
      // to actually find — pass/throughball become relatively more
      // attractive than forcing a dribble/shot into a crowded area, and
      // vice versa when the defence actually outnumbers the attack here.
      const sideCtx = playerSideData(player);
      const overload = sideCtx
        ? localOverload(sideCtx.sideKey, sideCtx.sideKey === 'home' ? 'away' : 'home', ctx.zoneKey || (third + '_C'))
        : 0;
      if (overload > 0) {
        if (action === 'pass' || action === 'throughball') w *= 1 + Math.min(0.24, overload * 0.08);
        if (action === 'dribble') w *= 1 - Math.min(0.15, overload * 0.05);
      } else if (overload < 0) {
        if (action === 'dribble' || action === 'shoot') w *= 1 + Math.min(0.12, -overload * 0.04);
        if (action === 'throughball') w *= 1 - Math.min(0.18, -overload * 0.06);
      }

      scores[action] = Math.max(0.05, w);
    });
    return scores;
  }
/*@CHUNK:cdec04:END*/

/*@CHUNK:cdec05:START*/
  // Draws one action from a { action: weight } distribution — this (not a
  // fixed if/else cascade) is what actually decides the outcome.
  function chooseWeightedAction(scores) {
    const entries = Object.entries(scores);
    if (!entries.length) return 'pass';
    const total = entries.reduce((s, [, w]) => s + w, 0);
    if (!(total > 0)) return entries[0][0];
    let r = seededRandom() * total;
    for (let i = 0; i < entries.length; i++) {
      r -= entries[i][1];
      if (r <= 0) return entries[i][0];
    }
    return entries[entries.length - 1][0];
  }
/*@CHUNK:cdec05:END*/

/*@CHUNK:cdec06:START*/
  // Convenience wrapper used by the call sites: evaluates candidates, picks
  // one by weighted probability, and hands back both so callers can narrate
  // or reuse the scores if they want to.
  function decideBallAction(player, marker, zoneKey, tacticSelf, tacticOpp, mods, allowed) {
    const scores = evaluateBallActions(player, { zoneKey, marker, tacticSelf, tacticOpp, mods, allowed });
    return { action: chooseWeightedAction(scores), scores };
  }
/*@CHUNK:cdec06:END*/
