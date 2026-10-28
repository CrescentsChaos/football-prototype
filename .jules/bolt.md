## 2025-05-18 - Lazy Playstyle Multiplier and Edge Sum Caching
**Learning:** `playstyleActionMult` and `playstyleEdgeSum` are invoked repeatedly across match simulation hot loops (ball decision evaluations, shot finishing/aerial/fk/pen edges, defensive action chances, and goalkeeper positioning/reflexes). Recalculating tag loops and performing `PLAYSTYLE_BEHAVIOR` map lookups on every tick generates unnecessary overhead.
**Action:** Lazily compute and cache `_psCache` on `p.expandedAttrs` (or `p`) during the first access to convert repeated tag scans into O(1) object property lookups.
