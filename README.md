# Apex Football Simulator — project structure

## What changed

1. **Deterministic randomness.** Every `Math.random()` call (148 call sites)
   was replaced with `seededRandom()`, backed by a small `mulberry32` PRNG in
   `js/rng.js`. Given the same seed, a match/season/tournament now plays out
   identically every time.
   - The seed persists in `localStorage` across reloads by default.
   - Call `App.setRngSeed(seedOrString)` (e.g. in the browser console, or
     wire it to a UI control) to lock in a specific seed, and
     `App.getRngSeed()` to read the current one back — handy for reproducing
     or sharing an interesting match.

2. **Split into modules.** The old single 8,661-line `app.js` is now organized
   under `js/`, `engine/`, `simulation/`, `ai/`, `data/`, `ui/` as requested.

## Why there's a build step

The whole app is one shared JS closure (`var App = (() => { ... })()`) —
that's how all these functions read and mutate the same in-memory game state
without a framework. A browser can't literally resume an unclosed function
body in a second `<script>` file, so — the same way webpack/rollup would in
a normal project — `build.js` concatenates the split files back into one
runnable script:

```
node build.js
```

This regenerates `dist/app.js`, which is what `index.html` actually loads.
**Run this after editing any source file** — editing `dist/app.js` directly
will get overwritten on the next build.

`build.js` has zero dependencies (plain Node, no npm install needed) and
uses `manifest.json`, which records the exact original ordering of every
code chunk so the rebuilt file is behaviorally identical to the original
(verified byte-for-byte against the original `app.js`, aside from the RNG
change described above).

## Folder guide

```
js/           rng.js (seeded PRNG), state.js (shared game state + embedded
               data), main.js (bootstrap/public API glue)
engine/        the live match simulation: matchEngine, possession, passing,
               shooting, defending, goalkeeper, tactics, transitions,
               referee, injuries
simulation/    season & tournament progression: seasonEngine,
               tournamentEngine, worldEngine
ai/            managerAI (playstyle/tactics modelling)
data/          playerDatabase (attribute derivation), teamDatabase
ui/            rendering & DOM wiring: matchUI, seasonUI, playerUI, teamUI,
               statisticsUI
```

A few requested files — `simulation/transferEngine.js`,
`simulation/developmentEngine.js`, `ai/clubAI.js`, `ai/transferAI.js`,
`ai/scoutingAI.js`, `data/competitions.js` — are left as empty placeholders
with a comment explaining why: the original app doesn't have a transfer
market, club-negotiation AI, or scouting subsystem, so there was no existing
code to move into them. They're there so the folder layout matches what you
asked for and are ready to build into.

Some categorization is a judgment call rather than a hard boundary (e.g. a
few render-heavy functions sit in `ui/` even though they're triggered from
deep inside a simulation flow) — grep for a function name if it's not where
you expect; `manifest.json` records exactly where every original line went.
