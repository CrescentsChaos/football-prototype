## 2026-09-07 - O(1) Skill Membership Checks via Cached Set and Memoized String Canonicalization
**Learning:** `hasSkill` was invoked thousands of times per match during simulation hot paths, running O(N) array scans and executing string lowercasing, regex operations, and alias lookups on every skill string on every check.
**Action:** Memoize string canonicalization using a dictionary cache (`CANON_SKILL_CACHE`) and lazily attach a `Set` (`_skillSet`) on `p.expandedAttrs` for O(1) skill checks. This yields a ~50x speedup (reducing 1M skill checks from 3.01s to 60ms).
