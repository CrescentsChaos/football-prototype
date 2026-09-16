/*@CHUNK:c0006:START*/


  // ========== MANAGER PLAYSTYLES ==========
  // If a team's manager has "playstyle" set in teams.json (and it's one of the
  // names below) that's used as-is; otherwise a random one is assigned once
  // when team data loads and cached onto team.manager.playstyle so it stays
  // consistent for the rest of the session.
  const PLAYSTYLES = ['Long Ball', 'Possession', 'Long Ball Counter', 'Overload', 'Quick Counter', 'Out Wide'];

  // Gameplay effect of each playstyle. These are deliberately modest nudges —
  // enough to give each style a distinct identity over 90 minutes/a season
  // without letting any one style dominate results outright.
  //   attBonus/defBonus   — flat nudge to calcTeamStrength() att/def
  //   passVolMult         — multiplies a team's per-minute pass volume
  //   passAccDelta        — flat nudge to individual pass success rate
  //   possBias            — pts nudge toward/away from more of the ball
  //   wingBiasMult        — multiplies wide players' (RB/LB/RWB/LWB/RM/LM/RW/LW) share of passing/attacking involvement
  //   counterBonus        — nudge to attacking-creation strength that rewards this team when they're defending, i.e. breaking quickly
  const PLAYSTYLE_MODS = {
    'Long Ball':          { attBonus: 1.5,  defBonus: -0.5, passVolMult: 0.82, passAccDelta: -0.045, possBias: -4, wingBiasMult: 1.0,  counterBonus: 0.4 },
    'Possession':         { attBonus: -0.5, defBonus: 1.0,  passVolMult: 1.20, passAccDelta: 0.035,  possBias: 6,  wingBiasMult: 1.0,  counterBonus: -0.6 },
    'Long Ball Counter':  { attBonus: 0.5,  defBonus: 0.5,  passVolMult: 0.80, passAccDelta: -0.03,  possBias: -5, wingBiasMult: 1.0,  counterBonus: 1.4 },
    'Overload':           { attBonus: 1.0,  defBonus: -0.8, passVolMult: 1.05, passAccDelta: 0.0,    possBias: 2,  wingBiasMult: 1.35, counterBonus: 0.1 },
    'Quick Counter':      { attBonus: 0.8,  defBonus: 0.2,  passVolMult: 0.94, passAccDelta: -0.01,  possBias: -2, wingBiasMult: 1.1,  counterBonus: 1.6 },
    'Out Wide':           { attBonus: 0.5,  defBonus: -0.2, passVolMult: 1.0,  passAccDelta: 0.0,    possBias: 1,  wingBiasMult: 1.4,  counterBonus: 0.2 }
  };
  const WIDE_SLOTS = new Set(['RB','LB','RWB','LWB','RM','LM','RW','LW']);

  // Which formation "shape" each manager identity gravitates toward, used by
  // pickTeamFormation() below so a Long Ball manager's team actually lines up
  // differently from a Possession side's, instead of formation being a pure
  // cosmetic hash of the team name.
  //   fwd/def  — how much this style values a formation weighted toward
  //              attacking vs defensive bodies (see formationShape())
  //   wide     — how much it values natural width (wing-backs/wide mids)
  //   mid      — how much it values a numbers-up central midfield
  const PLAYSTYLE_FORM_PREF = {
    'Long Ball':          { fwd: 0.5, def: 1.1, wide: 0.3, mid: 0.3 },
    'Long Ball Counter':  { fwd: 0.6, def: 1.0, wide: 0.4, mid: 0.3 },
    'Quick Counter':      { fwd: 0.7, def: 0.9, wide: 0.5, mid: 0.4 },
    'Possession':         { fwd: 0.5, def: 0.7, wide: 0.3, mid: 1.1 },
    'Overload':           { fwd: 0.9, def: 0.4, wide: 1.3, mid: 0.5 },
    'Out Wide':           { fwd: 0.7, def: 0.5, wide: 1.4, mid: 0.4 }
  };


  // Resolves (and caches) a team's manager playstyle. If teams.json already
  // set a valid manager.playstyle it's kept as-is; otherwise a random one is
  // picked once and stored on the manager object so every part of the UI
  // that reads team.manager.playstyle agrees for the rest of the session.
/*@CHUNK:c0006:END*/

/*@CHUNK:c0007:START*/
  function getManagerPlaystyle(team) {
    if (!team) return PLAYSTYLES[0];
    if (!team.manager) team.manager = {};
    if (!PLAYSTYLES.includes(team.manager.playstyle)) {
      team.manager.playstyle = PLAYSTYLES[Math.floor(seededRandom() * PLAYSTYLES.length)];
    }
    return team.manager.playstyle;
  }
/*@CHUNK:c0007:END*/

/*@CHUNK:c0008:START*/

/*@CHUNK:c0008:END*/

/*@CHUNK:c0009:START*/
  function getPlaystyleMods(team) {
    return PLAYSTYLE_MODS[getManagerPlaystyle(team)] || PLAYSTYLE_MODS['Possession'];
  }
/*@CHUNK:c0009:END*/

/*@CHUNK:c0014:START*/
  // The core "signature attributes push overall up" rule: for each
  // playstyle tag a player has, compare the average of that style's key
  // attributes against the player's own sheet average. Only positive gaps
  // count (a style whose key attributes are actually average or below
  // gives no bonus) and each style's contribution is amplified well beyond
  // the flat +1..+3 PLAYSTYLE_STAT_MODS nudge, so a player built around
  // their style's signature attributes reads as meaningfully better than
  // a same-position player with a flatter, generic spread — even at the
  // same rough attribute total. Multiple matching styles stack, capped so
  // it stays a strong-but-bounded identity bonus rather than unbounded.
/*@CHUNK:c0014:END*/

/*@CHUNK:c0015:START*/
  function styleSignatureBonus(attr, styles, isGK) {
    if (!styles || !styles.length) return 0;
    const sheetAvg = attrSheetAverage(attr, isGK);
    let bonus = 0;
    styles.forEach((style) => {
      const keys = PLAYSTYLE_KEY_ATTRS[style];
      if (!keys || !keys.length) return;
      const vals = keys.map(k => attr[k]).filter(v => typeof v === 'number');
      if (!vals.length) return;
      const keyAvg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const gap = keyAvg - sheetAvg;
      if (gap > 0) bonus += gap * 0.55;
    });
    return Math.max(0, Math.min(14, Math.round(bonus)));
  }
/*@CHUNK:c0015:END*/

/*@CHUNK:c0016:START*/
  // Manager boost to *inner* attributes, not just the final overall number.
  // When a player's individual playstyle fits the way their manager sets
  // the team up (see PLAYSTYLE_AFFINITY), the manager's coaching visibly
  // sharpens that style's specific signature ratings on the player's own
  // attribute sheet — returns a shallow-cloned, boosted copy of attr so the
  // original playerAttributesData source is never mutated.
/*@CHUNK:c0016:END*/

/*@CHUNK:c0017:START*/
  function applyManagerAttributeBoost(attr, styles, teamStyle) {
    if (!styles || !styles.length || !teamStyle) return attr;
    const boosted = { ...attr };
    let touched = false;
    styles.forEach((style) => {
      const suited = PLAYSTYLE_AFFINITY[style];
      if (!suited || !suited.includes(teamStyle)) return;
      const keys = PLAYSTYLE_KEY_ATTRS[style];
      if (!keys) return;
      keys.forEach((k) => {
        if (typeof boosted[k] === 'number') {
          boosted[k] = Math.max(1, Math.min(99, Math.round(boosted[k] + 2)));
          touched = true;
        }
      });
    });
    boosted.managerBoosted = touched;
    return boosted;
  }
/*@CHUNK:c0017:END*/

/*@CHUNK:c0018:START*/

  // True if a player's expanded sheet carries the given individual
  // playstyle tag. Used throughout the match-engine "edge" functions below
  // so specific styles diversify in-match behaviour, not just derived stats.
/*@CHUNK:c0018:END*/

/*@CHUNK:c0019:START*/
  function hasStyle(p, styleName) {
    return !!(p && p.expandedAttrs && (p.expandedAttrs.playstyle || []).includes(styleName));
  }
/*@CHUNK:c0019:END*/

/*@CHUNK:c0020:START*/

  // Returns one random flavor line from the first of the player's playstyle
  // tags that has an entry in the given map, or null if none match. This is
  // how playstyles diversify match commentary itself — not just numbers —
  // every context below (dribbles, through balls, tackles, off-the-ball
  // movement, goals) picks its wording partly from *which* style the player
  // on the ball actually has.
/*@CHUNK:c0020:END*/

/*@CHUNK:c0021:START*/
  function styleFlavor(p, map) {
    if (!p || !p.expandedAttrs) return null;
    const styles = p.expandedAttrs.playstyle || [];
    for (let i = 0; i < styles.length; i++) {
      const bank = map[styles[i]];
      if (bank && bank.length) return bank[Math.floor(seededRandom() * bank.length)];
    }
    return null;
  }
/*@CHUNK:c0021:END*/

/*@CHUNK:c0026:START*/

  // +2 if one of the player's individual playstyles suits the team's
  // current manager playstyle, +3 if two or more do, else 0.
/*@CHUNK:c0026:END*/

/*@CHUNK:c0027:START*/
  function managerAffinityBonus(playerStyles, teamStyle) {
    if (!playerStyles || !playerStyles.length || !teamStyle) return 0;
    let matches = 0;
    playerStyles.forEach((s) => {
      const suited = PLAYSTYLE_AFFINITY[s];
      if (suited && suited.includes(teamStyle)) matches++;
    });
    if (matches >= 2) return 3;
    if (matches === 1) return 2;
    return 0;
  }
/*@CHUNK:c0027:END*/
