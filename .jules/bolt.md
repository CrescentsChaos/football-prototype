## 2026-03-31 - O(1) Map Caching for Global Lookups
**Learning:** `getTeam(id)` is called frequently across match simulation, tournament, and season calculations. Doing an O(N) `Array.prototype.find` on `allTeams` across 1,000,000 calls takes ~2.17 seconds, whereas Map caching reduces this to ~27 milliseconds (~80x speedup).
**Action:** When source files in `data/` or `engine/` are modified, changes must be applied directly to `dist/app.js` as well if `manifest.json` chunk markers in source files are partial/split.
