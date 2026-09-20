/*@CHUNK:c0006:START*/


  // ========== MANAGER PLAYSTYLES ==========
  // If a team's manager has "playstyle" set in teams.json (and it's one of the
  // names below) that's used as-is; otherwise a random one is assigned once
  // when team data loads and cached onto team.manager.playstyle so it stays
  // consistent for the rest of the session.
  const PLAYSTYLES = ['Long Ball', 'Possession', 'Long Ball Counter', 'Overload', 'Quick Counter', 'Out Wide'];

  // Gameplay effect of each playstyle. These are deliberately modest nudges —
  // enough to give each style a distinct identity over 90 minutes/a season
  // without letting any one style dominate results outright. Note: these are
  // now the *archetype baseline* only — getPlaystyleMods() below layers each
  // individual manager's own DNA (see MANAGER DNA section) and style
  // proficiency/tactical fit on top, so two managers sharing the same
  // playstyle no longer produce identical numbers.
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

  // ========== MANAGER DNA ==========
  // A manager's "playstyle" (above) is *what* system he nominally runs —
  // one of six broad archetypes shared by many managers. His DNA is *how*
  // he actually executes it: an 18-dimension fingerprint (tempo,
  // directness, width, pressing, defensive line, compactness, risk,
  // verticality, positional freedom, crossing, cutbacks, through balls,
  // switches, overlaps, counterpressing, block depth, transition speed,
  // match-management) that's rolled once per manager — deterministically,
  // from a hash of his name, so it's stable across sessions/rebuilds
  // without needing to be hand-authored for hundreds of managers — and
  // cached on team.manager._dna. Two "Possession" managers both nominally
  // want the ball, but one presses like a maniac with a high line while
  // the other sits deeper and just recycles it patiently; DNA is what
  // encodes that difference. Values are 0..1, read as "how strongly this
  // manager leans that way", with 0.5 as roughly neutral/average.
  const DNA_TRAITS = [
    'tempo', 'directness', 'width', 'pressing', 'defensiveLine', 'compactness',
    'risk', 'verticality', 'positionalFreedom', 'crossing', 'cutbacks',
    'throughBalls', 'switches', 'overlaps', 'counterpressing', 'blockDepth',
    'transitionSpeed', 'matchManagement'
  ];

  // A manager's nominal playstyle still pulls a handful of the most
  // style-relevant traits toward a plausible center of gravity (a Long
  // Ball manager trends toward high directness/verticality, low tempo) —
  // but every manager still rolls their own value around that center, and
  // every trait NOT listed here for a given style is free to land anywhere,
  // which is what keeps two same-style managers genuinely distinct rather
  // than reskins of one archetype.
  const STYLE_DNA_CENTER = {
    'Possession':        { tempo: 0.68, directness: 0.28, width: 0.45, pressing: 0.62, defensiveLine: 0.64, verticality: 0.32, risk: 0.42 },
    'Quick Counter':      { tempo: 0.52, directness: 0.62, width: 0.50, pressing: 0.46, defensiveLine: 0.40, verticality: 0.66, risk: 0.55 },
    'Long Ball Counter':  { tempo: 0.38, directness: 0.76, width: 0.42, pressing: 0.40, defensiveLine: 0.32, verticality: 0.78, risk: 0.48 },
    'Out Wide':           { tempo: 0.55, directness: 0.48, width: 0.82, pressing: 0.50, defensiveLine: 0.50, verticality: 0.50, risk: 0.50 },
    'Long Ball':          { tempo: 0.32, directness: 0.86, width: 0.40, pressing: 0.40, defensiveLine: 0.28, verticality: 0.82, risk: 0.44 },
    'Overload':           { tempo: 0.58, directness: 0.50, width: 0.76, pressing: 0.54, defensiveLine: 0.54, verticality: 0.54, risk: 0.60 }
  };
/*@CHUNK:c0008:END*/

/*@CHUNK:c0009:START*/
  // FNV-1a style string hash -> a stable 32-bit seed, so the same manager
  // name always produces the same DNA/proficiency roll regardless of when
  // or in what order teams happen to load this session.
  function hashStringToSeed(s) {
    let h = 2166136261 >>> 0;
    const str = String(s || '');
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  // Small, fast, deterministic PRNG (mulberry32) seeded from the hash above.
  // Used only for one-time DNA/proficiency generation — never for anything
  // that needs to stay in lockstep with the match engine's own seededRandom()
  // sequence, so authoring/regenerating a manager's DNA can never shift any
  // other random draw in a replay.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
/*@CHUNK:c0009:END*/

/*@CHUNK:c0014:START*/
  // Rolls (and caches) a manager's 18-trait DNA fingerprint. Style-relevant
  // traits are rolled around STYLE_DNA_CENTER for the manager's playstyle
  // (still with real per-manager spread); every other trait rolls freely
  // around a neutral 0.5. Cached on team.manager._dna keyed by the manager's
  // name, so it survives a formation change/playstyle re-read within the
  // same session and stays stable across rebuilds (deterministic from the
  // name hash), the same guarantee getManagerPlaystyle() already gives.
  // Rolls (and caches) a manager's 18-trait DNA fingerprint. Style-relevant
  // traits are rolled around STYLE_DNA_CENTER for the manager's playstyle
  // (still with real per-manager spread); every other trait rolls freely
  // around a neutral 0.5. Cached on team.manager._dna keyed by the manager's
  // name, so it survives a formation change/playstyle re-read within the
  // same session and stays stable across rebuilds (deterministic from the
  // name hash), the same guarantee getManagerPlaystyle() already gives.
  //
  // Hand-authored override: if teams.json sets manager.dna = { trait: val,
  // ... }, any trait listed there is used exactly as given (clamped to the
  // normal 0.06..0.96 range) instead of the hash-generated value — every
  // trait NOT listed still falls back to the generated one. This lets a
  // handful of well-known managers be hand-tuned without having to author
  // all 18 traits, or touch the other ~300 managers that rely on the
  // automatic generation.
  function getManagerDNA(team) {
    if (!team) team = {};
    if (!team.manager) team.manager = {};
    const mgr = team.manager;
    const name = mgr.name || (team.id || team.name || 'unknown-manager');
    if (mgr._dna && mgr._dnaFor === name) return mgr._dna;
    const style = getManagerPlaystyle(team);
    const center = STYLE_DNA_CENTER[style] || {};
    const rng = mulberry32(hashStringToSeed(name + '::dna'));
    const dna = {};
    DNA_TRAITS.forEach((trait) => {
      const c = center[trait] != null ? center[trait] : 0.5;
      // Style-anchored traits still spread +/-0.32 around their center so
      // two managers of the same style clearly differ; free traits spread
      // the full +/-0.4 around neutral for genuine individuality.
      const spread = center[trait] != null ? 0.32 : 0.4;
      dna[trait] = Math.max(0.06, Math.min(0.96, c + (rng() - 0.5) * spread * 2));
    });
    const overrides = mgr.dna;
    if (overrides && typeof overrides === 'object') {
      DNA_TRAITS.forEach((trait) => {
        const v = overrides[trait];
        if (typeof v === 'number' && !Number.isNaN(v)) {
          dna[trait] = Math.max(0.06, Math.min(0.96, v));
        }
      });
    }
    mgr._dna = dna;
    mgr._dnaFor = name;
    return dna;
  }
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
      if (gap > 0) bonus += gap * 0.15;
    });
    return Math.max(0, Math.min(4, Math.round(bonus)));
  }
/*@CHUNK:c0015:END*/

/*@CHUNK:c0016:START*/
  // A manager's STYLE PROFICIENCY — separate from his DNA — is how well he
  // actually executes his nominal system, independent of *how* he executes
  // it. Rolled once per manager off its own hash stream (so it doesn't
  // correlate with any single DNA trait), nudged slightly by the manager's
  // own overall rating where teams.json sets one. Cached on
  // team.manager._proficiency the same way DNA is cached above.
  function getManagerStyleProficiency(team) {
    if (!team) team = {};
    if (!team.manager) team.manager = {};
    const mgr = team.manager;
    const name = mgr.name || (team.id || team.name || 'unknown-manager');
    if (mgr._proficiency != null && mgr._proficiencyFor === name) return mgr._proficiency;
    const rng = mulberry32(hashStringToSeed(name + '::proficiency'));
    const ovrNudge = mgr.ovr != null ? (mgr.ovr - 78) / 220 : 0;
    const prof = Math.max(0.55, Math.min(1.08, 0.68 + (rng() - 0.5) * 0.5 + ovrNudge));
    mgr._proficiency = prof;
    mgr._proficiencyFor = name;
    return prof;
  }
/*@CHUNK:c0016:END*/

/*@CHUNK:c0017:START*/
  // Finds the live sideData wrapper (currentMatch.home/.away) for a raw
  // team object, so DNA-consuming code that's only ever handed the raw
  // team (as getPlaystyleMods()'s callers do) can still reach the on-pitch
  // squad/formation when a match is actually in progress. Returns null
  // outside of a live match (e.g. squad-planning screens) — callers treat
  // that as "no compatibility data available yet", not a penalty.
  function teamSideData(team) {
    const m = currentMatch;
    if (!m || !team) return null;
    if (m.home && m.home.team === team) return m.home;
    if (m.away && m.away.team === team) return m.away;
    return null;
  }

  // TACTICAL COMPATIBILITY — how well this manager's DNA actually fits the
  // squad/formation he's got out there right now. A high-pressing DNA with
  // a gassed, low-work-rate midfield doesn't press as effectively in
  // practice as the same DNA behind a tireless engine room; a high
  // defensive line with slow centre-backs is a live liability, not a free
  // upgrade. Returns a multiplier centered on 1 (0.8..1.2) that
  // getPlaystyleMods() folds in alongside raw proficiency — so the
  // *system* a manager wants to play interacts with the attributes,
  // stamina, roles and formation actually on the pitch instead of playing
  // out identically regardless of personnel.
  function computeTacticalCompatibility(team) {
    const sd = teamSideData(team);
    if (!sd || !sd.squad) return 1;
    const m = currentMatch;
    const dna = getManagerDNA(team);
    const all = sd.squad.all || [];
    const onIds = sd === m.home ? m.homeOnPitch : m.awayOnPitch;
    let onPitch = (onIds || []).map(id => all.find(p => p.id === id)).filter(Boolean);
    if (!onPitch.length) onPitch = sd.squad.starting || all;
    if (!onPitch.length) return 1;
    const avg = (fn) => onPitch.reduce((s, p) => s + fn(p), 0) / onPitch.length;
    const slotOf = (p) => p.slot || (p.pos || [])[0] || 'CM';
    const wide = onPitch.filter(p => WIDE_SLOTS.has(slotOf(p)));
    const backline = onPitch.filter(p => slotOf(p) === 'CB');
    const strikers = onPitch.filter(p => slotOf(p) === 'ST');
    const midfield = onPitch.filter(p => ['CM', 'CDM', 'CAM'].includes(slotOf(p)));

    let score = 1;
    // High-pressing DNA needs legs (work-rate + pace) all over the pitch —
    // a slow, low-engagement group can't actually sustain it.
    const workrate = avg(p => (xattr(p, 'def_eng', p.def || 70) + (p.pac || 70)) / 2);
    score += (dna.pressing - 0.5) * ((workrate - 72) / 90);
    // A genuinely high defensive line is a gamble without recovery pace at
    // the back to cover it.
    const backPace = backline.length ? backline.reduce((s, p) => s + (p.pac || 70), 0) / backline.length : 70;
    score += (dna.defensiveLine - 0.5) * ((backPace - 68) / 70);
    // Width wants capable wide outlets to actually deliver it; without
    // them a "wide" system is just an instruction nobody can carry out.
    const wideQuality = wide.length ? wide.reduce((s, p) => s + ((p.pac || 70) + (p.tec || 70)) / 2, 0) / wide.length : 58;
    score += (dna.width - 0.5) * (wide.length ? (wideQuality - 68) / 90 : -0.35);
    // A directness/verticality-heavy approach wants genuine physical
    // presence up front to actually win/hold the longer ball.
    const targetQuality = strikers.length ? strikers.reduce((s, p) => s + (p.phy || p.ovr || 70), 0) / strikers.length : 68;
    score += (dna.verticality - 0.5) * ((targetQuality - 70) / 90);
    // Patient, high-tempo possession football wants technical midfielders
    // to actually retain it under pressure.
    const midTec = midfield.length ? midfield.reduce((s, p) => s + (p.tec || 70), 0) / midfield.length : 70;
    score += (dna.tempo - 0.5) * ((midTec - 70) / 80);
    return Math.max(0.8, Math.min(1.2, score));
  }

  // The single number the rest of the engine actually cares about: how
  // purely this manager's *authored* archetype numbers (PLAYSTYLE_MODS)
  // come through, blending his separately-rolled proficiency with how well
  // his DNA currently fits the group on the pitch.
  function getEffectiveProficiency(team) {
    return Math.max(0.55, Math.min(1.25, getManagerStyleProficiency(team) * computeTacticalCompatibility(team)));
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
  // Gets a team's fully blended tactical mods: the archetype baseline
  // (PLAYSTYLE_MODS), regressed toward neutral in proportion to how
  // purely this specific manager executes it (proficiency x tactical
  // fit — see getEffectiveProficiency), with his own 18-trait DNA layered
  // on top as continuous fields the rest of the engine reads directly.
  // This is the one function nearly every possession/passing/defending/
  // transitions call site already calls (getPlaystyleMods(team)) — so
  // enriching its output here is what lets a manager's individual DNA
  // reach positioning, buildup, chance creation, pressing, defending and
  // transitions everywhere else without having to touch every call site.
  function getPlaystyleMods(team) {
    const style = getManagerPlaystyle(team);
    const base = PLAYSTYLE_MODS[style] || PLAYSTYLE_MODS['Possession'];
    const dna = getManagerDNA(team);
    const eff = getEffectiveProficiency(team);
    // Regresses an authored delta toward its neutral value by (1 - eff) —
    // a lower-proficiency/poorer-fit manager is nominally "Possession" but
    // doesn't actually get the full benefit of it.
    const blend = (neutral, val) => neutral + (val - neutral) * eff;
    return {
      // ---- Archetype baseline, scaled by proficiency x tactical fit ----
      attBonus: blend(0, base.attBonus),
      defBonus: blend(0, base.defBonus),
      passVolMult: blend(1, base.passVolMult),
      passAccDelta: blend(0, base.passAccDelta),
      possBias: blend(0, base.possBias),
      wingBiasMult: blend(1, base.wingBiasMult) * (0.75 + dna.width * 0.5),
      counterBonus: blend(1, base.counterBonus) * (0.7 + dna.transitionSpeed * 0.6),
      // ---- Individual manager DNA, layered independently of proficiency —
      // ---- this is HOW he plays, not how well he pulls off his system.
      tempoMult: 0.75 + dna.tempo * 0.5,
      directness: dna.directness,
      pressingIntensity: dna.pressing,
      defensiveLine: dna.defensiveLine,
      compactness: dna.compactness,
      riskAppetite: dna.risk,
      verticality: dna.verticality,
      positionalFreedom: dna.positionalFreedom,
      crossingBias: 0.7 + dna.crossing * 0.6,
      cutbackBias: 0.7 + dna.cutbacks * 0.6,
      throughBallBias: 0.7 + dna.throughBalls * 0.6,
      switchBias: 0.7 + dna.switches * 0.6,
      overlapBias: dna.overlaps,
      counterpressIntensity: dna.counterpressing,
      blockDepth: dna.blockDepth,
      transitionSpeedMult: 0.75 + dna.transitionSpeed * 0.5,
      matchManagement: dna.matchManagement,
      styleProficiency: eff
    };
  }
/*@CHUNK:c0026:END*/

/*@CHUNK:c0027:START*/
  // How this manager reacts to the live match state right now — scoreline,
  // minute, his own team's fatigue, and the gap in quality to the
  // opponent — used by the in-match tactical AI (engine/tactics.js::
  // evaluateTacticalAI) instead of a flat "this style is aggressive"
  // lookup and a single hardcoded gamble chance for every manager. High
  // risk + low match-management managers panic/chase earlier and gamble
  // harder; a composed, high match-management manager stays patient and
  // times changes better — and a gassed team or a clearly stronger
  // opponent tempers the gamble regardless of the manager's instincts.
  function getManagerMatchReaction(team, ctx) {
    const dna = getManagerDNA(team);
    ctx = ctx || {};
    const fatigue = ctx.fatigue != null ? ctx.fatigue : 1; // ~0.7 (gassed) .. 1.05 (fresh)
    const oppGap = ctx.oppGap || 0; // positive = opponent rated stronger
    let urgency = 0.5 + dna.risk * 0.4 - dna.matchManagement * 0.3;
    urgency += Math.max(-0.15, Math.min(0.15, -oppGap / 60));
    urgency *= 0.6 + 0.4 * Math.min(1.1, fatigue);
    urgency = Math.max(0.1, Math.min(0.95, urgency));
    const gambleChance = Math.max(0.08, Math.min(0.75, 0.15 + dna.risk * 0.5 - Math.max(0, oppGap) / 120));
    const cooldown = Math.max(6, Math.round(16 - dna.matchManagement * 8));
    return { urgency, gambleChance, cooldown };
  }
/*@CHUNK:c0027:END*/
