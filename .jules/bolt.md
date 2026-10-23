## 2025-10-05 - O(1) Map Caching for Team Lookups in Monolithic Bundle
**Learning:** `getTeam(id)` was performing an O(N) array search (`allTeams.find`) across ~336 teams on every lookup (~55 call sites in hot loops). Implementing an auto-invalidating Map cache (`_teamByIdMap`) reduced 500k lookups from 1.182s to 19.98ms (>50x speedup).
**Action:** When updating source files in `data/`, also update `dist/app.js` directly because `dist/app.js` contains additions missing from `manifest.json` chunks that running `node build.js` alone would strip.
