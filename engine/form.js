/*@CHUNK:cform01:START*/

  // ===================================================================
  // ================ FORM & CONDITION SYSTEM (eFootball-style) ========
  // ===================================================================
  // Two persistent, per-player attributes drive this system:
  //   p.form       — "Unwavering" | "Standard" | "Inconsistent". How
  //                   consistent this player's day-to-day condition is.
  //                   Sourced from player-attributes.json (expanded
  //                   sheet) when present; any player without one
  //                   defaults to "Inconsistent".
  //   p.liveRating — "A" | "B" | "C" | "D" | "E". This player's current
  //                   run of form, starting at "B" and set directly after
  //                   every match from their rating in that match: 8.9+
  //                   is A, 7.9+ is B, 6.9+ is C, 5.9+ is D, anything
  //                   below that is E.
  //
  // Neither of those is the match-to-match number that actually moves
  // the needle in a game — that's the ephemeral, per-match "condition"
  // rolled once at kickoff (rollSquadConditions): "Excellent" | "Good" |
  // "Normal" | "Poor" | "Terrible". The roll is weighted by liveRating
  // (a player on "A" form is far more likely to roll Excellent/Good than
  // one on "E") and spread by form type (Unwavering barely deviates from
  // what liveRating alone would predict; Inconsistent can swing to
  // either extreme).
  //
  // Condition is intentionally kept OUT of the player object's baseOvr/
  // ovr entirely — per-match condition is looked up live off
  // currentMatch.condition (exactly the same pattern engine/fatigue.js
  // already uses for stamina, see staminaMultiplier()) and only ever
  // multiplies an *in-match* ability read. A player's card/base stats
  // and overall never change because of a bad day.
/*@CHUNK:cform01:END*/

/*@CHUNK:cform02:START*/
  const FORM_TYPES = ['Unwavering', 'Standard', 'Inconsistent'];
  const LIVE_RATINGS = ['A', 'B', 'C', 'D', 'E'];
  const CONDITIONS = ['Excellent', 'Good', 'Normal', 'Poor', 'Terrible'];

  // Base condition-roll weights per liveRating tier, indexed to match
  // CONDITIONS above (Excellent..Terrible). A/B skew toward the good end,
  // C centers on Normal, D/E skew toward the poor end — per spec.
  const LIVE_RATING_CONDITION_WEIGHTS = {
    A: [40, 35, 18, 5, 2],
    B: [22, 33, 30, 11, 4],
    C: [8, 22, 40, 22, 8],
    D: [4, 11, 30, 33, 22],
    E: [2, 5, 18, 35, 40]
  };

  // How far the roll is allowed to stray from its liveRating-predicted
  // peak. 1.0 leaves the base weights above untouched ("moderate
  // variation"); below 1 compresses the roll tightly around the peak
  // tier ("stable"); above 1 exaggerates the tails so extreme swings
  // become meaningfully more likely ("extreme variation").
  const FORM_TYPE_SPREAD = { Unwavering: 0.45, Standard: 1.0, Inconsistent: 1.85 };

  // Flat effective-attribute multiplier per rolled condition — applied
  // (see conditionMultiplier() below) at the specific shooting/passing/
  // dribbling/defending/physical/positioning/goalkeeping read sites
  // spread across the engine, never to baseOvr/ovr.
  const CONDITION_MULTIPLIER = {
    Excellent: 1.08,
    Good: 1.04,
    Normal: 1.0,
    Poor: 0.94,
    Terrible: 0.86
  };
/*@CHUNK:cform02:END*/

/*@CHUNK:cform03:START*/
  // Makes sure a player carries valid form/liveRating values, deriving
  // form from their expanded-attribute sheet (player-attributes.json)
  // the first time this runs for them. Safe to call repeatedly/lazily —
  // every read site below calls this defensively so nothing ever reads
  // undefined form data, even for a player added after the startup pass.
  function ensurePlayerConditionProfile(p) {
    if (!p) return;
    if (!FORM_TYPES.includes(p.form)) {
      const sheetForm = p.expandedAttrs && p.expandedAttrs.form;
      p.form = FORM_TYPES.includes(sheetForm) ? sheetForm : 'Inconsistent';
    }
    if (!LIVE_RATINGS.includes(p.liveRating)) p.liveRating = 'B';
  }
/*@CHUNK:cform03:END*/

/*@CHUNK:cform04:START*/
  // Startup pass — run once after applyExpandedPlayerAttributes() so
  // every player's expandedAttrs (and therefore their authored form
  // type) is already resolved, and after restorePlayerConditionState()
  // so a previously-earned liveRating is restored before this fills in
  // anyone still missing one.
  function ensureAllPlayerConditionProfiles() {
    allTeams.forEach(t => (t.players || []).forEach(ensurePlayerConditionProfile));
  }
/*@CHUNK:cform04:END*/

/*@CHUNK:cform05:START*/
  // Weighted random condition roll for one player ahead of kickoff.
  function rollPlayerCondition(p, captainOnPitch) {
    ensurePlayerConditionProfile(p);
    const base = LIVE_RATING_CONDITION_WEIGHTS[p.liveRating] || LIVE_RATING_CONDITION_WEIGHTS.B;
    let spread = FORM_TYPE_SPREAD[p.form] != null ? FORM_TYPE_SPREAD[p.form] : 1.0;
    // A captain on the pitch (existing Captaincy check — see the identical
    // fatigue.js lookup) dampens teammates' Inconsistent swings; a steady
    // Unwavering/Standard player's spread is untouched.
    if (captainOnPitch && p.form === 'Inconsistent') spread *= 0.9;
    // Streaky: amplifies (rather than dampens, like the Captaincy aura
    // above) an Inconsistent player's spread — a genuinely streaky player
    // runs hot and cold even harder than the baseline Inconsistent type
    // already predicts. Prodigy (simulation/developmentEngine.js) shares
    // this same amplification, gated on age instead of the tag itself —
    // "more volatile form while young" IS a bigger spread multiplier, not
    // a separate system.
    const personality = (p.expandedAttrs && p.expandedAttrs.personality) || [];
    if (personality.includes('Streaky') && p.form === 'Inconsistent') spread *= 1.35;
    if (isYoungProdigy(p) && p.form === 'Inconsistent') spread *= 1.2;
    const peakIdx = base.reduce((best, w, i) => (w > base[best] ? i : best), 0);
    // Stretch/compress each tier's weight by how far it sits from the
    // liveRating's own peak tier — see FORM_TYPE_SPREAD comment above.
    const adjusted = base.map((w, i) => Math.max(0.5, w * Math.pow(spread, Math.abs(i - peakIdx))));
    const total = adjusted.reduce((a, b) => a + b, 0);
    let r = seededRandom() * total;
    for (let i = 0; i < adjusted.length; i++) {
      r -= adjusted[i];
      if (r <= 0) return CONDITIONS[i];
    }
    return CONDITIONS[CONDITIONS.length - 1];
  }
/*@CHUNK:cform05:END*/

/*@CHUNK:cform06:START*/
  // Rolls and stores pre-match condition for every player in a squad
  // (starters + bench — a sub might come on) into currentMatch.condition,
  // keyed by side then player id. Called once per match from
  // startMatch(), mirroring how fatigue/stamina state is scoped to
  // currentMatch rather than stored on the player object itself.
  function rollSquadConditions(squad) {
    const out = {};
    ((squad && squad.all) || []).forEach(p => { out[p.id] = rollPlayerCondition(p); });
    return out;
  }

  function rollMatchConditions(m) {
    if (!m) return;
    m.condition = {
      home: rollSquadConditions(m.home.squad),
      away: rollSquadConditions(m.away.squad)
    };
  }
/*@CHUNK:cform06:END*/

/*@CHUNK:cform07:START*/
  // Live lookup of a player's rolled condition for the match currently
  // in progress. Falls back to "Normal" (neutral) outside of a match, or
  // for a player this match never rolled a condition for.
  function getPlayerCondition(p) {
    const m = currentMatch;
    if (!m || !p || !m.condition) return 'Normal';
    const side = playerMatchSide(p);
    if (!side) return 'Normal';
    return (m.condition[side] && m.condition[side][p.id]) || 'Normal';
  }
/*@CHUNK:cform07:END*/

/*@CHUNK:cform08:START*/
  // The single multiplier every condition-aware ability read below
  // applies, exactly the way staminaMultiplier(p) already gets applied
  // throughout the engine — never touches baseOvr/ovr, only ever scales
  // an in-match performance read (shooting/passing/dribbling/defending/
  // physical/positioning/goalkeeping — see the call sites in
  // shooting.js, passing.js, defending.js and goalkeeper.js).
  function conditionMultiplier(p) {
    const cond = getPlayerCondition(p);
    const base = CONDITION_MULTIPLIER[cond] != null ? CONDITION_MULTIPLIER[cond] : 1;
    // Slow Starter folds in here too (see slowStarterMultiplier in
    // engine/matchEngine.js) — same choke point as the condition roll
    // above, so every existing call site picks up both automatically.
    return base * slowStarterMultiplier(p);
  }
/*@CHUNK:cform08:END*/

/*@CHUNK:cform09:START*/
  // Post-match progression: a player's liveRating is set directly from
  // their rating in the match that just finished — not drifted/eased
  // toward it — so the tier always reflects the most recent performance:
  //   8.9+ rating -> A,  7.9+ -> B,  6.9+ -> C,  5.9+ -> D,  else -> E.
  function updateLiveRatingAfterMatch(p, rating) {
    if (!p) return;
    ensurePlayerConditionProfile(p);
    if (rating >= 8.9) p.liveRating = 'A';
    else if (rating >= 7.9) p.liveRating = 'B';
    else if (rating >= 6.9) p.liveRating = 'C';
    else if (rating >= 5.9) p.liveRating = 'D';
    else p.liveRating = 'E';
  }
/*@CHUNK:cform09:END*/

/*@CHUNK:cform10:START*/
  // Small badge + longer label, both keyed off liveRating — same call
  // signature/markup classes as the old numeric-form version so every
  // existing caller (ui/playerUI.js, ui/playersUI.js) needs no changes
  // at all. Wording is deliberately kept distinct from the CONDITIONS
  // vocabulary below (Excellent/Good/Normal/Poor/Terrible) — liveRating
  // and per-match condition are two different scales, and sharing words
  // between them was the actual cause of a player's lineup badge and
  // profile badge looking like they "didn't match": a match condition
  // of "Poor" next to a liveRating labelled "Good form" reads as a
  // straight contradiction even though the two numbers were never meant
  // to agree. The badge itself is one of the curated PNGs in
  // assets/images/ (a.png, b.png, c.png, d.png, e.png) via emojiImg(),
  // same as the condition badge below, rather than a letter/emoji.
  const LIVE_RATING_DISPLAY = {
    A: { label: 'Rich form', cls: 'form-hot' },
    B: { label: 'Solid form', cls: 'form-up' },
    C: { label: 'Average form', cls: 'form-flat' },
    D: { label: 'Shaky form', cls: 'form-down' },
    E: { label: 'Out of form', cls: 'form-cold' }
  };
  function formArrow(player) {
    ensurePlayerConditionProfile(player);
    const lr = (player && player.liveRating) || 'B';
    const d = LIVE_RATING_DISPLAY[lr] || LIVE_RATING_DISPLAY.B;
    return `<span class="form-arrow ${d.cls}" title="${d.label} (${lr}-rating)">${emojiImg(lr.toLowerCase(), lr + '-rating')}</span>`;
  }
  function formLabel(player) {
    ensurePlayerConditionProfile(player);
    const lr = (player && player.liveRating) || 'B';
    const d = LIVE_RATING_DISPLAY[lr] || LIVE_RATING_DISPLAY.B;
    // Text only — the caller (player profile header) already renders the
    // a.png..e.png badge once via formArrow() right next to this; putting
    // the same image in here too just showed the rating badge twice.
    return d.label;
  }
/*@CHUNK:cform10:END*/

/*@CHUNK:cform11:START*/
  // Pre-match condition badge — shown in the lineup list so a rolled
  // "Excellent"/"Poor"/etc. is visible before kickoff, not just inferred
  // from how the match plays out. Rendered as one of the curated PNGs in
  // assets/images/ (excellent.png, good.png, normal.png, poor.png,
  // terrible.png) via the same emojiImg() helper every other in-app icon
  // already uses, rather than as plain uppercase text.
  function conditionBadgeHTML(p) {
    const cond = getPlayerCondition(p);
    const file = cond.toLowerCase();
    return `<span class="cond-badge" title="Match condition: ${cond}">${emojiImg(file, cond)}</span>`;
  }
/*@CHUNK:cform11:END*/

/*@CHUNK:cform12:START*/
  // Persistence — only liveRating is stateful/dynamic and needs saving;
  // form is re-derived from player-attributes.json (or defaulted) on
  // every load via ensureAllPlayerConditionProfiles(), so it's never
  // written here. Function name kept as collectPlayerFormsMap()/
  // persistPlayerForms()/restorePlayerForms() since simulation/
  // seasonEngine.js and data/playerDatabase.js already call them by
  // those names for save/load.
  function collectPlayerFormsMap() {
    const map = {};
    allTeams.forEach(t => (t.players || []).forEach(p => {
      if (LIVE_RATINGS.includes(p.liveRating) && p.liveRating !== 'B') {
        map[p.id] = { liveRating: p.liveRating };
      }
    }));
    return map;
  }
/*@CHUNK:cform12:END*/
