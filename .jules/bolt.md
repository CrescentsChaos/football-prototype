## 2026-09-26 - O(1) Player and Manager Indexing for Award Computation
**Learning:** Award ranking routines (`computeGerdMullerRanking` and `showAwards`) previously iterated over all 300+ teams and their full player rosters using nested `.find()` loops for each candidate player/manager, resulting in over 1.6 million loop iterations during award calculation and tab rendering.
**Action:** Use `findPlayerAndTeam(id)` (which uses `_playerTeamIndexCache`) for O(1) player lookups and `Map` lookups for managers to eliminate nested roster scans.
