## 2026-09-18 - Avoid mutating function calls inside Array.prototype.sort comparators
**Learning:** Calling setup or initialization functions (like `ensurePlayerConditionProfile`) inside `.sort()` comparators executes $O(N \log N)$ redundant function calls (up to 140,000 times for 5,500 elements).
**Action:** Always pre-process or pre-ensure properties in a single $O(N)$ `forEach` pass before calling `.sort()`.
