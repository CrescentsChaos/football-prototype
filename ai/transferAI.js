/**
 * transferAI.js
 *
 * Off-pitch, personality-driven transfer-willingness read.
 *
 * There is still no separate transfer market / club-AI negotiation
 * subsystem in this game — clubs, squads and competitions stay fixed for
 * the season/tournament being played — so this remains an extension point
 * rather than a full market sim. What it DOES provide now is the actual
 * personality-driven willingness scalar itself, ready for a future
 * transfer/season sim to fold in however it weighs a move (transfer
 * request probability, asking-price flex, how hard a player pushes for a
 * move in exit-request dialogue, etc.) — the trait read doesn't need to
 * wait on that sim existing to be correct.
 *
 * If you build that sim, wire it in by calling transferWillingnessMult(p)
 * wherever it currently reads a flat baseline number.
 */

/*@CHUNK:ctrans01:START*/
  // Baseline willingness multiplier (1.0 = neutral, uncapped on purpose so
  // callers can clamp/scale to their own model) to actively engineer a
  // move away from the player's current club, before any club-specific
  // factors (contract length, playing time, ambition mismatch, etc.) a
  // real transfer sim would layer on top. Personality is the only input
  // here — Loyal pulls it down, Journeyman pushes it up — everyone else
  // reads as a neutral 1.0, a no-op for the vast majority of players
  // without a hand-authored personality entry.
  function transferWillingnessMult(p) {
    if (!p || !p.expandedAttrs) return 1;
    const personality = p.expandedAttrs.personality || [];
    let mult = 1;
    if (personality.includes('Loyal')) mult *= 0.55;
    if (personality.includes('Journeyman')) mult *= 1.6;
    return mult;
  }
/*@CHUNK:ctrans01:END*/
