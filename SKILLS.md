# Skills Reference

Maps every skill in `player-attributes.json` to exactly where it's read in the engine and what it does. All skill checks go through `hasSkill(p, name)` in `data/playerDatabase.js`, which normalizes case/punctuation and aliases known misspellings in the data (e.g. "First-time Shor" → "First-time Shot") — so use the canonical names below when adding a new hook or a new player skill.

Context helpers used by several entries below (defined in `data/playerDatabase.js`):
- `playerTeamLeadingSecondHalf(p)` / `playerTeamTrailingOrDrawingSecondHalf(p)` — scoreline + minute check
- `teamGkHasSkill(p, name)` — does this player's own on-pitch GK have `name`
- `isActingSuperSub(p)` — true only once a Super-Sub player has actually come on in the 2nd half

---

## Shooting
| Skill | File / Function | Effect |
|---|---|---|
| Long Range Curler | `shooting.js` → `fkTakerEdge` | +curl edge on free kicks & longshots |
| Chip Shot Control | `shooting.js` → `finishingEdge`, `penTakerEdge` | small finishing + penalty edge |
| Knuckle Shot | `shooting.js` → `fkTakerEdge` | +curl edge on free kicks & longshots |
| Dipping Shot | `shooting.js` → `fkTakerEdge` | +curl edge on free kicks & longshots |
| Rising Shot | *(commentary flavor only — no numeric hook yet)* | — |
| Long Range Shooting | `shooting.js` → `finishingEdge` | small finishing edge |
| Acrobatic Finishing | `shooting.js` → `finishingEdge` | +0.045 finishing edge |
| First-time Shot | `shooting.js` → `finishingEdge` | +0.02 finishing edge |
| Penalty Specialist | `shooting.js` → `penTakerEdge` | +0.08 penalty edge |

## Passing
| Skill | File / Function | Effect |
|---|---|---|
| Heel Trick | `passing.js` → `passingAbility`, `resolveChanceCreation` | +1 passing; small chance-creation flair bonus |
| One Touch Pass | `passing.js` → `passingAbility` | +2 passing |
| Through Passing | `passing.js` → `passingAbility` | +2.5 passing |
| Weighted Pass | `passing.js` → `passingAbility` | +2 passing |
| Pinpoint Crossing | `passing.js` → `passingAbility`, `resolveChanceCreation`; `setpieces.js` → free-kick crosser detection, cross conversion | +1.5 passing; +cross quality; more likely to be picked as FK/corner crosser |
| Outside Curler | `passing.js` → `passingAbility`; `shooting.js` → `fkTakerEdge` | +1.5 passing; +curl edge |
| Rabona | `passing.js` → `passingAbility`, `resolveChanceCreation` | +1 passing; small chance-creation flair bonus |
| No Look Pass | `passing.js` → `passingAbility`, `resolveChanceCreation` | +1 passing; small chance-creation flair bonus |
| Low Lofted Pass | `passing.js` → `passingAbility` | +1.5 passing |

## Dribbling
| Skill | File / Function | Effect |
|---|---|---|
| Scissors Feint | `shooting.js` → `dribbleSuccessEdge` (skill-move pool) + commentary | +0.08 dribble edge if any move in pool; own-move commentary line |
| Double Touch | same as above | same |
| Flip Flap | same as above | same |
| Marseille Turn | same as above | same |
| Sombrero | same as above | same |
| Chop Turn | same as above | same |
| Cut Behind & Turn | same as above | same |
| Inside Bounce | same as above | same |
| Sole Control | same as above | same |

## Defending
| Skill | File / Function | Effect |
|---|---|---|
| Man Marking | `defending.js` → `defActionEdge` | +tackle chance |
| Track Back | `defending.js` → `defActionEdge`, `defensivePressure`; `fatigue.js` → `fatigueDrainRate` | +tackle chance; +pressure; ×0.94 fatigue drain |
| Interception | `defending.js` → `defActionEdge` | +tackle chance, biases toward interception |
| Blocker | `defending.js` → `defActionEdge` | +tackle chance |
| Aerial Superiority | `shooting.js` → `aerialSkill` | +0.12 aerial |
| Sliding Tackle | `defending.js` → `defActionEdge` | +tackle chance |
| Acrobatic Clearance | `goalkeeper.js` → `gkReflexEdge` | +0.05 GK reflex edge |

## Goalkeeping
| Skill | File / Function | Effect |
|---|---|---|
| GK High Punt | `setpieces.js` → `resolveGoalKick` | +0.08 aerial edge for the long-punt target winning the header |
| GK Low Punt | `setpieces.js` → `resolveGoalKick` | unlocks build-from-back even at lower GK tec; small chance a medium ball springs an immediate chance |
| GK Long Throws | `setpieces.js` → `resolveGoalKick` | opens an alternate quick long-throw distribution branch |
| GK Penalty Saver | `goalkeeper.js` → `penGkEdge` | +0.10 penalty save edge |

## General / Other
| Skill | File / Function | Effect |
|---|---|---|
| Heading | `shooting.js` → `aerialSkill` | +0.12 aerial |
| Long Throws | `setpieces.js` → `resolveThrowIn` | qualifies player as long-throw specialist; +flick-on chance |
| Gamesmanship | `transitions.js` → `resolveTurnover` | ×1.25 foul-drawing chance when this player is challenged |
| Captaincy | `fatigue.js` → `updateFatigue` | ×0.93 fatigue drain for the whole team while on pitch |
| Super-Sub | `shooting.js` → `finishingEdge`; `passing.js` → `passingAbility`, `carryingAbility` | bonus only once actually subbed on in the 2nd half |
| Fighting Spirit | `fatigue.js` → `fatigueDrainRate` | ×0.85 fatigue drain |

## Special / Showtime
| Skill | File / Function | Effect |
|---|---|---|
| Aerial Fort | `shooting.js` → `aerialSkill` (defensive context only) | +0.08 aerial when defending own box (corners, goal kicks) |
| Acceleration Burst | `passing.js` → `carryingAbility`; `shooting.js` → `dribbleSuccessEdge`; `transitions.js` → counter-attack chance | +carrying/dribble edge; +break chance after winning ball |
| Attack Trigger | `possession.js` → `runPossessionSequence` | +0.025 pass/duel success for the whole side while this player carries |
| Attacking Surge | `passing.js` → `carryingAbility`; `transitions.js` → counter-attack chance | +carrying edge; +break chance |
| Blitz Curler | `shooting.js` → `fkTakerEdge` | +0.03 curl edge |
| Bullet Header | `shooting.js` → `aerialSkill` | +0.06 aerial |
| Edged Crossing | same as Pinpoint Crossing (paired everywhere) | see Pinpoint Crossing row |
| Fortress | `defending.js` → `defensivePressure` | +3 pressure while team is leading in 2nd half |
| Game-Changing Pass | `passing.js` → `passingAbility` | +3 passing while team is drawing/losing in 2nd half |
| GK Directing Defense | `defending.js` → `defensivePressure` (via `teamGkHasSkill`) | +1.5 pressure for every defender while this GK is on pitch |
| GK Spirit Roar | `defending.js` → `defensivePressure` (via `teamGkHasSkill`) | +2 pressure for defenders while GK's team leads in 2nd half |
| Long Reach Tackle | `defending.js` → `defActionEdge`, `defensivePressure` | +tackle chance; +pressure |
| Low Screamer | `shooting.js` → `finishingEdge` | +0.03 finishing edge |
| Magnetic Feet | `passing.js` → `carryingAbility`; `shooting.js` → `dribbleSuccessEdge` | +carrying/dribble edge |
| Momentum Dribbling | `passing.js` → `carryingAbility`; `shooting.js` → `dribbleSuccessEdge` | +carrying/dribble edge |
| Phenomenal Finishing | `shooting.js` → `finishingEdge` | +0.06 finishing edge |
| Phenomenal Pass | `passing.js` → `passingAbility`, `resolveChanceCreation` | +2.5 passing; +chance-creation quality |
| Shadow Hunt | `defending.js` → `defActionEdge` | +tackle chance, biases toward interception |
| Visionary Pass | `passing.js` → `passingAbility`, `resolveChanceCreation` | +2 passing; +chance-creation quality |
| Willpower | `shooting.js` → `finishingEdge` | finishing edge grows with shots already taken this match (capped) |

---

### Notes for future edits
- Add new skills to `SKILL_NAME_ALIASES` in `data/playerDatabase.js` only if the data uses a spelling `hasSkill`'s normalization (lowercase + strip non-alphanumerics) can't already resolve.
- A skill with no row/effect above (e.g. **Rising Shot**) exists in the data and displays in UI/commentary but has no dedicated numeric hook yet — safe to add one following the pattern of a neighboring skill in the same table.
