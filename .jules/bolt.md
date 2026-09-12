## 2025-05-10 - Scoped Sorting Cache vs Permanent Object Mutation
**Learning:** Attaching permanent cached properties (like `_avgOvr`) to domain objects without cache invalidation introduces subtle stale-state bugs when rosters or attributes change. Scoped memoization during sort/filter operations (e.g. constructing a local Map/WeakMap or precomputed sort keys) provides performance gains without risking state corruption.
**Action:** Always scope temporary calculation caches to the lifetime of the sorting/filtering function rather than mutating shared domain objects.
