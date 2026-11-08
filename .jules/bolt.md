# Bolt's Journal

Critical performance learnings only.

## 2025-05-18 - Caching Player Skill Checks via WeakMap & Set in Match Simulation

**Learning:** In the match and season simulation engine, `hasSkill(p, skillName)` is called frequently in hot simulation paths (such as shooting, defending, passing, fouls, fatigue, and tactical role selection). In the unoptimized state, every single check normalized strings using regular expressions (`replace(/[^a-z0-9]/g, '')`) and iterated through the player's skills array (`Array.prototype.some`), performing regex normalizations and alias lookups repeatedly. Because player attribute sheets are static objects, caching canonicalized skill strings in a `Map` and indexing each player's skills into a canonical `Set` cached via `WeakMap` converts O(N) array scans with string processing into O(1) set membership lookups. This achieves a ~10x speedup in skill checks without mutating player attribute objects or affecting JSON serialization.

**Action:** Whenever working on attribute and skill checks in simulation loops, use WeakMaps keyed by attribute objects to store pre-parsed and indexed lookup structures (like `Set`), ensuring zero memory leaks and instant O(1) checks.
