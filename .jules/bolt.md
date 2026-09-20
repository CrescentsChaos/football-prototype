## 2025-09-20 - Memoization of Player Lookups and O(1) Pitch Fatigue Loops

**Learning:** During match simulation ticks, `updateFatigue()` executed nested array searches (`all.some()`, `onIds.includes()`, `all.find()`) across full squad arrays (~25 players) for both sides on every single minute tick. Similarly, `findPlayerTeams()` re-evaluated name-matching filters and created new objects for players with unassigned national/club entries on repeated leaderboard and Ballon d'Or calls.
**Action:** Use `Set` data structures for on-pitch player lookups to perform single-pass aura checks during tick simulations, and memoize `{ national, club }` objects in `findPlayerTeams()` to eliminate redundant name-matching filter logic and GC allocations.
