# Bolt's Journal

Critical performance learnings and project anti-patterns.

## 2026-11-12 - WeakMap Set Caching for Player Skill Lookups
**Learning:** `hasSkill(p, skillName)` is called hundreds of times during every match event calculation (shooting, passing, defending, setpieces, fatigue, transitions, etc). Because skills are stored as raw strings in `player.expandedAttrs.skills` array (often 9–12 skills per player), repeatedly running regex normalization (`normSkillKey`) and alias checks on both the target and each skill in the array produces significant string processing and allocation overhead.
Using a `WeakMap` keyed on the player's `expandedAttrs` object to cache a `Set` of pre-canonicalized skills avoids mutating player attribute objects, prevents memory leaks when player objects are discarded, and transforms O(N) array scans into O(1) Set lookups. Caching canonicalized query skill keys in a Map further eliminates regex executions on constant skill names.
**Action:** When frequently querying static or semi-static array attributes on entities during simulation loops, cache canonical representations in a `WeakMap` rather than scanning or mutating the underlying data models.
