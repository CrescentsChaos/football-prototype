/*@CHUNK:c0216:START*/

  // ===== Fouls / cards (reached from a lost duel or lost pass) =====
  // A challenge that happened as the attack was trying to break into the
  // final third has a real chance of being a penalty rather than a free-kick.
  // Every foul is logged here — this is the single source of truth for the
  // fouls stat, cards, and any resulting penalty, so any event that reads as
  // "a foul happened" (including a direct free-kick) always has exactly one
  // matching entry in defTeam.stats.fouls / m.foulCounts behind it.
  // Returns an outcome tag ('penalty' | 'red' | 'yellow' | 'foul') so callers
  // can decide what, if anything, can still follow (e.g. a direct free-kick
  // shouldn't be taken if the fouler just saw red on the same passage of play).
/*@CHUNK:c0216:END*/

/*@CHUNK:c0217:START*/
  function resolveFoul(defendingSide, attackingSide, fouler, victim, nearBox, forcePenalty, context) {
    const m = currentMatch;
    if (!m || !fouler) return { outcome: 'none' };
    const defTeam = m[defendingSide], attTeam = m[attackingSide];
    defTeam.stats.fouls++;
    if (!m.foulCounts) m.foulCounts = { home: {}, away: {} };
    m.foulCounts[defendingSide][fouler.id] = (m.foulCounts[defendingSide][fouler.id] || 0) + 1;
    const foulCount = m.foulCounts[defendingSide][fouler.id];
    const alreadyYellow = (m.cards[defendingSide][fouler.id] || 0) >= 1;
    let aggression = foulProneness(fouler);
    // Personality tags (player-attributes.json "personality", optional —
    // undefined for anyone without a hand-authored entry, so this is a
    // no-op for the vast majority of players).
    const personality = (fouler.expandedAttrs && fouler.expandedAttrs.personality) || [];
    if (personality.includes('Volatile')) aggression *= 1.3;
    if (personality.includes('Calm')) aggression *= 0.8;
    // Provocateur: reads off the VICTIM's tag, not the fouler's — a player
    // who knows how to draw contact raises the marker's foul probability
    // just by being the one they're up against.
    if (victim) {
      const victimPersonality = (victim.expandedAttrs && victim.expandedAttrs.personality) || [];
      if (victimPersonality.includes('Provocateur')) aggression *= 1.2;
    }
    const foulText = victim
      ? `<span class="player">${fouler.name}</span> fouls <span class="player">${victim.name}</span>`
      : `Foul by <span class="player">${fouler.name}</span>`;

    if (nearBox && (forcePenalty || seededRandom() < 0.065)) {
      addEvent(m.minute, 'foul', foulText + ' — inside the area!', defendingSide);
      const onPitchIds = attackingSide === 'home' ? m.homeOnPitch : m.awayOnPitch;
      const designatedTaker = attTeam.roles && attTeam.roles.penalty;
      const taker = (designatedTaker && onPitchIds.includes(designatedTaker.id))
        ? designatedTaker
        : (pickPlayerWeighted(attTeam, ['ST', 'RW', 'LW', 'CAM', 'CM'], PEN_TAKER_ROLE_WEIGHT) || victim);
      if (taker) {
        addEvent(m.minute, 'pen', `Penalty to ${attTeam.team.short}. <span class="player">${taker.name}</span> on the spot.`, attackingSide);
        attTeam.stats.shots++;
        if (!m.playerMatchStats) m.playerMatchStats = {};
        if (!m.playerMatchStats[taker.id]) m.playerMatchStats[taker.id] = blankPlayerMatchStats(taker);
        m.playerMatchStats[taker.id].shots++;
        const penGk = activeGoalkeeper(defendingSide);
        const po = pickPenOutcome(taker, penGk);
        if (po.scored) {
          attTeam.stats.shotsOn++;
          attTeam.score++;
          recordStat('goals', taker, attTeam.team);
          m.playerMatchStats[taker.id].goals++;
          m.playerMatchStats[taker.id].xg += 0.76 + seededRandom() * 0.08;
          pushGoal(attackingSide, taker, m.minute, 'penalty — ' + po.text);
          addEvent(m.minute, 'goal', `${emojiImg('penalty_goal', 'Penalty goal')} Penalty goal! <span class="player">${taker.name}</span> ${po.text}`, attackingSide, true, true);
          maybeOffsideDisallow(attackingSide, taker, m.minute, 'penalty');
        } else {
          if (po.saved) {
            attTeam.stats.shotsOn++;
            if (penGk) {
              defTeam.stats.saves++;
              recordStat('saves', penGk, defTeam.team);
              if (!m.playerMatchStats[penGk.id]) m.playerMatchStats[penGk.id] = blankPlayerMatchStats(penGk);
              m.playerMatchStats[penGk.id].saves = (m.playerMatchStats[penGk.id].saves || 0) + 1;
            }
            addEvent(m.minute, 'save', `${emojiImg('penalty_miss_saved', 'Penalty saved')} Penalty saved! <span class="player">${taker.name}</span>'s effort ${po.text}${penGk ? ` — <span class="player">${penGk.name}</span> denies it` : ''}`, attackingSide);
          } else {
            addEvent(m.minute, 'miss', `${emojiImg('penalty_miss_saved', 'Penalty missed')} Penalty missed — <span class="player">${taker.name}</span>: ${po.text}`, attackingSide);
          }
        }
      }
      return { outcome: 'penalty' };
    }

    // Realistic discipline curve: a single, isolated foul is very rarely
    // carded (referees give plenty of "just a foul" outcomes) — cards
    // escalate with genuine repeat/reckless fouling rather than being a
    // near-coinflip from the first challenge onward. Tuned so a match
    // produces on the order of 2-4 yellows combined and a red roughly once
    // every 3-4 matches, matching real-world discipline rates.
    // Escalation terms eased further: combined with foulProneness/foul-
    // selection changes upstream (engine/defending.js, engine/transitions.js)
    // that already reduce how often the same high-aggression player racks
    // up a fast foulCount, the old per-repeat/already-yellow bumps could
    // still stack into an unrealistic run of cards once a player did start
    // repeat-fouling. The third-foul kicker now only applies from a fourth
    // foul on, and every increment is smaller, so repeat fouling still
    // clearly raises the odds of a card without turning into a near-certain
    // yellow (or a cheap second yellow) by a player's third or fourth foul.
    // Recalibrated for realistic foul volume (~20+ a match, see
    // simulateRoutineFouls below): with that many fouls the per-foul card
    // rate has to sit near the real-world ~1 yellow per 6-7 fouls, so the
    // base slope is raised while the repeat-offender escalation stays gentle.
    let yellowChance = Math.min(0.45, 0.105 * aggression + (foulCount - 1) * 0.05 + (alreadyYellow ? 0.05 : 0) + (foulCount >= 4 ? 0.04 : 0));
    // Hot-Head: once already booked, a second yellow becomes a genuinely
    // live risk on top of the flat alreadyYellow bump above.
    // Referees are markedly reluctant to send a player off for a second
    // yellow on an ordinary foul — with realistic foul volume, leaving the
    // full escalation in place produced ~4x the real-world red-card rate.
    if (alreadyYellow) yellowChance *= 0.22;
    if (alreadyYellow && personality.includes('Hot-Head')) yellowChance = Math.min(0.6, yellowChance + 0.08);
    // Cynical: the flip side of the extra tactical-foul willingness applied
    // in resolveTurnover (engine/transitions.js) — a professional foul in
    // that same breakaway context draws fewer cards than a genuine mistimed
    // challenge would.
    if (context === 'breakaway' && personality.includes('Cynical')) yellowChance *= 0.6;
    const straightRedChance = 0.0006 * aggression;
    const roll = seededRandom();
    if (roll < straightRedChance && !alreadyYellow) {
      defTeam.stats.reds++;
      recordStat('cards', fouler, defTeam.team);
      recordStat('reds', fouler, defTeam.team);
      if (!m.playerMatchStats) m.playerMatchStats = {};
      if (!m.playerMatchStats[fouler.id]) m.playerMatchStats[fouler.id] = blankPlayerMatchStats(fouler);
      m.playerMatchStats[fouler.id].red = true;
      addEvent(m.minute, 'red', `${emojiImg('red_card', 'Red card')} Straight red! ${foulText} — reckless challenge`, defendingSide);
      removeFromPitch(defendingSide, fouler.id);
      handleRedCardReshuffle(defendingSide, fouler);
      return { outcome: 'red' };
    } else if (roll < straightRedChance + yellowChance) {
      m.cards[defendingSide][fouler.id] = (m.cards[defendingSide][fouler.id] || 0) + 1;
      defTeam.stats.yellows++;
      recordStat('cards', fouler, defTeam.team);
      recordStat('yellows', fouler, defTeam.team);
      if (!m.playerMatchStats) m.playerMatchStats = {};
      if (!m.playerMatchStats[fouler.id]) m.playerMatchStats[fouler.id] = blankPlayerMatchStats(fouler);
      m.playerMatchStats[fouler.id].yellow = true;
      if (m.cards[defendingSide][fouler.id] >= 2) {
        defTeam.stats.reds++;
        recordStat('reds', fouler, defTeam.team);
        m.playerMatchStats[fouler.id].red = true;
        addEvent(m.minute, 'red', `${emojiImg('red_card', 'Red card')} Second yellow → red! ${foulText}`, defendingSide);
        removeFromPitch(defendingSide, fouler.id);
        handleRedCardReshuffle(defendingSide, fouler);
        return { outcome: 'red' };
      } else {
        addEvent(m.minute, 'yellow', `${emojiImg('yellow_card', 'Yellow card')} Yellow card — ${foulText}${foulCount > 1 ? ' (repeated fouls)' : ''}`, defendingSide);
        return { outcome: 'yellow' };
      }
    } else {
      // Routine mid-pitch fouls are all counted, but only some make the
      // live feed — a real text feed doesn't narrate every whistle.
      if (context !== 'routine' || foulCount > 1 || seededRandom() < 0.35) {
        addEvent(m.minute, 'foul', foulText + (foulCount > 1 ? ' — referee has a word' : ''), defendingSide);
      }
      return { outcome: 'foul' };
    }
  }

  // ===== Routine fouls =====
  // The fouls the possession pipeline models (duel losses, tactical fouls,
  // the off-ball defensive loop) only add up to ~6 a match — real football
  // sits around 20-25, most of them ordinary mid-pitch contact that never
  // becomes a shot. This runs once per minute per side and adds that missing
  // volume: who commits it (weighted by position and foul-proneness), who
  // wins it (dribblers/pacy attackers get fouled most), how often it happens
  // (pressing sides and the weaker side foul more, a side chasing the game
  // late fouls more) — all routed through resolveFoul so cards, foul counts
  // and repeat-offender escalation stay in one place.
  const FOUL_POS_WEIGHT = { CDM: 1.5, CM: 1.25, CB: 1.05, RB: 1.0, LB: 1.0, RWB: 1.0, LWB: 1.0, CAM: 0.65, RM: 0.7, LM: 0.7, RW: 0.6, LW: 0.6, ST: 0.55, CF: 0.55, GK: 0 };
  const FOULED_POS_WEIGHT = { RW: 1.4, LW: 1.4, CAM: 1.2, ST: 1.0, CF: 1.0, CM: 1.0, RM: 1.1, LM: 1.1, CDM: 0.6, RWB: 0.7, LWB: 0.7, RB: 0.6, LB: 0.6, CB: 0.35, GK: 0.02 };
  function simulateRoutineFouls() {
    const m = currentMatch;
    if (!m) return;
    const dm = m.dispMin != null ? m.dispMin : m.minute;
    ['home', 'away'].forEach(defSide => {
      const attSide = defSide === 'home' ? 'away' : 'home';
      const defTeam = m[defSide], attTeam = m[attSide];
      const defIds = defSide === 'home' ? m.homeOnPitch : m.awayOnPitch;
      const outfield = (defTeam.squad.all || []).filter(p => defIds.includes(p.id) && (p.slot || (p.pos || [])[0]) !== 'GK');
      if (!outfield.length) return;
      const tac = (m.tactics && m.tactics[defSide]) || 'balanced';
      let rate = 0.075;
      if (tac === 'press') rate *= 1.25;
      else if (tac === 'defend') rate *= 0.9;
      // A side second-best on quality spends more of the game chasing the
      // ball; the stronger side needs to foul less.
      const ownStr = calcTeamStrength(defTeam), oppStr = calcTeamStrength(attTeam);
      rate *= 1 + Math.max(-0.15, Math.min(0.25, ((oppStr.ovr || 75) - (ownStr.ovr || 75)) / 60));
      // Rougher squad, more fouls (league-average foulProneness is ~1).
      rate *= outfield.reduce((s, p) => s + foulProneness(p), 0) / outfield.length;
      // Game state: chasing the game late gets scrappier.
      const diff = (defTeam.score || 0) - (attTeam.score || 0);
      if (dm > 65 && diff < 0) rate *= 1.15;
      if (seededRandom() >= rate) return;
      const fouler = pickPlayerCustomWeighted(defTeam, null, (p) => {
        const slot = p.slot || (p.pos || [])[0] || 'CM';
        return (FOUL_POS_WEIGHT[slot] != null ? FOUL_POS_WEIGHT[slot] : 0.8) * foulProneness(p);
      });
      if (!fouler) return;
      const victim = pickPlayerCustomWeighted(attTeam, null, (p) => {
        const slot = p.slot || (p.pos || [])[0] || 'CM';
        const carry = (xattr(p, 'dribb', p.tec || 70) * 0.6 + xattr(p, 'spd', p.pac || 70) * 0.4) / 70;
        return (FOULED_POS_WEIGHT[slot] != null ? FOULED_POS_WEIGHT[slot] : 0.7) * carry;
      });
      const result = resolveFoul(defSide, attSide, fouler, victim, false, false, 'routine');
      // A small share of fouls are won in a dangerous spot — most just
      // restart play, which is why this is far lower than the secondary
      // free-kick path's own rate.
      if (result && result.outcome !== 'red' && result.outcome !== 'penalty' && seededRandom() < 0.05) {
        resolveFreeKickRoutine(attSide, defSide, seededRandom() < 0.4);
      }
    });
  }
/*@CHUNK:c0217:END*/
