## 2026-11-02 - Caching Player Canonical Skills via WeakMap and Set

**Learning:** `hasSkill(p, skillName)` is called across 80+ hook points throughout match simulation hot loops (shooting, defending, passing, fatigue, set pieces). The original implementation performed string normalization via regex and alias lookups on every skill in a player's skills list on every check, causing substantial CPU overhead. Caching `canonSkillKey` in a Map and caching canonical skill sets per `p.expandedAttrs` in a `WeakMap` converts O(N) regex scanning to O(1) Set lookups (~44x speedup) without leaking memory or mutating player objects.

**Action:** Whenever checking player attributes/skills/playstyles in simulation loops, use WeakMap/Set indexing or memoization rather than re-normalizing strings across arrays on every tick.
