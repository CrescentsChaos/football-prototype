## 2025-05-18 - WeakMap/Set Caching for Repeated Model Attribute Lookups

**Learning:** `hasSkill(p, skillName)` is called heavily across the match simulation pipeline (passing, shooting, duels, goalkeeping, fatigue). Repeatedly iterating over player skill arrays and computing regex normalizations (`normSkillKey`) on both target and player skills creates significant cumulative CPU overhead in match hot loops.
**Action:** Use a `WeakMap` keyed on the player's `expandedAttrs` object to lazily cache a `Set` of canonicalized skills, combined with a `Map` cache for normalized skill string aliases. This converts O(N) linear array scans with string manipulation into O(1) Set lookups without polluting or mutating the underlying data objects or leaking memory.
