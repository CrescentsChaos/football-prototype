## 2026-03-31 - Memoize `hasSkill` and `canonSkillKey` with Set and Map caches

**Learning:** `hasSkill` is called thousands of times per match across shooting, passing, defending, fatigue, set pieces, and match roles. Performing string normalization, regex replaces, and `Array.prototype.some()` scans on `p.expandedAttrs.skills` every time causes noticeable overhead in simulation hot loops.
**Action:** Attach a lazily initialized `Set` (`_canonSkills`) on `p.expandedAttrs` during the first `hasSkill` query to convert `O(N)` array scans into `O(1)` Set lookups, and cache normalized string keys in a Map (`_canonSkillCache`).
