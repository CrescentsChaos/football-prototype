# Personality Traits

Personality tags live at `player.expandedAttrs.personality` (an array — a
player can hold zero, one, or several). They're read directly by the match
and season engines via `personality.includes('Tag Name')`, so a tag changes
actual in-engine behavior, not just a stat number. A player with no
personality entry plays exactly as before — every check below is a no-op
unless the tag is present.

Traits marked **(pre-existing)** were already in the engine. Everything
else was added on top of them, several explicitly extending or mirroring
an existing tag's pattern (noted below).

---

## Composure & big moments

**Big-Game** *(pre-existing)*
Shot quality boosted in high-stakes moments (derby, final, close-and-late).
`shooting.js` → `resolveShot`. Gated by `stakes` (`computeStakes`).

**Fragile** *(pre-existing)*
The mirror of Big-Game — shot quality reduced under the same stakes gate.
`shooting.js` → `resolveShot`. Gated by `stakes`.

**Ice-Cold**
Penalty and free-kick conversion boosted. Scoped to set-piece finishing
specifically, rather than open-play shot quality like Big-Game.
`shooting.js` → `pickPenOutcome`, `pickFkOutcome`. Gated by `stakes`.

**Bottler**
The mirror of Ice-Cold — penalty and free-kick conversion reduced.
`shooting.js` → `pickPenOutcome`, `pickFkOutcome`. Gated by `stakes`.

**Big Occasion Flop**
Passing accuracy — not just shooting — drops under stakes.
`passing.js` → `passingAbility`. Gated by `stakes`.

**Big Occasion Riser**
Match-rating ceiling raised specifically in cup/knockout matches. Touches
the rating formula itself, distinct from Big-Game's shot-quality focus.
`matchEngine.js` → `calcPlayerRating`. Gated by `isBigGameContext`
(`m.isBigGame`).

**Confidence Player**
Composure builds while he's on a live scoring run this match, and resets
the moment an effort doesn't end in a goal. Runs on a new per-match
momentum counter (`m.personalityMomentum`), capped at +9% shot quality.
`shooting.js` → `resolveShot` (bump on goal, reset on miss/save). Gated by
recent in-match events, not stakes.

**Finisher's Instinct**
Extra late-game shot-quality bump, unrelated to Big-Game's stakes gate —
fires on the clock alone, any scoreline, including a dead rubber.
`shooting.js` → `resolveShot`. Gated by `minute > 80`.

**Homebody**
Lower shooting/passing/dribbling effectiveness in away fixtures.
`shooting.js`, `decisionModel.js`. Gated by playing as the away side.

**Set-Piece Specialist**
Composure boost specifically on corners and free-kicks, always on —
unrelated to stakes.
`setpieces.js` (free-kicks, via the existing quick-restart `boost` param),
`shooting.js` → `resolveCorner` (corners). No gate.

---

## Discipline & temperament

**Volatile** *(pre-existing)*
Raises the *fouler's own* aggression/foul probability.
`referee.js` → `resolveFoul`. No gate.

**Calm** *(pre-existing)*
The mirror of Volatile — lowers the fouler's own aggression.
`referee.js` → `resolveFoul`. No gate.

**Provocateur**
Raises the *marker's* foul probability, not the Provocateur's own — reads
off the foul's `victim`, not the `fouler`.
`referee.js` → `resolveFoul`. No gate.

**Hot-Head**
Second-yellow risk specifically raised once already booked, on top of the
flat already-booked bump every player gets.
`referee.js` → `resolveFoul` (`alreadyYellow` branch). Gated by already
holding a yellow card.

**Cynical**
More likely to commit a tactical foul to stop an opponent breaking clear,
and less likely to be carded for it. Two-sided: the foul-chance boost
lives where the breakaway duel is resolved, the card discount lives in the
referee's card decision, linked by a `'breakaway'` context tag.
`transitions.js` → `resolveTurnover` (foul chance), `referee.js` →
`resolveFoul` (card discount). Gated on breakaway context
(`toThird === 'ATT'`).

---

## Leadership & team aura

**Leader**
Deepens the *existing* Captaincy aura (extra fatigue-drain and form-spread
dampening) rather than being a new standalone check.
`fatigue.js`. Requires the player to also hold the Captaincy skill.

**Talisman**
Small composure lift for teammates (shot quality) and a small fatigue-drain
reduction for the whole side, purely from being on the pitch — same aura
pattern as Captaincy, no skill prerequisite.
`shooting.js`, `fatigue.js`. Gated by being on the pitch.

---

## Physicality

**Brittle**
Personality-level injury-risk multiplier, layered on top of (not instead
of) the `injury_res` stat — a player can be High injury_res on paper and
still be Brittle.
`injuries.js` → `injuryWeightMult`. No gate.

**Iron Man**
The mirror of Brittle — reduced injury chance, plus genuinely slower
fatigue drain regardless of the `stam` rating.
`injuries.js`, `fatigue.js`. No gate.

**Determined** *(pre-existing)*
Fatigue drain reduced late in a match specifically while losing.
`fatigue.js`. Gated by `isLosing && minute > 75`.

**Slow Starter**
Reduced overall effectiveness in the first ~15 minutes, recovering
linearly back to normal by minute 15. Folded into the same
`conditionMultiplier()` every shooting/passing/defending read already goes
through, so it applies everywhere automatically.
`matchEngine.js` (new `slowStarterMultiplier`, read by `form.js` →
`conditionMultiplier`). Gated by `minute < 15`.

---

## Form

**Streaky**
Amplifies an Inconsistent player's form spread instead of dampening it —
runs hotter and colder than the baseline Inconsistent type predicts.
`form.js` → `rollPlayerCondition`. Applies when form is Inconsistent.

---

## Decision-making & style

**Selfish**
Nudges decision-making toward shooting/dribbling and away from
passing/through-balls/crosses.
`decisionModel.js` → `evaluateBallActions`. No gate.

**Team Player**
The mirror of Selfish — nudges toward passing/through-balls, away from
personal shot/dribble volume.
`decisionModel.js` → `evaluateBallActions`. No gate.

**Showboat**
Higher dribble attempt rate, with a slightly higher turnover risk once he
actually goes for it.
`decisionModel.js` (attempt rate), `possession.js` (turnover risk). No
gate.

**Grinder**
Tackle and interception success rises specifically while his team is
behind on the scoreboard.
`defending.js`. Gated by his team currently losing.

---

## Off-pitch (season/transfer, not match engine)

These don't touch a live match at all — there's no separate transfer
market or player-development simulation in the game yet, so these are
real, working scalar functions sitting in extension-point files, ready for
a future season sim to consume.

**Loyal**
Lowers willingness to engineer a move away from his current club.
`transferAI.js` → `transferWillingnessMult`. Off-pitch.

**Journeyman**
The mirror of Loyal — raises willingness to move clubs.
`transferAI.js` → `transferWillingnessMult`. Off-pitch.

**Mentor**
Speeds up development of younger teammates who share his position group.
`developmentEngine.js` → `mentorDevelopmentBonus`. Off-pitch, per season.

**Prodigy**
Faster own development curve while young, but genuinely more volatile
in-match form during those same years — the volatility reuses Streaky's
spread amplification rather than being a separate system.
`developmentEngine.js` → `developmentRateMult`/`isYoungProdigy`,
`form.js` → `rollPlayerCondition`. Gated by age < 21.
