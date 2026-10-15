## 2025-02-23 - Hoisting spatial model and squad lookups in evaluateBallActions

**Learning:** `evaluateBallActions()` in `engine/decisionModel.js` is called hundreds of times per match for every ball decision. Inside the 9-candidate action loop (`allowed.forEach`), functions like `playerSideData()` (squad array scans) and `localOverload()`/`halfSpaceOf()` (spatial formation/on-pitch player scans) were being re-calculated for every candidate action, performing dozens of redundant searches per decision.

**Action:** Whenever evaluating candidate actions in simulation decision loops, compute loop-invariant spatial and side context (`playerSideData`, `halfSpaceOf`, `localOverload`, personality flags) once before iterating over candidate actions.
