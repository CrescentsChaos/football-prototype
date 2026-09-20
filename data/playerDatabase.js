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
    'Defensive Goalkeeper':  'Stays closer to his goal and prioritizes traditional shot-stopping and positioning.',
    'Pass Disruptor':        'A defensive midfielder who blocks passing lanes and reads the game to intercept before a tackle is needed.',
    'Front Line Pressure':   'Leads the press from the front, hunting the ball high up the pitch to force turnovers.',
    'Attack Outlet':         'Stays high up the pitch as an out-ball, ready to break in behind on the counter-attack.',
    'High Line Master':      'Steps up in unison with the defensive line to catch attackers offside and keep the team compact.',
    'Covering Role':     'Drops off to cover space behind the back line and sweep up danger before it reaches goal.',
    'Shadow Marker':         'Tracks a single opponent tightly across the pitch, man-marking rather than holding a zone.'
  };

  // Human-readable one-line description for each individual personality
  // trait tag (see personality.md for the full, per-tag engine-hook detail)
  // — shown as a tooltip wherever a personality badge is rendered in the
  // player profile UI (ui/playerUI.js). Only ever populated for a player
  // whose expanded attribute sheet actually lists a personality array;
  // most players simply have none.
  const PERSONALITY_DESCRIPTIONS = {
    'Big-Game':             'Raises his own shot quality in high-stakes moments — derbies, finals, close games late on.',
    'Fragile':              'The mirror of Big-Game — shot quality drops under those same high-stakes moments.',
    'Ice-Cold':             'A cool head from the penalty spot and on free-kicks when the stakes are up.',
    'Bottler':              'The mirror of Ice-Cold — penalty and free-kick conversion suffers when the stakes are up.',
    'Big Occasion Flop':    'Passing accuracy drops specifically in high-stakes moments.',
    'Big Occasion Riser':   'Match rating ceiling rises in cup and knockout fixtures.',
    'Confidence Player':    'Grows in composure while on a scoring run this match, resetting the moment a chance goes begging.',
    "Finisher's Instinct":  'An extra edge on shot quality late in a match, whatever the scoreline.',
    'Homebody':             'Less effective in front of goal, in passing, and in dribbling away from home.',
    'Set-Piece Specialist': 'A composure boost at corners and free-kicks, at all times.',
    'Volatile':             'More likely to commit a foul himself.',
    'Calm':                 'The mirror of Volatile — less likely to commit a foul himself.',
    'Provocateur':          'Needles opponents into rash challenges, raising the marker\u2019s own foul probability.',
    'Hot-Head':             'Extra second-yellow risk once already booked.',
    'Cynical':              'More likely to concede a tactical foul to stop a breakaway, less likely to be carded for it.',
    'Leader':               'Deepens the captain\u2019s aura — extra fatigue-drain and form-spread dampening for the team.',
    'Talisman':             'A small composure lift for teammates and a fatigue-drain reduction for the side just by being on the pitch.',
    'Brittle':              'A personal injury-risk multiplier layered on top of his raw injury resistance.',
    'Iron Man':             'The mirror of Brittle — reduced injury chance and genuinely slower fatigue drain.',
    'Determined':           'Fatigue drain eases late in a match specifically while his side is losing.',
    'Slow Starter':         'Reduced overall effectiveness in the first 15 minutes, recovering back to normal by then.',
    'Streaky':              'Runs hotter and colder than a normal Inconsistent player\u2019s form swings.',
    'Selfish':              'Leans toward shooting and dribbling over passing on the ball.',
    'Team Player':          'The mirror of Selfish — leans toward passing over personal shot/dribble volume.',
    'Showboat':             'Attempts more dribbles, with a slightly higher turnover risk once he goes for it.',
    'Grinder':              'Tackle and interception success rises specifically while his team is behind.',
    'Loyal':                'Lower willingness to push for a move away from his current club.',
    'Journeyman':           'The mirror of Loyal — higher willingness to move clubs.',
    'Mentor':               'Speeds up the development of younger teammates who share his position group.',
    'Prodigy':              'Faster development while young, at the cost of more volatile in-match form during those years.'
  };

  // Individual eFootball-style playstyle tag -> which team manager
  // playstyles (see PLAYSTYLES above) it's naturally suited to. Shown in
  // the player profile UI (see ui/playerUI.js) as a "fits the setup" tag
  // so it still reads as useful context, but it no longer feeds an overall
  // or attribute boost — a player's rating is the same regardless of which
  // manager they're playing under.
  const PLAYSTYLE_AFFINITY = {
    'Goal Poacher':          ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Fox in the Box':        ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Target Man':            ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Deep-Lying Forward':    ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Dummy Runner':          ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Creative Playmaker':    ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Hole Player':           ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Classic No. 10':        ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Prolific Winger':       ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Cross Specialist':      ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Roaming Flank':         ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Inside Forward':        ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Box-to-Box':            ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Destroyer':             ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Anchor Man':            ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Orchestrator':          ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Build Up':              ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Extra Frontman':        ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Offensive Full-back':   ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Defensive Full-back': ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Full-back Finisher':    ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Offensive Goalkeeper':  ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Defensive Goalkeeper':  ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Pass Disruptor':        ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Front Line Pressure':   ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Attack Outlet':         ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'High Line Master':      ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Covering Role':     ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
    'Shadow Marker':         ['Quick Counter', 'Long Ball Counter','Long Ball','Possession','Out Wide','Overload'],
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
    'Defensive Goalkeeper':  { def: 3,  phy: 1 },
    'Pass Disruptor':        { def: 2,  tec: 2,  phy: -1 },
    'Front Line Pressure':   { phy: 2,  def: 2,  tec: -1 },
    'Attack Outlet':         { pac: 3,  att: 1,  def: -2 },
    'High Line Master':      { def: 2,  pac: 2,  tec: -1 },
    'Covering Role':     { def: 3,  pac: 1,  att: -1 },
    'Shadow Marker':         { def: 3,  pac: 1,  tec: -1 }
  };

  // Which raw expanded-attribute ratings define each individual playstyle's
  // "signature" traits. A player whose signature attributes for their own
  // playstyle(s) run hotter than their attribute sheet on average gets a
  // bigger push toward their overall than a generic 5-stat blend would give
  // them — see styleSignatureBonus() below.
  const PLAYSTYLE_KEY_ATTRS = {
    'Goal Poacher':          ['off_awr', 'ball_con', 'tight_pos', 'fin', 'spd', 'accel', 'bal'],
    'Fox in the Box':        ['off_awr', 'tight_pos', 'fin', 'ball_con', 'head', 'bal', 'accel'],
    'Target Man':            ['off_awr', 'tight_pos', 'fin', 'head', 'phy_con', 'bal', 'ball_con'],
    'Deep-Lying Forward':    ['off_awr', 'ball_con', 'tight_pos', 'low_pass', 'fin', 'place_kick', 'phy_con'],
    'Dummy Runner':          ['off_awr', 'spd', 'accel', 'stam', 'bal', 'tight_pos'],
    'Creative Playmaker':    ['ball_con', 'dribb', 'tight_pos', 'low_pass', 'lofted_pass', 'place_kick', 'curl'],
     'Hole Player':           ['off_awr', 'tight_pos', 'ball_con', 'spd', 'dribb', 'stam', 'bal'],
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
    'Defensive Goalkeeper':  ['gk_awr', 'gk_catch', 'gk_parry', 'gk_reflex', 'gk_reach', 'jmp', 'phy_con'],
    'Pass Disruptor':        ['def_awr', 'def_eng', 'aggr', 'tack', 'ball_con', 'stam', 'spd'],
    'Front Line Pressure':   ['def_awr', 'def_eng', 'aggr', 'tack', 'stam', 'spd', 'accel'],
    'Attack Outlet':         ['off_awr', 'spd', 'accel', 'stam', 'ball_con', 'bal', 'fin'],
    'High Line Master':      ['def_awr', 'def_eng', 'spd', 'accel', 'aggr', 'phy_con', 'bal'],
    'Covering Role':     ['def_awr', 'def_eng', 'spd', 'accel', 'phy_con', 'bal', 'stam'],
    'Shadow Marker':         ['def_awr', 'def_eng', 'tack', 'aggr', 'spd', 'stam', 'phy_con']
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

/*@CHUNK:c0012b:START*/
  // player-attributes.json is hand-authored, and playstyle tags get typed
  // inconsistently just like skill names do ("Fox In The Box" instead of
  // "Fox in the Box", "goal poacher" instead of "Goal Poacher", etc). Every
  // playstyle-driven bonus below — PLAYSTYLE_STAT_MODS, PLAYSTYLE_KEY_ATTRS,
  // the signature-attribute bonus —
  // is a plain exact-string lookup, so a casing/spacing mismatch doesn't
  // error, it just silently matches nothing and that player quietly loses
  // their entire playstyle-driven bonus stack. normalizePlayerPlaystyleTags
  // rewrites every entry's playstyle array to its canonical spelling once,
  // right when the JSON loads (see ui/matchUI.js), so every lookup below
  // can stay a simple exact match and still always resolve correctly.
  function normPlaystyleKey(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  const PLAYSTYLE_CANON_MAP = (() => {
    const map = {};
    Object.keys(PLAYSTYLE_DESCRIPTIONS).forEach((name) => { map[normPlaystyleKey(name)] = name; });
    return map;
  })();
  function canonPlaystyleTag(raw) {
    const key = normPlaystyleKey(raw);
    return PLAYSTYLE_CANON_MAP[key] || raw;
  }
  function normalizePlayerPlaystyleTags(attrData) {
    if (!attrData) return;
    Object.keys(attrData).forEach((id) => {
      const entry = attrData[id];
      if (entry && Array.isArray(entry.playstyle)) {
        entry.playstyle = entry.playstyle.map(canonPlaystyleTag);
      }
    });
  }
/*@CHUNK:c0012b:END*/

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
    // Ceiling raised slightly from the old hard 99 card-max: playstyle
    // nudges (PLAYSTYLE_STAT_MODS below) are allowed to carry an
    // already-elite derived stat a couple of points past 99.
    const clamp = (v) => Math.max(1, Math.min(ATTRIBUTE_CAP, Math.round(v)));
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
  // Legacy 5-stat (att/def/pac/phy/tec) positional weights. No longer read
  // by the OVR pipeline (see c0025c below) — the position-based raw-
  // attribute calc replaced this — but ATTR_POS_WEIGHTS/attrPosGroup above
  // are left alone since nothing in the OVR formula depends on this
  // function anymore.
  function weightedOverall(derived, posArr) {
    const w = ATTR_POS_WEIGHTS[attrPosGroup(posArr)] || ATTR_POS_WEIGHTS.CM;
    return Math.round(derived.att * w.att + derived.def * w.def + derived.pac * w.pac +
      derived.phy * w.phy + derived.tec * w.tec);
  }
/*@CHUNK:c0025:END*/

/*@CHUNK:c0025b:START*/
  // ===== eFootball-style INFLATED overall (positional, nonlinear) =====
  // Replaces the old flat-average-plus-38%-peak-lean calc. A plain weighted
  // average (even one leaning partway toward the single best stat) always
  // regresses a player back toward the middle of their attribute spread —
  // it can never explain why a card with a mid-80s average sits near the
  // very top of the scale. eFootball's real inflated positional rating
  // instead treats the position's *most relevant* attributes nonlinearly:
  // elite values in them are worth much more than an equivalent step at a
  // mediocre level, several elite attributes together are worth more than
  // the sum of their parts, and a sheet with no real weakness in its key
  // attributes (even without a single 90+ spike) gets rewarded for that
  // completeness. See positionalRawOverall() in c0025c for the actual calc.
  // Sits above the OVR_SOFT_KNEE asymptote (c0025c) as a hard safety net —
  // in normal play the soft knee keeps everything comfortably under this,
  // so this ceiling is essentially never actually reached.
  const OVERALL_CAP = 124;
  const OVERALL_FLOOR = 40;
  // Ceiling for individual derived attributes (att/def/pac/phy/tec) — see
  // clamp() in deriveStatsFromAttributes. A plain (non-boosted) player's
  // authored sheet tops out at 99 anyway; this only matters once
  // PLAYSTYLE_STAT_MODS nudges are stacked on top of an already-elite stat.
  const ATTRIBUTE_CAP = 105;
  // Non-expanded ("regular") players are scaled down relative to the
  // enhanced/expanded-attribute roster so the boosted players read as
  // genuinely special rather than everyone converging on the same numbers.
  const REGULAR_OVR_MULTIPLIER = 0.95;
/*@CHUNK:c0025b:END*/

/*@CHUNK:c0025c:START*/
  // ===== eFootball-2027-style POSITION-based overall (raw attributes) =====
  // Weighs a fixed, position-specific list of raw attributes directly, so a
  // CF's overall genuinely hinges on Finishing/Off. Awareness/Ball Control
  // etc. while a CB's hinges on Def. Awareness/Tackling/Heading — different
  // players in the same broad area of the pitch get visibly different
  // emphasis instead of collapsing into one generic bucket. This is the
  // primary OVR base for expanded-attribute players (see
  // applyExpandedPlayerAttributes).
  //
  // Each list below is ordered strongest-value-first (as specified) and
  // converted to NONLINEAR (geometrically decaying) weights rather than a
  // flat descending ramp — the single most important attribute for a
  // position carries dramatically more pull than the tenth-most-important
  // one, instead of a mild 10-vs-1 ratio.
  const POSITION_WEIGHT_DECAY = 0.80;
  function makeNonlinearWeights(orderedKeys) {
    const raw = orderedKeys.map((_, i) => Math.pow(POSITION_WEIGHT_DECAY, i));
    const total = raw.reduce((a, b) => a + b, 0);
    const weights = {};
    orderedKeys.forEach((k, i) => { weights[k] = raw[i] / total; });
    return weights;
  }
  const POSITION_ATTR_WEIGHTS = {
    // CF (Centre Forward — covers raw 'CF'/'ST' sheets)
    CF: makeNonlinearWeights(['fin', 'off_awr', 'ball_con', 'dribb', 'tight_pos', 'spd', 'accel', 'phy_con', 'head', 'jmp']),
    // SS (Second Striker) — kept distinct from AMF per eFootball's own split
    SS: makeNonlinearWeights(['off_awr', 'ball_con', 'dribb', 'tight_pos', 'low_pass', 'fin', 'spd', 'accel', 'curl']),
    // LWF/RWF (wide forwards) — also used for RM/LM (wide mid) sheets,
    // the closest match given no separate wide-mid list was specified.
    WF: makeNonlinearWeights(['dribb', 'ball_con', 'tight_pos', 'spd', 'accel', 'off_awr', 'low_pass', 'fin', 'curl']),
    // AMF
    AMF: makeNonlinearWeights(['ball_con', 'dribb', 'tight_pos', 'low_pass', 'lofted_pass', 'off_awr', 'fin', 'curl', 'spd', 'accel']),
    // CMF
    CMF: makeNonlinearWeights(['low_pass', 'lofted_pass', 'ball_con', 'stam', 'def_awr', 'def_eng', 'dribb', 'tight_pos', 'off_awr']),
    // DMF
    DMF: makeNonlinearWeights(['def_awr', 'def_eng', 'tack', 'phy_con', 'stam', 'low_pass', 'ball_con', 'aggr', 'head']),
    // CB
    CB: makeNonlinearWeights(['def_awr', 'tack', 'def_eng', 'phy_con', 'head', 'jmp', 'spd', 'accel', 'bal']),
    // LB/RB (also used for wing-backs — no separate list was specified)
    FB: makeNonlinearWeights(['def_awr', 'tack', 'def_eng', 'spd', 'accel', 'stam', 'low_pass', 'phy_con', 'bal']),
    // GK — ONLY the 5 goalkeeper-specific ratings, nothing outfield mixed in.
    GK: makeNonlinearWeights(['gk_awr', 'gk_catch', 'gk_parry', 'gk_reflex', 'gk_reach'])
  };

  // Maps a player's raw (pre-canonicalization) position string to one of
  // the position groups above. Deliberately reads posArr[0] — the primary
  // position — BEFORE normalizeAllPositions() runs (see init() in
  // ui/matchUI.js — expanded attributes are applied first) so 'SS' is
  // never collapsed into 'CAM'/'AMF' here the way the broader canonPos()
  // system does elsewhere; this resolver is scoped to the OVR calc only
  // and doesn't affect formation/substitution logic.
  function resolveAttrPositionGroup(posArr) {
    const raw = String((posArr && posArr[0]) || 'CM').toUpperCase();
    if (raw === 'GK') return 'GK';
    if (raw === 'CF' || raw === 'ST') return 'CF';
    if (raw === 'SS') return 'SS';
    if (['LW', 'RW', 'LWF', 'RWF', 'LF', 'RF', 'LM', 'RM', 'LMF', 'RMF'].includes(raw)) return 'WF';
    if (['CAM', 'AM', 'AMF'].includes(raw)) return 'AMF';
    if (['CM', 'CMF', 'MF'].includes(raw)) return 'CMF';
    if (['CDM', 'DM', 'DMF'].includes(raw)) return 'DMF';
    if (raw === 'CB' || raw === 'SW') return 'CB';
    if (['LB', 'RB', 'LWB', 'RWB'].includes(raw)) return 'FB';
    return 'CMF';
  }

  // ----- Elite-value curve -----
  // Below OVR_ELITE_FLOOR an attribute counts at face value. Above it, each
  // extra point is worth progressively more (a convex/power curve), so a
  // 90+ stat contributes far more to the rating than the flat gap over an
  // 80 would suggest, and the gap between a 95 and a 99 matters much more
  // than the gap between a 60 and a 64.
  const OVR_ELITE_FLOOR = 65;
  const OVR_ELITE_EXP = 1.55;
  const OVR_ELITE_MULT = 0.018;
  function eliteValue(v) {
    if (v <= OVR_ELITE_FLOOR) return v;
    return v + OVR_ELITE_MULT * Math.pow(v - OVR_ELITE_FLOOR, OVR_ELITE_EXP);
  }

  // How much the rating leans toward the average of the player's best few
  // (post-elite-curve) key attributes rather than the full weighted blend —
  // this is what lets a concentrated cluster of standout attributes pull
  // the whole number up instead of being diluted by the rest of the sheet.
  const OVR_TOPN_LEAN = 0.35;
  const OVR_TOPN_COUNT = 6;

  // Rewards *combinations* of elite attributes among a position's most
  // important ones — several attributes sitting near/above ~90 together
  // are worth more than any one of them alone, reflecting complementary
  // elite tools rather than one standout number. Deliberately SMOOTH
  // (a sigmoid per attribute, summed) rather than a hard ">= 90 counts,
  // 89 doesn't" cutoff — a hard threshold meant two players with near-
  // identical sheets (e.g. one attribute at 89 vs 90) could get wildly
  // different bonuses purely from which side of the line they landed on.
  const OVR_ELITE_MASS_CENTER = 90;
  const OVR_ELITE_MASS_SCALE = 4;
  const OVR_ELITE_MASS_UNIT = 0.35;
  const OVR_ELITE_MASS_TOPN = 6;
  function eliteMassContribution(v) {
    return 1 / (1 + Math.exp(-(v - OVR_ELITE_MASS_CENTER) / OVR_ELITE_MASS_SCALE));
  }

  // Rewards a sheet with no real weak link among its key attributes — a
  // "complete" profile with no glaring hole reads as genuinely elite even
  // without a single 90+ spike (this is part of what gets an all-round-
  // excellent profile like Gullit's up near a spikier, higher-peak profile
  // like Hazard's despite a lower raw average and no single attribute over
  // 91). Based on the AVERAGE of the position's attributes outside its top
  // 3 (the "supporting cast"), not the single worst one — a strict minimum
  // meant one merely-good attribute (say 84 instead of 90) could swing this
  // bonus by more than the attribute gap itself justified, since the power
  // curve was applied to that one point in isolation. Averaging several
  // attributes first smooths that out.
  const OVR_SUPPORT_THRESHOLD = 76;
  const OVR_SUPPORT_EXP = 1.25;
  const OVR_SUPPORT_MULT = 0.8;
  const OVR_SUPPORT_CAP = 12;

  // A handful of positions (goalkeeper especially, with only 5 key
  // attributes instead of 9-10) can stack every bonus above at once when a
  // sheet is elite across the board, pushing the raw pre-clamp score far
  // past what a hard Math.min ceiling would show cleanly — several very
  // different "all-time great" sheets would otherwise all round to the
  // exact same capped number instead of reading as distinct. Above
  // OVR_SOFT_KNEE, each extra point of raw score is worth progressively
  // less (a saturating curve toward, but never quite reaching,
  // OVR_SOFT_KNEE + OVR_SOFT_KNEE_SCALE) instead of being truncated
  // outright — genuinely special sheets still separate from each other
  // near the top instead of collapsing into one shared ceiling number.
  // Below the knee (which sits comfortably above where a standout-but-not-
  // freakish card like the Gullit/Hazard examples land) nothing changes.
  const OVR_SOFT_KNEE = 111;
  const OVR_SOFT_KNEE_SCALE = 10;
  function applySoftKnee(raw) {
    if (raw <= OVR_SOFT_KNEE) return raw;
    const over = raw - OVR_SOFT_KNEE;
    return OVR_SOFT_KNEE + (over * OVR_SOFT_KNEE_SCALE) / (OVR_SOFT_KNEE_SCALE + over);
  }

  // Computes OVR straight from the (manager-boosted) raw attribute sheet
  // using the position's nonlinear weight list above.
  function positionalRawOverall(attr, posGroup) {
    const weights = POSITION_ATTR_WEIGHTS[posGroup] || POSITION_ATTR_WEIGHTS.CMF;
    const keys = Object.keys(weights);
    const rawVals = [];
    const curved = [];
    let sum = 0, wsum = 0;
    keys.forEach((k) => {
      const v = attr[k];
      if (typeof v !== 'number') return;
      rawVals.push(v);
      const cv = eliteValue(v);
      curved.push(cv);
      sum += cv * weights[k];
      wsum += weights[k];
    });
    if (!wsum) return 60;
    const base = sum / wsum;

    const topN = curved.slice().sort((a, b) => b - a).slice(0, Math.min(OVR_TOPN_COUNT, curved.length));
    const topNAvg = topN.reduce((a, b) => a + b, 0) / topN.length;
    const leaned = base + (topNAvg - base) * OVR_TOPN_LEAN;

    const massKeys = keys.slice(0, Math.min(OVR_ELITE_MASS_TOPN, keys.length));
    let eliteMass = 0;
    massKeys.forEach((k) => {
      const v = attr[k];
      if (typeof v !== 'number') return;
      eliteMass += eliteMassContribution(v);
    });
    const massBonus = eliteMass * OVR_ELITE_MASS_UNIT;

    const sortedDesc = rawVals.slice().sort((a, b) => b - a);
    const supporting = sortedDesc.slice(3);
    const supportAvg = supporting.length
      ? supporting.reduce((a, b) => a + b, 0) / supporting.length
      : (sortedDesc.reduce((a, b) => a + b, 0) / (sortedDesc.length || 1));
    const supportGap = Math.max(0, supportAvg - OVR_SUPPORT_THRESHOLD);
    const supportBonus = Math.min(OVR_SUPPORT_CAP, OVR_SUPPORT_MULT * Math.pow(supportGap, OVR_SUPPORT_EXP));

    return leaned + massBonus + supportBonus;
  }
/*@CHUNK:c0025c:END*/

/*@CHUNK:c0028:START*/

  // Applies player-attributes.json to every matching player on every team.
  // Runs once at startup, after restorePlayerForms() so it can safely
  // overwrite this player's persisted baseOvr with the freshly-derived
  // baseline while still preserving their accumulated form delta on top of
  // it — see the form system's comment near applyPlayerForm() for how
  // baseOvr/form/ovr relate.
/*@CHUNK:c0028:END*/

/*@CHUNK:c0029:START*/
  function applyExpandedPlayerAttributes() {
    const hasExpandedData = !!(playerAttributesData && Object.keys(playerAttributesData).length);
    const nationalTeams = teamsData.national || [];
    allTeams.forEach((team) => {
      const isNationalTeam = nationalTeams.includes(team);
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
          // Card overall is fixed to baseOvr — the Form & Condition system
          // (engine/form.js) never adjusts it; only in-match effective
          // attributes move with a player's rolled condition.
          p.ovr = scaledBase;
          p.attrBoosted = false;
          return;
        }
        const posArr = (rawAttr.pos && rawAttr.pos.length) ? rawAttr.pos : (p.pos || ['CM']);
        const isGK = posArr[0] === 'GK';
        const attr = rawAttr;
        const derived = deriveStatsFromAttributes(attr, posArr);
        p.att = derived.att; p.def = derived.def; p.pac = derived.pac;
        p.phy = derived.phy; p.tec = derived.tec;
        // The expanded sheet's position list is more detailed (multiple
        // valid roles) — prefer it over teams.json's when present. posArr
        // above (used for stat derivation) still benefits from the sheet's
        // richer list either way; only the player's *displayed*/selectable
        // p.pos is left alone here. National-team squads are the
        // federation's own roster call-up — jersey number AND position for
        // country duty must stay exactly what teams.json says, even for a
        // player whose (club-context) attribute sheet lists a different
        // number/position. p.num is never touched by this function for any
        // team, club or national — it always comes from teams.json.
        if (!isNationalTeam && attr.pos && attr.pos.length) p.pos = attr.pos.slice();
        // A player whose signature attributes for their own playstyle(s)
        // run well above their sheet average gets a much bigger push
        // toward their overall here than the generic 5-stat blend alone
        // would give them.
        const signatureBonus = styleSignatureBonus(attr, attr.playstyle, isGK);
        // Position-based eFootball 2027-style overall: weighs the raw
        // attribute sheet directly using this exact position's own
        // strongly-valued attribute list (see POSITION_ATTR_WEIGHTS).
        const posGroup = resolveAttrPositionGroup(posArr);
        const rawScore = positionalRawOverall(attr, posGroup) + signatureBonus;
        const base = applySoftKnee(rawScore);
        const boostedBase = Math.max(OVERALL_FLOOR, Math.min(OVERALL_CAP, Math.round(base)));
        p.baseOvr = boostedBase;
        // Card overall is fixed to baseOvr — see the non-expanded branch
        // above for why the old form-delta is gone from this line too.
        p.ovr = boostedBase;
        p.expandedAttrs = attr;
        p.attrBoosted = true;
        p.signatureBonus = signatureBonus;
      });
    });
  }
/*@CHUNK:c0029:END*/

/*@CHUNK:c0029b:START*/

  // ===== Auto-assigned playstyles for regular (non-enhanced) players =====
  // A "regular" player (no player-attributes.json entry, attrBoosted ===
  // false) never gets an expanded attribute sheet, so they never carry a
  // playstyle tag either — every playstyle-driven bonus in the engine
  // (see engine/playstyleBehavior.js) and every playstyle badge in the UI
  // silently no-ops for them. assignPlaystylesToRegularPlayers() closes
  // that gap: every regular player is handed exactly one playstyle tag,
  // drawn from the same tag pool an enhanced player at their position could
  // hold, so regular squads still play with some individual identity on the
  // pitch instead of every player at a given position behaving identically.
  //
  // Deliberately lightweight — this only ever sets p.expandedAttrs.playstyle
  // (a bare object holding just that one array, plus p.autoPlaystyle so the
  // UI can tell an assigned tag apart from an authored one). It never sets
  // p.attrBoosted, never runs deriveStatsFromAttributes/positionalRawOverall,
  // and never touches p.ovr/att/def/pac/phy/tec — a regular player's card
  // stays exactly as scaled by applyExpandedPlayerAttributes() above; only
  // their in-match decision-making/edges (which read expandedAttrs.playstyle
  // directly, via playstyleTagsOf() in engine/playstyleBehavior.js) change.
  const POSITION_PLAYSTYLE_POOL = {
    GK:       ['Offensive Goalkeeper', 'Defensive Goalkeeper'],
    CB:       ['Anchor Man', 'Build Up', 'High Line Master', 'Covering Role', 'Extra Frontman'],
    FB:       ['Offensive Full-back', 'Defensive Full-back', 'Full-back Finisher'],
    CDM:      ['Anchor Man', 'Destroyer', 'Pass Disruptor', 'Shadow Marker', 'Build Up', 'Orchestrator'],
    CM:       ['Box-to-Box', 'Orchestrator', 'Build Up', 'Destroyer', 'Front Line Pressure'],
    CAM:      ['Creative Playmaker', 'Classic No. 10', 'Hole Player', 'Deep-Lying Forward'],
    WIDE_MID: ['Prolific Winger', 'Cross Specialist', 'Roaming Flank', 'Inside Forward', 'Attack Outlet'],
    WINGER:   ['Prolific Winger', 'Cross Specialist', 'Inside Forward', 'Roaming Flank'],
    FWD:      ['Goal Poacher', 'Fox in the Box', 'Target Man', 'Deep-Lying Forward', 'Dummy Runner', 'Hole Player']
  };
  // A dedicated deterministic PRNG, keyed off the player's own id — NOT
  // seededRandom()/the shared mulberry32 stream everything else in the sim
  // draws from. Reusing that shared stream here would mean the exact moment
  // this function runs (which can shift release to release as unrelated
  // startup code changes) perturbs every match/season roll that happens
  // afterward. Hashing the player id instead means the same player always
  // gets the same tag, every load, independent of call order — reuses
  // _hashSeed() from js/rng.js (same file/closure) rather than duplicating
  // that hashing logic.
  function _playstyleAssignRoll(seedStr) {
    return (_hashSeed(seedStr) % 100000) / 100000;
  }
  function assignPlaystylesToRegularPlayers(teams) {
    (teams || []).forEach((team) => {
      (team.players || []).forEach((p) => {
        if (!p || p.attrBoosted) return; // enhanced players keep their own authored tag(s)
        const existingTags = p.expandedAttrs && p.expandedAttrs.playstyle;
        if (existingTags && existingTags.length) return; // already assigned (idempotent re-run)
        const group = attrPosGroup(p.pos);
        const pool = POSITION_PLAYSTYLE_POOL[group] || POSITION_PLAYSTYLE_POOL.CM;
        const pick = pool[Math.floor(_playstyleAssignRoll(p.id + ':autoplaystyle') * pool.length)];
        p.expandedAttrs = p.expandedAttrs || {};
        p.expandedAttrs.playstyle = [pick];
        p.autoPlaystyle = true;
      });
    });
  }
/*@CHUNK:c0029b:END*/

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
  function canonSkillKey(s) {
    const k = normSkillKey(s);
    return SKILL_NAME_ALIASES[k] || k;
  }
  function hasSkill(p, skillName) {
    if (!p || !p.expandedAttrs) return false;
    const target = canonSkillKey(skillName);
    return (p.expandedAttrs.skills || []).some((s) => canonSkillKey(s) === target);
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
  // Restores each player's persistent liveRating ("A".."E") from a
  // previous session — see collectPlayerFormsMap() in engine/form.js for
  // what gets saved. Deliberately only touches liveRating: baseOvr/ovr
  // are re-derived fresh every load by applyExpandedPlayerAttributes()
  // (which runs after this), and `form` (Unwavering/Standard/
  // Inconsistent) is re-derived from player-attributes.json by
  // ensureAllPlayerConditionProfiles() rather than saved/restored here.
  function restorePlayerForms() {
    try {
      const raw = localStorage.getItem('apexPlayerForms');
      if (!raw) return;
      const map = JSON.parse(raw);
      allTeams.forEach(t => (t.players || []).forEach(p => {
        const e = map[p.id];
        if (e && LIVE_RATINGS.includes(e.liveRating)) p.liveRating = e.liveRating;
      }));
    } catch (e) {}
  }
/*@CHUNK:c0299:END*/

/*@CHUNK:c0300:START*/

/*@CHUNK:c0300:END*/

/*@CHUNK:c0301:START*/

  // findPlayerTeams() is called once per player for every leaderboard/Ballon
  // d'Or/career-trophy computation, so it needs to be O(1)-ish rather than
  // rescanning every national + club roster on every call (that full rescan,
  // repeated for every player with any stat recorded, is what made the
  // Awards > Ballon d'Or tab noticeably slow to open). Team rosters
  // (teamsData.national/.club, allTeams) never change after load — there's
  // no live transfer/roster-mutation path in this build — so we can build
  // simple id/name lookup indexes once and reuse them for the life of the
  // page instead of rebuilding on every call.
  let _playerTeamIndexBuilt = false;
  let _nationalById = {};
  let _clubById = {};
  let _playerByIdIdx = {};
  let _nationalByName = {};
  let _clubByName = {};

  function buildPlayerTeamIndexes() {
    if (_playerTeamIndexBuilt) return;
    _nationalById = {}; _clubById = {}; _playerByIdIdx = {};
    _nationalByName = {}; _clubByName = {};
    (teamsData.national || []).forEach(t => {
      (t.players || []).forEach(p => {
        _nationalById[p.id] = t.name;
        (_nationalByName[p.name] || (_nationalByName[p.name] = [])).push({ team: t.name, pos: p.pos, id: p.id });
      });
    });
    (teamsData.club || []).forEach(t => {
      (t.players || []).forEach(p => {
        _clubById[p.id] = t.name;
        (_clubByName[p.name] || (_clubByName[p.name] = [])).push({ team: t.name, pos: p.pos, id: p.id });
      });
    });
    (allTeams || []).forEach(t => (t.players || []).forEach(p => { _playerByIdIdx[p.id] = p; }));
    _playerTeamIndexBuilt = true;
  }
/*@CHUNK:c0301:END*/

/*@CHUNK:c0301b:START*/
  function findPlayerTeams(playerId) {
    buildPlayerTeamIndexes();
    let national = _nationalById[playerId] || null;
    let club = _clubById[playerId] || null;
    // Same real player may exist as two separate roster entries (club + country)
    // with different ids — fall back to a name match to link them. Because
    // different, unrelated players CAN share an identical name, this fallback
    // only accepts a match when it's unambiguous: exactly one other roster
    // entry with that name, and its position overlaps the source player's
    // position. Ambiguous name collisions are left blank rather than risking
    // attributing one player's country/club to a different, same-named player.
    if (!national || !club) {
      const srcPlayer = _playerByIdIdx[playerId];
      if (srcPlayer && srcPlayer.name) {
        const pname = srcPlayer.name;
        const srcPos = (srcPlayer.pos || [])[0];
        const posMatches = (pos) => !srcPos || !pos || !pos.length || pos.includes(srcPos);
        if (!national) {
          const matches = (_nationalByName[pname] || [])
            .filter(c => c.id !== playerId && posMatches(c.pos))
            .map(c => c.team);
          const uniqueTeams = [...new Set(matches)];
          if (uniqueTeams.length === 1) national = uniqueTeams[0];
        }
        if (!club) {
          const matches = (_clubByName[pname] || [])
            .filter(c => c.id !== playerId && posMatches(c.pos))
            .map(c => c.team);
          const uniqueTeams = [...new Set(matches)];
          if (uniqueTeams.length === 1) club = uniqueTeams[0];
        }
      }
    }
    return { national, club };
  }
/*@CHUNK:c0301b:END*/
