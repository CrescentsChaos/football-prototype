## 2025-05-15 - O(1) Map Indexing for Frequently-Queried Arrays
**Learning:** `allTeams.find(t => t.id === id)` was called over 110 times throughout season simulations and UI renders, causing O(N) linear array searches on every lookup. Caching lookups in a `Map` invalidated on array reference/length changes improves lookup speed by >30x.
**Action:** Use Map-based lazy indexing with `_teamByIdRef !== allTeams || _teamByIdCount !== allTeams.length` invalidation for core lookup helpers.
