## 2026-10-21 - O(1) Skill Lookups in Simulation Hot Loops
**Learning:** `hasSkill(p, skillName)` was being called hundreds of thousands of times per match simulation. Without caching, every lookup executed `normSkillKey` (regex string manipulation `replace(/[^a-z0-9]/g, '')`) and iterated through the player's skills array (`.some()`).
**Action:** Use a global `Map` (`_canonSkillCache`) to memoize string canonicalization and a lazy `Set` (`p.expandedAttrs._canonSkills`) for O(1) skill membership checks in hot loops.
