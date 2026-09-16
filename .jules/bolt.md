## 2026-03-29 - Memoization Anti-Pattern for Simple Math Operations in V8

**Learning:**
In modern JavaScript V8/JIT engines, `Math.pow()` on primitive numbers is heavily optimized at the CPU level. Attempting to memoize pure mathematical calculations (like `curvedStat`) with key construction, map/object lookups, and function overhead can actually degrade performance or introduce collision/memory leak risks if not carefully constrained. Pure function optimizations must be benchmarked against V8 JIT directly.

**Action:**
Before attempting to memoize pure mathematical functions, benchmark primitive calculation vs. object/string lookup overhead in Node.js/V8 to ensure a net performance gain.
