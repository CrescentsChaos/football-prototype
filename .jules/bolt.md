## 2025-05-18 - Caching player skills with WeakMap Set

**Learning:** `hasSkill(p, skillName)` is called hundreds to thousands of times during match simulations and UI evaluations across shooting, passing, defending, set pieces, fatigue, and tactics. Previously, every call performed regex-based string normalization on `skillName` and iterated through `p.expandedAttrs.skills` performing regex normalization on each element (O(N) search with repeated regex replacements and allocations). By caching canonical string keys in a Map and caching parsed canonical Sets in a `WeakMap` keyed by `p.expandedAttrs`, skill checks become O(1) Set lookups without mutating player objects or preventing garbage collection.

**Action:** When working on simulation hot loops with immutable or long-lived attribute objects, use `WeakMap` to associate parsed structures (like Sets) with source objects without mutating original JSON structures or affecting serialization.
