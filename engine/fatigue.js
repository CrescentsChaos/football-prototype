/*@CHUNK:cfat01:START*/

  // ===================================================================
  // ===================== FATIGUE / STAMINA MODEL ====================
  // ===================================================================
  // Every outfield player accumulates fatigue while on the pitch, driven by
  // minutes played, their physical attribute, the team's current tactical
  // intensity (a high press/all-out attack drains far faster than sitting
  // in a defensive block), and their role (wide/forward positions cover
  // more ground than a holding centre-back). A substitute starts fresh the
  // moment they come on. This is read directly by the substitution AI in
  // engine/tactics.js so tired legs are a first-class reason a manager
  // makes a change — not just an after-the-fact proxy via a dropping match
  // rating once the damage is already done.
/*@CHUNK:cfat01:END*/

/*@CHUNK:cfat02:START*/
  function ensureFatigueState(m) {
    if (!m.fatigue) m.fatigue = { home: {}, away: {} };
    return m.fatigue;
  }
/*@CHUNK:cfat02:END*/

/*@CHUNK:cfat03:START*/
  // 0-100, 100 = fully fresh. Defaults to fresh for anyone not yet tracked
  // (covers players who haven't been on the pitch yet this match).
  function getStamina(m, side, playerId) {
    if (!m) return 100;
    const fat = ensureFatigueState(m);
    const rec = fat[side] && fat[side][playerId];
    return rec ? rec.stamina : 100;
  }
/*@CHUNK:cfat03:END*/

/*@CHUNK:cfat04:START*/
  // Per-minute drain rate for a given player — physical attribute, position
  // (wide/forward roles cover more ground than a holding CB or GK), and the
  // team's current tactical intensity all feed in.
  function fatigueDrainRate(p, tac) {
    const slot = p.slot || (p.pos || [])[0] || 'CM';
    if (slot === 'GK') return 0.12;
    const line = POS_LINE[slot] || 'MID';
    const roleLoad = WIDE_SLOTS.has(slot) ? 1.25 : line === 'MID' ? 1.15 : line === 'FWD' ? 1.05 : 0.85;
    // Stamina is the specific attribute for how long a player holds his
    // physical performance before tiring, so it now drives the drain rate
    // directly instead of disappearing into the generic `phy` blend (which
    // also mixes in jump/balance/aggression that have nothing to do with
    // endurance). Physical Contact is a much smaller secondary factor —
    // a robust frame shrugs off the wear of knocks/duels a little better,
    // but it's not a substitute for genuine engine.
    const stam = xattr(p, 'stam', p.phy || 70);
    const phyCon = xattr(p, 'phy_con', p.phy || 70);
    const stamFactor = Math.max(0.62, Math.min(1.42, (100 - stam) / 42));
    const phyConFactor = Math.max(0.93, Math.min(1.07, 0.93 + (100 - phyCon) / 300));
    const tacFactor = tac === 'press' ? 1.35 : tac === 'attack' ? 1.15 : tac === 'defend' ? 0.8 : 1.0;
    let rate = 0.62 * roleLoad * stamFactor * phyConFactor * tacFactor;
    // Fighting Spirit and Track Back both describe a player who holds his
    // intensity/work-rate up under fatigue and pressure — modeled as a
    // genuinely slower stamina drain rather than just a late-game stat bump.
    if (hasSkill(p, 'Fighting Spirit')) rate *= 0.85;
    if (hasSkill(p, 'Track Back')) rate *= 0.94;
    // Iron Man: genuinely slower fatigue regardless of the stam rating
    // already baked into stamFactor above — a personality-level read, not
    // a stat substitute.
    if (((p.expandedAttrs && p.expandedAttrs.personality) || []).includes('Iron Man')) rate *= 0.88;
    return rate;
  }
/*@CHUNK:cfat04:END*/

/*@CHUNK:cfat05:START*/
  // Runs once per simulated minute for both sides — drains everyone
  // currently on the pitch. Floors out at 8 rather than 0 so an exhausted
  // player is a heavy substitution risk without ever going fully inert.
  function updateFatigue() {
    const m = currentMatch;
    if (!m) return;
    const fat = ensureFatigueState(m);
    ['home', 'away'].forEach(side => {
      const team = m[side];
      const tac = (m.tactics && m.tactics[side]) || 'balanced';
      const onIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
      const all = (team.squad && team.squad.all) || [];
      // Captaincy: a captain on the pitch takes the edge off the whole
      // team's fatigue, not just his own — real captains manage tempo and
      // keep the squad's intensity honest through a long match.
      const captainOnPitch = all.some(x => onIds.includes(x.id) && hasSkill(x, 'Captaincy'));
      // Leader: deepens the existing Captaincy aura above rather than being
      // a new standalone check — requires the actual Captaincy skill too,
      // same captain-on-pitch lookup, just also carrying the Leader tag.
      const leaderCaptainOnPitch = all.some(x => onIds.includes(x.id) && hasSkill(x, 'Captaincy')
        && ((x.expandedAttrs && x.expandedAttrs.personality) || []).includes('Leader'));
      // Talisman: same aura pattern as Captaincy above, but on its own —
      // no skill prerequisite, just the personality tag and being on the
      // pitch. See engine/shooting.js for the matching shot-quality aura.
      const talismanOnPitch = all.some(x => onIds.includes(x.id) && ((x.expandedAttrs && x.expandedAttrs.personality) || []).includes('Talisman'));
      // Personality tags (player-attributes.json "personality", optional —
      // undefined for anyone without a hand-authored entry, so this is a
      // no-op for the vast majority of players).
      const isLosing = side === 'home' ? m.home.score < m.away.score : m.away.score < m.home.score;
      onIds.forEach(id => {
        const p = all.find(x => x.id === id);
        if (!p) return;
        if (!fat[side][id]) fat[side][id] = { stamina: 100 };
        const rec = fat[side][id];
        let drain = fatigueDrainRate(p, tac);
        if (captainOnPitch) drain *= 0.93;
        if (leaderCaptainOnPitch) drain *= 0.95;
        if (talismanOnPitch) drain *= 0.97;
        // A Determined player digs in and keeps his work rate up when his
        // side is chasing the game late on — modeled the same way as
        // Fighting Spirit/Track Back above, as a genuinely slower drain
        // rather than a late-game stat bump.
        const personality = (p.expandedAttrs && p.expandedAttrs.personality) || [];
        if (personality.includes('Determined') && isLosing && m.minute > 75) drain *= 0.91;
        rec.stamina = Math.max(8, rec.stamina - drain);
      });
    });
  }
/*@CHUNK:cfat05:END*/

/*@CHUNK:cfat06:START*/
  // A substitute always comes on fresh — called from trySubstitution(),
  // handleRedCardReshuffle(), and tryInjury()'s forced-sub path so the
  // incoming player's stamina tracking starts clean rather than inheriting
  // whatever the outgoing player's number happened to be.
  function resetFatigueFor(m, side, playerId) {
    const fat = ensureFatigueState(m);
    fat[side][playerId] = { stamina: 100 };
  }
/*@CHUNK:cfat06:END*/

/*@CHUNK:cfat07:START*/
  // Team-wide average stamina among players currently on the pitch — used
  // to nudge overall substitution *timing* (see tick() in matchEngine.js),
  // on top of fatigue driving *who* comes off inside trySubstitution().
  function teamAvgStamina(side) {
    const m = currentMatch;
    if (!m) return 100;
    const onIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    if (!onIds.length) return 100;
    const total = onIds.reduce((s, id) => s + getStamina(m, side, id), 0);
    return total / onIds.length;
  }
/*@CHUNK:cfat07:END*/

/*@CHUNK:cfat08:START*/
  // Which side a given player is actually on this match — every ability
  // read below (passing, carrying, defending, aerials) needs this to look
  // up that player's live stamina, and none of them otherwise know which
  // squad they belong to.
  function playerMatchSide(p) {
    const m = currentMatch;
    if (!m || !p) return null;
    if (m.home && m.home.squad && (m.home.squad.all || []).some((x) => x.id === p.id)) return 'home';
    if (m.away && m.away.squad && (m.away.squad.all || []).some((x) => x.id === p.id)) return 'away';
    return null;
  }
/*@CHUNK:cfat08:END*/

/*@CHUNK:cfat09:START*/
  // The single hook that makes stamina matter *during* the 90 minutes,
  // not just as a trigger for substitutions after the fact. Every major
  // in-match ability read (passing/carrying/defending/aerial duels) now
  // runs its raw attribute number through this multiplier — a player
  // sitting comfortably above ~70 stamina performs at full sharpness,
  // and it tails off smoothly down to a real (but not crippling) ~16%
  // dip once they're running on empty. This is what makes a genuinely
  // high `stam` rating pay off for a full match instead of only ever
  // showing up as a slightly later substitution.
  function staminaMultiplier(p) {
    const m = currentMatch;
    if (!m || !p) return 1;
    const side = playerMatchSide(p);
    if (!side) return 1;
    const stamina = getStamina(m, side, p.id);
    if (stamina >= 70) return 1;
    return Math.max(0.84, 1 - (70 - stamina) * 0.0026);
  }
/*@CHUNK:cfat09:END*/
