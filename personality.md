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

## Situation model (read this first)

Every "big moment" trait used to key off one boolean, `computeStakes()` (derby OR final OR
close-and-late), and fired at full strength whenever it was true - including a penalty at 4-0 up
in a derby. They now read one of two continuous situation reads (`engine/matchEngine.js`,
chunk `cstakes01`), each answering a different question:

- `occasionLevel(m)` - what kind of FIXTURE is this? 0..1, fixed at kickoff: final 1, derby .7,
  knockout (qf/sf/tournament knockout) .6, clash of two top sides .4. Scoreline never changes it.
- `momentPressure(m, side)` - how much does THIS moment decide the result for `side`? 0..1,
  moves with scoreline and clock. Level or one goal either way is decisive, two goals ahead or
  three behind is not; the clock ramps from .5 (early) to 1 (85'+); the weight is the fixture's
  occasion level, or .6 x lateness in an ordinary game. A dead rubber is 0 whatever the fixture.

| Trait | Reads | Where it acts |
|---|---|---|
| Big-Game / Fragile | `momentPressure` | shot quality (+/-.10 x pressure), shoot appetite (+/-12% x pressure), technique preference once pressure >= .35 |
| Ice-Cold / Bottler | `momentPressure` of the taker's side | penalty (+.09 / -.12 x pressure), direct free-kick (+.05 / -.07 x pressure) |
| Big Occasion Riser / Flop | `occasionLevel` | passing and take-on fluency (+8% / -12% x occasion) - nothing to do with the scoreline |
| Confidence Player | per-match scoring run | shot quality (+2%/stack, max 3), shoot appetite (+5%/stack), chip/curler preference |
| Finisher's Instinct | clock only (ramps 75'-90') | shot quality on box chances (not long shots or headers), who is on the end of box chances |
| Brittle / Iron Man | his live contact load | injury weight, see below |
| Prodigy | live age < 22 | transfer potential, volatile form when Inconsistent |

Overlap rules applied (each trait gets at most ONE quality channel and ONE volume channel):
Big-Game / Fragile / Confidence Player no longer also get a "who is on the end of the chance"
bonus (they already change how often they shoot); Finisher's Instinct no longer also raises
shoot appetite; the combined shot-quality edge is capped at +/-.25 (was .5); the placed-finish
technique preference is the stronger of Ice-Cold / Big-Game, not their product; dribble appetite
from Mazing Run / Trickster / Showboat / Selfish / Incisive Run / Ball-carrying is one additive
pool capped at x1.5 (was a chain reaching ~x2.5) and their success bonuses are capped at +/-.06;
the Big Occasion Riser rating-cap bump is gone (the trait now changes play, so the rating follows).

## Composure & big moments

**Big-Game** *(pre-existing, reworked)*
Finishes better and asks for the ball more in proportion to `momentPressure`. Nothing in a dead
rubber. `shooting.js` -> `resolveShot` (quality), `playerIdentity.js` -> `identityActionMult`
(appetite) and `idPersonalityTechMult` (placed finish).

**Fragile** *(pre-existing, reworked)*
The exact mirror of Big-Game, scaled by the same `momentPressure`.

**Ice-Cold**
Penalty and free-kick conversion boosted, scaled by how much the kick decides the match.
`shooting.js` -> `pickPenOutcome`, `pickFkOutcome`.

**Bottler**
The mirror of Ice-Cold.

**Big Occasion Flop**
Passing and take-on fluency drops on the day of a big FIXTURE (`occasionLevel`), whatever the
scoreline. `passing.js` -> `passingAbility`, `playerIdentity.js` -> `typedCarryAbility`.

**Big Occasion Riser**
The mirror of Flop: crisper passing and sharper take-ons on the day of a big fixture. It used to
only raise the rating ceiling in "big game" matches, which changed no play and double-counted.

**Confidence Player**
Composure builds while he's on a live scoring run this match and resets the moment an effort
doesn't end in a goal (`m.personalityMomentum`). Gated by recent in-match events, not stakes.

**Finisher's Instinct**
Closing-minutes box finisher, any scoreline: shot quality on close-range chances and a larger
share of box chances, ramping in from 75' to 90'. Long shots and headers are not affected.

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
Injury risk that scales with his live contact load (tackles, aerial duels, pressing, interceptions
per minute): x1.10 when he is barely touched up to x1.58 in a duel-heavy game, layered on top of
`injury_res`. The whole weight (all factors) is capped at x2.0.
`injuries.js` → `injuryWeightMult`.

**Iron Man**
The mirror of Brittle — x0.85 down to x0.70 with load, plus genuinely slower fatigue drain
regardless of the `stam` rating. `injuries.js`, `fatigue.js`.

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
A prospect while under 22 (live age, `tmAge`): bigger potential in the transfer market (x1.3 growth)
and more volatile in-match form when his form type is Inconsistent (same amplification as Streaky;
holding both is not a double dose). The old sheet-age gate (<21, a snapshot that never aged) and
the market's <22 gate are now one function, `isYoungProdigy`. `developmentRateMult` is still not
read by anything - there is no progression system yet.
`developmentEngine.js`, `transferEngine.js`, `form.js`.

---

## Update: personality as behaviour, not just a shot-quality number

(Superseded where it conflicts with the situation model at the top: the appetite / chance-share
numbers quoted for Big-Game, Fragile, Confidence Player and Finisher's Instinct in earlier
revisions are replaced by the pressure-scaled values in the table above.)

Previously inert tags that now do something:

**Long Ball Expert** - much larger lofted share of passing, more switches/
crosses, better lofted completion.  **Early Crosser** - higher cross rate; on
the flank in midfield sometimes crosses early (weaker delivery).
**Playmaker** - leans through ball/pass, less likely to be the shooter.
**Incisive Run** - carries more, is the runner through balls/cutbacks find.
**Mazing Run** - more dribbles, better under heavy pressure, holds less.
**Trickster** - more dribbles/chips, draws extra fouls.  **Speeding Bullet** -
carries into space, gets in behind on through balls/counters.
**Ball-carrying** - prefers to carry, slightly more secure.  **Aggressive** -
slightly better tackle success, higher foul rate.
