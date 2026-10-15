## 2025-09-25 - O(1) Team Lookup Caching
**Learning:** `getTeam(id)` is called tens of thousands of times across simulation and UI components. Calling `allTeams.find()` repeatedly resulted in O(N) array scans over 300+ teams. Using a Map cache (`_teamByIdMap`) with invalidation on `allTeams` array/length changes reduced lookup time by ~7.5x.
**Action:** Always verify if high-frequency helper functions scanning global arrays like `allTeams` use memoized Map lookups.
