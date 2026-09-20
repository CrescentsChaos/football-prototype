/**
 * developmentEngine.js
 *
 * Off-pitch, personality-driven youth-development read.
 *
 * There is still no separate season-long player-development/progression
 * subsystem in this game — attributes are static for the season/
 * tournament being played — so this remains an extension point rather
 * than a full development sim. What it DOES provide now is the actual
 * personality-driven scalars themselves (development rate, Mentor's
 * teammate bonus, and the age gate Prodigy's extra form volatility reads
 * off in engine/form.js), ready for a future season sim to fold in
 * wherever it currently applies a flat per-season attribute bump.
 */

/*@CHUNK:cdev01:START*/
  // Prodigy: faster own development curve. Neutral 1.0 for everyone else
  // (including a Prodigy-tagged player past the young-age cutoff below —
  // the accelerated curve is specifically a youth trait, not a permanent
  // one).
  function developmentRateMult(p) {
    if (!isYoungProdigy(p)) return 1;
    return 1.4;
  }

  // Mentor: a senior teammate in the same position group speeds up a
  // younger player's development. Reads the *team's* on-book squad (not
  // just who's currently in the match-day squad) for a Mentor sharing the
  // young player's primary position group, since mentoring is a training-
  // ground/dressing-room relationship, not a matchday one.
  function mentorDevelopmentBonus(youngPlayer, teammates) {
    if (!youngPlayer || !teammates) return 1;
    const posGroup = (youngPlayer.pos || [])[0];
    const hasMentor = teammates.some(t => t.id !== youngPlayer.id
      && ((t.expandedAttrs && t.expandedAttrs.personality) || []).includes('Mentor')
      && (t.pos || []).includes(posGroup));
    return hasMentor ? 1.2 : 1;
  }

  // Prodigy: faster own development curve (see developmentRateMult above),
  // but genuinely more volatile form while young — folds into the same
  // Inconsistent-spread amplification Streaky uses (engine/form.js:
  // rollPlayerCondition), not a separate system, since "more volatile form
  // while young" IS exactly what a bigger FORM_TYPE_SPREAD multiplier
  // already models. ~21 is used as a generic "still a youth prospect"
  // cutoff, matching how the rest of the sheet talks about young players.
  function isYoungProdigy(p) {
    return !!(p && p.expandedAttrs && (p.expandedAttrs.personality || []).includes('Prodigy')
      && typeof p.expandedAttrs.age === 'number' && p.expandedAttrs.age < 21);
  }
/*@CHUNK:cdev01:END*/
