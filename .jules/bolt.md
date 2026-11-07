# Bolt's Journal - Critical Performance Learnings

## 2026-11-07 - WeakMap Caching for Player Skill Lookups in Simulation Hot Loops
**Learning:** During match simulation, `hasSkill(p, skillName)` is called frequently across shooting, passing, defending, possession, and fatigue calculations. The baseline implementation performed string regex sanitation and alias dictionary checks via `canonSkillKey` for both target and all player skills in an O(N) array search on every check. By caching canonical skill strings in a `Map` (`_canonSkillCache`) and caching a pre-canonicalized `Set` of player skills in a `WeakMap` (`_canonSkillsMap`) keyed by `p.expandedAttrs`, skill queries become O(1) without mutating player objects or affecting JSON serialization/state persistence.
**Action:** When caching derived structures on game entity objects that are serialized or shared, prefer `WeakMap` to avoid memory leaks, property pollution, and serialization issues.
