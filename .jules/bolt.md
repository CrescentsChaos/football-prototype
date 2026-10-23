## 2026-10-11 - Memoize `hasSkill` lookups using canonical skill Sets

**Learning:** `hasSkill` was invoked tens of thousands of times per match tick across tactical, passing, shooting, and fatigue calculations. Every call ran `normSkillKey` (regex replacement & lowercasing) and `.some()` array iterations over player skills. Caching canonical skill strings in a Map cache (`_canonSkillCache`) and building a lazy `Set` (`p.expandedAttrs._canonSkills`) reduced 5,000,000 lookup benchmark time from ~6.15s / 14.35s down to ~0.10s (55x-140x faster) with zero functional differences.

**Action:** Look for attribute/skill check hooks called repeatedly in hot loops during simulation and replace array scans with lazily-constructed Sets. Also ensure `dist/app.js` and source files are updated directly rather than relying solely on `node build.js` if `manifest.json` is missing source chunk markers.
