# Bolt's Journal

## 2026-09-17 - Lookup Table Optimization for Math.pow in Simulation Loops
**Learning:** `curvedStat()` is called extensively during match simulation for player attribute scaling. Bypassing `Math.pow()` and `Math.sign()` with `Float64Array` lookup tables for integer attributes in [0, 100] provides a ~5x speedup for the function without losing numeric precision.
**Action:** Use typed array LUTs for non-linear mathematical curve functions evaluated repeatedly on bounded integer domains.
