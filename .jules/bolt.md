## 2026-03-31 - Memoizing `getTeam(id)` lookups
**Learning:** `getTeam(id)` is called thousands of times per match simulation and UI render cycle. Using `allTeams.find(...)` performs $O(N)$ linear searches across ~200 teams on every lookup.
**Action:** Use a lazily-initialized `_teamByIdMap` Map cache that invalidates when `allTeams` array reference or length changes to achieve $O(1)$ lookups (~13x speedup).
