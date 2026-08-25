/*@CHUNK:cofs01:START*/

  // ===================================================================
  // ===================== OFFSIDE ENGINE ==============================
  // ===================================================================
  // A genuinely spatial read of the offside law instead of a flat dice
  // roll. Every on-pitch player already has an (x,y) position implied by
  // their formation slot (FORMATIONS[key].coords — see js/state.js), with
  // y=92 sitting on a team's own goal line and y≈14-20 at the opposite
  // end. That's converted into a single 0-1 "advancement" value (0 = own
  // goal, 1 = opponent's goal) that's directly comparable between the two
  // sides, since both formations share the same own-goal-at-92 convention.
  // From there the engine reconstructs, for a single passage of play:
  //   - the receiver's position at "the exact moment of the pass" — judged
  //     as a small, mostly-random timing window around the defensive line
  //     itself (not their average formation slot — see evaluateOffside for
  //     why that would over-flag almost every through ball), biased by
  //     pace and off-ball awareness
  //   - the second-last defender's position — the actual legal offside
  //     reference line, almost always the deepest outfield defender and
  //     NOT the goalkeeper
  //   - the goalkeeper's own position, since an advanced/stranded keeper
  //     can itself become the "second-last opponent" instead
  //   - active interference — only a genuine forward pass into space
  //     (chanceType 'throughball') is ever routed through this check in
  //     the first place; backward/square play never is
  //   - rebounds/loose balls and a deliberate defensive touch, both of
  //     which restart the phase of play and clear any prior offside
  //     position under the actual Laws of the Game
/*@CHUNK:cofs01:END*/

/*@CHUNK:cofs02:START*/
  function playerAdvancement(p, formationKey) {
    const formation = FORMATIONS[formationKey] || FORMATIONS['4-3-3'];
    const slot = p.slot || (p.pos || [])[0] || 'CM';
    const idx = formation.slots.indexOf(slot);
    const coord = formation.coords[idx >= 0 ? idx : 0] || [50, 50];
    const y = coord[1];
    return Math.max(0, Math.min(1, (92 - y) / (92 - 14)));
  }
/*@CHUNK:cofs02:END*/

/*@CHUNK:cofs03:START*/
  // The defensive line the officials actually judge against: the second-
  // deepest opponent, expressed on the attacking side's own advancement
  // axis (1 - their own advancement, since the two sides' advancement
  // scales run in opposite physical directions but describe the same
  // pitch). A high press or a chasing team's late push both drag the line
  // higher up the pitch (offside easier to catch); sitting deep pulls it
  // back toward the byline (far harder to catch, at the cost of inviting
  // pressure). Also reports the goalkeeper's own position, since an
  // advanced/stranded keeper can himself become the second-last opponent
  // rather than the usual deepest centre-back.
  function defensiveLineContext(defTeam, defSide) {
    const m = currentMatch;
    const formationKey = defTeam.squad && defTeam.squad.formation;
    const onIds = defSide === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const all = (defTeam.squad && defTeam.squad.all) || [];
    const onPitch = onIds.map(id => all.find(p => p.id === id)).filter(Boolean);
    const gk = onPitch.find(p => (p.slot || (p.pos || [])[0]) === 'GK');
    const outfield = onPitch.filter(p => (p.slot || (p.pos || [])[0]) !== 'GK');
    if (!outfield.length) return { lineShared: 0.78, gkShared: 0.94, gkStranded: false };
    const advs = outfield.map(p => playerAdvancement(p, formationKey)).sort((a, b) => a - b);
    // Deepest outfield defender = smallest advancement = the real offside
    // reference line under the law.
    const deepestOutfield = advs[0];
    const tac = (m.tactics && m.tactics[defSide]) || 'balanced';
    const style = getManagerPlaystyle(defTeam.team);
    const highLineStyle = ['Possession', 'Overload'].includes(style);
    let pushUp = tac === 'press' ? 0.09 : tac === 'attack' ? 0.05 : tac === 'defend' ? -0.07 : 0;
    if (highLineStyle) pushUp += 0.02;
    const lineAdv = Math.max(0.03, Math.min(0.55, deepestOutfield + pushUp));
    const gkAdv = gk ? playerAdvancement(gk, formationKey) : 0.04;
    // A rare sweeper-keeper case: the keeper is sat ahead of the deepest
    // outfield defender, and becomes the offside reference line himself.
    const gkStranded = gkAdv > lineAdv;
    return {
      lineShared: 1 - (gkStranded ? gkAdv : lineAdv),
      gkShared: 1 - gkAdv,
      gkStranded
    };
  }
/*@CHUNK:cofs03:END*/

/*@CHUNK:cofs04:START*/
  // Core spatial/temporal offside check for a single attacker at "the
  // exact moment of the pass" — used both as a live flag before a chance
  // is even created (through balls / breakaways) and, via the same
  // context, for the post-goal VAR recheck. `moment` distinguishes phases
  // of play the law treats differently:
  //   'throughball' / 'counter' — a genuine forward pass into space; the
  //                                only case actively judged here
  //   'corner' / 'throwin'      — exempt: nobody can be offside receiving
  //                                the ball directly from either
  //   'rebound'                 — exempt: a loose ball off a save/post/bar
  //                                restarts the phase of play
  //   'deflection'              — exempt: a deliberate touch by a defender
  //                                plays the attacker onside regardless of
  //                                their position
  function evaluateOffside(attackingSide, attacker, moment) {
    const m = currentMatch;
    if (!m || !attacker) return { offside: false, checked: false };
    if (moment === 'corner' || moment === 'throwin' || moment === 'rebound' || moment === 'deflection') {
      return { offside: false, checked: false, exempt: true };
    }
    const defSide = attackingSide === 'home' ? 'away' : 'home';
    const attTeam = m[attackingSide], defTeam = m[defSide];
    const ctx = defensiveLineContext(defTeam, defSide);

    // A genuine through-ball run is, by definition, an attempt to arrive
    // right on the defensive line at "the exact moment of the pass" — a
    // player's *typical* formation slot (a striker sits high up the pitch
    // by design) isn't what decides this, or strikers would be given
    // offside on almost every through ball regardless of timing. What
    // actually decides it is a small, mostly-random timing window around
    // that line, biased by pace against the covering defence and, where
    // available, off-the-ball positioning/awareness — a smarter runner
    // times the run to stay just onside; a purely physical one drifts
    // early and gets caught square more often.
    const defAvgPac = calcTeamStrength(defTeam).pac || 70;
    const paceEdge = ((attacker.pac || 70) - defAvgPac) / 100;
    const awareness = (attacker.expandedAttrs && typeof attacker.expandedAttrs.off_awr === 'number')
      ? (attacker.expandedAttrs.off_awr - 70) / 100 : 0;
    const timing = (seededRandom() - 0.5) * 0.16 - paceEdge * 0.05 - awareness * 0.09;
    const attackerShared = Math.min(1, Math.max(0, ctx.lineShared + timing));

    const margin = attackerShared - ctx.lineShared;
    if (margin <= 0) return { offside: false, checked: true, marginal: margin > -0.04, margin };

    // Discipline of the defensive line itself — a well-organised back line
    // (higher collective DEF rating) plays a trap cleanly and catches a
    // marginal case more often than a shaky one that plays the runner on.
    const defDiscipline = (calcTeamStrength(defTeam).def || 70) / 100;
    const catchChance = Math.max(0.08, Math.min(0.85, margin * 4.5 + defDiscipline * 0.15));
    const offside = seededRandom() < catchChance;
    return { offside, checked: true, marginal: margin < 0.05, margin };
  }
/*@CHUNK:cofs04:END*/

/*@CHUNK:cofs05:START*/
  // Applied at the point a through ball / breakaway chance is actually
  // created — checks the spatial model above and, if the flag goes up,
  // ends the passage immediately (no shot, no advantage played), logging
  // it against both the live event feed and the receiver's own offside
  // count. A marginal-but-onside call still gets VAR-style flavor text so
  // genuinely close decisions read as tense rather than routine.
  function checkLiveOffside(attackingSide, attacker, moment) {
    const m = currentMatch;
    const result = evaluateOffside(attackingSide, attacker, moment);
    if (!result.checked) return result;
    if (result.offside) {
      if (!m.playerMatchStats) m.playerMatchStats = {};
      if (!m.playerMatchStats[attacker.id]) m.playerMatchStats[attacker.id] = blankPlayerMatchStats(attacker);
      m.playerMatchStats[attacker.id].offsides = (m.playerMatchStats[attacker.id].offsides || 0) + 1;
      addEvent(m.minute, 'offside', `🚩 Flag up — <span class="player">${attacker.name}</span> caught offside by the last defender`, attackingSide);
    } else if (result.marginal) {
      addEvent(m.minute, 'offside', `Tight call — <span class="player">${attacker.name}</span> ruled level, play continues`, attackingSide);
    }
    return result;
  }
/*@CHUNK:cofs05:END*/
