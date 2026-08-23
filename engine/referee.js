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
  function resolveFoul(defendingSide, attackingSide, fouler, victim, nearBox, forcePenalty) {
    const m = currentMatch;
    if (!m || !fouler) return { outcome: 'none' };
    const defTeam = m[defendingSide], attTeam = m[attackingSide];
    defTeam.stats.fouls++;
    if (!m.foulCounts) m.foulCounts = { home: {}, away: {} };
    m.foulCounts[defendingSide][fouler.id] = (m.foulCounts[defendingSide][fouler.id] || 0) + 1;
    const foulCount = m.foulCounts[defendingSide][fouler.id];
    const alreadyYellow = (m.cards[defendingSide][fouler.id] || 0) >= 1;
    const aggression = 1 + Math.max(0, (75 - (fouler.def || 70)) / 80) + Math.max(0, ((fouler.phy || 70) - 80) / 100);
    const foulText = victim
      ? `<span class="player">${fouler.name}</span> fouls <span class="player">${victim.name}</span>`
      : `Foul by <span class="player">${fouler.name}</span>`;

    if (nearBox && (forcePenalty || seededRandom() < 0.09)) {
      addEvent(m.minute, 'foul', foulText + ' — inside the area!', defendingSide);
      const taker = pickPlayerWeighted(attTeam, ['ST', 'RW', 'LW', 'CAM', 'CM'], PEN_TAKER_ROLE_WEIGHT) || victim;
      if (taker) {
        addEvent(m.minute, 'pen', `Penalty to ${attTeam.team.short}. <span class="player">${taker.name}</span> on the spot.`, attackingSide);
        attTeam.stats.shots++;
        if (!m.playerMatchStats) m.playerMatchStats = {};
        if (!m.playerMatchStats[taker.id]) m.playerMatchStats[taker.id] = blankPlayerMatchStats(taker);
        m.playerMatchStats[taker.id].shots++;
        const penGk = pickPlayer(defTeam, ['GK']);
        const po = pickPenOutcome(taker, penGk);
        if (po.scored) {
          attTeam.stats.shotsOn++;
          attTeam.score++;
          recordStat('goals', taker, attTeam.team);
          m.playerMatchStats[taker.id].goals++;
          m.playerMatchStats[taker.id].xg += 0.76 + seededRandom() * 0.08;
          pushGoal(attackingSide, taker, m.minute, 'penalty — ' + po.text);
          addEvent(m.minute, 'goal', `⚽ Penalty goal! <span class="player">${taker.name}</span> ${po.text}`, attackingSide, true);
          maybeOffsideDisallow(attackingSide, taker, m.minute);
        } else {
          if (po.saved) {
            attTeam.stats.shotsOn++;
            if (penGk) {
              defTeam.stats.saves++;
              recordStat('saves', penGk, defTeam.team);
              if (!m.playerMatchStats[penGk.id]) m.playerMatchStats[penGk.id] = blankPlayerMatchStats(penGk);
              m.playerMatchStats[penGk.id].saves = (m.playerMatchStats[penGk.id].saves || 0) + 1;
            }
            addEvent(m.minute, 'save', `🧤 Penalty saved! <span class="player">${taker.name}</span>'s effort ${po.text}${penGk ? ` — <span class="player">${penGk.name}</span> denies it` : ''}`, attackingSide);
          } else {
            addEvent(m.minute, 'miss', `Penalty missed — <span class="player">${taker.name}</span>: ${po.text}`, attackingSide);
          }
        }
      }
      return { outcome: 'penalty' };
    }

    let yellowChance = Math.min(0.72, 0.08 * aggression + (foulCount - 1) * 0.14 + (alreadyYellow ? 0.12 : 0) + (foulCount >= 3 ? 0.12 : 0));
    const straightRedChance = 0.004 * aggression;
    const roll = seededRandom();
    if (roll < straightRedChance && !alreadyYellow) {
      defTeam.stats.reds++;
      recordStat('cards', fouler, defTeam.team);
      recordStat('reds', fouler, defTeam.team);
      if (!m.playerMatchStats) m.playerMatchStats = {};
      if (!m.playerMatchStats[fouler.id]) m.playerMatchStats[fouler.id] = blankPlayerMatchStats(fouler);
      m.playerMatchStats[fouler.id].red = true;
      addEvent(m.minute, 'red', `🟥 Straight red! ${foulText} — reckless challenge`, defendingSide);
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
        addEvent(m.minute, 'red', `🟥 Second yellow → red! ${foulText}`, defendingSide);
        removeFromPitch(defendingSide, fouler.id);
        handleRedCardReshuffle(defendingSide, fouler);
        return { outcome: 'red' };
      } else {
        addEvent(m.minute, 'yellow', `🟨 Yellow card — ${foulText}${foulCount > 1 ? ' (repeated fouls)' : ''}`, defendingSide);
        return { outcome: 'yellow' };
      }
    } else {
      addEvent(m.minute, 'foul', foulText + (foulCount > 1 ? ' — referee has a word' : ''), defendingSide);
      return { outcome: 'foul' };
    }
  }
/*@CHUNK:c0217:END*/
