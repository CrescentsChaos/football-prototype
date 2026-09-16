/*@CHUNK:c0033:START*/
  // Extra shot-quality nudge (roughly ±0.15) from finishing-specific traits
  // a flat att/tec/ovr blend can't see on its own.
/*@CHUNK:c0033:END*/

/*@CHUNK:c0034:START*/
  function finishingEdge(p) {
    if (!p || !p.expandedAttrs) return 0;
    let edge = ((xattr(p, 'fin', 70) - 70) / 100) * 0.5;
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
    // Box-focused playstyles get a distinct finishing edge on top of raw
    // finishing rating, so their identity shows up beyond the stat sheet.
    if (hasStyle(p, 'Fox in the Box')) edge += 0.04;
    if (hasStyle(p, 'Goal Poacher')) edge += 0.03;
    if (hasStyle(p, 'Inside Forward')) edge += 0.025;
    if (hasStyle(p, 'Hole Player')) edge += 0.02;
    if (hasStyle(p, 'Full-back Finisher') || hasStyle(p, 'Extra Frontman')) edge += 0.015;
    return edge;
  }
/*@CHUNK:c0034:END*/

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
    let v = xattr(p, 'head', 60) / 100;
    if (hasSkill(p, 'Aerial Superiority') || hasSkill(p, 'Heading')) v += 0.12;
    if (hasSkill(p, 'Bullet Header')) v += 0.06;
    if (isDefensiveContext && hasSkill(p, 'Aerial Fort')) v += 0.08;
    // A Target Man's whole game is built around winning the aerial duel;
    // defensively-anchored styles also read the flight of a long ball well.
    if (hasStyle(p, 'Target Man')) v += 0.1;
    if (hasStyle(p, 'Anchor Man') || hasStyle(p, 'Destroyer')) v += 0.05;
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
    let edge = ((xattr(p, 'place_kick', 70) - 70) / 100) * 0.35;
    if (hasSkill(p, 'Penalty Specialist')) edge += 0.08;
    if (hasSkill(p, 'Chip Shot Control')) edge += 0.02;
    if (hasStyle(p, 'Fox in the Box') || hasStyle(p, 'Classic No. 10')) edge += 0.03;
    return edge;
  }
/*@CHUNK:c0040:END*/

/*@CHUNK:c0042:START*/
  // Free-kick taker edge — curl/placement plus specialist skills.
/*@CHUNK:c0042:END*/

/*@CHUNK:c0043:START*/
  function fkTakerEdge(p) {
    if (!p || !p.expandedAttrs) return 0;
    let edge = ((xattr(p, 'curl', 70) - 70) / 200) + ((xattr(p, 'place_kick', 70) - 70) / 300);
    if (hasSkill(p, 'Long Range Curler')) edge += 0.05;
    if (hasSkill(p, 'Knuckle Shot')) edge += 0.04;
    if (hasSkill(p, 'Dipping Shot')) edge += 0.03;
    if (hasSkill(p, 'Blitz Curler')) edge += 0.03;
    if (hasSkill(p, 'Outside Curler')) edge += 0.02;
    if (hasStyle(p, 'Creative Playmaker') || hasStyle(p, 'Classic No. 10')) edge += 0.03;
    if (hasStyle(p, 'Cross Specialist') || hasStyle(p, 'Orchestrator')) edge += 0.02;
    return edge;
  }
/*@CHUNK:c0043:END*/

/*@CHUNK:c0044:START*/
  // Dribble/skill-move success edge — dribbling ability plus specific moves.
/*@CHUNK:c0044:END*/

/*@CHUNK:c0045:START*/
  function dribbleSuccessEdge(p) {
    if (!p || !p.expandedAttrs) return 0;
    let edge = ((xattr(p, 'dribb', 70) - 70) / 100) * 0.4;
    const skillMoves = ['Chop Turn', 'Flip Flap', 'Double Touch', 'Marseille Turn', 'Scissors Feint', 'Sole Control', 'Sombrero', 'Cut Behind & Turn', 'Inside Bounce'];
    if (skillMoves.some((s) => hasSkill(p, s))) edge += 0.08;
    if (hasSkill(p, 'Momentum Dribbling')) edge += 0.03;
    if (hasSkill(p, 'Magnetic Feet')) edge += 0.03;
    if (hasSkill(p, 'Acceleration Burst')) edge += 0.02;
    if (hasStyle(p, 'Prolific Winger') || hasStyle(p, 'Inside Forward')) edge += 0.04;
    if (hasStyle(p, 'Roaming Flank') || hasStyle(p, 'Dummy Runner')) edge += 0.03;
    if (hasStyle(p, 'Creative Playmaker')) edge += 0.02;
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
    addEvent(m.minute, 'pen', '⚽ Penalty shootout!', null);
    updateScoreboard();

    // Order the takers list so recognised penalty takers (strikers/wingers, then
    // attacking mids) step up before defenders/holding mids, same as real teams do.
    const penOrderScore = (p) => (p.att || 0) + (PEN_TAKER_ROLE_WEIGHT[p.slot || (p.pos||[])[0]] || 0.4) * 12;
    const homeTakers = (m.home.squad.starting || []).filter(p => !(p.pos||[]).includes('GK')).sort((a,b)=>penOrderScore(b)-penOrderScore(a));
    const awayTakers = (m.away.squad.starting || []).filter(p => !(p.pos||[]).includes('GK')).sort((a,b)=>penOrderScore(b)-penOrderScore(a));

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
    const gk = ((m[oppSide].squad && m[oppSide].squad.all) || []).find(p => (p.pos || [])[0] === 'GK');
    const out = pickPenOutcome(taker, gk);
    const teamShort = m[side].team.short;
    if (out.scored) {
      st[side === 'home' ? 'homePens' : 'awayPens']++;
      addEvent(m.minute, 'pen', `⚽ ${taker.name} (${teamShort}) ${out.text} [${st.homePens}-${st.awayPens}]`, side);
    } else {
      addEvent(m.minute, 'pen', `❌ ${taker.name} (${teamShort}) — ${out.text} [${st.homePens}-${st.awayPens}]`, side);
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

/*@CHUNK:c0149:END*/

/*@CHUNK:c0150:START*/
  function maybeOffsideDisallow(side, scorer, minute, moment) {
    const m = currentMatch;
    if (!m) return false;
    moment = moment || 'openplay';
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
      // undo goal stat (best effort)
      if (stats.goals && stats.goals[scorer.id]) stats.goals[scorer.id].count = Math.max(0, stats.goals[scorer.id].count - 1);
      if (tournament && tournamentStats.goals && tournamentStats.goals[scorer.id]) {
        tournamentStats.goals[scorer.id].count = Math.max(0, tournamentStats.goals[scorer.id].count - 1);
      }
      if (m.playerMatchStats && m.playerMatchStats[scorer.id]) {
        m.playerMatchStats[scorer.id].goals = Math.max(0, (m.playerMatchStats[scorer.id].goals || 1) - 1);
      }
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
    const scoreProb = Math.max(0.35, Math.min(0.95, 0.72 + penTakerEdge(taker) - penGkEdge(gk)));
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
    // `boost` — a small edge for a quick restart caught the defence
    // unorganised (see resolveFreeKickRoutine in engine/setpieces.js);
    // defaults to 0 so every existing call site is unaffected.
    const scoreProb = Math.max(0.06, Math.min(0.6, 0.22 + fkTakerEdge(taker) - gkReflexEdge(gk) * 0.4 + (boost || 0)));
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
    cross:       { baseOnTarget: 0.37, baseXg: 0.11, headerWeight: 0.72 },
    dribble:     { baseOnTarget: 0.40, baseXg: 0.13, headerWeight: 0 },
    longshot:    { baseOnTarget: 0.24, baseXg: 0.045, headerWeight: 0 },
    counter:     { baseOnTarget: 0.42, baseXg: 0.16, headerWeight: 0 }
  };

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

    // ---- Shots phase: shot quality drawn straight from the shooter's own
    // finishing-relevant attributes and playstyle edges.
    let shotQuality = isHeader
      ? aerialSkill(shooter, false)
      : Math.max(0.05, Math.min(0.98,
          ((shooter.att || 70) * 0.42 + (shooter.tec || 70) * 0.33 + (shooter.ovr || 75) * 0.15 + (shooter.pac || 70) * 0.10) / 100
          + finishingEdge(shooter)
          + (chanceType === 'dribble' ? dribbleSuccessEdge(shooter) * 0.5 : 0)
          + (chanceType === 'longshot' ? fkTakerEdge(shooter) * 0.6 : 0)));
    shotQuality = Math.max(0.05, Math.min(0.98, shotQuality + (opts.qualityBonus || 0)));
    if (!m.playerMatchStats) m.playerMatchStats = {};
    if (!m.playerMatchStats[shooter.id]) m.playerMatchStats[shooter.id] = blankPlayerMatchStats(shooter);

    // A defender in the shot's path can block it before it's even on target.
    const blocker = pickPlayer(defTeam, ['CB', 'CDM', 'RB', 'LB']);
    const blockSkill = blocker ? defensivePressure(blocker) / 100 : 0.6;
    const blockChance = Math.max(0.04, Math.min(0.28, 0.15 + blockSkill * 0.10 - shotQuality * 0.10));
    if (seededRandom() < blockChance) {
      defTeam.stats.blocks = (defTeam.stats.blocks || 0) + 1;
      if (blocker) {
        if (!m.playerMatchStats[blocker.id]) m.playerMatchStats[blocker.id] = blankPlayerMatchStats(blocker);
        m.playerMatchStats[blocker.id].blocks = (m.playerMatchStats[blocker.id].blocks || 0) + 1;
      }
      m.playerMatchStats[shooter.id].xg += profile.baseXg * 0.4;
      if (blocker && seededRandom() < 0.4) {
        addEvent(m.minute, 'shot', `Attempt blocked. Blocked by <span class="player">${blocker.name}</span> (${defTeam.team.short}).`, defendingSide);
      } else {
        addEvent(m.minute, 'miss', sofascoreMiss(shooter, attTeam.team), attackingSide);
      }
      if (seededRandom() < 0.4) resolveCorner(attackingSide);
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
      addEvent(m.minute, 'miss', sofascoreMiss(shooter, attTeam.team), attackingSide);
      // Note: through-ball offside is now judged spatially, up front, in
      // resolveChanceCreation() before the shot is ever attempted — see
      // checkLiveOffside() in engine/offside.js — so there's no separate
      // flat-probability offside roll here anymore.
      return;
    }

    attTeam.stats.shotsOn++;
    // ===== GK phase =====
    const gk = pickPlayer(defTeam, ['GK']);
    const gkSkill = Math.max(0.05, Math.min(0.98, (gk ? ((gk.def || 70) * 0.5 + (gk.ovr || 75) * 0.3 + (gk.tec || 70) * 0.2) / 100 : 0.7) + gkReflexEdge(gk)));
    const saveChance = Math.min(0.94, Math.max(0.34, 0.56 + gkSkill * 0.38 - shotQuality * 0.24 - (isHeader ? 0.03 : 0)));
    if (seededRandom() < saveChance) {
      if (gk) {
        defTeam.stats.saves++;
        recordStat('saves', gk, defTeam.team);
        if (!m.playerMatchStats[gk.id]) m.playerMatchStats[gk.id] = blankPlayerMatchStats(gk);
        m.playerMatchStats[gk.id].saves = (m.playerMatchStats[gk.id].saves || 0) + 1;
        addEvent(m.minute, 'save', pickSaveDesc(gk, shooter), attackingSide);
        if (seededRandom() < 0.08) {
          const reboundShooter = pickPlayerWeighted(attTeam, ['ST', 'CAM', 'RW', 'LW'], GOAL_ROLE_WEIGHT, shooter.id);
          if (reboundShooter) {
            attTeam.stats.shots++;
            addEvent(m.minute, 'shot', `The rebound falls to <span class="player">${reboundShooter.name}</span>!`, attackingSide);
            resolveShot(attackingSide, defendingSide, reboundShooter, 'openplay', { qualityBonus: 0.16, onTargetBonus: 0.1 });
          }
        }
      }
      return;
    }

    // GOAL
    attTeam.score++;
    const method = isHeader ? { desc: 'towering header', xg: 0.3, puskas: false } : pickGoalMethod(shooter);
    recordStat('goals', shooter, attTeam.team);
    if (method.puskas) recordStat('puskas', shooter, attTeam.team);
    pushGoal(attackingSide, shooter, m.minute, method.desc);
    m.playerMatchStats[shooter.id].goals++;
    m.playerMatchStats[shooter.id].xg += (profile.baseXg + shotQuality * 0.3);
    const assister = opts.assistCandidate;
    if (assister && assister.id !== shooter.id && seededRandom() < 0.7) {
      recordStat('assists', assister, attTeam.team);
      if (!m.playerMatchStats[assister.id]) m.playerMatchStats[assister.id] = blankPlayerMatchStats(assister);
      m.playerMatchStats[assister.id].assists++;
      m.playerMatchStats[assister.id].xa += 0.3 + seededRandom() * 0.4;
      addEvent(m.minute, 'goal', `Goal! <span class="player">${shooter.name}</span> (${attTeam.team.short}) — ${method.desc}. Assisted by <span class="player">${assister.name}</span>.`, attackingSide, true);
    } else {
      addEvent(m.minute, 'goal', `Goal! <span class="player">${shooter.name}</span> (${attTeam.team.short}) — ${method.desc}.`, attackingSide, true);
    }
    maybeOffsideDisallow(attackingSide, shooter, m.minute);
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

    if (seededRandom() >= chance) return;
    const scorer = pickPlayerCustomWeighted(attTeam, targetRoles, (p) => aerialSkill(p, false) * 2);
    if (!scorer) return;
    attTeam.stats.shots++;
    attTeam.stats.shotsOn++;
    attTeam.score++;
    recordStat('goals', scorer, attTeam.team);
    if (!m.playerMatchStats) m.playerMatchStats = {};
    if (!m.playerMatchStats[scorer.id]) m.playerMatchStats[scorer.id] = blankPlayerMatchStats(scorer);
    m.playerMatchStats[scorer.id].goals++;
    m.playerMatchStats[scorer.id].xg += 0.24 + seededRandom() * 0.18;
    const corTaker = pickPlayer(attTeam, ['CM', 'CAM', 'RW', 'LW', 'RB', 'LB'], scorer.id);
    if (corTaker && seededRandom() < 0.65) {
      recordStat('assists', corTaker, attTeam.team);
      if (!m.playerMatchStats[corTaker.id]) m.playerMatchStats[corTaker.id] = blankPlayerMatchStats(corTaker);
      m.playerMatchStats[corTaker.id].assists++;
      m.playerMatchStats[corTaker.id].xa += 0.2 + seededRandom() * 0.3;
    }
    pushGoal(attackingSide, scorer, m.minute, GOAL_DESC[routine] || 'header from corner');
    addEvent(m.minute, 'goal', `Corner converted (${ROUTINE_LABEL[routine]}). <span class="player">${scorer.name}</span> (${scorer.num || ''}) heads home`, attackingSide, true);
    // Exempt from offside by law — nobody can be offside receiving the
    // ball directly from a corner kick, so no VAR recheck follows.
  }
/*@CHUNK:c0213:END*/
