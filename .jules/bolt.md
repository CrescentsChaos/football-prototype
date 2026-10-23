## 2026-10-03 - O(1) Lookups for Teams and Award Position Checks

**Learning:** `getTeam(id)` was performing an O(N) array search (`allTeams.find`) on every call (called 55+ times across match engine and UI), taking ~447ms for 100k lookups. Also, `showAwards('muller')` and `showAwards('defenders')` were doing nested O(NumPlayers * NumTeams * SquadSize) loops over `allTeams` to check player positions, taking over 64 seconds for 1,000 runs.
Additionally, running `node build.js` strips code from `dist/app.js` because `manifest.json` entries miss some chunks present in `dist/app.js`. Targeted edits must be applied directly to both source files and `dist/app.js`.

**Action:** Cache team lookups in `_teamByIdMap` (O(1) Map) and use `findPlayerAndTeam(s.id)` in award position checks. Always update source files and `dist/app.js` directly to prevent build truncation.
