## 2026-03-29 - Lazily caching playstyle action multipliers and edge sums

**Learning:** In match decision-making loops (`evaluateBallActions()` and shooting/defending/goalkeeping edge calculations), `playstyleActionMult` and `playstyleEdgeSum` were previously iterating over player playstyle tags and performing nested object lookups on `PLAYSTYLE_BEHAVIOR` for every candidate action. Lazily pre-computing compound action multipliers and edge sums into `p.expandedAttrs._psCache` turns these frequent calculations into O(1) property lookups.

**Action:** Whenever calculating per-player behavior traits or edge modifiers that depend on static tag arrays (such as `expandedAttrs.playstyle`), compute compound values lazily and cache them on the player object structure (`_psCache`), keyed by tag array reference.
