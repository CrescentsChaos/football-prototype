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
    const phyFactor = Math.max(0.65, Math.min(1.35, (100 - (p.phy || 70)) / 45));
    const tacFactor = tac === 'press' ? 1.35 : tac === 'attack' ? 1.15 : tac === 'defend' ? 0.8 : 1.0;
    return 0.62 * roleLoad * phyFactor * tacFactor;
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
      onIds.forEach(id => {
        const p = all.find(x => x.id === id);
        if (!p) return;
        if (!fat[side][id]) fat[side][id] = { stamina: 100 };
        const rec = fat[side][id];
        rec.stamina = Math.max(8, rec.stamina - fatigueDrainRate(p, tac));
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
