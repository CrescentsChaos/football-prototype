/*@CHUNK:c0033:START*/
  // Extra shot-quality nudge (roughly ±0.15) from finishing-specific traits
  // a flat att/tec/ovr blend can't see on its own.
/*@CHUNK:c0033:END*/

/*@CHUNK:c0034:START*/
  function finishingEdge(p) {
    if (!p || !p.expandedAttrs) return 0;
    // Curved rather than linear: the max contribution at a 99 Finishing
    // rating is unchanged (still 0.145) but a merely-good 80 now gives up
    // much more of that ceiling than a flat scale would, and a 90+ finisher
    // pulls disproportionately closer to it — see curvedStat() in js/rng.js.
    let edge = curvedStat(xattr(p, 'fin', 70), 70, 29, 1.6) * 0.145;
    if (hasSkill(p, 'Phenomenal Finishing')) edge += 0.06;
    if (hasSkill(p, 'First-time Shot')) edge += 0.02;
    if (hasSkill(p, 'Acrobatic Finishing')) edge += 0.045;
    if (hasSkill(p, 'Low Screamer')) edge += 0.03;
    if (hasSkill(p, 'Chip Shot Control')) edge += 0.02;
    if (hasSkill(p, 'Long Range Shooting')) edge += 0.02;
    // Super-Sub: a real lift once the player has actually come off the
    // bench in the second half — a starter with the skill gets nothing.
    if (isActingSuperSub(p)) edge += 0.03;
    // Willpower: gradually sharper finishing the more shots this player has
    // already had a go at in this match.
    const m = currentMatch;
    if (hasSkill(p, 'Willpower') && m && m.playerMatchStats && m.playerMatchStats[p.id]) {
      edge += Math.min(0.08, (m.playerMatchStats[p.id].shots || 0) * 0.012);
    }
    // Playstyle-driven finishing edge — data-driven via PLAYSTYLE_BEHAVIOR
    // (engine/playstyleBehavior.js) so every tagged style contributes its
    // own distinct edge here, not just a hand-picked subset.
    edge += playstyleEdgeSum(p, 'finishingEdge');
    // A tired finisher's touch/composure in front of goal is a little less
    // reliable than when he's fresh.
    edge *= staminaMultiplier(p);
    return edge;
  }
/*@CHUNK:c0034:END*/

/*@CHUNK:cblitz01:START*/
  // Blitz Curler is a specific finishing identity, not just a flat bonus:
  // a player with the skill only ever finishes with the trademark blitz
  // curl strike (see pickGoalMethod below, which forces that outcome for
  // them), so how good they are at it should come straight from the three
  // attributes that actually make that finish work — the strike itself
  // (Finishing), enough bend to beat the keeper (Curl), and enough pace on
  // it that a strong hand isn't enough to keep it out (Kicking Power) —
  // rather than from generic finishing/free-kick edges built around a much
  // wider variety of finishes. Zero for anyone without the skill, so this
  // has no effect on the wider shooting model.
  function blitzCurlerEdge(p) {
    if (!p || !p.expandedAttrs || !hasSkill(p, 'Blitz Curler')) return 0;
    let edge = curvedStat(xattr(p, 'fin', 70), 70, 29, 1.6) * 0.09
      + curvedStat(xattr(p, 'curl', 70), 70, 29, 1.6) * 0.09
      + curvedStat(xattr(p, 'kick_pwr', 70), 70, 29, 1.6) * 0.05;
    edge *= staminaMultiplier(p);
    return edge;
  }
/*@CHUNK:cblitz01:END*/

/*@CHUNK:cshoot01:START*/
  // Off-the-ball positioning edge — separate from finishing itself. Off
  // Awareness is specifically about getting into the right spot/angle to
  // shoot from in the first place, so it nudges shot quality on every shot
  // type (including headers, where good movement in the box matters just
  // as much as jumping ability).
  function positioningEdge(p) {
    if (!p || !p.expandedAttrs) return 0;
    return curvedStat(xattr(p, 'off_awr', 70), 70, 29, 1.6) * 0.0522 * staminaMultiplier(p) * conditionMultiplier(p);
  }
/*@CHUNK:cshoot01:END*/

/*@CHUNK:cshoot02:START*/
  // How hard the shot is actually struck, 0-1 — driven by Kicking Power.
  // This is deliberately kept separate from shotQuality (placement/
  // technique): a powerfully struck shot is genuinely harder for a keeper
  // to keep out/hold onto even when it isn't perfectly placed, and it's
  // what feeds the catch-vs-parry decision in resolveGkSave.
  function shotPowerOf(p) {
    if (!p) return 0.5;
    const kp = xattr(p, 'kick_pwr', null);
    const base = kp != null ? kp : ((p.att || 70) * 0.4 + (p.phy || 70) * 0.6);
    return Math.max(0, Math.min(1, (base - 40) / 55));
  }
/*@CHUNK:cshoot02:END*/

/*@CHUNK:c0035:START*/
  // Aerial ability, 0.05-0.98 — used both to weight who wins headed chances
  // and to nudge conversion once they do. Defaults to a neutral 0.5 (so
  // multiplying by 2 elsewhere reduces to "no change") for non-expanded players.
/*@CHUNK:c0035:END*/

/*@CHUNK:c0036:START*/
  // isDefensiveContext: true when this call represents a defender heading
  // the ball away in/near their own box (corner/goal-kick defending) — that's
  // specifically what Aerial Fort covers, as opposed to an attacker winning
  // a header at the other end.
  function aerialSkill(p, isDefensiveContext) {
    if (!p || !p.expandedAttrs) return 0.5;
    // Heading technique is only part of winning an aerial duel — Jump is
    // what actually gets a player above his marker to reach the ball, and
    // Physical Contact is what lets him hold his ground/box the opponent
    // out to win the position in the first place. Blending all three (not
    // just heading) is what separates a genuine aerial threat from a
    // technically good header of a ball who can't out-jump anyone.
    // Each raw rating is run through the curve before blending — a 95
    // Heading rating stands out clearly from an 80, instead of the two
    // being separated by only a flat, easy-to-miss fraction of a point.
    let v = (curvedAttr(xattr(p, 'head', 60), 60, 39, 1.6) * 0.55
      + curvedAttr(xattr(p, 'jmp', 60), 60, 39, 1.6) * 0.3
      + curvedAttr(xattr(p, 'phy_con', 60), 60, 39, 1.6) * 0.15) / 100;
    if (hasSkill(p, 'Aerial Superiority') || hasSkill(p, 'Heading')) v += 0.12;
    if (hasSkill(p, 'Bullet Header')) v += 0.06;
    if (isDefensiveContext && hasSkill(p, 'Aerial Fort')) v += 0.08;
    // Playstyle-driven aerial edge — see PLAYSTYLE_BEHAVIOR
    // (engine/playstyleBehavior.js): a Target Man's whole game is built
    // around winning the aerial duel; defensively-anchored styles also
    // read the flight of a long ball well.
    v += playstyleEdgeSum(p, 'aerialEdge');
    // A tired jumper gets up a little less sharply late in the match.
    v *= staminaMultiplier(p) * conditionMultiplier(p);
    return Math.max(0.05, Math.min(0.98, v));
  }
/*@CHUNK:c0036:END*/

/*@CHUNK:c0039:START*/
  // Penalty-kick edges: taker's placement + specialist skill; keeper's
  // penalty-specific awareness + save skill.
/*@CHUNK:c0039:END*/

/*@CHUNK:c0040:START*/
  function penTakerEdge(p) {
    if (!p || !p.expandedAttrs) return 0;
    let edge = curvedStat(xattr(p, 'place_kick', 70), 70, 29, 1.6) * 0.1015;
    if (hasSkill(p, 'Penalty Specialist')) edge += 0.08;
    if (hasSkill(p, 'Chip Shot Control')) edge += 0.02;
    edge += playstyleEdgeSum(p, 'penEdge');
    return edge;
  }
/*@CHUNK:c0040:END*/

/*@CHUNK:c0042:START*/
  // Free-kick taker edge — curl/placement plus specialist skills.
/*@CHUNK:c0042:END*/

/*@CHUNK:c0043:START*/
  function fkTakerEdge(p) {
    if (!p || !p.expandedAttrs) return 0;
    let edge = curvedStat(xattr(p, 'curl', 70), 70, 29, 1.6) * 0.145
      + curvedStat(xattr(p, 'place_kick', 70), 70, 29, 1.6) * 0.0967;
    if (hasSkill(p, 'Long Range Curler')) edge += 0.05;
    if (hasSkill(p, 'Knuckle Shot')) edge += 0.04;
    if (hasSkill(p, 'Dipping Shot')) edge += 0.03;
    if (hasSkill(p, 'Blitz Curler')) edge += 0.03;
    if (hasSkill(p, 'Outside Curler')) edge += 0.02;
    edge += playstyleEdgeSum(p, 'fkEdge');
    return edge;
  }
/*@CHUNK:c0043:END*/

/*@CHUNK:c0044:START*/
  // Dribble/skill-move success edge — dribbling ability plus specific moves.
/*@CHUNK:c0044:END*/

/*@CHUNK:c0045:START*/
  function dribbleSuccessEdge(p) {
    if (!p || !p.expandedAttrs) return 0;
    let edge = curvedStat(xattr(p, 'dribb', 70), 70, 29, 1.6) * 0.116;
    const skillMoves = ['Chop Turn', 'Flip Flap', 'Double Touch', 'Marseille Turn', 'Scissors Feint', 'Sole Control', 'Sombrero', 'Cut Behind & Turn', 'Inside Bounce'];
    if (skillMoves.some((s) => hasSkill(p, s))) edge += 0.08;
    if (hasSkill(p, 'Momentum Dribbling')) edge += 0.03;
    if (hasSkill(p, 'Magnetic Feet')) edge += 0.03;
    if (hasSkill(p, 'Acceleration Burst')) edge += 0.02;
    edge += playstyleEdgeSum(p, 'dribbleEdge');
    edge *= staminaMultiplier(p) * conditionMultiplier(p);
    return edge;
  }
/*@CHUNK:c0045:END*/

/*@CHUNK:c0141:START*/


/*@CHUNK:c0141:END*/

/*@CHUNK:c0142:START*/
  function runPenaltyShootout() {
    const m = currentMatch;
    if (!m || m.inPens) return;
    m.inPens = true;
    m.status = 'Penalties';
    addEvent(m.minute, 'pen', `${emojiImg('penalty_goal', 'Penalty')} Penalty shootout!`, null);
    updateScoreboard();

    // Order the takers list so recognised penalty takers (strikers/wingers, then
    // attacking mids) step up before defenders/holding mids, same as real teams do.
    const penOrderScore = (p, side) => (p.att || 0) + (PEN_TAKER_ROLE_WEIGHT[p.slot || (p.pos||[])[0]] || 0.4) * 12
      + (side.roles && side.roles.penalty && side.roles.penalty.id === p.id ? 40 : 0);
    // Eligible takers are whoever is actually on the pitch at full time —
    // squad.starting/squad.subs are the fixed pre-match lists and never
    // change, so filtering only on those would let a player who was
    // substituted off (or sent off) hours ago still step up to take a
    // penalty, while a sub who's been on the pitch the whole shootout
    // build-up gets ignored entirely. m.homeOnPitch/m.awayOnPitch is the
    // live list of player ids currently out there (see trySubstitution in
    // engine/tactics.js), so cross-reference against that instead.
    const homeOnPitchIds = m.homeOnPitch || [];
    const awayOnPitchIds = m.awayOnPitch || [];
    const homePool = [...(m.home.squad.starting || []), ...(m.home.squad.subs || [])];
    const awayPool = [...(m.away.squad.starting || []), ...(m.away.squad.subs || [])];
    const homeTakers = homePool.filter(p => homeOnPitchIds.includes(p.id) && !(p.pos||[]).includes('GK')).sort((a,b)=>penOrderScore(b,m.home)-penOrderScore(a,m.home));
    const awayTakers = awayPool.filter(p => awayOnPitchIds.includes(p.id) && !(p.pos||[]).includes('GK')).sort((a,b)=>penOrderScore(b,m.away)-penOrderScore(a,m.away));

    // Silent/bulk sims (quick-sim, tournament auto-play) still resolve instantly —
    // only a real, on-screen live match animates the shootout kick by kick.
    if (m.silentDeep) {
      const st = { homePens: 0, awayPens: 0, round: 0, phase: 'regular', sudden: 0 };
      for (let i = 0; i < 5; i++) {
        st.round = i;
        takePenaltyKick(m, 'home', homeTakers, i, st);
        takePenaltyKick(m, 'away', awayTakers, i, st);
        const left = 4 - i;
        if (st.homePens > st.awayPens + left || st.awayPens > st.homePens + left) break;
      }
      let sd = 0;
      while (st.homePens === st.awayPens && sd < 20) {
        st.phase = 'sudden'; st.sudden = sd;
        takePenaltyKick(m, 'home', homeTakers, 5 + sd, st);
        takePenaltyKick(m, 'away', awayTakers, 5 + sd, st);
        sd++;
      }
      m.home.penScore = st.homePens;
      m.away.penScore = st.awayPens;
      addEvent(m.minute, 'whistle', `Penalties: ${m.home.team.short} ${st.homePens} - ${st.awayPens} ${m.away.team.short}`, null);
      endMatch();
      return;
    }

    clearInterval(simInterval);
    isPlaying = false;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = '▶ Play';

    m._pensState = { homePens: 0, awayPens: 0, round: 0, sudden: 0, turn: 'home', phase: 'regular' };
    const stepDelay = Math.max(700, Math.min(1400, simSpeed * 2.5));
    // First kick fires right away so it doesn't feel like a stall, then one kick per interval tick.
    stepPenaltyShootout(homeTakers, awayTakers);
    simInterval = setInterval(() => stepPenaltyShootout(homeTakers, awayTakers), stepDelay);
  }
/*@CHUNK:c0142:END*/

/*@CHUNK:c0143:START*/

  // Resolves a single penalty kick and updates score/events. Shared by the instant
  // (silentDeep) and animated (live) shootout paths so outcomes are computed the same way.
/*@CHUNK:c0143:END*/

/*@CHUNK:c0144:START*/
  function takePenaltyKick(m, side, takers, kickIndex, st) {
    if (!takers.length) return;
    const taker = takers[kickIndex % takers.length];
    const oppSide = side === 'home' ? 'away' : 'home';
    const gk = activeGoalkeeper(oppSide);
    const out = pickPenOutcome(taker, gk);
    const teamShort = m[side].team.short;
    if (out.scored) {
      st[side === 'home' ? 'homePens' : 'awayPens']++;
      addEvent(m.minute, 'pen', `${emojiImg('penalty_goal', 'Penalty scored')} ${taker.name} (${teamShort}) ${out.text} [${st.homePens}-${st.awayPens}]`, side);
    } else {
      addEvent(m.minute, 'pen', `${emojiImg('penalty_miss_saved', 'Penalty missed')} ${taker.name} (${teamShort}) — ${out.text} [${st.homePens}-${st.awayPens}]`, side);
    }
  }
/*@CHUNK:c0144:END*/

/*@CHUNK:c0145:START*/

  // Advances the live penalty shootout by exactly one kick, alternating home/away,
  // so the person watching sees each penalty land before the next one is taken.
/*@CHUNK:c0145:END*/

/*@CHUNK:c0146:START*/
  function stepPenaltyShootout(homeTakers, awayTakers) {
    const m = currentMatch;
    if (!m || !m._pensState) { clearInterval(simInterval); return; }
    const st = m._pensState;
    const side = st.turn;
    const takers = side === 'home' ? homeTakers : awayTakers;
    const kickIndex = st.phase === 'regular' ? st.round : (5 + st.sudden);
    takePenaltyKick(m, side, takers, kickIndex, st);
    m.home.penScore = st.homePens;
    m.away.penScore = st.awayPens;
    updateScoreboard();

    if (st.turn === 'home') {
      st.turn = 'away';
      return; // wait for the next tick to take away's kick in the same round
    }
    // Away just kicked — the round is complete, decide what happens next.
    st.turn = 'home';
    if (st.phase === 'regular') {
      const left = 4 - st.round;
      if (st.homePens > st.awayPens + left || st.awayPens > st.homePens + left) {
        finishPenaltyShootout();
        return;
      }
      st.round++;
      if (st.round >= 5) {
        if (st.homePens === st.awayPens) { st.phase = 'sudden'; st.sudden = 0; }
        else { finishPenaltyShootout(); return; }
      }
    } else {
      if (st.homePens !== st.awayPens) { finishPenaltyShootout(); return; }
      st.sudden++;
    }
  }
/*@CHUNK:c0146:END*/

/*@CHUNK:c0147:START*/

/*@CHUNK:c0147:END*/

/*@CHUNK:c0148:START*/
  function finishPenaltyShootout() {
    const m = currentMatch;
    if (!m) return;
    clearInterval(simInterval);
    const st = m._pensState || { homePens: m.home.penScore || 0, awayPens: m.away.penScore || 0 };
    m.home.penScore = st.homePens;
    m.away.penScore = st.awayPens;
    addEvent(m.minute, 'whistle', `Penalties: ${m.home.team.short} ${st.homePens} - ${st.awayPens} ${m.away.team.short}`, null);
    endMatch();
  }
/*@CHUNK:c0148:END*/

/*@CHUNK:c0149:START*/

  // ---- Own goals ----
  // Genuinely rare — real football sees an own goal roughly once every
  // several dozen matches, not every game — so every call site here rolls
  // a very small probability and almost always returns false. `culprit`
  // is the defending player whose action turned it into his own net;
  // `desc` is a short clause describing how (deflection, header, etc.).
  // Returns true (and fully resolves the goal) if the own goal happened,
  // so the caller can bail out of its own normal resolution immediately.
  function maybeOwnGoal(attackingSide, defendingSide, culprit, desc, chance) {
    const m = currentMatch;
    if (!m || !culprit) return false;
    if (seededRandom() >= (chance != null ? chance : 0.01)) return false;
    const attTeam = m[attackingSide], defTeam = m[defendingSide];
    attTeam.score++;
    if (!m.playerMatchStats) m.playerMatchStats = {};
    if (!m.playerMatchStats[culprit.id]) m.playerMatchStats[culprit.id] = blankPlayerMatchStats(culprit);
    // Recorded under its own leaderboard bucket (not 'goals') so it never
    // inflates the defender's own scoring tally or a top-scorer list —
    // same convention real stats sites use.
    recordStat('ownGoals', culprit, defTeam.team);
    // The goal list/timeline just wants a name to show — tagging it in
    // the name itself means every existing renderer (timeline, match
    // report, season history) shows it correctly with no further changes.
    pushGoal(attackingSide, { id: culprit.id, name: culprit.name + ' (OG)', num: culprit.num }, m.minute, 'own goal');
    addEvent(m.minute, 'goal', `${emojiImg('goal', 'Own goal')} Own goal! <span class="player">${culprit.name}</span> (${defTeam.team.short}) ${desc || 'turns it into his own net'}.`, attackingSide, true);
    return true;
  }
/*@CHUNK:c0149:END*/

/*@CHUNK:c0150:START*/
  function maybeOffsideDisallow(side, scorer, minute, moment, extra) {
    const m = currentMatch;
    if (!m) return false;
    moment = moment || 'openplay';
    extra = extra || {};
    // Corners, penalties, and a direct free-kick effort are all exempt from
    // this recheck under the actual Laws of the Game — nobody can be ruled
    // offside receiving directly from a corner, and there's no separate
    // "receiver" to judge on a penalty or the taker's own direct free-kick.
    if (moment === 'corner' || moment === 'penalty' || moment === 'directfreekick') return false;
    if (seededRandom() > 0.16) return false; // ~16% of goals get a check at all
    const team = m[side];
    addEvent(minute, 'var', `📺 VAR checking possible offside in the build-up to ${team.team.short}'s goal...`, side);
    // Reuse the same spatial/temporal offside model that judges a live
    // through ball — passer/receiver advancement, the second-last
    // defender's line, and defensive discipline — rather than a separate,
    // disconnected pace-only roll.
    const result = evaluateOffside(side, scorer, 'openplay');
    let offsideLikely;
    if (result && result.checked) {
      offsideLikely = result.offside ? 0.85 : Math.max(0.04, (result.margin || 0) * 2 + 0.05);
    } else {
      // Fallback for the rare case the spatial model has nothing to judge
      // (e.g. missing formation data mid-transition) — the old pace-only
      // read, so a check never silently does nothing.
      const defLine = calcTeamStrength(m[side === 'home' ? 'away' : 'home']);
      offsideLikely = 0.35 + Math.max(0, (defLine.pac || 70) - (scorer.pac || 70)) / 200;
    }
    if (seededRandom() < offsideLikely) {
      team.score = Math.max(0, team.score - 1);
      // remove last goal from list for this side/scorer
      if (m.goalList && m.goalList.length) {
        for (let i = m.goalList.length - 1; i >= 0; i--) {
          if (m.goalList[i].side === side && m.goalList[i].player === scorer.name) {
            m.goalList.splice(i, 1);
            break;
          }
        }
      }
      // Undo every leaderboard-facing stat this goal touched, in full —
      // not just the two buckets ('stats' and, if a tournament is running,
      // 'tournamentStats') the old code reached into by hand. recordStat()
      // actually fans a goal out to up to four buckets (stats, careerStats,
      // tournamentStats, currentSeasonComp.stats), so a hand-rolled partial
      // undo left careerStats and the active season competition's own
      // stats permanently overcounted — a disallowed goal that still shows
      // up forever in a player's career and season totals even though the
      // match's own boxscore correctly shows it reversed. recordStatCount's
      // -1 goes through the exact same competitive/tournament/season
      // conditionals recordStat used to credit it, so it can only touch a
      // bucket that was actually incremented in the first place.
      recordStatCount('goals', scorer, team.team, -1);
      if (m.playerMatchStats && m.playerMatchStats[scorer.id]) {
        m.playerMatchStats[scorer.id].goals = Math.max(0, (m.playerMatchStats[scorer.id].goals || 1) - 1);
      }
      // The assist (if one was actually credited on this goal) and any
      // Puskás nomination are just as much "goal that never happened" as
      // the goal itself — previously neither was touched at all, so an
      // assister's season/career assist count (and a Puskás contender
      // tally) just kept the credit permanently regardless of the goal
      // being overturned.
      if (extra.assister) {
        recordStatCount('assists', extra.assister, team.team, -1);
        if (m.playerMatchStats && m.playerMatchStats[extra.assister.id]) {
          m.playerMatchStats[extra.assister.id].assists = Math.max(0, (m.playerMatchStats[extra.assister.id].assists || 1) - 1);
        }
      }
      if (extra.puskas) recordStatCount('puskas', scorer, team.team, -1);
      addEvent(minute, 'var', `VAR: Goal disallowed — <span class="player">${scorer.name}</span> was offside`, side);
      renderGoalTimeline();
      return true;
    }
    addEvent(minute, 'var', `VAR: Goal stands — onside`, side);
    return false;
  }
/*@CHUNK:c0150:END*/

/*@CHUNK:c0169:START*/

/*@CHUNK:c0169:END*/

/*@CHUNK:c0170:START*/
  function pickGoalMethod(shooter) {
    const methods = [
      { desc: 'low driven finish across the keeper', xg: 0.38, puskas: false },
      { desc: 'side-footed placement into the far corner', xg: 0.36, puskas: false },
      { desc: 'powerful right-footed strike', xg: 0.33, puskas: false },
      { desc: 'left-footed drive', xg: 0.32, puskas: false },
      { desc: 'towering header', xg: 0.30, puskas: false },
      { desc: 'glancing near-post header', xg: 0.28, puskas: false },
      { desc: 'tap-in from close range', xg: 0.58, puskas: false },
      { desc: 'poacher\'s finish at the far post', xg: 0.48, puskas: false },
      { desc: 'deflected effort that wrong-foots the keeper', xg: 0.22, puskas: false },
      { desc: 'low screamer into the bottom corner', xg: 0.16, puskas: true },
      { desc: 'dipping shot from outside the box', xg: 0.14, puskas: true },
      { desc: 'rising drive that flies into the roof of the net', xg: 0.13, puskas: true },
      { desc: 'knuckleball strike that swerves late', xg: 0.12, puskas: true },
      { desc: 'blitz curler into the top corner', xg: 0.15, puskas: true },
      { desc: 'inch-perfect curled finish around the wall', xg: 0.17, puskas: true },
      { desc: 'chip over the advancing keeper', xg: 0.20, puskas: true },
      { desc: 'first-time volley on the half-turn', xg: 0.18, puskas: true },
      { desc: 'overhead kick', xg: 0.10, puskas: true },
      { desc: 'bicycle kick', xg: 0.09, puskas: true },
      { desc: 'rabona finish', xg: 0.08, puskas: true },
      { desc: 'solo run from halfway, then cool finish', xg: 0.19, puskas: true },
      { desc: 'cut inside and arrowed shot near post', xg: 0.24, puskas: false },
      { desc: 'rebound smashed home', xg: 0.42, puskas: false },
      { desc: 'toe-poke under the keeper', xg: 0.40, puskas: false }
    ];
    // Blitz Curler is a real finishing identity, not just a flavor-pool
    // nudge — but it shouldn't be the ONLY thing they ever score with
    // either (a Blitz Curler striker still gets the occasional tap-in,
    // header, rebound, etc.). So it heavily loads the dice toward the
    // trademark blitz curl finish rather than forcing it every time, and
    // how loaded those dice are scales with blitzCurlerEdge() (Finishing/
    // Curl/Kicking Power) — the same attributes feeding shotQuality
    // upstream in resolveShot() — so a genuinely elite blitz curler pulls
    // it off much more often than one who merely has the skill tag.
    if (hasSkill(shooter, 'Blitz Curler')) {
      const blitzChance = Math.max(0.35, Math.min(0.8, 0.5 + blitzCurlerEdge(shooter) * 1.5));
      if (seededRandom() < blitzChance) {
        const blitz = methods.find(m => m.desc === 'blitz curler into the top corner');
        const flavor = seededRandom() < 0.35 ? styleFlavor(shooter, GOAL_FLAVOR_SUFFIX) : null;
        return flavor ? { ...blitz, desc: `${blitz.desc}, ${flavor}` } : blitz;
      }
      // Otherwise falls through to the normal pool below, same as any
      // other player.
    }
    const spectacular = methods.filter(m => m.puskas);
    const normal = methods.filter(m => !m.puskas);
    const tec = shooter.tec || 70;
    // Weighted pick within a pool: a boosted player's specific traits (a great
    // header, a genuine long-range/curl specialist) skew which finish type
    // they're likely to have scored with, instead of every method in the pool
    // being equally likely regardless of who's shooting.
    const weightedPick = (pool) => {
      if (!shooter.expandedAttrs) return pool[Math.floor(seededRandom() * pool.length)];
      const longKeys = ['screamer', 'dipping', 'rising', 'knuckleball', 'curler', 'curled'];
      const weights = pool.map((m) => {
        const d = m.desc.toLowerCase();
        let w = 1;
        if (d.includes('header')) w *= aerialSkill(shooter) * 2;
        else if (longKeys.some(k => d.includes(k))) w *= Math.max(0.2, 1 + fkTakerEdge(shooter) * 3);
        else if (d.includes('tap-in') || d.includes('poacher') || d.includes('toe-poke') || d.includes('rebound')) w *= Math.max(0.2, 1 + finishingEdge(shooter));
        return Math.max(0.05, w);
      });
      const total = weights.reduce((a, b) => a + b, 0);
      let r = seededRandom() * total;
      for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
      return pool[pool.length - 1];
    };
    const chosen = (tec > 88 && seededRandom() < 0.42) ? weightedPick(spectacular)
      : (tec > 82 && seededRandom() < 0.28) ? weightedPick(spectacular)
      : (seededRandom() < 0.18 ? weightedPick(spectacular) : weightedPick(normal));
    // Roughly a third of the time, tack on a playstyle-specific clause
    // describing *how* the scorer got there — the same "tap-in" reads
    // differently for a Fox in the Box than for a Full-back Finisher.
    const flavor = seededRandom() < 0.35 ? styleFlavor(shooter, GOAL_FLAVOR_SUFFIX) : null;
    return flavor ? { ...chosen, desc: `${chosen.desc}, ${flavor}` } : chosen;
  }
/*@CHUNK:c0170:END*/

/*@CHUNK:c0171:START*/

/*@CHUNK:c0171:END*/

/*@CHUNK:c0172:START*/
  function pickMissDesc(shooter) {
    const foot = seededRandom() < 0.55 ? 'right footed' : 'left footed';
    const areas = [
      foot + ' shot from outside the box misses to the left',
      foot + ' shot from outside the box is too high',
      foot + ' shot from the centre of the box misses to the right',
      foot + ' shot from the right side of the box is close, but misses to the left',
      foot + ' shot from the left side of the box misses to the right',
      'header from the centre of the box misses to the left',
      'header from the centre of the box is too high',
      foot + ' shot from outside the box is blocked',
      foot + ' shot from the centre of the box is blocked',
      foot + ' shot from a difficult angle on the right misses to the left',
      'first-time ' + foot + ' shot from outside the box is high and wide to the left',
      foot + ' volley from the centre of the box is too high'
    ];
    return areas[Math.floor(seededRandom() * areas.length)];
  }
/*@CHUNK:c0172:END*/

/*@CHUNK:c0173:START*/

/*@CHUNK:c0173:END*/

/*@CHUNK:c0174:START*/
  function sofascoreMiss(shooter, team) {
    return 'Attempt missed. <span class="player">' + shooter.name + '</span> (' + (team.short || team.name) + ') ' + pickMissDesc(shooter) + '.';
  }
/*@CHUNK:c0174:END*/

/*@CHUNK:c0179:START*/

  // A real move name (from player-attributes.json's skills list) -> a bank
  // of specific descriptions for it. Two players who both have "Flip Flap"
  // will still see varied wording match to match, but the move named is
  // always the one actually on their sheet — not a random unrelated skill.
  const SKILL_MOVE_TEXT = {
    'Chop Turn': [
      (a, o) => `${a} drags the ball back with a sharp chop turn, spinning away from ${o}`,
      (a, o) => `${a} chops the ball inside off one touch, leaving ${o} facing the wrong way`
    ],
    'Cut Behind & Turn': [
      (a, o) => `${a} shields the ball, cuts it behind his standing leg and spins ${o} clean out of the contest`,
      (a, o) => `${a} rolls it behind his heel and turns away from ${o} in one motion`
    ],
    'Double Touch': [
      (a, o) => `${a} sends ${o} the wrong way with a lightning double touch`,
      (a, o) => `${a} touches it one way then the other — ${o} is left grasping at thin air`
    ],
    'Flip Flap': [
      (a, o) => `${a} pulls out an audacious flip flap and ${o} simply isn't there anymore`,
      (a, o) => `${a} rocks ${o} with a flip flap and glides past`
    ],
    'Marseille Turn': [
      (a, o) => `${a} spins out of a tight spot with a Marseille turn, leaving ${o} chasing shadows`,
      (a, o) => `${a} rolls through a full 360 to shake off ${o}`
    ],
    'Scissors Feint': [
      (a, o) => `${a} scissors his feet over the ball and ${o} bites on the fake`,
      (a, o) => `${a} sends ${o} the wrong way with a scissors feint before accelerating away`
    ],
    'Sole Control': [
      (a, o) => `${a} drags the ball back under his sole, wrong-footing ${o} completely`,
      (a, o) => `${a} rolls it under his foot and ${o} lunges into empty space`
    ],
    'Sombrero': [
      (a, o) => `${a} flicks it up and over ${o}'s head with an outrageous sombrero`,
      (a, o) => `${a} lobs the ball over ${o} with a sombrero flick and collects it on the other side`
    ]
  };
  const GENERIC_MOVE_NAMES = ['elastico', 'roulette', 'step-over', 'body feint', 'shoulder drop', 'stop-and-go', 'drag-back'];

/*@CHUNK:c0179:END*/

/*@CHUNK:c0180:START*/
  function pickSkillDesc(player, opponent) {
    const opp = opponent ? opponent.name : 'the defender';
    const nameTag = `<span class="player">${player.name}</span>`;
    // Prefer whatever real skill moves are actually on this player's sheet
    // (player-attributes.json), so the commentary names the move he
    // genuinely has rather than a random generic one.
    const ownMoves = ((player && player.expandedAttrs && player.expandedAttrs.skills) || [])
      .filter((s) => SKILL_MOVE_TEXT[s]);
    let base;
    if (ownMoves.length) {
      const move = ownMoves[Math.floor(seededRandom() * ownMoves.length)];
      const templates = SKILL_MOVE_TEXT[move];
      base = templates[Math.floor(seededRandom() * templates.length)](nameTag, opp);
    } else {
      const move = GENERIC_MOVE_NAMES[Math.floor(seededRandom() * GENERIC_MOVE_NAMES.length)];
      const ends = [
        `beats ${opp} with a ${move}`,
        `uses a ${move} to leave ${opp} on the ground`,
        `sells ${opp} with a sharp ${move}`,
        `skins ${opp} using a ${move} and accelerates clear`,
        `bamboozles ${opp} with a ${move} on the touchline`
      ];
      base = `${nameTag} ${ends[Math.floor(seededRandom() * ends.length)]}`;
    }
    // Layer on a playstyle-specific follow-up, so what happens right after
    // beating the man differs by role, not just the move that beat him.
    const follow = styleFlavor(player, DRIBBLE_FOLLOWUP);
    return follow ? `${base}, ${follow}` : base;
  }
/*@CHUNK:c0180:END*/

/*@CHUNK:c0181:START*/

/*@CHUNK:c0181:END*/

/*@CHUNK:c0182:START*/
  function pickPenOutcome(taker, gk) {
    // precise outcomes for pens
    const outcomes = [
      { scored: true, text: 'sends the keeper the wrong way — bottom left' },
      { scored: true, text: 'smashes high into the top-right corner' },
      { scored: true, text: 'cool finish down the middle as the keeper dives early' },
      { scored: true, text: 'low and hard to the keeper\'s right' },
      { scored: true, text: 'panenka chip that floats under the bar' },
      { scored: false, saved: true, text: 'saved — the keeper guesses correctly and palms it away to his left' },
      { scored: false, saved: true, text: 'saved low to the right — strong hand from the goalkeeper' },
      { scored: false, saved: false, text: 'crashes against the crossbar and stays out' },
      { scored: false, saved: false, text: 'skewed wide of the left post' },
      { scored: false, saved: true, text: 'keeper tips it onto the upright — rebound cleared' }
    ];
    // ~72% base score rate, nudged by the taker's placement/specialist edge
    // and the keeper's penalty-specific edge — so a real penalty specialist
    // genuinely converts more often than a fringe outfield taker, and a
    // shot-stopper with "GK Penalty Saver" genuinely saves more.
    const scoredOnes = outcomes.filter(o => o.scored);
    const missedOnes = outcomes.filter(o => !o.scored);
    // Ice-Cold/Bottler: composure under pressure at the spot, only when the
    // moment actually carries stakes (same computeStakes gate as Big-Game/
    // Fragile in resolveShot above) — a genuinely ice-cold penalty taker in
    // a dead rubber reads no differently from anyone else.
    const m0 = currentMatch;
    const penStakes = m0 ? computeStakes(m0.home.team, m0.away.team, currentSeasonComp || tournament, m0.minute, m0.home.score - m0.away.score) : false;
    let personalityEdge = 0;
    if (penStakes) {
      const personality = (taker.expandedAttrs && taker.expandedAttrs.personality) || [];
      if (personality.includes('Ice-Cold')) personalityEdge += 0.09;
      if (personality.includes('Bottler')) personalityEdge -= 0.12;
    }
    const scoreProb = Math.max(0.35, Math.min(0.95, 0.72 + penTakerEdge(taker) - penGkEdge(gk) + personalityEdge));
    if (seededRandom() < scoreProb) return scoredOnes[Math.floor(seededRandom() * scoredOnes.length)];
    return missedOnes[Math.floor(seededRandom() * missedOnes.length)];
  }
/*@CHUNK:c0182:END*/

/*@CHUNK:c0183:START*/

/*@CHUNK:c0183:END*/

/*@CHUNK:c0184:START*/
  function pickFkOutcome(taker, gk, boost) {
    const outcomes = [
      { scored: true, text: 'whipped curler over the wall into the top corner' },
      { scored: true, text: 'knuckleball that dips late under the bar' },
      { scored: true, text: 'low drive that skids under the jumping wall' },
      { scored: true, text: 'rising shot into the far top corner' },
      { scored: false, saved: false, text: 'cleared off the line after the keeper was beaten' },
      { scored: false, saved: true, text: 'kept out — the keeper tips a curling effort over the bar' },
      { scored: false, saved: false, wall: true, text: 'struck into the wall and spun away for a corner' },
      { scored: false, saved: false, text: 'inches over the crossbar' },
      { scored: false, saved: false, text: 'curls wide of the far post' }
    ];
    const scoredOnes = outcomes.filter(o => o.scored);
    const missedOnes = outcomes.filter(o => !o.scored);
    // Ice-Cold/Bottler: same stakes-gated composure edge as the penalty
    // version above, scaled down for the lower baseline conversion rate
    // a direct free-kick carries.
    const m0 = currentMatch;
    const fkStakes = m0 ? computeStakes(m0.home.team, m0.away.team, currentSeasonComp || tournament, m0.minute, m0.home.score - m0.away.score) : false;
    let personalityEdge = 0;
    if (fkStakes) {
      const personality = (taker.expandedAttrs && taker.expandedAttrs.personality) || [];
      if (personality.includes('Ice-Cold')) personalityEdge += 0.05;
      if (personality.includes('Bottler')) personalityEdge -= 0.07;
    }
    // `boost` — a small edge for a quick restart caught the defence
    // unorganised (see resolveFreeKickRoutine in engine/setpieces.js);
    // defaults to 0 so every existing call site is unaffected.
    const scoreProb = Math.max(0.06, Math.min(0.6, 0.22 + fkTakerEdge(taker) - gkReflexEdge(gk) * 0.4 + (boost || 0) + personalityEdge));
    if (seededRandom() < scoreProb) return scoredOnes[Math.floor(seededRandom() * scoredOnes.length)];
    return missedOnes[Math.floor(seededRandom() * missedOnes.length)];
  }
/*@CHUNK:c0184:END*/

/*@CHUNK:c0210:START*/

  // ---- Shot-type profile: how a chance was created shapes its baseline
  // quality (a through-ball 1-on-1 is a better chance than a hopeful
  // long-range effort; a header off a cross has a lower ceiling but a
  // distinct conversion curve of its own).
  const CHANCE_TYPE_PROFILE = {
    // baseOnTarget values scaled down from the original set (roughly ×0.85)
    // as part of the wider conversion-rate retune below — see resolveShot()
    // for the full explanation of why these needed to come down.
    openplay:    { baseOnTarget: 0.34, baseXg: 0.08, headerWeight: 0 },
    throughball: { baseOnTarget: 0.42, baseXg: 0.15, headerWeight: 0 },
    // headerWeight brought down from 0.72 — at that level nearly three
    // quarters of every cross-type chance was being resolved purely on
    // aerialSkill() (Heading/Jump/Phy Contact), sidelining a non-aerial
    // striker's actual finishing/pace/movement on a huge share of his own
    // team's chances. 0.45 still makes headers the more likely outcome of a
    // cross (realistic), just not an near-total lock.
    cross:       { baseOnTarget: 0.37, baseXg: 0.11, headerWeight: 0.45 },
    // A cutback is a low pull-back across the face of goal to an arriving
    // midfielder — never a header, and a cleaner strike than a generic
    // open-play look since the defence is still turned/side-on.
    cutback:     { baseOnTarget: 0.40, baseXg: 0.135, headerWeight: 0 },
    dribble:     { baseOnTarget: 0.40, baseXg: 0.13, headerWeight: 0 },
    longshot:    { baseOnTarget: 0.24, baseXg: 0.045, headerWeight: 0 },
    counter:     { baseOnTarget: 0.42, baseXg: 0.16, headerWeight: 0 }
  };

  // A "big chance" is a genuinely clear-cut opportunity — read straight off
  // this shot's own real shotQuality (see resolveShot below) rather than a
  // guess reconstructed after the match from key passes/assists/shot counts.
  // shotQuality in this model skews high (only chances that survive
  // build-up make it to a shot at all — median is ~0.77), so the
  // threshold sits well above the midpoint to keep "big chance" meaning
  // the clear-cut minority of shots rather than most of them.
  // Raised from 0.85: at that level, a genuinely elite finisher's shotQuality
  // (which is capped at 0.98 and regularly sits in the low-to-mid 0.90s once
  // finishingEdge/positioningEdge bonuses stack on top of already-high base
  // attributes) cleared the bar on a large share of his shots, not just the
  // clear-cut minority — producing seasons with well over a hundred "big
  // chances" logged for a single elite player. 0.90 keeps the tag meaningful
  // for that tier of player instead of nearly automatic.
  const BIG_CHANCE_QUALITY = 0.90;

  // ===== GK phase (called once a shot is confirmed on target) =====
  // then folds straight back to Shots for a rebound, small % of the time.
/*@CHUNK:c0210:END*/

/*@CHUNK:c0211:START*/
  function resolveShot(attackingSide, defendingSide, shooter, chanceType, opts) {
    opts = opts || {};
    const m = currentMatch;
    if (!m || !shooter) return;
    const attTeam = m[attackingSide], defTeam = m[defendingSide];
    const profile = CHANCE_TYPE_PROFILE[chanceType] || CHANCE_TYPE_PROFILE.openplay;
    const isHeader = profile.headerWeight > 0 && seededRandom() < profile.headerWeight;
    if (isHeader) {
      bumpExtStat(shooter, 'aerialDuels', 1);
      if (opts.marker) bumpExtStat(opts.marker, 'aerialDuels', 1);
    }

    // ---- Shots phase: shot quality drawn straight from the shooter's own
    // finishing-relevant attributes and playstyle edges.
    // Headers used to be scored purely off aerialSkill (Heading/Jump/Phy
    // Contact) with zero regard for the shooter's actual finishing ability —
    // so a genuinely elite finisher who isn't primarily an aerial target
    // (weak Heading rating) got no credit at all for a header chance despite
    // still being the one steering it goalward. finishingEdge() is folded in
    // at half weight: heading ability still leads (this is still a header,
    // not a normal shot), but a top-tier finisher's touch now meaningfully
    // softens a poor Heading rating instead of being fully overridden by it.
    let shotQuality = isHeader
      ? Math.max(0.05, Math.min(0.98, aerialSkill(shooter, false) * 0.8 + positioningEdge(shooter) + finishingEdge(shooter) * 0.5))
      : Math.max(0.05, Math.min(0.98,
          // Every compact stat that feeds a shot runs through the curve
          // before blending — applies to every shooter (expanded sheet or
          // not) since att/tec/ovr/pac are the one thing every player has,
          // so a genuinely elite finisher's rating stops reading as "a
          // decent player plus a flat multiplier" and starts reading as a
          // real tier above a merely-good one.
          // `att` is itself derived from finishing/off-the-ball positioning/
          // heading/placement/kicking-power (see deriveStatsFromAttributes in
          // data/playerDatabase.js) — i.e. it IS the shooting-specific
          // composite — so it now carries most of the weight here. `tec`
          // (ball control/dribbling/passing/curl) is playmaking ability, not
          // shooting ability, so it's down-weighted to a small nudge instead
          // of being able to inflate shotQuality for a technical player who
          // isn't actually a good finisher. The dedicated finishingEdge()/
          // positioningEdge() skill-specific bonuses below are unchanged.
          (curvedAttr(shooter.att || 70, 70) * 0.62 + curvedAttr(shooter.tec || 70, 70) * 0.10
            + curvedAttr(shooter.ovr || 75, 75) * 0.18 + curvedAttr(shooter.pac || 70, 70) * 0.10) / 100 * conditionMultiplier(shooter)
          + finishingEdge(shooter)
          + positioningEdge(shooter)
          + blitzCurlerEdge(shooter)
          + (chanceType === 'dribble' ? dribbleSuccessEdge(shooter) * 0.5 : 0)
          + (chanceType === 'longshot' ? fkTakerEdge(shooter) * 0.6 : 0)));
    shotQuality = Math.max(0.05, Math.min(0.98, shotQuality + (opts.qualityBonus || 0)));
    // Personality tags (player-attributes.json "personality", optional —
    // undefined for anyone without a hand-authored entry, so this is a
    // no-op for the vast majority of players).
    const personality = (shooter.expandedAttrs && shooter.expandedAttrs.personality) || [];
    // Big-Game/Fragile only kick in when the moment actually carries
    // stakes (derby / final / close-and-late).
    const stakes = computeStakes(m.home.team, m.away.team, currentSeasonComp || tournament, m.minute, m.home.score - m.away.score);
    // Every personality edge below used to be its own sequential
    // `shotQuality *=` — fine for a single tag, but a player who legitimately
    // holds several at once (Big-Game + Confidence Player + Finisher's
    // Instinct + Talisman is a perfectly normal combination in a tight,
    // late cup match) had those multipliers chain on top of each other
    // (1.15 * 1.09 * 1.12 * 1.03 ≈ +45%) rather than simply add up. They're
    // now collected as one combined relative edge and applied once, so five
    // separate +15% tags add to +75%, not compound toward doubling.
    //
    // That combined edge is then applied as headroom — closing that share
    // of the gap remaining to the quality cap/floor — instead of scaling
    // shotQuality directly. A flat multiplier rewards an already-elite
    // finisher (shotQuality already sitting close to the 0.98 ceiling) with
    // a far bigger *absolute* jump than it gives a merely-good one, which is
    // backwards from every curve elsewhere in this file and is what made
    // Big-Game alone such an enormous swing for a team's best players —
    // effectively a near-automatic finish in a big moment. Headroom scaling
    // keeps the same "edge in a big moment" idea without a top-tier player
    // basically guaranteeing the chance, and it naturally self-limits even
    // when several bonuses stack.
    let personalityEdge = 0;
    if (stakes) {
      if (personality.includes('Big-Game')) personalityEdge += 0.15;
      if (personality.includes('Fragile')) personalityEdge -= 0.15;
    }
    // Confidence Player: composure builds while he's on a live scoring run
    // this match and evaporates the moment an effort doesn't end in a goal
    // (see the reset/bump at the miss/save/goal points below) — a genuine
    // per-match momentum read, distinct from the season-long liveRating/
    // condition system in form.js. Capped at 3 stacks so a hot streak is a
    // meaningful edge without becoming a lock.
    if (personality.includes('Confidence Player')) {
      const momentum = Math.min(3, (m.personalityMomentum && m.personalityMomentum[shooter.id]) || 0);
      if (momentum > 0) personalityEdge += momentum * 0.03;
    }
    // Finisher's Instinct: extra late-game shot-quality bump distinct from
    // Big-Game's stakes gate above — fires purely off the clock, any
    // scoreline, including a dead rubber Big-Game's derby/final/close-
    // and-late gate would never trigger for.
    if (personality.includes("Finisher's Instinct") && m.minute > 80) personalityEdge += 0.12;
    // Talisman aura: teammates play with a touch more composure while
    // he's out there with them — same aura pattern as the existing
    // Captaincy fatigue/form hooks, just read locally here since it only
    // touches shot quality.
    const onIdsTalisman = attackingSide === 'home' ? m.homeOnPitch : m.awayOnPitch;
    if ((attTeam.squad.all || []).some(x => onIdsTalisman.includes(x.id) && ((x.expandedAttrs && x.expandedAttrs.personality) || []).includes('Talisman'))) {
      personalityEdge += 0.03;
    }
    // Homebody: genuinely worse away from home, nothing to do with stakes.
    if (personality.includes('Homebody') && attackingSide === 'away') personalityEdge -= 0.07;
    // Belt-and-braces cap on the combined edge itself — even a player who
    // somehow holds every stacking tag at once can't turn this into a
    // guaranteed goal or a guaranteed miss.
    personalityEdge = Math.max(-0.5, Math.min(0.5, personalityEdge));
    if (personalityEdge > 0) shotQuality += (0.98 - shotQuality) * personalityEdge;
    else if (personalityEdge < 0) shotQuality += (shotQuality - 0.05) * personalityEdge;
    shotQuality = Math.max(0.05, Math.min(0.98, shotQuality));
    // Genuinely clear-cut chance, read straight off this shot's own final
    // quality — everything downstream that doesn't end in a goal marks it
    // missed instead of converted.
    const isBigChance = shotQuality >= BIG_CHANCE_QUALITY;
    if (isBigChance) {
      bumpExtStat(shooter, 'bigChances', 1);
      // Big Chances Created credits the actual creator of a genuinely
      // clear-cut opportunity — the same assistCandidate condition (a real
      // pass, not the shooter setting himself up) that governs whether an
      // eventual goal here earns an assist, not just any pass that led to
      // any shot regardless of quality.
      if (opts.assistCandidate) bumpExtStat(opts.assistCandidate, 'bigChancesCreated', 1);
    }
    // Expected Assists (xA): real-world xA is the sum of the xG of every
    // shot a player's pass led to, tallied at the moment of the shot —
    // not just the shots that actually went in. Previously this model only
    // ever added to xa on the rare shot that both had an assistCandidate
    // AND scored, so a player creating dozens of good chances a season that
    // mostly got saved or blocked (the normal outcome, even for a big
    // chance) ended up with an xa total barely above his actual assist
    // count instead of well above it. Crediting it here, off this shot's own
    // xG, keeps it linked to shot quality — a big chance contributes far
    // more xa than a low-percentage effort — the same way it would from any
    // other pass, on target or not.
    if (opts.assistCandidate && opts.assistCandidate.id !== shooter.id) {
      const shotXg = profile.baseXg + shotQuality * 0.3;
      if (!m.playerMatchStats[opts.assistCandidate.id]) m.playerMatchStats[opts.assistCandidate.id] = blankPlayerMatchStats(opts.assistCandidate);
      m.playerMatchStats[opts.assistCandidate.id].xa += shotXg;
    }
    // Kicking Power feeds the shot's raw power independently of placement —
    // used below in the GK phase so a fiercely struck effort is genuinely
    // harder to keep out/hold onto than a technically similar but softer one.
    const shotPower = shotPowerOf(shooter);
    if (!m.playerMatchStats) m.playerMatchStats = {};
    if (!m.playerMatchStats[shooter.id]) m.playerMatchStats[shooter.id] = blankPlayerMatchStats(shooter);

    // A defender in the shot's path can block it before it's even on target.
    const blocker = pickPlayer(defTeam, ['CB', 'CDM', 'RB', 'LB']);
    const blockSkill = blocker ? defensivePressure(blocker) / 100 : 0.6;
    const blockChance = Math.max(0.04, Math.min(0.28, 0.15 + blockSkill * 0.10 - shotQuality * 0.10));
    if (seededRandom() < blockChance) {
      // Extremely rare: a blocking body gets the deflection badly wrong and
      // loops it past his own keeper. Own goals stay a genuine rarity —
      // this only fires for a sliver of blocked efforts, same real-world
      // order of magnitude as own goals actually turning up in football.
      if (blocker && maybeOwnGoal(attackingSide, defendingSide, blocker, 'deflects the blocked effort into his own net')) {
        return;
      }
      defTeam.stats.blocks = (defTeam.stats.blocks || 0) + 1;
      if (blocker) {
        if (!m.playerMatchStats[blocker.id]) m.playerMatchStats[blocker.id] = blankPlayerMatchStats(blocker);
        m.playerMatchStats[blocker.id].blocks = (m.playerMatchStats[blocker.id].blocks || 0) + 1;
      }
      m.playerMatchStats[shooter.id].xg += profile.baseXg * 0.4;
      if (isBigChance) bumpExtStat(shooter, 'bigChancesMissed', 1);
      if (blocker && seededRandom() < 0.4) {
        addEvent(m.minute, 'shot', `Attempt blocked. Blocked by <span class="player">${blocker.name}</span> (${defTeam.team.short}).`, defendingSide);
      } else {
        addEvent(m.minute, 'miss', sofascoreMiss(shooter, attTeam.team), attackingSide);
      }
      // A blocked effort loops behind for a corner far more often than
      // the old flat 40% allowed.
      if (seededRandom() < 0.55) resolveCorner(attackingSide);
      return;
    }

    const defAvg = calcTeamStrength(defTeam).def / 100;
    // Retuned so a full shot -> goal pipeline lands close to real-world
    // conversion (~33% of shots on target actually score, ~10% of all
    // shots become goals) instead of the old formula's ~48%/~22%, which
    // was producing far more goals — and far fewer clean sheets — than a
    // real match. Defensive quality now also weighs more heavily against
    // the shot getting on target in the first place.
    const onTargetChance = Math.min(0.62, Math.max(0.06, profile.baseOnTarget + shotQuality * 0.32 - defAvg * 0.28 + (opts.onTargetBonus || 0)));
    if (seededRandom() >= onTargetChance) {
      m.playerMatchStats[shooter.id].xg += profile.baseXg * 0.5 + seededRandom() * 0.05;
      if (isBigChance) bumpExtStat(shooter, 'bigChancesMissed', 1);
      if (personality.includes('Confidence Player')) {
        if (!m.personalityMomentum) m.personalityMomentum = {};
        m.personalityMomentum[shooter.id] = 0;
      }
      addEvent(m.minute, 'miss', sofascoreMiss(shooter, attTeam.team), attackingSide);
      // Note: through-ball offside is now judged spatially, up front, in
      // resolveChanceCreation() before the shot is ever attempted — see
      // checkLiveOffside() in engine/offside.js — so there's no separate
      // flat-probability offside roll here anymore.
      return;
    }

    attTeam.stats.shotsOn++;
    // ===== GK phase =====
    // A close-range effort (open play at close quarters, a dribble past
    // the last man, or a cross put away first-time) gives the keeper far
    // less reaction time than a longshot or a header he's had time to
    // set for — resolveGkSave() weights gk_reflex vs. gk_reach by exactly
    // that context, so the two attributes actually mean different things
    // in different situations instead of being interchangeable.
    const gk = activeGoalkeeper(defendingSide);
    // Post-shot xG faced: tallied live, per shot actually on target, from
    // this exact shot's own real quality — the same read used for the
    // shooter's own xg a few lines below — instead of shotsFaced times a
    // random per-match factor.
    if (gk) bumpExtStat(gk, 'psxg', +(profile.baseXg + shotQuality * 0.3).toFixed(3));
    const closeRangeShot = !isHeader && (chanceType === 'dribble' || chanceType === 'openplay' || chanceType === 'counter' || chanceType === 'cutback');
    const saveResult = resolveGkSave(gk, shooter, shotQuality, { isHeader, chanceType, shotPower, closeRange: closeRangeShot });
    if (saveResult.saved) {
      // A shot the keeper has to save was still a real, on-target chance —
      // it needs to add to the shooter's xG just like a blocked or off-target
      // effort does a few lines up. This was previously the one shot outcome
      // that contributed nothing to xg at all, which meant the shots most
      // likely to come from a genuine big chance (on target, therefore
      // saveable) were exactly the ones missing from the season xG total —
      // hence a big-chance-heavy, high-miss season reading as low-xG.
      m.playerMatchStats[shooter.id].xg += profile.baseXg + shotQuality * 0.3;
      if (personality.includes('Confidence Player')) {
        if (!m.personalityMomentum) m.personalityMomentum = {};
        m.personalityMomentum[shooter.id] = 0;
      }
      if (isBigChance) bumpExtStat(shooter, 'bigChancesMissed', 1);
      if (gk) {
        defTeam.stats.saves++;
        recordStat('saves', gk, defTeam.team);
        if (!m.playerMatchStats[gk.id]) m.playerMatchStats[gk.id] = blankPlayerMatchStats(gk);
        m.playerMatchStats[gk.id].saves = (m.playerMatchStats[gk.id].saves || 0) + 1;
        // A cross (or cutback) the keeper deals with is a real cross
        // stopped — a clean take is a claim, anything else he keeps out
        // is a punch, same distinction the save type already encodes.
        if (chanceType === 'cross' || chanceType === 'cutback') {
          bumpExtStat(gk, 'crossesStopped', 1);
          if (saveResult.saveType === 'catch') bumpExtStat(gk, 'claims', 1);
          else bumpExtStat(gk, 'punches', 1);
        }
        const desc = saveResult.saveType === 'catch' ? pickCatchDesc(gk, shooter) : pickSaveDesc(gk, shooter);
        addEvent(m.minute, 'save', desc, attackingSide);
        // Only a parry (not a clean catch) can leave a rebound behind, and
        // how likely that rebound actually is comes straight from the
        // keeper's own gk_parry rating via saveResult.reboundDanger.
        let reboundTaken = false;
        if (saveResult.saveType === 'parry' && seededRandom() < saveResult.reboundDanger) {
          const reboundShooter = pickPlayerWeighted(attTeam, ['ST', 'CAM', 'RW', 'LW'], GOAL_ROLE_WEIGHT, shooter.id);
          if (reboundShooter) {
            reboundTaken = true;
            attTeam.stats.shots++;
            addEvent(m.minute, 'shot', `The rebound falls to <span class="player">${reboundShooter.name}</span>!`, attackingSide);
            resolveShot(attackingSide, defendingSide, reboundShooter, 'openplay', { qualityBonus: 0.16, onTargetBonus: 0.1 });
          }
        }
        // A keeper who can't hold it (parry or punch) with no shot following
        // very often turns it behind for a corner — the most common way a
        // save leads to a set piece in real matches.
        if (!reboundTaken && saveResult.saveType !== 'catch' && seededRandom() < 0.3) {
          resolveCorner(attackingSide);
        }
      }
      return;
    }

    // GOAL
    if (isBigChance && opts.marker) {
      // A genuinely well-drilled defender concedes fewer of his big
      // chances as outright errors than a shaky one — defensivePressure()
      // is the same real skill read used to decide the marker in the
      // first place, so the error rate scales with how good he actually
      // is, not a flat per-position guess.
      const markerQuality = Math.max(0, Math.min(1.3, defensivePressure(opts.marker) / 100));
      const errorChance = Math.max(0.06, Math.min(0.4, 0.34 - markerQuality * 0.2));
      if (seededRandom() < errorChance) bumpExtStat(opts.marker, 'defensiveErrors', 1);
    }
    attTeam.score++;
    if (personality.includes('Confidence Player')) {
      if (!m.personalityMomentum) m.personalityMomentum = {};
      m.personalityMomentum[shooter.id] = (m.personalityMomentum[shooter.id] || 0) + 1;
    }
    const method = isHeader ? { desc: 'towering header', xg: 0.3, puskas: false } : pickGoalMethod(shooter);
    recordStat('goals', shooter, attTeam.team);
    if (method.puskas) recordStat('puskas', shooter, attTeam.team);
    pushGoal(attackingSide, shooter, m.minute, method.desc);
    m.playerMatchStats[shooter.id].goals++;
    m.playerMatchStats[shooter.id].xg += (profile.baseXg + shotQuality * 0.3);
    const assister = opts.assistCandidate;
    let assistCredited = null;
    if (assister && assister.id !== shooter.id && seededRandom() < 0.7) {
      recordStat('assists', assister, attTeam.team);
      if (!m.playerMatchStats[assister.id]) m.playerMatchStats[assister.id] = blankPlayerMatchStats(assister);
      m.playerMatchStats[assister.id].assists++;
      assistCredited = assister;
      // xa for this shot was already credited above at shot-resolution time
      // (see the expected-assists block earlier in this function), so it's
      // not added again here — only the actual assist counter is.
      addEvent(m.minute, 'goal', `Goal! <span class="player">${shooter.name}</span> (${attTeam.team.short}) — ${method.desc}. Assisted by <span class="player">${assister.name}</span>.`, attackingSide, true);
    } else {
      addEvent(m.minute, 'goal', `Goal! <span class="player">${shooter.name}</span> (${attTeam.team.short}) — ${method.desc}.`, attackingSide, true);
    }
    // maybeOffsideDisallow needs to know exactly what this goal credited
    // (assist recipient, Puskás nomination) so a later disallowal can undo
    // precisely those things — see the note on that function for why the
    // old "undo goal stat (best effort)" comment was the actual bug.
    maybeOffsideDisallow(attackingSide, shooter, m.minute, undefined, { assister: assistCredited, puskas: !!method.puskas });
  }
/*@CHUNK:c0211:END*/

/*@CHUNK:c0212:START*/

  // ===== Corner set piece (reached from a blocked cross/shot) =====
/*@CHUNK:c0212:END*/

/*@CHUNK:c0213:START*/
  function resolveCorner(attackingSide) {
    const m = currentMatch;
    if (!m) return;
    const defendingSide = attackingSide === 'home' ? 'away' : 'home';
    const attTeam = m[attackingSide], defTeam = m[defendingSide];
    attTeam.stats.corners = (attTeam.stats.corners || 0) + 1;

    // Routine selection — a corner is no longer one flat resolution. Six
    // realistic deliveries, each with its own target profile and
    // defensive counter: inswinger/outswinger (whipped either way), a
    // near-post flick-on, a far-post header, a dynamic set-up worked to
    // the edge of the box, a crowd-the-keeper scramble ball, or a short
    // corner recycled short.
    const ROUTINE_LABEL = { inswinger: 'inswinging delivery', outswinger: 'outswinging delivery', nearpost: 'near-post flick', farpost: 'far-post header', edge: 'worked to the edge of the box', crowd: 'crowding the keeper', short: 'short corner' };
    const GOAL_DESC = { inswinger: 'header from an inswinging corner', outswinger: 'header from an outswinging corner', nearpost: 'flick-on at the near post', farpost: 'towering header at the far post', edge: 'half-volley from the edge of the box', crowd: 'scrambled in from a crowded six-yard box' };
    const hasShortOption = (attTeam.squad.all || []).some(p => (p.tec || 70) >= 82);
    const roll = seededRandom();
    let routine;
    if (hasShortOption && roll < 0.1) routine = 'short';
    else if (roll < 0.32) routine = 'inswinger';
    else if (roll < 0.5) routine = 'outswinger';
    else if (roll < 0.65) routine = 'nearpost';
    else if (roll < 0.8) routine = 'farpost';
    else if (roll < 0.92) routine = 'crowd';
    else routine = 'edge';
    addEvent(m.minute, 'corner', `Corner for ${attTeam.team.short} — ${ROUTINE_LABEL[routine]}`, attackingSide);

    if (routine === 'short') {
      // Recycled short — rarely a shot on this exact passage, but can
      // still work an opening down the side.
      if (seededRandom() < 0.22) {
        const receiver = pickPlayer(attTeam, ['CM', 'CAM', 'RW', 'LW']);
        if (receiver) resolveChanceCreation(attackingSide, defendingSide, receiver, seededRandom() < 0.5 ? 'L' : 'R');
      }
      return;
    }

    // Defensive setup: zonal marking covers the back-post space and
    // second balls better; man-marking is sharper at matching a specific
    // near-post run or a runner attacking the keeper directly. Either way
    // a genuinely dominant aerial defender assigned to block/screen the
    // main threat trims the chance further.
    const zonal = seededRandom() < 0.5;
    const targetRoles = routine === 'crowd' ? ['ST', 'CB', 'CDM'] : ['ST', 'CB', 'CM', 'CAM'];
    const BASE_CHANCE = { inswinger: 0.062, outswinger: 0.05, nearpost: 0.07, farpost: 0.055, edge: 0.045, crowd: 0.08 };
    let chance = BASE_CHANCE[routine] || 0.05;
    if (zonal && (routine === 'farpost' || routine === 'edge')) chance *= 0.82;
    if (!zonal && (routine === 'nearpost' || routine === 'crowd')) chance *= 0.82;
    const blocker = pickPlayerCustomWeighted(defTeam, ['CB', 'CDM'], (p) => aerialSkill(p, true) * 2);
    if (blocker && aerialSkill(blocker, true) > 0.68) chance *= 0.85;
    // Set-Piece Specialist: a genuine composure edge on corners, same trait
    // that boosts free-kick conversion in resolveFreeKickRoutine (engine/
    // setpieces.js) — always on, no stakes gate.
    if (((attTeam.roles && attTeam.roles.cornerAttackers) || []).some(p => ((p.expandedAttrs && p.expandedAttrs.personality) || []).includes('Set-Piece Specialist'))) {
      chance *= 1.08;
    }

    // The most realistic own-goal source in the whole engine — a crowded
    // box, bodies flying at a cross under pressure, someone gets the
    // header/clearance badly wrong off his own man. Still a small
    // fraction of corners, same as real football.
    if (blocker && maybeOwnGoal(attackingSide, defendingSide, blocker, `turns ${ROUTINE_LABEL[routine] || 'the corner'} into his own net under pressure`, 0.007)) {
      return;
    }

    if (seededRandom() >= chance) return;
    // The designated corner-box attackers (Heading/Jump/Physical Contact
    // formula) are the players actually stationed in the danger areas for
    // this routine — they're more likely to be the one who gets on the
    // end of it, not guaranteed, since a corner is still a scramble.
    const scorer = pickPlayerCustomWeighted(attTeam, targetRoles, (p) => aerialSkill(p, false) * 2 * aerialTargetBoost(attTeam, p.id));
    if (!scorer) return;
    attTeam.stats.shots++;
    if (!m.playerMatchStats) m.playerMatchStats = {};
    if (!m.playerMatchStats[scorer.id]) m.playerMatchStats[scorer.id] = blankPlayerMatchStats(scorer);
    m.playerMatchStats[scorer.id].shots++;
    // Getting on the end of the delivery only earns a shot on goal — it
    // still has to beat the keeper, the same as any other header in the
    // box. Previously this routine credited the goal the instant `chance`
    // succeeded, with no goalkeeper involvement anywhere in the pipeline.
    const gk = activeGoalkeeper(defendingSide);
    const shotQuality = Math.max(0.05, Math.min(0.98, aerialSkill(scorer, false)));
    if (gk) bumpExtStat(gk, 'psxg', +(0.24 + shotQuality * 0.18).toFixed(3));
    const saveResult = resolveGkSave(gk, scorer, shotQuality, { isHeader: true, closeRange: routine === 'nearpost' || routine === 'crowd', chanceType: 'cross' });
    m.playerMatchStats[scorer.id].xg += 0.24 + seededRandom() * 0.18;
    if (saveResult.saved) {
      attTeam.stats.shotsOn++;
      if (gk) {
        defTeam.stats.saves++;
        recordStat('saves', gk, defTeam.team);
        if (!m.playerMatchStats[gk.id]) m.playerMatchStats[gk.id] = blankPlayerMatchStats(gk);
        m.playerMatchStats[gk.id].saves = (m.playerMatchStats[gk.id].saves || 0) + 1;
        addEvent(m.minute, 'save', `🧤 ${ROUTINE_LABEL[routine]} met by <span class="player">${scorer.name}</span> — ${saveResult.saveType === 'catch' ? pickCatchDesc(gk, scorer) : pickSaveDesc(gk, scorer)}`, attackingSide);
      } else {
        addEvent(m.minute, 'miss', `${ROUTINE_LABEL[routine]} met by <span class="player">${scorer.name}</span> but it drifts off target`, attackingSide);
      }
      return;
    }
    attTeam.stats.shotsOn++;
    attTeam.score++;
    recordStat('goals', scorer, attTeam.team);
    m.playerMatchStats[scorer.id].goals++;
    // Out-swinging/far-post-style deliveries are taken from the side that
    // suits the right-footed/left-footed swing; in-swinging/near-post-style
    // ones from the other. Falls back to the generic pick if the
    // designated taker isn't on the pitch or is the scorer themselves.
    const onPitchIds = attackingSide === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const preferredCornerTaker = attTeam.roles && ((routine === 'outswinger' || routine === 'farpost' || routine === 'edge') ? attTeam.roles.rightCorner : attTeam.roles.leftCorner);
    const corTaker = (preferredCornerTaker && preferredCornerTaker.id !== scorer.id && onPitchIds.includes(preferredCornerTaker.id))
      ? preferredCornerTaker
      : pickPlayer(attTeam, ['CM', 'CAM', 'RW', 'LW', 'RB', 'LB'], scorer.id);
    if (corTaker && seededRandom() < 0.65) {
      recordStat('assists', corTaker, attTeam.team);
      if (!m.playerMatchStats[corTaker.id]) m.playerMatchStats[corTaker.id] = blankPlayerMatchStats(corTaker);
      m.playerMatchStats[corTaker.id].assists++;
      m.playerMatchStats[corTaker.id].xa += 0.2 + seededRandom() * 0.3;
      // A converted corner routine is, by definition, a clear-cut chance
      // for whoever got on the end of it — same "genuinely big chance"
      // standard resolveShot() applies to open play — so the delivery
      // that created it should count toward the taker's Big Chances
      // Created the same way an open-play assist does. Previously this
      // path credited the assist but never the chance behind it, which
      // is how a player could rack up several corner/set-piece assists
      // a season and still show 0 Big Chances Created.
      bumpExtStat(corTaker, 'bigChancesCreated', 1);
    }
    pushGoal(attackingSide, scorer, m.minute, GOAL_DESC[routine] || 'header from corner');
    addEvent(m.minute, 'goal', `Corner converted (${ROUTINE_LABEL[routine]}). <span class="player">${scorer.name}</span> (${scorer.num || ''}) heads home`, attackingSide, true);
    // Exempt from offside by law — nobody can be offside receiving the
    // ball directly from a corner kick, so no VAR recheck follows.
  }
/*@CHUNK:c0213:END*/
