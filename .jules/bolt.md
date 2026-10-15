## 2026-10-07 - Array Length vs Map Size Cache Invalidation
**Learning:** Comparing `Map.size` to `array.length` (`_map.size !== array.length`) for cache invalidation causes thrashing if the array contains duplicate IDs or elements with missing/null IDs, as `Map.size` will always be smaller than `array.length`, triggering a rebuild on every lookup.
**Action:** Always track array length separately (`_cachedLength !== array.length`) alongside array reference checks (`_cachedRef !== array`).
