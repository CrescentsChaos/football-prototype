# Bolt's Journal - Critical Learnings

## 2026-03-30 - Memoization of `curvedStat` for default rating curves
**Learning:** `curvedStat()` is called thousands of times during match and season simulations to compute non-linear player rating edge adjustments. Because >90% of calls use default baseline parameters (70, 29, 1.6), memoizing integer rating values in a fixed lookup array avoids expensive floating point operations (`Math.pow`, `Math.abs`, `Math.sign`) during hot simulation loops.
**Action:** Fast-path integer ratings (0..100) with default parameters to a fast pre-computed array lookup while falling back to dynamic `Math.pow` for non-default or non-integer parameters.
