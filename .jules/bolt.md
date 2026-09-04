## 2025-09-04 - Map Caching for Global Team Lookups

**Learning:** `getTeam(id)` was performing a linear array scan (`allTeams.find(t => t.id === id)`) across 300+ teams on every single call. Because `getTeam` is used in over 50 places (fixture rendering, match simulation, tournament brackets, leaderboards, and UI player cards), O(N) lookup overhead compounded significantly during batch operations like season simulation and tournament rendering. Converting `getTeam(id)` to an automatically invalidated O(1) `Map` lookup reduced team lookup time by ~97% (from ~167ms down to ~3.9ms for 100k lookups).

**Action:** Always check frequently-called lookup helper functions in data modules (`data/teamDatabase.js`) for linear array `.find()` scans over large dataset arrays, and optimize with cached `Map` or `Object` lookups.
