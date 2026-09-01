/*@CHUNK:c0010:START*/

  // ========== EXPANDED PLAYER ATTRIBUTES (player-attributes.json) ==========
  // Optional, per-player override: when player-attributes.json has an entry
  // for a player's id, that entry's much more detailed attribute sheet (25+
  // individual ratings, a set of individual playstyle tags, GK-specific
  // ratings, etc.) is used to derive that player's five gameplay stats
  // (att/def/pac/phy/tec) and overall — completely replacing whatever
  // teams.json had for that player. Everyone else is untouched.

  // Position group -> how much each of the 5 gameplay stats counts toward
  // that group's overall, weights sum to 1 per row. Mirrors a standard
  // FIFA/eFootball-style positional overall calc.
  const ATTR_POS_WEIGHTS = {
    GK:       { def: 0.55, tec: 0.20, phy: 0.15, pac: 0.05, att: 0.05 },
    CB:       { def: 0.45, phy: 0.25, tec: 0.15, pac: 0.10, att: 0.05 },
    FB:       { def: 0.28, pac: 0.27, tec: 0.20, phy: 0.15, att: 0.10 },
    CDM:      { def: 0.35, tec: 0.25, phy: 0.20, pac: 0.10, att: 0.10 },
    CM:       { tec: 0.30, def: 0.20, phy: 0.20, pac: 0.15, att: 0.15 },
    CAM:      { tec: 0.30, att: 0.30, pac: 0.20, phy: 0.10, def: 0.10 },
    WIDE_MID: { pac: 0.28, tec: 0.25, att: 0.25, phy: 0.12, def: 0.10 },
    WINGER:   { pac: 0.30, att: 0.28, tec: 0.25, phy: 0.10, def: 0.07 },
    FWD:      { att: 0.45, pac: 0.20, tec: 0.20, phy: 0.15, def: 0.00 }
  };
/*@CHUNK:c0010:END*/

/*@CHUNK:c0011:START*/
  function attrPosGroup(posArr) {
    const p = canonPos((posArr && posArr[0]) || 'CM');
    if (p === 'GK') return 'GK';
    if (p === 'CB') return 'CB';
    if (['RB', 'LB', 'RWB', 'LWB'].includes(p)) return 'FB';
    if (p === 'CDM') return 'CDM';
    if (p === 'CM') return 'CM';
    if (p === 'CAM') return 'CAM';
    if (['RM', 'LM'].includes(p)) return 'WIDE_MID';
    if (['RW', 'LW'].includes(p)) return 'WINGER';
    if (p === 'ST') return 'FWD';
    return 'CM';
  }
/*@CHUNK:c0011:END*/

/*@CHUNK:c0012:START*/

  // The full set of individual (eFootball-style) player playstyle tags
  // usable in player-attributes.json, with the human-readable description
  // shown as a tooltip wherever a playstyle tag is rendered in the UI.
  const PLAYSTYLE_DESCRIPTIONS = {
    'Goal Poacher':          'A striker who constantly looks to run behind the defensive line and attack scoring positions.',
    'Fox in the Box':        'A penalty-box specialist who focuses on finding space and finishing chances inside the area.',
    'Target Man':            'A striker who uses strength and positioning to receive the ball and bring teammates into play.',
    'Deep-Lying Forward':    'Drops deeper to receive the ball and create opportunities rather than constantly staying on the defensive line.',
    'Dummy Runner':          'Makes decoy runs to drag defenders away and create space for teammates.',
    'Creative Playmaker':    'Moves intelligently to receive the ball, create chances, and link attacks.',
    'Hole Player':           'Makes aggressive late runs into the box to exploit spaces and score.',
    'Classic No. 10':        'A traditional playmaker who stays relatively central and focuses on passing and creativity.',
    'Prolific Winger':       'Stays wide, attacks the flank, and frequently cuts inside or delivers crosses.',
    'Cross Specialist':      'Positions himself wide and prioritizes delivering accurate crosses into the box.',
    'Roaming Flank':         'Frequently leaves the wing and moves into central areas to participate in attacks.',
    'Inside Forward':        'Starts from a wide position but aggressively cuts inside toward goal.',
    'Box-to-Box':            'Constantly contributes at both ends of the pitch, covering large areas throughout the match.',
    'Destroyer':             'Aggressively presses, tackles, and challenges opponents to win possession.',
    'Anchor Man':            'Holds his defensive position in front of the back line and provides defensive stability.',
    'Orchestrator':          'Controls the tempo from deeper areas through intelligent positioning and passing.',
    'Build Up':              'A defender who drops into good positions and helps initiate attacks from the back.',
    'Extra Frontman':        'A defender who frequently moves forward and joins the attack when opportunities arise.',
    'Offensive Full-back':   'A full-back who aggressively pushes forward to support attacks and provide width.',
    'Full-back Finisher':    'A full-back who makes attacking runs into dangerous areas and can arrive in scoring positions.',
    'Offensive Goalkeeper':  'Proactively comes off his line to sweep up through balls and support a high defensive line.',
    'Defensive Goalkeeper':  'Stays closer to his goal and prioritizes traditional shot-stopping and positioning.'
  };

  // Individual eFootball-style playstyle tag -> which team manager
  // playstyles (see PLAYSTYLES above) it's naturally suited to. Used for
  // the "manager affinity" overall bonus below — a role player who
  // genuinely fits the way their manager sets the team up plays a little
  // better than the raw numbers alone would suggest.
  const PLAYSTYLE_AFFINITY = {
    'Goal Poacher':          ['Quick Counter', 'Long Ball Counter'],
    'Fox in the Box':        ['Overload', 'Quick Counter'],
    'Target Man':            ['Long Ball', 'Long Ball Counter'],
    'Deep-Lying Forward':    ['Possession'],
    'Dummy Runner':          ['Overload', 'Quick Counter'],
    'Creative Playmaker':    ['Possession', 'Overload'],
    'Hole Player':           ['Overload', 'Possession'],
    'Classic No. 10':        ['Possession'],
    'Prolific Winger':       ['Out Wide', 'Overload'],
    'Cross Specialist':      ['Out Wide'],
    'Roaming Flank':         ['Out Wide', 'Overload'],
    'Inside Forward':        ['Out Wide', 'Quick Counter'],
    'Box-to-Box':            ['Overload', 'Quick Counter'],
    'Destroyer':             ['Long Ball Counter', 'Quick Counter'],
    'Anchor Man':            ['Possession', 'Long Ball Counter'],
    'Orchestrator':          ['Possession'],
    'Build Up':              ['Possession','Long Ball Counter'],
    'Extra Frontman':        ['Overload', 'Long Ball'],
    'Offensive Full-back':   ['Overload', 'Out Wide'],
    'Defensive Full-back': ['Overload','Long Ball Counter'],
    'Full-back Finisher':    ['Overload', 'Out Wide'],
    'Offensive Goalkeeper':  ['Possession', 'Overload'],
    'Defensive Goalkeeper':  ['Long Ball Counter', 'Quick Counter']
  };

  // Flat nudges applied to a player's derived att/def/pac/phy/tec once
  // their raw ratings have been averaged (see deriveStatsFromAttributes
  // below) — this is what stops every player who plays the same position
  // from converging on the same generic profile. Each playstyle pulls the
  // final 5-stat blend in a distinct direction (small, deliberately modest
  // nudges, summed across every tag a player has, then clamped 1-99).
  const PLAYSTYLE_STAT_MODS = {
    'Goal Poacher':          { att: 3,  pac: 2,  def: -2 },
    'Fox in the Box':        { att: 3,  tec: 1,  pac: -1 },
    'Target Man':            { phy: 3,  att: 1,  pac: -2 },
    'Deep-Lying Forward':    { tec: 3,  att: -1 },
    'Dummy Runner':          { pac: 2,  phy: 1,  att: -1 },
    'Creative Playmaker':    { tec: 3,  att: 1,  phy: -1 },
    'Hole Player':           { att: 2,  pac: 2,  def: -1 },
    'Classic No. 10':        { tec: 3,  def: -1 },
    'Prolific Winger':       { pac: 2,  att: 2,  def: -1 },
    'Cross Specialist':      { tec: 2,  pac: 1,  def: -1 },
    'Roaming Flank':         { tec: 2,  pac: 1 },
    'Inside Forward':        { att: 3,  pac: 1,  def: -1 },
    'Box-to-Box':            { phy: 2,  tec: 1,  def: 1 },
    'Destroyer':             { def: 3,  phy: 1,  tec: -1 },
    'Anchor Man':            { def: 3,  tec: 1,  pac: -1 },
    'Orchestrator':          { tec: 3,  def: 1,  pac: -1 },
    'Build Up':              { tec: 2,  def: 1 },
    'Extra Frontman':        { att: 2,  phy: 1,  def: -1 },
    'Offensive Full-back':   { pac: 2,  att: 1,  def: -1 },
    'Defensive Full-back':  { pac: 2,  att: -1,  def: 1 },
    'Full-back Finisher':    { att: 3,  pac: 1,  def: -1 },
    'Offensive Goalkeeper':  { pac: 2,  tec: 2,  def: -1 },
    'Defensive Goalkeeper':  { def: 3,  phy: 1 }
  };

  // Which raw expanded-attribute ratings define each individual playstyle's
  // "signature" traits. Used two ways:
  //  1) Overall calc: a player whose signature attributes for their own
  //     playstyle(s) run hotter than their attribute sheet on average gets
  //     a much bigger push toward their overall than a generic 5-stat blend
  //     would give them — see styleSignatureBonus() below.
  //  2) Manager attribute boost: when a player's playstyle fits their
  //     manager's tactic, the manager boost is applied directly to these
  //     specific raw ratings (not just a flat overall number) — see
  //     applyManagerAttributeBoost() below.
  const PLAYSTYLE_KEY_ATTRS = {
    'Goal Poacher':          ['off_awr', 'ball_con', 'tight_pos', 'fin', 'spd', 'accel', 'bal'],
    'Fox in the Box':        ['off_awr', 'tight_pos', 'fin', 'ball_con', 'head', 'bal', 'accel'],
    'Target Man':            ['off_awr', 'tight_pos', 'fin', 'head', 'phy_con', 'bal', 'ball_con'],
    'Deep-Lying Forward':    ['off_awr', 'ball_con', 'tight_pos', 'low_pass', 'fin', 'place_kick', 'phy_con'],
    'Dummy Runner':          ['off_awr', 'spd', 'accel', 'stam', 'bal', 'tight_pos'],
    'Creative Playmaker':    ['ball_con', 'dribb', 'tight_pos', 'low_pass', 'lofted_pass', 'place_kick', 'curl'],
    'Hole Player':           ['off_awr', 'tight_pos', 'fin', 'spd', 'accel', 'stam', 'bal'],
    'Classic No. 10':        ['ball_con', 'tight_pos', 'low_pass', 'lofted_pass', 'place_kick', 'curl', 'fin'],
    'Prolific Winger':       ['off_awr', 'ball_con', 'dribb', 'tight_pos', 'spd', 'accel', 'curl'],
    'Cross Specialist':      ['off_awr', 'ball_con', 'low_pass', 'lofted_pass', 'curl', 'spd', 'stam'],
    'Roaming Flank':         ['off_awr', 'ball_con', 'dribb', 'tight_pos', 'low_pass', 'spd', 'stam'],
    'Inside Forward':        ['off_awr', 'ball_con', 'dribb', 'tight_pos', 'fin', 'spd', 'accel'],
    'Box-to-Box':            ['off_awr', 'def_awr', 'def_eng', 'stam', 'spd', 'accel', 'bal', 'phy_con'],
    'Destroyer':             ['def_awr', 'def_eng', 'tack', 'aggr', 'phy_con', 'spd', 'stam'],
    'Anchor Man':            ['def_awr', 'def_eng', 'tack', 'aggr', 'phy_con', 'ball_con', 'low_pass'],
    'Orchestrator':          ['ball_con', 'tight_pos', 'low_pass', 'lofted_pass', 'place_kick', 'curl', 'stam'],
    'Build Up':              ['def_awr', 'ball_con', 'low_pass', 'lofted_pass', 'tight_pos', 'phy_con'],
    'Extra Frontman':        ['def_awr', 'off_awr', 'def_eng', 'tack', 'aggr', 'fin', 'stam'],
    'Offensive Full-back':   ['off_awr', 'spd', 'accel', 'stam', 'low_pass', 'lofted_pass'],
    'Defensive Full-back':   ['def_awr', 'spd', 'accel', 'stam', 'def_eng', 'phy_con'],
    'Full-back Finisher':    ['off_awr', 'fin', 'spd', 'accel', 'dribb', 'ball_con', 'stam'],
    'Offensive Goalkeeper':  ['gk_awr', 'gk_reflex', 'gk_reach', 'gk_parry', 'spd', 'accel', 'ball_con'],
    'Defensive Goalkeeper':  ['gk_awr', 'gk_catch', 'gk_parry', 'gk_reflex', 'gk_reach', 'jmp', 'phy_con']
  };
  // Every raw numeric rating that can appear on an expanded attribute
  // sheet, in display order, grouped for the player-profile UI. GK ratings
  // only render for goalkeepers; outfield ratings only render for outfield
  // players (see expandedAttrRowsHTML below).
  const EXPANDED_ATTR_GROUPS = [
    { label: 'Offense', keys: [
      ['off_awr', 'Off. Awareness'], ['fin', 'Finishing'], ['head', 'Heading'],
      ['place_kick', 'Place Kicking'], ['kick_pwr', 'Kicking Power']
    ] },
    { label: 'Ball Skills', keys: [
      ['ball_con', 'Ball Control'], ['dribb', 'Dribbling'], ['tight_pos', 'Tight Poss.'],
      ['low_pass', 'Low Pass'], ['lofted_pass', 'Lofted Pass'], ['curl', 'Curl']
    ] },
    { label: 'Physical', keys: [
      ['spd', 'Speed'], ['accel', 'Acceleration'], ['stam', 'Stamina'],
      ['phy_con', 'Physical Contact'], ['bal', 'Balance'], ['jmp', 'Jump']
    ] },
    { label: 'Defense', keys: [
      ['def_awr', 'Def. Awareness'], ['def_eng', 'Def. Engagement'], ['tack', 'Tackling'], ['aggr', 'Aggression']
    ] },
    { label: 'Goalkeeping', keys: [
      ['gk_awr', 'GK Awareness'], ['gk_catch', 'GK Catch'], ['gk_parry', 'GK Parry'],
      ['gk_reflex', 'GK Reflexes'], ['gk_reach', 'GK Reach']
    ] }
  ];
  // Average of every numeric raw rating a player's sheet actually has
  // (GK ratings only count for keepers, so a keeper's sheet isn't dragged
  // down by outfield-only zeros and vice versa) — the baseline that a
  // playstyle's signature attributes are compared against.
/*@CHUNK:c0012:END*/

/*@CHUNK:c0013:START*/
  function attrSheetAverage(attr, isGK) {
    const outfieldKeys = ['off_awr','ball_con','tight_pos','fin','spd','accel','bal','head','phy_con',
      'low_pass','place_kick','stam','dribb','lofted_pass','curl','def_awr','def_eng','tack','aggr','jmp','kick_pwr'];
    const gkKeys = ['gk_awr','gk_catch','gk_parry','gk_reflex','gk_reach','spd','accel','bal','phy_con','stam','jmp'];
    const keys = isGK ? gkKeys : outfieldKeys;
    const nums = keys.map(k => attr[k]).filter(v => typeof v === 'number');
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 65;
  }
/*@CHUNK:c0013:END*/

/*@CHUNK:c0022:START*/

  // What a player does immediately *after* beating their man with a skill
  // move — this is where individual playstyle turns a generic "dribbles
  // past" into a distinct passage of play per role.
  const DRIBBLE_FOLLOWUP = {
    'Prolific Winger':      ['then whips a cross in first time', 'before floating a ball across the six-yard box'],
    'Cross Specialist':     ['and immediately looks up for a cross', 'before whipping one into the danger area'],
    'Inside Forward':       ['then cuts inside onto his favoured foot', 'and drives infield looking for the shot'],
    'Roaming Flank':        ['before drifting inside to keep the move going', 'then picks out a pass through the middle'],
    'Goal Poacher':         ['then bursts into the box for the return', 'and darts across his marker looking for space'],
    'Fox in the Box':       ['and spins into the six-yard box', 'before checking his run at the near post'],
    'Hole Player':          ['before arriving late into the box', 'and times a run beyond the last defender'],
    'Creative Playmaker':   ['before threading a pass through the lines', 'and picks out a teammate with the outside of the boot'],
    'Classic No. 10':       ['before slipping a clever ball through', 'and takes a touch to pick his pass'],
    'Dummy Runner':         ['before checking away to drag a marker with him', 'and peels off to open a passing lane'],
    'Box-to-Box':           ['before driving forward with the ball', 'and carries it thirty yards up the pitch'],
    'Deep-Lying Forward':   ['before laying it off and continuing the move', 'and drops deep again looking for the next pass'],
    'Orchestrator':         ['before recycling it and resetting the attack', 'and slows the tempo back down'],
    'Offensive Full-back':  ['before overlapping down the line', 'and gets to the byline looking for a cutback'],
    'Full-back Finisher':   ['before arriving late into the box himself', 'and keeps running into a scoring position']
  };
  // Through-ball / defence-splitting pass flavor by the passer's playstyle.
  const THROUGH_BALL_FLAVOR = {
    'Creative Playmaker':   ['reads the game a yard ahead of everyone and threads a defence-splitting ball into the channel'],
    'Classic No. 10':       ['waits, then slides a perfectly weighted ball through the lines'],
    'Orchestrator':         ['dictates the tempo before releasing a pass through the channel'],
    'Deep-Lying Forward':   ['drops deep to collect, then spins a first-time pass in behind'],
    'Dummy Runner':         ['drags a marker away before slipping the ball into the space he vacated']
  };
  // Tackle-and-win flavor by the defender's playstyle.
  const TACKLE_FLAVOR = {
    'Destroyer':            ['throws himself into a crunching challenge and comes away with the ball'],
    'Anchor Man':           ['reads the danger early and snuffs it out with a perfectly timed tackle'],
    'Box-to-Box':           ['recovers back at full sprint to make a vital tackle on the edge of the box'],
    'Build Up':             ['steps in calmly to win the ball back before it becomes a problem']
  };
  // Interception flavor by the defender's playstyle.
  const INTERCEPTION_FLAVOR = {
    'Destroyer':            ['pounces to intercept, snapping into the passing lane'],
    'Anchor Man':           ['reads the pass superbly and steps in front of his man to intercept'],
    'Orchestrator':         ['anticipates the pass and cuts it out before it develops'],
    'Build Up':             ['calmly intercepts and immediately looks to start a move of his own']
  };
  // "Keeps possession ticking over" flavor by the on-ball player's playstyle.
  const POSSESSION_FLAVOR = {
    'Orchestrator':         ['controls the tempo from deep, in no hurry to give the ball away'],
    'Classic No. 10':       ['pulls the strings from a pocket of space'],
    'Creative Playmaker':   ['probes for an opening, constantly on the move to stay available'],
    'Build Up':             ['brings the ball out from the back under no real pressure'],
    'Deep-Lying Forward':   ['drops off the front line to link the play']
  };
  // Off-the-ball movement flavor for a missed big chance, describing *how*
  // the player got into the position in the first place.
  const BIG_CHANCE_FLAVOR = {
    'Goal Poacher':         ['times a run in behind the last defender'],
    'Fox in the Box':       ['reacts quickest to a loose ball in the six-yard box'],
    'Hole Player':          ['arrives late and unmarked at the back post'],
    'Dummy Runner':         ["ghosts into the space a decoy run opened up"],
    'Inside Forward':       ['cuts in from the flank onto his favoured foot']
  };
  // Extra descriptive clause appended to a goal's method text based on the
  // scorer's playstyle, so the same "tap-in" reads differently for a Fox in
  // the Box than for a Full-back Finisher arriving from deep.
  const GOAL_FLAVOR_SUFFIX = {
    'Goal Poacher':         ['after peeling off the last defender'],
    'Fox in the Box':       ['pouncing first on a loose ball in the six-yard box'],
    'Target Man':           ['rising above his marker'],
    'Hole Player':          ['arriving late and completely unmarked'],
    'Inside Forward':       ['cutting in from the flank onto his stronger foot'],
    'Full-back Finisher':   ['arriving from deep, well beyond his usual position'],
    'Extra Frontman':       ['pushing forward from the back to get on the end of it'],
    'Deep-Lying Forward':   ['picking up the pieces after dropping deep to link play']
  };

  // Derives the 5 gameplay stats from a player-attributes.json entry.
  // Goalkeepers draw def/tec from their GK-specific ratings (shot-stopping,
  // handling, distribution) instead of the outfield ones.
/*@CHUNK:c0022:END*/

/*@CHUNK:c0023:START*/
  function deriveStatsFromAttributes(attr, posArr) {
    const isGK = ((posArr && posArr[0]) || attr.pos && attr.pos[0]) === 'GK';
    const avg = (...vals) => {
      const nums = vals.filter(v => typeof v === 'number');
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 60;
    };
    const pac = avg(attr.spd, attr.accel);
    const phy = isGK
      ? avg(attr.phy_con, attr.jmp, attr.bal, attr.stam)
      : avg(attr.phy_con, attr.jmp, attr.bal, attr.stam, attr.aggr);
    const tec = isGK
      ? avg(attr.gk_catch, attr.low_pass, attr.lofted_pass, attr.ball_con)
      : avg(attr.ball_con, attr.dribb, attr.low_pass, attr.lofted_pass, attr.curl, attr.tight_pos);
    const att = isGK
      ? avg(attr.off_awr, attr.kick_pwr, attr.place_kick)
      : avg(attr.fin, attr.off_awr, attr.head, attr.place_kick, attr.kick_pwr);
    const def = isGK
      ? avg(attr.gk_awr, attr.gk_parry, attr.gk_reflex, attr.gk_reach, attr.gk_catch)
      : avg(attr.def_awr, attr.def_eng, attr.tack, attr.aggr);
    const clamp = (v) => Math.max(1, Math.min(99, Math.round(v)));
    // Apply each of the player's individual playstyle tags as a small flat
    // nudge to the raw averages above — this is what keeps two players in
    // the same position from converging on an identical 5-stat profile;
    // a Target Man and a Goal Poacher playing the same ST slot come out
    // with a visibly different att/phy/pac balance.
    let pacAdj = pac, phyAdj = phy, tecAdj = tec, attAdj = att, defAdj = def;
    (attr.playstyle || []).forEach((style) => {
      const mod = PLAYSTYLE_STAT_MODS[style];
      if (!mod) return;
      if (mod.pac) pacAdj += mod.pac;
      if (mod.phy) phyAdj += mod.phy;
      if (mod.tec) tecAdj += mod.tec;
      if (mod.att) attAdj += mod.att;
      if (mod.def) defAdj += mod.def;
    });
    return { pac: clamp(pacAdj), phy: clamp(phyAdj), tec: clamp(tecAdj), att: clamp(attAdj), def: clamp(defAdj) };
  }
/*@CHUNK:c0023:END*/

/*@CHUNK:c0024:START*/

/*@CHUNK:c0024:END*/

/*@CHUNK:c0025:START*/
  function weightedOverall(derived, posArr) {
    const w = ATTR_POS_WEIGHTS[attrPosGroup(posArr)] || ATTR_POS_WEIGHTS.CM;
    return Math.round(derived.att * w.att + derived.def * w.def + derived.pac * w.pac +
      derived.phy * w.phy + derived.tec * w.tec);
  }
/*@CHUNK:c0025:END*/

/*@CHUNK:c0025b:START*/
  // ===== eFootball-style overall boost =====
  // A flat positional weighted-average (weightedOverall above) treats every
  // stat as interchangeable, so a genuine standout attribute gets diluted
  // into the mean instead of standing out — nothing in a plain average can
  // ever land near the top of the scale. eFootball's overall calc instead
  // leans the final number toward a player's best stats, so a truly special
  // attribute pulls the whole rating up with it. OVERALL_BOOST_LEAN controls
  // how much of the gap between the flat average and the player's peak stat
  // gets folded back in — 0 would be a pure average (old behavior), 1 would
  // just be "OVR = best stat". Only expanded-attribute (enhanced) players
  // run through this; everyone else keeps the plain teams.json number.
  const OVERALL_BOOST_LEAN = 0.38;
  const OVERALL_CAP = 100;
  const OVERALL_FLOOR = 40;
  // Non-expanded ("regular") players are scaled down relative to the
  // enhanced/expanded-attribute roster so the boosted players read as
  // genuinely special rather than everyone converging on the same numbers.
  const REGULAR_OVR_MULTIPLIER = 0.95;

  function efootballBoostedOverall(derived, posArr) {
    const flatAvg = weightedOverall(derived, posArr);
    const peak = Math.max(derived.att, derived.def, derived.pac, derived.phy, derived.tec);
    return flatAvg + (peak - flatAvg) * OVERALL_BOOST_LEAN;
  }
/*@CHUNK:c0025b:END*/

/*@CHUNK:c0028:START*/

  // Applies player-attributes.json to every matching player on every team.
  // Runs once at startup, after restorePlayerForms() so it can safely
  // overwrite this player's persisted baseOvr with the freshly-derived
  // (and manager-affinity-boosted) baseline while still preserving their
  // accumulated form delta on top of it — see the form system's comment
  // near applyPlayerForm() for how baseOvr/form/ovr relate.
/*@CHUNK:c0028:END*/

/*@CHUNK:c0029:START*/
  function applyExpandedPlayerAttributes() {
    const hasExpandedData = !!(playerAttributesData && Object.keys(playerAttributesData).length);
    allTeams.forEach((team) => {
      (team.players || []).forEach((p) => {
        const rawAttr = hasExpandedData ? playerAttributesData[p.id] : null;
        if (!rawAttr) {
          // Regular (non-enhanced) player: no expanded attribute sheet, so
          // they don't get the eFootball-style peak-stat boost below. To
          // keep enhanced players reading as genuinely special rather than
          // everyone converging on similar numbers, regular players are
          // scaled down a flat 5% off their original teams.json overall.
          // Always derives from p.rawOvr (captured once at load, before any
          // system here touches p.ovr) so this can never compound across
          // repeated calls or save/reload sessions.
          const source = (typeof p.rawOvr === 'number') ? p.rawOvr : (p.baseOvr || p.ovr || 70);
          const scaledBase = Math.max(OVERALL_FLOOR, Math.min(OVERALL_CAP, Math.round(source * REGULAR_OVR_MULTIPLIER)));
          p.baseOvr = scaledBase;
          p.ovr = Math.max(OVERALL_FLOOR, Math.min(OVERALL_CAP, Math.round(scaledBase + (p.form || 0))));
          p.attrBoosted = false;
          return;
        }
        const posArr = (rawAttr.pos && rawAttr.pos.length) ? rawAttr.pos : (p.pos || ['CM']);
        const isGK = posArr[0] === 'GK';
        const teamStyle = getManagerPlaystyle(team);
        // Manager coaching sharpens the specific raw ratings behind a
        // player's playstyle when it suits the team's tactic — this feeds
        // into everything downstream (derived stats, overall, and the
        // expanded sheet the profile UI displays), not just a flat OVR add.
        const attr = applyManagerAttributeBoost(rawAttr, rawAttr.playstyle, teamStyle);
        const derived = deriveStatsFromAttributes(attr, posArr);
        p.att = derived.att; p.def = derived.def; p.pac = derived.pac;
        p.phy = derived.phy; p.tec = derived.tec;
        // The expanded sheet's position list is more detailed (multiple
        // valid roles) — prefer it over teams.json's when present.
        if (attr.pos && attr.pos.length) p.pos = attr.pos.slice();
        const affinity = managerAffinityBonus(attr.playstyle, teamStyle);
        // A player whose signature attributes for their own playstyle(s)
        // run well above their sheet average gets a much bigger push
        // toward their overall here than the generic 5-stat blend alone
        // would give them.
        const signatureBonus = styleSignatureBonus(attr, attr.playstyle, isGK);
        // eFootball-style boost: lean the flat weighted average toward the
        // player's peak stat instead of just averaging it away, then layer
        // the signature/affinity bonuses on top. Cap raised to 100 (was 99)
        // so a truly elite enhanced player can actually reach a perfect OVR.
        const base = efootballBoostedOverall(derived, posArr) + signatureBonus;
        const boostedBase = Math.max(OVERALL_FLOOR, Math.min(OVERALL_CAP, Math.round(base + affinity)));
        p.baseOvr = boostedBase;
        p.ovr = Math.max(OVERALL_FLOOR, Math.min(OVERALL_CAP, Math.round(boostedBase + (p.form || 0))));
        p.expandedAttrs = attr;
        p.attrBoosted = true;
        p.affinityBonus = affinity;
        p.affinityStyle = teamStyle;
        p.signatureBonus = signatureBonus;
        p.managerAttrBoosted = !!attr.managerBoosted;
      });
    });
  }
/*@CHUNK:c0029:END*/

/*@CHUNK:c0030:START*/

  // ===== Expanded-attribute gameplay hooks =====
  // The functions below are what stop a boosted player's expanded sheet from
  // "fading into" the same generic att/def/pac/phy/tec/ovr numbers everyone
  // else uses. Each one reads specific raw ratings/skills straight off
  // p.expandedAttrs (only set for player-attributes.json matches) and nudges
  // a specific in-match probability — who wins a header, how a penalty or
  // free kick goes, how a tackle resolves, how injury-prone someone is —
  // beyond what the 5 compact stats alone would produce. Every one of them
  // returns a neutral value (0 bonus, or a multiplier that reduces to the
  // pre-existing behaviour) when a player has no expanded sheet, so nothing
  // about the old system changes for anyone else.
/*@CHUNK:c0030:END*/

/*@CHUNK:c0031:START*/
  // player-attributes.json is hand-authored data and carries real-world
  // inconsistency in how a skill name is spelled/punctuated ("First-time
  // Shor" instead of "Shot", "GK Direct Throw" instead of "GK Long Throws",
  // "Long-Range Curler" vs "Long-range Curler", etc). hasSkill() normalizes
  // both sides of the comparison (lowercase, strip all non-alphanumerics)
  // so spacing/hyphen/case differences always match, and a small alias
  // table on top catches the genuine misspellings/synonyms that
  // normalization alone can't fix. This is the single source of truth every
  // skill-gated gameplay hook below reads through, so fixing a name here
  // fixes it everywhere at once.
  function normSkillKey(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  const SKILL_NAME_ALIASES = {
    'firsttimeshor': 'firsttimeshot',
    'acrobaticclear': 'acrobaticclearance',
    'acromaticfinishing': 'acrobaticfinishing',
    'aerialforte': 'aerialfort',
    'gkdirectthrow': 'gklongthrows',
    'gklongthrow': 'gklongthrows',
    'longthrow': 'longthrows',
    'risingshots': 'risingshot',
    'longrangeshor': 'longrangeshooting'
  };
  // Caches normalized skill names to eliminate redundant string regex/replace operations
  const _canonSkillCache = new Map();
  function canonSkillKey(s) {
    let k = _canonSkillCache.get(s);
    if (k !== undefined) return k;
    const norm = normSkillKey(s);
    k = SKILL_NAME_ALIASES[norm] || norm;
    _canonSkillCache.set(s, k);
    return k;
  }
  // Fast O(1) skill lookup using a lazily-initialized Set on p.expandedAttrs.
  // Reduces match-simulation skill checks from O(N) array scans to O(1) Set lookups.
  function hasSkill(p, skillName) {
    if (!p || !p.expandedAttrs) return false;
    let skillSet = p.expandedAttrs._skillSet;
    if (!skillSet) {
      skillSet = new Set((p.expandedAttrs.skills || []).map(canonSkillKey));
      p.expandedAttrs._skillSet = skillSet;
    }
    return skillSet.has(canonSkillKey(skillName));
  }
/*@CHUNK:c0031:END*/

/*@CHUNK:c0032:START*/
  function xattr(p, key, fallback) {
    const v = p && p.expandedAttrs && p.expandedAttrs[key];
    return typeof v === 'number' ? v : fallback;
  }
/*@CHUNK:c0032:END*/

/*@CHUNK:c0032b:START*/
  // ===== Match-state context helpers for the game-state-gated skills =====
  // (Fortress, Game-Changing Pass, GK Spirit Roar, Super-Sub) — all of them
  // key off which side a player is on, whether their team is currently
  // ahead/behind, and (for Super-Sub) when they came off the bench. Centralized
  // here so every engine file that needs match-state context reads it the same way.
  function playerSideData(p) {
    const m = currentMatch;
    if (!m || !p) return null;
    const inHome = ((m.home.squad && m.home.squad.all) || []).some((x) => x.id === p.id);
    return { m, side: inHome ? m.home : m.away, opp: inHome ? m.away : m.home, sideKey: inHome ? 'home' : 'away' };
  }
  function playerTeamLeadingSecondHalf(p) {
    const ctx = playerSideData(p);
    if (!ctx || ctx.m.minute < 46) return false;
    return (ctx.side.score || 0) > (ctx.opp.score || 0);
  }
  function playerTeamTrailingOrDrawingSecondHalf(p) {
    const ctx = playerSideData(p);
    if (!ctx || ctx.m.minute < 46) return false;
    return (ctx.side.score || 0) <= (ctx.opp.score || 0);
  }
  // True if the goalkeeper currently on pitch for this player's own team has
  // the given skill (used for GK Directing Defense / GK Spirit Roar, whose
  // effect is on the team's defenders, not the keeper's own actions).
  function teamGkHasSkill(p, skillName) {
    const ctx = playerSideData(p);
    if (!ctx) return false;
    const ids = ctx.sideKey === 'home' ? ctx.m.homeOnPitch : ctx.m.awayOnPitch;
    const gk = ((ctx.side.squad && ctx.side.squad.all) || []).find((x) => ids.includes(x.id) && (x.slot || (x.pos || [])[0]) === 'GK');
    return !!gk && hasSkill(gk, skillName);
  }
  // Super-Sub: only "active" once the player has actually come on as a
  // substitute in the second half — a starter with the skill on their sheet
  // gets no bonus from it.
  function isActingSuperSub(p) {
    if (!p || !hasSkill(p, 'Super-Sub')) return false;
    const ctx = playerSideData(p);
    if (!ctx || !ctx.m.subLog) return false;
    const log = ctx.m.subLog[ctx.sideKey] && ctx.m.subLog[ctx.sideKey][p.id];
    return !!(log && log.inMin != null && log.inMin >= 45);
  }
/*@CHUNK:c0032b:END*/

/*@CHUNK:c0298:START*/
  function persistPlayerForms() {
    try {
      return safeSetItem('apexPlayerForms', JSON.stringify(collectPlayerFormsMap()));
    } catch (e) { return false; }
  }
/*@CHUNK:c0298:END*/

/*@CHUNK:c0299:START*/
  function restorePlayerForms() {
    try {
      const raw = localStorage.getItem('apexPlayerForms');
      if (!raw) return;
      const map = JSON.parse(raw);
      allTeams.forEach(t => (t.players || []).forEach(p => {
        const e = map[p.id];
        if (e) {
          p.form = e.form;
          p.baseOvr = (typeof e.baseOvr === 'number') ? e.baseOvr : p.ovr;
          p.ovr = e.ovr;
        }
      }));
    } catch (e) {}
  }
/*@CHUNK:c0299:END*/

/*@CHUNK:c0300:START*/

/*@CHUNK:c0300:END*/

/*@CHUNK:c0301:START*/
  function findPlayerTeams(playerId) {
    let national = null, club = null;
    (teamsData.national || []).forEach(t => {
      if ((t.players || []).some(p => p.id === playerId)) national = t.name;
    });
    (teamsData.club || []).forEach(t => {
      if ((t.players || []).some(p => p.id === playerId)) club = t.name;
    });
    // Same real player may exist as two separate roster entries (club + country)
    // with different ids — fall back to a name match to link them. Because
    // different, unrelated players CAN share an identical name, this fallback
    // only accepts a match when it's unambiguous: exactly one other roster
    // entry with that name, and its position overlaps the source player's
    // position. Ambiguous name collisions are left blank rather than risking
    // attributing one player's country/club to a different, same-named player.
    if (!national || !club) {
      let srcPlayer = null;
      allTeams.forEach(t => {
        const p = (t.players || []).find(x => x.id === playerId);
        if (p) srcPlayer = p;
      });
      if (srcPlayer && srcPlayer.name) {
        const pname = srcPlayer.name;
        const srcPos = (srcPlayer.pos || [])[0];
        const posMatches = (p) => !srcPos || !p.pos || !p.pos.length || p.pos.includes(srcPos);
        if (!national) {
          const matches = [];
          (teamsData.national || []).forEach(t => {
            (t.players || []).forEach(p => {
              if (p.id !== playerId && p.name === pname && posMatches(p)) matches.push(t.name);
            });
          });
          const uniqueTeams = [...new Set(matches)];
          if (uniqueTeams.length === 1) national = uniqueTeams[0];
        }
        if (!club) {
          const matches = [];
          (teamsData.club || []).forEach(t => {
            (t.players || []).forEach(p => {
              if (p.id !== playerId && p.name === pname && posMatches(p)) matches.push(t.name);
            });
          });
          const uniqueTeams = [...new Set(matches)];
          if (uniqueTeams.length === 1) club = uniqueTeams[0];
        }
      }
    }
    return { national, club };
  }
/*@CHUNK:c0301:END*/
