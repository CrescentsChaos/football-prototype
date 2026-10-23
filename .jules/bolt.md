## 2026-10-16 - Cache invalidation using Map.size vs array length
**Learning:** Checking `Map.size !== array.length` for cache invalidation causes continuous cache rebuilds if any elements lack an ID property or if duplicate keys exist, since Map size will never equal array length.
**Action:** Invalidate caches by tracking array reference (`_ref !== arr`) and array length (`_len !== arr.length`) instead of Map size.
