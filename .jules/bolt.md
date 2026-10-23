## 2026-03-31 - Map Caching for O(1) Team Lookups

**Learning:** `getTeam(id)` was performing an O(N) linear array scan across 328 teams on every lookup in match simulation and UI rendering loops. Using `_teamByIdMap.size !== allTeams.length` for invalidation is an anti-pattern if duplicate or null IDs exist, as it causes continuous Map re-instantiation on every call. Instead, invalidating on `_allTeamsRef !== allTeams || _allTeamsLength !== allTeams.length` safely caches lookups in O(1) time without redundant rebuilds.

**Action:** When creating Map caches for arrays that might contain duplicate or non-unique keys, track array reference and length instead of comparing Map size to array length.
