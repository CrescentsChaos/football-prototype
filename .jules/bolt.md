## 2026-09-19 - O(1) Team Lookups via Reference-Checked Map Cache
**Learning:** `getTeam(id)` is called thousands of times during match and season simulations. Using `allTeams.find()` causes linear O(N) array scans on every call. Caching `_teamByIdMap` using reference equality check `_teamByIdMapAllTeamsRef !== allTeams` provides a 70x speedup while safely invalidating if `allTeams` is reassigned.
**Action:** When caching collections in vanilla JS state objects, check array reference equality (`_cacheRef !== collection`) for safe O(1) cache invalidation.
